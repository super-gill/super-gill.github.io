'use strict';

import {
  COMPS, COMP_DEF, ROOMS, ROOM_IDS, SECTION_ROOMS, SECTION_LABEL,
  SYS_DEF, SYS_LABEL, ROOM_SYSTEMS, ROOM_ADJ, EVAC_TO, SECTION_CAP,
  STATES,
  FIRE_BASE_GROW, FIRE_SCALE_GROW, WATCH_SUPPRESS, DC_FIRE_SUPPRESS,
  FIRE_EVAC_TIME, FIRE_DETECT_THRESHOLD, FIRE_INVESTIGATE_DELAY,
  DRENCH_THRESH, DRENCH_LOSE_TIME, DRENCH_FILL_TIME, VENT_N2_TIME,
  activeSystems, roomSection, _sectionNoEvac,
} from './damage-data.js';
import { CONFIG } from '../../config/constants.js';
import { player, triggerScram } from '../../state/sim-state.js';
import { session, setCasualtyState } from '../../state/session-state.js';
import { clamp } from '../../utils/math.js';
import { dcLog, COMP_STATION } from '../../narrative/comms.js';

const C = CONFIG;

// ── Lazy bindings (set from index.js) ─────────────────────────────────────
let _COMMS = null, _PANEL = null;
export function _setFiresComms(comms) { _COMMS = comms; }
export function _setFiresPanel(panel) { _PANEL = panel; }

// ── Shared helpers imported from index.js ─────────────────────────────────
let _alertFn = null, _damageSystemFn = null, _returnCrewFn = null,
    _checkClearEmergencyFn = null, _teamEffectivenessFn = null,
    _woundDcTeamMemberFn = null, _canReachCompFn = null;
export function _setFiresHelpers(helpers) {
  _alertFn = helpers._alert;
  _damageSystemFn = helpers.damageSystem;
  _returnCrewFn = helpers._returnCrew;
  _checkClearEmergencyFn = helpers._checkClearEmergency;
  _teamEffectivenessFn = helpers._teamEffectiveness;
  _woundDcTeamMemberFn = helpers._woundDcTeamMember;
  _canReachCompFn = helpers._canReachComp;
}

function _alert(text) { _alertFn?.(text); }
function damageSystem(sys, steps) { return _damageSystemFn?.(sys, steps); }
function _returnCrew(comp, d, cause) { _returnCrewFn?.(comp, d, cause); }
function _checkClearEmergency(d) { _checkClearEmergencyFn?.(d); }
function _teamEffectiveness(team) { return _teamEffectivenessFn?.(team) ?? 0; }

// ── Fire helpers ──────────────────────────────────────────────────────────
export function _sectionFire(section, d){
  return (SECTION_ROOMS[section]||[]).reduce((mx,rid)=>Math.max(mx,d.fire[rid]||0),0);
}
export function _sectionHasFire(section, d){
  return (SECTION_ROOMS[section]||[]).some(rid=>(d.fire[rid]||0)>0.05);
}

// ── Fire ignition ─────────────────────────────────────────────────────────
// target: room ID (e.g. 'engine_room_d1') or section key (picks a manned room)
export function igniteFire(target, intensity){
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
      _COMMS?.fire.fireInvestigated(room.label, COMP_STATION[section]||'ENG');
    } else {
      _COMMS?.fire.ignited(room.label, COMP_STATION[section]||'ENG');
      if(watchCount>0) _COMMS?.fire.watchkeeperResponse(SECTION_LABEL[section], watchCount);
    }
    setCasualtyState('emergency');
  } else {
    // Section already on alert — just announce the new room
    _alert(`FIRE — ${room.label}`);
    if(!isManned){
      _COMMS?.fire.fireInvestigated(room.label, COMP_STATION[section]||'ENG');
    } else {
      _COMMS?.fire.ignited(room.label, COMP_STATION[section]||'ENG');
    }
  }
  if(section==='reactor_comp'&&!d._reactorFireScram){
    d._reactorFireScram=true;
    if(d.systems.reactor==='nominal'||d.systems.reactor==='degraded') d.systems.reactor='offline';
    if(!player.scram&&typeof triggerScram==='function') triggerScram('damage');
    _COMMS?.reactor.scram('fire');
  }
}

// ── Fire extinguish helper ────────────────────────────────────────────────
export function _extinguishFire(roomId, d, by){
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
        _COMMS?.dc.floodingActive(team.label);
      } else {
        const sys=_nextRepairTarget(section,d);
        if(sys){ team.task='repair'; team.repairTarget=sys; _COMMS?.dc.startRepair(team.label,SYS_LABEL[sys]); }
        else { team.state='ready'; _COMMS?.dc.allSecure(team.label,SECTION_LABEL[section]||section); }
      }
    }
  }
  if(section==='reactor_comp'&&d._reactorFireScram){
    d._reactorFireScram=false;
    // Only say "commencing fast recovery" if the reactor system itself wasn't damaged.
    // If damaged, the scram tick in sim.js will fire scramHoldRepair() instead.
    if(d.systems?.reactor==='nominal') _COMMS?.reactor.fireScramLifted();
  }
  _COMMS?.fire.extinguished(SECTION_LABEL[section], by);
  _alert(`FIRE OUT — ${SECTION_LABEL[section]}`);
  _checkClearEmergency(d);
}

