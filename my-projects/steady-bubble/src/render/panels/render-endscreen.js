// render-endscreen.js — drawEndScreen (game over / victory)
'use strict';

import { player, session, L, C } from './panel-context.js';

  export function drawEndScreen(W,H){
    const ctx = L.ctx;
    const {U} = L.R;
    const DMG=L.DMG;
    const cx=W/2;

    if(session.over){
      const dmg=player.damage;
      const escaped=session.escapeResolved&&dmg?.escapeState==='complete';
      ctx.fillStyle='rgba(4,8,18,0.98)'; ctx.fillRect(0,0,W,H);
      let ty=H*0.12;
      if(escaped){
        const type=dmg.escapeType; const survived=dmg.escapeSurvivors; const total=DMG.totalCrew();
        const playerOut=dmg.escapePlayerSurvived; const depth=dmg.escapeDepthM;
        ctx.textAlign='center';
        if(playerOut){ ctx.fillStyle='rgba(160,200,240,0.90)'; ctx.font=`bold ${U(32)}px ui-monospace,monospace`; ctx.fillText(type==='tce'?'TOWER ESCAPE':'RUSH ESCAPE',cx,ty+U(24));
        } else { ctx.fillStyle='rgba(180,60,60,0.90)'; ctx.font=`bold ${U(32)}px ui-monospace,monospace`; ctx.fillText('LOST WITH THE BOAT',cx,ty+U(24)); }
        ty+=U(38);
        ctx.fillStyle='rgba(100,130,180,0.55)'; ctx.font=`${U(10)}px ui-monospace,monospace`;
        ctx.fillText('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',cx,ty);
        ty+=U(16); ctx.fillStyle='rgba(180,200,240,0.70)'; ctx.font=`${U(11)}px ui-monospace,monospace`;
        ctx.fillText(`DEPTH AT ESCAPE: ${depth}m   |   SCORE: ${session.score}`,cx,ty);
        ty+=U(22); const survPct=total>0?Math.round(survived/total*100):0;
        const survCol=survPct>=70?'rgba(60,200,100,0.90)':survPct>=40?'rgba(220,180,30,0.90)':'rgba(220,60,60,0.90)';
        ctx.fillStyle=survCol; ctx.font=`bold ${U(26)}px ui-monospace,monospace`; ctx.fillText(`${survived} OF ${total}`,cx,ty);
        ty+=U(18); ctx.fillStyle='rgba(140,170,220,0.60)'; ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.fillText('crew reached the surface',cx,ty);
        ty+=U(20); ctx.fillStyle='rgba(100,130,180,0.45)'; ctx.font=`${U(8)}px ui-monospace,monospace`;
        ctx.fillText('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',cx,ty);
        ty+=U(12);
        const COMP_KEYS=DMG.COMPS;
        const COMP_LABELS=['TORP RM','CONTROL','AUX MCH',C.player.isDiesel?'ENG CM':'REACTOR',C.player.isDiesel?'MOTOR RM':'MANEUVR','ENGINRG'];
        const colW=(W*0.7)/6; const colStartX=cx-W*0.35+colW/2;
        for(let ci=0;ci<6;ci++){
          const comp=COMP_KEYS[ci]; const list=dmg.crew[comp]||[];
          const cfit=list.filter(c=>c.status==='fit').length; const ckia=list.filter(c=>c.status==='killed').length;
          const cx2=colStartX+ci*colW;
          ctx.fillStyle='rgba(140,170,220,0.55)'; ctx.font=`bold ${U(7.5)}px ui-monospace,monospace`; ctx.fillText(COMP_LABELS[ci],cx2,ty);
          ctx.fillStyle=dmg.flooded[comp]?'rgba(100,140,255,0.80)':'rgba(80,200,100,0.75)'; ctx.font=`${U(7)}px ui-monospace,monospace`;
          ctx.fillText(dmg.flooded[comp]?'FLOODED':`${cfit} surv`,cx2,ty+U(10));
          ctx.fillStyle='rgba(200,70,70,0.70)'; ctx.fillText(`${ckia} lost`,cx2,ty+U(19));
        }
        ty+=U(36); ctx.fillStyle='rgba(100,130,180,0.45)'; ctx.font=`${U(8)}px ui-monospace,monospace`;
        ctx.fillText('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',cx,ty);
        ty+=U(12);
        const allCrew=COMP_KEYS.flatMap(c=>(dmg.crew[c]||[])); const co=allCrew.find(c=>c.rating==='CDR');
        if(co){ ctx.fillStyle=co.status==='killed'?'rgba(200,70,70,0.80)':'rgba(80,200,100,0.75)'; ctx.font=`${U(8)}px ui-monospace,monospace`; ctx.fillText(`${co.name} \u2014 ${co.status==='killed'?'LOST':'SURVIVED'}`,cx,ty); ty+=U(12); }
        const officers=allCrew.filter(c=>['LCDR','LT','WO'].includes(c.rating));
        const casualties=officers.filter(c=>c.status==='killed').slice(0,4);
        const survivors2=officers.filter(c=>c.status!=='killed').slice(0,4);
        for(const c of casualties){ ctx.fillStyle='rgba(190,65,65,0.70)'; ctx.font=`${U(7.5)}px ui-monospace,monospace`; ctx.fillText(`${c.name} \u2014 LOST`,cx,ty); ty+=U(10); }
        for(const c of survivors2){ ctx.fillStyle='rgba(70,170,90,0.65)'; ctx.font=`${U(7.5)}px ui-monospace,monospace`; ctx.fillText(`${c.name} \u2014 SURVIVED`,cx,ty); ty+=U(10); }
      } else {
        const crushed = session.overCause==='crush';
        ctx.fillStyle='rgba(200,60,60,0.90)'; ctx.font=`bold ${U(44)}px ui-monospace,monospace`; ctx.textAlign='center';
        ctx.fillText(crushed?'HULL FAILURE':'SUNK',cx,H*0.45);
        ctx.fillStyle='rgba(140,160,200,0.60)'; ctx.font=`${U(12)}px ui-monospace,monospace`;
        ctx.fillText(crushed?`Crush depth exceeded \u2014 ${Math.round(player.depth)}m`:'No escape initiated',cx,H*0.45+U(22));
        ctx.fillStyle='rgba(140,160,200,0.55)'; ctx.font=`${U(10)}px ui-monospace,monospace`;
        ctx.fillText(`All hands lost   |   SCORE: ${session.score}`,cx,H*0.45+U(40));
      }
      ctx.fillStyle='rgba(100,130,180,0.45)'; ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.textAlign='center'; ctx.fillText('R \u2014 new game',cx,H-U(20));
    }

    if(session.won && !session.over){
      const SCENARIO_NAMES={duel:'1V1 DUEL', ambush:'AMBUSH', patrol:'BARRIER TRANSIT', ssbn_hunt:'SSBN HUNT', boss_fight:'BOSS FIGHT', asw_taskforce:'ASW TASKFORCE'};
      const SCENARIO_FLAVOUR={duel:'Enemy submarine destroyed.',ambush:'All hostiles neutralised. You survived the ambush.',patrol:'Barrier patrol eliminated. Transit route is clear.',ssbn_hunt:'SSBN destroyed. Strategic mission complete.',boss_fight:'Zeta-class confirmed destroyed.',asw_taskforce:'ASW taskforce neutralised. Surface threat eliminated.'};
      ctx.fillStyle='rgba(4,8,18,0.98)'; ctx.fillRect(0,0,W,H);
      let ty=H*0.10;
      ctx.textAlign='center'; ctx.fillStyle='rgba(80,220,130,0.90)'; ctx.font=`bold ${U(36)}px ui-monospace,monospace`; ctx.fillText('MISSION COMPLETE',cx,ty+U(28));
      ty+=U(42); ctx.fillStyle='rgba(80,180,120,0.40)'; ctx.font=`${U(10)}px ui-monospace,monospace`;
      ctx.fillText('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',cx,ty);
      ty+=U(18); ctx.fillStyle='rgba(160,220,180,0.80)'; ctx.font=`bold ${U(14)}px ui-monospace,monospace`; ctx.fillText(SCENARIO_NAMES[session.scenario]||session.scenario.toUpperCase(),cx,ty);
      ty+=U(16); ctx.fillStyle='rgba(140,180,170,0.60)'; ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.fillText(SCENARIO_FLAVOUR[session.scenario]||'All enemies destroyed.',cx,ty);
      ty+=U(16); ctx.fillStyle='rgba(80,180,120,0.30)'; ctx.font=`${U(10)}px ui-monospace,monospace`;
      ctx.fillText('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',cx,ty);
      ty+=U(22); const mT=session.missionT||0; const mins=Math.floor(mT/60); const secs=Math.floor(mT%60); const timeStr=`${mins}:${secs.toString().padStart(2,'0')}`;
      const killed=session._enemiesKilled||0; const totalCrew=DMG?DMG.totalCrew():0; const totalKilled=DMG?DMG.totalKilled():0; const crewAlive=totalCrew-totalKilled;
      const stats=[['MISSION TIME', timeStr],['ENEMIES DESTROYED', `${killed}`],['CREW SURVIVING', `${crewAlive} / ${totalCrew}`],['FINAL SCORE', `${session.score}`]];
      const statH=U(20); const statW=W*0.50;
      for(const [label,val] of stats){ ctx.fillStyle='rgba(140,180,200,0.55)'; ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.textAlign='left'; ctx.fillText(label,cx-statW/2,ty); ctx.fillStyle='rgba(80,220,140,0.85)'; ctx.font=`bold ${U(10)}px ui-monospace,monospace`; ctx.textAlign='right'; ctx.fillText(val,cx+statW/2,ty); ty+=statH; }
      ty+=U(6); ctx.fillStyle='rgba(80,180,120,0.30)'; ctx.font=`${U(10)}px ui-monospace,monospace`; ctx.textAlign='center';
      ctx.fillText('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',cx,ty);
      ty+=U(18); const scorePct=crewAlive>0&&totalCrew>0?Math.round(crewAlive/totalCrew*100):0;
      const crewCol=scorePct>=90?'rgba(80,220,130,0.90)':scorePct>=60?'rgba(220,200,40,0.90)':'rgba(220,100,60,0.90)';
      ctx.fillStyle=crewCol; ctx.font=`bold ${U(22)}px ui-monospace,monospace`; ctx.fillText(`${scorePct}%`,cx,ty);
      ty+=U(14); ctx.fillStyle='rgba(140,180,170,0.50)'; ctx.font=`${U(8)}px ui-monospace,monospace`; ctx.fillText('crew survival rate',cx,ty);
      ctx.fillStyle='rgba(80,180,120,0.45)'; ctx.font=`${U(9)}px ui-monospace,monospace`; ctx.textAlign='center'; ctx.fillText('R \u2014 new game',cx,H-U(20));
    }
  }
