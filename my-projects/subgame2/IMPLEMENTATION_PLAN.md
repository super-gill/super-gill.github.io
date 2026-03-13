# Implementation Plan — Depth, Compartments & Unified Damage Panel

*Reference document. If context is lost, start here.*

---

## Housekeeping

- Boat name: fictional, HMS prefix is fine. **Do not use Vanguard-class names (SSBNs)**. Do not use real RN submarine pennant numbers.
- All files are IIFEs exposing globals (`window.DMG`, `window.COMMS`, etc.)
- Primary files touched by this plan: `config.js`, `damage.js`, `sim.js`, `comms.js`, `render-panel.js`, `ai.js`, `sensors.js`

---

## Phase 1 — Compartment Expansion

### 1a. Add two new compartments to `damage.js`

Expand `COMPS` array from 5 to 7:

```
fore_ends → fwd_accomm → control_room → reactor_comp → engine_room → motor_room → aft_ends
```

New compartments:
- **`fwd_accomm`** — Forward Accommodation. Junior rates mess, bunks, off-watch crew space. High crew count, few systems. DC Alpha natural home moves here. Medical triage point at action stations.
- **`motor_room`** — Motor Room / After Machinery. Electric motor, shaft, final drive. Propeller shaft seal failure belongs here (not engine_room). Towed array housing also here.

Update:
- `COMP_DEF` — add labels, systems, crewCount, tower assignments
- `TRAVEL` table — full 7×7 matrix. Reactor crossing penalty (28s) remains. Motor room is adjacent to engine_room and aft_ends.
- `EVAC_TO` — update adjacency for all 7 compartments
- `SYS_LABEL` — no changes needed, systems stay as-is
- Crew manifest — redistribute crew into new compartments (fwd_accomm gets off-watch ratings from fore_ends; motor_room gets a small engineering party from engine_room/aft_ends)

### 1b. Update crew manifest

