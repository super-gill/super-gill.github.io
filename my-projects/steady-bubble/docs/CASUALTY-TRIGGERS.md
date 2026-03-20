# Casualty Trigger Map — Parent Systems and Code Locations

**Version:** 1.0
**Date:** 2026-03-19
**Status:** DRAFT — Reference document for CASUALTY-UPGRADE.md

This document maps every casualty (existing and proposed) to:
- The **parent system** that owns the trigger check
- The **code location** where the check runs
- The **event** that causes the check to fire
- The **exact conditions** evaluated
- The **tick location** in the game loop where the casualty is updated

---

## PART A — EXISTING CASUALTIES (Reference)

These are documented here so the new casualties follow the same patterns.

---

### A1. Flooding (Combat)

| Field | Value |
|---|---|
| **Parent system** | Damage system — `hit()` function |
| **Code location** | `src/systems/damage/index.js` — `hit()`, lines 267-410 |
| **Trigger event** | `hit()` is called by `sim/index.js` when a torpedo or weapon collides with the player |
| **Conditions** | Always triggers on hit. First hit: `floodRate[comp] = severity * 0.008`. Second hit: `floodRate[comp] = 0.04 + severity * 0.04` |
| **Tick location** | `damage/index.js` — `tick()`, lines 524-662. Runs every frame inside `_DMG.tick(dt)`, called from `sim/index.js` line 320 |
| **Tick order** | After `tickCoolantLeak(dt)` (line 311), after `player.invuln` decrement (line 319). Flooding is processed inside `DMG.tick()` at the top of the function, before DC teams, fire, and medical. |

**Flow:**
```
sim/index.js update(dt)
  → player.invuln decrement
  → _DMG.tick(dt)
    → damage/index.js tick(dt)
      → for each COMP: advance flooding by floodRate * pressureMult * dt
      → threshold checks at 0.33 (deck damage), 0.65 (evacuation), 0.67 (deck damage), 1.0 (fully flooded)
      → _wtdFloodSpread() — flooding crosses open WTDs
```

---

### A2. Flooding (Depth Cascade)

| Field | Value |
|---|---|
| **Parent system** | Damage system — `applyDepthCascade()` |
| **Code location** | `src/systems/damage/flooding.js` — `applyDepthCascade()` |
| **Trigger event** | Called from `sim/player-physics.js` when `player.depth > crushDepth` |
| **Conditions** | Depth exceeds the vessel's effective crush depth (which scales with crew integrity). Random compartments develop structural seeps at `SEEP_RATE` (0.004 units/s) with staggered initiation delays of 30-90 seconds between compartments. |
| **Tick location** | The seep rate is applied during the normal flooding tick in `damage/index.js tick()` — seep compartments have their floodRate set and are processed identically to combat flooding. |

**Flow:**
```
sim/player-physics.js tickPlayerDepth(dt)  [called from sim/index.js]
  → if depth > crushDepth → applyDepthCascade()
    → flooding.js: sets floodRate on random compartments with staggered delays
  → normal flood tick in damage/index.js processes the seep rates
```

---

### A3. Fire (Combat)

| Field | Value |
|---|---|
| **Parent system** | Damage system — `hit()` function |
| **Code location** | `src/systems/damage/index.js` — `hit()`, lines 350-353 |
| **Trigger event** | Same `hit()` call as flooding. Fire check runs after flooding setup. |
| **Conditions** | `severity > 0.35`. Fire chance: `(severity - 0.35) / 0.65 * 0.55`. If roll succeeds, `igniteFire(comp, severity * 0.12)` is called. |
| **Tick location** | `damage/fires.js` — `_tickFire(dt, d)`, called from `damage/index.js tick()` at line 668. Runs after DC teams tick and WTD auto-close/open. |

**Flow:**
```
sim/index.js update(dt)
  → _DMG.tick(dt)
    → damage/index.js tick(dt)
      → flooding processing
      → _tickWTDAutoClose / _tickWTDAutoOpen
      → _tickTeams(dt, d)       ← DC teams
      → _tickFire(dt, d)        ← fire growth, spread, watchkeeper suppression
      → _tickDrench(dt, d)      ← N2 drench countdowns
      → _tickMedical(dt, d)
```

---

### A4. Reactor SCRAM

