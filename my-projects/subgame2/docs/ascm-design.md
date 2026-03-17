# Anti-Ship Cruise Missiles (ASCM) — Design Document

*Doodle Sub: Captain Sim v5 | subgame2*

---

## 1. Overview

ASCMs give the player a standoff strike capability against surface targets. Unlike torpedoes,
missiles fly above the water on a programmed course and use their own active radar seeker to
acquire the target — meaning the player's fire control data only needs to be good enough to put
the seeker cone in the right area, not perfectly accurate.

The key tactical loop:
- Gather a fire control solution (periscope stadimeter or TMA)
- Assign the solution to a tube or VLS cell
- Execute the firing point procedure — sequential comms confirm solution, ship, and weapon ready
- Missile flies inertially to a waypoint, activates seeker, acquires if cone covers the target
- Solution quality determines how well the cone is centred

---

## 2. Vessel Loadouts

### 2.1 Tube-Launched Missiles (encapsulated, fire from standard torpedo tubes)

| Vessel | Torpedo | Missile | Tubes | Missile stock |
|---|---|---|---|---|
| 688i (USS Dallas) | MK-48 ADCAP | UUM-84 Harpoon | 4 × 533mm bow | 8 |
| Trafalgar (HMS Trafalgar) | SPEARFISH | Sub-Harpoon | 5 × 533mm bow | 6 |
| Swiftsure (HMS Swiftsure) | TIGERFISH | Sub-Harpoon | 5 × 533mm bow | 6 |
| Seawolf (USS Connecticut) | MK-48 ADCAP | UUM-84 Harpoon | 8 × 660mm bow | 8 |
| Type 209 (U-36) | SST-4 / SUT | SM39 Exocet | 8 × 533mm bow | 4 |

Each tube may be loaded with either a torpedo or a missile capsule at any time.
The player chooses the load per tube via the tube management panel — this can be done
at any point during the patrol, with appropriate delay and comms.

### 2.2 Vertical Launch System (VLS)

| Vessel | System | Cells | Weapon |
|---|---|---|---|
| 688i (USS Dallas) | AN/BLQ VLS (Flight III insert) | 12 | BGM-109C TASM Tomahawk |

> The in-game 688i is treated as a late Flight III boat (SSN-751 onward) with the 12-cell VLS
> insert forward of the sail. This is the only player vessel with VLS.
> VLS cells **cannot be reloaded at sea** — expended cells are gone for the mission.
> VLS fire uses a streamlined procedure (no tube prep required — see §6.2).

---

## 3. Missile Specifications

### 3.1 UUM-84 Harpoon / Sub-Harpoon

```
Range:           ~75 nm (140 km) operational
Cruise speed:    ~450 kt (subsonic, sea-skimming ~10m)
Seeker:          Active radar, ±40° acquisition cone
Warhead:         221 kg semi-armour-piercing
Launch depth:    Any depth ≤ vessel divingLimit (capsule released, ascends, rocket ignites)
Fire control:    Bearing + range from stadimeter or TMA
```

### 3.2 BGM-109C TASM Tomahawk (Anti-Ship)

```
Range:           Exceeds game world — treat as unlimited within mission area
Cruise speed:    ~400 kt (subsonic, sea-skimming)
Seeker:          Active radar, ±35° acquisition cone
Warhead:         450 kg unitary
Launch:          VLS only — eject from cell, no capsule mechanics
Fire control:    Bearing + range — range error matters more at long range
```

### 3.3 SM39 Exocet

```
Range:           ~30 nm (50 km) — within tactical game range
Cruise speed:    ~370 kt
Seeker:          Active radar, ±30° acquisition cone (narrower — needs better solution)
Warhead:         165 kg semi-armour-piercing
Launch depth:    Any depth ≤ vessel divingLimit (capsule launch)
Fire control:    Same — narrower seeker cone means more sensitive to solution error
```

---

## 4. Tube Load Management

### 4.1 Operations Available While Sailing

The player can load, unload, or change the load in any tube at any time. Each operation
triggers a comms sequence and occupies the torpedo room for the duration.

Only one tube can be in a load/unload operation at a time — a second request while the
torpedo room is busy is rejected with a COMMS message.

#### LOAD a tube

Player selects an empty tube and chooses a weapon type from available stock.

```
CONN  → TORP:  "Torpedo room, load tube [X] with [weapon]"
         [delay: torpReloadTime × reloadMult]
TORP  → CONN:  "Conn, torpedo room — tube [X] loaded [weapon], ready in all respects"
```

Tube state: EMPTY → LOADING (progress bar) → LOADED

#### UNLOAD a tube

