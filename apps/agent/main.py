import os
import json
import asyncio
import logging
from datetime import datetime

from dotenv import load_dotenv

load_dotenv(".env.local")

from livekit import api
from livekit import agents
from livekit.plugins import google, cartesia, deepgram, noise_cancellation, silero
from livekit.plugins.turn_detector.english import EnglishModel
from sqlalchemy import select

import sys

sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))
from shared.models import Outcome, ResolutionType, CallAttempt
from shared.db import SessionLocal as AsyncSessionLocal


DATABASE_URL = os.getenv("DATABASE_URL")
OUTBOUND_TRUNK_ID = os.getenv("OUTBOUND_TRUNK_ID")
AGENT_PROMPT = """You are a professional debt collection agent calling on behalf of Voice Flow, a telecommunications company. 
Your role is to handle debt collection calls in a respectful, empathetic, and professional manner.

CALL STRUCTURE:
1. INTRODUCTION: Introduce yourself as calling from Voice Flow regarding their account.
2. VERIFICATION: Ask for their name to verify you're speaking with the right person.
3. DEBT NOTIFICATION: Inform them about their outstanding balance with Voice Flow and ask if they are willing to pay now.
4. IF YES:
        PAYMENT REMINDER: Remind them they can log into the Voice Flow mobile app to pay their dues.
    ELSE:
        REASON INQUIRY: Ask why they haven't been able to make their payments.
5. CONCLUDE: End the call by thanking them for co-operation and asking them a rating for the debt remainder service.

TONE AND APPROACH:
- Be professional, respectful, and empathetic
- Listen actively to their concerns and reasons for non-payment
- Avoid being aggressive or threatening
- Show understanding of their situation while emphasizing the importance of resolving the debt
- Be solution-oriented and helpful

INSTRUCITONS:
- Remember to be patient, professional, and focused on finding a mutually acceptable solution
- If they seem unresponsive or hostile, remain calm and professional
- STRICTLY generate output only in plain english. DON'T use markdown format
- Use the `store_resolution` tool to record the resolution reached. Available resolution types: "promise_to_pay", "extension", "dispute", "dnc", "wrong_number", "no_answer"
- Use the `end_call` tool if the conversation becomes unproductive or if they request to end the call
- Use the `detected_answering_machine` tool if you detect the call went to voicemail
"""

# Database configuration moved to shared module

# Setup logging
logger = logging.getLogger(__name__)


# Models moved to shared module


async def update_attempt(attempt_id: int, status: str):
    """Update the status of a call attempt in the database.

    Args:
        attempt_id: The ID of the call attempt to update
        status: The new status to set
    """
    try:
        async with AsyncSessionLocal() as session:
            # Fetch the call attempt
            result = await session.execute(
                select(CallAttempt).where(CallAttempt.attempt_id == attempt_id)
            )
            call_attempt = result.scalar_one_or_none()

            if not call_attempt:
                logger.error(f"Call attempt with ID {attempt_id} not found")
                return False

            # Update the status
            call_attempt.status = status

            # Commit the changes
            await session.commit()
            logger.info(f"Updated attempt {attempt_id} status to: {status}")
            return True
    except Exception as e:
        logger.error(f"Error updating call attempt {attempt_id}: {e}")
        return False


