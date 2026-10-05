# AI Sprint Room — notes for Claude Code

Context for continuing this project in Claude Code. Owner: David Ferreira Marques (FedEx Portugal, Industrial Engineering, Pickup & Delivery). Repo: `dferreiramarques/ai-sprint-room`, deployed on Railway.

## What it is

A live control room for an **AI-accelerated Design Sprint** (Jake Knapp's 5-day Sprint compressed into 8 hours with Gemini and NotebookLM), for a 13-person IE team: 1 facilitator, 1 decider, 3 squads of 4.

- **How it works** (`/`): explains the method (week → day, day timeline, 5 steps, roles, rules, roadmap, full run-sheet for Day 1 and the +8h extension). Content is generated from `templates.js` via `/api/templates/:key`, so it always matches the agenda the app runs.
- **AI prompts** (`/prompts`): prompt library, collected from the templates' block tools.
- **Run my Sprint!** (`/run`): entry point. Teams enter a sprint code; facilitator opens the console.
- **Facilitator console** (`/f`, `/f/CODE`): PIN login, create/duplicate/delete sprints; tabs Run (push blocks, timer, messages, teams), Brief (problem, initial conditions, KPI, goal, sprint questions, resources, rules), Agenda (block editor).
- **Team view** (`/join/CODE` → `/s/CODE`): lobby, active block with steps and AI prompts (placeholders filled from the brief), shared Time Timer, messages, "done" / "need help".
- **Room screen** (`/screen/CODE`): projector view.

## Decisions agreed with David (keep unless he changes them)

- Teams do **not** fill templates in the app. The app holds the statement and the planned sequence (agenda, active topic, tools, facilitator messages, time). **Results are presented on a Teams call** from one laptop per team.
- Access: **sprint code** (6 chars, letters + digits without I/O/0/1, like a Kahoot PIN) for teams; **`FACILITATOR_PIN`** env var for the facilitator. No user accounts.
- Storage: **one JSON file on a Railway Volume** (`DATA_DIR=/data`), not Postgres.
- One Railway replica only (state and timer are in-process).
- UI language: English. Visual language: whiteboard, sticky-note yellow, red vote dots, Time Timer red disc (Sprint book vocabulary).
- Deliverables must be audited before handing over (filenames, language, format, content match what was discussed).

## Architecture

- `server.js`: Express + Socket.IO. Server is the clock: timer is `{duration, endsAt, remaining, running}`; clients compute remaining time with a server offset (`serverNow`). A 1 s interval emits `timeup`. Every change → `save()` (debounced, atomic tmp+rename) → `broadcast(code)`, which sends each socket a view filtered by role (facilitator sees all messages; a team sees broadcast + its own; screen sees broadcast only).
- `templates.js`: agenda templates `day1`, `ext`, `blank`. Block = `{phase, title, min, steps[], tools[{name, prompt}], output}`. Phases: open, map, sketch, decide, prototype, test, close, break.
- `public/index.html`: shell + nav. `public/app.js`: router and all live views (vanilla JS, no build). `public/content.js`: How it works + AI prompts pages (uses globals from app.js at call time). `public/app.css`: tokens (light/dark) and components.

### Socket events

| Event | From | Payload |
|---|---|---|
| `f:hello` | facilitator | `{token}` → `{list, templates}` |
| `f:create` / `f:duplicate` / `f:delete` | facilitator | `{title, template}` / `{code}` |
| `f:watch` | facilitator | `{code}` → `{sprint}` |
| `f:update` | facilitator | `{code, patch:{title, startTime, brief, agenda}}` |
| `f:control` | facilitator | `{code, action, arg}`: start, next, prev, goto, pause, resume, reset, extend(sec), lobby, close, reopen |
| `f:message` | facilitator | `{code, text, to:'all'|teamId}` |
| `f:team` | facilitator | `{code, teamId, op:'clearHelp'|'remove'}` |
| `t:teams` / `t:join` | team | `{code}` / `{code, teamId?, teamName, member}` |
| `t:status` / `t:message` | team | `{done?, help?}` / `{text}` |
| `screen:watch` | screen | `{code}` |
| server → client | | `sprint`, `list`, `timeup`, `kicked`, `gone` |

Facilitator token = HMAC(SESSION_SECRET, PIN); stored in localStorage `asr:ftoken`. Team id per sprint in `asr:team:CODE`.

## Run and test

```bash
npm install
npm run dev                      # PIN 1234, data in ./data, http://localhost:3000
```

No automated tests yet. Manual end-to-end used during development: Playwright script with one facilitator, two teams (one at 400px width) and the room screen; checked push of blocks, timer sync, messages, help, done, mobile overflow.

## Backlog / ideas (not started)

- Facilitator "sprint report" export (agenda as run, timings, messages, team status) as Markdown/JSON for the Teams call follow-up.
- Pre-sprint problem shortlist and voting inside the app (submit → vote → decider picks), feeding the brief.
- Numeric-only sprint codes (David said current format is fine).
- Planned vs actual time per block (log real start/end when blocks are pushed).
- Optional auto-advance at time-up (today the facilitator stays in control on purpose).
- PT-PT translation toggle.
- Multiple facilitators / co-facilitator role; per-sprint PIN.
- Tests (socket event unit tests; Playwright e2e in CI).
- Scale beyond one replica would need Redis adapter + shared storage; not needed for a 13-person team.

## Related material (outside this repo)

- A Claude Doc in Portuguese with the proposal for management, the facilitator guide and templates T1–T11 ("Accelerate by AI Sprint — Pickup & Delivery").
- An earlier standalone single-file HTML version (`accelerate-by-ai-sprint.html`) with per-sprint templates saved in localStorage and JSON export/import; superseded by this app for live sessions.
