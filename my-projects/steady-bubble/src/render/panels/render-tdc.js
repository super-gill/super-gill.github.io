// render-tdc.js — drawTdcSection extracted from drawPanel
// Receives panel context object (pc) with: ctx, U, panelY, pad, btn, PANEL
'use strict';

import {
  clamp, player, bullets, sonarContacts, tdc,
  session, setMsg, addLog, ui,
  L, C, TH,
  getTdcDepthBuf, setTdcDepthBuf, pushTdcDepthBuf,
} from './panel-context.js';

export function drawTdcSection(x, w, pc) {
    const { ctx, U, panelY, pad, btn, panelH } = pc;
    const PANEL = L.PANEL;
    const AI = L.AI;
    // tdc imported from sim-state at module top

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
    // Show classification of designated contact — persists even when frozen (kill confirmed)
    const selSc=tdc.target?sonarContacts.get(tdc.target):null;
    const classLabel=selSc?.classification?' \u2014 '+selSc.classification:'';
    ctx.fillText(tdc.frozen?'TDC [FROZEN]'+classLabel:'TDC'+classLabel,fcX,panelY+U(18));

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
    if(!session._tdcPage) session._tdcPage=0;
    // Clamp page to valid range
    const maxPage=Math.max(0,Math.ceil(totalContacts/slotsPerPage)-1);
    if(session._tdcPage>maxPage) session._tdcPage=maxPage;
    const pageStart=session._tdcPage*slotsPerPage;
    const pageEnd=Math.min(pageStart+slotsPerPage,totalContacts);

    let cbX=fcX;
    ctx.font=`${U(9)}px ui-monospace,monospace`;

    // Page left arrow
    if(needsPaging){
      const canLeft=session._tdcPage>0;
      btn('\u25C0', cbX, cbY, arrowW, cbH, false,
        ()=>{ if(session._tdcPage>0) session._tdcPage--; },
        canLeft?'rgba(17,24,39,0.60)':'rgba(17,24,39,0.20)');
      cbX+=arrowW+U(2);
    }

    for(let ci=pageStart;ci<pageEnd;ci++){
      const c=tdcContacts[ci];
      const isSelected=tdc.target===c.ref;
      const cQ=c.sc?.tmaQuality??0;
      const selCol=c.isTorp?'rgba(100,30,200,0.75)':c.isDead?'rgba(150,30,30,0.75)':cQ>=0.6?'#1e3a5f':cQ>=0.2?'rgba(146,64,14,0.85)':'rgba(80,80,80,0.75)';
      btn(c.id, cbX, cbY, cbW, cbH, isSelected,
        ()=>{ tdc.target=c.ref; tdc.targetId=c.id; setMsg(`TDC: ${c.id} DESIGNATED`,1.0); },
        selCol);
      cbX+=cbW+cbGap;
    }

    // Page right arrow
    if(needsPaging){
      const canRight=session._tdcPage<maxPage;
      btn('\u25B6', cbX, cbY, arrowW, cbH, false,
        ()=>{ if(session._tdcPage<maxPage) session._tdcPage++; },
        canRight?'rgba(17,24,39,0.60)':'rgba(17,24,39,0.20)');
    }

    // CLR: clear TDC designation + remove all dead contacts from sonarContacts map
    btn('CLR',fcX+fcW-clrW,cbY,clrW,cbH,false,()=>{
      tdc.target=null; tdc.targetId=null;
      // Remove dead entries from sonarContacts so they vanish from contacts list
      if(sonarContacts){ for(const [e,c] of sonarContacts){ if(c.dead||e.dead) sonarContacts.delete(e); } }
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

    const brg=tdc.rawBrg!=null?Math.round(tdc.rawBrg).toString().padStart(3,'0')+'\u00b0':'---';
    const rng=hasRange?((tdc.range/185.2).toFixed(1)+'nm~'):'---';
    // INT BRG: convert screen-space math angle to compass
    const intBrg=tdc.intercept!=null
      ?(((Math.atan2(Math.cos(tdc.intercept),-Math.sin(tdc.intercept))*180/Math.PI)+360)%360).toFixed(0).padStart(3,'0')+'\u00b0'
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
    let _tdcDepthBuf = getTdcDepthBuf();
    if(tdc.depth!=null){ pushTdcDepthBuf(tdc.depth); _tdcDepthBuf = getTdcDepthBuf(); }
    const _depthAvg=_tdcDepthBuf.length>0?_tdcDepthBuf.reduce((a,b)=>a+b,0)/_tdcDepthBuf.length:null;
    if(tdc.target==null) setTdcDepthBuf([]);
    const dep=_depthAvg!=null?Math.round(_depthAvg)+'m~':'---';
    const crs=tdc.course!=null?Math.round(tdc.course).toString().padStart(3,'0')+'\u00b0~':'---';
    const spd=tdc.speed!=null?Math.round(tdc.speed)+'kt~':'---';
    ctx.font=`${U(14)}px ui-monospace,monospace`;
    ctx.fillStyle=rdValCol;                    ctx.fillText(dep,fcX,rdY2+U(16));
    ctx.fillStyle=hasRange?rdValCol:rdDimCol;  ctx.fillText(crs,fc2,rdY2+U(16));
    ctx.fillStyle=hasRange?rdValCol:rdDimCol;  ctx.fillText(spd,fc3,rdY2+U(16));

    // ── WEPS firing solution proposal ─────────────────────────────────────────
    {
      const wp=ui.wepsProposal;
      const rdY3=rdY2+U(28);
      ctx.font=`${U(9)}px ui-monospace,monospace`;
      ctx.fillStyle='rgba(17,24,39,0.38)';
      ctx.textAlign='left';
      ctx.fillText('WEPS SOLUTION',fcX,rdY3);

      if(wp){
        const wBrg=(((Math.atan2(Math.cos(wp.bearing),-Math.sin(wp.bearing))*180/Math.PI)+360)%360).toFixed(0).padStart(3,'0')+'\u00b0';
        const wDep=Math.round(wp.depth||player.depth)+'m';
        const confCol=wp.confidence==='solid'?'#1e3a5f':wp.confidence==='degraded'?'#92400e':'rgba(17,24,39,0.40)';
        const confLabel=wp.confidence==='solid'?'SOLID':wp.confidence==='degraded'?'DEGRADED':'POOR \u2014 BUILD TMA';
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
          ()=>{ if(canShoot) PANEL.wepsShoot(); else addLog('WEPS','Solution too poor \u2014 build TMA first'); },
          shootCol);
      } else {
        ctx.font=`${U(9.5)}px ui-monospace,monospace`;
        ctx.fillStyle='rgba(17,24,39,0.20)';
        ctx.fillText('NO TARGET DESIGNATED',fcX,rdY3+U(14));
      }
    }

    // ── ASCM solution panel ───────────────────────────────────────────────────
    {
      const asc=session.ascmSolution;
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
        PANEL.btn2(ctx,'FIRE',fireBtnX,fireBtnY,fireBtnW,fireBtnH,'rgba(140,20,20,0.70)',()=>L.fireMissile?.());
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
        const aBrg=asc.bearing!=null?Math.round(asc.bearing).toString().padStart(3,'0')+'\u00b0':'---';
        const aRng=asc.range!=null?((asc.range/185.2).toFixed(1)+'nm~'):'---';
        ctx.font=`${U(14)}px ui-monospace,monospace`;
        ctx.fillStyle='rgba(120,50,160,0.90)';
        ctx.fillText(aBrg,fcX,aValY);
        ctx.fillStyle=asc.range?'rgba(120,50,160,0.90)':'rgba(17,24,39,0.25)';
        ctx.fillText(aRng,fcX+aHalf,aValY);

        // Acquisition confidence label
        const aq=asc.quality;
        const acqLabel=aq>=0.80?'SOLID \u2014 HIGH CONFIDENCE':aq>=0.60?'GOOD \u2014 LIKELY ACQUIRE':aq>=0.40?'MARGINAL \u2014 POSSIBLE MISS':aq>=0.20?'POOR \u2014 HIGH MISS RISK':'NO SOLUTION';
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
            PANEL.btn2(ctx,'STADIMETER',fcX,stadBtnY,stadBtnW,stadBtnH,'rgba(70,30,100,0.55)',()=>L.stadimeterStart?.());
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
      const pitch  = player?.pitch || 0;
      const planes = player?.planes || {};
      const aftMode= planes.aft?.mode || 'hydraulic';
      const fwdMode= planes.fwd?.mode || 'hydraulic';
      const aftAngle= planes.aft?.angle || 0;
      const fwdAngle= planes.fwd?.angle || 0;

      // ── Section header ────────────────────────────────────────────────────
      ctx.fillStyle=TH.color.header;
      ctx.font=`${U(TH.font.header)}px ${TH.FONT_FAMILY}`; ctx.textAlign='left';
      ctx.fillText('PLANES',px,panelY+U(18));

      // ── Bubble inclinometer (gentle arc) ─────────────────────────────────
      // Same footprint as the old straight tube, just slightly curved.
      // Sagitta (rise) controls curvature: U(4) = gentle bow in the middle.
      const tubeW=pw-U(4), tubeH=U(16);
      const tubeX=px, tubeY=panelY+U(24);
      const tubeMid=tubeX+tubeW/2;
      const sag=U(4); // how much the centre rises above the ends
      const arcRadius=(tubeW*tubeW)/(8*sag)+sag/2; // radius from chord + sagitta
      const arcCx=tubeMid;
      const arcCy=tubeY+tubeH/2+arcRadius-sag; // centre below the tube
      const halfAng=Math.asin((tubeW/2)/arcRadius);
      const arcStart=Math.PI*1.5-halfAng;
      const arcEnd=Math.PI*1.5+halfAng;
      const pitchMax=15;
      const tubeThick=U(10);

      // Clip to section bounds so nothing escapes
      ctx.save();
      ctx.beginPath();
      ctx.rect(tubeX-U(2),tubeY-U(2),tubeW+U(4),tubeH+U(8));
      ctx.clip();

      // Arc track — dark glass
      ctx.lineWidth=tubeThick;
      ctx.strokeStyle='rgba(6,14,30,0.85)';
      ctx.beginPath(); ctx.arc(arcCx,arcCy,arcRadius,arcStart,arcEnd); ctx.stroke();

      // Glass highlight
      ctx.lineWidth=tubeThick*0.35;
      ctx.strokeStyle='rgba(100,160,220,0.07)';
      ctx.beginPath(); ctx.arc(arcCx,arcCy,arcRadius-tubeThick*0.28,arcStart,arcEnd); ctx.stroke();

      // Track border
      ctx.lineWidth=1;
      ctx.strokeStyle='rgba(50,70,110,0.55)';
      ctx.beginPath(); ctx.arc(arcCx,arcCy,arcRadius+tubeThick/2,arcStart,arcEnd); ctx.stroke();
      ctx.beginPath(); ctx.arc(arcCx,arcCy,arcRadius-tubeThick/2,arcStart,arcEnd); ctx.stroke();

      // Tick marks along the arc
      for(const deg of [-15,-10,-5,0,5,10,15]){
        const frac=deg/pitchMax;
        const tickAng=Math.PI*1.5+frac*halfAng;
        const isCentre=deg===0;
        const innerR=arcRadius-tubeThick*(isCentre?0.42:0.30);
        const outerR=arcRadius+tubeThick*(isCentre?0.42:0.30);
        ctx.strokeStyle=isCentre?'rgba(60,200,80,0.60)':'rgba(60,90,130,0.35)';
        ctx.lineWidth=isCentre?1.5:1;
        ctx.beginPath();
        ctx.moveTo(arcCx+Math.cos(tickAng)*innerR, arcCy+Math.sin(tickAng)*innerR);
        ctx.lineTo(arcCx+Math.cos(tickAng)*outerR, arcCy+Math.sin(tickAng)*outerR);
        ctx.stroke();
      }
      ctx.restore();

      // S/B labels — stern left, bow right
      ctx.fillStyle='rgba(50,75,120,0.40)';
      ctx.font=`${U(7)}px ui-monospace,monospace`;
      const edgeY=arcCy+Math.sin(arcStart)*arcRadius;
      ctx.textAlign='right'; ctx.fillText('S',tubeX-U(1),edgeY+U(4));
      ctx.textAlign='left';  ctx.fillText('B',tubeX+tubeW+U(1),edgeY+U(4));

      // Bubble — position driven by pitch along the arc
      const isFrz   = aftMode==='frozen';
      const isAirEmg = aftMode==='air_emergency'||fwdMode==='air_emergency';
      const bubbleR  = tubeThick*0.35;
      const pitchFrac=clamp(pitch/pitchMax,-1,1);
      const bubbleAng=Math.PI*1.5+pitchFrac*halfAng*0.85;
      const bubbleX=arcCx+Math.cos(bubbleAng)*arcRadius;
      const bubbleY=arcCy+Math.sin(bubbleAng)*arcRadius;
      const bubbleCol=isFrz?'rgba(210,40,40,0.88)':isAirEmg?'rgba(210,130,10,0.88)':'rgba(210,160,20,0.82)';
      const bubbleGlow=isFrz?'rgba(200,30,30,0.22)':isAirEmg?'rgba(200,120,0,0.20)':'rgba(210,180,30,0.18)';
      const bgrd=ctx.createRadialGradient(bubbleX,bubbleY,0,bubbleX,bubbleY,bubbleR*2.2);
      bgrd.addColorStop(0,bubbleGlow); bgrd.addColorStop(1,'transparent');
      ctx.fillStyle=bgrd; ctx.beginPath(); ctx.arc(bubbleX,bubbleY,bubbleR*2.2,0,Math.PI*2); ctx.fill();
      const bgrad=ctx.createRadialGradient(bubbleX-bubbleR*0.3,bubbleY-bubbleR*0.35,bubbleR*0.05,bubbleX,bubbleY,bubbleR);
      bgrad.addColorStop(0,'rgba(255,240,140,0.95)'); bgrad.addColorStop(0.55,bubbleCol); bgrad.addColorStop(1,'rgba(60,40,0,0.60)');
      ctx.fillStyle=bgrad; ctx.beginPath(); ctx.arc(bubbleX,bubbleY,bubbleR,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,255,220,0.65)';
      ctx.beginPath(); ctx.ellipse(bubbleX-bubbleR*0.28,bubbleY-bubbleR*0.32,bubbleR*0.25,bubbleR*0.15,0,0,Math.PI*2); ctx.fill();

      // STEADY BUBBLE label
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
        const dirStr=angle>0.3?'\u2191':angle<-0.3?'\u2193':'\u2014';
        ctx.fillStyle='rgba(148,163,184,0.55)';
        ctx.font=`${U(8)}px ui-monospace,monospace`; ctx.textAlign='right';
        ctx.fillText(`${dirStr}${Math.abs(angle).toFixed(1)}\u00b0`,px+pw-badgeW-U(8),ry+rowH*0.65);
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
        if(sonarContacts){ for(const [e,cv] of sonarContacts){ if(cv.dead||e.dead){ if(tdc.target===e){ tdc.target=null; tdc.targetId=null; } sonarContacts.delete(e); } } }
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
    session.contactsScroll=Math.max(0,Math.min(maxScroll,session.contactsScroll||0));
    const startRow=session.contactsScroll;

    // Scroll indicator arrows — only if list overflows
    if(allContacts.length>rowsVisible){
      const arrowX=cqX+cqW-U(14);
      const canUp=startRow>0, canDown=startRow<maxScroll;
      ctx.font=`${U(10)}px ui-monospace,monospace`;
      ctx.textAlign='center';
      ctx.fillStyle=canUp?'rgba(17,24,39,0.55)':'rgba(17,24,39,0.15)';
      ctx.fillText('\u25b2', arrowX, panelY+U(30));
      ctx.fillStyle=canDown?'rgba(17,24,39,0.55)':'rgba(17,24,39,0.15)';
      ctx.fillText('\u25bc', arrowX, panelY+panelH-U(12));
      // Register arrow buttons
      btn('\u25b2',arrowX-U(7),panelY+U(20),U(14),U(12),false,
        ()=>{ session.contactsScroll=Math.max(0,(session.contactsScroll||0)-1); },
        'transparent','transparent');
      btn('\u25bc',arrowX-U(7),panelY+panelH-U(22),U(14),U(12),false,
        ()=>{ session.contactsScroll=Math.min(maxScroll,(session.contactsScroll||0)+1); },
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
      const T_now=session.missionT||0;
      const staleSecs=sc ? T_now-(sc.lastObsT||0) : 0;
      const staleAlpha=isDead?0.40:entry.isTorp?0.70:Math.max(0.22, 0.80-Math.min(1,staleSecs/90)*0.58);
      const rowAlpha=staleAlpha;

      // Clickable row — designate contact by clicking anywhere on the row
      const _rowEntry=entry;
      btn('', cqX-U(2), ry-rowH*0.78, cqW+U(2), rowH, isDesignated,
        ()=>{ tdc.target=_rowEntry.ref; tdc.targetId=_rowEntry.id; setMsg(`TDC: ${_rowEntry.id} DESIGNATED`,1.0); },
        'transparent','transparent');

      // ID pill — quality-tinted: solid=navy, building=amber, bearing-only=grey
      const rQ=sc?.tmaQuality??0;
      const pillCol=isDead?`rgba(150,30,30,${rowAlpha})`:entry.isTorp?`rgba(100,30,200,${rowAlpha})`:rQ>=0.6?`rgba(17,24,39,${rowAlpha})`:rQ>=0.2?`rgba(130,60,10,${rowAlpha})`:`rgba(80,80,80,${rowAlpha})`;
      ctx.fillStyle=pillCol;
      ctx.font=`bold ${U(9)}px ui-monospace,monospace`;
      ctx.textAlign='left';
      ctx.fillText(entry.id+(isDead?' \u2715':''), cqX, ry);

      if(!entry.isTorp && sc){
        // BRG
        const brgDeg=latestBrg!=null?((latestBrg*180/Math.PI)+360)%360:null;
        ctx.fillStyle=`rgba(17,24,39,${rowAlpha*0.85})`;
        ctx.font=`${U(9.5)}px ui-monospace,monospace`;
        ctx.fillText(brgDeg!=null?Math.round(brgDeg).toString().padStart(3,'0')+'\u00b0':'---',
                     cqX+idColW, ry);

        // TMA quality bar — or DESTROYED for dead contacts, CONTACT LOST for lost contacts
        const barX=cqX+idColW+brgColW;
        const barH2=U(7);
        const barY2=ry-barH2-U(1);
        if(isDead){
          ctx.fillStyle=`rgba(150,20,20,0.12)`;
          ctx.fillRect(barX,barY2,barColW,barH2);
          ctx.font=`${U(8)}px ui-monospace,monospace`;
          ctx.fillStyle=`rgba(150,20,20,0.55)`;
          ctx.textAlign='left';
          ctx.fillText('DESTROYED \u2014 LAST KNOWN', barX+U(2), ry-U(3));
        } else {
          ctx.fillStyle='rgba(17,24,39,0.08)';
          ctx.fillRect(barX,barY2,barColW,barH2);
          const qFill=clamp(q,0,1);
          const qBarCol=q>=0.6?`rgba(22,163,74,${rowAlpha*0.75})`
                       :q>=0.2?`rgba(217,119,6,${rowAlpha*0.75})`
                              :`rgba(220,38,38,${rowAlpha*0.65})`;
          ctx.fillStyle=qBarCol;
          ctx.fillRect(barX,barY2,barColW*qFill,barH2);
          ctx.strokeStyle=`rgba(17,24,39,0.12)`;ctx.lineWidth=0.5;
          ctx.strokeRect(barX,barY2,barColW,barH2);
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
        ctx.fillText(Math.round(tb).toString().padStart(3,'0')+'\u00b0', cqX+idColW, ry);
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
