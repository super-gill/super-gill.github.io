(() => {
  'use strict';
  const C=window.CONFIG; const {rand,clamp}=window.M;
  const {world,player,enemies,contacts,sonarContacts,game,addLog}=window.G;
  const AI=window.AI;

  // Throttled sonar raw feed — one entry per contact per ~4s, per array
  const _sonarLogThrottle=new Map(); // key: `${entityId}_${array}` → last log time
  function addSonarLog(e, array, brgDeg, signalTier){
    const key=`${e.x|0}_${array}`;
    const T=game.missionT||0;
    const last=_sonarLogThrottle.get(key)||0;
    if(T-last < 4.0) return; // throttle — don't spam
    _sonarLogThrottle.set(key,T);
    if(!game.sonarLog) game.sonarLog=[];
    const sc=sonarContacts?.get(e);
    const id=sc?.id||'S?';
    const typeLabel=e.type==='boat'?'SURF':'SUB';
    const tierLabel=signalTier>=2?'STRONG':signalTier>=1?'MOD':'FAINT';
    const brgStr=Math.round(brgDeg).toString().padStart(3,'0');
    game.sonarLog.push({t:T, array, id, typeLabel, brgStr, tierLabel});
    if(game.sonarLog.length>60) game.sonarLog.shift();
  }

  let _nextId=1;
  function assignId(){ return 'S'+(_nextId++); }

  // ── TMA solver ─────────────────────────────────────────────────────────────────
  // Weighted least-squares — weight = 1/u_brg² so tight hull bearings dominate
  // wide towed bearings. Velocity estimated from consecutive solutions; never
  // cheated by reading the enemy's actual vx/vy.
  function solveTMA(c){
    const TMA=C.tma;
    const T=game.missionT||0;
    if(c.fixLockedUntil && T < c.fixLockedUntil) return;
    const obs=c.bearings;
    if(obs.length < TMA.minObs){ c.tmaQuality=0; c.tmaX=null; c.tmaY=null; return; }

    let M11=0, M12=0, M22=0, b1=0, b2=0;
    for(const o of obs){
      const w=1/Math.max((o.u_brg||0.10)*(o.u_brg||0.10), 0.0004);
      const s=Math.sin(o.bearing), cs=Math.cos(o.bearing);
      M11+=w*s*s; M12+=w*(-s*cs); M22+=w*cs*cs;
      const d=-s*o.fromX+cs*o.fromY;
      b1+=w*d*(-s); b2+=w*d*cs;
    }
    const det=M11*M22-M12*M12;
    if(Math.abs(det)<1e-8){ c.tmaQuality=0; return; }
    const px=(M22*b1-M12*b2)/det;
    const py=(M11*b2-M12*b1)/det;

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

    // Sanity: solution must be within 110° of mean bearing direction
    let mBX=0, mBY=0;
    for(const o of obs){ mBX+=Math.cos(o.bearing); mBY+=Math.sin(o.bearing); }
    const meanBrg=Math.atan2(mBY,mBX);
    const lastO=obs[obs.length-1];
    const solDir=Math.atan2(py-lastO.fromY, px-lastO.fromX);
    const solErr=Math.abs(((solDir-meanBrg+3*Math.PI)%(Math.PI*2))-Math.PI);
    if(solErr>110*Math.PI/180){ c.tmaQuality=0; return; }

    const qBase=clamp(maxBase/TMA.goodBaseline,0,1);
    const qObs=clamp(obs.length/TMA.goodObs,0,1);
    let maxCross=0;
    for(let i=0;i<obs.length;i++)
      for(let j=i+1;j<obs.length;j++){
        const d=Math.abs(((obs[i].bearing-obs[j].bearing+3*Math.PI)%(Math.PI*2))-Math.PI);
        const cross=Math.min(d,Math.PI-d);
        if(cross>maxCross) maxCross=cross;
      }
    const qCross=clamp((maxCross-5*Math.PI/180)/((25-5)*Math.PI/180),0,1);

    // Velocity: estimated from solution position history every 10s.
    // Only when baseline is meaningful — otherwise zero (honest: we don't know).
    const prevT=c._tmaHistT||0;
    if(T-prevT>=10 && c._tmaHistX!=null && qBase>0.4){
      c.tmVx=clamp((px-c._tmaHistX)/(T-prevT),-25,25);
      c.tmVy=clamp((py-c._tmaHistY)/(T-prevT),-25,25);
    }
    if(T-prevT>=10 || c._tmaHistX==null){
      c._tmaHistX=px; c._tmaHistY=py; c._tmaHistT=T;
    }
    if(c.tmVx==null){ c.tmVx=0; c.tmVy=0; }

    c.tmaX=px; c.tmaY=py; c.tmaBaseline=maxBase; c.tmaT=T;

    let q=qBase*qObs*qCross;
    // Unresolved towed contact with no recent hull coverage — cap at DEGRADED.
    // We may be tracking the wrong ambiguous side; don't allow SOLID on uncertain data.
    const hullAge=T-(c.lastHullBrgT||0);
    if(c.towedCandA && c.towedResolved===null && hullAge>30) q=Math.min(q,0.45);
    c.tmaQuality=q;
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

  function registerBearing(e, bearing, u_brg, source='hull'){
    const T=game.missionT||0;
    const TMA=C.tma;
    if(sonarContacts.has(e)){
      const c=sonarContacts.get(e);
      c.bearings=c.bearings.filter(b=>T-b.t<TMA.maxBearingAge);

      // Hull array resolves towed port/starboard ambiguity
      if(source==='hull' && c.towedCandA && c.towedResolved===null){
        const lastA=c.towedCandA[c.towedCandA.length-1];
        const lastB=c.towedCandB?.[c.towedCandB.length-1];
        if(lastA||lastB){
          const angDif=(a,b)=>Math.abs(((a-b+3*Math.PI)%(Math.PI*2))-Math.PI);
          const dA=lastA?angDif(lastA.bearing,bearing):Math.PI;
          const dB=lastB?angDif(lastB.bearing,bearing):Math.PI;
          const aWins=dA<30*Math.PI/180 && dB>50*Math.PI/180;
          const bWins=dB<30*Math.PI/180 && dA>50*Math.PI/180;
          if(aWins||bWins){
            if(!c.towedVotes) c.towedVotes={A:0,B:0};
            if(aWins){ c.towedVotes.A++; c.towedVotes.B=0; }
            else     { c.towedVotes.B++; c.towedVotes.A=0; }
            const hullActive=T-(c.lastHullBrgT||0)<5;
            const need=hullActive?1:3;
            if(c.towedVotes.A>=need || c.towedVotes.B>=need){
              c.towedResolved=c.towedVotes.A>=need?'A':'B';
              if(c.towedResolved==='B'){
                // Were tracking wrong side — flush towed obs, inject correct side
                c.bearings=c.bearings.filter(o=>o.source!=='towed');
                const corrObs=(c.towedCandB||[]).filter(o=>T-o.t<TMA.maxBearingAge);
                for(const o of corrObs) c.bearings.push({...o,source:'towed'});
                if(c.bearings.length>TMA.maxBearings) c.bearings=c.bearings.slice(-TMA.maxBearings);
                c._tmaHistX=null; c.tmVx=0; c.tmVy=0;
              }
              const relBrg=((bearing-player.heading+3*Math.PI)%(Math.PI*2))-Math.PI;
              const sideStr=relBrg>=0?'starboard':'port';
              addLog('SONAR',`${c.id} ambiguity resolved — contact is ${sideStr}`);
            }
          }
        }
      }

      if(c.bearings.length>=TMA.maxBearings) c.bearings.shift();
      c.bearings.push({fromX:player.wx,fromY:player.wy,bearing,u_brg,t:T,source});
      c.lastObsT=T; c.activeT=3.0;
      c.latestBrg=bearing;
      if(source==='hull'){ c.latestHullBrg=bearing; c.lastHullBrgT=T; }
      c.latestFromX=player.wx; c.latestFromY=player.wy;
      const prevQ=c.tmaQuality??0;
      const prevTier=prevQ<0.35?0:prevQ<0.70?1:2;
      solveTMA(c);
      const newTier=c.tmaQuality<0.35?0:c.tmaQuality<0.70?1:2;
      if(newTier>prevTier){
        if(newTier===1) addLog('SONAR',`${c.id} — solution DEGRADED`);
        if(newTier===2) addLog('SONAR',`${c.id} — solution SOLID`);
      }
      updateLastPos(c);
    } else {
      const id=assignId();
      const newC={
        id, kind:e.type,
        bearings:[{fromX:player.wx,fromY:player.wy,bearing,u_brg,t:T,source}],
        latestBrg:bearing, latestFromX:player.wx, latestFromY:player.wy,
        tmaX:null, tmaY:null, tmaQuality:0, tmaBaseline:0,
        lastX:0, lastY:0, lastObsT:T, activeT:3.0, tmVx:0, tmVy:0,
      };
      if(source==='hull'){ newC.latestHullBrg=bearing; newC.lastHullBrgT=T; }
      newC.lastX=(player.wx+Math.cos(bearing)*TMA.defaultRange+world.w)%world.w;
      newC.lastY=player.wy+Math.sin(bearing)*TMA.defaultRange;
      newC._ref=e;
      sonarContacts.set(e,newC);
      const typeLabel=e.type==='boat'?'surface contact':'subsurface contact';
      const brgDeg=(((Math.atan2(Math.cos(bearing),-Math.sin(bearing))*180/Math.PI)+360)%360);
      if(source==='hull'){
        addLog('SONAR',`New ${typeLabel} ${id} — brg ${Math.round(brgDeg).toString().padStart(3,'0')}° passive`);
      } else {
        addLog('SONAR',`New ${typeLabel} ${id} — brg ${Math.round(brgDeg).toString().padStart(3,'0')}° towed (ambiguous)`);
        addLog('SONAR',`${id}: turn 10-20° to resolve port/starboard`);
      }
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
      c.tmaT=T; c.tmVx=e.vx??0; c.tmVy=e.vy??0;
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
        tmaT:T, tmVx:e.vx??0, tmVy:e.vy??0,
        fixLockedUntil:(T+8),
        lastX:fx, lastY:fy, lastObsT:T,
        activeT:source==='active'?5.0:3.0,
        _ref:e,
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
  function mirrorBearing(brg, heading){
    return (2*heading - brg + 3*Math.PI) % (Math.PI*2) - Math.PI;
  }
  // Is bearing inside the cone of silence? (±28° off stern axis)
  function inDeadCone(brg, heading){
    const stern = heading + Math.PI;
    const diff = Math.abs(((brg - stern + 3*Math.PI) % (Math.PI*2)) - Math.PI);
    return diff < 0.49;
  }
  // solveCandidateTMA removed — ambiguity is ONLY resolved by hull array bearing,
  // never automatically by comparing candidate quality scores.

  // Register a towed array bearing — maintains two candidate sets and auto-resolves
  // Register a towed array bearing.
  // Immediately feeds the active-side bearing into the main TMA stream so geometry
  // accumulates from the first detection — no waiting for hull array resolution.
  // towedCandA/B are maintained for rendering (both dashed lines) only.
  // On resolution to 'B', registerBearing flushes the wrong-side obs automatically.
  function registerTowedBearing(e, candABrg, candBBrg, u_brg){
    const T=game.missionT||0;
    const TMA=C.tma;

    // Determine which side to feed into TMA (resolved 'B' → use candB, else candA)
    const existingC=sonarContacts.get(e);
    const activeBrg=(existingC?.towedResolved==='B') ? candBBrg : candABrg;

    // Push active side into main TMA stream (creates contact if new)
    registerBearing(e, activeBrg, u_brg, 'towed');

    // Update rendering candidate sets
    const c=sonarContacts.get(e);
    if(!c) return;
    if(!c.towedCandA){ c.towedCandA=[]; c.towedCandB=[]; c.towedResolved=null; c.towedVotes={A:0,B:0}; }
    c.towedCandA=c.towedCandA.filter(o=>T-o.t<TMA.maxBearingAge);
    c.towedCandB=c.towedCandB.filter(o=>T-o.t<TMA.maxBearingAge);
    if(c.towedCandA.length>=16) c.towedCandA.shift();
    if(c.towedCandB.length>=16) c.towedCandB.shift();
    c.towedCandA.push({fromX:player.wx,fromY:player.wy,bearing:candABrg,u_brg,t:T});
    c.towedCandB.push({fromX:player.wx,fromY:player.wy,bearing:candBBrg,u_brg,t:T});
    c.latestBrgMirror=candBBrg;
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

        // Ephemeral flashes — push BOTH bearings so neither side looks stronger
        // Only suppress mirror flash if already resolved (then only true side shows)
        const sc=sonarContacts?.get(e);
        const alreadyResolved=sc?.towedResolved!=null;
        contacts.push({fromX:player.wx, fromY:player.wy, bearing:noisyBrg, u_brg, life:2.5, kind:e.type, source:'towed'});
        if(!alreadyResolved){
          contacts.push({fromX:player.wx, fromY:player.wy, bearing:mirrorBrg, u_brg, life:2.5, kind:e.type, source:'towed'});
        }

        registerTowedBearing(e, noisyBrg, mirrorBrg, u_brg);
        SENSE.setDetected(e, C.detection.detectT, 0);
        // Sonar raw feed
        const brgDegT=((noisyBrg*180/Math.PI)+360)%360;
        const sigTierT=detect>0.35?2:detect>0.15?1:0;
        addSonarLog(e,'TOWED',brgDegT,sigTierT);
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
        registerBearing(e,noisyBearing,u_brg,'hull');
        setDetected(e,C.detection.detectT,0);
        // Sonar raw feed
        const brgDeg=((noisyBearing*180/Math.PI)+360)%360;
        const sigTier=detect>0.35?2:detect>0.15?1:0;
        addSonarLog(e,'HULL',brgDeg,sigTier);
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