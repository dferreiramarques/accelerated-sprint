# Data, security and reliability

What the app stores, who can see it, how it protects the brief and the participants, and how it behaves when things go wrong. Written from the code, so each statement can be checked in `server.js`.

## What is stored

One JSON file on the server: `$DATA_DIR/sprints.json` (written with owner-only permissions). For each sprint:

- Title, start time, status
- Brief (problem, context, KPI, goal, sprint questions, resources, rules)
- Agenda (blocks, steps, AI prompts)
- Timer state and the active block
- Teams: name, colour, member names as typed, "done" per block, help flag
- Messages (last 400)

No passwords, accounts, emails, analytics or cookies. Browsers keep two small items in localStorage: the facilitator session token and "which team am I" per sprint code.

**Participant names are optional and should be first names or initials.** Teams can join without giving a name.

**Brief content:** use anonymised data only. The file is not encrypted by the app; it relies on the hosting platform's volume.

## Who can see what

| Role | Access | Sees |
|---|---|---|
| Team | Sprint code | Brief, agenda and AI prompts, state, broadcast messages, messages to its own team and its own messages, **all team names, member names of its own team only** |
| Room screen (projector) | Sprint code | Title, agenda block titles and steps, timer, team names, "done" ticks, broadcast facilitator messages. **No brief, no AI prompts, no member names** |
| Facilitator | PIN | Everything, and can create, edit, duplicate, delete |

All filtering happens on the server, before data is sent. Editing the page in a browser cannot reveal another team's names or messages, and every facilitator action is checked on the server.

The projector shows a room full of people whatever is on it, which is why it never receives the brief or participant names.

## Protections in place

| Risk | Protection |
|---|---|
| Guessing sprint codes | Codes are 6 random characters from a 32-symbol alphabet (about a billion combinations). After 15 wrong codes in 10 minutes, that client address is locked out for 15 minutes |
| Guessing the facilitator PIN | After 5 wrong PINs in 15 minutes, that address is locked out for 15 minutes (the correct PIN is refused during the lock) |
| Stolen facilitator session | Sessions expire after 12 hours and are signed with `SESSION_SECRET`. Changing the secret or the PIN logs everyone out |
| A web page on another site talking to the room | Cross-site WebSocket connections are refused (the origin must match the host) |
| Script injection | Content-Security-Policy allows scripts only from the app itself; all user text is escaped before display |
| Embedding or indexing | The site cannot be framed, sets `noindex`, and serves `robots.txt` with `Disallow: /` |
| Flooding | More than 60 messages in 10 seconds disconnects that client; request bodies are capped at 20 KB, socket messages at 100 KB; text fields are length-capped |
| Data lingering after the sprint | Sprints idle for `RETENTION_DAYS` (default 90) are archived automatically: the code stops working for teams and the projector, and the sprint is listed only in the facilitator console, where it can be restored or deleted. The facilitator can also archive or delete any sprint at any time. Nothing is deleted automatically; set `RETENTION_DAYS=0` to turn archiving off |
| Leaking through the health check | `/health` returns only `{"ok":true}` |

## Honest limits

- **The sprint code is still the only credential for teams.** Share it only with participants, like a meeting link. Anyone who has it can read the brief and the agenda and can join as a team.
- **Rate limits are per client address and kept in memory.** They reset when the server restarts, and people behind one office network share a budget (15 wrong codes is plenty for honest typos).
- **Archived data is still stored.** Archiving hides a sprint; only **Delete** removes it from the server.
- **No audit log** of who did what, and **no backups**: the data is one file on a Railway Volume. Copy the brief elsewhere if it matters.
- **The file is not encrypted by the app.** Anyone with access to the Railway project can read it.
- **One PIN** for all facilitators; no per-person accounts.

This is a reasonable level for a 13-person internal team and a short-lived working session. It is not suitable for secrets, personal data or a public audience.

## Reliability

**The server is the clock.** The timer is stored as an absolute end time. Browsers only display the difference using the server's time, so a slow laptop clock or a refresh cannot change the countdown.

**Restarts.** Every change is saved within about 250 ms by writing a temporary file and renaming it, so the file is never half-written. On shutdown the server writes once more. After a restart it reloads sprints and the running timer continues from its stored end time. Browsers reconnect on their own. A hard crash can lose at most the last fraction of a second of changes. Rate-limit counters and online status reset.

**Disconnections.** A team that drops offline shows as offline for the facilitator and catches up on reconnect. Its "done" marks and messages are kept.

**Validation.** Minutes are limited to 1–600, agenda to 60 blocks, teams to 30, members to 12 per team.

**Single replica.** Presence and the one-second timer tick live in one process. Running two replicas would split state. `railway.json` pins one.

**Health check.** `GET /health` is used by Railway to restart on failure.

## What has and has not been tested

- Server-side protections are checked with a socket script: role-filtered views (team, projector, facilitator), forged and garbage tokens, code and PIN lockouts, cross-origin handshake, security headers. The facilitator console loads with no CSP errors.
- Earlier flow check with Playwright: one facilitator, two teams (one at 400 px width), room screen.
- **Not covered:** automated tests in the repo, load testing beyond a handful of clients, and a failover rehearsal. Do a dry run with a few colleagues the day before, including a refresh and a restart, before a sprint that matters.
