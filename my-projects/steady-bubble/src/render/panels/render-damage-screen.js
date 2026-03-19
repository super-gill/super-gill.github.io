// render-damage-screen.js — drawDamageScreen (unified full-screen damage/crew panel)
'use strict';

import { clamp, player, session, ui, L, C } from './panel-context.js';

  export function drawDamageScreen(W,H){
    const ctx = L.ctx;
    const {U} = L.R;
    if(!ui.showDamageScreen) return;
    const dmg=player.damage;
    if(!dmg) return;
    const DMG=L.DMG;
    const PNL=L.PANEL;
    const activeWatch=session.activeWatch||'A';
    const P=U(10);
    const HDR_H=U(44);
    const LW=W;
    const BODY_Y=HDR_H;

    ctx.fillStyle='rgba(5,10,20,0.98)'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='rgba(10,18,35,1.0)'; ctx.fillRect(0,0,W,HDR_H);
    ctx.strokeStyle='rgba(60,100,160,0.40)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,HDR_H); ctx.lineTo(W,HDR_H); ctx.stroke();
    ctx.fillStyle='rgba(160,190,240,0.92)'; ctx.font=`bold ${U(14)}px ui-monospace,monospace`; ctx.textAlign='left';
    ctx.fillText('DAMAGE CONTROL',P,HDR_H*0.72);

    const fatigue=session.watchFatigue||0; const changing=session.watchChanging||false; const changeT=session.watchChangeT||0;
    const watchLabel=changing?`WATCH ${activeWatch} \u2192 ${activeWatch==='A'?'B':'A'}`:`WATCH ${activeWatch} ON`;
    const watchBg=changing?'rgba(80,60,10,0.75)':activeWatch==='A'?'rgba(30,70,150,0.75)':'rgba(10,100,90,0.75)';
    const watchFg=changing?'rgba(255,200,60,0.95)':activeWatch==='A'?'rgba(140,190,255,0.95)':'rgba(80,220,200,0.95)';
    const wPillX=W/2-U(180);
    ctx.fillStyle=watchBg; ctx.beginPath(); ctx.roundRect(wPillX,U(6),U(108),U(22),U(3)); ctx.fill();
    ctx.fillStyle=watchFg; ctx.font=`bold ${U(10)}px ui-monospace,monospace`; ctx.textAlign='center'; ctx.fillText(watchLabel,wPillX+U(54),U(21));

    const fbX=wPillX+U(114),fbY=U(6),fbW=U(130),fbH=U(22);
    ctx.fillStyle='rgba(20,30,50,0.70)'; ctx.beginPath(); ctx.roundRect(fbX,fbY,fbW,fbH,U(2)); ctx.fill();
    const fatigueCol=fatigue>=0.8?'rgba(210,60,40,0.85)':fatigue>=0.5?'rgba(220,160,30,0.85)':'rgba(50,180,80,0.75)';
    if(fatigue>0){ ctx.fillStyle=fatigueCol; ctx.beginPath(); ctx.roundRect(fbX+1,fbY+1,Math.max(U(2),(fbW-2)*fatigue),fbH-2,U(2)); ctx.fill(); }
    ctx.fillStyle='rgba(140,165,210,0.60)'; ctx.font=`${U(8)}px ui-monospace,monospace`;
    ctx.textAlign='left'; ctx.fillText('FATIGUE',fbX+U(3),U(21));
    ctx.textAlign='right'; ctx.fillText(`${Math.round(fatigue*100)}%`,fbX+fbW-U(3),U(21));
    if(changing){ ctx.fillStyle='rgba(255,200,60,0.80)'; ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.textAlign='left'; ctx.fillText(`RELIEVING \u2014 ${Math.ceil(changeT)}s`,fbX+fbW+U(6),U(21)); }

    const canRelieve=!changing&&session.tacticalState!=='action'&&session.casualtyState!=='emergency';
    const relBtnX=wPillX+U(254);
    ctx.fillStyle=canRelieve?'rgba(30,60,120,0.75)':'rgba(30,40,60,0.40)';
    ctx.beginPath(); ctx.roundRect(relBtnX,U(6),U(120),U(22),U(3)); ctx.fill();
    ctx.fillStyle=canRelieve?'rgba(140,190,255,0.90)':'rgba(80,100,130,0.50)';
    ctx.font=`bold ${U(9)}px ui-monospace,monospace`; ctx.textAlign='center';
    ctx.fillText(changing?'CHANGING\u2026':'RELIEVE WATCH [W]',relBtnX+U(60),U(21));
    if(canRelieve) PNL.btn2(ctx,'',relBtnX,U(6),U(120),U(22),'transparent',()=>{ L.SIM?.initiateWatchChange?.(); });

    const closeBtnX=W-U(88)-P;
    PNL.btn2(ctx,'[H] CLOSE',closeBtnX,U(6),U(86),U(22),'rgba(30,40,70,0.80)',()=>{ ui.showDamageScreen=false; });

    let cy=BODY_Y+U(10);
    const fit=DMG.totalFit(),wnd=DMG.totalWounded(),kia=DMG.totalKilled(),total=DMG.totalCrew();
    const aw2=session.activeWatch||'A';
    let wkOnFit=0,wkOnWnd=0,wkOnTotal=0;
    for(const comp of DMG.COMPS){
      const cc2=(dmg.crew[comp]||[]).filter(c=>(c.watch===aw2||c.watch==='duty')&&c.dept!=='medical'&&c.dept!=='supply');
      wkOnFit  +=cc2.filter(c=>c.status==='fit'&&!c.displaced).length;
      wkOnWnd  +=cc2.filter(c=>c.status==='wounded').length;
      wkOnTotal+=cc2.filter(c=>c.status!=='killed').length;
    }
    ctx.fillStyle='rgba(160,185,230,0.70)'; ctx.font=`${U(10)}px ui-monospace,monospace`; ctx.textAlign='left';
    ctx.fillText(`WCH ${aw2}  ${wkOnFit} FIT  ${wkOnWnd} WND  /  ${wkOnTotal} ON WATCH`,P,cy);
    ctx.fillStyle='rgba(110,130,170,0.50)'; ctx.textAlign='right';
    ctx.fillText(`SHIP  ${fit} FIT  ${wnd} WND  ${kia} KIA  / ${total}`,LW-P,cy);
    cy+=U(14);

    const twrCol={nominal:'rgba(22,163,74,0.75)',damaged:'rgba(217,119,6,0.80)',destroyed:'rgba(180,30,30,0.80)'};
    ctx.font=`${U(10)}px ui-monospace,monospace`; ctx.textAlign='left';
    ctx.fillStyle=twrCol[dmg.towers.fwd]; ctx.fillText(`FWD TOWER: ${dmg.towers.fwd.toUpperCase()}`,P,cy);
    ctx.fillStyle=twrCol[dmg.towers.aft]; ctx.textAlign='right'; ctx.fillText(`AFT TOWER: ${dmg.towers.aft.toUpperCase()}`,LW-P,cy);
    cy+=U(10);

    const teamListDS=Object.values(dmg.teams||{});
    const teamBarH=U(42);
    ctx.fillStyle='rgba(20,30,50,0.50)'; ctx.fillRect(P,cy,LW-P*2,teamBarH);
    ctx.strokeStyle='rgba(80,110,160,0.20)'; ctx.lineWidth=1; ctx.strokeRect(P,cy,LW-P*2,teamBarH);
    for(let ti=0;ti<teamListDS.length;ti++){
      const team=teamListDS[ti];
      const tx=P+ti*(LW-P*2)/2+U(4);
      const stateCol=team.state==='lost'?'rgba(200,50,50,0.90)':team.state==='mustering'?'rgba(200,140,30,0.80)':team.state==='blowing'?'rgba(255,140,0,0.90)':team.state==='transit'?'rgba(220,170,30,0.90)':team.state==='on_scene'&&team.task==='fire'?'rgba(255,100,20,0.90)':team.state==='on_scene'&&team.task==='flood'?'rgba(100,160,255,0.90)':team.state==='on_scene'&&team.task==='repair'?'rgba(80,200,100,0.90)':team.state==='on_scene'?'rgba(160,200,160,0.70)':'rgba(140,140,140,0.60)';
      ctx.fillStyle=stateCol; ctx.font=`bold ${U(10)}px ui-monospace,monospace`; ctx.textAlign='left';
      ctx.fillText(team.label,tx,cy+U(13));
      const taskStr=team.state==='lost'?'\u2014 LOST':team.state==='mustering'?`MUSTER \u2192 ${DMG.SECTION_LABEL?.[team.destination]||'?'} (${Math.ceil(team.musterT||0)}s)`:team.state==='blowing'?`HP BLOW \u2014 ${DMG.ROOMS[team.location]?.label||'?'}`:team.state==='transit'?`\u2192 ${DMG.SECTION_LABEL?.[team.destination]||'?'} (${Math.ceil(team.transitEta)}s)`:team.state==='on_scene'&&team.task==='fire'?`FIRE \u2014 ${DMG.ROOMS[team.location]?.label||'?'}`:team.state==='on_scene'&&team.task==='flood'?`FLOOD \u2014 ${DMG.ROOMS[team.location]?.label||'?'}`:team.state==='on_scene'&&team.task==='repair'?`REPAIR \u2014 ${DMG.SYS_LABEL[team.repairTarget]||'?'}`:team.state==='on_scene'?`STANDBY \u2014 ${DMG.ROOMS[team.location]?.label||'?'}`:'STANDBY';
      ctx.fillStyle='rgba(160,180,220,0.65)'; ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.fillText(taskStr,tx,cy+U(26));
      if(team.state==='on_scene'&&team.task==='repair'&&team.repairTarget){
        const job=player?.damage?.repairJobs?.[DMG.roomSection(team.location)];
        const pct=job?Math.min(1,job.progress/job.totalTime):0;
        const bx=tx,by=cy+U(30),bw=(LW-P*2)/2-U(8),bh=U(5);
        ctx.fillStyle='rgba(20,40,80,0.50)'; ctx.fillRect(bx,by,bw,bh);
        ctx.fillStyle='rgba(50,160,80,0.70)'; ctx.fillRect(bx,by,bw*pct,bh);
      }
    }
    cy+=teamBarH+U(8);

    // ── 3-Deck Schematic ───────────────────────────────────────────────────────
    const schX=P, schW=LW-P*2, schH=U(310), schY=cy;
    const compKeys=DMG.COMPS;
    const compLabels=['WT SECT 1','WT SECT 2','WT SECT 3','WT SECT 4','WT SECT 5','WT SECT 6'];
    const compFracs=[0.18,0.22,0.14,0.10,0.22,0.14];
    const dH=U(64);
    const phTop=schY+Math.round(schH*0.26), phBot=schY+Math.round(schH*0.26)+3*dH;
    const phMid=(phTop+phBot)*0.5; const phR=(phBot-phTop)*0.5;
    const phX0=schX+phR+U(18), phX1=schX+schW-phR-U(18), phSpan=phX1-phX0;
    const ohR=phR+U(8), ohTop=phMid-ohR, ohBot=phMid+ohR;
    const sailCX=phX0+phSpan*(0.21+0.105);
    const sailW2=U(86), sailH2=U(58), sailBot2=ohTop, sailTop2=sailBot2-sailH2;
    const d1Top=phTop, d2Top=phTop+dH, d3Top=phTop+2*dH;
    const deckTops=[d1Top,d2Top,d3Top];
    let compXs=[],compWs=[];
    { let xx=phX0; for(let i=0;i<6;i++){ compWs[i]=phSpan*compFracs[i]; compXs[i]=xx; xx+=compWs[i]; } }
    const COMP_LAYOUT = {
      fore_ends:[{c:0,cs:1,d:0,ds:1,lbl:'FWD DOME',cap:6,rid:'fore_ends_d0'},{c:1,cs:2,d:0,ds:1,lbl:'COMMS',cap:12,rid:'fore_ends_d0b'},{c:0,cs:1,d:1,ds:1,lbl:'ENG OFFICE',cap:6,rid:'fore_ends_d1'},{c:1,cs:2,d:1,ds:1,lbl:'COMPUTER RM',cap:12,rid:'fore_ends_d1b'},{c:0,cs:3,d:2,ds:1,lbl:'TORPEDO ROOM',cap:18,rid:'fore_ends_d2'}],
      control_room:[{c:0,cs:1,d:0,ds:1,lbl:'NAV',cap:6,rid:'control_room_d0'},{c:1,cs:1,d:0,ds:1,lbl:'SCOPE',cap:6,rid:'control_room_d0b'},{c:2,cs:1,d:0,ds:1,lbl:'WARDROOM',cap:6,rid:'control_room_d0c'},{c:0,cs:1,d:1,ds:1,lbl:'CO CABIN',cap:6,rid:'control_room_d1b'},{c:1,cs:2,d:1,ds:1,lbl:'CONTROL ROOM',cap:12,rid:'control_room_d1'},{c:0,cs:3,d:2,ds:1,lbl:'MACHINERY SP',cap:18,rid:'control_room_d2'}],
      aux_section:[{c:0,cs:1,d:0,ds:1,lbl:'JR MESS',cap:6,rid:'aux_section_d0'},{c:1,cs:2,d:0,ds:1,lbl:'SR MESS',cap:12,rid:'aux_section_d0b'},{c:0,cs:2,d:1,ds:1,lbl:'BUNKS',cap:12,rid:'aux_section_d1'},{c:2,cs:1,d:1,ds:1,lbl:'VENT PLANT',cap:6,rid:'aux_section_d1b'},{c:0,cs:1,d:2,ds:1,lbl:'AMS 1',cap:6,rid:'aux_section_d2'},{c:1,cs:1,d:2,ds:1,lbl:'RX E-COOL',cap:6,rid:'aux_section_d2b'},{c:2,cs:1,d:2,ds:1,lbl:'SICKBAY',cap:6,rid:'aux_section_d2c'}],
      reactor_comp:[{c:0,cs:3,d:0,ds:1,lbl:'RC TUNNEL',cap:18,rid:'reactor_comp_d0'},{c:0,cs:3,d:1,ds:2,lbl:'REACTOR',cap:36,rid:['reactor_comp_d1','reactor_comp_d2']}],
      engine_room:[{c:0,cs:1,d:0,ds:1,lbl:'AFT PASS',cap:6,rid:'engine_room_d0'},{c:1,cs:2,d:0,ds:1,lbl:'MANEUVERING',cap:12,rid:'engine_room_d0b'},{c:0,cs:3,d:1,ds:1,lbl:'ELEC DIST',cap:18,rid:'engine_room_d1'},{c:0,cs:3,d:2,ds:1,lbl:'AFT ATMOS',cap:18,rid:'engine_room_d2'}],
      aft_ends:[{c:0,cs:1,d:0,ds:1,lbl:'AFT ESCAPE',cap:6,rid:'aft_ends_d2b'},{c:1,cs:2,d:0,ds:1,lbl:'ENGINEERING',cap:12,rid:'aft_ends_d0'},{c:0,cs:2,d:1,ds:1,lbl:'PROPULSION',cap:12,rid:'aft_ends_d1'},{c:2,cs:1,d:1,ds:1,lbl:'SHAFT ALLEY',cap:6,rid:'aft_ends_d1b'},{c:0,cs:3,d:2,ds:1,lbl:'STEER GEAR',cap:18,rid:'aft_ends_d2'}],
    };
    const COMP_LAYOUT_DIESEL = {
      reactor_comp:[{c:0,cs:3,d:0,ds:1,lbl:'ENG PASSAGE',cap:18,rid:'reactor_comp_d0'},{c:0,cs:3,d:1,ds:2,lbl:'DIESEL ENGINE',cap:36,rid:['reactor_comp_d1','reactor_comp_d2']}],
      engine_room:[{c:0,cs:1,d:0,ds:1,lbl:'AFT PASS',cap:6,rid:'engine_room_d0'},{c:1,cs:2,d:0,ds:1,lbl:'MOTOR CTRL',cap:12,rid:'engine_room_d0b'},{c:0,cs:3,d:1,ds:1,lbl:'BATT BANK 1',cap:18,rid:'engine_room_d1'},{c:0,cs:3,d:2,ds:1,lbl:'BATT BANK 2',cap:18,rid:'engine_room_d2'}],
      aux_section:[{c:0,cs:1,d:0,ds:1,lbl:'JR MESS',cap:6,rid:'aux_section_d0'},{c:1,cs:2,d:0,ds:1,lbl:'SR MESS',cap:12,rid:'aux_section_d0b'},{c:0,cs:2,d:1,ds:1,lbl:'BUNKS',cap:12,rid:'aux_section_d1'},{c:2,cs:1,d:1,ds:1,lbl:'VENT PLANT',cap:6,rid:'aux_section_d1b'},{c:0,cs:1,d:2,ds:1,lbl:'AMS 1',cap:6,rid:'aux_section_d2'},{c:1,cs:1,d:2,ds:1,lbl:'BATT MON',cap:6,rid:'aux_section_d2b'},{c:2,cs:1,d:2,ds:1,lbl:'SICKBAY',cap:6,rid:'aux_section_d2c'}],
    };
    function getCompLayout(comp){ return (C.player.isDiesel && COMP_LAYOUT_DIESEL[comp]) || COMP_LAYOUT[comp] || []; }
    const stFill={nominal:'rgba(18,55,28,0.88)',degraded:'rgba(75,58,4,0.90)',offline:'rgba(75,22,4,0.92)',destroyed:'rgba(55,4,4,0.96)'};
    const stStroke={nominal:'rgba(50,200,80,0.55)',degraded:'rgba(220,170,20,0.80)',offline:'rgba(220,80,20,0.90)',destroyed:'rgba(200,30,30,1.0)'};
    function dsphPill(){ ctx.beginPath(); ctx.arc(phX0,phMid,phR,Math.PI*0.5,-Math.PI*0.5,false); ctx.lineTo(phX1,phTop); ctx.arc(phX1,phMid,phR,-Math.PI*0.5,Math.PI*0.5,false); ctx.lineTo(phX0,phBot); ctx.closePath(); }
    function dsohPill(){ ctx.beginPath(); ctx.arc(phX0,phMid,ohR,Math.PI*0.5,-Math.PI*0.5,false); ctx.lineTo(phX1,ohTop); ctx.arc(phX1,phMid,ohR,-Math.PI*0.5,Math.PI*0.5,false); ctx.lineTo(phX0,ohBot); ctx.closePath(); }
    function deckFloodFrac(flood,isFlooded,di){ if(isFlooded) return 1; const t=flood*3; return di===2?Math.min(1,Math.max(0,t)):di===1?Math.min(1,Math.max(0,t-1)):Math.min(1,Math.max(0,t-2)); }
    const cState=compKeys.map(comp=>{ const sysList=DMG.activeSystems(comp); let wi=0; for(const s of sysList) wi=Math.max(wi,DMG.STATES.indexOf(dmg.systems[s]||'nominal')); const rooms=DMG.SECTION_ROOMS[comp]||[]; const fires=[0,1,2].map(di=>Math.max(...rooms.filter(rid=>(DMG.ROOMS[rid]?.deck??-1)===di).map(rid=>dmg.fire?.[rid]||0),0)); return {wi,worst:DMG.STATES[wi],flood:dmg.flooding[comp]||0,isFlooded:!!dmg.flooded[comp],fireLevel:Math.max(...fires),fires}; });

    ctx.save(); dsohPill(); ctx.strokeStyle='rgba(100,130,180,0.35)'; ctx.lineWidth=U(1.5); ctx.setLineDash([U(3),U(4)]); ctx.stroke(); ctx.setLineDash([]);
    const sX0=sailCX-sailW2*0.5, sX1=sailCX+sailW2*0.5;
    ctx.strokeStyle='rgba(140,170,220,0.55)'; ctx.lineWidth=U(1.5); ctx.beginPath();
    ctx.moveTo(sX0+U(8),sailBot2); ctx.lineTo(sX0+U(8),sailTop2+U(8));
    ctx.bezierCurveTo(sX0+U(8),sailTop2,sX0+U(20),sailTop2,sX0+U(24),sailTop2);
    ctx.lineTo(sX1-U(10),sailTop2); ctx.lineTo(sX1,sailTop2+U(16)); ctx.lineTo(sX1,sailBot2); ctx.stroke();
    const finX=phX1+ohR*0.7;
    ctx.strokeStyle='rgba(110,140,190,0.40)'; ctx.lineWidth=U(1);
    ctx.beginPath(); ctx.moveTo(finX,ohTop+U(6)); ctx.lineTo(finX+U(16),ohTop+U(2)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(finX,ohBot-U(6)); ctx.lineTo(finX+U(16),ohBot-U(2)); ctx.stroke();
    const prX=phX1+ohR-U(3),prY=phMid,prR2=U(8);
    ctx.strokeStyle='rgba(140,170,220,0.60)'; ctx.lineWidth=U(1.5);
    for(let a=0;a<3;a++){ const ang=a*Math.PI/3; ctx.beginPath(); ctx.moveTo(prX+Math.cos(ang)*prR2*0.3,prY+Math.sin(ang)*prR2*0.3); ctx.bezierCurveTo(prX+Math.cos(ang+0.8)*prR2,prY+Math.sin(ang+0.8)*prR2,prX+Math.cos(ang+1.0)*prR2,prY+Math.sin(ang+1.0)*prR2,prX+Math.cos(ang+1.2)*prR2,prY+Math.sin(ang+1.2)*prR2); ctx.moveTo(prX+Math.cos(ang+Math.PI)*prR2*0.3,prY+Math.sin(ang+Math.PI)*prR2*0.3); ctx.bezierCurveTo(prX+Math.cos(ang+Math.PI+0.8)*prR2,prY+Math.sin(ang+Math.PI+0.8)*prR2,prX+Math.cos(ang+Math.PI+1.0)*prR2,prY+Math.sin(ang+Math.PI+1.0)*prR2,prX+Math.cos(ang+Math.PI+1.2)*prR2,prY+Math.sin(ang+Math.PI+1.2)*prR2); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(prX,prY,U(2.5),0,Math.PI*2); ctx.stroke(); ctx.restore();

    for(let ci=0;ci<6;ci++){ const comp=compKeys[ci]; const cs=cState[ci]; const cx2=compXs[ci], cw=compWs[ci]; const fx=ci===0?cx2-phR:cx2, fw=(ci===0||ci===5)?cw+phR:cw;
      for(let di=0;di<3;di++){ const dTop=deckTops[di]; ctx.save(); dsphPill(); ctx.clip();
        ctx.fillStyle=cs.isFlooded?'rgba(8,18,70,0.98)':(stFill[cs.worst]||stFill.nominal); ctx.fillRect(fx,dTop,fw,dH);
        if(cs.wi>0){ const gc=['','rgba(220,170,20,0.13)','rgba(220,80,20,0.17)','rgba(200,30,30,0.22)']; ctx.fillStyle=gc[cs.wi]||''; ctx.fillRect(fx,dTop,fw,dH); }
        const ff=deckFloodFrac(cs.flood,cs.isFlooded,di);
        if(ff>0){ const fH=dH*ff; ctx.fillStyle=`rgba(28,75,200,${0.30+ff*0.46})`; ctx.fillRect(fx,dTop+dH-fH,fw,fH); if(ff<0.99&&ff>0.01){ ctx.strokeStyle='rgba(100,160,255,0.60)'; ctx.lineWidth=U(1); ctx.beginPath(); ctx.moveTo(fx,dTop+dH-fH); ctx.lineTo(fx+fw,dTop+dH-fH); ctx.stroke(); } }
        ctx.restore();
    } }

    dsphPill(); ctx.strokeStyle='rgba(80,120,180,0.50)'; ctx.lineWidth=U(1.5); ctx.stroke();

    ctx.save(); dsphPill(); ctx.clip();
    for(let ci=0;ci<6;ci++){ const comp=compKeys[ci]; const cs=cState[ci]; const cx2=compXs[ci], cw=compWs[ci]; const drenchLvl2=dmg._fireDrench?.[comp]?.level??0;
      for(const b of (getCompLayout(comp))){ const rids=Array.isArray(b.rid)?b.rid:[b.rid]; const fire=Math.max(...rids.map(rid=>dmg.fire?.[rid]||0)); if(fire>0.02&&drenchLvl2<1){ ctx.fillStyle=`rgba(200,80,0,${(0.11+fire*0.20)*(1-drenchLvl2)})`; ctx.fillRect(cx2+cw*(b.c/3), deckTops[b.d], cw*(b.cs/3), dH*b.ds); } }
      if(drenchLvl2>0){ const hullTop=deckTops[0], hullBot=deckTops[2]+dH; const fillH=(hullBot-hullTop)*drenchLvl2; const x0=ci===0?cx2-phR:cx2, w0=(ci===0||ci===5)?cw+phR:cw; ctx.fillStyle=`rgba(0,210,190,${0.18+drenchLvl2*0.32})`; ctx.fillRect(x0, hullBot-fillH, w0, fillH); }
    } ctx.restore();

    ctx.save(); dsphPill(); ctx.clip(); ctx.strokeStyle='rgba(70,100,150,0.50)'; ctx.lineWidth=U(1);
    for(let di=1;di<3;di++){ const y=deckTops[di]; for(let ci=0;ci<6;ci++){ const comp=compKeys[ci]; const x0=ci===0?compXs[0]-phR:compXs[ci]; const x1=ci===5?compXs[5]+compWs[5]+phR:compXs[ci]+compWs[ci]; const spans=(getCompLayout(comp)).some(b=>b.d<di && b.d+b.ds>di); if(!spans){ ctx.beginPath(); ctx.moveTo(x0,y); ctx.lineTo(x1,y); ctx.stroke(); } } } ctx.restore();

    ctx.save(); dsphPill(); ctx.clip();
    for(let ci=1;ci<6;ci++){ const x=compXs[ci]; const stA=DMG.effectiveState(DMG.activeSystems(compKeys[ci-1])[0],dmg)||'nominal'; const stB=DMG.effectiveState(DMG.activeSystems(compKeys[ci])[0],dmg)||'nominal'; const wDiv=Math.max(DMG.STATES.indexOf(stA),DMG.STATES.indexOf(stB)); ctx.strokeStyle=['rgba(50,120,65,0.55)','rgba(160,130,20,0.65)','rgba(160,60,20,0.75)','rgba(150,30,30,0.85)'][wDiv]||'rgba(60,90,140,0.50)'; ctx.lineWidth=U(1.5); ctx.beginPath(); ctx.moveTo(x,phTop); ctx.lineTo(x,phBot); ctx.stroke(); } ctx.restore();

    ctx.save(); dsphPill(); ctx.clip(); ctx.strokeStyle='rgba(50,80,120,0.40)'; ctx.lineWidth=U(0.75);
    for(let ci=0;ci<6;ci++){ const comp=compKeys[ci]; const cx2=compXs[ci], cw=compWs[ci]; for(const b of (getCompLayout(comp))){ if(b.c+b.cs>=3) continue; const x=cx2+cw*(b.c+b.cs)/3; const y0=deckTops[b.d]+U(1); const y1=deckTops[b.d]+dH*b.ds-U(1); ctx.beginPath(); ctx.moveTo(x,y0); ctx.lineTo(x,y1); ctx.stroke(); } } ctx.restore();

    { const wtd=dmg.wtd||{}; const hydOk=(dmg.systems?.hyd_main||'nominal')!=='destroyed'; const wtdBtnW=U(14), wtdBarW=U(5), wtdBarH=phBot-phTop;
      ctx.save(); dsphPill(); ctx.clip();
      for(let ci=1;ci<=5;ci++){ const [sA,sB]=DMG.WTD_PAIRS[ci-1]; const key=sA+'|'+sB; const state=wtd[key]||'open'; const x=compXs[ci]; let barCol; if(!hydOk&&state==='open') barCol='rgba(200,160,40,0.60)'; else if(!hydOk) barCol='rgba(180,80,40,0.75)'; else if(state==='closed') barCol='rgba(180,50,30,0.80)'; else barCol='rgba(20,160,70,0.28)'; ctx.fillStyle=barCol; ctx.fillRect(x-wtdBarW*0.5, phTop, wtdBarW, wtdBarH); if(state==='closed'){ ctx.strokeStyle='rgba(255,210,190,0.88)'; ctx.lineWidth=U(1.5); const bMid=d2Top+dH*0.5; ctx.beginPath(); ctx.moveTo(x-U(5),bMid); ctx.lineTo(x+U(5),bMid); ctx.stroke(); } }
      ctx.restore();
      for(let ci=1;ci<=5;ci++){ const [sA,sB]=DMG.WTD_PAIRS[ci-1]; const x=compXs[ci]; const _sA=sA, _sB=sB; PNL.btn2(ctx,'',x-wtdBtnW*0.5,phTop,wtdBtnW,wtdBarH,'transparent',()=>DMG.toggleWTD(_sA,_sB)); }
    }

    ctx.fillStyle='rgba(80,110,160,0.55)'; ctx.font=`${U(8)}px ui-monospace,monospace`; ctx.textAlign='right';
    ctx.fillText('D1',phX0-phR-U(3),d1Top+dH*0.65); ctx.fillText('D2',phX0-phR-U(3),d2Top+dH*0.65); ctx.fillText('D3',phX0-phR-U(3),d3Top+dH*0.65);

    ctx.save(); dsphPill(); ctx.clip();
    for(let ci=0;ci<6;ci++){ const comp=compKeys[ci]; const cs=cState[ci]; const cx2=compXs[ci],cw=compWs[ci],cMid=cx2+cw*0.5;
      ctx.fillStyle='rgba(200,220,255,0.92)'; ctx.font=`bold ${U(11)}px ui-monospace,monospace`; ctx.textAlign='center'; ctx.fillText(compLabels[ci],cMid,d1Top+U(14));
      for(const b of (getCompLayout(comp))){ const bx=cx2+cw*(b.c/3); const by=deckTops[b.d]; const bw=cw*(b.cs/3); const bh=dH*b.ds; let anyVisible=false; for(let di=b.d;di<b.d+b.ds;di++) if(deckFloodFrac(cs.flood,cs.isFlooded,di)<0.95) anyVisible=true; if(!anyVisible) continue; ctx.fillStyle='rgba(150,185,225,0.70)'; ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.textAlign='center'; ctx.fillText(b.lbl, bx+bw*0.5, by+bh*0.5); const rids=Array.isArray(b.rid)?b.rid:[b.rid]; const roomCrew=rids.reduce((sum,rid)=>(DMG.ROOMS[rid]?.crew||0)+sum,0); if(roomCrew>0){ ctx.globalAlpha=0.45; ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.fillText(`crew: ${roomCrew}`, bx+bw*0.5, by+bh*0.5+U(12)); ctx.globalAlpha=1.0; } }
      const d2Mid=d2Top+dH*0.56; const drenchLvl3=dmg._fireDrench?.[comp]?.level??0;
      if(cs.isFlooded){ ctx.fillStyle='rgba(140,180,255,0.95)'; ctx.font=`bold ${U(11)}px ui-monospace,monospace`; ctx.fillText('FLOODED',cMid,d2Mid);
      } else if(drenchLvl3>0){ ctx.fillStyle=drenchLvl3>=1?'rgba(0,240,220,0.95)':'rgba(0,210,190,0.90)'; ctx.font=`bold ${U(10)}px ui-monospace,monospace`; ctx.fillText(`N2 ${Math.round(drenchLvl3*100)}%`,cMid,d2Mid);
      } else if(cs.fireLevel>0.02){ const fireDi=[0,1,2].reduce((best,di)=>cs.fires[di]>cs.fires[best]?di:best,0); const fireDeckMid=deckTops[fireDi]+dH*0.56; ctx.fillStyle=cs.fireLevel>0.85?'rgba(255,80,20,0.95)':'rgba(255,140,40,0.90)'; ctx.font=`bold ${U(10)}px ui-monospace,monospace`; ctx.fillText(`FIRE ${Math.round(cs.fireLevel*100)}%`,cMid,fireDeckMid);
      } else if(cs.flood>0.02){ ctx.fillStyle='rgba(140,190,255,0.90)'; ctx.font=`${U(10)}px ui-monospace,monospace`; ctx.fillText(`${Math.round(cs.flood*100)}%`,cMid,d2Mid);
      } else if(cs.wi>0){ const stColD={degraded:'rgba(230,170,20,0.80)',offline:'rgba(230,90,30,0.85)',destroyed:'rgba(200,50,50,0.90)'}; ctx.fillStyle=stColD[cs.worst]||''; ctx.font=`bold ${U(10)}px ui-monospace,monospace`; ctx.fillText(cs.worst.toUpperCase(),cMid,d2Mid); }
    } ctx.restore();
    cy=schY+schH+U(10);

    { const teamList2=[dmg.teams?.alpha,dmg.teams?.bravo].filter(Boolean); const dispBtnH=U(22),dispGap=U(3),labelW=phX0-schX;
      for(let ti=0;ti<teamList2.length;ti++){ const team=teamList2[ti]; const rowY=cy+ti*(dispBtnH+dispGap+U(2)); const isReady=team.state==='ready'; const isMusteringEmerg2=team._readyT>0; const isLocked2=team._locked;
        const tLabelCol=team.state==='lost'?'rgba(180,30,30,0.80)':isMusteringEmerg2?'rgba(170,100,0,0.80)':team.state==='mustering'?'rgba(160,110,15,0.75)':isReady?'rgba(80,80,90,0.70)':team.task==='flood'?'rgba(30,70,160,0.75)':'rgba(30,100,50,0.75)';
        ctx.fillStyle=tLabelCol; ctx.beginPath(); ctx.roundRect(schX,rowY,labelW-dispGap,dispBtnH,U(3)); ctx.fill();
        ctx.fillStyle='rgba(220,220,240,0.90)'; ctx.font=`bold ${U(9)}px ui-monospace,monospace`; ctx.textAlign='center';
        const pillTxt2=isMusteringEmerg2?`MSTR ${Math.ceil(team._readyT)}s`:isLocked2?team.label.replace('DC ','')+' \u{1F512}':team.label.replace('DC ','');
        ctx.fillText(pillTxt2,schX+(labelW-dispGap)/2,rowY+dispBtnH*0.68);
        for(let ci=0;ci<6;ci++){ const comp=compKeys[ci]; const bx=compXs[ci]+dispGap/2,bw=compWs[ci]-dispGap; const lbl=compLabels[ci].slice(0,3);
          const isOnScene=team.state==='on_scene'&&DMG.roomSection(team.location)===comp; const isInTransit=team.state==='transit'&&team.destination===comp; const isMustering2=team.state==='mustering'&&team.destination===comp;
          const isFloodedD=dmg.flooded[comp]; const fireLevelD=Math.max(...(DMG.SECTION_ROOMS[comp]||[]).map(rid=>dmg.fire?.[rid]||0)),hasFireD=fireLevelD>0.02; const isDrenchedD=!!dmg._fireDrench?.[comp];
          let bCol,bLabel,clickFn;
          if(team.state==='lost'){ bCol='rgba(30,30,30,0.22)'; bLabel=lbl; clickFn=null; }
          else if(team.state==='blowing'&&DMG.roomSection(team.location)===comp){ bCol='rgba(180,90,0,0.85)'; bLabel='BLOW'; clickFn=()=>DMG.recallTeam(team.id); }
          else if(isDrenchedD){ bCol='rgba(40,40,50,0.45)'; bLabel='N2'; clickFn=null; }
          else if(isFloodedD){ const isBlowingHere=(team.state==='blowing'&&DMG.roomSection(team.location)===comp)||(team.state==='transit'&&team.destination===comp); if(isBlowingHere){ bCol='rgba(180,90,0,0.85)'; bLabel='BLOW \u25a0'; clickFn=()=>DMG.recallTeam(team.id); } else { bCol='rgba(60,30,10,0.70)'; bLabel='BLOW?'; clickFn=()=>DMG.assignTeam(team.id,comp); } }
          else if(hasFireD&&isOnScene&&team.task==='fire'){ bCol='rgba(160,50,10,0.85)'; bLabel='FIRE \u25a0'; clickFn=()=>DMG.recallTeam(team.id); }
          else if(hasFireD&&isInTransit){ bCol='rgba(130,55,10,0.80)'; bLabel='\u2192FIRE'; clickFn=()=>DMG.recallTeam(team.id); }
          else if(hasFireD){ bCol='rgba(140,40,5,0.75)'; bLabel='FIRE'; clickFn=()=>DMG.assignTeam(team.id,comp); }
          else if(isOnScene){ bCol='rgba(20,90,40,0.85)'; bLabel=lbl+' \u2713'; clickFn=()=>DMG.recallTeam(team.id); }
          else if(isMustering2){ bCol='rgba(160,110,15,0.75)'; bLabel='MSTR '+lbl; clickFn=()=>DMG.recallTeam(team.id); }
          else if(isInTransit){ bCol='rgba(120,95,15,0.80)'; bLabel='\u2192'+lbl; clickFn=()=>DMG.recallTeam(team.id); }
          else { bCol='rgba(25,45,105,0.65)'; bLabel=lbl; clickFn=()=>DMG.assignTeam(team.id,comp); }
          PNL.btn2(ctx,bLabel,bx,rowY,bw,dispBtnH,bCol,clickFn||(()=>{}));
        }
      } cy+=teamList2.length*(dispBtnH+dispGap+U(2))+U(6); }

    const stColText={'nominal':'rgba(80,200,100,0.80)','degraded':'rgba(230,170,20,0.90)','offline':'rgba(230,90,30,0.90)','destroyed':'rgba(200,50,50,0.95)'};
    let sysMaxY=cy;
    for(let ci=0;ci<6;ci++){ const comp=compKeys[ci],cx2=compXs[ci],cw=compWs[ci]; const sysList=DMG.activeSystems(comp); let sy=cy; for(const sys of sysList){ const st=DMG.effectiveState(sys,dmg); ctx.fillStyle='rgba(160,180,220,0.70)'; ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.textAlign='center'; ctx.fillText(DMG.SYS_LABEL[sys]||sys,cx2+cw/2,sy); sy+=U(12); ctx.fillStyle=stColText[st]||stColText.destroyed; ctx.font=`bold ${U(9)}px ui-monospace,monospace`; ctx.fillText(st.toUpperCase(),cx2+cw/2,sy); sy+=U(10); } sysMaxY=Math.max(sysMaxY,sy); }
    cy=sysMaxY+U(10);

    ctx.fillStyle='rgba(120,140,180,0.50)'; ctx.font=`${U(10)}px ui-monospace,monospace`; ctx.textAlign='left'; ctx.fillText('ESCAPE',P,cy); cy+=U(6);
    const halfEsc=(LW-P*2-U(6))/2; const tceViable=DMG.canTCE(),escActive=!!dmg.escapeState;
    PNL.btn2(ctx,escActive?'ESCAPING\u2026':'TCE ESCAPE',P,cy,halfEsc,U(18),escActive?'rgba(30,80,30,0.50)':tceViable?'rgba(20,60,20,0.70)':'rgba(60,60,60,0.30)',()=>{ if(!escActive&&tceViable) DMG.initiateEscape('tce'); });
    PNL.btn2(ctx,escActive?'ESCAPING\u2026':'RUSH ESCAPE',P+halfEsc+U(6),cy,halfEsc,U(18),escActive?'rgba(80,30,30,0.50)':'rgba(100,30,10,0.70)',()=>{ if(!escActive) DMG.initiateEscape('rush'); });
    const depthM=Math.round(player.depth||0); const depthAdv=depthM<=120?'TCE & RUSH viable':depthM<=200?'TCE marginal':'TCE not viable';
    const depthAdvCol=depthM<=120?'rgba(80,200,80,0.70)':depthM<=200?'rgba(220,170,20,0.80)':'rgba(220,80,50,0.80)';
    ctx.fillStyle=depthAdvCol; ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.textAlign='center'; ctx.fillText(`${depthM}m \u2014 ${depthAdv}`,LW/2,cy+U(30)); cy+=U(36);

    const hasSealTargets=DMG.COMPS.some(comp=>!dmg.flooded[comp]&&(dmg.flooding[comp]||0)>0.05);
    if(hasSealTargets){ ctx.fillStyle='rgba(80,100,140,0.40)'; ctx.font=`${U(8)}px ui-monospace,monospace`; ctx.textAlign='left'; ctx.fillText('SEAL (last resort \u2014 kills all crew inside):',P,cy); cy+=U(6); for(let ci=0;ci<6;ci++){ const comp=compKeys[ci],cx2=compXs[ci],cw=compWs[ci]; if(!dmg.flooded[comp]&&(dmg.flooding[comp]||0)>0.05) PNL.btn2(ctx,compLabels[ci].slice(0,3),cx2+2,cy,cw-4,U(14),'rgba(100,30,30,0.60)',()=>DMG.sealFlooding(comp)); } cy+=U(18); }

    if(session.debugOverlay){ ctx.fillStyle='rgba(200,50,50,0.60)'; ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.textAlign='left'; ctx.fillText('[ DEBUG ] HIT:',P,cy-U(2)); const dbgW=(LW-P*2-U(4))/6; for(let i=0;i<6;i++){ const comp=DMG.COMPS[i],isHit=(dmg.strikes[comp]||0)>=1; PNL.btn2(ctx,compLabels[i].slice(0,3),P+i*dbgW,cy,dbgW-U(3),U(14),isHit?'rgba(180,30,30,0.80)':'rgba(100,30,30,0.55)',()=>DMG.hit(55,null,null,comp)); } }

    const SPLIT_Y=Math.min(cy+U(4), Math.round(H*0.74));
    ctx.strokeStyle='rgba(60,100,160,0.30)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(0,SPLIT_Y); ctx.lineTo(W,SPLIT_Y); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.rect(0,SPLIT_Y,W,H-SPLIT_Y); ctx.clip();

    const d=player.damage; let ry2=SPLIT_Y+U(10);
    ctx.fillStyle='rgba(130,168,232,0.82)'; ctx.font=`bold ${U(12)}px ui-monospace,monospace`; ctx.textAlign='left'; ctx.fillText("SHIP'S COMPANY",P,ry2);
    const sumX=U(172); ctx.font=`${U(11)}px ui-monospace,monospace`;
    ctx.fillStyle='rgba(60,200,90,0.85)'; ctx.fillText(`FIT ${fit}`,sumX,ry2); ctx.fillStyle='rgba(230,170,30,0.90)'; ctx.fillText(`WND ${wnd}`,sumX+U(56),ry2); ctx.fillStyle='rgba(210,50,50,0.90)'; ctx.fillText(`KIA ${kia}`,sumX+U(112),ry2); ctx.fillStyle='rgba(140,165,210,0.55)'; ctx.fillText(`/ ${total}`,sumX+U(168),ry2);
    ry2+=U(16); ctx.strokeStyle='rgba(60,100,160,0.20)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(P,ry2); ctx.lineTo(W-P,ry2); ctx.stroke(); ry2+=U(8);

    const nCols2=6, colGap2=U(6); const colW2=(W-P*2-colGap2*(nCols2-1))/nCols2;
    const COMP_LABELS2={fore_ends:'TORPEDO ROOM',control_room:'CONTROL ROOM',aux_section:'AUX / MESS',reactor_comp:'REACTOR COMP',engine_room:'ENGINE ROOM',aft_ends:'AFT ENDS'};
    const SUPPORT_DEPTS2=new Set(['medical','supply']); const ROW_H2=U(13), SEC_HDR2=U(18);
    const STATUS_COL2={fit:'rgba(50,190,80,0.90)',wounded:'rgba(230,165,25,0.90)',killed:'rgba(200,40,40,0.75)'};
    const _hoverHits2=[]; const mx2=L.I?.mouseX||0, my2=L.I?.mouseY||0;

    function drawCrewRow2(m,rx,ry,subW,isDuty){ const isKia=m.status==='killed',isWnd=m.status==='wounded'; const isOnWatch2=m.watch==='duty'||m.watch===activeWatch; ctx.globalAlpha=isKia?0.35:isOnWatch2?1.0:0.55; const pillW2=U(28), rowTop2=ry-ROW_H2*0.82; ctx.fillStyle=STATUS_COL2[m.status]||STATUS_COL2.fit; ctx.beginPath(); ctx.arc(rx+U(4),ry-U(3),U(3),0,Math.PI*2); ctx.fill(); ctx.fillStyle=isWnd?'rgba(200,140,20,0.70)':isKia?'rgba(140,20,20,0.50)':'rgba(30,55,100,0.65)'; ctx.beginPath(); ctx.roundRect(rx+U(10),rowTop2,pillW2,ROW_H2*0.85,U(2)); ctx.fill(); ctx.fillStyle='rgba(200,220,255,0.90)'; ctx.font=`bold ${U(8)}px ui-monospace,monospace`; ctx.textAlign='center'; ctx.fillText(m.rating,rx+U(10)+pillW2/2,ry-U(2)); ctx.fillStyle=isKia?'rgba(180,60,60,0.60)':isWnd?'rgba(220,165,30,0.90)':'rgba(200,215,245,0.90)'; ctx.font=`${U(10)}px ui-monospace,monospace`; ctx.textAlign='left'; ctx.fillText(`${m.firstName[0]}.${m.lastName}`,rx+U(42),ry-U(2)); const badgesW2=isDuty?U(18):U(32); ctx.fillStyle='rgba(120,170,220,0.70)'; ctx.font=`${U(8)}px ui-monospace,monospace`; ctx.textAlign='right'; ctx.fillText(m.role||'',rx+subW-badgesW2-U(3),ry-U(2)); const badgeX2=rx+subW-badgesW2; const wBg2=m.watch==='duty'?'rgba(160,120,20,0.65)':m.watch==='A'?'rgba(25,55,130,0.65)':'rgba(10,90,80,0.65)'; const wFg2=m.watch==='duty'?'rgba(255,210,60,0.95)':m.watch==='A'?'rgba(120,170,255,0.95)':'rgba(60,210,185,0.95)'; ctx.fillStyle=wBg2; ctx.beginPath(); ctx.roundRect(badgeX2,rowTop2,U(14),ROW_H2*0.80,U(2)); ctx.fill(); ctx.fillStyle=wFg2; ctx.font=`bold ${U(7)}px ui-monospace,monospace`; ctx.textAlign='center'; ctx.fillText(m.watch==='duty'?'\u2605':m.watch,badgeX2+U(7),ry-U(2)); if(m.dcTeam){ const dcX2=badgeX2+U(16); ctx.fillStyle=m.dcTeam==='alpha'?'rgba(140,40,130,0.65)':'rgba(40,100,40,0.65)'; ctx.beginPath(); ctx.roundRect(dcX2,rowTop2,U(14),ROW_H2*0.80,U(2)); ctx.fill(); ctx.fillStyle=m.dcTeam==='alpha'?'rgba(230,140,220,0.95)':'rgba(120,230,120,0.95)'; ctx.font=`bold ${U(7)}px ui-monospace,monospace`; ctx.textAlign='center'; ctx.fillText(m.dcTeam==='alpha'?'\u03b1':'\u03b2',dcX2+U(7),ry-U(2)); } ctx.globalAlpha=1.0; if(m.roleDesc) _hoverHits2.push({x:rx,y:rowTop2,w:subW,h:ROW_H2,tip:m.roleDesc}); }

    function drawCompSection2(comp,sx,sy,availW){ const crew2=DMG.COMPS.flatMap(s=>d.crew[s]||[]).filter(m=>m.stationComp===comp&&!SUPPORT_DEPTS2.has(m.dept)); const fitC2=crew2.filter(c=>c.status==='fit'&&!c.displaced).length; const wndC2=crew2.filter(c=>c.status==='wounded').length; const kiaC2=crew2.filter(c=>c.status==='killed').length; const hasFF2=[0,1,2].some(di=>(d.fire?.[`${comp}_d${di}`]||0)>0.02)||d.flooded?.[comp]||(d.flooding?.[comp]||0)>0.01; ctx.fillStyle=hasFF2?'rgba(100,30,10,0.55)':'rgba(20,38,70,0.60)'; ctx.beginPath(); ctx.roundRect(sx,sy,availW,SEC_HDR2,U(2)); ctx.fill(); ctx.fillStyle='rgba(180,210,255,0.90)'; ctx.font=`bold ${U(10)}px ui-monospace,monospace`; ctx.textAlign='left'; ctx.fillText(COMP_LABELS2[comp],sx+U(5),sy+SEC_HDR2*0.72); ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.textAlign='right'; const sumStr2=kiaC2>0?`${fitC2}f ${wndC2}w ${kiaC2}k`:`${fitC2}/${crew2.length}`; ctx.fillStyle=kiaC2>0?'rgba(210,60,60,0.85)':wndC2>0?'rgba(220,160,30,0.80)':'rgba(80,190,100,0.70)'; ctx.fillText(sumStr2,sx+availW-U(5),sy+SEC_HDR2*0.72); sy+=SEC_HDR2+U(2); if(crew2.length===0) return sy+U(4); const dutyList2=crew2.filter(m=>m.watch==='duty'); const watchB2=crew2.filter(m=>m.watch==='B'), watchA2=crew2.filter(m=>m.watch==='A'); const subW2=(availW-U(3))/2; for(let i=0;i<dutyList2.length;i++){ ctx.fillStyle='rgba(140,110,10,0.12)'; ctx.fillRect(sx,sy+i*ROW_H2,availW,ROW_H2-1); drawCrewRow2(dutyList2[i],sx,sy+i*ROW_H2+ROW_H2*0.82,availW,true); } if(dutyList2.length) sy+=dutyList2.length*ROW_H2+U(2); if(watchB2.length||watchA2.length){ ctx.font=`bold ${U(7)}px ui-monospace,monospace`; ctx.textAlign='center'; ctx.fillStyle=activeWatch==='B'?'rgba(60,210,185,0.80)':'rgba(60,210,185,0.35)'; ctx.fillText('WCH B',sx+subW2/2,sy+U(8)); ctx.fillStyle=activeWatch==='A'?'rgba(120,170,255,0.80)':'rgba(120,170,255,0.35)'; ctx.fillText('WCH A',sx+subW2+U(3)+subW2/2,sy+U(8)); sy+=U(11); } const rows2=Math.max(watchB2.length,watchA2.length); for(let i=0;i<watchB2.length;i++) drawCrewRow2(watchB2[i],sx,sy+i*ROW_H2+ROW_H2*0.82,subW2,false); for(let i=0;i<watchA2.length;i++) drawCrewRow2(watchA2[i],sx+subW2+U(3),sy+i*ROW_H2+ROW_H2*0.82,subW2,false); return sy+rows2*ROW_H2+U(6); }

    function drawSupportSection2(sx,sy,availW){ const allSupport2=[]; for(const comp of DMG.COMPS){ for(const m of (d.crew[comp]||[])) if(SUPPORT_DEPTS2.has(m.dept)) allSupport2.push(m); } if(allSupport2.length===0) return sy; const fitC2=allSupport2.filter(c=>c.status==='fit').length; const kiaC2=allSupport2.filter(c=>c.status==='killed').length; ctx.fillStyle='rgba(20,38,70,0.60)'; ctx.beginPath(); ctx.roundRect(sx,sy,availW,SEC_HDR2,U(2)); ctx.fill(); ctx.fillStyle='rgba(180,210,255,0.90)'; ctx.font=`bold ${U(10)}px ui-monospace,monospace`; ctx.textAlign='left'; ctx.fillText('SHIP SUPPORT',sx+U(5),sy+SEC_HDR2*0.72); ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.textAlign='right'; ctx.fillStyle=kiaC2>0?'rgba(210,60,60,0.85)':'rgba(80,190,100,0.70)'; ctx.fillText(`${fitC2}/${allSupport2.length}`,sx+availW-U(5),sy+SEC_HDR2*0.72); sy+=SEC_HDR2+U(2); for(const dept of ['medical','supply']){ const crew2=allSupport2.filter(m=>m.dept===dept); if(crew2.length===0) continue; ctx.fillStyle='rgba(100,130,180,0.50)'; ctx.font=`bold ${U(7)}px ui-monospace,monospace`; ctx.textAlign='left'; ctx.fillText(dept==='medical'?'MEDICAL':'SUPPLY',sx+U(5),sy+U(7)); sy+=U(10); const dutyList2=crew2.filter(m=>m.watch==='duty'); const watchB2=crew2.filter(m=>m.watch==='B'), watchA2=crew2.filter(m=>m.watch==='A'); const subW2=(availW-U(3))/2; for(let i=0;i<dutyList2.length;i++){ ctx.fillStyle='rgba(140,110,10,0.12)'; ctx.fillRect(sx,sy+i*ROW_H2,availW,ROW_H2-1); drawCrewRow2(dutyList2[i],sx,sy+i*ROW_H2+ROW_H2*0.82,availW,true); } if(dutyList2.length) sy+=dutyList2.length*ROW_H2+U(2); const rows2=Math.max(watchB2.length,watchA2.length); for(let i=0;i<watchB2.length;i++) drawCrewRow2(watchB2[i],sx,sy+i*ROW_H2+ROW_H2*0.82,subW2,false); for(let i=0;i<watchA2.length;i++) drawCrewRow2(watchA2[i],sx+subW2+U(3),sy+i*ROW_H2+ROW_H2*0.82,subW2,false); sy+=rows2*ROW_H2+U(4); } return sy+U(2); }

    for(let ci=0;ci<6;ci++){ const comp=DMG.COMPS[ci]; const cx3=P+ci*(colW2+colGap2); const colEnd=drawCompSection2(comp,cx3,ry2,colW2); if(ci===5) drawSupportSection2(cx3,colEnd+U(4),colW2); }
    ctx.restore();

    for(const h of _hoverHits2){ if(mx2>=h.x&&mx2<=h.x+h.w&&my2>=h.y&&my2<=h.y+h.h){ const tip=h.tip; ctx.font=`${U(11)}px ui-monospace,monospace`; const tw=ctx.measureText(tip).width+U(12), th=U(16); let tx2=mx2+U(10), ty2=my2-U(4); if(tx2+tw>W) tx2=mx2-tw-U(4); if(ty2+th>H) ty2=my2-th-U(4); ctx.fillStyle='rgba(5,12,30,0.94)'; ctx.strokeStyle='rgba(80,140,220,0.55)'; ctx.lineWidth=1; ctx.beginPath(); ctx.roundRect(tx2,ty2,tw,th,U(3)); ctx.fill(); ctx.stroke(); ctx.fillStyle='rgba(200,220,255,0.95)'; ctx.textAlign='left'; ctx.fillText(tip,tx2+U(6),ty2+th*0.72); break; } }
  }
