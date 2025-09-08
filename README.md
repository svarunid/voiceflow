# Voice Flow

Voice Flow is an AI voice agent platform built for collecting dues from customers for telecom service providers. The platform features an automated testing and self-correction system that generates defaulter personas and simulates conversations between the voice agent and these personas to monitor performance and implement improvements.

## Repository layout

The project is organized into two main areas:

- **`apps/python/`** - Contains the backend services and AI agent implementation
  - `agent/` - Core voice agent with STT, LLM, and TTS integration
  - `backend/` - FastAPI server for managing campaigns, calls, and customer data
  - `testing/` - Automated testing platform that generates personas and simulates conversations
  - `shared/` - Common utilities, models, and database schemas

- **`apps/web/`** - Frontend applications built with React
  - `voice-flow-agent-platform/` - Main dashboard for managing customers, campaigns, and monitoring calls
  - `voice-flow-testing-platform/` - Testing interface for persona generation and conversation simulation

## Project Setup

### Prerequisites

Before setting up the Voice Flow platform, ensure you have the following components installed and configured:

#### System Requirements

- **Python 3.13+** - The backend services require Python 3.13 or higher
- **[uv](https://github.com/astral-sh/uv)** - Fast Python package installer and resolver used for dependency management
  ```bash
  # Install uv using the official installer
  curl -LsSf https://astral.sh/uv/install.sh | sh
  ```
- **Node.js 20+** and **npm** - Required for the React frontend applications
  ```bash
  # Verify your Node.js version
  node --version  # Should be 20.0.0 or higher
  ```

#### Database

- **PostgreSQL** - Database for storing customer data, campaigns, and call records
  - Install PostgreSQL server (version 12+ recommended)
  - Create a database for the Voice Flow application
  - Ensure PostgreSQL service is running and accessible

#### Third-Party Services & API Keys

The platform integrates with several external services. You'll need accounts and API credentials for:

- **LiveKit Cloud** - Real-time voice communication infrastructure
  - Create a project at [LiveKit Cloud](https://cloud.livekit.io/)
  - Obtain your project URL, API key, and API secret
  - Used for handling real-time voice streams between agents and customers

- **Twilio** - Telephony services for making and receiving calls
  - Set up a Twilio account with a US phone number
  - Configure a SIP Trunk for outbound voice calls.
  - Create credentials to authenticate with LiveKit.

- **AI Service Providers** - Multiple AI services power different components:
  - **Google Gemini API** - Large Language Model for conversation intelligence
  - **Deepgram API** - Speech-to-Text (STT) conversion
  - **Cartesia API** - Text-to-Speech (TTS) voice synthesis

#### Configuration

- **Environment Variables** - Create a `.env.local` file inside the `apps/python` directory with all required API keys and configuration values. Refer the `.env.example` file.

### Getting Started

1. **Clone the repository**
   ```bash
   git clone <repository-url> voice-flow
   cd voice-flow
   ```

2. **Set up environment variables**
   ```bash
   # Create the environment file
   touch apps/python/.env.local
   # Add all required environment variables (see Configuration section above)
   ```

## Voice Flow Agent Platform

### Backend + Agent Setup (FastAPI + LiveKit)

1. **Install Python dependencies**
   ```bash
   cd apps/python
   uv sync --all-packages
   ```

2. **Start the voice agent**
   ```bash
   uv run --package voice-flow-agent agent/src/voice_flow_agent/main.py start
   ```

3. **Start the FastAPI server**
   ```bash
   uv run --package voice-flow-backend uvicorn backend.src.voice_flow_backend.main:app --port 8080
   ```

### Frontend Setup (React + Vite)

1. **Install dependencies and start development server**
   ```bash
   cd apps/web/voice-flow-agent-platform
   npm install
   npm run dev
   ```
   The frontend will be available at `http://localhost:5173`

## Voice Flow Testing Platform

### Backend Setup (Gemini + FastAPI)

1. **Install dependencies** (if not installed previously)
   ```bash
   cd apps/python
   uv sync --all-packages
   ```

2. **Start the FastAPI testing server**
   ```bash
   uv run --package voice-flow-testing uvicorn backend.src.voice_flow_testing.main:app --port 8000
   ```
   The testing API will be available at `http://localhost:8000`

### Frontend Setup (React + Vite)

1. **Install dependencies and start development server**
   ```bash
   cd apps/web/voice-flow-testing-platform
   npm install
   npm run dev
   ```
   The testing interface will be available at `http://localhost:5174`

## Features

### Voice Flow Agent Platform

1. The voice agent platform presents a user interface that allows the user to **create contacts** of the defaulters that are associated to a **debt** account.
2. It then allows initiating **calls** to **multiple contacts** at the same time. Multiple contacts can be **deleted** at once too.
3. It allows viewing call attempts made to different contacts. Each call attempt has a related **outcome** to it.
4. The conversation **transcripts** are also stored in **S3**, though a system to score it hasn't been implemented.

### Voice Flow Testing Platform

1. The automated testing platform presents a user interface where users can **generate defaulter personas** using AI.
2. Then we can initiate automated testing to **simulate** a conversation between the defaulter and our agent. The **live conversation** is relayed to the user interface from the server.
3. After the conversation, a **validator** analyzes it and gives out the **metrics and feedback** associated with the conversation. The feedback contains any improvements to be made to the agent.
4. Then a **prompt enhancer** takes the feedback from a test run on user request and **stores** an enhanced prompt based on the feedback to a S3 bucket. The new version of the prompt can later be **pinned** to be used across the agent and the testing platform.

## Limitations

### Voice Flow Agent Platform

1. The models used for the agents are chosen based on the providers who offer **free-tier** usage. This constraint might affect the overall quality and end result of the **agent's performance**.
2. **Haven't deployed** any component to cloud - all services run **locally**. Especially, deploying the agent could be done to LiveKit cloud, but having the database locally prevented it since the agent interacts with the DB using tools.
3. Haven't implemented a feature to **record calls** since it requires the **egress** service & **redis** to be configured locally. Configuring these services is just a little time consuming and wasn't on my priority list.
4. There might be a few **inconsistencies** in the user interface design and experience. Priority was given to first implement the required features and enhance for user experience later.

### Voice Flow Testing Platform

1. Simulation of actual **voice interaction** between agent and generated defaulter persona isn't implemented since it isn't necessary for testing the conversational performance of the agent.
2. Currently optimizing for only **two** metrics (politeness and negotiability) at present. Additional performance metrics could be added in the future.
3. Since all the components of the testing system are primarily **LLMs**, the optimization that happens through them might **not** be entirely **reliable**. Hence the prompt versioning and pinning has to be done manually to choose the right prompts.
