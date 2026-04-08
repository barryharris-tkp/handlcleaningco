# Phase 02: Background Memory Worker — Ollama Processing + Obsidian Notes

This phase builds the brain of Sonny — a background memory worker that processes completed conversation sessions using the local Ollama LLM (`qwen3:4b`). It cleans raw transcripts, generates summaries with key points and tags, and writes structured Obsidian Markdown notes to the vault. After this phase, every conversation with Sonny automatically becomes a searchable knowledge note.

## Context

- **Project directory:** `/home/barryharris/ai-projects/Sonny/`
- **Backend:** `backend/` — FastAPI app from Phase 01 with turn logging
- **Session data:** `data/sessions/*.jsonl` — JSONL files with conversation turns
- **Obsidian vault:** `/home/barryharris/Documents/SonnyVault` — this directory already exists
- **Ollama model:** `qwen3:4b` (already running locally via Ollama)
- **Design doc:** `sunny_system_design.md` — see the Obsidian note format and memory worker sections

## Tasks

- [x] Add Ollama and memory worker dependencies to the backend. Update `backend/requirements.txt` to add: `ollama`, `watchdog` (for file watching). Install them into the existing virtual environment at `backend/.venv`. Verify Ollama connectivity by running a quick Python test that imports `ollama` and calls `ollama.chat(model='qwen3:4b', messages=[{"role": "user", "content": "Say hello"}])` — confirm it returns a response.
  - *(Completed: `ollama` and `watchdog` added to requirements.txt, installed into `.venv`, Ollama connectivity verified — qwen3:4b responded successfully.)*

- [x] Create the transcript processing service. Build `backend/services/transcript_processor.py`:
  - `load_session(session_id: str) -> list[dict]` — reads a JSONL session file, returns list of turn dicts
  - `format_transcript(turns: list[dict]) -> str` — formats turns into a readable transcript string (e.g., "User: ...\nSonny: ...\n")
  - `clean_transcript(raw_transcript: str) -> str` — calls Ollama `qwen3:4b` to clean up speech artifacts (filler words, false starts, repetitions) while preserving meaning. Use a focused prompt that instructs the model to clean without changing meaning or adding information.
  - `summarize_session(clean_transcript: str) -> dict` — calls Ollama `qwen3:4b` to generate a structured summary. The prompt should request JSON output with fields: `title` (short descriptive title), `summary` (2-3 sentence overview), `key_points` (list of important points), `decisions` (list of any decisions made), `next_steps` (list of action items if any), `tags` (list of relevant topic tags). Parse the JSON from the model response. Include retry logic if the model returns invalid JSON (up to 2 retries).
  - Create prompt templates in `backend/prompts/` as plain text files: `clean_transcript.txt` and `summarize_session.txt`. Load them at runtime. This keeps prompts editable without code changes.
  - *(Completed: transcript_processor.py created with all 4 functions. Prompt templates created in backend/prompts/. 11 unit tests pass covering load, format, clean, summarize, retry logic, and markdown fence stripping.)*

- [x] Create the Obsidian note writer service. Build `backend/services/note_writer.py`:
  - `write_note(session_id: str, summary: dict, clean_transcript: str) -> str` — writes a structured Markdown note to the Obsidian vault at `/home/barryharris/Documents/SonnyVault/`
  - Note filename format: `{session_id}.md` (e.g., `2026-04-07-201021.md`)
  - Note format must match the design doc. Use YAML frontmatter:
    ```yaml
    ---
    type: sonny-memory
    created: YYYY-MM-DD
    session_id: {session_id}
    topic: {title from summary}
    tags: [sonny, {tags from summary}]
    ---
    ```
  - Note body sections: `# {title}`, `## Summary`, `## Key Points` (bulleted list), `## Decisions` (bulleted list, or "None noted" if empty), `## Next Steps` (bulleted list, or "None noted" if empty), `## Full Transcript` (the cleaned transcript in a collapsible details block or as plain text)
  - Create the vault directory if it doesn't exist
  - Return the path to the created note file
  - *(Completed: note_writer.py created with write_note function. Outputs structured Obsidian notes with YAML frontmatter, all required sections, and collapsible transcript. 10 unit tests pass covering file creation, frontmatter, body sections, tag ordering, empty lists, vault directory creation, and edge cases.)*

- [ ] Build the memory worker as a background process. Create `backend/services/memory_worker.py`:
  - The worker watches `data/sessions/` for completed sessions
  - Track processing state using a simple JSON file: `data/sessions/.processing_state.json` — maps session_id to status (`pending`, `processing`, `completed`, `error`)
  - On startup, scan for any unprocessed sessions (session files that aren't in the state file or are marked `pending`)
  - Processing pipeline for each session:
    1. Mark as `processing`
    2. Load the session turns
    3. Format into transcript
    4. Clean the transcript via Ollama
    5. Summarize via Ollama
    6. Write Obsidian note
    7. Mark as `completed` (or `error` with message if something fails)
  - Use `watchdog` to watch for new/modified JSONL files and trigger processing
  - Add a configurable delay before processing a session (default 30 seconds after last modification) to avoid processing mid-conversation
  - Log all operations clearly to stdout for debugging
  - Create `backend/worker.py` as the entry point that runs the memory worker as a standalone process

- [ ] Add memory worker API endpoints and update the startup script:
  - Add to `backend/main.py`:
    - `GET /api/sessions/{session_id}/status` — returns the processing status from the state file
    - `POST /api/sessions/{session_id}/process` — manually triggers processing for a session (useful for testing and re-processing)
    - `GET /api/notes` — lists all generated Obsidian notes (reads the vault directory)
    - `GET /api/notes/{session_id}` — returns the content of a specific note
  - Update `start.sh` to also launch the memory worker: `cd backend && source .venv/bin/activate && python worker.py &`
  - Test the full pipeline: use curl to create a session, add several turns of realistic conversation, then trigger processing. Verify that:
    - The processing state updates correctly
    - An Obsidian note is created in `/home/barryharris/Documents/SonnyVault/`
    - The note has correct YAML frontmatter and structured content
    - The summary is coherent and tags are relevant
  - Fix any issues found during testing
