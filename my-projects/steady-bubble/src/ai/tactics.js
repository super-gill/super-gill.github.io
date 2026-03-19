'use strict';

import { CONFIG } from '../config/constants.js';
import { rand, clamp, now } from '../utils/math.js';
import { world, player, enemies } from '../state/sim-state.js';
import { addLog } from '../state/session-state.js';
import { wrapDx, enemyUpdateContactFromPing } from './perception.js';

// ── Lazy binding for circular deps ──────────────────────────────────────
let _COMMS = null;
export function _bindComms(c) { _COMMS = c; }

const C = CONFIG;

// Wolfpack datum share
export function wolfpackShareDatum(src, datumX, datumY, quality){
  const range=C.enemy.wolfpackDatumRange||4500;
  for(const e of enemies){
    if(e===src||e.dead) continue;
    const dx=wrapDx(e.x,src.x), dy=src.y-e.y;
    const d=Math.hypot(dx,dy);
    if(d>range) continue;
    const sig=clamp(1-d/range,0.1,0.6)*quality;
    e.suspicion=Math.min(e.suspicion+0.12*sig, Math.max(e.suspicion, 0.45));
    const blur=clamp(500*(1-sig)+250, 300, 900);
    const sharedX=datumX+rand(-blur,blur);
    const sharedY=datumY+rand(-blur,blur);
    if(!e.contact || sig > (e.contact.strength||0)*0.8){
      e.contact={x:sharedX,y:sharedY,u:blur,t:now(),strength:clamp(sig,0.05,0.35)};
    }
  }
}

// ── Active sonar — ship pings when suspicious or in hunt state ───────────────
export function shipActiveSonar(e, dt){
  if(e.type!=='boat' || e.civilian) return;
  const asw=C.enemy.asw;

  if(e._huntState){
    e._huntT=(e._huntT||0)-dt;
    if(e._huntT<=0){ e._huntState=false; e._huntDatum=null; e._sectorBearing=null; }
  }

  if(!e._huntState && e.suspicion<asw.activePingThreshold) return;

  e._pingCd=(e._pingCd||0)-dt;
  if(e._pingCd>0) return;

  const hasContact=!!e.contact;
  e._pingCd = hasContact
    ? asw.activePingContactInterval + rand(-5,5)
    : rand(asw.activePingInterval[0], asw.activePingInterval[1]);

  const dx=wrapDx(e.x, player.wx);
  const dy=player.wy-e.y;
  const d=Math.hypot(dx,dy);

  const playerBelowLayer=player.depth>(world.layerY2+40);
  const hullCanDetect=!playerBelowLayer;
  const vdsCanDetect=!!e.vdsDepth;

  let detected=false;

  if(hullCanDetect && d<=asw.activePingRange){
    const pDet=clamp((1-d/asw.activePingRange)*0.70*(e.sensitivity||1.0),0,0.85);
    if(Math.random()<pDet) detected=true;
  }
  if(!detected && vdsCanDetect && d<=asw.vdsPingRange){
    const pDet=clamp((1-d/asw.vdsPingRange)*0.65*(e.sensitivity||1.0),0,0.80);
    if(Math.random()<pDet) detected=true;
  }

  if(detected){
    const sDepth=vdsCanDetect?(e.vdsDepth||300):0;
    enemyUpdateContactFromPing(e, player.wx, player.wy, d, {x:e.x, y:e.y, depth:sDepth});
    if(e._huntState) e._huntT=asw.huntTimeout;
    _COMMS?.sensors?.activePing(1);
    shipShareContact(e, player.wx, player.wy, d*0.25);
  } else {
    _COMMS?.sensors?.activePing(0);
  }
}

// ── Hunt state — triggered when a friendly surface ship is killed ─────────────
export function triggerHuntState(killedShip){
  if(!killedShip || killedShip.type!=='boat') return;
  const asw=C.enemy.asw;
  const datum={x:killedShip.x, y:killedShip.y};

  const ships=enemies.filter(e=>e.type==='boat'&&!e.civilian&&!e.dead);
  if(!ships.length) return;

  const aswRank={UDALOY:0,KRIVAK:1,GRISHA:2};
  const searchers=ships
    .filter(e=>e.role==='pinger')
    .sort((a,b)=>(aswRank[a.subClass]??9)-(aswRank[b.subClass]??9));
  const count=Math.max(searchers.length,1);
  for(let i=0;i<searchers.length;i++){
    searchers[i]._sectorBearing=(2*Math.PI/count)*i;
    searchers[i]._sectorArc=asw.sectorArcDeg*(Math.PI/180);
  }

  for(const e of ships){
    e._huntState=true;
    e._huntT=asw.huntTimeout;
    e._huntDatum=datum;
    e.suspicion=Math.max(e.suspicion, asw.huntSuspicionFloor);
    e._pingCd=0;
    e._atDatum=false;
    e._datumHoldT=0;
    e._sectorRange=0;
  }

  addLog('SONAR','Conn, Sonar — underwater explosion. Multiple contacts going active, all units.');
}

// Ships share contact data with other ships only
export function shipShareContact(fromShip, cx, cy, accuracy){
  const _now=now();
  for(const e of enemies){
    if(e===fromShip || e.dead || e.type!=='boat' || e.civilian) continue;
    if(e.contact && (_now-e.contact.t)<5) continue;
    const noiseR=accuracy*rand(0.9,1.4);
    e.contact={x:cx+rand(-noiseR,noiseR), y:cy+rand(-noiseR,noiseR),
               u:noiseR, t:_now, strength:0.40, shared:true};
    e.suspicion=Math.min(1,Math.max(e.suspicion,0.45));
  }
}
