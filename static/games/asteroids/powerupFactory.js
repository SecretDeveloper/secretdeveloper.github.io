// powerupFactory.js
// Creates power-up entities in the ECS
import { POWERUP_RADIUS, POWERUP_TYPES, POWERUP_DURATION, FPS } from './constants.js';
import { rand } from './utils.js';
/**
 * Create a power-up entity with position, rotation, collider, lifetime, and renderable.
 * @param {EntityManager} em
 * @param {Game} game
 * @param {number} x
 * @param {number} y
 * @param {string} type one of POWERUP_TYPES
 * @returns {number} entity id
 */
export function createPowerupEntity(em, game, x, y, type) {
  const id = em.createEntity();
  // position
  em.addComponent(id, 'position', { x, y });
  // collider radius
  em.addComponent(id, 'collider', { r: POWERUP_RADIUS });
  // rotation and spin
  em.addComponent(id, 'rotation', { value: rand(0, 2 * Math.PI) });
  // rotation speed (rad per ms)
  const rotSpeed = 0.05 / (1000 / 60); // ~0.003125 rad per ms
  em.addComponent(id, 'rotationSpeed', { value: rotSpeed });
  // lifetime (in frames)
  const lifeFrames = Math.round(POWERUP_DURATION * FPS / 1000);
  em.addComponent(id, 'lifetime', { value: lifeFrames });
  // powerup tag + type
  em.addComponent(id, 'powerup', { type });
  // renderable: circle with label
  em.addComponent(id, 'renderable', {
    draw(ctx) {
      const rot = em.getComponent(id, 'rotation');
      ctx.save();
      ctx.rotate(rot.value);
      let color, label;
      switch (type) {
        case POWERUP_TYPES.SHIELD:  color = 'lime';   label = 'S'; break;
        case POWERUP_TYPES.MACHINE: color = 'magenta'; label = 'M'; break;
        case POWERUP_TYPES.POWER:   color = 'cyan';    label = 'P'; break;
        case POWERUP_TYPES.MISSILE: color = 'orange';  label = 'X'; break;
        default: color = 'white'; label = '?';
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, POWERUP_RADIUS, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
  });
  return id;
}