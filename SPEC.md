# Zombie Lane Defense — Engineering Blueprint

## Context

Building a self-contained browser game from scratch. The repository starts completely empty (only PROMPT.md and game.md exist — no HTML, CSS, or JS). Everything including all visuals must be generated programmatically; there are zero external assets. The game must deploy as a static folder on GitHub Pages with no build step.

---

## 1. Architecture

### Files to create

| File | Responsibility |
|------|---------------|
| `index.html` | Shell: canvas element, HUD panel, all overlay divs (title, wave-wait, question, victory, defeat). No inline JS. |
| `style.css` | Layout rules, overlay visibility toggling via `.hidden` class, button states, lane visual styling, HUD panel. |
| `script.js` | 100% of game logic: CONFIG block, state machine, game loop, entity systems, rendering, input, UI wiring. |
| `README.md` | Deploy instructions, how to edit questions/waves/upgrades. |

No framework. No build step. No external fonts, images, sounds, or CDN imports. All paths relative. `script.js` loaded with `<script src="script.js"></script>` at bottom of `<body>`.

---

## 2. Game State Model

### States (string constants)

```
STATE_TITLE        — title screen visible, canvas idle
STATE_WAVE_WAIT    — between waves; HUD visible; "Start Wave N" button visible
STATE_PLAYING      — active wave; game loop runs update(); auto-fire active
STATE_QUESTION     — gun-unlock question overlay shown; loop still renders but skips update
STATE_VICTORY      — wave 10 cleared; victory overlay shown
STATE_DEFEAT       — zombie touched player; defeat overlay shown
```

### Core variables

```javascript
// State
let gameState = STATE_TITLE

// Player
let playerLane = 1          // 0=left, 1=center, 2=right

// Economy
let coins = 0

// Gun progression
let currentGun = 0          // 0, 1, or 2 (index into GUNS config)
let fireUpgradeTier = 0     // 0=base, 1/2/3=upgraded (max 3 per gun)

// Wave
let currentWave = 1         // 1–10

// Entity arrays (cleared each wave start)
let zombies = []
let bullets = []

// Spawn system
let spawnQueue = []         // [{type, lane, spawnAt}] sorted by spawnAt ms
let waveStartTime = 0       // performance.now() timestamp when wave began
let allSpawned = false      // true when spawnQueue is exhausted

// Fire timer
let lastFireTime = 0        // timestamp of last bullet fired

// Animation
let lastTimestamp = 0       // for delta-time calculation
let animFrameId = null      // requestAnimationFrame handle

// Gun unlock flow
let pendingGunIndex = -1    // set when question overlay is triggered
```

### State transitions

```
TITLE       — click Play            → WAVE_WAIT (currentWave=1)
WAVE_WAIT   — click "Start Wave N"  → PLAYING
PLAYING     — all zombies dead      → WAVE_WAIT (if wave<10) or VICTORY (if wave=10)
PLAYING     — zombie reaches player → DEFEAT
WAVE_WAIT   — click "Unlock Gun"    → QUESTION (saves pendingGunIndex)
QUESTION    — correct answer        → WAVE_WAIT (gun unlocked, tier reset)
QUESTION    — wrong answer          → stays QUESTION (shows error message)
DEFEAT      — click "Try Again"     → full reset → WAVE_WAIT
VICTORY     — terminal; only page refresh resets
```

---

## 3. Rendering System — All Sprites Generated via Canvas 2D API

**There are no image files, sprite sheets, SVGs, or fonts beyond the browser default. Every visual element is drawn with `ctx.fillRect`, `ctx.strokeRect`, `ctx.arc`, and `ctx.fillText`.**

### Canvas dimensions

- Canvas: **600 × 550 px**
- Three lanes of equal width: **200 px each**
- Lane 0: x 0–199 | Lane 1: x 200–399 | Lane 2: x 400–599
- Player Y (top of sprite): **480 px**
- Zombie spawn Y (off-screen top): **-60 px**
- Defeat trigger: zombie bottom edge `>= 480` while sharing player lane

### Lane center helper

```javascript
function laneCenter(lane) { return lane * 200 + 100; }
```

### Background and lane rendering (drawn every frame before entities)

