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
    fore_ends:    { label:'TORPEDO ROOM',  systems:['tubes','sonar_hull','planes_fwd_hyd'],    crewCount:30, tower:'fwd',  unmanned:false },
    control_room: { label:'CONTROL ROOM',  systems:['periscope','ballast','tdc_comp'],          crewCount:22, tower:'fwd',  unmanned:false },
    aux_section:  { label:'AUX MACHINERY', systems:[],                                          crewCount:0,  tower:null,   unmanned:true  },
    reactor_comp: { label:'REACTOR COMP',  systems:['reactor'],                                 crewCount:3,  tower:null,   unmanned:false },
    engine_room:  { label:'MANEUVERING',   systems:['propulsion'],                              crewCount:20, tower:'aft',  unmanned:false },
    aft_ends:     { label:'ENGINEERING',   systems:['towed_array','steering','planes_aft_hyd'], crewCount:15, tower:'aft',  unmanned:false },
  };

  const SYS_LABEL = {
    sonar_hull:'SONAR ARRAY', tubes:'TORPEDO TUBES',
    periscope:'PERISCOPE', ballast:'BALLAST CTRL', tdc_comp:'TDC COMPUTER',
    reactor:'REACTOR', propulsion:'PROPULSION', steering:'STEERING',
    towed_array:'TOWED ARRAY',
    planes_fwd_hyd:'FWD PLANES HYD', planes_aft_hyd:'AFT PLANES HYD',
  };

  // Systems with high injury risk during repair
  const HIGH_ENERGY_SYS = new Set(['reactor','propulsion']);

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
    control_room: ['fore_ends','aux_section'],
    aux_section:  ['control_room','reactor_comp'],
    reactor_comp: ['aux_section','engine_room'],
    engine_room:  ['reactor_comp','aft_ends'],
    aft_ends:     ['engine_room'],
  };
  // ── Room definitions (compartments within watertight sections) ────────────
  // d0=D1 top deck, d1=D2 mid deck, d2=D3 lower deck.
  // unmanned rooms have detectionDelay — fire burns undetected until countdown expires.
  const ROOMS = {
    fore_ends_d0:    { label:'FWD DOME / PLANES', section:'fore_ends',    deck:0, unmanned:true,  detectionDelay:50 },
    fore_ends_d1:    { label:'ENG OFFICE',         section:'fore_ends',    deck:1, unmanned:true,  detectionDelay:60 },
    fore_ends_d2:    { label:'TORPEDO ROOM',       section:'fore_ends',    deck:2, unmanned:false, detectionDelay:0  },
    control_room_d0: { label:'COMMS / SCOPE',      section:'control_room', deck:0, unmanned:false, detectionDelay:0  },
    control_room_d1: { label:'CONTROL ROOM',       section:'control_room', deck:1, unmanned:false, detectionDelay:0  },
    control_room_d2: { label:'MACHINERY ROOM',     section:'control_room', deck:2, unmanned:false, detectionDelay:0  },
    aux_section_d0:  { label:'SNKL CONTROL',       section:'aux_section',  deck:0, unmanned:true,  detectionDelay:45 },
    aux_section_d1:  { label:'VENT PLANT',         section:'aux_section',  deck:1, unmanned:true,  detectionDelay:45 },
    aux_section_d2:  { label:'RX E-COOL',          section:'aux_section',  deck:2, unmanned:true,  detectionDelay:90 },
    reactor_comp_d0: { label:'RC TUNNEL',          section:'reactor_comp', deck:0, unmanned:false, detectionDelay:0  },
    reactor_comp_d1: { label:'REACTOR',            section:'reactor_comp', deck:1, unmanned:true,  detectionDelay:75 },
    reactor_comp_d2: { label:'REACTOR (LOWER)',    section:'reactor_comp', deck:2, unmanned:true,  detectionDelay:75 },
    engine_room_d0:  { label:'MANEUVERING',        section:'engine_room',  deck:0, unmanned:false, detectionDelay:0  },
    engine_room_d1:  { label:'ELEC DIST',          section:'engine_room',  deck:1, unmanned:false, detectionDelay:0  },
    engine_room_d2:  { label:'MACHINERY',          section:'engine_room',  deck:2, unmanned:false, detectionDelay:0  },
    aft_ends_d0:     { label:'ENGINEERING',        section:'aft_ends',     deck:0, unmanned:false, detectionDelay:0  },
    aft_ends_d1:     { label:'PROPULSION',         section:'aft_ends',     deck:1, unmanned:false, detectionDelay:0  },
    aft_ends_d2:     { label:'STEER / AFT',        section:'aft_ends',     deck:2, unmanned:false, detectionDelay:0  },
  };
  const ROOM_IDS = Object.keys(ROOMS);
  const SECTION_ROOMS = {};
  for(const [id,r] of Object.entries(ROOMS)){
    if(!SECTION_ROOMS[r.section]) SECTION_ROOMS[r.section]=[];
    SECTION_ROOMS[r.section].push(id);
  }

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
    // ── MEDICAL (2, physically in control_room — sick bay adjacent) ───────
    { id:'oconnor',  comp:'control_room', rating:'LMA',  firstName:'Patrick', lastName:"O'Connor", role:'LMA',      roleDesc:'Leading Medical Assistant',                  gender:'m', watch:'duty', dcTeam:null,    dept:'medical' },
    { id:'hayes',    comp:'control_room', rating:'MA',   firstName:'Claire',  lastName:'Hayes',    role:'MA',       roleDesc:'Medical Assistant',                          gender:'f', watch:'duty', dcTeam:null,    dept:'medical' },
    // ── FORE ENDS (25) ────────────────────────────────────────────────────
    // A(13): Jacobs Drake Sadler Reeves Shaw Cullen Pearce Lane Hobbs Dunn Yates Quinn Gill
    // B(12): Nash Burns Cole Morton Porter Holt Finch Baxter Frost Pratt Norris Flynn
    // DC Alpha: Drake Reeves Shaw Cullen Lane Hobbs
    { id:'jacobs',   comp:'fore_ends', rating:'CPO', firstName:'Ron',    lastName:'Jacobs',  role:'COW(T)',   roleDesc:'Chief of the Watch (Torpedo)',           gender:'m', watch:'A', dcTeam:null    },
    { id:'drake',    comp:'fore_ends', rating:'PO',  firstName:'Kevin',  lastName:'Drake',   role:'TRP RDY',  roleDesc:'Torpedo Ready Duty',                    gender:'m', watch:'A', dcTeam:'alpha' },
    { id:'sadler',   comp:'fore_ends', rating:'PO',  firstName:'Frank',  lastName:'Sadler',  role:'SON PO',   roleDesc:'Sonar PO on Watch',                     gender:'m', watch:'A', dcTeam:null    },
    { id:'reeves',   comp:'fore_ends', rating:'LS',  firstName:'Tony',   lastName:'Reeves',  role:'TORP',     roleDesc:'Torpedo Rating on Watch',                gender:'m', watch:'A', dcTeam:'alpha' },
    { id:'shaw',     comp:'fore_ends', rating:'LS',  firstName:'Gary',   lastName:'Shaw',    role:'TORP',     roleDesc:'Torpedo Rating on Watch',                gender:'m', watch:'A', dcTeam:'alpha' },
    { id:'cullen',   comp:'fore_ends', rating:'AB',  firstName:'Lee',    lastName:'Cullen',  role:'TORP',     roleDesc:'Torpedo Tube Maintainer',                gender:'m', watch:'A', dcTeam:'alpha' },
    { id:'pearce',   comp:'fore_ends', rating:'AB',  firstName:'Aiden',  lastName:'Pearce',  role:'SON OP',   roleDesc:'Sonar Operator',                         gender:'m', watch:'A', dcTeam:null    },
    { id:'lane',     comp:'fore_ends', rating:'AB',  firstName:'Chris',  lastName:'Lane',    role:'TORP',     roleDesc:'Torpedo Rating',                         gender:'m', watch:'A', dcTeam:'alpha' },
    { id:'hobbs',    comp:'fore_ends', rating:'AB',  firstName:'Nick',   lastName:'Hobbs',   role:'SON OP',   roleDesc:'Sonar Operator',                         gender:'m', watch:'A', dcTeam:'alpha' },
    { id:'dunn',     comp:'fore_ends', rating:'LS',  firstName:'Bobby',  lastName:'Dunn',    role:'FE MAINT', roleDesc:'Fore Ends Maintenance',                  gender:'m', watch:'A', dcTeam:null    },
    { id:'yates',    comp:'fore_ends', rating:'AB',  firstName:'Carl',   lastName:'Yates',   role:'TUBE MNT', roleDesc:'Torpedo Tube Maintenance',               gender:'m', watch:'A', dcTeam:null    },
    { id:'quinn',    comp:'fore_ends', rating:'LS',  firstName:'Ben',    lastName:'Quinn',   role:'FE LS',    roleDesc:'Fore Ends Leading Seaman',               gender:'m', watch:'A', dcTeam:null    },
    { id:'gill',     comp:'fore_ends', rating:'AB',  firstName:'Terry',  lastName:'Gill',    role:'SON OP',   roleDesc:'Sonar Operator',                         gender:'m', watch:'A', dcTeam:null    },
    { id:'nash',     comp:'fore_ends', rating:'CPO', firstName:'Frank',  lastName:'Nash',    role:'COW(S)',   roleDesc:'Chief of the Watch (Sonar)',              gender:'m', watch:'B', dcTeam:null    },
    { id:'burns',    comp:'fore_ends', rating:'PO',  firstName:'Andy',   lastName:'Burns',   role:'SON PO',   roleDesc:'Sonar PO on Watch',                      gender:'m', watch:'B', dcTeam:null    },
    { id:'cole',     comp:'fore_ends', rating:'PO',  firstName:'Martin', lastName:'Cole',    role:'TRP RDY',  roleDesc:'Torpedo Ready Duty',                     gender:'m', watch:'B', dcTeam:null    },
    { id:'morton',   comp:'fore_ends', rating:'LS',  firstName:'Pete',   lastName:'Morton',  role:'SON OP',   roleDesc:'Sonar Operator',                         gender:'m', watch:'B', dcTeam:null    },
    { id:'porter',   comp:'fore_ends', rating:'LS',  firstName:'Sam',    lastName:'Porter',  role:'SON LS',   roleDesc:'Sonar Leading Seaman on Watch',           gender:'m', watch:'B', dcTeam:null    },
    { id:'holt',     comp:'fore_ends', rating:'AB',  firstName:'Phil',   lastName:'Holt',    role:'TORP',     roleDesc:'Torpedo Rating',                         gender:'m', watch:'B', dcTeam:null    },
    { id:'finch',    comp:'fore_ends', rating:'AB',  firstName:'Joe',    lastName:'Finch',   role:'TORP',     roleDesc:'Torpedo Rating',                         gender:'m', watch:'B', dcTeam:null    },
    { id:'baxter',   comp:'fore_ends', rating:'PO',  firstName:'Stuart', lastName:'Baxter',  role:'FE PO',    roleDesc:'Fore Ends PO on Watch',                  gender:'m', watch:'B', dcTeam:null    },
    { id:'frost',    comp:'fore_ends', rating:'AB',  firstName:'Dave',   lastName:'Frost',   role:'TORP',     roleDesc:'Torpedo Rating',                         gender:'m', watch:'B', dcTeam:null    },
    { id:'pratt',    comp:'fore_ends', rating:'AB',  firstName:'Ray',    lastName:'Pratt',   role:'TORP',     roleDesc:'Torpedo Rating',                         gender:'m', watch:'B', dcTeam:null    },
    { id:'norris',   comp:'fore_ends', rating:'AB',  firstName:'Emma',   lastName:'Norris',  role:'SON OP',   roleDesc:'Sonar Operator',                         gender:'f', watch:'B', dcTeam:null    },
    { id:'flynn',    comp:'fore_ends', rating:'AB',  firstName:'Danny',  lastName:'Flynn',   role:'TORP',     roleDesc:'Torpedo Rating',                         gender:'m', watch:'B', dcTeam:null    },
    // ── SUPPLY / CATERING (5, physically fore_ends — galley is forward) ──
    { id:'taylor',   comp:'fore_ends', rating:'CPOSA', firstName:'George', lastName:'Taylor',  role:'CPOSA',    roleDesc:'Chief Petty Officer Supply & Secretariat', gender:'m', watch:'duty', dcTeam:null, dept:'supply' },
    { id:'mackay',   comp:'fore_ends', rating:'PO',    firstName:'Ian',    lastName:'MacKay',  role:'PO(CS)',   roleDesc:'Petty Officer Catering Services',           gender:'m', watch:'A',    dcTeam:null, dept:'supply' },
    { id:'wright',   comp:'fore_ends', rating:'PO',    firstName:'Linda',  lastName:'Wright',  role:'PO(CS)',   roleDesc:'Petty Officer Catering Services',           gender:'f', watch:'B',    dcTeam:null, dept:'supply' },
    { id:'cross',    comp:'fore_ends', rating:'AB',    firstName:'Danny',  lastName:'Cross',   role:'AB(CS)',   roleDesc:'Able Rating Catering Services',             gender:'m', watch:'A',    dcTeam:null, dept:'supply' },
    { id:'reed',     comp:'fore_ends', rating:'AB',    firstName:'Kate',   lastName:'Reed',    role:'AB(CS)',   roleDesc:'Able Rating Catering Services',             gender:'f', watch:'B',    dcTeam:null, dept:'supply' },
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
    fore_ends:'weapons', control_room:'warfare', aux_section:'engineering',
    reactor_comp:'reactor', engine_room:'engineering', aft_ends:'engineering',
  };

  function buildCrewManifest(){
    const manifest={};
    for(const comp of COMPS) manifest[comp]=[];
    for(const m of CREW_MANIFEST){
      const dept=m.dept||_DEPT_BY_ROLE[m.role]||_DEPT_BY_COMP[m.comp]||'warfare';
      manifest[m.comp].push({
        id:        m.id,
        name:      `${m.rating} ${m.firstName[0]}.${m.lastName}`,
        firstName: m.firstName,
        lastName:  m.lastName,
        rating:    m.rating,
        role:      m.role,
        roleDesc:  m.roleDesc,
        gender:    m.gender,
        watch:     m.watch,
        dcTeam:    m.dcTeam,
        dept,
        status:    'fit',
        comp:      m.comp,
      });
    }
    return manifest;
  }

  // ── DC team log (separate from main ship log) ─────────────────────────────
  // ── Init ──────────────────────────────────────────────────────────────────
  function initDamage(){
    const crewTotal=COMPS.reduce((a,c)=>a+COMP_DEF[c].crewCount,0);
    player.damage={
      strikes:  {fore_ends:0,control_room:0,aux_section:0,reactor_comp:0,engine_room:0,aft_ends:0},
      flooded:  {fore_ends:false,control_room:false,aux_section:false,reactor_comp:false,engine_room:false,aft_ends:false},
      systems:{
        sonar_hull:'nominal',tubes:'nominal',periscope:'nominal',
        ballast:'nominal',tdc_comp:'nominal',reactor:'nominal',
        propulsion:'nominal',steering:'nominal',towed_array:'nominal',
        planes_fwd_hyd:'nominal',planes_aft_hyd:'nominal',
      },
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
          home:'fore_ends',       // natural home compartment
          state:'ready',          // ready|transit|on_scene|blowing|lost
          location:'fore_ends',   // last known / used for travel calc
          destination:null,       // comp being travelled to
          transitEta:0,
          task:null,              // null|'flood'|'repair'
          repairTarget:null,      // sys name or null (auto)
          repairProgress:0,
          statusT:0,              // timer for periodic comms
          _autoMode:false, _readyT:0, _locked:false,
        },
        bravo:{
          id:'bravo', label:'DC BRAVO',
          home:'engine_room',
          state:'ready',          // ready|transit|on_scene|blowing|lost
          location:'engine_room',
          destination:null,
          transitEta:0,
          task:null,
          repairTarget:null,
          repairProgress:0,
          statusT:0,
          _autoMode:false, _readyT:0, _locked:false,
        },
      },
      _emergMusterFired:false,
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

  // Which team is assigned to a compartment?
  function teamAtComp(comp){
    const d=player.damage; if(!d) return null;
    for(const t of Object.values(d.teams)){
      if(t.state==='on_scene'&&t.location===comp) return t;
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
    if((team.state==='on_scene'||team.state==='transit')&&(team.location===comp||team.destination===comp)) return;

    // Can team cross? (reactor flooded blocks crossing)
    const fwd=['fore_ends','control_room','aux_section'];
    const aft=['engine_room','aft_ends'];
    const reactorFlooded=d.flooded.reactor_comp||d.flooded.aux_section;
    if(reactorFlooded){
      const teamFwd=fwd.includes(team.location)||team.location==='reactor_comp';
      const destFwd=fwd.includes(comp)||comp==='reactor_comp';
      if(teamFwd!==destFwd){ COMMS.dc.cannotCross(team.label); return; }
    }

    team.state='mustering';
    team.destination=comp;
    team.musterT=15;
    team.task=null;
    team.repairTarget=null;
    team.repairProgress=0;

    COMMS.dc.mustering(team.label, COMP_DEF[comp].label);
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
    team.repairTarget=null;
    team.repairProgress=0;
    COMMS.dc.recalled(team.label, wasBlow);
  }

  // ── DC auto-dispatch helpers ──────────────────────────────────────────────
  function _canReachComp(team,comp,d){
    const fwd=['fore_ends','control_room','aux_section'];
    const reactorFlooded=d.flooded.reactor_comp||d.flooded.aux_section;
    if(!reactorFlooded) return true;
    const loc=team.location||team.home;
    const teamFwd=fwd.includes(loc)||loc==='reactor_comp';
    const destFwd=fwd.includes(comp)||comp==='reactor_comp';
    return teamFwd===destFwd;
  }

  function _bestDCTarget(team,d){
    // Build set of comps where another locked team is already committed
    const covered=new Set(
      Object.values(d.teams)
        .filter(t=>t!==team&&t._locked)
        .map(t=>t.destination||t.location)
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
      if(d.floodRate[comp]>0||(d.flooding[comp]||0)>0.05) return comp;
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
    const eta=TRAVEL[team.location]?.[comp]??60;
    team.state='transit';
    team.destination=comp;
    team.transitEta=eta;
    team.task=null;
    team.repairTarget=null;
    team.repairProgress=0;
    team._autoMode=true;
    COMMS.dc.autoDispatching(team.label,COMP_DEF[comp].label,Math.round(eta));
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
      // ── SECOND HIT → INSTANT FLOOD ───────────────────────────────────
      d.strikes[comp]=2;
      d.flooded[comp]=true;
      d.flooding[comp]=1.0;
      d.floodRate[comp]=0;
      for(const sys of def.systems) d.systems[sys]='destroyed';
      const lost=_floodComp(comp);
      if(def.tower&&d.towers[def.tower]!=='destroyed') d.towers[def.tower]='destroyed';

      // DC teams: on_scene → evacuation roll; transit → keep going, will blow on arrival
      for(const team of Object.values(d.teams)){
        if(team.state==='on_scene'&&team.location===comp){
          // Evacuation roll — 75% escape
          if(Math.random()<0.75){
            team.state='ready';
            team.task=null;
            // Wound a team member to reflect the scramble
            _woundDcTeamMember(team, d);
            COMMS.dc.teamEvacuated(team.label, def.label);
          } else {
            team.state='lost';
            COMMS.dc.teamLost(team.label, def.label);
          }
        }
        // Teams in transit continue — they will arrive and start HP blow automatically
      }

      _alert(`${def.label} FLOODED`);
      COMMS.flood.uncontrolled(def.label, COMP_STATION[comp]||'ENG', lost);
      if(comp==='reactor_comp'){
        if(!player.scram&&typeof window.G.triggerScram==='function') window.G.triggerScram('damage');
        d.systems.reactor='destroyed';
        COMMS.flood.reactorFlooded();
      }
      _checkSinking();

    } else {
      // ── FIRST HIT → PROGRESSIVE FLOODING ────────────────────────────
      d.strikes[comp]=1;
      // Set flood rate based on severity (units/sec into 0–1 scale)
      // 0.008/s max → ~125s to fill at surface without DC (realistic 2-min window)
      // Pressure multiplier in tick drives this to ~36s at 300m — still survivable but urgent
      d.floodRate[comp]=Math.max(d.floodRate[comp], severity*0.008);

      const sysList=[...def.systems].sort(()=>rand(-1,1));
      const numHit=severity>0.7?sysList.length:1;
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
        COMMS.sys.casualties(cas.killed, cas.wounded, def.label);
      }
      if(cas.wounded>0) COMMS.medical.casualtyCallOut(def.label);
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
      COMMS.flood.firstHit(def.label, COMP_STATION[comp]||'ENG', urgency, tFlood);
    }
    player.hp=Math.max(1,100-Object.values(d.strikes).reduce((a,b)=>a+b,0)*15);
  }

  // ── Sinking check ─────────────────────────────────────────────────────────
  function _checkSinking(){
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
      if(team.state==='on_scene'&&team.location===comp){
        team.state='lost';
        COMMS.dc.teamLostSealed(team.label, COMP_DEF[comp].label);
      }
    }
    d.floodRate[comp]=0;
    d.flooding[comp]=0;
    for(const sys of COMP_DEF[comp].systems){
      if(d.systems[sys]==='nominal') d.systems[sys]='offline';
    }
    COMMS.flood.sealed(COMP_DEF[comp].label);
    dcLog(`${COMP_DEF[comp].label} — SEALED. All systems offline`);
  }

  // ── System helpers ────────────────────────────────────────────────────────
  function stateIndex(sys){ return STATES.indexOf(player.damage.systems[sys]); }
  function damageSystem(sys,steps=1){
    const d=player.damage;
    const next=Math.min(stateIndex(sys)+steps,STATES.length-1);
    d.systems[sys]=STATES[next];
    return STATES[next];
  }

  // ── Next damaged system to repair in a compartment (auto-priority) ────────
  function _nextRepairTarget(comp,d){
    const sysList=COMP_DEF[comp].systems;
    // Priority: worst state first, skip nominal only (destroyed is repairable post-blow)
    const repairable=sysList
      .filter(s=>d.systems[s]!=='nominal')
      .sort((a,b)=>stateIndex(b)-stateIndex(a));
    return repairable[0]||null;
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
          const comp=team.destination;
          const eta=TRAVEL[team.location]?.[comp]??60;
          team.state='transit';
          team.transitEta=eta;
          COMMS.dc.dispatched(team.label, COMP_DEF[comp].label, Math.round(eta));
        }
        continue;
      }

      // ── TRANSIT ────────────────────────────────────────────────────────
      if(team.state==='transit'){
        team.transitEta-=dt;
        if(team.transitEta<=0){
          const arrComp=team.destination;
          team.location=arrComp;
          team.destination=null;
          team.repairProgress=0;
          if(d.flooded[arrComp]){
            // Compartment fully flooded — work from outside with HP air
            team.state='blowing';
            team.task='blow';
            team._locked=true;
            COMMS.dc.blow.started(team.label, COMP_DEF[arrComp].label);
          } else {
            team.state='on_scene';
            team.task=null;
            if(_sectionHasFire(arrComp,d)){
              // Fire takes priority — dcArrival is the sole arrival message
              team.task='fire';
              team._locked=true;
              team._fireLosing=0;
              COMMS.fire.dcArrival(team.label, COMP_DEF[arrComp].label);
            } else if(d.floodRate[arrComp]>0||d.flooding[arrComp]>0.05){
              COMMS.dc.onScene(team.label, COMP_DEF[arrComp].label);
              team.task='flood';
              team._locked=true;
              COMMS.dc.floodingActive(team.label);
            } else {
              COMMS.dc.onScene(team.label, COMP_DEF[arrComp].label);
              const sys=_nextRepairTarget(arrComp,d);
              if(sys){
                team.task='repair';
                team.repairTarget=sys;
                COMMS.dc.startRepair(team.label, SYS_LABEL[sys]);
              } else {
                team.task=null;
                team.state='ready';
                dcLog(`${team.label} — ${COMP_DEF[arrComp].label} secure. Standing by`);
              }
            }
          }
        }
        continue;
      }

      // ── ON SCENE ───────────────────────────────────────────────────────
      if(team.state==='on_scene'){
        const comp=team.location;
        const eff=_teamEffectiveness(team);

        // If compartment suddenly flooded while on_scene → evac roll (already handled
        // by the hit/flood path above, but guard here in case state is stale)
        if(d.flooded[comp]){
          // Transition to blowing from outside — don't re-kill
          team.state='blowing';
          team.task='blow';
          team._locked=true;
          COMMS.dc.blow.started(team.label, COMP_DEF[comp].label);
          continue;
        }

        // Drench pending — team is outside operating N2 controls; skip all task logic
        if(team.task==='drench_pending') continue;

        // ── FIRE FIGHTING ───────────────────────────────────────────────
        // Actual suppression computed in _tickFire; team loop just handles
        // status comms and task transitions.
        if(team.task==='fire'||_sectionHasFire(comp,d)){
          team.task='fire';
          team._locked=true;
          // Periodic status
          if(team.statusT<=0){
            team.statusT=20;
            COMMS.fire.dcStatus(team.label,Math.round(_sectionFire(comp,d)*100),COMP_DEF[comp].label);
          }
          // Fire out — transition to flood or repair
          if(!_sectionHasFire(comp,d)){
            team._locked=false;
            team.task=null;
            if(!d._fireDrench?.[comp]) _returnCrew(comp,d,'fire');
            if(d.floodRate[comp]>0||d.flooding[comp]>0.05){
              team.task='flood';
              COMMS.dc.floodingActive(team.label);
            } else {
              const sys=_nextRepairTarget(comp,d);
              if(sys){ team.task='repair'; team.repairTarget=sys; COMMS.dc.startRepair(team.label,SYS_LABEL[sys]); }
              else { team.state='ready'; COMMS.dc.allSecure(team.label,COMP_DEF[comp].label); }
            }
          }
          continue;
        }

        // ── FLOOD FIGHTING ──────────────────────────────────────────────
        const FLOOD_FIGHT_RATE=0.055; // units/sec reduction in floodRate
        if(team.task==='flood'||d.floodRate[comp]>0){
          team.task='flood';
          team._locked=true;
          const reduction=FLOOD_FIGHT_RATE*eff;
          d.floodRate[comp]=Math.max(0,d.floodRate[comp]-reduction*dt);

          // Breach sealed — hand off draining to bilge pumps, move straight to repairs
          if(d.floodRate[comp]===0){
            team._locked=false;
            // If flooding is essentially clear, return crew now; else bilge will trigger it
            if((d.flooding[comp]||0)<=0.05) _returnCrew(comp,d);
            team.task=null;
            const sys=_nextRepairTarget(comp,d);
            if(sys){
              team.task='repair'; team.repairTarget=sys; team.repairProgress=0;
              COMMS.dc.breachSealed(team.label, COMP_DEF[comp].label, sys, SYS_LABEL[sys]);
            } else {
              team.state='ready';
              COMMS.dc.breachSealed(team.label, COMP_DEF[comp].label, null, null);
            }
          } else {
            // Still flooding — periodic status
            if(team.statusT<=0){
              team.statusT=25;
              const pct=Math.round(d.flooding[comp]*100);
              const netRate=d.floodRate[comp];
              COMMS.dc.floodStatus(team.label, pct, netRate);
            }
          }
          continue;
        }

        // ── REPAIR — compartment-level shared job ───────────────────────
        // Count teams on scene here (for speed bonus)
        const teamsOnScene=Object.values(d.teams).filter(t=>t.state==='on_scene'&&t.location===comp).length;
        // Speed: 1 team = 1.0x, 2 teams = 1.4x (both teams contribute, not double)
        const repairSpeed=eff*(teamsOnScene>=2?1.4:1.0);

        // Get or create a repair job for this compartment
        let job=d.repairJobs[comp];
        // Only reset job if it's missing or the current system reached nominal (done)
        // NOT on 'destroyed' — that's a valid repair target now
        if(!job||d.systems[job.sys]==='nominal'){
          const sys=_nextRepairTarget(comp,d);
          if(sys){
            const jobIsNew=!job||job.sys!==sys;
            d.repairJobs[comp]=job={sys,progress:0,totalTime:REPAIR_TIME[d.systems[sys]]||45};
            if(jobIsNew){
              COMMS.dc.startRepair(team.label, SYS_LABEL[sys]);
            }
          } else {
            d.repairJobs[comp]=null;
            team.task=null;
            team.state='ready';
            COMMS.dc.allSecure(team.label, COMP_DEF[comp].label);
            // Check if entire boat is now clear — if so, secure from emergency stations
            if(window.G.game.casualtyState==='emergency'){
              const anyFlood = COMPS.some(cp => (d.flooding[cp]||0) > 0.001);
              const anyTeamActive = Object.values(d.teams).some(t => t.state!=='ready' && t.state!=='lost');
              if(!anyFlood && !anyTeamActive){
                window.G.setCasualtyState('normal');
                d._emergMusterFired=false;
                for(const t of Object.values(d.teams)){ t._autoMode=false; t._readyT=0; }
                COMMS.crewState.casualtyControlled('flood');
              }
            }
            continue;
          }
        }
        job=d.repairJobs[comp];
        if(job){
          team.task='repair';
          team.repairTarget=job.sys;  // keep team display in sync
          // Only the "lead" team (first alphabetically) advances progress — prevents double counting
          const teamsList=Object.values(d.teams).filter(t=>t.state==='on_scene'&&t.location===comp);
          const isLead=teamsList[0]===team;
          if(isLead){
            job.progress+=repairSpeed*dt;
            // Periodic status (one message from lead team only)
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
                _alert(`${SYS_LABEL[sys]} REPAIRED`);
                // High-energy repair risk
                if(HIGH_ENERGY_SYS.has(sys)&&Math.random()<0.07){
                  const compCrew=(d.crew[comp]||[]).filter(c=>c.status==='fit');
                  if(compCrew.length>0){
                    const victim=compCrew[Math.floor(Math.random()*compCrew.length)];
                    victim.status=Math.random()<0.35?'killed':'wounded';
                    dcLog(`${team.label} — CASUALTY during ${SYS_LABEL[sys]} repair. ${victim.name} ${victim.status}`);
                  }
                }
              }
              d.repairJobs[comp]=null;
            }
          }
        }
      }

      // ── HP AIR BLOW (team outside flooded compartment) ───────────────────
      if(team.state==='blowing'){
        const comp=team.location;
        if(!d.flooded[comp]){
          // Compartment no longer flooded (e.g. patched by other means) — enter normally
          team.state='on_scene'; team.task=null;
          COMMS.dc.blow.accessible(team.label, COMP_DEF[comp].label);
          continue;
        }
        // Drain rate: ~0.008/s (~125s full drain). Slow and loud.
        const BLOW_RATE=0.008;
        d.flooding[comp]=Math.max(0,(d.flooding[comp]||0)-BLOW_RATE*dt);
        // Periodic status
        if(team.statusT<=0){
          team.statusT=20;
          const pct=Math.round(d.flooding[comp]*100);
          COMMS.dc.blow.progress(team.label, COMP_DEF[comp].label, pct);
        }
        // Once flooding drops below 15%, team can crack the door and enter
        if(d.flooding[comp]<=0.15){
          d.flooded[comp]=false;
          d.floodRate[comp]=0;
          team.state='on_scene';
          team.task='flood'; // finish clearing residual water
          team._locked=false;
          COMMS.dc.blow.complete(team.label, COMP_DEF[comp].label);
          _alert(`${COMP_DEF[comp].label} RE-ENTERED`);
          _returnCrew(comp,d);
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
    return d.towers.fwd!=='destroyed'||d.towers.aft!=='destroyed';
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
      if(d.towers.fwd!=='destroyed') towers.push('fwd');
      if(d.towers.aft!=='destroyed') towers.push('aft');
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
    const label = COMP_DEF[comp].label;
    const station = COMP_STATION[comp]||'ENG';
    const tFlood = Math.round(1/seepRate);
    window.COMMS?.flood?.depthSeep(label, station, tFlood);

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
    const returnees=(d.crew[comp]||[]).filter(cr=>cr.displaced&&cr.status!=='killed');
    if(!returnees.length) return;
    for(const cr of returnees) cr.displaced=false;
    if(cause==='fire') COMMS.fire.crewReturn(COMP_DEF[comp].label, COMP_STATION[comp]||'ENG', returnees.length);
    else               COMMS.flood.crewReturn(COMP_DEF[comp].label, COMP_STATION[comp]||'ENG', returnees.length);
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
      const manned=all.filter(r=>!ROOMS[r].unmanned);
      const pool=manned.length?manned:all;
      roomId=pool[Math.floor(Math.random()*pool.length)];
    } else { return; }
    const room=ROOMS[roomId];
    const section=room.section;
    if(d._fireDrench?.[section]) return;
    if(d.flooded[section]) return;
    if((d.fire[roomId]||0)>=intensity) return;
    d.fire[roomId]=Math.max(d.fire[roomId]||0, intensity);
    if(room.unmanned){
      // Undetected — fire burns silently until detection countdown expires
      d._fireDetected[roomId]=false;
      d._fireDetectT[roomId]=room.detectionDelay;
    } else {
      d._fireDetected[roomId]=true;
      _triggerFireDetection(roomId, section, d);
    }
  }

  // Runs section-level response when a fire is detected (manned room = immediate,
  // unmanned room = after detectionDelay countdown)
  function _triggerFireDetection(roomId, section, d){
    const room=ROOMS[roomId];
    if(!d._evacuated) d._evacuated={};
    d._evacuated[section]=true;
    if(!d._fireWatch) d._fireWatch={};
    if(!d._fireWatch[section]){
      // First detected fire in this section — mobilise watchkeepers
      const compCrew=(d.crew[section]||[]).filter(cr=>cr.status==='fit'&&!cr.displaced);
      const watchCount=Math.min(3, Math.max(1, Math.floor(compCrew.length*0.15)));
      for(let i=watchCount;i<compCrew.length;i++) compCrew[i].displaced=true;
      d._fireWatch[section]={ count:watchCount, t:0, lastCasCheck:0, _outOfControlFired:false };
      _alert(`FIRE — ${room.label}`);
      COMMS.fire.ignited(room.label, COMP_STATION[section]||'ENG');
      if(watchCount>0) COMMS.fire.watchkeeperResponse(COMP_DEF[section].label, watchCount);
      window.G.setCasualtyState('emergency');
    } else {
      // Section already on alert — just announce the new room
      _alert(`FIRE — ${room.label}`);
      COMMS.fire.ignited(room.label, COMP_STATION[section]||'ENG');
    }
    if(section==='reactor_comp'&&!d._reactorFireScram){
      d._reactorFireScram=true;
      if(d.systems.reactor==='nominal'||d.systems.reactor==='degraded') d.systems.reactor='offline';
      COMMS.reactor.scram('fire');
    }
  }

  // ── Fire extinguish helper ────────────────────────────────────────────────
  function _extinguishFire(roomId, d, by){
    d.fire[roomId]=0;
    delete d._fireDetected[roomId];
    delete d._fireDetectT[roomId];
    const section=ROOMS[roomId].section;
    // If other rooms in this section still burn, no section-level cleanup yet
    if((SECTION_ROOMS[section]||[]).some(rid=>rid!==roomId&&(d.fire[rid]||0)>0.01)) return;
    // Section fully clear
    if(d._fireWatch) d._fireWatch[section]=null;
    if(d._fireDrenchPending?.[section]){
      delete d._fireDrenchPending[section];
      const drenchTeam=Object.values(d.teams).find(t=>t.task==='drench_pending'&&t.location===section);
      if(drenchTeam){ drenchTeam.state='ready'; drenchTeam.task=null; drenchTeam.location=null; }
    }
    if(!d._fireDrench?.[section]) _returnCrew(section,d,'fire');
    if(section==='reactor_comp'&&d._reactorFireScram){
      d._reactorFireScram=false;
      if(!player.scram&&typeof window.G.triggerScram==='function'){
        window.G.triggerScram('damage');
        COMMS.reactor.fireScramLifted();
      }
    }
    COMMS.fire.extinguished(COMP_DEF[section].label, by);
    _alert(`FIRE OUT — ${COMP_DEF[section].label}`);
    if(window.G.game.casualtyState==='emergency'){
      const anyFire=ROOM_IDS.some(rid=>(d.fire[rid]||0)>0.01);
      const anyFlood=COMPS.some(s=>(d.flooding[s]||0)>0.001);
      const anyTeamActive=Object.values(d.teams).some(t=>t.state!=='ready'&&t.state!=='lost');
      if(!anyFire&&!anyFlood&&!anyTeamActive){
        window.G.setCasualtyState('normal');
        d._emergMusterFired=false;
        for(const t of Object.values(d.teams)){ t._autoMode=false; t._readyT=0; }
        COMMS.crewState.casualtyControlled('fire');
      }
    }
  }

  // ── Nitrogen drench (automated last resort) ───────────────────────────────
  function _nitrogenDrench(comp, d, dcTeam){
    if(!d._fireDrench) d._fireDrench={};
    d._fireDrench[comp]=true;

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
    if(dcTeam&&dcTeam.state==='on_scene'&&dcTeam.location===comp){
      _woundDcTeamMember(dcTeam, d); _woundDcTeamMember(dcTeam, d);
      dcTeam.state='ready'; dcTeam.task=null;
      COMMS.dc.teamEvacuated(dcTeam.label, COMP_DEF[comp].label);
    }

    for(const rid of SECTION_ROOMS[comp]||[]) d.fire[rid]=0;
    if(d._fireWatch) d._fireWatch[comp]=null;
    // Section stays evacuated — uninhabitable until aired out (not modelled)

    COMMS.fire.nitrogenDrench(COMP_DEF[comp].label, cas);
    _alert(`N2 DRENCH — ${COMP_DEF[comp].label}`);

    if(comp==='reactor_comp'){
      if(d._reactorFireScram) d._reactorFireScram=false;
      if(!player.scram&&typeof window.G.triggerScram==='function'){
        window.G.triggerScram('damage');
        COMMS.reactor.scram('damage');
      }
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
  const FIRE_BASE_GROW   = 0.008;   // growth/s at fireLevel=0 (raised: 1 watchkeeper can only hold fires below ~8%)
  const FIRE_SCALE_GROW  = 0.025;   // additional growth/s at fireLevel=1
  const WATCH_SUPPRESS   = 0.010;   // suppression/s per watchkeeper
  const DC_FIRE_SUPPRESS = 0.030;   // suppression/s for DC team (breathing apparatus)
  const DRENCH_THRESH    = 0.90;    // fire level that triggers drench consideration
  const DRENCH_LOSE_TIME = 10;      // seconds DC team must be losing to trigger drench

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
    if(dest!=='control_room') COMMS.medical.enRoute(staff.label, COMP_DEF[dest].label);
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
            COMMS.medical.bleedOut(m.name, COMP_DEF[comp].label);
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
          COMMS.medical.onScene(staff.label, COMP_DEF[staff.location].label);
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
    for(const section of COMPS){
      const roomIds=SECTION_ROOMS[section]||[];
      const watch=d._fireWatch?.[section];
      const dcTeam=Object.values(d.teams).find(t=>
        t.state==='on_scene'&&t.location===section&&t.task==='fire');
      const watchCount=watch?.count||0;
      const dcSuppress=dcTeam?DC_FIRE_SUPPRESS*_teamEffectiveness(dcTeam):0;
      const watchSuppress=watchCount*WATCH_SUPPRESS;
      const totalSuppress=watchSuppress+dcSuppress;

      let F=0; // section max detected fire level (for section-level logic)
      let anyRoomFire=false;

      // ── Per-room fire growth ───────────────────────────────────────────
      for(const roomId of roomIds){
        const fire=d.fire[roomId]||0;
        if(fire<=0) continue;
        anyRoomFire=true;
        const growRate=FIRE_BASE_GROW+fire*FIRE_SCALE_GROW;
        // Undetected fire in unmanned room — burns silently, no suppression
        if(!d._fireDetected[roomId]){
          d._fireDetectT[roomId]=(d._fireDetectT[roomId]??ROOMS[roomId].detectionDelay)-dt;
          const newFire=clamp(fire+growRate*dt,0,1.0);
          d.fire[roomId]=newFire;
          if(d._fireDetectT[roomId]<=0) _triggerFireDetection(roomId,section,d);
          continue; // doesn't contribute to F until detected
        }
        // Detected — suppression applies
        const jitter=(Math.random()-0.5)*0.004;
        const newFire=clamp(fire+(growRate-totalSuppress+jitter)*dt,0,1.0);
        d.fire[roomId]=newFire;
        F=Math.max(F,newFire);
        if(newFire<=0) _extinguishFire(roomId,d,dcTeam?'dc':'watch');
      }

      if(!anyRoomFire&&!watch) continue;

      // ── Section-level logic (uses F = max detected fire) ──────────────

      // Watchkeeper casualties
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
              COMMS.fire.watchkeeperCasualty(victim.name,COMP_DEF[section].label,victim.status);
              _alert(`FIRE CASUALTY — ${COMP_DEF[section].label}`);
            }
            if(watch.count===0) COMMS.fire.watchkeeperOvercome(COMP_DEF[section].label);
          }
        }
      }

      // DC team relieves watchkeepers on arrival
      if(dcTeam&&watchCount>0){
        const fighters=(d.crew[section]||[]).filter(cr=>cr.status==='fit'&&!cr.displaced);
        for(const cr of fighters) cr.displaced=true;
        d._fireWatch[section]={ count:0,t:0,lastCasCheck:0,_outOfControlFired:watch?._outOfControlFired||false };
        COMMS.fire.dcRelief(COMP_DEF[section].label);
      }

      // System heat damage
      if(F>0.30){
        const heatChance=(F-0.30)*0.002*dt;
        if(Math.random()<heatChance){
          const damageable=COMP_DEF[section].systems.filter(s=>d.systems[s]!=='destroyed');
          if(damageable.length>0){
            const sys=damageable[Math.floor(Math.random()*damageable.length)];
            const newState=damageSystem(sys,1);
            COMMS.fire.heatDamage(SYS_LABEL[sys],newState,COMP_DEF[section].label);
            _alert(`HEAT DAMAGE — ${SYS_LABEL[sys]}`);
          }
        }
      }

      // Out of control
      if(watch&&!watch._outOfControlFired&&F>0.70){
        watch._outOfControlFired=true;
        COMMS.fire.outOfControl(COMP_DEF[section].label);
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
              t.task==='drench_pending'&&t.location===section);
            if(drenchTeam){ drenchTeam.state='ready'; drenchTeam.task=null; drenchTeam.location=null; }
            delete d._fireDrenchPending[section];
            _nitrogenDrench(section,d,null);
          }
        } else if(dcTeam){
          if(!dcTeam._fireLosing) dcTeam._fireLosing=0;
          const growRate=FIRE_BASE_GROW+F*FIRE_SCALE_GROW;
          if(F>DRENCH_THRESH&&growRate>totalSuppress) dcTeam._fireLosing+=dt;
          else dcTeam._fireLosing=0;
          if(dcTeam._fireLosing>=DRENCH_LOSE_TIME){
            if(!d._fireDrenchPending) d._fireDrenchPending={};
            d._fireDrenchPending[section]={t:20};
            dcTeam.task='drench_pending';
            dcTeam._fireLosing=0;
            COMMS.fire.drenchInitiated(COMP_DEF[section].label);
          }
        }
      }

      // Cascade to adjacent section
      if(F>0.85){
        const cascadeChance=(F-0.85)/0.15*0.012*dt;
        if(Math.random()<cascadeChance){
          const adj=EVAC_TO[section]||[];
          const targetSection=adj.find(s=>_sectionFire(s,d)<0.05&&!d.flooded[s]&&!d._fireDrench?.[s]);
          if(targetSection){
            const targetRooms=SECTION_ROOMS[targetSection]||[];
            const targetRoom=targetRooms[Math.floor(Math.random()*targetRooms.length)];
            COMMS.fire.cascade(COMP_DEF[section].label,COMP_DEF[targetSection].label);
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

    // Progressive flooding
    for(const comp of COMPS){
      if(d.flooded[comp]) continue;
      const rate=d.floodRate[comp]||0;
      if(rate>0){
        d.flooding[comp]=Math.min(1,(d.flooding[comp]||0)+rate*_pressureMult*dt);
        // Crew evacuation trigger — only on breach floods, not depth seeps
        const isSeep = (d._seepComp||{})[comp];
        if(!isSeep && d.flooding[comp]>=0.65&&!(d._evacuated||{})[comp]){
          if(!d._evacuated) d._evacuated={};
          d._evacuated[comp]=true;
          const neighbors=EVAC_TO[comp]||[];
          const compCrew=(d.crew[comp]||[]).filter(cr=>cr.status==='fit'||cr.status==='wounded');
          let evacuated=0,trapped=0;
          for(const cr of compCrew){
            // 80% chance per crew to make it out if a neighbour isn't also flooded
            const openNeighbour=neighbors.find(n=>!d.flooded[n]);
            if(openNeighbour&&Math.random()<0.80){
              cr.displaced=true;  // alive but out of compartment
              evacuated++;
            } else {
              cr.status='killed';
              trapped++;
            }
          }
          if(evacuated>0||trapped>0){
            _alert('CREW EVACUATING '+COMP_DEF[comp].label.toUpperCase());
            COMMS.flood.evacuating(COMP_DEF[comp].label, COMP_STATION[comp]||'ENG', evacuated, trapped);
          }
        }
        // Compartment fully flooded?
        if(d.flooding[comp]>=1.0){
          d.flooded[comp]=true;
          d.floodRate[comp]=0;
          // Systems waterlogged but not destroyed — repairable after blow-down
          for(const sys of COMP_DEF[comp].systems){
            if(d.systems[sys]!=='destroyed') d.systems[sys]='offline';
          }
          const lost=_floodComp(comp);
          // DC teams: on_scene → evac roll; transit → keep going, will blow on arrival
          // Mark all surviving compartment crew as displaced
          if(!d._evacuated) d._evacuated={};
          d._evacuated[comp]=true;
          for(const cr of (d.crew[comp]||[])){
            if(cr.status!=='killed') cr.displaced=true;
          }
          for(const team of Object.values(d.teams)){
            if(team.state==='on_scene'&&team.location===comp){
              if(Math.random()<0.75){
                team.state='ready'; team.task=null;
                _woundDcTeamMember(team, d);
                dcLog(`${team.label} — EVACUATED ${COMP_DEF[comp].label}. Casualties taken`);
              } else {
                team.state='lost';
                COMMS.dc.teamLost(team.label, COMP_DEF[comp].label);
              }
            }
            // Transit teams continue to destination and will start HP blow
          }
          _alert(`${COMP_DEF[comp].label} FLOODED`);
          COMMS.flood.uncontrolled(COMP_DEF[comp].label, COMP_STATION[comp]||'ENG', lost);
          if(comp==='reactor_comp'&&!player.scram&&typeof window.G.triggerScram==='function'){
            window.G.triggerScram('damage');
            COMMS.flood.reactorFlooded();
          }
          d.strikes[comp]=2;
          _checkSinking();
        }
      } else if((d.flooding[comp]||0)>0&&rate===0){
        // Drain very slowly when rate=0 (bilge pumps)
        d.flooding[comp]=Math.max(0,(d.flooding[comp]||0)-0.012*dt);
        if(d.flooding[comp]<=0) _returnCrew(comp,d);
      }
    }

    // DC teams then fire (teams set task='fire' on arrival, fire tick reads it)
    _tickTeams(dt,d);
    _tickFire(dt,d);
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
    if(sys.reactor==='offline'||sys.reactor==='destroyed') speedCap=Math.min(speedCap,7);
    let sonarRangeMult=1.0;
    if(sys.sonar_hull==='offline'||sys.sonar_hull==='destroyed') sonarRangeMult=0.0;
    else if(sys.sonar_hull==='degraded') sonarRangeMult=0.55;
    let bearingNoiseMult=1.0;
    if(sys.sonar_hull==='degraded') bearingNoiseMult=2.5;
    else if(sys.sonar_hull==='offline'||sys.sonar_hull==='destroyed') bearingNoiseMult=5.0;
    let reloadMult=1.0;
    if(sys.tubes==='degraded') reloadMult=1.5;
    else if(sys.tubes==='offline') reloadMult=3.0;
    else if(sys.tubes==='destroyed') reloadMult=999;
    reloadMult*=(1+(1-crewEfficiency('weapons'))*0.6);
    let depthRateMult=1.0;
    if(sys.ballast==='degraded') depthRateMult=0.55;
    else if(sys.ballast==='offline'||sys.ballast==='destroyed') depthRateMult=0.18;
    // HP air blow: loud compressors — significant continuous noise penalty
    const blowingTeams=Object.values(d.teams||{}).filter(t=>t.state==='blowing').length;
    const blowNoise=blowingTeams*0.40;
    const noisePenalty=Math.min(0.65, totalFlood*0.10 + blowNoise);
    let tdcErrDeg=0;
    if(sys.tdc_comp==='degraded') tdcErrDeg=4;
    else if(sys.tdc_comp==='offline'||sys.tdc_comp==='destroyed') tdcErrDeg=10;
    let tubesAvail=C.player.torpTubes||4;
    if(sys.tubes==='destroyed') tubesAvail=Math.max(0,tubesAvail-2);
    else if(sys.tubes==='offline') tubesAvail=Math.max(1,tubesAvail-1);
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
    const maxDepth=integ<0.35?120:integ<0.55?250:(C.world?.maxDepth||500);
    // ── Control room status ────────────────────────────────────────────────
    // Evacuated (≥65% flood) OR fully flooded OR fire present = conn room lost
    const connRoomLost = !!(d._evacuated?.control_room || d.flooded?.control_room || _sectionHasFire('control_room',d));
    // When conn is lost, depth changes require manual valve ops — much slower
    if(connRoomLost) depthRateMult = Math.min(depthRateMult, 0.20);
    // Plane hydraulics — determines operating mode for each set of planes
    // fwd: hydraulic plant in fore_ends; control from control_room (helm position)
    // aft: hydraulic plant in engine_room; fallback control at Manoeuvring
    const fwdHyd  = sys.planes_fwd_hyd || 'nominal';
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
    return {speedCap,sonarRangeMult,bearingNoiseMult,reloadMult,depthRateMult,noisePenalty,tdcErrDeg,tubesAvail,towedOk,periscopeOk,maxDepth,totalFlood,fwdPlaneMode,aftPlaneMode,aftCtrlTransferred,connRoomLost,crashDiveAvail:!connRoomLost,silentRunAvail:!connRoomLost,steeringMult,steeringOk,fireLevel,anyFire};
  }
  function _defaults(){
    return {speedCap:Infinity,sonarRangeMult:1.0,bearingNoiseMult:1.0,reloadMult:1.0,depthRateMult:1.0,noisePenalty:0,tdcErrDeg:0,tubesAvail:C.player.torpTubes||4,towedOk:true,periscopeOk:true,maxDepth:C.world?.maxDepth||500,totalFlood:0,fwdPlaneMode:'hydraulic',aftPlaneMode:'hydraulic',aftCtrlTransferred:false,connRoomLost:false,crashDiveAvail:true,silentRunAvail:true,steeringMult:1.0,steeringOk:true};
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

  window.DMG={
    initDamage,hit,tick,applyHullStress,applyDepthCascade,resetDepthCascade,_escapeHalt,
    sealFlooding,igniteFire,getEffects,maxDCTeams,crewEfficiency,
    totalFit,totalWounded,totalKilled,totalCrew,
    assignTeam,recallTeam,teamAtComp,
    initiateEscape,canTCE,
    getTrimState,drawHPA,
    COMP_DEF,COMPS,STATES,SYS_LABEL,ROOMS,ROOM_IDS,SECTION_ROOMS,
    COMP_SYSTEMS:Object.fromEntries(Object.entries(COMP_DEF).map(([k,v])=>[k,v.systems])),
    COMPARTMENTS:COMPS,
    CREW_MANIFEST,
  };
  } catch(e) { console.error("DAMAGE.JS THREW:", e.message, e.stack); }
})();