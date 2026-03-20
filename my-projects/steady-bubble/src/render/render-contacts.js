// render-contacts.js — sonar contacts, TMA bearing lines, towed array bearings, passive contact flashes
'use strict';

import { CONFIG } from '../config/constants.js';
import { clamp, angleNorm } from '../utils/math.js';
import { player, sonarContacts, contacts } from '../state/sim-state.js';
import { session } from '../state/session-state.js';

const C = CONFIG;

/**
 * Draw sonar contacts — TMA bearing lines + position blobs.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Function} w2s
 * @param {Function} wScale
 * @param {Function} doodleText
 * @param {Function} doodleCircle
 * @param {Function} U
 */
export function drawSonarContacts(ctx, w2s, wScale, doodleText, doodleCircle, U) {
  const SC=sonarContacts;
  const TMA_CFG=C.tma;
  if(SC && TMA_CFG){
    const t2=performance.now()/1000;
    const maxBrgLine=wScale(TMA_CFG.defaultRange*1.4);

    for(const [e,c] of SC){
      const fresh=c.activeT>0;
      const T_game=session.missionT||0;
      const staleSecs=T_game-(c.lastObsT||0);
      const alpha=Math.max(0.18, 0.80 - Math.min(1,staleSecs/120)*0.62);
      const age=t2-c.lastT;
      const q=c.tmaQuality??0;

      // Past bearing lines — ghosted history
      const obs=c.bearings||[];
      const histObs=obs.slice(-7, -1);
      for(const o of histObs){
        const [ox,oy]=w2s(o.fromX, o.fromY);
        const endX=o.fromX+Math.cos(o.bearing)*TMA_CFG.defaultRange*1.3;
        const endY=o.fromY+Math.sin(o.bearing)*TMA_CFG.defaultRange*1.3;
        const [ex2,ey2]=w2s(endX, endY);
        ctx.strokeStyle=`rgba(17,24,39,${alpha*0.14})`;
        ctx.lineWidth=0.8;
        ctx.setLineDash([3,6]);
        ctx.beginPath(); ctx.moveTo(ox,oy); ctx.lineTo(ex2,ey2); ctx.stroke();
        ctx.setLineDash([]);
      }

      // Current bearing line
      if(c.latestBrg!=null){
        const ox=c.latestFromX??player.wx, oy2=c.latestFromY??player.wy;
        const [lox,loy]=w2s(ox,oy2);
        const endX=ox+Math.cos(c.latestBrg)*TMA_CFG.defaultRange*1.4;
        const endY=oy2+Math.sin(c.latestBrg)*TMA_CFG.defaultRange*1.4;
        const [ex,ey]=w2s(endX, endY);
        ctx.strokeStyle=`rgba(17,24,39,${alpha*(fresh?0.70:0.45)})`;
        ctx.lineWidth=fresh?1.4:1.0;
        ctx.setLineDash(fresh?[]:[4,5]);
        ctx.beginPath(); ctx.moveTo(lox,loy); ctx.lineTo(ex,ey); ctx.stroke();
        ctx.setLineDash([]);

        // Contact ID + solution quality along the bearing line
        {
          const labelDist=Math.min(maxBrgLine*0.55, wScale(500));
          const lineLen=Math.hypot(ex-lox,ey-loy)||1;
          const lx=lox+(ex-lox)*(labelDist/lineLen);
          const ly=loy+(ey-loy)*(labelDist/lineLen);
          const perpX=-(ey-loy)/lineLen, perpY=(ex-lox)/lineLen;
          const tickLen=U(3+q*6);
          const tickCol=q>=0.6?`rgba(22,163,74,${alpha*0.9})`:q>=0.2?`rgba(217,119,6,${alpha*0.9})`:`rgba(100,100,100,${alpha*0.6})`;
          ctx.strokeStyle=tickCol; ctx.lineWidth=2;
          ctx.beginPath();
          ctx.moveTo(lx-perpX*tickLen, ly-perpY*tickLen);
          ctx.lineTo(lx+perpX*tickLen, ly+perpY*tickLen);
          ctx.stroke();
          ctx.fillStyle=`rgba(17,24,39,${alpha*0.75})`;
          doodleText(c.id, lx+U(4), ly-U(4), U(8), 'left');
          if(q<0.2) doodleText('BRG', lx+U(4), ly+U(6), U(8), 'left');
          else if(q<0.6){ ctx.fillStyle=`rgba(217,119,6,${alpha*0.75})`; doodleText('BLDG', lx+U(4), ly+U(6), U(8), 'left'); }
          else { ctx.fillStyle=`rgba(22,163,74,${alpha*0.75})`; doodleText('SOLID', lx+U(4), ly+U(6), U(8), 'left'); }

          // ── CLSNG / OPNG / CBDR tag
          {
            const rr=c._rangeRate, br=c._brgRate;
            let tag=null, tagCol=null;
            if(rr!=null){
              const cbdr=Math.abs(br??0)<0.0006 && rr<-8;
              if(cbdr){ tag='CBDR'; tagCol=`rgba(180,30,30,${alpha*0.90})`; }
              else if(rr<-8){ tag='CLSNG'; tagCol=`rgba(180,30,30,${alpha*0.72})`; }
              else if(rr>8){ tag='OPNG'; tagCol=`rgba(40,110,50,${alpha*0.72})`; }
            } else if(br!=null && Math.abs(br)>0.0008){
              tag=br>0?'R DRIFT':'L DRIFT';
              tagCol=`rgba(100,100,100,${alpha*0.55})`;
            }
            if(tag){
              ctx.fillStyle=tagCol;
              doodleText(tag, lx+U(4), ly+U(16), U(8), 'left');
            }
          }
        }
      }

      // ── Estimated contact position + heading arrow
      if(c._estHeading!=null && c._estRange!=null){
        const headingAge=T_game-(c._estHeadingT||0);
        if(headingAge<90){
          const conf=(c._estHeadingConf||0)*(1-Math.min(1,headingAge/90));
          if(conf>0.06){
            const ox=c.latestFromX??player.wx, oy=c.latestFromY??player.wy;
            const cpx=ox+Math.cos(c.latestBrg??0)*c._estRange;
            const cpy=oy+Math.sin(c.latestBrg??0)*c._estRange;
            const [scx,scy]=w2s(cpx,cpy);
            ctx.fillStyle=`rgba(17,24,39,${alpha*clamp(conf*1.2,0,0.75)})`;
            ctx.beginPath(); ctx.arc(scx,scy,U(3),0,Math.PI*2); ctx.fill();
            const arrowLen=800+conf*600;
            const tipX=cpx+Math.cos(c._estHeading)*arrowLen;
            const tipY=cpy+Math.sin(c._estHeading)*arrowLen;
            const [stx,sty]=w2s(tipX,tipY);
            const aAlpha=alpha*clamp(conf*1.1,0,0.70);
            ctx.strokeStyle=`rgba(17,24,39,${aAlpha})`;
            ctx.lineWidth=1.5; ctx.setLineDash([]);
            ctx.beginPath(); ctx.moveTo(scx,scy); ctx.lineTo(stx,sty); ctx.stroke();
            const ang=Math.atan2(sty-scy,stx-scx);
            const aw=U(5);
            ctx.beginPath();
            ctx.moveTo(stx,sty);
            ctx.lineTo(stx+Math.cos(ang+2.6)*aw, sty+Math.sin(ang+2.6)*aw);
            ctx.moveTo(stx,sty);
            ctx.lineTo(stx+Math.cos(ang-2.6)*aw, sty+Math.sin(ang-2.6)*aw);
            ctx.stroke();
            if(conf>0.25){
              const hdgDeg=(((Math.atan2(Math.cos(c._estHeading),-Math.sin(c._estHeading))*180/Math.PI)+360)%360);
              ctx.fillStyle=`rgba(17,24,39,${alpha*conf*0.65})`;
              doodleText(Math.round(hdgDeg).toString().padStart(3,'0')+'°', scx+U(5), scy-U(8), U(7), 'left');
            }
            if(conf>0.30){
              const brgToPlayer=(c.latestBrg??0)+Math.PI;
              const aspectRad=Math.abs(((c._estHeading-brgToPlayer+3*Math.PI)%(Math.PI*2))-Math.PI);
              let aspect;
              if(aspectRad<Math.PI/6)       aspect='BOW';
              else if(aspectRad<Math.PI/3)  aspect='F.QTR';
              else if(aspectRad<2*Math.PI/3) aspect='BEAM';
              else if(aspectRad<5*Math.PI/6) aspect='A.QTR';
              else                           aspect='STERN';
              const aspectCol=aspect==='BOW'?`rgba(180,30,30,${alpha*conf*0.80})`
                :aspect==='STERN'?`rgba(40,110,50,${alpha*conf*0.80})`
                :`rgba(17,24,39,${alpha*conf*0.65})`;
              ctx.fillStyle=aspectCol;
              doodleText(aspect, scx+U(5), scy+U(5), U(7), 'left');
            }
          }
        }
      }
    }
  }
}

