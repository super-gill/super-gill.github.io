'use strict';

export const SCALE_MIN  = 0.6;
export const SCALE_MAX  = 1.6;
export const SCALE_STEP = 0.1;

const LS_KEY = 'steadyBubble_uiScale';

// Load saved scale or default to 1.0
let _scale = 1.0;
try {
  const saved = localStorage.getItem(LS_KEY);
  if (saved != null) {
    const v = parseFloat(saved);
    if (Number.isFinite(v)) _scale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, v));
  }
} catch(e) { /* localStorage unavailable */ }

// DPR is set by state initialisation in Phase 2.
// Defaults to 1 until state module calls setDPR().
let _dpr = 1;
export function setDPR(v) { _dpr = v; }

export function getScale() { return _scale; }

export function setScale(v) {
  _scale = Math.round(Math.max(SCALE_MIN, Math.min(SCALE_MAX, v)) * 10) / 10;
  try { localStorage.setItem(LS_KEY, _scale.toString()); } catch(e) {}
}

// U(px) — converts a design-pixel value to a canvas-pixel value
// accounting for both device pixel ratio and the player's chosen UI scale.
export function U(px) {
  return Math.round(px * _dpr * _scale);
}

// uiFont(size) — returns a CSS font string at the scaled size
export function uiFont(size, weight) {
  const w = weight || '';
  return `${w ? w + ' ' : ''}${U(size)}px ui-monospace,monospace`;
}
