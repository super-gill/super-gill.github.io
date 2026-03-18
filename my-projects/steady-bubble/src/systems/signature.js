'use strict';

import { CONFIG } from '../config/constants.js';
import { clamp } from '../utils/math.js';
import { world, player } from '../state/sim-state.js';

// Lazy imports — these modules may import from us or our siblings.
// Resolved at call time, not load time.
let _getTelegraph = null;
let _getDmgEffects = null;
export function _bindSignature(getTelegraph, getDmgEffects) {
  _getTelegraph = getTelegraph;
  _getDmgEffects = getDmgEffects;
}

function cavitationThresholdKts(depth) {
  const d = clamp((depth - world.seaLevel) / CONFIG.player.cavitationDepthRef, 0, 2.0);
  return CONFIG.player.cavitationKtsRef + d * (CONFIG.player.cavitationDepthRef * CONFIG.player.cavitationSlope);
}

let _lastDesiredHeading = null;

function updateNoise(dt) {
  const C = CONFIG;
  const flow = (player.speed / C.player.flowNoiseDiv);
  let n = clamp(C.player.noiseFloor + flow, 0, 1);
  const turnMag = Math.min(1, Math.abs(player.turnRate) / (Math.PI / 3));
  // Course reversal transient
  if (_lastDesiredHeading === null) _lastDesiredHeading = (player.desiredHeading ?? 0);
  if (Math.abs((_lastDesiredHeading) - (player.desiredHeading ?? 0)) > 1e-3) {
    player.noiseTransient = Math.min(1, player.noiseTransient + (C.player.turnSnapNoise || 0.10));
    _lastDesiredHeading = (player.desiredHeading ?? 0);
  }
  n = clamp(n + turnMag * C.player.turnNoise, 0, 1);
  if (_getTelegraph && _getTelegraph()?.kts >= (C.player.flankKts || 28)) n = clamp(n + C.player.flankNoiseBoost, 0, 1);
  const cavK = cavitationThresholdKts(player.depth);
  player.cavitating = (player.speed > cavK);
  if (player.cavitating) n = clamp(n + C.player.cavitationSpike, 0, 1);
  if (player.silent) n *= C.player.silentRunning.noiseMult;
  if (player.snorkeling && C.player.snorkelNoise) n = clamp(n + C.player.snorkelNoise, 0, 1);
  // Suppress natural decay while HP recharge compressor is running
  const _rechg = player.damage?.hpa?.recharging;
  if (!_rechg) player.noiseTransient = Math.max(0, player.noiseTransient - dt * 0.35);
  n = clamp(n + player.noiseTransient, 0, 1);
  // Flooding pumps add to acoustic signature
  const floodPenalty = _getDmgEffects ? (_getDmgEffects().noisePenalty || 0) : 0;
  player.noise = clamp(n + floodPenalty, 0, 1);
}

export { updateNoise, cavitationThresholdKts };
