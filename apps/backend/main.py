from dotenv import load_dotenv

load_dotenv(".env.local")

from fastapi import FastAPI  # noqa: E402

from routers import calls, contacts, health  # noqa: E402
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))
from shared.db import init_db  # noqa: E402

app = FastAPI(title="Voice Flow API", version="0.1.0", on_startup=[init_db])

app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(calls.router, prefix="/api/calls", tags=["calls"])
app.include_router(contacts.router, prefix="/api/contacts", tags=["contacts"])
