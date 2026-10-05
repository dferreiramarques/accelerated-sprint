/* "How it works" and "AI prompts" pages. Content comes from the agenda templates on the server
   (/api/templates/:key) so the explanation always matches what the facilitator runs.
   Uses globals from app.js at call time: view, esc, pc, PHASE, nav, copyText, hhmm. */

const TPL_CACHE = {};
async function getTemplate(key) {
  if (TPL_CACHE[key]) return TPL_CACHE[key];
  const r = await fetch("/api/templates/" + key); if (!r.ok) throw new Error("template " + key);
  return (TPL_CACHE[key] = await r.json());
}
function sched(blocks, start = "09:00") { let t = toMinutes(start); return blocks.map(b => { const o = { ...b, at: t }; t += b.min; return o; }); }
function toMinutes(t) { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ""); return m ? (+m[1]) * 60 + (+m[2]) : 540; }
const hm = m => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;

/* hand-drawn style illustrations, one per Sprint step */
const ILL = {
  map: `<svg viewBox="0 0 150 90" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 18c8-1 18 0 24 1M8 18l1 14c7 1 16 0 23-1l1-12"/><path d="M60 46c8-1 17 0 24 0M60 46l1 14c7 1 16 1 23 0l1-14"/><path d="M110 18c8-1 17 0 24 1M110 18l1 14c7 1 15 0 23-1l-1-12"/><path d="M33 26c10 2 18 8 26 26"/><path d="M53 47l6 5 2-8"/><path d="M85 52c10-4 17-14 24-24"/><path d="M103 30l6-3 1 7"/><circle cx="72" cy="53" r="20" stroke="var(--dot)" stroke-dasharray="3 4"/></svg>`,
  sketch: `<svg viewBox="0 0 150 90" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" aria-hidden="true"><path d="M10 10h130v70H10z"/><path d="M42 10v70M75 10v70M108 10v70M10 45h130"/><path d="M17 25c5-4 9 4 15 0M18 33h14"/><path d="M50 22l8 10 8-12"/><circle cx="91" cy="27" r="6"/><path d="M115 22h18M115 30h10"/><path d="M18 58h16v10H18z"/><path d="M50 62c4-6 10 6 16 0"/><path d="M83 56l14 14M97 56L83 70"/><path d="M116 60c4 0 6 8 12 6"/></svg>`,
  decide: `<svg viewBox="0 0 150 90" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" aria-hidden="true"><path d="M8 14h38v58H8zM56 14h38v58H56zM104 14h38v58h-38z"/><path d="M14 26h24M14 34h18M62 26h24M62 34h20M110 26h22M110 34h16"/><g fill="var(--dot)" stroke="none"><circle cx="20" cy="52" r="3.5"/><circle cx="70" cy="48" r="3.5"/><circle cx="78" cy="52" r="3.5"/><circle cx="72" cy="58" r="3.5"/><circle cx="82" cy="44" r="3.5"/><circle cx="124" cy="54" r="3.5"/><circle cx="75" cy="82" r="7"/></g></svg>`,
  prototype: `<svg viewBox="0 0 150 90" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><rect x="52" y="6" width="46" height="78" rx="7"/><path d="M60 18h30M60 28h22"/><rect x="60" y="36" width="30" height="18" rx="3"/><path d="M60 62h30M60 70h18"/><path d="M22 30c-6 10-6 24 0 34M128 30c6 10 6 24 0 34" stroke-dasharray="3 5"/><path d="M14 48h10M126 48h10"/></svg>`,
  test: `<svg viewBox="0 0 150 90" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="34" cy="38" r="12"/><path d="M14 80c2-14 10-22 20-22s18 8 20 22"/><circle cx="104" cy="38" r="12"/><path d="M84 80c2-14 10-22 20-22s18 8 20 22"/><path d="M52 10h44c4 0 6 2 6 6v10c0 4-2 6-6 6H74l-8 7v-7H52c-4 0-6-2-6-6V16c0-4 2-6 6-6z"/><path d="M60 21l5 5 9-10" stroke="var(--ok)"/><path d="M128 14l12 12M140 14l-12 12" stroke="var(--dot)"/></svg>`
};

