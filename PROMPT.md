# Zombie Lane Defense — SPEC.md

## Feature summary

This project is a self-contained browser game intended to supplement a class presentation. The game will be hosted from a GitHub Pages site and must run entirely in the browser with no backend, no external downloads at runtime beyond standard page assets, and no required art packs or additional setup by the player.

The core gameplay loop is lane-based survival. The player controls a character positioned near the bottom of the screen and can move horizontally between three lanes using the keyboard arrow keys. Zombies continuously spawn in the three lanes and move toward the player at a constant walking speed. The player automatically fires upward along their current lane. If a zombie reaches the player, the game immediately ends in defeat. If the player survives all ten waves, the game ends in victory.

The game includes progression through coins, fire-rate upgrades, and gun unlocks. Coins are awarded when zombies are killed. Fire-rate upgrades are purchased with coins and are capped at three upgrades per gun. There are three guns total. Unlocking a new gun requires the player to answer a presentation-related question correctly. Once a new gun is unlocked, the fire-rate cap is effectively reset, allowing another three fire-rate upgrades for that gun.

The game flow must include a title screen, explicit wave-start buttons between waves, gameplay, question prompts for gun unlocks, a victory screen, and a defeat screen with a retry option.

The implementation must be simple to host under a directory on a GitHub Pages site and must not depend on a server process.

## Hard constraints

### Platform and deployment

The game must run fully in the browser as a static site.

The game must be hostable from a subdirectory on GitHub Pages.

The implementation must not require a backend, database, authentication flow, build server, or runtime API.

The implementation must not require downloadable art assets, sprite packs, sound packs, or fonts that are necessary for functionality. The game must remain fully playable using only HTML, CSS, and JavaScript-generated visuals or embedded assets already included in the repository.

The implementation should prefer plain HTML, CSS, and JavaScript, or another approach that produces a static client-only output suitable for GitHub Pages. If a framework is used, the committed output must still be deployable as a static site.

The game must be playable on a desktop browser with keyboard input.

### Screen and layout

The game must have exactly three lanes.

The player must occupy exactly one lane at a time.

The player must move left and right between lanes using the left and right arrow keys.

The street or playfield must visually communicate the three-lane structure clearly.

The player must appear near the bottom of the play area.

Zombies must spawn above the player and move downward toward the player.

The UI must include visible controls or status indicators for at least the following: current wave, current coins, current gun, current fire-rate upgrade tier for the current gun, and upgrade buttons.

### Core gameplay

There must be exactly three zombie types:

Grunt with 3 HP and coin reward 1.

Mauler with 10 HP and coin reward 10.

Tank with 100 HP and coin reward 50.

All zombies must move toward the player at the same movement speed. Zombie type must affect health and reward only, unless a later extension is explicitly added.

The player weapon must fire automatically at all times during active gameplay. The player must not need to press a shoot button.

Each successful hit on a zombie must deal exactly 1 damage.

A zombie dies exactly when its HP reaches 0 or below.

On death, the zombie must immediately award its coin value to the player exactly once.

If any zombie touches the player, the game must immediately transition to defeat state.

The game must be organized into exactly 10 waves.

A wave must not begin automatically. The player must explicitly press a start-wave button to begin each wave.

After a wave ends, gameplay must pause and wait for the player to press the next wave button.

After the tenth wave is completed, the game must transition to a victory state and stop normal gameplay.

### Wave behavior

Each wave must contain an increasing number of zombies compared with earlier waves.

The total challenge must generally increase over time across the 10 waves.

The exact composition of grunts, maulers, and tanks per wave may be tuned by the implementation, but later waves must be materially harder than earlier waves.

A wave is considered complete only when all zombies assigned to that wave have spawned and all of them have been killed.

No zombies from the next wave may spawn before the player presses the next wave-start button.

### Weapons and upgrades

There must be exactly three guns total.

The player begins with Gun 1.

Each gun must support at most three purchasable fire-rate upgrades.

Fire-rate upgrades must cost coins.

Purchasing a fire-rate upgrade must increase the player’s firing rate.

The player must not be able to purchase more than three fire-rate upgrades for the current gun.

The new-gun upgrade must unlock the next gun in sequence, not skip ahead.

