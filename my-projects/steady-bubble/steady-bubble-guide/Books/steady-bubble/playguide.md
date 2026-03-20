Document Title: Steady Bubble — Play Guide
Document Version: 1.0
Document Date: 2026-03-18

# Getting Started

## Your First Mission

When the game loads you are presented with a scenario selection screen. Choose **Waves** (the only scenario) and **USS Dallas (688i)** for your first run. Dallas is the most balanced boat — no major weaknesses, no unusual mechanics.

Once the game starts, you are at 260m depth, heading east, at all stop. Nothing is trying to kill you yet. The first wave won't spawn until you move.

Here is what to do:

1. **Set speed.** Press **D** a few times to bring speed up to about 7 kt (AHEAD SLOW). This is a good patrol speed — quiet enough to listen, fast enough to generate TMA geometry.

2. **Set depth.** Press **S** twice to go deeper — 280m puts you just below the thermal layer. This is important: enemies above the layer have 40% less chance of hearing you.

3. **Set a waypoint.** Click somewhere on the ocean to set a heading. The boat will turn toward the waypoint.

4. **Wait and listen.** Bearing lines will start appearing on the tactical display as the sonar team detects the first wave. These are your sonar contacts.

5. **Watch the bearing lines.** Solid lines are from the hull array (unambiguous). The lines will have an ID label (S1, S2, etc). Pay attention to how the bearings change — this is TMA building a solution.

6. **Change course.** After 30-60 seconds, click a new waypoint to change heading by at least 30 degrees. This is critical — TMA needs bearing crossing angle. Without a course change, you will never get a firing solution.

7. **Designate a target.** When a contact shows a position blob (TMA quality > 0.15), click on it to designate it for the TDC. The blob or bearing line will highlight.

8. **Wait for DEGRADED.** The TDC panel will show the solution quality. When it reaches DEGRADED (0.35+), you can fire.

9. **Fire.** Press **F**. The torpedo launches wire-guided. You will see its track on the display.

10. **Wait.** The wire steers the torpedo toward the target. When the seeker locks on, it runs to the target autonomously. You will hear comms reports of the engagement.

That is the basic loop: move, listen, build TMA, fire, repeat.

## The Most Common Mistakes

### Going too fast
Speed is noise. At 20 kt you are nearly deaf (90% sonar degradation) and every enemy in the area can hear you. Patrol at 3-7 kt. Sprint only when repositioning or evading.

### Not changing course
TMA needs bearing geometry. If you drive in a straight line, your solution quality caps at about 0.28 — below the DEGRADED threshold needed to fire. You must change course to build a solution.

### Firing too early
A DEGRADED solution means the wire is steering on bearing alone with no lead angle. This works at close range but wastes torpedoes at long range because the target moves while the torpedo runs. Wait for SOLID (0.70+) when you can.

### Ignoring the thermal layer
The thermal layer between 180m and 280m is the most important tactical feature. Sound crossing it loses 40% signal. If you are below the layer and the enemy is above, you are dramatically harder to detect — and vice versa. Always be aware of which side of the layer you and the enemy are on.

### Using active sonar casually
An active ping gives you precise range and bearing on nearby contacts. It also broadcasts your position to every enemy within 5,000 wu with a massive suspicion boost. Use it only when you absolutely need range data or when you need the dazzle effect against incoming torpedoes.

## Understanding the Display

The main screen shows a top-down view of the ocean with your submarine at the centre.

- **Bearing lines** (thin lines radiating from your position) are sonar contacts. Solid lines are from the hull array. Dashed lines are from the towed array (these come in pairs — one is real, one is a mirror image).
- **Blobs** appear on bearing lines when TMA quality reaches 0.15+. These are the sonar team's best estimate of the target's position. They drift and update as more data arrives.
- **Torpedo tracks** appear as moving dots with trails. Blue/dark tracks are yours. Red tracks are enemy weapons.
- **The depth strip** on the right shows your depth, the thermal layer band (shaded), and depth envelope limits.
- **The bottom panel** shows speed, depth, weapon status, and tactical/casualty state.

