# AI Sprint Room

Live control room for an AI-accelerated Design Sprint (Jake Knapp's Sprint, compressed to 8 hours with Gemini and NotebookLM).

- **Facilitator** creates a sprint, writes the brief (problem, initial conditions, KPI, goal, sprint questions) and edits the agenda.
- **Teams** join a lobby with a 6-letter code. They see the brief, the agenda, the active block with its steps and AI prompts, and a shared timer.
- The facilitator **pushes** the next block (the timer starts for everyone), pauses or extends time, and sends messages to everyone or to one team.
- Teams can mark a block as done, ask for help, and message the facilitator.
- **Room screen** (`/screen/CODE`) shows the join code in the lobby, then the active block and a big Time Timer for the projector.
- Each team presents its results on the call; this app does not collect deliverables.

Developer notes for continuing the project are in `CLAUDE.md`.

Agenda templates: *Day 1 · 8h sprint*, *Extension · +8h*, *Blank*. Edit them in `templates.js`.

## Run locally

```bash
npm install
npm run dev          # FACILITATOR_PIN=1234, data in ./data
```

Open http://localhost:3000/f for the facilitator console and http://localhost:3000 to join as a team.

## Deploy on Railway

1. **New Project → Deploy from GitHub repo** and pick this repository.
2. **Variables**:
   - `FACILITATOR_PIN`: the PIN facilitators use to log in (required).
   - `SESSION_SECRET`: any long random string (recommended; changing it logs facilitators out).
   - `DATA_DIR=/data`
3. **Volume**: right-click the service → *Attach Volume* → mount path `/data`. Without a volume every deploy wipes the sprints.
4. **Networking → Generate Domain**. Share `https://<your-domain>/join/CODE` with the teams.

Keep **one replica**: state and the timer live in one process and are saved to `/data/sprints.json`.

## Data

Everything is stored in one JSON file (`$DATA_DIR/sprints.json`), written atomically on every change. Use anonymised data in briefs: anyone with a sprint code can read that sprint's brief and agenda.

## Routes

| Path | Who |
|---|---|
| `/` | How it works: method, timeline, roles, run-sheet |
| `/prompts` | AI prompt library |
| `/run` | Run my Sprint!: enter a sprint code or open the console |
| `/join/CODE` | Pick or create a team |
| `/s/CODE` | Team view |
| `/f` | Facilitator dashboard (PIN) |
| `/f/CODE` | Facilitator console: Run, Brief, Agenda |
| `/screen/CODE` | Projector view |
| `/health` | Health check |
