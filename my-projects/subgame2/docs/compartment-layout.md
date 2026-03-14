# Compartment Layout — Doodle Sub: Captain Sim v5

## Terminology
- **Watertight Section (WTS)** — The 6 major hull divisions separated by watertight bulkheads
- **Compartment** — Individual rooms within a section. Fire, damage, and DC teams operate at compartment level

---

## WT Section 1 — Fore Ends (`fore_ends`)

| Deck | Compartment | Room ID | Crew | Notes |
|------|------------|---------|------|-------|
| D1 | FWD Dome | fore_ends_d0 | 0 | Unmanned, 40s detect delay |
| D1 | Comms | fore_ends_d0b | 3 | COMMS watchkeepers |
| D2 | Eng Office | fore_ends_d1 | 1 | Semi-manned, 20s delay |
| D2 | Computer Rm | fore_ends_d1b | 0 | Unmanned, 35s detect delay |
| D3 | Torpedo Room | fore_ends_d2 | 4 | Torpedo crew on watch |

## WT Section 2 — Control Room (`control_room`)

| Deck | Compartment | Room ID | Crew | Notes |
|------|------------|---------|------|-------|
| D1 | Nav | control_room_d0 | 1 | Navigation plot |
| D1 | Scope Well | control_room_d0b | 2 | Periscope station |
| D1 | Wardroom | control_room_d0c | 3 | Off-watch officers |
| D2 | Control Room | control_room_d1 | 6 | Main control, OOW |
| D2 | CO Cabin | control_room_d1b | 0 | Unmanned, 30s detect delay |
| D3 | Machinery Space | control_room_d2 | 0 | Unmanned, 40s detect delay |

## WT Section 3 — Aux Section (`aux_section`)

| Deck | Compartment | Room ID | Crew | Notes |
|------|------------|---------|------|-------|
| D1 | Jr Mess | aux_section_d0 | 6 | Off-watch junior rates (AB, LS) |
| D1 | Sr Mess | aux_section_d0b | 4 | Off-watch senior rates (PO, CPO, WO) — **DC Alpha home** |
| D2 | Bunks | aux_section_d1 | 2 | Off-watch sleeping, 20s delay |
| D2 | Vent Plant | aux_section_d1b | 0 | Unmanned, 45s detect delay |
| D3 | AMS 1 | aux_section_d2 | 0 | Unmanned, 50s detect delay |
| D3 | RX E-Cool | aux_section_d2b | 0 | Unmanned, 50s detect delay |
| D3 | Sickbay | aux_section_d2c | 1 | Sickbay watchkeeper |

## WT Section 4 — Reactor Comp (`reactor_comp`)

| Deck | Compartment | Room ID | Crew | Notes |
|------|------------|---------|------|-------|
| D1 | RC Tunnel | reactor_comp_d0 | 0 | Unmanned, 30s detect delay, **noEvac** |
| D2 | Reactor | reactor_comp_d1 | 3 | Watchkeepers only, **noEvac** |
| D3 | Reactor Lower | reactor_comp_d2 | 0 | Unmanned, 60s detect delay, **noEvac** |

Reactor spaces do not accept evacuees (radiation boundary).

## WT Section 5 — Engine Room (`engine_room`)

| Deck | Compartment | Room ID | Crew | Notes |
|------|------------|---------|------|-------|
| D1 | Aft Passage | engine_room_d0 | 0 | Passageway — **DC Bravo home** |
| D1 | Maneuvering | engine_room_d0b | 4 | EOOW and watchkeepers |
| D2 | Elec Dist | engine_room_d1 | 2 | Electrical distribution watchkeepers |
| D3 | Aft Atmos | engine_room_d2 | 0 | Unmanned, 45s detect delay |

## WT Section 6 — Aft Ends (`aft_ends`)

| Deck | Compartment | Room ID | Crew | Notes |
|------|------------|---------|------|-------|
| D1 | Aft Escape | aft_ends_d2b | 0 | Unmanned, 50s detect delay |
| D1 | Engineering | aft_ends_d0 | 2 | Engineering watchkeepers |
| D2 | Propulsion | aft_ends_d1 | 2 | Shaft/motor monitoring |
| D2 | Shaft Alley | aft_ends_d1b | 1 | Shaft alley watchkeeper |
| D3 | Steering Gear | aft_ends_d2 | 2 | Steering watchkeepers |

---

## Summary

| Section | D1 | D2 | D3 | Total | Crew |
|---------|----|----|-----|-------|------|
| WTS 1 — Fore Ends | 2 | 2 | 1 | 5 | 8 |
| WTS 2 — Control Room | 3 | 2 | 1 | 6 | 12 |
| WTS 3 — Aux Section | 2 | 2 | 3 | 7 | 13 |
| WTS 4 — Reactor Comp | 1 | 1 | 1 | 3 | 3 |
| WTS 5 — Engine Room | 2 | 1 | 1 | 4 | 6 |
| WTS 6 — Aft Ends | 2 | 2 | 1 | 5 | 7 |
| **Total** | **11** | **10** | **9** | **30** | **49** |

## Fire Suppression
- Each room's watchkeepers suppress fire independently (0.010/s per watchkeeper)
- DC team suppresses only the room they are physically in (0.045/s)
- DC team auto-migrates to worst burning room in the section
- N2 drench is last resort: only triggers when DC team is losing at >95% fire for 15+ seconds

## Fire Spread Rules
- Fire spreads between **adjacent compartments** within the same section
- Adjacent = same deck (left/right) or adjacent decks (up/down)
- Fire does NOT spread across watertight bulkheads (section boundaries)
- Cross-section cascade only through open WTDs at very high fire levels (>85%)

## DC Team Movement
- Teams start in specific compartments (Alpha: SR MESS, Bravo: AFT PASSAGE)
- Teams dispatch to sections, arrive at the compartment with the worst fire
- Location display shows compartment name, not section name

## Evacuation
- Reactor comp does not accept evacuees (radiation boundary)
- Crew evacuate to adjacent sections via EVAC_TO routing
