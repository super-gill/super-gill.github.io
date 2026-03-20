'use strict';

import { CONFIG } from '../../config/constants.js';
import { rand, clamp } from '../../utils/math.js';
import { player, world, queueLog, triggerScram } from '../../state/sim-state.js';
import { session, setMsg, addLog, setCasualtyState, setTacticalState } from '../../state/session-state.js';
import { dcLog, COMP_STATION } from '../../narrative/comms.js';

// ── Sub-module imports ────────────────────────────────────────────────────
import {
  COMPS, COMP_DEF, ROOMS, ROOM_IDS, SECTION_ROOMS, SECTION_LABEL, SECTION_SHORT,
  SYS_DEF, SYS_LABEL, ALL_SYS, STATES, REPAIR_TIME, TRAVEL, HIGH_ENERGY_SYS,
  WTD_PAIRS, WTD_RC_KEYS, ROOM_ADJ, SECTION_SYSTEMS, DIESEL_SECTION_SYSTEMS,
  ROOM_SYSTEMS, EVAC_TO, SECTION_CAP,
  activeSystems, compLabel, roomSection, _sectionNoEvac,
} from './damage-data.js';

import {
  CREW_MANIFEST, buildCrewManifest, relocateCrewForWatch,
  totalFit, totalWounded, totalKilled, totalCrew, crewEfficiency, maxDCTeams,
} from './crew-roster.js';

import {
  _injureComp, _woundDcTeamMember, _findCrewById,
  _nextCasualty, _nextCasualtyComp, _tickMedical,
  _setCasualtyComms, _setDcLogFn,
} from './casualty.js';

import {
  _wtdTransitPenalty, _wtdFloodSpread,
  _emergencyCloseWTDs, _emergencyOpenWTDs,
  _tickWTDAutoOpen, _tickWTDAutoClose,
  toggleWTD, _floodComp, hitCompartment, canReachTower,
  _checkSinking, sealFlooding,
  applyDepthCascade, resetDepthCascade, applyHullStress,
  _setFloodingComms, _setFloodingPanel, _setFloodingHelpers,
} from './flooding.js';

import {
  igniteFire, _sectionFire, _sectionHasFire,
  _extinguishFire, _nitrogenDrench, _tickDrench, _tickFire,
  manualDrench, ventN2,
  _setFiresComms, _setFiresPanel, _setFiresHelpers, _setAssignTeamFn,
} from './fires.js';

import {
  _teamEffectiveness, teamAtComp,
  assignTeam, recallTeam,
  _canReachComp, _bestDCTarget, _triggerEmergencyMuster,
  _autoDispatchDC, _tickTeams,
  _setDcTeamsComms, _setDcTeamsHelpers,
} from './dc-teams.js';

import {
  effectiveState, getEffects, getTrimState, drawHPA,
  _setEffectsComms,
} from './effects.js';

const C = CONFIG;

// ── Lazy COMMS binding ────────────────────────────────────────────────────
let _COMMS = null;
export function _bindDamage(deps) {
  if(deps.COMMS){
    _COMMS=deps.COMMS;
    _setCasualtyComms(deps.COMMS);
    _setFloodingComms(deps.COMMS);
    _setFiresComms(deps.COMMS);
    _setDcTeamsComms(deps.COMMS);
    _setEffectsComms(deps.COMMS);
  }
}

// ── Lazy PANEL binding ────────────────────────────────────────────────────
let _PANEL = null;
export function _bindDamagePanel(deps) {
  if(deps.PANEL){
    _PANEL=deps.PANEL;
    _setFloodingPanel(deps.PANEL);
    _setFiresPanel(deps.PANEL);
  }
}

// ── Lazy _broadcastTransient binding ──────────────────────────────────────
let _broadcastTransient = null;
export function _bindDamageBroadcast(deps) { if(deps.broadcastTransient) _broadcastTransient=deps.broadcastTransient; }

// ── Set up dcLog for casualty module ──────────────────────────────────────
_setDcLogFn(dcLog);

// ── Alert helper ──────────────────────────────────────────────────────────
function _alert(text){ player.damage.alerts.push({text,t:5.0}); }

