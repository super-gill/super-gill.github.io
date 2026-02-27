(() => {
  'use strict';
  const { canvas, DPR } = window.G;
  const input = { keys:new Set(), mouseX:0, mouseY:0, mouseDownL:false, mouseDownR:false, aimWorldX:0, aimWorldY:0 };

  window.addEventListener("keydown",(e)=>{
    input.keys.add(e.key.toLowerCase());
    if([" ", "arrowup","arrowdown","arrowleft","arrowright"].includes(e.key.toLowerCase())) e.preventDefault();
  });
  window.addEventListener("keyup",(e)=> input.keys.delete(e.key.toLowerCase()));

  canvas.addEventListener("mousemove",(e)=>{
    const r = canvas.getBoundingClientRect();
    input.mouseX = (e.clientX - r.left) * DPR;
    input.mouseY = (e.clientY - r.top) * DPR;
  });
  canvas.addEventListener("mousedown",(e)=>{
    if(e.button===0) input.mouseDownL = true;
    if(e.button===2) input.mouseDownR = true;
  });
  window.addEventListener("mouseup",(e)=>{
    if(e.button===0) input.mouseDownL = false;
    if(e.button===2) input.mouseDownR = false;
  });
  window.addEventListener("contextmenu",(e)=> e.preventDefault());

  window.I = input;
})();
