(() => {
  'use strict';
  const C=window.CONFIG;
  const {TAU,clamp,lerp,now,jitter,deg2rad}=window.M;
  const {ctx,canvas,DPR,world,cam,bullets,particles,enemies,decoys,contacts,cwisTracers,wireContacts,sonarContacts,player,game,setMsg,wrecks}=window.G;
  const AI=window.AI;
  const {doodleLine,doodleCircle,doodleText,w2s,wScale,PANEL_H,STRIP_W}=window.R;
  const {drawLand,drawRoute,drawPlayerTopDown,drawEnemySubTopDown,drawEnemyBoatTopDown,drawTorpedoTopDown}=window.RWORLD;
  const {drawDepthStrip,drawThreatBar}=window.RHUD;
  const {drawStartScreen,drawLogPanel,drawDcPanel,drawDamagePanel,drawPanel}=window.RPANEL;

  // ── Main draw ─────────────────────────────────────────────────────────────────
  function draw(){
    const W=canvas.width, H=canvas.height;
    const panelH=PANEL_H;
    const plotH=H-panelH;
    const plotW=W-STRIP_W;
    const Z=cam.zoom*DPR;

    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,W,H);

    // ── Start screen ────────────────────────────────────────────────────────
    if(!game.started){
      drawStartScreen(W,H);
      return;
    }

    const seaColour=window.MAPS?.getMap()?.seaColour||'#daeaf7';
    ctx.fillStyle=seaColour;
    ctx.fillRect(0,0,W,H);

    // ── Adaptive grid — spacing scales with zoom ────────────────────────────
    // 1wu = 10m. Pick spacing so grid cells are roughly 80-200px on screen.
    // Candidate spacings in wu (with nm equivalents):
    //   50wu=500m, 100wu=1km, 185wu≈1nm, 370wu≈2nm, 500wu=5km,
    //   926wu≈5nm, 1000wu=10km, 1852wu≈10nm, 5000wu≈27nm
    const gridCandidates=[50,100,185,370,500,926,1000,1852,5000];
    let gridSpacing=1000;
    for(const g of gridCandidates){
      const px=g*Z; // screen pixels per grid cell
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
    // Pick a round nm value whose screen width is between 60px and 180px
    const NM_WU = 185.2; // wu per nautical mile
    const nmCandidates=[0.25,0.5,1,2,5,10,20,50];
    let barNM=1;
    for(const nm of nmCandidates){
      if(nm*NM_WU*Z >= 60){ barNM=nm; break; }
    }
    const barWU  = barNM * NM_WU;
    const barPx  = barWU * Z;
    const barX   = 14*DPR;
    const barY   = H - panelH - 22*DPR;
    const barH   = 4*DPR;
    // Bar background pill
    ctx.fillStyle='rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.roundRect(barX-3*DPR, barY-8*DPR, barPx+6*DPR, 18*DPR, 3*DPR);
    ctx.fill();
    // Bar fill
    ctx.fillStyle='rgba(17,24,39,0.55)';
    ctx.fillRect(barX, barY, barPx, barH);
    // End ticks
    ctx.strokeStyle='rgba(17,24,39,0.55)';
    ctx.lineWidth=1.2;
    ctx.beginPath();
    ctx.moveTo(barX,     barY-3*DPR); ctx.lineTo(barX,     barY+barH+3*DPR);
    ctx.moveTo(barX+barPx,barY-3*DPR); ctx.lineTo(barX+barPx,barY+barH+3*DPR);
    ctx.stroke();
    // Label
    ctx.fillStyle='rgba(17,24,39,0.70)';
    ctx.font=`${8*DPR}px ui-monospace,monospace`;
    ctx.textAlign='left';
    const nmLabel = barNM < 1 ? `${barNM}nm` : `${barNM}nm`;
    ctx.fillText(nmLabel, barX+barPx+5*DPR, barY+barH, 40*DPR);
    // Also show metres/km for sub-nm bars
    if(barNM <= 1){
      const mLabel = barNM >= 1 ? `${Math.round(barWU*10)/1000}km` : `${Math.round(barWU*10)}m`;
      ctx.fillStyle='rgba(17,24,39,0.38)';
      ctx.font=`${7*DPR}px ui-monospace,monospace`;
      ctx.fillText(mLabel, barX+barPx+5*DPR, barY+barH+9*DPR);
    }

    // Land
    drawLand();

    // ── Planned route ─────────────────────────────────────────────────────────
    drawRoute();

    // ── Sonar ping ring ───────────────────────────────────────────────────────
    if(player.sonarPulse>0){
      const t=1-(player.sonarPulse/C.player.pingPulse);
      const R=wScale(40+t*1800);
      ctx.strokeStyle=`rgba(31,41,55,${0.30*(1-t)})`;
      const [px,py]=w2s(player.wx,player.wy);
      doodleCircle(px,py,R,2);
    }

    // ── Sonar contacts — TMA bearing lines + position blobs ─────────────────
    const SC=window.G.sonarContacts;
    const TMA_CFG=window.CONFIG?.tma;
    if(SC && TMA_CFG){
      const t2=performance.now()/1000;
      const maxBrgLine=wScale(TMA_CFG.defaultRange*1.4); // max screen-pixels for bearing line

      for(const [e,c] of SC){
        const fresh=c.activeT>0;
        // Staleness based on game time since last observation
        const T_game=game.missionT||0;
        const staleSecs=T_game-(c.lastObsT||0);
        // Fade from 0.80 → 0.18 over 120 seconds of no observations
        const alpha=Math.max(0.18, 0.80 - Math.min(1,staleSecs/120)*0.62);
        const age=t2-c.lastT; // wall-clock for staleness label
        const q=c.tmaQuality??0;
        // ── Quality tick on bearing line shown below ─────────────────────────

        // ── Past bearing lines — ghosted history ──────────────────────────
        const obs=c.bearings||[];
        // Show last 6 historical bearing rays (excluding most recent)
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

        // ── Current bearing line — from latest observation origin ─────────
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
            // Quality colour tick — a short perpendicular bar on the line
            const perpX=-(ey-loy)/lineLen, perpY=(ex-lox)/lineLen;
            const tickLen=(3+q*6)*DPR;
            const tickCol=q>=0.6?`rgba(22,163,74,${alpha*0.9})`:q>=0.2?`rgba(217,119,6,${alpha*0.9})`:`rgba(100,100,100,${alpha*0.6})`;
            ctx.strokeStyle=tickCol; ctx.lineWidth=2;
            ctx.beginPath();
            ctx.moveTo(lx-perpX*tickLen, ly-perpY*tickLen);
            ctx.lineTo(lx+perpX*tickLen, ly+perpY*tickLen);
            ctx.stroke();
            // ID label
            ctx.fillStyle=`rgba(17,24,39,${alpha*0.75})`;
            doodleText(c.id, lx+4*DPR, ly-4*DPR, 8*DPR, 'left');
            if(q<0.2) doodleText('BRG', lx+4*DPR, ly+5*DPR, 6*DPR, 'left');
            else if(q<0.6){ ctx.fillStyle=`rgba(217,119,6,${alpha*0.75})`; doodleText('BLDG', lx+4*DPR, ly+5*DPR, 6*DPR, 'left'); }
            else { ctx.fillStyle=`rgba(22,163,74,${alpha*0.75})`; doodleText('SOLID', lx+4*DPR, ly+5*DPR, 6*DPR, 'left'); }
          }
        }

        // ── Quality tick on bearing line shown below ─────────────────────────
      }
    }

    // ── Towed array — deaf cone + ambiguous bearing lines ───────────────────────
    {
      const ta=player.towedArray;
      const taActive=ta&&(ta.state==='operational'||ta.state==='damaged');
      if(taActive){
        const [px2,py2]=w2s(player.wx,player.wy);
        const heading=player.heading||0;
        const stern=heading+Math.PI;
        const CONE_HALF=0.49; // ~28°
        const coneLen=wScale(600);
        // Draw deaf cone off the stern — faint shaded wedge
        ctx.save();
        ctx.globalAlpha=0.07;
        ctx.fillStyle='rgba(17,24,39,1)';
        ctx.beginPath();
        ctx.moveTo(px2,py2);
        ctx.arc(px2,py2,coneLen,stern-CONE_HALF,stern+CONE_HALF);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        // Small label at cone edge
        const coneEdgeX=px2+Math.cos(stern)*coneLen*0.7;
        const coneEdgeY=py2+Math.sin(stern)*coneLen*0.7;
        ctx.fillStyle='rgba(17,24,39,0.22)';
        doodleText('DEAF', coneEdgeX, coneEdgeY, 7*DPR, 'center');
      }

      // Draw towed array bearing candidates for each contact
      if(ta&&ta.state!=='stowed'&&ta.state!=='destroyed'){
        for(const [e,c] of (window.G.sonarContacts||new Map())){
          if(!c.towedCandA||c.towedCandA.length===0) continue;
          const T_game=game.missionT||0;
          const staleSecs=T_game-(c.lastObsT||0);
          const baseAlpha=Math.max(0.12, 0.75-Math.min(1,staleSecs/90)*0.60);
          const resolved=c.towedResolved;
          const lastObs=c.towedCandA[c.towedCandA.length-1];
          if(!lastObs) continue;
          const [ox,oy]=w2s(lastObs.fromX, lastObs.fromY);
          const maxLen=wScale(C.tma.defaultRange*1.4);

          if(resolved){
            // Single resolved line — teal, solid
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
              ctx.strokeStyle=`rgba(20,184,166,${baseAlpha*0.75})`; // teal
              ctx.lineWidth=1.3;
              ctx.setLineDash([]);
              ctx.beginPath(); ctx.moveTo(lox2,loy2); ctx.lineTo(ex2,ey2); ctx.stroke();
              // Label
              const labelDist=Math.min(maxLen*0.55,wScale(500));
              const lineLen=Math.hypot(ex2-lox2,ey2-loy2)||1;
              const lx=lox2+(ex2-lox2)*(labelDist/lineLen);
              const ly=loy2+(ey2-loy2)*(labelDist/lineLen);
              ctx.fillStyle=`rgba(20,184,166,${baseAlpha*0.85})`;
              doodleText(c.id, lx+4*DPR, ly-4*DPR, 8*DPR, 'left');
              doodleText('[T]', lx+4*DPR, ly+5*DPR, 6*DPR, 'left');
            }
          } else {
            // Two ambiguous lines — dashed teal at half opacity
            const candPairs=[
              {obs:c.towedCandA, q:c.towedQA||0},
              {obs:c.towedCandB, q:c.towedQB||0},
            ];
            for(let ci=0;ci<candPairs.length;ci++){
              const {obs,q}=candPairs[ci];
              if(!obs.length) continue;
              const latest=obs[obs.length-1];
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
                doodleText(`${c.id} ?`, lx+4*DPR, ly-4*DPR, 8*DPR, 'left');
                doodleText('TURN TO RESOLVE', lx+4*DPR, ly+5*DPR, 6*DPR, 'left');
              }
            }
          }
        }
      }
    }

    // ── Passive contact flashes — ephemeral bearing-line bursts ──────────────
    for(const c of contacts){
      const isTowed = c.source==='towed';
      const a=clamp(c.life/2.2,0,1);
      // Draw bearing line from observation origin
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
      // Small tick at observer origin
      ctx.fillStyle=`rgba(17,24,39,${0.18*a})`;
      ctx.beginPath(); ctx.arc(lx1,ly1,2,0,Math.PI*2); ctx.fill();
    }

    // ── Decoys ────────────────────────────────────────────────────────────────
    for(const d of decoys){
      const [dx,dy]=w2s(d.x,d.y);
      const pulse=0.6+0.4*Math.sin((game.missionT||0)*6 + d.x);
      if(d.friendly){
        // Player noisemaker — bright orange so you can see it working
        ctx.strokeStyle=`rgba(255,160,30,${0.70*pulse})`;
        ctx.lineWidth=1.5;
        doodleCircle(dx,dy,5,1.5);
        ctx.strokeStyle=`rgba(255,160,30,${0.35*pulse})`;
        doodleCircle(dx,dy,wScale(d.r||20),1);
        // Label
        ctx.fillStyle=`rgba(255,180,60,${0.80*pulse})`;
        ctx.font=`${7*DPR}px ui-monospace,monospace`;
        ctx.textAlign='left';
        ctx.fillText('NM',dx+7,dy-4);
      } else {
        // Enemy noisemaker — dim teal
        ctx.strokeStyle=`rgba(60,180,160,${0.45*pulse})`;
        ctx.lineWidth=1;
        doodleCircle(dx,dy,4,1);
        ctx.strokeStyle=`rgba(60,180,160,${0.20*pulse})`;
        doodleCircle(dx,dy,wScale(d.r||20),0.8);
      }
    }

    // ── Torpedoes + wire lines + seeker cones ────────────────────────────────
    for(const b of bullets){
      if(b.kind!=='torpedo') continue;
      const [tx2,ty2]=w2s(b.x,b.y);

      // Seeker cone — only when seeker is active
      const seekerOn=b.traveled>=(b.enableDist||0);
      if(b.friendly && seekerOn){
        const torpAng=Math.atan2(b.vy,b.vx);
        const seekR=wScale(C.torpedo.seekRange||300);
        const fov=C.torpedo.seekFOV||0.85;
        const hasTarget=b.target!=null;
        ctx.save();
        ctx.translate(tx2,ty2);
        ctx.rotate(torpAng);
        // Cone fill
        ctx.beginPath();
        ctx.moveTo(0,0);
        ctx.arc(0,0,seekR,-fov/2,fov/2);
        ctx.closePath();
        ctx.fillStyle=hasTarget?'rgba(30,58,95,0.07)':'rgba(17,24,39,0.04)';
        ctx.fill();
        // Cone outline
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
        ctx.restore(); // end rotated cone context

        // Target lock line — drawn in screen space (after restore)
        if(b.target){
          const tRef=b.target;
          const [ex,ey]=w2s(tRef.wx??tRef.x, tRef.wy??tRef.y);
          ctx.strokeStyle='rgba(30,58,95,0.45)';
          ctx.lineWidth=1.5;
          ctx.setLineDash([2,3]);
          ctx.beginPath(); ctx.moveTo(tx2,ty2); ctx.lineTo(ex,ey); ctx.stroke();
          ctx.setLineDash([]);
        }

        // Label — status
        const lifeLeft=Math.ceil(b.life);
        const statusTxt=hasTarget?`T${b.torpId} LOCKED`:`T${b.torpId} SEARCH ${lifeLeft}s`;
        ctx.fillStyle=hasTarget?'rgba(30,58,95,0.75)':'rgba(17,24,39,0.45)';
        doodleText(statusTxt, tx2+8*DPR, ty2-6*DPR, 8*DPR, 'left');
      } else if(b.friendly && !seekerOn){
        // Pre-enable dumb run — show how far until seeker on
        const distLeft=wScale((b.enableDist||0)-b.traveled);
        ctx.strokeStyle='rgba(17,24,39,0.20)';
        ctx.lineWidth=1;
        ctx.setLineDash([2,4]);
        const ang=Math.atan2(b.vy,b.vx);
        ctx.beginPath(); ctx.moveTo(tx2,ty2);
        ctx.lineTo(tx2+Math.cos(ang)*distLeft, ty2+Math.sin(ang)*distLeft);
        ctx.stroke(); ctx.setLineDash([]);
        doodleText(`T${b.torpId} ARM`, tx2+8*DPR, ty2-6*DPR, 8*DPR, 'left');
      }

      // Enemy torpedoes only visible once acoustically detected
      if(!b.friendly && !b._alertedPlayer) { /* not yet detected — skip */ } else drawTorpedoTopDown(b);
      // Wire line
      if(b.wire&&b.wire.live){
        ctx.strokeStyle='rgba(17,24,39,0.28)';
        ctx.lineWidth=1;
        ctx.setLineDash([4,5]);
        ctx.beginPath(); ctx.moveTo(tx2,ty2); ctx.lineTo(...w2s(b.wire.fromX,b.wire.fromY)); ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // ── Wire-fed contacts ─────────────────────────────────────────────────────
    for(const wc of wireContacts){
      const [wx2,wy2]=w2s(wc.x,wc.y);
      if(wx2<0||wx2>plotW) continue;
      const a=clamp(wc.life/1.8,0,1);
      ctx.strokeStyle=`rgba(99,102,241,${0.65*a})`;
      ctx.fillStyle=`rgba(99,102,241,${0.50*a})`;
      // Diamond symbol — wire contact
      ctx.save();
      ctx.translate(wx2,wy2); ctx.rotate(Math.PI/4);
      const ds=7*DPR;
      ctx.beginPath();
      ctx.rect(-ds/2,-ds/2,ds,ds);
      ctx.restore();
      ctx.lineWidth=1.5;
      doodleCircle(wx2,wy2,8*DPR,1.5);
      doodleText('WG',wx2+10*DPR,wy2+4,8*DPR,'left');
    }

    // ── CWIS tracers ──────────────────────────────────────────────────────────
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

    // ── Particles ─────────────────────────────────────────────────────────────
    for(const p of particles){
      const [px2,py2]=w2s(p.x,p.y);
      const a=clamp(p.life/0.9,0,1);
      ctx.strokeStyle=`rgba(31,41,55,${0.28*a})`;
      doodleCircle(px2,py2,wScale(p.size*(0.5+0.8*(1-a))),1.5);
    }

    // Enemy icons removed — contacts represented by bearing lines and TMA dots only.

    // ── Towed array cable ─────────────────────────────────────────────────────
    const [ppx,ppy]=w2s(player.wx,player.wy);
    {
      const ta=player.towedArray;
      const taVisible=ta&&ta.state!=='stowed'&&ta.state!=='destroyed';
      if(taVisible){
        const progress=ta.progress||0;
        const maxCableWU=800;  // doubled — ~800m of cable
        const cableWU=maxCableWU*progress;

        // Colour by state
        const cableR=ta.state==='operational'?'20,184,166'
                    :ta.state==='damaged'?'217,119,6'
                    :'60,80,80';

        // Stern attachment point — offset from sub center along heading+π
        // Sub is 11wu long, center to stern is ~5.5wu (but trail starts at center,
        // so offset the first path point to the actual stern)
        const sternOff = 5.5; // wu from center to stern
        const sternAng = player.heading + Math.PI;
        const sternWX = (player.wx + Math.cos(sternAng)*sternOff + world.w) % world.w;
        const sternWY = player.wy + Math.sin(sternAng)*sternOff;

        // ── Build cable path from position trail ─────────────────────────────
        const trail = player._cableTrail||[];
        const pathPts = [{wx:sternWX, wy:sternWY}]; // start at physical stern
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

        // Sensor section start index — last 30% of cable length
        const sensorStartIdx = Math.floor(screenPts.length * 0.70);

        // ── Wire section (first 70%) — very faded grey, barely there ──────────
        // Deliberately low-contrast so it reads as "past path" not sensor gear
        for(let i=0; i<Math.min(sensorStartIdx+1, screenPts.length-1); i++){
          const t = totalSegs > 1 ? i / totalSegs : 0;
          // Fade from 0.18 at stern → 0.05 at start of sensor section
          const alpha = 0.18 - t * 0.13;
          ctx.strokeStyle = `rgba(17,24,39,${alpha.toFixed(2)})`;
          ctx.lineWidth = 0.8;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(screenPts[i][0], screenPts[i][1]);
          ctx.lineTo(screenPts[i+1][0], screenPts[i+1][1]);
          ctx.stroke();
        }

        // ── Sensor / hydrophone section (last 30%) — bold teal, clearly distinct
        if(progress > 0.5 && screenPts.length >= 2){
          // Solid backing line — thicker
          ctx.strokeStyle = `rgba(${cableR},0.80)`;
          ctx.lineWidth = 2.2;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(screenPts[sensorStartIdx][0], screenPts[sensorStartIdx][1]);
          for(let i=sensorStartIdx+1; i<screenPts.length; i++){
            ctx.lineTo(screenPts[i][0], screenPts[i][1]);
          }
          ctx.stroke();
          // Dashed overlay to show hydrophone element spacing
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

        // ── Tip marker ────────────────────────────────────────────────────────
        if(progress > 0.95){
          const [cex,cey] = w2s(endWX, endWY);
          const crossR = 4*DPR;
          ctx.strokeStyle = `rgba(${cableR},0.85)`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(cex-crossR, cey); ctx.lineTo(cex+crossR, cey);
          ctx.moveTo(cex, cey-crossR); ctx.lineTo(cex, cey+crossR);
          ctx.stroke();

          if(ta.state==='damaged'){
            ctx.fillStyle=`rgba(217,119,6,0.85)`;
            doodleText('▲ DEGRADED', cex+7*DPR, cey-4*DPR, 7*DPR, 'left');
          } else {
            ctx.fillStyle=`rgba(${cableR},0.65)`;
            doodleText('[T]', cex+7*DPR, cey+3*DPR, 7*DPR, 'left');
          }
        }

        // ── Deploy/retract progress label ─────────────────────────────────────
        if(ta.state==='deploying'||ta.state==='retracting'){
          const pct=ta.progress||0;
          const [cex,cey] = w2s(endWX, endWY);
          ctx.fillStyle='rgba(17,24,39,0.38)';
          doodleText(
            ta.state==='deploying'?`ARRAY ↓ ${Math.round((1-pct)*30)}s`:`ARRAY ↑ ${Math.round(pct*20)}s`,
            cex+8*DPR, cey, 7*DPR, 'left'
          );
        }
      }
    }

    // ── Player sub ────────────────────────────────────────────────────────────
    ctx.strokeStyle=(player.invuln>0)?'rgba(17,24,39,0.40)':'#111827';
    ctx.save();
    ctx.translate(ppx,ppy);
    ctx.rotate(player.heading);
    drawPlayerTopDown();
    ctx.restore();

    // Ordered heading indicator — faint line ahead
    ctx.strokeStyle='rgba(17,24,39,0.12)';
    ctx.lineWidth=1;
    const leadDist=wScale(400);
    ctx.beginPath();
    ctx.moveTo(ppx,ppy);
    ctx.lineTo(ppx+Math.cos(player.heading)*leadDist, ppy+Math.sin(player.heading)*leadDist);
    ctx.stroke();

    // ── Torpedo aim overlay (shift held) ─────────────────────────────────────
    if(window.I&&window.I.shiftHeld){
      const [ppx2,ppy2]=w2s(player.wx,player.wy);
      const aimDx=window.I.aimWorldX-player.wx;
      const aimDy=window.I.aimWorldY-player.wy;
      const aimAng=Math.atan2(aimDy,aimDx);
      const aimLen=wScale(C.player.torpWireMaxRange*0.65);

      // Angle offset from heading — determines wire risk
      const {angleNorm:aN}=window.M;
      const offset=Math.abs(aN(aimAng-player.heading));
      const safeArc=(C.player.torpArcDeg||55)*Math.PI/180;

      // Wire risk: 0 inside safe arc, 0..1 beyond it
      const wireRisk=offset<=safeArc?0:Math.pow(Math.min(1,(offset-safeArc)/(Math.PI-safeArc)),2)*0.98;

      // Colour: green → amber → red with risk
      const r=Math.round(lerp(17,220,wireRisk));
      const g=Math.round(lerp(100,38,wireRisk));
      const b2=Math.round(lerp(39,38,wireRisk));
      const lineCol=`rgba(${r},${g},${b2},0.70)`;

      // Aim line
      ctx.strokeStyle=lineCol;
      ctx.lineWidth=1.5;
      ctx.setLineDash([5,5]);
      ctx.beginPath(); ctx.moveTo(ppx2,ppy2);
      ctx.lineTo(ppx2+Math.cos(aimAng)*aimLen, ppy2+Math.sin(aimAng)*aimLen);
      ctx.stroke(); ctx.setLineDash([]);

      // Safe arc indicators — two faint lines showing the wire-safe zone
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

      // Label — bearing and wire risk
      const bearDeg=((aimAng*180/Math.PI)+360)%360;
      ctx.fillStyle=lineCol;
      const riskLabel=wireRisk<=0?'WIRE OK':wireRisk<0.4?'WIRE RISK':wireRisk<0.75?'WIRE LIKELY CUT':'WIRE WILL CUT';
      doodleText(`TDC ${Math.round(bearDeg).toString().padStart(3,'0')}°  ${riskLabel}`,
        ppx2+12*DPR, ppy2-8*DPR, 10*DPR,'left');
      if(player.torpCd>0){
        ctx.fillStyle='rgba(220,38,38,0.65)';
        doodleText(`CD ${player.torpCd.toFixed(1)}s`,ppx2+12*DPR,ppy2+6*DPR,9*DPR,'left');
      }
    }

    // ── Wreck markers — permanent icons for destroyed contacts ───────────────
    if(wrecks){
      for(const w of wrecks){
        const [wx2,wy2]=w2s(w.x,w.y);
        if(wx2<-20||wx2>plotW+20) continue;
        ctx.save();
        ctx.translate(wx2,wy2);
        const sz=wScale(w.type==='boat'?12:10);
        // Crossed-out wreck symbol
        ctx.strokeStyle='rgba(100,20,20,0.55)';
        ctx.lineWidth=1.5;
        // X mark
        ctx.beginPath();
        ctx.moveTo(-sz,-sz); ctx.lineTo(sz,sz);
        ctx.moveTo(sz,-sz);  ctx.lineTo(-sz,sz);
        ctx.stroke();
        // Circle
        ctx.beginPath(); ctx.arc(0,0,sz*1.3,0,TAU); ctx.stroke();
        // Label
        ctx.fillStyle='rgba(100,20,20,0.55)';
        const age=Math.floor((game.missionT||0)-w.t);
        const mm=Math.floor(age/60).toString().padStart(2,'0');
        const ss=(age%60).toString().padStart(2,'0');
        doodleText(`KIA T-${mm}:${ss}`,sz*1.5+2*DPR,2*DPR,8*DPR,'left');
        ctx.restore();
      }
    }

    // ── TDC intercept bearing line — shows where the torpedo will actually go ──
    {
      const tdc=game.tdc;
      const wp=game.wepsProposal;
      // Use the WEPS proposal bearing when available (matches exactly what will be fired).
      // Fall back to tdc.intercept only when no proposal exists yet.
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
        const arrLen=8*DPR;
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
          ex+4*DPR, ey-4*DPR, 9*DPR,'left');
      }
    }

    // ── Depth strip ───────────────────────────────────────────────────────────
    drawDepthStrip(W,H,panelH);

    // ── Command Panel ─────────────────────────────────────────────────────────
    drawPanel(W,H);

    // ── Message log board — drawn AFTER drawPanel so btn2 registrations survive clearBtns
    drawLogPanel(W,H,panelH);


    // ── DC Comms overlay ──────────────────────────────────────────────────────
    drawDcPanel(W,H,panelH);

    // ── Damage Control overlay ────────────────────────────────────────────────
    drawDamagePanel(W,H,panelH);

    // ── Cursor distance label ─────────────────────────────────────────────────
    // Show bearing + distance from sub to cursor while mouse is in chart area
    {
      const mx=window.I?.mouseX??-1, my=window.I?.mouseY??-1;
      const inChart=mx>=0 && mx<(W-STRIP_W) && my>=0 && my<(H-panelH);
      if(inChart){
        // Convert cursor screen pos → world pos
        const mwx = cam.x + (mx - cx) / Z;
        const mwy = cam.y + (my - cy) / Z;
        // Delta from player sub
        let ddx = mwx - player.wx;
        if(ddx >  world.w/2) ddx -= world.w;
        if(ddx < -world.w/2) ddx += world.w;
        const ddy = mwy - player.wy;
        const distWU = Math.hypot(ddx, ddy);
        const distNM = distWU / 185.2;
        const distM  = distWU * 10;
        const brgRaw = Math.atan2(ddy, ddx);
        const brgDeg = (((Math.atan2(Math.cos(brgRaw), -Math.sin(brgRaw)) * 180/Math.PI) + 360) % 360);

        // Format distance: show nm if ≥0.1nm, else metres
        const distLabel = distNM >= 0.1
          ? `${distNM.toFixed(1)}nm`
          : `${Math.round(distM)}m`;
        const fullLabel = `${Math.round(brgDeg).toString().padStart(3,'0')}°  ${distLabel}`;

        // Draw a small crosshair at cursor
        ctx.strokeStyle='rgba(17,24,39,0.30)';
        ctx.lineWidth=1;
        const CR=6*DPR;
        ctx.beginPath();
        ctx.moveTo(mx-CR,my); ctx.lineTo(mx+CR,my);
        ctx.moveTo(mx,my-CR); ctx.lineTo(mx,my+CR);
        ctx.stroke();

        // Line from sub to cursor
        const [spx,spy]=w2s(player.wx,player.wy);
        ctx.strokeStyle='rgba(17,24,39,0.10)';
        ctx.lineWidth=1;
        ctx.setLineDash([4,5]);
        ctx.beginPath(); ctx.moveTo(spx,spy); ctx.lineTo(mx,my); ctx.stroke();
        ctx.setLineDash([]);

        // Label pill just above cursor
        const pad=5*DPR;
        ctx.font=`${9*DPR}px ui-monospace,monospace`;
        ctx.textAlign='left';
        const tw=ctx.measureText(fullLabel).width;
        const lx=mx+10*DPR, ly=my-14*DPR;
        ctx.fillStyle='rgba(255,255,255,0.80)';
        ctx.beginPath();
        ctx.roundRect(lx-pad, ly-9*DPR, tw+pad*2, 13*DPR, 3*DPR);
        ctx.fill();
        ctx.fillStyle='rgba(17,24,39,0.85)';
        ctx.fillText(fullLabel, lx, ly);
      }
    }

    // ── Hit flash ─────────────────────────────────────────────────────────────
    if(game.hitFlash>0){
      ctx.fillStyle=`rgba(180,20,20,${game.hitFlash*0.35})`;
      ctx.fillRect(0,0,W,H);
      // Damage alerts — stack above panel
      const dmg=player.damage;
      if(dmg?.alerts?.length>0){
        const a=dmg.alerts[dmg.alerts.length-1];
        const alpha=clamp(a.t/1.5,0,1);
        ctx.fillStyle=`rgba(220,38,38,${alpha*0.90})`;
        ctx.font=`bold ${13*DPR}px ui-monospace,monospace`;
        ctx.textAlign='center';
        ctx.fillText(a.text, W/2, H-panelH-30*DPR);
      }
    }

    // ── Free-cam indicator ────────────────────────────────────────────────────
    if(cam.free){
      ctx.save();
      // Badge top-left of chart
      ctx.fillStyle='rgba(217,119,6,0.90)';
      ctx.font=`bold ${9*DPR}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillText('🔓 FREE CAM  —  Home to re-centre', 12*DPR, 16*DPR);
      // Player position pip — small circle at player's true screen location
      const [ppx2,ppy2]=w2s(player.wx,player.wy);
      const onScreen=ppx2>=0&&ppx2<=plotW&&ppy2>=0&&ppy2<=(H-panelH);
      if(!onScreen){
        // Off-screen arrow pointing toward player
        const ax=clamp(ppx2,20*DPR,plotW-20*DPR);
        const ay=clamp(ppy2,20*DPR,(H-panelH)-20*DPR);
        ctx.strokeStyle='rgba(217,119,6,0.85)';
        ctx.fillStyle='rgba(217,119,6,0.85)';
        ctx.lineWidth=1.5;
        doodleCircle(ax,ay,7*DPR,1.5);
        ctx.font=`${7*DPR}px ui-monospace,monospace`;
        ctx.textAlign='center';
        ctx.fillText('YOU',ax,ay+3*DPR);
      } else {
        // Subtle amber ring around player
        ctx.strokeStyle='rgba(217,119,6,0.55)';
        ctx.lineWidth=1.5;
        ctx.setLineDash([4,4]);
        ctx.beginPath(); ctx.arc(ppx2,ppy2,14*DPR,0,Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    }

    // ── DEBUG: true enemy position overlay (` to toggle) ────────────────────
    if(game.debugOverlay){
      ctx.save();
      for(const e of enemies){
        if(e.dead) continue;
        const [ex,ey]=w2s(e.x,e.y);
        if(ex<-40||ex>plotW+40) continue;
        // Bright magenta crosshair
        const r=10*DPR;
        ctx.strokeStyle='rgba(255,0,220,0.85)';
        ctx.lineWidth=1.5;
        ctx.beginPath();
        ctx.moveTo(ex-r,ey); ctx.lineTo(ex+r,ey);
        ctx.moveTo(ex,ey-r); ctx.lineTo(ex,ey+r);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(ex,ey,r*0.45,0,Math.PI*2); ctx.stroke();
        // Label: type, speed, suspicion
        const spd=Math.round(Math.hypot(e.vx||0,e.vy||0));
        const sus=Math.round((e.suspicion||0)*100);
        const role=e.role?` [${e.role.slice(0,3).toUpperCase()}]`:'';
        const label=`${e.type.toUpperCase()}${role} ${spd}kt sus${sus}%`;
        ctx.font=`${8*DPR}px ui-monospace,monospace`;
        ctx.textAlign='left';
        ctx.fillStyle='rgba(255,0,220,0.90)';
        ctx.fillText(label, ex+r+3*DPR, ey+3*DPR);
      }
      // ── All torpedoes ──────────────────────────────────────────────────────
      for(const b of bullets){
        if(b.kind!=='torpedo'||b.life<=0) continue;
        const [tx,ty]=w2s(b.x,b.y);
        if(tx<-40||tx>plotW+40) continue;
        const isFriendly=b.friendly;
        // Friendly = cyan, enemy = orange
        const col=isFriendly?'rgba(0,230,255,0.90)':'rgba(255,140,0,0.90)';
        ctx.strokeStyle=col; ctx.fillStyle=col;
        ctx.lineWidth=1.5;
        // Arrow showing heading direction
        const bvx=b.vx||0, bvy=b.vy||0;
        const bspd=Math.hypot(bvx,bvy);
        const bAng=bspd>0?Math.atan2(bvy,bvx):0;
        const ar=12*DPR;
        ctx.beginPath();
        ctx.moveTo(tx-Math.cos(bAng)*ar, ty-Math.sin(bAng)*ar);
        ctx.lineTo(tx+Math.cos(bAng)*ar, ty+Math.sin(bAng)*ar);
        ctx.stroke();
        // Diamond marker at tip
        ctx.beginPath(); ctx.arc(tx+Math.cos(bAng)*ar,ty+Math.sin(bAng)*ar,3*DPR,0,Math.PI*2); ctx.fill();
        // Label
        const tLabel=`${isFriendly?'OWN':'ENM'} ${b.torpId||'?'} d${Math.round(b.depth||0)}m${b.target===player?' ●HOM':''}`;
        ctx.font=`${7.5*DPR}px ui-monospace,monospace`; ctx.textAlign='left';
        ctx.fillText(tLabel, tx+ar+3*DPR, ty+3*DPR);
      }

      // Corner badge
      ctx.fillStyle='rgba(255,0,220,0.80)';
      ctx.font=`bold ${9*DPR}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillText('[ DEBUG ] TRUE POS + TORPEDOES', 12*DPR, (H-panelH)-10*DPR);

      // Threat bar — enemy suspicion state
      drawThreatBar(W);

      ctx.restore();
    }
  }

  // Extend window.R (set by render-utils.js) with the draw entry point
  window.R.draw=draw;
})();