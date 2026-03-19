'use strict';

import { CONFIG } from '../config/constants.js';
import { rand } from '../utils/math.js';
import { world, player, enemies } from '../state/sim-state.js';

const C = CONFIG;

// ── Spawn helpers ─────────────────────────────────────────────────────────────
export function spawnEnemy(){
  const type=(Math.random()<C.enemy.boatShare)?'boat':'sub';
  const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:rand(0.0,0.12),contact:null,
    playerBearings:[], tmaQuality:0, tmaX:null, tmaY:null,
    fireCd:rand(3.0,6.0),cmCd:rand(2.2,5.5),
    navT:rand(C.enemy.subNavT[0],C.enemy.subNavT[1]),navX:0,navY:0,
    heading:rand(0,Math.PI*2),
    pingCd:rand(C.enemy.subPingCd[0],C.enemy.subPingCd[1]),pingPulse:0,
    evadeT:0,evadeFrom:null,evadeDecoy:null};
  const minR=C.enemy.spawnMinR||2200, maxR=C.enemy.spawnMaxR||4200;
  const ang=rand(0,Math.PI*2);
  const dist=rand(minR,maxR);
  const ex=player.wx+Math.cos(ang)*dist;
  const ey=player.wy+Math.sin(ang)*dist;
  const toPlayer=Math.atan2(player.wy-ey,player.wx-ex)+rand(-0.8,0.8);
  const spd=rand(12,28);
  if(type==='boat'){
    const nf=0.75;
    enemies.push({...common,type,x:ex,y:ey,depth:0,hitY:0,
      vx:Math.cos(toPlayer)*spd,vy:Math.sin(toPlayer)*spd,
      r:34,hp:80,sensitivity:rand(0.70,1.05),_noiseFloor:nf,noise:nf,
      flareCd:rand(2.2,4.5),cwis:{pKillPerSec:rand(0.55,0.9),range:rand(520,760)},
      subClass:'KRIVAK'});
  } else {
    const depth=rand(200,450);
    const nf=rand(0.22,0.30);
    enemies.push({...common,type,x:ex,y:ey,depth,
      vx:Math.cos(toPlayer)*spd,vy:Math.sin(toPlayer)*spd,
      r:30,hp:90,sensitivity:rand(0.55,0.90),_noiseFloor:nf,noise:nf,
      subClass:'SIERRA'});
  }
  const e=enemies[enemies.length-1]; e.navX=e.x; e.navY=e.y;
}

// role: 'hunter' | 'pinger' | 'interceptor'
export function spawnSub(bearing, dist, role='hunter', offsetDist=0){
  const perpAng=bearing+Math.PI/2;
  const ex=player.wx+Math.cos(bearing)*dist+Math.cos(perpAng)*offsetDist;
  const ey=player.wy+Math.sin(bearing)*dist+Math.sin(perpAng)*offsetDist;
  const awayAng=bearing+Math.PI;
  const towardAng=bearing;
  const patrolHeading=role==='pinger'
    ? awayAng+rand(-0.3,0.3)+Math.PI/2
    : towardAng+rand(-0.52,0.52);
  const spd=role==='pinger'?rand(7,11):role==='interceptor'?rand(5,8):rand(4,6);
  const maxClassDepth = role==='pinger' ? 350 : 500;
  const depth=rand(200, maxClassDepth);
  const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:0,contact:null,
    playerBearings:[], tmaQuality:0, tmaX:null, tmaY:null,
    fireCd:rand(4.0,8.0),cmCd:rand(2.2,5.5),cmStock:6,
    navT:rand(C.enemy.subNavT[0],C.enemy.subNavT[1]),
    patrolHeading, heading:patrolHeading,
    pingCd: role==='pinger'?rand(8,14):rand(C.enemy.subPingCd[0],C.enemy.subPingCd[1]),
    pingPulse:0,
    evadeT:0,evadeFrom:null,evadeDecoy:null,
    tmaManeuverT:0, tmaManeuverDir:1, tmaPhase:'drift',
    role,
    interceptState:'waiting',
    interceptTargetX:null, interceptTargetY:null,
  };
  const nf = role==='pinger' ? rand(0.38,0.52)
            : role==='interceptor' ? rand(0.22,0.32)
            : rand(0.28,0.40);
  const sensitivity = role==='pinger' ? rand(0.50,0.72)
                    : role==='interceptor' ? rand(0.60,0.80)
                    : rand(0.55,0.75);
  const subClass = role==='pinger' ? 'VICTOR'
                 : role==='interceptor' ? 'ALFA'
                 : 'SIERRA';
  enemies.push({...common,type:'sub',x:ex,y:ey,depth,
    vx:Math.cos(patrolHeading)*spd,vy:Math.sin(patrolHeading)*spd,
    r:30,hitR:90,hp:90,hpMax:90,sensitivity,
    _noiseFloor:nf, noise:nf,
    torpTubes:Array(C.enemy.subTubes).fill(0),
    torpStock:C.enemy.subTorpStock,
    subClass,
  });
}

