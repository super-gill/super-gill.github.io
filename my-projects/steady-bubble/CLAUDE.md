# Steady Bubble — Claude Briefing

## What This Project Is

**Steady Bubble** is a browser-based submarine warfare simulation game built on HTML5 Canvas with vanilla JavaScript. It is a structural migration of **subgame2** (Doodle Sub: Captain Sim v5), located at:

```
../subgame2/
```

V1 (subgame2) is the behavioral ground truth. V2 (Steady Bubble) must be functionally identical to V1 when migration is complete. No new features are in scope during migration.

---

## Team Structure

| Role | Who |
|---|---|
| Project Manager / Creative Director | Jason (the user) |
| Dev Team | Claude (you) |

**This boundary is strict.**

- Jason does not touch code.
- Claude does not make creative or feature decisions.
- If Claude encounters a decision that affects gameplay, feel, or scope — stop and ask.
- If Claude encounters a structural/technical decision — make it, log it in `docs/DECISIONS.md`, continue.

---

## Your Standing Instructions

1. **Read `docs/MIGRATION.md` at the start of every session** before doing anything. It tells you where you are.
2. **Read `docs/ARCHITECTURE.md` before making any structural decision.** All code must conform to the target architecture.
3. **Update `docs/MIGRATION.md` at the end of every session.** Mark completed tasks, set the next session's starting point. This is non-negotiable — it is how continuity is maintained across your memory loss between sessions.
4. **Log decisions in `docs/DECISIONS.md`.** Any technical decision that could be argued either way, or that future-you might question, gets recorded there with rationale.
5. **Do not start a phase until the previous phase is confirmed working by Jason.** Playtesting and sign-off between phases is Jason's responsibility.
6. **Do not modify subgame2 (V1).** It is the reference, not the working copy.
7. **Do not fix bugs during migration.** If a bug is found in V1 code, port it as-is and log it in `docs/DECISIONS.md` under Known Bugs. Bug fixes are post-migration work. (See D001)

---

## What V2 Is and Is Not

**V2 IS:**
- The same game, same mechanics, same feel, same content
- Restructured into ES6 modules with Vite as the bundler
- Split into logical, maintainable files (no file over ~800 lines)
- Properly separated state (sim state vs UI state vs session state)
- Structured to support future development in: realism, simulation depth, smarter AI

**V2 IS NOT:**
- A feature update
- A visual redesign
- A gameplay change of any kind
- An opportunity to "improve" things that aren't structural

---

## Technology Stack

- **Bundler:** Vite (zero-config, no framework)
- **Language:** Vanilla JavaScript, ES6 modules (`import`/`export`)
- **Rendering:** HTML5 Canvas 2D context (unchanged from V1)
- **Runtime:** Browser only, no Node.js at runtime
- **Testing:** Manual playtesting by Jason (no automated test suite)

---

## Key Paths

| Thing | Path |
|---|---|
| V2 project root | `my-projects/steady-bubble/` |
| V1 reference | `my-projects/subgame2/` |
| V2 source | `my-projects/steady-bubble/src/` |
| V2 docs | `my-projects/steady-bubble/docs/` |
| Migration status | `my-projects/steady-bubble/docs/MIGRATION.md` |
| Target architecture | `my-projects/steady-bubble/docs/ARCHITECTURE.md` |
| Logged decisions | `my-projects/steady-bubble/docs/DECISIONS.md` |
