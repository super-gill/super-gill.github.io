'use strict';

import { CONFIG } from '../config/constants.js';
import { rand, clamp, angleNorm } from '../utils/math.js';
import { player, enemies, bullets, contacts, sonarContacts,
         missiles, tdc, decoys } from '../state/sim-state.js';
import { session, addLog } from '../state/session-state.js';
import { ui } from '../state/ui-state.js';

const C = CONFIG;

// ── Lazy bindings (set via bindPlayerControl) ───────────────────────────
let _COMMS = null;
let _I = null;
let _NAV = null;
let _SENSE = null;
let _W = null;
let _AI = null;
let _DMG = null;
let _MSL = null;
let _canvas = null;
let _SIM = null;     // reference to SIM export object for attaching methods

export function bindPlayerControl(deps) {
  if (deps.COMMS)  _COMMS  = deps.COMMS;
  if (deps.I)      _I      = deps.I;
  if (deps.NAV)    _NAV    = deps.NAV;
  if (deps.SENSE)  _SENSE  = deps.SENSE;
  if (deps.W)      _W      = deps.W;
  if (deps.AI)     _AI     = deps.AI;
  if (deps.DMG)    _DMG    = deps.DMG;
  if (deps.MSL)    _MSL    = deps.MSL;
  if (deps.canvas) _canvas = deps.canvas;
  if (deps.SIM)    _SIM    = deps.SIM;
}

// ── Tube management ─────────────────────────────────────────────────────

