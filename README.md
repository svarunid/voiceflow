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
├── apps/
│   ├── python/
│   │   ├── agent/
│   │   ├── shared/
│   │   ├── backend/
│   │   ├── pyproject.toml
│   └── web/
│       ├── index.html
│       ├── package.json
│       ├── package-lock.json
│       ├── README.md
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   ├── types/
│       │   ├── utils/
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   ├── index.css
│       │   └── vite-env.d.ts
│       ├── tsconfig.json
│       ├── tsconfig.node.json
│       └── vite.config.mts
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

### 2. Backend + Agent setup (FastAPI + LiveKit)

Install the dependencies
```bash
cd apps/python
uv sync --all-packages
```

Run the agent in production mode
Run the fastAPI server 
```bash
uv run --package voice-flow-agent agent/src/voice_flow_agent/agent.py start
```

Start the fastapi server
```bash
uv run --package voice-flow-backend uvicorn backend.src.voice_flow_backed.main:app --port 8080
```

### 3. Frontend setup (React + Vite)

Serve the frontend in development mode
```bash
cd apps/frontend
npm i
npm run dev
```