(() => {
  'use strict';
  const C=window.CONFIG; const {rand,clamp,lerp,now,angleNorm}=window.M;
  const {world,bullets,particles,decoys,cwisTracers,player,enemies}=window.G;
  const AI=window.AI;

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
      target:null, arming: statOverrides?.arming ?? C.torpedo.arming,
      enableDist, traveled:0, weaveT:rand(0,10),
      seducedBy:null, seduceT:0,
      // Per-vessel seeker behaviour — torpedo.js reads these before falling back to C.torpedo
      passiveFOV:   statOverrides?.passiveFOV   ?? C.torpedo.passiveFOV,
      seduceFOV:    statOverrides?.seduceFOV    ?? C.torpedo.seduceFOV,
      seduceRange:  statOverrides?.seduceRange  ?? C.torpedo.seduceRange,
      seduceTime:   statOverrides?.seduceTime   ?? C.torpedo.seduceTime,
      reacquireDelay: statOverrides?.reacquireDelay ?? C.torpedo.reacquireDelay,
      _circleSearch: statOverrides?.circleSearch ?? false,
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
    const DMG=window.DMG;

    // Fire control damage — wire degradation or immediate severance
    if(DMG){
      const fx=DMG.getEffects();
      if(fx.wireCutAll){
        b.wire.live=false;
        COMMS.weapons.wireParted(null,'fire_ctrl');
        window.G._onWireCut?.(b);
        return;
      }
      // Throttle bearing updates when fire_ctrl degraded
      if(fx.wireUpdateRate<1.0){
        b.wire._updateAcc=(b.wire._updateAcc||0)+dt;
        const interval=1.0/(fx.wireUpdateRate*10); // 0.5 rate → skip every other 100ms
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
      COMMS.weapons.wireParted(null,'runout');
      window.G._onWireCut?.(b);
      return;
    }

    b.wire.prevAng=Math.atan2(b.vy,b.vx);

    // If seeker has a lock, wire yields — torpedo.js is already homing
    if(b.target || b.seducedBy) return;

    // Wire guidance — beam-rider approach.
    //
    // The submarine's fire control computes a bearing to the target. The wire
    // steers the torpedo onto that bearing LINE and keeps it there. The torpedo
    // doesn't chase a position — it rides the beam. This avoids oscillation
    // from range estimation errors: range only affects where on the line the
    // target is, not the line itself.
    //
    // Cross-track error: how far the torpedo is from the bearing line.
    // Correction: proportional steering clamped to ±15° to prevent wild turns.
    // Lead angle: at SOLID quality, the bearing line itself is adjusted for
    // target motion (bearing rate × estimated time of flight).
    //
    // Manual override — when autoTDC is off, use player's cmdBrg instead of sonar lock
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

        // Bearing line from player to target — this is the "beam"
        let beamBrg = latestBrg;

        // Lead angle at SOLID quality — shift the beam ahead of the target
        if(tmaQ>=(TMA?.qualityThresholdSolid??0.70) && sc?._brgRate!=null){
          // Estimate time for torpedo to reach target area
          let pdx=b.x-player.wx;
          let pdy=b.y-player.wy;
          const torpDist=Math.hypot(pdx,pdy);
          const estRange=Math.max(500, sc?._estRange??3000);
          const remaining=Math.max(200, estRange-torpDist);
          const estTof=remaining/(C.torpedo.speed??50);
          beamBrg += sc._brgRate * estTof * 0.5;
        }

        // Torpedo position relative to player (beam origin)
        let pdx=b.x-player.wx;
        let pdy=b.y-player.wy;

        // Cross-track error: perpendicular distance from torpedo to the beam line
        // Positive = torpedo is right of beam, negative = left
        const crossTrack = pdx * Math.sin(beamBrg) - pdy * Math.cos(beamBrg);

        // Along-track: how far down the beam the torpedo has traveled
        const alongTrack = pdx * Math.cos(beamBrg) + pdy * Math.sin(beamBrg);

        // Correction angle: steer toward the beam, proportional to cross-track error
        // Clamp to ±15° — prevents wild turns from large offsets
        const maxCorr = 15 * Math.PI / 180;
        const corrGain = Math.max(alongTrack, 300); // gentler correction at short range
        const correction = clamp(-crossTrack / corrGain, -1, 1) * maxCorr;

        let rawTargetBrg = beamBrg + correction;

        // Fire control damage adds bearing noise to wire updates
        if(DMG){
          const wnm=DMG.getEffects().wireNoiseMult;
          if(wnm>1.0) rawTargetBrg+=rand(-0.02,0.02)*wnm;
        }

        // Smooth bearing — 2s time constant filters sonar noise
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
    } // end else (autoTDC not manually overridden)

    // Sensor sweep — torpedo relays acoustic contacts back via wire.
    // Two outputs: wireContacts (tactical display dots) AND bearing observations
    // fed into the player's TMA from the torpedo's position (triangulation).
    const wireRange=C.torpedo.seekRange*1.4;
    b._wireSweepT=(b._wireSweepT||0)-dt;
    const sweepReady=b._wireSweepT<=0;
    if(sweepReady) b._wireSweepT=rand(2.5,4.0); // relay every 2.5-4s, not every frame
    for(const e of enemies){
      if(e.dead) continue;
      let edx=AI.wrapDx(b.x,e.x);
      let edy=e.y-b.y;
      const dist=Math.hypot(edx,edy);
      if(dist>wireRange) continue;
      const u=60+dist*0.08;
      window.G.wireContacts.push({
        x:e.x+rand(-u,u),
        y:e.y+rand(-u,u),
        u, life:1.8, kind:e.type,
        fromTorp:{x:b.x,y:b.y}
      });
      // Feed bearing into TMA — observation from torpedo's position
      // Only if this enemy has an established sonar contact (player has heard it)
      if(sweepReady && window.G.sonarContacts?.has(e) && window.SENSE?.registerBearing){
        const torpBrg=Math.atan2(edy,edx);
        const torpU=clamp(u/Math.max(dist,50), 0.02, 0.08);
        window.SENSE.registerBearing(e, torpBrg, torpU, 'wire', {x:b.x, y:b.y});
      }
    }
  }

  // Manual wire cut — called from panel
  function cutWire(b){
    if(!b?.wire?.live) return;
    b.wire.live=false;
    COMMS.weapons.wireParted(null,'manual');
    window.G._onWireCut?.(b);
  }

  // ASROC-style missile torpedo: rocket flies to datum, deploys a dumb searching torpedo.
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

  window.W={wrapX,makeExplosion,splash,deployDecoy,fireTorpedo,wireUpdate,cutWire,dropDepthCharge,fireMissileTorpedo,torpAcquire};
})();