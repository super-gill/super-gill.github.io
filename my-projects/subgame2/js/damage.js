(() => {
  'use strict';
  try {
  const C   = window.CONFIG;
  const {player, game, setMsg, addLog, queueLog} = window.G;
  const {rand, clamp} = window.M;
  const COMMS = window.COMMS;
  const dcLog = COMMS.dcLog;
  const COMP_STATION = COMMS.COMP_STATION;

  // ── Compartment definitions ───────────────────────────────────────────────
  const COMPS = ['fore_ends','control_room','aux_section','reactor_comp','engine_room','aft_ends'];

  const COMP_DEF = {
    fore_ends:    { label:'TORPEDO ROOM',  crewCount:23, tower:'fwd',  unmanned:false },
    control_room: { label:'CONTROL ROOM',  crewCount:20, tower:'fwd',  unmanned:false },
    aux_section:  { label:'MESS DECKS',    crewCount:7,  tower:null,   unmanned:false },
    reactor_comp: { label:'REACTOR COMP',  crewCount:3,  tower:null,   unmanned:false },
    engine_room:  { label:'MANEUVERING',   crewCount:20, tower:'aft',  unmanned:false },
    aft_ends:     { label:'ENGINEERING',   crewCount:15, tower:'aft',  unmanned:false },
  };

  // ── System definitions — each system tied to a specific room ────────────
  // ctrl: optional control-node dependency (effective state = worst of self + ctrl)
  const SYS_DEF = {
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
    // ── WT Section 5 (diesel) — Motor Room ───────────────────────────────
    main_motor:     { label:'MAIN MOTOR',        room:'engine_room_d0b',  dieselOnly:true  },
    battery_bank:   { label:'BATTERY BANK',      room:'engine_room_d1',   dieselOnly:true  },
    // ── WT Section 6 — Aft Ends ──────────────────────────────────────────
    towed_array:    { label:'TOWED ARRAY',       room:'aft_ends_d2'      },
    steering:       { label:'STEERING',          room:'aft_ends_d2'      },
    planes_aft_hyd: { label:'AFT PLANES HYD',    room:'aft_ends_d1'      },
    shaft_seals:    { label:'SHAFT SEALS',       room:'aft_ends_d1b'     },
    aft_trim:       { label:'AFT TRIM TANK',     room:'aft_ends_d2'      },
    aft_escape:     { label:'AFT ESCAPE TRUNK',  room:'aft_ends_d2b'     },
  };

  // Derived lookups from SYS_DEF
  const SYS_LABEL = Object.fromEntries(Object.entries(SYS_DEF).map(([k,v])=>[k,v.label]));
  const ALL_SYS = Object.keys(SYS_DEF);

  // Systems with high injury risk during repair
  const HIGH_ENERGY_SYS = new Set(['reactor','propulsion','primary_coolant','main_turbines']);

  const STATES = ['nominal','degraded','offline','destroyed'];
  const REPAIR_TIME = { degraded:20, offline:45, destroyed:120 };

  // ── Travel time table (seconds) ──────────────────────────────────────────
  // aux_section is unmanned machinery space between control_room and reactor_comp.
  // Reactor crossing (RC tunnel, D1 bypass) adds ~10s penalty through reactor_comp.
  const TRAVEL = {
    fore_ends:    { fore_ends:0,  control_room:10, aux_section:18, reactor_comp:28, engine_room:46, aft_ends:56 },
    control_room: { fore_ends:10, control_room:0,  aux_section:8,  reactor_comp:18, engine_room:36, aft_ends:46 },
    aux_section:  { fore_ends:18, control_room:8,  aux_section:0,  reactor_comp:10, engine_room:28, aft_ends:38 },
    reactor_comp: { fore_ends:28, control_room:18, aux_section:10, reactor_comp:0,  engine_room:18, aft_ends:28 },
    engine_room:  { fore_ends:46, control_room:36, aux_section:28, reactor_comp:18, engine_room:0,  aft_ends:10 },
    aft_ends:     { fore_ends:56, control_room:46, aux_section:38, reactor_comp:28, engine_room:10, aft_ends:0  },
  };

  // Adjacent compartments for crew evacuation
  const EVAC_TO = {
    fore_ends:    ['control_room'],
    control_room: ['aux_section','fore_ends'],
    aux_section:  ['control_room','reactor_comp'],
    reactor_comp: ['aux_section','engine_room'],
    engine_room:  ['reactor_comp','aft_ends'],
    aft_ends:     ['engine_room'],
  };

  // Maximum occupancy per section: 9 grid units (3×3) × 6 base capacity = 54
  // Used by evacuation routing to avoid routing crew into an already-full section.
  const SECTION_CAP = 54;

  // ── Watertight Door definitions ──────────────────────────────────────────
  // 5 WTDs, one between each adjacent section pair.
  // State: 'open' | 'closed'
  // Hydraulic operation — requires hyd_main (ship's central plant, control_room_d2).
  // RC tunnel: reactor WTDs use the D1 bypass tunnel; transit never blocked by those doors.
  const WTD_PAIRS = [
    ['fore_ends','control_room'],
    ['control_room','aux_section'],
    ['aux_section','reactor_comp'],
    ['reactor_comp','engine_room'],
    ['engine_room','aft_ends'],
  ];
  // Keys where the RC tunnel provides a bypass (transit not blocked even when closed)
  const WTD_RC_KEYS = new Set(['aux_section|reactor_comp','reactor_comp|engine_room']);

  // ── Room definitions (compartments within watertight sections) ────────────
  // d0=D1 top deck, d1=D2 mid deck, d2=D3 lower deck.
  // unmanned rooms have detectionDelay — fire burns undetected until countdown expires.
  // ── Section display labels ────────────────────────────────────────────────
  // Sections = the 6 watertight divisions of the hull. Compartments = rooms within.
  const SECTION_LABEL = {
    fore_ends:    'WATERTIGHT SECTION 1',
    control_room: 'WATERTIGHT SECTION 2',
    aux_section:  'WATERTIGHT SECTION 3',
    reactor_comp: 'WATERTIGHT SECTION 4',
    engine_room:  'WATERTIGHT SECTION 5',
    aft_ends:     'WATERTIGHT SECTION 6',
  };
  // Short labels for compact UI
  const SECTION_SHORT = {
    fore_ends:'WTS1', control_room:'WTS2', aux_section:'WTS3',
    reactor_comp:'WTS4', engine_room:'WTS5', aft_ends:'WTS6',
  };

  const ROOMS = {
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
  const ROOM_IDS = Object.keys(ROOMS);
  const SECTION_ROOMS = {};
  for(const [id,r] of Object.entries(ROOMS)){
    if(!SECTION_ROOMS[r.section]) SECTION_ROOMS[r.section]=[];
    SECTION_ROOMS[r.section].push(id);
  }

  // ── Derived system lookups (from SYS_DEF + ROOMS) ─────────────────────
  // Systems per section for nuclear vessels (excludes dieselOnly)
  const SECTION_SYSTEMS = {};
  // Systems per section for diesel vessels (excludes nuclearOnly)
  const DIESEL_SECTION_SYSTEMS = {};
  // Systems per room
  const ROOM_SYSTEMS = {};
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
  function activeSystems(comp){
    return (C.player.isDiesel ? DIESEL_SECTION_SYSTEMS : SECTION_SYSTEMS)[comp] || [];
  }

  // Helper: returns section display label for the current vessel type
  const _DIESEL_COMP_LABEL = { reactor_comp:'ENGINE COMP', engine_room:'MOTOR ROOM' };
  function compLabel(comp){
    return (C.player.isDiesel && _DIESEL_COMP_LABEL[comp]) || COMP_DEF[comp]?.label || comp;
  }

  // ── Room adjacency (fire spread / DC traversal within a section) ────────
  // Rooms are adjacent if they share a wall: same deck (left/right) or
  // adjacent decks (up/down). Only within the same watertight section.
  // Built automatically: all rooms sharing same deck or adjacent decks in same section.
  const ROOM_ADJ = {};
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
  function roomSection(roomId){ return ROOMS[roomId]?.section; }
  // True if a section bars evacuees (e.g. reactor — radiation boundary)
  function _sectionNoEvac(sec){ return (SECTION_ROOMS[sec]||[]).some(rid=>ROOMS[rid].noEvac); }

  // ── Static crew manifest ──────────────────────────────────────────────────
  // 90 named crew. role=short display label. roleDesc=full tooltip.
  // watch: 'A'|'B'|'duty'. dcTeam: 'alpha'|'bravo'|null.
  // dept: derived in buildCrewManifest; explicit on medical/supply entries.
  const CREW_MANIFEST = [
    // ── CONTROL ROOM (20) ─────────────────────────────────────────────────
    // duty(4): Ramsay, Chen, Fenwick, Crane  |  A(8): Hartley Walsh Spencer Curtis Henley Frazer Wren Vane  |  B(8): Kirby Thatcher Nolan Booth Marsh Peel Briggs Doyle
    { id:'ramsay',   comp:'control_room', rating:'CDR',  firstName:'Michael', lastName:'Ramsay',   role:'CO',       roleDesc:'Commanding Officer',                    gender:'m', watch:'duty', dcTeam:null    },
    { id:'chen',     comp:'control_room', rating:'LCDR', firstName:'Sarah',   lastName:'Chen',     role:'XO',       roleDesc:'Executive Officer',                     gender:'f', watch:'duty', dcTeam:null    },
    { id:'fenwick',  comp:'control_room', rating:'LT',   firstName:'Thomas',  lastName:'Fenwick',  role:'1ST LT',   roleDesc:'First Lieutenant / DC Alpha OIC',        gender:'m', watch:'duty', dcTeam:'alpha' },
    { id:'crane',    comp:'control_room', rating:'WO',   firstName:'Robert',  lastName:'Crane',    role:"COX'N",    roleDesc:'Coxswain / DC Alpha Senior Rate',         gender:'m', watch:'duty', dcTeam:'alpha' },
    { id:'hartley',  comp:'control_room', rating:'LT',   firstName:'James',   lastName:'Hartley',  role:'OOW',      roleDesc:'Officer of the Watch',                   gender:'m', watch:'A',    dcTeam:null    },
    { id:'walsh',    comp:'control_room', rating:'CPO',  firstName:'Brian',   lastName:'Walsh',    role:'SON CTL',  roleDesc:'Sonar Controller',                       gender:'m', watch:'A',    dcTeam:null    },
    { id:'spencer',  comp:'control_room', rating:'PO',   firstName:'Mark',    lastName:'Spencer',  role:'PLNSMN',   roleDesc:'Planesman',                              gender:'m', watch:'A',    dcTeam:null    },
    { id:'curtis',   comp:'control_room', rating:'PO',   firstName:'Lee',     lastName:'Curtis',   role:'HELSMN',   roleDesc:'Helmsman',                               gender:'m', watch:'A',    dcTeam:null    },
    { id:'henley',   comp:'control_room', rating:'LS',   firstName:'Paul',    lastName:'Henley',   role:'NAV PLT',  roleDesc:'Navigation Plotter',                     gender:'m', watch:'A',    dcTeam:null    },
    { id:'vane',     comp:'control_room', rating:'PO',   firstName:'Simon',   lastName:'Vane',     role:'TDC OP',   roleDesc:'TDC Operator',                           gender:'m', watch:'A',    dcTeam:null    },
    { id:'frazer',   comp:'control_room', rating:'AB',   firstName:'Steve',   lastName:'Frazer',   role:'CR RTG',   roleDesc:'Control Room Rating',                    gender:'m', watch:'A',    dcTeam:null    },
    { id:'wren',     comp:'control_room', rating:'AB',   firstName:'Jack',    lastName:'Wren',     role:'CR RTG',   roleDesc:'Control Room Rating',                    gender:'m', watch:'A',    dcTeam:null    },
    { id:'kirby',    comp:'control_room', rating:'LT',   firstName:'David',   lastName:'Kirby',    role:'OOW',      roleDesc:'Officer of the Watch',                   gender:'m', watch:'B',    dcTeam:null    },
    { id:'thatcher', comp:'control_room', rating:'CPO',  firstName:'Neil',    lastName:'Thatcher', role:'SON CTL',  roleDesc:'Sonar Controller',                       gender:'m', watch:'B',    dcTeam:null    },
    { id:'nolan',    comp:'control_room', rating:'PO',   firstName:'Gary',    lastName:'Nolan',    role:'PLNSMN',   roleDesc:'Planesman',                              gender:'m', watch:'B',    dcTeam:null    },
    { id:'doyle',    comp:'control_room', rating:'LS',   firstName:'Mike',    lastName:'Doyle',    role:'HELSMN',   roleDesc:'Helmsman',                               gender:'m', watch:'B',    dcTeam:null    },
    { id:'booth',    comp:'control_room', rating:'LS',   firstName:'Craig',   lastName:'Booth',    role:'SON OP',   roleDesc:'Sonar Operator',                         gender:'m', watch:'B',    dcTeam:null    },
    { id:'marsh',    comp:'control_room', rating:'LS',   firstName:'Dean',    lastName:'Marsh',    role:'RADIO',    roleDesc:'Radio Operator',                         gender:'m', watch:'B',    dcTeam:null    },
    { id:'peel',     comp:'control_room', rating:'AB',   firstName:'Tom',     lastName:'Peel',     role:'CR RTG',   roleDesc:'Control Room Rating',                    gender:'m', watch:'B',    dcTeam:null    },
    { id:'briggs',   comp:'control_room', rating:'AB',   firstName:'Chloe',   lastName:'Briggs',   role:'CR RTG',   roleDesc:'Control Room Rating',                    gender:'f', watch:'B',    dcTeam:null    },
    // ── MEDICAL (2, sickbay in aux_section D3) ────────────────────────────
    { id:'oconnor',  comp:'aux_section', rating:'LMA',  firstName:'Patrick', lastName:"O'Connor", role:'LMA',      roleDesc:'Leading Medical Assistant — Sickbay',        gender:'m', watch:'duty', dcTeam:null,    dept:'medical' },
    { id:'hayes',    comp:'aux_section', rating:'MA',   firstName:'Claire',  lastName:'Hayes',    role:'MA',       roleDesc:'Medical Assistant — Sickbay',                gender:'f', watch:'duty', dcTeam:null,    dept:'medical' },
    // ── FORE ENDS (25) ────────────────────────────────────────────────────
    // D1 COMMS: Sadler(WA) Pearce(WA) Nash(WB) Morton(WB) — 4 total, 2 per watch
    // D2 ENG OFFICE: Jacobs (duty — TORPS section CPO)
    // D3 TORPEDO ROOM: Drake Reeves Shaw Cullen Lane Hobbs (WA) | Burns Cole Porter Holt Finch Baxter Frost Pratt Norris Flynn (WB)
    // DC Alpha: Drake Reeves Shaw Cullen Lane Hobbs
    // COMMS watchkeepers (D1, 2 per watch)
    { id:'sadler',   comp:'fore_ends', rating:'PO',  firstName:'Frank',  lastName:'Sadler',  role:'COMMS PO', roleDesc:'Communications PO on Watch',             gender:'m', watch:'A', dcTeam:null    },
    { id:'pearce',   comp:'fore_ends', rating:'AB',  firstName:'Aiden',  lastName:'Pearce',  role:'COMMS OP', roleDesc:'Communications Operator on Watch',       gender:'m', watch:'A', dcTeam:null    },
    { id:'nash',     comp:'fore_ends', rating:'CPO', firstName:'Frank',  lastName:'Nash',    role:'COMMS CPO',roleDesc:'Chief Petty Officer Communications',      gender:'m', watch:'B', dcTeam:null    },
    { id:'morton',   comp:'fore_ends', rating:'LS',  firstName:'Pete',   lastName:'Morton',  role:'COMMS OP', roleDesc:'Communications Operator on Watch',       gender:'m', watch:'B', dcTeam:null    },
    // ENG OFFICE (D2 col1, 1 duty person — Torpedo CPO)
    { id:'jacobs',   comp:'fore_ends', rating:'CPO', firstName:'Ron',    lastName:'Jacobs',  role:'COW(T)',   roleDesc:'Chief of the Watch (Torpedo)',           gender:'m', watch:'duty', dcTeam:null  },
    // TORPEDO ROOM (D3 full width)
    { id:'drake',    comp:'fore_ends', rating:'PO',  firstName:'Kevin',  lastName:'Drake',   role:'TRP RDY',  roleDesc:'Torpedo Ready Duty',                    gender:'m', watch:'A', dcTeam:'alpha' },
    { id:'reeves',   comp:'fore_ends', rating:'LS',  firstName:'Tony',   lastName:'Reeves',  role:'TORP',     roleDesc:'Torpedo Rating on Watch',                gender:'m', watch:'A', dcTeam:'alpha' },
    { id:'shaw',     comp:'fore_ends', rating:'LS',  firstName:'Gary',   lastName:'Shaw',    role:'TORP',     roleDesc:'Torpedo Rating on Watch',                gender:'m', watch:'A', dcTeam:'alpha' },
    { id:'cullen',   comp:'fore_ends', rating:'AB',  firstName:'Lee',    lastName:'Cullen',  role:'TORP',     roleDesc:'Torpedo Tube Maintainer',                gender:'m', watch:'A', dcTeam:'alpha' },
    { id:'lane',     comp:'fore_ends', rating:'AB',  firstName:'Chris',  lastName:'Lane',    role:'TORP',     roleDesc:'Torpedo Rating',                         gender:'m', watch:'A', dcTeam:'alpha' },
    { id:'hobbs',    comp:'fore_ends', rating:'AB',  firstName:'Nick',   lastName:'Hobbs',   role:'SON OP',   roleDesc:'Sonar Operator',                         gender:'m', watch:'A', dcTeam:'alpha' },
    { id:'dunn',     comp:'fore_ends', rating:'LS',  firstName:'Bobby',  lastName:'Dunn',    role:'FE MAINT', roleDesc:'Fore Ends Maintenance',                  gender:'m', watch:'A', dcTeam:null    },
    { id:'quinn',    comp:'fore_ends', rating:'LS',  firstName:'Ben',    lastName:'Quinn',   role:'FE LS',    roleDesc:'Fore Ends Leading Seaman',               gender:'m', watch:'A', dcTeam:null    },
    { id:'burns',    comp:'fore_ends', rating:'PO',  firstName:'Andy',   lastName:'Burns',   role:'SON PO',   roleDesc:'Sonar PO on Watch',                      gender:'m', watch:'B', dcTeam:null    },
    { id:'cole',     comp:'fore_ends', rating:'PO',  firstName:'Martin', lastName:'Cole',    role:'TRP RDY',  roleDesc:'Torpedo Ready Duty',                     gender:'m', watch:'B', dcTeam:null    },
    { id:'porter',   comp:'fore_ends', rating:'LS',  firstName:'Sam',    lastName:'Porter',  role:'SON LS',   roleDesc:'Sonar Leading Seaman on Watch',           gender:'m', watch:'B', dcTeam:null    },
    { id:'holt',     comp:'fore_ends', rating:'AB',  firstName:'Phil',   lastName:'Holt',    role:'TORP',     roleDesc:'Torpedo Rating',                         gender:'m', watch:'B', dcTeam:null    },
    { id:'finch',    comp:'fore_ends', rating:'AB',  firstName:'Joe',    lastName:'Finch',   role:'TORP',     roleDesc:'Torpedo Rating',                         gender:'m', watch:'B', dcTeam:null    },
    { id:'baxter',   comp:'fore_ends', rating:'PO',  firstName:'Stuart', lastName:'Baxter',  role:'FE PO',    roleDesc:'Fore Ends PO on Watch',                  gender:'m', watch:'B', dcTeam:null    },
    { id:'frost',    comp:'fore_ends', rating:'AB',  firstName:'Dave',   lastName:'Frost',   role:'TORP',     roleDesc:'Torpedo Rating',                         gender:'m', watch:'B', dcTeam:null    },
    { id:'pratt',    comp:'fore_ends', rating:'AB',  firstName:'Ray',    lastName:'Pratt',   role:'TORP',     roleDesc:'Torpedo Rating',                         gender:'m', watch:'B', dcTeam:null    },
    { id:'norris',   comp:'fore_ends', rating:'AB',  firstName:'Emma',   lastName:'Norris',  role:'SON OP',   roleDesc:'Sonar Operator',                         gender:'f', watch:'B', dcTeam:null    },
    { id:'flynn',    comp:'fore_ends', rating:'AB',  firstName:'Danny',  lastName:'Flynn',   role:'TORP',     roleDesc:'Torpedo Rating',                         gender:'m', watch:'B', dcTeam:null    },
    // ── SUPPLY / CATERING (5, aux_section — galley/messes) ───────────────
    { id:'taylor',   comp:'aux_section', rating:'CPOSA', firstName:'George', lastName:'Taylor',  role:'CPOSA',    roleDesc:'Chief Petty Officer Supply & Secretariat', gender:'m', watch:'duty', dcTeam:null, dept:'supply' },
    { id:'mackay',   comp:'aux_section', rating:'PO',    firstName:'Ian',    lastName:'MacKay',  role:'PO(CS)',   roleDesc:'Petty Officer Catering Services',           gender:'m', watch:'duty', dcTeam:null, dept:'supply' },
    { id:'wright',   comp:'aux_section', rating:'PO',    firstName:'Linda',  lastName:'Wright',  role:'PO(CS)',   roleDesc:'Petty Officer Catering Services',           gender:'f', watch:'duty', dcTeam:null, dept:'supply' },
    { id:'cross',    comp:'aux_section', rating:'AB',    firstName:'Danny',  lastName:'Cross',   role:'AB(CS)',   roleDesc:'Able Rating Catering Services',             gender:'m', watch:'duty', dcTeam:null, dept:'supply' },
    { id:'reed',     comp:'aux_section', rating:'AB',    firstName:'Kate',   lastName:'Reed',    role:'AB(CS)',   roleDesc:'Able Rating Catering Services',             gender:'f', watch:'duty', dcTeam:null, dept:'supply' },
    // ── REACTOR COMP (3) ──────────────────────────────────────────────────
    { id:'sinclair', comp:'reactor_comp', rating:'LCDR', firstName:'Paul',  lastName:'Sinclair', role:'MEO',      roleDesc:'Marine Engineering Officer',            gender:'m', watch:'duty', dcTeam:null },
    { id:'hadley',   comp:'reactor_comp', rating:'CPO',  firstName:'Doug',  lastName:'Hadley',   role:'REAC WKP', roleDesc:'Reactor Panel Watchkeeper',              gender:'m', watch:'A',    dcTeam:null },
    { id:'merritt',  comp:'reactor_comp', rating:'PO',   firstName:'Alan',  lastName:'Merritt',  role:'REAC WKP', roleDesc:'Reactor Panel Watchkeeper',              gender:'m', watch:'B',    dcTeam:null },
    // ── ENGINE ROOM (20) ──────────────────────────────────────────────────
    // A(11): Ward Tanner Burke Greer Kent Moss Mills Kemp Hughes Silva Brennan
    // B(9): Hurst Lamb Harper Payne Sutton Webb Barker Lowe Saunders
    // DC Bravo: Burke(SR) Kent Mills Kemp Hughes
    { id:'ward',     comp:'engine_room', rating:'LT',  firstName:'Rachel', lastName:'Ward',     role:'MRWO',     roleDesc:'Manoeuvring Room Watch Officer',         gender:'f', watch:'A',    dcTeam:null    },
    { id:'tanner',   comp:'engine_room', rating:'WO',  firstName:'John',   lastName:'Tanner',   role:'WO PROP',  roleDesc:'WO Propulsion on Watch',                 gender:'m', watch:'A',    dcTeam:null    },
    { id:'burke',    comp:'engine_room', rating:'CPO', firstName:'Steve',  lastName:'Burke',    role:'EPNS CPO', roleDesc:'EPNS CPO on Watch / DC Bravo Senior Rate',gender:'m', watch:'A',    dcTeam:'bravo' },
    { id:'greer',    comp:'engine_room', rating:'CPO', firstName:'Hugh',   lastName:'Greer',    role:'MECH CPO', roleDesc:'Mechanical Systems CPO',                 gender:'m', watch:'A',    dcTeam:null    },
    { id:'kent',     comp:'engine_room', rating:'PO',  firstName:'Larry',  lastName:'Kent',     role:'PROP PO',  roleDesc:'Propulsion PO on Watch',                 gender:'m', watch:'A',    dcTeam:'bravo' },
    { id:'moss',     comp:'engine_room', rating:'PO',  firstName:'Alan',   lastName:'Moss',     role:'MECH PO',  roleDesc:'Mechanical PO on Watch',                 gender:'m', watch:'A',    dcTeam:null    },
    { id:'mills',    comp:'engine_room', rating:'LS',  firstName:'Victor', lastName:'Mills',    role:'PROP LS',  roleDesc:'Propulsion Leading Seaman on Watch',      gender:'m', watch:'A',    dcTeam:'bravo' },
    { id:'kemp',     comp:'engine_room', rating:'LS',  firstName:'Ryan',   lastName:'Kemp',     role:'MECH LS',  roleDesc:'Mechanical Leading Seaman on Watch',      gender:'m', watch:'A',    dcTeam:'bravo' },
    { id:'hughes',   comp:'engine_room', rating:'AB',  firstName:'Connor', lastName:'Hughes',   role:'MECH RTG', roleDesc:'Mechanical Rating',                       gender:'m', watch:'A',    dcTeam:'bravo' },
    { id:'silva',    comp:'engine_room', rating:'AB',  firstName:'Marco',  lastName:'Silva',    role:'MECH RTG', roleDesc:'Mechanical Rating',                       gender:'m', watch:'A',    dcTeam:null    },
    { id:'brennan',  comp:'engine_room', rating:'AB',  firstName:'Joe',    lastName:'Brennan',  role:'MECH RTG', roleDesc:'Mechanical Rating',                       gender:'m', watch:'A',    dcTeam:null    },
    { id:'hurst',    comp:'engine_room', rating:'LT',  firstName:'Colin',  lastName:'Hurst',    role:'MRWO',     roleDesc:'Manoeuvring Room Watch Officer',          gender:'m', watch:'B',    dcTeam:null    },
    { id:'lamb',     comp:'engine_room', rating:'WO',  firstName:'Dennis', lastName:'Lamb',     role:'WO MECH',  roleDesc:'WO Mechanical on Watch',                  gender:'m', watch:'B',    dcTeam:null    },
    { id:'harper',   comp:'engine_room', rating:'CPO', firstName:'Fred',   lastName:'Harper',   role:'MCHY CPO', roleDesc:'Machinery CPO on Watch',                  gender:'m', watch:'B',    dcTeam:null    },
    { id:'payne',    comp:'engine_room', rating:'PO',  firstName:'David',  lastName:'Payne',    role:'MECH PO',  roleDesc:'Mechanical PO on Watch',                  gender:'m', watch:'B',    dcTeam:null    },
    { id:'saunders', comp:'engine_room', rating:'PO',  firstName:'Ray',    lastName:'Saunders', role:'PROP PO',  roleDesc:'Propulsion PO on Watch',                  gender:'m', watch:'B',    dcTeam:null    },
    { id:'sutton',   comp:'engine_room', rating:'LS',  firstName:'Barry',  lastName:'Sutton',   role:'MECH LS',  roleDesc:'Mechanical Leading Seaman on Watch',       gender:'m', watch:'B',    dcTeam:null    },
    { id:'webb',     comp:'engine_room', rating:'LS',  firstName:'Claire', lastName:'Webb',     role:'MECH LS',  roleDesc:'Mechanical Leading Seaman on Watch',       gender:'f', watch:'B',    dcTeam:null    },
    { id:'barker',   comp:'engine_room', rating:'AB',  firstName:'Tim',    lastName:'Barker',   role:'MECH RTG', roleDesc:'Mechanical Rating',                        gender:'m', watch:'B',    dcTeam:null    },
    { id:'lowe',     comp:'engine_room', rating:'AB',  firstName:'Dan',    lastName:'Lowe',     role:'MECH RTG', roleDesc:'Mechanical Rating',                        gender:'m', watch:'B',    dcTeam:null    },
    // ── AFT ENDS (15) ─────────────────────────────────────────────────────
    // A(8): Bradley Regan Fox Fry Chambers Sharpe Hirst Burgess
    // B(7): Stone Reilly Turner Dix Lovell Todd Park
    // DC Bravo OIC: Bradley. DC Bravo member: Chambers
    { id:'bradley',  comp:'aft_ends', rating:'LT',  firstName:'Owen',   lastName:'Bradley',  role:'E/H OFF',  roleDesc:'Electrical & Hydraulics Officer / DC Bravo OIC', gender:'m', watch:'A',    dcTeam:'bravo' },
    { id:'burgess',  comp:'aft_ends', rating:'CPO', firstName:'Dave',   lastName:'Burgess',  role:'AFT CPO',  roleDesc:'Aft Section CPO on Watch',                   gender:'m', watch:'A',    dcTeam:null    },
    { id:'regan',    comp:'aft_ends', rating:'PO',  firstName:'Phil',   lastName:'Regan',    role:'ELEC PO',  roleDesc:'Electrical Systems PO',                      gender:'m', watch:'A',    dcTeam:null    },
    { id:'fox',      comp:'aft_ends', rating:'LS',  firstName:'Darren', lastName:'Fox',      role:'ELEC LS',  roleDesc:'Electrical Leading Seaman on Watch',          gender:'m', watch:'A',    dcTeam:null    },
    { id:'fry',      comp:'aft_ends', rating:'LS',  firstName:'Jason',  lastName:'Fry',      role:'TA OP',    roleDesc:'Towed Array Operator',                        gender:'m', watch:'A',    dcTeam:null    },
    { id:'chambers', comp:'aft_ends', rating:'AB',  firstName:'Russ',   lastName:'Chambers', role:'AFT RTG',  roleDesc:'Aft Section Rating',                         gender:'m', watch:'A',    dcTeam:'bravo' },
    { id:'sharpe',   comp:'aft_ends', rating:'AB',  firstName:'Liam',   lastName:'Sharpe',   role:'AFT RTG',  roleDesc:'Aft Section Rating',                         gender:'m', watch:'A',    dcTeam:null    },
    { id:'hirst',    comp:'aft_ends', rating:'AB',  firstName:'Sam',    lastName:'Hirst',    role:'AFT RTG',  roleDesc:'Aft Section Rating',                         gender:'m', watch:'A',    dcTeam:null    },
    { id:'stone',    comp:'aft_ends', rating:'PO',  firstName:'Harry',  lastName:'Stone',    role:'HYD PO',   roleDesc:'Hydraulics PO on Watch',                     gender:'m', watch:'B',    dcTeam:null    },
    { id:'reilly',   comp:'aft_ends', rating:'LS',  firstName:'Mike',   lastName:'Reilly',   role:'STR/PLN',  roleDesc:'Steering & Planes Leading Seaman',            gender:'m', watch:'B',    dcTeam:null    },
    { id:'turner',   comp:'aft_ends', rating:'AB',  firstName:'Amy',    lastName:'Turner',   role:'AFT RTG',  roleDesc:'Aft Section Rating',                         gender:'f', watch:'B',    dcTeam:null    },
    { id:'dix',      comp:'aft_ends', rating:'AB',  firstName:'Paul',   lastName:'Dix',      role:'AFT RTG',  roleDesc:'Aft Section Rating',                         gender:'m', watch:'B',    dcTeam:null    },
    { id:'lovell',   comp:'aft_ends', rating:'AB',  firstName:'Ben',    lastName:'Lovell',   role:'AFT RTG',  roleDesc:'Aft Section Rating',                         gender:'m', watch:'B',    dcTeam:null    },
    { id:'todd',     comp:'aft_ends', rating:'PO',  firstName:'Graham', lastName:'Todd',     role:'HYD PO',   roleDesc:'Hydraulics PO on Watch',                     gender:'m', watch:'B',    dcTeam:null    },
    { id:'park',     comp:'aft_ends', rating:'LS',  firstName:'Andy',   lastName:'Park',     role:'AFT PLN',  roleDesc:'Aft Planes Operator',                        gender:'m', watch:'B',    dcTeam:null    },
  ];

  // Derive organisational department from role or compartment when not explicit.
  const _DEPT_BY_ROLE = {
    'CO':'command','XO':'command','1ST LT':'command',"COX'N":'command',
    'MEO':'engineering',
    'LMA':'medical','MA':'medical',
    'CPOSA':'supply','PO(CS)':'supply','AB(CS)':'supply',
  };
  const _DEPT_BY_COMP = {
    fore_ends:'weapons', control_room:'warfare', aux_section:'warfare',
    reactor_comp:'reactor', engine_room:'engineering', aft_ends:'engineering',
  };

  function buildCrewManifest(){
    const manifest={};
    for(const comp of COMPS) manifest[comp]=[];
    // Watch A is on at game start. Off-watch (B) crew rest in aux_section (messes).
    const INITIAL_WATCH='A';
    for(const m of CREW_MANIFEST){
      const dept=m.dept||_DEPT_BY_ROLE[m.role]||_DEPT_BY_COMP[m.comp]||'warfare';
      const stationComp=m.comp;  // where they stand watch / their billet
      // Non-duty watchkeepers start in their rest location when off watch
      const physComp=(m.watch!=='duty'&&m.watch!==INITIAL_WATCH&&dept!=='supply'&&dept!=='medical')
                     ? 'aux_section' : stationComp;
      manifest[physComp].push({
        id:          m.id,
        name:        `${m.rating} ${m.firstName[0]}.${m.lastName}`,
        firstName:   m.firstName,
        lastName:    m.lastName,
        rating:      m.rating,
        role:        m.role,
        roleDesc:    m.roleDesc,
        gender:      m.gender,
        watch:       m.watch,
        dcTeam:      m.dcTeam,
        dept,
        status:      'fit',
        comp:        physComp,
        stationComp: stationComp,
      });
    }
    return manifest;
  }

  // Move crew to their watch station or rest location (messes) on watch change.
  function _relocateCrewForWatch(d, activeWatch){
    const allCrew=COMPS.flatMap(comp=>d.crew[comp]);
    for(const comp of COMPS) d.crew[comp]=[];
    for(const cr of allCrew){
      // Displaced crew stay wherever they evacuated to — don't route them back into danger
      if(cr.displaced){ d.crew[cr.comp].push(cr); continue; }
      const goStation=cr.watch===activeWatch||cr.watch==='duty'||cr.dept==='supply'||cr.dept==='medical';
      const dest=goStation ? (cr.stationComp||cr.comp) : 'aux_section';
      d.crew[dest].push(cr);
      cr.comp=dest;
    }
  }

  // ── DC team log (separate from main ship log) ─────────────────────────────
  // ── Init ──────────────────────────────────────────────────────────────────
  function initDamage(){
    const crewTotal=COMPS.reduce((a,c)=>a+COMP_DEF[c].crewCount,0);
    player.damage={
      strikes:  {fore_ends:0,control_room:0,aux_section:0,reactor_comp:0,engine_room:0,aft_ends:0},
      flooded:  {fore_ends:false,control_room:false,aux_section:false,reactor_comp:false,engine_room:false,aft_ends:false},
      systems:Object.fromEntries(ALL_SYS.map(s=>[s,'nominal'])),
      // Progressive flooding: rate (units/s) and current level (0-1)
      floodRate:{fore_ends:0,control_room:0,aux_section:0,reactor_comp:0,engine_room:0,aft_ends:0},
      flooding: {fore_ends:0,control_room:0,aux_section:0,reactor_comp:0,engine_room:0,aft_ends:0},
      towers:{fwd:'nominal',aft:'nominal'},
      crew:buildCrewManifest(),
      crewTotal,
      alerts:[],
      sinking:false,
      // HPA banks — operational[0..3] + reserve
      hpa:{ pressure:207, reserve:207, recharging:false },
      // Main ballast tanks — real fill state (0=air/empty, 1=full of water)
      // neutralFill=0.50 gives neutral buoyancy; e-blow drives toward 0
      mbt:{ tanks:[0.50,0.50,0.50,0.50,0.50], trimF:0.25, trimA:0.25, neutralFill:0.50 },
      sinkT:0,
      escapeState:null,
      escapeType:null,
      escapeSurvivors:0,
      escapePlayerSurvived:false,
      escapeDepthM:0,
      escapeT:0,
      escapeQueue:[],
      _tceProcessed:0,

      // Fire — level 0-1 per room (compartment within section)
      fire:Object.fromEntries(ROOM_IDS.map(id=>[id,0])),
      _fireDetected:{},  // roomId -> true when detected
      _fireDetectT:{},   // roomId -> seconds until detection (unmanned rooms)
      _fireWatch:{},   // comp -> { count, t, lastCasCheck, _outOfControlFired }
      _fireDrench:{},        // comp -> true (one-shot, compartment uninhabitable)
      _fireDrenchPending:{}, // comp -> { t: secondsRemaining } during 20s drench countdown
      _fireCritical:{},      // comp -> true (emergency stations already fired for this fire)
      _fireAlarmFired:{},    // roomId -> true (initial detection alarm already broadcast)
      _floodDeckDmg:{},      // comp -> {0,1,2: true} once deck damage has been applied

      // Compartment-level repair jobs (both teams contribute to one shared job)
      repairJobs:{},  // comp -> {sys, progress, totalTime} or null

      // Medical staff — auto-dispatch to casualties
      medTeam:{
        oconnor:{ id:'oconnor', label:'LMA', state:'standby', location:'control_room', destination:null, transitEta:0, treating:null, treatT:0, _deployed:false },
        hayes:  { id:'hayes',   label:'MA',  state:'standby', location:'control_room', destination:null, transitEta:0, treating:null, treatT:0, _deployed:false },
      },
      _medNoStaffFired:false,

      // DC teams
      teams:{
        alpha:{
          id:'alpha', label:'DC ALPHA',
          home:'aux_section_d0b',       // SR MESS — forward DC team berths here
          state:'ready',
          location:'aux_section_d0b',   // current compartment (room ID)
          destination:null,             // target compartment (room ID)
          transitEta:0,
          task:null,              // null|'flood'|'repair'
          repairTarget:null,      // sys name or null (auto)
          repairProgress:0,
          statusT:0,              // timer for periodic comms
          _autoMode:false, _readyT:0, _locked:false,
        },
        bravo:{
          id:'bravo', label:'DC BRAVO',
          home:'engine_room_d0',        // AFT PASSAGE — aft DC team berths here
          state:'ready',
          location:'engine_room_d0',    // current compartment (room ID)
          destination:null,             // target compartment (room ID)
          transitEta:0,
          task:null,
          repairTarget:null,
          repairProgress:0,
          statusT:0,
          _autoMode:false, _readyT:0, _locked:false,
        },
      },
      _emergMusterFired:false,

      // Watertight Doors — 5 doors between adjacent sections, all open at start
      wtd: Object.fromEntries(WTD_PAIRS.map(([a,b])=>[a+'|'+b,'open'])),
      _wtdSpreadAlerted:{},  // comp -> true once watchkeepers have reported WTD ingress
    };
    game.dcLog=[];
    game.showDcPanel=false;
  }

  // ── Crew helpers ──────────────────────────────────────────────────────────
  function totalFit(){
    if(!player.damage) return 0;
    return COMPS.reduce((a,c)=>a+(player.damage.crew[c]||[]).filter(x=>x.status==='fit').length,0);
  }
  function totalWounded(){
    if(!player.damage) return 0;
    return COMPS.reduce((a,c)=>a+(player.damage.crew[c]||[]).filter(x=>x.status==='wounded').length,0);
  }
  function totalKilled(){
    if(!player.damage) return 0;
    return COMPS.reduce((a,c)=>a+(player.damage.crew[c]||[]).filter(x=>x.status==='killed').length,0);
  }
  function totalCrew(){ return player.damage?.crewTotal||90; }

  function crewEfficiency(dept){
    const fit=totalFit(),total=totalCrew();
    if(total===0) return 0;
    return clamp(fit/total,0,1.0);
  }
  function maxDCTeams(){
    return Object.values(player.damage?.teams||{}).filter(t=>t.state!=='lost').length;
  }

  // ── WTD helpers ───────────────────────────────────────────────────────────
  function _hydMainOk(d){ return (d.systems?.hyd_main||'nominal')!=='destroyed'; }

  function _wtdTransitPenalty(from, to, d){
    if(!d.wtd) return 0;
    const fi=COMPS.indexOf(from), ti=COMPS.indexOf(to);
    if(fi<0||ti<0) return 0;
    const lo=Math.min(fi,ti), hi=Math.max(fi,ti);
    let penalty=0;
    for(let i=lo;i<hi;i++){
      const key=COMPS[i]+'|'+COMPS[i+1];
      const state=d.wtd[key]||'open';
      if(state==='closed'&&!WTD_RC_KEYS.has(key)) penalty+=20;
    }
    return penalty;
  }

  function _wtdFloodSpread(dt, d, pressureMult){
    for(const [a,b] of WTD_PAIRS){
      if((d.wtd[a+'|'+b]||'open')!=='open') continue;
      const fa=d.flooded[a]?1:(d.flooding[a]||0);
      const fb=d.flooded[b]?1:(d.flooding[b]||0);
      if(fa<0.05&&fb<0.05) continue;
      const diff=fa-fb;
      if(Math.abs(diff)<0.05) continue;
      const spreadAmt=0.12*pressureMult*dt;
      // Spread from higher to lower, fire watchkeeper alert on first ingress into manned section
      const _wtdCheckIngress=(dest, prev)=>{
        const destHasCrew=(SECTION_ROOMS[dest]||[]).some(rid=>(ROOMS[rid].crew||0)>0);
        if(prev<0.05 && (d.flooding[dest]||0)>=0.05 && destHasCrew && !(d._wtdSpreadAlerted||{})[dest]){
          if(!d._wtdSpreadAlerted) d._wtdSpreadAlerted={};
          d._wtdSpreadAlerted[dest]=true;
          _alert('FLOODING — '+SECTION_LABEL[dest]);
          dcLog(`${SECTION_LABEL[dest]} — FLOODING — water entering through open WTD`);
          window.G.setCasualtyState?.('emergency');
        }
      };
      if(diff>0&&!d.flooded[b]){
        const prev=d.flooding[b]||0;
        d.flooding[b]=Math.min(1,prev+spreadAmt);
        _wtdCheckIngress(b,prev);
      } else if(diff<0&&!d.flooded[a]){
        const prev=d.flooding[a]||0;
        d.flooding[a]=Math.min(1,prev+spreadAmt);
        _wtdCheckIngress(a,prev);
      }
    }
  }

  // ── Emergency WTD close — called on first flood detection ────────────────
  // Closes all open WTDs and fires staggered watchkeeper reports.
  // Short door labels for comms use abbreviated section names.
  const _WTD_COMMS = {
    'fore_ends|control_room':   { station:'CONN', door:'TORPS/CTRL' },
    'control_room|aux_section': { station:'AUX',  door:'CTRL/MESS'  },
    'aux_section|reactor_comp': { station:'REA',  door:'MESS/RCTR'  },
    'reactor_comp|engine_room': { station:'MAN',  door:'RCTR/MANV'  },
    'engine_room|aft_ends':     { station:'ENG',  door:'MANV/AFT'   },
  };
  function _emergencyCloseWTDs(d){
    if(!d.wtd) return;
    if(!d._wtdAutoClose) d._wtdAutoClose=[];
    if(!d._wtdAutoClosedKeys) d._wtdAutoClosedKeys=new Set();
    // Each door gets its own independent random delay — crew across the boat
    // arrive at their local door at different times and may close out of order.
    for(const [a,b] of WTD_PAIRS){
      const key=a+'|'+b;
      if((d.wtd[key]||'open')!=='open') continue;
      const delay=4.0+Math.random()*16.0; // 4–20 s, independent per door
      d._wtdAutoClose.push({key, t: delay-0.5});
      d._wtdAutoClosedKeys.add(key);
      const info=_WTD_COMMS[key];
      if(info) COMMS.flood.wtdClosed(info.station, info.door, delay);
    }
  }

  // Reopen all auto-closed WTDs after the flooding emergency is controlled
  function _emergencyOpenWTDs(d){
    if(!d.wtd||!d._wtdAutoClosedKeys?.size) return;
    if(!d._wtdAutoOpen) d._wtdAutoOpen=[];
    COMMS.flood.openWTDs();
    for(const key of d._wtdAutoClosedKeys){
      if((d.wtd[key]||'open')!=='closed') continue;
      const delay=4.0+Math.random()*16.0; // 4–20 s, independent per door
      d._wtdAutoOpen.push({key, t: delay-0.5});
      const info=_WTD_COMMS[key];
      if(info) COMMS.flood.wtdOpen(info.station, info.door, delay);
    }
    d._wtdAutoClosedKeys.clear();
  }

  // Tick pending emergency WTD openings (physically opens each door on schedule)
  function _tickWTDAutoOpen(dt, d){
    const pending=d._wtdAutoOpen;
    if(!pending?.length) return;
    for(let i=pending.length-1;i>=0;i--){
      pending[i].t-=dt;
      if(pending[i].t<=0){
        if(d.wtd) d.wtd[pending[i].key]='open';
        pending.splice(i,1);
      }
    }
  }

  // Tick pending emergency WTD closures (physically closes each door on schedule)
  function _tickWTDAutoClose(dt, d){
    const pending=d._wtdAutoClose;
    if(!pending?.length) return;
    for(let i=pending.length-1;i>=0;i--){
      pending[i].t-=dt;
      if(pending[i].t<=0){
        if(d.wtd) d.wtd[pending[i].key]='closed';
        pending.splice(i,1);
      }
    }
  }

  // ── Toggle a watertight door ───────────────────────────────────────────────
  function toggleWTD(sectionA, sectionB){
    const d=player.damage; if(!d) return;
    const key=sectionA+'|'+sectionB;
    if(!Object.prototype.hasOwnProperty.call(d.wtd, key)) return;
    if(!_hydMainOk(d)){
      dcLog('WTD — HYD PLANT DESTROYED — DOOR CANNOT BE OPERATED');
      return;
    }
    const cur=d.wtd[key];
    const next=cur==='open'?'closed':'open';
    d.wtd[key]=next;
    const isManual=(d.systems?.hyd_main||'nominal')==='offline';
    const labA=compLabel(sectionA);
    const labB=compLabel(sectionB);
    dcLog(`WTD ${labA}/${labB} — ${next.toUpperCase()}${isManual?' (MANUAL OP)':''}`);
  }

  function _floodComp(comp){
    const d=player.damage; let lost=0;
    for(const c of (d.crew[comp]||[])){ if(c.status!=='killed'&&!c.displaced){c.status='killed';lost++;} }
    return lost;
  }

  function _injureComp(comp,severity){
    const d=player.damage;
    const fit=(d.crew[comp]||[]).filter(c=>c.status==='fit');
    const nKill=Math.max(0,Math.round(rand(1,severity*8)));
    const nWound=Math.max(0,Math.round(rand(0,severity*5)));
    let killed=0,wounded=0;
    for(let i=0;i<Math.min(nKill,fit.length);i++){fit[i].status='killed';killed++;}
    for(let i=killed;i<Math.min(killed+nWound,fit.length);i++){
      fit[i].status='wounded';
      const r=Math.random();
      if(severity>0.55&&r<0.25)      { fit[i].severity='critical'; fit[i].bleedT=240; }
      else if(severity>0.25&&r<0.55) { fit[i].severity='serious'; }
      else                            { fit[i].severity='minor'; }
      wounded++;
    }
    return {killed,wounded};
  }

  // ── Hit compartment from impact angle ─────────────────────────────────────
  function hitCompartment(hitX,hitY){
    const dx=hitX-player.wx,dy=hitY-player.wy;
    const ang=Math.atan2(dy,dx);
    const rel=((ang-player.heading)+Math.PI*3)%(Math.PI*2)-Math.PI;
    if(rel>-Math.PI*0.25&&rel<Math.PI*0.25) return 'fore_ends';
    if(Math.abs(rel)<Math.PI*0.5)           return 'control_room';
    if(Math.abs(rel)>Math.PI*0.75){
      const r=rand(0,1);
      return r>0.5?'engine_room':r>0.15?'reactor_comp':'aux_section';
    }
    const r=rand(0,1);
    return r>0.45?'reactor_comp':r>0.1?'engine_room':'aux_section';
  }

  // ── Tower traversal ───────────────────────────────────────────────────────
  function canReachTower(comp,tower,d){
    const fwd=['fore_ends','control_room','aux_section'];
    const aft=['engine_room','aft_ends'];
    const blocked=d.flooded.reactor_comp||d.flooded.aux_section;
    if(tower==='fwd'){ if(fwd.includes(comp)) return true; return !blocked; }
    if(tower==='aft'){ if(aft.includes(comp)) return true; return !blocked; }
    return false;
  }

  // ── DC team helpers ───────────────────────────────────────────────────────
  // Returns crew currently available to fill a DC team:
  // off-watch (watch !== activeWatch) OR duty, matching dcTeam, not killed.
  function _activeDcCrew(teamId, d){
    const activeWatch=game.activeWatch||'A';
    const members=[];
    for(const comp of COMPS){
      for(const m of (d.crew[comp]||[])){
        if(m.dcTeam!==teamId) continue;
        if(m.watch===activeWatch) continue; // on watch — not available
        members.push(m);
      }
    }
    return members;
  }

  // Wound a random fit active DC team member; called when team takes a casualty.
  function _woundDcTeamMember(team, d){
    const fit=_activeDcCrew(team.id, d).filter(m=>m.status==='fit');
    if(fit.length===0) return;
    const victim=fit[Math.floor(Math.random()*fit.length)];
    victim.status=Math.random()<0.35?'killed':'wounded';
    if(victim.status==='wounded'){ victim.severity='serious'; }
    dcLog(`${team.label} — CASUALTY: ${victim.name} ${victim.status}`);
  }

  function _teamEffectiveness(team){
    if(team.state==='lost') return 0;
    if(team.state!=='on_scene') return 0;
    const d=player.damage; if(!d) return 0;
    const members=_activeDcCrew(team.id, d);
    if(members.length===0) return 0.1;
    const fit=members.filter(m=>m.status==='fit').length;
    return Math.max(0.15, fit/members.length);
  }

  // Which team is assigned to a section? (comp = section key)
  function teamAtComp(comp){
    const d=player.damage; if(!d) return null;
    for(const t of Object.values(d.teams)){
      if(t.state==='on_scene'&&roomSection(t.location)===comp) return t;
      if((t.state==='transit'||t.state==='mustering')&&t.destination===comp) return t;
    }
    return null;
  }

  // ── Assign a DC team to a compartment ────────────────────────────────────
  function assignTeam(teamId,comp){
    const d=player.damage; if(!d) return;
    const team=d.teams[teamId]; if(!team||team.state==='lost') return;


    // Cannot reassign a locked team (committed to active fire or flood)
    if(team._locked){ COMMS.dc.cannotReassign(team.label); return; }
    // Cannot interrupt a drench sequence
    if(team.task==='drench_pending') return;
    // If same team already there, do nothing
    if((team.state==='on_scene'||team.state==='transit')&&(roomSection(team.location)===comp||team.destination===comp)) return;

    // Can team cross? (reactor flooded blocks crossing)
    const fwd=['fore_ends','control_room','aux_section'];
    const aft=['engine_room','aft_ends'];
    const reactorFlooded=d.flooded.reactor_comp||d.flooded.aux_section;
    if(reactorFlooded){
      const teamSec=roomSection(team.location)||team.location;
      const teamFwd=fwd.includes(teamSec)||teamSec==='reactor_comp';
      const destFwd=fwd.includes(comp)||comp==='reactor_comp';
      if(teamFwd!==destFwd){ COMMS.dc.cannotCross(team.label); return; }
    }

    team.state='mustering';
    team.destination=comp;
    team.musterT=15;
    team.task=null;
    team.repairTarget=null;
    team.repairProgress=0;

    COMMS.dc.mustering(team.label, SECTION_LABEL[comp]);
  }

  // ── Recall a DC team to home compartment ─────────────────────────────────
  function recallTeam(teamId){
    const d=player.damage; if(!d) return;
    const team=d.teams[teamId]; if(!team||team.state==='lost') return;
    if(team._locked){ COMMS.dc.cannotReassign(team.label); return; }
    if(team.state==='ready'||team.state==='mustering') {
      team.state='ready'; team.destination=null; team.musterT=0; return;
    }
    if(team.task==='drench_pending') return; // cannot abort drench sequence
    const wasBlow=team.state==='blowing';
    team.state='ready';
    team.destination=null;
    team.task=null;
    team._ventIntent=null;
    team._ventT=0;
    team.repairTarget=null;
    team.repairProgress=0;
    COMMS.dc.recalled(team.label, wasBlow);
  }

  // ── DC auto-dispatch helpers ──────────────────────────────────────────────
  function _canReachComp(team,comp,d){
    const fwd=['fore_ends','control_room','aux_section'];
    const reactorFlooded=d.flooded.reactor_comp||d.flooded.aux_section;
    if(!reactorFlooded) return true;
    const loc=roomSection(team.location)||roomSection(team.home)||team.location;
    const teamFwd=fwd.includes(loc)||loc==='reactor_comp';
    const destFwd=fwd.includes(comp)||comp==='reactor_comp';
    return teamFwd===destFwd;
  }

  function _bestDCTarget(team,d){
    // Build set of comps already covered by another team (locked on-scene or auto-transiting)
    const covered=new Set(
      Object.values(d.teams)
        .filter(t=>t!==team&&(t._locked||(t.state==='transit'&&t._autoMode)||t.state==='mustering'))
        .map(t=>t.destination||roomSection(t.location)||t.location)
        .filter(Boolean)
    );
    // Fire takes priority over flood
    for(const comp of COMPS){
      if(covered.has(comp)) continue;
      if(!_canReachComp(team,comp,d)) continue;
      if(_sectionHasFire(comp,d)) return comp;
    }
    for(const comp of COMPS){
      if(covered.has(comp)) continue;
      if(!_canReachComp(team,comp,d)) continue;
      if(d.floodRate[comp]>0) return comp;
    }
    return null;
  }

  function _triggerEmergencyMuster(d){
    d._emergMusterFired=true;
    for(const team of Object.values(d.teams)){
      if(team.state==='ready'&&team._readyT===0){
        team._readyT=15;
        dcLog(`${team.label} — emergency stations. Mustering`);
      }
    }
  }

  function _autoAssignDirect(team,comp,d){
    const fromSec=roomSection(team.location)||team.location;
    const eta=TRAVEL[fromSec]?.[comp]??60;
    team.state='transit';
    team.destination=comp;
    team.transitEta=eta;
    team.task=null;
    team.repairTarget=null;
    team.repairProgress=0;
    team._autoMode=true;
    COMMS.dc.autoDispatching(team.label,SECTION_LABEL[comp],Math.round(eta));
  }

  function _autoDispatchDC(dt,d){
    if(window.G.game.casualtyState!=='emergency') return;
    if(!d._emergMusterFired) _triggerEmergencyMuster(d);
    for(const team of Object.values(d.teams)){
      if(team.state==='lost') continue;
      // Tick down emergency muster countdown
      if(team._readyT>0){
        team._readyT=Math.max(0,team._readyT-dt);
        if(team._readyT===0){
          // Mark auto-mode at muster completion regardless of whether a target exists now.
          // This ensures the team responds if a new fire/flood appears while it is standing by.
          team._autoMode=true;
          const target=_bestDCTarget(team,d);
          if(target) _autoAssignDirect(team,target,d);
        }
        continue;
      }
      // Re-dispatch a ready auto-mode team to any remaining threat
      if(team.state==='ready'&&team._autoMode){
        const target=_bestDCTarget(team,d);
        if(target) _autoAssignDirect(team,target,d);
      }
    }
  }

  // ── Main hit function ─────────────────────────────────────────────────────
  function hit(amount,hitX,hitY,forceComp){
    if(player.invuln>0) return;
    player.invuln=2.0;
    const d=player.damage;
    const severity=clamp(amount/55,0,1);
    const comp=forceComp||(hitX!=null&&hitY!=null?hitCompartment(hitX,hitY):COMPS[Math.floor(rand(0,5))]);
    const def=COMP_DEF[comp];
    if(!def) return;
    const prev=d.strikes[comp];
    game.hitFlash=0.8;

    if(prev>=1){
      // ── SECOND HIT → CRITICAL BREACH (fast but not instant) ──────────
      // Section was already damaged — structural failure greatly increases ingress rate.
      // Systems are NOT instantly destroyed; deck-level damage events handle that as
      // water rises. 'destroyed' state only applies when a damaged system takes another hit.
      d.strikes[comp]=2;
      d.floodRate[comp]=Math.max(d.floodRate[comp]||0, 0.04+severity*0.04);
      // Reset deck-damage tracking so rising water applies a fresh damage pass
      if(!d._floodDeckDmg) d._floodDeckDmg={};
      d._floodDeckDmg[comp]={};
      if(def.tower&&d.towers[def.tower]!=='destroyed') d.towers[def.tower]='destroyed';

      // DC teams on scene — evacuation roll; transit teams continue to arrive
      for(const team of Object.values(d.teams)){
        if(team.state==='on_scene'&&roomSection(team.location)===comp){
          if(Math.random()<0.75){
            team.state='ready'; team.task=null;
            _woundDcTeamMember(team, d);
            COMMS.dc.teamEvacuated(team.label, SECTION_LABEL[comp]);
          } else {
            team.state='lost';
            COMMS.dc.teamLost(team.label, SECTION_LABEL[comp]);
          }
        }
      }

      _alert(`${SECTION_LABEL[comp]} — SECOND BREACH`);
      COMMS.flood.secondBreach(SECTION_LABEL[comp], COMP_STATION[comp]||'ENG');
      if(comp==='reactor_comp'&&!player.scram&&typeof window.G.triggerScram==='function'){
        window.G.triggerScram('damage');
        COMMS.reactor.scram('damage');
      }
      _checkSinking();

    } else {
      // ── FIRST HIT → PROGRESSIVE FLOODING ────────────────────────────
      d.strikes[comp]=1;
      // Set flood rate based on severity (units/sec into 0–1 scale)
      // 0.008/s max → ~125s to fill at surface without DC (realistic 2-min window)
      // Pressure multiplier in tick drives this to ~36s at 300m — still survivable but urgent
      d.floodRate[comp]=Math.max(d.floodRate[comp], severity*0.008);

      // Only damage systems near the breach — torpedo hits the hull bottom,
      // so lower-deck systems are most vulnerable. Filter by deck proximity.
      const allSys=[...activeSystems(comp)].sort(()=>rand(-1,1));
      const maxDeck=severity>0.85?0:severity>0.5?1:2; // 0=all decks, 2=bottom only
      const sysList=allSys.filter(s=>(ROOMS[SYS_DEF[s].room]?.deck??1)>=maxDeck);
      const numHit=severity>0.7?Math.min(3,sysList.length):1;
      let reactorHit=false;
      for(let i=0;i<Math.min(numHit,sysList.length);i++){
        const steps=severity>0.85?2:1;
        const st=damageSystem(sysList[i],steps);
        _alert(`${SYS_LABEL[sysList[i]]} ${st.toUpperCase()}`);
        COMMS.sys.damaged(SYS_LABEL[sysList[i]], st, 1.5+i*0.6);
        if(sysList[i]==='steering' && st!=='nominal') COMMS.nav.steeringCasualty(st);
        if(sysList[i]==='reactor') reactorHit=true;
      }
      if(reactorHit&&!player.scram){
        if(typeof window.G.triggerScram==='function') window.G.triggerScram('damage');
        COMMS.reactor.scram('damage');
      }
      const cas=_injureComp(comp,severity);
      if(cas.killed>0||cas.wounded>0){
        _alert(`CASUALTIES — ${cas.killed} KIA${cas.wounded>0?`, ${cas.wounded} WND`:''}`);
        COMMS.sys.casualties(cas.killed, cas.wounded, SECTION_LABEL[comp]);
      }
      if(cas.wounded>0) COMMS.medical.casualtyCallOut(SECTION_LABEL[comp]);
      if(def.tower&&severity>0.7&&rand(0,1)>0.6&&d.towers[def.tower]==='nominal'){
        d.towers[def.tower]='damaged';
        _alert(`ESCAPE TOWER ${def.tower.toUpperCase()} DAMAGED`);
      }
      // Fire ignition — higher severity hits have a chance of starting a fire
      if(severity>0.35){
        const fireChance=(severity-0.35)/0.65*0.55;
        if(Math.random()<fireChance) igniteFire(comp, severity*0.12);
      }

      // Estimate time to flood without DC — account for current depth pressure
      const _bDepthM=Math.max(0,(player.depth||0)-(window.G.world?.seaLevel||0));
      const _bPMult=1+Math.min(_bDepthM/120,4);
      const tFlood=d.floodRate[comp]>0?Math.round(1/(d.floodRate[comp]*_bPMult)):999;
      const urgency=tFlood<60?'CRITICAL — ':tFlood<120?'URGENT — ':'';
      window.G.setCasualtyState('emergency');
      COMMS.flood.firstHit(SECTION_LABEL[comp], COMP_STATION[comp]||'ENG', urgency, tFlood);
      COMMS.flood.closeWTDs(SECTION_LABEL[comp]);
      _emergencyCloseWTDs(d);
    }

    // ── Propulsion casualties from shock / system damage ────────────────
    const cas=C.player.casualties||{};

    // Turbine trip — shock from any hit can trip the turbines
    if(!player._turbineTrip && !player.scram && !player._steamLeak){
      const tripCfg=cas.turbineTrip||{};
      if(Math.random() < (tripCfg.shockChance||0.15)){
        player._turbineTrip={ timer:rand(tripCfg.recoveryTime?.[0]||20, tripCfg.recoveryTime?.[1]||30) };
        COMMS.reactor.turbineTrip();
      }
    }

    // Steam leak — when main_turbines or pressuriser already degraded+ and takes another hit
    if(!player._steamLeak && !player.scram){
      const steamCfg=cas.steamLeak||{};
      const turbState=d.systems.main_turbines||'nominal';
      const pressState=d.systems.pressuriser||'nominal';
      const turbVuln=STATES.indexOf(turbState)>=1; // degraded+
      const pressVuln=STATES.indexOf(pressState)>=1;
      if((turbVuln||pressVuln) && Math.random()<(steamCfg.shockChance||0.12)){
        player._steamLeak={ timer:rand(steamCfg.repairTime?.[0]||30, steamCfg.repairTime?.[1]||60) };
        player._turbineTrip=null; // steam leak supersedes turbine trip
        COMMS.reactor.steamLeak();
      }
    }

    // Reactor runaway — severe hit to reactor or primary_coolant
    if(!player.scram && severity>0.6){
      const raCfg=cas.reactorRunaway||{};
      const hitReactor=comp==='reactor_comp'; // reactor comp hit = reactor systems at risk
      if(hitReactor && Math.random()<(raCfg.hitChance||0.08)){
        // Loud acoustic transient
        if(typeof window._broadcastTransient==='function'){
          window._broadcastTransient(player.wx, player.wy, raCfg.transientRange||3000, raCfg.transientSus||0.6, null);
        }
        COMMS.reactor.reactorRunaway();
        window.G.triggerScram('runaway');
        // Clear other propulsion casualties — SCRAM overrides
        player._turbineTrip=null;
        player._steamLeak=null;
        player._coolantLeak=null;
      }
    }

    player.hp=Math.max(1,100-Object.values(d.strikes).reduce((a,b)=>a+b,0)*35);
  }

  // ── Sinking check ─────────────────────────────────────────────────────────
  function _checkSinking(){
    if(window.G?.game?.godMode) return;
    const d=player.damage;
    const fl=d.flooded;
    const flCount=COMPS.filter(c=>fl[c]).length;
    const criticalDamage=flCount>=2||fl.control_room||(fl.reactor_comp&&fl.engine_room);
    if(criticalDamage){
      player.hp=0;
      _alert('CRITICAL FLOODING');
      window.G.setCasualtyState('emergency');
      // Emergency stations + all stop only on first critical event — don't repeat if already called
      if(!d._criticalFired){
        d._criticalFired=true;
        window.PANEL?.snapToAllStop();
        COMMS.crewState.emergencyStations('flood');
      }
      COMMS.flood.critical();
    }
  }

  // ── Seal flooding (last resort) ───────────────────────────────────────────
  function sealFlooding(comp){
    const d=player.damage;
    if(!d||(d.flooding[comp]||0)<=0) return;
    // Kill any team inside
    for(const team of Object.values(d.teams)){
      if(team.state==='on_scene'&&roomSection(team.location)===comp){
        team.state='lost';
        COMMS.dc.teamLostSealed(team.label, SECTION_LABEL[comp]||comp);
      }
    }
    d.floodRate[comp]=0;
    d.flooding[comp]=0;
    if(d._floodDeckDmg?.[comp]) d._floodDeckDmg[comp]={};
    for(const sys of activeSystems(comp)){
      if(d.systems[sys]==='nominal') damageSystem(sys);
    }
    COMMS.flood.sealed(SECTION_LABEL[comp]||comp);
    dcLog(`${SECTION_LABEL[comp]||comp} — SEALED. All systems offline`);
  }

  // ── System helpers ────────────────────────────────────────────────────────
  function stateIndex(sys){ return STATES.indexOf(player.damage.systems[sys]); }
  function damageSystem(sys,steps=1){
    const d=player.damage;
    const next=Math.min(stateIndex(sys)+steps,STATES.length-1);
    d.systems[sys]=STATES[next];
    // Primary coolant loss → automatic SCRAM
    if(sys==='primary_coolant'&&next>=2&&!player.scram&&typeof window.G.triggerScram==='function'){
      window.G.triggerScram('coolant');
      COMMS.reactor.scram('coolant');
    }
    return STATES[next];
  }
  // Systems that are passive hardware — don't need crew to operate.
  // Escape trunks, trim tanks, passive arrays, etc.
  const PASSIVE_SYS = new Set(['fwd_escape','aft_escape','fwd_trim','aft_trim','shaft_seals','rad_monitor']);

  // Effective state accounting for:
  //  1. Control-node dependency (helm→fwd planes, fire_ctrl→tubes/tdc)
  //  2. Unmanned section — no fit crew = active systems offline
  function effectiveState(sys,d){
    d=d||player.damage;
    const own=d.systems[sys]||'nominal';
    const def=SYS_DEF[sys];
    if(!def) return own;
    let worst=STATES.indexOf(own);
    // Control node dependency
    if(def.ctrl){
      worst=Math.max(worst, STATES.indexOf(d.systems[def.ctrl]||'nominal'));
    }
    // Unmanned section — no fit crew means active systems can't be operated
    if(!PASSIVE_SYS.has(sys) && d.crew){
      const sec=ROOMS[def.room]?.section;
      if(sec){
        const fitCrew=(d.crew[sec]||[]).filter(cr=>cr.status==='fit'&&!cr.displaced);
        if(fitCrew.length===0) worst=Math.max(worst, STATES.indexOf('offline'));
      }
    }
    return STATES[worst];
  }

  // ── Next damaged system to repair in a compartment (auto-priority) ────────
  function _nextRepairTarget(comp,d){
    const sysList=activeSystems(comp);
    // Priority: worst state first, skip nominal only (destroyed is repairable post-blow)
    const repairable=sysList
      .filter(s=>d.systems[s]!=='nominal')
      .sort((a,b)=>stateIndex(b)-stateIndex(a));
    return repairable[0]||null;
  }

  // Pick the best room in a section for DC team arrival (worst fire room, or first room)
  function _bestArrivalRoom(section,d){
    const rooms=SECTION_ROOMS[section]||[];
    if(!rooms.length) return section; // fallback
    // Prefer the room with the worst fire
    let best=rooms[0], bestFire=0;
    for(const rid of rooms){
      const f=d.fire[rid]||0;
      if(f>bestFire){ bestFire=f; best=rid; }
    }
    return best;
  }

  // ── DC team tick ──────────────────────────────────────────────────────────
  function _tickTeams(dt,d){
    for(const team of Object.values(d.teams)){
      if(team.state==='lost') continue;

      team.statusT=Math.max(0,team.statusT-dt);

      // ── MUSTERING ──────────────────────────────────────────────────────
      if(team.state==='mustering'){
        team.musterT-=dt;
        if(team.musterT<=0){
          const destSec=team.destination; // section key
          const fromSec=roomSection(team.location)||team.location;
          const eta=(TRAVEL[fromSec]?.[destSec]??60)+_wtdTransitPenalty(fromSec,destSec,d);
          team.state='transit';
          team.transitEta=eta;
          COMMS.dc.dispatched(team.label, SECTION_LABEL[destSec]||COMP_DEF[destSec]?.label||destSec, Math.round(eta));
        }
        continue;
      }

      // ── TRANSIT ────────────────────────────────────────────────────────
      if(team.state==='transit'){
        team.transitEta-=dt;
        if(team.transitEta<=0){
          const arrSec=team.destination; // section key
          // Pick the most relevant compartment in the section
          const arrRoom=_bestArrivalRoom(arrSec,d);
          team.location=arrRoom;
          team.destination=null;
          team.repairProgress=0;
          if(d.flooded[arrSec]){
            team.state='blowing';
            team.task='blow';
            team._locked=true;
            COMMS.dc.blow.started(team.label, ROOMS[arrRoom]?.label||arrSec);
          } else {
            team.state='on_scene';
            team.task=null;
            if(d._fireDrench?.[arrSec]&&team._ventIntent===arrSec){
              team._ventIntent=null;
              team.task='vent_n2';
              team._ventT=VENT_N2_TIME;
              if(d._fireDrench[arrSec]) d._fireDrench[arrSec].venting=true;
              COMMS.dc.onScene(team.label, ROOMS[arrRoom]?.label||arrSec);
              COMMS.fire.ventN2Started(SECTION_LABEL[arrSec]||arrSec, team.label);
            } else if(_sectionHasFire(arrSec,d)){
              team._ventIntent=null;
              team.task='fire';
              team._locked=true;
              team._fireLosing=0;
              COMMS.fire.dcArrival(team.label, ROOMS[arrRoom]?.label||arrSec);
            } else if(d.floodRate[arrSec]>0){
              team._ventIntent=null;
              COMMS.dc.onScene(team.label, ROOMS[arrRoom]?.label||arrSec);
              team.task='flood';
              team._locked=true;
              COMMS.dc.floodingActive(team.label);
            } else {
              team._ventIntent=null;
              COMMS.dc.onScene(team.label, ROOMS[arrRoom]?.label||arrSec);
              const sys=_nextRepairTarget(arrSec,d);
              if(sys){
                team.task='repair';
                team.repairTarget=sys;
                COMMS.dc.startRepair(team.label, SYS_LABEL[sys]);
              } else {
                team.task=null;
                team.state='ready';
                dcLog(`${team.label} — ${SECTION_LABEL[arrSec]||arrSec} secure. Standing by`);
              }
            }
          }
        }
        continue;
      }

      // ── ON SCENE ───────────────────────────────────────────────────────
      if(team.state==='on_scene'){
        const roomId=team.location;       // room ID (compartment)
        const sec=roomSection(roomId)||roomId; // section key
        const eff=_teamEffectiveness(team);

        // If section flooded while on_scene → evac roll
        if(d.flooded[sec]){
          team.state='blowing';
          team.task='blow';
          team._locked=true;
          COMMS.dc.blow.started(team.label, ROOMS[roomId]?.label||sec);
          continue;
        }

        // Drench pending — team is at N2 panel outside comp; skip all task logic
        if(team.task==='drench_pending') continue;

        // ── N2 VENTING ──────────────────────────────────────────────────
        if(team.task==='vent_n2'){
          if(!team._ventT) team._ventT=VENT_N2_TIME;
          team._ventT-=dt;
          if(d._fireDrench?.[sec]) d._fireDrench[sec].level = Math.max(0, team._ventT / VENT_N2_TIME);
          if(team._ventT<=0){
            team._ventT=0; team.task=null; team._locked=false;
            if(d._fireDrench) delete d._fireDrench[sec];
            _returnCrew(sec,d,'fire');
            COMMS.fire.ventN2Complete(SECTION_LABEL[sec]||sec);
            const sys=_nextRepairTarget(sec,d);
            if(sys){ team.task='repair'; team.repairTarget=sys; COMMS.dc.startRepair(team.label,SYS_LABEL[sys]); }
            else { team.state='ready'; COMMS.dc.allSecure(team.label,SECTION_LABEL[sec]||sec); }
            _checkClearEmergency(d);
          }
          continue;
        }

        // ── FIRE FIGHTING ───────────────────────────────────────────────
        if(team.task==='fire'||_sectionHasFire(sec,d)){
          team.task='fire';
          team._locked=true;
          // Auto-migrate to worst burning room in the section
          const curFire=d.fire[roomId]||0;
          if(curFire<0.01){
            const worstRoom=_bestArrivalRoom(sec,d);
            if(worstRoom!==roomId&&(d.fire[worstRoom]||0)>0.01){
              team.location=worstRoom;
              COMMS.fire.dcMoved?.(team.label, ROOMS[worstRoom]?.label||sec);
            }
          }
          if(team.statusT<=0){
            team.statusT=20;
            COMMS.fire.dcStatus(team.label,Math.round(_sectionFire(sec,d)*100),ROOMS[team.location]?.label||sec);
          }
          continue;
        }

        // ── FLOOD FIGHTING ──────────────────────────────────────────────
        const FLOOD_FIGHT_RATE=0.055;
        if(team.task==='flood'||d.floodRate[sec]>0){
          team.task='flood';
          team._locked=true;

          // If floodRate already 0 (e.g. after blow re-entry), skip straight to post-seal
          if(d.floodRate[sec]<=0){
            team._locked=false;
            if((d.flooding[sec]||0)<=0.05) _returnCrew(sec,d);
            team.task=null;
            const sys=_nextRepairTarget(sec,d);
            if(sys){
              team.task='repair'; team.repairTarget=sys; team.repairProgress=0;
            } else {
              team.state='ready';
            }
            continue;
          }

          const reduction=FLOOD_FIGHT_RATE*eff;
          d.floodRate[sec]=Math.max(0,d.floodRate[sec]-reduction*dt);

          if(d.floodRate[sec]===0){
            team._locked=false;
            if((d.flooding[sec]||0)<=0.05) _returnCrew(sec,d);
            team.task=null;
            const sys=_nextRepairTarget(sec,d);
            if(sys){
              team.task='repair'; team.repairTarget=sys; team.repairProgress=0;
              COMMS.dc.breachSealed(team.label, SECTION_LABEL[sec]||sec, sys, SYS_LABEL[sys]);
            } else {
              team.state='ready';
              COMMS.dc.breachSealed(team.label, SECTION_LABEL[sec]||sec, null, null);
            }
          } else {
            if(team.statusT<=0){
              team.statusT=25;
              const pct=Math.round(d.flooding[sec]*100);
              const netRate=d.floodRate[sec];
              COMMS.dc.floodStatus(team.label, pct, netRate);
            }
          }
          continue;
        }

        // ── REPAIR — section-level shared job ───────────────────────────
        const teamsOnScene=Object.values(d.teams).filter(t=>t.state==='on_scene'&&roomSection(t.location)===sec).length;
        const repairSpeed=eff*(teamsOnScene>=2?1.4:1.0);

        let job=d.repairJobs[sec];
        if(!job||d.systems[job.sys]==='nominal'){
          const sys=_nextRepairTarget(sec,d);
          if(sys){
            const jobIsNew=!job||job.sys!==sys;
            d.repairJobs[sec]=job={sys,progress:0,totalTime:REPAIR_TIME[d.systems[sys]]||45};
            if(jobIsNew){
              COMMS.dc.startRepair(team.label, SYS_LABEL[sys]);
            }
          } else {
            d.repairJobs[sec]=null;
            team.task=null;
            team.state='ready';
            COMMS.dc.allSecure(team.label, SECTION_LABEL[sec]||sec);
            _checkClearEmergency(d);
            continue;
          }
        }
        job=d.repairJobs[sec];
        if(job){
          team.task='repair';
          team.repairTarget=job.sys;
          const teamsList=Object.values(d.teams).filter(t=>t.state==='on_scene'&&roomSection(t.location)===sec);
          const isLead=teamsList[0]===team;
          if(isLead){
            job.progress+=repairSpeed*dt;
            if(team.statusT<=0){
              team.statusT=30;
              const pct=Math.round(job.progress/job.totalTime*100);
              COMMS.dc.repairProgress(team.label, SYS_LABEL[job.sys], pct, teamsOnScene>=2);
            }
            if(job.progress>=job.totalTime){
              const sys=job.sys;
              const cur=stateIndex(sys);
              if(cur>0){
                d.systems[sys]=STATES[cur-1];
                const restored=STATES[cur-1];
                COMMS.dc.repairComplete(team.label, SYS_LABEL[sys], restored, teamsOnScene>=2);
                // Reactor-specific follow-up from maneuvering — tells crew whether restart
                // is now possible (nominal) or further work is still needed (degraded/offline).
                if(sys==='reactor') COMMS.reactor.repairReadyRestart(restored);
                _alert(`${SYS_LABEL[sys]} REPAIRED`);
                // High-energy repair risk
                if(HIGH_ENERGY_SYS.has(sys)&&Math.random()<0.07){
                  const secCrew=(d.crew[sec]||[]).filter(c=>c.status==='fit');
                  if(secCrew.length>0){
                    const victim=secCrew[Math.floor(Math.random()*secCrew.length)];
                    victim.status=Math.random()<0.35?'killed':'wounded';
                    dcLog(`${team.label} — CASUALTY during ${SYS_LABEL[sys]} repair. ${victim.name} ${victim.status}`);
                  }
                }
              }
              d.repairJobs[sec]=null;
            }
          }
        }
      }

      // ── HP AIR BLOW (team outside flooded section) ──────────────────────
      if(team.state==='blowing'){
        const blowRoom=team.location;
        const blowSec=roomSection(blowRoom)||blowRoom;
        if(!d.flooded[blowSec]){
          team.state='on_scene'; team.task=null;
          COMMS.dc.blow.accessible(team.label, SECTION_LABEL[blowSec]||blowSec);
          continue;
        }
        const BLOW_RATE=0.008;
        d.flooding[blowSec]=Math.max(0,(d.flooding[blowSec]||0)-BLOW_RATE*dt);
        if(team.statusT<=0){
          team.statusT=20;
          const pct=Math.round(d.flooding[blowSec]*100);
          COMMS.dc.blow.progress(team.label, SECTION_LABEL[blowSec]||blowSec, pct);
        }
        if(d.flooding[blowSec]<=0.15){
          d.flooded[blowSec]=false;
          d.floodRate[blowSec]=0;
          team.state='on_scene';
          team.task='flood';
          team._locked=false;
          COMMS.dc.blow.complete(team.label, SECTION_LABEL[blowSec]||blowSec);
          _alert(`${SECTION_LABEL[blowSec]||blowSec} RE-ENTERED`);
          _returnCrew(blowSec,d);
        }
        continue;
      }
    }
    _autoDispatchDC(dt,d);
  }

  // ── Escape ────────────────────────────────────────────────────────────────
  function _depthM(){
    return player.depth||0;  // already in metres
  }
  function canTCE(){
    const d=player.damage; if(!d) return false;
    if(_depthM()>200) return false;
    return _towerAvail('fwd',d)||_towerAvail('aft',d);
  }
  // Tower available if structurally intact AND escape trunk not destroyed
  function _towerAvail(tower,d){
    if(d.towers[tower]==='destroyed') return false;
    const trunkSys=tower==='fwd'?'fwd_escape':'aft_escape';
    return (d.systems[trunkSys]||'nominal')!=='destroyed';
  }
  function _survChance(type){
    const depth=_depthM();
    if(type==='tce'){
      if(depth<=80)  return 0.96;
      if(depth<=120) return 0.88;
      if(depth<=160) return 0.65;
      if(depth<=200) return 0.35;
      return 0.05;
    }
    if(depth<=50)  return 0.82;
    if(depth<=80)  return 0.65;
    if(depth<=120) return 0.42;
    if(depth<=180) return 0.20;
    if(depth<=250) return 0.08;
    if(depth<=300) return 0.03;
    return 0.01;
  }
  function _escapeHalt(){
    const p = window.G.player;
    if(p){ p.speedOrderKts=0; p.speedDir=0; p.depthOrder=0; }
    window.PANEL?.snapToAllStop();
    // Emergency blow is a commanded action — player retains that decision.

    // CO's final log entry — contextual, factual, one line of humanity at the end
    const d=p?.damage;
    const depth=Math.round(p?.depth??0);
    const COMP_NAMES={fore_ends:'torpedo room',control_room:'control room',aux_section:'aux machinery',reactor_comp:'reactor',engine_room:'engine room',aft_ends:'aft ends'};
    const floodedComps=d?['fore_ends','control_room','aux_section','reactor_comp','engine_room','aft_ends'].filter(cp=>d.flooded[cp]).map(cp=>COMP_NAMES[cp]):[];
    const floodStr=floodedComps.length===0?'structural failure'
      :floodedComps.length===1?`flooding in ${floodedComps[0]}`
      :`flooding in ${floodedComps.slice(0,-1).join(', ')} and ${floodedComps[floodedComps.length-1]}`;
    const fit=window.DMG?.totalFit?.()??'?';
    const total=window.DMG?.totalCrew?.()??'?';
    const spd=Math.round(p?.speed??0);
    const trimNote=spd<=1?'no way on':spd<=5?'slow ahead':'making way';
    const closers=['Good luck to you all.','It has been an honour.','God speed.','That will be all.'];
    const closer=closers[Math.floor((window.G.game?.missionT??0)*7+depth)%closers.length];
    window.G.addLog('CONN',
      `CO — ${floodStr}, depth ${depth}m, ${trimNote}. ${fit} of ${total} hands fit. All hands, abandon ship. ${closer}`,
      window.COMMS.P.CRIT
    );
  }

  function initiateEscape(type){
    const d=player.damage; if(!d||d.escapeState) return;
    if(type==='tce'&&!canTCE()){COMMS.escape.tceNotViable();return;}
    d.escapeType=type;
    d.escapeDepthM=Math.round(_depthM());
    d.escapeT=0; d.escapeSurvivors=0; d._tceProcessed=0;
    if(type==='tce'){
      d.escapeQueue=[];
      const towers=[];
      if(_towerAvail('fwd',d)) towers.push('fwd');
      if(_towerAvail('aft',d)) towers.push('aft');
      for(const comp of COMPS){
        for(const c of (d.crew[comp]||[])){
          if(c.status==='killed') continue;
          let t=null;
          const pref=[COMP_DEF[comp].tower,...towers].filter(Boolean);
          for(const tw of pref){ if(towers.includes(tw)&&canReachTower(comp,tw,d)){t=tw;break;} }
          if(t) d.escapeQueue.push({crewman:c,tower:t});
          else c.status='killed';
        }
      }
      d.escapeState='tce_running';
      window.G.setCasualtyState('escape');
      _escapeHalt();
      COMMS.escape.tce();
    } else {
      d.escapeState='rush_running';
      d.escapeT=12;
      window.G.setCasualtyState('escape');
      _escapeHalt();
      COMMS.escape.rush();
    }
  }
  function _resolveEscape(){
    const d=player.damage;
    const sc=_survChance(d.escapeType);
    let survivors=0;
    for(const comp of COMPS){
      for(const c of (d.crew[comp]||[])){
        if(c.status==='killed') continue;
        if(Math.random()<sc) survivors++;
        else c.status='killed';
      }
    }
    const co=(d.crew.control_room||[]).find(c=>c.rating==='CDR');
    const playerSurvives=co?.status==='killed'?false:Math.random()<Math.min(sc+0.15,0.99);
    d.escapeSurvivors=survivors;
    d.escapePlayerSurvived=playerSurvives;
    d.escapeState='complete';
    game.over=true;
    game.escapeResolved=true;
  }

  // ── Crush depth ───────────────────────────────────────────────────────────
  // ── Depth flooding cascade ────────────────────────────────────────────────
  // Called from nav.js each frame when beyond collapse depth.
  // Starts a seep in a random compartment, then queues subsequent ones.
  // Seep rate is much slower than breach — crew stay at their posts.
  const SEEP_RATE  = 0.004;  // flood units/s — ~4 min to fill (vs torpedo breach 0.008 → ~2 min)
  const SEEP_DELAY_MIN = 30; // seconds before next compartment starts seeping
  const SEEP_DELAY_MAX = 90;

  function applyDepthCascade(dt){
    const d=player.damage; if(!d) return;

    // Initialise cascade state
    if(!d._depthCascade) d._depthCascade = { active:false, nextT:0, seeping:[] };
    const cas = d._depthCascade;

    // Start first seep if not already active
    if(!cas.active){
      cas.active = true;
      cas.nextT  = 0; // trigger immediately for first
    }

    // Countdown to next compartment
    if(cas.nextT > 0){ cas.nextT -= dt; return; }

    // Pick a compartment that isn't already fully flooded or seeping
    const seepable = COMPS.filter(c =>
      !d.flooded[c] &&
      !cas.seeping.includes(c) &&
      (d.floodRate[c]||0) < SEEP_RATE   // don't double-flood already breached comps
    );
    if(seepable.length === 0) return; // all flooded, nothing to do

    const comp = seepable[Math.floor(Math.random()*seepable.length)];
    cas.seeping.push(comp);

    // Seep rate scales with depth pressure — deeper = faster structural weeping
    const _sDepthM=Math.max(0,(player.depth||0)-(window.G.world?.seaLevel||0));
    const _sPMult=1+Math.min(_sDepthM/120,4);
    const seepRate=SEEP_RATE*_sPMult;

    // Apply seep — slow structural weeping, no breach evacuation
    d.floodRate[comp] = Math.max(d.floodRate[comp]||0, seepRate);
    d._seepComp = d._seepComp || {};
    d._seepComp[comp] = true; // mark as depth seep, not breach

    // Comms — watchkeeper reports structural weeping, no evac
    const label = SECTION_LABEL[comp];
    const station = COMP_STATION[comp]||'ENG';
    const tFlood = Math.round(1/seepRate);
    window.COMMS?.flood?.depthSeep(label, station, tFlood);
    window.COMMS?.flood?.closeWTDs(label);
    _emergencyCloseWTDs(d);

    // Queue next compartment
    cas.nextT = SEEP_DELAY_MIN + Math.random()*(SEEP_DELAY_MAX-SEEP_DELAY_MIN);
  }

  // Reset cascade when back above collapse depth
  function resetDepthCascade(){
    const d=player.damage; if(!d||!d._depthCascade) return;
    d._depthCascade.active = false;
    d._depthCascade.nextT  = 0;
    d._depthCascade.seeping = [];
  }

  // Legacy shim — kept for any external callers
  function applyHullStress(amount){
    applyDepthCascade(0);
  }

  // ── Main tick ─────────────────────────────────────────────────────────────
  // ── Return displaced crew when compartment clears ──────────────────────────
  function _returnCrew(comp,d,cause='flood'){
    if(d._evacuated) d._evacuated[comp]=false;
    // Displaced crew from this section may have been physically moved to other sections.
    // Search all sections for crew whose original comp was here (stationComp) and are displaced.
    const returnees=[];
    for(const sec of COMPS){
      const evacuees=(d.crew[sec]||[]).filter(cr=>cr.displaced&&cr.status!=='killed'&&cr.stationComp===comp);
      for(const cr of evacuees){
        // Move them back to their home section
        d.crew[sec]=d.crew[sec].filter(c=>c!==cr);
        if(!d.crew[comp]) d.crew[comp]=[];
        cr.comp=comp;
        cr.displaced=false;
        d.crew[comp].push(cr);
        returnees.push(cr);
      }
    }
    // Also clear displaced flag for any who weren't physically moved (flood path)
    const inPlace=(d.crew[comp]||[]).filter(cr=>cr.displaced&&cr.status!=='killed');
    for(const cr of inPlace){ cr.displaced=false; returnees.push(cr); }
    if(!returnees.length) return;
    if(cause==='fire') COMMS.fire.crewReturn(SECTION_LABEL[comp], COMP_STATION[comp]||'ENG', returnees.length);
    else               COMMS.flood.crewReturn(SECTION_LABEL[comp], COMP_STATION[comp]||'ENG', returnees.length);
  }

  // ── Fire ignition ─────────────────────────────────────────────────────────
  // target: room ID (e.g. 'engine_room_d1') or section key (picks a manned room)
  function igniteFire(target, intensity){
    intensity=intensity||0.05;
    const d=player.damage; if(!d) return;
    d._fireDetected=d._fireDetected||{};
    d._fireDetectT=d._fireDetectT||{};
    // Resolve to room ID
    let roomId;
    if(ROOMS[target]){
      roomId=target;
    } else if(SECTION_ROOMS[target]){
      const all=SECTION_ROOMS[target];
      const manned=all.filter(r=>(ROOMS[r].crew||0)>0);
      const pool=manned.length?manned:all;
      roomId=pool[Math.floor(Math.random()*pool.length)];
    } else { return; }
    const room=ROOMS[roomId];
    const section=room.section;
    if(d._fireDrench?.[section]) return;
    if(d.flooded[section]) return;
    if((d.fire[roomId]||0)>=intensity) return;
    d.fire[roomId]=Math.max(d.fire[roomId]||0, intensity);
    if((room.crew||0)===0){
      // Empty room — burns silently; sensor alarm fires at FIRE_DETECT_THRESHOLD
      d._fireDetected[roomId]=false;
    } else {
      // Manned room — crew reports fire immediately (or after detectionDelay)
      d._fireDetected[roomId]=true;
      _triggerFireDetection(roomId, section, d);
    }
  }

  // Runs section-level response when a fire is detected (manned room = immediate,
  // unmanned room = after detectionDelay countdown)
  function _triggerFireDetection(roomId, section, d){
    const room=ROOMS[roomId];
    // Critical: mark detected NOW so this isn't called every tick for unmanned rooms
    d._fireDetected[roomId]=true;
    if(!d._evacuated) d._evacuated={};
    d._evacuated[section]=true;
    if(!d._fireWatch) d._fireWatch={};
    const isManned=(room.crew||0)>0;
    if(!d._fireWatch[section]){
      // First detected fire in this section — mobilise watchkeepers
      // Watchkeeper count = sum of crew in all rooms of this section (capped at 6)
      const sectionCrewCount=(SECTION_ROOMS[section]||[]).reduce((sum,rid)=>sum+(ROOMS[rid].crew||0),0);
      const watchCount=Math.min(6,sectionCrewCount);
      // Non-watchkeeper crew begin evacuating — physically moved after FIRE_EVAC_TIME seconds.
      const fitCrew=(d.crew[section]||[]).filter(cr=>cr.status==='fit'&&!cr.displaced);
      const evacuees=fitCrew.slice(watchCount);
      if(evacuees.length>0){
        if(!d._fireEvac) d._fireEvac={};
        d._fireEvac[section]={ t:FIRE_EVAC_TIME, ids:evacuees.map(cr=>cr.id) };
      }
      d._fireWatch[section]={ count:watchCount, t:0, lastCasCheck:0, _outOfControlFired:false };
      _alert(`FIRE — ${room.label}`);
      if(!isManned){
        // Alarm already sent at 40% — this call is the investigator's confirmation
        COMMS.fire.fireInvestigated(room.label, COMP_STATION[section]||'ENG');
      } else {
        COMMS.fire.ignited(room.label, COMP_STATION[section]||'ENG');
        if(watchCount>0) COMMS.fire.watchkeeperResponse(SECTION_LABEL[section], watchCount);
      }
      window.G.setCasualtyState('emergency');
    } else {
      // Section already on alert — just announce the new room
      _alert(`FIRE — ${room.label}`);
      if(!isManned){
        COMMS.fire.fireInvestigated(room.label, COMP_STATION[section]||'ENG');
      } else {
        COMMS.fire.ignited(room.label, COMP_STATION[section]||'ENG');
      }
    }
    if(section==='reactor_comp'&&!d._reactorFireScram){
      d._reactorFireScram=true;
      if(d.systems.reactor==='nominal'||d.systems.reactor==='degraded') d.systems.reactor='offline';
      if(!player.scram&&typeof window.G.triggerScram==='function') window.G.triggerScram('damage');
      COMMS.reactor.scram('fire');
    }
  }

  // ── Fire extinguish helper ────────────────────────────────────────────────
  function _extinguishFire(roomId, d, by){
    d.fire[roomId]=0;
    delete d._fireDetected[roomId];
    delete d._fireDetectT[roomId];
    if(d._fireAlarmFired) delete d._fireAlarmFired[roomId];
    const section=ROOMS[roomId].section;
    // If other rooms in this section still burn, no section-level cleanup yet
    if((SECTION_ROOMS[section]||[]).some(rid=>rid!==roomId&&(d.fire[rid]||0)>0.01)) return;
    // Section fully clear
    if(d._fireWatch) d._fireWatch[section]=null;
    // Cancel pending evacuation — crew don't need to leave, fire is out
    if(d._fireEvac?.[section]) delete d._fireEvac[section];
    if(d._fireDrenchPending?.[section]){
      delete d._fireDrenchPending[section];
      const drenchTeam=Object.values(d.teams).find(t=>t.task==='drench_pending'&&roomSection(t.location)===section);
      if(drenchTeam){ drenchTeam.state='ready'; drenchTeam.task=null; drenchTeam.location=drenchTeam.home; }
    }
    if(!d._fireDrench?.[section]) _returnCrew(section,d,'fire');
    // Release any DC team that was fighting this fire — they held task='fire'
    // until now so suppression math worked correctly on the same tick.
    for(const team of Object.values(d.teams)){
      if(team.task==='fire'&&roomSection(team.location)===section){
        team._locked=false;
        team.task=null;
        if(d.floodRate[section]>0||d.flooding[section]>0.05){
          team.task='flood';
          COMMS.dc.floodingActive(team.label);
        } else {
          const sys=_nextRepairTarget(section,d);
          if(sys){ team.task='repair'; team.repairTarget=sys; COMMS.dc.startRepair(team.label,SYS_LABEL[sys]); }
          else { team.state='ready'; COMMS.dc.allSecure(team.label,SECTION_LABEL[section]||section); }
        }
      }
    }
    if(section==='reactor_comp'&&d._reactorFireScram){
      d._reactorFireScram=false;
      // Only say "commencing fast recovery" if the reactor system itself wasn't damaged.
      // If damaged, the scram tick in sim.js will fire scramHoldRepair() instead.
      if(d.systems?.reactor==='nominal') COMMS.reactor.fireScramLifted();
    }
    COMMS.fire.extinguished(SECTION_LABEL[section], by);
    _alert(`FIRE OUT — ${SECTION_LABEL[section]}`);
    _checkClearEmergency(d);
  }

  // ── Nitrogen drench (automated last resort) ───────────────────────────────
  function _nitrogenDrench(comp, d, dcTeam){
    if(!d._fireDrench) d._fireDrench={};
    // Capture fire levels at drench moment — used for smooth linear suppression
    const startFire={};
    for(const rid of SECTION_ROOMS[comp]||[]) startFire[rid]=d.fire[rid]||0;
    d._fireDrench[comp]={level:0, startFire, venting:false};

    // Watchkeepers inside take casualties
    const watch=d._fireWatch?.[comp];
    const watchCount=watch?.count||0;
    let cas=0;
    if(watchCount>0){
      const compCrew=(d.crew[comp]||[]).filter(cr=>cr.status==='fit'&&!cr.displaced);
      for(let i=0;i<Math.min(watchCount,compCrew.length);i++){
        compCrew[i].status=Math.random()<0.65?'killed':'wounded';
        cas++;
      }
    }
    // DC team inside — casualties and forced recall
    if(dcTeam&&dcTeam.state==='on_scene'&&roomSection(dcTeam.location)===comp){
      _woundDcTeamMember(dcTeam, d); _woundDcTeamMember(dcTeam, d);
      dcTeam.state='ready'; dcTeam.task=null; dcTeam._locked=false;
      COMMS.dc.teamEvacuated(dcTeam.label, SECTION_LABEL[comp]||comp);
    }

    if(d._fireWatch) d._fireWatch[comp]=null;

    COMMS.fire.nitrogenDrench(SECTION_LABEL[comp]||comp, cas);
    _alert(`N2 DRENCH — ${SECTION_LABEL[comp]||comp}`);

    // Auto-dispatch a free team to vent the N2 — compartment must be cleared before
    // it's habitable again and before emergency stations can stand down.
    const ventTeam=Object.values(d.teams).find(t=>t.state==='ready'&&!t._locked&&_canReachComp(t,comp,d));
    if(ventTeam){
      ventTeam._ventIntent=comp;
      ventTeam.state='mustering';
      ventTeam.destination=comp;
      ventTeam.musterT=15;
      ventTeam.task=null;
      ventTeam.repairTarget=null;
      ventTeam.repairProgress=0;
      COMMS.dc.mustering(ventTeam.label, SECTION_LABEL[comp]);
    } else {
      // No team available right now — player must manually send one via VENT button
      COMMS.fire.ventN2Required(SECTION_LABEL[comp]);
    }

    if(comp==='reactor_comp'){
      if(d._reactorFireScram) d._reactorFireScram=false;
      if(!player.scram&&typeof window.G.triggerScram==='function'){
        window.G.triggerScram('damage');
        COMMS.reactor.scram('damage');
      }
    }
  }

  // ── N2 drench fill tick ───────────────────────────────────────────────────
  // Ramps drench level 0→1 over DRENCH_FILL_TIME, suppressing fire progressively.
  // Vent phase (level 1→0) is driven by the vent_n2 task in _tickTeams.
  function _tickDrench(dt, d){
    if(!d._fireDrench) return;
    for(const [comp, drench] of Object.entries(d._fireDrench)){
      if(!drench||typeof drench!=='object') continue;
      if(drench.venting){
        // Vent phase: N2 being cleared — fire is already out, keep it at 0.
        for(const rid of SECTION_ROOMS[comp]||[]) d.fire[rid]=0;
        continue;
      }
      if(drench.level >= 1) continue; // fill complete — waiting for vent team
      drench.level = Math.min(1, drench.level + dt / DRENCH_FILL_TIME);
      // Linearly suppress fire from startFire → 0 as level 0 → 1.
      for(const rid of SECTION_ROOMS[comp]||[]){
        d.fire[rid] = Math.max(0, (drench.startFire[rid]||0) * (1 - drench.level));
      }
    }
  }

  // ── Shared casualty-state clear check ────────────────────────────────────
  // Called after any event that could end the emergency (fire out, vent complete, etc.)
  function _checkClearEmergency(d){
    if(window.G?.game?.casualtyState!=='emergency') return;
    const anyFire=ROOM_IDS.some(rid=>(d.fire[rid]||0)>0.01);
    const anyFlood=COMPS.some(s=>(d.flooding[s]||0)>0.001);
    const anyTeamActive=Object.values(d.teams).some(t=>t.state!=='ready'&&t.state!=='lost');
    // Drenched compartments require venting before the emergency is truly controlled
    const anyDrenched=COMPS.some(s=>(d._fireDrench?.[s]?.level??0)>0);
    if(!anyFire&&!anyFlood&&!anyTeamActive&&!anyDrenched){
      window.G.setCasualtyState('normal');
      d._emergMusterFired=false;
      for(const t of Object.values(d.teams)){ t._autoMode=false; t._readyT=0; }
      const hadFlood=COMPS.some(s=>(d.flooded[s]||d.strikes[s]>0));
      COMMS.crewState.casualtyControlled(hadFlood?'flood':'fire');
      _emergencyOpenWTDs(d);
    }
  }

  // ── Fire helpers ──────────────────────────────────────────────────────────
  function _sectionFire(section, d){
    return (SECTION_ROOMS[section]||[]).reduce((mx,rid)=>Math.max(mx,d.fire[rid]||0),0);
  }
  function _sectionHasFire(section, d){
    return (SECTION_ROOMS[section]||[]).some(rid=>(d.fire[rid]||0)>0.05);
  }

  // ── Fire tick ─────────────────────────────────────────────────────────────
  const FIRE_BASE_GROW   = 0.008;   // growth/s at fireLevel=0
  const FIRE_SCALE_GROW  = 0.022;   // additional growth/s at fireLevel=1 (max grow ≈ 0.030/s)
  const WATCH_SUPPRESS   = 0.010;   // suppression/s per watchkeeper
  const DC_FIRE_SUPPRESS = 0.045;   // suppression/s for DC team (BA, hoses, portable extinguishers)
  const FIRE_EVAC_TIME   = 15;      // seconds for non-watchkeeper crew to physically transit out of burning section
  const FIRE_DETECT_THRESHOLD  = 0.40;  // unmanned room: sensor alarm fires at this level
  const FIRE_INVESTIGATE_DELAY = 12;   // seconds from alarm to confirmed detection (investigation time)
  const DRENCH_THRESH    = 0.95;    // fire level that triggers drench consideration
  const DRENCH_LOSE_TIME = 15;      // seconds DC team must be losing before drench triggered
  const DRENCH_FILL_TIME = 12;      // seconds for N2 to flood compartment and suppress fire
  const VENT_N2_TIME     = 30;      // seconds to vent N2 and render compartment habitable again

  // ── Medical system ────────────────────────────────────────────────────────
  function _findCrewById(id, d){
    for(const comp of COMPS){
      const m=(d.crew[comp]||[]).find(c=>c.id===id);
      if(m) return m;
    }
    return null;
  }

  // Highest priority untreated casualty in a compartment (excludeIds = being treated)
  function _nextCasualty(comp, d, excludeIds){
    const cas=(d.crew[comp]||[]).filter(m=>m.status==='wounded'&&!excludeIds.has(m.id));
    return cas.find(m=>m.severity==='critical')||cas.find(m=>m.severity==='serious')||cas.find(m=>m.severity==='minor')||null;
  }

  // Compartment with the highest priority untreated casualty across the boat
  function _nextCasualtyComp(d, excludeIds){
    const PRI={critical:3,serious:2,minor:1};
    let bestComp=null, bestPri=-1;
    for(const comp of COMPS){
      for(const m of (d.crew[comp]||[])){
        if(m.status==='wounded'&&!excludeIds.has(m.id)){
          const p=PRI[m.severity]||1;
          if(p>bestPri){ bestPri=p; bestComp=comp; }
        }
      }
    }
    return bestComp;
  }

  function _dispatchMedStaff(staff, dest, d){
    const eta=TRAVEL[staff.location]?.[dest]??30;
    staff.state='transit';
    staff.destination=dest;
    staff.transitEta=eta;
    if(dest!=='control_room') COMMS.medical.enRoute(staff.label, SECTION_LABEL[dest]);
  }

  function _tickMedical(dt, d){
    const TREAT_TIME={critical:120, serious:600, minor:300};

    // 1. Tick bleed-out timers for untreated critical casualties
    for(const comp of COMPS){
      for(const m of (d.crew[comp]||[])){
        if(m.status==='wounded'&&m.severity==='critical'&&m.bleedT!=null){
          m.bleedT=Math.max(0, m.bleedT-dt);
          if(m.bleedT<=0){
            m.status='killed'; m.bleedT=null;
            COMMS.medical.bleedOut(m.name, SECTION_LABEL[comp]);
          }
        }
      }
    }

    // 2. Check if all medical staff are lost
    const activeStaff=Object.values(d.medTeam).filter(s=>s.state!=='lost'&&s.state!=='down');
    if(activeStaff.length===0){
      const hasCas=COMPS.some(c=>(d.crew[c]||[]).some(m=>m.status==='wounded'));
      if(hasCas&&!d._medNoStaffFired){ d._medNoStaffFired=true; COMMS.medical.noMedStaff(); }
      return;
    }
    d._medNoStaffFired=false;

    // 3. Tick each staff member
    for(const staff of Object.values(d.medTeam)){
      if(staff.state==='lost'||staff.state==='down') continue;

      // Check if staff member is themselves a casualty
      const staffCrew=_findCrewById(staff.id, d);
      if(!staffCrew||staffCrew.status==='killed'){
        if(staff.state!=='lost'){ staff.state='lost'; COMMS.medical.staffDown(staff.label); }
        continue;
      }
      if(staffCrew.status==='wounded'&&staffCrew.severity==='critical'){
        staff.state='down'; continue;
      }

      // Rebuild treating set each iteration to stay consistent
      const nowTreating=new Set(Object.values(d.medTeam).map(s=>s.treating).filter(Boolean));

      // Transit
      if(staff.state==='transit'){
        staff.transitEta=Math.max(0, staff.transitEta-dt);
        if(staff.transitEta<=0){
          staff.location=staff.destination; staff.destination=null; staff.state='on_scene';
          COMMS.medical.onScene(staff.label, SECTION_LABEL[staff.location]||staff.location);
        }
        continue;
      }

      // On scene
      if(staff.state==='on_scene'){
        if(staff.treating){
          staff.treatT=Math.max(0, staff.treatT-dt);
          if(staff.treatT<=0){
            const victim=_findCrewById(staff.treating, d);
            staff.treating=null;
            if(victim&&victim.status==='wounded'){
              victim.status='fit'; victim.severity=null; victim.bleedT=null;
              COMMS.medical.recovered(staff.label, victim.name);
            }
          }
        }
        if(!staff.treating){
          const here=_nextCasualty(staff.location, d, nowTreating);
          if(here){
            staff.treating=here.id;
            staff.treatT=TREAT_TIME[here.severity]||300;
            COMMS.medical.treating(staff.label, here.name, here.severity);
          } else {
            const dest=_nextCasualtyComp(d, nowTreating);
            if(dest&&dest!==staff.location){
              _dispatchMedStaff(staff, dest, d);
            } else if(!dest){
              if(staff.location!=='control_room') _dispatchMedStaff(staff, 'control_room', d);
              else{ staff.state='standby'; COMMS.medical.allClear(staff.label); }
            }
          }
        }
        continue;
      }

      // Standby — watch for new casualties
      if(staff.state==='standby'){
        const dest=_nextCasualtyComp(d, nowTreating);
        if(dest){ staff._deployed=true; _dispatchMedStaff(staff, dest, d); }
      }
    }
  }

  function _tickFire(dt, d){
    if(d._tickingFire) return;
    d._tickingFire=true;
    try { _tickFireInner(dt, d); } finally { d._tickingFire=false; }
  }

  function _tickFireInner(dt, d){
    for(const section of COMPS){
      const roomIds=SECTION_ROOMS[section]||[];
      // ── Evacuation transit timer ───────────────────────────────────────────
      if(d._fireEvac?.[section]){
        d._fireEvac[section].t-=dt;
        if(d._fireEvac[section].t<=0){
          const {ids}=d._fireEvac[section];
          delete d._fireEvac[section];
          // Recheck safe destination at time of actual movement
          const dest=(EVAC_TO[section]||[]).find(s=>!d.flooded[s]&&!d._fireDrench?.[s]&&!_sectionNoEvac(s)&&(d.crew[s]||[]).length<SECTION_CAP);
          for(const id of ids){
            const cr=(d.crew[section]||[]).find(c=>c.id===id);
            if(!cr||cr.status==='killed') continue;
            cr.displaced=true;
            if(dest){
              d.crew[section]=d.crew[section].filter(c=>c!==cr);
              if(!d.crew[dest]) d.crew[dest]=[];
              cr.comp=dest;
              d.crew[dest].push(cr);
            }
          }
        }
      }

      const watch=d._fireWatch?.[section];
      const dcTeam=Object.values(d.teams).find(t=>
        t.state==='on_scene'&&roomSection(t.location)===section&&t.task==='fire');

      let F=0; // section max detected fire level (for section-level logic)
      let anyRoomFire=false;

      // ── Per-room fire growth ───────────────────────────────────────────
      // Suppression is per-room: each room's watchkeepers fight their own fire,
      // and the DC team only suppresses the room they are physically in.
      for(const roomId of roomIds){
        const fire=d.fire[roomId]||0;
        if(fire<=0) continue;
        anyRoomFire=true;
        const growRate=FIRE_BASE_GROW+fire*FIRE_SCALE_GROW;
        // Undetected fire — burns without suppression
        if(!d._fireDetected[roomId]){
          const newFire=clamp(fire+growRate*dt,0,1.0);
          d.fire[roomId]=newFire;
          if((ROOMS[roomId].crew||0)===0){
            // Empty room: sensor alarm at 40%, then investigation delay before full detection
            if(newFire>=FIRE_DETECT_THRESHOLD){
              if(!d._fireAlarmFired?.[roomId]){
                if(!d._fireAlarmFired) d._fireAlarmFired={};
                d._fireAlarmFired[roomId]=true;
                d._fireDetectT[roomId]=FIRE_INVESTIGATE_DELAY;
                COMMS.fire.fireAlarm(ROOMS[roomId].label, COMP_STATION[section]||'ENG');
              }
              if(d._fireDetectT[roomId]!=null){
                d._fireDetectT[roomId]-=dt;
                if(d._fireDetectT[roomId]<=0) _triggerFireDetection(roomId,section,d);
              }
            }
          } else {
            // Manned room with detection delay — someone eventually notices
            d._fireDetectT[roomId]=(d._fireDetectT[roomId]??ROOMS[roomId].detectionDelay)-dt;
            if(d._fireDetectT[roomId]<=0) _triggerFireDetection(roomId,section,d);
          }
          continue; // doesn't contribute to F until detected
        }
        // Detected — per-room suppression
        const roomCrew=ROOMS[roomId].crew||0;
        const watchSuppress=watch ? Math.min(roomCrew, watch.count) * WATCH_SUPPRESS : 0;
        const dcHere=(dcTeam&&dcTeam.location===roomId);
        const dcSuppress=dcHere ? DC_FIRE_SUPPRESS*_teamEffectiveness(dcTeam) : 0;
        const totalSuppress=watchSuppress+dcSuppress;
        const jitter=(Math.random()-0.5)*0.004;
        const newFire=clamp(fire+(growRate-totalSuppress+jitter)*dt,0,1.0);
        d.fire[roomId]=newFire;
        F=Math.max(F,newFire);
        if(newFire<=0) _extinguishFire(roomId,d,dcTeam?'dc':'watch');
      }

      // ── Intra-section fire spread — compartment to adjacent compartment ──
      // Fire above 30% can jump to an adjacent compartment within the same section.
      // Spread chance increases with fire intensity. Only spreads within ROOM_ADJ.
      for(const roomId of roomIds){
        const fire=d.fire[roomId]||0;
        if(fire<0.30) continue;
        for(const adjId of (ROOM_ADJ[roomId]||[])){
          if((d.fire[adjId]||0)>0.01) continue; // already burning
          const spreadChance=(fire-0.30)*0.004*dt;
          if(Math.random()<spreadChance) igniteFire(adjId, 0.03);
        }
      }

      if(!anyRoomFire&&!watch) continue;

      // ── Section-level logic (uses F = max detected fire) ──────────────

      // Watchkeeper casualties
      const watchCount=watch?.count||0;
      if(watch&&watchCount>0){
        watch.t+=dt;
        watch.lastCasCheck=(watch.lastCasCheck||0)+dt;
        if(watch.lastCasCheck>=5.0){
          watch.lastCasCheck=0;
          const deathChance=F*F*0.08;
          if(Math.random()<deathChance){
            const fighters=(d.crew[section]||[]).filter(cr=>cr.status==='fit'&&!cr.displaced);
            if(fighters.length>0){
              const victim=fighters[Math.floor(Math.random()*fighters.length)];
              victim.status=Math.random()<0.40?'killed':'wounded';
              watch.count=Math.max(0,watch.count-1);
              COMMS.fire.watchkeeperCasualty(victim.name,SECTION_LABEL[section],victim.status);
              _alert(`FIRE CASUALTY — ${SECTION_LABEL[section]}`);
            }
            if(watch.count===0) COMMS.fire.watchkeeperOvercome(SECTION_LABEL[section]);
          }
        }
      }

      // DC team relieves watchkeepers on arrival — move them out physically
      if(dcTeam&&watchCount>0){
        const fighters=(d.crew[section]||[]).filter(cr=>cr.status==='fit'&&!cr.displaced);
        const safeEvacDest=(EVAC_TO[section]||[]).find(s=>!d.flooded[s]&&!d._fireDrench?.[s]&&!_sectionNoEvac(s)&&(d.crew[s]||[]).length<SECTION_CAP);
        for(const cr of fighters){
          cr.displaced=true;
          if(safeEvacDest){
            d.crew[section]=d.crew[section].filter(c=>c!==cr);
            if(!d.crew[safeEvacDest]) d.crew[safeEvacDest]=[];
            cr.comp=safeEvacDest;
            d.crew[safeEvacDest].push(cr);
          }
        }
        d._fireWatch[section]={ count:0,t:0,lastCasCheck:0,_outOfControlFired:watch?._outOfControlFired||false };
        COMMS.fire.dcRelief(SECTION_LABEL[section]);
      }

      // System heat damage — per-room: only systems in burning rooms take heat
      for(const roomId of roomIds){
        const roomFire=d.fire[roomId]||0;
        if(roomFire<=0.30) continue;
        const heatChance=(roomFire-0.30)*0.002*dt;
        if(Math.random()<heatChance){
          const roomSys=(ROOM_SYSTEMS[roomId]||[]).filter(s=>d.systems[s]!=='destroyed');
          if(roomSys.length>0){
            const sys=roomSys[Math.floor(Math.random()*roomSys.length)];
            const newState=damageSystem(sys,1);
            COMMS.fire.heatDamage(SYS_LABEL[sys],newState,SECTION_LABEL[section]);
            _alert(`HEAT DAMAGE — ${SYS_LABEL[sys]}`);
          }
        }
      }

      // Out of control
      if(watch&&!watch._outOfControlFired&&F>0.70){
        watch._outOfControlFired=true;
        COMMS.fire.outOfControl(SECTION_LABEL[section]);
      }

      // Emergency stations on first serious fire
      if(!d._fireCritical) d._fireCritical={};
      if(!d._fireCritical[section]&&F>0.40){
        d._fireCritical[section]=true;
        if(!d._criticalFired){ d._criticalFired=true; window.PANEL?.snapToAllStop(); }
        COMMS.crewState.emergencyStations('fire');
      }

      // N2 drench automation
      if(!d._fireDrench?.[section]){
        if(d._fireDrenchPending?.[section]){
          d._fireDrenchPending[section].t-=dt;
          if(d._fireDrenchPending[section].t<=0){
            const drenchTeam=Object.values(d.teams).find(t=>
              t.task==='drench_pending'&&roomSection(t.location)===section);
            if(drenchTeam){ drenchTeam.state='ready'; drenchTeam.task=null; drenchTeam._locked=false; drenchTeam.location=drenchTeam.home; }
            delete d._fireDrenchPending[section];
            _nitrogenDrench(section,d,null);
          }
        } else if(dcTeam){
          if(!dcTeam._fireLosing) dcTeam._fireLosing=0;
          // Check if DC team is losing in their current room
          const dcRoomFire=d.fire[dcTeam.location]||0;
          const dcGrow=FIRE_BASE_GROW+dcRoomFire*FIRE_SCALE_GROW;
          const dcSup=DC_FIRE_SUPPRESS*_teamEffectiveness(dcTeam);
          if(F>DRENCH_THRESH&&dcGrow>dcSup) dcTeam._fireLosing+=dt;
          else dcTeam._fireLosing=0;
          if(dcTeam._fireLosing>=DRENCH_LOSE_TIME){
            if(!d._fireDrenchPending) d._fireDrenchPending={};
            d._fireDrenchPending[section]={t:20};
            dcTeam.task='drench_pending';
            dcTeam._fireLosing=0;
            COMMS.fire.drenchInitiated(SECTION_LABEL[section]);
          }
        }
      }

      // Cascade to adjacent section — only through open watertight doors
      if(F>0.85){
        const cascadeChance=(F-0.85)/0.15*0.012*dt;
        if(Math.random()<cascadeChance){
          const adj=EVAC_TO[section]||[];
          const targetSection=adj.find(s=>{
            if(_sectionFire(s,d)>=0.05||d.flooded[s]||d._fireDrench?.[s]) return false;
            // Only cascade through an open WTD
            const si=COMPS.indexOf(section), ti=COMPS.indexOf(s);
            const lo=Math.min(si,ti), hi=Math.max(si,ti);
            const wtdKey=COMPS[lo]+'|'+COMPS[hi];
            return (d.wtd?.[wtdKey]||'open')==='open';
          });
          if(targetSection){
            const targetRooms=SECTION_ROOMS[targetSection]||[];
            const targetRoom=targetRooms[Math.floor(Math.random()*targetRooms.length)];
            COMMS.fire.cascade(SECTION_LABEL[section],SECTION_LABEL[targetSection]);
            if(targetRoom) igniteFire(targetRoom,0.05);
          }
        }
      }
    }
  }

  function tick(dt){
    const d=player.damage; if(!d) return;

    // Depth-pressure multiplier: flood rate scales with ambient pressure.
    // 1× at surface, +1× per 120m — caps at 5× (~480m). DC teams fight
    // the base rate, but water ingress is driven by the effective rate.
    // This means at depth, DC can slow but not stop a serious breach —
    // forcing the emergency blow decision.
    const _depthM=Math.max(0,(player.depth||0)-(window.G.world?.seaLevel||0));
    const _pressureMult=1+Math.min(_depthM/120, 4);

    // Flood spread through open watertight doors
    _wtdFloodSpread(dt, d, _pressureMult);

    // Progressive flooding
    for(const comp of COMPS){
      if(d.flooded[comp]) continue;
      const rate=d.floodRate[comp]||0;

      // Advance flooding from active breach
      if(rate>0){
        d.flooding[comp]=Math.min(1,(d.flooding[comp]||0)+rate*_pressureMult*dt);
      } else if((d.flooding[comp]||0)>0){
        // Bilge pumps drain residual water — suppress if an open WTD is actively feeding in
        const hasActiveSpread=WTD_PAIRS.some(([a,b])=>{
          const other=(a===comp)?b:(b===comp)?a:null;
          if(!other) return false;
          const key=a+'|'+b;
          return (d.wtd[key]||'open')==='open' &&
                 (d.flooded[other]?1:(d.flooding[other]||0)) > (d.flooding[comp]||0)+0.05;
        });
        if(!hasActiveSpread){
          d.flooding[comp]=Math.max(0,(d.flooding[comp]||0)-0.012*dt);
          if(d.flooding[comp]<=0){
            _returnCrew(comp,d);
            // Reset deck damage tracking so a future flood applies fresh system damage
            if(d._floodDeckDmg?.[comp]) d._floodDeckDmg[comp]={};
          }
        }
      }

      // Threshold checks — apply regardless of flood source (breach or WTD spread)
      const fl=d.flooding[comp]||0;
      const isSeep=(d._seepComp||{})[comp];

      // Deck-level system damage — water rises D3→D2→D1 (bottom to top).
      // Each crossing damages systems on that deck one step.
      // 'destroyed' can only be reached if the system was already degraded/offline,
      // since damageSystem always moves exactly one step at a time.
      if(!d._floodDeckDmg) d._floodDeckDmg={};
      if(!d._floodDeckDmg[comp]) d._floodDeckDmg[comp]={};
      const _ddmg=d._floodDeckDmg[comp];
      if(fl>=0.33&&!_ddmg[2]){                      // D3 (bottom) submerged
        _ddmg[2]=true;
        for(const sys of activeSystems(comp)){
          if((ROOMS[SYS_DEF[sys].room]?.deck??1)===2){ const st=damageSystem(sys); COMMS.sys.damaged(SYS_LABEL[sys],st,0.5); }
        }
      }
      if(fl>=0.67&&!_ddmg[1]){                      // D2 (middle) submerged
        _ddmg[1]=true;
        for(const sys of activeSystems(comp)){
          if((ROOMS[SYS_DEF[sys].room]?.deck??1)===1){ const st=damageSystem(sys); COMMS.sys.damaged(SYS_LABEL[sys],st,0.5); }
        }
      }

      // 65% — crew evacuation
      if(!isSeep && fl>=0.65 && !(d._evacuated||{})[comp]){
        if(!d._evacuated) d._evacuated={};
        d._evacuated[comp]=true;
        const neighbors=EVAC_TO[comp]||[];
        const compCrew=(d.crew[comp]||[]).filter(cr=>cr.status==='fit'||cr.status==='wounded');
        let evacuated=0,trapped=0;
        for(const cr of compCrew){
          // 80% chance per crew to make it out if a neighbour isn't also flooded
          const openNeighbour=neighbors.find(n=>!d.flooded[n]&&!_sectionNoEvac(n)&&(d.crew[n]||[]).length<SECTION_CAP);
          if(openNeighbour&&Math.random()<0.80){
            cr.displaced=true;
            cr.stationComp=cr.stationComp||comp; // remember home for return
            d.crew[comp]=d.crew[comp].filter(c=>c!==cr);
            if(!d.crew[openNeighbour]) d.crew[openNeighbour]=[];
            cr.comp=openNeighbour;
            d.crew[openNeighbour].push(cr);
            evacuated++;
          } else {
            cr.status='killed';
            trapped++;
          }
        }
        if(evacuated>0||trapped>0){
          _alert('CREW EVACUATING '+SECTION_LABEL[comp].toUpperCase());
          COMMS.flood.evacuating(SECTION_LABEL[comp], COMP_STATION[comp]||'ENG', evacuated, trapped);
        }
      }

      // 100% — compartment fully flooded
      if(fl>=1.0&&!d.flooded[comp]){
        d.flooded[comp]=true;
        d.floodRate[comp]=0;
        // D1 (top deck) and one final submerge step for all systems.
        // damageSystem always moves exactly one step, so 'destroyed' only happens
        // if the system was already at 'offline' (i.e. previously degraded by combat or earlier flooding).
        if(!d._floodDeckDmg) d._floodDeckDmg={};
        if(!d._floodDeckDmg[comp]) d._floodDeckDmg[comp]={};
        const _ddFull=d._floodDeckDmg[comp];
        for(const sys of activeSystems(comp)){
          // D1 systems: first damage event (deck just reached)
          if((ROOMS[SYS_DEF[sys].room]?.deck??1)===0 && !_ddFull[0]){ damageSystem(sys); }
          // All systems: one final step for full submersion
          damageSystem(sys);
        }
        _ddFull[0]=true;
        const lost=_floodComp(comp);
        if(!d._evacuated) d._evacuated={};
        d._evacuated[comp]=true;
        for(const cr of (d.crew[comp]||[])){
          if(cr.status!=='killed') cr.displaced=true;
        }
        for(const team of Object.values(d.teams)){
          if(team.state==='on_scene'&&roomSection(team.location)===comp){
            if(Math.random()<0.75){
              team.state='ready'; team.task=null;
              _woundDcTeamMember(team, d);
              dcLog(`${team.label} — EVACUATED ${SECTION_LABEL[comp]||comp}. Casualties taken`);
            } else {
              team.state='lost';
              COMMS.dc.teamLost(team.label, SECTION_LABEL[comp]||comp);
            }
          }
        }
        _alert(`${SECTION_LABEL[comp]} FLOODED`);
        COMMS.flood.uncontrolled(SECTION_LABEL[comp], COMP_STATION[comp]||'ENG', lost);
        if(comp==='reactor_comp'&&!player.scram&&typeof window.G.triggerScram==='function'){
          window.G.triggerScram('damage');
          COMMS.flood.reactorFlooded();
        }
        d.strikes[comp]=2;
        _checkSinking();
      }
    }

    // DC teams then fire (teams set task='fire' on arrival, fire tick reads it)
    _tickWTDAutoClose(dt,d);
    _tickWTDAutoOpen(dt,d);
    _tickTeams(dt,d);
    _tickFire(dt,d);
    _tickDrench(dt,d);
    _tickMedical(dt,d);

    // Alert tick
    for(let i=d.alerts.length-1;i>=0;i--){
      d.alerts[i].t-=dt;
      if(d.alerts[i].t<=0) d.alerts.splice(i,1);
    }

    // Sinking countdown — reserved for future buoyancy system

    // TCE cycling
    if(d.escapeState==='tce_running'){
      d.escapeT+=dt;
      const CYCLE=5.0;
      const towers=[d.towers.fwd!=='destroyed'?'fwd':null,d.towers.aft!=='destroyed'?'aft':null].filter(Boolean);
      const cyclesDone=Math.floor(d.escapeT/CYCLE);
      if(cyclesDone>d._tceProcessed){
        const newCycles=cyclesDone-d._tceProcessed;
        d._tceProcessed=cyclesDone;
        const sc=_survChance('tce');
        for(let p=0;p<newCycles*towers.length*2;p++){
          const entry=d.escapeQueue.shift();
          if(!entry) break;
          if(Math.random()<sc) d.escapeSurvivors++;
          else entry.crewman.status='killed';
        }
        // Progress entry after each cycle
        const remaining=d.escapeQueue.length;
        if(remaining>0){
          window.G.addLog('CONN',
            `Escape — ${d.escapeSurvivors} away. ${remaining} remaining at towers.`,
            window.COMMS.P.MED
          );
        }
        if(remaining===0) _resolveEscape();
      }
    }
    if(d.escapeState==='rush_running'){
      d.escapeT-=dt;
      // Single midpoint progress call
      if(!d._rushMidLogged && d.escapeT<=6){
        d._rushMidLogged=true;
        const total=COMPS.reduce((a,cp)=>{
          return a+(d.crew[cp]||[]).filter(x=>x.status!=='killed').length;
        },0);
        window.G.addLog('CONN',
          `Escape — hands in the water. ${total} attempting escape.`,
          window.COMMS.P.MED
        );
      }
      if(d.escapeT<=0) _resolveEscape();
    }
  }

  // ── Effects ───────────────────────────────────────────────────────────────
  function getEffects(){
    const d=player.damage;
    if(!d) return _defaults();
    const sys=d.systems;
    const totalFlood=Object.values(d.flooding).reduce((a,b)=>a+b,0);
    let speedCap=Infinity;
    if(sys.propulsion==='destroyed') speedCap=2;
    else if(sys.propulsion==='offline') speedCap=5;
    else if(sys.propulsion==='degraded') speedCap=15;
    if(!C.player.isDiesel){
      if(sys.reactor==='offline'||sys.reactor==='destroyed'){
        // Nuclear boat — EPM only when reactor down. Emergency diesel is hotel power, not propulsion.
        // EPM destroyed or emerg_diesel dead = no propulsion at all
        if(sys.emerg_diesel==='offline'||sys.emerg_diesel==='destroyed') speedCap=Math.min(speedCap,0);
        else speedCap=Math.min(speedCap,3); // EPM: ~3kt
      }
      // Pressuriser limits reactor power output
      if(sys.pressuriser==='destroyed') speedCap=Math.min(speedCap,8);
      else if(sys.pressuriser==='offline') speedCap=Math.min(speedCap,12);
      // Main turbines degrade speed ceiling
      if(sys.main_turbines==='destroyed') speedCap=Math.min(speedCap,5);
      else if(sys.main_turbines==='offline') speedCap=Math.min(speedCap,10);
    } else {
      // Diesel-electric: motor and battery determine propulsion — diesel never drives shaft directly
      if(sys.main_motor==='destroyed') speedCap=Math.min(speedCap,0);
      else if(sys.main_motor==='offline') speedCap=Math.min(speedCap,4);
      if(sys.battery_bank==='destroyed') speedCap=Math.min(speedCap,0);
      else if(sys.battery_bank==='offline') speedCap=Math.min(speedCap,5);
      // diesel_engine state does NOT affect speed — only affects charge rate (see chargeRateMult)
    }
    let sonarRangeMult=1.0;
    if(sys.sonar_hull==='offline'||sys.sonar_hull==='destroyed') sonarRangeMult=0.0;
    else if(sys.sonar_hull==='degraded') sonarRangeMult=0.55;
    let bearingNoiseMult=1.0;
    if(sys.sonar_hull==='degraded') bearingNoiseMult=2.5;
    else if(sys.sonar_hull==='offline'||sys.sonar_hull==='destroyed') bearingNoiseMult=5.0;
    // Tubes/TDC use effectiveState (fire_ctrl dependency)
    const eTubes=effectiveState('tubes',d);
    let reloadMult=1.0;
    if(eTubes==='degraded') reloadMult=1.5;
    else if(eTubes==='offline') reloadMult=3.0;
    else if(eTubes==='destroyed') reloadMult=999;
    reloadMult*=(1+(1-crewEfficiency('weapons'))*0.6);
    let depthRateMult=1.0;
    if(sys.ballast==='degraded') depthRateMult=0.55;
    else if(sys.ballast==='offline'||sys.ballast==='destroyed') depthRateMult=0.18;
    // Trim tanks — loss degrades fine depth control
    const trimDmg=Math.max(STATES.indexOf(sys.fwd_trim||'nominal'),STATES.indexOf(sys.aft_trim||'nominal'));
    if(trimDmg>=3) depthRateMult*=0.65;       // destroyed — sluggish trim
    else if(trimDmg>=2) depthRateMult*=0.80;   // offline — reduced trim authority
    // Electrical distribution — offline degrades sonar, slows reloads
    if(sys.elec_dist==='offline'||sys.elec_dist==='destroyed'){
      sonarRangeMult*=0.40;
      bearingNoiseMult*=2.0;
      reloadMult*=2.0;
      depthRateMult*=0.60;
    } else if(sys.elec_dist==='degraded'){
      sonarRangeMult*=0.75;
      reloadMult*=1.3;
    }
    // HP air blow: loud compressors — significant continuous noise penalty
    const blowingTeams=Object.values(d.teams||{}).filter(t=>t.state==='blowing').length;
    const blowNoise=blowingTeams*0.40;
    const noisePenalty=Math.min(0.65, totalFlood*0.10 + blowNoise);
    const eTdc=effectiveState('tdc_comp',d);
    const eTma=effectiveState('tma',d);
    let tdcErrDeg=0;
    if(eTdc==='degraded') tdcErrDeg+=4;
    else if(eTdc==='offline'||eTdc==='destroyed') tdcErrDeg+=10;
    // TMA feeds the TDC — damaged TMA adds bearing uncertainty
    if(eTma==='degraded') tdcErrDeg+=3;
    else if(eTma==='offline'||eTma==='destroyed') tdcErrDeg+=8;
    let tubesAvail=C.player.torpTubes||4;
    if(eTubes==='destroyed') tubesAvail=0;
    else if(eTubes==='offline') tubesAvail=0;
    // Weapon stowage — no reloads when damaged
    if(sys.weapon_stow==='offline'||sys.weapon_stow==='destroyed') reloadMult=999;
    const towedOk=sys.towed_array==='nominal'||sys.towed_array==='degraded';
    const periscopeOk=sys.periscope==='nominal'||sys.periscope==='degraded';
    // Steering — rudder authority
    let steeringMult=1.0;
    if(sys.steering==='degraded')       steeringMult=0.5;   // sluggish, partial rudder
    else if(sys.steering==='offline')   steeringMult=0.15;  // emergency tiller, very slow
    else if(sys.steering==='destroyed') steeringMult=0.0;   // jammed rudder, no authority
    const steeringOk=sys.steering==='nominal'||sys.steering==='degraded';
    const fit=totalFit(),total=totalCrew();
    const integ=total>0?fit/total:1;
    // Collapse depth scales with vessel class — Type 209 collapses far shallower than Seawolf
    const vesselMaxD = C.player?.maxDepth ?? C.world?.maxDepth ?? 500;
    const maxDepth = integ<0.35 ? Math.round(vesselMaxD*0.24) : integ<0.55 ? Math.round(vesselMaxD*0.50) : vesselMaxD;
    // ── Control room status ────────────────────────────────────────────────
    // Evacuated (≥65% flood) OR fully flooded OR fire present = conn room lost
    const connRoomLost = !!(d._evacuated?.control_room || d.flooded?.control_room || _sectionHasFire('control_room',d));
    // When conn is lost, depth changes require manual valve ops — much slower
    if(connRoomLost) depthRateMult = Math.min(depthRateMult, 0.20);
    // Plane hydraulics — determines operating mode for each set of planes
    // fwd: hydraulic plant in fore_ends; helm control from control_room
    // aft: hydraulic plant in aft_ends; fallback control at Manoeuvring
    const fwdHyd  = effectiveState('planes_fwd_hyd',d);
    const aftHyd  = sys.planes_aft_hyd || 'nominal';
    // Fwd planes frozen when conn room lost (helm station unavailable)
    // or when periscope destroyed + 3+ strikes (catastrophic conn damage)
    const fwdCtrl = connRoomLost
      || ((d.systems?.periscope==='destroyed') && (d.strikes?.control_room||0) >= 3);
    // fwd plane mode
    const fwdPlaneMode = fwdCtrl ? 'frozen'
      : (fwdHyd==='offline'||fwdHyd==='destroyed') ? 'air_emergency'
      : fwdHyd==='degraded' ? 'air_emergency' : 'hydraulic';
    // aft plane mode — no control loss (Manoeuvring fallback), only hydraulic mode changes
    const aftPlaneMode = (aftHyd==='offline'||aftHyd==='destroyed') ? 'air_emergency'
      : aftHyd==='degraded' ? 'air_emergency' : 'hydraulic';
    const aftCtrlTransferred = (d.strikes?.control_room||0) > 0;
    const fireLevel=Object.fromEntries(COMPS.map(c=>[c,_sectionFire(c,d)]));
    const anyFire=ROOM_IDS.some(rid=>(d.fire?.[rid]||0)>0.01);
    // ── Propulsion casualties ──────────────────────────────────────────
    const casCfg=C.player.casualties||{};
    if(player._steamLeak) speedCap=Math.min(speedCap, casCfg.steamLeak?.speedCap||7);
    if(player._turbineTrip) speedCap=Math.min(speedCap, casCfg.turbineTrip?.speedCap||12);
    // ── Flooding drag — water mass limits speed and slows acceleration ──
    if(totalFlood>0.05){
      const floodSpeedPenalty=totalFlood*6;   // ~6kt lost per full flooded section
      speedCap=Math.min(speedCap, Math.max(5, (C.player.flankKts||28)-floodSpeedPenalty));
    }
    const floodTauMult=1+totalFlood*0.5;      // 50% slower acceleration per flooded section
    // Diesel charge rate — diesel_engine and alternator damage reduce snorkel charge rate
    let chargeRateMult=1.0;
    if(C.player.isDiesel){
      if(sys.diesel_engine==='destroyed'||sys.alternator==='destroyed') chargeRateMult=0.0;
      else if(sys.diesel_engine==='offline'||sys.alternator==='offline') chargeRateMult=0.25;
      else if(sys.diesel_engine==='degraded'||sys.alternator==='degraded') chargeRateMult=0.55;
    }
    // Wire guidance degradation from fire control damage
    const eFireCtrl=effectiveState('fire_ctrl',d);
    let wireNoiseMult=1.0, wireUpdateRate=1.0, wireCutAll=false;
    if(eFireCtrl==='degraded')       { wireNoiseMult=3.0; wireUpdateRate=0.5; }
    else if(eFireCtrl==='offline')   { wireNoiseMult=8.0; wireUpdateRate=0.2; }
    else if(eFireCtrl==='destroyed') { wireCutAll=true; }
    return {speedCap,sonarRangeMult,bearingNoiseMult,reloadMult,depthRateMult,noisePenalty,tdcErrDeg,tubesAvail,towedOk,periscopeOk,maxDepth,totalFlood,floodTauMult,fwdPlaneMode,aftPlaneMode,aftCtrlTransferred,connRoomLost,crashDiveAvail:!connRoomLost,silentRunAvail:!connRoomLost,steeringMult,steeringOk,fireLevel,anyFire,wireNoiseMult,wireUpdateRate,wireCutAll,chargeRateMult};
  }
  function _defaults(){
    return {speedCap:Infinity,sonarRangeMult:1.0,bearingNoiseMult:1.0,reloadMult:1.0,depthRateMult:1.0,noisePenalty:0,tdcErrDeg:0,tubesAvail:C.player.torpTubes||4,towedOk:true,periscopeOk:true,maxDepth:C.world?.maxDepth||500,totalFlood:0,floodTauMult:1.0,fwdPlaneMode:'hydraulic',aftPlaneMode:'hydraulic',aftCtrlTransferred:false,connRoomLost:false,crashDiveAvail:true,silentRunAvail:true,steeringMult:1.0,steeringOk:true,wireNoiseMult:1.0,wireUpdateRate:1.0,wireCutAll:false,chargeRateMult:1.0};
  }

  function _alert(text){ player.damage.alerts.push({text,t:5.0}); }

  // ── Buoyancy/trim state ───────────────────────────────────────────────────
  // Returns {trim, buoyancy} computed live from current flood levels.
  // trim:    negative = bow-heavy, positive = stern-heavy
  // buoyancy: total flood load (0 = clean, 2.0 = normal ballast limit,
  //           2.5 = emergency blow overwhelmed)
  function getTrimState(){
    const d = player.damage;
    if(!d) return {trim:0, buoyancy:0};
    const levers = C.player.trimLevers || {};
    let trim=0, buoyancy=0;
    for(const comp of COMPS){
      const f = d.flooding[comp]||0;
      trim    += f * (levers[comp]||0);
      buoyancy += f;
    }
    return {trim, buoyancy};
  }

  // Draw HPA pressure — returns strength 0-1.
  // Group pressure drawn first; reserve tops up shortfall for blow operations only.
  function drawHPA(cost, allowReserve=false){
    const d = player.damage;
    if(!d?.hpa) return 1.0;
    const hpa = d.hpa;
    const maxP = window.CONFIG?.player?.hpa?.maxPressure || 207;
    let drawn = 0;
    if(hpa.pressure > 0){
      const take = Math.min(hpa.pressure, cost);
      hpa.pressure -= take;
      drawn += take;
    }
    if(drawn < cost && allowReserve && hpa.reserve > 0){
      const fromRes = Math.min(hpa.reserve, cost - drawn);
      hpa.reserve -= fromRes;
      drawn += fromRes;
      if(hpa.reserve <= 0){
        window.COMMS?.trim?.reserveHPACommitted?.();
      } else {
        window.COMMS?.trim?.reserveHPACommitted?.();  // fire once when reserve is drawn
      }
    }
    return Math.min(1, drawn / cost);
  }

  // ── Manually fire N2 drench immediately (during pending countdown) ───────
  function manualDrench(teamId){
    const d=player.damage; if(!d) return;
    const team=d.teams[teamId]; if(!team||team.task!=='drench_pending') return;
    const comp=team.location; if(!comp) return;
    if(d._fireDrenchPending?.[comp]) delete d._fireDrenchPending[comp];
    // Move team out to home before N2 fires
    team.state='ready'; team.task=null; team._locked=false; team.location=team.home;
    _nitrogenDrench(comp,d,null);
  }

  // ── Start N2 venting in a drenched compartment ────────────────────────────
  function ventN2(teamId, comp){
    const d=player.damage; if(!d) return;
    if(!d._fireDrench?.[comp]) return; // nothing to vent
    const team=d.teams[teamId]; if(!team||team.state==='lost') return;
    if(team._locked) return;
    // If already on_scene at this comp, start immediately
    if(team.state==='on_scene'&&roomSection(team.location)===comp){
      team.task='vent_n2';
      team._ventT=VENT_N2_TIME;
      if(d._fireDrench[comp]) d._fireDrench[comp].venting=true;
      COMMS.fire.ventN2Started(SECTION_LABEL[comp]||comp, team.label);
      return;
    }
    // Otherwise muster toward the drenched comp — mark intent so arrival handler starts vent
    team._ventIntent=comp;
    assignTeam(teamId, comp);
  }

  window.DMG={
    initDamage,hit,tick,applyHullStress,applyDepthCascade,resetDepthCascade,_escapeHalt,
    sealFlooding,igniteFire,getEffects,maxDCTeams,crewEfficiency,
    totalFit,totalWounded,totalKilled,totalCrew,
    assignTeam,recallTeam,teamAtComp,
    manualDrench,ventN2,
    initiateEscape,canTCE,
    getTrimState,drawHPA,
    toggleWTD,
    relocateCrewForWatch:(watch)=>_relocateCrewForWatch(player.damage,watch),
    COMP_DEF,COMPS,STATES,SYS_LABEL,SYS_DEF,ROOMS,ROOM_IDS,SECTION_ROOMS,ROOM_ADJ,SECTION_SYSTEMS,DIESEL_SECTION_SYSTEMS,activeSystems,ROOM_SYSTEMS,WTD_PAIRS,WTD_RC_KEYS,
    SECTION_LABEL,SECTION_SHORT,roomSection,effectiveState,
    COMPARTMENTS:COMPS,
    CREW_MANIFEST,
  };
  } catch(e) { console.error("DAMAGE.JS THREW:", e.message, e.stack); }
})();