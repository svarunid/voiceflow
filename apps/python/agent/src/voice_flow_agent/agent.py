import asyncio
import logging

from livekit import api, agents
from voice_flow_shared.models import ResolutionType
from voice_flow_shared.prompt import generate_instruction

from voice_flow_agent.utils import (
    update_attempt,
    create_outcome,
    parse_date,
    parse_amount,
)

logger = logging.getLogger(__name__)


class VoiceFlowAgent(agents.Agent):
    def __init__(self, dial_info: dict) -> None:
        personalized_prompt = generate_instruction(dial_info)
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

        if ctx.session.current_speech:
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

            # Parse date and amount using utility functions
            parsed_date = parse_date(promised_date)
            parsed_amount = parse_amount(promised_amount)

            # Store the outcome in the database
            if self.attempt_id:
                asyncio.create_task(
                    create_outcome(
                        self.attempt_id,
                        resolution,
                        description,
                        parsed_amount,
                        parsed_date,
                    )
                )

        except ValueError as e:
            logger.error(f"Invalid resolution type: {resolution}. Error: {e}")
        except Exception as e:
            logger.error(f"Error storing resolution: {e}")
