# Expanded Systems — Doodle Sub: Captain Sim v5

Systems mapped to compartments (not sections). Damage occurs when the specific compartment containing the system is affected.

---

## TORPEDO ROOM (`fore_ends`)

| System | Compartment | Notes |
|--------|------------|-------|
| Torpedo Tubes | fore_ends_d2 | *existing* — reload/firing capability |
| Sonar Array (Hull) | fore_ends_d2 | *existing* — passive hull array |
| Fwd Planes Hydraulics | fore_ends_d1 | *existing* — forward hydroplane control |
| Weapon Stowage | fore_ends_d2 | Reload capacity; damaged = tubes can't be reloaded |
| Fwd Trim Tank | fore_ends_d2 | Loss degrades depth control forward |
| Fwd Escape Trunk | fore_ends_d0 | Crew egress; destroyed = no forward escape route |

---

## CONTROL ROOM (`control_room`)

| System | Compartment | Notes |
|--------|------------|-------|
| Periscope | control_room_d0 | *existing* — observation |
| Ballast Control | control_room_d1 | *existing* — main ballast tank management |
| TDC Computer | control_room_d1 | *existing* — torpedo data computer |
| Main Hydraulic Plant | control_room_d2 | *existing* — ship-wide hydraulic pressure |
| Ship's Navigation | control_room_d0 | Inertial nav; degraded = position uncertainty |
| Comms Mast / ECM | control_room_d0 | Radio/ESM mast; loss = comms blackout |
| Fire Control Console | control_room_d1 | Targeting; degraded = manual fire solution only |

---

## MESS DECKS (`aux_section`)

| System | Compartment | Notes |
|--------|------------|-------|
| CO2 Scrubbers | aux_section_d1 | Atmosphere control; degraded = air quality warning, offline = crew perf hit |
| O2 Generator | aux_section_d2 | Loss forces O2 candles / limited endurance |
| Auxiliary Power Panel | aux_section_d0 | Secondary electrical distribution |

---

## REACTOR COMP (`reactor_comp`)

| System | Compartment | Notes |
|--------|------------|-------|
| Reactor | reactor_comp_d1 | *existing* — primary reactor |
| Primary Coolant Loop | reactor_comp_d2 | Loss forces SCRAM; separate from reactor itself |
| Pressuriser | reactor_comp_d1 | Pressure regulation; degraded = reactor power ceiling reduced |
| Rad Monitoring | reactor_comp_d0 | Loss = no warning on primary leak |

---

## MANEUVERING (`engine_room`)

| System | Compartment | Notes |
|--------|------------|-------|
| Propulsion | engine_room_d0 | *existing* — propulsion motor/shaft |
| Main Turbines | engine_room_d2 | Separate from propulsion shaft; degraded = speed ceiling |
| Electrical Distribution | engine_room_d1 | Ship's power bus; offline = wide secondary failures |
| Emergency Diesel | engine_room_d2 | Battery backup; only relevant when reactor offline |

---

## ENGINEERING (`aft_ends`)

| System | Compartment | Notes |
|--------|------------|-------|
| Towed Array | aft_ends_d2 | *existing* — towed sonar array |
| Steering | aft_ends_d1 | *existing* — rudder control |
| Aft Planes Hydraulics | aft_ends_d1 | *existing* — aft hydroplane control |
| Shaft Seals | aft_ends_d2 | Flooding risk if damaged; ongoing leak rather than sudden |
| Aft Trim Tank | aft_ends_d2 | Mirror of fwd trim |
| After Escape Trunk | aft_ends_d0 | Crew egress; destroyed = no aft escape route |
