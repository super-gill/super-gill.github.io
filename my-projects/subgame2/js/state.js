(() => {
  'use strict';
  const C=window.CONFIG;
  const canvas=document.getElementById("c");
  const ctx=canvas.getContext("2d");
  const DPR=Math.max(1,Math.min(2,window.devicePixelRatio||1));
  function resize(){canvas.width=Math.floor(innerWidth*DPR);canvas.height=Math.floor(innerHeight*DPR);}
  addEventListener("resize",resize,{passive:true});resize();

  const world={...C.world};

  // cam: top-down, tracks player in world-space
  // cam.x/y = world position of screen centre
  const cam={x:0,y:0,zoom:C.camera.zoom};

  const bullets=[],particles=[],enemies=[],decoys=[],contacts=[],cwisTracers=[],wireContacts=[],ghostContacts=new Map(),sonarContacts=new Map(),wrecks=[];
  let _nextTorpId=1;

  const player={
    // Position in top-down world (x,y). Depth is a separate scalar.
    x:6000, y:6000,
    heading:0,           // radians, 0=east, PI/2=south (screen down)
    speed:0,
    speedOrderKts:0,
    depth:260,           // current depth (world units below seaLevel=0)
    depthOrder:260,
    vy:0,                // vertical (depth) velocity

    hp:C.player.hpMax, invuln:0,
    noise:0, noiseTransient:0, cavitating:false,
    torpCd:0, missileCd:0, pingCd:0, cmCd:0, sonarPulse:0,
    periscopeCd:0, periscopeT:0,
    silent:false,
    scram:false, scramT:0, scramCause:null, scramEPM:false,
    emergTurnT:0, emergTurnCd:0,
    crashDiveT:0, crashDiveCd:0,
    passiveTick:0,
    turnRate:0,
    towedArray:{
      state:'stowed',   // 'stowed'|'deploying'|'retracting'|'operational'|'damaged'|'destroyed'
      progress:0,       // 0-1 during deploy/retract
      overspeedT:0,     // seconds spent above damage threshold
    },

    // Legacy alias: ai.js and sensors.js read player.y expecting depth position.
    // We override .y via a getter/setter so world-y and depth coexist cleanly.
    // player._y = top-down world Y, player.y = depth (for sim compat)
  };

  // Give sensors/ai/signature their expected player.y = depth
  // while the renderer uses player.wx, player.wy for world position.
  // Simplest approach: just keep both. player.wx/wy = top-down, player.y = depth.
  player.wx = player.x;
  player.wy = player.y;
  player.y  = player.depth;  // sim/ai/sensors read player.y as depth

  const game={score:0,over:false,msg:"",msgT:0,lastT:performance.now(),contactsScroll:0,wepsProposal:null,
    tdc:{target:null, targetId:null, bearing:null, range:null, depth:null, course:null, speed:null, intercept:null},
    missionT:0,
    msgLog:[], logTab:'log',
    dcLog:[], showDcPanel:false,
    scenario:'waves', started:false,
    tacticalState:'cruising',   // cruising | patrol | action
    casualtyState:'normal',     // normal | emergency | escape
    _prevTactical:'cruising',   // for transition detection
    _prevCasualty:'normal',
  };
  function addLog(cat, text, priority=0){
    game.msgLog.push({t:game.missionT||0, cat, text, priority});
    if(game.msgLog.length>120) game.msgLog.shift();
  }
  const setMsg=(s,t=1.2)=>{game.msg=s;game.msgT=t;};

  function nextTorpId(){ return 'T'+(_nextTorpId++); }
  function resetTorpIds(){ _nextTorpId=1; }
  function queueLog(station,msg,delayS,priority=0){
    if(!player.pendingLogs) player.pendingLogs=[];
    player.pendingLogs.push({t:delayS,station,msg,priority});
  }
  function setTacticalState(s){
    if(game.tacticalState===s) return false;
    game._prevTactical=game.tacticalState;
    game.tacticalState=s;
    return true;
  }
  function setCasualtyState(s){
    if(game.casualtyState===s) return false;
    game._prevCasualty=game.casualtyState;
    game.casualtyState=s;
    return true;
  }
  function triggerScram(cause){
    if(player.scram) return; // already scrammed
    player.scram=true;
    player.scramT=75; // full restart window
    player.scramCause=cause||'unknown';
    player.scramEPM=false;
  }
  window.G={canvas,ctx,DPR,world,cam,bullets,particles,enemies,decoys,contacts,cwisTracers,wireContacts,ghostContacts,sonarContacts,player,game,resize,setMsg,nextTorpId,resetTorpIds,addLog,queueLog,wrecks,triggerScram,setTacticalState,setCasualtyState};
})();