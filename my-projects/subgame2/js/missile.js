// missile.js — ASCM flight model
// States: ascending → cruising → seeker_active → (hit or miss)
// Missiles fly in the 2D world plane (wx, wy).
// Compass bearing → math angle: (bearing - 90) * PI/180
(() => {
  'use strict';
  const C  = window.CONFIG;
  const {rand, clamp} = window.M;

  const SEEKER_ACTIVATE_RANGE = 800;   // wu — activate seeker this far from waypoint
  const SEEKER_RANGE          = 1200;  // wu — max scan radius once seeker is on
  const SEEKER_TIMEOUT        = 8.0;   // s  — give up if no target found
  const HIT_RADIUS            = 28;    // wu — proximity detonation threshold
  const ASCEND_DUR            = 1.8;   // s  — boost/climb phase before level cruise
  const TURN_RATE             = 2.8;   // rad/s — max homing turn rate

  // Minimum distance from launch to waypoint — must be well past the seeker gate
  // so the missile doesn't overshoot the waypoint during the ascending phase.
  // Ascending at 450wu/s × 1.8s = 810wu of travel before cruising.
  // Waypoint must be at least SEEKER_ACTIVATE_RANGE + 200wu beyond ASCEND travel.
  const MIN_WAYPOINT_RANGE = SEEKER_ACTIVATE_RANGE + 1200;  // 2000wu

  // Create a missile from a fired tube.
  // ascmSolution: { bearing (compass°), range (wu), ref (enemy object) }
  // If ref is present, bearing/range are computed directly from its current position
  // — most accurate, eliminates compass↔math-angle round-trip errors.
  function create(type, fromX, fromY, ascmSolution) {
    const cfg = C.weapons?.[type];
    if (!cfg) return null;

    const speedWU = cfg.speed;   // kt == wu/s in this game's unit system

    // Prefer direct bearing from target ref — bypasses compass conversion entirely
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

    // Clamp waypoint to minimum range so ascending phase doesn't overshoot it
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

  // Update a missile by dt seconds.
  // Returns 'alive' | 'hit' | 'miss'
  function update(m, dt, enemies) {
    m.t += dt;

    // ── Phase transitions ────────────────────────────────────────────────────
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

    // ── Steering ─────────────────────────────────────────────────────────────
    if (m.state === 'seeker_active') {
      m.seekerT += dt;

      // Scan for target if not already locked
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

      // Target invalidated (killed before impact)
      if (m.target?.dead) m.target = null;

      // Timeout — miss
      if (!m.target && m.seekerT > SEEKER_TIMEOUT) return 'miss';

    } else {
      // Cruising / ascending — fly toward waypoint, steer to stay on bearing
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

    // ── Home on locked target ────────────────────────────────────────────────
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

    // ── Move ─────────────────────────────────────────────────────────────────
    m.x += m.vx * dt;
    m.y += m.vy * dt;

    // ── Range exhausted ──────────────────────────────────────────────────────
    m.dist += Math.hypot(m.vx, m.vy) * dt;
    if (m.dist > m.range) return 'miss';

    // ── Trail ────────────────────────────────────────────────────────────────
    if (!m.trail) m.trail = [];
    m.trail.push({ x: m.x, y: m.y });
    if (m.trail.length > 14) m.trail.shift();

    return 'alive';
  }

  window.MSL = { create, update };
})();
