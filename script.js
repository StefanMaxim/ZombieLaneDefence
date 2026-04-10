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
    pavementY: 520,
    backgroundColor: '#1a1a1a',
    laneColors: ['#202020', '#181818'],
    laneHighlightColor: 'rgba(0, 170, 255, 0.07)',
    dividerColor: '#444',
    pavementColor: '#555',
  },
  player: {
    bodyWidth: 30,
    bodyHeight: 40,
    bodyColor: '#00aaff',
    gunWidth: 6,
    gunHeight: 16,
    gunY: 466,
    gunColor: '#ffffff',
    eyeWidth: 5,
    eyeHeight: 5,
    eyeY: 485,
    leftEyeXOffset: -8,
    rightEyeXOffset: 3,
    eyeColor: '#002244',
    muzzleFlashY: 464,
    muzzleFlashOuterRadius: 5,
    muzzleFlashInnerRadius: 2.5,
    muzzleFlashOuterColor: '#ffffaa',
    muzzleFlashInnerColor: '#ffffff',
    laneLerpFactor: 0.015,
  },
  bullet: {
    damage: 1,
    width: 4,
    height: 10,
    trailHeight: 8,
    trailOffsetY: 10,
    spawnY: 454,
    trailColor: 'rgba(255, 255, 100, 0.35)',
    leadColor: '#ffff44',
    muzzleFlashDuration: 80,
  },
  zombieVisuals: {
    spawnFadeRate: 0.003,
    bobRate: 0.003,
    bobAmplitude: 2,
    hitFlashColor: '#ffffff',
    outlineColor: '#000000',
    healthBackColor: '#333333',
    healthHighColor: '#00cc44',
    healthMidColor: '#eeaa00',
    healthLowColor: '#cc2222',
    healthBarHeight: 4,
    healthBarExtraWidth: 8,
    healthBarYOffset: 8,
    healthBarHeadScale: 1.4,
    healthHighThreshold: 0.5,
    healthMidThreshold: 0.25,
    headRadiusScale: 0.38,
    headYOffsetScale: 0.6,
    eyeYOffsetScale: 0.15,
    leftEyeXScale: 0.5,
    rightEyeXScale: 0.1,
    eyeSizeScale: 0.3,
    tankLegWidth: 12,
    tankLegHeight: 8,
    tankLeftLegXOffset: 4,
    tankRightLegXOffset: 16,
    shakeAmount: 2,
    hitFlashDuration: 100,
  },
  guns: [
    { name: 'Pistol', baseInterval: 700, upgradeIntervals: [500, 350, 200] },
    { name: 'SMG', baseInterval: 180, upgradeIntervals: [140, 100, 70] },
    { name: 'Railgun', baseInterval: 60, upgradeIntervals: [45, 32, 20] },
  ],
  fireUpgradeCosts: [8, 14, 22],
  gunUnlockCosts: [0, 25, 40],
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
    { grunts: 8, maulers: 0, tanks: 0, spawnInterval: 1950 },
    { grunts: 6, maulers: 1, tanks: 0, spawnInterval: 1750 },
    { grunts: 10, maulers: 4, tanks: 0, spawnInterval: 1450 },
    { grunts: 10, maulers: 1, tanks: 0, spawnInterval: 1400 },
    { grunts: 8, maulers: 2, tanks: 0, spawnInterval: 1250 },
    { grunts: 8, maulers: 4, tanks: 0, spawnInterval: 1150 },
    { grunts: 6, maulers: 2, tanks: 0, spawnInterval: 1100 },
    { grunts: 8, maulers: 2, tanks: 0, spawnInterval: 1000 },
    { grunts: 10, maulers: 2, tanks: 0, spawnInterval: 900 },
    { grunts: 4, maulers: 2, tanks: 1, spawnInterval: 950, bossFinale: true },
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
let autoIncrementId = 1;

function init() {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');

  initEventListeners();
  updateHUD();
  render(0);
  lastTimestamp = performance.now();
  animFrameId = requestAnimationFrame(gameLoop);

  console.info('Zombie Lane Defense initialized.');
}

