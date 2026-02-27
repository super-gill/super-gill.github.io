(() => {
  'use strict';
  window.CONFIG = {
    world:{w:9000,h:2600,seaLevel:540,ground:2450,layerY1:900,layerY2:1150},
    camera:{followX:0.45,followY:0.55},
    player:{
      r:28,hpMax:100,
      speedMaxKts: 20,
      flankKts: 28,
      speedIncrementKts: 1,
      speedTau:1.2,accelMax:160,
      turnTau: 0.35,           // seconds to swing to commanded heading (0 or pi)
      turnSnapNoise: 0.10,    // transient noise when reversing course
      // (legacy continuous turn params kept for later)
      turnRateDeg:42,turnRateMinDeg:10,turnRateHighDeg:28,
      periscopeDepth:140,crashDiveRateMult:1.6,
      // Depth setpoint control (W/S adjusts ORDERED depth)
      depthStep: 60,          // world units per step
      depthHoldRepeat: 0.10,  // seconds per step while holding
      depthTau: 1.4,          // seconds to converge toward depth order
      depthRateMax: 170,      // max vertical speed (world units/s)

      // Ballast/buoyancy (W/S adjust ballast continuously)
      ballast: 0.0,            // -1..+1 (negative = buoyant/ascend, positive = heavy/sink)
      ballastRate: 0.85,       // per second change while holding W/S
      buoyAccel: 210,          // vertical acceleration from ballast
      buoyDamp: 0.85,          // vertical velocity damping per second
      vyMax: 190,

      flankNoiseBoost:0.55,flankTransient:0.35,
      silentRunning:{speedCap:10,noiseMult:0.70},
      emergencyTurn:{dur:2.2,cd:8.0,rudderDeg:35,noiseSpike:0.35},
      crashDive:{dur:2.4,cd:8.0,noiseSpike:0.25},
      noiseFloor:0.06,flowNoiseDiv:24,turnNoise:0.10,
      cavitationDepthRef:320,cavitationKtsRef:16,cavitationSlope:0.02,cavitationSpike:0.30,
      torpCd:0.38,cmCd:3.2,pingCd:7.0,pingPulse:1.25,
      torpArcDeg:40,torpEnableDist:220,
      missileCd:1.4,missileRequiresShallow:true,
      // Periscope (P): reveals ships but increases your detectability by ships
      periscope:{ cd: 10.0, dur: 4.5, revealR: 3600, detectBoost: 1.55, noiseSpike: 0.10 }
    },
    detection:{detectT:7.5,seenT:2.6,proximityR:240,pingDetectR:2200},
    torpedo:{speed:600,life:6.4,dmg:42,seekRange:920,seekFOV:0.44,turnRate:1.35,reacquireChance:0.035,arming:0.22,searchSnake:0.18},
    missile:{speed:740,life:4.2,dmg:140,tipDelay:0.35,maxTurn:2.8},
    decoy:{noisemakerLifeMin:5.5,noisemakerLifeMax:8.0,noisemakerR:18,sigPlayer:1.2,sigEnemy:1.0,flareLifeMin:1.8,flareLifeMax:2.6,flareR:12},
    enemy:{
      boatShare:0.40,
      hearBoatRange:2400,hearSubRange:2000,hearSignalMin:0.06,hearPBase:0.04,hearPScale:1.9,
      susInvestigate:0.30,susEngage:0.72,
      quietNoiseThreshold:0.18,susDecayBase:0.015,susDecayQuietExtra:0.012,contactMaxAge:9.0,contactMaxAgeQuiet:5.5,
      fireMinSus:0.48,fireMaxAge:10.5,fireMinStrength:0.55,
      boatFireEngage:[0.9,1.5],boatFireOther:[2.4,3.6],
      subFireEngage:[0.9,1.6],subFireOther:[2.6,4.2],
      subNavT:[2.0,4.8],subPingCd:[10.0,17.0],subPingRange:2800,
      subTorpReactR:700,boatTorpReactR:280,
      subTorpArcDeg:40
    },
    ship:{
      flareBurst:3,flareSideSpread:115,flareVyMin:760,flareVyMax:1040,flareGravity:720,
      sinkVx:[-70,70],sinkVy:[140,240],sinkExtraG:60,
      tracerLife:[0.06,0.14],tracerSpread:0.06,tracerBursts:[2,4]
    },
    visuals:{textWobble:false,rotatePlayer:false,screenBubbles:true,screenBubbleCols:12}
  };
})();
