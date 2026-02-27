(() => {
  'use strict';
  const C=window.CONFIG; const {TAU,clamp,lerp,now,jitter}=window.M;
  const {ctx,canvas,DPR,world,cam,bullets,particles,enemies,decoys,contacts,cwisTracers,player,game}=window.G;
  const AI=window.AI;

  function doodleLine(x1,y1,x2,y2,w=2){
    const steps=Math.max(6,Math.floor(Math.hypot(x2-x1,y2-y1)/18));
    ctx.lineWidth=w; ctx.beginPath();
    for(let i=0;i<=steps;i++){
      const t=i/steps;
      const x=x1+(x2-x1)*t+Math.sin(t*6.28)*jitter(1.2);
      const y=y1+(y2-y1)*t+Math.cos(t*6.28)*jitter(1.2);
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
  function doodleCircle(x,y,r,w=2){
    ctx.lineWidth=w; ctx.beginPath();
    const k=18;
    for(let i=0;i<=k;i++){
      const a=(i/k)*TAU;
      const rr=r+Math.sin(a*3)*jitter(0.8);
      const px=x+Math.cos(a)*rr;
      const py=y+Math.sin(a)*rr;
      if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
    }
    ctx.stroke();
  }
  function doodleText(txt,x,y,size=16,align="left"){
    ctx.font=`${size}px ui-rounded, system-ui, -apple-system, Segoe UI, Arial`;
    ctx.textAlign=align;
    ctx.fillText(txt,x,y);
  }

  function drawScreenBubbles(W,H){
    if(!C.visuals.screenBubbles) return;
    const t=now();
    ctx.strokeStyle='rgba(17,24,39,0.07)';
    const cols=C.visuals.screenBubbleCols|0;
    for(let i=0;i<cols;i++){
      const sx=(i+0.5)*(W/cols);
      for(let k=0;k<3;k++){
        const phase=i*1.7+k*2.9;
        const y=H-((t*70+phase*80)%(H+120));
        const r=2.5+((i+k)%3);
        doodleCircle(sx,y,r,1);
      }
    }
  }

  function drawPlayerLocal(r){
    const L=r*2.6, Wd=r*1.5, noseX=L*0.55, tailX=-L*0.65;
    ctx.lineWidth=3; ctx.beginPath();
    const topPts=18;
    for(let i=0;i<=topPts;i++){
      const t=i/topPts;
      const x=lerp(tailX,noseX,t);
      const bulge=Math.sin(t*Math.PI)*0.95;
      const y=-bulge*Wd*0.55+jitter(0.7);
      if(i===0) ctx.moveTo(x+jitter(0.8),y); else ctx.lineTo(x+jitter(0.8),y);
    }
    for(let i=topPts;i>=0;i--){
      const t=i/topPts;
      const x=lerp(tailX,noseX,t);
      const bulge=Math.sin(t*Math.PI)*0.95;
      const y=+bulge*Wd*0.55+jitter(0.7);
      ctx.lineTo(x+jitter(0.8),y);
    }
    ctx.closePath(); ctx.stroke();
    doodleLine(-L*0.10,-Wd*0.55, L*0.05,-Wd*1.00,3);
    doodleLine( L*0.05,-Wd*1.00, L*0.22,-Wd*0.45,3);
    doodleLine( L*0.22,-Wd*0.45,-L*0.10,-Wd*0.55,3);
    doodleLine(tailX+10,0,tailX-22,-10,2);
    doodleLine(tailX+10,0,tailX-22,+10,2);
    doodleLine(tailX-6,-14,tailX-6,+14,2);
    doodleLine(noseX-8,-6,noseX+10,0,2);
    doodleLine(noseX-8,+6,noseX+10,0,2);
  }

  function draw(){
    const W=canvas.width,H=canvas.height;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle="#f7f7fb"; ctx.fillRect(0,0,W,H);
    drawScreenBubbles(W,H);

    function drawWorld(offsetX){
      ctx.fillStyle="#ffffff"; ctx.fillRect(-offsetX,0,world.w,world.seaLevel-cam.y);
      ctx.fillStyle="#e9f1ff"; ctx.fillRect(-offsetX,world.seaLevel-cam.y,world.w,world.ground-world.seaLevel);
      ctx.fillStyle="#f2eadb"; ctx.fillRect(-offsetX,world.ground-cam.y,world.w,world.h-world.ground);
      ctx.fillStyle="rgba(17,24,39,0.04)"; ctx.fillRect(-offsetX,world.layerY1-cam.y,world.w,(world.layerY2-world.layerY1));
      ctx.strokeStyle="#1f2937";
      doodleLine(-offsetX,world.seaLevel-cam.y,world.w-offsetX,world.seaLevel-cam.y,3);
      doodleLine(-offsetX,world.ground-cam.y,world.w-offsetX,world.ground-cam.y,3);

      if(player.sonarPulse>0){
        const t=1-(player.sonarPulse/C.player.pingPulse);
        const R=40+t*980;
        ctx.strokeStyle=`rgba(31,41,55,${0.34*(1-t)})`;
        doodleCircle(player.x-offsetX,player.y-cam.y,R,3);
      }

      for(const c of contacts){
        const cx=c.x-offsetX, cy=c.y-cam.y;
        const a=clamp(c.life/1.6,0,1);
        ctx.strokeStyle=`rgba(17,24,39,${0.22*a})`;
        doodleCircle(cx,cy,c.u*(0.35+0.25*(1-a)),2);
        ctx.strokeStyle=`rgba(17,24,39,${0.16*a})`;
        const px=player.x-offsetX, py=player.y-cam.y;
        doodleLine(px,py,px+Math.cos(c.bearing)*220,py+Math.sin(c.bearing)*220,2);
      }

      for(const d of decoys){
        const dx=d.x-offsetX, dy=d.y-cam.y;
        const a=clamp(d.life/8.0,0,1);
        ctx.strokeStyle=d.kind==="flare"?`rgba(17,24,39,${0.26*a})`:`rgba(17,24,39,${0.30*a})`;
        if(d.kind==="flare"){
          doodleCircle(dx,dy,d.r,2);
          doodleLine(dx,dy,dx-d.vx*0.06,dy-d.vy*0.06,2);
          doodleLine(dx-12,dy+10,dx+12,dy-10,2);
          doodleLine(dx-12,dy-10,dx+12,dy+10,2);
        } else {
          doodleCircle(dx,dy,d.r,3);
          doodleText("ZZZ",dx,dy+6,14*DPR,"center");
        }
      }

      for(const e of enemies){
        const ey=(e.type==="boat"?e.y:e.y);
        const close=Math.hypot(AI.wrapDx(player.x,e.x),(ey-player.y))<190;
        const detected=(e.detectedT||0)>0;
        const live=(e.seen>0)||close;
        if(!(detected||live)) continue;

        let gx=e.x, gy=ey, alpha=1.0;
        if(!live&&detected){gx=(e.lastX??e.x); gy=(e.lastY??ey); alpha=0.22;}
        const ex=gx-offsetX, ey2=gy-cam.y;
        ctx.strokeStyle=(alpha>=1.0)?"#111827":`rgba(17,24,39,${alpha})`;

        if(e.type==="boat"){
          doodleLine(ex-44,ey2+10,ex+44,ey2+10,3);
          doodleLine(ex-36,ey2+10,ex-18,ey2+24,3);
          doodleLine(ex+36,ey2+10,ex+18,ey2+24,3);
          doodleLine(ex-18,ey2+24,ex+18,ey2+24,3);
          doodleLine(ex,ey2-26,ex,ey2+6,3);
          doodleLine(ex,ey2-26,ex+28,ey2-10,3);
        } else {
          doodleCircle(ex,ey2,e.r,3);
          doodleLine(ex-e.r,ey2,ex+e.r,ey2,2);
          doodleLine(ex+e.r-6,ey2,ex+e.r+24,ey2-6,3);
          doodleLine(ex-10,ey2-e.r-8,ex-10,ey2-e.r+8,3);
          doodleLine(ex-10,ey2-e.r-8,ex+6,ey2-e.r-12,3);
        }
      }

      for(const b of bullets){
        const bx=b.x-offsetX, by=b.y-cam.y;
        ctx.strokeStyle=b.friendly?"#0f172a":"rgba(15,23,42,0.55)";
        if(b.kind==="torpedo"){
          doodleLine(bx-10,by,bx+10,by,3);
          doodleCircle(bx+8,by,4,2);
        } else if(b.kind==="depthCharge"){
          doodleCircle(bx,by,6,2);
          doodleLine(bx-6,by-2,bx+6,by+2,2);
        }
      }

      for(const p of particles){
        const px=p.x-offsetX, py=p.y-cam.y;
        const a=clamp(p.life/0.9,0,1);
        ctx.strokeStyle=p.watery?`rgba(31,41,55,${0.22*a})`:`rgba(31,41,55,${0.32*a})`;
        doodleCircle(px,py,p.size*(0.6+0.7*(1-a)),2);
      }

      // player
      const px=player.x-offsetX, py=player.y-cam.y;
      ctx.strokeStyle=(player.invuln>0)?"rgba(17,24,39,0.45)":"#111827";
      ctx.save();
      ctx.translate(px,py);
      if(C.visuals.rotatePlayer){
        ctx.rotate(player.heading);
      } else {
        // Mirror when heading left
        if(Math.cos(player.heading) < 0){ ctx.scale(-1, 1); }
      }
      drawPlayerLocal(C.player.r);
      ctx.restore();

      // aim line
      ctx.strokeStyle="rgba(17,24,39,0.18)";
      const aimX=cam.x+window.I.mouseX;
      const aimY=cam.y+window.I.mouseY;
      doodleLine(px,py,(aimX-offsetX),(aimY-cam.y),2);
    }

    const off=cam.x;
    drawWorld(off);
    if(cam.x+W>world.w) drawWorld(off-world.w);
    else if(cam.x<0) drawWorld(off+world.w);

    // HUD
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle="#111827";
    doodleText("DOODLE SUB — CAPTAIN SIM v5",18*DPR,34*DPR,22*DPR,"left");
    doodleText(`Score: ${game.score}`,18*DPR,58*DPR,16*DPR,"left");

    const barX=18*DPR, barY=72*DPR, barW=220*DPR, barH=14*DPR;
    ctx.fillStyle="rgba(255,255,255,0.75)"; ctx.fillRect(barX,barY,barW,barH);
    ctx.strokeStyle="#111827"; ctx.strokeRect(barX,barY,barW,barH);
    ctx.fillStyle="rgba(17,24,39,0.85)"; ctx.fillRect(barX,barY,barW*(player.hp/C.player.hpMax),barH);
    ctx.fillStyle="#111827"; doodleText(`HP ${player.hp|0}/${C.player.hpMax}`,barX+barW+10*DPR,barY+12*DPR,14*DPR,"left");

    const nX=18*DPR, nY=(barY+22*DPR), nW=220*DPR, nH=10*DPR;
    ctx.fillStyle="rgba(255,255,255,0.70)"; ctx.fillRect(nX,nY,nW,nH);
    ctx.strokeStyle="#111827"; ctx.strokeRect(nX,nY,nW,nH);
    ctx.fillStyle="rgba(17,24,39,0.75)"; ctx.fillRect(nX,nY,nW*player.noise,nH);
    ctx.fillStyle="#111827"; doodleText(player.cavitating?"Noise (CAV)":"Noise",nX+nW+10*DPR,nY+10*DPR,14*DPR,"left");

    const spOrd = (player.speedOrderKts ?? 0);
    doodleText(`Speed O/A: ${spOrd} / ${player.speed.toFixed(1)} kts`, 18*DPR, (barY+54*DPR), 14*DPR, "left", false);
    doodleText(`Depth O/A: ${(player.depthOrder-world.seaLevel)|0} / ${(player.y-world.seaLevel)|0}`,18*DPR,(barY+84*DPR),14*DPR,"left");
    doodleText(`Silent: ${player.silent?"ON":"OFF"} (Z)`,18*DPR,(barY+94*DPR),14*DPR,"left");
    doodleText(`Dir: ${player.dir<0?"LEFT":"RIGHT"}  (Dec@0: release+press flips)`,18*DPR,(barY+104*DPR),14*DPR,"left");
    doodleText(`Course flip: F  (now: ${player.dir<0?"LEFT":"RIGHT"})`,18*DPR,(barY+104*DPR),14*DPR,"left");

    const torp=player.torpCd<=0?"READY":player.torpCd.toFixed(1)+"s";
    const ping=player.pingCd<=0?"READY":player.pingCd.toFixed(1)+"s";
    const cm=player.cmCd<=0?"READY":player.cmCd.toFixed(1)+"s";
    doodleText(`Torp (LMB): ${torp}`,18*DPR,(barY+134*DPR),14*DPR,"left");
    doodleText(`Ping (Space): ${ping}`,18*DPR,(barY+154*DPR),14*DPR,"left");
    doodleText(`Decoy (Q): ${cm}`,18*DPR,(barY+174*DPR),14*DPR,"left");
    doodleText(`Emerg Turn (E): ${player.emergTurnCd<=0?"READY":player.emergTurnCd.toFixed(1)+"s"}  Crash Dive (C): ${player.crashDiveCd<=0?"READY":player.crashDiveCd.toFixed(1)+"s"}`,18*DPR,(barY+204*DPR),14*DPR,"left");

    if(game.msg){
      ctx.fillStyle="rgba(255,255,255,0.82)";
      const bx=18*DPR, by=(barY+224*DPR), bw=520*DPR, bh=26*DPR, pad=10*DPR;
      ctx.fillRect(bx,by,bw,bh); ctx.strokeStyle="#111827"; ctx.strokeRect(bx,by,bw,bh);
      ctx.fillStyle="#111827"; doodleText(game.msg,bx+pad,by+18*DPR,14*DPR,"left");
    }

    
    function drawDepthChart(){
      const pad = 18*DPR;
      const x = canvas.width - pad;
      const top = 70*DPR;
      const bottom = canvas.height - 70*DPR;
      const h = bottom - top;
      const maxDepth = (world.ground - world.seaLevel - 60);
      const depthNow = clamp(player.y - world.seaLevel, 0, maxDepth);
      const depthOrd = clamp((player.depthOrder||player.y) - world.seaLevel, 0, maxDepth);
      const yOf = (d)=> top + (d/maxDepth)*h;

      ctx.strokeStyle = "rgba(17,24,39,0.55)";
      doodleLine(x, top, x, bottom, 2);

      ctx.fillStyle = "#111827";
      doodleText("0", x-8*DPR, top-6*DPR, 12*DPR, "right");

      const l1 = clamp(world.layerY1 - world.seaLevel, 0, maxDepth);
      const l2 = clamp(world.layerY2 - world.seaLevel, 0, maxDepth);
      ctx.fillStyle = "rgba(17,24,39,0.06)";
      ctx.fillRect(x-10*DPR, yOf(l1), 20*DPR, yOf(l2)-yOf(l1));

      ctx.strokeStyle = "rgba(17,24,39,0.35)";
      for(let d=200; d<maxDepth; d+=200){
        const yy = yOf(d);
        doodleLine(x-8*DPR, yy, x+8*DPR, yy, 1.5);
        ctx.fillStyle = "rgba(17,24,39,0.75)";
        doodleText(String(d|0), x-10*DPR, yy+4*DPR, 12*DPR, "right");
      }

      const yo = yOf(depthOrd);
      ctx.strokeStyle = "rgba(17,24,39,0.85)";
      doodleLine(x, yo, x+14*DPR, yo-7*DPR, 2);
      doodleLine(x+14*DPR, yo-7*DPR, x+14*DPR, yo+7*DPR, 2);
      doodleLine(x+14*DPR, yo+7*DPR, x, yo, 2);

      const yn = yOf(depthNow);
      ctx.strokeStyle = "#111827";
      doodleCircle(x, yn, 6*DPR, 2);

      ctx.fillStyle = "#111827";
      doodleText("DEPTH", x-2*DPR, top-26*DPR, 12*DPR, "right");
      doodleText(`${(depthOrd|0)}→`, x+18*DPR, yo+4*DPR, 12*DPR, "left");
      doodleText(`${(depthNow|0)}`, x+18*DPR, yn+4*DPR, 12*DPR, "left");
    }
    drawDepthChart();

    if(game.over){
      ctx.fillStyle="rgba(247,247,251,0.88)"; ctx.fillRect(0,0,W,H);
      ctx.fillStyle="#111827";
      doodleText("YOU GOT SUNK",W/2,H/2-10*DPR,34*DPR,"center");
      doodleText(`Final score: ${game.score}`,W/2,H/2+26*DPR,18*DPR,"center");
      doodleText("Press R to restart",W/2,H/2+56*DPR,16*DPR,"center");
    }
  }

  window.R={draw};
})();
