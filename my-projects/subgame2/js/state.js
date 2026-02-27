(() => {
  'use strict';
  const C=window.CONFIG;
  const canvas=document.getElementById("c");
  const ctx=canvas.getContext("2d");
  const DPR=Math.max(1,Math.min(2,window.devicePixelRatio||1));
  function resize(){canvas.width=Math.floor(innerWidth*DPR);canvas.height=Math.floor(innerHeight*DPR);}
  addEventListener("resize",resize,{passive:true});resize();
  const world={...C.world}; const cam={x:0,y:0};
  const bullets=[],particles=[],enemies=[],decoys=[],contacts=[],cwisTracers=[];
  const player={
    x:900,y:world.seaLevel+260,heading:0,
    dir: 1,                // +1 right, -1 left (mirror heading)

    desiredHeading: 0,        // 0 = right, PI = left
speed:0,speedOrderIdx:3,depthOrder:world.seaLevel+260, // (deprecated in v5.1: ballast-based)
    ballast: (C.player.ballast ?? 0.0),
    vy:0,turnRate:0,hp:C.player.hpMax,invuln:0,
    noise:0,noiseTransient:0,cavitating:false,
    torpCd:0,missileCd:0,pingCd:0,cmCd:0,sonarPulse:0,
    silent:false,emergTurnT:0,emergTurnCd:0,crashDiveT:0,crashDiveCd:0,passiveTick:0
  };
  const game={score:0,over:false,msg:"",msgT:0,lastT:performance.now()};
  const setMsg=(s,t=1.2)=>{game.msg=s;game.msgT=t;};
  window.G={canvas,ctx,DPR,world,cam,bullets,particles,enemies,decoys,contacts,cwisTracers,player,game,resize,setMsg};
})();
