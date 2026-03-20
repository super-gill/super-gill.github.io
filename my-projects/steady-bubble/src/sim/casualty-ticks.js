'use strict';

import { CONFIG } from '../config/constants.js';
import { rand, clamp } from '../utils/math.js';
import { player } from '../state/sim-state.js';
import { session } from '../state/session-state.js';

const C = CONFIG;

// ── Lazy bindings (set via bindCasualtyTicks) ────────────────────────
let _COMMS = null;
let _DMG = null;
let _broadcastTransientFn = null;

export function bindCasualtyTicks(deps) {
  if (deps.COMMS) _COMMS = deps.COMMS;
  if (deps.DMG)   _DMG   = deps.DMG;
  if (deps.broadcastTransient) _broadcastTransientFn = deps.broadcastTransient;
}

// ── Snorkel flooding (Type 209 only) ─────────────────────────────────
// Head valve failure during snorkelling. Water enters through the
// diesel induction system.

export function tickSnorkelFlood(dt){
  if(!C.player.isDiesel) return;
  const d = player.damage; if(!d) return;
  const cfg = C.player.casualties?.snorkelFlood;
  if(!cfg) return;

  // Combat trigger (set by hit() in damage/index.js)
  if(d._snorkelFloodPending && !d.snorkelFloodActive){
    d._snorkelFloodPending = false;
    _triggerSnorkelFloodLocal(d, cfg);
  }

  // Runtime triggers (only while snorkelling and not already flooding)
  if(player.snorkelling && !d.snorkelFloodActive){
    // Wave-over at speed
    if(player.speed > 4 && Math.random() < (cfg.waveOverChancePerSec || 0.002) * dt){
      _triggerSnorkelFloodLocal(d, cfg);
    }
    // Random valve failure
    if(!d.snorkelFloodActive && Math.random() < (cfg.valveFailureChancePerSec || 0.0002) * dt){
      _triggerSnorkelFloodLocal(d, cfg);
    }
  }

  // Active snorkel flood tick
  if(!d.snorkelFloodActive) return;

  // Valve close countdown
  if(d._snorkelValveT > 0){
    d._snorkelValveT -= dt;
    if(d._snorkelValveT <= 0){
      // Valve closed — stop flooding for minor/major
      if(d._snorkelFloodSeverity !== 'catastrophic'){
        d.floodRate.reactor_comp = 0;
      } else {
        // Catastrophic: reduce rate but need DC to fully seal
        d.floodRate.reactor_comp = Math.max(0, (d.floodRate.reactor_comp || 0) * 0.3);
      }
    }
  }

  // Minor auto-recovery (diesel stall clears in 30-60s)
  if(d._snorkelFloodSeverity === 'minor'){
    if(!d._snorkelMinorT) d._snorkelMinorT = 30 + Math.random() * 30;
    d._snorkelMinorT -= dt;
    if(d._snorkelMinorT <= 0){
      if(d.systems.diesel_engine === 'degraded') d.systems.diesel_engine = 'nominal';
      d.snorkelFloodActive = false;
      d._snorkelFloodSeverity = null;
      d._snorkelMinorT = null;
    }
  }
}

function _triggerSnorkelFloodLocal(d, cfg){
  const roll = Math.random();
  let severity;
  if(roll < (cfg.minorChance || 0.50)) severity = 'minor';
  else if(roll < (cfg.minorChance || 0.50) + (cfg.majorChance || 0.35)) severity = 'major';
  else severity = 'catastrophic';

  d.snorkelFloodActive = true;
  d._snorkelFloodSeverity = severity;

  if(severity === 'minor'){
    d.systems.diesel_engine = d.systems.diesel_engine === 'nominal' ? 'degraded' : d.systems.diesel_engine;
    d._snorkelValveT = 0;
    _COMMS?.snorkelFlood?.minor();
  } else if(severity === 'major'){
    d.systems.diesel_engine = 'offline';
    d.floodRate.reactor_comp = Math.max(d.floodRate.reactor_comp || 0, cfg.majorFloodRate || 0.005);
    const hydDmg = (d.systems.hyd_main || 'nominal') !== 'nominal';
    d._snorkelValveT = hydDmg ? (cfg.valveCloseTime || 15) : 5;
    _COMMS?.snorkelFlood?.major();
  } else {
    d.systems.diesel_engine = 'destroyed';
    d.floodRate.reactor_comp = Math.max(d.floodRate.reactor_comp || 0, cfg.catastrophicFloodRate || 0.015);
    const hydDmg = (d.systems.hyd_main || 'nominal') !== 'nominal';
    d._snorkelValveT = hydDmg ? (cfg.valveCloseTime || 15) : 5;
    _COMMS?.snorkelFlood?.catastrophic();
  }
  player.snorkelling = false;
}

