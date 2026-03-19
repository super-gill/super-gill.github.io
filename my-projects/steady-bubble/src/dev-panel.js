// dev-panel.js — floating admin/test panel
// Injected into the DOM after DOMContentLoaded.
// All actions operate on imported state modules.
'use strict';

import { CONFIG } from './config/constants.js';
import { player, enemies, world } from './state/sim-state.js';
import { session, setCasualtyState } from './state/session-state.js';
import { ui } from './state/ui-state.js';

// ── Lazy bindings ────────────────────────────────────────────────────────
let _DMG = null;
let _AI = null;
let _COMMS = null;
let _SIM = null;

export function _bindDevPanel(deps) {
  if (deps.DMG) _DMG = deps.DMG;
  if (deps.AI) _AI = deps.AI;
  if (deps.COMMS) _COMMS = deps.COMMS;
  if (deps.SIM) _SIM = deps.SIM;
}

export function initDevPanel() {
  // ── Styles ────────────────────────────────────────────────────────────────
  const style=document.createElement('style');
  style.textContent=`
    #dev-panel{
      position:fixed;top:8px;right:8px;z-index:9999;
      background:rgba(10,12,20,0.92);border:1px solid rgba(0,200,255,0.35);
      border-radius:4px;font:12px/1.5 ui-monospace,monospace;color:#9ef;
      min-width:220px;max-width:260px;user-select:none;box-shadow:0 2px 12px rgba(0,0,0,0.6);
    }
    #dev-panel-header{
      display:flex;align-items:center;justify-content:space-between;
      padding:5px 10px;cursor:pointer;border-bottom:1px solid rgba(0,200,255,0.2);
      letter-spacing:.08em;font-size:11px;color:#5df;
    }
    #dev-panel-header:hover{background:rgba(0,200,255,0.06);}
    #dev-panel-body{padding:8px 10px;display:flex;flex-direction:column;gap:6px;
      max-height:calc(100vh - 60px);overflow-y:auto;}
    .dev-section-label{
      font-size:10px;color:rgba(0,200,255,0.45);letter-spacing:.1em;
      text-transform:uppercase;margin-top:4px;border-top:1px solid rgba(0,200,255,0.10);
      padding-top:4px;
    }
    .dev-section-label:first-child{border-top:none;margin-top:0;}
    .dev-row{display:flex;gap:4px;flex-wrap:wrap;}
    .dev-btn{
      background:rgba(0,200,255,0.08);border:1px solid rgba(0,200,255,0.25);
      color:#9ef;border-radius:3px;padding:3px 8px;font:11px ui-monospace,monospace;
      cursor:pointer;white-space:nowrap;transition:background .1s,color .1s;
    }
    .dev-btn:hover{background:rgba(0,200,255,0.20);color:#fff;}
    .dev-btn.active{background:rgba(0,255,140,0.18);border-color:rgba(0,255,140,0.5);color:#0fa;}
    .dev-btn.danger{border-color:rgba(255,80,80,0.4);color:#f99;}
    .dev-btn.danger:hover{background:rgba(255,80,80,0.18);color:#fcc;}
    .dev-btn.warn{border-color:rgba(255,180,0,0.4);color:#fb8;}
    .dev-btn.warn:hover{background:rgba(255,180,0,0.15);color:#ffc;}
    .dev-status{font-size:10px;color:rgba(0,200,255,0.5);min-height:14px;margin-top:2px;}
    #dev-damage-state{font-size:9.5px;color:rgba(160,200,255,0.60);line-height:1.6;
      border:1px solid rgba(0,200,255,0.12);border-radius:3px;padding:4px 6px;
      background:rgba(0,0,0,0.25);}
  `;
  document.head.appendChild(style);

  // ── Watertight sections ──────────────────────────────────────────────────
  const COMPS=[
    {key:'fore_ends',   short:'WTS1', label:'WT Section 1'},
    {key:'control_room',short:'WTS2', label:'WT Section 2'},
    {key:'aux_section', short:'WTS3', label:'WT Section 3'},
    {key:'reactor_comp',short:'WTS4', label:'WT Section 4'},
    {key:'engine_room', short:'WTS5', label:'WT Section 5'},
    {key:'aft_ends',    short:'WTS6', label:'WT Section 6'},
  ];

  const SYS_LIST=[
    {id:'tubes',          label:'Tubes',       comp:'fore_ends'},
    {id:'sonar_hull',     label:'Sonar',       comp:'fore_ends'},
    {id:'planes_fwd_hyd', label:'Fwd Planes',  comp:'fore_ends'},
    {id:'weapon_stow',    label:'Wpn Stow',    comp:'fore_ends'},
    {id:'fwd_trim',       label:'Fwd Trim',    comp:'fore_ends'},
    {id:'fwd_escape',     label:'Fwd Esc',     comp:'fore_ends'},
    {id:'tma',            label:'TMA',         comp:'fore_ends'},
    {id:'tdc_comp',       label:'TDC',         comp:'fore_ends'},
    {id:'periscope',      label:'Scope',       comp:'control_room'},
    {id:'ballast',        label:'Ballast',     comp:'control_room'},
    {id:'hyd_main',       label:'Hyd Main',    comp:'control_room'},
    {id:'helm',           label:'Helm',        comp:'control_room'},
    {id:'fire_ctrl',      label:'Fire Ctrl',   comp:'control_room'},
    {id:'nav_sys',        label:'Nav',         comp:'control_room'},
    {id:'comms_mast',     label:'Comms',       comp:'control_room'},
    {id:'co2_scrubbers',  label:'CO2 Scrub',   comp:'aux_section'},
    {id:'o2_gen',         label:'O2 Gen',      comp:'aux_section'},
    {id:'aux_power',      label:'Aux Power',   comp:'aux_section'},
    {id:'reactor',        label:'Reactor',     comp:'reactor_comp'},
    {id:'primary_coolant',label:'Pri Cool',    comp:'reactor_comp'},
    {id:'pressuriser',    label:'Press',       comp:'reactor_comp'},
    {id:'rad_monitor',    label:'Rad Mon',     comp:'reactor_comp'},
    {id:'propulsion',     label:'Prop',        comp:'engine_room'},
    {id:'main_turbines',  label:'Turbines',    comp:'engine_room'},
    {id:'elec_dist',      label:'Elec Dist',   comp:'engine_room'},
    {id:'emerg_diesel',   label:'Diesel',      comp:'engine_room'},
    {id:'towed_array',    label:'Towed Arr',   comp:'aft_ends'},
    {id:'steering',       label:'Steering',    comp:'aft_ends'},
    {id:'planes_aft_hyd', label:'Aft Planes',  comp:'aft_ends'},
    {id:'shaft_seals',    label:'Shaft Seal',  comp:'aft_ends'},
    {id:'aft_trim',       label:'Aft Trim',    comp:'aft_ends'},
    {id:'aft_escape',     label:'Aft Esc',     comp:'aft_ends'},
  ];

  // ── HTML ──────────────────────────────────────────────────────────────────
  const floodBtns  = COMPS.map(c=>`<button class="dev-btn danger" data-flood="${c.key}">${c.short}</button>`).join('');

  const panel=document.createElement('div');
  panel.id='dev-panel';
  panel.innerHTML=`
    <div id="dev-panel-header">
      <span>\u2699 DEV PANEL</span><span style="font-size:10px;opacity:0.45;">[\`]</span>
    </div>
    <div id="dev-panel-body">
      <div class="dev-section-label">View</div>
      <div class="dev-row">
        <button class="dev-btn" id="dev-btn-overlay">True Pos</button>
        <button class="dev-btn" id="dev-btn-noise">Noise</button>
        <button class="dev-btn" id="dev-btn-dmg">Dmg Screen</button>
      </div>
      <div class="dev-section-label">Player</div>
      <div class="dev-row">
        <button class="dev-btn" id="dev-btn-god">God Mode</button>
        <button class="dev-btn" id="dev-btn-torps">Reload Torps</button>
      </div>
      <div class="dev-row">
        <button class="dev-btn" id="dev-btn-d0">0m</button>
        <button class="dev-btn" id="dev-btn-d50">50m</button>
        <button class="dev-btn" id="dev-btn-d150">150m</button>
        <button class="dev-btn" id="dev-btn-d260">260m</button>
        <button class="dev-btn" id="dev-btn-d400">400m</button>
        <button class="dev-btn" id="dev-btn-d500">500m</button>
      </div>
      <div class="dev-row">
        <button class="dev-btn" id="dev-btn-bat100">BAT 100%</button>
        <button class="dev-btn" id="dev-btn-bat50">BAT 50%</button>
        <button class="dev-btn" id="dev-btn-bat20">BAT 20%</button>
        <button class="dev-btn" id="dev-btn-bat5">BAT 5%</button>
        <button class="dev-btn danger" id="dev-btn-bat0">BAT 0%</button>
      </div>
      <div class="dev-section-label">Flood</div>
      <div class="dev-row">${floodBtns}</div>
      <div class="dev-row">
        <button class="dev-btn warn" id="dev-btn-flood-clear">Clear Floods</button>
        <button class="dev-btn danger" id="dev-btn-flood-multi">Multi-Flood</button>
      </div>
      <div class="dev-section-label">Fire</div>
      <div id="dev-fire-rooms"></div>
      <div class="dev-row">
        <button class="dev-btn warn" id="dev-btn-fire-clear">Clear Fires</button>
        <button class="dev-btn danger" id="dev-btn-fire-all">Fire All Rooms</button>
      </div>
      <div class="dev-section-label">Systems</div>
      <div class="dev-row" id="dev-sys-row" style="flex-direction:column;gap:3px;"></div>
      <div class="dev-section-label">DC Teams</div>
      <div class="dev-row">
        <button class="dev-btn warn" id="dev-btn-emerg">Emerg Stations</button>
        <button class="dev-btn" id="dev-btn-normal">Secure</button>
      </div>
      <div class="dev-row">
        <button class="dev-btn" id="dev-btn-reset-alpha">Reset Alpha</button>
        <button class="dev-btn" id="dev-btn-reset-bravo">Reset Bravo</button>
      </div>
      <div class="dev-row">
        <button class="dev-btn warn" id="dev-btn-clear-locks">Clear Locks</button>
        <button class="dev-btn" id="dev-btn-skip-muster">Skip Muster</button>
      </div>
      <div class="dev-section-label">Watertight Doors</div>
      <div id="dev-wtd-row" class="dev-row" style="flex-direction:column;gap:3px;"></div>
      <div class="dev-row">
        <button class="dev-btn" id="dev-btn-wtd-open-all">Open All</button>
        <button class="dev-btn warn" id="dev-btn-wtd-close-all">Close All</button>
        <button class="dev-btn danger" id="dev-btn-wtd-kill-hyd">Kill HYD</button>
      </div>
      <div class="dev-section-label">Damage State</div>
      <div id="dev-damage-state">\u2014</div>
      <div class="dev-row">
        <button class="dev-btn" id="dev-btn-refresh-state">Refresh</button>
        <button class="dev-btn danger" id="dev-btn-full-reset">Full Reset</button>
      </div>
      <div class="dev-section-label">World</div>
      <div class="dev-row">
        <button class="dev-btn danger" id="dev-btn-kill">Kill All</button>
      </div>
      <div class="dev-section-label">Spawn Sub (Role)</div>
      <div class="dev-row">
        <button class="dev-btn" id="dev-btn-hunter">Hunter</button>
        <button class="dev-btn" id="dev-btn-pinger">Pinger</button>
        <button class="dev-btn" id="dev-btn-interceptor">Interceptor</button>
        <button class="dev-btn" id="dev-btn-boat">Boat</button>
      </div>
      <div class="dev-row">
        <button class="dev-btn" id="dev-btn-cz-hunter">CZ Hunter</button>
        <button class="dev-btn" id="dev-btn-cz-pinger">CZ Pinger</button>
      </div>
      <div class="dev-section-label">Spawn Sub (Class)</div>
      <div class="dev-row">
        <button class="dev-btn" id="dev-btn-november">NOVEMBER</button>
        <button class="dev-btn" id="dev-btn-whiskey">WHISKEY</button>
        <button class="dev-btn" id="dev-btn-golf">GOLF</button>
      </div>
      <div class="dev-row">
        <button class="dev-btn" id="dev-btn-foxtrot">FOXTROT</button>
        <button class="dev-btn" id="dev-btn-kilo">KILO</button>
        <button class="dev-btn" id="dev-btn-yankee">YANKEE</button>
      </div>
      <div class="dev-row">
        <button class="dev-btn" id="dev-btn-delta">DELTA</button>
        <button class="dev-btn" id="dev-btn-typhoon">TYPHOON</button>
      </div>
      <div class="dev-row">
        <button class="dev-btn" id="dev-btn-papa">PAPA</button>
        <button class="dev-btn" id="dev-btn-oscar">OSCAR</button>
        <button class="dev-btn" id="dev-btn-akula">AKULA</button>
      </div>
      <div class="dev-section-label">Spawn Ship (Class)</div>
      <div class="dev-row">
        <button class="dev-btn" id="dev-btn-krivak">KRIVAK</button>
        <button class="dev-btn" id="dev-btn-udaloy">UDALOY</button>
        <button class="dev-btn" id="dev-btn-grisha">GRISHA</button>
        <button class="dev-btn" id="dev-btn-slava">SLAVA</button>
      </div>
      <div class="dev-status" id="dev-status"></div>
    </div>
  `;
  panel.style.display='none';
  document.body.appendChild(panel);

  // ── Build systems rows ────────────────────────────────────────────────────
  const sysRowEl=document.getElementById('dev-sys-row');
  for(const sys of SYS_LIST){
    const row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:3px;';
    row.innerHTML=`
      <span style="font-size:9px;color:rgba(0,200,255,0.55);width:72px;flex-shrink:0">${sys.label}</span>
      <button class="dev-btn" style="padding:2px 5px;font-size:10px;" data-sys="${sys.id}" data-state="degraded">DEG</button>
      <button class="dev-btn danger" style="padding:2px 5px;font-size:10px;" data-sys="${sys.id}" data-state="offline">OFF</button>
      <button class="dev-btn danger" style="padding:2px 5px;font-size:10px;" data-sys="${sys.id}" data-state="destroyed">DEST</button>
      <button class="dev-btn active" style="padding:2px 5px;font-size:10px;" data-sys="${sys.id}" data-state="nominal">NOM</button>
    `;
    sysRowEl.appendChild(row);
  }

  // ── Status helper ─────────────────────────────────────────────────────────
  let _statusT=null;
  function status(msg){
    const el=document.getElementById('dev-status');
    el.textContent=msg;
    clearTimeout(_statusT);
    _statusT=setTimeout(()=>{ el.textContent=''; },2500);
  }

  // ── Damage state readout ──────────────────────────────────────────────────
  function refreshState(){
    const d=player?.damage;
    const el=document.getElementById('dev-damage-state');
    if(!d){ el.textContent='No damage state'; return; }
    const lines=[];
    for(const c of COMPS){
      const fl=d.flooding?.[c.key]??0;
      const fr=d.floodRate?.[c.key]??0;
      const sRooms=_DMG?.SECTION_ROOMS?.[c.key]||[`${c.key}_d0`,`${c.key}_d1`,`${c.key}_d2`];
      const fi=Math.max(...sRooms.map(rid=>d.fire?.[rid]||0));
      const flooded=d.flooded?.[c.key];
      if(fl>0.005||fr>0||fi>0.01||flooded){
        const parts=[];
        if(flooded) parts.push('FLOODED');
        else if(fl>0.005) parts.push(`fld ${Math.round(fl*100)}%`);
        if(fr>0) parts.push(`rate ${fr.toFixed(3)}`);
        if(fi>0.01) parts.push(`fire ${Math.round(fi*100)}%`);
        lines.push(`${c.short}: ${parts.join(' | ')}`);
      }
    }
    for(const [id,team] of Object.entries(d.teams||{})){
      const lock=team._locked?'\uD83D\uDD12':'';
      const mstr=team._readyT>0?` mstr${Math.ceil(team._readyT)}s`:'';
      const dest=team.destination?`\u2192${COMPS.find(c2=>c2.key===team.destination)?.short??team.destination}`:'';
      lines.push(`${team.label}: ${team.state}${mstr} task=${team.task??'\u2014'} ${dest}${lock}`);
    }
    const WTD_SHORT=['T/C','C/A','A/R','R/M','M/E'];
    const wtdLine=WTD_SHORT.map((lbl,i)=>{
      const [sA,sB]=(_DMG?.WTD_PAIRS||[])[i]||[];
      const state=(sA&&sB)?d.wtd?.[sA+'|'+sB]||'?':'?';
      return `${lbl}:${state==='open'?'O':'C'}`;
    }).join(' ');
    lines.push(`WTD: ${wtdLine} | hyd:${d.systems?.hyd_main??'?'}`);
    lines.push(`casualty: ${session.casualtyState??'\u2014'}`);
    el.textContent=lines.length?lines.join('\n'):'All clear';
  }

  // ── Active state sync ─────────────────────────────────────────────────────
  function syncActive(){
    document.getElementById('dev-btn-overlay').classList.toggle('active', !!session.debugOverlay);
    document.getElementById('dev-btn-noise').classList.toggle('active',   !!session.debugNoise);
    document.getElementById('dev-btn-dmg').classList.toggle('active',     !!ui.showDamageScreen);
    document.getElementById('dev-btn-god').classList.toggle('active',     !!session.godMode);
    refreshState();
  }
  setInterval(syncActive, 500);

  // ── Button helper ─────────────────────────────────────────────────────────
  function btn(id, fn){ document.getElementById(id).addEventListener('click', fn); }

  // ── View ──────────────────────────────────────────────────────────────────
  btn('dev-btn-overlay', ()=>{
    session.debugOverlay=!session.debugOverlay;
    status(session.debugOverlay?'True pos ON':'True pos OFF');
  });
  btn('dev-btn-noise', ()=>{
    session.debugNoise=!session.debugNoise;
    status(session.debugNoise?'Noise labels ON':'Noise labels OFF');
  });
  btn('dev-btn-dmg', ()=>{
    ui.showDamageScreen=!ui.showDamageScreen;
    status(ui.showDamageScreen?'Dmg screen ON':'Dmg screen OFF');
  });

  // ── Player ────────────────────────────────────────────────────────────────
  btn('dev-btn-god', ()=>{
    session.godMode=!session.godMode;
    status(session.godMode?'God mode ON':'God mode OFF');
  });
  btn('dev-btn-torps', ()=>{
    const C=CONFIG;
    player.torpStock=C.player.torpStock||12;
    player.torpTubes=(player.torpTubes||[]).map(()=>0);
    if(player.tubeWires) player.tubeWires=player.tubeWires.map(()=>null);
    player.pendingFires=[];
    status('Tubes reloaded');
  });

  // ── Instant depth ─────────────────────────────────────────────────────────
  for(const d of [0,50,150,260,400,500]){
    btn(`dev-btn-d${d}`, ()=>{
      player.depth=d;
      player.depthOrder=d;
      status(`Depth set to ${d}m`);
    });
  }

  // ── Battery ───────────────────────────────────────────────────────────────
  for(const pct of [100,50,20,5,0]){
    btn(`dev-btn-bat${pct}`, ()=>{
      player.battery=pct/100;
      if(pct===0) player._battDead=true;
      else player._battDead=false;
      status(`Battery set to ${pct}%`);
    });
  }

  // ── Flood ─────────────────────────────────────────────────────────────────
  document.querySelectorAll('[data-flood]').forEach(el=>{
    el.addEventListener('click',()=>{
      const comp=el.dataset.flood;
      if(_DMG?.hit){
        _DMG.hit(45, null, null, comp);
        status(`Hit: ${comp}`);
      } else { status('DMG not ready'); }
    });
  });
  btn('dev-btn-flood-clear', ()=>{
    const d=player?.damage; if(!d){ status('No damage state'); return; }
    for(const c of COMPS){
      d.flooding[c.key]=0; d.floodRate[c.key]=0; d.flooded[c.key]=false;
    }
    status('Floods cleared');
  });
  btn('dev-btn-flood-multi', ()=>{
    if(!_DMG?.hit){ status('DMG not ready'); return; }
    _DMG.hit(45, null, null, 'fore_ends');
    _DMG.hit(45, null, null, 'engine_room');
    status('Multi-flood: TRP + MAN');
  });

  // ── Fire ──────────────────────────────────────────────────────────────────
  (function(){
    const container=document.getElementById('dev-fire-rooms');
    if(!container) return;
    const SECTION_LABELS={
      fore_ends:'WT SECTION 1 \u2014 FORE ENDS', control_room:'WT SECTION 2 \u2014 CONTROL',
      aux_section:'WT SECTION 3 \u2014 AUX', reactor_comp:'WT SECTION 4 \u2014 REACTOR',
      engine_room:'WT SECTION 5 \u2014 ENGINE', aft_ends:'WT SECTION 6 \u2014 AFT',
    };
    const ROOM_DEFS=[
      {id:'fore_ends_d0',     sec:'fore_ends',    label:'FWD DOME',     crew:0,  detectionDelay:40},
      {id:'fore_ends_d0b',    sec:'fore_ends',    label:'COMMS',        crew:3,  detectionDelay:0 },
      {id:'fore_ends_d1',     sec:'fore_ends',    label:'ENG OFFICE',   crew:1,  detectionDelay:20},
      {id:'fore_ends_d1b',    sec:'fore_ends',    label:'COMPUTER RM',  crew:0,  detectionDelay:35},
      {id:'fore_ends_d2',     sec:'fore_ends',    label:'TORPEDO ROOM', crew:4,  detectionDelay:0 },
      {id:'control_room_d0',  sec:'control_room', label:'NAV',          crew:1,  detectionDelay:0 },
      {id:'control_room_d0b', sec:'control_room', label:'SCOPE WELL',   crew:2,  detectionDelay:0 },
      {id:'control_room_d0c', sec:'control_room', label:'WARDROOM',     crew:3,  detectionDelay:0 },
      {id:'control_room_d1',  sec:'control_room', label:'CTRL ROOM',    crew:6,  detectionDelay:0 },
      {id:'control_room_d1b', sec:'control_room', label:'CO CABIN',     crew:0,  detectionDelay:30},
      {id:'control_room_d2',  sec:'control_room', label:'MACH SPACE',   crew:0,  detectionDelay:40},
      {id:'aux_section_d0',   sec:'aux_section',  label:'JR MESS',      crew:6,  detectionDelay:0 },
      {id:'aux_section_d0b',  sec:'aux_section',  label:'SR MESS',      crew:4,  detectionDelay:0 },
      {id:'aux_section_d1',   sec:'aux_section',  label:'BUNKS',        crew:2,  detectionDelay:20},
      {id:'aux_section_d1b',  sec:'aux_section',  label:'VENT PLANT',   crew:0,  detectionDelay:45},
      {id:'aux_section_d2',   sec:'aux_section',  label:'AMS 1',        crew:0,  detectionDelay:50},
      {id:'aux_section_d2b',  sec:'aux_section',  label:'RX E-COOL',    crew:0,  detectionDelay:50},
      {id:'aux_section_d2c',  sec:'aux_section',  label:'SICKBAY',      crew:1,  detectionDelay:0 },
      {id:'reactor_comp_d0',  sec:'reactor_comp', label:'RC TUNNEL',    crew:0,  detectionDelay:30},
      {id:'reactor_comp_d1',  sec:'reactor_comp', label:'REACTOR',      crew:3,  detectionDelay:0 },
      {id:'reactor_comp_d2',  sec:'reactor_comp', label:'RCT LOWER',    crew:0,  detectionDelay:60},
      {id:'engine_room_d0',   sec:'engine_room',  label:'AFT PASSAGE',  crew:0,  detectionDelay:0 },
      {id:'engine_room_d0b',  sec:'engine_room',  label:'MANEUVERING',  crew:4,  detectionDelay:0 },
      {id:'engine_room_d1',   sec:'engine_room',  label:'ELEC DIST',    crew:2,  detectionDelay:0 },
      {id:'engine_room_d2',   sec:'engine_room',  label:'AFT ATMOS',    crew:0,  detectionDelay:45},
      {id:'aft_ends_d0',      sec:'aft_ends',     label:'ENGINEERING',  crew:2,  detectionDelay:0 },
      {id:'aft_ends_d1',      sec:'aft_ends',     label:'PROPULSION',   crew:2,  detectionDelay:0 },
      {id:'aft_ends_d1b',     sec:'aft_ends',     label:'SHAFT ALLEY',  crew:1,  detectionDelay:0 },
      {id:'aft_ends_d2',      sec:'aft_ends',     label:'STEERING GEAR',crew:2,  detectionDelay:0 },
      {id:'aft_ends_d2b',     sec:'aft_ends',     label:'AFT ESCAPE',   crew:0,  detectionDelay:50},
    ];
    const bySec={};
    for(const r of ROOM_DEFS){
      if(!bySec[r.sec]) bySec[r.sec]=[];
      bySec[r.sec].push(r);
    }
    for(const [sec,rooms] of Object.entries(bySec)){
      const lbl=document.createElement('div');
      lbl.style.cssText='font-size:9px;color:rgba(0,200,255,0.35);margin:2px 0 1px;';
      lbl.textContent=SECTION_LABELS[sec]||sec;
      container.appendChild(lbl);
      const row=document.createElement('div');
      row.className='dev-row';
      for(const r of rooms){
        const b=document.createElement('button');
        b.className='dev-btn danger';
        b.style.fontSize='10px';
        b.style.padding='2px 5px';
        const isEmpty=(!r.crew);
        b.textContent=(isEmpty?'\u26a0 ':'')+r.label;
        b.title=`${r.id}${isEmpty?' (EMPTY \u2014 '+(r.detectionDelay??45)+'s detect delay)':' (crew: '+(r.crew||0)+')'}`;
        b.addEventListener('click',()=>{
          if(_DMG?.igniteFire){
            _DMG.igniteFire(r.id, 0.22);
            status(`Fire: ${r.label}${isEmpty?' (undetected)':''}`);
          } else { status('DMG not ready'); }
        });
        row.appendChild(b);
      }
      container.appendChild(row);
    }
  })();
  btn('dev-btn-fire-clear', ()=>{
    const d=player?.damage; if(!d){ status('No damage state'); return; }
    for(const key of Object.keys(d.fire||{})) d.fire[key]=0;
    if(d._fireDetected) for(const k of Object.keys(d._fireDetected)) delete d._fireDetected[k];
    if(d._fireDetectT)  for(const k of Object.keys(d._fireDetectT))  delete d._fireDetectT[k];
    for(const c of COMPS){
      if(d._fireWatch) d._fireWatch[c.key]=null;
      if(d._fireDrench) d._fireDrench[c.key]=false;
      if(d._fireCritical) d._fireCritical[c.key]=false;
    }
    for(const team of Object.values(d.teams||{})){
      if(team.task==='drench_pending'){ team.state='ready'; team.task=null; }
    }
    status('All fires cleared');
  });
  btn('dev-btn-fire-all', ()=>{
    if(!_DMG?.igniteFire){ status('DMG not ready'); return; }
    for(const c of COMPS) _DMG.igniteFire(c.key, 0.15);
    status('Fires in all sections');
  });

  // ── Systems ───────────────────────────────────────────────────────────────
  document.querySelectorAll('[data-sys][data-state]').forEach(el=>{
    el.addEventListener('click',()=>{
      const d=player?.damage; if(!d){ status('No damage state'); return; }
      const sys=el.dataset.sys; const state=el.dataset.state;
      d.systems[sys]=state;
      if(state!=='nominal'&&state!=='degraded'){
        _COMMS?.nav?.steeringCasualty?.(state);
      }
      status(`${sys}: ${state}`);
    });
  });

  // ── DC Teams ──────────────────────────────────────────────────────────────
  btn('dev-btn-emerg', ()=>{
    setCasualtyState('emergency');
    status('Emergency stations');
  });
  btn('dev-btn-normal', ()=>{
    setCasualtyState('normal');
    const d=player?.damage; if(d){
      d._emergMusterFired=false;
      for(const t of Object.values(d.teams||{})){ t._autoMode=false; t._readyT=0; }
    }
    status('Secure from emergency');
  });

  function resetTeam(teamId){
    const d=player?.damage; if(!d){ status('No damage state'); return; }
    const team=d.teams?.[teamId]; if(!team){ status(`Team ${teamId} not found`); return; }
    const homeDef={alpha:'aux_section_d0b', bravo:'engine_room_d0'};
    team.state='ready';
    team.location=homeDef[teamId]||team.home;
    team.destination=null;
    team.transitEta=0;
    team.task=null;
    team.repairTarget=null;
    team.repairProgress=0;
    team.musterT=0;
    team._locked=false;
    team._autoMode=false;
    team._readyT=0;
    status(`${team.label} reset to ready`);
  }
  btn('dev-btn-reset-alpha', ()=>resetTeam('alpha'));
  btn('dev-btn-reset-bravo', ()=>resetTeam('bravo'));

  btn('dev-btn-clear-locks', ()=>{
    const d=player?.damage; if(!d){ status('No damage state'); return; }
    for(const team of Object.values(d.teams||{})){ team._locked=false; }
    status('Team locks cleared');
  });
  btn('dev-btn-skip-muster', ()=>{
    const d=player?.damage; if(!d){ status('No damage state'); return; }
    for(const team of Object.values(d.teams||{})){ if(team._readyT>0) team._readyT=0; }
    status('Muster countdown skipped');
  });

  // ── Watertight Doors ──────────────────────────────────────────────────────
  (function(){
    const container=document.getElementById('dev-wtd-row');
    if(!container) return;
    const WTD_LABELS=[
      {key:'fore_ends|control_room',    label:'TORP / CTRL'},
      {key:'control_room|aux_section',  label:'CTRL / AUX'},
      {key:'aux_section|reactor_comp',  label:'AUX / RX'},
      {key:'reactor_comp|engine_room',  label:'RX / MAN'},
      {key:'engine_room|aft_ends',      label:'MAN / AFT'},
    ];
    for(const wtdDef of WTD_LABELS){
      const row=document.createElement('div');
      row.style.cssText='display:flex;align-items:center;gap:6px;';
      row.innerHTML=`
        <span style="font-size:9px;color:rgba(0,200,255,0.55);width:78px;flex-shrink:0">${wtdDef.label}</span>
        <button class="dev-btn" style="padding:2px 6px;font-size:10px;" data-wtd-key="${wtdDef.key}" data-wtd-action="toggle">TOGGLE</button>
      `;
      container.appendChild(row);
    }
    container.addEventListener('click', e=>{
      const btn2=e.target.closest('[data-wtd-key]'); if(!btn2) return;
      const key=btn2.dataset.wtdKey;
      const [sA,sB]=key.split('|');
      if(!_DMG){ status('DMG not ready'); return; }
      _DMG.toggleWTD(sA,sB);
      const d=player?.damage;
      status(`WTD ${btn2.closest('div').querySelector('span').textContent}: ${d?.wtd?.[key]||'?'}`);
    });
  })();
  btn('dev-btn-wtd-open-all', ()=>{
    const d=player?.damage; if(!d){ status('No damage state'); return; }
    for(const key of Object.keys(d.wtd||{})) d.wtd[key]='open';
    status('All WTDs opened');
  });
  btn('dev-btn-wtd-close-all', ()=>{
    const d=player?.damage; if(!d){ status('No damage state'); return; }
    if(!_DMG) return;
    for(const [sA,sB] of _DMG.WTD_PAIRS){
      const key=sA+'|'+sB;
      if((d.wtd?.[key]||'open')==='open') _DMG.toggleWTD(sA,sB);
    }
    status('All WTDs closed');
  });
  btn('dev-btn-wtd-kill-hyd', ()=>{
    const d=player?.damage; if(!d){ status('No damage state'); return; }
    const cur=d.systems?.hyd_main||'nominal';
    d.systems.hyd_main=cur==='destroyed'?'nominal':'destroyed';
    status(`hyd_main \u2192 ${d.systems.hyd_main}`);
  });

  // ── Damage state ──────────────────────────────────────────────────────────
  btn('dev-btn-refresh-state', refreshState);
  btn('dev-btn-full-reset', ()=>{
    if(_SIM?.reset){
      _SIM.reset();
      status('Full reset');
    } else { status('SIM not ready'); }
  });

  // ── World ─────────────────────────────────────────────────────────────────
  btn('dev-btn-kill', ()=>{
    for(const e of enemies) e.dead=true;
    status('All enemies killed');
  });

  // ── Spawn ─────────────────────────────────────────────────────────────────
  function spawnRole(role){
    if(role==='boat'){ _AI?.spawnEnemy?.(); status('Spawned boat'); return; }
    _AI?.spawnSub(Math.random()*Math.PI*2, 1200, role, 0);
    status(`Spawned ${role}`);
  }
  function spawnCZ(role){
    const CZ=CONFIG.detection?.cz||{};
    const czDist=((CZ.min??4800)+(CZ.max??5500))/2;
    _AI?.spawnSub(Math.random()*Math.PI*2, czDist, role, 0);
    status(`Spawned CZ ${role} @ ${czDist|0}wu`);
  }
  btn('dev-btn-hunter',      ()=>spawnRole('hunter'));
  btn('dev-btn-pinger',      ()=>spawnRole('pinger'));
  btn('dev-btn-interceptor', ()=>spawnRole('interceptor'));
  btn('dev-btn-boat',        ()=>spawnRole('boat'));
  btn('dev-btn-cz-hunter',   ()=>spawnCZ('hunter'));
  btn('dev-btn-cz-pinger',   ()=>spawnCZ('pinger'));

  function spawnShip(spawnFn, label){
    const brg=Math.random()*Math.PI*2;
    const dist=800+Math.random()*600;
    spawnFn(brg, dist);
    status(`Spawned ${label}`);
  }
  btn('dev-btn-november', ()=>spawnShip(_AI.spawnNovember, 'NOVEMBER (SSN)'));
  btn('dev-btn-whiskey',  ()=>spawnShip(_AI.spawnWhiskey,  'WHISKEY (SSK)'));
  btn('dev-btn-golf',     ()=>spawnShip(_AI.spawnGolf,     'GOLF (SSB)'));
  btn('dev-btn-foxtrot',  ()=>spawnShip(_AI.spawnGamma,    'FOXTROT (SSK)'));
  btn('dev-btn-kilo',     ()=>spawnShip(_AI.spawnEta,      'KILO (SSK)'));
  btn('dev-btn-yankee',   ()=>spawnShip(_AI.spawnYankee,   'YANKEE (SSBN)'));
  btn('dev-btn-delta',    ()=>spawnShip(_AI.spawnEpsilon,  'DELTA (SSBN)'));
  btn('dev-btn-typhoon',  ()=>spawnShip(_AI.spawnSSBN,     'TYPHOON (SSBN)'));
  btn('dev-btn-papa',     ()=>spawnShip(_AI.spawnPapa,     'PAPA (SSGN)'));
  btn('dev-btn-oscar',    ()=>spawnShip(_AI.spawnTheta,    'OSCAR (SSGN)'));
  btn('dev-btn-akula',    ()=>spawnShip(_AI.spawnZeta,     'AKULA (SSN)'));

  btn('dev-btn-krivak', ()=>spawnShip(_AI.spawnIota,   'KRIVAK (frigate)'));
  btn('dev-btn-udaloy', ()=>spawnShip(_AI.spawnKappa,  'UDALOY (destroyer)'));
  btn('dev-btn-grisha', ()=>spawnShip(_AI.spawnLambda, 'GRISHA (corvette)'));
  btn('dev-btn-slava',  ()=>spawnShip(_AI.spawnMu,     'SLAVA (cruiser)'));
}