// ── Next damaged system to repair in a compartment (auto-priority) ────────
function _nextRepairTarget(comp,d){
  const sysList=activeSystems(comp);
  const stIdx = (sys) => STATES.indexOf(d.systems[sys]);
  const repairable=sysList
    .filter(s=>d.systems[s]!=='nominal' && !d.permanentDamage?.has(s))
    .sort((a,b)=>stIdx(b)-stIdx(a));
  return repairable[0]||null;
}

// ── Nitrogen drench (automated last resort) ───────────────────────────────
export function _nitrogenDrench(comp, d, dcTeam){
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
    _woundDcTeamMemberFn?.(dcTeam, d); _woundDcTeamMemberFn?.(dcTeam, d);
    dcTeam.state='ready'; dcTeam.task=null; dcTeam._locked=false;
    _COMMS?.dc.teamEvacuated(dcTeam.label, SECTION_LABEL[comp]||comp);
  }

  if(d._fireWatch) d._fireWatch[comp]=null;

  _COMMS?.fire.nitrogenDrench(SECTION_LABEL[comp]||comp, cas);
  _alert(`N2 DRENCH — ${SECTION_LABEL[comp]||comp}`);

  // Auto-dispatch a free team to vent the N2 — compartment must be cleared before
  // it's habitable again and before emergency stations can stand down.
  const ventTeam=Object.values(d.teams).find(t=>t.state==='ready'&&!t._locked&&_canReachCompFn?.(t,comp,d));
  if(ventTeam){
    ventTeam._ventIntent=comp;
    ventTeam.state='mustering';
    ventTeam.destination=comp;
    ventTeam.musterT=15;
    ventTeam.task=null;
    ventTeam.repairTarget=null;
    ventTeam.repairProgress=0;
    _COMMS?.dc.mustering(ventTeam.label, SECTION_LABEL[comp]);
  } else {
    // No team available right now — player must manually send one via VENT button
    _COMMS?.fire.ventN2Required(SECTION_LABEL[comp]);
  }

  if(comp==='reactor_comp'){
    if(d._reactorFireScram) d._reactorFireScram=false;
    if(!player.scram&&typeof triggerScram==='function'){
      triggerScram('damage');
      _COMMS?.reactor.scram('damage');
    }
  }
}

