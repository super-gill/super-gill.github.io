'use strict';

import { CONFIG } from '../config/constants.js';
import { clamp, lerp, deg2rad, angleNorm } from '../utils/math.js';
import { world, player, enemies, bullets, sonarContacts, cam, tdc } from '../state/sim-state.js';
import { session, setMsg, addLog, setCasualtyState, setTacticalState } from '../state/session-state.js';

const C = CONFIG;

let _COMMS = null;
let _I = null;
let _AI = null;
let _DMG = null;
let _PANEL = null;
let _MAPS = null;
let _DPR = null;
let _canvas = null;

export function _bindNav(deps) {
  if(deps.COMMS) _COMMS=deps.COMMS;
  if(deps.I) _I=deps.I;
  if(deps.AI) _AI=deps.AI;
  if(deps.DMG) _DMG=deps.DMG;
  if(deps.PANEL) _PANEL=deps.PANEL;
  if(deps.MAPS) _MAPS=deps.MAPS;
  if(deps.DPR!=null) _DPR=deps.DPR;
  if(deps.canvas) _canvas=deps.canvas;
}

function ktsToWU(k){ return k*1; }

// Route: ordered array of {wx,wy} waypoints
export const route=[];

function updateOrders(dt){
  // ── Zoom ──────────────────────────────────────────────────────────────────
  if(_I.zoomDelta!==0){
    const factor=Math.pow(1.18,_I.zoomDelta);
    C.camera.zoom=clamp(C.camera.zoom*factor,0.04,8.00);
    _I.zoomDelta=0;
  }

  // ── Route click ───────────────────────────────────────────────────────────
  if(_I._pendingRouteClick){
    _I._pendingRouteClick=false;
    const Z=C.camera.zoom*(_DPR||1);
    const DPR=_DPR||1;
    const cx=(_canvas.width-88*DPR)/2, cy=(_canvas.height-190*DPR)/2;
    const wx=cam.x+(_I.mouseX-cx)/Z;
    const wy=cam.y+(_I.mouseY-cy)/Z;

    // Check if click is near a sonar contact bearing line or live torpedo — designate for TDC
    const designatePixels=36; // screen pixels — for blobs and torpedoes
    const designateLinePixels=10; // much tighter for bearing lines (long rays are too easy to accidentally hit)
    const designateR=designatePixels/(Z*DPR);
    let best=null, bestDist=Infinity, bestId=null;

    for(const [e,sc] of sonarContacts){
      if(e.dead) continue; // can't re-designate dead contacts
      // Check distance to bearing line (perpendicular) AND to TMA position blob
      let d=Infinity;
      if(sc.tmaQuality>=(CONFIG?.tma?.qualityThresholdBlob??0.15) && sc.tmaX!=null){
        // Has a position — check distance to blob
        const edx=_AI.wrapDx(wx,sc.tmaX), edy=sc.tmaY-wy;
        d=Math.hypot(edx,edy);
      } else if(sc.latestBrg!=null){
        // Bearing-line only — perpendicular distance from click to ray
        // Use a tighter radius so normal ocean clicks don't accidentally designate
        const lineR=designateLinePixels/(Z*DPR);
        const ox=sc.latestFromX??player.wx, oy=sc.latestFromY??player.wy;
        const brg=sc.latestBrg;
        const qx=_AI.wrapDx(ox,wx), qy=wy-oy;
        const dot=qx*Math.cos(brg)+qy*Math.sin(brg);
        if(dot>0){
          const perp=Math.abs(-qx*Math.sin(brg)+qy*Math.cos(brg));
          if(perp<lineR) d=perp;
        }
      }
      if(d<designateR&&d<bestDist){ bestDist=d; best=e; bestId=sc.id; }
    }
    for(const b of bullets){
      if(b.kind!=='torpedo'||b.life<=0) continue;
      const dx=_AI.wrapDx(wx,b.x), dy=b.y-wy;
      const d=Math.hypot(dx,dy);
      if(d<designateR&&d<bestDist){ bestDist=d; best=b; bestId=b.torpId; b._isTorp=true; }
    }

    if(best){
      tdc.target=best;
      tdc.targetId=bestId;
      const sc=best._isTorp?null:sonarContacts?.get(best);
      _COMMS?.nav.tdcDesignated(bestId, !!sc);
    } else {
      // Normal waypoint — set ordered heading to waypoint bearing
      const snapped=_MAPS.snapToSea(
        wx,
        wy
      );
      route.push(snapped);
      // Always set orderedHeading so the boat keeps turning even if waypoint is cleared
      const brgToWP = Math.atan2(snapped.wy-player.wy, snapped.wx-player.wx);
      player.orderedHeading=((Math.atan2(Math.cos(brgToWP),-Math.sin(brgToWP))*180/Math.PI)+360)%360;
      player._orderedCourseReached=false;
      if(route.length===1){
        const crsStr = Math.round(player.orderedHeading).toString().padStart(3,'0');
        _COMMS?.nav.courseChange(crsStr);
      }
    }
  }

  if(_I.routeRemoveLast){
    _I.routeRemoveLast=false;
    if(route.length>0) route.pop();
  }

  // ── Speed: A = slower, D = faster ────────────────────────────────────────
  const inc=C.player.speedIncrementKts||1;
  const repeat=0.10;
  const incDown=_I.keys.has("d");
  const decDown=_I.keys.has("a");
  if(incDown||decDown){
    player.speedHoldT=(player.speedHoldT||0)+dt;
    while(player.speedHoldT>=repeat){
      player.speedHoldT-=repeat;
      if(incDown) player.speedOrderKts=Math.min(C.player.flankKts,(player.speedOrderKts||0)+inc);
      if(decDown) player.speedOrderKts=Math.max(0,(player.speedOrderKts||0)-inc);
    }
  } else {
    player.speedHoldT=0;
  }

  // ── Depth: W = shallower, S = deeper (10m steps, routed via PANEL for debounced log)
  const dRep=C.player.depthHoldRepeat||0.10;
  const holdDepth=(_I.keys.has("w")?-1:0)+(_I.keys.has("s")?1:0);
  if(holdDepth!==0){
    player.depthHoldT=(player.depthHoldT||0)+dt;
    while(player.depthHoldT>=dRep){
      player.depthHoldT-=dRep;
      _PANEL?.depthStep(holdDepth*10);
    }
  } else {
    player.depthHoldT=0;
  }

  // ── Silent running (Z) — delegates to panel ──────────────────────────────
  if(_I.keys.has("z")){
    _I.keys.delete("z");
    _PANEL?.toggleSilent();
  }

  // ── Emergency turn (Q) — delegates to panel ─────────────────────────────
  if(_I.keys.has("q")){
    _I.keys.delete("q");
    _PANEL?.emergencyTurn();
  }

  // ── Crash dive (C) — delegates to panel ─────────────────────────────────
  if(_I.keys.has("c")){
    _I.keys.delete("c");
    _PANEL?.emergencyCrashDive();
  }
}

