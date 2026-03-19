'use strict';

import { COMPS, COMP_DEF } from './damage-data.js';
import { player } from '../../state/sim-state.js';
import { clamp } from '../../utils/math.js';

// ── Static crew manifest ──────────────────────────────────────────────────
// 90 named crew. role=short display label. roleDesc=full tooltip.
// watch: 'A'|'B'|'duty'. dcTeam: 'alpha'|'bravo'|null.
// dept: derived in buildCrewManifest; explicit on medical/supply entries.
export const CREW_MANIFEST = [
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

export function buildCrewManifest(){
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
export function relocateCrewForWatch(d, activeWatch){
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

// ── Crew helpers ──────────────────────────────────────────────────────────
export function totalFit(){
  if(!player.damage) return 0;
  return COMPS.reduce((a,c)=>a+(player.damage.crew[c]||[]).filter(x=>x.status==='fit').length,0);
}
export function totalWounded(){
  if(!player.damage) return 0;
  return COMPS.reduce((a,c)=>a+(player.damage.crew[c]||[]).filter(x=>x.status==='wounded').length,0);
}
export function totalKilled(){
  if(!player.damage) return 0;
  return COMPS.reduce((a,c)=>a+(player.damage.crew[c]||[]).filter(x=>x.status==='killed').length,0);
}
export function totalCrew(){ return player.damage?.crewTotal||90; }

export function crewEfficiency(dept){
  const fit=totalFit(),total=totalCrew();
  if(total===0) return 0;
  return clamp(fit/total,0,1.0);
}
export function maxDCTeams(){
  return Object.values(player.damage?.teams||{}).filter(t=>t.state!=='lost').length;
}