# Sonar & Tracking

## How Passive Sonar Works

Your hull-mounted sonar array listens for sounds in the water. Every vessel in the ocean — including you — produces noise from its propeller, machinery, and movement through the water.

Detection depends on a simple equation: **target's noise minus your noise, modified by range, geometry, and the thermal layer.**

If the target is loud and you are quiet, you detect them at long range. If both of you are quiet, you detect them at short range or not at all. If you are loud, your own noise masks incoming signals (self-masking).

### What Affects Detection

- **Target noise:** Soviet submarines are loud (0.62 - 0.90 baseline). Surface ships are even louder. The quieter the target, the closer you need to be.
- **Your noise:** Every knot of speed adds flow noise. Flank speed adds a massive penalty. Silent running cuts your noise by 45%.
- **Range:** Detection probability falls with distance. Beyond ~2,800 wu, direct-path detection is unreliable.
- **Thermal layer:** 40% signal loss when sound crosses the layer boundary.
- **Baffles:** You cannot hear anything in a cone behind your stern (±15° at rest, expanding with speed).
- **Watch fatigue:** Tired sonar operators miss contacts. Up to 40% detection loss at full fatigue.

### Speed vs Detection Trade-off

This is the central tension of submarine warfare.

| Speed | Self-Masking | Sonar Effectiveness |
|---|---|---|
| 0-3 kt | Minimal | Near-maximum passive range |
| 4-7 kt | Moderate | Good detection, slight degradation starting |
| 8-10 kt | Significant | Noticeably reduced range |
| 10-15 kt | Heavy | Passive sonar seriously degraded |
| 15-20 kt | Severe | Nearly deaf — 80-90% reduction |
| 20+ kt | Total | Effectively blind passively |

The ideal patrol speed is 3-5 kt. You can hear enemies at maximum range while being nearly undetectable yourself.

## The Towed Array

If your vessel has a towed array (all except Type 209), deploy it with the panel button. It takes 30 seconds to stream but provides 4,500 wu detection range — significantly more than the hull array's ~2,800 wu.

### The Ambiguity Problem

The towed array cannot distinguish port from starboard. Every detection produces two bearing lines — one real, one a mirror image reflected across your heading axis. You will see both as dashed lines on the display.

The hull array resolves this ambiguity. When the hull array detects the same contact, the system compares bearings and determines which towed candidate is correct. This resolution requires 1-3 consistent hull array bearings — meaning the target must be close enough and loud enough for the hull array to hear it.

Until resolution, you have two possible target positions. Do not fire at an unresolved contact — you have a 50% chance of sending the torpedo in the wrong direction.

### Towed Array Restrictions

- **Speed limit:** Above 18 kt, the cable is stressed and the array degrades. Above 22 kt, it is destroyed instantly.
- **Emergency manoeuvres:** Emergency turns and crash dives damage or destroy the deployed array.
- **Dead cone:** ±28° off the stern produces no returns.
- **Deploy speed:** Cannot deploy above 12 kt.

## Building a TMA Solution

TMA (Target Motion Analysis) is how you turn a series of bearing lines into a position estimate — and eventually a firing solution.

### What TMA Needs

1. **Multiple bearings** — at least 2, ideally 6+
2. **Player movement** — you need to move at least 350 wu from your first observation to your last
3. **Bearing crossing angle** — the bearings must diverge. This only happens when you change course.

### The Manoeuvre Requirement

If you drive in a straight line, all your bearing observations are parallel (or nearly so). The solver cannot triangulate because there is no crossing angle. Your TMA quality will cap at roughly 0.28 — below the DEGRADED threshold.

To build a solution, you must change heading by at least 15-20 degrees. A 30+ degree course change produces rapid quality improvement. Two changes in opposite directions (a zig-zag) produce the best geometry.

### TMA Quality Tiers

