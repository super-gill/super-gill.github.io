'use strict';

import { CONFIG } from '../config/constants.js';
import { rand, clamp, lerp, now, angleNorm } from '../utils/math.js';
import { world, cam, player, enemies, bullets, particles, decoys,
         contacts, cwisTracers, wireContacts, sonarContacts, wrecks,
         buoys, missiles, tdc, nextTorpId, resetTorpIds,
         triggerScram, queueLog } from '../state/sim-state.js';
import { session, setMsg, addLog, setTacticalState, setCasualtyState } from '../state/session-state.js';
import { ui } from '../state/ui-state.js';

// ── Sub-module imports ──────────────────────────────────────────────────
import { bindPlayerControl, tickTubeOps, tickPendingFires, tickStadimeter,
         tickFiringInputs, tickWireGuidance } from './player-control.js';
import { bindPlayerPhysics, tickReactorScram, tickCrashDive, tickCoolantLeak,
         tickNavSig, initiateWatchChange, tickWatchFatigue } from './player-physics.js';
import { bindCasualtyTicks,
         tickHydraulic, tickShaftSeal, tickHotRun, tickStuckPlanes,
         tickSnorkelFlood, tickHydrogen, tickChlorine } from './casualty-ticks.js';
import { bindScenario, spawnScenario, spawnWave,
         tickWaveManagement, tickVictory } from './scenario.js';

const C = CONFIG;

// ── Lazy bindings (resolved at boot via _bindSim) ────────────────────────
let _canvas = null;
let _COMMS = null;
let _I = null;
let _NAV = null;
let _SIG = null;
let _SENSE = null;
let _W = null;
let _AI = null;
let _DMG = null;
let _TORP = null;
let _MSL = null;
let _PANEL = null;
let _MAPS = null;
let _ROUTE = null;
let _broadcastTransient = null;
let _playerHearTransient = null;

export function _bindSim(deps) {
  if (deps.canvas) _canvas = deps.canvas;
  if (deps.COMMS) _COMMS = deps.COMMS;
  if (deps.I) _I = deps.I;
  if (deps.NAV) _NAV = deps.NAV;
  if (deps.SIG) _SIG = deps.SIG;
  if (deps.SENSE) _SENSE = deps.SENSE;
  if (deps.W) _W = deps.W;
  if (deps.AI) _AI = deps.AI;
  if (deps.DMG) _DMG = deps.DMG;
  if (deps.TORP) _TORP = deps.TORP;
  if (deps.MSL) _MSL = deps.MSL;
  if (deps.PANEL) _PANEL = deps.PANEL;
  if (deps.MAPS) _MAPS = deps.MAPS;
  if (deps.ROUTE) _ROUTE = deps.ROUTE;
  if (deps.broadcastTransient) _broadcastTransient = deps.broadcastTransient;
  if (deps.playerHearTransient) _playerHearTransient = deps.playerHearTransient;

  // Forward bindings to sub-modules
  bindPlayerControl({ COMMS: _COMMS, I: _I, NAV: _NAV, SENSE: _SENSE, W: _W, AI: _AI, DMG: _DMG, MSL: _MSL, canvas: _canvas, SIM });
  bindPlayerPhysics({ COMMS: _COMMS, NAV: _NAV, SIG: _SIG, DMG: _DMG });
  bindCasualtyTicks({ COMMS: _COMMS, DMG: _DMG, broadcastTransient: _broadcastTransient });
  bindScenario({ COMMS: _COMMS, AI: _AI });
}

// ── Wire cut handler (defined here, bound to weapons via _bindSim) ────────
function _onWireCut(b){
  const tubeWires=player.tubeWires||[];
  for(let i=0;i<tubeWires.length;i++){
    if(tubeWires[i]===b){
      tubeWires[i]=null;
      // Tube cleared but NOT auto-reloaded — player must order reload (torp or missile choice)
      player.torpTubes[i]=0;   // 0 = empty/ready state, tubeLoad tracks what's loaded
      player.tubeLoad[i]=null; // null = empty tube, awaiting load order
      _COMMS.weapons.wireParted(i+1, 'runout');
      break;
    }
  }
  // Wire cut -- torpedo flies last commanded bearing, passive seeker searches.
  // No reattack circle -- torpedo has no knowledge of a map position, only what its seeker hears.
  if(b && !b.target){
    // Nothing to do -- torpedo continues on current heading, seeker runs normally
  }
}

function wrapX(x){return x;}

// Legacy shim -- depth charges pass no position so we let DMG pick a random compartment
export function damagePlayer(amount, hitX, hitY){
  if(session.godMode){ _W.makeExplosion(player.wx, player.wy, 0.8, true); return; }
  _DMG.hit(amount, hitX??null, hitY??null);
  _W.makeExplosion(player.wx, player.wy, 0.8, true);
  // Combat shock severs all active torpedo wires
  _severAllWires('dive');
}

function _severAllWires(cause){
  const tubeWires=player.tubeWires||[];
  let severed=0;
  for(let i=0;i<tubeWires.length;i++){
    const b=tubeWires[i];
    if(!b||!b.wire?.live) continue;
    b.wire.live=false;
    tubeWires[i]=null;
    player.torpTubes[i]=0;
    player.tubeLoad[i]=null;
    severed++;
  }
  if(severed>0) _COMMS.weapons.wireParted(null, cause);
}

export function damageEnemy(e,amount){
  const hpMax=e.hpMax??e.hp; // hpMax set at spawn; fallback to current hp if missing
  e.hp-=amount;
  _W.makeExplosion(e.x,e.y,amount>=90?1.6:1.0,e.type==="boat");
  // Enemy submarine casualty roll -- performance degrades with damage, not just HP loss
  // Modifiers read by updateEnemyNoise() and enemyMaybeHearPlayer() in ai.js,
  // and by the speed cap in the sub movement block below
  if(e.type==='sub' && e.hp>0){
    const fracHit=amount/hpMax;
    const fracTotal=1-(e.hp/hpMax);
    e._dmgNoisePenalty=Math.min(0.40,(e._dmgNoisePenalty||0)+0.08); // machinery hit -- louder
    if(fracHit>0.30) e._dmgSpeedCapMult=Math.max(0.50,(e._dmgSpeedCapMult??1.0)-0.25); // propulsion hit
    if(fracTotal>0.60) e._dmgSensorMult=Math.min((e._dmgSensorMult??1.0),0.65); // cumulative sonar damage
  }
  if(e.hp<=0){
    if(e.civilian){
      session.score-=100; // penalty for destroying civilian shipping
    } else {
      session.score+=(e.role==='ssbn'?500:e.role==='zeta'?400:e.type==="boat"?160:190);
    }
    e.dead=true;
    if(!e.civilian) session._enemiesKilled=(session._enemiesKilled||0)+1;
    // Surface ship kill -- trigger hunt state in surviving units
    if(!e.civilian && e.type==='boat') _AI.triggerHuntState(e);
    // Permanent wreck marker
    wrecks.push({x:e.x, y:e.y, type:e.type, t:session.missionT||0});
    // Breaking-up noise is unmistakable -- always logged regardless of detection state
    if(e.civilian){
      _COMMS.combat.targetDestroyed('civilian');
    } else {
      _COMMS.combat.targetDestroyed(e.type);
    }
    // Freeze the sonarContact -- keeps TDC data but stops updating
    const sc=sonarContacts?.get(e);
    if(sc){ sc.dead=true; sc.activeT=0; }
    // DO NOT clearContact -- let TDC retain last-known firing solution
  }
}

function clampConeDual(desiredDx,desiredDy,heading,coneDeg){
  const desAng=Math.atan2(desiredDy,desiredDx);
  const half=(coneDeg*Math.PI/180)*0.5;
  const diffF=angleNorm(desAng-heading);
  const diffR=angleNorm(desAng-(heading+Math.PI));
  const useRear=(Math.abs(diffR)<Math.abs(diffF));
  const diff=useRear?diffR:diffF;
  const clamped=clamp(diff,-half,half);
  const ang=(useRear?(heading+Math.PI):heading)+clamped;
  return {dx:Math.cos(ang),dy:Math.sin(ang),isRear:useRear,out:(Math.abs(diff)>half)};
}

// ── Sensor ticks (kept in index.js) ─────────────────────────────────────

function tickMasts(dt){
  const cfgs=C.player.masts||[];
  for(let i=0;i<(player.masts||[]).length;i++){
    const m=player.masts[i];
    const cfg=cfgs[i];
    if(!cfg||m.state==='damaged') continue;
    // Transition ticks
    if(m.state==='raising'){
      m.t-=dt;
      if(m.t<=0){ m.state='up'; m.t=0; _COMMS.mast?.raised(cfg.label); }
    } else if(m.state==='lowering'){
      m.t-=dt;
      if(m.t<=0){ m.state='down'; m.t=0; }
    }
    // Depth check -- applies when up or raising
    if(m.state==='up'||m.state==='raising'){
      if(player.depth>cfg.crushDepth){
        m.state='damaged';
        damagePlayer(10);
        _COMMS.mast?.crushed(cfg.label);
      } else if(player.depth>cfg.safeDepth+5){
        if(!m._warnFired){ m._warnFired=true; _COMMS.mast?.floodWarning(cfg.label); }
      } else {
        m._warnFired=false;
      }
    } else {
      m._warnFired=false;
    }
  }
}

function tickEsmScan(dt){
  const m=(player.masts||[]).find(m=>m.key==='esm');
  if(!m||m.state!=='up') return;
  player._esmScanT=(player._esmScanT||0)-dt;
  if(player._esmScanT>0) return;
  player._esmScanT=rand(4,7);
  const esmRange=C.player.esmRange||12000;
  const esmContacts=[];
  for(const e of enemies){
    if(e.dead||e.civilian||e.type!=='boat') continue;
    const dx=e.x-player.wx, dy=e.y-player.wy;
    const d=Math.hypot(dx,dy);
    if(d>esmRange) continue;
    const trueBrg=((Math.atan2(dx,-dy)*180/Math.PI)+360)%360;
    const brgNoise=rand(-1.5,1.5)*(d/esmRange);
    const brgDeg=Math.round(((trueBrg+brgNoise)+360)%360);
    const strength=d<3000?'STRONG':d<6000?'MEDIUM':'WEAK';
    esmContacts.push({brgDeg,strength,subClass:e.subClass});
  }
  if(esmContacts.length>0) _COMMS.mast?.esmContacts(esmContacts);
}

function tickRadarSweep(dt){
  const m=(player.masts||[]).find(m=>m.key==='radar');
  if(!m||m.state!=='up') return;
  player._radarSweepT=(player._radarSweepT||0)-dt;
  if(player._radarSweepT>0) return;
  player._radarSweepT=rand(8,12);
  const radarRange=C.player.radarRange||7000;
  let count=0;
  for(const e of enemies){
    if(e.dead||e.civilian||e.type!=='boat') continue;
    const dx=e.x-player.wx, dy=e.y-player.wy;
    const d=Math.hypot(dx,dy);
    if(d>radarRange) continue;
    // Precise radar fix on enemy
    _SENSE.registerFix(e,e.x+rand(-15,15),e.y+rand(-15,15),5,'radar');
    // Enemy detects our emission -- bearing fix + suspicion boost
    e.suspicion=Math.min(1,Math.max(e.suspicion,C.enemy.asw?.huntSuspicionFloor||0.70));
    const brgFromE=Math.atan2(player.wy-e.y,player.wx-e.x);
    if(!e.playerBearings) e.playerBearings=[];
    const T=session.missionT||0;
    e.playerBearings.push({fromX:e.x,fromY:e.y,brg:brgFromE+rand(-0.01,0.01),t:T});
    if(e.playerBearings.length>16) e.playerBearings.shift();
    _AI.solveEnemyTMA(e);
    count++;
  }
  _COMMS.mast?.radarSweep(count);
}

// ── Reset ───────────────────────────────────────────────────────────────

