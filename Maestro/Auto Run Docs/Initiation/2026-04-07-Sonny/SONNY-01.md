# Phase 01: Foundation + Voice Capture with Turn Logging

Sonny (S.O.N.N.Y) is a local-first AI voice system that turns conversations into searchable, structured knowledge. This phase establishes the full project foundation — a React + Vite frontend with the Gemini Live voice agent, a Python FastAPI backend with turn logging, and a live transcript display. By the end, you'll have a working voice assistant that captures every turn of conversation as structured JSONL data, with a real-time transcript visible in the UI.

## Context

- **Project directory:** `/home/barryharris/ai-projects/Sonny/`
- **Existing voice template:** `voice-agent-template/VoiceAgent.tsx` and `voice-agent-template/audio-utils.ts` — a complete React component for Gemini Live voice streaming. Study these files before building; reuse the patterns and code directly.
- **System design doc:** `sunny_system_design.md` — the full project vision. Reference it for architecture decisions.
- **Obsidian vault (for later phases):** `/home/barryharris/Documents/SonnyVault`
- **Gemini model:** `gemini-3.1-flash-live-preview` (already configured in the template)
- **Ollama is running locally** (used in later phases, not this one)

## Tasks

- [x] Initialize project structure and all dependency/configuration files. The project lives at `/home/barryharris/ai-projects/Sonny/`. Create this structure:
  - `frontend/` — Vite + React + TypeScript app. Run `npm create vite@latest frontend -- --template react-ts` from the project root (or scaffold manually). Install dependencies: `@google/genai`, `lucide-react`, `motion` (Framer Motion v12+), plus Tailwind CSS v4 (use the Vite plugin approach: `@tailwindcss/vite`). **Note: Framer Motion v12+ is imported as `motion/react`, not `framer-motion`.**
  - `backend/` — Python FastAPI backend. Create `backend/requirements.txt` with: `fastapi`, `uvicorn[standard]`, `python-dotenv`. Create a Python virtual environment at `backend/.venv` and install the requirements.
  - `data/sessions/` — directory for JSONL turn logs (create it empty with a `.gitkeep`)
  - `frontend/.env.example` with `VITE_GEMINI_API_KEY=your-gemini-api-key-here`
  - Copy `.env.example` to `frontend/.env` so the app can start (the user will add their real key)
  - Configure Vite (`vite.config.ts`) to proxy `/api` requests to `http://localhost:8000` so the frontend can reach the backend in dev mode
  - Set up Tailwind CSS with a dark color scheme as default. Use clean, modern dark theme variables.
  - Do NOT modify or delete `voice-agent-template/` or `sunny_system_design.md` — those are reference files

- [x] Create the Python FastAPI backend with turn logging API. All backend code goes in `backend/`. Read the turn format from `sunny_system_design.md` to understand the expected JSONL structure. Build:
  - `backend/main.py` — FastAPI app with CORS middleware (allow all origins for local dev) and these endpoints:
    - `GET /api/health` — returns `{"status": "ok"}`
    - `POST /api/sessions` — creates a new session. Accepts optional `{"name": "..."}`. Generates a session ID in the format `YYYY-MM-DD-HHmmss` (from current timestamp). Creates the JSONL file at `data/sessions/{session_id}.jsonl`. Returns `{"session_id": "...", "created_at": "..."}`
    - `POST /api/sessions/{session_id}/turns` — appends a turn to the session's JSONL file. Accepts: `{"speaker": "user"|"assistant", "text": "...", "turn_id": int}`. Adds timestamp automatically. Returns the complete turn object.
    - `GET /api/sessions` — lists all sessions (reads filenames from `data/sessions/`, returns sorted by date descending)
    - `GET /api/sessions/{session_id}` — returns all turns for a session (reads and parses the JSONL file)
  - The `data/sessions/` path should be resolved relative to the project root (one level up from `backend/`), using a config constant
  - Include proper error handling (404 for missing sessions, etc.)