Player requests unload on a loaded tube. Weapon is returned to stowage stock.

```
CONN  → TORP:  "Torpedo room, unload tube [X]"
         [delay: torpReloadTime × 0.65 — extract only, no arming/prep]
TORP  → CONN:  "Conn, torpedo room — tube [X] clear, [weapon] stowed"
```

Tube state: LOADED → UNLOADING (progress bar) → EMPTY

#### CHANGE a tube load

Player selects a loaded tube and requests a different weapon type.
Implemented as a sequential unload + load with a combined delay.

```
CONN  → TORP:  "Torpedo room, strike tube [X], reload [new weapon]"
         [delay: torpReloadTime × (0.65 + reloadMult) — extract then load]
TORP  → CONN:  "Conn, torpedo room — [old weapon] stowed, tube [X] loading [new weapon]"
         [brief intermediate message at ~40% through]
TORP  → CONN:  "Conn, torpedo room — tube [X] loaded [new weapon], ready in all respects"
```

#### Stock tracking

- `torpStock` tracks torpedoes in stowage
- `missileStock` tracks missile capsules in stowage
- Loading a weapon decrements the appropriate stock
- Unloading returns the weapon to stock (weapon is not consumed until fired)
- Firing a weapon does not change stock — it was consumed on load

### 4.2 Reload Time Reference

| Vessel | Torpedo reload | Missile load (×1.5) | Strike + reload (×2.15) |
|---|---|---|---|
| 688i | 28s | 42s | 60s |
| Trafalgar | 30s | 45s | 65s |
| Swiftsure | 32s | 48s | 69s |
| Seawolf | 22s | 33s | 47s |
| Type 209 | 35s | 53s | 75s |

### 4.3 Default Load at Mission Start

| Vessel | Default |
|---|---|
| 688i | All 4 tubes: MK-48 ADCAP |
| Trafalgar | All 5 tubes: SPEARFISH |
| Swiftsure | All 5 tubes: TIGERFISH |
| Seawolf | All 8 tubes: MK-48 ADCAP |
| Type 209 | All 8 tubes: SST-4/SUT |

The player is expected to configure tube loads for their intended mission before engagement.
There is no gameplay penalty for reconfiguring at sea — only the time cost.

---

## 5. Firing Point Procedure (FPP)

### 5.1 Full Torpedo FPP (updated)

The existing FPP comms (`firingProcedures`, `solutionSet`, `floodingDown`, `tubeReady`, `fired`)
are present but incomplete. The full sequence with weapon type and contact designation:

```
Step 1 — CO calls FPP
  CONN → ALL:  "Firing point procedures, tube [X], [weapon], [contact]"

Step 2 — Weps acknowledges, prepares tube
  WEPS → CONN: "Tube [X], [weapon], [contact] — aye. Prepare tube [X]"

Step 3 — Tube floods and opens outer door (~3-4s)
  WEPS → CONN: "Tube [X], flooding down"
  WEPS → CONN: "Conn, Weps — tube [X] ready in all respects, outer door open"

Step 4 — Solution confirmed
  WEPS → CONN: "Conn, Weps — tube [X], solution set"

Step 5 — Ship and weapon readiness
  NAV  → CONN: "Ship ready"
  WEPS → CONN: "Weapon ready"

Step 6 — CO fires
  CONN → ALL:  "Fire, tube [X], [weapon], [contact]"
  WEPS → CONN: "Tube [X] fired electrically"
```

Total FPP duration: ~5-7 seconds from fire button press to weapon away.
Each step is a queued COMMS message with a short stagger delay (~0.8-1.2s per step).

> **Nation variants**: RN boats (Trafalgar, Swiftsure) use "prepare tube" language.
> USN boats (688i, Seawolf) use "shoot" as the fire order:
> `"Weps, Conn — shoot, tube [X], [weapon], [contact]"` → `"Set... standby... fire"`

### 5.2 Missile FPP — Tube-Launched (ASCM)

Same sequence as torpedo FPP. The weapon type in the call identifies it as a missile.
No additional procedural steps — the difference is in what happens after:

```
  CONN → ALL:  "Firing point procedures, tube [X], [missile], [contact]"
               [steps 2-5 identical to torpedo FPP]
  CONN → ALL:  "Fire, tube [X], [missile], [contact]"
  WEPS → CONN: "Tube [X] fired — capsule away"
  WEPS → CONN: "Conn, Weps — [missile] airborne"   (2s after launch)
```

### 5.3 VLS FPP (688i TASM only)

VLS does not require tube prep. Streamlined procedure:

