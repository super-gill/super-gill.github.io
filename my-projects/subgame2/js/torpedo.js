// torpedo.js — torpedo flight, seeker, and homing logic
// One function: TORP.update(torp, dt)
// Wire guidance is handled externally — wire just writes torp.targetBrg each tick.
// Seeker overwrites targetBrg when it has a lock. That's the whole priority system.

(()=>{
  const G=()=>window.G;
  const C=()=>window.CONFIG;
  const {clamp,lerp,angleNorm}=window.M;
  const {wrapDx}=window.AI;

  // ── Seeker ──────────────────────────────────────────────────────────────────
  // Pure geometry — no signal thresholds, no fudge factors.
  // If an enemy is within range AND within the cone angle AND within depth window: lock it.
  function seekerScan(torp){
    const cfg=C().torpedo;
    const enemies=G().enemies;
    const decoys=G().decoys;
    const player=G().player;

    const torpAng=Math.atan2(torp.vy, torp.vx);

    // FOV: wide passive search when hunting, narrow active cone when locked
    const fov  = torp.target ? (torp.seekFOV??cfg.seekFOV) : (cfg.passiveFOV??2.4);
    const range= torp.seekRange ?? cfg.seekRange;

    // Depth window: use config value. Active seeker (locked) is tighter — the
    // narrow active cone naturally constrains vertical geometry. Passive search
    // uses full vertWindow. Layer crossing degrades passive acquisition range.
    const depthWin = torp.target
      ? (cfg.vertWindow??120) * 0.6   // active: ±72m — locked seeker is precise
      : (cfg.vertWindow??120);         // passive: ±120m — wide search arc

    const candidates = torp.friendly ? enemies : [player];

    let best=null, bestDist=Infinity;
    for(const t of candidates){
      if(!t || (t.dead??false)) continue;
      const tx=t.wx??t.x, ty=t.wy??t.y;
      const dx=wrapDx(torp.x, tx);
      const dy=ty - torp.y;
      const dist=Math.hypot(dx,dy);
      // Layer crossing degrades passive seeker range (target in different depth band)
      const layerMult = (!torp.target && window.AI)
        ? window.AI.layerPenalty(torp.depth??200, t.depth??200)
        : 1.0;
      if(dist > range * layerMult) continue;
      if(Math.abs((torp.depth??200)-(t.depth??200)) > depthWin) continue;
      const angTo=Math.atan2(dy,dx);
      const dAng=Math.abs(angleNorm(angTo-torpAng));
      if(dAng > fov) continue;
      // Prefer closest target in cone
      if(dist < bestDist){ bestDist=dist; best=t; }
    }

    // Decoy seduction — can compete even post-lock if decoy is louder than target.
    // A silent target running quiet can be out-competed by a noisemaker.
    // A sprinting noisy target overwhelms the decoy — can't break lock that way.
    if(!torp.seducedBy){
      const seduceRange=cfg.seduceRange??300;
      const seduceFOV  =cfg.seduceFOV??2.8;
      for(const d of decoys){
        if(d.kind!=='noisemaker' || d.life<=0) continue;
        if(torp.friendly && d.friendly) continue;
        if(!torp.friendly && !d.friendly) continue;
        const dx=wrapDx(torp.x, d.x);
        const dy=d.y-torp.y;
        if(Math.hypot(dx,dy)>seduceRange) continue;
        const angTo=Math.atan2(dy,dx);
        if(Math.abs(angleNorm(angTo-torpAng)) > seduceFOV/2) continue;

        // If already locked on a real target, decoy must out-compete acoustically.
        // Decoy signature vs target noise (player.noise or enemy equivalent).
        if(best){
          const targetNoise = torp.friendly
            ? (best.noise??0.3)        // enemy sub noise
            : (G().player.noise??0.2); // player noise
          const decoySig = d.signature??1.0;
          // Decoy wins if it's louder than the target's self-noise.
          // Formula: 1 - (noise * 3 / decoySig) — maps noise onto decoy scale.
          // Silent (noise~0.07) → 84% chance. Sprinting (noise~0.40) → 14%.
          // Encourages players to go quiet BEFORE deploying countermeasures.
          const seduceChance = clamp(1.0 - (targetNoise * 3.0) / decoySig, 0, 1);
          if(Math.random() > seduceChance) continue; // decoy fails to compete
        }

        torp.seducedBy=d;
        torp.seduceT=cfg.seduceTime??7.0;
        torp.target=null;
        best=null; // clear lock
        if(!torp.friendly){
          const g=G();
          g.setMsg('CM SEDUCED TORPEDO!', 2.0);
          g.addLog('SONAR','Torpedo seduced — chasing countermeasure');
        } else {
          G().addLog('WEPS',`${torp.torpId} seduced — chasing decoy`);
        }
        break;
      }
    }

    return best;
  }

  // ── Main update ─────────────────────────────────────────────────────────────
  function update(torp, dt){
    const cfg=C().torpedo;
    const world=G().world;
    const player=G().player;

    // ── 1. Advance traveled distance ─────────────────────────────────────────
    const spd=Math.hypot(torp.vx,torp.vy);
    torp.traveled=(torp.traveled||0)+spd*dt;
    torp.arming=Math.max(0,(torp.arming||0)-dt);
    const armed=torp.traveled>=(torp.enableDist||cfg.enableDist||300);

    // ── 2. Seeker ─────────────────────────────────────────────────────────────
    // Seduction timer tick
    if(torp.seducedBy){
      torp.seduceT=(torp.seduceT||0)-dt;
      if(torp.seduceT<=0 || torp.seducedBy.life<=0){
        torp.seducedBy=null; torp.target=null;
      }
    }

    if(armed && !torp.seducedBy){
      const found=seekerScan(torp);
      if(found){
        if(found !== torp.target && torp.friendly){
          G().addLog('WEPS',`${torp.torpId} locked`);
        }
        torp.target=found;
      }
    }

    // Lost target validity check — remove if dead or gone
    if(torp.target){
      const dead=torp.target.dead??false;
      const gone=torp.target!==player && !G().enemies.includes(torp.target);
      if(dead||gone) torp.target=null;
    }

    // ── 3. targetBrg — the single steering command ───────────────────────────
    // Priority: seducedBy > locked target > wire (already written) > hold
    if(torp.seducedBy){
      const dx=wrapDx(torp.x, torp.seducedBy.x);
      const dy=torp.seducedBy.y - torp.y;
      torp.targetBrg=Math.atan2(dy,dx);
    } else if(torp.target){
      // Homing: point at where target will be (simple one-step lead angle)
      const tx=torp.target.wx??torp.target.x;
      const ty=torp.target.wy??torp.target.y;
      let tvx=torp.target.vx??0, tvy=torp.target.vy??0;
      if(torp.target===player){
        tvx=Math.cos(player.heading)*player.speed;
        tvy=Math.sin(player.heading)*player.speed;
      }
      const dx=wrapDx(torp.x,tx), dy=ty-torp.y;
      const dist=Math.hypot(dx,dy);
      const tof=dist/Math.max(spd,1);
      const ex=tx+tvx*tof, ey=ty+tvy*tof;
      torp.targetBrg=Math.atan2(ey-torp.y, wrapDx(torp.x,ex));
      // When homing, wire no longer writes targetBrg — seeker owns it
    }
    // If wire is live and no target/seduction: wire has already written targetBrg this tick.
    // If no wire and no target: targetBrg holds its last value (fly straight).

    // ── 4. Steering — turn toward targetBrg ──────────────────────────────────
    if(armed && torp.targetBrg != null){
      const cur=Math.atan2(torp.vy,torp.vx);
      let dAng=angleNorm(torp.targetBrg - cur);
      const maxTurn=(torp.turnRate??cfg.turnRate)*dt;
      dAng=clamp(dAng,-maxTurn,maxTurn);
      const newAng=cur+dAng;
      const s=Math.hypot(torp.vx,torp.vy);
      torp.vx=Math.cos(newAng)*s;
      torp.vy=Math.sin(newAng)*s;
    }
    // Pre-arm: hold launch direction exactly (no steering at all)
    if(!armed){
      const ang=Math.atan2(torp.vy,torp.vx);
      const s=Math.hypot(torp.vx,torp.vy);
      torp.vx=Math.cos(ang)*s; torp.vy=Math.sin(ang)*s;
    }

    // ── 5. Speed — approach while searching, sprint when homing ──────────────
    const targetSpd=(torp.target||torp.seducedBy)
      ? (torp.speed??cfg.speed)
      : (torp.approachSpeed??cfg.approachSpeed??15);
    const ns=lerp(spd, targetSpd, 0.06);
    const ang=Math.atan2(torp.vy,torp.vx);
    torp.vx=Math.cos(ang)*ns;
    torp.vy=Math.sin(ang)*ns;

    // ── 6. Depth steering ─────────────────────────────────────────────────────
    {
      const depthRate=cfg.depthRate||12;
      if(torp.target && !torp.seducedBy){
        torp.depthOrder=torp.target.depth??200;
      }
      const depthErr=(torp.depthOrder??torp.depth??200)-(torp.depth??0);
      const dv=clamp(depthErr*0.8,-depthRate,depthRate);
      torp.vDepth=lerp(torp.vDepth||0, dv, 0.15);
      torp.depth=clamp((torp.depth||0)+torp.vDepth*dt, 10, world.ground-20);
    }

    // ── 7. Position ───────────────────────────────────────────────────────────
    torp.x=(torp.x+torp.vx*dt+world.w)%world.w;
    torp.y=(torp.y+torp.vy*dt+world.h)%world.h;

    // ── 8. Collision ──────────────────────────────────────────────────────────
    const vertFuse=cfg.vertFuse||60;
    if(torp.life>0 && torp.arming<=0){
      if(torp.friendly){
        for(const e of G().enemies){
          if(e.dead) continue;
          const dz=Math.abs((torp.depth??0)-(e.depth??200));
          if(dz>vertFuse) continue;
          const dx=wrapDx(torp.x,e.x), dy=e.y-torp.y;
          if(Math.hypot(dx,dy)<(e.hitR||e.r||18)+torp.r){
            G().damageEnemy(e,torp.dmg); torp.life=0; break;
          }
        }
      } else {
        const dz=Math.abs((torp.depth??0)-player.depth);
        if(dz<vertFuse){
          const dx=wrapDx(torp.x,player.wx), dy=player.wy-torp.y;
          if(Math.hypot(dx,dy)<(C().player.hitR??30)+torp.r){
            G().damagePlayer(24, torp.x, torp.y); torp.life=0;
          }
        }
      }
    }
  }

  window.TORP={ update };
})();
