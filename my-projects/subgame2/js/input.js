(() => {
  'use strict';
  const {canvas,DPR}=window.G;

  const input={
    keys:new Set(),
    mouseX:0, mouseY:0,
    mouseDownL:false, mouseDownR:false,
    aimWorldX:0, aimWorldY:0,
    // Routing
    _pendingRouteClick:false,  // left click — add waypoint
    routeRemoveLast:false,     // right click — remove last waypoint
    // Zoom
    zoomDelta:0,
    // Torpedo aim mode
    shiftHeld:false,
    torpAimClick:false,        // shift+LMB fired
  };

  addEventListener("keydown",(e)=>{
    const k=e.key.toLowerCase();
    input.keys.add(k);
    if(e.key==="Shift") input.shiftHeld=true;
    if([" ","arrowup","arrowdown","arrowleft","arrowright"].includes(k)) e.preventDefault();
  });
  addEventListener("keyup",(e)=>{
    input.keys.delete(e.key.toLowerCase());
    if(e.key==="Shift") input.shiftHeld=false;
  });

  canvas.addEventListener("mousemove",(e)=>{
    const r=canvas.getBoundingClientRect();
    input.mouseX=(e.clientX-r.left)*DPR;
    input.mouseY=(e.clientY-r.top)*DPR;
  });

  canvas.addEventListener("mousedown",(e)=>{
    if(e.button===0){
      input.mouseDownL=true;
      if(input.shiftHeld){
        input.torpAimClick=true;   // shift+click = fire torpedo
      } else {
        input._pendingRouteClick=true; // plain click = waypoint
      }
    }
    if(e.button===2){
      input.mouseDownR=true;
      input.routeRemoveLast=true;  // RMB = remove last waypoint
    }
  });

  addEventListener("mouseup",(e)=>{
    if(e.button===0) input.mouseDownL=false;
    if(e.button===2) input.mouseDownR=false;
  });

  canvas.addEventListener("wheel",(e)=>{
    e.preventDefault();
    input.zoomDelta += e.deltaY > 0 ? -1 : 1;
  },{passive:false});

  addEventListener("contextmenu",(e)=>e.preventDefault());
  window.I=input;
})();
