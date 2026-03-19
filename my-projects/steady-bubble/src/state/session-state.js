'use strict';

// ── Session state — mission-level data ───────────────────────────────────────

export const session = {
  score: 0,
  over: false,
  started: false,
  missionT: 0,
  scenario: 'waves',
  vesselKey: '688i',

  // ── Tactical / casualty state ──────────────────────────────────────────────
  tacticalState: 'cruising',   // cruising | patrol | action
  casualtyState: 'normal',     // normal | emergency | escape
  _prevTactical: 'cruising',
  _prevCasualty: 'normal',

  // ── Watch system ───────────────────────────────────────────────────────────
  activeWatch: 'A',
  watchFatigue: 0,
  watchT: 0,
  watchChanging: false,
  watchChangeT: 0,
  _watchRelief80: false,
  _watchRelief100: false,

  // ── Message / toast ────────────────────────────────────────────────────────
  msg: '',
  msgT: 0,

  // ── Logs (capped at 120 entries each) ──────────────────────────────────────
  msgLog: [],
  dcLog: [],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export function setMsg(s, t = 1.2) {
  session.msg = s;
  session.msgT = t;
}

export function addLog(cat, text, priority = 0) {
  session.msgLog.push({ t: session.missionT || 0, cat, text, priority });
  if (session.msgLog.length > 120) session.msgLog.shift();
}

export function setTacticalState(s) {
  if (session.tacticalState === s) return false;
  session._prevTactical = session.tacticalState;
  session.tacticalState = s;
  return true;
}

export function setCasualtyState(s) {
  if (session.casualtyState === s) return false;
  session._prevCasualty = session.casualtyState;
  session.casualtyState = s;
  return true;
}
