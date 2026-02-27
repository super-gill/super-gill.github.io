// config.js — Gameplay tuning (v4 lean)
(() => {
  'use strict';
  window.CONFIG = {
    world: { w:7000, h:2200, seaLevel:520, ground:2050, layerY1:860, layerY2:1080 },
    camera: { followX:0.45, followY:0.55 },

    player: {
      r: 28, hpMax: 100,
      acc: 320, vmax: 360,
      sprintAcc: 560, sprintVmax: 520, sprintNoiseBoost: 0.45,
      noiseFloor: 0.08, noiseRampStart: 55, noiseRampDiv: 220,

      torpCd: 0.22, missCd: 0.95, sonarCd: 5.6, cmCd: 2.8,
      sonarPulse: 1.25,
      torpArcDeg: 40
    },

    detection: { detectT:5.0, seenT:2.4, proximityR:210, pingDetectR:1750 },

    torpedo: {
      speed: 620, life: 5.2, dmg: 42,
      seekRange: 780, seekFOV: 0.42, turnRate: 1.55, reacquireChance: 0.045,
      arming: 0.18
    },

    missile: { speed: 720, life: 4.0, dmg: 140, tipDelay: 0.35, maxTurn: 3.2 },

    decoy: {
      noisemakerLifeMin:5.0, noisemakerLifeMax:7.5, noisemakerR:18, noisemakerSigPlayer:1.15, noisemakerSigEnemy:1.0,
      flareLifeMin:1.4, flareLifeMax:2.2, flareR:12
    },

    enemy: {
      boatShare: 0.40,
      hearBoatRange: 2200, hearSubRange: 1900,
      hearSignalMin: 0.07, hearPBase: 0.05, hearPScale: 1.80,
      susInvestigate: 0.30, susEngage: 0.70,
      quietNoiseThreshold: 0.22, susDecayBase: 0.018, susDecayQuietExtra: 0.010,
      contactMaxAge: 8.5, contactMaxAgeQuiet: 5.0,
      fireMinSus: 0.45, fireMaxAge: 12.0,
      boatFireEngageMin:0.65, boatFireEngageMax:1.15, boatFireOtherMin:1.9, boatFireOtherMax:3.2,
      subFireEngageMin:0.60, subFireEngageMax:1.10, subFireOtherMin:2.3, subFireOtherMax:4.0,
      subTorpReactR: 620, boatTorpReactR: 260,
      // Enemy submarines: torpedo firing cones (deg). They can fire forward OR aft.
      enemySubTorpArcDeg: 40
    },

    ship: {
      flareBurst: 3, flareSideSpread: 95, flareVyMin: 560, flareVyMax: 860, flareGravity: 720,
      sinkVxMin:-60, sinkVxMax:60, sinkVyMin:120, sinkVyMax:200, sinkExtraG:60,
      tracerLifeMin:0.06, tracerLifeMax:0.14, tracerSpread:0.06, tracerBurstsMin:2, tracerBurstsMax:4,
      // Player passive detection of surface ships
      shipAudibilityAboveLayer: 1.55,   // multiplier when the ship is above thermocline relative to player
      shipAudibilitySameSide: 1.25,     // multiplier when ship+player are on same side of thermocline
      shipAudibilityNearSurface: 1.35,  // multiplier when player is shallow
      shipBlobUncertaintyMult: 0.75     // lower = tighter (more obvious) blobs for ships

    },

    visuals: { textWobble:false, screenBubbles:true, screenBubbleCols:12 }
  };
})();
