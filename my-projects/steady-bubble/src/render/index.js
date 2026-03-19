// render.js — main draw orchestrator
// Calls all render sub-modules: render-world, render-hud, render-panel, render-contacts, render-weapons
'use strict';

import { CONFIG } from '../config/constants.js';
import { TAU, clamp, lerp, now, angleNorm } from '../utils/math.js';
import { world, cam, bullets, particles, enemies, decoys,
         player, wrecks, buoys, tdc } from '../state/sim-state.js';
import { session } from '../state/session-state.js';
import { ui } from '../state/ui-state.js';
import { drawSonarContacts, drawTowedArrayBearings, drawPassiveContacts } from './render-contacts.js';
import { drawTorpedoes, drawASROC, drawCruiseMissiles, drawDepthCharges, drawWireContacts, drawCWISTracers } from './render-weapons.js';

// ── Lazy bindings ────────────────────────────────────────────────────────
let _ctx = null;
let _canvas = null;
let _DPR = 1;
let _R = null;        // render-utils
let _RWORLD = null;   // render-world
let _RHUD = null;     // render-hud
let _RPANEL = null;   // render-panel
let _AI = null;
let _MAPS = null;
let _I = null;
let _UI_SCALE = null;

const C = CONFIG;

export function _bindRender(deps) {
  if (deps.ctx) _ctx = deps.ctx;
  if (deps.canvas) _canvas = deps.canvas;
  if (deps.DPR != null) _DPR = deps.DPR;
  if (deps.R) _R = deps.R;
  if (deps.RWORLD) _RWORLD = deps.RWORLD;
  if (deps.RHUD) _RHUD = deps.RHUD;
  if (deps.RPANEL) _RPANEL = deps.RPANEL;
  if (deps.AI) _AI = deps.AI;
  if (deps.MAPS) _MAPS = deps.MAPS;
  if (deps.I) _I = deps.I;
  if (deps.UI_SCALE) _UI_SCALE = deps.UI_SCALE;
}

