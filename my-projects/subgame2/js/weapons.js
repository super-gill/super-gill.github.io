(() => {
  'use strict';
  const C=window.CONFIG; const {rand,clamp,lerp,now,angleNorm}=window.M;
  const {world,bullets,particles,decoys,cwisTracers,player,enemies}=window.G;
  const AI=window.AI;

  function wrapX(x){return (x+world.w)%world.w;}

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

  function deployDecoy(x,y,friendly=true,kind="noisemaker",opts={}){
    opts=opts||{};
    const d={
      kind,x,y,
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
  function fireTorpedo(fromX,fromY,dirX,dirY,friendly=true,enableDist=C.player.torpEnableDist,wireGuided=false,launchOffset=0,fromDepth=200,depthOrder=null){
    const sp=C.torpedo.speed;
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

    const runDepth=depthOrder??fromDepth; // depth torpedo will hold during run-out

    bullets.push({
      kind:"torpedo", x:fromX, y:fromY,
      depth:fromDepth, depthOrder:runDepth, vDepth:0,
      vx:(dirX/d)*sp, vy:(dirY/d)*sp, r:6,
      life:C.torpedo.life, friendly,
      dmg:C.torpedo.dmg,
      torpId: window.G.nextTorpId(),
      seekRange:C.torpedo.seekRange, seekFOV:C.torpedo.seekFOV, turnRate:C.torpedo.turnRate,
      target:null, arming:C.torpedo.arming,
      enableDist, traveled:0, weaveT:rand(0,10),
      seducedBy:null, seduceT:0,
      wire: wireGuided ? {
        live:wireLive, prevAng:launchAng, totalTurn:0, fromX, fromY,
      } : null,
    });

    // Launch transient — the flood-and-fire sequence is a loud acoustic event.
    // Nearby enemies hear it and get a bearing.
    if(typeof window._broadcastTransient === 'function'){
      const transRange=window.CONFIG.player.launchTransientRange||2000;
      const transSus=window.CONFIG.player.launchTransientSus||0.35;
      const tag=friendly?null:null; // enemy launch handled separately
      window._broadcastTransient(fromX, fromY, transRange, transSus, null);
    }
    return wireSnappedAtLaunch;
  }

  // Wire update — called each frame on live wired torpedoes
  function wireUpdate(b, dt){
    if(!b.wire||!b.wire.live) return;
    const {wireContacts,world:w}=window.G;

    // Range check — measure from SUB not launch point (sub moves)
    let dx=b.x-player.wx; if(dx>w.w/2)dx-=w.w; if(dx<-w.w/2)dx+=w.w;
    let dy=b.y-player.wy; if(dy>w.h/2)dy-=w.h; if(dy<-w.h/2)dy+=w.h;
    const wirePaidOut=Math.hypot(dx,dy);
    b.wire.paidOut=wirePaidOut;
    if(wirePaidOut>C.player.torpWireMaxRange){
      b.wire.live=false;
      window.G.setMsg('WIRE CUT: runout',0.8);
      window.G.addLog('WEPS','Wire parted — runout');
      window.G._onWireCut?.(b);
      return;
    }

    // Per-frame turn delta — accumulate after arming only
    const curAng=Math.atan2(b.vy,b.vx);
    const frameDelta=Math.abs(angleNorm(curAng-b.wire.prevAng));
    b.wire.prevAng=curAng;
    if(b.arming<=0){
      b.wire.totalTurn=(b.wire.totalTurn||0)+frameDelta;
      if(b.wire.totalTurn > (C.player.torpWireBreakTurnDeg||90)*Math.PI/180){
        b.wire.live=false;
        window.G.setMsg('WIRE CUT: manoeuvre',0.8);
        window.G.addLog('WEPS','Wire parted — manoeuvre limit');
        window.G._onWireCut?.(b);
        return;
      }
    }

    // Commanded bearing steering — if a cmdBrg has been set, steer torpedo toward it
    if(b.wire.cmdBrg != null){
      const desired = b.wire.cmdBrg;
      const cur = Math.atan2(b.vy, b.vx);
      let dAng = angleNorm(desired - cur);
      const maxTurn = b.turnRate * dt;
      dAng = clamp(dAng, -maxTurn, maxTurn);
      const newAng = cur + dAng;
      const speed = Math.hypot(b.vx, b.vy);
      b.vx = Math.cos(newAng) * speed;
      b.vy = Math.sin(newAng) * speed;
    }

    // Sensor sweep — feed back to player via wireContacts
    const wireRange=C.torpedo.seekRange*1.4;
    for(const e of enemies){
      let edx=AI.wrapDx(b.x,e.x);
      let edy=e.y-b.y;
      const dist=Math.hypot(edx,edy);
      if(dist>wireRange) continue;
      const u=60+dist*0.08;
      wireContacts.push({
        x:(e.x+rand(-u,u)+w.w)%w.w,
        y:(e.y+rand(-u,u)+w.h)%w.h,
        u, life:1.8, kind:e.type,
        fromTorp:{x:b.x,y:b.y}
      });
    }
  }

  // Manual wire cut — called from panel
  function cutWire(b){
    if(!b?.wire?.live) return;
    b.wire.live=false;
    window.G.setMsg('WIRE CUT: manual',0.8);
    window.G.addLog('WEPS','Wire cut — manual');
    window.G._onWireCut?.(b);
  }

  function fireMissileVLS(fromX,fromY,friendly=true){
    bullets.push({kind:"missile",x:fromX,y:fromY,vx:0,vy:-C.missile.speed,r:7,life:C.missile.life,friendly,dmg:C.missile.dmg,phase:"vertical",lock:null,tipDelay:C.missile.tipDelay,speed:C.missile.speed});
  }

  function dropDepthCharge(fromX,fromY,targetY){
    const ty=clamp(targetY,world.seaLevel+120,world.ground-80);
    bullets.push({kind:"depthCharge",x:fromX,y:fromY,vx:rand(-20,20),vy:90,r:8,life:5.0,friendly:false,targetY:ty,sink:rand(160,230),dmg:34,blastR:190});
  }

  function torpAcquire(torp){
    const aAng=Math.atan2(torp.vy,torp.vx);
    const vertW=C.torpedo.vertWindow||120;
    // Own-speed flow noise degrades seeker range (30kt+ starts masking returns)
    const speedKts=Math.hypot(torp.vx,torp.vy)*1.944; // wu/s to kt approx
    const noiseDegr=clamp((speedKts-20)/22,0,0.50);
    const effectiveRange=torp.seekRange*(1-noiseDegr);
    let best=null,bestScore=-1;
    const list=[];
    if(torp.friendly){
      // Seeker is autonomous — no parent-sub detectedT requirement
      for(const e of enemies){
        if(e.dead) continue;
        list.push({ref:e, x:e.x, y:e.y, depth:e.depth??200, sig:e.noise});
      }
      for(const d of decoys) if(!d.friendly&&d.kind==="noisemaker")
        list.push({ref:d, x:d.x, y:d.y, depth:torp.depth, sig:d.signature}); // decoys at torp depth
    } else {
      list.push({ref:player, x:player.wx, y:player.wy, depth:player.depth, sig:Math.max(0.35,player.noise)});
      for(const d of decoys) if(d.friendly&&d.kind==="noisemaker")
        list.push({ref:d, x:d.x, y:d.y, depth:torp.depth, sig:d.signature});
    }
    for(const c of list){
      if(Math.abs((c.depth??0)-(torp.depth??0))>vertW) continue;
      const dx=AI.wrapDx(torp.x,c.x);
      const dy=c.y-torp.y;
      const dist=Math.hypot(dx,dy);
      if(dist>effectiveRange) continue;
      const angTo=Math.atan2(dy,dx);
      const dAng=Math.abs(angleNorm(angTo-aAng));
      if(dAng>torp.seekFOV/2) continue;
      const centered=1-(dAng/(torp.seekFOV/2));
      const close=1-(dist/effectiveRange);
      const score=(c.sig*0.9+0.1)*(0.55+0.45*close)*(0.55+0.45*centered);
      if(score>bestScore){bestScore=score;best=c.ref;}
    }
    return best;
  }

  window.W={wrapX,makeExplosion,splash,deployDecoy,fireTorpedo,wireUpdate,cutWire,fireMissileVLS,dropDepthCharge,torpAcquire};
})();