| Field | Value |
|---|---|
| **Parent system** | Multiple triggers converge on `triggerScram()` in `sim-state.js` |
| **Code location** | `src/state/sim-state.js` — `triggerScram(cause)` |
| **Trigger events** | 1. Coolant leak countdown expires → `sim/player-physics.js tickCoolantLeak()` line ~150. 2. Combined emergency manoeuvre shock → `sim/player-physics.js tickCrashDive()`. 3. Direct weapon hit to reactor → `damage/index.js hit()` line 306 and 335. 4. Primary coolant system goes offline+ → `damage/index.js damageSystem()` line 101. 5. Reactor runaway → `damage/index.js hit()` line 401. |
| **Tick location** | SCRAM state is ticked in `sim/player-physics.js tickReactorScram(dt)`, called from `sim/index.js` line 306. Runs before `tickCoolantLeak`. |

**Flow:**
```
sim/index.js update(dt)
  → tickReactorScram(dt)     ← SCRAM recovery countdown (75s), EPM speed enforcement
  → tickCrashDive(dt)        ← combined manoeuvre SCRAM risk check
  → tickCoolantLeak(dt)      ← coolant leak → SCRAM on timer expiry
  → _DMG.tick(dt)
    → hit() → SCRAM on reactor damage, primary coolant offline, runaway
```

---

### A5. Primary Coolant Leak (Runtime)

| Field | Value |
|---|---|
| **Parent system** | Player physics — `tickCoolantLeak()` |
| **Code location** | `src/sim/player-physics.js` — `tickCoolantLeak()`, lines 96-187 |
| **Trigger event** | Continuous check every frame. |
| **Conditions** | NOT diesel. NOT scrammed. NOT already leaking. Speed >= 90% of flank. Depth >= thermal layer bottom + 60m. Stress timer `_flankDepthT` accumulates. After threshold (15s, or 5s if coolant degraded), risk increases at 0.008/s (capped at 0.35). |
| **Tick location** | `sim/index.js` line 311 — `tickCoolantLeak(dt)`. Runs after `tickReactorScram` and `tickCrashDive`, before `_DMG.tick`. |

**Flow:**
```
sim/index.js update(dt)
  → tickReactorScram(dt)
  → tickCrashDive(dt)
  → tickCoolantLeak(dt)      ← THIS
    → accumulate _flankDepthT if at flank+depth
    → if risk roll succeeds → create _coolantLeak with 45s timer
    → tick timer (speed-modified)
    → at 50% → crew isolation roll
    → at 0 → triggerScram('coolant_leak')
```

---

### A6. Steam Leak (Combat)

| Field | Value |
|---|---|
| **Parent system** | Damage system — `hit()` function |
| **Code location** | `src/systems/damage/index.js` — `hit()`, lines 377-389 |
| **Trigger event** | Every combat hit, after flooding and system damage are applied. |
| **Conditions** | NOT already steam-leaking. NOT scrammed. Either `main_turbines` or `pressuriser` is `degraded` or worse. 12% chance per hit. |
| **Tick location** | `sim/player-physics.js tickCoolantLeak()` (same function, lines 158-164). Timer counts down. Auto-clears in 30-60 seconds. Speed capped to 7 kt via `effects.js getEffects()`. |

---

### A7. Turbine Trip (Combat + Runtime)

| Field | Value |
|---|---|
| **Parent system** | Two triggers: combat shock in `damage/index.js hit()`, throttle snap in `sim/player-physics.js tickCoolantLeak()` |
| **Code locations** | Combat: `damage/index.js hit()` lines 369-375. Throttle: `player-physics.js` lines 175-187. |
| **Trigger events** | Combat: every hit, 15% chance. Throttle: speed change > 10 kt/s, 20% chance per dt. |
| **Conditions** | NOT already tripped. NOT scrammed. NOT steam-leaking. |
| **Tick location** | `sim/player-physics.js tickCoolantLeak()` lines 167-172. Timer counts down 20-30 seconds. Speed capped to 12 kt via `effects.js getEffects()`. |

---

### A8. Reactor Runaway (Combat)

| Field | Value |
|---|---|
| **Parent system** | Damage system — `hit()` function |
| **Code location** | `src/systems/damage/index.js` — `hit()`, lines 392-407 |
| **Trigger event** | Combat hit with `severity > 0.6` to `reactor_comp`. |
| **Conditions** | NOT scrammed. Hit section is `reactor_comp`. 8% chance. |
| **Effects** | Broadcasts acoustic transient via `_broadcastTransient()`. Triggers SCRAM. Clears all other propulsion casualties. |
| **Tick location** | No ongoing tick — it's an instant event. The SCRAM it triggers is ticked by `tickReactorScram`. |

---

## PART B — NEW CASUALTIES

For each new casualty, I document:
1. Which **existing parent system** owns the trigger
2. Where **exactly** in the code the check is inserted
3. What **event** fires the check (frame tick, combat hit, player action, etc.)
4. The **full condition tree**
5. Where the **ongoing tick** runs in the game loop
6. **Dependencies** on other systems