Approximate target headcounts (total remains 90):
- fore_ends: 20 (down from 30 — torpedo specialists, sonar ratings)
- fwd_accomm: 18 (off-watch accommodation, DC Alpha home)
- control_room: 22 (unchanged)
- reactor_comp: 3 (unchanged)
- engine_room: 15 (down from 20)
- motor_room: 7 (new — CPOMEM + ERA party)
- aft_ends: 5 (down from 15 — steering/towed array watchkeepers)
- medical: 2 (O'Connor, Hayes — unchanged)
- supply: 5 (Taylor + 4 — unchanged)

DC Alpha home: fwd_accomm
DC Bravo home: motor_room (was aft_ends — better aft coverage)

---

## Phase 2 — Displaced Crew Physical Relocation

### Current problem
Evacuated crew have `displaced:true` but remain in their original compartment's `d.crew[comp]` array. Medics can't find them. If the destination compartment floods, they're not included in that evacuation.

### Fix
When crew evacuate compartment A → B (via `EVAC_TO`):
- Move them physically: remove from `d.crew[A]`, push into `d.crew[B]` with `displaced:true`
- `displaced:true` means: present in B, does not count as effective watchkeeper or DC capacity in B
- If B then floods, they evacuate again in the next chain (normal evacuation logic picks them up)
- Medics scan all compartments and will find displaced wounded crew where they physically are

### Triage point
Wounded displaced crew do not auto-walk to triage — medics go to them. "Triage" is implicit:
- Action stations: wounded tend to accumulate in `control_room` (XO/COX'N coordinate)
- Cruise: `fwd_accomm` (space, LMA nearby)
No explicit triage mechanics needed yet — just the physical relocation fix.

---

## Phase 3 — Watertight Doors (WTDs)

### State model
Add `d.wtd` object to damage state — one entry per door:

```js
d.wtd = {
  'fore_ends|fwd_accomm':    { state: 'open' },   // 'open' | 'closed' | 'damaged'
  'fwd_accomm|control_room': { state: 'open' },
  'control_room|reactor_comp':{ state: 'open' },
  'reactor_comp|engine_room': { state: 'open' },
  'engine_room|motor_room':  { state: 'open' },
  'motor_room|aft_ends':     { state: 'open' },
}
```

Key: always `[fore comp]|[aft comp]` alphabetically or bow-to-stern order — consistent.

### Automatic state changes
- On **action stations** (`tacticalState → 'action'`): all WTDs close automatically. Comms: *"Conn, all watertight doors closed."*
- On **stand down** from action: WTDs reopen. Comms: *"Watertight doors open. Cruising state."*
- Player can manually toggle any WTD via the DMG panel at any time.

### Effect on transit
DC teams and medics crossing a **closed** WTD add a penalty to their transit time (+10s per closed door crossed). This is calculated in `_dispatchMedStaff` and `assignTeam` at dispatch time using the current WTD states.

### Flooding spread
When a compartment's `floodRate > 0` and the adjacent WTD is **open**:
- Adjacent compartment receives spillover at `floodRate * 0.15` (slow bleed unless primary breach is massive)
- Once primary compartment reaches `flooded=true` (fully flooded), spillover rate increases to `floodRate * 0.40`
- Player closes WTD → spillover stops immediately
- **Closing a WTD traps any crew on the flooded side** — they are marked `displaced` and cannot evacuate further

### Fire boundaries
Fire does **not** spread through WTDs regardless of state. Each compartment is its own fire zone. (WTD state irrelevant to fire spread — realistic.)

### Damaged WTDs
A hit in a compartment has a small chance of damaging the adjacent WTD (`state: 'damaged'`). A damaged WTD cannot be closed — flooding will spread regardless. Comms: *"WTD [location] damaged — cannot seal."* Repairable by DC team as a system.

---

## Phase 4 — Depth Brackets & Collapse

### Config values (add to `config.js` under `sub` or new `depths` block)

```js
depths: {
  operational: 300,   // OD — peacetime/cruise ceiling
  test:        450,   // test depth — action stations ceiling
  design:      520,   // design depth — emergency evasion only, casualties possible
  collapse:    620,   // crush depth — instant game over, unrecoverable
}
```

Values are arbitrary but proportionally realistic (RN nuclear boat approximate).

### Depth warnings (in `sim.js` tickDepth or new `_tickDepthStress`)

| Condition | Comms |
|---|---|
| Exceed OD outside action stations | *"Conn, depth 310m — below operational depth. Request shallower."* (one-time per exceedance) |
| Exceed OD at action stations | Silent — test depth is the limit |
| Exceed test depth at action stations | *"Conn, passing test depth. Hull stress increasing."* (one-time) |
| Exceed design depth | *"Conn — passing design depth. Structural integrity at risk."* (continuous comms every 30s) |
| Approach collapse (within 20m) | *"Conn — HULL STRESS CRITICAL. Collapse imminent."* (urgent, every 10s) |
| Reach collapse depth | Trigger game over — implosion event |

### Collapse event
- Sets `game.over = true` with cause `'collapse'`
- Distinct from flooding game-over (which is gradual)
- No player agency — instantaneous
- Debrief/end screen should distinguish implosion from sinking

### Reactor SCRAM tie-in (existing)
SCRAM already fires at depth. Review current threshold and align with new bracket values.

---

## Phase 5 — Overstress Flooding (Hull Penetration Failures)

### Trigger
When `player.depth > CONFIG.depths.design`, a stress tick fires every **30s** (timer: `d._stressTickT`).

Each tick: roll against each penetration in a table. Probability scales with how far past design depth.

```
depthOverrun = (player.depth - CONFIG.depths.design) / (CONFIG.depths.collapse - CONFIG.depths.design)
// 0.0 at design depth, 1.0 at collapse
rollChance = depthOverrun * 0.25   // max 25% per penetration per 30s tick at near-collapse
```

### Hull penetration table

| ID | Compartment | System forced offline/degraded | Comms |
|---|---|---|---|
| `tube_seal` | fore_ends | tubes → degraded (or offline if already degraded) | *"Torpedo room — tube seal failure, flooding. Tubes offline."* |
| `mast_gland` | control_room | periscope → degraded | *"Control room — mast gland failure, flooding."* |
| `shaft_seal` | motor_room | propulsion → degraded | *"Motor room — shaft seal failure, flooding."* |
| `fwd_planes_hyd` | fore_ends | planes_fwd_hyd → offline | *"Torpedo room — forward planes hydraulic seal, flooding."* |
| `aft_planes_hyd` | aft_ends | planes_aft_hyd → offline | *"After ends — aft planes hydraulic seal, flooding."* |
| `towed_array_hsg` | motor_room | towed_array → degraded | *"Motor room — towed array housing breach, flooding."* |
| `sonar_dome` | fore_ends | sonar_hull → degraded | *"Torpedo room — sonar dome stress fracture. Sonar degraded."* (no flood, just system) |

Each penetration can only fire once per depth exceedance session (gate flag per entry). Resetting when depth returns above design depth.

### Flood rate scaling with depth
When a breach already exists (floodRate > 0), apply depth multiplier to the rate:

```js
const depthFactor = 1 + (player.depth / CONFIG.depths.design) * 4;
// At surface: ×1. At design depth: ×5. At collapse: ×~7.
```

Applied in `_tickFlood` when calculating inflow. DC teams fighting the breach are therefore fighting a losing battle until depth decreases — ascending is the correct tactical response.

---

## Phase 6 — Acoustic Depth Penalty

When `player.depth > CONFIG.depths.test`, hull stress creaking increases noise signature.

```js
const depthStressNoise = player.depth > C.depths.test
  ? (player.depth - C.depths.test) / (C.depths.collapse - C.depths.test) * 0.25
  : 0;
// Adds up to 0.25 to player noise at near-collapse depth
```

Apply in the noise calculation in `sim.js` (or wherever `player.noise` is computed). This means deep diving to evade sonar contact actually makes you *louder* past test depth — the intended tactical dilemma.

---

## Phase 7 — Unified Full-Screen Damage Panel

### Replaces
- Embedded DMG CTRL section in right HUD panel (removed)
- `[Y]` crew overlay (removed, merged here)
- New trigger: `[D]` key / DMG button

### Layout (canvas, full screen overlay)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  [HMS ████████]  DAMAGE CONTROL              Watch A  ████░░ 47%   [RELIEVE WATCH]  [CLOSE X] │
├────────────────────────────────────────────────────────────────────────┬─────────────────────┤
│                       SUBMARINE SCHEMATIC                              │   DC ALPHA           │
│  ┌────────┬────────┬──────────┬───────┬──────────┬────────┬────────┐  │   state / location   │
│  │  FORE  │  FWD   │  CTRL RM │ REACT │  ENG RM  │ MOTOR  │  AFT   │  │   dispatch buttons   │
│  │  ENDS  │ ACCOMM │          │  COMP │          │   RM   │  ENDS  │  ├─────────────────────┤
│  │  █░░   │        │          │  ▓▓▓  │          │        │        │  │   DC BRAVO           │
│  └──▼WTD──┴──▼WTD──┴───▼WTD───┴─▼WTD─┴───▼WTD───┴──▼WTD──┴────────┘  │   state / location   │
├────────────────────────────────────────────────────────────────────────┤   dispatch buttons   │
│                       CREW BY COMPARTMENT                              ├─────────────────────┤
│  FORE ENDS    FWD ACCOMM   CTRL RM    ENG RM    MOTOR RM   AFT ENDS   │   MEDICAL            │
│  B col│A col  B col│A col  B col│A col  ...      ...        ...       │   LMA / MA state     │
│  names        names         names                                      ├─────────────────────┤
│                                                                        │   SYSTEMS GRID       │
│  ─── SHIP SUPPORT ─────────────────────────────────────────────────── │   TUBES    ████      │
│  MEDICAL  O'Connor · Hayes                                             │   SONAR    ██░░      │
│  SUPPLY   Taylor · MacKay · Wright · Cross · Reed                      │   PERSCPE  ████      │
│                                                                        │   BALLAST  ████      │
│                                                                        │   TDC      ████      │
│                                                                        │   REACTOR  ████      │
│                                                                        │   PROPULSN ████      │
│                                                                        │   STEERING ████      │
│                                                                        │   TWD ARR  ██░░      │
│                                                                        │   FWD HYD  ████      │
│                                                                        │   AFT HYD  ████      │
└────────────────────────────────────────────────────────────────────────┴─────────────────────┘
```

### Schematic detail per compartment cell
- Compartment label
- Flooding fill (animated, blue overlay, percentage)
- Fire overlay (orange, percentage)
- WTD toggle button at bottom of each divider (▼ open / ■ closed / ✕ damaged)
- DC team icon when present (badge letter)
- Medical icon when present (cross)
- Crew count label (watchkeeper fit/total)

### Crew section
- Aligned by column to schematic above — same horizontal divisions
- Watch B left / Watch A right per column (matching existing crew panel convention)
- Displaced crew shown in their current physical compartment, name dimmed + [D] tag
- Wounded crew names in amber, KIA in red strikethrough
- Reactor comp column narrow (3 crew) — reactor team only
- Ship Support section below all compartment columns (medical + supply, full width)

### Right panel
- DC ALPHA and DC BRAVO: state display + 7 compartment dispatch buttons (matching schematic)
- Medical: LMA and MA state (standby / transit → dest / treating name / lost)
- Systems grid: 11 systems, colour-coded by state (nominal/degraded/offline/destroyed), repair progress bars where applicable

### Watch controls
- Moved to header bar: watch pill, fatigue bar, RELIEVE WATCH button, countdown during transition
- Removes dependency on separate crew panel header

### Keys
- `[D]` — toggle unified damage panel (replaces old DMG CTRL button and `[Y]` crew panel)
- Old `[Y]` binding removed or aliased to `[D]`
- `[W]` — relieve watch (unchanged, works regardless of panel state)

---

## Phase 8 — Pressure Crew Injury in Flooded Compartments

When `d.flooded[comp]` transitions to `true` (compartment fully floods):
- Any crew still in that compartment (not yet displaced/evacuated) take automatic wound rolls
- Roll at high severity: 60% chance serious, 30% critical, 10% minor
- These become immediate medical casualties
- Comms: *"[Compartment] — crew casualties from flooding."*
- Feeds directly into existing medical system (bleed-out timers, LMA dispatch)

---

## Build Order

1. **Phase 1** — Add `fwd_accomm` and `motor_room` to COMP_DEF, TRAVEL, EVAC_TO. Redistribute crew manifest. Update DC team homes.
2. **Phase 2** — Fix displaced crew physical relocation (move into `d.crew[destComp]`).
3. **Phase 3** — WTD state model, action stations auto-close, transit penalty, flooding spread.
4. **Phase 4** — Depth brackets in config, depth warning comms in sim.js, collapse game-over trigger.
5. **Phase 5** — Overstress flood tick, penetration table, flood rate depth scaling.
6. **Phase 6** — Acoustic depth noise penalty in noise calculation.
7. **Phase 7** — Unified full-screen damage panel (largest single piece of work — render-panel.js rewrite of both panels).
8. **Phase 8** — Pressure injury on compartment flood completion.

Phases 1–6 are all logic/data changes. Phase 7 is the UI rewrite. Phase 8 is a small addition after the crew location model is fixed.

---

## Files Changed Per Phase

| Phase | Files |
|---|---|
| 1 | damage.js (COMP_DEF, TRAVEL, EVAC_TO, CREW_MANIFEST) |
| 2 | damage.js (evacuation logic) |
| 3 | damage.js (WTD state, flood spread, transit calc), comms.js (WTD lines), state.js (if needed) |
| 4 | config.js (depths block), sim.js (depth tick, collapse check), comms.js (depth warning lines) |
| 5 | damage.js (_tickDepthStress, penetration table, flood rate scaling), comms.js (penetration lines) |
| 6 | sim.js or ai.js (noise calculation) |
| 7 | render-panel.js (full rewrite of drawDmgPanel + drawCrewPanel → single drawDamageScreen) |
| 8 | damage.js (_tickFlood, flood completion handler) |

---

## Outstanding Design Decisions (confirm before implementing)

- [ ] Exact boat name (HMS ?) — fictional, not Vanguard-class
- [ ] Crew count for fwd_accomm and motor_room (proposed: 18 and 7)
- [ ] DC Bravo home: motor_room (proposed) vs aft_ends (current)
- [ ] WTD crossing time penalty: +10s per closed door (proposed)
- [ ] Flooding spread rate: 15% spillover open door, 40% once primary fully flooded (proposed)
- [ ] Collapse depth: 620m (proposed)
- [ ] Stress tick interval at design depth: 30s (proposed)