| Quality | What You Get | What You Can Do |
|---|---|---|
| < 0.15 | Bearing line only | Nothing — keep observing |
| 0.15 - 0.35 | Position blob on display | Watch, but cannot fire |
| 0.35 - 0.70 | DEGRADED — range estimate | Fire wire-guided (no lead angle) |
| 0.70+ | SOLID — full solution | Fire with lead-angle intercept |

### Practical TMA Procedure

1. Detect contact on bearing. Note the bearing.
2. Continue on current heading for 30-60 seconds at 5-7 kt. This builds baseline.
3. Turn 30-40 degrees. Continue for another 30-60 seconds.
4. Check TMA quality. If DEGRADED, you can fire. If not, turn again.
5. For SOLID, continue manoeuvring. A zig-zag (turn left 30°, drive, turn right 30°) is ideal.

Total time from first detection to SOLID solution: typically 90-180 seconds depending on range and geometry.

## Contact Classification

As TMA quality builds, the sonar team progressively classifies the contact:

1. **Broadband** (quality ≥ 0.20): Type identified — SUBMERGED / SURFACE / MERCHANT. This tells you whether to engage or ignore.
2. **Tonals** (quality ≥ 0.35 + 15-25s): General category — SSN, SSK, FRIGATE, etc.
3. **Machinery analysis** (quality ≥ 0.50 + 20-40s): Specific class — SSN AKULA, FRIGATE KRIVAK, etc.

Classification helps you prioritise targets. An AKULA is more dangerous than a FOXTROT. A MERCHANT should not be engaged.

# Torpedo Employment

## Setting Up an Attack

### Step 1: Build TMA

You need at least a DEGRADED solution (0.35+) to fire. See the TMA section above. SOLID (0.70+) is strongly preferred — it gives lead-angle intercept, dramatically improving hit probability at range.

### Step 2: Designate the Target

Click on the contact's bearing line or position blob. The TDC panel will update with the designation and show the current solution quality.

### Step 3: Check Firing Conditions

Before pressing F, verify:

- **Speed ≤ 15 kt.** Wire-guided shots cannot be fired above 15 kt. The wire will part at launch.
- **Torpedo stock.** Check the weapon panel — do you have weapons remaining?
- **Tube availability.** At least one tube must be loaded and ready (not reloading).
- **Bearing arc.** The firing arc is ±55° from your heading. If the target is behind you, you need to turn before firing.

### Step 4: Fire

Press **F**. There is a 4.5-second delay as the crew runs through the firing procedure (flooding tube, opening outer doors, launching). You will hear the comms exchange.

The torpedo launches on the designated bearing and immediately begins wire guidance.

### Step 5: Wire Guidance

Your fire control system steers the torpedo via the wire. At DEGRADED quality, it steers toward the latest bearing. At SOLID quality, it computes a lead angle — steering the torpedo ahead of where the target will be.

You do not need to do anything — wire guidance is automatic. But you must maintain certain conditions:

- **Speed ≤ 15 kt.** Above 15 kt, wire stress begins. Above 20 kt, the wire parts in ~25 seconds. Above 22 kt, it parts in ~3 seconds.
- **No emergency manoeuvres.** Emergency turns and crash dives sever all wires instantly.
- **Range.** The wire has a maximum range of 3,000 wu. Beyond this, it parts automatically.

### Step 6: Seeker Acquisition

When the torpedo gets close enough and the target is within the seeker cone, the onboard seeker locks on. At this point the wire is no longer needed — the torpedo homes autonomously.

You will see the torpedo track curve toward the target. Comms will report the lock.

## Wire Management

### Multiple Torpedoes

You can have multiple wire-guided torpedoes in the water simultaneously. Each tube maintains its own wire. The fire control system steers all of them independently.

### Manual Wire Control

The wire panel allows manual override of individual torpedoes:

