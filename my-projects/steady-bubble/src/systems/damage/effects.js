'use strict';

import { CONFIG } from '../../config/constants.js';
import { player } from '../../state/sim-state.js';
import {
  COMPS, COMP_DEF, ROOMS, ROOM_IDS, SECTION_ROOMS, SECTION_LABEL,
  SYS_DEF, SYS_LABEL, STATES, PASSIVE_SYS,
  activeSystems, roomSection,
} from './damage-data.js';
import { totalFit, totalCrew, crewEfficiency } from './crew-roster.js';
import { _sectionHasFire, _sectionFire } from './fires.js';

const C = CONFIG;

// ── Lazy COMMS binding (set from index.js) ────────────────────────────────
let _COMMS = null;
export function _setEffectsComms(comms) { _COMMS = comms; }

// ── System helpers ────────────────────────────────────────────────────────
// Effective state accounting for:
//  1. Control-node dependency (helm→fwd planes, fire_ctrl→tubes/tdc)
//  2. Unmanned section — no fit crew = active systems offline
export function effectiveState(sys,d){
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

// ── Effects ───────────────────────────────────────────────────────────────
export function getEffects(){
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
  // Hydraulic pressure affects plane and WTD operation
  const hydP = d.hydPressure ?? 1.0;
  const hydCfg = C.player.casualties?.hydraulic || {};
  const hydFail = hydP < (hydCfg.failThreshold || 0.30);
  // fwd plane mode — hydraulic pressure below fail threshold forces air_emergency
  const fwdPlaneMode = fwdCtrl ? 'frozen'
    : hydFail ? 'air_emergency'
    : (fwdHyd==='offline'||fwdHyd==='destroyed') ? 'air_emergency'
    : fwdHyd==='degraded' ? 'air_emergency' : 'hydraulic';
  // aft plane mode — no control loss (Manoeuvring fallback), only hydraulic mode changes
  const aftPlaneMode = hydFail ? 'air_emergency'
    : (aftHyd==='offline'||aftHyd==='destroyed') ? 'air_emergency'
    : aftHyd==='degraded' ? 'air_emergency' : 'hydraulic';
  // WTD operation speed multiplier based on hydraulic pressure
  const hydSluggish = hydP < (hydCfg.sluggishThreshold || 0.60);
  const hydComplete = hydP < (hydCfg.completeFailThreshold || 0.10);
  const wtdSpeedMult = hydComplete ? 0 : hydFail ? 0 : hydSluggish ? 0.67 : 1.0;
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
  return {speedCap,sonarRangeMult,bearingNoiseMult,reloadMult,depthRateMult,noisePenalty,tdcErrDeg,tubesAvail,towedOk,periscopeOk,maxDepth,totalFlood,floodTauMult,fwdPlaneMode,aftPlaneMode,aftCtrlTransferred,connRoomLost,crashDiveAvail:!connRoomLost,silentRunAvail:!connRoomLost,steeringMult,steeringOk,fireLevel,anyFire,wireNoiseMult,wireUpdateRate,wireCutAll,chargeRateMult,wtdSpeedMult,hydPressure:hydP};
}
export function _defaults(){
  return {speedCap:Infinity,sonarRangeMult:1.0,bearingNoiseMult:1.0,reloadMult:1.0,depthRateMult:1.0,noisePenalty:0,tdcErrDeg:0,tubesAvail:C.player.torpTubes||4,towedOk:true,periscopeOk:true,maxDepth:C.world?.maxDepth||500,totalFlood:0,floodTauMult:1.0,fwdPlaneMode:'hydraulic',aftPlaneMode:'hydraulic',aftCtrlTransferred:false,connRoomLost:false,crashDiveAvail:true,silentRunAvail:true,steeringMult:1.0,steeringOk:true,wireNoiseMult:1.0,wireUpdateRate:1.0,wireCutAll:false,chargeRateMult:1.0,wtdSpeedMult:1.0,hydPressure:1.0};
}

// ── Buoyancy/trim state ───────────────────────────────────────────────────
// Returns {trim, buoyancy} computed live from current flood levels.
// trim:    negative = bow-heavy, positive = stern-heavy
// buoyancy: total flood load (0 = clean, 2.0 = normal ballast limit,
//           2.5 = emergency blow overwhelmed)
export function getTrimState(){
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
export function drawHPA(cost, allowReserve=false){
  const d = player.damage;
  if(!d?.hpa) return 1.0;
  const hpa = d.hpa;
  const maxP = C?.player?.hpa?.maxPressure || 207;
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
      _COMMS?.trim?.reserveHPACommitted?.();
    } else {
      _COMMS?.trim?.reserveHPACommitted?.();  // fire once when reserve is drawn
    }
  }
  return Math.min(1, drawn / cost);
}
