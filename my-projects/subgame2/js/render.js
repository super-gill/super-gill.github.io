(() => {
  'use strict';
  const C=window.CONFIG;
  const {TAU,clamp,lerp,now,jitter,deg2rad}=window.M;
  const {ctx,canvas,DPR,world,cam,bullets,particles,enemies,decoys,contacts,cwisTracers,wireContacts,sonarContacts,player,game,setMsg,wrecks,buoys,missiles}=window.G;
  const AI=window.AI;
  const {doodleLine,doodleCircle,doodleText,w2s,wScale,PANEL_H,STRIP_W,U}=window.R;
  const {drawLand,drawRoute,drawPlayerTopDown,drawEnemySubTopDown,drawEnemyBoatTopDown,drawTorpedoTopDown}=window.RWORLD;
  const {drawDepthStrip,drawThreatBar,drawNavCompass}=window.RHUD;
  const {drawStartScreen,drawLogPanel,drawDcPanel,drawDamagePanel,drawCrewPanel,drawDamageScreen,drawPanel,drawEndScreen}=window.RPANEL;

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

    // ── End screens (game over / victory) ───────────────────────────────────
    if(game.over){
      drawEndScreen(W,H);
      return;
    }
    if(game.won){
      // Hold victory screen while enemy torpedoes are still running — player may still need to evade
      const enemyTorpsAlive = bullets.some(b => b.kind==='torpedo' && !b.friendly && b.life>0);
      if(!enemyTorpsAlive){
        drawEndScreen(W,H);
        return;
      }
      // Fall through — world keeps rendering so the player can defend
    }

    const seaColour=window.MAPS?.getMap()?.seaColour||'#daeaf7';
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
    const SC=window.G.sonarContacts;
    const TMA_CFG=window.CONFIG?.tma;
    if(SC && TMA_CFG){
      const t2=performance.now()/1000;
      const maxBrgLine=wScale(TMA_CFG.defaultRange*1.4);

      for(const [e,c] of SC){
        const fresh=c.activeT>0;
        const T_game=game.missionT||0;
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
            if(q<0.2) doodleText('BRG', lx+U(4), ly+U(5), U(6), 'left');
            else if(q<0.6){ ctx.fillStyle=`rgba(217,119,6,${alpha*0.75})`; doodleText('BLDG', lx+U(4), ly+U(5), U(6), 'left'); }
            else { ctx.fillStyle=`rgba(22,163,74,${alpha*0.75})`; doodleText('SOLID', lx+U(4), ly+U(5), U(6), 'left'); }

            // ── CLSNG / OPNG / CBDR tag ─────────────────────────────────────
            // Range rate (from TMA triangle diff) → closing or opening classification.
            // Falls back to bearing-rate direction if range not yet estimated.
            {
              const rr=c._rangeRate, br=c._brgRate;
              let tag=null, tagCol=null;
              if(rr!=null){
                const cbdr=Math.abs(br??0)<0.0006 && rr<-8;
                if(cbdr){
                  tag='CBDR'; tagCol=`rgba(180,30,30,${alpha*0.90})`;
                } else if(rr<-8){
                  tag='CLSNG'; tagCol=`rgba(180,30,30,${alpha*0.72})`;
                } else if(rr>8){
                  tag='OPNG'; tagCol=`rgba(40,110,50,${alpha*0.72})`;
                }
              } else if(br!=null && Math.abs(br)>0.0008){
                // No range yet — show drift direction as fallback
                tag=br>0?'R DRIFT':'L DRIFT';
                tagCol=`rgba(100,100,100,${alpha*0.55})`;
              }
              if(tag){
                ctx.fillStyle=tagCol;
                doodleText(tag, lx+U(4), ly+U(14), U(6), 'left');
              }
            }
          }
        }

        // ── Estimated contact position + heading arrow ──────────────────────
        // Shown when TMA triangle geometry yields a heading estimate
        if(c._estHeading!=null && c._estRange!=null){
          const headingAge=T_game-(c._estHeadingT||0);
          if(headingAge<90){
            const conf=(c._estHeadingConf||0)*(1-Math.min(1,headingAge/90));
            if(conf>0.06){
              // Project contact position: origin + bearing ray * estimated range
              const ox=c.latestFromX??player.wx, oy=c.latestFromY??player.wy;
              const cpx=ox+Math.cos(c.latestBrg??0)*c._estRange;
              const cpy=oy+Math.sin(c.latestBrg??0)*c._estRange;
              const [scx,scy]=w2s(cpx,cpy);
              // Dot at estimated position
              ctx.fillStyle=`rgba(17,24,39,${alpha*clamp(conf*1.2,0,0.75)})`;
              ctx.beginPath(); ctx.arc(scx,scy,U(3),0,Math.PI*2); ctx.fill();
              // Heading arrow — compute in world space, convert tip to screen
              const arrowLen=800+conf*600;
              const tipX=cpx+Math.cos(c._estHeading)*arrowLen;
              const tipY=cpy+Math.sin(c._estHeading)*arrowLen;
              const [stx,sty]=w2s(tipX,tipY);
              const aAlpha=alpha*clamp(conf*1.1,0,0.70);
              ctx.strokeStyle=`rgba(17,24,39,${aAlpha})`;
              ctx.lineWidth=1.5; ctx.setLineDash([]);
              ctx.beginPath(); ctx.moveTo(scx,scy); ctx.lineTo(stx,sty); ctx.stroke();
              // Arrowhead — screen space
              const ang=Math.atan2(sty-scy,stx-scx);
              const aw=U(5);
              ctx.beginPath();
              ctx.moveTo(stx,sty);
              ctx.lineTo(stx+Math.cos(ang+2.6)*aw, sty+Math.sin(ang+2.6)*aw);
              ctx.moveTo(stx,sty);
              ctx.lineTo(stx+Math.cos(ang-2.6)*aw, sty+Math.sin(ang-2.6)*aw);
              ctx.stroke();
              // Compass heading label
              if(conf>0.25){
                const hdgDeg=(((Math.atan2(Math.cos(c._estHeading),-Math.sin(c._estHeading))*180/Math.PI)+360)%360);
                ctx.fillStyle=`rgba(17,24,39,${alpha*conf*0.65})`;
                doodleText(Math.round(hdgDeg).toString().padStart(3,'0')+'°', scx+U(5), scy-U(8), U(7), 'left');
              }
              // ── Contact aspect — bow/beam/stern relative to player ──────────
              // Target angle: angle between contact heading and its bearing toward player.
              // 0° = bow-on (heading at us), 90° = beam, 180° = stern (we're in their baffles).
              if(conf>0.30){
                const brgToPlayer=(c.latestBrg??0)+Math.PI;
                const aspectRad=Math.abs(((c._estHeading-brgToPlayer+3*Math.PI)%(Math.PI*2))-Math.PI);
                let aspect;
                if(aspectRad<Math.PI/6)       aspect='BOW';
                else if(aspectRad<Math.PI/3)  aspect='F.QTR';
                else if(aspectRad<2*Math.PI/3) aspect='BEAM';
                else if(aspectRad<5*Math.PI/6) aspect='A.QTR';
                else                           aspect='STERN';
                // STERN = we may be in their baffles — highlight it
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

    // ── Towed array — deaf cone + ambiguous bearing lines ───────────────────
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
                doodleText(`${c.id} ?`, lx+U(4), ly-U(4), U(8), 'left');
                doodleText('TURN TO RESOLVE', lx+U(4), ly+U(5), U(6), 'left');
              }
            }
          }
        }
      }
    }

    // ── Passive contact flashes ─────────────────────────────────────────────
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

    // ── Decoys ────────────────────────────────────────────────────────────────
    for(const d of decoys){
      const [dx,dy]=w2s(d.x,d.y);
      const pulse=0.6+0.4*Math.sin((game.missionT||0)*6 + d.x);
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

    // ── ASROC rockets ────────────────────────────────────────────────────────
    for(const b of bullets){
      if(b.kind!=='rocket'||b.life<=0) continue;
      const [rx,ry]=w2s(b.x,b.y);
      if(rx<-40||rx>plotW+40||ry<-40||ry>plotH+40) continue;
      const ang=Math.atan2(b.vy,b.vx);
      ctx.save();
      ctx.translate(rx,ry); ctx.rotate(ang);
      // Rocket body — bright orange dart
      ctx.strokeStyle='rgba(255,120,20,0.95)';
      ctx.lineWidth=2.5;
      doodleLine(-U(10),0, U(10),0, 2.5);
      doodleLine(U(8),-U(3), U(10),0, 2);
      doodleLine(U(8),U(3),  U(10),0, 2);
      // Contrail
      ctx.strokeStyle='rgba(255,200,80,0.40)';
      ctx.lineWidth=1.5;
      ctx.setLineDash([U(4),U(4)]);
      doodleLine(-U(10),0, -U(25),0, 1.5);
      ctx.setLineDash([]);
      ctx.restore();
      ctx.fillStyle='rgba(255,140,30,0.85)';
      doodleText('ASROC', rx+U(12), ry-U(5), U(7), 'left');
    }

    // ── Cruise missiles ───────────────────────────────────────────────────────
    if(missiles){
      for(const m of missiles){
        const [mx,my]=w2s(m.x,m.y);
        if(mx<-60||mx>plotW+60||my<-60||my>plotH+60) continue;
        // Trail
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
        // Body — red dart
        const ang=Math.atan2(m.vy,m.vx);
        ctx.save();
        ctx.translate(mx,my); ctx.rotate(ang);
        ctx.strokeStyle='rgba(240,40,40,0.95)'; ctx.lineWidth=2.5;
        doodleLine(-U(8),0,U(8),0,2.5);
        doodleLine(U(6),-U(3),U(8),0,2);
        doodleLine(U(6),U(3),U(8),0,2);
        ctx.restore();
        // State label
        const mLbl=m.state==='seeker_active'?(m.target?'LOCKED':'SEEK'):'MSL';
        ctx.fillStyle=m.target?'rgba(240,40,40,0.90)':'rgba(220,80,80,0.80)';
        doodleText(mLbl,mx+U(10),my-U(5),U(7),'left');
      }
    }

    // ── Depth charges ─────────────────────────────────────────────────────────
    for(const b of bullets){
      if(b.kind!=='depthCharge'||b.life<=0) continue;
      const [dcx,dcy]=w2s(b.x,b.y);
      if(dcx<-20||dcx>plotW+20||dcy<-20||dcy>plotH+20) continue;
      const bw=U(7), bh=U(5);
      // Barrel body
      ctx.fillStyle='rgba(160,90,30,0.88)';
      ctx.strokeStyle='rgba(220,140,50,0.95)';
      ctx.lineWidth=1.5;
      ctx.beginPath();
      ctx.roundRect(dcx-bw/2, dcy-bh/2, bw, bh, U(1.5));
      ctx.fill(); ctx.stroke();
      // Band lines
      ctx.strokeStyle='rgba(240,180,70,0.70)';
      ctx.lineWidth=1;
      ctx.beginPath();
      ctx.moveTo(dcx-bw/2+U(2), dcy-bh/2); ctx.lineTo(dcx-bw/2+U(2), dcy+bh/2);
      ctx.moveTo(dcx+bw/2-U(2), dcy-bh/2); ctx.lineTo(dcx+bw/2-U(2), dcy+bh/2);
      ctx.stroke();
      // Label
      ctx.fillStyle='rgba(240,160,50,0.80)';
      doodleText(`DC ${Math.round(b.y)}m`, dcx+bw/2+U(4), dcy+U(4), U(7.5), 'left');
    }

    // ── Wire-fed contacts ─────────────────────────────────────────────────────
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
    // Stern deaf wedge (speed-dependent) + rolloff zone + amber edge lines when widening
    {
      const heading=player.heading||0;
      const sg=C.player.sonar||{};
      const baffleBase=(sg.baffleHalfAngleDegBase??15)*Math.PI/180;
      const baffleMax =(sg.baffleHalfAngleDegMax ??45)*Math.PI/180;
      const baffleHalf=clamp(baffleBase+(player.speed||0)*(sg.baffleHalfAngleDegPerKt??1.5)*Math.PI/180,baffleBase,baffleMax);
      const rolloff   =(sg.baffleRolloffDeg??20)*Math.PI/180;
      const stern     =heading+Math.PI;
      const deadLen   =wScale(900);
      // speedRatio: 0 at ≤4kt, 1 at ≥14kt — drives amber intensity
      const speedRatio=clamp(((player.speed||0)-4)/10,0,1);

      ctx.save();
      // Rolloff zone — wider but lighter
      ctx.globalAlpha=0.04+speedRatio*0.04;
      ctx.fillStyle='rgba(17,24,39,1)';
      ctx.beginPath();
      ctx.moveTo(ppx,ppy);
      ctx.arc(ppx,ppy,deadLen,stern-(baffleHalf+rolloff),stern+(baffleHalf+rolloff));
      ctx.closePath();
      ctx.fill();
      // Dead zone core — darker
      ctx.globalAlpha=0.07+speedRatio*0.06;
      ctx.fillStyle='rgba(17,24,39,1)';
      ctx.beginPath();
      ctx.moveTo(ppx,ppy);
      ctx.arc(ppx,ppy,deadLen,stern-baffleHalf,stern+baffleHalf);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Amber edge lines — appear as baffle widens with speed
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

      // "HULL" label — only when speed is significant so it doesn't clash with towed "DEAF"
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
    if(window.I&&window.I.shiftHeld){
      const [ppx2,ppy2]=w2s(player.wx,player.wy);
      const aimDx=window.I.aimWorldX-player.wx;
      const aimDy=window.I.aimWorldY-player.wy;
      const aimAng=Math.atan2(aimDy,aimDx);
      const aimLen=wScale(C.player.torpWireMaxRange*0.65);

      const {angleNorm:aN}=window.M;
      const offset=Math.abs(aN(aimAng-player.heading));
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
        const age=Math.floor((game.missionT||0)-w.t);
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
        // Pulsing ring when actively pinging
        if(b.pingPulse>0){
          const pulseR=sz+wScale(18)*(1-b.pingPulse);
          ctx.strokeStyle=`rgba(60,160,255,${b.pingPulse*0.5})`;
          ctx.lineWidth=1.2;
          ctx.beginPath(); ctx.arc(bx,by,pulseR,0,TAU); ctx.stroke();
        }
        // Buoy body — small diamond
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
      // Dipping sonar pulse when hovering and pinging
      if(h.state==='hover' && h.pingPulse>0){
        const pulseR=sz+wScale(25)*(1-h.pingPulse);
        ctx.strokeStyle=`rgba(255,180,40,${h.pingPulse*0.5})`;
        ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.arc(hx,hy,pulseR,0,TAU); ctx.stroke();
      }
      // Helicopter body — small circle with rotor lines
      const col=h.state==='hover'?'rgba(255,180,40,0.75)':'rgba(200,160,60,0.50)';
      ctx.fillStyle=col; ctx.strokeStyle=col;
      ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.arc(hx,hy,sz*0.55,0,TAU); ctx.fill();
      // Rotor cross
      const rr=sz*1.2;
      const spin=(now()*4)%(Math.PI*2);
      ctx.beginPath();
      ctx.moveTo(hx+Math.cos(spin)*rr, hy+Math.sin(spin)*rr);
      ctx.lineTo(hx-Math.cos(spin)*rr, hy-Math.sin(spin)*rr);
      ctx.moveTo(hx+Math.cos(spin+Math.PI/2)*rr, hy+Math.sin(spin+Math.PI/2)*rr);
      ctx.lineTo(hx-Math.cos(spin+Math.PI/2)*rr, hy-Math.sin(spin+Math.PI/2)*rr);
      ctx.stroke();
      // Label
      ctx.fillStyle=col;
      doodleText(h.state==='hover'?'DIP':'HELO',hx+sz*1.8,hy+U(2),U(7),'left');
    }

    // ── TDC intercept bearing line ──────────────────────────────────────────
    {
      const tdc=game.tdc;
      const wp=game.wepsProposal;
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
      const mx=window.I?.mouseX??-1, my=window.I?.mouseY??-1;
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
    if(game.hitFlash>0){
      ctx.fillStyle=`rgba(180,20,20,${game.hitFlash*0.35})`;
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
    if(game.debugOverlay){
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
        const noisePart=game.debugNoise
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
    if(game.won){
      const enemyTorps = bullets.filter(b => b.kind==='torpedo' && !b.friendly && b.life>0);
      const pulse = 0.65 + 0.35*Math.sin(performance.now()*0.004);
      ctx.fillStyle=`rgba(20,200,120,${0.85*pulse})`;
      ctx.font=`bold ${U(11)}px ui-monospace,monospace`;
      ctx.textAlign='center';
      ctx.fillText(`MISSION COMPLETE — ${enemyTorps.length} INBOUND — HOLD ON`,(W-STRIP_W)/2,U(48));
    }

    // ── UI Scale indicator (bottom-right of chart, above panel) ──────────────
    {
      const scale = window.UI?.getScale() || 1.0;
      if(scale !== 1.0){
        const label = `UI ${Math.round(scale*100)}%`;
        ctx.fillStyle='rgba(17,24,39,0.30)';
        ctx.font=`${U(8)}px ui-monospace,monospace`;
        ctx.textAlign='right';
        ctx.fillText(label, W-STRIP_W-U(8), H-panelH-U(8));
      }
    }
  }

  window.R.draw=draw;
})();
