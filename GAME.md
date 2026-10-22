# LIFELINE

A real-time co-op zombie adventure for two players on two iPads.

In every chapter, one of you goes into danger and the other keeps you alive through a link: an air hose, a power cable, a chain, a radio, a bite, a voice from the past. Then you swap.

This file is the source of truth for the game. Claude and Codex both build from it. If the design changes, change this file in the same pull request.

---

## 1. The pitch

- **Genre:** co-op action adventure with survival and crafting.
- **Players:** exactly 2, real-time, each on their own iPad. iPhone works but is not the target.
- **Length:** one long story in 8 chapters (about 8 to 10 hours), then an open post-game.
- **Save:** one long save that you share.
- **View:** 2D side view. The art has depth, but you play on one flat plane.
- **References:**
  - **It Takes Two:** a new mechanic every chapter, and a story about the two of you.
  - **Dysmantle:** break almost anything for parts, craft at home, and rest to save (the dead come back when you rest).
  - **ROUTE:** your vehicle is your home, your storage and your only way out.
  - **Not Quite Dead:** loot on the roof rack, and toxic zones that need gear.

## 2. Design pillars

1. **Every chapter, a new lifeline.** The two players are always linked by something that one of them cannot survive without. The link is visible, physical and can fail.
2. **Both players are always busy.** The player who holds the link (the Anchor) has their own threats and tasks. No one waits more than 20 seconds.
3. **Swap often.** Each chapter makes you swap roles at least once. No one is "the support player" for long.
4. **Break, loot, build.** Everything that looks breakable is breakable. Parts go home to The Duck and become upgrades.
5. **One road, one save.** The story is one journey upriver. The world remembers what you did.
6. **Hard but fair.** The game is challenging, but you lose time when you fail, not hours. Respawn is fast, and a downed player can still help.
7. **Made for touch.** Big shapes, clear light, large buttons. You can play it on a sofa, side by side.

## 3. Story

### Setup

Port Calder is a river city. Wren and Cass ran Calder Duck Tours: one amphibious tour bus called **The Duck**, and a lot of bad jokes about ducks.

Forty days ago, the dead rose. Ten days later, someone at **Highwater Dam** upriver opened every floodgate to drown the horde. The dead do not drown. Now the low city is under water, and the dead walk the streets beneath it.

Wren and Cass live on The Duck. One night the radio picks up a kid called **Pip** at Highwater: "The dam still has power. There are people here. Please come." The way upriver goes through everything the flood did not reach.

### Theme

Trust. In every chapter, one of you holds the other's life in your hands. Wren always wants to go first. Cass always wants a plan. The game makes each of them do the other thing.

The players choose who plays Wren and who plays Cass. Both names can be changed. Default colours: Wren is orange `#FF9F43`, Cass is blue `#4AA3FF`. These colours stay readable for most colour-blind players.

### How the story is woven together

These threads run through all the chapters. Use them to tie every level to the whole story.

| Thread | What it is | Where it pays off |
|---|---|---|
| **Pip's radio** | Pip talks to you between levels and gives hints. | You meet Pip at Highwater (chapter 7). |
| **The Keeper's tapes** | One hidden tape per chapter from the engineer who opened the gates. They explain why he did it, and that Pip is his kid. | The last tape plays at the dam. |
| **Postcards** | Hidden Duck Tours postcards. Each one unlocks a short memory of Wren and Cass before the outbreak, at that place. | A full set unlocks the last memory in the epilogue. |
| **The bite** | At the end of chapter 4, the player who was the Runner gets bitten. | Chapter 5 is played with the bite. After the cure, that character keeps one "scar" ability for the rest of the game. |
| **Echo choices** | In chapter 6, the player in the past can warn people, hide supplies and open roads. | It changes who is alive at Highwater, which routes are open in chapter 7, and who lives in the Dry City. |
| **Places come back** | The Galleria (ch. 1) is seen in the past (ch. 6) and again drained (post-game). The Green Line tunnel (ch. 2) leads under the dam (ch. 7). | Players see their own marks, broken walls and dead bosses again. |
| **Duck upgrades** | Each chapter adds one upgrade to The Duck. | Later chapters need the earlier upgrades, for example rail wheels in chapter 7. |

## 4. Roles

Each chapter has two roles:

