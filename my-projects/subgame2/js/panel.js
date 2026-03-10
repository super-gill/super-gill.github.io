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
    window.G?.setMsg(s.label,1.0);
    window.G?.addLog('CONN', s.connOrder);
    window.G?.queueLog('ENG', s.engAck, 1.2);
  }

  function depthStep(delta){
    const p=window.G?.player;
    const ground=window.G?.world?.ground??1900;
    const step=window.CONFIG?.player?.depthStep??60;
    if(!p) return;
    p.depthOrder=Math.max(20,Math.min(ground-60,(p.depthOrder??p.depth)+delta*step));
    const ordStr=`${Math.round(p.depthOrder)}m`;
    window.G.setMsg(`ORDERED ${ordStr}`,0.8);
    if(delta>0){
      window.G.addLog('CONN',`Helm, Conn — make your depth ${ordStr}`);
      window.G.queueLog('HELM',`Conn, Helm — aye, making my depth ${ordStr}`,1.0);
    } else {
      window.G.addLog('CONN',`Helm, Conn — come up to ${ordStr}`);
      window.G.queueLog('HELM',`Conn, Helm — aye, coming up to ${ordStr}`,1.0);
    }
  }

  function comeToPD(){
    const p=window.G?.player;
    if(!p) return;
    p.depthOrder=window.CONFIG?.player?.periscopeDepth??140;
    window.G.setMsg('COME TO PD',1.0);
    window.G.addLog('CONN','Helm, Conn — come to periscope depth');
    window.G.queueLog('HELM','Conn, Helm — aye, coming to periscope depth',1.0);
  }

  function toggleSilent(){
    const p=window.G?.player;
    if(!p) return;
    p.silent=!p.silent;
    window.G.setMsg(p.silent?'SILENT RUNNING':'NORMAL RUN',1.0);
    window.G.addLog('CONN', p.silent ? 'Rig for silent running' : 'Normal running');
    if(p.silent) window.G.addLog('ENG','All non-essential machinery secured');
  }

  function emergencyCrashDive(){
    const p=window.G?.player;
    const C=window.CONFIG;
    const ground=window.G?.world?.ground??1900;
    if(!p||!C) return;
    if(p.crashDiveCd>0) return;
    p.crashDiveT=C.player.crashDive.dur;
    p.crashDiveCd=C.player.crashDive.cd;
    p.noiseTransient=Math.min(1,(p.noiseTransient||0)+C.player.crashDive.noiseSpike);
    p.depthOrder=Math.min(ground-60,(p.depthOrder??p.depth)+420);
    window.G.setMsg('CRASH DIVE!',1.2);
    window.G.addLog('CONN','Crash dive!');
    window.G.addLog('ENG','Flood all ballast tanks — max down angle');
  }

  function emergencyBlowBallast(){
    const p=window.G?.player;
    const C=window.CONFIG;
    if(!p||!C) return;
    p.depthOrder=20;
    p.vy=-(C.player.depthRateMax??170)*1.6;
    p.noiseTransient=Math.min(1,(p.noiseTransient||0)+0.25);
    window.G.setMsg('EMERGENCY BLOW!',1.2);
    window.G.addLog('CONN','Blow all main ballast. Emergency surface');
    window.G.queueLog('ENG','Conn, Eng — emergency blow, main ballast tanks venting',0.5);
    window.G.queueLog('ENG','Conn, Eng — blow complete, rising fast',2.5);
  }

  function allStop(){ setTelegraph(5); }

  function wepsShoot(){
    const game=window.G?.game;
    const player=window.G?.player;
    const C=window.CONFIG;
    if(!game||!player||!C) return;
    const wp=game.wepsProposal;
    if(!wp){window.G.addLog('WEPS','No solution — designate a contact first'); return;}
    if((player.pendingFires||[]).length>0){
      window.G.setMsg('FIRING IN PROGRESS',0.8);
      window.G.addLog('WEPS','Conn, Weps — unable, firing sequence in progress');
      return;
    }
    // Use reserveTube from sim context — call into sim module
    if(typeof window._reserveTube!=='function'){window.G.addLog('WEPS','Fire control offline'); return;}
    const tubeIdx=window._reserveTube();
    if(tubeIdx<0){
      const why=player.torpStock<=0?'No weapons remaining':'All tubes reloading';
      window.G.setMsg(why.toUpperCase(),0.8); window.G.addLog('WEPS',why); return;
    }
    const ddx=Math.cos(wp.bearing), ddy=Math.sin(wp.bearing);
    const launchOffset=Math.abs((function(){
      const a=wp.bearing-player.heading;
      return ((a+Math.PI)%(2*Math.PI))-Math.PI;
    })());
    const trackStr=game.tdc.targetId?`, track ${game.tdc.targetId}`:'';
    window.G.addLog('CONN',`Weps, Conn — firing point procedures${trackStr}, tube ${tubeIdx+1}`);
    window.G.setMsg('FIRING…',0.6);
    if(!player.pendingFires) player.pendingFires=[];
    player.pendingFires.push({t:C.player.fireDelay, tubeIdx, ddx, ddy, launchOffset, fireDepth:wp.depth, wire:true, lockedTarget:game.tdc.target});
  }

  function toggleTowedArray(){
    const p=window.G?.player;
    if(!p) return;
    const ta=p.towedArray;
    if(!ta) return;
    if(ta.state==='destroyed'){
      window.G.addLog('ENG','Conn, Eng — array destroyed, cannot deploy'); return;
    }
    if(ta.state==='stowed'||ta.state==='retracting'){
      // Check speed before deploying
      if(p.speed>12){
        window.G.addLog('CONN','Eng, Conn — deploy towed array');
        window.G.queueLog('ENG',`Conn, Eng — unable. Speed ${Math.round(p.speed)}kt, array rated 12kt for deployment. Reduce speed and retry`,0.5);
        return;
      }
      ta.state='deploying';
      ta.progress=ta.progress||0;
      ta._halfwayLogged=false;
      window.G.addLog('CONN','Eng, Conn — deploy towed array');
      window.G.queueLog('ENG','Conn, Eng — aye, deploying array. Thirty seconds to operational',1.0);
    } else if(ta.state==='deploying'||ta.state==='operational'||ta.state==='damaged'){
      ta.state='retracting';
      window.G.addLog('CONN','Eng, Conn — retract towed array');
      window.G.queueLog('ENG','Conn, Eng — aye, hauling in. Twenty seconds',1.0);
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
      ctx.font=`bold ${7*DPR}px ui-monospace,monospace`;
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
    toggleSilent, emergencyCrashDive, emergencyBlowBallast, allStop, toggleTowedArray, wepsShoot,
    btn2,
    get telegraphIdx(){ return _telegraphIdx; },
  };
})();