- [x] Port the voice agent into the frontend and enhance it with transcript capture. Read the existing `voice-agent-template/VoiceAgent.tsx` and `voice-agent-template/audio-utils.ts` carefully — reuse as much code as possible. Create these files in `frontend/src/`:
  - `lib/audio-utils.ts` — copy directly from `voice-agent-template/audio-utils.ts`
  - `components/VoiceAgent.tsx` — adapted from the template with these changes:
    - Extract the Gemini session config to enable transcript capture. Add `inputAudioTranscription` to the live connect config if supported by the SDK, so user speech is transcribed by Gemini. Also keep `Modality.AUDIO` for responses but check if the server messages include text parts alongside audio — if they do, capture the text for logging.
    - Accept callback props: `onTurnComplete: (speaker: 'user' | 'assistant', text: string) => void` and `onSessionStart: () => void` and `onSessionEnd: () => void`
    - When the model sends a complete turn (check for `turnComplete` in server messages), call `onTurnComplete('assistant', collectedText)` with the accumulated text
    - For user turns, if input transcription is available in the server messages, call `onTurnComplete('user', transcribedText)`
    - Keep all the existing audio playback, mute, error handling, and animation logic from the template
    - Update the system instruction to: "You are Sonny, a friendly and helpful voice assistant. You have natural conversations and help the user think through ideas, answer questions, and explore topics. Be concise but warm."
  - If the Gemini SDK does not support `inputAudioTranscription` in the live config, use a fallback approach: use the browser's `webkitSpeechRecognition` / `SpeechRecognition` API to capture user speech text in parallel, or simply log user turns as "[audio]" with a note that transcription will be added in a later phase. Do NOT let this block the prototype — audio capture and assistant text capture are the priority.

- [x] Create the main application layout and transcript panel. Build the full-page UI in `frontend/src/`:
  - `components/TranscriptPanel.tsx` — displays the live conversation transcript:
    - Shows each turn with speaker label (User / Sonny) and text
    - Auto-scrolls to the latest message
    - Styled as a clean chat-style display with dark theme colors
    - Shows session ID and start time at the top
    - Empty state message when no conversation has started
  - `App.tsx` — main application layout:
    - Full-screen dark background
    - App title/header ("Sonny" with a subtle tagline)
    - TranscriptPanel as the main content area (centered, max-width for readability)
    - VoiceAgent component positioned as a floating control (bottom-right, as in the template)
    - Wire the VoiceAgent callbacks:
      - `onSessionStart`: call `POST /api/sessions` to create a new session, store the session_id in state
      - `onTurnComplete`: call `POST /api/sessions/{id}/turns` to log the turn, and add it to the local transcript state for display
      - `onSessionEnd`: clear session state
    - Create a small API helper (`lib/api.ts`) with functions: `createSession()`, `logTurn(sessionId, turn)`, `listSessions()`, `getSession(sessionId)` — simple fetch wrappers calling the `/api/` endpoints
  - `index.css` — Tailwind base styles with dark theme defaults (dark background, light text)
  - Update `main.tsx` to render App

- [ ] Create a startup script and verify the full system works end-to-end:
  - Create `start.sh` at the project root that:
    - Starts the FastAPI backend: `cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000 &`
    - Starts the Vite dev server: `cd frontend && npm run dev &`
    - Prints a message: "Sonny is running at http://localhost:5173"
    - Make it executable with `chmod +x`
  - Verify the backend starts correctly by running it and hitting the health endpoint with curl
  - Verify the frontend builds/starts without errors by running `npm run dev` (check for TypeScript or build errors and fix any that appear)
  - Test the turn logging flow by using curl to: create a session, post a turn, retrieve the session — verify the JSONL file is created and contains the correct data
  - If any errors are found during verification, fix them before marking this task complete
  - Stop any background dev servers you started for testing
