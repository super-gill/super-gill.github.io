'use strict';

import { CONFIG } from '../config/constants.js';
import { player, world, bullets, sonarContacts, tdc, triggerScram } from '../state/sim-state.js';
import { session, setMsg, addLog, setTacticalState, setCasualtyState } from '../state/session-state.js';
import { ui } from '../state/ui-state.js';

// ── Lazy bindings for circular deps ─────────────────────────────────────
let _W = null;
let _COMMS = null;
let _DMG = null;
let _I = null;
let _AI = null;
let _onWireCut = null;
let _reserveTube = null;
let _reserveSpecificTube = null;
let _DPR = 1;
let _canvas = null;

export function _bindPanel(deps) {
  if (deps.W) _W = deps.W;
  if (deps.COMMS) _COMMS = deps.COMMS;
  if (deps.DMG) _DMG = deps.DMG;
  if (deps.I) _I = deps.I;
  if (deps.AI) _AI = deps.AI;
  if (deps.onWireCut) _onWireCut = deps.onWireCut;
  if (deps.reserveTube) _reserveTube = deps.reserveTube;
  if (deps.reserveSpecificTube) _reserveSpecificTube = deps.reserveSpecificTube;
  if (deps.DPR != null) _DPR = deps.DPR;
  if (deps.canvas) _canvas = deps.canvas;
}

const C = CONFIG;

const SPEED_STATES=[
  {label:'AHEAD FLANK',    kts:28,  dir:1,  connOrder:'Eng, Conn — all ahead flank',    engAck:'Conn, Eng — all ahead flank, aye'},
  {label:'AHEAD FULL',     kts:20,  dir:1,  connOrder:'Eng, Conn — all ahead full',     engAck:'Conn, Eng — all ahead full, aye'},
  {label:'AHEAD STD',      kts:14,  dir:1,  connOrder:'Eng, Conn — all ahead standard', engAck:'Conn, Eng — all ahead standard, aye'},
  {label:'AHEAD SLOW',     kts:7,   dir:1,  connOrder:'Eng, Conn — ahead slow',         engAck:'Conn, Eng — ahead slow, aye'},
  {label:'AHEAD CREEP',    kts:3,   dir:1,  connOrder:'Eng, Conn — ahead creep',        engAck:'Conn, Eng — ahead creep, aye'},
  {label:'ALL STOP',       kts:0,   dir:0,  connOrder:'All stop',                       engAck:'Conn, Eng — all stop, aye. Answering all stop'},
  {label:'BACK SLOW',      kts:5,   dir:-1, connOrder:'Eng, Conn — back slow',          engAck:'Conn, Eng — back slow, aye'},
  {label:'BACK FULL',      kts:10,  dir:-1, connOrder:'Eng, Conn — back full',          engAck:'Conn, Eng — back full, aye'},
  {label:'BACK EMERGENCY', kts:18,  dir:-1, connOrder:'Eng, Conn — back emergency',     engAck:'Conn, Eng — back emergency, aye'},
];

let _telegraphIdx=5;

// Button registry — rebuilt each frame by drawPanel()
const _btns=[];
function clearBtns(){ _btns.length=0; }
function registerBtn(x,y,w,h,action){ _btns.push({x,y,w,h,action}); }
function handleClick(mx,my){
  for(const b of _btns){
    if(mx>=b.x&&mx<=b.x+b.w&&my>=b.y&&my<=b.y+b.h){ b.action(); return true; }
  }
  return false;
}

function getTelegraph(){ return SPEED_STATES[_telegraphIdx]; }

function setTelegraph(idx){
  _telegraphIdx=idx;
  const s=SPEED_STATES[idx];
  const p=player;
  if(p){ p.speedOrderKts=s.kts; p.speedDir=s.dir; }
  const dmgFx=_DMG?.getEffects()||{};
  if(dmgFx.connRoomLost){
    _COMMS?.panel?.speedOrderRelay(s.label, s.connOrder, s.engAck);
  } else {
    _COMMS?.panel?.speedOrder(s.label, s.connOrder, s.engAck);
  }
}

