'use strict';

import { CONFIG } from '../config/constants.js';
import { rand, clamp, now } from '../utils/math.js';
import { world, player } from '../state/sim-state.js';
import { session } from '../state/session-state.js';

const C = CONFIG;

export function inLayer(d){return d>=world.layerY1&&d<=world.layerY2;}
// 40% signal loss crossing thermocline — NATO exploited this heavily in Cold War doctrine
export function layerPenalty(d1,d2){const a=inLayer(d1),b=inLayer(d2); return (a!==b)?0.60:1.0;}
export function wrapDx(x1,x2){return x2-x1;}
export function wrapDy(y1,y2){return y2-y1;}

// ── Enemy TMA solver — mirrors the player's solveTMA ────────────────────────
// Gives enemies the same bearing-line least-squares solver.
// Result stored on e.tma{X,Y,Quality,Baseline}
export function solveEnemyTMA(e){
  const obs=e.playerBearings;
  if(!obs||obs.length<2){ e.tmaQuality=0; e.tmaX=null; e.tmaY=null; return; }

  let M11=0,M12=0,M22=0,b1=0,b2=0;
  for(const o of obs){
    const s=Math.sin(o.brg), cs=Math.cos(o.brg);
    M11+=s*s; M12+=-s*cs; M22+=cs*cs;
    const d=-s*o.fromX+cs*o.fromY;
    b1+=d*(-s); b2+=d*cs;
  }
  const det=M11*M22-M12*M12;
  if(Math.abs(det)<1e-8){ e.tmaQuality=0; return; }
  const px=(M22*b1-M12*b2)/det;
  const py=(M11*b2-M12*b1)/det;

  // Reject if solution is behind ANY observation (consistent with player solveTMA)
  for(const o of obs){
    const dot=(px-o.fromX)*Math.cos(o.brg)+(py-o.fromY)*Math.sin(o.brg);
    if(dot<-200){ e.tmaQuality=0; return; }
  }

  let maxBase=0;
  for(let i=0;i<obs.length;i++)
    for(let j=i+1;j<obs.length;j++){
      const bd=Math.hypot(obs[i].fromX-obs[j].fromX, obs[i].fromY-obs[j].fromY);
      if(bd>maxBase) maxBase=bd;
    }
  const MIN_BASE=80, GOOD_BASE=400;
  if(maxBase<MIN_BASE){ e.tmaQuality=0; return; }

  // Bearing spread — same gate as player (≥8° for full credit)
  let maxBrgSpread=0;
  for(let i=0;i<obs.length;i++)
    for(let j=i+1;j<obs.length;j++){
      const d=Math.abs(((obs[i].brg-obs[j].brg+3*Math.PI)%(Math.PI*2))-Math.PI);
      if(d>maxBrgSpread) maxBrgSpread=d;
    }
  const qSpread=clamp(maxBrgSpread/(8*Math.PI/180),0,1);

  const qBase=clamp(maxBase/GOOD_BASE,0,1);
  const qObs=clamp(obs.length/8,0,1);
  e.tmaX=px; e.tmaY=py; e.tmaBaseline=maxBase;
  e.tmaQuality=qBase*qObs*qSpread;
}

// Register a new bearing observation from enemy toward player
export function enemyRegisterBearing(e){
  const dx=wrapDx(e.x,player.wx);
  const dy=player.wy-e.y;
  const trueBrg=Math.atan2(dy,dx);
  const dist=Math.hypot(dx,dy);
  // Bearing noise proportional to dist and own noise
  const u=clamp((80+dist*0.08)*(1+e.noise*0.4)/dist, 0.02, 0.20);
  const noisyBrg=trueBrg+rand(-1,1)*u;

  if(!e.playerBearings) e.playerBearings=[];
  // Cull old bearings (>120s game time)
  const T=session.missionT||0;
  e.playerBearings=e.playerBearings.filter(b=>T-b.t<120);
  if(e.playerBearings.length>=16) e.playerBearings.shift();
  e.playerBearings.push({fromX:e.x, fromY:e.y, brg:noisyBrg, t:T});

  // Solve immediately
  solveEnemyTMA(e);

  // Update contact point — TMA position if quality good, else bearing-range estimate
  const prevContact=e.contact;
  if(e.tmaQuality>=0.20 && e.tmaX!=null){
    e.contact={x:e.tmaX, y:e.tmaY, u:200*(1-e.tmaQuality), t:now(), strength:e.tmaQuality};
  } else {
    const estRange=dist+(rand(-1,1)*dist*0.25); // ±25% range noise
    e.contact={
      x:e.x+Math.cos(noisyBrg)*estRange,
      y:e.y+Math.sin(noisyBrg)*estRange,
      u:400, t:now(), strength:0.15
    };
  }
}

