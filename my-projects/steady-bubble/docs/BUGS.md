# Steady Bubble — Bug Tracker

Bugs found during Phase 3 playtesting. These may be porting regressions (V2 behaves differently from V1) or pre-existing V1 bugs noticed for the first time.

---

## Open

| # | Description | Severity | Found | Notes |
|---|---|---|---|---|
| B013 | Crush depth reduction from hull damage may be too punishing — review tuning | Review | 2026-03-18 | Deferred — balance decision. Formula: `crushD = crushD_base * (0.60 + 0.40 * hpFrac)`. |
| B014 | Fire modelled per WT section but should be per compartment (room) | Gameplay/Design | 2026-03-18 | Deferred — significant rework. Fire already tracks per-room; section-level logic needs redesign. |
| B026 | Submarine selection screen needs pre-launch tube loadout configuration | Feature | 2026-03-19 | Deferred — feature request. |
| B028 | Trafalgar at PD: no TMA solution building for contacts at 15-20nm | Investigate | 2026-03-19 | Working as designed — towed array performance at PD is reduced by layer penalty + surface noise. Will improve with B029. |
| B029 | Towed array performance is constant at all depths — should vary with thermocline | Design/Gameplay | 2026-03-19 | Deferred — design decision. Needs depth-dependent baseRange multiplier. |
| B034 | Battery bar overlapped by COME TO PD button — needs layout redesign | Visual/Design | 2026-03-19 | Deferred — needs battery section split. |
| B035 | Towed/hull baffle cone overlap — misleading alpha | Visual | 2026-03-19 | Deferred — fiddly geometry clipping. |

## Fixed

| # | Description | Fixed | Notes |
|---|---|---|---|
| B001 | Bearing arrow on sonar trace reversed | 2026-03-19 | Replaced TMA displacement heading with bearing-rate + range-rate vector math. Requires both rates before showing arrow. |
| B002 | Cannot fire at designated TDC target | 2026-03-18 | `wepsProposal` was on wrong state object (session vs ui). |
| B003 | E-blow MBT tanks drain too slowly / stall at 30-40% | 2026-03-19 | Depth controller was refilling tanks after blow completed. Added `_blownBallast` flag to keep depth controller hands-off until surfaced. Also added HPA depth-scaling (Boyle's law) for realistic air consumption. |
| B004 | No CONN confirmation on blow cancel | 2026-03-19 | Added `blowCancelledByOrder` comms call + state clearing on depth step and crash dive cancel paths. |
| B005 | E-blow downgrades FLANK to AHEAD FULL | 2026-03-19 | Already fixed in code — only sets AHEAD FULL if current speed < FULL. |
| B006 | Silent running doesn't snap telegraph | 2026-03-19 | Already fixed in code — snaps to AHEAD SLOW if speed > SLOW. |
| B007 | HP air recharge at PD for nuclear subs | 2026-03-19 | Snorkel system enabled for all sub types (was diesel-only). HPA recharge now works while snorkeling. |
| B008 | Crash dive ballast fill rate | 2026-03-19 | Crash dive now floods MBTs rapidly (bypasses depth controller). Changed from timer-based to flag-based — player cancels by depth change or e-blow. |
| B009 | Coolant leak/SCRAM cycle repetitive comms | 2026-03-19 | Added leak counter — comms escalate from full report (1st) to "patch not holding" (2nd) to "system is failing, SCRAM inevitable" (3rd+). |
| B010 | SCRAM should not set emergency stations | 2026-03-19 | Verified correct — no code path sets emergency/casualty state on SCRAM. |
| B011 | Full Reset doesn't clear emergency stations | 2026-03-19 | Added `setCasualtyState('normal')` and `setTacticalState('cruising')` to `SIM.reset()`. |
| B012 | WT2 flood highlights WT1 on schematic | 2026-03-19 | Section highlight was using `effectiveState` (includes ctrl-node dependencies from other sections). Changed to `dmg.systems[s]` (local state only). |
| B015 | Watchkeepers always suppress fires | 2026-03-19 | Watchkeepers were not distributed across burning rooms — each room claimed full watch count. Fixed to split watchers evenly across detected fires. |
| B016 | N2 drench not triggering on 100% fires | 2026-03-19 | Drench required DC team on scene (which often doesn't arrive in time). Added watchkeeper-initiated drench path when fire > 95% and no DC team present. |
| B017 | DC buttons always show FIRE | 2026-03-19 | "FIRE" catch-all showed for every compartment with fire regardless of team state. Now shows dim label+hazard when team is busy elsewhere, bright "FIRE" only when team is ready. |
| B018 | Clicks pass through DC panel overlay | 2026-03-19 | Added overlay check in mousedown handler — blocks route/waypoint clicks when damage/DC/crew panels are open. |
| B019 | Sonar trace labels too small | 2026-03-19 | Bumped quality tags (BRG/BLDG/SOLID) and CLSNG/OPNG from U(6) to U(8). |
| B020 | Depth buttons ordered incorrectly | 2026-03-19 | Bottom row swapped — ▼50 left, ▼10 right, mirroring top row. |
| B021 | Compass turn buttons ordered inconsistently | 2026-03-19 | Starboard buttons swapped — 10° top, 1° bottom, matching port side. |
| B022 | Medical system non-functional | 2026-03-19 | Verified working — system is wired and ticking. No wounded crew were being generated because watchkeeper suppression was too strong (fixed in B015). |
| B023 | Destroyed contact loses all data | 2026-03-19 | Already working — dead contacts show "DESTROYED — LAST KNOWN" in contacts list, TDC freezes, PURGE DEAD button available. |
| B024 | Watch change button doesn't work | 2026-03-19 | Button set `_pendingWatchChange` flag (never read). Changed to call `SIM.initiateWatchChange()` directly. |
| B025 | Missile reload instant | 2026-03-19 | Already working — missiles use `reloadMult` (default 1.5×) on base torpedo reload time. |
| B027 | Load buttons too small | 2026-03-19 | Button width used hardcoded U(150) instead of actual section width. Changed to use `w`. |
| B030 | Ping alert count wrong | 2026-03-19 | Working as designed — alert count IS range-gated to `datumRange` (5000wu). Large radius means most contacts are within range. |
| B031 | Type 209 spawns below diving limit | 2026-03-19 | Spawn depth was hardcoded 260m. Changed to `Math.min(260, C.player.divingLimit)`. |
| B032 | VLS fires instantly | 2026-03-19 | Added 4-second launch sequence with `launching` state, countdown, and comms (FPP acknowledge, cell pressurised, fire order, missile away). |
| B033 | Tube display overflows >7 tubes | 2026-03-19 | Pip width now scales responsively — `min(U(18), availableWidth / tubeCount)`. |
| B036 | Depth buttons don't snap to boundary | 2026-03-19 | depthStep now snaps to nearest multiple of step size in the direction pressed before stepping evenly. |
| B037 | TMA too slow on loud contacts | 2026-03-19 | TMA solver now uses bearing uncertainty as signal quality proxy. Loud close contacts (low u_brg) get up to 2.5× reduction in required baseline and observations. |
