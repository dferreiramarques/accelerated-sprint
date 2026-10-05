/* AI Sprint Room client: landing, join, team view, facilitator dashboard + console, projector screen. */
const socket = io({ transports: ["websocket", "polling"] });
const $ = (s, r = document) => r.querySelector(s);
const view = $("#view");
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const PHASE = { open: "Open", map: "Map", sketch: "Sketch", decide: "Decide", prototype: "Prototype", test: "Test", close: "Close", break: "Break" };
const pc = ph => `var(--p-${PHASE[ph] ? ph : "open"})`;
const ls = { get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };

let S = { sprint: null, offset: 0 };
let listeners = [];
function on(evt, fn) { socket.on(evt, fn); listeners.push([evt, fn]); }
function clearListeners() { listeners.forEach(([e, f]) => socket.off(e, f)); listeners = []; }
function emit(evt, data) { return new Promise(res => socket.timeout(8000).emit(evt, data, (err, r) => res(err ? { error: "The server did not answer. Check your connection." } : r))); }

function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 2800); }
function nav(path) { history.pushState({}, "", path); boot(); }
window.addEventListener("popstate", boot);
document.addEventListener("click", e => { const a = e.target.closest("a[data-nav]"); if (a) { e.preventDefault(); nav(a.getAttribute("href")); } });

/* connection indicator */
function setConn(onl) { const c = $("#conn"); c.classList.toggle("on", onl); c.lastElementChild.textContent = onl ? "Live" : "Reconnecting…"; }
socket.on("connect", () => setConn(true));
socket.on("disconnect", () => setConn(false));

/* sound + title flash for pushed messages */
let actx = null;
document.addEventListener("pointerdown", () => { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } }, { once: false });
function beep(times = 2) {
  if (!actx) return;
  for (let i = 0; i < times; i++) {
    const o = actx.createOscillator(), g = actx.createGain(); o.type = "sine"; o.frequency.value = 880;
    const t0 = actx.currentTime + i * 0.28; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + 0.25);
  }
}
let titleFlash = null;
function flashTitle(text) { clearInterval(titleFlash); let i = 0; const base = document.title; titleFlash = setInterval(() => { document.title = i++ % 2 ? base : text; if (i > 12) { clearInterval(titleFlash); document.title = base; } }, 900); }

function copyText(text, btn) {
  const done = () => { if (btn) { const o = btn.textContent; btn.textContent = "Copied"; setTimeout(() => btn.textContent = o, 1300); } };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => fallback());
  else fallback();
  function fallback() { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (e) { toast("Select the text and copy it."); } ta.remove(); }
}

/* ---------- time ---------- */
const toMin = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ""); return m ? (+m[1]) * 60 + (+m[2]) : 540; };
const hhmm = m => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };
function schedule(sp) { let t = toMin(sp.startTime); return sp.agenda.map(b => { const at = t; t += b.min; return at; }); }
function remainingSec(sp) { const t = sp.state.timer; return t.running ? Math.max(0, (t.endsAt - (Date.now() + S.offset)) / 1000) : (t.remaining || 0); }
const mmss = s => { s = Math.max(0, Math.ceil(s)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };

function timerSvg(sp) {
  const t = sp.state.timer, rem = remainingSec(sp), dur = t.duration || 0;
  const scale = Math.max(3600, dur), frac = Math.min(1, rem / scale);
  const cx = 110, cy = 110, r = 86;
  let wedge = "";
  if (frac >= 0.9999) wedge = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--dot)"/>`;
  else if (frac > 0) { const a = frac * 2 * Math.PI, x = cx - r * Math.sin(a), y = cy - r * Math.cos(a); wedge = `<path d="M${cx} ${cy}L${cx} ${cy - r}A${r} ${r} 0 ${frac > .5 ? 1 : 0} 0 ${x.toFixed(2)} ${y.toFixed(2)}Z" fill="var(--dot)"/>`; }
  let ticks = ""; for (let i = 0; i < 60; i++) { const a = i / 60 * 2 * Math.PI, l = i % 5 ? 4 : 10; ticks += `<line x1="${(cx + (r + 4) * Math.sin(a)).toFixed(1)}" y1="${(cy - (r + 4) * Math.cos(a)).toFixed(1)}" x2="${(cx + (r + 4 + l) * Math.sin(a)).toFixed(1)}" y2="${(cy - (r + 4 + l) * Math.cos(a)).toFixed(1)}" stroke="var(--ink-2)" stroke-width="${i % 5 ? .8 : 1.6}"/>`; }
  const low = t.running && rem <= 60 && rem > 0;
  return `<svg viewBox="0 0 220 220" role="img" aria-label="${mmss(rem)} remaining"><circle cx="${cx}" cy="${cy}" r="${r + 16}" fill="var(--card)" stroke="var(--line)" stroke-width="2"/>${ticks}${wedge}<circle cx="${cx}" cy="${cy}" r="34" fill="var(--card)"/><text x="${cx}" y="${cy + 7}" text-anchor="middle" font-size="21" font-weight="600" fill="${low ? "var(--dot)" : "var(--ink)"}" font-family="IBM Plex Mono, ui-monospace, monospace">${mmss(rem)}</text></svg>
  <div class="muted mono" style="font-size:.8rem">${t.running ? "running" : rem > 0 ? "paused" : sp.state.idx >= 0 ? "time is up" : "not started"}${scale > 3600 ? ` · disc = ${Math.round(scale / 60)} min` : ""}</div>`;
}
let lastSec = -1;
setInterval(() => {
  if (!S.sprint) return;
  const sec = Math.ceil(remainingSec(S.sprint)); if (sec === lastSec) return; lastSec = sec;
  document.querySelectorAll("[data-timer]").forEach(el => el.innerHTML = timerSvg(S.sprint));
}, 250);
function setSprint(sp) { S.offset = sp.serverNow - Date.now(); S.sprint = sp; lastSec = -1; }