---

### B1. Hot Run Torpedo

#### Trigger 1: Combat Hit to Fore Ends

| Field | Value |
|---|---|
| **Parent system** | Damage system — `hit()` function |
| **Insert location** | `src/systems/damage/index.js` — inside `hit()`, after fire ignition check (line ~353), before propulsion casualty checks (line ~367). New block: "Hot run check." |
| **Event** | Every combat hit. |
| **Condition tree** | `comp === 'fore_ends'` AND `severity > 0.30` AND at least one tube is loaded (check `player.tubes[]` for a loaded tube) AND `!player.damage.hotRunCountdown` (not already in a hot run) AND `Math.random() < 0.06`. |
| **What happens on trigger** | Set `player.damage.hotRunCountdown = 12`. Set `player.damage.hotRunTube` to a random loaded tube index. Lock that tube (cannot fire). Begin countdown. Comms: hot run report. |

#### Trigger 2: Torpedo Reload with Damaged Weapon Stowage

| Field | Value |
|---|---|
| **Parent system** | Player control — tube reload logic |
| **Insert location** | `src/sim/player-control.js` — inside `tickTubeOps(dt)`, at the point where a reload completes (tube transitions from reloading to ready). |
| **Event** | Reload completion. |
| **Condition tree** | `player.damage.systems.weapon_stow` is `degraded` or worse AND `!player.damage.hotRunCountdown` AND `Math.random() < 0.02` (degraded stowage) OR `Math.random() < 0.0005` (baseline, always). |
| **What happens on trigger** | Same as Trigger 1. The just-reloaded tube is the affected tube. |

#### Ongoing Tick

| Field | Value |
|---|---|
| **Tick parent** | New function: `tickHotRun(dt)` |
| **File** | `src/sim/player-physics.js` (or new file `src/systems/damage/casualty-runtime.js` if player-physics approaches 800 lines) |
| **Called from** | `sim/index.js update(dt)` — insert after `tickCoolantLeak(dt)` (line 311), before `_DMG.tick(dt)` (line 320). |
| **Tick logic** | Decrement `hotRunCountdown` by dt. At countdown <= 0: roll eject success (base 75%, modified by tube state, crew fitness, fire). On success: eject torpedo, damage tube to degraded, consume stock, acoustic transient +0.25, comms. On failure: apply torpedo-hit-equivalent damage to fore_ends via `DMG.hit()` with the torpedo's own warhead yield. Then sympathetic detonation roll (15%): if yes, instant flood fore_ends to 1.0, kill all crew in section, destroy all WTS1 systems. Acoustic transient +0.60. |

#### Dependencies

| System | Role |
|---|---|
| `tubes` system state | Modifies eject success probability |
| `weapon_stow` system state | Triggers hot run on reload |
| `fire` in fore_ends rooms | Modifies eject success probability |
| Crew fitness in `fore_ends` | Modifies eject success probability |
| `hit()` function | Called on detonation failure |
| `_broadcastTransient()` | Acoustic alert on eject or detonation |

---

### B2. Stuck Diving Planes

#### Trigger 1: Combat Damage to Planes Hydraulics

| Field | Value |
|---|---|
| **Parent system** | Damage system — `damageSystem()` |
| **Insert location** | `src/systems/damage/index.js` — inside or immediately after `damageSystem()` (line 96). Add a post-damage hook: if the system just transitioned to `offline` or `destroyed`, check for stuck planes. Alternatively, add the check inside `hit()` after the system damage loop (line ~334). |
| **Event** | System state transition of `planes_fwd_hyd` or `planes_aft_hyd` to `offline` or `destroyed`. |
| **Condition tree** | System is `planes_fwd_hyd` or `planes_aft_hyd`. New state is `offline` or `destroyed`. `!player.damage.stuckPlanes` (not already jammed). `Math.random() < 0.20`. |
| **What happens on trigger** | Determine which plane set (`fwd` or `aft`). Determine jam direction from current depth rate: if `player.vy > 0.5` → `dive`; if `player.vy < -0.5` → `rise`; else → `neutral`. Create `player.damage.stuckPlanes = { set, direction, recoveryT: rand(25,40), recovered: false }`. Comms: planes jam report. |

#### Trigger 2: Emergency Manoeuvre at Speed

| Field | Value |
|---|---|
| **Parent system** | Player physics — crash dive and emergency turn handlers |
| **Insert location** | `src/sim/player-physics.js` — inside `tickCrashDive(dt)` at the point where the crash dive or emergency turn executes. Also in `player-control.js` where emergency turn is initiated. |
| **Event** | Emergency turn or crash dive execution. |
| **Condition tree** | `player.speed > 15` (kt). `!player.damage.stuckPlanes`. `Math.random() < 0.08`. Determine which planes were under load: crash dive → aft planes; emergency turn → random (fwd or aft). |