```javascript
// Step 1: Fill canvas background
ctx.fillStyle = '#1a1a1a';
ctx.fillRect(0, 0, 600, 550);

// Step 2: Alternate lane tints
for (let i = 0; i < 3; i++) {
  ctx.fillStyle = i % 2 === 0 ? '#202020' : '#181818';
  ctx.fillRect(i * 200, 0, 200, 550);
}

// Step 3: Lane dividers (dashed vertical lines)
ctx.setLineDash([8, 6]);
ctx.strokeStyle = '#444';
ctx.lineWidth = 2;
for (let x of [200, 400]) {
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 550); ctx.stroke();
}
ctx.setLineDash([]);

// Step 4: Bottom "pavement" edge line
ctx.strokeStyle = '#555';
ctx.lineWidth = 2;
ctx.beginPath(); ctx.moveTo(0, 520); ctx.lineTo(600, 520); ctx.stroke();
```

### Player sprite

Shape: blue rectangle body + white gun barrel protruding upward. Drawn at `laneCenter(playerLane)`.

```javascript
function drawPlayer(ctx) {
  const cx = laneCenter(playerLane);
  // Body
  ctx.fillStyle = '#00aaff';
  ctx.fillRect(cx - 15, 480, 30, 40);
  // Gun barrel (white rectangle on top-center)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx - 3, 466, 6, 16);
  // Eyes
  ctx.fillStyle = '#002244';
  ctx.fillRect(cx - 8, 485, 5, 5);
  ctx.fillRect(cx + 3, 485, 5, 5);
}
```

### Zombie sprites — three visually distinct types (no images)

Each type has a unique size, body color, and eye color so they are immediately distinguishable at a glance.

| Type | Width | Height | Body Color | Eye Color | HP | Coins |
|------|-------|--------|------------|-----------|-----|-------|
| grunt | 28 | 36 | `#55aa55` (green) | `#ffffff` | 3 | 1 |
| mauler | 38 | 48 | `#cc7700` (orange) | `#ffff00` | 10 | 10 |
| tank | 52 | 60 | `#aa2222` (dark red) | `#ffaaaa` | 100 | 50 |

These dimensions live in `ZOMBIE_TYPES` config (see Section 5).

```javascript
function drawZombie(ctx, z) {
  const cx = laneCenter(z.lane);
  const hw = z.width / 2;

  // Body rectangle
  ctx.fillStyle = z.bodyColor;
  ctx.fillRect(cx - hw, z.y, z.width, z.height);

  // Outline for visual clarity
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - hw, z.y, z.width, z.height);

  // Eyes: two squares near top of body
  const eyeSize = Math.max(4, z.width / 7);
  ctx.fillStyle = z.eyeColor;
  ctx.fillRect(cx - hw + 4, z.y + 7, eyeSize, eyeSize);
  ctx.fillRect(cx + hw - 4 - eyeSize, z.y + 7, eyeSize, eyeSize);

  // Mouth: short horizontal line
  ctx.fillStyle = '#000';
  ctx.fillRect(cx - 4, z.y + z.height - 10, 8, 2);

  // Health bar (above sprite)
  const barW = z.width;
  const ratio = z.hp / z.maxHp;
  ctx.fillStyle = '#333';
  ctx.fillRect(cx - hw, z.y - 6, barW, 4);
  ctx.fillStyle = ratio > 0.5 ? '#00cc44' : ratio > 0.25 ? '#eeaa00' : '#cc2222';
  ctx.fillRect(cx - hw, z.y - 6, barW * ratio, 4);
}
```

### Bullet sprite

```javascript
function drawBullet(ctx, b) {
  ctx.fillStyle = '#ffff44';
  ctx.fillRect(laneCenter(b.lane) - 2, b.y, 4, 10);
}
```

### Render order per frame

1. Background + lanes
2. All zombies (back-to-front by y)
3. All bullets
4. Player
5. (Overlays are HTML elements layered above canvas via CSS z-index)

---

## 4. Game Loop

```javascript
function gameLoop(timestamp) {
  const dt = Math.min(timestamp - lastTimestamp, 50); // cap 50ms to prevent spiral
  lastTimestamp = timestamp;

  if (gameState === STATE_PLAYING) {
    update(dt, timestamp);
  }
  render();
  animFrameId = requestAnimationFrame(gameLoop);
}
```

`requestAnimationFrame` starts once on page load and runs forever. State gate inside `update()` ensures logic only runs during `STATE_PLAYING`.

### `update(dt, timestamp)` — execution order

