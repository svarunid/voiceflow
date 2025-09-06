from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import (
    Integer,
    String,
    DateTime,
    ForeignKey,
    JSON,
    Enum,
    Text,
)
from datetime import datetime
from enum import Enum as PyEnum
from .db import Base


class ResolutionType(PyEnum):
    PROMISE_TO_PAY = "promise_to_pay"
    EXTENSION = "extension"
    DISPUTE = "dispute"
    DNC = "dnc"
    WRONG_NUMBER = "wrong_number"
    NO_ANSWER = "no_answer"


class Contact(Base):
    __tablename__ = "contacts"
    contact_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120))
    phone_number: Mapped[str] = mapped_column(String(32), unique=True)
    language: Mapped[str] = mapped_column(String(16), default="en-US")


class Debt(Base):
    __tablename__ = "debts"
    debt_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    contact_id: Mapped[int] = mapped_column(
        ForeignKey("contacts.contact_id", ondelete="CASCADE")
    )
    amount_due: Mapped[int] = mapped_column(Integer)
    due_date: Mapped[datetime | None]
    status: Mapped[str] = mapped_column(String(32), default="overdue")


class CallAttempt(Base):
    __tablename__ = "call_attempts"
    attempt_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    contact_id: Mapped[int] = mapped_column(ForeignKey("contacts.contact_id"))
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    status: Mapped[str] = mapped_column(String(32), default="created")
    lk_room_name: Mapped[str | None] = mapped_column(String(128))


# class Transcript(Base):
#     __tablename__ = "transcripts"
#     turn_id: Mapped[int] = mapped_column(Integer, primary_key=True)
#     attempt_id: Mapped[int] = mapped_column(ForeignKey("call_attempts.attempt_id"))
#     ts: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
#     speaker: Mapped[str] = mapped_column(String(16))  # "agent" | "customer"
#     text: Mapped[str] = mapped_column(String)
#     confidence: Mapped[float | None]


class Outcome(Base):
    __tablename__ = "outcomes"
    attempt_id: Mapped[int] = mapped_column(
        ForeignKey("call_attempts.attempt_id"), primary_key=True
    )
    resolution: Mapped[ResolutionType] = mapped_column(Enum(ResolutionType))
    description: Mapped[str] = mapped_column(Text)
    promise_amount: Mapped[int | None]
    promise_date: Mapped[datetime | None]


# class Recording(Base):
#     __tablename__ = "recordings"
#     attempt_id: Mapped[int] = mapped_column(
#         ForeignKey("call_attempts.attempt_id"), primary_key=True
#     )
#     egress_id: Mapped[str] = mapped_column(String(64))
#     storage_url: Mapped[str] = mapped_column(String)
#     duration_sec: Mapped[int | None]


# class RiskScore(Base):
#     __tablename__ = "risk_scores"
#     attempt_id: Mapped[int] = mapped_column(
#         ForeignKey("call_attempts.attempt_id"), primary_key=True
#     )
#     model_version: Mapped[str] = mapped_column(String(32))
#     score: Mapped[float]
#     features_json: Mapped[dict | None] = mapped_column(JSON)