#### Trigger 3: Hydraulic Wear (Random)

| Field | Value |
|---|---|
| **Parent system** | New runtime tick |
| **Insert location** | New function `tickStuckPlanes(dt)` — see Ongoing Tick. |
| **Event** | Frame tick. |
| **Condition tree** | `player.damage.systems.planes_fwd_hyd === 'degraded'` OR `player.damage.systems.planes_aft_hyd === 'degraded'`. `!player.damage.stuckPlanes`. `Math.random() < 0.0003 * dt`. Choose the degraded plane set. |

#### Ongoing Tick

| Field | Value |
|---|---|
| **Tick parent** | New function: `tickStuckPlanes(dt)` |
| **File** | `src/sim/player-physics.js` |
| **Called from** | `sim/index.js update(dt)` — insert after depth/buoyancy physics but before depth clamp. The stuck planes pitch effect must feed into the depth rate calculation. Specifically: after the normal plane authority calculation in `player-physics.js`, add the jammed plane contribution to `player.vy`. |
| **Tick logic** | If `stuckPlanes` is active and `!recovered`: apply pitch rate (0.6 m/s, or 1.0 m/s if speed > 15 kt) in the jam direction as an additive force on `player.vy`. Decrement `recoveryT` by dt. At `recoveryT <= 0`: roll recovery (85% base, modified by `hyd_main` state and section flooding). On success: set `recovered = true`, set planes system to `degraded`. On failure: set planes system to `destroyed`, mark `recovered = true` (jam persists but no longer counting down). |
| **Integration point** | The pitch force must be applied inside the depth physics calculation, not as a separate post-process. It competes with the player's ordered depth and the working plane set. |

#### Dependencies

| System | Role |
|---|---|
| `planes_fwd_hyd` / `planes_aft_hyd` | Trigger source and affected system |
| `hyd_main` system state | Modifies recovery probability |
| Flooding in plane section | Modifies recovery probability |
| Depth physics in `player-physics.js` | Integration point for pitch force |
| `getEffects()` | Already reads plane modes — must account for `stuckPlanes` |

---

### B3. Shaft Seal Failure

#### Trigger 1: Combat Hit to Aft Ends

| Field | Value |
|---|---|
| **Parent system** | Damage system — `hit()` function, via `damageSystem()` |
| **Insert location** | `src/systems/damage/index.js` — inside `hit()`, after system damage is applied to the hit section. Add a check: if `shaft_seals` just transitioned to `degraded` or worse, activate the leak. |
| **Event** | Combat hit to `aft_ends`. |
| **Condition tree** | `comp === 'aft_ends'`. `shaft_seals` post-hit state is `degraded`, `offline`, or `destroyed`. `!player.damage.shaftSealLeak`. 25% chance (but if seals went from nominal to degraded+ in this hit, the transition itself is the cause — the 25% is for whether the degradation produces an immediate leak vs just weakening the seal). |

#### Trigger 2: Sustained Flank Speed with Degraded Seals

| Field | Value |
|---|---|
| **Parent system** | New runtime tick (same pattern as coolant leak) |
| **Insert location** | New function `tickShaftSeal(dt)` in `src/sim/player-physics.js` |
| **Event** | Frame tick. |
| **Condition tree** | `player.damage.systems.shaft_seals` is `degraded` or worse. `!player.damage.shaftSealLeak`. `player.speed >= flankKts * 0.90`. Stress timer `player._sealStressT` accumulates. After 20 seconds, risk at 0.15% per second. |

#### Trigger 3: Random Seal Wear

| Field | Value |
|---|---|
| **Parent system** | Same runtime tick |
| **Condition tree** | `shaft_seals === 'degraded'`. `!player.damage.shaftSealLeak`. `Math.random() < 0.0001 * dt`. |

#### Ongoing Tick

| Field | Value |
|---|---|
| **Tick parent** | `tickShaftSeal(dt)` — handles both trigger checks and active leak |
| **File** | `src/sim/player-physics.js` |
| **Called from** | `sim/index.js update(dt)` — insert after `tickCoolantLeak(dt)`, before `_DMG.tick(dt)`. |
| **Tick logic (active leak)** | When `shaftSealLeak === true`: compute `leak_rate = base * (1 + (speed/maxSpeed)^2) * pressureMult`. Add `leak_rate * dt` to `player.damage.flooding.aft_ends`. This bypasses the normal `floodRate` field because the rate is dynamic (speed-dependent) and must be recalculated every frame. The rate is added directly to the flooding level, alongside any existing combat flooding. DC team suppression via normal flood-fighting mechanics still applies (subtracts from the flooding level). |
| **Integration point** | The leak contribution is added inside `_DMG.tick()` in `damage/index.js`, in the flooding loop for `aft_ends`, as an additional source alongside `floodRate`. Add a new block: "Shaft seal leak contribution" before the flood threshold checks. |