// ── Chlorine gas (Type 209 only) ────────────────────────────────────
// Seawater + battery acid → chlorine gas. Heavier than air, lethal in
// enclosed spaces. Creates a death spiral with flooding.

export function tickChlorine(dt){
  if(!C.player.isDiesel) return;
  const d = player.damage; if(!d) return;
  const cfg = C.player.casualties?.chlorine;
  if(!cfg) return;

  // Generation: flooding in engine_room contacts battery
  const floodLevel = d.flooding.engine_room || 0;
  const threshold = cfg.floodThreshold || 0.33;
  const batteryOk = (d.systems.battery_bank || 'nominal') !== 'destroyed';

  if(floodLevel >= threshold && batteryOk){
    const genRate = floodLevel * (cfg.generationRate || 0.015);
    d.cl2Level = Math.min(1, (d.cl2Level || 0) + genRate * dt);
  } else {
    // Source stopped — natural decay
    if(d.cl2Level > 0){
      if(player.depth <= (C.player.periscopeDepth || 18) + 5){
        d.cl2Level = Math.max(0, d.cl2Level - (cfg.surfaceClearRate || 0.08) * dt);
      } else if(player.snorkelling){
        d.cl2Level = Math.max(0, d.cl2Level - (cfg.snorkelClearRate || 0.03) * dt);
      } else {
        d.cl2Level = Math.max(0, d.cl2Level - (cfg.naturalDecay || 0.002) * dt);
      }
    }
  }

  // Threshold comms
  if(!d._cl2Comms) d._cl2Comms = {};
  if(d.cl2Level >= (cfg.traceLevel || 0.15) && !d._cl2Comms.trace){
    d._cl2Comms.trace = true;
    _COMMS?.chlorine?.trace();
  }
  if(d.cl2Level >= (cfg.hazardousLevel || 0.35) && !d._cl2Comms.hazardous){
    d._cl2Comms.hazardous = true;
    _COMMS?.chlorine?.hazardous();
  }
  if(d.cl2Level >= (cfg.lethalLevel || 0.60) && !d._cl2Comms.lethal){
    d._cl2Comms.lethal = true;
    _COMMS?.chlorine?.lethal();
  }
  if(d.cl2Level >= (cfg.saturatedLevel || 0.85) && !d._cl2Comms.saturated){
    d._cl2Comms.saturated = true;
    _COMMS?.chlorine?.saturated();
  }
  if(d.cl2Level < (cfg.traceLevel || 0.15) - 0.05) d._cl2Comms = {};

  // Crew casualties at hazardous+ (5% per 10s in engine_room)
  if(d.cl2Level >= (cfg.hazardousLevel || 0.35)){
    if(!d._cl2CasT) d._cl2CasT = 0;
    d._cl2CasT += dt;
    if(d._cl2CasT >= 10){
      d._cl2CasT = 0;
      const crew = d.crew.engine_room || [];
      for(const cr of crew){
        if(cr.status !== 'fit') continue;
        if(Math.random() < 0.05){
          cr.status = 'wounded';
          cr.severity = 'serious';
        }
      }
    }
  }
}

// ── Hot run torpedo ───────────────────────────────────────────────────
// A loaded torpedo's motor ignites in the tube. 12-second countdown
// to detonation. Crew attempts emergency flood-and-eject.

