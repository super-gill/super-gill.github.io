// render-panel.js — start screen, log panel, damage control panel, command panel
// Exposes window.RPANEL: { drawStartScreen, drawLogPanel, drawDcPanel, drawDamagePanel, drawPanel }
// Requires window.R (render-utils.js) to be loaded first.
(() => {
  'use strict';
  const C = window.CONFIG;
  const {clamp, lerp} = window.M;
  const {ctx, DPR, player, game, bullets, sonarContacts, setMsg} = window.G;
  const AI = window.AI;
  const {doodleLine, doodleCircle, doodleText, w2s, wScale, PANEL_H, STRIP_W} = window.R;

  function drawStartScreen(W,H){
    const PANEL=window.PANEL;
    const game=window.G.game;
    PANEL.clearBtns();

    // Deep ocean background
    const grad=ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,'#0a1628');
    grad.addColorStop(1,'#05101e');
    ctx.fillStyle=grad;
    ctx.fillRect(0,0,W,H);

    // Subtle grid lines
    ctx.strokeStyle='rgba(30,80,120,0.12)';
    ctx.lineWidth=1;
    const gs=60*DPR;
    for(let x=0;x<W;x+=gs){ ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke(); }
    for(let y=0;y<H;y+=gs){ ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke(); }

    // Title
    ctx.textAlign='center';
    ctx.fillStyle='rgba(200,225,255,0.97)';
    ctx.font=`bold ${52*DPR}px ui-monospace,monospace`;
    ctx.fillText('STEADY BUBBLE',W/2, H*0.14);
    ctx.fillStyle='rgba(100,160,220,0.50)';
    ctx.font=`${12*DPR}px ui-monospace,monospace`;
    ctx.letterSpacing='4px';
    ctx.fillText('COLD WAR SUBMARINE TACTICS  ▸  CHOOSE SCENARIO', W/2, H*0.14+26*DPR);
    ctx.letterSpacing='0px';

    // Scenario cards
    const scenarios=[
      {
        id:'waves',
        title:'WOLFPACK HUNT',
        sub:'Escalating threat',
        lines:[
          'Survive successive waves of Soviet',
          'submarines using sprint-drift tactics,',
          'wolfpack datum sharing and interceptors.',
          'Each wave escalates in composition.',
        ],
        colour:'rgba(22,100,160,0.90)',
        accent:'rgba(80,180,255,0.85)',
        tag:'PROGRESSIVE',
      },
      {
        id:'duel',
        title:'1V1 DUEL',
        sub:'Equal adversary',
        lines:[
          'One enemy submarine. Same class,',
          'similar capability. Pure skill — the',
          'first to build a firing solution',
          'and shoot wins.',
        ],
        colour:'rgba(120,40,40,0.90)',
        accent:'rgba(255,120,80,0.85)',
        tag:'SINGLE CONTACT',
      },
      {
        id:'ambush',
        title:'AMBUSH',
        sub:'Already surrounded',
        lines:[
          'Four submarines have your datum.',
          'They are already closing from all',
          'quadrants. Evade, counter, and',
          'thin the pack before they fire.',
        ],
        colour:'rgba(100,50,10,0.90)',
        accent:'rgba(255,180,40,0.85)',
        tag:'HIGH THREAT',
      },
      {
        id:'patrol',
        title:'BARRIER TRANSIT',
        sub:'Break through the line',
        lines:[
          'A 4-contact barrier patrol blocks',
          'your transit route. Pingers are',
          'active. Go deep, go quiet, or',
          'fight through the screen.',
        ],
        colour:'rgba(20,90,50,0.90)',
        accent:'rgba(80,220,120,0.85)',
        tag:'STEALTH/COMBAT',
      },
      {
        id:'free_run',
        title:'FREE RUN',
        sub:'Systems test — no enemies',
        lines:[
          'Open water. No contacts, no threat.',
          'Test depth control, planes, HPA,',
          'emergency procedures and damage',
          'systems without hostile pressure.',
        ],
        colour:'rgba(30,30,60,0.90)',
        accent:'rgba(120,120,200,0.85)',
        tag:'TESTING',
      },
    ];

    // Single horizontal row — all 5 cards across the screen
    const cols=5;
    const gap=16*DPR;
    const sidePad=40*DPR;
    const cardW=Math.floor((W - sidePad*2 - gap*(cols-1)) / cols);
    const cardH=Math.min(310*DPR, H*0.60);
    const gridX=sidePad;
    const gridY=H*0.22;
    const pad=10*DPR;

    for(let i=0;i<scenarios.length;i++){
      const s=scenarios[i];
      const cx=gridX+i*(cardW+gap);
      const cy=gridY;
      const selected=game.scenario===s.id;

      // Card background
      ctx.fillStyle=selected?s.colour.replace('0.90','1.0'):'rgba(8,20,35,0.80)';
      ctx.strokeStyle=selected?s.accent:'rgba(30,80,120,0.35)';
      ctx.lineWidth=selected?2:1;
      ctx.beginPath(); ctx.roundRect(cx,cy,cardW,cardH,8*DPR); ctx.fill(); ctx.stroke();

      // Selection glow
      if(selected){
        ctx.shadowColor=s.accent;
        ctx.shadowBlur=18*DPR;
        ctx.strokeStyle=s.accent;
        ctx.lineWidth=2;
        ctx.beginPath(); ctx.roundRect(cx,cy,cardW,cardH,8*DPR); ctx.stroke();
        ctx.shadowBlur=0;
      }

      // Tag pill
      ctx.fillStyle=selected?s.accent:'rgba(30,80,120,0.55)';
      ctx.font=`bold ${8*DPR}px ui-monospace,monospace`;
      ctx.textAlign='left';
      const tagW=ctx.measureText(s.tag).width+10*DPR;
      ctx.beginPath(); ctx.roundRect(cx+pad,cy+pad,tagW,15*DPR,3*DPR); ctx.fill();
      ctx.fillStyle=selected?'rgba(0,0,0,0.80)':'rgba(180,220,255,0.80)';
      ctx.fillText(s.tag,cx+pad+5*DPR,cy+pad+11*DPR);

      // Title
      ctx.fillStyle=selected?'#ffffff':s.accent;
      ctx.font=`bold ${15*DPR}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillText(s.title,cx+pad,cy+46*DPR);

      // Sub title
      ctx.fillStyle=selected?'rgba(255,255,255,0.65)':'rgba(120,180,220,0.60)';
      ctx.font=`${10*DPR}px ui-monospace,monospace`;
      ctx.fillText(s.sub,cx+pad,cy+60*DPR);

      // Description lines
      ctx.fillStyle=selected?'rgba(255,255,255,0.80)':'rgba(140,180,210,0.70)';
      ctx.font=`${10*DPR}px ui-monospace,monospace`;
      for(let li=0;li<s.lines.length;li++){
        ctx.fillText(s.lines[li],cx+pad,cy+78*DPR+li*15*DPR);
      }

      // Click handler — select scenario
      const _s=s;
      window.PANEL?.btn2(ctx,'',cx,cy,cardW,cardH,'transparent',()=>{
        game.scenario=_s.id;
      });
    }

    // Launch button
    const btnW=260*DPR, btnH=52*DPR;
    const btnX=(W-btnW)/2, btnY=gridY+cardH+22*DPR;
    const selScen=scenarios.find(s=>s.id===game.scenario)||scenarios[0];
    ctx.fillStyle=selScen.colour.replace('0.90','1.0');
    ctx.strokeStyle=selScen.accent;
    ctx.lineWidth=2;
    ctx.beginPath(); ctx.roundRect(btnX,btnY,btnW,btnH,8*DPR); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#ffffff';
    ctx.font=`bold ${17*DPR}px ui-monospace,monospace`;
    ctx.textAlign='center';
    ctx.fillText('DIVE — BEGIN MISSION',W/2,btnY+btnH*0.65);

    window.PANEL?.btn2(ctx,'',btnX,btnY,btnW,btnH,'transparent',()=>{
      game.started=true;
      game.scenario=game.scenario||'waves';
      window.SIM.resetScenario(game.scenario);
    });

    // Controls hint
    ctx.fillStyle='rgba(80,120,160,0.45)';
    ctx.font=`${10*DPR}px ui-monospace,monospace`;
    ctx.textAlign='center';
    ctx.fillText('A/D SPEED  ·  W/S DEPTH  ·  SHIFT+CLICK FIRE  ·  R RESTART  ·  ` DEBUG', W/2, btnY+btnH+24*DPR);
  }

  // ── Combined Log Panel (Ship Log + Sonar Raw Feed) with tabs ─────────────
  function drawLogPanel(W,H,panelH){
    const game=window.G.game;
    const msgLog=game.msgLog||[];
    const sonarLog=game.sonarLog||[];
    const tab=game.logTab||'log';
    const T_game=game.missionT||0;

    const inEscape = game.casualtyState==='escape' || game.escapeResolved;
    const rowH=19*DPR;
    const padX=10*DPR, padY=6*DPR;
    const tabH=20*DPR;
    const boardW=560*DPR;
    const bx=0;
    const by=0;
    const boardH=H-panelH-2*DPR;
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
      ctx.font=`bold ${8.5*DPR}px ui-monospace,monospace`;
      ctx.textAlign='center';
      ctx.fillText(t.label,tx+tabW/2,by+tabH*0.68);
      // Clickable tab
      const _t=t;
      window.PANEL?.btn2(ctx,'',tx,by,tabW,tabH,'transparent',()=>{ game.logTab=_t.id; });
    }
    // Divider below tabs
    ctx.strokeStyle='rgba(17,24,39,0.15)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(bx,by+tabH); ctx.lineTo(bx+boardW,by+tabH); ctx.stroke();

    const contentY=by+tabH+padY;

    if(tab==='log'){
      // ── Ship Log ────────────────────────────────────────────
      const CAT_COL={CONN:'#1e3a5f',CO:'#78621a',SONAR:'#0e7490',WEPS:'#991b1b',ENG:'#92400e',HELM:'#374151',MANV:'#4a3728',COMMS:'#1a4731',NAV:'#3b2f6b'};
      const CAT_BG={CONN:'rgba(30,58,95,0.18)',CO:'rgba(120,98,26,0.18)',SONAR:'rgba(14,116,144,0.15)',WEPS:'rgba(153,27,27,0.15)',ENG:'rgba(146,64,14,0.14)',HELM:'rgba(55,65,81,0.15)',MANV:'rgba(74,55,40,0.15)',COMMS:'rgba(26,71,49,0.15)',NAV:'rgba(59,47,107,0.15)'};
      const catW=50*DPR;
      const mt=T_game;
      const mm=Math.floor(mt/60).toString().padStart(2,'0');
      const ss=Math.floor(mt%60).toString().padStart(2,'0');
      ctx.fillStyle='rgba(17,24,39,0.35)'; ctx.font=`${8*DPR}px ui-monospace,monospace`;
      ctx.textAlign='right';
      ctx.fillText(`T+${mm}:${ss}`,bx+boardW-padX,contentY-2*DPR);

      // ── text-wrap helper ─────────────────────────────────────────────────
      const textFont=`${10*DPR}px ui-monospace,monospace`;
      const textX=bx+padX+catW+36*DPR;
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
      // During escape: anchor from CO's final log entry, trim old entries from front
      // (escape progress stays visible, pre-escape log scrolls off)
      const escapeIdx = inEscape
        ? msgLog.findIndex(e=>e.text&&e.text.startsWith('CO —'))
        : -1;
      const logStart = escapeIdx >= 0 ? escapeIdx : Math.max(0, msgLog.length-120);
      const allEntries=msgLog.slice(logStart);
      const wrapped=allEntries.map(e=>({entry:e, lines:wrapEntry(e.text)}));
      let totalLineRows=wrapped.reduce((s,w)=>s+w.lines.length,0);
      // Always trim from front — escape entries are at the tail so they stay
      while(totalLineRows>maxRows && wrapped.length>0){
        totalLineRows-=wrapped[0].lines.length;
        wrapped.shift();
      }

      let curY=contentY+rowH*0.7;
      for(const {entry,lines} of wrapped){
        const entryH=lines.length*rowH;
        const ry=curY; // top baseline

        // ── Priority row highlight (2=critical/red, 1=medium/amber) ─────────
        const pri=entry.priority||0;
        if(pri===2){
          ctx.fillStyle='rgba(180,20,20,0.13)';
          ctx.beginPath(); ctx.roundRect(bx,ry-rowH*0.8,boardW,entryH+rowH*0.15,0); ctx.fill();
          ctx.fillStyle='rgba(220,40,40,0.85)';
          ctx.fillRect(bx,ry-rowH*0.8,3*DPR,entryH+rowH*0.15);
        } else if(pri===1){
          ctx.fillStyle='rgba(160,100,0,0.10)';
          ctx.beginPath(); ctx.roundRect(bx,ry-rowH*0.8,boardW,entryH+rowH*0.15,0); ctx.fill();
          ctx.fillStyle='rgba(200,140,0,0.80)';
          ctx.fillRect(bx,ry-rowH*0.8,3*DPR,entryH+rowH*0.15);
        }

        // Station pill
        const pillBG=pri===2?'rgba(180,20,20,0.70)':pri===1?'rgba(160,100,0,0.55)':(CAT_BG[entry.cat]||'rgba(17,24,39,0.10)');
        const pillFG=pri===2?'#ffcccc':pri===1?'#ffe8a0':(CAT_COL[entry.cat]||'#111827');
        ctx.fillStyle=pillBG;
        ctx.beginPath(); ctx.roundRect(bx+padX,ry-rowH*0.72,catW,rowH*0.85,2*DPR); ctx.fill();
        ctx.fillStyle=pillFG;
        ctx.font=`bold ${8.5*DPR}px ui-monospace,monospace`; ctx.textAlign='center';
        ctx.fillText(entry.cat,bx+padX+catW/2,ry-1*DPR);

        // Timestamp
        const et=entry.t||0;
        const em=Math.floor(et/60).toString().padStart(2,'0');
        const es=Math.floor(et%60).toString().padStart(2,'0');
        ctx.font=`${7.5*DPR}px ui-monospace,monospace`;
        ctx.fillStyle=pri===2?'rgba(80,0,0,0.60)':pri===1?'rgba(80,50,0,0.60)':'rgba(17,24,39,0.50)';
        ctx.textAlign='left';
        ctx.fillText(`${em}:${es}`,bx+padX+catW+5*DPR,ry-1*DPR);

        // Text lines
        ctx.font=textFont; ctx.textAlign='left';
        ctx.fillStyle=pri===2?'rgba(10,0,0,0.95)':pri===1?'rgba(40,25,0,0.95)':'rgba(17,24,39,0.90)';
        for(let li=0;li<lines.length;li++){
          ctx.fillText(lines[li],textX,ry-1*DPR+li*rowH);
        }

        curY+=entryH;
      }

    } else if(tab==='sonar'){
      // ── Sonar Raw Feed ────────────────────────────────────────
      const entries=sonarLog.slice(-maxRows);
      const colArray=38*DPR, colID=28*DPR, colBrg=36*DPR, colSig=54*DPR, colType=32*DPR;
      // Header row
      ctx.fillStyle='rgba(17,24,39,0.35)'; ctx.font=`bold ${7.5*DPR}px ui-monospace,monospace`; ctx.textAlign='left';
      const hx=bx+padX;
      const hy=contentY+4*DPR;
      ctx.fillText('ARRAY', hx, hy);
      ctx.fillText('ID',    hx+colArray, hy);
      ctx.fillText('BRG',   hx+colArray+colID, hy);
      ctx.fillText('SIGNAL',hx+colArray+colID+colBrg, hy);
      ctx.fillText('TYPE',  hx+colArray+colID+colBrg+colSig, hy);
      ctx.fillText('AGE',   hx+colArray+colID+colBrg+colSig+colType, hy);

      for(let i=0;i<entries.length;i++){
        const e=entries[i];
        const ry=contentY+rowH*(i+1)+4*DPR;
        const age=T_game-e.t;
        const alpha=1.0;

        const arrCol=e.array==='HULL'?`rgba(60,160,220,${alpha})`:`rgba(0,180,140,${alpha})`;
        ctx.fillStyle=arrCol; ctx.font=`bold ${8.5*DPR}px ui-monospace,monospace`; ctx.textAlign='left';
        ctx.fillText(e.array, hx, ry);

        ctx.fillStyle=`rgba(17,24,39,${alpha*0.80})`; ctx.font=`${9*DPR}px ui-monospace,monospace`;
        ctx.fillText(e.id,     hx+colArray, ry);
        ctx.fillStyle=`rgba(180,140,0,${alpha*0.90})`;
        ctx.fillText(`${e.brgStr}°`, hx+colArray+colID, ry);

        const sigCol=e.tierLabel==='STRONG'?`rgba(22,163,74,${alpha})`
                    :e.tierLabel==='MOD'   ?`rgba(217,119,6,${alpha})`
                                           :`rgba(120,120,120,${alpha*0.65})`;
        ctx.fillStyle=sigCol;
        ctx.fillText(e.tierLabel, hx+colArray+colID+colBrg, ry);

        ctx.fillStyle=`rgba(100,120,140,${alpha*0.70})`;
        ctx.fillText(e.typeLabel, hx+colArray+colID+colBrg+colSig, ry);

        const ageStr=age<60?Math.round(age)+'s':Math.floor(age/60)+'m'+Math.floor(age%60).toString().padStart(2,'0')+'s';
        ctx.fillStyle=`rgba(17,24,39,${alpha*0.45})`;
        ctx.fillText(ageStr, hx+colArray+colID+colBrg+colSig+colType, ry);
      }
    } else if(tab==='dc'){
      // ── DC Log Tab ────────────────────────────────────────────────────────
      const DMG=window.DMG;
      const dcLog=game.dcLog||[];
      const d=window.G.player?.damage;

      // Team status strip at top
      const sumH=44*DPR;
      const sumY=contentY;
      if(d?.teams){
        const teams=Object.values(d.teams);
        const halfW=boardW/2;
        for(let ti=0;ti<teams.length;ti++){
          const team=teams[ti];
          const tx=bx+padX+ti*halfW;
          const isReady=team.state==='ready';
          const stateCol=team.state==='lost'?'rgba(220,55,55,0.90)':team.state==='mustering'?'rgba(200,140,30,0.80)':team.state==='transit'?'rgba(220,170,35,0.90)':team.task==='flood'?'rgba(120,180,255,0.90)':team.task==='repair'?'rgba(80,210,100,0.85)':isReady?'rgba(100,100,110,0.70)':'rgba(160,200,160,0.70)';
          ctx.fillStyle=stateCol; ctx.font=`bold ${10*DPR}px ui-monospace,monospace`; ctx.textAlign='left';
          ctx.fillText(team.label,tx,sumY+13*DPR);
          ctx.fillStyle='rgba(17,24,39,0.55)'; ctx.font=`${9*DPR}px ui-monospace,monospace`;
          const loc=team.state==='lost'?'LOST':
            team.state==='mustering'?`MUSTER → ${DMG.COMP_DEF[team.destination]?.label||'?'} (${Math.ceil(team.musterT||0)}s)`:
            team.state==='blowing'?`HP BLOW — ${DMG.COMP_DEF[team.location]?.label||'?'}`:
            team.state==='transit'?`→ ${DMG.COMP_DEF[team.destination]?.label||'?'} (${Math.ceil(team.transitEta)}s)`:
            isReady?'AVAILABLE':
            team.task==='flood'?`FLOOD — ${DMG.COMP_DEF[team.location]?.label||'?'}`:
            team.task==='repair'?`REPAIR ${DMG.SYS_LABEL[team.repairTarget]||'?'} — ${DMG.COMP_DEF[team.location]?.label||'?'}`:
            `ON SCENE — ${DMG.COMP_DEF[team.location]?.label||'?'}`;
          ctx.fillText(loc,tx,sumY+25*DPR);
          if(team.state==='on_scene'&&team.task==='repair'){
            const job=window.G?.player?.damage?.repairJobs?.[team.location];
            const pct=job?Math.min(1,job.progress/job.totalTime):0;
            ctx.fillStyle='rgba(17,24,39,0.10)'; ctx.fillRect(tx,sumY+30*DPR,halfW-padX*2,5*DPR);
            ctx.fillStyle='rgba(60,180,80,0.75)'; ctx.fillRect(tx,sumY+30*DPR,(halfW-padX*2)*pct,5*DPR);
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
        if(dcPri===2){ ctx.fillStyle='rgba(180,20,20,0.13)'; ctx.fillRect(bx,ry-rowH*0.75,boardW,rowH); ctx.fillStyle='rgba(220,40,40,0.85)'; ctx.fillRect(bx,ry-rowH*0.75,3*DPR,rowH); }
        else if(dcPri===1){ ctx.fillStyle='rgba(160,100,0,0.09)'; ctx.fillRect(bx,ry-rowH*0.75,boardW,rowH); ctx.fillStyle='rgba(200,140,0,0.75)'; ctx.fillRect(bx,ry-rowH*0.75,3*DPR,rowH); }
        ctx.fillStyle='rgba(17,24,39,0.40)'; ctx.font=`${7.5*DPR}px ui-monospace,monospace`; ctx.textAlign='right';
        ctx.fillText(`${mm}:${ss}`,bx+boardW-padX,ry);
        const col=dcPri===2?'rgba(180,20,20,0.95)':dcPri===1?'rgba(160,100,0,0.90)':'rgba(17,24,39,0.80)';
        ctx.fillStyle=col; ctx.font=`${10*DPR}px ui-monospace,monospace`; ctx.textAlign='left';
        const maxW=boardW-padX*2-44*DPR;
        let txt=entry.text;
        ctx.font=`${10*DPR}px ui-monospace,monospace`;
        while(ctx.measureText(txt).width>maxW&&txt.length>10) txt=txt.slice(0,-1);
        if(txt!==entry.text) txt=txt.slice(0,-1)+'…';
        ctx.fillText(txt,bx+padX,ry);
      }
    }
  }

    // ── DC Comms Panel (J key) ──────────────────────────────────────────────
    function drawDcPanel(W,H,panelH){
      return; // absorbed into log panel DC tab
      const DMG=window.DMG;
      const dcLog=game.dcLog||[];
      const d=player.damage;

      // Sits top-left, same width as ship log beneath it
      const pW=560*DPR;
      const maxRows=16;
      const rowH=20*DPR;
      const padX=12*DPR, padY=8*DPR;
      const hdrH=28*DPR;
      const sumH=52*DPR;
      const pH=hdrH+rowH*maxRows+padY*2+sumH+4*DPR;
      const px=0;
      // Align bottom of DC panel to top of ship log board
      const logBoardH=568*DPR; // matches inLogPanel
      const py=H-panelH-logBoardH-pH-4*DPR;

      ctx.fillStyle='rgba(16,12,6,0.96)';
      ctx.strokeStyle='rgba(180,130,40,0.45)';
      ctx.lineWidth=1;
      ctx.beginPath(); ctx.roundRect(px,py,pW,pH,0); ctx.fill(); ctx.stroke();

      // Header
      ctx.fillStyle='rgba(210,160,50,0.90)';
      ctx.font=`bold ${12*DPR}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillText('DMG LOG',px+padX,py+hdrH*0.72);
      ctx.fillStyle='rgba(150,110,30,0.60)';
      ctx.font=`${9*DPR}px ui-monospace,monospace`;
      ctx.textAlign='right';
      ctx.fillText('[J] close',px+pW-padX,py+hdrH*0.72);
      ctx.strokeStyle='rgba(180,120,30,0.30)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(px,py+hdrH); ctx.lineTo(px+pW,py+hdrH); ctx.stroke();

      // Log entries
      const contentY=py+hdrH+padY;
      const recent=dcLog.slice(-maxRows);
      for(let i=0;i<recent.length;i++){
        const entry=recent[i];
        const ry=contentY+i*rowH;
        const T=entry.t||0;
        const mm=String(Math.floor(T/60)).padStart(2,'0');
        const ss=String(Math.floor(T%60)).padStart(2,'0');
        const dcPri=entry.priority||0;
        const col=dcPri===2?'rgba(220,55,55,0.95)':dcPri===1?'rgba(220,165,40,0.90)':'rgba(180,150,80,0.75)';
        // Priority accent bar
        if(dcPri===2){ ctx.fillStyle='rgba(220,40,40,0.80)'; ctx.fillRect(px,ry,3*DPR,rowH*0.85); }
        else if(dcPri===1){ ctx.fillStyle='rgba(200,140,0,0.70)'; ctx.fillRect(px,ry,3*DPR,rowH*0.85); }
        ctx.fillStyle='rgba(140,100,25,0.35)';
        ctx.font=`${9*DPR}px ui-monospace,monospace`;
        ctx.textAlign='right';
        ctx.fillText(`T+\${mm}:\${ss}`,px+pW-padX,ry+rowH*0.72);
        ctx.fillStyle=col;
        ctx.font=`${10*DPR}px ui-monospace,monospace`;
        ctx.textAlign='left';
        // Truncate rather than wrap (single row per entry keeps it clean)
        const maxW=pW-padX*2-44*DPR;
        let txt=entry.text;
        while(ctx.measureText(txt).width>maxW&&txt.length>10) txt=txt.slice(0,-1);
        if(txt!==entry.text) txt=txt.slice(0,-1)+'…';
        ctx.fillText(txt,px+padX,ry+rowH*0.72);
      }

      // ── Team status summary strip ─────────────────────────────────────────
      const sumY=py+pH-sumH;
      ctx.fillStyle='rgba(20,16,8,0.70)'; ctx.fillRect(px,sumY,pW,sumH);
      ctx.strokeStyle='rgba(180,120,30,0.30)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(px,sumY); ctx.lineTo(px+pW,sumY); ctx.stroke();

      if(d?.teams){
        const teams=Object.values(d.teams);
        for(let ti=0;ti<teams.length;ti++){
          const team=teams[ti];
          const tx=px+padX+ti*(pW/2);
          const isReady=team.state==='ready';
          const stateCol=team.state==='lost'?'rgba(220,55,55,0.90)':team.state==='mustering'?'rgba(200,140,30,0.80)':team.state==='transit'?'rgba(220,170,35,0.90)':team.task==='flood'?'rgba(120,180,255,0.90)':team.task==='repair'?'rgba(80,210,100,0.85)':isReady?'rgba(160,160,160,0.70)':'rgba(160,200,160,0.70)';
          ctx.fillStyle=stateCol; ctx.font=`bold ${11*DPR}px ui-monospace,monospace`; ctx.textAlign='left';
          ctx.fillText(team.label,tx,sumY+16*DPR);
          ctx.fillStyle='rgba(170,140,65,0.70)'; ctx.font=`${10*DPR}px ui-monospace,monospace`;
          const loc=team.state==='lost'?'LOST':
            team.state==='mustering'?`MUSTERING → ${DMG.COMP_DEF[team.destination]?.label||'?'} (${Math.ceil(team.musterT||0)}s)`:
            team.state==='blowing'?`HP BLOW — ${DMG.COMP_DEF[team.location]?.label||'?'}`:
            team.state==='transit'?`MOVING → ${DMG.COMP_DEF[team.destination]?.label||'?'} (${Math.ceil(team.transitEta)}s)`:
            isReady?'AVAILABLE':
            team.task==='flood'?`FIGHTING FLOOD — ${DMG.COMP_DEF[team.location]?.label||'?'}`:
            team.task==='repair'?`REPAIRING ${DMG.SYS_LABEL[team.repairTarget]||'?'} — ${DMG.COMP_DEF[team.location]?.label||'?'}`:
            `ON SCENE — ${DMG.COMP_DEF[team.location]?.label||'?'}`;
          ctx.fillText(loc,tx,sumY+30*DPR);
          // Repair progress bar
          if(team.state==='on_scene'&&team.task==='repair'){
            const job=window.G?.player?.damage?.repairJobs?.[team.location];
            const pct=job?Math.min(1,job.progress/job.totalTime):0;
            const bx=tx,by=sumY+34*DPR,bw=pW/2-padX-8*DPR,bh=6*DPR;
            ctx.fillStyle='rgba(20,40,20,0.60)'; ctx.fillRect(bx,by,bw,bh);
            ctx.fillStyle='rgba(60,180,80,0.75)'; ctx.fillRect(bx,by,bw*pct,bh);
          }
        }
      }
    }

    function drawDamagePanel(W,H,panelH){
    if(!game.showDmgPanel||game.showDamageScreen) return;
    const dmg=player.damage;
    if(!dmg) return;
    const DMG=window.DMG;
    const PNL=window.PANEL;

    const OW=620*DPR, OH=480*DPR;
    const OX=Math.round(W/2-OW/2), OY=Math.round(H/2-OH/2);
    const P=10*DPR;

    ctx.fillStyle='rgba(8,14,26,0.97)';
    ctx.strokeStyle='rgba(80,110,160,0.35)';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.roundRect(OX,OY,OW,OH,6*DPR); ctx.fill(); ctx.stroke();

    // Title
    let cy=OY+P+10*DPR;
    ctx.fillStyle='rgba(160,190,240,0.90)';
    ctx.font=`bold ${13*DPR}px ui-monospace,monospace`;
    ctx.textAlign='left';
    ctx.fillText('DMG CTRL',OX+P,cy);
    ctx.fillStyle='rgba(120,140,180,0.50)';
    ctx.font=`${8*DPR}px ui-monospace,monospace`;
    ctx.textAlign='right';
    ctx.fillText('[H] close  [J] DMG LOG',OX+OW-P,cy);

    // Crew summary — watchkeepers on watch + full ship totals
    cy+=16*DPR;
    const fit=DMG.totalFit(),wnd=DMG.totalWounded(),kia=DMG.totalKilled(),total=DMG.totalCrew();
    const aw2=game.activeWatch||'A';
    let wkOnFit=0,wkOnWnd=0,wkOnTotal=0;
    for(const comp of DMG.COMPS){
      const cc2=(dmg.crew[comp]||[]).filter(c=>(c.watch===aw2||c.watch==='duty')&&c.dept!=='medical'&&c.dept!=='supply');
      wkOnFit  +=cc2.filter(c=>c.status==='fit'&&!c.displaced).length;
      wkOnWnd  +=cc2.filter(c=>c.status==='wounded').length;
      wkOnTotal+=cc2.filter(c=>c.status!=='killed').length;
    }
    ctx.fillStyle='rgba(160,185,230,0.70)';
    ctx.font=`${10*DPR}px ui-monospace,monospace`;
    ctx.textAlign='left';
    ctx.fillText(`WCH ${aw2}  ${wkOnFit} FIT  ${wkOnWnd} WND  /  ${wkOnTotal} ON WATCH`,OX+P,cy);
    ctx.fillStyle='rgba(110,130,170,0.50)';
    ctx.font=`${9*DPR}px ui-monospace,monospace`;
    ctx.textAlign='right';
    ctx.fillText(`SHIP  ${fit} FIT  ${wnd} WND  ${kia} KIA  / ${total}`,OX+OW-P,cy);

    // Tower status
    cy+=14*DPR;
    const twrCol={nominal:'rgba(22,163,74,0.75)',damaged:'rgba(217,119,6,0.80)',destroyed:'rgba(180,30,30,0.80)'};
    ctx.font=`${10*DPR}px ui-monospace,monospace`;
    ctx.textAlign='left';
    ctx.fillStyle=twrCol[dmg.towers.fwd]; ctx.fillText(`FWD TOWER: ${dmg.towers.fwd.toUpperCase()}`,OX+P,cy);
    ctx.fillStyle=twrCol[dmg.towers.aft]; ctx.textAlign='right'; ctx.fillText(`AFT TOWER: ${dmg.towers.aft.toUpperCase()}`,OX+OW-P,cy);
    cy+=10*DPR;

    // ── DC Teams status bar ───────────────────────────────────────────────────
    const teamList=Object.values(dmg.teams||{});
    const teamBarH=42*DPR;
    ctx.fillStyle='rgba(20,30,50,0.50)';
    ctx.fillRect(OX+P,cy,OW-P*2,teamBarH);
    ctx.strokeStyle='rgba(80,110,160,0.20)'; ctx.lineWidth=1;
    ctx.strokeRect(OX+P,cy,OW-P*2,teamBarH);
    for(let ti=0;ti<teamList.length;ti++){
      const team=teamList[ti];
      const tx=OX+P+ti*(OW-P*2)/2+4*DPR;
      const stateCol=team.state==='lost'?'rgba(200,50,50,0.90)':team.state==='mustering'?'rgba(200,140,30,0.80)':team.state==='blowing'?'rgba(255,140,0,0.90)':team.state==='transit'?'rgba(220,170,30,0.90)':team.state==='on_scene'&&team.task==='fire'?'rgba(255,100,20,0.90)':team.state==='on_scene'&&team.task==='flood'?'rgba(100,160,255,0.90)':team.state==='on_scene'&&team.task==='repair'?'rgba(80,200,100,0.90)':team.state==='on_scene'?'rgba(160,200,160,0.70)':'rgba(140,140,140,0.60)';
      ctx.fillStyle=stateCol; ctx.font=`bold ${10*DPR}px ui-monospace,monospace`; ctx.textAlign='left';
      ctx.fillText(team.label,tx,cy+13*DPR);
      const taskStr=team.state==='lost'?'— LOST':team.state==='mustering'?`MUSTER → ${DMG.COMP_DEF[team.destination]?.label||'?'} (${Math.ceil(team.musterT||0)}s)`:team.state==='blowing'?`HP BLOW — ${DMG.COMP_DEF[team.location]?.label||'?'}`:team.state==='transit'?`→ ${DMG.COMP_DEF[team.destination]?.label||'?'} (${Math.ceil(team.transitEta)}s)`:team.state==='on_scene'&&team.task==='fire'?`FIRE — ${DMG.COMP_DEF[team.location]?.label||'?'}`:team.state==='on_scene'&&team.task==='flood'?`FLOOD — ${DMG.COMP_DEF[team.location]?.label||'?'}`:team.state==='on_scene'&&team.task==='repair'?`REPAIR — ${DMG.SYS_LABEL[team.repairTarget]||'?'}`:team.state==='on_scene'?`STANDBY — ${DMG.COMP_DEF[team.location]?.label||'?'}`:'STANDBY';
      ctx.fillStyle='rgba(160,180,220,0.65)'; ctx.font=`${9*DPR}px ui-monospace,monospace`;
      ctx.fillText(taskStr,tx,cy+26*DPR);
      // Repair progress bar
      if(team.state==='on_scene'&&team.task==='repair'&&team.repairTarget){
        const job=window.G?.player?.damage?.repairJobs?.[team.location];
        const pct=job?Math.min(1,job.progress/job.totalTime):0;
        const bx=tx,by=cy+30*DPR,bw=(OW-P*2)/2-8*DPR,bh=5*DPR;
        ctx.fillStyle='rgba(20,40,80,0.50)'; ctx.fillRect(bx,by,bw,bh);
        ctx.fillStyle='rgba(50,160,80,0.70)'; ctx.fillRect(bx,by,bw*pct,bh);
      }
    }
    cy+=teamBarH+8*DPR;

    // ── 5-compartment schematic ───────────────────────────────────────────────
    const schX=OX+P, schW=OW-P*2;
    const schH=148*DPR;
    const schY=cy;
    const compKeys=DMG.COMPS;
    const compLabels=['TORP RM','CONTROL','AUX MCH','REACTOR','MANEUVR','ENGINRG'];
    const compFracs=[0.21,0.21,0.08,0.10,0.21,0.19];

    // ── Geometry ──────────────────────────────────────────────────────────────
    // Pressure hull — true pill, both ends rounded symmetrically
    const phTop = schY + 44*DPR;
    const phBot = schY + 114*DPR;
    const phMid = (phTop+phBot)*0.5;
    const phR   = (phBot-phTop)*0.5;           // half-height = end cap radius
    const phX0  = schX + phR + 18*DPR;         // bow arc centre
    const phX1  = schX + schW - phR - 18*DPR;  // stern arc centre
    const phSpan= phX1 - phX0;                 // interior span for compartments

    // Outer hull — slightly larger pill envelope
    const ohR   = phR + 8*DPR;
    const ohTop = phMid - ohR;
    const ohBot = phMid + ohR;

    // Sail — centred over control room (comp 1), no periscopes
    const sailCX  = phX0 + phSpan*(0.21 + 0.105);
    const sailW   = 44*DPR;
    const sailH   = 22*DPR;
    const sailBot = ohTop;
    const sailTop = sailBot - sailH;

    // Compartment X positions within pill interior span
    let compXs=[], compWs=[];
    { let xx=phX0;
      for(let i=0;i<6;i++){ compWs[i]=phSpan*compFracs[i]; compXs[i]=xx; xx+=compWs[i]; } }

    const stFill  ={nominal:'rgba(18,55,28,0.88)',degraded:'rgba(75,58,4,0.90)',offline:'rgba(75,22,4,0.92)',destroyed:'rgba(55,4,4,0.96)'};
    const stStroke={nominal:'rgba(50,200,80,0.55)',degraded:'rgba(220,170,20,0.80)',offline:'rgba(220,80,20,0.90)',destroyed:'rgba(200,30,30,1.0)'};

    // ── Pill path helpers ─────────────────────────────────────────────────────
    function pillPath(){
      ctx.beginPath();
      ctx.arc(phX0, phMid, phR, Math.PI*0.5, -Math.PI*0.5, false);  // bow cap (clockwise = outward)
      ctx.lineTo(phX1, phTop);
      ctx.arc(phX1, phMid, phR, -Math.PI*0.5, Math.PI*0.5, false);  // stern cap
      ctx.lineTo(phX0, phBot);
      ctx.closePath();
    }
    function outerPillPath(){
      ctx.beginPath();
      ctx.arc(phX0, phMid, ohR, Math.PI*0.5, -Math.PI*0.5, false);  // bow cap (clockwise = outward)
      ctx.lineTo(phX1, ohTop);
      ctx.arc(phX1, phMid, ohR, -Math.PI*0.5, Math.PI*0.5, false);  // stern cap
      ctx.lineTo(phX0, ohBot);
      ctx.closePath();
    }

    // ── Outer hull silhouette ─────────────────────────────────────────────────
    ctx.save();
    outerPillPath();
    ctx.strokeStyle='rgba(100,130,180,0.35)'; ctx.lineWidth=1.5*DPR;
    ctx.setLineDash([3*DPR,4*DPR]); ctx.stroke(); ctx.setLineDash([]);

    // Sail — trapezoid, no periscopes
    const sailX0v = sailCX - sailW*0.5;
    const sailX1v = sailCX + sailW*0.5;
    ctx.strokeStyle='rgba(140,170,220,0.55)'; ctx.lineWidth=1.5*DPR;
    ctx.beginPath();
    ctx.moveTo(sailX0v + 4*DPR, sailBot);
    ctx.lineTo(sailX0v + 4*DPR, sailTop + 4*DPR);
    ctx.bezierCurveTo(sailX0v+4*DPR,sailTop, sailX0v+10*DPR,sailTop, sailX0v+12*DPR,sailTop);
    ctx.lineTo(sailX1v - 5*DPR, sailTop);
    ctx.lineTo(sailX1v, sailTop + 8*DPR);
    ctx.lineTo(sailX1v, sailBot);
    ctx.stroke();

    // Horizontal stabiliser fins at stern
    const finX = phX1 + ohR*0.7;
    ctx.strokeStyle='rgba(110,140,190,0.40)'; ctx.lineWidth=1*DPR;
    ctx.beginPath(); ctx.moveTo(finX, ohTop+6*DPR); ctx.lineTo(finX+16*DPR, ohTop+2*DPR); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(finX, ohBot-6*DPR); ctx.lineTo(finX+16*DPR, ohBot-2*DPR); ctx.stroke();

    // Propulsor screw at stern tip
    const prX=phX1+ohR-3*DPR, prY=phMid, prR2=8*DPR;
    ctx.strokeStyle='rgba(140,170,220,0.60)'; ctx.lineWidth=1.5*DPR;
    for(let a=0;a<3;a++){
      const ang=a*Math.PI/3;
      ctx.beginPath();
      ctx.moveTo(prX+Math.cos(ang)*prR2*0.3,prY+Math.sin(ang)*prR2*0.3);
      ctx.bezierCurveTo(prX+Math.cos(ang+0.8)*prR2,prY+Math.sin(ang+0.8)*prR2,prX+Math.cos(ang+1.0)*prR2,prY+Math.sin(ang+1.0)*prR2,prX+Math.cos(ang+1.2)*prR2,prY+Math.sin(ang+1.2)*prR2);
      ctx.moveTo(prX+Math.cos(ang+Math.PI)*prR2*0.3,prY+Math.sin(ang+Math.PI)*prR2*0.3);
      ctx.bezierCurveTo(prX+Math.cos(ang+Math.PI+0.8)*prR2,prY+Math.sin(ang+Math.PI+0.8)*prR2,prX+Math.cos(ang+Math.PI+1.0)*prR2,prY+Math.sin(ang+Math.PI+1.0)*prR2,prX+Math.cos(ang+Math.PI+1.2)*prR2,prY+Math.sin(ang+Math.PI+1.2)*prR2);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(prX,prY,2.5*DPR,0,Math.PI*2); ctx.stroke();
    ctx.restore();

    // ── Fill compartments inside pill ─────────────────────────────────────────
    for(let ci=0;ci<6;ci++){
      const comp=compKeys[ci]; const cx2=compXs[ci]; const cw=compWs[ci];
      const sysList=DMG.COMP_DEF[comp].systems;
      let worstIdx=0;
      for(const s of sysList) worstIdx=Math.max(worstIdx,DMG.STATES.indexOf(dmg.systems[s]));
      const worst=DMG.STATES[worstIdx];
      const flood=dmg.flooding[comp]||0;
      const isFlooded=dmg.flooded[comp];

      ctx.save();
      pillPath(); ctx.clip();

      // Extend rects into rounded end caps so bow and stern fill completely
      const fx = ci===0 ? cx2-phR : cx2;
      const fw = (ci===0||ci===5) ? cw+phR : cw;

      ctx.fillStyle=isFlooded?'rgba(8,18,70,0.98)':stFill[worst]||stFill.nominal;
      ctx.fillRect(fx, phTop, fw, phBot-phTop);

      if(flood>0){
        const fH=(phBot-phTop)*flood*0.92;
        ctx.fillStyle=`rgba(28,75,200,${0.28+flood*0.48})`;
        ctx.fillRect(fx, phBot-fH, fw, fH);
        ctx.strokeStyle=`rgba(100,160,255,${0.35+flood*0.35})`; ctx.lineWidth=1.5*DPR;
        ctx.beginPath(); ctx.moveTo(fx, phBot-fH); ctx.lineTo(fx+fw, phBot-fH); ctx.stroke();
      }
      ctx.restore();
    }

    // ── Pressure hull pill border ─────────────────────────────────────────────
    pillPath();
    ctx.strokeStyle='rgba(80,120,180,0.50)'; ctx.lineWidth=1.5*DPR; ctx.stroke();

    // ── Compartment dividers ──────────────────────────────────────────────────
    ctx.save(); pillPath(); ctx.clip();
    for(let ci=1;ci<6;ci++){
      const x=compXs[ci];
      const stA=dmg.systems[DMG.COMP_DEF[compKeys[ci-1]].systems[0]]||'nominal';
      const stB=dmg.systems[DMG.COMP_DEF[compKeys[ci]].systems[0]]||'nominal';
      const worst=Math.max(DMG.STATES.indexOf(stA),DMG.STATES.indexOf(stB));
      ctx.strokeStyle=['rgba(50,120,65,0.50)','rgba(160,130,20,0.60)','rgba(160,60,20,0.70)','rgba(150,30,30,0.80)'][worst]||'rgba(60,90,140,0.40)';
      ctx.lineWidth=1*DPR; ctx.setLineDash([4*DPR,4*DPR]);
      ctx.beginPath(); ctx.moveTo(x, phTop+4*DPR); ctx.lineTo(x, phBot-4*DPR); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();

    // ── Per-compartment details ───────────────────────────────────────────────
    for(let ci=0;ci<6;ci++){
      const comp=compKeys[ci]; const cx2=compXs[ci]; const cw=compWs[ci];
      const flood=dmg.flooding[comp]||0;
      const isFlooded=dmg.flooded[comp];
      const sysList=DMG.COMP_DEF[comp].systems;
      let worstIdx=0;
      for(const s of sysList) worstIdx=Math.max(worstIdx,DMG.STATES.indexOf(dmg.systems[s]));
      const worst=DMG.STATES[worstIdx];
      const cMid=cx2+cw*0.5;

      if(worstIdx>0){
        ctx.save(); pillPath(); ctx.clip();
        const glowCols=['','rgba(220,170,20,0.18)','rgba(220,80,20,0.22)','rgba(200,30,30,0.30)'];
        ctx.fillStyle=glowCols[worstIdx]||'';
        const fx2=ci===0?cx2-phR:cx2, fw2=(ci===0||ci===5)?cw+phR:cw;
        ctx.fillRect(fx2,phTop,fw2,phBot-phTop);
        ctx.strokeStyle=stStroke[worst]; ctx.lineWidth=1*DPR; ctx.setLineDash([3*DPR,3*DPR]);
        ctx.strokeRect(cx2+1,phTop+1,cw-2,phBot-phTop-2);
        ctx.setLineDash([]);
        ctx.restore();
      }

      ctx.fillStyle='rgba(200,220,255,0.88)'; ctx.font=`bold ${9*DPR}px ui-monospace,monospace`; ctx.textAlign='center';
      ctx.fillText(compLabels[ci], cMid, phTop+12*DPR);

      const cc=dmg.crew[comp]||[];
      const aw=game.activeWatch||'A';
      // Watchkeepers only — on-watch (active watch + duty), not support depts
      const wk=cc.filter(c=>(c.watch===aw||c.watch==='duty')&&c.dept!=='medical'&&c.dept!=='supply');
      const wkFit=wk.filter(c=>c.status==='fit'&&!c.displaced).length;
      const wkDisp=wk.filter(c=>c.displaced&&c.status!=='killed').length;
      const wkKia=wk.filter(c=>c.status==='killed').length;
      const wkTotal=wk.length-wkKia;
      const crewLabel=wkDisp>0?`${wkFit}+${wkDisp}d/${wkTotal}`:`${wkFit}/${wkTotal}`;
      ctx.fillStyle=wkKia>0?'rgba(220,80,80,0.85)':wkDisp>0?'rgba(200,170,50,0.80)':'rgba(90,190,110,0.75)';
      ctx.font=`${9*DPR}px ui-monospace,monospace`;
      ctx.fillText(crewLabel, cMid, phBot-10*DPR);

      // Fire overlay — section max across all rooms
      const fireLevel=Math.max(...[0,1,2].map(di=>dmg.fire?.[`${comp}_d${di}`]||0));
      if(fireLevel>0.02){
        ctx.save(); pillPath(); ctx.clip();
        const fx2=ci===0?cx2-phR:cx2, fw2=(ci===0||ci===5)?cw+phR:cw;
        ctx.fillStyle=`rgba(200,80,0,${0.15+fireLevel*0.30})`;
        ctx.fillRect(fx2,phTop,fw2,phBot-phTop);
        ctx.restore();
      }

      if(isFlooded){
        ctx.fillStyle='rgba(140,180,255,0.95)'; ctx.font=`bold ${10*DPR}px ui-monospace,monospace`;
        ctx.fillText('FLOODED', cMid, phMid+4*DPR);
      } else if(fireLevel>0.02){
        ctx.fillStyle=fireLevel>0.85?'rgba(255,80,20,0.95)':'rgba(255,140,40,0.90)';
        ctx.font=`bold ${9*DPR}px ui-monospace,monospace`;
        ctx.fillText(dmg._fireDrench?.[comp]?'DRENCHED':`FIRE ${Math.round(fireLevel*100)}%`, cMid, phMid+4*DPR);
      } else if(flood>0.02){
        ctx.fillStyle='rgba(140,190,255,0.90)'; ctx.font=`${9*DPR}px ui-monospace,monospace`;
        ctx.fillText(`${Math.round(flood*100)}%`, cMid, phMid+4*DPR);
      }

    }
    cy=schY+schH+10*DPR;

    // ── DC Team dispatch rows ─────────────────────────────────────────────────
    // Buttons aligned to compartment columns (same grid as the schematic above).
    // Team label occupies the space left of phX0 (bow cap space).
    {
      const teamList=[dmg.teams?.alpha, dmg.teams?.bravo].filter(Boolean);
      const dispBtnH=22*DPR;
      const dispGap=3*DPR;
      const labelW=phX0-schX; // space between schX and first compartment column

      for(let ti=0;ti<teamList.length;ti++){
        const team=teamList[ti];
        const rowY=cy+ti*(dispBtnH+dispGap+2*DPR);

        // Team label pill — sits in bow-cap space to the left of compartment columns
        const isReady=team.state==='ready';
        const isMusteringEmerg=team._readyT>0;
        const isLocked=team._locked;
        const tLabelCol=team.state==='lost'?'rgba(180,30,30,0.80)':isMusteringEmerg?'rgba(170,100,0,0.80)':team.state==='mustering'?'rgba(160,110,15,0.75)':isReady?'rgba(80,80,90,0.70)':team.task==='flood'?'rgba(30,70,160,0.75)':'rgba(30,100,50,0.75)';
        ctx.fillStyle=tLabelCol; ctx.beginPath(); ctx.roundRect(schX,rowY,labelW-dispGap,dispBtnH,3*DPR); ctx.fill();
        ctx.fillStyle='rgba(220,220,240,0.90)'; ctx.font=`bold ${9*DPR}px ui-monospace,monospace`; ctx.textAlign='center';
        const pillTxt=isMusteringEmerg?`MSTR ${Math.ceil(team._readyT)}s`:isLocked?team.label.replace('DC ','')+' \u{1F512}':team.label.replace('DC ','');
        ctx.fillText(pillTxt,schX+(labelW-dispGap)/2,rowY+dispBtnH*0.68);

        // One button per compartment, X-aligned to schematic columns
        for(let ci=0;ci<6;ci++){
          const comp=compKeys[ci];
          const bx=compXs[ci]+dispGap/2;
          const bw=compWs[ci]-dispGap;
          const lbl=compLabels[ci].slice(0,3);
          const isOnScene   = team.state==='on_scene'  && team.location===comp;
          const isInTransit = team.state==='transit'   && team.destination===comp;
          const isMustering = team.state==='mustering' && team.destination===comp;
          const isFlooded  = dmg.flooded[comp];
          const fireLevel  = Math.max(...[0,1,2].map(di=>dmg.fire?.[`${comp}_d${di}`]||0));
          const hasFire    = fireLevel>0.02;
          const isDrenched = !!dmg._fireDrench?.[comp];

          let bCol, bLabel, clickFn;
          if(team.state==='lost'){
            bCol='rgba(30,30,30,0.22)'; bLabel=lbl; clickFn=null;
          } else if(team.state==='blowing'&&team.location===comp){
            bCol='rgba(180,90,0,0.85)'; bLabel='BLOW';
            clickFn=()=>DMG.recallTeam(team.id);
          } else if(isDrenched){
            bCol='rgba(40,40,50,0.45)'; bLabel='N2'; clickFn=null;
          } else if(isFlooded){
            const isBlowingHere=(team.state==='blowing'&&team.location===comp)||(team.state==='transit'&&team.destination===comp);
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
          } else if(hasFire){
            bCol='rgba(140,40,5,0.75)'; bLabel='FIRE';
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
      cy+=teamList.length*(dispBtnH+dispGap+2*DPR)+6*DPR;
    }

    // ── Systems grid ──────────────────────────────────────────────────────────
    const stColText={'nominal':'rgba(80,200,100,0.80)','degraded':'rgba(230,170,20,0.90)','offline':'rgba(230,90,30,0.90)','destroyed':'rgba(200,50,50,0.95)'};
    for(let ci=0;ci<6;ci++){
      const comp=compKeys[ci]; const cx2=compXs[ci]; const cw=compWs[ci];
      const sysList=DMG.COMP_DEF[comp].systems;
      let sy=cy;
      for(const sys of sysList){
        const st=dmg.systems[sys];
        ctx.fillStyle='rgba(160,180,220,0.70)'; ctx.font=`${9*DPR}px ui-monospace,monospace`; ctx.textAlign='center';
        ctx.fillText(DMG.SYS_LABEL[sys]||sys,cx2+cw/2,sy); sy+=12*DPR;
        ctx.fillStyle=stColText[st]||stColText.destroyed; ctx.font=`bold ${9*DPR}px ui-monospace,monospace`;
        ctx.fillText(st.toUpperCase(),cx2+cw/2,sy); sy+=10*DPR;
      }
    }

    // ── Escape buttons ────────────────────────────────────────────────────────
    const escY=OY+OH-96*DPR;
    ctx.fillStyle='rgba(120,140,180,0.50)'; ctx.font=`${10*DPR}px ui-monospace,monospace`; ctx.textAlign='left';
    ctx.fillText('ESCAPE',OX+P,escY);
    const halfEsc=(OW-P*2-6*DPR)/2;
    const tceViable=DMG.canTCE(); const escActive=!!dmg.escapeState;
    PNL.btn2(ctx,escActive?'ESCAPING…':'TCE ESCAPE',OX+P,escY+4*DPR,halfEsc,18*DPR,
      escActive?'rgba(30,80,30,0.50)':tceViable?'rgba(20,60,20,0.70)':'rgba(60,60,60,0.30)',
      ()=>{ if(!escActive&&tceViable) DMG.initiateEscape('tce'); });
    PNL.btn2(ctx,escActive?'ESCAPING…':'RUSH ESCAPE',OX+P+halfEsc+6*DPR,escY+4*DPR,halfEsc,18*DPR,
      escActive?'rgba(80,30,30,0.50)':'rgba(100,30,10,0.70)',
      ()=>{ if(!escActive) DMG.initiateEscape('rush'); });
    const depthM=Math.round(player.depth||0);
    const depthAdv=depthM<=120?'TCE & RUSH viable':depthM<=200?'TCE marginal':'TCE not viable';
    const depthAdvCol=depthM<=120?'rgba(80,200,80,0.70)':depthM<=200?'rgba(220,170,20,0.80)':'rgba(220,80,50,0.80)';
    ctx.fillStyle=depthAdvCol; ctx.font=`${9*DPR}px ui-monospace,monospace`; ctx.textAlign='center';
    ctx.fillText(`${depthM}m — ${depthAdv}`,OX+OW/2,escY+30*DPR);

    // ── SEAL buttons ──────────────────────────────────────────────────────────
    const sealY=OY+OH-52*DPR;
    ctx.fillStyle='rgba(80,100,140,0.40)'; ctx.font=`${8*DPR}px ui-monospace,monospace`; ctx.textAlign='left';
    ctx.fillText('SEAL (last resort — kills all crew inside):',OX+P,sealY);
    for(let ci=0;ci<6;ci++){
      const comp=compKeys[ci]; const cx2=compXs[ci]; const cw=compWs[ci];
      if(!dmg.flooded[comp]&&(dmg.flooding[comp]||0)>0.05){
        PNL.btn2(ctx,compLabels[ci].slice(0,3),cx2+2,sealY+4*DPR,cw-4,14*DPR,'rgba(100,30,30,0.60)',()=>DMG.sealFlooding(comp));
      }
    }

    // ── Debug hit buttons ─────────────────────────────────────────────────────
    if(game.debugOverlay){
      const dbgY=OY+OH-26*DPR;
      ctx.fillStyle='rgba(200,50,50,0.60)'; ctx.font=`${9*DPR}px ui-monospace,monospace`; ctx.textAlign='left';
      ctx.fillText('[ DEBUG ] HIT:',OX+P,dbgY-2*DPR);
      const dbgW=(OW-P*2-4*DPR)/6;
      for(let i=0;i<6;i++){
        const comp=DMG.COMPS[i]; const isHit=(dmg.strikes[comp]||0)>=1;
        PNL.btn2(ctx,compLabels[i].slice(0,3),OX+P+i*dbgW,dbgY,dbgW-3*DPR,14*DPR,
          isHit?'rgba(180,30,30,0.80)':'rgba(100,30,30,0.55)',()=>DMG.hit(55,null,null,comp));
      }
    }
  }

  // ── Crew Manifest Panel ───────────────────────────────────────────────────────
  function drawCrewPanel(W,H,panelH){
    if(!game.showCrewPanel||game.showDamageScreen) return;
    const d=player.damage;
    if(!d) return;
    const DMG=window.DMG;
    const PNL=window.PANEL;

    const OW=820*DPR, OH=740*DPR;
    const OX=Math.round(W/2-OW/2), OY=Math.round(H/2-OH/2);
    const P=12*DPR;

    // Panel background
    ctx.fillStyle='rgba(6,12,22,0.97)';
    ctx.strokeStyle='rgba(60,100,160,0.40)';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.roundRect(OX,OY,OW,OH,6*DPR); ctx.fill(); ctx.stroke();

    const activeWatch=game.activeWatch||'A';

    // Title bar
    let cy=OY+P+14*DPR;
    ctx.fillStyle='rgba(140,180,240,0.92)';
    ctx.font=`bold ${15*DPR}px ui-monospace,monospace`;
    ctx.textAlign='left';
    ctx.fillText("SHIP'S COMPANY",OX+P,cy);
    ctx.fillStyle='rgba(100,130,180,0.55)';
    ctx.font=`${10*DPR}px ui-monospace,monospace`;
    ctx.textAlign='right';
    ctx.fillText('[Y] close',OX+OW-P,cy);

    // ── Watch status row ──────────────────────────────────────────────────────
    cy+=20*DPR;
    const fatigue=game.watchFatigue||0;
    const changing=game.watchChanging||false;
    const changeT=game.watchChangeT||0;

    // Watch pill
    const watchLabel=changing?`WATCH ${activeWatch} → ${activeWatch==='A'?'B':'A'}`:`WATCH ${activeWatch} ON`;
    const watchBg=changing?'rgba(80,60,10,0.75)':activeWatch==='A'?'rgba(30,70,150,0.75)':'rgba(10,100,90,0.75)';
    const watchFg=changing?'rgba(255,200,60,0.95)':activeWatch==='A'?'rgba(140,190,255,0.95)':'rgba(80,220,200,0.95)';
    ctx.fillStyle=watchBg;
    ctx.beginPath(); ctx.roundRect(OX+P,cy-13*DPR,108*DPR,18*DPR,3*DPR); ctx.fill();
    ctx.fillStyle=watchFg;
    ctx.font=`bold ${10*DPR}px ui-monospace,monospace`;
    ctx.textAlign='center';
    ctx.fillText(watchLabel,OX+P+54*DPR,cy-1*DPR);

    // Fatigue bar (120px wide, sits right of watch pill)
    const barX=OX+P+114*DPR, barY=cy-12*DPR, barW=120*DPR, barH=14*DPR;
    ctx.fillStyle='rgba(20,30,50,0.70)';
    ctx.beginPath(); ctx.roundRect(barX,barY,barW,barH,2*DPR); ctx.fill();
    const fatigueCol=fatigue>=0.8?'rgba(210,60,40,0.85)':fatigue>=0.5?'rgba(220,160,30,0.85)':'rgba(50,180,80,0.75)';
    if(fatigue>0){
      ctx.fillStyle=fatigueCol;
      ctx.beginPath(); ctx.roundRect(barX+1,barY+1,Math.max(2*DPR,(barW-2)*fatigue),barH-2,2*DPR); ctx.fill();
    }
    ctx.fillStyle='rgba(140,165,210,0.60)';
    ctx.font=`${8*DPR}px ui-monospace,monospace`;
    ctx.textAlign='left';
    ctx.fillText('FATIGUE',barX+3*DPR,cy-2*DPR);
    ctx.textAlign='right';
    ctx.fillText(`${Math.round(fatigue*100)}%`,barX+barW-3*DPR,cy-2*DPR);

    // Watch change countdown (shown during transition)
    if(changing){
      ctx.fillStyle='rgba(255,200,60,0.80)';
      ctx.font=`${9*DPR}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillText(`RELIEVING — ${Math.ceil(changeT)}s`,barX+barW+8*DPR,cy-2*DPR);
    }

    // RELIEVE WATCH button (right side)
    const relBtnX=OX+OW-P-110*DPR;
    const canRelieve=!changing&&game.tacticalState!=='action'&&game.casualtyState!=='emergency';
    const relBg=canRelieve?'rgba(30,60,120,0.75)':'rgba(30,40,60,0.40)';
    const relFg=canRelieve?'rgba(140,190,255,0.90)':'rgba(80,100,130,0.50)';
    ctx.fillStyle=relBg;
    ctx.beginPath(); ctx.roundRect(relBtnX,cy-13*DPR,108*DPR,18*DPR,3*DPR); ctx.fill();
    ctx.fillStyle=relFg;
    ctx.font=`bold ${9*DPR}px ui-monospace,monospace`;
    ctx.textAlign='center';
    ctx.fillText(changing?'CHANGING…':'RELIEVE WATCH [W]',relBtnX+54*DPR,cy-1*DPR);
    if(canRelieve){
      PNL.btn2(ctx,'',relBtnX,cy-13*DPR,108*DPR,18*DPR,'transparent',
        ()=>{ window.SIM?.initiateWatchChange?.(); });
    }

    cy+=10*DPR;

    // Crew totals row
    const fit=DMG.totalFit(),wnd=DMG.totalWounded(),kia=DMG.totalKilled(),tot=DMG.totalCrew();
    ctx.font=`${12*DPR}px ui-monospace,monospace`;
    ctx.textAlign='left';
    ctx.fillStyle='rgba(60,200,90,0.85)';   ctx.fillText(`FIT ${fit}`,  OX+P+112*DPR, cy-1*DPR);
    ctx.fillStyle='rgba(230,170,30,0.90)';  ctx.fillText(`WND ${wnd}`,  OX+P+184*DPR, cy-1*DPR);
    ctx.fillStyle='rgba(210,50,50,0.90)';   ctx.fillText(`KIA ${kia}`,  OX+P+256*DPR, cy-1*DPR);
    ctx.fillStyle='rgba(140,165,210,0.60)'; ctx.fillText(`/ ${tot}`,    OX+P+328*DPR, cy-1*DPR);
    cy+=8*DPR;

    // Divider
    ctx.strokeStyle='rgba(60,100,160,0.25)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(OX,cy); ctx.lineTo(OX+OW,cy); ctx.stroke();
    cy+=10*DPR;

    // ── Layout: 2 columns of compartment sections ─────────────────────────────
    const colW=(OW-P*2-10*DPR)/2;
    const col0x=OX+P, col1x=OX+P+colW+10*DPR;

    const COMP_LABELS={
      fore_ends:'TORPEDO ROOM', control_room:'CONTROL ROOM', aux_section:'AUX MACHINERY',
      reactor_comp:'REACTOR COMP', engine_room:'MANEUVERING', aft_ends:'ENGINEERING',
    };
    // Support departments rendered in their own section, not mixed into compartments
    const SUPPORT_DEPTS=new Set(['medical','supply']);
    // Left col: fore_ends, control_room, aux_section, reactor_comp | Right col: engine_room, aft_ends
    const leftComps=['fore_ends','control_room','aux_section','reactor_comp'];
    const rightComps=['engine_room','aft_ends'];

    const ROW_H=16*DPR;
    const SEC_HDR=20*DPR;

    const STATUS_COL={fit:'rgba(50,190,80,0.90)',wounded:'rgba(230,165,25,0.90)',killed:'rgba(200,40,40,0.75)'};

    // Collect hover hit areas for tooltip rendering after all draw calls
    const _hoverHits=[];  // {x,y,w,h,tip}
    // mouseX/mouseY from input.js are already in canvas pixels (css*DPR)
    const mx=window.I?.mouseX||0, my=window.I?.mouseY||0;

    function drawCrewRow(m, rx, ry, subW, isDuty){
      const isKia=m.status==='killed';
      const isWnd=m.status==='wounded';
      const isOnWatch=m.watch==='duty'||m.watch===activeWatch;
      ctx.globalAlpha=isKia?0.35:isOnWatch?1.0:0.55;

      const pillW=32*DPR;
      const rowTop=ry-ROW_H*0.82;

      // Status dot
      ctx.fillStyle=STATUS_COL[m.status]||STATUS_COL.fit;
      ctx.beginPath(); ctx.arc(rx+5*DPR,ry-4*DPR,3.5*DPR,0,Math.PI*2); ctx.fill();

      // Rating pill
      ctx.fillStyle=isWnd?'rgba(200,140,20,0.70)':isKia?'rgba(140,20,20,0.50)':'rgba(30,55,100,0.65)';
      ctx.beginPath(); ctx.roundRect(rx+12*DPR,rowTop,pillW,ROW_H*0.85,2*DPR); ctx.fill();
      ctx.fillStyle='rgba(200,220,255,0.90)';
      ctx.font=`bold ${9*DPR}px ui-monospace,monospace`;
      ctx.textAlign='center';
      ctx.fillText(m.rating,rx+12*DPR+pillW/2,ry-2*DPR);

      // Name
      ctx.fillStyle=isKia?'rgba(180,60,60,0.60)':isWnd?'rgba(220,165,30,0.90)':'rgba(200,215,245,0.90)';
      ctx.font=`${11*DPR}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillText(`${m.firstName[0]}.${m.lastName}`,rx+48*DPR,ry-2*DPR);

      // Role short code (right-aligned before badges)
      const badgesW=isDuty?20*DPR:36*DPR; // duty: only watch badge; others: watch+dc
      const roleX=rx+subW-badgesW-4*DPR;
      ctx.fillStyle='rgba(120,170,220,0.70)';
      ctx.font=`${9*DPR}px ui-monospace,monospace`;
      ctx.textAlign='right';
      ctx.fillText(m.role||'',roleX,ry-2*DPR);

      // Watch badge
      const badgeX=rx+subW-badgesW;
      const watchBadgeBg=m.watch==='duty'?'rgba(160,120,20,0.65)':m.watch==='A'?'rgba(25,55,130,0.65)':'rgba(10,90,80,0.65)';
      const watchBadgeFg=m.watch==='duty'?'rgba(255,210,60,0.95)':m.watch==='A'?'rgba(120,170,255,0.95)':'rgba(60,210,185,0.95)';
      const watchBadgeLabel=m.watch==='duty'?'★':m.watch;
      ctx.fillStyle=watchBadgeBg;
      ctx.beginPath(); ctx.roundRect(badgeX,rowTop,16*DPR,ROW_H*0.80,2*DPR); ctx.fill();
      ctx.fillStyle=watchBadgeFg;
      ctx.font=`bold ${8*DPR}px ui-monospace,monospace`;
      ctx.textAlign='center';
      ctx.fillText(watchBadgeLabel,badgeX+8*DPR,ry-2*DPR);

      // DC team badge
      if(m.dcTeam){
        const dcX=badgeX+18*DPR;
        const dcBg=m.dcTeam==='alpha'?'rgba(140,40,130,0.65)':'rgba(40,100,40,0.65)';
        const dcFg=m.dcTeam==='alpha'?'rgba(230,140,220,0.95)':'rgba(120,230,120,0.95)';
        ctx.fillStyle=dcBg;
        ctx.beginPath(); ctx.roundRect(dcX,rowTop,16*DPR,ROW_H*0.80,2*DPR); ctx.fill();
        ctx.fillStyle=dcFg;
        ctx.font=`bold ${8*DPR}px ui-monospace,monospace`;
        ctx.textAlign='center';
        ctx.fillText(m.dcTeam==='alpha'?'α':'β',dcX+8*DPR,ry-2*DPR);
      }

      ctx.globalAlpha=1.0;

      // Register hover hit area for tooltip
      if(m.roleDesc){
        _hoverHits.push({x:rx,y:rowTop,w:subW,h:ROW_H,tip:m.roleDesc});
      }
    }

    function drawCompSection(comp, sx, sy, availW){
      const crew=(d.crew[comp]||[]).filter(m=>!SUPPORT_DEPTS.has(m.dept));
      // Section header
      const fitC=crew.filter(c=>c.status==='fit'&&!c.displaced).length;
      const wndC=crew.filter(c=>c.status==='wounded').length;
      const kiaC=crew.filter(c=>c.status==='killed').length;
      const hasFireOrFlood=[0,1,2].some(di=>(d.fire?.[`${comp}_d${di}`]||0)>0.02)||d.flooded?.[comp]||(d.flooding?.[comp]||0)>0.01;
      const hdrBg=hasFireOrFlood?'rgba(100,30,10,0.55)':'rgba(20,38,70,0.60)';
      ctx.fillStyle=hdrBg;
      ctx.beginPath(); ctx.roundRect(sx,sy,availW,SEC_HDR,2*DPR); ctx.fill();
      ctx.fillStyle='rgba(180,210,255,0.90)';
      ctx.font=`bold ${11*DPR}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillText(COMP_LABELS[comp],sx+6*DPR,sy+SEC_HDR*0.72);
      ctx.font=`${10*DPR}px ui-monospace,monospace`;
      ctx.textAlign='right';
      const sumStr=kiaC>0?`${fitC} fit  ${wndC} wnd  ${kiaC} kia`:`${fitC}/${crew.length} fit`;
      ctx.fillStyle=kiaC>0?'rgba(210,60,60,0.85)':wndC>0?'rgba(220,160,30,0.80)':'rgba(80,190,100,0.70)';
      ctx.fillText(sumStr,sx+availW-6*DPR,sy+SEC_HDR*0.72);
      sy+=SEC_HDR+2*DPR;

      // Split by watch: duty (full-width strip), then B (left sub-col), A (right sub-col)
      const dutyList=crew.filter(m=>m.watch==='duty');
      const watchB=crew.filter(m=>m.watch==='B');
      const watchA=crew.filter(m=>m.watch==='A');
      const subW=(availW-4*DPR)/2;

      // Duty strip — full width rows
      for(let i=0;i<dutyList.length;i++){
        const m=dutyList[i];
        const ry=sy+i*ROW_H+ROW_H*0.82;
        // Thin background stripe for duty
        ctx.fillStyle='rgba(140,110,10,0.12)';
        ctx.fillRect(sx,sy+i*ROW_H,availW,ROW_H-1);
        drawCrewRow(m, sx, ry, availW, true);
      }
      if(dutyList.length) sy+=dutyList.length*ROW_H+2*DPR;

      // Sub-column header labels
      if(watchB.length||watchA.length){
        const activeWatchB=activeWatch==='B';
        const activeWatchA=activeWatch==='A';
        ctx.font=`bold ${8*DPR}px ui-monospace,monospace`;
        ctx.textAlign='center';
        ctx.fillStyle=activeWatchB?'rgba(60,210,185,0.80)':'rgba(60,210,185,0.40)';
        ctx.fillText('── WCH B ──',sx+subW/2,sy+8*DPR);
        ctx.fillStyle=activeWatchA?'rgba(120,170,255,0.80)':'rgba(120,170,255,0.40)';
        ctx.fillText('── WCH A ──',sx+subW+4*DPR+subW/2,sy+8*DPR);
        sy+=11*DPR;
      }

      // Watch B (left) and Watch A (right) columns
      const rows=Math.max(watchB.length,watchA.length);
      for(let i=0;i<watchB.length;i++){
        const m=watchB[i];
        const ry=sy+i*ROW_H+ROW_H*0.82;
        drawCrewRow(m, sx, ry, subW, false);
      }
      for(let i=0;i<watchA.length;i++){
        const m=watchA[i];
        const ry=sy+i*ROW_H+ROW_H*0.82;
        drawCrewRow(m, sx+subW+4*DPR, ry, subW, false);
      }

      return sy+rows*ROW_H+6*DPR;
    }

    // Support section — collects medical/supply from all compartments
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

      // Section header
      const fitC=allSupport.filter(c=>c.status==='fit').length;
      const wndC=allSupport.filter(c=>c.status==='wounded').length;
      const kiaC=allSupport.filter(c=>c.status==='killed').length;
      ctx.fillStyle='rgba(20,38,70,0.60)';
      ctx.beginPath(); ctx.roundRect(sx,sy,availW,SEC_HDR,2*DPR); ctx.fill();
      ctx.fillStyle='rgba(180,210,255,0.90)';
      ctx.font=`bold ${11*DPR}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillText('SHIP SUPPORT',sx+6*DPR,sy+SEC_HDR*0.72);
      ctx.font=`${10*DPR}px ui-monospace,monospace`;
      ctx.textAlign='right';
      const sumStr=kiaC>0?`${fitC} fit  ${wndC} wnd  ${kiaC} kia`:`${fitC}/${allSupport.length} fit`;
      ctx.fillStyle=kiaC>0?'rgba(210,60,60,0.85)':wndC>0?'rgba(220,160,30,0.80)':'rgba(80,190,100,0.70)';
      ctx.fillText(sumStr,sx+availW-6*DPR,sy+SEC_HDR*0.72);
      sy+=SEC_HDR+2*DPR;

      // Render each dept as a labelled sub-group using duty/B/A split
      for(const dept of deptOrder){
        const crew=allSupport.filter(m=>m.dept===dept);
        if(crew.length===0) continue;

        // Dept sub-label
        ctx.fillStyle='rgba(100,130,180,0.50)';
        ctx.font=`bold ${8*DPR}px ui-monospace,monospace`;
        ctx.textAlign='left';
        ctx.fillText(deptLabel[dept],sx+6*DPR,sy+8*DPR);
        sy+=11*DPR;

        const dutyList=crew.filter(m=>m.watch==='duty');
        const watchB=crew.filter(m=>m.watch==='B');
        const watchA=crew.filter(m=>m.watch==='A');
        const subW=(availW-4*DPR)/2;

        for(let i=0;i<dutyList.length;i++){
          const m=dutyList[i];
          const ry=sy+i*ROW_H+ROW_H*0.82;
          ctx.fillStyle='rgba(140,110,10,0.12)';
          ctx.fillRect(sx,sy+i*ROW_H,availW,ROW_H-1);
          drawCrewRow(m, sx, ry, availW, true);
        }
        if(dutyList.length) sy+=dutyList.length*ROW_H+2*DPR;

        const rows=Math.max(watchB.length,watchA.length);
        for(let i=0;i<watchB.length;i++){
          const m=watchB[i];
          drawCrewRow(m, sx, sy+i*ROW_H+ROW_H*0.82, subW, false);
        }
        for(let i=0;i<watchA.length;i++){
          const m=watchA[i];
          drawCrewRow(m, sx+subW+4*DPR, sy+i*ROW_H+ROW_H*0.82, subW, false);
        }
        sy+=rows*ROW_H+4*DPR;
      }
      return sy+4*DPR;
    }

    // Draw left column
    let ly=cy;
    for(const comp of leftComps){
      ly=drawCompSection(comp,col0x,ly,colW);
      ly+=4*DPR;
    }

    // Draw right column — compartments then support section
    let ry2=cy;
    for(const comp of rightComps){
      ry2=drawCompSection(comp,col1x,ry2,colW);
      ry2+=4*DPR;
    }
    drawSupportSection(col1x, ry2, colW);

    // Close button
    PNL.btn2(ctx,'CLOSE',OX+OW/2-40*DPR,OY+OH-26*DPR,80*DPR,18*DPR,'rgba(30,50,90,0.70)',
      ()=>{ game.showCrewPanel=false; });

    // Hover tooltip — draw on top of everything else
    for(const h of _hoverHits){
      if(mx>=h.x&&mx<=h.x+h.w&&my>=h.y&&my<=h.y+h.h){
        const tip=h.tip;
        ctx.font=`${11*DPR}px ui-monospace,monospace`;
        const tw=ctx.measureText(tip).width+12*DPR;
        const th=16*DPR;
        let tx=mx+10*DPR, ty=my-4*DPR;
        if(tx+tw>OX+OW) tx=mx-tw-4*DPR;
        if(ty+th>OY+OH) ty=my-th-4*DPR;
        ctx.fillStyle='rgba(5,12,30,0.94)';
        ctx.strokeStyle='rgba(80,140,220,0.55)';
        ctx.lineWidth=1;
        ctx.beginPath(); ctx.roundRect(tx,ty,tw,th,3*DPR); ctx.fill(); ctx.stroke();
        ctx.fillStyle='rgba(200,220,255,0.95)';
        ctx.textAlign='left';
        ctx.fillText(tip,tx+6*DPR,ty+th*0.72);
        break;
      }
    }
  }

  // ── Command Panel ────────────────────────────────────────────────────────────
  function drawPanel(W,H){
    const panelH=PANEL_H;
    const panelY=H-panelH;
    const panelW=W-STRIP_W;
    const PANEL=window.PANEL;
    PANEL.clearBtns();

    // Background
    ctx.fillStyle='rgba(241,245,249,0.97)';
    ctx.fillRect(0,panelY,panelW,panelH);
    ctx.strokeStyle='rgba(17,24,39,0.14)';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,panelY); ctx.lineTo(panelW,panelY); ctx.stroke();

    const pad=8*DPR;
    const sectionDivider=(x)=>{
      ctx.strokeStyle='rgba(17,24,39,0.10)';
      ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(x,panelY+pad); ctx.lineTo(x,H-pad); ctx.stroke();
    };

    // Helper: small clickable button
    // btn — state: 'available'(default), 'unavailable', 'emergency'
    // active=true  → activeCol bg, white text (in-use / selected)
    // active=false, state='available'   → mid-grey bg, readable text — sensitised
    // active=false, state='unavailable' → faint bg, very dim text — not usable
    // active=true,  state='emergency'   → red bg, white text
    function btn(label,x,y,w,h,active,action,activeCol,state){
      state = state || 'available';
      activeCol = activeCol || '#1e3a5f';
      let bg, fg, stroke = null;
      if(active){
        bg     = state==='emergency' ? '#7c1010' : activeCol;
        fg     = '#f0f4ff';
        stroke = state==='emergency' ? 'rgba(220,50,50,0.55)' : 'rgba(80,120,200,0.35)';
      } else if(state==='unavailable'){
        bg = 'rgba(17,24,39,0.05)';
        fg = 'rgba(100,110,130,0.30)';
      } else {
        // available — clearly clickable
        bg = 'rgba(30,45,70,0.38)';
        fg = 'rgba(190,205,230,0.85)';
        stroke = 'rgba(60,90,140,0.20)';
      }
      ctx.fillStyle=bg;
      ctx.beginPath(); ctx.roundRect(x,y,w,h,3); ctx.fill();
      if(stroke){
        ctx.strokeStyle=stroke; ctx.lineWidth=1;
        ctx.beginPath(); ctx.roundRect(x,y,w,h,3); ctx.stroke();
      }
      ctx.fillStyle=fg;
      ctx.font=`${14*DPR}px ui-monospace,monospace`;
      ctx.textAlign='center';
      ctx.fillText(label,x+w/2,y+h/2+4.5*DPR);
      if(state!=='unavailable') PANEL.registerBtn(x,y,w,h,action);
    }

    // ── SECTION 1: Engine Telegraph ──────────────────────────────────────────
    const telegW=160*DPR;
    const telegX=pad;
    ctx.fillStyle='rgba(17,24,39,0.35)';
    ctx.font=`${11*DPR}px ui-monospace,monospace`;
    ctx.textAlign='left';
    ctx.fillText('ENGINE ORDER',telegX,panelY+18*DPR);

    const states=PANEL.SPEED_STATES;
    const btnH=16*DPR;
    const btnGap=2*DPR;
    const totalBtnH=states.length*(btnH+btnGap)-btnGap;
    const startBtnY=panelY+24*DPR;

    for(let i=0;i<states.length;i++){
      const s=states[i];
      const by=startBtnY+i*(btnH+btnGap);
      const isActive=PANEL.telegraphIdx===i;
      const col=s.dir>0?'#1e3a5f':s.dir===0?'#374151':'#7f1d1d';
      btn(s.label,telegX,by,telegW-pad,btnH,isActive,()=>PANEL.setTelegraph(i),col);
    }

    sectionDivider(telegX+telegW);

    // ── SECTION 2: Depth Control ──────────────────────────────────────────────
    const depthSecX=telegX+telegW+pad;
    const depthSecW=130*DPR;

    ctx.fillStyle='rgba(17,24,39,0.35)';
    ctx.font=`${11*DPR}px ui-monospace,monospace`;
    ctx.textAlign='left';
    ctx.fillText('DEPTH ORDER',depthSecX,panelY+18*DPR);

    // ACTUAL left, ORDERED right — enough space at 130px wide
    ctx.fillStyle='rgba(17,24,39,0.40)'; ctx.font=`${9*DPR}px ui-monospace,monospace`;
    ctx.fillText('ACTUAL',depthSecX,panelY+33*DPR);
    ctx.fillStyle='#111827'; ctx.font=`${16*DPR}px ui-monospace,monospace`;
    ctx.fillText(`${Math.round(player.depth)}m`,depthSecX,panelY+50*DPR);

    ctx.fillStyle='rgba(17,24,39,0.40)'; ctx.font=`${9*DPR}px ui-monospace,monospace`;
    ctx.fillText('ORDERED',depthSecX+64*DPR,panelY+33*DPR);
    ctx.fillStyle='#111827'; ctx.font=`${16*DPR}px ui-monospace,monospace`;
    ctx.fillText(`${Math.round(player.depthOrder)}m`,depthSecX+64*DPR,panelY+50*DPR);

    // Depth step buttons — two rows, bigger step on outside
    const arrowY=panelY+62*DPR;
    const arrowH=20*DPR;
    const aGap=4*DPR;
    const aHalf=(depthSecW-pad-aGap)/2;
    // Row 1: shallower
    btn('▲ 50',depthSecX,       arrowY,aHalf,arrowH,false,()=>PANEL.depthStep(-50));
    btn('▲ 10',depthSecX+aHalf+aGap,arrowY,aHalf,arrowH,false,()=>PANEL.depthStep(-10));
    // Row 2: deeper
    btn('▼ 10',depthSecX,       arrowY+arrowH+3*DPR,aHalf,arrowH,false,()=>PANEL.depthStep(10));
    btn('▼ 50',depthSecX+aHalf+aGap,arrowY+arrowH+3*DPR,aHalf,arrowH,false,()=>PANEL.depthStep(50));

    // PD button
    const pdY=panelY+110*DPR;
    const atPD=player.depthOrder<=C.player.periscopeDepth+10;
    btn('COME TO PD',depthSecX,pdY,depthSecW-pad,20*DPR,atPD,()=>PANEL.comeToPD(),'#1e3a5f');



    sectionDivider(depthSecX+depthSecW);

    // ── SECTION 3: Ship Trim / Buoyancy / HPA ────────────────────────────────
    const trimSecX=depthSecX+depthSecW+pad;
    const trimSecW=215*DPR;

    ctx.fillStyle='rgba(17,24,39,0.35)';
    ctx.font=`${11*DPR}px ui-monospace,monospace`;
    ctx.textAlign='left';
    ctx.fillText('BALLAST & TRIM',trimSecX,panelY+18*DPR);

    {
      const {trim:floodTrim, buoyancy:floodBuoy}=window.DMG?.getTrimState?.()??{trim:0,buoyancy:0};
      const hpa=player.damage?.hpa;
      const hpaC=C.player.hpa||{};

      // ── Tank diagram ──────────────────────────────────────────────────────
      const diagY=panelY+24*DPR;
      const diagW=trimSecW-pad;
      const g=3*DPR;            // gap between all cells
      const trimTH=18*DPR;      // trim tank row height
      const trimGap=3*DPR;      // separator between trim row and MBT row
      const mbtH=38*DPR;        // MBT height
      const fullH=trimTH+trimGap+mbtH;
      const mbtY=diagY+trimTH+trimGap;  // y-origin of MBT row

      // Cell widths — trim tanks wider, MBT-3 fills centre
      const w1=26*DPR, w2=32*DPR, w3=Math.round(diagW-2*(w1+w2)-4*g), w4=32*DPR, w5=26*DPR;
      const cx1=trimSecX;
      const cx2=cx1+w1+g;
      const cx3=cx2+w2+g;
      const cx4=cx3+w3+g;
      const cx5=cx4+w4+g;
      const diagramRight=cx5+w5;

      // Trim-F: above MBT-1 + left 60% of MBT-2 space
      const trimFW=w1+g+Math.round(w2*0.6);
      // Trim-A: above right 60% of MBT-4 space + MBT-5
      const trimAW=Math.round(w4*0.6)+g+w5;
      const trimAX=diagramRight-trimAW;

      // ── Draw helpers ──────────────────────────────────────────────────────

      // Solid background cell with bottom-up water fill, then label centred
      function mbtCell(x,y,w,h,fillFrac,label){
        const fx=Math.round(x),fy=Math.round(y),fw=Math.round(w),fh=Math.round(h);
        // Background
        ctx.fillStyle='rgba(6,12,24,0.85)';
        ctx.fillRect(fx,fy,fw,fh);
        // Water fill (bottom-up)
        if(fillFrac>0){
          const frac=Math.min(1,fillFrac);
          const fh2=Math.round(fh*frac);
          const col=frac>0.8?'rgba(190,30,30,0.90)':frac>0.5?'rgba(170,100,0,0.85)':'rgba(20,70,140,0.80)';
          ctx.fillStyle=col;
          ctx.fillRect(fx+1,fy+fh-fh2,fw-2,fh2);
        }
        // Border — blue-grey for MBT
        ctx.strokeStyle='rgba(60,90,130,0.55)';
        ctx.lineWidth=1;
        ctx.strokeRect(fx+0.5,fy+0.5,fw-1,fh-1);
        // Label
        ctx.fillStyle='rgba(148,163,184,0.65)';
        ctx.font=`bold ${7*DPR}px ui-monospace,monospace`;
        ctx.textAlign='center';
        ctx.fillText(label,fx+fw/2,fy+10*DPR);
      }

      function trimCell(x,y,w,h,fillFrac,label){
        const fx=Math.round(x),fy=Math.round(y),fw=Math.round(w),fh=Math.round(h);
        ctx.fillStyle='rgba(10,8,22,0.90)';
        ctx.fillRect(fx,fy,fw,fh);
        if(fillFrac>0){
          const frac=Math.min(1,fillFrac);
          const fh2=Math.round(fh*frac);
          const col=frac>0.6?'rgba(140,30,160,0.90)':'rgba(80,20,120,0.75)';
          ctx.fillStyle=col;
          ctx.fillRect(fx+1,fy+fh-fh2,fw-2,fh2);
        }
        // Distinct border — violet for trim tanks
        ctx.strokeStyle='rgba(130,60,180,0.65)';
        ctx.lineWidth=1;
        ctx.strokeRect(fx+0.5,fy+0.5,fw-1,fh-1);
        ctx.fillStyle='rgba(180,140,220,0.70)';
        ctx.font=`bold ${7*DPR}px ui-monospace,monospace`;
        ctx.textAlign='center';
        ctx.fillText(label,fx+fw/2,fy+fh/2+3*DPR);
      }

      // ── Tank fill — real MBT state from physics model ────────────────────────
      const mbtState = player.damage?.mbt;
      // Each tank shown individually; fall back to 0.50 neutral if state missing
      const tankFills = mbtState ? mbtState.tanks : [0.50,0.50,0.50,0.50,0.50];
      const depthFrac = tankFills.reduce((a,b)=>a+b,0)/tankFills.length; // avg for compat

      // Trim tanks — offset by longitudinal trim imbalance from flooding
      const trimFadj = mbtState ? clamp(mbtState.trimF - floodTrim*0.15, 0, 1)
                                 : clamp(0.25 - floodTrim*0.15, 0, 1);
      const trimAadj = mbtState ? clamp(mbtState.trimA + floodTrim*0.15, 0, 1)
                                 : clamp(0.25 + floodTrim*0.15, 0, 1);

      // ── Draw helpers — single fill layer ─────────────────────────────────
      function mbtCell2(x,y,w,h,frac,label){
        const fx=Math.round(x),fy=Math.round(y),fw=Math.round(w),fh=Math.round(h);
        ctx.fillStyle='rgba(6,12,24,0.85)'; ctx.fillRect(fx,fy,fw,fh);
        if(frac>0){
          const fillH=Math.round(fh*Math.min(frac,1));
          ctx.fillStyle='rgba(25,70,130,0.80)';
          ctx.fillRect(fx+1,fy+fh-fillH,fw-2,fillH);
        }
        ctx.strokeStyle='rgba(60,90,130,0.55)'; ctx.lineWidth=1;
        ctx.strokeRect(fx+0.5,fy+0.5,fw-1,fh-1);
        ctx.fillStyle='rgba(148,163,184,0.65)';
        ctx.font=`bold ${7*DPR}px ui-monospace,monospace`; ctx.textAlign='center';
        ctx.fillText(label,fx+fw/2,fy+10*DPR);
      }

      function trimCell2(x,y,w,h,frac,label){
        const fx=Math.round(x),fy=Math.round(y),fw=Math.round(w),fh=Math.round(h);
        ctx.fillStyle='rgba(10,8,22,0.90)'; ctx.fillRect(fx,fy,fw,fh);
        if(frac>0){
          const fillH=Math.round(fh*Math.min(frac,1));
          ctx.fillStyle='rgba(65,18,100,0.85)';
          ctx.fillRect(fx+1,fy+fh-fillH,fw-2,fillH);
        }
        ctx.strokeStyle='rgba(130,60,180,0.65)'; ctx.lineWidth=1;
        ctx.strokeRect(fx+0.5,fy+0.5,fw-1,fh-1);
        ctx.fillStyle='rgba(180,140,220,0.70)';
        ctx.font=`bold ${7*DPR}px ui-monospace,monospace`; ctx.textAlign='center';
        ctx.fillText(label,fx+fw/2,fy+fh/2+3*DPR);
      }

      // ── Draw trim tanks ───────────────────────────────────────────────────
      trimCell2(cx1,    diagY, trimFW, trimTH, trimFadj, 'T-F');
      trimCell2(trimAX, diagY, trimAW, trimTH, trimAadj, 'T-A');

      // ── Draw MBTs ─────────────────────────────────────────────────────────
      mbtCell2(cx1, mbtY, w1, mbtH, tankFills[0], '1');
      mbtCell2(cx2, mbtY, w2, mbtH, tankFills[1], '2');
      mbtCell2(cx3, diagY, w3, fullH, tankFills[2], '3');
      mbtCell2(cx4, mbtY, w4, mbtH, tankFills[3], '4');
      mbtCell2(cx5, mbtY, w5, mbtH, tankFills[4], '5');

      // ── Water-surface tilt line ────────────────────────────────────────────
      // Sits at weighted average MBT fill; tilts with trim imbalance
      const avgFill = tankFills.reduce((a,b)=>a+b,0)/tankFills.length;
      const baseY   = mbtY + mbtH*(1 - clamp(avgFill,0,1));
      const tiltAmp = clamp(floodTrim/2.0,-1,1)*7*DPR;
      const totalW  = diagramRight - cx1;
      ctx.save();
      ctx.beginPath();
      ctx.rect(Math.round(cx1), Math.round(diagY), Math.round(totalW), Math.round(fullH));
      ctx.clip();
      const yLeft  = baseY - tiltAmp;
      const yRight = baseY + tiltAmp;
      ctx.beginPath();
      ctx.moveTo(Math.round(cx1),          Math.round(yLeft));
      ctx.lineTo(Math.round(diagramRight), Math.round(yRight));
      ctx.lineTo(Math.round(diagramRight), Math.round(diagY+fullH));
      ctx.lineTo(Math.round(cx1),          Math.round(diagY+fullH));
      ctx.closePath();
      ctx.fillStyle='rgba(20,80,160,0.10)';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(Math.round(cx1),          Math.round(yLeft));
      ctx.lineTo(Math.round(diagramRight), Math.round(yRight));
      ctx.strokeStyle=Math.abs(floodTrim)>0.5?'rgba(160,90,220,0.75)':'rgba(80,140,200,0.70)';
      ctx.lineWidth=1.5; ctx.stroke();
      ctx.restore();

      // ── HPA banks ─────────────────────────────────────────────────────────
      const hpaY=diagY+fullH+16*DPR;
      const maxP  = hpaC.maxPressure   || 207;
      const maxR  = hpaC.reservePressure || 207;
      const ambient = (player.depth||0) * (hpaC.ambientPerMetre||0.1);
      const groupPressure = hpa?.pressure ?? maxP;
      const resPressure   = hpa?.reserve  ?? maxR;
      const pressureFrac  = groupPressure / maxP;
      const ambientFrac   = Math.min(1, ambient / maxP);
      const pCol = pressureFrac>0.40?'rgba(80,210,110,0.95)':pressureFrac>0.15?'rgba(230,170,20,0.95)':'rgba(230,60,60,0.95)';

      // ── Header row: label left │ big % centre │ bar value right ────────────
      // All on one baseline — no overlap with bars below
      ctx.fillStyle='rgba(148,163,184,0.65)';
      ctx.font=`bold ${9*DPR}px ui-monospace,monospace`; ctx.textAlign='left';
      ctx.fillText('HP AIR', trimSecX, hpaY);

      ctx.fillStyle=pCol;
      ctx.font=`bold ${16*DPR}px ui-monospace,monospace`; ctx.textAlign='center';
      ctx.fillText(`${Math.round(pressureFrac*100)}%`, trimSecX+diagW/2, hpaY);

      ctx.fillStyle='rgba(148,163,184,0.70)';
      ctx.font=`bold ${9*DPR}px ui-monospace,monospace`; ctx.textAlign='right';
      ctx.fillText(`${Math.round(groupPressure)}/${maxP}`, trimSecX+diagW, hpaY);
      ctx.fillStyle='rgba(100,120,150,0.55)';
      ctx.font=`${8*DPR}px ui-monospace,monospace`;
      ctx.fillText('bar', trimSecX+diagW, hpaY+9*DPR);

      // ── Bank bars — below header, labels sit under bars ───────────────────
      const bankG=3*DPR;
      const bankH=20*DPR;   // taller bars
      const labelH=11*DPR;  // room for label text below each bar
      const bankW=Math.round((diagW - 4*bankG) / 5);
      const banksTotal=5*bankW+4*bankG;
      const banksX=trimSecX+Math.round((diagW-banksTotal)/2);
      const bankY=hpaY+14*DPR;   // clear of header text

      // 4 operational banks
      for(let i=0;i<4;i++){
        const bx=banksX+i*(bankW+bankG);
        const bankFrac = clamp(pressureFrac, 0, 1);
        const fillCol = bankFrac>0.40?'rgba(30,160,70,0.95)':bankFrac>0.15?'rgba(200,140,0,0.95)':'rgba(210,35,35,0.95)';
        const brdCol  = bankFrac>0.40?'rgba(40,180,80,0.60)':bankFrac>0.15?'rgba(200,150,0,0.55)':'rgba(210,40,40,0.60)';
        ctx.fillStyle='rgba(4,10,20,0.90)'; ctx.fillRect(bx,bankY,bankW,bankH);
        ctx.fillStyle=fillCol;
        ctx.fillRect(bx+1,bankY+1,Math.round((bankW-2)*bankFrac),bankH-2);
        ctx.strokeStyle=brdCol; ctx.lineWidth=1;
        ctx.strokeRect(bx+0.5,bankY+0.5,bankW-1,bankH-1);
        // Ambient threshold tick
        if(ambientFrac>0 && ambientFrac<1){
          const tickX=bx+1+Math.round((bankW-2)*ambientFrac);
          ctx.strokeStyle='rgba(240,200,50,1.0)'; ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.moveTo(tickX,bankY+2); ctx.lineTo(tickX,bankY+bankH-2); ctx.stroke();
        }
        // Label BELOW bar
        ctx.fillStyle='rgba(180,200,230,0.80)';
        ctx.font=`bold ${9*DPR}px ui-monospace,monospace`; ctx.textAlign='center';
        ctx.fillText(`B${i+1}`, bx+bankW/2, bankY+bankH+labelH*0.75);
      }
      // Reserve bank — gold border, label below
      {
        const bx=banksX+4*(bankW+bankG);
        const resFrac=clamp(resPressure/maxR,0,1);
        const resCol=resFrac>0.30?'rgba(180,130,0,0.95)':'rgba(180,25,25,0.95)';
        ctx.fillStyle='rgba(4,10,20,0.90)'; ctx.fillRect(bx,bankY,bankW,bankH);
        ctx.fillStyle=resCol;
        ctx.fillRect(bx+1,bankY+1,Math.round((bankW-2)*resFrac),bankH-2);
        ctx.strokeStyle='rgba(220,170,30,0.85)'; ctx.lineWidth=1.5;
        ctx.strokeRect(bx+0.5,bankY+0.5,bankW-1,bankH-1);
        ctx.fillStyle='rgba(230,190,60,0.90)';
        ctx.font=`bold ${9*DPR}px ui-monospace,monospace`; ctx.textAlign='center';
        ctx.fillText('RES', bx+bankW/2, bankY+bankH+labelH*0.75);
      }

      // ── Controls ──────────────────────────────────────────────────────────
      const ctrlY=bankY+bankH+labelH+4*DPR;
      const ctrlW=Math.round((diagW-bankG)/2);
      const ctrlH=18*DPR;
      const venting   = player._blowVenting||false;
      const pending   = player._blowPending||false;
      const manual    = (player._blowManualT||0)>0;
      const blowActive= venting||pending||manual;
      const noHPA     = pressureFrac < 0.02;
      const blowLabel = venting?'BLOW — VENTING':pending?'BLOW — STANDBY':manual?'BLOW — MANUAL':noHPA?'NO HP AIR':'BLOW BALLAST';
      const blowState = (noHPA||blowActive)?'unavailable':'emergency';
      btn(blowLabel,trimSecX,ctrlY,ctrlW,ctrlH,blowActive&&!noHPA,
        ()=>PANEL.emergencyBlowBallast(),'#7c1010',blowState);
      const rechg     = hpa?.recharging||false;
      const atSurfaceR= (player.depth||0)<=20;
      const rechgState= atSurfaceR?'available':'unavailable';
      btn(rechg?'RECHARGE ■':'HP RECHARGE',trimSecX+ctrlW+bankG,ctrlY,ctrlW,ctrlH,
        rechg&&atSurfaceR,()=>PANEL.toggleHPARecharge(),'#1e3a5f',
        atSurfaceR?'available':'unavailable');
    }

    sectionDivider(trimSecX+trimSecW);

    // ── SECTION 4: Status Readouts ────────────────────────────────────────────
    const statusX=trimSecX+trimSecW+pad;
    const statusW=165*DPR;

    ctx.fillStyle='rgba(17,24,39,0.35)';
    ctx.font=`${11*DPR}px ui-monospace,monospace`;
    ctx.textAlign='left'; ctx.fillText('STATUS',statusX,panelY+18*DPR);

    const hdgDeg=((player.heading*180/Math.PI)+360)%360;
    // SPD / HDG / SCORE — sub-label 9px, value 16px
    ctx.fillStyle='rgba(17,24,39,0.40)'; ctx.font=`${9*DPR}px ui-monospace,monospace`;
    ctx.fillText('SPD',statusX,panelY+33*DPR);
    ctx.fillStyle='#111827'; ctx.font=`${16*DPR}px ui-monospace,monospace`;
    ctx.fillText(`${Math.round(player.speed)}kt`,statusX,panelY+50*DPR);

    ctx.fillStyle='rgba(17,24,39,0.40)'; ctx.font=`${9*DPR}px ui-monospace,monospace`;
    ctx.fillText('HDG',statusX+50*DPR,panelY+33*DPR);
    ctx.fillStyle='#111827'; ctx.font=`${16*DPR}px ui-monospace,monospace`;
    ctx.fillText(`${Math.round(hdgDeg).toString().padStart(3,'0')}°`,statusX+50*DPR,panelY+50*DPR);

    ctx.fillStyle='rgba(17,24,39,0.40)'; ctx.font=`${9*DPR}px ui-monospace,monospace`;
    ctx.fillText('WAVE',statusX+110*DPR,panelY+33*DPR);
    ctx.fillStyle='#111827'; ctx.font=`${16*DPR}px ui-monospace,monospace`;
    ctx.fillText(`${game.wave||1}`,statusX+110*DPR,panelY+50*DPR);

    // Wave incoming warning
    if(game.waveDelay>0){
      const wdPct=game.waveDelay/C.enemy.waveDelay;
      const blink=Math.sin(performance.now()*0.006)>0;
      ctx.fillStyle=blink?'rgba(220,38,38,0.80)':'rgba(220,38,38,0.30)';
      ctx.font=`bold ${8*DPR}px ui-monospace,monospace`;
      ctx.fillText(`NEXT WAVE ${Math.ceil(game.waveDelay)}s`,statusX+108*DPR,panelY+62*DPR);
    }
    // Group state indicator
    if(game.groupState==='prosecuting'){
      ctx.fillStyle='rgba(220,38,38,0.75)';
      ctx.font=`bold ${7*DPR}px ui-monospace,monospace`;
      ctx.fillText('⚠ PROSECUTING',statusX+108*DPR,panelY+72*DPR);
    }

    // Hull / crew integrity bars
    const barY=panelY+62*DPR, barW=statusW-pad*2, barH=11*DPR;
    const dmg=player.damage;
    const crewTotal=dmg?.crew.total||30;
    const crewAlive=crewTotal-(dmg?.crew.killed||0);
    const crewPct=clamp(crewAlive/crewTotal,0,1);
    ctx.fillStyle='rgba(17,24,39,0.40)'; ctx.font=`${9*DPR}px ui-monospace,monospace`;
    ctx.fillText(`CREW  ${crewAlive}/${crewTotal}${dmg?.crew.wounded>0?' ('+dmg.crew.wounded+' WND)':''}`,statusX,barY-2);
    ctx.fillStyle='rgba(17,24,39,0.10)'; ctx.fillRect(statusX,barY,barW,barH);
    ctx.fillStyle=crewPct>0.6?'#334155':crewPct>0.35?'#b45309':'#dc2626';
    ctx.fillRect(statusX,barY,barW*crewPct,barH);

    // Noise bar
    const noiseBarY=barY+barH+10*DPR;
    const noisePct=clamp(player.noise,0,1);
    ctx.fillStyle='rgba(17,24,39,0.40)'; ctx.font=`${9*DPR}px ui-monospace,monospace`;
    ctx.fillText('NOISE',statusX,noiseBarY-2);
    ctx.fillStyle='rgba(17,24,39,0.10)'; ctx.fillRect(statusX,noiseBarY,barW,barH);
    ctx.fillStyle=noisePct>0.5?'#dc2626':'#334155';
    ctx.fillRect(statusX,noiseBarY,barW*noisePct,barH);

    // Quick system status pills — worst 3 damaged systems
    if(dmg){
      const damaged=Object.entries(dmg.systems)
        .filter(([,s])=>s!=='nominal')
        .sort(([,a],[,b])=>DMG.STATES.indexOf(b)-DMG.STATES.indexOf(a))
        .slice(0,3);
      const pillY=noiseBarY+barH+10*DPR;
      const stCol={'degraded':'#b45309','offline':'#dc2626','destroyed':'#7f1d1d'};
      let px=statusX;
      for(const [sys,st] of damaged){
        const label=DMG.SYS_LABEL[sys]?.slice(0,6)||sys.slice(0,6).toUpperCase();
        ctx.fillStyle=stCol[st]||'#dc2626';
        ctx.font=`bold ${7.5*DPR}px ui-monospace,monospace`;
        ctx.textAlign='left';
        ctx.fillText(`${label}:${st.slice(0,3).toUpperCase()}`,px,pillY);
        px+=58*DPR;
        if(px>statusX+barW) break;
      }
      // DMG panel toggle button — blinks if there's active damage
      const hasDmg=damaged.length>0||Object.values(dmg.flooding).some(f=>f>0);
      const blink=hasDmg&&(Math.sin(performance.now()*0.007)>0);
      const dmgBtnY=noiseBarY+barH+8*DPR;
      btn('⚡ DMG CTRL',statusX,dmgBtnY,barW,17*DPR,game.showDamageScreen,
        ()=>{game.showDamageScreen=!game.showDamageScreen;},
        blink?'#991b1b':'#1e3a5f');
      const hasNewDcLog=(game.dcLog||[]).length>0&&game.logTab!=='dc';
      const dcBlink=hasNewDcLog&&(Math.sin(performance.now()*0.007)>0);
      btn('📋 DMG LOG',statusX,dmgBtnY+20*DPR,barW,17*DPR,game.logTab==='dc',
        ()=>{game.logTab=game.logTab==='dc'?'log':'dc';},
        dcBlink?'#7c3a00':'#1e3a5f');
      btn('👥 CREW',statusX,dmgBtnY+40*DPR,barW,17*DPR,game.showDamageScreen,
        ()=>{game.showDamageScreen=!game.showDamageScreen;},
        '#1e3a5f');
    }

    sectionDivider(statusX+statusW);

    // ── SECTION 4a: POSTURE ──────────────────────────────────────────────────
    const postureX=statusX+statusW+pad;
    const postureW=120*DPR;
    const pbH=21*DPR, pbW=postureW-pad;
    const halfW=(pbW-4*DPR)/2;

    ctx.fillStyle='rgba(17,24,39,0.35)';
    ctx.font=`${11*DPR}px ui-monospace,monospace`;
    ctx.textAlign='left'; ctx.fillText('POSTURE',postureX,panelY+18*DPR);

    // ── Crew state badge (clickable) ─────────────────────────────────────────
    const tState=game.tacticalState||'cruising';
    const cState=game.casualtyState||'normal';
    const stateLabel=cState==='escape'?'ESCAPE STA':cState==='emergency'?'EMRG STA':tState==='action'?'ACTION STA':tState==='patrol'?'PATROL ST':'CRUIS WATCH';
    const stateBg=cState==='escape'?'rgba(180,20,20,0.90)':cState==='emergency'?'rgba(160,60,0,0.85)':tState==='action'?'rgba(120,0,0,0.75)':tState==='patrol'?'rgba(92,64,10,0.70)':'rgba(17,24,39,0.55)';
    const stateFlash=cState==='escape'||cState==='emergency';
    const stateVisible=!stateFlash||(Math.floor(Date.now()/400)%2===0);
    if(stateVisible){
      ctx.fillStyle=stateBg;
      ctx.beginPath(); ctx.roundRect(postureX,panelY+27*DPR,pbW,pbH,3); ctx.fill();
      ctx.fillStyle='#f8f6f0';
      ctx.font=`bold ${11*DPR}px ui-monospace,monospace`;
      ctx.textAlign='center';
      ctx.fillText(stateLabel,postureX+pbW/2,panelY+27*DPR+pbH*0.68);
    }
    if(cState==='normal'||cState==='patrol'){
      PANEL.registerBtn(postureX,panelY+27*DPR,pbW,pbH,()=>PANEL.callActionStations());
    }

    btn('◆ SILENT',postureX,panelY+52*DPR,pbW,pbH,player.silent,
      ()=>PANEL.toggleSilent(),'#1e3a5f');
    btn('ALL STOP',postureX,panelY+77*DPR,pbW,pbH,PANEL.telegraphIdx===5,
      ()=>PANEL.allStop());

    // ── Towed array button + status ───────────────────────────────────────────
    {
      const ta=player.towedArray;
      const taState=ta?.state||'stowed';
      const taActive=taState==='operational'||taState==='damaged'||taState==='deploying'||taState==='retracting';
      const taCol=taState==='operational'?'#1e3a5f'
                 :taState==='damaged'?'#92400e'
                 :taState==='destroyed'?'rgba(120,20,20,0.55)'
                 :'rgba(17,24,39,0.55)';
      ctx.font=`${8*DPR}px ui-monospace,monospace`; ctx.textAlign='left';
      const taStateStr=taState==='operational'?'OPERATIONAL'
                      :taState==='damaged'?'DAMAGED'
                      :taState==='destroyed'?'DESTROYED'
                      :taState==='deploying'?`DEPLOYING ${Math.round((1-(ta.progress||0))*30)}s`
                      :taState==='retracting'?`RETRACTING ${Math.round((ta.progress||0)*20)}s`
                      :'STOWED';
      const taStateCol=taState==='operational'?'rgba(22,163,74,0.75)'
                      :taState==='damaged'?'rgba(217,119,6,0.80)'
                      :taState==='destroyed'?'rgba(150,30,30,0.70)'
                      :'rgba(17,24,39,0.35)';
      ctx.fillStyle='rgba(17,24,39,0.30)'; ctx.fillText('ARRAY',postureX,panelY+112*DPR);
      ctx.fillStyle=taStateCol; ctx.fillText(taStateStr,postureX+36*DPR,panelY+112*DPR);
      if(taState==='deploying'||taState==='retracting'){
        const bx=postureX, by=panelY+115*DPR, bw=pbW, bh=3*DPR;
        ctx.fillStyle='rgba(17,24,39,0.10)'; ctx.fillRect(bx,by,bw,bh);
        ctx.fillStyle='rgba(17,24,39,0.45)'; ctx.fillRect(bx,by,bw*(ta.progress||0),bh);
      }
      if(taState!=='destroyed'){
        btn(taActive?'RETRACT ARRAY':'DEPLOY ARRAY',postureX,panelY+119*DPR,pbW,pbH,
          taActive&&taState!=='deploying',()=>PANEL.toggleTowedArray(),taCol);
      }
    }

    sectionDivider(postureX+postureW);

    // ── SECTION 4b: EMERGENCY ────────────────────────────────────────────────
    const emergX=postureX+postureW+pad;
    const emergW=140*DPR;
    const ebH=20*DPR, egap=4*DPR;
    const ebW=emergW-pad;
    const eHalfW=(ebW-egap)/2;
    const eCol2=emergX+eHalfW+egap;

    ctx.fillStyle='rgba(17,24,39,0.35)';
    ctx.font=`${11*DPR}px ui-monospace,monospace`;
    ctx.textAlign='left'; ctx.fillText('EMERGENCY',emergX,panelY+18*DPR);

    btn('EMERGENCY TURN',emergX,panelY+27*DPR,ebW,ebH,
      player.emergTurnT>0,()=>PANEL.emergencyTurn(),'#7f1d1d',
      player.emergTurnT>0?'emergency':'available');
    btn('CRASH DIVE',emergX,panelY+51*DPR,ebW,ebH,
      player.crashDiveT>0,()=>PANEL.emergencyCrashDive(),'#7f1d1d',
      player.crashDiveT>0?'emergency':'available');

    sectionDivider(emergX+emergW);

    // ── SECTION 5: Weapons ────────────────────────────────────────────────────
    const weapX=emergX+emergW+pad;
    const weapW=155*DPR;

    ctx.fillStyle='rgba(17,24,39,0.35)';
    ctx.font=`${11*DPR}px ui-monospace,monospace`;
    ctx.textAlign='left'; ctx.fillText('WEAPONS',weapX,panelY+18*DPR);

    function weaponRow(label,cd,maxCd,y,actionLabel,action){
      const rdy=cd<=0;
      const rowH=22*DPR;
      const wbW=110*DPR;
      ctx.fillStyle='rgba(17,24,39,0.08)'; ctx.fillRect(weapX,y,wbW,rowH-3*DPR);
      if(!rdy){
        ctx.fillStyle='rgba(17,24,39,0.20)';
        ctx.fillRect(weapX,y,wbW*clamp(1-cd/maxCd,0,1),rowH-3*DPR);
      } else {
        ctx.fillStyle='rgba(30,58,95,0.15)';
        ctx.fillRect(weapX,y,wbW,rowH-3*DPR);
      }
      ctx.fillStyle=rdy?'#111827':'rgba(17,24,39,0.35)';
      ctx.font=`${9*DPR}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillText(label+(rdy?' RDY':` ${cd.toFixed(1)}s`),weapX+3*DPR,y+rowH*0.70);
      if(rdy){
        btn(actionLabel,weapX+wbW+4*DPR,y,38*DPR,rowH-3*DPR,false,action,'#1e3a5f');
      }
    }

    // Torpedo tube display
    {
      const tubes=player.torpTubes||[];
      const stock=typeof player.torpStock==='number'?player.torpStock:0;
      const reloadTime=C.player.torpReloadTime||28;
      const fireDelay=C.player.fireDelay||1.8;
      const pending=player.pendingFires||[];
      const hdrY=panelY+18*DPR;
      const outOfAmmo=stock<=0&&pending.length===0;
      const allBusy=tubes.length>0&&tubes.every(t=>t>0);

      ctx.fillStyle=outOfAmmo?'rgba(17,24,39,0.28)':'#111827';
      ctx.font=`bold ${11*DPR}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillText('TUBES',weapX+3*DPR,hdrY+11*DPR);

      ctx.font=`bold ${11*DPR}px ui-monospace,monospace`;
      ctx.fillStyle=outOfAmmo?'rgba(17,24,39,0.20)':'#111827';
      ctx.textAlign='right';
      ctx.fillText(`${stock} left`,weapX+145*DPR,hdrY+11*DPR);

      const pipW=18*DPR, pipH=30*DPR, pipGap=4*DPR;
      const pipStartX=weapX+3*DPR;
      const pipY=hdrY+16*DPR;
      for(let i=0;i<tubes.length;i++){
        const px=pipStartX+i*(pipW+pipGap);
        const wireOccupied=tubes[i]===-1||(player.tubeWires?.[i]?.wire?.live===true);
        const ready=tubes[i]===0&&!wireOccupied;
        const hasShell=ready&&stock>0;
        const pf=pending.find(p=>p.tubeIdx===i);
        ctx.fillStyle='rgba(17,24,39,0.08)';
        ctx.fillRect(px,pipY,pipW,pipH);
        if(pf){
          const frac=clamp(1-pf.t/fireDelay,0,1);
          const pulse=0.5+0.5*Math.sin(performance.now()*0.008);
          ctx.fillStyle=`rgba(180,100,0,${0.25+pulse*0.20})`;
          ctx.fillRect(px,pipY,pipW,pipH);
          ctx.fillStyle='rgba(180,100,0,0.55)';
          ctx.fillRect(px,pipY+pipH*(1-frac),pipW,pipH*frac);
          ctx.fillStyle='rgba(160,80,0,0.90)';
          ctx.font=`${8*DPR}px ui-monospace,monospace`;
          ctx.textAlign='center';
          ctx.fillText(pf.doorsLogged?'FIRE':'FLOOD',px+pipW/2,pipY+pipH*0.62);
        } else if(wireOccupied){
          const pulse=0.5+0.5*Math.sin(performance.now()*0.006);
          ctx.fillStyle=`rgba(13,148,136,${0.25+pulse*0.15})`;
          ctx.fillRect(px,pipY,pipW,pipH);
          ctx.fillStyle='rgba(13,148,136,0.90)';
          ctx.font=`bold ${7*DPR}px ui-monospace,monospace`;
          ctx.textAlign='center';
          ctx.fillText('WIRE',px+pipW/2,pipY+pipH*0.45);
          ctx.fillText(`T${i+1}`,px+pipW/2,pipY+pipH*0.72);
        } else if(!ready){
          const frac=clamp(1-tubes[i]/reloadTime,0,1);
          ctx.fillStyle='rgba(17,24,39,0.18)';
          ctx.fillRect(px,pipY+pipH*(1-frac),pipW,pipH*frac);
          ctx.fillStyle='rgba(17,24,39,0.45)';
          ctx.font=`${8*DPR}px ui-monospace,monospace`;
          ctx.textAlign='center';
          ctx.fillText(Math.ceil(tubes[i])+'s',px+pipW/2,pipY+pipH*0.62);
        } else if(hasShell){
          ctx.fillStyle='rgba(30,58,95,0.55)';
          ctx.fillRect(px,pipY,pipW,pipH);
          ctx.fillStyle='rgba(30,58,95,0.95)';
          ctx.font=`${11*DPR}px ui-monospace,monospace`;
          ctx.textAlign='center';
          ctx.fillText('▶',px+pipW/2,pipY+pipH*0.65);
        } else {
          ctx.fillStyle='rgba(17,24,39,0.06)';
          ctx.fillRect(px,pipY,pipW,pipH);
        }
        ctx.strokeStyle=wireOccupied?'rgba(13,148,136,0.70)':pf?'rgba(180,100,0,0.70)':hasShell?'rgba(30,58,95,0.60)':ready?'rgba(17,24,39,0.15)':'rgba(17,24,39,0.25)';
        ctx.lineWidth=pf?1.5:1;
        ctx.strokeRect(px,pipY,pipW,pipH);
      }
      ctx.textAlign='left';
      ctx.font=`${9*DPR}px ui-monospace,monospace`;
      ctx.fillStyle='rgba(17,24,39,0.40)';
      const hasPending=pending.length>0;
      const statusStr=outOfAmmo?'DRY':hasPending?'FIRING…':allBusy?'RELOADING':'SHIFT+CLICK AIM  F FIRE';
      ctx.fillText(statusStr,pipStartX,pipY+pipH+10*DPR);
    }
    weaponRow('ACTIVE PING [SPACE]',player.pingCd,C.player.pingCd,panelY+106*DPR,'PING',
      ()=>{ if(player.pingCd<=0){ window.SENSE?.activePing(); setMsg('PING!',0.8); }});
    weaponRow('COUNTERMEAS. [X]',player.cmCd,C.player.cmCd,panelY+136*DPR,'DEPLOY',
      ()=>{ if(window.W&&player.cmCd<=0){
        player.cmCd=C.player.cmCd;
        window.W.deployDecoy(player.wx,player.wy,true,'noisemaker');
        player.noiseTransient=Math.min(1,player.noiseTransient+0.10);
        setMsg('NOISEMAKER OUT',0.9);
      }});

    sectionDivider(weapX+weapW);

    // ── SECTION 6: Wire Guidance ──────────────────────────────────────────────
    const wireSecX = weapX+weapW+pad;
    const wireSecW = 185*DPR;
    {
      const WP = window._wirePanel;
      const nTubes = C.player.torpTubes||4;
      const selTube = game.wirePanel?.selectedTube??0;
      const tubeWires = player.tubeWires||[];

      ctx.fillStyle='rgba(17,24,39,0.35)';
      ctx.font=`${11*DPR}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillText('WIRES',wireSecX,panelY+18*DPR);

      // Tube tabs
      const tabW=(wireSecW-pad)/nTubes, tabH=16*DPR;
      for(let i=0;i<nTubes;i++){
        const torp=tubeWires[i];
        const wireLive=torp?.wire?.live;
        const active=i===selTube;
        const tabX=wireSecX+i*tabW;
        const tabCol=wireLive?(active?'#1e3a5f':'rgba(30,58,95,0.35)')
          :(active?'rgba(17,24,39,0.18)':'rgba(17,24,39,0.06)');
        ctx.fillStyle=tabCol;
        ctx.beginPath(); ctx.roundRect(tabX,panelY+22*DPR,tabW-2*DPR,tabH,2*DPR); ctx.fill();
        ctx.fillStyle=wireLive?'#e2e8f0':'rgba(17,24,39,0.45)';
        ctx.font=`bold ${8.5*DPR}px ui-monospace,monospace`;
        ctx.textAlign='center';
        ctx.fillText(`T${i+1}`,tabX+tabW/2-DPR,panelY+22*DPR+tabH*0.72);
        PANEL.btn2(ctx,'',tabX,panelY+22*DPR,tabW-2*DPR,tabH,'transparent',()=>WP.selectWireTube(i));
      }

      // Selected tube details
      const torp = tubeWires[selTube];
      const wireLive = torp?.wire?.live;
      const detY = panelY+44*DPR;

      if(wireLive){
        const paidOut = torp.wire.paidOut||0;
        const nm = paidOut/185.2;
        const curAng = Math.atan2(torp.vy,torp.vx);
        const hdgDeg = (((Math.atan2(Math.cos(curAng),-Math.sin(curAng))*180/Math.PI)+360)%360);
        const seekerOn = torp.traveled>=(torp.enableDist||0);
        const locked = !!torp.target && !torp.seducedBy;
        const autoTDC = torp.wire.autoTDC;

        // Status line
        ctx.fillStyle='rgba(34,197,94,0.85)';
        ctx.font=`bold ${9*DPR}px ui-monospace,monospace`;
        ctx.textAlign='left';
        ctx.fillText(`WIRE LIVE`,wireSecX,detY);
        ctx.fillStyle='rgba(17,24,39,0.55)';
        ctx.font=`${8.5*DPR}px ui-monospace,monospace`;
        ctx.fillText(`${nm.toFixed(1)}nm paid out`,wireSecX+60*DPR,detY);

        // Torpedo heading + seeker
        ctx.fillStyle='rgba(17,24,39,0.55)';
        ctx.font=`${8.5*DPR}px ui-monospace,monospace`;
        ctx.fillText('HDG',wireSecX,detY+13*DPR);
        ctx.fillStyle='#111827';
        ctx.font=`${13*DPR}px ui-monospace,monospace`;
        ctx.fillText(`${Math.round(hdgDeg).toString().padStart(3,'0')}°`,wireSecX,detY+26*DPR);

        ctx.fillStyle='rgba(17,24,39,0.55)';
        ctx.font=`${8.5*DPR}px ui-monospace,monospace`;
        ctx.fillText('SEEKER',wireSecX+55*DPR,detY+13*DPR);
        const seekLabel=!seekerOn?'ARMING':locked?'LOCKED':'SRCH';
        const seekCol=!seekerOn?'rgba(100,100,100,0.70)':locked?'rgba(220,38,38,0.85)':'rgba(234,179,8,0.85)';
        ctx.fillStyle=seekCol;
        ctx.font=`bold ${11*DPR}px ui-monospace,monospace`;
        ctx.fillText(seekLabel,wireSecX+55*DPR,detY+26*DPR);

        // Commanded bearing display
        if(torp.wire.cmdBrg!=null){
          const cmdDeg=(((Math.atan2(Math.cos(torp.wire.cmdBrg),-Math.sin(torp.wire.cmdBrg))*180/Math.PI)+360)%360);
          ctx.fillStyle='rgba(17,24,39,0.45)';
          ctx.font=`${8*DPR}px ui-monospace,monospace`;
          ctx.textAlign='left';
          ctx.fillText(`CMD ${Math.round(cmdDeg).toString().padStart(3,'0')}°${autoTDC?' [TDC]':''}`,wireSecX,detY+38*DPR);
        }

        // Buttons row 1: AUTO TDC toggle
        const bH=15*DPR, bY=detY+44*DPR;
        PANEL.btn2(ctx,autoTDC?'AUTO TDC ✓':'AUTO TDC',wireSecX,bY,wireSecW-pad*2,bH,
          autoTDC?'rgba(30,58,95,0.70)':'rgba(17,24,39,0.12)',
          ()=>WP.wireAutoTDC(selTube,!autoTDC));

        // Buttons row 2: nudge left/right (only enabled when auto-TDC off)
        const nudgeY=bY+bH+3*DPR;
        const nudgeW=(wireSecW-pad*2-4*DPR)/4;
        const nudgeCols=['rgba(17,24,39,0.35)','rgba(17,24,39,0.20)','rgba(17,24,39,0.20)','rgba(17,24,39,0.35)'];
        const nudges=[[-10,'◄◄'],[-5,'◄ PORT'],['+5 STBD ►'],['+10','►►']];
        const nudgeDeg=[-10,-5,5,10];
        for(let ni=0;ni<4;ni++){
          PANEL.btn2(ctx,nudges[ni][1]??nudges[ni][0],
            wireSecX+ni*(nudgeW+1*DPR),nudgeY,nudgeW,bH,
            nudgeCols[ni],()=>WP.wireNudge(selTube,nudgeDeg[ni]));
        }

        // Cut wire button
        const cutY=nudgeY+bH+3*DPR;
        PANEL.btn2(ctx,'CUT WIRE',wireSecX,cutY,wireSecW-pad*2,bH+2*DPR,
          'rgba(127,29,29,0.65)',()=>WP.wireCut(selTube));

      } else {
        // No live wire on this tube
        ctx.fillStyle='rgba(17,24,39,0.25)';
        ctx.font=`${8.5*DPR}px ui-monospace,monospace`;
        ctx.textAlign='left';
        const tubeSt=player.torpTubes?.[selTube]??0;
        const stLabel=tubeSt>0?`RELOADING ${tubeSt.toFixed(0)}s`:tubeSt===-1?'OCCUPIED':'READY';
        ctx.fillText(stLabel,wireSecX,detY+10*DPR);
        ctx.fillText('No wire',wireSecX,detY+22*DPR);
      }
    }
    sectionDivider(wireSecX+wireSecW);

    // ── SECTION 7: TDC + CONTACTS — expands to fill remaining panel width ───────
    const tdcX=wireSecX+wireSecW+pad;
    const tdcW=Math.max(260*DPR, panelW-tdcX-pad);
    const tdc=game.tdc;

    // Collect all trackable contacts — all established sonar contacts always shown
    const tdcContacts=[];
    for(const [e,sc] of sonarContacts){
      const isDead=sc.dead===true||e.dead===true;
      tdcContacts.push({ref:e, id:sc.id, sc, isTorp:false, isDead});
    }
    for(const b of bullets){
      // Only friendly torpedoes in TDC — for wire guidance designation
      if(b.kind==='torpedo'&&b.life>0&&b.friendly){
        b._isTorp=true;
        tdcContacts.push({ref:b, id:b.torpId, sc:null, isTorp:true, isDead:false});
      }
    }

    // ── LEFT: Fire Control ────────────────────────────────────────────────────
    const fcW=235*DPR;  // fixed fire control column width
    const fcX=tdcX;

    ctx.fillStyle=tdc.frozen?'rgba(180,60,60,0.70)':'rgba(17,24,39,0.35)';
    ctx.font=`${11*DPR}px ui-monospace,monospace`;
    ctx.textAlign='left';
    ctx.fillText(tdc.frozen?'TDC [FROZEN]':'TDC',fcX,panelY+18*DPR);

    // ── Solution quality bar — prominent feedback on designated contact ────────
    {
      const sq=tdc.tmaQuality??0;
      const barW=fcW-36*DPR; // leave room for CLR button
      const barH=5*DPR;
      const barY=panelY+21*DPR;
      // Track background
      ctx.fillStyle='rgba(17,24,39,0.07)';
      ctx.fillRect(fcX,barY,barW,barH);
      if(tdc.target && !tdc.frozen){
        const filled=barW*clamp(sq,0,1);
        const barCol=sq>=0.6?'rgba(22,163,74,0.65)':sq>=0.2?'rgba(217,119,6,0.70)':'rgba(100,100,100,0.45)';
        ctx.fillStyle=barCol;
        ctx.fillRect(fcX,barY,filled,barH);
        // Status label next to bar
        const sqPct=Math.round(clamp(sq,0,1)*100); const sqLabel=(sq>=0.6?'SOLID':sq>=0.2?'BLDG':'BRG')+' '+sqPct+'%';
        const sqCol=sq>=0.6?'rgba(22,163,74,0.80)':sq>=0.2?'rgba(217,119,6,0.85)':'rgba(100,100,100,0.70)';
        ctx.fillStyle=sqCol;
        ctx.font=`bold ${8*DPR}px ui-monospace,monospace`;
        ctx.textAlign='right';
        ctx.fillText(sqLabel, fcX+fcW-38*DPR, barY+barH-0.5*DPR);
      }
    }

    // Designation buttons row
    const cbW=35*DPR, cbH=17*DPR, cbGap=3*DPR;
    let cbX=fcX;
    const cbY=panelY+24*DPR;
    ctx.font=`${9*DPR}px ui-monospace,monospace`;
    for(const c of tdcContacts){
      const isSelected=tdc.target===c.ref;
      const cQ=c.sc?.tmaQuality??0;
      const selCol=c.isTorp?'rgba(100,30,200,0.75)':c.isDead?'rgba(150,30,30,0.75)':cQ>=0.6?'#1e3a5f':cQ>=0.2?'rgba(146,64,14,0.85)':'rgba(80,80,80,0.75)';
      btn(c.id, cbX, cbY, cbW, cbH, isSelected,
        ()=>{ game.tdc.target=c.ref; game.tdc.targetId=c.id; setMsg(`TDC: ${c.id} DESIGNATED`,1.0); },
        selCol);
      cbX+=cbW+cbGap;
      if(cbX+cbW>fcX+fcW-38*DPR) break;
    }
    // CLR: clear TDC designation + remove all dead contacts from sonarContacts map
    btn('CLR',fcX+fcW-32*DPR,cbY,32*DPR,cbH,false,()=>{
      game.tdc.target=null; game.tdc.targetId=null;
      // Remove dead entries from sonarContacts so they vanish from contacts list
      const sc=window.G.sonarContacts;
      if(sc){ for(const [e,c] of sc){ if(c.dead||e.dead) sc.delete(e); } }
      setMsg('TDC: CLEARED',0.8);
    },'#7f1d1d');

    // Fire control readouts — 3 columns: BRG | RNG | INT BRG
    const fcCol=fcW/3;
    const rdY=panelY+52*DPR;
    const rdCol='rgba(17,24,39,0.38)';
    const tmaQ=tdc.tmaQuality??0;
    const hasRange=tdc.range!=null;
    const rdValCol=tdc.target?'#111827':'rgba(17,24,39,0.20)';
    const rdDimCol='rgba(17,24,39,0.26)';
    const fc2=fcX+fcCol, fc3=fcX+fcCol*2;

    ctx.font=`${9*DPR}px ui-monospace,monospace`;
    ctx.fillStyle=rdCol; ctx.textAlign='left';
    ctx.fillText('BRG',    fcX,  rdY);
    ctx.fillText('RNG',    fc2,  rdY);
    ctx.fillText('INT BRG',fc3,  rdY);

    const brg=tdc.rawBrg!=null?Math.round(tdc.rawBrg).toString().padStart(3,'0')+'°':'---';
    const rng=hasRange?((tdc.range/185.2).toFixed(1)+'nm~'):'---';
    // INT BRG: convert screen-space math angle to compass
    const intBrg=tdc.intercept!=null
      ?(((Math.atan2(Math.cos(tdc.intercept),-Math.sin(tdc.intercept))*180/Math.PI)+360)%360).toFixed(0).padStart(3,'0')+'°'
      :'---';
    ctx.font=`${14*DPR}px ui-monospace,monospace`;
    ctx.fillStyle=rdValCol;            ctx.fillText(brg,   fcX, rdY+16*DPR);
    ctx.fillStyle=hasRange?rdValCol:rdDimCol; ctx.fillText(rng,fc2,rdY+16*DPR);
    // INT BRG colour: navy=range+lead, amber=bearing-only, dim=no target
    ctx.fillStyle=tdc.target&&hasRange?'#1e3a5f':tdc.target?'#92400e':rdValCol;
    ctx.fillText(intBrg,fc3,rdY+16*DPR);

    // Row 2: DEP | CRS | SPD
    const rdY2=rdY+30*DPR;
    ctx.font=`${9*DPR}px ui-monospace,monospace`;
    ctx.fillStyle=rdCol; ctx.textAlign='left';
    ctx.fillText('DEP',fcX,rdY2);
    ctx.fillText('CRS',fc2,rdY2);
    ctx.fillText('SPD',fc3,rdY2);

    // Smooth depth over a rolling buffer to kill flicker
    if(!window._tdcDepthBuf) window._tdcDepthBuf=[];
    if(tdc.depth!=null){ window._tdcDepthBuf.push(tdc.depth); if(window._tdcDepthBuf.length>12) window._tdcDepthBuf.shift(); }
    const _depthAvg=window._tdcDepthBuf.length>0?window._tdcDepthBuf.reduce((a,b)=>a+b,0)/window._tdcDepthBuf.length:null;
    if(tdc.target==null) window._tdcDepthBuf=[];
    const dep=_depthAvg!=null?Math.round(_depthAvg)+'m~':'---';
    const crs=tdc.course!=null?Math.round(tdc.course).toString().padStart(3,'0')+'°~':'---';
    const spd=tdc.speed!=null?Math.round(tdc.speed)+'kt~':'---';
    ctx.font=`${14*DPR}px ui-monospace,monospace`;
    ctx.fillStyle=rdValCol;                    ctx.fillText(dep,fcX,rdY2+16*DPR);
    ctx.fillStyle=hasRange?rdValCol:rdDimCol;  ctx.fillText(crs,fc2,rdY2+16*DPR);
    ctx.fillStyle=hasRange?rdValCol:rdDimCol;  ctx.fillText(spd,fc3,rdY2+16*DPR);

    // ── WEPS firing solution proposal ─────────────────────────────────────────
    {
      const wp=game.wepsProposal;
      const rdY3=rdY2+28*DPR;
      ctx.font=`${9*DPR}px ui-monospace,monospace`;
      ctx.fillStyle='rgba(17,24,39,0.38)';
      ctx.textAlign='left';
      ctx.fillText('WEPS SOLUTION',fcX,rdY3);

      if(wp){
        const wBrg=(((Math.atan2(Math.cos(wp.bearing),-Math.sin(wp.bearing))*180/Math.PI)+360)%360).toFixed(0).padStart(3,'0')+'°';
        const wDep=Math.round(wp.depth||player.depth)+'m';
        const confCol=wp.confidence==='solid'?'#1e3a5f':wp.confidence==='degraded'?'#92400e':'rgba(17,24,39,0.40)';
        const confLabel=wp.confidence==='solid'?'SOLID':wp.confidence==='degraded'?'DEGRADED':'POOR — BUILD TMA';
        // Proposed bearing — large, coloured by confidence
        ctx.font=`bold ${14*DPR}px ui-monospace,monospace`;
        ctx.fillStyle=confCol;
        ctx.fillText(wBrg,fcX,rdY3+16*DPR);
        // Confidence badge
        ctx.font=`${8*DPR}px ui-monospace,monospace`;
        ctx.fillText(confLabel, fcX+40*DPR, rdY3+10*DPR);
        ctx.fillStyle='rgba(17,24,39,0.50)';
        ctx.fillText(wDep, fcX+40*DPR, rdY3+20*DPR);
        // SHOOT button — green if solid, amber if degraded, dim if bearing-only
        const canShoot = wp.confidence==='solid'||wp.confidence==='degraded'; // bearingonly blocks SHOOT
        const shootCol=wp.confidence==='solid'?'rgba(22,100,60,0.85)':wp.confidence==='degraded'?'rgba(130,60,10,0.80)':'rgba(60,60,60,0.28)';
        btn('SHOOT',fcX+fcW*0.55,rdY3+2*DPR,fcW*0.42,20*DPR,false,
          ()=>{ if(canShoot) PANEL.wepsShoot(); else window.G.addLog('WEPS','Solution too poor — build TMA first'); },
          shootCol);
      } else {
        ctx.font=`${9.5*DPR}px ui-monospace,monospace`;
        ctx.fillStyle='rgba(17,24,39,0.20)';
        ctx.fillText('NO TARGET DESIGNATED',fcX,rdY3+14*DPR);
      }
    }

    // Thin vertical divider between fire control and contact list
    const divX=fcX+fcW+pad*0.5;
    ctx.strokeStyle='rgba(17,24,39,0.10)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(divX,panelY+8*DPR); ctx.lineTo(divX,panelY+panelH-6*DPR); ctx.stroke();

    // ── PLANES / BUBBLE panel — carved from left of contacts column ───────────
    const planesSecW = 142*DPR;
    const planesSecX = divX+pad*0.5;
    {
      const px=planesSecX, pw=planesSecW, ph=panelH;
      const pitch  = window.G?.player?.pitch || 0;
      const planes = window.G?.player?.planes || {};
      const aftMode= planes.aft?.mode || 'hydraulic';
      const fwdMode= planes.fwd?.mode || 'hydraulic';
      const aftAngle= planes.aft?.angle || 0;
      const fwdAngle= planes.fwd?.angle || 0;

      // ── Section header ────────────────────────────────────────────────────
      ctx.fillStyle='rgba(17,24,39,0.35)';
      ctx.font=`${11*DPR}px ui-monospace,monospace`; ctx.textAlign='left';
      ctx.fillText('PLANES',px,panelY+18*DPR);

      // ── Bubble inclinometer ───────────────────────────────────────────────
      const tubeW=pw-4*DPR, tubeH=18*DPR;
      const tubeX=px, tubeY=panelY+24*DPR;
      const tubeRad=tubeH*0.45;
      const tubeMid=tubeX+tubeW/2;

      // Tube body — dark glass
      ctx.fillStyle='rgba(6,14,30,0.85)';
      ctx.beginPath(); ctx.roundRect(tubeX,tubeY,tubeW,tubeH,tubeRad); ctx.fill();

      // Tick marks — 0, ±5, ±10, ±15°
      const pitchMax=15;
      const tickSpan=tubeW*0.85;
      for(const deg of [-15,-10,-5,0,5,10,15]){
        const tx=tubeMid+(deg/pitchMax)*(tickSpan/2);
        const isCentre=deg===0;
        ctx.strokeStyle=isCentre?'rgba(60,200,80,0.60)':'rgba(60,90,130,0.35)';
        ctx.lineWidth=isCentre?1.5:1;
        const ty1=tubeY+(isCentre?2*DPR:4*DPR);
        const ty2=tubeY+tubeH-(isCentre?2*DPR:4*DPR);
        ctx.beginPath(); ctx.moveTo(tx,ty1); ctx.lineTo(tx,ty2); ctx.stroke();
      }

      // Glass highlight
      ctx.fillStyle='rgba(100,160,220,0.07)';
      ctx.beginPath(); ctx.roundRect(tubeX+1,tubeY+1,tubeW-2,tubeH*0.35,tubeRad*0.8); ctx.fill();

      // Tube border
      ctx.strokeStyle='rgba(50,70,110,0.55)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.roundRect(tubeX+0.5,tubeY+0.5,tubeW-1,tubeH-1,tubeRad); ctx.stroke();

      // Bubble — position driven by pitch, clamped to tube interior
      const isFrz   = aftMode==='frozen';
      const isAirEmg = aftMode==='air_emergency'||fwdMode==='air_emergency';
      const bubbleR  = tubeH*0.38;
      const bubbleTravel=(tickSpan/2)-bubbleR*1.1;
      const pitchFrac=clamp(pitch/pitchMax,-1,1);
      const bubbleX  =tubeMid+pitchFrac*bubbleTravel;
      const bubbleY  =tubeY+tubeH/2;
      // Bubble fill — amber normal, orange air emergency, red frozen
      const bubbleCol=isFrz?'rgba(210,40,40,0.88)':isAirEmg?'rgba(210,130,10,0.88)':'rgba(210,160,20,0.82)';
      const bubbleGlow=isFrz?'rgba(200,30,30,0.22)':isAirEmg?'rgba(200,120,0,0.20)':'rgba(210,180,30,0.18)';
      // Glow
      const bgrd=ctx.createRadialGradient(bubbleX,bubbleY,0,bubbleX,bubbleY,bubbleR*2.2);
      bgrd.addColorStop(0,bubbleGlow); bgrd.addColorStop(1,'transparent');
      ctx.fillStyle=bgrd; ctx.beginPath(); ctx.arc(bubbleX,bubbleY,bubbleR*2.2,0,Math.PI*2); ctx.fill();
      // Main bubble
      const bgrad=ctx.createRadialGradient(bubbleX-bubbleR*0.3,bubbleY-bubbleR*0.35,bubbleR*0.05,bubbleX,bubbleY,bubbleR);
      bgrad.addColorStop(0,'rgba(255,240,140,0.95)'); bgrad.addColorStop(0.55,bubbleCol); bgrad.addColorStop(1,'rgba(60,40,0,0.60)');
      ctx.fillStyle=bgrad; ctx.beginPath(); ctx.arc(bubbleX,bubbleY,bubbleR,0,Math.PI*2); ctx.fill();
      // Specular
      ctx.fillStyle='rgba(255,255,220,0.65)';
      ctx.beginPath(); ctx.ellipse(bubbleX-bubbleR*0.28,bubbleY-bubbleR*0.32,bubbleR*0.25,bubbleR*0.15,0,0,Math.PI*2); ctx.fill();

      // STEADY BUBBLE label — tiny, centred below tube
      ctx.fillStyle='rgba(50,75,120,0.38)';
      ctx.font=`${7*DPR}px ui-monospace,monospace`; ctx.textAlign='center';
      ctx.fillText('STEADY BUBBLE',tubeMid,tubeY+tubeH+9*DPR);

      // ── Plane state rows ──────────────────────────────────────────────────
      const rowY0=panelY+62*DPR;
      const rowH =19*DPR;
      const stateData=[
        { label:'AFT PLANES',  mode:aftMode,  angle:aftAngle  },
        { label:'FWD PLANES',  mode:fwdMode,  angle:fwdAngle  },
      ];
      const modeColour={
        hydraulic:   'rgba(30,90,180,0.70)',
        air_emergency:'rgba(180,110,0,0.80)',
        frozen:      'rgba(160,25,25,0.85)',
      };
      const modeTxt={
        hydraulic:'HYD',
        air_emergency:'AIR EMRG',
        frozen:'FROZEN',
      };
      for(let i=0;i<stateData.length;i++){
        const {label,mode,angle}=stateData[i];
        const ry=rowY0+i*(rowH+4*DPR);
        const bg=modeColour[mode]||modeColour.hydraulic;
        // Row bg
        ctx.fillStyle='rgba(6,14,30,0.60)';
        ctx.beginPath(); ctx.roundRect(px,ry,pw-2*DPR,rowH,2); ctx.fill();
        // Mode colour strip on left
        ctx.fillStyle=bg;
        ctx.beginPath(); ctx.roundRect(px,ry,4*DPR,rowH,2); ctx.fill();
        // Label
        ctx.fillStyle='rgba(148,163,184,0.80)';
        ctx.font=`${9*DPR}px ui-monospace,monospace`; ctx.textAlign='left';
        ctx.fillText(label,px+8*DPR,ry+rowH*0.65);
        // Mode badge
        ctx.fillStyle=mode==='hydraulic'?'rgba(30,130,220,0.70)':mode==='air_emergency'?'rgba(220,140,0,0.85)':'rgba(200,30,30,0.85)';
        const badgeW=52*DPR;
        ctx.beginPath(); ctx.roundRect(px+pw-badgeW-4*DPR,ry+2*DPR,badgeW,rowH-4*DPR,2); ctx.fill();
        ctx.fillStyle='#f0ece0';
        ctx.font=`bold ${8*DPR}px ui-monospace,monospace`; ctx.textAlign='center';
        ctx.fillText(modeTxt[mode]||mode.toUpperCase(),px+pw-badgeW*0.5-4*DPR,ry+rowH*0.68);
        // Angle readout
        const dirStr=angle>0.3?'↑':angle<-0.3?'↓':'—';
        ctx.fillStyle='rgba(148,163,184,0.55)';
        ctx.font=`${8*DPR}px ui-monospace,monospace`; ctx.textAlign='right';
        ctx.fillText(`${dirStr}${Math.abs(angle).toFixed(1)}°`,px+pw-badgeW-8*DPR,ry+rowH*0.65);
      }

      // Thin right-border divider
      ctx.strokeStyle='rgba(17,24,39,0.15)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(px+pw,panelY+8*DPR); ctx.lineTo(px+pw,panelY+panelH-6*DPR); ctx.stroke();
    }

    // ── RIGHT: Contact Quality List ───────────────────────────────────────────
    const cqX=planesSecX+planesSecW+pad*0.5;
    const cqW=tdcX+tdcW-cqX-pad;

    ctx.fillStyle='rgba(17,24,39,0.35)';
    ctx.font=`${11*DPR}px ui-monospace,monospace`;
    ctx.textAlign='left';
    ctx.fillText('CONTACTS',cqX,panelY+18*DPR);

    // Column headers
    const cqNow=performance.now()/1000;
    const idColW=30*DPR, brgColW=32*DPR, barColW=Math.max(60*DPR, cqW-idColW-brgColW-56*DPR);
    const obsColW=22*DPR, ageColW=28*DPR;
    const hdrY=panelY+30*DPR;
    ctx.font=`${11*DPR}px ui-monospace,monospace`;
    ctx.fillStyle='rgba(17,24,39,0.35)';
    ctx.fillText('ID',   cqX,                               hdrY);
    ctx.fillText('BRG',  cqX+idColW,                        hdrY);
    ctx.fillText('SOLUTION',cqX+idColW+brgColW,             hdrY);
    ctx.fillText('OBS',  cqX+idColW+brgColW+barColW,        hdrY);
    ctx.fillText('AGE',  cqX+idColW+brgColW+barColW+obsColW,hdrY);

    // PURGE DEAD button — top-right of contacts header
    const hasDeadContacts=[...sonarContacts.values()].some(s=>s.dead)||[...sonarContacts.keys()].some(e=>e.dead);
    if(hasDeadContacts){
      btn('PURGE DEAD', cqX+cqW-62*DPR, panelY+22*DPR, 62*DPR, 14*DPR, false, ()=>{
        const sc=window.G.sonarContacts;
        if(sc){ for(const [e,cv] of sc){ if(cv.dead||e.dead){ if(game.tdc.target===e){ game.tdc.target=null; game.tdc.targetId=null; } sc.delete(e); } } }
        setMsg('Dead contacts cleared',0.8);
      }, 'rgba(127,29,29,0.70)');
    }

    // All established contacts always shown — quality drives appearance
    const allContacts=[];
    for(const [e,sc] of sonarContacts){
      const isDead=sc.dead===true||e.dead===true;
      allContacts.push({ref:e, sc, isTorp:false, id:sc.id, isDead});
    }
    for(const b of bullets){
      if(b.kind==='torpedo'&&!b.friendly&&b.life>0)
        allContacts.push({ref:b, sc:null, isTorp:true, id:b.torpId, isDead:false});
    }

    const rowH=23*DPR;
    const rowsVisible=Math.floor((panelH-50*DPR)/rowH);
    const maxScroll=Math.max(0,allContacts.length-rowsVisible);
    // Clamp scroll offset
    game.contactsScroll=Math.max(0,Math.min(maxScroll,game.contactsScroll||0));
    const startRow=game.contactsScroll;

    // Scroll indicator arrows — only if list overflows
    if(allContacts.length>rowsVisible){
      const arrowX=cqX+cqW-14*DPR;
      const canUp=startRow>0, canDown=startRow<maxScroll;
      ctx.font=`${10*DPR}px ui-monospace,monospace`;
      ctx.textAlign='center';
      ctx.fillStyle=canUp?'rgba(17,24,39,0.55)':'rgba(17,24,39,0.15)';
      ctx.fillText('▲', arrowX, panelY+30*DPR);
      ctx.fillStyle=canDown?'rgba(17,24,39,0.55)':'rgba(17,24,39,0.15)';
      ctx.fillText('▼', arrowX, panelY+panelH-12*DPR);
      // Register arrow buttons
      btn('▲',arrowX-7*DPR,panelY+20*DPR,14*DPR,12*DPR,false,
        ()=>{ game.contactsScroll=Math.max(0,(game.contactsScroll||0)-1); },
        'transparent','transparent');
      btn('▼',arrowX-7*DPR,panelY+panelH-22*DPR,14*DPR,12*DPR,false,
        ()=>{ game.contactsScroll=Math.min(maxScroll,(game.contactsScroll||0)+1); },
        'transparent','transparent');
      // Scrollbar track
      const trackH=(panelH-44*DPR);
      const trackY=panelY+32*DPR;
      const trackX=arrowX-3*DPR;
      ctx.fillStyle='rgba(17,24,39,0.06)';
      ctx.fillRect(trackX,trackY,4*DPR,trackH);
      // Thumb
      const thumbH=Math.max(16*DPR,trackH*(rowsVisible/allContacts.length));
      const thumbY=trackY+(trackH-thumbH)*(startRow/maxScroll||0);
      ctx.fillStyle='rgba(17,24,39,0.22)';
      ctx.beginPath();
      ctx.roundRect(trackX,thumbY,4*DPR,thumbH,2*DPR);
      ctx.fill();
    }

    // Clip rows to panel area
    ctx.save();
    ctx.beginPath();
    ctx.rect(cqX-2*DPR, panelY+36*DPR, cqW-10*DPR, panelH-38*DPR);
    ctx.clip();

    for(let i=startRow;i<Math.min(startRow+rowsVisible,allContacts.length);i++){
      const entry=allContacts[i];
      const ry=panelY+48*DPR+(i-startRow)*rowH;
      const isDesignated=tdc.target===entry.ref;
      const sc=entry.sc;
      const q=sc?.tmaQuality??0;
      const obsCount=sc?.bearings?.length??0;
      const latestBrg=sc?.latestBrg??null;
      const age=sc ? cqNow-sc.lastT : 0;
      const fresh=(sc?.activeT??0)>0;
      const isDead=entry.isDead===true;
      // Highlight row if designated
      if(isDesignated){
        ctx.fillStyle=isDead?'rgba(150,20,20,0.08)':'rgba(30,58,95,0.08)';
        ctx.fillRect(cqX-2*DPR, ry-rowH*0.78, cqW+2*DPR, rowH);
      }

      // Staleness: how long since last observation
      const T_now=game.missionT||0;
      const staleSecs=sc ? T_now-(sc.lastObsT||0) : 0;
      const staleAlpha=isDead?0.40:entry.isTorp?0.70:Math.max(0.22, 0.80-Math.min(1,staleSecs/90)*0.58);
      const rowAlpha=staleAlpha;

      // ID pill — quality-tinted: solid=navy, building=amber, bearing-only=grey
      const rQ=sc?.tmaQuality??0;
      const pillCol=isDead?`rgba(150,30,30,${rowAlpha})`:entry.isTorp?`rgba(100,30,200,${rowAlpha})`:rQ>=0.6?`rgba(17,24,39,${rowAlpha})`:rQ>=0.2?`rgba(130,60,10,${rowAlpha})`:`rgba(80,80,80,${rowAlpha})`;
      ctx.fillStyle=pillCol;
      ctx.font=`bold ${9*DPR}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillText(entry.id+(isDead?' ✕':''), cqX, ry);

      if(!entry.isTorp && sc){
        // BRG
        const brgDeg=latestBrg!=null?((latestBrg*180/Math.PI)+360)%360:null;
        ctx.fillStyle=`rgba(17,24,39,${rowAlpha*0.85})`;
        ctx.font=`${9.5*DPR}px ui-monospace,monospace`;
        ctx.fillText(brgDeg!=null?Math.round(brgDeg).toString().padStart(3,'0')+'°':'---',
                     cqX+idColW, ry);

        // TMA quality bar — or DESTROYED for dead contacts, CONTACT LOST for lost contacts
        const barX=cqX+idColW+brgColW;
        const barH=7*DPR;
        const barY=ry-barH-1*DPR;
        if(isDead){
          ctx.fillStyle=`rgba(150,20,20,0.12)`;
          ctx.fillRect(barX,barY,barColW,barH);
          ctx.font=`${8*DPR}px ui-monospace,monospace`;
          ctx.fillStyle=`rgba(150,20,20,0.55)`;
          ctx.textAlign='left';
          ctx.fillText('DESTROYED — LAST KNOWN', barX+2*DPR, ry-3*DPR);
        } else {
          ctx.fillStyle='rgba(17,24,39,0.08)';
          ctx.fillRect(barX,barY,barColW,barH);
          const qFill=clamp(q,0,1);
          const qBarCol=q>=0.6?`rgba(22,163,74,${rowAlpha*0.75})`
                       :q>=0.2?`rgba(217,119,6,${rowAlpha*0.75})`
                              :`rgba(220,38,38,${rowAlpha*0.65})`;
          ctx.fillStyle=qBarCol;
          ctx.fillRect(barX,barY,barColW*qFill,barH);
          ctx.strokeStyle=`rgba(17,24,39,0.12)`;ctx.lineWidth=0.5;
          ctx.strokeRect(barX,barY,barColW,barH);
          ctx.font=`${5.5*DPR}px ui-monospace,monospace`;
          ctx.fillStyle=`rgba(17,24,39,${rowAlpha*0.65})`;
          ctx.textAlign='left';
          const qStr=q>=0.6?'SOLID':q>=0.2?'BUILDING':'BEARING ONLY';
          ctx.fillText(qStr, barX+2*DPR, ry-3*DPR);
          ctx.fillStyle=`rgba(17,24,39,${rowAlpha*0.70})`;
          ctx.font=`${9*DPR}px ui-monospace,monospace`;
          ctx.textAlign='right';
          ctx.fillText(obsCount, cqX+idColW+brgColW+barColW+obsColW-2*DPR, ry);
          const ageStr=age<60?Math.round(age)+'s':Math.floor(age/60)+'m'+Math.floor(age%60).toString().padStart(2,'0')+'s';
          ctx.fillStyle=`rgba(17,24,39,${rowAlpha*0.55})`;
          ctx.font=`${11*DPR}px ui-monospace,monospace`;
          ctx.textAlign='right';
          ctx.fillText(ageStr, cqX+idColW+brgColW+barColW+obsColW+ageColW, ry);
        }
      } else if(entry.isTorp){
        // Enemy torpedo — show bearing
        const dx=AI.wrapDx(player.wx,entry.ref.x), dy=entry.ref.y-player.wy;
        const tb=((Math.atan2(dy,dx)*180/Math.PI)+360)%360;
        ctx.fillStyle=`rgba(100,30,200,${rowAlpha*0.75})`;
        ctx.font=`${9.5*DPR}px ui-monospace,monospace`;
        ctx.textAlign='left';
        ctx.fillText(Math.round(tb).toString().padStart(3,'0')+'°', cqX+idColW, ry);
        ctx.font=`${11*DPR}px ui-monospace,monospace`;
        ctx.fillText('INBOUND', cqX+idColW+brgColW+2*DPR, ry);
      }

      ctx.textAlign='left';
    }

    ctx.restore(); // end clip

    // Empty state
    if(allContacts.length===0){
      ctx.fillStyle='rgba(17,24,39,0.22)';
      ctx.font=`${9.5*DPR}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillText('No contacts',cqX,panelY+52*DPR);
    }

    // ── Message strip ─────────────────────────────────────────────────────────
    if(game.msgT>0){
      ctx.fillStyle=`rgba(17,24,39,${Math.min(1,game.msgT*1.4)})`;
      ctx.font=`${11*DPR}px ui-monospace,monospace`;
      ctx.textAlign='center';
      ctx.fillText(game.msg,panelW/2,panelY-8*DPR);
    }

    // ── SCRAM status badge ────────────────────────────────────────────────────
    if(player.scram){
      const pulse=0.55+0.45*Math.sin(performance.now()*0.006);
      const restartPct = 1-(player.scramT/75);
      // Red warning badge
      ctx.fillStyle=`rgba(180,20,20,${0.82*pulse})`;
      const bw=160*DPR, bh=22*DPR;
      const bx=(panelW-bw)/2, by=panelY-36*DPR;
      ctx.beginPath(); ctx.roundRect(bx,by,bw,bh,4*DPR); ctx.fill();
      ctx.fillStyle=`rgba(255,200,200,${0.95*pulse})`;
      ctx.font=`bold ${9*DPR}px ui-monospace,monospace`;
      ctx.textAlign='center';
      const epmStr=player.scramEPM?'EPM':'...';
      ctx.fillText(`⚡ REACTOR SCRAM — ${epmStr}  ${Math.round(restartPct*100)}%`,panelW/2,by+bh*0.70);
    }

    // ── Game over overlay ─────────────────────────────────────────────────────
    if(game.over){
      const dmg=player.damage;
      const DMG=window.DMG;
      const escaped=game.escapeResolved&&dmg?.escapeState==='complete';

      // Full black overlay
      ctx.fillStyle='rgba(4,8,18,0.96)';
      ctx.fillRect(0,0,panelW,panelY);

      const cx=panelW/2;
      let ty=panelY*0.12;

      if(escaped){
        const type=dmg.escapeType;
        const survived=dmg.escapeSurvivors;
        const total=DMG.totalCrew();
        const killed=DMG.totalKilled();
        const playerOut=dmg.escapePlayerSurvived;
        const depth=dmg.escapeDepthM;

        // Heading
        ctx.textAlign='center';
        if(playerOut){
          ctx.fillStyle='rgba(160,200,240,0.90)';
          ctx.font=`bold ${32*DPR}px ui-monospace,monospace`;
          ctx.fillText(type==='tce'?'TOWER ESCAPE':'RUSH ESCAPE',cx,ty+24*DPR);
        } else {
          ctx.fillStyle='rgba(180,60,60,0.90)';
          ctx.font=`bold ${32*DPR}px ui-monospace,monospace`;
          ctx.fillText('LOST WITH THE BOAT',cx,ty+24*DPR);
        }

        // Boat name / score line
        ty+=38*DPR;
        ctx.fillStyle='rgba(100,130,180,0.55)';
        ctx.font=`${10*DPR}px ui-monospace,monospace`;
        ctx.fillText(`──────────────────────────────────────────────────`,cx,ty);

        ty+=16*DPR;
        ctx.fillStyle='rgba(180,200,240,0.70)';
        ctx.font=`${11*DPR}px ui-monospace,monospace`;
        ctx.fillText(`DEPTH AT ESCAPE: ${depth}m   |   SCORE: ${game.score}`,cx,ty);

        ty+=22*DPR;
        // Survivor count — the big number
        const survPct=total>0?Math.round(survived/total*100):0;
        const survCol=survPct>=70?'rgba(60,200,100,0.90)':survPct>=40?'rgba(220,180,30,0.90)':'rgba(220,60,60,0.90)';
        ctx.fillStyle=survCol;
        ctx.font=`bold ${26*DPR}px ui-monospace,monospace`;
        ctx.fillText(`${survived} OF ${total}`,cx,ty);
        ty+=18*DPR;
        ctx.fillStyle='rgba(140,170,220,0.60)';
        ctx.font=`${9*DPR}px ui-monospace,monospace`;
        ctx.fillText('crew reached the surface',cx,ty);

        // Compartment crew summary
        ty+=20*DPR;
        ctx.fillStyle='rgba(100,130,180,0.45)';
        ctx.font=`${8*DPR}px ui-monospace,monospace`;
        ctx.fillText(`──────────────────────────────────────────────────`,cx,ty);
        ty+=12*DPR;

        const COMP_KEYS=DMG.COMPS;
        const COMP_LABELS=['TORP RM','CONTROL','AUX MCH','REACTOR','MANEUVR','ENGINRG'];
        const colW=(panelW*0.7)/6;
        const colStartX=cx-panelW*0.35+colW/2;
        for(let ci=0;ci<6;ci++){
          const comp=COMP_KEYS[ci];
          const list=dmg.crew[comp]||[];
          const cfit=list.filter(c=>c.status==='fit').length;
          const ckia=list.filter(c=>c.status==='killed').length;
          const cx2=colStartX+ci*colW;
          ctx.fillStyle='rgba(140,170,220,0.55)'; ctx.font=`bold ${7.5*DPR}px ui-monospace,monospace`;
          ctx.fillText(COMP_LABELS[ci],cx2,ty);
          ctx.fillStyle=dmg.flooded[comp]?'rgba(100,140,255,0.80)':'rgba(80,200,100,0.75)';
          ctx.font=`${7*DPR}px ui-monospace,monospace`;
          ctx.fillText(dmg.flooded[comp]?'FLOODED':`${cfit} surv`,cx2,ty+10*DPR);
          ctx.fillStyle='rgba(200,70,70,0.70)';
          ctx.fillText(`${ckia} lost`,cx2,ty+19*DPR);
        }

        // A few notable names
        ty+=36*DPR;
        ctx.fillStyle='rgba(100,130,180,0.45)';
        ctx.font=`${8*DPR}px ui-monospace,monospace`;
        ctx.fillText(`──────────────────────────────────────────────────`,cx,ty);
        ty+=12*DPR;

        // Show CO status, then up to 8 notable casualties
        const allCrew=COMP_KEYS.flatMap(c=>(dmg.crew[c]||[]));
        const co=allCrew.find(c=>c.rating==='CDR');
        if(co){
          ctx.fillStyle=co.status==='killed'?'rgba(200,70,70,0.80)':'rgba(80,200,100,0.75)';
          ctx.font=`${8*DPR}px ui-monospace,monospace`;
          ctx.fillText(`${co.name} — ${co.status==='killed'?'LOST':'SURVIVED'}`,cx,ty);
          ty+=12*DPR;
        }
        const officers=allCrew.filter(c=>['LCDR','LT','WO'].includes(c.rating));
        const casualties=officers.filter(c=>c.status==='killed').slice(0,4);
        const survivors2=officers.filter(c=>c.status!=='killed').slice(0,4);
        for(const c of casualties){
          ctx.fillStyle='rgba(190,65,65,0.70)'; ctx.font=`${7.5*DPR}px ui-monospace,monospace`;
          ctx.fillText(`${c.name} — LOST`,cx,ty); ty+=10*DPR;
        }
        for(const c of survivors2){
          ctx.fillStyle='rgba(70,170,90,0.65)'; ctx.font=`${7.5*DPR}px ui-monospace,monospace`;
          ctx.fillText(`${c.name} — SURVIVED`,cx,ty); ty+=10*DPR;
        }

      } else {
        // No escape — simply sunk
        ctx.fillStyle='rgba(200,60,60,0.90)';
        ctx.font=`bold ${44*DPR}px ui-monospace,monospace`;
        ctx.textAlign='center';
        ctx.fillText('SUNK',cx,panelY*0.45);
        ctx.fillStyle='rgba(140,160,200,0.60)';
        ctx.font=`${12*DPR}px ui-monospace,monospace`;
        ctx.fillText('No escape initiated',cx,panelY*0.45+22*DPR);
        ctx.fillStyle='rgba(140,160,200,0.55)';
        ctx.font=`${10*DPR}px ui-monospace,monospace`;
        ctx.fillText(`SCORE: ${game.score}`,cx,panelY*0.45+40*DPR);
      }

      // Restart hint
      ctx.fillStyle='rgba(100,130,180,0.45)';
      ctx.font=`${9*DPR}px ui-monospace,monospace`;
      ctx.textAlign='center';
      ctx.fillText('R — restart',cx,panelY-20*DPR);
    }
  }

  // ── Unified full-screen Damage/Crew panel ─────────────────────────────────
  function drawDamageScreen(W,H){
    if(!game.showDamageScreen) return;
    const dmg=player.damage;
    if(!dmg) return;
    const DMG=window.DMG;
    const PNL=window.PANEL;
    const activeWatch=game.activeWatch||'A';
    const P=10*DPR;
    const HDR_H=44*DPR;
    const LW=Math.round(W*0.60);
    const BODY_Y=HDR_H;

    // Full-screen background
    ctx.fillStyle='rgba(5,10,20,0.98)';
    ctx.fillRect(0,0,W,H);

    // Header background
    ctx.fillStyle='rgba(10,18,35,1.0)';
    ctx.fillRect(0,0,W,HDR_H);
    ctx.strokeStyle='rgba(60,100,160,0.40)';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,HDR_H); ctx.lineTo(W,HDR_H); ctx.stroke();

    // Title
    ctx.fillStyle='rgba(160,190,240,0.92)';
    ctx.font=`bold ${14*DPR}px ui-monospace,monospace`;
    ctx.textAlign='left';
    ctx.fillText('DAMAGE CONTROL',P,HDR_H*0.72);

    // Watch pill
    const fatigue=game.watchFatigue||0;
    const changing=game.watchChanging||false;
    const changeT=game.watchChangeT||0;
    const watchLabel=changing?`WATCH ${activeWatch} → ${activeWatch==='A'?'B':'A'}`:`WATCH ${activeWatch} ON`;
    const watchBg=changing?'rgba(80,60,10,0.75)':activeWatch==='A'?'rgba(30,70,150,0.75)':'rgba(10,100,90,0.75)';
    const watchFg=changing?'rgba(255,200,60,0.95)':activeWatch==='A'?'rgba(140,190,255,0.95)':'rgba(80,220,200,0.95)';
    const wPillX=W/2-180*DPR;
    ctx.fillStyle=watchBg;
    ctx.beginPath(); ctx.roundRect(wPillX,6*DPR,108*DPR,22*DPR,3*DPR); ctx.fill();
    ctx.fillStyle=watchFg;
    ctx.font=`bold ${10*DPR}px ui-monospace,monospace`;
    ctx.textAlign='center';
    ctx.fillText(watchLabel,wPillX+54*DPR,21*DPR);

    // Fatigue bar
    const fbX=wPillX+114*DPR,fbY=6*DPR,fbW=130*DPR,fbH=22*DPR;
    ctx.fillStyle='rgba(20,30,50,0.70)';
    ctx.beginPath(); ctx.roundRect(fbX,fbY,fbW,fbH,2*DPR); ctx.fill();
    const fatigueCol=fatigue>=0.8?'rgba(210,60,40,0.85)':fatigue>=0.5?'rgba(220,160,30,0.85)':'rgba(50,180,80,0.75)';
    if(fatigue>0){
      ctx.fillStyle=fatigueCol;
      ctx.beginPath(); ctx.roundRect(fbX+1,fbY+1,Math.max(2*DPR,(fbW-2)*fatigue),fbH-2,2*DPR); ctx.fill();
    }
    ctx.fillStyle='rgba(140,165,210,0.60)';
    ctx.font=`${8*DPR}px ui-monospace,monospace`;
    ctx.textAlign='left'; ctx.fillText('FATIGUE',fbX+3*DPR,21*DPR);
    ctx.textAlign='right'; ctx.fillText(`${Math.round(fatigue*100)}%`,fbX+fbW-3*DPR,21*DPR);
    if(changing){
      ctx.fillStyle='rgba(255,200,60,0.80)';
      ctx.font=`${9*DPR}px ui-monospace,monospace`; ctx.textAlign='left';
      ctx.fillText(`RELIEVING — ${Math.ceil(changeT)}s`,fbX+fbW+6*DPR,21*DPR);
    }

    // RELIEVE WATCH button
    const canRelieve=!changing&&game.tacticalState!=='action'&&game.casualtyState!=='emergency';
    const relBtnX=wPillX+254*DPR;
    ctx.fillStyle=canRelieve?'rgba(30,60,120,0.75)':'rgba(30,40,60,0.40)';
    ctx.beginPath(); ctx.roundRect(relBtnX,6*DPR,120*DPR,22*DPR,3*DPR); ctx.fill();
    ctx.fillStyle=canRelieve?'rgba(140,190,255,0.90)':'rgba(80,100,130,0.50)';
    ctx.font=`bold ${9*DPR}px ui-monospace,monospace`; ctx.textAlign='center';
    ctx.fillText(changing?'CHANGING…':'RELIEVE WATCH [W]',relBtnX+60*DPR,21*DPR);
    if(canRelieve) PNL.btn2(ctx,'',relBtnX,6*DPR,120*DPR,22*DPR,'transparent',()=>{ window.SIM?.initiateWatchChange?.(); });

    // Close button
    const closeBtnX=W-88*DPR-P;
    PNL.btn2(ctx,'[H] CLOSE',closeBtnX,6*DPR,86*DPR,22*DPR,'rgba(30,40,70,0.80)',()=>{ game.showDamageScreen=false; });

    // Vertical pane divider
    ctx.strokeStyle='rgba(50,80,130,0.40)';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(LW,BODY_Y); ctx.lineTo(LW,H); ctx.stroke();

    // ──────────────────────────────────────────────────────────────────────────
    // LEFT PANE — damage control
    // ──────────────────────────────────────────────────────────────────────────
    let cy=BODY_Y+10*DPR;

    // Crew summary row
    const fit=DMG.totalFit(),wnd=DMG.totalWounded(),kia=DMG.totalKilled(),total=DMG.totalCrew();
    const aw2=game.activeWatch||'A';
    let wkOnFit=0,wkOnWnd=0,wkOnTotal=0;
    for(const comp of DMG.COMPS){
      const cc2=(dmg.crew[comp]||[]).filter(c=>(c.watch===aw2||c.watch==='duty')&&c.dept!=='medical'&&c.dept!=='supply');
      wkOnFit  +=cc2.filter(c=>c.status==='fit'&&!c.displaced).length;
      wkOnWnd  +=cc2.filter(c=>c.status==='wounded').length;
      wkOnTotal+=cc2.filter(c=>c.status!=='killed').length;
    }
    ctx.fillStyle='rgba(160,185,230,0.70)';
    ctx.font=`${10*DPR}px ui-monospace,monospace`; ctx.textAlign='left';
    ctx.fillText(`WCH ${aw2}  ${wkOnFit} FIT  ${wkOnWnd} WND  /  ${wkOnTotal} ON WATCH`,P,cy);
    ctx.fillStyle='rgba(110,130,170,0.50)'; ctx.textAlign='right';
    ctx.fillText(`SHIP  ${fit} FIT  ${wnd} WND  ${kia} KIA  / ${total}`,LW-P,cy);
    cy+=14*DPR;

    // Tower status
    const twrCol={nominal:'rgba(22,163,74,0.75)',damaged:'rgba(217,119,6,0.80)',destroyed:'rgba(180,30,30,0.80)'};
    ctx.font=`${10*DPR}px ui-monospace,monospace`; ctx.textAlign='left';
    ctx.fillStyle=twrCol[dmg.towers.fwd]; ctx.fillText(`FWD TOWER: ${dmg.towers.fwd.toUpperCase()}`,P,cy);
    ctx.fillStyle=twrCol[dmg.towers.aft]; ctx.textAlign='right'; ctx.fillText(`AFT TOWER: ${dmg.towers.aft.toUpperCase()}`,LW-P,cy);
    cy+=10*DPR;

    // DC Teams status bar
    const teamListDS=Object.values(dmg.teams||{});
    const teamBarH=42*DPR;
    ctx.fillStyle='rgba(20,30,50,0.50)'; ctx.fillRect(P,cy,LW-P*2,teamBarH);
    ctx.strokeStyle='rgba(80,110,160,0.20)'; ctx.lineWidth=1; ctx.strokeRect(P,cy,LW-P*2,teamBarH);
    for(let ti=0;ti<teamListDS.length;ti++){
      const team=teamListDS[ti];
      const tx=P+ti*(LW-P*2)/2+4*DPR;
      const stateCol=team.state==='lost'?'rgba(200,50,50,0.90)':team.state==='mustering'?'rgba(200,140,30,0.80)':team.state==='blowing'?'rgba(255,140,0,0.90)':team.state==='transit'?'rgba(220,170,30,0.90)':team.state==='on_scene'&&team.task==='fire'?'rgba(255,100,20,0.90)':team.state==='on_scene'&&team.task==='flood'?'rgba(100,160,255,0.90)':team.state==='on_scene'&&team.task==='repair'?'rgba(80,200,100,0.90)':team.state==='on_scene'?'rgba(160,200,160,0.70)':'rgba(140,140,140,0.60)';
      ctx.fillStyle=stateCol; ctx.font=`bold ${10*DPR}px ui-monospace,monospace`; ctx.textAlign='left';
      ctx.fillText(team.label,tx,cy+13*DPR);
      const taskStr=team.state==='lost'?'— LOST':team.state==='mustering'?`MUSTER → ${DMG.COMP_DEF[team.destination]?.label||'?'} (${Math.ceil(team.musterT||0)}s)`:team.state==='blowing'?`HP BLOW — ${DMG.COMP_DEF[team.location]?.label||'?'}`:team.state==='transit'?`→ ${DMG.COMP_DEF[team.destination]?.label||'?'} (${Math.ceil(team.transitEta)}s)`:team.state==='on_scene'&&team.task==='fire'?`FIRE — ${DMG.COMP_DEF[team.location]?.label||'?'}`:team.state==='on_scene'&&team.task==='flood'?`FLOOD — ${DMG.COMP_DEF[team.location]?.label||'?'}`:team.state==='on_scene'&&team.task==='repair'?`REPAIR — ${DMG.SYS_LABEL[team.repairTarget]||'?'}`:team.state==='on_scene'?`STANDBY — ${DMG.COMP_DEF[team.location]?.label||'?'}`:'STANDBY';
      ctx.fillStyle='rgba(160,180,220,0.65)'; ctx.font=`${9*DPR}px ui-monospace,monospace`;
      ctx.fillText(taskStr,tx,cy+26*DPR);
      if(team.state==='on_scene'&&team.task==='repair'&&team.repairTarget){
        const job=window.G?.player?.damage?.repairJobs?.[team.location];
        const pct=job?Math.min(1,job.progress/job.totalTime):0;
        const bx=tx,by=cy+30*DPR,bw=(LW-P*2)/2-8*DPR,bh=5*DPR;
        ctx.fillStyle='rgba(20,40,80,0.50)'; ctx.fillRect(bx,by,bw,bh);
        ctx.fillStyle='rgba(50,160,80,0.70)'; ctx.fillRect(bx,by,bw*pct,bh);
      }
    }
    cy+=teamBarH+8*DPR;

    // ── 3-Deck Schematic ───────────────────────────────────────────────────────
    const schX=P, schW=LW-P*2, schH=185*DPR, schY=cy;
    const compKeys=DMG.COMPS;
    const compLabels=['TORP RM','CONTROL','AUX MCH','REACTOR','MANEUVR','ENGINRG'];
    const compFracs=[0.21,0.21,0.08,0.10,0.21,0.19];
    // 3 decks of 32px each → inner hull height 96px
    const dH=32*DPR;
    const phTop=schY+52*DPR, phBot=schY+148*DPR, phMid=(phTop+phBot)*0.5;
    const phR=(phBot-phTop)*0.5;                              // 48px
    const phX0=schX+phR+18*DPR, phX1=schX+schW-phR-18*DPR, phSpan=phX1-phX0;
    const ohR=phR+8*DPR, ohTop=phMid-ohR, ohBot=phMid+ohR;
    const sailCX=phX0+phSpan*(0.21+0.105);
    const sailW2=44*DPR, sailH2=24*DPR, sailBot2=ohTop, sailTop2=sailBot2-sailH2;
    // Deck top boundaries (D1=top, D2=middle, D3=bottom)
    const d1Top=phTop, d2Top=phTop+dH, d3Top=phTop+2*dH;
    const deckTops=[d1Top,d2Top,d3Top];
    // Compartment X positions
    let compXs=[],compWs=[];
    { let xx=phX0; for(let i=0;i<6;i++){ compWs[i]=phSpan*compFracs[i]; compXs[i]=xx; xx+=compWs[i]; } }
    // Per-deck cell labels based on real layout [D1, D2, D3]
    const DECK_CELL={
      fore_ends:    ['FWD DOME / PLANES','ENG OFFICE (UNM)','TORPEDO ROOM'],
      control_room: ['COMMS · SCOPE · ESC','CONTROL ROOM','MACH · HYD · HPA'],
      aux_section:  ['SNKL CTL','VENT PLT','RX E-COOL'],
      reactor_comp: ['RC TUNNEL','REACTOR','REACTOR'],
      engine_room:  ['MANEUVERING','ELEC DIST','MACHINERY'],
      aft_ends:     ['ENGINEERING','PROPULSION','STEER / AFT'],
    };
    const stFill={nominal:'rgba(18,55,28,0.88)',degraded:'rgba(75,58,4,0.90)',offline:'rgba(75,22,4,0.92)',destroyed:'rgba(55,4,4,0.96)'};
    const stStroke={nominal:'rgba(50,200,80,0.55)',degraded:'rgba(220,170,20,0.80)',offline:'rgba(220,80,20,0.90)',destroyed:'rgba(200,30,30,1.0)'};
    // Special cell backgrounds
    const BG_UNMANNED ='rgba(12,28,20,0.92)';   // aux_section all decks
    const BG_RX_ZONE  ='rgba(38,20,4,0.96)';    // reactor D2+D3
    const BG_RC_TUNNEL='rgba(14,38,50,0.95)';   // reactor D1 (passageway)
    const BG_UNMANNED2='rgba(14,30,22,0.88)';   // fore_ends D2 (unmanned office)
    function dsphPill(){
      ctx.beginPath();
      ctx.arc(phX0,phMid,phR,Math.PI*0.5,-Math.PI*0.5,false);
      ctx.lineTo(phX1,phTop); ctx.arc(phX1,phMid,phR,-Math.PI*0.5,Math.PI*0.5,false);
      ctx.lineTo(phX0,phBot); ctx.closePath();
    }
    function dsohPill(){
      ctx.beginPath();
      ctx.arc(phX0,phMid,ohR,Math.PI*0.5,-Math.PI*0.5,false);
      ctx.lineTo(phX1,ohTop); ctx.arc(phX1,phMid,ohR,-Math.PI*0.5,Math.PI*0.5,false);
      ctx.lineTo(phX0,ohBot); ctx.closePath();
    }
    // Flood fraction for a specific deck (di=0→D1 fills last, di=2→D3 fills first)
    function deckFloodFrac(flood,isFlooded,di){
      if(isFlooded) return 1;
      const t=flood*3;
      return di===2?Math.min(1,Math.max(0,t)):di===1?Math.min(1,Math.max(0,t-1)):Math.min(1,Math.max(0,t-2));
    }
    // Precompute per-compartment state
    const cState=compKeys.map(comp=>{
      const sysList=DMG.COMP_DEF[comp].systems; let wi=0;
      for(const s of sysList) wi=Math.max(wi,DMG.STATES.indexOf(dmg.systems[s]));
      const fires=[0,1,2].map(di=>dmg.fire?.[`${comp}_d${di}`]||0);
      return {wi,worst:DMG.STATES[wi],flood:dmg.flooding[comp]||0,isFlooded:!!dmg.flooded[comp],fireLevel:Math.max(...fires),fires};
    });

    // Outer hull silhouette
    ctx.save();
    dsohPill();
    ctx.strokeStyle='rgba(100,130,180,0.35)'; ctx.lineWidth=1.5*DPR;
    ctx.setLineDash([3*DPR,4*DPR]); ctx.stroke(); ctx.setLineDash([]);
    // Sail
    const sX0=sailCX-sailW2*0.5, sX1=sailCX+sailW2*0.5;
    ctx.strokeStyle='rgba(140,170,220,0.55)'; ctx.lineWidth=1.5*DPR;
    ctx.beginPath();
    ctx.moveTo(sX0+4*DPR,sailBot2); ctx.lineTo(sX0+4*DPR,sailTop2+4*DPR);
    ctx.bezierCurveTo(sX0+4*DPR,sailTop2,sX0+10*DPR,sailTop2,sX0+12*DPR,sailTop2);
    ctx.lineTo(sX1-5*DPR,sailTop2); ctx.lineTo(sX1,sailTop2+8*DPR); ctx.lineTo(sX1,sailBot2);
    ctx.stroke();
    // Fins
    const finX=phX1+ohR*0.7;
    ctx.strokeStyle='rgba(110,140,190,0.40)'; ctx.lineWidth=1*DPR;
    ctx.beginPath(); ctx.moveTo(finX,ohTop+6*DPR); ctx.lineTo(finX+16*DPR,ohTop+2*DPR); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(finX,ohBot-6*DPR); ctx.lineTo(finX+16*DPR,ohBot-2*DPR); ctx.stroke();
    // Propulsor
    const prX=phX1+ohR-3*DPR,prY=phMid,prR2=8*DPR;
    ctx.strokeStyle='rgba(140,170,220,0.60)'; ctx.lineWidth=1.5*DPR;
    for(let a=0;a<3;a++){
      const ang=a*Math.PI/3;
      ctx.beginPath();
      ctx.moveTo(prX+Math.cos(ang)*prR2*0.3,prY+Math.sin(ang)*prR2*0.3);
      ctx.bezierCurveTo(prX+Math.cos(ang+0.8)*prR2,prY+Math.sin(ang+0.8)*prR2,prX+Math.cos(ang+1.0)*prR2,prY+Math.sin(ang+1.0)*prR2,prX+Math.cos(ang+1.2)*prR2,prY+Math.sin(ang+1.2)*prR2);
      ctx.moveTo(prX+Math.cos(ang+Math.PI)*prR2*0.3,prY+Math.sin(ang+Math.PI)*prR2*0.3);
      ctx.bezierCurveTo(prX+Math.cos(ang+Math.PI+0.8)*prR2,prY+Math.sin(ang+Math.PI+0.8)*prR2,prX+Math.cos(ang+Math.PI+1.0)*prR2,prY+Math.sin(ang+Math.PI+1.0)*prR2,prX+Math.cos(ang+Math.PI+1.2)*prR2,prY+Math.sin(ang+Math.PI+1.2)*prR2);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(prX,prY,2.5*DPR,0,Math.PI*2); ctx.stroke();
    ctx.restore();

    // ── Fill per-deck cells (clipped to hull) ─────────────────────────────────
    for(let ci=0;ci<6;ci++){
      const comp=compKeys[ci]; const cs=cState[ci];
      const cx2=compXs[ci], cw=compWs[ci];
      const fx=ci===0?cx2-phR:cx2, fw=(ci===0||ci===5)?cw+phR:cw;
      for(let di=0;di<3;di++){
        const dTop=deckTops[di];
        ctx.save(); dsphPill(); ctx.clip();
        // Base background — special cells override system state color
        let bg=stFill[cs.worst]||stFill.nominal;
        if(comp==='aux_section')                  bg=BG_UNMANNED;
        else if(comp==='reactor_comp'&&di===0)    bg=BG_RC_TUNNEL;
        else if(comp==='reactor_comp'&&di>0)      bg=BG_RX_ZONE;
        else if(comp==='fore_ends'&&di===1)       bg=BG_UNMANNED2;
        ctx.fillStyle=cs.isFlooded?'rgba(8,18,70,0.98)':bg;
        ctx.fillRect(fx,dTop,fw,dH);
        // System glow on damaged normal cells
        if(cs.wi>0&&comp!=='aux_section'&&!(comp==='reactor_comp'&&di>0)){
          const gc=['','rgba(220,170,20,0.13)','rgba(220,80,20,0.17)','rgba(200,30,30,0.22)'];
          ctx.fillStyle=gc[cs.wi]||''; ctx.fillRect(fx,dTop,fw,dH);
        }
        // Flood fill — D3 fills first, then D2, then D1
        const ff=deckFloodFrac(cs.flood,cs.isFlooded,di);
        if(ff>0){
          const fH=dH*ff;
          ctx.fillStyle=`rgba(28,75,200,${0.30+ff*0.46})`; ctx.fillRect(fx,dTop+dH-fH,fw,fH);
          if(ff<0.99&&ff>0.01){  // waterline within this deck
            ctx.strokeStyle='rgba(100,160,255,0.60)'; ctx.lineWidth=1*DPR;
            ctx.beginPath(); ctx.moveTo(fx,dTop+dH-fH); ctx.lineTo(fx+fw,dTop+dH-fH); ctx.stroke();
          }
        }
        // Fire overlay — per-room
        const roomFire=cs.fires[di]||0;
        if(roomFire>0.02){
          ctx.fillStyle=`rgba(200,80,0,${0.11+roomFire*0.20})`; ctx.fillRect(fx,dTop,fw,dH);
        }
        ctx.restore();
      }
    }

    // Hull border
    dsphPill(); ctx.strokeStyle='rgba(80,120,180,0.50)'; ctx.lineWidth=1.5*DPR; ctx.stroke();

    // Deck divider lines (horizontal, clipped to hull)
    ctx.save(); dsphPill(); ctx.clip();
    ctx.strokeStyle='rgba(70,100,150,0.50)'; ctx.lineWidth=1*DPR;
    for(let di=1;di<3;di++){
      const y=deckTops[di];
      ctx.beginPath(); ctx.moveTo(phX0-phR,y); ctx.lineTo(phX1+phR,y); ctx.stroke();
    }
    ctx.restore();

    // Compartment dividers (vertical, clipped to hull)
    ctx.save(); dsphPill(); ctx.clip();
    for(let ci=1;ci<6;ci++){
      const x=compXs[ci];
      const stA=dmg.systems[DMG.COMP_DEF[compKeys[ci-1]].systems[0]]||'nominal';
      const stB=dmg.systems[DMG.COMP_DEF[compKeys[ci]].systems[0]]||'nominal';
      const wDiv=Math.max(DMG.STATES.indexOf(stA),DMG.STATES.indexOf(stB));
      ctx.strokeStyle=['rgba(50,120,65,0.55)','rgba(160,130,20,0.65)','rgba(160,60,20,0.75)','rgba(150,30,30,0.85)'][wDiv]||'rgba(60,90,140,0.50)';
      ctx.lineWidth=1.5*DPR;
      ctx.beginPath(); ctx.moveTo(x,phTop); ctx.lineTo(x,phBot); ctx.stroke();
    }
    ctx.restore();

    // WTD (Watertight Door) indicators — colored bars on each divider, clickable
    {
      const wtd=dmg.wtd||{};
      const hydOk=(dmg.systems?.hyd_main||'nominal')!=='destroyed';
      const wtdBtnW=14*DPR, wtdBarW=5*DPR, wtdBarH=phBot-phTop;
      ctx.save(); dsphPill(); ctx.clip();
      for(let ci=1;ci<=5;ci++){
        const [sA,sB]=DMG.WTD_PAIRS[ci-1];
        const key=sA+'|'+sB;
        const state=wtd[key]||'open';
        const x=compXs[ci];
        // Bar color: green tint when open, red when closed, amber if hyd plant out
        let barCol;
        if(!hydOk&&state==='open')    barCol='rgba(200,160,40,0.60)';  // amber: open, hyd out
        else if(!hydOk)               barCol='rgba(180,80,40,0.75)';   // amber-red: closed, hyd out
        else if(state==='closed')     barCol='rgba(180,50,30,0.80)';   // red: closed
        else                          barCol='rgba(20,160,70,0.28)';   // dim green: open (normal)
        ctx.fillStyle=barCol;
        ctx.fillRect(x-wtdBarW*0.5, phTop, wtdBarW, wtdBarH);
        // Horizontal crossbar symbol when closed — drawn in D2 mid
        if(state==='closed'){
          ctx.strokeStyle='rgba(255,210,190,0.88)'; ctx.lineWidth=1.5*DPR;
          const bMid=d2Top+dH*0.5;
          ctx.beginPath(); ctx.moveTo(x-5*DPR,bMid); ctx.lineTo(x+5*DPR,bMid); ctx.stroke();
        }
      }
      ctx.restore();
      // Click targets — wider than bar for easier clicking
      for(let ci=1;ci<=5;ci++){
        const [sA,sB]=DMG.WTD_PAIRS[ci-1];
        const x=compXs[ci];
        const _sA=sA, _sB=sB;
        PNL.btn2(ctx,'',x-wtdBtnW*0.5,phTop,wtdBtnW,wtdBarH,'transparent',()=>DMG.toggleWTD(_sA,_sB));
      }
    }

    // Deck labels (D1/D2/D3) on left margin, outside hull
    ctx.fillStyle='rgba(80,110,160,0.55)'; ctx.font=`${8*DPR}px ui-monospace,monospace`; ctx.textAlign='right';
    ctx.fillText('D1',phX0-phR-3*DPR,d1Top+dH*0.65);
    ctx.fillText('D2',phX0-phR-3*DPR,d2Top+dH*0.65);
    ctx.fillText('D3',phX0-phR-3*DPR,d3Top+dH*0.65);

    // Cell content: labels + status text (clipped to hull)
    ctx.save(); dsphPill(); ctx.clip();
    for(let ci=0;ci<6;ci++){
      const comp=compKeys[ci]; const cs=cState[ci];
      const cx2=compXs[ci],cw=compWs[ci],cMid=cx2+cw*0.5;
      const cellLabels=DECK_CELL[comp]||['','',''];
      // Section header label at top of D1
      ctx.fillStyle='rgba(200,220,255,0.88)'; ctx.font=`bold ${8.5*DPR}px ui-monospace,monospace`; ctx.textAlign='center';
      ctx.fillText(compLabels[ci],cMid,d1Top+9*DPR);
      // Per-deck cell labels
      for(let di=0;di<3;di++){
        const dMid=deckTops[di]+dH*0.62;
        const ff=deckFloodFrac(cs.flood,cs.isFlooded,di);
        if(ff>=0.95) continue;  // fully flooded cell — skip text
        let lblCol='rgba(150,185,225,0.65)';
        if(comp==='aux_section')               lblCol='rgba(80,125,100,0.70)';
        else if(comp==='reactor_comp'&&di===0) lblCol='rgba(70,155,185,0.80)';
        else if(comp==='reactor_comp'&&di>0)   lblCol='rgba(175,100,40,0.80)';
        else if(comp==='fore_ends'&&di===1)    lblCol='rgba(80,115,100,0.65)';
        ctx.fillStyle=lblCol;
        ctx.font=`${7.5*DPR}px ui-monospace,monospace`; ctx.textAlign='center';
        ctx.fillText(cellLabels[di],cMid,dMid);
      }
      // Status overlay — centered in D2 band
      const d2Mid=d2Top+dH*0.56;
      if(cs.isFlooded){
        ctx.fillStyle='rgba(140,180,255,0.95)'; ctx.font=`bold ${9*DPR}px ui-monospace,monospace`;
        ctx.fillText('FLOODED',cMid,d2Mid);
      } else if(cs.fireLevel>0.02){
        ctx.fillStyle=cs.fireLevel>0.85?'rgba(255,80,20,0.95)':'rgba(255,140,40,0.90)';
        ctx.font=`bold ${8*DPR}px ui-monospace,monospace`;
        ctx.fillText(dmg._fireDrench?.[comp]?'DRENCHED':`FIRE ${Math.round(cs.fireLevel*100)}%`,cMid,d2Mid);
      } else if(cs.flood>0.02){
        ctx.fillStyle='rgba(140,190,255,0.90)'; ctx.font=`${8*DPR}px ui-monospace,monospace`;
        ctx.fillText(`${Math.round(cs.flood*100)}%`,cMid,d2Mid);
      } else if(cs.wi>0){
        const stColD={degraded:'rgba(230,170,20,0.80)',offline:'rgba(230,90,30,0.85)',destroyed:'rgba(200,50,50,0.90)'};
        ctx.fillStyle=stColD[cs.worst]||''; ctx.font=`bold ${8*DPR}px ui-monospace,monospace`;
        ctx.fillText(cs.worst.toUpperCase(),cMid,d2Mid);
      }
      // Watchkeeper count at bottom of D3
      const cc=dmg.crew[comp]||[];
      const wk=cc.filter(c=>(c.watch===aw2||c.watch==='duty')&&c.dept!=='medical'&&c.dept!=='supply');
      const wkFit=wk.filter(c=>c.status==='fit'&&!c.displaced).length;
      const wkDisp=wk.filter(c=>c.displaced&&c.status!=='killed').length;
      const wkKia=wk.filter(c=>c.status==='killed').length;
      const wkTotal=wk.length-wkKia;
      if(wkTotal>0||wkKia>0){
        ctx.fillStyle=wkKia>0?'rgba(220,80,80,0.85)':wkDisp>0?'rgba(200,170,50,0.80)':'rgba(90,190,110,0.72)';
        ctx.font=`${8*DPR}px ui-monospace,monospace`; ctx.textAlign='center';
        const crewLabel=wkDisp>0?`${wkFit}+${wkDisp}d/${wkTotal}`:`${wkFit}/${wkTotal}`;
        ctx.fillText(crewLabel,cMid,d3Top+dH-4*DPR);
      }
    }
    ctx.restore();
    cy=schY+schH+10*DPR;

    // ── DC Team dispatch rows ──────────────────────────────────────────────────
    {
      const teamList2=[dmg.teams?.alpha,dmg.teams?.bravo].filter(Boolean);
      const dispBtnH=22*DPR,dispGap=3*DPR,labelW=phX0-schX;
      for(let ti=0;ti<teamList2.length;ti++){
        const team=teamList2[ti];
        const rowY=cy+ti*(dispBtnH+dispGap+2*DPR);
        const isReady=team.state==='ready';
        const isMusteringEmerg2=team._readyT>0;
        const isLocked2=team._locked;
        const tLabelCol=team.state==='lost'?'rgba(180,30,30,0.80)':isMusteringEmerg2?'rgba(170,100,0,0.80)':team.state==='mustering'?'rgba(160,110,15,0.75)':isReady?'rgba(80,80,90,0.70)':team.task==='flood'?'rgba(30,70,160,0.75)':'rgba(30,100,50,0.75)';
        ctx.fillStyle=tLabelCol; ctx.beginPath(); ctx.roundRect(schX,rowY,labelW-dispGap,dispBtnH,3*DPR); ctx.fill();
        ctx.fillStyle='rgba(220,220,240,0.90)'; ctx.font=`bold ${9*DPR}px ui-monospace,monospace`; ctx.textAlign='center';
        const pillTxt2=isMusteringEmerg2?`MSTR ${Math.ceil(team._readyT)}s`:isLocked2?team.label.replace('DC ','')+' \u{1F512}':team.label.replace('DC ','');
        ctx.fillText(pillTxt2,schX+(labelW-dispGap)/2,rowY+dispBtnH*0.68);
        for(let ci=0;ci<6;ci++){
          const comp=compKeys[ci];
          const bx=compXs[ci]+dispGap/2,bw=compWs[ci]-dispGap;
          const lbl=compLabels[ci].slice(0,3);
          const isOnScene=team.state==='on_scene'&&team.location===comp;
          const isInTransit=team.state==='transit'&&team.destination===comp;
          const isMustering2=team.state==='mustering'&&team.destination===comp;
          const isFloodedD=dmg.flooded[comp];
          const fireLevelD=Math.max(...[0,1,2].map(di=>dmg.fire?.[`${comp}_d${di}`]||0)),hasFireD=fireLevelD>0.02;
          const isDrenchedD=!!dmg._fireDrench?.[comp];
          let bCol,bLabel,clickFn;
          if(team.state==='lost'){ bCol='rgba(30,30,30,0.22)'; bLabel=lbl; clickFn=null; }
          else if(team.state==='blowing'&&team.location===comp){ bCol='rgba(180,90,0,0.85)'; bLabel='BLOW'; clickFn=()=>DMG.recallTeam(team.id); }
          else if(isDrenchedD){ bCol='rgba(40,40,50,0.45)'; bLabel='N2'; clickFn=null; }
          else if(isFloodedD){
            const isBlowingHere=(team.state==='blowing'&&team.location===comp)||(team.state==='transit'&&team.destination===comp);
            if(isBlowingHere){ bCol='rgba(180,90,0,0.85)'; bLabel='BLOW \u25a0'; clickFn=()=>DMG.recallTeam(team.id); }
            else { bCol='rgba(60,30,10,0.70)'; bLabel='BLOW?'; clickFn=()=>DMG.assignTeam(team.id,comp); }
          } else if(hasFireD&&isOnScene&&team.task==='fire'){ bCol='rgba(160,50,10,0.85)'; bLabel='FIRE \u25a0'; clickFn=()=>DMG.recallTeam(team.id); }
          else if(hasFireD&&isInTransit){ bCol='rgba(130,55,10,0.80)'; bLabel='\u2192FIRE'; clickFn=()=>DMG.recallTeam(team.id); }
          else if(hasFireD){ bCol='rgba(140,40,5,0.75)'; bLabel='FIRE'; clickFn=()=>DMG.assignTeam(team.id,comp); }
          else if(isOnScene){ bCol='rgba(20,90,40,0.85)'; bLabel=lbl+' \u2713'; clickFn=()=>DMG.recallTeam(team.id); }
          else if(isMustering2){ bCol='rgba(160,110,15,0.75)'; bLabel='MSTR '+lbl; clickFn=()=>DMG.recallTeam(team.id); }
          else if(isInTransit){ bCol='rgba(120,95,15,0.80)'; bLabel='\u2192'+lbl; clickFn=()=>DMG.recallTeam(team.id); }
          else { bCol='rgba(25,45,105,0.65)'; bLabel=lbl; clickFn=()=>DMG.assignTeam(team.id,comp); }
          PNL.btn2(ctx,bLabel,bx,rowY,bw,dispBtnH,bCol,clickFn||(()=>{}));
        }
      }
      cy+=teamList2.length*(dispBtnH+dispGap+2*DPR)+6*DPR;
    }

    // ── Systems grid ───────────────────────────────────────────────────────────
    const stColText={'nominal':'rgba(80,200,100,0.80)','degraded':'rgba(230,170,20,0.90)','offline':'rgba(230,90,30,0.90)','destroyed':'rgba(200,50,50,0.95)'};
    let sysMaxY=cy;
    for(let ci=0;ci<6;ci++){
      const comp=compKeys[ci],cx2=compXs[ci],cw=compWs[ci];
      const sysList=DMG.COMP_DEF[comp].systems;
      let sy=cy;
      for(const sys of sysList){
        const st=dmg.systems[sys];
        ctx.fillStyle='rgba(160,180,220,0.70)'; ctx.font=`${9*DPR}px ui-monospace,monospace`; ctx.textAlign='center';
        ctx.fillText(DMG.SYS_LABEL[sys]||sys,cx2+cw/2,sy); sy+=12*DPR;
        ctx.fillStyle=stColText[st]||stColText.destroyed; ctx.font=`bold ${9*DPR}px ui-monospace,monospace`;
        ctx.fillText(st.toUpperCase(),cx2+cw/2,sy); sy+=10*DPR;
      }
      sysMaxY=Math.max(sysMaxY,sy);
    }
    cy=sysMaxY+10*DPR;

    // ── Escape buttons ─────────────────────────────────────────────────────────
    ctx.fillStyle='rgba(120,140,180,0.50)'; ctx.font=`${10*DPR}px ui-monospace,monospace`; ctx.textAlign='left';
    ctx.fillText('ESCAPE',P,cy); cy+=6*DPR;
    const halfEsc=(LW-P*2-6*DPR)/2;
    const tceViable=DMG.canTCE(),escActive=!!dmg.escapeState;
    PNL.btn2(ctx,escActive?'ESCAPING…':'TCE ESCAPE',P,cy,halfEsc,18*DPR,
      escActive?'rgba(30,80,30,0.50)':tceViable?'rgba(20,60,20,0.70)':'rgba(60,60,60,0.30)',
      ()=>{ if(!escActive&&tceViable) DMG.initiateEscape('tce'); });
    PNL.btn2(ctx,escActive?'ESCAPING…':'RUSH ESCAPE',P+halfEsc+6*DPR,cy,halfEsc,18*DPR,
      escActive?'rgba(80,30,30,0.50)':'rgba(100,30,10,0.70)',
      ()=>{ if(!escActive) DMG.initiateEscape('rush'); });
    const depthM=Math.round(player.depth||0);
    const depthAdv=depthM<=120?'TCE & RUSH viable':depthM<=200?'TCE marginal':'TCE not viable';
    const depthAdvCol=depthM<=120?'rgba(80,200,80,0.70)':depthM<=200?'rgba(220,170,20,0.80)':'rgba(220,80,50,0.80)';
    ctx.fillStyle=depthAdvCol; ctx.font=`${9*DPR}px ui-monospace,monospace`; ctx.textAlign='center';
    ctx.fillText(`${depthM}m — ${depthAdv}`,LW/2,cy+30*DPR); cy+=36*DPR;

    // ── Seal buttons ───────────────────────────────────────────────────────────
    const hasSealTargets=DMG.COMPS.some(comp=>!dmg.flooded[comp]&&(dmg.flooding[comp]||0)>0.05);
    if(hasSealTargets){
      ctx.fillStyle='rgba(80,100,140,0.40)'; ctx.font=`${8*DPR}px ui-monospace,monospace`; ctx.textAlign='left';
      ctx.fillText('SEAL (last resort — kills all crew inside):',P,cy); cy+=6*DPR;
      for(let ci=0;ci<6;ci++){
        const comp=compKeys[ci],cx2=compXs[ci],cw=compWs[ci];
        if(!dmg.flooded[comp]&&(dmg.flooding[comp]||0)>0.05)
          PNL.btn2(ctx,compLabels[ci].slice(0,3),cx2+2,cy,cw-4,14*DPR,'rgba(100,30,30,0.60)',()=>DMG.sealFlooding(comp));
      }
      cy+=18*DPR;
    }

    // ── Debug hit buttons ──────────────────────────────────────────────────────
    if(game.debugOverlay){
      ctx.fillStyle='rgba(200,50,50,0.60)'; ctx.font=`${9*DPR}px ui-monospace,monospace`; ctx.textAlign='left';
      ctx.fillText('[ DEBUG ] HIT:',P,cy-2*DPR);
      const dbgW=(LW-P*2-4*DPR)/6;
      for(let i=0;i<6;i++){
        const comp=DMG.COMPS[i],isHit=(dmg.strikes[comp]||0)>=1;
        PNL.btn2(ctx,compLabels[i].slice(0,3),P+i*dbgW,cy,dbgW-3*DPR,14*DPR,
          isHit?'rgba(180,30,30,0.80)':'rgba(100,30,30,0.55)',()=>DMG.hit(55,null,null,comp));
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // RIGHT PANE — Ship's Company
    // ──────────────────────────────────────────────────────────────────────────
    const RX=LW+P, RW=W-LW-P*2;
    const d=player.damage;
    let ry2=BODY_Y+10*DPR;
    ctx.fillStyle='rgba(140,180,240,0.92)';
    ctx.font=`bold ${13*DPR}px ui-monospace,monospace`; ctx.textAlign='left';
    ctx.fillText("SHIP'S COMPANY",RX,ry2); ry2+=16*DPR;

    ctx.font=`${12*DPR}px ui-monospace,monospace`;
    ctx.fillStyle='rgba(60,200,90,0.85)';   ctx.fillText(`FIT ${fit}`,  RX,           ry2);
    ctx.fillStyle='rgba(230,170,30,0.90)';  ctx.fillText(`WND ${wnd}`,  RX+72*DPR,   ry2);
    ctx.fillStyle='rgba(210,50,50,0.90)';   ctx.fillText(`KIA ${kia}`,  RX+144*DPR,  ry2);
    ctx.fillStyle='rgba(140,165,210,0.60)'; ctx.fillText(`/ ${total}`,  RX+216*DPR,  ry2);
    ry2+=10*DPR;
    ctx.strokeStyle='rgba(60,100,160,0.25)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(LW,ry2); ctx.lineTo(W,ry2); ctx.stroke(); ry2+=8*DPR;

    const colW2=(RW-8*DPR)/2, col0x2=RX, col1x2=RX+colW2+8*DPR;
    const COMP_LABELS2={fore_ends:'TORPEDO ROOM',control_room:'CONTROL ROOM',aux_section:'AUX MACHINERY',reactor_comp:'REACTOR COMP',engine_room:'MANEUVERING',aft_ends:'ENGINEERING'};
    const SUPPORT_DEPTS2=new Set(['medical','supply']);
    const leftComps2=['fore_ends','control_room','aux_section','reactor_comp'];
    const rightComps2=['engine_room','aft_ends'];
    const ROW_H2=16*DPR, SEC_HDR2=20*DPR;
    const STATUS_COL2={fit:'rgba(50,190,80,0.90)',wounded:'rgba(230,165,25,0.90)',killed:'rgba(200,40,40,0.75)'};
    const _hoverHits2=[];
    const mx2=window.I?.mouseX||0, my2=window.I?.mouseY||0;

    function drawCrewRow2(m,rx,ry,subW,isDuty){
      const isKia=m.status==='killed',isWnd=m.status==='wounded';
      const isOnWatch2=m.watch==='duty'||m.watch===activeWatch;
      ctx.globalAlpha=isKia?0.35:isOnWatch2?1.0:0.55;
      const pillW2=32*DPR, rowTop2=ry-ROW_H2*0.82;
      ctx.fillStyle=STATUS_COL2[m.status]||STATUS_COL2.fit;
      ctx.beginPath(); ctx.arc(rx+5*DPR,ry-4*DPR,3.5*DPR,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=isWnd?'rgba(200,140,20,0.70)':isKia?'rgba(140,20,20,0.50)':'rgba(30,55,100,0.65)';
      ctx.beginPath(); ctx.roundRect(rx+12*DPR,rowTop2,pillW2,ROW_H2*0.85,2*DPR); ctx.fill();
      ctx.fillStyle='rgba(200,220,255,0.90)'; ctx.font=`bold ${9*DPR}px ui-monospace,monospace`; ctx.textAlign='center';
      ctx.fillText(m.rating,rx+12*DPR+pillW2/2,ry-2*DPR);
      ctx.fillStyle=isKia?'rgba(180,60,60,0.60)':isWnd?'rgba(220,165,30,0.90)':'rgba(200,215,245,0.90)';
      ctx.font=`${11*DPR}px ui-monospace,monospace`; ctx.textAlign='left';
      ctx.fillText(`${m.firstName[0]}.${m.lastName}`,rx+48*DPR,ry-2*DPR);
      const badgesW2=isDuty?20*DPR:36*DPR;
      ctx.fillStyle='rgba(120,170,220,0.70)'; ctx.font=`${9*DPR}px ui-monospace,monospace`; ctx.textAlign='right';
      ctx.fillText(m.role||'',rx+subW-badgesW2-4*DPR,ry-2*DPR);
      const badgeX2=rx+subW-badgesW2;
      const wBg2=m.watch==='duty'?'rgba(160,120,20,0.65)':m.watch==='A'?'rgba(25,55,130,0.65)':'rgba(10,90,80,0.65)';
      const wFg2=m.watch==='duty'?'rgba(255,210,60,0.95)':m.watch==='A'?'rgba(120,170,255,0.95)':'rgba(60,210,185,0.95)';
      ctx.fillStyle=wBg2; ctx.beginPath(); ctx.roundRect(badgeX2,rowTop2,16*DPR,ROW_H2*0.80,2*DPR); ctx.fill();
      ctx.fillStyle=wFg2; ctx.font=`bold ${8*DPR}px ui-monospace,monospace`; ctx.textAlign='center';
      ctx.fillText(m.watch==='duty'?'★':m.watch,badgeX2+8*DPR,ry-2*DPR);
      if(m.dcTeam){
        const dcX2=badgeX2+18*DPR;
        ctx.fillStyle=m.dcTeam==='alpha'?'rgba(140,40,130,0.65)':'rgba(40,100,40,0.65)';
        ctx.beginPath(); ctx.roundRect(dcX2,rowTop2,16*DPR,ROW_H2*0.80,2*DPR); ctx.fill();
        ctx.fillStyle=m.dcTeam==='alpha'?'rgba(230,140,220,0.95)':'rgba(120,230,120,0.95)';
        ctx.font=`bold ${8*DPR}px ui-monospace,monospace`; ctx.textAlign='center';
        ctx.fillText(m.dcTeam==='alpha'?'α':'β',dcX2+8*DPR,ry-2*DPR);
      }
      ctx.globalAlpha=1.0;
      if(m.roleDesc) _hoverHits2.push({x:rx,y:rowTop2,w:subW,h:ROW_H2,tip:m.roleDesc});
    }

    function drawCompSection2(comp,sx,sy,availW){
      const crew2=(d.crew[comp]||[]).filter(m=>!SUPPORT_DEPTS2.has(m.dept));
      const fitC2=crew2.filter(c=>c.status==='fit'&&!c.displaced).length;
      const wndC2=crew2.filter(c=>c.status==='wounded').length;
      const kiaC2=crew2.filter(c=>c.status==='killed').length;
      const hasFF2=[0,1,2].some(di=>(d.fire?.[`${comp}_d${di}`]||0)>0.02)||d.flooded?.[comp]||(d.flooding?.[comp]||0)>0.01;
      ctx.fillStyle=hasFF2?'rgba(100,30,10,0.55)':'rgba(20,38,70,0.60)';
      ctx.beginPath(); ctx.roundRect(sx,sy,availW,SEC_HDR2,2*DPR); ctx.fill();
      ctx.fillStyle='rgba(180,210,255,0.90)'; ctx.font=`bold ${11*DPR}px ui-monospace,monospace`; ctx.textAlign='left';
      ctx.fillText(COMP_LABELS2[comp],sx+6*DPR,sy+SEC_HDR2*0.72);
      ctx.font=`${10*DPR}px ui-monospace,monospace`; ctx.textAlign='right';
      const sumStr2=kiaC2>0?`${fitC2} fit  ${wndC2} wnd  ${kiaC2} kia`:`${fitC2}/${crew2.length} fit`;
      ctx.fillStyle=kiaC2>0?'rgba(210,60,60,0.85)':wndC2>0?'rgba(220,160,30,0.80)':'rgba(80,190,100,0.70)';
      ctx.fillText(sumStr2,sx+availW-6*DPR,sy+SEC_HDR2*0.72); sy+=SEC_HDR2+2*DPR;
      const dutyList2=crew2.filter(m=>m.watch==='duty');
      const watchB2=crew2.filter(m=>m.watch==='B'), watchA2=crew2.filter(m=>m.watch==='A');
      const subW2=(availW-4*DPR)/2;
      for(let i=0;i<dutyList2.length;i++){
        ctx.fillStyle='rgba(140,110,10,0.12)'; ctx.fillRect(sx,sy+i*ROW_H2,availW,ROW_H2-1);
        drawCrewRow2(dutyList2[i],sx,sy+i*ROW_H2+ROW_H2*0.82,availW,true);
      }
      if(dutyList2.length) sy+=dutyList2.length*ROW_H2+2*DPR;
      if(watchB2.length||watchA2.length){
        ctx.font=`bold ${8*DPR}px ui-monospace,monospace`; ctx.textAlign='center';
        ctx.fillStyle=activeWatch==='B'?'rgba(60,210,185,0.80)':'rgba(60,210,185,0.40)';
        ctx.fillText('── WCH B ──',sx+subW2/2,sy+8*DPR);
        ctx.fillStyle=activeWatch==='A'?'rgba(120,170,255,0.80)':'rgba(120,170,255,0.40)';
        ctx.fillText('── WCH A ──',sx+subW2+4*DPR+subW2/2,sy+8*DPR); sy+=11*DPR;
      }
      const rows2=Math.max(watchB2.length,watchA2.length);
      for(let i=0;i<watchB2.length;i++) drawCrewRow2(watchB2[i],sx,sy+i*ROW_H2+ROW_H2*0.82,subW2,false);
      for(let i=0;i<watchA2.length;i++) drawCrewRow2(watchA2[i],sx+subW2+4*DPR,sy+i*ROW_H2+ROW_H2*0.82,subW2,false);
      return sy+rows2*ROW_H2+6*DPR;
    }

    function drawSupportSection2(sx,sy,availW){
      const allSupport2=[];
      for(const comp of DMG.COMPS){
        for(const m of (d.crew[comp]||[])) if(SUPPORT_DEPTS2.has(m.dept)) allSupport2.push(m);
      }
      if(allSupport2.length===0) return sy;
      const fitC2=allSupport2.filter(c=>c.status==='fit').length;
      const wndC2=allSupport2.filter(c=>c.status==='wounded').length;
      const kiaC2=allSupport2.filter(c=>c.status==='killed').length;
      ctx.fillStyle='rgba(20,38,70,0.60)';
      ctx.beginPath(); ctx.roundRect(sx,sy,availW,SEC_HDR2,2*DPR); ctx.fill();
      ctx.fillStyle='rgba(180,210,255,0.90)'; ctx.font=`bold ${11*DPR}px ui-monospace,monospace`; ctx.textAlign='left';
      ctx.fillText('SHIP SUPPORT',sx+6*DPR,sy+SEC_HDR2*0.72);
      ctx.font=`${10*DPR}px ui-monospace,monospace`; ctx.textAlign='right';
      const sumStr2=kiaC2>0?`${fitC2} fit  ${wndC2} wnd  ${kiaC2} kia`:`${fitC2}/${allSupport2.length} fit`;
      ctx.fillStyle=kiaC2>0?'rgba(210,60,60,0.85)':wndC2>0?'rgba(220,160,30,0.80)':'rgba(80,190,100,0.70)';
      ctx.fillText(sumStr2,sx+availW-6*DPR,sy+SEC_HDR2*0.72); sy+=SEC_HDR2+2*DPR;
      for(const dept of ['medical','supply']){
        const crew2=allSupport2.filter(m=>m.dept===dept);
        if(crew2.length===0) continue;
        ctx.fillStyle='rgba(100,130,180,0.50)'; ctx.font=`bold ${8*DPR}px ui-monospace,monospace`; ctx.textAlign='left';
        ctx.fillText(dept==='medical'?'MEDICAL':'SUPPLY / CATERING',sx+6*DPR,sy+8*DPR); sy+=11*DPR;
        const dutyList2=crew2.filter(m=>m.watch==='duty');
        const watchB2=crew2.filter(m=>m.watch==='B'), watchA2=crew2.filter(m=>m.watch==='A');
        const subW2=(availW-4*DPR)/2;
        for(let i=0;i<dutyList2.length;i++){
          ctx.fillStyle='rgba(140,110,10,0.12)'; ctx.fillRect(sx,sy+i*ROW_H2,availW,ROW_H2-1);
          drawCrewRow2(dutyList2[i],sx,sy+i*ROW_H2+ROW_H2*0.82,availW,true);
        }
        if(dutyList2.length) sy+=dutyList2.length*ROW_H2+2*DPR;
        const rows2=Math.max(watchB2.length,watchA2.length);
        for(let i=0;i<watchB2.length;i++) drawCrewRow2(watchB2[i],sx,sy+i*ROW_H2+ROW_H2*0.82,subW2,false);
        for(let i=0;i<watchA2.length;i++) drawCrewRow2(watchA2[i],sx+subW2+4*DPR,sy+i*ROW_H2+ROW_H2*0.82,subW2,false);
        sy+=rows2*ROW_H2+4*DPR;
      }
      return sy+4*DPR;
    }

    let lcy=ry2;
    for(const comp of leftComps2){ lcy=drawCompSection2(comp,col0x2,lcy,colW2); lcy+=4*DPR; }
    let rcy2=ry2;
    for(const comp of rightComps2){ rcy2=drawCompSection2(comp,col1x2,rcy2,colW2); rcy2+=4*DPR; }
    drawSupportSection2(col1x2,rcy2,colW2);

    // Hover tooltip
    for(const h of _hoverHits2){
      if(mx2>=h.x&&mx2<=h.x+h.w&&my2>=h.y&&my2<=h.y+h.h){
        const tip=h.tip;
        ctx.font=`${11*DPR}px ui-monospace,monospace`;
        const tw=ctx.measureText(tip).width+12*DPR, th=16*DPR;
        let tx2=mx2+10*DPR, ty2=my2-4*DPR;
        if(tx2+tw>W) tx2=mx2-tw-4*DPR;
        if(ty2+th>H) ty2=my2-th-4*DPR;
        ctx.fillStyle='rgba(5,12,30,0.94)'; ctx.strokeStyle='rgba(80,140,220,0.55)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.roundRect(tx2,ty2,tw,th,3*DPR); ctx.fill(); ctx.stroke();
        ctx.fillStyle='rgba(200,220,255,0.95)'; ctx.textAlign='left';
        ctx.fillText(tip,tx2+6*DPR,ty2+th*0.72); break;
      }
    }
  }

  window.RPANEL = {drawStartScreen, drawLogPanel, drawDcPanel, drawDamagePanel, drawCrewPanel, drawDamageScreen, drawPanel};
})();
