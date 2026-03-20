'use strict';

import { CONFIG } from '../../config/constants.js';

const C = CONFIG;

// ── Compartment definitions ───────────────────────────────────────────────
export const COMPS = ['fore_ends','control_room','aux_section','reactor_comp','engine_room','aft_ends'];

export const COMP_DEF = {
  fore_ends:    { label:'TORPEDO ROOM',  crewCount:23, tower:'fwd',  unmanned:false },
  control_room: { label:'CONTROL ROOM',  crewCount:20, tower:'fwd',  unmanned:false },
  aux_section:  { label:'MESS DECKS',    crewCount:7,  tower:null,   unmanned:false },
  reactor_comp: { label:'REACTOR COMP',  crewCount:3,  tower:null,   unmanned:false },
  engine_room:  { label:'MANEUVERING',   crewCount:20, tower:'aft',  unmanned:false },
  aft_ends:     { label:'ENGINEERING',   crewCount:15, tower:'aft',  unmanned:false },
};

// ── System definitions — each system tied to a specific room ────────────
// ctrl: optional control-node dependency (effective state = worst of self + ctrl)
export const SYS_DEF = {
  // ── WT Section 1 — Fore Ends ─────────────────────────────────────────
  tubes:          { label:'TORPEDO TUBES',     room:'fore_ends_d2',     ctrl:'fire_ctrl' },
  sonar_hull:     { label:'SONAR ARRAY',       room:'fore_ends_d2'     },
  planes_fwd_hyd: { label:'FWD PLANES HYD',    room:'fore_ends_d1',     ctrl:'helm' },
  weapon_stow:    { label:'WEAPON STOWAGE',    room:'fore_ends_d2'     },
  fwd_trim:       { label:'FWD TRIM TANK',     room:'fore_ends_d2'     },
  fwd_escape:     { label:'FWD ESCAPE TRUNK',  room:'fore_ends_d0'     },
  tma:            { label:'TMA',               room:'fore_ends_d1b'    },
  tdc_comp:       { label:'TDC COMPUTER',      room:'fore_ends_d1b',    ctrl:'fire_ctrl' },
  // ── WT Section 2 — Control Room ──────────────────────────────────────
  periscope:      { label:'PERISCOPE',         room:'control_room_d0'  },
  ballast:        { label:'BALLAST CTRL',      room:'control_room_d1'  },
  hyd_main:       { label:'MAIN HYD PLANT',    room:'control_room_d2'  },
  helm:           { label:'HELM',              room:'control_room_d1'  },
  fire_ctrl:      { label:'FIRE CONTROL',      room:'control_room_d1'  },
  nav_sys:        { label:'NAVIGATION',        room:'control_room_d0'  },
  comms_mast:     { label:'COMMS MAST',        room:'control_room_d0'  },
  // ── WT Section 3 — Aux Section ───────────────────────────────────────
  co2_scrubbers:  { label:'CO2 SCRUBBERS',     room:'aux_section_d1'   },
  o2_gen:         { label:'O2 GENERATOR',      room:'aux_section_d2'   },
  aux_power:      { label:'AUX POWER PANEL',   room:'aux_section_d0'   },
  vent_plant:     { label:'VENT PLANT',        room:'aux_section_d1b'  },
  // ── WT Section 4 — Reactor Comp (nuclear) ────────────────────────────
  reactor:        { label:'REACTOR',           room:'reactor_comp_d1',  nuclearOnly:true },
  primary_coolant:{ label:'PRIMARY COOLANT',   room:'reactor_comp_d2',  nuclearOnly:true },
  pressuriser:    { label:'PRESSURISER',       room:'reactor_comp_d1',  nuclearOnly:true },
  rad_monitor:    { label:'RAD MONITORING',    room:'reactor_comp_d0',  nuclearOnly:true },
  // ── WT Section 4 (diesel) — Engine Compartment ───────────────────────
  diesel_engine:  { label:'DIESEL ENGINE',     room:'reactor_comp_d1',  dieselOnly:true  },
  alternator:     { label:'ALTERNATOR',        room:'reactor_comp_d2',  dieselOnly:true  },
  // ── WT Section 5 — Engine Room ───────────────────────────────────────
  propulsion:     { label:'PROPULSION',        room:'engine_room_d0b'  },
  main_turbines:  { label:'MAIN TURBINES',     room:'engine_room_d2',   nuclearOnly:true },
  elec_dist:      { label:'ELEC DISTRIBUTION', room:'engine_room_d1'   },
  emerg_diesel:   { label:'EMERGENCY DIESEL',  room:'engine_room_d2',   nuclearOnly:true },
  // ── WT Section 5 — Battery (all vessels) / Motor Room (diesel) ───────
  battery_bank:   { label:'BATTERY BANK',      room:'engine_room_d1'   },
  main_motor:     { label:'MAIN MOTOR',        room:'engine_room_d0b',  dieselOnly:true  },
  // ── WT Section 6 — Aft Ends ──────────────────────────────────────────
  towed_array:    { label:'TOWED ARRAY',       room:'aft_ends_d2'      },
  steering:       { label:'STEERING',          room:'aft_ends_d2'      },
  planes_aft_hyd: { label:'AFT PLANES HYD',    room:'aft_ends_d1'      },
  shaft_seals:    { label:'SHAFT SEALS',       room:'aft_ends_d1b'     },
  aft_trim:       { label:'AFT TRIM TANK',     room:'aft_ends_d2'      },
  aft_escape:     { label:'AFT ESCAPE TRUNK',  room:'aft_ends_d2b'     },
};

