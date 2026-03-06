(() => {
  'use strict';
  const C=window.CONFIG; const {rand,clamp,now}=window.M;
  const {world,player,enemies}=window.G;

  function inLayer(d){return d>=world.layerY1&&d<=world.layerY2;}
  function layerPenalty(d1,d2){const a=inLayer(d1),b=inLayer(d2); return (a!==b)?0.70:1.0;}
  function wrapDx(x1,x2){let dx=x2-x1; if(dx>world.w/2) dx-=world.w; if(dx<-world.w/2) dx+=world.w; return dx;}
  function wrapDy(y1,y2){let dy=y2-y1; if(dy>world.h/2) dy-=world.h; if(dy<-world.h/2) dy+=world.h; return dy;}

  function enemyHasFireSolution(e){
    if(!e.contact) return false;
    const age=now()-e.contact.t;
    if(age>C.enemy.fireMaxAge) return false;
    if(e.suspicion<C.enemy.fireMinSus) return false;
    if((e.contact.strength||0)<C.enemy.fireMinStrength) return false;
    return true;
  }

  function enemyUpdateContactFromPing(e,px,py,dist){
    const layer=layerPenalty(py,e.depth||400);
    const u=(160+dist*0.10)*(layer<1?1.55:1.0);
    e.contact={
      x:(px+rand(-u,u)+world.w)%world.w,
      y:(py+rand(-u,u)+world.h)%world.h,
      y:clamp(py+rand(-u,u),world.seaLevel+80,world.ground-80),
      u,t:now(),
      strength:clamp(0.50+(1-dist/2000)*0.40,0.30,0.92)
    };
    // Ping is a significant suspicion event — one ping can trigger investigate,
    // but alone won't push to engage without follow-up.
    e.suspicion=Math.min(1,e.suspicion+0.45*e.contact.strength);
  }

  function enemyMaybeHearPlayer(e,dt){
    const dx=wrapDx(e.x,player.wx);
    const dy=wrapDy(e.y,player.wy);
    const d=Math.hypot(dx,dy);
    const baseRange=(e.type==="boat")?C.enemy.hearBoatRange:C.enemy.hearSubRange;
    if(d>baseRange) return;
    const layer=layerPenalty(player.depth,e.depth||400);
    let signal=player.noise*layer*(1-d/baseRange);
    if(e.type==="boat" && (player.periscopeT||0)>0){ signal*=(C.player.periscope?.detectBoost||1.55); }
    if(signal<C.enemy.hearSignalMin) return;
    const p=clamp((signal-C.enemy.hearPBase)*C.enemy.hearPScale,0,0.40);
    if(Math.random()<p*dt){
      const layerMult=(layer<1)?1.45:1.0;
      const u=(260+d*0.14)*layerMult;
      e.contact={
        x:(player.wx+rand(-u,u)+world.w)%world.w,
        y:(player.wy+rand(-u,u)+world.h)%world.h,
        u,t:now(),
        strength:clamp(0.18+signal*0.62,0.18,0.72)
      };
      e.suspicion=Math.min(1,e.suspicion+0.14*e.contact.strength);
    }
  }

  function enemyDecay(e,dt){
    const quiet=(player.noise<C.enemy.quietNoiseThreshold);
    e.suspicion=Math.max(0,e.suspicion-(C.enemy.susDecayBase+(quiet?C.enemy.susDecayQuietExtra:0))*dt);
    if(e.contact){
      const age=now()-e.contact.t;
      if(age>C.enemy.contactMaxAge||(quiet&&age>C.enemy.contactMaxAgeQuiet)) e.contact=null;
    }
  }

  function spawnEnemy(){
    const type=(Math.random()<C.enemy.boatShare)?"boat":"sub";
    const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:rand(0.0,0.12),contact:null,
      fireCd:rand(3.0,6.0),cmCd:rand(2.2,5.5),
      navT:rand(C.enemy.subNavT[0],C.enemy.subNavT[1]),navX:0,navY:0,
      heading:rand(0,Math.PI*2),
      pingCd:rand(C.enemy.subPingCd[0],C.enemy.subPingCd[1]),pingPulse:0,
      evadeT:0,evadeFrom:null,evadeDecoy:null};
    // Spawn at random bearing and distance from player
    const minR=C.enemy.spawnMinR||2200, maxR=C.enemy.spawnMaxR||4200;
    const ang=rand(0,Math.PI*2);
    const dist=rand(minR,maxR);
    const ex=(player.wx+Math.cos(ang)*dist+world.w)%world.w;
    const ey=(player.wy+Math.sin(ang)*dist+world.h)%world.h;
    // Random heading toward general area of player
    const toPlayer=Math.atan2(player.wy-ey,player.wx-ex)+rand(-0.8,0.8);
    const spd=rand(12,28);
    if(type==="boat"){
      enemies.push({...common,type,x:ex,y:ey,depth:0,hitY:0,
        vx:Math.cos(toPlayer)*spd,vy:Math.sin(toPlayer)*spd,
        r:34,hp:80,sensitivity:rand(0.70,1.05),noise:1.0,
        flareCd:rand(2.2,4.5),cwis:{pKillPerSec:rand(0.55,0.9),range:rand(520,760)}});
    } else {
      const depth=rand(200,1100);
      enemies.push({...common,type,x:ex,y:ey,depth,
        vx:Math.cos(toPlayer)*spd,vy:Math.sin(toPlayer)*spd,
        r:30,hp:90,sensitivity:rand(0.55,0.90),noise:rand(0.45,0.7)});
    }
    const e=enemies[enemies.length-1]; e.navX=e.x; e.navY=e.y;
  }

  window.AI={wrapDx,wrapDy,layerPenalty,enemyHasFireSolution,enemyUpdateContactFromPing,enemyMaybeHearPlayer,enemyDecay,spawnEnemy};
})();
