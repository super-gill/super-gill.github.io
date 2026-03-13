# Realism Pass — Design Notes

## 1. The 2D Problem
Not a major problem structurally. Targeted fixes needed:
- Torpedo seeker range degrades when target is outside vertical window (±120m) — partially coded, needs enforcement audit
- Layer crossing should degrade active torpedo seekers, not just passive sonar — gives player real evasion option
- Enemy depth variation: do enemies run at varied depths? If not, simulation is implicitly 2D where it shouldn't be

**Action:** Audit torpedo.js vertWindow/vertFuse enforcement. Add layer penalty to active seeker acquisition.

---

## 2. Enemy Submarine Noise Levels
Soviet boats were louder but there's a spectrum:
- November/Echo: very loud (170dB+)
- Victor I/II: loud but faster (30kt+)
- Victor III: significantly quieter
- Alfa: titanium hull, 43kt, very deep — loud at speed
- Akula: first truly quiet Soviet boat (~late 80s)

Current config: enemies at 0.58–0.82 noise uniformly. Problems:
- No distinction between hull types
- Enemy noise doesn't vary with own speed (should be dramatic at 18kt sprint vs. 3kt creep)
- Interceptor at 3kt ambush should be 0.20–0.30 noise — currently just as detectable as a sprinting sub

**Action:** Make enemy noise dynamic (speed-dependent like player). Tie base noise floor to sub type.

---

## 3. Environmental Model Expansion
Ordered by gameplay value:

**High value, achievable:**
- Convergence zones: ~5000–5500 wu detection enhancement ring. Enemies detect you at unexpected ranges. Implementable as range-band detection bonus multiplier.
- Sea-state noise floor: Session parameter (calm/moderate/rough) affecting detection probabilities. Surface ships much noisier in rough conditions.
- Bottom depth variation / seamounts: Even a few shallow ridges add tactical geography.

**Medium value:**
- SOFAR channel (deep sound channel at 600–1200m) — probably out of scope
- Biologics/shipping background noise — varies by region

**Low priority:**
- Bottom bounce paths — complex to model and hard to communicate visually

---

## 4. Torpedo Model Expansion
Current: two-phase guidance, passive/active seeker, snake search parameter.

**Gaps:**
- Depth enforcement: seeker should fail outside vertical window — audit needed
- Search pattern: searchSnake parameter exists but implementation unclear — proper snake/circle on lost contact
- Wire depth steering: player can guide course but not depth via wire — matters if depth evasion is meaningful
- Speed/endurance tradeoff: no fuel model, just a life timer — sprinting should burn range
- Depth countermeasures: noisemakers at different depths to pull torps away vertically

---

## 5. Damage System Expansion
Current bones: 5 compartments, 12 systems, named crew, flooding model.

**Needs:**
- Player agency on flooding: isolate compartment (saves boat/loses crew), pump bilges (buys time/adds noise), emergency blow (surfaces you — tactically catastrophic)
- Depth-pressure flooding rate: flooding at 480m should be 5× faster than at 100m — creates urgency to ascend (but ascending = shallow + noisy + in threat)
- System cascade failures: flooded engine room → propulsion loss, hydraulics loss → manual depth planes only, reactor SCRAM → sonar range degrades
- Crew lethality: dead crew in a compartment → DC team unavailable, compartment can't self-report
- Fire model: torpedo hit can cause fire (CO2 flood, evacuation, O2 management) — distinct from flooding

---

## Implementation Priority

### By Impact:
1. Enemy noise dynamics
2. Torpedo depth enforcement
3. Flooding depth-pressure + player agency
4. Convergence zone detection
5. Wire depth steering
6. System cascade audit
7. Sea-state parameter

### By Ease (start here):
1. Enemy noise dynamics — modify ai.js noise calc, speed-dependent formula already exists for player
2. Torpedo vertical window enforcement — audit torpedo.js, likely a small fix
3. Sea-state parameter — config value + multiplier in sensors.js detection probability
4. Convergence zone — range-band multiplier in passiveUpdate
5. Flooding depth-pressure scaling — modify damage.js flood rate formula
6. Wire depth steering — add depth order to wire guidance in torpedo.js/weapons.js
7. System cascade audit — touches many files, complex
