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

## D005 — New casualty tick functions extracted to sim/casualty-ticks.js

**Decision:** All 7 new casualty tick functions (tickSnorkelFlood, tickChlorine, tickHotRun, tickStuckPlanes, tickShaftSeal, tickHydraulic, tickHydrogen) are placed in a new file `src/sim/casualty-ticks.js` (505 lines) rather than in `player-physics.js`.

**Why:** Adding ~560 lines of new casualty systems to player-physics.js (279 lines) would have pushed it to 836 lines, exceeding the 800-line limit. The new casualties are a distinct system group (non-combat runtime casualties) with their own lazy bindings (COMMS, DMG, broadcastTransient), making them a natural split point. player-physics.js retains the original reactor/coolant/steam/turbine casualty ticks and nav/sig/watch systems.

**How to apply:** casualty-ticks.js is bound via `bindCasualtyTicks()` from sim/index.js. It follows the same lazy binding pattern as player-physics.js. ARCHITECTURE.md should be updated to include this file.

---

## D006 — damage/index.js at 830 lines (over 800-line limit)

**Decision:** `damage/index.js` is at 830 lines after the casualty upgrade, exceeding the 800-line limit by 30 lines.

**Why:** The casualty upgrade added ~125 lines of combat triggers to the `hit()` function (hot run check, stuck planes check, shaft seal check, snorkel flood flag, hydrogen ignition check, hydraulic pressure loss) plus new state properties in `initDamage()`. These triggers must live inside `hit()` because they fire on combat hit events. Extracting them would require splitting `hit()` across files, which would fragment the combat damage flow and make the code harder to follow.

**How to apply:** Accept damage/index.js at 830 lines. If further growth pushes it higher, extract `initDamage()` and the escape system into a separate `damage/init.js` or `damage/escape.js`.

---

## D007 — battery_bank system changed from dieselOnly to all vessels

**Decision:** The `battery_bank` system definition in `damage-data.js` was changed from `dieselOnly: true` to available on all vessel types.

**Why:** The hydrogen buildup and explosion casualty (CASUALTY-UPGRADE.md Section 6) requires tracking battery state on nuclear boats. Nuclear boats carry batteries for EPM (emergency propulsion mode). When the battery bank is destroyed by a hydrogen explosion, EPM becomes unavailable — a subsequent reactor SCRAM means zero propulsion. The battery room is `engine_room_d1` for all vessel types.

**How to apply:** Nuclear boats now have `battery_bank` as a damageable system. It appears in WTS 5 system lists and can be damaged by combat, flooding, or hydrogen explosion. Effects on diesel boats are unchanged.

---

## Known Bugs (ported knowingly)

| ID | Description | V1 Location | Logged |
|---|---|---|---|
| — | None logged yet | — | — |
