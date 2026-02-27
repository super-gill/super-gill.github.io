(() => {
  'use strict';

  const C = window.CONFIG;
  const { TAU, clamp, lerp, now, jitter, angleNorm } = window.M;
  const { ctx, canvas, DPR, world, cam, bullets, particles, enemies, decoys, contacts, cwisTracers, player, game } = window.G;
  const AI = window.AI;

  // Doodle primitives
  function doodleLine(x1,y1,x2,y2,w=2){
    const steps = Math.max(6, Math.floor(Math.hypot(x2-x1,y2-y1)/18));
    ctx.lineWidth = w;
    ctx.beginPath();
    for(let i=0;i<=steps;i++){
      const t=i/steps;
      const x = x1 + (x2-x1)*t + Math.sin(t*6.28)*jitter(1.2);
      const y = y1 + (y2-y1)*t + Math.cos(t*6.28)*jitter(1.2);
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
  function doodleCircle(x,y,r,w=2){
    ctx.lineWidth = w;
    ctx.beginPath();
    const k = 18;
    for(let i=0;i<=k;i++){
      const a = (i/k)*TAU;
      const rr = r + Math.sin(a*3)*jitter(0.8);
      const px = x + Math.cos(a)*rr;
      const py = y + Math.sin(a)*rr;
      if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
    }
    ctx.stroke();
  }
  function doodleText(txt,x,y,size=16,align="left", wobble=false){
    ctx.font = `${size}px ui-rounded, system-ui, -apple-system, Segoe UI, Arial`;
    ctx.textAlign = align;
    if(wobble) ctx.fillText(txt, x + jitter(0.5), y + jitter(0.5));
    else ctx.fillText(txt, x, y);
  }

  // Screen-space bubbles (no lateral movement) for motion cue
  function drawScreenBubbles(W,H){
    if(!C.visuals.screenBubbles) return;
    const t = now();
    ctx.strokeStyle = 'rgba(17,24,39,0.07)';
    const cols = C.visuals.screenBubbleCols|0;
    for(let i=0;i<cols;i++){
      const sx = (i+0.5) * (W/cols);
      for(let k=0;k<3;k++){
        const phase = i*1.7 + k*2.9;
        const y = H - ((t*70 + phase*80) % (H+120));
        const r = 2.5 + ((i+k)%3);
        doodleCircle(sx, y, r, 1);
      }
    }
  }

  // Simple scenery anchored to world x (kelp/rocks) to sell drift
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

  function drawPlayerTeardropLocal(r){
    // Draw centered at (0,0) with nose pointing +X
    const L = r * 2.6;
    const Wd = r * 1.5;
    const noseX = L*0.55;
    const tailX = -L*0.65;

    ctx.lineWidth = 3;
    ctx.beginPath();
    const topPts = 18;
    for(let i=0;i<=topPts;i++){
      const t = i/topPts;
      const x = lerp(tailX, noseX, t);
      const bulge = Math.sin(t*Math.PI) * 0.95;
      const y = -bulge*Wd*0.55 + jitter(0.7);
      if(i===0) ctx.moveTo(x + jitter(0.8), y);
      else ctx.lineTo(x + jitter(0.8), y);
    }
    for(let i=topPts;i>=0;i--){
      const t = i/topPts;
      const x = lerp(tailX, noseX, t);
      const bulge = Math.sin(t*Math.PI) * 0.95;
      const y = +bulge*Wd*0.55 + jitter(0.7);
      ctx.lineTo(x + jitter(0.8), y);
    }
    ctx.closePath();
    ctx.stroke();

    // sail
    doodleLine(-L*0.10, -Wd*0.55,  L*0.05, -Wd*1.00, 3);
    doodleLine( L*0.05, -Wd*1.00,  L*0.22, -Wd*0.45, 3);
    doodleLine( L*0.22, -Wd*0.45, -L*0.10, -Wd*0.55, 3);

    // stern planes
    doodleLine(tailX + 10, 0, tailX - 22, -10, 2);
    doodleLine(tailX + 10, 0, tailX - 22, +10, 2);
    doodleLine(tailX - 6, -14, tailX - 6, +14, 2);

    // bow hint
    doodleLine(noseX - 8, -6, noseX + 10, 0, 2);
    doodleLine(noseX - 8, +6, noseX + 10, 0, 2);
  }

  function drawPlayerTeardrop(px, py){
    // Sub stays level (no pitch). Facing is conceptually +X for now.
    ctx.save();
    ctx.translate(px, py);
    drawPlayerTeardropLocal(player.r);
    ctx.restore();
  }

  function draw(){
    const W = canvas.width, H = canvas.height;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,W,H);

    ctx.fillStyle = "#f7f7fb";
    ctx.fillRect(0,0,W,H);

    drawScreenBubbles(W,H);

    function drawWorld(offsetX){
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

      // seabed scenery
      const startX = Math.floor(offsetX/360)*360;
      for(let sx=startX; sx<offsetX+canvas.width+360; sx+=360){
        const x = sx - offsetX;
        const gy = world.ground - cam.y;
        if(((sx/360)|0) % 2 === 0) drawKelp(x + 40, gy - 6);
        else drawRock(x + 60, gy - 10);
      }

      // player sonar pulse ring
      if(player.sonarPulse > 0){
        const t = 1 - (player.sonarPulse/C.player.sonarPulse);
        const R = 40 + t*980;
        ctx.strokeStyle = `rgba(31,41,55,${0.34*(1-t)})`;
        doodleCircle(player.x - offsetX, player.y - cam.y, R, 3);
      }

      // contact blobs
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

      // decoys
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
          doodleText("ZZZ", dx, dy+6, 14*DPR, "center", false);
        }
      }

      // CIWS tracers
      for(const t of cwisTracers){
        const a = clamp(t.life/0.22, 0, 1);
        ctx.strokeStyle = `rgba(17,24,39,${0.32*a})`;
        const dxw = AI.wrapDx(t.x1, t.x2);
        doodleLine(t.x1 - offsetX, t.y1 - cam.y, (t.x1 + dxw) - offsetX, t.y2 - cam.y, 2);
      }

      // enemies: before detected => invisible (only blobs). After detected => ghost or live.
      for(const e of enemies){
        const close = Math.hypot(AI.wrapDx(player.x, e.x), ((e.hitY ?? e.y) - player.y)) < 190;
        const detected = (e.detectedT||0) > 0;
        const live = (e.seen>0) || close;
        if(!(detected || live)) continue;

        let gx = e.x, gy = e.y, alpha = 1.0;
        if(!live && detected){
          gx = (e.lastX ?? e.x);
          gy = (e.lastY ?? e.y);
          alpha = 0.22;
        }

        const ex = gx - offsetX;
        const ey = gy - cam.y;

        ctx.strokeStyle = (alpha>=1.0) ? "#111827" : `rgba(17,24,39,${alpha})`;

        if(e.type==="boat"){
          doodleLine(ex-44, ey+10, ex+44, ey+10, 3);
          doodleLine(ex-36, ey+10, ex-18, ey+24, 3);
          doodleLine(ex+36, ey+10, ex+18, ey+24, 3);
          doodleLine(ex-18, ey+24, ex+18, ey+24, 3);
          doodleLine(ex, ey-26, ex, ey+6, 3);
          doodleLine(ex, ey-26, ex+28, ey-10, 3);
        } else {
          doodleCircle(ex, ey, e.r, 3);
          doodleLine(ex-e.r, ey, ex+e.r, ey, 2);
          doodleLine(ex+e.r-6, ey, ex+e.r+24, ey-6, 3);
          doodleLine(ex-10, ey-e.r-8, ex-10, ey-e.r+8, 3);
          doodleLine(ex-10, ey-e.r-8, ex+6, ey-e.r-12, 3);
        }

        // enemy ping ring (reveals position)
        if(e.pingPulse && e.pingPulse > 0){
          const t = 1 - (e.pingPulse/1.2);
          const R = 22 + t*520;
          ctx.strokeStyle = `rgba(31,41,55,${0.20*(1-t)})`;
          doodleCircle(ex, ey, R, 2);
          ctx.strokeStyle = (alpha>=1.0) ? "#111827" : `rgba(17,24,39,${alpha})`;
        }

        // suspicion marker only when live
        if(live && e.suspicion > 0.65){
          ctx.fillStyle = "#111827";
          doodleText("!", ex, ey - e.r - 36, 18*DPR, "center", false);
        }

        if(live){
          const w=60, h=8;
          const max = (e.type==="boat"?80:90);
          const f = clamp(e.hp/max, 0, 1);
          ctx.strokeStyle="#111827";
          ctx.fillStyle="rgba(255,255,255,0.75)";
          ctx.fillRect(ex-w/2, ey-e.r-26, w, h);
          ctx.strokeRect(ex-w/2, ey-e.r-26, w, h);
          ctx.fillStyle="rgba(17,24,39,0.85)";
          ctx.fillRect(ex-w/2, ey-e.r-26, w*f, h);
        }
      }

      // bullets
      for(const b of bullets){
        const bx = b.x - offsetX;
        const by = b.y - cam.y;
        ctx.strokeStyle = b.friendly ? "#0f172a" : "rgba(15,23,42,0.55)";
        if(b.kind==="torpedo"){
          doodleLine(bx-10, by, bx+10, by, 3);
          doodleCircle(bx+8, by, 4, 2);
        } else if(b.kind==="depthCharge"){
          doodleCircle(bx, by, 6, 2);
          doodleLine(bx-6, by-2, bx+6, by+2, 2);
        } else {
          doodleLine(bx-14, by+6, bx+14, by-6, 3);
          doodleLine(bx-10, by+10, bx+10, by-2, 2);
        }
      }

      // particles
      for(const p of particles){
        const px = p.x - offsetX;
        const py = p.y - cam.y;
        const a = clamp(p.life/0.9, 0, 1);
        ctx.strokeStyle = p.watery ? `rgba(31,41,55,${0.22*a})` : `rgba(31,41,55,${0.32*a})`;
        doodleCircle(px, py, p.size*(0.6+0.7*(1-a)), 2);
      }

      // player
      const px = player.x - offsetX;
      const py = player.y - cam.y;
      ctx.strokeStyle = (player.invuln>0) ? "rgba(17,24,39,0.45)" : "#111827";
      drawPlayerTeardrop(px,py);

      // aim line
      ctx.strokeStyle = "rgba(17,24,39,0.18)";
      // wrap-aware aim line
      const aimX = (cam.x + window.I.mouseX);
      const aimY = (cam.y + window.I.mouseY);
      doodleLine(px, py, (aimX - offsetX), (aimY - cam.y), 2);
    }

    const offset1 = cam.x;
    drawWorld(offset1);
    if(cam.x + W > world.w) drawWorld(offset1 - world.w);
    else if(cam.x < 0) drawWorld(offset1 + world.w);

    // UI
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle = "#111827";

    doodleText("DOODLE SUB — COVERT v4", 18*DPR, 34*DPR, 22*DPR, "left", C.visuals.textWobble);
    doodleText(`Score: ${game.score}`, 18*DPR, 58*DPR, 16*DPR, "left", C.visuals.textWobble);

    const barX = 18*DPR, barY = 72*DPR, barW = 220*DPR, barH = 14*DPR;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = "#111827";
    ctx.strokeRect(barX, barY, barW, barH);
    ctx.fillStyle = "rgba(17,24,39,0.85)";
    ctx.fillRect(barX, barY, barW * (player.hp/C.player.hpMax), barH);
    ctx.fillStyle = "#111827";
    doodleText(`HP ${player.hp|0}/${C.player.hpMax}`, barX + barW + 10*DPR, barY + 12*DPR, 14*DPR, "left", C.visuals.textWobble);

    const nX=18*DPR, nY=(barY+22*DPR), nW=220*DPR, nH=10*DPR;
    ctx.fillStyle="rgba(255,255,255,0.70)";
    ctx.fillRect(nX,nY,nW,nH);
    ctx.strokeStyle="#111827";
    ctx.strokeRect(nX,nY,nW,nH);
    ctx.fillStyle="rgba(17,24,39,0.75)";
    ctx.fillRect(nX,nY,nW*player.noise,nH);
    ctx.fillStyle="#111827";
    doodleText("Noise", nX + nW + 10*DPR, nY + 10*DPR, 14*DPR, "left", C.visuals.textWobble);

    const torp = player.torpCd<=0 ? "READY" : player.torpCd.toFixed(2)+"s";
    const miss = player.missCd<=0 ? "READY" : player.missCd.toFixed(2)+"s";
    const sonar = player.sonarCd<=0 ? "READY" : player.sonarCd.toFixed(1)+"s";
    const cm = player.cmCd<=0 ? "READY" : player.cmCd.toFixed(1)+"s";
    doodleText(`Torpedo (LMB): ${torp}`, 18*DPR, (barY+54*DPR), 14*DPR, "left", C.visuals.textWobble);
    doodleText(`Missile VLS (RMB): ${miss}`, 18*DPR, (barY+74*DPR), 14*DPR, "left", C.visuals.textWobble);
    doodleText(`Active Ping (Space): ${sonar}`, 18*DPR, (barY+94*DPR), 14*DPR, "left", C.visuals.textWobble);
    doodleText(`Countermeasure (Q): ${cm}`, 18*DPR, (barY+114*DPR), 14*DPR, "left", C.visuals.textWobble);

    if(game.msg){
      ctx.fillStyle = "rgba(255,255,255,0.82)";
      const pad = 10*DPR;
      const bx = 18*DPR, by = (barY+134*DPR), bw = 450*DPR, bh = 26*DPR;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle="#111827";
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle="#111827";
      doodleText(game.msg, bx+pad, by+18*DPR, 14*DPR, "left", C.visuals.textWobble);
    }

    if(game.over){
      ctx.fillStyle = "rgba(247,247,251,0.88)";
      ctx.fillRect(0,0,W,H);
      ctx.fillStyle = "#111827";
      doodleText("YOU GOT SUNK", W/2, H/2 - 10*DPR, 34*DPR, "center", false);
      doodleText(`Final score: ${game.score}`, W/2, H/2 + 26*DPR, 18*DPR, "center", false);
      doodleText("Press R to restart", W/2, H/2 + 56*DPR, 16*DPR, "center", false);
    }
  }

  window.R = { draw };
})();
