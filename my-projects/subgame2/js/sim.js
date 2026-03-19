(() => {
  'use strict';
  const C=window.CONFIG; const {rand,clamp,lerp,now,angleNorm}=window.M;
  const {world,cam,canvas,bullets,particles,enemies,decoys,contacts,cwisTracers,wireContacts,buoys,missiles,player,game,setMsg,addLog}=window.G;
  const COMMS=window.COMMS; const I=window.I; const NAV=window.NAV; const {ktsToWU}=window.NAV; const SIG=window.SIG; const SENSE=window.SENSE; const W=window.W; const AI=window.AI; const DMG=window.DMG;

  function wrapX(x){return x;}
  // Legacy shim — depth charges pass no position so we let DMG pick a random compartment
  function damagePlayer(amount, hitX, hitY){
    if(game.godMode){ W.makeExplosion(player.wx, player.wy, 0.8, true); return; }
    DMG.hit(amount, hitX??null, hitY??null);
    W.makeExplosion(player.wx, player.wy, 0.8, true);
  }
  function damageEnemy(e,amount){
    const hpMax=e.hpMax??e.hp; // hpMax set at spawn; fallback to current hp if missing
    e.hp-=amount;
    W.makeExplosion(e.x,e.y,amount>=90?1.6:1.0,e.type==="boat");
    // Enemy submarine casualty roll — performance degrades with damage, not just HP loss
    // Modifiers read by updateEnemyNoise() and enemyMaybeHearPlayer() in ai.js,
    // and by the speed cap in the sub movement block below
    if(e.type==='sub' && e.hp>0){
      const fracHit=amount/hpMax;
      const fracTotal=1-(e.hp/hpMax);
      e._dmgNoisePenalty=Math.min(0.40,(e._dmgNoisePenalty||0)+0.08); // machinery hit — louder
      if(fracHit>0.30) e._dmgSpeedCapMult=Math.max(0.50,(e._dmgSpeedCapMult??1.0)-0.25); // propulsion hit
      if(fracTotal>0.60) e._dmgSensorMult=Math.min((e._dmgSensorMult??1.0),0.65); // cumulative sonar damage
    }
    if(e.hp<=0){
      if(e.civilian){
        game.score-=100; // penalty for destroying civilian shipping
      } else {
        game.score+=(e.role==='ssbn'?500:e.role==='zeta'?400:e.type==="boat"?160:190);
      }
      e.dead=true;
      if(!e.civilian) game._enemiesKilled=(game._enemiesKilled||0)+1;
      // Surface ship kill — trigger hunt state in surviving units
      if(!e.civilian && e.type==='boat') AI.triggerHuntState(e);
      // Permanent wreck marker
      window.G.wrecks.push({x:e.x, y:e.y, type:e.type, t:game.missionT||0});
      // Breaking-up noise is unmistakable — always logged regardless of detection state
      if(e.civilian){
        COMMS.combat.targetDestroyed('civilian');
      } else {
        COMMS.combat.targetDestroyed(e.type);
      }
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
      AI.spawnSub(brg, rand(2800,3800), 'hunter', 0);
      COMMS.tactical.battleStations('single');
      COMMS.tactical.contact(Math.round(((brg*180/Math.PI)+360)%360).toString().padStart(3,'0')+'°');
    } else if(scenario==='ambush'){
      // Wolfpack ambush — already surrounded, close, all prosecuting from the start
      const count=4;
      for(let i=0;i<count;i++){
        const brg=(Math.PI*2/count)*i+rand(-0.3,0.3);
        const role=i<2?'hunter':'interceptor';
        const sub=AI.spawnSub(brg, rand(2500,3500), role, 0);
        // Pre-brief them — they know roughly where the player is
      }
      COMMS.tactical.battleStations('barrier');
    } else if(scenario==='patrol'){
      // Barrier patrol — line of 2 pingers + 2 hunters across a fixed bearing, spread wide
      const barrierBrg=rand(0,Math.PI*2);
      const roles=['pinger','hunter','hunter','pinger'];
      for(let i=0;i<roles.length;i++){
        AI.spawnSub(barrierBrg, rand(4500,6000), roles[i], (i-1.5)*1400);
      }
      COMMS.tactical.battleStations('patrol');
    } else if(scenario==='ssbn_hunt'){
      // Hunt the SSBN — Typhoon-class boomer with SSN escort
      const ssbnBrg=rand(0,Math.PI*2);
      const ssbnDist=rand(5000,7000);
      AI.spawnSSBN(ssbnBrg, ssbnDist);
      // Escort SSN — hunter, positioned between player and SSBN
      const escortBrg=ssbnBrg+rand(-0.4,0.4);
      const escortDist=ssbnDist-rand(1200,2000); // closer to player, screening
      AI.spawnSub(escortBrg, escortDist, 'hunter', rand(-400,400));
      COMMS.tactical.battleStations('ssbn_hunt');
    } else if(scenario==='boss_fight'){
      // Boss fight — single Zeta-class SSN, close enough to be in the fight early
      const brg=rand(0,Math.PI*2);
      AI.spawnZeta(brg, rand(3000,4500));
      COMMS.tactical.battleStations('boss_fight');
    } else if(scenario==='asw_taskforce'){
      // ASW taskforce — surface warships actively hunting the player
      const grpBrg=rand(0,Math.PI*2);
      const grpDist=rand(4000,5500);
      // Kappa destroyer — flagship, centre
      AI.spawnKappa(grpBrg, grpDist, 0);
      // Two Iota frigates — primary ASW, flanking
      AI.spawnIota(grpBrg, grpDist, -1200);
      AI.spawnIota(grpBrg, grpDist, 1200);
      // Lambda corvette — trail screen
      AI.spawnLambda(grpBrg, grpDist+800, rand(-600,600));
      COMMS.tactical.battleStations('asw_taskforce');
    } else if(scenario==='free_run'){
      // No enemies — open water for systems testing
      COMMS.nav.speedReport(0);
    } else {
      game.wave=0; game.waveDelay=0;
      spawnWave(1);
    }
  }

  function tickMasts(dt){
    const cfgs=C.player.masts||[];
    for(let i=0;i<(player.masts||[]).length;i++){
      const m=player.masts[i];
      const cfg=cfgs[i];
      if(!cfg||m.state==='damaged') continue;
      // Transition ticks
      if(m.state==='raising'){
        m.t-=dt;
        if(m.t<=0){ m.state='up'; m.t=0; COMMS.mast?.raised(cfg.label); }
      } else if(m.state==='lowering'){
        m.t-=dt;
        if(m.t<=0){ m.state='down'; m.t=0; }
      }
      // Depth check — applies when up or raising
      if(m.state==='up'||m.state==='raising'){
        if(player.depth>cfg.crushDepth){
          m.state='damaged';
          damagePlayer(10);
          COMMS.mast?.crushed(cfg.label);
        } else if(player.depth>cfg.safeDepth+5){
          if(!m._warnFired){ m._warnFired=true; COMMS.mast?.floodWarning(cfg.label); }
        } else {
          m._warnFired=false;
        }
      } else {
        m._warnFired=false;
      }
    }
  }

  function tickEsmScan(dt){
    const m=(player.masts||[]).find(m=>m.key==='esm');
    if(!m||m.state!=='up') return;
    player._esmScanT=(player._esmScanT||0)-dt;
    if(player._esmScanT>0) return;
    player._esmScanT=rand(4,7);
    const esmRange=C.player.esmRange||12000;
    const contacts=[];
    for(const e of enemies){
      if(e.dead||e.civilian||e.type!=='boat') continue;
      const dx=e.x-player.wx, dy=e.y-player.wy;
      const d=Math.hypot(dx,dy);
      if(d>esmRange) continue;
      const trueBrg=((Math.atan2(dx,-dy)*180/Math.PI)+360)%360;
      const brgNoise=rand(-1.5,1.5)*(d/esmRange);
      const brgDeg=Math.round(((trueBrg+brgNoise)+360)%360);
      const strength=d<3000?'STRONG':d<6000?'MEDIUM':'WEAK';
      contacts.push({brgDeg,strength,subClass:e.subClass});
    }
    if(contacts.length>0) COMMS.mast?.esmContacts(contacts);
  }

  function tickRadarSweep(dt){
    const m=(player.masts||[]).find(m=>m.key==='radar');
    if(!m||m.state!=='up') return;
    player._radarSweepT=(player._radarSweepT||0)-dt;
    if(player._radarSweepT>0) return;
    player._radarSweepT=rand(8,12);
    const radarRange=C.player.radarRange||7000;
    let count=0;
    for(const e of enemies){
      if(e.dead||e.civilian||e.type!=='boat') continue;
      const dx=e.x-player.wx, dy=e.y-player.wy;
      const d=Math.hypot(dx,dy);
      if(d>radarRange) continue;
      // Precise radar fix on enemy
      SENSE.registerFix(e,e.x+rand(-15,15),e.y+rand(-15,15),5,'radar');
      // Enemy detects our emission — bearing fix + suspicion boost
      e.suspicion=Math.min(1,Math.max(e.suspicion,C.enemy.asw?.huntSuspicionFloor||0.70));
      const brgFromE=Math.atan2(player.wy-e.y,player.wx-e.x);
      if(!e.playerBearings) e.playerBearings=[];
      const T=game.missionT||0;
      e.playerBearings.push({fromX:e.x,fromY:e.y,brg:brgFromE+rand(-0.01,0.01),t:T});
      if(e.playerBearings.length>16) e.playerBearings.shift();
      AI.solveEnemyTMA(e);
      count++;
    }
    COMMS.mast?.radarSweep(count);
  }

  function reset(){
    bullets.length=0;particles.length=0;enemies.length=0;decoys.length=0;contacts.length=0;cwisTracers.length=0;wireContacts.length=0;missiles.length=0;
    if(window.G.wrecks) window.G.wrecks.length=0;
    if(window.G.buoys) window.G.buoys.length=0;
    window.G.resetTorpIds();
    if(window.ROUTE) window.ROUTE.length=0;
    game.score=0;game.over=false;game.won=false;game._wonDelayT=0;game._victory=false;game.msg="";game.msgT=0;game.missionT=0;game.msgLog=[];game.sonarLog=[];
    game._ssbnVictory=false;game._bossVictory=false;game._aswVictory=false;game._enemiesKilled=0;
    player.pendingFires=[];
    const spawn=window.MAPS?.getMap()?.playerSpawn||{wx:4000,wy:5000};
    player.wx=spawn.wx; player.wy=spawn.wy;
    player.heading=0; player.speed=0; player.speedOrderKts=0;
    player.depth=260; player.depthOrder=260;
    player.vy=0; player.turnRate=0; player.hp=C.player.hpMax; player.invuln=0;
    player.noise=0; player.noiseTransient=0; player.cavitating=false;
    player.torpCd=0; player.pingCd=0; player.cmCd=0; player.cmStock=C.player.cmStock??12; player.sonarPulse=0; player.periscopeCd=0; player.periscopeT=0;
    // Torpedo tubes: array of per-tube reload countdowns (0 = loaded & ready)
    const nTubes=C.player.torpTubes||4;
    player.torpTubes=[];
    for(let i=0;i<nTubes;i++) player.torpTubes.push(0);
    player.torpStock=C.player.torpStock||12;
    player.battery=1.0; player.snorkeling=false; player.snorkelOrdered=false; player._battDead=false;
    player._snorkelOrderedFired=false; player._snorkelCancelledFired=false;
    player._snorkelNoisyCautionFired=false; player._snorkelT=0; player._lastBatBand='ok';
    player.silent=false; player.emergTurnT=0; player.emergTurnCd=0; player.crashDiveT=0; player.crashDiveCd=0; player.passiveTick=0;
    player._coolantLeak=null; player._steamLeak=null; player._turbineTrip=null; player._flankDepthT=0; player._prevSpeed=0; player._movingDir=1;
    // Per-tube wire tracking — null=no wire, or reference to the live torpedo
    player.tubeWires = new Array(C.player.torpTubes||4).fill(null);
    // Per-tube load type: 'torp' (default), missile key (e.g. 'harpoon'), or null (empty)
    player.tubeLoad = new Array(C.player.torpTubes||4).fill('torp');
    // Current torpedo room operation — only one at a time
    player.tubeOp = null;
    // Missile stock (separate from torpStock)
    player.missileStock = C.player.missileStock || 0;
    // VLS cells — per-cell state array; only populated when vessel has VLS
    const nVls = C.player.vlsCells || 0;
    player.vlsCells = nVls > 0 ? new Array(nVls).fill(null).map(() => ({ state: 'ready' })) : [];
    player.stadimeterT = 0; player.stadimeterTarget = null;
    // Mast state array — one entry per mast defined in C.player.masts
    player.masts=(C.player.masts||[]).map(cfg=>({key:cfg.key,state:'down',t:0,_warnFired:false}));
    player._esmScanT=0; player._radarSweepT=0;
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
    if(waveNum > 1 && window.G.setTacticalState('action')){
      COMMS.crewState.actionStations('wave');
    }
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
    COMMS.tactical.waveReport(waveLabel, count, Math.round(((groupBrg*180/Math.PI)+360)%360).toString().padStart(3,'0')+'°');
  }
  reset();

  function update(dt){
    if(I.justPressed('reload')){ window.location.reload(); }

    if(I.justPressed('damageScreen')||I.justPressed('damageScreenAlt')){ game.showDamageScreen=!game.showDamageScreen; }
    if(I.justPressed('watchChange')){ initiateWatchChange(); }
    if(I.justPressed('actionStations')){ window.PANEL?.callActionStations(); }

    // God mode — restore hp to max every tick so damage can't stick
    if(game.godMode) player.hp=C.player.hpMax;

    player.torpCd=Math.max(0,player.torpCd-dt);
    // Tick tube reload timers (skip wire-occupied tubes: value -1)
    for(let i=0;i<(player.torpTubes||[]).length;i++)
      if(player.torpTubes[i]>0) player.torpTubes[i]=Math.max(0,player.torpTubes[i]-dt);

    // Tick torpedo room operation (load/unload/strike — one at a time)
    if(player.tubeOp){
      const op=player.tubeOp;
      op.progress=Math.min(op.totalT,(op.progress||0)+dt);
      if(op.progress>=op.totalT){
        player.tubeOp=null;
        if(!player._tubeOpDone) player._tubeOpDone=new Set();
        player._tubeOpDone.add(op.tubeIdx);
        const t=op.tubeIdx;
        const isMissile=op.weaponKey&&op.weaponKey!=='torp';
        const wl=isMissile?(C.weapons?.[op.weaponKey]?.shortLabel||op.weaponKey.toUpperCase()):'TORPEDO';
        if(op.type==='load'){
          player.torpTubes[t]=0;
          player.tubeLoad[t]=op.weaponKey;
          COMMS.weapons.loadComplete(t+1,wl);
        } else if(op.type==='unload'){
          player.torpTubes[t]=0;
          const wasLoad=player.tubeLoad[t]||'torp';
          // Return weapon to appropriate stock
          if(wasLoad!=='torp') player.missileStock=(player.missileStock||0)+1;
          else player.torpStock=(player.torpStock||0)+1;
          player.tubeLoad[t]=null;
          COMMS.weapons.unloadComplete(t+1);
        } else if(op.type==='strike'){
          // Return old weapon, load new
          const oldLoad=player.tubeLoad[t]||'torp';
          if(oldLoad!=='torp') player.missileStock=(player.missileStock||0)+1;
          else player.torpStock=(player.torpStock||0)+1;
          player.torpTubes[t]=0;
          player.tubeLoad[t]=op.weaponKey;
          COMMS.weapons.strikeReloadComplete(t+1,wl);
        }
      }
    }


    // Returns true and consumes one tube+stock if a shot can be fired; false otherwise
    // Reserve a tube (starts reload for non-wire shots, or marks as wire-occupied).
    // Returns tube index or -1.
    function reserveTube(){
      const tubes=player.torpTubes;
      const stock=player.torpStock;
      if(!tubes||tubes.length===0) return -1;
      if(typeof stock!=='number'||stock<=0) return -1;
      // Only scan up to tubesAvail — damaged tubes are unavailable
      const avail=DMG.getEffects().tubesAvail??tubes.length;
      let ready=-1;
      const tubeLoad=player.tubeLoad||[];
      for(let i=0;i<Math.min(tubes.length,avail);i++){
        if(tubes[i]===0 && (tubeLoad[i]==null||tubeLoad[i]==='torp')){ready=i;break;}
      }
      if(ready<0) return -1;
      // Tube stays at -1 (wire-occupied) until wire breaks; non-wire starts reload now
      tubes[ready]=-1; // will be set to reloadTime or by _onWireCut
      player.torpStock=stock-1;
      return ready;
    }
    window._reserveTube=reserveTube;
    window._reserveSpecificTube=reserveSpecificTube;

    // Reserve a specific tube by index. Returns idx on success, -1 on failure.
    // Sets player.torpStock only for torpedo loads; missiles handled separately.
    // reason: 'wire'|'reloading'|'empty'|'missile'|'damaged'|'ok'
    function reserveSpecificTube(idx){
      const tubes=player.torpTubes;
      const tubeLoad=player.tubeLoad||[];
      const avail=DMG.getEffects().tubesAvail??tubes.length;
      if(!tubes||idx<0||idx>=tubes.length){ return {idx:-1,reason:'damaged'}; }
      if(idx>=avail){ return {idx:-1,reason:'damaged'}; }
      if(tubes[idx]===-1){ return {idx:-1,reason:'wire'}; }
      if(tubes[idx]>0){ return {idx:-1,reason:'reloading'}; }
      const load=tubeLoad[idx];
      if(load===null||load===undefined){ return {idx:-1,reason:'empty'}; }
      if(load!=='torp'){ return {idx:-1,reason:'missile'}; }
      if((player.torpStock||0)<=0){ return {idx:-1,reason:'empty'}; }
      tubes[idx]=-1;
      player.torpStock--;
      return {idx,reason:'ok'};
    }

    // Returns the weapon label for a tube (for FPP comms)
    function tubeWeaponLabel(tubeIdx){
      const load=(player.tubeLoad||[])[tubeIdx];
      if(!load||load==='torp') return C.weapons?.[C.player.torpWeapon]?.shortLabel||'TORPEDO';
      return C.weapons?.[load]?.shortLabel||load.toUpperCase();
    }

    // ── Tube load management ────────────────────────────────────────────────
    // Load a weapon into an empty tube. Deducts stock immediately on order.
    window._orderLoad=function(tubeIdx,weaponKey){
      if(player.tubeOp){ COMMS.weapons.torpRoomBusy(); return; }
      const tubes=player.torpTubes;
      const t=tubeIdx;
      if(!tubes||t<0||t>=tubes.length){ COMMS.weapons.error('Invalid tube'); return; }
      if(tubes[t]===-1){ COMMS.weapons.error('Wire live — cut first'); return; }
      if(tubes[t]>0){ COMMS.weapons.error('Tube loading'); return; }
      if(player.tubeLoad?.[t]!=null){ COMMS.weapons.error('Tube already loaded'); return; }
      const isMissile=weaponKey&&weaponKey!=='torp';
      if(isMissile){
        const misTypes=C.player.missileTypes||[];
        if(!misTypes.includes(weaponKey)){ COMMS.weapons.error('Weapon not aboard'); return; }
        if((player.missileStock||0)<=0){ COMMS.weapons.error('No missiles in stock'); return; }
        player.missileStock--;
      } else {
        if((player.torpStock||0)<=0){ COMMS.weapons.error('No torpedoes in stock'); return; }
        player.torpStock--;
      }
      const reloadTime=C.player.torpReloadTime||28;
      const totalT=reloadTime*(isMissile?(C.weapons?.[weaponKey]?.reloadMult??1.5):1.0);
      const wl=isMissile?(C.weapons?.[weaponKey]?.shortLabel||weaponKey.toUpperCase()):'TORPEDO';
      player.tubeOp={type:'load',tubeIdx:t,weaponKey:weaponKey||'torp',progress:0,totalT};
      player.torpTubes[t]=totalT;
      COMMS.weapons.loadOrder(t+1,wl);
    };

    // Unload a tube and return the weapon to stock.
    window._orderUnload=function(tubeIdx){
      if(player.tubeOp){ COMMS.weapons.torpRoomBusy(); return; }
      const tubes=player.torpTubes;
      const t=tubeIdx;
      if(!tubes||t<0||t>=tubes.length){ COMMS.weapons.error('Invalid tube'); return; }
      if(tubes[t]===-1){ COMMS.weapons.error('Wire live — cut first'); return; }
      if(tubes[t]>0){ COMMS.weapons.error('Tube busy'); return; }
      if(player.tubeLoad?.[t]==null){ COMMS.weapons.error('Tube already empty'); return; }
      const reloadTime=C.player.torpReloadTime||28;
      const totalT=reloadTime*0.65;
      player.tubeOp={type:'unload',tubeIdx:t,weaponKey:null,progress:0,totalT};
      player.torpTubes[t]=totalT;
      COMMS.weapons.unloadOrder(t+1);
    };

    // Strike reload — swap loaded weapon without emptying first (takes 2.15× reload time).
    window._orderStrikeReload=function(tubeIdx,weaponKey){
      if(player.tubeOp){ COMMS.weapons.torpRoomBusy(); return; }
      const tubes=player.torpTubes;
      const t=tubeIdx;
      if(!tubes||t<0||t>=tubes.length){ COMMS.weapons.error('Invalid tube'); return; }
      if(tubes[t]===-1){ COMMS.weapons.error('Wire live — cut first'); return; }
      if(tubes[t]>0){ COMMS.weapons.error('Tube busy'); return; }
      const isMissile=weaponKey&&weaponKey!=='torp';
      if(isMissile){
        const misTypes=C.player.missileTypes||[];
        if(!misTypes.includes(weaponKey)){ COMMS.weapons.error('Weapon not aboard'); return; }
        if((player.missileStock||0)<=0){ COMMS.weapons.error('No missiles in stock'); return; }
        player.missileStock--;
      } else {
        if((player.torpStock||0)<=0){ COMMS.weapons.error('No torpedoes in stock'); return; }
        player.torpStock--;
      }
      const reloadTime=C.player.torpReloadTime||28;
      const totalT=reloadTime*2.15;
      const wl=isMissile?(C.weapons?.[weaponKey]?.shortLabel||weaponKey.toUpperCase()):'TORPEDO';
      player.tubeOp={type:'strike',tubeIdx:t,weaponKey:weaponKey||'torp',progress:0,totalT};
      player.torpTubes[t]=totalT;
      COMMS.weapons.strikeReloadOrder(t+1,wl);
    };

    // Fire missile from ASCM panel — uses full FPP sequence
    window._fireMissile=function(){
      if(!game.ascmSolution){ COMMS.weapons.noSolution(); return; }
      if((player.pendingFires||[]).length>0){ COMMS.weapons.unableFiring(); return; }
      // Find first ready missile-loaded tube
      const tubeLoad=player.tubeLoad||[];
      let tubeIdx=-1;
      for(let i=0;i<tubeLoad.length;i++){
        if(player.torpTubes[i]===0 && tubeLoad[i] && tubeLoad[i]!=='torp'){ tubeIdx=i; break; }
      }
      if(tubeIdx<0){ COMMS.weapons.error('No missile ready in tube'); return; }
      const missileType=tubeLoad[tubeIdx];
      const cfg=C.weapons?.[missileType];
      if(!cfg){ COMMS.weapons.error('Unknown missile type'); return; }
      const wl=cfg.shortLabel||missileType.toUpperCase();
      const cid=game.ascmSolution.contactId||'';
      const maxD=cfg.maxLaunchDepth??25;
      const overDepth=Math.max(0,player.depth-maxD);
      const launchChance=overDepth===0?1.0:clamp(1-overDepth/(maxD*2),0,1);
      if(overDepth>0) COMMS.weapons.missileDepthWarning(wl,player.depth,maxD);
      if(Math.random()>launchChance){
        // Capsule ejected but failed to surface — weapon lost, tube clear, reload starts
        player.tubeLoad[tubeIdx]=null;
        player.torpTubes[tubeIdx]=Math.round((C.player.torpReloadTime||28)*(DMG.getEffects().reloadMult||1));
        COMMS.weapons.missileLaunchFail(wl);
        return;
      }
      COMMS.weapons.firingProcedures(tubeIdx+1,wl,cid,false);
      player.pendingFires.push({
        t:C.player.fireDelay||4.5,
        tubeIdx, isMissile:true, missileType,
        ascmBearing:game.ascmSolution.bearing,
        ascmRange:game.ascmSolution.range,
        ascmRef:game.ascmSolution.ref,
        weaponLabel:wl, contactId:cid,
        ddx:0, ddy:0, wire:false, launchOffset:0,
      });
    };

    // VLS — fire a ready cell directly (no tube cycle, no pendingFires)
    window._fireVLS=function(cellIdx){
      const cells=player.vlsCells||[];
      if(cellIdx<0||cellIdx>=cells.length) return;
      const cell=cells[cellIdx];
      if(!cell||cell.state!=='ready'){ COMMS.weapons.error('VLS cell not ready'); return; }
      if(!game.ascmSolution){ COMMS.weapons.noSolution(); return; }
      const wType=C.player.vlsWeapon;
      if(!wType){ COMMS.weapons.error('No weapon assigned to VLS'); return; }
      const cfg=C.weapons?.[wType];
      if(!cfg){ COMMS.weapons.error('Unknown VLS weapon type'); return; }
      const wl=cfg.shortLabel||wType.toUpperCase();
      const cid=game.ascmSolution.contactId||'';
      const maxD=cfg.maxLaunchDepth??30;
      const overDepth=Math.max(0,player.depth-maxD);
      const launchChance=overDepth===0?1.0:clamp(1-overDepth/(maxD*2),0,1);
      if(overDepth>0) COMMS.weapons.missileDepthWarning(wl,player.depth,maxD);
      if(Math.random()>launchChance){ COMMS.weapons.vlsLaunchFail(wl,cellIdx+1); return; }
      cell.state='expended';
      const m=window.MSL?.create(wType,player.wx,player.wy,{
        bearing:game.ascmSolution.bearing,
        range:game.ascmSolution.range,
        ref:game.ascmSolution.ref,
      });
      if(m) missiles.push(m);
      COMMS.weapons.vlsFired(cellIdx+1,wl,cid);
    };

    // Stadimeter — start 4s observation from periscope depth
    window._stadimeterStart=function(){
      if(player.depth>C.player.periscopeDepth+4){ COMMS.weapons.error('Not at periscope depth'); return; }
      const asc=game.ascmSolution;
      if(!asc||!asc.ref){ COMMS.weapons.error('No surface contact designated'); return; }
      if(player.stadimeterT>0) return;
      player.stadimeterT=4.0;
      player.stadimeterTarget=asc.ref;
      COMMS.weapons.stadimeterObserve(asc.contactId);
    };

    window._toggleMast=function(key){
      const cfgs=C.player.masts||[];
      const cfg=cfgs.find(c=>c.key===key);
      const m=(player.masts||[]).find(m=>m.key===key);
      if(!m||!cfg||m.state==='damaged') return;
      if(m.state==='down'||m.state==='lowering'){
        m.state='raising'; m.t=cfg.raiseDur;
      } else if(m.state==='up'||m.state==='raising'){
        m.state='lowering'; m.t=cfg.lowerDur;
      }
    };

    // Called when a wire breaks (any reason) — start tube reload
    window.G._onWireCut=(b)=>{
      const tubeWires=player.tubeWires||[];
      for(let i=0;i<tubeWires.length;i++){
        if(tubeWires[i]===b){
          tubeWires[i]=null;
          player.torpTubes[i]=Math.round((C.player.torpReloadTime||28)*(DMG.getEffects().reloadMult||1));
          COMMS.weapons.wireParted(i+1, 'runout');
          break;
        }
      }
      // Wire cut — torpedo flies last commanded bearing, passive seeker searches.
      // No reattack circle — torpedo has no knowledge of a map position, only what its seeker hears.
      if(b && !b.target){
        // Nothing to do — torpedo continues on current heading, seeker runs normally
      }
    };

    // Tick pending fire queue — full firing point procedure
    // Timeline (t counts DOWN from fireDelay=4.5s to 0):
    //   t=4.5  CONN: "firing point procedures, tube N, [weapon], [contact]"  (at push)
    //   t<4.0  WEPS: "[weapon], [contact] — aye. Prepare tube N"
    //   t<3.2  WEPS: "Tube N, flooding down"
    //   t<2.5  WEPS: "Conn, Weps — tube N ready in all respects, outer door open"
    //   t<2.0  WEPS: "Conn, Weps — tube N, solution set"
    //   t<1.4  NAV:  "Ship ready"
    //   t<0.8  WEPS: "Weapon ready"
    //   t<0.2  CONN: "Fire, tube N, [weapon], [contact]"
    //   t<=0   WEPS: "Tube N fired electrically" + SONAR: away
    if(!player.pendingFires) player.pendingFires=[];
    const FD=C.player.fireDelay||4.5;
    for(const pf of player.pendingFires){
      pf.t-=dt;
      const tn=pf.tubeIdx+1;
      const wl=pf.weaponLabel||'TORPEDO';
      const cid=pf.contactId||'';

      if(!pf._log1 && pf.t < FD-0.5){
        pf._log1=true;
        COMMS.weapons.fppAck(tn, wl, cid);
      }
      if(!pf._log2 && pf.t < FD-1.3){
        pf._log2=true;
        COMMS.weapons.floodingDown(tn);
      }
      if(!pf._log3 && pf.t < FD-2.0){
        pf._log3=true;
        COMMS.weapons.tubeReady(tn);
      }
      if(!pf._log4 && pf.t < FD-2.5){
        pf._log4=true;
        COMMS.weapons.solutionSet(tn);
      }
      if(!pf._log5 && pf.t < FD-3.1){
        pf._log5=true;
        COMMS.weapons.shipReady();
      }
      if(!pf._log6 && pf.t < FD-3.7){
        pf._log6=true;
        COMMS.weapons.weaponReady();
      }
      if(!pf._log7 && pf.t < FD-4.3){
        pf._log7=true;
        COMMS.weapons.fireOrder(tn, wl, cid, pf.manual);
      }

      // Launch
      if(pf.t<=0){
        pf.done=true;
        const sx=player.wx+Math.cos(player.heading)*C.player.r*1.35;
        const sy=player.wy+Math.sin(player.heading)*C.player.r*1.35;
        player.noiseTransient=Math.min(1,player.noiseTransient+0.18);
        // TDC error — damaged fire control / TDC adds bearing offset
        const tdcErr=DMG.getEffects().tdcErrDeg||0;
        let {ddx,ddy}=pf;
        if(tdcErr>0){
          const errRad=(Math.random()*2-1)*tdcErr*Math.PI/180;
          const cos=Math.cos(errRad),sin=Math.sin(errRad);
          ddx=pf.ddx*cos-pf.ddy*sin;
          ddy=pf.ddx*sin+pf.ddy*cos;
        }
        if(pf.isMissile){
          // Missile launch — create flight object, empty the tube (no auto-reload)
          const m=window.MSL?.create(pf.missileType, player.wx, player.wy, {bearing:pf.ascmBearing, range:pf.ascmRange, ref:pf.ascmRef});
          if(m){ missiles.push(m); }
          player.tubeLoad[pf.tubeIdx]=null;
          player.torpTubes[pf.tubeIdx]=0;
          COMMS.weapons.missileAway();
        } else if(pf.wire){
          const wireSnapped=W.fireTorpedo(sx,sy,ddx,ddy,true,C.player.torpEnableDist,true,pf.launchOffset,player.depth,pf.fireDepth,C.weapons?.[C.player.torpWeapon]??null);
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
          COMMS.weapons.fired(tn, !wireSnapped);
          if(wireSnapped) COMMS.weapons.wireParted(tn, 'launch');
        } else {
          W.fireTorpedo(sx,sy,ddx,ddy,true,C.player.torpEnableDist,false,0,player.depth,pf.fireDepth,C.weapons?.[C.player.torpWeapon]??null);
          player.torpTubes[pf.tubeIdx]=Math.round((C.player.torpReloadTime||28)*(DMG.getEffects().reloadMult||1));
          COMMS.weapons.fired(tn, false);
        }
        if(!pf.isMissile) COMMS.weapons.away();
      }
    }
    player.pendingFires=player.pendingFires.filter(pf=>!pf.done);

    // ── Pending log queue — staged crew comms ─────────────────────────────────
    if(!player.pendingLogs) player.pendingLogs=[];
    for(const pl of player.pendingLogs){ pl.t-=dt; if(pl.t<=0){ pl.done=true; addLog(pl.station,pl.msg,pl.priority||0); } }
    player.pendingLogs=player.pendingLogs.filter(pl=>!pl.done);

    // ── Reactor SCRAM tick ───────────────────────────────────────────────────
    if(player.scram && !C.player.isDiesel){
      const wasT = player.scramT;
      player.scramT = Math.max(0, player.scramT - dt);
      const t = player.scramT;
      const wT = wasT; // previous value

      // Check whether reactor systems are damaged — suppresses recovery comms
      // if reactor, primary coolant, or pressuriser are not nominal (can't sustain reaction).
      const _rxSys = player.damage?.systems||{};
      const reactorDamaged = _rxSys.reactor !== 'nominal' && _rxSys.reactor != null
                          || _rxSys.primary_coolant === 'offline' || _rxSys.primary_coolant === 'destroyed'
                          || _rxSys.pressuriser === 'offline' || _rxSys.pressuriser === 'destroyed';

      // T+0 — MANV immediate call (fired from triggerScram, not here)
      // T+3 — EPM online
      if(wT>72 && t<=72 && !player.scramEPM){
        player.scramEPM=true;
        COMMS.reactor.epmon();
      }
      // T+8 — ENG start recovery (or hold if damaged)
      if(wT>67 && t<=67){
        if(reactorDamaged){
          COMMS.reactor.scramHoldRepair();
        } else {
          COMMS.reactor.recoveryStart();
        }
      }
      // Recovery progress steps — skipped entirely if reactor is damaged
      if(!reactorDamaged){
        // T+20 — primary coolant circulating
        if(wT>55 && t<=55) COMMS.reactor.recoveryProgress(0);
        // T+35 — pulling rods
        if(wT>40 && t<=40) COMMS.reactor.recoveryProgress(1);
        // T+50 — self-sustaining reaction
        if(wT>25 && t<=25) COMMS.reactor.recoveryProgress(2);
        // T+65 — turbines online
        if(wT>10 && t<=10){
          COMMS.reactor.recoveryProgress(3);
          COMMS.reactor.recoveryProgress(4);
        }
        // T+70 — reactor back in band
        if(wT>5 && t<=5) COMMS.reactor.recoveryProgress(5);
      }
      if(t<=0){
        player.scram=false;
        player.scramEPM=false;
        player.scramCause=null;
        if(!reactorDamaged) COMMS.reactor.online();
        // If damaged: reactor stays offline — maneuvering comms fire when repair completes
      }
    }


    // ── Crash dive depth-passing calls ────────────────────────────────────────
    if((player.crashDiveT??0)>0){
      if(!player._crashDepthCalled) player._crashDepthCalled=new Set();
      const band=Math.floor(player.depth/50)*50;
      if(band>=100 && !player._crashDepthCalled.has(band)){
        player._crashDepthCalled.add(band);
        COMMS.nav.depthReport(band);
      }
    } else if(player._crashDepthCalled?.size>0){
      player._crashDepthCalled=new Set();
    }

    player.pingCd=Math.max(0,player.pingCd-dt);

    // ── Sustained flank at depth — coolant leak risk ─────────────────────────
    // Pushing the reactor hard at depth stresses coolant pipe joints.
    // Instead of instant SCRAM, this now triggers a coolant leak with a countdown.
    if(!C.player.isDiesel){
    {
      const casCfg=C.player.casualties?.coolantLeak||{};
      if(!player.scram && !player._coolantLeak){
        const atFlank  = player.speed >= (C.player.flankKts||28)*0.90;
        const atDepth  = player.depth >= (C.world?.layerY2||280) + 60;
        const coolantDegraded = player.damage?.systems?.primary_coolant === 'degraded';
        if(atFlank && atDepth){
          player._flankDepthT = (player._flankDepthT||0) + dt;
          const threshold = coolantDegraded ? (casCfg.stressThreshold||15)/((casCfg.degradedRiskMult||3)) : (casCfg.stressThreshold||15);
          const risk = clamp((player._flankDepthT - threshold) * (casCfg.riskPerSec||0.008), 0, 0.35) * dt;
          if(risk>0 && Math.random() < risk){
            player._coolantLeak={ timer:casCfg.countdown||45, rolled:false, warned:false };
            COMMS.reactor.coolantLeak();
          }
        } else {
          player._flankDepthT = Math.max(0,(player._flankDepthT||0)-dt*2);
        }
      }
    }

    // ── Coolant leak tick ──────────────────────────────────────────────────────
    if(player._coolantLeak && !player.scram){
      const cl=player._coolantLeak;
      const casCfg=C.player.casualties?.coolantLeak||{};
      // Speed affects countdown rate
      const atFlank = player.speed >= (C.player.flankKts||28)*0.90;
      const runSlow = player.speed <= (C.player.speedMaxKts||20)/3;
      const rate = atFlank ? (casCfg.fastMult||1.5) : runSlow ? (casCfg.slowMult||0.5) : 1.0;
      cl.timer -= dt * rate;

      // Halfway — crew attempts to isolate the leak (single roll)
      if(!cl.rolled && cl.timer <= (casCfg.countdown||45)*0.5){
        cl.rolled=true;
        const fixChance = runSlow ? (casCfg.fixChanceHigh||0.65) : (casCfg.fixChanceLow||0.30);
        if(Math.random() < fixChance){
          // Crew isolated the leak
          COMMS.reactor.coolantLeakIsolated();
          player._coolantLeak=null;
          player._flankDepthT=0;
        } else {
          COMMS.reactor.coolantLeakFailed();
        }
      }
      // Progress report at ~70% remaining
      if(cl && !cl.warned && cl.timer <= (casCfg.countdown||45)*0.7){
        cl.warned=true;
        COMMS.reactor.coolantLeakProgress();
      }
      // Timer expired — automatic SCRAM
      if(cl && cl.timer<=0){
        player._coolantLeak=null;
        player._flankDepthT=0;
        window.G.triggerScram('coolant_leak');
        COMMS.reactor.scram('coolant');
      }
    }

    // ── Steam leak tick ───────────────────────────────────────────────────────
    if(player._steamLeak){
      player._steamLeak.timer -= dt;
      if(player._steamLeak.timer<=0){
        player._steamLeak=null;
        if(!player.scram) COMMS.reactor.steamRestored();
      }
    }

    // ── Turbine trip tick ─────────────────────────────────────────────────────
    if(player._turbineTrip){
      player._turbineTrip.timer -= dt;
      if(player._turbineTrip.timer<=0){
        player._turbineTrip=null;
        if(!player.scram) COMMS.reactor.turbineRecovered();
      }
    }

    // ── Throttle snap — turbine trip from rapid speed changes ──────────────
    {
      const casCfg=C.player.casualties?.turbineTrip||{};
      const threshold=casCfg.throttleSnapThreshold||10;
      const prevSpd=player._prevSpeed??player.speed;
      const spdChange=Math.abs(player.speed-prevSpd)/Math.max(dt,0.016);
      player._prevSpeed=player.speed;
      if(!player._turbineTrip && !player._steamLeak && !player.scram && spdChange>threshold){
        if(Math.random()<(casCfg.throttleSnapChance||0.20)*dt){
          player._turbineTrip={ timer:rand(casCfg.recoveryTime?.[0]||20, casCfg.recoveryTime?.[1]||30) };
          COMMS.reactor.turbineTrip();
        }
      }
    }
    } // end !isDiesel reactor casualty block

    player.cmCd=Math.max(0,player.cmCd-dt);
    player.periscopeCd=Math.max(0,player.periscopeCd-dt);
    tickMasts(dt);
    tickEsmScan(dt);
    tickRadarSweep(dt);
    player.periscopeT=Math.max(0,player.periscopeT-dt);
    player.invuln=Math.max(0,player.invuln-dt);
    DMG.tick(dt);
    tickWatchFatigue(dt);
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
        // DEP: read from sonar contact's smoothed estimate (computed in sensors.js tickContacts).
        // This avoids per-frame noise jitter — the estimate drifts slowly instead.
        tdc.depth = sc?._estDepth ?? null;
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

    // ── ASCM solution — best available surface contact ───────────────────────
    // Promoted from sonarContacts; quality ≥ 0.20 minimum gate.
    // TDC-designated surface contact takes priority over best passive contact.
    {
      const _sc=window.G.sonarContacts;
      let bestE=null, bestSc=null;
      if(_sc) for(const [e,sc] of _sc){
        if(e.dead||e.civilian||e.type!=='boat') continue;
        if((sc.tmaQuality||0)<0.20) continue;
        if(!bestSc||(sc.tmaQuality||0)>(bestSc.tmaQuality||0)){ bestE=e; bestSc=sc; }
      }
      // TDC designation overrides best if it's a valid surface contact
      const tdcE=game.tdc?.target;
      if(tdcE&&tdcE.type==='boat'&&!tdcE.dead){
        const sc=_sc?.get(tdcE);
        if(sc&&(sc.tmaQuality||0)>=0.20){ bestE=tdcE; bestSc=sc; }
      }
      if(bestSc){
        const lb=bestSc.latestBrg;
        const compassBrg=lb!=null?(((Math.atan2(Math.cos(lb),-Math.sin(lb))*180/Math.PI)+360)%360):null;
        game.ascmSolution={
          contactId:bestSc.id,
          bearing:compassBrg,
          range:bestSc._estRange??null,
          quality:bestSc.tmaQuality||0,
          source:'TMA',
          ref:bestE,
        };
      } else {
        game.ascmSolution=null;
      }
    }

    // ── Stadimeter tick ──────────────────────────────────────────────────────
    if(player.stadimeterT>0){
      // Abort if depth rose past PD
      if(player.depth>C.player.periscopeDepth+4){
        player.stadimeterT=0; player.stadimeterTarget=null;
        COMMS.weapons.stadimeterInterrupted();
      } else {
        player.stadimeterT-=dt;
        if(player.stadimeterT<=0){
          player.stadimeterT=0;
          const tgt=player.stadimeterTarget; player.stadimeterTarget=null;
          if(tgt&&!tgt.dead){
            const sc=window.G.sonarContacts?.get(tgt);
            if(sc){
              const dx=tgt.x-player.wx, dy=tgt.y-player.wy;
              const trueRange=Math.hypot(dx,dy);
              const classKnown=(sc._classStage||0)>=3;
              const errPct=classKnown?0.18:0.30;
              const estRange=trueRange*(1+rand(-errPct,errPct));
              sc._estRange=estRange;
              if(game.ascmSolution&&game.ascmSolution.ref===tgt){
                game.ascmSolution.range=estRange;
                game.ascmSolution.source='STADIMETER';
              }
              COMMS.weapons.stadimeterComplete(classKnown);
            } else { COMMS.weapons.stadimeterInterrupted(); }
          } else { COMMS.weapons.stadimeterInterrupted(); }
        }
      }
    }

    // ── Missile flight tick ──────────────────────────────────────────────────
    for(let _mi=missiles.length-1;_mi>=0;_mi--){
      const _m=missiles[_mi];
      const _res=window.MSL?.update(_m,dt,enemies);
      if(_res==='hit'){
        const _e=_m.target;
        // CIWS intercept roll — Slava/Udaloy/Krivak/Grisha all have cwis
        let _intercepted=false;
        if(_e?.cwis){
          const _pk=1-Math.pow(1-(_e.cwis.pKillPerSec||0.6),0.5);
          if(Math.random()<_pk) _intercepted=true;
        }
        if(_intercepted){
          COMMS.weapons.missileDefeat(_e.subClass||'TARGET');
          W.makeExplosion(_m.x,_m.y,0.6,false);
        } else {
          damageEnemy(_e,_m.warheadDmg);
          COMMS.weapons.missileHit(_e.subClass||'TARGET');
        }
        missiles.splice(_mi,1);
      } else if(_res==='miss'){
        COMMS.weapons.missileMiss();
        W.makeExplosion(_m.x,_m.y,0.5,false);
        missiles.splice(_mi,1);
      }
    }

    for(const e of enemies){
      if(e.seen>0) e.seen=Math.max(0,e.seen-dt);
      if(e.detectedT>0) e.detectedT=Math.max(0,e.detectedT-dt);
      if(e.pingPulse>0) e.pingPulse=Math.max(0,e.pingPulse-dt);
      if(e.evadeT>0){e.evadeT=Math.max(0,e.evadeT-dt); if(e.evadeT<=0){e.evadeFrom=null;e.evadeDecoy=null;e._evadePhase=null;e._cfPhase=null;e._cfT=0;e._boldDone=false;}}
      // Golf-class snorkel cycle — diesel SSBN must snorkel to recharge battery
      // Noise spike injected in updateEnemyNoise() via e._snorkeling flag
      if(e.subClass==='GOLF' && e._snorkelCd!==undefined){
        e._snorkelCd-=dt;
        if(e._snorkelCd<=0){
          e._snorkeling=!e._snorkeling;
          e._snorkelCd=e._snorkeling ? rand(60,90) : rand(120,180); // snorkel 60-90s, battery 120-180s
        }
      }
      // Fire adaptation reset — timeout or player course change
      if(e._missCount>0){
        const aCfg=C.enemy.adaptation||{};
        if(e._lastMissT && (game.missionT-e._lastMissT)>(aCfg.resetTimeout??60)) e._missCount=0;
        const hdgDelta=Math.abs(angleNorm(player.heading-(e._lastPlayerHdg??player.heading)))*180/Math.PI;
        if(hdgDelta>(aCfg.resetCourseDeg??30)) e._missCount=0;
      }
      e._lastPlayerHdg=player.heading;
    }

    if(!game.over){
      NAV.updateOrders(dt);
      NAV.stepDynamics(dt);  // handles all movement including player.wx/wy/depth/y
      SIG.updateNoise(dt);

      // Cavitation onset/clearance log
      if(player.cavitating && !player._wasCav){
        COMMS.nav.cavitation(true);
      } else if(!player.cavitating && player._wasCav){
        COMMS.nav.cavitation(false);
      }
      player._wasCav=player.cavitating;

      // Tube reload-complete log (skip wire-occupied tubes: value -1, skip manual op completions)
      for(let i=0;i<(player.torpTubes||[]).length;i++){
        const prev=player._prevTubes?.[i]??0;
        const cur=player.torpTubes[i];
        if(prev>0 && cur===0 && player.torpStock>=0 && !player._tubeOpDone?.has(i)){
          COMMS.weapons.reloaded(i+1);
        }
      }
      if(player._tubeOpDone) player._tubeOpDone.clear();
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
      I.aimWorldX=cam.x+(I.mouseX-(canvas.width-C.layout.depthStripW*DPR)/2)/(Z*DPR);
      I.aimWorldY=cam.y+(I.mouseY-(canvas.height-C.layout.panelH*DPR)/2)/(Z*DPR);
      // Periscope (O) — scope_atk must be raised, shallow only
      if(I.justPressed('periscope') && player.periscopeCd<=0){
        const scopeMast=(player.masts||[]).find(m=>m.key==='scope_atk');
        if(DMG.getEffects().periscopeOk===false||(scopeMast&&scopeMast.state==='damaged')){
          COMMS.ui?.periscopeDamaged?.();
        } else if(scopeMast&&scopeMast.state!=='up'){
          COMMS.ui.periscopeTooDeep(); // reuse message — "scope not raised"
        } else if(player.depth>C.player.periscopeDepth+4){
          COMMS.ui.periscopeTooDeep();
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
              // Visual fix — feeds sonarContacts so ASCM solution and stadimeter work.
              // Bearing is exact (optical); range has ±20% noise (rough visual estimate —
              // the stadimeter procedure tightens this).
              const scopeBrg = Math.atan2(dy, dx); // math angle from player to ship
              const noisyD = d * (1 + (Math.random()*0.40 - 0.20));
              SENSE.registerFix(e,
                player.wx + Math.cos(scopeBrg)*noisyD,
                player.wy + Math.sin(scopeBrg)*noisyD,
                40, 'periscope');
              shown++;
            }
          }
          COMMS.ui.scopeReport(shown);
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
            COMMS.combat.torpedoInWater(brgStr);
            // Auto action stations on torpedo detection
            if(window.G.setTacticalState('action')){
              COMMS.crewState.actionStations('torpedo');
            }
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
            COMMS.combat.seekerActive(brgStr);
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
            COMMS.combat.torpedoClosing(brgStr, recipDeg);
          }
        }

        // ── Phase 4: ATTACK — seeker locked on player ─────────────────────────
        if(b._crewPhase<4 && b._crewPhase>=2){
          if(b.target===player){
            b._crewPhase=4;
            const torpRelAng=angleNorm(brgMath-player.heading);
            const turnDir=torpRelAng>0?'LEFT':'RIGHT';
            const recipDeg2=Math.round((brgDeg+180)%360).toString().padStart(3,'0');
            COMMS.combat.weaponAcquisition(brgStr, recipDeg2);
            contacts.push({fromX:player.wx,fromY:player.wy,bearing:brgMath,u_brg:0.04,life:4.0,kind:'torpedo'});
          }
        }
      }
      if(I.justPressed('activePing')&&player.pingCd<=0){ if(player.scram){ COMMS.ui.sonarOffline(); } else { SENSE.activePing(); COMMS.ui.ping(); } }
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
            COMMS.nav.towedArrayOverspeed(player.speed);
          }
        } else {
          ta._warnedSpeed = false;
        }
      }

      // Resolve firing tube — selected tube first, fall back to reserveTube()
      function resolveTube(){
        const sel=game.wirePanel?.selectedTube??-1;
        if(sel>=0){
          const r=reserveSpecificTube(sel);
          if(r.reason==='missile'){ COMMS.weapons.error('Missile load — use ASCM panel'); return -1; }
          if(r.reason==='wire'){    COMMS.weapons.error('Wire live on selected tube'); return -1; }
          if(r.reason==='empty'){   COMMS.weapons.error('Selected tube empty'); return -1; }
          if(r.reason==='damaged'){ COMMS.weapons.error('Tube damaged / unavailable'); return -1; }
          if(r.reason==='reloading'){ COMMS.weapons.error('Selected tube reloading'); return -1; }
          if(r.idx>=0) return r.idx;
        }
        // Fallback — scan for first ready torpedo tube
        return reserveTube();
      }

      // Shift+LMB = MANUAL OVERRIDE — fire on aimed bearing regardless of WEPS solution
      if(I.torpAimClick){
        I.torpAimClick=false;
        if((player.pendingFires||[]).length>0){
          COMMS.weapons.unableFiring();
        } else {
        const tubeIdx=resolveTube();
        if(tubeIdx>=0){
          const tdc=game.tdc;
          const aimDx=I.aimWorldX-player.wx, aimDy=I.aimWorldY-player.wy;
          const d=Math.max(1e-6,Math.hypot(aimDx,aimDy));
          const ddx=aimDx/d, ddy=aimDy/d;
          const launchOffset=Math.abs(angleNorm(Math.atan2(ddy,ddx)-player.heading));
          const fireDepth=tdc.target ? (tdc.depth!=null?tdc.depth:player.depth) : player.depth;
          const wl=tubeWeaponLabel(tubeIdx);
          const cid=game.tdc.targetId||'';
          COMMS.weapons.firingProcedures(tubeIdx+1, wl, cid, true);
          player.pendingFires.push({t:C.player.fireDelay, tubeIdx, ddx, ddy, launchOffset, fireDepth, wire:true, lockedTarget:game.tdc.target, manual:true, weaponLabel:wl, contactId:cid});
        } else {
          if(player.torpStock<=0) COMMS.weapons.error('No torpedoes remaining');
        }
        } // end pendingFires gate
      }

      // F = quick fire straight ahead, no wire
      if(I.justPressed('fireTorpedo')){
        if((player.pendingFires||[]).length>0){
          COMMS.weapons.unableFiring();
        } else {
        const tubeIdx=resolveTube();
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
          const wlF=tubeWeaponLabel(tubeIdx);
          const cidF=game.tdc.targetId||'';
          COMMS.weapons.firingProcedures(tubeIdx+1, wlF, cidF, false);
          player.pendingFires.push({t:C.player.fireDelay, tubeIdx, ddx, ddy, launchOffset:0, fireDepth, wire:false, weaponLabel:wlF, contactId:cidF});
        } else {
          if(player.torpStock<=0) COMMS.weapons.error('No torpedoes remaining');
        }
        } // end pendingFires gate
      }

      // X = deploy noisemaker
      if(I.justPressed('countermeasure')&&player.cmCd<=0){
        if((player.cmStock??1)>0){
          player.cmStock--;
          player.cmCd=C.player.cmCd;
          W.deployDecoy(player.wx,player.wy,true,"noisemaker",{depth:player.depth});
          player.noiseTransient=Math.min(1,player.noiseTransient+0.10);
          COMMS.weapons.countermeasures();
        } else {
          COMMS.weapons.error('No countermeasures remaining');
        }
      }
    }

    // ── Civilian ship spawning — random traffic in all combat scenarios ────────
    if(game.scenario!=='free_run'){
      game._civSpawnT=(game._civSpawnT||0)-dt;
      if(game._civSpawnT<=0){
        game._civSpawnT=rand(40,90); // spawn every 40-90s
        const civCount=enemies.filter(e=>e.civilian&&!e.dead).length;
        if(civCount<4){ // cap at 4 civilians at a time
          const types=['TANKER','CARGO','CARGO','FISHING','FISHING','FERRY'];
          AI.spawnCivilian(types[Math.floor(Math.random()*types.length)]);
        }
      }
      // Remove civilians that have left the world bounds (far from player)
      for(let i=enemies.length-1;i>=0;i--){
        const e=enemies[i];
        if(!e.civilian) continue;
        const dx=AI.wrapDx(player.wx,e.x), dy=e.y-player.wy;
        if(Math.hypot(dx,dy)>world.w*0.45) enemies.splice(i,1);
      }
    }

    // ── Sonobuoy tick — independent sensors dropped by ASW ships ──────────────
    for(let i=buoys.length-1;i>=0;i--){
      const b=buoys[i];
      b.life-=dt;
      if(b.life<=0 || (b.parent && b.parent.dead)){ buoys.splice(i,1); continue; }
      // Active buoy pings
      b.pingCd=(b.pingCd||0)-dt;
      b.pingPulse=Math.max(0,(b.pingPulse||0)-dt);
      if(b.pingCd<=0){
        b.pingCd=rand(b.pingInterval[0],b.pingInterval[1]);
        b.pingPulse=1.0;
        // Check if player is within buoy detection range
        const dxp=AI.wrapDx(player.wx,b.x), dyp=player.wy-b.y;
        const dp=Math.hypot(dxp,dyp);
        const buoyRange=1600; // Soviet sonobuoys (RGB series) — shorter range than NATO DIFAR
        // Buoy is below layer — no layer penalty against deep targets
        const sonarDepth=b.depth||300;
        const layer=AI.layerPenalty(player.depth,sonarDepth);
        if(dp<buoyRange && layer>=0.85){
          // Buoy gets a return — feed data to parent ship from buoy's position
          const parent=b.parent;
          if(parent && !parent.dead){
            AI.enemyUpdateContactFromPing(parent,player.wx,player.wy,dp,{x:b.x,y:b.y,depth:b.depth});
            if(parent.pingPulse<=0) parent.pingPulse=0.6;
            AI.shipShareContact(parent,player.wx,player.wy,160+dp*0.10);
          }
        }
      }
    }

    // ── Sonobuoy deployment — ASW ships drop buoys along their track ─────────
    for(const e of enemies){
      if(e.dead || e.civilian || !e._sonobuoyCfg) continue;
      const cfg=e._sonobuoyCfg;
      e._buoyDropT=(e._buoyDropT||rand(cfg.interval[0],cfg.interval[1]))-dt;
      if(e._buoyDropT<=0){
        e._buoyDropT=rand(cfg.interval[0],cfg.interval[1]);
        const activeBuoys=buoys.filter(b=>b.parent===e).length;
        if(activeBuoys<cfg.maxActive){
          buoys.push({
            x:e.x, y:e.y, depth:cfg.buoyDepth||300,
            life:cfg.buoyLife||120,
            pingCd:rand(cfg.pingCd[0],cfg.pingCd[1]),
            pingInterval:cfg.pingCd,
            pingPulse:0,
            parent:e,
          });
          // Player hears the splash — bearing from player to buoy
          const bdx=AI.wrapDx(player.wx,e.x), bdy=e.y-player.wy;
          if(Math.hypot(bdx,bdy)<4000){
            const bbrg=((Math.atan2(bdx,bdy)*180/Math.PI)+360)%360;
            COMMS.tactical.buoySplash(Math.round(bbrg).toString().padStart(3,'0')+'°');
          }
        }
      }
    }

    // ── ASW Helicopter tick — dipping sonar platform ─────────────────────────
    for(const e of enemies){
      if(e.dead || e.civilian || !e._heloCfg) continue;
      if(!e._helo) e._helo={state:'deck', x:e.x, y:e.y, fuelT:e._heloCfg.fuel||120, refuelT:0, pingCd:rand(6,10), pingPulse:0, torpCd:rand(20,40), torpStock:e._heloCfg.torpStock??0};
      const h=e._helo;
      h.pingPulse=Math.max(0,(h.pingPulse||0)-dt);
      h.torpCd=Math.max(0,(h.torpCd||0)-dt);
      const heloSpd=80; // ~80 wu/s — fast transit
      const cfg=e._heloCfg;

      if(h.state==='deck'){
        h.x=e.x; h.y=e.y;
        if(h.refuelT>0){ h.refuelT-=dt; }
        else {
          // Launch when parent has suspicion
          if(e.suspicion>=(cfg.launchSus||0.15) && e.contact){
            h.state='transit';
            h.targetX=e.contact.x; h.targetY=e.contact.y;
            h.fuelT=cfg.fuel||120;
            // Player hears helicopter launch — bearing from player to ship
            const hdx=AI.wrapDx(player.wx,e.x), hdy=e.y-player.wy;
            if(Math.hypot(hdx,hdy)<5000){
              const hbrg=((Math.atan2(hdx,hdy)*180/Math.PI)+360)%360;
              COMMS.tactical.heloContact(Math.round(hbrg).toString().padStart(3,'0')+'°');
            }
          }
        }
      } else if(h.state==='transit'){
        h.fuelT-=dt;
        const dx=AI.wrapDx(h.x,h.targetX), dy=h.targetY-h.y;
        const d=Math.hypot(dx,dy);
        if(d<150){
          h.state='hover';
          // Player hears dipping sonar deploy — bearing from player to helo
          const ddx=AI.wrapDx(player.wx,h.x), ddy=h.y-player.wy;
          if(Math.hypot(ddx,ddy)<4000){
            const dbrg=((Math.atan2(ddx,ddy)*180/Math.PI)+360)%360;
            COMMS.tactical.dipSonar(Math.round(dbrg).toString().padStart(3,'0')+'°');
          }
        } else {
          const ang=Math.atan2(dy,dx);
          h.x=h.x+Math.cos(ang)*heloSpd*dt;
          h.y=h.y+Math.sin(ang)*heloSpd*dt;
        }
        if(h.fuelT<=20) h.state='rth'; // bingo fuel
      } else if(h.state==='hover'){
        h.fuelT-=dt;
        // Dipping sonar — ping from below the layer
        h.pingCd-=dt;
        if(h.pingCd<=0){
          h.pingCd=rand(6,10);
          h.pingPulse=1.0;
          const dxp=AI.wrapDx(player.wx,h.x), dyp=player.wy-h.y;
          const dp=Math.hypot(dxp,dyp);
          const dipRange=1900; // Ka-27 dipping sonar (VGS-3) — shorter range than NATO LAMPS
          const dipDepth=cfg.dipDepth||340;
          const layer=AI.layerPenalty(player.depth,dipDepth);
          if(dp<dipRange && layer>=0.85){
            AI.enemyUpdateContactFromPing(e,player.wx,player.wy,dp,{x:h.x,y:h.y,depth:dipDepth});
            AI.shipShareContact(e,player.wx,player.wy,160+dp*0.10);
          }
        }
        // Re-target if parent has updated contact
        if(e.contact){
          const dxc=AI.wrapDx(h.x,e.contact.x), dyc=e.contact.y-h.y;
          if(Math.hypot(dxc,dyc)>500){
            h.targetX=e.contact.x; h.targetY=e.contact.y;
            h.state='transit';
          }
        }

        // ── Torpedo drop — armed ASW torpedo, search pattern from datum ────
        // Helo has direct sensor contact — don't need full ship TMA gate.
        // Fresh contact + adequate suspicion is sufficient for a drop.
        const _heloContactAge = e.contact ? (now() - e.contact.t) : 999;
        if(cfg.hasTorp && h.torpStock>0 && h.torpCd<=0 &&
           e.contact && _heloContactAge<12 && e.suspicion>=0.45){
          const ddx=AI.wrapDx(h.x,e.contact.x), ddy=e.contact.y-h.y;
          if(Math.hypot(ddx,ddy)<1800){
            W.fireTorpedo(h.x,h.y, ddx,ddy, false,0, false,0, 5,cfg.dipDepth,
              {life:90, speed:38, seekRange:380, dmg:28});
            h.torpStock--;
            h.torpCd=rand(40,70);
            // Player sonar report if within earshot
            const pdx=AI.wrapDx(player.wx,h.x), pdy=h.y-player.wy;
            if(Math.hypot(pdx,pdy)<4500){
              const brg=Math.round(((Math.atan2(pdx,pdy)*180/Math.PI)+360)%360);
              COMMS.tactical.heloDrop(brg.toString().padStart(3,'0')+'°');
            }
          }
        }

        if(h.fuelT<=20) h.state='rth'; // bingo fuel
      } else if(h.state==='rth'){
        h.fuelT-=dt*0.5; // conserve fuel on return
        const dx=AI.wrapDx(h.x,e.x), dy=e.y-h.y;
        const d=Math.hypot(dx,dy);
        if(d<100){
          h.state='deck';
          h.refuelT=cfg.refuel||75;
        } else {
          const ang=Math.atan2(dy,dx);
          h.x=h.x+Math.cos(ang)*heloSpd*dt;
          h.y=h.y+Math.sin(ang)*heloSpd*dt;
        }
        if(h.fuelT<=0){ h.state='deck'; h.refuelT=cfg.refuel||75; }
      }
      // If parent ship is sunk while helo is airborne, helo is lost
      if(e.dead && h.state!=='deck'){ h.state='deck'; h.fuelT=0; }
    }

    // enemies
    for(const e of enemies){
      // ── Civilian ships — simple straight-line transit, no combat AI ──────────
      if(e.civilian){
        AI.updateEnemyNoise(e);
        e.x=e.x+e.vx*dt;
        e.y=e.y+e.vy*dt;
        // Occasional gentle heading change (fishing boats more erratic)
        e.navT=(e.navT||0)-dt;
        if(e.navT<=0){
          const maxTurn=e.civType==='FISHING'?Math.PI*0.4:Math.PI*0.08;
          e.heading=(e.heading||0)+rand(-maxTurn,maxTurn);
          const spd=Math.hypot(e.vx,e.vy);
          e.vx=Math.cos(e.heading)*spd;
          e.vy=Math.sin(e.heading)*spd;
          e.navT=e.civType==='FISHING'?rand(30,90):rand(120,400);
        }
        continue; // skip all combat AI
      }

      AI.enemyMaybeHearPlayer(e,dt);
      AI.enemyDecay(e,dt);
      AI.updateEnemyNoise(e);
      if(e.type==='boat') AI.shipActiveSonar(e,dt);

      const state=(e.suspicion>C.enemy.susEngage)?"engage":(e.suspicion>C.enemy.susInvestigate?"investigate":"patrol");

      if(e.type==="boat"){
        // ── Surface ships: 2D top-down movement using heading + physics model ──
        e.x+=e.vx*dt;
        e.y+=e.vy*dt;
        e.hitY=0;

        // Initialise heading from spawn velocity on first frame
        if(!e._boatInit){
          const spd=Math.hypot(e.vx,e.vy);
          if(spd>0.1) e.heading=Math.atan2(e.vy,e.vx);
          e._patrolSpd=spd||12;
          e._boatInit=true;
        }

        const patrolSpd=e._patrolSpd||12;
        const contactAge=e.contact?(now()-e.contact.t):999;
        const maxTurnRate=(e._turnRate??0.06)*dt; // rad/frame — same model as subs

        let desiredHeading=e.heading||0;
        let targetSpd=patrolSpd;

        // ── DC Attack state machine ───────────────────────────────────────────
        // States: idle → run → drop → reform
        if(!e._atkState) e._atkState='idle';
        e._dropCd=Math.max(0,(e._dropCd||0)-dt);
        e._atkCooldown=Math.max(0,(e._atkCooldown||0)-dt);

        if(e._atkState==='idle'){
          // ── Idle steering: contact chase → hunt-state search → normal wander ──
          if(state!=='patrol' && e.contact && contactAge<30){
            // Fresh contact — steer toward it, reset sector search
            const cdx=AI.wrapDx(e.x,e.contact.x), cdy=e.contact.y-e.y;
            desiredHeading=Math.atan2(cdy,cdx);
            e._atDatum=false;
          } else if(e._huntState && e._huntDatum){
            // Hunt state with no fresh contact — datum hold then sector expand
            const asw=C.enemy.asw;
            const hdx=AI.wrapDx(e.x,e._huntDatum.x), hdy=e._huntDatum.y-e.y;
            const distToDatum=Math.hypot(hdx,hdy);
            if(!e._atDatum){
              // Phase 1: return to datum
              if(distToDatum>200){
                desiredHeading=Math.atan2(hdy,hdx);
              } else {
                e._atDatum=true;
                e._datumHoldT=asw.datumHoldTime;
                e._sectorRange=0;
              }
            } else {
              e._datumHoldT=Math.max(0,(e._datumHoldT||0)-dt);
              if(e._datumHoldT>0){
                // Phase 2: datum hold — slow orbit in place
                if(distToDatum>250){
                  desiredHeading=Math.atan2(hdy,hdx);
                } else {
                  e.navT=(e.navT||0)-dt;
                  if(e.navT<=0){ e._idleHeading=Math.random()*Math.PI*2; e.navT=rand(20,40); }
                  desiredHeading=e._idleHeading??e.heading;
                }
              } else {
                // Phase 3: sector search — expand outward on assigned bearing
                if(e._sectorBearing!=null){
                  e._sectorRange=(e._sectorRange||0)+asw.sectorExpandRate*dt;
                  const sweepT=(game.missionT||0)*0.06;
                  const sectorArc=e._sectorArc||(asw.sectorArcDeg*Math.PI/180);
                  const sweepAngle=Math.sin(sweepT+e._sectorBearing*2)*sectorArc*0.45;
                  const tgtX=e._huntDatum.x+Math.cos(e._sectorBearing+sweepAngle)*e._sectorRange;
                  const tgtY=e._huntDatum.y+Math.sin(e._sectorBearing+sweepAngle)*e._sectorRange;
                  const sdx=AI.wrapDx(e.x,tgtX), sdy=tgtY-e.y;
                  desiredHeading=Math.atan2(sdy,sdx);
                } else {
                  // Support/screen ship — orbit near coordinator
                  const coord=enemies.find(s=>s!==e&&!s.dead&&!s.civilian&&s.type==='boat'&&s.role==='pinger'&&s._huntState);
                  e.navT=(e.navT||0)-dt;
                  if(e.navT<=0){
                    if(coord){
                      const ang=Math.atan2(coord.y-e.y,AI.wrapDx(e.x,coord.x));
                      e._idleHeading=ang+rand(-0.8,0.8);
                    } else {
                      e._idleHeading=Math.random()*Math.PI*2;
                    }
                    e.navT=rand(60,120);
                  }
                  desiredHeading=e._idleHeading??e.heading;
                }
              }
            }
          } else {
            // Normal patrol wander
            e.navT=(e.navT||0)-dt;
            if(e.navT<=0){
              e._idleHeading=Math.random()*Math.PI*2;
              e.navT=rand(40,100);
            }
            desiredHeading=e._idleHeading??e.heading;
          }
          // Commit to an attack run when: decent contact, sub is deep enough, not on cooldown
          if(e.contact && contactAge<25 && e.suspicion>=0.32
             && player.depth>80 && e._atkCooldown<=0){
            e._atkAim={x:e.contact.x, y:e.contact.y};
            e._atkDropsLeft=Math.round(rand(3,6));
            e._atkRunSpd=clamp(patrolSpd*rand(1.3,1.6),22,55);
            e._atkState='run';
          }

        } else if(e._atkState==='run'){
          // Committed attack run — charge toward datum
          if(e.contact && contactAge<6){
            e._atkAim.x=e.contact.x;
            e._atkAim.y=e.contact.y;
          }
          if(contactAge>40){ e._atkState='idle'; }
          else {
            const cdx=AI.wrapDx(e.x,e._atkAim.x), cdy=e._atkAim.y-e.y;
            desiredHeading=Math.atan2(cdy,cdx);
            targetSpd=e._atkRunSpd;
            if(Math.hypot(cdx,cdy)<120){ e._atkState='drop'; e._dropCd=0; }
          }

        } else if(e._atkState==='drop'){
          // Dropping stick — maintain attack speed, drop at intervals
          if(e._dropCd<=0 && e._atkDropsLeft>0){
            W.dropDepthCharge(
              e.x+rand(-35,35),
              0,                              // drop from surface
              player.depth+rand(-100,100)     // target estimated depth
            );
            e._atkDropsLeft--;
            e._dropCd=rand(0.7,1.1);
          }
          if(e._atkDropsLeft<=0){
            e._atkState='reform';
            e._atkReformT=rand(20,40);
            e._atkCooldown=rand(15,30); // prevent immediate re-attack
          }

        } else if(e._atkState==='reform'){
          // Post-attack: maintain course, slow back to patrol speed
          e._atkReformT-=dt;
          if(e._atkReformT<=0) e._atkState='idle';
          targetSpd=patrolSpd;
        }

        // ── Apply heading turn (rate-limited, same model as subs) ────────────
        const headingErr=angleNorm(desiredHeading-(e.heading||0));
        e.heading=(e.heading||0)+clamp(headingErr,-maxTurnRate,maxTurnRate);

        // ── Apply speed (tau-based acceleration, same model as subs) ─────────
        const curSpd=Math.hypot(e.vx,e.vy);
        const shipTau=curSpd<targetSpd?60:30;
        const newSpd=curSpd+(targetSpd-curSpd)/shipTau*dt;
        e.vx=Math.cos(e.heading)*newSpd;
        e.vy=Math.sin(e.heading)*newSpd;

        // ── ASROC fire — range-gated missile torpedo on contact (own or shared) ─
        if(e._hasAsroc){
          const acfg=C.enemy.asroc;
          e._asrocCd=Math.max(0,(e._asrocCd||rand(acfg.fireCd[0],acfg.fireCd[1]))-dt);
          if(e._asrocCd<=0 && e.contact && !game.over){
            const aAge=now()-e.contact.t;
            if(aAge<acfg.contactMaxAge && e.suspicion>=acfg.susThresh){
              const adx=AI.wrapDx(e.x,e.contact.x), ady=e.contact.y-e.y;
              const adist=Math.hypot(adx,ady);
              if(adist>=acfg.minRange && adist<=acfg.maxRange){
                W.fireMissileTorpedo(e.x,e.y,e.contact.x,e.contact.y);
                e._asrocCd=rand(acfg.fireCd[0],acfg.fireCd[1]);
                COMMS.tactical.asrocLaunch?.();
              }
            }
          }
        }

        // ── Torpedo fire (close-range, requires TMA solution) ────────────────
        e.fireCd-=dt;
        if(e.fireCd<=0 && !game.over && e.contact){
          const t=(state==="engage")?C.enemy.boatFireEngage:C.enemy.boatFireOther;
          e.fireCd=rand(t[0],t[1]);
          const dx=AI.wrapDx(e.x,e.contact.x);
          const d=Math.hypot(dx,e.contact.y-e.y);
          if(d<1650 && AI.enemyHasFireSolution(e) && (e._torpStock??0)>0){
            W.fireTorpedo(e.x,e.y,dx,e.contact.y-e.y,false,260,false,0,0,null,{
              speed:C.enemy.boatTorpSpeed??38, life:C.enemy.boatTorpLife??90,
              dmg:C.enemy.boatTorpDmg??28, seekRange:C.enemy.boatTorpSeek??380,
            });
            e._torpStock--;
          }
        }

        // ── Torpedo reaction — noisemaker decoys + speed jink ─────────────────
        e.flareCd=Math.max(0,(e.flareCd||0)-dt);
        for(const b of bullets){
          if(b.kind!=="torpedo"||!b.friendly||b.life<=0||b._alertedEnemy===e) continue;
          const dx=AI.wrapDx(e.x,b.x);
          const dy=b.y-e.hitY;
          const dd=Math.hypot(dx,dy);
          if(dd>C.enemy.boatTorpReactR) continue;
          const signal=0.90*(1-dd/C.enemy.boatTorpReactR);
          const pDetect=clamp(0.12+signal*0.65,0,0.90)*dt;
          if(Math.random()>pDetect) continue;
          b._alertedEnemy=e;
          e.suspicion=Math.min(1,e.suspicion+0.15);
          if(e.flareCd<=0){
            e.flareCd=rand(3.5,6.0);
            W.deployDecoy(wrapX(e.x+rand(-30,30)),e.hitY+rand(10,30),false,"noisemaker",{vx:rand(-2,2),vy:rand(2,5)});
            COMMS.ui.shipCountermeasures();
          }
        }
      } else {
        // ── Enemy submarine movement ─────────────────────────────────────────
        e.x=e.x+e.vx*dt;
        e.y=e.y+e.vy*dt;

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
            e._boldDone = false;

            // Layer exploitation — sometimes skip for speed-priority evasion
            const evCfg = C.enemy.evasion||{};
            if(Math.random() >= (evCfg.skipLayerChance??0.25)){
              const layerMid = ((world.layerY1||180)+(world.layerY2||280))/2;
              const torpDepth = e.evadeFrom ? (e.evadeFrom.depth??300) : 300;
              if(torpDepth < layerMid){
                e.depthOrder = rand((world.layerY2||280)+60, (world.layerY2||280)+300);
              } else {
                e.depthOrder = rand(40, (world.layerY1||180)-40);
              }
            }
            // else: keep current depthOrder — prioritise speed over depth
            e.depthChangeT = 999; // hold this depth through full evasion
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
              const evCfg=C.enemy.evasion||{};
              e._evadePhase='knuckle';
              e._evadePhaseT=rand(evCfg.knuckleDurMin??3, evCfg.knuckleDurMax??10);
            }
          } else if(e._evadePhase==='knuckle'){
            // Hold heading, cut speed — create turbulent knuckle, drop CM here
            // Bold maneuver: small chance to turn TOWARD torpedo briefly (creates confusion)
            const evCfg=C.enemy.evasion||{};
            if(!e._boldDone && Math.random()<(evCfg.boldManeuverChance??0.15)*dt){
              e._boldDone=true;
              desiredHeading = angleNorm(awayAng + Math.PI); // toward torpedo
            } else {
              desiredHeading = curH; // don't turn — let knuckle form
            }
            if(e._evadePhaseT<=0){
              e._evadePhase='sprint2';
              e._evadePhaseT=rand(12,20);
              // New heading: configurable arc offset from original away angle
              const arcMin=(evCfg.sprint2ArcMin??60)*Math.PI/180;
              const arcMax=(evCfg.sprint2ArcMax??180)*Math.PI/180;
              const sideFlip = Math.random()<0.5 ? 1 : -1;
              e._sprint2Heading = angleNorm(awayAng + sideFlip*rand(arcMin, arcMax));
            }
          } else { // sprint2
            desiredHeading = e._sprint2Heading ?? angleNorm(awayAng + Math.PI/2);
            if(e._evadePhaseT<=0){
              e._evadePhase=null; // evasion sequence complete
            }
          }
          e.navT=0.5;

        } else if(e.role==='ssbn' && (state==='engage'||state==='investigate') && e.contact){
          // SSBN EVASION: run away, go deep, deploy CMs — never hunt
          const dx=AI.wrapDx(e.x,e.contact.x), dy=e.contact.y-e.y;
          const awayBrg=Math.atan2(-dy,-dx);
          desiredHeading=angleNorm(awayBrg+rand(-0.3,0.3));
          // Drive deep — head for crush depth
          if(!e._ssbnEvading){
            e._ssbnEvading=true;
            e.depthOrder=rand(400,500);
          }
          e.tmaPhase='drift'; // never sprint — stay quiet

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
              // Contact-loss silence: if contact stale and suspicion low, hold quiet to listen
              const contactFresh=e.contact&&(now()-e.contact.t<C.enemy.contactMaxAge*0.5);
              if(!contactFresh && e.suspicion<0.35){
                // Stay in drift — go silent and wait for passive to pick something up
                e.navT=rand(25,45);
              } else {
                // Switch to cross-track sprint — always alternate direction for better baseline
                e.tmaPhase='sprint';
                e.tmaManeuverDir=-(e.tmaManeuverDir||1);
                e.navT=rand(25,40);
              }
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
                e.tmaManeuverDir=-(e.tmaManeuverDir||1);
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
            if(e.role==='ssbn'){
              // SSBNs patrol on long straight legs, biased AWAY from player
              e._ssbnEvading=false; // reset evasion flag
              e.navT=rand(300,500); // very long legs
              const tdx=AI.wrapDx(e.x,player.wx), tdy=player.wy-e.y;
              const awayFromPlayer=Math.atan2(-tdy,-tdx);
              e.patrolHeading=angleNorm(awayFromPlayer+rand(-0.6,0.6));
            } else if(e.role==='pinger'){
              // Pingers maintain cross-track barrier pattern
              e.patrolHeading=angleNorm((e.patrolHeading??e.heading??0)+rand(-maxPatrolTurn,maxPatrolTurn));
            } else {
              // Compute direction toward player, bias new heading that way
              const tdx=AI.wrapDx(e.x,player.wx), tdy=player.wy-e.y;
              const towardPlayer=Math.atan2(tdy,tdx);
              // Blend: 60% toward player, 40% random drift — stays roughly convergent
              const biased=angleNorm(towardPlayer+rand(-maxPatrolTurn,maxPatrolTurn));
              e.patrolHeading=biased;
            }
          }
          desiredHeading=e.patrolHeading??e.heading??0;
        }

        // ── Post-fire sprint-away — immediate course change after torpedo launch ──
        // Overrides normal state machine heading. Sub knows it just revealed its position.
        if((e._postFireT||0)>0 && !e.evadeT){
          e._postFireT-=dt;
          desiredHeading=e._postFireHdg??desiredHeading;
          e.tmaPhase='drift'; // go quiet after launch — don't sprint around
        }

        // ── Baffle-clear maneuver — periodic listen stop ────────────────────────
        // Hunter/interceptor/zeta roles only. Suppressed during evasion, post-fire, close phase.
        // Sub turns ~35° off base heading, slows to 3-5kt to clear propeller noise, then resumes.
        const _bcCfg=C.enemy.baffleClear||{};
        const _bcRoles=_bcCfg.rolesEnabled||['hunter','interceptor','zeta'];
        if(_bcRoles.includes(e.role??'hunter') && !e.evadeT && !((e._postFireT||0)>0) && e.tmaPhase!=='close'){
          e._baffleClearT=(e._baffleClearT??rand(_bcCfg.intervalMin??90,_bcCfg.intervalMax??150))-dt;
          if(e._baffleClearActive){
            e._baffleClearDur=(e._baffleClearDur||0)-dt;
            desiredHeading=e._baffleClearHdg??desiredHeading;
            if(e._baffleClearDur<=0){
              e._baffleClearActive=false;
              e._baffleClearT=rand(_bcCfg.intervalMin??90,_bcCfg.intervalMax??150);
            }
          } else if(e._baffleClearT<=0){
            e._baffleClearActive=true;
            e._baffleClearDur=rand(_bcCfg.checkDurMin??20,_bcCfg.checkDurMax??30);
            const _bcTurn=(_bcCfg.turnDeg??35)*Math.PI/180;
            e._baffleClearHdg=angleNorm((e.heading||0)+(Math.random()<0.5?1:-1)*_bcTurn);
          }
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
              const projX=player.wx+pVx*leadT;
              const projY=player.wy+pVy*leadT;
              // Offset perpendicular — sit off their projected track slightly
              const perpOff=(Math.random()<0.5?1:-1)*rand(300,600);
              const perpAng=player.heading+Math.PI/2;
              e.interceptTargetX=projX+Math.cos(perpAng)*perpOff;
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
        // SSBN: huge hull, much slower turn rate
        const maxTurnRate=(e.role==='ssbn'?0.18:e.role==='zeta'?0.55:0.45)*dt;
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
          :(e._postFireT||0)>0?rand(14,18) // post-fire sprint-away — clear launch datum
          :e._baffleClearActive?rand(3,5)  // baffle-clear listen — slow and quiet
          :e.role==='ssbn'&&(state==='engage'||state==='investigate')?8 // SSBN flees at moderate speed
          :e.role==='ssbn'?rand(3,5)     // SSBN patrol — very slow and quiet
          :isAmbushing?C.enemy.interceptorAmbushSpd||3   // ambush — near silent
          :e.role==='interceptor'&&e.interceptState==='sprinting'?rand(14,17) // sprint to position
          :state==='engage'&&sprintPhase?14
          :state==='engage'&&e.tmaPhase==='close'?12
          :state==='engage'?5          // drift: slow and quiet to listen
          :state==='investigate'&&sprintPhase?10
          :state==='investigate'?5
          :7;
        const curSpd=Math.hypot(e.vx,e.vy);
        // Damage speed cap — propulsion casualty from torpedo hit (set in damageEnemy)
        const cappedTargetSpd = targetSpd * (e._dmgSpeedCapMult ?? 1.0);
        // Tau-based acceleration — matches realistic SSN build/decay rates
        // Subs accelerate slower than they decelerate (prop drag)
        const eTau = curSpd < cappedTargetSpd ? 40 : 25;
        const newSpd = curSpd + (cappedTargetSpd - curSpd) / eTau * dt;
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

        // ── Ping — pingers ping aggressively; tactical pingers ping when stuck ────
        e.pingCd-=dt;
        const isPinger=e.role==='pinger';
        const isHunter=e.role==='hunter'||e.role==='interceptor'||!e.role;
        // Pingers: aggressive intervals. Tactical pingers: ping when TMA stuck.
        // Hunters: never ping (pingCd stays high, no tactical flag).
        const pingInterval=isPinger
          ?(state==='engage'?[5,9]:state==='investigate'?[8,14]:[12,20])
          :[9999,9999];

        // Tactical ping decision — any enemy with tacticalPing flag
        // Conditions: has bearing observations but TMA stuck below fire threshold,
        // suspicion indicates something is out there, not currently evading
        let wantsTacticalPing=false;
        if(e.tacticalPing && !isPinger && e.pingCd<=0 && !e.evadeT){
          const hasBearings=(e.playerBearings||[]).length>=2;
          const tmaStuck=(e.tmaQuality||0)<(e.tacticalPingTmaThresh??0.25);
          const suspicious=e.suspicion>=(e.tacticalPingSusThresh??0.15);
          // Track how long TMA has been stuck — don't ping immediately, wait for passive to fail
          if(hasBearings && tmaStuck && suspicious){
            e._tmaStuckT=(e._tmaStuckT||0)+dt;
            if(e._tmaStuckT>=(e.tacticalPingStuckTime??25)){
              wantsTacticalPing=true;
              e._tmaStuckT=0; // reset so next ping requires another wait
            }
          } else {
            e._tmaStuckT=0;
          }
        }

        if(e.pingCd<=0 && !game.over && (isPinger || wantsTacticalPing)){
          e.pingCd=isPinger?rand(pingInterval[0],pingInterval[1]):rand(e.tacticalPingCd?.[0]??30,e.tacticalPingCd?.[1]??50);
          const dxp=AI.wrapDx(player.wx,e.x);
          const dyp=player.wy-e.y;
          const dp=Math.hypot(dxp,dyp);
          if(dp<C.enemy.subPingRange){
            e.pingPulse=1.2;
            e.detectedT=Math.max(e.detectedT||0,C.detection.detectT);
            e.seen=Math.max(e.seen||0,C.detection.seenT*0.4);
            e.lastX=e.x; e.lastY=e.y; e.lastT=now();
            AI.enemyUpdateContactFromPing(e,player.wx,player.wy,dp);
            if(e.type==='boat') AI.shipShareContact(e,player.wx,player.wy,160+dp*0.10);
            // Pingers share datum aggressively; tactical pingers keep it to themselves
            if(isPinger && AI.wolfpackShareDatum) AI.wolfpackShareDatum(e,player.wx,player.wy,0.45);
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
          // SSBNs fire only in desperation — self-defence last resort
          const roleFireQ = e.role==='ssbn'?0.80
            : e.role==='zeta'?0.28     // Zeta fires with confidence on thin data
            : e.role==='hunter'?0.35
            : e.role==='interceptor'?0.30
            : e.role==='pinger'?0.50   // pingers fire only with a decent solution
            : 0.30;
          const hasRoleSolution = (e.tmaQuality||0) >= roleFireQ;
          const eLaunchKts = Math.hypot(e.vx, e.vy);
          const eLaunchCap = C.player.wireMaxLaunchKts ?? 15;
          if(tubeIdx>=0 && AI.enemyHasFireSolution(e) && hasRoleSolution && eLaunchKts <= eLaunchCap){
            const tx=e.contact.x, ty=e.contact.y;
            const dx=AI.wrapDx(e.x,tx);
            const dy=ty-e.y;
            const d=Math.hypot(dx,dy);
            const layer=AI.layerPenalty(player.depth,e.y);
            const maxD=(layer<1)?2200:2800;
            if(d<maxD){
              // Intercept bearing using TMA-estimated player velocity
              // Use true player pos blurred by TMA quality — not perfect aim
              // Fire adaptation: tighten blur based on previous misses
              const adaptCfg=C.enemy.adaptation||{};
              const adaptPenalty=1-Math.min((e._missCount||0)*(adaptCfg.blurReductionPerMiss??0.15), 1-(adaptCfg.blurFloor??0.50));
              const blur=clamp((1-tmaQ)*400, 0, 350)*adaptPenalty;
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
              const torpParams={
                speed:     C.enemy.subTorpSpeed??26,
                life:      C.enemy.subTorpLife??220,
                seekRange: C.enemy.subTorpSeekRange??400,
                reacquireChance: C.enemy.subTorpReacquire??0.010,
                firedBy:   e,
              };
              W.fireTorpedo(sx,sy,shot.dx,shot.dy,false,260,false,0,e.depth||300,ftDepth,torpParams);
              e.torpTubes[tubeIdx]=C.enemy.subReloadTime;
              if(e.torpStock!=null) e.torpStock--;

              // Two-torpedo spread — bracket target when solution is solid
              // Fire a second tube ±7° from the first bearing
              const tube2Idx=e.torpTubes.findIndex((t,i)=>i!==tubeIdx&&t<=0);
              if(tube2Idx>=0 && tmaQ>=0.55 && (e.torpStock??0)>0){
                const spreadRad=rand(5,8)*Math.PI/180;
                const spreadFlip=(Math.random()<0.5?1:-1);
                const brg2=intBearing+spreadFlip*spreadRad;
                const shot2=clampConeDual(Math.cos(brg2),Math.sin(brg2),
                  e.heading||Math.atan2(e.vy,e.vx),C.enemy.subTorpArcDeg);
                W.fireTorpedo(sx,sy,shot2.dx,shot2.dy,false,260,false,0,e.depth||300,ftDepth,torpParams);
                e.torpTubes[tube2Idx]=C.enemy.subReloadTime;
                if(e.torpStock!=null) e.torpStock--;
              }

              // Launch transient — player may hear it if close enough
              if(typeof window._playerHearTransient==='function') window._playerHearTransient(e,e.x,e.y);
              // Wolfpack — share datum with nearby allies
              if(e.tmaX!=null && AI.wolfpackShareDatum) AI.wolfpackShareDatum(e,e.tmaX,e.tmaY,e.tmaQuality||0.5);
              const brgToEnemy=((Math.atan2(AI.wrapDx(player.wx,e.x),e.y-player.wy)*180/Math.PI)+360)%360;
              COMMS.tactical.enemyTorpedo(Math.round(brgToEnemy).toString().padStart(3,'0')+'°');

              // Post-fire sprint-away — course change 100-140° to clear launch position
              // Sub knows the launch transient just pinged itself on the player's sonar
              if(!(e._postFireT>0)){
                e._postFireT=rand(20,35);
                e._postFireHdg=angleNorm((e.heading||0)+(Math.random()<0.5?1:-1)*rand(1.75,2.44));
                // Cross the layer if possible — make it harder for the player to counter-fire
                e.depthOrder=e.depth<250?rand(300,500):rand(60,180);
                e.depthChangeT=rand(5,12);
              }
            }
          }
        }

        // ── Bearing-only fire — probe shot down a bearing when TMA won't converge ─
        // Available to any enemy with bearingOnlyEnabled. Uses existing torpedo system.
        // Fires one torpedo down the best bearing — seeker and search pattern do the rest.
        if(e.bearingOnlyEnabled && !game.over && (e.torpStock??1)>0){
          e._bearingOnlyCd=(e._bearingOnlyCd??0)-dt;
          if(e._bearingOnlyCd<=0){
            const obs=e.playerBearings||[];
            const tmaQ=e.tmaQuality||0;
            // Conditions: have recent bearings, TMA stuck below fire threshold,
            // suspicion high enough to justify spending a torpedo
            const recentObs=obs.filter(o=>(game.missionT||0)-o.t<30);
            const roleQ = e.role==='ssbn'?0.80:e.role==='zeta'?0.28:e.role==='hunter'?0.35:0.30;
            const stuck=tmaQ<roleQ && recentObs.length>=3;
            const suspicious=e.suspicion>=(e.bearingOnlySusThresh??0.35);
            const tubeReady=e.torpTubes?.findIndex(t=>t<=0)>=0;
            const eLaunchKts=Math.hypot(e.vx,e.vy);
            if(stuck && suspicious && tubeReady && eLaunchKts<=(C.player.wireMaxLaunchKts??15)){
              // Fire down the most recent bearing
              const lastBrg=recentObs[recentObs.length-1].brg;
              const shot=clampConeDual(Math.cos(lastBrg),Math.sin(lastBrg),
                e.heading||Math.atan2(e.vy,e.vx),C.enemy.subTorpArcDeg);
              const off=e.r*1.25;
              const sx=e.x+(shot.isRear?-Math.cos(e.heading):Math.cos(e.heading))*off;
              const sy=e.y+(shot.isRear?-Math.sin(e.heading):Math.sin(e.heading))*off;
              const estDepth=player.depth+rand(-120,120);
              W.fireTorpedo(sx,sy,shot.dx,shot.dy,false,260,false,0,e.depth||300,
                clamp(estDepth,30,700),{
                  speed:     C.enemy.subTorpSpeed??26,
                  life:      C.enemy.subTorpLife??220,
                  seekRange: C.enemy.subTorpSeekRange??400,
                  reacquireChance: C.enemy.subTorpReacquire??0.010,
                  firedBy:   e,
                });
              const tIdx=e.torpTubes.findIndex(t=>t<=0);
              e.torpTubes[tIdx]=C.enemy.subReloadTime;
              if(e.torpStock!=null) e.torpStock--;
              e._bearingOnlyCd=e.bearingOnlyCdTime??50; // long cooldown — considered shots
              if(typeof window._playerHearTransient==='function') window._playerHearTransient(e,e.x,e.y);
              const brgToEnemy=((Math.atan2(AI.wrapDx(player.wx,e.x),e.y-player.wy)*180/Math.PI)+360)%360;
              COMMS.tactical.enemyTorpedo(Math.round(brgToEnemy).toString().padStart(3,'0')+'°');
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
              // First detection — begin reaction timer, then staggered counter-fire
              e.evadeT=rand(25,35);
              COMMS.combat.enemyCountermeasures();

              // ── Phased counter-fire ─────────────────────────────────────────
              // Only the targeted enemy counter-fires — others evade but don't shoot.
              // Targeted = torpedo heading generally toward this enemy (within 60° cone).
              // Soviet doctrine: 2-4s crew reaction, then fire 1-2 tubes initially,
              // hold remaining as follow-up if first salvo fails to deter.
              if(!e._cfPhase){
                // Check if this torpedo is actually aimed at us
                const torpHdg=Math.atan2(b.dy||0, b.dx||0);
                const brgToUs=Math.atan2(e.y-b.y, AI.wrapDx(b.x,e.x));
                let hdgDiff=Math.abs(torpHdg-brgToUs);
                if(hdgDiff>Math.PI) hdgDiff=2*Math.PI-hdgDiff;
                const aimedAtUs=hdgDiff<(60*Math.PI/180); // within 60° cone
                if(aimedAtUs){
                  const cfCfg=C.enemy.counterFire||{};
                  const readyCount=(e.torpTubes||[]).filter(t=>t<=0).length;
                  if(readyCount>0 && (e.torpStock??1)>0){
                    e._cfPhase='reacting';
                    e._cfT=rand(...(cfCfg.reactionDelay||[2,4]));
                    e._cfShotsLeft=Math.min(cfCfg.maxInitial??2, readyCount);
                    e._cfFollowup=false;
                    e._cfTorpBrg=Math.atan2(b.y-e.y, AI.wrapDx(e.x,b.x));
                  }
                }
              }
            } else {
              // Still being chased — keep timer alive
              e.evadeT=Math.max(e.evadeT, 8.0);
            }

            // Update evadeFrom to current torpedo position every frame — heading stays fresh
            e.evadeFrom={x:b.x, y:b.y};
            if(e._cfPhase) e._cfTorpBrg=Math.atan2(b.y-e.y, AI.wrapDx(e.x,b.x));

            // Immediate CM drop on first alert, then again mid-evasion if still chased
            if(e.cmCd<=0 && (e.cmStock??0)>0){
              e.cmCd=rand(5.0,9.0);
              e.cmStock--;
              const dropX=wrapX(e.x-Math.cos(e.heading)*35+rand(-20,20));
              const dropY=e.y-Math.sin(e.heading)*35+rand(-20,20);
              const dec=W.deployDecoy(dropX,dropY,false,"noisemaker",{depth:e.depth||200});
              if(dec) e.evadeDecoy={x:dec.x,y:dec.y};
              if(Math.random()<0.55 && (e.cmStock??0)>0){
                e.cmStock--;
                const drop2X=wrapX(e.x-Math.cos(e.heading)*70+rand(-30,30));
                const drop2Y=e.y-Math.sin(e.heading)*70+rand(-30,30);
                W.deployDecoy(drop2X,drop2Y,false,"noisemaker",{depth:e.depth||200});
              }
            }

            // ── Counter-fire state machine tick ───────────────────────────────
            if(e._cfPhase && (e.torpStock??1)>0){
              e._cfT=(e._cfT||0)-dt;
              if(e._cfT<=0){
                const cfCfg=C.enemy.counterFire||{};
                if(e._cfPhase==='reacting'||e._cfPhase==='stagger'){
                  // Fire one tube with degraded intercept prediction
                  const tubeIdx=(e.torpTubes||[]).findIndex(t=>t<=0);
                  if(tubeIdx>=0 && e._cfShotsLeft>0){
                    // Degraded intercept: panic blur + fewer iterations
                    const tmaQ=e.tmaQuality||0;
                    const baseBlur=clamp((1-tmaQ)*400, 0, 350);
                    const panicBlur=baseBlur*(cfCfg.panicBlurMult??2.5);
                    const ftx=player.wx+rand(-panicBlur,panicBlur);
                    const fty=player.wy+rand(-panicBlur,panicBlur);
                    const ftvx=Math.cos(player.heading)*ktsToWU(player.speed);
                    const ftvy=Math.sin(player.heading)*ktsToWU(player.speed);
                    const torpSpd=C.enemy.subTorpSpeed??45;
                    const ftDist=Math.hypot(AI.wrapDx(e.x,ftx),fty-e.y);
                    let tof=ftDist/torpSpd;
                    const iters=cfCfg.iterCount??4;
                    for(let i=0;i<iters;i++){
                      const ex2=ftx+ftvx*tof, ey2=fty+ftvy*tof;
                      tof=Math.hypot(AI.wrapDx(e.x,ex2),ey2-e.y)/torpSpd;
                    }
                    const predX=ftx+ftvx*tof, predY=fty+ftvy*tof;
                    let intBrg=Math.atan2(predY-e.y,AI.wrapDx(e.x,predX));
                    // Clamp to firing arc
                    const shot=clampConeDual(Math.cos(intBrg),Math.sin(intBrg),
                      e.heading||Math.atan2(e.vy||0,e.vx||0),C.enemy.subTorpArcDeg);
                    const off=(e.r||20)*1.25;
                    const sx=wrapX(e.x+Math.cos(e.heading)*off);
                    const sy=e.y+Math.sin(e.heading)*off;
                    const estDepth=player.depth+rand(-80,80);
                    W.fireTorpedo(sx,sy,shot.dx,shot.dy,false,260,false,0,e.depth||300,
                      clamp(estDepth,30,700),{
                        speed:torpSpd, life:C.enemy.subTorpLife??220,
                        seekRange:C.enemy.subTorpSeekRange??400,
                        reacquireChance:C.enemy.subTorpReacquire??0.010,
                        firedBy:e,
                      });
                    e.torpTubes[tubeIdx]=C.enemy.subReloadTime;
                    if(e.torpStock!=null) e.torpStock--;
                    if(typeof window._playerHearTransient==='function') window._playerHearTransient(e,e.x,e.y);
                    e._cfShotsLeft--;
                    const cDeg=Math.round(((intBrg*180/Math.PI)+360)%360);
                    COMMS.combat.counterShot(1, cDeg.toString().padStart(3,'0')+'°');
                    if(e._cfShotsLeft>0){
                      e._cfPhase='stagger';
                      e._cfT=rand(...(cfCfg.staggerDelay||[1.5,3]));
                    } else if(!e._cfFollowup){
                      e._cfPhase='followup_wait';
                      e._cfT=rand(8,15);
                    } else {
                      e._cfPhase=null;
                    }
                  } else { e._cfPhase=null; }
                } else if(e._cfPhase==='followup_wait'){
                  // Check if player torpedo is still tracking this enemy
                  const stillTracked=bullets.some(bt=>bt.kind==='torpedo'&&bt.friendly&&bt.life>0&&
                    Math.hypot(AI.wrapDx(e.x,bt.x),bt.y-e.y)<C.enemy.subTorpReactR);
                  if(stillTracked){
                    const readyCount=(e.torpTubes||[]).filter(t=>t<=0).length;
                    if(readyCount>0 && (e.torpStock??1)>0){
                      e._cfShotsLeft=readyCount;
                      e._cfFollowup=true;
                      e._cfPhase='stagger';
                      e._cfT=0;
                    } else { e._cfPhase=null; }
                  } else { e._cfPhase=null; }
                }
              }
            }
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
        COMMS.tactical.prosecuting();
        if(window.G.setTacticalState('action')){
          COMMS.crewState.actionStations('contact');
        }
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
          COMMS.tactical.contactLost();
        }
      }

      // Wave clear — all combatant enemies dead (civilians don't count)
      const combatantsLeft=enemies.some(e=>!e.civilian&&!e.dead);
      if(!combatantsLeft){
        if(game.waveDelay<=0 && game.wave>0){
          game.waveDelay=C.enemy.waveDelay;
          COMMS.tactical.areaClear(game.wave);
          if(window.G.setTacticalState('cruising')){
            COMMS.crewState.standDown('action');
          }
        }
        if(game.waveDelay>0){
          game.waveDelay-=dt;
          if(game.waveDelay<=0){
            spawnWave(game.wave+1);
          }
        }
      }
      } // end waves-only

      // ── Victory detection (all scenarios except waves/free_run) ──────────────
      const sc=game.scenario;
      if(!game._victory && sc!=='waves' && sc!=='free_run'){

        // SSBN hunt — victory when the boomer is sunk (escort is optional)
        if(sc==='ssbn_hunt' && !game._ssbnVictory){
          const ssbnAlive=enemies.some(e=>e.role==='ssbn'&&!e.dead);
          if(!ssbnAlive){
            game._ssbnVictory=true;
            game._victory=true;
            game.score+=300;
            addLog('CONN','Conn — break-up noises confirmed. SSBN is destroyed. Mission complete.');
            addLog('CONN','Conn — well done. Set course for home.');
          }
        }

        // ASW taskforce — victory when all warships are sunk
        else if(sc==='asw_taskforce' && !game._aswVictory){
          const shipsAlive=enemies.some(e=>e.type==='boat'&&!e.civilian&&!e.dead);
          if(!shipsAlive){
            game._aswVictory=true;
            game._victory=true;
            game.score+=400;
            addLog('CONN','Conn — all surface contacts destroyed. ASW taskforce neutralised.');
            addLog('CONN','Conn — well done. Clear the datum and set course for home.');
          }
        }

        // Boss fight — victory when the Zeta is destroyed
        else if(sc==='boss_fight' && !game._bossVictory){
          const zetaAlive=enemies.some(e=>e.role==='zeta'&&!e.dead);
          if(!zetaAlive){
            game._bossVictory=true;
            game._victory=true;
            game.score+=500;
            addLog('CONN','Conn — confirmed, Zeta-class is destroyed. That\'s one for the history books.');
            addLog('CONN','Conn — secure from battle stations. Set course for home.');
          }
        }

        // Duel / Ambush / Patrol — victory when all non-civilian enemies are dead
        else if(sc==='duel'||sc==='ambush'||sc==='patrol'){
          const alive=enemies.some(e=>!e.civilian&&!e.dead);
          if(!alive){
            game._victory=true;
            const bonus=sc==='duel'?150:sc==='ambush'?350:250;
            game.score+=bonus;
            if(sc==='duel'){
              addLog('CONN','Conn — contact destroyed. Well fought. Secure from battle stations.');
            } else if(sc==='ambush'){
              addLog('CONN','Conn — all contacts destroyed. We made it through the ambush. Secure from battle stations.');
            } else {
              addLog('CONN','Conn — barrier patrol neutralised. All contacts destroyed. Set course for home.');
            }
          }
        }
      }

      // ── Win delay timer — let COMMS play before showing win screen ──────────
      if(game._victory && !game.won){
        game._wonDelayT=(game._wonDelayT||0)+dt;
        if(game._wonDelayT>=8.0){
          game.won=true;
        }
      }
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
        d.y = clamp(d.y,world.seaLevel-80,world.ground-40);
      }
    }
    for(let i=decoys.length-1;i>=0;i--) if(decoys[i].life<=0) decoys.splice(i,1);

    // contacts
    for(const c of contacts) c.life -= dt;
    for(let i=contacts.length-1;i>=0;i--) if(contacts[i].life<=0) contacts.splice(i,1);

    // bullets
    for(const b of bullets){
      b.life -= dt;

      if(b.kind==="rocket"){
        b.x+=b.vx*dt; b.y+=b.vy*dt;
        const rdx=b.targetX-b.x, rdy=b.targetY-b.y;
        if(Math.hypot(rdx,rdy)<80 || b.life<=0){
          // Deploy dumb searching torpedo at datum
          const searchAng=Math.random()*Math.PI*2;
          W.fireTorpedo(b.x,b.y, Math.cos(searchAng),Math.sin(searchAng),
            false,0,false,0, b.deployDepth,b.deployDepth,
            {life:120,speed:30,seekRange:420,dmg:28,circleSearch:true});
          // Player hears splash
          const rbdx=AI.wrapDx(player.wx,b.x), rbdy=b.y-player.wy;
          if(Math.hypot(rbdx,rbdy)<5000){
            const rbrg=Math.round(((Math.atan2(rbdx,rbdy)*180/Math.PI)+360)%360);
            COMMS.tactical.heloDrop?.(rbrg.toString().padStart(3,'0')+'°');
          }
          b.life=0;
        }
        continue;
      }

      if(b.kind==="depthCharge"){
        b.vy = lerp(b.vy,b.sink,0.08);
        b.x = wrapX(b.x + b.vx*dt);
        b.y += b.vy*dt;
        if(b.y>=b.targetY || b.y>=world.ground-12){
          W.makeExplosion(b.x,b.y,1.15,true);
          const dxp=AI.wrapDx(b.x,player.wx);
          const dyp=player.depth-b.y;
          const dp=Math.hypot(dxp,dyp);
          if(dp<b.blastR) damagePlayer(b.dmg*(1-dp/b.blastR));

          // Sonar transient — depth charge detonation is audible at long range.
          // Rate-limited so a pattern of charges produces one report.
          const dcDetectRange=4500;
          const dxs=AI.wrapDx(player.wx,b.x), dys=player.wy-b.y;
          if(Math.hypot(dxs,dys)<dcDetectRange){
            const _now=now();
            if(!game._dcSonarT || _now-game._dcSonarT>4.0){
              game._dcSonarT=_now;
              const brg=Math.round(((Math.atan2(dxs,dys)*180/Math.PI)+360)%360);
              COMMS.tactical.dcDetonation(brg.toString().padStart(3,'0')+'°');
            }
          }

          b.life=0;
        }
        continue;
      }

      if(b.kind==="torpedo"){
        TORP.update(b, dt);
        // Ping dazzle — active sonar pulse disrupts enemy torpedo seekers
        if(!b.friendly && player.sonarPulse>0){
          const dazzleCfg=C.player.pingDazzle;
          if(dazzleCfg && !b._wasDazzled){
            const ddx=AI.wrapDx(player.wx,b.x), ddy=player.wy-b.y;
            if(Math.hypot(ddx,ddy)<(dazzleCfg.range??1800)){
              b._dazzleT=dazzleCfg.duration??1.5;
              b.target=null; // break current lock
              b._wasDazzled=true;
            }
          }
        }
        continue;
      }

    }
    for(let i=bullets.length-1;i>=0;i--){
      const _b=bullets[i];
      if(_b.life<=0){
        // If a wired torpedo is expiring, free the tube first
        if(_b.kind==='torpedo' && _b.wire?.live){
          _b.wire.live=false;
          window.G._onWireCut?.(_b);
        }
        // Fire adaptation: track enemy torpedo misses
        if(_b.kind==='torpedo' && !_b.friendly && !_b._hit && _b.firedBy){
          const firer=_b.firedBy;
          if(enemies.includes(firer) && !firer.dead){
            firer._missCount=(firer._missCount||0)+1;
            firer._lastMissT=game.missionT;
          }
        }
        bullets.splice(i,1);
      }
    }

    // Wire guidance update + speed stress — runs on live wired torpedoes
    {
      const safeKts   = C.player.wireSafeKts        ?? 15;
      const stressKts = C.player.wireStressKts       ?? 20;
      const breakTime = C.player.wireStressBreakTime ?? 25;
      const instantKts= C.player.wireInstantBreakKts ?? 22;
      const playerKts = player.speed ?? 0;
      for(const b of bullets){
        if(b.kind!=='torpedo'||!b.wire||!b.wire.live) continue;
        W.wireUpdate(b, dt);
        // Speed stress — accumulate on wire, part when full
        if(playerKts > safeKts){
          if(!b.wire._stressAcc) b.wire._stressAcc = 0;
          let stressRate;
          if(playerKts >= instantKts){
            stressRate = 1 / 3;   // parts in ~3s
          } else {
            const t = (playerKts - safeKts) / Math.max(1, stressKts - safeKts);
            stressRate = t / breakTime;
          }
          b.wire._stressAcc += stressRate * dt;
          if(b.wire._stressAcc >= 1.0){
            b.wire.live = false;
            window.G._onWireCut?.(b);
            COMMS.weapons.wireParted(null, 'speed');
          }
        } else {
          // Recover stress slowly at safe speeds
          if(b.wire._stressAcc) b.wire._stressAcc = Math.max(0, b.wire._stressAcc - dt * 0.02);
        }
      }
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
      p.x = p.x + p.vx*dt;
      p.y = p.y + p.vy*dt;
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

  // ── Watch fatigue & handover ──────────────────────────────────────────────
  function _oowName(watchId){
    const d=player.damage; if(!d) return 'unknown';
    for(const comp of ['control_room']){
      const m=(d.crew[comp]||[]).find(c=>c.role==='OOW'&&c.watch===watchId);
      if(m) return m.lastName;
    }
    return 'unknown';
  }

  function initiateWatchChange(){
    if(game.watchChanging) return;
    if(game.tacticalState==='action'||game.casualtyState==='emergency'){
      COMMS.watch.blocked(); return;
    }
    const outgoing=game.activeWatch;
    const incoming=outgoing==='A'?'B':'A';
    game.watchChanging=true;
    game.watchChangeT=30;
    game._watchRelief80=false;
    game._watchRelief100=false;
    COMMS.watch.relieving(outgoing, incoming);
  }

  function tickWatchFatigue(dt){
    // Complete a pending handover
    if(game.watchChanging){
      game.watchChangeT=Math.max(0, game.watchChangeT-dt);
      if(game.watchChangeT<=0){
        game.activeWatch=game.activeWatch==='A'?'B':'A';
        game.watchChanging=false;
        game.watchFatigue=0;
        game.watchT=0;
        window.DMG?.relocateCrewForWatch(game.activeWatch);
        COMMS.watch.onWatch(game.activeWatch, _oowName(game.activeWatch));
      }
      return;
    }

    // Accumulate fatigue — faster during patrol/action (stress)
    // Rates tuned for ~15-45 min real-time watches (80% request relief, 100% forced change)
    const rate=game.tacticalState==='action'?0.0009:
               game.tacticalState==='patrol'?0.0006:0.00035; // per second
    game.watchFatigue=Math.min(1.0,(game.watchFatigue||0)+rate*dt);
    game.watchT=(game.watchT||0)+dt;

    // 80% threshold — OOW requests relief
    if(game.watchFatigue>=0.8&&!game._watchRelief80){
      game._watchRelief80=true;
      COMMS.watch.requestRelief(game.activeWatch);
    }
    // 100% — forced change (if not in action/emergency)
    if(game.watchFatigue>=1.0&&!game._watchRelief100){
      game._watchRelief100=true;
      COMMS.watch.forcedChange(game.activeWatch);
      if(game.tacticalState!=='action'&&game.casualtyState!=='emergency'){
        initiateWatchChange();
      }
    }
  }

  function resetScenario(scenario){
    game.scenario=scenario;
    reset();
  }
  window.SIM={update,reset,resetScenario,initiateWatchChange};
  window.G.damageEnemy=damageEnemy;
  window.G.damagePlayer=damagePlayer;
})()