// ── SSBN spawn — Typhoon-class boomer ──────────────────────────────────────
export function spawnSSBN(bearing, dist){
  const ex=player.wx+Math.cos(bearing)*dist;
  const ey=player.wy+Math.sin(bearing)*dist;
  const patrolHeading=bearing+Math.PI+rand(-0.4,0.4);
  const spd=rand(3,5);
  const depth=rand(250,400);
  const nf=rand(0.22,0.30);
  const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:0,contact:null,
    playerBearings:[], tmaQuality:0, tmaX:null, tmaY:null,
    fireCd:rand(8.0,14.0),cmCd:rand(2.0,4.0),cmStock:10,
    navT:rand(200,400),
    patrolHeading, heading:patrolHeading,
    pingCd:9999,pingPulse:0,
    evadeT:0,evadeFrom:null,evadeDecoy:null,
    tmaManeuverT:0, tmaManeuverDir:1, tmaPhase:'drift',
    role:'ssbn',
    interceptState:'waiting',interceptTargetX:null,interceptTargetY:null,
  };
  enemies.push({...common,type:'sub',x:ex,y:ey,depth,
    vx:Math.cos(patrolHeading)*spd,vy:Math.sin(patrolHeading)*spd,
    r:48, hitR:140, hp:160, hpMax:160,
    sensitivity:rand(0.55,0.75),
    _noiseFloor:nf, noise:nf,
    torpTubes:Array(2).fill(0),
    torpStock:4,
    subClass:'TYPHOON',
  });
}

// ── Zeta-class SSN — boss-tier enemy ──────────────────────────────────────
export function spawnZeta(bearing, dist){
  const ex=player.wx+Math.cos(bearing)*dist;
  const ey=player.wy+Math.sin(bearing)*dist;
  const patrolHeading=bearing+Math.PI+rand(-0.3,0.3);
  const spd=rand(6,8);
  const depth=rand(250,500);
  const nf=rand(0.12,0.18);
  const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:0,contact:null,
    playerBearings:[], tmaQuality:0, tmaX:null, tmaY:null,
    fireCd:rand(4.0,7.0),cmCd:rand(1.8,3.5),cmStock:10,
    navT:rand(40,80),
    patrolHeading, heading:patrolHeading,
    pingCd:rand(C.enemy.subPingCd[0],C.enemy.subPingCd[1]),pingPulse:0,
    evadeT:0,evadeFrom:null,evadeDecoy:null,
    tmaManeuverT:0, tmaManeuverDir:1, tmaPhase:'drift',
    role:'zeta',
    interceptState:'waiting',interceptTargetX:null,interceptTargetY:null,
    tacticalPing:true,
    tacticalPingTmaThresh:0.25,
    tacticalPingSusThresh:0.12,
    tacticalPingStuckTime:20,
    tacticalPingCd:[35,55],
    bearingOnlyEnabled:true,
    bearingOnlySusThresh:0.30,
    bearingOnlyCdTime:50,
  };
  enemies.push({...common,type:'sub',x:ex,y:ey,depth,
    vx:Math.cos(patrolHeading)*spd,vy:Math.sin(patrolHeading)*spd,
    r:32, hitR:95, hp:130, hpMax:130,
    sensitivity:rand(0.72,0.88),
    _noiseFloor:nf, noise:nf,
    torpTubes:Array(4).fill(0),
    torpStock:10,
    subClass:'AKULA',
  });
}

