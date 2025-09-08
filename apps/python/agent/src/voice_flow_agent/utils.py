import os
import json
import logging
from datetime import datetime
import boto3
from botocore.exceptions import ClientError
from sqlalchemy import select

from livekit import agents
from voice_flow_shared.db import SessionLocal as AsyncSessionLocal
from voice_flow_shared.models import CallAttempt, Outcome


# AWS S3 configuration
AWS_S3_BUCKET = os.getenv("AWS_S3_BUCKET")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")

logger = logging.getLogger(__name__)


async def write_transcript_to_s3(
    session: agents.AgentSession, room_name: str, attempt_id: int, contact_id: str
):
    """Write the session transcript to an S3 bucket.

    Args:
        session: The agent session containing the conversation history
        room_name: The name of the room/call
        attempt_id: The call attempt ID
    """
    if not AWS_S3_BUCKET:
        logger.error(
            "AWS_S3_BUCKET environment variable not set. Cannot upload transcript."
        )
        return

    try:
        # Create S3 client
        s3_client = boto3.client(
            "s3",
            region_name=AWS_REGION,
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        )

        # Generate filename with timestamp
        current_date = datetime.now().strftime("%Y%m%d_%H%M%S")
        s3_key = f"transcripts/transcript_{contact_id}_{attempt_id}_{current_date}.json"

        # Convert transcript to JSON
        transcript_data = session.history.to_dict()
        transcript_json = json.dumps(transcript_data, indent=2)

        # Upload to S3
        s3_client.put_object(
            Bucket=f"{AWS_S3_BUCKET}",
            Key=s3_key,
            Body=transcript_json.encode("utf-8"),
            ContentType="application/json",
            Metadata={
                "room_name": room_name,
                "attempt_id": str(attempt_id),
                "timestamp": current_date,
            },
        )

        logger.info(
            f"Transcript for room {room_name} (attempt {attempt_id}) uploaded to s3://{AWS_S3_BUCKET}/{s3_key}"
        )

    except ClientError as e:
        logger.error(f"Failed to upload transcript to S3: {e}")
    except Exception as e:
        print(e)
        logger.error(f"Unexpected error uploading transcript to S3: {e}")


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
    """Create an outcome record for a call attempt.

    Args:
        attempt_id: The ID of the call attempt
        resolution: The resolution type
        description: Description of the resolution
        promise_amount: Promised payment amount (if applicable)
        promise_date: Promised payment date (if applicable)
    """
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


def parse_date(date_string: str) -> datetime:
    """Parse a date string in various formats.

    Args:
        date_string: Date string to parse

    Returns:
        Parsed datetime object or None if parsing fails
    """
    if not date_string:
        return None

    try:
        # Try different date formats
        return datetime.strptime(date_string, "%Y-%m-%d")
    except ValueError:
        try:
            return datetime.strptime(date_string, "%m/%d/%Y")
        except ValueError:
            logger.warning(f"Could not parse date: {date_string}")
            return None


def parse_amount(amount_string: str) -> int:
    """Parse an amount string and convert to paise (integer cents).

    Args:
        amount_string: Amount string to parse (e.g., "$123.45")

    Returns:
        Amount in paise (cents) or None if parsing fails
    """
    if not amount_string:
        return None

    try:
        # Remove dollar signs and convert to paise
        amount_str = amount_string.replace("$", "").replace(",", "")
        return int(float(amount_str) * 100)  # Convert to paise
    except ValueError:
        logger.warning(f"Could not parse amount: {amount_string}")
        return None
