'use strict';

import { CONFIG } from '../config/constants.js';
import { rand, clamp } from '../utils/math.js';
import { player, triggerScram } from '../state/sim-state.js';
import { session, addLog } from '../state/session-state.js';

const C = CONFIG;

// ── Lazy bindings (set via bindPlayerPhysics) ───────────────────────────
let _COMMS = null;
let _NAV = null;
let _SIG = null;
let _DMG = null;

export function bindPlayerPhysics(deps) {
  if (deps.COMMS) _COMMS = deps.COMMS;
  if (deps.NAV)   _NAV   = deps.NAV;
  if (deps.SIG)   _SIG   = deps.SIG;
  if (deps.DMG)   _DMG   = deps.DMG;
}

// ── Reactor SCRAM tick ──────────────────────────────────────────────────

export function tickReactorScram(dt){
  if(player.scram && !C.player.isDiesel){
    const wasT = player.scramT;
    player.scramT = Math.max(0, player.scramT - dt);
    const t = player.scramT;
    const wT = wasT; // previous value

    // Check whether reactor systems are damaged -- suppresses recovery comms
    // if reactor, primary coolant, or pressuriser are not nominal (can't sustain reaction).
    const _rxSys = player.damage?.systems||{};
    const reactorDamaged = _rxSys.reactor !== 'nominal' && _rxSys.reactor != null
                        || _rxSys.primary_coolant === 'offline' || _rxSys.primary_coolant === 'destroyed'
                        || _rxSys.pressuriser === 'offline' || _rxSys.pressuriser === 'destroyed';

    // T+0 -- MANV immediate call (fired from triggerScram, not here)
    // T+3 -- EPM online
    if(wT>72 && t<=72 && !player.scramEPM){
      player.scramEPM=true;
      _COMMS.reactor.epmon();
    }
    // T+8 -- ENG start recovery (or hold if damaged)
    if(wT>67 && t<=67){
      if(reactorDamaged){
        _COMMS.reactor.scramHoldRepair();
      } else {
        _COMMS.reactor.recoveryStart();
      }
    }
    // Recovery progress steps -- skipped entirely if reactor is damaged
    if(!reactorDamaged){
      // T+20 -- primary coolant circulating
      if(wT>55 && t<=55) _COMMS.reactor.recoveryProgress(0);
      // T+35 -- pulling rods
      if(wT>40 && t<=40) _COMMS.reactor.recoveryProgress(1);
      // T+50 -- self-sustaining reaction
      if(wT>25 && t<=25) _COMMS.reactor.recoveryProgress(2);
      // T+65 -- turbines online
      if(wT>10 && t<=10){
        _COMMS.reactor.recoveryProgress(3);
        _COMMS.reactor.recoveryProgress(4);
      }
      // T+70 -- reactor back in band
      if(wT>5 && t<=5) _COMMS.reactor.recoveryProgress(5);
    }
    if(t<=0){
      player.scram=false;
      player.scramEPM=false;
      player.scramCause=null;
      if(!reactorDamaged) _COMMS.reactor.online();
      // If damaged: reactor stays offline -- maneuvering comms fire when repair completes
    }
  }
}

// ── Crash dive depth-passing calls ──────────────────────────────────────

export function tickCrashDive(dt){
  if(player._crashDiving){
    if(!player._crashDepthCalled) player._crashDepthCalled=new Set();
    const band=Math.floor(player.depth/50)*50;
    if(band>=100 && !player._crashDepthCalled.has(band)){
      player._crashDepthCalled.add(band);
      _COMMS.nav.depthReport(band);
    }
  } else if(player._crashDepthCalled?.size>0){
    player._crashDepthCalled=new Set();
  }
}

// ── Coolant leak system ─────────────────────────────────────────────────

