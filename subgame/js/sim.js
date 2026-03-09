(() => {
  'use strict';

  const C = window.CONFIG;
  const { rand, clamp, lerp, now, angleNorm, lerpAngle } = window.M;
  const { world, cam, bullets, particles, enemies, pickups, decoys, contacts, cwisTracers, player, game, setMsg, canvas } = window.G;
  const I = window.I;
  const W = window.W;
  const AI = window.AI;

  function applyWaterPhysics(obj, dt){
    const drag = 0.92;
    obj.vx *= Math.pow(drag, dt*60);
    obj.vy *= Math.pow(drag, dt*60);
    obj.vx += Math.sin((obj.y*0.003) + now()*0.6) * 6 * dt;
  }

  function wrapX(x){ return (x + world.w) % world.w; }

  function damagePlayer(amount){
    if(player.invuln > 0) return;
    player.hp = Math.max(0, player.hp - amount);
    player.invuln = 0.8;
    W.makeExplosion(player.x, player.y, 0.8, true);
    if(player.hp <= 0) game.over = true;
  }

  function damageEnemy(e, amount){
    e.hp -= amount;
    W.makeExplosion(e.x, e.y, amount>=90?1.6:1.0, e.type==="boat");
    if(e.hp <= 0){
      game.score += (e.type==="boat" ? 160 : 190);
      e.dead = true;
    }
  }

  function setDetected(e, tDetect, tSeen=0){
    e.detectedT = Math.max(e.detectedT||0, tDetect);
    if(tSeen>0) e.seen = Math.max(e.seen||0, tSeen);
    e.lastX = e.x; e.lastY = e.y; e.lastT = now();
  }

  function clampTorpArc(dx,dy){
    const desired = Math.atan2(dy, dx);
    const half = (C.player.torpArcDeg * Math.PI/180) * 0.5;
    const diff = angleNorm(desired - (player.heading||0));
    const cd = clamp(diff, -half, half);
    const ang = (player.heading||0) + cd;
    return { dx: Math.cos(ang), dy: Math.sin(ang), out: Math.abs(diff) > half };
  }

  function reset(){
    bullets.length=0; particles.length=0; enemies.length=0; pickups.length=0; decoys.length=0; contacts.length=0; cwisTracers.length=0;
    game.score=0; game.over=false; game.msg=""; game.msgT=0;
    player.x=800; player.y=world.seaLevel+260; player.vx=0; player.vy=0; player.hp=C.player.hpMax; player.invuln=0;
    player.torpCd=0; player.missCd=0; player.sonarCd=0; player.cmCd=0; player.sonarPulse=0;
    player.noise=0; player.selfMask=0; player.passiveTick=0; player.heading=0;
    for(let i=0;i<7;i++) AI.spawnEnemy();
  }
  reset();

  function update(dt){
    if(I.keys.has("r")) reset();

    // timers
    player.torpCd = Math.max(0, player.torpCd - dt);
    player.missCd = Math.max(0, player.missCd - dt);
    player.sonarCd = Math.max(0, player.sonarCd - dt);
    player.cmCd = Math.max(0, player.cmCd - dt);
    player.invuln = Math.max(0, player.invuln - dt);
    player.sonarPulse = Math.max(0, player.sonarPulse - dt);
    game.msgT = Math.max(0, game.msgT - dt);
    if(game.msgT<=0) game.msg="";

    // detection timers
    for(const e of enemies){
      if(e.seen>0) e.seen = Math.max(0, e.seen - dt);
      if(e.detectedT>0) e.detectedT = Math.max(0, e.detectedT - dt);
      if(e.pingPulse>0) e.pingPulse = Math.max(0, e.pingPulse - dt);
      if(e.evadeT>0){ e.evadeT = Math.max(0, e.evadeT - dt); if(e.evadeT<=0){ e.evadeFrom=null; e.evadeDecoy=null; } }
    }

    if(!game.over){
      // movement + sprint
      const sprint = I.keys.has("shift");
      const acc = sprint ? C.player.sprintAcc : C.player.acc;

      if(I.keys.has("a")) player.vx -= acc*dt;
      if(I.keys.has("d")) player.vx += acc*dt;
      if(I.keys.has("w")) player.vy -= acc*dt;
      if(I.keys.has("s")) player.vy += acc*dt;

      applyWaterPhysics(player, dt);

      // speed cap
      const vmax = sprint ? C.player.sprintVmax : C.player.vmax;
      const v = Math.hypot(player.vx, player.vy);
      if(v > vmax){ player.vx *= vmax/v; player.vy *= vmax/v; }

      // integrate position first (aim + heading should match where you are now)
      player.x = wrapX(player.x + player.vx*dt);
      player.y = clamp(player.y + player.vy*dt, world.seaLevel + 70, world.ground - 60);

      // noise model (0..1): baseline + speed ramp, plus sprint transient
      const spd = Math.hypot(player.vx, player.vy);
      player.noise = clamp(C.player.noiseFloor + (spd - C.player.noiseRampStart) / C.player.noiseRampDiv, 0, 1);
      if(sprint) player.noise = Math.min(1, player.noise + C.player.sprintNoiseBoost);
      player.selfMask = player.noise;

      // aim world
      I.aimWorldX = cam.x + I.mouseX;
      I.aimWorldY = cam.y + I.mouseY;
      const aimDx = AI.wrapDx(player.x, I.aimWorldX);
      const aimDy = I.aimWorldY - player.y;

      // proximity detection
      for(const e of enemies){
        const dxp = AI.wrapDx(player.x, e.x);
        const dyp = (e.y - player.y);
        const dp = Math.hypot(dxp, dyp);
        if(dp < C.detection.proximityR){
          setDetected(e, C.detection.detectT+1.0, C.detection.seenT);
        }
      }

      // fire torpedo (arc-limited)
      if(I.mouseDownL && player.torpCd<=0){
        player.torpCd = C.player.torpCd;
        const c = clampTorpArc(aimDx, aimDy);
        if(c.out) setMsg("TORP ARC LIMIT", 0.6);
        W.fireTorpedo(player.x + c.dx*(player.r*1.35), player.y + c.dy*(player.r*0.15), c.dx, c.dy, true);
      }

      // fire missile
      if(I.mouseDownR && player.missCd<=0){
        player.missCd = C.player.missCd;
        player.noise = Math.min(1, player.noise + 0.35);
        setMsg("MISSILE LAUNCH TRANSIENT!", 1.0);
        W.fireMissileVLS(player.x, player.y, true, null);
      }

      // countermeasure
      if(I.keys.has("q") && player.cmCd<=0){
        player.cmCd = C.player.cmCd;
        W.deployDecoy(player.x - 10, player.y + 10, true, "noisemaker");
        setMsg("NOISEMAKER OUT", 1.0);
      }

      // active ping
      if(I.keys.has(" ") && player.sonarCd<=0){
        player.sonarCd = C.player.sonarCd;
        player.sonarPulse = C.player.sonarPulse;

        // mark enemies as detected (targetable) within radius, but don't paint exact silhouettes
        for(const e of enemies){
          const dx = AI.wrapDx(player.x, e.x);
          const dy = e.y - player.y;
          const d = Math.hypot(dx,dy);
          if(d < C.detection.pingDetectR){
            setDetected(e, C.detection.detectT, 0);
          }
        }

        // ping detection risk to enemies (gives them contact)
        let detectedBy = 0;
        for(const e of enemies){
          const dx = AI.wrapDx(e.x, player.x);
          const dy = player.y - e.y;
          const d = Math.hypot(dx, dy);
          const range = 2000;
          if(d > range) continue;

          const base = (1 - d/range);
          const layer = AI.layerPenalty(player.y, e.y);
          const depthFactor = clamp((player.y - world.seaLevel) / 800, 0.35, 1.0);
          const chance = clamp(0.10 + base * 0.55 * e.sensitivity * layer * (1.12 - 0.25*depthFactor), 0, 0.80);

          if(Math.random() < chance){
            AI.enemyUpdateContactFromPing(e, player.x, player.y, d);
            detectedBy++;
          } else {
            if(Math.random() < base*0.16) e.suspicion = Math.min(1, e.suspicion + 0.10);
          }
        }
        if(detectedBy>0) setMsg(`PING DETECTED by ${detectedBy} contact(s)!`, 1.6);
        else setMsg("PING: clean (no detection)", 1.2);
      }

      // passive intel blobs (bearings only)
      player.passiveTick -= dt;
      if(player.passiveTick<=0){
        const quietBonus = 1.2 - player.noise*0.85;
        player.passiveTick = rand(0.55, 1.05) / quietBonus;

        for(const e of enemies){
          const dx = AI.wrapDx(player.x, e.x);
          const dy = e.y - player.y;
          const d = Math.hypot(dx,dy);
          const baseRange = 1750;
          if(d > baseRange) continue;

          const layer = AI.layerPenalty(player.y, e.y);
          const signal = e.noise * layer * (1 - d/baseRange);
          const detect = signal - (player.selfMask*0.80);

          const p = clamp(0.07 + detect*0.55 + (e.type==="boat" ? 0.12 : 0.08), 0, 0.65);
          if(Math.random() < p) AI.addContactBlobEnemyForPlayer(e);
        }
      }
    }

    // --- Enemy update (movement + perception + firing) ---
    for(const e of enemies){
      AI.enemyMaybeHearPlayer(e, dt);
      AI.enemyDecay(e, dt);

      const state = (e.suspicion > C.enemy.susEngage) ? "engage" : (e.suspicion > C.enemy.susInvestigate ? "investigate" : "patrol");

      if(e.type==="boat"){
        e.x = wrapX(e.x + e.vx*dt);
        e.y = world.seaLevel - 12 + Math.sin((e.x*0.002)+now())*2;
        e.hitY = world.seaLevel + 14;

        if(state==="patrol"){
          e.vx = clamp(e.vx + Math.sin(now()*0.6 + e.x*0.002)*2*dt, -40, -8);
        } else if(e.contact){
          const dx = AI.wrapDx(e.x, e.contact.x);
          const sweep = Math.sin(now()*1.1 + e.x*0.002) * 16;
          e.vx += clamp((dx*0.0010) + sweep*0.02, -12, 12) * dt;
          e.vx = clamp(e.vx, -60, -10);
        }

        e.fireCd -= dt;
        if(e.fireCd<=0 && !game.over){
          e.fireCd = (state==="engage") ? rand(C.enemy.boatFireEngageMin, C.enemy.boatFireEngageMax) : rand(C.enemy.boatFireOtherMin, C.enemy.boatFireOtherMax);

          if(AI.enemyHasFireSolution(e)){
            const tx = e.contact.x, ty = e.contact.y;
            const dx = AI.wrapDx(e.x, tx);
            const dy = ty - e.y;
            const d = Math.hypot(dx,dy);

            if(ty > world.seaLevel + 120 && d < 1300 && e.contact.u < 900 && (e.contact.strength||0) > 0.55){
              W.dropDepthCharge(e.x + rand(-18,18), e.y + 6, ty, false);
            } else if(d < 1600 && e.contact.u < 900 && (e.contact.strength||0) > 0.55){
              const hx = Math.cos(player.heading||0), hy = Math.sin(player.heading||0);
        const bowX = player.x + hx*(player.r*1.35) - hy*(player.r*0.05);
        const bowY = player.y + hy*(player.r*1.35) + hx*(player.r*0.05);
        W.fireTorpedo(bowX, bowY, c.dx, c.dy, true);
            }
          }
        }

        e.flareCd = Math.max(0, (e.flareCd||0) - dt);
        e.cmCd = Math.max(0, e.cmCd - dt);

      } else {
        // lively subs: pick nav target and move, plus evade state
        e.x = wrapX(e.x + e.vx*dt);
        e.y += e.vy*dt;

        e.vy += Math.sin(now()*1.4 + e.x*0.002)*10*dt;
        applyWaterPhysics(e, dt);
        e.y = clamp(e.y, world.seaLevel + 90, world.ground - 70);

        // nav
        e.navT -= dt;
        if(e.navT <= 0){
          e.navT = rand(2.2, 4.8);
          e.navX = wrapX(e.x + rand(-1100, 1100));
          e.navY = clamp(e.y + rand(-420, 420), world.seaLevel + 140, world.ground - 160);
        }

        // evade burst (already set by torp reactions)
        if(e.evadeT > 0){
          let tx=null, ty=null, best=1e9;
          for(const b of bullets){
            if(b.kind!=="torpedo" || !b.friendly) continue;
            const dx = AI.wrapDx(e.x, b.x);
            const dy = b.y - e.y;
            const d = Math.hypot(dx,dy);
            if(d < best){ best=d; tx=b.x; ty=b.y; }
          }
          if(tx===null && e.evadeFrom){ tx=e.evadeFrom.x; ty=e.evadeFrom.y; }

          if(tx!==null){
            const ax = AI.wrapDx(tx, e.x);
            const ay = (e.y - ty);
            const dd = Math.max(1, Math.hypot(ax,ay));
            e.vx += (ax/dd) * 180 * dt;
            e.vy += (ay/dd) * 180 * dt;
          }
          if(e.evadeDecoy){
            const bx = AI.wrapDx(e.evadeDecoy.x, e.x);
            const by = (e.y - e.evadeDecoy.y);
            const dd = Math.max(1, Math.hypot(bx,by));
            e.vx += (bx/dd) * 120 * dt;
            e.vy += (by/dd) * 120 * dt;
          }
          const vmax = 420;
          const vv = Math.hypot(e.vx, e.vy);
          if(vv > vmax){ e.vx *= vmax/vv; e.vy *= vmax/vv; }
        } else {
          // baseline swim toward nav
          const ndx = AI.wrapDx(e.x, e.navX);
          const ndy = (e.navY - e.y);
          const nd = Math.max(1, Math.hypot(ndx, ndy));
          const nx = ndx/nd, ny = ndy/nd;
          const thrust = (state==="engage") ? 55 : (state==="investigate" ? 42 : 30);
          e.vx += nx * thrust * dt;
          e.vy += ny * thrust * dt;
          e.vx += Math.sin(now()*0.9 + e.x*0.002) * 10 * dt;
          e.vy += Math.cos(now()*1.0 + e.x*0.002) * 8 * dt;

          const vmax = (state==="engage") ? 420 : (state==="investigate" ? 320 : 260);
          const vv = Math.hypot(e.vx, e.vy);
          if(vv > vmax){ e.vx *= vmax/vv; e.vy *= vmax/vv; }
        }

        // occasional enemy ping (reveals itself)
        e.pingCd -= dt;
        if(e.pingCd <= 0 && !game.over){
          e.pingCd = rand(8.0, 14.0);
          const dxp = AI.wrapDx(player.x, e.x);
          const dyp = player.y - e.y;
          const dp = Math.hypot(dxp, dyp);
          if(dp < 2600){
            e.pingPulse = 1.2;
            setDetected(e, C.detection.detectT, C.detection.seenT*0.5);

            // sub improves its own contact on you (reveals itself to do so)
            const u = 170 + dp*0.10;
            e.contact = {
              x: wrapX(player.x + rand(-u,u)),
              y: clamp(player.y + rand(-u,u), world.seaLevel+80, world.ground-80),
              u, t: now(), strength: 0.75
            };
            e.suspicion = Math.min(1, e.suspicion + 0.22);

            // player gets a strong blob near the pinging sub
            const bearing = Math.atan2((e.y - player.y), AI.wrapDx(player.x, e.x));
            contacts.push({ x: wrapX(e.x + rand(-90,90)), y: clamp(e.y + rand(-90,90), world.seaLevel+80, world.ground-80), u:130, life:2.2, bearing });
          }
        }

        // firing
        e.fireCd -= dt;
        if(e.fireCd<=0 && !game.over){
          e.fireCd = (state==="engage") ? rand(C.enemy.subFireEngageMin, C.enemy.subFireEngageMax) : rand(C.enemy.subFireOtherMin, C.enemy.subFireOtherMax);
          if(AI.enemyHasFireSolution(e)){
            const tx = e.contact.x, ty = e.contact.y;
            const dx = AI.wrapDx(e.x, tx);
            const dy = ty - e.y;
            const d = Math.hypot(dx,dy);
            if(d < 1400
            const layer = AI.layerPenalty(player.y, e.y);
            const maxD = (layer < 1) ? 1100 : 1400;
            if(d < maxD && e.contact.u < 1100 && (e.contact.strength||0) > 0.55){
              W.fireTorpedo(e.x, e.y, dx, dy, false);
            }
          }
        }

        e.cmCd = Math.max(0, e.cmCd - dt);
      }
    }

    // Remove dead enemies + respawn
    for(let i=enemies.length-1;i>=0;i--){
      if(enemies[i].dead){ enemies.splice(i,1); AI.spawnEnemy(); }
    }

    // Decoys update (flare arcs + sinking noisemakers)
    for(const d of decoys){
      d.life -= dt;
      d.x = wrapX(d.x + d.vx*dt);
      d.y = d.y + d.vy*dt;

      d.vx *= Math.pow(0.94, dt*60);
      d.vy *= Math.pow(0.94, dt*60);

      if(d.kind==="flare"){
        d.vy += (d.g || C.ship.flareGravity) * dt;
        if(d.y > world.seaLevel - 6 && d.vy > 0){
          W.splash(d.x, world.seaLevel, 0.5);
          d.life = Math.min(d.life, 0.30);
        }
      } else if(d.kind==="noisemaker"){
        if(d.mode==="sink"){
          d.vy += C.ship.sinkExtraG * dt;
          d.vx += Math.sin(now()*0.8 + d.x*0.002) * 10 * dt;
        } else {
          d.vy += 22*dt;
        }
      }
      d.y = clamp(d.y, world.seaLevel - 80, world.ground - 40);
    }
    for(let i=decoys.length-1;i>=0;i--) if(decoys[i].life<=0) decoys.splice(i,1);

    // Contacts update
    for(const c of contacts) c.life -= dt;
    for(let i=contacts.length-1;i>=0;i--) if(contacts[i].life<=0) contacts.splice(i,1);

    // Bullets update + collisions
    for(const b of bullets){
      b.life -= dt;

      if(b.kind==="depthCharge"){
        b.vy = lerp(b.vy, b.sink, 0.08);
        b.x = wrapX(b.x + b.vx*dt);
        b.y += b.vy*dt;

        if(b.y >= b.targetY || b.y >= world.ground - 12){
          W.makeExplosion(b.x, b.y, 1.15, true);

          const dxp = AI.wrapDx(b.x, player.x);
          const dyp = player.y - b.y;
          const dp = Math.hypot(dxp, dyp);
          if(dp < b.blastR) damagePlayer(b.dmg * (1 - dp/b.blastR));

          b.life = 0;
        }
        continue;
      }

      if(b.kind==="torpedo"){
        b.arming = Math.max(0, b.arming - dt);

        if(!b.target || Math.random() < C.torpedo.reacquireChance){
          const t = AI.torpAcquire(b);
          if(t) b.target = t;
        }

        if(b.target && b.arming<=0){
          const tx = b.target.x;
          const ty = (b.target.type==="boat") ? (b.target.hitY ?? b.target.y) : b.target.y;
          const dx = AI.wrapDx(b.x, tx);
          const dy = ty - b.y;

          const desired = Math.atan2(dy, dx);
          const cur = Math.atan2(b.vy, b.vx);
          let dAng = angleNorm(desired - cur);

          const maxTurn = b.turnRate * dt;
          dAng = clamp(dAng, -maxTurn, maxTurn);
          const newAng = cur + dAng;

          const speed = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(newAng) * speed;
          b.vy = Math.sin(newAng) * speed;
        }

        const s = Math.hypot(b.vx, b.vy);
        const ns = lerp(s, C.torpedo.speed, 0.08);
        const ang = Math.atan2(b.vy, b.vx);
        b.vx = Math.cos(ang)*ns;
        b.vy = Math.sin(ang)*ns;

        b.x = wrapX(b.x + b.vx*dt);
        b.y += b.vy*dt;

        if(b.y > world.ground - 10){ W.makeExplosion(b.x, world.ground - 10, 0.9, true); b.life = 0; }

      } else if(b.kind==="missile"){
        b.x = wrapX(b.x + b.vx*dt);
        b.y += b.vy*dt;

        if(b.phase==="vertical"){
          if(b.y < world.seaLevel - 30){
            b.tipDelay -= dt;
            if(b.tipDelay<=0){
              b.phase = "cruise";
              W.splash(b.x, world.seaLevel, 0.7);

              // lock only detected boats
              let best=null, bestD=1e9;
              for(const e of enemies){
                if(e.type!=="boat") continue;
                if((e.detectedT||0) <= 0) continue;
                const dx = AI.wrapDx(b.x, e.x);
                const dy = e.y - b.y;
                const d = Math.hypot(dx,dy);
                if(d < bestD){ bestD=d; best=e; }
              }
              b.lock = best;
              b.vx = 0; b.vy = -240;
            }
          }
        } else {
          b.y = Math.min(b.y, world.seaLevel - 14);

          if(!b.lock || b.lock.dead || b.lock.hp<=0 || b.lock.type!=="boat"){
            let best=null, bestD=1e9;
            for(const e of enemies){
              if(e.type!=="boat") continue;
              if((e.detectedT||0) <= 0) continue;
              const dx = AI.wrapDx(b.x, e.x);
              const dy = e.y - b.y;
              const d = Math.hypot(dx,dy);
              if(d < bestD){ bestD=d; best=e; }
            }
            b.lock = best;
          }

          // flare divert
          let flareTarget=null, flareD=1e9;
          for(const d of decoys){
            if(d.kind!=="flare" || d.friendly !== false) continue;
            const dx = AI.wrapDx(b.x, d.x);
            const dy = d.y - b.y;
            const dist = Math.hypot(dx,dy);
            if(dist < flareD){ flareD=dist; flareTarget=d; }
          }
          const canSeeFlare = flareTarget && flareD < 520;
          if(canSeeFlare && Math.random() < clamp(0.15 + (1 - flareD/520)*0.55, 0, 0.75)) b.lock = flareTarget;

          if(b.lock){
            const tx = b.lock.x;
            const ty = b.lock.y;
            const dx = AI.wrapDx(b.x, tx);
            const dy = ty - b.y;

            const desired = Math.atan2(dy, dx);
            const cur = Math.atan2(b.vy, b.vx);
            let dAng = angleNorm(desired - cur);
            const maxTurn = C.missile.maxTurn * dt;
            dAng = clamp(dAng, -maxTurn, maxTurn);
            const a = cur + dAng;

            b.vx = Math.cos(a) * b.speed;
            b.vy = Math.sin(a) * b.speed;

            // CIWS (boats defend themselves when missile is near)
            if(b.lock.type==="boat"){
              const ship = b.lock;
              const dist = Math.hypot(AI.wrapDx(ship.x, b.x), (b.y - (world.seaLevel - 14)));
              if(dist < ship.cwis.range){
                const bursts = C.ship.tracerBurstsMin + ((Math.random()*(C.ship.tracerBurstsMax-C.ship.tracerBurstsMin+1))|0);
                for(let i=0;i<bursts;i++){
                  const sx = ship.x;
                  const sy = world.seaLevel - 14;
                  const dxSM = AI.wrapDx(sx, b.x);
                  const dySM = (b.y - sy);
                  const spread = C.ship.tracerSpread;
                  const ax = dxSM + rand(-Math.abs(dxSM)*spread, Math.abs(dxSM)*spread);
                  const ay = dySM + rand(-Math.abs(dySM+80)*spread, Math.abs(dySM+80)*spread);
                  const ex = sx + ax*0.85;
                  const ey = sy + ay*0.85;
                  cwisTracers.push({ x1:sx, y1:sy, x2:ex, y2:ey, life: rand(C.ship.tracerLifeMin, C.ship.tracerLifeMax) });
                }

                const pk = ship.cwis.pKillPerSec * dt;
                if(Math.random() < pk){
                  W.makeExplosion(b.x, b.y, 0.9, false);
                  W.splash(b.x, world.seaLevel, 0.9);
                  b.life = 0;
                }
              }
            }

            // impact
            const hitR = 24;
            if(Math.hypot(dx, dy) < hitR){
              if(b.lock.kind==="flare"){
                W.makeExplosion(b.x, b.y, 0.8, false);
                b.life = 0;
              } else if(b.lock.type==="boat"){
                W.makeExplosion(b.x, world.seaLevel - 8, 2.1, false);
                W.splash(b.x, world.seaLevel, 1.6);

                // AoE only damages detected enemies
                const R = 210;
                for(const e of enemies){
                  if((e.detectedT||0) <= 0) continue;
                  const dx2 = AI.wrapDx(b.x, e.x);
                  const dy2 = e.y - (world.seaLevel - 8);
                  const d2 = Math.hypot(dx2, dy2);
                  if(d2 < R) damageEnemy(e, b.dmg * (1 - d2/R));
                }
                b.life = 0;
              }
            }
          } else {
            b.vy = -120;
            b.vx *= 0.98;
          }
        }
      }

      // torp bounds
      if(b.kind==="torpedo"){
        if(b.y < world.seaLevel){ W.splash(b.x, world.seaLevel, 0.5); b.life = 0; }
        else b.y = clamp(b.y, world.seaLevel + 40, world.ground - 10);
      }

      // torp collisions (player torps cannot damage undetected enemies)
      if(b.life>0 && b.kind==="torpedo" && b.arming<=0){
        if(b.friendly){
          for(const e of enemies){
            if((e.detectedT||0) <= 0) continue;
            const dx = AI.wrapDx(b.x, e.x);
            const ey = (e.type==="boat") ? (e.hitY ?? e.y) : e.y;
            const dy = ey - b.y;
            if(Math.hypot(dx,dy) < e.r + b.r){ damageEnemy(e, b.dmg); b.life = 0; break; }
          }
        } else {
          const dx = AI.wrapDx(b.x, player.x);
          const dy = player.y - b.y;
          if(Math.hypot(dx,dy) < player.r + b.r){ damagePlayer(24); b.life = 0; }
        }

        // torp vs opposite noisemaker
        if(b.life>0){
          for(const d of decoys){
            if(d.kind!=="noisemaker") continue;
            if(b.friendly && d.friendly) continue;
            if(!b.friendly && !d.friendly) continue;
            const dx = AI.wrapDx(b.x, d.x);
            const dy = d.y - b.y;
            if(Math.hypot(dx,dy) < d.r + b.r){ W.makeExplosion(b.x, b.y, 0.8, true); b.life = 0; break; }
          }
        }
      }

      // Enemy reaction to incoming player torps (subs react even if they haven't "seen" player)
      if(b.life>0 && b.kind==="torpedo" && b.friendly){
        for(const e of enemies){
          const subReactive = (e.type==="sub");
          const dx = AI.wrapDx(e.x, b.x);
          const dy = b.y - e.y;
          const d = Math.hypot(dx,dy);
          const trig = subReactive ? C.enemy.subTorpReactR : C.enemy.boatTorpReactR;
          if(d >= trig) continue;

          if(!subReactive && e.suspicion < 0.35) continue;

          e.suspicion = Math.min(1, e.suspicion + (subReactive ? 0.25 : 0.12));
          e.evadeT = Math.max(e.evadeT||0, rand(1.4, 2.4));
          e.evadeFrom = { x: b.x, y: b.y };

          if(e.cmCd<=0){
            e.cmCd = rand(3.0, 6.0);
            const decX = wrapX(e.x + rand(-20,20));
            const decY = clamp(e.y + rand(-20,20), world.seaLevel+80, world.ground-60);

            if(e.type==="boat"){
              W.deployDecoy(decX, world.seaLevel+90, false, "noisemaker", { vx: rand(C.ship.sinkVxMin, C.ship.sinkVxMax), vy: rand(C.ship.sinkVyMin, C.ship.sinkVyMax), mode:"sink" });
            } else {
              W.deployDecoy(decX, decY, false, "noisemaker");
            }
            e.evadeDecoy = { x: decX, y: decY };
          }

          const u = 220 + d*0.20;
          e.contact = { x: wrapX(b.x + rand(-u,u)), y: clamp(b.y + rand(-u,u), world.seaLevel+80, world.ground-80), u, t: now(), strength: 0.55 };
        }
      }

      // ships auto flares when friendly missile nearby (burst + big arc)
      if(b.life>0 && b.kind==="missile" && b.friendly){
        for(const e of enemies){
          if(e.type!=="boat") continue;
          if((e.flareCd||0)>0) continue;
          const dx = AI.wrapDx(e.x, b.x);
          const dy = (e.y - (world.seaLevel - 14));
          const d = Math.hypot(dx,dy);
          if(d < 720){
            e.flareCd = rand(3.0, 5.2);

            const n = C.ship.flareBurst;
            for(let i=0;i<n;i++){
              const side = (i - (n-1)/2);
              const vx = rand(-40,40) + side*C.ship.flareSideSpread;
              const vy = -rand(C.ship.flareVyMin, C.ship.flareVyMax);
              W.deployDecoy(wrapX(e.x + rand(-18,18)), world.seaLevel - 18, false, "flare", { vx, vy, mode:"flareArc", g: C.ship.flareGravity });
            }
          }
        }
      }
    }
    for(let i=bullets.length-1;i>=0;i--) if(bullets[i].life<=0) bullets.splice(i,1);

    // Particles
    for(const p of particles){
      p.life -= dt;
      p.x = wrapX(p.x + p.vx*dt);
      p.y += p.vy*dt;
      p.vx *= Math.pow(0.88, dt*60);
      p.vy *= Math.pow(0.88, dt*60);
      if(p.y < world.seaLevel) p.vy += 300*dt;
    }
    for(let i=particles.length-1;i>=0;i--) if(particles[i].life<=0) particles.splice(i,1);

    // CIWS tracers decay
    for(const t of cwisTracers) t.life -= dt;
    for(let i=cwisTracers.length-1;i>=0;i--) if(cwisTracers[i].life<=0) cwisTracers.splice(i,1);

    // camera follow
    cam.x = wrapX(player.x - canvas.width*C.camera.followX);
    cam.y = clamp(player.y - canvas.height*C.camera.followY, 0, world.h - canvas.height);
  }

  window.SIM = { update, damagePlayer, damageEnemy, reset };
})();