// ── N2 drench fill tick ───────────────────────────────────────────────────
// Ramps drench level 0→1 over DRENCH_FILL_TIME, suppressing fire progressively.
// Vent phase (level 1→0) is driven by the vent_n2 task in _tickTeams.
export function _tickDrench(dt, d){
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

// ── Fire tick ─────────────────────────────────────────────────────────────
export function _tickFire(dt, d){
  if(d._tickingFire) return;
  d._tickingFire=true;
  try { _tickFireInner(dt, d); } finally { d._tickingFire=false; }
}

function _tickFireInner(dt, d){
  // ── Electrical fire ignition check ──────────────────────────────────
  // Non-combat fires from damaged electrical systems. Can recur if the
  // underlying damage is not repaired.
  const _efCfg = C.player.casualties?.electricalFire;
  if (_efCfg) {
    // Trigger 1: Damaged electrical distribution → fire in its section
    const elecState = d.systems.elec_dist || 'nominal';
    const elecDmg = STATES.indexOf(elecState);
    if (elecDmg >= 1) {
      const chance = elecDmg >= 2
        ? (_efCfg.offlineChancePerSec || 0.0025)
        : (_efCfg.degradedChancePerSec || 0.0008);
      if (Math.random() < chance * dt) {
        const section = ROOMS[SYS_DEF.elec_dist.room]?.section || 'engine_room';
        const hadFire = _sectionHasFire(section, d);
        igniteFire(section, _efCfg.startIntensity || 0.05);
        if (hadFire) {
          _COMMS?.fire.electricalFireReignition(
            ROOMS[SYS_DEF.elec_dist.room]?.label || 'ELEC DIST',
            COMP_STATION[section] || 'ENG'
          );
        }
      }
    }
    // Trigger 2: Any damaged system in unmanned space (detectionDelay > 30s)
    for (const roomId of ROOM_IDS) {
      const room = ROOMS[roomId];
      if ((room.detectionDelay || 0) <= 30) continue;
      if ((d.fire[roomId] || 0) > 0) continue;       // already burning
      if (d.flooded[room.section]) continue;           // flooded section
      const hasDamagedSys = (ROOM_SYSTEMS[roomId] || []).some(
        s => STATES.indexOf(d.systems[s] || 'nominal') >= 1
      );
      if (!hasDamagedSys) continue;
      if (Math.random() < (_efCfg.unmannedDamagedChancePerSec || 0.0002) * dt) {
        igniteFire(roomId, _efCfg.startIntensity || 0.05);
      }
    }
  }

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

    // ── Distribute watchkeepers across burning rooms ─────────────────
    // Watchkeepers split evenly across detected fires in their section.
    // A single room gets all watchers; two rooms split them.
    const burningDetected=roomIds.filter(rid=>(d.fire[rid]||0)>0&&d._fireDetected[rid]);
    const watchPerRoom=watch&&watch.count>0&&burningDetected.length>0
      ? Math.max(1, Math.floor(watch.count/burningDetected.length))
      : 0;

    // ── Per-room fire growth ───────────────────────────────────────────
    // Suppression is per-room: watchkeepers split across fires,
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
              _COMMS?.fire.fireAlarm(ROOMS[roomId].label, COMP_STATION[section]||'ENG');
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
      // Detected — per-room suppression with distributed watchkeepers
      const watchSuppress=watchPerRoom * WATCH_SUPPRESS;
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
            _COMMS?.fire.watchkeeperCasualty(victim.name,SECTION_LABEL[section],victim.status);
            _alert(`FIRE CASUALTY — ${SECTION_LABEL[section]}`);
          }
          if(watch.count===0) _COMMS?.fire.watchkeeperOvercome(SECTION_LABEL[section]);
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
      _COMMS?.fire.dcRelief(SECTION_LABEL[section]);
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
          _COMMS?.fire.heatDamage(SYS_LABEL[sys],newState,SECTION_LABEL[section]);
          _alert(`HEAT DAMAGE — ${SYS_LABEL[sys]}`);
        }
      }
    }

    // Out of control
    if(watch&&!watch._outOfControlFired&&F>0.70){
      watch._outOfControlFired=true;
      _COMMS?.fire.outOfControl(SECTION_LABEL[section]);
    }

    // Emergency stations on first serious fire
    if(!d._fireCritical) d._fireCritical={};
    if(!d._fireCritical[section]&&F>0.40){
      d._fireCritical[section]=true;
      if(!d._criticalFired){ d._criticalFired=true; _PANEL?.snapToAllStop(); }
      _COMMS?.crewState.emergencyStations('fire');
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
          _COMMS?.fire.drenchInitiated(SECTION_LABEL[section]);
        }
      } else if(F>DRENCH_THRESH && watch && watch.count>0){
        // No DC team on scene — watchkeeper initiates drench (DC team still needed to vent)
        if(!d._fireDrenchAutoT) d._fireDrenchAutoT={};
        d._fireDrenchAutoT[section]=(d._fireDrenchAutoT[section]||0)+dt;
        if(d._fireDrenchAutoT[section]>=DRENCH_LOSE_TIME){
          d._fireDrenchAutoT[section]=0;
          if(!d._fireDrenchPending) d._fireDrenchPending={};
          d._fireDrenchPending[section]={t:20};
          _COMMS?.fire.drenchInitiated(SECTION_LABEL[section]);
        }
      } else if(d._fireDrenchAutoT?.[section]){
        d._fireDrenchAutoT[section]=0;
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
          _COMMS?.fire.cascade(SECTION_LABEL[section],SECTION_LABEL[targetSection]);
          if(targetRoom) igniteFire(targetRoom,0.05);
        }
      }
    }
  }
}

// ── Manually fire N2 drench immediately (during pending countdown) ───────
export function manualDrench(teamId){
  const d=player.damage; if(!d) return;
  const team=d.teams[teamId]; if(!team||team.task!=='drench_pending') return;
  const comp=team.location; if(!comp) return;
  if(d._fireDrenchPending?.[comp]) delete d._fireDrenchPending[comp];
  // Move team out to home before N2 fires
  team.state='ready'; team.task=null; team._locked=false; team.location=team.home;
  _nitrogenDrench(comp,d,null);
}

// ── Start N2 venting in a drenched compartment ────────────────────────────
export function ventN2(teamId, comp){
  const d=player.damage; if(!d) return;
  if(!d._fireDrench?.[comp]) return; // nothing to vent
  const team=d.teams[teamId]; if(!team||team.state==='lost') return;
  if(team._locked) return;
  // If already on_scene at this comp, start immediately
  if(team.state==='on_scene'&&roomSection(team.location)===comp){
    team.task='vent_n2';
    team._ventT=VENT_N2_TIME;
    if(d._fireDrench[comp]) d._fireDrench[comp].venting=true;
    _COMMS?.fire.ventN2Started(SECTION_LABEL[comp]||comp, team.label);
    return;
  }
  // Otherwise muster toward the drenched comp — mark intent so arrival handler starts vent
  team._ventIntent=comp;
  // Import assignTeam dynamically to avoid circular dependency
  _assignTeamFn?.(teamId, comp);
}

let _assignTeamFn = null;
export function _setAssignTeamFn(fn) { _assignTeamFn = fn; }
