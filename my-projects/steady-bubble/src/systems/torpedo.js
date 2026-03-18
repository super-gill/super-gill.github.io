// torpedo.js — torpedo flight, seeker, and homing logic
// One function: TORP.update(torp, dt)
// Wire guidance is handled externally — wire just writes torp.targetBrg each tick.
// Seeker overwrites targetBrg when it has a lock. That's the whole priority system.

'use strict';

import { CONFIG } from '../config/constants.js';
import { clamp, lerp, angleNorm } from '../utils/math.js';
import { world, player, enemies, decoys } from '../state/sim-state.js';
import { setMsg, addLog } from '../state/session-state.js';

// ── Lazy bindings for circular deps ─────────────────────────────────────
let _AI = null;
let _damageEnemy = null;
let _damagePlayer = null;

export function _bindTorpedo(deps) {
  if (deps.AI) _AI = deps.AI;
  if (deps.damageEnemy) _damageEnemy = deps.damageEnemy;
  if (deps.damagePlayer) _damagePlayer = deps.damagePlayer;
}

const C = CONFIG;

// ── Seeker ──────────────────────────────────────────────────────────────────
function seekerScan(torp){
  const cfg=C.torpedo;

  const torpAng=Math.atan2(torp.vy, torp.vx);

  const fov  = torp.target ? (torp.seekFOV??cfg.seekFOV) : (torp.passiveFOV??cfg.passiveFOV??2.4);
  const range= torp.seekRange ?? cfg.seekRange;

  const depthWin = torp.target
    ? (cfg.vertWindow??120) * 0.6
    : (cfg.vertWindow??120);

  const candidates = torp.friendly ? enemies : [player];

  let best=null, bestDist=Infinity;
  for(const t of candidates){
    if(!t || (t.dead??false)) continue;
    const tx=t.wx??t.x, ty=t.wy??t.y;
    const dx=_AI.wrapDx(torp.x, tx);
    const dy=ty - torp.y;
    const dist=Math.hypot(dx,dy);
    const layerMult = (!torp.target && _AI)
      ? _AI.layerPenalty(torp.depth??200, t.depth??200)
      : 1.0;
    if(dist > range * layerMult) continue;
    if(Math.abs((torp.depth??200)-(t.depth??200)) > depthWin) continue;
    const angTo=Math.atan2(dy,dx);
    const dAng=Math.abs(angleNorm(angTo-torpAng));
    if(dAng > fov) continue;
    if(dist < bestDist){ bestDist=dist; best=t; }
  }

  // Decoy seduction
  if(!torp.seducedBy){
    if(!torp._testedDecoys) torp._testedDecoys=[];
    const seduceRange=torp.seduceRange??cfg.seduceRange??300;
    const seduceFOV  =torp.seduceFOV??cfg.seduceFOV??2.8;
    for(const d of decoys){
      if(d.kind!=='noisemaker' || d.life<=0) continue;
      if(torp.friendly && d.friendly) continue;
      if(!torp.friendly && !d.friendly) continue;
      if(torp._testedDecoys.includes(d.id)) continue;
      const dx=_AI.wrapDx(torp.x, d.x);
      const dy=d.y-torp.y;
      if(Math.hypot(dx,dy)>seduceRange) continue;
      const angTo=Math.atan2(dy,dx);
      if(Math.abs(angleNorm(angTo-torpAng)) > seduceFOV/2) continue;

      torp._testedDecoys.push(d.id);

      if(best){
        const targetNoise = torp.friendly
          ? (best.noise??0.3)
          : (player.noise??0.2);
        const decoySig = d.signature??1.0;
        const seduceChance = clamp(1.0 - (targetNoise * 2.0) / decoySig, 0.15, 1);
        if(Math.random() > seduceChance) continue;
      }

      torp.seducedBy=d;
      torp.seduceT=torp.seduceTime??cfg.seduceTime??7.0;
      torp.target=null;
      best=null;
      if(!torp.friendly){
        setMsg('CM SEDUCED TORPEDO!', 2.0);
        addLog('SONAR','Torpedo seduced — chasing countermeasure');
      } else {
        addLog('WEPS',`${torp.torpId} seduced — chasing decoy`);
      }
      break;
    }
  }

  return best;
}

