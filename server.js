// AI Sprint Room — live control room for an AI-accelerated Design Sprint.
// Facilitator creates a sprint (brief + agenda), teams join a lobby with a code,
// and the facilitator pushes the active block, the timer and messages in real time.

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const { TEMPLATES } = require("./templates");

const PORT = process.env.PORT || 3000;
const PIN = process.env.FACILITATOR_PIN || "";
const SECRET = process.env.SESSION_SECRET || PIN || "dev";
const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "sprints.json");

if (!PIN) console.warn("[warn] FACILITATOR_PIN is not set: facilitator login is disabled until you set it.");

/* ---------- storage: one JSON file, written atomically ---------- */
fs.mkdirSync(DATA_DIR, { recursive: true });
let db = { sprints: {} };
try { db = JSON.parse(fs.readFileSync(DB_FILE, "utf8")); if (!db.sprints) db.sprints = {}; }
catch (e) { if (e.code !== "ENOENT") console.error("[db] could not read, starting empty:", e.message); }
console.log(`[db] ${Object.keys(db.sprints).length} sprint(s) loaded from ${DB_FILE}`);

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = DB_FILE + ".tmp";
    fs.writeFile(tmp, JSON.stringify(db), err => {
      if (err) return console.error("[db] write failed:", err.message);
      fs.rename(tmp, DB_FILE, e => e && console.error("[db] rename failed:", e.message));
    });
  }, 250);
}
function flushSync() { try { fs.writeFileSync(DB_FILE, JSON.stringify(db)); } catch (e) { console.error(e); } }
process.on("SIGTERM", () => { flushSync(); process.exit(0); });
process.on("SIGINT", () => { flushSync(); process.exit(0); });

/* ---------- helpers ---------- */
const id = () => crypto.randomBytes(6).toString("base64url");
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newCode() {
  let c;
  do { c = Array.from(crypto.randomBytes(6), x => CODE_CHARS[x % CODE_CHARS.length]).join(""); } while (db.sprints[c]);
  return c;
}
const str = (v, max = 2000) => String(v == null ? "" : v).slice(0, max);
const token = () => crypto.createHmac("sha256", SECRET).update("facilitator:" + PIN).digest("hex");
function validToken(t) {
  if (!PIN || typeof t !== "string") return false;
  const a = Buffer.from(t), b = Buffer.from(token());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const TEAM_COLORS = ["#2B55C9", "#C98A00", "#1F8A62", "#6B4FB8", "#E0412F", "#0E8A9A", "#B5487C", "#5B6B2F"];

function cleanBlock(x) {
  return {
    id: x.id || id(),
    phase: ["open", "map", "sketch", "decide", "prototype", "test", "close", "break"].includes(x.phase) ? x.phase : "open",
    title: str(x.title, 120) || "Untitled block",
    min: Math.max(1, Math.min(600, Math.round(+x.min || 10))),
    steps: (Array.isArray(x.steps) ? x.steps : []).map(s => str(s, 300)).filter(Boolean).slice(0, 12),
    tools: (Array.isArray(x.tools) ? x.tools : []).map(t => ({ name: str(t.name, 60), prompt: str(t.prompt, 3000) })).filter(t => t.name || t.prompt).slice(0, 8),
    output: str(x.output, 200)
  };
}

function newSprint(title, template) {
  const t = TEMPLATES[template] || TEMPLATES.day1;
  return {
    code: newCode(), title: str(title, 120) || "New sprint", createdAt: Date.now(), status: "lobby",
    brief: {
      problem: "", context: "", kpi: "", goal: "", questions: ["", "", ""],
      resources: "", rules: "Think first, AI second.\nTogether alone: ideas made individually, shared as a group.\nThe timer rules; side topics go to the parking lot.\nThe decider decides.\nAnonymised data only, corporate Gemini and NotebookLM accounts."
    },
    agenda: t.blocks.map(cleanBlock),
    startTime: "09:00",
    state: { idx: -1, timer: { duration: 0, endsAt: null, remaining: 0, running: false } },
    teams: [], messages: []
  };
}

function publicSprint(s, viewer) {
  // viewer: {role:'facilitator'} | {role:'team', teamId} | {role:'screen'}
  const msgs = s.messages.filter(m =>
    viewer.role === "facilitator" ||
    (viewer.role === "screen" && m.to === "all" && m.from === "facilitator") ||
    (viewer.role === "team" && (m.to === "all" || m.to === viewer.teamId || m.teamId === viewer.teamId))
  ).slice(-150);
  return {
    code: s.code, title: s.title, status: s.status, brief: s.brief, agenda: s.agenda, startTime: s.startTime,
    state: s.state, messages: msgs, createdAt: s.createdAt,
    teams: s.teams.map(t => ({ id: t.id, name: t.name, color: t.color, members: t.members, done: t.done, help: t.help, online: online(s.code, t.id) })),
    serverNow: Date.now()
  };
}

/* ---------- presence ---------- */
const presence = new Map(); // `${code}:${teamId}` -> Set(socketId)
function online(code, teamId) { const p = presence.get(code + ":" + teamId); return p ? p.size : 0; }

/* ---------- http ---------- */
const app = express();
app.use(express.json({ limit: "200kb" }));
app.get("/health", (_req, res) => res.json({ ok: true, sprints: Object.keys(db.sprints).length }));
app.post("/api/login", (req, res) => {
  const pin = str(req.body && req.body.pin, 200);
  if (!PIN) return res.status(503).json({ error: "FACILITATOR_PIN is not set on the server." });
  const a = Buffer.from(pin), b = Buffer.from(PIN);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: "Wrong PIN." });
  res.json({ token: token() });
});
app.get("/api/templates", (_req, res) => res.json(Object.fromEntries(Object.entries(TEMPLATES).map(([k, v]) => [k, v.name]))));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));
app.get(["/f", "/f/*", "/s/*", "/screen/*", "/join/*"], (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: false } });