// Derived lookups from SYS_DEF
export const SYS_LABEL = Object.fromEntries(Object.entries(SYS_DEF).map(([k,v])=>[k,v.label]));
export const ALL_SYS = Object.keys(SYS_DEF);

// Systems with high injury risk during repair
export const HIGH_ENERGY_SYS = new Set(['reactor','propulsion','primary_coolant','main_turbines']);

export const STATES = ['nominal','degraded','offline','destroyed'];
export const REPAIR_TIME = { degraded:20, offline:45, destroyed:120 };

// ── Travel time table (seconds) ──────────────────────────────────────────
// aux_section is unmanned machinery space between control_room and reactor_comp.
// Reactor crossing (RC tunnel, D1 bypass) adds ~10s penalty through reactor_comp.
export const TRAVEL = {
  fore_ends:    { fore_ends:0,  control_room:10, aux_section:18, reactor_comp:28, engine_room:46, aft_ends:56 },
  control_room: { fore_ends:10, control_room:0,  aux_section:8,  reactor_comp:18, engine_room:36, aft_ends:46 },
  aux_section:  { fore_ends:18, control_room:8,  aux_section:0,  reactor_comp:10, engine_room:28, aft_ends:38 },
  reactor_comp: { fore_ends:28, control_room:18, aux_section:10, reactor_comp:0,  engine_room:18, aft_ends:28 },
  engine_room:  { fore_ends:46, control_room:36, aux_section:28, reactor_comp:18, engine_room:0,  aft_ends:10 },
  aft_ends:     { fore_ends:56, control_room:46, aux_section:38, reactor_comp:28, engine_room:10, aft_ends:0  },
};

// Adjacent compartments for crew evacuation
export const EVAC_TO = {
  fore_ends:    ['control_room'],
  control_room: ['aux_section','fore_ends'],
  aux_section:  ['control_room','reactor_comp'],
  reactor_comp: ['aux_section','engine_room'],
  engine_room:  ['reactor_comp','aft_ends'],
  aft_ends:     ['engine_room'],
};

// Maximum occupancy per section: 9 grid units (3×3) × 6 base capacity = 54
// Used by evacuation routing to avoid routing crew into an already-full section.
export const SECTION_CAP = 54;