// ── Gamma-class SSK — old diesel-electric ──────────────────────────────────
export function spawnGamma(bearing, dist, offsetDist=0){
  const perpAng=bearing+Math.PI/2;
  const ex=player.wx+Math.cos(bearing)*dist+Math.cos(perpAng)*offsetDist;
  const ey=player.wy+Math.sin(bearing)*dist+Math.sin(perpAng)*offsetDist;
  const patrolHeading=bearing+Math.PI+rand(-0.5,0.5);
  const spd=rand(3,5);
  const depth=rand(80,250);
  const nf=rand(0.04,0.06);
  const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:0,contact:null,
    playerBearings:[], tmaQuality:0, tmaX:null, tmaY:null,
    fireCd:rand(5.0,10.0),cmCd:rand(3.0,6.0),cmStock:4,
    navT:rand(150,350),
    patrolHeading, heading:patrolHeading,
    pingCd:9999,pingPulse:0,
    evadeT:0,evadeFrom:null,evadeDecoy:null,
    tmaManeuverT:0, tmaManeuverDir:1, tmaPhase:'drift',
    role:'hunter',
    interceptState:'waiting',interceptTargetX:null,interceptTargetY:null,
  };
  enemies.push({...common,type:'sub',x:ex,y:ey,depth,
    vx:Math.cos(patrolHeading)*spd,vy:Math.sin(patrolHeading)*spd,
    r:24, hitR:72, hp:60, hpMax:60,
    sensitivity:rand(0.45,0.65),
    _noiseFloor:nf, noise:nf,
    torpTubes:Array(4).fill(0),
    torpStock:8,
    subClass:'FOXTROT',
  });
}

// ── Eta-class SSK — modern diesel-electric / AIP ──────────────────────────
export function spawnEta(bearing, dist, offsetDist=0){
  const perpAng=bearing+Math.PI/2;
  const ex=player.wx+Math.cos(bearing)*dist+Math.cos(perpAng)*offsetDist;
  const ey=player.wy+Math.sin(bearing)*dist+Math.sin(perpAng)*offsetDist;
  const patrolHeading=bearing+Math.PI+rand(-0.5,0.5);
  const spd=rand(3,5);
  const depth=rand(100,300);
  const nf=rand(0.03,0.06);
  const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:0,contact:null,
    playerBearings:[], tmaQuality:0, tmaX:null, tmaY:null,
    fireCd:rand(4.0,8.0),cmCd:rand(2.5,5.0),cmStock:6,
    navT:rand(120,280),
    patrolHeading, heading:patrolHeading,
    pingCd:9999,pingPulse:0,
    evadeT:0,evadeFrom:null,evadeDecoy:null,
    tmaManeuverT:0, tmaManeuverDir:1, tmaPhase:'drift',
    role:'hunter',
    interceptState:'waiting',interceptTargetX:null,interceptTargetY:null,
  };
  enemies.push({...common,type:'sub',x:ex,y:ey,depth,
    vx:Math.cos(patrolHeading)*spd,vy:Math.sin(patrolHeading)*spd,
    r:26, hitR:78, hp:70, hpMax:70,
    sensitivity:rand(0.70,0.90),
    _noiseFloor:nf, noise:nf,
    torpTubes:Array(4).fill(0),
    torpStock:10,
    subClass:'KILO',
  });
}

// ── Epsilon-class SSBN — newer ballistic missile submarine ────────────────
export function spawnEpsilon(bearing, dist){
  const ex=player.wx+Math.cos(bearing)*dist;
  const ey=player.wy+Math.sin(bearing)*dist;
  const patrolHeading=bearing+Math.PI+rand(-0.4,0.4);
  const spd=rand(3,5);
  const depth=rand(250,450);
  const nf=rand(0.18,0.26);
  const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:0,contact:null,
    playerBearings:[], tmaQuality:0, tmaX:null, tmaY:null,
    fireCd:rand(8.0,14.0),cmCd:rand(2.0,4.0),cmStock:8,
    navT:rand(200,400),
    patrolHeading, heading:patrolHeading,
    pingCd:9999,pingPulse:0,
    evadeT:0,evadeFrom:null,evadeDecoy:null,
    tmaManeuverT:0, tmaManeuverDir:1, tmaPhase:'drift',
    role:'ssbn',
    interceptState:'waiting',interceptTargetX:null,interceptTargetY:null,
  };
  enemies.push({...common,type:'sub',x:ex,y:ey,depth,
    vx:Math.cos(patrolHeading)*spd,vy:Math.sin(patrolHeading)*spd,
    r:42, hitR:120, hp:140, hpMax:140,
    sensitivity:rand(0.60,0.78),
    _noiseFloor:nf, noise:nf,
    torpTubes:Array(2).fill(0),
    torpStock:4,
    subClass:'DELTA',
  });
}

