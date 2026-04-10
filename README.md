# Zombie Lane Defense

Self-contained browser game scaffold for an HTML5 Canvas lane-defense game. This repository is implemented in milestones from `SPEC.md`; the current state is Milestone 9 only.

## Current Milestone

Milestones completed:

- `index.html` with the canvas, HUD sidebar, and all required overlay elements.
- `style.css` with the page layout, overlay visibility rules, button states, and HUD styling.
- `script.js` with the top-level `CONFIG` object, state constants, core state variables, DOM initialization, HUD syncing, overlay helpers, static lane rendering, the player sprite, keyboard lane movement, the bullet firing loop, zombie spawning/movement/rendering, collision/combat checks, wave flow, and fire-rate upgrade purchases.
- `README.md` with project and deployment notes.

Gun unlock questions and full reset polish are intentionally not implemented yet.

## Run Locally

Open `index.html` directly in a browser. There is no build step, package manager, server, framework, CDN, or external asset dependency.

## Editing Config

All tunable values are grouped in the top-level `CONFIG` object in `script.js`.

- Edit `CONFIG.gunQuestions` to change gun unlock questions and accepted answers.
- Edit `CONFIG.waveConfigs` to change enemy counts and per-wave spawn pacing.
- Edit `CONFIG.guns`, `CONFIG.fireUpgradeCosts`, and `CONFIG.gunUnlockCosts` to tune upgrade progression.
- Edit `CONFIG.zombieTypes` to tune zombie health, rewards, colors, and sprite dimensions.
- Edit `CONFIG.zombieSpeed` and `CONFIG.bulletSpeed` for movement pacing values.

## GitHub Pages

All project paths are relative:

- `style.css` is loaded with `href="style.css"`.
- `script.js` is loaded with `src="script.js"`.

To deploy from GitHub Pages:

1. Push the repository to `main`.
2. Open repository Settings > Pages.
3. Set Source to `main`.
4. Set the served folder to `/` for the repository root.

The page will work from a repository subdirectory URL such as `https://user.github.io/ZombieLaneDefence/`.