// ── Watertight Door definitions ──────────────────────────────────────────
// 5 WTDs, one between each adjacent section pair.
// State: 'open' | 'closed'
// Hydraulic operation — requires hyd_main (ship's central plant, control_room_d2).
// RC tunnel: reactor WTDs use the D1 bypass tunnel; transit never blocked by those doors.
export const WTD_PAIRS = [
  ['fore_ends','control_room'],
  ['control_room','aux_section'],
  ['aux_section','reactor_comp'],
  ['reactor_comp','engine_room'],
  ['engine_room','aft_ends'],
];
// Keys where the RC tunnel provides a bypass (transit not blocked even when closed)
export const WTD_RC_KEYS = new Set(['aux_section|reactor_comp','reactor_comp|engine_room']);

// ── Room definitions (compartments within watertight sections) ────────────
// d0=D1 top deck, d1=D2 mid deck, d2=D3 lower deck.
// unmanned rooms have detectionDelay — fire burns undetected until countdown expires.
// ── Section display labels ────────────────────────────────────────────────
// Sections = the 6 watertight divisions of the hull. Compartments = rooms within.
export const SECTION_LABEL = {
  fore_ends:    'WATERTIGHT SECTION 1',
  control_room: 'WATERTIGHT SECTION 2',
  aux_section:  'WATERTIGHT SECTION 3',
  reactor_comp: 'WATERTIGHT SECTION 4',
  engine_room:  'WATERTIGHT SECTION 5',
  aft_ends:     'WATERTIGHT SECTION 6',
};
// Short labels for compact UI
export const SECTION_SHORT = {
  fore_ends:'WTS1', control_room:'WTS2', aux_section:'WTS3',
  reactor_comp:'WTS4', engine_room:'WTS5', aft_ends:'WTS6',
};

