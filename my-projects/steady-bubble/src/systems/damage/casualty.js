'use strict';

import { COMPS, SECTION_LABEL, TRAVEL } from './damage-data.js';
import { player } from '../../state/sim-state.js';
import { session } from '../../state/session-state.js';
import { rand } from '../../utils/math.js';

// ── Lazy COMMS binding (set from index.js) ────────────────────────────────
let _COMMS = null;
export function _setCasualtyComms(comms) { _COMMS = comms; }

// ── Injury helpers ────────────────────────────────────────────────────────
export function _injureComp(comp,severity){
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

// Wound a random fit active DC team member; called when team takes a casualty.
export function _woundDcTeamMember(team, d){
  const fit=_activeDcCrew(team.id, d).filter(m=>m.status==='fit');
  if(fit.length===0) return;
  const victim=fit[Math.floor(Math.random()*fit.length)];
  victim.status=Math.random()<0.35?'killed':'wounded';
  if(victim.status==='wounded'){ victim.severity='serious'; }
  const { dcLog } = require_dcLog();
  dcLog(`${team.label} — CASUALTY: ${victim.name} ${victim.status}`);
}

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

// ── Medical system ────────────────────────────────────────────────────────
export function _findCrewById(id, d){
  for(const comp of COMPS){
    const m=(d.crew[comp]||[]).find(c=>c.id===id);
    if(m) return m;
  }
  return null;
}

// Highest priority untreated casualty in a compartment (excludeIds = being treated)
export function _nextCasualty(comp, d, excludeIds){
  const cas=(d.crew[comp]||[]).filter(m=>m.status==='wounded'&&!excludeIds.has(m.id));
  return cas.find(m=>m.severity==='critical')||cas.find(m=>m.severity==='serious')||cas.find(m=>m.severity==='minor')||null;
}

// Compartment with the highest priority untreated casualty across the boat
export function _nextCasualtyComp(d, excludeIds){
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
  if(dest!=='control_room') _COMMS?.medical.enRoute(staff.label, SECTION_LABEL[dest]);
}

export function _tickMedical(dt, d){
  const TREAT_TIME={critical:120, serious:600, minor:300};

  // 1. Tick bleed-out timers for untreated critical casualties
  for(const comp of COMPS){
    for(const m of (d.crew[comp]||[])){
      if(m.status==='wounded'&&m.severity==='critical'&&m.bleedT!=null){
        m.bleedT=Math.max(0, m.bleedT-dt);
        if(m.bleedT<=0){
          m.status='killed'; m.bleedT=null;
          _COMMS?.medical.bleedOut(m.name, SECTION_LABEL[comp]);
        }
      }
    }
  }

  // 2. Check if all medical staff are lost
  const activeStaff=Object.values(d.medTeam).filter(s=>s.state!=='lost'&&s.state!=='down');
  if(activeStaff.length===0){
    const hasCas=COMPS.some(c=>(d.crew[c]||[]).some(m=>m.status==='wounded'));
    if(hasCas&&!d._medNoStaffFired){ d._medNoStaffFired=true; _COMMS?.medical.noMedStaff(); }
    return;
  }
  d._medNoStaffFired=false;

  // 3. Tick each staff member
  for(const staff of Object.values(d.medTeam)){
    if(staff.state==='lost'||staff.state==='down') continue;

    // Check if staff member is themselves a casualty
    const staffCrew=_findCrewById(staff.id, d);
    if(!staffCrew||staffCrew.status==='killed'){
      if(staff.state!=='lost'){ staff.state='lost'; _COMMS?.medical.staffDown(staff.label); }
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
        _COMMS?.medical.onScene(staff.label, SECTION_LABEL[staff.location]||staff.location);
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
            _COMMS?.medical.recovered(staff.label, victim.name);
          }
        }
      }
      if(!staff.treating){
        const here=_nextCasualty(staff.location, d, nowTreating);
        if(here){
          staff.treating=here.id;
          staff.treatT=TREAT_TIME[here.severity]||300;
          _COMMS?.medical.treating(staff.label, here.name, here.severity);
        } else {
          const dest=_nextCasualtyComp(d, nowTreating);
          if(dest&&dest!==staff.location){
            _dispatchMedStaff(staff, dest, d);
          } else if(!dest){
            if(staff.location!=='control_room') _dispatchMedStaff(staff, 'control_room', d);
            else{ staff.state='standby'; _COMMS?.medical.allClear(staff.label); }
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

// ── dcLog import helper (avoids circular dependency) ─────────────────────
// dcLog is imported from comms.js but we get it via lazy binding to avoid
// circular dependencies. The index.js sets it up.
let _dcLogFn = null;
export function _setDcLogFn(fn) { _dcLogFn = fn; }
function require_dcLog() { return { dcLog: _dcLogFn || (()=>{}) }; }
