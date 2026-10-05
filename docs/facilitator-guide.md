# Facilitator guide

How to prepare, run and close a sprint in the room.

## Before the day

1. Open `/f` and log in with the facilitator PIN.
2. **Create sprint**: choose a title and a template (*Day 1 · 8h sprint*, *Extension · +8h*, or *Blank*). Use **Duplicate** to reuse a sprint you already tuned.
3. **Brief** tab: fill in the problem, initial conditions, KPI, goal, three sprint questions, resources and rules. The AI prompts in the agenda pull `[PROBLEM]`, `[KPI]`, `[GOAL]` and `[QUESTIONS]` from here, so an empty brief means prompts with empty gaps.
4. **Agenda** tab: adjust blocks (title, minutes, steps, tools, expected output, phase). Changes reach teams immediately; if you edit the active block, it stays active.
5. Set the start time and share `https://<site>/join/CODE` with participants.

Use anonymised data in the brief. Anyone with the code can read it. The projector never shows the brief or participant names, so it is safe to leave on screen.

Ask participants for first names or initials only.

### Checklist, 15 minutes before

- [ ] `/health` returns `{"ok":true}`
- [ ] `SESSION_SECRET` is set on Railway and the PIN is not guessable (5 wrong tries lock you out for 15 minutes)
- [ ] Brief complete, agenda reviewed against the time you have
- [ ] Room screen open on the projector: `/screen/CODE`
- [ ] You joined as a team yourself on a phone or second tab, to see what teams see
- [ ] Sound on in the room (beeps signal new blocks, messages and time up)
- [ ] Teams call link ready for the presentations

## Running the day

The **Run** tab is your cockpit.

| Action | Effect |
|---|---|
| **Start sprint / Next block / Previous / click a block in the agenda** | Pushes that block to every screen and starts its timer. Resets "help" flags |
| **Pause / Resume** | Freezes and restarts the clock for everyone |
| **−1′ / +1′ / +5′** | Adds or removes time on the current block |
| **Reset** | Puts the block back to its full duration, paused |
| **Back to lobby** | Sends everyone back to the lobby and clears the active block |
| **Close sprint** | Ends the sprint and stops the clock. New teams cannot join; **Reopen** reverses it |
| **Message** | To everyone (banner and beep) or to one team |

The team list shows online or offline, "done" per block, and a **help** flag you can clear once handled. You hear a beep when a team messages you.

When the timer reaches zero, everyone gets a banner and a beep. **Nothing advances on its own.** You choose: extend, push the next block, or pause for discussion.

## Closing

1. Run the last block (*Team presentations and decision*): teams present on the Teams call, the decider decides.
2. **Close sprint**.
3. Capture what you need elsewhere: the app does not export a report yet (it is on the backlog).
4. **Delete** the sprint when you no longer need it, which removes its data from the server. **Archive** hides it instead: its code stops working for teams and the projector, and it moves to the *Archived* list in your console, where you can **Restore** it. Sprints idle for 90 days are archived automatically; nothing is deleted automatically.

## If something goes wrong

| Symptom | What to do |
|---|---|
| One team's screen is stale | Ask them to refresh. Team and current block are restored |
| Console says "Session expired" | Sessions last 12 hours. Log in again with the PIN |
| "Too many attempts" | Too many wrong PINs or sprint codes from that network. Wait 15 minutes, or restart the service on Railway to clear it |
| Whole site unreachable | Carry on from the run-sheet on the **How it works** page, printed or on another device, and keep time on your phone. Teams keep their own copy of the agenda and prompts open if they loaded them already |
| Server restarted mid-sprint | State and timer are saved on disk; reload the page. See [Data, security and reliability](data-and-reliability.md) |
| Timer looks off on a device | Refresh that device; the clock is the server's, not the browser's |
| A team joined with the wrong name | Remove the team in the console (**Remove**, then confirm) and ask them to join again |

## Limits worth knowing

- Up to 30 teams, 12 members per team, 60 blocks per agenda, 400 messages per sprint (older ones are dropped).
- One facilitator PIN for everyone who facilitates. There is no co-facilitator role yet.
