'use strict';

import { CONFIG } from '../config/constants.js';
import { rand, clamp, lerp, now, angleNorm } from '../utils/math.js';
import { world, bullets, particles, decoys, cwisTracers, player, enemies,
         wireContacts, sonarContacts, nextTorpId } from '../state/sim-state.js';

// ── Lazy bindings for circular deps ─────────────────────────────────────
let _AI = null;
let _COMMS = null;
let _DMG = null;
let _SENSE = null;
let _onWireCut = null;
let _broadcastTransient = null;

export function _bindWeapons(deps) {
  if (deps.AI) _AI = deps.AI;
  if (deps.COMMS) _COMMS = deps.COMMS;
  if (deps.DMG) _DMG = deps.DMG;
  if (deps.SENSE) _SENSE = deps.SENSE;
  if (deps.onWireCut) _onWireCut = deps.onWireCut;
  if (deps.broadcastTransient) _broadcastTransient = deps.broadcastTransient;
}

const C = CONFIG;

function wrapX(x){return x;}

function makeExplosion(x,y,power=1,watery=false){
  const count=Math.floor(18*power);
  for(let i=0;i<count;i++){
    const a=rand(0,Math.PI*2);
    const sp=rand(40,220)*power;
    particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:rand(0.35,0.9),size:rand(2,6)*power,watery});
  }
}
function splash(x,y,amount=1){
  const count=Math.floor(14*amount);
  for(let i=0;i<count;i++){
    const a=rand(-Math.PI,0);
    const sp=rand(60,260)*amount;
    particles.push({x,y,vx:Math.cos(a)*sp+rand(-30,30),vy:Math.sin(a)*sp-rand(60,120),life:rand(0.35,0.8),size:rand(2,5)*amount,watery:true});
  }
}

let _decoyId=0;
function deployDecoy(x,y,friendly=true,kind="noisemaker",opts={}){
  opts=opts||{};
  const d={
    id:++_decoyId,
    kind,x,y,
    depth: opts.depth ?? 0,
    vx:(opts.vx??rand(-3,3)),
    vy:(opts.vy??rand(-3,3)),
    life:(kind==="flare")?rand(C.decoy.flareLifeMin,C.decoy.flareLifeMax):rand(C.decoy.noisemakerLifeMin,C.decoy.noisemakerLifeMax),
    r:(kind==="flare")?C.decoy.flareR:C.decoy.noisemakerR,
    friendly,
    signature:(kind==="flare")?0.0:(friendly?C.decoy.sigPlayer:C.decoy.sigEnemy),
    mode:opts.mode||null,
    g:opts.g||(kind==="flare"?C.ship?.flareGravity:0)
  };
  decoys.push(d);
  if(kind==="noisemaker") makeExplosion(x,y,0.45,true);
  return d;
}

// launchOffset = angle between aimed bearing and sub heading (radians, 0..PI)
// Returns true if wire snapped at launch
function fireTorpedo(fromX,fromY,dirX,dirY,friendly=true,enableDist=C.player.torpEnableDist,wireGuided=false,launchOffset=0,fromDepth=200,depthOrder=null,statOverrides=null){
  const sp=(statOverrides?.speed??C.torpedo.speed);
  const d=Math.max(1e-6,Math.hypot(dirX,dirY));
  const launchAng=Math.atan2(dirY,dirX);

  // Wire snap probability at launch based on angle offset
  const safeArc=(C.player.torpArcDeg||55)*Math.PI/180;
  let wireLive=wireGuided;
  let wireSnappedAtLaunch=false;
  if(wireGuided && launchOffset>safeArc){
    const excess=Math.min(1,(launchOffset-safeArc)/(Math.PI-safeArc));
    const snapP=excess*excess*0.98;
    if(Math.random()<snapP){ wireLive=false; wireSnappedAtLaunch=true; }
  }

  const runDepth=depthOrder??fromDepth;

  bullets.push({
    kind:"torpedo", x:fromX, y:fromY,
    depth:fromDepth, depthOrder:runDepth, vDepth:0,
    vx:(dirX/d)*sp, vy:(dirY/d)*sp, r:6,
    life: statOverrides?.life ?? C.torpedo.life, friendly,
    dmg: statOverrides?.dmg  ?? C.torpedo.dmg,
    torpId: nextTorpId(),
    seekRange:  statOverrides?.seekRange  ?? C.torpedo.seekRange,
    seekFOV:    statOverrides?.seekFOV    ?? C.torpedo.seekFOV,
    turnRate:   statOverrides?.turnRate   ?? C.torpedo.turnRate,
    speed:      statOverrides?.speed      ?? C.torpedo.speed,
    approachSpeed: statOverrides?.approachSpeed ?? C.torpedo.approachSpeed ?? 15,
    target:null, arming: statOverrides?.arming ?? C.torpedo.arming,
    enableDist, traveled:0, weaveT:rand(0,10),
    seducedBy:null, seduceT:0,
    passiveFOV:   statOverrides?.passiveFOV   ?? C.torpedo.passiveFOV,
    seduceFOV:    statOverrides?.seduceFOV    ?? C.torpedo.seduceFOV,
    seduceRange:  statOverrides?.seduceRange  ?? C.torpedo.seduceRange,
    seduceTime:   statOverrides?.seduceTime   ?? C.torpedo.seduceTime,
    reacquireDelay: statOverrides?.reacquireDelay ?? C.torpedo.reacquireDelay,
    _circleSearch: statOverrides?.circleSearch ?? false,
    wire: wireGuided ? {
      live:wireLive, prevAng:launchAng, fromX, fromY,
      cmdBrg: launchAng,
    } : null,
  });

  // Launch transient — the flood-and-fire sequence is a loud acoustic event.
  if(_broadcastTransient){
    const transRange=C.player.launchTransientRange||2000;
    const transSus=C.player.launchTransientSus||0.35;
    _broadcastTransient(fromX, fromY, transRange, transSus, null);
  }
  return wireSnappedAtLaunch;
}

