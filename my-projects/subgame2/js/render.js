(() => {
  'use strict';
  const C=window.CONFIG;
  const {TAU,clamp,lerp,now,jitter,deg2rad}=window.M;
  const {ctx,canvas,DPR,world,cam,bullets,particles,enemies,decoys,contacts,cwisTracers,wireContacts,ghostContacts,sonarContacts,player,game,setMsg,wrecks}=window.G;
  const AI=window.AI;
  // PANEL and SENSE resolved lazily (loaded after render.js)
  const PANEL=()=>window.PANEL;
  const SENSE=()=>window.SENSE;

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
    // Centre on the plot area (excluding depth strip and panel)
    const cx=(canvas.width - 88*DPR)/2;
    const cy=(canvas.height - 190*DPR)/2;
    let dx=wx-cam.x;
    let dy=wy-cam.y;
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

    function wrapDist(ax,ay,bx,by){
      let dx=bx-ax; if(dx>world.w/2)dx-=world.w; if(dx<-world.w/2)dx+=world.w;
      let dy=by-ay; if(dy>world.h/2)dy-=world.h; if(dy<-world.h/2)dy+=world.h;
      return Math.hypot(dx,dy);
    }
    // 1wu=10m, 1852m=1nm
    function fmtDist(wu){
      const nm=wu*10/1852;
      return nm<10 ? nm.toFixed(1)+'nm' : Math.round(nm)+'nm';
    }

    // Dashed route line
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

    // Segment distance labels
    const pts=[{wx:player.wx,wy:player.wy},...route];
    let totalWU=0;
    for(let i=0;i<pts.length-1;i++){
      const a=pts[i], b=pts[i+1];
      const d=wrapDist(a.wx,a.wy,b.wx,b.wy);
      totalWU+=d;
      const [ax,ay]=w2s(a.wx,a.wy);
      const [bx,by]=w2s(b.wx,b.wy);
      const mx=(ax+bx)/2, my=(ay+by)/2;
      ctx.fillStyle='rgba(17,24,39,0.50)';
      doodleText(fmtDist(d),mx+4*DPR,my-4*DPR,8*DPR,'left');
    }

    // Waypoint circles + numbers
    for(let i=0;i<route.length;i++){
      const [wx2,wy2]=w2s(route[i].wx,route[i].wy);
      ctx.strokeStyle='rgba(17,24,39,0.45)';
      doodleCircle(wx2,wy2,6,1.5);
      ctx.fillStyle='rgba(17,24,39,0.55)';
      doodleText(`${i+1}`,wx2+9,wy2+4,9*DPR,'left');
    }

    // Total distance under last waypoint
    if(route.length>=1){
      const [lx,ly]=w2s(route[route.length-1].wx,route[route.length-1].wy);
      ctx.fillStyle='rgba(17,24,39,0.32)';
      doodleText(`TOTAL ${fmtDist(totalWU)}`,lx+9,ly+14*DPR,8*DPR,'left');
    }
  }
  // Drawn at (0,0) pointing right (+x), caller rotates
  function drawPlayerTopDown(){
    const sc=wScale(11)/68;  // sub is 11wu (~110m) long
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
  function drawEnemySubTopDown(){
    const sc=wScale(10)/58;  // Victor III ~10wu (~100m)
    ctx.lineWidth=2;
    const L=58*sc, Hw=14*sc;
    ctx.beginPath();
    const pts=20;
    for(let i=0;i<=pts;i++){
      const t=i/pts;
      const x=lerp(-L*0.50,L*0.50,t);
      const bulge=t<0.12?Math.pow(t/0.12,0.5):t>0.78?Math.pow((1-t)/0.22,0.45):1.0;
      const wx2=Math.sin(t*27.3)*0.5*sc, wy2=Math.sin(t*14.1+0.8)*0.4*sc;
      if(i===0) ctx.moveTo(x+wx2,-bulge*Hw+wy2); else ctx.lineTo(x+wx2,-bulge*Hw+wy2);
    }
    for(let i=pts;i>=0;i--){
      const t=i/pts;
      const x=lerp(-L*0.50,L*0.50,t);
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
  function drawEnemyBoatTopDown(){
    const sc=wScale(13)/70;  // frigate ~13wu (~130m)
    ctx.lineWidth=2;
    const L=70*sc, Hw=14*sc;
    // Hull outline
    ctx.beginPath();
    ctx.moveTo(L*0.50,0);                  // bow
    ctx.lineTo(L*0.15,-Hw);               // fwd port
    ctx.lineTo(-L*0.50,-Hw*0.80);         // amidships port
    ctx.lineTo(-L*0.50-4*sc,-Hw*0.5);    // stern port
    ctx.lineTo(-L*0.50-4*sc,Hw*0.5);     // stern starboard
    ctx.lineTo(-L*0.50,Hw*0.80);          // amidships starboard
    ctx.lineTo(L*0.15,Hw);                // fwd starboard
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
    const ang=Math.atan2(b.vy,b.vx);
    const [sx,sy]=w2s(b.x,b.y);
    const seekerOn=(b.traveled>=(b.enableDist||0));
    const seduced=!!b.seducedBy;

    // Run-out line — dashed projection of straight run remaining
    if(!seekerOn){
      const remaining=Math.max(0,(b.enableDist||0)-b.traveled);
      const runPx=wScale(remaining);
      ctx.save();
      ctx.translate(sx,sy); ctx.rotate(ang);
      ctx.strokeStyle='rgba(15,23,42,0.18)';
      ctx.lineWidth=1;
      ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(10+runPx,0); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Torpedo body
    ctx.save();
    ctx.translate(sx,sy); ctx.rotate(ang);
    ctx.strokeStyle=b.friendly
      ? (seekerOn ? (seduced?'rgba(160,40,40,0.9)':'#0f172a') : 'rgba(15,23,42,0.45)')
      : 'rgba(100,30,200,0.85)';
    doodleLine(-10,0, 10,0, 2.5);
    doodleLine(8,-3, 10,0, 2);
    doodleLine(8,3, 10,0, 2);
    ctx.restore();

    // Label — T# above, depth below
    if(b.torpId){
      const labelCol=seduced?'rgba(160,40,40,0.85)':b.friendly?'rgba(15,23,42,0.80)':'rgba(100,30,200,0.80)';
      ctx.fillStyle=labelCol;
      doodleText(b.torpId, sx+8*DPR, sy-6*DPR, 8*DPR, 'left');
      if(b.depth!=null)
        doodleText(Math.round(b.depth)+'m', sx+8*DPR, sy+10*DPR, 7*DPR, 'left');
    }
  }

  // ── Depth strip (right side) ──────────────────────────────────────────────────
  function drawDepthStrip(W,H,panelH=54*DPR){
    const stripW=88*DPR;
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
    for(const b of bullets){
      if(b.kind!=='torpedo'||b.life<=0||b.depth==null) continue;
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

  // ── Command Panel (bottom) ────────────────────────────────────────────────────
  // ── Message Log Board ────────────────────────────────────────────────────────
  function drawSonarFeed(W,H,panelH){
    const log=game.sonarLog;
    if(!log||log.length===0) return;

    const maxRows=16;
    const rowH=13*DPR;
    const padX=8*DPR, padY=6*DPR;
    const boardW=210*DPR;
    const headerH=14*DPR;
    const boardH=rowH*maxRows+padY*2+headerH;

    // Position: bottom-right of chart area just above panel
    const bx=W-88*DPR-boardW-4*DPR;
    const by=H-panelH-boardH-2*DPR;

    // Background
    ctx.fillStyle='rgba(4,20,30,0.82)';
    ctx.strokeStyle='rgba(0,180,160,0.20)';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.roundRect(bx,by,boardW,boardH,4*DPR); ctx.fill(); ctx.stroke();

    // Header
    ctx.fillStyle='rgba(0,200,180,0.70)';
    ctx.font=`bold ${8*DPR}px ui-monospace,monospace`;
    ctx.textAlign='left';
    ctx.fillText('SONAR RAW FEED',bx+padX,by+padY+8*DPR);
    ctx.fillStyle='rgba(0,160,140,0.40)';
    ctx.fillRect(bx,by+padY+headerH,boardW,1);

    // Entries — most recent at bottom
    const entries=log.slice(-maxRows);
    const T=game.missionT||0;
    for(let i=0;i<entries.length;i++){
      const e=entries[i];
      const ry=by+padY+headerH+4*DPR+i*rowH;
      const age=T-e.t;
      const alpha=Math.max(0.25, 1.0-age/30); // fade over 30s

      // Array badge colour
      const arrCol=e.array==='HULL'?`rgba(100,200,255,${alpha})`:`rgba(0,200,160,${alpha})`;
      ctx.fillStyle=arrCol;
      ctx.font=`bold ${7*DPR}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillText(e.array, bx+padX, ry+rowH*0.75);

      // Contact ID
      ctx.fillStyle=`rgba(200,230,255,${alpha*0.85})`;
      ctx.font=`${7*DPR}px ui-monospace,monospace`;
      ctx.fillText(e.id, bx+padX+38*DPR, ry+rowH*0.75);

      // Bearing
      ctx.fillStyle=`rgba(255,220,100,${alpha*0.90})`;
      ctx.fillText(`${e.brgStr}°`, bx+padX+62*DPR, ry+rowH*0.75);

      // Signal tier
      const sigCol=e.tierLabel==='STRONG'?`rgba(100,255,120,${alpha})`
                  :e.tierLabel==='MOD'   ?`rgba(255,200,60,${alpha})`
                                         :`rgba(180,180,180,${alpha*0.70})`;
      ctx.fillStyle=sigCol;
      ctx.fillText(e.tierLabel, bx+padX+100*DPR, ry+rowH*0.75);

      // Type
      ctx.fillStyle=`rgba(160,180,200,${alpha*0.65})`;
      ctx.fillText(e.typeLabel, bx+padX+148*DPR, ry+rowH*0.75);

      // Age indicator — tiny bar
      const ageFrac=Math.max(0,1-age/30);
      ctx.fillStyle=`rgba(0,160,140,${alpha*0.35})`;
      ctx.fillRect(bx+boardW-padX-40*DPR, ry+rowH*0.30, 40*DPR*ageFrac, 2*DPR);
    }
  }

  function drawMsgLog(W,H,panelH){
    const log=game.msgLog;
    if(!log||log.length===0) return;

    const CAT_COL={
      CONN:'#1e3a5f',   // navy
      SONAR:'#0e7490',  // teal
      WEPS:'#991b1b',   // crimson
      ENG:'#92400e',    // amber
    };
    const CAT_BG={
      CONN:'rgba(30,58,95,0.18)',
      SONAR:'rgba(14,116,144,0.15)',
      WEPS:'rgba(153,27,27,0.15)',
      ENG:'rgba(146,64,14,0.14)',
    };

    const maxRows=14;
    const rowH=16*DPR;
    const padX=10*DPR, padY=8*DPR;
    const catW=50*DPR;
    const boardW=320*DPR;
    const boardH=rowH*maxRows+padY*2+14*DPR;  // +14 for header

    // Position: bottom-left of chart area, just above panel
    const bx=0;
    const by=H-panelH-boardH-2*DPR;

    // Background
    ctx.fillStyle='rgba(248,246,240,0.82)';
    ctx.strokeStyle='rgba(17,24,39,0.12)';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.roundRect(bx,by,boardW,boardH,0); ctx.fill(); ctx.stroke();

    // Header
    ctx.fillStyle='rgba(17,24,39,0.60)';
    ctx.font=`bold ${9*DPR}px ui-monospace,monospace`;
    ctx.textAlign='left';
    ctx.fillText('SHIP LOG',bx+padX,by+padY+6*DPR);
    // time display
    const mt=game.missionT||0;
    const mm=Math.floor(mt/60).toString().padStart(2,'0');
    const ss=Math.floor(mt%60).toString().padStart(2,'0');
    ctx.textAlign='right';
    ctx.fillText(`T+${mm}:${ss}`,bx+boardW-padX,by+padY+8*DPR);
    ctx.textAlign='left';

    // Divider
    ctx.strokeStyle='rgba(17,24,39,0.10)';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(bx,by+padY+13*DPR); ctx.lineTo(bx+boardW,by+padY+13*DPR); ctx.stroke();

    // Rows — most recent at bottom
    const visible=log.slice(-maxRows);
    const startY=by+padY+rowH*0.5+13*DPR;
    for(let i=0;i<visible.length;i++){
      const entry=visible[i];
      const ry=startY+i*rowH;
      const age=visible.length-1-i; // 0=newest
      const alpha=Math.max(0.25, 1-age*0.065);

      // Cat pill
      ctx.fillStyle=(CAT_BG[entry.cat]||'rgba(17,24,39,0.10)').replace(')',`,${alpha})`).replace('rgba(','rgba(');
      ctx.beginPath(); ctx.roundRect(bx+padX,ry-rowH*0.72,catW,rowH*0.85,2*DPR); ctx.fill();
      ctx.fillStyle=(CAT_COL[entry.cat]||'#111827');
      ctx.globalAlpha=alpha;
      ctx.font=`bold ${8*DPR}px ui-monospace,monospace`;
      ctx.textAlign='center';
      ctx.fillText(entry.cat,bx+padX+catW/2,ry-1*DPR);

      // Timestamp
      const et=entry.t||0;
      const em=Math.floor(et/60).toString().padStart(2,'0');
      const es=Math.floor(et%60).toString().padStart(2,'0');
      ctx.font=`${7.5*DPR}px ui-monospace,monospace`;
      ctx.fillStyle='rgba(17,24,39,0.50)';
      ctx.textAlign='left';
      ctx.fillText(`${em}:${es}`,bx+padX+catW+4*DPR,ry-1*DPR);

      // Message text
      ctx.fillStyle='rgba(17,24,39,0.88)';
      ctx.font=`${9*DPR}px ui-rounded,system-ui,Arial`;
      ctx.textAlign='left';
      // Clip long text
      const textX=bx+padX+catW+32*DPR;
      const maxTextW=boardW-textX+bx-padX;
      ctx.save();
      ctx.beginPath(); ctx.rect(textX,ry-rowH,maxTextW,rowH*1.1); ctx.clip();
      ctx.fillText(entry.text,textX,ry-1*DPR);
      ctx.restore();

      ctx.globalAlpha=1;
    }
  }

  // ── Damage Control Overlay (H to toggle, or DMG button) ──────────────────
  function drawDamagePanel(W,H,panelH){
    if(!game.showDmgPanel) return;
    const dmg=player.damage;
    if(!dmg) return;
    const DMG=window.DMG;
    const PNL=window.PANEL; // fix: was PANEL (a function wrapper), must be window.PANEL

    const OW=400*DPR, OH=340*DPR;
    const OX=80*DPR, OY=10*DPR;
    const P=10*DPR;

    // Background
    ctx.fillStyle='rgba(8,14,26,0.96)';
    ctx.strokeStyle='rgba(80,110,160,0.35)';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.roundRect(OX,OY,OW,OH,6*DPR); ctx.fill(); ctx.stroke();

    // Title bar
    let cy=OY+P+10*DPR;
    ctx.fillStyle='rgba(160,190,240,0.90)';
    ctx.font=`bold ${10*DPR}px ui-monospace,monospace`;
    ctx.textAlign='left';
    ctx.fillText('DAMAGE CONTROL',OX+P,cy);
    ctx.fillStyle='rgba(120,140,180,0.50)';
    ctx.font=`${8*DPR}px ui-monospace,monospace`;
    ctx.textAlign='right';
    ctx.fillText('[H] close',OX+OW-P,cy);

    // Crew/DC teams row
    cy+=13*DPR;
    const crewTotal=dmg.crew.total, crewKilled=dmg.crew.killed, crewWounded=dmg.crew.wounded;
    const crewFit=crewTotal-crewKilled-crewWounded;
    const dcMax=DMG.maxDCTeams(), dcBusy=dmg.repairs.length;
    ctx.fillStyle='rgba(160,185,230,0.70)';
    ctx.font=`${8*DPR}px ui-monospace,monospace`;
    ctx.textAlign='left';
    ctx.fillText(`CREW  ${crewFit} FIT  ${crewWounded} WND  ${crewKilled} KIA`,OX+P,cy);
    ctx.textAlign='right';
    ctx.fillText(`DC TEAMS ${dcMax-dcBusy}/${dcMax}`,OX+OW-P,cy);
    cy+=14*DPR;

    // ── Submarine silhouette schematic ────────────────────────────────────────
    // 4 compartments in a hull shape. Bow (left) to stern (right).
    const schX=OX+P, schW=OW-P*2;
    const schY=cy, schH=52*DPR;
    const compKeys=['bow','control','engineering','stern'];
    const compLabels=['BOW','CONTROL','ENG','STERN'];
    // Proportional widths — control room is slightly wider
    const compFracs=[0.22, 0.26, 0.26, 0.26];
    let compXs=[], compWs=[];
    let xx=schX;
    for(let i=0;i<4;i++){
      compWs[i]=schW*compFracs[i];
      compXs[i]=xx;
      xx+=compWs[i];
    }

    const stFill={'nominal':'rgba(20,60,30,0.80)','degraded':'rgba(80,60,5,0.85)',
                  'offline':'rgba(80,25,5,0.90)','destroyed':'rgba(60,5,5,0.95)'};
    const stStroke={'nominal':'rgba(50,200,80,0.60)','degraded':'rgba(220,170,20,0.80)',
                    'offline':'rgba(220,80,20,0.90)','destroyed':'rgba(200,30,30,1.0)'};

    // Draw hull outline first (full shape)
    ctx.save();
    ctx.beginPath();
    // Simple sub profile: bow rounded left, stern tapered right
    const hTop=schY+4*DPR, hBot=schY+schH-4*DPR, hMid=(hTop+hBot)/2;
    const bowX=schX, sternX=schX+schW;
    ctx.moveTo(bowX+18*DPR, hTop);
    ctx.lineTo(sternX-12*DPR, hTop);
    ctx.lineTo(sternX, hMid);          // stern taper
    ctx.lineTo(sternX-12*DPR, hBot);
    ctx.lineTo(bowX+18*DPR, hBot);
    ctx.arc(bowX+18*DPR, hMid, (hBot-hTop)/2, Math.PI/2, -Math.PI/2, true); // bow arc
    ctx.closePath();
    ctx.strokeStyle='rgba(80,110,160,0.40)';
    ctx.lineWidth=1;
    ctx.stroke();
    ctx.restore();

    // Draw each compartment
    for(let ci=0;ci<4;ci++){
      const comp=compKeys[ci];
      const cx2=compXs[ci], cw=compWs[ci];
      const sysList=DMG.COMP_SYSTEMS[comp];
      let worstIdx=0;
      for(const s of sysList) worstIdx=Math.max(worstIdx, DMG.STATES.indexOf(dmg.systems[s]));
      const worst=DMG.STATES[worstIdx];
      const flood=dmg.flooding[comp]||0;

      // Clip to compartment bounds
      ctx.save();
      ctx.beginPath();
      if(ci===0){
        // Bow — arc on left side
        ctx.moveTo(cx2+18*DPR, schY+4*DPR);
        ctx.lineTo(cx2+cw, schY+4*DPR);
        ctx.lineTo(cx2+cw, schY+schH-4*DPR);
        ctx.lineTo(cx2+18*DPR, schY+schH-4*DPR);
        ctx.arc(cx2+18*DPR, schY+schH/2, (schH-8*DPR)/2, Math.PI/2, -Math.PI/2, true);
      } else if(ci===3){
        // Stern — tapered right
        const mx=schY+schH/2;
        ctx.moveTo(cx2, schY+4*DPR);
        ctx.lineTo(cx2+cw-12*DPR, schY+4*DPR);
        ctx.lineTo(cx2+cw, mx);
        ctx.lineTo(cx2+cw-12*DPR, schY+schH-4*DPR);
        ctx.lineTo(cx2, schY+schH-4*DPR);
      } else {
        ctx.rect(cx2, schY+4*DPR, cw, schH-8*DPR);
      }
      ctx.closePath();
      ctx.clip();

      // Compartment fill (damage state)
      ctx.fillStyle=stFill[worst]||stFill.nominal;
      ctx.fill();

      // Flooding water fill — rises from bottom
      if(flood>0){
        const floodH=(schH-8*DPR)*flood*0.90;
        ctx.fillStyle=`rgba(30,80,200,${0.30+flood*0.45})`;
        ctx.fillRect(cx2, schY+schH-4*DPR-floodH, cw, floodH);
        // Animated shimmer line at water surface
        ctx.strokeStyle=`rgba(100,160,255,${0.40+flood*0.30})`;
        ctx.lineWidth=1.5;
        ctx.beginPath();
        ctx.moveTo(cx2, schY+schH-4*DPR-floodH);
        ctx.lineTo(cx2+cw, schY+schH-4*DPR-floodH);
        ctx.stroke();
      }

      ctx.restore();

      // Compartment border
      ctx.strokeStyle=stStroke[worst]||stStroke.nominal;
      ctx.lineWidth=ci===0||ci===3 ? 1 : 1;
      ctx.beginPath();
      if(ci===0){
        ctx.moveTo(cx2+18*DPR, schY+4*DPR);
        ctx.lineTo(cx2+cw, schY+4*DPR);
        ctx.moveTo(cx2+cw, schY+schH-4*DPR);
        ctx.lineTo(cx2+18*DPR, schY+schH-4*DPR);
      } else if(ci===3){
        ctx.moveTo(cx2, schY+4*DPR);
        ctx.lineTo(cx2+cw-12*DPR, schY+4*DPR);
        ctx.moveTo(cx2+cw-12*DPR, schY+schH-4*DPR);
        ctx.lineTo(cx2, schY+schH-4*DPR);
      } else {
        ctx.moveTo(cx2, schY+4*DPR); ctx.lineTo(cx2+cw, schY+4*DPR);
        ctx.moveTo(cx2, schY+schH-4*DPR); ctx.lineTo(cx2+cw, schY+schH-4*DPR);
      }
      // Divider lines between compartments
      if(ci>0){ ctx.moveTo(cx2, schY+4*DPR); ctx.lineTo(cx2, schY+schH-4*DPR); }
      ctx.stroke();

      // Compartment label
      ctx.fillStyle='rgba(200,220,255,0.85)';
      ctx.font=`bold ${7*DPR}px ui-monospace,monospace`;
      ctx.textAlign='center';
      ctx.fillText(compLabels[ci], cx2+cw/2, schY+13*DPR);

      // State label if damaged
      if(worst!=='nominal'){
        ctx.fillStyle=stStroke[worst];
        ctx.font=`bold ${7*DPR}px ui-monospace,monospace`;
        ctx.fillText(worst.toUpperCase(), cx2+cw/2, schY+schH/2+3*DPR);
      }

      // Flooding % label
      if(flood>0.02){
        ctx.fillStyle='rgba(140,190,255,0.90)';
        ctx.font=`${7*DPR}px ui-monospace,monospace`;
        ctx.fillText(`${Math.round(flood*100)}%`, cx2+cw/2, schY+schH-10*DPR);
      }

      // SEAL button below compartment if flooding
      if(flood>0){
        const bx=cx2+2, by=schY+schH+2*DPR, bw=cw-4, bh=11*DPR;
        PNL.btn2(ctx,'SEAL',bx,by,bw,bh,'rgba(30,80,200,0.65)',()=>DMG.sealFlooding(comp));
      }
    }

    cy=schY+schH+16*DPR;

    // ── Systems grid ────────────────────────────────────────────────────────
    // Two columns, each compartment's systems listed under its X position
    const stColText={'nominal':'rgba(80,200,100,0.80)','degraded':'rgba(230,170,20,0.90)',
                     'offline':'rgba(230,90,30,0.90)','destroyed':'rgba(200,50,50,0.95)'};

    for(let ci=0;ci<4;ci++){
      const comp=compKeys[ci];
      const cx2=compXs[ci], cw=compWs[ci];
      const sysList=DMG.COMP_SYSTEMS[comp];
      let sy=cy;
      for(const sys of sysList){
        const st=dmg.systems[sys];
        const label=DMG.SYS_LABEL[sys]||sys.toUpperCase();
        const repairing=dmg.repairs.find(r=>r.system===sys);

        // System name (abbreviated to fit)
        ctx.fillStyle='rgba(160,180,220,0.70)';
        ctx.font=`${7*DPR}px ui-monospace,monospace`;
        ctx.textAlign='center';
        ctx.fillText(label, cx2+cw/2, sy);
        sy+=10*DPR;

        // State pill
        ctx.fillStyle=stColText[st]||stColText.destroyed;
        ctx.font=`bold ${7*DPR}px ui-monospace,monospace`;
        ctx.fillText(st.toUpperCase(), cx2+cw/2, sy);
        sy+=10*DPR;

        // Repair button if needed
        if(st!=='nominal'&&st!=='destroyed'){
          const bx=cx2+2, by=sy-1*DPR, bw=cw-4, bh=11*DPR;
          if(repairing){
            const pct=repairing.progress/repairing.totalTime;
            ctx.fillStyle='rgba(20,45,85,0.50)'; ctx.fillRect(bx,by,bw,bh);
            ctx.fillStyle='rgba(30,80,160,0.80)'; ctx.fillRect(bx,by,bw*pct,bh);
            ctx.fillStyle='rgba(180,210,255,0.90)';
            ctx.font=`${6.5*DPR}px ui-monospace,monospace`;
            ctx.textAlign='center';
            ctx.fillText(`${Math.round(pct*100)}% CNCL`,bx+bw/2,by+bh*0.75);
            PNL.btn2(ctx,'',bx,by,bw,bh,'transparent',()=>DMG.cancelRepair(sys));
          } else {
            PNL.btn2(ctx,'REPAIR',bx,by,bw,bh,'rgba(20,50,100,0.70)',()=>DMG.assignRepair(sys));
          }
          sy+=13*DPR;
        }
      }
    }

    // ── Crew priority ────────────────────────────────────────────────────────
    cy=OY+OH-26*DPR;
    const priorities=['weapons','sonar','engineering','dc','balanced'];
    const prioLabels=['WEAPS','SONAR','ENG','DC','EVEN'];
    const btnW=(OW-P*2)/5;
    ctx.fillStyle='rgba(120,145,190,0.55)';
    ctx.font=`${7.5*DPR}px ui-monospace,monospace`;
    ctx.textAlign='left';
    ctx.fillText('CREW PRIORITY:',OX+P,cy-2*DPR);
    cy+=2*DPR;
    for(let i=0;i<priorities.length;i++){
      const active=dmg.deptPriority===priorities[i];
      PNL.btn2(ctx,prioLabels[i],OX+P+i*btnW,cy,btnW-3*DPR,13*DPR,
        active?'rgba(40,80,160,0.90)':'rgba(40,60,100,0.35)',
        ()=>DMG.setDeptPriority(priorities[i]));
    }
  }

  // ── Command Panel ────────────────────────────────────────────────────────────
  function drawPanel(W,H){
    const panelH=190*DPR;
    const panelY=H-panelH;
    const panelW=W-88*DPR;
    const PANEL=window.PANEL;
    PANEL.clearBtns();

    // Background
    ctx.fillStyle='rgba(241,245,249,0.97)';
    ctx.fillRect(0,panelY,panelW,panelH);
    ctx.strokeStyle='rgba(17,24,39,0.14)';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,panelY); ctx.lineTo(panelW,panelY); ctx.stroke();

    const pad=8*DPR;
    const sectionDivider=(x)=>{
      ctx.strokeStyle='rgba(17,24,39,0.10)';
      ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(x,panelY+pad); ctx.lineTo(x,H-pad); ctx.stroke();
    };

    // Helper: small clickable button
    function btn(label,x,y,w,h,active,action,activeCol,dimCol){
      activeCol=activeCol||'#111827'; dimCol=dimCol||'rgba(17,24,39,0.18)';
      const bg=active?activeCol:'rgba(17,24,39,0.06)';
      const fg=active?'#f7f7fb':dimCol;
      ctx.fillStyle=bg;
      ctx.beginPath(); ctx.roundRect(x,y,w,h,3); ctx.fill();
      if(active){
        ctx.strokeStyle='rgba(17,24,39,0.30)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.roundRect(x,y,w,h,3); ctx.stroke();
      }
      ctx.fillStyle=fg;
      ctx.font=`${14*DPR}px ui-rounded,system-ui,Arial`;
      ctx.textAlign='center';
      ctx.fillText(label,x+w/2,y+h/2+4.5*DPR);
      PANEL.registerBtn(x,y,w,h,action);
    }

    // ── SECTION 1: Engine Telegraph ──────────────────────────────────────────
    const telegW=160*DPR;
    const telegX=pad;
    ctx.fillStyle='rgba(17,24,39,0.35)';
    ctx.font=`${11*DPR}px ui-rounded,system-ui,Arial`;
    ctx.textAlign='left';
    ctx.fillText('ENGINE ORDER',telegX,panelY+18*DPR);

    const states=PANEL.SPEED_STATES;
    const btnH=16*DPR;
    const btnGap=2*DPR;
    const totalBtnH=states.length*(btnH+btnGap)-btnGap;
    const startBtnY=panelY+24*DPR;

    for(let i=0;i<states.length;i++){
      const s=states[i];
      const by=startBtnY+i*(btnH+btnGap);
      const isActive=PANEL.telegraphIdx===i;
      const col=s.dir>0?'#1e3a5f':s.dir===0?'#374151':'#7f1d1d';
      btn(s.label,telegX,by,telegW-pad,btnH,isActive,()=>PANEL.setTelegraph(i),col);
    }

    sectionDivider(telegX+telegW);

    // ── SECTION 2: Depth Control ──────────────────────────────────────────────
    const depthSecX=telegX+telegW+pad;
    const depthSecW=130*DPR;

    ctx.fillStyle='rgba(17,24,39,0.35)';
    ctx.font=`${11*DPR}px ui-rounded,system-ui,Arial`;
    ctx.textAlign='left';
    ctx.fillText('DEPTH ORDER',depthSecX,panelY+18*DPR);

    // ACTUAL left, ORDERED right — enough space at 130px wide
    ctx.fillStyle='rgba(17,24,39,0.40)'; ctx.font=`${9*DPR}px ui-rounded,system-ui,Arial`;
    ctx.fillText('ACTUAL',depthSecX,panelY+33*DPR);
    ctx.fillStyle='#111827'; ctx.font=`${16*DPR}px ui-rounded,system-ui,Arial`;
    ctx.fillText(`${Math.round(player.depth)}m`,depthSecX,panelY+50*DPR);

    ctx.fillStyle='rgba(17,24,39,0.40)'; ctx.font=`${9*DPR}px ui-rounded,system-ui,Arial`;
    ctx.fillText('ORDERED',depthSecX+64*DPR,panelY+33*DPR);
    ctx.fillStyle='#111827'; ctx.font=`${16*DPR}px ui-rounded,system-ui,Arial`;
    ctx.fillText(`${Math.round(player.depthOrder)}m`,depthSecX+64*DPR,panelY+50*DPR);

    // Up/Down step buttons
    const arrowY=panelY+62*DPR;
    const arrowW=36*DPR, arrowH=22*DPR;
    btn('▲ UP',depthSecX,arrowY,arrowW,arrowH,false,()=>PANEL.depthStep(-1));
    btn('▼ DN',depthSecX+arrowW+4*DPR,arrowY,arrowW,arrowH,false,()=>PANEL.depthStep(1));

    // PD button
    const pdY=panelY+92*DPR;
    const atPD=player.depthOrder<=C.player.periscopeDepth+10;
    btn('COME TO PD',depthSecX,pdY,depthSecW-pad,20*DPR,atPD,()=>PANEL.comeToPD(),'#1e3a5f');

    sectionDivider(depthSecX+depthSecW);

    // ── SECTION 3: Status Readouts ────────────────────────────────────────────
    const statusX=depthSecX+depthSecW+pad;
    const statusW=165*DPR;

    ctx.fillStyle='rgba(17,24,39,0.35)';
    ctx.font=`${11*DPR}px ui-rounded,system-ui,Arial`;
    ctx.textAlign='left'; ctx.fillText('STATUS',statusX,panelY+18*DPR);

    const hdgDeg=((player.heading*180/Math.PI)+360)%360;
    // SPD / HDG / SCORE — sub-label 9px, value 16px
    ctx.fillStyle='rgba(17,24,39,0.40)'; ctx.font=`${9*DPR}px ui-rounded,system-ui,Arial`;
    ctx.fillText('SPD',statusX,panelY+33*DPR);
    ctx.fillStyle='#111827'; ctx.font=`${16*DPR}px ui-rounded,system-ui,Arial`;
    ctx.fillText(`${Math.round(player.speed)}kt`,statusX,panelY+50*DPR);

    ctx.fillStyle='rgba(17,24,39,0.40)'; ctx.font=`${9*DPR}px ui-rounded,system-ui,Arial`;
    ctx.fillText('HDG',statusX+50*DPR,panelY+33*DPR);
    ctx.fillStyle='#111827'; ctx.font=`${16*DPR}px ui-rounded,system-ui,Arial`;
    ctx.fillText(`${Math.round(hdgDeg).toString().padStart(3,'0')}°`,statusX+50*DPR,panelY+50*DPR);

    ctx.fillStyle='rgba(17,24,39,0.40)'; ctx.font=`${9*DPR}px ui-rounded,system-ui,Arial`;
    ctx.fillText('WAVE',statusX+110*DPR,panelY+33*DPR);
    ctx.fillStyle='#111827'; ctx.font=`${16*DPR}px ui-rounded,system-ui,Arial`;
    ctx.fillText(`${game.wave||1}`,statusX+110*DPR,panelY+50*DPR);

    // Wave incoming warning
    if(game.waveDelay>0){
      const wdPct=game.waveDelay/C.enemy.waveDelay;
      const blink=Math.sin(performance.now()*0.006)>0;
      ctx.fillStyle=blink?'rgba(220,38,38,0.80)':'rgba(220,38,38,0.30)';
      ctx.font=`bold ${8*DPR}px ui-rounded,system-ui,Arial`;
      ctx.fillText(`NEXT WAVE ${Math.ceil(game.waveDelay)}s`,statusX+108*DPR,panelY+62*DPR);
    }
    // Group state indicator
    if(game.groupState==='prosecuting'){
      ctx.fillStyle='rgba(220,38,38,0.75)';
      ctx.font=`bold ${7*DPR}px ui-rounded,system-ui,Arial`;
      ctx.fillText('⚠ PROSECUTING',statusX+108*DPR,panelY+72*DPR);
    }

    // Hull / crew integrity bars
    const barY=panelY+62*DPR, barW=statusW-pad*2, barH=11*DPR;
    const dmg=player.damage;
    const crewTotal=dmg?.crew.total||30;
    const crewAlive=crewTotal-(dmg?.crew.killed||0);
    const crewPct=clamp(crewAlive/crewTotal,0,1);
    ctx.fillStyle='rgba(17,24,39,0.40)'; ctx.font=`${9*DPR}px ui-rounded,system-ui,Arial`;
    ctx.fillText(`CREW  ${crewAlive}/${crewTotal}${dmg?.crew.wounded>0?' ('+dmg.crew.wounded+' WND)':''}`,statusX,barY-2);
    ctx.fillStyle='rgba(17,24,39,0.10)'; ctx.fillRect(statusX,barY,barW,barH);
    ctx.fillStyle=crewPct>0.6?'#334155':crewPct>0.35?'#b45309':'#dc2626';
    ctx.fillRect(statusX,barY,barW*crewPct,barH);

    // Noise bar
    const noiseBarY=barY+barH+10*DPR;
    const noisePct=clamp(player.noise,0,1);
    ctx.fillStyle='rgba(17,24,39,0.40)'; ctx.font=`${9*DPR}px ui-rounded,system-ui,Arial`;
    ctx.fillText('NOISE',statusX,noiseBarY-2);
    ctx.fillStyle='rgba(17,24,39,0.10)'; ctx.fillRect(statusX,noiseBarY,barW,barH);
    ctx.fillStyle=noisePct>0.5?'#dc2626':'#334155';
    ctx.fillRect(statusX,noiseBarY,barW*noisePct,barH);

    // Quick system status pills — worst 3 damaged systems
    if(dmg){
      const damaged=Object.entries(dmg.systems)
        .filter(([,s])=>s!=='nominal')
        .sort(([,a],[,b])=>DMG.STATES.indexOf(b)-DMG.STATES.indexOf(a))
        .slice(0,3);
      const pillY=noiseBarY+barH+10*DPR;
      const stCol={'degraded':'#b45309','offline':'#dc2626','destroyed':'#7f1d1d'};
      let px=statusX;
      for(const [sys,st] of damaged){
        const label=DMG.SYS_LABEL[sys]?.slice(0,6)||sys.slice(0,6).toUpperCase();
        ctx.fillStyle=stCol[st]||'#dc2626';
        ctx.font=`bold ${7.5*DPR}px ui-monospace,monospace`;
        ctx.textAlign='left';
        ctx.fillText(`${label}:${st.slice(0,3).toUpperCase()}`,px,pillY);
        px+=58*DPR;
        if(px>statusX+barW) break;
      }
      // DMG panel toggle button — blinks if there's active damage
      const hasDmg=damaged.length>0||Object.values(dmg.flooding).some(f=>f>0);
      const blink=hasDmg&&(Math.sin(performance.now()*0.007)>0);
      const dmgBtnY=panelY+155*DPR;
      btn('⚡ DMG',statusX,dmgBtnY,barW,17*DPR,game.showDmgPanel,
        ()=>{game.showDmgPanel=!game.showDmgPanel;},
        blink?'#991b1b':'#1e3a5f');
    }

    sectionDivider(statusX+statusW);

    // ── SECTION 4: Posture & Emergencies ─────────────────────────────────────
    const postureX=statusX+statusW+pad;
    const postureW=120*DPR;

    ctx.fillStyle='rgba(17,24,39,0.35)';
    ctx.font=`${11*DPR}px ui-rounded,system-ui,Arial`;
    ctx.textAlign='left'; ctx.fillText('POSTURE',postureX,panelY+18*DPR);

    const pbH=21*DPR, pbW=postureW-pad;
    btn('◆ SILENT',postureX,panelY+27*DPR,pbW,pbH,player.silent,
      ()=>PANEL.toggleSilent(),'#1e3a5f');
    btn('ALL STOP',postureX,panelY+54*DPR,pbW,pbH,PANEL.telegraphIdx===5,
      ()=>PANEL.allStop());

    ctx.fillStyle='rgba(17,24,39,0.30)'; ctx.font=`${9.5*DPR}px ui-rounded,system-ui,Arial`;
    ctx.textAlign='left'; ctx.fillText('EMERGENCY',postureX,panelY+87*DPR);

    const ebH=18*DPR;
    btn('CRASH DIVE',postureX,panelY+92*DPR,pbW,ebH,
      player.crashDiveT>0,()=>PANEL.emergencyCrashDive(),'#7f1d1d',
      player.crashDiveCd>0?'rgba(17,24,39,0.20)':'rgba(17,24,39,0.55)');
    btn('BLOW BALLAST',postureX,panelY+115*DPR,pbW,ebH,
      false,()=>PANEL.emergencyBlowBallast(),'#92400e');

    // ── Towed array button + status ───────────────────────────────────────────
    {
      const ta=player.towedArray;
      const taState=ta?.state||'stowed';
      const taActive=taState==='operational'||taState==='damaged'||taState==='deploying'||taState==='retracting';
      const taLabel=taState==='deploying'?`ARRAY ↓ ${Math.round((1-(ta.progress||0))*30)}s`
                   :taState==='retracting'?`ARRAY ↑ ${Math.round((ta.progress||0)*20)}s`
                   :taState==='operational'?'ARRAY DEPLOY'
                   :taState==='damaged'?'ARRAY DEPLOY'
                   :taState==='destroyed'?'ARRAY ✕'
                   :'DEPLOY ARRAY';
      const retractLabel = (taState==='operational'||taState==='damaged'||taState==='deploying') ? 'RETRACT' : null;
      const taCol=taState==='operational'?'#1e3a5f'
                 :taState==='damaged'?'#92400e'
                 :taState==='destroyed'?'rgba(120,20,20,0.55)'
                 :'rgba(17,24,39,0.55)';

      // Show state text above button
      ctx.font=`${8.5*DPR}px ui-rounded,system-ui,Arial`;
      ctx.textAlign='left';
      const stateStr=taState==='operational'?'OPERATIONAL'
                    :taState==='damaged'?'DAMAGED — degraded'
                    :taState==='destroyed'?'DESTROYED'
                    :taState==='deploying'?'DEPLOYING…'
                    :taState==='retracting'?'RETRACTING…'
                    :'STOWED';
      const stateCol=taState==='operational'?'rgba(22,163,74,0.75)'
                    :taState==='damaged'?'rgba(217,119,6,0.80)'
                    :taState==='destroyed'?'rgba(150,30,30,0.70)'
                    :'rgba(17,24,39,0.35)';
      ctx.fillStyle=stateCol;
      ctx.fillText(`ARRAY  ${stateStr}`, postureX, panelY+142*DPR);

      // Deploy/retract progress bar if in transition
      if(taState==='deploying'||taState==='retracting'){
        const bw=pbW, bh=3*DPR, bx=postureX, by=panelY+146*DPR;
        ctx.fillStyle='rgba(17,24,39,0.10)'; ctx.fillRect(bx,by,bw,bh);
        ctx.fillStyle='rgba(17,24,39,0.45)'; ctx.fillRect(bx,by,bw*(ta.progress||0),bh);
      }

      if(taState!=='destroyed'){
        btn(taActive?'RETRACT ARRAY':'DEPLOY ARRAY', postureX, panelY+151*DPR, pbW, ebH,
          taActive&&taState!=='deploying', ()=>PANEL.toggleTowedArray(), taCol);
      }
    }

    sectionDivider(postureX+postureW);

    // ── SECTION 5: Weapons ────────────────────────────────────────────────────
    const weapX=postureX+postureW+pad;
    const weapW=155*DPR;

    ctx.fillStyle='rgba(17,24,39,0.35)';
    ctx.font=`${11*DPR}px ui-rounded,system-ui,Arial`;
    ctx.textAlign='left'; ctx.fillText('WEAPONS',weapX,panelY+18*DPR);

    function weaponRow(label,cd,maxCd,y,actionLabel,action){
      const rdy=cd<=0;
      const rowH=22*DPR;
      const wbW=110*DPR;
      ctx.fillStyle='rgba(17,24,39,0.08)'; ctx.fillRect(weapX,y,wbW,rowH-3*DPR);
      if(!rdy){
        ctx.fillStyle='rgba(17,24,39,0.20)';
        ctx.fillRect(weapX,y,wbW*clamp(1-cd/maxCd,0,1),rowH-3*DPR);
      } else {
        ctx.fillStyle='rgba(30,58,95,0.15)';
        ctx.fillRect(weapX,y,wbW,rowH-3*DPR);
      }
      ctx.fillStyle=rdy?'#111827':'rgba(17,24,39,0.35)';
      ctx.font=`${9*DPR}px ui-rounded,system-ui,Arial`;
      ctx.textAlign='left';
      ctx.fillText(label+(rdy?' RDY':` ${cd.toFixed(1)}s`),weapX+3*DPR,y+rowH*0.70);
      if(rdy){
        btn(actionLabel,weapX+wbW+4*DPR,y,38*DPR,rowH-3*DPR,false,action,'#1e3a5f');
      }
    }

    // Torpedo tube display
    {
      const tubes=player.torpTubes||[];
      const stock=typeof player.torpStock==='number'?player.torpStock:0;
      const reloadTime=C.player.torpReloadTime||28;
      const fireDelay=C.player.fireDelay||1.8;
      const pending=player.pendingFires||[];
      const hdrY=panelY+18*DPR;
      const outOfAmmo=stock<=0&&pending.length===0;
      const allBusy=tubes.length>0&&tubes.every(t=>t>0);

      ctx.fillStyle=outOfAmmo?'rgba(17,24,39,0.28)':'#111827';
      ctx.font=`bold ${11*DPR}px ui-rounded,system-ui,Arial`;
      ctx.textAlign='left';
      ctx.fillText('TUBES',weapX+3*DPR,hdrY+11*DPR);

      ctx.font=`bold ${11*DPR}px ui-rounded,system-ui,Arial`;
      ctx.fillStyle=outOfAmmo?'rgba(17,24,39,0.20)':'#111827';
      ctx.textAlign='right';
      ctx.fillText(`${stock} left`,weapX+145*DPR,hdrY+11*DPR);

      const pipW=18*DPR, pipH=30*DPR, pipGap=4*DPR;
      const pipStartX=weapX+3*DPR;
      const pipY=hdrY+16*DPR;
      for(let i=0;i<tubes.length;i++){
        const px=pipStartX+i*(pipW+pipGap);
        const wireOccupied=tubes[i]===-1||(player.tubeWires?.[i]?.wire?.live===true);
        const ready=tubes[i]===0&&!wireOccupied;
        const hasShell=ready&&stock>0;
        const pf=pending.find(p=>p.tubeIdx===i);
        ctx.fillStyle='rgba(17,24,39,0.08)';
        ctx.fillRect(px,pipY,pipW,pipH);
        if(pf){
          const frac=clamp(1-pf.t/fireDelay,0,1);
          const pulse=0.5+0.5*Math.sin(performance.now()*0.008);
          ctx.fillStyle=`rgba(180,100,0,${0.25+pulse*0.20})`;
          ctx.fillRect(px,pipY,pipW,pipH);
          ctx.fillStyle='rgba(180,100,0,0.55)';
          ctx.fillRect(px,pipY+pipH*(1-frac),pipW,pipH*frac);
          ctx.fillStyle='rgba(160,80,0,0.90)';
          ctx.font=`${8*DPR}px ui-rounded,system-ui,Arial`;
          ctx.textAlign='center';
          ctx.fillText(pf.doorsLogged?'FIRE':'FLOOD',px+pipW/2,pipY+pipH*0.62);
        } else if(wireOccupied){
          const pulse=0.5+0.5*Math.sin(performance.now()*0.006);
          ctx.fillStyle=`rgba(13,148,136,${0.25+pulse*0.15})`;
          ctx.fillRect(px,pipY,pipW,pipH);
          ctx.fillStyle='rgba(13,148,136,0.90)';
          ctx.font=`bold ${7*DPR}px ui-monospace,monospace`;
          ctx.textAlign='center';
          ctx.fillText('WIRE',px+pipW/2,pipY+pipH*0.45);
          ctx.fillText(`T${i+1}`,px+pipW/2,pipY+pipH*0.72);
        } else if(!ready){
          const frac=clamp(1-tubes[i]/reloadTime,0,1);
          ctx.fillStyle='rgba(17,24,39,0.18)';
          ctx.fillRect(px,pipY+pipH*(1-frac),pipW,pipH*frac);
          ctx.fillStyle='rgba(17,24,39,0.45)';
          ctx.font=`${8*DPR}px ui-rounded,system-ui,Arial`;
          ctx.textAlign='center';
          ctx.fillText(Math.ceil(tubes[i])+'s',px+pipW/2,pipY+pipH*0.62);
        } else if(hasShell){
          ctx.fillStyle='rgba(30,58,95,0.55)';
          ctx.fillRect(px,pipY,pipW,pipH);
          ctx.fillStyle='rgba(30,58,95,0.95)';
          ctx.font=`${11*DPR}px ui-rounded,system-ui,Arial`;
          ctx.textAlign='center';
          ctx.fillText('▶',px+pipW/2,pipY+pipH*0.65);
        } else {
          ctx.fillStyle='rgba(17,24,39,0.06)';
          ctx.fillRect(px,pipY,pipW,pipH);
        }
        ctx.strokeStyle=wireOccupied?'rgba(13,148,136,0.70)':pf?'rgba(180,100,0,0.70)':hasShell?'rgba(30,58,95,0.60)':ready?'rgba(17,24,39,0.15)':'rgba(17,24,39,0.25)';
        ctx.lineWidth=pf?1.5:1;
        ctx.strokeRect(px,pipY,pipW,pipH);
      }
      ctx.textAlign='left';
      ctx.font=`${9*DPR}px ui-rounded,system-ui,Arial`;
      ctx.fillStyle='rgba(17,24,39,0.40)';
      const hasPending=pending.length>0;
      const statusStr=outOfAmmo?'DRY':hasPending?'FIRING…':allBusy?'RELOADING':'SHIFT+CLICK AIM  F FIRE';
      ctx.fillText(statusStr,pipStartX,pipY+pipH+10*DPR);
    }
    weaponRow('ACTIVE PING [SPACE]',player.pingCd,C.player.pingCd,panelY+106*DPR,'PING',
      ()=>{ if(player.pingCd<=0){ window.SENSE?.activePing(); setMsg('PING!',0.8); }});
    weaponRow('COUNTERMEAS. [X]',player.cmCd,C.player.cmCd,panelY+136*DPR,'DEPLOY',
      ()=>{ if(window.W&&player.cmCd<=0){
        player.cmCd=C.player.cmCd;
        window.W.deployDecoy(player.wx,player.wy,true,'noisemaker');
        player.noiseTransient=Math.min(1,player.noiseTransient+0.10);
        setMsg('NOISEMAKER OUT',0.9);
      }});

    sectionDivider(weapX+weapW);

    // ── SECTION 6: Wire Guidance ──────────────────────────────────────────────
    const wireSecX = weapX+weapW+pad;
    const wireSecW = 185*DPR;
    {
      const WP = window._wirePanel;
      const nTubes = C.player.torpTubes||4;
      const selTube = game.wirePanel?.selectedTube??0;
      const tubeWires = player.tubeWires||[];

      ctx.fillStyle='rgba(17,24,39,0.35)';
      ctx.font=`${11*DPR}px ui-rounded,system-ui,Arial`;
      ctx.textAlign='left';
      ctx.fillText('WIRES',wireSecX,panelY+18*DPR);

      // Tube tabs
      const tabW=(wireSecW-pad)/nTubes, tabH=16*DPR;
      for(let i=0;i<nTubes;i++){
        const torp=tubeWires[i];
        const wireLive=torp?.wire?.live;
        const active=i===selTube;
        const tabX=wireSecX+i*tabW;
        const tabCol=wireLive?(active?'#1e3a5f':'rgba(30,58,95,0.35)')
          :(active?'rgba(17,24,39,0.18)':'rgba(17,24,39,0.06)');
        ctx.fillStyle=tabCol;
        ctx.beginPath(); ctx.roundRect(tabX,panelY+22*DPR,tabW-2*DPR,tabH,2*DPR); ctx.fill();
        ctx.fillStyle=wireLive?'#e2e8f0':'rgba(17,24,39,0.45)';
        ctx.font=`bold ${8.5*DPR}px ui-monospace,monospace`;
        ctx.textAlign='center';
        ctx.fillText(`T${i+1}`,tabX+tabW/2-DPR,panelY+22*DPR+tabH*0.72);
        PANEL.btn2(ctx,'',tabX,panelY+22*DPR,tabW-2*DPR,tabH,'transparent',()=>WP.selectWireTube(i));
      }

      // Selected tube details
      const torp = tubeWires[selTube];
      const wireLive = torp?.wire?.live;
      const detY = panelY+44*DPR;

      if(wireLive){
        const paidOut = torp.wire.paidOut||0;
        const nm = paidOut/185.2;
        const curAng = Math.atan2(torp.vy,torp.vx);
        const hdgDeg = (((Math.atan2(Math.cos(curAng),-Math.sin(curAng))*180/Math.PI)+360)%360);
        const seekerOn = torp.traveled>=(torp.enableDist||0);
        const locked = !!torp.target && !torp.seducedBy;
        const autoTDC = torp.wire.autoTDC;

        // Status line
        ctx.fillStyle='rgba(34,197,94,0.85)';
        ctx.font=`bold ${9*DPR}px ui-monospace,monospace`;
        ctx.textAlign='left';
        ctx.fillText(`WIRE LIVE`,wireSecX,detY);
        ctx.fillStyle='rgba(17,24,39,0.55)';
        ctx.font=`${8.5*DPR}px ui-monospace,monospace`;
        ctx.fillText(`${nm.toFixed(1)}nm paid out`,wireSecX+60*DPR,detY);

        // Torpedo heading + seeker
        ctx.fillStyle='rgba(17,24,39,0.55)';
        ctx.font=`${8.5*DPR}px ui-rounded,system-ui,Arial`;
        ctx.fillText('HDG',wireSecX,detY+13*DPR);
        ctx.fillStyle='#111827';
        ctx.font=`${13*DPR}px ui-rounded,system-ui,Arial`;
        ctx.fillText(`${Math.round(hdgDeg).toString().padStart(3,'0')}°`,wireSecX,detY+26*DPR);

        ctx.fillStyle='rgba(17,24,39,0.55)';
        ctx.font=`${8.5*DPR}px ui-rounded,system-ui,Arial`;
        ctx.fillText('SEEKER',wireSecX+55*DPR,detY+13*DPR);
        const seekLabel=!seekerOn?'ARMING':locked?'LOCKED':'SRCH';
        const seekCol=!seekerOn?'rgba(100,100,100,0.70)':locked?'rgba(220,38,38,0.85)':'rgba(234,179,8,0.85)';
        ctx.fillStyle=seekCol;
        ctx.font=`bold ${11*DPR}px ui-monospace,monospace`;
        ctx.fillText(seekLabel,wireSecX+55*DPR,detY+26*DPR);

        // Commanded bearing display
        if(torp.wire.cmdBrg!=null){
          const cmdDeg=(((Math.atan2(Math.cos(torp.wire.cmdBrg),-Math.sin(torp.wire.cmdBrg))*180/Math.PI)+360)%360);
          ctx.fillStyle='rgba(17,24,39,0.45)';
          ctx.font=`${8*DPR}px ui-rounded,system-ui,Arial`;
          ctx.textAlign='left';
          ctx.fillText(`CMD ${Math.round(cmdDeg).toString().padStart(3,'0')}°${autoTDC?' [TDC]':''}`,wireSecX,detY+38*DPR);
        }

        // Buttons row 1: AUTO TDC toggle
        const bH=15*DPR, bY=detY+44*DPR;
        PANEL.btn2(ctx,autoTDC?'AUTO TDC ✓':'AUTO TDC',wireSecX,bY,wireSecW-pad*2,bH,
          autoTDC?'rgba(30,58,95,0.70)':'rgba(17,24,39,0.12)',
          ()=>WP.wireAutoTDC(selTube,!autoTDC));

        // Buttons row 2: nudge left/right (only enabled when auto-TDC off)
        const nudgeY=bY+bH+3*DPR;
        const nudgeW=(wireSecW-pad*2-4*DPR)/4;
        const nudgeCols=['rgba(17,24,39,0.35)','rgba(17,24,39,0.20)','rgba(17,24,39,0.20)','rgba(17,24,39,0.35)'];
        const nudges=[[-10,'◄◄'],[-5,'◄ PORT'],['+5 STBD ►'],['+10','►►']];
        const nudgeDeg=[-10,-5,5,10];
        for(let ni=0;ni<4;ni++){
          PANEL.btn2(ctx,nudges[ni][1]??nudges[ni][0],
            wireSecX+ni*(nudgeW+1*DPR),nudgeY,nudgeW,bH,
            nudgeCols[ni],()=>WP.wireNudge(selTube,nudgeDeg[ni]));
        }

        // Cut wire button
        const cutY=nudgeY+bH+3*DPR;
        PANEL.btn2(ctx,'CUT WIRE',wireSecX,cutY,wireSecW-pad*2,bH+2*DPR,
          'rgba(127,29,29,0.65)',()=>WP.wireCut(selTube));

      } else {
        // No live wire on this tube
        ctx.fillStyle='rgba(17,24,39,0.25)';
        ctx.font=`${8.5*DPR}px ui-monospace,monospace`;
        ctx.textAlign='left';
        const tubeSt=player.torpTubes?.[selTube]??0;
        const stLabel=tubeSt>0?`RELOADING ${tubeSt.toFixed(0)}s`:tubeSt===-1?'OCCUPIED':'READY';
        ctx.fillText(stLabel,wireSecX,detY+10*DPR);
        ctx.fillText('No wire',wireSecX,detY+22*DPR);
      }
    }
    sectionDivider(wireSecX+wireSecW);

    // ── SECTION 7: TDC + CONTACTS — expands to fill remaining panel width ───────
    const tdcX=wireSecX+wireSecW+pad;
    const tdcW=Math.max(340*DPR, panelW-tdcX-pad);
    const tdc=game.tdc;

    // Collect all trackable contacts — all established sonar contacts always shown
    const tdcContacts=[];
    for(const [e,sc] of sonarContacts){
      const isDead=sc.dead===true||e.dead===true;
      tdcContacts.push({ref:e, id:sc.id, sc, isTorp:false, isDead});
    }
    for(const b of bullets){
      if(b.kind==='torpedo'&&b.life>0){
        b._isTorp=true;
        tdcContacts.push({ref:b, id:b.torpId, sc:null, isTorp:true, isDead:false});
      }
    }

    // ── LEFT: Fire Control ────────────────────────────────────────────────────
    const fcW=235*DPR;  // fixed fire control column width
    const fcX=tdcX;

    ctx.fillStyle=tdc.frozen?'rgba(180,60,60,0.70)':'rgba(17,24,39,0.35)';
    ctx.font=`${11*DPR}px ui-rounded,system-ui,Arial`;
    ctx.textAlign='left';
    ctx.fillText(tdc.frozen?'TDC [FROZEN]':'TDC',fcX,panelY+18*DPR);

    // ── Solution quality bar — prominent feedback on designated contact ────────
    {
      const sq=tdc.tmaQuality??0;
      const barW=fcW-36*DPR; // leave room for CLR button
      const barH=5*DPR;
      const barY=panelY+21*DPR;
      // Track background
      ctx.fillStyle='rgba(17,24,39,0.07)';
      ctx.fillRect(fcX,barY,barW,barH);
      if(tdc.target && !tdc.frozen){
        const filled=barW*clamp(sq,0,1);
        const barCol=sq>=0.6?'rgba(22,163,74,0.65)':sq>=0.2?'rgba(217,119,6,0.70)':'rgba(100,100,100,0.45)';
        ctx.fillStyle=barCol;
        ctx.fillRect(fcX,barY,filled,barH);
        // Status label next to bar
        const sqPct=Math.round(clamp(sq,0,1)*100); const sqLabel=(sq>=0.6?'SOLID':sq>=0.2?'BLDG':'BRG')+' '+sqPct+'%';
        const sqCol=sq>=0.6?'rgba(22,163,74,0.80)':sq>=0.2?'rgba(217,119,6,0.85)':'rgba(100,100,100,0.70)';
        ctx.fillStyle=sqCol;
        ctx.font=`bold ${8*DPR}px ui-rounded,system-ui,Arial`;
        ctx.textAlign='right';
        ctx.fillText(sqLabel, fcX+fcW-38*DPR, barY+barH-0.5*DPR);
      }
    }

    // Designation buttons row
    const cbW=35*DPR, cbH=17*DPR, cbGap=3*DPR;
    let cbX=fcX;
    const cbY=panelY+24*DPR;
    ctx.font=`${9*DPR}px ui-rounded,system-ui,Arial`;
    for(const c of tdcContacts){
      const isSelected=tdc.target===c.ref;
      const cQ=c.sc?.tmaQuality??0;
      const selCol=c.isTorp?'rgba(100,30,200,0.75)':c.isDead?'rgba(150,30,30,0.75)':cQ>=0.6?'#1e3a5f':cQ>=0.2?'rgba(146,64,14,0.85)':'rgba(80,80,80,0.75)';
      btn(c.id, cbX, cbY, cbW, cbH, isSelected,
        ()=>{ game.tdc.target=c.ref; game.tdc.targetId=c.id; setMsg(`TDC: ${c.id} DESIGNATED`,1.0); },
        selCol);
      cbX+=cbW+cbGap;
      if(cbX+cbW>fcX+fcW-38*DPR) break;
    }
    btn('CLR',fcX+fcW-32*DPR,cbY,32*DPR,cbH,false,
      ()=>{ game.tdc.target=null; game.tdc.targetId=null; setMsg('TDC: CLEARED',0.8); },
      '#7f1d1d');

    // Fire control readouts — 3 columns: BRG | RNG | INT BRG
    const fcCol=fcW/3;
    const rdY=panelY+52*DPR;
    const rdCol='rgba(17,24,39,0.38)';
    const tmaQ=tdc.tmaQuality??0;
    const hasRange=tdc.range!=null;
    const rdValCol=tdc.target?'#111827':'rgba(17,24,39,0.20)';
    const rdDimCol='rgba(17,24,39,0.26)';
    const fc2=fcX+fcCol, fc3=fcX+fcCol*2;

    ctx.font=`${9*DPR}px ui-rounded,system-ui,Arial`;
    ctx.fillStyle=rdCol; ctx.textAlign='left';
    ctx.fillText('BRG',    fcX,  rdY);
    ctx.fillText('RNG',    fc2,  rdY);
    ctx.fillText('INT BRG',fc3,  rdY);

    const brg=tdc.bearing!=null?Math.round(tdc.bearing).toString().padStart(3,'0')+'°':'---';
    const rng=hasRange?(tdc.range/100).toFixed(1)+'km':'---';
    // INT BRG: convert screen-space math angle to compass
    const intBrg=tdc.intercept!=null
      ?(((Math.atan2(Math.cos(tdc.intercept),-Math.sin(tdc.intercept))*180/Math.PI)+360)%360).toFixed(0).padStart(3,'0')+'°'
      :'---';
    ctx.font=`${14*DPR}px ui-rounded,system-ui,Arial`;
    ctx.fillStyle=rdValCol;            ctx.fillText(brg,   fcX, rdY+16*DPR);
    ctx.fillStyle=hasRange?rdValCol:rdDimCol; ctx.fillText(rng,fc2,rdY+16*DPR);
    // INT BRG colour: navy=range+lead, amber=bearing-only, dim=no target
    ctx.fillStyle=tdc.target&&hasRange?'#1e3a5f':tdc.target?'#92400e':rdValCol;
    ctx.fillText(intBrg,fc3,rdY+16*DPR);

    // Row 2: DEP | CRS | SPD
    const rdY2=rdY+30*DPR;
    ctx.font=`${9*DPR}px ui-rounded,system-ui,Arial`;
    ctx.fillStyle=rdCol; ctx.textAlign='left';
    ctx.fillText('DEP',fcX,rdY2);
    ctx.fillText('CRS',fc2,rdY2);
    ctx.fillText('SPD',fc3,rdY2);

    const dep=tdc.depth!=null?Math.round(tdc.depth)+'m':'---';
    const crs=tdc.course!=null?Math.round(tdc.course).toString().padStart(3,'0')+'°':'---';
    const spd=tdc.speed!=null?Math.round(tdc.speed)+'kt':'---';
    ctx.font=`${14*DPR}px ui-rounded,system-ui,Arial`;
    ctx.fillStyle=rdValCol;                    ctx.fillText(dep,fcX,rdY2+16*DPR);
    ctx.fillStyle=hasRange?rdValCol:rdDimCol;  ctx.fillText(crs,fc2,rdY2+16*DPR);
    ctx.fillStyle=hasRange?rdValCol:rdDimCol;  ctx.fillText(spd,fc3,rdY2+16*DPR);

    // ── WEPS firing solution proposal ─────────────────────────────────────────
    {
      const wp=game.wepsProposal;
      const rdY3=rdY2+28*DPR;
      ctx.font=`${9*DPR}px ui-rounded,system-ui,Arial`;
      ctx.fillStyle='rgba(17,24,39,0.38)';
      ctx.textAlign='left';
      ctx.fillText('WEPS SOLUTION',fcX,rdY3);

      if(wp){
        const wBrg=(((Math.atan2(Math.cos(wp.bearing),-Math.sin(wp.bearing))*180/Math.PI)+360)%360).toFixed(0).padStart(3,'0')+'°';
        const wDep=Math.round(wp.depth||player.depth)+'m';
        const confCol=wp.confidence==='solid'?'#1e3a5f':wp.confidence==='degraded'?'#92400e':'rgba(17,24,39,0.40)';
        const confLabel=wp.confidence==='solid'?'SOLID':wp.confidence==='degraded'?'DEGRADED':'POOR — BUILD TMA';
        // Proposed bearing — large, coloured by confidence
        ctx.font=`bold ${14*DPR}px ui-rounded,system-ui,Arial`;
        ctx.fillStyle=confCol;
        ctx.fillText(wBrg,fcX,rdY3+16*DPR);
        // Confidence badge
        ctx.font=`${8*DPR}px ui-rounded,system-ui,Arial`;
        ctx.fillText(confLabel, fcX+40*DPR, rdY3+10*DPR);
        ctx.fillStyle='rgba(17,24,39,0.50)';
        ctx.fillText(wDep, fcX+40*DPR, rdY3+20*DPR);
        // SHOOT button — green if solid, amber if degraded, dim if bearing-only
        const canShoot = wp.confidence==='solid'||wp.confidence==='degraded'; // bearingonly blocks SHOOT
        const shootCol=wp.confidence==='solid'?'rgba(22,100,60,0.85)':wp.confidence==='degraded'?'rgba(130,60,10,0.80)':'rgba(60,60,60,0.28)';
        btn('SHOOT',fcX+fcW*0.55,rdY3+2*DPR,fcW*0.42,20*DPR,false,
          ()=>{ if(canShoot) PANEL.wepsShoot(); else window.G.addLog('WEPS','Solution too poor — build TMA first'); },
          shootCol);
      } else {
        ctx.font=`${9.5*DPR}px ui-rounded,system-ui,Arial`;
        ctx.fillStyle='rgba(17,24,39,0.20)';
        ctx.fillText('NO TARGET DESIGNATED',fcX,rdY3+14*DPR);
      }
    }

    // Thin vertical divider between fire control and contact list
    const divX=fcX+fcW+pad*0.5;
    ctx.strokeStyle='rgba(17,24,39,0.10)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(divX,panelY+8*DPR); ctx.lineTo(divX,panelY+panelH-6*DPR); ctx.stroke();

    // ── RIGHT: Contact Quality List ───────────────────────────────────────────
    const cqX=divX+pad*0.5;
    const cqW=tdcX+tdcW-cqX-pad;

    ctx.fillStyle='rgba(17,24,39,0.35)';
    ctx.font=`${11*DPR}px ui-rounded,system-ui,Arial`;
    ctx.textAlign='left';
    ctx.fillText('CONTACTS',cqX,panelY+18*DPR);

    // Column headers
    const cqNow=performance.now()/1000;
    const idColW=30*DPR, brgColW=32*DPR, barColW=Math.max(60*DPR, cqW-idColW-brgColW-56*DPR);
    const obsColW=22*DPR, ageColW=28*DPR;
    const hdrY=panelY+30*DPR;
    ctx.font=`${11*DPR}px ui-rounded,system-ui,Arial`;
    ctx.fillStyle='rgba(17,24,39,0.35)';
    ctx.fillText('ID',   cqX,                               hdrY);
    ctx.fillText('BRG',  cqX+idColW,                        hdrY);
    ctx.fillText('SOLUTION',cqX+idColW+brgColW,             hdrY);
    ctx.fillText('OBS',  cqX+idColW+brgColW+barColW,        hdrY);
    ctx.fillText('AGE',  cqX+idColW+brgColW+barColW+obsColW,hdrY);

    // All established contacts always shown — quality drives appearance
    const allContacts=[];
    for(const [e,sc] of sonarContacts){
      const isDead=sc.dead===true||e.dead===true;
      allContacts.push({ref:e, sc, isTorp:false, id:sc.id, isDead});
    }
    for(const b of bullets){
      if(b.kind==='torpedo'&&!b.friendly&&b.life>0)
        allContacts.push({ref:b, sc:null, isTorp:true, id:b.torpId, isDead:false});
    }

    const rowH=23*DPR;
    const rowsVisible=Math.floor((panelH-50*DPR)/rowH);
    const maxScroll=Math.max(0,allContacts.length-rowsVisible);
    // Clamp scroll offset
    game.contactsScroll=Math.max(0,Math.min(maxScroll,game.contactsScroll||0));
    const startRow=game.contactsScroll;

    // Scroll indicator arrows — only if list overflows
    if(allContacts.length>rowsVisible){
      const arrowX=cqX+cqW-14*DPR;
      const canUp=startRow>0, canDown=startRow<maxScroll;
      ctx.font=`${10*DPR}px ui-rounded,system-ui,Arial`;
      ctx.textAlign='center';
      ctx.fillStyle=canUp?'rgba(17,24,39,0.55)':'rgba(17,24,39,0.15)';
      ctx.fillText('▲', arrowX, panelY+30*DPR);
      ctx.fillStyle=canDown?'rgba(17,24,39,0.55)':'rgba(17,24,39,0.15)';
      ctx.fillText('▼', arrowX, panelY+panelH-12*DPR);
      // Register arrow buttons
      btn('▲',arrowX-7*DPR,panelY+20*DPR,14*DPR,12*DPR,false,
        ()=>{ game.contactsScroll=Math.max(0,(game.contactsScroll||0)-1); },
        'transparent','transparent');
      btn('▼',arrowX-7*DPR,panelY+panelH-22*DPR,14*DPR,12*DPR,false,
        ()=>{ game.contactsScroll=Math.min(maxScroll,(game.contactsScroll||0)+1); },
        'transparent','transparent');
      // Scrollbar track
      const trackH=(panelH-44*DPR);
      const trackY=panelY+32*DPR;
      const trackX=arrowX-3*DPR;
      ctx.fillStyle='rgba(17,24,39,0.06)';
      ctx.fillRect(trackX,trackY,4*DPR,trackH);
      // Thumb
      const thumbH=Math.max(16*DPR,trackH*(rowsVisible/allContacts.length));
      const thumbY=trackY+(trackH-thumbH)*(startRow/maxScroll||0);
      ctx.fillStyle='rgba(17,24,39,0.22)';
      ctx.beginPath();
      ctx.roundRect(trackX,thumbY,4*DPR,thumbH,2*DPR);
      ctx.fill();
    }

    // Clip rows to panel area
    ctx.save();
    ctx.beginPath();
    ctx.rect(cqX-2*DPR, panelY+36*DPR, cqW-10*DPR, panelH-38*DPR);
    ctx.clip();

    for(let i=startRow;i<Math.min(startRow+rowsVisible,allContacts.length);i++){
      const entry=allContacts[i];
      const ry=panelY+48*DPR+(i-startRow)*rowH;
      const isDesignated=tdc.target===entry.ref;
      const sc=entry.sc;
      const q=sc?.tmaQuality??0;
      const obsCount=sc?.bearings?.length??0;
      const latestBrg=sc?.latestBrg??null;
      const age=sc ? cqNow-sc.lastT : 0;
      const fresh=(sc?.activeT??0)>0;
      const isDead=entry.isDead===true;
      // Highlight row if designated
      if(isDesignated){
        ctx.fillStyle=isDead?'rgba(150,20,20,0.08)':'rgba(30,58,95,0.08)';
        ctx.fillRect(cqX-2*DPR, ry-rowH*0.78, cqW+2*DPR, rowH);
      }

      // Staleness: how long since last observation
      const T_now=game.missionT||0;
      const staleSecs=sc ? T_now-(sc.lastObsT||0) : 0;
      const staleAlpha=isDead?0.40:entry.isTorp?0.70:Math.max(0.22, 0.80-Math.min(1,staleSecs/90)*0.58);
      const rowAlpha=staleAlpha;

      // ID pill — quality-tinted: solid=navy, building=amber, bearing-only=grey
      const rQ=sc?.tmaQuality??0;
      const pillCol=isDead?`rgba(150,30,30,${rowAlpha})`:entry.isTorp?`rgba(100,30,200,${rowAlpha})`:rQ>=0.6?`rgba(17,24,39,${rowAlpha})`:rQ>=0.2?`rgba(130,60,10,${rowAlpha})`:`rgba(80,80,80,${rowAlpha})`;
      ctx.fillStyle=pillCol;
      ctx.font=`bold ${9*DPR}px ui-rounded,system-ui,Arial`;
      ctx.textAlign='left';
      ctx.fillText(entry.id+(isDead?' ✕':''), cqX, ry);

      if(!entry.isTorp && sc){
        // BRG
        const brgDeg=latestBrg!=null?((latestBrg*180/Math.PI)+360)%360:null;
        ctx.fillStyle=`rgba(17,24,39,${rowAlpha*0.85})`;
        ctx.font=`${9.5*DPR}px ui-monospace,monospace`;
        ctx.fillText(brgDeg!=null?Math.round(brgDeg).toString().padStart(3,'0')+'°':'---',
                     cqX+idColW, ry);

        // TMA quality bar — or DESTROYED for dead contacts, CONTACT LOST for lost contacts
        const barX=cqX+idColW+brgColW;
        const barH=7*DPR;
        const barY=ry-barH-1*DPR;
        if(isDead){
          ctx.fillStyle=`rgba(150,20,20,0.12)`;
          ctx.fillRect(barX,barY,barColW,barH);
          ctx.font=`${8*DPR}px ui-rounded,system-ui,Arial`;
          ctx.fillStyle=`rgba(150,20,20,0.55)`;
          ctx.textAlign='left';
          ctx.fillText('DESTROYED — LAST KNOWN', barX+2*DPR, ry-3*DPR);
        } else {
          ctx.fillStyle='rgba(17,24,39,0.08)';
          ctx.fillRect(barX,barY,barColW,barH);
          const qFill=clamp(q,0,1);
          const qBarCol=q>=0.6?`rgba(22,163,74,${rowAlpha*0.75})`
                       :q>=0.2?`rgba(217,119,6,${rowAlpha*0.75})`
                              :`rgba(220,38,38,${rowAlpha*0.65})`;
          ctx.fillStyle=qBarCol;
          ctx.fillRect(barX,barY,barColW*qFill,barH);
          ctx.strokeStyle=`rgba(17,24,39,0.12)`;ctx.lineWidth=0.5;
          ctx.strokeRect(barX,barY,barColW,barH);
          ctx.font=`${5.5*DPR}px ui-rounded,system-ui,Arial`;
          ctx.fillStyle=`rgba(17,24,39,${rowAlpha*0.65})`;
          ctx.textAlign='left';
          const qStr=q>=0.6?'SOLID':q>=0.2?'BUILDING':'BEARING ONLY';
          ctx.fillText(qStr, barX+2*DPR, ry-3*DPR);
          if(baselineM>0 && barColW>50*DPR){
            ctx.font=`${5*DPR}px ui-rounded,system-ui,Arial`;
            ctx.fillStyle=`rgba(17,24,39,${rowAlpha*0.40})`;
            ctx.fillText(`${(baselineM/100).toFixed(1)}km base`, barX+2*DPR, ry+3.5*DPR);
          }
          ctx.fillStyle=`rgba(17,24,39,${rowAlpha*0.70})`;
          ctx.font=`${9*DPR}px ui-monospace,monospace`;
          ctx.textAlign='right';
          ctx.fillText(obsCount, cqX+idColW+brgColW+barColW+obsColW-2*DPR, ry);
          const ageStr=age<60?Math.round(age)+'s':Math.floor(age/60)+'m'+Math.floor(age%60).toString().padStart(2,'0')+'s';
          ctx.fillStyle=`rgba(17,24,39,${rowAlpha*0.55})`;
          ctx.font=`${11*DPR}px ui-monospace,monospace`;
          ctx.textAlign='right';
          ctx.fillText(ageStr, cqX+idColW+brgColW+barColW+obsColW+ageColW, ry);
        }
      } else if(entry.isTorp){
        // Enemy torpedo — show bearing
        const dx=AI.wrapDx(player.wx,entry.ref.x), dy=entry.ref.y-player.wy;
        const tb=((Math.atan2(dy,dx)*180/Math.PI)+360)%360;
        ctx.fillStyle=`rgba(100,30,200,${rowAlpha*0.75})`;
        ctx.font=`${9.5*DPR}px ui-monospace,monospace`;
        ctx.textAlign='left';
        ctx.fillText(Math.round(tb).toString().padStart(3,'0')+'°', cqX+idColW, ry);
        ctx.font=`${11*DPR}px ui-rounded,system-ui,Arial`;
        ctx.fillText('INBOUND', cqX+idColW+brgColW+2*DPR, ry);
      }

      ctx.textAlign='left';
    }

    ctx.restore(); // end clip

    // Empty state
    if(allContacts.length===0){
      ctx.fillStyle='rgba(17,24,39,0.22)';
      ctx.font=`${9.5*DPR}px ui-rounded,system-ui,Arial`;
      ctx.textAlign='left';
      ctx.fillText('No contacts',cqX,panelY+52*DPR);
    }

    // ── Message strip ─────────────────────────────────────────────────────────
    if(game.msgT>0){
      ctx.fillStyle=`rgba(17,24,39,${Math.min(1,game.msgT*1.4)})`;
      ctx.font=`${11*DPR}px ui-rounded,system-ui,Arial`;
      ctx.textAlign='center';
      ctx.fillText(game.msg,panelW/2,panelY-8*DPR);
    }

    // ── Game over overlay ─────────────────────────────────────────────────────
    if(game.over){
      ctx.fillStyle='rgba(17,24,39,0.82)';
      ctx.fillRect(0,0,panelW,panelY);
      ctx.fillStyle='#f7f7fb';
      ctx.font=`${48*DPR}px ui-rounded,system-ui,Arial`;
      ctx.textAlign='center';
      ctx.fillText('SUNK',panelW/2,H/2-16*DPR);
      ctx.fillStyle='rgba(247,247,251,0.65)';
      ctx.font=`${14*DPR}px ui-rounded,system-ui,Arial`;
      ctx.fillText(`SCORE: ${game.score}`,panelW/2,H/2+28*DPR);
      ctx.font=`${11*DPR}px ui-rounded,system-ui,Arial`;
      ctx.fillText('R to restart',panelW/2,H/2+52*DPR);
    }
  }

  // ── Threat awareness bar (top) ────────────────────────────────────────────────
  function drawThreatBar(W){
    let maxSus=0;
    for(const e of enemies) maxSus=Math.max(maxSus,e.suspicion||0);
    const state=maxSus>C.enemy.susEngage?'ALERT':maxSus>C.enemy.susInvestigate?'SEARCH':'CLEAR';
    const col=state==='ALERT'?'#dc2626':state==='SEARCH'?'#d97706':'#16a34a';

    ctx.fillStyle='rgba(247,247,251,0.88)';
    ctx.fillRect(0,0,W-88*DPR,28*DPR);
    ctx.strokeStyle='rgba(17,24,39,0.10)';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,28*DPR); ctx.lineTo(W-88*DPR,28*DPR); ctx.stroke();

    // Threat fill bar
    ctx.fillStyle=col+'33';
    ctx.fillRect(0,0,(W-88*DPR)*clamp(maxSus,0,1),28*DPR);

    ctx.fillStyle=col;
    doodleText(state,(W-88*DPR)/2,19*DPR,11*DPR,'center');

    // Controls hint
    ctx.fillStyle='rgba(17,24,39,0.28)';
    doodleText('LMB=waypoint  RMB=remove last  SHIFT+LMB=fire torp  scroll=zoom  SPACE=ping  R=reset',12*DPR,19*DPR,9*DPR,'left');
  }

  // ── Main draw ─────────────────────────────────────────────────────────────────
  function draw(){
    const W=canvas.width, H=canvas.height;
    const panelH=190*DPR;
    const plotH=H-panelH;
    const plotW=W-88*DPR;
    const Z=cam.zoom*DPR;

    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,W,H);

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
    const cx=(W-88*DPR)/2, cy=(H-panelH)/2;
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
    ctx.font=`${8*DPR}px ui-rounded,system-ui,Arial`;
    ctx.textAlign='left';
    const nmLabel = barNM < 1 ? `${barNM}nm` : `${barNM}nm`;
    ctx.fillText(nmLabel, barX+barPx+5*DPR, barY+barH, 40*DPR);
    // Also show metres/km for sub-nm bars
    if(barNM <= 1){
      const mLabel = barNM >= 1 ? `${Math.round(barWU*10)/1000}km` : `${Math.round(barWU*10)}m`;
      ctx.fillStyle='rgba(17,24,39,0.38)';
      ctx.font=`${7*DPR}px ui-rounded,system-ui,Arial`;
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

      drawTorpedoTopDown(b);
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

    // ── Message log board ─────────────────────────────────────────────────────
    drawMsgLog(W,H,panelH);

    // ── Sonar raw feed ────────────────────────────────────────────────────────
    drawSonarFeed(W,H,panelH);

    // ── Command Panel ─────────────────────────────────────────────────────────
    drawPanel(W,H);

    // ── Threat bar ────────────────────────────────────────────────────────────
    drawThreatBar(W);

    // ── Damage Control overlay ────────────────────────────────────────────────
    drawDamagePanel(W,H,panelH);

    // ── Cursor distance label ─────────────────────────────────────────────────
    // Show bearing + distance from sub to cursor while mouse is in chart area
    {
      const mx=window.I?.mouseX??-1, my=window.I?.mouseY??-1;
      const inChart=mx>=0 && mx<(W-88*DPR) && my>=0 && my<(H-panelH);
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
        ctx.font=`${9*DPR}px ui-rounded,system-ui,Arial`;
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
        ctx.font=`bold ${13*DPR}px ui-rounded,system-ui,Arial`;
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
      // Corner badge
      ctx.fillStyle='rgba(255,0,220,0.80)';
      ctx.font=`bold ${9*DPR}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillText('⬛ DEBUG: TRUE POS', 12*DPR, (H-panelH)-10*DPR);
      ctx.restore();
    }
  }

  window.R={draw};
})();