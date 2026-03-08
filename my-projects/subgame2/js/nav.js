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
        addLog('CONN',`TDC — designate ${bestId}`);
        const sc=best._isTorp?null:window.G?.sonarContacts?.get(best);
        if(sc) addLog('SONAR',`${bestId} brg ${Math.round(game.tdc.bearing??0).toString().padStart(3,'0')}° — solution locked`);
      } else {
        // Normal waypoint
        const snapped=window.MAPS.snapToSea(
          (wx+world.w)%world.w,
          (wy+world.h)%world.h
        );
        route.push(snapped);
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
      addLog('CONN', player.silent ? 'Rig for silent running' : 'Normal running');
      if(player.silent) addLog('ENG','All non-essential machinery secured');
    }

    // ── Emergency turn (Q) ────────────────────────────────────────────────────
    if(I.keys.has("q")&&player.emergTurnCd<=0&&player.emergTurnT<=0){
      {const ta=player.towedArray; if(ta.state==='operational'){ta.state='damaged';window.G.addLog('ENG','Array damaged — emergency turn');}else if(ta.state==='damaged'){ta.state='destroyed';window.G.addLog('ENG','Array lost — emergency turn [DESTROYED]');}}
      I.keys.delete("q");
      player.emergTurnT=C.player.emergencyTurn.dur;
      player.emergTurnCd=C.player.emergencyTurn.cd;
      player.noiseTransient=Math.min(1,player.noiseTransient+C.player.emergencyTurn.noiseSpike);
      route.length=0;
      setMsg("EMERGENCY TURN!",1.2);
      addLog('CONN','Emergency turn — hard over!');
    }

    // ── Crash dive (C) ────────────────────────────────────────────────────────
    if(I.keys.has("c")&&player.crashDiveCd<=0&&player.crashDiveT<=0){
      {const ta=player.towedArray; if(ta.state==='operational'){ta.state='damaged';window.G.addLog('ENG','Array damaged — crash dive');}else if(ta.state==='damaged'){ta.state='destroyed';window.G.addLog('ENG','Array lost — crash dive [DESTROYED]');}}
      I.keys.delete("c");
      player.crashDiveT=C.player.crashDive.dur;
      player.crashDiveCd=C.player.crashDive.cd;
      player.noiseTransient=Math.min(1,player.noiseTransient+C.player.crashDive.noiseSpike);
      player.depthOrder=clamp((player.depthOrder??player.depth)+420,20,world.ground-60);
      setMsg("CRASH DIVE!",1.2);
      addLog('CONN','Crash dive!');
      addLog('ENG','Flood all ballast tanks — max down angle');
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

    // ── Depth ─────────────────────────────────────────────────────────────────
    const errD=(player.depthOrder??player.depth)-player.depth;
    const tau=Math.max(0.08,C.player.depthTau||1.4);
    const rateMax=(C.player.depthRateMax||170)*(player.crashDiveT>0?C.player.crashDiveRateMult:1.0)*(dmgFx.depthRateMult??1.0);
    const desiredVy=clamp(errD/tau,-rateMax,rateMax);
    player.vy=lerp(player.vy,desiredVy,0.18);
    // Enforce max depth from hull integrity
    const depthLimit = dmgFx.maxDepth ?? (world.ground-40);
    player.depth=clamp(player.depth+player.vy*dt, 0, Math.min(world.ground-40, depthLimit));

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