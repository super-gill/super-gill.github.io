# Sonar Geometry & Acoustic Advantage — Design Document

## Overview

This patch introduces directional sonar geometry to the simulation, replacing the current omni-directional detection model with a physically accurate representation of how submarine sonars actually work. Both the player and enemy submarines gain stern deaf arcs (baffles) — sectors immediately behind them where their own propeller noise masks incoming contacts. The player's deaf arc widens with speed, creating a genuine tactical trade-off between transit speed and acoustic awareness. Enemy submarines periodically execute baffle-clear maneuvers — turning 35° to sweep their blind sector — which the player must learn to anticipate and exploit. The TMA contact system is extended to synthesise an estimated heading and speed for each tracked contact, displayed as an oriented silhouette and directional arrow on the sonar map. The combination of these elements produces the core Cold War sub vs sub dynamic: approach from the enemy's stern quarter, stay slow, and exploit his deaf arc — but know that he will periodically turn to clear it.

---

## Current State (What Already Exists)

List precisely what is already implemented:
1. `passiveUpdate` in `sensors.js` — omni-directional. Signal = `e.noise * layer * (1-d/baseRange)`. No bearing angle applied.
2. `towedArrayUpdate` in `sensors.js` — has `inDeadCone()` function blocking returns within ±28° of stern axis. This is the ONLY directional geometry currently in the game.
3. `enemyMaybeHearPlayer` in `ai.js` — fully omni-directional. No bearing penalty.
4. `sonarQuality` per vessel in `config.js` — exists but is never read by `sensors.js` (dead field).
5. Contact system has `_estRange`, `_brgRate`, `latestBrg`, `latestFromX/Y`, `bearings[]` — good TMA geometry foundation.
6. `render.js` draws enemy units only in debug overlay. Non-debug shows bearing lines + TMA blobs only. No oriented enemy silhouettes.
7. `render-world.js` has `drawEnemySubTopDown()` and `drawEnemyBoatTopDown()` — unused outside debug.
8. Enemy entities already have `heading`, `vx`, `vy`, `role`, `subClass` fields.

---

## What This Patch Adds

List in plain English the 5 main additions:
1. **Own-ship deaf arc** — player's bow array has a blind zone in the stern sector, widening with speed
2. **Enemy deaf arc** — enemies can't hear the player if the player is in their stern sector
3. **Sonar geometry visualization** — draw player deaf arc and bow coverage on the map
4. **Enemy contact heading estimation** — estimate and display contact's course from TMA data
5. **AI baffle-clear maneuvers** — enemy subs periodically clear baffles to check for trailing contacts

---

## Phase 1 — Config: Sonar Geometry Params

### `config.js` additions

Add a `sonar` block to the `player` config object (inside the shared `sh` object so all vessels inherit it):

```js
sonar: {
  // Bow array (BQQ-5 / Type 2076) — primary passive array
  bowHullHalfAngleDeg:  150,    // degrees — full coverage arc half-angle from bow
                                  // i.e. full sensitivity within ±150° (= everything except stern 30°)
  // Deaf arc (baffle/stern null) — player's own propeller masks this sector
  baffleHalfAngleDegBase: 15,   // degrees at rest/very slow
  baffleHalfAngleDegPerKt: 1.5, // degrees added per knot of speed
  baffleHalfAngleDegMax:  45,   // degrees maximum (at ~20kt)
  // Signal roll-off — gradient from full coverage to dead zone
  //   Full sensitivity: bearing within (bowHullHalfAngleDeg - baffleHalfAngleDeg)
  //   Transition zone: between there and baffleHalfAngleDeg short of stern
  //   Dead: within baffleHalfAngleDeg of stern
  baffleRolloffDeg:     20,     // degrees of transition gradient
  // Soviet enemy sonar — same geometry model, wider deaf arc (noisier machinery)
  enemyBaffleBase:      20,     // degrees — Soviet boats noisier, wider deaf arc
  enemyBafflePerKt:     2.0,    // wider still at speed
  enemyBaffleMax:       55,     // degrees max
},
```

