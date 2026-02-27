(() => {
  'use strict';
  const C = window.CONFIG;
  const { clamp, lerp, angleNorm } = window.M;
  const { world, player, setMsg } = window.G;
  const I = window.I;

  // Convert kts abstraction to world units/s
  function ktsToWU(k){ return k * 18; } // tune factor for feel

  function updateOrders(dt){
    // Direction-aware engine telegraph:
    // If dir=RIGHT (+1): A = increase, D = decrease
    // If dir=LEFT  (-1): D = increase, A = decrease
    //
    // Flip behavior:
    // - Hold DECREASE to walk speed down to 0.
    // - Once at 0, RELEASE the decrease key.
    // - Press the decrease key AGAIN to flip direction.
    // After flip, that same key becomes INCREASE (because dir changed).

    const inc = C.player.speedIncrementKts || 1;
    const repeat = 0.10; // seconds per 1-kt step while holding

    const movingLeft = (player.dir < 0);
    const incKey = movingLeft ? "d" : "a";
    const decKey = movingLeft ? "a" : "d";

    const incDown = I.keys.has(incKey);
    const decDown = I.keys.has(decKey);

    // Edge tracking for DEC key
    const wasDown = !!player._decWasDown;
    const justPressed = (decDown && !wasDown);
    const justReleased = (!decDown && wasDown);
    player._decWasDown = decDown;

    // Arm flip only after we reached zero via dec, then released
    if(justReleased && player._decReachedZero && (player.speedOrderKts||0) <= 0){
      player._decReadyFlip = true;
    }

    // Flip when stopped and dec is pressed again (after arming)
    if((player.speedOrderKts||0) <= 0 && justPressed && player._decReadyFlip){
      player._decReadyFlip = false;
      player._decReachedZero = false;
      player.dir = (player.dir === -1 ? 1 : -1);
      player.noiseTransient = Math.min(1, (player.noiseTransient||0) + 0.10);
      setMsg(player.dir < 0 ? "COURSE: LEFT" : "COURSE: RIGHT", 0.9);
    }

    // Speed stepping while holding keys
    if(incDown || decDown){
      player.speedHoldT = (player.speedHoldT || 0) + dt;
      while(player.speedHoldT >= repeat){
        player.speedHoldT -= repeat;

        if(incDown){
          player.speedOrderKts = Math.min(C.player.flankKts, (player.speedOrderKts||0) + inc);
          if((player.speedOrderKts||0) > 0){
            player._decReachedZero = false;
            player._decReadyFlip = false;
          }
        }
        if(decDown){
          if((player.speedOrderKts||0) > 0){
            player.speedOrderKts = Math.max(0, (player.speedOrderKts||0) - inc);
            if((player.speedOrderKts||0) <= 0){
              player._decReachedZero = true;
            }
          }
        }
      }
    } else {
      player.speedHoldT = 0;
    }

    // Depth order setpoint (W/S). Hold to step.
    const dStep = C.player.depthStep || 60;
    const dRep  = C.player.depthHoldRepeat || 0.10;
    const holdDepth = (I.keys.has("w") ? -1 : 0) + (I.keys.has("s") ? 1 : 0);
    if(holdDepth !== 0){
      player.depthHoldT = (player.depthHoldT || 0) + dt;
      while(player.depthHoldT >= dRep){
        player.depthHoldT -= dRep;
        player.depthOrder = clamp((player.depthOrder ?? player.y) + holdDepth*dStep, world.seaLevel + 40, world.ground - 60);
      }
    } else {
      player.depthHoldT = 0;
    }

    // Silent running toggle
    if(I.keys.has("z")){
      I.keys.delete("z");
      player.silent = !player.silent;
      setMsg(player.silent ? "SILENT RUNNING" : "NORMAL RUN", 1.0);
    }

    // Emergency maneuver (E)
    if(I.keys.has("e") && player.emergTurnCd<=0 && player.emergTurnT<=0){
      I.keys.delete("e");
      player.emergTurnT = C.player.emergencyTurn.dur;
      player.emergTurnCd = C.player.emergencyTurn.cd;
      player.noiseTransient = Math.min(1, player.noiseTransient + C.player.emergencyTurn.noiseSpike);
      setMsg("EMERGENCY MANEUVER!", 1.2);
    }

    // Crash dive (C): pushes depth order deeper + transient
    if(I.keys.has("c") && player.crashDiveCd<=0 && player.crashDiveT<=0){
      I.keys.delete("c");
      player.crashDiveT = C.player.crashDive.dur;
      player.crashDiveCd = C.player.crashDive.cd;
      player.noiseTransient = Math.min(1, player.noiseTransient + C.player.crashDive.noiseSpike);
      player.depthOrder = clamp((player.depthOrder ?? player.y) + 420, world.seaLevel + 40, world.ground - 60);
      setMsg("CRASH DIVE!", 1.2);
    }
  }

  function stepDynamics(dt){
    // Speed controller (order -> actual)
    let orderKts = (player.speedOrderKts ?? 0);
    if(I.keys.has("shift")) orderKts = C.player.flankKts;
    if(player.silent) orderKts = Math.min(orderKts, C.player.silentRunning.speedCap);

    const err = orderKts - player.speed;
    player.speed += (err / Math.max(0.05, C.player.speedTau)) * dt;
    player.speed = clamp(player.speed, 0, C.player.flankKts);

    // Mirror heading
    player.heading = (player.dir < 0) ? Math.PI : 0;
    player.turnRate = 0;

    // Depth controller (setpoint -> vertical velocity)
    const errD = (player.depthOrder ?? player.y) - player.y;
    const tau = Math.max(0.08, C.player.depthTau || 1.4);
    const rateMax = (C.player.depthRateMax || 170) * (player.crashDiveT>0 ? C.player.crashDiveRateMult : 1.0);
    const desiredVy = clamp(errD / tau, -rateMax, rateMax);
    player.vy = lerp(player.vy, desiredVy, 0.18);

    // timers
    player.emergTurnT = Math.max(0, player.emergTurnT - dt);
    player.emergTurnCd = Math.max(0, player.emergTurnCd - dt);
    player.crashDiveT = Math.max(0, player.crashDiveT - dt);
    player.crashDiveCd = Math.max(0, player.crashDiveCd - dt);
  }

  window.NAV = { ktsToWU, updateOrders, stepDynamics };
})();
