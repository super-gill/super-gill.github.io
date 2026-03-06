(() => {
  'use strict';
  const C=window.CONFIG; const {rand,clamp,now}=window.M;
  const {world,player,enemies,contacts}=window.G; const AI=window.AI;
  let _ghostMap=null;
  function ghostMap(){ return _ghostMap||(_ghostMap=window.G.ghostContacts); }

  function setDetected(e,tDetect,tSeen=0){
    e.detectedT=Math.max(e.detectedT||0,tDetect);
    if(tSeen>0) e.seen=Math.max(e.seen||0,tSeen);
    e.lastX=e.x; e.lastY=e.y; e.lastT=now();
  }

  function passiveUpdate(dt){
    player.passiveTick=(player.passiveTick||0)-dt;
    if(player.passiveTick>0) return;
    const quietBonus=1.4-player.noise*1.0;
    player.passiveTick=rand(0.7,1.3)/Math.max(0.30,quietBonus);

    for(const e of enemies){
      const dx=AI.wrapDx(player.wx,e.x);
      const dy=AI.wrapDy(player.wy,e.y);
      const d=Math.hypot(dx,dy);
      const baseRange=1600;
      if(d>baseRange) continue;

      const layer=AI.layerPenalty(player.depth,e.depth||0);
      let signal=e.noise*layer*(1-d/baseRange);
      if(e.type==="boat") signal*=1.25; // surface ships louder
      const selfMask=player.noise*0.95;
      const detect=signal-selfMask;
      if(detect<=0) continue;

      const p=clamp(0.04+detect*0.45+(e.type==="boat"?0.12:0.06),0,0.55);
      if(Math.random()<p){
        const bearing=Math.atan2(dy,dx);
        const layerMult=(layer<1)?1.50:1.0;
        let baseU=90+d*0.12;
        if(e.type==="boat") baseU*=0.70;
        const u=baseU*layerMult*(1+player.noise*0.8);
        const cx2=(player.wx+Math.cos(bearing)*Math.min(d,1100)+rand(-u,u)+world.w)%world.w;
        const cy2=(player.wy+Math.sin(bearing)*Math.min(d,1100)+rand(-u,u)+world.h)%world.h;
        contacts.push({ x:cx2, y:cy2, u, life:2.2, bearing, kind:e.type });
        // Update ghost — persistent last-known position (keyed by enemy object ref)
        ghostMap().set(e,{x:cx2,y:cy2,u,t:performance.now()/1000,kind:e.type});
      }
    }
  }

  function proximityDetect(){
    for(const e of enemies){
      const dx=AI.wrapDx(player.wx,e.x);
      const dy=AI.wrapDy(player.wy,e.y);
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
      const dx=AI.wrapDx(player.wx,e.x);
      const dy=AI.wrapDy(player.wy,e.y);
      const d=Math.hypot(dx,dy);
      if(d<C.detection.pingDetectR) setDetected(e,C.detection.detectT,0);
    }
    return true;
  }

  window.SENSE={setDetected,passiveUpdate,proximityDetect,activePing};
})();