Note: `sonarQuality` already exists per vessel and should now be USED as a sensitivity multiplier in `passiveUpdate` (currently dead). Wire it in when applying deaf arc.

Per-vessel overrides where realistic:
- 688i: no override (uses shared defaults)
- Trafalgar: `sonar: {...sh.sonar, bowHullHalfAngleDeg: 155}` — pump-jet quieter, slightly wider coverage
- Swiftsure: `sonar: {...sh.sonar, baffleHalfAngleDegBase: 18}` — older design, slightly wider baffles
- Seawolf: `sonar: {...sh.sonar, bowHullHalfAngleDeg: 158, baffleHalfAngleDegBase: 12}` — best US sonar, quietest stern
- Type 209: `sonar: {...sh.sonar, baffleHalfAngleDegBase: 12, baffleHalfAngleDegPerKt: 1.0}` — electric motor, very quiet stern

Enemy AI baffle-clear config — add to `enemy` block:
```js
baffleClear: {
  intervalMin:  90,   // seconds minimum between checks
  intervalMax: 150,   // seconds maximum
  checkDurMin:  20,   // seconds to hold cleared heading
  checkDurMax:  30,
  turnDeg:      35,   // degrees to turn during clear
  rolesEnabled: ['hunter','interceptor','zeta'],  // only these roles do it
},
```

---

## Phase 2 — Own-Ship Deaf Arc Applied to Passive Detection

### `sensors.js` changes — `passiveUpdate`

**Where:** Inside the per-enemy loop in `passiveUpdate`, after computing `signal` but before the detection probability roll.

**What to add:**

1. Compute bearing from player to contact: `trueBearing = Math.atan2(dy, dx)` (already computed as `trueBearing`)
2. Compute angle relative to player heading: `relAngle = |angleNorm(trueBearing - player.heading)|`
   where `|...|` takes the absolute value (0 = dead ahead, π = dead astern)
3. Compute current baffle half-angle: `baffleHalf = clamp(baffleBase + speed_kts * bafflePerKt, baffleBase, baffleMax)` in radians
4. Compute transition start: `fullCoverageLimit = π - baffleRolloffDeg_rad`
5. Apply multiplier:
   - If `relAngle <= fullCoverageLimit`: `geoMult = 1.0` (full sensitivity)
   - If `relAngle >= π - baffleHalf_rad`: `geoMult = 0.0` (dead zone)
   - Else: linear interpolation from 1.0 to 0.0 across the rolloff band
6. Also apply `sonarQuality` now: `signal *= geoMult * (C.player.sonarQuality ?? 0.85)`
7. **The towed array already has its own `inDeadCone` check — do NOT duplicate this in passiveUpdate. Only apply to hull array detections.**

Read params from `C.player.sonar` — never hardcode angles.

**Result:** Player cannot detect contacts that are within their baffle sector. At speed, the deaf arc widens. Player must turn to "clear baffles" to check the stern.

---

## Phase 3 — Enemy Deaf Arc Applied to `enemyMaybeHearPlayer`

### `ai.js` changes — `enemyMaybeHearPlayer`

**Where:** After computing `signal` but before the detection probability roll (around line 168 in original).

**What to add:**

1. Compute bearing from enemy to player: already computed as `dx, dy` at top of function → `trueBrg = Math.atan2(dy, dx)`
2. Compute relative angle: `relAngle = Math.abs(angleNorm(trueBrg - (e.heading||0)))`
3. Compute enemy baffle half-angle from config: `C.player.sonar.enemyBaffleBase` etc., using enemy speed `Math.hypot(e.vx||0, e.vy||0)`
4. Apply same multiplier pattern as Phase 2 (full / rolloff / dead)
5. Multiply into signal: `signal *= geoMult`
6. Also apply enemy's `sonarQuality`-equivalent — enemies use `e.sensitivity` for this already, don't double-apply

Read params from `C.player.sonar` (the `enemyBaffle*` fields in that block). Do NOT hardcode angles.

