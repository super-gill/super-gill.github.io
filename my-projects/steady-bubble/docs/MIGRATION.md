# Steady Bubble — Migration Plan & Status

## Reference

- **V1 source:** `../subgame2/` (do not modify)
- **V2 source:** `../steady-bubble/src/` (working copy)
- **Ground truth:** V1 behavior. V2 must match it exactly at the end of each phase.

---

## Current Status

**Phase:** 4 — Split & Clean
**Phase:** Post-migration — Casualty system upgrade
**State:** All 4 migration phases complete. Casualty upgrade (CASUALTY-UPGRADE.md) implemented — all 8 phases.
**Last session:** 2026-03-19 — Casualty upgrade: 6 new casualties + 2 enhancements implemented. 60 modules, build clean. D005–D006 logged.
**Next session starts at:** Playtesting casualty upgrade. DC panel display updates for new state (h2Level, cl2Level, hydPressure, hotRunCountdown, stuckPlanes). Render-dc.js changes deferred for Jason review.

---

## Phase Overview

| Phase | Name | Description | Status |
|---|---|---|---|
| 0 | Documentation | CLAUDE.md, ARCHITECTURE.md, MIGRATION.md | **Complete** |
| 1 | Setup | Vite, index.html, port pure utility files | **Complete** |
| 2 | State | New state structure, update all references | **Complete** |
| 3 | Full Port | Port ALL V1 files as ES6 modules (systems + AI + render) | **Complete** |
| 4 | Split & Clean | Split monster files, enforce 800-line limit | **Complete** |

**Rule:** Do not start a phase until Jason has confirmed the previous phase plays correctly.

---

## Phase 0 — Documentation

**Goal:** Establish all project guardrails before any code is written.

- [x] Create `steady-bubble/` directory
- [x] Write `CLAUDE.md`
- [x] Write `docs/ARCHITECTURE.md`
- [x] Write `docs/MIGRATION.md`
- [x] Write `docs/DECISIONS.md` — created with D001 (bug policy)
- [x] Jason reviews and approves all three docs

**Sign-off:** Complete — 2026-03-15

---

## Phase 1 — Setup

**Goal:** Runnable Vite project with the pure utility files ported. The game does not run yet — this phase is scaffolding only.

**Files to create:**
- `package.json`
- `vite.config.js`
- `index.html`
- `src/main.js` (stub — game loop wired but not functional)
- `src/config/constants.js` ← from `subgame2/js/config.js`
- `src/utils/math.js` ← from `subgame2/js/math.js`
- `src/utils/maps.js` ← from `subgame2/js/maps.js`
- `src/ui/theme.js` ← from `subgame2/js/theme.js`
- `src/ui/ui-scale.js` ← from `subgame2/js/ui-scale.js`
- `src/ui/keybindings.js` ← from `subgame2/js/keybindings.js`

**Sign-off criteria:** `npm run dev` starts without errors. Browser shows a blank ocean-blue canvas with no console errors.

**Sign-off:** Complete — 2026-03-18

---

## Phase 2 — State

**Goal:** New state structure in place. All three state modules exist and are populated. The game loop calls update and draw against the new state. Game may not fully function yet but should not crash.

**Files to create:**
- `src/state/sim-state.js`
- `src/state/ui-state.js`
- `src/state/session-state.js`

**V1 mapping:** `subgame2/js/state.js` → split across all three state files per ARCHITECTURE.md

**Sign-off criteria:** Game loop runs, player submarine appears on screen, no console errors.

**Sign-off:** Complete — 2026-03-18

---

## Phase 3 — Full Port (Systems + AI + Render)

**Goal:** All V1 code ported as ES6 modules. Game is fully playable. File splitting deferred to Phase 4.

**Revised approach:** Originally Phases 3/4/5 were sequential, but the game can't run without ALL systems, AI, and render ported together. So they're merged into a single "get it running" phase. Each V1 file becomes one V2 module (no splitting yet). Splitting is Phase 4.

**Files — ported (✅) vs remaining (⬜):**

Systems:
- ✅ `src/systems/signature.js` ← `signature.js`
- ✅ `src/systems/missile.js` ← `missile.js`
- ✅ `src/systems/torpedo.js` ← `torpedo.js`
- ✅ `src/systems/weapons.js` ← `weapons.js`
- ✅ `src/systems/sensors.js` ← `sensors.js`
- ✅ `src/systems/nav.js` ← `nav.js`
- ✅ `src/systems/damage.js` ← `damage.js` (2,666 lines — biggest systems file)

Simulation:
- ✅ `src/sim/index.js` ← `sim.js` (2,831 lines — orchestrator)

AI:
- ✅ `src/ai/index.js` ← `ai.js` (963 lines — port as-is, split later)

Narrative:
- ✅ `src/narrative/comms.js` ← `comms.js` (~2,500 lines — all voice templates)

UI:
- ✅ `src/ui/input.js` ← `input.js`
- ✅ `src/ui/panel.js` ← `panel.js`

