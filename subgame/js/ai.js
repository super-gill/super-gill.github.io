(() => {
  'use strict';
  const C = window.CONFIG;
  const { rand, clamp, now, angleNorm } = window.M;
  const { world, player, enemies, decoys, contacts } = window.G;

  function inLayer(y){ return y >= world.layerY1 && y <= world.layerY2; }
  function layerPenalty(y1,y2){
    const a = inLayer(y1), b = inLayer(y2);
    return (a !== b) ? 0.70 : 1.0;
  }
  function wrapDx(x1,x2){
    let dx = x2 - x1;
    if(dx > world.w/2) dx -= world.w;
    if(dx < -world.w/2) dx += world.w;
    return dx;
  }

  function enemyHasFireSolution(e){
    if(!e.contact) return false;
    const age = now() - e.contact.t;
    if(age > C.enemy.fireMaxAge) return false;
    if(e.suspicion < C.enemy.fireMinSus) return false;
    return (e.contact.strength||0) > 0.45;
  }

  function enemyUpdateContactFromPing(e, px, py, dist){
    const layer = layerPenalty(py, e.y);
    const u = (120 + dist*0.09) * (layer < 1 ? 1.25 : 1.0);
    e.contact = {
      x: (px + rand(-u,u) + world.w) % world.w,
      y: clamp(py + rand(-u,u), world.seaLevel+80, world.ground-80),
      u, t: now(),
      strength: clamp(0.55 + (1 - dist/1850)*0.45, 0.25, 1.0)
    };
    e.suspicion = Math.min(1, e.suspicion + 0.70 * e.contact.strength);
  }

  function enemyMaybeHearPlayer(e, dt){
    const dx = wrapDx(e.x, player.x);
    const dy = player.y - e.y;
    const d = Math.hypot(dx,dy);
    const baseRange = (e.type==="boat") ? C.enemy.hearBoatRange : C.enemy.hearSubRange;
    if(d > baseRange) return;

    const layer = layerPenalty(player.y, e.y);
    const signal = player.noise * layer * (1 - d/baseRange);
    if(signal < C.enemy.hearSignalMin) return;

    const p = clamp((signal - C.enemy.hearPBase) * C.enemy.hearPScale, 0, 1.0);
    if(Math.random() < p * dt){
      const u = (190 + d*0.12) * (layer < 1 ? 1.25 : 1.0);
      e.contact = {
        x: (player.x + rand(-u,u) + world.w) % world.w,
        y: clamp(player.y + rand(-u,u), world.seaLevel+80, world.ground-80),
        u, t: now(),
        strength: clamp(0.28 + signal*0.82, 0.25, 0.95)
      };
      e.suspicion = Math.min(1, e.suspicion + 0.30 * e.contact.strength);
    }
  }

  function enemyDecay(e, dt){
    const quiet = (player.noise < C.enemy.quietNoiseThreshold);
    e.suspicion = Math.max(0, e.suspicion - (C.enemy.susDecayBase + (quiet ? C.enemy.susDecayQuietExtra : 0)) * dt);

    if(e.contact){
      const age = now() - e.contact.t;
      if(age > C.enemy.contactMaxAge || (quiet && age > C.enemy.contactMaxAgeQuiet)) e.contact = null;
    }
  }

  function addContactBlobEnemyForPlayer(e){
    const dx = wrapDx(player.x, e.x);
    const dy = e.y - player.y;
    const bearing = Math.atan2(dy, dx);
    const dist = Math.hypot(dx, dy);
    let baseU = 70 + dist*0.08;
    // Surface ships are easier to localize (tighter blob)
    if(e.type==="boat") baseU *= (CONFIG.ship.shipBlobUncertaintyMult || 0.75);
    const u = baseU * (1 + player.selfMask*1.2);

    contacts.push({
      x: (player.x + Math.cos(bearing)*Math.min(dist, 900) + rand(-u,u) + world.w) % world.w,
      y: clamp(player.y + Math.sin(bearing)*Math.min(dist, 900) + rand(-u,u), world.seaLevel + 80, world.ground - 80),
      u, life: 1.6, bearing
    });
  }

  function torpAcquire(torp){
    const aAng = Math.atan2(torp.vy, torp.vx);
    let best=null, bestScore=-1;
    const list = [];
    if(torp.friendly){
      for(const e of enemies){
        if((e.detectedT||0) <= 0) continue;
        const y = (e.type==="boat" ? (e.hitY ?? e.y) : e.y);
        list.push({ ref:e, x:e.x, y, sig:e.noise });
      }
      for(const d of decoys) if(!d.friendly && d.kind==="noisemaker") list.push({ ref:d, x:d.x, y:d.y, sig:d.signature });
    } else {
      list.push({ ref:player, x:player.x, y:player.y, sig:Math.max(0.35, player.noise) });
      for(const d of decoys) if(d.friendly && d.kind==="noisemaker") list.push({ ref:d, x:d.x, y:d.y, sig:d.signature });
    }

    for(const c of list){
      const dx = wrapDx(torp.x, c.x);
      const dy = (c.y - torp.y);
      const dist = Math.hypot(dx, dy);
      if(dist > torp.seekRange) continue;

      const angTo = Math.atan2(dy, dx);
      const dAng = Math.abs(angleNorm(angTo - aAng));
      if(dAng > torp.seekFOV) continue;

      const centered = 1 - (dAng/torp.seekFOV);
      const close = 1 - (dist/torp.seekRange);
      const score = (c.sig * 0.9 + 0.1) * (0.55 + 0.45*close) * (0.55 + 0.45*centered);
      if(score > bestScore){ bestScore=score; best=c.ref; }
    }
    return best;
  }

  function spawnEnemy(){
    const type = (Math.random() < C.enemy.boatShare) ? "boat" : "sub";
    const common = {
      seen: 0,
      detectedT: 0,
      lastX: 0, lastY: 0, lastT: 0,
      suspicion: rand(0.0, 0.12),
      contact: null,
      fireCd: rand(3.0, 6.0),
      cmCd: rand(2.2, 5.5),
      evadeT: 0,
      evadeFrom: null,
      evadeDecoy: null,
      navT: rand(1.0, 3.0),
      navX: 0, navY: 0,
      pingCd: rand(5.0, 10.0),
      pingPulse: 0,
    };

    if(type==="boat"){
      enemies.push({
        ...common,
        type,
        x: rand(player.x + 1200, player.x + 3000) % world.w,
        y: world.seaLevel - rand(6,18),
        hitY: world.seaLevel + 14,
        vx: rand(-26,-12), vy: 0,
        r: 34, hp: 80,
        sensitivity: rand(0.70, 1.05),
        noise: 1.0,
        flareCd: rand(2.2, 4.5),
        cwis: { pKillPerSec: rand(0.55, 0.9), range: rand(520, 760) }
      });
    } else {
      enemies.push({
        ...common,
        type,
        x: rand(player.x + 1400, player.x + 3400) % world.w,
        y: rand(world.seaLevel + 140, world.seaLevel + 980),
        vx: rand(-30,-12), vy: rand(-6,6),
        r: 30, hp: 90,
        sensitivity: rand(0.55, 0.90),
        noise: rand(0.45, 0.7),
      });
    }

    const e = enemies[enemies.length-1];
    e.navX = e.x; e.navY = e.y;
  }

  window.AI = { wrapDx, layerPenalty, enemyHasFireSolution, enemyUpdateContactFromPing, enemyMaybeHearPlayer, enemyDecay, addContactBlobEnemyForPlayer, torpAcquire, spawnEnemy };
})();