// Returns true and consumes one tube+stock if a shot can be fired; false otherwise
// Reserve a tube (starts reload for non-wire shots, or marks as wire-occupied).
// Returns tube index or -1.
function reserveTube(){
  const tubes=player.torpTubes;
  const stock=player.torpStock;
  if(!tubes||tubes.length===0) return -1;
  if(typeof stock!=='number'||stock<=0) return -1;
  // Only scan up to tubesAvail -- damaged tubes are unavailable
  const avail=_DMG.getEffects().tubesAvail??tubes.length;
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

// Reserve a specific tube by index. Returns idx on success, -1 on failure.
// Sets player.torpStock only for torpedo loads; missiles handled separately.
// reason: 'wire'|'reloading'|'empty'|'missile'|'damaged'|'ok'
function reserveSpecificTube(idx){
  const tubes=player.torpTubes;
  const tubeLoad=player.tubeLoad||[];
  const avail=_DMG.getEffects().tubesAvail??tubes.length;
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

// Resolve firing tube -- selected tube first, fall back to reserveTube()
function resolveTube(){
  const sel=ui.wirePanel?.selectedTube??-1;
  if(sel>=0){
    const r=reserveSpecificTube(sel);
    if(r.reason==='missile'){ _COMMS.weapons.error('Missile load \u2014 use ASCM panel'); return -1; }
    if(r.reason==='wire'){    _COMMS.weapons.error('Wire live on selected tube'); return -1; }
    if(r.reason==='empty'){   _COMMS.weapons.error('Selected tube empty'); return -1; }
    if(r.reason==='damaged'){ _COMMS.weapons.error('Tube damaged / unavailable'); return -1; }
    if(r.reason==='reloading'){ _COMMS.weapons.error('Selected tube reloading'); return -1; }
    if(r.idx>=0) return r.idx;
  }
  // Fallback -- scan for first ready torpedo tube
  return reserveTube();
}

// ── Tube load management ────────────────────────────────────────────────

// Load a weapon into an empty tube. Deducts stock immediately on order.
function _orderLoad(tubeIdx,weaponKey){
  if(player.tubeOp){ _COMMS.weapons.torpRoomBusy(); return; }
  const tubes=player.torpTubes;
  const t=tubeIdx;
  if(!tubes||t<0||t>=tubes.length){ _COMMS.weapons.error('Invalid tube'); return; }
  if(tubes[t]===-1){ _COMMS.weapons.error('Wire live \u2014 cut first'); return; }
  if(tubes[t]>0){ _COMMS.weapons.error('Tube loading'); return; }
  if(player.tubeLoad?.[t]!=null){ _COMMS.weapons.error('Tube already loaded'); return; }
  const isMissile=weaponKey&&weaponKey!=='torp';
  if(isMissile){
    const misTypes=C.player.missileTypes||[];
    if(!misTypes.includes(weaponKey)){ _COMMS.weapons.error('Weapon not aboard'); return; }
    if((player.missileStock||0)<=0){ _COMMS.weapons.error('No missiles in stock'); return; }
    player.missileStock--;
  } else {
    if((player.torpStock||0)<=0){ _COMMS.weapons.error('No torpedoes in stock'); return; }
    player.torpStock--;
  }
  const reloadTime=C.player.torpReloadTime||28;
  const totalT=reloadTime*(isMissile?(C.weapons?.[weaponKey]?.reloadMult??1.5):1.0);
  const wl=isMissile?(C.weapons?.[weaponKey]?.shortLabel||weaponKey.toUpperCase()):'TORPEDO';
  player.tubeOp={type:'load',tubeIdx:t,weaponKey:weaponKey||'torp',progress:0,totalT};
  player.torpTubes[t]=totalT;
  _COMMS.weapons.loadOrder(t+1,wl);
}

// Unload a tube and return the weapon to stock.
function _orderUnload(tubeIdx){
  if(player.tubeOp){ _COMMS.weapons.torpRoomBusy(); return; }
  const tubes=player.torpTubes;
  const t=tubeIdx;
  if(!tubes||t<0||t>=tubes.length){ _COMMS.weapons.error('Invalid tube'); return; }
  if(tubes[t]===-1){ _COMMS.weapons.error('Wire live \u2014 cut first'); return; }
  if(tubes[t]>0){ _COMMS.weapons.error('Tube busy'); return; }
  if(player.tubeLoad?.[t]==null){ _COMMS.weapons.error('Tube already empty'); return; }
  const reloadTime=C.player.torpReloadTime||28;
  const totalT=reloadTime*0.65;
  player.tubeOp={type:'unload',tubeIdx:t,weaponKey:null,progress:0,totalT};
  player.torpTubes[t]=totalT;
  _COMMS.weapons.unloadOrder(t+1);
}

// Strike reload -- swap loaded weapon without emptying first (takes 2.15x reload time).
function _orderStrikeReload(tubeIdx,weaponKey){
  if(player.tubeOp){ _COMMS.weapons.torpRoomBusy(); return; }
  const tubes=player.torpTubes;
  const t=tubeIdx;
  if(!tubes||t<0||t>=tubes.length){ _COMMS.weapons.error('Invalid tube'); return; }
  if(tubes[t]===-1){ _COMMS.weapons.error('Wire live \u2014 cut first'); return; }
  if(tubes[t]>0){ _COMMS.weapons.error('Tube busy'); return; }
  const isMissile=weaponKey&&weaponKey!=='torp';
  if(isMissile){
    const misTypes=C.player.missileTypes||[];
    if(!misTypes.includes(weaponKey)){ _COMMS.weapons.error('Weapon not aboard'); return; }
    if((player.missileStock||0)<=0){ _COMMS.weapons.error('No missiles in stock'); return; }
    player.missileStock--;
  } else {
    if((player.torpStock||0)<=0){ _COMMS.weapons.error('No torpedoes in stock'); return; }
    player.torpStock--;
  }
  const reloadTime=C.player.torpReloadTime||28;
  const totalT=reloadTime*2.15;
  const wl=isMissile?(C.weapons?.[weaponKey]?.shortLabel||weaponKey.toUpperCase()):'TORPEDO';
  player.tubeOp={type:'strike',tubeIdx:t,weaponKey:weaponKey||'torp',progress:0,totalT};
  player.torpTubes[t]=totalT;
  _COMMS.weapons.strikeReloadOrder(t+1,wl);
}

// ── Missile / VLS firing ────────────────────────────────────────────────

// Fire missile from ASCM panel -- uses full FPP sequence
function _fireMissile(){
  if(!session.ascmSolution){ _COMMS.weapons.noSolution(); return; }
  if((player.pendingFires||[]).length>0){ _COMMS.weapons.unableFiring(); return; }
  // Find first ready missile-loaded tube
  const tubeLoad=player.tubeLoad||[];
  let tubeIdx=-1;
  for(let i=0;i<tubeLoad.length;i++){
    if(player.torpTubes[i]===0 && tubeLoad[i] && tubeLoad[i]!=='torp'){ tubeIdx=i; break; }
  }
  if(tubeIdx<0){ _COMMS.weapons.error('No missile ready in tube'); return; }
  const missileType=tubeLoad[tubeIdx];
  const cfg=C.weapons?.[missileType];
  if(!cfg){ _COMMS.weapons.error('Unknown missile type'); return; }
  const wl=cfg.shortLabel||missileType.toUpperCase();
  const cid=session.ascmSolution.contactId||'';
  const maxD=cfg.maxLaunchDepth??25;
  const overDepth=Math.max(0,player.depth-maxD);
  const launchChance=overDepth===0?1.0:clamp(1-overDepth/(maxD*2),0,1);
  if(overDepth>0) _COMMS.weapons.missileDepthWarning(wl,player.depth,maxD);
  if(Math.random()>launchChance){
    // Capsule ejected but failed to surface -- weapon lost, tube clear, reload starts
    player.tubeLoad[tubeIdx]=null;
    player.torpTubes[tubeIdx]=Math.round((C.player.torpReloadTime||28)*(_DMG.getEffects().reloadMult||1));
    _COMMS.weapons.missileLaunchFail(wl);
    return;
  }
  _COMMS.weapons.firingProcedures(tubeIdx+1,wl,cid,false);
  player.pendingFires.push({
    t:C.player.fireDelay||4.5,
    tubeIdx, isMissile:true, missileType,
    ascmBearing:session.ascmSolution.bearing,
    ascmRange:session.ascmSolution.range,
    ascmRef:session.ascmSolution.ref,
    weaponLabel:wl, contactId:cid,
    ddx:0, ddy:0, wire:false, launchOffset:0,
  });
}

// VLS -- fire a ready cell directly (no tube cycle, no pendingFires)
function _fireVLS(cellIdx){
  const cells=player.vlsCells||[];
  if(cellIdx<0||cellIdx>=cells.length) return;
  const cell=cells[cellIdx];
  if(!cell||cell.state!=='ready'){ _COMMS.weapons.error('VLS cell not ready'); return; }
  if(!session.ascmSolution){ _COMMS.weapons.noSolution(); return; }
  const wType=C.player.vlsWeapon;
  if(!wType){ _COMMS.weapons.error('No weapon assigned to VLS'); return; }
  const cfg=C.weapons?.[wType];
  if(!cfg){ _COMMS.weapons.error('Unknown VLS weapon type'); return; }
  const wl=cfg.shortLabel||wType.toUpperCase();
  const cid=session.ascmSolution.contactId||'';
  const maxD=cfg.maxLaunchDepth??30;
  const overDepth=Math.max(0,player.depth-maxD);
  if(overDepth>0) _COMMS.weapons.missileDepthWarning(wl,player.depth,maxD);
  // Queue the launch — countdown before missile away
  const launchDelay=cfg.vlsLaunchDelay??4.0;
  cell.state='launching';
  cell._launchT=launchDelay;
  cell._wType=wType;
  cell._solution={bearing:session.ascmSolution.bearing, range:session.ascmSolution.range, ref:session.ascmSolution.ref};
  cell._overDepth=overDepth;
  cell._maxD=maxD;
  cell._cid=cid;
  _COMMS.weapons.vlsLaunchSequence?.(cellIdx+1,wl,cid);
  player.noiseTransient=Math.min(1,(player.noiseTransient||0)+0.25);
}

// Tick VLS launch countdowns — called from tickPendingFires
function _tickVLS(dt){
  const cells=player.vlsCells||[];
  for(let i=0;i<cells.length;i++){
    const cell=cells[i];
    if(!cell||cell.state!=='launching') continue;
    cell._launchT-=dt;
    if(cell._launchT>0) continue;
    // Launch
    const cfg=C.weapons?.[cell._wType];
    const wl=cfg?.shortLabel||cell._wType?.toUpperCase()||'MSL';
    const launchChance=cell._overDepth===0?1.0:clamp(1-cell._overDepth/(cell._maxD*2),0,1);
    if(Math.random()>launchChance){
      _COMMS.weapons.vlsLaunchFail(wl,i+1);
      cell.state='expended';
      continue;
    }
    cell.state='expended';
    const m=_MSL?.create(cell._wType,player.wx,player.wy,cell._solution);
    if(m) missiles.push(m);
    _COMMS.weapons.vlsFired(i+1,wl,cell._cid||'');
    player.noiseTransient=Math.min(1,(player.noiseTransient||0)+0.40);
  }
}

// ── Stadimeter ──────────────────────────────────────────────────────────

function _stadimeterStart(){
  if(player.depth>C.player.periscopeDepth+4){ _COMMS.weapons.error('Not at periscope depth'); return; }
  const asc=session.ascmSolution;
  if(!asc||!asc.ref){ _COMMS.weapons.error('No surface contact designated'); return; }
  if(player.stadimeterT>0) return;
  player.stadimeterT=4.0;
  player.stadimeterTarget=asc.ref;
  _COMMS.weapons.stadimeterObserve(asc.contactId);
}

// ── Mast toggle ─────────────────────────────────────────────────────────

function _toggleMast(key){
  const cfgs=C.player.masts||[];
  const cfg=cfgs.find(c=>c.key===key);
  const m=(player.masts||[]).find(m=>m.key===key);
  if(!m||!cfg||m.state==='damaged') return;
  if(m.state==='down'||m.state==='lowering'){
    m.state='raising'; m.t=cfg.raiseDur;
  } else if(m.state==='up'||m.state==='raising'){
    m.state='lowering'; m.t=cfg.lowerDur;
  }
}

// ── Tick: tube operations ───────────────────────────────────────────────

export function tickTubeOps(dt){
  player.torpCd=Math.max(0,player.torpCd-dt);
  // Tick tube reload timers (skip wire-occupied tubes: value -1, skip hot-run locked: -2)
  for(let i=0;i<(player.torpTubes||[]).length;i++){
    if(player.torpTubes[i]>0){
      const prev=player.torpTubes[i];
      player.torpTubes[i]=Math.max(0,player.torpTubes[i]-dt);
      // Hot run check on reload completion
      if(prev>0 && player.torpTubes[i]===0 && player.damage?.hotRunCountdown==null){
        const hrCfg=C.player.casualties?.hotRun||{};
        const stowState=player.damage?.systems?.weapon_stow||'nominal';
        const stowDmg=['degraded','offline','destroyed'].indexOf(stowState)>=0;
        const chance=stowDmg?(hrCfg.reloadChanceDegraded||0.02):(hrCfg.reloadChanceBase||0.0005);
        if(Math.random()<chance){
          player.damage.hotRunCountdown=hrCfg.countdown||12;
          player.damage.hotRunTube=i;
          player.torpTubes[i]=-2; // locked
          _COMMS?.hotRun?.detected(i+1);
        }
      }
    }
  }

  // Tick torpedo room operation (load/unload/strike -- one at a time)
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
        _COMMS.weapons.loadComplete(t+1,wl);
      } else if(op.type==='unload'){
        player.torpTubes[t]=0;
        const wasLoad=player.tubeLoad[t]||'torp';
        // Return weapon to appropriate stock
        if(wasLoad!=='torp') player.missileStock=(player.missileStock||0)+1;
        else player.torpStock=(player.torpStock||0)+1;
        player.tubeLoad[t]=null;
        _COMMS.weapons.unloadComplete(t+1);
      } else if(op.type==='strike'){
        // Return old weapon, load new
        const oldLoad=player.tubeLoad[t]||'torp';
        if(oldLoad!=='torp') player.missileStock=(player.missileStock||0)+1;
        else player.torpStock=(player.torpStock||0)+1;
        player.torpTubes[t]=0;
        player.tubeLoad[t]=op.weaponKey;
        _COMMS.weapons.strikeReloadComplete(t+1,wl);
      }
    }
  }

  // Expose for external callers (e.g. weapons panel)
  _SIM._reserveTube=reserveTube;
  _SIM._reserveSpecificTube=reserveSpecificTube;

  // Attach tube load management methods
  _SIM._orderLoad=_orderLoad;
  _SIM._orderUnload=_orderUnload;
  _SIM._orderStrikeReload=_orderStrikeReload;
  _SIM._fireMissile=_fireMissile;
  _SIM._fireVLS=_fireVLS;
  _SIM._stadimeterStart=_stadimeterStart;
  _SIM._toggleMast=_toggleMast;
}