1. **Spawn check**: iterate spawnQueue; push zombies whose `spawnAt <= elapsed`
2. **Move zombies**: `z.y += ZOMBIE_SPEED * (dt / 1000)` for each living zombie
3. **Auto-fire**: if `timestamp - lastFireTime >= fireInterval()` → push new bullet at `playerLane`; update `lastFireTime`
4. **Move bullets**: `b.y -= BULLET_SPEED * (dt / 1000)` for each bullet
5. **Bullet-zombie collision**: O(n*m) check; on hit: `z.hp--; b.dead = true`; if `z.hp <= 0`: `z.dead = true; coins += z.coinReward; updateHUD()`
6. **Player-zombie collision**: for each zombie: if `z.y + z.height >= PLAYER_Y && z.lane === playerLane` → `enterDefeat()`
7. **Cleanup**: filter out `dead` bullets and zombies
8. **Wave complete**: if `allSpawned && zombies.length === 0` → `endWave()`

### Collision detection

Lane equality replaces x-axis AABB check. Bullet and zombie in same lane are guaranteed x-aligned. Only y-overlap must be checked:

```javascript
bullet.lane === z.lane &&
bullet.y <= z.y + z.height &&
bullet.y + 10 >= z.y &&
!z.dead && !bullet.dead
```

On hit, mark `bullet.dead = true` immediately (one bullet, one zombie, one hit per collision pass).

---

## 5. Entity Systems

### ZOMBIE_TYPES config

```javascript
const ZOMBIE_TYPES = {
  grunt:  { hp: 3,   coinReward: 1,  width: 28, height: 36, bodyColor: '#55aa55', eyeColor: '#ffffff' },
  mauler: { hp: 10,  coinReward: 10, width: 38, height: 48, bodyColor: '#cc7700', eyeColor: '#ffff00' },
  tank:   { hp: 100, coinReward: 50, width: 52, height: 60, bodyColor: '#aa2222', eyeColor: '#ffaaaa' },
};
```

### Zombie object structure

```javascript
{
  id: autoIncrementId++,
  type: 'grunt' | 'mauler' | 'tank',
  hp: number,
  maxHp: number,        // for health bar ratio, never changes after spawn
  lane: 0 | 1 | 2,
  y: number,            // top edge, starts at -60
  coinReward: number,
  dead: false,
  width: number,
  height: number,
  bodyColor: string,
  eyeColor: string,
}
```

### Bullet object structure

```javascript
{
  lane: 0 | 1 | 2,
  y: number,   // top edge
  dead: false,
}
```

### Spawn system

`buildSpawnQueue(waveIndex)`:
1. Pull `WAVE_CONFIGS[waveIndex]`: `{ grunts: N, maulers: N, tanks: N }`
2. Build flat array of type strings: `['grunt','grunt',...,'mauler',...,'tank',...]`
3. Fisher-Yates shuffle the array
4. For each entry at index `i`: assign `lane = Math.floor(Math.random() * 3)`, `spawnAt = i * SPAWN_INTERVAL`
5. Return sorted array (already sorted by construction)

In `update()`:
```javascript
const elapsed = performance.now() - waveStartTime;
while (spawnQueue.length > 0 && spawnQueue[0].spawnAt <= elapsed) {
  const e = spawnQueue.shift();
  spawnZombie(e.type, e.lane);
}
if (spawnQueue.length === 0) allSpawned = true;
```

### Movement

All zombies move at `ZOMBIE_SPEED` pixels/second (constant, same for all types per spec).

---

## 6. Upgrade System

### CONFIG block (top of script.js — easy to edit)

```javascript
const GUNS = [
  { name: 'Pistol',  baseInterval: 700,  upgradeIntervals: [500, 350, 200] },
  { name: 'SMG',     baseInterval: 180,  upgradeIntervals: [140, 100,  70] },
  { name: 'Railgun', baseInterval: 60,   upgradeIntervals: [ 45,  32,  20] },
];
// upgradeIntervals[0] = tier 1, [1] = tier 2, [2] = tier 3 (milliseconds between shots)

const FIRE_UPGRADE_COSTS = [50, 120, 250];  // cost for tier 1, 2, 3
const GUN_UNLOCK_COSTS   = [0, 300, 700];   // index = gun index; 0 = free (Gun 1)
```

### Fire rate calculation