const STEP_CARDS = [
  { ph: "map", what: ["Agree a long-term goal and 3 sprint questions", "Map the process from actor to result", "Interview experts, capture 'How might we…' notes", "Decider picks one target on the map"], ai: "NotebookLM reads KPIs, SOPs and exception reports so the map and the risks are grounded in data, not memory." },
  { ph: "sketch", what: ["Lightning demos of existing solutions", "Notes, ideas, Crazy 8s", "Each person draws a 3-panel solution sketch, alone"], ai: "Gemini finds analogies from other industries in minutes and red-teams each sketch." },
  { ph: "decide", what: ["Art museum and heat map with dots", "Speed critique, straw poll, supervote", "Storyboard of the test in 6 frames"], ai: "Gemini compares finalists in a neutral table and drafts the storyboard. The decider still decides." },
  { ph: "prototype", what: ["Build a realistic façade, not a product", "Squads in parallel: screens, data, script", "Trial run with a colleague"], ai: "Gemini Canvas generates clickable mock-ups and fictional route data, the step that used to take a full day." },
  { ph: "test", what: ["3 to 4 interviews of 12 minutes", "Everyone observes and takes notes", "Synthesis, then go / iterate / stop"], ai: "NotebookLM turns the observation notes into patterns with quotes, so the decision is taken the same day." }
];

function weekToDaySvg(s) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"], ph = ["map", "sketch", "decide", "prototype", "test"];
  const start = s[0].at, end = s[s.length - 1].at + s[s.length - 1].min, X = m => 20 + (m - start) / (end - start) * 400;
  const span = p => { const b = s.filter(x => x.phase === p); return b.length ? [b[0].at, b[b.length - 1].at + b[b.length - 1].min] : [start, start]; };
  let o = `<svg viewBox="0 0 440 230" role="img" aria-label="The five Sprint days mapped onto one day" style="width:100%;height:auto">`;
  o += `<text x="20" y="22" font-size="13" font-weight="700" fill="var(--ink)" font-family="var(--f-display)">Classic Sprint: 5 days</text>`;
  days.forEach((d, i) => { const x = 20 + i * 80; o += `<rect x="${x}" y="34" width="74" height="44" rx="6" fill="none" stroke="${pc(ph[i])}" stroke-width="2"/><text x="${x + 37}" y="53" text-anchor="middle" font-size="12" font-weight="600" fill="var(--ink)">${d}</text><text x="${x + 37}" y="69" text-anchor="middle" font-size="11" fill="var(--ink-2)">${PHASE[ph[i]]}</text>`; });
  ph.forEach((p, i) => { const [a, b] = span(p), x0 = 20 + i * 80 + 37, x1 = X((a + b) / 2); o += `<path d="M${x0} 80 C ${x0} 112, ${x1} 112, ${x1} 140" fill="none" stroke="${pc(p)}" stroke-width="1.6" stroke-dasharray="4 4"/>`; });
  o += `<text x="20" y="134" font-size="13" font-weight="700" fill="var(--ink)" font-family="var(--f-display)">AI Sprint: one day</text>`;
  s.forEach(b => { o += `<rect x="${X(b.at)}" y="144" width="${Math.max(1, X(b.at + b.min) - X(b.at) - 1)}" height="30" fill="${pc(b.phase)}" opacity="${b.phase === "break" ? .5 : 1}"/>`; });
  for (let h = Math.ceil(start / 60); h <= Math.floor(end / 60); h++) o += `<text x="${X(h * 60)}" y="192" text-anchor="middle" font-size="10" fill="var(--ink-2)" font-family="var(--f-mono)">${h}h</text>`;
  return o + `<text x="20" y="220" font-size="20" fill="var(--marker)" font-family="var(--f-hand)" font-weight="700">AI does the research, synthesis &amp; first drafts</text></svg>`;
}