export function tickHotRun(dt){
  const d = player.damage; if(!d) return;
  if(d.hotRunCountdown == null) return;
  const cfg = C.player.casualties?.hotRun || {};

  d.hotRunCountdown -= dt;
  if(d.hotRunCountdown > 0) return;

  // Timer expired — resolve eject attempt
  let ejectChance = cfg.ejectBaseChance || 0.75;
  const tubeState = d.systems.tubes || 'nominal';
  if(tubeState === 'degraded') ejectChance -= 0.15;
  else if(tubeState === 'offline') ejectChance -= 0.30;
  else if(tubeState === 'destroyed') ejectChance = 0;
  const foreCrew = (d.crew.fore_ends || []).filter(cr => cr.status === 'fit');
  const totalFore = (d.crew.fore_ends || []).length;
  if(totalFore > 0 && foreCrew.length / totalFore < 0.5) ejectChance -= 0.20;
  const foreRooms = _DMG?.SECTION_ROOMS?.fore_ends || [];
  const hasFire = foreRooms.some(rid => (d.fire[rid] || 0) > 0.01);
  if(hasFire) ejectChance -= 0.10;

  const tube = d.hotRunTube;

  if(Math.random() < Math.max(0, ejectChance)){
    d.systems.tubes = d.systems.tubes === 'nominal' ? 'degraded' : d.systems.tubes;
    if(player.torpStock != null) player.torpStock = Math.max(0, player.torpStock - 1);
    if(tube != null && player.torpTubes) player.torpTubes[tube] = 0;
    _DMG?.drawHPA(2);
    if(_broadcastTransientFn) _broadcastTransientFn(player.wx, player.wy, 2000, cfg.acousticTransientEject || 0.25, null);
    _COMMS?.hotRun?.ejected(tube != null ? tube + 1 : '?');
  } else {
    _COMMS?.hotRun?.detonation();
    _DMG?.hit(55, null, null, 'fore_ends');
    d.systems.tubes = 'destroyed';
    d.systems.weapon_stow = 'destroyed';
    if(_broadcastTransientFn) _broadcastTransientFn(player.wx, player.wy, 5000, cfg.acousticTransientDetonate || 0.60, null);
    if(Math.random() < (cfg.sympatheticChance || 0.15)){
      d.flooding.fore_ends = 1.0;
      for(const cr of (d.crew.fore_ends || [])) if(cr.status !== 'killed') cr.status = 'killed';
      const foreSys = _DMG?.activeSystems?.('fore_ends') || [];
      for(const sys of foreSys) d.systems[sys] = 'destroyed';
      _COMMS?.hotRun?.sympatheticDetonation();
    }
  }

  d.hotRunCountdown = null;
  d.hotRunTube = null;
}

// ── Stuck diving planes ───────────────────────────────────────────────
// Jammed planes actively drive the boat toward depth extremes. Crew
// attempts recovery over 25-40 seconds. The pitch force integrates into
// player.vy which feeds the depth controller in nav.js.

