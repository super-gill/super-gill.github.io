// theme.js — centralised colour, typography, and spacing tokens
// Exposes window.THEME
// Must load after ui-scale.js, before render-utils.js
(() => {
  'use strict';
  const {U} = window.UI;

  // ── Base colour ─────────────────────────────────────────────────────────────
  // ~90% of UI colours are this dark navy at varying opacities
  const BASE = '17,24,39';
  function ink(a) { return `rgba(${BASE},${a})`; }

  // ── Colour palette ──────────────────────────────────────────────────────────
  const color = {
    // Backgrounds
    bg: {
      panel:     'rgba(241,245,249,0.97)',
      depthStrip:'rgba(245,246,250,0.96)',
      threatBar: 'rgba(247,247,251,0.88)',
      logPanel:  'rgba(248,246,240,0.90)',
      overlay:   'rgba(8,14,26,0.97)',
      overlayAlt:'rgba(5,12,30,0.94)',
      card:      'rgba(8,20,35,0.80)',
    },

    // Text hierarchy
    text: {
      primary:   '#111827',
      secondary: ink(0.55),
      muted:     ink(0.40),
      dim:       ink(0.28),
      faint:     ink(0.15),
      white:     '#f0f4ff',
      bright:    'rgba(200,225,255,0.97)',
    },

    // Borders & dividers
    border: {
      light:  ink(0.10),
      medium: ink(0.14),
      heavy:  ink(0.25),
    },

    // Section headers
    header: ink(0.35),

    // Buttons
    btn: {
      activeBg:      '#1e3a5f',
      activeFg:      '#f0f4ff',
      activeStroke:  'rgba(80,120,200,0.35)',
      availBg:       'rgba(30,45,70,0.38)',
      availFg:       'rgba(190,205,230,0.85)',
      availStroke:   'rgba(60,90,140,0.20)',
      unavailBg:     ink(0.05),
      unavailFg:     'rgba(100,110,130,0.30)',
      emergBg:       '#7c1010',
      emergStroke:   'rgba(220,50,50,0.55)',
    },

    // System / component status
    status: {
      nominal:   '#16a34a',
      degraded:  '#b45309',
      offline:   '#dc2626',
      destroyed: '#7f1d1d',
    },

    // Threat bar states
    threat: {
      clear:  '#16a34a',
      search: '#d97706',
      alert:  '#dc2626',
    },

    // Feature accents
    accent: {
      blue:    '#1e3a5f',
      teal:    'rgba(13,148,136,0.85)',
      purple:  'rgba(100,30,200,0.85)',
      amber:   '#b45309',
      red:     '#991b1b',
      green:   'rgba(22,163,74,0.80)',
      orange:  'rgba(255,160,30,0.70)',
    },

    // Sonar contacts
    contact: {
      friendly: '#111827',
      enemy:    'rgba(100,30,200,0.85)',
      seduced:  'rgba(160,40,40,0.90)',
      stale:    ink(0.25),
    },

    // Bar fills
    bar: {
      bg:      ink(0.10),
      healthy: '#334155',
      warning: '#b45309',
      danger:  '#dc2626',
    },
  };

  // ── Typography ──────────────────────────────────────────────────────────────
  // Design-pixel sizes passed to U() for scaling
  const font = {
    tiny:     7,    // timestamps, fine hints
    badge:    8,    // pills, scale labels, contact IDs
    label:    9,    // sub-labels (ACTUAL, ORDERED, NOISE)
    body:     10,   // list items, log text
    header:   11,   // section headers (ENGINE ORDER, DEPTH, etc.)
    value:    12,   // secondary readouts
    button:   14,   // button labels
    valueLg:  16,   // primary readouts (speed, depth values)
    title:    18,   // overlay titles
  };

  const FONT_FAMILY = 'ui-monospace,monospace';

  // ── Spacing ─────────────────────────────────────────────────────────────────
  // Design-pixel values passed to U() for scaling
  const pad = {
    xs:  3,   // tight (related elements, button gap)
    s:   4,   // small (icon-to-text, within groups)
    m:   8,   // standard (section padding, general margin)
    l:  14,   // generous (between sections)
    xl: 20,   // large (overlay padding)
  };

  // ── Exports ─────────────────────────────────────────────────────────────────
  window.THEME = { color, font, pad, ink, FONT_FAMILY };
})();
