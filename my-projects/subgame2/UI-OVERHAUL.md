# Steady Bubble — UI Overhaul Plan

## Goals
1. **Readability at any screen size** — player-adjustable UI scale, responsive layout
2. **No lost features** — every existing control and readout preserved
3. **Remove duplication** — eliminate redundant displays
4. **Cleaner visual hierarchy** — information grouped by urgency, not just proximity

---

## Phase 0: Foundation — UI Scale System

The single biggest improvement. Everything else builds on this.

### 0A. Add a `uiScale` setting to `config.js` / `game` state
- Default `1.0`, range `0.6 – 1.6` (step 0.1)
- Persisted in `localStorage`
- All DPR-scaled pixel values (`N * DPR`) become `N * DPR * uiScale`
- Introduce a helper: `U(px)` → `Math.round(px * DPR * uiScale)` used everywhere instead of raw `N*DPR`

### 0B. Create `ui-scale.js` module
- Exports `U(px)`, `uiFont(size)`, `uiScale` getter/setter
- Exposes `setUIScale(val)` which updates the scale and recalculates layout constants
- Keyboard shortcut: `+` / `-` to adjust scale, `0` to reset

### 0C. Migrate all render files to use `U()`
- `render-hud.js`, `render-panel.js`, `render-utils.js`, `render-world.js`
- Replace every `N*DPR` with `U(N)`
- `PANEL_H`, `STRIP_W` become dynamic getters recalculated from `U()`

### 0D. Add in-game scale slider
- Small widget in the threat bar area or accessible via a settings gear icon
- Shows current scale percentage
- Clickable +/- buttons

**Files touched:** `config.js`, new `ui-scale.js`, `render-utils.js`, `render-hud.js`, `render-panel.js`, `render-world.js`, `input.js`, `index.html`

---

## Phase 1: Responsive Layout Engine

Currently every panel section has hardcoded pixel widths (e.g. engine telegraph = 160px, depth = 130px, trim = 215px, etc.). This breaks on smaller screens and wastes space on larger ones.

### 1A. Define panel sections with min/preferred/max widths
Replace the current linear x-offset chain with a flex-like layout pass at the start of `drawPanel()`:

```
sections = [
  { id: 'engine',    min: 120, pref: 150, max: 170 },
  { id: 'depth',     min: 100, pref: 125, max: 140 },
  { id: 'trim',      min: 160, pref: 200, max: 240 },
  { id: 'status',    min: 120, pref: 155, max: 180 },
  { id: 'posture',   min:  90, pref: 115, max: 130 },
  { id: 'emergency', min: 100, pref: 130, max: 150 },
  { id: 'weapons',   min: 120, pref: 145, max: 170 },
  { id: 'wires',     min: 140, pref: 175, max: 200 },
  { id: 'tdc',       min: 220, pref: 999, max: 999 },  // fills remainder
]
```

A simple layout function distributes available width:
1. Give each section its `min`
2. Distribute remaining space proportionally up to `pref`, then `max`
3. If total `min` exceeds panel width → collapse lowest-priority sections into a scrollable overflow or stack vertically

### 1B. Panel height becomes responsive
- `panelH` scales with `uiScale` but also has a floor/ceiling relative to viewport height
- On very short viewports (< 600px effective), panel compresses and hides labels, showing only icons/values
- Log panel width/height adapts to available space above the panel

### 1C. Depth strip width scales with `uiScale`
- Current 88px (56px CSS) strip works at 1x but wastes space at small scales
- Min width: 60px (scaled), max: 100px

### 1D. Breakpoint system
Define 3 tiers based on effective chart area (W - strip, H - panel):
- **Full** (> 900 x 500): All sections visible, full labels
- **Compact** (600-900 x 400-500): Shorter labels, tighter padding, some sections collapse
- **Minimal** (< 600 x 400): Icon-only mode for engine/depth, posture/emergency merge

**Files touched:** `render-panel.js`, `render-hud.js`, `render-utils.js`

---

## Phase 2: Eliminate Duplication & Redundancy

