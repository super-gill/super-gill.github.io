// render-crew.js — drawCrewPanel with helpers drawCrewRow, drawCompSection, drawSupportSection
'use strict';

import { player, session, ui, L, C } from './panel-context.js';

  // ── Crew Manifest Panel ───────────────────────────────────────────────────────
  export function drawCrewPanel(W,H,panelH){
    const ctx = L.ctx;
    const {U} = L.R;
    const DMG=L.DMG;
    const PNL=L.PANEL;
    if(!ui.showCrewPanel||ui.showDamageScreen) return;
    const d=player.damage;
    if(!d) return;

    const OW=U(820), OH=U(740);
    const OX=Math.round(W/2-OW/2), OY=Math.round(H/2-OH/2);
    const P=U(12);

    ctx.fillStyle='rgba(6,12,22,0.97)';
    ctx.strokeStyle='rgba(60,100,160,0.40)';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.roundRect(OX,OY,OW,OH,U(6)); ctx.fill(); ctx.stroke();

    const activeWatch=session.activeWatch||'A';

    let cy=OY+P+U(14);
    ctx.fillStyle='rgba(140,180,240,0.92)';
    ctx.font=`bold ${U(15)}px ui-monospace,monospace`;
    ctx.textAlign='left';
    ctx.fillText("SHIP'S COMPANY",OX+P,cy);
    ctx.fillStyle='rgba(100,130,180,0.55)';
    ctx.font=`${U(10)}px ui-monospace,monospace`;
    ctx.textAlign='right';
    ctx.fillText('[Y] close',OX+OW-P,cy);

    cy+=U(20);
    const fatigue=session.watchFatigue||0;
    const changing=session.watchChanging||false;
    const changeT=session.watchChangeT||0;

    const watchLabel=changing?`WATCH ${activeWatch} \u2192 ${activeWatch==='A'?'B':'A'}`:`WATCH ${activeWatch} ON`;
    const watchBg=changing?'rgba(80,60,10,0.75)':activeWatch==='A'?'rgba(30,70,150,0.75)':'rgba(10,100,90,0.75)';
    const watchFg=changing?'rgba(255,200,60,0.95)':activeWatch==='A'?'rgba(140,190,255,0.95)':'rgba(80,220,200,0.95)';
    ctx.fillStyle=watchBg;
    ctx.beginPath(); ctx.roundRect(OX+P,cy-U(13),U(108),U(18),U(3)); ctx.fill();
    ctx.fillStyle=watchFg;
    ctx.font=`bold ${U(10)}px ui-monospace,monospace`;
    ctx.textAlign='center';
    ctx.fillText(watchLabel,OX+P+U(54),cy-U(1));

    const barX=OX+P+U(114), barY=cy-U(12), barW=U(120), barH=U(14);
    ctx.fillStyle='rgba(20,30,50,0.70)';
    ctx.beginPath(); ctx.roundRect(barX,barY,barW,barH,U(2)); ctx.fill();
    const fatigueCol=fatigue>=0.8?'rgba(210,60,40,0.85)':fatigue>=0.5?'rgba(220,160,30,0.85)':'rgba(50,180,80,0.75)';
    if(fatigue>0){
      ctx.fillStyle=fatigueCol;
      ctx.beginPath(); ctx.roundRect(barX+1,barY+1,Math.max(U(2),(barW-2)*fatigue),barH-2,U(2)); ctx.fill();
    }
    ctx.fillStyle='rgba(140,165,210,0.60)';
    ctx.font=`${U(8)}px ui-monospace,monospace`;
    ctx.textAlign='left';
    ctx.fillText('FATIGUE',barX+U(3),cy-U(2));
    ctx.textAlign='right';
    ctx.fillText(`${Math.round(fatigue*100)}%`,barX+barW-U(3),cy-U(2));

    if(changing){
      ctx.fillStyle='rgba(255,200,60,0.80)';
      ctx.font=`${U(9)}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillText(`RELIEVING \u2014 ${Math.ceil(changeT)}s`,barX+barW+U(8),cy-U(2));
    }

    const relBtnX=OX+OW-P-U(110);
    const canRelieve=!changing&&session.tacticalState!=='action'&&session.casualtyState!=='emergency';
    const relBg=canRelieve?'rgba(30,60,120,0.75)':'rgba(30,40,60,0.40)';
    const relFg=canRelieve?'rgba(140,190,255,0.90)':'rgba(80,100,130,0.50)';
    ctx.fillStyle=relBg;
    ctx.beginPath(); ctx.roundRect(relBtnX,cy-U(13),U(108),U(18),U(3)); ctx.fill();
    ctx.fillStyle=relFg;
    ctx.font=`bold ${U(9)}px ui-monospace,monospace`;
    ctx.textAlign='center';
    ctx.fillText(changing?'CHANGING\u2026':'RELIEVE WATCH [W]',relBtnX+U(54),cy-U(1));
    if(canRelieve){
      PNL.btn2(ctx,'',relBtnX,cy-U(13),U(108),U(18),'transparent',
        ()=>{ L.SIM?.initiateWatchChange?.(); });
    }

    cy+=U(10);

    const fit=DMG.totalFit(),wnd=DMG.totalWounded(),kia=DMG.totalKilled(),tot=DMG.totalCrew();
    ctx.font=`${U(12)}px ui-monospace,monospace`;
    ctx.textAlign='left';
    ctx.fillStyle='rgba(60,200,90,0.85)';   ctx.fillText(`FIT ${fit}`,  OX+P+U(112), cy-U(1));
    ctx.fillStyle='rgba(230,170,30,0.90)';  ctx.fillText(`WND ${wnd}`,  OX+P+U(184), cy-U(1));
    ctx.fillStyle='rgba(210,50,50,0.90)';   ctx.fillText(`KIA ${kia}`,  OX+P+U(256), cy-U(1));
    ctx.fillStyle='rgba(140,165,210,0.60)'; ctx.fillText(`/ ${tot}`,    OX+P+U(328), cy-U(1));
    cy+=U(8);

    ctx.strokeStyle='rgba(60,100,160,0.25)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(OX,cy); ctx.lineTo(OX+OW,cy); ctx.stroke();
    cy+=U(10);

    const colW=(OW-P*2-U(10))/2;
    const col0x=OX+P, col1x=OX+P+colW+U(10);

    const COMP_LABELS={
      fore_ends:'TORPEDO ROOM', control_room:'CONTROL ROOM', aux_section:'AUX MACHINERY',
      reactor_comp:C.player.isDiesel?'ENGINE COMP':'REACTOR COMP',
      engine_room:C.player.isDiesel?'MOTOR ROOM':'MANEUVERING',
      aft_ends:'ENGINEERING',
    };
    const SUPPORT_DEPTS=new Set(['medical','supply']);
    const leftComps=['fore_ends','control_room','aux_section','reactor_comp'];
    const rightComps=['engine_room','aft_ends'];

    const ROW_H=U(16);
    const SEC_HDR=U(20);

    const STATUS_COL={fit:'rgba(50,190,80,0.90)',wounded:'rgba(230,165,25,0.90)',killed:'rgba(200,40,40,0.75)'};

    const _hoverHits=[];
    const mx=session._mouseX||0, my=session._mouseY||0;

    function drawCrewRow(m, rx, ry, subW, isDuty){
      const isKia=m.status==='killed';
      const isWnd=m.status==='wounded';
      const isOnWatch=m.watch==='duty'||m.watch===activeWatch;
      ctx.globalAlpha=isKia?0.35:isOnWatch?1.0:0.55;

      const pillW=U(32);
      const rowTop=ry-ROW_H*0.82;

      ctx.fillStyle=STATUS_COL[m.status]||STATUS_COL.fit;
      ctx.beginPath(); ctx.arc(rx+U(5),ry-U(4),U(3.5),0,Math.PI*2); ctx.fill();

      ctx.fillStyle=isWnd?'rgba(200,140,20,0.70)':isKia?'rgba(140,20,20,0.50)':'rgba(30,55,100,0.65)';
      ctx.beginPath(); ctx.roundRect(rx+U(12),rowTop,pillW,ROW_H*0.85,U(2)); ctx.fill();
      ctx.fillStyle='rgba(200,220,255,0.90)';
      ctx.font=`bold ${U(9)}px ui-monospace,monospace`;
      ctx.textAlign='center';
      ctx.fillText(m.rating,rx+U(12)+pillW/2,ry-U(2));

      ctx.fillStyle=isKia?'rgba(180,60,60,0.60)':isWnd?'rgba(220,165,30,0.90)':'rgba(200,215,245,0.90)';
      ctx.font=`${U(11)}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillText(`${m.firstName[0]}.${m.lastName}`,rx+U(48),ry-U(2));

      const badgesW=isDuty?U(20):U(36);
      const roleX=rx+subW-badgesW-U(4);
      ctx.fillStyle='rgba(120,170,220,0.70)';
      ctx.font=`${U(9)}px ui-monospace,monospace`;
      ctx.textAlign='right';
      ctx.fillText(m.role||'',roleX,ry-U(2));

      const badgeX=rx+subW-badgesW;
      const watchBadgeBg=m.watch==='duty'?'rgba(160,120,20,0.65)':m.watch==='A'?'rgba(25,55,130,0.65)':'rgba(10,90,80,0.65)';
      const watchBadgeFg=m.watch==='duty'?'rgba(255,210,60,0.95)':m.watch==='A'?'rgba(120,170,255,0.95)':'rgba(60,210,185,0.95)';
      const watchBadgeLabel=m.watch==='duty'?'\u2605':m.watch;
      ctx.fillStyle=watchBadgeBg;
      ctx.beginPath(); ctx.roundRect(badgeX,rowTop,U(16),ROW_H*0.80,U(2)); ctx.fill();
      ctx.fillStyle=watchBadgeFg;
      ctx.font=`bold ${U(8)}px ui-monospace,monospace`;
      ctx.textAlign='center';
      ctx.fillText(watchBadgeLabel,badgeX+U(8),ry-U(2));

      if(m.dcTeam){
        const dcX=badgeX+U(18);
        const dcBg=m.dcTeam==='alpha'?'rgba(140,40,130,0.65)':'rgba(40,100,40,0.65)';
        const dcFg=m.dcTeam==='alpha'?'rgba(230,140,220,0.95)':'rgba(120,230,120,0.95)';
        ctx.fillStyle=dcBg;
        ctx.beginPath(); ctx.roundRect(dcX,rowTop,U(16),ROW_H*0.80,U(2)); ctx.fill();
        ctx.fillStyle=dcFg;
        ctx.font=`bold ${U(8)}px ui-monospace,monospace`;
        ctx.textAlign='center';
        ctx.fillText(m.dcTeam==='alpha'?'\u03b1':'\u03b2',dcX+U(8),ry-U(2));
      }

      ctx.globalAlpha=1.0;

      if(m.roleDesc){
        _hoverHits.push({x:rx,y:rowTop,w:subW,h:ROW_H,tip:m.roleDesc});
      }
    }

    function drawCompSection(comp, sx, sy, availW){
      const crew=(d.crew[comp]||[]).filter(m=>!SUPPORT_DEPTS.has(m.dept));
      const fitC=crew.filter(c=>c.status==='fit'&&!c.displaced).length;
      const wndC=crew.filter(c=>c.status==='wounded').length;
      const kiaC=crew.filter(c=>c.status==='killed').length;
      const hasFireOrFlood=[0,1,2].some(di=>(d.fire?.[`${comp}_d${di}`]||0)>0.02)||d.flooded?.[comp]||(d.flooding?.[comp]||0)>0.01;
      const hdrBg=hasFireOrFlood?'rgba(100,30,10,0.55)':'rgba(20,38,70,0.60)';
      ctx.fillStyle=hdrBg;
      ctx.beginPath(); ctx.roundRect(sx,sy,availW,SEC_HDR,U(2)); ctx.fill();
      ctx.fillStyle='rgba(180,210,255,0.90)';
      ctx.font=`bold ${U(11)}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillText(COMP_LABELS[comp],sx+U(6),sy+SEC_HDR*0.72);
      ctx.font=`${U(10)}px ui-monospace,monospace`;
      ctx.textAlign='right';
      const sumStr=kiaC>0?`${fitC} fit  ${wndC} wnd  ${kiaC} kia`:`${fitC}/${crew.length} fit`;
      ctx.fillStyle=kiaC>0?'rgba(210,60,60,0.85)':wndC>0?'rgba(220,160,30,0.80)':'rgba(80,190,100,0.70)';
      ctx.fillText(sumStr,sx+availW-U(6),sy+SEC_HDR*0.72);
      sy+=SEC_HDR+U(2);

      const dutyList=crew.filter(m=>m.watch==='duty');
      const watchB=crew.filter(m=>m.watch==='B');
      const watchA=crew.filter(m=>m.watch==='A');
      const subW=(availW-U(4))/2;

      for(let i=0;i<dutyList.length;i++){
        const m=dutyList[i];
        const ry=sy+i*ROW_H+ROW_H*0.82;
        ctx.fillStyle='rgba(140,110,10,0.12)';
        ctx.fillRect(sx,sy+i*ROW_H,availW,ROW_H-1);
        drawCrewRow(m, sx, ry, availW, true);
      }
      if(dutyList.length) sy+=dutyList.length*ROW_H+U(2);

      if(watchB.length||watchA.length){
        const activeWatchB=activeWatch==='B';
        const activeWatchA=activeWatch==='A';
        ctx.font=`bold ${U(8)}px ui-monospace,monospace`;
        ctx.textAlign='center';
        ctx.fillStyle=activeWatchB?'rgba(60,210,185,0.80)':'rgba(60,210,185,0.40)';
        ctx.fillText('\u2500\u2500 WCH B \u2500\u2500',sx+subW/2,sy+U(8));
        ctx.fillStyle=activeWatchA?'rgba(120,170,255,0.80)':'rgba(120,170,255,0.40)';
        ctx.fillText('\u2500\u2500 WCH A \u2500\u2500',sx+subW+U(4)+subW/2,sy+U(8));
        sy+=U(11);
      }

      const rows=Math.max(watchB.length,watchA.length);
      for(let i=0;i<watchB.length;i++){
        const m=watchB[i];
        const ry=sy+i*ROW_H+ROW_H*0.82;
        drawCrewRow(m, sx, ry, subW, false);
      }
      for(let i=0;i<watchA.length;i++){
        const m=watchA[i];
        const ry=sy+i*ROW_H+ROW_H*0.82;
        drawCrewRow(m, sx+subW+U(4), ry, subW, false);
      }

      return sy+rows*ROW_H+U(6);
    }

    function drawSupportSection(sx, sy, availW){
      const deptOrder=['medical','supply'];
      const deptLabel={medical:'MEDICAL', supply:'SUPPLY / CATERING'};
      const allSupport=[];
      for(const comp of ['fore_ends','control_room','aux_section','reactor_comp','engine_room','aft_ends']){
        for(const m of (d.crew[comp]||[])){
          if(SUPPORT_DEPTS.has(m.dept)) allSupport.push(m);
        }
      }
      if(allSupport.length===0) return sy;

      const fitC=allSupport.filter(c=>c.status==='fit').length;
      const wndC=allSupport.filter(c=>c.status==='wounded').length;
      const kiaC=allSupport.filter(c=>c.status==='killed').length;
      ctx.fillStyle='rgba(20,38,70,0.60)';
      ctx.beginPath(); ctx.roundRect(sx,sy,availW,SEC_HDR,U(2)); ctx.fill();
      ctx.fillStyle='rgba(180,210,255,0.90)';
      ctx.font=`bold ${U(11)}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillText('SHIP SUPPORT',sx+U(6),sy+SEC_HDR*0.72);
      ctx.font=`${U(10)}px ui-monospace,monospace`;
      ctx.textAlign='right';
      const sumStr=kiaC>0?`${fitC} fit  ${wndC} wnd  ${kiaC} kia`:`${fitC}/${allSupport.length} fit`;
      ctx.fillStyle=kiaC>0?'rgba(210,60,60,0.85)':wndC>0?'rgba(220,160,30,0.80)':'rgba(80,190,100,0.70)';
      ctx.fillText(sumStr,sx+availW-U(6),sy+SEC_HDR*0.72);
      sy+=SEC_HDR+U(2);

      for(const dept of deptOrder){
        const crew=allSupport.filter(m=>m.dept===dept);
        if(crew.length===0) continue;

        ctx.fillStyle='rgba(100,130,180,0.50)';
        ctx.font=`bold ${U(8)}px ui-monospace,monospace`;
        ctx.textAlign='left';
        ctx.fillText(deptLabel[dept],sx+U(6),sy+U(8));
        sy+=U(11);

        const dutyList=crew.filter(m=>m.watch==='duty');
        const watchB=crew.filter(m=>m.watch==='B');
        const watchA=crew.filter(m=>m.watch==='A');
        const subW=(availW-U(4))/2;

        for(let i=0;i<dutyList.length;i++){
          const m=dutyList[i];
          const ry=sy+i*ROW_H+ROW_H*0.82;
          ctx.fillStyle='rgba(140,110,10,0.12)';
          ctx.fillRect(sx,sy+i*ROW_H,availW,ROW_H-1);
          drawCrewRow(m, sx, ry, availW, true);
        }
        if(dutyList.length) sy+=dutyList.length*ROW_H+U(2);

        const rows=Math.max(watchB.length,watchA.length);
        for(let i=0;i<watchB.length;i++){
          const m=watchB[i];
          drawCrewRow(m, sx, sy+i*ROW_H+ROW_H*0.82, subW, false);
        }
        for(let i=0;i<watchA.length;i++){
          const m=watchA[i];
          drawCrewRow(m, sx+subW+U(4), sy+i*ROW_H+ROW_H*0.82, subW, false);
        }
        sy+=rows*ROW_H+U(4);
      }
      return sy+U(4);
    }

    let ly=cy;
    for(const comp of leftComps){
      ly=drawCompSection(comp,col0x,ly,colW);
      ly+=U(4);
    }

    let ry2=cy;
    for(const comp of rightComps){
      ry2=drawCompSection(comp,col1x,ry2,colW);
      ry2+=U(4);
    }
    drawSupportSection(col1x, ry2, colW);

    PNL.btn2(ctx,'CLOSE',OX+OW/2-U(40),OY+OH-U(26),U(80),U(18),'rgba(30,50,90,0.70)',
      ()=>{ ui.showCrewPanel=false; });

    for(const h of _hoverHits){
      if(mx>=h.x&&mx<=h.x+h.w&&my>=h.y&&my<=h.y+h.h){
        const tip=h.tip;
        ctx.font=`${U(11)}px ui-monospace,monospace`;
        const tw=ctx.measureText(tip).width+U(12);
        const th=U(16);
        let tx=mx+U(10), ty=my-U(4);
        if(tx+tw>OX+OW) tx=mx-tw-U(4);
        if(ty+th>OY+OH) ty=my-th-U(4);
        ctx.fillStyle='rgba(5,12,30,0.94)';
        ctx.strokeStyle='rgba(80,140,220,0.55)';
        ctx.lineWidth=1;
        ctx.beginPath(); ctx.roundRect(tx,ty,tw,th,U(3)); ctx.fill(); ctx.stroke();
        ctx.fillStyle='rgba(200,220,255,0.95)';
        ctx.textAlign='left';
        ctx.fillText(tip,tx+U(6),ty+th*0.72);
        break;
      }
    }
  }
