(() => {
  'use strict';
  const C=window.CONFIG;
  const {clamp,lerp,deg2rad,angleNorm}=window.M;
  const {world,player,setMsg}=window.G;
  const I=window.I;

  function ktsToWU(k){ return k*18; }

  // Route: ordered array of {wx,wy} waypoints
  const route=[];
  window.ROUTE=route; // expose for renderer

  function updateOrders(dt){
    // ── Zoom ──────────────────────────────────────────────────────────────────
    if(I.zoomDelta!==0){
      const factor=Math.pow(1.18,I.zoomDelta);
      C.camera.zoom=clamp(C.camera.zoom*factor,0.04,0.40);
      I.zoomDelta=0;
    }

    // ── Route click ───────────────────────────────────────────────────────────
    if(I._pendingRouteClick){
      I._pendingRouteClick=false;
      // Convert screen click to world coords
      const Z=C.camera.zoom*(window.G.DPR||1);
      const cx=window.G.canvas.width/2, cy=window.G.canvas.height/2;
      const wx=window.G.cam.x+(I.mouseX-cx)/Z;
      const wy=window.G.cam.y+(I.mouseY-cy)/Z;
      // Snap away from land
      const snapped=window.MAPS.snapToSea(
        (wx+world.w)%world.w,
        (wy+world.h)%world.h
      );
      route.push(snapped);
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
    }

    // ── Emergency turn (Q) ────────────────────────────────────────────────────
    if(I.keys.has("q")&&player.emergTurnCd<=0&&player.emergTurnT<=0){
      I.keys.delete("q");
      player.emergTurnT=C.player.emergencyTurn.dur;
      player.emergTurnCd=C.player.emergencyTurn.cd;
      player.noiseTransient=Math.min(1,player.noiseTransient+C.player.emergencyTurn.noiseSpike);
      route.length=0; // abort route on emergency
      setMsg("EMERGENCY TURN!",1.2);
    }

    // ── Crash dive (C) ────────────────────────────────────────────────────────
    if(I.keys.has("c")&&player.crashDiveCd<=0&&player.crashDiveT<=0){
      I.keys.delete("c");
      player.crashDiveT=C.player.crashDive.dur;
      player.crashDiveCd=C.player.crashDive.cd;
      player.noiseTransient=Math.min(1,player.noiseTransient+C.player.crashDive.noiseSpike);
      player.depthOrder=clamp((player.depthOrder??player.depth)+420,20,world.ground-60);
      setMsg("CRASH DIVE!",1.2);
    }
  }

  function stepDynamics(dt){
    // ── Speed ─────────────────────────────────────────────────────────────────
    let orderKts=player.speedOrderKts??0;
    if(I.keys.has("shift")) orderKts=C.player.flankKts;
    if(player.silent) orderKts=Math.min(orderKts,C.player.silentRunning.speedCap);
    const err=orderKts-player.speed;
    player.speed+=(err/Math.max(0.05,C.player.speedTau))*dt;
    player.speed=clamp(player.speed,0,C.player.flankKts);

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
    const rateMax=(C.player.depthRateMax||170)*(player.crashDiveT>0?C.player.crashDiveRateMult:1.0);
    const desiredVy=clamp(errD/tau,-rateMax,rateMax);
    player.vy=lerp(player.vy,desiredVy,0.18);
    player.depth=clamp(player.depth+player.vy*dt,0,world.ground-40);

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