// ── Theta-class SSGN — guided missile submarine ───────────────────────────
export function spawnTheta(bearing, dist, offsetDist=0){
  const perpAng=bearing+Math.PI/2;
  const ex=player.wx+Math.cos(bearing)*dist+Math.cos(perpAng)*offsetDist;
  const ey=player.wy+Math.sin(bearing)*dist+Math.sin(perpAng)*offsetDist;
  const patrolHeading=bearing+Math.PI+rand(-0.4,0.4);
  const spd=rand(5,8);
  const depth=rand(200,500);
  const nf=rand(0.32,0.48);
  const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:0,contact:null,
    playerBearings:[], tmaQuality:0, tmaX:null, tmaY:null,
    fireCd:rand(4.0,8.0),cmCd:rand(2.0,4.0),cmStock:8,
    navT:rand(100,220),
    patrolHeading, heading:patrolHeading,
    pingCd:rand(C.enemy.subPingCd[0],C.enemy.subPingCd[1]),pingPulse:0,
    evadeT:0,evadeFrom:null,evadeDecoy:null,
    tmaManeuverT:0, tmaManeuverDir:1, tmaPhase:'drift',
    role:'hunter',
    interceptState:'waiting',interceptTargetX:null,interceptTargetY:null,
  };
  enemies.push({...common,type:'sub',x:ex,y:ey,depth,
    vx:Math.cos(patrolHeading)*spd,vy:Math.sin(patrolHeading)*spd,
    r:44, hitR:130, hp:140, hpMax:140,
    sensitivity:rand(0.55,0.72),
    _noiseFloor:nf, noise:nf,
    torpTubes:Array(4).fill(0),
    torpStock:8,
    subClass:'OSCAR',
  });
}

// ── November-class SSN (Project 627) — first Soviet nuclear submarine ───────
export function spawnNovember(bearing, dist, offsetDist=0){
  const perpAng=bearing+Math.PI/2;
  const ex=player.wx+Math.cos(bearing)*dist+Math.cos(perpAng)*offsetDist;
  const ey=player.wy+Math.sin(bearing)*dist+Math.sin(perpAng)*offsetDist;
  const patrolHeading=bearing+Math.PI+rand(-0.4,0.4);
  const spd=rand(5,9);
  const depth=rand(150,350);
  const nf=rand(0.55,0.70);
  const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:0,contact:null,
    playerBearings:[],tmaQuality:0,tmaX:null,tmaY:null,
    fireCd:rand(5.0,10.0),cmCd:rand(3.0,6.0),cmStock:4,
    navT:rand(C.enemy.subNavT[0],C.enemy.subNavT[1]),
    patrolHeading,heading:patrolHeading,
    pingCd:rand(8,16),pingPulse:0,
    evadeT:0,evadeFrom:null,evadeDecoy:null,
    tmaManeuverT:0,tmaManeuverDir:1,tmaPhase:'drift',
    role:'hunter',
    interceptState:'waiting',interceptTargetX:null,interceptTargetY:null,
  };
  enemies.push({...common,type:'sub',x:ex,y:ey,depth,
    vx:Math.cos(patrolHeading)*spd,vy:Math.sin(patrolHeading)*spd,
    r:28,hitR:84,hp:70,hpMax:70,
    sensitivity:rand(0.40,0.55),
    _noiseFloor:nf,noise:nf,
    torpTubes:Array(2).fill(0),
    torpStock:4,
    subClass:'NOVEMBER',
  });
}