/* ---------- shared renderers ---------- */
function fill(text, brief) {
  const q = (brief.questions || []).filter(Boolean).map((x, i) => `${i + 1}) ${x}`).join(" ");
  const map = { "[PROBLEM]": brief.problem, "[GOAL]": brief.goal, "[KPI]": brief.kpi, "[QUESTIONS]": q };
  let html = esc(text), plain = text;
  for (const [k, v] of Object.entries(map)) { if (v) { html = html.split(esc(k)).join(`<mark>${esc(v)}</mark>`); plain = plain.split(k).join(v); } else html = html.split(esc(k)).join(`<mark>${esc(k)}</mark>`); }
  return { html, plain };
}
function blockCard(sp, opts = {}) {
  const i = sp.state.idx, b = sp.agenda[i];
  if (!b) return "";
  const at = schedule(sp)[i], next = sp.agenda[i + 1];
  return `<article class="card now" style="--pc:${pc(b.phase)}">
    <div class="stack" style="gap:12px;min-width:0">
      <div class="row"><span class="pill" style="color:${pc(b.phase)}">${PHASE[b.phase]}</span><span class="muted mono" style="font-size:.85rem">Block ${i + 1} of ${sp.agenda.length} · planned ${hhmm(at)} · ${b.min} min</span></div>
      <h2>${esc(b.title)}</h2>
      ${b.steps.length ? `<ol>${b.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}
      ${b.tools.length ? `<div class="stack" style="gap:8px"><span class="eyebrow">Tools for this block</span>${b.tools.map((t, k) => { const f = fill(t.prompt, sp.brief); return `<div class="tool"><div class="row between"><b>${esc(t.name)}</b>${t.prompt ? `<button class="btn small" data-copy="${k}">Copy prompt</button>` : ""}</div>${t.prompt ? `<pre>${f.html}</pre>` : ""}</div>`; }).join("")}</div>` : ""}
      ${b.output ? `<p><b>Output:</b> ${esc(b.output)}</p>` : ""}
      ${opts.teamButtons || ""}
      ${next ? `<p class="muted" style="font-size:.85rem">Next: <b>${esc(next.title)}</b> (${next.min} min)</p>` : `<p class="muted" style="font-size:.85rem">Last block of the agenda.</p>`}
    </div>
    <div class="timer" data-timer>${timerSvg(sp)}</div>
  </article>`;
}
function bindCopy(root, sp) {
  root.querySelectorAll("[data-copy]").forEach(btn => btn.onclick = () => { const b = sp.agenda[sp.state.idx]; const t = b && b.tools[+btn.dataset.copy]; if (t) copyText(fill(t.prompt, sp.brief).plain, btn); });
}
function agendaList(sp, opts = {}) {
  const at = schedule(sp);
  return `<div class="agenda">${sp.agenda.map((b, i) => `<div class="ag ${i < sp.state.idx ? "past" : ""} ${i === sp.state.idx ? "active" : ""} ${b.phase === "break" ? "brk" : ""}" style="--pc:${pc(b.phase)}">
    <span class="mono muted">${hhmm(at[i])}</span>
    <div class="bar"><b>${esc(b.title)}</b> <span class="muted" style="font-size:.8rem">· ${PHASE[b.phase]} · ${b.min} min</span>${opts.doneFor ? doneChips(sp, b.id) : ""}</div>
    ${opts.go ? `<button class="btn small ${i === sp.state.idx ? "primary" : ""}" data-go="${i}">${i === sp.state.idx ? "Restart" : "Go"}</button>` : "<span></span>"}
  </div>`).join("")}</div>`;
}
function doneChips(sp, blockId) { const d = sp.teams.filter(t => t.done && t.done[blockId]); return d.length ? ` <span class="donechip">✓ ${d.map(t => esc(t.name)).join(", ")}</span>` : ""; }
function briefHtml(sp) {
  const b = sp.brief; const qs = (b.questions || []).filter(Boolean);
  const sec = (h, v) => v ? `<div class="stack" style="gap:4px"><span class="eyebrow">${h}</span><div style="white-space:pre-wrap">${esc(v)}</div></div>` : "";
  const any = b.problem || b.context || b.kpi || b.goal || qs.length || b.resources;
  return `<div class="card stack">${any ? "" : `<p class="muted">The facilitator hasn't written the brief yet.</p>`}
    ${b.problem ? `<div class="stack" style="gap:4px"><span class="eyebrow">Problem</span><p class="hand" style="font-size:1.8rem;line-height:1.1">${esc(b.problem)}</p></div>` : ""}
    ${sec("Initial conditions and context", b.context)}${sec("KPI", b.kpi)}${sec("Long-term goal", b.goal)}
    ${qs.length ? `<div class="stack" style="gap:4px"><span class="eyebrow">Sprint questions</span><ol style="margin:0;padding-left:20px">${qs.map(q => `<li>${esc(q)}</li>`).join("")}</ol></div>` : ""}
    ${sec("Resources and data", b.resources)}${sec("Ground rules", b.rules)}</div>`;
}
function teamName(sp, id) { const t = sp.teams.find(x => x.id === id); return t ? t.name : "A team"; }
function teamColor(sp, id) { const t = sp.teams.find(x => x.id === id); return t ? t.color : "var(--ink-2)"; }
const clock = ms => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
function feedHtml(sp, role) {
  const msgs = [...sp.messages].reverse();
  if (!msgs.length) return `<p class="muted" style="font-size:.88rem">No messages yet.</p>`;
  return msgs.map(m => m.from === "facilitator"
    ? `<div class="msg"><div class="meta">Facilitator → ${m.to === "all" ? "everyone" : esc(teamName(sp, m.to))} · ${clock(m.at)}</div>${esc(m.text)}</div>`
    : `<div class="msg team" style="--tc:${teamColor(sp, m.teamId)}"><div class="meta">${role === "facilitator" ? esc(teamName(sp, m.teamId)) : "Your team"} → facilitator · ${clock(m.at)}</div>${esc(m.text)}</div>`).join("");
}

/* ---------- router ---------- */
function boot() {
  clearListeners(); S.sprint = null; document.querySelector(".top").hidden = false; $("#topRight").innerHTML = ""; document.title = "AI Sprint Room";
  const p = location.pathname.split("/").filter(Boolean);
  setNav(p[0] === "prompts" ? "prompts" : !p.length ? "how" : "run");
  if (!p.length) return howItWorks();
  if (p[0] === "prompts") return promptsPage();
  if (p[0] === "run") return landing();
  if (p[0] === "join") return joinView((p[1] || "").toUpperCase());
  if (p[0] === "s") return teamView((p[1] || "").toUpperCase());
  if (p[0] === "screen") return screenView((p[1] || "").toUpperCase());
  if (p[0] === "f" && !p[1]) return facDash();
  if (p[0] === "f") return facConsole(p[1].toUpperCase());
  howItWorks();
}
function setNav(key) { document.querySelectorAll("#mainNav a").forEach(a => a.setAttribute("aria-current", a.dataset.key === key ? "page" : "false")); }

/* ---------- landing ---------- */
function landing() {
  view.innerHTML = `<section class="hero">
    <div class="stack">
      <span class="scribble">one problem · one day · many teams</span>
      <h1>Run my Sprint!</h1>
      <p class="muted" style="font-size:1.08rem;max-width:56ch">Teams join with a code and see the brief, the agenda, the active block, its AI tools and a shared timer. The facilitator moves the sprint forward and pushes messages to everyone or to one team.</p>
    </div>
    <div class="stack">
      <form class="card stack" id="joinForm"><h2>Join a sprint</h2><label class="f">Sprint code<input id="code" class="bigcode" maxlength="6" autocomplete="off" placeholder="ABC123" required></label><button class="btn primary" type="submit">Continue</button></form>
      <div class="card row between"><div><h3>Facilitator</h3><p class="muted" style="font-size:.88rem">Create sprints, run the timer, push messages.</p></div><a class="btn" href="/f" data-nav>Open console</a></div>
      <p class="muted" style="font-size:.88rem">New to the format? <a href="/" data-nav>See how the sprint works</a>.</p>
    </div></section>`;
  $("#joinForm").onsubmit = e => { e.preventDefault(); const c = $("#code").value.trim().toUpperCase(); if (c) nav("/join/" + c); };
}

/* ---------- join ---------- */
async function joinView(code) {
  view.innerHTML = `<div class="empty"><p class="muted">Looking for sprint ${esc(code)}…</p></div>`;
  const load = async () => {
    const r = await emit("t:teams", { code });
    if (r.error) { view.innerHTML = `<div class="empty"><h2>${esc(r.error)}</h2><a class="btn" href="/" data-nav>Try another code</a></div>`; return; }
    const saved = ls.get("asr:team:" + code);
    view.innerHTML = `<div class="stack" style="max-width:640px;margin:0 auto">
      <span class="eyebrow">Sprint <span class="code">${esc(code)}</span></span><h1>${esc(r.title)}</h1>
      ${saved && r.teams.some(t => t.id === saved) ? `<div class="card row between"><span>You already joined <b>${esc(r.teams.find(t => t.id === saved).name)}</b>.</span><a class="btn primary" href="/s/${code}" data-nav>Back to my team</a></div>` : ""}
      <form class="card stack" id="jf">
        <label class="f">Your name<input id="member" maxlength="40" value="${esc(ls.get("asr:member", ""))}" placeholder="So the facilitator knows who's in"></label>
        ${r.teams.length ? `<div class="stack" style="gap:6px"><span class="eyebrow">Join an existing team</span><div class="row">${r.teams.map(t => `<button type="button" class="chip" style="--tc:${t.color};cursor:pointer" data-team="${t.id}"><i></i>${esc(t.name)} <span class="muted">${t.members}</span></button>`).join("")}</div></div>` : ""}
        <label class="f">${r.teams.length ? "Or create a new team" : "Name your team"}<input id="tname" maxlength="40" placeholder="e.g. Squad A"></label>
        <button class="btn primary" type="submit">Join</button>
      </form></div>`;
    const go = async (teamId, teamName) => {
      const member = $("#member").value.trim(); ls.set("asr:member", member);
      const j = await emit("t:join", { code, teamId, teamName, member });
      if (j.error) return toast(j.error);
      ls.set("asr:team:" + code, j.teamId); nav("/s/" + code);
    };
    view.querySelectorAll("[data-team]").forEach(b => b.onclick = () => go(b.dataset.team));
    $("#jf").onsubmit = e => { e.preventDefault(); const n = $("#tname").value.trim(); if (!n) return toast("Pick a team or type a team name."); go(null, n); };
  };
  if (socket.connected) load(); else socket.once("connect", load);
}

/* ---------- team view ---------- */
function teamView(code) {
  const teamId = ls.get("asr:team:" + code);
  if (!teamId) return nav("/join/" + code);
  let seen = null, tab = "agenda";
  view.innerHTML = `<div class="stack">
    <div id="banner"></div>
    <div class="cols">
      <div class="stack"><section id="now"></section>
        <div class="row between"><div class="tabs" role="group"><button data-tab="agenda" aria-pressed="true">Agenda</button><button data-tab="brief" aria-pressed="false">Brief</button></div></div>
        <section id="tabBody"></section></div>
      <aside class="side">
        <div class="card stack" id="teamBox"></div>
        <div class="card stack"><h3>Messages</h3><div class="feed" id="feed"></div>
          <form id="mf" class="stack" style="gap:6px"><textarea id="mt" maxlength="1000" placeholder="Question or update for the facilitator"></textarea><button class="btn" type="submit">Send to facilitator</button></form></div>
      </aside></div></div>`;
  view.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { tab = b.dataset.tab; view.querySelectorAll("[data-tab]").forEach(x => x.setAttribute("aria-pressed", x === b)); renderTab(); });
  $("#mf").onsubmit = async e => { e.preventDefault(); const t = $("#mt").value.trim(); if (!t) return; const r = await emit("t:message", { text: t }); if (r.error) return toast(r.error); $("#mt").value = ""; toast("Sent to the facilitator"); };

  const showBanner = (text, kind = "") => {
    $("#banner").innerHTML = `<div class="banner ${kind} flash"><div class="txt">${esc(text)}</div><button aria-label="Dismiss">✕</button></div>`;
    $("#banner button").onclick = () => $("#banner").innerHTML = "";
  };
  const renderTab = () => { const sp = S.sprint; if (!sp) return; $("#tabBody").innerHTML = tab === "brief" ? briefHtml(sp) : `<div class="card">${agendaList(sp)}</div>`; };
  const render = () => {
    const sp = S.sprint; const me = sp.teams.find(t => t.id === teamId); if (!me) return;
    document.title = `${me.name} · ${sp.title}`;
    $("#topRight").innerHTML = `<span class="chip" style="--tc:${me.color}"><i></i>${esc(me.name)}</span>`;
    const blk = sp.agenda[sp.state.idx];
    const done = blk && me.done && me.done[blk.id];
    if (sp.status === "closed") $("#now").innerHTML = `<div class="empty"><span class="hand" style="font-size:2rem;color:var(--marker)">Sprint closed</span><p class="muted">Thanks, team. The facilitator closed this sprint.</p></div>`;
    else if (sp.state.idx < 0) $("#now").innerHTML = `<div class="card stack" style="border-top:6px solid var(--marker)"><span class="eyebrow">Lobby</span><h2>${esc(sp.title)}</h2><p class="muted">You're in. The facilitator will start the sprint and the first block will appear here. Read the brief while you wait.</p>
      <div class="row">${sp.teams.map(t => `<span class="chip" style="--tc:${t.color}"><i></i>${esc(t.name)} <span class="dotlive ${t.online ? "on" : ""}"></span></span>`).join("")}</div></div>`;
    else {
      $("#now").innerHTML = blockCard(sp, { teamButtons: `<div class="row"><button class="btn ${done ? "on" : ""}" id="bDone">${done ? "✓ We're done" : "Mark our team done"}</button><button class="btn ${me.help ? "help-on" : ""}" id="bHelp">${me.help ? "Help requested" : "We need help"}</button></div>` });
      bindCopy($("#now"), sp);
      $("#bDone").onclick = () => emit("t:status", { done: !done });
      $("#bHelp").onclick = () => emit("t:status", { help: !me.help });
    }
    $("#teamBox").innerHTML = `<div class="row between"><h3>${esc(me.name)}</h3><span class="muted" style="font-size:.8rem">code <span class="code">${esc(sp.code)}</span></span></div>
      <p class="muted" style="font-size:.88rem">${me.members.length ? esc(me.members.join(", ")) : "No names yet"}</p>
      <p class="muted" style="font-size:.8rem">Results are presented on the call from one laptop per team.</p>`;
    $("#feed").innerHTML = feedHtml(sp, "team");
    renderTab();
    // new pushes
    const fromF = sp.messages.filter(m => m.from === "facilitator");
    if (seen === null) { seen = new Set(sp.messages.map(m => m.id)); const last = fromF[fromF.length - 1]; if (last && Date.now() + S.offset - last.at < 15 * 60e3) showBanner(last.text); }
    else { const fresh = fromF.filter(m => !seen.has(m.id)); sp.messages.forEach(m => seen.add(m.id)); if (fresh.length) { const m = fresh[fresh.length - 1]; showBanner((m.to === "all" ? "" : "To your team: ") + m.text); beep(2); flashTitle("New message"); } }
  };
  let lastIdx = null;
  on("sprint", sp => { setSprint(sp); if (lastIdx !== null && sp.state.idx !== lastIdx && sp.state.idx >= 0) { beep(1); flashTitle("Next block"); } lastIdx = sp.state.idx; render(); });
  on("timeup", () => { showBanner("Time's up for this block.", "timeup"); beep(3); flashTitle("Time's up"); });
  on("kicked", () => { ls.del("asr:team:" + code); toast("The facilitator removed your team."); nav("/join/" + code); });
  on("gone", () => { view.innerHTML = `<div class="empty"><h2>This sprint is no longer available.</h2><a class="btn" href="/" data-nav>Home</a></div>`; });
  const join = async () => {
    const r = await emit("t:join", { code, teamId, member: ls.get("asr:member", "") });
    if (r.error) { if (/team/i.test(r.error)) { ls.del("asr:team:" + code); return nav("/join/" + code); } view.innerHTML = `<div class="empty"><h2>${esc(r.error)}</h2><a class="btn" href="/" data-nav>Home</a></div>`; return; }
    setSprint(r.sprint); render();
  };
  on("connect", join); if (socket.connected) join();
}

/* ---------- facilitator ---------- */
function fToken() { return ls.get("asr:ftoken"); }
function loginView(after) {
  view.innerHTML = `<form class="card stack" id="lf" style="max-width:420px;margin:30px auto"><span class="eyebrow">Facilitator</span><h2>Enter the facilitator PIN</h2><input id="pin" type="password" autocomplete="current-password" required><button class="btn primary">Log in</button></form>`;
  $("#pin").focus();
  $("#lf").onsubmit = async e => {
    e.preventDefault();
    try { const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: $("#pin").value }) }); const j = await r.json(); if (!r.ok) return toast(j.error || "Login failed"); ls.set("asr:ftoken", j.token); after(); }
    catch (err) { toast("Could not reach the server."); }
  };
}
async function fHello() {
  const t = fToken(); if (!t) return null;
  const r = await emit("f:hello", { token: t });
  if (r.error) { ls.del("asr:ftoken"); toast(r.error); return null; }
  return r;
}
function facTop() { $("#topRight").innerHTML = `<a class="btn small ghost" href="/f" data-nav>All sprints</a><button class="btn small ghost" id="logout">Log out</button>`; $("#logout").onclick = () => { ls.del("asr:ftoken"); nav("/f"); }; }

async function facDash() {
  if (!fToken()) return loginView(facDash);
  view.innerHTML = `<div class="empty"><p class="muted">Loading…</p></div>`;
  let confirmDel = null, list = [], templates = {};
  const render = () => {
    const arch = list.filter(s => s.archived);
    view.innerHTML = `<div class="stack">
      <div class="row between"><div class="stack" style="gap:6px"><span class="eyebrow">Facilitator console</span><h1>Sprints</h1></div></div>
      <form class="card row" id="cf" style="align-items:flex-end">
        <label class="f" style="flex:2 1 260px">New sprint title<input id="ct" required maxlength="120" placeholder="e.g. Sprint 01 · First-attempt failures"></label>
        <label class="f" style="flex:1 1 180px">Agenda<select id="ctpl">${Object.entries(templates).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("")}</select></label>
        <button class="btn primary">Create sprint</button></form>
      ${card(list.filter(s => !s.archived))}${arch.length ? `<details class="stack" ${arch.some(s => s.code === confirmDel) ? "open" : ""}><summary class="eyebrow" style="cursor:pointer">Archived (${arch.length})</summary><p class="muted" style="font-size:.88rem">Hidden from teams and the room screen: their codes no longer work. Restore one to use it again.</p>${card(arch)}</details>` : ""}</div>`;
    $("#cf").onsubmit = async e => { e.preventDefault(); const r = await emit("f:create", { title: $("#ct").value, template: $("#ctpl").value }); if (r.error) return toast(r.error); nav("/f/" + r.code); };
    view.querySelectorAll("[data-arch]").forEach(b => b.onclick = async () => { const r = await emit("f:archive", { code: b.dataset.arch, archived: b.dataset.to === "1" }); r.error ? toast(r.error) : toast(b.dataset.to === "1" ? "Archived. Its code no longer works." : "Restored."); });
    view.querySelectorAll("[data-dup]").forEach(b => b.onclick = async () => { const r = await emit("f:duplicate", { code: b.dataset.dup }); r.error ? toast(r.error) : toast("Duplicated as " + r.code); });
    view.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { confirmDel = b.dataset.del; render(); });
    view.querySelectorAll("[data-delno]").forEach(b => b.onclick = () => { confirmDel = null; render(); });
    view.querySelectorAll("[data-delyes]").forEach(b => b.onclick = async () => { confirmDel = null; const r = await emit("f:delete", { code: b.dataset.delyes }); if (r.error) toast(r.error); });
  };
  const card = items => items.length ? `<div class="grid g3">${items.map(s => `<article class="card stack" style="gap:8px">
          <div class="row between"><span class="code">${s.code}</span><span class="pill" style="color:${s.status === "running" ? "var(--ok)" : s.status === "closed" ? "var(--ink-2)" : "var(--marker)"}">${s.status}</span></div>
          <h3>${esc(s.title)}</h3><p class="muted" style="font-size:.88rem">${s.problem ? esc(s.problem) : "No problem written yet."}</p>
          <p class="muted mono" style="font-size:.78rem">${s.teams} team(s) · ${s.idx >= 0 ? `block ${s.idx + 1}/${s.blocks}` : `${s.blocks} blocks`} · ${new Date(s.createdAt).toLocaleDateString()}</p>
          <div class="row" style="gap:4px"><a class="btn small primary" href="/f/${s.code}" data-nav>Open</a><button class="btn small" data-dup="${s.code}">Duplicate</button><button class="btn small ghost" data-arch="${s.code}" data-to="${s.archived ? 0 : 1}">${s.archived ? "Restore" : "Archive"}</button>
          ${confirmDel === s.code ? `<button class="btn small red" data-delyes="${s.code}">Delete for good</button><button class="btn small ghost" data-delno>Keep</button>` : `<button class="btn small ghost" data-del="${s.code}">Delete</button>`}</div></article>`).join("")}</div>`
        : `<div class="empty"><span class="hand" style="font-size:1.8rem;color:var(--marker)">No sprints yet</span><p class="muted">Create one above. Each sprint gets its own code for teams to join.</p></div>`;
  on("list", l => { list = l; if (!document.activeElement || !view.contains(document.activeElement) || document.activeElement.tagName === "BUTTON") render(); });
  const start = async () => { const h = await fHello(); if (!h) return loginView(facDash); facTop(); list = h.list; templates = h.templates; render(); };
  on("connect", start); if (socket.connected) start();
}

async function facConsole(code) {
  if (!fToken()) return loginView(() => facConsole(code));
  let tab = "run", briefDraft = null, agendaDraft = null, agendaDirty = false, briefDirty = false, confirmKick = null, seen = null;
  view.innerHTML = `<div class="empty"><p class="muted">Loading sprint ${esc(code)}…</p></div>`;
  const joinUrl = () => `${location.origin}/join/${code}`;

  const shell = () => {
    view.innerHTML = `<div class="stack">
      <div class="row between" style="align-items:flex-end">
        <div class="stack" style="gap:6px;min-width:0"><span class="eyebrow">Sprint <span class="code">${code}</span></span><h1 id="ttl"></h1></div>
        <div class="card row" style="padding:10px 14px"><div><div class="eyebrow">Teams join at</div><div class="mono" style="font-size:.9rem">${esc(joinUrl())}</div></div>
          <button class="btn small" id="cpJoin">Copy link</button><a class="btn small" href="/screen/${code}" target="_blank" rel="noopener">Room screen ↗</a></div>
      </div>
      <div class="tabs" role="group"><button data-tab="run">Run</button><button data-tab="brief">Brief</button><button data-tab="agenda">Agenda</button></div>
      <div id="tabBody"></div></div>`;
    $("#cpJoin").onclick = e => copyText(joinUrl(), e.target);
    view.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { tab = b.dataset.tab; drawTab(); });
  };

  const drawTab = () => {
    view.querySelectorAll("[data-tab]").forEach(x => x.setAttribute("aria-pressed", x.dataset.tab === tab));
    const body = $("#tabBody");
    if (tab === "run") {
      body.innerHTML = `<div class="cols">
        <div class="stack"><section class="card stack" id="ctrl"></section><section id="now"></section><section class="card stack"><h3>Agenda</h3><div id="ag"></div></section></div>
        <aside class="side">
          <div class="card stack"><div class="row between"><h3>Teams</h3><span class="muted" id="tcount" style="font-size:.85rem"></span></div><div class="stack" style="gap:8px" id="teams"></div></div>
          <div class="card stack"><h3>Push a message</h3>
            <form id="pf" class="stack" style="gap:6px"><select id="pto"></select><textarea id="ptext" maxlength="1000" placeholder="e.g. 5 minutes left. Start wrapping up your sketches."></textarea>
              <div class="row">${["5 minutes left.", "Wrap up now, please.", "Back in the room, please.", "Load your notes into NotebookLM now."].map(q => `<button type="button" class="btn small ghost" data-quick="${esc(q)}">${esc(q)}</button>`).join("")}</div>
              <button class="btn primary">Send</button></form>
            <div class="feed" id="feed"></div></div>
        </aside></div>`;
      $("#pf").onsubmit = async e => { e.preventDefault(); const t = $("#ptext").value.trim(); if (!t) return; const r = await emit("f:message", { code, text: t, to: $("#pto").value }); if (r.error) return toast(r.error); $("#ptext").value = ""; toast("Pushed"); };
      view.querySelectorAll("[data-quick]").forEach(b => b.onclick = () => { $("#ptext").value = b.dataset.quick; $("#ptext").focus(); });
      drawRun();
    } else if (tab === "brief") drawBrief(); else drawAgenda();
  };

  const ctl = (action, arg) => emit("f:control", { code, action, arg }).then(r => r.error && toast(r.error));

  const drawRun = () => {
    const sp = S.sprint; if (!sp || tab !== "run") return;
    const t = sp.state.timer, idx = sp.state.idx;
    $("#ctrl").innerHTML = `<div class="row between"><div class="row"><span class="pill" style="color:${sp.status === "running" ? "var(--ok)" : "var(--marker)"}">${sp.status}</span><span class="muted" style="font-size:.88rem">${idx >= 0 ? `Block ${idx + 1} of ${sp.agenda.length}` : `${sp.teams.length} team(s) in the lobby`}</span></div>
        <div class="row" style="gap:6px">${sp.status === "closed" ? `<button class="btn small" data-c="reopen">Reopen</button>` : `<button class="btn small ghost" data-c="lobby">Back to lobby</button><button class="btn small ghost" data-c="close">Close sprint</button>`}</div></div>
      <div class="row">
        ${idx < 0 ? `<button class="btn primary" data-c="start">Start sprint</button>` : `<button class="btn" data-c="prev" ${idx <= 0 ? "disabled" : ""}>← Previous</button><button class="btn primary" data-c="next" ${idx >= sp.agenda.length - 1 ? "disabled" : ""}>Next block →</button>`}
        ${idx >= 0 ? (t.running ? `<button class="btn" data-c="pause">Pause</button>` : `<button class="btn" data-c="resume" ${t.remaining > 0 ? "" : "disabled"}>Resume</button>`) : ""}
        ${idx >= 0 ? `<button class="btn" data-c="reset">Reset</button><button class="btn small" data-c="extend" data-a="-60">−1′</button><button class="btn small" data-c="extend" data-a="60">+1′</button><button class="btn small" data-c="extend" data-a="300">+5′</button>` : ""}
      </div>`;
    $("#ctrl").querySelectorAll("[data-c]").forEach(b => b.onclick = () => ctl(b.dataset.c, b.dataset.a));
    $("#now").innerHTML = idx >= 0 ? blockCard(sp) : `<div class="empty"><span class="hand" style="font-size:1.7rem;color:var(--marker)">Lobby open</span><p class="muted">Share the join link. When everyone is in, press <b>Start sprint</b>: the first block and its timer are pushed to every team.</p></div>`;
    bindCopy($("#now"), sp);
    $("#ag").innerHTML = agendaList(sp, { go: true, doneFor: true });
    $("#ag").querySelectorAll("[data-go]").forEach(b => b.onclick = () => ctl("goto", +b.dataset.go));
    const blk = sp.agenda[idx];
    $("#tcount").textContent = `${sp.teams.filter(x => x.online).length} online · ${sp.teams.length} total`;
    $("#teams").innerHTML = sp.teams.length ? sp.teams.map(tm => `<div class="team ${tm.help ? "help" : ""}" style="--tc:${tm.color}">
        <div class="row between"><b>${esc(tm.name)}</b><span class="row" style="gap:6px"><span class="dotlive ${tm.online ? "on" : ""}" title="${tm.online ? "online" : "offline"}"></span>${blk && tm.done && tm.done[blk.id] ? `<span class="donechip">✓ done</span>` : ""}</span></div>
        <span class="muted" style="font-size:.82rem">${tm.members.length ? esc(tm.members.join(", ")) : "no names"}</span>
        <div class="row" style="gap:4px">${tm.help ? `<span class="pill" style="color:var(--dot)">needs help</span><button class="btn small" data-clear="${tm.id}">Clear</button>` : ""}
          <button class="btn small ghost" data-to="${tm.id}">Message</button>
          ${confirmKick === tm.id ? `<button class="btn small red" data-kickyes="${tm.id}">Remove team</button><button class="btn small ghost" data-kickno>Keep</button>` : `<button class="btn small ghost" data-kick="${tm.id}">Remove</button>`}</div></div>`).join("")
      : `<p class="muted" style="font-size:.88rem">No teams yet.</p>`;
    $("#teams").querySelectorAll("[data-clear]").forEach(b => b.onclick = () => emit("f:team", { code, teamId: b.dataset.clear, op: "clearHelp" }));
    $("#teams").querySelectorAll("[data-to]").forEach(b => b.onclick = () => { $("#pto").value = b.dataset.to; $("#ptext").focus(); });
    $("#teams").querySelectorAll("[data-kick]").forEach(b => b.onclick = () => { confirmKick = b.dataset.kick; drawRun(); });
    $("#teams").querySelectorAll("[data-kickno]").forEach(b => b.onclick = () => { confirmKick = null; drawRun(); });
    $("#teams").querySelectorAll("[data-kickyes]").forEach(b => b.onclick = () => { confirmKick = null; emit("f:team", { code, teamId: b.dataset.kickyes, op: "remove" }); });
    const sel = $("#pto"), keep = sel.value || "all";
    sel.innerHTML = `<option value="all">Everyone</option>` + sp.teams.map(x => `<option value="${x.id}">${esc(x.name)} only</option>`).join("");
    sel.value = [...sel.options].some(o => o.value === keep) ? keep : "all";
    $("#feed").innerHTML = feedHtml(sp, "facilitator");
  };

  const drawBrief = () => {
    const sp = S.sprint; if (!sp) return;
    if (!briefDraft) briefDraft = { title: sp.title, startTime: sp.startTime, ...JSON.parse(JSON.stringify(sp.brief)) };
    const d = briefDraft; while (d.questions.length < 3) d.questions.push("");
    $("#tabBody").innerHTML = `<form class="card stack" id="bf">
      <p class="muted">This is the statement every team sees in the <b>Brief</b> tab. [PROBLEM], [KPI], [GOAL] and [QUESTIONS] in the AI prompts are filled from it.</p>
      <div class="grid g2"><label class="f">Sprint title<input data-k="title" value="${esc(d.title)}" maxlength="120"></label><label class="f">Start time<input type="time" data-k="startTime" value="${esc(d.startTime)}"></label></div>
      <label class="f">Problem (one sentence)<input data-k="problem" value="${esc(d.problem)}" placeholder="e.g. Too many residential deliveries fail at the first attempt"></label>
      <label class="f">Initial conditions and context<textarea data-k="context" rows="6" placeholder="Current numbers, constraints, what is in and out of scope, what was tried before">${esc(d.context)}</textarea></label>
      <div class="grid g2"><label class="f">KPI<input data-k="kpi" value="${esc(d.kpi)}"></label><label class="f">Long-term goal<input data-k="goal" value="${esc(d.goal)}"></label></div>
      ${d.questions.map((q, i) => `<label class="f">Sprint question ${i + 1}<input data-q="${i}" value="${esc(q)}"></label>`).join("")}
      <label class="f">Resources and data (links, NotebookLM notebooks, files)<textarea data-k="resources" rows="3">${esc(d.resources)}</textarea></label>
      <label class="f">Ground rules<textarea data-k="rules" rows="5">${esc(d.rules)}</textarea></label>
      <div class="row"><button class="btn primary">Save and push to teams</button><button type="button" class="btn ghost" id="bReset">Discard changes</button><span class="muted" id="bState" style="font-size:.85rem">${briefDirty ? "Unsaved changes" : ""}</span></div></form>`;
    const f = $("#bf");
    f.oninput = e => { const el = e.target; if (el.dataset.k) d[el.dataset.k] = el.value; if (el.dataset.q != null) d.questions[+el.dataset.q] = el.value; briefDirty = true; $("#bState").textContent = "Unsaved changes"; };
    $("#bReset").onclick = () => { briefDraft = null; briefDirty = false; drawBrief(); };
    f.onsubmit = async e => { e.preventDefault(); const { title, startTime, ...brief } = d; const r = await emit("f:update", { code, patch: { title, startTime, brief } }); if (r.error) return toast(r.error); briefDirty = false; briefDraft = null; toast("Brief saved and pushed"); drawBrief(); };
  };

  const drawAgenda = () => {
    const sp = S.sprint; if (!sp) return;
    if (!agendaDraft) agendaDraft = JSON.parse(JSON.stringify(sp.agenda));
    const A = agendaDraft; const total = A.reduce((a, b) => a + (+b.min || 0), 0);
    $("#tabBody").innerHTML = `<div class="stack">
      <div class="row between"><p class="muted">Edit blocks, then save. Teams see changes right away; the running block keeps going.</p><span class="mono muted">${A.length} blocks · ${Math.floor(total / 60)}h${String(total % 60).padStart(2, "0")}</span></div>
      <div class="stack" style="gap:10px" id="eds">${A.map((b, i) => `<div class="ed" style="--pc:${pc(b.phase)}" data-i="${i}">
        <label class="f">Phase<select data-k="phase">${Object.entries(PHASE).map(([k, v]) => `<option value="${k}" ${b.phase === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        <label class="f">Title<input data-k="title" value="${esc(b.title)}" maxlength="120"></label>
        <label class="f">Minutes<input type="number" min="1" max="600" data-k="min" value="${b.min}"></label>
        <label class="f full">Steps (one per line)<textarea data-k="steps" rows="3">${esc(b.steps.join("\n"))}</textarea></label>
        <div class="full stack" style="gap:6px"><span class="eyebrow">Tools and AI prompts</span>
          ${b.tools.map((t, k) => `<div class="toolrow"><input data-tool="${k}" data-tk="name" value="${esc(t.name)}" placeholder="Gemini"><textarea data-tool="${k}" data-tk="prompt" rows="2" placeholder="Prompt">${esc(t.prompt)}</textarea><button type="button" class="btn small ghost" data-rmtool="${k}" aria-label="Remove tool">✕</button></div>`).join("")}
          <div><button type="button" class="btn small" data-addtool>Add tool</button></div></div>
        <label class="f full">Expected output<input data-k="output" value="${esc(b.output)}"></label>
        <div class="full row" style="gap:4px"><button type="button" class="btn small ghost" data-mv="-1">↑ Up</button><button type="button" class="btn small ghost" data-mv="1">↓ Down</button><button type="button" class="btn small ghost" data-ins>+ Insert after</button><button type="button" class="btn small ghost" data-rm style="color:var(--dot)">Remove block</button></div>
      </div>`).join("")}</div>
      <div class="row" style="position:sticky;bottom:0;background:var(--paper);padding:10px 0;border-top:1px solid var(--line)"><button class="btn primary" id="aSave">Save agenda</button><button class="btn" id="aAdd">Add block at end</button><button class="btn ghost" id="aReset">Discard changes</button><span class="muted" style="font-size:.85rem">${agendaDirty ? "Unsaved changes" : ""}</span></div></div>`;
    const eds = $("#eds");
    const mark = () => { agendaDirty = true; };
    eds.oninput = e => { const el = e.target, ed = el.closest(".ed"); if (!ed) return; const b = A[+ed.dataset.i];
      if (el.dataset.k === "steps") b.steps = el.value.split("\n"); else if (el.dataset.k === "min") b.min = +el.value; else if (el.dataset.k) b[el.dataset.k] = el.value;
      if (el.dataset.tool != null) b.tools[+el.dataset.tool][el.dataset.tk] = el.value;
      if (el.dataset.k === "phase") ed.style.setProperty("--pc", pc(el.value)); mark(); };
    eds.onclick = e => { const el = e.target.closest("button"); if (!el) return; const ed = el.closest(".ed"); const i = +ed.dataset.i;
      if (el.dataset.mv) { const j = i + (+el.dataset.mv); if (j < 0 || j >= A.length) return; [A[i], A[j]] = [A[j], A[i]]; }
      else if (el.dataset.ins != null) A.splice(i + 1, 0, { phase: A[i].phase, title: "New block", min: 10, steps: [], tools: [], output: "" });
      else if (el.dataset.rm != null) { if (A.length <= 1) return toast("Keep at least one block."); A.splice(i, 1); }
      else if (el.dataset.addtool != null) A[i].tools.push({ name: "Gemini", prompt: "" });
      else if (el.dataset.rmtool != null) A[i].tools.splice(+el.dataset.rmtool, 1);
      else return;
      mark(); drawAgenda(); };
    $("#aAdd").onclick = () => { A.push({ phase: "open", title: "New block", min: 10, steps: [], tools: [], output: "" }); mark(); drawAgenda(); };
    $("#aReset").onclick = () => { agendaDraft = null; agendaDirty = false; drawAgenda(); };
    $("#aSave").onclick = async () => { const clean = A.map(b => ({ ...b, steps: b.steps.map(s => s.trim()).filter(Boolean) })); const r = await emit("f:update", { code, patch: { agenda: clean } }); if (r.error) return toast(r.error); agendaDirty = false; agendaDraft = null; toast("Agenda saved"); };
  };

  on("sprint", sp => {
    setSprint(sp);
    $("#ttl") && ($("#ttl").textContent = sp.title);
    document.title = `${sp.title} · console`;
    // alert on new team messages / help
    const tm = sp.messages.filter(m => m.from === "team");
    if (seen === null) seen = new Set(tm.map(m => m.id));
    else { const fresh = tm.filter(m => !seen.has(m.id)); fresh.forEach(m => seen.add(m.id)); if (fresh.length) { beep(1); toast(`${teamName(sp, fresh[fresh.length - 1].teamId)}: ${fresh[fresh.length - 1].text}`); flashTitle("Team message"); } }
    if (tab === "run") { const ae = document.activeElement; if (ae && (ae.id === "ptext" || ae.id === "pto")) { const v = $("#ptext").value; drawRun(); $("#ptext").value = v; } else drawRun(); }
    else if (tab === "brief" && !briefDirty) { briefDraft = null; drawBrief(); }
    else if (tab === "agenda" && !agendaDirty) { agendaDraft = null; drawAgenda(); }
  });
  on("timeup", () => { beep(2); toast("Time's up for this block"); });
  on("gone", () => nav("/f"));
  const start = async () => {
    const h = await fHello(); if (!h) return loginView(() => facConsole(code));
    facTop();
    const r = await emit("f:watch", { code });
    if (r.error) { view.innerHTML = `<div class="empty"><h2>${esc(r.error)}</h2><a class="btn" href="/f" data-nav>All sprints</a></div>`; return; }
    setSprint(r.sprint);
    if (!$("#tabBody")) shell();
    $("#ttl").textContent = r.sprint.title; drawTab();
  };
  on("connect", start); if (socket.connected) start();
}

/* ---------- room screen (projector) ---------- */
function screenView(code) {
  document.querySelector(".top").hidden = true;
  const render = () => {
    const sp = S.sprint; const idx = sp.state.idx, b = sp.agenda[idx], next = sp.agenda[idx + 1];
    const lastAll = [...sp.messages].reverse().find(m => m.from === "facilitator" && m.to === "all");
    const joinUrl = `${location.origin}/join/${sp.code}`;
    if (idx < 0 || sp.status === "lobby") {
      view.innerHTML = `<div class="screen"><div class="stack" style="gap:20px"><span class="eyebrow">Join the sprint</span><h1>${esc(sp.title)}</h1>
        <p style="font-size:clamp(1.2rem,2.2vw,1.8rem)">Go to <b class="mono">${esc(joinUrl.replace(/^https?:\/\//, ""))}</b></p>
        <p class="code" style="font-size:clamp(3rem,9vw,7rem);line-height:1">${sp.code}</p></div>
        <div class="stack"><span class="eyebrow">Teams in the room</span><div class="row">${sp.teams.map(t => `<span class="chip" style="--tc:${t.color};font-size:1.1rem"><i></i>${esc(t.name)}</span>`).join("") || `<span class="muted">Waiting for the first team…</span>`}</div>
        ${lastAll ? `<div class="banner"><div class="txt">${esc(lastAll.text)}</div></div>` : ""}</div></div>`;
      return;
    }
    view.innerHTML = `<div class="screen"><div class="stack" style="gap:18px">
        <div class="row"><span class="pill" style="color:${pc(b.phase)};font-size:1rem">${PHASE[b.phase]}</span><span class="muted mono">Block ${idx + 1}/${sp.agenda.length}</span></div>
        <h1>${esc(b.title)}</h1>
        ${b.steps.length ? `<ol style="font-size:clamp(1.1rem,1.8vw,1.5rem);margin:0;padding-left:28px">${b.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}
        ${lastAll ? `<div class="banner"><div class="txt">${esc(lastAll.text)}</div></div>` : ""}
        <div class="row">${sp.teams.map(t => `<span class="chip" style="--tc:${t.color}"><i></i>${esc(t.name)}${t.done && t.done[b.id] ? " ✓" : ""}</span>`).join("")}</div>
        ${next ? `<p class="muted" style="font-size:1.1rem">Next: ${esc(next.title)} · ${next.min} min</p>` : ""}
      </div><div class="timer huge" data-timer>${timerSvg(sp)}</div></div>`;
  };
  on("sprint", sp => { setSprint(sp); render(); });
  on("timeup", () => beep(3));
  const watch = async () => { const r = await emit("screen:watch", { code }); if (r.error) { view.innerHTML = `<div class="empty"><h2>${esc(r.error)}</h2></div>`; return; } setSprint(r.sprint); render(); };
  on("connect", watch); if (socket.connected) watch();
}

boot();
