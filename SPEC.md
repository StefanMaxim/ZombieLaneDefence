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

No framework. No build step. No external fonts, images, or CDN imports. Audio is generated programmatically via the Web Audio API (no audio files). All paths relative. `script.js` loaded with `<script src="script.js"></script>` at bottom of `<body>`.

---

## 2. Game State Model

### States (string constants)

```
STATE_TITLE        — title screen visible, canvas idle
STATE_WAVE_WAIT    — between waves; HUD visible; "Start Wave N" button visible
STATE_PLAYING      — active wave; game loop runs update(); auto-fire active
STATE_QUESTION     — gun-unlock question overlay shown; loop still renders but skips update
STATE_VICTORY      — wave 10 cleared; victory overlay shown
STATE_DEFEAT       — zombie touched player; defeat overlay shown briefly before reset
```

### Core variables

```javascript
// State
let gameState = STATE_TITLE

// Player
let playerLane = 1          // 0=left, 1=center, 2=right
let playerDisplayX = 300    // lerped display position (for smooth lane easing)
let muzzleFlashTimer = 0    // ms remaining for muzzle flash effect

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

// Effects
let defeatFlashTimer = 0    // ms remaining for red screen flash on defeat

// Audio
let audioCtx = null         // Web Audio API context; created on first user gesture
```

### State transitions

```
TITLE       — click Play            → WAVE_WAIT (currentWave=1)
WAVE_WAIT   — click "Start Wave N"  → PLAYING
PLAYING     — all zombies dead      → WAVE_WAIT (if wave<10) or VICTORY (if wave=10)
PLAYING     — any zombie reaches    → DEFEAT (brief flash) → resetGame() → WAVE_WAIT
              player Y position
WAVE_WAIT   — click "Unlock Gun"    → QUESTION (saves pendingGunIndex; coins NOT deducted yet)
QUESTION    — correct answer        → WAVE_WAIT (gun unlocked, coins deducted, tier reset)
QUESTION    — wrong answer          → stays QUESTION (shows error; coins NOT consumed)
VICTORY     — terminal; only page refresh resets
```

**Gun unlock flow — explicit:**
- Fire rate upgrades: cost coins only. No question required.
- Gun unlocks: require BOTH sufficient coins AND a correct answer. Coins are deducted ONLY after a correct answer. A wrong answer leaves coins untouched and keeps the question overlay open.

---

## 3. Rendering System — All Sprites Generated via Canvas 2D API

**There are no image files, sprite sheets, SVGs, or fonts beyond the browser default. Every visual element is drawn with `ctx.fillRect`, `ctx.strokeRect`, `ctx.arc`, and `ctx.fillText`.**

> **CONFIG note:** Canvas dimensions and all visual layout values below are **defaults**. They live in the CONFIG block at the top of `script.js` and can be changed without touching game logic.

### Canvas dimensions (defaults)

- Canvas: **600 × 550 px**
- Three lanes of equal width: **200 px each**
- Lane 0: x 0–199 | Lane 1: x 200–399 | Lane 2: x 400–599
- Player Y (top of sprite): **480 px**
- Zombie spawn Y (off-screen top): **-60 px**
- Defeat trigger: zombie bottom edge `>= PLAYER_Y` — **regardless of lane**

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

// Step 3: Subtle lane highlight under player
ctx.fillStyle = 'rgba(0, 170, 255, 0.07)';
ctx.fillRect(playerLane * 200, 0, 200, 550);

// Step 4: Lane dividers (dashed vertical lines)
ctx.setLineDash([8, 6]);
ctx.strokeStyle = '#444';
ctx.lineWidth = 2;
for (let x of [200, 400]) {
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 550); ctx.stroke();
}
ctx.setLineDash([]);