export function tickCoolantLeak(dt){
  if(!C.player.isDiesel){
  {
    const casCfg=C.player.casualties?.coolantLeak||{};
    if(!player.scram && !player._coolantLeak){
      const atFlank  = player.speed >= (C.player.flankKts||28)*0.90;
      const atDepth  = player.depth >= (C.world?.layerY2||280) + 60;
      const coolantDegraded = player.damage?.systems?.primary_coolant === 'degraded';
      if(atFlank && atDepth){
        player._flankDepthT = (player._flankDepthT||0) + dt;
        const threshold = coolantDegraded ? (casCfg.stressThreshold||15)/((casCfg.degradedRiskMult||3)) : (casCfg.stressThreshold||15);
        const risk = clamp((player._flankDepthT - threshold) * (casCfg.riskPerSec||0.008), 0, 0.35) * dt;
        if(risk>0 && Math.random() < risk){
          player._coolantLeakCount = (player._coolantLeakCount||0) + 1;
          player._coolantLeak={ timer:casCfg.countdown||45, rolled:false, warned:false };
          _COMMS.reactor.coolantLeak(player._coolantLeakCount);
        }
      } else {
        player._flankDepthT = Math.max(0,(player._flankDepthT||0)-dt*2);
      }
    }
  }

  // -- Coolant leak tick -----------------------------------------------------
  if(player._coolantLeak && !player.scram){
    const cl=player._coolantLeak;
    const casCfg=C.player.casualties?.coolantLeak||{};
    // Speed affects countdown rate
    const atFlank = player.speed >= (C.player.flankKts||28)*0.90;
    const runSlow = player.speed <= (C.player.speedMaxKts||20)/3;
    const rate = atFlank ? (casCfg.fastMult||1.5) : runSlow ? (casCfg.slowMult||0.5) : 1.0;
    cl.timer -= dt * rate;

    // Halfway -- crew attempts to isolate the leak (single roll)
    if(!cl.rolled && cl.timer <= (casCfg.countdown||45)*0.5){
      cl.rolled=true;
      const fixChance = runSlow ? (casCfg.fixChanceHigh||0.65) : (casCfg.fixChanceLow||0.30);
      if(Math.random() < fixChance){
        // Crew isolated the leak — stress persists (player must reduce speed/depth)
        _COMMS.reactor.coolantLeakIsolated();
        player._coolantLeak=null;
        // _flankDepthT intentionally NOT reset — stress stays high,
        // next leak triggers quickly if player doesn't slow down
      } else {
        _COMMS.reactor.coolantLeakFailed();
      }
    }
    // Progress report at ~70% remaining
    if(cl && !cl.warned && cl.timer <= (casCfg.countdown||45)*0.7){
      cl.warned=true;
      _COMMS.reactor.coolantLeakProgress();
    }
    // Timer expired -- automatic SCRAM
    if(cl && cl.timer<=0){
      player._coolantLeak=null;
      player._flankDepthT=0;
      triggerScram('coolant_leak');
      _COMMS.reactor.scram('coolant');
    }
  }

  // -- Steam leak tick -------------------------------------------------------
  if(player._steamLeak){
    player._steamLeak.timer -= dt;
    if(player._steamLeak.timer<=0){
      player._steamLeak=null;
      if(!player.scram) _COMMS.reactor.steamRestored();
    }
  }

  // -- Turbine trip tick -----------------------------------------------------
  if(player._turbineTrip){
    player._turbineTrip.timer -= dt;
    if(player._turbineTrip.timer<=0){
      player._turbineTrip=null;
      if(!player.scram) _COMMS.reactor.turbineRecovered();
    }
  }

  // -- Throttle snap -- turbine trip from rapid speed changes ----------------
  {
    const casCfg=C.player.casualties?.turbineTrip||{};
    const threshold=casCfg.throttleSnapThreshold||10;
    const prevSpd=player._prevSpeed??player.speed;
    const spdChange=Math.abs(player.speed-prevSpd)/Math.max(dt,0.016);
    player._prevSpeed=player.speed;
    if(!player._turbineTrip && !player._steamLeak && !player.scram && spdChange>threshold){
      if(Math.random()<(casCfg.throttleSnapChance||0.20)*dt){
        player._turbineTrip={ timer:rand(casCfg.recoveryTime?.[0]||20, casCfg.recoveryTime?.[1]||30) };
        _COMMS.reactor.turbineTrip();
      }
    }
  }
  } // end !isDiesel reactor casualty block
}