**Result:** Player can hide in an enemy's baffles. This is the core of Cold War sub vs sub tactics. The enemy periodically does baffle-clear maneuvers (Phase 5) to counter this.

---

## Phase 4 — Enemy Contact Heading Estimation

### `sensors.js` changes — contact system

When `solveTMA` or `registerBearing` runs and quality ≥ 0.35, compute `c._estHeading` and `c._estHeadingAge`.

**Method:**
1. When the triangulation cross-fix in `solveTMA` produces a new `_estRange` estimate, also compute estimated world position:
   ```js
   c._estPosX = c.latestFromX + Math.cos(c.latestBrg) * c._estRange;
   c._estPosY = c.latestFromY + Math.sin(c.latestBrg) * c._estRange;
   ```
2. Store with timestamp: `c._estPosT = T`
3. When a second position estimate arrives (at least 15s later), compute:
   ```js
   c._estHeading = Math.atan2(newEstPosY - oldEstPosY, newEstPosX - oldEstPosX);
   c._estSpeed = Math.hypot(dx, dy) / dt;  // wu/s
   c._estHeadingConf = clamp((c.tmaQuality - 0.35) / 0.35, 0, 1);  // 0 at DEGRADED, 1 at SOLID
   c._estHeadingT = T;
   ```
4. Keep `c._prevEstPos = {x, y, t}` for the next computation
5. Heading estimate decays: if no update in 30s, `_estHeadingConf` decays at 0.02/s

**Note:** This is a **visual estimate only** — it does NOT affect TDC or fire control. It's an intelligence aid for the player.

### `render.js` changes — contact heading display

**Where:** In the sonar contacts drawing block, after drawing the TMA blob / position estimate.

**What to add (when `c._estHeading != null && c._estHeadingConf > 0.1`):**

1. Compute estimated position on screen: `[ex, ey] = w2s(c._estPosX, c._estPosY)` — use this as the centre of the heading arrow
2. Draw an arrow at estimated position pointing in `c._estHeading` direction:
   - Arrow length scales with `c._estHeadingConf` and zoom: `arrLen = wScale(200 + 300 * c._estHeadingConf)`
   - Arrow colour: amber `rgba(217,119,6,α)` at DEGRADED confidence, green `rgba(22,163,74,α)` at SOLID
   - Alpha: `c._estHeadingConf * alpha` (fades with both contact staleness and confidence)
   - Arrowhead: two short lines at ±30° from heading at the tip
3. Draw a small oriented sub silhouette at the estimated position:
   - Use `ctx.save(); ctx.translate(ex,ey); ctx.rotate(c._estHeading); drawEnemySubTopDown(); ctx.restore()`
   - Only when `c._estHeadingConf > 0.4` (reasonable confidence) and `c.tmaQuality >= 0.50`
   - Opacity: `c._estHeadingConf * 0.65 * alpha`
   - Silhouette for surface contacts: `drawEnemyBoatTopDown()`
4. Label near silhouette: `c.id + ' ' + Math.round(c._estSpeed * 0.5144) + 'kt ~' + estHdgDeg + '°'`
   - Only show speed when `_estHeadingConf > 0.5`
   - Speed conversion: `wu/s → kts` using the game's 1wu=10m scale: `wu_per_s / 0.5144 ≈ kts`

**The existing bearing lines + history dots already show bearing rate. The heading arrow and silhouette add the synthesised course estimate on top.**

---

## Phase 5 — AI Baffle-Clear Maneuvers

### `sim.js` changes — enemy sub movement tick

**Where:** In the enemy sub tick block, at the top of the `if(e.type==='sub')` section, before the `state` variable is assigned.

**Roles that do this:** Check `C.enemy.baffleClear.rolesEnabled.includes(e.role)`. Only hunter, interceptor, zeta.

**What to add:**

Initialise on spawn (add to `spawnSub`, `spawnZeta` common object):
```js
_baffleClearT: rand(C.enemy.baffleClear.intervalMin, C.enemy.baffleClear.intervalMax),
_baffleClearState: null,   // null | 'turning' | 'holding' | 'returning'
_baffleClearBaseHdg: null,
_baffleClearHoldT: 0,
```

