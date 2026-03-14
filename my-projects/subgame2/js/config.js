(() => {
  'use strict';
  window.CONFIG = {
    world:{
      w:12000, h:12000,
      seaLevel:0,
      ground:1900,
      layerY1:180,
      layerY2:280,
      safeDivingDepth:300,     // SDD — routine operations ceiling
      divingLimit:400,         // DL  — certified maximum, CO accountable if exceeded
      designDepth:480,         // DD  — structural design limit, emergency territory
      maxDepth:500,            // Collapse depth — structural seep begins here
      crushDepth:540,          // Crush depth — catastrophic structural failure (8% deeper)
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
      speedTau:45,            // seconds to close speed gap — realistic SSN acceleration
      turnRateDeg:2.2,        // °/s at flank — ~8.9km turning radius at 28kt
      turnRateMinDeg:0.5,     // °/s at creep
      periscopeDepth:140,
      depthStep:60, depthHoldRepeat:0.10,
      depthTau:8.0, depthRateMax:1.8,   // 1.8 m/s normal (~108m/min) — SSN realistic
      buoyancyScale:3.6,   // m/s per fill-unit deviation; neutralFill=0.50 → max ±1.8 m/s
      fillRate:0.022,      // fill fraction/s max rate of tank change (hydraulic ops)
      kFill:0.0016,        // fill units per metre depth error for controller
      ballast:0.0, ballastRate:0.85, buoyAccel:210, buoyDamp:0.85, vyMax:190,
      flankNoiseBoost:0.42, flankTransient:0.28,
      silentRunning:{speedCap:8, noiseMult:0.55},
      emergencyTurn:{dur:2.2, cd:8.0, rudderDeg:35, noiseSpike:0.28},
      crashDive:{dur:3.5, cd:12.0, noiseSpike:0.35, tauOverride:0.4, rateMult:3.5},
      noiseFloor:0.04, flowNoiseDiv:32, turnNoise:0.07,
      // ── Trim / buoyancy ──────────────────────────────────────────────────
      trimLevers:{ fore_ends:-2.0, control_room:-0.8, aux_section:-0.2, reactor_comp:0.0, engine_room:0.8, aft_ends:2.0 },
      trimFullAuthority:2.0,   // trim value at which planes are fully demanded
      planeMinSpeed:10.0,      // kt — below this planes lose effectiveness linearly
      floodFillEquiv:0.28,     // flood mass as equivalent MBT fill per flooded section
                               // 2 sections flooded + normal tanks ≈ 2.0 m/s sink
                               // 2 sections flooded + blown tanks ≈ 0.2 m/s (recoverable)
                               // 3 sections flooded ≈ 3.0 m/s sink (boat is lost)
      // ── HPA (high-pressure air) ───────────────────────────────────────────
      hpa:{
        maxPressure:    207,   // bar — standard RN HP air system charge
        reservePressure:207,   // bar — reserve bank, isolated until needed
        ambientPerMetre:0.1,   // bar/m — ambient water pressure per metre depth
        controlMinRatio:1.2,   // pressure must be >= ambient*this for full authority
        ascentCostPerMetre:0.04, // bar per metre of ascent × (1+depth/300) multiplier
        torpedoCost:    2,     // bar per torpedo fire (impulse air only)
        blowFlowRate:      0.5,    // bar/s drained from bank per 50 bar differential
                                   // actual drain = blowFlowRate × (bankPressure - ambient) / referenceBar
        blowReferenceBar:  50,     // normalisation reference (bar)
        blowFlowToVy:      0.4,    // m/s surge component per bar/s (supplemental — buoyancy does main work)
        blowFlowToFillRate:0.025,  // fill fraction drained per bar/s of air flow (5 tanks, emptied in ~20s at 300m)
        lpRechargeRate: 0.4,   // bar/s — LP compressor, always running silently
        hpRechargeRate: 2.5,   // bar/s — HP compressor, player toggle, noisy
        rechargeNoiseAdd:0.55, // noise/s during HP recharge (exceeds signature.js decay of 0.35/s)
      },
      cavitationDepthRef:380, cavitationKtsRef:18, cavitationSlope:0.018, cavitationSpike:0.22,
      torpCd:0.45, cmCd:4.5, cmStock:12, pingCd:9.0, pingPulse:1.25,
      pingDazzle:{duration:1.5, range:1800},  // active ping disrupts enemy torpedo seekers
      torpTubes:4, torpStock:32, torpReloadTime:28, fireDelay:4.5,
      torpArcDeg:55, torpEnableDist:300,
      torpWireMaxRange:3000,      // world units ~30km (Spearfish class runout)
      torpWireBreakTurnDeg:90,    // cumulative turn before wire stress (legacy, kept for reference)
      wireMaxLaunchKts:15,        // max speed to fire a wire-guided shot
      wireSafeKts:15,             // below this — no stress
      wireStressKts:20,           // above this — wire parts in seconds
      wireStressBreakTime:25,     // seconds to break at wireStressKts (linear between safe and stress)
      wireInstantBreakKts:22,     // above this — parts within ~3s
      periscope:{cd:10.0, dur:4.5, revealR:3600, detectBoost:1.55, noiseSpike:0.10},
      speedDeafness:{startKts:4, fullDeafKts:10},  // passive sonar degrades with own speed
      launchTransientRange:2000, launchTransientSus:0.35,  // torpedo launch noise
      pingDatumRange:5000, pingDatumSus:0.75,     // active ping alerts all enemies
      hitR:30,
      // ── Reactor / propulsion casualties ──────────────────────────────────
      casualties:{
        coolantLeak:{
          stressThreshold:15,     // seconds of sustained flank+deep before risk
          riskPerSec:0.008,       // chance/s once threshold exceeded
          degradedRiskMult:3.0,   // multiplier when primary_coolant degraded
          countdown:45,           // seconds until automatic SCRAM
          fastMult:1.5,           // timer rate at flank speed
          slowMult:0.5,           // timer rate below 1/3 max speed
          fixChanceHigh:0.65,     // crew fix probability when running slow
          fixChanceLow:0.30,      // crew fix probability when running fast
        },
        steamLeak:{
          shockChance:0.12,       // chance per hit when turbines/pressuriser degraded+
          repairTime:[30,60],     // seconds to auto-repair
          speedCap:7,             // diesel only
        },
        turbineTrip:{
          shockChance:0.15,       // chance per nearby explosion (any hit)
          throttleSnapThreshold:10, // kt/s change to trigger risk
          throttleSnapChance:0.20,  // chance on emergency throttle change
          recoveryTime:[20,30],   // seconds to auto-recover
          speedCap:12,            // partial trip
        },
        reactorRunaway:{
          hitChance:0.08,         // chance on severe reactor/coolant hit
          transientRange:3000,    // acoustic event range
          transientSus:0.60,      // suspicion boost to enemies
        },
      },
    },
    detection:{detectT:7.5, seenT:2.6, proximityR:180, pingDetectR:1800,
               cz:{min:4800, max:5500, boost:3.2}},  // convergence zone range band + signal multiplier
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
    torpedo:{speed:50, approachSpeed:18, life:210, dmg:55,
             seekRange:500, seekFOV:0.85,        // active homing — narrow cone
             passiveFOV: 2.4,                    // passive search — ~137° half-angle, nearly omnidirectional
             turnRate:1.55, reacquireChance:0.012, arming:0.30, searchSnake:0.18,
             seduceFOV:2.80, seduceRange:300, seduceTime:12.0, reacquireDelay:5.5,  // noisemaker: wide pull, 12s chase, 5.5s reacquire
             depthRate:12,          // m/s max depth change rate
             vertWindow:120,        // m — seeker vertical acquisition window ±
             vertFuse:60,           // m — detonation vertical tolerance ±
            },
    decoy:{noisemakerLifeMin:14.0, noisemakerLifeMax:20.0, noisemakerR:22, sigPlayer:1.4, sigEnemy:1.0, flareLifeMin:1.8, flareLifeMax:2.6, flareR:12},
    enemy:{
      boatShare:0.35,
      hearBoatRange:2200, hearSubRange:2500, hearSignalMin:0.04, hearPBase:0.025, hearPScale:1.5,
      wolfpackDatumRange:3500,  // enemies share player datum within this radius
      fireTransientRange:1800, fireTransientSus:0.45,  // launch heard by player

      susInvestigate:0.22, susEngage:0.78,
      quietNoiseThreshold:0.14, susDecayBase:0.010, susDecayQuietExtra:0.015,
      contactMaxAge:10.0, contactMaxAgeQuiet:5.0,
      fireMinSus:0.62, fireMaxAge:14.0, fireMinStrength:0.45,
      boatFireEngage:[1.2,2.0], boatFireOther:[3.5,5.5],
      subFireEngage:[1.2,2.2], subFireOther:[3.5,6.0],
      subNavT:[120,280], subPingCd:[14.0,26.0], subPingRange:2200,
      subNoiseMin:0.58, subNoiseMax:0.82,  // enemy subs run louder than player
      subSprintKtsMin:13, subSprintKtsMax:18,  // faster wolfpack sprints

      subTorpReactR:1600, boatTorpReactR:400,
      subTorpArcDeg:55,
      subTubes:2, subTorpStock:6, subReloadTime:40,
      // Enemy torpedo parameters — Soviet-era: same model, slightly behind the curve
      subTorpSpeed:45,          // slightly slower sprint
      subTorpApproachSpeed:16,  // slower passive approach
      subTorpSeekRange:400,     // shorter seeker range
      subTorpReacquire:0.010,   // less reliable reacquisition
      subTorpLife:220,          // slightly longer run (heavier fuel load, less efficient)
      // Counter-fire — degraded intercept under panic conditions
      counterFire:{
        reactionDelay:[2.0,4.0],  // seconds before first counter-shot
        staggerDelay:[1.5,3.0],   // seconds between staggered shots
        maxInitial:2,             // tubes in first salvo (hold rest as follow-up)
        panicBlurMult:2.5,        // TMA blur multiplier under panic
        iterCount:4,              // intercept iterations (vs 6 for aimed fire)
      },
      // Evasion variety — prevent deterministic patterns
      evasion:{
        skipLayerChance:0.25,     // chance to hold depth instead of layer exploit
        sprint2ArcMin:60,         // degrees — offset range for sprint2 heading
        sprint2ArcMax:180,
        boldManeuverChance:0.15,  // chance to turn toward torpedo during knuckle
        knuckleDurMin:3,          // seconds (was fixed 5-7)
        knuckleDurMax:10,
      },
      // Fire adaptation — enemy learns from missed shots
      adaptation:{
        blurReductionPerMiss:0.15, // tighten blur 15% per miss
        blurFloor:0.50,            // can't go below 50% of original blur
        resetTimeout:60,           // seconds since last miss before reset
        resetCourseDeg:30,         // player heading change triggers reset
      },
      spawnMinR:1500, spawnMaxR:2500,

      // Wave system
      waveSpawnMinR:4000, waveSpawnMaxR:6000,
      waveFormationSpread:1200,   // wu between group members in line-abreast
      waveDelay:30.0,            // seconds between last kill and next wave spawn
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
    visuals:{screenBubbles:false},
    layout:{panelH:190, depthStripW:88, uiScaleDefault:1.0},
  };
})();