- **Auto TDC:** Default — fire control steers the torpedo. Toggle off for manual control.
- **Nudge:** Manual bearing adjustment (±degrees) when auto TDC is off.
- **Cut wire:** Deliberately sever the wire. The torpedo continues on its seeker or enters search pattern.
- **Select tube:** Click a tube to select it for the next shot.

### When Wires Break

Wires break from: speed stress, emergency manoeuvres, range exhaustion, or manual cut. When a wire breaks:

- The torpedo continues on its last steered heading
- If the seeker has a lock, it homes normally
- If no lock, it enters a search snake pattern along its last heading

## Countermeasure Defence

When an enemy torpedo is inbound:

1. **Deploy noisemaker** (X). The decoy creates a noise source that may seduce the torpedo away from you.
2. **Go quiet.** Reduce speed. Toggle silent running (Z). Your noise level determines how effectively the decoy competes with you for the torpedo's attention.
3. **Change depth.** Cross the thermal layer if possible. The torpedo's seeker range is reduced across the layer.
4. **Turn.** Put distance between you and the decoy. The torpedo chasing the decoy gives you time.

### Seduction Probability

The quieter you are when the decoy deploys, the more likely it works:

- At noise ~0.07 (creep + silent): ~90% seduction chance
- At noise ~0.25 (normal patrol): ~64%
- At noise ~0.40 (moderate speed): ~43%
- Minimum floor: 15% even at high noise

After the decoy expires, the torpedo has a reacquisition delay (4-8 seconds depending on torpedo type) before its seeker re-engages. Use this time to open range or cross the layer.

## Active Sonar as Defence

An active ping dazzles enemy torpedo seekers within 1,800 wu for 1.5 seconds. This can break a lock on an incoming torpedo, buying time for the seeker's reacquisition delay.

The cost is enormous — every enemy in 5,000 wu knows exactly where you are. Use this only when a torpedo is in its final approach and countermeasures have failed.

# Damage Control

## What Happens When You're Hit

A torpedo hit produces immediate effects:

- **Hull damage:** HP reduced (typically -24 per hit). This also reduces your effective crush depth.
- **Flooding:** Hull breach in the hit section. Rate depends on depth and severity.
- **Fire:** Possible ignition in rooms near the impact.
- **System damage:** Systems in the hit section degrade or go offline.
- **Crew casualties:** Personnel in the hit section may be killed or injured.
- **Noise transient:** The explosion is loud — enemies hear it.

## Surviving the First Hit

The first hit is survivable in all vessels. Your priorities, in order:

1. **Reduce speed.** You need plane authority to control depth, but flooding pumps add noise. Find a balance — 7-10 kt gives you plane authority without broadcasting your position.

2. **Check depth.** If you are deep, flooding is faster (higher ambient pressure). Consider coming shallower. But not too shallow — you need the thermal layer for concealment.

3. **Monitor the damage screen (H).** See which sections are flooding, which systems are damaged, and where the fires are. DC teams will auto-dispatch at emergency stations.

4. **Do not panic-manoeuvre.** Emergency turns and crash dives after a hit risk SCRAM (especially if you just did one before the hit). A SCRAM at depth with flooding is usually fatal.

## Surviving the Second Hit

Two hits are survivable but dangerous. Key concerns:

- **Two sections flooding** creates ~2.0 m/s sink rate. Planes can fight this if you have speed, but the boat is heavy.
- **Emergency blow** may be needed. The panel has the blow button. This dumps HPA into the ballast tanks to create positive buoyancy. It is loud and irreversible.
- **HPA depletion.** Two hits have cost you torpedo impulse air and ballast control pressure. If you are deep, you may not have enough HPA pressure to overcome ambient pressure.

## Surviving the Third Hit

Three sections flooding creates ~3.0 m/s sink rate. The boat is almost certainly lost unless:

- You are already shallow (< 150m)
- You can emergency blow with sufficient HPA
- The flooding is in non-adjacent sections (reducing trim impact)

At this point your priority is escape, not combat.

## Emergency Blow — When and How