```javascript
function fireInterval() {
  if (fireUpgradeTier === 0) return GUNS[currentGun].baseInterval;
  return GUNS[currentGun].upgradeIntervals[fireUpgradeTier - 1];
}
```

### Upgrade caps and button logic

```javascript
function canBuyFireRate() {
  return fireUpgradeTier < 3 && coins >= FIRE_UPGRADE_COSTS[fireUpgradeTier];
}
function canUnlockGun() {
  return currentGun < 2 && coins >= GUN_UNLOCK_COSTS[currentGun + 1];
}
```

Buy fire rate:
```javascript
coins -= FIRE_UPGRADE_COSTS[fireUpgradeTier];
fireUpgradeTier++;
updateHUD();
```

Unlock gun (button click):
- Check `canUnlockGun()` — do nothing if false
- Set `pendingGunIndex = currentGun + 1`
- Enter STATE_QUESTION (do NOT deduct coins yet)

On correct answer:
```javascript
coins -= GUN_UNLOCK_COSTS[pendingGunIndex]; // deduct on success only
currentGun = pendingGunIndex;
fireUpgradeTier = 0;
pendingGunIndex = -1;
gameState = STATE_WAVE_WAIT;
updateHUD();
```

Gun 3 is the final gun. `btn-gun-unlock` text changes to "Max Gun" and stays disabled when `currentGun >= 2`.

---

## 7. Question System

### CONFIG (top of script.js — easy to edit)

```javascript
const GUN_QUESTIONS = [
  null,   // Gun 1: no question required
  {
    question: "What is the powerhouse of the cell?",
    answer:   "mitochondria",
  },
  {
    question: "What does CPU stand for?",
    answer:   "central processing unit",
  },
];
```

### Display flow

Entering STATE_QUESTION:
1. Show `#overlay-question`
2. Set `.question-text` innerHTML to `GUN_QUESTIONS[pendingGunIndex].question`
3. Clear `#answer-input` value
4. Hide `.question-error`
5. Focus `#answer-input`

### Answer normalization

```javascript
function normalizeAnswer(s) {
  return s.trim().toLowerCase();
}
// Match condition:
normalizeAnswer(input.value) === normalizeAnswer(GUN_QUESTIONS[pendingGunIndex].answer)
```

### Wrong answer handling

Show `.question-error` with text "Incorrect — please try again." Do not close overlay. Do not consume coins. Input remains focused. Player can retry indefinitely.

### Input events

- `#btn-submit-answer` click → `checkAnswer()`
- `#answer-input` keydown `Enter` → `checkAnswer()`

---

## 8. Wave System

### WAVE_CONFIGS (top of script.js — easy to edit)

```javascript
const WAVE_CONFIGS = [
  { grunts:  8, maulers:  0, tanks: 0 },  // Wave 1
  { grunts: 10, maulers:  2, tanks: 0 },  // Wave 2
  { grunts: 10, maulers:  4, tanks: 0 },  // Wave 3
  { grunts:  8, maulers:  5, tanks: 0 },  // Wave 4
  { grunts:  8, maulers:  6, tanks: 1 },  // Wave 5
  { grunts:  6, maulers:  8, tanks: 1 },  // Wave 6
  { grunts:  5, maulers:  8, tanks: 2 },  // Wave 7
  { grunts:  5, maulers:  8, tanks: 3 },  // Wave 8
  { grunts:  4, maulers: 10, tanks: 4 },  // Wave 9
  { grunts:  5, maulers: 12, tanks: 6 },  // Wave 10
];
const SPAWN_INTERVAL = 1500;  // ms between zombie spawns (tunable)
const ZOMBIE_SPEED   = 80;    // pixels per second (tunable)
const BULLET_SPEED   = 420;   // pixels per second (tunable)
```

### Wave start (`startWave()`)

```javascript
function startWave() {
  zombies = [];
  bullets = [];
  lastFireTime = 0;
  allSpawned = false;
  spawnQueue = buildSpawnQueue(currentWave - 1);
  waveStartTime = performance.now();
  gameState = STATE_PLAYING;
  hideOverlay('overlay-wave-wait');
}
```

### Wave end (`endWave()`)

```javascript
function endWave() {
  if (currentWave === 10) {
    gameState = STATE_VICTORY;
    showOverlay('overlay-victory');
  } else {
    currentWave++;
    gameState = STATE_WAVE_WAIT;
    document.getElementById('wave-wait-text').textContent = `Wave ${currentWave} incoming!`;
    document.getElementById('btn-start-wave').textContent = `Start Wave ${currentWave}`;
    showOverlay('overlay-wave-wait');
    updateHUD();
  }
}
```

