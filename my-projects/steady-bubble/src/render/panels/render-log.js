// render-log.js — drawLogPanel and drawDcPanel
'use strict';

import { player, sonarContacts, session, ui, L } from './panel-context.js';

  // ── Combined Log Panel (Ship Log + Sonar Raw Feed) with tabs ─────────────
  export function drawLogPanel(W,H,panelH){
    const ctx = L.ctx;
    const {U} = L.R;
    const msgLog=session.msgLog||[];
    const sonarLog=session.sonarLog||[];
    const tab=ui.logTab||'log';
    const T_game=session.missionT||0;

    const inEscape = session.casualtyState==='escape' || session.escapeResolved;
    const rowH=U(19);
    const padX=U(10), padY=U(6);
    const tabH=U(20);
    const boardW=U(560);
    const bx=0;
    const by=0;
    const boardH=H-panelH-U(2);
    const maxRows=Math.floor((boardH-tabH-padY*2)/rowH);

    // Background
    ctx.fillStyle='rgba(248,246,240,0.90)';
    ctx.strokeStyle='rgba(17,24,39,0.14)';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.roundRect(bx,by,boardW,boardH,0); ctx.fill(); ctx.stroke();

    // Tab bar
    const tabs=[{id:'log',label:'SHIP LOG'},{id:'sonar',label:'SONAR RAW'},{id:'dc',label:'DC LOG'}];
    const tabW=boardW/tabs.length;
    for(let ti=0;ti<tabs.length;ti++){
      const t=tabs[ti];
      const tx=bx+ti*tabW;
      const active=tab===t.id;
      ctx.fillStyle=active?'rgba(17,24,39,0.90)':'rgba(17,24,39,0.12)';
      ctx.fillRect(tx,by,tabW,tabH);
      ctx.fillStyle=active?'#f8f6f0':'rgba(17,24,39,0.50)';
      ctx.font=`bold ${U(8.5)}px ui-monospace,monospace`;
      ctx.textAlign='center';
      ctx.fillText(t.label,tx+tabW/2,by+tabH*0.68);
      // Clickable tab
      const _t=t;
      L.PANEL?.btn2(ctx,'',tx,by,tabW,tabH,'transparent',()=>{ ui.logTab=_t.id; });
    }
    // Divider below tabs
    ctx.strokeStyle='rgba(17,24,39,0.15)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(bx,by+tabH); ctx.lineTo(bx+boardW,by+tabH); ctx.stroke();

    const contentY=by+tabH+padY;

    if(tab==='log'){
      // ── Ship Log ────────────────────────────────────────────
      const CAT_COL={CONN:'#1e3a5f',CO:'#78621a',SONAR:'#0e7490',WEPS:'#991b1b',ENG:'#92400e',HELM:'#374151',MANV:'#4a3728',COMMS:'#1a4731',NAV:'#3b2f6b'};
      const CAT_BG={CONN:'rgba(30,58,95,0.18)',CO:'rgba(120,98,26,0.18)',SONAR:'rgba(14,116,144,0.15)',WEPS:'rgba(153,27,27,0.15)',ENG:'rgba(146,64,14,0.14)',HELM:'rgba(55,65,81,0.15)',MANV:'rgba(74,55,40,0.15)',COMMS:'rgba(26,71,49,0.15)',NAV:'rgba(59,47,107,0.15)'};
      const catW=U(50);
      const mt=T_game;
      const mm=Math.floor(mt/60).toString().padStart(2,'0');
      const ss=Math.floor(mt%60).toString().padStart(2,'0');
      ctx.fillStyle='rgba(17,24,39,0.35)'; ctx.font=`${U(8)}px ui-monospace,monospace`;
      ctx.textAlign='right';
      ctx.fillText(`T+${mm}:${ss}`,bx+boardW-padX,contentY-U(2));

      // ── text-wrap helper ─────────────────────────────────────────────────
      const textFont=`${U(10)}px ui-monospace,monospace`;
      const textX=bx+padX+catW+U(36);
      const maxTextW=boardW-textX+bx-padX;
      function wrapEntry(text){
        ctx.font=textFont;
        const words=text.split(' ');
        const lines=[]; let line='';
        for(const w of words){
          const test=line?line+' '+w:w;
          if(ctx.measureText(test).width>maxTextW && line){ lines.push(line); line=w; }
          else line=test;
        }
        if(line) lines.push(line);
        return lines.length?lines:[''];
      }

      // Pre-compute wrapped lines and total row count
      const escapeIdx = inEscape
        ? msgLog.findIndex(e=>e.text&&e.text.startsWith('CO \u2014'))
        : -1;
      const logStart = escapeIdx >= 0 ? escapeIdx : Math.max(0, msgLog.length-120);
      const allEntries=msgLog.slice(logStart);
      const wrapped=allEntries.map(e=>({entry:e, lines:wrapEntry(e.text)}));
      let totalLineRows=wrapped.reduce((s,w)=>s+w.lines.length,0);
      while(totalLineRows>maxRows && wrapped.length>0){
        totalLineRows-=wrapped[0].lines.length;
        wrapped.shift();
      }

      let curY=contentY+rowH*0.7;
      for(const {entry,lines} of wrapped){
        const entryH=lines.length*rowH;
        const ry=curY;

        // ── Priority row highlight ─────────
        const pri=entry.priority||0;
        if(pri===2){
          ctx.fillStyle='rgba(180,20,20,0.13)';
          ctx.beginPath(); ctx.roundRect(bx,ry-rowH*0.8,boardW,entryH+rowH*0.15,0); ctx.fill();
          ctx.fillStyle='rgba(220,40,40,0.85)';
          ctx.fillRect(bx,ry-rowH*0.8,U(3),entryH+rowH*0.15);
        } else if(pri===1){
          ctx.fillStyle='rgba(160,100,0,0.10)';
          ctx.beginPath(); ctx.roundRect(bx,ry-rowH*0.8,boardW,entryH+rowH*0.15,0); ctx.fill();
          ctx.fillStyle='rgba(200,140,0,0.80)';
          ctx.fillRect(bx,ry-rowH*0.8,U(3),entryH+rowH*0.15);
        }

        // Station pill
        const pillBG=pri===2?'rgba(180,20,20,0.70)':pri===1?'rgba(160,100,0,0.55)':(CAT_BG[entry.cat]||'rgba(17,24,39,0.10)');
        const pillFG=pri===2?'#ffcccc':pri===1?'#ffe8a0':(CAT_COL[entry.cat]||'#111827');
        ctx.fillStyle=pillBG;
        ctx.beginPath(); ctx.roundRect(bx+padX,ry-rowH*0.72,catW,rowH*0.85,U(2)); ctx.fill();
        ctx.fillStyle=pillFG;
        ctx.font=`bold ${U(8.5)}px ui-monospace,monospace`; ctx.textAlign='center';
        ctx.fillText(entry.cat,bx+padX+catW/2,ry-U(1));

        // Timestamp
        const et=entry.t||0;
        const em=Math.floor(et/60).toString().padStart(2,'0');
        const es=Math.floor(et%60).toString().padStart(2,'0');
        ctx.font=`${U(7.5)}px ui-monospace,monospace`;
        ctx.fillStyle=pri===2?'rgba(80,0,0,0.60)':pri===1?'rgba(80,50,0,0.60)':'rgba(17,24,39,0.50)';
        ctx.textAlign='left';
        ctx.fillText(`${em}:${es}`,bx+padX+catW+U(5),ry-U(1));

        // Text lines
        ctx.font=textFont; ctx.textAlign='left';
        ctx.fillStyle=pri===2?'rgba(10,0,0,0.95)':pri===1?'rgba(40,25,0,0.95)':'rgba(17,24,39,0.90)';
        for(let li=0;li<lines.length;li++){
          ctx.fillText(lines[li],textX,ry-U(1)+li*rowH);
        }

        curY+=entryH;
      }

    } else if(tab==='sonar'){
      // ── Sonar Raw Feed ────────────────────────────────────────
      const entries=sonarLog.slice(-maxRows);
      const colArray=U(38), colID=U(28), colBrg=U(36), colSig=U(54), colType=U(32);
      // Header row
      ctx.fillStyle='rgba(17,24,39,0.35)'; ctx.font=`bold ${U(7.5)}px ui-monospace,monospace`; ctx.textAlign='left';
      const hx=bx+padX;
      const hy=contentY+U(4);
      ctx.fillText('ARRAY', hx, hy);
      ctx.fillText('ID',    hx+colArray, hy);
      ctx.fillText('BRG',   hx+colArray+colID, hy);
      ctx.fillText('SIGNAL',hx+colArray+colID+colBrg, hy);
      ctx.fillText('TYPE',  hx+colArray+colID+colBrg+colSig, hy);
      ctx.fillText('AGE',   hx+colArray+colID+colBrg+colSig+colType, hy);

      for(let i=0;i<entries.length;i++){
        const e=entries[i];
        const ry=contentY+rowH*(i+1)+U(4);
        const age=T_game-e.t;
        const alpha=1.0;

        const arrCol=e.array==='HULL'?`rgba(60,160,220,${alpha})`:`rgba(0,180,140,${alpha})`;
        ctx.fillStyle=arrCol; ctx.font=`bold ${U(8.5)}px ui-monospace,monospace`; ctx.textAlign='left';
        ctx.fillText(e.array, hx, ry);

        ctx.fillStyle=`rgba(17,24,39,${alpha*0.80})`; ctx.font=`${U(9)}px ui-monospace,monospace`;
        ctx.fillText(e.id,     hx+colArray, ry);
        ctx.fillStyle=`rgba(180,140,0,${alpha*0.90})`;
        ctx.fillText(`${e.brgStr}\u00b0`, hx+colArray+colID, ry);

        const sigCol=e.tierLabel==='STRONG'?`rgba(22,163,74,${alpha})`
                    :e.tierLabel==='MOD'   ?`rgba(217,119,6,${alpha})`
                                           :`rgba(120,120,120,${alpha*0.65})`;
        ctx.fillStyle=sigCol;
        ctx.fillText(e.tierLabel, hx+colArray+colID+colBrg, ry);

        // Show classification if available, otherwise raw type
        let dispType=e.typeLabel;
        for(const [_,sc] of sonarContacts){
          if(sc.id===e.id && sc.classification){ dispType=sc.classification; break; }
        }
        const isCiv=dispType==='TANKER'||dispType==='CARGO'||dispType==='FISHING'||dispType==='FERRY'||dispType==='MERCHANT';
        ctx.fillStyle=dispType.includes('AKULA')?`rgba(220,40,40,${alpha*0.90})`
                     :dispType.includes('SSBN')?`rgba(180,60,200,${alpha*0.90})`
                     :dispType.includes('SSGN')?`rgba(200,100,40,${alpha*0.90})`
                     :dispType.includes('DESTROYER')||dispType.includes('FRIGATE')||dispType.includes('CRUISER')||dispType.includes('CORVETTE')?`rgba(40,120,200,${alpha*0.85})`
                     :isCiv?`rgba(80,160,80,${alpha*0.60})`
                     :`rgba(100,120,140,${alpha*0.70})`;
        ctx.fillText(dispType, hx+colArray+colID+colBrg+colSig, ry);

        const ageStr=age<60?Math.round(age)+'s':Math.floor(age/60)+'m'+Math.floor(age%60).toString().padStart(2,'0')+'s';
        ctx.fillStyle=`rgba(17,24,39,${alpha*0.45})`;
        ctx.fillText(ageStr, hx+colArray+colID+colBrg+colSig+colType, ry);
      }
    } else if(tab==='dc'){
      // ── DC Log Tab ────────────────────────────────────────────────────────
      const DMG=L.DMG;
      const dcLog=session.dcLog||[];
      const d=player?.damage;

      // Team status strip at top
      const sumH=U(44);
      const sumY=contentY;
      if(d?.teams){
        const teams=Object.values(d.teams);
        const halfW=boardW/2;
        for(let ti=0;ti<teams.length;ti++){
          const team=teams[ti];
          const tx=bx+padX+ti*halfW;
          const isReady=team.state==='ready';
          const stateCol=team.state==='lost'?'rgba(220,55,55,0.90)':team.task==='drench_pending'?'rgba(255,130,0,0.90)':team.task==='vent_n2'?'rgba(0,185,165,0.90)':team.state==='mustering'?'rgba(200,140,30,0.80)':team.state==='transit'?'rgba(220,170,35,0.90)':team.task==='flood'?'rgba(120,180,255,0.90)':team.task==='repair'?'rgba(80,210,100,0.85)':isReady?'rgba(100,100,110,0.70)':'rgba(160,200,160,0.70)';
          ctx.fillStyle=stateCol; ctx.font=`bold ${U(10)}px ui-monospace,monospace`; ctx.textAlign='left';
          ctx.fillText(team.label,tx,sumY+U(13));
          ctx.fillStyle='rgba(17,24,39,0.55)'; ctx.font=`${U(9)}px ui-monospace,monospace`;
          const _dT=d?._fireDrenchPending?.[DMG.roomSection(team.location)]?.t;
          const loc=team.state==='lost'?'LOST':
            team.task==='drench_pending'?`N2 DRENCH \u2014 ${DMG.ROOMS[team.location]?.label||'?'} (${Math.ceil(_dT||0)}s)`:
            team.task==='vent_n2'?`VENT N2 \u2014 ${DMG.ROOMS[team.location]?.label||'?'} (${Math.ceil(team._ventT||0)}s)`:
            team.state==='mustering'?`MUSTER \u2192 ${DMG.SECTION_LABEL?.[team.destination]||'?'} (${Math.ceil(team.musterT||0)}s)`:
            team.state==='blowing'?`HP BLOW \u2014 ${DMG.ROOMS[team.location]?.label||'?'}`:
            team.state==='transit'?`\u2192 ${DMG.SECTION_LABEL?.[team.destination]||'?'} (${Math.ceil(team.transitEta)}s)`:
            isReady?'AVAILABLE':
            team.task==='flood'?`FLOOD \u2014 ${DMG.ROOMS[team.location]?.label||'?'}`:
            team.task==='repair'?`REPAIR ${DMG.SYS_LABEL[team.repairTarget]||'?'} \u2014 ${DMG.ROOMS[team.location]?.label||'?'}`:
            `ON SCENE \u2014 ${DMG.ROOMS[team.location]?.label||'?'}`;
          ctx.fillText(loc,tx,sumY+U(25));
          if(team.state==='on_scene'&&team.task==='repair'){
            const job=player?.damage?.repairJobs?.[DMG.roomSection(team.location)];
            const pct=job?Math.min(1,job.progress/job.totalTime):0;
            ctx.fillStyle='rgba(17,24,39,0.10)'; ctx.fillRect(tx,sumY+U(30),halfW-padX*2,U(5));
            ctx.fillStyle='rgba(60,180,80,0.75)'; ctx.fillRect(tx,sumY+U(30),(halfW-padX*2)*pct,U(5));
          }
          if(team.task==='vent_n2'){
            const pct=1-(team._ventT||0)/60;
            ctx.fillStyle='rgba(0,60,60,0.30)'; ctx.fillRect(tx,sumY+U(30),halfW-padX*2,U(5));
            ctx.fillStyle='rgba(0,185,165,0.70)'; ctx.fillRect(tx,sumY+U(30),(halfW-padX*2)*Math.min(1,pct),U(5));
          }
        }
      }
      // Divider
      ctx.strokeStyle='rgba(17,24,39,0.12)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(bx,contentY+sumH); ctx.lineTo(bx+boardW,contentY+sumH); ctx.stroke();

      // DC log entries below team strip
      const dcContentY=contentY+sumH+rowH*0.7;
      const dcMaxRows=maxRows-Math.ceil(sumH/rowH)-1;
      const recent=dcLog.slice(-dcMaxRows);
      for(let i=0;i<recent.length;i++){
        const entry=recent[i];
        const ry=dcContentY+i*rowH;
        const T=entry.t||0;
        const mm=String(Math.floor(T/60)).padStart(2,'0');
        const ss=String(Math.floor(T%60)).padStart(2,'0');
        const dcPri=entry.priority||0;
        if(dcPri===2){ ctx.fillStyle='rgba(180,20,20,0.13)'; ctx.fillRect(bx,ry-rowH*0.75,boardW,rowH); ctx.fillStyle='rgba(220,40,40,0.85)'; ctx.fillRect(bx,ry-rowH*0.75,U(3),rowH); }
        else if(dcPri===1){ ctx.fillStyle='rgba(160,100,0,0.09)'; ctx.fillRect(bx,ry-rowH*0.75,boardW,rowH); ctx.fillStyle='rgba(200,140,0,0.75)'; ctx.fillRect(bx,ry-rowH*0.75,U(3),rowH); }
        ctx.fillStyle='rgba(17,24,39,0.40)'; ctx.font=`${U(7.5)}px ui-monospace,monospace`; ctx.textAlign='right';
        ctx.fillText(`${mm}:${ss}`,bx+boardW-padX,ry);
        const col=dcPri===2?'rgba(180,20,20,0.95)':dcPri===1?'rgba(160,100,0,0.90)':'rgba(17,24,39,0.80)';
        ctx.fillStyle=col; ctx.font=`${U(10)}px ui-monospace,monospace`; ctx.textAlign='left';
        const maxW=boardW-padX*2-U(44);
        let txt=entry.text;
        ctx.font=`${U(10)}px ui-monospace,monospace`;
        while(ctx.measureText(txt).width>maxW&&txt.length>10) txt=txt.slice(0,-1);
        if(txt!==entry.text) txt=txt.slice(0,-1)+'\u2026';
        ctx.fillText(txt,bx+padX,ry);
      }
    }
  }

    // ── DC Comms Panel (J key) ──────────────────────────────────────────────
    export function drawDcPanel(W,H,panelH){
      return; // absorbed into log panel DC tab — kept callable behind admin overlay
    }
