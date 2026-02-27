(() => {
  'use strict';
  const C = window.CONFIG;
  const { rand, clamp } = window.M;
  const { world, bullets, particles, decoys } = window.G;

  function makeExplosion(x,y,power=1, watery=false){
    const count = Math.floor(18*power);
    for(let i=0;i<count;i++){
      const a = rand(0, Math.PI*2);
      const sp = rand(40, 220)*power;
      particles.push({ x,y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life: rand(0.35,0.9), size: rand(2,6)*power, watery });
    }
  }
  function splash(x,y,amount=1){
    const count = Math.floor(14*amount);
    for(let i=0;i<count;i++){
      const a = rand(-Math.PI, 0);
      const sp = rand(60, 260)*amount;
      particles.push({ x,y, vx:Math.cos(a)*sp + rand(-30,30), vy:Math.sin(a)*sp - rand(60,120), life: rand(0.35,0.8), size: rand(2,5)*amount, watery:true });
    }
  }

  function deployDecoy(x,y, friendly=true, kind="noisemaker", opts={}){
    opts = opts || {};
    const d = {
      kind, x, y,
      vx: (opts.vx ?? rand(-40,40)),
      vy: (opts.vy ?? rand(-30,30)),
      life: (kind==="flare") ? rand(C.decoy.flareLifeMin, C.decoy.flareLifeMax) : rand(C.decoy.noisemakerLifeMin, C.decoy.noisemakerLifeMax),
      r: (kind==="flare") ? C.decoy.flareR : C.decoy.noisemakerR,
      friendly,
      signature: (kind==="flare") ? 0.0 : (friendly ? C.decoy.noisemakerSigPlayer : C.decoy.noisemakerSigEnemy),
      mode: opts.mode || null,
      g: opts.g || (kind==="flare" ? C.ship.flareGravity : 0),
    };
    decoys.push(d);
    if(kind==="noisemaker") makeExplosion(x,y,0.45,true);
  }

  function fireTorpedo(fromX, fromY, dirX, dirY, friendly=true){
    const sp = C.torpedo.speed;
    const d = Math.max(1e-6, Math.hypot(dirX, dirY));
    bullets.push({
      kind:"torpedo",
      x: fromX, y: fromY,
      vx: (dirX/d)*sp,
      vy: (dirY/d)*sp,
      r: 6,
      life: C.torpedo.life,
      friendly,
      dmg: C.torpedo.dmg,
      seekRange: C.torpedo.seekRange,
      seekFOV: C.torpedo.seekFOV,
      turnRate: C.torpedo.turnRate,
      target: null,
      arming: C.torpedo.arming
    });
  }

  function fireMissileVLS(fromX, fromY, friendly=true, lock=null){
    bullets.push({
      kind:"missile",
      x: fromX, y: fromY,
      vx: 0,
      vy: -C.missile.speed,
      r: 7,
      life: C.missile.life,
      friendly,
      dmg: C.missile.dmg,
      phase:"vertical",
      lock,
      tipDelay: C.missile.tipDelay,
      speed: C.missile.speed
    });
  }

  function dropDepthCharge(fromX, fromY, targetY, friendly=false){
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
  }

  window.W = { makeExplosion, splash, deployDecoy, fireTorpedo, fireMissileVLS, dropDepthCharge };
})();
