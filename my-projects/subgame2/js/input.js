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
  };

  addEventListener("keydown",(e)=>{
    const k=e.key.toLowerCase();
    input.keys.add(k);
    if(e.key==="Shift") input.shiftHeld=true;
    if(e.key==="Control") input.ctrlHeld=true;
    // Home — re-centre camera on player
    if(e.key==="Home"){ const cam=window.G?.cam; const p=window.G?.player; if(cam&&p){cam.free=false;cam.x=p.wx;cam.y=p.wy;} }
    if(k==='j'&&window.G?.game){ window.G.game.logTab = window.G.game.logTab==='dc'?'log':'dc'; }
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

  // Is the click inside the command panel strip at the bottom?
  function inPanel(my){
    const canvas=getCanvas(); if(!canvas) return false;
    const DPR=getDPR();
    const panelH=window.CONFIG.layout.panelH*DPR;
    return my >= canvas.height - panelH;
  }

  // Is the click inside the depth strip on the right?
  function inDepthStrip(mx){
    const canvas=getCanvas(); if(!canvas) return false;
    const DPR=getDPR();
    return mx >= canvas.width - 56*DPR;
  }

  // Log panel sits above the bottom panel, bottom-left corner
  // Must absorb clicks so they don't fall through to chart waypoints
  function inLogPanel(mx, my){
    const canvas=getCanvas(); if(!canvas) return false;
    const DPR=getDPR();
    const panelH=window.CONFIG.layout.panelH*DPR;
    const boardW=560*DPR;
    // tabH=20, rowH=19, maxRows=28, padY=6*2, +4 → boardH=568
    const boardH=568*DPR;
    const by=canvas.height - panelH - boardH - 2*DPR;
    return mx >= 0 && mx <= boardW && my >= by && my <= canvas.height - panelH;
  }

  addEventListener("mousemove",(e)=>{
    updateMouse(e);
    if(input._camDragActive && input.mouseDownR && input.ctrlHeld){
      const cam=window.G?.cam; if(!cam) return;
      const Z=(window.CONFIG?.camera?.zoom||0.12)*(window.G?.DPR||1);
      const dx=(input.mouseX-input._camDragLastX)/Z;
      const dy=(input.mouseY-input._camDragLastY)/Z;
      const w=window.G?.world?.w||12000, h=window.G?.world?.h||12000;
      cam.x=(cam.x-dx+w)%w;
      cam.y=(cam.y-dy+h)%h;
      input._camDragLastX=input.mouseX;
      input._camDragLastY=input.mouseY;
    }
  });

  addEventListener("mousedown",(e)=>{
    updateMouse(e);
    if(e.button===0){
      input.mouseDownL=true;
      // Start screen — all clicks go to PANEL
      if(window.G?.game?.started===false){
        window.PANEL?.handleClick(input.mouseX, input.mouseY);
        return;
      }
      // Panel and depth strip absorb clicks — don't route to chart
      if(inPanel(input.mouseY)||inDepthStrip(input.mouseX)||inLogPanel(input.mouseX,input.mouseY)){
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
    const canvas=getCanvas(); if(!canvas) return;
    if(inPanel(input.mouseY)) return; // don't zoom when hovering panel
    e.preventDefault();
    input.zoomDelta+=e.deltaY>0?-1:1;
  },{passive:false});

  addEventListener("contextmenu",(e)=>e.preventDefault());
  window.I=input;
})();