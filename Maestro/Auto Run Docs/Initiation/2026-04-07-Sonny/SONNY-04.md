# Phase 04: Contextual Intelligence + Session Management

This is the Intelligence phase — Sonny becomes aware of its own memory. Past conversation knowledge is injected into live Gemini sessions so Sonny can reference things you've discussed before. The frontend gains a session history browser, conversation naming, and a settings panel. By the end of this phase, Sonny is a complete voice-to-knowledge loop: talk, capture, remember, recall.

## Context

- **Project directory:** `/home/barryharris/ai-projects/Sonny/`
- **Backend:** `backend/` — FastAPI app with turn logging, memory worker, and ChromaDB search from Phases 01-03
- **Frontend:** `frontend/` — React + Vite app with VoiceAgent, TranscriptPanel, and SearchPanel
- **Obsidian vault:** `/home/barryharris/Documents/SonnyVault`
- **Vector store:** `data/chroma/` — ChromaDB with embedded session summaries
- **Gemini model:** `gemini-3.1-flash-live-preview`
- **Ollama model:** `qwen3:4b`
- **Design doc:** `sunny_system_design.md`

## Tasks

- [x] Build the context retrieval service for live conversations. Create `backend/services/context_builder.py` — read the existing vector store service (`backend/services/vector_store.py`) to understand the search interface:
  - `build_context(query: str, max_tokens: int = 800) -> str` — searches ChromaDB for the most relevant past sessions and formats them into a context string for injection into the Gemini system prompt
  - The context string should be concise and structured:
    ```
    ## Relevant Past Conversations
    
    **{topic}** ({date}): {summary}
    Key points: {bullet points}
    
    **{topic}** ({date}): {summary}
    Key points: {bullet points}
    ```
  - Limit to top 3 results with a relevance score threshold (skip results below 0.3 similarity)
  - Truncate the total context to stay within `max_tokens` (rough estimate: 4 chars per token)
  - Add API endpoint `POST /api/context` in `backend/main.py` — accepts `{"query": "..."}`, returns `{"context": "...", "sources": [...]}`. The frontend will call this before starting a Gemini session or periodically during conversation to refresh context.

- [x] Add context injection to the voice agent. Modify `frontend/src/components/VoiceAgent.tsx` — read the current implementation first to understand the session lifecycle:
  - Before connecting to Gemini, call `POST /api/context` with a general query (e.g., the current date + "conversation") to fetch any relevant recent context
  - Inject the retrieved context into the Gemini system instruction. Update the system prompt template to:
    ```
    You are Sonny, a friendly and helpful voice assistant. You have natural conversations and help the user think through ideas, answer questions, and explore topics. Be concise but warm.
    
    {retrieved_context}
    
    Use the past conversation context naturally — reference it when relevant but don't force it. If the user asks about something you've discussed before, draw on that knowledge.
    ```
  - Add `lib/api.ts` function: `getContext(query: string)` — calls the context endpoint
  - If context retrieval fails (network error, backend down), proceed without context — do not block the voice session from starting
  - During an active session, after every 3-4 user turns, refresh context by sending the most recent user message as a query. Update the local context state (this won't change the active Gemini session's system prompt, but store it for display or for the next reconnection).
  - **Completed 2026-04-08**: Added `getContext()` to `lib/api.ts`, `buildSystemInstruction()` helper with context template, pre-session context fetch with graceful failure, periodic refresh every 3 user turns, localStorage support for API key (`sonny-gemini-key`), voice (`sonny-voice`), and custom system prompt (`sonny-system-prompt`).

- [x] Build the session history browser. Create `frontend/src/components/SessionHistory.tsx` — read the existing `SearchPanel.tsx` and `App.tsx` to match the established UI patterns:
  - Displays a chronological list of past sessions from `GET /api/sessions`
  - Each session entry shows: session ID (formatted as a readable date/time), processing status badge (pending/processing/completed), number of turns
  - Clicking a session loads its full transcript from `GET /api/sessions/{id}` and displays it in a read-only transcript view (reuse the TranscriptPanel styling)
  - If a note exists for the session, show a link/button to view the generated summary (fetch from `GET /api/notes/{session_id}`)
  - Add a "Process Now" button for unprocessed sessions that calls `POST /api/sessions/{session_id}/process`
  - Update `App.tsx` navigation to add a third tab: "Conversation" | "Memory" | "History"
  - **Completed 2026-04-08**: Created `SessionHistory.tsx` with chronological session list, status badges, turn counts, expandable transcript viewer (reuses TranscriptPanel bubble styling), "Process Now" for unprocessed sessions, "View Note" for completed sessions. Updated `App.tsx` with third "History" tab. Updated backend `GET /api/sessions` to return `turn_count` and `status` per session. Added `getSessionDetail()`, `getSessionStatus()`, `processSession()`, `getNote()` to `lib/api.ts`.