function setSpeedKts(kts){
  const p=player; if(!p) return;
  kts=Math.max(0, Math.min(kts, C.player.flankKts||28));
  p.speedOrderKts=kts;
  p.speedDir=kts>0?1:0;
  let bestIdx=5;
  let bestDiff=Infinity;
  for(let i=0;i<SPEED_STATES.length;i++){
    const s=SPEED_STATES[i];
    if(s.dir>=0){
      const diff=Math.abs(s.kts-kts);
      if(diff<bestDiff){ bestDiff=diff; bestIdx=i; }
    }
  }
  _telegraphIdx=bestIdx;
  _COMMS?.panel?.speedOrder(`${kts} KTS`, `Helm, Conn — make turns for ${kts} knots`, `Maneuvering aye, ${kts} knots`);
}

function depthStep(delta){
  const p=player;
  const ground=world?.ground??1900;
  if(!p) return;
  // Snap to nearest boundary in the step direction, then step evenly
  const cur=p.depthOrder??p.depth;
  const step=Math.abs(delta);
  const snapped=delta>0 ? Math.ceil(cur/step)*step : Math.floor(cur/step)*step;
  const newDepth=snapped===cur ? cur+delta : snapped;
  p.depthOrder=Math.max(20,Math.min(ground-60,newDepth));
  if(p._blowVenting || p._blowPending || p._blowManualT > 0 || p._blownBallast){
    p._blowVenting = false;
    p._blowVy = 0;
    p._blowPending = false;
    p._blowManualT = 0;
    p._blownBallast = false;
    const hpaR=p.damage?.hpa;
    if(hpaR) hpaR._reserveCommitted = false;
    _COMMS?.trim?.blowCancelledByOrder(Math.round(p.depthOrder));
    setCasualtyState('normal');
    setTacticalState('cruising');
  }
  // Cancel crash dive on depth change
  if(p._crashDiving){
    p._crashDiving = false;
    p._crashTanksFull = false;
  }
  clearTimeout(p._depthLogTimer);
  p._depthLogTimer=setTimeout(()=>{
    const ordStr=`${Math.round(p.depthOrder)}m`;
    const dmgFxD=_DMG?.getEffects()||{};
    if(dmgFxD.connRoomLost){
      _COMMS?.nav?.depthOrderRelay(ordStr, delta>0?'down':'up');
    } else {
      _COMMS?.nav?.depthOrder(ordStr, delta>0?'down':'up');
    }
  },1000);
}

function courseStep(degDelta){
  const p=player;
  if(!p) return;
  if(p.orderedHeading==null){
    const hdg=p.heading||0;
    p.orderedHeading=((Math.atan2(Math.cos(hdg),-Math.sin(hdg))*180/Math.PI)+360)%360;
  }
  p.orderedHeading=((p.orderedHeading+degDelta)%360+360)%360;
  p._orderedCourseReached=false;
  if(_route) _route.length=0;
  clearTimeout(p._courseLogTimer);
  p._courseLogTimer=setTimeout(()=>{
    const ordStr=Math.round(p.orderedHeading).toString().padStart(3,'0');
    _COMMS?.nav?.courseChange(ordStr);
  },1000);
}

// Route reference — set by _bindPanel from nav.js's exported route
let _route = null;
export function _bindRoute(route) { _route = route; }

function comeToPD(){
  const p=player;
  if(!p) return;
  p.depthOrder=C.player?.periscopeDepth??140;
  _COMMS?.nav?.comeToPD();
}