function initEventListeners() {
  document.getElementById('btn-play').addEventListener('click', () => {
    ensureAudio();
    startGame();
  });
  document.getElementById('btn-start-wave').addEventListener('click', () => {
    ensureAudio();
    startWave();
  });
  document.getElementById('btn-fire-upgrade').addEventListener('click', () => {
    ensureAudio();
    buyFireUpgrade();
  });
  document.getElementById('btn-gun-unlock').addEventListener('click', () => {
    ensureAudio();
    triggerGunUnlock();
  });
  document.getElementById('btn-submit-answer').addEventListener('click', () => {
    ensureAudio();
    checkAnswer();
  });
  document.getElementById('answer-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      ensureAudio();
      checkAnswer();
    }
  });
  document.getElementById('btn-retry').addEventListener('click', () => {
    ensureAudio();
    resetGame();
  });
  document.addEventListener('keydown', handleMovement);
}

function drawBackground() {
  if (!ctx) return;

  ctx.fillStyle = CONFIG.canvas.backgroundColor;
  ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);

  for (let i = 0; i < CONFIG.canvas.laneCount; i++) {
    ctx.fillStyle = CONFIG.canvas.laneColors[i % CONFIG.canvas.laneColors.length];
    ctx.fillRect(i * CONFIG.canvas.laneWidth, 0, CONFIG.canvas.laneWidth, CONFIG.canvas.height);
  }

  ctx.fillStyle = CONFIG.canvas.laneHighlightColor;
  ctx.fillRect(playerLane * CONFIG.canvas.laneWidth, 0, CONFIG.canvas.laneWidth, CONFIG.canvas.height);

  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = CONFIG.canvas.dividerColor;
  ctx.lineWidth = 2;
  for (let lane = 1; lane < CONFIG.canvas.laneCount; lane++) {
    const x = lane * CONFIG.canvas.laneWidth;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CONFIG.canvas.height);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.strokeStyle = CONFIG.canvas.pavementColor;
  ctx.beginPath();
  ctx.moveTo(0, CONFIG.canvas.pavementY);
  ctx.lineTo(CONFIG.canvas.width, CONFIG.canvas.pavementY);
  ctx.stroke();
}

function gameLoop(timestamp) {
  const dt = Math.min(timestamp - lastTimestamp, 50);
  lastTimestamp = timestamp;

  if (gameState === STATE_PLAYING) {
    update(dt, timestamp);
  }

  muzzleFlashTimer = Math.max(0, muzzleFlashTimer - dt);
  defeatFlashTimer = Math.max(0, defeatFlashTimer - dt);

  render(dt);
  animFrameId = requestAnimationFrame(gameLoop);
}

