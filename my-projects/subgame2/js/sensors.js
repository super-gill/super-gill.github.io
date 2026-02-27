(() => {
  'use strict';
  const C=window.CONFIG; const {rand,clamp,now}=window.M;
  const {world,player,enemies,contacts}=window.G; const AI=window.AI;

  function setDetected(e,tDetect,tSeen=0){
    e.detectedT=Math.max(e.detectedT||0,tDetect);
    if(tSeen>0) e.seen=Math.max(e.seen||0,tSeen);
    e.lastX=e.x; e.lastY=(e.type==="boat"?(e.hitY??e.y):e.y); e.lastT=now();
  }

  function passiveUpdate(dt){
    player.passiveTick=(player.passiveTick||0)-dt;
    if(player.passiveTick>0) return;
    const quietBonus=1.2-player.noise*0.85;
    player.passiveTick=rand(0.55,1.05)/Math.max(0.25,quietBonus);

    for(const e of enemies){
      const ey=(e.type==="boat"?(e.hitY??e.y):e.y);
      const dx=AI.wrapDx(player.x,e.x);
      const dy=ey-player.y;
      const d=Math.hypot(dx,dy);
      const baseRange=1900;
      if(d>baseRange) continue;

      const layer=AI.layerPenalty(player.y,ey);
      let signal=e.noise*layer*(1-d/baseRange);
      if(e.type==="boat"){
        const shallow=clamp(1-((player.y-world.seaLevel)/520),0,1);
        signal*=(1+shallow*0.35);
        if(ey<world.layerY1 && player.y>world.layerY2) signal*=1.55;
      }

      const detect=signal-(player.noise*0.80);
      const p=clamp(0.06+detect*0.55+(e.type==="boat"?0.20:0.10),0,0.75);
      if(Math.random()<p){
        const bearing=Math.atan2(dy,dx);
        let baseU=70+d*0.08;
        if(e.type==="boat") baseU*=0.75;
        const u=baseU*(1+player.noise*1.2);
        contacts.push({
          x:(player.x+Math.cos(bearing)*Math.min(d,900)+rand(-u,u)+world.w)%world.w,
          y:clamp(player.y+Math.sin(bearing)*Math.min(d,900)+rand(-u,u),world.seaLevel+80,world.ground-80),
          u,life:1.6,bearing
        });
      }
    }
  }

  function proximityDetect(){
    for(const e of enemies){
      const ey=(e.type==="boat"?(e.hitY??e.y):e.y);
      const dx=AI.wrapDx(player.x,e.x);
      const dy=ey-player.y;
      const d=Math.hypot(dx,dy);
      if(d<C.detection.proximityR) setDetected(e,C.detection.detectT+1.0,C.detection.seenT);
    }
  }

  function activePing(){
    if(player.pingCd>0) return false;
    player.pingCd=C.player.pingCd;
    player.sonarPulse=C.player.pingPulse;
    player.noiseTransient=Math.min(1,player.noiseTransient+0.45);

    for(const e of enemies){
      const ey=(e.type==="boat"?(e.hitY??e.y):e.y);
      const dx=AI.wrapDx(player.x,e.x);
      const dy=ey-player.y;
      const d=Math.hypot(dx,dy);
      if(d<C.detection.pingDetectR) setDetected(e,C.detection.detectT,0);
    }
    return true;
  }

  window.SENSE={setDetected,passiveUpdate,proximityDetect,activePing};
})();
