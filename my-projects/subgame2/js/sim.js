(() => {
  'use strict';
  const C=window.CONFIG; const {rand,clamp,lerp,now,angleNorm}=window.M;
  const {world,cam,canvas,bullets,particles,enemies,decoys,contacts,cwisTracers,wireContacts,player,game,setMsg,addLog}=window.G;
  const I=window.I; const NAV=window.NAV; const {ktsToWU}=window.NAV; const SIG=window.SIG; const SENSE=window.SENSE; const W=window.W; const AI=window.AI; const DMG=window.DMG;

  function wrapX(x){return (x+world.w)%world.w;}
  // Legacy shim — depth charges pass no position so we let DMG pick a random compartment
  function damagePlayer(amount, hitX, hitY){
    DMG.hit(amount, hitX??null, hitY??null);
    W.makeExplosion(player.wx, player.wy, 0.8, true);
  }
  function damageEnemy(e,amount){
    e.hp-=amount;
    W.makeExplosion(e.x,e.y,amount>=90?1.6:1.0,e.type==="boat");
    if(e.hp<=0){
      game.score+=(e.type==="boat"?160:190);
      e.dead=true;
      // Permanent wreck marker
      window.G.wrecks.push({x:e.x, y:e.y, type:e.type, t:game.missionT||0});
      // Breaking-up noise is unmistakable — always logged regardless of detection state
      addLog('SONAR',`Conn, Sonar — breaking-up noises. ${e.type==='boat'?'Surface contact':'Submerged contact'} destroyed`);
      setMsg('TARGET DESTROYED',2.5);
      // Freeze the sonarContact — keeps TDC data but stops updating
      const sc=window.G.sonarContacts?.get(e);
      if(sc){ sc.dead=true; sc.activeT=0; }
      // DO NOT clearContact — let TDC retain last-known firing solution
    }
  }

  function clampConeDual(desiredDx,desiredDy,heading,coneDeg){
    const desAng=Math.atan2(desiredDy,desiredDx);
    const half=(coneDeg*Math.PI/180)*0.5;
    const diffF=angleNorm(desAng-heading);
    const diffR=angleNorm(desAng-(heading+Math.PI));
    const useRear=(Math.abs(diffR)<Math.abs(diffF));
    const diff=useRear?diffR:diffF;
    const clamped=clamp(diff,-half,half);
    const ang=(useRear?(heading+Math.PI):heading)+clamped;
    return {dx:Math.cos(ang),dy:Math.sin(ang),isRear:useRear,out:(Math.abs(diff)>half)};
  }

  function spawnScenario(scenario){
    game.scenario=scenario;
    enemies.length=0;
    if(scenario==='duel'){
      // 1v1 — single capable hunter, close range, no pinger
      const brg=rand(0,Math.PI*2);
      AI.spawnSub(brg, rand(1800,2600), 'hunter', 0);
      addLog('CONN','Conn, aye — single adversary contact. Battle stations');
      addLog('SONAR',`Conn, Sonar — one contact, bears ${Math.round(((brg*180/Math.PI)+360)%360).toString().padStart(3,'0')}°, classify submerged`);
    } else if(scenario==='ambush'){
      // Wolfpack ambush — already surrounded, close, all prosecuting from the start
      const count=4;
      for(let i=0;i<count;i++){
        const brg=(Math.PI*2/count)*i+rand(-0.3,0.3);
        const role=i<2?'hunter':'interceptor';
        const sub=AI.spawnSub(brg, rand(1200,2000), role, 0);
        // Pre-brief them — they know roughly where the player is
      }
      addLog('SONAR','Conn, Sonar — multiple contacts, all bearings, close range');
      addLog('CONN','All stations, Conn — battle stations. Prepare to evade and engage');
    } else if(scenario==='patrol'){
      // Barrier patrol — line of 2 pingers + 2 hunters across a fixed bearing, spread wide
      const barrierBrg=rand(0,Math.PI*2);
      const roles=['pinger','hunter','hunter','pinger'];
      for(let i=0;i<roles.length;i++){
        AI.spawnSub(barrierBrg, rand(3000,4000), roles[i], (i-1.5)*900);
      }
      addLog('SONAR','Conn, Sonar — four-contact barrier, spread across track');
      addLog('CONN','Helm, Conn — all ahead one-third. Rig for ultra-quiet');
    } else {
      // Default: waves
      game.wave=0; game.waveDelay=0;
      spawnWave(1);
    }
  }

  function reset(){
    bullets.length=0;particles.length=0;enemies.length=0;decoys.length=0;contacts.length=0;cwisTracers.length=0;wireContacts.length=0;
    if(window.G.wrecks) window.G.wrecks.length=0;
    window.G.resetTorpIds();
    if(window.ROUTE) window.ROUTE.length=0;
    game.score=0;game.over=false;game.msg="";game.msgT=0;game.missionT=0;game.msgLog=[];game.sonarLog=[];
    player.pendingFires=[];
    const spawn=window.MAPS?.getMap()?.playerSpawn||{wx:4000,wy:5000};
    player.wx=spawn.wx; player.wy=spawn.wy; player.x=spawn.wx;
    player.heading=0; player.speed=0; player.speedOrderKts=0;
    player.depth=260; player.depthOrder=260; player.y=260;
    player.vy=0; player.turnRate=0; player.hp=C.player.hpMax; player.invuln=0;
    player.noise=0; player.noiseTransient=0; player.cavitating=false;
    player.torpCd=0; player.missileCd=0; player.pingCd=0; player.cmCd=0; player.sonarPulse=0; player.periscopeCd=0; player.periscopeT=0;
    // Torpedo tubes: array of per-tube reload countdowns (0 = loaded & ready)
    const nTubes=C.player.torpTubes||4;
    player.torpTubes=[];
    for(let i=0;i<nTubes;i++) player.torpTubes.push(0);
    player.torpStock=C.player.torpStock||12;
    player.silent=false; player.emergTurnT=0; player.emergTurnCd=0; player.crashDiveT=0; player.crashDiveCd=0; player.passiveTick=0;
    // Per-tube wire tracking — null=no wire, or reference to the live torpedo
    player.tubeWires = new Array(C.player.torpTubes||4).fill(null);
    game.wirePanel = { selectedTube:0 };
    DMG.initDamage();
    // Wave system — initialise
    game.wave=0;
    game.waveDelay=0;
    game.groupState='patrol';
    game.groupStateT=0;
    game.prosecutingT=0;
    if(game.started!==false) spawnScenario(game.scenario||'waves');
  }

  function spawnWave(waveNum){
    game.wave=waveNum;
    game.groupState='patrol';
    game.prosecutingT=0;

    const comps=C.enemy.waveComps;
    const roles=comps[Math.min(waveNum-1, comps.length-1)];
    const count=roles.length;

    // Random bearing for the group to arrive from
    const groupBrg=rand(0, Math.PI*2);
    const dist=rand(C.enemy.waveSpawnMinR, C.enemy.waveSpawnMaxR);
    const spread=C.enemy.waveFormationSpread;

    // Spread members in line-abreast perpendicular to approach bearing
    // Centred so formation is symmetric
    const offsets=[];
    for(let i=0;i<count;i++) offsets.push((i-(count-1)/2)*spread);

    for(let i=0;i<count;i++){
      AI.spawnSub(groupBrg, dist, roles[i], offsets[i]);
    }

    const waveLabel=waveNum===1?'Conn, Sonar — first contacts. Patrol group, classify submerged'
      :waveNum===2?'Conn, Sonar — new group bearing. Prosecution force, classify submerged'
      :'Conn, Sonar — new contacts. Full group, classify submerged';
    addLog('CONN', waveLabel);
    addLog('SONAR', `Conn, Sonar — ${count} contact${count>1?'s':''}, group bears ${Math.round(((groupBrg*180/Math.PI)+360)%360).toString().padStart(3,'0')}°`);
  }
  reset();

  function update(dt){
    if(I.keys.has("r")){ I.keys.delete("r"); game.started=false; reset(); }
    // ` (backtick) — toggle debug true-position overlay
    if(I.keys.has("`")){ I.keys.delete("`"); game.debugOverlay=!game.debugOverlay; setMsg(game.debugOverlay?"[DEBUG] TRUE POS ON":"[DEBUG] TRUE POS OFF",1.2); }
    if(I.keys.has("h")){ I.keys.delete("h"); game.showDmgPanel=!game.showDmgPanel; }

    player.torpCd=Math.max(0,player.torpCd-dt);
    // Tick tube reload timers (skip wire-occupied tubes: value -1)
    for(let i=0;i<(player.torpTubes||[]).length;i++)
      if(player.torpTubes[i]>0) player.torpTubes[i]=Math.max(0,player.torpTubes[i]-dt);


    // Returns true and consumes one tube+stock if a shot can be fired; false otherwise
    // Reserve a tube (starts reload for non-wire shots, or marks as wire-occupied).
    // Returns tube index or -1.
    function reserveTube(){
      const tubes=player.torpTubes;
      const stock=player.torpStock;
      if(!tubes||tubes.length===0) return -1;
      if(typeof stock!=='number'||stock<=0) return -1;
      let ready=-1;
      for(let i=0;i<tubes.length;i++){ if(tubes[i]===0){ready=i;break;} }
      if(ready<0) return -1;
      // Tube stays at -1 (wire-occupied) until wire breaks; non-wire starts reload now
      tubes[ready]=-1; // will be set to reloadTime or by _onWireCut
      player.torpStock=stock-1;
      return ready;
    }
    window._reserveTube=reserveTube;

    // Called when a wire breaks (any reason) — start tube reload
    window.G._onWireCut=(b)=>{
      const tubeWires=player.tubeWires||[];
      for(let i=0;i<tubeWires.length;i++){
        if(tubeWires[i]===b){
          tubeWires[i]=null;
          player.torpTubes[i]=Math.round((C.player.torpReloadTime||28)*(DMG.getEffects().reloadMult||1));
          addLog('WEPS',`Conn, Weps — tube ${i+1}, wire parted. Reloading`);
          break;
        }
      }
      // Wire cut — torpedo flies last commanded bearing, passive seeker searches.
      // No reattack circle — torpedo has no knowledge of a map position, only what its seeker hears.
      if(b && !b.target){
        // Nothing to do — torpedo continues on current heading, seeker runs normally
      }
    };

    // Tick pending fire queue — staged crew launch sequence
    // Timeline (t counts DOWN from fireDelay=4.5s to 0):
    //   t=4.5  CONN: "Weps, Conn — firing point procedures…"  (logged at push time)
    //   t<4.0  WEPS: "Conn, Weps — tube N, solution set"
    //   t<3.2  WEPS: "Tube N, flooding down"
    //   t<2.0  WEPS: "Conn, Weps — tube N ready in all respects, outer door open"
    //   t<1.0  CONN: "Shoot on generated bearing" / "Shoot, manual bearing"
    //   t<=0   WEPS: "Tube N fired electrically" + SONAR: "Own unit away, running normally"
    if(!player.pendingFires) player.pendingFires=[];
    const FD=C.player.fireDelay||4.5;
    for(const pf of player.pendingFires){
      pf.t-=dt;

      if(!pf._log1 && pf.t < FD-0.5){
        pf._log1=true;
        addLog('WEPS',`Conn, Weps — tube ${pf.tubeIdx+1}, solution set`);
      }
      if(!pf._log2 && pf.t < FD-1.3){
        pf._log2=true;
        addLog('WEPS',`Tube ${pf.tubeIdx+1}, flooding down`);
      }
      if(!pf._log3 && pf.t < FD-2.5){
        pf._log3=true;
        addLog('WEPS',`Conn, Weps — tube ${pf.tubeIdx+1} ready in all respects, outer door open`);
      }
      if(!pf._log4 && pf.t < FD-3.5){
        pf._log4=true;
        addLog('CONN', pf.manual
          ? 'Shoot, manual bearing'
          : `Shoot on generated bearing`);
      }

      // Launch
      if(pf.t<=0){
        pf.done=true;
        const sx=player.wx+Math.cos(player.heading)*C.player.r*1.35;
        const sy=player.wy+Math.sin(player.heading)*C.player.r*1.35;
        player.noiseTransient=Math.min(1,player.noiseTransient+0.18);
        if(pf.wire){
          const wireSnapped=W.fireTorpedo(sx,sy,pf.ddx,pf.ddy,true,C.player.torpEnableDist,true,pf.launchOffset,player.depth,pf.fireDepth);
          const torp=bullets[bullets.length-1];
          if(!wireSnapped && torp?.wire?.live){
            if(!player.tubeWires) player.tubeWires=new Array(C.player.torpTubes||4).fill(null);
            player.tubeWires[pf.tubeIdx]=torp;
            torp.wire.autoTDC=true;
            torp.wire.lockedTarget=pf.lockedTarget??null;
            torp.wire.tubeIdx=pf.tubeIdx;
          } else {
            player.torpTubes[pf.tubeIdx]=Math.round((C.player.torpReloadTime||28)*(DMG.getEffects().reloadMult||1));
          }
          addLog('WEPS',`Tube ${pf.tubeIdx+1} fired electrically`);
          if(wireSnapped){
            addLog('WEPS',`Conn, Weps — tube ${pf.tubeIdx+1}, wire parted on launch, unit running free`);
          } else {
            addLog('SONAR',`Conn, Sonar — own unit is away, running normally. Wire live`);
          }
        } else {
          W.fireTorpedo(sx,sy,pf.ddx,pf.ddy,true,C.player.torpEnableDist,false,0,player.depth,pf.fireDepth);
          player.torpTubes[pf.tubeIdx]=Math.round((C.player.torpReloadTime||28)*(DMG.getEffects().reloadMult||1));
          addLog('WEPS',`Tube ${pf.tubeIdx+1} fired electrically`);
          addLog('SONAR',`Conn, Sonar — own unit is away, running normally`);
        }
        setMsg('TORPEDO AWAY',1.2);
      }
    }
    player.pendingFires=player.pendingFires.filter(pf=>!pf.done);

    // ── Pending log queue — staged crew comms ─────────────────────────────────
    if(!player.pendingLogs) player.pendingLogs=[];
    for(const pl of player.pendingLogs){ pl.t-=dt; if(pl.t<=0){ pl.done=true; addLog(pl.station,pl.msg); } }
    player.pendingLogs=player.pendingLogs.filter(pl=>!pl.done);

    // ── Crash dive depth-passing calls ────────────────────────────────────────
    if((player.crashDiveT??0)>0){
      if(!player._crashDepthCalled) player._crashDepthCalled=new Set();
      const band=Math.floor(player.depth/50)*50;
      if(band>=100 && !player._crashDepthCalled.has(band)){
        player._crashDepthCalled.add(band);
        addLog('HELM',`Conn, Helm — passing ${band} metres`);
      }
    } else if(player._crashDepthCalled?.size>0){
      player._crashDepthCalled=new Set();
    }

    player.missileCd=Math.max(0,player.missileCd-dt);
    player.pingCd=Math.max(0,player.pingCd-dt);
    player.cmCd=Math.max(0,player.cmCd-dt);
    player.invuln=Math.max(0,player.invuln-dt);
    DMG.tick(dt);
    if(game.hitFlash>0) game.hitFlash=Math.max(0,game.hitFlash-dt*2.5);
    player.sonarPulse=Math.max(0,player.sonarPulse-dt);
    game.missionT=(game.missionT||0)+dt;
    game.msgT=Math.max(0,game.msgT-dt); if(game.msgT<=0) game.msg="";

    // ── TDC: update solution from designated target ───────────────────────────
    // Solution quality is continuous — no binary freeze/unfreeze.
    // Contacts persist; quality drives what data is available.
    {
      const tdc=game.tdc;
      const ref=tdc.target;

      // Validity checks — clear only if target truly gone
      if(ref){
        if(ref._isTorp){
          if(!bullets.includes(ref)||ref.life<=0){ tdc.target=null; tdc.targetId=null; }
        } else if(!ref.dead && !enemies.includes(ref)){
          tdc.target=null; tdc.targetId=null;
        }
      }

      // Frozen only means confirmed kill — data persists for reference
      tdc.frozen = (tdc.target?.dead===true);

      if(tdc.target && !tdc.frozen){
        const ref=tdc.target;
        const sc=ref._isTorp ? null : window.G.sonarContacts?.get(ref);
        const tmaQ=sc?.tmaQuality??1.0;
        const TMA=C.tma;

        // Purely bearing-based TDC. No position stored or used — ever.
        // Quality drives the confidence tier shown to player and fire permission.
        // SOLID fires on latest bearing with lead-angle from estimated bearing rate.
        // DEGRADED fires directly on raw bearing. BEARING blocks fire.
        const bestBrg = sc ? (sc.latestHullBrg ?? sc.latestBrg) : null;
        if(sc && bestBrg!=null){
          tdc.rawBrg = ((Math.atan2(Math.cos(bestBrg), -Math.sin(bestBrg))*180/Math.PI)+360)%360;
        } else {
          tdc.rawBrg = null;
        }
        // DEP: estimated, not measured. At SOLID quality add ±100m noise.
        // At DEGRADED show a heavily rounded estimate. At BEARING ONLY hide it.
        {
          const trueDepth = ref.depth ?? 200;
          if(tmaQ >= TMA.qualityThresholdSolid){
            // SOLID: ±80m noise, rounded to nearest 25m
            const noise = (Math.random()-0.5)*160;
            tdc.depth = Math.round((trueDepth + noise) / 25) * 25;
          } else if(tmaQ >= TMA.qualityThresholdRange){
            // DEGRADED: ±200m noise, rounded to nearest 50m
            const noise = (Math.random()-0.5)*400;
            tdc.depth = Math.round((trueDepth + noise) / 50) * 50;
          } else {
            tdc.depth = null; // bearing-only — no depth info
          }
        }
        tdc.tmaQuality=tmaQ;

        // Populate range, course, speed estimates from TMA data where available.
        // These are bearing-only estimates — accuracy depends on TMA quality.
        // Shown as approximate; only populated at DEGRADED or better.
        if(sc && tmaQ>=TMA.qualityThresholdRange){
          const estRange=sc._estRange??null;
          tdc.range=estRange!=null ? Math.round(estRange) : null;

          // Speed estimate: at SOLID tier, use bearing rate × range / own-speed geometry
          // v_target ≈ brgRate * range (for targets moving roughly cross-track)
          // Clamp to realistic sub speeds
          const brgRate=sc._brgRate??null;
          if(brgRate!=null && estRange!=null && tmaQ>=TMA.qualityThresholdSolid){
            const rawSpd=Math.abs(brgRate)*estRange; // wu/s
            tdc.speed=Math.round(clamp(rawSpd,0,30));
          } else {
            tdc.speed=null;
          }

          // Course estimate: direction the target appears to be moving.
          // If bearing is increasing, target is moving left-to-right relative to us;
          // project course as 90° offset from bearing (rough but directionally correct).
          if(brgRate!=null && bestBrg!=null && tmaQ>=TMA.qualityThresholdSolid){
            const compassBrg=((Math.atan2(Math.cos(bestBrg),-Math.sin(bestBrg))*180/Math.PI)+360)%360;
            // Positive brgRate = target moving right (clockwise), so course is brg+90
            const courseOffset=brgRate>0?90:-90;
            tdc.course=((compassBrg+courseOffset)+360)%360;
          } else {
            tdc.course=null;
          }
        } else {
          tdc.range=null; tdc.course=null; tdc.speed=null;
        }

        // Bearing rate: compute from last two hull bearings to get lead angle
        // Only used for SOLID tier — DEGRADED just uses raw bearing directly
        let intBearing=null;
        if(tmaQ>=TMA.qualityThresholdSolid && bestBrg!=null){
          const brgRate=sc._brgRate??0; // rad/s, computed in passiveUpdate
          // Lead angle: torpedo flight time * bearing rate gives angular correction
          const torpSpd=C.torpedo.speed;
          const estRange=(sc._estRange??TMA.defaultRange);
          const tof=estRange/torpSpd;
          intBearing=bestBrg + brgRate*tof*0.6; // 0.6 damp — we're estimating
        } else if(bestBrg!=null && tmaQ>=TMA.qualityThresholdRange){
          intBearing=bestBrg; // DEGRADED: no lead, fire down the bearing
        }
        tdc.intercept=intBearing!=null ? intBearing : null;
      }
    }

    for(const e of enemies){
      if(e.seen>0) e.seen=Math.max(0,e.seen-dt);
      if(e.detectedT>0) e.detectedT=Math.max(0,e.detectedT-dt);
      if(e.pingPulse>0) e.pingPulse=Math.max(0,e.pingPulse-dt);
      if(e.evadeT>0){e.evadeT=Math.max(0,e.evadeT-dt); if(e.evadeT<=0){e.evadeFrom=null;e.evadeDecoy=null;e._evadePhase=null;e._counterFired=false;}}
    }

    if(!game.over){
      NAV.updateOrders(dt);
      NAV.stepDynamics(dt);  // handles all movement including player.wx/wy/depth/y
      SIG.updateNoise(dt);

      // Cavitation onset/clearance log
      if(player.cavitating && !player._wasCav){
        addLog('ENG','Conn, Eng — cavitating. Noise signature elevated');
      } else if(!player.cavitating && player._wasCav){
        addLog('ENG','Conn, Eng — cavitation clear');
      }
      player._wasCav=player.cavitating;

      // Tube reload-complete log (skip wire-occupied tubes: value -1)
      for(let i=0;i<(player.torpTubes||[]).length;i++){
        const prev=player._prevTubes?.[i]??0;
        const cur=player.torpTubes[i];
        if(prev>0 && cur===0 && player.torpStock>=0){
          addLog('WEPS',`Conn, Weps — tube ${i+1} reloaded, ready in all respects`);
        }
      }
      player._prevTubes=(player.torpTubes||[]).slice();

      // ── WEPS solution — proposed firing bearing from TDC data ───────────────
      {
        const tdc=game.tdc;
        if(tdc.target && !tdc.target.dead){
          const q=tdc.tmaQuality??0;
          const TMA=C.tma;
          let bearing, confidence, depth;
          if(q>=TMA.qualityThresholdSolid && tdc.intercept!=null){
            // SOLID: reliable position + lead-angle intercept
            bearing=tdc.intercept; confidence='solid'; depth=tdc.depth??player.depth;
          } else if(q>=TMA.qualityThresholdRange && tdc.rawBrg!=null){
            // DEGRADED: bearing only — direct observed bearing, no lead angle
            const brgMath=(tdc.rawBrg-90)*Math.PI/180;
            bearing=brgMath; confidence='degraded'; depth=tdc.depth??player.depth;
          } else if(tdc.rawBrg!=null){
            // POOR: show bearing but block fire
            const brgMath=(tdc.rawBrg-90)*Math.PI/180;
            bearing=brgMath; confidence='bearingonly'; depth=player.depth;
          } else {
            bearing=null;
          }
          game.wepsProposal=bearing!=null?{bearing,confidence,depth}:null;
        } else {
          game.wepsProposal=null;
        }
      }

      // Aim world coords: unproject mouse through camera (centred on plot area)
      const Z=cam.zoom;
      const DPR=canvas.DPR||window.G.DPR||1;
      I.aimWorldX=cam.x+(I.mouseX-(canvas.width-88*DPR)/2)/(Z*DPR);
      I.aimWorldY=cam.y+(I.mouseY-(canvas.height-190*DPR)/2)/(Z*DPR);
      // Periscope (O) — shallow only
      if(I.keys.has("o") && player.periscopeCd<=0){
        I.keys.delete("o");
        if(player.depth>C.player.periscopeDepth){
          setMsg("PERISCOPE: TOO DEEP", 1.0);
        } else {
          player.periscopeCd = C.player.periscope.cd;
          player.periscopeT  = C.player.periscope.dur;
          player.noiseTransient = Math.min(1, player.noiseTransient + C.player.periscope.noiseSpike);
          let shown = 0;
          for(const e of enemies){
            if(e.type!=="boat") continue;
            const dx = AI.wrapDx(player.wx, e.x);
            const dy = e.y - player.wy;
            const d = Math.hypot(dx,dy);
            if(d <= C.player.periscope.revealR){
              SENSE.setDetected(e, C.detection.detectT*1.4, C.detection.seenT*1.2);
              shown++;
            }
          }
          setMsg(shown>0 ? `SCOPE: ${shown} ship(s)` : "SCOPE: no ships", 1.2);
        }
      }

      SENSE.proximityDetect();

      // ── Inbound torpedo crew alert system ────────────────────────────────────
      // Four escalating phases, each fires once per torpedo.
      // _crewPhase: 0=undetected, 1=CONTACT, 2=SEARCHING, 3=CLOSING, 4=ATTACK
      for(const b of bullets){
        if(b.kind!=='torpedo'||b.friendly||b.life<=0) continue;
        if(!b._crewPhase) b._crewPhase=0;

        const dx=AI.wrapDx(b.x,player.wx), dy=b.y-player.wy;
        const dist=Math.hypot(dx,dy);
        const brgMath=Math.atan2(dy,dx);
        const brgDeg=((Math.atan2(dx,dy)*180/Math.PI)+360)%360;
        const brgStr=Math.round(brgDeg).toString().padStart(3,'0');

        // ── Phase 1: CONTACT — torpedo first heard acoustically ───────────────
        if(b._crewPhase<1){
          const detectRange=1200;
          if(dist>detectRange){ b._crewPhase=0; continue; }
          const torpNoise=0.85;
          const layer=AI.layerPenalty(player.depth, b.depth??200);
          const signal=torpNoise*layer*(1-dist/detectRange);
          const detect=signal-player.noise*0.80;
          if(detect<=0) continue;
          const pDetect=clamp(0.08+detect*0.60, 0, 0.85)*dt;
          if(Math.random()<pDetect){
            b._alertedPlayer=true;
            b._crewPhase=1;
            contacts.push({fromX:player.wx,fromY:player.wy,bearing:brgMath,u_brg:0.12,life:3.0,kind:'torpedo'});
            setMsg('TORPEDO IN THE WATER!', 3.0);
            addLog('SONAR', `Conn, Sonar — new contact, high-speed screws, bears ${brgStr}, classify torpedo`);
            addLog('CONN',  `All stations, Conn — battle stations torpedo. Man your evasion stations`);
          }
          continue;
        }

        // Detected — keep bearing flash updated
        if(b._brgFlashT==null) b._brgFlashT=0;
        b._brgFlashT=(b._brgFlashT||0)-dt;
        if(b._brgFlashT<=0){
          b._brgFlashT=rand(1.2,2.0);
          contacts.push({fromX:player.wx,fromY:player.wy,bearing:brgMath,u_brg:0.08,life:2.5,kind:'torpedo'});
        }

        // ── Phase 2: SEARCHING — seeker active, torpedo hunting ───────────────
        if(b._crewPhase<2){
          const seekerOn=b.traveled>=(b.enableDist||300);
          if(seekerOn && dist<800){
            b._crewPhase=2;
            addLog('SONAR', `Conn, Sonar — torpedo bears ${brgStr}, seeker active, weapon is hunting`);
            addLog('CONN',  `All stations, Conn — stand by for evasion. Helm, stand by emergency manoeuvre`);
            setMsg('TORPEDO SEEKER ACTIVE', 2.5);
          }
        }

        // ── Phase 3: CLOSING — high closing rate inside 450wu ─────────────────
        if(b._crewPhase<3 && b._crewPhase>=2){
          const vToPlayer=(b.vx*(-dx)+b.vy*(-dy))/Math.max(dist,1);
          const closing=vToPlayer>8;
          if(closing && dist<450){
            b._crewPhase=3;
            const torpRelAng=angleNorm(brgMath-player.heading);
            const turnDir=torpRelAng>0?'LEFT':'RIGHT';
            // Reciprocal bearing — turn TOWARD the torpedo, not away
            const recipDeg=Math.round((brgDeg+180)%360).toString().padStart(3,'0');
            addLog('SONAR', `Conn, Sonar — torpedo bears ${brgStr}, high closing rate, inbound`);
            addLog('CONN',  `Helm, Conn — come to ${recipDeg}, emergency deep, all ahead flank`);
            setMsg(`TURN TO ${recipDeg} — EMERGENCY DEEP`, 3.0);
          }
        }

        // ── Phase 4: ATTACK — seeker locked on player ─────────────────────────
        if(b._crewPhase<4 && b._crewPhase>=2){
          if(b.target===player){
            b._crewPhase=4;
            const torpRelAng=angleNorm(brgMath-player.heading);
            const turnDir=torpRelAng>0?'LEFT':'RIGHT';
            const recipDeg2=Math.round((brgDeg+180)%360).toString().padStart(3,'0');
            addLog('SONAR', `Conn, Sonar — weapon has acquisition, bears ${brgStr}, impact imminent`);
            addLog('CONN',  `All stations, Conn — steer ${recipDeg2}, emergency deep, flank speed. Deploy all countermeasures`);
            setMsg('WEAPON HAS ACQUISITION', 4.0);
            contacts.push({fromX:player.wx,fromY:player.wy,bearing:brgMath,u_brg:0.04,life:4.0,kind:'torpedo'});
          }
        }
      }
      if(I.keys.has(" ")&&player.pingCd<=0){I.keys.delete(" "); SENSE.activePing(); setMsg("PING!",0.8);}
      SENSE.passiveUpdate(dt);
      SENSE.towedArrayUpdate(dt);

      // ── Towed array position trail ────────────────────────────────────────────
      // Store player positions so the cable can follow the actual path taken.
      // Each entry: {wx, wy} sampled every ~0.12s. We keep enough history to cover
      // the full deployed cable length at any speed.
      {
        const ta = player.towedArray;
        if(!player._cableTrail) player._cableTrail = [];
        const trail = player._cableTrail;

        // Sample interval — finer = smoother curve, 0.10s is plenty
        player._cableTrailT = (player._cableTrailT||0) - dt;
        if(player._cableTrailT <= 0){
          player._cableTrailT = 0.10;
          trail.unshift({wx: player.wx, wy: player.wy});
          // Max entries: cable deploys at ~13wu/s max speed over 400wu = ~30s of trail
          // At 0.10s intervals that's 300 entries — keep 400 for margin
          if(trail.length > 800) trail.length = 800;
        }

        // When retracting, shrink the effective length so cable visually reels in
        // When stowed/destroyed, clear the trail
        if(!ta || ta.state === 'stowed' || ta.state === 'destroyed'){
          player._cableTrail = [];
        }
      }

      // Towed array speed warning — alert before damage threshold
      {
        const ta = player.towedArray;
        if((ta.state==='operational'||ta.state==='damaged') && player.speed >= 16 && player.speed < 18){
          if(!ta._warnedSpeed){
            ta._warnedSpeed = true;
            addLog('ENG',  `Conn, Eng — array overspeed. Rated 18kt, currently ${Math.round(player.speed)}kt. Risk of cable loss`);
          }
        } else {
          ta._warnedSpeed = false;
        }
      }

      // Shift+LMB = MANUAL OVERRIDE — fire on aimed bearing regardless of WEPS solution
      if(I.torpAimClick){
        I.torpAimClick=false;
        if((player.pendingFires||[]).length>0){
          setMsg('FIRING IN PROGRESS',0.8);
          addLog('WEPS','Conn, Weps — unable, firing sequence in progress');
        } else {
        const tubeIdx=reserveTube();
        if(tubeIdx>=0){
          const tdc=game.tdc;
          const aimDx=I.aimWorldX-player.wx, aimDy=I.aimWorldY-player.wy;
          const d=Math.max(1e-6,Math.hypot(aimDx,aimDy));
          const ddx=aimDx/d, ddy=aimDy/d;
          const launchOffset=Math.abs(angleNorm(Math.atan2(ddy,ddx)-player.heading));
          const fireDepth=tdc.target ? (tdc.depth!=null?tdc.depth:player.depth) : player.depth;
          addLog('CONN',`Weps, Conn — firing point procedures, manual bearing, tube ${tubeIdx+1}`);
          setMsg('FIRING…',0.6);
          player.pendingFires.push({t:C.player.fireDelay, tubeIdx, ddx, ddy, launchOffset, fireDepth, wire:true, lockedTarget:game.tdc.target, manual:true});
        } else {
          const why=player.torpStock<=0?'No weapons remaining':'All tubes reloading';
          setMsg(why.toUpperCase(),0.8); addLog('WEPS',why);
        }
        } // end pendingFires gate
      }

      // F = quick fire straight ahead, no wire
      if(I.keys.has("f")){
        I.keys.delete("f");
        if((player.pendingFires||[]).length>0){
          setMsg('FIRING IN PROGRESS',0.8);
          addLog('WEPS','Conn, Weps — unable, firing sequence in progress');
        } else {
        const tubeIdx=reserveTube();
        if(tubeIdx>=0){
          const tdc=game.tdc;
          let ddx,ddy,fireDepth;
          if(tdc.target && tdc.intercept!=null){
            ddx=Math.cos(tdc.intercept); ddy=Math.sin(tdc.intercept);
            fireDepth=tdc.depth??player.depth;
          } else {
            ddx=Math.cos(player.heading); ddy=Math.sin(player.heading);
            fireDepth=player.depth;
          }
          const tdcStr=game.tdc.targetId?` on ${game.tdc.targetId}`:'';
          const trackStr=game.tdc.targetId?`, track ${game.tdc.targetId}`:'';
          addLog('CONN',`Weps, Conn — firing point procedures${trackStr}, tube ${tubeIdx+1}`);
          setMsg('FIRING…',0.6);
          player.pendingFires.push({t:C.player.fireDelay, tubeIdx, ddx, ddy, launchOffset:0, fireDepth, wire:false});
        } else {
          const why=player.torpStock<=0?'No weapons remaining':'All tubes reloading';
          setMsg(why.toUpperCase(),0.8); addLog('WEPS',why);
        }
        } // end pendingFires gate
      }

      // G = VLS missile (shallow only)
      if(I.keys.has("g")&&player.missileCd<=0){
        I.keys.delete("g");
        if(player.depth>C.player.periscopeDepth){
          setMsg("MISSILE: TOO DEEP",0.8);
          addLog('CONN','Weps, Conn — VLS abort. Too deep to launch');
        } else {
          player.missileCd=C.player.missileCd;
          player.noiseTransient=Math.min(1,player.noiseTransient+0.35);
          setMsg("VLS LAUNCH!",1.0);
          addLog('CONN','Weps, Conn — VLS, fire');
          addLog('WEPS','Conn, Weps — missile away');
          W.fireMissileVLS(player.wx,player.wy,true);
        }
      }

      // X = deploy noisemaker
      if(I.keys.has("x")&&player.cmCd<=0){
        I.keys.delete("x");
        player.cmCd=C.player.cmCd;
        W.deployDecoy(player.wx,player.wy,true,"noisemaker");
        player.noiseTransient=Math.min(1,player.noiseTransient+0.10);
        setMsg("NOISEMAKER OUT",0.9);
        addLog('CONN','Weps, Conn — deploy countermeasures');
        addLog('WEPS','Conn, Weps — noisemaker away');
        queueLog('SONAR','Conn, Sonar — decoy running, own noise masking',1.5);
      }
    }

    // enemies
    for(const e of enemies){
      AI.enemyMaybeHearPlayer(e,dt);
      AI.enemyDecay(e,dt);

      const state=(e.suspicion>C.enemy.susEngage)?"engage":(e.suspicion>C.enemy.susInvestigate?"investigate":"patrol");

      if(e.type==="boat"){
        // Surface ships move in top-down 2D — they have a heading and speed
        e.x=(e.x+e.vx*dt+world.w)%world.w;
        e.y=(e.y+e.vy*dt+world.h)%world.h;
        e.hitY=0; // boats are always at surface depth=0

        if(state==="patrol"){
          e.vx=clamp(e.vx+Math.sin(now()*0.6+e.x*0.002)*2*dt,-40,-8);
        } else if(e.contact){
          const dx=AI.wrapDx(e.x,e.contact.x);
          const sweep=Math.sin(now()*1.1+e.x*0.002)*16;
          e.vx += clamp((dx*0.0010)+sweep*0.02,-12,12)*dt;
          e.vx=clamp(e.vx,-62,-10);
        }

        e.fireCd-=dt;
        if(e.fireCd<=0 && !game.over){
          const t=(state==="engage")?C.enemy.boatFireEngage:C.enemy.boatFireOther;
          e.fireCd=rand(t[0],t[1]);
          if(AI.enemyHasFireSolution(e)){
            const tx=e.contact.x, ty=e.contact.y;
            const dx=AI.wrapDx(e.x,tx);
            const dy=ty-e.y;
            const d=Math.hypot(dx,dy);
            if(ty>world.seaLevel+140 && d<1350 && e.contact.u<900){
              W.dropDepthCharge(e.x+rand(-18,18),e.y+6,ty);
            } else if(d<1650 && e.contact.u<1000){
              W.fireTorpedo(e.x,e.y+10,dx,dy+140,false,260);
            }
          }
        }

        // Torpedo reaction — boats deploy noisemaker decoys and jink speed,
        // mirroring what enemy subs do. flareCd is reused as the noisemaker cd.
        e.flareCd = Math.max(0, (e.flareCd||0) - dt);
        for(const b of bullets){
          if(b.kind!=="torpedo" || !b.friendly || b.life<=0 || b._alertedEnemy===e) continue;
          const dx=AI.wrapDx(e.x,b.x);
          const dy=b.y-e.hitY;
          const dd=Math.hypot(dx,dy);
          if(dd>C.enemy.boatTorpReactR) continue;
          // Surface ships hear torpedoes well — low own-noise, no layer issue
          // but signal still falls off with range
          const signal=0.90*(1-dd/C.enemy.boatTorpReactR);
          const pDetect=clamp(0.12+signal*0.65, 0, 0.90)*dt;
          if(Math.random()>pDetect) continue;
          b._alertedEnemy=e;
          e.suspicion=Math.min(1,e.suspicion+0.15);
          if(e.flareCd<=0){
            e.flareCd=rand(3.5,6.0);
            W.deployDecoy(
              wrapX(e.x+rand(-30,30)),
              e.hitY+rand(10,30),
              false, "noisemaker",
              {vx:rand(-2,2), vy:rand(2,5)}
            );
            setMsg("SHIP: COUNTERMEASURES!",0.8);
          }
        }
      } else {
        // ── Enemy submarine movement ─────────────────────────────────────────
        e.x=(e.x+e.vx*dt+world.w)%world.w;
        e.y=(e.y+e.vy*dt+world.h)%world.h;

        // ── Desired heading — TMA-aware state machine ─────────────────────────
        // States: patrol → investigate (hearing something) → tma-build (deliberate
        // cross-track sprint to build baseline) → engage (sprint+fire on solution)
        let desiredHeading=e.heading||0;
        e.navT=(e.navT||0)-dt;

        const tmaQ=e.tmaQuality||0;
        const hasFix=tmaQ>=0.35;     // good enough to close
        const hasShot=tmaQ>=0.45;    // good enough to fire

        if(e.evadeT>0 && e.evadeFrom){
          // ── B+C EVASION: Layer exploitation + Knuckle sprint-stop ───────────
          // Phase structure stored on e._evadePhase:
          //   'sprint1' → flank sprint away from torpedo (8-12s)
          //   'knuckle' → cut to near-stop, drop CM, let knuckle fade (5-7s)
          //   'sprint2' → sprint in new direction to open range
          // Layer logic: pick a target depth on the other side of the layer from torpedo.

          if(!e._evadePhase){
            // First frame of evasion — initialise phase and pick a layer-exploit depth
            e._evadePhase = 'sprint1';
            e._evadePhaseT = rand(8,12);

            // Layer exploitation: if torpedo is above layer, go below; if below, go above.
            // Layer band: world.layerY1 to world.layerY2 (180-280m)
            const layerMid = ((world.layerY1||180)+(world.layerY2||280))/2;
            const torpDepth = e.evadeFrom ? (e.evadeFrom.depth??300) : 300;
            if(torpDepth < layerMid){
              // Torpedo is above layer — dive below it
              e.depthOrder = rand((world.layerY2||280)+60, (world.layerY2||280)+300);
            } else {
              // Torpedo is below layer — sprint up through it
              e.depthOrder = rand(40, (world.layerY1||180)-40);
            }
            e.depthChangeT = 999; // hold this depth through full evasion
            // counter-shot fires at first detection, not during knuckle
          }

          e._evadePhaseT = (e._evadePhaseT||0) - dt;

          // Torpedo direction vector
          const tdx=AI.wrapDx(e.evadeFrom.x,e.x);
          const tdy=e.y-e.evadeFrom.y;
          const awayAng=Math.atan2(tdy,tdx);
          const perpA=awayAng+Math.PI/2, perpB=awayAng-Math.PI/2;
          const curH=e.heading||0;
          const bestPerp=Math.abs(angleNorm(perpA-curH))<Math.abs(angleNorm(perpB-curH))?perpA:perpB;

          if(e._evadePhase==='sprint1'){
            // Blend away+perp heading at flank speed
            desiredHeading = angleNorm(bestPerp*0.6 + awayAng*0.4);
            if(e._evadePhaseT<=0){
              e._evadePhase='knuckle';
              e._evadePhaseT=rand(5,7);
              // Record reciprocal of torpedo approach — for counter-shot
              // (counter-shot already fired at detection time)
            }
          } else if(e._evadePhase==='knuckle'){
            // Hold heading, cut speed — create turbulent knuckle, drop CM here
            desiredHeading = curH; // don't turn — let knuckle form
            if(e._evadePhaseT<=0){
              e._evadePhase='sprint2';
              e._evadePhaseT=rand(12,20);
              // New heading: 90-150° offset from original away angle — confuse reacquire
              const sideFlip = Math.random()<0.5 ? 1 : -1;
              e._sprint2Heading = angleNorm(awayAng + sideFlip*(Math.PI*0.6+rand(0,Math.PI*0.3)));
            }
          } else { // sprint2
            desiredHeading = e._sprint2Heading ?? angleNorm(awayAng + Math.PI/2);
            if(e._evadePhaseT<=0){
              e._evadePhase=null; // evasion sequence complete
            }
          }
          e.navT=0.5;

        } else if(state==='engage' && e.contact){
          // ENGAGE + TMA BUILD: alternate sprint-cross-track to accumulate baseline
          // Phase: 'drift' = slow cross-track bearing observation
          //        'sprint' = fast run perpendicular to bearing to build baseline
          //        'close'  = sprint toward contact when solution is good
          if(!e.tmaPhase) e.tmaPhase='drift';

          const dx=AI.wrapDx(e.x,e.contact.x), dy=e.contact.y-e.y;
          const contactBrg=Math.atan2(dy,dx);
          const dist=Math.hypot(dx,dy);

          if(e.tmaPhase==='close' || (hasFix && dist<800)){
            // Close for the kill
            desiredHeading=contactBrg;
            e.tmaPhase='close';
            if(e.navT<=0) e.navT=5;
          } else if(e.tmaPhase==='sprint'){
            // Cross-track sprint — run perpendicular to bearing for 25-40s
            const perpA=contactBrg+Math.PI/2, perpB=contactBrg-Math.PI/2;
            const curH=e.heading||0;
            const sprintDir=e.tmaManeuverDir||1;
            desiredHeading=sprintDir>0?perpA:perpB;
            if(e.navT<=0){
              // Switch to drift phase — slow down and listen
              e.tmaPhase='drift';
              e.navT=rand(20,35);
            }
          } else {
            // Drift — slow and listen, build bearing observations
            desiredHeading=contactBrg; // creep toward contact
            if(e.navT<=0){
              // Switch to cross-track sprint
              e.tmaPhase='sprint';
              e.tmaManeuverDir=(Math.random()<0.5)?1:-1;
              e.navT=rand(25,40);
            }
          }

        } else if(state==='investigate' && e.contact){
          // INVESTIGATE: slow approach on bearing, start accumulating observations
          if(!e.tmaPhase) e.tmaPhase='drift';
          const dx=AI.wrapDx(e.x,e.contact.x), dy=e.contact.y-e.y;
          const contactBrg=Math.atan2(dy,dx);

          if(e.tmaPhase==='sprint'){
            const perpA=contactBrg+Math.PI/2, perpB=contactBrg-Math.PI/2;
            const sprintDir=e.tmaManeuverDir||1;
            desiredHeading=sprintDir>0?perpA:perpB;
            if(e.navT<=0){ e.tmaPhase='drift'; e.navT=rand(15,25); }
          } else {
            desiredHeading=contactBrg;
            if(e.navT<=0){
              // After first observation, start cross-track runs
              if((e.playerBearings||[]).length>=2){
                e.tmaPhase='sprint';
                e.tmaManeuverDir=(Math.random()<0.5)?1:-1;
                e.navT=rand(20,35);
              } else {
                e.navT=rand(10,18);
              }
            }
          }

        } else {
          // PATROL: long quiet legs
          e.tmaPhase='drift';
          if(e.navT<=0){
            e.navT=rand(C.enemy.subNavT[0], C.enemy.subNavT[1]);
            const maxPatrolTurn=Math.PI*0.33;
            // Hunters bias toward player — they're on a datum, not random-walking
            // Pingers maintain cross-track barrier pattern
            if(e.role==='pinger'){
              e.patrolHeading=angleNorm((e.patrolHeading??e.heading??0)+rand(-maxPatrolTurn,maxPatrolTurn));
            } else {
              // Compute direction toward player, bias new heading that way
              const tdx=AI.wrapDx(e.x,player.wx), tdy=player.wy-e.y;
              const towardPlayer=Math.atan2(tdy,tdx);
              const currentH=e.patrolHeading??e.heading??0;
              // Blend: 60% toward player, 40% random drift — stays roughly convergent
              const biased=angleNorm(towardPlayer+rand(-maxPatrolTurn,maxPatrolTurn));
              e.patrolHeading=biased;
            }
          }
          desiredHeading=e.patrolHeading??e.heading??0;
        }

        // ── Interceptor role — sprint ahead of projected player track then ambush ──
        if(e.role==='interceptor' && !e.evadeT){
          const prosecuting=game.groupState==='prosecuting';
          if(prosecuting){
            // Calculate or refresh intercept point
            const needsTarget=!e.interceptTargetX ||
              (e.interceptState==='sprinting' && e.interceptArrived);
            if(needsTarget && e.contact){
              // Project player position forward by leadTime seconds
              const leadT=C.enemy.interceptorLeadTime||90;
              const pVx=Math.cos(player.heading)*ktsToWU(player.speed);
              const pVy=Math.sin(player.heading)*ktsToWU(player.speed);
              const projX=(player.wx+pVx*leadT+world.w)%world.w;
              const projY=player.wy+pVy*leadT;
              // Offset perpendicular — sit off their projected track slightly
              const perpOff=(Math.random()<0.5?1:-1)*rand(300,600);
              const perpAng=player.heading+Math.PI/2;
              e.interceptTargetX=(projX+Math.cos(perpAng)*perpOff+world.w)%world.w;
              e.interceptTargetY=projY+Math.sin(perpAng)*perpOff;
              e.interceptState='sprinting';
              e.interceptArrived=false;
            }

            if(e.interceptState==='sprinting' && e.interceptTargetX!=null){
              const idx=AI.wrapDx(e.x,e.interceptTargetX);
              const idy=e.interceptTargetY-e.y;
              const idist=Math.hypot(idx,idy);
              if(idist<200){
                // Arrived — go quiet and wait
                e.interceptState='ambush';
                e.interceptArrived=true;
                addLog('SONAR',''); // silent — no log, enemy is quiet
              } else {
                desiredHeading=Math.atan2(idy,idx);
              }
            }
            // In ambush: override state machine speed below — near silent
          } else {
            // Group reverted to patrol — reset intercept
            e.interceptState='waiting';
            e.interceptTargetX=null; e.interceptTargetY=null;
          }
        }

        // ── Apply turn
        const maxTurnRate=0.45*dt;
        const headingErr=angleNorm(desiredHeading-(e.heading||0));
        e.heading=(e.heading||0)+clamp(headingErr,-maxTurnRate,maxTurnRate);

        // ── Speed — sprint-and-drift: fast in sprint phase, slow in drift
        const sprintPhase=(e.tmaPhase==='sprint');
        const isAmbushing=e.role==='interceptor'&&e.interceptState==='ambush';
        // Evade speed is phase-aware: sprint1/sprint2 at flank, knuckle at near-stop
        const evadeSpd = e._evadePhase==='knuckle' ? rand(1.5,3.0)
                       : e._evadePhase==='sprint2'  ? rand(16,20)
                       : 18; // sprint1 or no phase yet
        const targetSpd=e.evadeT>0?evadeSpd
          :isAmbushing?C.enemy.interceptorAmbushSpd||3   // ambush — near silent
          :e.role==='interceptor'&&e.interceptState==='sprinting'?rand(14,17) // sprint to position
          :state==='engage'&&sprintPhase?14
          :state==='engage'&&e.tmaPhase==='close'?12
          :state==='engage'?5          // drift: slow and quiet to listen
          :state==='investigate'&&sprintPhase?10
          :state==='investigate'?5
          :7;
        const curSpd=Math.hypot(e.vx,e.vy);
        const accel=curSpd<targetSpd?1.0:0.6;
        const newSpd=Math.abs(curSpd-targetSpd)<accel*dt
          ?targetSpd
          :curSpd+Math.sign(targetSpd-curSpd)*accel*dt;
        e.vx=Math.cos(e.heading)*newSpd;
        e.vy=Math.sin(e.heading)*newSpd;

        // ── Depth management
        if(!e.depthOrder) e.depthOrder=e.depth||300;
        if(!e.depthChangeT||e.depthChangeT<=0){
          if(e.evadeT>0){
            // Layer exploitation depth already set in phase init (_evadePhaseT block above).
            // If _evadePhase hasn't initialised yet (first frame gap), pick a safe deep dive.
            if(!e._evadePhase){
              e.depthChangeT=10;
              e.depthOrder=e.depth<300?rand(400,700):rand(60,160);
            } else {
              e.depthChangeT=999; // hold layer-exploit depth, set by phase init
            }
          } else if(state==='engage'){
            e.depthChangeT=rand(120,240);
            e.depthOrder=rand(100,500);
          } else {
            e.depthChangeT=rand(300,720);
            e.depthOrder=rand(150,600);
          }
        }
        e.depthChangeT-=dt;
        {
          const maxRate=(e.evadeT>0)?3.5:1.2;
          const depthErr=e.depthOrder-e.depth;
          const rate=Math.min(maxRate,Math.abs(depthErr)*0.06+0.1);
          e.depth=clamp(e.depth+Math.sign(depthErr)*rate*dt, 30, world.ground-80);
        }

        // ── Ping — only pingers ping; hunters are passive ────────────────────────
        e.pingCd-=dt;
        const isPinger=e.role==='pinger';
        const isHunter=e.role==='hunter'||e.role==='interceptor'||!e.role;
        // Hunters never ping — passive only. Pingers ping aggressively.
        const pingInterval=isPinger
          ?(state==='engage'?[5,9]:state==='investigate'?[8,14]:[12,20])
          :[9999,9999]; // hunters never ping
        if(e.pingCd<=0 && !game.over && isPinger){
          e.pingCd=rand(pingInterval[0],pingInterval[1]);
          const dxp=AI.wrapDx(player.wx,e.x);
          const dyp=player.wy-e.y;
          const dp=Math.hypot(dxp,dyp);
          if(dp<C.enemy.subPingRange){
            e.pingPulse=1.2;
            e.detectedT=Math.max(e.detectedT||0,C.detection.detectT);
            e.seen=Math.max(e.seen||0,C.detection.seenT*0.4);
            e.lastX=e.x; e.lastY=e.y; e.lastT=now();
            AI.enemyUpdateContactFromPing(e,player.wx,player.wy,dp);
            // Share datum immediately with the group — pinger's whole purpose
            if(AI.wolfpackShareDatum) AI.wolfpackShareDatum(e,player.wx,player.wy,0.45);
          }
        }

        // ── Fire — only when TMA solution is solid enough ─────────────────────
        if(!e.torpTubes) e.torpTubes=Array(C.enemy.subTubes).fill(0);
        e.torpTubes=e.torpTubes.map(t=>Math.max(0,t-dt));
        e.fireCd-=dt;
        if(e.fireCd<=0 && !game.over && (e.torpStock??1)>0){
          const t=(state==='engage')?C.enemy.subFireEngage:C.enemy.subFireOther;
          e.fireCd=rand(t[0],t[1]);
          const tubeIdx=e.torpTubes.findIndex(t=>t<=0);
          // Role-based fire quality — hunters are aggressive, pingers are more careful
          const roleFireQ = e.role==='hunter'?0.35
            : e.role==='interceptor'?0.30
            : e.role==='pinger'?0.50   // pingers fire only with a decent solution
            : 0.30;
          const hasRoleSolution = (e.tmaQuality||0) >= roleFireQ;
          if(tubeIdx>=0 && AI.enemyHasFireSolution(e) && hasRoleSolution){
            const tx=e.contact.x, ty=e.contact.y;
            const dx=AI.wrapDx(e.x,tx);
            const dy=ty-e.y;
            const d=Math.hypot(dx,dy);
            const layer=AI.layerPenalty(player.y,e.y);
            const maxD=(layer<1)?2200:2800;
            if(d<maxD){
              // Intercept bearing using TMA-estimated player velocity
              // Use true player pos blurred by TMA quality — not perfect aim
              const blur=clamp((1-tmaQ)*400, 0, 350);
              const ftx=player.wx+rand(-blur,blur);
              const fty=player.wy+rand(-blur,blur);
              const ftvx=Math.cos(player.heading)*ktsToWU(player.speed);
              const ftvy=Math.sin(player.heading)*ktsToWU(player.speed);
              const ftDepth=player.depth??200;
              const torpSpd=C.torpedo.speed;
              let intBearing=Math.atan2(dy,dx);
              const ftDist=Math.hypot(AI.wrapDx(e.x,ftx),fty-e.y);
              let tof=ftDist/torpSpd;
              for(let i=0;i<6;i++){
                const ex2=ftx+ftvx*tof, ey2=fty+ftvy*tof;
                tof=Math.hypot(AI.wrapDx(e.x,ex2),ey2-e.y)/torpSpd;
              }
              const predX=ftx+ftvx*tof, predY=fty+ftvy*tof;
              intBearing=Math.atan2(predY-e.y,AI.wrapDx(e.x,predX));
              const shot=clampConeDual(Math.cos(intBearing),Math.sin(intBearing),
                e.heading||Math.atan2(e.vy,e.vx),C.enemy.subTorpArcDeg);
              const off=e.r*1.25;
              const sx=e.x+(shot.isRear?-Math.cos(e.heading):Math.cos(e.heading))*off;
              const sy=e.y+(shot.isRear?-Math.sin(e.heading):Math.sin(e.heading))*off;
              W.fireTorpedo(sx,sy,shot.dx,shot.dy,false,260,false,0,e.depth||300,ftDepth,{
                speed:     C.enemy.subTorpSpeed??26,
                life:      C.enemy.subTorpLife??220,
                seekRange: C.enemy.subTorpSeekRange??400,
                reacquireChance: C.enemy.subTorpReacquire??0.010,
              });
              e.torpTubes[tubeIdx]=C.enemy.subReloadTime;
              if(e.torpStock!=null) e.torpStock--;
              // Launch transient — player may hear it if close enough
              if(typeof window._playerHearTransient==='function') window._playerHearTransient(e,e.x,e.y);
              // Wolfpack — share datum with nearby allies
              if(e.tmaX!=null && AI.wolfpackShareDatum) AI.wolfpackShareDatum(e,e.tmaX,e.tmaY,e.tmaQuality||0.5);
              const brgToEnemy=((Math.atan2(AI.wrapDx(player.wx,e.x),e.y-player.wy)*180/Math.PI)+360)%360;
              addLog('SONAR',`Conn, Sonar — torpedo in the water, bears ${Math.round(brgToEnemy).toString().padStart(3,'0')}°`);
            }
          }
        }

        // ── Incoming torpedo detection + evasion ─────────────────────────────────
        // Pass 1: scan all live friendly torpedoes in detection range.
        // _alertedEnemy is NOT used as a block here — we re-evaluate every frame
        // so the escape heading tracks the torpedo as it maneuvers.
        {
          let closestTorp=null, closestDd=Infinity;
          for(const b of bullets){
            if(b.kind!=="torpedo"||!b.friendly||b.life<=0) continue;
            const dx=AI.wrapDx(e.x,b.x);
            const dy=b.y-e.y;
            const dd=Math.hypot(dx,dy);
            if(dd>C.enemy.subTorpReactR) continue;

            // Detection probability — own noise masks hearing; layer degrades signal
            const layer=AI.layerPenalty(e.depth||200, b.depth??200);
            const signal=0.85*layer*(1-dd/C.enemy.subTorpReactR);
            const ownNoise=e.noise||0.15;
            const detect=signal-ownNoise*0.80;
            if(detect<=0) continue;

            // First detection: probabilistic
            if(!b._alertedEnemy){
              const pDetect=clamp(0.08+detect*0.60, 0, 0.85)*dt;
              if(Math.random()>pDetect) continue;
              b._alertedEnemy=e;
            }

            // Track closest detected torpedo — update escape heading every frame
            if(dd<closestDd){ closestDd=dd; closestTorp=b; }
          }

          if(closestTorp){
            const b=closestTorp;
            e.suspicion=Math.min(1,e.suspicion+0.30);

            // Extend evade timer: keep running while torpedo is still inside react range
            // Initial trigger: 25-35s. Each re-evaluation while still close: refresh to at least 8s.
            if(!e.evadeT || e.evadeT<=0){
              // First detection — immediate counter-shot spread, then evade
              e.evadeT=rand(25,35);
              addLog('SONAR', `Conn, Sonar — contact manoeuvring, high speed. Countermeasures in water`);

              // ── Immediate counter-shot spread ────────────────────────────────
              // Fire all ready tubes on reciprocal bearing before manoeuvring.
              // Bearing data is freshest here; delay after maneuvering is useless.
              // Fan: ±4° bearing spread, ±60m depth spread across weapons.
              if(!e._counterFired){
                e._counterFired = true;
                const dx=AI.wrapDx(e.x,b.x), dy=b.y-e.y;
                const recipBrg = Math.atan2(dy,dx); // toward torpedo origin = toward player
                const estPlayerDepth = player.depth + rand(-60,60);
                const torpStats = {
                  speed:     C.enemy.subTorpSpeed??26,
                  life:      C.enemy.subTorpLife??220,
                  seekRange: C.enemy.subTorpSeekRange??400,
                  reacquireChance: C.enemy.subTorpReacquire??0.010,
                };
                // Fire every ready tube — cap at 4 to avoid absurdity
                const tubes = e.torpTubes||[];
                let shotsFired = 0;
                const maxShots = Math.min(4, tubes.filter(t=>t<=0).length);
                for(let ti=0; ti<tubes.length && shotsFired<maxShots; ti++){
                  if(tubes[ti]>0) continue;
                  // Fan each shot: small bearing jitter, depth spread
                  const brgJitter = rand(-0.07, 0.07); // ±4°
                  const depthSpread = (shotsFired - (maxShots-1)/2) * 40; // spread ±80m
                  const shotBrg = recipBrg + brgJitter;
                  const sdx = Math.cos(shotBrg), sdy = Math.sin(shotBrg);
                  const off = (e.r||20)*1.25;
                  const sx = wrapX(e.x + sdx*off);
                  const sy = (e.y + sdy*off + world.h) % world.h;
                  const shotDepth = clamp(estPlayerDepth + depthSpread, 30, 700);
                  W.fireTorpedo(sx,sy,sdx,sdy,false,260,false,0,e.depth||300,shotDepth,torpStats);
                  tubes[ti] = C.enemy.subReloadTime;
                  if(e.torpStock!=null) e.torpStock--;
                  if(typeof window._playerHearTransient==='function') window._playerHearTransient(e,e.x,e.y);
                  shotsFired++;
                }
                if(shotsFired>0){
                  const cDeg = Math.round(((recipBrg*180/Math.PI)+360)%360);
                  addLog('SONAR',`Conn, Sonar — ${shotsFired} torpedo${shotsFired>1?'s':''} in the water, bears ${cDeg.toString().padStart(3,'0')}°, reciprocal`);
                  setMsg(`COUNTER-SHOT — ${shotsFired} WEAPONS INBOUND`, 2.5);
                }
              }
            } else {
              // Still being chased — keep timer alive
              e.evadeT=Math.max(e.evadeT, 8.0);
            }

            // Update evadeFrom to current torpedo position every frame — heading stays fresh
            e.evadeFrom={x:b.x, y:b.y};

            // Immediate CM drop on first alert, then again mid-evasion if still chased
            if(e.cmCd<=0){
              e.cmCd=rand(5.0,9.0);
              // Drop noisemaker behind current heading — between sub and torpedo
              const dropX=wrapX(e.x-Math.cos(e.heading)*35+rand(-20,20));
              const dropY=(e.y-Math.sin(e.heading)*35+rand(-20,20)+world.h)%world.h;
              const dec=W.deployDecoy(dropX,dropY,false,"noisemaker");
              if(dec) e.evadeDecoy={x:dec.x,y:dec.y};

              // Second CM burst: scattered further back
              if(Math.random()<0.55){
                const drop2X=wrapX(e.x-Math.cos(e.heading)*70+rand(-30,30));
                const drop2Y=(e.y-Math.sin(e.heading)*70+rand(-30,30)+world.h)%world.h;
                W.deployDecoy(drop2X,drop2Y,false,"noisemaker");
              }
            }

            // Reset counter-fire state when evasion ends (handled in evadeT decay above)
          }
        }

        e.cmCd=Math.max(0,e.cmCd-dt);
      }
    }

    for(let i=enemies.length-1;i>=0;i--) if(enemies[i].dead) enemies.splice(i,1);

    // ── Wave management ───────────────────────────────────────────────────────
    if(!game.over){
      // Wave management only applies in wave scenario
      if((game.scenario||'waves')==='waves'){
      // Group state: any enemy crossing susEngage flips to prosecuting
      const wasPatrol = game.groupState==='patrol';
      let anyEngaged = false;
      for(const e of enemies){
        if(!e.dead && e.suspicion >= C.enemy.susEngage){ anyEngaged=true; break; }
      }
      if(anyEngaged && wasPatrol){
        game.groupState='prosecuting';
        game.prosecutingT=0;
        addLog('SONAR','Conn, Sonar — contacts manoeuvring aggressively, classify prosecuting');
        queueLog('CONN','All stations, Conn — battle stations. Set condition one-ASW',1.5);
        queueLog('WEPS','Conn, Weps — tubes one and two ready, flooding down on your order',3.0);
      }
      if(game.groupState==='prosecuting'){
        game.prosecutingT+=dt;
        // Decay back to patrol if no enemy has suspicion above investigate for 90s
        let stillAware=false;
        for(const e of enemies){
          if(!e.dead && e.suspicion>=C.enemy.susInvestigate){ stillAware=true; break; }
        }
        if(!stillAware && game.prosecutingT>90){
          game.groupState='patrol';
          game.prosecutingT=0;
          addLog('SONAR','Conn, Sonar — group has lost contact. Reverting to patrol');
        }
      }

      // Wave clear — all enemies dead
      if(enemies.length===0){
        if(game.waveDelay<=0 && game.wave>0){
          game.waveDelay=C.enemy.waveDelay;
          addLog('SONAR',`Conn, Sonar — no further contacts. Area appears clear`);
          queueLog('CONN',`Sonar, Conn — aye. All stations, stand easy`,2.0);
          queueLog('CONN',`Wave ${game.wave} neutralised. Maintain watch`,4.0);
        }
        if(game.waveDelay>0){
          game.waveDelay-=dt;
          if(game.waveDelay<=0){
            spawnWave(game.wave+1);
          }
        }
      }
      } // end waves-only
    }

    // decoys
    for(const d of decoys){
      d.life -= dt;
      d.x = wrapX(d.x + d.vx*dt);
      d.y = d.y + d.vy*dt;
      d.vx *= Math.pow(0.94,dt*60);
      d.vy *= Math.pow(0.94,dt*60);
      if(d.kind==="flare"){
        d.vy += (d.g||C.ship.flareGravity)*dt;
        if(d.y>world.seaLevel-6 && d.vy>0){ W.splash(d.x,world.seaLevel,0.5); d.life=Math.min(d.life,0.30); }
      } else {
        if(d.mode==="sink") d.vy += C.ship.sinkExtraG*dt;
        else d.vy += 22*dt;
      }
      d.y = clamp(d.y,world.seaLevel-80,world.ground-40);
    }
    for(let i=decoys.length-1;i>=0;i--) if(decoys[i].life<=0) decoys.splice(i,1);

    // contacts
    for(const c of contacts) c.life -= dt;
    for(let i=contacts.length-1;i>=0;i--) if(contacts[i].life<=0) contacts.splice(i,1);

    // bullets
    for(const b of bullets){
      b.life -= dt;

      if(b.kind==="depthCharge"){
        b.vy = lerp(b.vy,b.sink,0.08);
        b.x = wrapX(b.x + b.vx*dt);
        b.y += b.vy*dt;
        if(b.y>=b.targetY || b.y>=world.ground-12){
          W.makeExplosion(b.x,b.y,1.15,true);
          const dxp=AI.wrapDx(b.x,player.x);
          const dyp=player.y-b.y;
          const dp=Math.hypot(dxp,dyp);
          if(dp<b.blastR) damagePlayer(b.dmg*(1-dp/b.blastR));
          b.life=0;
        }
        continue;
      }

      if(b.kind==="torpedo"){
        TORP.update(b, dt);
        continue;
      }

      // CWIS intercept — surface ships shoot down incoming missiles only.
      if(b.kind==="missile" && b.life>0 && b.friendly){
          for(const e of enemies){
            if(e.type!=="boat" || !e.cwis) continue;
            const dx=AI.wrapDx(b.x,e.x);
            const dy=b.y-e.hitY;
            const dist=Math.hypot(dx,dy);
            if(dist>e.cwis.range) continue;
            const closing=(dx*b.vx+dy*b.vy)<0;
            if(!closing) continue;
            const pKill=e.cwis.pKillPerSec*dt;
            e.cwis.tracerCd=(e.cwis.tracerCd||0)-dt;
            if(e.cwis.tracerCd<=0){
              e.cwis.tracerCd=rand(0.06,0.12);
              const bursts=Math.floor(rand(C.ship.tracerBursts[0],C.ship.tracerBursts[1]));
              for(let k=0;k<bursts;k++){
                const spread=(Math.random()-0.5)*C.ship.tracerSpread;
                const ang=Math.atan2(dy,dx)+spread;
                const spd=rand(900,1200);
                cwisTracers.push({
                  x:e.x, y:e.hitY-8,
                  vx:Math.cos(ang)*spd,
                  vy:Math.sin(ang)*spd,
                  life:rand(C.ship.tracerLife[0],C.ship.tracerLife[1]),
                  maxLife:rand(C.ship.tracerLife[0],C.ship.tracerLife[1])
                });
              }
            }
            if(Math.random()<pKill){
              W.makeExplosion(b.x,b.y,0.7,false);
              setMsg("CWIS INTERCEPT!",1.0);
              b.life=0;
              break;
            }
          }
        }

      // missiles not implemented in this minimal build (kept in config); safe to leave bullets list without them
      // If you want missiles now, we can port them from v4 with the new movement model.
    }
    for(let i=bullets.length-1;i>=0;i--){
      const _b=bullets[i];
      if(_b.life<=0){
        // If a wired torpedo is expiring, free the tube first
        if(_b.kind==='torpedo' && _b.wire?.live){
          _b.wire.live=false;
          window.G._onWireCut?.(_b);
        }
        bullets.splice(i,1);
      }
    }

    // Wire guidance update — runs on live wired torpedoes
    for(const b of bullets){
      if(b.kind==="torpedo"&&b.wire&&b.wire.live) W.wireUpdate(b,dt);
    }

    // Wire contacts age out
    for(const wc of wireContacts) wc.life-=dt;
    for(let i=wireContacts.length-1;i>=0;i--) if(wireContacts[i].life<=0) wireContacts.splice(i,1);

    // CWIS tracers — short-lived fast projectiles, purely visual + positional
    for(const t of cwisTracers){
      t.life -= dt;
      t.x = wrapX(t.x + t.vx*dt);
      t.y += t.vy*dt;
    }
    for(let i=cwisTracers.length-1;i>=0;i--) if(cwisTracers[i].life<=0) cwisTracers.splice(i,1);

    // particles — top-down, just drift and fade
    for(const p of particles){
      p.life -= dt;
      p.x = (p.x + p.vx*dt + world.w)%world.w;
      p.y = (p.y + p.vy*dt + world.h)%world.h;
      p.vx *= Math.pow(0.88,dt*60);
      p.vy *= Math.pow(0.88,dt*60);
    }
    for(let i=particles.length-1;i>=0;i--) if(particles[i].life<=0) particles.splice(i,1);

    // Camera — follow player unless free-cam mode is active (Ctrl+RMB drag)
    if(!cam.free){
      cam.x = player.wx;
      cam.y = player.wy;
    }
    cam.zoom = C.camera.zoom;
  }

  function resetScenario(scenario){
    game.scenario=scenario;
    reset();
  }
  window.SIM={update,reset,resetScenario};
  window.G.damageEnemy=damageEnemy;
  window.G.damagePlayer=damagePlayer;
})()