// ── Main draw ─────────────────────────────────────────────────────────────────
function draw(){
  const ctx = _ctx;
  const canvas = _canvas;
  const DPR = _DPR;
  const {doodleLine,doodleCircle,doodleText,w2s,wScale,PANEL_H,STRIP_W,U} = _R;
  const {drawLand,drawRoute,drawPlayerTopDown,drawEnemySubTopDown,drawEnemyBoatTopDown,drawTorpedoTopDown} = _RWORLD;
  const {drawDepthStrip,drawThreatBar,drawNavCompass} = _RHUD;
  const {drawStartScreen,drawLogPanel,drawDcPanel,drawDamagePanel,drawCrewPanel,drawDamageScreen,drawPanel,drawEndScreen} = _RPANEL;

  const W=canvas.width, H=canvas.height;
  const panelH=PANEL_H;
  const plotH=H-panelH;
  const plotW=W-STRIP_W;
  const Z=cam.zoom*DPR;

  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,W,H);

  // ── Start screen ────────────────────────────────────────────────────────
  if(!session.started){
    drawStartScreen(W,H);
    return;
  }

  // ── End screens (game over / victory) ───────────────────────────────────
  if(session.over){
    drawEndScreen(W,H);
    return;
  }
  if(session.won){
    const enemyTorpsAlive = bullets.some(b => b.kind==='torpedo' && !b.friendly && b.life>0);
    if(!enemyTorpsAlive){
      drawEndScreen(W,H);
      return;
    }
  }

  const seaColour=_MAPS?.getMap()?.seaColour||'#daeaf7';
  ctx.fillStyle=seaColour;
  ctx.fillRect(0,0,W,H);

  // ── Adaptive grid — spacing scales with zoom ────────────────────────────
  const gridCandidates=[50,100,185,370,500,926,1000,1852,5000];
  let gridSpacing=1000;
  for(const g of gridCandidates){
    const px=g*Z;
    if(px>=70){ gridSpacing=g; break; }
  }
  const cx=(W-STRIP_W)/2, cy=(H-panelH)/2;
  ctx.strokeStyle='rgba(17,24,39,0.05)';
  ctx.lineWidth=1;
  const startX=Math.floor((cam.x-cx/Z)/gridSpacing)*gridSpacing;
  const startY=Math.floor((cam.y-cy/Z)/gridSpacing)*gridSpacing;
  for(let gx=startX;gx<startX+W/Z+gridSpacing;gx+=gridSpacing){
    const sx=cx+(gx-cam.x)*Z;
    ctx.beginPath(); ctx.moveTo(sx,0); ctx.lineTo(sx,H); ctx.stroke();
  }
  for(let gy=startY;gy<startY+H/Z+gridSpacing;gy+=gridSpacing){
    const sy=cy+(gy-cam.y)*Z;
    ctx.beginPath(); ctx.moveTo(0,sy); ctx.lineTo(W,sy); ctx.stroke();
  }

  // ── Nautical mile scale bar — bottom-left of chart area ─────────────────
  const NM_WU = 185.2;
  const nmCandidates=[0.25,0.5,1,2,5,10,20,50];
  let barNM=1;
  for(const nm of nmCandidates){
    if(nm*NM_WU*Z >= 60){ barNM=nm; break; }
  }
  const barWU  = barNM * NM_WU;
  const barPx  = barWU * Z;
  const barX   = U(14);
  const barY   = H - panelH - U(22);
  const barH   = U(4);
  ctx.fillStyle='rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.roundRect(barX-U(3), barY-U(8), barPx+U(6), U(18), U(3));
  ctx.fill();
  ctx.fillStyle='rgba(17,24,39,0.55)';
  ctx.fillRect(barX, barY, barPx, barH);
  ctx.strokeStyle='rgba(17,24,39,0.55)';
  ctx.lineWidth=1.2;
  ctx.beginPath();
  ctx.moveTo(barX,     barY-U(3)); ctx.lineTo(barX,     barY+barH+U(3));
  ctx.moveTo(barX+barPx,barY-U(3)); ctx.lineTo(barX+barPx,barY+barH+U(3));
  ctx.stroke();
  ctx.fillStyle='rgba(17,24,39,0.70)';
  ctx.font=`${U(8)}px ui-monospace,monospace`;
  ctx.textAlign='left';
  const nmLabel = `${barNM}nm`;
  ctx.fillText(nmLabel, barX+barPx+U(5), barY+barH, U(40));
  if(barNM <= 1){
    const mLabel = barNM >= 1 ? `${Math.round(barWU*10)/1000}km` : `${Math.round(barWU*10)}m`;
    ctx.fillStyle='rgba(17,24,39,0.38)';
    ctx.font=`${U(7)}px ui-monospace,monospace`;
    ctx.fillText(mLabel, barX+barPx+U(5), barY+barH+U(9));
  }

  // Land
  drawLand();

  // ── Planned route ─────────────────────────────────────────────────────────
  drawRoute();

  // ── Sonar ping ring ───────────────────────────────────────────────────────
  if(player.sonarPulse>0){
    const t=1-(player.sonarPulse/C.player.pingPulse);
    const R2=wScale(40+t*1800);
    ctx.strokeStyle=`rgba(31,41,55,${0.30*(1-t)})`;
    const [px,py]=w2s(player.wx,player.wy);
    doodleCircle(px,py,R2,2);
  }

  // ── Sonar contacts — TMA bearing lines + position blobs ─────────────────
  drawSonarContacts(ctx, w2s, wScale, doodleText, doodleCircle, U);

  // ── Towed array — deaf cone + ambiguous bearing lines ───────────────────
  drawTowedArrayBearings(ctx, w2s, wScale, doodleText, doodleCircle, U);

  // ── Passive contact flashes ─────────────────────────────────────────────
  drawPassiveContacts(ctx, w2s, doodleText, U);

  // ── Decoys ────────────────────────────────────────────────────────────────
  for(const d of decoys){
    const [dx,dy]=w2s(d.x,d.y);
    const pulse=0.6+0.4*Math.sin((session.missionT||0)*6 + d.x);
    if(d.friendly){
      ctx.strokeStyle=`rgba(255,160,30,${0.70*pulse})`;
      ctx.lineWidth=1.5;
      doodleCircle(dx,dy,5,1.5);
      ctx.strokeStyle=`rgba(255,160,30,${0.35*pulse})`;
      doodleCircle(dx,dy,wScale(d.r||20),1);
      ctx.fillStyle=`rgba(255,180,60,${0.80*pulse})`;
      ctx.font=`${U(7)}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillText('NM',dx+7,dy-4);
    } else {
      ctx.strokeStyle=`rgba(60,180,160,${0.45*pulse})`;
      ctx.lineWidth=1;
      doodleCircle(dx,dy,4,1);
      ctx.strokeStyle=`rgba(60,180,160,${0.20*pulse})`;
      doodleCircle(dx,dy,wScale(d.r||20),0.8);
    }
  }

  // ── Torpedoes + wire lines + seeker cones ────────────────────────────────
  drawTorpedoes(ctx, w2s, wScale, doodleLine, doodleText, doodleCircle, U, drawTorpedoTopDown, plotW, plotH);

  // ── ASROC rockets ────────────────────────────────────────────────────────
  drawASROC(ctx, w2s, doodleLine, doodleText, U, plotW, plotH);

  // ── Cruise missiles ───────────────────────────────────────────────────────
  drawCruiseMissiles(ctx, w2s, doodleLine, doodleText, U, plotW, plotH);

  // ── Depth charges ─────────────────────────────────────────────────────────
  drawDepthCharges(ctx, w2s, doodleText, U, plotW, plotH);

  // ── Wire-fed contacts ─────────────────────────────────────────────────────
  drawWireContacts(ctx, w2s, doodleText, doodleCircle, U, plotW);

  // ── CWIS tracers ──────────────────────────────────────────────────────────
  drawCWISTracers(ctx, w2s, wScale);

  // ── Particles ─────────────────────────────────────────────────────────────
  for(const p of particles){
    const [px2,py2]=w2s(p.x,p.y);
    const a=clamp(p.life/0.9,0,1);
    ctx.strokeStyle=`rgba(31,41,55,${0.28*a})`;
    doodleCircle(px2,py2,wScale(p.size*(0.5+0.8*(1-a))),1.5);
  }

  // ── Towed array cable ─────────────────────────────────────────────────────
  const [ppx,ppy]=w2s(player.wx,player.wy);
  {
    const ta=player.towedArray;
    const taVisible=ta&&ta.state!=='stowed'&&ta.state!=='destroyed';
    if(taVisible){
      const progress=ta.progress||0;
      const maxCableWU=800;
      const cableWU=maxCableWU*progress;
      const cableR=ta.state==='operational'?'20,184,166'
                  :ta.state==='damaged'?'217,119,6'
                  :'60,80,80';
      const sternOff = 5.5;
      const sternAng = player.heading + Math.PI;
      const sternWX = player.wx + Math.cos(sternAng)*sternOff;
      const sternWY = player.wy + Math.sin(sternAng)*sternOff;

      const trail = player._cableTrail||[];
      const pathPts = [{wx:sternWX, wy:sternWY}];
      let accumulated = 0;
      let endWX = sternWX, endWY = sternWY;

      for(let i=0; i<trail.length; i++){
        const prev = pathPts[pathPts.length-1];
        const pt   = trail[i];
        let dx = pt.wx - prev.wx;
        if(dx >  world.w/2) dx -= world.w;
        if(dx < -world.w/2) dx += world.w;
        const dy = pt.wy - prev.wy;
        const seg = Math.hypot(dx, dy);
        if(accumulated + seg >= cableWU){
          const frac = (cableWU - accumulated) / Math.max(seg, 0.001);
          endWX = prev.wx + dx*frac;
          endWY = prev.wy + dy*frac;
          pathPts.push({wx:endWX, wy:endWY});
          break;
        }
        accumulated += seg;
        endWX = pt.wx; endWY = pt.wy;
        pathPts.push(pt);
        if(accumulated >= cableWU) break;
      }

      if(pathPts.length < 2){
        endWX = sternWX + Math.cos(sternAng)*cableWU;
        endWY = sternWY + Math.sin(sternAng)*cableWU;
        pathPts.push({wx:endWX, wy:endWY});
      }

      const screenPts = pathPts.map(p => w2s(p.wx, p.wy));
      const totalSegs = screenPts.length - 1;
      const sensorStartIdx = Math.floor(screenPts.length * 0.70);

      for(let i=0; i<Math.min(sensorStartIdx+1, screenPts.length-1); i++){
        const t = totalSegs > 1 ? i / totalSegs : 0;
        const alpha = 0.18 - t * 0.13;
        ctx.strokeStyle = `rgba(17,24,39,${alpha.toFixed(2)})`;
        ctx.lineWidth = 0.8;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(screenPts[i][0], screenPts[i][1]);
        ctx.lineTo(screenPts[i+1][0], screenPts[i+1][1]);
        ctx.stroke();
      }

      if(progress > 0.5 && screenPts.length >= 2){
        ctx.strokeStyle = `rgba(${cableR},0.80)`;
        ctx.lineWidth = 2.2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(screenPts[sensorStartIdx][0], screenPts[sensorStartIdx][1]);
        for(let i=sensorStartIdx+1; i<screenPts.length; i++){
          ctx.lineTo(screenPts[i][0], screenPts[i][1]);
        }
        ctx.stroke();
        ctx.strokeStyle = `rgba(${cableR},0.35)`;
        ctx.lineWidth = 4;
        ctx.setLineDash([2, 5]);
        ctx.beginPath();
        ctx.moveTo(screenPts[sensorStartIdx][0], screenPts[sensorStartIdx][1]);
        for(let i=sensorStartIdx+1; i<screenPts.length; i++){
          ctx.lineTo(screenPts[i][0], screenPts[i][1]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if(progress > 0.95){
        const [cex,cey] = w2s(endWX, endWY);
        const crossR = U(4);
        ctx.strokeStyle = `rgba(${cableR},0.85)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cex-crossR, cey); ctx.lineTo(cex+crossR, cey);
        ctx.moveTo(cex, cey-crossR); ctx.lineTo(cex, cey+crossR);
        ctx.stroke();

        if(ta.state==='damaged'){
          ctx.fillStyle=`rgba(217,119,6,0.85)`;
          doodleText('▲ DEGRADED', cex+U(7), cey-U(4), U(7), 'left');
        } else {
          ctx.fillStyle=`rgba(${cableR},0.65)`;
          doodleText('[T]', cex+U(7), cey+U(3), U(7), 'left');
        }
      }

      if(ta.state==='deploying'||ta.state==='retracting'){
        const pct=ta.progress||0;
        const [cex,cey] = w2s(endWX, endWY);
        ctx.fillStyle='rgba(17,24,39,0.38)';
        doodleText(
          ta.state==='deploying'?`ARRAY ↓ ${Math.round((1-pct)*30)}s`:`ARRAY ↑ ${Math.round(pct*20)}s`,
          cex+U(8), cey, U(7), 'left'
        );
      }
    }
  }

  // ── Hull sonar geometry overlay ──────────────────────────────────────────
  {
    const heading=player.heading||0;
    const sg=C.player.sonar||{};
    const baffleBase=(sg.baffleHalfAngleDegBase??15)*Math.PI/180;
    const baffleMax =(sg.baffleHalfAngleDegMax ??45)*Math.PI/180;
    const baffleHalf=clamp(baffleBase+(player.speed||0)*(sg.baffleHalfAngleDegPerKt??1.5)*Math.PI/180,baffleBase,baffleMax);
    const rolloff   =(sg.baffleRolloffDeg??20)*Math.PI/180;
    const stern     =heading+Math.PI;
    const deadLen   =wScale(900);
    const speedRatio=clamp(((player.speed||0)-4)/10,0,1);

    ctx.save();
    ctx.globalAlpha=0.04+speedRatio*0.04;
    ctx.fillStyle='rgba(17,24,39,1)';
    ctx.beginPath();
    ctx.moveTo(ppx,ppy);
    ctx.arc(ppx,ppy,deadLen,stern-(baffleHalf+rolloff),stern+(baffleHalf+rolloff));
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha=0.07+speedRatio*0.06;
    ctx.fillStyle='rgba(17,24,39,1)';
    ctx.beginPath();
    ctx.moveTo(ppx,ppy);
    ctx.arc(ppx,ppy,deadLen,stern-baffleHalf,stern+baffleHalf);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if(speedRatio>0.15){
      const amberA=0.18+speedRatio*0.35;
      ctx.strokeStyle=`rgba(217,119,6,${amberA})`;
      ctx.lineWidth=1;
      ctx.setLineDash([4,5]);
      const edgeLen=wScale(650);
      ctx.beginPath();
      ctx.moveTo(ppx,ppy);
      ctx.lineTo(ppx+Math.cos(stern-baffleHalf)*edgeLen,ppy+Math.sin(stern-baffleHalf)*edgeLen);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ppx,ppy);
      ctx.lineTo(ppx+Math.cos(stern+baffleHalf)*edgeLen,ppy+Math.sin(stern+baffleHalf)*edgeLen);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if(speedRatio>0.10){
      const dlx=ppx+Math.cos(stern)*wScale(200);
      const dly=ppy+Math.sin(stern)*wScale(200);
      ctx.fillStyle=`rgba(217,119,6,${0.25+speedRatio*0.35})`;
      doodleText('HULL',dlx,dly,U(7),'center');
    }
  }

  // ── Player sub ────────────────────────────────────────────────────────────
  ctx.strokeStyle=(player.invuln>0)?'rgba(17,24,39,0.40)':'#111827';
  ctx.save();
  ctx.translate(ppx,ppy);
  ctx.rotate(player.heading);
  drawPlayerTopDown();
  ctx.restore();

  ctx.strokeStyle='rgba(17,24,39,0.12)';
  ctx.lineWidth=1;
  const leadDist=wScale(400);
  ctx.beginPath();
  ctx.moveTo(ppx,ppy);
  ctx.lineTo(ppx+Math.cos(player.heading)*leadDist, ppy+Math.sin(player.heading)*leadDist);
  ctx.stroke();

  // ── Torpedo aim overlay (shift held) ─────────────────────────────────────
  if(_I&&_I.shiftHeld){
    const [ppx2,ppy2]=w2s(player.wx,player.wy);
    const aimDx=_I.aimWorldX-player.wx;
    const aimDy=_I.aimWorldY-player.wy;
    const aimAng=Math.atan2(aimDy,aimDx);
    const aimLen=wScale(C.player.torpWireMaxRange*0.65);

    const offset=Math.abs(angleNorm(aimAng-player.heading));
    const safeArc=(C.player.torpArcDeg||55)*Math.PI/180;
    const wireRisk=offset<=safeArc?0:Math.pow(Math.min(1,(offset-safeArc)/(Math.PI-safeArc)),2)*0.98;

    const r=Math.round(lerp(17,220,wireRisk));
    const g=Math.round(lerp(100,38,wireRisk));
    const b2=Math.round(lerp(39,38,wireRisk));
    const lineCol=`rgba(${r},${g},${b2},0.70)`;

    ctx.strokeStyle=lineCol;
    ctx.lineWidth=1.5;
    ctx.setLineDash([5,5]);
    ctx.beginPath(); ctx.moveTo(ppx2,ppy2);
    ctx.lineTo(ppx2+Math.cos(aimAng)*aimLen, ppy2+Math.sin(aimAng)*aimLen);
    ctx.stroke(); ctx.setLineDash([]);

    ctx.strokeStyle='rgba(17,100,39,0.18)';
    ctx.lineWidth=1;
    const arcLineLen=wScale(600);
    ctx.beginPath();
    ctx.moveTo(ppx2,ppy2);
    ctx.lineTo(ppx2+Math.cos(player.heading-safeArc/2)*arcLineLen, ppy2+Math.sin(player.heading-safeArc/2)*arcLineLen);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ppx2,ppy2);
    ctx.lineTo(ppx2+Math.cos(player.heading+safeArc/2)*arcLineLen, ppy2+Math.sin(player.heading+safeArc/2)*arcLineLen);
    ctx.stroke();

    const bearDeg=((aimAng*180/Math.PI)+360)%360;
    ctx.fillStyle=lineCol;
    const riskLabel=wireRisk<=0?'WIRE OK':wireRisk<0.4?'WIRE RISK':wireRisk<0.75?'WIRE LIKELY CUT':'WIRE WILL CUT';
    doodleText(`TDC ${Math.round(bearDeg).toString().padStart(3,'0')}°  ${riskLabel}`,
      ppx2+U(12), ppy2-U(8), U(10),'left');
    if(player.torpCd>0){
      ctx.fillStyle='rgba(220,38,38,0.65)';
      doodleText(`CD ${player.torpCd.toFixed(1)}s`,ppx2+U(12),ppy2+U(6),U(9),'left');
    }
  }

  // ── Wreck markers ─────────────────────────────────────────────────────────
  if(wrecks){
    for(const w of wrecks){
      const [wx2,wy2]=w2s(w.x,w.y);
      if(wx2<-20||wx2>plotW+20) continue;
      ctx.save();
      ctx.translate(wx2,wy2);
      const sz=wScale(w.type==='boat'?12:10);
      ctx.strokeStyle='rgba(100,20,20,0.55)';
      ctx.lineWidth=1.5;
      ctx.beginPath();
      ctx.moveTo(-sz,-sz); ctx.lineTo(sz,sz);
      ctx.moveTo(sz,-sz);  ctx.lineTo(-sz,sz);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(0,0,sz*1.3,0,TAU); ctx.stroke();
      ctx.fillStyle='rgba(100,20,20,0.55)';
      const age=Math.floor((session.missionT||0)-w.t);
      const mm=Math.floor(age/60).toString().padStart(2,'0');
      const ss=(age%60).toString().padStart(2,'0');
      doodleText(`KIA T-${mm}:${ss}`,sz*1.5+U(2),U(2),U(8),'left');
      ctx.restore();
    }
  }

  // ── Sonobuoy markers ─────────────────────────────────────────────────────
  if(buoys){
    for(const b of buoys){
      const [bx,by]=w2s(b.x,b.y);
      if(bx<-20||bx>plotW+20) continue;
      const sz=wScale(5);
      if(b.pingPulse>0){
        const pulseR=sz+wScale(18)*(1-b.pingPulse);
        ctx.strokeStyle=`rgba(60,160,255,${b.pingPulse*0.5})`;
        ctx.lineWidth=1.2;
        ctx.beginPath(); ctx.arc(bx,by,pulseR,0,TAU); ctx.stroke();
      }
      ctx.fillStyle=b.pingPulse>0?'rgba(60,160,255,0.7)':'rgba(60,130,200,0.45)';
      ctx.beginPath();
      ctx.moveTo(bx,by-sz); ctx.lineTo(bx+sz*0.6,by);
      ctx.lineTo(bx,by+sz); ctx.lineTo(bx-sz*0.6,by);
      ctx.closePath(); ctx.fill();
    }
  }

  // ── ASW Helicopter markers ───────────────────────────────────────────────
  for(const e of enemies){
    if(!e._helo || e._helo.state==='deck' || e.dead) continue;
    const h=e._helo;
    const [hx,hy]=w2s(h.x,h.y);
    if(hx<-20||hx>plotW+20) continue;
    const sz=wScale(7);
    if(h.state==='hover' && h.pingPulse>0){
      const pulseR=sz+wScale(25)*(1-h.pingPulse);
      ctx.strokeStyle=`rgba(255,180,40,${h.pingPulse*0.5})`;
      ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(hx,hy,pulseR,0,TAU); ctx.stroke();
    }
    const col=h.state==='hover'?'rgba(255,180,40,0.75)':'rgba(200,160,60,0.50)';
    ctx.fillStyle=col; ctx.strokeStyle=col;
    ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.arc(hx,hy,sz*0.55,0,TAU); ctx.fill();
    const rr=sz*1.2;
    const spin=(now()*4)%(Math.PI*2);
    ctx.beginPath();
    ctx.moveTo(hx+Math.cos(spin)*rr, hy+Math.sin(spin)*rr);
    ctx.lineTo(hx-Math.cos(spin)*rr, hy-Math.sin(spin)*rr);
    ctx.moveTo(hx+Math.cos(spin+Math.PI/2)*rr, hy+Math.sin(spin+Math.PI/2)*rr);
    ctx.lineTo(hx-Math.cos(spin+Math.PI/2)*rr, hy-Math.sin(spin+Math.PI/2)*rr);
    ctx.stroke();
    ctx.fillStyle=col;
    doodleText(h.state==='hover'?'DIP':'HELO',hx+sz*1.8,hy+U(2),U(7),'left');
  }

  // ── TDC intercept bearing line ──────────────────────────────────────────
  {
    const wp=ui.wepsProposal;
    const lineAng = wp ? wp.bearing : tdc.intercept;
    if(tdc.target && lineAng!=null){
      const [fpx,fpy]=w2s(player.wx,player.wy);
      const lineLen=wScale(tdc.range ?? 800);
      const ex=fpx+Math.cos(lineAng)*lineLen;
      const ey=fpy+Math.sin(lineAng)*lineLen;
      const frozen=tdc.frozen===true;
      const degraded=wp?.confidence==='degraded';
      const col=frozen?'rgba(180,60,60,0.45)':degraded?'rgba(146,64,14,0.50)':tdc.range?'rgba(30,58,95,0.45)':'rgba(146,64,14,0.40)';
      ctx.strokeStyle=col;
      ctx.lineWidth=1.5;
      ctx.setLineDash([8,6]);
      ctx.beginPath(); ctx.moveTo(fpx,fpy); ctx.lineTo(ex,ey); ctx.stroke();
      ctx.setLineDash([]);
      const arrLen=U(8);
      const arrAng=0.4;
      ctx.beginPath();
      ctx.moveTo(ex,ey);
      ctx.lineTo(ex-arrLen*Math.cos(lineAng-arrAng), ey-arrLen*Math.sin(lineAng-arrAng));
      ctx.moveTo(ex,ey);
      ctx.lineTo(ex-arrLen*Math.cos(lineAng+arrAng), ey-arrLen*Math.sin(lineAng+arrAng));
      ctx.stroke();
      const intDeg=(((Math.atan2(Math.cos(lineAng),-Math.sin(lineAng))*180/Math.PI)+360)%360);
      const confTag=wp?.confidence==='degraded'?' [DGR]':wp?.confidence==='bearingonly'?' [BRG]':'';
      ctx.fillStyle=col;
      doodleText((frozen?'[FROZEN] ':'')+`INT ${Math.round(intDeg).toString().padStart(3,'0')}°`+confTag,
        ex+U(4), ey-U(4), U(9),'left');
    }
  }

  // ── Depth strip ───────────────────────────────────────────────────────────
  drawDepthStrip(W,H,panelH);

  // ── Command Panel ─────────────────────────────────────────────────────────
  drawPanel(W,H);

  // ── Nav compass (after panel so btn2 registrations aren't cleared) ────────
  drawNavCompass(W,H,panelH);

  // ── Message log board
  drawLogPanel(W,H,panelH);

  // ── DC Comms overlay
  drawDcPanel(W,H,panelH);

  // ── Damage Control overlay
  drawDamagePanel(W,H,panelH);

  // ── Crew Manifest overlay
  drawCrewPanel(W,H,panelH);

  // ── Unified Damage/Crew full-screen panel
  drawDamageScreen(W,H);

  // ── Cursor distance label ─────────────────────────────────────────────────
  {
    const mx=_I?.mouseX??-1, my=_I?.mouseY??-1;
    const inChart=mx>=0 && mx<(W-STRIP_W) && my>=0 && my<(H-panelH);
    if(inChart){
      const mwx = cam.x + (mx - cx) / Z;
      const mwy = cam.y + (my - cy) / Z;
      let ddx = mwx - player.wx;
      if(ddx >  world.w/2) ddx -= world.w;
      if(ddx < -world.w/2) ddx += world.w;
      const ddy = mwy - player.wy;
      const distWU = Math.hypot(ddx, ddy);
      const distNM = distWU / 185.2;
      const distM  = distWU * 10;
      const brgRaw = Math.atan2(ddy, ddx);
      const brgDeg = (((Math.atan2(Math.cos(brgRaw), -Math.sin(brgRaw)) * 180/Math.PI) + 360) % 360);

      const distLabel = distNM >= 0.1
        ? `${distNM.toFixed(1)}nm`
        : `${Math.round(distM)}m`;
      const fullLabel = `${Math.round(brgDeg).toString().padStart(3,'0')}°  ${distLabel}`;

      ctx.strokeStyle='rgba(17,24,39,0.30)';
      ctx.lineWidth=1;
      const CR=U(6);
      ctx.beginPath();
      ctx.moveTo(mx-CR,my); ctx.lineTo(mx+CR,my);
      ctx.moveTo(mx,my-CR); ctx.lineTo(mx,my+CR);
      ctx.stroke();

      const [spx,spy]=w2s(player.wx,player.wy);
      ctx.strokeStyle='rgba(17,24,39,0.10)';
      ctx.lineWidth=1;
      ctx.setLineDash([4,5]);
      ctx.beginPath(); ctx.moveTo(spx,spy); ctx.lineTo(mx,my); ctx.stroke();
      ctx.setLineDash([]);

      const pad=U(5);
      ctx.font=`${U(9)}px ui-monospace,monospace`;
      ctx.textAlign='left';
      const tw=ctx.measureText(fullLabel).width;
      const lx=mx+U(10), ly=my-U(14);
      ctx.fillStyle='rgba(255,255,255,0.80)';
      ctx.beginPath();
      ctx.roundRect(lx-pad, ly-U(9), tw+pad*2, U(13), U(3));
      ctx.fill();
      ctx.fillStyle='rgba(17,24,39,0.85)';
      ctx.fillText(fullLabel, lx, ly);
    }
  }

  // ── Hit flash ─────────────────────────────────────────────────────────────
  if(session.hitFlash>0){
    ctx.fillStyle=`rgba(180,20,20,${session.hitFlash*0.35})`;
    ctx.fillRect(0,0,W,H);
    const dmg=player.damage;
    if(dmg?.alerts?.length>0){
      const a=dmg.alerts[dmg.alerts.length-1];
      const alpha=clamp(a.t/1.5,0,1);
      ctx.fillStyle=`rgba(220,38,38,${alpha*0.90})`;
      ctx.font=`bold ${U(13)}px ui-monospace,monospace`;
      ctx.textAlign='center';
      ctx.fillText(a.text, W/2, H-panelH-U(30));
    }
  }

  // ── Free-cam indicator ────────────────────────────────────────────────────
  if(cam.free){
    ctx.save();
    ctx.fillStyle='rgba(217,119,6,0.90)';
    ctx.font=`bold ${U(9)}px ui-monospace,monospace`;
    ctx.textAlign='left';
    ctx.fillText('FREE CAM  —  Home to re-centre', U(12), U(16));
    const [ppx2,ppy2]=w2s(player.wx,player.wy);
    const onScreen=ppx2>=0&&ppx2<=plotW&&ppy2>=0&&ppy2<=(H-panelH);
    if(!onScreen){
      const ax=clamp(ppx2,U(20),plotW-U(20));
      const ay=clamp(ppy2,U(20),(H-panelH)-U(20));
      ctx.strokeStyle='rgba(217,119,6,0.85)';
      ctx.fillStyle='rgba(217,119,6,0.85)';
      ctx.lineWidth=1.5;
      doodleCircle(ax,ay,U(7),1.5);
      ctx.font=`${U(7)}px ui-monospace,monospace`;
      ctx.textAlign='center';
      ctx.fillText('YOU',ax,ay+U(3));
    } else {
      ctx.strokeStyle='rgba(217,119,6,0.55)';
      ctx.lineWidth=1.5;
      ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.arc(ppx2,ppy2,U(14),0,Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  // ── DEBUG overlay ────────────────────────────────────────────────────────
  if(session.debugOverlay){
    ctx.save();
    for(const e of enemies){
      if(e.dead) continue;
      const [ex,ey]=w2s(e.x,e.y);
      if(ex<-40||ex>plotW+40) continue;
      const r=U(10);
      ctx.strokeStyle='rgba(255,0,220,0.85)';
      ctx.lineWidth=1.5;
      ctx.beginPath();
      ctx.moveTo(ex-r,ey); ctx.lineTo(ex+r,ey);
      ctx.moveTo(ex,ey-r); ctx.lineTo(ex,ey+r);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(ex,ey,r*0.45,0,Math.PI*2); ctx.stroke();
      const spd=Math.round(Math.hypot(e.vx||0,e.vy||0));
      const sus=Math.round((e.suspicion||0)*100);
      const role=e.role?` [${e.role.slice(0,3).toUpperCase()}]`:'';
      const noisePart=session.debugNoise
        ?` n=${(e.noise??0).toFixed(2)}(f=${(e._noiseFloor??0).toFixed(2)})`:'';
      const label=`${e.type.toUpperCase()}${role} ${spd}kt sus${sus}%${noisePart}`;
      ctx.font=`${U(8)}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillStyle='rgba(255,0,220,0.90)';
      ctx.fillText(label, ex+r+U(3), ey+U(3));
    }
    for(const b of bullets){
      if(b.kind!=='torpedo'||b.life<=0) continue;
      const [tx,ty]=w2s(b.x,b.y);
      if(tx<-40||tx>plotW+40) continue;
      const isFriendly=b.friendly;
      const col=isFriendly?'rgba(0,230,255,0.90)':'rgba(255,140,0,0.90)';
      ctx.strokeStyle=col; ctx.fillStyle=col;
      ctx.lineWidth=1.5;
      const bvx=b.vx||0, bvy=b.vy||0;
      const bspd=Math.hypot(bvx,bvy);
      const bAng=bspd>0?Math.atan2(bvy,bvx):0;
      const ar=U(12);
      ctx.beginPath();
      ctx.moveTo(tx-Math.cos(bAng)*ar, ty-Math.sin(bAng)*ar);
      ctx.lineTo(tx+Math.cos(bAng)*ar, ty+Math.sin(bAng)*ar);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(tx+Math.cos(bAng)*ar,ty+Math.sin(bAng)*ar,U(3),0,Math.PI*2); ctx.fill();
      const tLabel=`${isFriendly?'OWN':'ENM'} ${b.torpId||'?'} d${Math.round(b.depth||0)}m${b.target===player?' ●HOM':''}`;
      ctx.font=`${U(7.5)}px ui-monospace,monospace`; ctx.textAlign='left';
      ctx.fillText(tLabel, tx+ar+U(3), ty+U(3));
    }

    ctx.fillStyle='rgba(255,0,220,0.80)';
    ctx.font=`bold ${U(9)}px ui-monospace,monospace`;
    ctx.textAlign='left';
    ctx.fillText('[ DEBUG ] TRUE POS + TORPEDOES', U(12), (H-panelH)-U(10));

    drawThreatBar(W);

    ctx.restore();
  }

  // ── Victory pending — enemy torps still running ───────────────────────────
  if(session.won){
    const enemyTorps = bullets.filter(b => b.kind==='torpedo' && !b.friendly && b.life>0);
    const pulse = 0.65 + 0.35*Math.sin(performance.now()*0.004);
    ctx.fillStyle=`rgba(20,200,120,${0.85*pulse})`;
    ctx.font=`bold ${U(11)}px ui-monospace,monospace`;
    ctx.textAlign='center';
    ctx.fillText(`MISSION COMPLETE — ${enemyTorps.length} INBOUND — HOLD ON`,(W-STRIP_W)/2,U(48));
  }

  // ── UI Scale indicator ──────────────────────────────────────────────────
  {
    const scale = _UI_SCALE?.getScale() || 1.0;
    if(scale !== 1.0){
      const label = `UI ${Math.round(scale*100)}%`;
      ctx.fillStyle='rgba(17,24,39,0.30)';
      ctx.font=`${U(8)}px ui-monospace,monospace`;
      ctx.textAlign='right';
      ctx.fillText(label, W-STRIP_W-U(8), H-panelH-U(8));
    }
  }
}

// ════════════════════════════════════════════════════════════════════════
// EXPORT
// ════════════════════════════════════════════════════════════════════════
export { draw };
