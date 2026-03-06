(() => {
  'use strict';
  const C=window.CONFIG;
  const {TAU,clamp,lerp,now,jitter,deg2rad}=window.M;
  const {ctx,canvas,DPR,world,cam,bullets,particles,enemies,decoys,contacts,cwisTracers,wireContacts,ghostContacts,player,game}=window.G;
  const AI=window.AI;

  // ── Doodle primitives ────────────────────────────────────────────────────────
  function doodleLine(x1,y1,x2,y2,w=2){
    const steps=Math.max(4,Math.floor(Math.hypot(x2-x1,y2-y1)/22));
    ctx.lineWidth=w; ctx.beginPath();
    for(let i=0;i<=steps;i++){
      const t=i/steps;
      const x=x1+(x2-x1)*t+Math.sin(t*6.28)*jitter(0.8);
      const y=y1+(y2-y1)*t+Math.cos(t*6.28)*jitter(0.8);
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
  function doodleCircle(x,y,r,w=2){
    ctx.lineWidth=w; ctx.beginPath();
    const k=20;
    for(let i=0;i<=k;i++){
      const a=(i/k)*TAU;
      const rr=r+Math.sin(a*3)*jitter(0.6);
      ctx.lineTo(x+Math.cos(a)*rr, y+Math.sin(a)*rr);
    }
    ctx.closePath(); ctx.stroke();
  }
  function doodleText(txt,x,y,size=14,align="left"){
    ctx.font=`${size}px ui-rounded,system-ui,Arial`;
    ctx.textAlign=align; ctx.fillText(txt,x,y);
  }

  // ── World → screen ────────────────────────────────────────────────────────────
  // Returns pixel coords for a world position, centred on cam.x/cam.y
  function w2s(wx,wy){
    const Z=cam.zoom*DPR;
    const cx=canvas.width/2, cy=canvas.height/2;
    let dx=wx-cam.x;
    let dy=wy-cam.y;
    // Wrap shortest path
    if(dx>world.w/2) dx-=world.w;
    if(dx<-world.w/2) dx+=world.w;
    if(dy>world.h/2) dy-=world.h;
    if(dy<-world.h/2) dy+=world.h;
    return [cx+dx*Z, cy+dy*Z];
  }
  function wScale(wu){ return wu*cam.zoom*DPR; }

  // ── Land rendering ───────────────────────────────────────────────────────────
  function drawLand(){
    const map=window.MAPS.getMap();
    const Z=cam.zoom*DPR;
    const cx=canvas.width/2, cy=canvas.height/2;

    function toScreen(wx,wy){
      let dx=wx-cam.x; if(dx>world.w/2)dx-=world.w; if(dx<-world.w/2)dx+=world.w;
      let dy=wy-cam.y; if(dy>world.h/2)dy-=world.h; if(dy<-world.h/2)dy+=world.h;
      return [cx+dx*Z, cy+dy*Z];
    }

    for(const poly of map.land){
      // Fill
      ctx.fillStyle='#c8b89a';
      ctx.beginPath();
      for(let i=0;i<poly.length;i++){
        const [sx,sy]=toScreen(poly[i].x,poly[i].y);
        if(i===0) ctx.moveTo(sx,sy); else ctx.lineTo(sx,sy);
      }
      ctx.closePath(); ctx.fill();
      // Coastline — doodle stroke
      ctx.strokeStyle='rgba(17,24,39,0.25)';
      ctx.lineWidth=2;
      ctx.beginPath();
      for(let i=0;i<poly.length;i++){
        const [sx,sy]=toScreen(poly[i].x,poly[i].y);
        if(i===0) ctx.moveTo(sx,sy); else ctx.lineTo(sx,sy);
      }
      ctx.closePath(); ctx.stroke();
    }
  }

  // ── Route rendering ──────────────────────────────────────────────────────────
  function drawRoute(){
    const route=window.ROUTE;
    if(!route||route.length===0) return;
    const [ppx,ppy]=w2s(player.wx,player.wy);

    ctx.strokeStyle='rgba(17,24,39,0.28)';
    ctx.lineWidth=1.5;
    ctx.setLineDash([6,6]);
    ctx.beginPath();
    ctx.moveTo(ppx,ppy);
    for(const wp of route){
      const [wx2,wy2]=w2s(wp.wx,wp.wy);
      ctx.lineTo(wx2,wy2);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Waypoint circles
    for(let i=0;i<route.length;i++){
      const [wx2,wy2]=w2s(route[i].wx,route[i].wy);
      ctx.strokeStyle='rgba(17,24,39,0.45)';
      ctx.lineWidth=1.5;
      doodleCircle(wx2,wy2,6,1.5);
      ctx.fillStyle='rgba(17,24,39,0.30)';
      doodleText(`${i+1}`,wx2+9,wy2+4,9*DPR,'left');
    }
  }
  // Drawn at (0,0) pointing right (+x), caller rotates
  function drawPlayerTopDown(r){
    const sc=r/28;
    ctx.lineWidth=2;
    const L=68*sc, Hw=13*sc; // length, half-width

    // Hull: teardrop from above — broad amidships, pointed bow and stern
    ctx.beginPath();
    const pts=24;
    for(let i=0;i<=pts;i++){
      const t=i/pts;
      const x=lerp(-L*0.55,L*0.45,t);
      const bulge=t<0.15?Math.pow(t/0.15,0.6):t>0.82?Math.pow((1-t)/0.18,0.5):1.0;
      const wx2=Math.sin(t*29.1)*0.5*sc;
      const wy2=Math.sin(t*17.3+1.1)*0.4*sc;
      if(i===0) ctx.moveTo(x+wx2,-bulge*Hw+wy2); else ctx.lineTo(x+wx2,-bulge*Hw+wy2);
    }
    for(let i=pts;i>=0;i--){
      const t=i/pts;
      const x=lerp(-L*0.55,L*0.45,t);
      const bulge=t<0.15?Math.pow(t/0.15,0.6):t>0.82?Math.pow((1-t)/0.18,0.5):1.0;
      const wx2=Math.sin(t*29.1+0.4)*0.5*sc;
      const wy2=Math.sin(t*17.3+2.9)*0.4*sc;
      ctx.lineTo(x+wx2,+bulge*Hw+wy2);
    }
    ctx.closePath(); ctx.stroke();

    // Sail: rectangle near bow
    const sX=8*sc, sW=14*sc, sH=7*sc;
    doodleLine(sX-sW*0.5,-sH*0.5, sX+sW*0.5,-sH*0.5, 2);
    doodleLine(sX+sW*0.5,-sH*0.5, sX+sW*0.5,+sH*0.5, 2);
    doodleLine(sX+sW*0.5,+sH*0.5, sX-sW*0.5,+sH*0.5, 2);
    doodleLine(sX-sW*0.5,+sH*0.5, sX-sW*0.5,-sH*0.5, 2);

    // Heading arrow — fine line from centre to bow tip
    ctx.strokeStyle='rgba(17,24,39,0.35)';
    doodleLine(0,0, L*0.45,0, 1.5);
  }

  // ── Enemy sub (top-down Victor III) ──────────────────────────────────────────
  function drawEnemySubTopDown(r){
    const sc=r/30;
    ctx.lineWidth=2;
    const L=58*sc, Hw=14*sc;
    ctx.beginPath();
    const pts=20;
    for(let i=0;i<=pts;i++){
      const t=i/pts;
      const x=lerp(-L*0.55,L*0.45,t);
      const bulge=t<0.12?Math.pow(t/0.12,0.5):t>0.78?Math.pow((1-t)/0.22,0.45):1.0;
      const wx2=Math.sin(t*27.3)*0.5*sc, wy2=Math.sin(t*14.1+0.8)*0.4*sc;
      if(i===0) ctx.moveTo(x+wx2,-bulge*Hw+wy2); else ctx.lineTo(x+wx2,-bulge*Hw+wy2);
    }
    for(let i=pts;i>=0;i--){
      const t=i/pts;
      const x=lerp(-L*0.55,L*0.45,t);
      const bulge=t<0.12?Math.pow(t/0.12,0.5):t>0.78?Math.pow((1-t)/0.22,0.45):1.0;
      const wx2=Math.sin(t*27.3+0.5)*0.5*sc, wy2=Math.sin(t*14.1+3.1)*0.4*sc;
      ctx.lineTo(x+wx2,+bulge*Hw+wy2);
    }
    ctx.closePath(); ctx.stroke();
    // Boxy sail
    doodleLine(-4*sc,-6*sc, 10*sc,-6*sc, 2);
    doodleLine(10*sc,-6*sc, 10*sc,6*sc, 2);
    doodleLine(10*sc,6*sc, -4*sc,6*sc, 2);
    doodleLine(-4*sc,6*sc, -4*sc,-6*sc, 2);
  }

  // ── Enemy boat (top-down frigate) ─────────────────────────────────────────────
  function drawEnemyBoatTopDown(r){
    const sc=r/34;
    ctx.lineWidth=2;
    const L=70*sc, Hw=14*sc;
    // Hull outline
    ctx.beginPath();
    ctx.moveTo(L*0.45,0);                  // bow
    ctx.lineTo(L*0.10,-Hw);               // fwd port
    ctx.lineTo(-L*0.55,-Hw*0.80);         // amidships port
    ctx.lineTo(-L*0.55-4*sc,-Hw*0.5);    // stern port
    ctx.lineTo(-L*0.55-4*sc,Hw*0.5);     // stern starboard
    ctx.lineTo(-L*0.55,Hw*0.80);          // amidships starboard
    ctx.lineTo(L*0.10,Hw);                // fwd starboard
    ctx.closePath(); ctx.stroke();
    // Superstructure block
    doodleLine(-10*sc,-Hw*0.5, 20*sc,-Hw*0.5, 1.5);
    doodleLine(20*sc,-Hw*0.5, 20*sc,Hw*0.5, 1.5);
    doodleLine(20*sc,Hw*0.5, -10*sc,Hw*0.5, 1.5);
    doodleLine(-10*sc,Hw*0.5, -10*sc,-Hw*0.5, 1.5);
    // Mast dot
    doodleCircle(8*sc,0, 3*sc, 1.5);
  }

  // ── Torpedo (top-down slim dart) ─────────────────────────────────────────────
  function drawTorpedoTopDown(b){
    ctx.lineWidth=2;
    const ang=Math.atan2(b.vy,b.vx);
    ctx.save();
    const [sx,sy]=w2s(b.x,b.y);
    ctx.translate(sx,sy); ctx.rotate(ang);
    ctx.strokeStyle=b.friendly?'#0f172a':'rgba(15,23,42,0.6)';
    doodleLine(-10,0, 10,0, 2.5);
    doodleLine(8,-3, 10,0, 2);
    doodleLine(8,3, 10,0, 2);
    ctx.restore();
  }

  // ── Depth strip (right side) ──────────────────────────────────────────────────
  function drawDepthStrip(W,H){
    const stripW=56*DPR;
    const stripX=W-stripW;
    const padT=80*DPR, padB=60*DPR;
    const stripH=H-padT-padB;

    // Background
    ctx.fillStyle='rgba(247,247,251,0.92)';
    ctx.fillRect(stripX,0,stripW,H);
    ctx.strokeStyle='rgba(17,24,39,0.12)';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(stripX,0); ctx.lineTo(stripX,H); ctx.stroke();

    // Label
    ctx.fillStyle='rgba(17,24,39,0.5)';
    doodleText('DEPTH',stripX+stripW/2,padT-14*DPR,10*DPR,'center');

    const maxDepth=world.ground;
    function depthToY(d){ return padT+clamp(d/maxDepth,0,1)*stripH; }

    // Layer band
    const ly1=depthToY(world.layerY1), ly2=depthToY(world.layerY2);
    ctx.fillStyle='rgba(99,102,241,0.10)';
    ctx.fillRect(stripX,ly1,stripW,ly2-ly1);
    ctx.strokeStyle='rgba(99,102,241,0.30)';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(stripX,ly1); ctx.lineTo(W,ly1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(stripX,ly2); ctx.lineTo(W,ly2); ctx.stroke();
    ctx.fillStyle='rgba(99,102,241,0.45)';
    doodleText('LAYER',stripX+4,ly1+10*DPR,8*DPR,'left');

    // Seabed
    const groundY=depthToY(world.ground);
    ctx.fillStyle='rgba(17,24,39,0.08)';
    ctx.fillRect(stripX,groundY,stripW,H-groundY);
    ctx.strokeStyle='rgba(17,24,39,0.25)';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(stripX,groundY); ctx.lineTo(W,groundY); ctx.stroke();

    // Depth tick marks
    ctx.strokeStyle='rgba(17,24,39,0.18)';
    ctx.fillStyle='rgba(17,24,39,0.40)';
    for(let d=0;d<=maxDepth;d+=200){
      const ty=depthToY(d);
      ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(stripX,ty); ctx.lineTo(stripX+8*DPR,ty); ctx.stroke();
      if(d%400===0) doodleText(d+'m',stripX+10*DPR,ty+4,8*DPR,'left');
    }

    // Enemy depth indicators — small ticks for known contacts
    for(const e of enemies){
      if((e.detectedT||0)<=0) continue;
      const d2=e.depth??0;
      const ty=depthToY(d2);
      ctx.strokeStyle='rgba(17,24,39,0.55)';
      ctx.fillStyle='rgba(17,24,39,0.55)';
      ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(stripX,ty); ctx.lineTo(stripX+14*DPR,ty); ctx.stroke();
      doodleText(e.type==='boat'?'▲':'●',stripX+16*DPR,ty+4,8*DPR,'left');
    }

    // Player depth indicator — solid triangle marker
    const pd=depthToY(player.depth);
    ctx.fillStyle='#111827';
    ctx.beginPath();
    ctx.moveTo(stripX-1,pd);
    ctx.lineTo(stripX+14*DPR,pd-7*DPR);
    ctx.lineTo(stripX+14*DPR,pd+7*DPR);
    ctx.closePath(); ctx.fill();

    // Ordered depth — dashed line
    const od=depthToY(player.depthOrder);
    ctx.strokeStyle='rgba(17,24,39,0.30)';
    ctx.setLineDash([4,4]);
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(stripX,od); ctx.lineTo(W,od); ctx.stroke();
    ctx.setLineDash([]);
    doodleText('ORD',stripX+4,od-3,8*DPR,'left');

    // Depth readout
    ctx.fillStyle='#111827';
    doodleText(Math.round(player.depth)+'m',W-6,H-padB+18*DPR,13*DPR,'right');
  }

  // ── HUD / instrument panel (bottom) ──────────────────────────────────────────
  function drawHUD(W,H){
    const stripH=54*DPR;
    const stripY=H-stripH;
    const midX=(W-56*DPR)/2; // account for depth strip

    // Background
    ctx.fillStyle='rgba(247,247,251,0.92)';
    ctx.fillRect(0,stripY,W-56*DPR,stripH);
    ctx.strokeStyle='rgba(17,24,39,0.12)';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,stripY); ctx.lineTo(W-56*DPR,stripY); ctx.stroke();

    const row1=stripY+18*DPR, row2=stripY+36*DPR;
    ctx.fillStyle='rgba(17,24,39,0.40)';
    ctx.font=`${10*DPR}px ui-rounded,system-ui,Arial`;

    // Speed
    const spdX=24*DPR;
    ctx.textAlign='left';
    doodleText('SPD',spdX,row1,10*DPR,'left');
    ctx.fillStyle='#111827';
    doodleText(`${Math.round(player.speed)}kts`,spdX,row2,15*DPR,'left');

    // Heading
    const hdgX=120*DPR;
    const hdgDeg=((player.heading*180/Math.PI)+360)%360;
    ctx.fillStyle='rgba(17,24,39,0.40)';
    doodleText('HDG',hdgX,row1,10*DPR,'left');
    ctx.fillStyle='#111827';
    doodleText(`${Math.round(hdgDeg).toString().padStart(3,'0')}°`,hdgX,row2,15*DPR,'left');

    // HP bar
    const hpX=220*DPR;
    ctx.fillStyle='rgba(17,24,39,0.40)';
    doodleText('HULL',hpX,row1,10*DPR,'left');
    const hpPct=player.hp/C.player.hpMax;
    ctx.fillStyle=hpPct>0.5?'rgba(17,24,39,0.15)':'rgba(220,38,38,0.25)';
    ctx.fillRect(hpX,stripY+22*DPR,60*DPR,12*DPR);
    ctx.fillStyle=hpPct>0.5?'#111827':'#dc2626';
    ctx.fillRect(hpX,stripY+22*DPR,60*DPR*hpPct,12*DPR);

    // Noise
    const noiseX=310*DPR;
    ctx.fillStyle='rgba(17,24,39,0.40)';
    doodleText('NOISE',noiseX,row1,10*DPR,'left');
    ctx.fillStyle=player.noise>0.5?'rgba(220,38,38,0.25)':'rgba(17,24,39,0.12)';
    ctx.fillRect(noiseX,stripY+22*DPR,60*DPR,12*DPR);
    ctx.fillStyle=player.noise>0.5?'#dc2626':'#111827';
    ctx.fillRect(noiseX,stripY+22*DPR,60*DPR*clamp(player.noise,0,1),12*DPR);

    // Silent running
    const srX=400*DPR;
    if(player.silent){
      ctx.fillStyle='rgba(17,24,39,0.70)';
      doodleText('◆ SILENT',srX,row2,13*DPR,'left');
    }

    // Score
    ctx.fillStyle='rgba(17,24,39,0.40)';
    ctx.textAlign='right';
    doodleText(`SCORE ${game.score}`,midX-16*DPR,row2,13*DPR,'right');

    // Message
    if(game.msgT>0){
      ctx.fillStyle=`rgba(17,24,39,${Math.min(1,game.msgT)})`;
      doodleText(game.msg,midX/2,stripY-12*DPR,14*DPR,'center');
    }

    // Weapon cooldown pips
    const pipY=row1;
    const pipX=midX-180*DPR;
    const pip=(label,cd,maxCd,x)=>{
      const rdy=cd<=0;
      ctx.fillStyle=rdy?'#111827':'rgba(17,24,39,0.25)';
      doodleText(label,x,pipY+14*DPR,10*DPR,'left');
    };
    pip('F:TORP',player.torpCd,C.player.torpCd,pipX);
    pip('SPC:PING',player.pingCd,C.player.pingCd,pipX+58*DPR);
    pip('X:CM',player.cmCd,C.player.cmCd,pipX+124*DPR);

    // Game over
    if(game.over){
      ctx.fillStyle='rgba(17,24,39,0.85)';
      ctx.fillRect(0,0,W-56*DPR,H-stripH);
      ctx.fillStyle='#f7f7fb';
      doodleText('SUNK',midX,H/2-10*DPR,48*DPR,'center');
      ctx.fillStyle='rgba(247,247,251,0.7)';
      doodleText(`SCORE: ${game.score}`,midX,H/2+36*DPR,18*DPR,'center');
      doodleText('R to restart',midX,H/2+60*DPR,13*DPR,'center');
    }
  }

  // ── Threat awareness bar (top) ────────────────────────────────────────────────
  function drawThreatBar(W){
    let maxSus=0;
    for(const e of enemies) maxSus=Math.max(maxSus,e.suspicion||0);
    const state=maxSus>C.enemy.susEngage?'ALERT':maxSus>C.enemy.susInvestigate?'SEARCH':'CLEAR';
    const col=state==='ALERT'?'#dc2626':state==='SEARCH'?'#d97706':'#16a34a';

    ctx.fillStyle='rgba(247,247,251,0.88)';
    ctx.fillRect(0,0,W-56*DPR,28*DPR);
    ctx.strokeStyle='rgba(17,24,39,0.10)';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,28*DPR); ctx.lineTo(W-56*DPR,28*DPR); ctx.stroke();

    // Threat fill bar
    ctx.fillStyle=col+'33';
    ctx.fillRect(0,0,(W-56*DPR)*clamp(maxSus,0,1),28*DPR);

    ctx.fillStyle=col;
    doodleText(state,(W-56*DPR)/2,19*DPR,11*DPR,'center');

    // Controls hint
    ctx.fillStyle='rgba(17,24,39,0.28)';
    doodleText('LMB=waypoint  RMB=remove last  SHIFT+LMB=fire torp (aimed)  F=quick fire  X=CM  SPACE=ping  A/D=speed  W/S=depth  Z=silent  scroll=zoom  R=reset',12*DPR,19*DPR,9*DPR,'left');
  }

  // ── Main draw ─────────────────────────────────────────────────────────────────
  function draw(){
    const W=canvas.width, H=canvas.height;
    const plotW=W-56*DPR;   // area left of depth strip
    const Z=cam.zoom*DPR;

    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,W,H);

    // Ocean background
    const seaColour=window.MAPS?.getMap()?.seaColour||'#daeaf7';
    ctx.fillStyle=seaColour;
    ctx.fillRect(0,0,plotW,H);

    // Grid lines (faint, spaced 1000 world units)
    ctx.strokeStyle='rgba(17,24,39,0.05)';
    ctx.lineWidth=1;
    const gridSpacing=1000;
    const cx=canvas.width/2, cy=canvas.height/2;
    const startX=Math.floor((cam.x-cx/Z)/gridSpacing)*gridSpacing;
    const startY=Math.floor((cam.y-cy/Z)/gridSpacing)*gridSpacing;
    for(let gx=startX;gx<startX+plotW/Z+gridSpacing;gx+=gridSpacing){
      const sx=cx+(gx-cam.x)*Z;
      ctx.beginPath(); ctx.moveTo(sx,0); ctx.lineTo(sx,H); ctx.stroke();
    }
    for(let gy=startY;gy<startY+H/Z+gridSpacing;gy+=gridSpacing){
      const sy=cy+(gy-cam.y)*Z;
      ctx.beginPath(); ctx.moveTo(0,sy); ctx.lineTo(plotW,sy); ctx.stroke();
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

    // ── Ghost contacts (persistent last-known, faded) ─────────────────────────
    if(ghostContacts){
      const now2=performance.now()/1000;
      for(const [e,g] of ghostContacts){
        if(e.dead||(e.detectedT||0)>0) continue; // skip if currently live
        const age=now2-g.t;
        const fade=Math.max(0, 1-age/120); // fades over 2 minutes
        if(fade<=0){ ghostContacts.delete(e); continue; }
        const [gx,gy]=w2s(g.x,g.y);
        if(gx<0||gx>plotW) continue;
        ctx.strokeStyle=`rgba(17,24,39,${0.22*fade})`;
        ctx.fillStyle=`rgba(17,24,39,${0.18*fade})`;
        // Ghost marker — dashed circle
        ctx.setLineDash([3,4]);
        doodleCircle(gx,gy,wScale(g.kind==='boat'?34:30),1.5);
        ctx.setLineDash([]);
        const label=g.kind==='boat'?'▲':'●';
        doodleText(label,gx,gy+4,10*DPR,'center');
        const mins=Math.floor(age/60), secs=Math.floor(age%60);
        ctx.fillStyle=`rgba(17,24,39,${0.30*fade})`;
        doodleText(`${mins}:${secs.toString().padStart(2,'0')}`,gx,gy-14*DPR,8*DPR,'center');
      }
    }

    // ── Passive contacts ──────────────────────────────────────────────────────
    for(const c of contacts){
      const [cx2,cy2]=w2s(c.x,c.y);
      const a=clamp(c.life/2.2,0,1);
      const uR=wScale(c.u*0.4);
      ctx.strokeStyle=`rgba(17,24,39,${0.18*a})`;
      doodleCircle(cx2,cy2,Math.max(4,uR),1.5);
      // Bearing line from player
      const [ppx,ppy]=w2s(player.wx,player.wy);
      ctx.strokeStyle=`rgba(17,24,39,${0.10*a})`;
      ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(ppx,ppy); ctx.lineTo(cx2,cy2); ctx.stroke();
    }

    // ── Decoys ────────────────────────────────────────────────────────────────
    for(const d of decoys){
      const [dx,dy]=w2s(d.x,d.y);
      ctx.strokeStyle='rgba(17,24,39,0.35)';
      doodleCircle(dx,dy,5,1.5);
      doodleCircle(dx,dy,wScale(d.r||20),1);
    }

    // ── Torpedoes + wire lines ────────────────────────────────────────────────
    for(const b of bullets){
      if(b.kind!=='torpedo') continue;
      drawTorpedoTopDown(b);
      // Wire line — thin dashed from launch origin to torpedo
      if(b.wire&&b.wire.live){
        const [tx,ty]=w2s(b.x,b.y);
        const [lx,ly]=w2s(b.wire.fromX,b.wire.fromY);
        ctx.strokeStyle='rgba(17,24,39,0.28)';
        ctx.lineWidth=1;
        ctx.setLineDash([4,5]);
        ctx.beginPath(); ctx.moveTo(lx,ly); ctx.lineTo(tx,ty); ctx.stroke();
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

    // ── Detected enemies ──────────────────────────────────────────────────────
    for(const e of enemies){
      if((e.detectedT||0)<=0 && (e.seen||0)<=0) continue;
      const [ex,ey]=w2s(e.x,e.y);

      // Clip to plot area
      if(ex<0||ex>plotW) continue;

      const fullyDetected=(e.detectedT||0)>0;
      ctx.strokeStyle=fullyDetected?'#111827':'rgba(17,24,39,0.40)';

      ctx.save();
      ctx.translate(ex,ey);
      ctx.rotate(e.heading||0);
      if(e.type==='boat'){
        drawEnemyBoatTopDown(e.r);
      } else {
        drawEnemySubTopDown(e.r);
      }
      ctx.restore();

      // Suspicion arc
      if(e.suspicion>0.05){
        const arcR=wScale(e.r*2.2);
        ctx.strokeStyle=e.suspicion>C.enemy.susEngage?'rgba(220,38,38,0.5)':
                        e.suspicion>C.enemy.susInvestigate?'rgba(217,119,6,0.4)':
                        'rgba(17,24,39,0.15)';
        ctx.lineWidth=1.5;
        ctx.beginPath();
        ctx.arc(ex,ey,arcR,0,TAU*e.suspicion);
        ctx.stroke();
      }

      // Contact marker (where enemy thinks player is)
      if(e.contact && fullyDetected){
        const [ccx,ccy]=w2s(e.contact.x,e.contact.y);
        ctx.strokeStyle='rgba(220,38,38,0.35)';
        doodleCircle(ccx,ccy,wScale(e.contact.u*0.3),1);
        ctx.strokeStyle='rgba(220,38,38,0.25)';
        ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(ex,ey); ctx.lineTo(ccx,ccy); ctx.stroke();
      }
    }

    // ── Player sub ────────────────────────────────────────────────────────────
    const [ppx,ppy]=w2s(player.wx,player.wy);
    ctx.strokeStyle=(player.invuln>0)?'rgba(17,24,39,0.40)':'#111827';
    ctx.save();
    ctx.translate(ppx,ppy);
    ctx.rotate(player.heading);
    drawPlayerTopDown(C.player.r);
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
      const arcRad=C.player.torpArcDeg*Math.PI/180;
      const aimLen=wScale(C.player.torpWireMaxRange*0.7);

      // Arc cone — forward firing envelope
      ctx.fillStyle='rgba(17,24,39,0.06)';
      ctx.beginPath();
      ctx.moveTo(ppx2,ppy2);
      ctx.arc(ppx2,ppy2,aimLen,player.heading-arcRad/2,player.heading+arcRad/2);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle='rgba(17,24,39,0.18)';
      ctx.lineWidth=1;
      ctx.beginPath();
      ctx.arc(ppx2,ppy2,aimLen,player.heading-arcRad/2,player.heading+arcRad/2);
      ctx.stroke();

      // Aim line to mouse — check if within arc
      const half=arcRad/2;
      const diff=Math.abs(((aimAng-player.heading+Math.PI*3)%(Math.PI*2))-Math.PI);
      const inArc=diff<=half;
      ctx.strokeStyle=inArc?'rgba(17,24,39,0.60)':'rgba(220,38,38,0.50)';
      ctx.lineWidth=1.5;
      ctx.setLineDash([5,5]);
      ctx.beginPath(); ctx.moveTo(ppx2,ppy2);
      ctx.lineTo(ppx2+Math.cos(aimAng)*aimLen, ppy2+Math.sin(aimAng)*aimLen);
      ctx.stroke(); ctx.setLineDash([]);

      // Label
      const bearDeg=((aimAng*180/Math.PI)+360)%360;
      ctx.fillStyle='rgba(17,24,39,0.65)';
      doodleText(`TDC ${Math.round(bearDeg).toString().padStart(3,'0')}°`+(inArc?'':' ✕'),
        ppx2+12*DPR, ppy2-16*DPR, 10*DPR,'left');
      if(player.torpCd>0){
        ctx.fillStyle='rgba(220,38,38,0.65)';
        doodleText(`CD ${player.torpCd.toFixed(1)}s`,ppx2+12*DPR,ppy2-4*DPR,9*DPR,'left');
      }
    }

    // ── Depth strip ───────────────────────────────────────────────────────────
    drawDepthStrip(W,H);

    // ── HUD ───────────────────────────────────────────────────────────────────
    drawHUD(W,H);

    // ── Threat bar ────────────────────────────────────────────────────────────
    drawThreatBar(W);
  }

  window.R={draw};
})();