export function enemyHasFireSolution(e){
  if(!e.contact) return false;
  const age=now()-e.contact.t;
  if(age>C.enemy.fireMaxAge) return false;
  // Require some minimal TMA quality — hasRoleSolution in sim.js is the real gate
  if((e.tmaQuality||0)<0.20) return false;
  if(e.suspicion<C.enemy.fireMinSus) return false;
  if((e.playerBearings||[]).length<2) return false; // need at least a basic bearing history
  return true;
}

// sensorPos: optional {x,y,depth} — the actual sensor location (buoy, helo dip).
// When omitted, defaults to the enemy ship's own position.
export function enemyUpdateContactFromPing(e,px,py,dist,sensorPos){
  const sx=sensorPos?.x??e.x;
  const sy=sensorPos?.y??e.y;
  const sDepth=sensorPos?.depth??e.vdsDepth??e.depth??400;
  const layer=layerPenalty(py,sDepth);
  const u=(160+dist*0.10)*(layer<1?1.55:1.0);
  e.contact={
    x:px+rand(-u,u),
    y:clamp(py+rand(-u,u),world.seaLevel+80,world.ground-80),
    u, t:now(),
    strength:clamp(0.50+(1-dist/2000)*0.40,0.30,0.92)
  };
  e.suspicion=Math.min(1,e.suspicion+0.45*e.contact.strength);
  // Bearing computed from SENSOR position, not ship — correct for buoys/helos
  if(!e.playerBearings) e.playerBearings=[];
  const brg=Math.atan2(py-sy, wrapDx(sx,px));
  const T=session.missionT||0;
  for(let i=0;i<3;i++){
    e.playerBearings.push({fromX:sx+rand(-50,50), fromY:sy+rand(-50,50), brg:brg+rand(-1,1)*0.06, t:T-i*8});
  }
  if(e.playerBearings.length>16) e.playerBearings.splice(0, e.playerBearings.length-16);
  // Rough position hint — lower quality ceiling from ping alone
  e.tmaX=px+rand(-1,1)*150; e.tmaY=py+rand(-1,1)*150;
  e.tmaQuality=Math.min((e.tmaQuality||0) + 0.22, 0.38); // ping gives a start, not a solution
}

// Enemy speed deafness — Soviet hulls noisier, go deaf at lower speeds than NATO
// Uses C.enemy.deafStartKts/deafFullKts/deafnessCeil (Soviet) vs C.player.speedDeafness (NATO)
export function enemySpeedDeafness(e){
  const startKts = C.enemy.deafStartKts ?? 3;
  const fullKts  = C.enemy.deafFullKts  ?? 8;
  const ceil     = C.enemy.deafnessCeil ?? 0.92;
  const kts=Math.hypot(e.vx||0,e.vy||0);
  return 1.0-clamp((kts-startKts)/(fullKts-startKts),0,ceil);
}