- **Out:** goes into danger. Explores, loots and fights, but depends on the link.
- **Anchor:** keeps the link alive with a device (a pump, a generator, a map desk). Also has their own threats: boarders, line crawlers, a door that will not hold.

Rules:

- At a **swap bell** (some checkpoints have one), both players ring it to swap roles.
- Some sections force a swap. Each chapter has at least one.
- In chapter 3 both players are Out, chained together. In chapter 6 each player is in a different time.

## 5. Chapters

Each chapter has 3 to 5 levels, a boss, a mini-game and one side area for scavenging. A chapter takes 45 to 90 minutes.

| # | Chapter | Place | The lifeline | Out | Anchor | Boss | Mini-game | Duck upgrade |
|---|---|---|---|---|---|---|---|---|
| 0 | **Day 40** | Calder harbour | Air hose (basic) | Diver: free The Duck's propeller | Pumper on The Duck: pump air, push off boarders | A horde wave climbs aboard | none | none |
| 1 | **Under the Galleria** | Sunken shopping mall | Air hose (full) | Diver in the flooded atrium and shops | Pumper, winch and spotlight on The Duck, parked inside through the glass roof | **Big Splash**, a giant bloated zombie that sucks in water and pulls the hose | Claw machine | Crane |
| 2 | **Green Line** | Metro tunnels in toxic green fog | Power cable | Lamp carrier: the light holds the dead back and clears the fog | Handcar engineer: pumps the handcar to make power, drives it, switches tracks | **The Last Train**, a train full of the dead | Handcar race | Rail wheels |
| 3 | **Quarantine Fair** | Army quarantine camp in a fairground | A chain: soldiers cuffed you together | Both. One braces, one swings, and you swap all the time | (shared) | **The Ringmaster**, a turned officer whose megaphone calls the horde | Ring toss | Grapple hook |
| 4 | **St. Agnes** | Hospital and radio mast | Radio and cameras | Runner in the dark wards with a torch | Operator in the security room: map, cameras, doors, lights, a power budget | **Night Shift**, a siege on the security room. The Runner must get back in time | Steady hand (surgery) | Radio and map table |
| 5 | **Fever** | Burned suburbs | The bite | The Turned: the horde ignores you, you smell loot through walls, you can lead the herd | The Human: medicine, The Duck, crafting, weapons | **Your partner**, if the infection reaches 100% | Arm wrestle a zombie | Med bay |
| 6 | **Echo Station** | Radio station at the river bend | A radio that reaches 33 days into the past | Then: the day before the gates opened | Now: today | **The Release**, the flood wave, in both times at once | Radio quiz | Then's hidden supplies appear in the stash |
| 7 | **Highwater** | The dam | All of them | Diver in the dam intake to close the valves | Climber on the dam face and defender of the control room | **The Tide**, the dead pouring over the dam crest | Spillway race | none |
| + | **Dry City** (post-game) | Port Calder, drained | none | Free roam: scavenge, build, survive nights | | Night sieges | All mini-games, replayable | Everything |

### Chapter notes

**0. Day 40 (tutorial, 20 minutes).** It teaches movement, breaking things, looting, the pump, the hose and line signals. It ends with Pip's first radio call.

**1. Under the Galleria.** It is the full air-hose chapter.
- Level ideas: the food court (easy, lots of loot), the escalator well (deep dive, hose snags), the toy store (crawlers in the shelves), the power room (Two-Key Door: the Anchor holds a breaker while the Diver turns a valve), the atrium boss.
- Twist: halfway through, the Diver finds a second helmet. The Anchor dives too, with a short hose, while The Duck's auto-pump runs. You have 90 seconds before it fails.

**2. Green Line.**
- Level ideas: the dark platform, the fog junction (the lamp clears fog only inside its cone), the flooded tunnel (the cable must stay out of the water), the handcar chase (pump in rhythm while the dead run behind you), the track-switch boss.
- Twist: the lamp burns out, so the Out player navigates by the Anchor's sound cues.

**3. Quarantine Fair.**
- Level ideas: the army checkpoint (sneak while chained), the Ferris wheel (climb it, one brace and one swing), the rollercoaster (ride a cart while you knock the dead off the track), the hall of mirrors, the big top boss.
- Twist: the chain catches on the Ferris wheel and lifts one player into the air. The other must climb.

