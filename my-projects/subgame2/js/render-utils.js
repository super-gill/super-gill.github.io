// render-utils.js — shared drawing primitives and coordinate transform
// Exposes window.R: { doodleLine, doodleCircle, doodleText, w2s, wScale, PANEL_H, STRIP_W, U, uiFont }
// Must load after ui-scale.js and before render.js and any other render-*.js modules.
(() => {
  'use strict';
  const C=window.CONFIG;
  const {TAU}=window.M;
  const {ctx,canvas,DPR,world,cam}=window.G;
  const {U,uiFont}=window.UI;

  // PANEL_H and STRIP_W are now getters so they react to uiScale changes
  // They return canvas-pixel values (design px * DPR * uiScale)
  function getPanelH() { return U(C.layout.panelH); }
  function getStripW() { return U(C.layout.depthStripW); }

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
    const stripW=getStripW();
    const panelH=getPanelH();
    const cx=(canvas.width - stripW)/2;
    const cy=(canvas.height - panelH)/2;
    const dx=wx-cam.x;
    const dy=wy-cam.y;
    return [cx+dx*Z, cy+dy*Z];
  }
  function wScale(wu){ return wu*cam.zoom*DPR; }

  // Export — PANEL_H and STRIP_W as getters for backward compatibility
  const R = {doodleLine,doodleCircle,doodleText,w2s,wScale,U,uiFont};
  Object.defineProperty(R, 'PANEL_H', { get: getPanelH, enumerable: true });
  Object.defineProperty(R, 'STRIP_W', { get: getStripW, enumerable: true });
  window.R = R;
})();
