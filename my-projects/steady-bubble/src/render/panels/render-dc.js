// render-dc.js — drawDamagePanel (compact damage control overlay)
'use strict';

import { clamp, player, session, ui, L, C } from './panel-context.js';

    export function drawDamagePanel(W,H,panelH){
    const ctx = L.ctx;
    const {U} = L.R;
    const DMG=L.DMG;
    const PNL=L.PANEL;
    if(!ui.showDmgPanel||ui.showDamageScreen) return;
    const dmg=player.damage;
    if(!dmg) return;

    const OW=U(620), OH=U(480);
    const OX=Math.round(W/2-OW/2), OY=Math.round(H/2-OH/2);
    const P=U(10);

    ctx.fillStyle='rgba(8,14,26,0.97)';
    ctx.strokeStyle='rgba(80,110,160,0.35)';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.roundRect(OX,OY,OW,OH,U(6)); ctx.fill(); ctx.stroke();

    // Title
    let cy=OY+P+U(10);
    ctx.fillStyle='rgba(160,190,240,0.90)';
    ctx.font=`bold ${U(13)}px ui-monospace,monospace`;
    ctx.textAlign='left';
    ctx.fillText('DMG CTRL',OX+P,cy);
    ctx.fillStyle='rgba(120,140,180,0.50)';
    ctx.font=`${U(8)}px ui-monospace,monospace`;
    ctx.textAlign='right';
    ctx.fillText('[H] close  [J] DMG LOG',OX+OW-P,cy);

    // Crew summary — watchkeepers on watch + full ship totals
    cy+=U(16);
    const fit=DMG.totalFit(),wnd=DMG.totalWounded(),kia=DMG.totalKilled(),total=DMG.totalCrew();
    const aw2=session.activeWatch||'A';
    let wkOnFit=0,wkOnWnd=0,wkOnTotal=0;
    for(const comp of DMG.COMPS){
      const cc2=(dmg.crew[comp]||[]).filter(c=>(c.watch===aw2||c.watch==='duty')&&c.dept!=='medical'&&c.dept!=='supply');
      wkOnFit  +=cc2.filter(c=>c.status==='fit'&&!c.displaced).length;
      wkOnWnd  +=cc2.filter(c=>c.status==='wounded').length;
      wkOnTotal+=cc2.filter(c=>c.status!=='killed').length;
    }
    ctx.fillStyle='rgba(160,185,230,0.70)';
    ctx.font=`${U(10)}px ui-monospace,monospace`;
    ctx.textAlign='left';
    ctx.fillText(`WCH ${aw2}  ${wkOnFit} FIT  ${wkOnWnd} WND  /  ${wkOnTotal} ON WATCH`,OX+P,cy);
    ctx.fillStyle='rgba(110,130,170,0.50)';
    ctx.font=`${U(9)}px ui-monospace,monospace`;
    ctx.textAlign='right';
    ctx.fillText(`SHIP  ${fit} FIT  ${wnd} WND  ${kia} KIA  / ${total}`,OX+OW-P,cy);

    // Tower status
    cy+=U(14);
    const twrCol={nominal:'rgba(22,163,74,0.75)',damaged:'rgba(217,119,6,0.80)',destroyed:'rgba(180,30,30,0.80)'};
    ctx.font=`${U(10)}px ui-monospace,monospace`;
    ctx.textAlign='left';
    ctx.fillStyle=twrCol[dmg.towers.fwd]; ctx.fillText(`FWD TOWER: ${dmg.towers.fwd.toUpperCase()}`,OX+P,cy);
    ctx.fillStyle=twrCol[dmg.towers.aft]; ctx.textAlign='right'; ctx.fillText(`AFT TOWER: ${dmg.towers.aft.toUpperCase()}`,OX+OW-P,cy);
    cy+=U(10);

    // ── DC Teams status bar ───────────────────────────────────────────────────
    const teamList=Object.values(dmg.teams||{});
    const teamBarH=U(42);
    ctx.fillStyle='rgba(20,30,50,0.50)';
    ctx.fillRect(OX+P,cy,OW-P*2,teamBarH);
    ctx.strokeStyle='rgba(80,110,160,0.20)'; ctx.lineWidth=1;
    ctx.strokeRect(OX+P,cy,OW-P*2,teamBarH);
    for(let ti=0;ti<teamList.length;ti++){
      const team=teamList[ti];
      const tx=OX+P+ti*(OW-P*2)/2+U(4);
      const stateCol=team.state==='lost'?'rgba(200,50,50,0.90)':team.task==='drench_pending'?'rgba(255,130,0,0.90)':team.task==='vent_n2'?'rgba(0,185,165,0.90)':team.state==='mustering'?'rgba(200,140,30,0.80)':team.state==='blowing'?'rgba(255,140,0,0.90)':team.state==='transit'?'rgba(220,170,30,0.90)':team.state==='on_scene'&&team.task==='fire'?'rgba(255,100,20,0.90)':team.state==='on_scene'&&team.task==='flood'?'rgba(100,160,255,0.90)':team.state==='on_scene'&&team.task==='repair'?'rgba(80,200,100,0.90)':team.state==='on_scene'?'rgba(160,200,160,0.70)':'rgba(140,140,140,0.60)';
      ctx.fillStyle=stateCol; ctx.font=`bold ${U(10)}px ui-monospace,monospace`; ctx.textAlign='left';
      ctx.fillText(team.label,tx,cy+U(13));
      const _drenchT=dmg._fireDrenchPending?.[DMG.roomSection(team.location)]?.t;
      const taskStr=team.state==='lost'?'\u2014 LOST':team.task==='drench_pending'?`N2 DRENCH \u2014 ${DMG.ROOMS[team.location]?.label||'?'} (${Math.ceil(_drenchT||0)}s)`:team.task==='vent_n2'?`VENT N2 \u2014 ${DMG.ROOMS[team.location]?.label||'?'} (${Math.ceil(team._ventT||0)}s)`:team.state==='mustering'?`MUSTER \u2192 ${DMG.SECTION_LABEL?.[team.destination]||'?'} (${Math.ceil(team.musterT||0)}s)`:team.state==='blowing'?`HP BLOW \u2014 ${DMG.ROOMS[team.location]?.label||'?'}`:team.state==='transit'?`\u2192 ${DMG.SECTION_LABEL?.[team.destination]||'?'} (${Math.ceil(team.transitEta)}s)`:team.state==='on_scene'&&team.task==='fire'?`FIRE \u2014 ${DMG.ROOMS[team.location]?.label||'?'}`:team.state==='on_scene'&&team.task==='flood'?`FLOOD \u2014 ${DMG.ROOMS[team.location]?.label||'?'}`:team.state==='on_scene'&&team.task==='repair'?`REPAIR \u2014 ${DMG.SYS_LABEL[team.repairTarget]||'?'}`:team.state==='on_scene'?`STANDBY \u2014 ${DMG.ROOMS[team.location]?.label||'?'}`:'STANDBY';
      ctx.fillStyle='rgba(160,180,220,0.65)'; ctx.font=`${U(9)}px ui-monospace,monospace`;
      ctx.fillText(taskStr,tx,cy+U(26));
      // Progress bars
      if(team.state==='on_scene'&&team.task==='repair'&&team.repairTarget){
        const job=player?.damage?.repairJobs?.[DMG.roomSection(team.location)];
        const pct=job?Math.min(1,job.progress/job.totalTime):0;
        const bx=tx,by=cy+U(30),bw=(OW-P*2)/2-U(8),bh=U(5);
        ctx.fillStyle='rgba(20,40,80,0.50)'; ctx.fillRect(bx,by,bw,bh);
        ctx.fillStyle='rgba(50,160,80,0.70)'; ctx.fillRect(bx,by,bw*pct,bh);
      }
      if(team.task==='vent_n2'){
        const pct=1-(team._ventT||0)/60;
        const bx=tx,by=cy+U(30),bw=(OW-P*2)/2-U(8),bh=U(5);
        ctx.fillStyle='rgba(0,60,60,0.50)'; ctx.fillRect(bx,by,bw,bh);
        ctx.fillStyle='rgba(0,185,165,0.70)'; ctx.fillRect(bx,by,bw*Math.min(1,pct),bh);
      }
      if(team.task==='drench_pending'&&_drenchT!=null){
        const pct=1-_drenchT/20;
        const bx=tx,by=cy+U(30),bw=(OW-P*2)/2-U(8),bh=U(5);
        ctx.fillStyle='rgba(60,30,0,0.50)'; ctx.fillRect(bx,by,bw,bh);
        ctx.fillStyle='rgba(255,130,0,0.70)'; ctx.fillRect(bx,by,bw*Math.min(1,pct),bh);
      }
    }
    cy+=teamBarH+U(8);

    // ── 5-compartment schematic ───────────────────────────────────────────────
    const schX=OX+P, schW=OW-P*2;
    const schH=U(148);
    const schY=cy;
    const compKeys=DMG.COMPS;
    const compLabels=['WTS 1','WTS 2','WTS 3','WTS 4','WTS 5','WTS 6'];
    const compFracs=[0.21,0.21,0.08,0.10,0.21,0.19];

    const phTop = schY + U(44);
    const phBot = schY + U(114);
    const phMid = (phTop+phBot)*0.5;
    const phR   = (phBot-phTop)*0.5;
    const phX0  = schX + phR + U(18);
    const phX1  = schX + schW - phR - U(18);
    const phSpan= phX1 - phX0;

    const ohR   = phR + U(8);
    const ohTop = phMid - ohR;
    const ohBot = phMid + ohR;

    const sailCX  = phX0 + phSpan*(0.21 + 0.105);
    const sailW   = U(44);
    const sailH   = U(22);
    const sailBot = ohTop;
    const sailTop = sailBot - sailH;

    let compXs=[], compWs=[];
    { let xx=phX0;
      for(let i=0;i<6;i++){ compWs[i]=phSpan*compFracs[i]; compXs[i]=xx; xx+=compWs[i]; } }

    const stFill  ={nominal:'rgba(18,55,28,0.88)',degraded:'rgba(75,58,4,0.90)',offline:'rgba(75,22,4,0.92)',destroyed:'rgba(55,4,4,0.96)'};
    const stStroke={nominal:'rgba(50,200,80,0.55)',degraded:'rgba(220,170,20,0.80)',offline:'rgba(220,80,20,0.90)',destroyed:'rgba(200,30,30,1.0)'};

    function pillPath(){
      ctx.beginPath();
      ctx.arc(phX0, phMid, phR, Math.PI*0.5, -Math.PI*0.5, false);
      ctx.lineTo(phX1, phTop);
      ctx.arc(phX1, phMid, phR, -Math.PI*0.5, Math.PI*0.5, false);
      ctx.lineTo(phX0, phBot);
      ctx.closePath();
    }
    function outerPillPath(){
      ctx.beginPath();
      ctx.arc(phX0, phMid, ohR, Math.PI*0.5, -Math.PI*0.5, false);
      ctx.lineTo(phX1, ohTop);
      ctx.arc(phX1, phMid, ohR, -Math.PI*0.5, Math.PI*0.5, false);
      ctx.lineTo(phX0, ohBot);
      ctx.closePath();
    }

    ctx.save();
    outerPillPath();
    ctx.strokeStyle='rgba(100,130,180,0.35)'; ctx.lineWidth=U(1.5);
    ctx.setLineDash([U(3),U(4)]); ctx.stroke(); ctx.setLineDash([]);

    const sailX0v = sailCX - sailW*0.5;
    const sailX1v = sailCX + sailW*0.5;
    ctx.strokeStyle='rgba(140,170,220,0.55)'; ctx.lineWidth=U(1.5);
    ctx.beginPath();
    ctx.moveTo(sailX0v + U(4), sailBot);
    ctx.lineTo(sailX0v + U(4), sailTop + U(4));
    ctx.bezierCurveTo(sailX0v+U(4),sailTop, sailX0v+U(10),sailTop, sailX0v+U(12),sailTop);
    ctx.lineTo(sailX1v - U(5), sailTop);
    ctx.lineTo(sailX1v, sailTop + U(8));
    ctx.lineTo(sailX1v, sailBot);
    ctx.stroke();

    const finX = phX1 + ohR*0.7;
    ctx.strokeStyle='rgba(110,140,190,0.40)'; ctx.lineWidth=U(1);
    ctx.beginPath(); ctx.moveTo(finX, ohTop+U(6)); ctx.lineTo(finX+U(16), ohTop+U(2)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(finX, ohBot-U(6)); ctx.lineTo(finX+U(16), ohBot-U(2)); ctx.stroke();

    const prX=phX1+ohR-U(3), prY=phMid, prR2=U(8);
    ctx.strokeStyle='rgba(140,170,220,0.60)'; ctx.lineWidth=U(1.5);
    for(let a=0;a<3;a++){
      const ang=a*Math.PI/3;
      ctx.beginPath();
      ctx.moveTo(prX+Math.cos(ang)*prR2*0.3,prY+Math.sin(ang)*prR2*0.3);
      ctx.bezierCurveTo(prX+Math.cos(ang+0.8)*prR2,prY+Math.sin(ang+0.8)*prR2,prX+Math.cos(ang+1.0)*prR2,prY+Math.sin(ang+1.0)*prR2,prX+Math.cos(ang+1.2)*prR2,prY+Math.sin(ang+1.2)*prR2);
      ctx.moveTo(prX+Math.cos(ang+Math.PI)*prR2*0.3,prY+Math.sin(ang+Math.PI)*prR2*0.3);
      ctx.bezierCurveTo(prX+Math.cos(ang+Math.PI+0.8)*prR2,prY+Math.sin(ang+Math.PI+0.8)*prR2,prX+Math.cos(ang+Math.PI+1.0)*prR2,prY+Math.sin(ang+Math.PI+1.0)*prR2,prX+Math.cos(ang+Math.PI+1.2)*prR2,prY+Math.sin(ang+Math.PI+1.2)*prR2);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(prX,prY,U(2.5),0,Math.PI*2); ctx.stroke();
    ctx.restore();

    // ── Fill compartments inside pill ─────────────────────────────────────────
    for(let ci=0;ci<6;ci++){
      const comp=compKeys[ci]; const cx2=compXs[ci]; const cw=compWs[ci];
      const sysList=DMG.activeSystems(comp);
      let worstIdx=0;
      for(const s of sysList) worstIdx=Math.max(worstIdx,DMG.STATES.indexOf(dmg.systems[s]||'nominal'));
      const worst=DMG.STATES[worstIdx];
      const flood=dmg.flooding[comp]||0;
      const isFlooded=dmg.flooded[comp];

      ctx.save();
      pillPath(); ctx.clip();

      const fx = ci===0 ? cx2-phR : cx2;
      const fw = (ci===0||ci===5) ? cw+phR : cw;

      ctx.fillStyle=isFlooded?'rgba(8,18,70,0.98)':stFill[worst]||stFill.nominal;
      ctx.fillRect(fx, phTop, fw, phBot-phTop);

      if(flood>0){
        const fH=(phBot-phTop)*flood*0.92;
        ctx.fillStyle=`rgba(28,75,200,${0.28+flood*0.48})`;
        ctx.fillRect(fx, phBot-fH, fw, fH);
        ctx.strokeStyle=`rgba(100,160,255,${0.35+flood*0.35})`; ctx.lineWidth=U(1.5);
        ctx.beginPath(); ctx.moveTo(fx, phBot-fH); ctx.lineTo(fx+fw, phBot-fH); ctx.stroke();
      }
      ctx.restore();
    }

    pillPath();
    ctx.strokeStyle='rgba(80,120,180,0.50)'; ctx.lineWidth=U(1.5); ctx.stroke();

    ctx.save(); pillPath(); ctx.clip();
    for(let ci=1;ci<6;ci++){
      const x=compXs[ci];
      const stA=DMG.effectiveState(DMG.activeSystems(compKeys[ci-1])[0],dmg)||'nominal';
      const stB=DMG.effectiveState(DMG.activeSystems(compKeys[ci])[0],dmg)||'nominal';
      const worst=Math.max(DMG.STATES.indexOf(stA),DMG.STATES.indexOf(stB));
      ctx.strokeStyle=['rgba(50,120,65,0.50)','rgba(160,130,20,0.60)','rgba(160,60,20,0.70)','rgba(150,30,30,0.80)'][worst]||'rgba(60,90,140,0.40)';
      ctx.lineWidth=U(1); ctx.setLineDash([U(4),U(4)]);
      ctx.beginPath(); ctx.moveTo(x, phTop+U(4)); ctx.lineTo(x, phBot-U(4)); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();

    for(let ci=0;ci<6;ci++){
      const comp=compKeys[ci]; const cx2=compXs[ci]; const cw=compWs[ci];
      const flood=dmg.flooding[comp]||0;
      const isFlooded=dmg.flooded[comp];
      const sysList=DMG.activeSystems(comp);
      let worstIdx=0;
      for(const s of sysList) worstIdx=Math.max(worstIdx,DMG.STATES.indexOf(dmg.systems[s]||'nominal'));
      const worst=DMG.STATES[worstIdx];
      const cMid=cx2+cw*0.5;

      if(worstIdx>0){
        ctx.save(); pillPath(); ctx.clip();
        const glowCols=['','rgba(220,170,20,0.18)','rgba(220,80,20,0.22)','rgba(200,30,30,0.30)'];
        ctx.fillStyle=glowCols[worstIdx]||'';
        const fx2=ci===0?cx2-phR:cx2, fw2=(ci===0||ci===5)?cw+phR:cw;
        ctx.fillRect(fx2,phTop,fw2,phBot-phTop);
        ctx.strokeStyle=stStroke[worst]; ctx.lineWidth=U(1); ctx.setLineDash([U(3),U(3)]);
        ctx.strokeRect(cx2+1,phTop+1,cw-2,phBot-phTop-2);
        ctx.setLineDash([]);
        ctx.restore();
      }

      ctx.fillStyle='rgba(200,220,255,0.88)'; ctx.font=`bold ${U(9)}px ui-monospace,monospace`; ctx.textAlign='center';
      ctx.fillText(compLabels[ci], cMid, phTop+U(12));

      const cc=dmg.crew[comp]||[];
      const aw=session.activeWatch||'A';
      const wk=cc.filter(c=>(c.watch===aw||c.watch==='duty')&&c.dept!=='medical'&&c.dept!=='supply');
      const wkFit=wk.filter(c=>c.status==='fit'&&!c.displaced).length;
      const wkDisp=wk.filter(c=>c.displaced&&c.status!=='killed').length;
      const wkKia=wk.filter(c=>c.status==='killed').length;
      const wkTotal=wk.length-wkKia;
      const crewLabel=wkDisp>0?`${wkFit}+${wkDisp}d/${wkTotal}`:`${wkFit}/${wkTotal}`;
      ctx.fillStyle=wkKia>0?'rgba(220,80,80,0.85)':wkDisp>0?'rgba(200,170,50,0.80)':'rgba(90,190,110,0.75)';
      ctx.font=`${U(9)}px ui-monospace,monospace`;
      ctx.fillText(crewLabel, cMid, phBot-U(10));

      const fireLevel=Math.max(...(DMG.SECTION_ROOMS[comp]||[]).map(rid=>dmg.fire?.[rid]||0));
      const drench=dmg._fireDrench?.[comp];
      const drenchLevel=drench?.level??0;
      if(fireLevel>0.02&&drenchLevel<1){
        ctx.save(); pillPath(); ctx.clip();
        const fx2=ci===0?cx2-phR:cx2, fw2=(ci===0||ci===5)?cw+phR:cw;
        ctx.fillStyle=`rgba(200,80,0,${(0.15+fireLevel*0.30)*(1-drenchLevel)})`;
        ctx.fillRect(fx2,phTop,fw2,phBot-phTop);
        ctx.restore();
      }
      if(drenchLevel>0){
        ctx.save(); pillPath(); ctx.clip();
        const fx2=ci===0?cx2-phR:cx2, fw2=(ci===0||ci===5)?cw+phR:cw;
        const fillH=(phBot-phTop)*drenchLevel;
        ctx.fillStyle=`rgba(0,210,190,${0.18+drenchLevel*0.32})`;
        ctx.fillRect(fx2, phBot-fillH, fw2, fillH);
        ctx.restore();
      }

      if(isFlooded){
        ctx.fillStyle='rgba(140,180,255,0.95)'; ctx.font=`bold ${U(10)}px ui-monospace,monospace`;
        ctx.fillText('FLOODED', cMid, phMid+U(4));
      } else if(drenchLevel>0){
        ctx.fillStyle=drenchLevel>=1?'rgba(0,240,220,0.95)':'rgba(0,210,190,0.90)';
        ctx.font=`bold ${U(9)}px ui-monospace,monospace`;
        ctx.fillText(`N2 ${Math.round(drenchLevel*100)}%`, cMid, phMid+U(4));
      } else if(fireLevel>0.02){
        ctx.fillStyle=fireLevel>0.85?'rgba(255,80,20,0.95)':'rgba(255,140,40,0.90)';
        ctx.font=`bold ${U(9)}px ui-monospace,monospace`;
        ctx.fillText(`FIRE ${Math.round(fireLevel*100)}%`, cMid, phMid+U(4));
      } else if(flood>0.02){
        ctx.fillStyle='rgba(140,190,255,0.90)'; ctx.font=`${U(9)}px ui-monospace,monospace`;
        ctx.fillText(`${Math.round(flood*100)}%`, cMid, phMid+U(4));
      }

    }
    cy=schY+schH+U(10);

    // ── DC Team dispatch rows ─────────────────────────────────────────────────
    {
      const teamList=[dmg.teams?.alpha, dmg.teams?.bravo].filter(Boolean);
      const dispBtnH=U(22);
      const dispGap=U(3);
      const labelW=phX0-schX;

      for(let ti=0;ti<teamList.length;ti++){
        const team=teamList[ti];
        const rowY=cy+ti*(dispBtnH+dispGap+U(2));

        const isReady=team.state==='ready';
        const isMusteringEmerg=team._readyT>0;
        const isLocked=team._locked;
        const tLabelCol=team.state==='lost'?'rgba(180,30,30,0.80)':isMusteringEmerg?'rgba(170,100,0,0.80)':team.state==='mustering'?'rgba(160,110,15,0.75)':isReady?'rgba(80,80,90,0.70)':team.task==='flood'?'rgba(30,70,160,0.75)':'rgba(30,100,50,0.75)';
        ctx.fillStyle=tLabelCol; ctx.beginPath(); ctx.roundRect(schX,rowY,labelW-dispGap,dispBtnH,U(3)); ctx.fill();
        ctx.fillStyle='rgba(220,220,240,0.90)'; ctx.font=`bold ${U(9)}px ui-monospace,monospace`; ctx.textAlign='center';
        const pillTxt=isMusteringEmerg?`MSTR ${Math.ceil(team._readyT)}s`:isLocked?team.label.replace('DC ','')+' \u{1F512}':team.label.replace('DC ','');
        ctx.fillText(pillTxt,schX+(labelW-dispGap)/2,rowY+dispBtnH*0.68);

        for(let ci=0;ci<6;ci++){
          const comp=compKeys[ci];
          const bx=compXs[ci]+dispGap/2;
          const bw=compWs[ci]-dispGap;
          const lbl=compLabels[ci].slice(0,3);
          const isOnScene   = team.state==='on_scene'  && DMG.roomSection(team.location)===comp;
          const isInTransit = team.state==='transit'   && team.destination===comp;
          const isMustering = team.state==='mustering' && team.destination===comp;
          const isFlooded  = dmg.flooded[comp];
          const fireLevel  = Math.max(...(DMG.SECTION_ROOMS[comp]||[]).map(rid=>dmg.fire?.[rid]||0));
          const hasFire    = fireLevel>0.02;
          const isDrenched = !!dmg._fireDrench?.[comp];

          const isVenting   = team.state==='on_scene'&&DMG.roomSection(team.location)===comp&&team.task==='vent_n2';
          const isVentTransit=(team.state==='transit'||team.state==='mustering')&&team.destination===comp&&team._ventIntent===comp;
          const isDrenchWaiting=team.task==='drench_pending'&&DMG.roomSection(team.location)===comp;

          let bCol, bLabel, clickFn;
          if(team.state==='lost'){
            bCol='rgba(30,30,30,0.22)'; bLabel=lbl; clickFn=null;
          } else if(team.state==='blowing'&&DMG.roomSection(team.location)===comp){
            bCol='rgba(180,90,0,0.85)'; bLabel='BLOW';
            clickFn=()=>DMG.recallTeam(team.id);
          } else if(isDrenchWaiting){
            bCol='rgba(220,100,0,0.90)'; bLabel='N2!\u25b6';
            clickFn=()=>DMG.manualDrench(team.id);
          } else if(isDrenched){
            if(isVenting){
              bCol='rgba(0,150,135,0.85)'; bLabel='VENT \u25a0';
              clickFn=()=>DMG.recallTeam(team.id);
            } else if(isVentTransit){
              bCol='rgba(0,130,120,0.80)'; bLabel='\u2192VENT';
              clickFn=()=>DMG.recallTeam(team.id);
            } else {
              bCol='rgba(0,100,90,0.70)'; bLabel='VENT';
              clickFn=()=>DMG.ventN2(team.id,comp);
            }
          } else if(isFlooded){
            const isBlowingHere=(team.state==='blowing'&&DMG.roomSection(team.location)===comp)||(team.state==='transit'&&team.destination===comp);
            if(isBlowingHere){
              bCol='rgba(180,90,0,0.85)'; bLabel='BLOW \u25a0';
              clickFn=()=>DMG.recallTeam(team.id);
            } else {
              bCol='rgba(60,30,10,0.70)'; bLabel='BLOW?';
              clickFn=()=>DMG.assignTeam(team.id,comp);
            }
          } else if(hasFire&&isOnScene&&team.task==='fire'){
            bCol='rgba(160,50,10,0.85)'; bLabel='FIRE \u25a0';
            clickFn=()=>DMG.recallTeam(team.id);
          } else if(hasFire&&isInTransit){
            bCol='rgba(130,55,10,0.80)'; bLabel='\u2192FIRE';
            clickFn=()=>DMG.recallTeam(team.id);
          } else if(hasFire&&isReady){
            bCol='rgba(140,40,5,0.75)'; bLabel='FIRE';
            clickFn=()=>DMG.assignTeam(team.id,comp);
          } else if(hasFire){
            bCol='rgba(100,30,5,0.45)'; bLabel=lbl+'\u2622';
            clickFn=()=>DMG.assignTeam(team.id,comp);
          } else if(isOnScene){
            bCol='rgba(20,90,40,0.85)'; bLabel=lbl+' \u2713';
            clickFn=()=>DMG.recallTeam(team.id);
          } else if(isMustering){
            bCol='rgba(160,110,15,0.75)'; bLabel='MSTR '+lbl;
            clickFn=()=>DMG.recallTeam(team.id);
          } else if(isInTransit){
            bCol='rgba(120,95,15,0.80)'; bLabel='\u2192'+lbl;
            clickFn=()=>DMG.recallTeam(team.id);
          } else {
            bCol='rgba(25,45,105,0.65)'; bLabel=lbl;
            clickFn=()=>DMG.assignTeam(team.id,comp);
          }
          PNL.btn2(ctx,bLabel,bx,rowY,bw,dispBtnH,bCol,clickFn||(()=>{}));
        }
      }
      cy+=teamList.length*(dispBtnH+dispGap+U(2))+U(6);
    }

    // ── Systems grid ──────────────────────────────────────────────────────────
    const stColText={'nominal':'rgba(80,200,100,0.80)','degraded':'rgba(230,170,20,0.90)','offline':'rgba(230,90,30,0.90)','destroyed':'rgba(200,50,50,0.95)'};
    for(let ci=0;ci<6;ci++){
      const comp=compKeys[ci]; const cx2=compXs[ci]; const cw=compWs[ci];
      const sysList=DMG.activeSystems(comp);
      let sy=cy;
      for(const sys of sysList){
        const st=DMG.effectiveState(sys,dmg);
        ctx.fillStyle='rgba(160,180,220,0.70)'; ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.textAlign='center';
        ctx.fillText(DMG.SYS_LABEL[sys]||sys,cx2+cw/2,sy); sy+=U(12);
        ctx.fillStyle=stColText[st]||stColText.destroyed; ctx.font=`bold ${U(9)}px ui-monospace,monospace`;
        ctx.fillText(st.toUpperCase(),cx2+cw/2,sy); sy+=U(10);
      }
    }

    // ── Escape buttons ────────────────────────────────────────────────────────
    const escY=OY+OH-U(96);
    ctx.fillStyle='rgba(120,140,180,0.50)'; ctx.font=`${U(10)}px ui-monospace,monospace`; ctx.textAlign='left';
    ctx.fillText('ESCAPE',OX+P,escY);
    const halfEsc=(OW-P*2-U(6))/2;
    const tceViable=DMG.canTCE(); const escActive=!!dmg.escapeState;
    PNL.btn2(ctx,escActive?'ESCAPING\u2026':'TCE ESCAPE',OX+P,escY+U(4),halfEsc,U(18),
      escActive?'rgba(30,80,30,0.50)':tceViable?'rgba(20,60,20,0.70)':'rgba(60,60,60,0.30)',
      ()=>{ if(!escActive&&tceViable) DMG.initiateEscape('tce'); });
    PNL.btn2(ctx,escActive?'ESCAPING\u2026':'RUSH ESCAPE',OX+P+halfEsc+U(6),escY+U(4),halfEsc,U(18),
      escActive?'rgba(80,30,30,0.50)':'rgba(100,30,10,0.70)',
      ()=>{ if(!escActive) DMG.initiateEscape('rush'); });
    const depthM=Math.round(player.depth||0);
    const depthAdv=depthM<=120?'TCE & RUSH viable':depthM<=200?'TCE marginal':'TCE not viable';
    const depthAdvCol=depthM<=120?'rgba(80,200,80,0.70)':depthM<=200?'rgba(220,170,20,0.80)':'rgba(220,80,50,0.80)';
    ctx.fillStyle=depthAdvCol; ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.textAlign='center';
    ctx.fillText(`${depthM}m \u2014 ${depthAdv}`,OX+OW/2,escY+U(30));

    // ── SEAL buttons ──────────────────────────────────────────────────────────
    const sealY=OY+OH-U(52);
    ctx.fillStyle='rgba(80,100,140,0.40)'; ctx.font=`${U(8)}px ui-monospace,monospace`; ctx.textAlign='left';
    ctx.fillText('SEAL (last resort \u2014 kills all crew inside):',OX+P,sealY);
    for(let ci=0;ci<6;ci++){
      const comp=compKeys[ci]; const cx2=compXs[ci]; const cw=compWs[ci];
      if(!dmg.flooded[comp]&&(dmg.flooding[comp]||0)>0.05){
        PNL.btn2(ctx,compLabels[ci].slice(0,3),cx2+2,sealY+U(4),cw-4,U(14),'rgba(100,30,30,0.60)',()=>DMG.sealFlooding(comp));
      }
    }

    // ── Debug hit buttons ─────────────────────────────────────────────────────
    if(session.debugOverlay){
      const dbgY=OY+OH-U(26);
      ctx.fillStyle='rgba(200,50,50,0.60)'; ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.textAlign='left';
      ctx.fillText('[ DEBUG ] HIT:',OX+P,dbgY-U(2));
      const dbgW=(OW-P*2-U(4))/6;
      for(let i=0;i<6;i++){
        const comp=DMG.COMPS[i]; const isHit=(dmg.strikes[comp]||0)>=1;
        PNL.btn2(ctx,compLabels[i].slice(0,3),OX+P+i*dbgW,dbgY,dbgW-U(3),U(14),
          isHit?'rgba(180,30,30,0.80)':'rgba(100,30,30,0.55)',()=>DMG.hit(55,null,null,comp));
      }
    }
  }