async function broadcast(code) {
  const s = db.sprints[code]; if (!s) return;
  const sockets = await io.in("s:" + code).fetchSockets();
  for (const so of sockets) so.emit("sprint", publicSprint(s, so.data.viewer || { role: "screen" }));
}
function broadcastList() { io.to("facilitators").emit("list", sprintList()); }
function sprintList() {
  return Object.values(db.sprints).sort((a, b) => b.createdAt - a.createdAt).map(s => ({
    code: s.code, title: s.title, status: s.status, createdAt: s.createdAt, teams: s.teams.length,
    problem: s.brief.problem, blocks: s.agenda.length, idx: s.state.idx
  }));
}

/* ---------- timer logic (server is the clock) ---------- */
function startBlock(s, idx) {
  if (idx < 0 || idx >= s.agenda.length) return;
  s.state.idx = idx;
  const d = s.agenda[idx].min * 60;
  s.state.timer = { duration: d, endsAt: Date.now() + d * 1000, remaining: d, running: true };
  s.status = "running";
  s.teams.forEach(t => { t.help = false; });
}
function remaining(t) { return t.running ? Math.max(0, Math.round((t.endsAt - Date.now()) / 1000)) : t.remaining; }

function control(s, action, arg) {
  const t = s.state.timer;
  switch (action) {
    case "start": startBlock(s, s.state.idx < 0 ? 0 : s.state.idx); break;
    case "goto": startBlock(s, Math.round(+arg)); break;
    case "next": if (s.state.idx < s.agenda.length - 1) startBlock(s, s.state.idx + 1); break;
    case "prev": if (s.state.idx > 0) startBlock(s, s.state.idx - 1); break;
    case "pause": if (t.running) { t.remaining = remaining(t); t.running = false; t.endsAt = null; } break;
    case "resume": if (!t.running && t.remaining > 0) { t.running = true; t.endsAt = Date.now() + t.remaining * 1000; } break;
    case "reset": if (s.state.idx >= 0) { const d = s.agenda[s.state.idx].min * 60; s.state.timer = { duration: d, endsAt: null, remaining: d, running: false }; } break;
    case "extend": {
      const sec = Math.max(-3600, Math.min(3600, Math.round(+arg || 60)));
      if (t.running) { t.endsAt = Math.max(Date.now(), t.endsAt + sec * 1000); t.duration = Math.max(1, t.duration + sec); }
      else { t.remaining = Math.max(0, t.remaining + sec); t.duration = Math.max(1, t.duration + sec); }
      break;
    }
    case "lobby": s.status = "lobby"; s.state.idx = -1; s.state.timer = { duration: 0, endsAt: null, remaining: 0, running: false }; break;
    case "close": s.status = "closed"; if (t.running) { t.remaining = remaining(t); t.running = false; t.endsAt = null; } break;
    case "reopen": s.status = s.state.idx >= 0 ? "running" : "lobby"; break;
    default: return false;
  }
  return true;
}

function pushMessage(s, m) {
  s.messages.push({ id: id(), at: Date.now(), ...m });
  if (s.messages.length > 400) s.messages = s.messages.slice(-400);
}

