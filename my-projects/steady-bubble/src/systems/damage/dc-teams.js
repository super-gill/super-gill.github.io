'use strict';

import {
  COMPS, COMP_DEF, ROOMS, SECTION_ROOMS, SECTION_LABEL,
  SYS_DEF, SYS_LABEL, STATES, REPAIR_TIME, TRAVEL, HIGH_ENERGY_SYS,
  VENT_N2_TIME,
  activeSystems, roomSection,
} from './damage-data.js';
import { player } from '../../state/sim-state.js';
import { session } from '../../state/session-state.js';
import { dcLog, COMP_STATION } from '../../narrative/comms.js';

// ── Lazy bindings (set from index.js) ─────────────────────────────────────
let _COMMS = null;
export function _setDcTeamsComms(comms) { _COMMS = comms; }

// ── Shared helpers imported from index.js ─────────────────────────────────
let _alertFn = null, _returnCrewFn = null, _checkClearEmergencyFn = null,
    _woundDcTeamMemberFn = null, _sectionHasFireFn = null, _sectionFireFn = null,
    _wtdTransitPenaltyFn = null;
export function _setDcTeamsHelpers(helpers) {
  _alertFn = helpers._alert;
  _returnCrewFn = helpers._returnCrew;
  _checkClearEmergencyFn = helpers._checkClearEmergency;
  _woundDcTeamMemberFn = helpers._woundDcTeamMember;
  _sectionHasFireFn = helpers._sectionHasFire;
  _sectionFireFn = helpers._sectionFire;
  _wtdTransitPenaltyFn = helpers._wtdTransitPenalty;
}

function _alert(text) { _alertFn?.(text); }
function _returnCrew(comp, d, cause) { _returnCrewFn?.(comp, d, cause); }
function _checkClearEmergency(d) { _checkClearEmergencyFn?.(d); }
function _sectionHasFire(section, d) { return _sectionHasFireFn?.(section, d) ?? false; }
function _sectionFire(section, d) { return _sectionFireFn?.(section, d) ?? 0; }

function stateIndex(sys){ return STATES.indexOf(player.damage.systems[sys]); }

// ── DC team helpers ───────────────────────────────────────────────────────
// Returns crew currently available to fill a DC team:
// off-watch (watch !== activeWatch) OR duty, matching dcTeam, not killed.
function _activeDcCrew(teamId, d){
  const activeWatch=session.activeWatch||'A';
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

export function _teamEffectiveness(team){
  if(team.state==='lost') return 0;
  if(team.state!=='on_scene') return 0;
  const d=player.damage; if(!d) return 0;
  const members=_activeDcCrew(team.id, d);
  if(members.length===0) return 0.1;
  const fit=members.filter(m=>m.status==='fit').length;
  return Math.max(0.15, fit/members.length);
}

// Which team is assigned to a section? (comp = section key)
export function teamAtComp(comp){
  const d=player.damage; if(!d) return null;
  for(const t of Object.values(d.teams)){
    if(t.state==='on_scene'&&roomSection(t.location)===comp) return t;
    if((t.state==='transit'||t.state==='mustering')&&t.destination===comp) return t;
  }
  return null;
}

// ── Assign a DC team to a compartment ────────────────────────────────────
export function assignTeam(teamId,comp){
  const d=player.damage; if(!d) return;
  const team=d.teams[teamId]; if(!team||team.state==='lost') return;


  // Cannot reassign a locked team (committed to active fire or flood)
  if(team._locked){ _COMMS?.dc.cannotReassign(team.label); return; }
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
    if(teamFwd!==destFwd){ _COMMS?.dc.cannotCross(team.label); return; }
  }

  team.state='mustering';
  team.destination=comp;
  team.musterT=15;
  team.task=null;
  team.repairTarget=null;
  team.repairProgress=0;

  _COMMS?.dc.mustering(team.label, SECTION_LABEL[comp]);
}

// ── Recall a DC team to home compartment ─────────────────────────────────
export function recallTeam(teamId){
  const d=player.damage; if(!d) return;
  const team=d.teams[teamId]; if(!team||team.state==='lost') return;
  if(team._locked){ _COMMS?.dc.cannotReassign(team.label); return; }
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
  _COMMS?.dc.recalled(team.label, wasBlow);
}

// ── DC auto-dispatch helpers ──────────────────────────────────────────────
export function _canReachComp(team,comp,d){
  const fwd=['fore_ends','control_room','aux_section'];
  const reactorFlooded=d.flooded.reactor_comp||d.flooded.aux_section;
  if(!reactorFlooded) return true;
  const loc=roomSection(team.location)||roomSection(team.home)||team.location;
  const teamFwd=fwd.includes(loc)||loc==='reactor_comp';
  const destFwd=fwd.includes(comp)||comp==='reactor_comp';
  return teamFwd===destFwd;
}

