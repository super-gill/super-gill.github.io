'use strict';

import { CONFIG } from '../config/constants.js';
import { rand } from '../utils/math.js';
import { enemies } from '../state/sim-state.js';
import { session, addLog, setTacticalState } from '../state/session-state.js';

const C = CONFIG;

// ── Lazy bindings (set via bindScenario) ────────────────────────────────
let _COMMS = null;
let _AI = null;

export function bindScenario(deps) {
  if (deps.COMMS) _COMMS = deps.COMMS;
  if (deps.AI)    _AI    = deps.AI;
}

// ── Scenario spawning ───────────────────────────────────────────────────

export function spawnScenario(scenario){
  session.scenario=scenario;
  enemies.length=0;
  if(scenario==='duel'){
    // 1v1 -- single capable hunter, close range, no pinger
    const brg=rand(0,Math.PI*2);
    _AI.spawnSub(brg, rand(2800,3800), 'hunter', 0);
    _COMMS.tactical.battleStations('single');
    _COMMS.tactical.contact(Math.round(((brg*180/Math.PI)+360)%360).toString().padStart(3,'0')+'°');
  } else if(scenario==='ambush'){
    // Wolfpack ambush -- already surrounded, close, all prosecuting from the start
    const count=4;
    for(let i=0;i<count;i++){
      const brg=(Math.PI*2/count)*i+rand(-0.3,0.3);
      const role=i<2?'hunter':'interceptor';
      const sub=_AI.spawnSub(brg, rand(2500,3500), role, 0);
      // Pre-brief them -- they know roughly where the player is
    }
    _COMMS.tactical.battleStations('barrier');
  } else if(scenario==='patrol'){
    // Barrier patrol -- line of 2 pingers + 2 hunters across a fixed bearing, spread wide
    const barrierBrg=rand(0,Math.PI*2);
    const roles=['pinger','hunter','hunter','pinger'];
    for(let i=0;i<roles.length;i++){
      _AI.spawnSub(barrierBrg, rand(4500,6000), roles[i], (i-1.5)*1400);
    }
    _COMMS.tactical.battleStations('patrol');
  } else if(scenario==='ssbn_hunt'){
    // Hunt the SSBN -- Typhoon-class boomer with SSN escort
    const ssbnBrg=rand(0,Math.PI*2);
    const ssbnDist=rand(5000,7000);
    _AI.spawnSSBN(ssbnBrg, ssbnDist);
    // Escort SSN -- hunter, positioned between player and SSBN
    const escortBrg=ssbnBrg+rand(-0.4,0.4);
    const escortDist=ssbnDist-rand(1200,2000); // closer to player, screening
    _AI.spawnSub(escortBrg, escortDist, 'hunter', rand(-400,400));
    _COMMS.tactical.battleStations('ssbn_hunt');
  } else if(scenario==='boss_fight'){
    // Boss fight -- single Zeta-class SSN, close enough to be in the fight early
    const brg=rand(0,Math.PI*2);
    _AI.spawnZeta(brg, rand(3000,4500));
    _COMMS.tactical.battleStations('boss_fight');
  } else if(scenario==='asw_taskforce'){
    // ASW taskforce -- surface warships actively hunting the player
    const grpBrg=rand(0,Math.PI*2);
    const grpDist=rand(4000,5500);
    // Kappa destroyer -- flagship, centre
    _AI.spawnKappa(grpBrg, grpDist, 0);
    // Two Iota frigates -- primary ASW, flanking
    _AI.spawnIota(grpBrg, grpDist, -1200);
    _AI.spawnIota(grpBrg, grpDist, 1200);
    // Lambda corvette -- trail screen
    _AI.spawnLambda(grpBrg, grpDist+800, rand(-600,600));
    _COMMS.tactical.battleStations('asw_taskforce');
  } else if(scenario==='free_run'){
    // No enemies -- open water for systems testing
    _COMMS.nav.speedReport(0);
  } else {
    session.wave=0; session.waveDelay=0;
    spawnWave(1);
  }
}

// ── Wave spawning ───────────────────────────────────────────────────────

export function spawnWave(waveNum){
  session.wave=waveNum;
  if(waveNum > 1 && setTacticalState('action')){
    _COMMS.crewState.actionStations('wave');
  }
  session.groupState='patrol';
  session.prosecutingT=0;

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
    _AI.spawnSub(groupBrg, dist, roles[i], offsets[i]);
  }

  const waveLabel=waveNum===1?'Conn, Sonar \u2014 first contacts. Patrol group, classify submerged'
    :waveNum===2?'Conn, Sonar \u2014 new group bearing. Prosecution force, classify submerged'
    :'Conn, Sonar \u2014 new contacts. Full group, classify submerged';
  _COMMS.tactical.waveReport(waveLabel, count, Math.round(((groupBrg*180/Math.PI)+360)%360).toString().padStart(3,'0')+'°');
}

