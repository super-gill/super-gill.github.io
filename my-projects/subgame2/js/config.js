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
      periscopeDepth:18,             // m — max depth to use periscope (~60ft, standard SSN PD)
      depthStep:60, depthHoldRepeat:0.10,
      depthTau:8.0, depthRateMax:1.8,   // 1.8 m/s normal (~108m/min) — SSN realistic
      buoyancyScale:3.6,   // m/s per fill-unit deviation; neutralFill=0.50 → max ±1.8 m/s
      fillRate:0.022,      // fill fraction/s max rate of tank change (hydraulic ops)
      kFill:0.0016,        // fill units per metre depth error (legacy — superseded by two-zone)
      depthBrakeZone:15,   // m — within this range of target, controller scales back authority
      depthMaxFillOffset:0.08, // max fill offset from neutral outside brake zone (→ ~0.29 m/s)
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
    // ── NATO vessel presets — one complete object per playable submarine ──────
    // Selecting a vessel at the start screen sets window.CONFIG.player to one of these.
    // Every field that any code reads from C.player must appear in every preset.
    // No inheritance — if a field is missing it will be immediately obvious as undefined.
    playerPresets:(()=>{
      const mastsUS=[
        {key:'scope_atk',label:'ATK SCOPE',safeDepth:22,crushDepth:40,raiseDur:4,lowerDur:4,type:'periscope'},
        {key:'esm',      label:'ESM',      safeDepth:22,crushDepth:38,raiseDur:3,lowerDur:3,type:'esm'},
        {key:'radar',    label:'RADAR',    safeDepth:22,crushDepth:38,raiseDur:3,lowerDur:3,type:'radar'},
        {key:'comms',    label:'COMMS',    safeDepth:22,crushDepth:38,raiseDur:3,lowerDur:3,type:'comms'},
      ];
      const mastsUK=[
        {key:'scope_atk', label:'ATK SCOPE', safeDepth:22,crushDepth:40,raiseDur:4,lowerDur:4,type:'periscope'},
        {key:'scope_srch',label:'SRCH SCOPE',safeDepth:22,crushDepth:40,raiseDur:5,lowerDur:5,type:'periscope'},
        {key:'esm',       label:'ESM',       safeDepth:22,crushDepth:38,raiseDur:3,lowerDur:3,type:'esm'},
        {key:'radar',     label:'RADAR',     safeDepth:22,crushDepth:38,raiseDur:3,lowerDur:3,type:'radar'},
        {key:'comms',     label:'COMMS',     safeDepth:22,crushDepth:38,raiseDur:3,lowerDur:3,type:'comms'},
      ];
      // Fields shared across all presets (physics constants, HPA, casualties, etc.)
      const sh={
        speedIncrementKts:1, speedTau:45, turnRateDeg:2.2, turnRateMinDeg:0.5,
        periscopeDepth:18, depthStep:60, depthHoldRepeat:0.10,
        depthTau:8.0, depthRateMax:1.8, buoyancyScale:3.6, fillRate:0.022, kFill:0.0016,
        ballast:0.0, ballastRate:0.85, buoyAccel:210, buoyDamp:0.85, vyMax:190,
        flankTransient:0.28,
        silentRunning:{speedCap:8, noiseMult:0.55},
        emergencyTurn:{dur:2.2, cd:8.0, rudderDeg:35, noiseSpike:0.28},
        crashDive:{dur:3.5, cd:12.0, noiseSpike:0.35, tauOverride:0.4, rateMult:3.5},
        flowNoiseDiv:32, turnNoise:0.07,
        hpa:{maxPressure:207,reservePressure:207,ambientPerMetre:0.1,
             controlMinRatio:1.2,ascentCostPerMetre:0.04,torpedoCost:2,
             blowFlowRate:0.5,blowReferenceBar:50,blowFlowToVy:0.4,blowFlowToFillRate:0.025,
             lpRechargeRate:0.4,hpRechargeRate:2.5,rechargeNoiseAdd:0.55},
        cavitationDepthRef:380, cavitationSlope:0.018, cavitationSpike:0.22,
        torpCd:0.45, cmCd:4.5, pingCd:9.0, pingPulse:1.25,
        pingDazzle:{duration:1.5, range:1800},
        torpArcDeg:55, torpEnableDist:300, fireDelay:4.5,
        torpWireMaxRange:3000, torpWireBreakTurnDeg:90,
        wireMaxLaunchKts:15, wireSafeKts:15, wireStressKts:20,
        wireStressBreakTime:25, wireInstantBreakKts:22,
        periscope:{cd:10.0,dur:4.5,revealR:3600,detectBoost:1.55,noiseSpike:0.10},
        launchTransientRange:2000, launchTransientSus:0.35,
        pingDatumRange:5000, pingDatumSus:0.75,
        trimLevers:{fore_ends:-2.0,control_room:-0.8,aux_section:-0.2,reactor_comp:0.0,engine_room:0.8,aft_ends:2.0},
        trimFullAuthority:2.0, planeMinSpeed:10.0, floodFillEquiv:0.28,
        casualties:{
          coolantLeak:{stressThreshold:15,riskPerSec:0.008,degradedRiskMult:3.0,
                       countdown:45,fastMult:1.5,slowMult:0.5,fixChanceHigh:0.65,fixChanceLow:0.30},
          steamLeak:{shockChance:0.12,repairTime:[30,60],speedCap:7},
          turbineTrip:{shockChance:0.15,throttleSnapThreshold:10,throttleSnapChance:0.20,
                       recoveryTime:[20,30],speedCap:12},
          reactorRunaway:{hitChance:0.08,transientRange:3000,transientSus:0.60},
        },
        // ── ASCM — default no missiles (overridden per vessel) ───────────────
        torpWeapon: 'mk48_adcap', missileStock: 0, missileTypes: [], vlsCells: 0, vlsWeapon: null,
        // ── Battery — nuclear defaults (always full except SCRAM) ─────────────
        isDiesel: false,
        battery:{ drainOnScram:0.0020, chargeRate:0.008 },
        snorkelDepth:12, snorkelNoise:0, snorkelSpeedCap:100,
        hasTowedArray: true,
        masts: mastsUS,
        esmRange:12000, radarRange:7000,
        // ── Sonar geometry — bow array coverage + deaf arc (baffles) ─────────
        // All angles in degrees; code converts to radians when reading.
        // Bow array: full sensitivity within ±bowHullHalfAngleDeg of ahead.
        // Deaf arc: stern sector masked by own propeller noise, widens with speed.
        sonar:{
          bowHullHalfAngleDeg:    150,   // degrees — full coverage from dead ahead (±150° = everything except stern 30°)
          baffleHalfAngleDegBase:  15,   // degrees at rest / very slow
          baffleHalfAngleDegPerKt:  1.5, // degrees added per knot — widens with speed
          baffleHalfAngleDegMax:   45,   // degrees maximum (reached ~20kt)
          baffleRolloffDeg:        20,   // degrees of gradient between full sensitivity and dead zone
          // Soviet enemy sonar — louder machinery = wider deaf arc
          enemyBaffleBase:         20,   // degrees base
          enemyBafflePerKt:         2.0, // degrees per knot
          enemyBaffleMax:          55,   // degrees maximum
        },
      };
      return [
        {...sh, key:'688i',      name:'USS DALLAS',       vesselClass:'LOS ANGELES CLASS', nation:'US', difficulty:'medium',
                flavour:'Cold War workhorse. Balanced across all systems.',
                lore:[
                  'SSN-700 · Commissioned 1981 · Los Angeles class — 62 boats built over 22 years',
                  'The backbone of the Cold War US submarine fleet. Balanced and capable across all systems.',
                  'Conducted extensive intelligence patrols in Soviet home waters throughout the 1980s.',
                  'Standard loadout: 26 MK-48 ADCAP torpedoes plus Harpoon anti-ship and TASM cruise missiles.',
                  'Immortalised in The Hunt for Red October. Still in frontline service into the 2000s.',
                  'Recommended for new players who want capable all-round performance with no major weaknesses.',
                ],
                divingLimitM:400, sonarSuite:'AN/BQQ-5D', sonarQuality:0.85,
                divingLimit:400, safeDivingDepth:300, designDepth:450, maxDepth:480, crushDepth:520,
                torpWeapon:'mk48_adcap', towedArray:'TB-16 / TB-23',
                r:28,hpMax:100,hitR:30, speedMaxKts:20,flankKts:28,
                noiseFloor:0.040,flankNoiseBoost:0.42,
                torpTubes:4,torpStock:32,torpReloadTime:28,cmStock:12,
                vlsCells:12, vlsWeapon:'tasm', missileStock:8, missileTypes:['harpoon'],
                cavitationKtsRef:18,speedDeafness:{startKts:4,fullDeafKts:10}},
        {...sh, key:'trafalgar', name:'HMS TRAFALGAR',    vesselClass:'TRAFALGAR CLASS',   nation:'UK', difficulty:'medium', masts:mastsUK,
                flavour:'Pump-jet propulsor — dramatically quieter at speed.',
                lore:[
                  'S107 · Commissioned 1983 · Trafalgar class — lead boat of 7',
                  'First Royal Navy SSN fitted with a pump-jet propulsor instead of a conventional screw.',
                  'The pump-jet delivers a marked acoustic advantage at speed — a critical tactical asset.',
                  'Deployed throughout the Cold War and beyond. Gulf War 1991. Kosovo 1999.',
                  'Armed with SPEARFISH — one of the fastest and hardest-hitting torpedoes ever deployed at 70+ knots.',
                  'Recommended for players who favour aggressive high-speed tactics with superior stealth.',
                ],
                divingLimitM:400, sonarSuite:'TYPE 2076', sonarQuality:0.88,
                divingLimit:400, safeDivingDepth:300, designDepth:450, maxDepth:480, crushDepth:520,
                torpWeapon:'spearfish', towedArray:'TYPE 2026',
                r:26,hpMax:100,hitR:28, speedMaxKts:18,flankKts:26,
                noiseFloor:0.032,flankNoiseBoost:0.30,
                torpTubes:5,torpStock:25,torpReloadTime:30,cmStock:12,
                missileStock:6, missileTypes:['sub_harpoon'],
                cavitationKtsRef:20,speedDeafness:{startKts:5,fullDeafKts:12},
                // Pump-jet: quieter stern flow — slightly wider bow coverage, tighter baffles
                sonar:{...sh.sonar, bowHullHalfAngleDeg:155, baffleHalfAngleDegBase:13}},
        {...sh, key:'swiftsure', name:'HMS SWIFTSURE',    vesselClass:'SWIFTSURE CLASS',   nation:'UK', difficulty:'medium', masts:mastsUK,
                flavour:'Older design, fewer weapons. Quieter than 688i at depth.',
                lore:[
                  'S126 · Commissioned 1973 · Swiftsure class — lead boat of 6',
                  'Direct predecessor to the Trafalgar boats. Conventional screw — noisier at speed.',
                  'Deeper diving and faster than the preceding Valiant class. Good below-layer endurance.',
                  'Armed with TIGERFISH — wire-guided and reliable but substantially slower than SPEARFISH.',
                  'Smaller weapons magazine and older systems make this a harder boat to fight effectively.',
                  'Recommended for experienced players who want a challenge with older British equipment.',
                ],
                divingLimitM:350, sonarSuite:'TYPE 2020', sonarQuality:0.76,
                divingLimit:350, safeDivingDepth:260, designDepth:400, maxDepth:430, crushDepth:465,
                torpWeapon:'tigerfish', towedArray:'TYPE 2026',
                r:24,hpMax:90, hitR:26, speedMaxKts:18,flankKts:25,
                noiseFloor:0.038,flankNoiseBoost:0.38,
                torpTubes:5,torpStock:20,torpReloadTime:32,cmStock:10,
                missileStock:6, missileTypes:['sub_harpoon'],
                cavitationKtsRef:17,speedDeafness:{startKts:4,fullDeafKts:11},
                // Older design, conventional screw — slightly wider baffles than Trafalgar
                sonar:{...sh.sonar, baffleHalfAngleDegBase:18}},
        {...sh, key:'seawolf',   name:'USS CONNECTICUT',  vesselClass:'SEAWOLF CLASS',     nation:'US', difficulty:'easy',
                flavour:'Post-Cold War overkill. Eight tubes, extreme depth, maximum firepower.',
                lore:[
                  'SSN-22 · Commissioned 1998 · Seawolf class — only 3 completed before cancellation',
                  'Designed expressly to hunt Akula-class SSNs in Soviet home waters. Overbuilt for the task.',
                  'Eight torpedo tubes, 50-weapon magazine, 480m depth limit. The best submarine ever built.',
                  'AN/BQQ-5E sonar and TB-29A towed array — the most capable sensor suite in the fleet.',
                  'Post-Cold War budget cuts killed the programme. The war it was designed for never came.',
                  'Recommended for players who want maximum capability. The easy classification is by design.',
                ],
                divingLimitM:480, sonarSuite:'AN/BQQ-5E', sonarQuality:0.95,
                divingLimit:480, safeDivingDepth:365, designDepth:530, maxDepth:560, crushDepth:605,
                torpWeapon:'mk48_adcap', towedArray:'TB-16 / TB-29A',
                r:32,hpMax:120,hitR:35, speedMaxKts:20,flankKts:35,
                noiseFloor:0.025,flankNoiseBoost:0.28,
                torpTubes:8,torpStock:50,torpReloadTime:22,cmStock:16,
                missileStock:8, missileTypes:['harpoon'],
                cavitationKtsRef:22,speedDeafness:{startKts:5,fullDeafKts:13},
                // Best US sonar suite, quietest stern — tightest baffles, widest bow coverage
                sonar:{...sh.sonar, bowHullHalfAngleDeg:158, baffleHalfAngleDegBase:12}},
        {...sh, key:'type209',   name:'U-36',             vesselClass:'TYPE 209',          nation:'DE', difficulty:'expert',
                flavour:'Diesel-electric. Near-silent on battery. One wrong move and you are out of torpedoes.',
                lore:[
                  'U-36 · Commissioned 1997 · Deutsche Marine — Type 209/1400mod variant',
                  'Diesel-electric propulsion: near-silent on battery, but snorkel ops broadcast your position.',
                  'The most exported submarine design in history — operated by more than 14 navies worldwide.',
                  'Armed with SST-4 and SUT wire-guided torpedoes. Reliable but slower than NATO designs.',
                  'Maximum depth 250m. The thermal layer is your primary tactical tool — use it constantly.',
                  'Expert rating. Battery management and snorkel exposure are unforgiving. One error is fatal.',
                ],
                divingLimitM:250, sonarSuite:'ATLAS DBQS-21', sonarQuality:0.65,
                divingLimit:250, safeDivingDepth:190, designDepth:280, maxDepth:300, crushDepth:325,
                torpWeapon:'sst4', towedArray:'PRS-3 PASSIVE',
                r:18,hpMax:70, hitR:20, speedMaxKts:8, flankKts:12,
                noiseFloor:0.018,flankNoiseBoost:0.55,
                torpTubes:8,torpStock:14,torpReloadTime:35,cmStock:8,
                missileStock:4, missileTypes:['sm39'],
                cavitationKtsRef:11,speedDeafness:{startKts:6,fullDeafKts:14},
                // Diesel-electric overrides
                isDiesel:true, hasTowedArray:false,
                battery:{ drainPerKt:0.00014, chargeRate:0.003, surfaceChargeRate:0.005 },
                snorkelNoise:0.35, snorkelSpeedCap:5,
                // Electric motor: near-silent stern at low speed — very tight baffles, slow widening
                sonar:{...sh.sonar, baffleHalfAngleDegBase:12, baffleHalfAngleDegPerKt:1.0}},
      ];
    })(),
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
             // NATO Mk-48 ADCAP — superior seeker, strong ECCM, reliable reacquisition
             seekRange:520, seekFOV:0.90,         // active homing — wider cone than Soviet equivalent
             passiveFOV: 2.4,                     // passive search — ~137° half-angle, nearly omnidirectional
             turnRate:1.55, reacquireChance:0.016, arming:0.30, searchSnake:0.18,
             seduceFOV:2.80, seduceRange:300, seduceTime:9.5, reacquireDelay:5.5,  // ECCM: shorter CM chase (9.5s vs Soviet), harder to seduce
             depthRate:2,           // m/s max depth change rate — Mk-48 ADCAP ~1.7-2.0 m/s (was incorrectly 12)
             vertWindow:120,        // m — seeker vertical acquisition window ±
             vertFuse:60,           // m — detonation vertical tolerance ±
            },
    decoy:{noisemakerLifeMin:14.0, noisemakerLifeMax:20.0, noisemakerR:22, sigPlayer:1.4, sigEnemy:1.0, flareLifeMin:1.8, flareLifeMax:2.6, flareR:12},
    enemy:{
      boatShare:0.35,
      // Soviet passive sonar — effective range ~10% shorter than NATO equivalent
      hearBoatRange:2000, hearSubRange:2200, hearSignalMin:0.04, hearPBase:0.025, hearPScale:1.5,
      // Soviet speed deafness — own-hull noise degrades sonar at lower speeds than NATO
      deafStartKts:3, deafFullKts:8, deafnessCeil:0.92,
      wolfpackDatumRange:3500,  // enemies share player datum within this radius
      fireTransientRange:1800, fireTransientSus:0.45,  // launch heard by player

      susInvestigate:0.22, susEngage:0.78,
      quietNoiseThreshold:0.14, susDecayBase:0.003, susDecayQuietExtra:0.006,
      contactMaxAge:20.0, contactMaxAgeQuiet:12.0,
      fireMinSus:0.62, fireMaxAge:14.0, fireMinStrength:0.45,
      boatFireEngage:[22,35], boatFireOther:[50,80],
      boatTorpStock:6,   // Mk-46 equivalent — finite loadout
      boatTorpSpeed:38, boatTorpLife:90, boatTorpDmg:28, boatTorpSeek:380,
      subFireEngage:[1.2,2.2], subFireOther:[3.5,6.0],
      subNavT:[120,280], subPingCd:[14.0,26.0], subPingRange:2200,
      subNoiseMin:0.62, subNoiseMax:0.90,  // Soviet subs significantly louder than player (0.04)
      subSprintKtsMin:13, subSprintKtsMax:18,  // faster wolfpack sprints

      subTorpReactR:1600, boatTorpReactR:400,
      subTorpArcDeg:55,
      subTubes:2, subTorpStock:6, subReloadTime:40,
      // Soviet torpedo (SET-65 / TEST-71) — meaningfully inferior to NATO Mk-48
      subTorpSpeed:40,          // ~40kt vs Mk-48's ~55kt
      subTorpApproachSpeed:14,  // slower passive approach
      subTorpSeekRange:340,     // shorter seeker range (Soviet acoustics less refined)
      subTorpReacquire:0.008,   // less reliable reacquisition after CM seduction
      subTorpLife:180,          // shorter run — less fuel, shorter range than Mk-48
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
      // ASW doctrine — active sonar, hunt state, sector search
      asw:{
        activePingThreshold:    0.55,    // suspicion level that triggers active ping
        activePingInterval:     [60,120],// s between pings in alert state (no contact)
        activePingContactInterval: 30,  // s between pings when maintaining contact
        activePingRange:        1600,    // wu — hull sonar active detection (above layer only) ~8.6nm
        vdsPingRange:           2400,    // wu — VDS active detection (can reach below layer) ~13nm
        huntSuspicionFloor:     0.70,    // suspicion minimum on hunt state entry
        huntTimeout:            300,     // s — hunt state expires if no contact this long
        sectorArcDeg:           90,      // degrees — each ship's assigned search sector
        sectorExpandRate:       1.5,     // wu/s — how fast sector search target expands from datum
        datumHoldTime:          120,     // s — hold near last contact before searching
      },
      // ASROC-style missile torpedo — ships only, ASW units only
      asroc:{
        minRange:300,         // wu — inside this use torpedoes/DCs instead
        maxRange:2800,        // wu (~15nm)
        rocketSpeed:200,      // wu/s — fast surface-skimming flight
        deployDepth:45,       // m — torpedo enters water at this depth
        fireCd:[25,40],       // s — cooldown between launches
        susThresh:0.48,       // minimum suspicion to fire
        contactMaxAge:30,     // s — won't fire on stale contact
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
      // Baffle-clear maneuver — periodic course check to listen into stern null
      // Only aggressive sub types (hunter/interceptor/zeta) do this
      baffleClear:{
        intervalMin:   90,   // s — minimum time between clears
        intervalMax:  150,   // s — maximum time between clears
        checkDurMin:   20,   // s — how long to hold the cleared heading
        checkDurMax:   30,
        turnDeg:       35,   // degrees to offset from base heading
        rolesEnabled: ['hunter','interceptor','zeta'],
      },
    },
    // ── Weapon definitions — torpedoes and missiles ────────────────────────────
    // Vessels reference torpedoes by torpWeapon key; missiles by missileTypes/vlsWeapon.
    // kind:'torpedo' entries: all stats read by fireTorpedo() as statOverrides.
    // kind:'missile' entries: maxLaunchDepth gates firing; other stats used by missile.js.
    weapons:{
      // ── Torpedoes ──────────────────────────────────────────────────────────
      mk48_adcap:{
        kind:'torpedo', label:'MK-48 ADCAP', shortLabel:'ADCAP',
        speed:50, approachSpeed:18, life:210, dmg:55,
        seekRange:520, seekFOV:0.90, passiveFOV:2.4,
        turnRate:1.55, reacquireChance:0.016, arming:0.30, searchSnake:0.18,
        seduceFOV:2.80, seduceRange:300, seduceTime:9.5, reacquireDelay:5.5,
        depthRate:2, vertWindow:120, vertFuse:60,
      },
      spearfish:{
        kind:'torpedo', label:'SPEARFISH', shortLabel:'SPEARFISH',
        // ~80kt, excellent ECCM, harder to seduce, faster reacquisition
        speed:70, approachSpeed:20, life:280, dmg:60,
        seekRange:600, seekFOV:0.95, passiveFOV:2.5, turnRate:1.65,
        reacquireChance:0.020, arming:0.28, searchSnake:0.16,
        seduceFOV:2.80, seduceRange:300, seduceTime:8.0, reacquireDelay:4.0,
        depthRate:2, vertWindow:120, vertFuse:60,
      },
      tigerfish:{
        kind:'torpedo', label:'TIGERFISH Mk 24', shortLabel:'TIGERFISH',
        // ~35kt, 1974 design — inferior ECCM, easier to seduce, slow to reacquire
        speed:35, approachSpeed:12, life:300, dmg:45,
        seekRange:340, seekFOV:0.75, passiveFOV:2.1, turnRate:1.25,
        reacquireChance:0.008, arming:0.35, searchSnake:0.22,
        seduceFOV:2.80, seduceRange:300, seduceTime:14.0, reacquireDelay:8.5,
        depthRate:2, vertWindow:120, vertFuse:60,
      },
      sst4:{
        kind:'torpedo', label:'SST-4 / SUT', shortLabel:'SST-4',
        // ~35kt wire-guided, decent ECCM but not ADCAP-class
        speed:38, approachSpeed:13, life:260, dmg:50,
        seekRange:380, seekFOV:0.82, passiveFOV:2.2, turnRate:1.35,
        reacquireChance:0.010, arming:0.32, searchSnake:0.20,
        seduceFOV:2.80, seduceRange:300, seduceTime:12.0, reacquireDelay:7.0,
        depthRate:2, vertWindow:120, vertFuse:60,
      },
      // ── Anti-Ship Cruise Missiles ──────────────────────────────────────────
      // maxLaunchDepth: metres — must be at or shallower to fire
      harpoon:{
        kind:'missile', label:'UUM-84 HARPOON', shortLabel:'HARPOON',
        speed:450, range:25000, seekerFOV:0.698, warheadDmg:85,
        reloadMult:1.5, vls:false, maxLaunchDepth:25,  // capsule-launched, surfaces before ignition
      },
      sub_harpoon:{
        kind:'missile', label:'UGM-84 SUB-HARPOON', shortLabel:'S-HARPOON',
        speed:450, range:25000, seekerFOV:0.698, warheadDmg:85,
        reloadMult:1.5, vls:false, maxLaunchDepth:25,  // same capsule system as UUM-84
      },
      tasm:{
        kind:'missile', label:'BGM-109C TASM', shortLabel:'TASM',
        speed:400, range:999999, seekerFOV:0.611, warheadDmg:120,
        reloadMult:null, vls:true, maxLaunchDepth:30,  // VLS gas-boost ejection, slight depth tolerance
      },
      sm39:{
        kind:'missile', label:'SM39 EXOCET', shortLabel:'EXOCET',
        speed:370, range:9000, seekerFOV:0.524, warheadDmg:65,
        reloadMult:1.5, vls:false, maxLaunchDepth:55,  // purpose-designed deep launch canister
      },
    },
    ship:{
      tracerLife:[0.06,0.14], tracerSpread:0.06, tracerBursts:[2,4]
    },
    visuals:{screenBubbles:false},
    layout:{panelH:190, depthStripW:88, uiScaleDefault:1.0},
  };
})();