**4. St. Agnes.**
- The Operator's iPad shows a top-down map of the floor. The Operator spends a power budget of 10 units on lights, doors and cameras. Tapping the map puts a marker on the Runner's screen.
- Level ideas: the dark ward, the morgue (Lurkers that are visible only on camera), the pharmacy, the radio mast climb.
- Twist: the power fails. The Operator has to leave the room to restart the generator, and the Runner guides them with what they see.

**5. Fever.**
- Infection meter (first pass):

  | Infection | What the Turned gets |
  |---|---|
  | 20% | Shamblers ignore you. |
  | 40% | You see scent: loot through walls, living people as heartbeats. |
  | 60% | "Call the herd": up to 8 zombies follow you. |
  | 80% | Controls drift and the screen bleeds. |
  | 100% | You turn. The Human fights you and must inject you. The Turned player fights the pull by tapping. |

- Soldiers shoot the Turned on sight. The dead attack the Human. Each street is a puzzle for two.
- At camp, a transfusion moves the bite to the other player (their infection starts at 30%).
- Scar ability, after the cure: "Still". Hold your breath and the dead do not see you for 3 seconds.

**6. Echo Station.**
- Both players play the same map in two times. Each iPad shows one time.
- Each action by Then writes a change that Now sees at once:
  - Plant a seed, and Now has a tree.
  - Hide a crate, and Now finds it.
  - Break a wall, and Now gets a hole, but so do the dead.
  - Warn a neighbour, and Now has a survivor instead of a zombie.
- Then's day runs from 06:00 to 18:00 in about 20 minutes. At 18:00 the gates open and the flood comes.
- The choices made here are saved as story flags (section 13) and used in chapter 7 and the Dry City.

**7. Highwater.**
- Start with a drive: The Duck uses its rail wheels on the old line up to the dam. One player drives, the other shoots from the roof.
- Then the dam: one dives into the intake (air hose), the other climbs the dam face (rope) and holds the control room. Swap for the last valve.
- The final choice: who goes into the intake for the last valve. Both players choose. If they choose different people, that person goes. If they both choose "me", they play a quick round of rock, paper, scissors on the iPads.

**Dry City (post-game).** The gates close and the city drains. Port Calder becomes a free-roam world: the Galleria, the fair and the tunnels, now on dry ground. You scavenge, build The Duck's yard, survive night sieges and replay mini-games. This is the long-save game after the story.

### Level design rules

- **Introduce, test, twist, master.** Show each new mechanic safely, then under pressure, then with a twist, then in the boss.
- No player is idle for more than 20 seconds.
- There is a checkpoint every 2 to 4 minutes.
- Every section has things to break and loot.
- Each chapter has one big "wow" set piece and one silly mini-game.
- The link is always visible and always easy to read.

## 6. Core systems

### 6.1 World and camera

- Units are metres. Gravity is 20 m/s².
- You play on one plane (x, y). Art layers sit in front of and behind it.
- Each iPad's camera follows its own player and looks a little ahead.
- When the players are within 12 m of each other, both cameras frame both players.
- When the partner is off screen, an arrow at the screen edge shows the direction, the distance and the link state.

### 6.2 Characters

First-pass tuning values:

| Value | Number |
|---|---|
| Health | 100 HP |
| Walk speed | 4.5 m/s |
| Under water (heavy boots) | 1.6 m/s, no jump |
| Jump height | 1.3 m |
| Climb speed (ladders, ropes) | 2 m/s |
| Pocket slots | 6 per player, 20 per stack |

Other rules:
- **Ledge grab:** yes.
- **Heavy items:** you carry them in both hands and move at 60% speed. Very heavy items need both players.

### 6.3 Actions

- **Jump**
- **Attack:** melee, a 3-hit combo. Hold for a heavy hit.
- **Use:** the tool for this chapter.
- **Interact:** a contextual button that appears near things.
- **Signal:** sends 1 to 4 pulls on the link.
- **Throw:** hold Interact while you carry something.
- **Break free:** when a zombie grabs you, tap fast. Your partner can also hit the zombie off you.

### 6.4 Damage, downed and respawn