function toggleSilent(){
  const p=player;
  if(!p) return;
  const dmgFx=_DMG?.getEffects()||{};
  if(dmgFx.silentRunAvail===false){ _COMMS?.nav?.connRoomUnavail('silent running'); return; }
  p.silent=!p.silent;
  // Snap telegraph to AHEAD SLOW when activating silent running
  if(p.silent){
    const slowIdx = SPEED_STATES.findIndex(s=>s.label==='AHEAD SLOW');
    const slowKts = slowIdx >= 0 ? SPEED_STATES[slowIdx].kts : 7;
    if((SPEED_STATES[_telegraphIdx]?.kts ?? 0) > slowKts){
      _telegraphIdx = slowIdx >= 0 ? slowIdx : _telegraphIdx;
      p.speedOrderKts = SPEED_STATES[_telegraphIdx]?.kts ?? 7;
      p.speedDir      = SPEED_STATES[_telegraphIdx]?.dir ?? 1;
    }
  }
  _COMMS?.nav?.silentRunning(p.silent);
}

function emergencyTurn(){
  const p=player;
  if(!p) return;
  if((p.emergTurnCd||0)>0){ _COMMS?.ui?.emergencyTurnCooldown(); return; }
  if((p.emergTurnT||0)>0) return;
  const ta=p.towedArray;
  if(ta){
    if(ta.state==='operational'){ ta.state='damaged'; _COMMS?.nav?.towedArrayStress('manoeuvre','damaged'); }
    else if(ta.state==='damaged'){ ta.state='destroyed'; _COMMS?.nav?.towedArrayStress('manoeuvre','destroyed'); }
  }
  if(_route) _route.length=0;
  p.emergTurnT=C.player.emergencyTurn.dur;
  p.emergTurnCd=C.player.emergencyTurn.cd;
  p.noiseTransient=Math.min(1,(p.noiseTransient||0)+C.player.emergencyTurn.noiseSpike);
  const emergRecent=(p.crashDiveCd||0) > (C.player.crashDive?.cd||12)*0.7;
  if(emergRecent && p.speed>20 && Math.random()<0.45){
    triggerScram('combo');
    _COMMS?.reactor?.scram('turn');
    return;
  }
  _COMMS?.nav?.emergencyTurn();
  _partAllWires('turn');
}

function emergencyCrashDive(){
  const p=player;
  const ground=world?.ground??1900;
  if(!p) return;
  if(p.scram) return;
  const dmgFx=_DMG?.getEffects()||{};
  if(dmgFx.crashDiveAvail===false){ _COMMS?.nav?.connRoomUnavail('crash dive'); return; }
  if(p.crashDiveCd>0) return;
  if(p._crashDiving) return;
  const emergRecent=(p.emergTurnCd||0) > (C.player.emergencyTurn?.cd||30)*0.7;
  if(emergRecent && p.speed>20 && Math.random()<0.45){
    triggerScram('combo');
    _COMMS?.reactor?.scram('turn');
    return;
  }
  // Cancel active blow — crash dive overrides emergency surface
  if(p._blowVenting || p._blowPending || (p._blowManualT||0) > 0 || p._blownBallast){
    p._blowVenting = false;
    p._blowVy = 0;
    p._blowPending = false;
    p._blowManualT = 0;
    p._blownBallast = false;
    const hpaR=p.damage?.hpa;
    if(hpaR) hpaR._reserveCommitted = false;
    setCasualtyState('normal');
    setTacticalState('cruising');
  }
  const ta=p.towedArray;
  if(ta){
    if(ta.state==='operational'){ ta.state='damaged'; _COMMS?.nav?.towedArrayStress('crash dive','damaged'); }
    else if(ta.state==='damaged'){ ta.state='destroyed'; _COMMS?.nav?.towedArrayStress('crash dive','destroyed'); }
  }
  p._crashDiving=true;
  p.crashDiveCd=C.player.crashDive.cd;
  p._crashTanksFull=false;
  p.noiseTransient=Math.min(1,(p.noiseTransient||0)+C.player.crashDive.noiseSpike);
  p.depthOrder=Math.min(ground-60,(p.depthOrder??p.depth)+600);
  p._crashTauOverride=C.player.crashDive.tauOverride??0.4;
  p._crashDepthCalled=new Set();
  const flankIdx = SPEED_STATES.findIndex(s=>s.label==='AHEAD FLANK');
  const fullIdx  = SPEED_STATES.findIndex(s=>s.label==='AHEAD FULL');
  const useIdx   = flankIdx>=0 ? flankIdx : fullIdx>=0 ? fullIdx : _telegraphIdx;
  if(_telegraphIdx !== useIdx){
    _telegraphIdx = useIdx;
    p.speedOrderKts = SPEED_STATES[useIdx]?.kts ?? 20;
    p.speedDir      = SPEED_STATES[useIdx]?.dir ?? 1;
  }
  if(!p.planes) p.planes = { fwd:{angle:0,mode:'hydraulic'}, aft:{angle:0,mode:'hydraulic'} };
  p.planes.aft.angle = -15;
  p.planes.fwd.angle = -8;
  _COMMS?.nav?.crashDive();
  const ballastState=p.damage?.systems?.ballast||'nominal';
  if(ballastState==='degraded'||ballastState==='offline'||ballastState==='destroyed'){
    _COMMS?.nav?.ballastDamageWarning?.(ballastState);
  }
  _partAllWires('dive');
}

