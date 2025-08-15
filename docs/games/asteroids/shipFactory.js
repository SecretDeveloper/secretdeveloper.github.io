// shipFactory.js
// Creates the player ship entity in the ECS
import { SHIP_RADIUS, SHIP_FRICTION } from './constants.js';
import { degToRad } from './utils.js';
// Load ship SVG as an image at runtime
const shipImg = new Image();
shipImg.src = new URL('./ship.svg', import.meta.url).href;
/**
 * Create the player ship entity with position, velocity, rotation, collider, and renderable.
 * @param {EntityManager} em
 * @param {Game} game
 * @returns {number} entity id
 */
export function createShipEntity(em, game) {
  const id = em.createEntity();
  // position at center
  em.addComponent(id, 'position', { x: game.W / 2, y: game.H / 2 });
  // velocity
  em.addComponent(id, 'velocity', { x: 0, y: 0 });
  // rotation angle
  em.addComponent(id, 'rotation', { value: 0 });
  // ship marker + radius for collider and spawn offsets (half of drawn size)
  const drawSize = SHIP_RADIUS * 3;
  const shipRadius = drawSize / 2;
  em.addComponent(id, 'ship', { r: shipRadius });
  // collider radius matches ship radius
  em.addComponent(id, 'collider', { r: shipRadius });
  // renderable: draws shield and ship image
  em.addComponent(id, 'renderable', {
    draw(ctx) {
      const pos = em.getComponent(id, 'position');
      const rot = em.getComponent(id, 'rotation');
      const now = performance.now();
      ctx.save();
      ctx.translate(pos.x, pos.y);
      // rotate to heading
      ctx.rotate(degToRad(rot.value + 90));
      // draw ship graphic
      if (shipImg.complete) {
        const size = SHIP_RADIUS * 3;
        // use drawSize for pivot
        const half = size / 2;
        ctx.drawImage(shipImg, -half, -half, size, size);
      }
      ctx.restore();
    }
  });
  return id;
}