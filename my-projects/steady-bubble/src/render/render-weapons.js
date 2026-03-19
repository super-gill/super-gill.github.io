// render-weapons.js — torpedoes, ASROC, cruise missiles, depth charges, wire contacts, CWIS tracers
'use strict';

import { CONFIG } from '../config/constants.js';
import { clamp } from '../utils/math.js';
import { bullets, wireContacts, cwisTracers, missiles } from '../state/sim-state.js';

const C = CONFIG;

/**
 * Draw torpedoes + wire lines + seeker cones.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Function} w2s
 * @param {Function} wScale
 * @param {Function} doodleLine
 * @param {Function} doodleText
 * @param {Function} doodleCircle
 * @param {Function} U
 * @param {Function} drawTorpedoTopDown
 * @param {number} plotW
 * @param {number} plotH
 */
export function drawTorpedoes(ctx, w2s, wScale, doodleLine, doodleText, doodleCircle, U, drawTorpedoTopDown, plotW, plotH) {
  for(const b of bullets){
    if(b.kind!=='torpedo') continue;
    const [tx2,ty2]=w2s(b.x,b.y);

    const seekerOn=b.traveled>=(b.enableDist||0);
    if(b.friendly && seekerOn){
      const torpAng=Math.atan2(b.vy,b.vx);
      const seekR=wScale(C.torpedo.seekRange||300);
      const fov=C.torpedo.seekFOV||0.85;
      const hasTarget=b.target!=null;
      ctx.save();
      ctx.translate(tx2,ty2);
      ctx.rotate(torpAng);
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.arc(0,0,seekR,-fov/2,fov/2);
      ctx.closePath();
      ctx.fillStyle=hasTarget?'rgba(30,58,95,0.07)':'rgba(17,24,39,0.04)';
      ctx.fill();
      ctx.strokeStyle=hasTarget?'rgba(30,58,95,0.35)':'rgba(17,24,39,0.18)';
      ctx.lineWidth=1;
      ctx.setLineDash([3,4]);
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.lineTo(seekR*Math.cos(-fov/2), seekR*Math.sin(-fov/2));
      ctx.moveTo(0,0);
      ctx.lineTo(seekR*Math.cos(fov/2), seekR*Math.sin(fov/2));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      if(b.target){
        const tRef=b.target;
        const [ex,ey]=w2s(tRef.wx??tRef.x, tRef.wy??tRef.y);
        ctx.strokeStyle='rgba(30,58,95,0.45)';
        ctx.lineWidth=1.5;
        ctx.setLineDash([2,3]);
        ctx.beginPath(); ctx.moveTo(tx2,ty2); ctx.lineTo(ex,ey); ctx.stroke();
        ctx.setLineDash([]);
      }

      const lifeLeft=Math.ceil(b.life);
      const wireStatus=b.wire?.live;
      const statusTxt=hasTarget?`T${b.torpId} LOCKED`
        :wireStatus?`T${b.torpId} WIRE ${lifeLeft}s`
        :`T${b.torpId} SEARCH ${lifeLeft}s`;
      ctx.fillStyle=hasTarget?'rgba(30,58,95,0.75)':wireStatus?'rgba(20,100,60,0.70)':'rgba(17,24,39,0.45)';
      doodleText(statusTxt, tx2+U(8), ty2-U(6), U(8), 'left');
    } else if(b.friendly && !seekerOn){
      const distLeft=wScale((b.enableDist||0)-b.traveled);
      ctx.strokeStyle='rgba(17,24,39,0.20)';
      ctx.lineWidth=1;
      ctx.setLineDash([2,4]);
      const ang=Math.atan2(b.vy,b.vx);
      ctx.beginPath(); ctx.moveTo(tx2,ty2);
      ctx.lineTo(tx2+Math.cos(ang)*distLeft, ty2+Math.sin(ang)*distLeft);
      ctx.stroke(); ctx.setLineDash([]);
      doodleText(`T${b.torpId} ARM`, tx2+U(8), ty2-U(6), U(8), 'left');
    }

    if(!b.friendly && !b._alertedPlayer) { /* not yet detected */ } else drawTorpedoTopDown(b);
    if(b.wire&&b.wire.live){
      ctx.strokeStyle='rgba(17,24,39,0.28)';
      ctx.lineWidth=1;
      ctx.setLineDash([4,5]);
      ctx.beginPath(); ctx.moveTo(tx2,ty2); ctx.lineTo(...w2s(b.wire.fromX,b.wire.fromY)); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

/**
 * Draw ASROC rockets.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Function} w2s
 * @param {Function} doodleLine
 * @param {Function} doodleText
 * @param {Function} U
 * @param {number} plotW
 * @param {number} plotH
 */
export function drawASROC(ctx, w2s, doodleLine, doodleText, U, plotW, plotH) {
  for(const b of bullets){
    if(b.kind!=='rocket'||b.life<=0) continue;
    const [rx,ry]=w2s(b.x,b.y);
    if(rx<-40||rx>plotW+40||ry<-40||ry>plotH+40) continue;
    const ang=Math.atan2(b.vy,b.vx);
    ctx.save();
    ctx.translate(rx,ry); ctx.rotate(ang);
    ctx.strokeStyle='rgba(255,120,20,0.95)';
    ctx.lineWidth=2.5;
    doodleLine(-U(10),0, U(10),0, 2.5);
    doodleLine(U(8),-U(3), U(10),0, 2);
    doodleLine(U(8),U(3),  U(10),0, 2);
    ctx.strokeStyle='rgba(255,200,80,0.40)';
    ctx.lineWidth=1.5;
    ctx.setLineDash([U(4),U(4)]);
    doodleLine(-U(10),0, -U(25),0, 1.5);
    ctx.setLineDash([]);
    ctx.restore();
    ctx.fillStyle='rgba(255,140,30,0.85)';
    doodleText('ASROC', rx+U(12), ry-U(5), U(7), 'left');
  }
}

/**
 * Draw cruise missiles.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Function} w2s
 * @param {Function} doodleLine
 * @param {Function} doodleText
 * @param {Function} U
 * @param {number} plotW
 * @param {number} plotH
 */
export function drawCruiseMissiles(ctx, w2s, doodleLine, doodleText, U, plotW, plotH) {
  if(missiles){
    for(const m of missiles){
      const [mx,my]=w2s(m.x,m.y);
      if(mx<-60||mx>plotW+60||my<-60||my>plotH+60) continue;
      if(m.trail && m.trail.length>1){
        ctx.strokeStyle='rgba(220,60,60,0.40)';
        ctx.lineWidth=1.5;
        ctx.beginPath();
        for(let _ti=0;_ti<m.trail.length;_ti++){
          const [tx,ty]=w2s(m.trail[_ti].x,m.trail[_ti].y);
          if(_ti===0) ctx.moveTo(tx,ty); else ctx.lineTo(tx,ty);
        }
        ctx.stroke();
      }
      const ang=Math.atan2(m.vy,m.vx);
      ctx.save();
      ctx.translate(mx,my); ctx.rotate(ang);
      ctx.strokeStyle='rgba(240,40,40,0.95)'; ctx.lineWidth=2.5;
      doodleLine(-U(8),0,U(8),0,2.5);
      doodleLine(U(6),-U(3),U(8),0,2);
      doodleLine(U(6),U(3),U(8),0,2);
      ctx.restore();
      const mLbl=m.state==='seeker_active'?(m.target?'LOCKED':'SEEK'):'MSL';
      ctx.fillStyle=m.target?'rgba(240,40,40,0.90)':'rgba(220,80,80,0.80)';
      doodleText(mLbl,mx+U(10),my-U(5),U(7),'left');
    }
  }
}

/**
 * Draw depth charges.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Function} w2s
 * @param {Function} doodleText
 * @param {Function} U
 * @param {number} plotW
 * @param {number} plotH
 */
export function drawDepthCharges(ctx, w2s, doodleText, U, plotW, plotH) {
  for(const b of bullets){
    if(b.kind!=='depthCharge'||b.life<=0) continue;
    const [dcx,dcy]=w2s(b.x,b.y);
    if(dcx<-20||dcx>plotW+20||dcy<-20||dcy>plotH+20) continue;
    const bw=U(7), bh=U(5);
    ctx.fillStyle='rgba(160,90,30,0.88)';
    ctx.strokeStyle='rgba(220,140,50,0.95)';
    ctx.lineWidth=1.5;
    ctx.beginPath();
    ctx.roundRect(dcx-bw/2, dcy-bh/2, bw, bh, U(1.5));
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle='rgba(240,180,70,0.70)';
    ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(dcx-bw/2+U(2), dcy-bh/2); ctx.lineTo(dcx-bw/2+U(2), dcy+bh/2);
    ctx.moveTo(dcx+bw/2-U(2), dcy-bh/2); ctx.lineTo(dcx+bw/2-U(2), dcy+bh/2);
    ctx.stroke();
    ctx.fillStyle='rgba(240,160,50,0.80)';
    doodleText(`DC ${Math.round(b.y)}m`, dcx+bw/2+U(4), dcy+U(4), U(7.5), 'left');
  }
}

/**
 * Draw wire-fed contacts.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Function} w2s
 * @param {Function} doodleText
 * @param {Function} doodleCircle
 * @param {Function} U
 * @param {number} plotW
 */
export function drawWireContacts(ctx, w2s, doodleText, doodleCircle, U, plotW) {
  for(const wc of wireContacts){
    const [wx2,wy2]=w2s(wc.x,wc.y);
    if(wx2<0||wx2>plotW) continue;
    const a=clamp(wc.life/1.8,0,1);
    ctx.strokeStyle=`rgba(99,102,241,${0.65*a})`;
    ctx.fillStyle=`rgba(99,102,241,${0.50*a})`;
    ctx.save();
    ctx.translate(wx2,wy2); ctx.rotate(Math.PI/4);
    const ds=U(7);
    ctx.beginPath();
    ctx.rect(-ds/2,-ds/2,ds,ds);
    ctx.restore();
    ctx.lineWidth=1.5;
    doodleCircle(wx2,wy2,U(8),1.5);
    doodleText('WG',wx2+U(10),wy2+4,U(8),'left');
  }
}

/**
 * Draw CWIS tracers.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Function} w2s
 * @param {Function} wScale
 */
export function drawCWISTracers(ctx, w2s, wScale) {
  for(const t of cwisTracers){
    const [tx,ty]=w2s(t.x,t.y);
    const a=clamp(t.life/(t.maxLife||0.12),0,1);
    const spd=Math.hypot(t.vx,t.vy)||1;
    const tlen=wScale(14)*(a*0.6+0.4);
    const tx2=tx-(t.vx/spd)*tlen, ty2=ty-(t.vy/spd)*tlen;
    ctx.strokeStyle=`rgba(17,24,39,${0.85*a})`;
    ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(tx2,ty2); ctx.stroke();
  }
}
