// asteroidFactory.js
// Creates asteroid entities in the ECS
import { rand, degToRad } from './utils.js';
import { asteroidImages } from './asteroid.js';
/**
 * Create an asteroid entity with position, velocity, rotation, and renderable components.
 * @param {EntityManager} em
 * @param {Game} game
 * @param {number} x
 * @param {number} y
 * @param {number} [size]
 * @returns {number} entity id
 */
export function createAsteroidEntity(em, game, x, y, size) {
  const id = em.createEntity();
  const s = size || rand(20, 60);
  // position
  em.addComponent(id, 'position', { x: x, y: y });
  // asteroid tag + size
  em.addComponent(id, 'asteroid', { size: s });
  // health scaled by size and level
  let baseHealth = 1; // small
  if (s > 40) baseHealth = 3; // large
  else if (s > 25) baseHealth = 2; // medium
  const scale = 1 + Math.max(0, (game.level - 1)) * 0.2; // +20% per level
  const health = Math.max(1, Math.round(baseHealth * scale));
  em.addComponent(id, 'health', { value: health });
  // collider radius
  em.addComponent(id, 'collider', { r: s });
  // velocity
  const speed = (rand(1, 3) / s) * 30;
  const ang = rand(0, 360);
  em.addComponent(id, 'velocity', {
    x: speed * Math.cos(degToRad(ang)),
    y: speed * Math.sin(degToRad(ang))
  });
  // rotation
  em.addComponent(id, 'rotation', { value: rand(0, 360) });
  em.addComponent(id, 'rotationSpeed', { value: rand(-0.5, 0.5) });
  // renderable
  const img = asteroidImages[Math.floor(rand(0, asteroidImages.length))];
  em.addComponent(id, 'renderable', {
    draw(ctx) {
      if (img.complete) {
        const px = s * 2;
        ctx.filter = `hue-rotate(${((game.level - 1) * 60) % 360}deg) saturate(1.2)`;
        ctx.drawImage(img, -px/2, -px/2, px, px);
      } else {
        ctx.fillStyle = '#ccc';
        ctx.beginPath(); ctx.arc(0, 0, s, 0, 2*Math.PI); ctx.fill();
      }
    }
  });
  return id;
}