Emergency blow forces air into the ballast tanks to create buoyancy. Use it when:

- Flooding is overwhelming plane authority
- You are sinking and cannot arrest the descent
- Depth is approaching crush depth

**How:** Use the panel emergency blow button. The system:

1. Checks HPA pressure against ambient. If insufficient, the blow fails.
2. If ballast control system is damaged, auto-blow fails — DC teams operate manually (~12 seconds delay).
3. Air flows into tanks, displacing water. Buoyancy increases.
4. Tanks clear when fill drops below 2%. The boat starts rising.

**After blow:** You will surface or reach shallow depth. At the surface, HPA recharges automatically. You are exposed to radar and visual detection, but you are alive.

**Critical detail:** Emergency blow is cancelled if you issue a new depth order. Do not press W/S after ordering a blow unless you intend to cancel it.

## DC Team Behaviour

You do not directly control DC teams. At emergency stations (called automatically on hit), teams auto-dispatch to casualties in priority order:

1. **Flooding** — highest priority. Teams shore up breaches.
2. **Fire** — second priority. Teams fight fires with extinguishers and drench systems.
3. **System repair** — lowest priority. Teams repair damaged systems.

Teams must muster (10-15 seconds), then travel to the casualty location (10-56 seconds depending on distance). Watertight doors affect routes. The reactor has a bypass tunnel — doors there never block transit.

# Depth & Stealth

## The Thermal Layer

The thermal layer between 180m and 280m is the single most important tactical feature in the game. It divides the ocean into two acoustic zones. Sound crossing the boundary loses 40% of its signal strength.

### Using the Layer Defensively

If you are **below the layer** (deeper than 280m) and enemies are **above** (shallower than 180m):

- They hear you at 60% of normal detection range
- You hear them at 60% of normal range
- Their torpedoes search at reduced range when crossing the layer
- You are significantly harder to find

This is your default defensive posture. Patrol at 280-320m depth.

### Using the Layer Offensively

If you have a SOLID TMA solution on a target above the layer, you can fire from below. Your torpedo crosses the layer with reduced seeker range — but wire guidance steers it to the target area. Once the seeker activates on the correct side of the layer, it has full capability.

### Layer Crossing

When you need to cross the layer (to reach periscope depth, to change tactical posture):

- **Go quiet first.** Reduce speed to 3-5 kt, toggle silent running.
- **Cross quickly.** Spend minimum time in the 180-280m transition zone.
- **Resume patrol depth** on the other side immediately.

## Noise Discipline

### The Quiet Ship

At 3 kt with silent running, your noise level is approximately 0.022-0.035 depending on vessel. At this level:

- Enemy suspicion decays faster (bonus decay below 0.14 noise)
- Detection range against you is minimal
- You can listen effectively

### The Noisy Ship

At 20 kt flank, your noise is 0.60+ and you are:

- Detectable at maximum passive range by every enemy in the area
- Nearly deaf — 90% sonar degradation
- Generating cavitation if shallow

### When to Make Noise

Making noise is sometimes necessary:

- **Repositioning:** Sprint to a new position, then stop and listen. The "sprint and drift" pattern.
- **Evading torpedoes:** Speed is survival. Get fast, deploy countermeasures, cross the layer.
- **Emergency blow:** Inherently noisy. Accept it — you are trying to survive, not hide.
- **Crash dive:** Trading stealth for depth. Sometimes the layer is worth the noise.

### Transients

Sudden actions create noise spikes (transients) that decay over time:

- Course reversal: +0.10
- Emergency turn: +0.28
- Crash dive: +0.35
- Torpedo launch: alerts enemies within 2,000 wu
- Active ping: alerts enemies within 5,000 wu
- HP compressor: +0.55 per second (sustained)

Transients decay at 0.35 per second. A crash dive transient takes about 1 second to decay fully, but during that second every enemy nearby has heard you.

## Evasion Tactics

When you have been detected and enemies are prosecuting:

