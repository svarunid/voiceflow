from __future__ import annotations

import asyncio
from datetime import date
from typing import Any, Dict, List

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    Query,
)
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from voice_flow_shared.db import SessionLocal, get_db
from voice_flow_shared.prompt import (
    download_prompt_from_s3,
    upload_prompt_to_s3,
    get_current_prompt_version,
    get_next_version,
)
from voice_flow_testing.models import Persona, TestRun
from voice_flow_testing import llm

router = APIRouter()


class WSManager:
    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = {}

    async def connect(self, test_run_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.setdefault(test_run_id, set()).add(websocket)

    def disconnect(self, test_run_id: int, websocket: WebSocket) -> None:
        conns = self._connections.get(test_run_id)
        if conns and websocket in conns:
            conns.remove(websocket)
            if not conns:
                self._connections.pop(test_run_id, None)

    async def broadcast(self, test_run_id: int, message: dict[str, Any]) -> None:
        import json

        conns = self._connections.get(test_run_id, set())
        dead: List[WebSocket] = []
        payload = json.dumps(message)
        for ws in list(conns):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(test_run_id, ws)


ws_manager = WSManager()


class PersonaGenerateRequest(BaseModel):
    prompt: str


class PersonaResponse(BaseModel):
    id: int
    full_name: str
    age: int
    gender: str
    debt_amount: float
    due_date: date
    description: str


class TestStartRequest(BaseModel):
    name: str
    persona_id: int
    iterations: int = 6


class TestStartResponse(BaseModel):
    test_run_id: int
    ws_url: str


class TestResponse(BaseModel):
    id: int
    name: str
    persona_id: int
    persona_name: str
    conversation: List[Dict[str, str]] | None
    metric: Dict[str, Any] | None
    feedback: str | None
    status: str | None
    prompt_version: str | None


@router.post("/personas/generate", response_model=PersonaResponse)
async def generate_persona(
    req: PersonaGenerateRequest, db: AsyncSession = Depends(get_db)
):
    try:
        data = await asyncio.to_thread(llm.generate_persona, req.prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Persona generation failed: {e}")

    persona = Persona(**data)
    db.add(persona)
    await db.commit()
    await db.refresh(persona)
    return PersonaResponse(
        id=persona.id,
        full_name=persona.full_name,
        age=persona.age,
        gender=persona.gender,
        debt_amount=float(persona.debt_amount),
        due_date=persona.due_date,
        description=persona.description,
    )


@router.get("/personas", response_model=list[PersonaResponse])
async def list_personas(
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(
        100, ge=1, le=1000, description="Maximum number of records to return"
    ),
):
    result = await db.execute(
        select(Persona).order_by(Persona.id.desc()).offset(skip).limit(limit)
    )
    personas = result.scalars().all()
    return [
        PersonaResponse(
            id=p.id,
            full_name=p.full_name,
            age=p.age,
            gender=p.gender,
            debt_amount=float(p.debt_amount),
            due_date=p.due_date,
            description=p.description,
        )
        for p in personas
    ]


@router.get("/tests", response_model=list[TestResponse])
async def list_tests(
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(
        100, ge=1, le=1000, description="Maximum number of records to return"
    ),
):
    result = await db.execute(
        select(TestRun)
        .options(selectinload(TestRun.persona))
        .order_by(TestRun.id.desc())
        .offset(skip)
        .limit(limit)
    )
    test_runs = result.scalars().all()

    return [
        TestResponse(
            id=tr.id,
            name=tr.name,
            persona_id=tr.persona_id,
            persona_name=tr.persona.full_name,
            conversation=tr.conversation,
            metric=tr.metric,
            feedback=tr.feedback,
            status=tr.status,
            prompt_version=tr.prompt_version,
        )
        for tr in test_runs
    ]


@router.post("/tests/start", response_model=TestStartResponse)
async def start_test(req: TestStartRequest, db: AsyncSession = Depends(get_db)):
    persona = await db.get(Persona, req.persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    test_run = TestRun(
        persona_id=persona.id,
        name=req.name,
        conversation=[{"persona": "Hello."}],
        metric=None,
        feedback=None,
        status="running",
        prompt_version=get_current_prompt_version(),
    )
    db.add(test_run)
    await db.commit()
    await db.refresh(test_run)

    asyncio.create_task(_run_test_simulation(test_run, persona.id, req.iterations))

    return TestStartResponse(test_run_id=test_run.id, ws_url=f"/ws/tests/{test_run.id}")


@router.websocket("/ws/tests/{test_run_id}")
async def ws_test(websocket: WebSocket, test_run_id: int):
    await ws_manager.connect(test_run_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(test_run_id, websocket)


class PromptImproveRequest(BaseModel):
    test_run_id: int


class PromptImproveResponse(BaseModel):
    success: bool
    new_version: str | None
    message: str


@router.post("/prompts/improve", response_model=PromptImproveResponse)
async def improve_prompt_from_test_run(
    req: PromptImproveRequest, db: AsyncSession = Depends(get_db)
):
    """Improve the prompt based on test run feedback and metrics.
    
    This endpoint takes a test run ID, analyzes the feedback and metrics,
    downloads the pinned version of the prompt, improves it based on the
    test run results, and stores the new version to AWS S3.
    """
    # Fetch the test run
    test_run = await db.get(TestRun, req.test_run_id)
    if not test_run:
        raise HTTPException(status_code=404, detail="Test run not found")
    
    # Validate that the test run has required data
    if not test_run.metric or not test_run.feedback:
        raise HTTPException(
            status_code=400,
            detail="Test run must have metrics and feedback to improve prompt"
        )
    
    if test_run.status != "failed":
        raise HTTPException(
            status_code=400,
            detail="Can only improve prompts from failed test runs"
        )
    
    try:
        # Get the current pinned prompt version (or the version used in the test run)
        current_version = test_run.prompt_version or get_current_prompt_version()
        
        # Download the current prompt from S3
        current_prompt = download_prompt_from_s3(current_version)
        
        # Improve the prompt using LLM
        improved_prompt = llm.improve_prompt(
            current_prompt=current_prompt,
            metric=test_run.metric,
            feedback=test_run.feedback
        )
        
        # Generate the next version number
        new_version = get_next_version(current_version)
        
        # Upload the improved prompt to S3
        upload_prompt_to_s3(improved_prompt, new_version)
        
        return PromptImproveResponse(
            success=True,
            new_version=new_version,
            message=f"Successfully improved prompt from version {current_version} to {new_version}"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to improve prompt: {str(e)}"
        )


async def _update_conversation_history(
    db: AsyncSession, test_run: TestRun, new_entry: Dict[str, str]
) -> List[Dict[str, str]]:
    """Update the conversation history in the database with a new entry."""
    # Add new entry to conversation
    test_run.conversation = test_run.conversation + [new_entry]
    await db.commit()
    await db.refresh(test_run)

    return test_run.conversation


async def _run_test_simulation(
    test_run: TestRun, persona_id: int, iterations: int
) -> None:
    async with SessionLocal() as db:
        # Fetch the test_run from this database session
        test_run = await db.get(TestRun, test_run.id)
        if not test_run:
            await ws_manager.broadcast(
                test_run.id, {"type": "error", "message": "Test run not found"}
            )
            return
            
        persona = await db.get(Persona, persona_id)
        if not persona:
            await ws_manager.broadcast(
                test_run.id, {"type": "error", "message": "Persona not found"}
            )
            return

        persona_dict: Dict[str, Any] = {
            "id": persona.id,
            "full_name": persona.full_name,
            "age": persona.age,
            "gender": persona.gender,
            "amount_due": float(persona.debt_amount),
            "due_date": persona.due_date.isoformat(),
            "description": persona.description,
        }

        # Initialize conversation history from database for LLM calls
        history: List[Dict[str, str]] = test_run.conversation or []
        await ws_manager.broadcast(
            test_run.id,
            {
                "type": "start",
                "persona": {
                    "id": persona.id,
                    "full_name": persona.full_name,
                    "debt_amount": float(persona.debt_amount),
                    "due_date": persona.due_date.isoformat(),
                },
            },
        )

        for _ in range(max(1, iterations)):
            try:
                a_msg = llm.agent_reply(persona_dict, history)
            except Exception as e:
                await ws_manager.broadcast(
                    test_run.id, {"type": "error", "message": f"Agent LLM error: {e}"}
                )
                break

            a_entry = {
                "role": "agent",
                "content": a_msg,
            }

            history = await _update_conversation_history(db, test_run, {"agent": a_msg})
            await ws_manager.broadcast(test_run.id, {"type": "message", **a_entry})

            try:
                p_msg = llm.persona_reply(persona_dict, history)
            except Exception as e:
                await ws_manager.broadcast(
                    test_run.id, {"type": "error", "message": f"Persona LLM error: {e}"}
                )
                break

            p_entry = {
                "role": "persona",
                "content": p_msg,
            }

            history = await _update_conversation_history(
                db, test_run, {"persona": p_msg}
            )
            await ws_manager.broadcast(test_run.id, {"type": "message", **p_entry})

            await asyncio.sleep(0.1)

        try:
            metric, feedback, status = llm.validate_conversation(history)
        except Exception as e:
            await ws_manager.broadcast(
                test_run.id, {"type": "error", "message": f"Validator LLM error: {e}"}
            )
            metric, feedback, status = None, None, "failed"

        test_run.metric = metric
        test_run.feedback = feedback
        test_run.status = status
        await db.commit()

        await ws_manager.broadcast(
            test_run.id,
            {
                "type": "end",
                "metric": metric,
                "feedback": feedback,
                "status": status,
            },
        )