function update(dt, timestamp) {
  if (gameState !== STATE_PLAYING) return;

  const elapsed = performance.now() - waveStartTime;
  while (spawnQueue.length > 0 && spawnQueue[0].spawnAt <= elapsed) {
    const entry = spawnQueue.shift();
    spawnZombie(entry.type, entry.lane);
  }

  if (spawnQueue.length === 0) {
    allSpawned = true;
  }

  for (const zombie of zombies) {
    zombie.y += CONFIG.zombieSpeed * (dt / 1000);
    zombie.bobPhase += dt * CONFIG.zombieVisuals.bobRate;
    zombie.opacity = Math.min(1, zombie.opacity + dt * CONFIG.zombieVisuals.spawnFadeRate);
    zombie.flashTimer = Math.max(0, zombie.flashTimer - dt);

    if (zombie.flashTimer <= 0) {
      zombie.shakeOffset = null;
    } else {
      zombie.shakeOffset = {
        x: randomRange(-CONFIG.zombieVisuals.shakeAmount, CONFIG.zombieVisuals.shakeAmount),
        y: randomRange(-CONFIG.zombieVisuals.shakeAmount, CONFIG.zombieVisuals.shakeAmount),
      };
    }
  }

  if (timestamp - lastFireTime >= fireInterval()) {
    bullets.push({
      lane: playerLane,
      y: CONFIG.bullet.spawnY,
      dead: false,
    });
    lastFireTime = timestamp;
    muzzleFlashTimer = CONFIG.bullet.muzzleFlashDuration;
    playShotSound();
  }

  for (const bullet of bullets) {
    bullet.y -= CONFIG.bulletSpeed * (dt / 1000);
    if (bullet.y + CONFIG.bullet.height < 0) {
      bullet.dead = true;
    }
  }

  for (const bullet of bullets) {
    for (const zombie of zombies) {
      if (
        bullet.lane === zombie.lane &&
        bullet.y <= zombie.y + zombie.height &&
        bullet.y + CONFIG.bullet.height >= zombie.y &&
        !zombie.dead &&
        !bullet.dead
      ) {
        zombie.hp -= CONFIG.bullet.damage;
        zombie.flashTimer = CONFIG.zombieVisuals.hitFlashDuration;
        zombie.shakeOffset = {
          x: randomRange(-CONFIG.zombieVisuals.shakeAmount, CONFIG.zombieVisuals.shakeAmount),
          y: randomRange(-CONFIG.zombieVisuals.shakeAmount, CONFIG.zombieVisuals.shakeAmount),
        };
        bullet.dead = true;
        playHitSound();

        if (zombie.hp <= 0) {
          const waveConfig = CONFIG.waveConfigs[currentWave - 1];
          zombie.dead = true;
          coins += zombie.coinReward;
          playDeathSound();
          updateHUD();

          if (zombie.type === 'tank' && waveConfig.bossFinale) {
            endWave();
            return;
          }
        }
      }
    }
  }

  for (const zombie of zombies) {
    if (!zombie.dead && zombie.y + zombie.height >= CONFIG.canvas.playerY) {
      enterDefeat();
      return;
    }
  }

  bullets = bullets.filter((bullet) => !bullet.dead);
  zombies = zombies.filter((zombie) => !zombie.dead);

  if (allSpawned && zombies.length === 0) {
    endWave();
  }
}

function render(dt) {
  drawBackground();
  drawDefeatFlash();
  const sortedZombies = [...zombies].sort((a, b) => a.y - b.y);
  for (const zombie of sortedZombies) {
    drawZombie(ctx, zombie);
  }
  for (const bullet of bullets) {
    drawBullet(ctx, bullet);
  }
  drawPlayer(ctx, dt);
}

function drawDefeatFlash() {
  if (defeatFlashTimer <= 0) return;

  ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
  ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
}

function drawBullet(ctx, bullet) {
  const cx = laneCenter(bullet.lane);
  const halfWidth = CONFIG.bullet.width / 2;

  ctx.fillStyle = CONFIG.bullet.trailColor;
  ctx.fillRect(
    cx - halfWidth,
    bullet.y + CONFIG.bullet.trailOffsetY,
    CONFIG.bullet.width,
    CONFIG.bullet.trailHeight
  );

  ctx.fillStyle = CONFIG.bullet.leadColor;
  ctx.fillRect(cx - halfWidth, bullet.y, CONFIG.bullet.width, CONFIG.bullet.height);
}

