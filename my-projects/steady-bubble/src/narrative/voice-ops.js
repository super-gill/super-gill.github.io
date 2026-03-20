'use strict';

import { log, qlog, msg, P, dcLog } from './comms.js';

// ════════════════════════════════════════════════════════════════════════
// NAVIGATION / HELM / MANOEUVRING
// ════════════════════════════════════════════════════════════════════════
export const nav = {
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
export const sensors = {
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
export const tactical = {
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
// DEPTH WARNINGS — state-aware
// ════════════════════════════════════════════════════════════════════════
export const depth = {
  divingLimit(depthM, tacticalState) {
    if (tacticalState === 'action') {
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
export const trim = {
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
  blowAlreadyActive() {
    log('ENG', 'Conn, Eng — emergency blow already in progress.', P.MED);
  },
  blowSystemFailed(sysState) {
    const why = sysState === 'degraded'
      ? 'Ballast control degraded. Main blow may not respond.'
      : 'Ballast control offline. Main blow system unserviceable.';
    qlog('HELM', `Conn, Helm — no response on blow controls. ${why}`, 3.5, P.CRIT);
    qlog('CONN', 'DC, Conn — main blow system has failed. Shut main vents in hand control. Open HPA manually.', 5.0, P.CRIT);
    msg('BLOW SYSTEM FAILED', 5.0);
  },
  blowNoResponse() {
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
    log('CONN', 'Conn — all hands — Emergency stations, emergency stations, emergency stations: Blow ballast. Prepare to surface the boat.', P.CRIT);
    msg('EMERGENCY STATIONS', 2.5);
    qlog('CONN', 'Conn — full ahead both. Full rise on the planes. Prepare to surface the boat.', 1.5, P.CRIT);
    qlog('HELM', 'Conn, Helm — full ahead, full rise on the planes. Aye.', 2.8, P.MED);
    qlog('CONN', 'DC, Conn — prepare to operate main vents in hand control. Blow main ballast.', 4.0, P.CRIT);
    qlog('ENG',  `Conn, Eng — emergency blow open. Main ballast venting. Ambient ${ambientBar} bar, group pressure ${groupBar} bar.`, 5.5, P.CRIT);
    msg('EMERGENCY BLOW — VENTING', 5.5);
  },
  blowOrderedManual() {
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
    log('ENG', `Conn, Eng — main ballast clear. Blow valves shut. Boat is positively buoyant at ${depthM}m. Rising on residual buoyancy.`, P.MED);
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
    log('ENG', `Conn, Eng — blow valves closed. Securing emergency blow.`, P.MED);
    qlog('CONN', `Eng, Conn aye — blow secured. Make your depth ${depthM} metres.`, P.MED, 1.5);
    msg('BLOW SECURED', 1.5);
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
export const fire = {
  ignited(compLabel, station) {
    msg(`FIRE — ${compLabel}`, 1.5);
    log(station, `Conn, ${station} — FIRE in ${compLabel}. Evacuating non-essential crew`, P.CRIT);
    qlog('CONN', `${station}, Conn — aye. DC teams, fire in ${compLabel}. Emergency stations`, 2.0, P.CRIT);
  },
  fireAlarm(roomLabel, station) {
    msg(`FIRE ALARM — ${roomLabel}`, 1.5);
    log('CONN', `All stations, Conn — fire detection alarm ${roomLabel}. Investigate and report`, P.CRIT);
    qlog(station, `Conn, ${station} — aye. En route to investigate`, 2.5, P.MED);
  },
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
  electricalFireReignition(roomLabel, station) {
    msg('ELECTRICAL FIRE — REIGNITION', 1.5);
    log(station, `Conn, ${station} — electrical fire reignition, ${roomLabel}. Source is damaged distribution board`, P.CRIT);
    dcLog(`ELECTRICAL FIRE REIGNITION — ${roomLabel} — damaged wiring`);
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

// ── Snorkel Flooding (Type 209) ──────────────────────────────────────
export const snorkelFlood = {
  minor() {
    msg('SNORKEL FLOOD — MINOR', 1.5);
    log('MAN', 'Conn, Manoeuvring — snorkel flood. Water in the induction. Diesel stalled. Securing snorkel', P.CRIT);
  },
  major() {
    msg('SNORKEL FLOOD — MAJOR', 2.0);
    log('MAN', 'Conn, Manoeuvring — snorkel flood, major. Flooding engine compartment. Securing snorkel. Closing induction valve', P.CRIT);
    qlog('CONN', 'All stations, Conn — snorkel flood. DC teams close up engine compartment', 2.0, P.CRIT);
  },
  catastrophic() {
    msg('SNORKEL HEAD VALVE FAILURE', 3.0);
    log('MAN', 'Conn, Manoeuvring — snorkel head valve failure. Catastrophic flooding through induction. All stop on snorkel. Closing induction manually', P.CRIT);
    qlog('CONN', 'All stations, Conn — catastrophic snorkel flood. Emergency stations. DC teams to engine compartment', 2.0, P.CRIT);
    dcLog('SNORKEL FLOOD — CATASTROPHIC — head valve failure', P.CRIT);
  },
};

// ── Chlorine Gas (Type 209) ─────────────────────────────────────────
export const chlorine = {
  trace() {
    msg('CHLORINE — TRACE', 1.5);
    log('MAN', 'Conn, Manoeuvring — chemical contamination. Chlorine gas detected in the motor room', P.MED);
  },
  hazardous() {
    msg('CHLORINE — HAZARDOUS', 2.0);
    log('MAN', 'Conn, Manoeuvring — chlorine concentration hazardous. Crew donning emergency breathing apparatus', P.CRIT);
    dcLog('CHLORINE HAZARDOUS — motor room — DC team effectiveness halved', P.CRIT);
  },
  lethal() {
    msg('CHLORINE — LETHAL', 2.5);
    log('MAN', 'Conn, Manoeuvring — chlorine lethal concentration. Evacuating motor room. DC teams cannot enter', P.CRIT);
    qlog('CONN', 'All stations, Conn — chlorine spreading through ventilation. Recommend surface and ventilate', 2.0, P.CRIT);
    dcLog('CHLORINE LETHAL — motor room evacuated — DC entry blocked', P.CRIT);
  },
  saturated() {
    msg('CHLORINE — SATURATED', 3.0);
    log('CONN', 'All stations, Conn — gas contamination spreading to adjacent sections. Hatches must be opened', P.CRIT);
    dcLog('CHLORINE SATURATED — spreading to adjacent sections', P.CRIT);
  },
};

// ── Hot Run Torpedo ──────────────────────────────────────────────────
export const hotRun = {
  detected(tube) {
    msg('HOT RUN — TUBE ' + tube, 3.0);
    log('TOR', `Conn, Torpedo Room — HOT RUN, HOT RUN — tube ${tube}. Motor running`, P.CRIT);
    qlog('TOR', `Torpedo Room — flooding tube ${tube}. Opening outer doors`, 1.5, P.CRIT);
    dcLog(`HOT RUN — tube ${tube} — 12 seconds to detonation`, P.CRIT);
  },
  ejected(tube) {
    msg('TORPEDO EJECTED', 2.0);
    log('TOR', `Conn, Torpedo Room — tube ${tube} ejected. Weapon clear of the hull`, P.CRIT);
    qlog('CONN', 'All stations, Conn — hot run contained. Weapon ejected. Stand by for damage assessment', 2.0, P.MED);
    dcLog(`HOT RUN RESOLVED — tube ${tube} ejected — tube degraded`);
  },
  detonation() {
    msg('DETONATION — TORPEDO ROOM', 4.0);
    log('CONN', 'Conn — detonation in the torpedo room', P.CRIT);
    dcLog('HOT RUN DETONATION — torpedo room — catastrophic', P.CRIT);
  },
  sympatheticDetonation() {
    msg('SYMPATHETIC DETONATION', 4.0);
    log('CONN', 'All stations — sympathetic detonation. Stored weapons. Torpedo room lost', P.CRIT);
    dcLog('SYMPATHETIC DETONATION — all stored weapons — torpedo room destroyed', P.CRIT);
  },
};

// ── Hydrogen ─────────────────────────────────────────────────────────
export const hydrogen = {
  caution() {
    msg('HYDROGEN — CAUTION', 1.5);
    log('MAN', 'Conn, Manoeuvring — hydrogen concentration elevated. Caution level in battery well', P.MED);
  },
  danger() {
    msg('HYDROGEN — DANGER', 2.0);
    log('MAN', 'Conn, Manoeuvring — hydrogen concentration dangerous. Recommend ventilating battery well. Request permission to come shallow', P.CRIT);
  },
  explosive() {
    msg('HYDROGEN — EXPLOSIVE', 2.5);
    log('MAN', 'Conn, Manoeuvring — hydrogen at explosive concentration. Recommend immediate ventilation', P.CRIT);
    qlog('CONN', 'All stations, Conn — hydrogen explosive concentration in battery well. Secure all non-essential electrical', 2.0, P.CRIT);
  },
  explosion(isDiesel) {
    msg('EXPLOSION — BATTERY WELL', 3.0);
    log('MAN', 'Conn, Manoeuvring — explosion in the battery well. Battery bank destroyed', P.CRIT);
    qlog('CONN', 'All stations, Conn — fire in engine room. Emergency stations', 1.5, P.CRIT);
    if (isDiesel) {
      qlog('MAN', 'Conn, Manoeuvring — all battery power lost. Propulsion lost. Recommend emergency surface', 3.0, P.CRIT);
    } else {
      qlog('MAN', 'Conn, Manoeuvring — EPM backup unavailable. Battery destroyed', 3.0, P.CRIT);
    }
    dcLog('HYDROGEN EXPLOSION — battery well — BEYOND REPAIR AT SEA', P.CRIT);
  },
};

// ── Shaft Seal ───────────────────────────────────────────────────────
export const shaftSeal = {
  activated() {
    msg('SHAFT SEAL FAILURE', 2.0);
    log('ENG', 'Conn, Aft Ends — shaft seal failure. Water ingress aft of frame. Leak rate increasing with speed', P.CRIT);
    qlog('CONN', 'Aft Ends, Conn — aye. DC teams, close up aft ends. Reduce speed to slow the leak', 2.0, P.CRIT);
    dcLog('SHAFT SEAL FAILURE — speed-dependent leak active', P.CRIT);
  },
  speedWarning() {
    log('ENG', 'Conn, Aft Ends — shaft seal leak rate increasing with speed. Recommend reducing speed', P.MED);
  },
};

// ── Hydraulic System ──────────────────────────────────────────────────
export const hydraulic = {
  pressureLow(hydState) {
    msg('HYDRAULIC PRESSURE LOW', 1.5);
    log('CONN', `Conn, Control Room — hydraulic pressure dropping. Main plant ${hydState.toUpperCase()}. WTD operation sluggish`, P.CRIT);
    qlog('ENG', 'Conn, Eng — hydraulic pressure low. Close WTDs now if required', 2.0, P.MED);
  },
  pressureCritical() {
    msg('HYDRAULIC PRESSURE CRITICAL', 2.0);
    log('CONN', 'Conn, Control Room — hydraulic pressure critical. WTDs frozen. Planes shifting to air-emergency', P.CRIT);
    qlog('HELM', 'Conn, Helm — planes on air emergency. HPA consumption increasing', 1.5, P.CRIT);
  },
  pressureZero() {
    msg('HYDRAULIC FAILURE', 2.5);
    log('CONN', 'All stations, Conn — complete hydraulic failure. WTDs frozen in current state. Planes on air-emergency backup only', P.CRIT);
  },
  fluidFire() {
    msg('HYDRAULIC FIRE', 1.8);
    log('ENG', 'Conn, Control Room — hydraulic fluid fire, Machinery Space. Aerosolised fluid on hot surfaces', P.CRIT);
    dcLog('HYDRAULIC FIRE — MACHINERY SPACE — aerosolised fluid ignition');
  },
};

// ── Medical ───────────────────────────────────────────────────────────────
export const medical = {
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
export const watch = {
  requestRelief(watchId) {
    log('CONN', `OOW — Watch ${watchId} crew fatigued. Request permission to relieve the watch, sir`, P.MED);
  },
  relieving(outgoing, incoming) {
    log('CONN', `Aye sir. Watch ${outgoing} — relieving the watch. Watch ${incoming} mustering now`, P.NORMAL);
    dcLog(`Watch change initiated — Watch ${incoming} incoming`);
  },
  onWatch(incoming, oowName) {
    log('CONN', `Watch ${incoming} on watch. Officer of the Watch: ${oowName}`, P.MED);
    dcLog(`Watch ${incoming} assumed watch — ${oowName} OOW`);
  },
  forcedChange(watchId) {
    log('CONN', `WARNING — Watch ${watchId} crew exhausted. Initiating emergency watch relief`, P.CRIT);
  },
  blocked() {
    log('CONN', `Cannot relieve the watch — action stations closed up`, P.NORMAL);
  },
};

// ════════════════════════════════════════════════════════════════════════
// SNORKEL PROCEDURES (diesel-electric boats only)
// ════════════════════════════════════════════════════════════════════════
export const snorkel = {
  ordered() {
    log('CONN', 'Conn, aye — prepare to snorkel. Coming to snorkel depth.', P.MED);
    msg('SNORKEL ORDERED', 1.5);
    qlog('HELM', 'Helm, aye — coming to snorkel depth. Rate of rise normal.', 1.0);
    qlog('ENG',  'Conn, Eng — snorkel induction system checked open. Standing by to raise mast.', 2.5);
  },
  deployed() {
    log('ENG',  'Conn, Eng — snorkel mast raised. Induction open. Starting diesels.', P.MED);
    msg('SNORKEL — RAISING MAST', 1.5);
    qlog('MANV', 'Conn, Manoeuvring — diesel generators on the line. Battery charging. Making ahead slow.', 2.0, P.MED);
    qlog('ENG',  'Conn, Eng — diesels running normally. Exhaust confirmed outboard. Charging at full rate.', 4.0);
    qlog('CONN', 'Manoeuvring, Conn — aye. All stations — we are snorkelling. ESM watch closed up.', 5.5, P.MED);
  },
  cancelled() {
    log('CONN', 'Conn — cancel snorkel. Lowering mast. Take her back down.', P.MED);
    msg('SNORKEL — RETRACTING', 1.2);
    qlog('ENG',  'Conn, Eng — lowering snorkel mast. Induction sealed. Securing diesels.', 1.5);
    qlog('MANV', 'Conn, Manoeuvring — diesels secured. Propulsion to battery. Hotel load normal.', 3.5, P.MED);
    qlog('CONN', 'Manoeuvring, Conn — aye. Running on battery.', 5.0);
  },
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
  exhausted() {
    log('MANV', 'Conn, Manoeuvring — battery exhausted. No propulsion. EPM not installed.', P.CRIT);
    qlog('ENG',  'Conn, Eng — propulsion offline. Snorkel or surface to recover. Hotel load on reserve cells.', 1.5, P.CRIT);
    qlog('CONN', 'All stations, Conn — loss of propulsion on battery exhaustion. Boat is dead in the water. Stand by.', 3.0, P.CRIT);
    msg('PROPULSION LOST — BATTERY DEAD', 3.0);
  },
  recovered() {
    log('MANV', 'Conn, Manoeuvring — battery above minimum. Propulsion answering.', P.MED);
    qlog('ENG',  'Conn, Eng — propulsion restored. Recommend maintaining snorkel until battery above fifty percent.', 2.0);
    msg('PROPULSION RESTORED', 1.5);
  },
  noisyCaution() {
    log('CONN', 'Conn — all stations. Snorkelling creates a detectable signature. Maintain ESM watch. Be ready to lower mast on contact.', P.MED);
  },
};

// ════════════════════════════════════════════════════════════════════════
// MAST / ESM / RADAR
// ════════════════════════════════════════════════════════════════════════
export const mast = {
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