// ── Wave management (group state + wave clear) ──────────────────────────

export function tickWaveManagement(dt){
  // Wave management only applies in wave scenario
  if((session.scenario||'waves')==='waves'){
  // Group state: any enemy crossing susEngage flips to prosecuting
  const wasPatrol = session.groupState==='patrol';
  let anyEngaged = false;
  for(const e of enemies){
    if(!e.dead && e.suspicion >= C.enemy.susEngage){ anyEngaged=true; break; }
  }
  if(anyEngaged && wasPatrol){
    session.groupState='prosecuting';
    session.prosecutingT=0;
    _COMMS.tactical.prosecuting();
    if(setTacticalState('action')){
      _COMMS.crewState.actionStations('contact');
    }
  }
  if(session.groupState==='prosecuting'){
    session.prosecutingT+=dt;
    // Decay back to patrol if no enemy has suspicion above investigate for 90s
    let stillAware=false;
    for(const e of enemies){
      if(!e.dead && e.suspicion>=C.enemy.susInvestigate){ stillAware=true; break; }
    }
    if(!stillAware && session.prosecutingT>90){
      session.groupState='patrol';
      session.prosecutingT=0;
      _COMMS.tactical.contactLost();
    }
  }

  // Wave clear -- all combatant enemies dead (civilians don't count)
  const combatantsLeft=enemies.some(e=>!e.civilian&&!e.dead);
  if(!combatantsLeft){
    if(session.waveDelay<=0 && session.wave>0){
      session.waveDelay=C.enemy.waveDelay;
      _COMMS.tactical.areaClear(session.wave);
      if(setTacticalState('cruising')){
        _COMMS.crewState.standDown('action');
      }
    }
    if(session.waveDelay>0){
      session.waveDelay-=dt;
      if(session.waveDelay<=0){
        spawnWave(session.wave+1);
      }
    }
  }
  } // end waves-only
}

// ── Victory detection ───────────────────────────────────────────────────

export function tickVictory(dt){
  const sc=session.scenario;
  if(!session._victory && sc!=='waves' && sc!=='free_run'){

    // SSBN hunt -- victory when the boomer is sunk (escort is optional)
    if(sc==='ssbn_hunt' && !session._ssbnVictory){
      const ssbnAlive=enemies.some(e=>e.role==='ssbn'&&!e.dead);
      if(!ssbnAlive){
        session._ssbnVictory=true;
        session._victory=true;
        session.score+=300;
        addLog('CONN','Conn \u2014 break-up noises confirmed. SSBN is destroyed. Mission complete.');
        addLog('CONN','Conn \u2014 well done. Set course for home.');
      }
    }

    // ASW taskforce -- victory when all warships are sunk
    else if(sc==='asw_taskforce' && !session._aswVictory){
      const shipsAlive=enemies.some(e=>e.type==='boat'&&!e.civilian&&!e.dead);
      if(!shipsAlive){
        session._aswVictory=true;
        session._victory=true;
        session.score+=400;
        addLog('CONN','Conn \u2014 all surface contacts destroyed. ASW taskforce neutralised.');
        addLog('CONN','Conn \u2014 well done. Clear the datum and set course for home.');
      }
    }

    // Boss fight -- victory when the Zeta is destroyed
    else if(sc==='boss_fight' && !session._bossVictory){
      const zetaAlive=enemies.some(e=>e.role==='zeta'&&!e.dead);
      if(!zetaAlive){
        session._bossVictory=true;
        session._victory=true;
        session.score+=500;
        addLog('CONN','Conn \u2014 confirmed, Zeta-class is destroyed. That\'s one for the history books.');
        addLog('CONN','Conn \u2014 secure from battle stations. Set course for home.');
      }
    }

    // Duel / Ambush / Patrol -- victory when all non-civilian enemies are dead
    else if(sc==='duel'||sc==='ambush'||sc==='patrol'){
      const alive=enemies.some(e=>!e.civilian&&!e.dead);
      if(!alive){
        session._victory=true;
        const bonus=sc==='duel'?150:sc==='ambush'?350:250;
        session.score+=bonus;
        if(sc==='duel'){
          addLog('CONN','Conn \u2014 contact destroyed. Well fought. Secure from battle stations.');
        } else if(sc==='ambush'){
          addLog('CONN','Conn \u2014 all contacts destroyed. We made it through the ambush. Secure from battle stations.');
        } else {
          addLog('CONN','Conn \u2014 barrier patrol neutralised. All contacts destroyed. Set course for home.');
        }
      }
    }
  }

  // -- Win delay timer -- let COMMS play before showing win screen -----------
  if(session._victory && !session.won){
    session._wonDelayT=(session._wonDelayT||0)+dt;
    if(session._wonDelayT>=8.0){
      session.won=true;
    }
  }
}