### Break Contact

1. Go deep (below layer) and slow (3-5 kt, silent running)
2. Turn perpendicular to the enemy's bearing — put them in your beam, not your stern
3. Wait. Suspicion decays at 0.003/s base, plus 0.006/s bonus when your noise is below 0.14
4. At suspicion < 0.22, they stop investigating and return to patrol

### Sprint and Clear

1. Sprint at flank speed on a heading away from the threat
2. After 30-60 seconds, slow to 3 kt and go silent
3. Change heading by 90+ degrees
4. Resume quiet patrol

This works because you open range during the sprint (enemies lose you), then go quiet at a position they don't expect. The heading change prevents them from projecting your track.

### Layer Exploit

1. If above the layer, crash dive through it
2. Once below 280m, slow to 3 kt, silent running
3. The layer now blocks 40% of their detection — they may lose you entirely

This is the most reliable evasion technique. It works even against persistent enemies.

# Diesel Operations — Type 209

## Battery Management

The Type 209 is diesel-electric. Everything revolves around the battery.

- Battery drains at 0.00014 per knot per second
- At 8 kt (max speed), battery drains at 0.00112 per second — roughly 15 minutes of full-speed endurance
- At 3 kt (creep), drain is 0.00042 per second — roughly 40 minutes

You must surface to 12m depth to snorkel (run diesels and charge). This exposes you to detection.

### The Snorkel Dilemma

Snorkelling noise is 0.35 — one of the loudest things in the game short of a ping. While snorkelling:

- Every enemy within passive range knows where you are
- You are at 12m depth — shallow, vulnerable to surface weapons and radar
- Speed is capped at 5 kt

You must snorkel. The question is when and where.

### When to Snorkel

- **Before contact.** Snorkel while the area is clear. Get to 80%+ battery before engaging.
- **After clearing an area.** Kill all enemies in a wave, then snorkel before the next wave spawns (30-second delay).
- **When at maximum range from enemies.** Use TMA to estimate enemy positions. Snorkel when they are far away and moving away from you.

### Never Snorkel When

- Enemies have bearing on you (suspicion > 0.22)
- Torpedoes are in the water
- You haven't checked for contacts first (do a full passive listen at 3 kt before surfacing)

## Tactical Approach (Type 209)

The Type 209 is the hardest boat to play. Your advantages:

- **Near-silent on battery:** 0.018 noise floor — quieter than any nuclear boat
- **8 torpedo tubes:** More tubes than any NATO SSN
- **Deep launch missiles:** Exocet can fire from 55m — deeper than Harpoon

Your disadvantages:

- **14 torpedoes total:** Every shot must count
- **No towed array:** Hull array only — 2,800 wu max detection range
- **250m max depth:** The thermal layer floor is at 280m — you cannot go below it
- **Slow:** 12 kt maximum, 8 kt sustainable

### Recommended Tactics

1. **Start at 190m** (safe diving depth). You are above the layer but deep enough to be hard to find.
2. **Patrol at 3 kt.** Your noise floor of 0.018 is below the enemy's detection threshold at even moderate range.
3. **Use the layer from above.** You cannot go below it, but enemies diving below it to avoid you will have their sonar degraded by 40% looking up at you.
4. **Fire at close range.** With only 14 torpedoes, wait for SOLID solutions at < 2,000 wu. SST-4 torpedoes are slower than ADCAP — they need less distance to cover.
5. **Disengage after firing.** Go to 3 kt, silent running, change heading. The launch transient will alert enemies — be somewhere else when they come looking.
6. **Manage battery religiously.** Never let it drop below 20% unless you are sure you can snorkel safely within minutes.

# Advanced Tactics

## Fighting Wolfpacks

From Wave 2 onward, enemies operate in coordinated groups. A pinger locates you, hunters engage, and interceptors move to cut off escape routes.

### Counter-Wolfpack Doctrine

