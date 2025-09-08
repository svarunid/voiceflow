from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from dotenv import load_dotenv

load_dotenv(".env.local")


from voice_flow_shared.db import init_db
from voice_flow_testing.router import router

app = FastAPI(
    title="Voice Flow Testing Platform", version="1.0.0", on_startup=[init_db]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
