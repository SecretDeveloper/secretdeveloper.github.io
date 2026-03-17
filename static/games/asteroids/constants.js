// constants.js
// Centralized configuration and constants for the Asteroids game
export const POWERUP_RADIUS       = 10 * 1.1;
export const FPS                  = 60;
export const THRUST_PARTICLES     = 3;
export const MAX_THRUST_PARTS     = 200;
export const BULLET_LIFETIME      = 60;
export const SHIP_ACCEL           = 0.1;
export const SHIP_MAX_SPEED       = 5;
export const SHIP_FRICTION        = 0.99;
export const SHIP_RADIUS          = 7.5;
export const SHIP_TURN_ACCEL      = 0.45;
export const SHIP_TURN_DAMPING    = 0.82;
export const SHIP_MAX_TURN_SPEED  = 5.5;
export const SHIP_THRUST_BOOST    = 1.2;

export const BASE_BULLET_SPEED_MIN = 8;
export const BASE_BULLET_SPEED_MAX = 12;
export const POWER_BULLET_SPEED_MIN = 10;
export const POWER_BULLET_SPEED_MAX = 14;
export const BASE_BULLET_SIZE     = 2;
export const POWER_BULLET_SIZE    = 4;
export const BASE_BULLET_LIFE     = 60;
export const POWER_BULLET_LIFE    = 100;
export const MACHINE_BULLET_LIFE  = 72;
export const NUKE_BULLET_LIFE     = 140;
export const NUKE_DAMAGE          = 5;
export const MISSILE_LIFETIME     = 140;
export const MISSILE_DAMAGE       = 4;
export const MISSILE_SPEED_MULT   = 1.1;

export const BASE_SHOT_INTERVAL   = 200;
export const MACHINE_GUN_INTERVAL = 50;
export const POWER_SHOT_INTERVAL  = 500;
export const MISSILE_SHOT_INTERVAL = 320;

export const POWERUP_DURATION     = 10000;
export const POWERUP_SPAWN_CHANCE = 0.2;
export const POWERUP_ATTRACT_RADIUS = 160;
export const POWERUP_ATTRACT_SPEED  = 0.72;
export const POWERUP_ATTRACT_SNAP_MULT = 7;
export const COMBO_WINDOW_MS      = 2200;
export const COMBO_MAX_MULTIPLIER = 5;
export const SECTOR_CLEAR_BONUS   = 25;

export const STAR_COUNT           = 200;
export const STAR_PARALLAX        = 0.2;

export const EXPLOSION_PARTICLES_COUNT = 40;
export const EXPLOSION_DURATION   = 2000;
export const FPS_INTERVAL         = 500;
export const SHIP_INVULNERABLE_DURATION = 1200;
export const SHIP_PORTAL_INVULNERABLE_DURATION = 2500;

// Enumerations for power-up types
export const POWERUP_TYPES = {
  SHIELD:  'shield',
  MACHINE: 'machine',
  POWER:   'power',
  MISSILE: 'missile'
};

// Keyboard keys
export const KEY = {
  LEFT:  'ArrowLeft',
  RIGHT: 'ArrowRight',
  UP:    'ArrowUp',
  FIRE:  ' ',       // Space key
  ENTER: 'Enter',
  PAUSE: 'Escape'
};
// Wormhole settings
export const WORMHOLE_RADIUS = 30;
export const WORMHOLE_COLOR  = 'cyan';
// Duration (ms) to keep portal visible after exiting
export const PORTAL_EXIT_DURATION = 2000;
// Max ammo counts for weapons
export const MAX_AMMO = {
  [POWERUP_TYPES.MISSILE]: 24,
  [POWERUP_TYPES.MACHINE]: 160,
  [POWERUP_TYPES.POWER]: 24
};
// Duration (ms) for the ship's blue light trail to fade
export const TRAIL_DURATION       = 3000;

export const ASTEROID_VARIANTS = {
  STANDARD: 'standard',
  SWIFT: 'swift',
  HEAVY: 'heavy',
  BOSS: 'boss'
};

export const MINIBOSS_EVERY_SECTORS = 4;
export const MINIBOSS_SUPPORT_COUNT = 4;
export const BASE_ENEMY_COUNT      = 1;
export const MAX_ENEMY_COUNT       = 5;

export const SECTOR_MODIFIERS = [
  {
    id: 'calm',
    name: 'Calm Space',
    description: 'Standard asteroid lanes.',
    asteroidCountMult: 1,
    asteroidSpeedMult: 1,
    asteroidHealthBonus: 0,
    swiftBias: 0,
    heavyBias: 0,
    powerupChanceMult: 1,
    bulletSpeedMult: 1
  },
  {
    id: 'debris',
    name: 'Debris Field',
    description: 'Dense asteroid clusters fill the sector.',
    asteroidCountMult: 1.35,
    asteroidSpeedMult: 1,
    asteroidHealthBonus: 0,
    swiftBias: 0.05,
    heavyBias: 0.1,
    powerupChanceMult: 1,
    bulletSpeedMult: 1
  },
  {
    id: 'ion',
    name: 'Ion Storm',
    description: 'Fast-moving rocks and boosted shot speed.',
    asteroidCountMult: 1,
    asteroidSpeedMult: 1.3,
    asteroidHealthBonus: 0,
    swiftBias: 0.25,
    heavyBias: 0,
    powerupChanceMult: 1,
    bulletSpeedMult: 1.15
  },
  {
    id: 'salvage',
    name: 'Salvage Drift',
    description: 'Power-up drop rates spike in the wreckage.',
    asteroidCountMult: 1.1,
    asteroidSpeedMult: 1,
    asteroidHealthBonus: 0,
    swiftBias: 0.1,
    heavyBias: 0.05,
    powerupChanceMult: 1.75,
    bulletSpeedMult: 1
  },
  {
    id: 'fortress',
    name: 'Fortress Belt',
    description: 'Heavy asteroids dominate and take more punishment.',
    asteroidCountMult: 0.95,
    asteroidSpeedMult: 0.9,
    asteroidHealthBonus: 1,
    swiftBias: 0,
    heavyBias: 0.3,
    powerupChanceMult: 1,
    bulletSpeedMult: 1
  }
];

export function getSectorModifier(level) {
  if (level <= 1) return SECTOR_MODIFIERS[0];
  const idx = 1 + ((level - 2) % (SECTOR_MODIFIERS.length - 1));
  return SECTOR_MODIFIERS[idx];
}

export function getSectorAsteroidCount(level) {
  const base = 3 + level;
  const bonus = Math.floor(Math.max(0, level - 2) / 2);
  return base + bonus;
}
