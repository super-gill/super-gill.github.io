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
      speedTau:10,            // seconds to close speed gap (sluggish acceleration)
      turnRateDeg:3.5,        // °/s at flank — gives ~2.4nm turning radius at 28kt
      turnRateMinDeg:0.6,     // °/s at creep
      periscopeDepth:140, crashDiveRateMult:1.6,
      depthStep:60, depthHoldRepeat:0.10,
      depthTau:8.0, depthRateMax:1.8,   // 1.8 m/s normal depth rate — realistic
      ballast:0.0, ballastRate:0.85, buoyAccel:210, buoyDamp:0.85, vyMax:190,
      flankNoiseBoost:0.42, flankTransient:0.28,
      silentRunning:{speedCap:8, noiseMult:0.55},
      emergencyTurn:{dur:2.2, cd:8.0, rudderDeg:35, noiseSpike:0.28},
      crashDive:{dur:2.4, cd:8.0, noiseSpike:0.18},
      noiseFloor:0.04, flowNoiseDiv:32, turnNoise:0.07,
      cavitationDepthRef:380, cavitationKtsRef:18, cavitationSlope:0.018, cavitationSpike:0.22,
      torpCd:0.45, cmCd:4.5, pingCd:9.0, pingPulse:1.25,
      torpTubes:4, torpStock:32, torpReloadTime:28, fireDelay:1.8,
      torpArcDeg:55, torpEnableDist:300,
      torpWireMaxRange:3000,      // world units ~30km (Spearfish class runout)
      torpWireBreakTurnDeg:90,    // generous cumulative turn — wire-guided shots need to manoeuvre
      missileCd:1.4, missileRequiresShallow:true,
      periscope:{cd:10.0, dur:4.5, revealR:3600, detectBoost:1.55, noiseSpike:0.10},
      speedDeafness:{startKts:4, fullDeafKts:10},  // passive sonar degrades with own speed
      launchTransientRange:2000, launchTransientSus:0.35,  // torpedo launch noise
      pingDatumRange:5000, pingDatumSus:0.75,     // active ping alerts all enemies
      hitR:30
    },
    detection:{detectT:7.5, seenT:2.6, proximityR:180, pingDetectR:1800},
    tma:{
      defaultRange:   900,   // wu — how far to project bearing line when no solution
      minObs:           2,   // observations needed before attempting solver
      goodObs:          6,   // observations for full quality contribution
      minBaseline:     80,   // wu — minimum player movement before solver counts it
      goodBaseline:   350,   // wu — crawl(3wu/s)*150s=450wu, so full baseline achievable
      maxBearingAge:  150,   // game-seconds — long enough for slow manoeuvres to contribute
      maxBearings:     24,   // max stored per contact
      qualityThresholdBlob:  0.15,  // quality needed to show position blob
      qualityThresholdLabel: 0.35,  // quality for S# label at blob (not line)
      qualityThresholdRange: 0.35,  // SOLUTION tier floor — range fed to TDC, DEGRADED fire allowed
      qualityThresholdSolid: 0.70,  // SOLID tier — full lead-angle intercept, wire position updates
    },
    torpedo:{speed:28, approachSpeed:15, life:210, dmg:55,
             seekRange:500, seekFOV:0.85,        // active homing — narrow cone
             passiveFOV: 2.4,                    // passive search — ~137° half-angle, nearly omnidirectional
             turnRate:1.55, reacquireChance:0.022, arming:0.30, searchSnake:0.18,
             seduceFOV:2.80, seduceRange:300, seduceTime:7.0,  // noisemaker: wide pull, 7s chase
             depthRate:12,          // m/s max depth change rate
             vertWindow:120,        // m — seeker vertical acquisition window ±
             vertFuse:60,           // m — detonation vertical tolerance ±
            },
    missile:{speed:80, life:20, dmg:140, tipDelay:0.35, maxTurn:2.8},
    decoy:{noisemakerLifeMin:7.0, noisemakerLifeMax:11.0, noisemakerR:22, sigPlayer:1.4, sigEnemy:1.0, flareLifeMin:1.8, flareLifeMax:2.6, flareR:12},
    enemy:{
      boatShare:0.35,
      hearBoatRange:2800, hearSubRange:3200, hearSignalMin:0.04, hearPBase:0.03, hearPScale:1.8,
      wolfpackDatumRange:4500,  // enemies share player datum within this radius
      fireTransientRange:1800, fireTransientSus:0.45,  // launch heard by player

      susInvestigate:0.18, susEngage:0.72,
      quietNoiseThreshold:0.14, susDecayBase:0.008, susDecayQuietExtra:0.012,
      contactMaxAge:12.0, contactMaxAgeQuiet:6.5,
      fireMinSus:0.55, fireMaxAge:16.0, fireMinStrength:0.40,
      boatFireEngage:[0.8,1.4], boatFireOther:[2.5,4.0],
      subFireEngage:[0.8,1.6], subFireOther:[2.5,4.5],
      subNavT:[120,280], subPingCd:[14.0,26.0], subPingRange:2200,
      subNoiseMin:0.58, subNoiseMax:0.82,  // enemy subs run louder than player
      subSprintKtsMin:13, subSprintKtsMax:18,  // faster wolfpack sprints

      subTorpReactR:1200, boatTorpReactR:400,
      subTorpArcDeg:55,
      subTubes:2, subTorpStock:6, subReloadTime:40,
      // Enemy torpedo parameters — Soviet-era: same model, slightly behind the curve
      subTorpSpeed:26,          // slightly slower sprint
      subTorpApproachSpeed:13,  // slower passive approach
      subTorpSeekRange:400,     // shorter seeker range
      subTorpReacquire:0.010,   // less reliable reacquisition
      subTorpLife:220,          // slightly longer run (heavier fuel load, less efficient)
      spawnMinR:500, spawnMaxR:1500,

      // Wave system
      waveSpawnMinR:2500, waveSpawnMaxR:3500,
      waveFormationSpread:500,   // wu between group members in line-abreast
      waveDelay:18.0,            // seconds between last kill and next wave spawn
      // Wave compositions: array of role strings per wave (wave 3+ uses last entry)
      waveComps:[
        ['hunter','hunter'],                              // wave 1 — tutorial duel
        ['pinger','hunter','hunter'],                     // wave 2 — flush + kill
        ['pinger','hunter','interceptor','interceptor'],  // wave 3+ — full doctrine
      ],
      // Interceptor: how far ahead of projected player track to sprint
      interceptorLeadTime:90,   // seconds of player track to project forward
      interceptorAmbushSpd:3,   // kt — nearly silent when holding ambush position
    },
    ship:{
      tracerLife:[0.06,0.14], tracerSpread:0.06, tracerBursts:[2,4]
    },
    visuals:{screenBubbles:false}
  };
})();