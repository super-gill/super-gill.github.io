(() => {
  'use strict';
  const C = window.CONFIG;
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  function resize(){
    canvas.width  = Math.floor(window.innerWidth * DPR);
    canvas.height = Math.floor(window.innerHeight * DPR);
  }
  window.addEventListener("resize", resize, { passive:true });
  resize();

  const world = { ...C.world };
  const cam = { x:0, y:0 };

  const bullets=[], particles=[], enemies=[], pickups=[], decoys=[], contacts=[], cwisTracers=[];

  const player = {
    x: 800,
    y: world.seaLevel + 260,
    vx: 0, vy: 0,
    r: C.player.r,
    heading: 0,
    hp: C.player.hpMax,
    invuln: 0,
    noise: 0,
    selfMask: 0,
    torpCd:0, missCd:0, sonarCd:0, cmCd:0,
    sonarPulse: 0,
    passiveTick: 0,
  };

  const game = {
    score: 0,
    over: false,
    msg: "",
    msgT: 0,
    lastT: performance.now(),
  };

  const setMsg = (s,t=1.2)=>{ game.msg=s; game.msgT=t; };

  window.G = { canvas, ctx, DPR, world, cam, bullets, particles, enemies, pickups, decoys, contacts, cwisTracers, player, game, resize, setMsg };
})();
