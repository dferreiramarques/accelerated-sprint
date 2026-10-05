// Agenda templates. Each block: phase, title, minutes, steps, tools (AI prompts), expected output.
// Placeholders in prompts ([PROBLEM], [KPI], [GOAL], [QUESTIONS]) are filled from the sprint brief in the client.

const P = {
  risks: { name: "NotebookLM", prompt: "Which risks or root causes for [PROBLEM] appear in the sources that could stop us reaching this goal: [GOAL]? List each with the source that mentions it." },
  mapCheck: { name: "NotebookLM", prompt: "Here is our process map: [paste steps]. Compare it with the SOPs in the sources. Which steps are missing, in the wrong order, or done differently in practice?" },
  hmw: { name: "Gemini", prompt: "These are 'How might we…' notes from a sprint on [PROBLEM] (photo attached). Transcribe them and group them into 5 to 7 themes with a short title each. Do not rewrite or merge the notes." },
  demos: { name: "Gemini", prompt: "How do companies in other industries (retail, healthcare, aviation, ride-hailing, food delivery) solve a problem like [PROBLEM]? Give 6 concrete examples and the mechanism behind each one." },
  redTeam: { name: "Gemini", prompt: "Act as a sceptical dispatcher with 15 years of experience. Give the 3 strongest reasons this solution would fail on the street, and one change that would fix each:\n\n[describe the sketch]" },
  compare: { name: "Gemini", prompt: "Compare these solutions on impact on [KPI], implementation effort, dependency on existing systems and adoption risk for couriers. Return a table and no recommendation.\n\nA: …\nB: …" },
  story: { name: "Gemini", prompt: "Turn this solution sketch into a 6-frame storyboard for a test with a courier. For each frame give: user, moment, action, screen or object, result.\n\n[describe the sketch]" },
  mockup: { name: "Gemini Canvas", prompt: "Create a clickable HTML mock-up of a mobile app screen flow for couriers with these screens: [list]. Use fictional data only, no backend, large touch targets, works on a phone." },
  fakeData: { name: "Gemini", prompt: "Generate 30 rows of fictional delivery-route data with columns: stop number, time window, address type (residential, business, locker), exception type (none, not home, wrong address, refused, damaged), dwell time in seconds. Return CSV." },
  interview: { name: "Gemini", prompt: "Write a 12-minute interview script to test this prototype with a [courier / dispatcher]. Open questions only, no leading questions. Include 2 tasks the user performs while thinking aloud.\n\nPrototype: …\nSprint questions: [QUESTIONS]" },
  patterns: { name: "NotebookLM", prompt: "Based on the interview notes, which patterns repeat across 2 or more users? Split them into positive, negative and open questions, with a direct quote for each. Then answer each sprint question: yes, no or unclear.\n\nSprint questions: [QUESTIONS]" },
  variations: { name: "Gemini", prompt: "For each problem users hit with our prototype, propose 2 small design variations that could fix it, and say what we would need to test to know which works.\n\n[list problems]" },
  impact: { name: "Gemini", prompt: "Help me estimate the yearly impact of improving [KPI] from [baseline] to [target] in a station handling [volume] stops per day. List every assumption and give conservative, expected and optimistic scenarios." },
  pilot: { name: "Gemini", prompt: "Draft a pilot plan for [solution] in one station: duration, KPIs and how to measure them, baseline, owners, risks, and go/no-go criteria at the end. One page." },
  pitch: { name: "Gemini", prompt: "Here is our pitch to leadership. Point out anything unclear, any claim without evidence, and the question leadership is most likely to ask. Do not rewrite it.\n\n[paste pitch]" }
};

const b = (phase, title, min, steps = [], tools = [], output = "") => ({ phase, title, min, steps, tools, output });