### Wave completion condition

Checked at end of every `update()` call:
```javascript
if (allSpawned && zombies.length === 0) endWave();
```

---

## 9. UI System

### HTML structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Zombie Lane Defense</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="game-wrapper">
    <div id="canvas-area">
      <canvas id="gameCanvas" width="600" height="550"></canvas>
      <!-- Overlays positioned absolute inside canvas-area -->
      <div id="overlay-title">
        <h1>Zombie Lane Defense</h1>
        <button id="btn-play">Play</button>
      </div>
      <div id="overlay-wave-wait" class="hidden">
        <p id="wave-wait-text">Wave 1 incoming!</p>
        <button id="btn-start-wave">Start Wave 1</button>
      </div>
      <div id="overlay-question" class="hidden">
        <p class="question-label">Answer to unlock next gun:</p>
        <p class="question-text" id="question-text"></p>
        <input type="text" id="answer-input" autocomplete="off" placeholder="Type answer...">
        <button id="btn-submit-answer">Submit</button>
        <p class="question-error hidden" id="question-error">Incorrect — please try again.</p>
      </div>
      <div id="overlay-victory" class="hidden">
        <h2>Victory!</h2>
        <p>You survived all 10 waves!</p>
      </div>
      <div id="overlay-defeat" class="hidden">
        <h2>Defeated!</h2>
        <p>A zombie reached you.</p>
        <button id="btn-retry">Try Again</button>
      </div>
    </div>

    <div id="hud">
      <h2>HUD</h2>
      <div id="hud-wave">Wave: 1 / 10</div>
      <div id="hud-coins">Coins: 0</div>
      <div id="hud-gun">Gun: Pistol</div>
      <div id="hud-tier">Fire Tier: 0 / 3</div>
      <hr>
      <button id="btn-fire-upgrade">Buy Fire Rate (50c)</button>
      <button id="btn-gun-unlock">Unlock SMG (300c)</button>
    </div>
  </div>
  <script src="script.js"></script>
</body>
</html>
```

### CSS layout

- `#game-wrapper`: `display: flex; flex-direction: row;`
- `#canvas-area`: `position: relative; width: 600px; height: 550px;` (canvas fills it)
- `#hud`: fixed-width sidebar, `width: 220px; padding: 16px;`
- Overlays: `position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.75); color: #fff;`
- `.hidden`: `display: none !important;`
- `button:disabled`: `opacity: 0.4; cursor: not-allowed;`

### HUD update function

```javascript
function updateHUD() {
  document.getElementById('hud-wave').textContent  = `Wave: ${currentWave} / 10`;
  document.getElementById('hud-coins').textContent = `Coins: ${coins}`;
  document.getElementById('hud-gun').textContent   = `Gun: ${GUNS[currentGun].name}`;
  document.getElementById('hud-tier').textContent  = `Fire Tier: ${fireUpgradeTier} / 3`;
  updateUpgradeButtons();
}

function updateUpgradeButtons() {
  const frBtn  = document.getElementById('btn-fire-upgrade');
  const gunBtn = document.getElementById('btn-gun-unlock');

  if (fireUpgradeTier < 3) {
    frBtn.disabled    = coins < FIRE_UPGRADE_COSTS[fireUpgradeTier];
    frBtn.textContent = `Buy Fire Rate (${FIRE_UPGRADE_COSTS[fireUpgradeTier]}c)`;
  } else {
    frBtn.disabled    = true;
    frBtn.textContent = 'Fire Rate MAX';
  }

  if (currentGun < 2) {
    const nextIdx     = currentGun + 1;
    gunBtn.disabled    = coins < GUN_UNLOCK_COSTS[nextIdx];
    gunBtn.textContent = `Unlock ${GUNS[nextIdx].name} (${GUN_UNLOCK_COSTS[nextIdx]}c)`;
  } else {
    gunBtn.disabled    = true;
    gunBtn.textContent = 'Max Gun';
  }
}
```

### Event wiring (called once in `DOMContentLoaded`)

