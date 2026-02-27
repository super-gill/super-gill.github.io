(() => {
  'use strict';
  const C=window.CONFIG; const {rand,clamp,now}=window.M;
  const {world,player,enemies}=window.G;

  function inLayer(y){return y>=world.layerY1&&y<=world.layerY2;}
  function layerPenalty(y1,y2){const a=inLayer(y1),b=inLayer(y2); return (a!==b)?0.70:1.0;}
  function wrapDx(x1,x2){let dx=x2-x1; if(dx>world.w/2) dx-=world.w; if(dx<-world.w/2) dx+=world.w; return dx;}

  function enemyHasFireSolution(e){
    if(!e.contact) return false;
    const age=now()-e.contact.t;
    if(age>C.enemy.fireMaxAge) return false;
    if(e.suspicion<C.enemy.fireMinSus) return false;
    if((e.contact.strength||0)<C.enemy.fireMinStrength) return false;
    return true;
  }

  function enemyUpdateContactFromPing(e,px,py,dist){
    const layer=layerPenalty(py,e.y);
    const u=(120+dist*0.09)*(layer<1?1.25:1.0);
    e.contact={x:(px+rand(-u,u)+world.w)%world.w,y:clamp(py+rand(-u,u),world.seaLevel+80,world.ground-80),u,t:now(),strength:clamp(0.55+(1-dist/1850)*0.45,0.25,1.0)};
    e.suspicion=Math.min(1,e.suspicion+0.70*e.contact.strength);
  }

  function enemyMaybeHearPlayer(e,dt){
    const dx=wrapDx(e.x,player.x);
    const dy=player.y-e.y;
    const d=Math.hypot(dx,dy);
    const baseRange=(e.type==="boat")?C.enemy.hearBoatRange:C.enemy.hearSubRange;
    if(d>baseRange) return;
    const layer=layerPenalty(player.y,e.y);
    let signal=player.noise*layer*(1-d/baseRange);
    // Periscope up makes surface ships more likely to localise you
    if(e.type==="boat" && (player.periscopeT||0) > 0){ signal *= (C.player.periscope?.detectBoost || 1.55); }
    if(signal<C.enemy.hearSignalMin) return;
    const p=clamp((signal-C.enemy.hearPBase)*C.enemy.hearPScale,0,1.0);
    if(Math.random()<p*dt){
      const u=(200+d*0.12)*(layer<1?1.25:1.0);
      e.contact={x:(player.x+rand(-u,u)+world.w)%world.w,y:clamp(player.y+rand(-u,u),world.seaLevel+80,world.ground-80),u,t:now(),strength:clamp(0.28+signal*0.82,0.25,0.95)};
      e.suspicion=Math.min(1,e.suspicion+0.30*e.contact.strength);
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
    const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:rand(0.0,0.12),contact:null,fireCd:rand(3.0,6.0),cmCd:rand(2.2,5.5),
      navT:rand(C.enemy.subNavT[0],C.enemy.subNavT[1]),navX:0,navY:0,heading:Math.PI,
      pingCd:rand(C.enemy.subPingCd[0],C.enemy.subPingCd[1]),pingPulse:0,evadeT:0,evadeFrom:null,evadeDecoy:null};
    if(type==="boat"){
      enemies.push({...common,type,x:rand(player.x+1400,player.x+3300)%world.w,y:world.seaLevel-rand(6,18),hitY:world.seaLevel+14,vx:rand(-26,-12),vy:0,r:34,hp:80,sensitivity:rand(0.70,1.05),noise:1.0,flareCd:rand(2.2,4.5),cwis:{pKillPerSec:rand(0.55,0.9),range:rand(520,760)}});
    } else {
      enemies.push({...common,type,x:rand(player.x+1600,player.x+3600)%world.w,y:rand(world.seaLevel+200,world.seaLevel+1100),vx:rand(-30,-12),vy:rand(-6,6),r:30,hp:90,sensitivity:rand(0.55,0.90),noise:rand(0.45,0.7)});
    }
    const e=enemies[enemies.length-1]; e.navX=e.x; e.navY=e.y;
  }

  window.AI={wrapDx,layerPenalty,enemyHasFireSolution,enemyUpdateContactFromPing,enemyMaybeHearPlayer,enemyDecay,spawnEnemy};
})();
