# Steady Bubble — Decisions Log

Architectural and process decisions made during the project. Recorded so they are not re-argued in future sessions.

---

## D001 — Bugs are ported, not fixed during migration

**Decision:** If a bug is discovered in V1 code during migration, it is ported into V2 as-is. It is not fixed.

**Why:** The migration has one job — reproduce V1 behavior faithfully. Fixing bugs during migration introduces a second variable: it becomes impossible to tell whether a regression is caused by the restructure or by the fix. This keeps the sign-off criteria clean: V2 passes when it behaves like V1, bugs included.

**How to apply:** When a bug is identified during migration, log it below in the Known Bugs section and continue. Bug fixes are post-migration work, out of scope for V2.

---

## D002 — sim/index.js exceeds 800-line limit (enemy AI embedded)

**Decision:** `sim/index.js` remains at ~1,932 lines after Phase 4 split. The enemy AI section (~1,300 lines of enemy submarine, surface ship, and helicopter behavior logic inside `update()`) stays in place rather than being forcibly extracted.

**Why:** The enemy AI code is tightly coupled to the `update()` orchestration loop — it reads and writes local variables, shares closure state with adjacent sections (torpedo physics, sonar contacts, victory detection), and interleaves with player-facing logic. Extracting it during a structural split would require significant refactoring that risks introducing regressions. The proper home for this code is `ai/behaviors.js` and `ai/` sub-modules per ARCHITECTURE.md, but that is a behavioral refactor, not a structural file split.

**How to apply:** Accept `sim/index.js` as over-limit for Phase 4 sign-off. Schedule the enemy AI extraction as post-migration work alongside the `ai/behaviors.js`, `ai/tactics.js` (group coordination), and `ai/doctrine.js` (per-vessel AI parameters) modules defined in ARCHITECTURE.md.

---

## D003 — render/index.js exceeds 800-line limit (discovered during Phase 4)

**Decision:** `render/index.js` is 1,156 lines. It was not on the original Phase 4 split list (render-panel.js, sim/index.js, damage.js, comms.js, ai/index.js) because it was not identified as a monster file during Phase 3 planning.

**Why:** The `draw()` function contains sonar contact rendering, torpedo trail drawing, explosion effects, and other visual elements that grew during the Phase 3 full port. It was not flagged because Phase 3 focused on getting the game running, and the file size wasn't audited until Phase 4 verification.

**Corrective action:** Split `render/index.js` during Phase 4 before sign-off. Extract sonar contact drawing, torpedo/weapon visuals, and effect rendering into sub-modules under `src/render/`. Target: all files under 800 lines.

**Resolution:** Split completed. `render/index.js` reduced from 1,156 → 759 lines. Two new files created: `render-contacts.js` (289 lines — sonar bearing lines, TMA visualization, towed array bearings) and `render-weapons.js` (246 lines — torpedo trails, wire lines, ASROC, cruise missiles, depth charges, CWIS tracers). Build verified clean.

---

## D004 — render/index.js sub-modules not in ARCHITECTURE.md

**Decision:** `render-contacts.js` and `render-weapons.js` are not defined in ARCHITECTURE.md. They were created as a corrective action for D003.

**Why:** ARCHITECTURE.md defines `render/index.js` as the draw orchestrator but doesn't prescribe further sub-modules. The 800-line limit required extraction. Sonar contacts and weapon visuals were chosen because they are self-contained draw-only sections with clear boundaries — no shared local state with adjacent code.

**How to apply:** Update ARCHITECTURE.md to include these files if the project continues beyond migration. For now they are documented here.

---

## Known Bugs (ported knowingly)

| ID | Description | V1 Location | Logged |
|---|---|---|---|
| — | None logged yet | — | — |
