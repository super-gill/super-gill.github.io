// panel-context.js — shared imports, lazy bindings, and aliases for all panel sub-modules
'use strict';

import { CONFIG } from '../../config/constants.js';
import { clamp, lerp } from '../../utils/math.js';
import { player, bullets, enemies, sonarContacts, tdc, wrecks, cam } from '../../state/sim-state.js';
import { session, setMsg, addLog } from '../../state/session-state.js';
import { ui } from '../../state/ui-state.js';
import { THEME } from '../../ui/theme.js';

const C = CONFIG;
const TH = THEME;

// ── Lazy bindings stored in a mutable object so sub-modules always see current values ──
const L = {
  ctx: null,
  canvas: null,
  DPR: 1,
  R: null,
  COMMS: null,
  AI: null,
  DMG: null,
  PANEL: null,
  wirePanel: null,
  SENSE: null,
  W: null,
  I: null,
  SIM: null,
  orderLoad: null,
  orderUnload: null,
  orderStrikeReload: null,
  toggleMast: null,
  fireVLS: null,
  fireMissile: null,
  stadimeterStart: null,
};

export function _bindRenderPanel(deps) {
  if (deps.ctx) L.ctx = deps.ctx;
  if (deps.canvas) L.canvas = deps.canvas;
  if (deps.DPR != null) L.DPR = deps.DPR;
  if (deps.R) L.R = deps.R;
  if (deps.COMMS) L.COMMS = deps.COMMS;
  if (deps.AI) L.AI = deps.AI;
  if (deps.DMG) L.DMG = deps.DMG;
  if (deps.PANEL) L.PANEL = deps.PANEL;
  if (deps.wirePanel) L.wirePanel = deps.wirePanel;
  if (deps.SENSE) L.SENSE = deps.SENSE;
  if (deps.W) L.W = deps.W;
  if (deps.I) L.I = deps.I;
  if (deps.SIM) L.SIM = deps.SIM;
  if (deps.orderLoad) L.orderLoad = deps.orderLoad;
  if (deps.orderUnload) L.orderUnload = deps.orderUnload;
  if (deps.orderStrikeReload) L.orderStrikeReload = deps.orderStrikeReload;
  if (deps.toggleMast) L.toggleMast = deps.toggleMast;
  if (deps.fireVLS) L.fireVLS = deps.fireVLS;
  if (deps.fireMissile) L.fireMissile = deps.fireMissile;
  if (deps.stadimeterStart) L.stadimeterStart = deps.stadimeterStart;
}

// Module-level shared state — mutable array for TDC depth smoothing
let _tdcDepthBuf = [];
export function getTdcDepthBuf() { return _tdcDepthBuf; }
export function setTdcDepthBuf(v) { _tdcDepthBuf = v; }
export function pushTdcDepthBuf(v) { _tdcDepthBuf.push(v); if(_tdcDepthBuf.length>12) _tdcDepthBuf.shift(); }

// Export everything needed by sub-modules
export {
  CONFIG, clamp, lerp,
  player, bullets, enemies, sonarContacts, tdc, wrecks, cam,
  session, setMsg, addLog,
  ui,
  THEME,
  C, TH,
  L,
};