export function tickStuckPlanes(dt){
  const d = player.damage; if(!d) return;
  const cfg = C.player.casualties?.stuckPlanes;
  if(!cfg) return;

  // Trigger 2: Emergency manoeuvre at speed (>15kt)
  if(!d.stuckPlanes && player.speed > 15){
    const emergStarted = (player.emergTurnT > 0 && !d._spEmergLast) || (player._crashDiving && !d._spCrashLast);
    if(emergStarted && Math.random() < (cfg.manoeuvreChance || 0.08)){
      const set = player._crashDiving ? 'aft' : (Math.random() < 0.5 ? 'fwd' : 'aft');
      const dir = player.vy > 0.5 ? 'dive' : player.vy < -0.5 ? 'rise' : 'neutral';
      d.stuckPlanes = {set, direction:dir,
        recoveryT:rand(cfg.recoveryTime?.[0]||25, cfg.recoveryTime?.[1]||40),
        recovered:false};
      _COMMS?.planes?.stuckPlanes?.(set, dir);
    }
  }
  d._spEmergLast = player.emergTurnT > 0;
  d._spCrashLast = player._crashDiving;

  // Trigger 3: Random hydraulic wear (degraded planes, per-frame check)
  if(!d.stuckPlanes){
    for(const planesSys of ['planes_fwd_hyd','planes_aft_hyd']){
      if(d.systems[planesSys]==='degraded' && Math.random()<(cfg.wearChance||0.0003)*dt){
        const set=planesSys==='planes_fwd_hyd'?'fwd':'aft';
        const dir=player.vy>0.5?'dive':player.vy<-0.5?'rise':'neutral';
        d.stuckPlanes={set, direction:dir,
          recoveryT:rand(cfg.recoveryTime?.[0]||25, cfg.recoveryTime?.[1]||40),
          recovered:false};
        _COMMS?.planes?.stuckPlanes?.(set, dir);
        break;
      }
    }
  }

  const sp = d.stuckPlanes;
  if(!sp) return;

  if(sp.direction!=='neutral'){
    const highSpeed = player.speed > 15;
    const pitchRate = highSpeed ? (cfg.jamPitchRateHighSpeed||1.0) : (cfg.jamPitchRate||0.6);
    const sign = sp.direction==='dive' ? 1 : -1;
    player.vy += sign * pitchRate * dt;
  }

  if(!sp.recovered){
    sp.recoveryT -= dt;
    if(sp.recoveryT <= 0){
      let chance = cfg.recoveryBaseChance || 0.85;
      const hydState = d.systems.hyd_main || 'nominal';
      if(hydState==='offline'||hydState==='destroyed') chance -= 0.20;
      const sec = sp.set==='fwd' ? 'fore_ends' : 'aft_ends';
      if((d.flooding[sec]||0) > 0.15) chance -= 0.15;

      sp.recovered = true;
      if(Math.random() < chance){
        const planesSys = sp.set==='fwd' ? 'planes_fwd_hyd' : 'planes_aft_hyd';
        d.systems[planesSys] = 'degraded';
        d.stuckPlanes = null;
        _COMMS?.planes?.stuckPlanesRecovered?.(sp.set);
      } else {
        const planesSys = sp.set==='fwd' ? 'planes_fwd_hyd' : 'planes_aft_hyd';
        d.systems[planesSys] = 'destroyed';
        _COMMS?.planes?.stuckPlanesFailed?.(sp.set);
      }
    }
  }
}

// ── Shaft seal failure ────────────────────────────────────────────────
// Speed-dependent flooding in aft_ends. Cannot be permanently repaired.

export function tickShaftSeal(dt){
  const d = player.damage; if(!d) return;
  const cfg = C.player.casualties?.shaftSeal;
  if(!cfg) return;

  if(!d.shaftSealLeak){
    const sealState = d.systems.shaft_seals || 'nominal';
    const sealDmg = ['degraded','offline','destroyed'].indexOf(sealState) >= 0;

    if(sealDmg && player.speed >= (C.player.flankKts||28) * 0.90){
      player._sealStressT = (player._sealStressT || 0) + dt;
      if(player._sealStressT >= (cfg.flankStressTime || 20)){
        if(Math.random() < (cfg.flankRiskPerSec || 0.0015) * dt){
          d.shaftSealLeak = true;
          _COMMS?.shaftSeal?.activated();
        }
      }
    } else {
      player._sealStressT = Math.max(0, (player._sealStressT || 0) - dt * 2);
    }

    if(!d.shaftSealLeak && sealState === 'degraded'){
      if(Math.random() < (cfg.wearChance || 0.0001) * dt){
        d.shaftSealLeak = true;
        _COMMS?.shaftSeal?.activated();
      }
    }
  }

  if(d.shaftSealLeak){
    const sealState = d.systems.shaft_seals || 'nominal';
    const maxSpeed = C.player.flankKts || 28;
    const speedFactor = Math.pow(player.speed / maxSpeed, 2);
    const depthM = Math.max(0, (player.depth || 0) - (C.world?.seaLevel || 0));
    const pressureMult = 1 + Math.min(depthM / 120, 4);
    let baseRate = cfg.baseLeakRate || 0.003;
    if(sealState === 'destroyed') baseRate *= (cfg.destroyedLeakMult || 2.0);
    const leakRate = baseRate * (1 + speedFactor) * pressureMult;
    d.flooding.aft_ends = Math.min(1, (d.flooding.aft_ends || 0) + leakRate * dt);

    if(!d._sealCommsT) d._sealCommsT = 0;
    d._sealCommsT += dt;
    if(d._sealCommsT >= 15){
      d._sealCommsT = 0;
      if(player.speed > 10) _COMMS?.shaftSeal?.speedWarning();
    }
  }
}

