# Casualty System Upgrade — Design Specification

**Version:** 1.0
**Date:** 2026-03-19
**Status:** DRAFT — Awaiting review and approval before implementation

---

## 1. Scope

This document specifies the full upgrade to the casualty and emergency systems in Steady Bubble. It covers:

- Six new casualty types to be added
- Enhancements to two existing systems
- Trigger conditions, mechanical effects, crew response, player interaction, and permanence for each

All new casualties must have a defined in-game cause. Random-chance triggers (representing poor maintenance, material fatigue, or operational wear) are permitted but must be set at exceptionally low probability — the player should never feel that the game is being unfair, only that submarines are dangerous machines.

**Constraint:** No changes to the 800-line file limit, module contract, or import direction rules defined in ARCHITECTURE.md. New systems hook into the existing `damage/` module structure. New constants go into `constants.js` under a `casualties` sub-object.

---

## 2. Existing Systems — No Changes Required

The following casualties are implemented and require no modification:

| Casualty | Trigger | Status |
|---|---|---|
| Flooding (combat) | Torpedo hit | Complete |
| Flooding (depth cascade) | Exceeding crush depth | Complete |
| Fire (combat) | Torpedo hit, high severity | Complete |
| Fire spread | Adjacent rooms, open WTDs | Complete |
| Reactor SCRAM | Coolant failure, shock, direct hit | Complete |
| Primary coolant leak | Flank speed at depth, runtime stress | Complete |
| Steam leak | Hit to degraded turbines/pressuriser | Complete |
| Turbine trip | Combat shock, throttle snap | Complete |
| Reactor runaway | Severe hit to reactor section | Complete |
| Crew casualties/medical | Combat, flooding, fire | Complete |
| DC team operations | Auto-dispatch on emergency | Complete |
| N2 drench | Fire suppression, manual/auto | Complete |
| Emergency blow | Player-initiated | Complete |
| Escape systems (TCE/rush) | End-game survival | Complete |

---

## 3. New Casualty: Hot Run Torpedo

### 3.1 Description

A torpedo in its tube suffers a propulsion motor malfunction — the engine ignites while the weapon is still loaded. The warhead begins its arming countdown. The torpedo room crew must flood the tube and emergency-eject the weapon before it detonates inside the boat.

### 3.2 Trigger Conditions

| Trigger | Probability | Conditions |
|---|---|---|
| Combat hit to WTS 1 (Fore Ends) | 6% per hit | At least one tube loaded. Severity > 0.30. |
| Weapon stowage system degraded+ | 2% per torpedo reload commenced | `weapon_stow` is `degraded` or worse. |
| Random material failure | 0.05% per torpedo reload commenced | Baseline — represents manufacturing defect or age. |

A hot run can only occur if at least one tube is loaded. The specific tube affected is chosen randomly from loaded tubes.

### 3.3 Mechanical Effects

**Phase 1 — Detection (0-3 seconds):**
- Torpedo room crew detects the motor start. Comms report: "HOT RUN, HOT RUN — TUBE [X]."
- The affected tube is locked — it cannot be used for normal firing.
- A countdown begins: **12 seconds** to detonation.

**Phase 2 — Emergency Procedures (3-12 seconds):**
- The torpedo room crew automatically begins emergency flood-and-eject procedures.
- Base success probability: **75%** (crew floods tube and ejects weapon before detonation).
- Modifiers:
  - Tubes system `degraded`: -15% (hydraulic sluggishness).
  - Tubes system `offline`: -30% (manual operation only).
  - Tubes system `destroyed`: automatic failure (no outer door operation).
  - Fore Ends crew < 50% fit: -20% (insufficient hands).
  - Fire active in torpedo room: -10% (working conditions).

**Phase 3a — Successful Eject:**
- The torpedo is ejected into the water. It runs on its current heading (away from the boat).
- The ejected torpedo is **not wire-guided** — it runs dumb on last heading until seeker activates or fuel exhausts.
- Acoustic transient: +0.25 (loud emergency blow of tube).
- The affected tube is damaged to `degraded` state (emergency operation stress).
- One torpedo is consumed from stock.
- HPA cost: 2 bar (impulse air).

**Phase 3b — Detonation (failure):**
- The torpedo warhead detonates inside the tube.
- Damage equivalent to **a direct torpedo hit on WTS 1** at the torpedo's own warhead yield.
- Additional effects:
  - All tubes in the section go to `destroyed`.
  - Weapon stowage goes to `destroyed`.
  - Sympathetic detonation risk: **15%** chance that adjacent stored weapons detonate, causing a second hit's worth of damage to WTS 1. If this occurs, WTS 1 is catastrophically flooded (instant flood to 1.0) and all crew in the section are killed.
  - Massive acoustic transient: +0.60 (equivalent to an active ping datum).

### 3.4 Player Interaction

The player cannot directly intervene. The crew handles the emergency autonomously. The player's prior decisions determine the outcome:

- Keeping the torpedo room manned and systems maintained increases success probability.
- Firing from damaged tubes increases hot run risk on subsequent reloads.
- The player sees the countdown on the DC panel and hears the comms exchange.

### 3.5 Comms Sequence

```
TORPEDO ROOM — HOT RUN, HOT RUN — TUBE THREE. MOTOR RUNNING.
TORPEDO ROOM — FLOODING TUBE THREE. OPENING OUTER DOORS.
[success] TORPEDO ROOM — TUBE THREE EJECTED. WEAPON CLEAR OF THE HULL.
[failure] TORPEDO ROOM — [silence, then explosion sound effect]
CONN — DETONATION IN THE TORPEDO ROOM.
```