// ── System helpers ────────────────────────────────────────────────────────
function stateIndex(sys){ return STATES.indexOf(player.damage.systems[sys]); }
function damageSystem(sys,steps=1){
  const d=player.damage;
  const next=Math.min(stateIndex(sys)+steps,STATES.length-1);
  d.systems[sys]=STATES[next];
  // Primary coolant loss → automatic SCRAM
  if(sys==='primary_coolant'&&next>=2&&!player.scram&&typeof triggerScram==='function'){
    triggerScram('coolant');
    _COMMS?.reactor.scram('coolant');
  }
  return STATES[next];
}


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
  if(cause==='fire') _COMMS?.fire.crewReturn(SECTION_LABEL[comp], COMP_STATION[comp]||'ENG', returnees.length);
  else               _COMMS?.flood.crewReturn(SECTION_LABEL[comp], COMP_STATION[comp]||'ENG', returnees.length);
}

// ── Shared casualty-state clear check ────────────────────────────────────
// Called after any event that could end the emergency (fire out, vent complete, etc.)
function _checkClearEmergency(d){
  if(session?.casualtyState!=='emergency') return;
  const anyFire=ROOM_IDS.some(rid=>(d.fire[rid]||0)>0.01);
  const anyFlood=COMPS.some(s=>(d.flooding[s]||0)>0.001);
  const anyTeamActive=Object.values(d.teams).some(t=>t.state!=='ready'&&t.state!=='lost');
  // Drenched compartments require venting before the emergency is truly controlled
  const anyDrenched=COMPS.some(s=>(d._fireDrench?.[s]?.level??0)>0);
  if(!anyFire&&!anyFlood&&!anyTeamActive&&!anyDrenched){
    setCasualtyState('normal');
    d._emergMusterFired=false;
    for(const t of Object.values(d.teams)){ t._autoMode=false; t._readyT=0; }
    const hadFlood=COMPS.some(s=>(d.flooded[s]||d.strikes[s]>0));
    _COMMS?.crewState.casualtyControlled(hadFlood?'flood':'fire');
    _emergencyOpenWTDs(d);
  }
}

// ── Wire up cross-module helpers ──────────────────────────────────────────
_setFloodingHelpers({ _alert, damageSystem, stateIndex, _floodComp });
_setFiresHelpers({
  _alert, damageSystem, _returnCrew, _checkClearEmergency,
  _teamEffectiveness, _woundDcTeamMember: _woundDcTeamMember, _canReachComp,
});
_setDcTeamsHelpers({
  _alert, _returnCrew, _checkClearEmergency,
  _woundDcTeamMember, _sectionHasFire, _sectionFire, _wtdTransitPenalty,
});
_setAssignTeamFn(assignTeam);

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

    // Hydraulic pressure — 1.0 = full, 0.0 = empty
    hydPressure: 1.0,

    // Stuck diving planes — null when inactive
    stuckPlanes: null,  // { set:'fwd'|'aft', direction:'dive'|'rise'|'neutral', recoveryT, recovered }

    // Shaft seal leak — permanent speed-dependent flooding
    shaftSealLeak: false,

    // Snorkel flooding (Type 209 only)
    snorkelFloodActive: false,
    _snorkelFloodSeverity: null,  // 'minor'|'major'|'catastrophic'
    _snorkelValveT: 0,

    // Chlorine gas level (Type 209 only) — 0-1 scale
    cl2Level: 0,

    // Hot run torpedo — countdown timer and affected tube
    hotRunCountdown: null,
    hotRunTube: null,

    // Hydrogen level — 0-1 scale (all vessels)
    h2Level: 0,

    // Permanent damage — systems that cannot be repaired at sea
    permanentDamage: new Set(),


    // Watertight Doors — 5 doors between adjacent sections, all open at start
    wtd: Object.fromEntries(WTD_PAIRS.map(([a,b])=>[a+'|'+b,'open'])),
    _wtdSpreadAlerted:{},  // comp -> true once watchkeepers have reported WTD ingress
  };
  session.dcLog=[];
  session.showDcPanel=false;
}

