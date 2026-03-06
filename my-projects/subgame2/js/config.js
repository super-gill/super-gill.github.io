(() => {
  'use strict';
  window.CONFIG = {
    world:{
      w:12000, h:12000,
      seaLevel:0,
      ground:1900,
      layerY1:360,
      layerY2:480,
    },
    camera:{
      zoom:0.12,
      followLead:60,
    },
    player:{
      r:28, hpMax:100,
      speedMaxKts:20,
      flankKts:28,
      speedIncrementKts:1,
      speedTau:1.4,
      turnRateDeg:18,
      turnRateMinDeg:5,
      periscopeDepth:140, crashDiveRateMult:1.6,
      depthStep:60, depthHoldRepeat:0.10,
      depthTau:1.4, depthRateMax:170,
      ballast:0.0, ballastRate:0.85, buoyAccel:210, buoyDamp:0.85, vyMax:190,
      flankNoiseBoost:0.42, flankTransient:0.28,
      silentRunning:{speedCap:8, noiseMult:0.55},
      emergencyTurn:{dur:2.2, cd:8.0, rudderDeg:35, noiseSpike:0.28},
      crashDive:{dur:2.4, cd:8.0, noiseSpike:0.18},
      noiseFloor:0.04, flowNoiseDiv:32, turnNoise:0.07,
      cavitationDepthRef:380, cavitationKtsRef:18, cavitationSlope:0.018, cavitationSpike:0.22,
      torpCd:0.45, cmCd:4.5, pingCd:9.0, pingPulse:1.25,
      torpArcDeg:55, torpEnableDist:220,
      torpWireMaxRange:3200,      // world units before wire snaps
      torpWireBreakTurnDeg:55,    // cumulative turn past this snaps wire
      missileCd:1.4, missileRequiresShallow:true,
      periscope:{cd:10.0, dur:4.5, revealR:3600, detectBoost:1.55, noiseSpike:0.10}
    },
    detection:{detectT:7.5, seenT:2.6, proximityR:180, pingDetectR:1800},
    torpedo:{speed:580, life:7.2, dmg:45, seekRange:760, seekFOV:0.38, turnRate:1.20, reacquireChance:0.022, arming:0.30, searchSnake:0.14},
    missile:{speed:740, life:4.2, dmg:140, tipDelay:0.35, maxTurn:2.8},
    decoy:{noisemakerLifeMin:7.0, noisemakerLifeMax:11.0, noisemakerR:22, sigPlayer:1.4, sigEnemy:1.0, flareLifeMin:1.8, flareLifeMax:2.6, flareR:12},
    enemy:{
      boatShare:0.35,
      hearBoatRange:1800, hearSubRange:1600, hearSignalMin:0.12, hearPBase:0.10, hearPScale:1.1,
      susInvestigate:0.42, susEngage:0.85,
      quietNoiseThreshold:0.14, susDecayBase:0.022, susDecayQuietExtra:0.020,
      contactMaxAge:12.0, contactMaxAgeQuiet:6.5,
      fireMinSus:0.65, fireMaxAge:9.0, fireMinStrength:0.68,
      boatFireEngage:[1.4,2.2], boatFireOther:[3.5,5.5],
      subFireEngage:[1.4,2.4], subFireOther:[3.8,6.0],
      subNavT:[4.0,9.0], subPingCd:[18.0,32.0], subPingRange:2000,
      subTorpReactR:500, boatTorpReactR:220,
      subTorpArcDeg:55,
      spawnMinR:2200, spawnMaxR:4200,
    },
    ship:{
      tracerLife:[0.06,0.14], tracerSpread:0.06, tracerBursts:[2,4]
    },
    visuals:{screenBubbles:false}
  };
})();