// Wire update — called each frame on live wired torpedoes.
function wireUpdate(b, dt){
  if(!b.wire||!b.wire.live) return;

  // Fire control damage — wire degradation or immediate severance
  if(_DMG){
    const fx=_DMG.getEffects();
    if(fx.wireCutAll){
      b.wire.live=false;
      _COMMS?.weapons?.wireParted(null,'fire_ctrl');
      _onWireCut?.(b);
      return;
    }
    if(fx.wireUpdateRate<1.0){
      b.wire._updateAcc=(b.wire._updateAcc||0)+dt;
      const interval=1.0/(fx.wireUpdateRate*10);
      if(b.wire._updateAcc<interval) return;
      b.wire._updateAcc=0;
    }
  }

  // Range check — cut wire if torpedo is too far from sub
  let dx=b.x-player.wx;
  let dy=b.y-player.wy;
  const wirePaidOut=Math.hypot(dx,dy);
  b.wire.paidOut=wirePaidOut;
  if(wirePaidOut>C.player.torpWireMaxRange){
    b.wire.live=false;
    _COMMS?.weapons?.wireParted(null,'runout');
    _onWireCut?.(b);
    return;
  }

  b.wire.prevAng=Math.atan2(b.vy,b.vx);

  // If seeker has a lock, wire yields — torpedo.js is already homing
  if(b.target || b.seducedBy) return;

  // Wire guidance — beam-rider approach.
  if(b.wire.autoTDC===false && b.wire.cmdBrg!=null){
    b.targetBrg = b.wire.cmdBrg;
  } else {
  const ref=b.wire.lockedTarget;
  if(ref){
    const sc=sonarContacts?.get(ref);
    const latestBrg=sc?.latestHullBrg ?? sc?.latestBrg;
    if(latestBrg!=null){
      const tmaQ=sc?.tmaQuality??0;
      const TMA=C.tma;

      let beamBrg = latestBrg;

      // Lead angle at SOLID quality
      if(tmaQ>=(TMA?.qualityThresholdSolid??0.70) && sc?._brgRate!=null){
        let pdx=b.x-player.wx;
        let pdy=b.y-player.wy;
        const torpDist=Math.hypot(pdx,pdy);
        const estRange=Math.max(500, sc?._estRange??3000);
        const remaining=Math.max(200, estRange-torpDist);
        const estTof=remaining/(C.torpedo.speed??50);
        beamBrg += sc._brgRate * estTof * 0.5;
      }

      let pdx=b.x-player.wx;
      let pdy=b.y-player.wy;

      const crossTrack = pdx * Math.sin(beamBrg) - pdy * Math.cos(beamBrg);
      const alongTrack = pdx * Math.cos(beamBrg) + pdy * Math.sin(beamBrg);

      const maxCorr = 15 * Math.PI / 180;
      const corrGain = Math.max(alongTrack, 300);
      const correction = clamp(-crossTrack / corrGain, -1, 1) * maxCorr;

      let rawTargetBrg = beamBrg + correction;

      // Fire control damage adds bearing noise
      if(_DMG){
        const wnm=_DMG.getEffects().wireNoiseMult;
        if(wnm>1.0) rawTargetBrg+=rand(-0.02,0.02)*wnm;
      }

      // Smooth bearing — 2s time constant
      if(b.targetBrg == null){
        b.targetBrg = rawTargetBrg;
      } else {
        const diff = angleNorm(rawTargetBrg - b.targetBrg);
        const alpha = Math.min(1.0, dt / 2.0);
        b.targetBrg = b.targetBrg + diff * alpha;
      }
    }
  } else if(b.wire.cmdBrg!=null){
    b.targetBrg = b.wire.cmdBrg;
  }
  } // end else (autoTDC not manually overridden)

  // Sensor sweep — torpedo relays acoustic contacts back via wire.
  const wireRange=C.torpedo.seekRange*1.4;
  b._wireSweepT=(b._wireSweepT||0)-dt;
  const sweepReady=b._wireSweepT<=0;
  if(sweepReady) b._wireSweepT=rand(2.5,4.0);
  for(const e of enemies){
    if(e.dead) continue;
    let edx=_AI.wrapDx(b.x,e.x);
    let edy=e.y-b.y;
    const dist=Math.hypot(edx,edy);
    if(dist>wireRange) continue;
    const u=60+dist*0.08;
    wireContacts.push({
      x:e.x+rand(-u,u),
      y:e.y+rand(-u,u),
      u, life:1.8, kind:e.type,
      fromTorp:{x:b.x,y:b.y}
    });
    // Feed bearing into TMA
    if(sweepReady && sonarContacts?.has(e) && _SENSE?.registerBearing){
      const torpBrg=Math.atan2(edy,edx);
      const torpU=clamp(u/Math.max(dist,50), 0.02, 0.08);
      _SENSE.registerBearing(e, torpBrg, torpU, 'wire', {x:b.x, y:b.y});
    }
  }
}