function stepDynamics(dt){
  // ── Speed ─────────────────────────────────────────────────────────────────
  // Speed is converged as a signed value so direction changes obey momentum:
  //   ahead full → back slow decelerates to zero, then accelerates astern.
  let orderKts=player.speedOrderKts??0;
  if(player.silent) orderKts=Math.min(orderKts,C.player.silentRunning.speedCap);
  if(player.scram)  orderKts=Math.min(orderKts, 3.0); // EPM only
  if(player.snorkeling && C.player.isDiesel) orderKts=Math.min(orderKts, C.player.snorkelSpeedCap??5);
  if(player._battDead && C.player.isDiesel) orderKts=0; // no propulsion on dead battery
  const dmgFx = _DMG?.getEffects() || {};
  if(dmgFx.speedCap!=null) orderKts=Math.min(orderKts, dmgFx.speedCap);
  const maxKts=Math.min(C.player.flankKts, dmgFx.speedCap??Infinity);
  const orderDir=player.speedDir||1;
  const orderSigned=orderKts*orderDir;
  const movingDir=player._movingDir||1;
  const currentSigned=player.speed*movingDir;
  const err=orderSigned-currentSigned;
  // Conn room lost — engine orders relayed via internal comms; 4× slower response
  // Flooding adds drag — acceleration degrades with water mass
  // Scale speedTau with vessel flank speed — tuned for 28kt base; faster boats accelerate proportionally
  const baseTau = C.player.speedTau || 45;
  const tauScale = 28 / Math.max(20, C.player.flankKts || 28); // Seawolf 35kt → tau*0.8
  const speedTauEff = (dmgFx.connRoomLost ? baseTau * tauScale * 4.0 : baseTau * tauScale) * (dmgFx.floodTauMult||1.0);
  const newSigned=currentSigned+(err/Math.max(0.05, speedTauEff))*dt;
  player.speed=clamp(Math.abs(newSigned),0,maxKts);
  player._movingDir=player.speed<0.05?orderDir:(newSigned>=0?1:-1);
  // Helm speed report — fires once when actual speed settles within 0.8kt of order
  if(Math.abs(player.speed-orderKts)<0.8 && orderDir===player._movingDir && Math.abs((player._lastReportedKts??-99)-orderKts)>1.0){
    player._lastReportedKts=orderKts;
    if(orderKts>0){
      _COMMS?.nav.speedReport(player.speed);
    } else {
      _COMMS?.nav.allStop();
    }
  }

  // ── Heading — steer toward next waypoint ──────────────────────────────────
  // Speed-scaled turn rate
  const speedFrac=clamp(player.speed/Math.max(1,C.player.flankKts),0,1);
  const steeringMult=dmgFx.steeringMult??1.0;
  const maxTurnDeg=lerp(C.player.turnRateMinDeg,C.player.turnRateDeg,speedFrac)*steeringMult;
  const maxTurn=deg2rad(maxTurnDeg);

  if(route.length>0){
    const wp=route[0];
    let dx=wp.wx-player.wx;
    let dy=wp.wy-player.wy;
    const dist=Math.hypot(dx,dy);

    // Arrive threshold — pop waypoint when close enough
    const arriveR=clamp(ktsToWU(player.speed)*2.0, 80, 300);
    if(dist<arriveR){
      route.shift();
      if(route.length>0){
        const nx2=route[0];
        const brgToNext = Math.atan2(nx2.wy-player.wy, nx2.wx-player.wx);
        const crsNext = Math.round(((brgToNext*180/Math.PI)+360)%360).toString().padStart(3,'0');
        _COMMS?.nav.waypointReached(crsNext);
      } else {
        // Keep orderedHeading so the boat continues turning toward the last waypoint bearing
        _COMMS?.nav.finalWaypoint(Math.round(player.orderedHeading??((player.heading*180/Math.PI)+360)%360).toString().padStart(3,'0'));
      }
    } else {
      const desired=Math.atan2(dy,dx);
      // Update orderedHeading to waypoint bearing so compass shows it
      player.orderedHeading=((Math.atan2(Math.cos(desired),-Math.sin(desired))*180/Math.PI)+360)%360;
      let dAng=angleNorm(desired-player.heading);
      dAng=clamp(dAng,-maxTurn*dt,maxTurn*dt);
      player.heading=angleNorm(player.heading+dAng);
    }
    player.turnRate=0;
  } else if(player.orderedHeading!=null){
    // Steer toward ordered heading (compass degrees → math radians)
    const ordDeg=player.orderedHeading;
    // Convert compass bearing to math angle: compass 0=N(up), CW → math 0=E, CCW
    const ordRad=(ordDeg-90)*Math.PI/180;
    let dAng=angleNorm(ordRad-player.heading);
    // Check if within snap threshold
    const currentDeg=((Math.atan2(Math.cos(player.heading),-Math.sin(player.heading))*180/Math.PI)+360)%360;
    const diff=Math.abs(((ordDeg-currentDeg+540)%360)-180);
    if(diff<=0.5){
      // Snap to ordered heading
      player.heading=ordRad;
      const hdgStr=Math.round(ordDeg).toString().padStart(3,'0');
      if(!player._orderedCourseReached){
        player._orderedCourseReached=true;
        _COMMS?.nav.finalWaypoint(hdgStr);
      }
    } else {
      player._orderedCourseReached=false;
      dAng=clamp(dAng,-maxTurn*dt,maxTurn*dt);
      player.heading=angleNorm(player.heading+dAng);
    }
    player.turnRate=0;
  } else {
    // No waypoints, no ordered heading — hold current heading
    player.turnRate=0;
  }

  // ── Move in top-down world ────────────────────────────────────────────────
  const spWU=ktsToWU(player.speed) * (player._movingDir||1);
  let nx=player.wx+Math.cos(player.heading)*spWU*dt;
  let ny=player.wy+Math.sin(player.heading)*spWU*dt;

  // Land collision — don't enter land, clear route if stuck
  if(_MAPS.isLand(nx, ny)){
    route.length=0;
    // Bounce: just don't move this frame
    nx=player.wx; ny=player.wy;
    _COMMS?.nav.grounded();
  }

  player.wx=nx;
  player.wy=ny;
  // Horizontal velocity for TMA range estimation (sensors.js _estRange)
  player.vx=Math.cos(player.heading)*spWU;
  player.vxRaw=player.vx; // alias — vy is used for depth so keep separate

  // ── Depth ─────────────────────────────────────────────────────────────────
  const errD=(player.depthOrder??player.depth)-player.depth;
  // Crash dive: use tauOverride for instant response; clear once dive settles
  const crashActive=!!player._crashDiving;
  if(crashActive && player._crashTauOverride>0){
    // Bleed off override as the dive progresses — snappy start, settles to normal
    player._crashTauOverride=Math.max(0, (player._crashTauOverride||0)-dt*0.025);  // slow bleed — keeps dive responsive for ~16s
  } else {
    player._crashTauOverride=0;
  }
  const tau=Math.max(0.08, player._crashTauOverride>0
    ? player._crashTauOverride
    : (C.player.depthTau||3.0));
  const rateMult=crashActive?(C.player.crashDive.rateMult??3.5):1.0;

  // ── HPA system — runs before depth physics so authority is current ────────
  const hpaC = C.player.hpa;
  const hpa  = player.damage?.hpa;
  const maxP = hpaC?.maxPressure   || 207;
  const maxR = hpaC?.reservePressure || 207;
  const ambient = (player.depth||0) * ((hpaC?.ambientPerMetre)||0.1);

  if(hpaC && hpa){
    // ── Emergency blow — continuous flow physics ─────────────────────────
    // Flow rate proportional to (bankPressure - ambient).
    // If reserve is committed, it adds to available pressure.
    // ── Manual blow — pending failure detection then DC manual sequence ──────
    if(player._blowPending){
      player._blowPendingT = (player._blowPendingT||0) - dt;
      if(player._blowPendingT <= 0){
        player._blowPending = false;
        // Helm reports no response — trigger DC manual sequence
        _COMMS?.trim?.blowNoResponse();
        player._blowManualT = 12; // DC takes ~12s to manually shut vents + open HPA
      }
    }
    // DC manual blow — counts down, then activates venting
    if(player._blowManualT > 0){
      player._blowManualT -= dt;
      if(player._blowManualT <= 8 && !player._blowManualVentsMsg){
        player._blowManualVentsMsg = true;
        _COMMS?.trim?.blowManualVentsShut();
      }
      if(player._blowManualT <= 0){
        player._blowManualT = 0;
        player._blowManualVentsMsg = false;
        player._blowVenting = true;
        _COMMS?.trim?.blowManualHPAOpen(player._blowAmbient||0, player._blowGroupP||0);
      }
    }

    if(player._blowVenting){
      const availPressure = hpa.pressure + (hpa._reserveCommitted ? hpa.reserve : 0);
      const differential  = availPressure - ambient;

      // Check if tanks are already clear — if so, seal valves and ride buoyancy up
      const mbtB = player.damage?.mbt;
      const maxTankFill = mbtB ? Math.max(...mbtB.tanks) : 1;
      const tanksClear = maxTankFill < 0.02;

      if(tanksClear){
        // Tanks empty — seal the blow valves. Keep _blownBallast flag
        // so the depth controller doesn't refill tanks during ascent.
        player._blowVenting = false;
        player._blowVy = 0;
        player._blownBallast = true;
        if(hpa) hpa._reserveCommitted = false;
        // Check if actually positively buoyant — flooding mass may overwhelm empty MBTs
        const floodLoad = _DMG?.getTrimState?.()?.buoyancy || 0;
        const floodFE = C.player.floodFillEquiv ?? 1.0;
        // Blown tanks: avgFill≈0. Effective fill = 0 + floodLoad * equiv.
        // Positive buoyancy when effectiveFill < neutralFill (0.50)
        const netBuoy = 0.50 - (floodLoad * floodFE);
        if(netBuoy > 0){
          _COMMS?.trim?.blowTanksClear?.(Math.round(player.depth));
        } else {
          _COMMS?.trim?.blowOverwhelmed?.(Math.round(player.depth));
        }
      } else if(differential > 0){
        // Flow rate: blowFlowRate × differential / referenceBar
        const flowRate = (hpaC.blowFlowRate||0.5) * differential / (hpaC.blowReferenceBar||50);
        // Draw pressure from bank (reserve first if committed)
        const draw = flowRate * dt;
        if(hpa._reserveCommitted && hpa.reserve > 0){
          const fromRes = Math.min(hpa.reserve, draw);
          hpa.reserve  -= fromRes;
          const rem = draw - fromRes;
          hpa.pressure = Math.max(0, hpa.pressure - rem);
        } else {
          hpa.pressure = Math.max(0, hpa.pressure - draw);
        }
        // Reduce MBT fill — air displaces water out of tanks.
        // Depth matters: air at bank pressure expands at ambient (Boyle's law).
        // At shallow depth each bar of air displaces more water than at deep depth.
        // depthEfficiency = referenceBar / ambient — higher at shallow, lower at deep.
        if(mbtB){
          const depthEfficiency = (hpaC.blowReferenceBar||50) / Math.max(ambient, 1);
          const fillReduction = flowRate * (hpaC.blowFlowToFillRate||0.025) * depthEfficiency * dt;
          for(let i=0;i<mbtB.tanks.length;i++) mbtB.tanks[i] = Math.max(0, mbtB.tanks[i] - fillReduction);
        }
        // Small surge component — buoyancy does the main work
        const flowToVy = hpaC.blowFlowToVy || 0.4;
        player._blowVy = -(flowRate * flowToVy);
      } else {
        // Differential gone — pressure can no longer displace water, tanks not yet clear
        player._blowVy = 0;
        player._blowVenting = false;
        if(hpa) hpa._reserveCommitted = false;
        _COMMS?.trim?.blowExhausted(Math.round(player.depth));
      }

      // Cancel venting when surfaced (≤20m — at surface threshold)
      if(player.depth <= 20){
        player._blowVenting = false;
        player._blowVy = 0;
        if(hpa) hpa._reserveCommitted = false;
        _COMMS?.trim?.blowSurfaced();
      }
    } else {
      player._blowVy = 0;
    }

    // ── Normal ballast authority — pressure vs ambient ────────────────────
    const minRatio = hpaC.controlMinRatio || 1.2;
    const fullThresh = ambient * minRatio;
    const hpaBallastAuth = ambient <= 0 ? 1.0
      : clamp((hpa.pressure - ambient) / Math.max(fullThresh - ambient, 0.1), 0, 1);
    player._hpaBallastAuth = hpaBallastAuth;

    // ── Ascent cost — charged when venting tanks (draining = compressed air used) ──
    // Cost proportional to fill drain rate × depth (more pressure needed at depth)
    // player._fillDrainRate set by depth controller each frame when venting water
    if(!player._blowVenting && (player._fillDrainRate||0) > 0 && player.depth > 5){
      const depthMult = 1 + (player.depth / 300);
      const costPerDrain = hpaC.ascentCostPerMetre || 0.04;
      hpa.pressure = Math.max(0, hpa.pressure
        - player._fillDrainRate * costPerDrain * depthMult * dt * 12);
      // factor 12: converts fill-rate to approximate m equivalent for cost continuity
    }

    // ── Recharge — surface or snorkeling ────────────────────────────────
    // HPA recharged from atmospheric air: surfaced (≤20m) or snorkeling.
    // HP active recharge adds noise; both stop when fully submerged.
    const atSurface = player.depth <= 20;
    const canRechargeHPA = atSurface || player.snorkeling;
    if(!player._blowVenting && canRechargeHPA){
      // Surface recharge resets reserve commitment — full banks available for next emergency
      if(hpa._reserveCommitted) hpa._reserveCommitted = false;
      const lpRate = hpaC.lpRechargeRate || 0.4;
      hpa.pressure = Math.min(maxP, hpa.pressure + lpRate * dt);
      hpa.reserve  = Math.min(maxR, hpa.reserve  + lpRate * 0.5 * dt);
      // HP compressor boost — player toggle, noisier, faster
      if(hpa.recharging){
        hpa.pressure = Math.min(maxP, hpa.pressure + (hpaC.hpRechargeRate||2.5)*dt);
        hpa.reserve  = Math.min(maxR, hpa.reserve  + (hpaC.hpRechargeRate||2.5)*0.3*dt);
        player.noiseTransient = Math.min(1,(player.noiseTransient||0)+(hpaC.rechargeNoiseAdd||0.55)*dt);
      }
      // Comms — once per surface visit when tanks need filling
      if(!player._surfaceRechargeNotified && hpa.pressure < maxP * 0.98){
        player._surfaceRechargeNotified = true;
        _COMMS?.trim?.surfaceRechargeStarted(Math.round(hpa.pressure));
      }
    } else {
      // Submerged — no recharge possible
      player._surfaceRechargeNotified = false;
    }

    // ── Low pressure warnings (once per band) ────────────────────────────
    const pressureFrac = hpa.pressure / maxP;
    const pBand = pressureFrac < 0.08 ? 'crit' : pressureFrac < 0.25 ? 'low' : 'ok';
    if(pBand !== (player._lastPBand||'ok')){
      player._lastPBand = pBand;
      _COMMS?.trim?.hpaLow(Math.round(pressureFrac*100));
    } else if(pBand==='ok') player._lastPBand='ok';

    // ── Blow progress reports (every ~15s while venting) ─────────────────
    if(player._blowVenting){
      player._blowReportT = (player._blowReportT||0) + dt;
      if(player._blowReportT >= 15){
        player._blowReportT = 0;
        const diff = (hpa.pressure + (hpa._reserveCommitted?hpa.reserve:0)) - ambient;
        _COMMS?.trim?.blowProgress(Math.round(player.depth), Math.round(diff));
      }
    } else {
      player._blowReportT = 0;
    }

  } else {
    player._hpaBallastAuth = 1.0;
    player._blowVy = 0;
  }

  // ── MBT fill state — ensure initialised ─────────────────────────────────
  if(player.damage && !player.damage.mbt){
    player.damage.mbt = { tanks:[0.50,0.50,0.50,0.50,0.50], trimF:0.25, trimA:0.25, neutralFill:0.50 };
  }
  const mbt = player.damage?.mbt;
  const neutralFill = mbt?.neutralFill ?? 0.50;
  const avgFill = mbt ? mbt.tanks.reduce((a,b)=>a+b,0)/mbt.tanks.length : neutralFill;

  // ── Trim / buoyancy from flooding ─────────────────────────────────────────
  // Flooding adds mass — modelled as equivalent MBT fill increase.
  // floodFillEquiv 0.28 — each fully flooded section ≈ 0.28 fill units.
  // With normal tanks (avgFill=0.50) and neutralFill=0.50:
  //   2 flooded → effective fill 1.06 → ~2.0 m/s sink (planes fight it)
  //   3 flooded → effective fill 1.34 → ~3.0 m/s sink (boat is lost)
  // With blown tanks (avgFill≈0):
  //   2 flooded → effective fill 0.56 → ~0.2 m/s (blow saves you)
  //   3 flooded → effective fill 0.84 → ~1.2 m/s (marginal)
  const {trim:floodTrim, buoyancy:floodBuoy} = _DMG?.getTrimState?.() || {trim:0,buoyancy:0};
  const floodFillEquiv = C.player.floodFillEquiv ?? 1.0;
  const effectiveFill  = avgFill + floodBuoy * floodFillEquiv;
  const trimDemand  = Math.abs(floodTrim) / (C.player.trimFullAuthority||2.0);
  const speedFactor = clamp(player.speed / (C.player.planeMinSpeed||10.0), 0, 1);
  const planeAuthority = clamp(1 - trimDemand*(1-speedFactor), 0, 1);

  // ── Planes and pitch physics ──────────────────────────────────────────────
  if(!player.planes) player.planes = {
    fwd:{ angle:0, mode:'hydraulic' },
    aft:{ angle:0, mode:'hydraulic' },
  };
  const pFwd = player.planes.fwd;
  const pAft = player.planes.aft;
  const fwdMode = dmgFx.fwdPlaneMode || 'hydraulic';
  const aftMode = dmgFx.aftPlaneMode || 'hydraulic';

  // Detect mode transitions and fire comms once per change
  if(fwdMode !== (pFwd.mode||'hydraulic')){
    const prev = pFwd.mode; pFwd.mode = fwdMode;
    if(fwdMode==='air_emergency') _COMMS?.planes?.fwdAirEmergency();
    else if(fwdMode==='frozen')   _COMMS?.planes?.fwdControlLost();
    if(prev==='air_emergency' && fwdMode==='hydraulic') _COMMS?.planes?.fwdHydraulicRestored();
  }
  if(aftMode !== (pAft.mode||'hydraulic')){
    const prev = pAft.mode; pAft.mode = aftMode;
    if(aftMode==='air_emergency'){
      const transferred = dmgFx.aftCtrlTransferred;
      _COMMS?.planes?.aftAirEmergency(transferred);
    }
    if(prev==='air_emergency' && aftMode==='hydraulic') _COMMS?.planes?.aftHydraulicRestored();
  }
  // Aft control transfer notification (once)
  if(dmgFx.aftCtrlTransferred && !player._aftCtrlTransferNotified){
    player._aftCtrlTransferNotified = true;
    _COMMS?.planes?.aftControlTransferred();
  } else if(!dmgFx.aftCtrlTransferred){
    player._aftCtrlTransferNotified = false;
  }

  // Pitch target — driven by depth error and trim imbalance
  // Aft planes set pitch; forward planes correct trim offset
  // NOTE: positive pitch = nose up = ascend. errD negative means want shallower → need nose up → positive target.
  const pitchMax     = 15;   // degrees max operational pitch
  // During e-blow or blown ascent, force full nose-up until near surface
  const blowing      = player._blowVenting || false;
  const blownAscent  = player._blownBallast && player.depth > 30;
  const pitchFromErr = (blowing || blownAscent) ? pitchMax : clamp(-errD * 0.08, -pitchMax, pitchMax);
  const pitchFromTrim= clamp(-floodTrim * 2.0, -8, 8);          // trim imbalance → fwd plane correction
  const pitchTarget  = pitchFromErr;
  const fwdTarget    = pitchFromTrim;

  // Plane response rate — degraded by mode and HPA availability
  const hpaAvail = (hpa?.pressure||0) > ambient;
  const aftRate  = aftMode==='frozen'?0 : aftMode==='air_emergency'&&!hpaAvail?0 : aftMode==='air_emergency'?2.5:8; // deg/s
  const fwdRate  = fwdMode==='frozen'?0 : fwdMode==='air_emergency'&&!hpaAvail?0 : fwdMode==='air_emergency'?1.5:6;

  // Move planes toward targets at their rate
  const aftDelta = clamp(pitchTarget - pAft.angle, -aftRate*dt, aftRate*dt);
  const fwdDelta = clamp(fwdTarget   - pFwd.angle, -fwdRate*dt, fwdRate*dt);
  pAft.angle = clamp(pAft.angle + aftDelta, -pitchMax, pitchMax);
  pFwd.angle = clamp(pFwd.angle + fwdDelta, -8, 8);

  // HPA cost for air emergency planes — per degree of movement
  if(hpa && (aftMode==='air_emergency' || fwdMode==='air_emergency')){
    const moveDeg = Math.abs(aftDelta)*(aftMode==='air_emergency'?1:0)
                  + Math.abs(fwdDelta)*(fwdMode==='air_emergency'?1:0);
    if(moveDeg > 0.001){
      hpa.pressure = Math.max(0, hpa.pressure - moveDeg * 0.02);
    }
    // Noise contribution from pneumatic plane actuation
    const planeNoise = (Math.abs(pAft.angle)/pitchMax)*0.08 + (Math.abs(pFwd.angle)/8)*0.04;
    player.noiseTransient = Math.min(1,(player.noiseTransient||0)+planeNoise*dt);
  }

  // Frozen planes stuck warning (once, when HPA runs out during air emergency)
  if((aftMode==='air_emergency'||fwdMode==='air_emergency') && !hpaAvail && !player._planesFrozenWarned){
    player._planesFrozenWarned = true;
    _COMMS?.planes?.planesFrozenNoHPA(Math.round(pAft.angle));
  } else if(hpaAvail){ player._planesFrozenWarned = false; }

  // Actual pitch — aft planes dominate, fwd planes add small correction
  const pitchActual = pAft.angle * 0.85 + pFwd.angle * 0.15;
  player.pitch = pitchActual;

  // ── Fill-based depth controller ──────────────────────────────────────────
  // HPA authority gates venting (draining tanks) — flooding is always free
  const hpaBallastAuthV = player._hpaBallastAuth ?? 1.0;
  const kFill     = C.player.kFill    || 0.0016;
  const fillRate  = (C.player.fillRate || 0.022) * rateMult * (dmgFx.depthRateMult ?? 1.0);

  // Clear blown ballast flag when surfaced or on new depth order away from surface
  if(player._blownBallast){
    if(player.depth <= 20){
      player._blownBallast = false;
      // Clear emergency and action stations on surfacing after e-blow
      setCasualtyState('normal');
      setTacticalState('cruising');
    }
    else if(player.depthOrder > 20) player._blownBallast = false;
  }

  // ── Crash dive ballast flood — mirror of e-blow ───────────────────────
  // Vents open: sea pressure floods tanks rapidly. No HPA needed.
  if(crashActive && mbt && !player._crashTanksFull){
    const floodRate = (C.player.crashDive.ballastFloodRate ?? 0.08) * dt;
    for(let i=0;i<mbt.tanks.length;i++) mbt.tanks[i] = Math.min(1, mbt.tanks[i]+floodRate);
    const minFill = Math.min(...mbt.tanks);
    if(minFill >= 0.98) player._crashTanksFull = true;
  }

  if(!blowing && !player._blownBallast && !crashActive && mbt){
    // Two-zone depth controller:
    // Outside brake zone — full authority (constant max fill offset, fast approach)
    // Inside brake zone  — proportional settle (avoids hanging near target)
    const brakeZone      = C.player.depthBrakeZone      || 15;
    const maxFillOffset  = C.player.depthMaxFillOffset   || 0.08;
    const errAbs = Math.abs(errD);
    const fillOffset = errAbs < brakeZone
      ? errD * (maxFillOffset / brakeZone)     // proportional inside brake zone
      : Math.sign(errD) * maxFillOffset;       // full authority outside brake zone
    const targetFill = clamp(neutralFill + fillOffset, 0.02, 0.98);
    const wantDrain  = targetFill < avgFill; // need to vent water
    // Draining requires HPA authority; flooding is always free (sea pressure helps)
    const effectiveRate = wantDrain
      ? fillRate * hpaBallastAuthV
      : fillRate;
    const delta = clamp(targetFill - avgFill, -effectiveRate*dt, effectiveRate*dt);
    for(let i=0;i<mbt.tanks.length;i++) mbt.tanks[i] = clamp(mbt.tanks[i]+delta, 0, 1);
    // Track drain rate for HPA cost calculation
    player._fillDrainRate = delta < 0 ? Math.abs(delta)/dt : 0;
  }

  // Buoyancy velocity — effective fill includes flood mass.
  // fill below neutral → positive buoyancy → rise (negative vy)
  // fill above neutral → negative buoyancy → sink (positive vy)
  const buoyancyVy = (effectiveFill - neutralFill) * (C.player.buoyancyScale || 3.6);

  // Plane-driven vy: speed × sin(pitch) — blended with buoyancy at speed
  const planeVy   = -(player.speed / 1.944) * Math.sin(deg2rad(pitchActual));
  const planeBlend = clamp(player.speed / (C.player.planeMinSpeed||10), 0, 1);
  // During blow — let buoyancy and blowVy do the work, planes just provide attitude
  const planeContrib = blowing ? 0 : planeVy * planeBlend * planeAuthority;

  // Net velocity — no hardcoded sink rate; flooding works through buoyancy
  const netVy = buoyancyVy + planeContrib + (player._blowVy||0);
  player.depth = clamp(player.depth + netVy*dt, 0, world.ground-40);

  // ── Trim warnings (rate-limited) ─────────────────────────────────────────
  if(_COMMS && floodBuoy > 0){
    const now = session.missionT||0;
    // Plane authority warning — once per crossing of each band
    const authBand = planeAuthority < 0.3 ? 'low' : planeAuthority < 0.6 ? 'med' : 'ok';
    if(authBand !== (player._lastAuthBand||'ok') && authBand !== 'ok'){
      player._lastAuthBand = authBand;
      if(authBand==='med') _COMMS?.trim.planesDemanded(Math.round(planeAuthority*100));
      if(authBand==='low') _COMMS?.trim.planesOverwhelmed(Math.round(player.speed));
    } else if(authBand==='ok') player._lastAuthBand='ok';
    // Buoyancy load warning — once per band crossing
    const buyBand = floodBuoy > 2.5 ? 'crit' : floodBuoy > 2.0 ? 'high' : floodBuoy > 1.0 ? 'med' : 'ok';
    if(buyBand !== (player._lastBuyBand||'ok')){
      player._lastBuyBand = buyBand;
      if(buyBand==='med')  _COMMS?.trim.ballastStrained(Math.round(floodBuoy/2.5*100));
      if(buyBand==='high') _COMMS?.trim.ballastLimit();
      if(buyBand==='crit') _COMMS?.trim.ballastOverwhelmed();
    }
  }

  // Depth envelope warnings and progressive flooding
  const C_p = C.player;
  const sdd  = C_p.safeDivingDepth ?? 300;
  const dl   = C_p.divingLimit     ?? 400;
  const dd   = C_p.designDepth     ?? 480;
  const colD = dmgFx.maxDepth ?? (C_p.maxDepth ?? 500);
  const tState = session.tacticalState || 'cruising';

  // ── Diving limit warning (once per crossing) ───────────────────────────
  if(player.depth > dl){
    if(!player._dlWarned){
      player._dlWarned = true;
      _COMMS?.depth.divingLimit(player.depth, tState);
    }
  } else {
    player._dlWarned = false;
  }

  // ── Design depth warning (once per crossing) ──────────────────────────
  if(player.depth > dd){
    if(!player._ddWarned){
      player._ddWarned = true;
      _COMMS?.depth.designDepth(player.depth);
    }
  } else {
    player._ddWarned = false;
  }

  // ── Collapse / crush depth ────────────────────────────────────────────
  // Structural damage (HP loss) reduces the effective crush depth.
  // Full HP → nominal crush depth. 30 HP (2 hits) → ~72% of nominal.
  // The crew don't know the exact new limit — only the hull knows.
  const crushD_base = C_p.crushDepth ?? (colD * 1.08);
  const _hpFrac = Math.max(0.01, Math.min(1, (player.hp ?? 100) / 100));
  const crushD = crushD_base * (0.60 + 0.40 * _hpFrac);

  // Near-crush creaking warning — only relevant when structural damage is present
  if((player.hp ?? 100) < 90 && player.depth > crushD * 0.90){
    if(!player._nearCrushWarned){
      player._nearCrushWarned = true;
      _COMMS?.depth.hullDamageCreaking(Math.round(player.depth));
    }
  } else {
    player._nearCrushWarned = false;
  }

  if(player.depth >= crushD && !session.godMode){
    // Past crush depth — catastrophic hull failure, all hands lost
    if(!player._crushed){
      player._crushed = true;
      player.hp = 0;
      _COMMS?.depth.crush(Math.round(player.depth));
      // Kill all crew
      const dmg = player.damage;
      if(dmg){
        for(const comp of ['fore_ends','control_room','aux_section','reactor_comp','engine_room','aft_ends']){
          for(const cr of (dmg.crew[comp]||[])){ cr.status='killed'; }
        }
      }
      session.over = true;
      session.overCause = 'crush';
    }
  } else if(player.depth > colD){
    // Between collapse and crush — structural seep cascade
    if(!player._collapseWarned){
      player._collapseWarned = true;
      _COMMS?.depth.collapseImminentWarning(player.depth);
    }
    _DMG?.applyDepthCascade?.(dt);
  } else {
    // Back above collapse depth — reset cascade
    player._collapseWarned = false;
    player._crushed        = false;
    _DMG?.resetDepthCascade?.();
  }

  // ── Timers ────────────────────────────────────────────────────────────────
  player.emergTurnT=Math.max(0,player.emergTurnT-dt);
  player.emergTurnCd=Math.max(0,player.emergTurnCd-dt);
  player.crashDiveCd=Math.max(0,player.crashDiveCd-dt);

  // ── Battery ───────────────────────────────────────────────────────────────
  {
    const batC=C.player.battery||{};
    const isDiesel=C.player.isDiesel||false;
    if(player.battery==null) player.battery=1.0;
    const atSurface=player.depth<=5;

    // ── Snorkel system (all sub types) ─────────────────────────────────
    const snkDepth=C.player.snorkelDepth??12;

    // ── Snorkel order / cancel transitions ────────────────────────────
    if(player.snorkelOrdered && !player._snorkelOrderedFired){
      player._snorkelOrderedFired=true;
      player._snorkelCancelledFired=false;
      _COMMS?.snorkel?.ordered();
    }
    if(!player.snorkelOrdered && !player._snorkelCancelledFired && player._snorkelOrderedFired){
      player._snorkelCancelledFired=true;
      player._snorkelOrderedFired=false;
      if(player.snorkeling) _COMMS?.snorkel?.cancelled();
    }

    // ── Snorkel depth management ───────────────────────────────────────
    if(player.snorkelOrdered && !player.snorkeling){
      player.depthOrder=snkDepth;
      if(player.depth<=snkDepth+5){
        player.snorkeling=true;
        player._snorkelNoisyCautionFired=false;
        _COMMS?.snorkel?.deployed();
      }
    } else if(!player.snorkelOrdered && player.snorkeling){
      player.snorkeling=false;
    }

    // One-time ESM/noise caution after snorkelling for 10 seconds
    if(player.snorkeling){
      player._snorkelT=(player._snorkelT||0)+dt;
      if(player._snorkelT>=10 && !player._snorkelNoisyCautionFired){
        player._snorkelNoisyCautionFired=true;
        _COMMS?.snorkel?.noisyCaution();
      }
    } else {
      player._snorkelT=0;
    }

    // ── Battery charge / drain ─────────────────────────────────────────
    if(isDiesel){
      if(atSurface||player.snorkeling){
        const dmgFxBat=_DMG?.getEffects()||{};
        const baseRate=atSurface?(batC.surfaceChargeRate??0.005):(batC.chargeRate??0.003);
        const rate=baseRate*(dmgFxBat.chargeRateMult??1.0);
        player.battery=Math.min(1.0, player.battery+rate*dt);
        if(player._battDead && player.battery>0.05){
          player._battDead=false;
          _COMMS?.snorkel?.recovered();
        }
      } else {
        const drain=(player.speed*(batC.drainPerKt??0.00014))*dt;
        player.battery=Math.max(0, player.battery-drain);
      }

      // ── Battery level warnings (once per band) ─────────────────────
      const batPct=Math.round(player.battery*100);
      const batBand=batPct<=10?'crit':batPct<=20?'low':batPct<=30?'med':'ok';
      if(batBand!=='ok' && batBand!==(player._lastBatBand||'ok') && !player.snorkeling && !atSurface){
        player._lastBatBand=batBand;
        _COMMS?.snorkel?.batteryLow(batPct);
      } else if(batBand==='ok'){
        player._lastBatBand='ok';
      }

      // ── Dead battery — kill propulsion, alert once ─────────────────
      if(!player._battDead && player.battery<0.005 && !atSurface && !player.snorkeling){
        player._battDead=true;
        _COMMS?.snorkel?.exhausted();
      }
    } else {
      // Nuclear: drains only during SCRAM, charges when reactor is online
      if(player.scram){
        player.battery=Math.max(0, player.battery-(batC.drainOnScram??0.002)*dt);
      } else {
        player.battery=Math.min(1.0, player.battery+(batC.chargeRate??0.008)*dt);
      }
    }
  }
}

export const NAV = {ktsToWU, updateOrders, stepDynamics};
