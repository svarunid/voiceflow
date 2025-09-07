import logging
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from voice_flow_shared.db import get_db
from voice_flow_shared.models import Contact, Debt, CallAttempt

logger = logging.getLogger(__name__)

router = APIRouter()


class DebtCreate(BaseModel):
    amount_due: int
    due_date: Optional[datetime] = None
    status: str = "overdue"


class ContactCreate(BaseModel):
    full_name: str
    phone_number: str
    language: str = "en-US"
    country_code: Optional[str] = None
    debt: Optional[DebtCreate] = None


class DebtResponse(BaseModel):
    debt_id: int
    amount_due: int
    due_date: Optional[datetime] = None
    status: str

    class Config:
        from_attributes = True


class CallAttemptResponse(BaseModel):
    attempt_id: int
    contact_id: int
    started_at: datetime
    status: str
    lk_room_name: Optional[str] = None

    class Config:
        from_attributes = True


class ContactResponse(BaseModel):
    contact_id: int
    full_name: str
    phone_number: str
    language: str
    debt: Optional[DebtResponse] = None

    class Config:
        from_attributes = True


class ContactDetailResponse(BaseModel):
    contact_id: int
    full_name: str
    phone_number: str
    language: str
    debt: Optional[DebtResponse] = None
    call_attempts: List[CallAttemptResponse] = []

    class Config:
        from_attributes = True


class ContactDelete(BaseModel):
    contact_ids: List[int]


@router.post("/", response_model=ContactResponse, status_code=201)
async def create_contact(
    contact_data: ContactCreate, db: AsyncSession = Depends(get_db)
):
    """Create a single contact with optional debt details"""
    try:
        # Check if phone number already exists
        existing = await db.execute(
            select(Contact).where(
                Contact.phone_number
                == (contact_data.country_code + contact_data.phone_number)
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail=f"Contact with phone number {contact_data.phone_number} already exists",
            )

        # Create the contact
        new_contact = Contact(
            full_name=contact_data.full_name,
            phone_number=contact_data.country_code + contact_data.phone_number,
            language=contact_data.language,
        )

        db.add(new_contact)
        await db.commit()
        await db.refresh(new_contact)

        # Create debt if provided
        new_debt = None
        if contact_data.debt:
            new_debt = Debt(
                contact_id=new_contact.contact_id,
                amount_due=contact_data.debt.amount_due,
                due_date=contact_data.debt.due_date,
                status=contact_data.debt.status,
            )
            db.add(new_debt)
            await db.commit()
            await db.refresh(new_debt)

        logger.info(
            f"Created contact {new_contact.contact_id} for {new_contact.phone_number}"
            + (f" with debt {new_debt.debt_id}" if new_debt else "")
        )

        # Prepare response
        response_data = {
            "contact_id": new_contact.contact_id,
            "full_name": new_contact.full_name,
            "phone_number": new_contact.phone_number,
            "language": new_contact.language,
        }

        if new_debt:
            response_data["debt"] = {
                "debt_id": new_debt.debt_id,
                "amount_due": new_debt.amount_due,
                "due_date": new_debt.due_date,
                "status": new_debt.status,
            }

        return ContactResponse(**response_data)

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating contact: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/")
async def delete_contacts(
    contact_delete: ContactDelete, db: AsyncSession = Depends(get_db)
):
    """Delete single or multiple contacts"""
    try:
        result = await db.execute(
            select(Contact).where(Contact.contact_id.in_(contact_delete.contact_ids))
        )
        existing_contacts = result.scalars().all()
        existing_ids = {c.contact_id for c in existing_contacts}
        missing_ids = set(contact_delete.contact_ids) - existing_ids

        if missing_ids:
            raise HTTPException(
                status_code=404, detail=f"Contacts not found: {list(missing_ids)}"
            )

        await db.execute(
            delete(Contact).where(Contact.contact_id.in_(contact_delete.contact_ids))
        )

        await db.commit()

        logger.info(f"Deleted {len(contact_delete.contact_ids)} contacts")
        return {
            "message": f"Successfully deleted {len(contact_delete.contact_ids)} contacts",
            "deleted_contact_ids": contact_delete.contact_ids,
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting contacts: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/search", response_model=List[ContactResponse])
async def search_contacts(
    q: str, skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)
):
    """Search contacts by name or phone number (partial matching)"""
    try:
        from sqlalchemy import or_, func

        # Build search query with partial matching for both name and phone number
        search_query = (
            select(Contact)
            .where(
                or_(
                    func.lower(Contact.full_name).contains(func.lower(q)),
                    Contact.phone_number.contains(q),
                )
            )
            .offset(skip)
            .limit(limit)
        )

        contact_result = await db.execute(search_query)
        contacts = contact_result.scalars().all()

        # Get debts for all found contacts
        contact_ids = [contact.contact_id for contact in contacts]
        debt_result = await db.execute(
            select(Debt).where(Debt.contact_id.in_(contact_ids))
        )
        debts = debt_result.scalars().all()

        # Create a mapping of contact_id to debt
        debt_map = {debt.contact_id: debt for debt in debts}

        # Prepare response list
        response_list = []
        for contact in contacts:
            response_data = {
                "contact_id": contact.contact_id,
                "full_name": contact.full_name,
                "phone_number": contact.phone_number,
                "language": contact.language,
            }

            debt = debt_map.get(contact.contact_id)
            if debt:
                response_data["debt"] = {
                    "debt_id": debt.debt_id,
                    "amount_due": debt.amount_due,
                    "due_date": debt.due_date,
                    "status": debt.status,
                }

            response_list.append(ContactResponse(**response_data))

        return response_list

    except Exception as e:
        logger.error(f"Error searching contacts with query '{q}': {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/", response_model=List[ContactResponse])
async def list_contacts(
    skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)
):
    """List all contacts with pagination and debt information"""
    try:
        # Get contacts
        contact_result = await db.execute(select(Contact).offset(skip).limit(limit))
        contacts = contact_result.scalars().all()

        # Get debts for all contacts
        contact_ids = [contact.contact_id for contact in contacts]
        debt_result = await db.execute(
            select(Debt).where(Debt.contact_id.in_(contact_ids))
        )
        debts = debt_result.scalars().all()

        # Create a mapping of contact_id to debt
        debt_map = {debt.contact_id: debt for debt in debts}

        # Prepare response list
        response_list = []
        for contact in contacts:
            response_data = {
                "contact_id": contact.contact_id,
                "full_name": contact.full_name,
                "phone_number": contact.phone_number,
                "language": contact.language,
            }

            debt = debt_map.get(contact.contact_id)
            if debt:
                response_data["debt"] = {
                    "debt_id": debt.debt_id,
                    "amount_due": debt.amount_due,
                    "due_date": debt.due_date,
                    "status": debt.status,
                }

            response_list.append(ContactResponse(**response_data))

        return response_list

    except Exception as e:
        logger.error(f"Error listing contacts: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{contact_id}", response_model=ContactDetailResponse)