```
  CONN → ALL:  "Firing point procedures, VLS [cell], TASM, [contact]"
  WEPS → CONN: "VLS [cell], solution set"
  NAV  → CONN: "Ship ready"
  WEPS → CONN: "Weapon ready"
  CONN → ALL:  "Fire, VLS [cell], TASM, [contact]"
  WEPS → CONN: "VLS [cell] fired — TASM away"
  WEPS → CONN: "Conn, Weps — Tomahawk airborne"    (2s after launch)
```

### 5.4 Aborted FPP

If the player cancels mid-FPP (before Step 6), or a solution is lost during the procedure:

```
  CONN → ALL:  "Check fire, check fire — tube [X] hold"
  WEPS → CONN: "Tube [X] holding — outer door closing"
```

Tube state returns to LOADED (door closes, weapon still in tube ready to fire again).

### 5.5 What's New in comms.js

New entries needed in `COMMS.weapons`:

```js
fppOpen(tube, weapon, contact)     // Step 1: CO calls FPP
fppAck(tube, weapon, contact)      // Step 2: Weps acknowledges + prepare
// floodingDown(tube) — exists
// tubeReady(tube) — exists
// solutionSet(tube) — exists
shipReady()                        // Step 5a: Nav
weaponReady()                      // Step 5b: Weps
fireOrder(tube, weapon, contact)   // Step 6: CO fires
capsuleAway(tube)                  // ASCM variant of fired()
missileAirborne(weapon)            // 2s post-launch
vlsFired(cell)                     // VLS variant
checkFire(tube)                    // Abort
tubeHolding(tube)                  // Abort confirm

// Tube load management:
loadOrder(tube, weapon)            // CONN orders load
loadComplete(tube, weapon)         // TORP confirms loaded
unloadOrder(tube)                  // CONN orders unload
unloadComplete(tube, weapon)       // TORP confirms stowed
strikeReloadOrder(tube, oldWeapon, newWeapon)   // CONN orders change
strikeReloadProgress(tube, newWeapon)           // TORP intermediate
strikeReloadComplete(tube, newWeapon)           // TORP confirms ready
torpRoomBusy()                     // Rejected — already operating
```

---

## 6. Fire Control System

### 6.1 Solution Sources

Two methods to build an ASCM fire control solution:

#### Method A — Periscope Stadimeter (visual, at PD)

The stadimeter estimates range by measuring the apparent angle of a known mast height.
Requires the player to be at periscope depth with the periscope raised.

**Process:**
1. Come to PD, raise periscope
2. Acquire a surface contact visually
3. Activate STADIMETER mode — system auto-observes over ~4 seconds
4. System uses target vessel class mast height (from contact classification if known)
5. Range estimate generated → combined with periscope bearing → solution assigned

**Accuracy:**
- Bearing: ±2-3° (periscope optics)
- Range: ±18% if class known, ±30% if class unknown (average mast height assumption)
- Observation time: ~4 seconds at PD — tactically costly near alerted groups

#### Method B — TMA Solution (passive, no PD required)

A mature TMA track on a surface contact can be promoted directly to an ASCM solution.
TMA quality maps to solution accuracy.

| TMA Quality | Range Error | Seeker Outcome |
|---|---|---|
| ≥ 0.80 | ±8% | Near-certain acquisition |
| 0.60–0.80 | ±15% | Likely acquisition |
| 0.40–0.60 | ±25% | Marginal |
| 0.20–0.40 | ±35% | Poor — probably misses |
| < 0.20 | — | Cannot fire |

### 6.2 Seeker Acquisition Logic

At the programmed waypoint the missile activates radar and scans its acquisition cone.

- Waypoint is placed at `estimated_range × 0.85` (seeker activates with a run-up)
- Angular offset between the cone centre and the target's actual position determines hit/miss
- If target bearing from waypoint falls within ±(seekerFOV/2): hit
- If outside: miss — missile flies on until range exhausted

The combined bearing + range error from the fire control solution determines the angular
offset. Better solution = cone better centred = higher hit probability.

---

## 7. UI Requirements

### 7.1 Tube Management Panel (all vessels)

Each tube row shows:

```
[TUBE N] [WEAPON TYPE / EMPTY]  [STATE]          [LOAD ▼]  [FIRE]
  Tube 1   MK-48 ADCAP           LOADED           [change]  [FIRE]
  Tube 2   HARPOON                LOADED           [change]  [ARM]
  Tube 3   —                      EMPTY            [load]    —
  Tube 4   MK-48 ADCAP           RELOADING 45%    —         —
```

