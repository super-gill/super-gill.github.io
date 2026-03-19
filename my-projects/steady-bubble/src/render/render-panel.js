// render-panel.js — thin re-export wrapper
// All panel rendering split into sub-modules under ./panels/
'use strict';

export { _bindRenderPanel } from './panels/panel-context.js';

import { drawStartScreen } from './panels/render-start.js';
import { drawLogPanel, drawDcPanel } from './panels/render-log.js';
import { drawDamagePanel } from './panels/render-dc.js';
import { drawCrewPanel } from './panels/render-crew.js';
import { drawPanel } from './panels/render-command.js';
import { drawEndScreen } from './panels/render-endscreen.js';
import { drawDamageScreen } from './panels/render-damage-screen.js';

export const RPANEL = {
  drawStartScreen,
  drawLogPanel,
  drawDcPanel,
  drawDamagePanel,
  drawCrewPanel,
  drawDamageScreen,
  drawPanel,
  drawEndScreen,
};