export const ROOMS = {
  // ── WT Section 1 — Fore Ends ──────────────────────────────────────────
  // crew = on-watch personnel who can fight fire / detect casualties.
  // crew:0 = empty room (fire burns undetected until sensor alarm at 40%).
  // detectionDelay = seconds before crew notice fire (0 = immediate report to Conn).
  fore_ends_d0:    { label:'FWD DOME',       section:'fore_ends',    deck:0, crew:0, detectionDelay:40 },
  fore_ends_d0b:   { label:'COMMS',          section:'fore_ends',    deck:0, crew:3, detectionDelay:0  },
  fore_ends_d1:    { label:'ENG OFFICE',     section:'fore_ends',    deck:1, crew:1, detectionDelay:20 },
  fore_ends_d1b:   { label:'COMPUTER RM',    section:'fore_ends',    deck:1, crew:0, detectionDelay:35 },
  fore_ends_d2:    { label:'TORPEDO ROOM',   section:'fore_ends',    deck:2, crew:4, detectionDelay:0  },
  // ── WT Section 2 — Control Room ───────────────────────────────────────
  control_room_d0:  { label:'NAV',           section:'control_room', deck:0, crew:1, detectionDelay:0  },
  control_room_d0b: { label:'SCOPE WELL',    section:'control_room', deck:0, crew:2, detectionDelay:0  },
  control_room_d0c: { label:'WARDROOM',      section:'control_room', deck:0, crew:3, detectionDelay:0  },
  control_room_d1:  { label:'CONTROL ROOM',  section:'control_room', deck:1, crew:6, detectionDelay:0  },
  control_room_d1b: { label:'CO CABIN',      section:'control_room', deck:1, crew:0, detectionDelay:30 },
  control_room_d2:  { label:'MACHINERY SPACE',section:'control_room',deck:2, crew:0, detectionDelay:40 },
  // ── WT Section 3 — Aux Section ────────────────────────────────────────
  aux_section_d0:   { label:'JR MESS',       section:'aux_section',  deck:0, crew:6, detectionDelay:0  },
  aux_section_d0b:  { label:'SR MESS',       section:'aux_section',  deck:0, crew:4, detectionDelay:0  },
  aux_section_d1:   { label:'BUNKS',         section:'aux_section',  deck:1, crew:2, detectionDelay:20 },
  aux_section_d1b:  { label:'VENT PLANT',    section:'aux_section',  deck:1, crew:0, detectionDelay:45 },
  aux_section_d2:   { label:'AMS 1',         section:'aux_section',  deck:2, crew:0, detectionDelay:50 },
  aux_section_d2b:  { label:'RX E-COOL',     section:'aux_section',  deck:2, crew:0, detectionDelay:50 },
  aux_section_d2c:  { label:'SICKBAY',       section:'aux_section',  deck:2, crew:1, detectionDelay:0  },
  // ── WT Section 4 — Reactor Comp ───────────────────────────────────────
  // noEvac: reactor spaces must not receive evacuees (radiation boundary)
  reactor_comp_d0: { label:'RC TUNNEL',      section:'reactor_comp', deck:0, crew:0, detectionDelay:30, noEvac:true },
  reactor_comp_d1: { label:'REACTOR',        section:'reactor_comp', deck:1, crew:3, detectionDelay:0,  noEvac:true },
  reactor_comp_d2: { label:'REACTOR (LOWER)',section:'reactor_comp', deck:2, crew:0, detectionDelay:60, noEvac:true },
  // ── WT Section 5 — Engine Room ────────────────────────────────────────
  engine_room_d0:   { label:'AFT PASSAGE',   section:'engine_room',  deck:0, crew:0, detectionDelay:0  },
  engine_room_d0b:  { label:'MANEUVERING',   section:'engine_room',  deck:0, crew:4, detectionDelay:0  },
  engine_room_d1:   { label:'ELEC DIST',     section:'engine_room',  deck:1, crew:2, detectionDelay:0  },
  engine_room_d2:   { label:'AFT ATMOS',     section:'engine_room',  deck:2, crew:0, detectionDelay:45 },
  // ── WT Section 6 — Aft Ends ───────────────────────────────────────────
  aft_ends_d0:      { label:'ENGINEERING',   section:'aft_ends',     deck:0, crew:2, detectionDelay:0  },
  aft_ends_d1:      { label:'PROPULSION',    section:'aft_ends',     deck:1, crew:2, detectionDelay:0  },
  aft_ends_d1b:     { label:'SHAFT ALLEY',   section:'aft_ends',     deck:1, crew:1, detectionDelay:0  },
  aft_ends_d2:      { label:'STEERING GEAR', section:'aft_ends',     deck:2, crew:2, detectionDelay:0  },
  aft_ends_d2b:     { label:'AFT ESCAPE',    section:'aft_ends',     deck:0, crew:0, detectionDelay:50 },
};
export const ROOM_IDS = Object.keys(ROOMS);
export const SECTION_ROOMS = {};
for(const [id,r] of Object.entries(ROOMS)){
  if(!SECTION_ROOMS[r.section]) SECTION_ROOMS[r.section]=[];
  SECTION_ROOMS[r.section].push(id);
}

// ── Derived system lookups (from SYS_DEF + ROOMS) ─────────────────────
// Systems per section for nuclear vessels (excludes dieselOnly)
export const SECTION_SYSTEMS = {};
// Systems per section for diesel vessels (excludes nuclearOnly)
export const DIESEL_SECTION_SYSTEMS = {};
// Systems per room
export const ROOM_SYSTEMS = {};
for(const [sys, def] of Object.entries(SYS_DEF)){
  const sec = ROOMS[def.room]?.section;
  if(!sec) continue;
  if(!def.dieselOnly){
    if(!SECTION_SYSTEMS[sec]) SECTION_SYSTEMS[sec] = [];
    SECTION_SYSTEMS[sec].push(sys);
  }
  if(!def.nuclearOnly){
    if(!DIESEL_SECTION_SYSTEMS[sec]) DIESEL_SECTION_SYSTEMS[sec] = [];
    DIESEL_SECTION_SYSTEMS[sec].push(sys);
  }
  if(!ROOM_SYSTEMS[def.room]) ROOM_SYSTEMS[def.room] = [];
  ROOM_SYSTEMS[def.room].push(sys);
}

