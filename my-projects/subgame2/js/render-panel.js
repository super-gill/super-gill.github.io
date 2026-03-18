// render-panel.js — start screen, log panel, damage control panel, command panel
// Exposes window.RPANEL: { drawStartScreen, drawLogPanel, drawDcPanel, drawDamagePanel, drawPanel, drawEndScreen }
// Requires window.R (render-utils.js) to be loaded first.
(() => {
  'use strict';
  const C = window.CONFIG;
  const {clamp, lerp} = window.M;
  const {ctx, player, game, bullets, sonarContacts, setMsg} = window.G;
  const AI = window.AI;
  const {doodleLine, doodleCircle, doodleText, w2s, wScale, PANEL_H, STRIP_W, U} = window.R;
  const TH = window.THEME;

  function drawStartScreen(W,H){
    const PANEL=window.PANEL;
    const game=window.G.game;
    PANEL.clearBtns();

    // Deep ocean background (always)
    const grad=ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,'#0a1628');
    grad.addColorStop(1,'#05101e');
    ctx.fillStyle=grad;
    ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(30,80,120,0.12)';
    ctx.lineWidth=1;
    const gs=U(60);
    for(let x=0;x<W;x+=gs){ ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke(); }
    for(let y=0;y<H;y+=gs){ ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke(); }

    // ── Vessel silhouette renderer (shared) ──────────────────────────────────
    const t0=performance.now()*0.0003;
    function drawVesselSilhouette(key,cW,cH,sel){
      const shapes={
        '688i':     {ax:0.84,bR:1.00,ss:0.82,sf:0.32,sW:0.080,sH:1.80,hw:1.00,rk:true, bp:true, st:'screw'},
        'trafalgar':{ax:0.78,bR:1.10,ss:0.80,sf:0.33,sW:0.090,sH:1.65,hw:1.00,rk:true, bp:true, st:'pumpjet'},
        'swiftsure':{ax:0.73,bR:1.15,ss:0.78,sf:0.35,sW:0.100,sH:1.90,hw:1.00,rk:false,bp:true, st:'pumpjet'},
        'seawolf':  {ax:0.67,bR:1.42,ss:0.85,sf:0.31,sW:0.115,sH:1.55,hw:1.30,rk:true, bp:false,st:'screw'},
        'type209':  {ax:0.56,bR:0.82,ss:0.76,sf:0.43,sW:0.070,sH:1.25,hw:0.75,rk:false,bp:false,st:'screw'},
      };
      const sp=shapes[key]||shapes['688i'];
      const al=sel?0.90:0.20; const lw=sel?2.2:1.0;
      const L=cW*0.46*sp.ax; const Hw=L*0.15*sp.hw;
      if(sel){ctx.shadowColor='rgba(100,200,255,0.55)';ctx.shadowBlur=U(12);}
      const bowCapX=-L+Hw*sp.bR; const sternTaperX=L*sp.ss; const pts=40;
      ctx.strokeStyle=sel?`rgba(180,230,255,${al})`:`rgba(100,160,220,${al})`; ctx.lineWidth=lw;
      ctx.beginPath();
      for(let i=0;i<=20;i++){const a=Math.PI/2+i/20*Math.PI;const bx=bowCapX+Math.cos(a)*Hw*sp.bR;const by=Math.sin(a)*Hw;const w=Math.sin(i*2.1+t0)*0.3;if(i===0)ctx.moveTo(bx,by+w);else ctx.lineTo(bx,by+w);}
      for(let i=0;i<=pts;i++){const t=i/pts;const x=bowCapX+t*(sternTaperX-bowCapX+L);let b=1;if(x>sternTaperX)b=Math.pow((L-x)/(L-sternTaperX),0.6);ctx.lineTo(x,-Hw*b+Math.sin(t*22+t0)*0.3);}
      for(let i=pts;i>=0;i--){const t=i/pts;const x=bowCapX+t*(sternTaperX-bowCapX+L);let b=1;if(x>sternTaperX)b=Math.pow((L-x)/(L-sternTaperX),0.6);ctx.lineTo(x,Hw*b+Math.sin(t*22+t0+0.5)*0.3);}
      ctx.closePath();ctx.stroke();
      const sailCX=-L+sp.sf*2*L;const sW2=sp.sW*2*L;const sH=Hw*sp.sH;const sailTop=-Hw-sH*0.6;const sailBase=-Hw*0.95;
      ctx.strokeStyle=sel?`rgba(160,220,255,${al*0.85})`:`rgba(80,130,180,${al})`;ctx.lineWidth=lw*0.85;
      ctx.beginPath();ctx.moveTo(sailCX-sW2*0.5,sailBase);ctx.lineTo(sailCX-sW2*0.5,sailTop);ctx.lineTo(sailCX+sW2*0.5,sailTop);ctx.lineTo(sailCX+(sp.rk?sW2*0.72:sW2*0.5),sailBase);ctx.stroke();
      ctx.strokeStyle=sel?`rgba(140,200,240,${al*0.40})`:`rgba(60,110,160,${al*0.45})`;ctx.lineWidth=lw*0.5;
      ctx.beginPath();ctx.moveTo(sailCX-sW2*0.1,sailTop);ctx.lineTo(sailCX-sW2*0.1,sailTop-Hw*0.55);ctx.moveTo(sailCX+sW2*0.1,sailTop);ctx.lineTo(sailCX+sW2*0.1,sailTop-Hw*0.38);ctx.stroke();
      if(sp.bp){const bpX=-L*0.69;ctx.strokeStyle=sel?`rgba(140,200,240,${al*0.65})`:`rgba(70,110,160,${al*0.70})`;ctx.lineWidth=lw*0.70;ctx.beginPath();ctx.moveTo(bpX,-Hw*0.14);ctx.lineTo(bpX-L*0.027,-Hw*0.88);ctx.moveTo(bpX,Hw*0.14);ctx.lineTo(bpX-L*0.027,Hw*0.88);ctx.stroke();}
      const sternX=L*0.91;ctx.lineWidth=lw*0.75;
      if(sp.st==='pumpjet'){ctx.strokeStyle=sel?`rgba(140,200,240,${al*0.60})`:`rgba(70,110,160,${al*0.60})`;ctx.beginPath();ctx.ellipse(sternX+L*0.022,0,L*0.022,Hw*0.72,0,0,Math.PI*2);ctx.stroke();ctx.strokeStyle=sel?`rgba(140,200,240,${al*0.28})`:`rgba(70,110,160,${al*0.28})`;ctx.beginPath();ctx.ellipse(sternX+L*0.022,0,L*0.010,Hw*0.35,0,0,Math.PI*2);ctx.stroke();ctx.strokeStyle=sel?`rgba(140,200,240,${al*0.50})`:`rgba(70,110,160,${al*0.55})`;ctx.lineWidth=lw*0.75;ctx.beginPath();ctx.moveTo(sternX-L*0.04,-Hw*0.18);ctx.lineTo(sternX,-Hw*1.08);ctx.moveTo(sternX-L*0.04,Hw*0.18);ctx.lineTo(sternX,Hw*1.08);ctx.stroke();}
      else{ctx.strokeStyle=sel?`rgba(120,180,220,${al*0.42})`:`rgba(60,100,150,${al*0.48})`;ctx.beginPath();ctx.arc(sternX+L*0.038,0,Hw*0.52,0,Math.PI*2);ctx.stroke();ctx.strokeStyle=sel?`rgba(140,200,240,${al*0.50})`:`rgba(70,110,160,${al*0.55})`;ctx.lineWidth=lw*0.75;ctx.beginPath();ctx.moveTo(sternX,-Hw*0.18);ctx.lineTo(sternX+L*0.033,-Hw*1.12);ctx.moveTo(sternX,Hw*0.18);ctx.lineTo(sternX+L*0.033,Hw*1.12);ctx.stroke();}
      ctx.shadowBlur=0;
    }

    // ── Soviet unit reference data ────────────────────────────────────────────
    const sovietUnits=[
      {name:'VICTOR III',  soviet:'PROJECT 671RTM SHCHUKA',   role:'SSN',  colour:'rgba(130,30,30,0.88)',  accent:'rgba(255,100,80,0.90)',  lore:['Third-generation Soviet SSN. 26 built between 1978 and 1992.','Primary role: area denial via relentless active sonar pinging.','Capable sensors — will not stop hunting once it has your bearing.','Armed with Type 53 torpedoes. Counter-fires quickly when threatened.']},
      {name:'ALFA',        soviet:'PROJECT 705 LIRA',         role:'SSN',  colour:'rgba(150,50,20,0.88)',  accent:'rgba(255,140,60,0.90)',  lore:['Fastest submarine ever built. 44 knots. Liquid metal reactor.','Titanium hull. Can exceed 700m depth. Designed to outrun torpedoes.','Crew of 31 — highly automated. Built to sprint away from incoming weapons.','Very loud at speed. Detectable at range. It simply does not care.']},
      {name:'SIERRA',      soviet:'PROJECT 945 BARRAKUDA',    role:'SSN',  colour:'rgba(120,50,20,0.88)',  accent:'rgba(255,160,80,0.90)',  lore:['Titanium hull. Extreme depth capability — deeper than any NATO SSN.','Quiet enough to approach undetected. Dangerous at all engagement ranges.','Only 4 built — titanium construction was prohibitively expensive and slow.','Carries both heavyweight torpedoes and cruise missiles. Versatile threat.']},
      {name:'AKULA',       soviet:'PROJECT 971 SHCHUKA-B',    role:'SSN',  colour:'rgba(160,20,20,0.88)',  accent:'rgba(255,60,60,0.90)',   lore:['Near-NATO acoustic performance. Alarmed Western intelligence at first contact.','Aggressive hunting doctrine. Uses tactical active sonar. Will not wait for you.','Excellent sensors, long endurance, and a heavy torpedo magazine.','Designated ZETA in this simulation. The most dangerous unit you will encounter.']},
      {name:'NOVEMBER',    soviet:'PROJECT 627 KIT',          role:'SSN',  colour:'rgba(80,40,10,0.88)',   accent:'rgba(200,140,60,0.90)',  lore:['First Soviet nuclear submarine. Rushed into service — reliability suffered badly.','Nicknamed "widow maker" by its own crews. Reactor accidents were not uncommon.','Extremely loud — passive sonar will detect it long before it can close to fire.','Do not let it get close. Its torpedoes are as lethal as any modern boat\'s.']},
      {name:'FOXTROT',     soviet:'PROJECT 641',              role:'SSK',  colour:'rgba(40,80,20,0.88)',   accent:'rgba(120,200,80,0.90)',  lore:['Cold War workhorse. 58 built and widely exported across multiple navies.','Battery-quiet — nearly inaudible at low speed on electric drive alone.','Shallow maximum depth. Must snorkel to charge batteries every 24 hours.','That snorkel window is your opportunity. Find it, hold the bearing, and fire.']},
      {name:'KILO',        soviet:'PROJECT 636 VARSHAVYANKA', role:'SSK',  colour:'rgba(20,80,50,0.88)',   accent:'rgba(60,200,120,0.90)',  lore:['"The Black Hole" — NATO\'s name for the improved Kilo class acoustic signature.','Anechoic tiles and refined electric drive approach Western acoustic standards.','Modern sensors. Will track you passively at range and fire without any warning.','AIP variants can remain submerged for weeks. Patience is their primary weapon.']},
      {name:'WHISKEY',     soviet:'PROJECT 613',              role:'SSK',  colour:'rgba(40,60,20,0.88)',   accent:'rgba(100,170,60,0.90)',  lore:['215 built — the most-produced Soviet submarine design. Ubiquitous and expendable.','WWII-derived pressure hull. Very shallow depth limit. Old sonar equipment throughout.','Near-silent on battery at low speed. An ambush predator that depends on position.','Obsolete individually — dangerous in groups. Commonly encountered on patrol in pairs.']},
      {name:'OSCAR II',    soviet:'PROJECT 949A ANTEI',       role:'SSGN', colour:'rgba(80,20,100,0.88)',  accent:'rgba(180,80,255,0.90)',  lore:['24 P-700 GRANIT cruise missiles. Designed specifically to kill carrier battle groups.','Massive double hull — very difficult to sink with a single torpedo hit.','Loud reactor plant makes it detectable at range. Its missiles are fired from far away.','Mission: survive long enough to fire. Your mission: stop it before it does.']},
      {name:'TYPHOON',     soviet:'PROJECT 941 AKULA',        role:'SSBN', colour:'rgba(100,20,120,0.88)', accent:'rgba(200,100,255,0.90)', lore:['Largest submarine ever built. 48,000 tonnes submerged. 175 metres long.','20 R-39 ballistic missiles — 10 independently targeted warheads each. 200 warheads.','Operates under Arctic ice in hardened bastions. Approaches are extremely hazardous.','Sink it before it reaches its firing position. Nothing else matters in this engagement.']},
      {name:'DELTA IV',    soviet:'PROJECT 667BDRM DELFIN',   role:'SSBN', colour:'rgba(80,20,100,0.88)',  accent:'rgba(160,80,220,0.90)',  lore:['16 R-29RM missiles with 8,300km range — can fire from Soviet home waters entirely.','Quieter than earlier Delta variants. Prefers deep protected bastion patrol areas.','Heavily escorted on every patrol. Expect SSN screening and surface ship coordination.','Still in active frontline service in the 2020s. The most enduring Soviet SSBN design.']},
      {name:'UDALOY',      soviet:'PROJECT 1155 FREGAT',      role:'DDG',  colour:'rgba(20,60,120,0.88)',  accent:'rgba(80,160,255,0.90)',  lore:['Primary Soviet ASW destroyer. Hull sonar plus towed VDS covers all depth bands.','Two Ka-27 HELIX helicopters extend the search area with dipping sonar capability.','ASROC-equivalent rocket torpedoes. Will classify and engage targets without warning.','The group\'s ASW coordinator. Sinking it first significantly degrades group effectiveness.']},
      {name:'KRIVAK',      soviet:'PROJECT 1135 BUREVESTNIK', role:'FFG',  colour:'rgba(20,50,100,0.88)',  accent:'rgba(60,140,220,0.90)',  lore:['Purpose-built ASW frigate. Capable hull sonar and variable-depth sonar suite.','SS-N-14 SILEX rocket torpedo — the first Soviet equivalent of ASROC. Long reach.','Fast and aggressive. 32 knots. Will sprint to the last known datum and drop weapons.','Less capable than Udaloy but more numerous. Commonly encountered in coordinated pairs.']},
      {name:'GRISHA',      soviet:'PROJECT 1124 ALBATROS',    role:'FSG',  colour:'rgba(20,40,80,0.88)',   accent:'rgba(60,120,200,0.90)',  lore:['Small ASW corvette. Fast, nimble, and deployed in large numbers for patrol duties.','Basic hull sonar only — limited detection capability below the thermal layer.','Dipping sonar can partially compensate. Do not assume the layer makes you invisible.','The outer escort screen of any group. Pick them off first or manoeuvre wide around them.']},
      {name:'SLAVA',       soviet:'PROJECT 1164 ATLANT',      role:'CG',   colour:'rgba(30,30,80,0.88)',   accent:'rgba(80,80,200,0.90)',   lore:['Guided missile cruiser. Primary role: anti-surface warfare. 16 P-1000 VULCAN missiles.','ASW is a secondary capability. Sonar fit is basic by surface combatant standards.','Heavy and slow to manoeuvre. Its missiles, however, have exceptional stand-off range.','The real threat: its CIWS and deck guns will engage anything that surfaces within range.']},
    ];

    // ── VESSEL SELECT SCREEN ─────────────────────────────────────────────────
    if((game.startPhase||'scenario')==='vessel'){
      const scenTitles={waves:'WOLFPACK HUNT',duel:'1V1 DUEL',ambush:'AMBUSH',patrol:'BARRIER TRANSIT',ssbn_hunt:'SSBN HUNT',boss_fight:'BOSS FIGHT',asw_taskforce:'ASW TASKFORCE',free_run:'FREE RUN'};
      const selScenTitle=scenTitles[game.scenario]||'SELECT SCENARIO';
      const tab=game.vesselTab||'player';
      const presets=window.CONFIG.playerPresets||[];
      const selKey=game.vesselKey||'688i';
      const selPreset=presets.find(p=>p.key===selKey)||presets[0];

      // Header bar
      const hdrH=U(54);
      ctx.fillStyle='rgba(8,18,36,0.96)';
      ctx.fillRect(0,0,W,hdrH);
      ctx.strokeStyle='rgba(40,90,160,0.30)';
      ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(0,hdrH);ctx.lineTo(W,hdrH);ctx.stroke();

      const backW=U(150),backH=U(36),backX=U(20),backY=(hdrH-backH)/2;
      ctx.fillStyle='rgba(18,48,90,0.75)';ctx.strokeStyle='rgba(60,120,200,0.45)';ctx.lineWidth=1;
      ctx.beginPath();ctx.roundRect(backX,backY,backW,backH,U(4));ctx.fill();ctx.stroke();
      ctx.fillStyle='rgba(120,180,240,0.85)';ctx.font=`${U(13)}px ui-monospace,monospace`;ctx.textAlign='center';
      ctx.fillText('← SCENARIO',backX+backW/2,backY+backH*0.68);
      window.PANEL?.btn2(ctx,'',backX,backY,backW,backH,'transparent',()=>{ game.startPhase='scenario'; game.vesselScrollY=0; });

      ctx.fillStyle='rgba(140,190,235,0.55)';ctx.font=`${U(13)}px ui-monospace,monospace`;ctx.textAlign='center';
      ctx.letterSpacing='2px';ctx.fillText(selScenTitle+'  ·  SELECT YOUR VESSEL',W/2,hdrH*0.62);ctx.letterSpacing='0px';

      const diveW=U(190),diveH=U(36),diveX=W-diveW-U(20),diveY=(hdrH-diveH)/2;
      ctx.fillStyle='rgba(22,90,150,0.90)';ctx.strokeStyle='rgba(80,180,255,0.70)';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.roundRect(diveX,diveY,diveW,diveH,U(4));ctx.fill();ctx.stroke();
      ctx.fillStyle='#ffffff';ctx.font=`bold ${U(13)}px ui-monospace,monospace`;ctx.textAlign='center';
      ctx.fillText('DIVE — BEGIN MISSION',diveX+diveW/2,diveY+diveH*0.68);
      window.PANEL?.btn2(ctx,'',diveX,diveY,diveW,diveH,'transparent',()=>{
        const vk=game.vesselKey||'688i';const prs=window.CONFIG.playerPresets||[];
        window.CONFIG.player=prs.find(p=>p.key===vk)||prs[0]||window.CONFIG.player;
        game.started=true;game.scenario=game.scenario||'waves';window.SIM.resetScenario(game.scenario);
      });

      // Tab bar
      const tabBarY=hdrH+U(8);const tabH=U(36);
      const tabTotalW=U(560);let tabX=(W-tabTotalW)/2;const tabBtnW=tabTotalW/2;
      for(const tb of [{id:'player',label:'PLAYER VESSELS'},{id:'soviet',label:'SOVIET ORDER OF BATTLE'}]){
        const sel=tab===tb.id;
        ctx.fillStyle=sel?'rgba(25,75,155,0.88)':'rgba(8,22,48,0.65)';
        ctx.strokeStyle=sel?'rgba(80,160,255,0.65)':'rgba(30,70,130,0.30)';ctx.lineWidth=sel?1.5:1;
        ctx.beginPath();ctx.roundRect(tabX,tabBarY,tabBtnW-U(6),tabH,U(4));ctx.fill();ctx.stroke();
        ctx.fillStyle=sel?'rgba(200,230,255,0.95)':'rgba(100,150,200,0.45)';
        ctx.font=`${sel?'bold ':' '}${U(13)}px ui-monospace,monospace`;ctx.textAlign='center';
        ctx.fillText(tb.label,tabX+tabBtnW/2-U(3),tabBarY+tabH*0.65);
        const _tb=tb;
        window.PANEL?.btn2(ctx,'',tabX,tabBarY,tabBtnW-U(6),tabH,'transparent',()=>{ game.vesselTab=_tb.id; game.vesselScrollY=0; });
        tabX+=tabBtnW;
      }

      const contentY=tabBarY+tabH+U(10);
      const contentH=H-contentY;

      // ── PLAYER VESSELS TAB ─────────────────────────────────────────────────
      if(tab==='player'){
        const n=presets.length;
        const cellH=U(180);
        const totalW=Math.min(W*0.96,U(1600));
        const cellW=Math.floor(totalW/n);
        const rowX=(W-cellW*n)/2;
        for(let i=0;i<n;i++){
          const p=presets[i];const sel=p.key===selKey;
          const cx=rowX+i*cellW+cellW/2;const cy=contentY+cellH*0.42;
          ctx.save();ctx.translate(cx,cy);drawVesselSilhouette(p.key,cellW,cellH,sel);ctx.restore();
          ctx.textAlign='center';
          ctx.fillStyle=sel?'rgba(180,225,255,0.92)':'rgba(100,150,200,0.28)';
          ctx.font=`bold ${U(18)}px ui-monospace,monospace`;
          ctx.fillText(p.name,cx,contentY+cellH*0.73);
          ctx.fillStyle=sel?'rgba(120,180,240,0.62)':'rgba(80,120,170,0.18)';
          ctx.font=`${U(13)}px ui-monospace,monospace`;
          ctx.fillText(p.vesselClass,cx,contentY+cellH*0.87);
          const dc=p.difficulty==='easy'?'80,200,120':p.difficulty==='expert'?'255,120,80':'140,170,200';
          ctx.fillStyle=sel?`rgba(${dc},0.75)`:`rgba(${dc},0.20)`;
          ctx.font=`${U(12)}px ui-monospace,monospace`;
          ctx.fillText(`${p.nation} · ${p.difficulty.toUpperCase()}`,cx,contentY+cellH*0.97);
          const _p=p;
          window.PANEL?.btn2(ctx,'',rowX+i*cellW,contentY,cellW,cellH,'transparent',()=>{ game.vesselKey=_p.key; });
        }
        // Divider
        const divY=contentY+cellH+U(16);
        ctx.strokeStyle='rgba(40,90,160,0.22)';ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(W*0.08,divY);ctx.lineTo(W*0.92,divY);ctx.stroke();
        // Expanded lore
        if(selPreset?.lore){
          const loreY=divY+U(28);
          const loreW=Math.min(W*0.70,U(880));
          const loreX=(W-loreW)/2;
          selPreset.lore.forEach((line,li)=>{
            ctx.textAlign='left';
            ctx.fillStyle=li===0?'rgba(165,215,255,0.85)':'rgba(120,170,210,0.58)';
            ctx.font=`${li===0?`bold ${U(16)}`:`${U(15)}`}px ui-monospace,monospace`;
            ctx.fillText(line,loreX,loreY+li*U(26),loreW);
          });
        }
      }

      // ── SOVIET ORDER OF BATTLE TAB ─────────────────────────────────────────
      if(tab==='soviet'){
        const scGap=U(16);const scPad=U(16);
        const scMinW=U(360);const scMaxW=U(560);
        const scAvailW=W-U(80)*2;
        const scCols=Math.max(1,Math.min(sovietUnits.length,Math.floor((scAvailW+scGap)/(scMinW+scGap))));
        const scCardW=Math.min(scMaxW,Math.floor((scAvailW-scGap*(scCols-1))/scCols));
        const scCardH=U(210);
        const scRows=Math.ceil(sovietUnits.length/scCols);
        const scGridW=scCols*scCardW+(scCols-1)*scGap;
        const scGridX=Math.floor((W-scGridW)/2);
        const scTotalH=scRows*scCardH+(scRows-1)*scGap+U(16);
        game.vesselScrollY=Math.max(0,Math.min(game.vesselScrollY||0,Math.max(0,scTotalH-contentH+U(10))));
        const svScrollY=game.vesselScrollY||0;
        ctx.save();ctx.beginPath();ctx.rect(0,contentY,W,contentH);ctx.clip();
        ctx.translate(0,-svScrollY);
        for(let i=0;i<sovietUnits.length;i++){
          const su=sovietUnits[i];
          const col=i%scCols;const row=Math.floor(i/scCols);
          const cx=scGridX+col*(scCardW+scGap);
          const cy=contentY+row*(scCardH+scGap)+U(8);
          ctx.fillStyle='rgba(7,16,32,0.82)';
          ctx.strokeStyle=su.accent.replace('0.90','0.28');ctx.lineWidth=1;
          ctx.beginPath();ctx.roundRect(cx,cy,scCardW,scCardH,U(6));ctx.fill();ctx.stroke();
          // Role pill
          ctx.fillStyle=su.colour;ctx.font=`bold ${U(13)}px ui-monospace,monospace`;ctx.textAlign='left';
          const rpW=ctx.measureText(su.role).width+U(14);
          ctx.beginPath();ctx.roundRect(cx+scPad,cy+scPad,rpW,U(22),U(3));ctx.fill();
          ctx.fillStyle='rgba(255,255,255,0.92)';ctx.fillText(su.role,cx+scPad+U(7),cy+scPad+U(15));
          // Name
          ctx.fillStyle=su.accent;ctx.font=`bold ${U(22)}px ui-monospace,monospace`;
          ctx.fillText(su.name,cx+scPad,cy+U(62));
          // Soviet designation
          ctx.fillStyle='rgba(110,155,195,0.55)';ctx.font=`${U(13)}px ui-monospace,monospace`;
          ctx.fillText(su.soviet,cx+scPad,cy+U(80));
          // Lore lines
          ctx.fillStyle='rgba(140,185,215,0.72)';ctx.font=`${U(14)}px ui-monospace,monospace`;
          for(let li=0;li<su.lore.length;li++) ctx.fillText(su.lore[li],cx+scPad,cy+U(100)+li*U(26),scCardW-scPad*2);
        }
        ctx.restore();
        // Scroll indicator
        if(scTotalH>contentH){
          const maxSv=scTotalH-contentH+U(10);
          const trkH=contentH*0.80,trkY=contentY+contentH*0.10;
          const tmbH=Math.max(U(20),trkH*(contentH/scTotalH));
          const tmbY=trkY+svScrollY/maxSv*(trkH-tmbH);
          ctx.fillStyle='rgba(40,80,140,0.20)';ctx.beginPath();ctx.roundRect(W-U(8),trkY,U(4),trkH,U(2));ctx.fill();
          ctx.fillStyle='rgba(80,150,220,0.55)';ctx.beginPath();ctx.roundRect(W-U(8),tmbY,U(4),tmbH,U(2));ctx.fill();
        }
      }
      return;
    }

    // ── SCENARIO SELECT SCREEN ───────────────────────────────────────────────
    ctx.textAlign='center';
    ctx.fillStyle='rgba(200,225,255,0.97)';
    ctx.font=`bold ${U(72)}px ui-monospace,monospace`;
    ctx.fillText('STEADY BUBBLE',W/2,H*0.14);
    ctx.fillStyle='rgba(100,160,220,0.50)';
    ctx.font=`${U(18)}px ui-monospace,monospace`;
    ctx.letterSpacing='4px';
    ctx.fillText('COLD WAR SUBMARINE TACTICS  ▸  CHOOSE SCENARIO',W/2,H*0.14+U(44));
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
        id:'ssbn_hunt',
        title:'SSBN HUNT',
        sub:'Kill the boomer',
        lines:[
          'Intelligence locates a Typhoon-class',
          'SSBN on bastion patrol. One escort',
          'SSN screens the approach. Find the',
          'boomer, evade the escort, and sink it.',
        ],
        colour:'rgba(80,20,100,0.90)',
        accent:'rgba(200,120,255,0.85)',
        tag:'STRIKE MISSION',
      },
      {
        id:'boss_fight',
        title:'BOSS FIGHT',
        sub:'Destroy the Zeta',
        lines:[
          'A new enemy submarine has put to sea.',
          'Designate: Akula-class. Extremely quiet,',
          'highly capable, and dangerous. You are',
          'sent to find and destroy it.',
        ],
        colour:'rgba(120,10,10,0.90)',
        accent:'rgba(255,60,60,0.85)',
        tag:'SINGLE TARGET',
      },
      {
        id:'asw_taskforce',
        title:'ASW TASKFORCE',
        sub:'Hunted by surface ships',
        lines:[
          'An anti-submarine warfare group has',
          'your datum. Destroyer, two frigates,',
          'corvette — all pinging. Go deep, use',
          'the layer, and pick them off.',
        ],
        colour:'rgba(20,60,100,0.90)',
        accent:'rgba(60,160,255,0.85)',
        tag:'EVASION/COMBAT',
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

    // ── Scroll setup — scenario screen only ──────────────────────────────────
    {
      const _g=U(32),_sp=U(80),_mw=U(360);
      const _aw=W-_sp*2;
      const _cols=Math.max(1,Math.min(scenarios.length,Math.floor((_aw+_g)/(_mw+_g))));
      const _rows=Math.ceil(scenarios.length/_cols);
      const _gridY=H*0.18;
      const _btnY=_gridY+_rows*U(240)+(_rows-1)*_g+U(44);
      const _totalH=_btnY+U(104)+U(60);
      game.startScrollY=Math.max(0,Math.min(game.startScrollY||0,Math.max(0,_totalH-H)));
    }
    const scrollY=game.startScrollY||0;
    ctx.save();
    ctx.beginPath(); ctx.rect(0,0,W,H); ctx.clip();
    ctx.translate(0,-scrollY);

    // Responsive grid — cards wrap to fit viewport
    const gap=U(32);
    const sidePad=U(80);
    const minCardW=U(360);
    const maxCardW=U(560);
    const availW=W-sidePad*2;
    const cols=Math.max(1, Math.min(scenarios.length, Math.floor((availW+gap)/(minCardW+gap))));
    const cardW=Math.min(maxCardW, Math.floor((availW-gap*(cols-1))/cols));
    const cardH=U(240);
    const rows=Math.ceil(scenarios.length/cols);
    const gridW=cols*cardW+(cols-1)*gap;
    const gridX=Math.floor((W-gridW)/2);
    const gridY=H*0.18;
    const pad=U(14);

    for(let i=0;i<scenarios.length;i++){
      const s=scenarios[i];
      const col=i%cols;
      const row=Math.floor(i/cols);
      const cx=gridX+col*(cardW+gap);
      const cy=gridY+row*(cardH+gap);
      const selected=game.scenario===s.id;

      // Card background
      ctx.fillStyle=selected?s.colour.replace('0.90','1.0'):'rgba(8,20,35,0.80)';
      ctx.strokeStyle=selected?s.accent:'rgba(30,80,120,0.35)';
      ctx.lineWidth=selected?2:1;
      ctx.beginPath(); ctx.roundRect(cx,cy,cardW,cardH,U(8)); ctx.fill(); ctx.stroke();

      // Selection glow
      if(selected){
        ctx.shadowColor=s.accent;
        ctx.shadowBlur=U(18);
        ctx.strokeStyle=s.accent;
        ctx.lineWidth=2;
        ctx.beginPath(); ctx.roundRect(cx,cy,cardW,cardH,U(8)); ctx.stroke();
        ctx.shadowBlur=0;
      }

      // Tag pill
      ctx.fillStyle=selected?s.accent:'rgba(30,80,120,0.55)';
      ctx.font=`bold ${U(12)}px ui-monospace,monospace`;
      ctx.textAlign='left';
      const tagW=ctx.measureText(s.tag).width+U(14);
      ctx.beginPath(); ctx.roundRect(cx+pad,cy+pad,tagW,U(22),U(4)); ctx.fill();
      ctx.fillStyle=selected?'rgba(0,0,0,0.80)':'rgba(180,220,255,0.80)';
      ctx.fillText(s.tag,cx+pad+U(7),cy+pad+U(16));

      // Title
      ctx.fillStyle=selected?'#ffffff':s.accent;
      ctx.font=`bold ${U(22)}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillText(s.title,cx+pad,cy+U(64));

      // Sub title
      ctx.fillStyle=selected?'rgba(255,255,255,0.65)':'rgba(120,180,220,0.60)';
      ctx.font=`${U(15)}px ui-monospace,monospace`;
      ctx.fillText(s.sub,cx+pad,cy+U(86));

      // Description lines
      ctx.fillStyle=selected?'rgba(255,255,255,0.80)':'rgba(140,180,210,0.70)';
      ctx.font=`${U(14)}px ui-monospace,monospace`;
      for(let li=0;li<s.lines.length;li++){
        ctx.fillText(s.lines[li],cx+pad,cy+U(108)+li*U(21));
      }

      // Click handler — select scenario
      const _s=s;
      window.PANEL?.btn2(ctx,'',cx,cy,cardW,cardH,'transparent',()=>{
        game.scenario=_s.id;
      });
    }

    // Launch button
    const btnW=U(520), btnH=U(104);
    const totalGridH=rows*cardH+(rows-1)*gap;
    const btnX=(W-btnW)/2, btnY=gridY+totalGridH+U(44);
    const selScen=scenarios.find(s=>s.id===game.scenario)||scenarios[0];
    ctx.fillStyle=selScen.colour.replace('0.90','1.0');
    ctx.strokeStyle=selScen.accent;
    ctx.lineWidth=2;
    ctx.beginPath(); ctx.roundRect(btnX,btnY,btnW,btnH,U(8)); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#ffffff';
    ctx.font=`bold ${U(34)}px ui-monospace,monospace`;
    ctx.textAlign='center';
    ctx.fillText('SELECT VESSEL  ›',W/2,btnY+btnH*0.65);

    window.PANEL?.btn2(ctx,'',btnX,btnY,btnW,btnH,'transparent',()=>{
      game.startPhase='vessel';
      game.startScrollY=0;
    });

    // Controls hint
    ctx.fillStyle='rgba(80,120,160,0.45)';
    ctx.font=`${U(20)}px ui-monospace,monospace`;
    ctx.textAlign='center';
    ctx.fillText('A/D SPEED  ·  W/S DEPTH  ·  SHIFT+CLICK FIRE  ·  R RESTART  ·  ` DEBUG', W/2, btnY+btnH+U(48));

    ctx.restore(); // end scroll translate
  }

  // ── Combined Log Panel (Ship Log + Sonar Raw Feed) with tabs ─────────────
  function drawLogPanel(W,H,panelH){
    const game=window.G.game;
    const msgLog=game.msgLog||[];
    const sonarLog=game.sonarLog||[];
    const tab=game.logTab||'log';
    const T_game=game.missionT||0;

    const inEscape = game.casualtyState==='escape' || game.escapeResolved;
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
        ctx.fillText(`${e.brgStr}°`, hx+colArray+colID, ry);

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
      const DMG=window.DMG;
      const dcLog=game.dcLog||[];
      const d=window.G.player?.damage;

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
            team.task==='drench_pending'?`N2 DRENCH — ${DMG.ROOMS[team.location]?.label||'?'} (${Math.ceil(_dT||0)}s)`:
            team.task==='vent_n2'?`VENT N2 — ${DMG.ROOMS[team.location]?.label||'?'} (${Math.ceil(team._ventT||0)}s)`:
            team.state==='mustering'?`MUSTER → ${DMG.SECTION_LABEL?.[team.destination]||'?'} (${Math.ceil(team.musterT||0)}s)`:
            team.state==='blowing'?`HP BLOW — ${DMG.ROOMS[team.location]?.label||'?'}`:
            team.state==='transit'?`→ ${DMG.SECTION_LABEL?.[team.destination]||'?'} (${Math.ceil(team.transitEta)}s)`:
            isReady?'AVAILABLE':
            team.task==='flood'?`FLOOD — ${DMG.ROOMS[team.location]?.label||'?'}`:
            team.task==='repair'?`REPAIR ${DMG.SYS_LABEL[team.repairTarget]||'?'} — ${DMG.ROOMS[team.location]?.label||'?'}`:
            `ON SCENE — ${DMG.ROOMS[team.location]?.label||'?'}`;
          ctx.fillText(loc,tx,sumY+U(25));
          if(team.state==='on_scene'&&team.task==='repair'){
            const job=window.G?.player?.damage?.repairJobs?.[DMG.roomSection(team.location)];
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
        if(txt!==entry.text) txt=txt.slice(0,-1)+'…';
        ctx.fillText(txt,bx+padX,ry);
      }
    }
  }

    // ── DC Comms Panel (J key) ──────────────────────────────────────────────
    function drawDcPanel(W,H,panelH){
      return; // absorbed into log panel DC tab — kept callable behind admin overlay
    }

    function drawDamagePanel(W,H,panelH){
    if(!game.showDmgPanel||game.showDamageScreen) return;
    const dmg=player.damage;
    if(!dmg) return;
    const DMG=window.DMG;
    const PNL=window.PANEL;

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
    const aw2=game.activeWatch||'A';
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
      const taskStr=team.state==='lost'?'— LOST':team.task==='drench_pending'?`N2 DRENCH — ${DMG.ROOMS[team.location]?.label||'?'} (${Math.ceil(_drenchT||0)}s)`:team.task==='vent_n2'?`VENT N2 — ${DMG.ROOMS[team.location]?.label||'?'} (${Math.ceil(team._ventT||0)}s)`:team.state==='mustering'?`MUSTER → ${DMG.SECTION_LABEL?.[team.destination]||'?'} (${Math.ceil(team.musterT||0)}s)`:team.state==='blowing'?`HP BLOW — ${DMG.ROOMS[team.location]?.label||'?'}`:team.state==='transit'?`→ ${DMG.SECTION_LABEL?.[team.destination]||'?'} (${Math.ceil(team.transitEta)}s)`:team.state==='on_scene'&&team.task==='fire'?`FIRE — ${DMG.ROOMS[team.location]?.label||'?'}`:team.state==='on_scene'&&team.task==='flood'?`FLOOD — ${DMG.ROOMS[team.location]?.label||'?'}`:team.state==='on_scene'&&team.task==='repair'?`REPAIR — ${DMG.SYS_LABEL[team.repairTarget]||'?'}`:team.state==='on_scene'?`STANDBY — ${DMG.ROOMS[team.location]?.label||'?'}`:'STANDBY';
      ctx.fillStyle='rgba(160,180,220,0.65)'; ctx.font=`${U(9)}px ui-monospace,monospace`;
      ctx.fillText(taskStr,tx,cy+U(26));
      // Progress bars
      if(team.state==='on_scene'&&team.task==='repair'&&team.repairTarget){
        const job=window.G?.player?.damage?.repairJobs?.[DMG.roomSection(team.location)];
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

    // ── Geometry ──────────────────────────────────────────────────────────────
    // Pressure hull — true pill, both ends rounded symmetrically
    const phTop = schY + U(44);
    const phBot = schY + U(114);
    const phMid = (phTop+phBot)*0.5;
    const phR   = (phBot-phTop)*0.5;           // half-height = end cap radius
    const phX0  = schX + phR + U(18);         // bow arc centre
    const phX1  = schX + schW - phR - U(18);  // stern arc centre
    const phSpan= phX1 - phX0;                 // interior span for compartments

    // Outer hull — slightly larger pill envelope
    const ohR   = phR + U(8);
    const ohTop = phMid - ohR;
    const ohBot = phMid + ohR;

    // Sail — centred over control room (comp 1), no periscopes
    const sailCX  = phX0 + phSpan*(0.21 + 0.105);
    const sailW   = U(44);
    const sailH   = U(22);
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
    ctx.strokeStyle='rgba(100,130,180,0.35)'; ctx.lineWidth=U(1.5);
    ctx.setLineDash([U(3),U(4)]); ctx.stroke(); ctx.setLineDash([]);

    // Sail — trapezoid, no periscopes
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

    // Horizontal stabiliser fins at stern
    const finX = phX1 + ohR*0.7;
    ctx.strokeStyle='rgba(110,140,190,0.40)'; ctx.lineWidth=U(1);
    ctx.beginPath(); ctx.moveTo(finX, ohTop+U(6)); ctx.lineTo(finX+U(16), ohTop+U(2)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(finX, ohBot-U(6)); ctx.lineTo(finX+U(16), ohBot-U(2)); ctx.stroke();

    // Propulsor screw at stern tip
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
      for(const s of sysList) worstIdx=Math.max(worstIdx,DMG.STATES.indexOf(DMG.effectiveState(s,dmg)));
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
        ctx.strokeStyle=`rgba(100,160,255,${0.35+flood*0.35})`; ctx.lineWidth=U(1.5);
        ctx.beginPath(); ctx.moveTo(fx, phBot-fH); ctx.lineTo(fx+fw, phBot-fH); ctx.stroke();
      }
      ctx.restore();
    }

    // ── Pressure hull pill border ─────────────────────────────────────────────
    pillPath();
    ctx.strokeStyle='rgba(80,120,180,0.50)'; ctx.lineWidth=U(1.5); ctx.stroke();

    // ── Compartment dividers ──────────────────────────────────────────────────
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

    // ── Per-compartment details ───────────────────────────────────────────────
    for(let ci=0;ci<6;ci++){
      const comp=compKeys[ci]; const cx2=compXs[ci]; const cw=compWs[ci];
      const flood=dmg.flooding[comp]||0;
      const isFlooded=dmg.flooded[comp];
      const sysList=DMG.activeSystems(comp);
      let worstIdx=0;
      for(const s of sysList) worstIdx=Math.max(worstIdx,DMG.STATES.indexOf(DMG.effectiveState(s,dmg)));
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
      const aw=game.activeWatch||'A';
      // Watchkeepers only — on-watch (active watch + duty), not support depts
      const wk=cc.filter(c=>(c.watch===aw||c.watch==='duty')&&c.dept!=='medical'&&c.dept!=='supply');
      const wkFit=wk.filter(c=>c.status==='fit'&&!c.displaced).length;
      const wkDisp=wk.filter(c=>c.displaced&&c.status!=='killed').length;
      const wkKia=wk.filter(c=>c.status==='killed').length;
      const wkTotal=wk.length-wkKia;
      const crewLabel=wkDisp>0?`${wkFit}+${wkDisp}d/${wkTotal}`:`${wkFit}/${wkTotal}`;
      ctx.fillStyle=wkKia>0?'rgba(220,80,80,0.85)':wkDisp>0?'rgba(200,170,50,0.80)':'rgba(90,190,110,0.75)';
      ctx.font=`${U(9)}px ui-monospace,monospace`;
      ctx.fillText(crewLabel, cMid, phBot-U(10));

      // Fire overlay — section max across all rooms
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
      // N2 drench overlay — teal fill rising with level
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
    // Buttons aligned to compartment columns (same grid as the schematic above).
    // Team label occupies the space left of phX0 (bow cap space).
    {
      const teamList=[dmg.teams?.alpha, dmg.teams?.bravo].filter(Boolean);
      const dispBtnH=U(22);
      const dispGap=U(3);
      const labelW=phX0-schX; // space between schX and first compartment column

      for(let ti=0;ti<teamList.length;ti++){
        const team=teamList[ti];
        const rowY=cy+ti*(dispBtnH+dispGap+U(2));

        // Team label pill — sits in bow-cap space to the left of compartment columns
        const isReady=team.state==='ready';
        const isMusteringEmerg=team._readyT>0;
        const isLocked=team._locked;
        const tLabelCol=team.state==='lost'?'rgba(180,30,30,0.80)':isMusteringEmerg?'rgba(170,100,0,0.80)':team.state==='mustering'?'rgba(160,110,15,0.75)':isReady?'rgba(80,80,90,0.70)':team.task==='flood'?'rgba(30,70,160,0.75)':'rgba(30,100,50,0.75)';
        ctx.fillStyle=tLabelCol; ctx.beginPath(); ctx.roundRect(schX,rowY,labelW-dispGap,dispBtnH,U(3)); ctx.fill();
        ctx.fillStyle='rgba(220,220,240,0.90)'; ctx.font=`bold ${U(9)}px ui-monospace,monospace`; ctx.textAlign='center';
        const pillTxt=isMusteringEmerg?`MSTR ${Math.ceil(team._readyT)}s`:isLocked?team.label.replace('DC ','')+' \u{1F512}':team.label.replace('DC ','');
        ctx.fillText(pillTxt,schX+(labelW-dispGap)/2,rowY+dispBtnH*0.68);

        // One button per compartment, X-aligned to schematic columns
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
            // Team at N2 panel — player can fire immediately
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
    PNL.btn2(ctx,escActive?'ESCAPING…':'TCE ESCAPE',OX+P,escY+U(4),halfEsc,U(18),
      escActive?'rgba(30,80,30,0.50)':tceViable?'rgba(20,60,20,0.70)':'rgba(60,60,60,0.30)',
      ()=>{ if(!escActive&&tceViable) DMG.initiateEscape('tce'); });
    PNL.btn2(ctx,escActive?'ESCAPING…':'RUSH ESCAPE',OX+P+halfEsc+U(6),escY+U(4),halfEsc,U(18),
      escActive?'rgba(80,30,30,0.50)':'rgba(100,30,10,0.70)',
      ()=>{ if(!escActive) DMG.initiateEscape('rush'); });
    const depthM=Math.round(player.depth||0);
    const depthAdv=depthM<=120?'TCE & RUSH viable':depthM<=200?'TCE marginal':'TCE not viable';
    const depthAdvCol=depthM<=120?'rgba(80,200,80,0.70)':depthM<=200?'rgba(220,170,20,0.80)':'rgba(220,80,50,0.80)';
    ctx.fillStyle=depthAdvCol; ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.textAlign='center';
    ctx.fillText(`${depthM}m — ${depthAdv}`,OX+OW/2,escY+U(30));

    // ── SEAL buttons ──────────────────────────────────────────────────────────
    const sealY=OY+OH-U(52);
    ctx.fillStyle='rgba(80,100,140,0.40)'; ctx.font=`${U(8)}px ui-monospace,monospace`; ctx.textAlign='left';
    ctx.fillText('SEAL (last resort — kills all crew inside):',OX+P,sealY);
    for(let ci=0;ci<6;ci++){
      const comp=compKeys[ci]; const cx2=compXs[ci]; const cw=compWs[ci];
      if(!dmg.flooded[comp]&&(dmg.flooding[comp]||0)>0.05){
        PNL.btn2(ctx,compLabels[ci].slice(0,3),cx2+2,sealY+U(4),cw-4,U(14),'rgba(100,30,30,0.60)',()=>DMG.sealFlooding(comp));
      }
    }

    // ── Debug hit buttons ─────────────────────────────────────────────────────
    if(game.debugOverlay){
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

  // ── Crew Manifest Panel ───────────────────────────────────────────────────────
  function drawCrewPanel(W,H,panelH){
    if(!game.showCrewPanel||game.showDamageScreen) return;
    const d=player.damage;
    if(!d) return;
    const DMG=window.DMG;
    const PNL=window.PANEL;

    const OW=U(820), OH=U(740);
    const OX=Math.round(W/2-OW/2), OY=Math.round(H/2-OH/2);
    const P=U(12);

    // Panel background
    ctx.fillStyle='rgba(6,12,22,0.97)';
    ctx.strokeStyle='rgba(60,100,160,0.40)';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.roundRect(OX,OY,OW,OH,U(6)); ctx.fill(); ctx.stroke();

    const activeWatch=game.activeWatch||'A';

    // Title bar
    let cy=OY+P+U(14);
    ctx.fillStyle='rgba(140,180,240,0.92)';
    ctx.font=`bold ${U(15)}px ui-monospace,monospace`;
    ctx.textAlign='left';
    ctx.fillText("SHIP'S COMPANY",OX+P,cy);
    ctx.fillStyle='rgba(100,130,180,0.55)';
    ctx.font=`${U(10)}px ui-monospace,monospace`;
    ctx.textAlign='right';
    ctx.fillText('[Y] close',OX+OW-P,cy);

    // ── Watch status row ──────────────────────────────────────────────────────
    cy+=U(20);
    const fatigue=game.watchFatigue||0;
    const changing=game.watchChanging||false;
    const changeT=game.watchChangeT||0;

    // Watch pill
    const watchLabel=changing?`WATCH ${activeWatch} → ${activeWatch==='A'?'B':'A'}`:`WATCH ${activeWatch} ON`;
    const watchBg=changing?'rgba(80,60,10,0.75)':activeWatch==='A'?'rgba(30,70,150,0.75)':'rgba(10,100,90,0.75)';
    const watchFg=changing?'rgba(255,200,60,0.95)':activeWatch==='A'?'rgba(140,190,255,0.95)':'rgba(80,220,200,0.95)';
    ctx.fillStyle=watchBg;
    ctx.beginPath(); ctx.roundRect(OX+P,cy-U(13),U(108),U(18),U(3)); ctx.fill();
    ctx.fillStyle=watchFg;
    ctx.font=`bold ${U(10)}px ui-monospace,monospace`;
    ctx.textAlign='center';
    ctx.fillText(watchLabel,OX+P+U(54),cy-U(1));

    // Fatigue bar (120px wide, sits right of watch pill)
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

    // Watch change countdown (shown during transition)
    if(changing){
      ctx.fillStyle='rgba(255,200,60,0.80)';
      ctx.font=`${U(9)}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillText(`RELIEVING — ${Math.ceil(changeT)}s`,barX+barW+U(8),cy-U(2));
    }

    // RELIEVE WATCH button (right side)
    const relBtnX=OX+OW-P-U(110);
    const canRelieve=!changing&&game.tacticalState!=='action'&&game.casualtyState!=='emergency';
    const relBg=canRelieve?'rgba(30,60,120,0.75)':'rgba(30,40,60,0.40)';
    const relFg=canRelieve?'rgba(140,190,255,0.90)':'rgba(80,100,130,0.50)';
    ctx.fillStyle=relBg;
    ctx.beginPath(); ctx.roundRect(relBtnX,cy-U(13),U(108),U(18),U(3)); ctx.fill();
    ctx.fillStyle=relFg;
    ctx.font=`bold ${U(9)}px ui-monospace,monospace`;
    ctx.textAlign='center';
    ctx.fillText(changing?'CHANGING…':'RELIEVE WATCH [W]',relBtnX+U(54),cy-U(1));
    if(canRelieve){
      PNL.btn2(ctx,'',relBtnX,cy-U(13),U(108),U(18),'transparent',
        ()=>{ window.SIM?.initiateWatchChange?.(); });
    }

    cy+=U(10);

    // Crew totals row
    const fit=DMG.totalFit(),wnd=DMG.totalWounded(),kia=DMG.totalKilled(),tot=DMG.totalCrew();
    ctx.font=`${U(12)}px ui-monospace,monospace`;
    ctx.textAlign='left';
    ctx.fillStyle='rgba(60,200,90,0.85)';   ctx.fillText(`FIT ${fit}`,  OX+P+U(112), cy-U(1));
    ctx.fillStyle='rgba(230,170,30,0.90)';  ctx.fillText(`WND ${wnd}`,  OX+P+U(184), cy-U(1));
    ctx.fillStyle='rgba(210,50,50,0.90)';   ctx.fillText(`KIA ${kia}`,  OX+P+U(256), cy-U(1));
    ctx.fillStyle='rgba(140,165,210,0.60)'; ctx.fillText(`/ ${tot}`,    OX+P+U(328), cy-U(1));
    cy+=U(8);

    // Divider
    ctx.strokeStyle='rgba(60,100,160,0.25)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(OX,cy); ctx.lineTo(OX+OW,cy); ctx.stroke();
    cy+=U(10);

    // ── Layout: 2 columns of compartment sections ─────────────────────────────
    const colW=(OW-P*2-U(10))/2;
    const col0x=OX+P, col1x=OX+P+colW+U(10);

    const COMP_LABELS={
      fore_ends:'TORPEDO ROOM', control_room:'CONTROL ROOM', aux_section:'AUX MACHINERY',
      reactor_comp:C.player.isDiesel?'ENGINE COMP':'REACTOR COMP',
      engine_room:C.player.isDiesel?'MOTOR ROOM':'MANEUVERING',
      aft_ends:'ENGINEERING',
    };
    // Support departments rendered in their own section, not mixed into compartments
    const SUPPORT_DEPTS=new Set(['medical','supply']);
    // Left col: fore_ends, control_room, aux_section, reactor_comp | Right col: engine_room, aft_ends
    const leftComps=['fore_ends','control_room','aux_section','reactor_comp'];
    const rightComps=['engine_room','aft_ends'];

    const ROW_H=U(16);
    const SEC_HDR=U(20);

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

      const pillW=U(32);
      const rowTop=ry-ROW_H*0.82;

      // Status dot
      ctx.fillStyle=STATUS_COL[m.status]||STATUS_COL.fit;
      ctx.beginPath(); ctx.arc(rx+U(5),ry-U(4),U(3.5),0,Math.PI*2); ctx.fill();

      // Rating pill
      ctx.fillStyle=isWnd?'rgba(200,140,20,0.70)':isKia?'rgba(140,20,20,0.50)':'rgba(30,55,100,0.65)';
      ctx.beginPath(); ctx.roundRect(rx+U(12),rowTop,pillW,ROW_H*0.85,U(2)); ctx.fill();
      ctx.fillStyle='rgba(200,220,255,0.90)';
      ctx.font=`bold ${U(9)}px ui-monospace,monospace`;
      ctx.textAlign='center';
      ctx.fillText(m.rating,rx+U(12)+pillW/2,ry-U(2));

      // Name
      ctx.fillStyle=isKia?'rgba(180,60,60,0.60)':isWnd?'rgba(220,165,30,0.90)':'rgba(200,215,245,0.90)';
      ctx.font=`${U(11)}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillText(`${m.firstName[0]}.${m.lastName}`,rx+U(48),ry-U(2));

      // Role short code (right-aligned before badges)
      const badgesW=isDuty?U(20):U(36); // duty: only watch badge; others: watch+dc
      const roleX=rx+subW-badgesW-U(4);
      ctx.fillStyle='rgba(120,170,220,0.70)';
      ctx.font=`${U(9)}px ui-monospace,monospace`;
      ctx.textAlign='right';
      ctx.fillText(m.role||'',roleX,ry-U(2));

      // Watch badge
      const badgeX=rx+subW-badgesW;
      const watchBadgeBg=m.watch==='duty'?'rgba(160,120,20,0.65)':m.watch==='A'?'rgba(25,55,130,0.65)':'rgba(10,90,80,0.65)';
      const watchBadgeFg=m.watch==='duty'?'rgba(255,210,60,0.95)':m.watch==='A'?'rgba(120,170,255,0.95)':'rgba(60,210,185,0.95)';
      const watchBadgeLabel=m.watch==='duty'?'★':m.watch;
      ctx.fillStyle=watchBadgeBg;
      ctx.beginPath(); ctx.roundRect(badgeX,rowTop,U(16),ROW_H*0.80,U(2)); ctx.fill();
      ctx.fillStyle=watchBadgeFg;
      ctx.font=`bold ${U(8)}px ui-monospace,monospace`;
      ctx.textAlign='center';
      ctx.fillText(watchBadgeLabel,badgeX+U(8),ry-U(2));

      // DC team badge
      if(m.dcTeam){
        const dcX=badgeX+U(18);
        const dcBg=m.dcTeam==='alpha'?'rgba(140,40,130,0.65)':'rgba(40,100,40,0.65)';
        const dcFg=m.dcTeam==='alpha'?'rgba(230,140,220,0.95)':'rgba(120,230,120,0.95)';
        ctx.fillStyle=dcBg;
        ctx.beginPath(); ctx.roundRect(dcX,rowTop,U(16),ROW_H*0.80,U(2)); ctx.fill();
        ctx.fillStyle=dcFg;
        ctx.font=`bold ${U(8)}px ui-monospace,monospace`;
        ctx.textAlign='center';
        ctx.fillText(m.dcTeam==='alpha'?'α':'β',dcX+U(8),ry-U(2));
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

      // Split by watch: duty (full-width strip), then B (left sub-col), A (right sub-col)
      const dutyList=crew.filter(m=>m.watch==='duty');
      const watchB=crew.filter(m=>m.watch==='B');
      const watchA=crew.filter(m=>m.watch==='A');
      const subW=(availW-U(4))/2;

      // Duty strip — full width rows
      for(let i=0;i<dutyList.length;i++){
        const m=dutyList[i];
        const ry=sy+i*ROW_H+ROW_H*0.82;
        // Thin background stripe for duty
        ctx.fillStyle='rgba(140,110,10,0.12)';
        ctx.fillRect(sx,sy+i*ROW_H,availW,ROW_H-1);
        drawCrewRow(m, sx, ry, availW, true);
      }
      if(dutyList.length) sy+=dutyList.length*ROW_H+U(2);

      // Sub-column header labels
      if(watchB.length||watchA.length){
        const activeWatchB=activeWatch==='B';
        const activeWatchA=activeWatch==='A';
        ctx.font=`bold ${U(8)}px ui-monospace,monospace`;
        ctx.textAlign='center';
        ctx.fillStyle=activeWatchB?'rgba(60,210,185,0.80)':'rgba(60,210,185,0.40)';
        ctx.fillText('── WCH B ──',sx+subW/2,sy+U(8));
        ctx.fillStyle=activeWatchA?'rgba(120,170,255,0.80)':'rgba(120,170,255,0.40)';
        ctx.fillText('── WCH A ──',sx+subW+U(4)+subW/2,sy+U(8));
        sy+=U(11);
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
        drawCrewRow(m, sx+subW+U(4), ry, subW, false);
      }

      return sy+rows*ROW_H+U(6);
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

      // Render each dept as a labelled sub-group using duty/B/A split
      for(const dept of deptOrder){
        const crew=allSupport.filter(m=>m.dept===dept);
        if(crew.length===0) continue;

        // Dept sub-label
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

    // Draw left column
    let ly=cy;
    for(const comp of leftComps){
      ly=drawCompSection(comp,col0x,ly,colW);
      ly+=U(4);
    }

    // Draw right column — compartments then support section
    let ry2=cy;
    for(const comp of rightComps){
      ry2=drawCompSection(comp,col1x,ry2,colW);
      ry2+=U(4);
    }
    drawSupportSection(col1x, ry2, colW);

    // Close button
    PNL.btn2(ctx,'CLOSE',OX+OW/2-U(40),OY+OH-U(26),U(80),U(18),'rgba(30,50,90,0.70)',
      ()=>{ game.showCrewPanel=false; });

    // Hover tooltip — draw on top of everything else
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

  // ── Command Panel ────────────────────────────────────────────────────────────
  function drawPanel(W,H){
    const panelH=PANEL_H;
    const panelY=H-panelH;
    const panelW=W-STRIP_W;
    const PANEL=window.PANEL;
    PANEL.clearBtns();

    // Background
    ctx.fillStyle=TH.color.bg.panel;
    ctx.fillRect(0,panelY,panelW,panelH);
    ctx.strokeStyle=TH.color.border.medium;
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,panelY); ctx.lineTo(panelW,panelY); ctx.stroke();

    const pad=U(TH.pad.m);
    const sectionDivider=(x)=>{
      ctx.strokeStyle=TH.color.border.light;
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
      const B=TH.color.btn;
      state = state || 'available';
      activeCol = activeCol || B.activeBg;
      let bg, fg, stroke = null;
      if(active){
        bg     = state==='emergency' ? B.emergBg : activeCol;
        fg     = B.activeFg;
        stroke = state==='emergency' ? B.emergStroke : B.activeStroke;
      } else if(state==='unavailable'){
        bg = B.unavailBg;
        fg = B.unavailFg;
      } else {
        bg = B.availBg;
        fg = B.availFg;
        stroke = B.availStroke;
      }
      ctx.fillStyle=bg;
      ctx.beginPath(); ctx.roundRect(x,y,w,h,3); ctx.fill();
      if(stroke){
        ctx.strokeStyle=stroke; ctx.lineWidth=1;
        ctx.beginPath(); ctx.roundRect(x,y,w,h,3); ctx.stroke();
      }
      ctx.fillStyle=fg;
      ctx.font=`${U(TH.font.button)}px ${TH.FONT_FAMILY}`;
      ctx.textAlign='center';
      ctx.fillText(label,x+w/2,y+h/2+U(4.5));
      if(state!=='unavailable') PANEL.registerBtn(x,y,w,h,action);
    }

    // ── Section function definitions ──────────────────────────────────────────

    function drawEngineSection(x, w) {
    ctx.fillStyle=TH.color.header;
    ctx.font=`${U(TH.font.header)}px ${TH.FONT_FAMILY}`;
    ctx.textAlign='left';
    ctx.fillText(`ENGINE ORDER — ${Math.round(player.speed)}kt`,x,panelY+U(18));

    const states=PANEL.SPEED_STATES;
    const btnH=U(16);
    const btnGap=U(2);
    const totalBtnH=states.length*(btnH+btnGap)-btnGap;
    const startBtnY=panelY+U(24);

    for(let i=0;i<states.length;i++){
      const s=states[i];
      const by=startBtnY+i*(btnH+btnGap);
      const isActive=PANEL.telegraphIdx===i;
      const col=s.dir>0?'#1e3a5f':s.dir===0?'#374151':'#7f1d1d';
      btn(s.label,x,by,w-pad,btnH,isActive,()=>PANEL.setTelegraph(i),col);
    }

    }

    function drawDepthSection(x, w) {
    ctx.fillStyle=TH.color.header;
    ctx.font=`${U(TH.font.header)}px ${TH.FONT_FAMILY}`;
    ctx.textAlign='left';
    ctx.fillText('DEPTH ORDER',x,panelY+U(18));

    // ACTUAL left, ORDERED right
    ctx.fillStyle=TH.color.text.muted; ctx.font=`${U(TH.font.label)}px ${TH.FONT_FAMILY}`;
    ctx.fillText('ACTUAL',x,panelY+U(33));
    ctx.fillStyle=TH.color.text.primary; ctx.font=`${U(TH.font.valueLg)}px ${TH.FONT_FAMILY}`;
    ctx.fillText(`${Math.round(player.depth)}m`,x,panelY+U(50));

    ctx.fillStyle=TH.color.text.muted; ctx.font=`${U(TH.font.label)}px ${TH.FONT_FAMILY}`;
    ctx.fillText('ORDERED',x+U(64),panelY+U(33));
    ctx.fillStyle=TH.color.text.primary; ctx.font=`${U(TH.font.valueLg)}px ${TH.FONT_FAMILY}`;
    ctx.fillText(`${Math.round(player.depthOrder)}m`,x+U(64),panelY+U(50));

    // Depth step buttons — two rows, bigger step on outside
    const arrowY=panelY+U(62);
    const arrowH=U(20);
    const aGap=U(4);
    const aHalf=(w-pad-aGap)/2;
    // Row 1: shallower
    btn('▲ 50',x,       arrowY,aHalf,arrowH,false,()=>PANEL.depthStep(-50));
    btn('▲ 10',x+aHalf+aGap,arrowY,aHalf,arrowH,false,()=>PANEL.depthStep(-10));
    // Row 2: deeper
    btn('▼ 10',x,       arrowY+arrowH+U(3),aHalf,arrowH,false,()=>PANEL.depthStep(10));
    btn('▼ 50',x+aHalf+aGap,arrowY+arrowH+U(3),aHalf,arrowH,false,()=>PANEL.depthStep(50));

    // PD button
    const pdY=panelY+U(110);
    const atPD=player.depthOrder<=C.player.periscopeDepth+10;
    btn('COME TO PD',x,pdY,w-pad,U(20),atPD,()=>PANEL.comeToPD(),'#1e3a5f');

    // ── Battery bar ─────────────────────────────────────────────────────────
    const batY=panelY+U(138);
    const batFrac=clamp(player.battery??1.0, 0, 1);
    const batPct=Math.round(batFrac*100);
    const batBarW=w-pad;
    const batBarH=U(7);
    // Track
    ctx.fillStyle='rgba(17,24,39,0.55)';
    ctx.beginPath(); ctx.roundRect(x,batY,batBarW,batBarH,U(2)); ctx.fill();
    // Fill — colour shifts red below 20%
    const batR=batPct<20?200:batPct<50?180:60;
    const batG=batPct<20?40:batPct<50?140:180;
    ctx.fillStyle=`rgba(${batR},${batG},200,0.85)`;
    ctx.beginPath(); ctx.roundRect(x,batY,batBarW*batFrac,batBarH,U(2)); ctx.fill();
    // Label
    ctx.fillStyle=TH.color.text.muted; ctx.font=`${U(TH.font.label)}px ${TH.FONT_FAMILY}`;
    ctx.textAlign='left';
    ctx.fillText('BATTERY',x,batY-U(3));
    ctx.fillStyle=TH.color.text.primary; ctx.font=`${U(TH.font.label)}px ${TH.FONT_FAMILY}`;
    ctx.textAlign='right';
    const batStatus=player._battDead?'DEAD':player.snorkeling?'CHRG':(player.snorkelOrdered?'RISG':'');
    ctx.fillText(batPct+'%'+(batStatus?' '+batStatus:''), x+batBarW, batY-U(3));

    // ── Snorkel button (diesel only) ──────────────────────────────────────
    const snkY=panelY+U(152);
    const snkH=U(22);
    if(C.player.isDiesel){
      const ordered=player.snorkelOrdered||false;
      btn(ordered?'CANCEL SNORKEL':'ORDER SNORKEL',x,snkY,w-pad,snkH,ordered,
        ()=>{ player.snorkelOrdered=!player.snorkelOrdered; });
    } else {
      ctx.fillStyle='rgba(17,24,39,0.22)'; ctx.font=`${U(TH.font.label)}px ${TH.FONT_FAMILY}`;
      ctx.textAlign='left';
      ctx.fillText('NUCLEAR — NO SNORKEL',x,snkY+U(9));
    }
    ctx.textAlign='left';
    }

    function drawTrimSection(x, w) {
    ctx.fillStyle=TH.color.header;
    ctx.font=`${U(TH.font.header)}px ${TH.FONT_FAMILY}`;
    ctx.textAlign='left';
    ctx.fillText('BALLAST & TRIM',x,panelY+U(18));

    {
      const {trim:floodTrim, buoyancy:floodBuoy}=window.DMG?.getTrimState?.()??{trim:0,buoyancy:0};
      const hpa=player.damage?.hpa;
      const hpaC=C.player.hpa||{};

      // ── Tank diagram ──────────────────────────────────────────────────────
      const diagY=panelY+U(24);
      const diagW=w-pad;
      const g=U(3);            // gap between all cells
      const trimTH=U(18);      // trim tank row height
      const trimGap=U(3);      // separator between trim row and MBT row
      const mbtH=U(38);        // MBT height
      const fullH=trimTH+trimGap+mbtH;
      const mbtY=diagY+trimTH+trimGap;  // y-origin of MBT row

      // Cell widths — trim tanks wider, MBT-3 fills centre
      const w1=U(26), w2=U(32), w3=Math.round(diagW-2*(w1+w2)-4*g), w4=U(32), w5=U(26);
      const cx1=x;
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
        ctx.font=`bold ${U(7)}px ui-monospace,monospace`;
        ctx.textAlign='center';
        ctx.fillText(label,fx+fw/2,fy+U(10));
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
        ctx.font=`bold ${U(7)}px ui-monospace,monospace`;
        ctx.textAlign='center';
        ctx.fillText(label,fx+fw/2,fy+fh/2+U(3));
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
        ctx.font=`bold ${U(7)}px ui-monospace,monospace`; ctx.textAlign='center';
        ctx.fillText(label,fx+fw/2,fy+U(10));
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
        ctx.font=`bold ${U(7)}px ui-monospace,monospace`; ctx.textAlign='center';
        ctx.fillText(label,fx+fw/2,fy+fh/2+U(3));
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
      const tiltAmp = clamp(floodTrim/2.0,-1,1)*U(7);
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
      const hpaY=diagY+fullH+U(16);
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
      ctx.font=`bold ${U(9)}px ui-monospace,monospace`; ctx.textAlign='left';
      ctx.fillText('HP AIR', x, hpaY);

      ctx.fillStyle=pCol;
      ctx.font=`bold ${U(16)}px ui-monospace,monospace`; ctx.textAlign='center';
      ctx.fillText(`${Math.round(pressureFrac*100)}%`, x+diagW/2, hpaY);

      ctx.fillStyle='rgba(148,163,184,0.70)';
      ctx.font=`bold ${U(9)}px ui-monospace,monospace`; ctx.textAlign='right';
      ctx.fillText(`${Math.round(groupPressure)}/${maxP}`, x+diagW, hpaY);
      ctx.fillStyle='rgba(100,120,150,0.55)';
      ctx.font=`${U(8)}px ui-monospace,monospace`;
      ctx.fillText('bar', x+diagW, hpaY+U(9));

      // ── Bank bars — below header, labels sit under bars ───────────────────
      const bankG=U(3);
      const bankH=U(20);   // taller bars
      const labelH=U(11);  // room for label text below each bar
      const bankW=Math.round((diagW - 4*bankG) / 5);
      const banksTotal=5*bankW+4*bankG;
      const banksX=x+Math.round((diagW-banksTotal)/2);
      const bankY=hpaY+U(14);   // clear of header text

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
        ctx.font=`bold ${U(9)}px ui-monospace,monospace`; ctx.textAlign='center';
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
        ctx.font=`bold ${U(9)}px ui-monospace,monospace`; ctx.textAlign='center';
        ctx.fillText('RES', bx+bankW/2, bankY+bankH+labelH*0.75);
      }

      // ── Controls ──────────────────────────────────────────────────────────
      const ctrlY=bankY+bankH+labelH+U(4);
      const ctrlW=Math.round((diagW-bankG)/2);
      const ctrlH=U(18);
      const venting   = player._blowVenting||false;
      const pending   = player._blowPending||false;
      const manual    = (player._blowManualT||0)>0;
      const blowActive= venting||pending||manual;
      const noHPA     = pressureFrac < 0.02;
      const blowLabel = venting?'BLOW — VENTING':pending?'BLOW — STANDBY':manual?'BLOW — MANUAL':noHPA?'NO HP AIR':'BLOW BALLAST';
      const blowState = (noHPA||blowActive)?'unavailable':'emergency';
      btn(blowLabel,x,ctrlY,ctrlW,ctrlH,blowActive&&!noHPA,
        ()=>PANEL.emergencyBlowBallast(),'#7c1010',blowState);
      const rechg     = hpa?.recharging||false;
      const atSurfaceR= (player.depth||0)<=20;
      const rechgState= atSurfaceR?'available':'unavailable';
      btn(rechg?'RECHARGE ■':'HP RECHARGE',x+ctrlW+bankG,ctrlY,ctrlW,ctrlH,
        rechg&&atSurfaceR,()=>PANEL.toggleHPARecharge(),'#1e3a5f',
        atSurfaceR?'available':'unavailable');
    }

    }

    function drawStatusSection(x, w) {

    ctx.fillStyle=TH.color.header;
    ctx.font=`${U(TH.font.header)}px ${TH.FONT_FAMILY}`;
    ctx.textAlign='left'; ctx.fillText('STATUS',x,panelY+U(18));

    // SPD readout
    ctx.fillStyle=TH.color.text.muted; ctx.font=`${U(TH.font.label)}px ${TH.FONT_FAMILY}`;
    ctx.fillText('SPD',x,panelY+U(33));
    ctx.fillStyle=TH.color.text.primary; ctx.font=`${U(TH.font.valueLg)}px ${TH.FONT_FAMILY}`;
    const ordKts=Math.round(player.speedOrderKts??0);
    ctx.fillText(`${Math.round(player.speed)}kt`,x,panelY+U(50));
    // Ordered speed (if different from current)
    ctx.fillStyle=TH.color.text.muted; ctx.font=`${U(TH.font.label)}px ${TH.FONT_FAMILY}`;
    ctx.fillText(`ORD ${ordKts}kt`,x+U(50),panelY+U(50));

    // Fine speed control — ±1/±5 kt buttons
    const spdBtnY2=panelY+U(52);
    const spdBtnW2=(w-pad-U(6))/4;
    const spdBtnH2=U(14);
    btn('-5',x,                    spdBtnY2,spdBtnW2,spdBtnH2,false,()=>PANEL.setSpeedKts(ordKts-5),'#374151');
    btn('-1',x+spdBtnW2+U(2),     spdBtnY2,spdBtnW2,spdBtnH2,false,()=>PANEL.setSpeedKts(ordKts-1),'#374151');
    btn('+1',x+2*(spdBtnW2+U(2)), spdBtnY2,spdBtnW2,spdBtnH2,false,()=>PANEL.setSpeedKts(ordKts+1),'#1e3a5f');
    btn('+5',x+3*(spdBtnW2+U(2)), spdBtnY2,spdBtnW2,spdBtnH2,false,()=>PANEL.setSpeedKts(ordKts+5),'#1e3a5f');

    // WAVE counter — only shown when wave mode is active
    if((game.wave||0)>1 || (game.waveDelay||0)>0){
      ctx.fillStyle=TH.color.text.muted; ctx.font=`${U(TH.font.label)}px ${TH.FONT_FAMILY}`;
      ctx.fillText('WAVE',x+U(100),panelY+U(33));
      ctx.fillStyle=TH.color.text.primary; ctx.font=`${U(TH.font.valueLg)}px ${TH.FONT_FAMILY}`;
      ctx.fillText(`${game.wave||1}`,x+U(100),panelY+U(50));
    }

    // Wave incoming warning
    if(game.waveDelay>0){
      const blink=Math.sin(performance.now()*0.006)>0;
      ctx.fillStyle=blink?'rgba(220,38,38,0.80)':'rgba(220,38,38,0.30)';
      ctx.font=`bold ${U(8)}px ui-monospace,monospace`;
      ctx.fillText(`NEXT WAVE ${Math.ceil(game.waveDelay)}s`,x,panelY+U(68));
    }
    // Group state indicator
    if(game.groupState==='prosecuting'){
      ctx.fillStyle='rgba(220,38,38,0.75)';
      ctx.font=`bold ${U(7)}px ui-monospace,monospace`;
      ctx.fillText('\u26A0 PROSECUTING',x,panelY+U(68));
    }

    // Crew bar removed — detailed info in damage panel
    const barW=w-pad*2, barH=U(11);
    const dmg=player.damage;

    // Noise bar
    const noiseBarY=panelY+U(72);
    const noisePct=clamp(player.noise,0,1);
    ctx.fillStyle='rgba(17,24,39,0.40)'; ctx.font=`${U(9)}px ui-monospace,monospace`;
    ctx.fillText('NOISE',x,noiseBarY-2);
    ctx.fillStyle='rgba(17,24,39,0.10)'; ctx.fillRect(x,noiseBarY,barW,barH);
    ctx.fillStyle=noisePct>0.5?'#dc2626':'#334155';
    ctx.fillRect(x,noiseBarY,barW*noisePct,barH);

    // Quick system status pills — worst 3 damaged systems
    if(dmg){
      const damaged=Object.entries(dmg.systems)
        .filter(([,s])=>s!=='nominal')
        .sort(([,a],[,b])=>DMG.STATES.indexOf(b)-DMG.STATES.indexOf(a))
        .slice(0,3);
      const pillY=noiseBarY+barH+U(10);
      const stCol={'degraded':'#b45309','offline':'#dc2626','destroyed':'#7f1d1d'};
      let px=x;
      for(const [sys,st] of damaged){
        const label=DMG.SYS_LABEL[sys]?.slice(0,6)||sys.slice(0,6).toUpperCase();
        ctx.fillStyle=stCol[st]||'#dc2626';
        ctx.font=`bold ${U(7.5)}px ui-monospace,monospace`;
        ctx.textAlign='left';
        ctx.fillText(`${label}:${st.slice(0,3).toUpperCase()}`,px,pillY);
        px+=U(58);
        if(px>x+barW) break;
      }
      // DMG panel toggle button — blinks if there's active damage
      const hasDmg=damaged.length>0||Object.values(dmg.flooding).some(f=>f>0);
      const blink=hasDmg&&(Math.sin(performance.now()*0.007)>0);
      const dmgBtnY=noiseBarY+barH+U(8);
      btn('⚡ DMG CTRL',x,dmgBtnY,barW,U(17),game.showDamageScreen,
        ()=>{game.showDamageScreen=!game.showDamageScreen;},
        blink?'#991b1b':'#1e3a5f');
      const hasNewDcLog=(game.dcLog||[]).length>0&&game.logTab!=='dc';
      const dcBlink=hasNewDcLog&&(Math.sin(performance.now()*0.007)>0);
      btn('📋 DMG LOG',x,dmgBtnY+U(20),barW,U(17),game.logTab==='dc',
        ()=>{game.logTab=game.logTab==='dc'?'log':'dc';},
        dcBlink?'#7c3a00':'#1e3a5f');
      btn('👥 CREW',x,dmgBtnY+U(40),barW,U(17),game.showDamageScreen,
        ()=>{game.showDamageScreen=!game.showDamageScreen;},
        '#1e3a5f');
    }

    }

    function drawPostureSection(x, w) {
    const pbH=U(21), pbW=w-pad;
    const halfW=(pbW-U(4))/2;

    ctx.fillStyle=TH.color.header;
    ctx.font=`${U(TH.font.header)}px ${TH.FONT_FAMILY}`;
    ctx.textAlign='left'; ctx.fillText('POSTURE',x,panelY+U(18));

    // ── Crew state badge (clickable) ─────────────────────────────────────────
    const tState=game.tacticalState||'cruising';
    const cState=game.casualtyState||'normal';
    const stateLabel=cState==='escape'?'ESCAPE STA':cState==='emergency'?'EMRG STA':tState==='action'?'ACTION STA':tState==='patrol'?'PATROL ST':'CRUIS WATCH';
    const stateBg=cState==='escape'?'rgba(180,20,20,0.90)':cState==='emergency'?'rgba(160,60,0,0.85)':tState==='action'?'rgba(120,0,0,0.75)':tState==='patrol'?'rgba(92,64,10,0.70)':'rgba(17,24,39,0.55)';
    const stateFlash=cState==='escape'||cState==='emergency';
    const stateVisible=!stateFlash||(Math.floor(Date.now()/400)%2===0);
    if(stateVisible){
      ctx.fillStyle=stateBg;
      ctx.beginPath(); ctx.roundRect(x,panelY+U(27),pbW,pbH,3); ctx.fill();
      ctx.fillStyle='#f8f6f0';
      ctx.font=`bold ${U(11)}px ui-monospace,monospace`;
      ctx.textAlign='center';
      ctx.fillText(stateLabel,x+pbW/2,panelY+U(27)+pbH*0.68);
    }
    if(cState==='normal'||cState==='patrol'){
      PANEL.registerBtn(x,panelY+U(27),pbW,pbH,()=>PANEL.callActionStations());
    }

    btn('◆ SILENT',x,panelY+U(52),pbW,pbH,player.silent,
      ()=>PANEL.toggleSilent(),'#1e3a5f');
    btn('ALL STOP',x,panelY+U(77),pbW,pbH,PANEL.telegraphIdx===5,
      ()=>PANEL.allStop());

    // ── Towed array button + status ───────────────────────────────────────────
    if(C.player.hasTowedArray !== false){
    {
      const ta=player.towedArray;
      const taState=ta?.state||'stowed';
      const taActive=taState==='operational'||taState==='damaged'||taState==='deploying'||taState==='retracting';
      const taCol=taState==='operational'?'#1e3a5f'
                 :taState==='damaged'?'#92400e'
                 :taState==='destroyed'?'rgba(120,20,20,0.55)'
                 :'rgba(17,24,39,0.55)';
      ctx.font=`${U(8)}px ui-monospace,monospace`; ctx.textAlign='left';
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
      ctx.fillStyle='rgba(17,24,39,0.30)'; ctx.fillText('ARRAY',x,panelY+U(112));
      ctx.fillStyle=taStateCol; ctx.fillText(taStateStr,x+U(36),panelY+U(112));
      if(taState==='deploying'||taState==='retracting'){
        const bx=x, by=panelY+U(115), bw=pbW, bh=U(3);
        ctx.fillStyle='rgba(17,24,39,0.10)'; ctx.fillRect(bx,by,bw,bh);
        ctx.fillStyle='rgba(17,24,39,0.45)'; ctx.fillRect(bx,by,bw*(ta.progress||0),bh);
      }
      if(taState!=='destroyed'){
        btn(taActive?'RETRACT ARRAY':'DEPLOY ARRAY',x,panelY+U(119),pbW,pbH,
          taActive&&taState!=='deploying',()=>PANEL.toggleTowedArray(),taCol);
      }
    }
    } else {
      // No towed array on this vessel
      ctx.fillStyle='rgba(17,24,39,0.22)'; ctx.font=`${U(8)}px ui-monospace,monospace`; ctx.textAlign='left';
      ctx.fillText('NO TOWED ARRAY',x,panelY+U(112));
    }

    }

    function drawEmergencySection(x, w) {
    const ebH=U(20), egap=U(4);
    const ebW=w-pad;
    const eHalfW=(ebW-egap)/2;
    const eCol2=x+eHalfW+egap;

    ctx.fillStyle=TH.color.header;
    ctx.font=`${U(TH.font.header)}px ${TH.FONT_FAMILY}`;
    ctx.textAlign='left'; ctx.fillText('EMERGENCY',x,panelY+U(18));

    btn('EMERGENCY TURN',x,panelY+U(27),ebW,ebH,
      player.emergTurnT>0,()=>PANEL.emergencyTurn(),'#7f1d1d',
      player.emergTurnT>0?'emergency':'available');
    btn('CRASH DIVE',x,panelY+U(51),ebW,ebH,
      player.crashDiveT>0,()=>PANEL.emergencyCrashDive(),'#7f1d1d',
      player.crashDiveT>0?'emergency':'available');

    }

    function drawWeaponsSection(x, w) {

    ctx.fillStyle=TH.color.header;
    ctx.font=`${U(TH.font.header)}px ${TH.FONT_FAMILY}`;
    ctx.textAlign='left'; ctx.fillText('WEAPONS',x,panelY+U(18));

    function weaponRow(label,cd,maxCd,y,actionLabel,action){
      const rdy=cd<=0;
      const rowH=U(22);
      const wbW=U(110);
      ctx.fillStyle='rgba(17,24,39,0.08)'; ctx.fillRect(x,y,wbW,rowH-U(3));
      if(!rdy){
        ctx.fillStyle='rgba(17,24,39,0.20)';
        ctx.fillRect(x,y,wbW*clamp(1-cd/maxCd,0,1),rowH-U(3));
      } else {
        ctx.fillStyle='rgba(30,58,95,0.15)';
        ctx.fillRect(x,y,wbW,rowH-U(3));
      }
      ctx.fillStyle=rdy?'#111827':'rgba(17,24,39,0.35)';
      ctx.font=`${U(9)}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillText(label+(rdy?' RDY':` ${cd.toFixed(1)}s`),x+U(3),y+rowH*0.70);
      if(rdy){
        btn(actionLabel,x+wbW+U(4),y,U(38),rowH-U(3),false,action,'#1e3a5f');
      }
    }

    // Torpedo tube display
    {
      const tubes=player.torpTubes||[];
      const tubeLoad=player.tubeLoad||[];
      const tubeOp=player.tubeOp||null;
      const stock=typeof player.torpStock==='number'?player.torpStock:0;
      const mStock=player.missileStock||0;
      const reloadTime=C.player.torpReloadTime||28;
      const fireDelay=C.player.fireDelay||1.8;
      const pending=player.pendingFires||[];
      const hdrY=panelY+U(18);
      const outOfAmmo=stock<=0&&mStock<=0&&pending.length===0;
      const allBusy=tubes.length>0&&tubes.every(t=>t>0);
      const selTube=game.wirePanel?.selectedTube??0;

      ctx.fillStyle=outOfAmmo?'rgba(17,24,39,0.28)':'#111827';
      ctx.font=`bold ${U(11)}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillText('TUBES',x+U(3),hdrY+U(11));

      ctx.font=`bold ${U(11)}px ui-monospace,monospace`;
      ctx.fillStyle=outOfAmmo?'rgba(17,24,39,0.20)':'#111827';
      ctx.textAlign='right';
      const stockStr=`${stock}T${mStock>0?' '+mStock+'M':''}`;
      ctx.fillText(stockStr,x+U(145),hdrY+U(11));

      const pipW=U(18), pipH=U(30), pipGap=U(4);
      const pipStartX=x+U(3);
      const pipY=hdrY+U(16);
      for(let i=0;i<tubes.length;i++){
        const px=pipStartX+i*(pipW+pipGap);
        const wireOccupied=tubes[i]===-1||(player.tubeWires?.[i]?.wire?.live===true);
        const ready=tubes[i]===0&&!wireOccupied;
        const load=tubeLoad[i]; // 'torp', missile key, or null (empty)
        const isMissileLoad=load&&load!=='torp';
        const hasShell=ready&&load!=null&&(isMissileLoad?(mStock>0||true):stock>0); // loaded = has weapon
        const pf=pending.find(p=>p.tubeIdx===i);
        const isSelected=i===selTube;
        const isOpTube=tubeOp?.tubeIdx===i;

        // Selection highlight
        if(isSelected&&!pf&&!wireOccupied){
          ctx.fillStyle='rgba(30,58,95,0.10)';
          ctx.fillRect(px-U(1),pipY-U(1),pipW+U(2),pipH+U(2));
        }

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
          ctx.font=`${U(8)}px ui-monospace,monospace`;
          ctx.textAlign='center';
          ctx.fillText(pf.doorsLogged?'FIRE':'FLOOD',px+pipW/2,pipY+pipH*0.62);
        } else if(wireOccupied){
          const pulse=0.5+0.5*Math.sin(performance.now()*0.006);
          ctx.fillStyle=`rgba(13,148,136,${0.25+pulse*0.15})`;
          ctx.fillRect(px,pipY,pipW,pipH);
          ctx.fillStyle='rgba(13,148,136,0.90)';
          ctx.font=`bold ${U(7)}px ui-monospace,monospace`;
          ctx.textAlign='center';
          ctx.fillText('WIRE',px+pipW/2,pipY+pipH*0.45);
          ctx.fillText(`T${i+1}`,px+pipW/2,pipY+pipH*0.72);
        } else if(isOpTube){
          // Tube op in progress — show progress fill
          const frac=clamp(tubeOp.progress/tubeOp.totalT,0,1);
          ctx.fillStyle='rgba(120,80,20,0.22)';
          ctx.fillRect(px,pipY+pipH*(1-frac),pipW,pipH*frac);
          ctx.fillStyle='rgba(180,140,60,0.75)';
          ctx.font=`${U(7)}px ui-monospace,monospace`;
          ctx.textAlign='center';
          const opLbl=tubeOp.type==='unload'?'OUT':tubeOp.type==='strike'?'SWAP':'IN';
          ctx.fillText(opLbl,px+pipW/2,pipY+pipH*0.52);
          ctx.fillText(Math.ceil(tubeOp.totalT-tubeOp.progress)+'s',px+pipW/2,pipY+pipH*0.78);
        } else if(!ready&&tubes[i]>0){
          // Auto-reloading (torpedo only)
          const frac=clamp(1-tubes[i]/reloadTime,0,1);
          ctx.fillStyle='rgba(17,24,39,0.18)';
          ctx.fillRect(px,pipY+pipH*(1-frac),pipW,pipH*frac);
          ctx.fillStyle='rgba(17,24,39,0.45)';
          ctx.font=`${U(8)}px ui-monospace,monospace`;
          ctx.textAlign='center';
          ctx.fillText(Math.ceil(tubes[i])+'s',px+pipW/2,pipY+pipH*0.62);
        } else if(hasShell){
          // Loaded and ready
          const col=isMissileLoad?'rgba(100,40,120,0.55)':'rgba(30,58,95,0.55)';
          const colTxt=isMissileLoad?'rgba(200,140,220,0.95)':'rgba(30,58,95,0.95)';
          ctx.fillStyle=col;
          ctx.fillRect(px,pipY,pipW,pipH);
          ctx.fillStyle=colTxt;
          ctx.font=`bold ${U(7)}px ui-monospace,monospace`;
          ctx.textAlign='center';
          // Short load type label
          const torpWpn=C.weapons?.[C.player.torpWeapon];
          const loadAbbr=isMissileLoad?(C.weapons?.[load]?.shortLabel||load).slice(0,4):(torpWpn?.shortLabel||'TORP').slice(0,4);
          ctx.fillText(loadAbbr,px+pipW/2,pipY+pipH*0.42);
          ctx.fillText('▶',px+pipW/2,pipY+pipH*0.75);
        } else if(load===null||load===undefined){
          // Truly empty tube
          ctx.fillStyle='rgba(17,24,39,0.06)';
          ctx.fillRect(px,pipY,pipW,pipH);
          ctx.fillStyle='rgba(17,24,39,0.30)';
          ctx.font=`${U(7)}px ui-monospace,monospace`;
          ctx.textAlign='center';
          ctx.fillText('MT',px+pipW/2,pipY+pipH*0.62);
        } else {
          ctx.fillStyle='rgba(17,24,39,0.06)';
          ctx.fillRect(px,pipY,pipW,pipH);
        }
        // Selection border
        const selBorder=isSelected?'rgba(100,150,220,0.55)':null;
        ctx.strokeStyle=selBorder||(wireOccupied?'rgba(13,148,136,0.70)':pf?'rgba(180,100,0,0.70)':isMissileLoad?'rgba(160,80,200,0.60)':hasShell?'rgba(30,58,95,0.60)':ready?'rgba(17,24,39,0.15)':'rgba(17,24,39,0.25)');
        ctx.lineWidth=isSelected?2:pf?1.5:1;
        ctx.strokeRect(px,pipY,pipW,pipH);

        // Click to select tube for load management
        btn('',px,pipY,pipW,pipH,false,()=>{ if(game.wirePanel) game.wirePanel.selectedTube=i; },'transparent');
      }

      // ── Load management section ─────────────────────────────────────────────
      // Shows actions for the selected tube; collapses when firing or wire active
      {
        const lmY=pipY+pipH+U(4);
        const lmH=U(18);
        const wireOnSel=tubes[selTube]===-1||(player.tubeWires?.[selTube]?.wire?.live===true);
        const selLoad=tubeLoad[selTube];
        const selState=tubes[selTube];
        const opOnSel=tubeOp?.tubeIdx===selTube;
        const opBusy=!!tubeOp;
        const misTypes=C.player.missileTypes||[];

        ctx.font=`${U(8)}px ui-monospace,monospace`;
        ctx.textAlign='left';

        if(wireOnSel){
          ctx.fillStyle='rgba(13,148,136,0.50)';
          ctx.fillText(`T${selTube+1} WIRE LIVE`,pipStartX,lmY+U(13));
        } else if(opOnSel){
          // Progress bar for current op
          const frac=clamp(tubeOp.progress/tubeOp.totalT,0,1);
          const barW=U(145)-pipStartX+x;
          ctx.fillStyle='rgba(17,24,39,0.12)';
          ctx.fillRect(pipStartX,lmY,barW,lmH);
          ctx.fillStyle='rgba(180,140,60,0.35)';
          ctx.fillRect(pipStartX,lmY,barW*frac,lmH);
          ctx.fillStyle='rgba(180,140,60,0.80)';
          const opLabels={load:'LOADING',unload:'UNLOADING',strike:'STRIKE RELOAD'};
          ctx.fillText(`${opLabels[tubeOp.type]||'BUSY'} T${selTube+1}  ${Math.ceil(tubeOp.totalT-tubeOp.progress)}s`,pipStartX+U(3),lmY+U(13));
        } else if(selLoad==null){
          // Empty tube — show LOAD buttons
          const nOpts=1+misTypes.length;
          const btnW=(U(150)-pipStartX+x)/nOpts-U(2);
          let bx=pipStartX;
          btn('LD TORP',bx,lmY,btnW,lmH,opBusy,()=>window._orderLoad?.(selTube,'torp'),opBusy?'rgba(17,24,39,0.10)':'rgba(17,24,39,0.25)');
          bx+=btnW+U(2);
          for(const mk of misTypes){
            const ml=(C.weapons?.[mk]?.shortLabel||mk).slice(0,6);
            const canLoad=(mStock>0)&&!opBusy;
            btn(`LD ${ml}`,bx,lmY,btnW,lmH,!canLoad,()=>window._orderLoad?.(selTube,mk),canLoad?'rgba(100,40,120,0.30)':'rgba(17,24,39,0.10)');
            bx+=btnW+U(2);
          }
        } else {
          // Loaded tube — show UNLOAD + CHANGE options
          const nOpts=2+misTypes.filter(mk=>mk!==(selLoad==='torp'?null:selLoad)).length;
          const btnW=(U(150)-pipStartX+x)/Math.max(nOpts,2)-U(2);
          let bx=pipStartX;
          const canAct=!opBusy&&selState===0;
          btn('UNLOAD',bx,lmY,btnW,lmH,!canAct,()=>window._orderUnload?.(selTube),canAct?'rgba(17,24,39,0.25)':'rgba(17,24,39,0.10)');
          bx+=btnW+U(2);
          // Change options — torpedo if currently missile, missile(s) if currently torpedo
          if(selLoad!=='torp'){
            const canChg=canAct&&(stock>0);
            btn('CHG TORP',bx,lmY,btnW,lmH,!canChg,()=>window._orderStrikeReload?.(selTube,'torp'),canChg?'rgba(17,24,39,0.25)':'rgba(17,24,39,0.10)');
            bx+=btnW+U(2);
          } else {
            for(const mk of misTypes){
              const ml=(C.weapons?.[mk]?.shortLabel||mk).slice(0,6);
              const canChg=canAct&&(mStock>0);
              btn(`CHG ${ml}`,bx,lmY,btnW,lmH,!canChg,()=>window._orderStrikeReload?.(selTube,mk),canChg?'rgba(100,40,120,0.30)':'rgba(17,24,39,0.10)');
              bx+=btnW+U(2);
            }
          }
        }
      }

      ctx.textAlign='left';
      ctx.font=`${U(9)}px ui-monospace,monospace`;
      ctx.fillStyle='rgba(17,24,39,0.40)';
      const hasPending=pending.length>0;
      const statusStr=outOfAmmo?'DRY':hasPending?'FIRING…':allBusy?'RELOADING':'SHIFT+CLICK AIM  F FIRE';
      ctx.fillText(statusStr,pipStartX,pipY+pipH+U(10)+U(22));
    }
    weaponRow('ACTIVE PING [SPACE]',player.pingCd,C.player.pingCd,panelY+U(124),'PING',
      ()=>{ if(player.pingCd<=0){ window.SENSE?.activePing(); setMsg('PING!',0.8); }});
    const cmStock=player.cmStock??0;
    const cmLabel=cmStock>0?`CM [X] x${cmStock}`:'CM [X] EMPTY';
    weaponRow(cmLabel,player.cmCd,C.player.cmCd,panelY+U(154),cmStock>0?'DEPLOY':'---',
      ()=>{ if(window.W&&player.cmCd<=0&&cmStock>0){
        player.cmStock--;
        player.cmCd=C.player.cmCd;
        window.W.deployDecoy(player.wx,player.wy,true,'noisemaker',{depth:player.depth});
        player.noiseTransient=Math.min(1,player.noiseTransient+0.10);
        setMsg('NOISEMAKER OUT',0.9);
      }});

    }

    function drawMastSection(x, w) {
      const masts=player.masts||[];
      const cfgs=C.player.masts||[];
      if(!cfgs.length) return;

      ctx.fillStyle=TH.color.header;
      ctx.font=`${U(TH.font.header)}px ${TH.FONT_FAMILY}`;
      ctx.textAlign='left';
      ctx.fillText('MASTS',x,panelY+U(18));

      const rowH=U(26), rowGap=U(3);
      const btnW=U(38), btnH=U(18);

      for(let i=0;i<cfgs.length;i++){
        const cfg=cfgs[i];
        const m=masts[i]||{state:'down',t:0};
        const ry=panelY+U(24)+i*(rowH+rowGap);

        // State colour
        const stateCol=m.state==='up'?'rgba(22,163,74,0.80)'
          :m.state==='damaged'?'rgba(180,30,30,0.80)'
          :(m.state==='raising'||m.state==='lowering')?'rgba(146,64,14,0.80)'
          :'rgba(17,24,39,0.30)';

        // Label
        ctx.fillStyle=stateCol;
        ctx.font=`${U(9)}px ui-monospace,monospace`;
        ctx.textAlign='left';
        ctx.fillText(cfg.label,x,ry+U(12));

        // State text
        const stateStr=m.state==='up'?'UP'
          :m.state==='damaged'?'LOST'
          :m.state==='raising'?`↑${Math.ceil(m.t)}s`
          :m.state==='lowering'?`↓${Math.ceil(m.t)}s`
          :'DOWN';
        ctx.fillStyle=stateCol;
        ctx.font=`${U(8)}px ui-monospace,monospace`;
        ctx.textAlign='left';
        ctx.fillText(stateStr,x+U(56),ry+U(12));

        // Raise/Lower toggle button
        if(m.state!=='damaged'){
          const isUp=m.state==='up'||m.state==='raising';
          const bLabel=isUp?'LOWER':'RAISE';
          const bCol=isUp?'rgba(127,29,29,0.65)':'rgba(17,58,39,0.65)';
          PANEL.btn2(ctx,bLabel,x+w-pad-btnW,ry,btnW,btnH,bCol,()=>window._toggleMast?.(cfg.key));
        }

        // Warning flash when in flood risk zone
        if((m.state==='up'||m.state==='raising')&&player.depth>(cfg.safeDepth+5)&&player.depth<=cfg.crushDepth){
          const blink=Math.sin(performance.now()*0.012)>0;
          if(blink){
            ctx.fillStyle='rgba(220,150,0,0.22)';
            ctx.beginPath(); ctx.roundRect(x,ry-U(2),w-pad,rowH,2); ctx.fill();
          }
        }
        // Crush danger flash
        if((m.state==='up'||m.state==='raising')&&player.depth>cfg.crushDepth){
          const blink=Math.sin(performance.now()*0.020)>0;
          if(blink){
            ctx.fillStyle='rgba(220,38,38,0.28)';
            ctx.beginPath(); ctx.roundRect(x,ry-U(2),w-pad,rowH,2); ctx.fill();
          }
        }
      }
    }

    function drawWireSection(x, w) {
    {
      const WP = window._wirePanel;
      const nTubes = C.player.torpTubes||4;
      const selTube = game.wirePanel?.selectedTube??0;
      const tubeWires = player.tubeWires||[];

      ctx.fillStyle=TH.color.header;
      ctx.font=`${U(TH.font.header)}px ${TH.FONT_FAMILY}`;
      ctx.textAlign='left';
      ctx.fillText('WIRES',x,panelY+U(18));

      // Tube tabs
      const tabW=(w-pad)/nTubes, tabH=U(16);
      for(let i=0;i<nTubes;i++){
        const torp=tubeWires[i];
        const wireLive=torp?.wire?.live;
        const active=i===selTube;
        const tabX=x+i*tabW;
        const tabCol=wireLive?(active?'#1e3a5f':'rgba(30,58,95,0.35)')
          :(active?'rgba(17,24,39,0.18)':'rgba(17,24,39,0.06)');
        ctx.fillStyle=tabCol;
        ctx.beginPath(); ctx.roundRect(tabX,panelY+U(22),tabW-U(2),tabH,U(2)); ctx.fill();
        ctx.fillStyle=wireLive?'#e2e8f0':'rgba(17,24,39,0.45)';
        ctx.font=`bold ${U(8.5)}px ui-monospace,monospace`;
        ctx.textAlign='center';
        ctx.fillText(`T${i+1}`,tabX+tabW/2-U(1),panelY+U(22)+tabH*0.72);
        PANEL.btn2(ctx,'',tabX,panelY+U(22),tabW-U(2),tabH,'transparent',()=>WP.selectWireTube(i));
      }

      // Selected tube details
      const torp = tubeWires[selTube];
      const wireLive = torp?.wire?.live;
      const detY = panelY+U(44);

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
        ctx.font=`bold ${U(9)}px ui-monospace,monospace`;
        ctx.textAlign='left';
        ctx.fillText(`WIRE LIVE`,x,detY);
        ctx.fillStyle='rgba(17,24,39,0.55)';
        ctx.font=`${U(8.5)}px ui-monospace,monospace`;
        ctx.fillText(`${nm.toFixed(1)}nm paid out`,x+U(60),detY);

        // Torpedo heading + seeker
        ctx.fillStyle='rgba(17,24,39,0.55)';
        ctx.font=`${U(8.5)}px ui-monospace,monospace`;
        ctx.fillText('HDG',x,detY+U(13));
        ctx.fillStyle='#111827';
        ctx.font=`${U(13)}px ui-monospace,monospace`;
        ctx.fillText(`${Math.round(hdgDeg).toString().padStart(3,'0')}°`,x,detY+U(26));

        ctx.fillStyle='rgba(17,24,39,0.55)';
        ctx.font=`${U(8.5)}px ui-monospace,monospace`;
        ctx.fillText('SEEKER',x+U(55),detY+U(13));
        const seekLabel=!seekerOn?'ARMING':locked?'LOCKED':'SRCH';
        const seekCol=!seekerOn?'rgba(100,100,100,0.70)':locked?'rgba(220,38,38,0.85)':'rgba(234,179,8,0.85)';
        ctx.fillStyle=seekCol;
        ctx.font=`bold ${U(11)}px ui-monospace,monospace`;
        ctx.fillText(seekLabel,x+U(55),detY+U(26));

        // Commanded bearing display
        if(torp.wire.cmdBrg!=null){
          const cmdDeg=(((Math.atan2(Math.cos(torp.wire.cmdBrg),-Math.sin(torp.wire.cmdBrg))*180/Math.PI)+360)%360);
          ctx.fillStyle='rgba(17,24,39,0.45)';
          ctx.font=`${U(8)}px ui-monospace,monospace`;
          ctx.textAlign='left';
          ctx.fillText(`CMD ${Math.round(cmdDeg).toString().padStart(3,'0')}°${autoTDC?' [TDC]':''}`,x,detY+U(38));
        }

        // Buttons row 1: AUTO TDC toggle
        const bH=U(15), bY=detY+U(44);
        PANEL.btn2(ctx,autoTDC?'AUTO TDC ✓':'AUTO TDC',x,bY,w-pad*2,bH,
          autoTDC?'rgba(30,58,95,0.70)':'rgba(17,24,39,0.12)',
          ()=>WP.wireAutoTDC(selTube,!autoTDC));

        // Buttons row 2: nudge left/right (only enabled when auto-TDC off)
        const nudgeY=bY+bH+U(3);
        const nudgeW=(w-pad*2-U(4))/4;
        const nudgeCols=['rgba(17,24,39,0.35)','rgba(17,24,39,0.20)','rgba(17,24,39,0.20)','rgba(17,24,39,0.35)'];
        const nudges=[[-10,'◄◄'],[-5,'◄ PORT'],['+5 STBD ►'],['+10','►►']];
        const nudgeDeg=[-10,-5,5,10];
        for(let ni=0;ni<4;ni++){
          PANEL.btn2(ctx,nudges[ni][1]??nudges[ni][0],
            x+ni*(nudgeW+U(1)),nudgeY,nudgeW,bH,
            nudgeCols[ni],()=>WP.wireNudge(selTube,nudgeDeg[ni]));
        }

        // Cut wire button
        const cutY=nudgeY+bH+U(3);
        PANEL.btn2(ctx,'CUT WIRE',x,cutY,w-pad*2,bH+U(2),
          'rgba(127,29,29,0.65)',()=>WP.wireCut(selTube));

      } else {
        // No live wire on this tube
        ctx.fillStyle='rgba(17,24,39,0.25)';
        ctx.font=`${U(8.5)}px ui-monospace,monospace`;
        ctx.textAlign='left';
        const tubeSt=player.torpTubes?.[selTube]??0;
        const stLabel=tubeSt>0?`RELOADING ${tubeSt.toFixed(0)}s`:tubeSt===-1?'OCCUPIED':'READY';
        ctx.fillText(stLabel,x,detY+U(10));
        ctx.fillText('No wire',x,detY+U(22));
      }
    }
    }

    function drawVlsSection(x, w) {
      const nCells = C.player.vlsCells || 0;
      const cells  = player.vlsCells || [];
      const wType  = C.player.vlsWeapon;
      const wLabel = wType ? (C.weapons?.[wType]?.shortLabel || wType.toUpperCase()).slice(0,6) : '?';
      const hasSolution = !!game.ascmSolution;
      const readyCount  = cells.filter(c => c?.state === 'ready').length;

      ctx.fillStyle = TH.color.header;
      ctx.font = `${U(TH.font.header)}px ${TH.FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.fillText('VLS', x, panelY+U(18));

      ctx.fillStyle = readyCount > 0 ? 'rgba(30,150,60,0.65)' : 'rgba(100,100,100,0.50)';
      ctx.font = `${U(8)}px ui-monospace,monospace`;
      ctx.textAlign = 'right';
      ctx.fillText(`${readyCount}/${nCells}`, x+w-pad, panelY+U(18));

      // 4-column grid
      const cols   = 4;
      const rows   = Math.ceil(nCells / cols);
      const cPad   = U(2);
      const cellW  = (w - pad - cPad*(cols-1)) / cols;
      const cellH  = U(28);
      const gridY  = panelY + U(26);

      for (let i = 0; i < nCells; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx  = x + col*(cellW + cPad);
        const cy  = gridY + row*(cellH + cPad);
        const cell    = cells[i];
        const isReady = cell?.state === 'ready';
        const canFire = isReady && hasSolution;

        ctx.fillStyle = isReady
          ? (canFire ? 'rgba(15,60,30,0.70)' : 'rgba(20,50,20,0.55)')
          : 'rgba(15,15,20,0.55)';
        ctx.beginPath(); ctx.roundRect(cx, cy, cellW, cellH, U(2)); ctx.fill();

        ctx.strokeStyle = isReady ? 'rgba(30,160,60,0.40)' : 'rgba(60,60,80,0.20)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(cx+0.5, cy+0.5, cellW-1, cellH-1, U(2)); ctx.stroke();

        ctx.fillStyle = isReady ? 'rgba(100,200,120,0.70)' : 'rgba(80,80,100,0.40)';
        ctx.font = `${U(7)}px ui-monospace,monospace`;
        ctx.textAlign = 'left';
        ctx.fillText(`${i+1}`, cx+U(2), cy+U(9));

        ctx.fillStyle = isReady ? 'rgba(180,230,190,0.90)' : 'rgba(80,80,100,0.30)';
        ctx.font = `bold ${U(8)}px ui-monospace,monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(isReady ? wLabel : 'EXP', cx+cellW/2, cy+cellH*0.70);

        if (canFire) {
          PANEL.btn2(ctx, '', cx, cy, cellW, cellH, 'transparent', () => window._fireVLS?.(i));
        }
      }

      const stY = gridY + rows*(cellH + cPad) + U(8);
      ctx.font = `${U(7.5)}px ui-monospace,monospace`;
      ctx.textAlign = 'left';
      ctx.fillStyle = hasSolution ? 'rgba(30,160,60,0.65)' : 'rgba(17,24,39,0.30)';
      ctx.fillText(hasSolution ? 'FIRE CTRL SET' : 'NO SOLUTION', x, stY);
    }

    function drawTdcSection(x, w) {
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
    const fcW=U(235);  // fixed fire control column width
    const fcX=x;

    ctx.fillStyle=tdc.frozen?'rgba(180,60,60,0.70)':'rgba(17,24,39,0.35)';
    ctx.font=`${U(11)}px ui-monospace,monospace`;
    ctx.textAlign='left';
    // Show classification of designated contact
    const selSc=tdc.target?sonarContacts.get(tdc.target):null;
    const classLabel=selSc?.classification?' — '+selSc.classification:'';
    ctx.fillText(tdc.frozen?'TDC [FROZEN]':'TDC'+classLabel,fcX,panelY+U(18));

    // ── Solution quality bar — prominent feedback on designated contact ────────
    {
      const sq=tdc.tmaQuality??0;
      const barW=fcW-U(36); // leave room for CLR button
      const barH=U(5);
      const barY=panelY+U(21);
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
        ctx.font=`bold ${U(8)}px ui-monospace,monospace`;
        ctx.textAlign='right';
        ctx.fillText(sqLabel, fcX+fcW-U(38), barY+barH-U(0.5));
      }
    }

    // Designation buttons row — paginated when contacts exceed visible slots
    const cbW=U(35), cbH=U(17), cbGap=U(3);
    const cbY=panelY+U(24);
    const arrowW=U(16);
    const clrW=U(32);
    const availW=fcW-clrW-arrowW*2-U(10); // space for contact buttons, with both arrows and CLR reserved
    const slotsPerPage=Math.max(1,Math.floor(availW/(cbW+cbGap)));
    const totalContacts=tdcContacts.length;
    const needsPaging=totalContacts>slotsPerPage;
    if(!game._tdcPage) game._tdcPage=0;
    // Clamp page to valid range
    const maxPage=Math.max(0,Math.ceil(totalContacts/slotsPerPage)-1);
    if(game._tdcPage>maxPage) game._tdcPage=maxPage;
    const pageStart=game._tdcPage*slotsPerPage;
    const pageEnd=Math.min(pageStart+slotsPerPage,totalContacts);

    let cbX=fcX;
    ctx.font=`${U(9)}px ui-monospace,monospace`;

    // Page left arrow
    if(needsPaging){
      const canLeft=game._tdcPage>0;
      btn('\u25C0', cbX, cbY, arrowW, cbH, false,
        ()=>{ if(game._tdcPage>0) game._tdcPage--; },
        canLeft?'rgba(17,24,39,0.60)':'rgba(17,24,39,0.20)');
      cbX+=arrowW+U(2);
    }

    for(let ci=pageStart;ci<pageEnd;ci++){
      const c=tdcContacts[ci];
      const isSelected=tdc.target===c.ref;
      const cQ=c.sc?.tmaQuality??0;
      const selCol=c.isTorp?'rgba(100,30,200,0.75)':c.isDead?'rgba(150,30,30,0.75)':cQ>=0.6?'#1e3a5f':cQ>=0.2?'rgba(146,64,14,0.85)':'rgba(80,80,80,0.75)';
      btn(c.id, cbX, cbY, cbW, cbH, isSelected,
        ()=>{ game.tdc.target=c.ref; game.tdc.targetId=c.id; setMsg(`TDC: ${c.id} DESIGNATED`,1.0); },
        selCol);
      cbX+=cbW+cbGap;
    }

    // Page right arrow
    if(needsPaging){
      const canRight=game._tdcPage<maxPage;
      btn('\u25B6', cbX, cbY, arrowW, cbH, false,
        ()=>{ if(game._tdcPage<maxPage) game._tdcPage++; },
        canRight?'rgba(17,24,39,0.60)':'rgba(17,24,39,0.20)');
    }

    // CLR: clear TDC designation + remove all dead contacts from sonarContacts map
    btn('CLR',fcX+fcW-clrW,cbY,clrW,cbH,false,()=>{
      game.tdc.target=null; game.tdc.targetId=null;
      // Remove dead entries from sonarContacts so they vanish from contacts list
      const sc=window.G.sonarContacts;
      if(sc){ for(const [e,c] of sc){ if(c.dead||e.dead) sc.delete(e); } }
      setMsg('TDC: CLEARED',0.8);
    },'#7f1d1d');

    // Fire control readouts — 3 columns: BRG | RNG | INT BRG
    const fcCol=fcW/3;
    const rdY=panelY+U(52);
    const rdCol='rgba(17,24,39,0.38)';
    const tmaQ=tdc.tmaQuality??0;
    const hasRange=tdc.range!=null;
    const rdValCol=tdc.target?'#111827':'rgba(17,24,39,0.20)';
    const rdDimCol='rgba(17,24,39,0.26)';
    const fc2=fcX+fcCol, fc3=fcX+fcCol*2;

    ctx.font=`${U(9)}px ui-monospace,monospace`;
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
    ctx.font=`${U(14)}px ui-monospace,monospace`;
    ctx.fillStyle=rdValCol;            ctx.fillText(brg,   fcX, rdY+U(16));
    ctx.fillStyle=hasRange?rdValCol:rdDimCol; ctx.fillText(rng,fc2,rdY+U(16));
    // INT BRG colour: navy=range+lead, amber=bearing-only, dim=no target
    ctx.fillStyle=tdc.target&&hasRange?'#1e3a5f':tdc.target?'#92400e':rdValCol;
    ctx.fillText(intBrg,fc3,rdY+U(16));

    // Row 2: DEP | CRS | SPD
    const rdY2=rdY+U(30);
    ctx.font=`${U(9)}px ui-monospace,monospace`;
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
    ctx.font=`${U(14)}px ui-monospace,monospace`;
    ctx.fillStyle=rdValCol;                    ctx.fillText(dep,fcX,rdY2+U(16));
    ctx.fillStyle=hasRange?rdValCol:rdDimCol;  ctx.fillText(crs,fc2,rdY2+U(16));
    ctx.fillStyle=hasRange?rdValCol:rdDimCol;  ctx.fillText(spd,fc3,rdY2+U(16));

    // ── WEPS firing solution proposal ─────────────────────────────────────────
    {
      const wp=game.wepsProposal;
      const rdY3=rdY2+U(28);
      ctx.font=`${U(9)}px ui-monospace,monospace`;
      ctx.fillStyle='rgba(17,24,39,0.38)';
      ctx.textAlign='left';
      ctx.fillText('WEPS SOLUTION',fcX,rdY3);

      if(wp){
        const wBrg=(((Math.atan2(Math.cos(wp.bearing),-Math.sin(wp.bearing))*180/Math.PI)+360)%360).toFixed(0).padStart(3,'0')+'°';
        const wDep=Math.round(wp.depth||player.depth)+'m';
        const confCol=wp.confidence==='solid'?'#1e3a5f':wp.confidence==='degraded'?'#92400e':'rgba(17,24,39,0.40)';
        const confLabel=wp.confidence==='solid'?'SOLID':wp.confidence==='degraded'?'DEGRADED':'POOR — BUILD TMA';
        // Proposed bearing — large, coloured by confidence
        ctx.font=`bold ${U(14)}px ui-monospace,monospace`;
        ctx.fillStyle=confCol;
        ctx.fillText(wBrg,fcX,rdY3+U(16));
        // Confidence badge
        ctx.font=`${U(8)}px ui-monospace,monospace`;
        ctx.fillText(confLabel, fcX+U(40), rdY3+U(10));
        ctx.fillStyle='rgba(17,24,39,0.50)';
        ctx.fillText(wDep, fcX+U(40), rdY3+U(20));
        // SHOOT button — green if solid, amber if degraded, dim if bearing-only
        const canShoot = wp.confidence==='solid'||wp.confidence==='degraded'; // bearingonly blocks SHOOT
        const shootCol=wp.confidence==='solid'?'rgba(22,100,60,0.85)':wp.confidence==='degraded'?'rgba(130,60,10,0.80)':'rgba(60,60,60,0.28)';
        btn('SHOOT',fcX+fcW*0.55,rdY3+U(2),fcW*0.42,U(20),false,
          ()=>{ if(canShoot) PANEL.wepsShoot(); else window.G.addLog('WEPS','Solution too poor — build TMA first'); },
          shootCol);
      } else {
        ctx.font=`${U(9.5)}px ui-monospace,monospace`;
        ctx.fillStyle='rgba(17,24,39,0.20)';
        ctx.fillText('NO TARGET DESIGNATED',fcX,rdY3+U(14));
      }
    }

    // ── ASCM solution panel ───────────────────────────────────────────────────
    {
      const asc=game.ascmSolution;
      const rdY4=panelY+U(138);  // below WEPS solution (rdY3=panelY+U(110) + ~U(28))
      const hasMissile=(player.missileStock||0)>0||(player.tubeLoad||[]).some(l=>l&&l!=='torp');
      // True only when a missile is sitting in a ready tube
      const tubeLoad=player.tubeLoad||[];
      const torpTubes=player.torpTubes||[];
      const hasMissileTubeReady=tubeLoad.some((l,i)=>l&&l!=='torp'&&torpTubes[i]===0);

      ctx.font=`${U(9)}px ui-monospace,monospace`;
      ctx.fillStyle='rgba(17,24,39,0.38)';
      ctx.textAlign='left';
      ctx.fillText('ASCM',fcX,rdY4);

      if(asc && hasMissileTubeReady){
        // FIRE button — right side of header row
        const fireBtnW=U(38), fireBtnH=U(13);
        const fireBtnX=fcX+fcW-fireBtnW;
        const fireBtnY=rdY4-U(11);
        PANEL.btn2(ctx,'FIRE',fireBtnX,fireBtnY,fireBtnW,fireBtnH,'rgba(140,20,20,0.70)',()=>window._fireMissile?.());
      } else if(hasMissile){
        ctx.fillStyle=asc?'rgba(120,50,160,0.70)':'rgba(17,24,39,0.20)';
        ctx.font=`${U(8)}px ui-monospace,monospace`;
        ctx.textAlign='right';
        ctx.fillText(asc?asc.source:'NO SOLUTION',fcX+fcW-U(4),rdY4);
      } else {
        ctx.fillStyle='rgba(17,24,39,0.20)';
        ctx.font=`${U(8)}px ui-monospace,monospace`;
        ctx.textAlign='right';
        ctx.fillText('NO MISSILE LOADED',fcX+fcW-U(4),rdY4);
      }

      if(asc){
        // Quality bar
        const aqBarW=fcW-U(4), aqBarH=U(4), aqBarY=rdY4+U(3);
        ctx.fillStyle='rgba(17,24,39,0.07)';
        ctx.fillRect(fcX,aqBarY,aqBarW,aqBarH);
        const aqFill=aqBarW*clamp(asc.quality,0,1);
        const aqCol=asc.quality>=0.6?'rgba(120,40,160,0.65)':asc.quality>=0.4?'rgba(100,30,120,0.55)':'rgba(80,20,100,0.45)';
        ctx.fillStyle=aqCol;
        ctx.fillRect(fcX,aqBarY,aqFill,aqBarH);

        // BRG + RNG readouts
        const aHalf=fcW/2;
        const aValY=rdY4+U(20);
        ctx.font=`${U(9)}px ui-monospace,monospace`;
        ctx.fillStyle='rgba(17,24,39,0.38)'; ctx.textAlign='left';
        ctx.fillText('BRG',fcX,rdY4+U(10));
        ctx.fillText('RNG',fcX+aHalf,rdY4+U(10));
        const aBrg=asc.bearing!=null?Math.round(asc.bearing).toString().padStart(3,'0')+'°':'---';
        const aRng=asc.range!=null?((asc.range/185.2).toFixed(1)+'nm~'):'---';
        ctx.font=`${U(14)}px ui-monospace,monospace`;
        ctx.fillStyle='rgba(120,50,160,0.90)';
        ctx.fillText(aBrg,fcX,aValY);
        ctx.fillStyle=asc.range?'rgba(120,50,160,0.90)':'rgba(17,24,39,0.25)';
        ctx.fillText(aRng,fcX+aHalf,aValY);

        // Acquisition confidence label
        const aq=asc.quality;
        const acqLabel=aq>=0.80?'SOLID — HIGH CONFIDENCE':aq>=0.60?'GOOD — LIKELY ACQUIRE':aq>=0.40?'MARGINAL — POSSIBLE MISS':aq>=0.20?'POOR — HIGH MISS RISK':'NO SOLUTION';
        const acqCol=aq>=0.60?'rgba(120,50,160,0.80)':aq>=0.40?'rgba(146,64,14,0.80)':'rgba(100,100,100,0.60)';
        ctx.font=`${U(7.5)}px ui-monospace,monospace`;
        ctx.fillStyle=acqCol; ctx.textAlign='left';
        ctx.fillText(acqLabel,fcX,rdY4+U(27));

        // Contact label
        ctx.font=`${U(7.5)}px ui-monospace,monospace`;
        ctx.fillStyle='rgba(17,24,39,0.38)';
        ctx.fillText(asc.contactId,fcX+U(1),rdY4+U(35));

        // Stadimeter button — visible only at periscope depth
        const atPD=player.depth<=(C.player.periscopeDepth||18)+4;
        if(atPD){
          const stadBtnY=rdY4+U(38);
          const stadBtnW=fcW-U(4);
          const stadBtnH=U(12);
          const stadRunning=(player.stadimeterT||0)>0;
          if(stadRunning){
            const prog=clamp(1-(player.stadimeterT/4.0),0,1);
            ctx.fillStyle='rgba(17,24,39,0.12)';
            ctx.fillRect(fcX,stadBtnY,stadBtnW,stadBtnH);
            ctx.fillStyle='rgba(120,50,160,0.45)';
            ctx.fillRect(fcX,stadBtnY,stadBtnW*prog,stadBtnH);
            ctx.font=`${U(7)}px ui-monospace,monospace`;
            ctx.fillStyle='rgba(200,180,220,0.90)';
            ctx.textAlign='center';
            ctx.fillText(`OBSERVING ${Math.ceil(player.stadimeterT)}s`,fcX+stadBtnW/2,stadBtnY+U(8.5));
          } else {
            PANEL.btn2(ctx,'STADIMETER',fcX,stadBtnY,stadBtnW,stadBtnH,'rgba(70,30,100,0.55)',()=>window._stadimeterStart?.());
          }
        }
      } else {
        ctx.font=`${U(8.5)}px ui-monospace,monospace`;
        ctx.fillStyle='rgba(17,24,39,0.18)';
        ctx.textAlign='left';
        ctx.fillText('NO SURFACE CONTACT',fcX,rdY4+U(18));
        ctx.font=`${U(7.5)}px ui-monospace,monospace`;
        ctx.fillStyle='rgba(17,24,39,0.15)';
        ctx.fillText('QUALITY \u2265 20% REQUIRED',fcX,rdY4+U(28));
      }
    }

    // Thin vertical divider between fire control and contact list
    const divX=fcX+fcW+pad*0.5;
    ctx.strokeStyle='rgba(17,24,39,0.10)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(divX,panelY+U(8)); ctx.lineTo(divX,panelY+panelH-U(6)); ctx.stroke();

    // ── PLANES / BUBBLE panel — carved from left of contacts column ───────────
    const planesSecW = U(142);
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
      ctx.fillStyle=TH.color.header;
      ctx.font=`${U(TH.font.header)}px ${TH.FONT_FAMILY}`; ctx.textAlign='left';
      ctx.fillText('PLANES',px,panelY+U(18));

      // ── Bubble inclinometer ───────────────────────────────────────────────
      const tubeW=pw-U(4), tubeH=U(18);
      const tubeX=px, tubeY=panelY+U(24);
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
        const ty1=tubeY+(isCentre?U(2):U(4));
        const ty2=tubeY+tubeH-(isCentre?U(2):U(4));
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
      ctx.font=`${U(7)}px ui-monospace,monospace`; ctx.textAlign='center';
      ctx.fillText('STEADY BUBBLE',tubeMid,tubeY+tubeH+U(9));

      // ── Plane state rows ──────────────────────────────────────────────────
      const rowY0=panelY+U(62);
      const rowH =U(19);
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
        const ry=rowY0+i*(rowH+U(4));
        const bg=modeColour[mode]||modeColour.hydraulic;
        // Row bg
        ctx.fillStyle='rgba(6,14,30,0.60)';
        ctx.beginPath(); ctx.roundRect(px,ry,pw-U(2),rowH,2); ctx.fill();
        // Mode colour strip on left
        ctx.fillStyle=bg;
        ctx.beginPath(); ctx.roundRect(px,ry,U(4),rowH,2); ctx.fill();
        // Label
        ctx.fillStyle='rgba(148,163,184,0.80)';
        ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.textAlign='left';
        ctx.fillText(label,px+U(8),ry+rowH*0.65);
        // Mode badge
        ctx.fillStyle=mode==='hydraulic'?'rgba(30,130,220,0.70)':mode==='air_emergency'?'rgba(220,140,0,0.85)':'rgba(200,30,30,0.85)';
        const badgeW=U(52);
        ctx.beginPath(); ctx.roundRect(px+pw-badgeW-U(4),ry+U(2),badgeW,rowH-U(4),2); ctx.fill();
        ctx.fillStyle='#f0ece0';
        ctx.font=`bold ${U(8)}px ui-monospace,monospace`; ctx.textAlign='center';
        ctx.fillText(modeTxt[mode]||mode.toUpperCase(),px+pw-badgeW*0.5-U(4),ry+rowH*0.68);
        // Angle readout
        const dirStr=angle>0.3?'↑':angle<-0.3?'↓':'—';
        ctx.fillStyle='rgba(148,163,184,0.55)';
        ctx.font=`${U(8)}px ui-monospace,monospace`; ctx.textAlign='right';
        ctx.fillText(`${dirStr}${Math.abs(angle).toFixed(1)}°`,px+pw-badgeW-U(8),ry+rowH*0.65);
      }

      // Thin right-border divider
      ctx.strokeStyle='rgba(17,24,39,0.15)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(px+pw,panelY+U(8)); ctx.lineTo(px+pw,panelY+panelH-U(6)); ctx.stroke();
    }

    // ── RIGHT: Contact Quality List ───────────────────────────────────────────
    const cqX=planesSecX+planesSecW+pad*0.5;
    const cqW=x+w-cqX-pad;

    ctx.fillStyle=TH.color.header;
    ctx.font=`${U(TH.font.header)}px ${TH.FONT_FAMILY}`;
    ctx.textAlign='left';
    ctx.fillText('CONTACTS',cqX,panelY+U(18));

    // Column headers
    const cqNow=performance.now()/1000;
    const idColW=U(30), brgColW=U(32), barColW=Math.max(U(60), cqW-idColW-brgColW-U(56));
    const obsColW=U(22), ageColW=U(28);
    const hdrY=panelY+U(30);
    ctx.font=`${U(TH.font.header)}px ${TH.FONT_FAMILY}`;
    ctx.fillStyle=TH.color.header;
    ctx.fillText('ID',   cqX,                               hdrY);
    ctx.fillText('BRG',  cqX+idColW,                        hdrY);
    ctx.fillText('SOLUTION',cqX+idColW+brgColW,             hdrY);
    ctx.fillText('OBS',  cqX+idColW+brgColW+barColW,        hdrY);
    ctx.fillText('AGE',  cqX+idColW+brgColW+barColW+obsColW,hdrY);

    // PURGE DEAD button — top-right of contacts header
    const hasDeadContacts=[...sonarContacts.values()].some(s=>s.dead)||[...sonarContacts.keys()].some(e=>e.dead);
    if(hasDeadContacts){
      btn('PURGE DEAD', cqX+cqW-U(62), panelY+U(22), U(62), U(14), false, ()=>{
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

    const rowH=U(23);
    const rowsVisible=Math.floor((panelH-U(50))/rowH);
    const maxScroll=Math.max(0,allContacts.length-rowsVisible);
    // Clamp scroll offset
    game.contactsScroll=Math.max(0,Math.min(maxScroll,game.contactsScroll||0));
    const startRow=game.contactsScroll;

    // Scroll indicator arrows — only if list overflows
    if(allContacts.length>rowsVisible){
      const arrowX=cqX+cqW-U(14);
      const canUp=startRow>0, canDown=startRow<maxScroll;
      ctx.font=`${U(10)}px ui-monospace,monospace`;
      ctx.textAlign='center';
      ctx.fillStyle=canUp?'rgba(17,24,39,0.55)':'rgba(17,24,39,0.15)';
      ctx.fillText('▲', arrowX, panelY+U(30));
      ctx.fillStyle=canDown?'rgba(17,24,39,0.55)':'rgba(17,24,39,0.15)';
      ctx.fillText('▼', arrowX, panelY+panelH-U(12));
      // Register arrow buttons
      btn('▲',arrowX-U(7),panelY+U(20),U(14),U(12),false,
        ()=>{ game.contactsScroll=Math.max(0,(game.contactsScroll||0)-1); },
        'transparent','transparent');
      btn('▼',arrowX-U(7),panelY+panelH-U(22),U(14),U(12),false,
        ()=>{ game.contactsScroll=Math.min(maxScroll,(game.contactsScroll||0)+1); },
        'transparent','transparent');
      // Scrollbar track
      const trackH=(panelH-U(44));
      const trackY=panelY+U(32);
      const trackX=arrowX-U(3);
      ctx.fillStyle='rgba(17,24,39,0.06)';
      ctx.fillRect(trackX,trackY,U(4),trackH);
      // Thumb
      const thumbH=Math.max(U(16),trackH*(rowsVisible/allContacts.length));
      const thumbY=trackY+(trackH-thumbH)*(startRow/maxScroll||0);
      ctx.fillStyle='rgba(17,24,39,0.22)';
      ctx.beginPath();
      ctx.roundRect(trackX,thumbY,U(4),thumbH,U(2));
      ctx.fill();
    }

    // Clip rows to panel area
    ctx.save();
    ctx.beginPath();
    ctx.rect(cqX-U(2), panelY+U(36), cqW-U(10), panelH-U(38));
    ctx.clip();

    for(let i=startRow;i<Math.min(startRow+rowsVisible,allContacts.length);i++){
      const entry=allContacts[i];
      const ry=panelY+U(48)+(i-startRow)*rowH;
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
        ctx.fillRect(cqX-U(2), ry-rowH*0.78, cqW+U(2), rowH);
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
      ctx.font=`bold ${U(9)}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillText(entry.id+(isDead?' ✕':''), cqX, ry);

      if(!entry.isTorp && sc){
        // BRG
        const brgDeg=latestBrg!=null?((latestBrg*180/Math.PI)+360)%360:null;
        ctx.fillStyle=`rgba(17,24,39,${rowAlpha*0.85})`;
        ctx.font=`${U(9.5)}px ui-monospace,monospace`;
        ctx.fillText(brgDeg!=null?Math.round(brgDeg).toString().padStart(3,'0')+'°':'---',
                     cqX+idColW, ry);

        // TMA quality bar — or DESTROYED for dead contacts, CONTACT LOST for lost contacts
        const barX=cqX+idColW+brgColW;
        const barH=U(7);
        const barY=ry-barH-U(1);
        if(isDead){
          ctx.fillStyle=`rgba(150,20,20,0.12)`;
          ctx.fillRect(barX,barY,barColW,barH);
          ctx.font=`${U(8)}px ui-monospace,monospace`;
          ctx.fillStyle=`rgba(150,20,20,0.55)`;
          ctx.textAlign='left';
          ctx.fillText('DESTROYED — LAST KNOWN', barX+U(2), ry-U(3));
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
          ctx.font=`${U(5.5)}px ui-monospace,monospace`;
          ctx.fillStyle=`rgba(17,24,39,${rowAlpha*0.65})`;
          ctx.textAlign='left';
          const qStr=q>=0.6?'SOLID':q>=0.2?'BUILDING':'BEARING ONLY';
          ctx.fillText(qStr, barX+U(2), ry-U(3));
          ctx.fillStyle=`rgba(17,24,39,${rowAlpha*0.70})`;
          ctx.font=`${U(9)}px ui-monospace,monospace`;
          ctx.textAlign='right';
          ctx.fillText(obsCount, cqX+idColW+brgColW+barColW+obsColW-U(2), ry);
          const ageStr=age<60?Math.round(age)+'s':Math.floor(age/60)+'m'+Math.floor(age%60).toString().padStart(2,'0')+'s';
          ctx.fillStyle=`rgba(17,24,39,${rowAlpha*0.55})`;
          ctx.font=`${U(11)}px ui-monospace,monospace`;
          ctx.textAlign='right';
          ctx.fillText(ageStr, cqX+idColW+brgColW+barColW+obsColW+ageColW, ry);
        }
      } else if(entry.isTorp){
        // Enemy torpedo — show bearing
        const dx=AI.wrapDx(player.wx,entry.ref.x), dy=entry.ref.y-player.wy;
        const tb=((Math.atan2(dy,dx)*180/Math.PI)+360)%360;
        ctx.fillStyle=`rgba(100,30,200,${rowAlpha*0.75})`;
        ctx.font=`${U(9.5)}px ui-monospace,monospace`;
        ctx.textAlign='left';
        ctx.fillText(Math.round(tb).toString().padStart(3,'0')+'°', cqX+idColW, ry);
        ctx.font=`${U(11)}px ui-monospace,monospace`;
        ctx.fillText('INBOUND', cqX+idColW+brgColW+U(2), ry);
      }

      ctx.textAlign='left';
    }

    ctx.restore(); // end clip

    // Empty state
    if(allContacts.length===0){
      ctx.fillStyle='rgba(17,24,39,0.22)';
      ctx.font=`${U(9.5)}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillText('No contacts',cqX,panelY+U(52));
    }
    }

    // ── Flex layout engine ──────────────────────────────────────────────────────
    // Each section has min/pref/max widths (design px, scaled by U()).
    // TDC (last) is flex-fill — it gets all remaining space.
    const sections = [
      { draw: drawEngineSection,    min: 130, pref: 160, max: 175 },
      { draw: drawDepthSection,     min: 100, pref: 130, max: 145 },
      { draw: drawTrimSection,      min: 170, pref: 215, max: 250 },
      { draw: drawStatusSection,    min: 120, pref: 165, max: 185 },
      { draw: drawPostureSection,   min:  95, pref: 120, max: 135 },
      { draw: drawEmergencySection, min: 105, pref: 140, max: 155 },
      { draw: drawWeaponsSection,   min: 125, pref: 155, max: 175 },
      { draw: drawMastSection,      min: 120, pref: 150, max: 165 },
      { draw: drawWireSection,      min: 145, pref: 185, max: 210 },
      ...( (C.player.vlsCells||0) > 0 ? [{ draw: drawVlsSection, min: 105, pref: 135, max: 155 }] : [] ),
      { draw: drawTdcSection,       min: 220, pref: 999, max: 999, fill: true },
    ];

    // Step 1: Start everyone at min
    const gaps = sections.length * pad + pad; // pad on each side + between
    const widths = sections.map(s => U(s.min));
    let used = widths.reduce((a, b) => a + b, 0) + gaps;

    // Step 2: Distribute surplus up to pref
    let surplus = panelW - used;
    if (surplus > 0) {
      const wants = sections.map((s, i) => Math.max(0, U(s.pref) - widths[i]));
      const totalWant = wants.reduce((a, b) => a + b, 0);
      if (totalWant > 0) {
        const give = Math.min(surplus, totalWant);
        for (let i = 0; i < sections.length; i++) {
          const share = Math.round(give * wants[i] / totalWant);
          widths[i] += share;
        }
        used = widths.reduce((a, b) => a + b, 0) + gaps;
        surplus = panelW - used;
      }
    }

    // Step 3: Distribute remaining surplus up to max
    if (surplus > 0) {
      const wants = sections.map((s, i) => Math.max(0, U(s.max) - widths[i]));
      const totalWant = wants.reduce((a, b) => a + b, 0);
      if (totalWant > 0) {
        const give = Math.min(surplus, totalWant);
        for (let i = 0; i < sections.length; i++) {
          const share = Math.round(give * wants[i] / totalWant);
          widths[i] += share;
        }
        used = widths.reduce((a, b) => a + b, 0) + gaps;
        surplus = panelW - used;
      }
    }

    // Step 4: Any leftover goes to fill section (TDC)
    if (surplus > 0) {
      const fillIdx = sections.findIndex(s => s.fill);
      if (fillIdx >= 0) widths[fillIdx] += surplus;
    }

    // Step 5: Draw sections at computed positions
    let cx = pad;
    for (let i = 0; i < sections.length; i++) {
      sections[i].draw(cx, widths[i]);
      if (i < sections.length - 1) sectionDivider(cx + widths[i]);
      cx += widths[i] + pad;
    }

    // ── Message strip ─────────────────────────────────────────────────────────
    if(game.msgT>0){
      ctx.fillStyle=`rgba(17,24,39,${Math.min(1,game.msgT*1.4)})`;
      ctx.font=`${U(11)}px ui-monospace,monospace`;
      ctx.textAlign='center';
      ctx.fillText(game.msg,panelW/2,panelY-U(8));
    }

    // ── SCRAM status badge ────────────────────────────────────────────────────
    if(player.scram && !C.player.isDiesel){
      const pulse=0.55+0.45*Math.sin(performance.now()*0.006);
      const restartPct = 1-(player.scramT/75);
      // Red warning badge
      ctx.fillStyle=`rgba(180,20,20,${0.82*pulse})`;
      const bw=U(160), bh=U(22);
      const bx=(panelW-bw)/2, by=panelY-U(36);
      ctx.beginPath(); ctx.roundRect(bx,by,bw,bh,U(4)); ctx.fill();
      ctx.fillStyle=`rgba(255,200,200,${0.95*pulse})`;
      ctx.font=`bold ${U(9)}px ui-monospace,monospace`;
      ctx.textAlign='center';
      const epmStr=player.scramEPM?'EPM':'...';
      ctx.fillText(`⚡ REACTOR SCRAM — ${epmStr}  ${Math.round(restartPct*100)}%`,panelW/2,by+bh*0.70);
    }

  }

  // ── End screens (game over / victory) — full canvas, no game underneath ──────
  function drawEndScreen(W,H){
    const cx=W/2;

    if(game.over){
      const dmg=player.damage;
      const DMG=window.DMG;
      const escaped=game.escapeResolved&&dmg?.escapeState==='complete';

      ctx.fillStyle='rgba(4,8,18,0.98)';
      ctx.fillRect(0,0,W,H);

      let ty=H*0.12;

      if(escaped){
        const type=dmg.escapeType;
        const survived=dmg.escapeSurvivors;
        const total=DMG.totalCrew();
        const playerOut=dmg.escapePlayerSurvived;
        const depth=dmg.escapeDepthM;

        ctx.textAlign='center';
        if(playerOut){
          ctx.fillStyle='rgba(160,200,240,0.90)';
          ctx.font=`bold ${U(32)}px ui-monospace,monospace`;
          ctx.fillText(type==='tce'?'TOWER ESCAPE':'RUSH ESCAPE',cx,ty+U(24));
        } else {
          ctx.fillStyle='rgba(180,60,60,0.90)';
          ctx.font=`bold ${U(32)}px ui-monospace,monospace`;
          ctx.fillText('LOST WITH THE BOAT',cx,ty+U(24));
        }

        ty+=U(38);
        ctx.fillStyle='rgba(100,130,180,0.55)';
        ctx.font=`${U(10)}px ui-monospace,monospace`;
        ctx.fillText(`──────────────────────────────────────────────────`,cx,ty);

        ty+=U(16);
        ctx.fillStyle='rgba(180,200,240,0.70)';
        ctx.font=`${U(11)}px ui-monospace,monospace`;
        ctx.fillText(`DEPTH AT ESCAPE: ${depth}m   |   SCORE: ${game.score}`,cx,ty);

        ty+=U(22);
        const survPct=total>0?Math.round(survived/total*100):0;
        const survCol=survPct>=70?'rgba(60,200,100,0.90)':survPct>=40?'rgba(220,180,30,0.90)':'rgba(220,60,60,0.90)';
        ctx.fillStyle=survCol;
        ctx.font=`bold ${U(26)}px ui-monospace,monospace`;
        ctx.fillText(`${survived} OF ${total}`,cx,ty);
        ty+=U(18);
        ctx.fillStyle='rgba(140,170,220,0.60)';
        ctx.font=`${U(9)}px ui-monospace,monospace`;
        ctx.fillText('crew reached the surface',cx,ty);

        ty+=U(20);
        ctx.fillStyle='rgba(100,130,180,0.45)';
        ctx.font=`${U(8)}px ui-monospace,monospace`;
        ctx.fillText(`──────────────────────────────────────────────────`,cx,ty);
        ty+=U(12);

        const COMP_KEYS=DMG.COMPS;
        const COMP_LABELS=['TORP RM','CONTROL','AUX MCH',C.player.isDiesel?'ENG CM':'REACTOR',C.player.isDiesel?'MOTOR RM':'MANEUVR','ENGINRG'];
        const colW=(W*0.7)/6;
        const colStartX=cx-W*0.35+colW/2;
        for(let ci=0;ci<6;ci++){
          const comp=COMP_KEYS[ci];
          const list=dmg.crew[comp]||[];
          const cfit=list.filter(c=>c.status==='fit').length;
          const ckia=list.filter(c=>c.status==='killed').length;
          const cx2=colStartX+ci*colW;
          ctx.fillStyle='rgba(140,170,220,0.55)'; ctx.font=`bold ${U(7.5)}px ui-monospace,monospace`;
          ctx.fillText(COMP_LABELS[ci],cx2,ty);
          ctx.fillStyle=dmg.flooded[comp]?'rgba(100,140,255,0.80)':'rgba(80,200,100,0.75)';
          ctx.font=`${U(7)}px ui-monospace,monospace`;
          ctx.fillText(dmg.flooded[comp]?'FLOODED':`${cfit} surv`,cx2,ty+U(10));
          ctx.fillStyle='rgba(200,70,70,0.70)';
          ctx.fillText(`${ckia} lost`,cx2,ty+U(19));
        }

        ty+=U(36);
        ctx.fillStyle='rgba(100,130,180,0.45)';
        ctx.font=`${U(8)}px ui-monospace,monospace`;
        ctx.fillText(`──────────────────────────────────────────────────`,cx,ty);
        ty+=U(12);

        const allCrew=COMP_KEYS.flatMap(c=>(dmg.crew[c]||[]));
        const co=allCrew.find(c=>c.rating==='CDR');
        if(co){
          ctx.fillStyle=co.status==='killed'?'rgba(200,70,70,0.80)':'rgba(80,200,100,0.75)';
          ctx.font=`${U(8)}px ui-monospace,monospace`;
          ctx.fillText(`${co.name} — ${co.status==='killed'?'LOST':'SURVIVED'}`,cx,ty);
          ty+=U(12);
        }
        const officers=allCrew.filter(c=>['LCDR','LT','WO'].includes(c.rating));
        const casualties=officers.filter(c=>c.status==='killed').slice(0,4);
        const survivors2=officers.filter(c=>c.status!=='killed').slice(0,4);
        for(const c of casualties){
          ctx.fillStyle='rgba(190,65,65,0.70)'; ctx.font=`${U(7.5)}px ui-monospace,monospace`;
          ctx.fillText(`${c.name} — LOST`,cx,ty); ty+=U(10);
        }
        for(const c of survivors2){
          ctx.fillStyle='rgba(70,170,90,0.65)'; ctx.font=`${U(7.5)}px ui-monospace,monospace`;
          ctx.fillText(`${c.name} — SURVIVED`,cx,ty); ty+=U(10);
        }

      } else {
        const crushed = game.overCause==='crush';
        ctx.fillStyle='rgba(200,60,60,0.90)';
        ctx.font=`bold ${U(44)}px ui-monospace,monospace`;
        ctx.textAlign='center';
        ctx.fillText(crushed?'HULL FAILURE':'SUNK',cx,H*0.45);
        ctx.fillStyle='rgba(140,160,200,0.60)';
        ctx.font=`${U(12)}px ui-monospace,monospace`;
        ctx.fillText(crushed?`Crush depth exceeded — ${Math.round(player.depth)}m`:'No escape initiated',cx,H*0.45+U(22));
        ctx.fillStyle='rgba(140,160,200,0.55)';
        ctx.font=`${U(10)}px ui-monospace,monospace`;
        ctx.fillText(`All hands lost   |   SCORE: ${game.score}`,cx,H*0.45+U(40));
      }

      ctx.fillStyle='rgba(100,130,180,0.45)';
      ctx.font=`${U(9)}px ui-monospace,monospace`;
      ctx.textAlign='center';
      ctx.fillText('R — new game',cx,H-U(20));
    }

    if(game.won && !game.over){
      const SCENARIO_NAMES={
        duel:'1V1 DUEL', ambush:'AMBUSH', patrol:'BARRIER TRANSIT',
        ssbn_hunt:'SSBN HUNT', boss_fight:'BOSS FIGHT', asw_taskforce:'ASW TASKFORCE',
      };
      const SCENARIO_FLAVOUR={
        duel:'Enemy submarine destroyed.',
        ambush:'All hostiles neutralised. You survived the ambush.',
        patrol:'Barrier patrol eliminated. Transit route is clear.',
        ssbn_hunt:'SSBN destroyed. Strategic mission complete.',
        boss_fight:'Zeta-class confirmed destroyed.',
        asw_taskforce:'ASW taskforce neutralised. Surface threat eliminated.',
      };

      ctx.fillStyle='rgba(4,8,18,0.98)';
      ctx.fillRect(0,0,W,H);

      let ty=H*0.10;

      ctx.textAlign='center';
      ctx.fillStyle='rgba(80,220,130,0.90)';
      ctx.font=`bold ${U(36)}px ui-monospace,monospace`;
      ctx.fillText('MISSION COMPLETE',cx,ty+U(28));

      ty+=U(42);
      ctx.fillStyle='rgba(80,180,120,0.40)';
      ctx.font=`${U(10)}px ui-monospace,monospace`;
      ctx.fillText('──────────────────────────────────────────────────',cx,ty);

      ty+=U(18);
      ctx.fillStyle='rgba(160,220,180,0.80)';
      ctx.font=`bold ${U(14)}px ui-monospace,monospace`;
      ctx.fillText(SCENARIO_NAMES[game.scenario]||game.scenario.toUpperCase(),cx,ty);

      ty+=U(16);
      ctx.fillStyle='rgba(140,180,170,0.60)';
      ctx.font=`${U(9)}px ui-monospace,monospace`;
      ctx.fillText(SCENARIO_FLAVOUR[game.scenario]||'All enemies destroyed.',cx,ty);

      ty+=U(16);
      ctx.fillStyle='rgba(80,180,120,0.30)';
      ctx.font=`${U(10)}px ui-monospace,monospace`;
      ctx.fillText('──────────────────────────────────────────────────',cx,ty);

      ty+=U(22);
      const mT=game.missionT||0;
      const mins=Math.floor(mT/60);
      const secs=Math.floor(mT%60);
      const timeStr=`${mins}:${secs.toString().padStart(2,'0')}`;
      const killed=game._enemiesKilled||0;
      const DMG=window.DMG;
      const totalCrew=DMG?DMG.totalCrew():0;
      const totalKilled=DMG?DMG.totalKilled():0;
      const crewAlive=totalCrew-totalKilled;

      const stats=[
        ['MISSION TIME', timeStr],
        ['ENEMIES DESTROYED', `${killed}`],
        ['CREW SURVIVING', `${crewAlive} / ${totalCrew}`],
        ['FINAL SCORE', `${game.score}`],
      ];

      const statH=U(20);
      const statW=W*0.50;
      for(const [label,val] of stats){
        ctx.fillStyle='rgba(140,180,200,0.55)';
        ctx.font=`${U(9)}px ui-monospace,monospace`;
        ctx.textAlign='left';
        ctx.fillText(label,cx-statW/2,ty);
        ctx.fillStyle='rgba(80,220,140,0.85)';
        ctx.font=`bold ${U(10)}px ui-monospace,monospace`;
        ctx.textAlign='right';
        ctx.fillText(val,cx+statW/2,ty);
        ty+=statH;
      }

      ty+=U(6);
      ctx.fillStyle='rgba(80,180,120,0.30)';
      ctx.font=`${U(10)}px ui-monospace,monospace`;
      ctx.textAlign='center';
      ctx.fillText('──────────────────────────────────────────────────',cx,ty);

      ty+=U(18);
      const scorePct=crewAlive>0&&totalCrew>0?Math.round(crewAlive/totalCrew*100):0;
      const crewCol=scorePct>=90?'rgba(80,220,130,0.90)':scorePct>=60?'rgba(220,200,40,0.90)':'rgba(220,100,60,0.90)';
      ctx.fillStyle=crewCol;
      ctx.font=`bold ${U(22)}px ui-monospace,monospace`;
      ctx.fillText(`${scorePct}%`,cx,ty);
      ty+=U(14);
      ctx.fillStyle='rgba(140,180,170,0.50)';
      ctx.font=`${U(8)}px ui-monospace,monospace`;
      ctx.fillText('crew survival rate',cx,ty);

      ctx.fillStyle='rgba(80,180,120,0.45)';
      ctx.font=`${U(9)}px ui-monospace,monospace`;
      ctx.textAlign='center';
      ctx.fillText('R — new game',cx,H-U(20));
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
    const P=U(10);
    const HDR_H=U(44);
    const LW=W;  // full width — crew panel is below, not beside
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
    ctx.font=`bold ${U(14)}px ui-monospace,monospace`;
    ctx.textAlign='left';
    ctx.fillText('DAMAGE CONTROL',P,HDR_H*0.72);

    // Watch pill
    const fatigue=game.watchFatigue||0;
    const changing=game.watchChanging||false;
    const changeT=game.watchChangeT||0;
    const watchLabel=changing?`WATCH ${activeWatch} → ${activeWatch==='A'?'B':'A'}`:`WATCH ${activeWatch} ON`;
    const watchBg=changing?'rgba(80,60,10,0.75)':activeWatch==='A'?'rgba(30,70,150,0.75)':'rgba(10,100,90,0.75)';
    const watchFg=changing?'rgba(255,200,60,0.95)':activeWatch==='A'?'rgba(140,190,255,0.95)':'rgba(80,220,200,0.95)';
    const wPillX=W/2-U(180);
    ctx.fillStyle=watchBg;
    ctx.beginPath(); ctx.roundRect(wPillX,U(6),U(108),U(22),U(3)); ctx.fill();
    ctx.fillStyle=watchFg;
    ctx.font=`bold ${U(10)}px ui-monospace,monospace`;
    ctx.textAlign='center';
    ctx.fillText(watchLabel,wPillX+U(54),U(21));

    // Fatigue bar
    const fbX=wPillX+U(114),fbY=U(6),fbW=U(130),fbH=U(22);
    ctx.fillStyle='rgba(20,30,50,0.70)';
    ctx.beginPath(); ctx.roundRect(fbX,fbY,fbW,fbH,U(2)); ctx.fill();
    const fatigueCol=fatigue>=0.8?'rgba(210,60,40,0.85)':fatigue>=0.5?'rgba(220,160,30,0.85)':'rgba(50,180,80,0.75)';
    if(fatigue>0){
      ctx.fillStyle=fatigueCol;
      ctx.beginPath(); ctx.roundRect(fbX+1,fbY+1,Math.max(U(2),(fbW-2)*fatigue),fbH-2,U(2)); ctx.fill();
    }
    ctx.fillStyle='rgba(140,165,210,0.60)';
    ctx.font=`${U(8)}px ui-monospace,monospace`;
    ctx.textAlign='left'; ctx.fillText('FATIGUE',fbX+U(3),U(21));
    ctx.textAlign='right'; ctx.fillText(`${Math.round(fatigue*100)}%`,fbX+fbW-U(3),U(21));
    if(changing){
      ctx.fillStyle='rgba(255,200,60,0.80)';
      ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.textAlign='left';
      ctx.fillText(`RELIEVING — ${Math.ceil(changeT)}s`,fbX+fbW+U(6),U(21));
    }

    // RELIEVE WATCH button
    const canRelieve=!changing&&game.tacticalState!=='action'&&game.casualtyState!=='emergency';
    const relBtnX=wPillX+U(254);
    ctx.fillStyle=canRelieve?'rgba(30,60,120,0.75)':'rgba(30,40,60,0.40)';
    ctx.beginPath(); ctx.roundRect(relBtnX,U(6),U(120),U(22),U(3)); ctx.fill();
    ctx.fillStyle=canRelieve?'rgba(140,190,255,0.90)':'rgba(80,100,130,0.50)';
    ctx.font=`bold ${U(9)}px ui-monospace,monospace`; ctx.textAlign='center';
    ctx.fillText(changing?'CHANGING…':'RELIEVE WATCH [W]',relBtnX+U(60),U(21));
    if(canRelieve) PNL.btn2(ctx,'',relBtnX,U(6),U(120),U(22),'transparent',()=>{ window.SIM?.initiateWatchChange?.(); });

    // Close button
    const closeBtnX=W-U(88)-P;
    PNL.btn2(ctx,'[H] CLOSE',closeBtnX,U(6),U(86),U(22),'rgba(30,40,70,0.80)',()=>{ game.showDamageScreen=false; });

    // ──────────────────────────────────────────────────────────────────────────
    // TOP PANEL — damage control (full width)
    // ──────────────────────────────────────────────────────────────────────────
    let cy=BODY_Y+U(10);

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
    ctx.font=`${U(10)}px ui-monospace,monospace`; ctx.textAlign='left';
    ctx.fillText(`WCH ${aw2}  ${wkOnFit} FIT  ${wkOnWnd} WND  /  ${wkOnTotal} ON WATCH`,P,cy);
    ctx.fillStyle='rgba(110,130,170,0.50)'; ctx.textAlign='right';
    ctx.fillText(`SHIP  ${fit} FIT  ${wnd} WND  ${kia} KIA  / ${total}`,LW-P,cy);
    cy+=U(14);

    // Tower status
    const twrCol={nominal:'rgba(22,163,74,0.75)',damaged:'rgba(217,119,6,0.80)',destroyed:'rgba(180,30,30,0.80)'};
    ctx.font=`${U(10)}px ui-monospace,monospace`; ctx.textAlign='left';
    ctx.fillStyle=twrCol[dmg.towers.fwd]; ctx.fillText(`FWD TOWER: ${dmg.towers.fwd.toUpperCase()}`,P,cy);
    ctx.fillStyle=twrCol[dmg.towers.aft]; ctx.textAlign='right'; ctx.fillText(`AFT TOWER: ${dmg.towers.aft.toUpperCase()}`,LW-P,cy);
    cy+=U(10);

    // DC Teams status bar
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
      const taskStr=team.state==='lost'?'— LOST':team.state==='mustering'?`MUSTER → ${DMG.SECTION_LABEL?.[team.destination]||'?'} (${Math.ceil(team.musterT||0)}s)`:team.state==='blowing'?`HP BLOW — ${DMG.ROOMS[team.location]?.label||'?'}`:team.state==='transit'?`→ ${DMG.SECTION_LABEL?.[team.destination]||'?'} (${Math.ceil(team.transitEta)}s)`:team.state==='on_scene'&&team.task==='fire'?`FIRE — ${DMG.ROOMS[team.location]?.label||'?'}`:team.state==='on_scene'&&team.task==='flood'?`FLOOD — ${DMG.ROOMS[team.location]?.label||'?'}`:team.state==='on_scene'&&team.task==='repair'?`REPAIR — ${DMG.SYS_LABEL[team.repairTarget]||'?'}`:team.state==='on_scene'?`STANDBY — ${DMG.ROOMS[team.location]?.label||'?'}`:'STANDBY';
      ctx.fillStyle='rgba(160,180,220,0.65)'; ctx.font=`${U(9)}px ui-monospace,monospace`;
      ctx.fillText(taskStr,tx,cy+U(26));
      if(team.state==='on_scene'&&team.task==='repair'&&team.repairTarget){
        const job=window.G?.player?.damage?.repairJobs?.[DMG.roomSection(team.location)];
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
    // 3 decks of 64px each — geometry derived from dH so hull always fits
    const dH=U(64);
    const phTop=schY+Math.round(schH*0.26), phBot=schY+Math.round(schH*0.26)+3*dH;
    const phMid=(phTop+phBot)*0.5;
    const phR=(phBot-phTop)*0.5;                              // 96px
    const phX0=schX+phR+U(18), phX1=schX+schW-phR-U(18), phSpan=phX1-phX0;
    const ohR=phR+U(8), ohTop=phMid-ohR, ohBot=phMid+ohR;
    const sailCX=phX0+phSpan*(0.21+0.105);
    const sailW2=U(86), sailH2=U(58), sailBot2=ohTop, sailTop2=sailBot2-sailH2;
    // Deck top boundaries (D1=top, D2=middle, D3=bottom)
    const d1Top=phTop, d2Top=phTop+dH, d3Top=phTop+2*dH;
    const deckTops=[d1Top,d2Top,d3Top];
    // Compartment X positions
    let compXs=[],compWs=[];
    { let xx=phX0; for(let i=0;i<6;i++){ compWs[i]=phSpan*compFracs[i]; compXs[i]=xx; xx+=compWs[i]; } }
    // Per-deck cell labels based on real layout [D1, D2, D3]
    // Block-based layout: {c:colStart(0-2), cs:colSpan, d:deckStart(0-2), ds:deckSpan, lbl}
    // 3 columns per section, 3 decks. Blocks may span cols or decks.
    // cap = cs × ds × 6  (base capacity 6 per 1×1 unit; doubles/trebles scale linearly)
    const COMP_LAYOUT = {
      fore_ends: [
        {c:0,cs:1,d:0,ds:1,lbl:'FWD DOME',   cap:6,  rid:'fore_ends_d0'},
        {c:1,cs:2,d:0,ds:1,lbl:'COMMS',      cap:12, rid:'fore_ends_d0b'},
        {c:0,cs:1,d:1,ds:1,lbl:'ENG OFFICE', cap:6,  rid:'fore_ends_d1'},
        {c:1,cs:2,d:1,ds:1,lbl:'COMPUTER RM',cap:12, rid:'fore_ends_d1b'},
        {c:0,cs:3,d:2,ds:1,lbl:'TORPEDO ROOM',cap:18,rid:'fore_ends_d2'},
      ],
      control_room: [
        {c:0,cs:1,d:0,ds:1,lbl:'NAV',         cap:6,  rid:'control_room_d0'},
        {c:1,cs:1,d:0,ds:1,lbl:'SCOPE',       cap:6,  rid:'control_room_d0b'},
        {c:2,cs:1,d:0,ds:1,lbl:'WARDROOM',    cap:6,  rid:'control_room_d0c'},
        {c:0,cs:1,d:1,ds:1,lbl:'CO CABIN',    cap:6,  rid:'control_room_d1b'},
        {c:1,cs:2,d:1,ds:1,lbl:'CONTROL ROOM',cap:12, rid:'control_room_d1'},
        {c:0,cs:3,d:2,ds:1,lbl:'MACHINERY SP',cap:18, rid:'control_room_d2'},
      ],
      aux_section: [
        {c:0,cs:1,d:0,ds:1,lbl:'JR MESS',    cap:6,  rid:'aux_section_d0'},
        {c:1,cs:2,d:0,ds:1,lbl:'SR MESS',    cap:12, rid:'aux_section_d0b'},
        {c:0,cs:2,d:1,ds:1,lbl:'BUNKS',      cap:12, rid:'aux_section_d1'},
        {c:2,cs:1,d:1,ds:1,lbl:'VENT PLANT', cap:6,  rid:'aux_section_d1b'},
        {c:0,cs:1,d:2,ds:1,lbl:'AMS 1',      cap:6,  rid:'aux_section_d2'},
        {c:1,cs:1,d:2,ds:1,lbl:'RX E-COOL',  cap:6,  rid:'aux_section_d2b'},
        {c:2,cs:1,d:2,ds:1,lbl:'SICKBAY',    cap:6,  rid:'aux_section_d2c'},
      ],
      reactor_comp: [
        {c:0,cs:3,d:0,ds:1,lbl:'RC TUNNEL',  cap:18, rid:'reactor_comp_d0'},
        {c:0,cs:3,d:1,ds:2,lbl:'REACTOR',    cap:36, rid:['reactor_comp_d1','reactor_comp_d2']},
      ],
      engine_room: [
        {c:0,cs:1,d:0,ds:1,lbl:'AFT PASS',    cap:6,  rid:'engine_room_d0'},
        {c:1,cs:2,d:0,ds:1,lbl:'MANEUVERING', cap:12, rid:'engine_room_d0b'},
        {c:0,cs:3,d:1,ds:1,lbl:'ELEC DIST',   cap:18, rid:'engine_room_d1'},
        {c:0,cs:3,d:2,ds:1,lbl:'AFT ATMOS',   cap:18, rid:'engine_room_d2'},
      ],
      aft_ends: [
        {c:0,cs:1,d:0,ds:1,lbl:'AFT ESCAPE',  cap:6,  rid:'aft_ends_d2b'},
        {c:1,cs:2,d:0,ds:1,lbl:'ENGINEERING', cap:12, rid:'aft_ends_d0'},
        {c:0,cs:2,d:1,ds:1,lbl:'PROPULSION',  cap:12, rid:'aft_ends_d1'},
        {c:2,cs:1,d:1,ds:1,lbl:'SHAFT ALLEY', cap:6,  rid:'aft_ends_d1b'},
        {c:0,cs:3,d:2,ds:1,lbl:'STEER GEAR',  cap:18, rid:'aft_ends_d2'},
      ],
    };
    // Diesel-specific layout overrides
    const COMP_LAYOUT_DIESEL = {
      reactor_comp: [
        {c:0,cs:3,d:0,ds:1,lbl:'ENG PASSAGE',  cap:18, rid:'reactor_comp_d0'},
        {c:0,cs:3,d:1,ds:2,lbl:'DIESEL ENGINE', cap:36, rid:['reactor_comp_d1','reactor_comp_d2']},
      ],
      engine_room: [
        {c:0,cs:1,d:0,ds:1,lbl:'AFT PASS',    cap:6,  rid:'engine_room_d0'},
        {c:1,cs:2,d:0,ds:1,lbl:'MOTOR CTRL',  cap:12, rid:'engine_room_d0b'},
        {c:0,cs:3,d:1,ds:1,lbl:'BATT BANK 1', cap:18, rid:'engine_room_d1'},
        {c:0,cs:3,d:2,ds:1,lbl:'BATT BANK 2', cap:18, rid:'engine_room_d2'},
      ],
      aux_section: [
        {c:0,cs:1,d:0,ds:1,lbl:'JR MESS',    cap:6,  rid:'aux_section_d0'},
        {c:1,cs:2,d:0,ds:1,lbl:'SR MESS',    cap:12, rid:'aux_section_d0b'},
        {c:0,cs:2,d:1,ds:1,lbl:'BUNKS',      cap:12, rid:'aux_section_d1'},
        {c:2,cs:1,d:1,ds:1,lbl:'VENT PLANT', cap:6,  rid:'aux_section_d1b'},
        {c:0,cs:1,d:2,ds:1,lbl:'AMS 1',      cap:6,  rid:'aux_section_d2'},
        {c:1,cs:1,d:2,ds:1,lbl:'BATT MON',   cap:6,  rid:'aux_section_d2b'},
        {c:2,cs:1,d:2,ds:1,lbl:'SICKBAY',    cap:6,  rid:'aux_section_d2c'},
      ],
    };
    function getCompLayout(comp){ return (C.player.isDiesel && COMP_LAYOUT_DIESEL[comp]) || COMP_LAYOUT[comp] || []; }
    // All sections total 9 grid units × 6 = 54 max occupancy
    const SECTION_CAP = 54;
    const stFill={nominal:'rgba(18,55,28,0.88)',degraded:'rgba(75,58,4,0.90)',offline:'rgba(75,22,4,0.92)',destroyed:'rgba(55,4,4,0.96)'};
    const stStroke={nominal:'rgba(50,200,80,0.55)',degraded:'rgba(220,170,20,0.80)',offline:'rgba(220,80,20,0.90)',destroyed:'rgba(200,30,30,1.0)'};
    // (Special cell background overrides removed — all sections use system-state colour)
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
      const sysList=DMG.activeSystems(comp); let wi=0;
      for(const s of sysList) wi=Math.max(wi,DMG.STATES.indexOf(DMG.effectiveState(s,dmg)));
      const rooms=DMG.SECTION_ROOMS[comp]||[];
      const fires=[0,1,2].map(di=>Math.max(...rooms.filter(rid=>(DMG.ROOMS[rid]?.deck??-1)===di).map(rid=>dmg.fire?.[rid]||0),0));
      return {wi,worst:DMG.STATES[wi],flood:dmg.flooding[comp]||0,isFlooded:!!dmg.flooded[comp],fireLevel:Math.max(...fires),fires};
    });

    // Outer hull silhouette
    ctx.save();
    dsohPill();
    ctx.strokeStyle='rgba(100,130,180,0.35)'; ctx.lineWidth=U(1.5);
    ctx.setLineDash([U(3),U(4)]); ctx.stroke(); ctx.setLineDash([]);
    // Sail
    const sX0=sailCX-sailW2*0.5, sX1=sailCX+sailW2*0.5;
    ctx.strokeStyle='rgba(140,170,220,0.55)'; ctx.lineWidth=U(1.5);
    ctx.beginPath();
    ctx.moveTo(sX0+U(8),sailBot2); ctx.lineTo(sX0+U(8),sailTop2+U(8));
    ctx.bezierCurveTo(sX0+U(8),sailTop2,sX0+U(20),sailTop2,sX0+U(24),sailTop2);
    ctx.lineTo(sX1-U(10),sailTop2); ctx.lineTo(sX1,sailTop2+U(16)); ctx.lineTo(sX1,sailBot2);
    ctx.stroke();
    // Fins
    const finX=phX1+ohR*0.7;
    ctx.strokeStyle='rgba(110,140,190,0.40)'; ctx.lineWidth=U(1);
    ctx.beginPath(); ctx.moveTo(finX,ohTop+U(6)); ctx.lineTo(finX+U(16),ohTop+U(2)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(finX,ohBot-U(6)); ctx.lineTo(finX+U(16),ohBot-U(2)); ctx.stroke();
    // Propulsor
    const prX=phX1+ohR-U(3),prY=phMid,prR2=U(8);
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

    // ── Fill per-deck cells (clipped to hull) ─────────────────────────────────
    for(let ci=0;ci<6;ci++){
      const comp=compKeys[ci]; const cs=cState[ci];
      const cx2=compXs[ci], cw=compWs[ci];
      const fx=ci===0?cx2-phR:cx2, fw=(ci===0||ci===5)?cw+phR:cw;
      for(let di=0;di<3;di++){
        const dTop=deckTops[di];
        ctx.save(); dsphPill(); ctx.clip();
        // Base background — system state colour for all sections
        const bg=stFill[cs.worst]||stFill.nominal;
        ctx.fillStyle=cs.isFlooded?'rgba(8,18,70,0.98)':bg;
        ctx.fillRect(fx,dTop,fw,dH);
        // System glow on damaged cells
        if(cs.wi>0){
          const gc=['','rgba(220,170,20,0.13)','rgba(220,80,20,0.17)','rgba(200,30,30,0.22)'];
          ctx.fillStyle=gc[cs.wi]||''; ctx.fillRect(fx,dTop,fw,dH);
        }
        // Flood fill — D3 fills first, then D2, then D1
        const ff=deckFloodFrac(cs.flood,cs.isFlooded,di);
        if(ff>0){
          const fH=dH*ff;
          ctx.fillStyle=`rgba(28,75,200,${0.30+ff*0.46})`; ctx.fillRect(fx,dTop+dH-fH,fw,fH);
          if(ff<0.99&&ff>0.01){  // waterline within this deck
            ctx.strokeStyle='rgba(100,160,255,0.60)'; ctx.lineWidth=U(1);
            ctx.beginPath(); ctx.moveTo(fx,dTop+dH-fH); ctx.lineTo(fx+fw,dTop+dH-fH); ctx.stroke();
          }
        }
        ctx.restore();
      }
    }

    // Hull border
    dsphPill(); ctx.strokeStyle='rgba(80,120,180,0.50)'; ctx.lineWidth=U(1.5); ctx.stroke();

    // ── Fire overlay — per COMP_LAYOUT block, respecting compartment boundaries ─
    // Each block has a rid (room ID or array of IDs). Only the block whose
    // room is actually burning gets the fire glow.
    ctx.save(); dsphPill(); ctx.clip();
    for(let ci=0;ci<6;ci++){
      const comp=compKeys[ci]; const cs=cState[ci];
      const cx2=compXs[ci], cw=compWs[ci];
      const drenchLvl2=dmg._fireDrench?.[comp]?.level??0;
      for(const b of (getCompLayout(comp))){
        const rids=Array.isArray(b.rid)?b.rid:[b.rid];
        const fire=Math.max(...rids.map(rid=>dmg.fire?.[rid]||0));
        if(fire>0.02&&drenchLvl2<1){
          ctx.fillStyle=`rgba(200,80,0,${(0.11+fire*0.20)*(1-drenchLvl2)})`;
          ctx.fillRect(cx2+cw*(b.c/3), deckTops[b.d], cw*(b.cs/3), dH*b.ds);
        }
      }
      // N2 drench overlay — teal fill rising from bottom of hull block
      if(drenchLvl2>0){
        const hullTop=deckTops[0], hullBot=deckTops[2]+dH;
        const fillH=(hullBot-hullTop)*drenchLvl2;
        const x0=ci===0?cx2-phR:cx2, w0=(ci===0||ci===5)?cw+phR:cw;
        ctx.fillStyle=`rgba(0,210,190,${0.18+drenchLvl2*0.32})`;
        ctx.fillRect(x0, hullBot-fillH, w0, fillH);
      }
    }
    ctx.restore();

    // Deck divider lines — per section, skipping where blocks span across deck boundaries
    ctx.save(); dsphPill(); ctx.clip();
    ctx.strokeStyle='rgba(70,100,150,0.50)'; ctx.lineWidth=U(1);
    for(let di=1;di<3;di++){
      const y=deckTops[di];
      for(let ci=0;ci<6;ci++){
        const comp=compKeys[ci];
        const x0=ci===0 ? compXs[0]-phR : compXs[ci];
        const x1=ci===5 ? compXs[5]+compWs[5]+phR : compXs[ci]+compWs[ci];
        const spans=(getCompLayout(comp)).some(b=>b.d<di && b.d+b.ds>di);
        if(!spans){ ctx.beginPath(); ctx.moveTo(x0,y); ctx.lineTo(x1,y); ctx.stroke(); }
      }
    }
    ctx.restore();

    // Compartment dividers (vertical, clipped to hull)
    ctx.save(); dsphPill(); ctx.clip();
    for(let ci=1;ci<6;ci++){
      const x=compXs[ci];
      const stA=DMG.effectiveState(DMG.activeSystems(compKeys[ci-1])[0],dmg)||'nominal';
      const stB=DMG.effectiveState(DMG.activeSystems(compKeys[ci])[0],dmg)||'nominal';
      const wDiv=Math.max(DMG.STATES.indexOf(stA),DMG.STATES.indexOf(stB));
      ctx.strokeStyle=['rgba(50,120,65,0.55)','rgba(160,130,20,0.65)','rgba(160,60,20,0.75)','rgba(150,30,30,0.85)'][wDiv]||'rgba(60,90,140,0.50)';
      ctx.lineWidth=U(1.5);
      ctx.beginPath(); ctx.moveTo(x,phTop); ctx.lineTo(x,phBot); ctx.stroke();
    }
    ctx.restore();

    // Sub-compartment dividers — right edge of each block (unless it reaches col 3)
    ctx.save(); dsphPill(); ctx.clip();
    ctx.strokeStyle='rgba(50,80,120,0.40)'; ctx.lineWidth=U(0.75);
    for(let ci=0;ci<6;ci++){
      const comp=compKeys[ci]; const cx2=compXs[ci], cw=compWs[ci];
      for(const b of (getCompLayout(comp))){
        if(b.c+b.cs>=3) continue;  // no right-edge divider at section boundary
        const x=cx2+cw*(b.c+b.cs)/3;
        const y0=deckTops[b.d]+U(1);
        const y1=deckTops[b.d]+dH*b.ds-U(1);
        ctx.beginPath(); ctx.moveTo(x,y0); ctx.lineTo(x,y1); ctx.stroke();
      }
    }
    ctx.restore();

    // WTD (Watertight Door) indicators — colored bars on each divider, clickable
    {
      const wtd=dmg.wtd||{};
      const hydOk=(dmg.systems?.hyd_main||'nominal')!=='destroyed';
      const wtdBtnW=U(14), wtdBarW=U(5), wtdBarH=phBot-phTop;
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
          ctx.strokeStyle='rgba(255,210,190,0.88)'; ctx.lineWidth=U(1.5);
          const bMid=d2Top+dH*0.5;
          ctx.beginPath(); ctx.moveTo(x-U(5),bMid); ctx.lineTo(x+U(5),bMid); ctx.stroke();
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
    ctx.fillStyle='rgba(80,110,160,0.55)'; ctx.font=`${U(8)}px ui-monospace,monospace`; ctx.textAlign='right';
    ctx.fillText('D1',phX0-phR-U(3),d1Top+dH*0.65);
    ctx.fillText('D2',phX0-phR-U(3),d2Top+dH*0.65);
    ctx.fillText('D3',phX0-phR-U(3),d3Top+dH*0.65);

    // Cell content: section labels + block labels + status (clipped to hull)
    ctx.save(); dsphPill(); ctx.clip();
    for(let ci=0;ci<6;ci++){
      const comp=compKeys[ci]; const cs=cState[ci];
      const cx2=compXs[ci],cw=compWs[ci],cMid=cx2+cw*0.5;
      // Section header label at top of D1
      ctx.fillStyle='rgba(200,220,255,0.92)'; ctx.font=`bold ${U(11)}px ui-monospace,monospace`; ctx.textAlign='center';
      ctx.fillText(compLabels[ci],cMid,d1Top+U(14));
      // Per-block labels
      for(const b of (getCompLayout(comp))){
        const bx=cx2+cw*(b.c/3);
        const by=deckTops[b.d];
        const bw=cw*(b.cs/3);
        const bh=dH*b.ds;
        // Skip if all spanned decks are fully flooded
        let anyVisible=false;
        for(let di=b.d;di<b.d+b.ds;di++) if(deckFloodFrac(cs.flood,cs.isFlooded,di)<0.95) anyVisible=true;
        if(!anyVisible) continue;
        ctx.fillStyle='rgba(150,185,225,0.70)';
        ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.textAlign='center';
        ctx.fillText(b.lbl, bx+bw*0.5, by+bh*0.5);
        // Room crew count — from ROOMS[rid].crew (watchkeepers/personnel in this compartment)
        const rids=Array.isArray(b.rid)?b.rid:[b.rid];
        const roomCrew=rids.reduce((sum,rid)=>(DMG.ROOMS[rid]?.crew||0)+sum,0);
        if(roomCrew>0){
          ctx.globalAlpha=0.45;
          ctx.font=`${U(9)}px ui-monospace,monospace`;
          ctx.fillText(`crew: ${roomCrew}`, bx+bw*0.5, by+bh*0.5+U(12));
          ctx.globalAlpha=1.0;
        }
      }
      // Status overlay — at center of burning deck (fire) or D2 band (other states)
      const d2Mid=d2Top+dH*0.56;
      const drenchLvl3=dmg._fireDrench?.[comp]?.level??0;
      if(cs.isFlooded){
        ctx.fillStyle='rgba(140,180,255,0.95)'; ctx.font=`bold ${U(11)}px ui-monospace,monospace`;
        ctx.fillText('FLOODED',cMid,d2Mid);
      } else if(drenchLvl3>0){
        ctx.fillStyle=drenchLvl3>=1?'rgba(0,240,220,0.95)':'rgba(0,210,190,0.90)';
        ctx.font=`bold ${U(10)}px ui-monospace,monospace`;
        ctx.fillText(`N2 ${Math.round(drenchLvl3*100)}%`,cMid,d2Mid);
      } else if(cs.fireLevel>0.02){
        // Show fire text at center of the burning deck (whichever has highest fire)
        const fireDi=[0,1,2].reduce((best,di)=>cs.fires[di]>cs.fires[best]?di:best,0);
        const fireDeckMid=deckTops[fireDi]+dH*0.56;
        ctx.fillStyle=cs.fireLevel>0.85?'rgba(255,80,20,0.95)':'rgba(255,140,40,0.90)';
        ctx.font=`bold ${U(10)}px ui-monospace,monospace`;
        ctx.fillText(`FIRE ${Math.round(cs.fireLevel*100)}%`,cMid,fireDeckMid);
      } else if(cs.flood>0.02){
        ctx.fillStyle='rgba(140,190,255,0.90)'; ctx.font=`${U(10)}px ui-monospace,monospace`;
        ctx.fillText(`${Math.round(cs.flood*100)}%`,cMid,d2Mid);
      } else if(cs.wi>0){
        const stColD={degraded:'rgba(230,170,20,0.80)',offline:'rgba(230,90,30,0.85)',destroyed:'rgba(200,50,50,0.90)'};
        ctx.fillStyle=stColD[cs.worst]||''; ctx.font=`bold ${U(10)}px ui-monospace,monospace`;
        ctx.fillText(cs.worst.toUpperCase(),cMid,d2Mid);
      }
    }
    ctx.restore();
    cy=schY+schH+U(10);

    // ── DC Team dispatch rows ──────────────────────────────────────────────────
    {
      const teamList2=[dmg.teams?.alpha,dmg.teams?.bravo].filter(Boolean);
      const dispBtnH=U(22),dispGap=U(3),labelW=phX0-schX;
      for(let ti=0;ti<teamList2.length;ti++){
        const team=teamList2[ti];
        const rowY=cy+ti*(dispBtnH+dispGap+U(2));
        const isReady=team.state==='ready';
        const isMusteringEmerg2=team._readyT>0;
        const isLocked2=team._locked;
        const tLabelCol=team.state==='lost'?'rgba(180,30,30,0.80)':isMusteringEmerg2?'rgba(170,100,0,0.80)':team.state==='mustering'?'rgba(160,110,15,0.75)':isReady?'rgba(80,80,90,0.70)':team.task==='flood'?'rgba(30,70,160,0.75)':'rgba(30,100,50,0.75)';
        ctx.fillStyle=tLabelCol; ctx.beginPath(); ctx.roundRect(schX,rowY,labelW-dispGap,dispBtnH,U(3)); ctx.fill();
        ctx.fillStyle='rgba(220,220,240,0.90)'; ctx.font=`bold ${U(9)}px ui-monospace,monospace`; ctx.textAlign='center';
        const pillTxt2=isMusteringEmerg2?`MSTR ${Math.ceil(team._readyT)}s`:isLocked2?team.label.replace('DC ','')+' \u{1F512}':team.label.replace('DC ','');
        ctx.fillText(pillTxt2,schX+(labelW-dispGap)/2,rowY+dispBtnH*0.68);
        for(let ci=0;ci<6;ci++){
          const comp=compKeys[ci];
          const bx=compXs[ci]+dispGap/2,bw=compWs[ci]-dispGap;
          const lbl=compLabels[ci].slice(0,3);
          const isOnScene=team.state==='on_scene'&&DMG.roomSection(team.location)===comp;
          const isInTransit=team.state==='transit'&&team.destination===comp;
          const isMustering2=team.state==='mustering'&&team.destination===comp;
          const isFloodedD=dmg.flooded[comp];
          const fireLevelD=Math.max(...(DMG.SECTION_ROOMS[comp]||[]).map(rid=>dmg.fire?.[rid]||0)),hasFireD=fireLevelD>0.02;
          const isDrenchedD=!!dmg._fireDrench?.[comp];
          let bCol,bLabel,clickFn;
          if(team.state==='lost'){ bCol='rgba(30,30,30,0.22)'; bLabel=lbl; clickFn=null; }
          else if(team.state==='blowing'&&DMG.roomSection(team.location)===comp){ bCol='rgba(180,90,0,0.85)'; bLabel='BLOW'; clickFn=()=>DMG.recallTeam(team.id); }
          else if(isDrenchedD){ bCol='rgba(40,40,50,0.45)'; bLabel='N2'; clickFn=null; }
          else if(isFloodedD){
            const isBlowingHere=(team.state==='blowing'&&DMG.roomSection(team.location)===comp)||(team.state==='transit'&&team.destination===comp);
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
      cy+=teamList2.length*(dispBtnH+dispGap+U(2))+U(6);
    }

    // ── Systems grid ───────────────────────────────────────────────────────────
    const stColText={'nominal':'rgba(80,200,100,0.80)','degraded':'rgba(230,170,20,0.90)','offline':'rgba(230,90,30,0.90)','destroyed':'rgba(200,50,50,0.95)'};
    let sysMaxY=cy;
    for(let ci=0;ci<6;ci++){
      const comp=compKeys[ci],cx2=compXs[ci],cw=compWs[ci];
      const sysList=DMG.activeSystems(comp);
      let sy=cy;
      for(const sys of sysList){
        const st=DMG.effectiveState(sys,dmg);
        ctx.fillStyle='rgba(160,180,220,0.70)'; ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.textAlign='center';
        ctx.fillText(DMG.SYS_LABEL[sys]||sys,cx2+cw/2,sy); sy+=U(12);
        ctx.fillStyle=stColText[st]||stColText.destroyed; ctx.font=`bold ${U(9)}px ui-monospace,monospace`;
        ctx.fillText(st.toUpperCase(),cx2+cw/2,sy); sy+=U(10);
      }
      sysMaxY=Math.max(sysMaxY,sy);
    }
    cy=sysMaxY+U(10);

    // ── Escape buttons ─────────────────────────────────────────────────────────
    ctx.fillStyle='rgba(120,140,180,0.50)'; ctx.font=`${U(10)}px ui-monospace,monospace`; ctx.textAlign='left';
    ctx.fillText('ESCAPE',P,cy); cy+=U(6);
    const halfEsc=(LW-P*2-U(6))/2;
    const tceViable=DMG.canTCE(),escActive=!!dmg.escapeState;
    PNL.btn2(ctx,escActive?'ESCAPING…':'TCE ESCAPE',P,cy,halfEsc,U(18),
      escActive?'rgba(30,80,30,0.50)':tceViable?'rgba(20,60,20,0.70)':'rgba(60,60,60,0.30)',
      ()=>{ if(!escActive&&tceViable) DMG.initiateEscape('tce'); });
    PNL.btn2(ctx,escActive?'ESCAPING…':'RUSH ESCAPE',P+halfEsc+U(6),cy,halfEsc,U(18),
      escActive?'rgba(80,30,30,0.50)':'rgba(100,30,10,0.70)',
      ()=>{ if(!escActive) DMG.initiateEscape('rush'); });
    const depthM=Math.round(player.depth||0);
    const depthAdv=depthM<=120?'TCE & RUSH viable':depthM<=200?'TCE marginal':'TCE not viable';
    const depthAdvCol=depthM<=120?'rgba(80,200,80,0.70)':depthM<=200?'rgba(220,170,20,0.80)':'rgba(220,80,50,0.80)';
    ctx.fillStyle=depthAdvCol; ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.textAlign='center';
    ctx.fillText(`${depthM}m — ${depthAdv}`,LW/2,cy+U(30)); cy+=U(36);

    // ── Seal buttons ───────────────────────────────────────────────────────────
    const hasSealTargets=DMG.COMPS.some(comp=>!dmg.flooded[comp]&&(dmg.flooding[comp]||0)>0.05);
    if(hasSealTargets){
      ctx.fillStyle='rgba(80,100,140,0.40)'; ctx.font=`${U(8)}px ui-monospace,monospace`; ctx.textAlign='left';
      ctx.fillText('SEAL (last resort — kills all crew inside):',P,cy); cy+=U(6);
      for(let ci=0;ci<6;ci++){
        const comp=compKeys[ci],cx2=compXs[ci],cw=compWs[ci];
        if(!dmg.flooded[comp]&&(dmg.flooding[comp]||0)>0.05)
          PNL.btn2(ctx,compLabels[ci].slice(0,3),cx2+2,cy,cw-4,U(14),'rgba(100,30,30,0.60)',()=>DMG.sealFlooding(comp));
      }
      cy+=U(18);
    }

    // ── Debug hit buttons ──────────────────────────────────────────────────────
    if(game.debugOverlay){
      ctx.fillStyle='rgba(200,50,50,0.60)'; ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.textAlign='left';
      ctx.fillText('[ DEBUG ] HIT:',P,cy-U(2));
      const dbgW=(LW-P*2-U(4))/6;
      for(let i=0;i<6;i++){
        const comp=DMG.COMPS[i],isHit=(dmg.strikes[comp]||0)>=1;
        PNL.btn2(ctx,compLabels[i].slice(0,3),P+i*dbgW,cy,dbgW-U(3),U(14),
          isHit?'rgba(180,30,30,0.80)':'rgba(100,30,30,0.55)',()=>DMG.hit(55,null,null,comp));
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // BOTTOM PANE — Ship's Company
    // ──────────────────────────────────────────────────────────────────────────
    const SPLIT_Y=Math.min(cy+U(4), Math.round(H*0.74));
    ctx.strokeStyle='rgba(60,100,160,0.30)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,SPLIT_Y); ctx.lineTo(W,SPLIT_Y); ctx.stroke();

    // Clip bottom panel to prevent overflow past screen edge
    ctx.save();
    ctx.beginPath(); ctx.rect(0,SPLIT_Y,W,H-SPLIT_Y); ctx.clip();

    const d=player.damage;
    let ry2=SPLIT_Y+U(10);

    // Header row
    ctx.fillStyle='rgba(130,168,232,0.82)';
    ctx.font=`bold ${U(12)}px ui-monospace,monospace`; ctx.textAlign='left';
    ctx.fillText("SHIP'S COMPANY",P,ry2);
    const sumX=U(172);
    ctx.font=`${U(11)}px ui-monospace,monospace`;
    ctx.fillStyle='rgba(60,200,90,0.85)';   ctx.fillText(`FIT ${fit}`,  sumX,          ry2);
    ctx.fillStyle='rgba(230,170,30,0.90)';  ctx.fillText(`WND ${wnd}`,  sumX+U(56),   ry2);
    ctx.fillStyle='rgba(210,50,50,0.90)';   ctx.fillText(`KIA ${kia}`,  sumX+U(112),  ry2);
    ctx.fillStyle='rgba(140,165,210,0.55)'; ctx.fillText(`/ ${total}`,  sumX+U(168),  ry2);
    ry2+=U(16);
    ctx.strokeStyle='rgba(60,100,160,0.20)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(P,ry2); ctx.lineTo(W-P,ry2); ctx.stroke();
    ry2+=U(8);

    // 6-section columns — one per section, full width
    const nCols2=6, colGap2=U(6);
    const colW2=(W-P*2-colGap2*(nCols2-1))/nCols2;
    const COMP_LABELS2={
      fore_ends:'TORPEDO ROOM', control_room:'CONTROL ROOM', aux_section:'AUX / MESS',
      reactor_comp:'REACTOR COMP', engine_room:'ENGINE ROOM',  aft_ends:'AFT ENDS',
    };
    const SUPPORT_DEPTS2=new Set(['medical','supply']);
    const ROW_H2=U(13), SEC_HDR2=U(18);
    const STATUS_COL2={fit:'rgba(50,190,80,0.90)',wounded:'rgba(230,165,25,0.90)',killed:'rgba(200,40,40,0.75)'};
    const _hoverHits2=[];
    const mx2=window.I?.mouseX||0, my2=window.I?.mouseY||0;

    function drawCrewRow2(m,rx,ry,subW,isDuty){
      const isKia=m.status==='killed',isWnd=m.status==='wounded';
      const isOnWatch2=m.watch==='duty'||m.watch===activeWatch;
      ctx.globalAlpha=isKia?0.35:isOnWatch2?1.0:0.55;
      const pillW2=U(28), rowTop2=ry-ROW_H2*0.82;
      ctx.fillStyle=STATUS_COL2[m.status]||STATUS_COL2.fit;
      ctx.beginPath(); ctx.arc(rx+U(4),ry-U(3),U(3),0,Math.PI*2); ctx.fill();
      ctx.fillStyle=isWnd?'rgba(200,140,20,0.70)':isKia?'rgba(140,20,20,0.50)':'rgba(30,55,100,0.65)';
      ctx.beginPath(); ctx.roundRect(rx+U(10),rowTop2,pillW2,ROW_H2*0.85,U(2)); ctx.fill();
      ctx.fillStyle='rgba(200,220,255,0.90)'; ctx.font=`bold ${U(8)}px ui-monospace,monospace`; ctx.textAlign='center';
      ctx.fillText(m.rating,rx+U(10)+pillW2/2,ry-U(2));
      ctx.fillStyle=isKia?'rgba(180,60,60,0.60)':isWnd?'rgba(220,165,30,0.90)':'rgba(200,215,245,0.90)';
      ctx.font=`${U(10)}px ui-monospace,monospace`; ctx.textAlign='left';
      ctx.fillText(`${m.firstName[0]}.${m.lastName}`,rx+U(42),ry-U(2));
      const badgesW2=isDuty?U(18):U(32);
      ctx.fillStyle='rgba(120,170,220,0.70)'; ctx.font=`${U(8)}px ui-monospace,monospace`; ctx.textAlign='right';
      ctx.fillText(m.role||'',rx+subW-badgesW2-U(3),ry-U(2));
      const badgeX2=rx+subW-badgesW2;
      const wBg2=m.watch==='duty'?'rgba(160,120,20,0.65)':m.watch==='A'?'rgba(25,55,130,0.65)':'rgba(10,90,80,0.65)';
      const wFg2=m.watch==='duty'?'rgba(255,210,60,0.95)':m.watch==='A'?'rgba(120,170,255,0.95)':'rgba(60,210,185,0.95)';
      ctx.fillStyle=wBg2; ctx.beginPath(); ctx.roundRect(badgeX2,rowTop2,U(14),ROW_H2*0.80,U(2)); ctx.fill();
      ctx.fillStyle=wFg2; ctx.font=`bold ${U(7)}px ui-monospace,monospace`; ctx.textAlign='center';
      ctx.fillText(m.watch==='duty'?'★':m.watch,badgeX2+U(7),ry-U(2));
      if(m.dcTeam){
        const dcX2=badgeX2+U(16);
        ctx.fillStyle=m.dcTeam==='alpha'?'rgba(140,40,130,0.65)':'rgba(40,100,40,0.65)';
        ctx.beginPath(); ctx.roundRect(dcX2,rowTop2,U(14),ROW_H2*0.80,U(2)); ctx.fill();
        ctx.fillStyle=m.dcTeam==='alpha'?'rgba(230,140,220,0.95)':'rgba(120,230,120,0.95)';
        ctx.font=`bold ${U(7)}px ui-monospace,monospace`; ctx.textAlign='center';
        ctx.fillText(m.dcTeam==='alpha'?'α':'β',dcX2+U(7),ry-U(2));
      }
      ctx.globalAlpha=1.0;
      if(m.roleDesc) _hoverHits2.push({x:rx,y:rowTop2,w:subW,h:ROW_H2,tip:m.roleDesc});
    }

    function drawCompSection2(comp,sx,sy,availW){
      // Show crew by billet (stationComp), not physical location, so B-watch crew
      // always appear under their home section even when resting in aux_section.
      const crew2=DMG.COMPS.flatMap(s=>d.crew[s]||[]).filter(m=>m.stationComp===comp&&!SUPPORT_DEPTS2.has(m.dept));
      const fitC2=crew2.filter(c=>c.status==='fit'&&!c.displaced).length;
      const wndC2=crew2.filter(c=>c.status==='wounded').length;
      const kiaC2=crew2.filter(c=>c.status==='killed').length;
      const hasFF2=[0,1,2].some(di=>(d.fire?.[`${comp}_d${di}`]||0)>0.02)||d.flooded?.[comp]||(d.flooding?.[comp]||0)>0.01;
      ctx.fillStyle=hasFF2?'rgba(100,30,10,0.55)':'rgba(20,38,70,0.60)';
      ctx.beginPath(); ctx.roundRect(sx,sy,availW,SEC_HDR2,U(2)); ctx.fill();
      ctx.fillStyle='rgba(180,210,255,0.90)'; ctx.font=`bold ${U(10)}px ui-monospace,monospace`; ctx.textAlign='left';
      ctx.fillText(COMP_LABELS2[comp],sx+U(5),sy+SEC_HDR2*0.72);
      ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.textAlign='right';
      const sumStr2=kiaC2>0?`${fitC2}f ${wndC2}w ${kiaC2}k`:`${fitC2}/${crew2.length}`;
      ctx.fillStyle=kiaC2>0?'rgba(210,60,60,0.85)':wndC2>0?'rgba(220,160,30,0.80)':'rgba(80,190,100,0.70)';
      ctx.fillText(sumStr2,sx+availW-U(5),sy+SEC_HDR2*0.72); sy+=SEC_HDR2+U(2);
      if(crew2.length===0) return sy+U(4);
      const dutyList2=crew2.filter(m=>m.watch==='duty');
      const watchB2=crew2.filter(m=>m.watch==='B'), watchA2=crew2.filter(m=>m.watch==='A');
      const subW2=(availW-U(3))/2;
      for(let i=0;i<dutyList2.length;i++){
        ctx.fillStyle='rgba(140,110,10,0.12)'; ctx.fillRect(sx,sy+i*ROW_H2,availW,ROW_H2-1);
        drawCrewRow2(dutyList2[i],sx,sy+i*ROW_H2+ROW_H2*0.82,availW,true);
      }
      if(dutyList2.length) sy+=dutyList2.length*ROW_H2+U(2);
      if(watchB2.length||watchA2.length){
        ctx.font=`bold ${U(7)}px ui-monospace,monospace`; ctx.textAlign='center';
        ctx.fillStyle=activeWatch==='B'?'rgba(60,210,185,0.80)':'rgba(60,210,185,0.35)';
        ctx.fillText('WCH B',sx+subW2/2,sy+U(8));
        ctx.fillStyle=activeWatch==='A'?'rgba(120,170,255,0.80)':'rgba(120,170,255,0.35)';
        ctx.fillText('WCH A',sx+subW2+U(3)+subW2/2,sy+U(8)); sy+=U(11);
      }
      const rows2=Math.max(watchB2.length,watchA2.length);
      for(let i=0;i<watchB2.length;i++) drawCrewRow2(watchB2[i],sx,          sy+i*ROW_H2+ROW_H2*0.82,subW2,false);
      for(let i=0;i<watchA2.length;i++) drawCrewRow2(watchA2[i],sx+subW2+U(3),sy+i*ROW_H2+ROW_H2*0.82,subW2,false);
      return sy+rows2*ROW_H2+U(6);
    }

    function drawSupportSection2(sx,sy,availW){
      const allSupport2=[];
      for(const comp of DMG.COMPS){
        for(const m of (d.crew[comp]||[])) if(SUPPORT_DEPTS2.has(m.dept)) allSupport2.push(m);
      }
      if(allSupport2.length===0) return sy;
      const fitC2=allSupport2.filter(c=>c.status==='fit').length;
      const kiaC2=allSupport2.filter(c=>c.status==='killed').length;
      ctx.fillStyle='rgba(20,38,70,0.60)';
      ctx.beginPath(); ctx.roundRect(sx,sy,availW,SEC_HDR2,U(2)); ctx.fill();
      ctx.fillStyle='rgba(180,210,255,0.90)'; ctx.font=`bold ${U(10)}px ui-monospace,monospace`; ctx.textAlign='left';
      ctx.fillText('SHIP SUPPORT',sx+U(5),sy+SEC_HDR2*0.72);
      ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.textAlign='right';
      ctx.fillStyle=kiaC2>0?'rgba(210,60,60,0.85)':'rgba(80,190,100,0.70)';
      ctx.fillText(`${fitC2}/${allSupport2.length}`,sx+availW-U(5),sy+SEC_HDR2*0.72);
      sy+=SEC_HDR2+U(2);
      for(const dept of ['medical','supply']){
        const crew2=allSupport2.filter(m=>m.dept===dept);
        if(crew2.length===0) continue;
        ctx.fillStyle='rgba(100,130,180,0.50)'; ctx.font=`bold ${U(7)}px ui-monospace,monospace`; ctx.textAlign='left';
        ctx.fillText(dept==='medical'?'MEDICAL':'SUPPLY',sx+U(5),sy+U(7)); sy+=U(10);
        const dutyList2=crew2.filter(m=>m.watch==='duty');
        const watchB2=crew2.filter(m=>m.watch==='B'), watchA2=crew2.filter(m=>m.watch==='A');
        const subW2=(availW-U(3))/2;
        for(let i=0;i<dutyList2.length;i++){
          ctx.fillStyle='rgba(140,110,10,0.12)'; ctx.fillRect(sx,sy+i*ROW_H2,availW,ROW_H2-1);
          drawCrewRow2(dutyList2[i],sx,sy+i*ROW_H2+ROW_H2*0.82,availW,true);
        }
        if(dutyList2.length) sy+=dutyList2.length*ROW_H2+U(2);
        const rows2=Math.max(watchB2.length,watchA2.length);
        for(let i=0;i<watchB2.length;i++) drawCrewRow2(watchB2[i],sx,            sy+i*ROW_H2+ROW_H2*0.82,subW2,false);
        for(let i=0;i<watchA2.length;i++) drawCrewRow2(watchA2[i],sx+subW2+U(3),sy+i*ROW_H2+ROW_H2*0.82,subW2,false);
        sy+=rows2*ROW_H2+U(4);
      }
      return sy+U(2);
    }

    // Draw 6 section columns — one per section, support folded into aft_ends column
    for(let ci=0;ci<6;ci++){
      const comp=DMG.COMPS[ci];
      const cx=P+ci*(colW2+colGap2);
      const colEnd=drawCompSection2(comp,cx,ry2,colW2);
      if(ci===5) drawSupportSection2(cx,colEnd+U(4),colW2);
    }

    ctx.restore();

    // Hover tooltip (drawn outside clip so it can extend into top panel if needed)
    for(const h of _hoverHits2){
      if(mx2>=h.x&&mx2<=h.x+h.w&&my2>=h.y&&my2<=h.y+h.h){
        const tip=h.tip;
        ctx.font=`${U(11)}px ui-monospace,monospace`;
        const tw=ctx.measureText(tip).width+U(12), th=U(16);
        let tx2=mx2+U(10), ty2=my2-U(4);
        if(tx2+tw>W) tx2=mx2-tw-U(4);
        if(ty2+th>H) ty2=my2-th-U(4);
        ctx.fillStyle='rgba(5,12,30,0.94)'; ctx.strokeStyle='rgba(80,140,220,0.55)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.roundRect(tx2,ty2,tw,th,U(3)); ctx.fill(); ctx.stroke();
        ctx.fillStyle='rgba(200,220,255,0.95)'; ctx.textAlign='left';
        ctx.fillText(tip,tx2+U(6),ty2+th*0.72); break;
      }
    }
  }

  window.RPANEL = {drawStartScreen, drawLogPanel, drawDcPanel, drawDamagePanel, drawCrewPanel, drawDamageScreen, drawPanel, drawEndScreen};
})();