Render:
- ✅ `src/render/render-utils.js` ← `render-utils.js`
- ✅ `src/render/render-world.js` ← `render-world.js`
- ✅ `src/render/render-hud.js` ← `render-hud.js`
- ✅ `src/render/render-panel.js` ← `render-panel.js` (4,413 lines — port as-is, split later)
- ✅ `src/render/index.js` ← `render.js`
- ✅ `src/dev-panel.js` ← `dev-panel.js`

**Cross-cutting:** main.js must be updated last to wire all imports.

**Sign-off criteria:** Full playthrough of a scenario to completion with no regressions. Jason playtests.

**Sign-off:** Complete — 2026-03-19

---

## Phase 4 — Split & Clean

**Goal:** Split the monster files (render-panel.js, damage.js, sim.js, ai.js, comms.js) into the target architecture structure. No file over 800 lines. This is now the cleanup phase.

**Sign-off criteria:** All files under 800 lines. Game still plays correctly. Jason signs off.

**Sign-off:** Complete — 2026-03-19. sim/index.js (1,932 lines) accepted over-limit per D002.

---

## Migration Complete When

- All phases signed off by Jason
- `npm run build` produces a clean build with no warnings
- Full playthrough of all scenarios matches V1 behavior
- No file in `src/` exceeds 800 lines
- `subgame2/` (V1) can be archived

---

## Session Log

| Date | Phase | What Was Done |
|---|---|---|
| 2026-03-15 | 0 | Project named Steady Bubble. Directory created. CLAUDE.md, ARCHITECTURE.md, MIGRATION.md, DECISIONS.md written. Bug policy established (D001). Phase 0 signed off. |
| 2026-03-15 | 1 | package.json, vite.config.js, index.html, src/main.js (stub), src/config/constants.js, src/config/vessels.js, src/config/scenarios.js (stub), src/utils/math.js, src/utils/maps.js, src/ui/ui-scale.js, src/ui/theme.js, src/ui/keybindings.js all written. Node.js not installed — Jason to install before running. |
| 2026-03-18 | 1 | Node.js installed. Favicon 404 fixed. Phase 1 signed off by Jason — blank ocean canvas, zero console errors. |
| 2026-03-18 | 2 | sim-state.js, ui-state.js, session-state.js created. V1 state.js fully mapped: player/entities/world/cam/tdc → sim-state, score/mission/watch/logs → session-state, panels/scrolls/UI → ui-state. main.js updated with game loop + stub draw. Phase 2 signed off by Jason. |
| 2026-03-18 | 3 | Phase 3 started. Phases 3/4/5 merged into single port phase (game needs ALL files to run). All V1 files read. Ported: signature.js, missile.js, render-utils.js, input.js. Circular dependency strategy: lazy binding via _bind* functions. ~11 files remain. |
| 2026-03-18 | 3 | Ported all remaining 12 files: comms.js, ai.js, weapons.js, torpedo.js, sensors.js, nav.js, panel.js, damage.js (2,666 lines), sim.js (2,831 lines), render-world.js, render-hud.js, render.js (1,158 lines), dev-panel.js (638 lines). render-panel.js (4,413 lines) completed. All window.* globals removed. State split into sim-state/session-state/ui-state. main.js wired. |
| 2026-03-19 | 3 | Alpha playtest by Jason. Fixed: missing exports (input, missile, render-utils, signature), module init ordering (SIM.reset), state object mismatches (session vs ui for wepsProposal, wirePanel, tdc), lazy binding timing (_reserveTube, _onWireCut, _orderLoad etc via closures), dead enemy splice removed. 36 bugs logged (B001-B036) covering visual, gameplay, design, and critical issues. Game is playable — scenarios load, enemies spawn, torpedoes fire, wire guidance works, TMA builds solutions, damage/DC system functional. |
| 2026-03-19 | 3→4 | Phase 3 signed off. Phase 4: split all 5 monster files + D003 corrective split. ~30 new files. render/index.js (1,156→759+289+246). sim/index.js accepted over-limit (D002). Build clean (59 modules). D002–D004 logged. Phase 4 signed off. Migration complete. |
| 2026-03-19 | Post | Casualty system upgrade per CASUALTY-UPGRADE.md. All 8 phases implemented: (1) electrical fire, (2) hydraulic pressure, (3) stuck planes, (4) shaft seal, (5) hydrogen/explosion, (6) hot run torpedo, (7) snorkel flood, (8) chlorine gas. New file: sim/casualty-ticks.js (505 lines). New systems: vent_plant, battery_bank (now all vessels). New state: hydPressure, h2Level, cl2Level, stuckPlanes, shaftSealLeak, hotRunCountdown, snorkelFloodActive, permanentDamage. constants.js expanded with 8 casualty config blocks. Voice templates added to voice-ops.js + voice.js. Build clean (60 modules). D005–D006 logged. |