// ── Hydraulic pressure system ──────────────────────────────────────────
// Progressive pressure loss from damaged hyd_main.

export function tickHydraulic(dt){
  const d = player.damage; if(!d) return;
  const sys = d.systems;
  const hydState = sys.hyd_main || 'nominal';
  const cfg = C.player.casualties?.hydraulic;
  if(!cfg) return;

  const prev = d.hydPressure;
  let dropping = false;

  if(hydState === 'destroyed'){
    d.hydPressure = Math.max(0, d.hydPressure - (cfg.destroyedLeakRate || 0.05) * dt);
    dropping = true;
  } else if(hydState === 'offline'){
    d.hydPressure = Math.max(0, d.hydPressure - (cfg.offlineLeakRate || 0.02) * dt);
    dropping = true;
  } else if(hydState === 'degraded'){
    d.hydPressure = Math.max(0, d.hydPressure - (cfg.degradedLeakRate || 0.005) * dt);
    dropping = true;
  } else if(d.hydPressure < 1.0){
    d.hydPressure = Math.min(1.0, d.hydPressure + (cfg.recoveryRate || 0.01) * dt);
  }

  if(!d._hydComms) d._hydComms = {};
  const sluggish = cfg.sluggishThreshold || 0.60;
  const fail     = cfg.failThreshold || 0.30;
  const complete = cfg.completeFailThreshold || 0.10;

  if(prev > sluggish && d.hydPressure <= sluggish && !d._hydComms.sluggish){
    d._hydComms.sluggish = true;
    _COMMS?.hydraulic?.pressureLow(hydState);
  }
  if(prev > fail && d.hydPressure <= fail && !d._hydComms.fail){
    d._hydComms.fail = true;
    _COMMS?.hydraulic?.pressureCritical();
  }
  if(prev > complete && d.hydPressure <= complete && !d._hydComms.complete){
    d._hydComms.complete = true;
    _COMMS?.hydraulic?.pressureZero();
  }
  if(d.hydPressure > sluggish + 0.05) d._hydComms = {};

  if(dropping && d.hydPressure > 0 && (hydState === 'offline' || hydState === 'destroyed')){
    if(Math.random() < (cfg.fireChancePerSec || 0.003) * dt){
      const fireFn = _DMG?.igniteFire;
      if(fireFn) fireFn('control_room_d2', cfg.fireStartIntensity || 0.15);
      _COMMS?.hydraulic?.fluidFire();
    }
  }
}

// ── Battery hydrogen buildup and explosion ────────────────────────────