**Tick logic (runs before state machine, can override heading/speed for the duration):**

```
// Count down baffle clear timer (only when not evading and not firing)
if no evade and not in post-fire sprint:
  e._baffleClearT -= dt

if e._baffleClearT <= 0 and e._baffleClearState === null:
  // Check if player might be in baffles — if suspicion > 0.1, more likely to clear
  const baffleBase = C.player.sonar.enemyBaffleBase * Math.PI/180
  const baffleHalf = clamp(baffleBase + speed * C.player.sonar.enemyBafflePerKt * Math.PI/180, baffleBase, C.player.sonar.enemyBaffleMax * Math.PI/180)
  // Only actually clear if: no solid TMA solution (if they know where you are, no need to search)
  if e.tmaQuality < 0.60:
    e._baffleClearBaseHdg = e.heading
    e._baffleClearState = 'turning'
    e._baffleClearTurnDir = Math.random() < 0.5 ? 1 : -1
    e._baffleClearT = rand(intervalMin, intervalMax)   // reset for next cycle
    addLog('SONAR','')   // silent — no COMMS, player can't know enemy is clearing baffles

if e._baffleClearState === 'turning':
  const targetHdg = angleNorm(e._baffleClearBaseHdg + e._baffleClearTurnDir * turnDegRad)
  desiredHeading = targetHdg
  if |angleNorm(e.heading - targetHdg)| < 3° (heading error < 3°):
    e._baffleClearState = 'holding'
    e._baffleClearHoldT = rand(checkDurMin, checkDurMax)

if e._baffleClearState === 'holding':
  desiredHeading = angleNorm(e._baffleClearBaseHdg + e._baffleClearTurnDir * turnDegRad)
  e._baffleClearHoldT -= dt
  // During hold: go slow to listen — targetSpd override to 3-5 kt
  if e._baffleClearHoldT <= 0:
    e._baffleClearState = 'returning'

if e._baffleClearState === 'returning':
  desiredHeading = e._baffleClearBaseHdg
  if |angleNorm(e.heading - e._baffleClearBaseHdg)| < 5°:
    e._baffleClearState = null
    e._baffleClearBaseHdg = null
```

**Speed during hold:** Override targetSpd to `rand(3, 5)` during 'holding' phase — the sub slows to listen clearly into its cleared sector.

**Interaction with post-fire sprint:** If `e._postFireT > 0`, skip the baffle clear timer decrement. Fire-sprint takes priority.

**Interaction with evasion:** If `e.evadeT > 0`, immediately abort any active baffle clear: set `e._baffleClearState = null`.

---

## Phase 6 — Map Visualization: Own-Ship Sonar Geometry

### `render.js` changes — draw sonar overlay near player

**Where:** After the towed array DEAF cone drawing block (~line 188 of render.js).

**What to draw:**

1. **Bow array coverage petal** (ahead of player):
   - A filled arc from `-(bowHullHalfAngleDeg - baffleHalfAngle)` to `+(bowHullHalfAngleDeg - baffleHalfAngle)` degrees around the player heading
   - Radius: `wScale(1800)` — roughly half the hull sonar range
   - Fill: `rgba(17, 24, 39, 0.03)` — very subtle forward shading
   - Stroke: none (too cluttered)
   - Note: DO NOT draw if towed array is operational — it would be confusing to show both