// ── Whiskey-class SSK (Project 613) — early Cold War diesel workhorse ────────
export function spawnWhiskey(bearing, dist, offsetDist=0){
  const perpAng=bearing+Math.PI/2;
  const ex=player.wx+Math.cos(bearing)*dist+Math.cos(perpAng)*offsetDist;
  const ey=player.wy+Math.sin(bearing)*dist+Math.sin(perpAng)*offsetDist;
  const patrolHeading=bearing+Math.PI+rand(-0.5,0.5);
  const spd=rand(2,4);
  const depth=rand(50,180);
  const nf=rand(0.03,0.05);
  const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:0,contact:null,
    playerBearings:[],tmaQuality:0,tmaX:null,tmaY:null,
    fireCd:rand(6.0,12.0),cmCd:rand(3.5,7.0),cmStock:3,
    navT:rand(C.enemy.subNavT[0],C.enemy.subNavT[1]),
    patrolHeading,heading:patrolHeading,
    pingCd:9999,pingPulse:0,
    evadeT:0,evadeFrom:null,evadeDecoy:null,
    tmaManeuverT:0,tmaManeuverDir:1,tmaPhase:'drift',
    role:'hunter',
    interceptState:'waiting',interceptTargetX:null,interceptTargetY:null,
  };
  enemies.push({...common,type:'sub',x:ex,y:ey,depth,
    vx:Math.cos(patrolHeading)*spd,vy:Math.sin(patrolHeading)*spd,
    r:20,hitR:60,hp:45,hpMax:45,
    sensitivity:rand(0.35,0.55),
    _noiseFloor:nf,noise:nf,
    torpTubes:Array(2).fill(0),
    torpStock:8,
    subClass:'WHISKEY',
  });
}

// ── Yankee-class SSBN (Project 667A) — early Soviet SSBN ─────────────────────
export function spawnYankee(bearing, dist){
  const ex=player.wx+Math.cos(bearing)*dist;
  const ey=player.wy+Math.sin(bearing)*dist;
  const patrolHeading=bearing+Math.PI+rand(-0.4,0.4);
  const spd=rand(3,5);
  const depth=rand(200,380);
  const nf=rand(0.28,0.38);
  const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:0,contact:null,
    playerBearings:[],tmaQuality:0,tmaX:null,tmaY:null,
    fireCd:rand(8.0,14.0),cmCd:rand(2.0,4.0),cmStock:6,
    navT:rand(200,400),
    patrolHeading,heading:patrolHeading,
    pingCd:9999,pingPulse:0,
    evadeT:0,evadeFrom:null,evadeDecoy:null,
    tmaManeuverT:0,tmaManeuverDir:1,tmaPhase:'drift',
    role:'ssbn',
    interceptState:'waiting',interceptTargetX:null,interceptTargetY:null,
  };
  enemies.push({...common,type:'sub',x:ex,y:ey,depth,
    vx:Math.cos(patrolHeading)*spd,vy:Math.sin(patrolHeading)*spd,
    r:38,hitR:110,hp:120,hpMax:120,
    sensitivity:rand(0.55,0.72),
    _noiseFloor:nf,noise:nf,
    torpTubes:Array(2).fill(0),
    torpStock:4,
    subClass:'YANKEE',
  });
}

// ── Papa-class SSGN (Project 661, K-222) — fastest submarine ever built ──────
export function spawnPapa(bearing, dist){
  const ex=player.wx+Math.cos(bearing)*dist;
  const ey=player.wy+Math.sin(bearing)*dist;
  const patrolHeading=bearing+Math.PI+rand(-0.3,0.3);
  const spd=rand(20,30);
  const depth=rand(200,500);
  const nf=rand(0.65,0.80);
  const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:0,contact:null,
    playerBearings:[],tmaQuality:0,tmaX:null,tmaY:null,
    fireCd:rand(4.0,8.0),cmCd:rand(2.0,4.0),cmStock:8,
    navT:rand(60,140),
    patrolHeading,heading:patrolHeading,
    pingCd:rand(C.enemy.subPingCd[0],C.enemy.subPingCd[1]),pingPulse:0,
    evadeT:0,evadeFrom:null,evadeDecoy:null,
    tmaManeuverT:0,tmaManeuverDir:1,tmaPhase:'drift',
    role:'hunter',
    interceptState:'waiting',interceptTargetX:null,interceptTargetY:null,
  };
  enemies.push({...common,type:'sub',x:ex,y:ey,depth,
    vx:Math.cos(patrolHeading)*spd,vy:Math.sin(patrolHeading)*spd,
    r:44,hitR:130,hp:130,hpMax:130,
    sensitivity:rand(0.55,0.70),
    _noiseFloor:nf,noise:nf,
    torpTubes:Array(4).fill(0),
    torpStock:8,
    subClass:'PAPA',
  });
}