function roadmapSvg() {
  const ink = "var(--ink)", q = "var(--ink-2)", ax = "var(--ink-2)";
  return `<svg viewBox="0 0 900 190" role="img" aria-label="Pre-sprint, Day 1, decision gate, extension and pilot" style="width:100%;min-width:720px;height:auto">
  <defs><marker id="rm-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="${ax}"/></marker></defs>
  <rect x="10" y="40" width="190" height="96" rx="10" fill="none" stroke="var(--p-open)" stroke-width="2"/>
  <text x="26" y="66" font-size="15" font-weight="700" fill="${ink}" font-family="var(--f-display)">Pre-sprint</text><text x="26" y="86" font-size="12" fill="${q}">D-14 to D-2 · ~1h each</text>
  <text x="26" y="106" font-size="12" fill="${ink}">Submit and vote problems</text><text x="26" y="122" font-size="12" fill="${ink}">Load data into NotebookLM</text>
  <path d="M200 88H232" stroke="${ax}" stroke-width="1.5" marker-end="url(#rm-a)"/>
  <rect x="236" y="30" width="240" height="116" rx="10" fill="var(--tint)" stroke="var(--marker)" stroke-width="2.5"/>
  <text x="254" y="58" font-size="16" font-weight="800" fill="${ink}" font-family="var(--f-display)">Day 1 · Sprint · 8h</text>
  <text x="254" y="80" font-size="11" fill="${q}">Map, Sketch, Decide, Prototype, Test</text>
  <text x="254" y="104" font-size="12" fill="${ink}">Tested prototype per team</text><text x="254" y="120" font-size="12" fill="${ink}">Presentations on the call</text>
  <path d="M476 88H512" stroke="${ax}" stroke-width="1.5" marker-end="url(#rm-a)"/>
  <path d="M556 50L596 88L556 126L516 88Z" fill="none" stroke="var(--dot)" stroke-width="2.5"/><text x="556" y="92" text-anchor="middle" font-size="12" font-weight="700" fill="${ink}">Decide</text>
  <text x="556" y="40" text-anchor="middle" font-size="12" fill="${q}">go · iterate · stop</text>
  <path d="M596 88H628" stroke="${ax}" stroke-width="1.5" marker-end="url(#rm-a)"/>
  <rect x="632" y="40" width="160" height="96" rx="10" fill="none" stroke="var(--p-prototype)" stroke-width="2" stroke-dasharray="6 4"/>
  <text x="648" y="66" font-size="15" font-weight="700" fill="${ink}" font-family="var(--f-display)">Extension +8h</text><text x="648" y="86" font-size="12" fill="${q}">within 2 weeks, optional</text>
  <text x="648" y="106" font-size="12" fill="${ink}">Prototype v2, tested</text><text x="648" y="122" font-size="12" fill="${ink}">Business case</text>
  <path d="M792 88H822" stroke="${ax}" stroke-width="1.5" marker-end="url(#rm-a)"/>
  <rect x="826" y="62" width="66" height="52" rx="10" fill="none" stroke="${ink}" stroke-width="2"/><text x="859" y="93" text-anchor="middle" font-size="13" font-weight="700" fill="${ink}">Pilot</text>
  <path d="M556 126 C 556 176, 356 176, 356 148" fill="none" stroke="var(--dot)" stroke-width="1.4" stroke-dasharray="4 4" marker-end="url(#rm-a)"/>
  <text x="430" y="182" font-size="18" fill="var(--dot)" font-family="var(--f-hand)" font-weight="700">stop: lessons saved, next problem</text></svg>`;
}

function teamSvg() {
  let o = `<svg viewBox="0 0 460 200" role="img" aria-label="Team of 13: facilitator, decider and three squads of four" style="width:100%;height:auto">`;
  o += `<circle cx="70" cy="34" r="16" fill="none" stroke="var(--marker)" stroke-width="2.5"/><text x="70" y="39" text-anchor="middle" font-size="13" font-weight="700" fill="var(--marker)">F</text><text x="94" y="38" font-size="12" fill="var(--ink)">Facilitator · runs the clock, doesn't vote</text>`;
  o += `<circle cx="70" cy="74" r="16" fill="var(--dot)"/><text x="70" y="79" text-anchor="middle" font-size="13" font-weight="700" fill="#fff">D</text><text x="94" y="78" font-size="12" fill="var(--ink)">Decider · supervote; can sit in a squad</text>`;
  [[90, "A"], [230, "B"], [370, "C"]].forEach(([x, n]) => {
    o += `<rect x="${x - 56}" y="104" width="112" height="76" rx="12" fill="none" stroke="var(--line)" stroke-width="1.5"/><text x="${x}" y="122" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink)">Squad ${n}</text>`;
    [-33, -11, 11, 33].forEach((dx, i) => { o += `<circle cx="${x + dx}" cy="150" r="9" fill="${i === 0 ? "var(--marker)" : "none"}" stroke="var(--ink-2)" stroke-width="1.5"/>`; });
  });
  return o + `<text x="34" y="196" font-size="11" fill="var(--ink-2)">● filled = AI pilot (drives Gemini / NotebookLM, rotates every phase)</text></svg>`;
}