// Step 5: Bottom "pavement" edge line
ctx.strokeStyle = '#555';
ctx.lineWidth = 2;
ctx.beginPath(); ctx.moveTo(0, 520); ctx.lineTo(600, 520); ctx.stroke();
```

### Player sprite

Shape: blue rectangle body + white gun barrel + eyes + muzzle flash. `playerDisplayX` is a lerped value tracking `laneCenter(playerLane)` for smooth lane transitions.

```javascript
function drawPlayer(ctx, dt) {
  // Lerp display position toward target lane
  const targetX = laneCenter(playerLane);
  playerDisplayX += (targetX - playerDisplayX) * Math.min(1, dt * 0.015);
  const cx = playerDisplayX;

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

  // Muzzle flash (if timer active)
  if (muzzleFlashTimer > 0) {
    ctx.fillStyle = '#ffffaa';
    ctx.beginPath();
    ctx.arc(cx, 464, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, 464, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
```

### Zombie sprites — three visually distinct silhouettes (no images)

Each zombie type has a unique multi-shape silhouette so they are immediately distinguishable — not just by color, but by shape and posture. Shapes are assembled from `fillRect` and `arc` calls.

| Type | Body W | Body H | Body Color | Head Color | HP | Coins | Silhouette character |
|------|--------|--------|------------|------------|-----|-------|----------------------|
| grunt | 24 | 32 | `#55aa55` (green) | `#66bb66` | 3 | 1 | Upright, compact, small head, stub arms |
| mauler | 34 | 44 | `#cc7700` (orange) | `#dd8800` | 10 | 10 | Taller, offset head, asymmetric arm reach |
| tank | 52 | 52 | `#aa2222` (dark red) | `#bb3333` | 100 | 50 | Wide, hunched, massive shoulders, stumpy legs |

These dimensions live in `ZOMBIE_TYPES` config (see Section 5).

```javascript
function drawZombie(ctx, z) {
  // Apply shake offset if hit-flashing
  const sx = z.shakeOffset ? z.shakeOffset.x : 0;
  const sy = z.shakeOffset ? z.shakeOffset.y : 0;
  const cx = laneCenter(z.lane) + sx;
  const ty = z.y + sy + Math.sin(z.bobPhase) * 2; // vertical bob
  const hw = z.bodyWidth / 2;

  // Fade-in on spawn
  ctx.globalAlpha = Math.min(1, z.opacity);

  // Body color: white flash on hit, normal otherwise
  const bodyCol = z.flashTimer > 0 ? '#ffffff' : z.bodyColor;

  // --- Body ---
  ctx.fillStyle = bodyCol;
  ctx.fillRect(cx - hw, ty, z.bodyWidth, z.bodyHeight);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - hw, ty, z.bodyWidth, z.bodyHeight);

  // --- Head (circle) ---
  const headR = z.bodyWidth * 0.38;
  ctx.fillStyle = z.flashTimer > 0 ? '#ffffff' : z.headColor;
  ctx.beginPath();
  ctx.arc(cx + z.headOffsetX, ty - headR * 0.6, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();

  // --- Eyes (on head) ---
  const eyeY = ty - headR * 0.6 - headR * 0.15;
  ctx.fillStyle = z.eyeColor;
  ctx.fillRect(cx + z.headOffsetX - headR * 0.5, eyeY, headR * 0.3, headR * 0.3);
  ctx.fillRect(cx + z.headOffsetX + headR * 0.1, eyeY, headR * 0.3, headR * 0.3);

  // --- Arms (type-specific) ---
  ctx.fillStyle = bodyCol;
  // Left arm
  ctx.fillRect(cx - hw - z.armLength, ty + z.armOffsetY, z.armLength, z.armThickness);
  // Right arm (mauler has longer right arm for asymmetry)
  ctx.fillRect(cx + hw, ty + z.armOffsetY, z.armLengthRight, z.armThickness);

  // --- Stumpy legs (tank only, via short rects at body bottom) ---
  if (z.type === 'tank') {
    ctx.fillRect(cx - hw + 4, ty + z.bodyHeight, 12, 8);
    ctx.fillRect(cx + hw - 16, ty + z.bodyHeight, 12, 8);
  }

  // --- Health bar (above sprite, above head) ---
  const barY = ty - headR * 1.4 - 8;
  const barW = z.bodyWidth + 8;
  const ratio = z.hp / z.maxHp;
  ctx.fillStyle = '#333';
  ctx.fillRect(cx - barW / 2, barY, barW, 4);
  ctx.fillStyle = ratio > 0.5 ? '#00cc44' : ratio > 0.25 ? '#eeaa00' : '#cc2222';
  ctx.fillRect(cx - barW / 2, barY, barW * ratio, 4);

  ctx.globalAlpha = 1;
}
```

### Bullet sprite

Drawn with a glow trail: bright lead rectangle + dimmer trailing rectangle.

```javascript
function drawBullet(ctx, b) {
  const cx = laneCenter(b.lane);
  // Trail (dimmer, behind)
  ctx.fillStyle = 'rgba(255, 255, 100, 0.35)';
  ctx.fillRect(cx - 2, b.y + 10, 4, 8);
  // Lead (bright)
  ctx.fillStyle = '#ffff44';
  ctx.fillRect(cx - 2, b.y, 4, 10);
}
```

### Sound system (browser-native Web Audio API — no external files)

All sounds are synthesized programmatically. `audioCtx` is created lazily on the first user interaction to comply with browser autoplay policy.

```javascript
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playShotSound() {
  ensureAudio();
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.08, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
  src.connect(gain); gain.connect(audioCtx.destination);
  src.start();
}

function playHitSound() {
  ensureAudio();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(180, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 0.06);
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + 0.06);
}

function playDeathSound() {
  ensureAudio();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(55, audioCtx.currentTime + 0.18);
  gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + 0.18);
}
```

### Polish & Game Feel (Low Complexity Enhancements)

All effects are implemented inside existing draw functions using only Canvas 2D API. None require new architectural layers or external libraries.

| Effect | Implementation |
|--------|---------------|
| **Player lane easing** | `playerDisplayX` lerps toward `laneCenter(playerLane)` each frame in `drawPlayer()`. No teleporting. |
| **Lane highlight under player** | Subtle `rgba(0,170,255,0.07)` tint rect drawn over active lane each frame in background step. |
| **Bullet glow / trail** | Two-rect draw: dim yellow trailing rect + bright yellow lead rect per bullet. |
| **Zombie spawn fade-in** | `z.opacity` starts at 0, incremented by `dt * 0.003` per frame (full opacity after ~300 ms). `ctx.globalAlpha` set accordingly in `drawZombie()`. |
| **Screen flash on defeat** | `defeatFlashTimer` set to 300 ms on defeat. Each render frame: draw `rgba(255,0,0,0.3)` over full canvas while timer > 0. |
| **Zombie vertical bob** | Each zombie tracks `z.bobPhase` (incremented by `dt * 0.003` each frame). Draw y offset by `Math.sin(z.bobPhase) * 2` px. |
| **Muzzle flash** | `muzzleFlashTimer` set to 80 ms on each shot. `drawPlayer()` draws a small bright arc at gun tip while timer > 0. |
| **Hit flash + shake** | On bullet hit: `z.flashTimer = 100`, `z.shakeOffset = {x: rand(−2,2), y: rand(−2,2)}`. Both cleared when timer expires. |

### Render order per frame

1. Background + lanes (includes lane highlight)
2. Screen tint overlay (if `defeatFlashTimer > 0`)
3. All zombies (back-to-front by y) — includes bob, fade, shake, flash
4. All bullets — includes glow trail
5. Player — includes muzzle flash, eased position
6. (Overlays are HTML elements layered above canvas via CSS z-index)

---

## 4. Game Loop

```javascript
function gameLoop(timestamp) {
  const dt = Math.min(timestamp - lastTimestamp, 50); // cap 50ms to prevent spiral
  lastTimestamp = timestamp;

  if (gameState === STATE_PLAYING) {
    update(dt, timestamp);
  }

  // Tick effect timers every frame regardless of state
  muzzleFlashTimer = Math.max(0, muzzleFlashTimer - dt);
  defeatFlashTimer = Math.max(0, defeatFlashTimer - dt);

  render(dt);
  animFrameId = requestAnimationFrame(gameLoop);
}
```

`requestAnimationFrame` starts once on page load and runs forever. State gate inside `update()` ensures logic only runs during `STATE_PLAYING`.

### `update(dt, timestamp)` — execution order

1. **Spawn check**: iterate spawnQueue; push zombies whose `spawnAt <= elapsed`
2. **Move zombies**: `z.y += ZOMBIE_SPEED * (dt / 1000)` for each living zombie; increment `z.bobPhase += dt * 0.003`; increment `z.opacity` toward 1; tick `z.flashTimer -= dt`; if `z.flashTimer <= 0` clear `z.shakeOffset`; else randomize `z.shakeOffset` each frame
3. **Auto-fire**: if `timestamp - lastFireTime >= fireInterval()` → push new bullet at `playerLane`; update `lastFireTime`; set `muzzleFlashTimer = 80`; call `playShotSound()`
4. **Move bullets**: `b.y -= BULLET_SPEED * (dt / 1000)` for each bullet; remove bullets with `b.y + 10 < 0`
5. **Bullet-zombie collision**: O(n×m) check; on hit: `z.hp--; z.flashTimer = 100; z.shakeOffset = {x,y}; b.dead = true; playHitSound()`; if `z.hp <= 0`: `z.dead = true; coins += z.coinReward; playDeathSound(); updateHUD()`
6. **Player-zombie collision**: for each zombie: if `!z.dead && z.y + z.height >= PLAYER_Y` → `enterDefeat()`. **Lane does not matter — any zombie reaching PLAYER_Y triggers defeat.**
7. **Cleanup**: filter out `dead` bullets and `dead` zombies
8. **Wave complete**: if `allSpawned && zombies.length === 0` → `endWave()`

### Collision detection

**Bullet-zombie** — lane equality replaces x-axis AABB (bullet and zombie in same lane are x-aligned). Only y-overlap checked:

```javascript
bullet.lane === z.lane &&
bullet.y <= z.y + z.height &&
bullet.y + 10 >= z.y &&
!z.dead && !bullet.dead
```

On hit, mark `bullet.dead = true` immediately (one bullet, one zombie, one hit per collision pass).

**Player-zombie** — lane is irrelevant. Only y-position checked:

```javascript
// Lanes are for positioning and aiming only — they do NOT affect player collision.
for (const z of zombies) {
  if (!z.dead && z.y + z.height >= PLAYER_Y) {
    enterDefeat();
    return;
  }
}
```

---

## 5. Entity Systems

### ZOMBIE_TYPES config

> **All values are defaults.** Edit this block to adjust zombie feel without changing game logic.

```javascript
const ZOMBIE_TYPES = {
  grunt: {
    hp: 3, coinReward: 1,
    bodyWidth: 24, bodyHeight: 32,
    bodyColor: '#55aa55', headColor: '#66bb66', eyeColor: '#ffffff',
    headOffsetX: 0,
    armLength: 8, armLengthRight: 8, armOffsetY: 6, armThickness: 5,
  },
  mauler: {
    hp: 10, coinReward: 10,
    bodyWidth: 34, bodyHeight: 44,
    bodyColor: '#cc7700', headColor: '#dd8800', eyeColor: '#ffff00',
    headOffsetX: -4,             // head offset left = asymmetric slouch
    armLength: 10, armLengthRight: 16, armOffsetY: 8, armThickness: 6,
  },
  tank: {
    hp: 100, coinReward: 50,
    bodyWidth: 52, bodyHeight: 52,
    bodyColor: '#aa2222', headColor: '#bb3333', eyeColor: '#ffaaaa',
    headOffsetX: 0,
    armLength: 14, armLengthRight: 14, armOffsetY: 4, armThickness: 10, // massive shoulders
  },
};
```

### Zombie object structure

```javascript
{
  id: autoIncrementId++,
  type: 'grunt' | 'mauler' | 'tank',
  hp: number,
  maxHp: number,          // for health bar ratio, never changes after spawn
  lane: 0 | 1 | 2,
  y: number,              // top edge of body, starts at -60
  coinReward: number,
  dead: false,
  bodyWidth: number,
  bodyHeight: number,
  bodyColor: string,
  headColor: string,
  eyeColor: string,
  headOffsetX: number,    // horizontal head offset for silhouette variety
  armLength: number,
  armLengthRight: number,
  armOffsetY: number,
  armThickness: number,
  // Effects
  opacity: 0,             // 0→1 fade-in on spawn
  bobPhase: 0,            // incremented each frame for vertical bobbing
  flashTimer: 0,          // ms remaining for white hit flash
  shakeOffset: null,      // {x, y} pixel shake while flashTimer > 0
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

`spawnZombie(type, lane)` creates the zombie object from `ZOMBIE_TYPES[type]`, sets `y = -60`, `opacity = 0`, `bobPhase = Math.random() * Math.PI * 2` (random start phase so zombies bob out of sync).

### Movement

> **Default:** `ZOMBIE_SPEED = 80` pixels/second. All zombies share the same speed per this config value.

---

## 6. Upgrade System

### CONFIG block (top of script.js — easy to edit)

> **All values below are defaults.** Change them to rebalance the game without touching logic.

```javascript
const GUNS = [
  { name: 'Pistol',  baseInterval: 700,  upgradeIntervals: [500, 350, 200] },
  { name: 'SMG',     baseInterval: 180,  upgradeIntervals: [140, 100,  70] },
  { name: 'Railgun', baseInterval: 60,   upgradeIntervals: [ 45,  32,  20] },
];
// upgradeIntervals[0] = tier 1, [1] = tier 2, [2] = tier 3 (milliseconds between shots)

const FIRE_UPGRADE_COSTS = [50, 120, 250];  // cost for tier 1, 2, 3 (default values)
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
// Fire rate: coins only — NO question required
function canBuyFireRate() {
  return fireUpgradeTier < 3 && coins >= FIRE_UPGRADE_COSTS[fireUpgradeTier];
}

// Gun unlock: coins are a prerequisite, but unlock ALSO requires answering a question
function canUnlockGun() {
  return currentGun < 2 && coins >= GUN_UNLOCK_COSTS[currentGun + 1];
}
```

### Buy fire rate (`buyFireUpgrade()`)

No question involved. Immediate effect:

```javascript
function buyFireUpgrade() {
  if (!canBuyFireRate()) return;
  coins -= FIRE_UPGRADE_COSTS[fireUpgradeTier];
  fireUpgradeTier++;
  updateHUD();
}
```

### Unlock gun (`triggerGunUnlock()`)

Clicking the unlock button does NOT deduct coins. It opens the question overlay:

```javascript
function triggerGunUnlock() {
  if (!canUnlockGun()) return;
  pendingGunIndex = currentGun + 1;
  // Do NOT deduct coins here
  gameState = STATE_QUESTION;
  showOverlay('overlay-question');
  // populate question text — see Section 7
}
```

### On correct answer (inside `checkAnswer()`)

Coins are deducted only here, after the answer is confirmed correct:

```javascript
coins -= GUN_UNLOCK_COSTS[pendingGunIndex]; // deduct on success only
currentGun = pendingGunIndex;
fireUpgradeTier = 0;
pendingGunIndex = -1;
gameState = STATE_WAVE_WAIT;
hideOverlay('overlay-question');
updateHUD();
```

Gun 3 is the final gun. `btn-gun-unlock` text changes to "Max Gun" and stays disabled when `currentGun >= 2`.

**Summary table — upgrade types:**

| Upgrade | Coin cost | Question required | Coins deducted when |
|---------|-----------|-------------------|---------------------|
| Fire rate tier | Yes | **No** | Immediately on click |
| Gun unlock | Yes | **Yes** | Only after correct answer |

---

## 7. Question System

### CONFIG (top of script.js — easy to edit)

```javascript
const GUN_QUESTIONS = [
  null,   // Gun 1: no question required (free starting gun)
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
6. Disable upgrade buttons while overlay is open (to prevent double-click issues — see Section 13)

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

> **All values below are defaults.** Adjust counts and timing to tune difficulty.

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
const SPAWN_INTERVAL = 1500;  // ms between zombie spawns (default — tunable)
const ZOMBIE_SPEED   = 80;    // pixels per second (default — tunable)
const BULLET_SPEED   = 420;   // pixels per second (default — tunable)
const PLAYER_Y       = 480;   // y-coordinate that triggers defeat when zombie reaches it
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

Checked at end of every `update()` call, **after** the cleanup step (to avoid triggering before dead zombies are removed):

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

  // Disable all upgrade buttons during question overlay
  const inQuestion = gameState === STATE_QUESTION;

  if (fireUpgradeTier < 3) {
    frBtn.disabled    = inQuestion || coins < FIRE_UPGRADE_COSTS[fireUpgradeTier];
    frBtn.textContent = `Buy Fire Rate (${FIRE_UPGRADE_COSTS[fireUpgradeTier]}c)`;
  } else {
    frBtn.disabled    = true;
    frBtn.textContent = 'Fire Rate MAX';
  }

  if (currentGun < 2) {
    const nextIdx      = currentGun + 1;
    gunBtn.disabled    = inQuestion || coins < GUN_UNLOCK_COSTS[nextIdx];
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
  // playerDisplayX lerps toward laneCenter(playerLane) in drawPlayer() — no snap
}
```

Movement allowed during WAVE_WAIT so player can reposition before wave starts.

---

## 10. Failure and Reset Logic

### Defeat trigger (inside `update()`)

**Lanes do NOT protect the player.** Any zombie reaching `PLAYER_Y` triggers defeat:

```javascript
for (const z of zombies) {
  if (!z.dead && z.y + z.height >= PLAYER_Y) {
    enterDefeat();
    return; // stop update immediately
  }
}
```

### `enterDefeat()`

```javascript
function enterDefeat() {
  gameState = STATE_DEFEAT;
  defeatFlashTimer = 300; // red screen flash
  showOverlay('overlay-defeat');
}
```

### Full reset (`resetGame()`) — resets to Wave 1 pre-start; does NOT return to title screen

On defeat the player clicks "Try Again" and is immediately returned to the Wave 1 wave-wait state — no title screen, fast replay.

```javascript
function resetGame() {
  gameState       = STATE_WAVE_WAIT;  // straight to wave-wait, NOT title
  playerLane      = 1;
  playerDisplayX  = laneCenter(1);
  coins           = 0;
  currentGun      = 0;
  fireUpgradeTier = 0;
  currentWave     = 1;
  zombies         = [];
  bullets         = [];
  spawnQueue      = [];
  allSpawned      = false;
  waveStartTime   = 0;
  lastFireTime    = 0;
  pendingGunIndex = -1;
  muzzleFlashTimer = 0;
  defeatFlashTimer = 0;

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
- No absolute URLs, no CDN imports, no external fonts or audio files
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
- Create `script.js` with: all CONFIG objects at top (GUNS, WAVE_CONFIGS, GUN_QUESTIONS, ZOMBIE_TYPES, FIRE_UPGRADE_COSTS, GUN_UNLOCK_COSTS, ZOMBIE_SPEED, BULLET_SPEED, SPAWN_INTERVAL, PLAYER_Y)
- Declare all game variables including effect timers and `playerDisplayX`
- Add STATE constants
- Add stub functions for each state transition (log to console)
- Add `init()` / `DOMContentLoaded` entry point that wires all buttons and starts the RAF loop
- **Testable**: Clicking Play logs "startGame called"; no console errors; config objects visible in DevTools

### Step 3 — Game loop + static canvas rendering
- Implement `requestAnimationFrame` loop
- Implement `render(dt)`: draws background (with lane highlight), lane tints, dividers, player sprite at lerped `playerDisplayX`
- **Testable**: Canvas renders immediately; player rectangle visible in center lane; no flickering

### Step 4 — Player movement
- Implement `handleMovement` with ArrowLeft/ArrowRight guards
- `playerDisplayX` lerps smoothly in `drawPlayer()`
- **Testable**: Arrow keys move player across 3 lanes with smooth easing; player stops at boundaries; no teleporting

### Step 5 — Bullet system
- Implement auto-fire in `update()` using `fireInterval()` and `lastFireTime`
- Set `muzzleFlashTimer = 80` on each fire event; call `playShotSound()`
- Implement bullet movement and off-screen cleanup
- Implement bullet rendering with glow trail
- Temporarily force `gameState = STATE_PLAYING` to test without full wave flow
- **Testable**: Bullets fire automatically from player lane; move upward; disappear off top; muzzle flash visible; gunshot sound plays; changing lane redirects bullets

### Step 6 — Zombie entity + spawning + movement
- Implement `buildSpawnQueue()` and `spawnZombie()` with `opacity = 0` and random `bobPhase`
- Implement zombie movement: y advancement, opacity fade-in, bob phase increment, flash/shake tick
- Implement `drawZombie()` with head arc, body rect, arms, legs (tank only), health bar, opacity, flash, shake
- **Testable**: Wave 1 zombies appear at top with fade-in; all three types visually distinct by silhouette; zombies bob while walking; health bars visible

### Step 7 — Collision detection + combat + coins
- Implement bullet-zombie collision; on hit set `z.flashTimer`, `z.shakeOffset`, call `playHitSound()`; on death call `playDeathSound()`, award coins
- Implement player-zombie collision: **no lane check** — any zombie at `PLAYER_Y` calls `enterDefeat()`
- **Testable**: Grunt dies in 3 hits; mauler in 10; tank in 100; hit flash and shake visible; death sound plays; zombie disappears immediately on death; coins increment; defeat triggers from any lane

### Step 8 — Wave flow (start, complete, advance)
- Implement `startWave()`, `endWave()`, wave completion check (after cleanup step)
- Wire "Start Wave N" button; update label each wave
- **Testable**: Wave starts on button click; after all zombies die, wave-wait appears; wave 10 clear triggers victory; wave 11 never starts

### Step 9 — HUD + upgrade buttons
- Implement full `updateHUD()` and `updatexUpgradeButtons()`
- Ensure buttons disabled during `STATE_QUESTION`
- Implement `buyFireUpgrade()`: deduct coins, increment tier, update HUD — **no question**
- **Testable**: Fire rate button deducts coins and speeds up firing; disables at tier 3; shows correct cost; buttons disabled during question overlay

### Step 10 — Gun unlock + question system
- Implement `triggerGunUnlock()`: validate coins, set `pendingGunIndex`, show question overlay — **do not deduct coins**
- Implement `checkAnswer()`: normalize input; if correct deduct coins, set gun, reset tier, return to WAVE_WAIT; if wrong show error, leave coins untouched
- **Testable**: Accumulate coins; click Unlock; question overlay appears; wrong answer shows error, coins unchanged; correct answer unlocks gun and deducts coins; fire tier resets; Gun 3 disables unlock button permanently

### Step 11 — Defeat and full reset
- Implement `enterDefeat()` with `defeatFlashTimer = 300`
- Ensure `resetGame()` clears all variables and goes to `STATE_WAVE_WAIT` (not title screen)
- **Testable**: Zombie from any lane reaching player triggers defeat; red flash visible; "Try Again" resets to Wave 1 wave-wait immediately; no zombies or bullets persist

### Step 12 — Victory screen
- Confirm victory overlay appears after wave 10 clears
- Confirm no more spawning or gameplay after victory
- **Testable**: Survive wave 10; victory overlay appears; game does not continue

### Step 13 — Sound system
- Implement `ensureAudio()`, `playShotSound()`, `playHitSound()`, `playDeathSound()`
- Ensure `audioCtx` is created on first user gesture only
- **Testable**: All three sounds play at correct moments; no AudioContext errors in console; sounds work after page sits idle before first click

### Step 14 — README + final polish check
- Write `README.md` with: how to run locally, how to edit questions/answers, how to adjust wave config and upgrade values, how to deploy on GitHub Pages
- Verify all Game Feel effects are working: easing, lane highlight, bullet trail, zombie fade-in, bob, hit shake, muzzle flash, screen flash
- **Testable**: Deploy to GitHub Pages subdirectory; all paths load; game fully playable from deployed URL; all visual effects visible

---

## 13. Edge Cases

Each of the following must be explicitly handled in the implementation:

| Edge case | Resolution |
|-----------|-----------|
| Upgrade button clicks during question overlay | `updateUpgradeButtons()` sets both buttons `disabled = true` when `gameState === STATE_QUESTION`. |
| Multiple bullets hitting same zombie in same frame | Collision loop guards `!z.dead && !bullet.dead`. First bullet kills, marks `z.dead = true`; subsequent bullets skip `z` in same pass. |
| Coins awarded more than once per zombie | Coin award is inside the `z.hp <= 0` branch, which immediately sets `z.dead = true` — no re-entry possible. |
| Wave completing before all zombies are removed | `endWave()` check runs after the cleanup filter step, so `zombies.length === 0` is only true once all dead zombies are removed. |
| Wave 11 starting | `endWave()` checks `currentWave === 10` before incrementing. If true, goes to `STATE_VICTORY` instead of incrementing. |
| Input spam at lane boundaries | `handleMovement` guards: `ArrowLeft` requires `playerLane > 0`; `ArrowRight` requires `playerLane < 2`. Repeated key presses at boundary are no-ops. |
| Zombies persisting after reset | `resetGame()` sets `zombies = []; bullets = []; spawnQueue = [];` — all entity arrays explicitly cleared. |
| AudioContext blocked by browser autoplay policy | `audioCtx` is `null` at startup. `ensureAudio()` creates it inside sound functions, which are only called in response to user-initiated gameplay after first interaction. |
| Player cannot dodge defeat by switching lanes | Defeat collision check has no lane guard — switching lanes while a zombie is at `PLAYER_Y` has no effect. |

---

## 14. Function-Level Implementation Map

Every function to implement in `script.js`, with its exact responsibility:

| Function | Responsibility |
|----------|---------------|
| `init()` | Entry point on `DOMContentLoaded`; wires all event listeners, initializes canvas context reference, starts RAF loop. |
| `gameLoop(timestamp)` | RAF callback; computes capped `dt`; calls `update(dt, ts)` if `STATE_PLAYING`; ticks effect timers; calls `render(dt)`; schedules next frame. |
| `update(dt, timestamp)` | All per-frame game logic: spawn check, zombie movement + effects, auto-fire, bullet movement, bullet-zombie collision, player-zombie collision, entity cleanup, wave completion check. |
| `render(dt)` | Clears canvas and redraws all layers each frame: background, tints, lane highlight, defeat flash overlay, zombies, bullets, player. |
| `spawnZombie(type, lane)` | Creates a zombie object from `ZOMBIE_TYPES[type]`, initializes effects fields (`opacity = 0`, random `bobPhase`), pushes to `zombies[]`. |
| `buildSpawnQueue(waveIdx)` | Builds and shuffles a flat list of zombie entries from `WAVE_CONFIGS[waveIdx]`, assigns lanes and `spawnAt` timestamps, returns sorted array. |
| `handleMovement(e)` | Keyboard event handler; adjusts `playerLane` on ArrowLeft/ArrowRight within `[0, 2]` bounds; ignored outside `STATE_PLAYING` / `STATE_WAVE_WAIT`. |
| `buyFireUpgrade()` | Validates `canBuyFireRate()`; deducts coins; increments `fireUpgradeTier`; calls `updateHUD()`. No question required. |
| `triggerGunUnlock()` | Validates `canUnlockGun()`; sets `pendingGunIndex`; transitions to `STATE_QUESTION`; shows question overlay. Does NOT deduct coins. |
| `checkAnswer()` | Reads and normalizes `#answer-input`; compares to `GUN_QUESTIONS[pendingGunIndex].answer`; on match: deducts coins, sets gun, resets tier, returns to `STATE_WAVE_WAIT`; on mismatch: shows error, leaves coins intact. |
| `startWave()` | Clears entity arrays; builds spawn queue; sets `waveStartTime`; transitions to `STATE_PLAYING`; hides wave-wait overlay. |
| `endWave()` | If wave 10: transitions to `STATE_VICTORY`. Otherwise: increments `currentWave`, updates overlay text, transitions to `STATE_WAVE_WAIT`. |
| `enterDefeat()` | Sets `STATE_DEFEAT`; sets `defeatFlashTimer = 300`; shows defeat overlay. |
| `resetGame()` | Resets all state variables to Wave 1 defaults; clears entity arrays; transitions to `STATE_WAVE_WAIT` (not title); shows wave-wait overlay. |
| `updateHUD()` | Syncs wave, coins, gun name, fire tier DOM elements to current game state; calls `updateUpgradeButtons()`. |
| `updateUpgradeButtons()` | Enables/disables and relabels fire upgrade and gun unlock buttons based on current coins, tiers, and `gameState`. |
| `drawPlayer(ctx, dt)` | Lerps `playerDisplayX` toward `laneCenter(playerLane)`; draws player body, gun barrel, eyes; draws muzzle flash if `muzzleFlashTimer > 0`. |
| `drawZombie(ctx, z)` | Draws zombie with type-specific silhouette (body rect, head arc, arms, optional legs); applies bob offset, shake offset, opacity, hit flash color override, health bar. |
| `drawBullet(ctx, b)` | Draws bullet as two stacked rects: dim trailing glow + bright lead rect. |
| `ensureAudio()` | Creates `AudioContext` on first call; no-op on subsequent calls. Safe to call from any sound function. |
| `playShotSound()` | Calls `ensureAudio()`; generates short white-noise burst via `AudioContext` buffer; plays immediately. |
| `playHitSound()` | Calls `ensureAudio()`; generates descending square-wave click via oscillator; plays immediately. |
| `playDeathSound()` | Calls `ensureAudio()`; generates descending sawtooth tone via oscillator; plays immediately. |
| `laneCenter(lane)` | Pure helper: returns pixel x-center of the given lane. `lane * 200 + 100`. |
| `showOverlay(id)` / `hideOverlay(id)` / `hideAllOverlays()` | DOM helpers to add/remove `.hidden` class on overlay divs. |

---

## Sprite Generation Summary

**No image files exist or are needed.** The complete visual set is produced by these Canvas 2D draw calls:

| Entity | Draw calls |
|--------|-----------|
| Background | `fillRect` (full canvas), 3× `fillRect` (lane tints), 1× `fillRect` (lane highlight) |
| Lane dividers | 2× dashed `lineTo` strokes |
| Player | `fillRect` (body), `fillRect` (gun barrel), 2× `fillRect` (eyes), `arc` + `arc` (muzzle flash) |
| Grunt | `fillRect` (body), `arc` (head), 2× `fillRect` (eyes), 2× `fillRect` (arms), 2× `fillRect` (health bar) |
| Mauler | Same as grunt with offset head arc, asymmetric arm lengths |
| Tank | Same as grunt + 2× `fillRect` (stumpy legs), wider arm rects |
| Bullet | `fillRect` (dim trail), `fillRect` (bright lead) |
| Defeat flash | `fillRect` (full-canvas `rgba(255,0,0,0.3)` tint) |

All sprite colors, dimensions, and config values are defined in the CONFIG block at the top of `script.js`. To change the look of any entity, edit its entry in `ZOMBIE_TYPES`. To change game balance, edit `WAVE_CONFIGS`, `GUNS`, `FIRE_UPGRADE_COSTS`, or `GUN_UNLOCK_COSTS`. None of these edits require touching game logic.
