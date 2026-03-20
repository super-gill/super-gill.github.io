# Steady Bubble — Feature Requests

Proposed features for post-migration development. Each entry includes the request, rationale, and initial design notes. Features are not approved for implementation until reviewed and signed off.

---

## FR-001 — Contact Trace Filter

**Date:** 2026-03-19
**Status:** Proposed
**Priority:** TBD

### Description

Add a filter control to the tactical display that limits which sonar contact bearing lines (traces) are drawn. Currently all detected contacts render their bearing lines simultaneously, which clutters the display during multi-contact engagements — particularly in Wave 2+ wolfpack scenarios where 4-7 contacts may be active.

### Filter Modes

| Mode | Traces Shown | Condition |
|---|---|---|
| **ALL** | Every active sonar contact | Default. Current behaviour. |
| **SELECTED** | Only the TDC-designated contact | Requires a contact to be designated. If no contact is designated, falls back to ALL. |
| **SURFACE** | Contacts classified as SURFACE or MERCHANT | Requires Stage 1 classification (TMA quality >= 0.20). Unclassified contacts are hidden. |
| **SUBMERGED** | Contacts classified as SUBMERGED | Requires Stage 1 classification (TMA quality >= 0.20). Unclassified contacts are hidden. |
| **MILITARY** | Contacts classified as military combatants (SSN, SSK, SSBN, SSGN, FRIGATE, DESTROYER, CORVETTE, CRUISER) | Requires Stage 2 classification (TMA quality >= 0.35 + tonal accumulation time). MERCHANT contacts are excluded. Unclassified contacts are hidden. |

### Design Notes

- The filter affects **bearing line rendering only**. It does not affect sonar detection, TMA processing, contact persistence, or any simulation logic. Contacts still exist and are tracked regardless of filter state — the filter is a display tool.
- Position blobs, contact ID labels, and torpedo tracks follow the same filter — if a contact's traces are hidden, its blob and label are also hidden.
- Torpedo tracks (friendly and enemy) are **always visible** regardless of filter. Torpedoes are not sonar contacts — they are weapons in the water.
- The TDC-designated contact is **always visible** regardless of filter (except in SELECTED mode where it is the only one shown). The CO always sees what they are shooting at.
- Wire-guided torpedo sonar relays (wire contact markers) follow the designated contact visibility.
- The filter state is stored in `ui-state.js` as `contactFilter: 'all' | 'selected' | 'surface' | 'submerged' | 'military'`.
- The filter control is a cycle button or dropdown on the tactical display panel. Keyboard shortcut TBD.

### Affected Files (Estimated)

| File | Change |
|---|---|
| `state/ui-state.js` | Add `contactFilter` property |
| `render/render-contacts.js` | Apply filter before drawing bearing lines, blobs, labels |
| `render/panels/` (TBD) | Filter control UI element |
| `ui/input.js` or `ui/keybindings.js` | Keyboard shortcut binding |

### Considerations

- Unclassified contacts (TMA quality below the classification threshold for the selected filter) are hidden, not shown with a "?" marker. The rationale is that if the sonar team hasn't classified a contact, the CO cannot meaningfully filter by type — hiding them reinforces that classification matters.
- The MILITARY filter requires Stage 2 classification, which takes 15-25 seconds of sustained TMA quality above 0.35. This means freshly-detected contacts won't appear in MILITARY mode until the sonar team has had time to analyse their tonals. This is intentional — it rewards patience and TMA discipline.
- In SELECTED mode with no designation, the display shows all contacts (graceful fallback) rather than an empty display.