**Important note:** The leak cannot be fully repaired. DC teams can repair `shaft_seals` to `degraded` (from `offline`/`destroyed`), which reduces the base rate, but `shaftSealLeak` remains `true` permanently. The `destroyed` state doubles the base rate. The only way to stop the leak is to reduce speed to near-zero (where the rate approaches but never reaches zero).

#### Dependencies

| System | Role |
|---|---|
| `shaft_seals` system state | Trigger and rate modifier |
| `player.speed` | Directly affects leak rate every frame |
| `player.depth` via pressure multiplier | Affects leak rate |
| Flooding system in `damage/index.js` | Integration point for leak contribution |
| DC team flood-fighting | Counteracts leak |
| `getEffects()` | Must not double-count shaft seal flooding vs normal flooding |

---

### B4. Battery Hydrogen Buildup and Explosion

#### Hydrogen Accumulation (Continuous)

| Field | Value |
|---|---|
| **Parent system** | New runtime tick |
| **Tick parent** | New function: `tickHydrogen(dt)` |
| **File** | `src/sim/player-physics.js` OR new file `src/systems/damage/atmosphere.js` (if we want to group hydrogen + chlorine together as atmosphere systems — recommended) |
| **Called from** | `sim/index.js update(dt)` — insert after `_DMG.tick(dt)` (line 320). Atmosphere ticks run after damage processing because they depend on current fire state, system state, and flooding levels. |
| **Accumulation logic** | Every frame: determine current charge rate. Nuclear boats: trickle charge when reactor online (0.008/s effective); zero during SCRAM. Type 209: snorkel rate (0.003/s) or surface rate (0.005/s) or zero when submerged on battery. Determine ventilation state from `vent_plant` system. Compute `h2_rate = charge_rate * 0.0008 * ventilation_modifier`. Add to `player.damage.h2Level`. Subtract natural decay (0.001/s). Subtract forced ventilation (0.05/s if at PD or shallower and crew initiates). |
| **Comms triggers** | At 0.25 (CAUTION): warn once. At 0.50 (DANGER): warn once. At 0.75 (EXPLOSIVE): warn once, continuous. |

#### Ignition Check (Conditional)

| Field | Value |
|---|---|
| **Parent system** | Same `tickHydrogen(dt)` function |
| **Event** | Frame tick, only when h2Level >= 0.50. |
| **Condition tree** | At EXPLOSIVE (>= 0.75): full ignition probabilities per second. At DANGER (0.50-0.75): half probabilities. Below 0.50: no ignition check. Sources checked every frame: `elec_dist` degraded+ (3%/s at explosive); fire in battery room (8%/s); random spark (0.05%/s). |
| **Combat hit ignition** | NOT in the frame tick. This is checked inside `damage/index.js hit()` — when a hit occurs to the section containing the battery AND h2Level >= 0.50, 40% ignition chance. Insert this check in `hit()` after system damage, alongside the existing fire ignition check. |

#### Explosion Event

| Field | Value |
|---|---|
| **Parent system** | Called from `tickHydrogen()` when ignition succeeds, or from `hit()` on combat ignition |
| **Function** | New function: `detonateHydrogen()` in the atmosphere module |
| **Effects** | Set all systems in the battery room to `destroyed`. Add those system keys to `player.damage.permanentDamage` Set. Crew casualties in battery room and adjacent rooms (60-80% killed, remainder wounded critical). Fire ignition: 90% in battery room, 50% in adjacent rooms — call `igniteFire()`. Hull damage: `player.hp -= 15`. Acoustic transient: `_broadcastTransient(+0.35)`. Reset `h2Level` to 0 (the hydrogen is consumed). Comms: explosion sequence. |

**New system required: `vent_plant`**

| Field | Value |
|---|---|
| **Added to** | `damage-data.js SYS_DEF` |
| **Key** | `vent_plant` |
| **Room** | `aux_section_d1b` (VENT PLANT — room already exists) |
| **Section** | WTS 3 |
| **States** | `nominal`, `degraded`, `offline`, `destroyed` — standard progression |
| **Damage source** | Combat hits to WTS 3, fire damage in the room, flooding deck damage |

**New system required: nuclear `battery_bank`**

