// utils.js — shared helpers + doodle primitives
(() => {
  'use strict';

  // --- Math helpers ---
  window.rand = (a,b)=>a+Math.random()*(b-a);
  window.clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  window.hypot=(x,y)=>Math.hypot(x,y);
  window.now=()=>performance.now()/1000;
  window.TAU = Math.PI*2;

  window.jitter = (n=1)=> (Math.random()*2-1)*n;
  window.angleNorm = (a)=>{ while(a>Math.PI) a-=TAU; while(a<-Math.PI) a+=TAU; return a; };
  window.lerp = (a,b,t)=> a + (b-a)*t;

  // World wrap delta-x
  window.wrapDx = (x1,x2)=>{
    let dx = x2 - x1;
    if(dx > world.w/2) dx -= world.w;
    if(dx < -world.w/2) dx += world.w;
    return dx;
  };

  // Layer penalty (thermocline-ish)
  window.inLayer = (y)=> y >= world.layerY1 && y <= world.layerY2;
  window.layerPenalty = (y1,y2)=>{
    const a = inLayer(y1), b = inLayer(y2);
    return (a !== b) ? 0.70 : 1.0;
  };

  // --- Doodle drawing ---
  // Note: uses global ctx
  window.doodleLine = (x1,y1,x2,y2,w=2)=>{
    const steps = Math.max(6, Math.floor(hypot(x2-x1,y2-y1)/18));
    ctx.lineWidth = w;
    ctx.beginPath();
    for(let i=0;i<=steps;i++){
      const t=i/steps;
      const x = x1 + (x2-x1)*t + Math.sin(t*6.28)*jitter(1.2);
      const y = y1 + (y2-y1)*t + Math.cos(t*6.28)*jitter(1.2);
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
  };

  window.doodleCircle = (x,y,r,w=2)=>{
    ctx.lineWidth = w;
    ctx.beginPath();
    const k = 18;
    for(let i=0;i<=k;i++){
      const a = (i/k)*TAU;
      const rr = r + Math.sin(a*3)*jitter(0.8);
      const px = x + Math.cos(a)*rr;
      const py = y + Math.sin(a)*rr;
      if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
    }
    ctx.stroke();
  };

  window.doodleText = (txt,x,y,size=16,align="left")=>{
    ctx.font = `${size}px ui-rounded, system-ui, -apple-system, Segoe UI, Arial`;
    ctx.textAlign = align;
    ctx.fillText(txt, x + jitter(0.5), y + jitter(0.5));
  };
})();

function lerpAngle(a,b,t){ return a + angleNorm(b-a)*t; }
