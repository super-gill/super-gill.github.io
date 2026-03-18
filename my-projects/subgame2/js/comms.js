(() => {
  'use strict';

  // ── Priority constants ───────────────────────────────────────────────────
  const P = { NORMAL:0, MED:1, CRIT:2 };

  // ── Wrappers so comms.js can pass priority cleanly ───────────────────────
  function log(cat, text, priority=P.NORMAL)  { window.G.addLog(cat, text, priority); }
  function qlog(cat, text, delay, priority=P.NORMAL) { window.G.queueLog(cat, text, delay, priority); }
  function msg(text, t=1.2)                   { window.G.setMsg(text, t); }

  // ── DC log (events panel) ────────────────────────────────────────────────
  function dcLog(text, priority=P.NORMAL) {
    const G = window.G;
    if (!G.game.dcLog) G.game.dcLog = [];
    G.game.dcLog.push({ t: G.game.missionT || 0, text, priority });
    if (G.game.dcLog.length > 120) G.game.dcLog.shift();
  }

  // ── Station → compartment map ────────────────────────────────────────────
  const COMP_STATION = {
    fore_ends:    'TOR',
    control_room: 'CONN',
    aux_section:  'AUX',
    reactor_comp: 'REA',
    engine_room:  'MAN',
    aft_ends:     'ENG',
  };

  // ════════════════════════════════════════════════════════════════════════
  // FLOOD EVENTS
  // ════════════════════════════════════════════════════════════════════════
  const flood = {
    depthSeep(compLabel, station, tFlood) {
      // Structural weeping — watchkeeper stays at post, reports calmly then urgently
      log(station, `Conn, ${station} — structural weeping in ${compLabel}. Pressure seep, rate increasing. Estimate ${tFlood}s to compartment loss without DC.`, P.CRIT);
      msg(`DEPTH FLOODING — ${compLabel}`, 2.5);
      qlog('CONN', `All stations, Conn — depth flooding casualty. ${compLabel}. DC teams, close up.`, 1.0, P.CRIT);
    },
    firstHit(compLabel, station, urgency, tFlood) {
      const t = Math.min(tFlood, 999);
      log(station, `Conn, ${station} — flooding! Flooding in ${compLabel}!`, P.CRIT);
      qlog('CONN', `Conn — all hands — Emergency stations, emergency stations, emergency stations: Flood, flood, flood. Flooding in ${compLabel}. DC teams close up.`, 1.0, P.CRIT);
      msg(`FLOODING — ${compLabel}`, 2.5);
      dcLog(`FLOODING — ${compLabel} | ${urgency} ~${t}s to loss without DC`, P.CRIT);
    },
    secondBreach(compLabel, station) {
      log(station, `Conn, ${station} — second breach! ${compLabel} flooding fast! Evacuate!`, P.CRIT);
      qlog('CONN', `All stations, Conn — second breach in ${compLabel}. Flooding critical. All hands clear of ${compLabel}.`, 1.0, P.CRIT);
      msg(`${compLabel} — SECOND BREACH`, 3.0);
    },
    uncontrolled(compLabel, station, lost) {
      log(station, `Conn, ${station} — flooding uncontrolled! ${compLabel} lost!`, P.CRIT);
      qlog('CONN', `Conn — all hands, close all watertight doors. ${compLabel} lost${lost > 0 ? `. ${lost} hands` : ''}.`, 1.5, P.CRIT);
      msg(`${compLabel} FLOODED`, 3.0);
    },
    critical() {
      qlog('CONN', 'Conn — critical flooding. Loss of trim expected. All hands maintain emergency stations, stand by for orders.', 1.5, P.CRIT);
      msg('CRITICAL FLOODING', 4.0);
    },
    evacuating(compLabel, station, out, trapped) {
      log(station, `Conn, ${station} — evacuating ${compLabel}! Flooding critical!`, P.CRIT);
      if (trapped > 0) qlog('CONN', `All stations — ${compLabel} evacuating. ${out} clear, ${trapped} missing`, 1.5, P.CRIT);
      else             qlog('CONN', `All stations — ${compLabel} personnel clear. ${out} accounted for`, 1.5, P.MED);
    },
    closeWTDs(compLabel) {
      qlog('CONN', `All stations, Conn — close all watertight doors. Flooding in ${compLabel}`, 2.5, P.CRIT);
    },
    wtdClosed(station, doorLabel, delay) {
      qlog(station, `Conn, ${station} — WTD ${doorLabel} closed`, delay, P.MED);
    },
    openWTDs() {
      qlog('CONN', 'All stations, Conn — casualty controlled. Open all watertight doors. Resume normal watch.', 2.0, P.MED);
    },
    wtdOpen(station, doorLabel, delay) {
      qlog(station, `Conn, ${station} — WTD ${doorLabel} open`, delay, P.NORMAL);
    },
    crewReturn(compLabel, station, n) {
      log('CONN', `All stations, Conn — ${compLabel} secure. Watchkeepers close up.`);
      qlog(station, `Conn, ${station} — manned and ready`, 0.5);
    },
    reactorFlooded() {
      log('MANV', 'Conn, Manoeuvring — reactor SCRAM, primary coolant gone. EPM', P.CRIT);
      msg('REACTOR FLOODED', 2.5);
    },
    sealed(compLabel) {
      log('ENG', `Conn, DC — ${compLabel} sealed. Watertight`, P.MED);
      msg(`${compLabel} SEALED`, 1.5);
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // DAMAGE CONTROL TEAMS
  // ════════════════════════════════════════════════════════════════════════
  const dc = {
    mustering(teamLabel, compLabel) {
      dcLog(`${teamLabel} — mustering. En route ${compLabel} in 15s`);
      log('CONN', `DC ${teamLabel} — close up. ${compLabel}. Emergency.`, P.MED);
    },
    dispatched(teamLabel, compLabel, eta) {
      dcLog(`${teamLabel} — moving. ${compLabel}, ETA ${eta}s`);
    },
    cannotCross(teamLabel) {
      msg(`${teamLabel} CANNOT CROSS — REACTOR FLOODED`, 2.0);
    },
    cannotReassign(teamLabel) {
      msg(`${teamLabel} COMMITTED — neutralise threat first`, 2.0);
    },
    autoDispatching(teamLabel, compLabel, eta) {
      dcLog(`${teamLabel} — auto-dispatched to ${compLabel}, ETA ${eta}s`);
    },
    recalled(teamLabel, wasBlow) {
      dcLog(wasBlow ? `${teamLabel} — HP blow aborted. Standing by` : `${teamLabel} — recalled. Ready`);
    },
    onScene(teamLabel, compLabel) {
      dcLog(`${teamLabel} — on scene, ${compLabel}`);
    },
    floodingActive(teamLabel) {
      dcLog(`${teamLabel} — fighting the breach`, P.MED);
    },
    floodStatus(teamLabel, pct, rate) {
      if      (rate > 0.010) dcLog(`${teamLabel} — losing the breach. ${pct}% flooded. Need assistance`, P.CRIT);
      else if (rate > 0.003) dcLog(`${teamLabel} — holding. Breach not sealed. ${pct}% flooded`, P.MED);
      else                   dcLog(`${teamLabel} — breach slowing. ${pct}% and falling`);
    },
    breachSealed(teamLabel, compLabel, nextSys, sysLabel) {
      dcLog(`${teamLabel} — breach sealed. ${nextSys ? `Moving to repairs. ${sysLabel} first` : `${compLabel} secure`}`, P.MED);
      log('ENG', `Conn, DC ${teamLabel} — breach sealed ${compLabel}. Damage assessment underway`, P.MED);
    },
    allSecure(teamLabel, compLabel) {
      dcLog(`${teamLabel} — ${compLabel} all systems restored. Standing by`, P.MED);
      log('ENG', `Conn, DC ${teamLabel} — ${compLabel} all systems restored`, P.MED);
    },
    startRepair(teamLabel, sysLabel) {
      dcLog(`${teamLabel} — starting ${sysLabel} repairs`);
    },
    repairProgress(teamLabel, sysLabel, pct, dual) {
      dcLog(`${teamLabel} — ${sysLabel} repair ${pct}%${dual ? ' [both teams]' : ''}`);
    },
    repairComplete(teamLabel, sysLabel, restored, dual) {
      dcLog(`${teamLabel} — ${sysLabel} restored, ${restored}${dual ? ' (both teams)' : ''}`, P.MED);
      log('ENG', `Conn, DC ${teamLabel} — ${sysLabel} restored, ${restored}`, P.MED);
      msg(`${sysLabel} REPAIRED`, 1.5);
    },
    casualty(teamLabel, victimName, victimStatus, sysLabel) {
      dcLog(`${teamLabel} — CASUALTY: ${victimName} ${victimStatus} during ${sysLabel} repair`, P.CRIT);
      log('CONN', `Conn — DC casualty: ${victimName} ${victimStatus}`, P.CRIT);
    },
    teamEvacuated(teamLabel, compLabel) {
      dcLog(`${teamLabel} — evacuated ${compLabel}. Casualties taken`, P.MED);
      log('CONN', `All stations — DC ${teamLabel} evacuated ${compLabel}`, P.MED);
    },
    teamLost(teamLabel, compLabel) {
      dcLog(`${teamLabel} — [LOST with ${compLabel}]`, P.CRIT);
      log('CONN', `All stations — DC ${teamLabel} lost with ${compLabel}`, P.CRIT);
    },
    teamLostSealed(teamLabel, compLabel) {
      dcLog(`${teamLabel} — [LOST — sealed inside ${compLabel}]`, P.CRIT);
    },
    blow: {
      started(teamLabel, compLabel) {
        dcLog(`${teamLabel} — ${compLabel} flooded. HP blow from bulkhead`, P.MED);
        log('ENG', `Conn, DC ${teamLabel} — HP blow, ${compLabel}. Compressors running. We are loud`, P.MED);
        msg(`HP BLOW — ${compLabel}`, 2.0);
      },
      progress(teamLabel, compLabel, pct) {
        dcLog(`${teamLabel} — ${compLabel} blow in progress. ${pct}% flooded`);
      },
      complete(teamLabel, compLabel) {
        dcLog(`${teamLabel} — ${compLabel} pressure equalised. Entering now`, P.MED);
        log('ENG', `Conn, DC ${teamLabel} — ${compLabel} pressure equalised. Entering now`, P.MED);
        msg(`${compLabel.toUpperCase()} RE-ENTERED`, 2.0);
      },
      accessible(teamLabel, compLabel) {
        dcLog(`${teamLabel} — ${compLabel} accessible. Entering`);
      },
      aborted(teamLabel) {
        dcLog(`${teamLabel} — HP blow aborted. Standing by`);
      },
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // SYSTEM DAMAGE / REPAIR
  // ════════════════════════════════════════════════════════════════════════
  const sys = {
    damaged(sysLabel, state, delay) {
      qlog('ENG', `Conn, Eng — ${sysLabel}, ${state}`, delay || 0, P.MED);
    },
    casualties(killed, wounded, compLabel) {
      qlog('CONN', `${compLabel} — ${killed} down${wounded > 0 ? `, ${wounded} wounded` : ''}`, 4.0, P.CRIT);
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // REACTOR
  // ════════════════════════════════════════════════════════════════════════
  const reactor = {
    scram(cause) {
      if (cause === 'depth') {
        log('MANV', 'Conn, Manoeuvring — reactor SCRAM. Rods are in. Switching to EPM', P.CRIT);
        qlog('ENG', 'Conn, Eng — SCRAM on coolant temperature excursion. She could not take the load at that depth', 1.5, P.MED);
      } else if (cause === 'turn') {
        log('MANV', 'Conn, Manoeuvring — reactor SCRAM. Rods are in. Switching to EPM', P.CRIT);
        qlog('ENG', 'Conn, Eng — SCRAM on high flux signal. Coolant pumps cavitated on that angle. Reactor tripped', 1.5, P.MED);
      } else if (cause === 'fire') {
        log('MANV', 'Conn, Manoeuvring — fire in reactor compartment. SCRAM reactor. Rods in, switching to EPM', P.CRIT);
        qlog('ENG', 'Conn, Eng — reactor manually tripped. EPM in service. Holding restart pending casualty resolution', 2.0, P.CRIT);
      } else if (cause === 'coolant') {
        log('MANV', 'Conn, Manoeuvring — primary coolant failure. Automatic SCRAM. Rods in, switching to EPM', P.CRIT);
        qlog('ENG', 'Conn, Eng — primary coolant loop integrity lost. Reactor tripped on low flow', 1.5, P.CRIT);
      } else {
        log('MANV', 'Conn, Manoeuvring — reactor SCRAM. Rods in. EPM', P.CRIT);
      }
      msg('REACTOR SCRAM', 2.0);
    },
    fireScramLifted() {
      log('MANV', 'Conn, Manoeuvring — reactor compartment clear. Commencing fast recovery startup', P.MED);
    },
    scramHoldRepair() {
      log('MANV', 'Conn, Manoeuvring — SCRAM cleared. Reactor fire damage confirmed. Holding restart pending DC repairs', P.MED);
      qlog('ENG', 'Conn, Eng — reactor panels show multiple faults. Cannot restart until systems restored. DC teams to work', 2.0, P.MED);
    },
    repairReadyRestart(state) {
      if(state==='nominal'){
        log('MANV', 'Conn, Manoeuvring — reactor systems nominal. Ready to recommence startup procedure', P.MED);
        qlog('ENG', 'Conn, Eng — commencing fast recovery startup. Standing by on rod withdrawal', 1.5, P.MED);
      } else {
        log('MANV', `Conn, Manoeuvring — reactor partially repaired (${state}). Reactor non-operational. Further repairs required`, P.MED);
      }
    },
    epmon() {
      log('MANV', 'Conn, Manoeuvring — EPM on the line. Making three knots. That is all I have', P.MED);
      log('CONN', 'Manoeuvring, Conn — aye. All stations, Conn — EPM only. Hold your depth and course.', P.MED);
    },
    recoveryStart() {
      log('ENG',  'Conn, Eng — commencing fast recovery startup. Standing by on rod withdrawal', P.MED);
      log('CONN', 'All stations, Conn — reactor recovery in progress. Rig for reduced electrical. Maintain silence.', P.MED);
    },
    recoveryProgress(step) {
      const lines = [
        ['MANV', 'Conn, Manoeuvring — primary coolant circulating. Temperature stabilising'],
        ['MANV', 'Conn, Manoeuvring — pulling rods. Reactor approaching criticality'],
        ['ENG',  'Conn, Eng — we have a self-sustaining reaction. Power rising'],
        ['MANV', 'Conn, Manoeuvring — turbines online. Answering half ahead. EPM secured', P.MED],
        ['CONN', 'Manoeuvring, Conn — good news. Half ahead when you are ready.', P.MED],
        ['ENG',  'Conn, Eng — reactor is back in the normal operating band. All propulsion systems normal', P.MED],
      ];
      if (lines[step]) log(lines[step][0], lines[step][1], lines[step][2]||P.NORMAL);
    },
    online() { msg('REACTOR ONLINE', 1.5); },
    // ── Reactor / propulsion casualties ──────────────────────────────────
    coolantLeak() {
      log('MANV', 'Conn, Manoeuvring — primary coolant pressure dropping. We have a leak in the primary loop', P.CRIT);
      qlog('ENG', 'Conn, Eng — estimating automatic SCRAM in forty-five seconds. Recommend reducing speed to give DC a chance to isolate', 2.0, P.CRIT);
      msg('COOLANT LEAK', 2.0);
    },
    coolantLeakProgress() {
      log('ENG', 'Conn, Eng — DC working the leak. Coolant pressure still falling', P.MED);
    },
    coolantLeakIsolated() {
      log('MANV', 'Conn, Manoeuvring — primary coolant leak isolated. Pressure stabilising', P.MED);
      qlog('ENG', 'Conn, Eng — good work by DC. Reactor maintaining power. Resuming normal operations', 1.5, P.MED);
      msg('LEAK ISOLATED', 1.5);
    },
    coolantLeakFailed() {
      log('ENG', 'Conn, Eng — cannot isolate the leak. SCRAM is imminent', P.CRIT);
    },
    steamLeak() {
      log('MANV', 'Conn, Manoeuvring — main steam isolation! Answering on the diesel', P.CRIT);
      qlog('ENG', 'Conn, Eng — steam leak in the main loop. DC closing up. Diesel generator on the line, making seven knots', 2.0, P.CRIT);
      msg('MAIN STEAM ISOLATION', 2.0);
    },
    steamRestored() {
      log('MANV', 'Conn, Manoeuvring — main steam restored. Full propulsion available', P.MED);
      qlog('ENG', 'Conn, Eng — steam leak repaired. Turbines answering ahead', 1.5, P.MED);
      msg('STEAM RESTORED', 1.5);
    },
    turbineTrip() {
      log('MANV', 'Conn, Manoeuvring — turbine trip! Max turns for twelve knots', P.CRIT);
      msg('TURBINE TRIP', 1.5);
    },
    turbineRecovered() {
      log('MANV', 'Conn, Manoeuvring — turbines back on the line. Full power available', P.MED);
      msg('TURBINES ONLINE', 1.0);
    },
    reactorRunaway() {
      log('MANV', 'Conn, Manoeuvring — positive scram! Uncontrolled rod withdrawal, automatic trip. Rods in, switching to EPM', P.CRIT);
      qlog('ENG', 'Conn, Eng — reactor tripped on positive period. Loud transient on that one. Commencing fast recovery', 2.0, P.CRIT);
      msg('REACTOR SCRAM', 2.0);
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // ESCAPE
  // ════════════════════════════════════════════════════════════════════════
  const escape = {
    tceNotViable() { msg('TCE NOT VIABLE — TOO DEEP OR NO TOWERS', 2.0); },
    tce() {
      log('CONN', 'Conn — all hands, TCE. Escape tower parties, close up. This is not a drill.', P.CRIT);
      msg('TCE INITIATED', 2.0);
    },
    rush() {
      log('CONN', 'Conn — all hands, RUSH ESCAPE. Abandon ship, abandon ship. This is not a drill.', P.CRIT);
      msg('RUSH ESCAPE — ALL HANDS GO', 2.5);
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // COMBAT / TORPEDO THREATS
  // ════════════════════════════════════════════════════════════════════════
  const planes = {
    // ── Forward planes ─────────────────────────────────────────────────────
    fwdAirEmergency() {
      log('HELM', 'Conn, Helm — forward planes hydraulics lost. Switching to air emergency.', P.CRIT);
      qlog('ENG',  'Conn, Eng — forward planes on air emergency. HPA consumption will increase. Response degraded.', 1.5, P.MED);
      msg('FWD PLANES — AIR EMERGENCY', 2.0);
    },
    fwdControlLost() {
      log('HELM', 'Conn, Helm — forward planes control lost. Planes are frozen.', P.CRIT);
      msg('FWD PLANES — FROZEN', 2.5);
    },
    fwdHydraulicRestored() {
      log('ENG',  'Conn, Eng — forward planes hydraulics restored. Normal response.', P.MED);
    },
    // ── Aft planes ──────────────────────────────────────────────────────────
    aftAirEmergency(ctrlTransferred) {
      log('HELM', 'Conn, Helm — aft planes hydraulics lost. Switching to air emergency.', P.CRIT);
      qlog('ENG',  'Conn, Eng — aft planes on air emergency. HPA consumption will increase. Response degraded.', 1.5, P.MED);
      if(ctrlTransferred){
        qlog('MANEUVERING', 'Conn, Manoeuvring — we have the planes aft. Standing by on air emergency.', 2.5, P.MED);
      }
      msg('AFT PLANES — AIR EMERGENCY', 2.0);
    },
    aftControlTransferred() {
      log('MANEUVERING', 'Conn, Manoeuvring — assuming aft plane control. Helm, transfer complete.', P.MED);
      qlog('HELM', 'Manoeuvring, Helm — aye, planes transferred aft.', 1.0, P.MED);
    },
    aftHydraulicRestored() {
      log('ENG',  'Conn, Eng — aft planes hydraulics restored. Normal response.', P.MED);
    },
    // ── Combined / frozen ──────────────────────────────────────────────────
    planesFrozenNoHPA(angleNow) {
      const dir = angleNow > 0 ? 'rise' : angleNow < 0 ? 'dive' : 'neutral';
      log('HELM', `Conn, Helm — planes frozen. No HP air. Planes locked ${Math.abs(angleNow)}° ${dir}.`, P.CRIT);
      qlog('CONN', `All stations, Conn — planes are frozen in ${dir}. Ballast control only.`, 1.0, P.CRIT);
      msg('PLANES FROZEN', 3.0);
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  const combat = {
    torpedoInWater(brgStr) {
      msg('TORPEDO IN THE WATER!', 3.0);
      log('SONAR', `Conn, Sonar — new contact, high-speed screws, bears ${brgStr}, classify torpedo`, P.CRIT);
      log('CONN',  'Conn — all stations — Action stations, action stations, action stations: Torpedo threat. Close up evasion stations.', P.CRIT);
    },
    seekerActive(brgStr) {
      log('SONAR', `Conn, Sonar — torpedo bears ${brgStr}, seeker active, weapon is hunting`, P.MED);
      log('CONN',  'All stations, Conn — stand by for emergency manoeuvre. Helm, await my order.', P.MED);
      msg('TORPEDO SEEKER ACTIVE', 2.5);
    },
    torpedoClosing(brgStr, recipDeg) {
      log('SONAR', `Conn, Sonar — torpedo bears ${brgStr}, high closing rate, inbound`, P.CRIT);
      log('CONN',  `Helm, Conn — come to ${recipDeg}, emergency deep, full ahead`, P.CRIT);
      msg(`TURN TO ${recipDeg} — EMERGENCY DEEP`, 3.0);
    },
    weaponAcquisition(brgStr, recipDeg) {
      log('SONAR', `Conn, Sonar — weapon has acquisition, bears ${brgStr}, impact imminent`, P.CRIT);
      log('CONN',  `All stations, Conn — steer ${recipDeg}, emergency deep, flank speed. Deploy all countermeasures`, P.CRIT);
      msg('WEAPON HAS ACQUISITION', 4.0);
    },
    targetDestroyed(contactType) {
      if(contactType === 'civilian'){
        log('SONAR', `Conn, Sonar — breaking-up noises. Merchant vessel destroyed`, P.CRIT);
        msg('CIVILIAN VESSEL DESTROYED', 3.5);
        qlog('CONN', 'Conn — that was a civilian vessel. This will be reported.', 2.0, P.CRIT);
      } else {
        log('SONAR', `Conn, Sonar — breaking-up noises. ${contactType === 'boat' ? 'Surface contact' : 'Submerged contact'} destroyed`, P.MED);
        msg('TARGET DESTROYED', 2.5);
      }
    },
    counterShot(n, degStr) {
      log('SONAR', `Conn, Sonar — ${n} torpedo${n > 1 ? 's' : ''} in the water, bears ${degStr}, reciprocal`, P.CRIT);
      msg(`COUNTER-SHOT — ${n} WEAPONS INBOUND`, 2.5);
    },
    enemyCountermeasures() {
      log('SONAR', 'Conn, Sonar — contact manoeuvring, high speed. Countermeasures in water', P.MED);
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // WEAPONS / TUBES
  // ════════════════════════════════════════════════════════════════════════
  const weapons = {
    shootOrder(manual) {
      log('CONN', manual ? 'Fire, manual bearing' : 'Fire on solution');
    },
    solutionSet(tube) {
      log('WEPS', `Conn, Weps — tube ${tube}, solution set`);
    },
    floodingDown(tube) {
      log('WEPS', `Tube ${tube}, flooding down`);
    },
    tubeReady(tube) {
      log('WEPS', `Conn, Weps — tube ${tube} ready in all respects, outer door open`);
    },
    fired(tube, wire) {
      log('WEPS', `Tube ${tube} fired electrically`);
      if (wire) log('SONAR', 'Conn, Sonar — own unit is away, running normally. Wire live');
      else      log('SONAR', 'Conn, Sonar — own unit is away, running normally');
    },
    wireParted(tube, cause) {
      if (cause === 'launch') {
        log('WEPS', `Conn, Weps — tube ${tube}, wire parted on launch, unit running free`, P.MED);
      } else if (cause === 'runout') {
        msg('WIRE PARTED — RUNOUT', 0.8);
        log('WEPS', 'Conn, Weps — wire parted, runout. Tube reloading', P.MED);
      } else if (cause === 'speed') {
        msg('WIRE PARTED — OVERSPEED', 1.0);
        log('WEPS', 'Conn, Weps — wire parted, overspeed. Unit running free.', P.MED);
      } else if (cause === 'turn') {
        msg('WIRE PARTED — MANOEUVRE', 1.0);
        log('WEPS', 'Conn, Weps — wire parted on emergency turn. Unit running free.', P.MED);
      } else if (cause === 'dive') {
        msg('WIRE PARTED — MANOEUVRE', 1.0);
        log('WEPS', 'Conn, Weps — wire parted on crash dive. Unit running free.', P.MED);
      } else {
        msg('WIRE PARTED', 0.8);
        log('WEPS', 'Conn, Weps — wire cut, manual. Torpedo running free.');
      }
    },
    reloaded(tube) {
      log('WEPS', `Conn, Weps — tube ${tube} reloaded, ready in all respects`);
    },
    // Tube load management — ordered by player, one op at a time in the torpedo room
    loadOrder(tube, weaponLabel) {
      log('WEPS', `Conn, Weps — aye. Loading tube ${tube} with ${weaponLabel}`);
      msg(`LOADING T${tube}\u2026`, 0.7);
    },
    loadComplete(tube, weaponLabel) {
      log('WEPS', `Conn, Weps — tube ${tube} loaded, ${weaponLabel} ready in all respects`);
    },
    unloadOrder(tube) {
      log('WEPS', `Conn, Weps — aye. Unloading tube ${tube}, weapon coming back`);
      msg(`UNLOADING T${tube}\u2026`, 0.7);
    },
    unloadComplete(tube) {
      log('WEPS', `Conn, Weps — tube ${tube} unloaded, weapon secured in the rack`);
    },
    strikeReloadOrder(tube, weaponLabel) {
      log('WEPS', `Conn, Weps — aye. Strike reload, tube ${tube} with ${weaponLabel}`);
      msg(`STRIKE RELOAD T${tube}\u2026`, 0.7);
    },
    strikeReloadComplete(tube, weaponLabel) {
      log('WEPS', `Conn, Weps — tube ${tube} reloaded, ${weaponLabel} ready in all respects`);
    },
    torpRoomBusy() {
      log('WEPS', 'Conn, Weps — torpedo room busy, stand by');
      msg('TORP ROOM BUSY', 0.7);
    },
    // Full firing point procedure — CONN opens the sequence
    firingProcedures(tube, weaponLabel, contactId, manual) {
      if (manual) {
        log('CONN', `Weps, Conn — firing point procedures, tube ${tube}, ${weaponLabel}, manual bearing`);
      } else {
        const trk = contactId ? `, track ${contactId}` : '';
        log('CONN', `Weps, Conn — firing point procedures, tube ${tube}, ${weaponLabel}${trk}`);
      }
      msg('FIRING\u2026', 0.6);
    },
    // WEPS acknowledges and confirms readiness
    fppAck(tube, weaponLabel, contactId) {
      const trk = contactId ? `, ${contactId}` : '';
      log('WEPS', `Tube ${tube}, ${weaponLabel}${trk} — aye. Prepare tube ${tube}`);
    },
    // NAV / ship confirms positional readiness
    shipReady() {
      log('NAV', 'Ship ready');
    },
    // WEPS confirms weapon is set and solution loaded
    weaponReady() {
      log('WEPS', 'Weapon ready');
    },
    // CONN gives the fire order
    fireOrder(tube, weaponLabel, contactId, manual) {
      if (manual) {
        log('CONN', `Fire, tube ${tube}, ${weaponLabel}, manual bearing`);
      } else {
        const trk = contactId ? `, ${contactId}` : '';
        log('CONN', `Fire, tube ${tube}, ${weaponLabel}${trk}`);
      }
    },
    // SONAR — missile variant of away call
    missileAway() {
      msg('MISSILE AWAY', 1.4);
      log('SONAR', 'Conn, Sonar — launch transient. Missile airborne');
    },
    missileHit(target) {
      msg('TARGET HIT', 1.8);
      log('SONAR', `Conn, Sonar — detonation. ${target} hit`);
    },
    missileMiss() {
      msg('MISS', 1.2);
      log('SONAR', 'Conn, Sonar — detonation in water. No target struck');
    },
    missileDefeat(target) {
      msg('MISSILE DEFEATED', 1.5);
      log('SONAR', `Conn, Sonar — ${target} CIWS active. Missile defeated`);
    },
    // VLS — streamlined fire sequence (no tube flood-down)
    vlsFired(cell, weaponLabel, contactId) {
      log('CONN', `Fire, VLS cell ${cell}, ${weaponLabel}, ${contactId}`);
      qlog('WEPS', `VLS cell ${cell} fired electrically — ${weaponLabel} airborne`, 0.6);
      msg('MISSILE AWAY', 1.2);
    },
    // Stadimeter — optical range observation at periscope depth
    stadimeterObserve(contactId) {
      log('CONN', `Weps, Conn — stadimeter observation, ${contactId}. Mark when ready`);
      msg('STADIMETER\u2026', 3.5);
    },
    stadimeterComplete(classKnown) {
      const acc = classKnown ? '\u00b118%' : '\u00b130%';
      log('WEPS', `Conn, Weps — stadimeter complete. Range estimate locked, accuracy ${acc}`);
    },
    stadimeterInterrupted() {
      log('WEPS', 'Conn, Weps — stadimeter interrupted. No range estimate');
      msg('STADIMETER ABORTED', 0.8);
    },
    unableFiring() {
      msg('FIRING IN PROGRESS', 0.8);
      log('WEPS', 'Conn, Weps — unable. Firing sequence in progress.');
    },
    error(why) {
      msg(why.toUpperCase(), 0.8);
      log('WEPS', why, P.MED);
    },
    noSolution() {
      log('WEPS', 'Conn, Weps — unable. No firing solution. Designate a contact.');
    },
    fireControlOffline() {
      log('WEPS', 'Conn, Weps — fire control offline', P.MED);
    },
    missileDepthWarning(wl, depth, maxD) {
      msg('DEPTH RISK — ATTEMPTING', 1.4);
      log('WEPS', `Conn, Weps — ${wl} depth envelope is ${maxD}m. We are at ${Math.round(depth)}m. Attempting launch.`, P.MED);
    },
    missileLaunchFail(wl) {
      msg('MISFIRE', 1.6);
      log('WEPS', `Conn, Weps — misfire. ${wl} capsule failed to surface. Tube flooding — safe.`, P.CRIT);
      qlog('WEPS', `Conn, Weps — weapon lost. Tube secure.`, 2.0, P.MED);
    },
    vlsLaunchFail(wl, cell) {
      msg('VLS MISFIRE', 1.6);
      log('WEPS', `Conn, Weps — VLS misfire, cell ${cell}. ${wl} eject failed. Cell intact — available for re-fire.`, P.CRIT);
    },
    away()       { msg('TORPEDO AWAY', 1.2); },
    countermeasures() {
      msg('NOISEMAKER OUT', 0.9);
      log('CONN', 'Weps, Conn — deploy countermeasures');
      log('WEPS', 'Conn, Weps — noisemaker away');
      qlog('SONAR', 'Conn, Sonar — decoy running, own noise masking', 1.5);
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // NAVIGATION / HELM / MANOEUVRING
  // ════════════════════════════════════════════════════════════════════════
  const nav = {
    courseChange(crsStr) {
      log('CONN', `Helm, Conn — come to course ${crsStr}`);
      qlog('HELM', `Conn, Helm — aye, coming to course ${crsStr}`, 1.5);
    },
    tdcDesignated(trackId, hasSonar) {
      msg(`TDC: ${trackId} DESIGNATED`, 1.0);
      log('CONN', `Weps, Conn — TDC, designate track ${trackId}`);
      if (hasSonar) log('SONAR', `Conn, Sonar — track ${trackId} locked in TDC`);
    },
    silentRunning(on) {
      if (on) {
        log('CONN',  'All stations, Conn — rig for silent running. Silent routine', P.MED);
        qlog('HELM',  'Conn, Helm — aye. Reducing to slow ahead', 1.0);
        qlog('ENG',   'Conn, Eng — aye. Securing non-essential machinery. MSC to low speed.', 1.8);
        qlog('MANV',  'Conn, Manoeuvring — propulsion reducing, answering slow ahead', 3.0);
        qlog('ENG',   'Conn, Eng — ventilation secured. HP air isolated. All fans stopped', 4.2);
        qlog('COMMS', 'Conn, Comms — radio room going receive only. No transmissions', 5.0);
        qlog('SONAR', 'Conn, Sonar — sound room aye. Passive suite only, active sonar safed. Listening watch maintained', 6.0);
        qlog('WEPS',  'Conn, Weps — weapon systems to standby. Tube space quiet', 7.5);
        qlog('NAV',   'Conn, Nav — navigation on low power. DR plot maintained', 8.5);
        qlog('ENG',   'Conn, Eng — ship is rigged for silent running. Duty watch closed up', 10.5);
      } else {
        log('CONN',  'All stations, Conn — secure from silent running. Resume normal operations', P.MED);
        qlog('ENG',   'Conn, Eng — aye. Restoring ventilation and circulation', 1.2);
        qlog('MANV',  'Conn, Manoeuvring — answering half ahead', 2.2);
        qlog('COMMS', 'Conn, Comms — radio room returning to normal watch', 2.8);
        qlog('SONAR', 'Conn, Sonar — full suite restored', 3.5);
        qlog('ENG',   'Conn, Eng — secured from silent running. All systems normal', 4.8);
      }
      msg(on ? 'SILENT RUNNING' : 'NORMAL RUN', 1.0);
    },
    emergencyTurn() {
      msg('EMERGENCY TURN!', 1.2);
      log('CONN', 'Helm, Conn — hard over, emergency turn. Full ahead.', P.MED);
      qlog('HELM', 'Conn, Helm — hard over aye, full rudder applied', 0.6);
      qlog('CONN', 'Helm, Conn — watch your depth on that angle', 1.8);
      qlog('HELM', 'Conn, Helm — rate of turn building', 2.5);
    },
    crashDive() {
      msg('CRASH DIVE!', 2.0);
      log('CONN', 'Helm, Conn — emergency deep, full ahead', P.MED);
      qlog('ENG', 'Conn, Eng — flooding all tanks, full dive planes, max down angle', 0.8);
      qlog('ENG', 'Conn, Eng — steep down angle, rate of descent high', 2.0);
    },
    emergencyBlow() {
      msg('EMERGENCY BLOW!', 1.2);
      log('CONN', 'Blow all main ballast. Emergency surface', P.MED);
      qlog('ENG', 'Conn, Eng — emergency blow, main ballast tanks venting', 0.5);
      qlog('ENG', 'Conn, Eng — blow complete, rising fast', 2.5);
    },
    depthOrder(ordStr, direction) {
      msg(`ORDERED ${ordStr}`, 0.8);
      if (direction === 'down') {
        log('CONN', `Helm, Conn — make your depth ${ordStr}`);
        qlog('HELM', `Conn, Helm — aye, making my depth ${ordStr}`, 1.0);
      } else {
        log('CONN', `Helm, Conn — come up to ${ordStr}`);
        qlog('HELM', `Conn, Helm — aye, coming up to ${ordStr}`, 1.0);
      }
    },
    // Conn room evacuated — depth order relayed through internal comms; CO issues from wherever he is
    depthOrderRelay(ordStr, direction) {
      msg(`ORDERED ${ordStr}`, 0.8);
      if (direction === 'down') {
        log('CO', `Manoeuvring, CO — relay to Helm: make depth ${ordStr}. Manual ballast ops`, P.MED);
        qlog('ENG',  `CO, Manoeuvring — aye, relaying to Helm`, 2.0);
        qlog('HELM', `Manoeuvring, Helm — making depth ${ordStr}. Operating ballast manually`, 4.5);
      } else {
        log('CO', `Manoeuvring, CO — relay to Helm: come up to ${ordStr}. Manual ballast ops`, P.MED);
        qlog('ENG',  `CO, Manoeuvring — aye, relaying to Helm`, 2.0);
        qlog('HELM', `Manoeuvring, Helm — coming up to ${ordStr}. Operating ballast manually`, 4.5);
      }
    },
    // Conn room unavailable — action blocked
    connRoomUnavail(action) {
      const label = action.charAt(0).toUpperCase() + action.slice(1);
      msg(`${action.toUpperCase()}: CONN EVACUATED`, 1.2);
      log('CO', `${label} unavailable — control room evacuated`, P.MED);
    },
    ballastDamageWarning(state) {
      const severity = state==='destroyed' ? 'destroyed' : state==='offline' ? 'offline' : 'degraded';
      qlog('ENG', `Conn, Eng — ballast system ${severity}, depth recovery will be impaired`, 3.0);
    },
    comeToPD() {
      msg('COME TO PD', 1.0);
      log('CONN', 'Helm, Conn — come to periscope depth');
      qlog('HELM', 'Conn, Helm — aye, coming to periscope depth', 1.0);
    },
    speedReport(speed)  { qlog('HELM', `Conn, Helm — making ${Math.round(speed)} knots`, 0.5); },
    allStop()           { qlog('HELM', 'Conn, Helm — stop both, speed zero', 0.5); },
    waypointReached(crsNext)  { log('HELM', `Conn, Helm — waypoint reached, coming to course ${crsNext}`); },
    finalWaypoint(hdgStr)     { log('HELM', `Conn, Helm — final waypoint reached, steady on course ${hdgStr}`); },
    grounded()          { msg('GROUNDED', 1.0); },
    crushDepth(depth) {
      log('ENG', `Conn, Eng — hull stress. Depth ${Math.round(depth)}m exceeds crush limit`, P.CRIT);
      msg('CRUSH DEPTH EXCEEDED', 1.5);
    },
    depthReport(band)   { log('HELM', `Conn, Helm — passing ${band} metres`); },
    cavitation(on) {
      if (on) log('ENG', 'Conn, Eng — cavitating. Noise signature elevated', P.MED);
      else    log('ENG', 'Conn, Eng — cavitation clear');
    },
    towedArrayStress(cause, newState) {
      if (newState === 'damaged') log('ENG', `Conn, Eng — array took stress on that ${cause}, degraded`, P.MED);
      else                        log('ENG', `Conn, Eng — array cable parted on that ${cause}. Array lost`, P.MED);
    },
    towedArrayOverspeed(speed) {
      log('ENG', `Conn, Eng — array overspeed. Rated 18kt, currently ${Math.round(speed)}kt. Risk of cable loss`, P.MED);
    },
    steeringCasualty(state) {
      if (state === 'degraded') {
        msg('STEERING DEGRADED', 1.2);
        log('ENG', 'Conn, Manoeuvring — steering casualty, rudder response degraded. Reduced authority', P.MED);
        qlog('HELM', 'Manoeuvring, Helm — steering degraded, maintaining course best able', 2.0);
      } else if (state === 'offline') {
        msg('STEERING OFFLINE', 1.4);
        log('ENG', 'Conn, Manoeuvring — steering offline. Switching to emergency tiller. Severely reduced authority', P.CRIT);
        qlog('HELM', 'Manoeuvring, Helm — emergency tiller rigged. Turns very slow', 2.5);
      } else if (state === 'destroyed') {
        msg('RUDDER JAMMED', 1.6);
        log('ENG', 'Conn, Manoeuvring — rudder jammed. No steering authority. Recommend all stop', P.CRIT);
        qlog('HELM', 'Manoeuvring, Helm — no steering response. Rudder jammed', 2.0);
      }
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // SENSORS / SONAR / TOWED ARRAY
  // ════════════════════════════════════════════════════════════════════════
  const sensors = {
    newContact(id, typeLabel, brgStr) {
      log('SONAR', 'Conn, Sonar — possible contact, investigating');
      qlog('SONAR', `Conn, Sonar — new ${typeLabel}, track ${id}, bears ${brgStr}, passive`, 2.5);
      qlog('CONN',  `Sonar, Conn — aye, track ${id}. Maintain track`, 4.0);
    },
    newContactTowed(id, typeLabel, brgStr) {
      log('SONAR', 'Conn, Sonar — possible contact, towed array, investigating');
      qlog('SONAR', `Conn, Sonar — new ${typeLabel}, track ${id}, bears ${brgStr}, towed array, ambiguous`, 2.5);
      qlog('SONAR', `Conn, Sonar — ${id} port/starboard ambiguous. Recommend 10-20° course change to resolve`, 3.5);
      qlog('CONN',  `Sonar, Conn — aye, track ${id}. Maintain track`, 5.0);
    },
    contactLabel(label) { if (label) log('SONAR', label); },
    tmaDegrading(id) {
      log('SONAR', `Conn, Sonar — ${id} solution degrading, towed ambiguity unresolved. Recommend 20° course change`, P.MED);
    },
    ambiguityResolved(id, sideStr) {
      log('SONAR', `Conn, Sonar — ${id} ambiguity resolved, contact is ${sideStr}`);
      qlog('CONN', `Sonar, Conn — aye, ${id} resolved`, 1.0);
    },
    tmaDegraded(id) {
      log('SONAR', `Conn, Sonar — ${id}, TMA degraded, solution building`);
      qlog('CONN', `Weps, Conn — TDC, update solution on ${id}`, 1.5);
    },
    tmaSolid(id) {
      log('SONAR', `Conn, Sonar — ${id}, TMA solution solid. Ready to fire.`, P.MED);
      qlog('CONN', `Weps, Conn — weapons free on ${id}. Stand by to fire.`, 2.0);
    },
    classified(id, type) {
      log('SONAR', `Conn, Sonar — ${id}, classify ${type}`, P.MED);
    },
    launchTransient(brgStr) {
      log('SONAR', `Conn, Sonar — launch transient, bears ${brgStr}. Torpedo in the water`, P.CRIT);
    },
    activePing(hits) {
      log('SONAR', hits > 0
        ? `Conn, Sonar — active ping, ${hits} return${hits > 1 ? 's' : ''}`
        : 'Conn, Sonar — active ping, no returns');
    },
    pingDatum(alerted) {
      if (alerted > 0) log('SONAR', `Conn, Sonar — ping datum. ${alerted} contact${alerted > 1 ? 's' : ''} alerted to our position`, P.MED);
    },
    arrayDeployHalfway() { log('ENG', 'Conn, Eng — array halfway out, no issues'); },
    arrayStreamed() {
      log('ENG', 'Conn, Eng — array fully streamed');
      qlog('SONAR', 'Conn, Sonar — towed array online, long-range passive active', 1.0);
      qlog('SONAR', 'Conn, Sonar — note bearing ambiguity on towed contacts. Recommend 10-20° course change to resolve', 2.0);
    },
    arrayInboard()                { log('ENG', 'Conn, Eng — array inboard and stowed'); },
    arrayDamagedMsg(m)            { log('ENG', m, P.MED); },
    arrayOverspeed(speed)         { log('ENG', `Conn, Eng — array overspeed, ${Math.round(speed)}kt. Risk of cable loss`, P.MED); },
    arrayCannotDeploy()           { log('ENG', 'Conn, Eng — array destroyed, cannot deploy', P.MED); },
    arrayDeploySpeedLimit(speed)  { qlog('ENG', `Conn, Eng — unable. Speed ${Math.round(speed)}kt, array rated 12kt for deployment. Reduce speed`, 0.5); },
    arrayDeploy() {
      log('CONN', 'Eng, Conn — deploy towed array');
      qlog('ENG', 'Conn, Eng — aye, deploying array. Thirty seconds to operational', 1.0);
    },
    arrayRetract() {
      log('CONN', 'Eng, Conn — retract towed array');
      qlog('ENG', 'Conn, Eng — aye, hauling in. Twenty seconds', 1.0);
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // TACTICAL / CONTACT MANAGEMENT
  // ════════════════════════════════════════════════════════════════════════
  const tactical = {
    battleStations(scenario) {
      const lines = {
        single:  [['CONN',  'Conn, aye — single adversary contact. Battle stations',       P.MED]],
        barrier: [['SONAR', 'Conn, Sonar — multiple contacts, all bearings, close range',  P.MED],
                  ['CONN',  'Conn — all hands, action stations. Prepare to evade and engage.', P.MED]],
        patrol:  [['SONAR', 'Conn, Sonar — four-contact barrier, spread across track',     P.MED],
                  ['CONN',  'Helm, Conn — slow ahead. Ultra-quiet routine.',       P.MED]],
        ssbn_hunt:[['CONN',  'Conn — intelligence brief: Typhoon-class SSBN on bastion patrol, one escort SSN screening.', P.MED],
                   ['WEPS',  'Conn, Weps — weapons free on both contacts. Primary target is the boomer.', P.MED],
                   ['CONN',  'Helm, Conn — slow ahead, rig for ultra-quiet. Find the boomer.', P.MED]],
        boss_fight:[['CONN', 'Conn — flash traffic from SUBLANT. New hostile submarine class confirmed at sea. Designate: Zeta.', P.CRIT],
                    ['CONN', 'Conn — intelligence reports Zeta-class is extremely quiet, highly capable. Expect a hard fight.', P.MED],
                    ['WEPS', 'Conn, Weps — weapons free. This one won\'t go down easy — make every shot count.', P.MED]],
        asw_taskforce:[['SONAR', 'Conn, Sonar — multiple surface contacts, active sonar transmissions. Classify ASW taskforce.', P.MED],
                       ['CONN', 'Conn — surface group is prosecuting our datum. Rig for ultra-quiet, take her deep.', P.MED],
                       ['WEPS', 'Conn, Weps — weapons free on all surface contacts. Use the layer — they\'ll be pinging hard.', P.MED]],
      };
      if (lines[scenario]) lines[scenario].forEach(([s, m, p]) => log(s, m, p||P.NORMAL));
    },
    contact(brgStr) {
      log('SONAR', `Conn, Sonar — one contact, bears ${brgStr}, classify submerged`);
    },
    waveReport(waveLabel, count, groupBrgStr) {
      log('CONN',  waveLabel, P.MED);
      log('SONAR', `Conn, Sonar — ${count} contact${count > 1 ? 's' : ''}, group bears ${groupBrgStr}`);
    },
    prosecuting() {
      log('SONAR', 'Conn, Sonar — contacts manoeuvring aggressively, classify prosecuting', P.MED);
      qlog('CONN', 'Conn — all stations — Action stations, action stations, action stations: Assume defence watches.', 1.5, P.MED);
      qlog('WEPS', 'Conn, Weps — tubes one and two ready in all respects. Standing by.', 3.0);
    },
    contactLost()  { log('SONAR', 'Conn, Sonar — group has lost contact. Reverting to patrol'); },
    areaClear(waveNum) {
      log('SONAR', 'Conn, Sonar — no further contacts. Area appears clear');
      qlog('CONN', 'Sonar, Conn — aye. All stations, stand easy', 2.0);
      qlog('CONN', `Wave ${waveNum} neutralised. Maintain watch`, 4.0);
    },
    enemyTorpedo(brgStr) {
      log('SONAR', `Conn, Sonar — torpedo in the water, bears ${brgStr}`, P.CRIT);
    },
    buoySplash(brgStr) {
      log('SONAR', `Conn, Sonar — splash transient, bears ${brgStr}. Sonobuoy in the water`);
    },
    heloContact(brgStr) {
      log('SONAR', `Conn, Sonar — rotary wing contact, bears ${brgStr}. Classify helicopter, ASW`);
    },
    dipSonar(brgStr) {
      log('SONAR', `Conn, Sonar — dipping sonar active, bears ${brgStr}`, P.MED);
    },
    heloDrop(brgStr) {
      log('SONAR', `Conn, Sonar — torpedo in the water, bears ${brgStr}. Helo drop, classify ASW.`, P.CRIT);
      msg('TORPEDO IN THE WATER', 3.0);
    },
    dcDetonation(brgStr) {
      log('SONAR', `Conn, Sonar — depth charge detonation, bears ${brgStr}.`, P.MED);
    },
    asrocLaunch() {
      log('SONAR', `Conn, Sonar — rocket launch transient, surface contact. ASROC inbound.`, P.CRIT);
      msg('ASROC INBOUND', 3.0);
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // PANEL / SPEED ORDERS
  // ════════════════════════════════════════════════════════════════════════
  const panel = {
    speedOrder(label, connOrder, engAck) {
      msg(label, 1.0);
      log('CONN', connOrder);
      qlog('ENG', engAck, 1.2);
    },
    // Conn room evacuated — speed order relayed via internal comms; CO issues from passage or aft section
    speedOrderRelay(label, connOrder, engAck) {
      msg(label, 1.0);
      // Rewrite "Eng, Conn —" to "Manoeuvring, CO —" since CO is no longer at Conn
      const coOrder = connOrder.replace(/^Eng, Conn\s*—/, 'Manoeuvring, CO —');
      log('CO', coOrder, P.MED);
      qlog('ENG',  `CO, Manoeuvring — order received, aye`, 2.5);
      qlog('ENG',  engAck, 5.0);
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // UI FEEDBACK (setMsg only)
  // ════════════════════════════════════════════════════════════════════════
  const ui = {
    periscopeTooDeep()      { msg('PERISCOPE: TOO DEEP', 1.0); },
    periscopeDamaged()      { msg('PERISCOPE: DAMAGED — UNAVAILABLE', 1.0); },
    scopeReport(shown)      { msg(shown > 0 ? `SCOPE: ${shown} ship(s)` : 'SCOPE: no ships', 1.2); },
    sonarOffline()          { msg('SONAR OFFLINE — SCRAM', 0.8); },
    ping()                  { msg('PING!', 0.8); },
    shipCountermeasures()   { msg('SHIP: COUNTERMEASURES!', 0.8); },
    cwisIntercept()         { msg('CWIS INTERCEPT!', 1.0); },
    emergencyTurnCooldown() { msg('EMERGENCY TURN COOLING DOWN', 0.8); },
  };


  // ════════════════════════════════════════════════════════════════════════
  // CREW STATE TRANSITIONS
  // ════════════════════════════════════════════════════════════════════════
  const crewState = {

    // ── Tactical ──────────────────────────────────────────────────────────
    actionStations(cause) {
      const lines = {
        torpedo: `Conn — all stations — Action stations, action stations, action stations: Torpedo threat. Close up evasion stations.`,
        contact: `Conn — all stations — Action stations, action stations, action stations: Submerged contact prosecuted. Close up action stations.`,
        attack:  `Conn — all stations — Action stations, action stations, action stations: Weapons free. Close up action stations.`,
        wave:    `Conn — all stations — Action stations, action stations, action stations: Multiple contacts. Close up action stations.`,
        manual:  `Conn — all stations — Action stations, action stations, action stations: Assume defence watches.`,
      };
      log('CONN', lines[cause] || lines.manual, P.CRIT);
      msg('ACTION STATIONS', 2.0);
    },

    patrolState() {
      log('CONN', 'Conn — all hands, close up patrol state. Contact possible. Assume war watches.', P.MED);
      msg('PATROL STATE', 1.5);
    },

    standDown(fromState) {
      if (fromState === 'action') {
        log('CONN', 'Conn — all hands, stand down from action stations. Assume cruising watch.', P.MED);
        qlog('ENG',  'Conn, Eng — aye. Securing action state equipment.', 1.5);
        qlog('WEPS', 'Conn, Weps — aye. Weapons safed. Tubes drained.', 2.5);
        msg('STAND DOWN — CRUISING WATCH', 1.5);
      } else {
        log('CONN', 'Conn — all hands, stand down. Resume normal watch routine.', P.MED);
        msg('NORMAL WATCH', 1.2);
      }
    },

    // ── Casualty ──────────────────────────────────────────────────────────
    emergencyStations(cause) {
      const lines = {
        flood:   `Conn — all hands — Emergency stations, emergency stations, emergency stations: Flood, flood, flood. DC teams close up.`,
        reactor: `Conn — all hands — Emergency stations, emergency stations, emergency stations: Reactor casualty. Close up emergency stations.`,
        fire:    `Conn — all hands — Emergency stations, emergency stations, emergency stations: Fire, fire, fire. Close up emergency stations.`,
      };
      log('CONN', lines[cause] || `Conn — all hands — Emergency stations, emergency stations, emergency stations: Close up emergency stations.`, P.CRIT);
      msg('EMERGENCY STATIONS', 2.5);
    },

    casualtyControlled(cause) {
      const lines = {
        flood: 'Conn — all hands, flooding casualty controlled. Secure from emergency stations. Resume normal watch.',
        fire:  'Conn — all hands, fire casualty controlled. Secure from emergency stations. Resume normal watch.',
      };
      log('CONN', lines[cause] || 'Conn — all hands, casualty controlled. Secure from emergency stations.', P.MED);
      msg('CASUALTY CONTROLLED', 1.5);
    },

    escapeStations() {
      log('CONN', 'Conn — all hands — Escape stations, escape stations, escape stations: Abandon ship. This is not a drill.', P.CRIT);
      msg('ESCAPE STATIONS', 3.0);
    },

  };

  // ════════════════════════════════════════════════════════════════════════
  // DEPTH WARNINGS — state-aware
  // ════════════════════════════════════════════════════════════════════════
  const depth = {

    divingLimit(depthM, tacticalState) {
      if (tacticalState === 'action') {
        // At action stations — brief, no ceremony
        log('ENG', `Conn, Eng — passing diving limit. ${Math.round(depthM)}m.`, P.MED);
      } else {
        log('HELM', `Conn, Helm — approaching diving limit. Depth ${Math.round(depthM)}m. Diving limit is 400m.`, P.MED);
        qlog('CONN', `Helm, Conn — aye. Reduce rate of descent. Watch your depth.`, 1.0, P.MED);
      }
      msg(`DIVING LIMIT — ${Math.round(depthM)}m`, 2.0);
    },

    designDepth(depthM) {
      log('ENG', `Conn, Eng — hull stress audible. Depth ${Math.round(depthM)}m. Exceeding design depth.`, P.CRIT);
      msg(`DESIGN DEPTH EXCEEDED — ${Math.round(depthM)}m`, 2.5);
    },

    crush(depthM) {
      log('CONN', `Conn — crush depth exceeded at ${depthM}m. Hull failure.`, P.CRIT);
      msg('HULL FAILURE', 5.0);
    },
    collapseImminentWarning(depthM) {
      log('ENG', `Conn, Eng — structural failure imminent. Depth ${Math.round(depthM)}m. She will not hold.`, P.CRIT);
      msg(`COLLAPSE DEPTH — ${Math.round(depthM)}m`, 3.0);
    },

    hullDamageCreaking(depthM) {
      log('ENG', `Conn, Eng — hull working hard at ${Math.round(depthM)}m. Structural damage is audible — creaking and stress pops heard throughout the boat. Recommend reducing depth.`, P.CRIT);
      qlog('CONN', `Conn — understood. Watch your depth, watch your depth.`, 1.4, P.CRIT);
      msg(`HULL STRESS — ${Math.round(depthM)}m`, 2.5);
    },

  };

  // ════════════════════════════════════════════════════════════════════════
  // TRIM / BUOYANCY / HPA
  // ════════════════════════════════════════════════════════════════════════
  const trim = {
    planesDemanded(pct) {
      log('HELM', `Conn, Helm — planes working hard. ${pct}% authority remaining. Flooding affecting trim.`, P.MED);
    },
    planesOverwhelmed(speedKt) {
      log('HELM', `Conn, Helm — unable to hold ordered depth on planes. Insufficient authority at ${speedKt}kt.`, P.CRIT);
      qlog('CONN', `Helm, Conn — increase speed. We need planes to hold trim.`, 1.0, P.CRIT);
    },
    ballastStrained(pct) {
      log('ENG', `Conn, Eng — ballast compensating for flooding. System at ${pct}% capacity. Monitoring.`, P.MED);
    },
    ballastLimit() {
      log('ENG', `Conn, Eng — ballast tanks at limit. Unable to compensate further. Boat will sink if flooding continues.`, P.CRIT);
      msg('BALLAST LIMIT', 2.5);
    },
    ballastOverwhelmed() {
      log('ENG', `Conn, Eng — flooding exceeds ballast capacity. Boat is sinking.`, P.CRIT);
      qlog('CONN', `All stations, Conn — blow ballast. Emergency surface.`, 0.8, P.CRIT);
      msg('BALLAST OVERWHELMED', 3.0);
    },
    // ── Emergency blow state comms ──────────────────────────────────────────
    // ── Manual blow casualty comms ───────────────────────────────────────────
    blowAlreadyActive() {
      log('ENG', 'Conn, Eng — emergency blow already in progress.', P.MED);
    },
    blowSystemFailed(sysState) {
      // Fires immediately after blowOpened — tells player something is wrong
      const why = sysState === 'degraded'
        ? 'Ballast control degraded. Main blow may not respond.'
        : 'Ballast control offline. Main blow system unserviceable.';
      qlog('HELM', `Conn, Helm — no response on blow controls. ${why}`, 3.5, P.CRIT);
      qlog('CONN', 'DC, Conn — main blow system has failed. Shut main vents in hand control. Open HPA manually.', 5.0, P.CRIT);
      msg('BLOW SYSTEM FAILED', 5.0);
    },
    blowNoResponse() {
      // Redundant safety call if pending timer fires
      log('HELM', 'Conn, Helm — no response on blow. Confirming system failure.', P.CRIT);
    },
    blowManualVentsShut() {
      qlog('DC', 'Conn, DC — main vents shut in hand control. Standing by to open HPA.', 0, P.MED);
    },
    blowManualHPAOpen(ambientBar, groupBar) {
      log('DC', `Conn, DC — HPA open in hand control. Main ballast venting. Ambient ${ambientBar} bar, group pressure ${groupBar} bar.`, P.CRIT);
      msg('MANUAL BLOW — VENTING', 2.0);
    },

    blowOpened(ambientBar, groupBar) {
      // Full RN emergency blow sequence — queued so lines play in order
      // Used only when auto blow works (immediate venting)
      log('CONN', 'Conn — all hands — Emergency stations, emergency stations, emergency stations: Blow ballast. Prepare to surface the boat.', P.CRIT);
      msg('EMERGENCY STATIONS', 2.5);
      qlog('CONN', 'Conn — full ahead both. Full rise on the planes. Prepare to surface the boat.', 1.5, P.CRIT);
      qlog('HELM', 'Conn, Helm — full ahead, full rise on the planes. Aye.', 2.8, P.MED);
      qlog('CONN', 'DC, Conn — prepare to operate main vents in hand control. Blow main ballast.', 4.0, P.CRIT);
      qlog('ENG',  `Conn, Eng — emergency blow open. Main ballast venting. Ambient ${ambientBar} bar, group pressure ${groupBar} bar.`, 5.5, P.CRIT);
      msg('EMERGENCY BLOW — VENTING', 5.5);
    },
    blowOrderedManual() {
      // Emergency stations only — venting comms deferred until DC actually opens HPA
      log('CONN', 'Conn — all hands — Emergency stations, emergency stations, emergency stations: Blow ballast. Prepare to surface the boat.', P.CRIT);
      msg('EMERGENCY STATIONS', 2.5);
      qlog('CONN', 'Conn — full ahead both. Full rise on the planes.', 1.5, P.CRIT);
      qlog('HELM', 'Conn, Helm — full ahead, full rise. Aye. Attempting blow.', 2.8, P.MED);
    },
    blowProgress(depthM, differential) {
      if(differential > 20){
        log('ENG', `Conn, Eng — blow continuing. Depth ${depthM}m, pressure differential ${differential} bar. Rising.`, P.MED);
      } else if(differential > 5){
        log('ENG', `Conn, Eng — blow weakening. Depth ${depthM}m, differential ${differential} bar. Climb rate reducing.`, P.CRIT);
      } else {
        log('ENG', `Conn, Eng — blow near exhausted. Depth ${depthM}m, differential ${differential} bar. Minimal climb rate.`, P.CRIT);
        msg('BLOW WEAKENING', 2.0);
      }
    },
    blowTanksClear(depthM) {
      log('ENG', `Conn, Eng — main ballast clear. Securing blow. Boat is positively buoyant at ${depthM}m. Rising.`, P.MED);
      msg('BALLAST CLEAR — RISING', 2.0);
    },
    blowOverwhelmed(depthM) {
      log('ENG', `Conn, Eng — main ballast clear but flooding mass too great. Boat is negatively buoyant at ${depthM}m. Still sinking.`, P.CRIT);
      qlog('CONN', `All stations, Conn — blown tanks cannot overcome flooding. DC priority: reduce flood load or prepare to abandon.`, 2.0, P.CRIT);
      msg('BLOW INSUFFICIENT — SINKING', 3.0);
    },
    blowExhausted(depthM) {
      log('ENG',  `Conn, Eng — HP air equalised with ambient. Securing emergency blow. Depth ${depthM}m. No further blow available without surface recharge.`, P.CRIT);
      qlog('CONN', `All stations, Conn — secured from emergency blow. Boat at ${depthM}m. HP air exhausted.`, 1.0, P.CRIT);
      msg('SECURED — BLOW EXHAUSTED', 3.0);
    },
    surfaceRechargeStarted(currentBar) {
      log('ENG', `Conn, Eng — HP air banks charging from atmosphere. Group pressure ${currentBar} bar. Recharge in progress.`, P.MED);
      msg('HP AIR CHARGING', 1.5);
    },
    blowCancelledByOrder(depthM) {
      log('ENG', `Conn, Eng — blow valves closed. Securing emergency blow on new depth order. Depth ${depthM}m.`, P.MED);
      msg('SECURED — BLOW CANCELLED', 1.5);
    },
    blowSurfaced() {
      log('ENG', 'Conn, Eng — blow valves closed. Securing emergency blow. Boat is surfaced.', P.MED);
      qlog('CONN', 'All stations, Conn — secured from emergency blow. Surfaced.', 0.8, P.MED);
      msg('SECURED — SURFACED', 2.0);
    },
    blowFailNoHPA() {
      log('ENG', 'Conn, Eng — unable to blow. HP air pressure below ambient. Cannot displace water.', P.CRIT);
      msg('BLOW FAILED — NO PRESSURE', 2.5);
    },
    reserveHPACommitted() {
      log('ENG', 'Conn, Eng — reserve HP air committed to blow. This is our last air.', P.CRIT);
      msg('RESERVE HPA — COMMITTED', 2.0);
    },
    hpaLow(pct) {
      if(pct < 8){
        log('ENG', `Conn, Eng — HP air critical. ${pct}% remaining. Ballast authority degrading.`, P.CRIT);
        msg('HP AIR CRITICAL', 2.0);
      } else {
        log('ENG', `Conn, Eng — HP air low. ${pct}% remaining. Recommend recharge.`, P.MED);
      }
    },
    rechargeToggle(on) {
      if(on){
        log('ENG', 'Conn, Eng — HP compressors running. Active recharge commenced. We are louder.', P.MED);
        msg('HP RECHARGE — ACTIVE', 1.2);
      } else {
        log('ENG', 'Conn, Eng — HP compressors secured. Passive recharge only.', P.MED);
        msg('HP RECHARGE — SECURED', 1.2);
      }
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // FIRE
  // ════════════════════════════════════════════════════════════════════════
  const fire = {
    // Manned room: crew see it immediately
    ignited(compLabel, station) {
      msg(`FIRE — ${compLabel}`, 1.5);
      log(station, `Conn, ${station} — FIRE in ${compLabel}. Evacuating non-essential crew`, P.CRIT);
      qlog('CONN', `${station}, Conn — aye. DC teams, fire in ${compLabel}. Emergency stations`, 2.0, P.CRIT);
    },
    // Unmanned room: automated sensor alarm at 40% — triggers investigation
    fireAlarm(roomLabel, station) {
      msg(`FIRE ALARM — ${roomLabel}`, 1.5);
      log('CONN', `All stations, Conn — fire detection alarm ${roomLabel}. Investigate and report`, P.CRIT);
      qlog(station, `Conn, ${station} — aye. En route to investigate`, 2.5, P.MED);
    },
    // Called after investigation delay (~12s) when fire is physically confirmed
    fireInvestigated(roomLabel, station) {
      log(station, `Conn, ${station} — fire confirmed in ${roomLabel}. Request emergency stations`, P.CRIT);
      qlog('CONN', `${station}, Conn — aye. DC teams, fire in ${roomLabel}. Emergency stations`, 2.0, P.CRIT);
    },
    watchkeeperResponse(compLabel, count) {
      const countStr = count === 1 ? 'one watchkeeper' : `${count} watchkeepers`;
      qlog('ENG', `Conn, ${compLabel} — ${countStr} staying to fight fire`, 1.5, P.MED);
    },
    watchkeeperCasualty(name, compLabel, status) {
      msg('FIRE CASUALTY', 1.2);
      log('ENG', `Conn, ${compLabel} — watchkeeper ${status}: ${name}`, P.CRIT);
    },
    watchkeeperOvercome(compLabel) {
      msg('WATCHKEEPERS OVERCOME', 1.4);
      log('ENG', `Conn, ${compLabel} — all watchkeepers overcome. Fire unattended`, P.CRIT);
    },
    dcArrival(teamLabel, compLabel) {
      log('ENG', `Conn, ${teamLabel} — on scene ${compLabel}, engaging fire`, P.MED);
    },
    dcRelief(compLabel) {
      log('ENG', `Conn, DC — relieving watchkeepers in ${compLabel}. Taking over fire fight`, P.MED);
    },
    dcStatus(teamLabel, pct, compLabel) {
      dcLog(`${teamLabel} — FIRE ${compLabel} at ${pct}%`);
    },
    outOfControl(compLabel) {
      msg('FIRE OUT OF CONTROL', 1.4);
      log('ENG', `Conn, ${compLabel} — fire out of control, cannot suppress`, P.CRIT);
    },
    heatDamage(sysLabel, state, compLabel) {
      log('ENG', `Conn, ${compLabel} — heat damage: ${sysLabel} ${state.toUpperCase()}`, P.MED);
    },
    extinguished(compLabel, by) {
      msg(`FIRE OUT — ${compLabel}`, 1.2);
      if (by === 'watch') {
        log('ENG', `Conn, ${compLabel} — fire out. Watchkeepers secured the compartment`, P.MED);
      } else {
        log('ENG', `Conn, DC — fire out in ${compLabel}. Compartment secure`, P.MED);
      }
    },
    drenchInitiated(compLabel) {
      msg(`N2 DRENCH — 20s — ${compLabel}`, 1.6);
      log('ENG', `Conn, DC — fire out of control in ${compLabel}. Evacuating, nitrogen drench in 20 seconds`, P.CRIT);
    },
    nitrogenDrench(compLabel, cas) {
      msg(`N2 DRENCH — ${compLabel}`, 1.6);
      log('ENG', `${compLabel} — N2 drench complete. Fire out. Compartment uninhabitable — DC team venting`, P.CRIT);
      if (cas > 0) qlog('ENG', `${compLabel} — ${cas} personnel overcome by drench`, 2.0, P.CRIT);
    },
    ventN2Required(compLabel) {
      msg(`VENT REQUIRED — ${compLabel}`, 1.3);
      log('CONN', `All stations, Conn — ${compLabel} drenched. DC team required to vent before securing`, P.CRIT);
    },
    ventN2Started(compLabel, teamLabel) {
      msg(`VENT N2 — ${compLabel}`, 1.2);
      log('ENG', `Conn, ${teamLabel} — commencing N2 vent ${compLabel}. Stand by 60 seconds`, P.MED);
    },
    ventN2Complete(compLabel) {
      msg(`N2 CLEAR — ${compLabel}`, 1.2);
      log('ENG', `Conn, ENG — N2 clear in ${compLabel}. Entering for inspection`, P.MED);
      qlog('CONN', `ENG, Conn — aye. Enter ${compLabel} and report`, 1.5, P.MED);
    },
    cascade(fromLabel, toLabel) {
      msg('FIRE SPREADING', 1.4);
      log('ENG', `Conn, ${fromLabel} — fire spreading to ${toLabel}`, P.CRIT);
    },
    crewReturn(compLabel, station, n) {
      log('CONN', `All stations, Conn — ${compLabel} fire out. Watchkeepers close up.`);
      qlog(station, `Conn, ${station} — manned and ready`, 0.5);
    },
  };

  // ── Medical ───────────────────────────────────────────────────────────────
  const medical = {
    // 1MC general announcing — "Casualty, casualty, casualty"
    casualtyCallOut(compLabel) {
      log('CONN', `CASUALTY CASUALTY CASUALTY — ${compLabel} — MEDICAL STAFF CLOSE UP`, P.CRIT);
      msg(`CASUALTY — ${compLabel}`, 2.5);
    },
    enRoute(staffLabel, compLabel) {
      log('MEDS', `${staffLabel} — En route to ${compLabel}`, P.NORMAL);
    },
    onScene(staffLabel, compLabel) {
      log('MEDS', `${staffLabel} — On scene ${compLabel}, assessing casualties`, P.MED);
    },
    treating(staffLabel, victimName, severity) {
      log('MEDS', `${staffLabel} — Treating ${victimName} (${severity})`, P.NORMAL);
    },
    recovered(staffLabel, victimName) {
      log('MEDS', `${staffLabel} — ${victimName} returned to duty`, P.MED);
    },
    bleedOut(victimName, compLabel) {
      log('MEDS', `CRITICAL CASUALTY LOST — ${victimName} in ${compLabel}`, P.CRIT);
      msg(`CRITICAL CASUALTY — ${victimName}`, 3.0);
    },
    staffDown(staffLabel) {
      log('MEDS', `${staffLabel} is a casualty — medical capacity reduced`, P.CRIT);
    },
    noMedStaff() {
      log('MEDS', `WARNING — No medical staff available. Casualties untreated`, P.CRIT);
      msg(`NO MEDICAL STAFF`, 3.0);
    },
    allClear(staffLabel) {
      log('MEDS', `${staffLabel} — All casualties treated. Returning to sick bay`, P.NORMAL);
    },
  };

  // ── Watch handover ────────────────────────────────────────────────────────
  const watch = {
    // OOW requests relief at 80% fatigue
    requestRelief(watchId) {
      log('CONN', `OOW — Watch ${watchId} crew fatigued. Request permission to relieve the watch, sir`, P.MED);
    },
    // Handover initiated — incoming watch mustering
    relieving(outgoing, incoming) {
      log('CONN', `Aye sir. Watch ${outgoing} — relieving the watch. Watch ${incoming} mustering now`, P.NORMAL);
      dcLog(`Watch change initiated — Watch ${incoming} incoming`);
    },
    // New watch assumes
    onWatch(incoming, oowName) {
      log('CONN', `Watch ${incoming} on watch. Officer of the Watch: ${oowName}`, P.MED);
      dcLog(`Watch ${incoming} assumed watch — ${oowName} OOW`);
    },
    // Forced change at 100% — degradation warning
    forcedChange(watchId) {
      log('CONN', `WARNING — Watch ${watchId} crew exhausted. Initiating emergency watch relief`, P.CRIT);
    },
    // Attempted during action/emergency
    blocked() {
      log('CONN', `Cannot relieve the watch — action stations closed up`, P.NORMAL);
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // SNORKEL PROCEDURES (diesel-electric boats only)
  // ════════════════════════════════════════════════════════════════════════
  const snorkel = {
    // CO orders snorkel — crew prepares, boat rises to snorkel depth
    ordered() {
      log('CONN', 'Conn, aye — prepare to snorkel. Coming to snorkel depth.', P.MED);
      msg('SNORKEL ORDERED', 1.5);
      qlog('HELM', 'Helm, aye — coming to snorkel depth. Rate of rise normal.', 1.0);
      qlog('ENG',  'Conn, Eng — snorkel induction system checked open. Standing by to raise mast.', 2.5);
    },
    // Snorkel depth reached — mast raised, diesels start
    deployed() {
      log('ENG',  'Conn, Eng — snorkel mast raised. Induction open. Starting diesels.', P.MED);
      msg('SNORKEL — RAISING MAST', 1.5);
      qlog('MANV', 'Conn, Manoeuvring — diesel generators on the line. Battery charging. Making ahead slow.', 2.0, P.MED);
      qlog('ENG',  'Conn, Eng — diesels running normally. Exhaust confirmed outboard. Charging at full rate.', 4.0);
      qlog('CONN', 'Manoeuvring, Conn — aye. All stations — we are snorkelling. ESM watch closed up.', 5.5, P.MED);
    },
    // CO cancels — mast comes down, diesels secured, back on battery
    cancelled() {
      log('CONN', 'Conn — cancel snorkel. Lowering mast. Take her back down.', P.MED);
      msg('SNORKEL — RETRACTING', 1.2);
      qlog('ENG',  'Conn, Eng — lowering snorkel mast. Induction sealed. Securing diesels.', 1.5);
      qlog('MANV', 'Conn, Manoeuvring — diesels secured. Propulsion to battery. Hotel load normal.', 3.5, P.MED);
      qlog('CONN', 'Manoeuvring, Conn — aye. Running on battery.', 5.0);
    },
    // Battery warnings — fired once per band crossing
    batteryLow(pct) {
      if(pct <= 10){
        log('ENG',  `Conn, Eng — battery critical at ${pct}%. Must snorkel or reduce speed immediately.`, P.CRIT);
        qlog('MANV', `Conn, Manoeuvring — at current load, propulsion offline in under two minutes.`, 1.5, P.CRIT);
        msg(`BATTERY CRITICAL — ${pct}%`, 2.5);
      } else if(pct <= 20){
        log('ENG',  `Conn, Eng — battery low, ${pct}%. Request permission to snorkel.`, P.MED);
        msg(`BATTERY LOW — ${pct}%`, 2.0);
      } else {
        log('ENG',  `Conn, Eng — battery at ${pct}%. Recommend snorkelling at earliest opportunity.`, P.NORMAL);
      }
    },
    // Battery dead — propulsion lost
    exhausted() {
      log('MANV', 'Conn, Manoeuvring — battery exhausted. No propulsion. EPM not installed.', P.CRIT);
      qlog('ENG',  'Conn, Eng — propulsion offline. Snorkel or surface to recover. Hotel load on reserve cells.', 1.5, P.CRIT);
      qlog('CONN', 'All stations, Conn — loss of propulsion on battery exhaustion. Boat is dead in the water. Stand by.', 3.0, P.CRIT);
      msg('PROPULSION LOST — BATTERY DEAD', 3.0);
    },
    // Battery recovered enough to move again
    recovered() {
      log('MANV', 'Conn, Manoeuvring — battery above minimum. Propulsion answering.', P.MED);
      qlog('ENG',  'Conn, Eng — propulsion restored. Recommend maintaining snorkel until battery above fifty percent.', 2.0);
      msg('PROPULSION RESTORED', 1.5);
    },
    // ESM / noise warnings while snorkelling
    noisyCaution() {
      log('CONN', 'Conn — all stations. Snorkelling creates a detectable signature. Maintain ESM watch. Be ready to lower mast on contact.', P.MED);
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ════════════════════════════════════════════════════════════════════════
  const mast = {
    raised(label)       { log('CONN', `${label} raised`); },
    lowered(label)      { log('CONN', `${label} lowered`); },
    floodWarning(label) {
      log('CONN', `Conn — ${label} below safe depth. Flooding risk — lower immediately`, P.CRIT);
      msg(`${label} FLOOD RISK`, 1.8);
    },
    crushed(label) {
      log('CONN', `${label} crushed — hull flooding`, P.CRIT);
      msg(`${label} CRUSHED`, 2.5);
    },
    esmContacts(contacts) {
      for(const c of contacts.slice(0,3)){
        log('ESM', `Conn, ESM — emitter bears ${String(c.brgDeg).padStart(3,'0')}, ${c.strength}`);
      }
      if(contacts.length>3) log('ESM', `ESM — ${contacts.length} emitters total`);
    },
    radarSweep(count) {
      if(count>0){
        log('CONN', `Radar — ${count} surface contact${count>1?'s':''}`);
        log('SONAR', 'Conn, Sonar — own-ship radar emission. Escorts will go active', P.MED);
      } else {
        log('CONN', 'Radar — no contacts');
      }
    },
  };

  window.COMMS = { P, COMP_STATION, dcLog, flood, dc, sys, reactor, escape, combat, weapons, nav, sensors, tactical, panel, ui, crewState, depth, trim, planes, fire, watch, medical, snorkel, mast };

})();