### 3.6 Permanence

- A failed hot run with sympathetic detonation permanently destroys the torpedo room as a functional space. Tubes, TMA, TDC computer, and weapon stowage are all `destroyed`. The boat can no longer fire torpedoes.
- A successful eject damages the affected tube to `degraded` (repairable).

---

## 4. New Casualty: Stuck Diving Planes

### 4.1 Description

The diving planes (forward or aft) jam in their current deflection angle. Instead of passively losing authority (the current model), the planes actively drive the boat toward an uncontrolled depth excursion. The crew must override with the opposite set of planes, adjust speed, or shift to emergency backup control.

### 4.2 Trigger Conditions

| Trigger | Probability | Conditions |
|---|---|---|
| Combat hit to planes hydraulic system | 20% per hit to `planes_fwd_hyd` or `planes_aft_hyd` | When the system transitions to `offline` or `destroyed`. |
| Emergency manoeuvre at speed | 8% per emergency turn or crash dive | Speed > 15 kt at time of manoeuvre. Applies to whichever planes were under load. |
| Random hydraulic seizure | 0.03% per second | Only when planes system is `degraded`. Represents contaminated hydraulic fluid or worn seals. |

### 4.3 Mechanical Effects

**Jam direction:** The planes lock at their current deflection. If the boat was diving, the planes hold in dive. If rising, they hold in rise. If neutral (within 0.5 degrees of zero), the jam is cosmetic (no active drive) and only removes that plane pair's authority.

**Active jam (dive or rise):**
- The jammed planes continuously drive the boat toward the depth extreme.
- The opposite plane pair must compensate. If both pairs jam, the boat has no active depth control.
- Effective pitch rate from jammed planes: **0.6 m/s** toward the jam direction (reduced from full 1.8 m/s because one plane pair alone has partial authority).
- Speed interaction: higher speed increases the jammed planes' effect. At 15+ kt, the pitch rate from jammed planes increases to **1.0 m/s**.

**Crew response (automatic):**
- The crew detects the jam within 2 seconds.
- Attempts to shift to backup control mode (air-emergency planes operation).
- Recovery time: **25-40 seconds** for the crew to regain manual override.
- During recovery, the jammed planes continue to drive the boat.
- Recovery probability: **85%** under normal conditions. -20% if the hydraulic plant (`hyd_main`) is `offline` or worse. -15% if the section is partially flooded.

**After recovery:**
- The planes system is set to `degraded` (reduced authority, air-emergency mode).
- Normal plane authority is restored at the degraded rate.

**If recovery fails:**
- The planes remain jammed for the remainder of the mission.
- The system is set to `destroyed`.
- The remaining plane pair must handle all depth control alone (approximately 55% normal authority).

### 4.4 Player Interaction

**During the jam:**
- The player sees the depth gauge moving toward the danger zone.
- The player can counter with speed changes: reducing speed reduces the jammed planes' drive effect.
- The player can use the opposite planes' authority by ordering depth in the opposite direction (the working planes fight the jammed ones).
- If the jam is toward depth, the player may need to order emergency blow before crush depth.
- If the jam is toward surface, the player may need to increase speed to drive the boat back down with the working planes.

**Player commands:** Standard depth controls (**W/S**) work on the unjammed planes. Speed reduction (**A**) reduces the jam's effect. Emergency blow if depth is critical.

### 4.5 Comms Sequence

```
DIVING OFFICER — PLANES JAM, [FORWARD/AFT] PLANES. JAMMED IN [DIVE/RISE].
HELMSMAN — SHIFTING TO BACKUP CONTROL.
DIVING OFFICER — DEPTH RATE [X] METRES PER SECOND, [INCREASING/DECREASING].
[recovery success] HELMSMAN — BACKUP CONTROL ESTABLISHED. [FORWARD/AFT] PLANES ON AIR-EMERGENCY.
[recovery failure] HELMSMAN — UNABLE TO RECOVER [FORWARD/AFT] PLANES. PLANES JAMMED HARD.
DIVING OFFICER — COMPENSATING ON [REMAINING] PLANES.
```

### 4.6 Permanence

- Successful recovery: planes system to `degraded` (repairable by DC teams).
- Failed recovery: planes system to `destroyed` (repairable but long repair time — 120 seconds).
- If both plane pairs are jammed/destroyed, depth control is effectively lost. The boat relies entirely on buoyancy (ballast/blow).

---

## 5. New Casualty: Shaft Seal Failure

### 5.1 Description

The propeller shaft passes through the hull via a series of mechanical seals in the Aft Ends (WTS 6). These seals can degrade and begin leaking. Unlike a torpedo breach, shaft seal flooding is progressive and speed-dependent — faster shaft rotation increases the leak rate.

### 5.2 Trigger Conditions

| Trigger | Probability | Conditions |
|---|---|---|
| Combat hit to WTS 6 (Aft Ends) | 25% per hit | Shaft seals system transitions to `degraded` or worse. |
| Sustained flank speed | 0.15% per second | Speed >= 90% of flank speed AND `shaft_seals` is `degraded` or worse. Timer starts after 20 seconds at flank. |
| Random seal wear | 0.01% per second | Only when `shaft_seals` is `degraded`. Represents material fatigue. |

### 5.3 Mechanical Effects

