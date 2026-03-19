'use strict';

import { CONFIG } from '../config/constants.js';
import { TAU } from '../utils/math.js';
import { cam } from '../state/sim-state.js';
import { U, uiFont } from '../ui/ui-scale.js';

// Canvas and ctx are set by main.js via bindRenderCanvas()
let canvas = null;
let ctx = null;
let DPR = 1;

export function bindRenderCanvas(c, cx, dpr) {
  canvas = c;
  ctx = cx;
  DPR = dpr;
}

export function getCanvas() { return canvas; }
export function getCtx() { return ctx; }
export function getDPR() { return DPR; }

// PANEL_H and STRIP_W — scaled to canvas pixels
export function getPanelH() { return U(CONFIG.layout.panelH); }
export function getStripW() { return U(CONFIG.layout.depthStripW); }

// ── Drawing primitives ────────────────────────────────────────────────────────
export function doodleLine(x1, y1, x2, y2, w = 2) {
  ctx.lineWidth = w; ctx.beginPath();
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.stroke();
}
export function doodleCircle(x, y, r, w = 2) {
  ctx.lineWidth = w; ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
}
export function doodleText(txt, x, y, size = 14, align = "left") {
  ctx.font = `${size}px ui-monospace,monospace`;
  ctx.textAlign = align; ctx.fillText(txt, x, y);
}

// ── World → screen ─────────────────────────────────────────────────────────────
export function w2s(wx, wy) {
  const Z = cam.zoom * DPR;
  const stripW = getStripW();
  const panelH = getPanelH();
  const cx2 = (canvas.width - stripW) / 2;
  const cy2 = (canvas.height - panelH) / 2;
  const dx = wx - cam.x;
  const dy = wy - cam.y;
  return [cx2 + dx * Z, cy2 + dy * Z];
}
export function wScale(wu) { return wu * cam.zoom * DPR; }

// Re-export U and uiFont for convenience (many render modules need them)
export { U, uiFont };

// ── Aggregate export (mirrors V1 window.R shape) ────────────────────────────
// PANEL_H and STRIP_W are getters so they re-evaluate when DPR changes.
export const R = {
  doodleLine, doodleCircle, doodleText, w2s, wScale, U,
  get PANEL_H() { return getPanelH(); },
  get STRIP_W() { return getStripW(); },
  get canvas() { return canvas; },
  get ctx() { return ctx; },
  get DPR() { return DPR; },
};
