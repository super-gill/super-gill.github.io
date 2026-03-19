'use strict';

import { CONFIG } from '../config/constants.js';
import { KB } from './keybindings.js';
import { cam, player } from '../state/sim-state.js';
import { session } from '../state/session-state.js';
import { ui } from '../state/ui-state.js';
import { getScale, setScale, SCALE_STEP } from './ui-scale.js';
import { getCanvas, getDPR, getPanelH, getStripW, U } from '../render/render-utils.js';

// Forward references — bound after panel.js loads
let _handlePanelClick = null;
let _depthStep = null;
export function _bindInput(handleClick, depthStep) {
  _handlePanelClick = handleClick;
  _depthStep = depthStep;
}

export const input = {
  keys: new Set(),
  mouseX: 0, mouseY: 0,
  mouseDownL: false, mouseDownR: false,
  aimWorldX: 0, aimWorldY: 0,
  _pendingRouteClick: false,
  routeRemoveLast: false,
  zoomDelta: 0,
  shiftHeld: false,
  ctrlHeld: false,
  torpAimClick: false,
  _camDragActive: false,
  _camDragLastX: 0, _camDragLastY: 0,

  justPressed(action) {
    const kb = KB?.[action]; if (!kb) return false;
    const k = kb.key;
    if (!this.keys.has(k)) return false;
    this.keys.delete(k);
    return true;
  },
};

addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (!e.repeat) input.keys.add(k);
  if (e.key === "Shift") input.shiftHeld = true;
  if (e.key === "Control") input.ctrlHeld = true;
  if (!e.repeat) {
    if (k === KB?.cameraCentre?.key) { cam.free = false; cam.x = player.wx; cam.y = player.wy; }
    if (k === KB?.logTabToggle?.key) { ui.logTab = ui.logTab === 'dc' ? 'log' : 'dc'; }
    if ((k === KB?.uiScaleUp?.key || k === KB?.uiScaleUpAlt?.key)) { setScale(getScale() + SCALE_STEP); }
    if (k === KB?.uiScaleDown?.key) { setScale(getScale() - SCALE_STEP); }
    if (k === KB?.uiScaleReset?.key) { setScale(1.0); }
    if (k === KB?.devPanel?.key) { const p = document.getElementById('dev-panel'); if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none'; }
  }
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
});

addEventListener("keyup", (e) => {
  input.keys.delete(e.key.toLowerCase());
  if (e.key === "Shift") input.shiftHeld = false;
  if (e.key === "Control") { input.ctrlHeld = false; input._camDragActive = false; }
});

function updateMouse(e) {
  const canvas = getCanvas(); if (!canvas) return;
  const r = canvas.getBoundingClientRect();
  const dpr = getDPR();
  input.mouseX = (e.clientX - r.left) * dpr;
  input.mouseY = (e.clientY - r.top) * dpr;
}

function inPanel(my) {
  const canvas = getCanvas(); if (!canvas) return false;
  return my >= canvas.height - getPanelH();
}

function inDepthStrip(mx) {
  const canvas = getCanvas(); if (!canvas) return false;
  return mx >= canvas.width - getStripW();
}

function inCompass(mx, my) {
  const canvas = getCanvas(); if (!canvas) return false;
  const u = U;
  const stripW = getStripW();
  const radius = u(65);
  const cx2 = canvas.width - stripW - radius - u(50);
  const cy2 = u(72) + radius + u(10);
  const left = cx2 - radius - u(8) - u(38);
  const right = cx2 + radius + u(8) + u(38);
  const top = cy2 - radius - u(30) - u(20);
  const bottom = cy2 + radius + u(8) + u(52) + u(4) + u(20);
  return mx >= left && mx <= right && my >= top && my <= bottom;
}

function inLogPanel(mx, my) {
  const canvas = getCanvas(); if (!canvas) return false;
  const u = U;
  const panelH2 = getPanelH();
  const boardW = u(560);
  const boardH = u(568);
  const by = canvas.height - panelH2 - boardH - u(2);
  return mx >= 0 && mx <= boardW && my >= by && my <= canvas.height - panelH2;
}

addEventListener("mousemove", (e) => {
  updateMouse(e);
  if (input._camDragActive && input.mouseDownR && input.ctrlHeld) {
    const Z = (CONFIG?.camera?.zoom || 0.12) * getDPR();
    const dx = (input.mouseX - input._camDragLastX) / Z;
    const dy = (input.mouseY - input._camDragLastY) / Z;
    cam.x = cam.x - dx;
    cam.y = cam.y - dy;
    input._camDragLastX = input.mouseX;
    input._camDragLastY = input.mouseY;
  }
});

addEventListener("mousedown", (e) => {
  updateMouse(e);
  if (e.button === 0) {
    input.mouseDownL = true;
    if (session.started === false) {
      const offsetY = (ui.startPhase || 'scenario') === 'scenario' ? (ui.startScrollY || 0) : 0;
      _handlePanelClick?.(input.mouseX, input.mouseY + offsetY);
      return;
    }
    if (inPanel(input.mouseY) || inDepthStrip(input.mouseX) || inLogPanel(input.mouseX, input.mouseY) || inCompass(input.mouseX, input.mouseY)) {
      _handlePanelClick?.(input.mouseX, input.mouseY);
      return;
    }
    if (_handlePanelClick?.(input.mouseX, input.mouseY)) return;
    // Block map clicks when damage/DC overlay is open
    if (ui.showDamageScreen || ui.showDcPanel || ui.showDmgPanel || ui.showCrewPanel) return;
    if (input.shiftHeld) {
      input.torpAimClick = true;
    } else {
      input._pendingRouteClick = true;
    }
  }
  if (e.button === 2) {
    input.mouseDownR = true;
    if (input.ctrlHeld && !inPanel(input.mouseY) && !inDepthStrip(input.mouseX)) {
      input._camDragActive = true;
      input._camDragLastX = input.mouseX;
      input._camDragLastY = input.mouseY;
      cam.free = true;
    } else if (!inPanel(input.mouseY) && !inDepthStrip(input.mouseX)) {
      input.routeRemoveLast = true;
    }
  }
});

addEventListener("mouseup", (e) => {
  if (e.button === 0) input.mouseDownL = false;
  if (e.button === 2) { input.mouseDownR = false; input._camDragActive = false; }
});

addEventListener("wheel", (e) => {
  if (!session.started) {
    e.preventDefault();
    const delta = e.deltaMode === 1 ? e.deltaY * 24 : e.deltaMode === 2 ? e.deltaY * (window.innerHeight || 800) : e.deltaY;
    if ((ui.startPhase || 'scenario') === 'vessel' && (ui.vesselTab || 'player') === 'soviet') {
      ui.vesselScrollY = Math.max(0, (ui.vesselScrollY || 0) + delta);
    } else {
      ui.startScrollY = Math.max(0, (ui.startScrollY || 0) + delta);
    }
    return;
  }
  const canvas = getCanvas(); if (!canvas) return;
  if (inPanel(input.mouseY)) return;
  e.preventDefault();
  input.zoomDelta += e.deltaY > 0 ? -1 : 1;
}, { passive: false });

addEventListener("contextmenu", (e) => e.preventDefault());

addEventListener("blur", () => {
  input.keys.clear();
  input.shiftHeld = false;
  input.ctrlHeld = false;
  input.mouseDownL = false;
  input.mouseDownR = false;
  input._camDragActive = false;
});
