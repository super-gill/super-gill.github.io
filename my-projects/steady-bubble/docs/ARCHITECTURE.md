# Steady Bubble — Target Architecture

## Overview

V2 uses **Vite** as the bundler and **ES6 modules** (`import`/`export`) throughout. There are no globals, no `window.*` exports, and no script-tag load order dependencies.

The game loop architecture is unchanged from V1: `requestAnimationFrame → SIM.update(dt) → R.draw()`.

---

## Directory Structure

```
steady-bubble/
├── index.html              ← Vite entry point (minimal, one script tag)
├── package.json
├── vite.config.js
├── docs/                   ← Project documentation (not shipped)
│   ├── ARCHITECTURE.md
│   ├── MIGRATION.md
│   └── DECISIONS.md
└── src/
    ├── main.js             ← Game loop entry point
    │
    ├── config/
    │   ├── constants.js    ← All gameplay constants (from V1 config.js)
    │   ├── vessels.js      ← Vessel definitions as data (688i, Trafalgar, etc.)
    │   └── scenarios.js    ← Scenario definitions as data
    │
    ├── state/
    │   ├── sim-state.js    ← Physics, positions, systems (pure game logic state)
    │   ├── ui-state.js     ← Panel tabs, scroll positions, overlay flags
    │   └── session-state.js← Score, mission time, scenario, started flag
    │
    ├── sim/
    │   ├── index.js        ← SIM.update(dt) — orchestrates sub-systems
    │   ├── player-physics.js   ← Depth, speed, buoyancy, trim
    │   ├── player-control.js   ← Input → player orders
    │   └── scenario.js         ← Spawn logic, win/loss conditions
    │
    ├── ai/
    │   ├── index.js        ← AI coordinator, per-enemy update dispatch
    │   ├── perception.js   ← What an enemy can detect and how well
    │   ├── behaviors.js    ← State handlers: patrol, hunt, attack, evade
    │   ├── tactics.js      ← Group coordination, wolfpack prosecution
    │   ├── doctrine.js     ← Per-vessel-type AI personality/parameters
    │   └── spawn.js        ← Enemy factory functions (no copy-paste)
    │
    ├── systems/
    │   ├── sensors/
    │   │   ├── sonar.js        ← Passive detection, signal strength
    │   │   ├── tma.js          ← TMA solver (isolated)
    │   │   └── active-ping.js  ← Active sonar ping mechanics
    │   ├── weapons/
    │   │   ├── fire-control.js ← TDC, fire solutions, weapon selection
    │   │   ├── torpedo.js      ← Torpedo physics and seeker logic
    │   │   └── missile.js      ← Anti-ship missile mechanics
    │   ├── damage/
    │   │   ├── crew-roster.js  ← Crew as static data (names, roles, stations)
    │   │   ├── casualty.js     ← Casualty logic, severity, escalation
    │   │   ├── flooding.js     ← Flooding mechanics, spread, pumps
    │   │   ├── fires.js        ← Fire mechanics, spread, suppression
    │   │   └── dc-teams.js     ← DC team dispatch, pathfinding, repair
    │   ├── nav.js              ← Navigation, waypoints, route planning
    │   └── signature.js        ← Acoustic noise calculation
    │
    ├── narrative/
    │   ├── comms.js            ← Message queue, log management
    │   └── voice.js            ← Per-station dialog templates
    │
    ├── render/
    │   ├── index.js            ← R.draw() — render orchestrator
    │   ├── render-world.js     ← Map, land, route, units, torpedoes
    │   ├── render-hud.js       ← Depth strip, compass, threat bar
    │   ├── render-utils.js     ← Drawing primitives, world-to-screen transform
    │   └── panels/
    │       ├── render-start.js     ← Vessel/scenario selection screen
    │       ├── render-log.js       ← Message log panel
    │       ├── render-dc.js        ← Damage control panel
    │       ├── render-crew.js      ← Crew status panel
    │       └── render-endscreen.js ← Victory/defeat screen
    │
    └── ui/
        ├── input.js        ← Keyboard/mouse event handlers
        ├── panel.js        ← Click dispatch, button registry
        ├── keybindings.js  ← Input mapping registry
        ├── theme.js        ← Color/typography/spacing tokens
        └── ui-scale.js     ← DPI/zoom scaling utility
```

---

## State Design

V1 uses a single `window.G` object mixing game logic, UI state, and temporary collections. V2 separates these into three modules with clear ownership.

### `src/state/sim-state.js` — Game Logic State
Everything the simulation needs to run. Renderers read this but do not write it (except render functions that need to write back UI reactions — those go to ui-state).

```
player:       { wx, wy, heading, speed, depth, vy, hp, noise, systems... }
enemies:      []
bullets:      []
particles:    []
decoys:       []
buoys:        []
missiles:     []
wrecks:       []
sonarContacts: Map
world:        { w, h, seaLevel, layerY1, layerY2 }
cam:          { x, y, zoom }
```

### `src/state/ui-state.js` — UI State
Everything the render layer needs that is not game logic.

```
logTab:           'log' | 'dc'
showDcPanel:      boolean
showDamageScreen: boolean
contactsScroll:   number
vesselScrollY:    number
startPhase:       'scenario' | 'vessel'
hoverTarget:      any
```

### `src/state/session-state.js` — Session State
Mission-level data that sits between simulation and UI.

```
started:        boolean
over:           boolean
score:          number
missionT:       number
scenario:       string
vesselKey:      string
tacticalState:  'cruising' | 'patrol' | 'action'
casualtyState:  'normal' | 'emergency' | 'escape'
msgLog:         []   (capped at 120)
dcLog:          []   (capped at 120)
sonarLog:       []
activeWatch:    'A' | 'B'
watchFatigue:   number
```

---

## Module Contract

Every module must:
- Use named exports only (no default exports)
- Import only what it needs (no importing entire state objects)
- Not write to state it doesn't own (sim writes sim-state, UI writes ui-state)
- Not reach across domain boundaries (render modules do not call simulation functions)

### Import Direction Rules

```
config      ← imported by everyone, imports nothing
state/*     ← imported by sim/*, ai/*, systems/*, render/*, ui/*
systems/*   ← imported by sim/*, ai/*
sim/*       ← imported by main.js only
ai/*        ← imported by sim/*
render/*    ← imported by main.js only
ui/*        ← imported by main.js, render/*
narrative/* ← imported by sim/*, systems/damage/*
```

Render modules must **never** import from `sim/` or `ai/`. They read state and draw. That's all.

---

## File Size Target

No file should exceed **800 lines**. If a file approaches that limit during development, it should be split before continuing. This is a hard constraint, not a guideline.

---

## Game Loop (Unchanged from V1)

```javascript
// src/main.js
import { update } from './sim/index.js';
import { draw } from './render/index.js';

function step() {
  const t = performance.now();
  const dt = Math.min(0.033, (t - lastT) / 1000);
  lastT = t;
  update(dt);
  draw();
  requestAnimationFrame(step);
}

requestAnimationFrame(step);
```
