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

from voice_flow_shared.db import SessionLocal as AsyncSessionLocal
from voice_flow_shared.models import CallAttempt, Outcome, ResolutionType
from voice_flow_shared.prompt import generate_prompt


OUTBOUND_TRUNK_ID = os.getenv("OUTBOUND_TRUNK_ID")
logger = logging.getLogger(__name__)


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


async def create_outcome(
    attempt_id, resolution, description, promise_amount, promise_date
):
    try:
        async with AsyncSessionLocal() as session:
            outcome = Outcome(
                attempt_id=attempt_id,
                resolution=resolution,
                description=description,
                promise_amount=promise_amount,
                promise_date=promise_date,
            )
            session.add(outcome)
            await session.commit()
            logger.info(f"Stored outcome for attempt {attempt_id}: {resolution}")
    except Exception as e:
        logger.error(f"Error updating call attempt {attempt_id}: {e}")
        return False


class VoiceFlowAgent(agents.Agent):
    def __init__(self, dial_info: dict) -> None:
        # Generate personalized prompt with customer details
        personalized_prompt = generate_prompt(dial_info)
        super().__init__(instructions=personalized_prompt)

        self.dial_info = dial_info
        self.attempt_id = int(dial_info["attempt_id"])

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

        await ctx.wait_for_playout()
        await self.hangup()

    @agents.function_tool()
    async def detected_answering_machine(self):
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
        resolution: str,
        description: str,
        promised_date: str = None,
        promised_amount: str = None,
    ):
        """Called to record a resolution reached from a customer.

        Args:
            resolution: The type of resolution (promise_to_pay, extension, dispute, dnc, wrong_number, no_answer)
            description: Description of the resolution details
            promised_date: Date when payment is promised. (datetime parsable) (optional, for promise_to_pay)
            promised_amount: Amount promised to be paid. (optional, for promise_to_pay)
        """
        try:
            # Convert resolution string to ResolutionType enum
            resolution = ResolutionType(resolution.lower())

            if promised_date:
                try:
                    # Try different date formats
                    promised_date = datetime.strptime(promised_date, "%Y-%m-%d")
                except ValueError:
                    try:
                        promised_date = datetime.strptime(promised_date, "%m/%d/%Y")
                    except ValueError:
                        logger.warning(f"Could not parse date: {promised_date}")

            # Parse promise_amount if provided (convert to paise/integer)
            if promised_amount:
                try:
                    # Remove dollar signs and convert to paise
                    amount_str = promised_amount.replace("$", "").replace(",", "")
                    promised_amount = int(float(amount_str) * 100)  # Convert to paise
                except ValueError:
                    logger.warning(f"Could not parse amount: {promised_amount}")

            # Store the outcome in the database
            if self.attempt_id:
                asyncio.create_task(
                    create_outcome(
                        self.attempt_id,
                        resolution,
                        description,
                        promised_amount,
                        promised_date,
                    )
                )

        except ValueError as e:
            logger.error(f"Invalid resolution type: {resolution}. Error: {e}")
        except Exception as e:
            logger.error(f"Error storing resolution: {e}")


async def entrypoint(ctx: agents.JobContext):
    room = ctx.room
    dial_info = json.loads(ctx.job.metadata)
    attempt_id = int(dial_info.get("attempt_id"))

    print(dial_info["phone_number"])
    if not attempt_id:
        logger.error("No attempt_id found in job metadata")
        return

    @room.on("participant_connected")
    def _(_):
        asyncio.create_task(
            update_attempt(
                attempt_id=attempt_id,
                status="participant_connected",
            )
        )

    @room.on("participant_disconnected")
    def _(_):
        asyncio.create_task(
            update_attempt(
                attempt_id=attempt_id,
                status="participant_disconnected",
            )
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
                sip_call_to=dial_info["phone_number"],
                participant_identity=dial_info["phone_number"],
                wait_until_answered=True,
            )
        )

        # wait for the agent session start
        await session_started
    except api.TwirpError as e:
        print(e)
        ctx.shutdown()


if __name__ == "__main__":
    agents.cli.run_app(
        agents.WorkerOptions(entrypoint_fnc=entrypoint, agent_name="voice-flow-agent")
    )
