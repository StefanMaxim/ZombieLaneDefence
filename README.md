# Zombie Lane Defense

Zombie Lane Defense is a self-contained browser game built with vanilla HTML, CSS, and JavaScript. Rendering is done with the HTML5 Canvas 2D API. There is no build step and no external assets, so the project can be served directly from a static host such as GitHub Pages.

The game also includes a looping soundtrack loaded from a local MP3 in the project root: `91476_Glorious_morning.mp3`.

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

## How to Tweak Difficulty

All wave and balance settings live in `script.js` inside the `CONFIG` object near the top of the file. There are two levels of tuning: **per-wave settings** and **global settings**.

### Per-wave settings — `CONFIG.waveConfigs`

Each entry in the array controls one wave. The fields are:

| Field | What it does | To make the wave **easier** | To make the wave **harder** |
|-------|-------------|-----------------------------|-----------------------------|
| `grunts` | Number of grunt zombies (3 HP, 1 coin each) | Decrease | Increase |
| `maulers` | Number of mauler zombies (10 HP, 10 coins each) | Decrease | Increase — maulers add far more HP pressure than grunts |
| `tanks` | Number of tank zombies (100 HP, 50 coins each) | Keep at 0 except Wave 10 | — |
| `spawnInterval` | Milliseconds between zombie spawns | Increase (e.g. 2000) | Decrease (e.g. 800) — more zombies visible at once |
| `zombieSpeedMultiplier` | Multiplies the global `zombieSpeed` for this wave only | Decrease below 1.0 (e.g. 0.8) | Increase above 1.0 (e.g. 1.3) |
| `bossFinale` | Victory triggers immediately when the Tank dies | — | — (pacing flag, not a difficulty lever) |
| `tankSpawnsLast` | When `true`, Tank spawns after all escort enemies | — | Set `false` to shuffle Tank among the escort |
| `label` | Short name for the wave — shown in comments only, no gameplay effect | — | — |
| `notes` | Free-text note to yourself — no gameplay effect | — | — |

**Which fields to tweak first:**

1. `spawnInterval` — the safest and most predictable knob. Raising it gives more breathing room between spawns; lowering it creates pressure by stacking zombies on screen.
2. `zombieSpeedMultiplier` — use values between 0.7 and 1.4. Below 0.7 makes zombies crawl; above 1.5 makes them hard to read visually.
3. `grunts` / `maulers` counts — adding one mauler raises HP pressure roughly as much as adding three grunts.

**Recommended manual balancing workflow:**

1. Play the wave once and note where you died or where it felt trivial.
2. Zombies reached you too fast → increase `spawnInterval` or decrease `zombieSpeedMultiplier`.
3. Wave felt trivial → decrease `spawnInterval` or swap a grunt for a mauler.
4. Reload the browser (no build step needed) and replay from that wave.
5. Repeat until the wave feels right.

**Rules to preserve:**

- Keep tanks only in Wave 10. A tank in an earlier wave breaks the boss-finale pacing.
- Keep `bossFinale: true` on Wave 10. Without it, the player must clean up escort enemies after the Tank dies — anticlimactic.
- Waves 7–9 should feel meaningfully harder than Waves 4–6. Don't ease them too much.

### Global settings — also in `CONFIG`

These affect every wave at once:

| Setting | What it does |
|---------|-------------|
| `zombieSpeed` | Base zombie speed in pixels/second. `zombieSpeedMultiplier` in each wave entry multiplies this. |
| `bulletSpeed` | How fast bullets travel up the screen. |
| `guns[].intervals` | Fire-rate tables (ms between shots) for Pistol, SMG, Railgun. Lower = faster. |
| `fireUpgradeCosts` | Coin costs for fire-rate tiers 1, 2, 3 (array of three numbers). |
| `gunUnlockCosts` | Coin costs to unlock SMG and Railgun. |
| `zombieTypes` | HP, coin reward, and sprite properties for `grunt`, `mauler`, `tank`. |

To slow all zombies globally, lower `zombieSpeed`. For per-wave variation, leave `zombieSpeed` as-is and use `zombieSpeedMultiplier` in the individual wave entries instead.

## Project structure

- `index.html`: shell, canvas, HUD, overlays
- `style.css`: layout and UI styling
- `script.js`: game logic, state, rendering, input, audio
- `README.md`: usage and deployment notes

## Soundtrack

The background music is configured in the top-level `CONFIG.soundtrack` block in `script.js`:

```js
soundtrack: {
  src: '91476_Glorious_morning.mp3',
  loop: true,
  volume: 0.45,
}
```

To replace the music later:

1. Put the new audio file in the project root
2. Change `CONFIG.soundtrack.src` to the exact filename, including extension
3. Adjust `volume` if needed

Browser autoplay rules may block music before the first user gesture. The game works around that by starting the soundtrack on the first valid interaction such as `Play`, `Start Wave`, `Buy Fire Rate`, `Unlock Gun`, `Submit`, or `Try Again`. After that first interaction, the track keeps looping across title, gameplay, wave transitions, question prompts, victory, and defeat.

GitHub Pages troubleshooting:

- Keep the soundtrack path relative, for example `src: '91476_Glorious_morning.mp3'`
- The filename is case-sensitive on GitHub Pages and must match the real file exactly
- If playback fails, open the browser console and look for `Soundtrack failed to load.` or `Soundtrack playback failed.` logs, which include both the configured filename and the resolved URL

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
