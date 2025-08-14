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

export const BASE_BULLET_SPEED_MIN = 8;
export const BASE_BULLET_SPEED_MAX = 12;
export const POWER_BULLET_SPEED_MIN = 12;
export const POWER_BULLET_SPEED_MAX = 18;
export const BASE_BULLET_SIZE     = 2;
export const POWER_BULLET_SIZE    = 4;
export const BASE_BULLET_LIFE     = 60;
export const POWER_BULLET_LIFE    = 100;

export const BASE_SHOT_INTERVAL   = 200;
export const MACHINE_GUN_INTERVAL = 50;

export const POWERUP_DURATION     = 10000;
export const POWERUP_SPAWN_CHANCE = 0.2;

export const STAR_COUNT           = 200;
export const STAR_PARALLAX        = 0.2;

export const EXPLOSION_PARTICLES_COUNT = 40;
export const EXPLOSION_DURATION   = 2000;
export const FPS_INTERVAL         = 500;

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