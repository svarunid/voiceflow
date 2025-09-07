from dotenv import load_dotenv

load_dotenv(".env.local")
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from voice_flow_shared.db import init_db

from .routers import calls, contacts, health

app = FastAPI(title="Voice Flow API", version="0.1.0", on_startup=[init_db])

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(calls.router, prefix="/api/calls", tags=["calls"])
app.include_router(contacts.router, prefix="/api/contacts", tags=["contacts"])
