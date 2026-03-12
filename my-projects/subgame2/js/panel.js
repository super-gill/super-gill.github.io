(() => {
  'use strict';
  const W = ()=>window.W; // lazy ref — weapons.js loads before panel.js calls it

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

  let _telegraphIdx=5; // default ALL STOP

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

  // ── Actions (resolve G lazily so panel.js loads safely before state.js runs) ──
  function setTelegraph(idx){
    _telegraphIdx=idx;
    const s=SPEED_STATES[idx];
    const p=window.G?.player;
    if(p){ p.speedOrderKts=s.kts; p.speedDir=s.dir; }
    COMMS.panel.speedOrder(s.label, s.connOrder, s.engAck);
  }

  function depthStep(delta){
    const p=window.G?.player;
    const ground=window.G?.world?.ground??1900;
    if(!p) return;
    p.depthOrder=Math.max(20,Math.min(ground-60,(p.depthOrder??p.depth)+delta));
    // Debounce log — cancel pending, fire 1s after last press
    // Cancel emergency blow if player issues a new depth order
    if(p._blowVenting){
      p._blowVenting = false;
      p._blowVy = 0;
      window.COMMS?.trim?.blowCancelledByOrder(Math.round(p.depth));
    }
    clearTimeout(p._depthLogTimer);
    p._depthLogTimer=setTimeout(()=>{
      const ordStr=`${Math.round(p.depthOrder)}m`;
      COMMS.nav.depthOrder(ordStr, delta>0?'down':'up');
    },1000);
  }

  function comeToPD(){
    const p=window.G?.player;
    if(!p) return;
    p.depthOrder=window.CONFIG?.player?.periscopeDepth??140;
    COMMS.nav.comeToPD();
  }

  function toggleSilent(){
    const p=window.G?.player;
    if(!p) return;
    p.silent=!p.silent;
    COMMS.nav.silentRunning(p.silent);
  }

  function emergencyTurn(){
    const p=window.G?.player;
    const C=window.CONFIG;
  const COMMS=window.COMMS;
    const I=window.I;
    if(!p||!C||!I) return;
    if((p.emergTurnCd||0)>0){ COMMS.ui.emergencyTurnCooldown(); return; }
    if((p.emergTurnT||0)>0) return;
    // Towed array stress
    const ta=p.towedArray;
    if(ta){
      if(ta.state==='operational'){ ta.state='damaged'; COMMS.nav.towedArrayStress('manoeuvre','damaged'); }
      else if(ta.state==='damaged'){ ta.state='destroyed'; COMMS.nav.towedArrayStress('manoeuvre','destroyed'); }
    }
    // Clear waypoints
    const route=window.G?.route; if(route) route.length=0;
    p.emergTurnT=C.player.emergencyTurn.dur;
    p.emergTurnCd=C.player.emergencyTurn.cd;
    p.noiseTransient=Math.min(1,(p.noiseTransient||0)+C.player.emergencyTurn.noiseSpike);
    // Check SCRAM risk — combo with crash dive
    const emergRecent=(p.crashDiveCd||0) > (C.player.crashDive?.cd||12)*0.7;
    if(emergRecent && p.speed>20 && Math.random()<0.45){
      if(typeof window.G.triggerScram==='function') window.G.triggerScram('combo');
      COMMS.reactor.scram('turn');
      return;
    }
    COMMS.nav.emergencyTurn();
    _partAllWires('turn');
  }

  function emergencyCrashDive(){
    const p=window.G?.player;
    const C=window.CONFIG;
  const COMMS=window.COMMS;
    const ground=window.G?.world?.ground??1900;
    if(!p||!C) return;
    if(p.crashDiveCd>0) return;
    p.crashDiveT=C.player.crashDive.dur;
    p.crashDiveCd=C.player.crashDive.cd;
    p.noiseTransient=Math.min(1,(p.noiseTransient||0)+C.player.crashDive.noiseSpike);
    p.depthOrder=Math.min(ground-60,(p.depthOrder??p.depth)+420);
    COMMS.nav.crashDive();
    _partAllWires('dive');
  }

  function emergencyBlowBallast(){
    const p=window.G?.player;
    const C=window.CONFIG;
    const COMMS=window.COMMS;
    if(!p||!C) return;
    const hpa=p.damage?.hpa;
    const hpaC=C.player.hpa||{};
    const ambient=(p.depth||0)*(hpaC.ambientPerMetre||0.1);

    // Can we overcome ambient at all?
    const totalAvail=(hpa?.pressure||0)+(hpa?.reserve||0);
    if(totalAvail <= ambient){
      COMMS.trim.blowFailNoHPA();
      return;
    }

    // Commit reserve if group pressure alone is below ambient
    if(hpa && hpa.pressure < ambient && hpa.reserve > 0){
      hpa._reserveCommitted = true;
      COMMS.trim.reserveHPACommitted();
    }

    // Open the blow valves — physics takes over from here in nav.js
    p._blowVenting = true;
    p.depthOrder = 20;
    p.noiseTransient = Math.min(1,(p.noiseTransient||0)+0.30);
    COMMS.trim.blowOpened(Math.round(ambient), Math.round(totalAvail));
  }

  function toggleHPARecharge(){
    const d=window.G?.player?.damage;
    if(!d?.hpa) return;
    d.hpa.recharging=!d.hpa.recharging;
    window.COMMS?.trim?.rechargeToggle?.(d.hpa.recharging);
  }

  function allStop(){ setTelegraph(5); }
  function snapToAllStop(){ setTelegraph(5); }

  function wepsShoot(){
    const game=window.G?.game;
    const player=window.G?.player;
    const C=window.CONFIG;
  const COMMS=window.COMMS;
    if(!game||!player||!C) return;
    const wp=game.wepsProposal;
    if(!wp){ COMMS.weapons.noSolution(); return; }
    if((player.pendingFires||[]).length>0){
      COMMS.weapons.unableFiring();
      return;
    }
    // Use reserveTube from sim context — call into sim module
    if(typeof window._reserveTube!=='function'){ COMMS.weapons.fireControlOffline(); return; }
    const tubeIdx=window._reserveTube();
    if(tubeIdx<0){
      const why=player.torpStock<=0?'No weapons remaining':'All tubes reloading';
      COMMS.weapons.error(why); return;
    }
    const ddx=Math.cos(wp.bearing), ddy=Math.sin(wp.bearing);
    const launchOffset=Math.abs((function(){
      const a=wp.bearing-player.heading;
      return ((a+Math.PI)%(2*Math.PI))-Math.PI;
    })());
    const trackStr=game.tdc.targetId?`, track ${game.tdc.targetId}`:'';
    // Launch speed cap — cannot fire wire-guided shot above wireMaxLaunchKts
    const launchSpeedKts = player.speed ?? 0;
    const launchCap = C.player.wireMaxLaunchKts ?? 15;
    if(launchSpeedKts > launchCap){
      COMMS.weapons.error(`Too fast to fire. Reduce to below ${launchCap}kt.`);
      // Return tube
      player.torpTubes[tubeIdx] = 0;
      player.torpStock = (player.torpStock||0) + 1;
      return;
    }
    // Auto action stations on first weapons fire
    if(window.G.setTacticalState('action')){
      COMMS.crewState.actionStations('attack');
    }
    COMMS.weapons.firingProcedures(false, trackStr, tubeIdx+1);
    if(!player.pendingFires) player.pendingFires=[];
    player.pendingFires.push({t:C.player.fireDelay, tubeIdx, ddx, ddy, launchOffset, fireDepth:wp.depth, wire:true, lockedTarget:game.tdc.target});
    // HPA cost for tube impulse air
    window.DMG?.drawHPA?.( (C.player.hpa?.torpedoCost||2), false );
  }

  function _partAllWires(cause){
    const p = window.G?.player;
    const bullets = window.G?.bullets;
    if(!p||!bullets) return;
    const tubeWires = p.tubeWires||[];
    let parted = false;
    for(const b of bullets){
      if(b.kind==='torpedo' && b.wire?.live){
        b.wire.live = false;
        window.G._onWireCut?.(b);
        parted = true;
      }
    }
    if(parted){
      if(cause==='turn') COMMS.weapons.wireParted(null, 'turn');
      else               COMMS.weapons.wireParted(null, 'dive');
    }
  }

  function callActionStations(){
    const game=window.G?.game;
    if(!game) return;
    if(game.tacticalState==='action'){
      // Stand down — CO's decision only
      if(window.G.setTacticalState('cruising')){
        COMMS.crewState.standDown('action');
      }
    } else {
      if(window.G.setTacticalState('action')){
        COMMS.crewState.actionStations('manual');
      }
    }
  }

  function toggleTowedArray(){
    const p=window.G?.player;
    if(!p) return;
    const ta=p.towedArray;
    if(!ta) return;
    if(ta.state==='destroyed'){
      COMMS.sensors.arrayCannotDeploy(); return;
    }
    if(ta.state==='stowed'||ta.state==='retracting'){
      // Check speed before deploying
      if(p.speed>12){
        COMMS.sensors.arrayDeploySpeedLimit(p.speed);
        return;
      }
      ta.state='deploying';
      ta.progress=ta.progress||0;
      ta._halfwayLogged=false;
      COMMS.sensors.arrayDeploy();
    } else if(ta.state==='deploying'||ta.state==='operational'||ta.state==='damaged'){
      ta.state='retracting';
      COMMS.sensors.arrayRetract();
    }
  }

  // btn2 — standalone button for overlays outside the main panel coordinate system
  // Draws directly to ctx and registers a click handler
  function btn2(ctx,label,x,y,w,h,col,action){
    const DPR=window.G?.DPR||1;
    ctx.fillStyle=col||'rgba(30,58,95,0.55)';
    ctx.beginPath(); ctx.roundRect(x,y,w,h,2*DPR); ctx.fill();
    if(label){
      ctx.fillStyle='rgba(200,220,255,0.90)';
      // Font size scales with button height, min 9px
      const fs=Math.max(9,Math.round(h/DPR*0.50))*DPR;
      ctx.font=`bold ${fs}px ui-monospace,monospace`;
      ctx.textAlign='center';
      ctx.fillText(label,x+w/2,y+h*0.72);
    }
    registerBtn(x,y,w,h,action);
  }

  // Wire panel state
  function getWireTube(idx){
    const player=window.G?.player;
    if(!player?.tubeWires) return null;
    return player.tubeWires[idx]||null;
  }
  function selectWireTube(idx){ const g=window.G?.game; if(g) g.wirePanel={...g.wirePanel,selectedTube:idx}; }
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
    if(t) W()?.cutWire(t);
  }
  // Expose for render.js
  window._wirePanel={selectWireTube,wireAutoTDC,wireNudge,wireCut,getWireTube};

  window.PANEL={
    SPEED_STATES,
    getTelegraph,
    clearBtns, registerBtn, handleClick,
    setTelegraph, depthStep, comeToPD,
    toggleSilent, emergencyTurn, emergencyCrashDive, emergencyBlowBallast, toggleHPARecharge, allStop, snapToAllStop, toggleTowedArray, wepsShoot, callActionStations,
    btn2,
    initiateEscape(type){ window.DMG?.initiateEscape(type); },
    get telegraphIdx(){ return _telegraphIdx; },
  };
})();