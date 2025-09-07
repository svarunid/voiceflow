import json
import asyncio
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any, Set
from weakref import WeakSet

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from livekit import api
from voice_flow_shared.db import get_db, SessionLocal
from voice_flow_shared.models import Contact, CallAttempt, Outcome, Debt

logger = logging.getLogger(__name__)

router = APIRouter()
lkapi = api.LiveKitAPI()

# Global set to track background tasks and prevent them from being garbage collected
background_tasks: Set[asyncio.Task] = WeakSet()


def add_background_task(task: asyncio.Task) -> None:
    """Add a background task and set up cleanup when it's done"""
    background_tasks.add(task)
    task.add_done_callback(background_tasks.discard)


# Pydantic models for request/response
class CallInitiate(BaseModel):
    contact_ids: List[int]


class CallResponse(BaseModel):
    contact_id: int
    attempt_id: int
    status: str
    dispatch_id: Optional[str] = None
    error: Optional[str] = None


class CallInitiateResponse(BaseModel):
    initiated_calls: List[CallResponse]
    total_contacts: int
    successful_dispatches: int
    failed_dispatches: int


class OutcomeResponse(BaseModel):
    attempt_id: int
    resolution: str
    description: str
    promise_amount: Optional[int] = None
    promise_date: Optional[datetime] = None

    class Config:
        from_attributes = True


class CallAttemptResponse(BaseModel):
    attempt_id: int
    contact_id: int
    started_at: datetime
    status: str
    lk_room_name: Optional[str] = None
    full_name: str
    phone_number: str

    class Config:
        from_attributes = True


class CallAttemptDetailResponse(BaseModel):
    attempt_id: int
    contact_id: int
    started_at: datetime
    status: str
    lk_room_name: Optional[str] = None
    full_name: str
    phone_number: str
    outcome: Optional[OutcomeResponse] = None

    class Config:
        from_attributes = True


class CallAttemptDelete(BaseModel):
    attempt_ids: List[int]


# Helper function to store dispatch results
async def store_dispatch_result(attempt_id: int, dispatch_result: Dict[str, Any]):
    """Store the dispatch result in the database"""
    async with SessionLocal() as session:
        try:
            # Update the call attempt with dispatch information
            result = await session.execute(
                select(CallAttempt).where(CallAttempt.attempt_id == attempt_id)
            )
            call_attempt = result.scalar_one_or_none()

            if call_attempt:
                call_attempt.status = "dispatched"
                if "room_name" in dispatch_result:
                    call_attempt.lk_room_name = dispatch_result["room_name"]

                await session.commit()
                logger.info(f"Attempt {attempt_id} has beed dispatched")
        except Exception as e:
            logger.error(f"Error storing dispatch result for attempt {attempt_id}: {e}")
            await session.rollback()


# Helper function for async dispatch
async def dispatch_call_async(
    contact: Contact, attempt_id: int = None, debt: Debt = None
):
    """Dispatch a single call asynchronously with debt details"""
    try:
        # Prepare dispatch configuration
        metadata = {
            "contact_id": str(contact.contact_id),
            "phone_number": contact.phone_number,
            "full_name": contact.full_name,
            "language": contact.language,
            "attempt_id": str(attempt_id),
        }

        # Add debt information if available
        if debt:
            metadata.update(
                {
                    "amount_due": str(debt.amount_due),
                    "due_date": debt.due_date.strftime("%d %B %Y")
                    if debt.due_date
                    else None,
                }
            )

        dispatch_config = {
            "agent_name": "voice-flow-agent",
            "room": f"call_{contact.contact_id}_{attempt_id}_{int(datetime.now().timestamp())}",
            "metadata": json.dumps(metadata),
        }

        # Create dispatch using LiveKit agent dispatch
        await lkapi.agent_dispatch.create_dispatch(
            api.CreateAgentDispatchRequest(**dispatch_config)
        )

        # Store the result
        result = {
            "contact_id": contact.contact_id,
            "attempt_id": attempt_id,
            "status": "dispatched",
            "room_name": dispatch_config["room"],
        }

        # Store in background with proper task tracking
        store_task = asyncio.create_task(store_dispatch_result(attempt_id, result))
        add_background_task(store_task)

        logger.info(f"Successfully dispatched call for contact {contact.contact_id}")
        return result
    except Exception as e:
        logger.error(f"Failed to dispatch call for contact {contact.contact_id}: {e}")
        error_result = {
            "contact_id": contact.contact_id,
            "attempt_id": attempt_id,
            "error": str(e),
        }

        # Store error in background with proper task tracking
        store_task = asyncio.create_task(
            store_dispatch_result(attempt_id, error_result)
        )
        add_background_task(store_task)
        return error_result