**Leak rate formula:**
```
leak_rate = base_rate * (1 + speed_factor) * depth_pressure_mult
```

Where:
- `base_rate`: 0.003 units/s (slower than torpedo breach at 0.008).
- `speed_factor`: `(current_speed / max_speed)^2` — quadratic relationship. At creep, nearly zero. At flank, doubles the leak rate.
- `depth_pressure_mult`: same as existing flooding — 1x per 120m depth, capping at 5x.

**Resulting leak rates (approximate, at 300m depth):**

| Speed | Leak Rate | Time to Fill WTS 6 |
|---|---|---|
| 3 kt (creep) | ~0.004 units/s | ~4 minutes |
| 10 kt | ~0.005 units/s | ~3.5 minutes |
| 20 kt (full) | ~0.009 units/s | ~2 minutes |
| 28 kt (flank) | ~0.012 units/s | ~1.5 minutes |

**The trade-off:** The player needs speed for plane authority and evasion, but speed makes the leak worse. Reducing to creep nearly stops the leak but removes the ability to manoeuvre or maintain depth.

**Crew response:**
- DC teams can fight shaft seal flooding using the same mechanics as combat flooding.
- DC suppression rate: 0.055 units/s * team effectiveness (same as existing).
- At creep speed, a functional DC team can hold the leak indefinitely (suppression > leak rate).
- At flank speed, the DC team is overwhelmed (leak rate > suppression).

**System cascade:**
- As WTS 6 floods, systems in Aft Ends take damage: steering, aft planes hydraulics, towed array, shaft seals (further degradation creates a feedback loop).
- Aft trim tank damage from flooding degrades trim authority.

### 5.4 Player Interaction

This is the key tactical decision: **speed versus survival.**

- Reduce speed to slow the leak. At 3 kt, DC teams can hold it.
- Increase speed to maintain combat effectiveness, but the leak accelerates.
- The player must manage this trade-off throughout the remainder of the mission.
- If the leak becomes uncontrollable (WTS 6 floods), the boat loses steering and aft planes — depth control is severely compromised.

**Player commands:** Speed controls (**A/D**) are the primary tool. Standard DC panel monitoring (**H**).

### 5.5 Comms Sequence

```
AFT ENDS — SHAFT SEAL FAILURE. WATER INGRESS AFT OF FRAME [X].
AFT ENDS — SHAFT SEAL LEAK RATE INCREASING WITH SPEED.
[if DC team dispatched] BRAVO — EN ROUTE TO AFT ENDS. SHORING SHAFT SEALS.
[if speed reduced] AFT ENDS — LEAK RATE DECREASING. SHAFT ROTATION SLOWED.
[if section flooding critical] AFT ENDS — FLOODING AFT ENDS UNCONTROLLED. REQUEST SEAL SECTION.
```

### 5.6 Permanence

- The shaft seal leak **cannot be permanently repaired at sea**. DC teams can suppress it but the underlying seal damage persists.
- If `shaft_seals` reaches `destroyed`, the base leak rate doubles (0.006 units/s) and cannot be reduced below this.
- The speed-dependent flooding is a permanent mission condition once triggered.

---

## 6. New Casualty: Battery Hydrogen Buildup and Explosion

### 6.1 Description

All submarines carry battery banks — nuclear boats for emergency propulsion (EPM), diesel boats as the primary power source. During charging, the electrolytic process produces hydrogen gas as a byproduct. Hydrogen is lighter than air and accumulates in the upper spaces of the battery compartment. If the concentration reaches a critical threshold and an ignition source is present, the hydrogen detonates.

This casualty applies to **all vessels**, not just the Type 209.

### 6.2 Trigger Conditions — Hydrogen Accumulation

Hydrogen accumulates whenever the battery is charging. The accumulation rate depends on charge rate and ventilation status.

**Accumulation formula:**
```
h2_rate = charge_rate * h2_generation_factor * ventilation_modifier
```

Where:
- `charge_rate`: current battery charge rate (varies by vessel and charging method).
  - Nuclear boats: automatic trickle charge when reactor online — very low rate (0.008/s).
  - Nuclear boats during SCRAM recovery: zero (no charging).
  - Type 209 snorkel: 0.003/s.
  - Type 209 surface: 0.005/s.
- `h2_generation_factor`: 0.0008 — converts charge rate to hydrogen accumulation.
- `ventilation_modifier`:
  - Ventilation nominal: 0.1 (ventilation removes 90% of hydrogen as fast as it is produced).
  - Ventilation degraded: 0.4.
  - Ventilation offline/destroyed: 1.0 (no removal — full accumulation).
  - Submerged with hatches closed: always 1.0 modifier on top of ventilation (cannot vent to atmosphere).

**Ventilation system:** The vent plant in WTS 3 (`aux_section_d1b`, room "VENT PLANT") handles atmosphere management. This room is currently defined in `damage-data.js` but the ventilation system is not tracked as a separate damageable system. **This upgrade adds `vent_plant` as a new system in WTS 3.**

**Hydrogen level:** Tracked as a 0-1 scale on `player.damage.h2Level`.
- Below 0.25: safe. Normal operations.
- 0.25-0.50: **CAUTION.** Crew reports elevated hydrogen. Warning to Conn.
- 0.50-0.75: **DANGER.** Crew reports dangerous hydrogen concentration. Recommendation to ventilate.
- 0.75-1.0: **EXPLOSIVE.** Any ignition source detonates the battery well.