function reset(){
  bullets.length=0;particles.length=0;enemies.length=0;decoys.length=0;contacts.length=0;cwisTracers.length=0;wireContacts.length=0;missiles.length=0;
  if(wrecks) wrecks.length=0;
  if(buoys) buoys.length=0;
  resetTorpIds();
  if(_ROUTE) _ROUTE.length=0;
  session.score=0;session.over=false;session.won=false;session._wonDelayT=0;session._victory=false;session.msg="";session.msgT=0;session.missionT=0;session.msgLog=[];session.sonarLog=[];
  setCasualtyState('normal'); setTacticalState('cruising');
  session._ssbnVictory=false;session._bossVictory=false;session._aswVictory=false;session._enemiesKilled=0;
  player.pendingFires=[];
  const spawn=_MAPS?.getMap()?.playerSpawn||{wx:4000,wy:5000};
  player.wx=spawn.wx; player.wy=spawn.wy;
  player.heading=0; player.speed=0; player.speedOrderKts=0;
  const spawnDepth=Math.min(260, C.player.divingLimit||260);
  player.depth=spawnDepth; player.depthOrder=spawnDepth;
  player.vy=0; player.turnRate=0; player.hp=C.player.hpMax; player.invuln=0;
  player.noise=0; player.noiseTransient=0; player.cavitating=false;
  player.torpCd=0; player.pingCd=0; player.cmCd=0; player.cmStock=C.player.cmStock??12; player.sonarPulse=0; player.periscopeCd=0; player.periscopeT=0;
  // Torpedo tubes: array of per-tube reload countdowns (0 = loaded & ready)
  const nTubes=C.player.torpTubes||4;
  player.torpTubes=[];
  for(let i=0;i<nTubes;i++) player.torpTubes.push(0);
  player.torpStock=C.player.torpStock||12;
  player.battery=1.0; player.snorkeling=false; player.snorkelOrdered=false; player._battDead=false;
  player._snorkelOrderedFired=false; player._snorkelCancelledFired=false;
  player._snorkelNoisyCautionFired=false; player._snorkelT=0; player._lastBatBand='ok';
  player.silent=false; player.emergTurnT=0; player.emergTurnCd=0; player._crashDiving=false; player.crashDiveCd=0; player._crashTanksFull=false; player.passiveTick=0;
  player._coolantLeak=null; player._steamLeak=null; player._turbineTrip=null; player._flankDepthT=0; player._prevSpeed=0; player._movingDir=1;
  // Per-tube wire tracking -- null=no wire, or reference to the live torpedo
  player.tubeWires = new Array(C.player.torpTubes||4).fill(null);
  // Per-tube load type: 'torp' (default), missile key (e.g. 'harpoon'), or null (empty)
  player.tubeLoad = new Array(C.player.torpTubes||4).fill('torp');
  // Current torpedo room operation -- only one at a time
  player.tubeOp = null;
  // Missile stock (separate from torpStock)
  player.missileStock = C.player.missileStock || 0;
  // VLS cells -- per-cell state array; only populated when vessel has VLS
  const nVls = C.player.vlsCells || 0;
  player.vlsCells = nVls > 0 ? new Array(nVls).fill(null).map(() => ({ state: 'ready' })) : [];
  player.stadimeterT = 0; player.stadimeterTarget = null;
  // Mast state array -- one entry per mast defined in C.player.masts
  player.masts=(C.player.masts||[]).map(cfg=>({key:cfg.key,state:'down',t:0,_warnFired:false}));
  player._esmScanT=0; player._radarSweepT=0;
  ui.wirePanel = { selectedTube:0 };
  _DMG.initDamage();
  // Wave system -- initialise
  session.wave=0;
  session.waveDelay=0;
  session.groupState='patrol';
  session.groupStateT=0;
  session.prosecutingT=0;
  if(session.started!==false) spawnScenario(session.scenario||'waves');
}
// reset() called by main.js after all bindings are wired

function resetScenario(scenario){
  session.scenario=scenario;
  reset();
}

// ── Main update loop ────────────────────────────────────────────────────

