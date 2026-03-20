'use strict';

import {
  COMPS, COMP_DEF, ROOMS, SECTION_ROOMS, SECTION_LABEL,
  WTD_PAIRS, WTD_RC_KEYS, SYS_DEF, SYS_LABEL, STATES,
  SEEP_RATE, SEEP_DELAY_MIN, SEEP_DELAY_MAX,
  activeSystems, compLabel, roomSection,
} from './damage-data.js';
import { player, world, triggerScram } from '../../state/sim-state.js';
import { session, setCasualtyState } from '../../state/session-state.js';
import { rand } from '../../utils/math.js';
import { dcLog, COMP_STATION } from '../../narrative/comms.js';

// ── Lazy bindings (set from index.js) ─────────────────────────────────────
let _COMMS = null, _PANEL = null;
export function _setFloodingComms(comms) { _COMMS = comms; }
export function _setFloodingPanel(panel) { _PANEL = panel; }

// ── Shared helpers imported from index.js ─────────────────────────────────
let _alertFn = null, _damageSystemFn = null, _stateIndexFn = null, _floodCompFn = null;
export function _setFloodingHelpers(helpers) {
  _alertFn = helpers._alert;
  _damageSystemFn = helpers.damageSystem;
  _stateIndexFn = helpers.stateIndex;
  _floodCompFn = helpers._floodComp;
}

function _alert(text) { _alertFn?.(text); }
function damageSystem(sys, steps) { return _damageSystemFn?.(sys, steps); }

// ── WTD helpers ───────────────────────────────────────────────────────────
// Hydraulic pressure check — WTDs require sufficient pressure to operate.
// Below failThreshold (0.30) = cannot open/close. Below sluggishThreshold = slow.
function _hydMainOk(d){
  const hydP = d.hydPressure ?? 1.0;
  return hydP >= 0.30;  // matches hydraulic.failThreshold
}

export function _wtdTransitPenalty(from, to, d){
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

export function _wtdFloodSpread(dt, d, pressureMult){
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
        setCasualtyState?.('emergency');
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
export function _emergencyCloseWTDs(d){
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
    if(info) _COMMS?.flood.wtdClosed(info.station, info.door, delay);
  }
}

// Reopen all auto-closed WTDs after the flooding emergency is controlled
export function _emergencyOpenWTDs(d){
  if(!d.wtd||!d._wtdAutoClosedKeys?.size) return;
  if(!d._wtdAutoOpen) d._wtdAutoOpen=[];
  _COMMS?.flood.openWTDs();
  for(const key of d._wtdAutoClosedKeys){
    if((d.wtd[key]||'open')!=='closed') continue;
    const delay=4.0+Math.random()*16.0; // 4–20 s, independent per door
    d._wtdAutoOpen.push({key, t: delay-0.5});
    const info=_WTD_COMMS[key];
    if(info) _COMMS?.flood.wtdOpen(info.station, info.door, delay);
  }
  d._wtdAutoClosedKeys.clear();
}

// Tick pending emergency WTD openings (physically opens each door on schedule)
export function _tickWTDAutoOpen(dt, d){
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
export function _tickWTDAutoClose(dt, d){
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
export function toggleWTD(sectionA, sectionB){
  const d=player.damage; if(!d) return;
  const key=sectionA+'|'+sectionB;
  if(!Object.prototype.hasOwnProperty.call(d.wtd, key)) return;
  if(!_hydMainOk(d)){
    dcLog('WTD — HYDRAULIC PRESSURE TOO LOW — DOOR CANNOT BE OPERATED');
    return;
  }
  const cur=d.wtd[key];
  const next=cur==='open'?'closed':'open';
  d.wtd[key]=next;
  const hydP = d.hydPressure ?? 1.0;
  const isSluggish = hydP < 0.60;
  const labA=compLabel(sectionA);
  const labB=compLabel(sectionB);
  dcLog(`WTD ${labA}/${labB} — ${next.toUpperCase()}${isSluggish?' (SLUGGISH — LOW HYD PRESSURE)':''}`);
}

export function _floodComp(comp){
  const d=player.damage; let lost=0;
  for(const c of (d.crew[comp]||[])){ if(c.status!=='killed'&&!c.displaced){c.status='killed';lost++;} }
  return lost;
}

// ── Hit compartment from impact angle ─────────────────────────────────────
export function hitCompartment(hitX,hitY){
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
export function canReachTower(comp,tower,d){
  const fwd=['fore_ends','control_room','aux_section'];
  const aft=['engine_room','aft_ends'];
  const blocked=d.flooded.reactor_comp||d.flooded.aux_section;
  if(tower==='fwd'){ if(fwd.includes(comp)) return true; return !blocked; }
  if(tower==='aft'){ if(aft.includes(comp)) return true; return !blocked; }
  return false;
}

// ── Sinking check ─────────────────────────────────────────────────────────
export function _checkSinking(){
  if(session?.godMode) return;
  const d=player.damage;
  const fl=d.flooded;
  const flCount=COMPS.filter(c=>fl[c]).length;
  const criticalDamage=flCount>=2||fl.control_room||(fl.reactor_comp&&fl.engine_room);
  if(criticalDamage){
    player.hp=0;
    _alert('CRITICAL FLOODING');
    setCasualtyState('emergency');
    // Emergency stations + all stop only on first critical event — don't repeat if already called
    if(!d._criticalFired){
      d._criticalFired=true;
      _PANEL?.snapToAllStop();
      _COMMS?.crewState.emergencyStations('flood');
    }
    _COMMS?.flood.critical();
  }
}

// ── Seal flooding (last resort) ───────────────────────────────────────────
export function sealFlooding(comp){
  const d=player.damage;
  if(!d||(d.flooding[comp]||0)<=0) return;
  // Kill any team inside
  for(const team of Object.values(d.teams)){
    if(team.state==='on_scene'&&roomSection(team.location)===comp){
      team.state='lost';
      _COMMS?.dc.teamLostSealed(team.label, SECTION_LABEL[comp]||comp);
    }
  }
  d.floodRate[comp]=0;
  d.flooding[comp]=0;
  if(d._floodDeckDmg?.[comp]) d._floodDeckDmg[comp]={};
  for(const sys of activeSystems(comp)){
    if(d.systems[sys]==='nominal') damageSystem(sys);
  }
  _COMMS?.flood.sealed(SECTION_LABEL[comp]||comp);
  dcLog(`${SECTION_LABEL[comp]||comp} — SEALED. All systems offline`);
}

// ── Crush depth ───────────────────────────────────────────────────────────
// ── Depth flooding cascade ────────────────────────────────────────────────
// Called from nav.js each frame when beyond collapse depth.
// Starts a seep in a random compartment, then queues subsequent ones.
// Seep rate is much slower than breach — crew stay at their posts.
export function applyDepthCascade(dt){
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
  const _sDepthM=Math.max(0,(player.depth||0)-(world?.seaLevel||0));
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
  _COMMS?.flood?.depthSeep(label, station, tFlood);
  _COMMS?.flood?.closeWTDs(label);
  _emergencyCloseWTDs(d);

  // Queue next compartment
  cas.nextT = SEEP_DELAY_MIN + Math.random()*(SEEP_DELAY_MAX-SEEP_DELAY_MIN);
}

// Reset cascade when back above collapse depth
export function resetDepthCascade(){
  const d=player.damage; if(!d||!d._depthCascade) return;
  d._depthCascade.active = false;
  d._depthCascade.nextT  = 0;
  d._depthCascade.seeping = [];
}

// Legacy shim — kept for any external callers
export function applyHullStress(amount){
  applyDepthCascade(0);
}
