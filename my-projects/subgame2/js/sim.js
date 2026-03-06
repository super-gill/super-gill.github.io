(() => {
  'use strict';
  const C=window.CONFIG; const {rand,clamp,lerp,now,angleNorm}=window.M;
  const {world,cam,canvas,bullets,particles,enemies,decoys,contacts,cwisTracers,wireContacts,player,game,setMsg}=window.G;
  const I=window.I; const NAV=window.NAV; const SIG=window.SIG; const SENSE=window.SENSE; const W=window.W; const AI=window.AI;

  function wrapX(x){return (x+world.w)%world.w;}
  function damagePlayer(amount){
    if(player.invuln>0) return;
    player.hp=Math.max(0,player.hp-amount);
    player.invuln=0.8;
    W.makeExplosion(player.wx,player.wy,0.8,true);
    if(player.hp<=0) game.over=true;
  }
  function damageEnemy(e,amount){
    e.hp-=amount;
    W.makeExplosion(e.x,e.y,amount>=90?1.6:1.0,e.type==="boat");
    if(e.hp<=0){game.score+=(e.type==="boat"?160:190); e.dead=true;}
  }

  function clampConeDual(desiredDx,desiredDy,heading,coneDeg){
    const desAng=Math.atan2(desiredDy,desiredDx);
    const half=(coneDeg*Math.PI/180)*0.5;
    const diffF=angleNorm(desAng-heading);
    const diffR=angleNorm(desAng-(heading+Math.PI));
    const useRear=(Math.abs(diffR)<Math.abs(diffF));
    const diff=useRear?diffR:diffF;
    const clamped=clamp(diff,-half,half);
    const ang=(useRear?(heading+Math.PI):heading)+clamped;
    return {dx:Math.cos(ang),dy:Math.sin(ang),isRear:useRear,out:(Math.abs(diff)>half)};
  }

  function reset(){
    bullets.length=0;particles.length=0;enemies.length=0;decoys.length=0;contacts.length=0;cwisTracers.length=0;wireContacts.length=0;
    if(window.ROUTE) window.ROUTE.length=0;
    game.score=0;game.over=false;game.msg="";game.msgT=0;
    const spawn=window.MAPS?.getMap()?.playerSpawn||{wx:4000,wy:5000};
    player.wx=spawn.wx; player.wy=spawn.wy; player.x=spawn.wx;
    player.heading=0; player.speed=0; player.speedOrderKts=0;
    player.depth=260; player.depthOrder=260; player.y=260;
    player.vy=0; player.turnRate=0; player.hp=C.player.hpMax; player.invuln=0;
    player.noise=0; player.noiseTransient=0; player.cavitating=false;
    player.torpCd=0; player.missileCd=0; player.pingCd=0; player.cmCd=0; player.sonarPulse=0; player.periscopeCd=0; player.periscopeT=0;
    player.silent=false; player.emergTurnT=0; player.emergTurnCd=0; player.crashDiveT=0; player.crashDiveCd=0; player.passiveTick=0;
    for(let i=0;i<9;i++) AI.spawnEnemy();
  }
  reset();

  function update(dt){
    if(I.keys.has("r")) reset();

    player.torpCd=Math.max(0,player.torpCd-dt);
    player.missileCd=Math.max(0,player.missileCd-dt);
    player.pingCd=Math.max(0,player.pingCd-dt);
    player.cmCd=Math.max(0,player.cmCd-dt);
    player.invuln=Math.max(0,player.invuln-dt);
    player.sonarPulse=Math.max(0,player.sonarPulse-dt);
    game.msgT=Math.max(0,game.msgT-dt); if(game.msgT<=0) game.msg="";

    for(const e of enemies){
      if(e.seen>0) e.seen=Math.max(0,e.seen-dt);
      if(e.detectedT>0) e.detectedT=Math.max(0,e.detectedT-dt);
      if(e.pingPulse>0) e.pingPulse=Math.max(0,e.pingPulse-dt);
      if(e.evadeT>0){e.evadeT=Math.max(0,e.evadeT-dt); if(e.evadeT<=0){e.evadeFrom=null;e.evadeDecoy=null;}}
    }

    if(!game.over){
      NAV.updateOrders(dt);
      NAV.stepDynamics(dt);  // handles all movement including player.wx/wy/depth/y

      SIG.updateNoise(dt);

      // Aim world coords: unproject mouse through camera
      const Z=cam.zoom;
      I.aimWorldX=cam.x+(I.mouseX-canvas.width/2)/Z;
      I.aimWorldY=cam.y+(I.mouseY-canvas.height/2)/Z;
      // Periscope (O) — shallow only
      if(I.keys.has("o") && player.periscopeCd<=0){
        I.keys.delete("o");
        if(player.depth>C.player.periscopeDepth){
          setMsg("PERISCOPE: TOO DEEP", 1.0);
        } else {
          player.periscopeCd = C.player.periscope.cd;
          player.periscopeT  = C.player.periscope.dur;
          player.noiseTransient = Math.min(1, player.noiseTransient + C.player.periscope.noiseSpike);
          let shown = 0;
          for(const e of enemies){
            if(e.type!=="boat") continue;
            const dx = AI.wrapDx(player.wx, e.x);
            const dy = e.y - player.wy;
            const d = Math.hypot(dx,dy);
            if(d <= C.player.periscope.revealR){
              SENSE.setDetected(e, C.detection.detectT*1.4, C.detection.seenT*1.2);
              shown++;
            }
          }
          setMsg(shown>0 ? `SCOPE: ${shown} ship(s)` : "SCOPE: no ships", 1.2);
        }
      }

      SENSE.proximityDetect();
      if(I.keys.has(" ")&&player.pingCd<=0){I.keys.delete(" "); SENSE.activePing(); setMsg("PING!",0.8);}
      SENSE.passiveUpdate(dt);

      // Shift+LMB = fire wire-guided torpedo on aimed bearing
      // While shift is held, an aim cone is drawn (render.js reads I.shiftHeld + I.aimWorldX/Y)
      if(I.torpAimClick && player.torpCd<=0){
        I.torpAimClick=false;
        player.torpCd=C.player.torpCd;
        const aimDx=I.aimWorldX-player.wx;
        const aimDy=I.aimWorldY-player.wy;
        const d=Math.max(1e-6,Math.hypot(aimDx,aimDy));
        const ddx=aimDx/d, ddy=aimDy/d;
        const shot=clampConeDual(ddx,ddy,player.heading,C.player.torpArcDeg);
        if(shot.out) setMsg("TUBE ARC LIMIT",0.6);
        const off=C.player.r*1.35;
        const sx=player.wx+Math.cos(player.heading)*off;
        const sy=player.wy+Math.sin(player.heading)*off;
        player.noiseTransient=Math.min(1,player.noiseTransient+0.18);
        W.fireTorpedo(sx,sy,shot.dx,shot.dy,true,C.player.torpEnableDist,true); // wire=true
        setMsg("TORPEDO — WIRE LIVE",0.9);
      }

      // F = quick fire (no wire, forward bearing)
      if(I.keys.has("f")&&player.torpCd<=0){
        I.keys.delete("f");
        player.torpCd=C.player.torpCd;
        const off=C.player.r*1.35;
        const sx=player.wx+Math.cos(player.heading)*off;
        const sy=player.wy+Math.sin(player.heading)*off;
        player.noiseTransient=Math.min(1,player.noiseTransient+0.18);
        W.fireTorpedo(sx,sy,Math.cos(player.heading),Math.sin(player.heading),true,C.player.torpEnableDist,false);
        setMsg("TORPEDO AWAY",0.9);
      }

      // G = VLS missile (shallow only)
      if(I.keys.has("g")&&player.missileCd<=0){
        I.keys.delete("g");
        if(player.depth>C.player.periscopeDepth){setMsg("MISSILE: TOO DEEP",0.8);}
        else{
          player.missileCd=C.player.missileCd;
          player.noiseTransient=Math.min(1,player.noiseTransient+0.35);
          setMsg("VLS LAUNCH!",1.0);
          W.fireMissileVLS(player.wx,player.wy,true);
        }
      }

      // X = deploy noisemaker
      if(I.keys.has("x")&&player.cmCd<=0){
        I.keys.delete("x");
        player.cmCd=C.player.cmCd;
        W.deployDecoy(player.wx,player.wy,true,"noisemaker");
        player.noiseTransient=Math.min(1,player.noiseTransient+0.10);
        setMsg("NOISEMAKER OUT",0.9);
      }
    }

    // enemies
    for(const e of enemies){
      AI.enemyMaybeHearPlayer(e,dt);
      AI.enemyDecay(e,dt);

      const state=(e.suspicion>C.enemy.susEngage)?"engage":(e.suspicion>C.enemy.susInvestigate?"investigate":"patrol");

      if(e.type==="boat"){
        // Surface ships move in top-down 2D — they have a heading and speed
        e.x=(e.x+e.vx*dt+world.w)%world.w;
        e.y=(e.y+e.vy*dt+world.h)%world.h;
        e.hitY=0; // boats are always at surface depth=0

        if(state==="patrol"){
          e.vx=clamp(e.vx+Math.sin(now()*0.6+e.x*0.002)*2*dt,-40,-8);
        } else if(e.contact){
          const dx=AI.wrapDx(e.x,e.contact.x);
          const sweep=Math.sin(now()*1.1+e.x*0.002)*16;
          e.vx += clamp((dx*0.0010)+sweep*0.02,-12,12)*dt;
          e.vx=clamp(e.vx,-62,-10);
        }

        e.fireCd-=dt;
        if(e.fireCd<=0 && !game.over){
          const t=(state==="engage")?C.enemy.boatFireEngage:C.enemy.boatFireOther;
          e.fireCd=rand(t[0],t[1]);
          if(AI.enemyHasFireSolution(e)){
            const tx=e.contact.x, ty=e.contact.y;
            const dx=AI.wrapDx(e.x,tx);
            const dy=ty-e.y;
            const d=Math.hypot(dx,dy);
            if(ty>world.seaLevel+140 && d<1350 && e.contact.u<900){
              W.dropDepthCharge(e.x+rand(-18,18),e.y+6,ty);
            } else if(d<1650 && e.contact.u<1000){
              W.fireTorpedo(e.x,e.y+10,dx,dy+140,false,260);
            }
          }
        }

        // Torpedo reaction — boats deploy noisemaker decoys and jink speed,
        // mirroring what enemy subs do. flareCd is reused as the noisemaker cd.
        e.flareCd = Math.max(0, (e.flareCd||0) - dt);
        for(const b of bullets){
          if(b.kind!=="torpedo" || !b.friendly || b.life<=0) continue;
          const dx=AI.wrapDx(e.x,b.x);
          const dy=b.y-e.hitY;
          const dd=Math.hypot(dx,dy);
          if(dd<C.enemy.boatTorpReactR){
            e.suspicion=Math.min(1,e.suspicion+0.15);
            if(e.flareCd<=0){
              e.flareCd=rand(3.5,6.0);
              // Deploy a noisemaker off the stern into the water
              W.deployDecoy(
                wrapX(e.x+rand(-30,30)),
                e.hitY+rand(10,30),
                false, "noisemaker",
                {vx:rand(-20,20), vy:rand(20,50)}
              );
              setMsg("SHIP: COUNTERMEASURES!",0.8);
            }
          }
        }
      } else {
        // sub nav — top-down, e.x/e.y = world position, e.depth = depth
        e.x=(e.x+e.vx*dt+world.w)%world.w;
        e.y=(e.y+e.vy*dt+world.h)%world.h;
        e.navT -= dt;
        if(e.navT<=0){
          e.navT=rand(C.enemy.subNavT[0],C.enemy.subNavT[1]);
          e.navX=(e.x+rand(-1200,1200)+world.w)%world.w;
          e.navY=(e.y+rand(-1200,1200)+world.h)%world.h;
        }
        if(e.evadeT<=0){
          const ndx=AI.wrapDx(e.x,e.navX);
          const ndy=AI.wrapDx(e.y,e.navY); // wrap in Y too
          const nd=Math.max(1,Math.hypot(ndx,ndy));
          const nx=ndx/nd, ny=ndy/nd;
          const thrust=(state==="engage")?38:(state==="investigate"?28:20);
          e.vx += nx*thrust*dt;
          e.vy += ny*thrust*dt;
        } else {
          let tx=null,ty=null,best=1e9;
          for(const b of bullets){
            if(b.kind!=="torpedo"||!b.friendly||b.life<=0) continue;
            const dx=AI.wrapDx(e.x,b.x);
            const dy=b.y-e.y;
            const dd=Math.hypot(dx,dy);
            if(dd<best){best=dd;tx=b.x;ty=b.y;}
          }
          if(tx===null && e.evadeFrom){tx=e.evadeFrom.x;ty=e.evadeFrom.y;}
          if(tx!==null){
            const ax=AI.wrapDx(tx,e.x);
            const ay=e.y-ty;
            const dd=Math.max(1,Math.hypot(ax,ay));
            e.vx += (ax/dd)*200*dt;
            e.vy += (ay/dd)*200*dt;
          }
          if(e.evadeDecoy){
            const bx=AI.wrapDx(e.evadeDecoy.x,e.x);
            const by=e.y-e.evadeDecoy.y;
            const dd=Math.max(1,Math.hypot(bx,by));
            e.vx += (bx/dd)*140*dt;
            e.vy += (by/dd)*140*dt;
          }
        }
        e.vx *= Math.pow(0.94,dt*60);
        e.vy *= Math.pow(0.94,dt*60);
        const sv=Math.hypot(e.vx,e.vy);
        if(sv>10) e.heading=Math.atan2(e.vy,e.vx);

        // sub ping — enemy subs ping infrequently; each ping is an event
        // that degrades through the layer. A single ping raises suspicion
        // to investigate range but not to engage.
        e.pingCd -= dt;
        if(e.pingCd<=0 && !game.over){
          e.pingCd=rand(C.enemy.subPingCd[0],C.enemy.subPingCd[1]);
          const dxp=AI.wrapDx(player.wx,e.x);
          const dyp=player.wy-e.y;
          const dp=Math.hypot(dxp,dyp);
          if(dp<C.enemy.subPingRange){
            e.pingPulse=1.2;
            e.detectedT=Math.max(e.detectedT||0,C.detection.detectT);
            e.seen=Math.max(e.seen||0,C.detection.seenT*0.4);
            e.lastX=e.x; e.lastY=e.y; e.lastT=now();
            const layer=AI.layerPenalty(player.depth,e.depth||400);
            const u=(220+dp*0.13)*(layer<1?1.60:1.0);
            e.contact={
              x:(player.wx+rand(-u,u)+world.w)%world.w,
              y:(player.wy+rand(-u,u)+world.h)%world.h,
              u,t:now(),
              strength:clamp(0.55+(1-dp/2000)*0.30,0.28,0.82)*(layer<1?0.70:1.0)
            };
            e.suspicion=Math.min(1,e.suspicion+0.18);
          }
        }

        // sub fire
        e.fireCd -= dt;
        if(e.fireCd<=0 && !game.over){
          const t=(state==="engage")?C.enemy.subFireEngage:C.enemy.subFireOther;
          e.fireCd=rand(t[0],t[1]);
          if(AI.enemyHasFireSolution(e)){
            const tx=e.contact.x, ty=e.contact.y;
            const dx=AI.wrapDx(e.x,tx);
            const dy=ty-e.y;
            const d=Math.hypot(dx,dy);
            const layer=AI.layerPenalty(player.y,e.y);
            const maxD=(layer<1)?1150:1450;
            if(d<maxD && e.contact.u<1100){
              const shot=clampConeDual(dx,dy,e.heading||Math.atan2(e.vy,e.vx),C.enemy.subTorpArcDeg);
              const off=e.r*1.25;
              const sx=e.x + (shot.isRear?-Math.cos(e.heading):Math.cos(e.heading))*off;
              const sy=e.y + (shot.isRear?-Math.sin(e.heading):Math.sin(e.heading))*off;
              W.fireTorpedo(sx,sy,shot.dx,shot.dy,false,260);
            }
          }
        }

        // incoming torp reaction
        for(const b of bullets){
          if(b.kind!=="torpedo"||!b.friendly||b.life<=0) continue;
          const dx=AI.wrapDx(e.x,b.x);
          const dy=b.y-e.y;
          const dd=Math.hypot(dx,dy);
          if(dd<C.enemy.subTorpReactR){
            e.suspicion=Math.min(1,e.suspicion+0.22);
            e.evadeT=Math.max(e.evadeT||0,rand(1.4,2.4));
            e.evadeFrom={x:b.x,y:b.y};
            if(e.cmCd<=0){
              e.cmCd=rand(3.0,6.0);
              const dec=W.deployDecoy(wrapX(e.x+rand(-20,20)),clamp(e.y+rand(-20,20),world.seaLevel+80,world.ground-60),false,"noisemaker");
              e.evadeDecoy={x:dec.x,y:dec.y};
            }
          }
        }
        e.cmCd=Math.max(0,e.cmCd-dt);
      }
    }

    for(let i=enemies.length-1;i>=0;i--) if(enemies[i].dead){enemies.splice(i,1); AI.spawnEnemy();}

    // decoys
    for(const d of decoys){
      d.life -= dt;
      d.x = wrapX(d.x + d.vx*dt);
      d.y = d.y + d.vy*dt;
      d.vx *= Math.pow(0.94,dt*60);
      d.vy *= Math.pow(0.94,dt*60);
      if(d.kind==="flare"){
        d.vy += (d.g||C.ship.flareGravity)*dt;
        if(d.y>world.seaLevel-6 && d.vy>0){ W.splash(d.x,world.seaLevel,0.5); d.life=Math.min(d.life,0.30); }
      } else {
        if(d.mode==="sink") d.vy += C.ship.sinkExtraG*dt;
        else d.vy += 22*dt;
      }
      d.y = clamp(d.y,world.seaLevel-80,world.ground-40);
    }
    for(let i=decoys.length-1;i>=0;i--) if(decoys[i].life<=0) decoys.splice(i,1);

    // contacts
    for(const c of contacts) c.life -= dt;
    for(let i=contacts.length-1;i>=0;i--) if(contacts[i].life<=0) contacts.splice(i,1);

    // bullets
    for(const b of bullets){
      b.life -= dt;

      if(b.kind==="depthCharge"){
        b.vy = lerp(b.vy,b.sink,0.08);
        b.x = wrapX(b.x + b.vx*dt);
        b.y += b.vy*dt;
        if(b.y>=b.targetY || b.y>=world.ground-12){
          W.makeExplosion(b.x,b.y,1.15,true);
          const dxp=AI.wrapDx(b.x,player.x);
          const dyp=player.y-b.y;
          const dp=Math.hypot(dxp,dyp);
          if(dp<b.blastR) damagePlayer(b.dmg*(1-dp/b.blastR));
          b.life=0;
        }
        continue;
      }

      if(b.kind==="torpedo"){
        const s=Math.hypot(b.vx,b.vy);
        b.traveled += s*dt;
        b.arming = Math.max(0,b.arming-dt);
        const seekerOn = (b.traveled >= (b.enableDist||0));
        // Dumb-run depth program before seeker enables
        if(!seekerOn){
          const prog = b.program || "hold";
          let targetY = b.holdY ?? b.y;
          if(prog==="dive") targetY = clamp((b.holdY ?? b.y) + 260, world.seaLevel + 80, world.ground - 120);
          else if(prog==="ascend") targetY = clamp((b.holdY ?? b.y) - 220, world.seaLevel + 80, world.ground - 120);
          // 'hold' keeps near initial depth

          const curAng = Math.atan2(b.vy, b.vx);
          const forward = Math.cos(curAng) >= 0 ? 1 : -1; // keep general travel direction
          const dxProg = 1.0 * forward;
          const dyProg = clamp((targetY - b.y) / 220, -1, 1);
          const desiredAng = Math.atan2(dyProg, dxProg);
          let dAng = angleNorm(desiredAng - curAng);
          const maxTurn = 0.9 * dt; // gentle depth steering in dumb run
          dAng = clamp(dAng, -maxTurn, maxTurn);
          const newAng = curAng + dAng;
          const speed = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(newAng) * speed;
          b.vy = Math.sin(newAng) * speed;
        }


        if(seekerOn && (!b.target || Math.random()<C.torpedo.reacquireChance)){
          const t=W.torpAcquire(b);
          if(t) b.target=t;
        }
        if(seekerOn && b.target && b.arming<=0){
          const tx=b.target.x;
          const ty=(b.target.type==="boat")?(b.target.hitY??b.target.y):b.target.y;
          const dx=AI.wrapDx(b.x,tx);
          const dy=ty-b.y;
          const desired=Math.atan2(dy,dx);
          const cur=Math.atan2(b.vy,b.vx);
          let dAng=angleNorm(desired-cur);
          const maxTurn=b.turnRate*dt;
          dAng=clamp(dAng,-maxTurn,maxTurn);
          const newAng=cur+dAng;
          const speed=Math.hypot(b.vx,b.vy);
          b.vx=Math.cos(newAng)*speed;
          b.vy=Math.sin(newAng)*speed;
        } else if(!b.target){
          b.weaveT += dt;
          const cur=Math.atan2(b.vy,b.vx);
          const wob=Math.sin(b.weaveT*2.2)*C.torpedo.searchSnake*dt;
          const newAng=cur+wob;
          const speed=Math.hypot(b.vx,b.vy);
          b.vx=Math.cos(newAng)*speed;
          b.vy=Math.sin(newAng)*speed;
        }

        const ns=lerp(s,C.torpedo.speed,0.08);
        const ang=Math.atan2(b.vy,b.vx);
        b.vx=Math.cos(ang)*ns; b.vy=Math.sin(ang)*ns;

        b.x=(b.x+b.vx*dt+world.w)%world.w;
        b.y=(b.y+b.vy*dt+world.h)%world.h;

        if(b.life>0 && b.arming<=0){
          if(b.friendly){
            for(const e of enemies){
              if((e.detectedT||0)<=0) continue;
              const dx=AI.wrapDx(b.x,e.x);
              const dy=e.y-b.y;
              if(Math.hypot(dx,dy)<e.r+b.r){damageEnemy(e,b.dmg); b.life=0; break;}
            }
          } else {
            const dx=AI.wrapDx(b.x,player.wx);
            const dy=player.wy-b.y;
            if(Math.hypot(dx,dy)<C.player.r+b.r){damagePlayer(24); b.life=0;}
          }
        }

        if(b.life>0){
          for(const d of decoys){
            if(d.kind!=="noisemaker") continue;
            if(b.friendly && d.friendly) continue;
            if(!b.friendly && !d.friendly) continue;
            const dx=AI.wrapDx(b.x,d.x);
            const dy=d.y-b.y;
            if(Math.hypot(dx,dy)<d.r+b.r){W.makeExplosion(b.x,b.y,0.8,true); b.life=0; break;}
          }
        }

        // CWIS intercept — surface ships shoot down incoming missiles only.
        // Torpedoes are handled by noisemaker decoys (see boat torpedo reaction above).
        if(b.kind==="missile" && b.life>0 && b.friendly){
          for(const e of enemies){
            if(e.type!=="boat" || !e.cwis) continue;
            const dx=AI.wrapDx(b.x,e.x);
            const dy=b.y-e.hitY;
            const dist=Math.hypot(dx,dy);
            if(dist>e.cwis.range) continue;
            const closing=(dx*b.vx+dy*b.vy)<0;
            if(!closing) continue;
            const pKill=e.cwis.pKillPerSec*dt;
            e.cwis.tracerCd=(e.cwis.tracerCd||0)-dt;
            if(e.cwis.tracerCd<=0){
              e.cwis.tracerCd=rand(0.06,0.12);
              const bursts=Math.floor(rand(C.ship.tracerBursts[0],C.ship.tracerBursts[1]));
              for(let k=0;k<bursts;k++){
                const spread=(Math.random()-0.5)*C.ship.tracerSpread;
                const ang=Math.atan2(dy,dx)+spread;
                const spd=rand(900,1200);
                cwisTracers.push({
                  x:e.x, y:e.hitY-8,
                  vx:Math.cos(ang)*spd,
                  vy:Math.sin(ang)*spd,
                  life:rand(C.ship.tracerLife[0],C.ship.tracerLife[1]),
                  maxLife:rand(C.ship.tracerLife[0],C.ship.tracerLife[1])
                });
              }
            }
            if(Math.random()<pKill){
              W.makeExplosion(b.x,b.y,0.7,false);
              setMsg("CWIS INTERCEPT!",1.0);
              b.life=0;
              break;
            }
          }
        }
      }

      // missiles not implemented in this minimal build (kept in config); safe to leave bullets list without them
      // If you want missiles now, we can port them from v4 with the new movement model.
    }
    for(let i=bullets.length-1;i>=0;i--) if(bullets[i].life<=0) bullets.splice(i,1);

    // Wire guidance update — runs on live wired torpedoes
    for(const b of bullets){
      if(b.kind==="torpedo"&&b.wire&&b.wire.live) W.wireUpdate(b,dt);
    }

    // Wire contacts age out
    for(const wc of wireContacts) wc.life-=dt;
    for(let i=wireContacts.length-1;i>=0;i--) if(wireContacts[i].life<=0) wireContacts.splice(i,1);

    // CWIS tracers — short-lived fast projectiles, purely visual + positional
    for(const t of cwisTracers){
      t.life -= dt;
      t.x = wrapX(t.x + t.vx*dt);
      t.y += t.vy*dt;
    }
    for(let i=cwisTracers.length-1;i>=0;i--) if(cwisTracers[i].life<=0) cwisTracers.splice(i,1);

    // particles — top-down, just drift and fade
    for(const p of particles){
      p.life -= dt;
      p.x = (p.x + p.vx*dt + world.w)%world.w;
      p.y = (p.y + p.vy*dt + world.h)%world.h;
      p.vx *= Math.pow(0.88,dt*60);
      p.vy *= Math.pow(0.88,dt*60);
    }
    for(let i=particles.length-1;i>=0;i--) if(particles[i].life<=0) particles.splice(i,1);

    // Camera — top-down, player centred, slight lead in heading direction
    cam.x = player.wx;
    cam.y = player.wy;
    cam.zoom = C.camera.zoom;
  }

  window.SIM={update,reset};
})()