- **STATE**: LOADED / RELOADING (progress bar + time remaining) / UNLOADING / EMPTY
- **LOAD ▼**: Opens weapon selector (available types for this vessel, in-stock only)
- **FIRE**: Active when LOADED and (torpedo: any time) or (missile: ASCM solution assigned)
- **ARM**: For missiles — shows when loaded but no solution assigned yet

### 7.2 VLS Panel (688i only)

Separate tab in the weapons section. Shows a 12-cell visual grid:

```
  [1 TASM READY] [2 TASM READY] [3 TASM READY]
  [4 TASM READY] [5 TASM READY] [6 TASM READY]
  [7 TASM READY] [8 TASM READY] [9 EXPENDED   ]
  ...
  [SOLUTION: SIERRA 3 — BRG 247 — RNG ~18nm — QUALITY 0.74]
  [FIRE CELL 1]  [FIRE SALVO: 1,2]  [FIRE ALL READY]
```

- Expended cells are greyed out, cannot be reset
- Salvo fires cells at 4-second intervals with individual FPP messages per cell
- All cells share the current ASCM solution (one solution designation at a time)

### 7.3 ASCM Solution Panel (shared)

Visible in both tube and VLS panels. Shows current designated solution:

```
  ASCM SOLUTION
  Source:    TMA / STADIMETER / NONE
  Contact:   SIERRA 3
  Bearing:   247°
  Range:     ~18.4 nm (est)
  Quality:   ████░░ 0.74
  Seeker:    ±40° (Harpoon) → est. ACQUISITION LIKELY
  [ASSIGN TO TUBE 2]   [ASSIGN TO VLS 1]
```

---

## 8. Periscope Stadimeter

### 8.1 Mechanic

When at PD with periscope raised, a STADIMETER button appears alongside the periscope controls.

1. Player activates STADIMETER
2. Sonar/visual contact list shows surface contacts — player selects target
3. 4-second observation timer runs (periscope must stay raised)
4. At completion: range estimate generated, solution assigned to ASCM panel
5. COMMS sequence fires (see §8.2)

If the periscope is lowered during observation, the observation is cancelled:
```
WEPS → CONN: "Conn, Weps — stadimeter observation interrupted"
```

### 8.2 Stadimeter COMMS

```
CONN → SCOPE: "Scope, Conn — stadimeter observation, [contact]"
SCOPE → CONN: "Conn, Scope — observation complete. Range [X] yards, bearing [Y]"
WEPS  → CONN: "Conn, Weps — ASCM solution set. [contact], bearing [Y], range [X]"
```

### 8.3 Radar Detection Risk

Ships with active radar can detect a raised periscope:
- Detection range: ~3nm if ship radar is active
- Probability increases with observation time
- Alerted groups are more likely to have radar active
- Detection triggers the ship's suspicion system — not an immediate fire event

---

## 9. Missile Flight Model

### 9.1 State Machine

```
LAUNCHED → ASCENDING → CRUISING → SEEKER_ACTIVE → [HIT | MISS]
```

- **ASCENDING**: Capsule leaves tube, surfaces, rocket ignites. ~2s. No steering.
- **CRUISING**: Sea-skimming at ~10m AGL on programmed bearing. Fast — at 450kt, a 50km shot
  takes ~3 min game time. Flies in real game time (tactical situation can change in flight).
- **SEEKER_ACTIVE**: At waypoint. Radar on. Scans cone. Checks all surface ships.
  Acquires nearest ship within cone bearing.
- **HIT**: Applies `warheadDmg` to ship HP. Ship destruction/damage as normal.
- **MISS**: Flies straight until `range` exhausted. Splashes.

### 9.2 Player Feedback

The missile leaves the player's sensor picture once airborne. Feedback:
- FPP comms on launch (capsule away / missile airborne)
- Sonar transient on capsule launch (brief noise spike)
- Hit: ship contact eventually disappears or goes silent — player infers
- Optional: distant explosion audio if within passive sonar detection range

### 9.3 Ship Missile Defence

Ships have a passive `missileDefence` probability representing chaff + CIWS:

| Ship class | missileDefence |
|---|---|
| Slava cruiser | 0.20 |
| Udaloy destroyer | 0.30 |
| Krivak frigate | 0.25 |
| Grisha corvette | 0.10 |
| Support/auxiliary | 0.05 |

Applied as a final intercept roll after seeker acquisition. A successful defence causes
a near-miss with a COMMS acknowledgement:
```
SONAR → CONN: "Conn, Sonar — possible detonation bears [X]. No kill confirmed."
```

---

## 10. Config Changes Required

### 10.1 Per-vessel additions to playerPresets