export function _bestDCTarget(team,d){
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

export function _triggerEmergencyMuster(d){
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
  _COMMS?.dc.autoDispatching(team.label,SECTION_LABEL[comp],Math.round(eta));
}

export function _autoDispatchDC(dt,d){
  if(session.casualtyState!=='emergency') return;
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

// ── Next damaged system to repair in a compartment (auto-priority) ────────
function _nextRepairTarget(comp,d){
  const sysList=activeSystems(comp);
  // Priority: worst state first. Skip nominal AND permanently damaged systems.
  const repairable=sysList
    .filter(s=>d.systems[s]!=='nominal' && !d.permanentDamage?.has(s))
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
export function _tickTeams(dt,d){
  for(const team of Object.values(d.teams)){
    if(team.state==='lost') continue;

    team.statusT=Math.max(0,team.statusT-dt);

    // ── MUSTERING ──────────────────────────────────────────────────────
    if(team.state==='mustering'){
      team.musterT-=dt;
      if(team.musterT<=0){
        const destSec=team.destination; // section key
        const fromSec=roomSection(team.location)||team.location;
        const eta=(TRAVEL[fromSec]?.[destSec]??60)+(_wtdTransitPenaltyFn?.(fromSec,destSec,d)??0);
        team.state='transit';
        team.transitEta=eta;
        _COMMS?.dc.dispatched(team.label, SECTION_LABEL[destSec]||COMP_DEF[destSec]?.label||destSec, Math.round(eta));
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
          _COMMS?.dc.blow.started(team.label, ROOMS[arrRoom]?.label||arrSec);
        } else {
          team.state='on_scene';
          team.task=null;
          if(d._fireDrench?.[arrSec]&&team._ventIntent===arrSec){
            team._ventIntent=null;
            team.task='vent_n2';
            team._ventT=VENT_N2_TIME;
            if(d._fireDrench[arrSec]) d._fireDrench[arrSec].venting=true;
            _COMMS?.dc.onScene(team.label, ROOMS[arrRoom]?.label||arrSec);
            _COMMS?.fire.ventN2Started(SECTION_LABEL[arrSec]||arrSec, team.label);
          } else if(_sectionHasFire(arrSec,d)){
            team._ventIntent=null;
            team.task='fire';
            team._locked=true;
            team._fireLosing=0;
            _COMMS?.fire.dcArrival(team.label, ROOMS[arrRoom]?.label||arrSec);
          } else if(d.floodRate[arrSec]>0){
            team._ventIntent=null;
            _COMMS?.dc.onScene(team.label, ROOMS[arrRoom]?.label||arrSec);
            team.task='flood';
            team._locked=true;
            _COMMS?.dc.floodingActive(team.label);
          } else {
            team._ventIntent=null;
            _COMMS?.dc.onScene(team.label, ROOMS[arrRoom]?.label||arrSec);
            const sys=_nextRepairTarget(arrSec,d);
            if(sys){
              team.task='repair';
              team.repairTarget=sys;
              _COMMS?.dc.startRepair(team.label, SYS_LABEL[sys]);
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
        _COMMS?.dc.blow.started(team.label, ROOMS[roomId]?.label||sec);
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
          _COMMS?.fire.ventN2Complete(SECTION_LABEL[sec]||sec);
          const sys=_nextRepairTarget(sec,d);
          if(sys){ team.task='repair'; team.repairTarget=sys; _COMMS?.dc.startRepair(team.label,SYS_LABEL[sys]); }
          else { team.state='ready'; _COMMS?.dc.allSecure(team.label,SECTION_LABEL[sec]||sec); }
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
            _COMMS?.fire.dcMoved?.(team.label, ROOMS[worstRoom]?.label||sec);
          }
        }
        if(team.statusT<=0){
          team.statusT=20;
          _COMMS?.fire.dcStatus(team.label,Math.round(_sectionFire(sec,d)*100),ROOMS[team.location]?.label||sec);
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
            _COMMS?.dc.breachSealed(team.label, SECTION_LABEL[sec]||sec, sys, SYS_LABEL[sys]);
          } else {
            team.state='ready';
            _COMMS?.dc.breachSealed(team.label, SECTION_LABEL[sec]||sec, null, null);
          }
        } else {
          if(team.statusT<=0){
            team.statusT=25;
            const pct=Math.round(d.flooding[sec]*100);
            const netRate=d.floodRate[sec];
            _COMMS?.dc.floodStatus(team.label, pct, netRate);
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
            _COMMS?.dc.startRepair(team.label, SYS_LABEL[sys]);
          }
        } else {
          d.repairJobs[sec]=null;
          team.task=null;
          team.state='ready';
          _COMMS?.dc.allSecure(team.label, SECTION_LABEL[sec]||sec);
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
            _COMMS?.dc.repairProgress(team.label, SYS_LABEL[job.sys], pct, teamsOnScene>=2);
          }
          if(job.progress>=job.totalTime){
            const sys=job.sys;
            const cur=stateIndex(sys);
            if(cur>0){
              d.systems[sys]=STATES[cur-1];
              const restored=STATES[cur-1];
              _COMMS?.dc.repairComplete(team.label, SYS_LABEL[sys], restored, teamsOnScene>=2);
              // Reactor-specific follow-up from maneuvering — tells crew whether restart
              // is now possible (nominal) or further work is still needed (degraded/offline).
              if(sys==='reactor') _COMMS?.reactor.repairReadyRestart(restored);
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
        _COMMS?.dc.blow.accessible(team.label, SECTION_LABEL[blowSec]||blowSec);
        continue;
      }
      const BLOW_RATE=0.008;
      d.flooding[blowSec]=Math.max(0,(d.flooding[blowSec]||0)-BLOW_RATE*dt);
      if(team.statusT<=0){
        team.statusT=20;
        const pct=Math.round(d.flooding[blowSec]*100);
        _COMMS?.dc.blow.progress(team.label, SECTION_LABEL[blowSec]||blowSec, pct);
      }
      if(d.flooding[blowSec]<=0.15){
        d.flooded[blowSec]=false;
        d.floodRate[blowSec]=0;
        team.state='on_scene';
        team.task='flood';
        team._locked=false;
        _COMMS?.dc.blow.complete(team.label, SECTION_LABEL[blowSec]||blowSec);
        _alert(`${SECTION_LABEL[blowSec]||blowSec} RE-ENTERED`);
        _returnCrew(blowSec,d);
      }
      continue;
    }
  }
  _autoDispatchDC(dt,d);
}
