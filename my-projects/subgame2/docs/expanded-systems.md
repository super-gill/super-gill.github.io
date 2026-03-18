# Expanded Systems — Doodle Sub: Captain Sim v5

Systems mapped to compartments (not sections). Damage occurs when the specific compartment containing the system is affected.

## Architecture

Each system is defined in `SYS_DEF` (damage.js) with:
- `label` — display name
- `room` — the specific room ID where the system lives
- `ctrl` — optional control-node dependency (effective state = worst of self + ctrl)

Derived lookups:
- `SECTION_SYSTEMS[section]` — all systems in a section (replaces old `COMP_DEF[comp].systems`)
- `ROOM_SYSTEMS[roomId]` — all systems in a specific room
- `effectiveState(sys, d)` — returns worst of own state and control node state

## Control Node Dependencies

| Control Node | Room | Controls | Effect |
|-------------|------|----------|--------|
| Helm | control_room_d1 | FWD PLANES HYD | Helm damage = fwd planes effectively degraded/offline |
| Fire Control | control_room_d1 | TORPEDO TUBES, TDC COMPUTER | Fire ctrl damage = tubes & TDC effectively degraded/offline |

Aft planes do NOT depend on helm — they transfer to Maneuvering.

---

## TORPEDO ROOM (`fore_ends`)

| System | Room ID | Ctrl | Notes |
|--------|---------|------|-------|
| Torpedo Tubes | fore_ends_d2 | fire_ctrl | Reload/firing capability |
| Sonar Array | fore_ends_d2 | — | Passive hull array |
| FWD Planes Hyd | fore_ends_d1 | helm | Forward hydroplane control |
| Weapon Stowage | fore_ends_d2 | — | Reload capacity; damaged = tubes can't be reloaded |
| FWD Trim Tank | fore_ends_d2 | — | Loss degrades depth control forward |
| FWD Escape Trunk | fore_ends_d0 | — | Crew egress; destroyed = no forward escape route |
| TMA | fore_ends_d1b | — | Target Motion Analysis (Computer Room) |
| TDC Computer | fore_ends_d1b | fire_ctrl | Torpedo data computer (Computer Room) |

---

## CONTROL ROOM (`control_room`)

| System | Room ID | Ctrl | Notes |
|--------|---------|------|-------|
| Periscope | control_room_d0 | — | Observation |
| Ballast Ctrl | control_room_d1 | — | Main ballast tank management |
| Main Hyd Plant | control_room_d2 | — | Ship-wide hydraulic pressure (WTD operation) |
| Helm | control_room_d1 | — | **Control node** — controls fwd planes |
| Fire Control | control_room_d1 | — | **Control node** — controls tubes & TDC |
| Navigation | control_room_d0 | — | Inertial nav; degraded = position uncertainty |
| Comms Mast | control_room_d0 | — | Radio/ESM mast; loss = comms blackout |

---

## MESS DECKS (`aux_section`)

| System | Room ID | Notes |
|--------|---------|-------|
| CO2 Scrubbers | aux_section_d1 | Atmosphere control; degraded = air quality warning |
| O2 Generator | aux_section_d2 | Loss forces O2 candles / limited endurance |
| Aux Power Panel | aux_section_d0 | Secondary electrical distribution |

---

## REACTOR COMP (`reactor_comp`)

| System | Room ID | Notes |
|--------|---------|-------|
| Reactor | reactor_comp_d1 | Primary reactor |
| Primary Coolant | reactor_comp_d2 | Loss forces SCRAM; separate from reactor |
| Pressuriser | reactor_comp_d1 | Pressure regulation; degraded = power ceiling reduced |
| Rad Monitoring | reactor_comp_d0 | Loss = no warning on primary leak |

---

## MANEUVERING (`engine_room`)

| System | Room ID | Notes |
|--------|---------|-------|
| Propulsion | engine_room_d0b | Propulsion motor/shaft (Maneuvering) |
| Main Turbines | engine_room_d2 | Separate from shaft; degraded = speed ceiling |
| Elec Distribution | engine_room_d1 | Ship's power bus; offline = secondary failures |
| Emergency Diesel | engine_room_d2 | Battery backup; relevant when reactor offline |

---

## ENGINEERING (`aft_ends`)

| System | Room ID | Notes |
|--------|---------|-------|
| Towed Array | aft_ends_d2 | Towed sonar array (Steering Gear room) |
| Steering | aft_ends_d2 | Rudder control (Steering Gear room) |
| AFT Planes Hyd | aft_ends_d1 | Aft hydroplane control (Propulsion room) |
| Shaft Seals | aft_ends_d1b | Flooding risk if damaged (Shaft Alley) |
| AFT Trim Tank | aft_ends_d2 | Mirror of fwd trim |
| AFT Escape Trunk | aft_ends_d2b | Crew egress; destroyed = no aft escape route |

---

## Summary

| Section | Systems | Rooms with systems |
|---------|---------|-------------------|
| WTS 1 — Fore Ends | 8 | fore_ends_d0, d1, d1b, d2 |
| WTS 2 — Control Room | 7 | control_room_d0, d1, d2 |
| WTS 3 — Aux Section | 3 | aux_section_d0, d1, d2 |
| WTS 4 — Reactor Comp | 4 | reactor_comp_d0, d1, d2 |
| WTS 5 — Engine Room | 4 | engine_room_d0b, d1, d2 |
| WTS 6 — Aft Ends | 6 | aft_ends_d1, d1b, d2, d2b |
| **Total** | **32** | |