**Natural decay:** Hydrogen dissipates slowly even without active ventilation — atmospheric mixing and absorption. Decay rate: 0.001/s (very slow — approximately 15 minutes to go from 0.75 to 0.0 with no new production).

**Forced ventilation (surface only):** If the boat is at periscope depth or shallower with the snorkel/hatches available, the crew can force-ventilate the battery well. This clears hydrogen at 0.05/s (approximately 15 seconds to clear from 0.75 to 0.0). However, this requires being shallow — tactically dangerous.

### 6.3 Trigger Conditions — Ignition

When hydrogen level reaches the **EXPLOSIVE** band (>= 0.75), the following ignition sources can trigger a detonation:

| Source | Probability per Second | Conditions |
|---|---|---|
| Electrical fault (combat damage) | 3.0% | `elec_dist` is `degraded` or worse. |
| Fire in battery compartment | 8.0% | Active fire in the room containing `battery_bank` (diesel) or `emerg_diesel` (nuclear). |
| Combat hit to battery section | 40% per hit | Direct hit to the section containing the battery. |
| Random spark | 0.05% | Baseline — represents static discharge, switching transient, etc. |

At the DANGER band (0.50-0.75), ignition probability is halved. Below 0.50, no ignition risk.

### 6.4 Mechanical Effects — Explosion

A hydrogen explosion is a **permanent, non-repairable event** with catastrophic localised damage.

**Blast effects:**
- All systems in the battery compartment room are set to `destroyed`.
- **Permanent flag:** These systems **cannot be repaired by DC teams** for the remainder of the mission. A new `permanent` damage state is applied (functionally identical to `destroyed` but repair is blocked).
- Crew in the battery compartment and adjacent rooms: high casualty rate (60-80% killed, remainder wounded critical).
- Fire ignition: 90% chance in the battery room, 50% chance in adjacent rooms within the section.
- Hull damage: 15 HP (less than a torpedo hit but significant).
- Acoustic transient: +0.35 (equivalent to a crash dive transient — loud but not as far-reaching as a torpedo detonation).

**Nuclear boats — specific effects:**
- Battery bank is in WTS 5 (Engine Room), room `engine_room_d1` (ELEC DIST).
- Wait — reviewing the data: nuclear boats don't have an explicit `battery_bank` system. The emergency diesel (`emerg_diesel`, room `engine_room_d2`) provides EPM power. The ship's battery is implicit.
- **This upgrade adds `battery_bank` as a system for nuclear boats** in `engine_room_d2` (co-located with the emergency diesel). When destroyed, EPM is unavailable — a subsequent SCRAM means zero propulsion.
- Systems destroyed: `elec_dist` (permanent), `battery_bank` (permanent). Cascade risk to `main_turbines`, `propulsion` (in adjacent rooms).
- Consequence: if the reactor subsequently SCRAMS, there is no EPM backup. The boat has zero propulsion.

**Diesel boats (Type 209) — specific effects:**
- Battery bank is already defined: `battery_bank` in `engine_room_d1`.
- Systems destroyed: `battery_bank` (permanent), `elec_dist` (permanent if in blast radius).
- Consequence: **all submerged propulsion is permanently lost**. The boat must surface immediately or sink. The diesel engine can provide propulsion on the surface only (snorkel or surfaced).

### 6.5 Player Interaction

**Prevention:**
- Monitor hydrogen level on the damage/status panel.
- Avoid sustained battery charging when ventilation is damaged.
- Surface to force-ventilate when hydrogen reaches CAUTION.
- Repair `vent_plant` system as a priority if damaged.
- On nuclear boats, the risk is low during normal operations (trickle charge produces minimal hydrogen). The risk spikes when the reactor SCRAMS and is restarted — the sudden charge demand on recovery produces a burst of hydrogen.

**During the event:**
- No player action can prevent the detonation once ignition occurs.
- The player must manage the aftermath: permanent system losses, fire, casualties, and the tactical implications of degraded or lost propulsion backup.

### 6.6 Comms Sequence

**Buildup warnings:**
```
MANEUVERING — HYDROGEN CONCENTRATION ELEVATED. [CAUTION/DANGER] LEVEL IN BATTERY WELL.
MANEUVERING — RECOMMEND VENTILATING BATTERY WELL. REQUEST PERMISSION TO COME SHALLOW.
MANEUVERING — HYDROGEN EXPLOSIVE CONCENTRATION. RECOMMEND IMMEDIATE VENTILATION.
```

**Explosion:**
```
[explosion sound effect — distinct from torpedo hit: sharper, more contained]
MANEUVERING — EXPLOSION IN THE BATTERY WELL. BATTERY BANK DESTROYED.
CONN — FIRE IN [SECTION]. EMERGENCY STATIONS.
[nuclear] EOOW — EPM BACKUP UNAVAILABLE. BATTERY DESTROYED.
[diesel] EOOW — ALL BATTERY POWER LOST. PROPULSION LOST. RECOMMEND EMERGENCY SURFACE.
```

### 6.7 Permanence

This is the defining characteristic of this casualty. **Hydrogen explosion damage cannot be repaired at sea.**

- Systems flagged `permanent` are treated as `destroyed` for all effect calculations but DC teams will not attempt repair. The DC log reports: "BEYOND REPAIR AT SEA."
- This is the only casualty in the game that produces truly irreversible system loss (other than crew killed, which is already permanent).

---

## 7. New Casualty: Snorkel Flooding (Type 209 Only)

