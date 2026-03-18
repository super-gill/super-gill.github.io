// render-world.js — world map, route, and top-down unit rendering
// Exposes window.RWORLD: { drawLand, drawRoute, drawPlayerTopDown,
//                          drawEnemySubTopDown, drawEnemyBoatTopDown, drawTorpedoTopDown }
// Requires window.R (render-utils.js) to be loaded first.
(() => {
  'use strict';
  const {lerp}=window.M;
  const {ctx,canvas,DPR,world,cam,player}=window.G;
  const {doodleLine,doodleCircle,doodleText,w2s,wScale,U}=window.R;

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
      doodleText(fmtDist(d),mx+U(4),my-U(4),U(8),'left');
    }

    // Waypoint circles + numbers
    for(let i=0;i<route.length;i++){
      const [wx2,wy2]=w2s(route[i].wx,route[i].wy);
      ctx.strokeStyle='rgba(17,24,39,0.45)';
      doodleCircle(wx2,wy2,6,1.5);
      ctx.fillStyle='rgba(17,24,39,0.55)';
      doodleText(`${i+1}`,wx2+9,wy2+4,U(9),'left');
    }

    // Total distance under last waypoint
    if(route.length>=1){
      const [lx,ly]=w2s(route[route.length-1].wx,route[route.length-1].wy);
      ctx.fillStyle='rgba(17,24,39,0.32)';
      doodleText(`TOTAL ${fmtDist(totalWU)}`,lx+9,ly+U(14),U(8),'left');
    }
  }

  // ── Player sub (top-down) ─────────────────────────────────────────────────────
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
      doodleText(b.torpId, sx+U(8), sy-U(6), U(8), 'left');
      if(b.depth!=null)
        doodleText(Math.round(b.depth)+'m', sx+U(8), sy+U(10), U(7), 'left');
    }
  }

  window.RWORLD={drawLand,drawRoute,drawPlayerTopDown,drawEnemySubTopDown,drawEnemyBoatTopDown,drawTorpedoTopDown};
})();