Unlocking a new gun must remove the previous fire-rate cap by switching the player to the next gun, which then has its own three available fire-rate upgrades.

The player must not be able to unlock Gun 2 or Gun 3 without answering the associated presentation question correctly.

The player may retry an incorrect answer indefinitely.

The question prompt must allow typed input from the keyboard.

Answer checking may be exact-match after normalization, for example trimming whitespace and ignoring case, unless a looser matching rule is intentionally implemented.

The game must prevent unlocking beyond Gun 3.

### Game states

The game must have at least the following distinct states:

Title state.

Wave waiting state.

Active gameplay state.

Question prompt state.

Victory state.

Defeat state.

On the title screen there must be a large Play button.

After pressing Play, the game must enter a pre-wave state that asks the user to start Wave 1.

On defeat, the game must show a defeat screen and a Try Again button.

On Try Again, the game must fully reset to a clean new run, including wave number, coins, zombies, upgrades, gun progression, prompts, and any temporary UI state.

### Input and interaction

Left arrow moves one lane left if not already at the leftmost lane.

Right arrow moves one lane right if not already at the rightmost lane.

Question input must accept typed text.

The player must be able to submit an answer via a visible button and optionally by pressing Enter.

Upgrade buttons must visually indicate whether they are available or unavailable.

### Content configuration

Presentation questions and accepted answers must be easy to edit in code from a single obvious configuration section.

Wave configuration should be easy to edit in code from a single obvious configuration section or data structure.

Upgrade costs and gun stats should be easy to edit in code.

The implementation must not bury core balancing values throughout unrelated logic.

## Examples

### Example game flow

The player opens the page and sees a title screen with the game name and a large Play button.

The player clicks Play and enters the game scene. The graphics load immediately because all assets are local or code-generated. A button labeled Start Wave 1 is visible.

The player clicks Start Wave 1. Zombies begin spawning across the three lanes and walking toward the player. The player automatically fires along the lane they currently occupy.

The player uses the left and right arrow keys to move between lanes to line up shots with incoming zombies.

A grunt is hit three times and dies. The player receives 1 coin.

A mauler is hit ten times and dies. The player receives 10 coins.

The player accumulates enough coins and clicks the fire-rate upgrade button. The gun now fires faster.

After three fire-rate upgrades on the starting gun, the fire-rate button becomes unavailable until a new gun is unlocked.

The player accumulates enough coins for the next gun and clicks the new-gun upgrade button. A prompt appears with a presentation question.

The player types a wrong answer and submits it. The prompt remains visible and indicates the answer was incorrect.

The player tries again with the correct answer. The next gun is unlocked and the player now has access to a fresh set of up to three fire-rate upgrades for that gun.

After all enemies in Wave 1 are dead, gameplay pauses. A Start Wave 2 button appears.

This continues until either a zombie touches the player, causing defeat, or the player clears Wave 10, causing victory.

### Example answer normalization

If the accepted answer is `photosynthesis`, then inputs such as `Photosynthesis`, `photosynthesis`, or `PHOTOSYNTHESIS` should be accepted if normalization is case-insensitive and trims surrounding whitespace.

### Example wave progression

Wave 1 may contain mostly grunts.

Wave 3 may begin introducing maulers.

Wave 5 or later may begin introducing tanks.

Wave 10 should be clearly harder than Wave 1 in both count and durability.

These are examples only. Exact numbers may differ as long as the difficulty trend is clear and deliberate.

## Definition of done

The feature is considered complete only when all of the following are true.

A player can open the deployed page in a browser and play without installing anything.

The game can be hosted from a GitHub Pages subdirectory and loads correctly using relative paths or other compatible path handling.

The title screen appears first and includes a Play button.

Pressing Play leads to a waiting state with a Start Wave 1 button.

There are exactly three lanes and the player can move only among those lanes with the arrow keys.

The player auto-fires during active waves.

There are exactly three zombie types with the required HP values and coin rewards.

Each hit deals exactly 1 damage.

Killing zombies grants the correct number of coins.

At least one purchasable fire-rate upgrade exists and increases firing speed.

Each gun allows exactly three fire-rate upgrades and no more.

There are exactly three guns total.

