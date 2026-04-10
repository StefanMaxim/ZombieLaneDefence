'use strict';

// CONFIG
const CONFIG = {
  canvas: {
    width: 600,
    height: 550,
    laneCount: 3,
    laneWidth: 200,
    playerY: 480,
    zombieSpawnY: -60,
  },
  guns: [
    { name: 'Pistol', baseInterval: 700, upgradeIntervals: [500, 350, 200] },
    { name: 'SMG', baseInterval: 180, upgradeIntervals: [140, 100, 70] },
    { name: 'Railgun', baseInterval: 60, upgradeIntervals: [45, 32, 20] },
  ],
  fireUpgradeCosts: [50, 120, 250],
  gunUnlockCosts: [0, 300, 700],
  gunQuestions: [
    null,
    {
      question: 'What is the powerhouse of the cell?',
      answer: 'mitochondria',
    },
    {
      question: 'What does CPU stand for?',
      answer: 'central processing unit',
    },
  ],
  waveConfigs: [
    { grunts: 8, maulers: 0, tanks: 0 },
    { grunts: 10, maulers: 2, tanks: 0 },
    { grunts: 10, maulers: 4, tanks: 0 },
    { grunts: 8, maulers: 5, tanks: 0 },
    { grunts: 8, maulers: 6, tanks: 1 },
    { grunts: 6, maulers: 8, tanks: 1 },
    { grunts: 5, maulers: 8, tanks: 2 },
    { grunts: 5, maulers: 8, tanks: 3 },
    { grunts: 4, maulers: 10, tanks: 4 },
    { grunts: 5, maulers: 12, tanks: 6 },
  ],
  zombieTypes: {
    grunt: {
      hp: 3,
      coinReward: 1,
      bodyWidth: 24,
      bodyHeight: 32,
      bodyColor: '#55aa55',
      headColor: '#66bb66',
      eyeColor: '#ffffff',
      headOffsetX: 0,
      armLength: 8,
      armLengthRight: 8,
      armOffsetY: 6,
      armThickness: 5,
    },
    mauler: {
      hp: 10,
      coinReward: 10,
      bodyWidth: 34,
      bodyHeight: 44,
      bodyColor: '#cc7700',
      headColor: '#dd8800',
      eyeColor: '#ffff00',
      headOffsetX: -4,
      armLength: 10,
      armLengthRight: 16,
      armOffsetY: 8,
      armThickness: 6,
    },
    tank: {
      hp: 100,
      coinReward: 50,
      bodyWidth: 52,
      bodyHeight: 52,
      bodyColor: '#aa2222',
      headColor: '#bb3333',
      eyeColor: '#ffaaaa',
      headOffsetX: 0,
      armLength: 14,
      armLengthRight: 14,
      armOffsetY: 4,
      armThickness: 10,
    },
  },
  spawnInterval: 1500,
  zombieSpeed: 80,
  bulletSpeed: 420,
};

const STATE_TITLE = 'STATE_TITLE';
const STATE_WAVE_WAIT = 'STATE_WAVE_WAIT';
const STATE_PLAYING = 'STATE_PLAYING';
const STATE_QUESTION = 'STATE_QUESTION';
const STATE_VICTORY = 'STATE_VICTORY';
const STATE_DEFEAT = 'STATE_DEFEAT';

let canvas = null;
let ctx = null;

let gameState = STATE_TITLE;
let playerLane = 1;
let playerDisplayX = laneCenter(1);
let muzzleFlashTimer = 0;
let coins = 0;
let currentGun = 0;
let fireUpgradeTier = 0;
let currentWave = 1;
let zombies = [];
let bullets = [];
let spawnQueue = [];
let waveStartTime = 0;
let allSpawned = false;
let lastFireTime = 0;
let lastTimestamp = 0;
let animFrameId = null;
let pendingGunIndex = -1;
let defeatFlashTimer = 0;
let audioCtx = null;

function init() {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');

  initEventListeners();
  updateHUD();
  renderScaffold();
  lastTimestamp = performance.now();
  animFrameId = requestAnimationFrame(gameLoop);

  console.info('Zombie Lane Defense initialized.');
}

function initEventListeners() {
  document.getElementById('btn-play').addEventListener('click', startGame);
  document.getElementById('btn-start-wave').addEventListener('click', startWave);
  document.getElementById('btn-fire-upgrade').addEventListener('click', buyFireUpgrade);
  document.getElementById('btn-gun-unlock').addEventListener('click', triggerGunUnlock);
  document.getElementById('btn-submit-answer').addEventListener('click', checkAnswer);
  document.getElementById('answer-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      checkAnswer();
    }
  });
  document.getElementById('btn-retry').addEventListener('click', resetGame);
  document.addEventListener('keydown', handleMovement);
}