// ── Golf-class SSB (Project 629) — diesel ballistic missile submarine ────────
export function spawnGolf(bearing, dist){
  const ex=player.wx+Math.cos(bearing)*dist;
  const ey=player.wy+Math.sin(bearing)*dist;
  const patrolHeading=bearing+Math.PI+rand(-0.4,0.4);
  const spd=rand(2,4);
  const depth=rand(80,200);
  const nf=rand(0.03,0.06);
  const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:0,contact:null,
    playerBearings:[],tmaQuality:0,tmaX:null,tmaY:null,
    fireCd:rand(8.0,14.0),cmCd:rand(2.0,4.0),cmStock:4,
    navT:rand(200,400),
    patrolHeading,heading:patrolHeading,
    pingCd:9999,pingPulse:0,
    evadeT:0,evadeFrom:null,evadeDecoy:null,
    tmaManeuverT:0,tmaManeuverDir:1,tmaPhase:'drift',
    role:'ssbn',
    interceptState:'waiting',interceptTargetX:null,interceptTargetY:null,
    _snorkeling:false,
    _snorkelCd:rand(120,180),
  };
  enemies.push({...common,type:'sub',x:ex,y:ey,depth,
    vx:Math.cos(patrolHeading)*spd,vy:Math.sin(patrolHeading)*spd,
    r:30,hitR:90,hp:80,hpMax:80,
    sensitivity:rand(0.40,0.60),
    _noiseFloor:nf,noise:nf,
    torpTubes:Array(2).fill(0),
    torpStock:4,
    subClass:'GOLF',
  });
}

// ── Surface warship spawns ────────────────────────────────────────────────
export function _spawnWarship(bearing, dist, stats, offsetDist=0){
  const perpAng=bearing+Math.PI/2;
  const ex=player.wx+Math.cos(bearing)*dist+Math.cos(perpAng)*offsetDist;
  const ey=player.wy+Math.sin(bearing)*dist+Math.sin(perpAng)*offsetDist;
  const patrolHeading=bearing+Math.PI+rand(-0.6,0.6);
  const spd=stats.patrolSpd||rand(10,14);
  const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,
    suspicion:rand(0.0,0.08),contact:null,
    playerBearings:[], tmaQuality:0, tmaX:null, tmaY:null,
    fireCd:rand(3.0,6.0),cmCd:rand(2.0,4.5),
    navT:rand(60,180),navX:0,navY:0,
    heading:patrolHeading,
    pingCd:stats.pingCd??rand(8,16),pingPulse:0,
    evadeT:0,evadeFrom:null,evadeDecoy:null,
  };
  const ent={...common,type:'boat',x:ex,y:ey,depth:0,hitY:0,
    vx:Math.cos(patrolHeading)*spd,vy:Math.sin(patrolHeading)*spd,
    r:stats.r, hp:stats.hp,
    sensitivity:stats.sensitivity,
    _noiseFloor:stats.nf, noise:stats.nf,
    flareCd:rand(2.0,4.5),
    cwis:stats.cwis||{pKillPerSec:rand(0.55,0.85),range:rand(520,720)},
    subClass:stats.subClass,
    role:stats.role||null,
  };
  if(stats.vdsDepth) ent.vdsDepth=stats.vdsDepth;
  if(stats.sonobuoys) ent._sonobuoyCfg=stats.sonobuoys;
  if(stats.helo) ent._heloCfg=stats.helo;
  if(stats.turnRate) ent._turnRate=stats.turnRate;
  if(stats.hasAsroc) ent._hasAsroc=true;
  ent._torpStock = C.enemy.boatTorpStock ?? 6;
  enemies.push(ent);
}