export function tickHydrogen(dt){
  const d = player.damage; if(!d) return;
  const cfg = C.player.casualties?.hydrogen;
  if(!cfg) return;

  let chargeRate = 0;
  if(C.player.isDiesel){
    if(player.snorkelling) chargeRate = cfg.dieselSnorkelChargeRate || 0.003;
    else if(player.depth <= (C.player.periscopeDepth || 18)) chargeRate = cfg.dieselSurfaceChargeRate || 0.005;
  } else {
    if(!player.scram) chargeRate = cfg.nuclearChargeRate || 0.008;
  }
  if((d.systems.battery_bank || 'nominal') === 'destroyed') chargeRate = 0;

  const ventState = d.systems.vent_plant || 'nominal';
  let ventMod = 0.1;
  if(ventState === 'degraded') ventMod = 0.4;
  else if(ventState === 'offline' || ventState === 'destroyed') ventMod = 1.0;

  const h2Rate = chargeRate * (cfg.generationFactor || 0.0008) * ventMod;
  d.h2Level = Math.max(0, d.h2Level + h2Rate * dt);
  d.h2Level = Math.max(0, d.h2Level - (cfg.naturalDecay || 0.001) * dt);

  if(player.depth <= (C.player.periscopeDepth || 18) + 5 && ventState !== 'destroyed' && d.h2Level > 0.01){
    d.h2Level = Math.max(0, d.h2Level - (cfg.forceVentRate || 0.05) * dt);
  }

  d.h2Level = clamp(d.h2Level, 0, 1);

  if(!d._h2Comms) d._h2Comms = {};
  if(d.h2Level >= (cfg.cautionLevel || 0.25) && !d._h2Comms.caution){
    d._h2Comms.caution = true; _COMMS?.hydrogen?.caution();
  }
  if(d.h2Level >= (cfg.dangerLevel || 0.50) && !d._h2Comms.danger){
    d._h2Comms.danger = true; _COMMS?.hydrogen?.danger();
  }
  if(d.h2Level >= (cfg.explosiveLevel || 0.75) && !d._h2Comms.explosive){
    d._h2Comms.explosive = true; _COMMS?.hydrogen?.explosive();
  }
  if(d.h2Level < (cfg.cautionLevel || 0.25) - 0.05) d._h2Comms = {};

  if(d.h2Level >= (cfg.dangerLevel || 0.50)){
    const atExplosive = d.h2Level >= (cfg.explosiveLevel || 0.75);
    const probMult = atExplosive ? 1.0 : 0.5;
    let ignite = false;
    const elecDmg = ['degraded','offline','destroyed'].indexOf(d.systems.elec_dist || 'nominal') >= 0;
    if(elecDmg && Math.random() < (cfg.elecFaultIgnitionPerSec || 0.03) * probMult * dt) ignite = true;
    const batteryRoom = 'engine_room_d1';
    if(!ignite && (d.fire[batteryRoom] || 0) > 0.01){
      if(Math.random() < (cfg.fireIgnitionPerSec || 0.08) * probMult * dt) ignite = true;
    }
    if(!ignite && Math.random() < (cfg.randomSparkPerSec || 0.0005) * probMult * dt) ignite = true;
    if(ignite) _detonateHydrogen();
  }
}

function _detonateHydrogen(){
  const d = player.damage; if(!d) return;
  const cfg = C.player.casualties?.hydrogen || {};
  const batteryRoom = 'engine_room_d1';
  const section = 'engine_room';

  for(const [sys, def] of Object.entries(_DMG?.SYS_DEF || {})){
    if(def.room === batteryRoom){
      d.systems[sys] = 'destroyed';
      d.permanentDamage.add(sys);
    }
  }

  const sectionCrew = d.crew[section] || [];
  const killRate = 0.60 + Math.random() * 0.20;
  for(const cr of sectionCrew){
    if(cr.status === 'killed') continue;
    if(Math.random() < killRate) cr.status = 'killed';
    else { cr.status = 'wounded'; cr.severity = 'critical'; cr.bleedT = 240; }
  }

  if(Math.random() < 0.90 && _DMG?.igniteFire) _DMG.igniteFire(batteryRoom, 0.25);
  const adjRooms = _DMG?.ROOM_ADJ?.[batteryRoom] || [];
  for(const adj of adjRooms){
    if(Math.random() < 0.50 && _DMG?.igniteFire) _DMG.igniteFire(adj, 0.12);
  }

  player.hp = Math.max(1, player.hp - (cfg.explosionHpDamage || 15));
  if(typeof _broadcastTransientFn === 'function'){
    _broadcastTransientFn(player.wx, player.wy, 3000, cfg.explosionTransient || 0.35, null);
  }

  d.h2Level = 0;
  d._h2Comms = {};
  _COMMS?.hydrogen?.explosion(C.player.isDiesel);
  session.hitFlash = 0.8;
}
