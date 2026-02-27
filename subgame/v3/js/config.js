// config.js — Gameplay Tuning
// ================================================
// This file is the *one place* you should edit when you want to tune gameplay.
// The rest of the game reads values from window.CONFIG.
//
// How to use:
//  - Change numbers below.
//  - Save.
//  - Refresh the page.
//
// Notes:
//  - Units are mostly "world units" (pixels in the world-space) and seconds.
//  - Larger values usually mean "more" of the thing (faster, louder, longer).
//  - If you break something, revert this file (or compare with a previous copy).
//
// Tip: Keep changes small and test often. Many systems interact (noise ↔ detection ↔ weapons).
(() => {
  'use strict';

  // window.CONFIG is global so every other script can read it.
  // If you ever add new scripts, make sure config.js loads before them.
  window.CONFIG = {
    // ------------------------------------------------------------
    // PLAYER — movement, sprinting, noise model, and cooldowns
    // ------------------------------------------------------------
    player: {
      // Base acceleration (how quickly the sub speeds up when you hold WASD).
      // Higher = snappier controls.
      acc: 320,

      // Maximum speed clamp when NOT sprinting.
      // Higher = cruising faster (also increases noise once you exceed noiseRampStart).
      vmax: 360,

      // Sprint acceleration (holding Shift).
      // Higher = more bursty sprint.
      sprintAcc: 560,

      // Maximum speed clamp while sprinting.
      sprintVmax: 520,

      // -----------------------
      // Noise model (stealth)
      // -----------------------
      // Baseline machinery noise (0..1-ish). Even when you're barely moving, you are not silent.
      // Increase this to make stealth harder globally.
      noiseFloor: 0.08,

      // Noise "ramp start" speed. Below this speed, you mostly sit near noiseFloor.
      // Lower this to make you get loud earlier (harder stealth).
      noiseRampStart: 55,

      // Noise ramp divisor. After rampStart, noise rises roughly by (speed - rampStart)/div.
      // Lower this = noise rises faster with speed (harder stealth).
      noiseRampDiv: 220,

      // Extra noise added while sprinting (Shift). This is a transient spike.
      // Increase this to make sprinting extremely risky (enemies detect you more).
      sprintNoiseBoost: 0.45,

      // -----------------------
      // Weapon / ability cooldowns (seconds)
      // -----------------------
      torpCd: 0.22,     // Left click fire rate for torpedoes
      missCd: 0.95,     // Right click fire rate for missiles
      cmCd: 2.8,        // Q noisemaker cooldown
      sonarCd: 5.6,     // Space active ping cooldown

      // Active ping visuals: how long the expanding ring lasts (seconds)
      sonarPulse: 1.25,
    },

    // ------------------------------------------------------------
    // TORPEDO — both player and enemy torpedoes use these parameters
    // ------------------------------------------------------------
    torpedo: {
      // Forward speed of a torpedo.
      speed: 620,

      // Lifetime in seconds (torp despawns after this).
      life: 5.2,

      // Damage on hit.
      dmg: 42,

      // -----------------------
      // Homing / seeker behaviour
      // -----------------------
      // Seek range in world units. Lower = must be closer to acquire a target.
      seekRange: 780,

      // Seek field-of-view in radians. Lower = "tighter cone" (less maneuverable homing).
      // Example: 0.42 rad ≈ 24 degrees to either side (about 48 degrees total).
      seekFOV: 0.42,

      // Turn rate in radians per second. Lower = slower turning (harder to track sharp turns).
      turnRate: 1.55,

      // Arming delay in seconds. Torps won't detonate until this counts down to 0.
      // Increase this to prevent point-blank insta-hits.
      arming: 0.18,

      // Chance per update tick to attempt a fresh target acquire even if it already has one.
      // Lower = torps commit more to their current target (less "snap").
      reacquireChance: 0.045,
    },

    // ------------------------------------------------------------
    // MISSILE — player VLS missile behaviour
    // ------------------------------------------------------------
    missile: {
      // Missile speed (used for both vertical and cruise).
      speed: 720,

      // Missile lifetime (seconds).
      life: 4.0,

      // Damage (also drives blast effect).
      dmg: 140,

      // Delay before the missile tips over into cruise mode after it exits the water.
      tipDelay: 0.35,
    },

    // ------------------------------------------------------------
    // ENEMY — hearing/detection/forgetting and firing thresholds
    // ------------------------------------------------------------
    enemy: {
      // -----------------------
      // Passive hearing ranges (world units)
      // -----------------------
      // Surface ships generally hear further than subs.
      hearBoatRange: 2200,
      hearSubRange: 1900,

      // Minimum signal required to even consider a "hearing event".
      // Lower = enemies respond to quieter player movement.
      hearSignalMin: 0.07,

      // Hearing probability model:
      // p = clamp((signal - hearPBase) * hearPScale, 0..1) then tested against dt
      hearPBase: 0.05,
      hearPScale: 1.80,

      // -----------------------
      // Suspicion thresholds (0..1)
      // -----------------------
      // These control enemy behaviour mode selection:
      //  - patrol      : suspicion < suspicionInvestigate
      //  - investigate : suspicionInvestigate..suspicionEngage
      //  - engage      : suspicion >= suspicionEngage
      suspicionEngage: 0.70,
      suspicionInvestigate: 0.30,

      // -----------------------
      // Forgetting / decay
      // -----------------------
      // If the player is "quiet enough", enemies forget faster.
      quietNoiseThreshold: 0.22,

      // Suspicion decays by (base + quietExtra) per second while quiet, otherwise just base.
      // Increase these to make enemies calm down quickly after losing the player.
      suspicionDecayBase: 0.018,
      suspicionDecayQuietExtra: 0.010,

      // Contact aging:
      // Enemies maintain an uncertain "contact" solution with a timestamp.
      // After these ages they drop the contact (and lose a clean firing solution).
      contactMaxAge: 8.5,
      contactMaxAgeQuiet: 5.0,

      // -----------------------
      // Firing solution gating
      // -----------------------
      // Enemy needs enough suspicion AND a fresh contact to shoot.
      fireSolutionMinSuspicion: 0.45,
      fireSolutionMaxAge: 12.0,
    },

    // ------------------------------------------------------------
    // SHIP DEFENSES — flares, sinking noisemakers, CIWS tracer visuals
    // ------------------------------------------------------------
    ship: {
      // -----------------------
      // Flares (missile decoys)
      // -----------------------
      // How many flares launched in one defensive burst.
      flareBurst: 3,

      // Sideways spread factor per flare in the burst (fan).
      // Higher = flares go wider left/right.
      flareSideSpread: 95,

      // Initial upward velocity (negative vy = up).
      // Increase to make flares clear the ship and arc higher.
      flareVyMin: 560,
      flareVyMax: 860,

      // "Gravity" applied to flare vy each second.
      // Higher = flares fall back faster; lower = they hang longer.
      flareGravity: 720,

      // -----------------------
      // Ship noisemakers (sinking away)
      // -----------------------
      // Initial downward velocity and sideways push for sinking noisemakers.
      sinkVyMin: 120,
      sinkVyMax: 200,
      sinkVxMin: -60,
      sinkVxMax: 60,

      // -----------------------
      // CIWS tracer visuals (NOT the kill probability)
      // -----------------------
      // These only control how the bullet stream looks.
      cwisTracerLifeMin: 0.06,
      cwisTracerLifeMax: 0.14,

      // Spread factor for the tracer aim.
      // Higher = more "spray".
      cwisTracerSpread: 0.06,

      // How many tracer segments are spawned per CIWS tick.
      // (More = denser bullet stream, but more draw cost.)
      cwisTracerBurstsMin: 2,
      cwisTracerBurstsMax: 4,
    }
  };
})();
