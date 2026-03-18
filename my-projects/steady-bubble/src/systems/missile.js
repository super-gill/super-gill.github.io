'use strict';

import { CONFIG } from '../config/constants.js';
import { rand, clamp } from '../utils/math.js';

const SEEKER_ACTIVATE_RANGE = 800;
const SEEKER_RANGE          = 1200;
const SEEKER_TIMEOUT        = 8.0;
const HIT_RADIUS            = 28;
const ASCEND_DUR            = 1.8;
const TURN_RATE             = 2.8;
const MIN_WAYPOINT_RANGE    = SEEKER_ACTIVATE_RANGE + 1200;

export function create(type, fromX, fromY, ascmSolution) {
  const cfg = CONFIG.weapons?.[type];
  if (!cfg) return null;

  const speedWU = cfg.speed;
  let brgRad, range;
  const ref = ascmSolution?.ref;
  if (ref && !ref.dead) {
    const dx = ref.x - fromX, dy = ref.y - fromY;
    range  = Math.hypot(dx, dy);
    brgRad = Math.atan2(dy, dx);
  } else {
    const brg = ascmSolution?.bearing ?? 0;
    brgRad = (brg - 90) * Math.PI / 180;
    range  = ascmSolution?.range ?? Math.min(cfg.range, 8000);
  }

  const wpRange = Math.max(range, MIN_WAYPOINT_RANGE);
  const waypointX = fromX + Math.cos(brgRad) * wpRange;
  const waypointY = fromY + Math.sin(brgRad) * wpRange;

  return {
    type,
    x: fromX, y: fromY,
    vx: Math.cos(brgRad) * speedWU,
    vy: Math.sin(brgRad) * speedWU,
    waypointX, waypointY,
    state:    'ascending',
    t:        0,
    dist:     0,
    target:   null,
    seekerT:  0,
    seekerFOV:    cfg.seekerFOV,
    range:        cfg.range,
    warheadDmg:   cfg.warheadDmg,
    trail:    [],
  };
}

export function update(m, dt, enemies) {
  m.t += dt;

  if (m.state === 'ascending' && m.t >= ASCEND_DUR) {
    m.state = 'cruising';
  }

  if (m.state === 'cruising') {
    const dx = m.waypointX - m.x;
    const dy = m.waypointY - m.y;
    if (Math.hypot(dx, dy) < SEEKER_ACTIVATE_RANGE) {
      m.state  = 'seeker_active';
      m.seekerT = 0;
    }
  }

  if (m.state === 'seeker_active') {
    m.seekerT += dt;
    if (!m.target) {
      const heading = Math.atan2(m.vy, m.vx);
      let closest = Infinity, found = null;
      for (const e of enemies) {
        if (e.dead || e.civilian || e.type !== 'boat') continue;
        const dx = e.x - m.x, dy = e.y - m.y;
        const d  = Math.hypot(dx, dy);
        if (d > SEEKER_RANGE) continue;
        let diff = Math.atan2(dy, dx) - heading;
        while (diff >  Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) < m.seekerFOV && d < closest) { closest = d; found = e; }
      }
      m.target = found;
    }
    if (m.target?.dead) m.target = null;
    if (!m.target && m.seekerT > SEEKER_TIMEOUT) return 'miss';
  } else {
    const dx = m.waypointX - m.x;
    const dy = m.waypointY - m.y;
    const d  = Math.hypot(dx, dy);
    if (d > 1) {
      const spd    = Math.hypot(m.vx, m.vy);
      const want   = Math.atan2(dy, dx);
      const cur    = Math.atan2(m.vy, m.vx);
      let   diff   = want - cur;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turn   = clamp(diff, -TURN_RATE * dt, TURN_RATE * dt);
      const newAng = cur + turn;
      m.vx = Math.cos(newAng) * spd;
      m.vy = Math.sin(newAng) * spd;
    }
  }

  if (m.target && !m.target.dead) {
    const dx  = m.target.x - m.x;
    const dy  = m.target.y - m.y;
    const d   = Math.hypot(dx, dy);
    const spd = Math.hypot(m.vx, m.vy);
    const cur = Math.atan2(m.vy, m.vx);
    const want= Math.atan2(dy, dx);
    let   diff= want - cur;
    while (diff >  Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turn = clamp(diff, -TURN_RATE * dt, TURN_RATE * dt);
    const newAng = cur + turn;
    m.vx = Math.cos(newAng) * spd;
    m.vy = Math.sin(newAng) * spd;
    if (d < HIT_RADIUS) return 'hit';
  }

  m.x += m.vx * dt;
  m.y += m.vy * dt;

  m.dist += Math.hypot(m.vx, m.vy) * dt;
  if (m.dist > m.range) return 'miss';

  if (!m.trail) m.trail = [];
  m.trail.push({ x: m.x, y: m.y });
  if (m.trail.length > 14) m.trail.shift();

  return 'alive';
}
