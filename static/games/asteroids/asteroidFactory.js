// asteroidFactory.js
// Creates asteroid entities in the ECS
import { rand, degToRad } from './utils.js';
import * as CONST from './constants.js';
import { asteroidImages } from './asteroid.js';
/**
 * Create an asteroid entity with position, velocity, rotation, and renderable components.
 * @param {EntityManager} em
 * @param {Game} game
 * @param {number} x
 * @param {number} y
 * @param {number} [size]
 * @param {string} [variant]
 * @returns {number} entity id
 */
export function createAsteroidEntity(em, game, x, y, size, variant = CONST.ASTEROID_VARIANTS.STANDARD) {
  const id = em.createEntity();
  const modifier = game.currentSectorModifier || CONST.getSectorModifier(game.level);
  const variantDefaults = {
    [CONST.ASTEROID_VARIANTS.STANDARD]: { minSize: 20, maxSize: 60, speedMult: 1, spinMult: 1, healthBonus: 0, splitCount: 2, scoreValue: 1, saturation: 1.2, brightness: 1 },
    [CONST.ASTEROID_VARIANTS.SWIFT]: { minSize: 18, maxSize: 40, speedMult: 1.8, spinMult: 1.8, healthBonus: -1, splitCount: 2, scoreValue: 2, saturation: 1.6, brightness: 1.15 },
    [CONST.ASTEROID_VARIANTS.HEAVY]: { minSize: 36, maxSize: 70, speedMult: 0.75, spinMult: 0.7, healthBonus: 2, splitCount: 3, scoreValue: 3, saturation: 0.9, brightness: 0.9 }
  };
  const profile = variantDefaults[variant] || variantDefaults[CONST.ASTEROID_VARIANTS.STANDARD];
  const s = size || rand(profile.minSize, profile.maxSize);
  // position
  em.addComponent(id, 'position', { x: x, y: y });
  // asteroid tag + size
  em.addComponent(id, 'asteroid', {
    size: s,
    variant,
    splitCount: profile.splitCount,
    scoreValue: profile.scoreValue
  });
  // health scaled by size and level
  let baseHealth = 1; // small
  if (s > 40) baseHealth = 3; // large
  else if (s > 25) baseHealth = 2; // medium
  const scale = 1 + Math.max(0, (game.level - 1)) * 0.2; // +20% per level
  const health = Math.max(1, Math.round(baseHealth * scale) + profile.healthBonus + (modifier.asteroidHealthBonus || 0));
  em.addComponent(id, 'health', { value: health });
  // collider radius
  em.addComponent(id, 'collider', { r: s });
  // velocity
  const sectorSpeedScale = 1 + Math.max(0, game.level - 1) * 0.08;
  const speed = ((rand(1, 3) / s) * 30) * profile.speedMult * sectorSpeedScale * (modifier.asteroidSpeedMult || 1);
  const ang = rand(0, 360);
  em.addComponent(id, 'velocity', {
    x: speed * Math.cos(degToRad(ang)),
    y: speed * Math.sin(degToRad(ang))
  });
  // rotation
  em.addComponent(id, 'rotation', { value: rand(0, 360) });
  em.addComponent(id, 'rotationSpeed', { value: rand(-0.5, 0.5) * profile.spinMult });
  // renderable
  const img = asteroidImages[Math.floor(rand(0, asteroidImages.length))];
  em.addComponent(id, 'renderable', {
    draw(ctx) {
      if (img.complete) {
        const px = s * 2;
        ctx.filter = `hue-rotate(${((game.level - 1) * 60) % 360}deg) saturate(${profile.saturation}) brightness(${profile.brightness})`;
        ctx.drawImage(img, -px/2, -px/2, px, px);
      } else {
        ctx.fillStyle = '#ccc';
        ctx.beginPath(); ctx.arc(0, 0, s, 0, 2*Math.PI); ctx.fill();
      }
    }
  });
  return id;
}
