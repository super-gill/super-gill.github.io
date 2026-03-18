// render-hud.js — depth strip (right side) and threat bar (top)
// Exposes window.RHUD: { drawDepthStrip, drawThreatBar }
// Requires window.R (render-utils.js) to be loaded first.
(() => {
  'use strict';
  const C=window.CONFIG;
  const {clamp}=window.M;
  const {ctx,DPR,world,player,bullets,sonarContacts,enemies}=window.G;
  const {doodleText,doodleCircle,STRIP_W,U}=window.R;
  const TH=window.THEME;

  // ── Depth strip (right side) ──────────────────────────────────────────────────
  function drawDepthStrip(W,H,panelH){
    panelH = panelH || U(54);
    const stripW=STRIP_W;
    const stripX=W-stripW;
    const padT=U(72), padB=U(52);
    const stripH=H-panelH-padT-padB;

    // Background
    ctx.fillStyle=TH.color.bg.depthStrip;
    ctx.fillRect(stripX,0,stripW,H-panelH);
    ctx.strokeStyle=TH.color.border.medium;
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(stripX,0); ctx.lineTo(stripX,H); ctx.stroke();

    // Label
    ctx.fillStyle='rgba(17,24,39,0.5)';
    doodleText('DEPTH',stripX+stripW/2,padT-U(18),U(9),'center');

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
      ctx.lineTo(stripX+(isMajor?U(10):U(5)),ty);
      ctx.stroke();
      if(isMajor) doodleText(d+'m',stripX+U(12),ty+4,U(8),'left');
    }

    // ── Contacts on the strip ─────────────────────────────────────────────────
    const labelX=stripX+stripW-U(4); // right-aligned labels
    const barX=stripX+U(38);         // markers left of labels

    // Enemy subs — S# designation from sonarContacts
    // Depth is estimated, not known — only shown at DEGRADED TMA or better.
    // Uses the same noisy estimate as the TDC panel (stored on sc._estDepth).
    for(const [e,sc] of sonarContacts){
      if((e.detectedT||0)<=0 && (sc.activeT||0)<=0) continue;
      // Gate depth display behind TMA quality — passive sonar doesn't give depth
      const tmaQ=sc.tmaQuality||0;
      if(tmaQ<0.35) continue; // BEARING ONLY — no depth info
      const d2=sc._estDepth;
      if(d2==null) continue;
      if(d2<winTop-60||d2>winBot+60) continue;
      const ty=dToY(d2);
      const stale=(sc.activeT||0)<=0;
      const uncertain=tmaQ<0.70; // DEGRADED — show as less confident
      ctx.strokeStyle=stale?'rgba(17,24,39,0.25)':uncertain?'rgba(17,24,39,0.40)':'rgba(17,24,39,0.70)';
      ctx.fillStyle=stale?'rgba(17,24,39,0.22)':uncertain?'rgba(17,24,39,0.35)':'rgba(17,24,39,0.70)';
      ctx.lineWidth=1.5;
      // Horizontal tick across strip
      ctx.beginPath(); ctx.moveTo(stripX,ty); ctx.lineTo(barX+U(4),ty); ctx.stroke();
      // Sub symbol — ● solid at SOLID, ○ hollow at DEGRADED to show uncertainty
      doodleText(uncertain?'○':'●',barX,ty+3,U(9),'right');
      // ID label
      doodleText(sc.id||'?',labelX,ty+4,U(8),'right');
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
      if(seduced)           col=TH.color.contact.seduced;   // seduced — red
      else if(b.friendly)   col=TH.color.contact.friendly; // player's — dark
      else                  col=TH.color.contact.enemy;    // enemy — purple

      ctx.strokeStyle=col;
      ctx.fillStyle=col;
      ctx.lineWidth=1.5;
      // Arrow ▶ pointing into strip
      const aw=U(6), ah=U(4);
      ctx.beginPath();
      ctx.moveTo(barX-aw,ty-ah);
      ctx.lineTo(barX,ty);
      ctx.lineTo(barX-aw,ty+ah);
      ctx.stroke();
      // Horizontal tick
      ctx.beginPath(); ctx.moveTo(stripX,ty); ctx.lineTo(barX-aw,ty); ctx.stroke();
      // ID label + depth
      doodleText(b.torpId||'T?',labelX,ty-2,U(8),'right');
      doodleText(Math.round(b.depth)+'m',labelX,ty+8,U(7),'right');
    }

    // Player — filled triangle, always drawn last (on top)
    const pd=dToY(playerD);
    ctx.fillStyle=TH.color.text.primary;
    ctx.beginPath();
    ctx.moveTo(stripX,pd);
    ctx.lineTo(stripX+U(16),pd-U(7));
    ctx.lineTo(stripX+U(16),pd+U(7));
    ctx.closePath(); ctx.fill();

    // Ordered depth — dashed line
    const od=dToY(player.depthOrder);
    if(od>padT-4&&od<padT+stripH+4){
      ctx.strokeStyle='rgba(17,24,39,0.28)';
      ctx.setLineDash([3,4]);
      ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(stripX+U(16),od); ctx.lineTo(W,od); ctx.stroke();
      ctx.setLineDash([]);
      doodleText('ORD',stripX+U(18),od-3,U(7),'left');
    }

    // Depth readout — current and ordered
    ctx.fillStyle=TH.color.text.primary;
    doodleText(Math.round(playerD)+'m', W-4, H-panelH-U(18), U(TH.font.value),'right');
    ctx.fillStyle=TH.color.text.muted;
    doodleText('→'+Math.round(player.depthOrder)+'m', W-4, H-panelH-U(6), U(TH.font.label),'right');

    // Window range label at top
    ctx.fillStyle='rgba(17,24,39,0.28)';
    doodleText(Math.round(winTop)+'–'+Math.round(winBot)+'m', stripX+stripW/2, padT-U(6), U(8),'center');
  }

  // ── Threat bar (top) ──────────────────────────────────────────────────────────
  function drawThreatBar(W){
    let maxSus=0;
    for(const e of enemies) maxSus=Math.max(maxSus,e.suspicion||0);
    const state=maxSus>C.enemy.susEngage?'ALERT':maxSus>C.enemy.susInvestigate?'SEARCH':'CLEAR';
    const col=state==='ALERT'?TH.color.threat.alert:state==='SEARCH'?TH.color.threat.search:TH.color.threat.clear;
    const stripW=window.R.STRIP_W;

    ctx.fillStyle=TH.color.bg.threatBar;
    ctx.fillRect(0,0,W-stripW,U(28));
    ctx.strokeStyle=TH.color.border.light;
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,U(28)); ctx.lineTo(W-stripW,U(28)); ctx.stroke();

    // Threat fill bar
    ctx.fillStyle=col+'33';
    ctx.fillRect(0,0,(W-stripW)*clamp(maxSus,0,1),U(28));

    ctx.fillStyle=col;
    doodleText(state,(W-stripW)/2,U(19),U(11),'center');

    // Controls hint removed — will be accessible via help overlay (Phase 5)
  }

  // ── Nav Compass (top-right, left of depth strip) ─────────────────────────────
  function drawNavCompass(W,H,panelH){
    panelH = panelH || U(54);
    const stripW=STRIP_W;
    const radius=U(65);       // ~U(130) diameter
    const diam=radius*2;
    // Centre: to the left of the depth strip, vertically centred in the top area
    const cx=W-stripW-radius-U(50);
    const cy=U(72)+radius+U(10);

    const heading=player.heading||0;
    // Convert math-angle to compass bearing (0=N, clockwise)
    const compassDeg=((Math.atan2(Math.cos(heading),-Math.sin(heading))*180/Math.PI)+360)%360;
    const compassRad=compassDeg*Math.PI/180;

    // ── Background circle ───────────────────────────────────────────────────
    ctx.save();
    ctx.fillStyle='rgba(6,14,30,0.75)';
    ctx.beginPath(); ctx.arc(cx,cy,radius+U(4),0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(80,120,200,0.25)';
    ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(cx,cy,radius+U(4),0,Math.PI*2); ctx.stroke();

    // Inner circle
    ctx.strokeStyle='rgba(80,120,200,0.12)';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(cx,cy,radius-U(12),0,Math.PI*2); ctx.stroke();

    // ── Fixed compass card — N always at top ─────────────────────────────────
    // Tick marks every 10° (small) and 30° (medium)
    for(let d=0;d<360;d+=10){
      const ang=d*Math.PI/180 - Math.PI/2; // 0° = top
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

    // Cardinal labels
    const cardinals=[{d:0,l:'N'},{d:90,l:'E'},{d:180,l:'S'},{d:270,l:'W'}];
    const labelR=radius-U(24);
    ctx.fillStyle='rgba(200,225,255,0.90)';
    ctx.font=`bold ${U(11)}px ui-monospace,monospace`;
    ctx.textAlign='center';
    for(const c2 of cardinals){
      const ang=c2.d*Math.PI/180 - Math.PI/2;
      ctx.fillText(c2.l, cx+Math.cos(ang)*labelR, cy+Math.sin(ang)*labelR+U(4));
    }

    // ── Boat heading arrow — rotates on the fixed card ─────────────────────
    // compassDeg is 0=N clockwise; convert to canvas angle (0=top, CW)
    const arrowAng=compassRad - Math.PI/2; // compassRad already in radians from North
    const arrowLen=radius-U(20);
    const arrowTailLen=U(14);
    const arrowTipX=cx+Math.cos(arrowAng)*arrowLen;
    const arrowTipY=cy+Math.sin(arrowAng)*arrowLen;
    const arrowTailX=cx-Math.cos(arrowAng)*arrowTailLen;
    const arrowTailY=cy-Math.sin(arrowAng)*arrowTailLen;

    // Arrow shaft
    ctx.strokeStyle='rgba(220,60,60,0.90)';
    ctx.lineWidth=2.5;
    ctx.beginPath();
    ctx.moveTo(arrowTailX,arrowTailY);
    ctx.lineTo(arrowTipX,arrowTipY);
    ctx.stroke();

    // Arrowhead triangle
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

    // ── Centre dot ──────────────────────────────────────────────────────────
    ctx.fillStyle='rgba(200,225,255,0.50)';
    ctx.beginPath(); ctx.arc(cx,cy,U(3),0,Math.PI*2); ctx.fill();

    // ── Ordered heading marker (triangle on rim + turn arc + line) ────────
    const ordHdg=player.orderedHeading;
    if(ordHdg!=null){
      const ordDiff=Math.abs(((ordHdg-compassDeg+540)%360)-180);
      if(ordDiff>0.5){
        const ordAng=ordHdg*Math.PI/180 - Math.PI/2;

        // Dashed arc from current heading to ordered heading (shortest turn)
        const curAng=compassDeg*Math.PI/180 - Math.PI/2;
        const arcR=radius-U(6);
        let delta=((ordHdg-compassDeg+540)%360)-180; // -180..180
        ctx.strokeStyle='rgba(20,220,180,0.55)';
        ctx.lineWidth=2;
        ctx.setLineDash([U(4),U(4)]);
        ctx.beginPath();
        ctx.arc(cx,cy,arcR,curAng,ordAng,delta<0);
        ctx.stroke();
        ctx.setLineDash([]);

        // Ordered heading line (dashed line from centre to rim)
        ctx.strokeStyle='rgba(20,220,180,0.65)';
        ctx.lineWidth=2;
        ctx.setLineDash([U(3),U(3)]);
        ctx.beginPath();
        ctx.moveTo(cx,cy);
        ctx.lineTo(cx+Math.cos(ordAng)*(radius-U(4)), cy+Math.sin(ordAng)*(radius-U(4)));
        ctx.stroke();
        ctx.setLineDash([]);

        // Triangle marker on rim
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

    // ── Navigation buttons ──────────────────────────────────────────────────
    const btnW=U(38), btnH=U(22);
    const btnGap=U(4);
    const btnColor='rgba(30,58,95,0.55)';

    // Port buttons (left side) — turn left
    const portX=cx-radius-U(8)-btnW;
    const portY1=cy-btnH-btnGap/2;
    const portY2=cy+btnGap/2;
    window.PANEL.btn2(ctx,'10\u00B0 P',portX,portY1,btnW,btnH,btnColor,()=>window.PANEL.courseStep(-10));
    window.PANEL.btn2(ctx,'1\u00B0 P',portX,portY2,btnW,btnH,btnColor,()=>window.PANEL.courseStep(-1));

    // Starboard buttons (right side) — turn right
    const stbdX=cx+radius+U(8);
    window.PANEL.btn2(ctx,'1\u00B0 S',stbdX,portY1,btnW,btnH,btnColor,()=>window.PANEL.courseStep(1));
    window.PANEL.btn2(ctx,'10\u00B0 S',stbdX,portY2,btnW,btnH,btnColor,()=>window.PANEL.courseStep(10));

    // Depth buttons (above and below compass)
    const depBtnW=U(34), depBtnH=U(20);
    const aboveX=cx-depBtnW/2;
    const aboveY=cy-radius-U(30);
    window.PANEL.btn2(ctx,'\u25B2',aboveX,aboveY,depBtnW,depBtnH,btnColor,()=>window.PANEL.depthStep(-10));

    // ── Readouts — heading, speed, depth in the gap below compass ─────────
    // Draw a dark backing strip behind the readouts for contrast
    const readoutH=U(66);
    const readoutY0=cy+radius+U(8);
    ctx.fillStyle='rgba(6,14,30,0.65)';
    ctx.beginPath();
    ctx.roundRect(cx-U(80), readoutY0, U(160), readoutH, U(4));
    ctx.fill();

    const lineH=U(14);
    let ry=readoutY0+U(14);
    ctx.textAlign='center';

    // Heading line: CRS 270° (and → 315° if ordered)
    ctx.fillStyle='rgba(200,225,255,0.90)';
    ctx.font=`bold ${U(11)}px ui-monospace,monospace`;
    let hdgText='CRS '+Math.round(compassDeg).toString().padStart(3,'0')+'\u00B0';
    if(ordHdg!=null){
      const ordDiff2=Math.abs(((ordHdg-compassDeg+540)%360)-180);
      if(ordDiff2>0.5) hdgText+='\u2002\u2192\u2002'+Math.round(ordHdg).toString().padStart(3,'0')+'\u00B0';
    }
    ctx.fillText(hdgText, cx, ry);
    ry+=lineH;

    // Speed line: SPD 12kt → 20kt
    const spdNow=Math.round(player.speed||0);
    const spdOrd=Math.round(player.speedOrderKts||0);
    ctx.fillStyle='rgba(200,225,255,0.75)';
    ctx.font=`${U(10)}px ui-monospace,monospace`;
    ctx.fillText('SPD '+spdNow+'kt  \u2192  '+spdOrd+'kt', cx, ry);
    ry+=lineH;

    // Depth line: DEP 200m → 250m
    const dNow=Math.round(player.depth||0);
    const dOrd=Math.round(player.depthOrder??player.depth??0);
    ctx.fillText('DEP '+dNow+'m  \u2192  '+dOrd+'m', cx, ry);
    ry+=lineH;

    // Battery line
    const batPct=Math.round((player.battery??1.0)*100);
    const isDiesel=C.player.isDiesel||false;
    const batCol=batPct<20?'rgba(220,60,60,0.90)':batPct<50?'rgba(220,160,60,0.90)':'rgba(200,225,255,0.75)';
    ctx.fillStyle=batCol;
    ctx.font=`${U(10)}px ui-monospace,monospace`;
    const snrkSuffix=player.snorkeling?' SNKL':isDiesel&&player.snorkelOrdered?' RISG':'';
    const battLabel=isDiesel?`BATT ${batPct}%${snrkSuffix}`:`BATT ${batPct}%${player.scram?' SCRAM':''}`;
    ctx.fillText(battLabel, cx, ry);

    // Down depth button below readouts
    const belowY=readoutY0+readoutH+U(4);
    window.PANEL.btn2(ctx,'\u25BC',aboveX,belowY,depBtnW,depBtnH,btnColor,()=>window.PANEL.depthStep(10));

    ctx.restore();
  }

  window.RHUD={drawDepthStrip,drawThreatBar,drawNavCompass};
})();