### 7.1 Description

The snorkel mast head valve fails to seal properly. Seawater enters the diesel engine induction system. In mild cases, the diesels ingest water and stall. In severe cases, the induction piping floods and water enters the engine compartment.

### 7.2 Trigger Conditions

| Trigger | Probability | Conditions |
|---|---|---|
| Combat hit while snorkelling | 30% per hit | Snorkel mast is raised and operating. |
| Snorkelling in rough conditions | 0.2% per second | Speed > 4 kt while snorkelling (wave-over risk increases with speed). |
| Random valve failure | 0.02% per second | Only while snorkelling. Represents seal wear, corrosion, debris. |

### 7.3 Mechanical Effects

**Severity roll:** When triggered, roll severity:
- **Minor (50%):** Water slug enters the induction. Diesel engine stalls. Snorkel automatically secured. Battery charging interrupted. Diesel engine goes to `degraded` for 30-60 seconds (auto-recovery as crew clears the induction). No flooding.
- **Major (35%):** Significant water ingress through the induction piping. Diesel engine goes to `offline`. Flooding begins in WTS 4 (Engine Compartment on diesel boats — `reactor_comp`) at 0.005 units/s. Snorkel automatically secured. Crew must physically close the induction valve (15-second delay if `hyd_main` is damaged). Flooding stops once the valve is closed.
- **Catastrophic (15%):** The head valve breaks completely. Massive water ingress. Diesel engine goes to `destroyed`. Flooding in WTS 4 at 0.015 units/s (nearly as fast as a torpedo breach). The snorkel mast itself is damaged — cannot be raised again until repaired. The only way to stop the flooding is to close the induction valve (manual, 15 seconds) AND either dive below snorkel depth (gravity closes the flooded mast) or DC teams seal the penetration.

### 7.4 Player Interaction

**Prevention:**
- Snorkel at minimum speed (3-4 kt, not 5 kt). Reduces wave-over probability.
- Do not snorkel when under fire.
- Monitor snorkel time — longer snorkel sessions increase cumulative risk.

**During the event:**
- Press **S** to increase depth (dive away from snorkel depth). This automatically secures the snorkel and uses gravity to seal the mast.
- Monitor flooding in the engine compartment. If major or catastrophic, DC teams auto-dispatch.
- On catastrophic failure, the snorkel mast must be repaired before snorkelling can resume. If the mast cannot be repaired, the boat must surface fully to charge (maximum exposure).

### 7.5 Comms Sequence

```
[minor] EOOW — SNORKEL FLOOD. WATER IN THE INDUCTION. DIESEL STALLED. SECURING SNORKEL.
[major] EOOW — SNORKEL FLOOD, MAJOR. FLOODING ENGINE COMPARTMENT. SECURING SNORKEL. CLOSING INDUCTION VALVE.
[catastrophic] EOOW — SNORKEL HEAD VALVE FAILURE. CATASTROPHIC FLOODING THROUGH INDUCTION. ALL STOP ON SNORKEL. CLOSING INDUCTION MANUALLY.
```

### 7.6 Permanence

- Minor: temporary diesel degradation (auto-recovery).
- Major: diesel offline (repairable), flooding (manageable with DC teams).
- Catastrophic: snorkel mast `destroyed` (repairable but 120-second repair). Diesel `destroyed` (repairable). If the mast cannot be repaired, the boat must surface to charge for the remainder of the mission.

---

## 8. New Casualty: Chlorine Gas Generation (Type 209 Only)

### 8.1 Description

When seawater contacts the lead-acid battery bank, a chemical reaction produces chlorine gas. Chlorine is heavier than air and accumulates in the lower decks. It is lethal in enclosed spaces. On a diesel submarine where the battery is the primary power source, chlorine gas from a flooding battery compartment creates a compounding emergency — the crew is simultaneously fighting flooding, toxic atmosphere, and potential loss of propulsion.

### 8.2 Trigger Conditions

Chlorine gas is generated whenever **flooding reaches the battery bank room** on the Type 209.

**Conditions:**
- Vessel must be Type 209 (diesel-electric).
- Flooding in `engine_room` (WTS 5 on diesel boats) must reach the battery bank room (`engine_room_d1`).
- Flooding level in WTS 5 must be >= 0.33 (water has reached D2 mid-deck where the battery bank sits).

**Generation rate:**
```
cl2_rate = flood_level_in_section * 0.015
```

At 33% flooding (minimum contact): 0.005/s.
At 67% flooding: 0.010/s.
At 100% flooding: 0.015/s (maximum — but at this point the section is fully flooded and other problems dominate).

### 8.3 Mechanical Effects

**Chlorine level:** Tracked as 0-1 scale on `player.damage.cl2Level` (Type 209 only).

| Level | Classification | Effect |
|---|---|---|
| 0 - 0.15 | Clear | No effect. |
| 0.15 - 0.35 | Trace | Crew reports chemical smell. Warning to Conn. Crew efficiency in WTS 5 reduced by 20%. |
| 0.35 - 0.60 | Hazardous | Crew in WTS 5 begins taking casualties: 5% wound chance per 10 seconds. DC team effectiveness in WTS 5 halved. Sonar operators report difficulty concentrating (10% detection penalty — gas spreading through ventilation). |
| 0.60 - 0.85 | Lethal | WTS 5 is uninhabitable. All crew in WTS 5 are evacuated (same mechanic as fire evacuation). DC teams cannot enter WTS 5. 3% wound chance per 10 seconds in adjacent sections (WTS 4 and WTS 6) as gas spreads. |
| 0.85+ | Saturated | Adjacent sections (WTS 4, WTS 6) become hazardous. Crew casualties extend to these sections. If ventilation is running, gas spreads to WTS 3 at reduced concentration. |