// ── Tick: pending fire queue (FPP) ──────────────────────────────────────

export function tickPendingFires(dt){
  // Tick pending fire queue -- full firing point procedure
  // Timeline (t counts DOWN from fireDelay=4.5s to 0):
  //   t=4.5  CONN: "firing point procedures, tube N, [weapon], [contact]"  (at push)
  //   t<4.0  WEPS: "[weapon], [contact] -- aye. Prepare tube N"
  //   t<3.2  WEPS: "Tube N, flooding down"
  //   t<2.5  WEPS: "Conn, Weps -- tube N ready in all respects, outer door open"
  //   t<2.0  WEPS: "Conn, Weps -- tube N, solution set"
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
      _COMMS.weapons.fppAck(tn, wl, cid);
    }
    if(!pf._log2 && pf.t < FD-1.3){
      pf._log2=true;
      _COMMS.weapons.floodingDown(tn);
    }
    if(!pf._log3 && pf.t < FD-2.0){
      pf._log3=true;
      _COMMS.weapons.tubeReady(tn);
    }
    if(!pf._log4 && pf.t < FD-2.5){
      pf._log4=true;
      _COMMS.weapons.solutionSet(tn);
    }
    if(!pf._log5 && pf.t < FD-3.1){
      pf._log5=true;
      _COMMS.weapons.shipReady();
    }
    if(!pf._log6 && pf.t < FD-3.7){
      pf._log6=true;
      _COMMS.weapons.weaponReady();
    }
    if(!pf._log7 && pf.t < FD-4.3){
      pf._log7=true;
      _COMMS.weapons.fireOrder(tn, wl, cid, pf.manual);
    }

    // Launch
    if(pf.t<=0){
      pf.done=true;
      const sx=player.wx+Math.cos(player.heading)*C.player.r*1.35;
      const sy=player.wy+Math.sin(player.heading)*C.player.r*1.35;
      player.noiseTransient=Math.min(1,player.noiseTransient+0.18);
      // TDC error -- damaged fire control / TDC adds bearing offset
      const tdcErr=_DMG.getEffects().tdcErrDeg||0;
      let {ddx,ddy}=pf;
      if(tdcErr>0){
        const errRad=(Math.random()*2-1)*tdcErr*Math.PI/180;
        const cos=Math.cos(errRad),sin=Math.sin(errRad);
        ddx=pf.ddx*cos-pf.ddy*sin;
        ddy=pf.ddx*sin+pf.ddy*cos;
      }
      if(pf.isMissile){
        // Missile launch -- create flight object, empty the tube (no auto-reload)
        const m=_MSL?.create(pf.missileType, player.wx, player.wy, {bearing:pf.ascmBearing, range:pf.ascmRange, ref:pf.ascmRef});
        if(m){ missiles.push(m); }
        player.tubeLoad[pf.tubeIdx]=null;
        player.torpTubes[pf.tubeIdx]=0;
        _COMMS.weapons.missileAway();
      } else if(pf.wire){
        const wireSnapped=_W.fireTorpedo(sx,sy,ddx,ddy,true,C.player.torpEnableDist,true,pf.launchOffset,player.depth,pf.fireDepth,C.weapons?.[C.player.torpWeapon]??null);
        const torp=bullets[bullets.length-1];
        if(!wireSnapped && torp?.wire?.live){
          if(!player.tubeWires) player.tubeWires=new Array(C.player.torpTubes||4).fill(null);
          player.tubeWires[pf.tubeIdx]=torp;
          torp.wire.autoTDC=true;
          torp.wire.lockedTarget=pf.lockedTarget??null;
          torp.wire.tubeIdx=pf.tubeIdx;
        } else {
          player.torpTubes[pf.tubeIdx]=Math.round((C.player.torpReloadTime||28)*(_DMG.getEffects().reloadMult||1));
        }
        _COMMS.weapons.fired(tn, !wireSnapped);
        if(wireSnapped) _COMMS.weapons.wireParted(tn, 'launch');
      } else {
        _W.fireTorpedo(sx,sy,ddx,ddy,true,C.player.torpEnableDist,false,0,player.depth,pf.fireDepth,C.weapons?.[C.player.torpWeapon]??null);
        player.torpTubes[pf.tubeIdx]=Math.round((C.player.torpReloadTime||28)*(_DMG.getEffects().reloadMult||1));
        _COMMS.weapons.fired(tn, false);
      }
      if(!pf.isMissile) _COMMS.weapons.away();
    }
  }
  player.pendingFires=player.pendingFires.filter(pf=>!pf.done);

  // -- Pending log queue -- staged crew comms --------------------------------
  if(!player.pendingLogs) player.pendingLogs=[];
  for(const pl of player.pendingLogs){ pl.t-=dt; if(pl.t<=0){ pl.done=true; addLog(pl.station,pl.msg,pl.priority||0); } }
  player.pendingLogs=player.pendingLogs.filter(pl=>!pl.done);

  // -- VLS launch countdowns ---------------------------------------------------
  _tickVLS(dt);
}