```javascript
function initEventListeners() {
  document.getElementById('btn-play').addEventListener('click', startGame);
  document.getElementById('btn-start-wave').addEventListener('click', startWave);
  document.getElementById('btn-fire-upgrade').addEventListener('click', buyFireUpgrade);
  document.getElementById('btn-gun-unlock').addEventListener('click', triggerGunUnlock);
  document.getElementById('btn-submit-answer').addEventListener('click', checkAnswer);
  document.getElementById('answer-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') checkAnswer();
  });
  document.getElementById('btn-retry').addEventListener('click', resetGame);
  document.addEventListener('keydown', handleMovement);
}
```

### Player movement handler

```javascript
function handleMovement(e) {
  if (gameState !== STATE_PLAYING && gameState !== STATE_WAVE_WAIT) return;
  if (e.key === 'ArrowLeft'  && playerLane > 0) playerLane--;
  if (e.key === 'ArrowRight' && playerLane < 2) playerLane++;
}
```

Movement allowed during WAVE_WAIT so player can reposition before wave starts.

---

## 10. Failure and Reset Logic

### Defeat trigger (inside `update()`)

```javascript
for (const z of zombies) {
  if (!z.dead && z.y + z.height >= PLAYER_Y && z.lane === playerLane) {
    gameState = STATE_DEFEAT;
    showOverlay('overlay-defeat');
    return; // stop update immediately
  }
}
```

### Full reset (`resetGame()`) — every variable must be cleared

```javascript
function resetGame() {
  gameState      = STATE_WAVE_WAIT;
  playerLane     = 1;
  coins          = 0;
  currentGun     = 0;
  fireUpgradeTier = 0;
  currentWave    = 1;
  zombies        = [];
  bullets        = [];
  spawnQueue     = [];
  allSpawned     = false;
  waveStartTime  = 0;
  lastFireTime   = 0;
  pendingGunIndex = -1;

  hideAllOverlays();
  document.getElementById('wave-wait-text').textContent  = 'Wave 1 incoming!';
  document.getElementById('btn-start-wave').textContent  = 'Start Wave 1';
  document.getElementById('answer-input').value          = '';
  document.getElementById('question-error').classList.add('hidden');
  showOverlay('overlay-wave-wait');
  updateHUD();
}
```

---

## 11. GitHub Pages Constraints

- All `<link>` and `<script>` tags use relative paths: `href="style.css"`, `src="script.js"`
- No absolute URLs, no CDN imports, no external fonts
- No build step — files committed and served directly
- Works from subdirectory: `https://user.github.io/ZombieLaneDefence/` because all paths are relative
- README.md explains: push to `main`, enable Pages at Settings > Pages > Source: `main`, folder `/` (root of the ZombieLaneDefence folder)

---

## 12. Step-by-Step Implementation Order

Each step produces a testable milestone before moving to the next.

### Step 1 — Scaffold HTML + CSS
- Create `index.html` with canvas, HUD panel, and all 5 overlay divs (correct IDs as listed above)
- Create `style.css` with flex layout, overlay positioning, `.hidden` class, basic button and body styles
- **Testable**: Open in browser — title overlay visible with Play button; HUD sidebar visible; no JS errors in console

### Step 2 — CONFIG block + variables + state machine skeleton
- Create `script.js` with: all CONFIG objects at top (GUNS, WAVE_CONFIGS, GUN_QUESTIONS, ZOMBIE_TYPES, FIRE_UPGRADE_COSTS, GUN_UNLOCK_COSTS, ZOMBIE_SPEED, BULLET_SPEED, SPAWN_INTERVAL)
- Declare all game variables
- Add STATE constants
- Add stub functions for each state transition (log to console)
- Add `initEventListeners()` and `DOMContentLoaded` entry point that wires all buttons and starts the RAF loop
- **Testable**: Clicking Play logs "startGame called"; no console errors; config objects visible in DevTools

### Step 3 — Game loop + static canvas rendering
- Implement `requestAnimationFrame` loop
- Implement `render()`: draws background, lane tints, lane dividers, player sprite at `playerLane`
- **Testable**: Canvas renders immediately; player rectangle visible in center lane; no flickering

### Step 4 — Player movement
- Implement `handleMovement` with ArrowLeft/ArrowRight guards
- **Testable**: Arrow keys move player across 3 lanes; player stops at boundaries (lanes 0 and 2); stays in one lane at a time

