# Asteroids TODO

## Combat Pivot

- [x] Reframe the game loop around defending the home planet by clearing enemy ships staging inside asteroid fields.
- [x] Add a basic enemy fighter ECS entity with movement, targeting, collision, health, and rendering.
- [x] Change sector clear conditions so hostile ships are the primary objective while asteroids remain environmental hazards.
- [x] Add enemy weapon fire and damage interactions for ship-vs-ship combat inside asteroid fields.
- [x] Replace asteroid miniboss encounters with enemy command ships or carriers plus escorts.
- [x] Update start screen, HUD, and game-over messaging to reflect the defense mission premise and sector threat level.

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

- [x] Add score multipliers, combos, or sector-clear bonuses.
- [x] Make power-up drops more strategic instead of purely random.
- [x] Add sector themes that change gameplay, visuals, or audio beyond color shifts.
- [x] Add a boss or mini-boss every few sectors.

## UX

- [x] Update the start screen so it mentions `WASD` support as well as arrow keys.
- [x] Update the start screen to explain the purpose of the game and mission to protect your home planet and defeat the alien invasion.
- [x] Add a visible current-weapon indicator and low-ammo warning.

## Code Quality

- [ ] Finish the ECS migration and remove or isolate legacy code paths that are no longer in use.
- [ ] Break up `game.js` so state management, rendering layers, HUD updates, and transitions are easier to maintain.
- [ ] Formalize component shapes and entity tags to reduce ad hoc ECS patterns.
