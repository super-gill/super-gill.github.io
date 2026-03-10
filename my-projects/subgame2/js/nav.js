(() => {
  'use strict';
  const C=window.CONFIG;
  const {clamp,lerp,deg2rad,angleNorm}=window.M;
  const {world,player,setMsg,addLog}=window.G;
  const I=window.I;

  function ktsToWU(k){ return k*1; }

  // Route: ordered array of {wx,wy} waypoints
  const route=[];
  window.ROUTE=route; // expose for renderer

  function updateOrders(dt){
    // ── Zoom ──────────────────────────────────────────────────────────────────
    if(I.zoomDelta!==0){
      const factor=Math.pow(1.18,I.zoomDelta);
      C.camera.zoom=clamp(C.camera.zoom*factor,0.04,8.00);
      I.zoomDelta=0;
    }

    // ── Route click ───────────────────────────────────────────────────────────
    if(I._pendingRouteClick){
      I._pendingRouteClick=false;
      const Z=C.camera.zoom*(window.G.DPR||1);
      const DPR=window.G.DPR||1;
      const cx=(window.G.canvas.width-88*DPR)/2, cy=(window.G.canvas.height-190*DPR)/2;
      const wx=window.G.cam.x+(I.mouseX-cx)/Z;
      const wy=window.G.cam.y+(I.mouseY-cy)/Z;

      // Check if click is near a sonar contact bearing line or live torpedo — designate for TDC
      const {sonarContacts,bullets,enemies,game}=window.G;
      const designatePixels=36; // screen pixels — for blobs and torpedoes
      const designateLinePixels=10; // much tighter for bearing lines (long rays are too easy to accidentally hit)
      const designateR=designatePixels/(Z*DPR);
      let best=null, bestDist=Infinity, bestId=null;

      for(const [e,sc] of sonarContacts){
        if(e.dead) continue; // can't re-designate dead contacts
        // Check distance to bearing line (perpendicular) AND to TMA position blob
        let d=Infinity;
        if(sc.tmaQuality>=(window.CONFIG?.tma?.qualityThresholdBlob??0.15) && sc.tmaX!=null){
          // Has a position — check distance to blob
          const edx=AI.wrapDx(wx,sc.tmaX), edy=sc.tmaY-wy;
          d=Math.hypot(edx,edy);
        } else if(sc.latestBrg!=null){
          // Bearing-line only — perpendicular distance from click to ray
          // Use a tighter radius so normal ocean clicks don't accidentally designate
          const lineR=designateLinePixels/(Z*DPR);
          const ox=sc.latestFromX??player.wx, oy=sc.latestFromY??player.wy;
          const brg=sc.latestBrg;
          const qx=AI.wrapDx(ox,wx), qy=wy-oy;
          const dot=qx*Math.cos(brg)+qy*Math.sin(brg);
          if(dot>0){
            const perp=Math.abs(-qx*Math.sin(brg)+qy*Math.cos(brg));
            if(perp<lineR) d=perp;
          }
        }
        if(d<designateR&&d<bestDist){ bestDist=d; best=e; bestId=sc.id; }
      }
      for(const b of bullets){
        if(b.kind!=='torpedo'||b.life<=0) continue;
        const dx=AI.wrapDx(wx,b.x), dy=b.y-wy;
        const d=Math.hypot(dx,dy);
        if(d<designateR&&d<bestDist){ bestDist=d; best=b; bestId=b.torpId; b._isTorp=true; }
      }

      if(best){
        game.tdc.target=best;
        game.tdc.targetId=bestId;
        window.G.setMsg(`TDC: ${bestId} DESIGNATED`,1.0);
        addLog('CONN',`Weps, Conn — TDC, designate track ${bestId}`);
        const sc=best._isTorp?null:window.G?.sonarContacts?.get(best);
        if(sc) addLog('SONAR',`Conn, Sonar — track ${bestId} locked in TDC`);
      } else {
        // Normal waypoint
        const snapped=window.MAPS.snapToSea(
          (wx+world.w)%world.w,
          (wy+world.h)%world.h
        );
        const firstWP = route.length===0;
        route.push(snapped);
        if(firstWP){
          const brgToWP = Math.atan2(snapped.wy-player.wy, snapped.wx-player.wx);
          const crsStr = Math.round(((brgToWP*180/Math.PI)+360)%360).toString().padStart(3,'0');
          addLog('CONN',`Helm, Conn — come to course ${crsStr}`);
          window.G.queueLog('HELM',`Conn, Helm — aye, coming to course ${crsStr}`,1.5);
        }
      }
    }

    if(I.routeRemoveLast){
      I.routeRemoveLast=false;
      if(route.length>0) route.pop();
    }

    // ── Speed: A = slower, D = faster ────────────────────────────────────────
    const inc=C.player.speedIncrementKts||1;
    const repeat=0.10;
    const incDown=I.keys.has("d");
    const decDown=I.keys.has("a");
    if(incDown||decDown){
      player.speedHoldT=(player.speedHoldT||0)+dt;
      while(player.speedHoldT>=repeat){
        player.speedHoldT-=repeat;
        if(incDown) player.speedOrderKts=Math.min(C.player.flankKts,(player.speedOrderKts||0)+inc);
        if(decDown) player.speedOrderKts=Math.max(0,(player.speedOrderKts||0)-inc);
      }
    } else {
      player.speedHoldT=0;
    }

    // ── Depth: W = shallower, S = deeper ─────────────────────────────────────
    const dStep=C.player.depthStep||60;
    const dRep=C.player.depthHoldRepeat||0.10;
    const holdDepth=(I.keys.has("w")?-1:0)+(I.keys.has("s")?1:0);
    if(holdDepth!==0){
      player.depthHoldT=(player.depthHoldT||0)+dt;
      while(player.depthHoldT>=dRep){
        player.depthHoldT-=dRep;
        player.depthOrder=clamp((player.depthOrder??player.depth)+holdDepth*dStep,20,world.ground-60);
      }
    } else {
      player.depthHoldT=0;
    }

    // ── Silent running ─────────────────────────────────────────────────────────
    if(I.keys.has("z")){
      I.keys.delete("z");
      player.silent=!player.silent;
      setMsg(player.silent?"SILENT RUNNING":"NORMAL RUN",1.0);
      if(player.silent){
        addLog('CONN','All stations, Conn — rig for silent running');
        window.G.queueLog('ENG', 'Conn, Eng — propulsion to one-third, non-essential machinery securing',1.5);
        window.G.queueLog('ENG', 'Conn, Eng — pumps and ventilation secured',3.0);
        window.G.queueLog('SONAR','Conn, Sonar — passive suite only, active sonar safed',5.0);
        window.G.queueLog('WEPS', 'Conn, Weps — weapon systems in standby',6.5);
        window.G.queueLog('ENG', 'Conn, Eng — ship is rigged for silent running. Duty watch in place',8.0);
      } else {
        addLog('CONN','All stations, Conn — secure from silent running');
        window.G.queueLog('ENG','Conn, Eng — restoring normal operations',1.5);
        window.G.queueLog('ENG','Conn, Eng — secured. All systems normal',3.5);
      }
    }

    // ── Emergency turn (Q) ────────────────────────────────────────────────────
    if(I.keys.has("q")&&player.emergTurnCd<=0&&player.emergTurnT<=0){
      {const ta=player.towedArray; if(ta.state==='operational'){ta.state='damaged';window.G.addLog('ENG','Conn, Eng — array took stress on that manoeuvre, degraded');}else if(ta.state==='damaged'){ta.state='destroyed';window.G.addLog('ENG','Conn, Eng — array cable parted on that manoeuvre. Array lost');}}
      I.keys.delete("q");
      player.emergTurnT=C.player.emergencyTurn.dur;
      player.emergTurnCd=C.player.emergencyTurn.cd;
      player.noiseTransient=Math.min(1,player.noiseTransient+C.player.emergencyTurn.noiseSpike);
      route.length=0;
      setMsg("EMERGENCY TURN!",1.2);
      addLog('CONN','Helm, Conn — hard over, emergency turn');
    }

    // ── Crash dive (C) ────────────────────────────────────────────────────────
    if(I.keys.has("c")&&player.crashDiveCd<=0&&player.crashDiveT<=0){
      {const ta=player.towedArray; if(ta.state==='operational'){ta.state='damaged';window.G.addLog('ENG','Conn, Eng — array took stress on crash dive, degraded');}else if(ta.state==='damaged'){ta.state='destroyed';window.G.addLog('ENG','Conn, Eng — array cable parted on crash dive. Array lost');}}
      I.keys.delete("c");
      player.crashDiveT=C.player.crashDive.dur;
      player.crashDiveCd=C.player.crashDive.cd;
      // Large noise spike — blowing tanks is very loud
      player.noiseTransient=Math.min(1,player.noiseTransient+C.player.crashDive.noiseSpike);
      // Dive 600m from current position — straight down
      player.depthOrder=clamp((player.depthOrder??player.depth)+600,20,world.ground-60);
      // Tau override — instant response, bypass normal sluggish depth control
      player._crashTauOverride=C.player.crashDive.tauOverride??0.4;
      setMsg("CRASH DIVE!",2.0);
      player._crashDepthCalled=new Set();
      addLog('CONN','Helm, Conn — emergency deep, all ahead flank');
      window.G.queueLog('ENG','Conn, Eng — flooding all tanks, full dive planes, max down angle',0.8);
      window.G.queueLog('ENG','Conn, Eng — steep down angle, rate of descent high',2.0);
    }
  }

  function stepDynamics(dt){
    // ── Speed ─────────────────────────────────────────────────────────────────
    let orderKts=player.speedOrderKts??0;
    if(player.silent) orderKts=Math.min(orderKts,C.player.silentRunning.speedCap);
    const dmgFx = window.DMG?.getEffects() || {};
    if(dmgFx.speedCap!=null) orderKts=Math.min(orderKts, dmgFx.speedCap);
    const err=orderKts-player.speed;
    player.speed+=(err/Math.max(0.05,C.player.speedTau))*dt;
    player.speed=clamp(player.speed,0,Math.min(C.player.flankKts, dmgFx.speedCap??Infinity));
    // Helm speed report — fires once when actual speed settles within 0.8kt of order
    if(Math.abs(player.speed-orderKts)<0.8 && Math.abs((player._lastReportedKts??-99)-orderKts)>1.0){
      player._lastReportedKts=orderKts;
      if(orderKts>0){
        window.G.queueLog('HELM',`Conn, Helm — making ${Math.round(player.speed)} knots`,0.5);
      } else {
        window.G.queueLog('HELM',`Conn, Helm — all stop, speed zero`,0.5);
      }
    }

    // ── Heading — steer toward next waypoint ──────────────────────────────────
    // Speed-scaled turn rate
    const speedFrac=clamp(player.speed/Math.max(1,C.player.flankKts),0,1);
    const maxTurnDeg=lerp(C.player.turnRateMinDeg,C.player.turnRateDeg,speedFrac);
    const maxTurn=deg2rad(maxTurnDeg);

    if(route.length>0){
      const wp=route[0];
      // Wrap-aware delta
      let dx=wp.wx-player.wx; if(dx>world.w/2) dx-=world.w; if(dx<-world.w/2) dx+=world.w;
      let dy=wp.wy-player.wy; if(dy>world.h/2) dy-=world.h; if(dy<-world.h/2) dy+=world.h;
      const dist=Math.hypot(dx,dy);

      // Arrive threshold — pop waypoint when close enough
      const arriveR=clamp(ktsToWU(player.speed)*2.0, 80, 300);
      if(dist<arriveR){
        route.shift();
        if(route.length>0){
          const nx2=route[0];
          const brgToNext = Math.atan2(nx2.wy-player.wy, nx2.wx-player.wx);
          const crsNext = Math.round(((brgToNext*180/Math.PI)+360)%360).toString().padStart(3,'0');
          addLog('HELM',`Conn, Helm — waypoint reached, coming to course ${crsNext}`);
        } else {
          addLog('HELM',`Conn, Helm — final waypoint reached, steady on course ${Math.round(((player.heading*180/Math.PI)+360)%360).toString().padStart(3,'0')}`);
        }
      } else {
        const desired=Math.atan2(dy,dx);
        let dAng=angleNorm(desired-player.heading);
        dAng=clamp(dAng,-maxTurn*dt,maxTurn*dt);
        player.heading=angleNorm(player.heading+dAng);
      }
      player.turnRate=0;
    } else {
      // No waypoints — hold current heading
      player.turnRate=0;
    }

    // ── Move in top-down world ────────────────────────────────────────────────
    const spWU=ktsToWU(player.speed);
    let nx=player.wx+Math.cos(player.heading)*spWU*dt;
    let ny=player.wy+Math.sin(player.heading)*spWU*dt;

    // Land collision — don't enter land, clear route if stuck
    if(window.MAPS.isLand((nx+world.w)%world.w, (ny+world.h)%world.h)){
      route.length=0;
      // Bounce: just don't move this frame
      nx=player.wx; ny=player.wy;
      setMsg("GROUNDED",1.0);
    }

    player.wx=(nx+world.w)%world.w;
    player.wy=(ny+world.h)%world.h;
    // Horizontal velocity for TMA range estimation (sensors.js _estRange)
    player.vx=Math.cos(player.heading)*spWU;
    player.vxRaw=player.vx; // alias — vy is used for depth so keep separate

    // ── Depth ─────────────────────────────────────────────────────────────────
    const errD=(player.depthOrder??player.depth)-player.depth;
    // Crash dive: use tauOverride for instant response; clear once dive settles
    const crashActive=player.crashDiveT>0;
    if(crashActive && player._crashTauOverride>0){
      // Bleed off override as the dive progresses — snappy start, settles to normal
      player._crashTauOverride=Math.max(0, (player._crashTauOverride||0)-dt*0.3);
    } else {
      player._crashTauOverride=0;
    }
    const tau=Math.max(0.08, player._crashTauOverride>0
      ? player._crashTauOverride
      : (C.player.depthTau||3.0));
    const rateMult=crashActive?(C.player.crashDive.rateMult??2.2):1.0;
    const rateMax=(C.player.depthRateMax||5.0)*rateMult*(dmgFx.depthRateMult??1.0);
    const desiredVy=clamp(errD/tau,-rateMax,rateMax);
    player.vy=lerp(player.vy,desiredVy,0.18);
    // Depth physics — no hard wall at crush depth, just flood damage
    player.depth=clamp(player.depth+player.vy*dt, 0, world.ground-40);

    // Crush depth — progressive flooding below rated depth
    const crushDepth = dmgFx.maxDepth ?? (world.maxDepth ?? 500);
    if(player.depth > crushDepth){
      const overDepth = player.depth - crushDepth;
      // Flood rate scales with overage: 1%/s at 10m over, 10%/s at 100m over
      const floodRate = clamp(overDepth / 1000, 0.002, 0.12); // hull% per second
      if(window.DMG?.applyHullStress){
        window.DMG.applyHullStress(floodRate * dt, 'crush depth exceeded');
      }
      // Log once per 10m band to warn player
      const band = Math.floor(overDepth/10);
      if(band !== (player._crushBand??-1)){
        player._crushBand = band;
        window.G.addLog('ENG', `Conn, Eng — hull stress. Depth ${Math.round(player.depth)}m exceeds crush limit`);
        window.G.setMsg('CRUSH DEPTH EXCEEDED', 1.5);
      }
    } else {
      player._crushBand = -1;
    }

    // Sync aliases
    player.y=player.depth;
    player.x=player.wx;

    // ── Timers ────────────────────────────────────────────────────────────────
    player.emergTurnT=Math.max(0,player.emergTurnT-dt);
    player.emergTurnCd=Math.max(0,player.emergTurnCd-dt);
    player.crashDiveT=Math.max(0,player.crashDiveT-dt);
    player.crashDiveCd=Math.max(0,player.crashDiveCd-dt);
  }

  window.NAV={ktsToWU,updateOrders,stepDynamics};
})();