| Field | Value |
|---|---|
| **Added to** | `damage-data.js SYS_DEF` |
| **Key** | `battery_bank` (already exists for diesel — add for nuclear with `nuclearOnly: false, dieselOnly: false` or remove the `dieselOnly` flag) |
| **Room** | `engine_room_d2` (AFT ATMOS) for nuclear boats. Already `engine_room_d1` for diesel. |
| **Note** | The existing `battery_bank` in `SYS_DEF` has `dieselOnly: true`. Change to remove this flag so it appears on all vessels. The room may need to differ by vessel type — nuclear boats store batteries near the emergency diesel. |

#### Dependencies

| System | Role |
|---|---|
| `vent_plant` system state | Controls ventilation modifier |
| `battery_bank` system state | Destroyed battery stops charging (stops H2 production) |
| `elec_dist` system state | Ignition source |
| Fire system | Ignition source (fire in battery room) |
| `hit()` function | Combat hit ignition source |
| `player.depth` | Force ventilation only at PD or shallower |
| `player.scram` | Affects charge rate on nuclear boats |
| `igniteFire()` | Called on explosion |
| `_broadcastTransient()` | Acoustic alert |
| `permanentDamage` Set | New concept — blocks DC team repair |
| `dc-teams.js` repair logic | Must check `permanentDamage` before starting repair |

---

### B5. Snorkel Flooding (Type 209 Only)

#### Trigger 1: Combat Hit While Snorkelling

| Field | Value |
|---|---|
| **Parent system** | Damage system — `hit()` function |
| **Insert location** | `src/systems/damage/index.js` — inside `hit()`, after the existing fire and casualty checks. New block: "Snorkel flood check." |
| **Event** | Combat hit. |
| **Condition tree** | `C.player.isDiesel`. Snorkel is currently active (check snorkel state flag — `player.snorkelling` or equivalent). `Math.random() < 0.30`. |
| **What happens** | Roll severity (50% minor, 35% major, 15% catastrophic). Apply effects per severity level. Set `player.damage.snorkelFloodActive = true`. Auto-secure snorkel. |

#### Trigger 2: Wave-Over at Speed

| Field | Value |
|---|---|
| **Parent system** | New runtime tick |
| **Insert location** | New function `tickSnorkelFlood(dt)` in `src/sim/player-physics.js` or `src/systems/damage/atmosphere.js` |
| **Event** | Frame tick while snorkelling. |
| **Condition tree** | `C.player.isDiesel`. Snorkel active. `player.speed > 4` (kt). `Math.random() < 0.002 * dt`. |

#### Trigger 3: Random Valve Failure

| Field | Value |
|---|---|
| **Parent system** | Same runtime tick |
| **Condition tree** | `C.player.isDiesel`. Snorkel active. `Math.random() < 0.0002 * dt`. |

#### Ongoing Tick

| Field | Value |
|---|---|
| **Tick parent** | `tickSnorkelFlood(dt)` |
| **Called from** | `sim/index.js update(dt)` — alongside other diesel-specific ticks. Insert near existing snorkel/battery logic. |
| **Tick logic** | When `snorkelFloodActive`: apply flooding to `reactor_comp` (diesel engine compartment) at the severity-dependent rate. If valve not yet closed: decrement valve close timer (15s if hyd_main damaged, 5s normal). When valve closes, flooding stops (for minor/major) or flooding rate reduces (catastrophic — requires additional DC intervention). |

#### Dependencies

| System | Role |
|---|---|
| Snorkel state | Must be active to trigger |
| `diesel_engine` system | Damaged/destroyed by the event |
| `hyd_main` system | Affects valve close time |
| Flooding system | Provides the flooding mechanic for reactor_comp |
| Diesel-specific flag `C.player.isDiesel` | Gates all checks |

---

### B6. Chlorine Gas (Type 209 Only)

#### Trigger: Flooding Reaches Battery Bank

| Field | Value |
|---|---|
| **Parent system** | New atmosphere tick — **not** triggered by a discrete event, but by a continuous condition |
| **Tick parent** | New function: `tickChlorine(dt)` |
| **File** | `src/systems/damage/atmosphere.js` (grouped with hydrogen) |
| **Called from** | `sim/index.js update(dt)` — after `_DMG.tick(dt)`, alongside `tickHydrogen(dt)`. |
| **Condition check** | Every frame: `C.player.isDiesel` AND `player.damage.flooding.engine_room >= 0.33` (water has reached mid-deck where battery_bank sits). |
| **Generation** | `cl2_rate = flooding_level * 0.015`. Added to `player.damage.cl2Level` every frame. |