function emergencyBlowBallast(){
  const p=player;
  if(!p) return;
  const hpa=p.damage?.hpa;
  const hpaC=C.player.hpa||{};
  const ambient=(p.depth||0)*(hpaC.ambientPerMetre||0.1);

  if(p._blowVenting || p._blowPending || (p._blowManualT||0) > 0){
    _COMMS?.trim?.blowAlreadyActive();
    return;
  }

  const totalAvail=(hpa?.pressure||0)+(hpa?.reserve||0);
  if(totalAvail <= ambient){
    _COMMS?.trim?.blowFailNoHPA();
    return;
  }

  if(hpa && hpa.pressure < ambient && hpa.reserve > 0){
    hpa._reserveCommitted = true;
    _COMMS?.trim?.reserveHPACommitted();
  }

  // Cancel crash dive — e-blow overrides
  if(p._crashDiving){
    p._crashDiving = false;
    p._crashTanksFull = false;
  }

  setTacticalState('action');
  setCasualtyState('emergency');

  // Set at least AHEAD FULL — but don't downgrade if already at FLANK
  const fullIdx = SPEED_STATES.findIndex(s=>s.label==='AHEAD FULL');
  const currentKts = SPEED_STATES[_telegraphIdx]?.kts ?? 0;
  const fullKts = fullIdx >= 0 ? SPEED_STATES[fullIdx].kts : 20;
  if(currentKts < fullKts){
    _telegraphIdx = fullIdx >= 0 ? fullIdx : _telegraphIdx;
    p.speedOrderKts = SPEED_STATES[_telegraphIdx]?.kts ?? 20;
    p.speedDir      = SPEED_STATES[_telegraphIdx]?.dir ?? 1;
  }

  p.depthOrder = 0;
  p.noiseTransient = Math.min(1,(p.noiseTransient||0)+0.30);

  const ballastSys = p.damage?.systems?.ballast || 'nominal';
  const strikes   = p.damage?.strikes;
  const anyDamage = ballastSys !== 'nominal'
    || (strikes && Object.values(strikes).some(v => v > 0));
  const autoWorks = !anyDamage;
  const degraded  = ballastSys === 'degraded';

  if(autoWorks){
    p._blowVenting = true;
    _COMMS?.trim?.blowOpened(Math.round(ambient), Math.round(hpa?.pressure??0));
  } else {
    p._blowPending = true;
    p._blowPendingT = degraded ? 5 : 3;
    p._blowManualT  = 0;
    p._blowAmbient  = Math.round(ambient);
    p._blowGroupP   = Math.round(hpa?.pressure??0);
    _COMMS?.trim?.blowOrderedManual();
    _COMMS?.trim?.blowSystemFailed(ballastSys);
  }
}