// ── NAV/SIG tick + cavitation log ───────────────────────────────────────

export function tickNavSig(dt){
  _NAV.updateOrders(dt);
  _NAV.stepDynamics(dt);  // handles all movement including player.wx/wy/depth/y
  _SIG.updateNoise(dt);

  // Cavitation onset/clearance log
  if(player.cavitating && !player._wasCav){
    _COMMS.nav.cavitation(true);
  } else if(!player.cavitating && player._wasCav){
    _COMMS.nav.cavitation(false);
  }
  player._wasCav=player.cavitating;

  // Tube reload-complete log (skip wire-occupied tubes: value -1, skip manual op completions)
  for(let i=0;i<(player.torpTubes||[]).length;i++){
    const prev=player._prevTubes?.[i]??0;
    const cur=player.torpTubes[i];
    if(prev>0 && cur===0 && player.torpStock>=0 && !player._tubeOpDone?.has(i)){
      _COMMS.weapons.reloaded(i+1);
    }
  }
  if(player._tubeOpDone) player._tubeOpDone.clear();
  player._prevTubes=(player.torpTubes||[]).slice();
}

// ── Watch fatigue & handover ────────────────────────────────────────────

export function _oowName(watchId){
  const d=player.damage; if(!d) return 'unknown';
  for(const comp of ['control_room']){
    const m=(d.crew[comp]||[]).find(c=>c.role==='OOW'&&c.watch===watchId);
    if(m) return m.lastName;
  }
  return 'unknown';
}

export function initiateWatchChange(){
  if(session.watchChanging) return;
  if(session.tacticalState==='action'||session.casualtyState==='emergency'){
    _COMMS.watch.blocked(); return;
  }
  const outgoing=session.activeWatch;
  const incoming=outgoing==='A'?'B':'A';
  session.watchChanging=true;
  session.watchChangeT=30;
  session._watchRelief80=false;
  session._watchRelief100=false;
  _COMMS.watch.relieving(outgoing, incoming);
}

export function tickWatchFatigue(dt){
  // Complete a pending handover
  if(session.watchChanging){
    session.watchChangeT=Math.max(0, session.watchChangeT-dt);
    if(session.watchChangeT<=0){
      session.activeWatch=session.activeWatch==='A'?'B':'A';
      session.watchChanging=false;
      session.watchFatigue=0;
      session.watchT=0;
      _DMG?.relocateCrewForWatch(session.activeWatch);
      _COMMS.watch.onWatch(session.activeWatch, _oowName(session.activeWatch));
    }
    return;
  }

  // Accumulate fatigue -- faster during patrol/action (stress)
  // Rates tuned for ~15-45 min real-time watches (80% request relief, 100% forced change)
  const rate=session.tacticalState==='action'?0.0009:
             session.tacticalState==='patrol'?0.0006:0.00035; // per second
  session.watchFatigue=Math.min(1.0,(session.watchFatigue||0)+rate*dt);
  session.watchT=(session.watchT||0)+dt;

  // 80% threshold -- OOW requests relief
  if(session.watchFatigue>=0.8&&!session._watchRelief80){
    session._watchRelief80=true;
    _COMMS.watch.requestRelief(session.activeWatch);
  }
  // 100% -- forced change (if not in action/emergency)
  if(session.watchFatigue>=1.0&&!session._watchRelief100){
    session._watchRelief100=true;
    _COMMS.watch.forcedChange(session.activeWatch);
    if(session.tacticalState!=='action'&&session.casualtyState!=='emergency'){
      initiateWatchChange();
    }
  }
}
