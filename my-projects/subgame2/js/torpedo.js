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
    const fov  = torp.target ? (torp.seekFOV??cfg.seekFOV) : (torp.passiveFOV??cfg.passiveFOV??2.4);
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

    // Decoy seduction — single roll per decoy-torpedo encounter.
    // Each decoy gets ONE chance to seduce each torpedo when it first enters
    // range/FOV. Going quiet before deploying improves odds significantly.
    // After seduction ends, a reacquisition delay gives the target time to escape.
    if(!torp.seducedBy){
      if(!torp._testedDecoys) torp._testedDecoys=[];
      const seduceRange=torp.seduceRange??cfg.seduceRange??300;
      const seduceFOV  =torp.seduceFOV??cfg.seduceFOV??2.8;
      for(const d of decoys){
        if(d.kind!=='noisemaker' || d.life<=0) continue;
        if(torp.friendly && d.friendly) continue;
        if(!torp.friendly && !d.friendly) continue;
        if(torp._testedDecoys.includes(d.id)) continue; // already rolled
        const dx=wrapDx(torp.x, d.x);
        const dy=d.y-torp.y;
        if(Math.hypot(dx,dy)>seduceRange) continue;
        const angTo=Math.atan2(dy,dx);
        if(Math.abs(angleNorm(angTo-torpAng)) > seduceFOV/2) continue;

        // First encounter with this decoy — single roll.
        torp._testedDecoys.push(d.id);

        // If locked on a real target, decoy must out-compete acoustically.
        if(best){
          const targetNoise = torp.friendly
            ? (best.noise??0.3)        // enemy sub noise
            : (G().player.noise??0.2); // player noise
          const decoySig = d.signature??1.0;
          // Quiet (noise~0.07) → 90%. Normal (~0.25) → 64%. Sprint (~0.40) → 43%.
          // 15% floor: even a noisy deployment has some chance.
          const seduceChance = clamp(1.0 - (targetNoise * 2.0) / decoySig, 0.15, 1);
          if(Math.random() > seduceChance) continue; // decoy fails to compete
        }

        torp.seducedBy=d;
        torp.seduceT=torp.seduceTime??cfg.seduceTime??7.0;
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

  // ── Search pattern — counter-CM hook + snake ────────────────────────────────
  // Activated when torpedo has no target, no wire, and no seduction.
  //
  // Two entry paths:
  //   Post-CM (seduction just ended): hook maneuver — break 45° away from CM
  //     noise cloud, then 125° back to cross original track, then snake.
  //   Wire-cut / passive loss: immediate snake along last steered heading.
  //
  // Phases: 'break' → 'hook' → 'snake'   (post-CM)
  //         'snake'                        (wire-cut)
  function searchPattern(torp, dt, cfg){
    const PI=Math.PI;
    const curAng=Math.atan2(torp.vy, torp.vx);

    // ── Circle/spiral datum search (ASROC-deployed torpedoes) ─────────────────
    // Starts as a tight circle then gradually expands into a wider spiral.
    // Turn rate fraction decreases from 100% → 12% over the torpedo's run time,
    // so radius grows from ~19wu (190m) to ~160wu (1600m). Never falls back to snake.
    if(torp._circleSearch){
      if(!torp._search){
        torp._search={circleDir:(Math.random()<0.5)?1:-1, phaseT:0};
      }
      const S=torp._search;
      S.phaseT+=dt;
      const maxTurn=(torp.turnRate??cfg.turnRate)*dt;
      // Fraction: 1.0 at launch → 0.12 at 90s, giving an ever-widening spiral
      const fraction=Math.max(0.12, 1.0 - S.phaseT/100);
      torp.targetBrg=curAng + S.circleDir * maxTurn * fraction;
      return;
    }
    const snakeAmp=cfg.searchSnake||0.18; // radians half-amplitude
    const snakePeriod=4.0;               // seconds per half-cycle

    if(!torp._search){
      // First tick without target — initialise search
      const postCM=torp._postCM||false;
      torp._postCM=false;
      if(postCM){
        // Hook maneuver: break away from CM noise, then hook back across original track
        // Pick a random side to break toward
        const side=(Math.random()<0.5)?1:-1;
        torp._search={
          phase:'break',
          side,
          baseAng:curAng,             // heading when CM lost
          breakAng:curAng+side*(45*PI/180),  // 45° away
          hookAng:curAng+side*(45*PI/180) - side*(125*PI/180), // 125° back = net 80° toward original track
          phaseT:0,
          breakDur:2.5,               // seconds to hold break turn
          hookDur:3.5,                // seconds to hold hook turn
          snakeT:0,
          snakeDir:1,
        };
      } else {
        // Wire-cut or passive loss — snake immediately along last heading
        torp._search={
          phase:'snake',
          baseAng:curAng,
          snakeT:0,
          snakeDir:(Math.random()<0.5)?1:-1,
        };
      }
    }

    const S=torp._search;
    S.phaseT=(S.phaseT||0)+dt;

    if(S.phase==='break'){
      // Turn 45° away from CM cloud
      torp.targetBrg=S.breakAng;
      if(S.phaseT>=S.breakDur){
        S.phase='hook';
        S.phaseT=0;
      }
    } else if(S.phase==='hook'){
      // Turn 125° back to cross the original target track
      torp.targetBrg=S.hookAng;
      if(S.phaseT>=S.hookDur){
        S.phase='snake';
        S.baseAng=S.hookAng; // snake along the hooked heading
        S.snakeT=0;
        S.snakeDir=1;
        S.phaseT=0;
      }
    } else {
      // Snake — S-pattern weave along base heading
      S.snakeT=(S.snakeT||0)+dt;
      const cycle=S.snakeT/snakePeriod;
      const offset=Math.sin(cycle*PI*2)*snakeAmp;
      torp.targetBrg=S.baseAng+offset;
    }
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
        // Post-seduction confusion — seeker needs time to reacquire
        torp._reacquireCd=torp.reacquireDelay??cfg.reacquireDelay??3.0;
        // Flag for search pattern — triggers hook maneuver instead of straight snake
        torp._postCM=true;
        torp._search=null; // reset any existing search state
      }
    }

    // Reacquisition cooldown after seduction ends
    if(torp._reacquireCd>0) torp._reacquireCd-=dt;

    // Ping dazzle — active sonar pulse temporarily blinds seeker
    if(torp._dazzleT>0){
      torp._dazzleT-=dt;
      if(torp._dazzleT<=0) torp._wasDazzled=false; // reset for next dazzle
    }

    if(armed && !torp.seducedBy && (torp._reacquireCd||0)<=0 && (torp._dazzleT||0)<=0){
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
    // Priority: seducedBy > locked target > wire (already written) > search pattern > hold
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
      // Clear any active search state — we have a lock
      torp._search=null;
    } else if(armed && !(torp.wire?.live)){
      // No target, no seduction, no wire — run search pattern
      // This replaces the old "fly straight on last heading" behaviour.
      searchPattern(torp, dt, cfg);
    }
    // If wire is live and no target/seduction: wire has already written targetBrg this tick.

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
    torp.x=torp.x+torp.vx*dt;
    torp.y=torp.y+torp.vy*dt;

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
            G().damageEnemy(e,torp.dmg); torp._hit=true; torp.life=0; break;
          }
        }
      } else {
        const dz=Math.abs((torp.depth??0)-player.depth);
        if(dz<vertFuse){
          const dx=wrapDx(torp.x,player.wx), dy=player.wy-torp.y;
          if(Math.hypot(dx,dy)<(C().player.hitR??30)+torp.r){
            G().damagePlayer(24, torp.x, torp.y); torp._hit=true; torp.life=0;
          }
        }
      }
    }
  }

  window.TORP={ update };
})();