1. **Kill the pinger first.** The pinger's active sonar is what gives the group your position. Without it, the hunters must rely on their own passive sonar — which is degraded by their own speed noise.

2. **Engage from below the layer.** Your weapons cross the layer with wire guidance. Their sonar has 40% less range looking down at you.

3. **Use range.** Fire at maximum wire range (~3,000 wu). At this range, their return fire is inaccurate — their TMA has wide blur.

4. **Reposition after every shot.** The launch transient gives them a bearing. Change heading by 60+ degrees and open range before firing again.

5. **Monitor all contacts.** In a wolfpack engagement you will have 3-4 contacts on the display simultaneously. Prioritise: pinger > nearest hunter > interceptor.

## Multi-Target Engagement

With wire guidance, you can have multiple torpedoes in the water on different targets simultaneously. Each tube maintains its own wire.

### Staggered Salvo

1. Build SOLID TMA on the first target
2. Fire torpedo 1 at Target A
3. Immediately designate Target B (click on it)
4. Wait for DEGRADED or better on Target B
5. Fire torpedo 2 at Target B

Both torpedoes are wire-guided independently. Fire control steers each toward its own designated target.

### The Speed Problem

You must stay below 15 kt while wires are live. With two torpedoes in the water, this limits your evasion options. Plan your firing position so that you have:

- The thermal layer between you and the enemy
- Range advantage (fire from long range so return fire takes time to arrive)
- An escape route that doesn't require sprinting through your own wire field

## Convergence Zone Exploitation

CZ contacts appear at 4,800-5,500 wu — far beyond direct-path detection. You can use these for early warning and long-range engagement:

1. **Detect via CZ.** The sonar team picks up a contact in the convergence zone.
2. **Build TMA.** This is slow at CZ range — bearing change is minimal. Aggressive manoeuvring helps.
3. **Close to firing range.** CZ range is too far for reliable torpedo engagement. Close to 2,000-3,000 wu for a wire-guided shot.
4. **Alternatively, use missiles.** If the CZ contact is a surface ship, an ASCM can reach it from any range.

CZ detection only works when both platforms are below the thermal layer. If the enemy is above the layer, you won't get CZ contacts.

## Missile Employment

Anti-ship cruise missiles are effective against surface warships but useless against submarines (they fly above the water and scan for surface targets only).

### When to Use Missiles

- Surface ships (KRIVAK, UDALOY, GRISHA, SLAVA) are hard to kill with torpedoes because they are fast and deploy their own countermeasures
- Missiles fly at 370-450 kt — surface ships cannot evade
- Harpoon and Sub-Harpoon require ≤ 25m depth to launch — you must come shallow
- TASM fires from VLS at up to 30m — slightly more flexibility
- Exocet launches from 55m — safest option for the Type 209

### Missile Firing Procedure

1. Designate a surface contact (click on it)
2. Use the ASCM panel to select missile type
3. Check launch depth — you must be at or shallower than the missile's max launch depth
4. Fire. The missile ascends for 1.8 seconds, cruises to the target area, activates seeker
5. If the seeker finds a surface target within 8 seconds and 1,200 wu, it homes in
6. If no target found, the missile is lost

## Periscope Depth Operations

Coming to periscope depth (18m) gives you:

- **Periscope:** Visual detection boost (1.55x) at the cost of revealing your position (3,600 wu)
- **ESM:** Passive electronic detection at 12,000 wu — detects radar emissions without giving away your position
- **Radar:** Active surface search at 7,000 wu — powerful but detectable by enemy ESM
- **HPA recharge:** At ≤ 20m, air banks recharge automatically

### The PD Dilemma

Periscope depth is shallow and exposed. You are above the thermal layer, vulnerable to surface ship active sonar, and detectable by radar. Come to PD only when:

- The area is clear of nearby threats
- You need ESM to locate surface ships
- You need to recharge HPA after sustained deep operations
- You need a visual identification (periscope)

Use the compass PD button or set depth to 18m. The boat will come up from depth on its own.