// ── Next damaged system to repair in a compartment (auto-priority) ────────
function _nextRepairTarget(comp,d){
  const sysList=activeSystems(comp);
  // Priority: worst state first. Skip nominal AND permanently damaged systems.
  const repairable=sysList
    .filter(s=>d.systems[s]!=='nominal' && !d.permanentDamage?.has(s))
    .sort((a,b)=>stateIndex(b)-stateIndex(a));
  return repairable[0]||null;
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
  session.hitFlash=0.8;

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
          _COMMS?.dc.teamEvacuated(team.label, SECTION_LABEL[comp]);
        } else {
          team.state='lost';
          _COMMS?.dc.teamLost(team.label, SECTION_LABEL[comp]);
        }
      }
    }

    _alert(`${SECTION_LABEL[comp]} — SECOND BREACH`);
    _COMMS?.flood.secondBreach(SECTION_LABEL[comp], COMP_STATION[comp]||'ENG');
    if(comp==='reactor_comp'&&!player.scram&&typeof triggerScram==='function'){
      triggerScram('damage');
      _COMMS?.reactor.scram('damage');
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
      _COMMS?.sys.damaged(SYS_LABEL[sysList[i]], st, 1.5+i*0.6);
      if(sysList[i]==='steering' && st!=='nominal') _COMMS?.nav.steeringCasualty(st);
      if(sysList[i]==='reactor') reactorHit=true;
    }
    if(reactorHit&&!player.scram){
      if(typeof triggerScram==='function') triggerScram('damage');
      _COMMS?.reactor.scram('damage');
    }
    const cas=_injureComp(comp,severity);
    if(cas.killed>0||cas.wounded>0){
      _alert(`CASUALTIES — ${cas.killed} KIA${cas.wounded>0?`, ${cas.wounded} WND`:''}`);
      _COMMS?.sys.casualties(cas.killed, cas.wounded, SECTION_LABEL[comp]);
    }
    if(cas.wounded>0) _COMMS?.medical.casualtyCallOut(SECTION_LABEL[comp]);
    if(def.tower&&severity>0.7&&rand(0,1)>0.6&&d.towers[def.tower]==='nominal'){
      d.towers[def.tower]='damaged';
      _alert(`ESCAPE TOWER ${def.tower.toUpperCase()} DAMAGED`);
    }
    // Hot run — combat hit to fore_ends, severity > 0.30, loaded tube
    if(comp==='fore_ends' && severity > 0.30 && d.hotRunCountdown==null){
      const hrCfg = C.player.casualties?.hotRun || {};
      const loadedTubes = (player.torpTubes||[]).map((v,i)=>({v,i})).filter(t=>t.v===0);
      if(loadedTubes.length > 0 && Math.random() < (hrCfg.combatChance||0.06)){
        const tube = loadedTubes[Math.floor(Math.random()*loadedTubes.length)].i;
        d.hotRunCountdown = hrCfg.countdown || 12;
        d.hotRunTube = tube;
        player.torpTubes[tube] = -2; // locked — cannot fire
        _COMMS?.hotRun?.detected(tube+1);
      }
    }

    // Snorkel flood — combat hit while snorkelling (diesel only)
    // Sets flag; tickSnorkelFlood in casualty-ticks.js resolves severity on next frame
    if(C.player.isDiesel && player.snorkelling && !d.snorkelFloodActive){
      if(Math.random() < (C.player.casualties?.snorkelFlood?.combatChance || 0.30)){
        d._snorkelFloodPending = true;  // picked up by tickSnorkelFlood
      }
    }

    // Hydrogen combat ignition — hit to engine_room when h2Level >= danger
    if(comp==='engine_room' && (d.h2Level||0) >= (C.player.casualties?.hydrogen?.dangerLevel||0.50)){
      if(Math.random() < (C.player.casualties?.hydrogen?.combatHitIgnition||0.40)){
        // Detonation handled by tickHydrogen's _detonateHydrogen — set h2Level to explosive to trigger next tick
        d.h2Level = 1.0;
      }
    }

    // Shaft seal — combat hit to aft_ends when shaft_seals degraded+
    if(comp==='aft_ends' && !d.shaftSealLeak){
      const sealState = STATES.indexOf(d.systems.shaft_seals||'nominal');
      if(sealState >= 1 && Math.random() < (C.player.casualties?.shaftSeal?.combatChance||0.25)){
        d.shaftSealLeak = true;
        _COMMS?.shaftSeal?.activated();
      }
    }

    // Stuck planes — combat damage to planes hydraulics
    if(!d.stuckPlanes){
      const spCfg=C.player.casualties?.stuckPlanes||{};
      for(const planesSys of ['planes_fwd_hyd','planes_aft_hyd']){
        const pState=d.systems[planesSys];
        if((pState==='offline'||pState==='destroyed') && Math.random()<(spCfg.combatChance||0.20)){
          const set=planesSys==='planes_fwd_hyd'?'fwd':'aft';
          const dir=player.vy>0.5?'dive':player.vy<-0.5?'rise':'neutral';
          d.stuckPlanes={set, direction:dir,
            recoveryT:rand(spCfg.recoveryTime?.[0]||25, spCfg.recoveryTime?.[1]||40),
            recovered:false};
          _COMMS?.planes?.stuckPlanes?.(set, dir);
          break;
        }
      }
    }

    // Hydraulic pressure — combat hit to control_room when hyd_main already damaged
    if(comp==='control_room'){
      const hydIdx=STATES.indexOf(d.systems.hyd_main||'nominal');
      if(hydIdx>=1){
        const hydCfg=C.player.casualties?.hydraulic||{};
        d.hydPressure=Math.max(0, (d.hydPressure??1.0) - (hydCfg.combatPressureLoss||0.20));
      }
    }

    // Fire ignition — higher severity hits have a chance of starting a fire
    if(severity>0.35){
      const fireChance=(severity-0.35)/0.65*0.55;
      if(Math.random()<fireChance) igniteFire(comp, severity*0.12);
    }

    // Estimate time to flood without DC — account for current depth pressure
    const _bDepthM=Math.max(0,(player.depth||0)-(world?.seaLevel||0));
    const _bPMult=1+Math.min(_bDepthM/120,4);
    const tFlood=d.floodRate[comp]>0?Math.round(1/(d.floodRate[comp]*_bPMult)):999;
    const urgency=tFlood<60?'CRITICAL — ':tFlood<120?'URGENT — ':'';
    setCasualtyState('emergency');
    _COMMS?.flood.firstHit(SECTION_LABEL[comp], COMP_STATION[comp]||'ENG', urgency, tFlood);
    _COMMS?.flood.closeWTDs(SECTION_LABEL[comp]);
    _emergencyCloseWTDs(d);
  }

  // ── Propulsion casualties from shock / system damage ────────────────
  const cas=C.player.casualties||{};
  // Turbine trip — shock from any hit can trip the turbines
  if(!player._turbineTrip && !player.scram && !player._steamLeak){
    const tripCfg=cas.turbineTrip||{};
    if(Math.random() < (tripCfg.shockChance||0.15)){
      player._turbineTrip={ timer:rand(tripCfg.recoveryTime?.[0]||20, tripCfg.recoveryTime?.[1]||30) };
      _COMMS?.reactor.turbineTrip();
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
      _COMMS?.reactor.steamLeak();
    }
  }

  // Reactor runaway — severe hit to reactor or primary_coolant
  if(!player.scram && severity>0.6){
    const raCfg=cas.reactorRunaway||{};
    const hitReactor=comp==='reactor_comp'; // reactor comp hit = reactor systems at risk
    if(hitReactor && Math.random()<(raCfg.hitChance||0.08)){
      // Loud acoustic transient
      if(typeof _broadcastTransient==='function'){
        _broadcastTransient(player.wx, player.wy, raCfg.transientRange||3000, raCfg.transientSus||0.6, null);
      }
      _COMMS?.reactor.reactorRunaway();
      triggerScram('runaway');
      // Clear other propulsion casualties — SCRAM overrides
      player._turbineTrip=null;
      player._steamLeak=null;
      player._coolantLeak=null;
    }
  }

  player.hp=Math.max(1,100-Object.values(d.strikes).reduce((a,b)=>a+b,0)*35);
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
  const p = player;
  if(p){ p.speedOrderKts=0; p.speedDir=0; p.depthOrder=0; }
  _PANEL?.snapToAllStop();
  // Emergency blow is a commanded action — player retains that decision.

  // CO's final log entry — contextual, factual, one line of humanity at the end
  const d=p?.damage;
  const depth=Math.round(p?.depth??0);
  const COMP_NAMES={fore_ends:'torpedo room',control_room:'control room',aux_section:'aux machinery',reactor_comp:'reactor',engine_room:'engine room',aft_ends:'aft ends'};
  const floodedComps=d?['fore_ends','control_room','aux_section','reactor_comp','engine_room','aft_ends'].filter(cp=>d.flooded[cp]).map(cp=>COMP_NAMES[cp]):[];
  const floodStr=floodedComps.length===0?'structural failure'
    :floodedComps.length===1?`flooding in ${floodedComps[0]}`
    :`flooding in ${floodedComps.slice(0,-1).join(', ')} and ${floodedComps[floodedComps.length-1]}`;
  const fit=totalFit()??'?';
  const total=totalCrew()??'?';
  const spd=Math.round(p?.speed??0);
  const trimNote=spd<=1?'no way on':spd<=5?'slow ahead':'making way';
  const closers=['Good luck to you all.','It has been an honour.','God speed.','That will be all.'];
  const closer=closers[Math.floor((session?.missionT??0)*7+depth)%closers.length];
  addLog('CONN',
    `CO — ${floodStr}, depth ${depth}m, ${trimNote}. ${fit} of ${total} hands fit. All hands, abandon ship. ${closer}`,
    _COMMS?.P.CRIT
  );
}

