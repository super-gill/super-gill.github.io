// render-start.js — drawStartScreen (scenario select + vessel select)
'use strict';

import { CONFIG, session, ui, L, C } from './panel-context.js';

  export function drawStartScreen(W,H){
    const ctx = L.ctx;
    const {doodleLine, doodleCircle, doodleText, w2s, wScale, PANEL_H, STRIP_W, U} = L.R;
    const PANEL=L.PANEL;
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
      const L2=cW*0.46*sp.ax; const Hw=L2*0.15*sp.hw;
      if(sel){ctx.shadowColor='rgba(100,200,255,0.55)';ctx.shadowBlur=U(12);}
      const bowCapX=-L2+Hw*sp.bR; const sternTaperX=L2*sp.ss; const pts=40;
      ctx.strokeStyle=sel?`rgba(180,230,255,${al})`:`rgba(100,160,220,${al})`; ctx.lineWidth=lw;
      ctx.beginPath();
      for(let i=0;i<=20;i++){const a=Math.PI/2+i/20*Math.PI;const bx=bowCapX+Math.cos(a)*Hw*sp.bR;const by=Math.sin(a)*Hw;const w=Math.sin(i*2.1+t0)*0.3;if(i===0)ctx.moveTo(bx,by+w);else ctx.lineTo(bx,by+w);}
      for(let i=0;i<=pts;i++){const t=i/pts;const x=bowCapX+t*(sternTaperX-bowCapX+L2);let b=1;if(x>sternTaperX)b=Math.pow((L2-x)/(L2-sternTaperX),0.6);ctx.lineTo(x,-Hw*b+Math.sin(t*22+t0)*0.3);}
      for(let i=pts;i>=0;i--){const t=i/pts;const x=bowCapX+t*(sternTaperX-bowCapX+L2);let b=1;if(x>sternTaperX)b=Math.pow((L2-x)/(L2-sternTaperX),0.6);ctx.lineTo(x,Hw*b+Math.sin(t*22+t0+0.5)*0.3);}
      ctx.closePath();ctx.stroke();
      const sailCX=-L2+sp.sf*2*L2;const sW2=sp.sW*2*L2;const sH=Hw*sp.sH;const sailTop=-Hw-sH*0.6;const sailBase=-Hw*0.95;
      ctx.strokeStyle=sel?`rgba(160,220,255,${al*0.85})`:`rgba(80,130,180,${al})`;ctx.lineWidth=lw*0.85;
      ctx.beginPath();ctx.moveTo(sailCX-sW2*0.5,sailBase);ctx.lineTo(sailCX-sW2*0.5,sailTop);ctx.lineTo(sailCX+sW2*0.5,sailTop);ctx.lineTo(sailCX+(sp.rk?sW2*0.72:sW2*0.5),sailBase);ctx.stroke();
      ctx.strokeStyle=sel?`rgba(140,200,240,${al*0.40})`:`rgba(60,110,160,${al*0.45})`;ctx.lineWidth=lw*0.5;
      ctx.beginPath();ctx.moveTo(sailCX-sW2*0.1,sailTop);ctx.lineTo(sailCX-sW2*0.1,sailTop-Hw*0.55);ctx.moveTo(sailCX+sW2*0.1,sailTop);ctx.lineTo(sailCX+sW2*0.1,sailTop-Hw*0.38);ctx.stroke();
      if(sp.bp){const bpX=-L2*0.69;ctx.strokeStyle=sel?`rgba(140,200,240,${al*0.65})`:`rgba(70,110,160,${al*0.70})`;ctx.lineWidth=lw*0.70;ctx.beginPath();ctx.moveTo(bpX,-Hw*0.14);ctx.lineTo(bpX-L2*0.027,-Hw*0.88);ctx.moveTo(bpX,Hw*0.14);ctx.lineTo(bpX-L2*0.027,Hw*0.88);ctx.stroke();}
      const sternX=L2*0.91;ctx.lineWidth=lw*0.75;
      if(sp.st==='pumpjet'){ctx.strokeStyle=sel?`rgba(140,200,240,${al*0.60})`:`rgba(70,110,160,${al*0.60})`;ctx.beginPath();ctx.ellipse(sternX+L2*0.022,0,L2*0.022,Hw*0.72,0,0,Math.PI*2);ctx.stroke();ctx.strokeStyle=sel?`rgba(140,200,240,${al*0.28})`:`rgba(70,110,160,${al*0.28})`;ctx.beginPath();ctx.ellipse(sternX+L2*0.022,0,L2*0.010,Hw*0.35,0,0,Math.PI*2);ctx.stroke();ctx.strokeStyle=sel?`rgba(140,200,240,${al*0.50})`:`rgba(70,110,160,${al*0.55})`;ctx.lineWidth=lw*0.75;ctx.beginPath();ctx.moveTo(sternX-L2*0.04,-Hw*0.18);ctx.lineTo(sternX,-Hw*1.08);ctx.moveTo(sternX-L2*0.04,Hw*0.18);ctx.lineTo(sternX,Hw*1.08);ctx.stroke();}
      else{ctx.strokeStyle=sel?`rgba(120,180,220,${al*0.42})`:`rgba(60,100,150,${al*0.48})`;ctx.beginPath();ctx.arc(sternX+L2*0.038,0,Hw*0.52,0,Math.PI*2);ctx.stroke();ctx.strokeStyle=sel?`rgba(140,200,240,${al*0.50})`:`rgba(70,110,160,${al*0.55})`;ctx.lineWidth=lw*0.75;ctx.beginPath();ctx.moveTo(sternX,-Hw*0.18);ctx.lineTo(sternX+L2*0.033,-Hw*1.12);ctx.moveTo(sternX,Hw*0.18);ctx.lineTo(sternX+L2*0.033,Hw*1.12);ctx.stroke();}
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
    if((ui.startPhase||'scenario')==='vessel'){
      const scenTitles={waves:'WOLFPACK HUNT',duel:'1V1 DUEL',ambush:'AMBUSH',patrol:'BARRIER TRANSIT',ssbn_hunt:'SSBN HUNT',boss_fight:'BOSS FIGHT',asw_taskforce:'ASW TASKFORCE',free_run:'FREE RUN'};
      const selScenTitle=scenTitles[session.scenario]||'SELECT SCENARIO';
      const tab=ui.vesselTab||'player';
      const presets=CONFIG.playerPresets||[];
      const selKey=session.vesselKey||'688i';
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
      ctx.fillText('\u2190 SCENARIO',backX+backW/2,backY+backH*0.68);
      L.PANEL?.btn2(ctx,'',backX,backY,backW,backH,'transparent',()=>{ ui.startPhase='scenario'; ui.vesselScrollY=0; });

      ctx.fillStyle='rgba(140,190,235,0.55)';ctx.font=`${U(13)}px ui-monospace,monospace`;ctx.textAlign='center';
      ctx.letterSpacing='2px';ctx.fillText(selScenTitle+'  \u00b7  SELECT YOUR VESSEL',W/2,hdrH*0.62);ctx.letterSpacing='0px';

      const diveW=U(190),diveH=U(36),diveX=W-diveW-U(20),diveY=(hdrH-diveH)/2;
      ctx.fillStyle='rgba(22,90,150,0.90)';ctx.strokeStyle='rgba(80,180,255,0.70)';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.roundRect(diveX,diveY,diveW,diveH,U(4));ctx.fill();ctx.stroke();
      ctx.fillStyle='#ffffff';ctx.font=`bold ${U(13)}px ui-monospace,monospace`;ctx.textAlign='center';
      ctx.fillText('DIVE \u2014 BEGIN MISSION',diveX+diveW/2,diveY+diveH*0.68);
      L.PANEL?.btn2(ctx,'',diveX,diveY,diveW,diveH,'transparent',()=>{
        const vk=session.vesselKey||'688i';const prs=CONFIG.playerPresets||[];
        const preset=prs.find(p=>p.key===vk)||prs[0];
        if(preset){
          // Merge preset into CONFIG.player — preserves base properties (e.g. casualty configs)
          // that aren't overridden by the vessel preset
          const baseCasualties=CONFIG.player.casualties;
          Object.assign(CONFIG.player, preset);
          // Deep-merge casualties so vessel-specific overrides don't clobber new casualty types
          if(baseCasualties) CONFIG.player.casualties=Object.assign({}, baseCasualties, preset.casualties||{});
        }
        session.started=true;session.scenario=session.scenario||'waves';L.SIM?.resetScenario(session.scenario);
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
        L.PANEL?.btn2(ctx,'',tabX,tabBarY,tabBtnW-U(6),tabH,'transparent',()=>{ ui.vesselTab=_tb.id; ui.vesselScrollY=0; });
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
          ctx.fillText(`${p.nation} \u00b7 ${p.difficulty.toUpperCase()}`,cx,contentY+cellH*0.97);
          const _p=p;
          L.PANEL?.btn2(ctx,'',rowX+i*cellW,contentY,cellW,cellH,'transparent',()=>{ session.vesselKey=_p.key; });
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
        ui.vesselScrollY=Math.max(0,Math.min(ui.vesselScrollY||0,Math.max(0,scTotalH-contentH+U(10))));
        const svScrollY=ui.vesselScrollY||0;
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
    ctx.fillText('COLD WAR SUBMARINE TACTICS  \u25b8  CHOOSE SCENARIO',W/2,H*0.14+U(44));
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
          'similar capability. Pure skill \u2014 the',
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
          'corvette \u2014 all pinging. Go deep, use',
          'the layer, and pick them off.',
        ],
        colour:'rgba(20,60,100,0.90)',
        accent:'rgba(60,160,255,0.85)',
        tag:'EVASION/COMBAT',
      },
      {
        id:'free_run',
        title:'FREE RUN',
        sub:'Systems test \u2014 no enemies',
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
      ui.startScrollY=Math.max(0,Math.min(ui.startScrollY||0,Math.max(0,_totalH-H)));
    }
    const scrollY=ui.startScrollY||0;
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
      const selected=session.scenario===s.id;

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
      L.PANEL?.btn2(ctx,'',cx,cy,cardW,cardH,'transparent',()=>{
        session.scenario=_s.id;
      });
    }

    // Launch button
    const btnW=U(520), btnH=U(104);
    const totalGridH=rows*cardH+(rows-1)*gap;
    const btnX=(W-btnW)/2, btnY=gridY+totalGridH+U(44);
    const selScen=scenarios.find(s=>s.id===session.scenario)||scenarios[0];
    ctx.fillStyle=selScen.colour.replace('0.90','1.0');
    ctx.strokeStyle=selScen.accent;
    ctx.lineWidth=2;
    ctx.beginPath(); ctx.roundRect(btnX,btnY,btnW,btnH,U(8)); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#ffffff';
    ctx.font=`bold ${U(34)}px ui-monospace,monospace`;
    ctx.textAlign='center';
    ctx.fillText('SELECT VESSEL  \u203a',W/2,btnY+btnH*0.65);

    L.PANEL?.btn2(ctx,'',btnX,btnY,btnW,btnH,'transparent',()=>{
      ui.startPhase='vessel';
      ui.startScrollY=0;
    });

    // Controls hint
    ctx.fillStyle='rgba(80,120,160,0.45)';
    ctx.font=`${U(20)}px ui-monospace,monospace`;
    ctx.textAlign='center';
    ctx.fillText('A/D SPEED  \u00b7  W/S DEPTH  \u00b7  SHIFT+CLICK FIRE  \u00b7  R RESTART  \u00b7  ` DEBUG', W/2, btnY+btnH+U(48));

    ctx.restore(); // end scroll translate
  }
