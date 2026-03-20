// render-hud.js — depth strip (right side), threat bar (top), nav compass
'use strict';

import { CONFIG } from '../config/constants.js';
import { clamp } from '../utils/math.js';
import { world, player, bullets, sonarContacts, enemies } from '../state/sim-state.js';
import { THEME } from '../ui/theme.js';

const C = CONFIG;
const TH = THEME;

// ── Lazy bindings ────────────────────────────────────────────────────────
let _ctx = null;
let _DPR = 1;
let _R = null;
let _PANEL = null;

export function _bindRenderHud(deps) {
  if (deps.ctx) _ctx = deps.ctx;
  if (deps.DPR != null) _DPR = deps.DPR;
  if (deps.R) _R = deps.R;
  if (deps.PANEL) _PANEL = deps.PANEL;
}

// ── Depth strip (right side) ──────────────────────────────────────────────────
function drawDepthStrip(W,H,panelH){
  const ctx = _ctx;
  const {doodleText,doodleCircle,STRIP_W,U} = _R;
  panelH = panelH || U(54);
  const stripW=STRIP_W;
  const stripX=W-stripW;
  const padT=U(72), padB=U(52);
  const stripH=H-panelH-padT-padB;

  ctx.fillStyle=TH.color.bg.depthStrip;
  ctx.fillRect(stripX,0,stripW,H-panelH);
  ctx.strokeStyle=TH.color.border.medium;
  ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(stripX,0); ctx.lineTo(stripX,H); ctx.stroke();

  ctx.fillStyle='rgba(17,24,39,0.5)';
  doodleText('DEPTH',stripX+stripW/2,padT-U(18),U(9),'center');

  const playerD=player.depth||0;
  const halfWin=400;
  let winTop=Math.max(0, playerD-halfWin);
  let winBot=Math.min(world.ground, playerD+halfWin);
  if(winBot-winTop<800){
    if(winTop===0) winBot=Math.min(world.ground,800);
    else winTop=Math.max(0,winBot-800);
  }
  const winRange=winBot-winTop;

  function dToY(d){ return padT+clamp((d-winTop)/winRange,0,1)*stripH; }

  // Layer band
  const ly1=dToY(world.layerY1), ly2=dToY(world.layerY2);
  if(ly2>padT && ly1<padT+stripH){
    ctx.fillStyle='rgba(99,102,241,0.09)';
    ctx.fillRect(stripX,Math.max(padT,ly1),stripW,Math.min(padT+stripH,ly2)-Math.max(padT,ly1));
    if(ly1>=padT&&ly1<=padT+stripH){
      ctx.strokeStyle='rgba(99,102,241,0.35)';
      ctx.lineWidth=1;
      ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.moveTo(stripX,ly1); ctx.lineTo(W,ly1); ctx.stroke();
      ctx.setLineDash([]);
      doodleText('LAYER',stripX+4,ly1-3,U(7),'left');
    }
  }

  // Seabed
  const groundY=dToY(world.ground);
  if(groundY<padT+stripH+2){
    ctx.fillStyle='rgba(17,24,39,0.10)';
    ctx.fillRect(stripX,groundY,stripW,(padT+stripH)-groundY+2);
    ctx.strokeStyle='rgba(17,24,39,0.30)';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(stripX,groundY); ctx.lineTo(W,groundY); ctx.stroke();
    doodleText('SEABED',stripX+4,groundY-3,U(7),'left');
  }

  // Depth tick marks
  ctx.strokeStyle='rgba(17,24,39,0.15)';
  ctx.fillStyle='rgba(17,24,39,0.38)';
  const tickStep=50;
  const labelStep=100;
  const firstTick=Math.ceil(winTop/tickStep)*tickStep;
  for(let d=firstTick;d<=winBot;d+=tickStep){
    const ty=dToY(d);
    const isMajor=(d%labelStep===0);
    ctx.lineWidth=isMajor?1.2:0.7;
    ctx.beginPath();
    ctx.moveTo(stripX,ty);
    ctx.lineTo(stripX+(isMajor?U(10):U(5)),ty);
    ctx.stroke();
    if(isMajor) doodleText(d+'m',stripX+U(12),ty+4,U(8),'left');
  }

  // Contacts on strip
  const labelX=stripX+stripW-U(4);
  const barX=stripX+U(38);

  for(const [e,sc] of sonarContacts){
    if((e.detectedT||0)<=0 && (sc.activeT||0)<=0) continue;
    const tmaQ=sc.tmaQuality||0;
    if(tmaQ<0.35) continue;
    const d2=sc._estDepth;
    if(d2==null) continue;
    if(d2<winTop-60||d2>winBot+60) continue;
    const ty=dToY(d2);
    const stale=(sc.activeT||0)<=0;
    const uncertain=tmaQ<0.70;
    ctx.strokeStyle=stale?'rgba(17,24,39,0.25)':uncertain?'rgba(17,24,39,0.40)':'rgba(17,24,39,0.70)';
    ctx.fillStyle=stale?'rgba(17,24,39,0.22)':uncertain?'rgba(17,24,39,0.35)':'rgba(17,24,39,0.70)';
    ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(stripX,ty); ctx.lineTo(barX+U(4),ty); ctx.stroke();
    doodleText(uncertain?'○':'●',barX,ty+3,U(9),'right');
    doodleText(sc.id||'?',labelX,ty+4,U(8),'right');
  }

  // Torpedoes
  for(const b of bullets){
    if(b.kind!=='torpedo'||b.life<=0||b.depth==null) continue;
    if(!b.friendly && !b._alertedPlayer) continue;
    if(b.depth<winTop-60||b.depth>winBot+60) continue;
    const ty=dToY(b.depth);
    const seduced=!!b.seducedBy;
    let col;
    if(seduced)           col=TH.color.contact.seduced;
    else if(b.friendly)   col=TH.color.contact.friendly;
    else                  col=TH.color.contact.enemy;

    ctx.strokeStyle=col;
    ctx.fillStyle=col;
    ctx.lineWidth=1.5;
    const aw=U(6), ah=U(4);
    ctx.beginPath();
    ctx.moveTo(barX-aw,ty-ah);
    ctx.lineTo(barX,ty);
    ctx.lineTo(barX-aw,ty+ah);
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(stripX,ty); ctx.lineTo(barX-aw,ty); ctx.stroke();
    doodleText(b.torpId||'T?',labelX,ty-2,U(8),'right');
    doodleText(Math.round(b.depth)+'m',labelX,ty+8,U(7),'right');
  }

  // Player
  const pd=dToY(playerD);
  ctx.fillStyle=TH.color.text.primary;
  ctx.beginPath();
  ctx.moveTo(stripX,pd);
  ctx.lineTo(stripX+U(16),pd-U(7));
  ctx.lineTo(stripX+U(16),pd+U(7));
  ctx.closePath(); ctx.fill();

  // Ordered depth
  const od=dToY(player.depthOrder);
  if(od>padT-4&&od<padT+stripH+4){
    ctx.strokeStyle='rgba(17,24,39,0.28)';
    ctx.setLineDash([3,4]);
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(stripX+U(16),od); ctx.lineTo(W,od); ctx.stroke();
    ctx.setLineDash([]);
    doodleText('ORD',stripX+U(18),od-3,U(7),'left');
  }

  ctx.fillStyle=TH.color.text.primary;
  doodleText(Math.round(playerD)+'m', W-4, H-panelH-U(18), U(TH.font.value),'right');
  ctx.fillStyle=TH.color.text.muted;
  doodleText('→'+Math.round(player.depthOrder)+'m', W-4, H-panelH-U(6), U(TH.font.label),'right');

  ctx.fillStyle='rgba(17,24,39,0.28)';
  doodleText(Math.round(winTop)+'–'+Math.round(winBot)+'m', stripX+stripW/2, padT-U(6), U(8),'center');
}