### Current duplicated information:
| Info | Location 1 | Location 2 | Resolution |
|------|-----------|-----------|------------|
| Depth (actual) | Depth section "ACTUAL" | Depth strip readout (bottom) | **Keep strip only** — it's always visible. Remove from panel section. |
| Depth (ordered) | Depth section "ORDERED" | Depth strip "ORD" marker + readout | **Keep strip only**. Panel shows step buttons and PD only. |
| DC team status | DC Log tab (top strip) | Damage panel (team bar) | **Keep both** — they serve different contexts (quick glance vs detailed). No change. |
| Control hints | Threat bar (always) | Start screen (bottom) | **Remove from threat bar** — show only on hover or via help key. Reclaim space. |
| `drawDcPanel()` | Entire function body | Already `return;` — dead code | **Delete the function body**. Already deprecated. |
| Crew totals | Status section "CREW" bar | Damage panel crew summary | Crew panel header | **Keep status bar + damage panel**. Remove from crew panel header (redundant with inline totals). |
| Speed readout | Status section "SPD" | Engine telegraph (implicitly, selected button shows kts) | **Keep status "SPD" only** — telegraph buttons already show which speed is selected. Consider adding kt readout to the telegraph section header instead. |
| Wave counter | Status section "WAVE" | (only in waves scenario) | **Keep but hide when scenario != waves** — saves space in non-wave modes. |