function renderScaffold() {
  if (!ctx) return;

  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);

  for (let i = 0; i < CONFIG.canvas.laneCount; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#202020' : '#181818';
    ctx.fillRect(i * CONFIG.canvas.laneWidth, 0, CONFIG.canvas.laneWidth, CONFIG.canvas.height);
  }

  ctx.fillStyle = 'rgba(0, 170, 255, 0.07)';
  ctx.fillRect(playerLane * CONFIG.canvas.laneWidth, 0, CONFIG.canvas.laneWidth, CONFIG.canvas.height);

  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2;
  for (let lane = 1; lane < CONFIG.canvas.laneCount; lane++) {
    const x = lane * CONFIG.canvas.laneWidth;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CONFIG.canvas.height);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.strokeStyle = '#555';
  ctx.beginPath();
  ctx.moveTo(0, 520);
  ctx.lineTo(CONFIG.canvas.width, 520);
  ctx.stroke();
}

function gameLoop(timestamp) {
  const dt = Math.min(timestamp - lastTimestamp, 50);
  lastTimestamp = timestamp;

  if (gameState === STATE_PLAYING) {
    update(dt, timestamp);
  }

  render(dt);
  animFrameId = requestAnimationFrame(gameLoop);
}

function update(dt, timestamp) {
  void dt;
  void timestamp;
}

function render(dt) {
  void dt;
  renderScaffold();
}

function startGame() {
  gameState = STATE_WAVE_WAIT;
  hideAllOverlays();
  showOverlay('overlay-wave-wait');
  updateHUD();
  console.info('startGame called');
}

function startWave() {
  gameState = STATE_PLAYING;
  hideAllOverlays();
  updateHUD();
  console.info('startWave called');
}

function endWave() {
  console.info('endWave called');
}

function enterDefeat() {
  gameState = STATE_DEFEAT;
  hideAllOverlays();
  showOverlay('overlay-defeat');
  updateHUD();
  console.info('enterDefeat called');
}

function buyFireUpgrade() {
  console.info('buyFireUpgrade called');
}

function triggerGunUnlock() {
  gameState = STATE_QUESTION;
  pendingGunIndex = currentGun + 1;
  hideAllOverlays();
  showOverlay('overlay-question');
  updateHUD();
  console.info('triggerGunUnlock called');
}

function checkAnswer() {
  console.info('checkAnswer called');
}

function resetGame() {
  gameState = STATE_WAVE_WAIT;
  playerLane = 1;
  playerDisplayX = laneCenter(1);
  coins = 0;
  currentGun = 0;
  fireUpgradeTier = 0;
  currentWave = 1;
  zombies = [];
  bullets = [];
  spawnQueue = [];
  waveStartTime = 0;
  allSpawned = false;
  lastFireTime = 0;
  pendingGunIndex = -1;
  muzzleFlashTimer = 0;
  defeatFlashTimer = 0;
  hideAllOverlays();
  showOverlay('overlay-wave-wait');
  updateHUD();
  console.info('resetGame called');
}

function handleMovement(event) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  console.info('handleMovement called');
}

function updateHUD() {
  document.getElementById('hud-wave').textContent = `Wave: ${currentWave} / ${CONFIG.waveConfigs.length}`;
  document.getElementById('hud-coins').textContent = `Coins: ${coins}`;
  document.getElementById('hud-gun').textContent = `Gun: ${CONFIG.guns[currentGun].name}`;
  document.getElementById('hud-tier').textContent = `Fire Tier: ${fireUpgradeTier} / 3`;
  updateUpgradeButtons();
}

function updateUpgradeButtons() {
  const frBtn = document.getElementById('btn-fire-upgrade');
  const gunBtn = document.getElementById('btn-gun-unlock');
  const inQuestion = gameState === STATE_QUESTION;

  if (fireUpgradeTier < CONFIG.fireUpgradeCosts.length) {
    frBtn.disabled = inQuestion || coins < CONFIG.fireUpgradeCosts[fireUpgradeTier];
    frBtn.textContent = `Buy Fire Rate (${CONFIG.fireUpgradeCosts[fireUpgradeTier]}c)`;
  } else {
    frBtn.disabled = true;
    frBtn.textContent = 'Fire Rate MAX';
  }

  if (currentGun < CONFIG.guns.length - 1) {
    const nextIdx = currentGun + 1;
    gunBtn.disabled = inQuestion || coins < CONFIG.gunUnlockCosts[nextIdx];
    gunBtn.textContent = `Unlock ${CONFIG.guns[nextIdx].name} (${CONFIG.gunUnlockCosts[nextIdx]}c)`;
  } else {
    gunBtn.disabled = true;
    gunBtn.textContent = 'Max Gun';
  }
}

function showOverlay(id) {
  document.getElementById(id).classList.remove('hidden');
}

function hideOverlay(id) {
  document.getElementById(id).classList.add('hidden');
}

function hideAllOverlays() {
  const overlayIds = [
    'overlay-title',
    'overlay-wave-wait',
    'overlay-question',
    'overlay-victory',
    'overlay-defeat',
  ];

  overlayIds.forEach(hideOverlay);
}

function laneCenter(lane) {
  return lane * CONFIG.canvas.laneWidth + CONFIG.canvas.laneWidth / 2;
}

document.addEventListener('DOMContentLoaded', init);