There is no discrete "trigger event" — chlorine generation is a continuous consequence of flooding contacting the battery. It starts automatically when the flooding threshold is crossed and stops when the flooding recedes below 0.33 or the battery bank is destroyed (no more acid to react with).

#### Gas Spread (Continuous)

| Field | Value |
|---|---|
| **Tick logic** | Gas level increases in WTS 5. At `lethalLevel` (0.60), crew is evacuated from WTS 5 (same mechanic as fire evacuation — reuse `_evacuated` flag). Gas spreads to adjacent sections through open WTDs at 25% of the WTS 5 concentration. Closing WTDs reduces spread by 75%. |
| **Clearance** | Surface: 0.08/s. Snorkel: 0.03/s. Natural decay: 0.002/s. Clearance only occurs when the source has stopped (flooding below 0.33 or battery destroyed). |

#### Effects Application

| Field | Value |
|---|---|
| **Integration point** | `effects.js getEffects()` — add chlorine effects to the existing effects calculation. At trace: 20% crew efficiency reduction in WTS 5. At hazardous: 50% DC team effectiveness in WTS 5, 10% sonar detection penalty. At lethal: DC teams cannot enter WTS 5 (block in `dc-teams.js _canReachComp()`). |
| **Casualty tick** | At hazardous+: 5% wound chance per 10 seconds for crew in WTS 5. At lethal+: crew evacuation. At saturated: 3% wound chance per 10 seconds in adjacent sections. Implemented in `tickChlorine(dt)` using the same `_injureComp` function as combat casualties. |

#### Dependencies

| System | Role |
|---|---|
| Flooding level in `engine_room` | Source condition |
| `battery_bank` system state | Destroyed = source stops |
| WTD states | Controls gas spread rate |
| `dc-teams.js _canReachComp()` | Must check chlorine level before allowing entry |
| `effects.js getEffects()` | Applies efficiency penalties |
| Crew evacuation mechanics | Reused for lethal gas evacuation |
| `_injureComp()` | Reused for gas casualties |

---

### B7. Electrical Fire (Enhancement)

#### Trigger 1: Damaged Electrical Distribution

| Field | Value |
|---|---|
| **Parent system** | Damage tick — `_DMG.tick()` |
| **Insert location** | `src/systems/damage/fires.js` — inside `_tickFire(dt, d)`, at the top before the per-room fire growth loop. New block: "Electrical fire ignition check." |
| **Event** | Frame tick. |
| **Condition tree** | `elec_dist` is `degraded`: 0.08% per second (`Math.random() < 0.0008 * dt`). `elec_dist` is `offline` or `destroyed`: 0.25% per second. If triggered: `igniteFire('engine_room', 0.05)` — fire starts in WTS 5 where elec_dist is located. |

#### Trigger 2: Damaged System in Unmanned Space

| Field | Value |
|---|---|
| **Parent system** | Same location in `_tickFire()` |
| **Condition tree** | For each room with `detectionDelay > 30`: check if any system in that room is `degraded` or worse. If yes: 0.02% per second. Fire starts in that specific room at 0.05. |

#### Ongoing Tick

No new tick needed. The fire, once ignited, is handled by the existing `_tickFire` system. The only new code is the ignition check at the top of `_tickFire`.

#### Dependencies

| System | Role |
|---|---|
| `elec_dist` system state | Primary trigger |
| Any system state in unmanned rooms | Secondary trigger |
| `igniteFire()` | Standard fire ignition |
| Existing fire tick | Handles growth, spread, suppression |

---

### B8. Hydraulic System Failure (Enhancement)

#### Trigger: System Damage to `hyd_main`

| Field | Value |
|---|---|
| **Parent system** | Initialised when `hyd_main` is damaged (via `damageSystem()`). Ticked continuously. |
| **Insert location** | New function: `tickHydraulic(dt)` |
| **File** | `src/sim/player-physics.js` |
| **Called from** | `sim/index.js update(dt)` — insert after `tickCoolantLeak(dt)`, before `_DMG.tick(dt)`. |
| **Tick logic** | Every frame: check `hyd_main` state. If `degraded`: pressure drops at 0.005/s. If `offline`: 0.02/s. If `destroyed`: 0.05/s. If `nominal` and pressure < 1.0: pressure recovers at 0.01/s. Apply pressure effects to WTD operation speed and plane modes. |

#### Hydraulic Fire (Sub-trigger)

| Field | Value |
|---|---|
| **Within** | `tickHydraulic(dt)` |
| **Condition tree** | `hyd_main` is `offline` or `destroyed`. Pressure is actively dropping (current pressure > 0 and state is not nominal). 0.3% per second. Fire starts in `control_room_d2` (MACHINERY SPACE) at 0.15 via `igniteFire()`. |