// ── Threat bar (top) ──────────────────────────────────────────────────────────
function drawThreatBar(W){
  const ctx = _ctx;
  const {doodleText,STRIP_W,U} = _R;
  let maxSus=0;
  for(const e of enemies) maxSus=Math.max(maxSus,e.suspicion||0);
  const state=maxSus>C.enemy.susEngage?'ALERT':maxSus>C.enemy.susInvestigate?'SEARCH':'CLEAR';
  const col=state==='ALERT'?TH.color.threat.alert:state==='SEARCH'?TH.color.threat.search:TH.color.threat.clear;
  const stripW=STRIP_W;

  ctx.fillStyle=TH.color.bg.threatBar;
  ctx.fillRect(0,0,W-stripW,U(28));
  ctx.strokeStyle=TH.color.border.light;
  ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(0,U(28)); ctx.lineTo(W-stripW,U(28)); ctx.stroke();

  ctx.fillStyle=col+'33';
  ctx.fillRect(0,0,(W-stripW)*clamp(maxSus,0,1),U(28));

  ctx.fillStyle=col;
  doodleText(state,(W-stripW)/2,U(19),U(11),'center');
}

// ── Nav Compass (top-right, left of depth strip) ─────────────────────────────
function drawNavCompass(W,H,panelH){
  const ctx = _ctx;
  const {doodleText,doodleCircle,STRIP_W,U} = _R;
  panelH = panelH || U(54);
  const stripW=STRIP_W;
  const radius=U(65);
  const cx=W-stripW-radius-U(50);
  const cy=U(72)+radius+U(10);

  const heading=player.heading||0;
  const compassDeg=((Math.atan2(Math.cos(heading),-Math.sin(heading))*180/Math.PI)+360)%360;
  const compassRad=compassDeg*Math.PI/180;

  ctx.save();
  ctx.fillStyle='rgba(6,14,30,0.75)';
  ctx.beginPath(); ctx.arc(cx,cy,radius+U(4),0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(80,120,200,0.25)';
  ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.arc(cx,cy,radius+U(4),0,Math.PI*2); ctx.stroke();

  ctx.strokeStyle='rgba(80,120,200,0.12)';
  ctx.lineWidth=1;
  ctx.beginPath(); ctx.arc(cx,cy,radius-U(12),0,Math.PI*2); ctx.stroke();

  for(let d=0;d<360;d+=10){
    const ang=d*Math.PI/180 - Math.PI/2;
    const isMajor=(d%30===0);
    const isCardinal=(d%90===0);
    const outerR=radius-U(2);
    const innerR=isCardinal?radius-U(18):isMajor?radius-U(14):radius-U(9);
    ctx.strokeStyle=isCardinal?'rgba(200,225,255,0.90)':isMajor?'rgba(200,225,255,0.55)':'rgba(200,225,255,0.25)';
    ctx.lineWidth=isCardinal?2:isMajor?1.2:0.8;
    ctx.beginPath();
    ctx.moveTo(cx+Math.cos(ang)*innerR, cy+Math.sin(ang)*innerR);
    ctx.lineTo(cx+Math.cos(ang)*outerR, cy+Math.sin(ang)*outerR);
    ctx.stroke();
  }

  const cardinals=[{d:0,l:'N'},{d:90,l:'E'},{d:180,l:'S'},{d:270,l:'W'}];
  const labelR=radius-U(24);
  ctx.fillStyle='rgba(200,225,255,0.90)';
  ctx.font=`bold ${U(11)}px ui-monospace,monospace`;
  ctx.textAlign='center';
  for(const c2 of cardinals){
    const ang=c2.d*Math.PI/180 - Math.PI/2;
    ctx.fillText(c2.l, cx+Math.cos(ang)*labelR, cy+Math.sin(ang)*labelR+U(4));
  }

  const arrowAng=compassRad - Math.PI/2;
  const arrowLen=radius-U(20);
  const arrowTailLen=U(14);
  const arrowTipX=cx+Math.cos(arrowAng)*arrowLen;
  const arrowTipY=cy+Math.sin(arrowAng)*arrowLen;
  const arrowTailX=cx-Math.cos(arrowAng)*arrowTailLen;
  const arrowTailY=cy-Math.sin(arrowAng)*arrowTailLen;

  ctx.strokeStyle='rgba(220,60,60,0.90)';
  ctx.lineWidth=2.5;
  ctx.beginPath();
  ctx.moveTo(arrowTailX,arrowTailY);
  ctx.lineTo(arrowTipX,arrowTipY);
  ctx.stroke();

  ctx.fillStyle='rgba(220,60,60,0.90)';
  ctx.save();
  ctx.translate(arrowTipX,arrowTipY);
  ctx.rotate(arrowAng+Math.PI/2);
  ctx.beginPath();
  ctx.moveTo(0,-U(8));
  ctx.lineTo(-U(5),U(2));
  ctx.lineTo(U(5),U(2));
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle='rgba(200,225,255,0.50)';
  ctx.beginPath(); ctx.arc(cx,cy,U(3),0,Math.PI*2); ctx.fill();

  const ordHdg=player.orderedHeading;
  if(ordHdg!=null){
    const ordDiff=Math.abs(((ordHdg-compassDeg+540)%360)-180);
    if(ordDiff>0.5){
      const ordAng=ordHdg*Math.PI/180 - Math.PI/2;

      const curAng=compassDeg*Math.PI/180 - Math.PI/2;
      const arcR=radius-U(6);
      let delta=((ordHdg-compassDeg+540)%360)-180;
      ctx.strokeStyle='rgba(20,220,180,0.55)';
      ctx.lineWidth=2;
      ctx.setLineDash([U(4),U(4)]);
      ctx.beginPath();
      ctx.arc(cx,cy,arcR,curAng,ordAng,delta<0);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle='rgba(20,220,180,0.65)';
      ctx.lineWidth=2;
      ctx.setLineDash([U(3),U(3)]);
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.lineTo(cx+Math.cos(ordAng)*(radius-U(4)), cy+Math.sin(ordAng)*(radius-U(4)));
      ctx.stroke();
      ctx.setLineDash([]);

      const markerR=radius+U(1);
      ctx.fillStyle='rgba(20,220,180,0.90)';
      ctx.save();
      ctx.translate(cx+Math.cos(ordAng)*markerR, cy+Math.sin(ordAng)*markerR);
      ctx.rotate(ordAng+Math.PI/2);
      ctx.beginPath();
      ctx.moveTo(0,-U(8));
      ctx.lineTo(-U(5),0);
      ctx.lineTo(U(5),0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // Navigation buttons
  const btnW=U(38), btnH=U(22);
  const btnGap=U(4);
  const btnColor='rgba(30,58,95,0.55)';

  const portX=cx-radius-U(8)-btnW;
  const portY1=cy-btnH-btnGap/2;
  const portY2=cy+btnGap/2;
  _PANEL?.btn2(ctx,'10\u00B0 P',portX,portY1,btnW,btnH,btnColor,()=>_PANEL?.courseStep(-10));
  _PANEL?.btn2(ctx,'1\u00B0 P',portX,portY2,btnW,btnH,btnColor,()=>_PANEL?.courseStep(-1));

  const stbdX=cx+radius+U(8);
  _PANEL?.btn2(ctx,'10\u00B0 S',stbdX,portY1,btnW,btnH,btnColor,()=>_PANEL?.courseStep(10));
  _PANEL?.btn2(ctx,'1\u00B0 S',stbdX,portY2,btnW,btnH,btnColor,()=>_PANEL?.courseStep(1));

  const depBtnW=U(34), depBtnH=U(20);
  const aboveX=cx-depBtnW/2;
  const aboveY=cy-radius-U(30);
  _PANEL?.btn2(ctx,'\u25B2',aboveX,aboveY,depBtnW,depBtnH,btnColor,()=>_PANEL?.depthStep(-10));

  // Readouts
  const readoutH=U(66);
  const readoutY0=cy+radius+U(8);
  ctx.fillStyle='rgba(6,14,30,0.65)';
  ctx.beginPath();
  ctx.roundRect(cx-U(80), readoutY0, U(160), readoutH, U(4));
  ctx.fill();

  const lineH=U(14);
  let ry=readoutY0+U(14);
  ctx.textAlign='center';

  ctx.fillStyle='rgba(200,225,255,0.90)';
  ctx.font=`bold ${U(11)}px ui-monospace,monospace`;
  let hdgText='CRS '+Math.round(compassDeg).toString().padStart(3,'0')+'\u00B0';
  if(ordHdg!=null){
    const ordDiff2=Math.abs(((ordHdg-compassDeg+540)%360)-180);
    if(ordDiff2>0.5) hdgText+='\u2002\u2192\u2002'+Math.round(ordHdg).toString().padStart(3,'0')+'\u00B0';
  }
  ctx.fillText(hdgText, cx, ry);
  ry+=lineH;

  const spdNow=Math.round(player.speed||0);
  const spdOrd=Math.round(player.speedOrderKts||0);
  ctx.fillStyle='rgba(200,225,255,0.75)';
  ctx.font=`${U(10)}px ui-monospace,monospace`;
  ctx.fillText('SPD '+spdNow+'kt  \u2192  '+spdOrd+'kt', cx, ry);
  ry+=lineH;

  const dNow=Math.round(player.depth||0);
  const dOrd=Math.round(player.depthOrder??player.depth??0);
  ctx.fillText('DEP '+dNow+'m  \u2192  '+dOrd+'m', cx, ry);
  ry+=lineH;

  const batPct=Math.round((player.battery??1.0)*100);
  const isDiesel=C.player.isDiesel||false;
  const batCol=batPct<20?'rgba(220,60,60,0.90)':batPct<50?'rgba(220,160,60,0.90)':'rgba(200,225,255,0.75)';
  ctx.fillStyle=batCol;
  ctx.font=`${U(10)}px ui-monospace,monospace`;
  const snrkSuffix=player.snorkeling?' SNKL':isDiesel&&player.snorkelOrdered?' RISG':'';
  const battLabel=isDiesel?`BATT ${batPct}%${snrkSuffix}`:`BATT ${batPct}%${player.scram?' SCRAM':''}`;
  ctx.fillText(battLabel, cx, ry);

  const belowY=readoutY0+readoutH+U(4);
  _PANEL?.btn2(ctx,'\u25BC',aboveX,belowY,depBtnW,depBtnH,btnColor,()=>_PANEL?.depthStep(10));

  ctx.restore();
}

// ════════════════════════════════════════════════════════════════════════
// EXPORT (mirrors V1 window.RHUD shape)
// ════════════════════════════════════════════════════════════════════════
export const RHUD = {drawDepthStrip,drawThreatBar,drawNavCompass};