function runSheet(s) {
  return `<div class="agenda">${s.map(b => `<details class="blk" style="--pc:${pc(b.phase)}" ${b.phase === "break" ? "" : ""}>
    <summary><span class="mono muted">${hhmm(b.at)}</span><span class="bar"><b>${esc(b.title)}</b> <span class="muted" style="font-size:.8rem">· ${PHASE[b.phase]} · ${b.min} min</span></span>${b.tools.length ? `<span class="pill" style="color:var(--marker)">${esc(b.tools.map(t => t.name).join(" · "))}</span>` : "<span></span>"}</summary>
    ${b.steps.length || b.output ? `<div class="blk-body">${b.steps.length ? `<ol>${b.steps.map(x => `<li>${esc(x)}</li>`).join("")}</ol>` : ""}${b.output ? `<p class="muted" style="font-size:.86rem"><b>Output:</b> ${esc(b.output)}</p>` : ""}</div>` : ""}
  </details>`).join("")}</div>`;
}

async function howItWorks() {
  document.title = "How it works · AI Sprint Room";
  view.innerHTML = `<div class="empty"><p class="muted">Loading…</p></div>`;
  let d1, ext;
  try { [d1, ext] = await Promise.all([getTemplate("day1"), getTemplate("ext")]); }
  catch (e) { view.innerHTML = `<div class="empty"><h2>Could not load the agenda.</h2><p class="muted">Check your connection and reload.</p></div>`; return; }
  const s1 = sched(d1.blocks), s2 = sched(ext.blocks);
  const start = s1[0].at, end = s1[s1.length - 1].at + s1[s1.length - 1].min, dayLen = end - start;
  const totals = {}; s1.forEach(b => totals[b.phase] = (totals[b.phase] || 0) + b.min);
  const span = p => { const b = s1.filter(x => x.phase === p); return b.length ? `${hhmm(b[0].at)} – ${hhmm(b[b.length - 1].at + b[b.length - 1].min)} · ${hm(totals[p])}` : ""; };
  const hours = []; for (let h = Math.ceil(start / 60); h <= Math.floor(end / 60); h++) hours.push(h);
  let agendaTab = "d1";

  view.innerHTML = `
  <section class="hero">
    <div class="stack" style="gap:16px">
      <span class="scribble">5 days → 1 day</span>
      <h1>Solve one big Pickup & Delivery problem in a single day.</h1>
      <p class="muted" style="font-size:1.1rem;max-width:58ch">A Design Sprint in the style of Jake Knapp, compressed to 8 hours by using Gemini and NotebookLM for research, synthesis and prototyping. Each team ends the day with a prototype tested by real users and presents it on the call. An optional +8h extension turns the winner into a pilot.</p>
      <div class="row"><a class="btn red" href="/run" data-nav>Run my Sprint!</a><a class="btn" href="/prompts" data-nav>See the AI prompts</a></div>
    </div>
    <div class="card" style="padding:14px">${weekToDaySvg(s1)}</div>
  </section>

  <section class="section">
    <h2>The day at a glance</h2>
    <div class="daybar" role="img" aria-label="Day 1 timeline coloured by phase">${s1.map(b => `<div title="${hhmm(b.at)} ${esc(b.title)} (${b.min} min)" style="flex:${b.min};background:${pc(b.phase)};opacity:${b.phase === "break" ? .55 : 1}">${b.min >= 30 && b.phase !== "break" ? `<span>${esc(b.title)}</span>` : ""}</div>`).join("")}</div>
    <div class="dayticks">${hours.map(h => `<span style="left:${(h * 60 - start) / dayLen * 100}%">${String(h).padStart(2, "0")}:00</span>`).join("")}</div>
    <div class="legend">${["map", "sketch", "decide", "prototype", "test"].map(p => `<span><i class="ph-dot" style="background:${pc(p)}"></i>${PHASE[p]} <span class="muted mono">${hm(totals[p] || 0)}</span></span>`).join("")}<span><i class="ph-dot" style="background:${pc("break")}"></i>Breaks and lunch <span class="muted mono">${totals.break || 0} min</span></span></div>
  </section>

  <section class="section">
    <h2>Five steps, same order as the book</h2>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr))">${STEP_CARDS.map(c => `<article class="card phase-card" style="--pc:${pc(c.ph)}">
      ${ILL[c.ph]}<h3>${PHASE[c.ph]}</h3><span class="when">${span(c.ph)}</span>
      <ul>${c.what.map(w => `<li>${esc(w)}</li>`).join("")}</ul>
      <div class="ai-chip"><b>AI</b><span>${esc(c.ai)}</span></div></article>`).join("")}</div>
  </section>

  <section class="section">
    <h2>How the Sprint Room runs the day</h2>
    <ol class="flow">
      <li><b>The facilitator creates the sprint</b><span class="muted">Writes the problem, the initial conditions, the KPI and the sprint questions. Picks the Day 1 agenda (or the +8h extension) and adjusts it.</span></li>
      <li><b>Teams join the lobby</b><span class="muted">Each team opens the app on one laptop, enters the 6-letter code and picks a team name. The room screen shows the code.</span></li>
      <li><b>The facilitator pushes each block</b><span class="muted">Teams see the active block, its steps, the AI prompts ready to copy, and a shared Time Timer. Messages arrive as sticky notes with a sound.</span></li>
      <li><b>Teams signal and present</b><span class="muted">"Done" and "need help" reach the facilitator live. At the end, each team presents its prototype and test results on the call.</span></li>
    </ol>
    <div class="grid g3">
      <div class="card stack" style="gap:6px"><span class="eyebrow">Facilitator console</span><p>Start, pause, extend time, jump to any block, push messages to everyone or one team, see who is online, done or stuck.</p></div>
      <div class="card stack" style="gap:6px"><span class="eyebrow">Team view</span><p>Brief, agenda, active block with tools and prompts, timer, messages. Buttons for "done" and "need help".</p></div>
      <div class="card stack" style="gap:6px"><span class="eyebrow">Room screen</span><p>For the projector: join code in the lobby, then the active block, a big timer, the latest message and who has finished.</p></div>
    </div>
  </section>

  <section class="section">
    <h2>Time it takes</h2>
    <div class="card cmp">
      <span>Classic Sprint</span><div class="bar" style="width:100%;background:var(--p-open)">5 days · ~40 h</div>
      <span>AI Sprint, Day 1</span><div class="bar" style="width:20%;background:var(--marker)">8 h</div>
      <span>With +8h extension</span><div class="bar" style="width:40%;background:var(--p-prototype)">16 h</div>
    </div>
    <p class="muted" style="font-size:.85rem">Bars to scale, per person. Day 1 stands on its own; the extension runs only if Day 1 says "go" or "iterate".</p>
  </section>

  <section class="section">
    <h2>Before, during and after</h2>
    <div class="card" style="overflow-x:auto;padding:8px">${roadmapSvg()}</div>
  </section>

  <section class="section"><div class="grid g2" style="align-items:start">
    <div class="stack" style="gap:12px"><h2>Who does what</h2>
      <p class="muted">13 people: one facilitator, a decider, and three squads of four. Each squad has an AI pilot who drives Gemini or NotebookLM on the shared screen; the role rotates at every phase.</p>
      <div class="card">${teamSvg()}</div></div>
    <div class="stack" style="gap:12px"><h2>Ground rules</h2>
      <ol class="rule-list">
        <li><div><b>Think first, AI second.</b> <span class="muted">Every exercise starts with silent individual work. AI then expands, clusters or challenges it.</span></div></li>
        <li><div><b>Together alone.</b> <span class="muted">Ideas are made individually and shared as a group. No open brainstorming.</span></div></li>
        <li><div><b>No devices.</b> <span class="muted">Only the AI pilots, and everyone during prototyping.</span></div></li>
        <li><div><b>The timer rules.</b> <span class="muted">Side discussions go to the parking lot on the wall.</span></div></li>
        <li><div><b>The decider decides.</b> <span class="muted">Votes and comparisons inform; the supervote settles.</span></div></li>
        <li><div><b>Safe data only.</b> <span class="muted">Anonymised extracts, corporate Gemini and NotebookLM accounts, no customer names or addresses.</span></div></li>
      </ol></div>
  </div></section>

  <section class="section">
    <div class="row between"><h2>Facilitation run-sheet</h2><div class="tabs" role="group" id="agTabs"><button data-ag="d1" aria-pressed="true">Day 1 · 8h</button><button data-ag="d2" aria-pressed="false">Extension · +8h</button></div></div>
    <p class="muted">Every block, its steps, AI tools and expected output. Open a block to see the detail. This is the agenda the Sprint Room pushes to the teams.</p>
    <div class="card" id="agBody">${runSheet(s1)}</div>
  </section>

  <section class="section" style="align-items:center;text-align:center">
    <span class="scribble">ready?</span>
    <div class="row" style="justify-content:center"><a class="btn red" href="/run" data-nav>Run my Sprint!</a></div>
  </section>`;
  view.querySelectorAll("[data-ag]").forEach(b => b.onclick = () => {
    agendaTab = b.dataset.ag; view.querySelectorAll("[data-ag]").forEach(x => x.setAttribute("aria-pressed", x === b));
    $("#agBody").innerHTML = runSheet(agendaTab === "d1" ? s1 : s2);
  });
}