```js
// 688i
vlsCells: 12,
vlsWeapon: 'tasm',
missileStock: 8,
missileTypes: ['harpoon'],

// Trafalgar / Swiftsure
missileStock: 6,
missileTypes: ['sub_harpoon'],

// Seawolf
missileStock: 8,
missileTypes: ['harpoon'],

// Type 209
missileStock: 4,
missileTypes: ['sm39'],
```

### 10.2 New missile config block

```js
missiles: {
  harpoon: {
    label: 'UUM-84 HARPOON',
    speed: 450,
    range: 25000,         // wu (~140km)
    seekerFOV: 0.698,     // rad (~40°)
    warheadDmg: 85,
    reloadMult: 1.5,
    vls: false,
  },
  tasm: {
    label: 'BGM-109C TASM',
    speed: 400,
    range: 999999,        // effectively unlimited in game world
    seekerFOV: 0.611,     // ~35°
    warheadDmg: 120,
    reloadMult: null,     // VLS only
    vls: true,
  },
  sm39: {
    label: 'SM39 EXOCET',
    speed: 370,
    range: 9000,          // wu (~50km)
    seekerFOV: 0.524,     // ~30°
    warheadDmg: 65,
    reloadMult: 1.5,
    vls: false,
  },
},
```

### 10.3 Tube state extension

Current tube state in `sim.js` tracks: loaded (bool), reloading (bool), reloadT (float).
Needs extension to:

```js
tubes[i] = {
  load:      'mk48' | 'harpoon' | 'sm39' | null,  // weapon type key
  state:     'loaded' | 'reloading' | 'unloading' | 'empty',
  progress:  0.0–1.0,    // reload/unload progress
  totalT:    Number,     // total time for current operation
}
```

---

## 11. Implementation Plan

### Phase 1 — Config & tube state
- `config.js`: add `missileStock`, `missileTypes`, `vlsCells`, `vlsWeapon`, `missiles` block
- `sim.js`: extend tube state array to `{load, state, progress, totalT}`

### Phase 2 — Tube load management
- `sim.js`: `orderLoad(tubeIdx, weaponKey)`, `orderUnload(tubeIdx)`, `orderStrikeReload(tubeIdx, weaponKey)` functions
- `comms.js`: all tube management COMMS entries (§5.5)
- `render-panel.js`: updated tube panel UI with load selector and state display

### Phase 3 — Full FPP
- `comms.js`: new FPP entries — `fppOpen`, `fppAck`, `shipReady`, `weaponReady`, `fireOrder`, `capsuleAway`, `missileAirborne`, `vlsFired`, `checkFire`, `tubeHolding`
- `sim.js`: FPP sequencer — queues the steps with delays, fires weapon at step 6
- Existing `firingProcedures`/`tubeReady`/`fired` updated to include weapon type + contact

### Phase 4 — ASCM fire control
- `sim.js`: `ascmSolution` object — `{bearing, range, quality, source, contactId}`
- `sim.js`: TMA→ASCM promotion function
- `render-panel.js`: ASCM solution panel

### Phase 5 — Stadimeter
- `render-panel.js`: STADIMETER button + observation timer in periscope mode
- `sim.js`: stadimeter logic — range estimate with class-based or average mast height error
- `comms.js`: stadimeter COMMS entries

### Phase 6 — Missile flight
- `missile.js` (new): missile object, state machine, seeker scan, hit/miss resolution
- `sim.js`: missile array, update each tick, ship HP damage on hit
- `comms.js`: airborne / near-miss / kill inferred (sonar contact lost) messages

### Phase 7 — VLS (688i only)
- `sim.js`: VLS cell array `{state: 'ready'|'expended'}`
- `render-panel.js`: VLS panel tab, 12-cell grid, salvo fire buttons
- `comms.js`: VLS FPP variants

---

## 12. Open Questions

1. **Missile flight time scaling**: At 450kt a 50km shot = ~3.5 min real time. Missiles fly
   in game time — the tactical situation (ship manoeuvre, other torpedo tracks) can change
   during flight. Recommend no time compression for missile flight specifically.

2. **Type 209 load mix**: Typical load 4 × SST-4 + 4 × SM39, or all 8 one type.
   Player chooses. SM39 range of ~50km is well within the game's tactical range.

3. **Seawolf note**: No VLS — tube-launched Harpoon only, despite the boat's reputation.
   Its 8 large tubes and deep dive capability are the differentiators.

4. **Ship radar detection of periscope**: Needs a flag `hasActiveRadar` on ship entities
   indicating whether their search radar is currently transmitting. Alerted ships = yes,
   patrolling ships = intermittent. This feeds the stadimeter risk system.
