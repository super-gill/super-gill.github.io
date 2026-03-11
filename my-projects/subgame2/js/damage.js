(() => {
  'use strict';
  try {
  const C   = window.CONFIG;
  const {player, game, setMsg, addLog, queueLog} = window.G;
  const {rand, clamp} = window.M;
  const COMMS = window.COMMS;
  const dcLog = COMMS.dcLog;
  const COMP_STATION = COMMS.COMP_STATION;

  // ── Compartment definitions ───────────────────────────────────────────────
  const COMPS = ['fore_ends','control_room','reactor_comp','engine_room','aft_ends'];

  const COMP_DEF = {
    fore_ends:    { label:'TORPEDO ROOM',    systems:['tubes','sonar_hull'],             crewCount:25, tower:'fwd' },
    control_room: { label:'CONTROL ROOM', systems:['periscope','ballast','tdc_comp'], crewCount:20, tower:'fwd' },
    reactor_comp: { label:'REACTOR COMP', systems:['reactor'],                        crewCount:3,  tower:null  },
    engine_room:  { label:'MANEUVERING',  systems:['propulsion','steering'],          crewCount:20, tower:'aft' },
    aft_ends:     { label:'ENGINEERING',     systems:['towed_array'],                    crewCount:15, tower:'aft' },
  };

  const SYS_LABEL = {
    sonar_hull:'SONAR ARRAY', tubes:'TORPEDO TUBES',
    periscope:'PERISCOPE', ballast:'BALLAST CTRL', tdc_comp:'TDC COMPUTER',
    reactor:'REACTOR', propulsion:'PROPULSION', steering:'STEERING',
    towed_array:'TOWED ARRAY',
  };

  // Systems with high injury risk during repair
  const HIGH_ENERGY_SYS = new Set(['reactor','propulsion']);

  const STATES = ['nominal','degraded','offline','destroyed'];
  const REPAIR_TIME = { degraded:20, offline:45, destroyed:120 };

  // ── Travel time table (seconds) ──────────────────────────────────────────
  // Crossing reactor_comp adds ~20s penalty (shielded space — go around)
  const TRAVEL = {
    fore_ends:    { fore_ends:0,  control_room:10, reactor_comp:28, engine_room:46, aft_ends:56 },
    control_room: { fore_ends:10, control_room:0,  reactor_comp:18, engine_room:36, aft_ends:46 },
    reactor_comp: { fore_ends:28, control_room:18, reactor_comp:0,  engine_room:18, aft_ends:28 },
    engine_room:  { fore_ends:46, control_room:36, reactor_comp:18, engine_room:0,  aft_ends:10 },
    aft_ends:     { fore_ends:56, control_room:46, reactor_comp:28, engine_room:10, aft_ends:0  },
  };

  // Adjacent compartments for crew evacuation
  const EVAC_TO = {
    fore_ends:    ['control_room'],
    control_room: ['fore_ends','reactor_comp'],
    reactor_comp: ['control_room','engine_room'],
    engine_room:  ['reactor_comp','aft_ends'],
    aft_ends:     ['engine_room'],
  };
  // ── Named crew generation ─────────────────────────────────────────────────
  const SURNAMES=['Adams','Bailey','Bell','Brown','Clarke','Cooper','Davis','Evans',
    'Fletcher','Foster','Gray','Green','Hall','Harris','Hill','Holmes','Hughes',
    'Jackson','James','Jones','Kelly','King','Lewis','Lloyd','Martin','Mason',
    'Miller','Morgan','Morris','Murphy','Murray','Nash','Newton','Owen','Palmer',
    'Parker','Price','Reid','Roberts','Robinson','Rogers','Ross','Scott','Shaw',
    'Smith','Spencer','Stevens','Taylor','Thomas','Thompson','Turner','Walker',
    'Ward','Watson','Webb','White','Williams','Wilson','Wood','Wright','Young'];

  const COMP_RATINGS = {
    fore_ends:    ['CPO','PO','PO','PO','LS','LS','LS','AB','AB','AB','AB','AB','PO','LS','AB','AB','LS','PO','AB','AB','AB','LS','AB','AB','CPO'],
    control_room: ['CDR','LCDR','LT','LT','LT','WO','CPO','CPO','PO','PO','PO','LS','LS','LS','AB','AB','AB','AB','PO','LS'],
    reactor_comp: ['LCDR','CPO','PO'],
    engine_room:  ['LT','LT','WO','WO','CPO','CPO','CPO','PO','PO','PO','LS','LS','LS','LS','AB','AB','AB','AB','AB','PO'],
    aft_ends:     ['LT','PO','PO','LS','LS','LS','AB','AB','AB','AB','AB','PO','LS','AB','CPO'],
  };

  function genCrew(){
    const manifest={};
    const used=new Set();
    for(const comp of COMPS){
      const count=COMP_DEF[comp].crewCount;
      const ratings=COMP_RATINGS[comp];
      manifest[comp]=[];
      for(let i=0;i<count;i++){
        let sn, attempts=0;
        do{ sn=SURNAMES[Math.floor(Math.random()*SURNAMES.length)]; attempts++; }
        while(used.has(sn)&&attempts<200);
        used.add(sn);
        const init=String.fromCharCode(65+Math.floor(Math.random()*26));
        manifest[comp].push({ name:`${ratings[i]||'AB'} ${init}.${sn}`, rating:ratings[i]||'AB', status:'fit', comp });
      }
    }
    return manifest;
  }

  // ── DC team log (separate from main ship log) ─────────────────────────────
  // ── Init ──────────────────────────────────────────────────────────────────
  function initDamage(){
    const crewTotal=COMPS.reduce((a,c)=>a+COMP_DEF[c].crewCount,0);
    player.damage={
      strikes:  {fore_ends:0,control_room:0,reactor_comp:0,engine_room:0,aft_ends:0},
      flooded:  {fore_ends:false,control_room:false,reactor_comp:false,engine_room:false,aft_ends:false},
      systems:{
        sonar_hull:'nominal',tubes:'nominal',periscope:'nominal',
        ballast:'nominal',tdc_comp:'nominal',reactor:'nominal',
        propulsion:'nominal',steering:'nominal',towed_array:'nominal',
      },
      // Progressive flooding: rate (units/s) and current level (0-1)
      floodRate:{fore_ends:0,control_room:0,reactor_comp:0,engine_room:0,aft_ends:0},
      flooding: {fore_ends:0,control_room:0,reactor_comp:0,engine_room:0,aft_ends:0},
      towers:{fwd:'nominal',aft:'nominal'},
      crew:genCrew(),
      crewTotal,
      alerts:[],
      sinking:false,
      // HPA banks — operational[0..3] + reserve
      hpa:{ pressure:207, reserve:207, recharging:false },
      sinkT:0,
      escapeState:null,
      escapeType:null,
      escapeSurvivors:0,
      escapePlayerSurvived:false,
      escapeDepthM:0,
      escapeT:0,
      escapeQueue:[],
      _tceProcessed:0,

      // Compartment-level repair jobs (both teams contribute to one shared job)
      repairJobs:{},  // comp -> {sys, progress, totalTime} or null

      // DC teams
      teams:{
        alpha:{
          id:'alpha', label:'DC ALPHA',
          home:'fore_ends',       // natural home compartment
          state:'ready',          // ready|transit|on_scene|blowing|lost
          location:'fore_ends',   // last known / used for travel calc
          destination:null,       // comp being travelled to
          transitEta:0,
          task:null,              // null|'flood'|'repair'
          repairTarget:null,      // sys name or null (auto)
          repairProgress:0,
          statusT:0,              // timer for periodic comms
          casualties:0,           // wounded/killed team members (reduces effectiveness)
        },
        bravo:{
          id:'bravo', label:'DC BRAVO',
          home:'engine_room',
          state:'ready',          // ready|transit|on_scene|blowing|lost
          location:'engine_room',
          destination:null,
          transitEta:0,
          task:null,
          repairTarget:null,
          repairProgress:0,
          statusT:0,
          casualties:0,
        },
      },
    };
    game.dcLog=[];
    game.showDcPanel=false;
  }

  // ── Crew helpers ──────────────────────────────────────────────────────────
  function totalFit(){
    if(!player.damage) return 0;
    return COMPS.reduce((a,c)=>a+(player.damage.crew[c]||[]).filter(x=>x.status==='fit').length,0);
  }
  function totalWounded(){
    if(!player.damage) return 0;
    return COMPS.reduce((a,c)=>a+(player.damage.crew[c]||[]).filter(x=>x.status==='wounded').length,0);
  }
  function totalKilled(){
    if(!player.damage) return 0;
    return COMPS.reduce((a,c)=>a+(player.damage.crew[c]||[]).filter(x=>x.status==='killed').length,0);
  }
  function totalCrew(){ return player.damage?.crewTotal||83; }

  function crewEfficiency(dept){
    const fit=totalFit(),total=totalCrew();
    if(total===0) return 0;
    return clamp(fit/total,0,1.0);
  }
  function maxDCTeams(){
    return Object.values(player.damage?.teams||{}).filter(t=>t.state!=='lost').length;
  }

  function _floodComp(comp){
    const d=player.damage; let lost=0;
    for(const c of (d.crew[comp]||[])){ if(c.status!=='killed'&&!c.displaced){c.status='killed';lost++;} }
    return lost;
  }

  function _injureComp(comp,severity){
    const d=player.damage;
    const fit=(d.crew[comp]||[]).filter(c=>c.status==='fit');
    const nKill=Math.max(0,Math.round(rand(1,severity*8)));
    const nWound=Math.max(0,Math.round(rand(0,severity*5)));
    let killed=0,wounded=0;
    for(let i=0;i<Math.min(nKill,fit.length);i++){fit[i].status='killed';killed++;}
    for(let i=killed;i<Math.min(killed+nWound,fit.length);i++){fit[i].status='wounded';wounded++;}
    return {killed,wounded};
  }

  // ── Hit compartment from impact angle ─────────────────────────────────────
  function hitCompartment(hitX,hitY){
    const dx=hitX-player.wx,dy=hitY-player.wy;
    const ang=Math.atan2(dy,dx);
    const rel=((ang-player.heading)+Math.PI*3)%(Math.PI*2)-Math.PI;
    if(rel>-Math.PI*0.25&&rel<Math.PI*0.25) return 'fore_ends';
    if(Math.abs(rel)<Math.PI*0.5)           return 'control_room';
    if(Math.abs(rel)>Math.PI*0.75)          return rand(0,1)>0.4?'engine_room':'reactor_comp';
    return rand(0,1)>0.5?'reactor_comp':'engine_room';
  }

  // ── Tower traversal ───────────────────────────────────────────────────────
  function canReachTower(comp,tower,d){
    const fwd=['fore_ends','control_room'];
    const aft=['engine_room','aft_ends'];
    const blocked=d.flooded.reactor_comp;
    if(tower==='fwd'){ if(fwd.includes(comp)) return true; return !blocked; }
    if(tower==='aft'){ if(aft.includes(comp)) return true; return !blocked; }
    return false;
  }

  // ── DC team helpers ───────────────────────────────────────────────────────
  function _teamEffectiveness(team){
    if(team.state==='lost') return 0;
    if(team.state!=='on_scene') return 0;
    return Math.max(0.2, 1.0 - team.casualties*0.2);
  }

  // Which team is assigned to a compartment?
  function teamAtComp(comp){
    const d=player.damage; if(!d) return null;
    for(const t of Object.values(d.teams)){
      if(t.state==='on_scene'&&t.location===comp) return t;
      if(t.state==='transit'&&t.destination===comp) return t;
    }
    return null;
  }

  // ── Assign a DC team to a compartment ────────────────────────────────────
  function assignTeam(teamId,comp){
    const d=player.damage; if(!d) return;
    const team=d.teams[teamId]; if(!team||team.state==='lost') return;


    // If same team already there, do nothing
    if((team.state==='on_scene'||team.state==='transit')&&(team.location===comp||team.destination===comp)) return;

    // Can team cross? (reactor flooded blocks crossing)
    const fwd=['fore_ends','control_room'];
    const aft=['engine_room','aft_ends'];
    const reactorFlooded=d.flooded.reactor_comp;
    if(reactorFlooded){
      const teamFwd=fwd.includes(team.location)||team.location==='reactor_comp';
      const destFwd=fwd.includes(comp)||comp==='reactor_comp';
      if(teamFwd!==destFwd){ COMMS.dc.cannotCross(team.label); return; }
    }

    const eta=TRAVEL[team.location]?.[comp]??60;
    const prevComp=team.location;
    team.state='transit';
    team.destination=comp;
    team.transitEta=eta;
    team.task=null;
    team.repairTarget=null;
    team.repairProgress=0;

    const etaStr=eta<=0?'on scene now':`ETA ${eta}s`;
    COMMS.dc.dispatched(team.label, COMP_DEF[comp].label, etaStr);
  }

  // ── Recall a DC team to home compartment ─────────────────────────────────
  function recallTeam(teamId){
    const d=player.damage; if(!d) return;
    const team=d.teams[teamId]; if(!team||team.state==='lost') return;
    if(team.state==='ready') return;
    const wasBlow=team.state==='blowing';
    team.state='ready';
    team.destination=null;
    team.task=null;
    team.repairTarget=null;
    team.repairProgress=0;
    COMMS.dc.recalled(team.label, wasBlow);
  }

  // ── Main hit function ─────────────────────────────────────────────────────
  function hit(amount,hitX,hitY,forceComp){
    if(player.invuln>0) return;
    player.invuln=2.0;
    const d=player.damage;
    const severity=clamp(amount/55,0,1);
    const comp=forceComp||(hitX!=null&&hitY!=null?hitCompartment(hitX,hitY):COMPS[Math.floor(rand(0,5))]);
    const def=COMP_DEF[comp];
    if(!def) return;
    const prev=d.strikes[comp];
    game.hitFlash=0.8;

    if(prev>=1){
      // ── SECOND HIT → INSTANT FLOOD ───────────────────────────────────
      d.strikes[comp]=2;
      d.flooded[comp]=true;
      d.flooding[comp]=1.0;
      d.floodRate[comp]=0;
      for(const sys of def.systems) d.systems[sys]='destroyed';
      const lost=_floodComp(comp);
      if(def.tower&&d.towers[def.tower]!=='destroyed') d.towers[def.tower]='destroyed';

      // DC teams: on_scene → evacuation roll; transit → keep going, will blow on arrival
      for(const team of Object.values(d.teams)){
        if(team.state==='on_scene'&&team.location===comp){
          // Evacuation roll — 75% escape
          if(Math.random()<0.75){
            team.state='ready';
            team.task=null;
            // Wound a team member to reflect the scramble
            if(team.casualties<3) team.casualties++;
            COMMS.dc.teamEvacuated(team.label, def.label);
          } else {
            team.state='lost';
            COMMS.dc.teamLost(team.label, def.label);
          }
        }
        // Teams in transit continue — they will arrive and start HP blow automatically
      }

      _alert(`${def.label} FLOODED`);
      COMMS.flood.uncontrolled(def.label, COMP_STATION[comp]||'ENG', lost);
      if(comp==='reactor_comp'){
        if(!player.scram&&typeof window.G.triggerScram==='function') window.G.triggerScram('damage');
        d.systems.reactor='destroyed';
        COMMS.flood.reactorFlooded();
      }
      _checkSinking();

    } else {
      // ── FIRST HIT → PROGRESSIVE FLOODING ────────────────────────────
      d.strikes[comp]=1;
      // Set flood rate based on severity (units/sec into 0–1 scale)
      d.floodRate[comp]=Math.max(d.floodRate[comp], severity*0.030);

      const sysList=[...def.systems].sort(()=>rand(-1,1));
      const numHit=severity>0.7?sysList.length:1;
      let reactorHit=false;
      for(let i=0;i<Math.min(numHit,sysList.length);i++){
        const steps=severity>0.85?2:1;
        const st=damageSystem(sysList[i],steps);
        _alert(`${SYS_LABEL[sysList[i]]} ${st.toUpperCase()}`);
        COMMS.sys.damaged(SYS_LABEL[sysList[i]], st, 1.5+i*0.6);
        if(sysList[i]==='reactor') reactorHit=true;
      }
      if(reactorHit&&!player.scram){
        if(typeof window.G.triggerScram==='function') window.G.triggerScram('damage');
        COMMS.reactor.scram('damage');
      }
      const cas=_injureComp(comp,severity);
      if(cas.killed>0||cas.wounded>0){
        _alert(`CASUALTIES — ${cas.killed} KIA${cas.wounded>0?`, ${cas.wounded} WND`:''}`);
        COMMS.sys.casualties(cas.killed, cas.wounded, def.label);
      }
      if(def.tower&&severity>0.7&&rand(0,1)>0.6&&d.towers[def.tower]==='nominal'){
        d.towers[def.tower]='damaged';
        _alert(`ESCAPE TOWER ${def.tower.toUpperCase()} DAMAGED`);
      }
      // Estimate time to flood without DC
      const tFlood=d.floodRate[comp]>0?Math.round(1/d.floodRate[comp]):999;
      const urgency=tFlood<60?'CRITICAL — ':tFlood<120?'URGENT — ':'';
      window.G.setCasualtyState('emergency');
      COMMS.crewState.emergencyStations('flood');
      COMMS.flood.firstHit(def.label, COMP_STATION[comp]||'ENG', urgency, tFlood);
    }
    player.hp=Math.max(1,100-Object.values(d.strikes).reduce((a,b)=>a+b,0)*15);
  }

  // ── Sinking check ─────────────────────────────────────────────────────────
  function _checkSinking(){
    const d=player.damage;
    const fl=d.flooded;
    const flCount=COMPS.filter(c=>fl[c]).length;
    const criticalDamage=flCount>=2||fl.control_room||(fl.reactor_comp&&fl.engine_room);
    if(criticalDamage){
      player.hp=0;
      _alert('CRITICAL FLOODING');
      window.G.setCasualtyState('escape');
      _escapeHalt();
      COMMS.crewState.escapeStations();
      COMMS.flood.critical();
    }
  }

  // ── Seal flooding (last resort) ───────────────────────────────────────────
  function sealFlooding(comp){
    const d=player.damage;
    if(!d||(d.flooding[comp]||0)<=0) return;
    // Kill any team inside
    for(const team of Object.values(d.teams)){
      if(team.state==='on_scene'&&team.location===comp){
        team.state='lost';
        COMMS.dc.teamLostSealed(team.label, COMP_DEF[comp].label);
      }
    }
    d.floodRate[comp]=0;
    d.flooding[comp]=0;
    for(const sys of COMP_DEF[comp].systems){
      if(d.systems[sys]==='nominal') d.systems[sys]='offline';
    }
    COMMS.flood.sealed(COMP_DEF[comp].label);
    dcLog(`${COMP_DEF[comp].label} — SEALED. All systems offline`);
  }

  // ── System helpers ────────────────────────────────────────────────────────
  function stateIndex(sys){ return STATES.indexOf(player.damage.systems[sys]); }
  function damageSystem(sys,steps=1){
    const d=player.damage;
    const next=Math.min(stateIndex(sys)+steps,STATES.length-1);
    d.systems[sys]=STATES[next];
    return STATES[next];
  }

  // ── Next damaged system to repair in a compartment (auto-priority) ────────
  function _nextRepairTarget(comp,d){
    const sysList=COMP_DEF[comp].systems;
    // Priority: worst state first, skip nominal only (destroyed is repairable post-blow)
    const repairable=sysList
      .filter(s=>d.systems[s]!=='nominal')
      .sort((a,b)=>stateIndex(b)-stateIndex(a));
    return repairable[0]||null;
  }

  // ── DC team tick ──────────────────────────────────────────────────────────
  function _tickTeams(dt,d){
    for(const team of Object.values(d.teams)){
      if(team.state==='lost') continue;

      team.statusT=Math.max(0,team.statusT-dt);

      // ── TRANSIT ────────────────────────────────────────────────────────
      if(team.state==='transit'){
        team.transitEta-=dt;
        if(team.transitEta<=0){
          const arrComp=team.destination;
          team.location=arrComp;
          team.destination=null;
          team.repairProgress=0;
          if(d.flooded[arrComp]){
            // Compartment fully flooded — work from outside with HP air
            team.state='blowing';
            team.task='blow';
            COMMS.dc.blow.started(team.label, COMP_DEF[arrComp].label);
          } else {
            team.state='on_scene';
            team.task=null;
            COMMS.dc.onScene(team.label, COMP_DEF[arrComp].label);
            if(d.floodRate[arrComp]>0||d.flooding[arrComp]>0.05){
              team.task='flood';
              COMMS.dc.floodingActive(team.label);
            } else {
              const sys=_nextRepairTarget(arrComp,d);
              if(sys){
                team.task='repair';
                team.repairTarget=sys;
                COMMS.dc.startRepair(team.label, SYS_LABEL[sys]);
              } else {
                team.task=null;
                team.state='ready';
                dcLog(`${team.label} — ${COMP_DEF[arrComp].label} secure. Standing by`);
              }
            }
          }
        }
        continue;
      }

      // ── ON SCENE ───────────────────────────────────────────────────────
      if(team.state==='on_scene'){
        const comp=team.location;
        const eff=_teamEffectiveness(team);

        // If compartment suddenly flooded while on_scene → evac roll (already handled
        // by the hit/flood path above, but guard here in case state is stale)
        if(d.flooded[comp]){
          // Transition to blowing from outside — don't re-kill
          team.state='blowing';
          team.task='blow';
          COMMS.dc.blow.started(team.label, COMP_DEF[comp].label);
          continue;
        }

        // ── FLOOD FIGHTING ──────────────────────────────────────────────
        const FLOOD_FIGHT_RATE=0.055; // units/sec reduction in floodRate
        if(team.task==='flood'||d.floodRate[comp]>0){
          team.task='flood';
          const reduction=FLOOD_FIGHT_RATE*eff;
          d.floodRate[comp]=Math.max(0,d.floodRate[comp]-reduction*dt);

          // Breach sealed — hand off draining to bilge pumps, move straight to repairs
          if(d.floodRate[comp]===0){
            // If flooding is essentially clear, return crew now; else bilge will trigger it
            if((d.flooding[comp]||0)<=0.05) _returnCrew(comp,d);
            team.task=null;
            const sys=_nextRepairTarget(comp,d);
            if(sys){
              team.task='repair'; team.repairTarget=sys; team.repairProgress=0;
              COMMS.dc.breachSealed(team.label, COMP_DEF[comp].label, sys, SYS_LABEL[sys]);
            } else {
              team.state='ready';
              COMMS.dc.breachSealed(team.label, COMP_DEF[comp].label, null, null);
            }
          } else {
            // Still flooding — periodic status
            if(team.statusT<=0){
              team.statusT=25;
              const pct=Math.round(d.flooding[comp]*100);
              const netRate=d.floodRate[comp];
              COMMS.dc.floodStatus(team.label, pct, netRate);
            }
          }
          continue;
        }

        // ── REPAIR — compartment-level shared job ───────────────────────
        // Count teams on scene here (for speed bonus)
        const teamsOnScene=Object.values(d.teams).filter(t=>t.state==='on_scene'&&t.location===comp).length;
        // Speed: 1 team = 1.0x, 2 teams = 1.4x (both teams contribute, not double)
        const repairSpeed=eff*(teamsOnScene>=2?1.4:1.0);

        // Get or create a repair job for this compartment
        let job=d.repairJobs[comp];
        // Only reset job if it's missing or the current system reached nominal (done)
        // NOT on 'destroyed' — that's a valid repair target now
        if(!job||d.systems[job.sys]==='nominal'){
          const sys=_nextRepairTarget(comp,d);
          if(sys){
            const jobIsNew=!job||job.sys!==sys;
            d.repairJobs[comp]=job={sys,progress:0,totalTime:REPAIR_TIME[d.systems[sys]]||45};
            if(jobIsNew){
              COMMS.dc.startRepair(team.label, SYS_LABEL[sys]);
            }
          } else {
            d.repairJobs[comp]=null;
            team.task=null;
            team.state='ready';
            COMMS.dc.allSecure(team.label, COMP_DEF[comp].label);
            // Check if entire boat is now clear — if so, secure from emergency stations
            if(window.G.game.casualtyState==='emergency'){
              const anyFlood = COMPS.some(cp => (d.flooding[cp]||0) > 0.001);
              const anyTeamActive = Object.values(d.teams).some(t => t.state!=='ready' && t.state!=='lost');
              if(!anyFlood && !anyTeamActive){
                window.G.setCasualtyState('normal');
                COMMS.crewState.casualtyControlled('flood');
              }
            }
            continue;
          }
        }
        job=d.repairJobs[comp];
        if(job){
          team.task='repair';
          team.repairTarget=job.sys;  // keep team display in sync
          // Only the "lead" team (first alphabetically) advances progress — prevents double counting
          const teamsList=Object.values(d.teams).filter(t=>t.state==='on_scene'&&t.location===comp);
          const isLead=teamsList[0]===team;
          if(isLead){
            job.progress+=repairSpeed*dt;
            // Periodic status (one message from lead team only)
            if(team.statusT<=0){
              team.statusT=30;
              const pct=Math.round(job.progress/job.totalTime*100);
              COMMS.dc.repairProgress(team.label, SYS_LABEL[job.sys], pct, teamsOnScene>=2);
            }
            if(job.progress>=job.totalTime){
              const sys=job.sys;
              const cur=stateIndex(sys);
              if(cur>0){
                d.systems[sys]=STATES[cur-1];
                const restored=STATES[cur-1];
                COMMS.dc.repairComplete(team.label, SYS_LABEL[sys], restored, teamsOnScene>=2);
                _alert(`${SYS_LABEL[sys]} REPAIRED`);
                // High-energy repair risk
                if(HIGH_ENERGY_SYS.has(sys)&&Math.random()<0.07){
                  const compCrew=(d.crew[comp]||[]).filter(c=>c.status==='fit');
                  if(compCrew.length>0){
                    const victim=compCrew[Math.floor(Math.random()*compCrew.length)];
                    victim.status=Math.random()<0.35?'killed':'wounded';
                    team.casualties=Math.min(4,team.casualties+1);
                    dcLog(`${team.label} — CASUALTY during ${SYS_LABEL[sys]} repair. ${victim.name} ${victim.status}`);
                  }
                }
              }
              d.repairJobs[comp]=null;
            }
          }
        }
      }

      // ── HP AIR BLOW (team outside flooded compartment) ───────────────────
      if(team.state==='blowing'){
        const comp=team.location;
        if(!d.flooded[comp]){
          // Compartment no longer flooded (e.g. patched by other means) — enter normally
          team.state='on_scene'; team.task=null;
          COMMS.dc.blow.accessible(team.label, COMP_DEF[comp].label);
          continue;
        }
        // Drain rate: ~0.008/s (~125s full drain). Slow and loud.
        const BLOW_RATE=0.008;
        d.flooding[comp]=Math.max(0,(d.flooding[comp]||0)-BLOW_RATE*dt);
        // Periodic status
        if(team.statusT<=0){
          team.statusT=20;
          const pct=Math.round(d.flooding[comp]*100);
          COMMS.dc.blow.progress(team.label, COMP_DEF[comp].label, pct);
        }
        // Once flooding drops below 15%, team can crack the door and enter
        if(d.flooding[comp]<=0.15){
          d.flooded[comp]=false;
          d.floodRate[comp]=0;
          team.state='on_scene';
          team.task='flood'; // finish clearing residual water
          COMMS.dc.blow.complete(team.label, COMP_DEF[comp].label);
          _alert(`${COMP_DEF[comp].label} RE-ENTERED`);
          _returnCrew(comp,d);
        }
        continue;
      }
    }
  }

  // ── Escape ────────────────────────────────────────────────────────────────
  function _depthM(){
    return player.depth||0;  // already in metres
  }
  function canTCE(){
    const d=player.damage; if(!d) return false;
    if(_depthM()>200) return false;
    return d.towers.fwd!=='destroyed'||d.towers.aft!=='destroyed';
  }
  function _survChance(type){
    const depth=_depthM();
    if(type==='tce'){
      if(depth<=80)  return 0.96;
      if(depth<=120) return 0.88;
      if(depth<=160) return 0.65;
      if(depth<=200) return 0.35;
      return 0.05;
    }
    if(depth<=50)  return 0.82;
    if(depth<=80)  return 0.65;
    if(depth<=120) return 0.42;
    if(depth<=180) return 0.20;
    if(depth<=250) return 0.08;
    if(depth<=300) return 0.03;
    return 0.01;
  }
  function _escapeHalt(){
    const p = window.G.player;
    if(p){ p.speedOrderKts=0; p.speedDir=0; p.depthOrder=0; }
    window.PANEL?.snapToAllStop();
    // Emergency blow — surface the boat, give crew the best chance
    window.PANEL?.emergencyBlowBallast?.();

    // CO's final log entry — contextual, factual, one line of humanity at the end
    const d=p?.damage;
    const depth=Math.round(p?.depth??0);
    const COMP_NAMES={fore_ends:'torpedo room',control_room:'control room',reactor_comp:'reactor',engine_room:'engine room',aft_ends:'aft ends'};
    const floodedComps=d?['fore_ends','control_room','reactor_comp','engine_room','aft_ends'].filter(cp=>d.flooded[cp]).map(cp=>COMP_NAMES[cp]):[];
    const floodStr=floodedComps.length===0?'structural failure'
      :floodedComps.length===1?`flooding in ${floodedComps[0]}`
      :`flooding in ${floodedComps.slice(0,-1).join(', ')} and ${floodedComps[floodedComps.length-1]}`;
    const fit=window.DMG?.totalFit?.()??'?';
    const total=window.DMG?.totalCrew?.()??'?';
    const spd=Math.round(p?.speed??0);
    const trimNote=spd<=1?'no way on':spd<=5?'slow ahead':'making way';
    const closers=['Good luck to you all.','It has been an honour.','God speed.','That will be all.'];
    const closer=closers[Math.floor((window.G.game?.missionT??0)*7+depth)%closers.length];
    window.G.addLog('CONN',
      `CO — ${floodStr}, depth ${depth}m, ${trimNote}. ${fit} of ${total} hands fit. All hands, abandon ship. ${closer}`,
      window.COMMS.P.CRIT
    );
  }

  function initiateEscape(type){
    const d=player.damage; if(!d||d.escapeState) return;
    if(type==='tce'&&!canTCE()){COMMS.escape.tceNotViable();return;}
    d.escapeType=type;
    d.escapeDepthM=Math.round(_depthM());
    d.escapeT=0; d.escapeSurvivors=0; d._tceProcessed=0;
    if(type==='tce'){
      d.escapeQueue=[];
      const towers=[];
      if(d.towers.fwd!=='destroyed') towers.push('fwd');
      if(d.towers.aft!=='destroyed') towers.push('aft');
      for(const comp of COMPS){
        for(const c of (d.crew[comp]||[])){
          if(c.status==='killed') continue;
          let t=null;
          const pref=[COMP_DEF[comp].tower,...towers].filter(Boolean);
          for(const tw of pref){ if(towers.includes(tw)&&canReachTower(comp,tw,d)){t=tw;break;} }
          if(t) d.escapeQueue.push({crewman:c,tower:t});
          else c.status='killed';
        }
      }
      d.escapeState='tce_running';
      window.G.setCasualtyState('escape');
      _escapeHalt();
      COMMS.escape.tce();
    } else {
      d.escapeState='rush_running';
      d.escapeT=12;
      window.G.setCasualtyState('escape');
      _escapeHalt();
      COMMS.escape.rush();
    }
  }
  function _resolveEscape(){
    const d=player.damage;
    const sc=_survChance(d.escapeType);
    let survivors=0;
    for(const comp of COMPS){
      for(const c of (d.crew[comp]||[])){
        if(c.status==='killed') continue;
        if(Math.random()<sc) survivors++;
        else c.status='killed';
      }
    }
    const co=(d.crew.control_room||[]).find(c=>c.rating==='CDR');
    const playerSurvives=co?.status==='killed'?false:Math.random()<Math.min(sc+0.15,0.99);
    d.escapeSurvivors=survivors;
    d.escapePlayerSurvived=playerSurvives;
    d.escapeState='complete';
    game.over=true;
    game.escapeResolved=true;
  }

  // ── Crush depth ───────────────────────────────────────────────────────────
  function applyHullStress(amount){
    const d=player.damage; if(!d) return;
    const comp=COMPS[Math.floor(Math.random()*COMPS.length)];
    d.flooding[comp]=Math.min(1,(d.flooding[comp]||0)+amount*2.5);
    player.hp=Math.max(0,(player.hp||100)-amount*8);
  }

  // ── Main tick ─────────────────────────────────────────────────────────────
  // ── Return displaced crew when compartment clears ──────────────────────────
  function _returnCrew(comp,d){
    if(d._evacuated) d._evacuated[comp]=false;
    const returnees=(d.crew[comp]||[]).filter(cr=>cr.displaced&&cr.status!=='killed');
    if(!returnees.length) return;
    for(const cr of returnees) cr.displaced=false;
    COMMS.flood.crewReturn(COMP_DEF[comp].label, COMP_STATION[comp]||'ENG', returnees.length);
  }

  function tick(dt){
    const d=player.damage; if(!d) return;

    // Progressive flooding
    for(const comp of COMPS){
      if(d.flooded[comp]) continue;
      const rate=d.floodRate[comp]||0;
      if(rate>0){
        d.flooding[comp]=Math.min(1,(d.flooding[comp]||0)+rate*dt);
        // Passive bilge pumps slow minor flooding a tiny bit
        d.floodRate[comp]=Math.max(0,rate-0.0002*dt);
        // Crew evacuation trigger — at 65% flooding, crew attempt to evacuate
        if(d.flooding[comp]>=0.65&&!(d._evacuated||{})[comp]){
          if(!d._evacuated) d._evacuated={};
          d._evacuated[comp]=true;
          const neighbors=EVAC_TO[comp]||[];
          const compCrew=(d.crew[comp]||[]).filter(cr=>cr.status==='fit'||cr.status==='wounded');
          let evacuated=0,trapped=0;
          for(const cr of compCrew){
            // 80% chance per crew to make it out if a neighbour isn't also flooded
            const openNeighbour=neighbors.find(n=>!d.flooded[n]);
            if(openNeighbour&&Math.random()<0.80){
              cr.displaced=true;  // alive but out of compartment
              evacuated++;
            } else {
              cr.status='killed';
              trapped++;
            }
          }
          if(evacuated>0||trapped>0){
            _alert('CREW EVACUATING '+COMP_DEF[comp].label.toUpperCase());
            COMMS.flood.evacuating(COMP_DEF[comp].label, COMP_STATION[comp]||'ENG', evacuated, trapped);
          }
        }
        // Compartment fully flooded?
        if(d.flooding[comp]>=1.0){
          d.flooded[comp]=true;
          d.floodRate[comp]=0;
          // Systems waterlogged but not destroyed — repairable after blow-down
          for(const sys of COMP_DEF[comp].systems){
            if(d.systems[sys]!=='destroyed') d.systems[sys]='offline';
          }
          const lost=_floodComp(comp);
          // DC teams: on_scene → evac roll; transit → keep going, will blow on arrival
          // Mark all surviving compartment crew as displaced
          if(!d._evacuated) d._evacuated={};
          d._evacuated[comp]=true;
          for(const cr of (d.crew[comp]||[])){
            if(cr.status!=='killed') cr.displaced=true;
          }
          for(const team of Object.values(d.teams)){
            if(team.state==='on_scene'&&team.location===comp){
              if(Math.random()<0.75){
                team.state='ready'; team.task=null;
                if(team.casualties<3) team.casualties++;
                dcLog(`${team.label} — EVACUATED ${COMP_DEF[comp].label}. Casualties taken`);
              } else {
                team.state='lost';
                COMMS.dc.teamLost(team.label, COMP_DEF[comp].label);
              }
            }
            // Transit teams continue to destination and will start HP blow
          }
          _alert(`${COMP_DEF[comp].label} FLOODED`);
          COMMS.flood.uncontrolled(COMP_DEF[comp].label, COMP_STATION[comp]||'ENG', lost);
          if(comp==='reactor_comp'&&!player.scram&&typeof window.G.triggerScram==='function'){
            window.G.triggerScram('damage');
            COMMS.flood.reactorFlooded();
          }
          d.strikes[comp]=2;
          _checkSinking();
        }
      } else if((d.flooding[comp]||0)>0&&rate===0){
        // Drain very slowly when rate=0 (bilge pumps)
        d.flooding[comp]=Math.max(0,(d.flooding[comp]||0)-0.012*dt);
        if(d.flooding[comp]<=0) _returnCrew(comp,d);
      }
    }

    // DC teams
    _tickTeams(dt,d);

    // Crew slowly recover from wounds
    if(Math.random()<0.0008*dt*60){
      for(const comp of COMPS){
        for(const c of (d.crew[comp]||[])){
          if(c.status==='wounded'&&Math.random()<0.3){c.status='fit';break;}
        }
      }
    }

    // Alert tick
    for(let i=d.alerts.length-1;i>=0;i--){
      d.alerts[i].t-=dt;
      if(d.alerts[i].t<=0) d.alerts.splice(i,1);
    }

    // Sinking countdown — reserved for future buoyancy system

    // TCE cycling
    if(d.escapeState==='tce_running'){
      d.escapeT+=dt;
      const CYCLE=5.0;
      const towers=[d.towers.fwd!=='destroyed'?'fwd':null,d.towers.aft!=='destroyed'?'aft':null].filter(Boolean);
      const cyclesDone=Math.floor(d.escapeT/CYCLE);
      if(cyclesDone>d._tceProcessed){
        const newCycles=cyclesDone-d._tceProcessed;
        d._tceProcessed=cyclesDone;
        const sc=_survChance('tce');
        for(let p=0;p<newCycles*towers.length*2;p++){
          const entry=d.escapeQueue.shift();
          if(!entry) break;
          if(Math.random()<sc) d.escapeSurvivors++;
          else entry.crewman.status='killed';
        }
        // Progress entry after each cycle
        const remaining=d.escapeQueue.length;
        if(remaining>0){
          window.G.addLog('CONN',
            `Escape — ${d.escapeSurvivors} away. ${remaining} remaining at towers.`,
            window.COMMS.P.MED
          );
        }
        if(remaining===0) _resolveEscape();
      }
    }
    if(d.escapeState==='rush_running'){
      d.escapeT-=dt;
      // Single midpoint progress call
      if(!d._rushMidLogged && d.escapeT<=6){
        d._rushMidLogged=true;
        const total=COMPS.reduce((a,cp)=>{
          return a+(d.crew[cp]||[]).filter(x=>x.status!=='killed').length;
        },0);
        window.G.addLog('CONN',
          `Escape — hands in the water. ${total} attempting escape.`,
          window.COMMS.P.MED
        );
      }
      if(d.escapeT<=0) _resolveEscape();
    }
  }

  // ── Effects ───────────────────────────────────────────────────────────────
  function getEffects(){
    const d=player.damage;
    if(!d) return _defaults();
    const sys=d.systems;
    const totalFlood=Object.values(d.flooding).reduce((a,b)=>a+b,0);
    let speedCap=Infinity;
    if(sys.propulsion==='destroyed') speedCap=2;
    else if(sys.propulsion==='offline') speedCap=5;
    else if(sys.propulsion==='degraded') speedCap=15;
    if(sys.reactor==='offline'||sys.reactor==='destroyed') speedCap=Math.min(speedCap,7);
    let sonarRangeMult=1.0;
    if(sys.sonar_hull==='offline'||sys.sonar_hull==='destroyed') sonarRangeMult=0.0;
    else if(sys.sonar_hull==='degraded') sonarRangeMult=0.55;
    let bearingNoiseMult=1.0;
    if(sys.sonar_hull==='degraded') bearingNoiseMult=2.5;
    else if(sys.sonar_hull==='offline'||sys.sonar_hull==='destroyed') bearingNoiseMult=5.0;
    let reloadMult=1.0;
    if(sys.tubes==='degraded') reloadMult=1.5;
    else if(sys.tubes==='offline') reloadMult=3.0;
    else if(sys.tubes==='destroyed') reloadMult=999;
    reloadMult*=(1+(1-crewEfficiency('weapons'))*0.6);
    let depthRateMult=1.0;
    if(sys.ballast==='degraded') depthRateMult=0.55;
    else if(sys.ballast==='offline'||sys.ballast==='destroyed') depthRateMult=0.18;
    // HP air blow: loud compressors — significant continuous noise penalty
    const blowingTeams=Object.values(d.teams||{}).filter(t=>t.state==='blowing').length;
    const blowNoise=blowingTeams*0.40;
    const noisePenalty=Math.min(0.65, totalFlood*0.10 + blowNoise);
    let tdcErrDeg=0;
    if(sys.tdc_comp==='degraded') tdcErrDeg=4;
    else if(sys.tdc_comp==='offline'||sys.tdc_comp==='destroyed') tdcErrDeg=10;
    let tubesAvail=C.player.torpTubes||4;
    if(sys.tubes==='destroyed') tubesAvail=Math.max(0,tubesAvail-2);
    else if(sys.tubes==='offline') tubesAvail=Math.max(1,tubesAvail-1);
    const towedOk=sys.towed_array==='nominal'||sys.towed_array==='degraded';
    const periscopeOk=sys.periscope==='nominal'||sys.periscope==='degraded';
    const fit=totalFit(),total=totalCrew();
    const integ=total>0?fit/total:1;
    const maxDepth=integ<0.35?120:integ<0.55?250:(C.world?.maxDepth||500);
    return {speedCap,sonarRangeMult,bearingNoiseMult,reloadMult,depthRateMult,noisePenalty,tdcErrDeg,tubesAvail,towedOk,periscopeOk,maxDepth,totalFlood};
  }
  function _defaults(){
    return {speedCap:Infinity,sonarRangeMult:1.0,bearingNoiseMult:1.0,reloadMult:1.0,depthRateMult:1.0,noisePenalty:0,tdcErrDeg:0,tubesAvail:C.player.torpTubes||4,towedOk:true,periscopeOk:true,maxDepth:C.world?.maxDepth||500,totalFlood:0};
  }

  function _alert(text){ player.damage.alerts.push({text,t:5.0}); }

  // ── Buoyancy/trim state ───────────────────────────────────────────────────
  // Returns {trim, buoyancy} computed live from current flood levels.
  // trim:    negative = bow-heavy, positive = stern-heavy
  // buoyancy: total flood load (0 = clean, 2.0 = normal ballast limit,
  //           2.5 = emergency blow overwhelmed)
  function getTrimState(){
    const d = player.damage;
    if(!d) return {trim:0, buoyancy:0};
    const levers = C.player.trimLevers || {};
    let trim=0, buoyancy=0;
    for(const comp of COMPS){
      const f = d.flooding[comp]||0;
      trim    += f * (levers[comp]||0);
      buoyancy += f;
    }
    return {trim, buoyancy};
  }

  // Draw HPA pressure — returns strength 0-1.
  // Group pressure drawn first; reserve tops up shortfall for blow operations only.
  function drawHPA(cost, allowReserve=false){
    const d = player.damage;
    if(!d?.hpa) return 1.0;
    const hpa = d.hpa;
    const maxP = window.CONFIG?.player?.hpa?.maxPressure || 207;
    let drawn = 0;
    if(hpa.pressure > 0){
      const take = Math.min(hpa.pressure, cost);
      hpa.pressure -= take;
      drawn += take;
    }
    if(drawn < cost && allowReserve && hpa.reserve > 0){
      const fromRes = Math.min(hpa.reserve, cost - drawn);
      hpa.reserve -= fromRes;
      drawn += fromRes;
      if(hpa.reserve <= 0){
        window.COMMS?.trim?.reserveHPACommitted?.();
      } else {
        window.COMMS?.trim?.reserveHPACommitted?.();  // fire once when reserve is drawn
      }
    }
    return Math.min(1, drawn / cost);
  }

  window.DMG={
    initDamage,hit,tick,applyHullStress,
    sealFlooding,getEffects,maxDCTeams,crewEfficiency,
    totalFit,totalWounded,totalKilled,totalCrew,
    assignTeam,recallTeam,teamAtComp,
    initiateEscape,canTCE,
    getTrimState,drawHPA,
    COMP_DEF,COMPS,STATES,SYS_LABEL,
    COMP_SYSTEMS:Object.fromEntries(Object.entries(COMP_DEF).map(([k,v])=>[k,v.systems])),
    COMPARTMENTS:COMPS,
  };
  } catch(e) { console.error("DAMAGE.JS THREW:", e.message, e.stack); }
})();