Unlocking Gun 2 and Gun 3 requires correctly answering a question prompt.

Wrong answers do not soft-lock the game and can be retried indefinitely.

There are exactly 10 waves.

Waves do not auto-start.

Each wave pauses after completion and waits for the next button press.

Completing Wave 10 causes a victory screen.

A zombie touching the player causes a defeat screen.

The defeat screen includes a Try Again button that fully resets the game.

The codebase contains an obvious configuration area for questions, answers, wave data, upgrade costs, and gun stats.

The repository structure and instructions are sufficient for another person to deploy the game on GitHub Pages without guesswork.

## Test expectations

The implementation should be tested manually at minimum. If the author adds automated tests, those are a bonus, but the following manual acceptance checks are required.

### Startup and deployment checks

Load the game locally in a browser and verify that the title screen appears without console-breaking errors.

Deploy the game under a GitHub Pages subdirectory and verify that all resources load correctly without broken paths.

Refresh the page and verify the game still initializes correctly.

### Movement checks

Press left arrow repeatedly and verify the player stops at the leftmost lane and does not move beyond it.

Press right arrow repeatedly and verify the player stops at the rightmost lane and does not move beyond it.

Verify that the player occupies only one lane at a time and movement is visually clear.

### Combat checks

Start an active wave and verify the player fires automatically with no shoot input.

Verify that bullets or shots only affect zombies in the intended lane according to the implementation design.

Verify that a grunt dies after exactly 3 hits, a mauler after exactly 10 hits, and a tank after exactly 100 hits.

Verify that coins awarded on death are exactly 1, 10, and 50 respectively.

Verify that coins are not awarded multiple times for the same zombie.

Verify that zombies move toward the player at the same speed regardless of type.

### Upgrade checks

Verify that the fire-rate upgrade costs coins and cannot be purchased without enough coins.

Verify that purchasing a fire-rate upgrade increases the actual firing speed.

Verify that no more than three fire-rate upgrades can be purchased on a single gun.

Verify that the new-gun unlock is unavailable when the player lacks required conditions such as enough coins, if coins are part of the unlock design.

Trigger a question prompt for a new gun and verify that a wrong answer is rejected while allowing another attempt.

Verify that the correct answer unlocks the next gun and makes a new set of up to three fire-rate upgrades available.

Verify that Gun 3 is the final gun and no fourth gun can be unlocked.

### Wave-flow checks

Verify that Wave 1 does not begin until the player clicks Start Wave 1.

Verify that a wave is not marked complete until all of its zombies have both spawned and died.

Verify that after completing a wave, the next wave does not begin until the player explicitly starts it.

Verify that the game ends in victory after Wave 10 and does not continue spawning additional waves.

### Failure and reset checks

Allow a zombie to touch the player and verify that the game transitions immediately to defeat.

Verify that gameplay stops on defeat.

Click Try Again and verify that all state resets to a fresh run.

Verify that after reset, the player starts again on Gun 1, Wave 1, with base fire rate, zero coins, no active zombies, and no completed upgrades.

### UI and content checks

Verify that the current wave, coins, gun, and upgrade status are visible during gameplay.

Verify that upgrade buttons clearly appear enabled or disabled depending on availability.

Verify that the question text and accepted answers can be updated from a single easy-to-find configuration section.

Verify that wave composition can be adjusted without rewriting gameplay logic.

## Rollout notes

The simplest recommended delivery is a static folder containing an `index.html`, `style.css`, and `script.js`, plus optional local assets if any are embedded in the repo. This is the safest format for GitHub Pages.

If a framework is used during development, the final output committed for deployment should still be a static site that works from GitHub Pages without a server.

All asset references should use relative paths so the game works when hosted from a repository subdirectory rather than the site root.

A short `README.md` should be included in the project folder explaining how to run locally, how to edit questions and answers, how to adjust waves and upgrade values, and how to publish to GitHub Pages.

If time allows, it is acceptable to add polish such as simple animations, sound, hit flashes, health bars, lane highlighting, or better UI transitions, but these are secondary and must not compromise the hard constraints above.

If implementation tradeoffs are needed, correctness of game state, upgrade logic, wave progression, and GitHub Pages compatibility should take priority over visual polish.