// ── Search pattern — counter-CM hook + snake ────────────────────────────────
function searchPattern(torp, dt, cfg){
  const PI=Math.PI;
  const curAng=Math.atan2(torp.vy, torp.vx);

  // ── Circle/spiral datum search (ASROC-deployed torpedoes) ─────────────────
  if(torp._circleSearch){
    if(!torp._search){
      torp._search={circleDir:(Math.random()<0.5)?1:-1, phaseT:0};
    }
    const S=torp._search;
    S.phaseT+=dt;
    const maxTurn=(torp.turnRate??cfg.turnRate)*dt;
    const fraction=Math.max(0.12, 1.0 - S.phaseT/100);
    torp.targetBrg=curAng + S.circleDir * maxTurn * fraction;
    return;
  }
  const snakeAmp=cfg.searchSnake||0.18;
  const snakePeriod=4.0;

  if(!torp._search){
    const postCM=torp._postCM||false;
    torp._postCM=false;
    if(postCM){
      const side=(Math.random()<0.5)?1:-1;
      torp._search={
        phase:'break',
        side,
        baseAng:curAng,
        breakAng:curAng+side*(45*PI/180),
        hookAng:curAng+side*(45*PI/180) - side*(125*PI/180),
        phaseT:0,
        breakDur:2.5,
        hookDur:3.5,
        snakeT:0,
        snakeDir:1,
      };
    } else {
      torp._search={
        phase:'snake',
        baseAng:curAng,
        snakeT:0,
        snakeDir:(Math.random()<0.5)?1:-1,
      };
    }
  }

  const S=torp._search;
  S.phaseT=(S.phaseT||0)+dt;

  if(S.phase==='break'){
    torp.targetBrg=S.breakAng;
    if(S.phaseT>=S.breakDur){
      S.phase='hook';
      S.phaseT=0;
    }
  } else if(S.phase==='hook'){
    torp.targetBrg=S.hookAng;
    if(S.phaseT>=S.hookDur){
      S.phase='snake';
      S.baseAng=S.hookAng;
      S.snakeT=0;
      S.snakeDir=1;
      S.phaseT=0;
    }
  } else {
    S.snakeT=(S.snakeT||0)+dt;
    const cycle=S.snakeT/snakePeriod;
    const offset=Math.sin(cycle*PI*2)*snakeAmp;
    torp.targetBrg=S.baseAng+offset;
  }
}

