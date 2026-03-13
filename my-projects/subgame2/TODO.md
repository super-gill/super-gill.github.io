# Doodle Sub — Captain Sim v5 · Development TODO

---

## ✅ Completed

### Realism Pass — Sensors & Weapons
- [x] Enemy noise dynamics — speed-dependent noise floor per hull type (ai.js)
- [x] Torpedo vertical window enforcement — seeker fails outside ±vertWindow (torpedo.js)
- [x] Layer degradation on active seeker acquisition (torpedo.js)

### Crew & Damage Control
- [x] Named crew roster — 90 crew, both genders (heavily male), rated and ranked (damage.js)
- [x] 2-watch system — Watch A / Watch B with duty officers
- [x] DC organisation — DC Alpha (fore, Fenwick OIC) and DC Bravo (aft, Bradley OIC)
- [x] Per-compartment primary roles — all 90 crew have `role` (short) + `roleDesc` (tooltip)
- [x] `dept` field — derived per crew member (warfare / weapons / engineering / reactor / medical / supply / command)
- [x] Medical department — LMA O'Connor + MA Hayes (control_room, duty)
- [x] Supply / Catering department — CPOSA Taylor + 4 ratings (fore_ends)
- [x] DC team assembly made dynamic — teams filled from off-watch crew, not static assignment
- [x] Casualties wound actual named crew members (not abstract counter)
- [x] `_teamEffectiveness()` derived from live crew status

### Crew Panel UI
- [x] Ship's Company panel — canvas overlay, [Y] key / CREW button
- [x] Watch B left column / Watch A right column per compartment section
- [x] Duty officers in full-width strip at top of section
- [x] Short role codes with hover tooltip (`roleDesc`)
- [x] SHIP SUPPORT section — medical + supply separate from compartment sections
- [x] Panel height increased to 740px to fit 90 crew

### Watch System
- [x] `game.watchFatigue` — accumulates over time (cruise 17 min, patrol 9 min, action 6 min)
- [x] At 80%: OOW requests relief over comms
- [x] At 100%: forced watch change (if not action/emergency)
- [x] `initiateWatchChange()` — 30s transition, blocked during action stations
- [x] Comms: request relief, relieving, on watch (named OOW), blocked, forced change
- [x] Crew panel header: fatigue bar (green→amber→red), RELIEVE WATCH button, countdown
- [x] [W] key shortcut for watch change

### Medical System
- [x] Wound severity tagging — `minor` / `serious` / `critical` assigned at time of injury (damage.js `_injureComp`)
- [x] Critical bleed-out timer — 240s, ticks every frame; crew killed if untreated (damage.js `_tickMedical`)
- [x] LMA O'Connor + MA Hayes as traversing medical resource — state machine: standby → transit → on_scene
- [x] Auto-dispatch to highest-priority casualty across the boat (critical > serious > minor)
- [x] Dual-staff coordination — shared `nowTreating` set prevents both treating the same casualty
- [x] Treatment times — critical 2 min, serious 10 min, minor 5 min; restores crew to `fit`
- [x] Staff self-casualty handling — `down` if critically wounded, `lost` if killed; comms fires
- [x] 1MC callout on hit — "Casualty, casualty, casualty — [compartment]. Medical staff close up."
- [x] Comms: en route, on scene, treating, recovered, bleed-out, staff down, no med staff, all clear

### Damage Control
- [x] DC team muster time — 15s `mustering` state before transit begins
  - `assignTeam()` sets mustering + musterT=15; `_tickTeams` transitions to transit after countdown
  - Comms: `dc.mustering()` on assign, `dc.dispatched()` on departure
  - Render panel shows amber `MUSTER → DEST (Ns)` across all three team status displays
- [x] DMG CTRL panel shows watchkeeper-on-watch counts, not full complement

---

## 🔜 Active Queue (next up)

*(empty — see backlog)*

---

## 📋 Backlog

### Phase 1 — Compartment Expansion
- [ ] Add `aux_section` and rename all compartments to section-based IDs
- [ ] Update COMP_DEF, TRAVEL (7×7 matrix), EVAC_TO, SYS_LABEL
- [ ] Redistribute 90 crew across 6 sections (fore/control/aux/reactor/maneuvering/aft)
- [ ] DC Alpha home → control_section fore area; DC Bravo home → maneuvering_section
- [ ] Unmanned sections: `aux_section`, `reactor_section` — no watchkeeper crew assigned

### Phase 2 — Displaced Crew Physical Relocation
- [ ] Evacuated crew physically moved into adjacent compartment (`d.crew[destComp]`) with `displaced:true`
- [ ] Displaced crew included in cascading evacuations if destination also floods
- [ ] Medics find displaced wounded in their physical location
- [ ] Pressure injury on full flood: crew caught in compartment take automatic wound rolls

### Phase 3 — Watertight Doors
- [ ] `d.wtd` state object — one entry per door, `open|closed|damaged`
- [ ] Action stations → all WTDs close automatically; stand-down → reopen
- [ ] Player can manually toggle WTDs from DMG panel
- [ ] Closed WTD adds +10s transit penalty per door crossed (DC teams, medics)
- [ ] Flooding spread: open WTD → 15% spillover rate to adjacent comp; 40% once fully flooded
- [ ] Fire does NOT spread through WTDs — compartment fire boundary only
- [ ] Damaged WTD (from hit): cannot be closed, repairable by DC team
- [ ] Comms: WTD auto-close on action stations, damage report if WTD hit

### Phase 4 — Depth Brackets & Collapse
- [ ] Add `CONFIG.depths` — operational:300, test:450, design:520, collapse:620
- [ ] Depth warning comms: OD exceeded outside action, test depth at action, design depth
- [ ] Collapse check each frame — `player.depth >= collapse` → game over (implosion, not sinking)
- [ ] Distinct end-state for collapse vs flooding loss
- [ ] Reactor SCRAM threshold aligned with new depth bracket values