function update(dt){
  if(_I.justPressed('reload')){ window.location.reload(); }

  if(_I.justPressed('damageScreen')||_I.justPressed('damageScreenAlt')){ session.showDamageScreen=!session.showDamageScreen; }
  if(_I.justPressed('watchChange')){ initiateWatchChange(); }
  if(_I.justPressed('actionStations')){ _PANEL?.callActionStations(); }

  // God mode -- restore hp to max every tick so damage can't stick
  if(session.godMode) player.hp=C.player.hpMax;

  // ── Player control sub-module ticks ────────────────────────────────────
  tickTubeOps(dt);
  tickPendingFires(dt);

  // ── Player physics sub-module ticks ────────────────────────────────────
  tickReactorScram(dt);
  tickCrashDive(dt);

  player.pingCd=Math.max(0,player.pingCd-dt);

  tickCoolantLeak(dt);
  tickHydraulic(dt);
  tickShaftSeal(dt);
  tickHotRun(dt);
  tickStuckPlanes(dt);
  tickSnorkelFlood(dt);

  player.cmCd=Math.max(0,player.cmCd-dt);
  player.periscopeCd=Math.max(0,player.periscopeCd-dt);
  tickMasts(dt);
  tickEsmScan(dt);
  tickRadarSweep(dt);
  player.periscopeT=Math.max(0,player.periscopeT-dt);
  player.invuln=Math.max(0,player.invuln-dt);
  _DMG.tick(dt);
  tickHydrogen(dt);
  tickChlorine(dt);
  tickWatchFatigue(dt);
  if(session.hitFlash>0) session.hitFlash=Math.max(0,session.hitFlash-dt*2.5);
  player.sonarPulse=Math.max(0,player.sonarPulse-dt);
  session.missionT=(session.missionT||0)+dt;
  session.msgT=Math.max(0,session.msgT-dt); if(session.msgT<=0) session.msg="";

  // -- TDC: update solution from designated target ---------------------------
  // Solution quality is continuous -- no binary freeze/unfreeze.
  // Contacts persist; quality drives what data is available.
  {
    const _tdc=session.tdc||tdc;
    const ref=_tdc.target;

    // Validity checks -- clear only if target truly gone
    if(ref){
      if(ref._isTorp){
        if(!bullets.includes(ref)||ref.life<=0){ _tdc.target=null; _tdc.targetId=null; }
      } else if(!ref.dead && !enemies.includes(ref)){
        _tdc.target=null; _tdc.targetId=null;
      }
    }

    // Frozen only means confirmed kill -- data persists for reference
    _tdc.frozen = (_tdc.target?.dead===true);

    if(_tdc.target && !_tdc.frozen){
      const ref=_tdc.target;
      const sc=ref._isTorp ? null : sonarContacts?.get(ref);
      const tmaQ=sc?.tmaQuality??1.0;
      const TMA=C.tma;

      // Purely bearing-based TDC. No position stored or used -- ever.
      // Quality drives the confidence tier shown to player and fire permission.
      // SOLID fires on latest bearing with lead-angle from estimated bearing rate.
      // DEGRADED fires directly on raw bearing. BEARING blocks fire.
      const bestBrg = sc ? (sc.latestHullBrg ?? sc.latestBrg) : null;
      if(sc && bestBrg!=null){
        _tdc.rawBrg = ((Math.atan2(Math.cos(bestBrg), -Math.sin(bestBrg))*180/Math.PI)+360)%360;
      } else {
        _tdc.rawBrg = null;
      }
      // DEP: read from sonar contact's smoothed estimate (computed in sensors.js tickContacts).
      // This avoids per-frame noise jitter -- the estimate drifts slowly instead.
      _tdc.depth = sc?._estDepth ?? null;
      _tdc.tmaQuality=tmaQ;

      // Populate range, course, speed estimates from TMA data where available.
      // These are bearing-only estimates -- accuracy depends on TMA quality.
      // Shown as approximate; only populated at DEGRADED or better.
      if(sc && tmaQ>=TMA.qualityThresholdRange){
        const estRange=sc._estRange??null;
        _tdc.range=estRange!=null ? Math.round(estRange) : null;

        // Speed estimate: at SOLID tier, use bearing rate x range / own-speed geometry
        // v_target ~ brgRate * range (for targets moving roughly cross-track)
        // Clamp to realistic sub speeds
        const brgRate=sc._brgRate??null;
        if(brgRate!=null && estRange!=null && tmaQ>=TMA.qualityThresholdSolid){
          const rawSpd=Math.abs(brgRate)*estRange; // wu/s
          _tdc.speed=Math.round(clamp(rawSpd,0,30));
        } else {
          _tdc.speed=null;
        }

        // Course estimate: direction the target appears to be moving.
        // If bearing is increasing, target is moving left-to-right relative to us;
        // project course as 90deg offset from bearing (rough but directionally correct).
        if(brgRate!=null && bestBrg!=null && tmaQ>=TMA.qualityThresholdSolid){
          const compassBrg=((Math.atan2(Math.cos(bestBrg),-Math.sin(bestBrg))*180/Math.PI)+360)%360;
          // Positive brgRate = target moving right (clockwise), so course is brg+90
          const courseOffset=brgRate>0?90:-90;
          _tdc.course=((compassBrg+courseOffset)+360)%360;
        } else {
          _tdc.course=null;
        }
      } else {
        _tdc.range=null; _tdc.course=null; _tdc.speed=null;
      }

      // Bearing rate: compute from last two hull bearings to get lead angle
      // Only used for SOLID tier -- DEGRADED just uses raw bearing directly
      let intBearing=null;
      if(tmaQ>=TMA.qualityThresholdSolid && bestBrg!=null){
        const brgRate=sc._brgRate??0; // rad/s, computed in passiveUpdate
        // Lead angle: torpedo flight time * bearing rate gives angular correction
        const torpSpd=C.torpedo.speed;
        const estRange=(sc._estRange??TMA.defaultRange);
        const tof=estRange/torpSpd;
        intBearing=bestBrg + brgRate*tof*0.6; // 0.6 damp -- we're estimating
      } else if(bestBrg!=null && tmaQ>=TMA.qualityThresholdRange){
        intBearing=bestBrg; // DEGRADED: no lead, fire down the bearing
      }
      _tdc.intercept=intBearing!=null ? intBearing : null;
    }
  }

  // -- ASCM solution -- best available surface contact -----------------------
  // Promoted from sonarContacts; quality >= 0.20 minimum gate.
  // TDC-designated surface contact takes priority over best passive contact.
  {
    const _sc=sonarContacts;
    let bestE=null, bestSc=null;
    if(_sc) for(const [e,sc] of _sc){
      if(e.dead||e.civilian||e.type!=='boat') continue;
      if((sc.tmaQuality||0)<0.20) continue;
      if(!bestSc||(sc.tmaQuality||0)>(bestSc.tmaQuality||0)){ bestE=e; bestSc=sc; }
    }
    // TDC designation overrides best if it's a valid surface contact
    const tdcE=(session.tdc||tdc)?.target;
    if(tdcE&&tdcE.type==='boat'&&!tdcE.dead){
      const sc=_sc?.get(tdcE);
      if(sc&&(sc.tmaQuality||0)>=0.20){ bestE=tdcE; bestSc=sc; }
    }
    if(bestSc){
      const lb=bestSc.latestBrg;
      const compassBrg=lb!=null?(((Math.atan2(Math.cos(lb),-Math.sin(lb))*180/Math.PI)+360)%360):null;
      session.ascmSolution={
        contactId:bestSc.id,
        bearing:compassBrg,
        range:bestSc._estRange??null,
        quality:bestSc.tmaQuality||0,
        source:'TMA',
        ref:bestE,
      };
    } else {
      session.ascmSolution=null;
    }
  }

  // ── Stadimeter tick (from player-control) ──────────────────────────────
  tickStadimeter(dt);

  // -- Missile flight tick ---------------------------------------------------
  for(let _mi=missiles.length-1;_mi>=0;_mi--){
    const _m=missiles[_mi];
    const _res=_MSL?.update(_m,dt,enemies);
    if(_res==='hit'){
      const _e=_m.target;
      // CIWS intercept roll -- Slava/Udaloy/Krivak/Grisha all have cwis
      let _intercepted=false;
      if(_e?.cwis){
        const _pk=1-Math.pow(1-(_e.cwis.pKillPerSec||0.6),0.5);
        if(Math.random()<_pk) _intercepted=true;
      }
      if(_intercepted){
        _COMMS.weapons.missileDefeat(_e.subClass||'TARGET');
        _W.makeExplosion(_m.x,_m.y,0.6,false);
      } else {
        damageEnemy(_e,_m.warheadDmg);
        _COMMS.weapons.missileHit(_e.subClass||'TARGET');
      }
      missiles.splice(_mi,1);
    } else if(_res==='miss'){
      _COMMS.weapons.missileMiss();
      _W.makeExplosion(_m.x,_m.y,0.5,false);
      missiles.splice(_mi,1);
    }
  }

  for(const e of enemies){
    if(e.seen>0) e.seen=Math.max(0,e.seen-dt);
    if(e.detectedT>0) e.detectedT=Math.max(0,e.detectedT-dt);
    if(e.pingPulse>0) e.pingPulse=Math.max(0,e.pingPulse-dt);
    if(e.evadeT>0){e.evadeT=Math.max(0,e.evadeT-dt); if(e.evadeT<=0){e.evadeFrom=null;e.evadeDecoy=null;e._evadePhase=null;e._cfPhase=null;e._cfT=0;e._boldDone=false;}}
    // Golf-class snorkel cycle -- diesel SSBN must snorkel to recharge battery
    // Noise spike injected in updateEnemyNoise() via e._snorkeling flag
    if(e.subClass==='GOLF' && e._snorkelCd!==undefined){
      e._snorkelCd-=dt;
      if(e._snorkelCd<=0){
        e._snorkeling=!e._snorkeling;
        e._snorkelCd=e._snorkeling ? rand(60,90) : rand(120,180); // snorkel 60-90s, battery 120-180s
      }
    }
    // Fire adaptation reset -- timeout or player course change
    if(e._missCount>0){
      const aCfg=C.enemy.adaptation||{};
      if(e._lastMissT && (session.missionT-e._lastMissT)>(aCfg.resetTimeout??60)) e._missCount=0;
      const hdgDelta=Math.abs(angleNorm(player.heading-(e._lastPlayerHdg??player.heading)))*180/Math.PI;
      if(hdgDelta>(aCfg.resetCourseDeg??30)) e._missCount=0;
    }
    e._lastPlayerHdg=player.heading;
  }

  if(!session.over){
    // ── Player physics: NAV/SIG + cavitation + tube reload log ────────────
    tickNavSig(dt);

    // -- WEPS solution -- proposed firing bearing from TDC data ---------------
    {
      const _tdc=session.tdc||tdc;
      if(_tdc.target && !_tdc.target.dead){
        const q=_tdc.tmaQuality??0;
        const TMA=C.tma;
        let bearing, confidence, depth;
        if(q>=TMA.qualityThresholdSolid && _tdc.intercept!=null){
          // SOLID: reliable position + lead-angle intercept
          bearing=_tdc.intercept; confidence='solid'; depth=_tdc.depth??player.depth;
        } else if(q>=TMA.qualityThresholdRange && _tdc.rawBrg!=null){
          // DEGRADED: bearing only -- direct observed bearing, no lead angle
          const brgMath=(_tdc.rawBrg-90)*Math.PI/180;
          bearing=brgMath; confidence='degraded'; depth=_tdc.depth??player.depth;
        } else if(_tdc.rawBrg!=null){
          // POOR: show bearing but block fire
          const brgMath=(_tdc.rawBrg-90)*Math.PI/180;
          bearing=brgMath; confidence='bearingonly'; depth=player.depth;
        } else {
          bearing=null;
        }
        ui.wepsProposal=bearing!=null?{bearing,confidence,depth}:null;
      } else {
        ui.wepsProposal=null;
      }
    }

    // ── Firing inputs (from player-control) ──────────────────────────────
    tickFiringInputs(dt, cam);

    // -- Inbound torpedo crew alert system ------------------------------------
    // Four escalating phases, each fires once per torpedo.
    // _crewPhase: 0=undetected, 1=CONTACT, 2=SEARCHING, 3=CLOSING, 4=ATTACK
    for(const b of bullets){
      if(b.kind!=='torpedo'||b.friendly||b.life<=0) continue;
      if(!b._crewPhase) b._crewPhase=0;

      const dx=_AI.wrapDx(b.x,player.wx), dy=b.y-player.wy;
      const dist=Math.hypot(dx,dy);
      const brgMath=Math.atan2(dy,dx);
      const brgDeg=((Math.atan2(dx,dy)*180/Math.PI)+360)%360;
      const brgStr=Math.round(brgDeg).toString().padStart(3,'0');

      // -- Phase 1: CONTACT -- torpedo first heard acoustically ---------------
      if(b._crewPhase<1){
        const detectRange=1200;
        if(dist>detectRange){ b._crewPhase=0; continue; }
        const torpNoise=0.85;
        const layer=_AI.layerPenalty(player.depth, b.depth??200);
        const signal=torpNoise*layer*(1-dist/detectRange);
        const detect=signal-player.noise*0.80;
        if(detect<=0) continue;
        const pDetect=clamp(0.08+detect*0.60, 0, 0.85)*dt;
        if(Math.random()<pDetect){
          b._alertedPlayer=true;
          b._crewPhase=1;
          contacts.push({fromX:player.wx,fromY:player.wy,bearing:brgMath,u_brg:0.12,life:3.0,kind:'torpedo'});
          _COMMS.combat.torpedoInWater(brgStr);
          // Auto action stations on torpedo detection
          if(setTacticalState('action')){
            _COMMS.crewState.actionStations('torpedo');
          }
        }
        continue;
      }

      // Detected -- keep bearing flash updated
      if(b._brgFlashT==null) b._brgFlashT=0;
      b._brgFlashT=(b._brgFlashT||0)-dt;
      if(b._brgFlashT<=0){
        b._brgFlashT=rand(1.2,2.0);
        contacts.push({fromX:player.wx,fromY:player.wy,bearing:brgMath,u_brg:0.08,life:2.5,kind:'torpedo'});
      }

      // -- Phase 2: SEARCHING -- seeker active, torpedo hunting ---------------
      if(b._crewPhase<2){
        const seekerOn=b.traveled>=(b.enableDist||300);
        if(seekerOn && dist<800){
          b._crewPhase=2;
          _COMMS.combat.seekerActive(brgStr);
        }
      }

      // -- Phase 3: CLOSING -- high closing rate inside 450wu -----------------
      if(b._crewPhase<3 && b._crewPhase>=2){
        const vToPlayer=(b.vx*(-dx)+b.vy*(-dy))/Math.max(dist,1);
        const closing=vToPlayer>8;
        if(closing && dist<450){
          b._crewPhase=3;
          const torpRelAng=angleNorm(brgMath-player.heading);
          const turnDir=torpRelAng>0?'LEFT':'RIGHT';
          // Reciprocal bearing -- turn TOWARD the torpedo, not away
          const recipDeg=Math.round((brgDeg+180)%360).toString().padStart(3,'0');
          _COMMS.combat.torpedoClosing(brgStr, recipDeg);
        }
      }

      // -- Phase 4: ATTACK -- seeker locked on player -------------------------
      if(b._crewPhase<4 && b._crewPhase>=2){
        if(b.target===player){
          b._crewPhase=4;
          const torpRelAng=angleNorm(brgMath-player.heading);
          const turnDir=torpRelAng>0?'LEFT':'RIGHT';
          const recipDeg2=Math.round((brgDeg+180)%360).toString().padStart(3,'0');
          _COMMS.combat.weaponAcquisition(brgStr, recipDeg2);
          contacts.push({fromX:player.wx,fromY:player.wy,bearing:brgMath,u_brg:0.04,life:4.0,kind:'torpedo'});
        }
      }
    }
    if(_I.justPressed('activePing')&&player.pingCd<=0){ if(player.scram){ _COMMS.ui.sonarOffline(); } else { _SENSE.activePing(); _COMMS.ui.ping(); } }
    _SENSE.passiveUpdate(dt);
    _SENSE.towedArrayUpdate(dt);

    // -- Towed array position trail -------------------------------------------
    // Store player positions so the cable can follow the actual path taken.
    // Each entry: {wx, wy} sampled every ~0.12s. We keep enough history to cover
    // the full deployed cable length at any speed.
    {
      const ta = player.towedArray;
      if(!player._cableTrail) player._cableTrail = [];
      const trail = player._cableTrail;

      // Sample interval -- finer = smoother curve, 0.10s is plenty
      player._cableTrailT = (player._cableTrailT||0) - dt;
      if(player._cableTrailT <= 0){
        player._cableTrailT = 0.10;
        trail.unshift({wx: player.wx, wy: player.wy});
        // Max entries: cable deploys at ~13wu/s max speed over 400wu = ~30s of trail
        // At 0.10s intervals that's 300 entries -- keep 400 for margin
        if(trail.length > 800) trail.length = 800;
      }

      // When retracting, shrink the effective length so cable visually reels in
      // When stowed/destroyed, clear the trail
      if(!ta || ta.state === 'stowed' || ta.state === 'destroyed'){
        player._cableTrail = [];
      }
    }

    // Towed array speed warning -- alert before damage threshold
    {
      const ta = player.towedArray;
      if((ta.state==='operational'||ta.state==='damaged') && player.speed >= 16 && player.speed < 18){
        if(!ta._warnedSpeed){
          ta._warnedSpeed = true;
          _COMMS.nav.towedArrayOverspeed(player.speed);
        }
      } else {
        ta._warnedSpeed = false;
      }
    }
  }

  // -- Civilian ship spawning -- random traffic in all combat scenarios --------
  if(session.scenario!=='free_run'){
    session._civSpawnT=(session._civSpawnT||0)-dt;
    if(session._civSpawnT<=0){
      session._civSpawnT=rand(40,90); // spawn every 40-90s
      const civCount=enemies.filter(e=>e.civilian&&!e.dead).length;
      if(civCount<4){ // cap at 4 civilians at a time
        const types=['TANKER','CARGO','CARGO','FISHING','FISHING','FERRY'];
        _AI.spawnCivilian(types[Math.floor(Math.random()*types.length)]);
      }
    }
    // Remove civilians that have left the world bounds (far from player)
    for(let i=enemies.length-1;i>=0;i--){
      const e=enemies[i];
      if(!e.civilian) continue;
      const dx=_AI.wrapDx(player.wx,e.x), dy=e.y-player.wy;
      if(Math.hypot(dx,dy)>world.w*0.45) enemies.splice(i,1);
    }
  }

  // -- Sonobuoy tick -- independent sensors dropped by ASW ships --------------
  for(let i=buoys.length-1;i>=0;i--){
    const b=buoys[i];
    b.life-=dt;
    if(b.life<=0 || (b.parent && b.parent.dead)){ buoys.splice(i,1); continue; }
    // Active buoy pings
    b.pingCd=(b.pingCd||0)-dt;
    b.pingPulse=Math.max(0,(b.pingPulse||0)-dt);
    if(b.pingCd<=0){
      b.pingCd=rand(b.pingInterval[0],b.pingInterval[1]);
      b.pingPulse=1.0;
      // Check if player is within buoy detection range
      const dxp=_AI.wrapDx(player.wx,b.x), dyp=player.wy-b.y;
      const dp=Math.hypot(dxp,dyp);
      const buoyRange=1600; // Soviet sonobuoys (RGB series) -- shorter range than NATO DIFAR
      // Buoy is below layer -- no layer penalty against deep targets
      const sonarDepth=b.depth||300;
      const layer=_AI.layerPenalty(player.depth,sonarDepth);
      if(dp<buoyRange && layer>=0.85){
        // Buoy gets a return -- feed data to parent ship from buoy's position
        const parent=b.parent;
        if(parent && !parent.dead){
          _AI.enemyUpdateContactFromPing(parent,player.wx,player.wy,dp,{x:b.x,y:b.y,depth:b.depth});
          if(parent.pingPulse<=0) parent.pingPulse=0.6;
          _AI.shipShareContact(parent,player.wx,player.wy,160+dp*0.10);
        }
      }
    }
  }

  // -- Sonobuoy deployment -- ASW ships drop buoys along their track ----------
  for(const e of enemies){
    if(e.dead || e.civilian || !e._sonobuoyCfg) continue;
    const cfg=e._sonobuoyCfg;
    e._buoyDropT=(e._buoyDropT||rand(cfg.interval[0],cfg.interval[1]))-dt;
    if(e._buoyDropT<=0){
      e._buoyDropT=rand(cfg.interval[0],cfg.interval[1]);
      const activeBuoys=buoys.filter(b=>b.parent===e).length;
      if(activeBuoys<cfg.maxActive){
        buoys.push({
          x:e.x, y:e.y, depth:cfg.buoyDepth||300,
          life:cfg.buoyLife||120,
          pingCd:rand(cfg.pingCd[0],cfg.pingCd[1]),
          pingInterval:cfg.pingCd,
          pingPulse:0,
          parent:e,
        });
        // Player hears the splash -- bearing from player to buoy
        const bdx=_AI.wrapDx(player.wx,e.x), bdy=e.y-player.wy;
        if(Math.hypot(bdx,bdy)<4000){
          const bbrg=((Math.atan2(bdx,bdy)*180/Math.PI)+360)%360;
          _COMMS.tactical.buoySplash(Math.round(bbrg).toString().padStart(3,'0')+'°');
        }
      }
    }
  }

  // -- ASW Helicopter tick -- dipping sonar platform --------------------------
  for(const e of enemies){
    if(e.dead || e.civilian || !e._heloCfg) continue;
    if(!e._helo) e._helo={state:'deck', x:e.x, y:e.y, fuelT:e._heloCfg.fuel||120, refuelT:0, pingCd:rand(6,10), pingPulse:0, torpCd:rand(20,40), torpStock:e._heloCfg.torpStock??0};
    const h=e._helo;
    h.pingPulse=Math.max(0,(h.pingPulse||0)-dt);
    h.torpCd=Math.max(0,(h.torpCd||0)-dt);
    const heloSpd=80; // ~80 wu/s -- fast transit
    const cfg=e._heloCfg;

    if(h.state==='deck'){
      h.x=e.x; h.y=e.y;
      if(h.refuelT>0){ h.refuelT-=dt; }
      else {
        // Launch when parent has suspicion
        if(e.suspicion>=(cfg.launchSus||0.15) && e.contact){
          h.state='transit';
          h.targetX=e.contact.x; h.targetY=e.contact.y;
          h.fuelT=cfg.fuel||120;
          // Player hears helicopter launch -- bearing from player to ship
          const hdx=_AI.wrapDx(player.wx,e.x), hdy=e.y-player.wy;
          if(Math.hypot(hdx,hdy)<5000){
            const hbrg=((Math.atan2(hdx,hdy)*180/Math.PI)+360)%360;
            _COMMS.tactical.heloContact(Math.round(hbrg).toString().padStart(3,'0')+'°');
          }
        }
      }
    } else if(h.state==='transit'){
      h.fuelT-=dt;
      const dx=_AI.wrapDx(h.x,h.targetX), dy=h.targetY-h.y;
      const d=Math.hypot(dx,dy);
      if(d<150){
        h.state='hover';
        // Player hears dipping sonar deploy -- bearing from player to helo
        const ddx=_AI.wrapDx(player.wx,h.x), ddy=h.y-player.wy;
        if(Math.hypot(ddx,ddy)<4000){
          const dbrg=((Math.atan2(ddx,ddy)*180/Math.PI)+360)%360;
          _COMMS.tactical.dipSonar(Math.round(dbrg).toString().padStart(3,'0')+'°');
        }
      } else {
        const ang=Math.atan2(dy,dx);
        h.x=h.x+Math.cos(ang)*heloSpd*dt;
        h.y=h.y+Math.sin(ang)*heloSpd*dt;
      }
      if(h.fuelT<=20) h.state='rth'; // bingo fuel
    } else if(h.state==='hover'){
      h.fuelT-=dt;
      // Dipping sonar -- ping from below the layer
      h.pingCd-=dt;
      if(h.pingCd<=0){
        h.pingCd=rand(6,10);
        h.pingPulse=1.0;
        const dxp=_AI.wrapDx(player.wx,h.x), dyp=player.wy-h.y;
        const dp=Math.hypot(dxp,dyp);
        const dipRange=1900; // Ka-27 dipping sonar (VGS-3) -- shorter range than NATO LAMPS
        const dipDepth=cfg.dipDepth||340;
        const layer=_AI.layerPenalty(player.depth,dipDepth);
        if(dp<dipRange && layer>=0.85){
          _AI.enemyUpdateContactFromPing(e,player.wx,player.wy,dp,{x:h.x,y:h.y,depth:dipDepth});
          _AI.shipShareContact(e,player.wx,player.wy,160+dp*0.10);
        }
      }
      // Re-target if parent has updated contact
      if(e.contact){
        const dxc=_AI.wrapDx(h.x,e.contact.x), dyc=e.contact.y-h.y;
        if(Math.hypot(dxc,dyc)>500){
          h.targetX=e.contact.x; h.targetY=e.contact.y;
          h.state='transit';
        }
      }

      // -- Torpedo drop -- armed ASW torpedo, search pattern from datum --------
      // Helo has direct sensor contact -- don't need full ship TMA gate.
      // Fresh contact + adequate suspicion is sufficient for a drop.
      const _heloContactAge = e.contact ? (now() - e.contact.t) : 999;
      if(cfg.hasTorp && h.torpStock>0 && h.torpCd<=0 &&
         e.contact && _heloContactAge<12 && e.suspicion>=0.45){
        const ddx=_AI.wrapDx(h.x,e.contact.x), ddy=e.contact.y-h.y;
        if(Math.hypot(ddx,ddy)<1800){
          _W.fireTorpedo(h.x,h.y, ddx,ddy, false,0, false,0, 5,cfg.dipDepth,
            {life:90, speed:38, seekRange:380, dmg:28});
          h.torpStock--;
          h.torpCd=rand(40,70);
          // Player sonar report if within earshot
          const pdx=_AI.wrapDx(player.wx,h.x), pdy=h.y-player.wy;
          if(Math.hypot(pdx,pdy)<4500){
            const brg=Math.round(((Math.atan2(pdx,pdy)*180/Math.PI)+360)%360);
            _COMMS.tactical.heloDrop(brg.toString().padStart(3,'0')+'°');
          }
        }
      }

      if(h.fuelT<=20) h.state='rth'; // bingo fuel
    } else if(h.state==='rth'){
      h.fuelT-=dt*0.5; // conserve fuel on return
      const dx=_AI.wrapDx(h.x,e.x), dy=e.y-h.y;
      const d=Math.hypot(dx,dy);
      if(d<100){
        h.state='deck';
        h.refuelT=cfg.refuel||75;
      } else {
        const ang=Math.atan2(dy,dx);
        h.x=h.x+Math.cos(ang)*heloSpd*dt;
        h.y=h.y+Math.sin(ang)*heloSpd*dt;
      }
      if(h.fuelT<=0){ h.state='deck'; h.refuelT=cfg.refuel||75; }
    }
    // If parent ship is sunk while helo is airborne, helo is lost
    if(e.dead && h.state!=='deck'){ h.state='deck'; h.fuelT=0; }
  }

  // enemies
  for(const e of enemies){
    // -- Civilian ships -- simple straight-line transit, no combat AI ----------
    if(e.civilian){
      _AI.updateEnemyNoise(e);
      e.x=e.x+e.vx*dt;
      e.y=e.y+e.vy*dt;
      // Occasional gentle heading change (fishing boats more erratic)
      e.navT=(e.navT||0)-dt;
      if(e.navT<=0){
        const maxTurn=e.civType==='FISHING'?Math.PI*0.4:Math.PI*0.08;
        e.heading=(e.heading||0)+rand(-maxTurn,maxTurn);
        const spd=Math.hypot(e.vx,e.vy);
        e.vx=Math.cos(e.heading)*spd;
        e.vy=Math.sin(e.heading)*spd;
        e.navT=e.civType==='FISHING'?rand(30,90):rand(120,400);
      }
      continue; // skip all combat AI
    }

    _AI.enemyMaybeHearPlayer(e,dt);
    _AI.enemyDecay(e,dt);
    _AI.updateEnemyNoise(e);
    if(e.type==='boat') _AI.shipActiveSonar(e,dt);

    const state=(e.suspicion>C.enemy.susEngage)?"engage":(e.suspicion>C.enemy.susInvestigate?"investigate":"patrol");

    if(e.type==="boat"){
      // -- Surface ships: 2D top-down movement using heading + physics model --
      e.x+=e.vx*dt;
      e.y+=e.vy*dt;
      e.hitY=0;

      // Initialise heading from spawn velocity on first frame
      if(!e._boatInit){
        const spd=Math.hypot(e.vx,e.vy);
        if(spd>0.1) e.heading=Math.atan2(e.vy,e.vx);
        e._patrolSpd=spd||12;
        e._boatInit=true;
      }

      const patrolSpd=e._patrolSpd||12;
      const contactAge=e.contact?(now()-e.contact.t):999;
      const maxTurnRate=(e._turnRate??0.06)*dt; // rad/frame -- same model as subs

      let desiredHeading=e.heading||0;
      let targetSpd=patrolSpd;

      // -- DC Attack state machine --------------------------------------------
      // States: idle -> run -> drop -> reform
      if(!e._atkState) e._atkState='idle';
      e._dropCd=Math.max(0,(e._dropCd||0)-dt);
      e._atkCooldown=Math.max(0,(e._atkCooldown||0)-dt);

      if(e._atkState==='idle'){
        // -- Idle steering: contact chase -> hunt-state search -> normal wander --
        if(state!=='patrol' && e.contact && contactAge<30){
          // Fresh contact -- steer toward it, reset sector search
          const cdx=_AI.wrapDx(e.x,e.contact.x), cdy=e.contact.y-e.y;
          desiredHeading=Math.atan2(cdy,cdx);
          e._atDatum=false;
        } else if(e._huntState && e._huntDatum){
          // Hunt state with no fresh contact -- datum hold then sector expand
          const asw=C.enemy.asw;
          const hdx=_AI.wrapDx(e.x,e._huntDatum.x), hdy=e._huntDatum.y-e.y;
          const distToDatum=Math.hypot(hdx,hdy);
          if(!e._atDatum){
            // Phase 1: return to datum
            if(distToDatum>200){
              desiredHeading=Math.atan2(hdy,hdx);
            } else {
              e._atDatum=true;
              e._datumHoldT=asw.datumHoldTime;
              e._sectorRange=0;
            }
          } else {
            e._datumHoldT=Math.max(0,(e._datumHoldT||0)-dt);
            if(e._datumHoldT>0){
              // Phase 2: datum hold -- slow orbit in place
              if(distToDatum>250){
                desiredHeading=Math.atan2(hdy,hdx);
              } else {
                e.navT=(e.navT||0)-dt;
                if(e.navT<=0){ e._idleHeading=Math.random()*Math.PI*2; e.navT=rand(20,40); }
                desiredHeading=e._idleHeading??e.heading;
              }
            } else {
              // Phase 3: sector search -- expand outward on assigned bearing
              if(e._sectorBearing!=null){
                e._sectorRange=(e._sectorRange||0)+asw.sectorExpandRate*dt;
                const sweepT=(session.missionT||0)*0.06;
                const sectorArc=e._sectorArc||(asw.sectorArcDeg*Math.PI/180);
                const sweepAngle=Math.sin(sweepT+e._sectorBearing*2)*sectorArc*0.45;
                const tgtX=e._huntDatum.x+Math.cos(e._sectorBearing+sweepAngle)*e._sectorRange;
                const tgtY=e._huntDatum.y+Math.sin(e._sectorBearing+sweepAngle)*e._sectorRange;
                const sdx=_AI.wrapDx(e.x,tgtX), sdy=tgtY-e.y;
                desiredHeading=Math.atan2(sdy,sdx);
              } else {
                // Support/screen ship -- orbit near coordinator
                const coord=enemies.find(s=>s!==e&&!s.dead&&!s.civilian&&s.type==='boat'&&s.role==='pinger'&&s._huntState);
                e.navT=(e.navT||0)-dt;
                if(e.navT<=0){
                  if(coord){
                    const ang=Math.atan2(coord.y-e.y,_AI.wrapDx(e.x,coord.x));
                    e._idleHeading=ang+rand(-0.8,0.8);
                  } else {
                    e._idleHeading=Math.random()*Math.PI*2;
                  }
                  e.navT=rand(60,120);
                }
                desiredHeading=e._idleHeading??e.heading;
              }
            }
          }
        } else {
          // Normal patrol wander
          e.navT=(e.navT||0)-dt;
          if(e.navT<=0){
            e._idleHeading=Math.random()*Math.PI*2;
            e.navT=rand(40,100);
          }
          desiredHeading=e._idleHeading??e.heading;
        }
        // Commit to an attack run when: decent contact, sub is deep enough, not on cooldown
        if(e.contact && contactAge<25 && e.suspicion>=0.32
           && player.depth>80 && e._atkCooldown<=0){
          e._atkAim={x:e.contact.x, y:e.contact.y};
          e._atkDropsLeft=Math.round(rand(3,6));
          e._atkRunSpd=clamp(patrolSpd*rand(1.3,1.6),22,55);
          e._atkState='run';
        }

      } else if(e._atkState==='run'){
        // Committed attack run -- charge toward datum
        if(e.contact && contactAge<6){
          e._atkAim.x=e.contact.x;
          e._atkAim.y=e.contact.y;
        }
        if(contactAge>40){ e._atkState='idle'; }
        else {
          const cdx=_AI.wrapDx(e.x,e._atkAim.x), cdy=e._atkAim.y-e.y;
          desiredHeading=Math.atan2(cdy,cdx);
          targetSpd=e._atkRunSpd;
          if(Math.hypot(cdx,cdy)<120){ e._atkState='drop'; e._dropCd=0; }
        }

      } else if(e._atkState==='drop'){
        // Dropping stick -- maintain attack speed, drop at intervals
        if(e._dropCd<=0 && e._atkDropsLeft>0){
          _W.dropDepthCharge(
            e.x+rand(-35,35),
            0,                              // drop from surface
            player.depth+rand(-100,100)     // target estimated depth
          );
          e._atkDropsLeft--;
          e._dropCd=rand(0.7,1.1);
        }
        if(e._atkDropsLeft<=0){
          e._atkState='reform';
          e._atkReformT=rand(20,40);
          e._atkCooldown=rand(15,30); // prevent immediate re-attack
        }

      } else if(e._atkState==='reform'){
        // Post-attack: maintain course, slow back to patrol speed
        e._atkReformT-=dt;
        if(e._atkReformT<=0) e._atkState='idle';
        targetSpd=patrolSpd;
      }

      // -- Apply heading turn (rate-limited, same model as subs) --------------
      const headingErr=angleNorm(desiredHeading-(e.heading||0));
      e.heading=(e.heading||0)+clamp(headingErr,-maxTurnRate,maxTurnRate);

      // -- Apply speed (tau-based acceleration, same model as subs) -----------
      const curSpd=Math.hypot(e.vx,e.vy);
      const shipTau=curSpd<targetSpd?60:30;
      const newSpd=curSpd+(targetSpd-curSpd)/shipTau*dt;
      e.vx=Math.cos(e.heading)*newSpd;
      e.vy=Math.sin(e.heading)*newSpd;

      // -- ASROC fire -- range-gated missile torpedo on contact (own or shared) -
      if(e._hasAsroc){
        const acfg=C.enemy.asroc;
        e._asrocCd=Math.max(0,(e._asrocCd||rand(acfg.fireCd[0],acfg.fireCd[1]))-dt);
        if(e._asrocCd<=0 && e.contact && !session.over){
          const aAge=now()-e.contact.t;
          if(aAge<acfg.contactMaxAge && e.suspicion>=acfg.susThresh){
            const adx=_AI.wrapDx(e.x,e.contact.x), ady=e.contact.y-e.y;
            const adist=Math.hypot(adx,ady);
            if(adist>=acfg.minRange && adist<=acfg.maxRange){
              _W.fireMissileTorpedo(e.x,e.y,e.contact.x,e.contact.y);
              e._asrocCd=rand(acfg.fireCd[0],acfg.fireCd[1]);
              _COMMS.tactical.asrocLaunch?.();
            }
          }
        }
      }

      // -- Torpedo fire (close-range, requires TMA solution) ------------------
      e.fireCd-=dt;
      if(e.fireCd<=0 && !session.over && e.contact){
        const t=(state==="engage")?C.enemy.boatFireEngage:C.enemy.boatFireOther;
        e.fireCd=rand(t[0],t[1]);
        const dx=_AI.wrapDx(e.x,e.contact.x);
        const d=Math.hypot(dx,e.contact.y-e.y);
        if(d<1650 && _AI.enemyHasFireSolution(e) && (e._torpStock??0)>0){
          _W.fireTorpedo(e.x,e.y,dx,e.contact.y-e.y,false,260,false,0,0,null,{
            speed:C.enemy.boatTorpSpeed??38, life:C.enemy.boatTorpLife??90,
            dmg:C.enemy.boatTorpDmg??28, seekRange:C.enemy.boatTorpSeek??380,
          });
          e._torpStock--;
        }
      }

      // -- Torpedo reaction -- noisemaker decoys + speed jink -----------------
      e.flareCd=Math.max(0,(e.flareCd||0)-dt);
      for(const b of bullets){
        if(b.kind!=="torpedo"||!b.friendly||b.life<=0||b._alertedEnemy===e) continue;
        const dx=_AI.wrapDx(e.x,b.x);
        const dy=b.y-e.hitY;
        const dd=Math.hypot(dx,dy);
        if(dd>C.enemy.boatTorpReactR) continue;
        const signal=0.90*(1-dd/C.enemy.boatTorpReactR);
        const pDetect=clamp(0.12+signal*0.65,0,0.90)*dt;
        if(Math.random()>pDetect) continue;
        b._alertedEnemy=e;
        e.suspicion=Math.min(1,e.suspicion+0.15);
        if(e.flareCd<=0){
          e.flareCd=rand(3.5,6.0);
          _W.deployDecoy(wrapX(e.x+rand(-30,30)),e.hitY+rand(10,30),false,"noisemaker",{vx:rand(-2,2),vy:rand(2,5)});
          _COMMS.ui.shipCountermeasures();
        }
      }
    } else {
      // -- Enemy submarine movement -------------------------------------------
      e.x=e.x+e.vx*dt;
      e.y=e.y+e.vy*dt;

      // -- Desired heading -- TMA-aware state machine -------------------------
      // States: patrol -> investigate (hearing something) -> tma-build (deliberate
      // cross-track sprint to build baseline) -> engage (sprint+fire on solution)
      let desiredHeading=e.heading||0;
      e.navT=(e.navT||0)-dt;

      const tmaQ=e.tmaQuality||0;
      const hasFix=tmaQ>=0.35;     // good enough to close
      const hasShot=tmaQ>=0.45;    // good enough to fire

      if(e.evadeT>0 && e.evadeFrom){
        // -- B+C EVASION: Layer exploitation + Knuckle sprint-stop -------------
        // Phase structure stored on e._evadePhase:
        //   'sprint1' -> flank sprint away from torpedo (8-12s)
        //   'knuckle' -> cut to near-stop, drop CM, let knuckle fade (5-7s)
        //   'sprint2' -> sprint in new direction to open range
        // Layer logic: pick a target depth on the other side of the layer from torpedo.

        if(!e._evadePhase){
          // First frame of evasion -- initialise phase and pick a layer-exploit depth
          e._evadePhase = 'sprint1';
          e._evadePhaseT = rand(8,12);
          e._boldDone = false;

          // Layer exploitation -- sometimes skip for speed-priority evasion
          const evCfg = C.enemy.evasion||{};
          if(Math.random() >= (evCfg.skipLayerChance??0.25)){
            const layerMid = ((world.layerY1||180)+(world.layerY2||280))/2;
            const torpDepth = e.evadeFrom ? (e.evadeFrom.depth??300) : 300;
            if(torpDepth < layerMid){
              e.depthOrder = rand((world.layerY2||280)+60, (world.layerY2||280)+300);
            } else {
              e.depthOrder = rand(40, (world.layerY1||180)-40);
            }
          }
          // else: keep current depthOrder -- prioritise speed over depth
          e.depthChangeT = 999; // hold this depth through full evasion
        }

        e._evadePhaseT = (e._evadePhaseT||0) - dt;

        // Torpedo direction vector
        const tdx=_AI.wrapDx(e.evadeFrom.x,e.x);
        const tdy=e.y-e.evadeFrom.y;
        const awayAng=Math.atan2(tdy,tdx);
        const perpA=awayAng+Math.PI/2, perpB=awayAng-Math.PI/2;
        const curH=e.heading||0;
        const bestPerp=Math.abs(angleNorm(perpA-curH))<Math.abs(angleNorm(perpB-curH))?perpA:perpB;

        if(e._evadePhase==='sprint1'){
          // Blend away+perp heading at flank speed
          desiredHeading = angleNorm(bestPerp*0.6 + awayAng*0.4);
          if(e._evadePhaseT<=0){
            const evCfg=C.enemy.evasion||{};
            e._evadePhase='knuckle';
            e._evadePhaseT=rand(evCfg.knuckleDurMin??3, evCfg.knuckleDurMax??10);
          }
        } else if(e._evadePhase==='knuckle'){
          // Hold heading, cut speed -- create turbulent knuckle, drop CM here
          // Bold maneuver: small chance to turn TOWARD torpedo briefly (creates confusion)
          const evCfg=C.enemy.evasion||{};
          if(!e._boldDone && Math.random()<(evCfg.boldManeuverChance??0.15)*dt){
            e._boldDone=true;
            desiredHeading = angleNorm(awayAng + Math.PI); // toward torpedo
          } else {
            desiredHeading = curH; // don't turn -- let knuckle form
          }
          if(e._evadePhaseT<=0){
            e._evadePhase='sprint2';
            e._evadePhaseT=rand(12,20);
            // New heading: configurable arc offset from original away angle
            const arcMin=(evCfg.sprint2ArcMin??60)*Math.PI/180;
            const arcMax=(evCfg.sprint2ArcMax??180)*Math.PI/180;
            const sideFlip = Math.random()<0.5 ? 1 : -1;
            e._sprint2Heading = angleNorm(awayAng + sideFlip*rand(arcMin, arcMax));
          }
        } else { // sprint2
          desiredHeading = e._sprint2Heading ?? angleNorm(awayAng + Math.PI/2);
          if(e._evadePhaseT<=0){
            e._evadePhase=null; // evasion sequence complete
          }
        }
        e.navT=0.5;

      } else if(e.role==='ssbn' && (state==='engage'||state==='investigate') && e.contact){
        // SSBN EVASION: run away, go deep, deploy CMs -- never hunt
        const dx=_AI.wrapDx(e.x,e.contact.x), dy=e.contact.y-e.y;
        const awayBrg=Math.atan2(-dy,-dx);
        desiredHeading=angleNorm(awayBrg+rand(-0.3,0.3));
        // Drive deep -- head for crush depth
        if(!e._ssbnEvading){
          e._ssbnEvading=true;
          e.depthOrder=rand(400,500);
        }
        e.tmaPhase='drift'; // never sprint -- stay quiet

      } else if(state==='engage' && e.contact){
        // ENGAGE + TMA BUILD: alternate sprint-cross-track to accumulate baseline
        // Phase: 'drift' = slow cross-track bearing observation
        //        'sprint' = fast run perpendicular to bearing to build baseline
        //        'close'  = sprint toward contact when solution is good
        if(!e.tmaPhase) e.tmaPhase='drift';

        const dx=_AI.wrapDx(e.x,e.contact.x), dy=e.contact.y-e.y;
        const contactBrg=Math.atan2(dy,dx);
        const dist=Math.hypot(dx,dy);

        if(e.tmaPhase==='close' || (hasFix && dist<800)){
          // Close for the kill
          desiredHeading=contactBrg;
          e.tmaPhase='close';
          if(e.navT<=0) e.navT=5;
        } else if(e.tmaPhase==='sprint'){
          // Cross-track sprint -- run perpendicular to bearing for 25-40s
          const perpA=contactBrg+Math.PI/2, perpB=contactBrg-Math.PI/2;
          const curH=e.heading||0;
          const sprintDir=e.tmaManeuverDir||1;
          desiredHeading=sprintDir>0?perpA:perpB;
          if(e.navT<=0){
            // Switch to drift phase -- slow down and listen
            e.tmaPhase='drift';
            e.navT=rand(20,35);
          }
        } else {
          // Drift -- slow and listen, build bearing observations
          desiredHeading=contactBrg; // creep toward contact
          if(e.navT<=0){
            // Contact-loss silence: if contact stale and suspicion low, hold quiet to listen
            const contactFresh=e.contact&&(now()-e.contact.t<C.enemy.contactMaxAge*0.5);
            if(!contactFresh && e.suspicion<0.35){
              // Stay in drift -- go silent and wait for passive to pick something up
              e.navT=rand(25,45);
            } else {
              // Switch to cross-track sprint -- always alternate direction for better baseline
              e.tmaPhase='sprint';
              e.tmaManeuverDir=-(e.tmaManeuverDir||1);
              e.navT=rand(25,40);
            }
          }
        }

      } else if(state==='investigate' && e.contact){
        // INVESTIGATE: slow approach on bearing, start accumulating observations
        if(!e.tmaPhase) e.tmaPhase='drift';
        const dx=_AI.wrapDx(e.x,e.contact.x), dy=e.contact.y-e.y;
        const contactBrg=Math.atan2(dy,dx);

        if(e.tmaPhase==='sprint'){
          const perpA=contactBrg+Math.PI/2, perpB=contactBrg-Math.PI/2;
          const sprintDir=e.tmaManeuverDir||1;
          desiredHeading=sprintDir>0?perpA:perpB;
          if(e.navT<=0){ e.tmaPhase='drift'; e.navT=rand(15,25); }
        } else {
          desiredHeading=contactBrg;
          if(e.navT<=0){
            // After first observation, start cross-track runs
            if((e.playerBearings||[]).length>=2){
              e.tmaPhase='sprint';
              e.tmaManeuverDir=-(e.tmaManeuverDir||1);
              e.navT=rand(20,35);
            } else {
              e.navT=rand(10,18);
            }
          }
        }

      } else {
        // PATROL: long quiet legs
        e.tmaPhase='drift';
        if(e.navT<=0){
          e.navT=rand(C.enemy.subNavT[0], C.enemy.subNavT[1]);
          const maxPatrolTurn=Math.PI*0.33;
          if(e.role==='ssbn'){
            // SSBNs patrol on long straight legs, biased AWAY from player
            e._ssbnEvading=false; // reset evasion flag
            e.navT=rand(300,500); // very long legs
            const tdx=_AI.wrapDx(e.x,player.wx), tdy=player.wy-e.y;
            const awayFromPlayer=Math.atan2(-tdy,-tdx);
            e.patrolHeading=angleNorm(awayFromPlayer+rand(-0.6,0.6));
          } else if(e.role==='pinger'){
            // Pingers maintain cross-track barrier pattern
            e.patrolHeading=angleNorm((e.patrolHeading??e.heading??0)+rand(-maxPatrolTurn,maxPatrolTurn));
          } else {
            // Compute direction toward player, bias new heading that way
            const tdx=_AI.wrapDx(e.x,player.wx), tdy=player.wy-e.y;
            const towardPlayer=Math.atan2(tdy,tdx);
            // Blend: 60% toward player, 40% random drift -- stays roughly convergent
            const biased=angleNorm(towardPlayer+rand(-maxPatrolTurn,maxPatrolTurn));
            e.patrolHeading=biased;
          }
        }
        desiredHeading=e.patrolHeading??e.heading??0;
      }

      // -- Post-fire sprint-away -- immediate course change after torpedo launch --
      // Overrides normal state machine heading. Sub knows it just revealed its position.
      if((e._postFireT||0)>0 && !e.evadeT){
        e._postFireT-=dt;
        desiredHeading=e._postFireHdg??desiredHeading;
        e.tmaPhase='drift'; // go quiet after launch -- don't sprint around
      }

      // -- Baffle-clear maneuver -- periodic listen stop -----------------------
      // Hunter/interceptor/zeta roles only. Suppressed during evasion, post-fire, close phase.
      // Sub turns ~35deg off base heading, slows to 3-5kt to clear propeller noise, then resumes.
      const _bcCfg=C.enemy.baffleClear||{};
      const _bcRoles=_bcCfg.rolesEnabled||['hunter','interceptor','zeta'];
      if(_bcRoles.includes(e.role??'hunter') && !e.evadeT && !((e._postFireT||0)>0) && e.tmaPhase!=='close'){
        e._baffleClearT=(e._baffleClearT??rand(_bcCfg.intervalMin??90,_bcCfg.intervalMax??150))-dt;
        if(e._baffleClearActive){
          e._baffleClearDur=(e._baffleClearDur||0)-dt;
          desiredHeading=e._baffleClearHdg??desiredHeading;
          if(e._baffleClearDur<=0){
            e._baffleClearActive=false;
            e._baffleClearT=rand(_bcCfg.intervalMin??90,_bcCfg.intervalMax??150);
          }
        } else if(e._baffleClearT<=0){
          e._baffleClearActive=true;
          e._baffleClearDur=rand(_bcCfg.checkDurMin??20,_bcCfg.checkDurMax??30);
          const _bcTurn=(_bcCfg.turnDeg??35)*Math.PI/180;
          e._baffleClearHdg=angleNorm((e.heading||0)+(Math.random()<0.5?1:-1)*_bcTurn);
        }
      }

      // -- Interceptor role -- sprint ahead of projected player track then ambush --
      if(e.role==='interceptor' && !e.evadeT){
        const prosecuting=session.groupState==='prosecuting';
        if(prosecuting){
          // Calculate or refresh intercept point
          const needsTarget=!e.interceptTargetX ||
            (e.interceptState==='sprinting' && e.interceptArrived);
          if(needsTarget && e.contact){
            // Project player position forward by leadTime seconds
            const leadT=C.enemy.interceptorLeadTime||90;
            const ktsToWU=_NAV.ktsToWU;
            const pVx=Math.cos(player.heading)*ktsToWU(player.speed);
            const pVy=Math.sin(player.heading)*ktsToWU(player.speed);
            const projX=player.wx+pVx*leadT;
            const projY=player.wy+pVy*leadT;
            // Offset perpendicular -- sit off their projected track slightly
            const perpOff=(Math.random()<0.5?1:-1)*rand(300,600);
            const perpAng=player.heading+Math.PI/2;
            e.interceptTargetX=projX+Math.cos(perpAng)*perpOff;
            e.interceptTargetY=projY+Math.sin(perpAng)*perpOff;
            e.interceptState='sprinting';
            e.interceptArrived=false;
          }

          if(e.interceptState==='sprinting' && e.interceptTargetX!=null){
            const idx=_AI.wrapDx(e.x,e.interceptTargetX);
            const idy=e.interceptTargetY-e.y;
            const idist=Math.hypot(idx,idy);
            if(idist<200){
              // Arrived -- go quiet and wait
              e.interceptState='ambush';
              e.interceptArrived=true;
              addLog('SONAR',''); // silent -- no log, enemy is quiet
            } else {
              desiredHeading=Math.atan2(idy,idx);
            }
          }
          // In ambush: override state machine speed below -- near silent
        } else {
          // Group reverted to patrol -- reset intercept
          e.interceptState='waiting';
          e.interceptTargetX=null; e.interceptTargetY=null;
        }
      }

      // -- Apply turn
      // SSBN: huge hull, much slower turn rate
      const maxTurnRate=(e.role==='ssbn'?0.18:e.role==='zeta'?0.55:0.45)*dt;
      const headingErr=angleNorm(desiredHeading-(e.heading||0));
      e.heading=(e.heading||0)+clamp(headingErr,-maxTurnRate,maxTurnRate);

      // -- Speed -- sprint-and-drift: fast in sprint phase, slow in drift
      const sprintPhase=(e.tmaPhase==='sprint');
      const isAmbushing=e.role==='interceptor'&&e.interceptState==='ambush';
      // Evade speed is phase-aware: sprint1/sprint2 at flank, knuckle at near-stop
      const evadeSpd = e._evadePhase==='knuckle' ? rand(1.5,3.0)
                     : e._evadePhase==='sprint2'  ? rand(16,20)
                     : 18; // sprint1 or no phase yet
      const targetSpd=e.evadeT>0?evadeSpd
        :(e._postFireT||0)>0?rand(14,18) // post-fire sprint-away -- clear launch datum
        :e._baffleClearActive?rand(3,5)  // baffle-clear listen -- slow and quiet
        :e.role==='ssbn'&&(state==='engage'||state==='investigate')?8 // SSBN flees at moderate speed
        :e.role==='ssbn'?rand(3,5)     // SSBN patrol -- very slow and quiet
        :isAmbushing?C.enemy.interceptorAmbushSpd||3   // ambush -- near silent
        :e.role==='interceptor'&&e.interceptState==='sprinting'?rand(14,17) // sprint to position
        :state==='engage'&&sprintPhase?14
        :state==='engage'&&e.tmaPhase==='close'?12
        :state==='engage'?5          // drift: slow and quiet to listen
        :state==='investigate'&&sprintPhase?10
        :state==='investigate'?5
        :7;
      const curSpd=Math.hypot(e.vx,e.vy);
      // Damage speed cap -- propulsion casualty from torpedo hit (set in damageEnemy)
      const cappedTargetSpd = targetSpd * (e._dmgSpeedCapMult ?? 1.0);
      // Tau-based acceleration -- matches realistic SSN build/decay rates
      // Subs accelerate slower than they decelerate (prop drag)
      const eTau = curSpd < cappedTargetSpd ? 40 : 25;
      const newSpd = curSpd + (cappedTargetSpd - curSpd) / eTau * dt;
      e.vx=Math.cos(e.heading)*newSpd;
      e.vy=Math.sin(e.heading)*newSpd;

      // -- Depth management
      if(!e.depthOrder) e.depthOrder=e.depth||300;
      if(!e.depthChangeT||e.depthChangeT<=0){
        if(e.evadeT>0){
          // Layer exploitation depth already set in phase init (_evadePhaseT block above).
          // If _evadePhase hasn't initialised yet (first frame gap), pick a safe deep dive.
          if(!e._evadePhase){
            e.depthChangeT=10;
            e.depthOrder=e.depth<300?rand(400,700):rand(60,160);
          } else {
            e.depthChangeT=999; // hold layer-exploit depth, set by phase init
          }
        } else if(state==='engage'){
          e.depthChangeT=rand(120,240);
          e.depthOrder=rand(100,500);
        } else {
          e.depthChangeT=rand(300,720);
          e.depthOrder=rand(150,600);
        }
      }
      e.depthChangeT-=dt;
      {
        const maxRate=(e.evadeT>0)?3.5:1.2;
        const depthErr=e.depthOrder-e.depth;
        const rate=Math.min(maxRate,Math.abs(depthErr)*0.06+0.1);
        e.depth=clamp(e.depth+Math.sign(depthErr)*rate*dt, 30, world.ground-80);
      }

      // -- Ping -- pingers ping aggressively; tactical pingers ping when stuck ----
      e.pingCd-=dt;
      const isPinger=e.role==='pinger';
      const isHunter=e.role==='hunter'||e.role==='interceptor'||!e.role;
      // Pingers: aggressive intervals. Tactical pingers: ping when TMA stuck.
      // Hunters: never ping (pingCd stays high, no tactical flag).
      const pingInterval=isPinger
        ?(state==='engage'?[5,9]:state==='investigate'?[8,14]:[12,20])
        :[9999,9999];

      // Tactical ping decision -- any enemy with tacticalPing flag
      // Conditions: has bearing observations but TMA stuck below fire threshold,
      // suspicion indicates something is out there, not currently evading
      let wantsTacticalPing=false;
      if(e.tacticalPing && !isPinger && e.pingCd<=0 && !e.evadeT){
        const hasBearings=(e.playerBearings||[]).length>=2;
        const tmaStuck=(e.tmaQuality||0)<(e.tacticalPingTmaThresh??0.25);
        const suspicious=e.suspicion>=(e.tacticalPingSusThresh??0.15);
        // Track how long TMA has been stuck -- don't ping immediately, wait for passive to fail
        if(hasBearings && tmaStuck && suspicious){
          e._tmaStuckT=(e._tmaStuckT||0)+dt;
          if(e._tmaStuckT>=(e.tacticalPingStuckTime??25)){
            wantsTacticalPing=true;
            e._tmaStuckT=0; // reset so next ping requires another wait
          }
        } else {
          e._tmaStuckT=0;
        }
      }

      if(e.pingCd<=0 && !session.over && (isPinger || wantsTacticalPing)){
        e.pingCd=isPinger?rand(pingInterval[0],pingInterval[1]):rand(e.tacticalPingCd?.[0]??30,e.tacticalPingCd?.[1]??50);
        const dxp=_AI.wrapDx(player.wx,e.x);
        const dyp=player.wy-e.y;
        const dp=Math.hypot(dxp,dyp);
        if(dp<C.enemy.subPingRange){
          e.pingPulse=1.2;
          e.detectedT=Math.max(e.detectedT||0,C.detection.detectT);
          e.seen=Math.max(e.seen||0,C.detection.seenT*0.4);
          e.lastX=e.x; e.lastY=e.y; e.lastT=now();
          _AI.enemyUpdateContactFromPing(e,player.wx,player.wy,dp);
          if(e.type==='boat') _AI.shipShareContact(e,player.wx,player.wy,160+dp*0.10);
          // Pingers share datum aggressively; tactical pingers keep it to themselves
          if(isPinger && _AI.wolfpackShareDatum) _AI.wolfpackShareDatum(e,player.wx,player.wy,0.45);
        }
      }

      // -- Fire -- only when TMA solution is solid enough ---------------------
      if(!e.torpTubes) e.torpTubes=Array(C.enemy.subTubes).fill(0);
      e.torpTubes=e.torpTubes.map(t=>Math.max(0,t-dt));
      e.fireCd-=dt;
      if(e.fireCd<=0 && !session.over && (e.torpStock??1)>0){
        const t=(state==='engage')?C.enemy.subFireEngage:C.enemy.subFireOther;
        e.fireCd=rand(t[0],t[1]);
        const tubeIdx=e.torpTubes.findIndex(t=>t<=0);
        // Role-based fire quality -- hunters are aggressive, pingers are more careful
        // SSBNs fire only in desperation -- self-defence last resort
        const roleFireQ = e.role==='ssbn'?0.80
          : e.role==='zeta'?0.28     // Zeta fires with confidence on thin data
          : e.role==='hunter'?0.35
          : e.role==='interceptor'?0.30
          : e.role==='pinger'?0.50   // pingers fire only with a decent solution
          : 0.30;
        const hasRoleSolution = (e.tmaQuality||0) >= roleFireQ;
        const eLaunchKts = Math.hypot(e.vx, e.vy);
        const eLaunchCap = C.player.wireMaxLaunchKts ?? 15;
        if(tubeIdx>=0 && _AI.enemyHasFireSolution(e) && hasRoleSolution && eLaunchKts <= eLaunchCap){
          const tx=e.contact.x, ty=e.contact.y;
          const dx=_AI.wrapDx(e.x,tx);
          const dy=ty-e.y;
          const d=Math.hypot(dx,dy);
          const layer=_AI.layerPenalty(player.depth,e.y);
          const maxD=(layer<1)?2200:2800;
          if(d<maxD){
            // Intercept bearing using TMA-estimated player velocity
            // Use true player pos blurred by TMA quality -- not perfect aim
            // Fire adaptation: tighten blur based on previous misses
            const adaptCfg=C.enemy.adaptation||{};
            const adaptPenalty=1-Math.min((e._missCount||0)*(adaptCfg.blurReductionPerMiss??0.15), 1-(adaptCfg.blurFloor??0.50));
            const blur=clamp((1-tmaQ)*400, 0, 350)*adaptPenalty;
            const ftx=player.wx+rand(-blur,blur);
            const fty=player.wy+rand(-blur,blur);
            const ftvx=Math.cos(player.heading)*_NAV.ktsToWU(player.speed);
            const ftvy=Math.sin(player.heading)*_NAV.ktsToWU(player.speed);
            const ftDepth=player.depth??200;
            const torpSpd=C.torpedo.speed;
            let intBearing=Math.atan2(dy,dx);
            const ftDist=Math.hypot(_AI.wrapDx(e.x,ftx),fty-e.y);
            let tof=ftDist/torpSpd;
            for(let i=0;i<6;i++){
              const ex2=ftx+ftvx*tof, ey2=fty+ftvy*tof;
              tof=Math.hypot(_AI.wrapDx(e.x,ex2),ey2-e.y)/torpSpd;
            }
            const predX=ftx+ftvx*tof, predY=fty+ftvy*tof;
            intBearing=Math.atan2(predY-e.y,_AI.wrapDx(e.x,predX));
            const shot=clampConeDual(Math.cos(intBearing),Math.sin(intBearing),
              e.heading||Math.atan2(e.vy,e.vx),C.enemy.subTorpArcDeg);
            const off=e.r*1.25;
            const sx=e.x+(shot.isRear?-Math.cos(e.heading):Math.cos(e.heading))*off;
            const sy=e.y+(shot.isRear?-Math.sin(e.heading):Math.sin(e.heading))*off;
            const torpParams={
              speed:     C.enemy.subTorpSpeed??26,
              life:      C.enemy.subTorpLife??220,
              seekRange: C.enemy.subTorpSeekRange??400,
              reacquireChance: C.enemy.subTorpReacquire??0.010,
              firedBy:   e,
            };
            _W.fireTorpedo(sx,sy,shot.dx,shot.dy,false,260,false,0,e.depth||300,ftDepth,torpParams);
            e.torpTubes[tubeIdx]=C.enemy.subReloadTime;
            if(e.torpStock!=null) e.torpStock--;

            // Two-torpedo spread -- bracket target when solution is solid
            // Fire a second tube +/-7deg from the first bearing
            const tube2Idx=e.torpTubes.findIndex((t,i)=>i!==tubeIdx&&t<=0);
            if(tube2Idx>=0 && tmaQ>=0.55 && (e.torpStock??0)>0){
              const spreadRad=rand(5,8)*Math.PI/180;
              const spreadFlip=(Math.random()<0.5?1:-1);
              const brg2=intBearing+spreadFlip*spreadRad;
              const shot2=clampConeDual(Math.cos(brg2),Math.sin(brg2),
                e.heading||Math.atan2(e.vy,e.vx),C.enemy.subTorpArcDeg);
              _W.fireTorpedo(sx,sy,shot2.dx,shot2.dy,false,260,false,0,e.depth||300,ftDepth,torpParams);
              e.torpTubes[tube2Idx]=C.enemy.subReloadTime;
              if(e.torpStock!=null) e.torpStock--;
            }

            // Launch transient -- player may hear it if close enough
            if(typeof _playerHearTransient==='function') _playerHearTransient(e,e.x,e.y);
            // Wolfpack -- share datum with nearby allies
            if(e.tmaX!=null && _AI.wolfpackShareDatum) _AI.wolfpackShareDatum(e,e.tmaX,e.tmaY,e.tmaQuality||0.5);
            const brgToEnemy=((Math.atan2(_AI.wrapDx(player.wx,e.x),e.y-player.wy)*180/Math.PI)+360)%360;
            _COMMS.tactical.enemyTorpedo(Math.round(brgToEnemy).toString().padStart(3,'0')+'°');

            // Post-fire sprint-away -- course change 100-140deg to clear launch position
            // Sub knows the launch transient just pinged itself on the player's sonar
            if(!(e._postFireT>0)){
              e._postFireT=rand(20,35);
              e._postFireHdg=angleNorm((e.heading||0)+(Math.random()<0.5?1:-1)*rand(1.75,2.44));
              // Cross the layer if possible -- make it harder for the player to counter-fire
              e.depthOrder=e.depth<250?rand(300,500):rand(60,180);
              e.depthChangeT=rand(5,12);
            }
          }
        }
      }

      // -- Bearing-only fire -- probe shot down a bearing when TMA won't converge -
      // Available to any enemy with bearingOnlyEnabled. Uses existing torpedo system.
      // Fires one torpedo down the best bearing -- seeker and search pattern do the rest.
      if(e.bearingOnlyEnabled && !session.over && (e.torpStock??1)>0){
        e._bearingOnlyCd=(e._bearingOnlyCd??0)-dt;
        if(e._bearingOnlyCd<=0){
          const obs=e.playerBearings||[];
          const tmaQ=e.tmaQuality||0;
          // Conditions: have recent bearings, TMA stuck below fire threshold,
          // suspicion high enough to justify spending a torpedo
          const recentObs=obs.filter(o=>(session.missionT||0)-o.t<30);
          const roleQ = e.role==='ssbn'?0.80:e.role==='zeta'?0.28:e.role==='hunter'?0.35:0.30;
          const stuck=tmaQ<roleQ && recentObs.length>=3;
          const suspicious=e.suspicion>=(e.bearingOnlySusThresh??0.35);
          const tubeReady=e.torpTubes?.findIndex(t=>t<=0)>=0;
          const eLaunchKts=Math.hypot(e.vx,e.vy);
          if(stuck && suspicious && tubeReady && eLaunchKts<=(C.player.wireMaxLaunchKts??15)){
            // Fire down the most recent bearing
            const lastBrg=recentObs[recentObs.length-1].brg;
            const shot=clampConeDual(Math.cos(lastBrg),Math.sin(lastBrg),
              e.heading||Math.atan2(e.vy,e.vx),C.enemy.subTorpArcDeg);
            const off=e.r*1.25;
            const sx=e.x+(shot.isRear?-Math.cos(e.heading):Math.cos(e.heading))*off;
            const sy=e.y+(shot.isRear?-Math.sin(e.heading):Math.sin(e.heading))*off;
            const estDepth=player.depth+rand(-120,120);
            _W.fireTorpedo(sx,sy,shot.dx,shot.dy,false,260,false,0,e.depth||300,
              clamp(estDepth,30,700),{
                speed:     C.enemy.subTorpSpeed??26,
                life:      C.enemy.subTorpLife??220,
                seekRange: C.enemy.subTorpSeekRange??400,
                reacquireChance: C.enemy.subTorpReacquire??0.010,
                firedBy:   e,
              });
            const tIdx=e.torpTubes.findIndex(t=>t<=0);
            e.torpTubes[tIdx]=C.enemy.subReloadTime;
            if(e.torpStock!=null) e.torpStock--;
            e._bearingOnlyCd=e.bearingOnlyCdTime??50; // long cooldown -- considered shots
            if(typeof _playerHearTransient==='function') _playerHearTransient(e,e.x,e.y);
            const brgToEnemy=((Math.atan2(_AI.wrapDx(player.wx,e.x),e.y-player.wy)*180/Math.PI)+360)%360;
            _COMMS.tactical.enemyTorpedo(Math.round(brgToEnemy).toString().padStart(3,'0')+'°');
          }
        }
      }

      // -- Incoming torpedo detection + evasion --------------------------------
      // Pass 1: scan all live friendly torpedoes in detection range.
      // _alertedEnemy is NOT used as a block here -- we re-evaluate every frame
      // so the escape heading tracks the torpedo as it maneuvers.
      {
        let closestTorp=null, closestDd=Infinity;
        for(const b of bullets){
          if(b.kind!=="torpedo"||!b.friendly||b.life<=0) continue;
          const dx=_AI.wrapDx(e.x,b.x);
          const dy=b.y-e.y;
          const dd=Math.hypot(dx,dy);
          if(dd>C.enemy.subTorpReactR) continue;

          // Detection probability -- own noise masks hearing; layer degrades signal
          const layer=_AI.layerPenalty(e.depth||200, b.depth??200);
          const signal=0.85*layer*(1-dd/C.enemy.subTorpReactR);
          const ownNoise=e.noise||0.15;
          const detect=signal-ownNoise*0.80;
          if(detect<=0) continue;

          // First detection: probabilistic
          if(!b._alertedEnemy){
            const pDetect=clamp(0.08+detect*0.60, 0, 0.85)*dt;
            if(Math.random()>pDetect) continue;
            b._alertedEnemy=e;
          }

          // Track closest detected torpedo -- update escape heading every frame
          if(dd<closestDd){ closestDd=dd; closestTorp=b; }
        }

        if(closestTorp){
          const b=closestTorp;
          e.suspicion=Math.min(1,e.suspicion+0.30);

          // Extend evade timer: keep running while torpedo is still inside react range
          // Initial trigger: 25-35s. Each re-evaluation while still close: refresh to at least 8s.
          if(!e.evadeT || e.evadeT<=0){
            // First detection -- begin reaction timer, then staggered counter-fire
            e.evadeT=rand(25,35);
            _COMMS.combat.enemyCountermeasures();

            // -- Phased counter-fire -------------------------------------------
            // Only the targeted enemy counter-fires -- others evade but don't shoot.
            // Targeted = torpedo heading generally toward this enemy (within 60deg cone).
            // Soviet doctrine: 2-4s crew reaction, then fire 1-2 tubes initially,
            // hold remaining as follow-up if first salvo fails to deter.
            if(!e._cfPhase){
              // Check if this torpedo is actually aimed at us
              const torpHdg=Math.atan2(b.dy||0, b.dx||0);
              const brgToUs=Math.atan2(e.y-b.y, _AI.wrapDx(b.x,e.x));
              let hdgDiff=Math.abs(torpHdg-brgToUs);
              if(hdgDiff>Math.PI) hdgDiff=2*Math.PI-hdgDiff;
              const aimedAtUs=hdgDiff<(60*Math.PI/180); // within 60deg cone
              if(aimedAtUs){
                const cfCfg=C.enemy.counterFire||{};
                const readyCount=(e.torpTubes||[]).filter(t=>t<=0).length;
                if(readyCount>0 && (e.torpStock??1)>0){
                  e._cfPhase='reacting';
                  e._cfT=rand(...(cfCfg.reactionDelay||[2,4]));
                  e._cfShotsLeft=Math.min(cfCfg.maxInitial??2, readyCount);
                  e._cfFollowup=false;
                  e._cfTorpBrg=Math.atan2(b.y-e.y, _AI.wrapDx(e.x,b.x));
                }
              }
            }
          } else {
            // Still being chased -- keep timer alive
            e.evadeT=Math.max(e.evadeT, 8.0);
          }

          // Update evadeFrom to current torpedo position every frame -- heading stays fresh
          e.evadeFrom={x:b.x, y:b.y};
          if(e._cfPhase) e._cfTorpBrg=Math.atan2(b.y-e.y, _AI.wrapDx(e.x,b.x));

          // Immediate CM drop on first alert, then again mid-evasion if still chased
          if(e.cmCd<=0 && (e.cmStock??0)>0){
            e.cmCd=rand(5.0,9.0);
            e.cmStock--;
            const dropX=wrapX(e.x-Math.cos(e.heading)*35+rand(-20,20));
            const dropY=e.y-Math.sin(e.heading)*35+rand(-20,20);
            const dec=_W.deployDecoy(dropX,dropY,false,"noisemaker",{depth:e.depth||200});
            if(dec) e.evadeDecoy={x:dec.x,y:dec.y};
            if(Math.random()<0.55 && (e.cmStock??0)>0){
              e.cmStock--;
              const drop2X=wrapX(e.x-Math.cos(e.heading)*70+rand(-30,30));
              const drop2Y=e.y-Math.sin(e.heading)*70+rand(-30,30);
              _W.deployDecoy(drop2X,drop2Y,false,"noisemaker",{depth:e.depth||200});
            }
          }

          // -- Counter-fire state machine tick ---------------------------------
          if(e._cfPhase && (e.torpStock??1)>0){
            e._cfT=(e._cfT||0)-dt;
            if(e._cfT<=0){
              const cfCfg=C.enemy.counterFire||{};
              if(e._cfPhase==='reacting'||e._cfPhase==='stagger'){
                // Fire one tube with degraded intercept prediction
                const tubeIdx=(e.torpTubes||[]).findIndex(t=>t<=0);
                if(tubeIdx>=0 && e._cfShotsLeft>0){
                  // Degraded intercept: panic blur + fewer iterations
                  const tmaQ=e.tmaQuality||0;
                  const baseBlur=clamp((1-tmaQ)*400, 0, 350);
                  const panicBlur=baseBlur*(cfCfg.panicBlurMult??2.5);
                  const ftx=player.wx+rand(-panicBlur,panicBlur);
                  const fty=player.wy+rand(-panicBlur,panicBlur);
                  const ftvx=Math.cos(player.heading)*_NAV.ktsToWU(player.speed);
                  const ftvy=Math.sin(player.heading)*_NAV.ktsToWU(player.speed);
                  const torpSpd=C.enemy.subTorpSpeed??45;
                  const ftDist=Math.hypot(_AI.wrapDx(e.x,ftx),fty-e.y);
                  let tof=ftDist/torpSpd;
                  const iters=cfCfg.iterCount??4;
                  for(let i=0;i<iters;i++){
                    const ex2=ftx+ftvx*tof, ey2=fty+ftvy*tof;
                    tof=Math.hypot(_AI.wrapDx(e.x,ex2),ey2-e.y)/torpSpd;
                  }
                  const predX=ftx+ftvx*tof, predY=fty+ftvy*tof;
                  let intBrg=Math.atan2(predY-e.y,_AI.wrapDx(e.x,predX));
                  // Clamp to firing arc
                  const shot=clampConeDual(Math.cos(intBrg),Math.sin(intBrg),
                    e.heading||Math.atan2(e.vy||0,e.vx||0),C.enemy.subTorpArcDeg);
                  const off=(e.r||20)*1.25;
                  const sx=wrapX(e.x+Math.cos(e.heading)*off);
                  const sy=e.y+Math.sin(e.heading)*off;
                  const estDepth=player.depth+rand(-80,80);
                  _W.fireTorpedo(sx,sy,shot.dx,shot.dy,false,260,false,0,e.depth||300,
                    clamp(estDepth,30,700),{
                      speed:torpSpd, life:C.enemy.subTorpLife??220,
                      seekRange:C.enemy.subTorpSeekRange??400,
                      reacquireChance:C.enemy.subTorpReacquire??0.010,
                      firedBy:e,
                    });
                  e.torpTubes[tubeIdx]=C.enemy.subReloadTime;
                  if(e.torpStock!=null) e.torpStock--;
                  if(typeof _playerHearTransient==='function') _playerHearTransient(e,e.x,e.y);
                  e._cfShotsLeft--;
                  const cDeg=Math.round(((intBrg*180/Math.PI)+360)%360);
                  _COMMS.combat.counterShot(1, cDeg.toString().padStart(3,'0')+'°');
                  if(e._cfShotsLeft>0){
                    e._cfPhase='stagger';
                    e._cfT=rand(...(cfCfg.staggerDelay||[1.5,3]));
                  } else if(!e._cfFollowup){
                    e._cfPhase='followup_wait';
                    e._cfT=rand(8,15);
                  } else {
                    e._cfPhase=null;
                  }
                } else { e._cfPhase=null; }
              } else if(e._cfPhase==='followup_wait'){
                // Check if player torpedo is still tracking this enemy
                const stillTracked=bullets.some(bt=>bt.kind==='torpedo'&&bt.friendly&&bt.life>0&&
                  Math.hypot(_AI.wrapDx(e.x,bt.x),bt.y-e.y)<C.enemy.subTorpReactR);
                if(stillTracked){
                  const readyCount=(e.torpTubes||[]).filter(t=>t<=0).length;
                  if(readyCount>0 && (e.torpStock??1)>0){
                    e._cfShotsLeft=readyCount;
                    e._cfFollowup=true;
                    e._cfPhase='stagger';
                    e._cfT=0;
                  } else { e._cfPhase=null; }
                } else { e._cfPhase=null; }
              }
            }
          }
        }
      }

      e.cmCd=Math.max(0,e.cmCd-dt);
    }
  }

  // Dead enemies stay in the array — victory checks and sonar contacts reference them

  // ── Wave management + victory (from scenario sub-module) ───────────────
  if(!session.over){
    tickWaveManagement(dt);
    tickVictory(dt);
  }

  // decoys
  for(const d of decoys){
    d.life -= dt;
    d.x = wrapX(d.x + d.vx*dt);
    d.y = d.y + d.vy*dt;
    d.vx *= Math.pow(0.94,dt*60);
    d.vy *= Math.pow(0.94,dt*60);
    if(d.kind==="flare"){
      d.vy += (d.g||C.ship.flareGravity)*dt;
      if(d.y>world.seaLevel-6 && d.vy>0){ _W.splash(d.x,world.seaLevel,0.5); d.life=Math.min(d.life,0.30); }
      d.y = clamp(d.y,world.seaLevel-80,world.ground-40);
    }
  }
  for(let i=decoys.length-1;i>=0;i--) if(decoys[i].life<=0) decoys.splice(i,1);

  // contacts
  for(const c of contacts) c.life -= dt;
  for(let i=contacts.length-1;i>=0;i--) if(contacts[i].life<=0) contacts.splice(i,1);

  // bullets
  for(const b of bullets){
    b.life -= dt;

    if(b.kind==="rocket"){
      b.x+=b.vx*dt; b.y+=b.vy*dt;
      const rdx=b.targetX-b.x, rdy=b.targetY-b.y;
      if(Math.hypot(rdx,rdy)<80 || b.life<=0){
        // Deploy dumb searching torpedo at datum
        const searchAng=Math.random()*Math.PI*2;
        _W.fireTorpedo(b.x,b.y, Math.cos(searchAng),Math.sin(searchAng),
          false,0,false,0, b.deployDepth,b.deployDepth,
          {life:120,speed:30,seekRange:420,dmg:28,circleSearch:true});
        // Player hears splash
        const rbdx=_AI.wrapDx(player.wx,b.x), rbdy=b.y-player.wy;
        if(Math.hypot(rbdx,rbdy)<5000){
          const rbrg=Math.round(((Math.atan2(rbdx,rbdy)*180/Math.PI)+360)%360);
          _COMMS.tactical.heloDrop?.(rbrg.toString().padStart(3,'0')+'°');
        }
        b.life=0;
      }
      continue;
    }

    if(b.kind==="depthCharge"){
      b.vy = lerp(b.vy,b.sink,0.08);
      b.x = wrapX(b.x + b.vx*dt);
      b.y += b.vy*dt;
      if(b.y>=b.targetY || b.y>=world.ground-12){
        _W.makeExplosion(b.x,b.y,1.15,true);
        const dxp=_AI.wrapDx(b.x,player.wx);
        const dyp=player.depth-b.y;
        const dp=Math.hypot(dxp,dyp);
        if(dp<b.blastR) damagePlayer(b.dmg*(1-dp/b.blastR));

        // Sonar transient -- depth charge detonation is audible at long range.
        // Rate-limited so a pattern of charges produces one report.
        const dcDetectRange=4500;
        const dxs=_AI.wrapDx(player.wx,b.x), dys=player.wy-b.y;
        if(Math.hypot(dxs,dys)<dcDetectRange){
          const _now=now();
          if(!session._dcSonarT || _now-session._dcSonarT>4.0){
            session._dcSonarT=_now;
            const brg=Math.round(((Math.atan2(dxs,dys)*180/Math.PI)+360)%360);
            _COMMS.tactical.dcDetonation(brg.toString().padStart(3,'0')+'°');
          }
        }

        b.life=0;
      }
      continue;
    }

    if(b.kind==="torpedo"){
      _TORP.update(b, dt);
      // Ping dazzle -- active sonar pulse disrupts enemy torpedo seekers
      if(!b.friendly && player.sonarPulse>0){
        const dazzleCfg=C.player.pingDazzle;
        if(dazzleCfg && !b._wasDazzled){
          const ddx=_AI.wrapDx(player.wx,b.x), ddy=player.wy-b.y;
          if(Math.hypot(ddx,ddy)<(dazzleCfg.range??1800)){
            b._dazzleT=dazzleCfg.duration??1.5;
            b.target=null; // break current lock
            b._wasDazzled=true;
          }
        }
      }
      continue;
    }

  }
  for(let i=bullets.length-1;i>=0;i--){
    const _b=bullets[i];
    if(_b.life<=0){
      // If a wired torpedo is expiring, free the tube first
      if(_b.kind==='torpedo' && _b.wire?.live){
        _b.wire.live=false;
        _onWireCut(_b);
      }
      // Fire adaptation: track enemy torpedo misses
      if(_b.kind==='torpedo' && !_b.friendly && !_b._hit && _b.firedBy){
        const firer=_b.firedBy;
        if(enemies.includes(firer) && !firer.dead){
          firer._missCount=(firer._missCount||0)+1;
          firer._lastMissT=session.missionT;
        }
      }
      bullets.splice(i,1);
    }
  }

  // ── Wire guidance (from player-control) ────────────────────────────────
  tickWireGuidance(dt, _onWireCut);

  // Wire contacts age out
  for(const wc of wireContacts) wc.life-=dt;
  for(let i=wireContacts.length-1;i>=0;i--) if(wireContacts[i].life<=0) wireContacts.splice(i,1);

  // CWIS tracers -- short-lived fast projectiles, purely visual + positional
  for(const t of cwisTracers){
    t.life -= dt;
    t.x = wrapX(t.x + t.vx*dt);
    t.y += t.vy*dt;
  }
  for(let i=cwisTracers.length-1;i>=0;i--) if(cwisTracers[i].life<=0) cwisTracers.splice(i,1);

  // particles -- top-down, just drift and fade
  for(const p of particles){
    p.life -= dt;
    p.x = p.x + p.vx*dt;
    p.y = p.y + p.vy*dt;
    p.vx *= Math.pow(0.88,dt*60);
    p.vy *= Math.pow(0.88,dt*60);
  }
  for(let i=particles.length-1;i>=0;i--) if(particles[i].life<=0) particles.splice(i,1);

  // Camera -- follow player unless free-cam mode is active (Ctrl+RMB drag)
  if(!cam.free){
    cam.x = player.wx;
    cam.y = player.wy;
  }
  cam.zoom = C.camera.zoom;
}

export { _onWireCut };

export const SIM = { update, reset, resetScenario, initiateWatchChange, damagePlayer, damageEnemy };