function drawZombie(ctx, zombie) {
  const shakeX = zombie.shakeOffset ? zombie.shakeOffset.x : 0;
  const shakeY = zombie.shakeOffset ? zombie.shakeOffset.y : 0;
  const cx = laneCenter(zombie.lane) + shakeX;
  const ty = zombie.y + shakeY + Math.sin(zombie.bobPhase) * CONFIG.zombieVisuals.bobAmplitude;
  const halfWidth = zombie.bodyWidth / 2;
  const bodyColor = zombie.flashTimer > 0 ? CONFIG.zombieVisuals.hitFlashColor : zombie.bodyColor;
  const headColor = zombie.flashTimer > 0 ? CONFIG.zombieVisuals.hitFlashColor : zombie.headColor;

  ctx.globalAlpha = Math.min(1, zombie.opacity);

  ctx.fillStyle = bodyColor;
  ctx.fillRect(cx - halfWidth, ty, zombie.bodyWidth, zombie.bodyHeight);
  ctx.strokeStyle = CONFIG.zombieVisuals.outlineColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - halfWidth, ty, zombie.bodyWidth, zombie.bodyHeight);

  const headRadius = zombie.bodyWidth * CONFIG.zombieVisuals.headRadiusScale;
  ctx.fillStyle = headColor;
  ctx.beginPath();
  ctx.arc(cx + zombie.headOffsetX, ty - headRadius * CONFIG.zombieVisuals.headYOffsetScale, headRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = CONFIG.zombieVisuals.outlineColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  const eyeY = ty
    - headRadius * CONFIG.zombieVisuals.headYOffsetScale
    - headRadius * CONFIG.zombieVisuals.eyeYOffsetScale;
  ctx.fillStyle = zombie.eyeColor;
  ctx.fillRect(
    cx + zombie.headOffsetX - headRadius * CONFIG.zombieVisuals.leftEyeXScale,
    eyeY,
    headRadius * CONFIG.zombieVisuals.eyeSizeScale,
    headRadius * CONFIG.zombieVisuals.eyeSizeScale
  );
  ctx.fillRect(
    cx + zombie.headOffsetX + headRadius * CONFIG.zombieVisuals.rightEyeXScale,
    eyeY,
    headRadius * CONFIG.zombieVisuals.eyeSizeScale,
    headRadius * CONFIG.zombieVisuals.eyeSizeScale
  );

  ctx.fillStyle = bodyColor;
  ctx.fillRect(
    cx - halfWidth - zombie.armLength,
    ty + zombie.armOffsetY,
    zombie.armLength,
    zombie.armThickness
  );
  ctx.fillRect(cx + halfWidth, ty + zombie.armOffsetY, zombie.armLengthRight, zombie.armThickness);

  if (zombie.type === 'tank') {
    ctx.fillRect(
      cx - halfWidth + CONFIG.zombieVisuals.tankLeftLegXOffset,
      ty + zombie.bodyHeight,
      CONFIG.zombieVisuals.tankLegWidth,
      CONFIG.zombieVisuals.tankLegHeight
    );
    ctx.fillRect(
      cx + halfWidth - CONFIG.zombieVisuals.tankRightLegXOffset,
      ty + zombie.bodyHeight,
      CONFIG.zombieVisuals.tankLegWidth,
      CONFIG.zombieVisuals.tankLegHeight
    );
  }

  const barY = ty
    - headRadius * CONFIG.zombieVisuals.healthBarHeadScale
    - CONFIG.zombieVisuals.healthBarYOffset;
  const barWidth = zombie.bodyWidth + CONFIG.zombieVisuals.healthBarExtraWidth;
  const healthRatio = zombie.hp / zombie.maxHp;
  ctx.fillStyle = CONFIG.zombieVisuals.healthBackColor;
  ctx.fillRect(cx - barWidth / 2, barY, barWidth, CONFIG.zombieVisuals.healthBarHeight);
  ctx.fillStyle = healthRatio > CONFIG.zombieVisuals.healthHighThreshold
    ? CONFIG.zombieVisuals.healthHighColor
    : healthRatio > CONFIG.zombieVisuals.healthMidThreshold
      ? CONFIG.zombieVisuals.healthMidColor
      : CONFIG.zombieVisuals.healthLowColor;
  ctx.fillRect(cx - barWidth / 2, barY, barWidth * healthRatio, CONFIG.zombieVisuals.healthBarHeight);

  ctx.globalAlpha = 1;
}