- A zombie grab does 10 HP per second.
- At 0 HP you are **downed** and become a **ghost** for 30 seconds. A ghost can:
  - move through walls,
  - push light objects,
  - knock on things to lure the dead.
- Your partner revives you by holding Interact on your body for 2 seconds.
- If the ghost timer ends, or both of you are down, you both respawn at the last checkpoint within 3 seconds.
- In Survivor mode, you lose the loot you carried since that checkpoint.

### 6.5 The link system

The link system is the heart of the game. One generic system covers every chapter.

A link has:
- **Type:** hose, cable, chain, radio, blood or time.
- **Two ends:** a player, a device or the other player.
- **Body:** a simulated rope of segments that wraps around corners. Radio, blood and time links have no body.
- **Maximum length:** a hard stop. The game warns you when the link is tight.
- **Flow:** a resource that moves from the Anchor's device to the Out player, such as air or power.
- **Faults:**
  - Snag: the link catches on a corner and less flows through it.
  - Cut: a Brute or a sharp edge can cut it.
  - Pinch: a door or a crushing object closes on it.
  - Overload: too much flows through it.
- **Signals:** 1 to 4 pulls. The meaning can change per chapter. The default is the real diving line code:

  | Pulls | Meaning |
  |---|---|
  | 1 | OK |
  | 2 | Give slack |
  | 3 | Take up slack |
  | 4 | Pull me up |

- **Looks:** the link is always drawn bright. Pulses move along it to show the flow.

The dead sense links. A **Line Crawler** follows a hose or cable to the Anchor.

### 6.6 Air hose

Used in chapters 0, 1 and 7. First-pass values:

| Value | Number |
|---|---|
| Pressure range | 0 to 100 |
| Safe band | 35 to 75 |
| Use per second | 1.0, plus 0.12 for each metre of depth |
| One pump stroke (a full swipe up and down) | +5 |
| Below 35 | Warning: the screen edges darken and you hear breathing |
| Below 15 | 10 HP damage per second |
| Above 85 | **Blow-up:** the diver floats up out of control for 2 seconds (a real danger of old diving suits) |
| Each snag | −30% flow; at 3 snags, no air flows |
| Hose length | 30 m; upgrades give 40 m and 55 m |
| Winch | Reels in or pays out at 3 m/s. Reeling in pulls snags free |

### 6.7 Other lifelines

- **Power cable (chapter 2):**
  - The handcar has a generator with 0 to 100 charge. The Anchor charges it and moves the handcar by pumping in rhythm (left and right pads, one after the other).
  - The lamp drains 4 charge per second.
  - The lamp cone stuns the dead after 1 second and clears the toxic fog inside it.
  - The cable is 25 m long. A Brute can cut it. The Anchor repairs it at junction boxes.
- **Chain (chapter 3):**
  - The chain is 6 m long.
  - Brace: hold to anchor yourself to the ground or to a post.
  - A tight chain that moves fast knocks down the dead (a clothesline).
  - You can swing on it. Some doors let only one person through at a time.
- **Radio (chapter 4):** there is no body. See chapter 4 for the Operator's map, power budget and markers. You talk out loud, and the markers help.
- **Blood (chapter 5):**
  - Infection starts at 0 and rises 1 per second.
  - Each bite adds 5. Medicine removes 25.
  - A transfusion swaps the bite to the other player.
  - The stages are in chapter 5.
- **Time (chapter 6):**
  - The game keeps a change log that both times read and write.
  - "Mark" puts a glowing ring on the same spot in the other time.

### 6.8 The dead

The dead sense noise (each action makes a sound with a radius), light (some lights attract them, the lamp stuns them) and links (Line Crawlers). AI is a simple state machine:

> idle → investigate a sound → chase → grab

Zombies keep apart from each other with simple spacing.

| Type | HP | Speed (land / under water) | Notes |
|---|---|---|---|
| Shambler | 40 | 1.2 / 0.6 m/s | The basic zombie. Grabs. |
| Crawler | 25 | 1.6 m/s | Low. Comes out of vents and floors. |
| Bloater | 160 | 0.8 m/s | Huge. Pulls hoses. Bursts into gas when killed above water. |
| Screamer | 30 | 1.2 m/s | Its scream calls every zombie within 30 m. |
| Line Crawler | 40 | 1.4 m/s | Climbs along links toward the Anchor. |
| Lurker | 50 | 1.8 m/s | Invisible in the dark. Shows only in light or on camera. |
| Brute | 250 | 1.0 m/s | Armour plates. Needs a heavy tool or a trap. Can cut links. |
| Soldier (living) | 80 | 3.5 m/s | Chapters 4 and 5. Shoots the Turned. Leaves the Human alone unless attacked. |

