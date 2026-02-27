// physics.js — water physics + update systems (movement/bullets/particles/etc.)
(() => {
  'use strict';
  // CONFIG safety: allow running even if config.js is missing
  window.CONFIG = window.CONFIG || {};


    window.applyWaterPhysics = (obj, dt)=>{
    const drag = 0.92;
    obj.vx *= Math.pow(drag, dt*60);
    obj.vy *= Math.pow(drag, dt*60);
    obj.vx += Math.sin((obj.y*0.003) + now()*0.6) * 6 * dt;
  };

  window.updateSystems = (dt)=>{
    // cooldowns / timers
    player.torpCd = Math.max(0, player.torpCd - dt);
    player.missCd = Math.max(0, player.missCd - dt);
    player.sonarCd = Math.max(0, player.sonarCd - dt);
    player.invuln = Math.max(0, player.invuln - dt);
    player.sonarPulse = Math.max(0, player.sonarPulse - dt);
    player.cmCd = Math.max(0, player.cmCd - dt);

    stealthMsgT = Math.max(0, stealthMsgT - dt);
    if(stealthMsgT<=0) stealthMsg="";

    // --- Enemies ---
    for(const e of enemies){
      if(e.seen>0) e.seen -= dt;
      if(e.detectedT>0) e.detectedT = Math.max(0, e.detectedT - dt);
      if(e.pingPulse){ e.pingPulse = Math.max(0, e.pingPulse - dt); }

      enemyMaybeHearPlayer(e, dt);
      enemyDecay(e, dt);

      const state = (e.suspicion > 0.70) ? "engage" : (e.suspicion > 0.30 ? "investigate" : "patrol");

      // Evasion timer (enemy subs use this when dodging torpedoes)
      if(e.evadeT){
        e.evadeT = Math.max(0, e.evadeT - dt);
        if(e.evadeT<=0){ e.evadeFrom = null; e.evadeDecoy = null; }
      }
      if(e.type==="boat"){
        // fallback contact (boats): keep hunting if suspicious and within broad range
        if((state==="engage" || state==="investigate") && !e.contact){
          const dxp = wrapDx(e.x, player.x);
          const dyp = player.y - e.y;
          const dd = Math.hypot(dxp, dyp);
          if(dd < 2400){
            const u = 520 + dd*0.10;
            e.contact = { x:(player.x + rand(-u,u) + world.w)%world.w, y:clamp(player.y + rand(-u,u), world.seaLevel+80, world.ground-80), u, t:now(), strength:0.55 };
            e.suspicion = Math.min(1, e.suspicion + 0.08);
          }
        }
        // aggressive fallback contact: if highly suspicious but lost contact, keep hunting last-known area
        if(state==="engage" && !e.contact){
          const dxp = wrapDx(e.x, player.x);
          const dyp = player.y - e.y;
          const d = Math.hypot(dxp, dyp);
          if(d < 2000){
            const u = 480 + d*0.10;
            e.contact = { x:(player.x + rand(-u,u) + world.w)%world.w, y:clamp(player.y + rand(-u,u), world.seaLevel+80, world.ground-80), u, t:now(), strength:0.6 };
          }
        }
        e.x = (e.x + e.vx*dt + world.w) % world.w;
        e.y = world.seaLevel - 12 + Math.sin((e.x*0.002)+now())*2;

        if(state==="patrol"){
          e.vx = clamp(e.vx + Math.sin(now()*0.6 + e.x*0.002)*2*dt, -40, -8);
        } else if(e.contact){
          const dx = wrapDx(e.x, e.contact.x);
          const sweep = Math.sin(now()*1.1 + e.x*0.002) * 16;
          e.vx += clamp((dx*0.0010) + sweep*0.02, -12, 12) * dt;
          e.vx = clamp(e.vx, -60, -10);
        }

        e.fireCd -= dt;
        if(e.fireCd<=0 && !gameOver){
          e.fireCd = (state==="engage") ? rand(0.65, 1.15) : rand(1.9, 3.2);

          if(enemyHasFireSolution(e)){
            const tx = e.contact.x;
            const ty = e.contact.y;
            const dx = wrapDx(e.x, tx);
            const dy = ty - e.y;
            const d = Math.hypot(dx,dy);

            if(ty > world.seaLevel + 120 && d < 1900 && e.contact.u < 2200){
              dropDepthCharge(e.x + rand(-18,18), e.y + 6, ty, false);
            } else if(d < 2200 && e.contact.u < 2200){
              fireTorpedo(e.x, e.y+10, dx, dy+140, false);
            }
          }
        }

        e.flareCd = Math.max(0, (e.flareCd||0) - dt);
        e.cmCd = Math.max(0, e.cmCd - dt);

      } else {
        e.x = (e.x + e.vx*dt + world.w) % world.w;
        e.y += e.vy*dt;

        e.vy += Math.sin(now()*1.4 + e.x*0.002)*10*dt;
        applyWaterPhysics(e, dt);
        e.y = clamp(e.y, world.seaLevel + 90, world.ground - 70);



        // --- Lively sub behaviour: pick nav targets and keep moving ---
        if(e.navT === undefined){
          e.navT = rand(1.0, 3.0);
          e.navX = e.x;
          e.navY = e.y;
        }
        e.navT -= dt;
        if(e.navT <= 0){
          e.navT = rand(2.2, 4.8);
          e.navX = (e.x + rand(-1100, 1100) + world.w) % world.w;
          e.navY = clamp(e.y + rand(-420, 420), world.seaLevel + 140, world.ground - 160);
        }

        // Baseline thrust toward nav target (unless evading)
        if(!(e.evadeT && e.evadeT > 0)){
          const ndx = wrapDx(e.x, e.navX);
          const ndy = (e.navY - e.y);
          const nd = Math.max(1, Math.hypot(ndx, ndy));
          const nx = ndx/nd;
          const ny = ndy/nd;

          const thrust = (state==="engage") ? 55 : (state==="investigate" ? 42 : 30);
          e.vx += nx * thrust * dt;
          e.vy += ny * thrust * dt;

          // serpentine swim
          e.vx += Math.sin(now()*0.9 + e.x*0.002) * 10 * dt;
          e.vy += Math.cos(now()*1.0 + e.x*0.002) * 8 * dt;

          // higher sustained speed caps so they feel alive
          const vmax = (state==="engage") ? 420 : (state==="investigate" ? 320 : 260);
          const v = Math.hypot(e.vx, e.vy);
          if(v > vmax){ e.vx *= vmax/v; e.vy *= vmax/v; }
        }

        // Occasional active ping (reveals itself but improves its contact)
        if(e.pingPulse === undefined) e.pingPulse = 0;
        if(e.pingCd === undefined) e.pingCd = rand(5.0, 10.0);
        e.pingCd -= dt;
        if(e.pingCd <= 0 && !gameOver){
          e.pingCd = rand(8.0, 14.0);
          const dxp = wrapDx(player.x, e.x);
          const dyp = player.y - e.y;
          const dp = Math.hypot(dxp, dyp);
          if(dp < 2600){
            e.pingPulse = 1.2;
            e.seen = Math.max(e.seen || 0, 2.2);

            // improve its contact solution (at the cost of revealing)
            const u = 170 + dp*0.10;
            e.contact = {
              x: (player.x + rand(-u,u) + world.w) % world.w,
              y: clamp(player.y + rand(-u,u), world.seaLevel+80, world.ground-80),
              u, t: now(), strength: 0.75
            };
            e.suspicion = Math.min(1, e.suspicion + 0.22);

            // player gets a strong blob near the pinging sub
            const bearing = Math.atan2((e.y - player.y), wrapDx(player.x, e.x));
            contacts.push({
              x: (e.x + rand(-90,90) + world.w) % world.w,
              y: clamp(e.y + rand(-90,90), world.seaLevel+80, world.ground-80),
              u: 130,
              life: 2.2,
              bearing
            });
          }
        }
        // Evasion burst: if we recently dropped a decoy, sprint away from torpedoes/decoy
        if(e.evadeT && e.evadeT > 0){
          let tx=null, ty=null, best=1e9;
          for(const b of bullets){
            if(b.kind!=="torpedo" || !b.friendly) continue;
            const dx = wrapDx(e.x, b.x);
            const dy = b.y - e.y;
            const d = Math.hypot(dx,dy);
            if(d < best){ best=d; tx=b.x; ty=b.y; }
          }
          if(tx===null && e.evadeFrom){ tx = e.evadeFrom.x; ty = e.evadeFrom.y; }

          if(tx!==null){
            const ax = wrapDx(tx, e.x);
            const ay = (e.y - ty);
            const d = Math.max(1, Math.hypot(ax,ay));
            e.vx += (ax/d) * 180 * dt;
            e.vy += (ay/d) * 180 * dt;
          }

          if(e.evadeDecoy){
            const bx = wrapDx(e.evadeDecoy.x, e.x);
            const by = (e.y - e.evadeDecoy.y);
            const d2 = Math.max(1, Math.hypot(bx,by));
            e.vx += (bx/d2) * 120 * dt;
            e.vy += (by/d2) * 120 * dt;
          }

          const vmax = 420;
          const v = Math.hypot(e.vx, e.vy);
          if(v > vmax){ e.vx *= vmax/v; e.vy *= vmax/v; }
        }
        if(!gameOver){
          if(state==="patrol"){
            e.vx += Math.sin(now()*0.5 + e.x*0.002)*10*dt;
            e.vy += Math.cos(now()*0.7 + e.x*0.002)*7*dt;
          } else if(e.contact){
            const dx = wrapDx(e.x, e.contact.x);
            const dy = e.contact.y - e.y;
            const d = Math.hypot(dx,dy);
            if(d > 1){
              const approach = clamp(d/520, 0, 1);
              const orbitAng = Math.sin(now()*1.2 + e.x*0.003) * 0.9;
              const dirX = (dx/d) * approach + Math.cos(orbitAng) * (1-approach) * 0.6;
              const dirY = (dy/d) * approach + Math.sin(orbitAng) * (1-approach) * 0.6;
              e.vx += clamp(dirX, -1, 1) * (state==="engage" ? 34 : 20) * dt;
              e.vy += clamp(dirY, -1, 1) * (state==="engage" ? 26 : 14) * dt;
            }
          }
        }

        e.fireCd -= dt;
        if(e.fireCd<=0 && !gameOver){
          e.fireCd = (state==="engage") ? rand(0.60, 1.10) : rand(2.3, 4.0);

          if(enemyHasFireSolution(e)){
            const tx = e.contact.x;
            const ty = e.contact.y;
            const dx = wrapDx(e.x, tx);
            const dy = ty - e.y;
            const d = Math.hypot(dx,dy);
            if(d < 1800 && e.contact.u < 1400){
              fireTorpedo(e.x, e.y, dx, dy, false);
            }
          }
        }

        e.cmCd = Math.max(0, e.cmCd - dt);
      }
    }

    // remove dead + respawn
    for(let i=enemies.length-1;i>=0;i--){
      if(enemies[i].dead){ enemies.splice(i,1); spawnEnemy(); }
    }

    // decoys
    for(const d of decoys){
      d.life -= dt;

      // integrate
      d.x = (d.x + d.vx*dt + world.w) % world.w;
      d.y = d.y + d.vy*dt;

      // drag
      d.vx *= Math.pow(0.94, dt*60);
      d.vy *= Math.pow(0.94, dt*60);

      if(d.kind==="flare"){
        // ballistic flare arc (above water) then splash out
        const g = d.g || 820;
        d.vy += g*dt;

        // once it falls back to the sea, splash and fade
        if(d.y > world.seaLevel - 6 && d.vy > 0){
          splash(d.x, world.seaLevel, 0.5);
          d.life = Math.min(d.life, 0.30);
        }
      } else if(d.kind==="noisemaker"){
        // noisemakers sink; ships deploy them so they drift away and down
        if(d.mode==="sink"){
          d.vy += 60*dt;
          d.vx += Math.sin(now()*0.8 + d.x*0.002) * 10 * dt;
        } else {
          d.vy += 22*dt;
        }
      }

      d.y = clamp(d.y, world.seaLevel - 80, world.ground - 40);
    }
    for(let i=decoys.length-1;i>=0;i--) if(decoys[i].life<=0) decoys.splice(i,1);

    // contacts
    for(const c of contacts) c.life -= dt;
    for(let i=contacts.length-1;i>=0;i--) if(contacts[i].life<=0) contacts.splice(i,1);

    // bullets
    for(const b of bullets){
      b.life -= dt;

      if(b.kind==="depthCharge"){
        b.vy = lerp(b.vy, b.sink, 0.08);
        b.x = (b.x + b.vx*dt + world.w) % world.w;
        b.y += b.vy*dt;

        if(b.y >= b.targetY || b.y >= world.ground - 12){
          makeExplosion(b.x, b.y, 1.15, true);

          const dxp = wrapDx(b.x, player.x);
          const dyp = player.y - b.y;
          const dp = Math.hypot(dxp, dyp);
          if(dp < b.blastR) damagePlayer(b.dmg * (1 - dp/b.blastR));

          for(const e of enemies){
            const dxe = wrapDx(b.x, e.x);
            const dye = e.y - b.y;
            const de = Math.hypot(dxe, dye);
            if(de < b.blastR*0.85) damageEnemy(e, 10 * (1 - de/(b.blastR*0.85)));
          }
          b.life = 0;
        }
        continue;
      }

      if(b.kind==="torpedo"){
        b.arming = Math.max(0, b.arming - dt);

        if(!b.target || Math.random()<CONFIG.torpedo.reacquireChance){
          const t = torpAcquire(b);
          if(t) b.target = t;
        }

        if(b.target && b.arming<=0){
          const tx = b.target.x;
          const ty = b.target.y;
          const dx = wrapDx(b.x, tx);
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
        const ns = lerp(s, 620, 0.08);
        const ang = Math.atan2(b.vy, b.vx);
        b.vx = Math.cos(ang)*ns;
        b.vy = Math.sin(ang)*ns;

        b.x = (b.x + b.vx*dt + world.w) % world.w;
        b.y += b.vy*dt;

        if(b.y > world.ground - 10){ makeExplosion(b.x, world.ground - 10, 0.9, true); b.life = 0; }

      } else if(b.kind==="missile"){
        b.x = (b.x + b.vx*dt + world.w) % world.w;
        b.y += b.vy*dt;

        if(b.phase==="vertical"){
          if(b.y < world.seaLevel - 30){
            b.tipDelay -= dt;
            if(b.tipDelay<=0){
              b.phase = "cruise";
              splash(b.x, world.seaLevel, 0.7);

              let best=null, bestD=1e9;
              for(const e of enemies){
              if(e.type!=="boat") continue;
              if((e.detectedT||0) <= 0) continue;
                if((e.detectedT||0) <= 0) continue;
                const dx = wrapDx(b.x, e.x);
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
              const dx = wrapDx(b.x, e.x);
              const dy = e.y - b.y;
              const d = Math.hypot(dx,dy);
              if(d < bestD){ bestD=d; best=e; }
            }
            b.lock = best;
          }

          let flareTarget=null, flareD=1e9;
          for(const d of decoys){
            if(d.kind!=="flare" || d.friendly !== false) continue;
            const dx = wrapDx(b.x, d.x);
            const dy = d.y - b.y;
            const dist = Math.hypot(dx,dy);
            if(dist < flareD){ flareD=dist; flareTarget=d; }
          }
          const canSeeFlare = flareTarget && flareD < 520;
          if(canSeeFlare && Math.random() < clamp(0.15 + (1 - flareD/520)*0.55, 0, 0.75)) b.lock = flareTarget;

          if(b.lock){
            const tx = b.lock.x;
            const ty = b.lock.y;
            const dx = wrapDx(b.x, tx);
            const dy = ty - b.y;

            const desired = Math.atan2(dy, dx);
            const cur = Math.atan2(b.vy, b.vx);
            let dAng = angleNorm(desired - cur);
            const maxTurn = 3.2 * dt;
            dAng = clamp(dAng, -maxTurn, maxTurn);
            const a = cur + dAng;

            b.vx = Math.cos(a) * b.speed;
            b.vy = Math.sin(a) * b.speed;

            if(b.lock.type==="boat"){
              const ship = b.lock;
              const dist = Math.hypot(wrapDx(ship.x, b.x), (b.y - (world.seaLevel - 14)));
              if(dist < ship.cwis.range){
                // visual CIWS stream
                const bursts = CONFIG.ship.cwisTracerBurstsMin + ((Math.random()*(CONFIG.ship.cwisTracerBurstsMax-CONFIG.ship.cwisTracerBurstsMin+1))|0);
                for(let i=0;i<bursts;i++){
                  const sx = ship.x;
                  const sy = world.seaLevel - 14;

                  // Ship -> missile (unwrapped) so tracers always go the right way
                  const dxSM = wrapDx(sx, b.x);
                  const dySM = (b.y - sy);

                  // aim with slight spread so some miss
                  const spread = CONFIG.ship.cwisTracerSpread;
                  const ax = dxSM + rand(-Math.abs(dxSM)*spread, Math.abs(dxSM)*spread);
                  const ay = dySM + rand(-Math.abs(dySM+80)*spread, Math.abs(dySM+80)*spread);

                  // endpoint ~85% of the way to the missile (don't modulo; keep local)
                  const ex = sx + ax*0.85;
                  const ey = sy + ay*0.85;

                  window.cwisTracers.push({ x1:sx, y1:sy, x2:ex, y2:ey, life: rand(CONFIG.ship.cwisTracerLifeMin, CONFIG.ship.cwisTracerLifeMax) });
                }

                const pk = ship.cwis.pKillPerSec * dt;
                if(Math.random() < pk){
                  makeExplosion(b.x, b.y, 0.9, false);
                  splash(b.x, world.seaLevel, 0.9);
                  b.life = 0;
                }
              }}

            const hitR = 24;
            if(Math.hypot(dx, dy) < hitR){
              if(b.lock.kind==="flare"){
                makeExplosion(b.x, b.y, 0.8, false);
                b.life = 0;
              } else if(b.lock.type==="boat"){
                makeExplosion(b.x, world.seaLevel - 8, 2.1, false);
                splash(b.x, world.seaLevel, 1.6);
                const R = 210;
                for(const e of enemies){
                  if((e.detectedT||0) <= 0) continue;
                  const dx2 = wrapDx(b.x, e.x);
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

      if(b.kind!=="missile" && b.kind!=="depthCharge"){
        if(b.y < world.seaLevel){ splash(b.x, world.seaLevel, 0.5); b.life = 0; }
        else b.y = clamp(b.y, world.seaLevel + 40, world.ground - 10);
      }

      if(b.life>0 && b.kind==="torpedo" && b.arming<=0){
        if(b.friendly){
          for(const e of enemies){
            if((e.detectedT||0) <= 0) continue;
            const dx = wrapDx(b.x, e.x);
            const dy = e.y - b.y;
            if(Math.hypot(dx,dy) < e.r + b.r){ damageEnemy(e, b.dmg); b.life = 0; break; }
          }
        } else {
          const dx = wrapDx(b.x, player.x);
          const dy = player.y - b.y;
          if(Math.hypot(dx,dy) < player.r + b.r){ damagePlayer(24); b.life = 0; }
        }

        if(b.life>0){
          for(const d of decoys){
            if(d.kind!=="noisemaker") continue;
            if(b.friendly && d.friendly) continue;
            if(!b.friendly && !d.friendly) continue;
            const dx = wrapDx(b.x, d.x);
            const dy = d.y - b.y;
            if(Math.hypot(dx,dy) < d.r + b.r){ makeExplosion(b.x, b.y, 0.8, true); b.life = 0; break; }
          }
        }
      }

      if(b.life>0 && b.kind==="torpedo" && b.friendly){
        for(const e of enemies){
          if(e.cmCd>0) continue;
          if(e.suspicion < 0.35) continue;
          const dx = wrapDx(e.x, b.x);
          const dy = b.y - e.y;
          const d = Math.hypot(dx,dy);
          if(d < (e.type==="sub" ? 520 : 260)){
            e.cmCd = rand(3.0, 6.0);
            const decX = (e.x + rand(-20,20) + world.w) % world.w;
            const decY = clamp(e.y + rand(-20,20), world.seaLevel+80, world.ground-60);
            deployDecoy(decX, decY, false, "noisemaker");
            // Evade so we don't sit on top of our own decoy
            e.evadeT = rand(1.4, 2.2);
            e.evadeFrom = { x: b.x, y: b.y };
            e.evadeDecoy = { x: decX, y: decY };
            {
              const ax = wrapDx(decX, e.x);
              const ay = (e.y - decY);
              const d = Math.max(1, Math.hypot(ax, ay));
              e.vx += (ax/d) * 120;
              e.vy += (ay/d) * 120;
            }
}
        }
      }

      if(b.life>0 && b.kind==="missile" && b.friendly){
        for(const e of enemies){
          if(e.type!=="boat") continue;
          if((e.flareCd||0)>0) continue;
          const dx = wrapDx(e.x, b.x);
          const dy = (e.y - (world.seaLevel - 14));
          const d = Math.hypot(dx,dy);
          if(d < 620){
            e.flareCd = rand(2.4, 4.8);
            deployDecoy((e.x + rand(-20,20) + world.w) % world.w, world.seaLevel - 18, false, "flare");
          }
        }
      }
    }
    for(let i=bullets.length-1;i>=0;i--) if(bullets[i].life<=0) bullets.splice(i,1);

    // pickups
    for(const p of pickups){
      p.t += dt;
      p.y += Math.sin(p.t*3)*0.2;
      const dx = wrapDx(player.x, p.x);
      const dy = player.y - p.y;
      const d = Math.hypot(dx,dy);
      if(d < player.r + p.r){
        if(p.kind==="hp") player.hp = Math.min(100, player.hp + 22);
        if(p.kind==="ammo"){ player.torpCd = Math.max(0, player.torpCd - 0.12); player.missCd = Math.max(0, player.missCd - 0.35); score += 30; }
        p.dead = true;
      }
    }
    for(let i=pickups.length-1;i>=0;i--) if(pickups[i].dead) pickups.splice(i,1);

    // particles
    for(const p of particles){
      p.life -= dt;
      p.x = (p.x + p.vx*dt + world.w) % world.w;
      p.y += p.vy*dt;
      p.vx *= Math.pow(0.88, dt*60);
      p.vy *= Math.pow(0.88, dt*60);
      if(p.y < world.seaLevel) p.vy += 300*dt;
    }
    for(let i=particles.length-1;i>=0;i--) if(particles[i].life<=0) particles.splice(i,1);


    // CIWS tracers
    for(const t of window.cwisTracers) t.life -= dt;
    for(let i=window.cwisTracers.length-1;i>=0;i--) if(window.cwisTracers[i].life<=0) window.cwisTracers.splice(i,1);
    // camera follow
    cam.x = (player.x - canvas.width*0.45 + world.w) % world.w;
    cam.y = clamp(player.y - canvas.height*0.55, 0, world.h - canvas.height);
  };
})();