// Manual wire cut — called from panel
function cutWire(b){
  if(!b?.wire?.live) return;
  b.wire.live=false;
  _COMMS?.weapons?.wireParted(null,'manual');
  _onWireCut?.(b);
}

// ASROC-style missile torpedo
function fireMissileTorpedo(fromX,fromY,targetX,targetY){
  const cfg=C.enemy.asroc;
  const dx=targetX-fromX, dy=targetY-fromY;
  const dist=Math.max(1,Math.hypot(dx,dy));
  const spd=cfg.rocketSpeed??200;
  bullets.push({kind:'rocket', x:fromX, y:fromY,
    vx:(dx/dist)*spd, vy:(dy/dist)*spd,
    targetX, targetY, deployDepth:cfg.deployDepth??45,
    life:40, friendly:false, r:5});
}

function dropDepthCharge(fromX,fromY,targetY){
  const ty=clamp(targetY,world.seaLevel+120,world.ground-80);
  bullets.push({kind:"depthCharge",x:fromX,y:fromY,vx:rand(-20,20),vy:90,r:8,life:5.0,friendly:false,targetY:ty,sink:rand(160,230),dmg:34,blastR:190});
}

function torpAcquire(torp){
  const aAng=Math.atan2(torp.vy,torp.vx);
  const vertW=C.torpedo.vertWindow||120;
  const spd=Math.hypot(torp.vx,torp.vy);

  const activeHoming = !!torp.target;
  const fov = activeHoming
    ? (torp.seekFOV ?? C.torpedo.seekFOV)
    : (C.torpedo.passiveFOV ?? 2.4);
  const noiseDegr = activeHoming
    ? clamp((spd-22)/12, 0, 0.25)
    : clamp((spd-16)/14, 0, 0.60);
  const effectiveRange = (torp.seekRange ?? C.torpedo.seekRange) * (1-noiseDegr);

  let best=null, bestScore=-1;
  const list=[];
  if(torp.friendly){
    for(const e of enemies){
      if(e.dead) continue;
      list.push({ref:e, x:e.x, y:e.y, depth:e.depth??200, sig:e.noise});
    }
    for(const d of decoys) if(!d.friendly&&d.kind==="noisemaker")
      list.push({ref:d, x:d.x, y:d.y, depth:torp.depth, sig:d.signature});
  } else {
    list.push({ref:player, x:player.wx, y:player.wy, depth:player.depth, sig:Math.max(0.35,player.noise)});
    for(const d of decoys) if(d.friendly&&d.kind==="noisemaker")
      list.push({ref:d, x:d.x, y:d.y, depth:torp.depth, sig:d.signature});
  }
  for(const c of list){
    if(Math.abs((c.depth??0)-(torp.depth??0))>vertW) continue;
    const dx=_AI.wrapDx(torp.x,c.x);
    const dy=c.y-torp.y;
    const dist=Math.hypot(dx,dy);
    if(dist>effectiveRange) continue;
    const angTo=Math.atan2(dy,dx);
    const dAng=Math.abs(angleNorm(angTo-aAng));
    if(dAng>fov) continue;
    if(!activeHoming && c.sig < 0.28) continue;
    const centered = 1-(dAng/fov);
    const close = 1-(dist/effectiveRange);
    const score = (c.sig*0.9+0.1)*(0.55+0.45*close)*(0.30+0.70*centered);
    if(score>bestScore){bestScore=score; best=c.ref;}
  }
  return best;
}

// ════════════════════════════════════════════════════════════════════════
// EXPORT (mirrors V1 window.W shape)
// ════════════════════════════════════════════════════════════════════════
export const W = {wrapX,makeExplosion,splash,deployDecoy,fireTorpedo,wireUpdate,cutWire,dropDepthCharge,fireMissileTorpedo,torpAcquire};
