// missileFactory.js
// Creates homing missile entities in the ECS
import { degToRad } from './utils.js';

/**
 * Create a homing missile entity.
 * Collisions reuse bullet logic by also tagging as 'bullet'.
 * @param {EntityManager} em
 * @param {Game} game
 * @param {number} x
 * @param {number} y
 * @param {number} angle in degrees
 * @returns {number} entity id
 */
export function createMissileEntity(em, game, x, y, angle) {
  const id = em.createEntity();
  // position
  em.addComponent(id, 'position', { x, y });
  // tag as missile AND bullet for collision compatibility
  em.addComponent(id, 'missile', {});
  em.addComponent(id, 'bullet', {});
  // velocity based on angle and current game bullet speed
  const rad = degToRad(angle);
  const base = (game.bulletSpeedMax + game.bulletSpeedMin) / 2;
  const speed = base * 0.9; // slightly slower than a power shot
  em.addComponent(id, 'velocity', { x: Math.cos(rad) * speed, y: Math.sin(rad) * speed });
  // rotation (degrees)
  em.addComponent(id, 'rotation', { value: angle });
  // lifetime (longer than a normal bullet)
  em.addComponent(id, 'lifetime', { value: Math.round(game.bulletLife * 1.5) });
  // collider radius
  const r = Math.max(3, Math.round(game.bulletSize * 1.5));
  em.addComponent(id, 'collider', { r });
  // damage delivered per hit (missiles stronger than bullets)
  em.addComponent(id, 'damage_delivered', { value: 2 });
  // renderable: small orange triangle oriented by rotation
  em.addComponent(id, 'renderable', {
    draw(ctx) {
      ctx.fillStyle = 'orange';
      ctx.beginPath();
      const s = r * 2.2; // missile length
      // draw triangle pointing along +X
      ctx.moveTo(s/2, 0);
      ctx.lineTo(-s/2, r/1.5);
      ctx.lineTo(-s/2, -r/1.5);
      ctx.closePath();
      ctx.fill();
    }
  });
  return id;
}