export function spawnIota(bearing, dist, offsetDist=0){
  _spawnWarship(bearing, dist, {
    r:30, hp:80,
    sensitivity:rand(0.62,0.80),
    nf:rand(0.60,0.75),
    patrolSpd:rand(10,16),
    pingCd:rand(6,12),
    cwis:{pKillPerSec:rand(0.50,0.80),range:rand(480,680)},
    subClass:'KRIVAK',
    role:'pinger',
    turnRate:rand(0.055,0.075),
    vdsDepth:rand(300,380),
    sonobuoys:{interval:[45,75], maxActive:4, buoyLife:120, buoyDepth:rand(280,350), pingCd:[8,14]},
    helo:{dipDepth:rand(300,360), fuel:rand(100,140), refuel:rand(60,90), launchSus:0.15, hasTorp:true, torpStock:2},
    hasAsroc:true,
  }, offsetDist);
}

export function spawnKappa(bearing, dist, offsetDist=0){
  _spawnWarship(bearing, dist, {
    r:36, hp:100,
    sensitivity:rand(0.68,0.84),
    nf:rand(0.65,0.80),
    patrolSpd:rand(14,20),
    pingCd:rand(8,14),
    cwis:{pKillPerSec:rand(0.65,0.95),range:rand(580,800)},
    subClass:'UDALOY',
    role:'pinger',
    turnRate:rand(0.040,0.060),
    vdsDepth:rand(280,340),
    hasAsroc:true,
  }, offsetDist);
}

export function spawnLambda(bearing, dist, offsetDist=0){
  _spawnWarship(bearing, dist, {
    r:24, hp:50,
    sensitivity:rand(0.44,0.66),
    nf:rand(0.55,0.70),
    patrolSpd:rand(8,14),
    pingCd:rand(10,20),
    cwis:{pKillPerSec:rand(0.40,0.65),range:rand(400,600)},
    subClass:'GRISHA',
    role:'pinger',
    turnRate:rand(0.090,0.120),
  }, offsetDist);
}

export function spawnMu(bearing, dist, offsetDist=0){
  _spawnWarship(bearing, dist, {
    r:42, hp:140,
    sensitivity:rand(0.32,0.52),
    nf:rand(0.70,0.85),
    patrolSpd:rand(12,18),
    pingCd:rand(14,26),
    cwis:{pKillPerSec:rand(0.70,0.95),range:rand(600,850)},
    subClass:'SLAVA',
    role:null,
    turnRate:rand(0.025,0.040),
  }, offsetDist);
}

// ── Civilian ship spawns ──────────────────────────────────────────────────
export function spawnCivilian(civType){
  const w=world.w, h=world.h;
  const edge=Math.floor(Math.random()*4);
  let ex,ey,heading;
  if(edge===0){      ex=rand(0,w); ey=0;       heading=rand(Math.PI*0.15,Math.PI*0.85); }
  else if(edge===1){ ex=w;         ey=rand(0,h); heading=rand(Math.PI*0.65,Math.PI*1.35); }
  else if(edge===2){ ex=rand(0,w); ey=h;       heading=rand(-Math.PI*0.85,-Math.PI*0.15); }
  else{              ex=0;         ey=rand(0,h); heading=rand(-Math.PI*0.35,Math.PI*0.35); }

  const stats={
    TANKER:  {r:50,hp:200,nf:rand(0.80,0.95),spd:rand(6,10)},
    CARGO:   {r:40,hp:160,nf:rand(0.60,0.80),spd:rand(8,13)},
    FISHING: {r:18,hp:40, nf:rand(0.40,0.60),spd:rand(3,6)},
    FERRY:   {r:35,hp:120,nf:rand(0.55,0.75),spd:rand(12,18)},
  }[civType]||{r:35,hp:100,nf:0.65,spd:10};

  enemies.push({
    type:'boat', civilian:true, civType,
    x:ex, y:ey, depth:0, hitY:0,
    vx:Math.cos(heading)*stats.spd, vy:Math.sin(heading)*stats.spd,
    r:stats.r, hp:stats.hp,
    heading, patrolHeading:heading,
    _noiseFloor:stats.nf, noise:stats.nf,
    navT:rand(120,400),
    sensitivity:0,
    seen:0, detectedT:0, lastX:0, lastY:0, lastT:0,
    suspicion:0, contact:null,
  });
}
