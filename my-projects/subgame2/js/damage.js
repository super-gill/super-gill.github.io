(() => {
  'use strict';
  const C   = window.CONFIG;
  const {player, game, setMsg, addLog} = window.G;
  const {rand, clamp} = window.M;

  // ── Compartments & systems ──────────────────────────────────────────────────
  const COMPARTMENTS = ['bow','control','engineering','stern'];

  const COMP_SYSTEMS = {
    bow:         ['sonar_hull','tubes'],
    control:     ['periscope','ballast','tdc_comp'],
    engineering: ['propulsion','reactor'],
    stern:       ['towed_array','steering'],
  };

  const SYS_LABEL = {
    sonar_hull:  'SONAR ARRAY',
    tubes:       'TORPEDO TUBES',
    periscope:   'PERISCOPE',
    ballast:     'BALLAST CTRL',
    tdc_comp:    'TDC COMPUTER',
    propulsion:  'PROPULSION',
    reactor:     'REACTOR',
    towed_array: 'TOWED ARRAY',
    steering:    'STEERING',
  };

  const STATES = ['nominal','degraded','offline','destroyed'];

  // Repair time (seconds) to advance one step toward nominal
  const REPAIR_TIME = { degraded:45, offline:95 };

  // ── Init (called on game reset) ──────────────────────────────────────────────
  function initDamage(){
    player.damage = {
      crew: { total:30, killed:0, wounded:0, woundedRecoverT:0 },
      deptPriority: 'balanced',   // 'weapons'|'sonar'|'engineering'|'dc'|'balanced'
      repairs: [],                // [{system, progress, totalTime}]
      flooding: { bow:0, control:0, engineering:0, stern:0 }, // 0=none … 1=severe
      systems: {
        sonar_hull:  'nominal',
        tubes:       'nominal',
        periscope:   'nominal',
        ballast:     'nominal',
        tdc_comp:    'nominal',
        propulsion:  'nominal',
        reactor:     'nominal',
        towed_array: 'nominal',
        steering:    'nominal',
      },
      alerts:[],  // [{text,t}] — recent damage events for HUD flash
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function maxDCTeams(){
    const d = player.damage;
    if(!d) return 2;
    const avail = Math.max(0, d.crew.total - d.crew.killed - Math.ceil(d.crew.wounded*0.5));
    const base  = Math.max(1, Math.floor(avail / 8));
    const bonus = d.deptPriority==='dc' ? 1 : 0;
    return Math.min(3, base + bonus);
  }

  function stateIndex(sys){ return STATES.indexOf(player.damage.systems[sys]); }

  function damageSystem(sys, steps=1){
    const d = player.damage;
    const next = Math.min(stateIndex(sys)+steps, STATES.length-1);
    d.systems[sys] = STATES[next];
    return STATES[next];
  }

  // Which compartment took the hit based on angle of impact
  function hitCompartment(hitX, hitY){
    const dx = hitX - player.wx;
    const dy = hitY - player.wy;
    const ang = Math.atan2(dy, dx);
    const rel = ((ang - player.heading) + Math.PI*3) % (Math.PI*2) - Math.PI;
    if(Math.abs(rel) < Math.PI/4)                    return 'bow';
    if(Math.abs(rel) > Math.PI*3/4)
      return rand(0,1)>0.5 ? 'engineering' : 'stern';
    return rand(0,1)>0.5 ? 'control' : 'engineering';
  }

  // ── Main hit entry point (replaces damagePlayer) ─────────────────────────────
  function hit(amount, hitX, hitY){
    if(player.invuln > 0) return;
    player.invuln = 1.5;

    const d = player.damage;
    // severity 0-1: a full torpedo hit (dmg≈55) = 1.0
    const severity = clamp(amount / 55, 0, 1);

    // ── Crew casualties ──────────────────────────────────────────────────────
    const crewLeft = d.crew.total - d.crew.killed;
    // Store casualties to log after delay
    let _casualtiesKilled=0, _casualtiesWounded=0;
    if(severity > 0.25){
      const killed  = Math.max(1, Math.round(rand(1, severity*7)));
      const wounded = Math.round(rand(0, severity*5));
      d.crew.killed  = Math.min(d.crew.total-1, d.crew.killed + killed);
      d.crew.wounded = Math.min(crewLeft-killed, d.crew.wounded + wounded);
      d.crew.woundedRecoverT = 150;
      _alert(`${killed} CREW KIA${wounded>0?`, ${wounded} WOUNDED`:''}`);
      _casualtiesKilled=killed; _casualtiesWounded=wounded;
    }

    // ── Determine compartment ────────────────────────────────────────────────
    const comp = (hitX!=null && hitY!=null)
      ? hitCompartment(hitX, hitY)
      : COMPARTMENTS[Math.floor(rand(0,4))];

    // ── Damage systems in that compartment ──────────────────────────────────
    addLog('ENG','Conn, Eng — we have damage, assessing');
    const sysList = [...COMP_SYSTEMS[comp]].sort(()=>rand(-1,1));
    const numHit  = severity>0.75 ? sysList.length : severity>0.45 ? 2 : 1;
    for(let i=0; i<Math.min(numHit, sysList.length); i++){
      const steps  = severity>0.85 ? 2 : 1;
      const newSt  = damageSystem(sysList[i], steps);
      _alert(`${SYS_LABEL[sysList[i]]} ${newSt.toUpperCase()}`);
      window.G.queueLog('ENG', `Conn, Eng — ${SYS_LABEL[sysList[i]]} is ${newSt}`, 1.5+i*0.6);
    }

    // ── Flooding ─────────────────────────────────────────────────────────────
    if(severity > 0.45 && rand(0,1) < severity*0.65){
      d.flooding[comp] = Math.min(1, (d.flooding[comp]||0) + severity*0.9);
      _alert(`FLOODING: ${comp.toUpperCase()} COMPARTMENT`);
      window.G.queueLog('ENG', `Conn, Eng — flooding in ${comp} compartment. DC party responding`, 3.0);
    }

    // ── Staged casualty report ───────────────────────────────────────────────
    if(_casualtiesKilled>0){
      window.G.queueLog('CONN',`All stations, Conn — casualty report: ${_casualtiesKilled} KIA${_casualtiesWounded>0?`, ${_casualtiesWounded} wounded`:''}`,5.0);
    }

    // ── Legacy HP — keeps game-over logic working ────────────────────────────
    player.hp = Math.max(1, player.hp - amount*0.8);

    // Catastrophic loss check
    const destroyed = Object.values(d.systems).filter(s=>s==='destroyed').length;
    if(d.crew.killed >= d.crew.total-2 || destroyed >= 5){
      player.hp = 0;
      game.over  = true;
    }

    game.hitFlash = 0.7;
    setMsg(`TORPEDO HIT — ${comp.toUpperCase()} COMPARTMENT`, 2.5);
  }

  function _alert(text){
    player.damage.alerts.push({text, t:5.0});
  }

  // ── DC Repair ─────────────────────────────────────────────────────────────
  function assignRepair(sys){
    const d = player.damage;
    if(!d) return;
    if(d.repairs.find(r=>r.system===sys)){
      setMsg('ALREADY REPAIRING', 0.8); return;
    }
    if(d.repairs.length >= maxDCTeams()){
      setMsg('NO DC TEAMS AVAILABLE', 1.0); return;
    }
    const st = d.systems[sys];
    if(st==='nominal'||st==='destroyed') return;
    const totalTime = REPAIR_TIME[st] || 70;
    d.repairs.push({system:sys, progress:0, totalTime});
    addLog('ENG',  `Conn, DC — repair underway, ${SYS_LABEL[sys]}`);
    setMsg(`DC: REPAIRING ${SYS_LABEL[sys]}`, 1.0);
  }

  function cancelRepair(sys){
    const d = player.damage;
    if(!d) return;
    const i = d.repairs.findIndex(r=>r.system===sys);
    if(i>=0) d.repairs.splice(i,1);
    setMsg(`DC: CANCELLED ${SYS_LABEL[sys]}`, 0.8);
  }

  // Seal a flooding compartment — stops noise/depth effects but takes all
  // non-destroyed systems in that compartment offline permanently for this mission.
  function sealFlooding(comp){
    const d = player.damage;
    if(!d || d.flooding[comp]<=0) return;
    d.flooding[comp] = 0;
    for(const sys of COMP_SYSTEMS[comp]){
      if(d.systems[sys]==='nominal') d.systems[sys]='offline';
    }
    // Cancel any repairs in that compartment
    d.repairs = d.repairs.filter(r=>!COMP_SYSTEMS[comp].includes(r.system));
    addLog('ENG',  `Conn, DC — ${comp} compartment sealed, watertight`);
    setMsg(`${comp.toUpperCase()} SEALED`, 1.5);
  }

  function setDeptPriority(p){
    if(!player.damage) return;
    player.damage.deptPriority = p;
    setMsg(`PRIORITY: ${p.toUpperCase()}`, 0.8);
    addLog('CONN',  `Conn, aye — crew priority set to ${p}`);
  }

  // ── Tick (called every frame from sim.js) ─────────────────────────────────
  function tick(dt){
    const d = player.damage;
    if(!d) return;

    // Repair speed multiplier
    const rm = d.deptPriority==='dc'?1.5 : d.deptPriority==='engineering'?1.15 : 1.0;

    for(let i=d.repairs.length-1; i>=0; i--){
      const r = d.repairs[i];
      r.progress += dt*rm;
      if(r.progress >= r.totalTime){
        const cur = stateIndex(r.system);
        if(cur > 0){
          d.systems[r.system] = STATES[cur-1];
          addLog('ENG',  `Conn, DC — ${SYS_LABEL[r.system]} restored to ${STATES[cur-1]}`);
          setMsg(`${SYS_LABEL[r.system]} REPAIRED`, 1.5);
          _alert(`${SYS_LABEL[r.system]} REPAIRED`);
        }
        d.repairs.splice(i,1);
      }
    }

    // Wounded crew slowly recover
    if(d.crew.woundedRecoverT > 0){
      d.crew.woundedRecoverT = Math.max(0, d.crew.woundedRecoverT - dt);
      if(d.crew.woundedRecoverT <= 0 && d.crew.wounded > 0){
        const rec = Math.max(1, Math.floor(d.crew.wounded * 0.65));
        d.crew.wounded = Math.max(0, d.crew.wounded - rec);
        if(rec>0){ addLog('CONN', `Conn, aye — medical report: ${rec} crew returned to duty`); }
      }
    }

    // Tick alert lifetimes
    for(let i=d.alerts.length-1; i>=0; i--){
      d.alerts[i].t -= dt;
      if(d.alerts[i].t <= 0) d.alerts.splice(i,1);
    }
  }

  // ── Effects (consumed by nav.js, sensors.js, sim.js each frame) ──────────
  function getEffects(){
    const d = player.damage;
    if(!d) return _defaults();
    const sys = d.systems;

    const totalFlood = Object.values(d.flooding).reduce((a,b)=>a+b, 0);

    // Speed cap
    let speedCap = Infinity;
    if(sys.propulsion==='destroyed')      speedCap = 2;
    else if(sys.propulsion==='offline')   speedCap = 5;
    else if(sys.propulsion==='degraded')  speedCap = 15;
    if(sys.reactor==='offline'||sys.reactor==='destroyed')
      speedCap = Math.min(speedCap, 7);

    // Sonar range multiplier (hull array)
    let sonarRangeMult = 1.0;
    if(sys.sonar_hull==='offline'||sys.sonar_hull==='destroyed') sonarRangeMult = 0.0;
    else if(sys.sonar_hull==='degraded')  sonarRangeMult = 0.55;

    // Bearing uncertainty multiplier
    let bearingNoiseMult = 1.0;
    if(sys.sonar_hull==='degraded')                               bearingNoiseMult = 2.5;
    else if(sys.sonar_hull==='offline'||sys.sonar_hull==='destroyed') bearingNoiseMult = 5.0;

    // Torpedo reload multiplier
    let reloadMult = 1.0;
    if(sys.tubes==='degraded')  reloadMult = 1.5;
    else if(sys.tubes==='offline')   reloadMult = 3.0;
    else if(sys.tubes==='destroyed') reloadMult = 999;
    // wounded weapons crew also slows reloads
    const weapEff = crewEfficiency('weapons');
    reloadMult *= (1 + (1 - weapEff) * 0.6);

    // Depth-change rate multiplier
    let depthRateMult = 1.0;
    if(sys.ballast==='degraded')           depthRateMult = 0.55;
    else if(sys.ballast==='offline'||sys.ballast==='destroyed') depthRateMult = 0.18;

    // Noise penalty from pumping flooding compartments
    const noisePenalty = Math.min(0.35, totalFlood * 0.10);

    // TDC bearing error (degrees added to firing solution)
    let tdcErrDeg = 0;
    if(sys.tdc_comp==='degraded')                                   tdcErrDeg = 4;
    else if(sys.tdc_comp==='offline'||sys.tdc_comp==='destroyed')   tdcErrDeg = 10;

    // Available tube count
    let tubesAvail = C.player.torpTubes || 4;
    if(sys.tubes==='destroyed') tubesAvail = Math.max(0, tubesAvail-2);
    else if(sys.tubes==='offline') tubesAvail = Math.max(1, tubesAvail-1);

    // Towed array operability
    const towedOk = sys.towed_array==='nominal'||sys.towed_array==='degraded';

    // Periscope
    const periscopeOk = sys.periscope==='nominal'||sys.periscope==='degraded';

    // Depth limit — hull stress from casualties
    const integ = Math.max(0, 1 - d.crew.killed/(d.crew.total||30));
    const maxDepth = integ<0.35 ? 120 : integ<0.55 ? 250 : (C.world?.maxDepth||500);

    return {
      speedCap, sonarRangeMult, bearingNoiseMult,
      reloadMult, depthRateMult, noisePenalty,
      tdcErrDeg, tubesAvail, towedOk, periscopeOk,
      maxDepth, totalFlood,
    };
  }

  function crewEfficiency(dept){
    const d = player.damage;
    if(!d) return 1.0;
    const avail = d.crew.total - d.crew.killed - Math.floor(d.crew.wounded*0.5);
    const prio  = d.deptPriority===dept?1.2 : d.deptPriority==='balanced'?1.0 : 0.80;
    return clamp((avail/d.crew.total)*prio, 0, 1);
  }

  function _defaults(){
    return {
      speedCap:Infinity, sonarRangeMult:1.0, bearingNoiseMult:1.0,
      reloadMult:1.0, depthRateMult:1.0, noisePenalty:0,
      tdcErrDeg:0, tubesAvail:C.player.torpTubes||4,
      towedOk:true, periscopeOk:true,
      maxDepth:C.world?.maxDepth||500, totalFlood:0,
    };
  }

  // ── Public API ────────────────────────────────────────────────────────────
  // Progressive crush flooding — called by nav.js when below crush depth
  // amount: hull fraction to flood per call (e.g. 0.002 * dt per second at just below crush)
  function applyHullStress(amount, reason){
    const d = player.damage;
    if(!d) return;
    // Distribute flooding to a random compartment, biased toward hull/ballast
    const comps=['hull','ballast_tanks','forward','aft'];
    const comp=comps[Math.floor(Math.random()*comps.length)];
    d.flooding[comp]=Math.min(1,(d.flooding[comp]||0)+amount*2.5);
    // Also tick HP so game-over still works
    player.hp=Math.max(0,(player.hp||100)-amount*8);
  }

  window.DMG = {
    initDamage, hit, tick, applyHullStress, assignRepair, cancelRepair,
    sealFlooding, setDeptPriority, getEffects, maxDCTeams,
    COMP_SYSTEMS, COMPARTMENTS, STATES, SYS_LABEL,
  };
})();
