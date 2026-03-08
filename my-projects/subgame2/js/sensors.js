(() => {
  'use strict';
  const C=window.CONFIG; const {rand,clamp}=window.M;
  const {world,player,enemies,contacts,sonarContacts,game,addLog}=window.G;
  const AI=window.AI;

  let _nextId=1;
  function assignId(){ return 'S'+(_nextId++); }

  // ── TMA solver ─────────────────────────────────────────────────────────────────
  function solveTMA(c){
    const TMA=C.tma;
    const T=game.missionT||0;
    // Active ping or proximity fix takes precedence — don't overwrite with weaker bearing-line solution
    if(c.fixLockedUntil && T < c.fixLockedUntil) return;
    const obs=c.bearings;
    if(obs.length < TMA.minObs){ c.tmaQuality=0; c.tmaX=null; c.tmaY=null; return; }
    let M11=0, M12=0, M22=0, b1=0, b2=0;
    for(const o of obs){
      const s=Math.sin(o.bearing), cs=Math.cos(o.bearing);
      M11+=s*s; M12+=-s*cs; M22+=cs*cs;
      const d=-s*o.fromX+cs*o.fromY;
      b1+=d*(-s); b2+=d*cs;
    }
    const det=M11*M22-M12*M12;
    if(Math.abs(det)<1e-8){ c.tmaQuality=0; return; }
    const px=(M22*b1-M12*b2)/det;
    const py=(M11*b2-M12*b1)/det;
    const last=obs[obs.length-1];
    // Reject if solution is behind ANY observation — consistent intersection must be
    // in front of every bearing ray, not just the last one
    for(const o of obs){
      const dot=(px-o.fromX)*Math.cos(o.bearing)+(py-o.fromY)*Math.sin(o.bearing);
      if(dot<-100){ c.tmaQuality=0; return; }
    }
    let maxBase=0;
    for(let i=0;i<obs.length;i++)
      for(let j=i+1;j<obs.length;j++){
        const bd=Math.hypot(obs[i].fromX-obs[j].fromX,obs[i].fromY-obs[j].fromY);
        if(bd>maxBase) maxBase=bd;
      }
    if(maxBase<TMA.minBaseline){ c.tmaQuality=0; return; }
    const qBase=clamp(maxBase/TMA.goodBaseline,0,1);
    const qObs=clamp(obs.length/TMA.goodObs,0,1);
    // Bearing-spread quality: parallel motion (bearing barely changes) gives bad geometry
    // even with large baseline. Need ≥8° of bearing spread for full credit.
    let maxBrgSpread=0;
    for(let i=0;i<obs.length;i++)
      for(let j=i+1;j<obs.length;j++){
        const d=Math.abs(((obs[i].bearing-obs[j].bearing+3*Math.PI)%(Math.PI*2))-Math.PI);
        if(d>maxBrgSpread) maxBrgSpread=d;
      }
    const qSpread=clamp(maxBrgSpread/(8*Math.PI/180),0,1);
    c.tmaX=px; c.tmaY=py; c.tmaBaseline=maxBase;
    c.tmaQuality=qBase*qObs*qSpread;
  }

  function updateLastPos(c){
    const TMA=C.tma;
    if(c.tmaQuality>=TMA.qualityThresholdBlob && c.tmaX!=null){
      c.lastX=c.tmaX; c.lastY=c.tmaY;
    } else if(c.bearings.length>0){
      const last=c.bearings[c.bearings.length-1];
      c.lastX=(last.fromX+Math.cos(last.bearing)*TMA.defaultRange+world.w)%world.w;
      c.lastY=last.fromY+Math.sin(last.bearing)*TMA.defaultRange;
    }
  }

  function registerBearing(e, bearing, u_brg){
    const T=game.missionT||0;
    const TMA=C.tma;
    if(sonarContacts.has(e)){
      const c=sonarContacts.get(e);
      c.bearings=c.bearings.filter(b=>T-b.t<TMA.maxBearingAge);
      // Hull array bearing is unambiguous — use it to resolve towed array ambiguity
      if(c.towedCandA && c.towedResolved===null){
        // Pick whichever candidate (trueBrg=A or mirrorBrg=B) is closest to this hull bearing
        const lastA=c.towedCandA[c.towedCandA.length-1];
        const lastB=c.towedCandB?.[c.towedCandB.length-1];
        if(lastA && lastB){
          const dA=Math.abs(((lastA.bearing-bearing+3*Math.PI)%(Math.PI*2))-Math.PI);
          const dB=Math.abs(((lastB.bearing-bearing+3*Math.PI)%(Math.PI*2))-Math.PI);
          if(Math.min(dA,dB)<40*Math.PI/180){
            c.towedResolved=dA<=dB?'A':'B';
            addLog('SONAR',`${c.id} ambiguity resolved by hull array`);
          }
        }
      }
      // If new bearing has shifted >50° from current TMA direction, old bearings
      // describe a different geometry — flush them so the solver starts fresh.
      // (50° not 35° — fast close contacts have noisy bearing updates)
      if(c.tmaX!=null && c.tmaQuality>0.15){
        const tmaDx=c.tmaX-player.wx, tmaDy=c.tmaY-player.wy;
        const tmaAng=Math.atan2(tmaDy,tmaDx);
        const angDiff=Math.abs(((bearing-tmaAng+3*Math.PI)%(Math.PI*2))-Math.PI);
        if(angDiff > 50*Math.PI/180){
          c.bearings=[];
          c.tmaX=null; c.tmaY=null; c.tmaQuality=0;
          c.fixLockedUntil=0; // clear any fix lock so solver can restart
          // Flush towed candidates too — they were built on the old (wrong) geometry
          if(c.towedResolved){ c.towedResolved=null; }
          if(c.towedCandA){ c.towedCandA=[]; c.towedCandB=[]; }
          addLog('SONAR',`${c.id} — geometry reset (bearing shift ${Math.round(angDiff*180/Math.PI)}°)`);
        }
      }
      if(c.bearings.length>=TMA.maxBearings) c.bearings.shift();
      c.bearings.push({fromX:player.wx,fromY:player.wy,bearing,u_brg,t:T});
      c.lastObsT=T; c.activeT=3.0;
      c.latestBrg=bearing; c.latestHullBrg=bearing; c.lastHullBrgT=T; // hull bearing stored separately — no ambiguity
      c.latestFromX=player.wx; c.latestFromY=player.wy;
      const prevQ=c.tmaQuality??0;
      const prevTier=prevQ<0.20?0:prevQ<0.60?1:2;
      solveTMA(c);
      const newTier=c.tmaQuality<0.20?0:c.tmaQuality<0.60?1:2;
      if(newTier>prevTier){
        if(newTier===1) addLog('SONAR',`${c.id} — range solution building`);
        if(newTier===2) addLog('SONAR',`${c.id} — solid TMA solution`);
      }
      updateLastPos(c);
    } else {
      const id=assignId();
      const newC={
        id, kind:e.type,
        bearings:[{fromX:player.wx,fromY:player.wy,bearing,u_brg,t:T}],
        latestBrg:bearing, latestFromX:player.wx, latestFromY:player.wy,
        tmaX:null, tmaY:null, tmaQuality:0, tmaBaseline:0,
        lastX:0, lastY:0, lastObsT:T, activeT:3.0,
      };
      newC.lastX=(player.wx+Math.cos(bearing)*TMA.defaultRange+world.w)%world.w;
      newC.lastY=player.wy+Math.sin(bearing)*TMA.defaultRange;
      sonarContacts.set(e,newC);
      const typeLabel=e.type==='boat'?'surface contact':'subsurface contact';
      const brgDeg=(((Math.atan2(Math.cos(bearing),-Math.sin(bearing))*180/Math.PI)+360)%360);
      addLog('SONAR',`New ${typeLabel} ${id} — brg ${Math.round(brgDeg).toString().padStart(3,'0')}° passive`);
    }
  }

  function registerFix(e, fx, fy, u, source){
    const TMA=C.tma; const T=game.missionT||0;
    const brg=Math.atan2(fy-player.wy,AI.wrapDx(player.wx,fx));
    const dist=Math.hypot(AI.wrapDx(player.wx,fx),fy-player.wy);
    const u_brg=clamp(u/Math.max(dist,50),0.02,0.15);
    if(sonarContacts.has(e)){
      const c=sonarContacts.get(e);
      // If the fix is far from the old TMA position, flush stale bearings
      if(c.tmaX!=null){
        const shift=Math.hypot(fx-c.tmaX, fy-c.tmaY);
        if(shift > 400) c.bearings=[];
      }
      c.tmaX=fx; c.tmaY=fy;
      c.tmaQuality=Math.max(c.tmaQuality,0.95);
      c.tmaBaseline=Math.max(c.tmaBaseline||0,9999);
      c.fixLockedUntil=(T+8); // solveTMA cannot overwrite for 8s after a fix
      c.lastX=fx; c.lastY=fy; c.lastObsT=T;
      c.activeT=source==='active'?5.0:3.0;
      c.latestBrg=brg; c.latestHullBrg=brg; c.lastHullBrgT=T;
      c.latestFromX=player.wx; c.latestFromY=player.wy;
      c.bearings=c.bearings||[];
      c.bearings.push({fromX:player.wx,fromY:player.wy,bearing:brg,u_brg,t:T});
      if(c.bearings.length>TMA.maxBearings) c.bearings.shift();
    } else {
      const id=assignId();
      const newC={
        id, kind:e.type,
        bearings:[{fromX:player.wx,fromY:player.wy,bearing:brg,u_brg,t:T}],
        latestBrg:brg, latestHullBrg:brg, lastHullBrgT:T,
        latestFromX:player.wx, latestFromY:player.wy,
        tmaX:fx, tmaY:fy, tmaQuality:0.95, tmaBaseline:9999,
        fixLockedUntil:(T+8),
        lastX:fx, lastY:fy, lastObsT:T,
        activeT:source==='active'?5.0:3.0,
      };
      sonarContacts.set(e,newC);
      const typeLabel=e.type==='boat'?'surface contact':'subsurface contact';
      // Use compass bearing conversion (consistent with registerBearing log)
      const brgDeg=(((Math.atan2(Math.cos(brg),-Math.sin(brg))*180/Math.PI)+360)%360);
      const srcLabel=source==='active'?'active sonar':'close aboard';
      addLog('SONAR',`New ${typeLabel} ${id} — brg ${Math.round(brgDeg).toString().padStart(3,'0')}° ${srcLabel} (fix)`);
    }
  }

  function clearContact(e){ sonarContacts.delete(e); }

  // Contacts persist for living enemies — never deleted, quality decays when stale
  function tickContacts(dt){
    const T=game.missionT||0;
    const STALE_GRACE=12;   // seconds of no obs before decay starts
    const DECAY_RATE=0.018; // quality/second — stale fix decays to zero in ~55s
    for(const [e,c] of sonarContacts){
      c.activeT=Math.max(0,(c.activeT||0)-dt);
      if(e.dead) continue; // dead contacts kept as-is until reset
      const timeSinceObs=T-(c.lastObsT||0);
      if(timeSinceObs>STALE_GRACE && c.tmaQuality>0){
        c.tmaQuality=Math.max(0,c.tmaQuality-DECAY_RATE*dt);
        if(c.tmaQuality<=0){ c.tmaX=null; c.tmaY=null; c.tmaBaseline=0; }
      }
    }
  }

  function setDetected(e,tDetect,tSeen=0){
    e.detectedT=Math.max(e.detectedT||0,tDetect);
    if(tSeen>0) e.seen=Math.max(e.seen||0,tSeen);
    e.lastX=e.x; e.lastY=e.y; e.lastT=window.M.now();
  }

  // ── Towed array helpers ───────────────────────────────────────────────────────
  // Mirror bearing: reflect θ about the sub's heading axis
  // A contact at bearing θ is indistinguishable from one at (2*heading - θ)
  function mirrorBearing(brg, heading){
    return (2*heading - brg + 3*Math.PI) % (Math.PI*2) - Math.PI;
  }

  // Is bearing inside the cone of silence? (±28° off stern axis)
  function inDeadCone(brg, heading){
    const stern = heading + Math.PI;
    const diff = Math.abs(((brg - stern + 3*Math.PI) % (Math.PI*2)) - Math.PI);
    return diff < 0.49; // ~28°
  }

  // Run TMA solver on a candidate bearing set (same math as solveTMA but standalone)
  function solveCandidateTMA(obs){
    if(obs.length<2) return 0;
    let M11=0,M12=0,M22=0,b1=0,b2=0;
    for(const o of obs){
      const s=Math.sin(o.bearing), cs=Math.cos(o.bearing);
      M11+=s*s; M12+=-s*cs; M22+=cs*cs;
      const d=-s*o.fromX+cs*o.fromY;
      b1+=d*(-s); b2+=d*cs;
    }
    const det=M11*M22-M12*M12;
    if(Math.abs(det)<1e-8) return 0;
    const px=(M22*b1-M12*b2)/det;
    const py=(M11*b2-M12*b1)/det;
    const last=obs[obs.length-1];
    const fwdDot=(px-last.fromX)*Math.cos(last.bearing)+(py-last.fromY)*Math.sin(last.bearing);
    if(fwdDot<0) return 0;  // behind observer = wrong side
    let maxBase=0;
    for(let i=0;i<obs.length;i++)
      for(let j=i+1;j<obs.length;j++){
        const bd=Math.hypot(obs[i].fromX-obs[j].fromX, obs[i].fromY-obs[j].fromY);
        if(bd>maxBase) maxBase=bd;
      }
    if(maxBase<80) return 0;
    return clamp(maxBase/400,0,1)*clamp(obs.length/8,0,1);
  }

  // Register a towed array bearing — maintains two candidate sets and auto-resolves
  function registerTowedBearing(e, trueBrg, mirrorBrg, u_brg){
    const T = game.missionT||0;
    const TMA = C.tma;

    let c = sonarContacts.get(e);
    if(!c){
      // Create contact if not already tracked by hull array
      const id = assignId();
      c = {
        id, kind:e.type,
        bearings:[], latestBrg:null, latestFromX:player.wx, latestFromY:player.wy,
        tmaX:null, tmaY:null, tmaQuality:0, tmaBaseline:0,
        lastX:0, lastY:0, lastObsT:T, activeT:0,
        // Towed array specific
        towedCandA:[], towedCandB:[],
        towedResolved:null,  // null | 'A' | 'B'
        towedQA:0, towedQB:0,
      };
      c.lastX = (player.wx+Math.cos(trueBrg)*TMA.defaultRange+world.w)%world.w;
      c.lastY = player.wy+Math.sin(trueBrg)*TMA.defaultRange;
      sonarContacts.set(e, c);
      const typeLabel = e.type==='boat'?'surface contact':'subsurface contact';
      const brgDeg = (((Math.atan2(Math.cos(trueBrg),-Math.sin(trueBrg))*180/Math.PI)+360)%360);
      addLog('SONAR', `Towed array: new ${typeLabel} ${c.id} — brg ${Math.round(brgDeg).toString().padStart(3,'0')}° (ambiguous)`);
      addLog('SONAR', `${c.id}: turn 10-20° to identify port or starboard`);
    } else {
      // Init towed fields if this contact was previously hull-array only
      if(!c.towedCandA){ c.towedCandA=[]; c.towedCandB=[]; c.towedResolved=null; c.towedQA=0; c.towedQB=0; }
    }

    c.lastObsT = T;
    c.activeT = Math.max(c.activeT||0, 2.5);
    c.latestFromX = player.wx; c.latestFromY = player.wy;

    // If hull array already has a solid fix — resolve immediately
    if(c.tmaQuality >= 0.15 && c.tmaX != null){
      // Determine which candidate is closer to our known position
      const dxA = Math.cos(trueBrg), dyA = Math.sin(trueBrg);
      const dxB = Math.cos(mirrorBrg), dyB = Math.sin(mirrorBrg);
      const dotA = dxA*(c.tmaX-player.wx) + dyA*(c.tmaY-player.wy);
      const dotB = dxB*(c.tmaX-player.wx) + dyB*(c.tmaY-player.wy);
      c.towedResolved = dotA >= dotB ? 'A' : 'B';
    }

    // Add to candidate sets
    const obsA = {fromX:player.wx, fromY:player.wy, bearing:trueBrg, u_brg, t:T};
    const obsB = {fromX:player.wx, fromY:player.wy, bearing:mirrorBrg, u_brg, t:T};

    // Cull old obs
    c.towedCandA = c.towedCandA.filter(o=>T-o.t<120);
    c.towedCandB = c.towedCandB.filter(o=>T-o.t<120);
    if(c.towedCandA.length>=16) c.towedCandA.shift();
    if(c.towedCandB.length>=16) c.towedCandB.shift();

    if(c.towedResolved === 'A'){
      c.towedCandA.push(obsA);
      // Feed resolved observations into main TMA
      registerBearing(e, trueBrg, u_brg);
      c.latestBrg = trueBrg;
    } else if(c.towedResolved === 'B'){
      c.towedCandB.push(obsB);
      registerBearing(e, mirrorBrg, u_brg);
      c.latestBrg = mirrorBrg;
    } else {
      // Unresolved — maintain both candidates
      c.towedCandA.push(obsA);
      c.towedCandB.push(obsB);

      // Auto-resolve: run TMA on each candidate, pick the better one
      // Need baseline — only attempt if player has moved
      if(c.towedCandA.length >= 3){
        c.towedQA = solveCandidateTMA(c.towedCandA);
        c.towedQB = solveCandidateTMA(c.towedCandB);
        const gap = Math.abs(c.towedQA - c.towedQB);
        const winner = c.towedQA > c.towedQB ? 'A' : 'B';
        // Resolve when one candidate is clearly better than the other
        if(gap > 0.32 && Math.max(c.towedQA, c.towedQB) > 0.18){
          c.towedResolved = winner;
          const resolvedBrg = winner==='A' ? trueBrg : mirrorBrg;
          const side = resolvedBrg > 0 ? 'starboard' : 'port'; // rough
          // More accurate: which side of heading is it?
          const relBrg = ((resolvedBrg - player.heading + 3*Math.PI) % (Math.PI*2)) - Math.PI;
          const sideStr = relBrg >= 0 ? 'starboard' : 'port';
          addLog('SONAR', `${c.id} ambiguity resolved — contact is ${sideStr}`);
        }
      }
      // Update latest bearing to show the unresolved state.
      // Only overwrite if hull array hasn't given us a fresh bearing recently.
      const hullAge=T-(c.lastHullBrgT||0);
      if(hullAge > 5.0){
        c.latestBrg = trueBrg;
      }
      c.latestBrgMirror = mirrorBrg;
    }
    updateLastPos(c);
  }

  // ── Towed array passive update ──────────────────────────────────────────────
  function towedArrayUpdate(dt){
    const ta = player.towedArray;
    if(!ta) return;

    // Tick deployment
    const DEPLOY_TIME = 30, RETRACT_TIME = 20;
    if(ta.state === 'deploying'){
      ta.progress = clamp(ta.progress + dt/DEPLOY_TIME, 0, 1);
      if(ta.progress >= 1){
        ta.state = 'operational';
        ta.progress = 1;
        addLog('SONAR', 'Towed array fully deployed — long-range passive listening active');
        addLog('SONAR', 'Bearing ambiguity shown as two lines — turn to resolve');
      }
      return; // don't sense while deploying
    }
    if(ta.state === 'retracting'){
      ta.progress = clamp(ta.progress - dt/RETRACT_TIME, 0, 1);
      if(ta.progress <= 0){
        ta.state = 'stowed';
        ta.progress = 0;
        addLog('ENG', 'Towed array retracted');
      }
      return;
    }
    if(ta.state !== 'operational' && ta.state !== 'damaged') return;

    // Damage check — overspeed
    const MAX_SPD = 18, INSTANT_KILL_SPD = 22;
    if(player.speed >= INSTANT_KILL_SPD){
      const prev = ta.state;
      ta.state = prev==='operational' ? 'damaged' : 'destroyed';
      ta.overspeedT = 0;
      addLog('ENG', ta.state==='destroyed'
        ? 'Array lost — cable parted at high speed [DESTROYED]'
        : 'Array damaged — overspeed [DEGRADED]');
    } else if(player.speed >= MAX_SPD){
      ta.overspeedT = (ta.overspeedT||0) + dt;
      if(ta.overspeedT > 5){
        ta.overspeedT = 0;
        const prev = ta.state;
        ta.state = prev==='operational' ? 'damaged' : 'destroyed';
        addLog('ENG', ta.state==='destroyed'
          ? 'Array lost — sustained overspeed [DESTROYED]'
          : 'Array damaged — sustained overspeed [DEGRADED]');
      }
    } else {
      ta.overspeedT = Math.max(0, (ta.overspeedT||0) - dt);
    }
    if(ta.state === 'destroyed') return;

    // Towed array characteristics
    const operational = ta.state === 'operational';
    const baseRange   = operational ? 4500 : 3000;
    const selfMaskMul = operational ? 0.20 : 0.40;
    const noiseUMul   = operational ? 0.7  : 1.4;
    const tickRate    = operational ? [0.8,1.4] : [1.2,2.0];

    player.towedTick = (player.towedTick||0) - dt;
    if(player.towedTick > 0) return;
    player.towedTick = rand(tickRate[0], tickRate[1]);

    const heading = player.heading || 0;

    for(const e of enemies){
      if(e.dead) continue;
      const dx = AI.wrapDx(player.wx, e.x);
      const dy = e.y - player.wy;
      const d  = Math.hypot(dx, dy);
      if(d > baseRange) continue;

      const trueBrg = Math.atan2(dy, dx);

      // Cone of silence — no returns within ±28° of stern
      if(inDeadCone(trueBrg, heading)) continue;

      const layer  = AI.layerPenalty(player.depth, e.depth||0);
      let signal   = e.noise * layer * (1 - d/baseRange);
      if(e.type==='boat') signal *= 1.25;
      const selfMask = player.noise * selfMaskMul;
      const detect = signal - selfMask;
      if(detect <= 0) continue;

      const p = clamp(0.06 + detect*0.60 + (e.type==='boat'?0.12:0.06), 0, 0.80);
      if(Math.random() < p){
        const layerMult = (layer<1) ? 1.4 : 1.0;
        const baseU = (60 + d*0.08) * noiseUMul;
        const noiseU = baseU * layerMult * (1 + player.noise*0.4);
        const u_brg = clamp(noiseU/Math.max(d,100), 0.01, 0.18);
        const noisyBrg = trueBrg + rand(-1,1)*u_brg;
        const mirrorBrg = mirrorBearing(noisyBrg, heading);

        // Ephemeral flash — teal colour tag for towed array
        contacts.push({fromX:player.wx, fromY:player.wy, bearing:noisyBrg, u_brg, life:2.5, kind:e.type, source:'towed'});

        registerTowedBearing(e, noisyBrg, mirrorBrg, u_brg);
        SENSE.setDetected(e, C.detection.detectT, 0);
      }
    }
  }

  // Speed deafness — own flow noise masks passive sonar above ~4kt
  function speedDeafnessFactor(){
    const sd=C.player.speedDeafness||{startKts:4,fullDeafKts:10};
    const kts=player.speed;
    return 1.0 - clamp((kts-sd.startKts)/(sd.fullDeafKts-sd.startKts), 0, 0.90);
  }

  // Broadcast a transient noise event — alerts nearby enemies with bearing + suspicion
  // Called by: active ping, torpedo launch, explosion
  function broadcastTransient(srcX, srcY, range, susGain, label){
    const T=game.missionT||0;
    for(const e of enemies){
      if(e.dead) continue;
      const dx=AI.wrapDx(e.x,srcX), dy=srcY-e.y;  // FROM enemy TO source (correct direction)
      const d=Math.hypot(dx,dy);
      if(d>range) continue;
      const sig=clamp(1-d/range, 0.15, 1.0);
      e.suspicion=Math.min(1, e.suspicion + susGain*sig);
      // Give enemy a bearing + rough position toward source
      const brg=Math.atan2(dy,dx)+rand(-1,1)*0.08;
      if(!e.playerBearings) e.playerBearings=[];
      e.playerBearings=e.playerBearings.filter(b=>T-b.t<120);
      if(e.playerBearings.length>=16) e.playerBearings.shift();
      e.playerBearings.push({fromX:e.x,fromY:e.y,brg,t:T});
      // Good fix for active ping — estimated position
      const estDist=d*(0.85+rand(-1,1)*0.20);
      e.contact={
        x:(srcX+world.w)%world.w, y:srcY,
        u:clamp(d*0.10+80,60,400), t:performance.now()/1000,
        strength:clamp(sig*0.85,0.3,0.9)
      };
    }
    if(label) addLog('SONAR', label);
  }
  // Expose for weapons.js and sim.js
  window._broadcastTransient=broadcastTransient;

  // Player hears an enemy launch transient
  function playerHearTransient(e, srcX, srcY){
    const dx=AI.wrapDx(player.wx, srcX), dy=srcY-player.wy;
    const d=Math.hypot(dx,dy);
    const range=C.enemy.fireTransientRange||1800;
    if(d>range) return;
    const brg=Math.atan2(dy,dx);
    const brgDeg=(((Math.atan2(Math.cos(brg),-Math.sin(brg))*180/Math.PI)+360)%360);
    contacts.push({fromX:player.wx,fromY:player.wy,bearing:brg,u_brg:0.05,life:3.5,kind:'sub'});
    // Register bearing strongly for TMA
    const sc=window.G.sonarContacts.get(e);
    if(sc){
      registerBearing(e,brg,0.05);
      sc.activeT=Math.max(sc.activeT||0, 4.0);
      sc.lastObsT=game.missionT||0;
    }
    addLog('SONAR',`Launch transient — brg ${Math.round(brgDeg).toString().padStart(3,'0')}°`);
  }
  window._playerHearTransient=playerHearTransient;

  function passiveUpdate(dt){
    tickContacts(dt);
    player.passiveTick=(player.passiveTick||0)-dt;
    if(player.passiveTick>0) return;

    // Tick interval increases with speed — harder to listen while moving fast
    const deafness=speedDeafnessFactor();
    const quietBonus=1.4-player.noise*1.0;
    player.passiveTick=rand(0.7,1.3)/(Math.max(0.20,quietBonus)*Math.max(0.15,deafness));

    for(const e of enemies){
      if(e.dead) continue;
      const dx=AI.wrapDx(player.wx,e.x);
      const dy=AI.wrapDy(player.wy,e.y);
      const d=Math.hypot(dx,dy);
      const dmgFx=window.DMG?.getEffects()||{};
      const baseRange=2800*(dmgFx.sonarRangeMult??1.0);
      if(baseRange<=0||d>baseRange) continue;
      const layer=AI.layerPenalty(player.depth,e.depth||0);
      let signal=e.noise*layer*(1-d/Math.max(baseRange,1));
      if(e.type==='boat') signal*=1.25;
      const selfMask=player.noise*0.55;
      const detect=(signal-selfMask)*deafness;
      if(detect<=0) continue;
      const p=clamp(0.05+detect*0.55+(e.type==='boat'?0.10:0.05), 0, 0.75);
      if(Math.random()<p){
        const trueBearing=Math.atan2(dy,dx);
        const layerMult=(layer<1)?1.50:1.0;
        const baseU=80+d*0.10;
        const noiseU=baseU*layerMult*(dmgFx.bearingNoiseMult??1.0)*(1+player.noise*0.8)*(1+(1-deafness)*0.6);
        const u_brg=clamp(noiseU/Math.max(d,100),0.02,0.30);
        const noisyBearing=trueBearing+rand(-1,1)*u_brg;
        contacts.push({fromX:player.wx,fromY:player.wy,bearing:noisyBearing,u_brg,life:2.5,kind:e.type});
        registerBearing(e,noisyBearing,u_brg);
        setDetected(e,C.detection.detectT,0);
      }
    }
  }

  function proximityDetect(){
    for(const e of enemies){
      if(e.dead) continue;
      const dx=AI.wrapDx(player.wx,e.x);
      const dy=AI.wrapDy(player.wy,e.y);
      const d=Math.hypot(dx,dy);
      if(d<C.detection.proximityR){
        setDetected(e,C.detection.detectT+1.0,C.detection.seenT);
        registerFix(e,e.x,e.y,30,'proximity');
      }
    }
  }

  function activePing(){
    if(player.pingCd>0) return false;
    player.pingCd=C.player.pingCd;
    player.sonarPulse=C.player.pingPulse;
    // Ping is a loud transient — big noise spike
    player.noiseTransient=Math.min(1,player.noiseTransient+0.65);

    // Detect enemies (returns echo to player)
    let hits=0;
    for(const e of enemies){
      if(e.dead) continue;
      const dx=AI.wrapDx(player.wx,e.x);
      const dy=AI.wrapDy(player.wy,e.y);
      const d=Math.hypot(dx,dy);
      if(d<C.detection.pingDetectR){
        setDetected(e,C.detection.detectT,0);
        registerFix(e,e.x,e.y,20+d*0.04,'active');
        hits++;
      }
    }
    addLog('SONAR', hits>0 ? `Active ping — ${hits} return${hits>1?'s':''}` : 'Active ping — no returns');

    // DATUM — ping is heard by ALL enemies in a very wide radius
    // This is the primary cost of going active
    const datumRange=C.player.pingDatumRange||5000;
    const datumSus=C.player.pingDatumSus||0.75;
    broadcastTransient(player.wx, player.wy, datumRange, datumSus, null);
    // Count how many were alerted
    let alerted=0;
    for(const e of enemies){
      if(!e.dead){
        const dx=AI.wrapDx(player.wx,e.x), dy=player.wy-e.y;
        if(Math.hypot(dx,dy)<datumRange) alerted++;
      }
    }
    if(alerted>0) addLog('SONAR',`WARNING: ping datum — ${alerted} contact${alerted>1?'s':''} alerted`);
    return true;
  }

  window.SENSE={setDetected,passiveUpdate,towedArrayUpdate,proximityDetect,activePing,clearContact,tickContacts};
})();