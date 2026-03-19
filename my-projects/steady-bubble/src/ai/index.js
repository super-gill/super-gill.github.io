'use strict';

// ── AI coordinator — re-exports from sub-modules ────────────────────────────
import {
  wrapDx, wrapDy, layerPenalty, inLayer,
  solveEnemyTMA, enemyRegisterBearing, enemyHasFireSolution,
  enemyUpdateContactFromPing, enemyMaybeHearPlayer,
  enemySpeedDeafness, enemyDecay, updateEnemyNoise,
} from './perception.js';

import {
  spawnEnemy, spawnSub, spawnSSBN, spawnZeta, spawnGamma, spawnEta,
  spawnEpsilon, spawnTheta, spawnNovember, spawnWhiskey, spawnYankee,
  spawnPapa, spawnGolf, _spawnWarship,
  spawnIota, spawnKappa, spawnLambda, spawnMu, spawnCivilian,
} from './spawn.js';

import {
  wolfpackShareDatum, shipShareContact, shipActiveSonar, triggerHuntState,
  _bindComms,
} from './tactics.js';

// Re-export _bindComms for circular dep resolution
export { _bindComms };

// ════════════════════════════════════════════════════════════════════════
// EXPORT (mirrors V1 window.AI shape)
// ════════════════════════════════════════════════════════════════════════
export const AI = {
  wrapDx,wrapDy,layerPenalty,enemyHasFireSolution,enemyUpdateContactFromPing,
  enemyMaybeHearPlayer,enemyDecay,updateEnemyNoise,solveEnemyTMA,enemyRegisterBearing,
  spawnEnemy,spawnSub,spawnSSBN,spawnZeta,spawnGamma,spawnEta,spawnEpsilon,spawnTheta,
  spawnNovember,spawnWhiskey,spawnYankee,spawnPapa,spawnGolf,
  spawnIota,spawnKappa,spawnLambda,spawnMu,spawnCivilian,wolfpackShareDatum,shipShareContact,
  shipActiveSonar,triggerHuntState,
};