/**
 * Draw towed array — deaf cone + ambiguous bearing lines.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Function} w2s
 * @param {Function} wScale
 * @param {Function} doodleText
 * @param {Function} doodleCircle
 * @param {Function} U
 */
export function drawTowedArrayBearings(ctx, w2s, wScale, doodleText, doodleCircle, U) {
  {
    const ta=player.towedArray;
    const taActive=ta&&(ta.state==='operational'||ta.state==='damaged');
    if(taActive){
      const [px2,py2]=w2s(player.wx,player.wy);
      const heading=player.heading||0;
      const stern=heading+Math.PI;
      const CONE_HALF=0.49;
      const coneLen=wScale(600);
      ctx.save();
      ctx.globalAlpha=0.07;
      ctx.fillStyle='rgba(17,24,39,1)';
      ctx.beginPath();
      ctx.moveTo(px2,py2);
      ctx.arc(px2,py2,coneLen,stern-CONE_HALF,stern+CONE_HALF);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      const coneEdgeX=px2+Math.cos(stern)*coneLen*0.7;
      const coneEdgeY=py2+Math.sin(stern)*coneLen*0.7;
      ctx.fillStyle='rgba(17,24,39,0.22)';
      doodleText('DEAF', coneEdgeX, coneEdgeY, U(7), 'center');
    }

    // Draw towed array bearing candidates for each contact
    if(ta&&ta.state!=='stowed'&&ta.state!=='destroyed'){
      for(const [e,c] of sonarContacts){
        if(!c.towedCandA||c.towedCandA.length===0) continue;
        const T_game=session.missionT||0;
        const staleSecs=T_game-(c.lastObsT||0);
        const baseAlpha=Math.max(0.12, 0.75-Math.min(1,staleSecs/90)*0.60);
        const resolved=c.towedResolved;
        const lastObs=c.towedCandA[c.towedCandA.length-1];
        if(!lastObs) continue;
        const [ox,oy]=w2s(lastObs.fromX, lastObs.fromY);
        const maxLen=wScale(C.tma.defaultRange*1.4);

        if(resolved){
          const useCandA = resolved==='A';
          const latestObs=useCandA
            ? c.towedCandA[c.towedCandA.length-1]
            : c.towedCandB[c.towedCandB.length-1];
          if(latestObs){
            const brg=latestObs.bearing;
            const [lox2,loy2]=w2s(latestObs.fromX,latestObs.fromY);
            const ex=latestObs.fromX+Math.cos(brg)*C.tma.defaultRange*1.4;
            const ey=latestObs.fromY+Math.sin(brg)*C.tma.defaultRange*1.4;
            const [ex2,ey2]=w2s(ex,ey);
            ctx.strokeStyle=`rgba(20,184,166,${baseAlpha*0.75})`;
            ctx.lineWidth=1.3;
            ctx.setLineDash([]);
            ctx.beginPath(); ctx.moveTo(lox2,loy2); ctx.lineTo(ex2,ey2); ctx.stroke();
            const labelDist=Math.min(maxLen*0.55,wScale(500));
            const lineLen=Math.hypot(ex2-lox2,ey2-loy2)||1;
            const lx=lox2+(ex2-lox2)*(labelDist/lineLen);
            const ly=loy2+(ey2-loy2)*(labelDist/lineLen);
            ctx.fillStyle=`rgba(20,184,166,${baseAlpha*0.85})`;
            doodleText(c.id, lx+U(4), ly-U(4), U(8), 'left');
            doodleText('[T]', lx+U(4), ly+U(5), U(6), 'left');
          }
        } else {
          const candPairs=[
            {obs:c.towedCandA, q:c.towedQA||0},
            {obs:c.towedCandB, q:c.towedQB||0},
          ];
          for(let ci=0;ci<candPairs.length;ci++){
            const {obs:cpObs,q}=candPairs[ci];
            if(!cpObs.length) continue;
            const latest=cpObs[cpObs.length-1];
            const [lox3,loy3]=w2s(latest.fromX,latest.fromY);
            const ex=latest.fromX+Math.cos(latest.bearing)*C.tma.defaultRange*1.4;
            const ey=latest.fromY+Math.sin(latest.bearing)*C.tma.defaultRange*1.4;
            const [ex3,ey3]=w2s(ex,ey);
            ctx.strokeStyle=`rgba(20,184,166,${baseAlpha*0.38})`;
            ctx.lineWidth=1.0;
            ctx.setLineDash([3,5]);
            ctx.beginPath(); ctx.moveTo(lox3,loy3); ctx.lineTo(ex3,ey3); ctx.stroke();
            ctx.setLineDash([]);
            if(ci===0){
              const labelDist=Math.min(maxLen*0.45,wScale(400));
              const lineLen=Math.hypot(ex3-lox3,ey3-loy3)||1;
              const lx=lox3+(ex3-lox3)*(labelDist/lineLen);
              const ly=loy3+(ey3-loy3)*(labelDist/lineLen);
              ctx.fillStyle=`rgba(20,184,166,${baseAlpha*0.55})`;
              doodleText(`${c.id} ?`, lx+U(4), ly-U(4), U(8), 'left');
              doodleText('TURN TO RESOLVE', lx+U(4), ly+U(5), U(6), 'left');
            }
          }
        }
      }
    }
  }
}

