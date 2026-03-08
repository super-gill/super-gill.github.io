(() => {
  'use strict';
  const W = ()=>window.W; // lazy ref — weapons.js loads before panel.js calls it

  const SPEED_STATES=[
    {label:'AHEAD FLANK',    kts:28,  dir:1},
    {label:'AHEAD FULL',     kts:20,  dir:1},
    {label:'AHEAD STD',      kts:14,  dir:1},
    {label:'AHEAD SLOW',     kts:7,   dir:1},
    {label:'AHEAD CREEP',    kts:3,   dir:1},
    {label:'ALL STOP',       kts:0,   dir:0},
    {label:'BACK SLOW',      kts:5,   dir:-1},
    {label:'BACK FULL',      kts:10,  dir:-1},
    {label:'BACK EMERGENCY', kts:18,  dir:-1},
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
    window.G?.addLog('CONN', s.label);
  }

  function depthStep(delta){
    const p=window.G?.player;
    const ground=window.G?.world?.ground??1900;
    const step=window.CONFIG?.player?.depthStep??60;
    if(!p) return;
    p.depthOrder=Math.max(20,Math.min(ground-60,(p.depthOrder??p.depth)+delta*step));
    const ordStr=`${Math.round(p.depthOrder)}m`;
    window.G.setMsg(`ORDERED ${ordStr}`,0.8);
    window.G.addLog('CONN', delta>0 ? `Dive to ${ordStr}` : `Come up to ${ordStr}`);
  }

  function comeToPD(){
    const p=window.G?.player;
    if(!p) return;
    p.depthOrder=window.CONFIG?.player?.periscopeDepth??140;
    window.G.setMsg('COME TO PD',1.0);
    window.G.addLog('CONN','Come to periscope depth');
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
    window.G.addLog('CONN','Emergency blow!');
    window.G.addLog('ENG','Emergency blow — main ballast tanks venting');
  }

  function allStop(){ setTelegraph(5); }

  function wepsShoot(){
    const game=window.G?.game;
    const player=window.G?.player;
    const C=window.CONFIG;
    if(!game||!player||!C) return;
    const wp=game.wepsProposal;
    if(!wp){window.G.addLog('WEPS','No solution — designate a contact first'); return;}
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
    const confLabel=wp.confidence==='solid'?'SOLID solution':wp.confidence==='degraded'?'DEGRADED solution':'BEARING ONLY — no range';
    const tdcStr=game.tdc.targetId?` on ${game.tdc.targetId}`:'';
    window.G.addLog('CONN',`Shoot${tdcStr}`);
    window.G.addLog('WEPS',`Tube ${tubeIdx+1} — firing on ${confLabel}`);
    window.G.setMsg('FIRING…',0.6);
    if(!player.pendingFires) player.pendingFires=[];
    player.pendingFires.push({t:C.player.fireDelay, tubeIdx, ddx, ddy, launchOffset, fireDepth:wp.depth, wire:true});
  }

  function toggleTowedArray(){
    const p=window.G?.player;
    if(!p) return;
    const ta=p.towedArray;
    if(!ta) return;
    if(ta.state==='destroyed'){
      window.G.addLog('ENG','Array destroyed — cannot deploy'); return;
    }
    if(ta.state==='stowed'||ta.state==='retracting'){
      // Check speed before deploying
      if(p.speed>12){
        window.G.addLog('ENG',`Array deployment requires speed below 12kt (currently ${Math.round(p.speed)}kt)`);
        return;
      }
      ta.state='deploying';
      ta.progress=ta.progress||0;
      window.G.addLog('ENG','Towed array deploying — 30 seconds to operational');
    } else if(ta.state==='deploying'||ta.state==='operational'||ta.state==='damaged'){
      ta.state='retracting';
      window.G.addLog('ENG','Retracting towed array');
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