function initiateEscape(type){
  const d=player.damage; if(!d||d.escapeState) return;
  if(type==='tce'&&!canTCE()){_COMMS?.escape.tceNotViable();return;}
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
    setCasualtyState('escape');
    _escapeHalt();
    _COMMS?.escape.tce();
  } else {
    d.escapeState='rush_running';
    d.escapeT=12;
    setCasualtyState('escape');
    _escapeHalt();
    _COMMS?.escape.rush();
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
  session.over=true;
  session.escapeResolved=true;
}

// ── Main tick ─────────────────────────────────────────────────────────────
function tick(dt){
  const d=player.damage; if(!d) return;

  // Depth-pressure multiplier: flood rate scales with ambient pressure.
  // 1× at surface, +1× per 120m — caps at 5× (~480m). DC teams fight
  // the base rate, but water ingress is driven by the effective rate.
  // This means at depth, DC can slow but not stop a serious breach —
  // forcing the emergency blow decision.
  const _depthMVal=Math.max(0,(player.depth||0)-(world?.seaLevel||0));
  const _pressureMult=1+Math.min(_depthMVal/120, 4);

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
        if((ROOMS[SYS_DEF[sys].room]?.deck??1)===2){ const st=damageSystem(sys); _COMMS?.sys.damaged(SYS_LABEL[sys],st,0.5); }
      }
    }
    if(fl>=0.67&&!_ddmg[1]){                      // D2 (middle) submerged
      _ddmg[1]=true;
      for(const sys of activeSystems(comp)){
        if((ROOMS[SYS_DEF[sys].room]?.deck??1)===1){ const st=damageSystem(sys); _COMMS?.sys.damaged(SYS_LABEL[sys],st,0.5); }
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
        _COMMS?.flood.evacuating(SECTION_LABEL[comp], COMP_STATION[comp]||'ENG', evacuated, trapped);
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
            _COMMS?.dc.teamLost(team.label, SECTION_LABEL[comp]||comp);
          }
        }
      }
      _alert(`${SECTION_LABEL[comp]} FLOODED`);
      _COMMS?.flood.uncontrolled(SECTION_LABEL[comp], COMP_STATION[comp]||'ENG', lost);
      if(comp==='reactor_comp'&&!player.scram&&typeof triggerScram==='function'){
        triggerScram('damage');
        _COMMS?.flood.reactorFlooded();
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
        addLog('CONN',
          `Escape — ${d.escapeSurvivors} away. ${remaining} remaining at towers.`,
          _COMMS?.P.MED
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
      addLog('CONN',
        `Escape — hands in the water. ${total} attempting escape.`,
        _COMMS?.P.MED
      );
    }
    if(d.escapeT<=0) _resolveEscape();
  }
}

export const DMG = {
  initDamage,hit,tick,applyHullStress,applyDepthCascade,resetDepthCascade,_escapeHalt,
  sealFlooding,igniteFire,getEffects,maxDCTeams,crewEfficiency,
  totalFit,totalWounded,totalKilled,totalCrew,
  assignTeam,recallTeam,teamAtComp,
  manualDrench,ventN2,
  initiateEscape,canTCE,
  getTrimState,drawHPA,
  toggleWTD,
  relocateCrewForWatch:(watch)=>relocateCrewForWatch(player.damage,watch),
  COMP_DEF,COMPS,STATES,SYS_LABEL,SYS_DEF,ROOMS,ROOM_IDS,SECTION_ROOMS,ROOM_ADJ,SECTION_SYSTEMS,DIESEL_SECTION_SYSTEMS,activeSystems,ROOM_SYSTEMS,WTD_PAIRS,WTD_RC_KEYS,
  SECTION_LABEL,SECTION_SHORT,roomSection,effectiveState,
  COMPARTMENTS:COMPS,
  CREW_MANIFEST,
};