function toggleHPARecharge(){
  const d=player?.damage;
  if(!d?.hpa) return;
  d.hpa.recharging=!d.hpa.recharging;
  _COMMS?.trim?.rechargeToggle?.(d.hpa.recharging);
}

function allStop(){ setTelegraph(5); }
function snapToAllStop(){ setTelegraph(5); }

function wepsShoot(){
  const p=player;
  if(!p) return;
  const wp=ui.wepsProposal;
  if(!wp){ _COMMS?.weapons?.noSolution(); return; }
  if((p.pendingFires||[]).length>0){
    _COMMS?.weapons?.unableFiring();
    return;
  }
  if(!_reserveTube){ _COMMS?.weapons?.fireControlOffline(); return; }
  const sel=ui.wirePanel?.selectedTube??-1;
  let tubeIdx=-1;
  if(sel>=0 && _reserveSpecificTube){
    const r=_reserveSpecificTube(sel);
    if(r.reason==='missile'){ _COMMS?.weapons?.error('Missile load — use ASCM panel'); return; }
    if(r.reason==='wire'){    _COMMS?.weapons?.error('Wire live on selected tube'); return; }
    if(r.reason==='empty'){   _COMMS?.weapons?.error('Selected tube empty'); return; }
    if(r.reason==='damaged'){ _COMMS?.weapons?.error('Tube damaged / unavailable'); return; }
    if(r.reason==='reloading'){ _COMMS?.weapons?.error('Selected tube reloading'); return; }
    tubeIdx=r.idx;
  }
  if(tubeIdx<0) tubeIdx=_reserveTube();
  if(tubeIdx<0){
    const dmgFx=_DMG?.getEffects()||{};
    const why=p.torpStock<=0?'No weapons remaining'
      :(dmgFx.tubesAvail||0)===0?'Torpedo room offline'
      :'All tubes reloading';
    _COMMS?.weapons?.error(why); return;
  }
  const ddx=Math.cos(wp.bearing), ddy=Math.sin(wp.bearing);
  const launchOffset=Math.abs((function(){
    const a=wp.bearing-p.heading;
    return ((a+Math.PI)%(2*Math.PI))-Math.PI;
  })());
  const launchSpeedKts = p.speed ?? 0;
  const launchCap = C.player.wireMaxLaunchKts ?? 15;
  if(launchSpeedKts > launchCap){
    _COMMS?.weapons?.error(`Too fast to fire. Reduce to below ${launchCap}kt.`);
    p.torpTubes[tubeIdx] = 0;
    p.torpStock = (p.torpStock||0) + 1;
    return;
  }
  if(setTacticalState('action')){
    _COMMS?.crewState?.actionStations('attack');
  }
  const tubeLoad=(p.tubeLoad||[])[tubeIdx];
  const wlP=(!tubeLoad||tubeLoad==='torp')?(C.weapons?.[C.player?.torpWeapon]?.shortLabel||'TORPEDO'):(C.weapons?.[tubeLoad]?.shortLabel||tubeLoad.toUpperCase());
  const cidP=tdc.targetId||'';
  _COMMS?.weapons?.firingProcedures(tubeIdx+1, wlP, cidP, false);
  if(!p.pendingFires) p.pendingFires=[];
  p.pendingFires.push({t:C.player.fireDelay, tubeIdx, ddx, ddy, launchOffset, fireDepth:wp.depth, wire:true, lockedTarget:tdc.target, weaponLabel:wlP, contactId:cidP});
  _DMG?.drawHPA?.( (C.player.hpa?.torpedoCost||2), false );
}

