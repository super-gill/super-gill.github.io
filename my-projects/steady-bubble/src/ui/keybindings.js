'use strict';

// Central keybinding registry.
// type: 'oneshot' — action fires once per keypress (consumed by justPressed)
//       'held'    — action fires every frame the key is down (read via keys.has)
//       'inline'  — handled directly in the keydown event handler (input.js)
export const KB = {
  // ── Simulation one-shots (consumed in sim) ─────────────────────────────
  reload:          { key: 'r',    type: 'oneshot' },
  damageScreen:    { key: 'h',    type: 'oneshot' },
  damageScreenAlt: { key: 'y',    type: 'oneshot' },
  watchChange:     { key: 'w',    type: 'oneshot' },
  actionStations:  { key: 'a',    type: 'oneshot' },
  periscope:       { key: 'o',    type: 'oneshot' },
  fireTorpedo:     { key: 'f',    type: 'oneshot' },
  countermeasure:  { key: 'x',    type: 'oneshot' },
  activePing:      { key: ' ',    type: 'oneshot' },

  // ── Inline one-shots (handled in input.js keydown) ─────────────────────
  cameraCentre:    { key: 'home', type: 'inline' },
  logTabToggle:    { key: 'j',    type: 'inline' },
  uiScaleUp:       { key: '=',    type: 'inline' },
  uiScaleUpAlt:    { key: '+',    type: 'inline' },
  uiScaleDown:     { key: '-',    type: 'inline' },
  uiScaleReset:    { key: '0',    type: 'inline' },
  devPanel:        { key: '`',    type: 'inline' },
};