/* ---------- sockets ---------- */
io.on("connection", socket => {
  const isF = () => socket.data.viewer && socket.data.viewer.role === "facilitator";
  const ack = (cb, v) => typeof cb === "function" && cb(v);

  socket.on("f:hello", ({ token: t } = {}, cb) => {
    if (!validToken(t)) return ack(cb, { error: "Session expired. Log in again." });
    socket.data.viewer = { role: "facilitator" };
    socket.join("facilitators");
    ack(cb, { ok: true, list: sprintList(), templates: Object.fromEntries(Object.entries(TEMPLATES).map(([k, v]) => [k, v.name])) });
  });

  socket.on("f:create", ({ title, template } = {}, cb) => {
    if (!isF()) return ack(cb, { error: "Not allowed." });
    const s = newSprint(title, template); db.sprints[s.code] = s; save(); broadcastList(); ack(cb, { code: s.code });
  });

  socket.on("f:duplicate", ({ code } = {}, cb) => {
    if (!isF()) return ack(cb, { error: "Not allowed." });
    const src = db.sprints[code]; if (!src) return ack(cb, { error: "Sprint not found." });
    const s = newSprint(src.title + " (copy)");
    s.brief = JSON.parse(JSON.stringify(src.brief)); s.agenda = src.agenda.map(b => cleanBlock({ ...b, id: null })); s.startTime = src.startTime;
    db.sprints[s.code] = s; save(); broadcastList(); ack(cb, { code: s.code });
  });

  socket.on("f:delete", ({ code } = {}, cb) => {
    if (!isF()) return ack(cb, { error: "Not allowed." });
    if (!db.sprints[code]) return ack(cb, { error: "Sprint not found." });
    io.to("s:" + code).emit("gone");
    delete db.sprints[code]; save(); broadcastList(); ack(cb, { ok: true });
  });

  socket.on("f:watch", ({ code } = {}, cb) => {
    if (!isF()) return ack(cb, { error: "Not allowed." });
    const s = db.sprints[code]; if (!s) return ack(cb, { error: "Sprint not found." });
    socket.join("s:" + code); ack(cb, { sprint: publicSprint(s, socket.data.viewer) });
  });

  socket.on("f:update", ({ code, patch } = {}, cb) => {
    if (!isF()) return ack(cb, { error: "Not allowed." });
    const s = db.sprints[code]; if (!s || !patch) return ack(cb, { error: "Sprint not found." });
    if (patch.title != null) s.title = str(patch.title, 120) || s.title;
    if (patch.startTime != null && /^\d{1,2}:\d{2}$/.test(patch.startTime)) s.startTime = patch.startTime;
    if (patch.brief) {
      const b = patch.brief;
      ["problem", "context", "kpi", "goal", "resources", "rules"].forEach(k => { if (b[k] != null) s.brief[k] = str(b[k], 6000); });
      if (Array.isArray(b.questions)) s.brief.questions = b.questions.slice(0, 5).map(q => str(q, 300));
    }
    if (Array.isArray(patch.agenda)) {
      const activeId = s.state.idx >= 0 && s.agenda[s.state.idx] ? s.agenda[s.state.idx].id : null;
      s.agenda = patch.agenda.slice(0, 60).map(cleanBlock);
      if (activeId) { const i = s.agenda.findIndex(b => b.id === activeId); s.state.idx = i; if (i < 0) control(s, "lobby"); }
    }
    save(); broadcast(code); broadcastList(); ack(cb, { ok: true });
  });

  socket.on("f:control", ({ code, action, arg } = {}, cb) => {
    if (!isF()) return ack(cb, { error: "Not allowed." });
    const s = db.sprints[code]; if (!s) return ack(cb, { error: "Sprint not found." });
    if (!control(s, action, arg)) return ack(cb, { error: "Unknown action." });
    save(); broadcast(code); broadcastList(); ack(cb, { ok: true });
  });

  socket.on("f:message", ({ code, text, to } = {}, cb) => {
    if (!isF()) return ack(cb, { error: "Not allowed." });
    const s = db.sprints[code]; if (!s) return ack(cb, { error: "Sprint not found." });
    const t = str(text, 1000).trim(); if (!t) return ack(cb, { error: "Empty message." });
    const target = to === "all" || s.teams.some(x => x.id === to) ? to : "all";
    pushMessage(s, { from: "facilitator", to: target, text: t });
    save(); broadcast(code); ack(cb, { ok: true });
  });

  socket.on("f:team", ({ code, teamId, op } = {}, cb) => {
    if (!isF()) return ack(cb, { error: "Not allowed." });
    const s = db.sprints[code]; if (!s) return ack(cb, { error: "Sprint not found." });
    const t = s.teams.find(x => x.id === teamId); if (!t) return ack(cb, { error: "Team not found." });
    if (op === "clearHelp") t.help = false;
    if (op === "remove") { s.teams = s.teams.filter(x => x.id !== teamId); io.to("t:" + code + ":" + teamId).emit("kicked"); }
    save(); broadcast(code); broadcastList(); ack(cb, { ok: true });
  });

  /* screen (projector) — read-only, public broadcasts only */
  socket.on("screen:watch", ({ code } = {}, cb) => {
    const s = db.sprints[String(code || "").toUpperCase()]; if (!s) return ack(cb, { error: "No sprint with that code." });
    socket.data.viewer = { role: "screen" }; socket.join("s:" + s.code);
    ack(cb, { sprint: publicSprint(s, socket.data.viewer) });
  });

  /* teams */
  socket.on("t:join", ({ code, teamId, teamName, member } = {}, cb) => {
    const s = db.sprints[String(code || "").toUpperCase()];
    if (!s) return ack(cb, { error: "No sprint with that code." });
    if (s.status === "closed") return ack(cb, { error: "This sprint is closed." });
    let t = teamId && s.teams.find(x => x.id === teamId);
    if (!t) {
      const name = str(teamName, 40).trim();
      if (!name) return ack(cb, { error: "Choose or name a team." });
      t = s.teams.find(x => x.name.toLowerCase() === name.toLowerCase());
      if (!t) {
        if (s.teams.length >= 30) return ack(cb, { error: "This sprint has too many teams." });
        t = { id: id(), name, color: TEAM_COLORS[s.teams.length % TEAM_COLORS.length], members: [], done: {}, help: false, joinedAt: Date.now() };
        s.teams.push(t);
      }
    }
    const m = str(member, 40).trim();
    if (m && !t.members.some(x => x.toLowerCase() === m.toLowerCase())) t.members.push(m);
    if (t.members.length > 12) t.members = t.members.slice(-12);
    socket.data.viewer = { role: "team", teamId: t.id };
    socket.data.code = s.code;
    socket.join("s:" + s.code); socket.join("t:" + s.code + ":" + t.id);
    const key = s.code + ":" + t.id; if (!presence.has(key)) presence.set(key, new Set()); presence.get(key).add(socket.id);
    save(); broadcast(s.code); broadcastList();
    ack(cb, { teamId: t.id, sprint: publicSprint(s, socket.data.viewer) });
  });

  socket.on("t:teams", ({ code } = {}, cb) => {
    const s = db.sprints[String(code || "").toUpperCase()];
    if (!s) return ack(cb, { error: "No sprint with that code." });
    ack(cb, { title: s.title, status: s.status, teams: s.teams.map(t => ({ id: t.id, name: t.name, color: t.color, members: t.members.length })) });
  });

  socket.on("t:status", ({ done, help } = {}, cb) => {
    const v = socket.data.viewer; const s = db.sprints[socket.data.code];
    if (!s || !v || v.role !== "team") return ack(cb, { error: "Join the sprint first." });
    const t = s.teams.find(x => x.id === v.teamId); if (!t) return ack(cb, { error: "Team not found." });
    const blk = s.agenda[s.state.idx];
    if (done != null && blk) t.done[blk.id] = !!done;
    if (help != null) t.help = !!help;
    save(); broadcast(s.code); ack(cb, { ok: true });
  });

  socket.on("t:message", ({ text } = {}, cb) => {
    const v = socket.data.viewer; const s = db.sprints[socket.data.code];
    if (!s || !v || v.role !== "team") return ack(cb, { error: "Join the sprint first." });
    const t = str(text, 1000).trim(); if (!t) return ack(cb, { error: "Empty message." });
    pushMessage(s, { from: "team", teamId: v.teamId, to: "facilitator", text: t });
    save(); broadcast(s.code); ack(cb, { ok: true });
  });

  socket.on("disconnect", () => {
    const v = socket.data.viewer;
    if (v && v.role === "team" && socket.data.code) {
      const key = socket.data.code + ":" + v.teamId; const p = presence.get(key);
      if (p) { p.delete(socket.id); if (!p.size) presence.delete(key); }
      broadcast(socket.data.code);
    }
  });
});

// Auto-advance nothing: the facilitator stays in control. Notify rooms when a timer hits zero.
setInterval(() => {
  for (const s of Object.values(db.sprints)) {
    const t = s.state.timer;
    if (t.running && t.endsAt <= Date.now()) {
      t.running = false; t.remaining = 0; t.endsAt = null;
      io.to("s:" + s.code).emit("timeup", { idx: s.state.idx });
      save(); broadcast(s.code);
    }
  }
}, 1000);

server.listen(PORT, () => console.log(`AI Sprint Room listening on :${PORT} (data: ${DATA_DIR})`));