// ── Main update ─────────────────────────────────────────────────────────────
function update(torp, dt){
  const cfg=C.torpedo;

  // ── 1. Advance traveled distance ─────────────────────────────────────────
  const spd=Math.hypot(torp.vx,torp.vy);
  torp.traveled=(torp.traveled||0)+spd*dt;
  torp.arming=Math.max(0,(torp.arming||0)-dt);
  const armed=torp.traveled>=(torp.enableDist||cfg.enableDist||300);

  // ── 2. Seeker ─────────────────────────────────────────────────────────────
  if(torp.seducedBy){
    torp.seduceT=(torp.seduceT||0)-dt;
    if(torp.seduceT<=0 || torp.seducedBy.life<=0){
      torp.seducedBy=null; torp.target=null;
      torp._reacquireCd=torp.reacquireDelay??cfg.reacquireDelay??3.0;
      torp._postCM=true;
      torp._search=null;
    }
  }

  if(torp._reacquireCd>0) torp._reacquireCd-=dt;

  if(torp._dazzleT>0){
    torp._dazzleT-=dt;
    if(torp._dazzleT<=0) torp._wasDazzled=false;
  }

  if(armed && !torp.seducedBy && (torp._reacquireCd||0)<=0 && (torp._dazzleT||0)<=0){
    const found=seekerScan(torp);
    if(found){
      if(found !== torp.target && torp.friendly){
        addLog('WEPS',`${torp.torpId} locked`);
      }
      torp.target=found;
    }
  }

  if(torp.target){
    const dead=torp.target.dead??false;
    const gone=torp.target!==player && !enemies.includes(torp.target);
    if(dead||gone) torp.target=null;
  }

  // ── 3. targetBrg — the single steering command ───────────────────────────
  if(torp.seducedBy){
    const dx=_AI.wrapDx(torp.x, torp.seducedBy.x);
    const dy=torp.seducedBy.y - torp.y;
    torp.targetBrg=Math.atan2(dy,dx);
  } else if(torp.target){
    const tx=torp.target.wx??torp.target.x;
    const ty=torp.target.wy??torp.target.y;
    let tvx=torp.target.vx??0, tvy=torp.target.vy??0;
    if(torp.target===player){
      tvx=Math.cos(player.heading)*player.speed;
      tvy=Math.sin(player.heading)*player.speed;
    }
    const dx=_AI.wrapDx(torp.x,tx), dy=ty-torp.y;
    const dist=Math.hypot(dx,dy);
    const tof=dist/Math.max(spd,1);
    const ex=tx+tvx*tof, ey=ty+tvy*tof;
    torp.targetBrg=Math.atan2(ey-torp.y, _AI.wrapDx(torp.x,ex));
    torp._search=null;
  } else if(armed && !(torp.wire?.live)){
    searchPattern(torp, dt, cfg);
  }

  // ── 4. Steering — turn toward targetBrg ──────────────────────────────────
  if(armed && torp.targetBrg != null){
    const cur=Math.atan2(torp.vy,torp.vx);
    let dAng=angleNorm(torp.targetBrg - cur);
    const maxTurn=(torp.turnRate??cfg.turnRate)*dt;
    dAng=clamp(dAng,-maxTurn,maxTurn);
    const newAng=cur+dAng;
    const s=Math.hypot(torp.vx,torp.vy);
    torp.vx=Math.cos(newAng)*s;
    torp.vy=Math.sin(newAng)*s;
  }
  if(!armed){
    const ang=Math.atan2(torp.vy,torp.vx);
    const s=Math.hypot(torp.vx,torp.vy);
    torp.vx=Math.cos(ang)*s; torp.vy=Math.sin(ang)*s;
  }

  // ── 5. Speed — approach while searching, sprint when homing ──────────────
  const targetSpd=(torp.target||torp.seducedBy)
    ? (torp.speed??cfg.speed)
    : (torp.approachSpeed??cfg.approachSpeed??15);
  const ns=lerp(spd, targetSpd, 0.06);
  const ang=Math.atan2(torp.vy,torp.vx);
  torp.vx=Math.cos(ang)*ns;
  torp.vy=Math.sin(ang)*ns;

  // ── 6. Depth steering ─────────────────────────────────────────────────────
  {
    const depthRate=cfg.depthRate||12;
    if(torp.target && !torp.seducedBy){
      torp.depthOrder=torp.target.depth??200;
    }
    const depthErr=(torp.depthOrder??torp.depth??200)-(torp.depth??0);
    const dv=clamp(depthErr*0.8,-depthRate,depthRate);
    torp.vDepth=lerp(torp.vDepth||0, dv, 0.15);
    torp.depth=clamp((torp.depth||0)+torp.vDepth*dt, 10, world.ground-20);
  }

  // ── 7. Position ───────────────────────────────────────────────────────────
  torp.x=torp.x+torp.vx*dt;
  torp.y=torp.y+torp.vy*dt;

  // ── 8. Collision ──────────────────────────────────────────────────────────
  const vertFuse=cfg.vertFuse||60;
  if(torp.life>0 && torp.arming<=0){
    if(torp.friendly){
      for(const e of enemies){
        if(e.dead) continue;
        const dz=Math.abs((torp.depth??0)-(e.depth??200));
        if(dz>vertFuse) continue;
        const dx=_AI.wrapDx(torp.x,e.x), dy=e.y-torp.y;
        if(Math.hypot(dx,dy)<(e.hitR||e.r||18)+torp.r){
          _damageEnemy?.(e,torp.dmg); torp._hit=true; torp.life=0; break;
        }
      }
    } else {
      const dz=Math.abs((torp.depth??0)-player.depth);
      if(dz<vertFuse){
        const dx=_AI.wrapDx(torp.x,player.wx), dy=player.wy-torp.y;
        if(Math.hypot(dx,dy)<(C.player.hitR??30)+torp.r){
          _damagePlayer?.(24, torp.x, torp.y); torp._hit=true; torp.life=0;
        }
      }
    }
  }
}

// ════════════════════════════════════════════════════════════════════════
// EXPORT (mirrors V1 window.TORP shape)
// ════════════════════════════════════════════════════════════════════════
export const TORP = { update };