### Actions:
- Remove "ACTUAL" and "ORDERED" depth text from depth panel section → section shrinks, gains room for bigger step buttons
- Remove control hints from threat bar → threat bar becomes purely a threat indicator
- Delete dead `drawDcPanel()` function body
- Move "SPD" readout into engine telegraph section header (e.g. "ENGINE ORDER — 14kt")
- Hide WAVE counter for non-wave scenarios
- Remove HDG from status section (it's shown on the chart compass rose / can be added to a header readout bar)

**Files touched:** `render-panel.js`, `render-hud.js`

---

## Phase 3: Readability Improvements

### 3A. Font sizing hierarchy
Currently all text uses the same monospace font with ad-hoc sizes. Define a type scale:

| Role | Base size (before U()) | Weight | Use |
|------|----------------------|--------|-----|
| Section header | 11px | bold | ENGINE ORDER, DEPTH, etc. |
| Value large | 15px | bold | Primary readouts (speed, heading, depth) |
| Value medium | 12px | normal | Secondary readouts |
| Label | 9px | normal | Sub-labels (ACTUAL, ORDERED, etc.) |
| Badge | 8px | bold | Pills, status tags |
| Tiny | 7px | normal | Timestamps, hints |

### 3B. Consistent spacing
Define spacing constants:
- `PAD_S = U(4)` — tight (between related elements)
- `PAD_M = U(8)` — standard (section padding)
- `PAD_L = U(14)` — generous (between sections)

### 3C. Colour palette cleanup
Currently ~40+ hardcoded RGBA values. Centralise into a theme object:

```js
const THEME = {
  bg:        { panel: 'rgba(241,245,249,0.97)', overlay: 'rgba(8,14,26,0.97)' },
  text:      { primary: '#111827', secondary: 'rgba(17,24,39,0.55)', muted: 'rgba(17,24,39,0.28)' },
  accent:    { blue: '#1e3a5f', red: '#7c1010', green: '#16a34a', amber: '#d97706', teal: '#0d9488' },
  state:     { nominal: 'rgba(22,163,74,...)', degraded: 'rgba(217,119,6,...)', offline: 'rgba(220,80,20,...)', destroyed: 'rgba(200,30,30,...)' },
  button:    { active: '#1e3a5f', available: 'rgba(30,45,70,0.38)', unavailable: 'rgba(17,24,39,0.05)' },
};
```

### 3D. Button sizing and hit targets
- Current buttons are 15-22px tall (before DPR). At low uiScale this becomes tiny.
- Enforce minimum hit target: `U(18)` height, `U(40)` width
- Add subtle hover state detection (track mouse position → highlight hovered button)

### 3E. Log panel readability
- Row height scales with `U()` — currently fixed 19px
- Category pills get more padding
- Consider alternating row backgrounds for scan-ability
- Sonar raw tab: column headers sticky, data rows scroll

**Files touched:** new `theme.js`, `render-panel.js`, `render-hud.js`, `render-utils.js`

---

## Phase 4: Information Display Polish

### 4A. Primary readout bar (new)
Add a thin persistent readout strip between the threat bar and the chart area:
```
SPD 14kt | HDG 045° | DEP 280m→250m | NOISE ██░░ | CREW 28/30
```
- Single horizontal line, always visible
- Frees the status panel section from duplicating these values
- Status section can focus on damage pills, tactical state, and buttons

### 4B. Threat bar redesign
- Remove control hints text
- Make the bar thinner (U(20) instead of U(28))
- Add small [?] button at right that shows controls overlay on click

### 4C. Compact engine telegraph
Current telegraph shows 9 buttons vertically. Alternative:
- Show only the 5 most relevant speeds (hide BACK speeds until BACK is selected or speed is 0)
- Or: horizontal slider with notch positions
- Keep existing vertical layout as an option at Full breakpoint

### 4D. Improved depth section
With actual/ordered readouts removed (moved to strip), the section becomes just:
- Step buttons (▲50, ▲10, ▼10, ▼50) — can be larger
- PD button
- Optional: depth target input via click-drag on depth strip

### 4E. Wire guidance cleanup
- When no wires are live, collapse to a single-line status instead of taking full section width
- Wire section only expands when a torpedo has a live wire

### 4F. Collapsible log panel
- Toggle button to show/hide (currently always drawn when game is active)
- Drag handle to resize width
- Semi-transparent so chart is partially visible behind it

---

## Phase 5: Settings & Accessibility

### 5A. Settings overlay (new)
Accessible via gear icon or `ESC` key:
- **UI Scale** slider (0.6 – 1.6)
- **Panel opacity** slider
- **Show grid** toggle
- **Show control hints** toggle
- **Font size override** (small / medium / large)
- Save to `localStorage`

### 5B. Keyboard shortcut reference
- `?` key opens a fullscreen overlay showing all keybindings
- Grouped by category: Navigation, Weapons, Damage Control, UI

### 5C. Cursor feedback
- Change cursor to `pointer` when hovering clickable buttons
- Highlight hovered button with subtle border change
- Already have mouse position tracking in `input.js` — just need to check button rects each frame

---

## Implementation Order

| Step | Phase | Description | Effort |
|------|-------|-------------|--------|
| 1 | 0A-0C | `U()` helper + migrate all DPR refs | Medium — mechanical but touches every render file |
| 2 | 0D | In-game scale control (+/-/slider) | Small |
| 3 | 2 | Remove duplicates, delete dead code | Small |
| 4 | 3C | Theme object, centralise colours | Medium |
| 5 | 3A-3B | Type scale + spacing constants | Small |
| 6 | 1A | Flex-like panel section layout | Medium-Large — core layout rewrite |
| 7 | 4A | Primary readout bar | Small |
| 8 | 4B | Threat bar slim-down | Small |
| 9 | 1B-1D | Responsive breakpoints | Medium |
| 10 | 3D | Button sizing + hover states | Small |
| 11 | 4C-4E | Section-specific polish | Medium |
| 12 | 4F | Collapsible/resizable log panel | Medium |
| 13 | 5A-5C | Settings, help overlay, cursor | Medium |

Steps 1-5 are foundational and should be done first in order. Steps 6+ can be parallelised or reordered based on priority.

---

## Files Reference

| File | Role | Overhaul Impact |
|------|------|----------------|
| `js/config.js` | Constants | Add layout defaults, uiScale |
| `js/render-utils.js` | Drawing primitives, coords | Add `U()`, update PANEL_H/STRIP_W to dynamic |
| `js/render-panel.js` | All panel rendering (~2400 lines) | Heaviest changes — layout, dedup, theme |
| `js/render-hud.js` | Depth strip + threat bar | Scale migration, threat bar redesign |
| `js/render-world.js` | Chart, grid, routes | Scale migration for scale bar, grid |
| `js/input.js` | Mouse/keyboard handling | Hover detection, new shortcuts (+/-/?/ESC) |
| `js/panel.js` | Panel logic + button registry | No major changes, btn2 gets hover support |
| `js/render.js` | Main render loop | Wire in readout bar, settings overlay |
| NEW `js/ui-scale.js` | Scale system | New module |
| NEW `js/theme.js` | Colour/spacing/font constants | New module |

---

## Non-Goals (out of scope)
- Touch/mobile input (separate project)
- Gamepad support
- Sound/audio settings
- Save/load game state
- Tutorial/onboarding flow