### 6.9 Loot and crafting

**Materials:** scrap, wire, cloth, rubber, glass, chemicals, parts, batteries, food and medicine.

**Breakables:** crates, lockers, cars, vending machines, furniture and fences. Each type has a loot table.

**Tool tiers.** Each tool opens a new kind of breakable. A small icon on each breakable shows which tool it needs.

| Tier | Tool | Found in | Breaks |
|---|---|---|---|
| T0 | Wrench | Start | Small items, crates |
| T1 | Crowbar | Chapter 0 | Lockers, doors |
| T2 | Bolt cutter | Chapter 1 | Chains, fences |
| T3 | Cutting torch | Chapter 2 | Cars, safes, metal doors |
| T4 | Jackhammer | Chapter 4 | Concrete |

**Crafting** happens at The Duck's workbench. Recipes are data in `packages/content`. First-pass examples:

| Item | Recipe |
|---|---|
| Medicine | 2 cloth, 1 chemicals |
| Flare | 1 chemicals, 1 parts |
| Noise maker | 2 parts, 1 battery |
| Helmet Mk II (more air, brighter lamp) | 6 scrap, 2 glass, 2 rubber |
| Hose +10 m | 6 rubber, 2 wire |
| Duck armour plate | 10 scrap, 2 parts |

**Storage:**
- **Pockets:** each player has 6 slots.
- **Stash:** 60 slots, shared, on The Duck.
- **Roof rack:** 4 large items. Hard driving can throw them off, so one player can hold them down while the other drives.

### 6.10 The Duck (home base)

The Duck is the hub between levels and the base for the long save. Its stations:

| Station | What it does |
|---|---|
| Wheel | Drive The Duck. |
| Pump and winch | The Anchor's tools in the air-hose chapters. |
| Workbench | Craft items and upgrades. |
| Stash | Shared storage. |
| Map table | Choose the next level or side area, and see the route. |
| Radio | Pip, hints and tapes. |
| Bunks | Rest to save and heal. When you rest, the dead come back in the side areas, as in Dysmantle. |
| Roof | The turret, the roof rack and repairs. |

**Drive segments:** between chapters, one player drives and the other works the roof.

**Parked:** when both players leave The Duck, the dead can board it. A bell rings. The Duck takes small damage, but the stash is always safe.

**Upgrades:**
- From the story: crane, rail wheels, grapple hook, radio and map table, med bay.
- Crafted: armour, turret, hull lights, bigger stash, auto-pump, a second helmet.

### 6.11 Mini-games

Each chapter hides one short competitive mini-game. The Duck has a scoreboard that shows who is ahead. Mini-games are 30 to 90 seconds long and use the same controls as the game.

### 6.12 Collectibles

| Collectible | Where | What it unlocks |
|---|---|---|
| Postcards (memories) | 3 per chapter | A short memory of Wren and Cass at that place |
| Keeper tapes | 1 per chapter | The Keeper's story |
| Duck stickers | Hidden in levels | Cosmetic stickers for The Duck |

### 6.13 Difficulty

| Mode | What changes |
|---|---|
| **Story** | Wider safe bands and slower meters. You keep your loot when you respawn. |
| **Survivor** (default) | The values in this file. You lose the loot you carried since the last checkpoint. |
| **Hardcore** | Added later. |

## 7. Controls and screen

- **Orientation:** landscape only.
- **Left thumb:** a floating stick that appears where you touch.
- **Right thumb:**
  - Jump (the largest button)
  - Attack
  - Use
  - Interact, which appears only near things
  - Signal, small, at the top of the cluster
- **Anchor devices** have their own on-screen controls:
  - the pump lever (a swipe zone),
  - the winch (a slider),
  - the handcar pads (left and right),
  - the Operator's map (tap and drag).
- **Game controllers** work through the browser Gamepad API. Bluetooth controllers work on iPad.
- **Keyboard** is for development.
- **HUD:**
  - your health,
  - the link meter (air, power, infection and so on),
  - a partner pill with name, health and link state,
  - a small objective line.
  - Nothing else on screen.