function _partAllWires(cause){
  const p = player;
  if(!p||!bullets) return;
  let parted = false;
  for(const b of bullets){
    if(b.kind==='torpedo' && b.wire?.live){
      b.wire.live = false;
      _onWireCut?.(b);
      parted = true;
    }
  }
  if(parted){
    if(cause==='turn') _COMMS?.weapons?.wireParted(null, 'turn');
    else               _COMMS?.weapons?.wireParted(null, 'dive');
  }
}

function callActionStations(){
  if(session.tacticalState==='action'){
    if(setTacticalState('cruising')){
      _COMMS?.crewState?.standDown('action');
    }
  } else {
    if(setTacticalState('action')){
      _COMMS?.crewState?.actionStations('manual');
    }
  }
}

function toggleTowedArray(){
  const p=player;
  if(!p) return;
  if(C.player?.hasTowedArray === false) return;
  const ta=p.towedArray;
  if(!ta) return;
  if(ta.state==='destroyed'){
    _COMMS?.sensors?.arrayCannotDeploy(); return;
  }
  if(ta.state==='stowed'||ta.state==='retracting'){
    if(p.speed>12){
      _COMMS?.sensors?.arrayDeploySpeedLimit(p.speed);
      return;
    }
    ta.state='deploying';
    ta.progress=ta.progress||0;
    ta._halfwayLogged=false;
    _COMMS?.sensors?.arrayDeploy();
  } else if(ta.state==='deploying'||ta.state==='operational'||ta.state==='damaged'){
    ta.state='retracting';
    _COMMS?.sensors?.arrayRetract();
  }
}

function btn2(ctx,label,x,y,w,h,col,action){
  const DPR=_DPR||1;
  ctx.fillStyle=col||'rgba(30,58,95,0.55)';
  ctx.beginPath(); ctx.roundRect(x,y,w,h,2*DPR); ctx.fill();
  if(label){
    ctx.fillStyle='rgba(200,220,255,0.90)';
    const fs=Math.max(9,Math.round(h/DPR*0.50))*DPR;
    ctx.font=`bold ${fs}px ui-monospace,monospace`;
    ctx.textAlign='center';
    ctx.fillText(label,x+w/2,y+h*0.72);
  }
  registerBtn(x,y,w,h,action);
}

// Wire panel state
function getWireTube(idx){
  if(!player?.tubeWires) return null;
  return player.tubeWires[idx]||null;
}
function selectWireTube(idx){ ui.wirePanel={...ui.wirePanel,selectedTube:idx}; }
function wireAutoTDC(idx,val){
  const t=getWireTube(idx); if(t?.wire?.live) t.wire.autoTDC=val;
}
function wireNudge(idx,degDelta){
  const t=getWireTube(idx);
  if(!t?.wire?.live) return;
  t.wire.autoTDC=false;
  const cur=t.wire.cmdBrg??Math.atan2(t.vy,t.vx);
  t.wire.cmdBrg=cur+(degDelta*Math.PI/180);
}
function wireCut(idx){
  const t=getWireTube(idx);
  if(t) _W?.cutWire(t);
}

export const wirePanel = {selectWireTube,wireAutoTDC,wireNudge,wireCut,getWireTube};

// ════════════════════════════════════════════════════════════════════════
// EXPORT (mirrors V1 window.PANEL shape)
// ════════════════════════════════════════════════════════════════════════
export const PANEL = {
  SPEED_STATES,
  setTelegraphIdx: (idx)=>{ _telegraphIdx=idx; },
  getTelegraph,
  clearBtns, registerBtn, handleClick,
  setTelegraph, setSpeedKts, depthStep, courseStep, comeToPD,
  toggleSilent, emergencyTurn, emergencyCrashDive, emergencyBlowBallast, toggleHPARecharge, allStop, snapToAllStop, toggleTowedArray, wepsShoot, callActionStations,
  btn2,
  initiateEscape(type){ _DMG?.initiateEscape(type); },
  get telegraphIdx(){ return _telegraphIdx; },
};
