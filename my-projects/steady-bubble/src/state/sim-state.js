'use strict';

import { CONFIG } from '../config/constants.js';

const C = CONFIG;

// ── World ────────────────────────────────────────────────────────────────────
export const world = { ...C.world };

// ── Camera (top-down, tracks player in world-space) ──────────────────────────
export const cam = { x: 0, y: 0, zoom: C.camera.zoom };

// ── Player ───────────────────────────────────────────────────────────────────
export const player = {
  wx: 6000, wy: 6000,
  heading: 0,
  speed: 0,
  speedOrderKts: 0,
  depth: 260,
  depthOrder: 260,
  vy: 0,

  hp: C.player.hpMax, invuln: 0,
  noise: 0, noiseTransient: 0, cavitating: false,
  torpCd: 0, pingCd: 0, cmCd: 0, sonarPulse: 0,
  periscopeCd: 0, periscopeT: 0,
  silent: false,
  scram: false, scramT: 0, scramCause: null, scramEPM: false,
  emergTurnT: 0, emergTurnCd: 0,
  _crashDiving: false, crashDiveCd: 0, _crashTanksFull: false,
  passiveTick: 0,
  turnRate: 0,
  towedArray: {
    state: 'stowed',
    progress: 0,
    overspeedT: 0,
  },
};

// ── Entity collections ───────────────────────────────────────────────────────
export const bullets       = [];
export const particles     = [];
export const enemies       = [];
export const decoys        = [];
export const contacts      = [];
export const cwisTracers   = [];
export const wireContacts  = [];
export const sonarContacts = new Map();
export const wrecks        = [];
export const buoys         = [];
export const missiles      = [];

// ── Fire control (TDC) ──────────────────────────────────────────────────────
export const tdc = {
  target: null, targetId: null,
  bearing: null, range: null, depth: null,
  course: null, speed: null, intercept: null,
};

// ── Torpedo ID generator ─────────────────────────────────────────────────────
let _nextTorpId = 1;
export function nextTorpId() { return 'T' + (_nextTorpId++); }
export function resetTorpIds() { _nextTorpId = 1; }

// ── Queued log messages (buffered on player, drained by sim) ─────────────────
export function queueLog(station, msg, delayS, priority = 0) {
  if (!player.pendingLogs) player.pendingLogs = [];
  player.pendingLogs.push({ t: delayS, station, msg, priority });
}

// ── Reactor SCRAM ────────────────────────────────────────────────────────────
export function triggerScram(cause) {
  if (player.scram) return;
  player.scram = true;
  player.scramT = 75;
  player.scramCause = cause || 'unknown';
  player.scramEPM = false;
  player._coolantLeak = null;
  player._steamLeak = null;
  player._turbineTrip = null;
}
