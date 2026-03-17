(() => {
  'use strict';
  const C=window.CONFIG; const {rand,clamp,now}=window.M;
  const {world,player,enemies,game,addLog}=window.G;

  function inLayer(d){return d>=world.layerY1&&d<=world.layerY2;}
  // 40% signal loss crossing thermocline — NATO exploited this heavily in Cold War doctrine
  function layerPenalty(d1,d2){const a=inLayer(d1),b=inLayer(d2); return (a!==b)?0.60:1.0;}
  function wrapDx(x1,x2){return x2-x1;}
  function wrapDy(y1,y2){return y2-y1;}

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
        x:e.x+Math.cos(noisyBrg)*estRange,
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

  // sensorPos: optional {x,y,depth} — the actual sensor location (buoy, helo dip).
  // When omitted, defaults to the enemy ship's own position.
  function enemyUpdateContactFromPing(e,px,py,dist,sensorPos){
    const sx=sensorPos?.x??e.x;
    const sy=sensorPos?.y??e.y;
    const sDepth=sensorPos?.depth??e.vdsDepth??e.depth??400;
    const layer=layerPenalty(py,sDepth);
    const u=(160+dist*0.10)*(layer<1?1.55:1.0);
    e.contact={
      x:px+rand(-u,u),
      y:clamp(py+rand(-u,u),world.seaLevel+80,world.ground-80),
      u, t:now(),
      strength:clamp(0.50+(1-dist/2000)*0.40,0.30,0.92)
    };
    e.suspicion=Math.min(1,e.suspicion+0.45*e.contact.strength);
    // Bearing computed from SENSOR position, not ship — correct for buoys/helos
    if(!e.playerBearings) e.playerBearings=[];
    const brg=Math.atan2(py-sy, wrapDx(sx,px));
    const T=game.missionT||0;
    for(let i=0;i<3;i++){
      e.playerBearings.push({fromX:sx+rand(-50,50), fromY:sy+rand(-50,50), brg:brg+rand(-1,1)*0.06, t:T-i*8});
    }
    if(e.playerBearings.length>16) e.playerBearings.splice(0, e.playerBearings.length-16);
    // Rough position hint — lower quality ceiling from ping alone
    e.tmaX=px+rand(-1,1)*150; e.tmaY=py+rand(-1,1)*150;
    e.tmaQuality=Math.min((e.tmaQuality||0) + 0.22, 0.38); // ping gives a start, not a solution
  }

  // Enemy speed deafness — Soviet hulls noisier, go deaf at lower speeds than NATO
  // Uses C.enemy.deafStartKts/deafFullKts/deafnessCeil (Soviet) vs C.player.speedDeafness (NATO)
  function enemySpeedDeafness(e){
    const startKts = C.enemy.deafStartKts ?? 3;
    const fullKts  = C.enemy.deafFullKts  ?? 8;
    const ceil     = C.enemy.deafnessCeil ?? 0.92;
    const kts=Math.hypot(e.vx||0,e.vy||0);
    return 1.0-clamp((kts-startKts)/(fullKts-startKts),0,ceil);
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

    const sonarDepth=e.vdsDepth||e.depth||400;
    const layer=layerPenalty(player.depth,sonarDepth);
    let signal=player.noise*layer*(1-d/baseRange);
    if(e.type==='boat' && (player.periscopeT||0)>0) signal*=(C.player.periscope?.detectBoost||1.55);
    if(signal<C.enemy.hearSignalMin) return;

    // ── Enemy deaf arc — player can hide in enemy baffles ─────────────────────
    // Uses enemyBaffle* fields from C.player.sonar (Soviet boats: wider, speed-sensitive)
    const sg=C.player.sonar||{};
    const eBaffleBase =(sg.enemyBaffleBase??20)*Math.PI/180;
    const eBaffleMax  =(sg.enemyBaffleMax ??55)*Math.PI/180;
    const eBaffleHalf =clamp(eBaffleBase+(e.speed||0)*(sg.enemyBafflePerKt??2.0)*Math.PI/180, eBaffleBase, eBaffleMax);
    const eRolloff    =(sg.baffleRolloffDeg??20)*Math.PI/180;
    const eBrg        =Math.atan2(dy,dx);
    const eRelAngle   =Math.abs(((eBrg-(e.heading||0)+3*Math.PI)%(Math.PI*2))-Math.PI);
    const eDeadStart  =Math.PI-eBaffleHalf;
    const eFullLimit  =eDeadStart-eRolloff;
    const eGeoMult    =eRelAngle<=eFullLimit?1.0:eRelAngle>=eDeadStart?0.0:1.0-(eRelAngle-eFullLimit)/eRolloff;
    signal*=eGeoMult;
    if(signal<C.enemy.hearSignalMin) return;

    // Detection prob — deafness reduces it when enemy is sprinting; sensitivity scales hearing
    // _dmgSensorMult: sonar casualty from torpedo damage (set in damageEnemy in sim.js)
    const sensorMult=e._dmgSensorMult??1.0;
    const p=clamp((signal-C.enemy.hearPBase)*C.enemy.hearPScale*deafness*(e.sensitivity||1.0)*sensorMult, 0, 0.80);
    if(Math.random()<p){
      const susGain=clamp(0.05+signal*0.22, 0.05, 0.18);
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
    // Golf-class snorkel: diesel SSBN must surface-snorkel periodically — very loud
    // _snorkeling flag set/cleared by sim.js tick; this is the noise injection point
    if(e._snorkeling) n=clamp(n+0.52, 0, 1);
    // Damage noise penalty: machinery casualties raise noise floor (set by casualty roll in sim.js)
    if(e._dmgNoisePenalty) n=Math.min(1, n+e._dmgNoisePenalty);
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
    const ex=player.wx+Math.cos(ang)*dist;
    const ey=player.wy+Math.sin(ang)*dist;
    const toPlayer=Math.atan2(player.wy-ey,player.wx-ex)+rand(-0.8,0.8);
    const spd=rand(12,28);
    if(type==='boat'){
      const nf=0.75;
      enemies.push({...common,type,x:ex,y:ey,depth:0,hitY:0,
        vx:Math.cos(toPlayer)*spd,vy:Math.sin(toPlayer)*spd,
        r:34,hp:80,sensitivity:rand(0.70,1.05),_noiseFloor:nf,noise:nf,
        flareCd:rand(2.2,4.5),cwis:{pKillPerSec:rand(0.55,0.9),range:rand(520,760)},
        subClass:'KRIVAK'});
    } else {
      const depth=rand(200,450); // capped — no submarine operates below 450m (was incorrectly 1100m)
      const nf=rand(0.22,0.30);
      enemies.push({...common,type,x:ex,y:ey,depth,
        vx:Math.cos(toPlayer)*spd,vy:Math.sin(toPlayer)*spd,
        r:30,hp:90,sensitivity:rand(0.55,0.90),_noiseFloor:nf,noise:nf,
        subClass:'SIERRA'});
    }
    const e=enemies[enemies.length-1]; e.navX=e.x; e.navY=e.y;
  }

  // role: 'hunter' | 'pinger' | 'interceptor'
  // offsetAngle: perpendicular offset in formation (radians from bearing)
  // offsetDist: distance offset perpendicular to bearing
  function spawnSub(bearing, dist, role='hunter', offsetDist=0){
    const perpAng=bearing+Math.PI/2;
    const ex=player.wx+Math.cos(bearing)*dist+Math.cos(perpAng)*offsetDist;
    const ey=player.wy+Math.sin(bearing)*dist+Math.sin(perpAng)*offsetDist;
    const awayAng=bearing+Math.PI;
    // Hunters and interceptors are responding to a datum — head toward the player
    // with some spread (±30°). Pingers run a cross-track barrier pattern.
    const towardAng=bearing; // bearing points from player outward, so reverse for inward
    const patrolHeading=role==='pinger'
      ? awayAng+rand(-0.3,0.3)+Math.PI/2   // cross-track barrier
      : towardAng+rand(-0.52,0.52);          // ±30° toward player
    // Pingers run a little faster on patrol — they're not hiding
    const spd=role==='pinger'?rand(7,11):role==='interceptor'?rand(5,8):rand(4,6);
    // Depth by class: Victor III (pinger) test depth ~380m; Alfa/Sierra (interceptor/hunter) ~500-600m
    const maxClassDepth = role==='pinger' ? 350 : 500;
    const depth=rand(200, maxClassDepth);
    const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:0,contact:null,
      playerBearings:[], tmaQuality:0, tmaX:null, tmaY:null,
      fireCd:rand(4.0,8.0),cmCd:rand(2.2,5.5),cmStock:6,
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
    // Noise floor by role — Soviet SSNs (Victor III / Alfa / Sierra era)
    // Significantly louder than NATO equivalents. Pinger: active ops add machinery noise.
    // Interceptor: fast sprint design, high-power plant. Hunter: slow creep, still noisy.
    const nf = role==='pinger' ? rand(0.38,0.52)     // Victor III pinging: very audible
              : role==='interceptor' ? rand(0.22,0.32) // Alfa/Sierra: fast reactor, noisy
              : rand(0.28,0.40); // hunter — slow but still much louder than NATO SSN
    // Soviet sonar: capable but 5-10 years behind NATO processing
    const sensitivity = role==='pinger' ? rand(0.50,0.72)
                      : role==='interceptor' ? rand(0.60,0.80)
                      : rand(0.55,0.75);
    const subClass = role==='pinger' ? 'VICTOR'
                   : role==='interceptor' ? 'ALFA'
                   : 'SIERRA';
    enemies.push({...common,type:'sub',x:ex,y:ey,depth,
      vx:Math.cos(patrolHeading)*spd,vy:Math.sin(patrolHeading)*spd,
      r:30,hitR:90,hp:90,hpMax:90,sensitivity,
      _noiseFloor:nf, noise:nf,
      torpTubes:Array(C.enemy.subTubes).fill(0),
      torpStock:C.enemy.subTorpStock,
      subClass,
    });
  }

  // ── SSBN spawn — Typhoon-class boomer ──────────────────────────────────────
  function spawnSSBN(bearing, dist){
    const ex=player.wx+Math.cos(bearing)*dist;
    const ey=player.wy+Math.sin(bearing)*dist;
    const patrolHeading=bearing+Math.PI+rand(-0.4,0.4); // generally moving away
    const spd=rand(3,5); // slow patrol creep
    const depth=rand(250,400); // deep bastion patrol
    const nf=rand(0.22,0.30); // Typhoon: large hull, multiple reactors — louder than Delta
    const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:0,contact:null,
      playerBearings:[], tmaQuality:0, tmaX:null, tmaY:null,
      fireCd:rand(8.0,14.0),cmCd:rand(2.0,4.0),cmStock:10,
      navT:rand(200,400),
      patrolHeading, heading:patrolHeading,
      pingCd:9999,pingPulse:0, // SSBNs never ping — silence is survival
      evadeT:0,evadeFrom:null,evadeDecoy:null,
      tmaManeuverT:0, tmaManeuverDir:1, tmaPhase:'drift',
      role:'ssbn',
      interceptState:'waiting',interceptTargetX:null,interceptTargetY:null,
    };
    enemies.push({...common,type:'sub',x:ex,y:ey,depth,
      vx:Math.cos(patrolHeading)*spd,vy:Math.sin(patrolHeading)*spd,
      r:48, hitR:140, hp:160, hpMax:160,   // massive hull — harder to kill
      sensitivity:rand(0.55,0.75),        // Typhoon sonar: passive-only doctrine, secondary to stealth
      _noiseFloor:nf, noise:nf,
      torpTubes:Array(2).fill(0),         // self-defence tubes only
      torpStock:4,                        // minimal loadout — missiles are the payload
      subClass:'TYPHOON',
    });
  }

  // ── Zeta-class SSN — boss-tier enemy ──────────────────────────────────────
  // Extremely capable: quiet, sensitive sonar, heavy torpedo loadout, tough hull.
  // Hunts aggressively using all available systems — passive sonar, tactical active
  // pinging when stuck, and bearing-only probe shots to flush the target.
  function spawnZeta(bearing, dist){
    const ex=player.wx+Math.cos(bearing)*dist;
    const ey=player.wy+Math.sin(bearing)*dist;
    // Zeta heads TOWARD the player — actively hunting from the start
    const patrolHeading=bearing+Math.PI+rand(-0.3,0.3);
    const spd=rand(6,8); // aggressive patrol — closing on datum
    const depth=rand(250,500);
    const nf=rand(0.12,0.18); // Akula/Sierra — quietest Soviet SSN, still louder than NATO 688i
    const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:0,contact:null,
      playerBearings:[], tmaQuality:0, tmaX:null, tmaY:null,
      fireCd:rand(4.0,7.0),cmCd:rand(1.8,3.5),cmStock:10,
      navT:rand(40,80),                 // shorter patrol legs — restless hunter
      patrolHeading, heading:patrolHeading,
      pingCd:rand(C.enemy.subPingCd[0],C.enemy.subPingCd[1]),pingPulse:0,
      evadeT:0,evadeFrom:null,evadeDecoy:null,
      tmaManeuverT:0, tmaManeuverDir:1, tmaPhase:'drift',
      role:'zeta',
      interceptState:'waiting',interceptTargetX:null,interceptTargetY:null,
      // Tactical ping — uses existing ping system, fires when TMA stuck
      tacticalPing:true,
      tacticalPingTmaThresh:0.25,       // ping when TMA below this
      tacticalPingSusThresh:0.12,       // need at least some suspicion
      tacticalPingStuckTime:20,         // wait 20s for passive to work first
      tacticalPingCd:[35,55],           // 35-55s between tactical pings
      // Bearing-only fire — probe shot down a bearing when TMA won't converge
      bearingOnlyEnabled:true,
      bearingOnlySusThresh:0.30,        // needs decent suspicion
      bearingOnlyCdTime:50,             // 50s cooldown — considered shots
    };
    enemies.push({...common,type:'sub',x:ex,y:ey,depth,
      vx:Math.cos(patrolHeading)*spd,vy:Math.sin(patrolHeading)*spd,
      r:32, hitR:95, hp:130, hpMax:130,   // tough hull — takes punishment
      sensitivity:rand(0.72,0.88),        // top Soviet sonar — good, but not NATO-class processing
      _noiseFloor:nf, noise:nf,
      torpTubes:Array(4).fill(0),        // 4 tubes
      torpStock:10,                      // deep magazine
      subClass:'AKULA',
    });
  }

  // ── Gamma-class SSK — old diesel-electric ──────────────────────────────────
  // Extremely quiet on battery but slow and shallow. Ambush predator.
  function spawnGamma(bearing, dist, offsetDist=0){
    const perpAng=bearing+Math.PI/2;
    const ex=player.wx+Math.cos(bearing)*dist+Math.cos(perpAng)*offsetDist;
    const ey=player.wy+Math.sin(bearing)*dist+Math.sin(perpAng)*offsetDist;
    const patrolHeading=bearing+Math.PI+rand(-0.5,0.5);
    const spd=rand(3,5); // battery creep
    const depth=rand(80,250); // shallow — old pressure hull
    const nf=rand(0.04,0.06); // dead quiet on battery
    const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:0,contact:null,
      playerBearings:[], tmaQuality:0, tmaX:null, tmaY:null,
      fireCd:rand(5.0,10.0),cmCd:rand(3.0,6.0),cmStock:4,
      navT:rand(150,350),
      patrolHeading, heading:patrolHeading,
      pingCd:9999,pingPulse:0, // diesel boats stay silent
      evadeT:0,evadeFrom:null,evadeDecoy:null,
      tmaManeuverT:0, tmaManeuverDir:1, tmaPhase:'drift',
      role:'hunter',
      interceptState:'waiting',interceptTargetX:null,interceptTargetY:null,
    };
    enemies.push({...common,type:'sub',x:ex,y:ey,depth,
      vx:Math.cos(patrolHeading)*spd,vy:Math.sin(patrolHeading)*spd,
      r:24, hitR:72, hp:60, hpMax:60,
      sensitivity:rand(0.45,0.65), // old sonar suite
      _noiseFloor:nf, noise:nf,
      torpTubes:Array(4).fill(0),
      torpStock:8,
      subClass:'FOXTROT',
    });
  }

  // ── Eta-class SSK — modern diesel-electric / AIP ──────────────────────────
  // Whisper-quiet with modern sensors. Still slow but very hard to find.
  function spawnEta(bearing, dist, offsetDist=0){
    const perpAng=bearing+Math.PI/2;
    const ex=player.wx+Math.cos(bearing)*dist+Math.cos(perpAng)*offsetDist;
    const ey=player.wy+Math.sin(bearing)*dist+Math.sin(perpAng)*offsetDist;
    const patrolHeading=bearing+Math.PI+rand(-0.5,0.5);
    const spd=rand(3,5);
    const depth=rand(100,300);
    const nf=rand(0.03,0.06); // AIP — quietest thing in the water
    const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:0,contact:null,
      playerBearings:[], tmaQuality:0, tmaX:null, tmaY:null,
      fireCd:rand(4.0,8.0),cmCd:rand(2.5,5.0),cmStock:6,
      navT:rand(120,280),
      patrolHeading, heading:patrolHeading,
      pingCd:9999,pingPulse:0,
      evadeT:0,evadeFrom:null,evadeDecoy:null,
      tmaManeuverT:0, tmaManeuverDir:1, tmaPhase:'drift',
      role:'hunter',
      interceptState:'waiting',interceptTargetX:null,interceptTargetY:null,
    };
    enemies.push({...common,type:'sub',x:ex,y:ey,depth,
      vx:Math.cos(patrolHeading)*spd,vy:Math.sin(patrolHeading)*spd,
      r:26, hitR:78, hp:70, hpMax:70,
      sensitivity:rand(0.70,0.90), // modern sonar
      _noiseFloor:nf, noise:nf,
      torpTubes:Array(4).fill(0),
      torpStock:10,
      subClass:'KILO',
    });
  }

  // ── Epsilon-class SSBN — newer ballistic missile submarine ────────────────
  // Smaller and quieter than Delta, but same evasion-focused doctrine.
  function spawnEpsilon(bearing, dist){
    const ex=player.wx+Math.cos(bearing)*dist;
    const ey=player.wy+Math.sin(bearing)*dist;
    const patrolHeading=bearing+Math.PI+rand(-0.4,0.4);
    const spd=rand(3,5);
    const depth=rand(250,450);
    const nf=rand(0.18,0.26); // Delta IV / Epsilon: improved hull quieting, still Soviet-loud
    const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:0,contact:null,
      playerBearings:[], tmaQuality:0, tmaX:null, tmaY:null,
      fireCd:rand(8.0,14.0),cmCd:rand(2.0,4.0),cmStock:8,
      navT:rand(200,400),
      patrolHeading, heading:patrolHeading,
      pingCd:9999,pingPulse:0,
      evadeT:0,evadeFrom:null,evadeDecoy:null,
      tmaManeuverT:0, tmaManeuverDir:1, tmaPhase:'drift',
      role:'ssbn',
      interceptState:'waiting',interceptTargetX:null,interceptTargetY:null,
    };
    enemies.push({...common,type:'sub',x:ex,y:ey,depth,
      vx:Math.cos(patrolHeading)*spd,vy:Math.sin(patrolHeading)*spd,
      r:42, hitR:120, hp:140, hpMax:140,
      sensitivity:rand(0.60,0.78),  // SSBN sonar: passive-only, not hunter-grade
      _noiseFloor:nf, noise:nf,
      torpTubes:Array(2).fill(0),
      torpStock:4,
      subClass:'DELTA',
    });
  }

  // ── Theta-class SSGN — guided missile submarine ───────────────────────────
  // Large, relatively noisy, but well-armed. Carries cruise missiles (not modeled)
  // and a decent torpedo loadout for self-defence and opportunistic attacks.
  function spawnTheta(bearing, dist, offsetDist=0){
    const perpAng=bearing+Math.PI/2;
    const ex=player.wx+Math.cos(bearing)*dist+Math.cos(perpAng)*offsetDist;
    const ey=player.wy+Math.sin(bearing)*dist+Math.sin(perpAng)*offsetDist;
    const patrolHeading=bearing+Math.PI+rand(-0.4,0.4);
    const spd=rand(5,8);
    const depth=rand(200,500);
    const nf=rand(0.32,0.48); // Oscar SSGN: massive double hull, loud reactor plant
    const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:0,contact:null,
      playerBearings:[], tmaQuality:0, tmaX:null, tmaY:null,
      fireCd:rand(4.0,8.0),cmCd:rand(2.0,4.0),cmStock:8,
      navT:rand(100,220),
      patrolHeading, heading:patrolHeading,
      pingCd:rand(C.enemy.subPingCd[0],C.enemy.subPingCd[1]),pingPulse:0,
      evadeT:0,evadeFrom:null,evadeDecoy:null,
      tmaManeuverT:0, tmaManeuverDir:1, tmaPhase:'drift',
      role:'hunter', // will fight if cornered
      interceptState:'waiting',interceptTargetX:null,interceptTargetY:null,
    };
    enemies.push({...common,type:'sub',x:ex,y:ey,depth,
      vx:Math.cos(patrolHeading)*spd,vy:Math.sin(patrolHeading)*spd,
      r:44, hitR:130, hp:140, hpMax:140,
      sensitivity:rand(0.55,0.72),  // SSGN sonar: functional but not optimised for sub-hunting
      _noiseFloor:nf, noise:nf,
      torpTubes:Array(4).fill(0),
      torpStock:8,
      subClass:'OSCAR',
    });
  }

  // ── November-class SSN (Project 627) — first Soviet nuclear submarine ───────
  // Historically nicknamed "widow maker" — unreliable reactor, very loud, aggressive.
  // Gameplay: easy early-wave SSN. Very detectable but still nuclear and fast.
  function spawnNovember(bearing, dist, offsetDist=0){
    const perpAng=bearing+Math.PI/2;
    const ex=player.wx+Math.cos(bearing)*dist+Math.cos(perpAng)*offsetDist;
    const ey=player.wy+Math.sin(bearing)*dist+Math.sin(perpAng)*offsetDist;
    const patrolHeading=bearing+Math.PI+rand(-0.4,0.4);
    const spd=rand(5,9);
    const depth=rand(150,350); // shallow — old pressure hull
    const nf=rand(0.55,0.70); // extremely loud — early reactor plant
    const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:0,contact:null,
      playerBearings:[],tmaQuality:0,tmaX:null,tmaY:null,
      fireCd:rand(5.0,10.0),cmCd:rand(3.0,6.0),cmStock:4,
      navT:rand(C.enemy.subNavT[0],C.enemy.subNavT[1]),
      patrolHeading,heading:patrolHeading,
      pingCd:rand(8,16),pingPulse:0,
      evadeT:0,evadeFrom:null,evadeDecoy:null,
      tmaManeuverT:0,tmaManeuverDir:1,tmaPhase:'drift',
      role:'hunter',
      interceptState:'waiting',interceptTargetX:null,interceptTargetY:null,
    };
    enemies.push({...common,type:'sub',x:ex,y:ey,depth,
      vx:Math.cos(patrolHeading)*spd,vy:Math.sin(patrolHeading)*spd,
      r:28,hitR:84,hp:70,hpMax:70,
      sensitivity:rand(0.40,0.55), // old sonar, poor processing
      _noiseFloor:nf,noise:nf,
      torpTubes:Array(2).fill(0),
      torpStock:4,
      subClass:'NOVEMBER',
    });
  }

  // ── Whiskey-class SSK (Project 613) — early Cold War diesel workhorse ────────
  // 200+ built. Battery-quiet like Foxtrot but shallower, older, less capable.
  // Gameplay: swarm/early-wave diesel. Good background threat in groups.
  function spawnWhiskey(bearing, dist, offsetDist=0){
    const perpAng=bearing+Math.PI/2;
    const ex=player.wx+Math.cos(bearing)*dist+Math.cos(perpAng)*offsetDist;
    const ey=player.wy+Math.sin(bearing)*dist+Math.sin(perpAng)*offsetDist;
    const patrolHeading=bearing+Math.PI+rand(-0.5,0.5);
    const spd=rand(2,4);
    const depth=rand(50,180); // very shallow — WWII-era hull
    const nf=rand(0.03,0.05); // quiet on battery
    const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:0,contact:null,
      playerBearings:[],tmaQuality:0,tmaX:null,tmaY:null,
      fireCd:rand(6.0,12.0),cmCd:rand(3.5,7.0),cmStock:3,
      navT:rand(C.enemy.subNavT[0],C.enemy.subNavT[1]),
      patrolHeading,heading:patrolHeading,
      pingCd:9999,pingPulse:0, // old diesel boats stay silent
      evadeT:0,evadeFrom:null,evadeDecoy:null,
      tmaManeuverT:0,tmaManeuverDir:1,tmaPhase:'drift',
      role:'hunter',
      interceptState:'waiting',interceptTargetX:null,interceptTargetY:null,
    };
    enemies.push({...common,type:'sub',x:ex,y:ey,depth,
      vx:Math.cos(patrolHeading)*spd,vy:Math.sin(patrolHeading)*spd,
      r:20,hitR:60,hp:45,hpMax:45,
      sensitivity:rand(0.35,0.55), // old sonar, limited capability
      _noiseFloor:nf,noise:nf,
      torpTubes:Array(2).fill(0), // forward tubes only
      torpStock:8,
      subClass:'WHISKEY',
    });
  }

  // ── Yankee-class SSBN (Project 667A) — early Soviet SSBN ─────────────────────
  // 34 built. Shadowed US coasts. Noisier and shallower than Delta IV.
  // Gameplay: SSBN tier 1 — progression step below Delta IV.
  function spawnYankee(bearing, dist){
    const ex=player.wx+Math.cos(bearing)*dist;
    const ey=player.wy+Math.sin(bearing)*dist;
    const patrolHeading=bearing+Math.PI+rand(-0.4,0.4);
    const spd=rand(3,5);
    const depth=rand(200,380);
    const nf=rand(0.28,0.38); // noisier than Delta IV
    const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:0,contact:null,
      playerBearings:[],tmaQuality:0,tmaX:null,tmaY:null,
      fireCd:rand(8.0,14.0),cmCd:rand(2.0,4.0),cmStock:6,
      navT:rand(200,400),
      patrolHeading,heading:patrolHeading,
      pingCd:9999,pingPulse:0,
      evadeT:0,evadeFrom:null,evadeDecoy:null,
      tmaManeuverT:0,tmaManeuverDir:1,tmaPhase:'drift',
      role:'ssbn',
      interceptState:'waiting',interceptTargetX:null,interceptTargetY:null,
    };
    enemies.push({...common,type:'sub',x:ex,y:ey,depth,
      vx:Math.cos(patrolHeading)*spd,vy:Math.sin(patrolHeading)*spd,
      r:38,hitR:110,hp:120,hpMax:120,
      sensitivity:rand(0.55,0.72), // passive-only doctrine
      _noiseFloor:nf,noise:nf,
      torpTubes:Array(2).fill(0),
      torpStock:4,
      subClass:'YANKEE',
    });
  }

  // ── Papa-class SSGN (Project 661, K-222) — fastest submarine ever built ──────
  // Only one ever built. ~44kt. Very loud. Technology demonstrator.
  // Gameplay: rare encounter — player hears it from far away but it closes terrifyingly fast.
  function spawnPapa(bearing, dist){
    const ex=player.wx+Math.cos(bearing)*dist;
    const ey=player.wy+Math.sin(bearing)*dist;
    const patrolHeading=bearing+Math.PI+rand(-0.3,0.3);
    const spd=rand(20,30); // K-222: ~44kt max — closes terrifyingly fast; patrol at high speed to reflect this
    const depth=rand(200,500);
    const nf=rand(0.65,0.80); // enormous reactor plant — extremely loud
    const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:0,contact:null,
      playerBearings:[],tmaQuality:0,tmaX:null,tmaY:null,
      fireCd:rand(4.0,8.0),cmCd:rand(2.0,4.0),cmStock:8,
      navT:rand(60,140),
      patrolHeading,heading:patrolHeading,
      pingCd:rand(C.enemy.subPingCd[0],C.enemy.subPingCd[1]),pingPulse:0,
      evadeT:0,evadeFrom:null,evadeDecoy:null,
      tmaManeuverT:0,tmaManeuverDir:1,tmaPhase:'drift',
      role:'hunter',
      interceptState:'waiting',interceptTargetX:null,interceptTargetY:null,
    };
    enemies.push({...common,type:'sub',x:ex,y:ey,depth,
      vx:Math.cos(patrolHeading)*spd,vy:Math.sin(patrolHeading)*spd,
      r:44,hitR:130,hp:130,hpMax:130,
      sensitivity:rand(0.55,0.70),
      _noiseFloor:nf,noise:nf,
      torpTubes:Array(4).fill(0),
      torpStock:8,
      subClass:'PAPA',
    });
  }

  // ── Golf-class SSB (Project 629) — diesel ballistic missile submarine ────────
  // K-129 (Golf II) sank 1968. B-59 involved in Cuban Missile Crisis.
  // Gameplay: whisper-quiet on battery but must snorkel periodically — goes very loud.
  // Snorkel state managed in sim.js tick; noise hook in updateEnemyNoise().
  function spawnGolf(bearing, dist){
    const ex=player.wx+Math.cos(bearing)*dist;
    const ey=player.wy+Math.sin(bearing)*dist;
    const patrolHeading=bearing+Math.PI+rand(-0.4,0.4);
    const spd=rand(2,4);
    const depth=rand(80,200); // shallow — diesel hull
    const nf=rand(0.03,0.06); // battery-quiet
    const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,suspicion:0,contact:null,
      playerBearings:[],tmaQuality:0,tmaX:null,tmaY:null,
      fireCd:rand(8.0,14.0),cmCd:rand(2.0,4.0),cmStock:4,
      navT:rand(200,400),
      patrolHeading,heading:patrolHeading,
      pingCd:9999,pingPulse:0,
      evadeT:0,evadeFrom:null,evadeDecoy:null,
      tmaManeuverT:0,tmaManeuverDir:1,tmaPhase:'drift',
      role:'ssbn',
      interceptState:'waiting',interceptTargetX:null,interceptTargetY:null,
      // Snorkel cycle — managed in sim.js, noise hook in updateEnemyNoise()
      _snorkeling:false,
      _snorkelCd:rand(120,180), // seconds on battery before first snorkel
    };
    enemies.push({...common,type:'sub',x:ex,y:ey,depth,
      vx:Math.cos(patrolHeading)*spd,vy:Math.sin(patrolHeading)*spd,
      r:30,hitR:90,hp:80,hpMax:80,
      sensitivity:rand(0.40,0.60), // old diesel sonar
      _noiseFloor:nf,noise:nf,
      torpTubes:Array(2).fill(0),
      torpStock:4,
      subClass:'GOLF',
    });
  }

  // ── Surface warship spawns ────────────────────────────────────────────────
  // All surface warships use type:'boat', depth:0, and have CWIS/flare systems.
  // They use the existing boat AI for detection, depth charges, and torpedo fire.
  function _spawnWarship(bearing, dist, stats, offsetDist=0){
    const perpAng=bearing+Math.PI/2;
    const ex=player.wx+Math.cos(bearing)*dist+Math.cos(perpAng)*offsetDist;
    const ey=player.wy+Math.sin(bearing)*dist+Math.sin(perpAng)*offsetDist;
    const patrolHeading=bearing+Math.PI+rand(-0.6,0.6);
    const spd=stats.patrolSpd||rand(10,14);
    const common={seen:0,detectedT:0,lastX:0,lastY:0,lastT:0,
      suspicion:rand(0.0,0.08),contact:null,
      playerBearings:[], tmaQuality:0, tmaX:null, tmaY:null,
      fireCd:rand(3.0,6.0),cmCd:rand(2.0,4.5),
      navT:rand(60,180),navX:0,navY:0,
      heading:patrolHeading,
      pingCd:stats.pingCd??rand(8,16),pingPulse:0,
      evadeT:0,evadeFrom:null,evadeDecoy:null,
    };
    const ent={...common,type:'boat',x:ex,y:ey,depth:0,hitY:0,
      vx:Math.cos(patrolHeading)*spd,vy:Math.sin(patrolHeading)*spd,
      r:stats.r, hp:stats.hp,
      sensitivity:stats.sensitivity,
      _noiseFloor:stats.nf, noise:stats.nf,
      flareCd:rand(2.0,4.5),
      cwis:stats.cwis||{pKillPerSec:rand(0.55,0.85),range:rand(520,720)},
      subClass:stats.subClass,
      role:stats.role||null,
    };
    if(stats.vdsDepth) ent.vdsDepth=stats.vdsDepth;
    if(stats.sonobuoys) ent._sonobuoyCfg=stats.sonobuoys;
    if(stats.helo) ent._heloCfg=stats.helo;
    if(stats.turnRate) ent._turnRate=stats.turnRate;
    if(stats.hasAsroc) ent._hasAsroc=true;
    ent._torpStock = C.enemy.boatTorpStock ?? 6;
    enemies.push(ent);
  }

  function spawnIota(bearing, dist, offsetDist=0){
    _spawnWarship(bearing, dist, {
      r:30, hp:80,
      sensitivity:rand(0.62,0.80),  // Krivak/Udaloy: capable ASW sonar, below NATO standard
      nf:rand(0.60,0.75),
      patrolSpd:rand(10,16),
      pingCd:rand(6,12),
      cwis:{pKillPerSec:rand(0.50,0.80),range:rand(480,680)},
      subClass:'KRIVAK',
      role:'pinger',
      turnRate:rand(0.055,0.075),  // ~3-4°/s — frigate
      vdsDepth:rand(300,380),
      sonobuoys:{interval:[45,75], maxActive:4, buoyLife:120, buoyDepth:rand(280,350), pingCd:[8,14]},
      helo:{dipDepth:rand(300,360), fuel:rand(100,140), refuel:rand(60,90), launchSus:0.15, hasTorp:true, torpStock:2},
      hasAsroc:true,
    }, offsetDist);
  }

  function spawnKappa(bearing, dist, offsetDist=0){
    _spawnWarship(bearing, dist, {
      r:36, hp:100,
      sensitivity:rand(0.68,0.84),  // Udaloy: best Soviet ASW surface sonar, still below NATO standard
      nf:rand(0.65,0.80),
      patrolSpd:rand(14,20),
      pingCd:rand(8,14),
      cwis:{pKillPerSec:rand(0.65,0.95),range:rand(580,800)},
      subClass:'UDALOY',
      role:'pinger',
      turnRate:rand(0.040,0.060),  // ~2-3°/s — large destroyer
      vdsDepth:rand(280,340),
      hasAsroc:true,
    }, offsetDist);
  }

  function spawnLambda(bearing, dist, offsetDist=0){
    _spawnWarship(bearing, dist, {
      r:24, hp:50,
      sensitivity:rand(0.44,0.66),  // Grisha corvette: basic hull sonar, limited processing
      nf:rand(0.55,0.70),
      patrolSpd:rand(8,14),
      pingCd:rand(10,20),
      cwis:{pKillPerSec:rand(0.40,0.65),range:rand(400,600)},
      subClass:'GRISHA',
      role:'pinger',
      turnRate:rand(0.090,0.120),  // ~5-7°/s — nimble corvette
    }, offsetDist);
  }

  function spawnMu(bearing, dist, offsetDist=0){
    _spawnWarship(bearing, dist, {
      r:42, hp:140,
      sensitivity:rand(0.32,0.52),  // Slava cruiser: ASW secondary role, basic hull sonar only
      nf:rand(0.70,0.85),
      patrolSpd:rand(12,18),
      pingCd:rand(14,26),
      cwis:{pKillPerSec:rand(0.70,0.95),range:rand(600,850)},
      subClass:'SLAVA',
      role:null,
      turnRate:rand(0.025,0.040),  // ~1-2°/s — heavy cruiser
    }, offsetDist);
  }

  // ── Civilian ship spawns ──────────────────────────────────────────────────
  // Neutrals — no weapons, no AI combat. Just noise and sonar clutter.
  // They transit on straight courses and don't react to the player.
  function spawnCivilian(civType){
    const w=world.w, h=world.h;
    // Spawn at a random world edge, heading across
    const edge=Math.floor(Math.random()*4);
    let ex,ey,heading;
    if(edge===0){      ex=rand(0,w); ey=0;       heading=rand(Math.PI*0.15,Math.PI*0.85); }
    else if(edge===1){ ex=w;         ey=rand(0,h); heading=rand(Math.PI*0.65,Math.PI*1.35); }
    else if(edge===2){ ex=rand(0,w); ey=h;       heading=rand(-Math.PI*0.85,-Math.PI*0.15); }
    else{              ex=0;         ey=rand(0,h); heading=rand(-Math.PI*0.35,Math.PI*0.35); }

    const stats={
      TANKER:  {r:50,hp:200,nf:rand(0.80,0.95),spd:rand(6,10)},
      CARGO:   {r:40,hp:160,nf:rand(0.60,0.80),spd:rand(8,13)},
      FISHING: {r:18,hp:40, nf:rand(0.40,0.60),spd:rand(3,6)},
      FERRY:   {r:35,hp:120,nf:rand(0.55,0.75),spd:rand(12,18)},
    }[civType]||{r:35,hp:100,nf:0.65,spd:10};

    enemies.push({
      type:'boat', civilian:true, civType,
      x:ex, y:ey, depth:0, hitY:0,
      vx:Math.cos(heading)*stats.spd, vy:Math.sin(heading)*stats.spd,
      r:stats.r, hp:stats.hp,
      heading, patrolHeading:heading,
      _noiseFloor:stats.nf, noise:stats.nf,
      navT:rand(120,400), // long straight legs
      sensitivity:0, // civilians don't listen
      seen:0, detectedT:0, lastX:0, lastY:0, lastT:0,
      suspicion:0, contact:null,
    });
  }

  // Wolfpack datum share — when one enemy gets a fix, nearby enemies get a rough area datum.
  // This gives them a search area to sprint toward, NOT a firing solution.
  // They must develop their own TMA before they can shoot.
  function wolfpackShareDatum(src, datumX, datumY, quality){
    const range=C.enemy.wolfpackDatumRange||4500;
    for(const e of enemies){
      if(e===src||e.dead) continue;
      const dx=wrapDx(e.x,src.x), dy=src.y-e.y;
      const d=Math.hypot(dx,dy);
      if(d>range) continue;
      // Share heavily degraded by distance — enough to sprint toward, not to shoot at
      const sig=clamp(1-d/range,0.1,0.6)*quality;
      // Suspicion boost capped below fireMinSus — forces own sonar contact before firing
      e.suspicion=Math.min(e.suspicion+0.12*sig, Math.max(e.suspicion, 0.45));
      // Large positional uncertainty — search area, not fire control solution
      const blur=clamp(500*(1-sig)+250, 300, 900);
      const sharedX=datumX+rand(-blur,blur);
      const sharedY=datumY+rand(-blur,blur);
      if(!e.contact || sig > (e.contact.strength||0)*0.8){
        e.contact={x:sharedX,y:sharedY,u:blur,t:now(),strength:clamp(sig,0.05,0.35)};
      }
    }
  }

  // ── Active sonar — ship pings when suspicious or in hunt state ───────────────
  // Hull sonar (all ships): above thermal layer only — cannot detect below layer.
  // VDS (Krivak/Udaloy — e.vdsDepth set): can also reach below layer.
  // Active pinging reveals ship to player — audible COMMS event both on hit and miss.
  function shipActiveSonar(e, dt){
    if(e.type!=='boat' || e.civilian) return;
    const asw=C.enemy.asw;

    // Hunt state tick — expires after huntTimeout with no new contact
    if(e._huntState){
      e._huntT=(e._huntT||0)-dt;
      if(e._huntT<=0){ e._huntState=false; e._huntDatum=null; e._sectorBearing=null; }
    }

    // Only go active if suspicious enough or actively hunting
    if(!e._huntState && e.suspicion<asw.activePingThreshold) return;

    // Ping cooldown
    e._pingCd=(e._pingCd||0)-dt;
    if(e._pingCd>0) return;

    // Set next cooldown — tighter when holding contact
    const hasContact=!!e.contact;
    e._pingCd = hasContact
      ? asw.activePingContactInterval + rand(-5,5)
      : rand(asw.activePingInterval[0], asw.activePingInterval[1]);

    // Geometry
    const dx=wrapDx(e.x, player.wx);
    const dy=player.wy-e.y;
    const d=Math.hypot(dx,dy);

    // Layer constraint — hull sonar blocked below thermocline; VDS penetrates it
    const playerBelowLayer=player.depth>(world.layerY2+40);
    const hullCanDetect=!playerBelowLayer;
    const vdsCanDetect=!!e.vdsDepth;

    let detected=false;

    if(hullCanDetect && d<=asw.activePingRange){
      const pDet=clamp((1-d/asw.activePingRange)*0.70*(e.sensitivity||1.0),0,0.85);
      if(Math.random()<pDet) detected=true;
    }
    if(!detected && vdsCanDetect && d<=asw.vdsPingRange){
      const pDet=clamp((1-d/asw.vdsPingRange)*0.65*(e.sensitivity||1.0),0,0.80);
      if(Math.random()<pDet) detected=true;
    }

    if(detected){
      const sDepth=vdsCanDetect?(e.vdsDepth||300):0;
      enemyUpdateContactFromPing(e, player.wx, player.wy, d, {x:e.x, y:e.y, depth:sDepth});
      if(e._huntState) e._huntT=asw.huntTimeout; // reset timer on contact
      window.COMMS?.sonar?.activePing(1);
      shipShareContact(e, player.wx, player.wy, d*0.25);
    } else {
      // Player hears missed pings — active sonar is not stealthy
      window.COMMS?.sonar?.activePing(0);
    }
  }

  // ── Hunt state — triggered when a friendly surface ship is killed ─────────────
  // All surviving surface ships floor suspicion, begin aggressive active search.
  // Coordinator (highest sensitivity) assigns bearing sectors to each searching unit.
  function triggerHuntState(killedShip){
    if(!killedShip || killedShip.type!=='boat') return;
    const asw=C.enemy.asw;
    const datum={x:killedShip.x, y:killedShip.y};

    const ships=enemies.filter(e=>e.type==='boat'&&!e.civilian&&!e.dead);
    if(!ships.length) return;

    // Assign search sectors — ASW specialists ranked by capability (Udaloy leads)
    const aswRank={UDALOY:0,KRIVAK:1,GRISHA:2};
    const searchers=ships
      .filter(e=>e.role==='pinger')
      .sort((a,b)=>(aswRank[a.subClass]??9)-(aswRank[b.subClass]??9));
    const count=Math.max(searchers.length,1);
    for(let i=0;i<searchers.length;i++){
      searchers[i]._sectorBearing=(2*Math.PI/count)*i;
      searchers[i]._sectorArc=asw.sectorArcDeg*(Math.PI/180);
    }

    // Apply hunt state to all surface ships
    for(const e of ships){
      e._huntState=true;
      e._huntT=asw.huntTimeout;
      e._huntDatum=datum;
      e.suspicion=Math.max(e.suspicion, asw.huntSuspicionFloor);
      e._pingCd=0; // ping immediately on next frame
      e._atDatum=false; // reset sector search — new datum from this kill
      e._datumHoldT=0;
      e._sectorRange=0;
    }

    addLog('SONAR','Conn, Sonar — underwater explosion. Multiple contacts going active, all units.');
  }

  // Ships share contact data with other ships only (not with subs, not sub-to-ship).
  // Each recipient adds its own positional noise — same contact, different firing solutions.
  function shipShareContact(fromShip, cx, cy, accuracy){
    const _now=now();
    for(const e of enemies){
      if(e===fromShip || e.dead || e.type!=='boat' || e.civilian) continue;
      // Don't overwrite a fresher own-sensor contact
      if(e.contact && (_now-e.contact.t)<5) continue;
      const noiseR=accuracy*rand(0.9,1.4);
      e.contact={x:cx+rand(-noiseR,noiseR), y:cy+rand(-noiseR,noiseR),
                 u:noiseR, t:_now, strength:0.40, shared:true};
      e.suspicion=Math.min(1,Math.max(e.suspicion,0.45));
    }
  }

  window.AI={wrapDx,wrapDy,layerPenalty,enemyHasFireSolution,enemyUpdateContactFromPing,
             enemyMaybeHearPlayer,enemyDecay,updateEnemyNoise,solveEnemyTMA,enemyRegisterBearing,
             spawnEnemy,spawnSub,spawnSSBN,spawnZeta,spawnGamma,spawnEta,spawnEpsilon,spawnTheta,
             spawnNovember,spawnWhiskey,spawnYankee,spawnPapa,spawnGolf,
             spawnIota,spawnKappa,spawnLambda,spawnMu,spawnCivilian,wolfpackShareDatum,shipShareContact,
             shipActiveSonar,triggerHuntState};
})();