2. **Stern deaf arc** (behind player):
   - Same stern cone as towed array DEAF label, but for hull array when towed is NOT deployed
   - Half-angle: compute from current speed using `C.player.sonar` params
   - Draw as filled wedge behind player: `rgba(17, 24, 39, 0.06)` — slightly darker than bow coverage
   - Label: 'BAFFLES' at 70% of cone length (matching the towed array's existing DEAF label style)
   - Radius: `wScale(800)` — smaller than towed array (hull array shorter range)

3. **Speed-dependent widening indicator** (only when speed > 8 kts):
   - Show the widened baffle edges as two faint radial lines from player position
   - `rgba(217,119,6,0.25)` — amber, low opacity, to warn that baffles are widening
   - This tells the player "you're going fast, your deaf arc is widening"

Read all angles from `C.player.sonar` — never hardcode.

---

## Files Changed Summary

| File | Phase | What changes |
|---|---|---|
| `config.js` | 1 | Add `sonar` block to `sh`, per-vessel overrides, `baffleClear` to `enemy` |
| `sensors.js` | 2, 4 | `passiveUpdate` deaf arc, `sonarQuality` wiring, `_estHeading` computation |
| `ai.js` | 3 | `enemyMaybeHearPlayer` deaf arc |
| `sim.js` | 5 | Baffle-clear maneuver state machine in sub tick, reset in spawn functions |
| `render.js` | 4, 6 | Contact heading arrows + silhouettes, own-ship geometry visualization |

No new files. No new modules. All reads from config — no hardcoded angles.

---

## Verification Checklist

### Phase 1 (Config)
- [ ] `C.player.sonar` block present on all 5 vessel presets (via `sh`)
- [ ] Per-vessel overrides correct (Seawolf quietest, Swiftsure widest baffles)
- [ ] `C.enemy.baffleClear` present with correct role list

### Phase 2 (Own Deaf Arc)
- [ ] Player cannot detect a contact that is within `baffleHalfAngle` of dead astern
- [ ] At 5kt: dead zone roughly ±22.5° of stern
- [ ] At 15kt: dead zone roughly ±37.5° of stern
- [ ] Transition: detection degrades smoothly across rolloff zone
- [ ] Towed array is NOT affected (it has its own geometry in towedArrayUpdate)
- [ ] `sonarQuality` now contributes to detection probability

### Phase 3 (Enemy Deaf Arc)
- [ ] Player approaching from dead astern at low noise = enemy cannot detect
- [ ] Player approaches from ahead = enemy detects at full capability
- [ ] At higher enemy speed: wider enemy deaf arc = larger safe approach sector from astern
- [ ] Check: layerPenalty still applied (geometry stacks multiplicatively, doesn't replace it)

### Phase 4 (Heading Estimation)
- [ ] No heading arrow until TMA quality ≥ 0.35
- [ ] Arrow appears in amber at DEGRADED (0.35-0.70), green at SOLID (≥0.70)
- [ ] Oriented sub silhouette only at quality ≥ 0.50 AND confidence > 0.4
- [ ] Speed label only when confidence > 0.5
- [ ] Estimate decays (confidence drops) when no new bearing observations
- [ ] Does NOT feed into TDC — visual only

### Phase 5 (AI Baffle Clear)
- [ ] Hunter/interceptor/zeta only — not pinger, not ssbn
- [ ] Fires every 90-150s when not evading
- [ ] Sub turns 35°, holds 20-30s at 3-5kt, returns to base heading
- [ ] No COMMS logged — player cannot know enemy is clearing
- [ ] Aborts immediately on evade trigger
- [ ] Skips if TMA quality already ≥ 0.60 (knows where you are, no need to clear)

### Phase 6 (Visualization)
- [ ] Bow coverage subtle (opacity ~0.03) — doesn't clutter the map
- [ ] Stern deaf wedge shows behind player, size changes with speed
- [ ] Amber warning lines appear above 8kt
- [ ] BAFFLES label at correct position in stern wedge
- [ ] Towed array's existing DEAF label still shows when array is operational

---

## Implementation Order

1. `config.js` — Phase 1 (no behaviour change, just data)
2. `sensors.js` — Phase 2 (own deaf arc + sonarQuality)
3. `ai.js` — Phase 3 (enemy deaf arc)
4. `sensors.js` + `render.js` — Phase 4 (heading estimation + display)
5. `sim.js` — Phase 5 (baffle clear maneuver)
6. `render.js` — Phase 6 (visualization overlay)

Each phase is independently testable. Phases 2 and 3 together already transform the tactical game.