export function enemyMaybeHearPlayer(e,dt){
  // Tick interval scales with enemy speed — fast sprinting = deaf
  e._hearTick=(e._hearTick||0)-dt;
  const deafness=enemySpeedDeafness(e);
  const tickBase=rand(0.7,1.3)/Math.max(0.15,deafness);
  if(e._hearTick>0) return;
  e._hearTick=tickBase;

  const dx=wrapDx(e.x,player.wx);
  const dy=player.wy-e.y;
  const d=Math.hypot(dx,dy);
  const baseRange=(e.type==='boat')?C.enemy.hearBoatRange:C.enemy.hearSubRange;
  if(d>baseRange) return;

  const sonarDepth=e.vdsDepth||e.depth||400;
  const layer=layerPenalty(player.depth,sonarDepth);
  let signal=player.noise*layer*(1-d/baseRange);
  if(e.type==='boat' && (player.periscopeT||0)>0) signal*=(C.player.periscope?.detectBoost||1.55);
  if(signal<C.enemy.hearSignalMin) return;

  // ── Enemy deaf arc — player can hide in enemy baffles ─────────────────────
  // Uses enemyBaffle* fields from C.player.sonar (Soviet boats: wider, speed-sensitive)
  const sg=C.player.sonar||{};
  const eBaffleBase =(sg.enemyBaffleBase??20)*Math.PI/180;
  const eBaffleMax  =(sg.enemyBaffleMax ??55)*Math.PI/180;
  const eBaffleHalf =clamp(eBaffleBase+(e.speed||0)*(sg.enemyBafflePerKt??2.0)*Math.PI/180, eBaffleBase, eBaffleMax);
  const eRolloff    =(sg.baffleRolloffDeg??20)*Math.PI/180;
  const eBrg        =Math.atan2(dy,dx);
  const eRelAngle   =Math.abs(((eBrg-(e.heading||0)+3*Math.PI)%(Math.PI*2))-Math.PI);
  const eDeadStart  =Math.PI-eBaffleHalf;
  const eFullLimit  =eDeadStart-eRolloff;
  const eGeoMult    =eRelAngle<=eFullLimit?1.0:eRelAngle>=eDeadStart?0.0:1.0-(eRelAngle-eFullLimit)/eRolloff;
  signal*=eGeoMult;
  if(signal<C.enemy.hearSignalMin) return;

  // Detection prob — deafness reduces it when enemy is sprinting; sensitivity scales hearing
  // _dmgSensorMult: sonar casualty from torpedo damage (set in damageEnemy in sim.js)
  const sensorMult=e._dmgSensorMult??1.0;
  const p=clamp((signal-C.enemy.hearPBase)*C.enemy.hearPScale*deafness*(e.sensitivity||1.0)*sensorMult, 0, 0.80);
  if(Math.random()<p){
    const susGain=clamp(0.05+signal*0.22, 0.05, 0.18);
    e.suspicion=Math.min(1, e.suspicion+susGain);
    enemyRegisterBearing(e);
  }
}

export function enemyDecay(e,dt){
  const quiet=(player.noise<C.enemy.quietNoiseThreshold);
  // Decay TMA quality when not actively observing
  const T=session.missionT||0;
  const lastObs=e.playerBearings?.length ? e.playerBearings[e.playerBearings.length-1].t : 0;
  const staleSecs=T-lastObs;
  if(staleSecs>15 && (e.tmaQuality||0)>0){
    e.tmaQuality=Math.max(0,(e.tmaQuality||0)-0.003*dt);
    if(e.tmaQuality<=0){ e.tmaX=null; e.tmaY=null; }
  }

  e.suspicion=Math.max(0,e.suspicion-(C.enemy.susDecayBase+(quiet?C.enemy.susDecayQuietExtra:0))*dt);
  if(e.contact){
    const age=now()-e.contact.t;
    if(age>C.enemy.contactMaxAge||(quiet&&age>C.enemy.contactMaxAgeQuiet)) e.contact=null;
  }
}

// ── Enemy acoustic noise model ────────────────────────────────────────────────
// Dynamic noise updated each tick — mirrors player signature.js model.
// Soviet-era boats: noisier per knot, cavitate ~25% earlier than NATO boats.
export function updateEnemyNoise(e){
  const spd=Math.hypot(e.vx||0, e.vy||0);
  const floor=e._noiseFloor??0.28;
  // Flow noise: Soviet boats ~30% noisier per knot (worse vibration isolation)
  const flow=(spd/C.player.flowNoiseDiv)*1.3;
  let n=clamp(floor+flow, 0, 1);
  // Cavitation: Soviet props cavitate ~25% earlier than NATO equivalents
  const depth=e.depth??300;
  const d=clamp((depth-world.seaLevel)/C.player.cavitationDepthRef, 0, 2.0);
  const cavThresh=(C.player.cavitationKtsRef+d*(C.player.cavitationDepthRef*C.player.cavitationSlope))*0.75;
  if(spd>cavThresh) n=clamp(n+C.player.cavitationSpike*0.8, 0, 1);
  // Golf-class snorkel: diesel SSBN must surface-snorkel periodically — very loud
  // _snorkeling flag set/cleared by sim.js tick; this is the noise injection point
  if(e._snorkeling) n=clamp(n+0.52, 0, 1);
  // Damage noise penalty: machinery casualties raise noise floor (set by casualty roll in sim.js)
  if(e._dmgNoisePenalty) n=Math.min(1, n+e._dmgNoisePenalty);
  e.noise=n;
}