function drawPlayer(ctx, dt) {
  const targetX = laneCenter(playerLane);
  playerDisplayX += (targetX - playerDisplayX) * Math.min(1, dt * CONFIG.player.laneLerpFactor);
  const cx = playerDisplayX;
  const playerTop = CONFIG.canvas.playerY;
  const halfBodyWidth = CONFIG.player.bodyWidth / 2;

  ctx.fillStyle = CONFIG.player.bodyColor;
  ctx.fillRect(cx - halfBodyWidth, playerTop, CONFIG.player.bodyWidth, CONFIG.player.bodyHeight);

  ctx.fillStyle = CONFIG.player.gunColor;
  ctx.fillRect(cx - CONFIG.player.gunWidth / 2, CONFIG.player.gunY, CONFIG.player.gunWidth, CONFIG.player.gunHeight);

  ctx.fillStyle = CONFIG.player.eyeColor;
  ctx.fillRect(cx + CONFIG.player.leftEyeXOffset, CONFIG.player.eyeY, CONFIG.player.eyeWidth, CONFIG.player.eyeHeight);
  ctx.fillRect(cx + CONFIG.player.rightEyeXOffset, CONFIG.player.eyeY, CONFIG.player.eyeWidth, CONFIG.player.eyeHeight);

  if (muzzleFlashTimer > 0) {
    ctx.fillStyle = CONFIG.player.muzzleFlashOuterColor;
    ctx.beginPath();
    ctx.arc(cx, CONFIG.player.muzzleFlashY, CONFIG.player.muzzleFlashOuterRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = CONFIG.player.muzzleFlashInnerColor;
    ctx.beginPath();
    ctx.arc(cx, CONFIG.player.muzzleFlashY, CONFIG.player.muzzleFlashInnerRadius, 0, Math.PI * 2);
    ctx.fill();
  }
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
  zombies = [];
  bullets = [];
  spawnQueue = buildSpawnQueue(currentWave - 1);
  waveStartTime = performance.now();
  allSpawned = false;
  lastFireTime = 0;
  hideAllOverlays();
  updateHUD();
  console.info('startWave called');
}

function endWave() {
  if (currentWave === CONFIG.waveConfigs.length) {
    gameState = STATE_VICTORY;
    hideAllOverlays();
    showOverlay('overlay-victory');
  } else {
    currentWave++;
    gameState = STATE_WAVE_WAIT;
    document.getElementById('wave-wait-text').textContent = `Wave ${currentWave} incoming!`;
    document.getElementById('btn-start-wave').textContent = `Start Wave ${currentWave}`;
    hideAllOverlays();
    showOverlay('overlay-wave-wait');
    updateHUD();
  }
}

function enterDefeat() {
  gameState = STATE_DEFEAT;
  defeatFlashTimer = 300;
  hideAllOverlays();
  showOverlay('overlay-defeat');
  updateHUD();
  console.info('enterDefeat called');
}

function buyFireUpgrade() {
  if (!canBuyFireRate()) return;

  coins -= CONFIG.fireUpgradeCosts[fireUpgradeTier];
  fireUpgradeTier++;
  updateHUD();
}

function triggerGunUnlock() {
  if (gameState !== STATE_WAVE_WAIT || !canUnlockGun()) return;

  pendingGunIndex = currentGun + 1;
  gameState = STATE_QUESTION;
  document.getElementById('question-text').textContent = CONFIG.gunQuestions[pendingGunIndex].question;
  document.getElementById('answer-input').value = '';
  document.getElementById('question-error').classList.add('hidden');
  hideAllOverlays();
  showOverlay('overlay-question');
  updateHUD();
  document.getElementById('answer-input').focus();
  console.info('triggerGunUnlock called');
}

function checkAnswer() {
  if (pendingGunIndex < 0) return;

  const answerInput = document.getElementById('answer-input');
  const errorEl = document.getElementById('question-error');
  const expectedAnswer = CONFIG.gunQuestions[pendingGunIndex].answer;

  if (normalizeAnswer(answerInput.value) === normalizeAnswer(expectedAnswer)) {
    coins -= CONFIG.gunUnlockCosts[pendingGunIndex];
    currentGun = pendingGunIndex;
    fireUpgradeTier = 0;
    pendingGunIndex = -1;
    gameState = STATE_WAVE_WAIT;
    hideAllOverlays();
    showOverlay('overlay-wave-wait');
    updateHUD();
    return;
  }

  errorEl.textContent = 'Incorrect — please try again.';
  errorEl.classList.remove('hidden');
  answerInput.focus();
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
  document.getElementById('wave-wait-text').textContent = 'Wave 1 incoming!';
  document.getElementById('btn-start-wave').textContent = 'Start Wave 1';
  document.getElementById('answer-input').value = '';
  document.getElementById('question-error').classList.add('hidden');
  showOverlay('overlay-wave-wait');
  updateHUD();
  console.info('resetGame called');
}

function handleMovement(event) {
  if (gameState !== STATE_PLAYING && gameState !== STATE_WAVE_WAIT) return;

  if (event.key === 'ArrowLeft' && playerLane > 0) {
    playerLane--;
  }

  if (event.key === 'ArrowRight' && playerLane < CONFIG.canvas.laneCount - 1) {
    playerLane++;
  }
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
  const inWaveWait = gameState === STATE_WAVE_WAIT;

  if (fireUpgradeTier < CONFIG.fireUpgradeCosts.length) {
    frBtn.disabled = inQuestion || coins < CONFIG.fireUpgradeCosts[fireUpgradeTier];
    frBtn.textContent = `Buy Fire Rate (${CONFIG.fireUpgradeCosts[fireUpgradeTier]}c)`;
  } else {
    frBtn.disabled = true;
    frBtn.textContent = 'Fire Rate MAX';
  }

  if (currentGun < CONFIG.guns.length - 1) {
    const nextIdx = currentGun + 1;
    gunBtn.disabled = !inWaveWait || inQuestion || coins < CONFIG.gunUnlockCosts[nextIdx];
    gunBtn.textContent = `Unlock ${CONFIG.guns[nextIdx].name} (${CONFIG.gunUnlockCosts[nextIdx]}c)`;
  } else {
    gunBtn.disabled = true;
    gunBtn.textContent = 'Max Gun';
  }
}

function canBuyFireRate() {
  return fireUpgradeTier < CONFIG.fireUpgradeCosts.length &&
    coins >= CONFIG.fireUpgradeCosts[fireUpgradeTier];
}

function canUnlockGun() {
  return gameState === STATE_WAVE_WAIT &&
    currentGun < CONFIG.guns.length - 1 &&
    coins >= CONFIG.gunUnlockCosts[currentGun + 1];
}

function normalizeAnswer(value) {
  return value.trim().toLowerCase();
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

function spawnZombie(type, lane) {
  const zombieConfig = CONFIG.zombieTypes[type];
  zombies.push({
    id: autoIncrementId++,
    type,
    hp: zombieConfig.hp,
    maxHp: zombieConfig.hp,
    lane,
    y: CONFIG.canvas.zombieSpawnY,
    coinReward: zombieConfig.coinReward,
    dead: false,
    bodyWidth: zombieConfig.bodyWidth,
    bodyHeight: zombieConfig.bodyHeight,
    height: zombieConfig.bodyHeight,
    bodyColor: zombieConfig.bodyColor,
    headColor: zombieConfig.headColor,
    eyeColor: zombieConfig.eyeColor,
    headOffsetX: zombieConfig.headOffsetX,
    armLength: zombieConfig.armLength,
    armLengthRight: zombieConfig.armLengthRight,
    armOffsetY: zombieConfig.armOffsetY,
    armThickness: zombieConfig.armThickness,
    opacity: 0,
    bobPhase: Math.random() * Math.PI * 2,
    flashTimer: 0,
    shakeOffset: null,
  });
}

function buildSpawnQueue(waveIndex) {
  const waveConfig = CONFIG.waveConfigs[waveIndex];
  const types = [];
  const tanks = [];

  for (let i = 0; i < waveConfig.grunts; i++) types.push('grunt');
  for (let i = 0; i < waveConfig.maulers; i++) types.push('mauler');
  for (let i = 0; i < waveConfig.tanks; i++) tanks.push('tank');

  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }

  const orderedTypes = [...types, ...tanks];

  return orderedTypes.map((type, index) => ({
    type,
    lane: Math.floor(Math.random() * CONFIG.canvas.laneCount),
    spawnAt: index * waveConfig.spawnInterval,
  }));
}

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function fireInterval() {
  if (fireUpgradeTier === 0) return CONFIG.guns[currentGun].baseInterval;
  return CONFIG.guns[currentGun].upgradeIntervals[fireUpgradeTier - 1];
}

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playShotSound() {
  ensureAudio();

  const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.08, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);

  source.connect(gain);
  gain.connect(audioCtx.destination);
  source.start();
}

function playHitSound() {
  ensureAudio();

  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(180, audioCtx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 0.06);
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);

  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + 0.06);
}

function playDeathSound() {
  ensureAudio();

  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  oscillator.type = 'sawtooth';
  oscillator.frequency.setValueAtTime(220, audioCtx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(55, audioCtx.currentTime + 0.18);
  gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);

  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + 0.18);
}

document.addEventListener('DOMContentLoaded', init);
