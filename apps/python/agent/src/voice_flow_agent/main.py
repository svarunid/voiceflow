import os
import json
import asyncio
import logging

from dotenv import load_dotenv

load_dotenv(".env.local")

from livekit import api, agents
from livekit.plugins import google, cartesia, deepgram, noise_cancellation, silero
from livekit.plugins.turn_detector.english import EnglishModel

from voice_flow_agent.agent import VoiceFlowAgent
from voice_flow_agent.utils import update_attempt, write_transcript_to_s3


OUTBOUND_TRUNK_ID = os.getenv("OUTBOUND_TRUNK_ID")
logger = logging.getLogger(__name__)


async def entrypoint(ctx: agents.JobContext):
    """Main entrypoint for the Voice Flow Agent.

    Args:
        ctx: The job context containing room and job information
    """
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
                status="call_ended",
            )
        )

    # Recording call requires egress service to be configured locally.
    egress_request = api.RoomCompositeEgressRequest(
        room_name=ctx.room.name,
        audio_only=True,
        file_outputs=[
            api.EncodedFileOutput(
                file_type=api.EncodedFileType.OGG,
                filepath=f"recordings/{room.name}.ogg",
                s3=api.S3Upload(
                    bucket=f"{os.getenv('AWS_S3_BUCKET')}",
                    region=os.getenv("AWS_REGION"),
                    access_key=os.getenv("AWS_ACCESS_KEY_ID"),
                    secret=os.getenv("AWS_SECRET_ACCESS_KEY"),
                ),
            )
        ],
    )

    await ctx.api.egress.start_room_composite_egress(egress_request)

    session = agents.AgentSession(
        stt=deepgram.STT(model="nova-3"),
        llm=google.LLM(model="gemini-2.5-flash"),
        tts=cartesia.TTS(model="sonic-2"),
        vad=silero.VAD.load(),
        turn_detection=EnglishModel(),
    )

    # Create debt collection agent with customer information
    agent = VoiceFlowAgent(dial_info=dial_info)

    # Add shutdown callback to write transcript to S3
    async def write_transcript():
        await write_transcript_to_s3(
            session, room.name, attempt_id, dial_info["contact_id"]
        )

    ctx.add_shutdown_callback(write_transcript)

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
                room_name=room.name,
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
