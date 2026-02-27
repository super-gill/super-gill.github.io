// render.js — draw world + UI + doodle models
(() => {
  'use strict';

    // Simple scenery to give lateral motion cues
  function drawKelp(x, yBase){
    const h = 40 + Math.sin(x*0.01 + now())*12;
    ctx.strokeStyle = 'rgba(17,24,39,0.10)';
    doodleLine(x, yBase, x + Math.sin(now()+x*0.02)*8, yBase - h, 2);
    doodleLine(x+6, yBase, x+6 + Math.sin(now()+x*0.02+1)*8, yBase - h*0.75, 2);
  }
  function drawRock(x, y){
    ctx.strokeStyle = 'rgba(17,24,39,0.10)';
    doodleCircle(x, y, 18 + (Math.sin(x*0.03)*4), 2);
    doodleLine(x-14, y+12, x+14, y+12, 2);
  }

  // Screen-space bubbles (do not move laterally) to make side-to-side motion obvious
  function drawScreenBubbles(W,H){
    const t = now();
    ctx.strokeStyle = 'rgba(17,24,39,0.06)';
    const cols = 10;
    for(let i=0;i<cols;i++){
      const sx = (i+0.5) * (W/cols);
      for(let k=0;k<3;k++){
        const phase = (i*1.7 + k*2.3);
        const y = H - ((t*55 + phase*90) % (H+80));
        const r = 3 + ((i+k)%3);
        doodleCircle(sx, y, r, 1);
      }
    }
  }

  window.drawPlayerTeardrop = (px, py)=>{
    ctx.strokeStyle = player.invuln>0 ? "rgba(17,24,39,0.45)" : "#111827";

    const L = player.r * 2.6;
    const Wd = player.r * 1.5;
    const noseX = px + L*0.55;
    const tailX = px - L*0.65;

    ctx.lineWidth = 3;
    ctx.beginPath();
    const pts = 18;

    for(let i=0;i<=pts;i++){
      const t = i/pts;
      const x = lerp(tailX, noseX, t);
      const bulge = Math.sin(t*Math.PI) * 0.95;
      const y = py - bulge*Wd*0.55 + jitter(0.7);
      if(i===0) ctx.moveTo(x + jitter(0.8), y);
      else ctx.lineTo(x + jitter(0.8), y);
    }
    for(let i=pts;i>=0;i--){
      const t = i/pts;
      const x = lerp(tailX, noseX, t);
      const bulge = Math.sin(t*Math.PI) * 0.95;
      const y = py + bulge*Wd*0.55 + jitter(0.7);
      ctx.lineTo(x + jitter(0.8), y);
    }
    ctx.closePath();
    ctx.stroke();

    // sail
    doodleLine(px - L*0.10, py - Wd*0.55, px + L*0.05, py - Wd*1.00, 3);
    doodleLine(px + L*0.05, py - Wd*1.00, px + L*0.22, py - Wd*0.45, 3);
    doodleLine(px + L*0.22, py - Wd*0.45, px - L*0.10, py - Wd*0.55, 3);

    // stern planes + rudder hint
    doodleLine(tailX + 10, py, tailX - 22, py - 10, 2);
    doodleLine(tailX + 10, py, tailX - 22, py + 10, 2);
    doodleLine(tailX - 6, py - 14, tailX - 6, py + 14, 2);

    // bow hint
    doodleLine(noseX - 8, py - 6, noseX + 10, py, 2);
    doodleLine(noseX - 8, py + 6, noseX + 10, py, 2);
  };

  window.drawFrame = ()=>{
    const W = canvas.width, H = canvas.height;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,W,H);

    ctx.fillStyle = "#f7f7fb";
    ctx.fillRect(0,0,W,H);
    drawScreenBubbles(W,H);
    // screen-space bubbles (helps show lateral movement)
    drawScreenBubbles(W,H);

    const drawWorld = (offsetX)=>{
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-offsetX, 0, world.w, world.seaLevel - cam.y);

      ctx.fillStyle = "#e9f1ff";
      ctx.fillRect(-offsetX, world.seaLevel - cam.y, world.w, world.ground - world.seaLevel);

      ctx.fillStyle = "#f2eadb";
      ctx.fillRect(-offsetX, world.ground - cam.y, world.w, world.h - world.ground);

      ctx.fillStyle = "rgba(17,24,39,0.04)";
      ctx.fillRect(-offsetX, world.layerY1 - cam.y, world.w, (world.layerY2-world.layerY1));

      ctx.strokeStyle = "#1f2937";
      doodleLine(-offsetX, world.seaLevel - cam.y, world.w - offsetX, world.seaLevel - cam.y, 3);
      doodleLine(-offsetX, world.ground - cam.y, world.w - offsetX, world.ground - cam.y, 3);

      // world scenery (kelp + rocks) anchored to world X so you can feel drift
      const startX = Math.floor(offsetX/360)*360;
      for(let sx=startX; sx<offsetX+canvas.width+360; sx+=360){
        const x = sx - offsetX;
        const gy = world.ground - cam.y;
        if(((sx/360)|0) % 2 === 0) drawKelp(x + 40, gy - 6);
        else drawRock(x + 60, gy - 10);
      }

      if(player.sonarPulse > 0){
        const t = 1 - (player.sonarPulse/1.25);
        const R = 40 + t*980;
        ctx.strokeStyle = `rgba(31,41,55,${0.34*(1-t)})`;
        doodleCircle(player.x - offsetX, player.y - cam.y, R, 3);
      }

      for(const c of contacts){
        const cx = c.x - offsetX;
        const cy = c.y - cam.y;
        const a = clamp(c.life/1.6, 0, 1);
        ctx.strokeStyle = `rgba(17,24,39,${0.22*a})`;
        doodleCircle(cx, cy, c.u*(0.35+0.25*(1-a)), 2);
        ctx.strokeStyle = `rgba(17,24,39,${0.16*a})`;
        const px = player.x - offsetX, py = player.y - cam.y;
        doodleLine(px, py, px + Math.cos(c.bearing)*220, py + Math.sin(c.bearing)*220, 2);
      }

      for(const d of decoys){
        const dx = d.x - offsetX;
        const dy = d.y - cam.y;
        const a = clamp(d.life/7.5, 0, 1);
        ctx.strokeStyle = d.kind==="flare" ? `rgba(17,24,39,${0.26*a})` : `rgba(17,24,39,${0.30*a})`;
        if(d.kind==="flare"){
          doodleCircle(dx, dy, d.r, 2);
          doodleLine(dx, dy, dx - d.vx*0.06, dy - d.vy*0.06, 2);
          doodleLine(dx-12, dy+10, dx+12, dy-10, 2);
          doodleLine(dx-12, dy-10, dx+12, dy+10, 2);
        } else {
          doodleCircle(dx, dy, d.r, 3);
          doodleText("ZZZ", dx, dy+6, 14*DPR, "center", true);
        }
      }

      for(const e of enemies){
        const ex = e.x - offsetX;
        const ey = e.y - cam.y;

        // Detection gating:
        // - Before detection: no silhouette at all (only bubbles elsewhere)
        // - After detection: show either live position (if seen/close) or a faded ghost at last known position
        const close = Math.hypot(wrapDx(player.x, e.x), ((e.hitY ?? e.y) - player.y)) < 190;
        const detected = (e.detectedT||0) > 0;
        const live = (e.seen>0) || close;

        const show = live;
        if(!(detected || live)) continue;

        let ex2 = ex, ey2 = ey;
        let alpha = 1.0;

        if(!live && detected){
          const gx = (e.lastX ?? e.x);
          const gy = (e.lastY ?? e.y);
          ex2 = gx - offsetX;
          ey2 = gy - cam.y;
          alpha = 0.22;
        }

        ctx.strokeStyle = (alpha>=1.0) ? "#111827" : `rgba(17,24,39,${alpha})`;

        if(e.type==="boat"){
          doodleLine(ex2-44, ey2+10, ex2+44, ey2+10, 3);
          doodleLine(ex2-36, ey2+10, ex2-18, ey2+24, 3);
          doodleLine(ex2+36, ey2+10, ex2+18, ey2+24, 3);
          doodleLine(ex2-18, ey2+24, ex2+18, ey2+24, 3);
          doodleLine(ex2, ey2-26, ex2, ey2+6, 3);
          doodleLine(ex2, ey2-26, ex2+28, ey2-10, 3);
        } else {
          doodleCircle(ex2, ey2, e.r, 3);
          doodleLine(ex2-e.r, ey2, ex2+e.r, ey2, 2);
          doodleLine(ex2+e.r-6, ey2, ex2+e.r+24, ey2-6, 3);
          doodleLine(ex2-10, ey2-e.r-8, ex2-10, ey2-e.r+8, 3);
          doodleLine(ex2-10, ey2-e.r-8, ex2+6, ey2-e.r-12, 3);
        }

        if((alpha>=1.0) && e.suspicion>0.65){
          ctx.fillStyle = "#111827";
          doodleText("!", ex2, ey2 - e.r - 36, 18*DPR, "center");
        }


        // Enemy active ping ring (reveals position)
        if(e.pingPulse && e.pingPulse > 0){
          const t = 1 - (e.pingPulse/1.2);
          const R = 22 + t*520;
          ctx.strokeStyle = `rgba(31,41,55,${0.20*(1-t)})`;
          doodleCircle(ex, ey, R, 2);
          ctx.strokeStyle = "#111827";
        }
        if(show){
          const w=60, h=8;
          const max = (e.type==="boat"?80:90);
          const f = clamp(e.hp/max, 0, 1);
          ctx.strokeStyle="#111827";
          ctx.fillStyle="rgba(255,255,255,0.75)";
          ctx.fillRect(ex2-w/2, ey2-e.r-26, w, h);
          ctx.strokeRect(ex2-w/2, ey2-e.r-26, w, h);
          ctx.fillStyle="rgba(17,24,39,0.85)";
          ctx.fillRect(ex2-w/2, ey2-e.r-26, w*f, h);
        }
      }

      // CIWS tracers
      for(const t of window.cwisTracers){
        const a = clamp(t.life/0.22, 0, 1);
        ctx.strokeStyle = `rgba(17,24,39,${0.32*a})`;
        const dxw = wrapDx(t.x1, t.x2);
        doodleLine(t.x1 - offsetX, t.y1 - cam.y, (t.x1 + dxw) - offsetX, t.y2 - cam.y, 2);
      }

      for(const b of bullets){
        const bx = b.x - offsetX;
        const by = b.y - cam.y;
        ctx.strokeStyle = b.friendly ? "#0f172a" : "rgba(15,23,42,0.55)";
        if(b.kind==="torpedo"){
          doodleLine(bx-10, by, bx+10, by, 3);
          doodleCircle(bx+8, by, 4, 2);
        } else if(b.kind==="depthCharge"){
          doodleCircle(bx, by, 7, 2);
          doodleLine(bx-6, by-6, bx+6, by+6, 2);
          doodleLine(bx-6, by+6, bx+6, by-6, 2);
        } else {
          doodleLine(bx-14, by+6, bx+14, by-6, 3);
          doodleLine(bx-10, by+10, bx+10, by-2, 2);
        }
      }

      for(const p of particles){
        const px = p.x - offsetX;
        const py = p.y - cam.y;
        const a = clamp(p.life/0.9, 0, 1);
        ctx.strokeStyle = p.watery ? `rgba(31,41,55,${0.22*a})` : `rgba(31,41,55,${0.32*a})`;
        doodleCircle(px, py, p.size*(0.6+0.7*(1-a)), 2);
      }

      const px = player.x - offsetX;
      const py = player.y - cam.y;
      drawPlayerTeardrop(px, py);

      // aim line
      ctx.strokeStyle = "rgba(17,24,39,0.18)";
      doodleLine(px, py, (input.aimWorldX - offsetX), (input.aimWorldY - cam.y), 2);
    };

    const offset1 = cam.x;
    drawWorld(offset1);
    if(cam.x + W > world.w) drawWorld(offset1 - world.w);
    else if(cam.x < 0) drawWorld(offset1 + world.w);

    // UI
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle = "#111827";

    doodleText("DOODLE SUB — COVERT v3", 18*DPR, 34*DPR, 22*DPR, "left");
    doodleText(`Score: ${score}`, 18*DPR, 58*DPR, 16*DPR, "left");

    // Debug: show enemy composition + a couple of contact stats
    const boats = enemies.filter(e=>e.type==='boat').length;
    const subs  = enemies.filter(e=>e.type==='sub').length;
    doodleText(`Enemies: ${enemies.length} (Boats: ${boats}, Subs: ${subs})`, 18*DPR, 78*DPR, 13*DPR, "left");


    const barX = 18*DPR, barY = 72*DPR, barW = 220*DPR, barH = 14*DPR;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = "#111827";
    ctx.strokeRect(barX, barY, barW, barH);
    ctx.fillStyle = "rgba(17,24,39,0.85)";
    ctx.fillRect(barX, barY, barW * (player.hp/100), barH);
    ctx.fillStyle = "#111827";
    doodleText(`HP ${player.hp|0}/100`, barX + barW + 10*DPR, barY + 12*DPR, 14*DPR, "left");

    const nX=18*DPR, nY=(barY+22*DPR), nW=220*DPR, nH=10*DPR;
    ctx.fillStyle="rgba(255,255,255,0.70)";
    ctx.fillRect(nX,nY,nW,nH);
    ctx.strokeStyle="#111827";
    ctx.strokeRect(nX,nY,nW,nH);
    ctx.fillStyle="rgba(17,24,39,0.75)";
    ctx.fillRect(nX,nY,nW*player.noise,nH);
    ctx.fillStyle="#111827";
    doodleText("Noise", nX + nW + 10*DPR, nY + 10*DPR, 14*DPR, "left");

    const torp = player.torpCd<=0 ? "READY" : player.torpCd.toFixed(2)+"s";
    const miss = player.missCd<=0 ? "READY" : player.missCd.toFixed(2)+"s";
    const sonar = player.sonarCd<=0 ? "READY" : player.sonarCd.toFixed(1)+"s";
    const cm = player.cmCd<=0 ? "READY" : player.cmCd.toFixed(1)+"s";
    doodleText(`Torpedo (LMB): ${torp}`, 18*DPR, (barY+54*DPR), 14*DPR, "left");
    doodleText(`Missile VLS (RMB): ${miss}`, 18*DPR, (barY+74*DPR), 14*DPR, "left");
    doodleText(`Active Ping (Space): ${sonar}`, 18*DPR, (barY+94*DPR), 14*DPR, "left");
    doodleText(`Countermeasure (Q): ${cm}`, 18*DPR, (barY+114*DPR), 14*DPR, "left");

    if(stealthMsg){
      ctx.fillStyle = "rgba(255,255,255,0.82)";
      const pad = 10*DPR;
      const bx = 18*DPR, by = (barY+134*DPR), bw = 450*DPR, bh = 26*DPR;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle="#111827";
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle="#111827";
      doodleText(stealthMsg, bx+pad, by+18*DPR, 14*DPR, "left");
    }

    if(gameOver){
      ctx.fillStyle = "rgba(247,247,251,0.88)";
      ctx.fillRect(0,0,W,H);
      ctx.fillStyle = "#111827";
      doodleText("YOU GOT SUNK", W/2, H/2 - 10*DPR, 34*DPR, "center");
      doodleText(`Final score: ${score}`, W/2, H/2 + 26*DPR, 18*DPR, "center");
      doodleText("Press R to restart", W/2, H/2 + 56*DPR, 16*DPR, "center");
    }
  };
})();