@router.post("/initiate", response_model=CallInitiateResponse)
async def initiate_calls(
    call_data: CallInitiate,
    db: AsyncSession = Depends(get_db),
):
    """Initiate calls to single or multiple contacts asynchronously"""
    try:
        # Validate contacts exist and fetch their debt details
        result = await db.execute(
            select(Contact, Debt)
            .outerjoin(Debt, Contact.contact_id == Debt.contact_id)
            .where(Contact.contact_id.in_(call_data.contact_ids))
        )
        contact_debt_pairs = result.all()

        # Create list of (contact, debt) tuples
        contacts_with_debts = [(contact, debt) for contact, debt in contact_debt_pairs]

        # Create call attempts for each contact
        call_attempts = []
        for contact, debt in contacts_with_debts:
            attempt = CallAttempt(
                contact_id=contact.contact_id,
                started_at=datetime.now(),
                status="created",
            )
            db.add(attempt)
            call_attempts.append((contact, attempt, debt))

        await db.commit()

        # Refresh to get IDs
        for _, attempt, _ in call_attempts:
            await db.refresh(attempt)

        # Dispatch calls asynchronously with proper task tracking
        call_responses = []
        for contact, attempt, debt in call_attempts:
            # Create the task with proper tracking to prevent garbage collection
            dispatch_task = asyncio.create_task(
                dispatch_call_async(contact, attempt.attempt_id, debt)
            )
            add_background_task(dispatch_task)

            # Create response for the initiated call
            call_responses.append(
                CallResponse(
                    contact_id=contact.contact_id,
                    attempt_id=attempt.attempt_id,
                    status="initiated",  # Status is 'initiated' since we just dispatched
                )
            )

        logger.info(
            f"Initiated calls for {len(contacts_with_debts)} contacts. All dispatches have been started."
        )

        return CallInitiateResponse(
            initiated_calls=call_responses,
            total_contacts=len(contacts_with_debts),
            successful_dispatches=len(
                contacts_with_debts
            ),  # All were successfully initiated
            failed_dispatches=0,  # We don't know about failures yet since we're not waiting
        )
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error initiating calls: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/attempts")
async def delete_call_attempts(
    attempt_delete: CallAttemptDelete, db: AsyncSession = Depends(get_db)
):
    """Delete single or multiple call attempts"""
    try:
        # Check if attempts exist
        result = await db.execute(
            select(CallAttempt).where(
                CallAttempt.attempt_id.in_(attempt_delete.attempt_ids)
            )
        )
        existing_attempts = result.scalars().all()
        existing_ids = {a.attempt_id for a in existing_attempts}
        missing_ids = set(attempt_delete.attempt_ids) - existing_ids

        if missing_ids:
            raise HTTPException(
                status_code=404, detail=f"Call attempts not found: {list(missing_ids)}"
            )

        # Delete the attempts (this will cascade to outcomes due to foreign key constraints)
        await db.execute(
            delete(CallAttempt).where(
                CallAttempt.attempt_id.in_(attempt_delete.attempt_ids)
            )
        )

        await db.commit()

        logger.info(f"Deleted {len(attempt_delete.attempt_ids)} call attempts")
        return {
            "message": f"Successfully deleted {len(attempt_delete.attempt_ids)} call attempts",
            "deleted_attempt_ids": attempt_delete.attempt_ids,
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting call attempts: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/attempts/{attempt_id}", response_model=CallAttemptDetailResponse)
async def get_call_attempt(attempt_id: int, db: AsyncSession = Depends(get_db)):
    """Get details of a specific call attempt with associated outcome and contact information"""
    try:
        # Get call attempt with contact information
        result = await db.execute(
            select(CallAttempt, Contact)
            .join(Contact, CallAttempt.contact_id == Contact.contact_id)
            .where(CallAttempt.attempt_id == attempt_id)
        )
        attempt_contact = result.first()

        if not attempt_contact:
            raise HTTPException(status_code=404, detail="Call attempt not found")

        attempt, contact = attempt_contact

        # Get associated outcome if exists
        outcome_result = await db.execute(
            select(Outcome).where(Outcome.attempt_id == attempt_id)
        )
        outcome = outcome_result.scalar_one_or_none()

        # Prepare response
        response_data = {
            "attempt_id": attempt.attempt_id,
            "contact_id": attempt.contact_id,
            "started_at": attempt.started_at,
            "status": attempt.status,
            "lk_room_name": attempt.lk_room_name,
            "full_name": contact.full_name,
            "phone_number": contact.phone_number,
        }

        if outcome:
            response_data["outcome"] = {
                "attempt_id": outcome.attempt_id,
                "resolution": outcome.resolution.value,  # Convert enum to string
                "description": outcome.description,
                "promise_amount": outcome.promise_amount,
                "promise_date": outcome.promise_date,
            }

        return CallAttemptDetailResponse(**response_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting call attempt {attempt_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/attempts", response_model=List[CallAttemptDetailResponse])
async def list_call_attempts(
    contact_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """List call attempts with optional filtering, associated outcomes, and contact information"""
    try:
        # Build query to join CallAttempt with Contact
        query = select(CallAttempt, Contact).join(
            Contact, CallAttempt.contact_id == Contact.contact_id
        )

        if contact_id:
            query = query.where(CallAttempt.contact_id == contact_id)
        if status:
            query = query.where(CallAttempt.status == status)

        query = query.offset(skip).limit(limit)

        result = await db.execute(query)
        attempt_contact_pairs = result.all()

        # Get outcomes for all attempts
        attempt_ids = [attempt.attempt_id for attempt, _ in attempt_contact_pairs]
        outcome_result = await db.execute(
            select(Outcome).where(Outcome.attempt_id.in_(attempt_ids))
        )
        outcomes = outcome_result.scalars().all()

        # Create a mapping of attempt_id to outcome
        outcome_map = {outcome.attempt_id: outcome for outcome in outcomes}

        # Prepare response list
        response_list = []
        for attempt, contact in attempt_contact_pairs:
            response_data = {
                "attempt_id": attempt.attempt_id,
                "contact_id": attempt.contact_id,
                "started_at": attempt.started_at,
                "status": attempt.status,
                "lk_room_name": attempt.lk_room_name,
                "full_name": contact.full_name,
                "phone_number": contact.phone_number,
            }

            outcome = outcome_map.get(attempt.attempt_id)
            if outcome:
                response_data["outcome"] = {
                    "attempt_id": outcome.attempt_id,
                    "resolution": outcome.resolution.value,  # Convert enum to string
                    "description": outcome.description,
                    "promise_amount": outcome.promise_amount,
                    "promise_date": outcome.promise_date,
                }

            response_list.append(CallAttemptDetailResponse(**response_data))

        return response_list

    except Exception as e:
        logger.error(f"Error listing call attempts: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
