// bulletFactory.js
// Creates bullet entities in the ECS
import { degToRad } from './utils.js';
import * as CONST from './constants.js';
/**
 * Create a bullet entity with position, velocity, rotation, lifetime, and renderable.
 * @param {EntityManager} em
 * @param {Game} game
 * @param {number} x
 * @param {number} y
 * @param {number} angle in degrees
 * @returns {number} entity id
 */
export function createBulletEntity(em, game, x, y, angle) {
  const id = em.createEntity();
  // position
  em.addComponent(id, 'position', { x, y });
  // bullet tag
  em.addComponent(id, 'bullet', {});
  // velocity
  const rad = degToRad(angle);
  const speed = game.bulletSpeedMin + Math.random() * (game.bulletSpeedMax - game.bulletSpeedMin);
  em.addComponent(id, 'velocity', { x: Math.cos(rad) * speed, y: Math.sin(rad) * speed });
  // lifetime
  em.addComponent(id, 'lifetime', { value: game.bulletLife });
  // rotation (for potential render)
  em.addComponent(id, 'rotation', { value: angle });
  // collider radius
  em.addComponent(id, 'collider', { r: game.bulletSize });
  // renderable
  em.addComponent(id, 'renderable', {
    draw(ctx) {
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(0, 0, game.bulletSize, 0, 2 * Math.PI);
      ctx.fill();
    }
  });
  return id;
}