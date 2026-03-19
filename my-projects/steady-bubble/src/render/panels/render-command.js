// render-command.js — drawPanel (command panel with all section functions)
// drawTdcSection is imported from render-tdc.js
'use strict';

import {
  clamp, player, bullets, sonarContacts, tdc,
  session, setMsg, ui,
  L, C, TH,
} from './panel-context.js';
import { drawTdcSection } from './render-tdc.js';

  export function drawPanel(W,H){
    const ctx = L.ctx;
    const {doodleLine, doodleCircle, doodleText, w2s, wScale, PANEL_H, STRIP_W, U} = L.R;
    const PANEL=L.PANEL;
    const DMG=L.DMG;
    const AI=L.AI;
    PANEL.clearBtns();

    const panelH=PANEL_H;
    const panelY=H-panelH;
    const panelW=W-STRIP_W;

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
    ctx.fillStyle=TH.color.text.muted; ctx.font=`${U(TH.font.label)}px ${TH.FONT_FAMILY}`;
    ctx.fillText('ACTUAL',x,panelY+U(33));
    ctx.fillStyle=TH.color.text.primary; ctx.font=`${U(TH.font.valueLg)}px ${TH.FONT_FAMILY}`;
    ctx.fillText(`${Math.round(player.depth)}m`,x,panelY+U(50));
    ctx.fillStyle=TH.color.text.muted; ctx.font=`${U(TH.font.label)}px ${TH.FONT_FAMILY}`;
    ctx.fillText('ORDERED',x+U(64),panelY+U(33));
    ctx.fillStyle=TH.color.text.primary; ctx.font=`${U(TH.font.valueLg)}px ${TH.FONT_FAMILY}`;
    ctx.fillText(`${Math.round(player.depthOrder)}m`,x+U(64),panelY+U(50));
    const arrowY=panelY+U(62);
    const arrowH=U(20);
    const aGap=U(4);
    const aHalf=(w-pad-aGap)/2;
    btn('\u25b2 50',x,       arrowY,aHalf,arrowH,false,()=>PANEL.depthStep(-50));
    btn('\u25b2 10',x+aHalf+aGap,arrowY,aHalf,arrowH,false,()=>PANEL.depthStep(-10));
    btn('\u25bc 50',x,       arrowY+arrowH+U(3),aHalf,arrowH,false,()=>PANEL.depthStep(50));
    btn('\u25bc 10',x+aHalf+aGap,arrowY+arrowH+U(3),aHalf,arrowH,false,()=>PANEL.depthStep(10));
    const pdY=panelY+U(110);
    const atPD=player.depthOrder<=C.player.periscopeDepth+10;
    btn('COME TO PD',x,pdY,w-pad,U(20),atPD,()=>PANEL.comeToPD(),'#1e3a5f');
    const batY=panelY+U(138);
    const batFrac=clamp(player.battery??1.0, 0, 1);
    const batPct=Math.round(batFrac*100);
    const batBarW=w-pad;
    const batBarH=U(7);
    ctx.fillStyle='rgba(17,24,39,0.55)';
    ctx.beginPath(); ctx.roundRect(x,batY,batBarW,batBarH,U(2)); ctx.fill();
    const batR=batPct<20?200:batPct<50?180:60;
    const batG=batPct<20?40:batPct<50?140:180;
    ctx.fillStyle=`rgba(${batR},${batG},200,0.85)`;
    ctx.beginPath(); ctx.roundRect(x,batY,batBarW*batFrac,batBarH,U(2)); ctx.fill();
    ctx.fillStyle=TH.color.text.muted; ctx.font=`${U(TH.font.label)}px ${TH.FONT_FAMILY}`;
    ctx.textAlign='left';
    ctx.fillText('BATTERY',x,batY-U(3));
    ctx.fillStyle=TH.color.text.primary; ctx.font=`${U(TH.font.label)}px ${TH.FONT_FAMILY}`;
    ctx.textAlign='right';
    const batStatus=player._battDead?'DEAD':player.snorkeling?'CHRG':(player.snorkelOrdered?'RISG':'');
    ctx.fillText(batPct+'%'+(batStatus?' '+batStatus:''), x+batBarW, batY-U(3));
    const snkY=panelY+U(152);
    const snkH=U(22);
    if(C.player.isDiesel){
      const ordered=player.snorkelOrdered||false;
      btn(ordered?'CANCEL SNORKEL':'ORDER SNORKEL',x,snkY,w-pad,snkH,ordered,
        ()=>{ player.snorkelOrdered=!player.snorkelOrdered; });
    } else {
      ctx.fillStyle='rgba(17,24,39,0.22)'; ctx.font=`${U(TH.font.label)}px ${TH.FONT_FAMILY}`;
      ctx.textAlign='left';
      ctx.fillText('NUCLEAR \u2014 NO SNORKEL',x,snkY+U(9));
    }
    ctx.textAlign='left';
    }

    function drawTrimSection(x, w) {
    ctx.fillStyle=TH.color.header;
    ctx.font=`${U(TH.font.header)}px ${TH.FONT_FAMILY}`;
    ctx.textAlign='left';
    ctx.fillText('BALLAST & TRIM',x,panelY+U(18));
    {
      const {trim:floodTrim, buoyancy:floodBuoy}=L.DMG?.getTrimState?.()??{trim:0,buoyancy:0};
      const hpa=player.damage?.hpa;
      const hpaC=C.player.hpa||{};
      const diagY=panelY+U(24);
      const diagW=w-pad;
      const g=U(3);
      const trimTH=U(18);
      const trimGap=U(3);
      const mbtH=U(38);
      const fullH=trimTH+trimGap+mbtH;
      const mbtY=diagY+trimTH+trimGap;
      const w1=U(26), w2=U(32), w3=Math.round(diagW-2*(w1+w2)-4*g), w4=U(32), w5=U(26);
      const cx1=x;
      const cx2=cx1+w1+g;
      const cx3=cx2+w2+g;
      const cx4=cx3+w3+g;
      const cx5=cx4+w4+g;
      const diagramRight=cx5+w5;
      const trimFW=w1+g+Math.round(w2*0.6);
      const trimAW=Math.round(w4*0.6)+g+w5;
      const trimAX=diagramRight-trimAW;
      const mbtState = player.damage?.mbt;
      const tankFills = mbtState ? mbtState.tanks : [0.50,0.50,0.50,0.50,0.50];
      const trimFadj = mbtState ? clamp(mbtState.trimF - floodTrim*0.15, 0, 1) : clamp(0.25 - floodTrim*0.15, 0, 1);
      const trimAadj = mbtState ? clamp(mbtState.trimA + floodTrim*0.15, 0, 1) : clamp(0.25 + floodTrim*0.15, 0, 1);
      function mbtCell2(x,y,w,h,frac,label){
        const fx=Math.round(x),fy=Math.round(y),fw=Math.round(w),fh=Math.round(h);
        ctx.fillStyle='rgba(6,12,24,0.85)'; ctx.fillRect(fx,fy,fw,fh);
        if(frac>0){ const fillH=Math.round(fh*Math.min(frac,1)); ctx.fillStyle='rgba(25,70,130,0.80)'; ctx.fillRect(fx+1,fy+fh-fillH,fw-2,fillH); }
        ctx.strokeStyle='rgba(60,90,130,0.55)'; ctx.lineWidth=1; ctx.strokeRect(fx+0.5,fy+0.5,fw-1,fh-1);
        ctx.fillStyle='rgba(148,163,184,0.65)'; ctx.font=`bold ${U(7)}px ui-monospace,monospace`; ctx.textAlign='center'; ctx.fillText(label,fx+fw/2,fy+U(10));
      }
      function trimCell2(x,y,w,h,frac,label){
        const fx=Math.round(x),fy=Math.round(y),fw=Math.round(w),fh=Math.round(h);
        ctx.fillStyle='rgba(10,8,22,0.90)'; ctx.fillRect(fx,fy,fw,fh);
        if(frac>0){ const fillH=Math.round(fh*Math.min(frac,1)); ctx.fillStyle='rgba(65,18,100,0.85)'; ctx.fillRect(fx+1,fy+fh-fillH,fw-2,fillH); }
        ctx.strokeStyle='rgba(130,60,180,0.65)'; ctx.lineWidth=1; ctx.strokeRect(fx+0.5,fy+0.5,fw-1,fh-1);
        ctx.fillStyle='rgba(180,140,220,0.70)'; ctx.font=`bold ${U(7)}px ui-monospace,monospace`; ctx.textAlign='center'; ctx.fillText(label,fx+fw/2,fy+fh/2+U(3));
      }
      trimCell2(cx1,    diagY, trimFW, trimTH, trimFadj, 'T-F');
      trimCell2(trimAX, diagY, trimAW, trimTH, trimAadj, 'T-A');
      mbtCell2(cx1, mbtY, w1, mbtH, tankFills[0], '1');
      mbtCell2(cx2, mbtY, w2, mbtH, tankFills[1], '2');
      mbtCell2(cx3, diagY, w3, fullH, tankFills[2], '3');
      mbtCell2(cx4, mbtY, w4, mbtH, tankFills[3], '4');
      mbtCell2(cx5, mbtY, w5, mbtH, tankFills[4], '5');
      const avgFill = tankFills.reduce((a,b)=>a+b,0)/tankFills.length;
      const baseY   = mbtY + mbtH*(1 - clamp(avgFill,0,1));
      const tiltAmp = clamp(floodTrim/2.0,-1,1)*U(7);
      const totalW  = diagramRight - cx1;
      ctx.save();
      ctx.beginPath(); ctx.rect(Math.round(cx1), Math.round(diagY), Math.round(totalW), Math.round(fullH)); ctx.clip();
      const yLeft  = baseY - tiltAmp;
      const yRight = baseY + tiltAmp;
      ctx.beginPath();
      ctx.moveTo(Math.round(cx1),          Math.round(yLeft));
      ctx.lineTo(Math.round(diagramRight), Math.round(yRight));
      ctx.lineTo(Math.round(diagramRight), Math.round(diagY+fullH));
      ctx.lineTo(Math.round(cx1),          Math.round(diagY+fullH));
      ctx.closePath(); ctx.fillStyle='rgba(20,80,160,0.10)'; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(Math.round(cx1),          Math.round(yLeft));
      ctx.lineTo(Math.round(diagramRight), Math.round(yRight));
      ctx.strokeStyle=Math.abs(floodTrim)>0.5?'rgba(160,90,220,0.75)':'rgba(80,140,200,0.70)';
      ctx.lineWidth=1.5; ctx.stroke();
      ctx.restore();
      const hpaY=diagY+fullH+U(16);
      const maxP  = hpaC.maxPressure   || 207;
      const maxR  = hpaC.reservePressure || 207;
      const ambient = (player.depth||0) * (hpaC.ambientPerMetre||0.1);
      const groupPressure = hpa?.pressure ?? maxP;
      const resPressure   = hpa?.reserve  ?? maxR;
      const pressureFrac  = groupPressure / maxP;
      const ambientFrac   = Math.min(1, ambient / maxP);
      const pCol = pressureFrac>0.40?'rgba(80,210,110,0.95)':pressureFrac>0.15?'rgba(230,170,20,0.95)':'rgba(230,60,60,0.95)';
      ctx.fillStyle='rgba(148,163,184,0.65)'; ctx.font=`bold ${U(9)}px ui-monospace,monospace`; ctx.textAlign='left'; ctx.fillText('HP AIR', x, hpaY);
      ctx.fillStyle=pCol; ctx.font=`bold ${U(16)}px ui-monospace,monospace`; ctx.textAlign='center'; ctx.fillText(`${Math.round(pressureFrac*100)}%`, x+diagW/2, hpaY);
      ctx.fillStyle='rgba(148,163,184,0.70)'; ctx.font=`bold ${U(9)}px ui-monospace,monospace`; ctx.textAlign='right'; ctx.fillText(`${Math.round(groupPressure)}/${maxP}`, x+diagW, hpaY);
      ctx.fillStyle='rgba(100,120,150,0.55)'; ctx.font=`${U(8)}px ui-monospace,monospace`; ctx.fillText('bar', x+diagW, hpaY+U(9));
      const bankG=U(3); const bankH=U(20); const labelH=U(11);
      const bankW=Math.round((diagW - 4*bankG) / 5);
      const banksTotal=5*bankW+4*bankG;
      const banksX=x+Math.round((diagW-banksTotal)/2);
      const bankY=hpaY+U(14);
      for(let i=0;i<4;i++){
        const bx=banksX+i*(bankW+bankG);
        const bankFrac = clamp(pressureFrac, 0, 1);
        const fillCol = bankFrac>0.40?'rgba(30,160,70,0.95)':bankFrac>0.15?'rgba(200,140,0,0.95)':'rgba(210,35,35,0.95)';
        const brdCol  = bankFrac>0.40?'rgba(40,180,80,0.60)':bankFrac>0.15?'rgba(200,150,0,0.55)':'rgba(210,40,40,0.60)';
        ctx.fillStyle='rgba(4,10,20,0.90)'; ctx.fillRect(bx,bankY,bankW,bankH);
        ctx.fillStyle=fillCol; ctx.fillRect(bx+1,bankY+1,Math.round((bankW-2)*bankFrac),bankH-2);
        ctx.strokeStyle=brdCol; ctx.lineWidth=1; ctx.strokeRect(bx+0.5,bankY+0.5,bankW-1,bankH-1);
        if(ambientFrac>0 && ambientFrac<1){ const tickX=bx+1+Math.round((bankW-2)*ambientFrac); ctx.strokeStyle='rgba(240,200,50,1.0)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(tickX,bankY+2); ctx.lineTo(tickX,bankY+bankH-2); ctx.stroke(); }
        ctx.fillStyle='rgba(180,200,230,0.80)'; ctx.font=`bold ${U(9)}px ui-monospace,monospace`; ctx.textAlign='center'; ctx.fillText(`B${i+1}`, bx+bankW/2, bankY+bankH+labelH*0.75);
      }
      { const bx=banksX+4*(bankW+bankG);
        const resFrac=clamp(resPressure/maxR,0,1);
        const resCol=resFrac>0.30?'rgba(180,130,0,0.95)':'rgba(180,25,25,0.95)';
        ctx.fillStyle='rgba(4,10,20,0.90)'; ctx.fillRect(bx,bankY,bankW,bankH);
        ctx.fillStyle=resCol; ctx.fillRect(bx+1,bankY+1,Math.round((bankW-2)*resFrac),bankH-2);
        ctx.strokeStyle='rgba(220,170,30,0.85)'; ctx.lineWidth=1.5; ctx.strokeRect(bx+0.5,bankY+0.5,bankW-1,bankH-1);
        ctx.fillStyle='rgba(230,190,60,0.90)'; ctx.font=`bold ${U(9)}px ui-monospace,monospace`; ctx.textAlign='center'; ctx.fillText('RES', bx+bankW/2, bankY+bankH+labelH*0.75);
      }
      const ctrlY=bankY+bankH+labelH+U(4);
      const ctrlW=Math.round((diagW-bankG)/2);
      const ctrlH=U(18);
      const venting   = player._blowVenting||false;
      const pending   = player._blowPending||false;
      const manual    = (player._blowManualT||0)>0;
      const blowActive= venting||pending||manual;
      const noHPA     = pressureFrac < 0.02;
      const blowLabel = venting?'BLOW \u2014 VENTING':pending?'BLOW \u2014 STANDBY':manual?'BLOW \u2014 MANUAL':noHPA?'NO HP AIR':'BLOW BALLAST';
      const blowState = (noHPA||blowActive)?'unavailable':'emergency';
      btn(blowLabel,x,ctrlY,ctrlW,ctrlH,blowActive&&!noHPA,()=>PANEL.emergencyBlowBallast(),'#7c1010',blowState);
      const rechg     = hpa?.recharging||false;
      const atSurfaceR= (player.depth||0)<=20;
      btn(rechg?'RECHARGE \u25a0':'HP RECHARGE',x+ctrlW+bankG,ctrlY,ctrlW,ctrlH,rechg&&atSurfaceR,()=>PANEL.toggleHPARecharge(),'#1e3a5f',atSurfaceR?'available':'unavailable');
    }
    }

    function drawStatusSection(x, w) {
    ctx.fillStyle=TH.color.header; ctx.font=`${U(TH.font.header)}px ${TH.FONT_FAMILY}`; ctx.textAlign='left'; ctx.fillText('STATUS',x,panelY+U(18));
    ctx.fillStyle=TH.color.text.muted; ctx.font=`${U(TH.font.label)}px ${TH.FONT_FAMILY}`; ctx.fillText('SPD',x,panelY+U(33));
    ctx.fillStyle=TH.color.text.primary; ctx.font=`${U(TH.font.valueLg)}px ${TH.FONT_FAMILY}`;
    const ordKts=Math.round(player.speedOrderKts??0);
    ctx.fillText(`${Math.round(player.speed)}kt`,x,panelY+U(50));
    ctx.fillStyle=TH.color.text.muted; ctx.font=`${U(TH.font.label)}px ${TH.FONT_FAMILY}`; ctx.fillText(`ORD ${ordKts}kt`,x+U(50),panelY+U(50));
    const spdBtnY2=panelY+U(52); const spdBtnW2=(w-pad-U(6))/4; const spdBtnH2=U(14);
    btn('-5',x,spdBtnY2,spdBtnW2,spdBtnH2,false,()=>PANEL.setSpeedKts(ordKts-5),'#374151');
    btn('-1',x+spdBtnW2+U(2),spdBtnY2,spdBtnW2,spdBtnH2,false,()=>PANEL.setSpeedKts(ordKts-1),'#374151');
    btn('+1',x+2*(spdBtnW2+U(2)),spdBtnY2,spdBtnW2,spdBtnH2,false,()=>PANEL.setSpeedKts(ordKts+1),'#1e3a5f');
    btn('+5',x+3*(spdBtnW2+U(2)),spdBtnY2,spdBtnW2,spdBtnH2,false,()=>PANEL.setSpeedKts(ordKts+5),'#1e3a5f');
    if((session.wave||0)>1 || (session.waveDelay||0)>0){
      ctx.fillStyle=TH.color.text.muted; ctx.font=`${U(TH.font.label)}px ${TH.FONT_FAMILY}`; ctx.fillText('WAVE',x+U(100),panelY+U(33));
      ctx.fillStyle=TH.color.text.primary; ctx.font=`${U(TH.font.valueLg)}px ${TH.FONT_FAMILY}`; ctx.fillText(`${session.wave||1}`,x+U(100),panelY+U(50));
    }
    if(session.waveDelay>0){ const blink=Math.sin(performance.now()*0.006)>0; ctx.fillStyle=blink?'rgba(220,38,38,0.80)':'rgba(220,38,38,0.30)'; ctx.font=`bold ${U(8)}px ui-monospace,monospace`; ctx.fillText(`NEXT WAVE ${Math.ceil(session.waveDelay)}s`,x,panelY+U(68)); }
    if(session.groupState==='prosecuting'){ ctx.fillStyle='rgba(220,38,38,0.75)'; ctx.font=`bold ${U(7)}px ui-monospace,monospace`; ctx.fillText('\u26A0 PROSECUTING',x,panelY+U(68)); }
    const barW=w-pad*2, barH=U(11); const dmg=player.damage;
    const noiseBarY=panelY+U(72); const noisePct=clamp(player.noise,0,1);
    ctx.fillStyle='rgba(17,24,39,0.40)'; ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.fillText('NOISE',x,noiseBarY-2);
    ctx.fillStyle='rgba(17,24,39,0.10)'; ctx.fillRect(x,noiseBarY,barW,barH);
    ctx.fillStyle=noisePct>0.5?'#dc2626':'#334155'; ctx.fillRect(x,noiseBarY,barW*noisePct,barH);
    if(dmg){
      const damaged=Object.entries(dmg.systems).filter(([,s])=>s!=='nominal').sort(([,a],[,b])=>DMG.STATES.indexOf(b)-DMG.STATES.indexOf(a)).slice(0,3);
      const pillY=noiseBarY+barH+U(10); const stCol={'degraded':'#b45309','offline':'#dc2626','destroyed':'#7f1d1d'};
      let px=x;
      for(const [sys,st] of damaged){ const label=DMG.SYS_LABEL[sys]?.slice(0,6)||sys.slice(0,6).toUpperCase(); ctx.fillStyle=stCol[st]||'#dc2626'; ctx.font=`bold ${U(7.5)}px ui-monospace,monospace`; ctx.textAlign='left'; ctx.fillText(`${label}:${st.slice(0,3).toUpperCase()}`,px,pillY); px+=U(58); if(px>x+barW) break; }
      const hasDmg=damaged.length>0||Object.values(dmg.flooding).some(f=>f>0);
      const blink=hasDmg&&(Math.sin(performance.now()*0.007)>0);
      const dmgBtnY=noiseBarY+barH+U(8);
      btn('\u26a1 DMG CTRL',x,dmgBtnY,barW,U(17),ui.showDamageScreen,()=>{ui.showDamageScreen=!ui.showDamageScreen;},blink?'#991b1b':'#1e3a5f');
      const hasNewDcLog=(session.dcLog||[]).length>0&&ui.logTab!=='dc';
      const dcBlink=hasNewDcLog&&(Math.sin(performance.now()*0.007)>0);
      btn('\ud83d\udccb DMG LOG',x,dmgBtnY+U(20),barW,U(17),ui.logTab==='dc',()=>{ui.logTab=ui.logTab==='dc'?'log':'dc';},dcBlink?'#7c3a00':'#1e3a5f');
      btn('\ud83d\udc65 CREW',x,dmgBtnY+U(40),barW,U(17),ui.showDamageScreen,()=>{ui.showDamageScreen=!ui.showDamageScreen;},'#1e3a5f');
    }
    }

    function drawPostureSection(x, w) {
    const pbH=U(21), pbW=w-pad; const halfW=(pbW-U(4))/2;
    ctx.fillStyle=TH.color.header; ctx.font=`${U(TH.font.header)}px ${TH.FONT_FAMILY}`; ctx.textAlign='left'; ctx.fillText('POSTURE',x,panelY+U(18));
    const tState=session.tacticalState||'cruising'; const cState=session.casualtyState||'normal';
    const stateLabel=cState==='escape'?'ESCAPE STA':cState==='emergency'?'EMRG STA':tState==='action'?'ACTION STA':tState==='patrol'?'PATROL ST':'CRUIS WATCH';
    const stateBg=cState==='escape'?'rgba(180,20,20,0.90)':cState==='emergency'?'rgba(160,60,0,0.85)':tState==='action'?'rgba(120,0,0,0.75)':tState==='patrol'?'rgba(92,64,10,0.70)':'rgba(17,24,39,0.55)';
    const stateFlash=cState==='escape'||cState==='emergency';
    const stateVisible=!stateFlash||(Math.floor(Date.now()/400)%2===0);
    if(stateVisible){ ctx.fillStyle=stateBg; ctx.beginPath(); ctx.roundRect(x,panelY+U(27),pbW,pbH,3); ctx.fill(); ctx.fillStyle='#f8f6f0'; ctx.font=`bold ${U(11)}px ui-monospace,monospace`; ctx.textAlign='center'; ctx.fillText(stateLabel,x+pbW/2,panelY+U(27)+pbH*0.68); }
    if(cState==='normal'||cState==='patrol') PANEL.registerBtn(x,panelY+U(27),pbW,pbH,()=>PANEL.callActionStations());
    btn('\u25c6 SILENT',x,panelY+U(52),pbW,pbH,player.silent,()=>PANEL.toggleSilent(),'#1e3a5f');
    btn('ALL STOP',x,panelY+U(77),pbW,pbH,PANEL.telegraphIdx===5,()=>PANEL.allStop());
    if(C.player.hasTowedArray !== false){
    { const ta=player.towedArray; const taState=ta?.state||'stowed';
      const taActive=taState==='operational'||taState==='damaged'||taState==='deploying'||taState==='retracting';
      const taCol=taState==='operational'?'#1e3a5f':taState==='damaged'?'#92400e':taState==='destroyed'?'rgba(120,20,20,0.55)':'rgba(17,24,39,0.55)';
      ctx.font=`${U(8)}px ui-monospace,monospace`; ctx.textAlign='left';
      const taStateStr=taState==='operational'?'OPERATIONAL':taState==='damaged'?'DAMAGED':taState==='destroyed'?'DESTROYED':taState==='deploying'?`DEPLOYING ${Math.round((1-(ta.progress||0))*30)}s`:taState==='retracting'?`RETRACTING ${Math.round((ta.progress||0)*20)}s`:'STOWED';
      const taStateCol=taState==='operational'?'rgba(22,163,74,0.75)':taState==='damaged'?'rgba(217,119,6,0.80)':taState==='destroyed'?'rgba(150,30,30,0.70)':'rgba(17,24,39,0.35)';
      ctx.fillStyle='rgba(17,24,39,0.30)'; ctx.fillText('ARRAY',x,panelY+U(112));
      ctx.fillStyle=taStateCol; ctx.fillText(taStateStr,x+U(36),panelY+U(112));
      if(taState==='deploying'||taState==='retracting'){ const bx=x, by=panelY+U(115), bw=pbW, bh=U(3); ctx.fillStyle='rgba(17,24,39,0.10)'; ctx.fillRect(bx,by,bw,bh); ctx.fillStyle='rgba(17,24,39,0.45)'; ctx.fillRect(bx,by,bw*(ta.progress||0),bh); }
      if(taState!=='destroyed') btn(taActive?'RETRACT ARRAY':'DEPLOY ARRAY',x,panelY+U(119),pbW,pbH,taActive&&taState!=='deploying',()=>PANEL.toggleTowedArray(),taCol);
    }
    } else { ctx.fillStyle='rgba(17,24,39,0.22)'; ctx.font=`${U(8)}px ui-monospace,monospace`; ctx.textAlign='left'; ctx.fillText('NO TOWED ARRAY',x,panelY+U(112)); }
    }

    function drawEmergencySection(x, w) {
    const ebH=U(20), egap=U(4); const ebW=w-pad;
    ctx.fillStyle=TH.color.header; ctx.font=`${U(TH.font.header)}px ${TH.FONT_FAMILY}`; ctx.textAlign='left'; ctx.fillText('EMERGENCY',x,panelY+U(18));
    btn('EMERGENCY TURN',x,panelY+U(27),ebW,ebH,player.emergTurnT>0,()=>PANEL.emergencyTurn(),'#7f1d1d',player.emergTurnT>0?'emergency':'available');
    btn('CRASH DIVE',x,panelY+U(51),ebW,ebH,player._crashDiving,()=>PANEL.emergencyCrashDive(),'#7f1d1d',player._crashDiving?'emergency':'available');
    }

    function drawWeaponsSection(x, w) {
    ctx.fillStyle=TH.color.header; ctx.font=`${U(TH.font.header)}px ${TH.FONT_FAMILY}`; ctx.textAlign='left'; ctx.fillText('WEAPONS',x,panelY+U(18));
    function weaponRow(label,cd,maxCd,y,actionLabel,action){
      const rdy=cd<=0; const rowH=U(22); const actW=U(38); const gap=U(4);
      const wbW=w-actW-gap-U(4);
      ctx.fillStyle='rgba(17,24,39,0.08)'; ctx.fillRect(x,y,wbW,rowH-U(3));
      if(!rdy){ ctx.fillStyle='rgba(17,24,39,0.20)'; ctx.fillRect(x,y,wbW*clamp(1-cd/maxCd,0,1),rowH-U(3)); } else { ctx.fillStyle='rgba(30,58,95,0.15)'; ctx.fillRect(x,y,wbW,rowH-U(3)); }
      ctx.fillStyle=rdy?'#111827':'rgba(17,24,39,0.35)'; ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.textAlign='left';
      ctx.fillText(label+(rdy?' RDY':` ${cd.toFixed(1)}s`),x+U(3),y+rowH*0.70);
      if(rdy) btn(actionLabel,x+wbW+gap,y,actW,rowH-U(3),false,action,'#1e3a5f');
    }
    { const tubes=player.torpTubes||[]; const tubeLoad=player.tubeLoad||[]; const tubeOp=player.tubeOp||null;
      const stock=typeof player.torpStock==='number'?player.torpStock:0; const mStock=player.missileStock||0;
      const reloadTime=C.player.torpReloadTime||28; const fireDelay=C.player.fireDelay||1.8;
      const pending=player.pendingFires||[]; const hdrY=panelY+U(18);
      const outOfAmmo=stock<=0&&mStock<=0&&pending.length===0; const allBusy=tubes.length>0&&tubes.every(t=>t>0);
      const selTube=ui.wirePanel?.selectedTube??0;
      ctx.fillStyle=outOfAmmo?'rgba(17,24,39,0.28)':'#111827'; ctx.font=`bold ${U(11)}px ui-monospace,monospace`; ctx.textAlign='left'; ctx.fillText('TUBES',x+U(3),hdrY+U(11));
      ctx.font=`bold ${U(11)}px ui-monospace,monospace`; ctx.fillStyle=outOfAmmo?'rgba(17,24,39,0.20)':'#111827'; ctx.textAlign='right';
      const stockStr=`${stock}T${mStock>0?' '+mStock+'M':''}`; ctx.fillText(stockStr,x+w-U(5),hdrY+U(11));
      const pipGap=U(3); const pipStartX=x+U(3); const pipY=hdrY+U(16);
      const availW=w-U(8); const pipW=Math.min(U(18), (availW-pipGap*(tubes.length-1))/tubes.length); const pipH=U(30);
      for(let i=0;i<tubes.length;i++){
        const px=pipStartX+i*(pipW+pipGap);
        const wireOccupied=tubes[i]===-1||(player.tubeWires?.[i]?.wire?.live===true);
        const ready=tubes[i]===0&&!wireOccupied; const load=tubeLoad[i]; const isMissileLoad=load&&load!=='torp';
        const hasShell=ready&&load!=null&&(isMissileLoad?(mStock>0||true):stock>0);
        const pf=pending.find(p=>p.tubeIdx===i); const isSelected=i===selTube; const isOpTube=tubeOp?.tubeIdx===i;
        if(isSelected&&!pf&&!wireOccupied){ ctx.fillStyle='rgba(30,58,95,0.10)'; ctx.fillRect(px-U(1),pipY-U(1),pipW+U(2),pipH+U(2)); }
        ctx.fillStyle='rgba(17,24,39,0.08)'; ctx.fillRect(px,pipY,pipW,pipH);
        if(pf){ const frac=clamp(1-pf.t/fireDelay,0,1); const pulse=0.5+0.5*Math.sin(performance.now()*0.008); ctx.fillStyle=`rgba(180,100,0,${0.25+pulse*0.20})`; ctx.fillRect(px,pipY,pipW,pipH); ctx.fillStyle='rgba(180,100,0,0.55)'; ctx.fillRect(px,pipY+pipH*(1-frac),pipW,pipH*frac); ctx.fillStyle='rgba(160,80,0,0.90)'; ctx.font=`${U(8)}px ui-monospace,monospace`; ctx.textAlign='center'; ctx.fillText(pf.doorsLogged?'FIRE':'FLOOD',px+pipW/2,pipY+pipH*0.62);
        } else if(wireOccupied){ const pulse=0.5+0.5*Math.sin(performance.now()*0.006); ctx.fillStyle=`rgba(13,148,136,${0.25+pulse*0.15})`; ctx.fillRect(px,pipY,pipW,pipH); ctx.fillStyle='rgba(13,148,136,0.90)'; ctx.font=`bold ${U(7)}px ui-monospace,monospace`; ctx.textAlign='center'; ctx.fillText('WIRE',px+pipW/2,pipY+pipH*0.45); ctx.fillText(`T${i+1}`,px+pipW/2,pipY+pipH*0.72);
        } else if(isOpTube){ const frac=clamp(tubeOp.progress/tubeOp.totalT,0,1); ctx.fillStyle='rgba(120,80,20,0.22)'; ctx.fillRect(px,pipY+pipH*(1-frac),pipW,pipH*frac); ctx.fillStyle='rgba(180,140,60,0.75)'; ctx.font=`${U(7)}px ui-monospace,monospace`; ctx.textAlign='center'; const opLbl=tubeOp.type==='unload'?'OUT':tubeOp.type==='strike'?'SWAP':'IN'; ctx.fillText(opLbl,px+pipW/2,pipY+pipH*0.52); ctx.fillText(Math.ceil(tubeOp.totalT-tubeOp.progress)+'s',px+pipW/2,pipY+pipH*0.78);
        } else if(!ready&&tubes[i]>0){ const frac=clamp(1-tubes[i]/reloadTime,0,1); ctx.fillStyle='rgba(17,24,39,0.18)'; ctx.fillRect(px,pipY+pipH*(1-frac),pipW,pipH*frac); ctx.fillStyle='rgba(17,24,39,0.45)'; ctx.font=`${U(8)}px ui-monospace,monospace`; ctx.textAlign='center'; ctx.fillText(Math.ceil(tubes[i])+'s',px+pipW/2,pipY+pipH*0.62);
        } else if(hasShell){ const col=isMissileLoad?'rgba(100,40,120,0.55)':'rgba(30,58,95,0.55)'; const colTxt=isMissileLoad?'rgba(200,140,220,0.95)':'rgba(30,58,95,0.95)'; ctx.fillStyle=col; ctx.fillRect(px,pipY,pipW,pipH); ctx.fillStyle=colTxt; ctx.font=`bold ${U(7)}px ui-monospace,monospace`; ctx.textAlign='center'; const torpWpn=C.weapons?.[C.player.torpWeapon]; const loadAbbr=isMissileLoad?(C.weapons?.[load]?.shortLabel||load).slice(0,4):(torpWpn?.shortLabel||'TORP').slice(0,4); ctx.fillText(loadAbbr,px+pipW/2,pipY+pipH*0.42); ctx.fillText('\u25b6',px+pipW/2,pipY+pipH*0.75);
        } else if(load===null||load===undefined){ ctx.fillStyle='rgba(17,24,39,0.06)'; ctx.fillRect(px,pipY,pipW,pipH); ctx.fillStyle='rgba(17,24,39,0.30)'; ctx.font=`${U(7)}px ui-monospace,monospace`; ctx.textAlign='center'; ctx.fillText('MT',px+pipW/2,pipY+pipH*0.62);
        } else { ctx.fillStyle='rgba(17,24,39,0.06)'; ctx.fillRect(px,pipY,pipW,pipH); }
        const selBorder=isSelected?'rgba(100,150,220,0.55)':null;
        ctx.strokeStyle=selBorder||(wireOccupied?'rgba(13,148,136,0.70)':pf?'rgba(180,100,0,0.70)':isMissileLoad?'rgba(160,80,200,0.60)':hasShell?'rgba(30,58,95,0.60)':ready?'rgba(17,24,39,0.15)':'rgba(17,24,39,0.25)');
        ctx.lineWidth=isSelected?2:pf?1.5:1; ctx.strokeRect(px,pipY,pipW,pipH);
        btn('',px,pipY,pipW,pipH,false,()=>{ if(ui.wirePanel) ui.wirePanel.selectedTube=i; },'transparent');
      }
      { const lmY=pipY+pipH+U(4); const lmH=U(18);
        const wireOnSel=tubes[selTube]===-1||(player.tubeWires?.[selTube]?.wire?.live===true);
        const selLoad=tubeLoad[selTube]; const selState=tubes[selTube]; const opOnSel=tubeOp?.tubeIdx===selTube; const opBusy=!!tubeOp;
        const misTypes=C.player.missileTypes||[];
        const lmX=x, lmW=w-U(3), lmGap=U(2);
        ctx.font=`${U(8)}px ui-monospace,monospace`; ctx.textAlign='left';
        if(wireOnSel){ ctx.fillStyle='rgba(13,148,136,0.50)'; ctx.fillText(`T${selTube+1} WIRE LIVE`,lmX+U(3),lmY+U(13));
        } else if(opOnSel){ const frac=clamp(tubeOp.progress/tubeOp.totalT,0,1); ctx.fillStyle='rgba(17,24,39,0.12)'; ctx.fillRect(lmX,lmY,lmW,lmH); ctx.fillStyle='rgba(180,140,60,0.35)'; ctx.fillRect(lmX,lmY,lmW*frac,lmH); ctx.fillStyle='rgba(180,140,60,0.80)'; const opLabels={load:'LOADING',unload:'UNLOADING',strike:'STRIKE RELOAD'}; ctx.fillText(`${opLabels[tubeOp.type]||'BUSY'} T${selTube+1}  ${Math.ceil(tubeOp.totalT-tubeOp.progress)}s`,lmX+U(3),lmY+U(13));
        } else if(selLoad==null){ const nOpts=1+misTypes.length; const btnW2=(lmW-(nOpts-1)*lmGap)/nOpts; let bx=lmX;
          btn('LD TORP',bx,lmY,btnW2,lmH,opBusy,()=>L.orderLoad?.(selTube,'torp'),opBusy?'rgba(17,24,39,0.10)':'rgba(17,24,39,0.25)'); bx+=btnW2+lmGap;
          for(const mk of misTypes){ const ml=(C.weapons?.[mk]?.shortLabel||mk).slice(0,6); const canLoad=(mStock>0)&&!opBusy; btn(`LD ${ml}`,bx,lmY,btnW2,lmH,!canLoad,()=>L.orderLoad?.(selTube,mk),canLoad?'rgba(100,40,120,0.30)':'rgba(17,24,39,0.10)'); bx+=btnW2+lmGap; }
        } else { const nOpts=1+(selLoad==='torp'?misTypes.length:1+misTypes.filter(mk=>mk!==selLoad).length); const btnW2=(lmW-(nOpts-1)*lmGap)/Math.max(nOpts,1); let bx=lmX;
          const canAct=!opBusy&&selState===0;
          btn('UNLOAD',bx,lmY,btnW2,lmH,!canAct,()=>L.orderUnload?.(selTube),canAct?'rgba(17,24,39,0.25)':'rgba(17,24,39,0.10)'); bx+=btnW2+lmGap;
          if(selLoad!=='torp'){ const canChg=canAct&&(stock>0); btn('CHG TORP',bx,lmY,btnW2,lmH,!canChg,()=>L.orderStrikeReload?.(selTube,'torp'),canChg?'rgba(17,24,39,0.25)':'rgba(17,24,39,0.10)'); bx+=btnW2+lmGap;
          } else { for(const mk of misTypes){ const ml=(C.weapons?.[mk]?.shortLabel||mk).slice(0,6); const canChg=canAct&&(mStock>0); btn(`CHG ${ml}`,bx,lmY,btnW2,lmH,!canChg,()=>L.orderStrikeReload?.(selTube,mk),canChg?'rgba(100,40,120,0.30)':'rgba(17,24,39,0.10)'); bx+=btnW2+lmGap; } }
        }
      }
      ctx.textAlign='left'; ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.fillStyle='rgba(17,24,39,0.40)';
      const hasPending=pending.length>0; const statusStr=outOfAmmo?'DRY':hasPending?'FIRING\u2026':allBusy?'RELOADING':'SHIFT+CLICK AIM  F FIRE';
      ctx.fillText(statusStr,pipStartX,pipY+pipH+U(10)+U(22));
    }
    weaponRow('ACTIVE PING [SPACE]',player.pingCd,C.player.pingCd,panelY+U(124),'PING',()=>{ if(player.pingCd<=0){ L.SENSE?.activePing(); setMsg('PING!',0.8); }});
    const cmStock=player.cmStock??0; const cmLabel=cmStock>0?`CM [X] x${cmStock}`:'CM [X] EMPTY';
    weaponRow(cmLabel,player.cmCd,C.player.cmCd,panelY+U(154),cmStock>0?'DEPLOY':'---',()=>{ if(L.W&&player.cmCd<=0&&cmStock>0){ player.cmStock--; player.cmCd=C.player.cmCd; L.W.deployDecoy(player.wx,player.wy,true,'noisemaker',{depth:player.depth}); player.noiseTransient=Math.min(1,player.noiseTransient+0.10); setMsg('NOISEMAKER OUT',0.9); }});
    }

    function drawMastSection(x, w) {
      const masts=player.masts||[]; const cfgs=C.player.masts||[]; if(!cfgs.length) return;
      ctx.fillStyle=TH.color.header; ctx.font=`${U(TH.font.header)}px ${TH.FONT_FAMILY}`; ctx.textAlign='left'; ctx.fillText('MASTS',x,panelY+U(18));
      const rowH=U(26), rowGap=U(3); const btnW2=U(38), btnH2=U(18);
      for(let i=0;i<cfgs.length;i++){
        const cfg=cfgs[i]; const m=masts[i]||{state:'down',t:0}; const ry=panelY+U(24)+i*(rowH+rowGap);
        const stateCol=m.state==='up'?'rgba(22,163,74,0.80)':m.state==='damaged'?'rgba(180,30,30,0.80)':(m.state==='raising'||m.state==='lowering')?'rgba(146,64,14,0.80)':'rgba(17,24,39,0.30)';
        ctx.fillStyle=stateCol; ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.textAlign='left'; ctx.fillText(cfg.label,x,ry+U(12));
        const stateStr=m.state==='up'?'UP':m.state==='damaged'?'LOST':m.state==='raising'?`\u2191${Math.ceil(m.t)}s`:m.state==='lowering'?`\u2193${Math.ceil(m.t)}s`:'DOWN';
        ctx.fillStyle=stateCol; ctx.font=`${U(8)}px ui-monospace,monospace`; ctx.textAlign='left'; ctx.fillText(stateStr,x+U(56),ry+U(12));
        if(m.state!=='damaged'){ const isUp=m.state==='up'||m.state==='raising'; const bLabel=isUp?'LOWER':'RAISE'; const bCol=isUp?'rgba(127,29,29,0.65)':'rgba(17,58,39,0.65)'; PANEL.btn2(ctx,bLabel,x+w-pad-btnW2,ry,btnW2,btnH2,bCol,()=>L.toggleMast?.(cfg.key)); }
        if((m.state==='up'||m.state==='raising')&&player.depth>(cfg.safeDepth+5)&&player.depth<=cfg.crushDepth){ const blink=Math.sin(performance.now()*0.012)>0; if(blink){ ctx.fillStyle='rgba(220,150,0,0.22)'; ctx.beginPath(); ctx.roundRect(x,ry-U(2),w-pad,rowH,2); ctx.fill(); } }
        if((m.state==='up'||m.state==='raising')&&player.depth>cfg.crushDepth){ const blink=Math.sin(performance.now()*0.020)>0; if(blink){ ctx.fillStyle='rgba(220,38,38,0.28)'; ctx.beginPath(); ctx.roundRect(x,ry-U(2),w-pad,rowH,2); ctx.fill(); } }
      }
    }

    function drawWireSection(x, w) {
    { const WP = L.wirePanel; const nTubes = C.player.torpTubes||4; const selTube = ui.wirePanel?.selectedTube??0; const tubeWires = player.tubeWires||[];
      ctx.fillStyle=TH.color.header; ctx.font=`${U(TH.font.header)}px ${TH.FONT_FAMILY}`; ctx.textAlign='left'; ctx.fillText('WIRES',x,panelY+U(18));
      const tabW=(w-pad)/nTubes, tabH=U(16);
      for(let i=0;i<nTubes;i++){ const torp=tubeWires[i]; const wireLive=torp?.wire?.live; const active=i===selTube; const tabX=x+i*tabW;
        const tabCol=wireLive?(active?'#1e3a5f':'rgba(30,58,95,0.35)'):(active?'rgba(17,24,39,0.18)':'rgba(17,24,39,0.06)');
        ctx.fillStyle=tabCol; ctx.beginPath(); ctx.roundRect(tabX,panelY+U(22),tabW-U(2),tabH,U(2)); ctx.fill();
        ctx.fillStyle=wireLive?'#e2e8f0':'rgba(17,24,39,0.45)'; ctx.font=`bold ${U(8.5)}px ui-monospace,monospace`; ctx.textAlign='center'; ctx.fillText(`T${i+1}`,tabX+tabW/2-U(1),panelY+U(22)+tabH*0.72);
        PANEL.btn2(ctx,'',tabX,panelY+U(22),tabW-U(2),tabH,'transparent',()=>WP.selectWireTube(i));
      }
      const torp = tubeWires[selTube]; const wireLive = torp?.wire?.live; const detY = panelY+U(44);
      if(wireLive){
        const paidOut = torp.wire.paidOut||0; const nm = paidOut/185.2;
        const curAng = Math.atan2(torp.vy,torp.vx); const hdgDeg = (((Math.atan2(Math.cos(curAng),-Math.sin(curAng))*180/Math.PI)+360)%360);
        const seekerOn = torp.traveled>=(torp.enableDist||0); const locked = !!torp.target && !torp.seducedBy; const autoTDC = torp.wire.autoTDC;
        ctx.fillStyle='rgba(34,197,94,0.85)'; ctx.font=`bold ${U(9)}px ui-monospace,monospace`; ctx.textAlign='left'; ctx.fillText(`WIRE LIVE`,x,detY);
        ctx.fillStyle='rgba(17,24,39,0.55)'; ctx.font=`${U(8.5)}px ui-monospace,monospace`; ctx.fillText(`${nm.toFixed(1)}nm paid out`,x+U(60),detY);
        ctx.fillStyle='rgba(17,24,39,0.55)'; ctx.font=`${U(8.5)}px ui-monospace,monospace`; ctx.fillText('HDG',x,detY+U(13));
        ctx.fillStyle='#111827'; ctx.font=`${U(13)}px ui-monospace,monospace`; ctx.fillText(`${Math.round(hdgDeg).toString().padStart(3,'0')}\u00b0`,x,detY+U(26));
        ctx.fillStyle='rgba(17,24,39,0.55)'; ctx.font=`${U(8.5)}px ui-monospace,monospace`; ctx.fillText('SEEKER',x+U(55),detY+U(13));
        const seekLabel=!seekerOn?'ARMING':locked?'LOCKED':'SRCH'; const seekCol=!seekerOn?'rgba(100,100,100,0.70)':locked?'rgba(220,38,38,0.85)':'rgba(234,179,8,0.85)';
        ctx.fillStyle=seekCol; ctx.font=`bold ${U(11)}px ui-monospace,monospace`; ctx.fillText(seekLabel,x+U(55),detY+U(26));
        if(torp.wire.cmdBrg!=null){ const cmdDeg=(((Math.atan2(Math.cos(torp.wire.cmdBrg),-Math.sin(torp.wire.cmdBrg))*180/Math.PI)+360)%360); ctx.fillStyle='rgba(17,24,39,0.45)'; ctx.font=`${U(8)}px ui-monospace,monospace`; ctx.textAlign='left'; ctx.fillText(`CMD ${Math.round(cmdDeg).toString().padStart(3,'0')}\u00b0${autoTDC?' [TDC]':''}`,x,detY+U(38)); }
        const bH=U(15), bY=detY+U(44);
        PANEL.btn2(ctx,autoTDC?'AUTO TDC \u2713':'AUTO TDC',x,bY,w-pad*2,bH,autoTDC?'rgba(30,58,95,0.70)':'rgba(17,24,39,0.12)',()=>WP.wireAutoTDC(selTube,!autoTDC));
        const nudgeY=bY+bH+U(3); const nudgeW=(w-pad*2-U(4))/4;
        const nudgeCols=['rgba(17,24,39,0.35)','rgba(17,24,39,0.20)','rgba(17,24,39,0.20)','rgba(17,24,39,0.35)'];
        const nudges=[[-10,'\u25c4\u25c4'],[-5,'\u25c4 PORT'],['+5 STBD \u25ba'],['+10','\u25ba\u25ba']]; const nudgeDeg=[-10,-5,5,10];
        for(let ni=0;ni<4;ni++) PANEL.btn2(ctx,nudges[ni][1]??nudges[ni][0],x+ni*(nudgeW+U(1)),nudgeY,nudgeW,bH,nudgeCols[ni],()=>WP.wireNudge(selTube,nudgeDeg[ni]));
        const cutY=nudgeY+bH+U(3); PANEL.btn2(ctx,'CUT WIRE',x,cutY,w-pad*2,bH+U(2),'rgba(127,29,29,0.65)',()=>WP.wireCut(selTube));
      } else {
        ctx.fillStyle='rgba(17,24,39,0.25)'; ctx.font=`${U(8.5)}px ui-monospace,monospace`; ctx.textAlign='left';
        const tubeSt=player.torpTubes?.[selTube]??0; const stLabel=tubeSt>0?`RELOADING ${tubeSt.toFixed(0)}s`:tubeSt===-1?'OCCUPIED':'READY';
        ctx.fillText(stLabel,x,detY+U(10)); ctx.fillText('No wire',x,detY+U(22));
      }
    }
    }

    function drawVlsSection(x, w) {
      const nCells = C.player.vlsCells || 0; const cells  = player.vlsCells || [];
      const wType  = C.player.vlsWeapon; const wLabel = wType ? (C.weapons?.[wType]?.shortLabel || wType.toUpperCase()).slice(0,6) : '?';
      const hasSolution = !!session.ascmSolution; const readyCount  = cells.filter(c => c?.state === 'ready').length;
      ctx.fillStyle = TH.color.header; ctx.font = `${U(TH.font.header)}px ${TH.FONT_FAMILY}`; ctx.textAlign = 'left'; ctx.fillText('VLS', x, panelY+U(18));
      ctx.fillStyle = readyCount > 0 ? 'rgba(30,150,60,0.65)' : 'rgba(100,100,100,0.50)'; ctx.font = `${U(8)}px ui-monospace,monospace`; ctx.textAlign = 'right'; ctx.fillText(`${readyCount}/${nCells}`, x+w-pad, panelY+U(18));
      const cols   = 4; const rows   = Math.ceil(nCells / cols); const cPad   = U(2);
      const cellW  = (w - pad - cPad*(cols-1)) / cols; const cellH  = U(28); const gridY  = panelY + U(26);
      for (let i = 0; i < nCells; i++) {
        const col = i % cols; const row = Math.floor(i / cols);
        const cx  = x + col*(cellW + cPad); const cy  = gridY + row*(cellH + cPad);
        const cell    = cells[i]; const isReady = cell?.state === 'ready'; const canFire = isReady && hasSolution;
        ctx.fillStyle = isReady ? (canFire ? 'rgba(15,60,30,0.70)' : 'rgba(20,50,20,0.55)') : 'rgba(15,15,20,0.55)';
        ctx.beginPath(); ctx.roundRect(cx, cy, cellW, cellH, U(2)); ctx.fill();
        ctx.strokeStyle = isReady ? 'rgba(30,160,60,0.40)' : 'rgba(60,60,80,0.20)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(cx+0.5, cy+0.5, cellW-1, cellH-1, U(2)); ctx.stroke();
        ctx.fillStyle = isReady ? 'rgba(100,200,120,0.70)' : 'rgba(80,80,100,0.40)'; ctx.font = `${U(7)}px ui-monospace,monospace`; ctx.textAlign = 'left'; ctx.fillText(`${i+1}`, cx+U(2), cy+U(9));
        ctx.fillStyle = isReady ? 'rgba(180,230,190,0.90)' : 'rgba(80,80,100,0.30)'; ctx.font = `bold ${U(8)}px ui-monospace,monospace`; ctx.textAlign = 'center'; ctx.fillText(isReady ? wLabel : 'EXP', cx+cellW/2, cy+cellH*0.70);
        if (canFire) PANEL.btn2(ctx, '', cx, cy, cellW, cellH, 'transparent', () => L.fireVLS?.(i));
      }
      const stY = gridY + rows*(cellH + cPad) + U(8);
      ctx.font = `${U(7.5)}px ui-monospace,monospace`; ctx.textAlign = 'left';
      ctx.fillStyle = hasSolution ? 'rgba(30,160,60,0.65)' : 'rgba(17,24,39,0.30)';
      ctx.fillText(hasSolution ? 'FIRE CTRL SET' : 'NO SOLUTION', x, stY);
    }

    // ── Flex layout engine ──────────────────────────────────────────────────────
    const pc = { ctx, U, panelY, pad, btn, panelH };
    const sections = [
      { draw: drawEngineSection,    min: 130, pref: 160, max: 175 },
      { draw: drawDepthSection,     min: 100, pref: 130, max: 145 },
      { draw: drawTrimSection,      min: 170, pref: 215, max: 250 },
      { draw: drawStatusSection,    min: 120, pref: 165, max: 185 },
      { draw: drawPostureSection,   min:  95, pref: 120, max: 135 },
      { draw: drawEmergencySection, min: 105, pref: 140, max: 155 },
      { draw: drawWeaponsSection,   min: Math.max(125, (C.player.torpTubes||4)*22+30), pref: Math.max(155, (C.player.torpTubes||4)*22+40), max: Math.max(175, (C.player.torpTubes||4)*22+50) },
      { draw: drawMastSection,      min: 120, pref: 150, max: 165 },
      { draw: drawWireSection,      min: 145, pref: 185, max: 210 },
      ...( (C.player.vlsCells||0) > 0 ? [{ draw: drawVlsSection, min: 105, pref: 135, max: 155 }] : [] ),
      { draw: (x2, w2) => drawTdcSection(x2, w2, pc), min: 220, pref: 999, max: 999, fill: true },
    ];

    const gaps = sections.length * pad + pad;
    const widths = sections.map(s => U(s.min));
    let used = widths.reduce((a, b) => a + b, 0) + gaps;
    let surplus = panelW - used;
    if (surplus > 0) {
      const wants = sections.map((s, i) => Math.max(0, U(s.pref) - widths[i]));
      const totalWant = wants.reduce((a, b) => a + b, 0);
      if (totalWant > 0) { const give = Math.min(surplus, totalWant); for (let i = 0; i < sections.length; i++) { const share = Math.round(give * wants[i] / totalWant); widths[i] += share; } used = widths.reduce((a, b) => a + b, 0) + gaps; surplus = panelW - used; }
    }
    if (surplus > 0) {
      const wants = sections.map((s, i) => Math.max(0, U(s.max) - widths[i]));
      const totalWant = wants.reduce((a, b) => a + b, 0);
      if (totalWant > 0) { const give = Math.min(surplus, totalWant); for (let i = 0; i < sections.length; i++) { const share = Math.round(give * wants[i] / totalWant); widths[i] += share; } used = widths.reduce((a, b) => a + b, 0) + gaps; surplus = panelW - used; }
    }
    if (surplus > 0) { const fillIdx = sections.findIndex(s => s.fill); if (fillIdx >= 0) widths[fillIdx] += surplus; }

    let cx = pad;
    for (let i = 0; i < sections.length; i++) {
      sections[i].draw(cx, widths[i]);
      if (i < sections.length - 1) sectionDivider(cx + widths[i]);
      cx += widths[i] + pad;
    }

    if(session.msgT>0){ ctx.fillStyle=`rgba(17,24,39,${Math.min(1,session.msgT*1.4)})`; ctx.font=`${U(11)}px ui-monospace,monospace`; ctx.textAlign='center'; ctx.fillText(session.msg,panelW/2,panelY-U(8)); }
    if(player.scram && !C.player.isDiesel){
      const pulse=0.55+0.45*Math.sin(performance.now()*0.006); const restartPct = 1-(player.scramT/75);
      ctx.fillStyle=`rgba(180,20,20,${0.82*pulse})`; const bw=U(160), bh=U(22); const bx=(panelW-bw)/2, by=panelY-U(36);
      ctx.beginPath(); ctx.roundRect(bx,by,bw,bh,U(4)); ctx.fill();
      ctx.fillStyle=`rgba(255,200,200,${0.95*pulse})`; ctx.font=`bold ${U(9)}px ui-monospace,monospace`; ctx.textAlign='center';
      const epmStr=player.scramEPM?'EPM':'...'; ctx.fillText(`\u26a1 REACTOR SCRAM \u2014 ${epmStr}  ${Math.round(restartPct*100)}%`,panelW/2,by+bh*0.70);
    }
  }