**Gas spread:** Chlorine is heavier than air and spreads downward and through open WTDs. Closing the WTDs between WTS 4/5 and WTS 5/6 slows the spread by 75%.

**Gas clearance:** Chlorine does not dissipate on its own in a sealed submarine. It can only be cleared by:
- Surfacing and opening hatches (clears at 0.08/s — approximately 12 seconds from lethal to clear).
- Force ventilation at snorkel depth (clears at 0.03/s — approximately 30 seconds from lethal to clear). This routes the gas through the snorkel exhaust.
- Natural decay when the source stops (flooding recedes or battery is destroyed): 0.002/s (very slow — approximately 7 minutes from lethal to clear).

### 8.4 Player Interaction

**Prevention:**
- Prevent flooding from reaching the battery compartment. If WTS 5 is hit, DC teams should prioritise flood suppression.
- Close WTDs to slow gas spread if flooding cannot be stopped.

**During the event:**
- The player must decide: surface to ventilate (exposure risk) or accept the gas casualties and fight submerged.
- Closing WTDs between sections is the primary gas containment tool.
- If the battery bank is destroyed by flooding, the gas source stops — but the boat has also lost propulsion.
- Chlorine gas makes DC operations in the affected section impossible at lethal concentrations, which means the flooding that caused the gas cannot be fought from inside the section.

**This creates a death spiral:** Flooding produces gas. Gas drives out DC teams. Without DC teams, flooding is uncontrolled. Uncontrolled flooding produces more gas.

The player's options are: seal the section and accept the loss, or surface to ventilate and fight the flooding simultaneously.

### 8.5 Comms Sequence

```
[trace] MANEUVERING — CHEMICAL CONTAMINATION. CHLORINE GAS DETECTED IN THE MOTOR ROOM.
[hazardous] MANEUVERING — CHLORINE CONCENTRATION HAZARDOUS. CREW DONNING EMERGENCY BREATHING APPARATUS.
[lethal] MANEUVERING — CHLORINE LETHAL CONCENTRATION. EVACUATING MOTOR ROOM. DC TEAMS CANNOT ENTER.
[spread] CONN — CHLORINE SPREADING THROUGH VENTILATION. RECOMMEND SURFACE AND VENTILATE.
[saturated] CONN — GAS CONTAMINATION SPREADING TO ADJACENT SECTIONS. HATCHES MUST BE OPENED.
```

### 8.6 Permanence

- Chlorine gas itself is temporary — it clears when the source stops and ventilation is restored.
- However, the conditions that produce it (flooding + battery) often result in permanent battery loss, which on the Type 209 is mission-ending for submerged operations.
- Crew casualties from gas exposure are permanent (killed/wounded as normal).

---

## 9. Enhancement: Electrical Fire (Non-Combat)

### 9.1 Description

Currently, fires only start from combat hits. This enhancement adds spontaneous electrical fires from damaged wiring and overloaded circuits — a routine submarine emergency that can occur without combat.

### 9.2 Trigger Conditions

| Trigger | Probability per Second | Conditions |
|---|---|---|
| Electrical distribution `degraded` | 0.08% | Fire starts in a random room within the `elec_dist` section (WTS 5). |
| Electrical distribution `offline` | 0.25% | Same as above, higher probability. |
| Any system `degraded`+ in a room with fire detection delay > 30s | 0.02% | Represents smouldering wiring in unmanned spaces. |
| Battery hydrogen explosion aftermath | 100% (automatic) | Fire in the battery room is guaranteed after an explosion. Already covered in Section 6. |

### 9.3 Mechanical Effects

Electrical fires use the existing fire system — no new mechanics required. The fire starts at 0.05 (small) in the affected room and follows normal fire growth, spread, and suppression rules.

The key difference from combat fires:
- Electrical fires start **without a combat hit**. There is no associated hull damage, flooding, or crew casualties from the initial event. It is purely a fire.
- Electrical fires are more likely in unmanned spaces (longer detection delay before the crew notices).
- Electrical fires **can recur** from the same trigger if the underlying system damage is not repaired. A damaged electrical distribution system that causes one fire can cause another after the first is suppressed.

### 9.4 Player Interaction

Same as existing fire response. Press **H** to view damage screen, monitor DC LOG. DC teams handle suppression autonomously.

The new element is **prevention**: repairing damaged electrical systems before they cause fires. DC team prioritisation becomes more complex — do you repair the degraded `elec_dist` to prevent a fire, or send the team to fight the existing flooding?

### 9.5 Comms Sequence

```
[unmanned room detection] DAMAGE CONTROL — FIRE ALARM, [ROOM]. INVESTIGATION UNDERWAY.
[manned room] [SECTION] — ELECTRICAL FIRE, [ROOM]. WATCHKEEPERS RESPONDING.
[recurrence] [SECTION] — ELECTRICAL FIRE REIGNITION, [ROOM]. SOURCE IS DAMAGED DISTRIBUTION BOARD.
```

---

## 10. Enhancement: Hydraulic System Failure

### 10.1 Description

