// render-hud.js — depth strip (right side) and threat bar (top)
// Exposes window.RHUD: { drawDepthStrip, drawThreatBar }
// Requires window.R (render-utils.js) to be loaded first.
(() => {
  'use strict';
  const C=window.CONFIG;
  const {clamp}=window.M;
  const {ctx,DPR,world,player,bullets,sonarContacts,enemies}=window.G;
  const {doodleText,doodleCircle,STRIP_W}=window.R;

  // ── Depth strip (right side) ──────────────────────────────────────────────────
  function drawDepthStrip(W,H,panelH=54*DPR){
    const stripW=STRIP_W;
    const stripX=W-stripW;
    const padT=72*DPR, padB=52*DPR;
    const stripH=H-panelH-padT-padB;

    // Background
    ctx.fillStyle='rgba(245,246,250,0.96)';
    ctx.fillRect(stripX,0,stripW,H-panelH);
    ctx.strokeStyle='rgba(17,24,39,0.13)';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(stripX,0); ctx.lineTo(stripX,H); ctx.stroke();

    // Label
    ctx.fillStyle='rgba(17,24,39,0.5)';
    doodleText('DEPTH',stripX+stripW/2,padT-18*DPR,9*DPR,'center');

    // Zoomed window: ±400m around player depth, clamped to world
    const playerD=player.depth||0;
    const halfWin=400;
    let winTop=Math.max(0, playerD-halfWin);
    let winBot=Math.min(world.ground, playerD+halfWin);
    // Expand if clamped to keep window 800m tall
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
        doodleText('LAYER',stripX+4,ly1-3,7*DPR,'left');
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
      doodleText('SEABED',stripX+4,groundY-3,7*DPR,'left');
    }

    // Depth tick marks — every 50m, label every 100m
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
      ctx.lineTo(stripX+(isMajor?10:5)*DPR,ty);
      ctx.stroke();
      if(isMajor) doodleText(d+'m',stripX+12*DPR,ty+4,8*DPR,'left');
    }

    // ── Contacts on the strip ─────────────────────────────────────────────────
    const labelX=stripX+stripW-4*DPR; // right-aligned labels
    const barX=stripX+38*DPR;         // markers left of labels

    // Enemy subs — S# designation from sonarContacts
    for(const [e,sc] of sonarContacts){
      if((e.detectedT||0)<=0 && (sc.activeT||0)<=0) continue;
      const d2=e.depth??200;
      if(d2<winTop-60||d2>winBot+60) continue;
      const ty=dToY(d2);
      const stale=(sc.activeT||0)<=0;
      ctx.strokeStyle=stale?'rgba(17,24,39,0.25)':'rgba(17,24,39,0.70)';
      ctx.fillStyle=stale?'rgba(17,24,39,0.22)':'rgba(17,24,39,0.70)';
      ctx.lineWidth=1.5;
      // Horizontal tick across strip
      ctx.beginPath(); ctx.moveTo(stripX,ty); ctx.lineTo(barX+4*DPR,ty); ctx.stroke();
      // Sub symbol ●
      doodleText('●',barX,ty+3,9*DPR,'right');
      // ID label
      doodleText(sc.id||'?',labelX,ty+4,8*DPR,'right');
    }

    // Torpedoes — T# label, colour-coded friendly/enemy/seduced
    // Enemy torpedoes only shown after acoustic detection (_alertedPlayer)
    for(const b of bullets){
      if(b.kind!=='torpedo'||b.life<=0||b.depth==null) continue;
      if(!b.friendly && !b._alertedPlayer) continue;
      if(b.depth<winTop-60||b.depth>winBot+60) continue;
      const ty=dToY(b.depth);
      const seduced=!!b.seducedBy;
      let col;
      if(seduced)           col='rgba(180,40,40,0.85)';   // seduced — red
      else if(b.friendly)   col='rgba(17,24,39,0.85)';    // player's — dark
      else                  col='rgba(100,30,200,0.75)';  // enemy — purple

      ctx.strokeStyle=col;
      ctx.fillStyle=col;
      ctx.lineWidth=1.5;
      // Arrow ▶ pointing into strip
      const aw=6*DPR, ah=4*DPR;
      ctx.beginPath();
      ctx.moveTo(barX-aw,ty-ah);
      ctx.lineTo(barX,ty);
      ctx.lineTo(barX-aw,ty+ah);
      ctx.stroke();
      // Horizontal tick
      ctx.beginPath(); ctx.moveTo(stripX,ty); ctx.lineTo(barX-aw,ty); ctx.stroke();
      // ID label + depth
      doodleText(b.torpId||'T?',labelX,ty-2,8*DPR,'right');
      doodleText(Math.round(b.depth)+'m',labelX,ty+8,7*DPR,'right');
    }

    // Player — filled triangle, always drawn last (on top)
    const pd=dToY(playerD);
    ctx.fillStyle='#111827';
    ctx.beginPath();
    ctx.moveTo(stripX,pd);
    ctx.lineTo(stripX+16*DPR,pd-7*DPR);
    ctx.lineTo(stripX+16*DPR,pd+7*DPR);
    ctx.closePath(); ctx.fill();

    // Ordered depth — dashed line
    const od=dToY(player.depthOrder);
    if(od>padT-4&&od<padT+stripH+4){
      ctx.strokeStyle='rgba(17,24,39,0.28)';
      ctx.setLineDash([3,4]);
      ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(stripX+16*DPR,od); ctx.lineTo(W,od); ctx.stroke();
      ctx.setLineDash([]);
      doodleText('ORD',stripX+18*DPR,od-3,7*DPR,'left');
    }

    // Depth readout — current and ordered
    ctx.fillStyle='#111827';
    doodleText(Math.round(playerD)+'m', W-4, H-panelH-18*DPR, 12*DPR,'right');
    ctx.fillStyle='rgba(17,24,39,0.38)';
    doodleText('→'+Math.round(player.depthOrder)+'m', W-4, H-panelH-6*DPR, 9*DPR,'right');

    // Window range label at top
    ctx.fillStyle='rgba(17,24,39,0.28)';
    doodleText(Math.round(winTop)+'–'+Math.round(winBot)+'m', stripX+stripW/2, padT-6*DPR, 8*DPR,'center');
  }

  // ── Threat bar (top) ──────────────────────────────────────────────────────────
  function drawThreatBar(W){
    let maxSus=0;
    for(const e of enemies) maxSus=Math.max(maxSus,e.suspicion||0);
    const state=maxSus>C.enemy.susEngage?'ALERT':maxSus>C.enemy.susInvestigate?'SEARCH':'CLEAR';
    const col=state==='ALERT'?'#dc2626':state==='SEARCH'?'#d97706':'#16a34a';

    ctx.fillStyle='rgba(247,247,251,0.88)';
    ctx.fillRect(0,0,W-STRIP_W,28*DPR);
    ctx.strokeStyle='rgba(17,24,39,0.10)';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,28*DPR); ctx.lineTo(W-STRIP_W,28*DPR); ctx.stroke();

    // Threat fill bar
    ctx.fillStyle=col+'33';
    ctx.fillRect(0,0,(W-STRIP_W)*clamp(maxSus,0,1),28*DPR);

    ctx.fillStyle=col;
    doodleText(state,(W-STRIP_W)/2,19*DPR,11*DPR,'center');

    // Controls hint
    ctx.fillStyle='rgba(17,24,39,0.28)';
    doodleText('LMB=waypoint  RMB=remove last  SHIFT+LMB=fire torp  scroll=zoom  SPACE=ping  R=reset',12*DPR,19*DPR,9*DPR,'left');
  }

  window.RHUD={drawDepthStrip,drawThreatBar};
})();