- **Text:** at least 16 px. All radio and tape lines have subtitles.
- **Colour rules:**

  | Colour | Means |
  |---|---|
  | Red or orange eyes | Danger |
  | Warm glow | Loot |
  | Bright line | The link |
  | Orange or blue outline | Your partner |

## 8. Look and sound

- **Art direction: Ink Wobble** (chosen). A hand-drawn storybook with a dark streak:
  - thick dark outlines that "boil" (redraw with small random wobble 8 times a second),
  - big heads, lanky zombies with button eyes and stitched mouths, crooked buildings,
  - muted sepia and green colours, a paper grain over everything,
  - cross-hatching for darkness: the deeper or darker a place, the denser the lines; light (lamps, beams) cuts the hatching away,
  - characters move at 12 frames a second for a hand-animated feel; the camera and physics stay smooth.
  - Palette: storm sky `#CFC09A`, shallow water `#78A39C`, deep `#263C3E`, brass `#D8A048`, zombie `#8FA58A`, ink line `#1D1712`.
  - Shapes are built in code as vector polygons, so we need very little drawn art. See the look book sketch "Ink Wobble".
- **Placeholder art first:** capsules, boxes and flat colours. All gameplay must read without final art.
- **Sound on iOS:** sound starts only after the first tap. Make "Tap to start" the title screen.
- **Key sounds:** pump strokes, breathing when air is low, the hose creaking when it snags, zombie groans with direction, radio static.

## 9. Save

- There is one save per pair: **the Duck save**. It is stored on the server.
- The game autosaves at checkpoints, when you rest and at the end of each chapter.
- The save is versioned JSON (`saveVersion`). It stores game data only, never physics or engine data, so game updates do not break old saves.
- Contents:
  - chapter and checkpoint id,
  - pockets, stash and roof rack,
  - Duck upgrades,
  - known recipes and tools,
  - collectibles,
  - story flags (see below),
  - statistics and mini-game scores,
  - per-player settings (name, colour, controls).
- Story flags:
  - `biteHolder`: `wren` or `cass`
  - `scarAbility`
  - `echo.warned[]`
  - `echo.stashed[]`
  - `echo.roadsOpened[]`
  - `finalChoice`

## 10. Multiplayer

- **Host:** the iPad that creates the room. Any iPad can host.
- **Joining:** the other iPad joins with a 4-letter room code.
- **Server:** a Cloudflare Worker with one Durable Object per room. It passes messages between the iPads over WebSocket and stores the Duck save. Same room or apart works the same way.
- **Simulation:** only the host runs it, at a fixed 30 steps per second.
- **Guest to host:** input frames (stick and buttons), 30 per second.
- **Host to guest:**
  - snapshots 20 times a second, in binary, with quantized values and deltas against the last snapshot the guest confirmed,
  - one-time events (sounds, hits, story beats) as reliable messages.
- **Guest view:**
  - the guest's own character moves at once (prediction) and corrects to the host's state,
  - everything else is shown 100 ms in the past, to look smooth.
- **Disconnects:**
  - If the guest drops, they can rejoin within 60 seconds.
  - If the host drops, the game pauses. Either iPad can host again from the last checkpoint.
- **Development mode:** one browser can run both players (keyboard plus a gamepad), with no server.

## 11. Tech stack (proposed, confirm before scaffolding)

- **TypeScript + Vite.**
- **Three.js** for rendering. Ink Wobble is drawn as flat vector shapes with an outline and wobble effect, so WebGPU is a bonus, not a need. Use its WebGPU renderer, which falls back to WebGL2 when WebGPU is missing. Write effects in TSL so they run on both. Do not write raw WebGPU.
- **Rapier 2D (WebAssembly)** for physics, on the host only. Links are rope chains built from physics joints, or a custom rope if joints are not stable enough.
- **Cloudflare Workers + Durable Objects** for rooms, relay and saves. Account: prateek.ranka@gmail.com. Deploys use an API token stored as the environment variable `CLOUDFLARE_API_TOKEN` (never in the repo).
- **PWA:** add to the Home Screen for full screen.
- **Tests:** Vitest for unit tests. Playwright for end-to-end tests, with two browser contexts at iPad size (1180 × 820) that play a scripted session.
- **Versions:** pin exact library versions when you scaffold the repo.

