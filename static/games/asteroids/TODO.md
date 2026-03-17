# Asteroids TODO

## High Impact

- [x] Fix restart/reset logic in `game.js` so a new run clears all ECS entities before respawning ship, asteroids, particles, bullets, and power-ups.
- [x] Replace the current mix of flags with explicit game states such as `start`, `playing`, `paused`, `exploding`, `gameover`, and `sector-transition`.
- [x] Improve difficulty scaling so later sectors change more than asteroid count and health.
- [x] Add more gameplay variety with faster asteroid classes, hazards, elite enemies, or sector-specific modifiers.

## Game Feel

- [x] Add stronger hit feedback with screen shake, impact flash, and more satisfying destruction effects.
- [x] Differentiate weapons more clearly with distinct visuals, recoil, sound, and hit behavior.
- [x] Add temporary invulnerability after ship collisions to reduce cheap repeated damage.
- [x] Tune thrust and turning to feel more responsive and deliberate.

## Progression

- [ ] Add score multipliers, combos, or sector-clear bonuses.
- [ ] Make power-up drops more strategic instead of purely random.
- [ ] Add sector themes that change gameplay, visuals, or audio beyond color shifts.
- [ ] Add a boss or mini-boss every few sectors.

## UX

- [ ] Update the start screen so it mentions `WASD` support as well as arrow keys.
- [ ] Add a visible current-weapon indicator and low-ammo warning.
- [ ] Improve the game-over flow so it does not immediately reset behind the scenes.
- [ ] Decide whether to support touch controls or explicitly message that the game is desktop-first.

## Code Quality

- [ ] Finish the ECS migration and remove or isolate legacy code paths that are no longer in use.
- [ ] Break up `game.js` so state management, rendering layers, HUD updates, and transitions are easier to maintain.
- [ ] Formalize component shapes and entity tags to reduce ad hoc ECS patterns.
