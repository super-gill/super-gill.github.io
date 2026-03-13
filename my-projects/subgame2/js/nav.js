(() => {
  'use strict';
  const C=window.CONFIG;
  const {clamp,lerp,deg2rad,angleNorm}=window.M;
  const {world,player,setMsg,addLog}=window.G;
  const COMMS=window.COMMS;
  const I=window.I;

  function ktsToWU(k){ return k*1; }

  // Route: ordered array of {wx,wy} waypoints
  const route=[];
  window.ROUTE=route; // expose for renderer

  function updateOrders(dt){
    // ── Zoom ──────────────────────────────────────────────────────────────────
    if(I.zoomDelta!==0){
      const factor=Math.pow(1.18,I.zoomDelta);
      C.camera.zoom=clamp(C.camera.zoom*factor,0.04,8.00);
      I.zoomDelta=0;
    }

    // ── Route click ───────────────────────────────────────────────────────────
    if(I._pendingRouteClick){
      I._pendingRouteClick=false;
      const Z=C.camera.zoom*(window.G.DPR||1);
      const DPR=window.G.DPR||1;
      const cx=(window.G.canvas.width-88*DPR)/2, cy=(window.G.canvas.height-190*DPR)/2;
      const wx=window.G.cam.x+(I.mouseX-cx)/Z;
      const wy=window.G.cam.y+(I.mouseY-cy)/Z;

      // Check if click is near a sonar contact bearing line or live torpedo — designate for TDC
      const {sonarContacts,bullets,enemies,game}=window.G;
      const designatePixels=36; // screen pixels — for blobs and torpedoes
      const designateLinePixels=10; // much tighter for bearing lines (long rays are too easy to accidentally hit)
      const designateR=designatePixels/(Z*DPR);
      let best=null, bestDist=Infinity, bestId=null;

      for(const [e,sc] of sonarContacts){
        if(e.dead) continue; // can't re-designate dead contacts
        // Check distance to bearing line (perpendicular) AND to TMA position blob
        let d=Infinity;
        if(sc.tmaQuality>=(window.CONFIG?.tma?.qualityThresholdBlob??0.15) && sc.tmaX!=null){
          // Has a position — check distance to blob
          const edx=AI.wrapDx(wx,sc.tmaX), edy=sc.tmaY-wy;
          d=Math.hypot(edx,edy);
        } else if(sc.latestBrg!=null){
          // Bearing-line only — perpendicular distance from click to ray
          // Use a tighter radius so normal ocean clicks don't accidentally designate
          const lineR=designateLinePixels/(Z*DPR);
          const ox=sc.latestFromX??player.wx, oy=sc.latestFromY??player.wy;
          const brg=sc.latestBrg;
          const qx=AI.wrapDx(ox,wx), qy=wy-oy;
          const dot=qx*Math.cos(brg)+qy*Math.sin(brg);
          if(dot>0){
            const perp=Math.abs(-qx*Math.sin(brg)+qy*Math.cos(brg));
            if(perp<lineR) d=perp;
          }
        }
        if(d<designateR&&d<bestDist){ bestDist=d; best=e; bestId=sc.id; }
      }
      for(const b of bullets){
        if(b.kind!=='torpedo'||b.life<=0) continue;
        const dx=AI.wrapDx(wx,b.x), dy=b.y-wy;
        const d=Math.hypot(dx,dy);
        if(d<designateR&&d<bestDist){ bestDist=d; best=b; bestId=b.torpId; b._isTorp=true; }
      }

      if(best){
        game.tdc.target=best;
        game.tdc.targetId=bestId;
        const sc=best._isTorp?null:window.G?.sonarContacts?.get(best);
        COMMS.nav.tdcDesignated(bestId, !!sc);
      } else {
        // Normal waypoint
        const snapped=window.MAPS.snapToSea(
          (wx+world.w)%world.w,
          (wy+world.h)%world.h
        );
        const firstWP = route.length===0;
        route.push(snapped);
        if(firstWP){
          const brgToWP = Math.atan2(snapped.wy-player.wy, snapped.wx-player.wx);
          const crsStr = Math.round(((brgToWP*180/Math.PI)+360)%360).toString().padStart(3,'0');
          COMMS.nav.courseChange(crsStr);
        }
      }
    }

    if(I.routeRemoveLast){
      I.routeRemoveLast=false;
      if(route.length>0) route.pop();
    }

    // ── Speed: A = slower, D = faster ────────────────────────────────────────
    const inc=C.player.speedIncrementKts||1;
    const repeat=0.10;
    const incDown=I.keys.has("d");
    const decDown=I.keys.has("a");
    if(incDown||decDown){
      player.speedHoldT=(player.speedHoldT||0)+dt;
      while(player.speedHoldT>=repeat){
        player.speedHoldT-=repeat;
        if(incDown) player.speedOrderKts=Math.min(C.player.flankKts,(player.speedOrderKts||0)+inc);
        if(decDown) player.speedOrderKts=Math.max(0,(player.speedOrderKts||0)-inc);
      }
    } else {
      player.speedHoldT=0;
    }

    // ── Depth: W = shallower, S = deeper (10m steps, routed via PANEL for debounced log)
    const dRep=C.player.depthHoldRepeat||0.10;
    const holdDepth=(I.keys.has("w")?-1:0)+(I.keys.has("s")?1:0);
    if(holdDepth!==0){
      player.depthHoldT=(player.depthHoldT||0)+dt;
      while(player.depthHoldT>=dRep){
        player.depthHoldT-=dRep;
        window.PANEL?.depthStep(holdDepth*10);
      }
    } else {
      player.depthHoldT=0;
    }

    // ── Silent running ─────────────────────────────────────────────────────────
    if(I.keys.has("z")){
      I.keys.delete("z");
      const dmgFxZ=window.DMG?.getEffects()||{};
      if(dmgFxZ.silentRunAvail===false){ COMMS.nav.connRoomUnavail('silent running'); }
      else { player.silent=!player.silent; COMMS.nav.silentRunning(player.silent); }
    }

    // ── Emergency turn (Q) ────────────────────────────────────────────────────
    if(I.keys.has("q")&&player.emergTurnCd<=0&&player.emergTurnT<=0){
      {const ta=player.towedArray; if(ta.state==='operational'){ta.state='damaged';COMMS.nav.towedArrayStress('manoeuvre','damaged');}else if(ta.state==='damaged'){ta.state='destroyed';COMMS.nav.towedArrayStress('manoeuvre','destroyed');}}
      I.keys.delete("q");
      player.emergTurnT=C.player.emergencyTurn.dur;
      player.emergTurnCd=C.player.emergencyTurn.cd;
      player.noiseTransient=Math.min(1,player.noiseTransient+C.player.emergencyTurn.noiseSpike);
      route.length=0;
      COMMS.nav.emergencyTurn();
    }

    // ── Crash dive (C) ────────────────────────────────────────────────────────
    // ── Probabilistic SCRAM — crash dive while emergency turn still active ──
    if(I.keys.has("c")&&player.crashDiveCd<=0&&player.crashDiveT<=0&&!player.scram){
      // If emergency turn just happened (still in cd window) — high stress combo
      const emergRecent = player.emergTurnCd > (C.player.emergencyTurn?.cd||30) * 0.7;
      if(emergRecent && player.speed > 20 && Math.random() < 0.45){
        if(typeof window.G.triggerScram==='function') window.G.triggerScram('combo');
        COMMS.reactor.scram('turn');
      }
    }
    if(I.keys.has("c")&&player.crashDiveCd<=0&&player.crashDiveT<=0){
      const dmgFxC=window.DMG?.getEffects()||{};
      if(dmgFxC.crashDiveAvail===false){
        I.keys.delete("c");
        COMMS.nav.connRoomUnavail('crash dive');
      } else {
      {const ta=player.towedArray; if(ta.state==='operational'){ta.state='damaged';COMMS.nav.towedArrayStress('crash dive','damaged');}else if(ta.state==='damaged'){ta.state='destroyed';COMMS.nav.towedArrayStress('crash dive','destroyed');}}
      I.keys.delete("c");
      player.crashDiveT=C.player.crashDive.dur;
      player.crashDiveCd=C.player.crashDive.cd;
      // Large noise spike — blowing tanks is very loud
      player.noiseTransient=Math.min(1,player.noiseTransient+C.player.crashDive.noiseSpike);
      // Dive 600m from current position — straight down
      player.depthOrder=clamp((player.depthOrder??player.depth)+600,20,world.ground-60);
      // Tau override — instant response, bypass normal sluggish depth control
      player._crashTauOverride=C.player.crashDive.tauOverride??0.4;
      // Ahead flank via keyboard crash dive
      const ckStates=window.PANEL?.SPEED_STATES||[];
      const ckFlank=ckStates.findIndex(s=>s.label==='AHEAD FLANK');
      const ckFull =ckStates.findIndex(s=>s.label==='AHEAD FULL');
      const ckUse  =ckFlank>=0?ckFlank:ckFull>=0?ckFull:-1;
      if(ckUse>=0){
        player.speedOrderKts=ckStates[ckUse].kts;
        player.speedDir=ckStates[ckUse].dir;
        window.PANEL?.setTelegraphIdx?.(ckUse);
      }
      // Slam planes to full dive
      if(!player.planes) player.planes={fwd:{angle:0,mode:'hydraulic'},aft:{angle:0,mode:'hydraulic'}};
      player.planes.aft.angle=-15;
      player.planes.fwd.angle=-8;
      COMMS.nav.crashDive();
      player._crashDepthCalled=new Set();
      } // end else (crashDiveAvail)
    }
  }

  function stepDynamics(dt){
    // ── Speed ─────────────────────────────────────────────────────────────────
    let orderKts=player.speedOrderKts??0;
    if(player.silent) orderKts=Math.min(orderKts,C.player.silentRunning.speedCap);
    if(player.scram)  orderKts=Math.min(orderKts, 3.0); // EPM only
    const dmgFx = window.DMG?.getEffects() || {};
    if(dmgFx.speedCap!=null) orderKts=Math.min(orderKts, dmgFx.speedCap);
    const err=orderKts-player.speed;
    // Conn room lost — engine orders relayed via internal comms; 4× slower response
    const speedTauEff = dmgFx.connRoomLost ? C.player.speedTau * 4.0 : C.player.speedTau;
    player.speed+=(err/Math.max(0.05, speedTauEff))*dt;
    player.speed=clamp(player.speed,0,Math.min(C.player.flankKts, dmgFx.speedCap??Infinity));
    // Helm speed report — fires once when actual speed settles within 0.8kt of order
    if(Math.abs(player.speed-orderKts)<0.8 && Math.abs((player._lastReportedKts??-99)-orderKts)>1.0){
      player._lastReportedKts=orderKts;
      if(orderKts>0){
        COMMS.nav.speedReport(player.speed);
      } else {
        COMMS.nav.allStop();
      }
    }

    // ── Heading — steer toward next waypoint ──────────────────────────────────
    // Speed-scaled turn rate
    const speedFrac=clamp(player.speed/Math.max(1,C.player.flankKts),0,1);
    const steeringMult=dmgFx.steeringMult??1.0;
    const maxTurnDeg=lerp(C.player.turnRateMinDeg,C.player.turnRateDeg,speedFrac)*steeringMult;
    const maxTurn=deg2rad(maxTurnDeg);

    if(route.length>0){
      const wp=route[0];
      // Wrap-aware delta
      let dx=wp.wx-player.wx; if(dx>world.w/2) dx-=world.w; if(dx<-world.w/2) dx+=world.w;
      let dy=wp.wy-player.wy; if(dy>world.h/2) dy-=world.h; if(dy<-world.h/2) dy+=world.h;
      const dist=Math.hypot(dx,dy);

      // Arrive threshold — pop waypoint when close enough
      const arriveR=clamp(ktsToWU(player.speed)*2.0, 80, 300);
      if(dist<arriveR){
        route.shift();
        if(route.length>0){
          const nx2=route[0];
          const brgToNext = Math.atan2(nx2.wy-player.wy, nx2.wx-player.wx);
          const crsNext = Math.round(((brgToNext*180/Math.PI)+360)%360).toString().padStart(3,'0');
          COMMS.nav.waypointReached(crsNext);
        } else {
          COMMS.nav.finalWaypoint(Math.round(((player.heading*180/Math.PI)+360)%360).toString().padStart(3,'0'));
        }
      } else {
        const desired=Math.atan2(dy,dx);
        let dAng=angleNorm(desired-player.heading);
        dAng=clamp(dAng,-maxTurn*dt,maxTurn*dt);
        player.heading=angleNorm(player.heading+dAng);
      }
      player.turnRate=0;
    } else {
      // No waypoints — hold current heading
      player.turnRate=0;
    }

    // ── Move in top-down world ────────────────────────────────────────────────
    const spWU=ktsToWU(player.speed);
    let nx=player.wx+Math.cos(player.heading)*spWU*dt;
    let ny=player.wy+Math.sin(player.heading)*spWU*dt;

    // Land collision — don't enter land, clear route if stuck
    if(window.MAPS.isLand((nx+world.w)%world.w, (ny+world.h)%world.h)){
      route.length=0;
      // Bounce: just don't move this frame
      nx=player.wx; ny=player.wy;
      COMMS.nav.grounded();
    }

    player.wx=(nx+world.w)%world.w;
    player.wy=(ny+world.h)%world.h;
    // Horizontal velocity for TMA range estimation (sensors.js _estRange)
    player.vx=Math.cos(player.heading)*spWU;
    player.vxRaw=player.vx; // alias — vy is used for depth so keep separate

    // ── Depth ─────────────────────────────────────────────────────────────────
    const errD=(player.depthOrder??player.depth)-player.depth;
    // Crash dive: use tauOverride for instant response; clear once dive settles
    const crashActive=player.crashDiveT>0;
    if(crashActive && player._crashTauOverride>0){
      // Bleed off override as the dive progresses — snappy start, settles to normal
      player._crashTauOverride=Math.max(0, (player._crashTauOverride||0)-dt*0.025);  // slow bleed — keeps dive responsive for ~16s
    } else {
      player._crashTauOverride=0;
    }
    const tau=Math.max(0.08, player._crashTauOverride>0
      ? player._crashTauOverride
      : (C.player.depthTau||3.0));
    const rateMult=crashActive?(C.player.crashDive.rateMult??3.5):1.0;

    // ── HPA system — runs before depth physics so authority is current ────────
    const hpaC = C.player.hpa;
    const hpa  = player.damage?.hpa;
    const maxP = hpaC?.maxPressure   || 207;
    const maxR = hpaC?.reservePressure || 207;
    const ambient = (player.depth||0) * ((hpaC?.ambientPerMetre)||0.1);

    if(hpaC && hpa){
      // ── Emergency blow — continuous flow physics ─────────────────────────
      // Flow rate proportional to (bankPressure - ambient).
      // If reserve is committed, it adds to available pressure.
      // ── Manual blow — pending failure detection then DC manual sequence ──────
      if(player._blowPending){
        player._blowPendingT = (player._blowPendingT||0) - dt;
        if(player._blowPendingT <= 0){
          player._blowPending = false;
          // Helm reports no response — trigger DC manual sequence
          window.COMMS?.trim?.blowNoResponse();
          player._blowManualT = 12; // DC takes ~12s to manually shut vents + open HPA
        }
      }
      // DC manual blow — counts down, then activates venting
      if(player._blowManualT > 0){
        player._blowManualT -= dt;
        if(player._blowManualT <= 8 && !player._blowManualVentsMsg){
          player._blowManualVentsMsg = true;
          window.COMMS?.trim?.blowManualVentsShut();
        }
        if(player._blowManualT <= 0){
          player._blowManualT = 0;
          player._blowManualVentsMsg = false;
          player._blowVenting = true;
          window.COMMS?.trim?.blowManualHPAOpen(player._blowAmbient||0, player._blowGroupP||0);
        }
      }

      if(player._blowVenting){
        const availPressure = hpa.pressure + (hpa._reserveCommitted ? hpa.reserve : 0);
        const differential  = availPressure - ambient;

        // Check if tanks are already clear — if so, seal valves and ride buoyancy up
        const mbtB = player.damage?.mbt;
        const maxTankFill = mbtB ? Math.max(...mbtB.tanks) : 1;
        const tanksClear = maxTankFill < 0.02;

        if(tanksClear){
          // Tanks empty — seal the blow. Buoyancy carries us up from here.
          player._blowVenting = false;
          player._blowVy = 0;
          window.COMMS?.trim?.blowTanksClear?.(Math.round(player.depth));
        } else if(differential > 0){
          // Flow rate: blowFlowRate × differential / referenceBar
          const flowRate = (hpaC.blowFlowRate||0.5) * differential / (hpaC.blowReferenceBar||50);
          // Draw pressure from bank (reserve first if committed)
          const draw = flowRate * dt;
          if(hpa._reserveCommitted && hpa.reserve > 0){
            const fromRes = Math.min(hpa.reserve, draw);
            hpa.reserve  -= fromRes;
            const rem = draw - fromRes;
            hpa.pressure = Math.max(0, hpa.pressure - rem);
          } else {
            hpa.pressure = Math.max(0, hpa.pressure - draw);
          }
          // Reduce MBT fill — air displaces water out of tanks
          if(mbtB){
            const fillReduction = flowRate * (hpaC.blowFlowToFillRate||0.025) * dt;
            for(let i=0;i<mbtB.tanks.length;i++) mbtB.tanks[i] = Math.max(0, mbtB.tanks[i] - fillReduction);
          }
          // Small surge component — buoyancy does the main work
          const flowToVy = hpaC.blowFlowToVy || 0.4;
          player._blowVy = -(flowRate * flowToVy);
        } else {
          // Differential gone — pressure can no longer displace water, tanks not yet clear
          player._blowVy = 0;
          player._blowVenting = false;
          window.COMMS?.trim?.blowExhausted(Math.round(player.depth));
        }

        // Cancel venting when surfaced (≤20m — at surface threshold)
        if(player.depth <= 20){
          player._blowVenting = false;
          player._blowVy = 0;
          window.COMMS?.trim?.blowSurfaced();
        }
      } else {
        player._blowVy = 0;
      }

      // ── Normal ballast authority — pressure vs ambient ────────────────────
      const minRatio = hpaC.controlMinRatio || 1.2;
      const fullThresh = ambient * minRatio;
      const hpaBallastAuth = ambient <= 0 ? 1.0
        : clamp((hpa.pressure - ambient) / Math.max(fullThresh - ambient, 0.1), 0, 1);
      player._hpaBallastAuth = hpaBallastAuth;

      // ── Ascent cost — charged when venting tanks (draining = compressed air used) ──
      // Cost proportional to fill drain rate × depth (more pressure needed at depth)
      // player._fillDrainRate set by depth controller each frame when venting water
      if(!player._blowVenting && (player._fillDrainRate||0) > 0 && player.depth > 5){
        const depthMult = 1 + (player.depth / 300);
        const costPerDrain = hpaC.ascentCostPerMetre || 0.04;
        hpa.pressure = Math.max(0, hpa.pressure
          - player._fillDrainRate * costPerDrain * depthMult * dt * 12);
        // factor 12: converts fill-rate to approximate m equivalent for cost continuity
      }

      // ── Recharge — surface only ───────────────────────────────────────────
      // HPA can only be recharged on the surface (≤20m) from atmospheric air.
      // HP active recharge adds noise; both stop when submerged.
      const atSurface = player.depth <= 20;
      if(!player._blowVenting && atSurface){
        const lpRate = hpaC.lpRechargeRate || 0.4;
        hpa.pressure = Math.min(maxP, hpa.pressure + lpRate * dt);
        hpa.reserve  = Math.min(maxR, hpa.reserve  + lpRate * 0.5 * dt);
        // HP compressor boost — player toggle, noisier, faster
        if(hpa.recharging){
          hpa.pressure = Math.min(maxP, hpa.pressure + (hpaC.hpRechargeRate||2.5)*dt);
          hpa.reserve  = Math.min(maxR, hpa.reserve  + (hpaC.hpRechargeRate||2.5)*0.3*dt);
          player.noiseTransient = Math.min(1,(player.noiseTransient||0)+(hpaC.rechargeNoiseAdd||0.55)*dt);
        }
        // Comms — once per surface visit when tanks need filling
        if(!player._surfaceRechargeNotified && hpa.pressure < maxP * 0.98){
          player._surfaceRechargeNotified = true;
          window.COMMS?.trim?.surfaceRechargeStarted(Math.round(hpa.pressure));
        }
      } else {
        // Submerged — no recharge possible
        player._surfaceRechargeNotified = false;
      }

      // ── Low pressure warnings (once per band) ────────────────────────────
      const pressureFrac = hpa.pressure / maxP;
      const pBand = pressureFrac < 0.08 ? 'crit' : pressureFrac < 0.25 ? 'low' : 'ok';
      if(pBand !== (player._lastPBand||'ok')){
        player._lastPBand = pBand;
        window.COMMS?.trim?.hpaLow(Math.round(pressureFrac*100));
      } else if(pBand==='ok') player._lastPBand='ok';

      // ── Blow progress reports (every ~15s while venting) ─────────────────
      if(player._blowVenting){
        player._blowReportT = (player._blowReportT||0) + dt;
        if(player._blowReportT >= 15){
          player._blowReportT = 0;
          const diff = (hpa.pressure + (hpa._reserveCommitted?hpa.reserve:0)) - ambient;
          window.COMMS?.trim?.blowProgress(Math.round(player.depth), Math.round(diff));
        }
      } else {
        player._blowReportT = 0;
      }

    } else {
      player._hpaBallastAuth = 1.0;
      player._blowVy = 0;
    }

    // ── MBT fill state — ensure initialised ─────────────────────────────────
    if(player.damage && !player.damage.mbt){
      player.damage.mbt = { tanks:[0.50,0.50,0.50,0.50,0.50], trimF:0.25, trimA:0.25, neutralFill:0.50 };
    }
    const mbt = player.damage?.mbt;
    const neutralFill = mbt?.neutralFill ?? 0.50;
    const avgFill = mbt ? mbt.tanks.reduce((a,b)=>a+b,0)/mbt.tanks.length : neutralFill;

    // ── Trim / buoyancy from flooding ─────────────────────────────────────────
    const {trim:floodTrim, buoyancy:floodBuoy} = window.DMG?.getTrimState?.() || {trim:0,buoyancy:0};
    const trimDemand  = Math.abs(floodTrim) / (C.player.trimFullAuthority||2.0);
    const speedFactor = clamp(player.speed / (C.player.planeMinSpeed||10.0), 0, 1);
    const planeAuthority = clamp(1 - trimDemand*(1-speedFactor), 0, 1);
    const sinkRate = floodBuoy * (C.player.sinkRatePerUnit||0.9);

    // ── Planes and pitch physics ──────────────────────────────────────────────
    if(!player.planes) player.planes = {
      fwd:{ angle:0, mode:'hydraulic' },
      aft:{ angle:0, mode:'hydraulic' },
    };
    const pFwd = player.planes.fwd;
    const pAft = player.planes.aft;
    const fwdMode = dmgFx.fwdPlaneMode || 'hydraulic';
    const aftMode = dmgFx.aftPlaneMode || 'hydraulic';

    // Detect mode transitions and fire comms once per change
    if(fwdMode !== (pFwd.mode||'hydraulic')){
      const prev = pFwd.mode; pFwd.mode = fwdMode;
      if(fwdMode==='air_emergency') window.COMMS?.planes?.fwdAirEmergency();
      else if(fwdMode==='frozen')   window.COMMS?.planes?.fwdControlLost();
      if(prev==='air_emergency' && fwdMode==='hydraulic') window.COMMS?.planes?.fwdHydraulicRestored();
    }
    if(aftMode !== (pAft.mode||'hydraulic')){
      const prev = pAft.mode; pAft.mode = aftMode;
      if(aftMode==='air_emergency'){
        const transferred = dmgFx.aftCtrlTransferred;
        window.COMMS?.planes?.aftAirEmergency(transferred);
      }
      if(prev==='air_emergency' && aftMode==='hydraulic') window.COMMS?.planes?.aftHydraulicRestored();
    }
    // Aft control transfer notification (once)
    if(dmgFx.aftCtrlTransferred && !player._aftCtrlTransferNotified){
      player._aftCtrlTransferNotified = true;
      window.COMMS?.planes?.aftControlTransferred();
    } else if(!dmgFx.aftCtrlTransferred){
      player._aftCtrlTransferNotified = false;
    }

    // Pitch target — driven by depth error and trim imbalance
    // Aft planes set pitch; forward planes correct trim offset
    // NOTE: positive pitch = nose up = ascend. errD negative means want shallower → need nose up → positive target.
    const pitchMax     = 15;   // degrees max operational pitch
    // During e-blow force full nose-up to help the blow rather than fight it
    const blowing      = player._blowVenting || false;
    const pitchFromErr = blowing ? pitchMax : clamp(-errD * 0.08, -pitchMax, pitchMax);
    const pitchFromTrim= clamp(-floodTrim * 2.0, -8, 8);          // trim imbalance → fwd plane correction
    const pitchTarget  = pitchFromErr;
    const fwdTarget    = pitchFromTrim;

    // Plane response rate — degraded by mode and HPA availability
    const hpaAvail = (hpa?.pressure||0) > ambient;
    const aftRate  = aftMode==='frozen'?0 : aftMode==='air_emergency'&&!hpaAvail?0 : aftMode==='air_emergency'?2.5:8; // deg/s
    const fwdRate  = fwdMode==='frozen'?0 : fwdMode==='air_emergency'&&!hpaAvail?0 : fwdMode==='air_emergency'?1.5:6;

    // Move planes toward targets at their rate
    const aftDelta = clamp(pitchTarget - pAft.angle, -aftRate*dt, aftRate*dt);
    const fwdDelta = clamp(fwdTarget   - pFwd.angle, -fwdRate*dt, fwdRate*dt);
    pAft.angle = clamp(pAft.angle + aftDelta, -pitchMax, pitchMax);
    pFwd.angle = clamp(pFwd.angle + fwdDelta, -8, 8);

    // HPA cost for air emergency planes — per degree of movement
    if(hpa && (aftMode==='air_emergency' || fwdMode==='air_emergency')){
      const moveDeg = Math.abs(aftDelta)*(aftMode==='air_emergency'?1:0)
                    + Math.abs(fwdDelta)*(fwdMode==='air_emergency'?1:0);
      if(moveDeg > 0.001){
        hpa.pressure = Math.max(0, hpa.pressure - moveDeg * 0.02);
      }
      // Noise contribution from pneumatic plane actuation
      const planeNoise = (Math.abs(pAft.angle)/pitchMax)*0.08 + (Math.abs(pFwd.angle)/8)*0.04;
      player.noiseTransient = Math.min(1,(player.noiseTransient||0)+planeNoise*dt);
    }

    // Frozen planes stuck warning (once, when HPA runs out during air emergency)
    if((aftMode==='air_emergency'||fwdMode==='air_emergency') && !hpaAvail && !player._planesFrozenWarned){
      player._planesFrozenWarned = true;
      window.COMMS?.planes?.planesFrozenNoHPA(Math.round(pAft.angle));
    } else if(hpaAvail){ player._planesFrozenWarned = false; }

    // Actual pitch — aft planes dominate, fwd planes add small correction
    const pitchActual = pAft.angle * 0.85 + pFwd.angle * 0.15;
    player.pitch = pitchActual;

    // ── Fill-based depth controller ──────────────────────────────────────────
    // HPA authority gates venting (draining tanks) — flooding is always free
    const hpaBallastAuthV = player._hpaBallastAuth ?? 1.0;
    const kFill     = C.player.kFill    || 0.0016;
    const fillRate  = (C.player.fillRate || 0.022) * rateMult * (dmgFx.depthRateMult ?? 1.0);

    if(!blowing && mbt){
      // Target fill = neutral + proportional correction from depth error
      // errD>0 → too deep → need to flood more → targetFill > neutralFill
      const targetFill = clamp(neutralFill + errD * kFill, 0.02, 0.98);
      const wantDrain  = targetFill < avgFill; // need to vent water
      // Draining requires HPA authority; flooding is always free (sea pressure helps)
      const effectiveRate = wantDrain
        ? fillRate * hpaBallastAuthV
        : fillRate;
      const delta = clamp(targetFill - avgFill, -effectiveRate*dt, effectiveRate*dt);
      for(let i=0;i<mbt.tanks.length;i++) mbt.tanks[i] = clamp(mbt.tanks[i]+delta, 0, 1);
      // Track drain rate for HPA cost calculation
      player._fillDrainRate = delta < 0 ? Math.abs(delta)/dt : 0;
    }

    // Buoyancy velocity — fill below neutral → positive buoyancy → rise (negative vy)
    const buoyancyVy = (avgFill - neutralFill) * (C.player.buoyancyScale || 3.6);

    // Plane-driven vy: speed × sin(pitch) — blended with buoyancy at speed
    const planeVy   = -(player.speed / 1.944) * Math.sin(deg2rad(pitchActual));
    const planeBlend = clamp(player.speed / (C.player.planeMinSpeed||10), 0, 1);
    // During blow — let buoyancy and blowVy do the work, planes just provide attitude
    const planeContrib = blowing ? 0 : planeVy * planeBlend * planeAuthority;

    // Net velocity
    const netVy = buoyancyVy + planeContrib + sinkRate + (player._blowVy||0);
    player.depth = clamp(player.depth + netVy*dt, 0, world.ground-40);

    // ── Trim warnings (rate-limited) ─────────────────────────────────────────
    if(window.COMMS && floodBuoy > 0){
      const now = window.G?.game?.missionT||0;
      // Plane authority warning — once per crossing of each band
      const authBand = planeAuthority < 0.3 ? 'low' : planeAuthority < 0.6 ? 'med' : 'ok';
      if(authBand !== (player._lastAuthBand||'ok') && authBand !== 'ok'){
        player._lastAuthBand = authBand;
        if(authBand==='med') COMMS.trim.planesDemanded(Math.round(planeAuthority*100));
        if(authBand==='low') COMMS.trim.planesOverwhelmed(Math.round(player.speed));
      } else if(authBand==='ok') player._lastAuthBand='ok';
      // Buoyancy load warning — once per band crossing
      const buyBand = floodBuoy > 2.5 ? 'crit' : floodBuoy > 2.0 ? 'high' : floodBuoy > 1.0 ? 'med' : 'ok';
      if(buyBand !== (player._lastBuyBand||'ok')){
        player._lastBuyBand = buyBand;
        if(buyBand==='med')  COMMS.trim.ballastStrained(Math.round(floodBuoy/2.5*100));
        if(buyBand==='high') COMMS.trim.ballastLimit();
        if(buyBand==='crit') COMMS.trim.ballastOverwhelmed();
      }
    }

    // Depth envelope warnings and progressive flooding
    const C_p = C.player;
    const sdd  = C_p.safeDivingDepth ?? 300;
    const dl   = C_p.divingLimit     ?? 400;
    const dd   = C_p.designDepth     ?? 480;
    const colD = dmgFx.maxDepth ?? (C_p.maxDepth ?? 500);
    const tState = (window.G?.game?.tacticalState) || 'cruising';

    // ── Diving limit warning (once per crossing) ───────────────────────────
    if(player.depth > dl){
      if(!player._dlWarned){
        player._dlWarned = true;
        COMMS.depth.divingLimit(player.depth, tState);
      }
    } else {
      player._dlWarned = false;
    }

    // ── Design depth warning (once per crossing) ──────────────────────────
    if(player.depth > dd){
      if(!player._ddWarned){
        player._ddWarned = true;
        COMMS.depth.designDepth(player.depth);
      }
    } else {
      player._ddWarned = false;
    }

    // ── Collapse / crush depth ────────────────────────────────────────────
    const crushD = C_p.crushDepth ?? (colD * 1.08);
    if(player.depth >= crushD){
      // Past crush depth — catastrophic implosion, instant kill
      if(!player._crushed){
        player._crushed = true;
        COMMS.depth.crush(Math.round(player.depth));
        if(window.DMG?._escapeHalt) window.DMG._escapeHalt();
      }
    } else if(player.depth > colD){
      // Between collapse and crush — structural seep cascade
      if(!player._collapseWarned){
        player._collapseWarned = true;
        COMMS.depth.collapseImminentWarning(player.depth);
      }
      window.DMG?.applyDepthCascade?.(dt);
    } else {
      // Back above collapse depth — reset cascade
      player._collapseWarned = false;
      player._crushed        = false;
      window.DMG?.resetDepthCascade?.();
    }

    // Sync aliases
    player.y=player.depth;
    player.x=player.wx;

    // ── Timers ────────────────────────────────────────────────────────────────
    player.emergTurnT=Math.max(0,player.emergTurnT-dt);
    player.emergTurnCd=Math.max(0,player.emergTurnCd-dt);
    player.crashDiveT=Math.max(0,player.crashDiveT-dt);
    player.crashDiveCd=Math.max(0,player.crashDiveCd-dt);
  }

  window.NAV={ktsToWU,updateOrders,stepDynamics};
})();