## 12. Repository layout

```
GAME.md               this file, the source of truth
apps/client/          Vite + TypeScript + Three.js. Rendering, input, UI, audio, net client
apps/server/          Cloudflare Worker + Durable Object. Rooms, relay, saves
packages/sim/         Pure TypeScript game simulation. No DOM, no Three.js. Runs on the host
packages/protocol/    Message types, input frames, snapshot encode and decode
packages/content/     Data only: chapters, levels, items, recipes, zombies, loot tables
tests/e2e/            Playwright: two iPad-sized clients play a scripted session
```

Rules:
- `packages/sim` never imports from `apps/*`.
- The client only draws the sim state and sends inputs. Game rules live in `sim`.
- Content is data (JSON plus TypeScript types). There is no game logic in content.

### Level data (first pass)

A level is a JSON file in `packages/content/levels/`:

```json
{
  "id": "ch1-food-court",
  "chapter": 1,
  "name": "Food Court",
  "size": [120, 40],
  "water": { "level": 22 },
  "geometry": [{ "type": "poly", "points": [[0, 0], [120, 0], [120, 2], [0, 2]], "material": "concrete" }],
  "spawns": { "out": [10, 24], "anchor": [14, 30] },
  "checkpoints": [{ "id": "cp1", "pos": [40, 6], "swapBell": false }],
  "breakables": [{ "type": "vending", "pos": [30, 4], "tier": 1, "loot": "vending" }],
  "zombies": [{ "type": "shambler", "pos": [55, 4], "state": "idle" }],
  "links": [{ "type": "hose", "from": "duck.pump", "to": "out", "length": 30 }],
  "triggers": [{ "id": "radio-pip-1", "area": [[60, 0], [70, 20]], "event": "radio:pip_food_court" }],
  "collectibles": [{ "type": "postcard", "id": "pc-galleria-1", "pos": [88, 12] }]
}
```

## 13. Who builds what

| Area | Claude | Codex |
|---|---|---|
| Simulation | Entities, physics wrapper, link system, zombie AI, damage, checkpoints (`packages/sim`) | Mini-game rules on top of the sim API |
| Network and save | `packages/protocol`, the net client, `apps/server`, the save system | none |
| Client | The client loop, prediction and interpolation | Rendering, art and effects, camera, touch controls, HUD, audio |
| Content | Content types and loading | Levels, items, recipes, loot tables, zombie data, story text |
| Tests | Unit tests for sim and protocol, the two-client e2e test | Tests for content validity and UI |

Working rules:
- Small pull requests. Each one names the GAME.md section it builds.
- `main` must always build and pass tests.
- If a change needs a new design decision, update GAME.md in the same pull request and say so in the description.
- The sim API and the state types are the contract between the two of you. Change them only with a note in the pull request.

## 14. Milestones

**M0: Two dots.** Done when:
- the repo is set up and a deploy URL works,
- two iPads join one room by code,
- each player moves a capsule in a test room in real time,
- the host owns the state,
- movement in the same room feels instant,
- the URL works from the Home Screen.

**M1: The hose (night-one target).** This is the "Day 40" harbour slice. Done when:
- The Duck floats on the water,
- the Anchor pumps air with a swipe,
- the Out player dives on a 30 m hose with rope physics, snags, the safe band and blow-up,
- line signals work,
- Shamblers walk on land and under water, and some board The Duck,
- breakables drop scrap,
- freeing the propeller ends the level,
- checkpoints work,
- the server save resumes the game on two real iPads.

**M2: Under the Galleria.** Chapter 1 in full: the winch and crane, the second-helmet twist, the Big Splash boss, the claw machine, postcards and the tape.

**M3: Home.** The Duck hub: workbench, stash, crafting, rest to save, map table and a drive segment.

**M4 to M9.** Chapters 2 to 7, one milestone each.

**M10.** The Dry City post-game.

**M11.** Polish, the final art pass, sound and performance on older iPads.

## 15. Open questions

- Do we keep the names Wren, Cass, Pip and The Duck?
- Confirm the tech stack in section 11.
- Is voice acting needed later? Text only for now.