// ── Tick: stadimeter ────────────────────────────────────────────────────

export function tickStadimeter(dt){
  if(player.stadimeterT>0){
    // Abort if depth rose past PD
    if(player.depth>C.player.periscopeDepth+4){
      player.stadimeterT=0; player.stadimeterTarget=null;
      _COMMS.weapons.stadimeterInterrupted();
    } else {
      player.stadimeterT-=dt;
      if(player.stadimeterT<=0){
        player.stadimeterT=0;
        const tgt=player.stadimeterTarget; player.stadimeterTarget=null;
        if(tgt&&!tgt.dead){
          const sc=sonarContacts?.get(tgt);
          if(sc){
            const dx=tgt.x-player.wx, dy=tgt.y-player.wy;
            const trueRange=Math.hypot(dx,dy);
            const classKnown=(sc._classStage||0)>=3;
            const errPct=classKnown?0.18:0.30;
            const estRange=trueRange*(1+rand(-errPct,errPct));
            sc._estRange=estRange;
            if(session.ascmSolution&&session.ascmSolution.ref===tgt){
              session.ascmSolution.range=estRange;
              session.ascmSolution.source='STADIMETER';
            }
            _COMMS.weapons.stadimeterComplete(classKnown);
          } else { _COMMS.weapons.stadimeterInterrupted(); }
        } else { _COMMS.weapons.stadimeterInterrupted(); }
      }
    }
  }
}

