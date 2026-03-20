'use strict';

import { setMsg, addLog, session } from '../state/session-state.js';
import { queueLog } from '../state/sim-state.js';

// ── Priority constants ───────────────────────────────────────────────────
export const P = { NORMAL:0, MED:1, CRIT:2 };

// ── Wrappers so comms.js can pass priority cleanly ───────────────────────
export function log(cat, text, priority=P.NORMAL)  { addLog(cat, text, priority); }
export function qlog(cat, text, delay, priority=P.NORMAL) { queueLog(cat, text, delay, priority); }
export function msg(text, t=1.2)                   { setMsg(text, t); }

// ── DC log (events panel) ────────────────────────────────────────────────
export function dcLog(text, priority=P.NORMAL) {
  if (!session.dcLog) session.dcLog = [];
  session.dcLog.push({ t: session.missionT || 0, text, priority });
  if (session.dcLog.length > 120) session.dcLog.shift();
}

// ── Station → compartment map ────────────────────────────────────────────
export const COMP_STATION = {
  fore_ends:    'TOR',
  control_room: 'CONN',
  aux_section:  'AUX',
  reactor_comp: 'REA',
  engine_room:  'MAN',
  aft_ends:     'ENG',
};

// ── Voice templates (moved to voice.js + voice-ops.js) ───────────────────
import { flood, dc, sys, reactor, escape, planes, combat, weapons } from './voice.js';
import { nav, sensors, tactical, depth, trim, fire, medical, watch, snorkel, mast,
         hydraulic, shaftSeal, hydrogen, hotRun, snorkelFlood, chlorine } from './voice-ops.js';

// ════════════════════════════════════════════════════════════════════════
// PANEL / SPEED ORDERS
// ════════════════════════════════════════════════════════════════════════
export const panel = {
  speedOrder(label, connOrder, engAck) {
    msg(label, 1.0);
    log('CONN', connOrder);
    qlog('ENG', engAck, 1.2);
  },
  speedOrderRelay(label, connOrder, engAck) {
    msg(label, 1.0);
    const coOrder = connOrder.replace(/^Eng, Conn\s*—/, 'Manoeuvring, CO —');
    log('CO', coOrder, P.MED);
    qlog('ENG',  `CO, Manoeuvring — order received, aye`, 2.5);
    qlog('ENG',  engAck, 5.0);
  },
};

// ════════════════════════════════════════════════════════════════════════
// UI FEEDBACK (setMsg only)
// ════════════════════════════════════════════════════════════════════════
export const commsUi = {
  periscopeTooDeep()      { msg('PERISCOPE: TOO DEEP', 1.0); },
  periscopeDamaged()      { msg('PERISCOPE: DAMAGED — UNAVAILABLE', 1.0); },
  scopeReport(shown)      { msg(shown > 0 ? `SCOPE: ${shown} ship(s)` : 'SCOPE: no ships', 1.2); },
  sonarOffline()          { msg('SONAR OFFLINE — SCRAM', 0.8); },
  ping()                  { msg('PING!', 0.8); },
  shipCountermeasures()   { msg('SHIP: COUNTERMEASURES!', 0.8); },
  cwisIntercept()         { msg('CWIS INTERCEPT!', 1.0); },
  emergencyTurnCooldown() { msg('EMERGENCY TURN COOLING DOWN', 0.8); },
};

// ════════════════════════════════════════════════════════════════════════
// CREW STATE TRANSITIONS
// ════════════════════════════════════════════════════════════════════════
export const crewState = {
  actionStations(cause) {
    const lines = {
      torpedo: `Conn — all stations — Action stations, action stations, action stations: Torpedo threat. Close up evasion stations.`,
      contact: `Conn — all stations — Action stations, action stations, action stations: Submerged contact prosecuted. Close up action stations.`,
      attack:  `Conn — all stations — Action stations, action stations, action stations: Weapons free. Close up action stations.`,
      wave:    `Conn — all stations — Action stations, action stations, action stations: Multiple contacts. Close up action stations.`,
      manual:  `Conn — all stations — Action stations, action stations, action stations: Assume defence watches.`,
    };
    log('CONN', lines[cause] || lines.manual, P.CRIT);
    msg('ACTION STATIONS', 2.0);
  },
  patrolState() {
    log('CONN', 'Conn — all hands, close up patrol state. Contact possible. Assume war watches.', P.MED);
    msg('PATROL STATE', 1.5);
  },
  standDown(fromState) {
    if (fromState === 'action') {
      log('CONN', 'Conn — all hands, stand down from action stations. Assume cruising watch.', P.MED);
      qlog('ENG',  'Conn, Eng — aye. Securing action state equipment.', 1.5);
      qlog('WEPS', 'Conn, Weps — aye. Weapons safed. Tubes drained.', 2.5);
      msg('STAND DOWN — CRUISING WATCH', 1.5);
    } else {
      log('CONN', 'Conn — all hands, stand down. Resume normal watch routine.', P.MED);
      msg('NORMAL WATCH', 1.2);
    }
  },
  emergencyStations(cause) {
    const lines = {
      flood:   `Conn — all hands — Emergency stations, emergency stations, emergency stations: Flood, flood, flood. DC teams close up.`,
      reactor: `Conn — all hands — Emergency stations, emergency stations, emergency stations: Reactor casualty. Close up emergency stations.`,
      fire:    `Conn — all hands — Emergency stations, emergency stations, emergency stations: Fire, fire, fire. Close up emergency stations.`,
    };
    log('CONN', lines[cause] || `Conn — all hands — Emergency stations, emergency stations, emergency stations: Close up emergency stations.`, P.CRIT);
    msg('EMERGENCY STATIONS', 2.5);
  },
  casualtyControlled(cause) {
    const lines = {
      flood: 'Conn — all hands, flooding casualty controlled. Secure from emergency stations. Resume normal watch.',
      fire:  'Conn — all hands, fire casualty controlled. Secure from emergency stations. Resume normal watch.',
    };
    log('CONN', lines[cause] || 'Conn — all hands, casualty controlled. Secure from emergency stations.', P.MED);
    msg('CASUALTY CONTROLLED', 1.5);
  },
  escapeStations() {
    log('CONN', 'Conn — all hands — Escape stations, escape stations, escape stations: Abandon ship. This is not a drill.', P.CRIT);
    msg('ESCAPE STATIONS', 3.0);
  },
};

// ════════════════════════════════════════════════════════════════════════
// AGGREGATE EXPORT (mirrors V1 window.COMMS shape)
// ════════════════════════════════════════════════════════════════════════
export const COMMS = {
  P, COMP_STATION, dcLog, flood, dc, sys, reactor, escape, combat, weapons,
  nav, sensors, tactical, panel, ui: commsUi, crewState, depth, trim, planes,
  fire, watch, medical, snorkel, mast, hydraulic, shaftSeal, hydrogen, hotRun,
  snorkelFlood, chlorine,
};