async def get_contact(contact_id: int, db: AsyncSession = Depends(get_db)):
    """Get a single contact by ID with debt information and all call attempts"""
    try:
        # Get contact
        contact_result = await db.execute(
            select(Contact).where(Contact.contact_id == contact_id)
        )
        contact = contact_result.scalar_one_or_none()

        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")

        # Get associated debt if exists
        debt_result = await db.execute(
            select(Debt).where(Debt.contact_id == contact_id)
        )
        debt = debt_result.scalar_one_or_none()

        # Get all call attempts for this contact
        call_attempts_result = await db.execute(
            select(CallAttempt)
            .where(CallAttempt.contact_id == contact_id)
            .order_by(CallAttempt.started_at.desc())
        )
        call_attempts = call_attempts_result.scalars().all()

        # Prepare response
        response_data = {
            "contact_id": contact.contact_id,
            "full_name": contact.full_name,
            "phone_number": contact.phone_number,
            "language": contact.language,
            "call_attempts": [
                {
                    "attempt_id": attempt.attempt_id,
                    "contact_id": attempt.contact_id,
                    "started_at": attempt.started_at,
                    "status": attempt.status,
                    "lk_room_name": attempt.lk_room_name,
                }
                for attempt in call_attempts
            ],
        }

        if debt:
            response_data["debt"] = {
                "debt_id": debt.debt_id,
                "amount_due": debt.amount_due,
                "due_date": debt.due_date,
                "status": debt.status,
            }

        return ContactDetailResponse(**response_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting contact {contact_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