async function promptsPage() {
  document.title = "AI prompts · AI Sprint Room";
  view.innerHTML = `<div class="empty"><p class="muted">Loading…</p></div>`;
  let d1, ext;
  try { [d1, ext] = await Promise.all([getTemplate("day1"), getTemplate("ext")]); }
  catch (e) { view.innerHTML = `<div class="empty"><h2>Could not load the prompts.</h2></div>`; return; }
  const seen = new Map();
  [[d1, "Day 1"], [ext, "Extension"]].forEach(([t, label]) => t.blocks.forEach(b => b.tools.forEach(tool => {
    if (!tool.prompt) return;
    const k = tool.prompt; if (!seen.has(k)) seen.set(k, { ...tool, phase: b.phase, used: [] });
    seen.get(k).used.push(`${label}: ${b.title}`);
  })));
  const all = [...seen.values()];
  let filter = "all";
  const phases = ["all", ...["map", "sketch", "decide", "prototype", "test", "close", "open"].filter(p => all.some(x => x.phase === p))];
  const draw = () => {
    const list = all.filter(x => filter === "all" || x.phase === filter);
    $("#plist").innerHTML = list.map((p, i) => `<article class="card prompt-card">
      <div class="row between"><span class="row" style="gap:6px"><i class="ph-dot" style="background:${pc(p.phase)}"></i><span class="eyebrow">${PHASE[p.phase]}</span></span><span class="pill" style="color:var(--marker)">${esc(p.name)}</span></div>
      <pre>${esc(p.prompt).replace(/\[[A-Z][^\]]*\]|\[[a-z][^\]]*\]/g, m => `<mark>${m}</mark>`)}</pre>
      <p class="muted" style="font-size:.8rem">Used in ${esc(p.used.join(" · "))}</p>
      <div><button class="btn small" data-cp="${all.indexOf(p)}">Copy prompt</button></div></article>`).join("");
    $("#plist").querySelectorAll("[data-cp]").forEach(b => b.onclick = () => copyText(all[+b.dataset.cp].prompt, b));
  };
  view.innerHTML = `<section class="stack" style="gap:10px;padding-block:6px 16px">
    <span class="eyebrow">AI prompt library</span><h1>Prompts for Gemini and NotebookLM, phase by phase.</h1>
    <p class="muted" style="max-width:70ch">The same prompts appear inside each block of a running sprint, with [PROBLEM], [KPI], [GOAL] and [QUESTIONS] filled from the sprint brief. Use corporate accounts and anonymised data only.</p>
    <div class="row" style="gap:6px">${phases.map(p => `<button class="btn small ${p === filter ? "primary" : ""}" data-pf="${p}">${p === "all" ? "All" : PHASE[p]}</button>`).join("")}</div></section>
    <div class="grid g2" id="plist"></div>`;
  view.querySelectorAll("[data-pf]").forEach(b => b.onclick = () => { filter = b.dataset.pf; view.querySelectorAll("[data-pf]").forEach(x => x.classList.toggle("primary", x === b)); draw(); });
  draw();
}