// Helper: returns system list for the current vessel type
export function activeSystems(comp){
  return (C.player.isDiesel ? DIESEL_SECTION_SYSTEMS : SECTION_SYSTEMS)[comp] || [];
}

// Helper: returns section display label for the current vessel type
const _DIESEL_COMP_LABEL = { reactor_comp:'ENGINE COMP', engine_room:'MOTOR ROOM' };
export function compLabel(comp){
  return (C.player.isDiesel && _DIESEL_COMP_LABEL[comp]) || COMP_DEF[comp]?.label || comp;
}

// ── Room adjacency (fire spread / DC traversal within a section) ────────
// Rooms are adjacent if they share a wall: same deck (left/right) or
// adjacent decks (up/down). Only within the same watertight section.
// Built automatically: all rooms sharing same deck or adjacent decks in same section.
export const ROOM_ADJ = {};
for(const [id,r] of Object.entries(ROOMS)){
  ROOM_ADJ[id]=[];
  for(const [otherId,o] of Object.entries(ROOMS)){
    if(id===otherId) continue;
    if(r.section!==o.section) continue;
    // Same deck (left/right) or adjacent decks (up/down)
    if(r.deck===o.deck||Math.abs(r.deck-o.deck)===1) ROOM_ADJ[id].push(otherId);
  }
}

// Helper: get the section a room belongs to
export function roomSection(roomId){ return ROOMS[roomId]?.section; }
// True if a section bars evacuees (e.g. reactor — radiation boundary)
export function _sectionNoEvac(sec){ return (SECTION_ROOMS[sec]||[]).some(rid=>ROOMS[rid].noEvac); }

// Systems that are passive hardware — don't need crew to operate.
// Escape trunks, trim tanks, passive arrays, etc.
export const PASSIVE_SYS = new Set(['fwd_escape','aft_escape','fwd_trim','aft_trim','shaft_seals','rad_monitor']);

// ── Fire constants ───────────────────────────────────────────────────────
export const FIRE_BASE_GROW   = 0.008;   // growth/s at fireLevel=0
export const FIRE_SCALE_GROW  = 0.022;   // additional growth/s at fireLevel=1 (max grow ≈ 0.030/s)
export const WATCH_SUPPRESS   = 0.010;   // suppression/s per watchkeeper
export const DC_FIRE_SUPPRESS = 0.045;   // suppression/s for DC team (BA, hoses, portable extinguishers)
export const FIRE_EVAC_TIME   = 15;      // seconds for non-watchkeeper crew to physically transit out of burning section
export const FIRE_DETECT_THRESHOLD  = 0.40;  // unmanned room: sensor alarm fires at this level
export const FIRE_INVESTIGATE_DELAY = 12;   // seconds from alarm to confirmed detection (investigation time)
export const DRENCH_THRESH    = 0.95;    // fire level that triggers drench consideration
export const DRENCH_LOSE_TIME = 15;      // seconds DC team must be losing before drench triggered
export const DRENCH_FILL_TIME = 12;      // seconds for N2 to flood compartment and suppress fire
export const VENT_N2_TIME     = 30;      // seconds to vent N2 and render compartment habitable again

// ── Depth flooding cascade constants ─────────────────────────────────────
export const SEEP_RATE  = 0.004;  // flood units/s — ~4 min to fill (vs torpedo breach 0.008 → ~2 min)
export const SEEP_DELAY_MIN = 30; // seconds before next compartment starts seeping
export const SEEP_DELAY_MAX = 90;
