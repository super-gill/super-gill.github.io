(() => {
  'use strict';
  const C=window.CONFIG; const {rand,clamp,now}=window.M;
  const {world,player,enemies,game,addLog}=window.G;

  function inLayer(d){return d>=world.layerY1&&d<=world.layerY2;}
  function layerPenalty(d1,d2){const a=inLayer(d1),b=inLayer(d2); return (a!==b)?0.70:1.0;}
  function wrapDx(x1,x2){let dx=x2-x1; if(dx>world.w/2) dx-=world.w; if(dx<-world.w/2) dx+=world.w; return dx;}
  function wrapDy(y1,y2){let dy=y2-y1; if(dy>world.h/2) dy-=world.h; if(dy<-world.h/2) dy+=world.h; return dy;}

  // ── Enemy TMA solver — mirrors the player's solveTMA ────────────────────────
  // Gives enemies the same bearing-line least-squares solver.
  // Result stored on e.tma{X,Y,Quality,Baseline}
  function solveEnemyTMA(e){
    const obs=e.playerBearings;
    if(!obs||obs.length<2){ e.tmaQuality=0; e.tmaX=null; e.tmaY=null; return; }

    let M11=0,M12=0,M22=0,b1=0,b2=0;
    for(const o of obs){
      const s=Math.sin(o.brg), cs=Math.cos(o.brg);
      M11+=s*s; M12+=-s*cs; M22+=cs*cs;
      const d=-s*o.fromX+cs*o.fromY;
      b1+=d*(-s); b2+=d*cs;
    }
    const det=M11*M22-M12*M12;
    if(Math.abs(det)<1e-8){ e.tmaQuality=0; return; }
    const px=(M22*b1-M12*b2)/det;
    const py=(M11*b2-M12*b1)/det;

    // Reject if solution is behind ANY observation (consistent with player solveTMA)
    for(const o of obs){
      const dot=(px-o.fromX)*Math.cos(o.brg)+(py-o.fromY)*Math.sin(o.brg);
      if(dot<-200){ e.tmaQuality=0; return; }
    }

    let maxBase=0;
    for(let i=0;i<obs.length;i++)
      for(let j=i+1;j<obs.length;j++){
        const bd=Math.hypot(obs[i].fromX-obs[j].fromX, obs[i].fromY-obs[j].fromY);
        if(bd>maxBase) maxBase=bd;
      }
    const MIN_BASE=80, GOOD_BASE=400;
    if(maxBase<MIN_BASE){ e.tmaQuality=0; return; }

    // Bearing spread — same gate as player (≥8° for full credit)
    let maxBrgSpread=0;
    for(let i=0;i<obs.length;i++)
      for(let j=i+1;j<obs.length;j++){
        const d=Math.abs(((obs[i].brg-obs[j].brg+3*Math.PI)%(Math.PI*2))-Math.PI);
        if(d>maxBrgSpread) maxBrgSpread=d;
      }
    const qSpread=clamp(maxBrgSpread/(8*Math.PI/180),0,1);

    const qBase=clamp(maxBase/GOOD_BASE,0,1);
    const qObs=clamp(obs.length/8,0,1);
    e.tmaX=px; e.tmaY=py; e.tmaBaseline=maxBase;
    e.tmaQuality=qBase*qObs*qSpread;
  }

  // Register a new bearing observation from enemy toward player
  function enemyRegisterBearing(e){
    const dx=wrapDx(e.x,player.wx);
    const dy=player.wy-e.y;
    const trueBrg=Math.atan2(dy,dx);
    const dist=Math.hypot(dx,dy);
    // Bearing noise proportional to dist and own noise
    const u=clamp((80+dist*0.08)*(1+e.noise*0.4)/dist, 0.02, 0.20);
    const noisyBrg=trueBrg+rand(-1,1)*u;

    if(!e.playerBearings) e.playerBearings=[];
    // Cull old bearings (>120s game time)
    const T=game.missionT||0;
    e.playerBearings=e.playerBearings.filter(b=>T-b.t<120);
    if(e.playerBearings.length>=16) e.playerBearings.shift();
    e.playerBearings.push({fromX:e.x, fromY:e.y, brg:noisyBrg, t:T});

    // Solve immediately
    solveEnemyTMA(e);

    // Update contact point — TMA position if quality good, else bearing-range estimate
    const prevContact=e.contact;
    if(e.tmaQuality>=0.20 && e.tmaX!=null){
      e.contact={x:e.tmaX, y:e.tmaY, u:200*(1-e.tmaQuality), t:now(), strength:e.tmaQuality};
    } else {
      const estRange=dist+(rand(-1,1)*dist*0.25); // ±25% range noise
      e.contact={
        x:(e.x+Math.cos(noisyBrg)*estRange+world.w)%world.w,
        y:e.y+Math.sin(noisyBrg)*estRange,
        u:400, t:now(), strength:0.15
      };
    }
  }

  function enemyHasFireSolution(e){
    if(!e.contact) return false;
    const age=now()-e.contact.t;
    if(age>C.enemy.fireMaxAge) return false;
    // Require some minimal TMA quality — hasRoleSolution in sim.js is the real gate
    if((e.tmaQuality||0)<0.20) return false;
    if(e.suspicion<C.enemy.fireMinSus) return false;
    if((e.playerBearings||[]).length<2) return false; // need at least a basic bearing history
    return true;
  }

  function enemyUpdateContactFromPing(e,px,py,dist){
    const layer=layerPenalty(py,e.depth||400);
    const u=(160+dist*0.10)*(layer<1?1.55:1.0);
    e.contact={
      x:(px+rand(-u,u)+world.w)%world.w,
      y:clamp(py+rand(-u,u),world.seaLevel+80,world.ground-80),
      u, t:now(),
      strength:clamp(0.50+(1-dist/2000)*0.40,0.30,0.92)
    };
    e.suspicion=Math.min(1,e.suspicion+0.45*e.contact.strength);
    // Ping gives a rough bearing — boosts suspicion but does NOT grant instant TMA quality.
    // Enemy must still build bearing observations to earn a fire solution.
    if(!e.playerBearings) e.playerBearings=[];
    const brg=Math.atan2(py-e.y, wrapDx(e.x,px));
    const T=game.missionT||0;
    // Add multiple bearing observations spread across recent time so TMA has baseline
    for(let i=0;i<3;i++){
      e.playerBearings.push({fromX:e.x+rand(-50,50), fromY:e.y+rand(-50,50), brg:brg+rand(-1,1)*0.06, t:T-i*8});
    }
    if(e.playerBearings.length>16) e.playerBearings.splice(0, e.playerBearings.length-16);
    // Rough position hint — lower quality ceiling from ping alone
    e.tmaX=px+rand(-1,1)*150; e.tmaY=py+rand(-1,1)*150;
    e.tmaQuality=Math.min((e.tmaQuality||0) + 0.22, 0.38); // ping gives a start, not a solution
  }

  // Enemy speed deafness — same physics as player
  function enemySpeedDeafness(e){
    const sd=C.player.speedDeafness||{startKts:4,fullDeafKts:10};
    const kts=Math.hypot(e.vx||0,e.vy||0); // already in wu/s ≈ kts
    return 1.0-clamp((kts-sd.startKts)/(sd.fullDeafKts-sd.startKts),0,0.88);
  }

  function enemyMaybeHearPlayer(e,dt){
    // Tick interval scales with enemy speed — fast sprinting = deaf
    e._hearTick=(e._hearTick||0)-dt;
    const deafness=enemySpeedDeafness(e);
    const tickBase=rand(0.7,1.3)/Math.max(0.15,deafness);
    if(e._hearTick>0) return;
    e._hearTick=tickBase;

    const dx=wrapDx(e.x,player.wx);
    const dy=player.wy-e.y;
    const d=Math.hypot(dx,dy);
    const baseRange=(e.type==='boat')?C.enemy.hearBoatRange:C.enemy.hearSubRange;
    if(d>baseRange) return;

    const layer=layerPenalty(player.depth,e.depth||400);
    let signal=player.noise*layer*(1-d/baseRange);
    if(e.type==='boat' && (player.periscopeT||0)>0) signal*=(C.player.periscope?.detectBoost||1.55);
    if(signal<C.enemy.hearSignalMin) return;

    // Detection prob — deafness reduces it when enemy is sprinting; sensitivity scales hearing
    const p=clamp((signal-C.enemy.hearPBase)*C.enemy.hearPScale*deafness*(e.sensitivity||1.0), 0, 0.80);
    if(Math.random()<p){
      const susGain=clamp(0.08+signal*0.35, 0.08, 0.28);
      e.suspicion=Math.min(1, e.suspicion+susGain);
      enemyRegisterBearing(e);
    }
  }

  function enemyDecay(e,dt){
    const quiet=(player.noise<C.enemy.quietNoiseThreshold);
    // Decay TMA quality when not actively observing
    const T=game.missionT||0;
    const lastObs=e.playerBearings?.length ? e.playerBearings[e.playerBearings.length-1].t : 0;
    const staleSecs=T-lastObs;
    if(staleSecs>15 && (e.tmaQuality||0)>0){
      e.tmaQuality=Math.max(0,(e.tmaQuality||0)-0.003*dt);
      if(e.tmaQuality<=0){ e.tmaX=null; e.tmaY=null; }
    }

    e.suspicion=Math.max(0,e.suspicion-(C.enemy.susDecayBase+(quiet?C.enemy.susDecayQuietExtra:0))*dt);
    if(e.contact){
      const age=now()-e.contact.t;
      if(age>C.enemy.contactMaxAge||(quiet&&age>C.enemy.contactMaxAgeQuiet)) e.contact=null;
    }
  }

  // ── Enemy acoustic noise model ────────────────────────────────────────────────
  // Dynamic noise updated each tick — mirrors player signature.js model.
  // Soviet-era boats: noisier per knot, cavitate ~25% earlier than NATO boats.
  function updateEnemyNoise(e){
    const spd=Math.hypot(e.vx||0, e.vy||0);
    const floor=e._noiseFloor??0.28;
    // Flow noise: Soviet boats ~30% noisier per knot (worse vibration isolation)
    const flow=(spd/C.player.flowNoiseDiv)*1.3;
    let n=clamp(floor+flow, 0, 1);
    // Cavitation: Soviet props cavitate ~25% earlier than NATO equivalents
    const depth=e.depth??300;
    const d=clamp((depth-world.seaLevel)/C.player.cavitationDepthRef, 0, 2.0);
    const cavThresh=(C.player.cavitationKtsRef+d*(C.player.cavitationDepthRef*C.player.cavitationSlope))*0.75;
    if(spd>cavThresh) n=clamp(n+C.player.cavitationSpike*0.8, 0, 1);
    e.noise=n;
  }

  // ── Spawn helpers ─────────────────────────────────────────────────────────────
  function spawnEnemy(){
    const type=(Math.random()<C.enemy.boatShare)?'boat':'sub';
    const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:rand(0.0,0.12),contact:null,
      playerBearings:[], tmaQuality:0, tmaX:null, tmaY:null,
      fireCd:rand(3.0,6.0),cmCd:rand(2.2,5.5),
      navT:rand(C.enemy.subNavT[0],C.enemy.subNavT[1]),navX:0,navY:0,
      heading:rand(0,Math.PI*2),
      pingCd:rand(C.enemy.subPingCd[0],C.enemy.subPingCd[1]),pingPulse:0,
      evadeT:0,evadeFrom:null,evadeDecoy:null};
    const minR=C.enemy.spawnMinR||2200, maxR=C.enemy.spawnMaxR||4200;
    const ang=rand(0,Math.PI*2);
    const dist=rand(minR,maxR);
    const ex=(player.wx+Math.cos(ang)*dist+world.w)%world.w;
    const ey=(player.wy+Math.sin(ang)*dist+world.h)%world.h;
    const toPlayer=Math.atan2(player.wy-ey,player.wx-ex)+rand(-0.8,0.8);
    const spd=rand(12,28);
    if(type==='boat'){
      const nf=0.75;
      enemies.push({...common,type,x:ex,y:ey,depth:0,hitY:0,
        vx:Math.cos(toPlayer)*spd,vy:Math.sin(toPlayer)*spd,
        r:34,hp:80,sensitivity:rand(0.70,1.05),_noiseFloor:nf,noise:nf,
        flareCd:rand(2.2,4.5),cwis:{pKillPerSec:rand(0.55,0.9),range:rand(520,760)}});
    } else {
      const depth=rand(200,1100);
      const nf=rand(0.22,0.30);
      enemies.push({...common,type,x:ex,y:ey,depth,
        vx:Math.cos(toPlayer)*spd,vy:Math.sin(toPlayer)*spd,
        r:30,hp:90,sensitivity:rand(0.55,0.90),_noiseFloor:nf,noise:nf});
    }
    const e=enemies[enemies.length-1]; e.navX=e.x; e.navY=e.y;
  }

  // role: 'hunter' | 'pinger' | 'interceptor'
  // offsetAngle: perpendicular offset in formation (radians from bearing)
  // offsetDist: distance offset perpendicular to bearing
  function spawnSub(bearing, dist, role='hunter', offsetDist=0){
    const perpAng=bearing+Math.PI/2;
    const ex=(player.wx+Math.cos(bearing)*dist+Math.cos(perpAng)*offsetDist+world.w)%world.w;
    const ey=(player.wy+Math.sin(bearing)*dist+Math.sin(perpAng)*offsetDist+world.h)%world.h;
    const awayAng=bearing+Math.PI;
    // Hunters and interceptors are responding to a datum — head toward the player
    // with some spread (±30°). Pingers run a cross-track barrier pattern.
    const towardAng=bearing; // bearing points from player outward, so reverse for inward
    const patrolHeading=role==='pinger'
      ? awayAng+rand(-0.3,0.3)+Math.PI/2   // cross-track barrier
      : towardAng+rand(-0.52,0.52);          // ±30° toward player
    // Pingers run a little faster on patrol — they're not hiding
    const spd=role==='pinger'?rand(7,11):role==='interceptor'?rand(5,8):rand(4,6);
    const depth=rand(200,600);
    const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:0,contact:null,
      playerBearings:[], tmaQuality:0, tmaX:null, tmaY:null,
      fireCd:rand(4.0,8.0),cmCd:rand(2.2,5.5),
      navT:rand(C.enemy.subNavT[0],C.enemy.subNavT[1]),
      patrolHeading, heading:patrolHeading,
      // Pingers have much shorter ping cooldown; hunters never ping (set very high)
      pingCd: role==='pinger'?rand(8,14):rand(C.enemy.subPingCd[0],C.enemy.subPingCd[1]),
      pingPulse:0,
      evadeT:0,evadeFrom:null,evadeDecoy:null,
      tmaManeuverT:0, tmaManeuverDir:1, tmaPhase:'drift',
      role,                          // 'hunter' | 'pinger' | 'interceptor'
      interceptState:'waiting',      // interceptor sub-state
      interceptTargetX:null, interceptTargetY:null,
    };
    // Noise floor by role — Soviet-era acoustic characteristics at low speed
    // Hunter: quiet stalker. Pinger: active sonar ops add machinery noise.
    // Interceptor: ambush design, minimal running equipment.
    const nf = role==='pinger' ? rand(0.28,0.36)
              : role==='interceptor' ? rand(0.14,0.20)
              : rand(0.20,0.26); // hunter / default
    enemies.push({...common,type:'sub',x:ex,y:ey,depth,
      vx:Math.cos(patrolHeading)*spd,vy:Math.sin(patrolHeading)*spd,
      r:30,hitR:90,hp:90,sensitivity:rand(0.55,0.90),
      _noiseFloor:nf, noise:nf,
      torpTubes:Array(C.enemy.subTubes).fill(0),
      torpStock:C.enemy.subTorpStock,
    });
  }

  // Wolfpack datum share — when one enemy gets a good fix, nearby enemies get it too
  function wolfpackShareDatum(src, datumX, datumY, quality){
    const range=C.enemy.wolfpackDatumRange||4500;
    const T=performance.now()/1000;
    for(const e of enemies){
      if(e===src||e.dead) continue;
      const dx=wrapDx(e.x,src.x), dy=src.y-e.y;
      const d=Math.hypot(dx,dy);
      if(d>range) continue;
      // Share degrades with distance
      const sig=clamp(1-d/range,0.2,1.0)*quality;
      e.suspicion=Math.min(1, e.suspicion+0.25*sig);
      if(!e.contact || sig > (e.contact.strength||0)){
        e.contact={x:datumX,y:datumY,u:clamp(200*(1-sig)+80,80,600),t:now(),strength:sig};
      }
    }
  }

  window.AI={wrapDx,wrapDy,layerPenalty,enemyHasFireSolution,enemyUpdateContactFromPing,
             enemyMaybeHearPlayer,enemyDecay,updateEnemyNoise,solveEnemyTMA,enemyRegisterBearing,spawnEnemy,spawnSub,wolfpackShareDatum};
})();