import asyncio
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any
from weakref import WeakSet

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from livekit import api

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.db import SessionLocal, get_db
from shared.models import Contact, CallAttempt

logger = logging.getLogger(__name__)

router = APIRouter()
lkapi = api.LiveKitAPI()

# Global set to track background tasks and prevent them from being garbage collected
background_tasks: WeakSet = WeakSet()


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
async def dispatch_call_async(contact: Contact, attempt_id: int = None):
    """Dispatch a single call asynchronously"""
    try:
        # Prepare dispatch configuration
        dispatch_config = {
            "agent_name": "voice-flow-agent",
            "room_name": f"call_{contact.contact_id}_{attempt_id}_{int(datetime.now().timestamp())}",
            "metadata": {
                "contact_id": str(contact.contact_id),
                "phone_number": contact.phone_number,
                "full_name": contact.full_name,
                "language": contact.language,
                "attempt_id": str(attempt_id),
            },
        }

        # Create dispatch using LiveKit agent dispatch
        await lkapi.agent_dispatch.create_dispatch(**dispatch_config)

        # Store the result
        result = {
            "contact_id": contact.contact_id,
            "attempt_id": attempt_id,
            "status": "dispatched",
            "room_name": dispatch_config["room_name"],
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
        # Validate contacts exist
        result = await db.execute(
            select(Contact).where(Contact.contact_id.in_(call_data.contact_ids))
        )
        contacts = result.scalars().all()

        # Create call attempts for each contact
        call_attempts = []
        for contact in contacts:
            attempt = CallAttempt(
                contact_id=contact.contact_id,
                started_at=datetime.now(),
                status="created",
            )
            db.add(attempt)
            call_attempts.append((contact, attempt))

        await db.commit()

        # Refresh to get IDs
        for _, attempt in call_attempts:
            await db.refresh(attempt)

        # Dispatch calls asynchronously with proper task tracking
        call_responses = []
        for contact, attempt in call_attempts:
            # Create the task with proper tracking to prevent garbage collection
            dispatch_task = asyncio.create_task(
                dispatch_call_async(contact, attempt.attempt_id)
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
            f"Initiated calls for {len(contacts)} contacts. All dispatches have been started."
        )

        return CallInitiateResponse(
            initiated_calls=call_responses,
            total_contacts=len(contacts),
            successful_dispatches=len(contacts),  # All were successfully initiated
            failed_dispatches=0,  # We don't know about failures yet since we're not waiting
        )
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error initiating calls: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/attempts/{attempt_id}")
async def get_call_attempt(attempt_id: int, db: AsyncSession = Depends(get_db)):
    """Get details of a specific call attempt"""
    try:
        result = await db.execute(
            select(CallAttempt).where(CallAttempt.attempt_id == attempt_id)
        )
        attempt = result.scalar_one_or_none()

        if not attempt:
            raise HTTPException(status_code=404, detail="Call attempt not found")

        return {
            "attempt_id": attempt.attempt_id,
            "contact_id": attempt.contact_id,
            "started_at": attempt.started_at,
            "status": attempt.status,
            "lk_room_name": attempt.lk_room_name,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting call attempt {attempt_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/attempts")
async def list_call_attempts(
    contact_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """List call attempts with optional filtering"""
    try:
        query = select(CallAttempt)

        if contact_id:
            query = query.where(CallAttempt.contact_id == contact_id)
        if status:
            query = query.where(CallAttempt.status == status)

        query = query.offset(skip).limit(limit)

        result = await db.execute(query)
        attempts = result.scalars().all()

        return [
            {
                "attempt_id": attempt.attempt_id,
                "contact_id": attempt.contact_id,
                "started_at": attempt.started_at,
                "status": attempt.status,
                "lk_room_name": attempt.lk_room_name,
            }
            for attempt in attempts
        ]

    except Exception as e:
        logger.error(f"Error listing call attempts: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
