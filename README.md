# AI Sprint Room

A live control room for an **AI-accelerated Design Sprint**: Jake Knapp's 5-day Sprint compressed into 8 hours, using Gemini and NotebookLM. Built for a team of about 13 people: 1 facilitator, 1 decider, 3 squads of 4.

The room keeps everyone on the same page: same problem statement, same block, same clock. It does **not** collect work. Teams work on their own tools and present results on a Teams call.

## Start here

| You are… | Read |
|---|---|
| A team member joining a sprint | [Team guide](docs/team-guide.md) |
| The facilitator running one | [Facilitator guide](docs/facilitator-guide.md) |
| Asking "is this safe, will it hold up?" | [Data, security and reliability](docs/data-and-reliability.md) |
| Continuing development | [CLAUDE.md](CLAUDE.md) and the sections below |

The in-app **How it works** page (`/`) explains the method and shows the run-sheet. It is generated from `templates.js`, so it always matches the agenda the app runs.

## What it does

- **Facilitator** creates a sprint, writes the brief (problem, initial conditions, KPI, goal, sprint questions, resources, rules) and edits the agenda.
- **Teams** enter a 6-character sprint code and see the brief, the agenda, the active block with its steps and AI prompts (placeholders filled from the brief), a shared timer and facilitator messages. They can mark a block "done", ask for help, and message the facilitator.
- **Facilitator controls** the pace: push a block (timer starts for everyone), pause, resume, reset, add or remove time, go back, return to the lobby, close the sprint, message everyone or one team.
- **Room screen** (`/screen/CODE`) for the projector: join code in the lobby, then the active block and a large Time Timer.

## What it deliberately does not do

- No templates or deliverables inside the app. Results are presented on the Teams call.
- No user accounts. Teams use a sprint code; the facilitator uses a PIN.
- No auto-advance when time is up. The timer rings; the facilitator decides what happens next.

## Run locally

```bash
npm install
npm run dev          # FACILITATOR_PIN=1234, data in ./data, http://localhost:3000
```

Facilitator console: http://localhost:3000/f (PIN `1234`). Teams: http://localhost:3000.

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `FACILITATOR_PIN` | yes | PIN for the facilitator console. Without it, facilitator login is disabled. |
| `SESSION_SECRET` | strongly recommended | Long random string used to sign facilitator sessions (they expire after 12 h). Changing it logs facilitators out. |
| `DATA_DIR` | on Railway: `/data` | Folder for `sprints.json`. Falls back to `RAILWAY_VOLUME_MOUNT_PATH`, then `./data`. |
| `RETENTION_DAYS` | no | Sprints idle this many days are archived automatically (hidden from teams, still in the console). Default 90; `0` turns it off. |
| `PORT` | no | Defaults to 3000 (Railway sets it). |

## Deploy on Railway

1. **New Project → Deploy from GitHub repo** and pick this repository.
2. Set the variables above (`FACILITATOR_PIN`, `SESSION_SECRET`, `DATA_DIR=/data`).
3. **Attach a Volume** to the service with mount path `/data`. Without it every deploy wipes the sprints.
4. **Networking → Generate Domain**. Share `https://<your-domain>/join/CODE` with the teams.
5. Check `https://<your-domain>/health`: it should return `{"ok":true}`.

Keep **one replica**. State and the timer live in one process (`railway.json` already sets `numReplicas: 1`).

## Privacy and security in short

- The projector screen gets **no brief and no participant names**. A team sees member names of its own team only.
- Wrong sprint codes and wrong PINs are rate limited; facilitator sessions expire after 12 hours; cross-site connections are refused; a strict Content-Security-Policy is set.
- Sprints idle for `RETENTION_DAYS` (default 90) are archived: their code stops working and they are listed only in the facilitator console, where they can be restored. Nothing is deleted automatically.
- The sprint code is still the only credential for teams: share it only with participants and keep briefs anonymised. Details and limits: [Data, security and reliability](docs/data-and-reliability.md).

## Routes

| Path | Who |
|---|---|
| `/` | How it works: method, timeline, roles, run-sheet |
| `/prompts` | AI prompt library |
| `/run` | Run my Sprint!: enter a sprint code or open the console |
| `/join/CODE` | Pick or create a team |
| `/s/CODE` | Team view |
| `/f`, `/f/CODE` | Facilitator dashboard and console (PIN) |
| `/screen/CODE` | Projector view |
| `/health` | Health check |

## Project layout

| File | Role |
|---|---|
| `server.js` | Express + Socket.IO, storage, timer logic, per-role views |
| `templates.js` | Agenda templates (`day1`, `ext`, `blank`) and the AI prompts they reference |
| `public/app.js` | Router and live views (vanilla JS, no build step) |
| `public/content.js` | How it works and AI prompts pages |
| `public/app.css` | Design tokens (light and dark) and components |

To change the agenda or prompts for every new sprint, edit `templates.js`. To change one sprint only, use the **Agenda** tab in the console.

## Status

No automated tests yet. The flow was checked end to end with a Playwright script (facilitator, two teams, one at 400 px width, and the room screen): block push, timer sync, messages, help, done, mobile overflow. Ideas and backlog are in [CLAUDE.md](CLAUDE.md).
