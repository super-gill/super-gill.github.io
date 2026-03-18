(() => {
  'use strict';

  const input={
    keys:new Set(),
    mouseX:0, mouseY:0,
    mouseDownL:false, mouseDownR:false,
    aimWorldX:0, aimWorldY:0,
    _pendingRouteClick:false,
    routeRemoveLast:false,
    zoomDelta:0,
    shiftHeld:false,
    ctrlHeld:false,
    torpAimClick:false,
    _camDragActive:false,
    _camDragLastX:0, _camDragLastY:0,

    // Consume a one-shot action: returns true and removes the key if it was pressed.
    // Use in sim.js instead of I.keys.has(k) + I.keys.delete(k).
    // Looks up the key via window.KB so all bindings stay in keybindings.js.
    justPressed(action){
      const kb=window.KB?.[action]; if(!kb) return false;
      const k=kb.key;
      if(!this.keys.has(k)) return false;
      this.keys.delete(k);
      return true;
    },
  };

  addEventListener("keydown",(e)=>{
    const k=e.key.toLowerCase();
    // Key-repeat: update held-state flags but do NOT re-add to keys Set.
    // sim.js consumes one-shot keys via I.justPressed() — repeat events must not re-trigger them.
    if(!e.repeat) input.keys.add(k);
    if(e.key==="Shift") input.shiftHeld=true;
    if(e.key==="Control") input.ctrlHeld=true;
    // Discrete (inline) actions — guarded against key-repeat
    if(!e.repeat){
      const KB=window.KB;
      if(k===KB?.cameraCentre?.key){ const cam=window.G?.cam; const p=window.G?.player; if(cam&&p){cam.free=false;cam.x=p.wx;cam.y=p.wy;} }
      if(k===KB?.logTabToggle?.key&&window.G?.game){ window.G.game.logTab = window.G.game.logTab==='dc'?'log':'dc'; }
      if((k===KB?.uiScaleUp?.key||k===KB?.uiScaleUpAlt?.key)&&window.UI){ window.UI.setScale(window.UI.getScale()+window.UI.SCALE_STEP); }
      if(k===KB?.uiScaleDown?.key&&window.UI){ window.UI.setScale(window.UI.getScale()-window.UI.SCALE_STEP); }
      if(k===KB?.uiScaleReset?.key&&window.UI){ window.UI.setScale(1.0); }
      if(k===KB?.devPanel?.key){ const p=document.getElementById('dev-panel'); if(p) p.style.display=p.style.display==='none'?'block':'none'; }
    }
    if([" ","arrowup","arrowdown","arrowleft","arrowright"].includes(k)) e.preventDefault();
  });
  addEventListener("keyup",(e)=>{
    input.keys.delete(e.key.toLowerCase());
    if(e.key==="Shift") input.shiftHeld=false;
    if(e.key==="Control"){ input.ctrlHeld=false; input._camDragActive=false; }
  });

  // Resolve canvas lazily — state.js must have run first
  function getCanvas(){ return window.G?.canvas; }
  function getDPR(){ return window.G?.DPR||1; }

  function updateMouse(e){
    const canvas=getCanvas(); if(!canvas) return;
    const r=canvas.getBoundingClientRect();
    input.mouseX=(e.clientX-r.left)*getDPR();
    input.mouseY=(e.clientY-r.top)*getDPR();
  }

  function getU(){ return window.UI?.U || ((px)=>Math.round(px*getDPR())); }

  // Is the click inside the command panel strip at the bottom?
  function inPanel(my){
    const canvas=getCanvas(); if(!canvas) return false;
    const U=getU();
    return my >= canvas.height - U(window.CONFIG.layout.panelH);
  }

  // Is the click inside the depth strip on the right?
  function inDepthStrip(mx){
    const canvas=getCanvas(); if(!canvas) return false;
    const U=getU();
    return mx >= canvas.width - U(window.CONFIG.layout.depthStripW);
  }

  // Is the click inside the nav compass widget (top-right area)?
  function inCompass(mx, my){
    const canvas=getCanvas(); if(!canvas) return false;
    const U=getU();
    const stripW=U(window.CONFIG.layout.depthStripW);
    const radius=U(65);
    const cx=canvas.width-stripW-radius-U(50);
    const cy=U(72)+radius+U(10);
    // Check the full compass region including buttons and readouts
    const left=cx-radius-U(8)-U(38);           // port buttons left edge
    const right=cx+radius+U(8)+U(38);           // starboard buttons right edge
    const top=cy-radius-U(30)-U(20);            // depth up button top
    const bottom=cy+radius+U(8)+U(52)+U(4)+U(20); // depth down button bottom
    return mx>=left && mx<=right && my>=top && my<=bottom;
  }

  // Log panel sits above the bottom panel, bottom-left corner
  // Must absorb clicks so they don't fall through to chart waypoints
  function inLogPanel(mx, my){
    const canvas=getCanvas(); if(!canvas) return false;
    const U=getU();
    const panelH=U(window.CONFIG.layout.panelH);
    const boardW=U(560);
    // tabH=20, rowH=19, maxRows=28, padY=6*2, +4 → boardH=568
    const boardH=U(568);
    const by=canvas.height - panelH - boardH - U(2);
    return mx >= 0 && mx <= boardW && my >= by && my <= canvas.height - panelH;
  }

  addEventListener("mousemove",(e)=>{
    updateMouse(e);
    if(input._camDragActive && input.mouseDownR && input.ctrlHeld){
      const cam=window.G?.cam; if(!cam) return;
      const Z=(window.CONFIG?.camera?.zoom||0.12)*(window.G?.DPR||1);
      const dx=(input.mouseX-input._camDragLastX)/Z;
      const dy=(input.mouseY-input._camDragLastY)/Z;
      cam.x=cam.x-dx;
      cam.y=cam.y-dy;
      input._camDragLastX=input.mouseX;
      input._camDragLastY=input.mouseY;
    }
  });

  addEventListener("mousedown",(e)=>{
    updateMouse(e);
    if(e.button===0){
      input.mouseDownL=true;
      // Start screen — offset click Y by scroll only on scenario screen (vessel screen elements are fixed)
      if(window.G?.game?.started===false){
        const g=window.G.game;
        const offsetY=(g.startPhase||'scenario')==='scenario'?(g.startScrollY||0):0;
        window.PANEL?.handleClick(input.mouseX, input.mouseY+offsetY);
        return;
      }
      // Panel and depth strip absorb clicks — don't route to chart
      if(inPanel(input.mouseY)||inDepthStrip(input.mouseX)||inLogPanel(input.mouseX,input.mouseY)||inCompass(input.mouseX,input.mouseY)){
        window.PANEL?.handleClick(input.mouseX, input.mouseY);
        return;
      }
      // Try overlay buttons (damage panel, etc.) before routing to chart
      if(window.PANEL?.handleClick(input.mouseX, input.mouseY)) return;
      if(input.shiftHeld){
        input.torpAimClick=true;
      } else {
        input._pendingRouteClick=true;
      }
    }
    if(e.button===2){
      input.mouseDownR=true;
      if(input.ctrlHeld && !inPanel(input.mouseY) && !inDepthStrip(input.mouseX)){
        // Ctrl+RMB — start free-cam drag
        input._camDragActive=true;
        input._camDragLastX=input.mouseX;
        input._camDragLastY=input.mouseY;
        const cam=window.G?.cam; if(cam) cam.free=true;
      } else if(!inPanel(input.mouseY)&&!inDepthStrip(input.mouseX)){
        input.routeRemoveLast=true;
      }
    }
  });

  addEventListener("mouseup",(e)=>{
    if(e.button===0) input.mouseDownL=false;
    if(e.button===2){ input.mouseDownR=false; input._camDragActive=false; }
  });

  addEventListener("wheel",(e)=>{
    const game=window.G?.game;
    if(game && !game.started){
      e.preventDefault();
      const delta=e.deltaMode===1?e.deltaY*24:e.deltaMode===2?e.deltaY*(window.innerHeight||800):e.deltaY;
      if((game.startPhase||'scenario')==='vessel' && (game.vesselTab||'player')==='soviet'){
        game.vesselScrollY=Math.max(0,(game.vesselScrollY||0)+delta);
      } else {
        game.startScrollY=Math.max(0,(game.startScrollY||0)+delta);
      }
      return;
    }
    const canvas=getCanvas(); if(!canvas) return;
    if(inPanel(input.mouseY)) return; // don't zoom when hovering panel
    e.preventDefault();
    input.zoomDelta+=e.deltaY>0?-1:1;
  },{passive:false});

  addEventListener("contextmenu",(e)=>e.preventDefault());

  // Focus loss — clear all held state so no keys/buttons ghost after alt-tab etc.
  addEventListener("blur",()=>{
    input.keys.clear();
    input.shiftHeld=false;
    input.ctrlHeld=false;
    input.mouseDownL=false;
    input.mouseDownR=false;
    input._camDragActive=false;
  });

  window.I=input;
})();