### Phase 5 — Overstress Flooding (Hull Penetrations)
- [ ] `_tickDepthStress()` — fires every 30s when `depth > design`, probability scales with overrun
- [ ] Hull penetration table: tube seal, mast gland, shaft seal, fwd/aft planes hyd, towed array housing, sonar dome
- [ ] Each penetration: specific compartment, forces system to degraded/offline, own comms line
- [ ] Each penetration gates once per depth exceedance session
- [ ] Flood rate depth scaling: `depthFactor = 1 + (depth/designDepth) * 4` applied to inflow rate

### Phase 6 — Acoustic Depth Penalty
- [ ] Noise floor increase when `depth > test` — up to +0.25 noise at near-collapse
- [ ] Applied in noise calculation (sim.js or ai.js)
- [ ] Creates tactical dilemma: deep = quieter to sonar but noisier hull stress

### Phase 7 — Unified Full-Screen Damage Panel
- [x] Replace embedded DMG CTRL + `[H]`/`[Y]` crew overlay with single full-screen panel (`[H]`/`[Y]`/`⚡ DMG CTRL`/`👥 CREW`)
- [x] 3-deck × 6-section submarine schematic — D1/D2/D3 with real deck layout per section
- [ ] WTD toggles shown as dividers between sections — click to open/close
- [ ] Escape tower icons on schematic (fwd: control_section D1, aft: TBD)
- [ ] Flooding shown as fill level per section, fire as orange overlay
- [ ] DC team + medic position icons on schematic
- [ ] Crew by section below schematic — columns aligned to schematic, B/A watch columns
- [ ] Displaced crew shown in physical location, flagged [D]
- [ ] Right panel: DC team dispatch controls, medical status, systems grid
- [ ] Watch controls in header bar (fatigue, relieve button)

### Phase 8 — Unmanned Space Detection Delay
- [ ] `_detectionDelay` timer per unmanned compartment (aux_section, reactor_section)
- [ ] Fire in unmanned space: 30–60s before alarm fires
- [ ] Comms: *"Fire detection alarm — [location]. Investigate and report to Conn."*
- [ ] Flood in unmanned space: same delay, flood detection sensor comms
- [ ] DC team arrival in unmanned space triggers normal fire/flood report sequence

### Phase 9 — DC Reserve Pool
- [ ] Off-watch crew with `dcTeam:null` form reserve pool
- [ ] When DC team is undermanned (casualties), reserve crew top up effectiveness
- [ ] Reserve crew have extra muster penalty (in bunks/mess)
- [ ] `_teamEffectiveness()` aware of reserve availability
- [ ] Comms: *"DC Alpha — short-handed. Pulling reserve crew."*

### Phase 10 — Escape Tower Modelling
- [ ] `escapeTower: true` flag in COMP_DEF for relevant sections
- [ ] Schematic shows tower icons; greyed if section flooded or WTD compromised
- [ ] Controlled escape requires at least one viable tower
- [ ] Rush escape always available but higher casualties
- [ ] Both towers compromised → controlled escape unavailable, comms report

---

### Crew & Damage Control (existing backlog)
- [ ] Watch handover effect on DC team display (badge brightness mid-change)
- [ ] Crew fatigue affects performance — sonar SNR penalty at 50–80%, DC effectiveness at 80–100%
- [ ] Compartment self-reporting breaks when all crew in that section are KIA

### Medical (existing backlog)
- [ ] Triage station — LMA reports to CO with full casualty list on request
- [ ] Radiation casualties from reactor compartment events (separate from trauma)

### Tactical / Sensors
- [ ] Convergence zone detection — range-band bonus multiplier in sensors.js passiveUpdate
- [ ] Sea-state parameter — session config (calm/moderate/rough) affects detection probabilities
- [ ] Towed array effectiveness improvements — depth dependency, masking arc
- [ ] Contact track quality decay — contacts degrade when not actively tracked
- [ ] Fire control improvements — TDC solution confidence display

### Torpedo / Weapons
- [ ] Wire depth steering — add depth order to wire guidance
- [ ] Speed/endurance tradeoff — sprint burns range (fuel model or scaled timer)
- [ ] Depth countermeasures — noisemakers at varied depths for vertical evasion

### Navigation / Environment
- [ ] Bottom depth variation / seamounts — tactical geography
- [ ] Biologics / shipping background noise — regional variation

### Damage System
- [ ] System cascade audit — flooded engine room → propulsion, hydraulics → manual planes only
- [ ] Fire model improvements — O2 management, CO2 flood side-effects

### UI / Polish
- [ ] HUD fatigue indicator (small watch status widget outside crew panel)
- [ ] Mission debrief — crew casualties summary on game over

---

## 🗂 Reference

- Implementation plan (depth/compartments/UI): `IMPLEMENTATION_PLAN.md`
- Design notes: `REALISM_PASS_NOTES.md`
- Crew manifest: `js/damage.js` — `CREW_MANIFEST` (90 entries)
- DC logic: `js/damage.js` — `_activeDcCrew()`, `_teamEffectiveness()`, `_tickTeams()`
- Medical logic: `js/damage.js` — `_tickMedical()`, `_dispatchMedStaff()`, `_nextCasualtyComp()`
- Watch fatigue: `js/sim.js` — `tickWatchFatigue()`, `initiateWatchChange()`
- Crew panel render: `js/render-panel.js` — `drawCrewPanel()`
- Comms lines: `js/comms.js` — `COMMS.medical.*`, `COMMS.dc.*`, `COMMS.watch.*`
