import os
import boto3
from functools import lru_cache
from typing import Optional


# S3 configuration
S3_BUCKET_NAME = os.getenv("PROMPTS_S3_BUCKET", "voice-flow-prompts")
PINNED_PROMPT_VERSION = os.getenv("PINNED_PROMPT_VERSION", "v1-v1")


@lru_cache(maxsize=128)
def _get_s3_client():
    """Get cached S3 client."""
    return boto3.client('s3')


def download_prompt_from_s3(version: Optional[str] = None) -> str:
    """Download a prompt from S3 bucket.
    
    Args:
        version: The prompt version to download (e.g., "v1-v1"). 
                If None, uses the pinned version from environment.
    
    Returns:
        The prompt content as a string.
        
    Raises:
        Exception: If the prompt cannot be downloaded or doesn't exist.
    """
    if version is None:
        version = PINNED_PROMPT_VERSION
    
    s3_key = f"{version}.txt"
    
    try:
        s3_client = _get_s3_client()
        response = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key=s3_key)
        prompt_content = response['Body'].read().decode('utf-8')
        return prompt_content
    except Exception as e:
        raise Exception(f"Failed to download prompt version {version} from S3: {str(e)}")


def upload_prompt_to_s3(prompt_content: str, version: str) -> None:
    """Upload a prompt to S3 bucket.
    
    Args:
        prompt_content: The prompt content to upload.
        version: The prompt version (e.g., "v1-v2").
        
    Raises:
        Exception: If the prompt cannot be uploaded.
    """
    s3_key = f"{version}.txt"
    
    try:
        s3_client = _get_s3_client()
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=s3_key,
            Body=prompt_content.encode('utf-8'),
            ContentType='text/plain'
        )
    except Exception as e:
        raise Exception(f"Failed to upload prompt version {version} to S3: {str(e)}")


def get_next_version(current_version: str) -> str:
    """Generate the next version number for prompt versioning.
    
    Args:
        current_version: Current version in format "v{base}-v{current}" (e.g., "v1-v2")
        
    Returns:
        Next version in format "v{base}-v{next}" (e.g., "v1-v3")
    """
    try:
        # Parse version format: v{base_version}-v{current_version}
        parts = current_version.split('-')
        if len(parts) != 2 or not parts[0].startswith('v') or not parts[1].startswith('v'):
            raise ValueError("Invalid version format")
        
        base_version = parts[0]  # e.g., "v1"
        current_num = int(parts[1][1:])  # e.g., 2 from "v2"
        next_num = current_num + 1
        
        return f"{base_version}-v{next_num}"
    except (ValueError, IndexError) as e:
        raise ValueError(f"Invalid version format '{current_version}'. Expected format: v{{base}}-v{{current}}")


# Fallback default prompt (used if S3 download fails)
DEFAULT_AGENT_PROMPT = """You are a professional debt collection agent calling on behalf of Voice Flow, a telecommunications company. 
Your role is to handle debt collection calls in a respectful, empathetic, and professional manner.

CUSTOMER DETAILS:
- Full Name: {full_name}
- Outstanding Debt (in rupees): {debt_amount}
- Due Date: {due_date}

CALL STRUCTURE:
1. INTRODUCTION: Introduce yourself as Diane calling from Voice Flow regarding their account.
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

INSTRUCTIONS:
- Remember to be patient, professional, and focused on finding a mutually acceptable solution
- If they seem unresponsive or hostile, remain calm and professional
- STRICTLY generate output only in plain english. DON'T use markdown format
- Use the `store_resolution` tool to record the resolution reached
- Use the `end_call` tool if the conversation becomes unproductive or if they request to end the call
- Use the `detected_answering_machine` tool if you detect the call went to voicemail
"""


def generate_instruction(contact: dict, prompt_version: Optional[str] = None) -> str:
    """Generate a personalized prompt for the debt collection agent.

    Args:
        contact: Dictionary containing contact information including:
                - full_name: Customer's full name
                - debt_amount: Outstanding debt amount
                - due_date: Payment due date
        prompt_version: Optional prompt version to use. If None, uses pinned version.

    Returns:
        Formatted prompt string with customer details included
    """
    # Extract customer details with defaults
    full_name = contact["full_name"]
    debt_amount = contact["amount_due"]
    due_date = contact["due_date"]

    # Format debt amount if it's a number
    if isinstance(debt_amount, int):
        debt_amount = f"${(debt_amount / 100)}"

    # Try to get prompt from S3, fallback to default if it fails
    try:
        agent_prompt = download_prompt_from_s3(prompt_version)
    except Exception as e:
        print(f"Warning: Could not download prompt from S3, using default: {e}")
        agent_prompt = DEFAULT_AGENT_PROMPT

    return agent_prompt.format(
        full_name=full_name, debt_amount=debt_amount, due_date=due_date
    )


def get_current_prompt_version() -> str:
    """Get the currently pinned prompt version from environment.
    
    Returns:
        The current pinned prompt version string.
    """
    return PINNED_PROMPT_VERSION
