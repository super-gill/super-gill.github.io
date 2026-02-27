// core.js — bootstraps globals, input, world, update loop
(() => {
  'use strict';
  // CONFIG safety: allow running even if config.js is missing
  window.CONFIG = window.CONFIG || {};


  // Canvas + context
  window.canvas = document.getElementById("c");
  window.ctx = canvas.getContext("2d");

  // DPR + resize
  window.DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  function resize(){
    canvas.width  = Math.floor(window.innerWidth * DPR);
    canvas.height = Math.floor(window.innerHeight * DPR);
  }
  window.addEventListener("resize", resize, { passive:true });
  resize();

  // World constants

  // Safety: if lerpAngle isn't loaded for any reason, fall back to a local implementation
  const _lerpAngle = (typeof lerpAngle === 'function')
    ? lerpAngle
    : (a,b,t)=> (a + angleNorm(b-a)*t);

  window.world = {
    w: 7000,
    h: 2200,
    seaLevel: 520,
    ground: 2050,
    layerY1: 860,
    layerY2: 1080
  };

  // Input
  window.input = {
    keys: new Set(),
    mouseX: 0, mouseY: 0,
    mouseDownL: false,
    mouseDownR: false,
    aimWorldX: 0, aimWorldY: 0,
  };

  window.addEventListener("keydown", (e)=> {
    input.keys.add(e.key.toLowerCase());
    if([" ", "arrowup","arrowdown","arrowleft","arrowright"].includes(e.key.toLowerCase())) e.preventDefault();
  });
  window.addEventListener("keyup", (e)=> input.keys.delete(e.key.toLowerCase()));

  canvas.addEventListener("mousemove", (e)=>{
    const rect = canvas.getBoundingClientRect();
    input.mouseX = (e.clientX - rect.left) * DPR;
    input.mouseY = (e.clientY - rect.top) * DPR;
  });
  canvas.addEventListener("mousedown", (e)=>{
    if(e.button===0) input.mouseDownL = true;
    if(e.button===2) input.mouseDownR = true;
  });
  window.addEventListener("mouseup", (e)=>{
    if(e.button===0) input.mouseDownL = false;
    if(e.button===2) input.mouseDownR = false;
  });
  window.addEventListener("contextmenu", (e)=> e.preventDefault());

  // Reset/restart
  window.reset = ()=>{
    score = 0; gameOver = false;
    bullets.length=0; particles.length=0; enemies.length=0; pickups.length=0; decoys.length=0; contacts.length=0;
    stealthMsg=""; stealthMsgT=0;

    player.x=800; player.y=world.seaLevel+260;
    player.vx=0; player.vy=0;
    player.hp=100; player.invuln=0;
    player.torpCd=0; player.missCd=0; player.sonarCd=0; player.sonarPulse=0; player.cmCd=0;
    player.noise=0; player.selfMask=0; player.passiveTick=0;

    for(let i=0;i<7;i++) spawnEnemy();
  };

  // Main update (player actions + sensing hooks) then systems update
  window.update = (dt)=>{
    if(input.keys.has("r")) reset();

    if(!gameOver){
      // movement
      const sprint = input.keys.has("shift");
      const acc = sprint ? CONFIG.player.sprintAcc : CONFIG.player.acc;
      if(input.keys.has("a")) player.vx -= acc*dt;
      if(input.keys.has("d")) player.vx += acc*dt;
      if(input.keys.has("w")) player.vy -= acc*dt;
      if(input.keys.has("s")) player.vy += acc*dt;

      applyWaterPhysics(player, dt);
      // Speed cap (sprint raises the cap)
      {
        const sprint = input.keys.has("shift");
        const vmax = sprint ? CONFIG.player.sprintVmax : CONFIG.player.vmax;
        const v = Math.hypot(player.vx, player.vy);
        if(v > vmax){
          player.vx *= vmax / v;
          player.vy *= vmax / v;
        }
      }
      player.x = (player.x + player.vx*dt + world.w) % world.w;
      player.y = clamp(player.y + player.vy*dt, world.seaLevel + 70, world.ground - 60);

      // proximity detection (visual + weapons): very close contacts become directly seen
      for(const e of enemies){
        const dxp = wrapDx(player.x, e.x);
        const dyp = (e.y - player.y);
        const dp = Math.hypot(dxp, dyp);
        if(dp < 210){
          e.detectedT = Math.max(e.detectedT||0, 6.0);
          e.seen = Math.max(e.seen||0, 2.4);
          e.lastX = e.x; e.lastY = e.y; e.lastT = now();
        }
      }

      // noise model
      const spd = Math.hypot(player.vx, player.vy);
      // noise floor + earlier ramp (makes stealth harder)
      const floor = CONFIG.player.noiseFloor;
      player.noise = clamp(floor + (spd - CONFIG.player.noiseRampStart) / CONFIG.player.noiseRampDiv, 0, 1);
      if(sprint) player.noise = Math.min(1, player.noise + CONFIG.player.sprintNoiseBoost);
      player.selfMask = player.noise;

      // aim
      function clampDirToArc(dx, dy){
        const desired = Math.atan2(dy, dx);
        const diff = angleNorm(desired - (player.heading || 0));
        const half = (40 * Math.PI/180) * 0.5; // ±20°
        const cd = clamp(diff, -half, half);
        const ang = (player.heading || 0) + cd;
        return { dx: Math.cos(ang), dy: Math.sin(ang), out: Math.abs(diff) > half };
      } world
      input.aimWorldX = cam.x + input.mouseX;
      input.aimWorldY = cam.y + input.mouseY;
      const aimDx = wrapDx(player.x, input.aimWorldX);
      const aimDy = input.aimWorldY - player.y;

      // torpedo
      if(input.mouseDownL && player.torpCd<=0){
        player.torpCd = CONFIG.player.torpCd;
        const c = clampDirToArc(aimDx, aimDy);
        if(c.out) setMsg("TORP ARC LIMIT", 0.6);
        fireTorpedo(player.x + c.dx*2, player.y + c.dy*2, c.dx, c.dy, true);
      }

      // missile
      if(input.mouseDownR && player.missCd<=0){
        player.missCd = CONFIG.player.missCd;
        player.noise = Math.min(1, player.noise + 0.35);
        setMsg("MISSILE LAUNCH TRANSIENT!", 1.0);
        fireMissileVLS(player.x, player.y, true);
      }

      // countermeasure
      if(input.keys.has("q") && player.cmCd<=0){
        player.cmCd = CONFIG.player.cmCd;
        deployDecoy(player.x - 10, player.y + 10, true, "noisemaker");
        setMsg("NOISEMAKER OUT", 1.0);
      }

      // active ping
      if(input.keys.has(" ") && player.sonarCd<=0){
        player.sonarCd = CONFIG.player.sonarCd;
        player.sonarPulse = CONFIG.player.sonarPulse;

        // reveal enemies
        for(const e of enemies){
          const dx = wrapDx(player.x, e.x);
          const dy = e.y - player.y;
          const d = Math.hypot(dx,dy);
          if(d < 1750) e.seen = 2.4;
        }

        // detection risk
        let detectedBy = 0;
        for(const e of enemies){
          const dx = wrapDx(e.x, player.x);
          const dy = player.y - e.y;
          const d = Math.hypot(dx, dy);
          const range = 2000;
          if(d > range) continue;

          const base = (1 - d/range);
          const layer = layerPenalty(player.y, e.y);
          const depthFactor = clamp((player.y - world.seaLevel) / 800, 0.35, 1.0);

          const chance = clamp(0.55 + base * 0.55 * e.sensitivity * layer * (1.18 - 0.18*depthFactor), 0, 0.98);

          // If you are spamming ping, you *will* get found.
          // Make close-range pings effectively guaranteed.
          const forced = (d < 1300) ? 1.0 : (d < 1700 ? 0.92 : 0.0);
          const pingChance = Math.max(chance, forced);

          if(Math.random() < pingChance){
            enemyUpdateContactFromPing(e, player.x, player.y, d);
            detectedBy++;
          } else {
            if(Math.random() < base*0.16) e.suspicion = Math.min(1, e.suspicion + 0.10);
          }
        }
        if(detectedBy>0) setMsg(`PING DETECTED by ${detectedBy} contact(s)!`, 1.6);
        else setMsg("PING: clean (no detection)", 1.2);
      }

      // passive intel blobs
      player.passiveTick -= dt;
      if(player.passiveTick<=0){
        const quietBonus = 1.2 - player.noise*0.85;
        player.passiveTick = rand(0.55, 1.05) / quietBonus;

        for(const e of enemies){
          const dx = wrapDx(player.x, e.x);
          const dy = e.y - player.y;
          const d = Math.hypot(dx,dy);
          const baseRange = 1750;
          if(d > baseRange) continue;

          const layer = layerPenalty(player.y, e.y);
          const signal = e.noise * layer * (1 - d/baseRange);
          const detect = signal - (player.selfMask*0.80);

          const p = clamp(0.07 + detect*0.55 + (e.type==="boat" ? 0.12 : 0.08), 0, 0.65);
          if(Math.random() < p) addContactBlob(e);
        }
      }
    }

    updateSystems(dt);
  };

  window.draw = ()=> drawFrame();

  // Loop
  let last = performance.now();
  reset();

  function step(){
    const t = performance.now();
    const dt = Math.min(0.033, (t - last) / 1000);
    last = t;
    update(dt);
    draw();
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
})();
