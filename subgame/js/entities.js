// entities.js — state containers + constructors + damage
(() => {
  'use strict';

  // Collections
  window.bullets = [];
  window.particles = [];
  window.enemies = [];
  window.pickups = [];
  window.decoys = [];
  window.contacts = [];

  // Game state
  window.score = 0;
  window.gameOver = false;
  window.stealthMsg = "";
  window.stealthMsgT = 0;

  window.setMsg = (s, t=1.2)=>{ stealthMsg = s; stealthMsgT = t; };

  // Player
  window.player = {
    x: 800,
    y: 520 + 260,
    vx: 0, vy: 0,
    heading: 0, // radians, bow direction (for torpedo firing arc)
    r: 28,
    hp: 100,
    invuln: 0,
    torpCd: 0,
    missCd: 0,
    sonarCd: 0,
    sonarPulse: 0,
    cmCd: 0,
    noise: 0,
    selfMask: 0,
    passiveTick: 0
  };

  // Camera
  window.cam = { x:0, y:0 };

  // Effects
  window.makeExplosion = (x,y,power=1, watery=false)=>{
    const count = Math.floor(18*power);
    for(let i=0;i<count;i++){
      const a = rand(0, TAU);
      const sp = rand(40, 220)*power;
      particles.push({ x,y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life: rand(0.35,0.9), size: rand(2,6)*power, watery });
    }
  };

  window.splash = (x,y,amount=1)=>{
    const count = Math.floor(14*amount);
    for(let i=0;i<count;i++){
      const a = rand(-Math.PI, 0);
      const sp = rand(60, 260)*amount;
      particles.push({ x,y, vx:Math.cos(a)*sp + rand(-30,30), vy:Math.sin(a)*sp - rand(60,120), life: rand(0.35,0.8), size: rand(2,5)*amount, watery:true });
    }
  };

  // Countermeasures
  window.deployDecoy = (x,y, friendly=true, kind="noisemaker")=>{
    const d = {
      kind,
      x, y,
      vx: rand(-40,40),
      vy: rand(-30,30),
      life: kind==="flare" ? rand(1.4, 2.2) : rand(5.0, 7.5),
      r: kind==="flare" ? 12 : 18,
      friendly,
      signature: kind==="flare" ? 0.0 : (friendly ? 1.15 : 1.0)
    };
    decoys.push(d);
    if(kind==="noisemaker") makeExplosion(x,y,0.45,true);
  };

  // Weapons
  window.fireTorpedo = (fromX, fromY, dirX, dirY, friendly=true)=>{
    const sp = 620;
    const d = Math.max(1e-6, Math.hypot(dirX, dirY));
    bullets.push({
      kind:"torpedo",
      x: fromX, y: fromY,
      vx: (dirX/d)*sp,
      vy: (dirY/d)*sp,
      r: 6,
      life: 5.2,
      friendly,
      dmg: 42,
      seekRange: 780,
      seekFOV: 0.62,
      turnRate: 2.4,
      target: null,
      arming: 0.18
    });
  };

  window.fireMissileVLS = (fromX, fromY, friendly=true)=>{
    bullets.push({
      kind:"missile",
      x: fromX, y: fromY,
      vx: 0,
      vy: -720,
      r: 7,
      life: 4.0,
      friendly,
      dmg: 140,
      phase:"vertical",
      lock:null,
      tipDelay:0.35,
      speed:720
    });
  };

  window.dropDepthCharge = (fromX, fromY, targetY, friendly=false)=>{
    const ty = clamp(targetY, world.seaLevel + 120, world.ground - 80);
    bullets.push({
      kind:"depthCharge",
      x: fromX,
      y: fromY,
      vx: rand(-20,20),
      vy: 90,
      r: 8,
      life: 5.0,
      friendly,
      targetY: ty,
      sink: rand(160, 230),
      dmg: 34,
      blastR: 190
    });
  };

  // Damage
  window.damagePlayer = (amount)=>{
    if(player.invuln > 0) return;
    player.hp = Math.max(0, player.hp - amount);
    player.invuln = 0.8;
    makeExplosion(player.x, player.y, 0.8, true);
    if(player.hp <= 0) gameOver = true;
  };

  window.damageEnemy = (e, amount)=>{
    e.hp -= amount;
    makeExplosion(e.x, e.y, amount>=90?1.6:1.0, e.type==="boat");
    if(e.hp <= 0){
      score += (e.type==="boat" ? 160 : 190);
      if(Math.random()<0.25){
        pickups.push({ x:e.x, y: clamp(e.y+30, world.seaLevel+60, world.ground-60), r:14, kind: Math.random()<0.7 ? "hp" : "ammo", t:0 });
      }
      e.dead = true;
    }
  };
})();