Currently, the main hydraulic plant (`hyd_main`) is a binary system: it works or it doesn't, and damage only comes from combat hits. This enhancement adds progressive hydraulic pressure loss and a fire risk from aerosolised hydraulic fluid.

### 10.2 New Mechanic: Hydraulic Pressure

**Hydraulic pressure** is tracked as a 0-1 scale on `player.damage.hydPressure` (1.0 = full pressure, 0.0 = no pressure).

**Pressure loss triggers:**
- `hyd_main` transitions to `degraded`: slow leak. Pressure drops at 0.005/s.
- `hyd_main` transitions to `offline`: moderate leak. Pressure drops at 0.02/s.
- `hyd_main` transitions to `destroyed`: rapid loss. Pressure drops at 0.05/s (empty in 20 seconds).
- Combat hit to WTS 2 when `hyd_main` is already damaged: immediate pressure loss of 20%.

**Pressure effects:**
| Pressure | Effect |
|---|---|
| 1.0 - 0.60 | Normal operations. All WTDs and planes hydraulic. |
| 0.60 - 0.30 | Sluggish WTD operation (+50% open/close time). Plane response delayed. |
| 0.30 - 0.10 | WTDs cannot be opened (insufficient pressure). Planes on air-emergency backup. |
| Below 0.10 | Complete hydraulic failure. WTDs frozen in current state. Planes on air-emergency. |

**Pressure recovery:** DC team repair of `hyd_main` gradually restores pressure at 0.01/s (approximately 100 seconds from empty to full). The system must be at least `degraded` (not `offline` or `destroyed`) for pressure to recover.

### 10.3 Hydraulic Fire Risk

When `hyd_main` is `offline` or worse and hydraulic pressure is dropping, there is a risk that the high-pressure hydraulic fluid aerosolises and ignites on contact with hot surfaces:

- Probability: 0.3% per second while pressure is actively dropping AND `hyd_main` is `offline` or `destroyed`.
- Fire starts in `control_room_d2` (MACHINERY SPACE — the room where `hyd_main` is located).
- Fire starts at 0.15 (moderate — the hydraulic fluid burns hot).
- This room has a 40-second detection delay (unmanned) — the fire can grow before the crew notices.

### 10.4 Player Interaction

- Monitor hydraulic pressure on the damage panel.
- Prioritise `hyd_main` repair to stop pressure loss and begin recovery.
- If pressure is dropping and WTDs need to be closed for flooding containment, close them NOW before pressure drops too low.
- Be aware that hydraulic failure makes subsequent emergencies harder to manage (WTDs stuck, planes degraded).

### 10.5 Comms Sequence

```
CONTROL ROOM — HYDRAULIC PRESSURE DROPPING. MAIN PLANT [DEGRADED/OFFLINE].
CONTROL ROOM — HYDRAULIC PRESSURE LOW. WTD OPERATION SLUGGISH.
CONTROL ROOM — HYDRAULIC PRESSURE CRITICAL. WTDS FROZEN. PLANES SHIFTING TO AIR-EMERGENCY.
[fire] DAMAGE CONTROL — FIRE ALARM, MACHINERY SPACE. HYDRAULIC FLUID FIRE.
```

---

## 11. New System Requirements

### 11.1 New Systems to Add to `SYS_DEF`

| System Key | Label | Room | Section | Notes |
|---|---|---|---|---|
| `vent_plant` | VENT PLANT | `aux_section_d1b` | WTS 3 | Atmosphere management. Affects hydrogen clearance. |
| `battery_bank` (nuclear) | BATTERY BANK | `engine_room_d2` | WTS 5 | Nuclear boats — EPM power source. Co-located with emergency diesel. |

The diesel `battery_bank` already exists. The nuclear `battery_bank` is new.

### 11.2 New State Properties on `player.damage`

| Property | Type | Default | Scope |
|---|---|---|---|
| `h2Level` | Number 0-1 | 0.0 | All vessels |
| `cl2Level` | Number 0-1 | 0.0 | Type 209 only |
| `hydPressure` | Number 0-1 | 1.0 | All vessels |
| `hotRunCountdown` | Number or null | null | All vessels — active during hot run |
| `hotRunTube` | Number or null | null | Tube index of active hot run |
| `stuckPlanes` | Object or null | null | `{ set: 'fwd'|'aft', direction: 'dive'|'rise'|'neutral', recoveryT: Number, recovered: Boolean }` |
| `shaftSealLeak` | Boolean | false | All vessels — true when shaft seal is actively leaking |
| `snorkelFloodActive` | Boolean | false | Type 209 only |
| `permanentDamage` | Set of system keys | empty Set | Systems that cannot be repaired |

### 11.3 New Constants (in `constants.js` under `player.casualties`)

