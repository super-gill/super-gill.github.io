// ui-scale.js — UI scale system for responsive sizing
// Exposes window.UI: { U, uiFont, getScale, setScale, SCALE_MIN, SCALE_MAX, SCALE_STEP }
// Must load AFTER state.js (needs window.G.DPR) and BEFORE any render-*.js modules.
(() => {
  'use strict';

  const SCALE_MIN  = 0.6;
  const SCALE_MAX  = 1.6;
  const SCALE_STEP = 0.1;
  const LS_KEY     = 'steadyBubble_uiScale';

  // Load saved scale or default to 1.0
  let _scale = 1.0;
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved != null) {
      const v = parseFloat(saved);
      if (Number.isFinite(v)) _scale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, v));
    }
  } catch(e) { /* localStorage unavailable */ }

  function getScale() { return _scale; }

  function setScale(v) {
    _scale = Math.round(Math.max(SCALE_MIN, Math.min(SCALE_MAX, v)) * 10) / 10;
    try { localStorage.setItem(LS_KEY, _scale.toString()); } catch(e) {}
  }

  // U(px) — the core helper. Converts a design-pixel value to a canvas-pixel value
  // accounting for both device pixel ratio and the player's chosen UI scale.
  // Usage: replace every `N * DPR` with `U(N)` throughout render code.
  function U(px) {
    return Math.round(px * (window.G?.DPR || 1) * _scale);
  }

  // uiFont(size) — returns a CSS font string at the scaled size
  function uiFont(size, weight) {
    const w = weight || '';
    return `${w ? w + ' ' : ''}${U(size)}px ui-monospace,monospace`;
  }

  window.UI = { U, uiFont, getScale, setScale, SCALE_MIN, SCALE_MAX, SCALE_STEP };
})();