/**
 * Draw passive contact flashes (fading bearing lines from recent detections).
 * @param {CanvasRenderingContext2D} ctx
 * @param {Function} w2s
 * @param {Function} doodleText
 * @param {Function} U
 */
export function drawPassiveContacts(ctx, w2s, doodleText, U) {
  const TMA_CFG=C.tma;
  for(const c of contacts){
    const isTowed = c.source==='towed';
    const a=clamp(c.life/2.2,0,1);
    const fromX=c.fromX??player.wx, fromY=c.fromY??player.wy;
    const lineLen=TMA_CFG ? TMA_CFG.defaultRange*1.2 : 900;
    const endX=fromX+Math.cos(c.bearing)*lineLen;
    const endY=fromY+Math.sin(c.bearing)*lineLen;
    const [lx1,ly1]=w2s(fromX,fromY);
    const [lx2,ly2]=w2s(endX,endY);
    ctx.strokeStyle=isTowed?`rgba(20,184,166,${0.30*a})`:`rgba(17,24,39,${0.22*a})`;
    ctx.lineWidth=1.2;
    ctx.setLineDash([4,5]);
    ctx.beginPath(); ctx.moveTo(lx1,ly1); ctx.lineTo(lx2,ly2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle=`rgba(17,24,39,${0.18*a})`;
    ctx.beginPath(); ctx.arc(lx1,ly1,2,0,Math.PI*2); ctx.fill();
  }
}
