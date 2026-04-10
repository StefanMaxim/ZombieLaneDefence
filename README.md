# Zombie Lane Defense

Zombie Lane Defense is a self-contained browser game built with vanilla HTML, CSS, and JavaScript. Rendering is done with the HTML5 Canvas 2D API. There is no build step and no external assets, so the project can be served directly from a static host such as GitHub Pages.

## Run locally

You can either:

1. Open `index.html` directly in a browser, or
2. Serve the folder with any simple static server

Examples:

```bash
python3 -m http.server
```

Then open `http://localhost:8000/`.

## Controls

- `ArrowLeft` / `ArrowRight`: move between lanes
- `Play`: start a new run
- `Start Wave N`: begin the next wave
- `Buy Fire Rate`: purchase the next fire-rate tier for the current gun
- `Unlock <Gun>`: open the question overlay to unlock the next gun between waves
- `Enter` in the answer field: submit the gun-unlock answer

## Gameplay progression

- The game has 10 waves.
- The run is structured into 3-wave upgrade blocks:
  - Waves 1-3: Gun 1 progression
  - Waves 4-6: Gun 2 progression
  - Waves 7-9: Gun 3 progression and endgame ramp
  - Wave 10: staged boss finale
- Gun unlocks require both enough coins and a correct answer.
- Fire-rate upgrades only require coins.
- In the default Wave 10 `bossFinale` setup, the Tank spawns last and victory triggers immediately when it dies.

## Editing questions and answers

Question content lives in the top-level `CONFIG` object in `script.js`.

Edit:

- `CONFIG.gunQuestions`

Example structure:

```js
gunQuestions: [
  null,
  { question: 'What is the powerhouse of the cell?', answer: 'mitochondria' },
  { question: 'What does CPU stand for?', answer: 'central processing unit' },
]
```

Answers are matched case-insensitively after trimming whitespace.

## Editing waves and pacing

Wave composition and spawn pacing also live in the top-level `CONFIG` object in `script.js`.

Edit:

- `CONFIG.waveConfigs`

Each wave entry contains:

- `grunts`
- `maulers`
- `tanks`
- `spawnInterval`

Example:

```js
{ grunts: 8, maulers: 0, tanks: 0, spawnInterval: 1950 }
```

Important balance rules from the spec:

- Tank appears only in Wave 10 by default
- Wave 10 uses `bossFinale: true` by default so the Tank is the climax, not the start of a cleanup phase
- Early waves are intentionally slower and easier to read
- Waves 7-9 are the real endgame ramp
- Spawn pacing ramps down gradually across the run because each wave owns its own `spawnInterval`

## Editing upgrades and balance

The main progression knobs are:

- `CONFIG.guns`
- `CONFIG.fireUpgradeCosts`
- `CONFIG.gunUnlockCosts`
- `CONFIG.zombieTypes`
- `CONFIG.zombieSpeed`
- `CONFIG.bulletSpeed`

Relevant examples:

```js
fireUpgradeCosts: [8, 14, 22]
gunUnlockCosts: [0, 25, 40]
```

`CONFIG.guns` controls the base fire interval and upgrade intervals for:

- `Pistol`
- `SMG`
- `Railgun`

`CONFIG.zombieTypes` controls HP, coin reward, and sprite dimensions/colors for:

- `grunt`
- `mauler`
- `tank`

## Project structure

- `index.html`: shell, canvas, HUD, overlays
- `style.css`: layout and UI styling
- `script.js`: game logic, state, rendering, input, audio
- `README.md`: usage and deployment notes

## GitHub Pages deployment

This project uses only relative paths:

- `href="style.css"`
- `src="script.js"`

That means it works from a repository subdirectory such as:

`https://user.github.io/ZombieLaneDefence/`

To deploy:

1. Push the repository to `main`
2. Open repository `Settings > Pages`
3. Set source to `main`
4. Set the published folder to `/` (repository root)

## Verification notes

Static verification completed:

- `script.js` parses with `node --check`
- Paths are relative for GitHub Pages compatibility

Manual gameplay verification still matters for:

- full 10-wave completion time
- feel of upgrade checkpoints at waves 3, 6, and 9
- whether waves 7-9 produce the intended endgame pressure
- final boss fairness in wave 10, especially the Tank-last boss finale
- visual polish confirmation across the whole run