- [x] Add session naming and management features:
  - Backend — update `backend/main.py` (read it first):
    - `PATCH /api/sessions/{session_id}` — updates session metadata. For now, supports renaming: accepts `{"name": "..."}`. Store session metadata in a `data/sessions/.metadata.json` file (maps session_id to metadata dict with `name`, `created_at`, etc.)
    - `DELETE /api/sessions/{session_id}` — deletes a session's JSONL file, removes from metadata, removes from processing state, removes ChromaDB embedding, and deletes the Obsidian note if it exists. Return what was deleted.
    - Update `GET /api/sessions` to include the session name from metadata if available
  - Frontend — update `SessionHistory.tsx`:
    - Add inline rename: click the session name to edit it, save on blur or Enter
    - Add delete button with a confirmation prompt (simple `window.confirm`)
    - Add `lib/api.ts` functions: `renameSession(id, name)`, `deleteSession(id)`
  - Frontend — update `App.tsx`:
    - After a voice session ends, if the session had more than 2 turns, show a subtle prompt asking the user to name the session (auto-dismiss after 10 seconds, use a default name like the date/time if dismissed)
  - **Completed 2026-04-08**: Added metadata persistence via `.metadata.json`, `PATCH /api/sessions/{id}` for rename, `DELETE /api/sessions/{id}` with full cleanup (JSONL, metadata, processing state, ChromaDB, Obsidian note). Updated `GET /api/sessions` to return session names. Added `renameSession()` and `deleteSession()` to `lib/api.ts`. Updated `SessionHistory.tsx` with pencil icon for inline rename (input on click, save on blur/Enter, cancel on Escape) and trash icon with `window.confirm` for delete. Updated `App.tsx` with post-session naming prompt (shows for sessions >2 turns, auto-dismisses after 10s with date/time default).

- [ ] Create a settings panel for configuration. Create `frontend/src/components/SettingsPanel.tsx` — read existing components to match patterns:
  - Display as a slide-out panel or modal (accessible from a gear icon in the header)
  - Settings to expose:
    - **Gemini API Key**: text input (masked), saved to localStorage. Update the VoiceAgent to read the API key from localStorage first, falling back to `import.meta.env.VITE_GEMINI_API_KEY`
    - **Voice**: dropdown to select Gemini voice (options: Zephyr, Puck, Charon, Kore, Fenrir, Leda, Orus, Pegasus). Saved to localStorage, passed to VoiceAgent
    - **System prompt**: textarea showing the current system instruction, editable. Saved to localStorage.
    - **Backend status**: show health check result from `GET /api/health`, memory worker status, ChromaDB stats from `GET /api/search/stats`
    - **Vault path**: display only (shows the configured Obsidian vault path from a new `GET /api/config` endpoint)
  - Add `GET /api/config` endpoint to `backend/main.py` returning: vault path, sessions path, chroma path, Ollama model name
  - Update `App.tsx` to include the settings gear icon in the header and render the SettingsPanel

- [ ] Final integration testing and startup script update:
  - Update `start.sh` to print a cleaner startup banner showing all services and their ports
  - Start the full system (backend + worker + frontend)
  - Test the complete voice-to-knowledge loop:
    1. Open the app, configure the API key in settings if needed
    2. Start a voice conversation — verify Gemini connects and audio works
    3. Have a multi-turn conversation, verify turns appear in the transcript
    4. End the session — verify JSONL is saved
    5. Wait for or trigger memory processing — verify Obsidian note is created
    6. Open the Memory tab — search for the conversation topic, verify it appears
    7. Open the History tab — verify the session appears with correct status
    8. Start a NEW conversation about a related topic — verify context from the previous conversation is available (check the system prompt includes relevant context)
    9. Test session rename and delete from the History tab
    10. Check the Settings panel shows correct status for all services
  - Fix any issues found. Pay special attention to:
    - Race conditions between the frontend posting turns and the memory worker picking up sessions
    - Error states when Ollama is slow to respond
    - Frontend state management when switching between tabs during an active voice session
  - Stop any background servers started for testing