// ── Tick: firing inputs ─────────────────────────────────────────────────

export function tickFiringInputs(dt, cam){
  // Aim world coords: unproject mouse through camera (centred on plot area)
  const Z=cam.zoom;
  const canvas=_canvas;
  const DPR=canvas?.DPR||1;
  _I.aimWorldX=cam.x+(_I.mouseX-((canvas?.width||0)-C.layout.depthStripW*DPR)/2)/(Z*DPR);
  _I.aimWorldY=cam.y+(_I.mouseY-((canvas?.height||0)-C.layout.panelH*DPR)/2)/(Z*DPR);
  // Periscope (O) -- scope_atk must be raised, shallow only
  if(_I.justPressed('periscope') && player.periscopeCd<=0){
    const scopeMast=(player.masts||[]).find(m=>m.key==='scope_atk');
    if(_DMG.getEffects().periscopeOk===false||(scopeMast&&scopeMast.state==='damaged')){
      _COMMS.ui?.periscopeDamaged?.();
    } else if(scopeMast&&scopeMast.state!=='up'){
      _COMMS.ui.periscopeTooDeep(); // reuse message -- "scope not raised"
    } else if(player.depth>C.player.periscopeDepth+4){
      _COMMS.ui.periscopeTooDeep();
    } else {
      player.periscopeCd = C.player.periscope.cd;
      player.periscopeT  = C.player.periscope.dur;
      player.noiseTransient = Math.min(1, player.noiseTransient + C.player.periscope.noiseSpike);
      let shown = 0;
      for(const e of enemies){
        if(e.type!=="boat") continue;
        const dx = _AI.wrapDx(player.wx, e.x);
        const dy = e.y - player.wy;
        const d = Math.hypot(dx,dy);
        if(d <= C.player.periscope.revealR){
          _SENSE.setDetected(e, C.detection.detectT*1.4, C.detection.seenT*1.2);
          // Visual fix -- feeds sonarContacts so ASCM solution and stadimeter work.
          // Bearing is exact (optical); range has +/-20% noise (rough visual estimate --
          // the stadimeter procedure tightens this).
          const scopeBrg = Math.atan2(dy, dx); // math angle from player to ship
          const noisyD = d * (1 + (Math.random()*0.40 - 0.20));
          _SENSE.registerFix(e,
            player.wx + Math.cos(scopeBrg)*noisyD,
            player.wy + Math.sin(scopeBrg)*noisyD,
            40, 'periscope');
          shown++;
        }
      }
      _COMMS.ui.scopeReport(shown);
    }
  }

  _SENSE.proximityDetect();

  // Shift+LMB = MANUAL OVERRIDE -- fire on aimed bearing regardless of WEPS solution
  if(_I.torpAimClick){
    _I.torpAimClick=false;
    if((player.pendingFires||[]).length>0){
      _COMMS.weapons.unableFiring();
    } else {
    const tubeIdx=resolveTube();
    if(tubeIdx>=0){
      const _tdc=session.tdc||tdc;
      const aimDx=_I.aimWorldX-player.wx, aimDy=_I.aimWorldY-player.wy;
      const d=Math.max(1e-6,Math.hypot(aimDx,aimDy));
      const ddx=aimDx/d, ddy=aimDy/d;
      const launchOffset=Math.abs(angleNorm(Math.atan2(ddy,ddx)-player.heading));
      const fireDepth=_tdc.target ? (_tdc.depth!=null?_tdc.depth:player.depth) : player.depth;
      const wl=tubeWeaponLabel(tubeIdx);
      const cid=_tdc.targetId||'';
      _COMMS.weapons.firingProcedures(tubeIdx+1, wl, cid, true);
      player.pendingFires.push({t:C.player.fireDelay, tubeIdx, ddx, ddy, launchOffset, fireDepth, wire:true, lockedTarget:_tdc.target, manual:true, weaponLabel:wl, contactId:cid});
    } else {
      if(player.torpStock<=0) _COMMS.weapons.error('No torpedoes remaining');
    }
    } // end pendingFires gate
  }

  // F = quick fire straight ahead, no wire
  if(_I.justPressed('fireTorpedo')){
    if((player.pendingFires||[]).length>0){
      _COMMS.weapons.unableFiring();
    } else {
    const tubeIdx=resolveTube();
    if(tubeIdx>=0){
      const _tdc=session.tdc||tdc;
      let ddx,ddy,fireDepth;
      if(_tdc.target && _tdc.intercept!=null){
        ddx=Math.cos(_tdc.intercept); ddy=Math.sin(_tdc.intercept);
        fireDepth=_tdc.depth??player.depth;
      } else {
        ddx=Math.cos(player.heading); ddy=Math.sin(player.heading);
        fireDepth=player.depth;
      }
      const wlF=tubeWeaponLabel(tubeIdx);
      const cidF=_tdc.targetId||'';
      _COMMS.weapons.firingProcedures(tubeIdx+1, wlF, cidF, false);
      player.pendingFires.push({t:C.player.fireDelay, tubeIdx, ddx, ddy, launchOffset:0, fireDepth, wire:false, weaponLabel:wlF, contactId:cidF});
    } else {
      if(player.torpStock<=0) _COMMS.weapons.error('No torpedoes remaining');
    }
    } // end pendingFires gate
  }

  // X = deploy noisemaker
  if(_I.justPressed('countermeasure')&&player.cmCd<=0){
    if((player.cmStock??1)>0){
      player.cmStock--;
      player.cmCd=C.player.cmCd;
      _W.deployDecoy(player.wx,player.wy,true,"noisemaker",{depth:player.depth});
      player.noiseTransient=Math.min(1,player.noiseTransient+0.10);
      _COMMS.weapons.countermeasures();
    } else {
      _COMMS.weapons.error('No countermeasures remaining');
    }
  }
}

// ── Tick: wire guidance speed stress ────────────────────────────────────

export function tickWireGuidance(dt, _onWireCut){
  const safeKts   = C.player.wireSafeKts        ?? 15;
  const stressKts = C.player.wireStressKts       ?? 20;
  const breakTime = C.player.wireStressBreakTime ?? 25;
  const instantKts= C.player.wireInstantBreakKts ?? 22;
  const playerKts = player.speed ?? 0;
  for(const b of bullets){
    if(b.kind!=='torpedo'||!b.wire||!b.wire.live) continue;
    _W.wireUpdate(b, dt);
    // Speed stress -- accumulate on wire, part when full
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
        _onWireCut(b);
        _COMMS.weapons.wireParted(null, 'speed');
      }
    } else {
      // Recover stress slowly at safe speeds
      if(b.wire._stressAcc) b.wire._stressAcc = Math.max(0, b.wire._stressAcc - dt * 0.02);
    }
  }
}
