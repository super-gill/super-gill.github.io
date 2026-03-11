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

    const runDepth=depthOrder??fromDepth; // depth torpedo will hold during run-out

    bullets.push({
      kind:"torpedo", x:fromX, y:fromY,
      depth:fromDepth, depthOrder:runDepth, vDepth:0,
      vx:(dirX/d)*sp, vy:(dirY/d)*sp, r:6,
      life: statOverrides?.life ?? C.torpedo.life, friendly,
      dmg: statOverrides?.dmg  ?? C.torpedo.dmg,
      torpId: window.G.nextTorpId(),
      seekRange:  statOverrides?.seekRange  ?? C.torpedo.seekRange,
      seekFOV:    statOverrides?.seekFOV    ?? C.torpedo.seekFOV,
      turnRate:   statOverrides?.turnRate   ?? C.torpedo.turnRate,
      speed:      statOverrides?.speed      ?? C.torpedo.speed,
      approachSpeed: statOverrides?.approachSpeed ?? C.torpedo.approachSpeed ?? 15,
      target:null, arming:C.torpedo.arming,
      enableDist, traveled:0, weaveT:rand(0,10),
      seducedBy:null, seduceT:0,
      wire: wireGuided ? {
        live:wireLive, prevAng:launchAng, fromX, fromY,
        cmdBrg: launchAng,  // hold launch bearing until TDC sends an update
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

  // Wire update — called each frame on live wired torpedoes.
  // The wire's only job: compute bearing from torpedo to estimated target position,
  // write it to torp.targetBrg. Torpedo.js does all the steering.
  // Does NOT steer when torpedo has a seeker lock — seeker owns targetBrg then.
  function wireUpdate(b, dt){
    if(!b.wire||!b.wire.live) return;
    const {world:w, player, sonarContacts}=window.G;

    // Range check — cut wire if torpedo is too far from sub
    let dx=b.x-player.wx; if(dx>w.w/2)dx-=w.w; if(dx<-w.w/2)dx+=w.w;
    let dy=b.y-player.wy;
    const wirePaidOut=Math.hypot(dx,dy);
    b.wire.paidOut=wirePaidOut;
    if(wirePaidOut>C.player.torpWireMaxRange){
      b.wire.live=false;
      COMMS.weapons.wireParted(null,'runout');
      window.G._onWireCut?.(b);
      return;
    }

    b.wire.prevAng=Math.atan2(b.vy,b.vx);

    // If seeker has a lock, wire yields — torpedo.js is already homing
    if(b.target || b.seducedBy) return;

    // Wire guidance — bearing-only steering, no position oscillation.
    //
    // Key insight: estimating a target position and position-homing to it causes
    // the torpedo to oscillate around the estimate when it overshoots. Instead:
    //
    // Phase 1 (torpedo short of estimated range): steer FROM TORPEDO toward estimated
    //   position — this corrects heading errors early in the run.
    // Phase 2 (torpedo at/past estimated range): fly the raw bearing forever.
    //   Phase 2 is a one-way latch — once set, never reverts to phase 1.
    //   This eliminates the turn-around bug where the torpedo gets commanded back
    //   toward a point it has already passed.
    const ref=b.wire.lockedTarget;
    if(ref){
      const sc=sonarContacts?.get(ref);
      const latestBrg=sc?.latestHullBrg ?? sc?.latestBrg;
      if(latestBrg!=null){
        const tmaQ=sc?.tmaQuality??0;
        const TMA=C.tma;

        // How far has the torpedo traveled from the player? (straight-line)
        let pdx=b.x-player.wx; if(pdx>w.w/2)pdx-=w.w; if(pdx<-w.w/2)pdx+=w.w;
        let pdy=b.y-player.wy; if(pdy>w.h/2)pdy-=w.h; if(pdy<-w.h/2)pdy+=w.h;
        const torpDistFromPlayer = Math.hypot(pdx, pdy);

        // Estimated target range (used only for phase switch)
        const estRange = Math.max(500, sc?._estRange ?? 3000);

        // One-way latch: once torpedo reaches 75% of estimated range, fly bearing forever
        if(!b.wire._bearingMode && torpDistFromPlayer >= estRange * 0.75){
          b.wire._bearingMode = true;
        }

        let rawTargetBrg;
        if(b.wire._bearingMode){
          // Phase 2: raw bearing direction — no position to overshoot
          rawTargetBrg = latestBrg;
          // Apply lead angle at SOLID quality
          if(tmaQ>=(TMA?.qualityThresholdSolid??0.70) && sc?._brgRate!=null){
            const estSpd = C.torpedo.speed ?? 50;
            const estTof = Math.max(100, estRange - torpDistFromPlayer) / estSpd;
            rawTargetBrg = latestBrg + (sc._brgRate) * estTof * 0.5;
          }
        } else {
          // Phase 1: steer toward estimated position to correct heading errors
          const estTX = player.wx + Math.cos(latestBrg)*estRange;
          const estTY = player.wy + Math.sin(latestBrg)*estRange;
          let tdx = estTX - b.x; if(tdx>w.w/2)tdx-=w.w; if(tdx<-w.w/2)tdx+=w.w;
          let tdy = estTY - b.y; if(tdy>w.h/2)tdy-=w.h; if(tdy<-w.h/2)tdy+=w.h;
          rawTargetBrg = Math.atan2(tdy, tdx);
        }

        // Smooth bearing so noisy sonar ticks don't jink the torpedo.
        // Use a 2s time constant — fast enough to respond, slow enough to filter noise.
        if(b.targetBrg == null){
          b.targetBrg = rawTargetBrg;
        } else {
          const diff = angleNorm(rawTargetBrg - b.targetBrg);
          const alpha = Math.min(1.0, dt / 2.0);
          b.targetBrg = b.targetBrg + diff * alpha;
        }
      }
    } else if(b.wire.cmdBrg!=null){
      // No designated target — fly launch bearing
      b.targetBrg = b.wire.cmdBrg;
    }

    // Sensor sweep — feed contacts back to player via wireContacts
    const wireRange=C.torpedo.seekRange*1.4;
    for(const e of enemies){
      if(e.dead) continue;
      let edx=AI.wrapDx(b.x,e.x);
      let edy=e.y-b.y;
      const dist=Math.hypot(edx,edy);
      if(dist>wireRange) continue;
      const u=60+dist*0.08;
      window.G.wireContacts.push({
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
    COMMS.weapons.wireParted(null,'manual');
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
    const spd=Math.hypot(torp.vx,torp.vy); // wu/s

    // Two distinct seeker modes:
    // PASSIVE SEARCH (no target): wide passive hydrophones, nearly omnidirectional.
    //   Self-noise degrades range — calibrated in wu/s (approachSpeed≈15, sprintSpeed≈28)
    //   At approach speed (15 wu/s): ~5% degradation — torpedo can hear well
    //   At sprint speed (28 wu/s): ~60% degradation — nearly deaf passively
    // ACTIVE HOMING (has target): narrow active sonar cone, full range, speed matters less.
    const activeHoming = !!torp.target;
    const fov = activeHoming
      ? (torp.seekFOV ?? C.torpedo.seekFOV)
      : (C.torpedo.passiveFOV ?? 2.4);
    const noiseDegr = activeHoming
      ? clamp((spd-22)/12, 0, 0.25)           // active: minor degradation above 22 wu/s
      : clamp((spd-16)/14, 0, 0.60);           // passive: 0 at 16wu/s, max 60% at 30wu/s
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
      const dx=AI.wrapDx(torp.x,c.x);
      const dy=c.y-torp.y;
      const dist=Math.hypot(dx,dy);
      if(dist>effectiveRange) continue;
      const angTo=Math.atan2(dy,dx);
      const dAng=Math.abs(angleNorm(angTo-aAng));
      if(dAng>fov) continue;
      // Passive mode: minimum signal threshold — very quiet contacts may not register
      if(!activeHoming && c.sig < 0.28) continue;
      const centered = 1-(dAng/fov);
      const close = 1-(dist/effectiveRange);
      const score = (c.sig*0.9+0.1)*(0.55+0.45*close)*(0.30+0.70*centered);
      if(score>bestScore){bestScore=score; best=c.ref;}
    }
    return best;
  }

  window.W={wrapX,makeExplosion,splash,deployDecoy,fireTorpedo,wireUpdate,cutWire,fireMissileVLS,dropDepthCharge,torpAcquire};
})();