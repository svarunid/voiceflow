from datetime import date
from typing import Dict, List, Optional

from sqlalchemy import Date, ForeignKey, Integer, String, Text, JSON, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from voice_flow_shared.db import Base


class Persona(Base):
    __tablename__ = "personas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    age: Mapped[int] = mapped_column(Integer)
    gender: Mapped[str] = mapped_column(String(50))
    debt_amount: Mapped[float] = mapped_column(Float)
    due_date: Mapped[date] = mapped_column(Date)
    description: Mapped[str] = mapped_column(Text)

    test_runs: Mapped[List["TestRun"]] = relationship(
        back_populates="persona", cascade="all, delete-orphan"
    )


class TestRun(Base):
    __tablename__ = "test_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    persona_id: Mapped[int] = mapped_column(
        ForeignKey("personas.id"), nullable=False, index=True
    )
    conversation: Mapped[Optional[List[Dict[str, str]]]] = mapped_column(
        JSON, nullable=True
    )
    # metric: {"politeness": "too_polite|polite|impolite|too_impolite", "negotiation_level": "low|medium|hard"}
    metric: Mapped[Optional[Dict[str, str]]] = mapped_column(JSON, nullable=True)
    feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default="running")
    prompt_version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    persona: Mapped[Persona] = relationship(back_populates="test_runs")
