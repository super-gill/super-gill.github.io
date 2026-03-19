// Phase 3 — All V1 modules ported. Full game loop wired.
'use strict';

// ── Config & Utils ────────────────────────────────────────────────────────
import { CONFIG } from './config/constants.js';
import { VESSELS } from './config/vessels.js';
import { TAU, rand, clamp, lerp, now, jitter, angleNorm, lerpAngle, deg2rad } from './utils/math.js';
import * as MAPS from './utils/maps.js';
import { U, setDPR, getScale } from './ui/ui-scale.js';
import { THEME } from './ui/theme.js';
import { KB } from './ui/keybindings.js';

// ── State ─────────────────────────────────────────────────────────────────
import { world, cam, player, enemies, bullets, particles, decoys, contacts,
         cwisTracers, wireContacts, sonarContacts, wrecks, buoys, missiles,
         tdc, nextTorpId, resetTorpIds, triggerScram, queueLog } from './state/sim-state.js';
import { session, setMsg, addLog, setTacticalState, setCasualtyState } from './state/session-state.js';
import { ui } from './state/ui-state.js';

// ── Narrative ─────────────────────────────────────────────────────────────
import { COMMS, P, COMP_STATION, dcLog } from './narrative/comms.js';

// ── Systems ───────────────────────────────────────────────────────────────
import * as SIG from './systems/signature.js';
const { _bindSignature } = SIG;
import * as MSL from './systems/missile.js';
import { W, _bindWeapons } from './systems/weapons.js';
import { TORP, _bindTorpedo } from './systems/torpedo.js';
import { SENSE, _bindSensors } from './systems/sensors.js';
import { NAV, route, _bindNav } from './systems/nav.js';
import { DMG, _bindDamage, _bindDamagePanel, _bindDamageBroadcast } from './systems/damage.js';

// ── AI ────────────────────────────────────────────────────────────────────
import { AI, _bindComms as _bindAIComms } from './ai/index.js';

// ── Simulation ────────────────────────────────────────────────────────────
import { SIM, _bindSim, damagePlayer, damageEnemy, _onWireCut } from './sim/index.js';

// ── UI ────────────────────────────────────────────────────────────────────
import { input as I, _bindInput } from './ui/input.js';
import { PANEL, wirePanel, _bindPanel, _bindRoute } from './ui/panel.js';

// ── Render ────────────────────────────────────────────────────────────────
import { R, bindRenderCanvas } from './render/render-utils.js';
import { RWORLD, _bindRenderWorld } from './render/render-world.js';
import { RHUD, _bindRenderHud } from './render/render-hud.js';
import { RPANEL, _bindRenderPanel } from './render/render-panel.js';
import { draw, _bindRender } from './render/index.js';

// ── Dev Panel ─────────────────────────────────────────────────────────────
import { initDevPanel, _bindDevPanel } from './dev-panel.js';

// ── Canvas setup ──────────────────────────────────────────────────────────
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

function resize() {
  setDPR(DPR);
  canvas.width  = Math.floor(innerWidth * DPR);
  canvas.height = Math.floor(innerHeight * DPR);
}
resize();
addEventListener('resize', resize, { passive: true });
bindRenderCanvas(canvas, ctx, DPR);

// ── Wire all lazy bindings ────────────────────────────────────────────────
// Order matters: bind dependencies before dependents.

const commonDeps = { ctx, canvas, DPR, COMMS, AI, DMG, MAPS, I };

_bindAIComms(COMMS);

_bindSignature(
  () => PANEL.getTelegraph(),
  () => DMG.getEffects()
);

_bindWeapons({
  AI, COMMS, DMG,
  SENSE,
  onWireCut: _onWireCut,
  broadcastTransient: SENSE.broadcastTransient,
});

_bindTorpedo({
  AI,
  damageEnemy,
  damagePlayer,
});

_bindSensors({ COMMS, AI, DMG, MAPS });

_bindNav({
  COMMS, I, AI, DMG,
  PANEL, MAPS,
  DPR, canvas,
});

_bindDamage({ COMMS });
_bindDamagePanel({ PANEL });
_bindDamageBroadcast({ broadcastTransient: SENSE.broadcastTransient });

_bindPanel({
  W, COMMS, DMG, I, AI,
  onWireCut: _onWireCut,
  reserveTube: (...args) => SIM._reserveTube?.(...args),
  reserveSpecificTube: (...args) => SIM._reserveSpecificTube?.(...args),
  DPR, canvas,
});
_bindRoute(route);

_bindSim({
  COMMS, I, NAV, SIG, SENSE, W, AI, DMG, TORP, MSL, PANEL, MAPS,
  canvas,
  route,
  broadcastTransient: SENSE.broadcastTransient,
  playerHearTransient: SENSE.playerHearTransient,
});

// Render bindings
_bindRenderWorld({ ctx, canvas, DPR, R, MAPS, route });
_bindRenderHud({ ctx, DPR, R, PANEL });
_bindRenderPanel({
  ctx, canvas, DPR, R, COMMS, AI, DMG, PANEL,
  wirePanel,
  SENSE, W, I, SIM,
  orderLoad: (...args) => SIM._orderLoad?.(...args),
  orderUnload: (...args) => SIM._orderUnload?.(...args),
  orderStrikeReload: (...args) => SIM._orderStrikeReload?.(...args),
  toggleMast: (...args) => SIM._toggleMast?.(...args),
  fireVLS: (...args) => SIM._fireVLS?.(...args),
  fireMissile: (...args) => SIM._fireMissile?.(...args),
  stadimeterStart: (...args) => SIM._stadimeterStart?.(...args),
});
_bindRender({
  ctx, canvas, DPR, R, RWORLD, RHUD, RPANEL, AI, MAPS, I,
  UI_SCALE: { getScale },
});

// Input binding
_bindInput(PANEL.handleClick, PANEL.depthStep);

// Dev panel
_bindDevPanel({ DMG, AI, COMMS, SIM });
initDevPanel();

// ── Initial reset (after all bindings are wired) ──────────────────────────
SIM.reset();

// ── Game loop ─────────────────────────────────────────────────────────────
let lastT = performance.now();

function step() {
  const t = performance.now();
  const dt = Math.min(0.033, (t - lastT) / 1000);
  lastT = t;

  SIM.update(dt);
  draw();

  requestAnimationFrame(step);
}

requestAnimationFrame(step);