class VoiceFlowAgent(agents.Agent):
    def __init__(self, dial_info: dict) -> None:
        super().__init__(instructions=AGENT_PROMPT)

        self.dial_info = dial_info
        self.attempt_id = dial_info.get("attempt_id")

    async def hangup(self):
        """Helper function to hang up the call by deleting the room."""

        job_ctx = agents.get_job_context()
        await job_ctx.api.room.delete_room(
            api.DeleteRoomRequest(
                room=job_ctx.room.name,
            )
        )

    @agents.function_tool()
    async def end_call(self, ctx: agents.RunContext):
        """Called when the user wants to end the call and aftering calling any other tools."""
        # Update attempt status
        if self.attempt_id:
            asyncio.create_task(
                update_attempt(
                    attempt_id=self.attempt_id,
                    status="call_ended",
                )
            )

        current_speech = ctx.session.current_speech
        if current_speech:
            await current_speech.wait_for_playout()

        await self.hangup()

    @agents.function_tool()
    async def detected_answering_machine(self, ctx: agents.RunContext):
        """Called when the call reaches voicemail. Use this tool AFTER you hear the voicemail greeting."""
        # Update attempt status
        if self.attempt_id:
            asyncio.create_task(
                update_attempt(
                    attempt_id=self.attempt_id,
                    status="call_ended",
                )
            )

        await self.hangup()

    @agents.function_tool()
    async def store_resolution(
        self,
        ctx: agents.RunContext,
        resolution: str,
        description: str,
        promised_date: str = None,
        promise_amount: str = None,
    ):
        """Called to record a resolution reached from a customer.

        Args:
            resolution: The type of resolution (promise_to_pay, extension, dispute, dnc, wrong_number, no_answer)
            description: Description of the resolution details
            promised_date: Date when payment is promised (optional, for promise_to_pay)
            promise_amount: Amount promised to be paid (optional, for promise_to_pay)
        """
        try:
            # Convert resolution string to ResolutionType enum
            resolution_type = ResolutionType(resolution.lower())

            # Parse promise_date if provided
            promise_date = None
            if promised_date:
                try:
                    # Try different date formats
                    promise_date = datetime.strptime(promised_date, "%Y-%m-%d")
                except ValueError:
                    try:
                        promise_date = datetime.strptime(promised_date, "%m/%d/%Y")
                    except ValueError:
                        logger.warning(f"Could not parse date: {promised_date}")

            # Parse promise_amount if provided (convert to cents/integer)
            promise_amount_int = None
            if promise_amount:
                try:
                    # Remove dollar signs and convert to cents
                    amount_str = promise_amount.replace("$", "").replace(",", "")
                    promise_amount_int = int(
                        float(amount_str) * 100
                    )  # Convert to cents
                except ValueError:
                    logger.warning(f"Could not parse amount: {promise_amount}")

            # Store the outcome in the database
            if self.attempt_id:
                async with AsyncSessionLocal() as session:
                    outcome = Outcome(
                        attempt_id=self.attempt_id,
                        resolution=resolution_type,
                        description=description,
                        promise_amount=promise_amount_int,
                        promise_date=promise_date,
                    )
                    session.add(outcome)
                    await session.commit()
                    logger.info(
                        f"Stored outcome for attempt {self.attempt_id}: {resolution}"
                    )

            # Provide appropriate response based on resolution type
            if (
                resolution_type == ResolutionType.PROMISE_TO_PAY
                and promise_amount
                and promised_date
            ):
                await ctx.session.say(
                    f"Thank you, I've noted that you'll pay {promise_amount} by {promised_date}. You'll receive a confirmation shortly."
                )
            else:
                await ctx.session.say(
                    "Thank you for your time. I've recorded the outcome of our conversation."
                )

        except ValueError as e:
            logger.error(f"Invalid resolution type: {resolution}. Error: {e}")
            await ctx.session.say(
                "I apologize, there was an issue recording the resolution. Let me try again."
            )
        except Exception as e:
            logger.error(f"Error storing resolution: {e}")
            await ctx.session.say(
                "I apologize, there was a technical issue. Your information has been noted."
            )


async def entrypoint(ctx: agents.JobContext):
    room = ctx.room
    dial_info = json.loads(ctx.job.metadata)
    attempt_id = int(dial_info.get("attempt_id"))

    if not attempt_id:
        logger.error("No attempt_id found in job metadata")
        return

    room.on(
        "participant_connected",
        lambda participant: asyncio.create_task(
            update_attempt(
                attempt_id=attempt_id,
                status="participant_connected",
            )
        ),
    )

    room.on(
        "participant_disconnected",
        lambda participant: asyncio.create_task(
            update_attempt(
                attempt_id=attempt_id,
                status="participant_disconnected",
            )
        ),
    )

    session = agents.AgentSession(
        stt=deepgram.STT(model="nova-3"),
        llm=google.LLM(model="gemini-2.5-flash"),
        tts=cartesia.TTS(model="sonic-2"),
        vad=silero.VAD.load(),
        turn_detection=EnglishModel(),
    )

    # Create debt collection agent with customer information
    agent = VoiceFlowAgent(dial_info=dial_info)

    # Create a fire & forget task
    session_started = asyncio.create_task(
        session.start(
            agent=agent,
            room=room,
            room_input_options=agents.RoomInputOptions(
                noise_cancellation=noise_cancellation.BVCTelephony(),
            ),
        )
    )

    try:
        await ctx.api.sip.create_sip_participant(
            api.CreateSIPParticipantRequest(
                room_name=ctx.room.name,
                sip_trunk_id=OUTBOUND_TRUNK_ID,
                sip_call_to=dial_info["attempt_id"],
                wait_until_answered=True,
            )
        )

        # wait for the agent session start
        await session_started
    except api.TwirpError:
        ctx.shutdown()


if __name__ == "__main__":
    agents.cli.run_app(
        agents.WorkerOptions(entrypoint_fnc=entrypoint, agent_name="voice-flow-agent")
    )