```javascript
hotRun: {
  combatChance: 0.06,          // per hit to WTS1, severity > 0.30
  reloadChanceDegraded: 0.02,  // per reload when weapon_stow degraded+
  reloadChanceBase: 0.0005,    // per reload, baseline
  countdown: 12,               // seconds to detonation
  ejectBaseChance: 0.75,       // base success probability
  sympatheticChance: 0.15,     // chance of adjacent weapon detonation on failure
  acousticTransientEject: 0.25,
  acousticTransientDetonate: 0.60,
},
stuckPlanes: {
  combatChance: 0.20,          // per hit transitioning planes to offline+
  manoeuvreChance: 0.08,       // per emergency manoeuvre at >15kt
  wearChance: 0.0003,          // per second when planes degraded
  recoveryTime: [25, 40],      // seconds
  recoveryBaseChance: 0.85,
  jamPitchRate: 0.6,           // m/s from jammed planes
  jamPitchRateHighSpeed: 1.0,  // m/s at 15+ kt
},
shaftSeal: {
  combatChance: 0.25,          // per hit to WTS6
  flankRiskPerSec: 0.0015,     // per second at flank + degraded seals
  flankStressTime: 20,         // seconds at flank before risk begins
  wearChance: 0.0001,          // per second when degraded
  baseLeakRate: 0.003,
  destroyedLeakMult: 2.0,
},
hydrogen: {
  generationFactor: 0.0008,
  cautionLevel: 0.25,
  dangerLevel: 0.50,
  explosiveLevel: 0.75,
  naturalDecay: 0.001,
  forceVentRate: 0.05,
  elecFaultIgnitionPerSec: 0.03,
  fireIgnitionPerSec: 0.08,
  combatHitIgnition: 0.40,
  randomSparkPerSec: 0.0005,
  explosionHpDamage: 15,
  explosionTransient: 0.35,
},
chlorine: {  // Type 209 only
  floodThreshold: 0.33,
  generationRate: 0.015,
  traceLevel: 0.15,
  hazardousLevel: 0.35,
  lethalLevel: 0.60,
  saturatedLevel: 0.85,
  surfaceClearRate: 0.08,
  snorkelClearRate: 0.03,
  naturalDecay: 0.002,
  wtdSpreadReduction: 0.75,
},
electricalFire: {
  degradedChancePerSec: 0.0008,
  offlineChancePerSec: 0.0025,
  unmannedDamagedChancePerSec: 0.0002,
  startIntensity: 0.05,
},
hydraulic: {
  degradedLeakRate: 0.005,
  offlineLeakRate: 0.02,
  destroyedLeakRate: 0.05,
  combatPressureLoss: 0.20,
  recoveryRate: 0.01,
  sluggishThreshold: 0.60,
  failThreshold: 0.30,
  completeFailThreshold: 0.10,
  fireChancePerSec: 0.003,
  fireStartIntensity: 0.15,
},
snorkelFlood: {  // Type 209 only
  combatChance: 0.30,
  waveOverChancePerSec: 0.002,
  valveFailureChancePerSec: 0.0002,
  minorChance: 0.50,
  majorChance: 0.35,
  catastrophicChance: 0.15,
  majorFloodRate: 0.005,
  catastrophicFloodRate: 0.015,
  valveCloseTime: 15,
},
```

---

## 12. Implementation Order

Recommended implementation sequence, ordered by dependency and complexity:

| Phase | Casualty | Reason |
|---|---|---|
| 1 | Electrical fire (enhancement) | Simplest — hooks into existing fire system. No new state. Validates the non-combat trigger pattern. |
| 2 | Hydraulic system failure (enhancement) | Adds `hydPressure` state. Validates the progressive degradation pattern. Affects WTDs and planes — prerequisite understanding for stuck planes. |
| 3 | Stuck diving planes | Depends on understanding plane modes and hydraulic state. Requires new depth control interaction. |
| 4 | Shaft seal failure | New flooding mechanic (speed-dependent). Relatively self-contained. |
| 5 | Battery hydrogen buildup + explosion | Requires new `vent_plant` system and nuclear `battery_bank`. Adds the `permanent` damage concept. Largest new system. |
| 6 | Hot run torpedo | Requires countdown UI, probability checks on reload, and the sympathetic detonation chain. |
| 7 | Snorkel flooding (Type 209) | Diesel-specific. Requires snorkel state tracking. |
| 8 | Chlorine gas (Type 209) | Depends on flooding reaching battery compartment. Requires gas level tracking and spread mechanics. |

---

## 13. File Impact Assessment

| File | Changes |
|---|---|
| `config/constants.js` | Add all new constants under `player.casualties` |
| `config/vessels.js` | Add `battery_bank` system config for nuclear boats |
| `systems/damage/damage-data.js` | Add `vent_plant` and nuclear `battery_bank` to `SYS_DEF`. Add `permanent` to `STATES` or handle as a flag. |
| `systems/damage/casualty.js` | New casualty tick functions for each new type |
| `systems/damage/flooding.js` | Shaft seal leak integration, snorkel flood integration |
| `systems/damage/fires.js` | Electrical fire trigger integration |
| `systems/damage/effects.js` | Hydraulic pressure effects, permanent damage check, hydrogen/chlorine effects |
| `systems/damage/dc-teams.js` | Permanent damage blocks repair, chlorine gas blocks entry |
| `systems/damage/index.js` | Tick orchestration for all new systems |
| `state/sim-state.js` | New `damage` properties (h2Level, cl2Level, hydPressure, etc.) |
| `narrative/comms.js` | New comms templates for all casualties |
| `narrative/voice.js` | New voice lines for all casualties |
| `render/panels/render-dc.js` | Display hydrogen level, chlorine level, hydraulic pressure, hot run countdown, plane jam status |
| `ui/input.js` | No changes — player commands are unchanged |

**800-line constraint:** `casualty.js` is currently 193 lines. The new casualty tick functions will add approximately 300-400 lines. If it approaches 800, split into `casualty-runtime.js` (non-combat casualties) and `casualty.js` (combat and medical). Log the split in `DECISIONS.md`.

---

*Casualty System Upgrade — Design Specification v1.0*
*Steady Bubble — 2026-03-19*
