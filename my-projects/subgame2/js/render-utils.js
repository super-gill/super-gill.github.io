// render-utils.js — shared drawing primitives and coordinate transform
// Exposes window.R: { doodleLine, doodleCircle, doodleText, w2s, wScale, PANEL_H, STRIP_W }
// Must load before render.js and any other render-*.js modules.
(() => {
  'use strict';
  const C=window.CONFIG;
  const {TAU}=window.M;
  const {ctx,canvas,DPR,world,cam}=window.G;

  const PANEL_H = C.layout.panelH * DPR;
  const STRIP_W  = C.layout.depthStripW * DPR;

  // ── Drawing primitives ────────────────────────────────────────────────────────
  function doodleLine(x1,y1,x2,y2,w=2){
    ctx.lineWidth=w; ctx.beginPath();
    ctx.moveTo(x1,y1); ctx.lineTo(x2,y2);
    ctx.stroke();
  }
  function doodleCircle(x,y,r,w=2){
    ctx.lineWidth=w; ctx.beginPath();
    ctx.arc(x,y,r,0,TAU);
    ctx.stroke();
  }
  function doodleText(txt,x,y,size=14,align="left"){
    ctx.font=`${size}px ui-monospace,monospace`;
    ctx.textAlign=align; ctx.fillText(txt,x,y);
  }

  // ── World → screen ─────────────────────────────────────────────────────────────
  // Returns pixel coords for a world position, centred on cam.x/cam.y.
  // Accounts for depth strip (right) and command panel (bottom) dead zones.
  function w2s(wx,wy){
    const Z=cam.zoom*DPR;
    const cx=(canvas.width - STRIP_W)/2;
    const cy=(canvas.height - PANEL_H)/2;
    let dx=wx-cam.x;
    let dy=wy-cam.y;
    if(dx>world.w/2) dx-=world.w;
    if(dx<-world.w/2) dx+=world.w;
    if(dy>world.h/2) dy-=world.h;
    if(dy<-world.h/2) dy+=world.h;
    return [cx+dx*Z, cy+dy*Z];
  }
  function wScale(wu){ return wu*cam.zoom*DPR; }

  window.R={doodleLine,doodleCircle,doodleText,w2s,wScale,PANEL_H,STRIP_W};
})();