const DAY1 = [
  b("open", "Kick-off", 20, ["Goal of the day and the decision we take at the end", "Ground rules; phones away", "Decider, squads and one AI pilot per squad"], [], "Everyone aligned"),
  b("map", "Long-term goal and sprint questions", 20, ["In two years, why did this problem disappear?", "Decider picks the long-term goal", "Turn the risks into 3 sprint questions"], [P.risks], "Goal and 3 sprint questions"),
  b("map", "Map the process", 20, ["Actors on the left, end result on the right", "5 to 15 steps with arrows", "Check the map against the SOPs"], [P.mapCheck], "Process map"),
  b("map", "Ask the experts", 35, ["3 interviews of 10 minutes", "Everyone writes 'How might we…' notes in silence", "One idea per sticky"], [], "40 to 80 HMW notes"),
  b("map", "Organise HMWs and pick the target", 20, ["Cluster the notes", "2 dots each", "Decider picks ONE target on the map"], [P.hmw], "One target"),
  b("break", "Break", 10),
  b("sketch", "Lightning demos", 30, ["2 references per squad, 3 minutes each", "Capture the big idea of each demo"], [P.demos], "6 references"),
  b("sketch", "Notes and ideas", 25, ["20 min: walk the wall and take notes", "5 min: rough ideas", "Alone, in silence"], [], "Notes per person"),
  b("sketch", "Crazy 8s", 20, ["Fold an A4 into 8 panels", "8 variations in 8 minutes", "Two rounds"], [], "16 variations per person"),
  b("sketch", "Solution sketch", 25, ["Three panels: before, during, after", "Anonymous, self-explanatory, real words", "Catchy title"], [P.redTeam], "One sketch per person"),
  b("break", "Lunch", 60),
  b("decide", "Art museum and heat map", 20, ["Sketches on the wall", "Dots on the strongest details", "No talking"], [], "Heat map"),
  b("decide", "Speed critique", 30, ["3 minutes per sketch", "Standout ideas on stickies", "Author speaks last"], [], "Standout ideas"),
  b("decide", "Straw poll and supervote", 15, ["One vote each", "30 s to explain each vote", "Decider's supervote"], [P.compare], "Winning solution"),
  b("decide", "Storyboard", 20, ["6 frames from problem to result", "Decider approves; not in the story = not built"], [P.story], "Approved storyboard"),
  b("break", "Break", 10),
  b("prototype", "Build the prototype", 60, ["Screens and mock-up", "Data and rules", "Test script and setup"], [P.mockup, P.fakeData, P.interview], "A testable façade"),
  b("prototype", "Trial run", 15, ["Run the script once with a colleague", "Fix what breaks"], [], "Ready to test"),
  b("test", "User interviews", 50, ["3 or 4 interviews of 12 minutes", "One interviewer, everyone observes", "+ positive, − negative, ? doubt"], [], "Observation notes"),
  b("test", "Synthesis", 20, ["Load notes into NotebookLM", "Patterns repeated by 2+ users", "Answer each sprint question"], [P.patterns], "Answers to the sprint questions"),
  b("close", "Team presentations and decision", 15, ["Each team presents on the call (3 min)", "Decider: go, iterate or stop", "Owner and dated next step"], [], "Decision and next step")
];

const EXT = [
  b("open", "Review Day 1 results", 30, ["Read the decision and test notes", "List every problem users hit"], [P.patterns], "List of problems"),
  b("decide", "Prioritise improvements", 60, ["Impact × effort", "2 variations per top problem", "Decider picks the top 5"], [P.variations], "Top 5 improvements"),
  b("prototype", "Prototype v2", 120, ["Higher fidelity", "Squads split by improvement"], [P.mockup, P.fakeData], "Prototype v2"),
  b("break", "Lunch", 60),
  b("test", "Test v2", 60, ["3 to 5 users, same script", "Compare with Day 1"], [P.interview], "Observation notes v2"),
  b("decide", "Business case", 60, ["KPI, baseline, gain, cost", "Three scenarios", "Write down every assumption"], [P.impact], "One-page business case"),
  b("prototype", "Pilot plan", 60, ["Station, duration, metrics", "Owners, risks, go/no-go criteria"], [P.pilot], "Pilot plan"),
  b("close", "Pitch to leadership", 60, ["15 min pitch, 15 min Q&A", "Ask for one clear decision"], [P.pitch], "Pilot decision"),
  b("close", "Retrospective", 30, ["What to repeat, what to change"], [], "Lessons")
];

module.exports = { TEMPLATES: { day1: { name: "Day 1 · 8h sprint", blocks: DAY1 }, ext: { name: "Extension · +8h", blocks: EXT }, blank: { name: "Blank agenda", blocks: [b("open", "Kick-off", 15)] } } };