#### Effects Integration

| Field | Value |
|---|---|
| **Integration point** | `effects.js getEffects()` — replace the current binary hyd_main checks with pressure-based thresholds. Above 0.60: normal. 0.30-0.60: sluggish WTDs (+50% time). Below 0.30: WTDs cannot open, planes on air-emergency. Below 0.10: complete failure, WTDs frozen. |
| **WTD operation** | `flooding.js toggleWTD()` must check hydraulic pressure before toggling. |
| **Initial state** | `player.damage.hydPressure = 1.0` — set in `initDamage()`. |

#### Dependencies

| System | Role |
|---|---|
| `hyd_main` system state | Determines leak rate |
| `effects.js getEffects()` | Applies pressure-based effects |
| `flooding.js toggleWTD()` | Must check pressure |
| `igniteFire()` | Hydraulic fire |
| DC team repair of `hyd_main` | Stops leak, begins recovery |

---

## PART C — GAME LOOP INTEGRATION

### Updated Tick Order in `sim/index.js update(dt)`

```
tickTubeOps(dt)           ← existing: tube reload, pending fires
tickPendingFires(dt)      ← existing

tickReactorScram(dt)      ← existing: SCRAM recovery, EPM
tickCrashDive(dt)         ← existing: crash dive execution, combined SCRAM risk

tickCoolantLeak(dt)       ← existing: coolant leak trigger + tick, steam/turbine ticks
tickHydraulic(dt)         ← NEW: hydraulic pressure loss/recovery, hydraulic fire
tickShaftSeal(dt)         ← NEW: seal stress trigger, active leak rate calc
tickHotRun(dt)            ← NEW: countdown, eject/detonate resolution
tickStuckPlanes(dt)       ← NEW: recovery countdown, pitch force (feeds into depth physics)
tickSnorkelFlood(dt)      ← NEW (diesel only): snorkel flood trigger + valve close tick

_DMG.tick(dt)             ← existing: flooding (+ shaft seal leak integration),
                             WTD auto-close/open, DC teams, fire (+ electrical fire
                             ignition), drench, medical

tickHydrogen(dt)          ← NEW: H2 accumulation, ignition check, explosion
tickChlorine(dt)          ← NEW (diesel only): Cl2 generation, spread, clearance, casualties

tickWatchFatigue(dt)      ← existing
```

### Integration Points Inside Existing Functions

| Function | New Code Added | Purpose |
|---|---|---|
| `damage/index.js hit()` | Hot run check (after fire, before propulsion casualties) | Combat trigger for hot run |
| `damage/index.js hit()` | Snorkel flood check (diesel, after casualties) | Combat trigger for snorkel flood |
| `damage/index.js hit()` | H2 combat ignition check (after system damage) | Combat trigger for hydrogen explosion |
| `damage/index.js hit()` | Shaft seal activation (after system damage to aft_ends) | Combat trigger for seal leak |
| `damage/index.js hit()` | Stuck planes check (after system damage to planes_*_hyd) | Combat trigger for stuck planes |
| `damage/index.js tick()` | Shaft seal leak contribution (in flooding loop, before thresholds) | Continuous speed-dependent flooding |
| `damage/fires.js _tickFire()` | Electrical fire ignition check (top of function) | Non-combat fire trigger |
| `damage/effects.js getEffects()` | Hydraulic pressure effects, chlorine effects, permanent damage check | Effect integration |
| `damage/dc-teams.js` | Permanent damage repair block, chlorine entry block | DC team constraints |
| `damage/index.js initDamage()` | New state properties (h2Level, cl2Level, hydPressure, etc.) | Initialisation |
| `sim/player-control.js tickTubeOps()` | Hot run on reload check | Reload trigger for hot run |

---

## PART D — PERMANENT DAMAGE CONCEPT

### Implementation

A new Set on `player.damage.permanentDamage` tracks system keys that cannot be repaired.

**Where it is checked:**
- `dc-teams.js` — in the repair task selection logic (`_nextRepairTarget` or equivalent). Before a team starts repairing a system, check `permanentDamage.has(sys)`. If true, skip to next candidate. The DC log reports: "BEYOND REPAIR AT SEA."
- `damage/index.js _nextRepairTarget()` — filter out permanent systems from the repairable list.

**Where it is set:**
- `detonateHydrogen()` — adds all systems in the blast room to the set.

**Display:**
- `render/panels/render-dc.js` — systems in `permanentDamage` are displayed with a distinct marker (e.g., struck-through or red "PERM" label) instead of the normal state colour.

---

*Casualty Trigger Map v1.0 — Steady Bubble — 2026-03-19*