### Step 5 — Bullet system
- Implement auto-fire in `update()` using `fireInterval()` and `lastFireTime`
- Implement bullet movement and off-screen cleanup
- Implement bullet rendering
- Temporarily force `gameState = STATE_PLAYING` to test without full wave flow
- **Testable**: Bullets fire automatically from player lane at base fire rate; move upward; disappear off top; changing lane redirects bullets

### Step 6 — Zombie entity + spawning + movement
- Implement `buildSpawnQueue()` and `spawnZombie()`
- Implement zombie movement and rendering (`drawZombie()` with body, eyes, mouth, health bar)
- **Testable**: Wave 1 zombies appear at top in various lanes; all three types visually distinct (different size, color); health bars visible; zombies move downward at uniform speed

### Step 7 — Collision detection + combat + coins
- Implement bullet-zombie collision in `update()`
- On hit: decrement HP, mark bullet dead; on death: mark zombie dead, award coins, call `updateHUD()`
- Implement player-zombie collision → `enterDefeat()`
- **Testable**: Grunt dies in exactly 3 hits; mauler in 10; tank in 100 (verify via console log); coins increment correctly in HUD; defeat overlay appears when zombie reaches player

### Step 8 — Wave flow (start, complete, advance)
- Implement `startWave()`: builds queue, sets STATE_PLAYING, hides overlay
- Implement `endWave()`: increments wave or triggers victory
- Implement wave completion check
- Wire "Start Wave N" button; update button label each wave
- **Testable**: Click "Start Wave 1" starts wave; after all zombies die "Start Wave 2" appears; wave does not auto-start; after wave 10 clears, victory overlay appears

### Step 9 — HUD + upgrade buttons
- Implement full `updateHUD()` and `updateUpgradeButtons()`
- Implement `buyFireUpgrade()`: deduct coins, increment tier, update HUD
- **Testable**: Fire rate upgrade button deducts coins and speeds up firing; button disables at tier 3; displays correct cost; gun and tier shown in HUD

### Step 10 — Gun unlock + question system
- Implement `triggerGunUnlock()`: show question overlay for `pendingGunIndex`
- Implement `checkAnswer()`: normalize, compare, unlock or show error
- On correct: deduct coins, set new gun, reset tier, return to WAVE_WAIT
- **Testable**: Accumulate coins; click Unlock; question overlay appears with correct question text; wrong answer shows error and leaves overlay open; correct answer unlocks gun; fire tier resets to 0; Gun 3 is final (button becomes "Max Gun" and stays disabled)

### Step 11 — Defeat and full reset
- Ensure `resetGame()` clears every variable (checklist in Section 10)
- **Testable**: Let zombie reach player → defeat overlay appears, gameplay stops; click Try Again → everything resets to Gun 1, Wave 1, 0 coins, 0 upgrades, no zombies, no bullets

### Step 12 — Victory screen
- Confirm victory overlay appears after wave 10 clears
- Confirm no more spawning or gameplay after victory
- **Testable**: Survive wave 10; victory overlay appears; game does not continue

### Step 13 — README + polish (secondary)
- Write `README.md` with: how to run locally, how to edit questions/answers, how to adjust wave config and upgrade values, how to deploy on GitHub Pages
- Optional polish: hit flash (briefly change zombie color on damage), lane highlight on player move, CSS transition on overlays
- **Testable**: Deploy to GitHub Pages subdirectory; all paths load; game fully playable from deployed URL

---

## Sprite Generation Summary

**No image files exist or are needed.** The complete visual set is produced by these Canvas 2D draw calls:

| Entity | Draw calls |
|--------|-----------|
| Background | `fillRect` (full canvas), 3× `fillRect` (lane tints) |
| Lane dividers | 2× dashed `lineTo` strokes |
| Player | `fillRect` (body), `fillRect` (gun barrel), 2× `fillRect` (eyes) |
| Grunt | `fillRect` (body), `strokeRect` (outline), 2× `fillRect` (eyes), `fillRect` (mouth), 2× `fillRect` (health bar bg + fill) |
| Mauler | Same draw calls as grunt, different dimensions and colors |
| Tank | Same draw calls as grunt, different dimensions and colors |
| Bullet | `fillRect` (4×10 yellow rectangle) |

All sprite colors, dimensions, and config values are defined in the CONFIG block at the top of `script.js`. To change the look of any entity, edit its entry in `ZOMBIE_TYPES` or the corresponding `drawPlayer`/`drawBullet` function.
