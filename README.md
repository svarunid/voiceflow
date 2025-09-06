# Voice Flow

Outbound, human-like debt collection voice agent built with LiveKit (SIP + Rooms), SST + LLM + TTS, Twilio (PSTN), FastAPI, React, and Postgres. Place outbound calls to US numbers, converse naturally with barge‑in, record calls, and save transcripts for downstream risk analysis.

## High-level architecture

- Telephony & media:
  - Twilio Elastic SIP Trunking (US number) connects to LiveKit SIP.
  - LiveKit rooms bridge SIP audio (callee) with the AI agent.
- Voice agent:
  - Python agent using LiveKit Agents with  Deepgram (STT) + Gemini (LLM) + Cartesia (TTS).
  - Tools for payment link, promise-to-pay logging, and fetching debt info.
- Backend API:
  - FastAPI for campaigns, calls, transcripts, outcomes, and simple risk scoring.
  - Postgres for contacts, debts, attempts, transcripts, recordings, risk scores.
- Recording & transcripts:
  - LiveKit Egress (planned) for call recordings to S3/GCS.
  - Realtime text turns streamed to backend and broadcast to UI.
- Frontend:
  - React (Vite) dashboard to kick off calls, watch live transcripts, and view recordings and scores.

## Repository layout
```
voice-flow/
├── apps
│   ├── agent
│   │   ├── main.py
│   │   ├── pyproject.toml
│   │   └── uv.lock
│   ├── backend
│   │   ├── db.py
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── pyproject.toml
│   │   ├── routers
│   │   │   ├── calls.py
│   │   │   ├── campaigns.py
│   │   │   ├── health.py
│   │   │   └── transcripts.py
│   │   └── uv.lock
│   └── frontend
│       └── package.json
├── infra
│   ├── docker
│   │   ├── agent.Dockerfile
│   │   ├── backend.Dockerfile
│   │   ├── docker-compose.yml
│   │   └── frontend.Dockerfile
│   └── scripts
└── README.md
```


### Prerequisites

- uv installed (https://github.com/astral-sh/uv)
- Node.js 20+ and npm
- Docker Desktop (optional for compose-based dev)
- LiveKit Cloud project (URL, API key/secret)
- Twilio account with a US number and SIP domain
- Gemini, Deepgram & Cartesia API keys.

### 1. Clone and env file

```bash
git clone <repo> voice-flow
cd voice-flow
```

### 2. Backend setup (FastAPI)

```bash
cd apps/backend
uv sync
# Ensure .env.local has necessary secrets configured.
uv run uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```

Notes:
- On first start, the app auto-creates tables via SQLAlchemy metadata (dev only).
- API base: http://localhost:8080

### 3. Agent setup (LiveKit + Twilio)

```bash
cd apps/agent
uv sync
# Ensure .env.local has necessary secrets configured.
uv run main.py
```

### 4. Frontend setup (React + Vite)

```bash
cd apps/frontend
npm ci
npm run dev -- --host
```

Notes:
- UI on http://localhost:5173

### 5. Optional: Docker Compose

Start the whole stack (Postgres, backend, agent, frontend) via compose:

```bash
make dev
# or
docker compose -f infra/docker/docker-compose.yml up --build
```

Services:
- Postgres: 5432
- Backend: 8080
- Agent: 9090 (internal)
- Frontend: 5173
