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
      // RenderSystem provides entity-local translate/rotate to heading.
      // Draw shield ring(s) based on game state, then ship image.
      const shipComp = em.getComponent(id, 'ship');
      const now = performance.now();
      if (game.shieldOverpowered && now < game.shieldOverpoweredExpiry) {
        // overpowered pulsing white-blue shield
        const t = now / 300;
        const pulse = (Math.sin(t) * 0.5 + 0.5);
        const baseR = shipComp.r * 2;
        const radius = baseR + (shipComp.r * 0.6) * pulse;
        const lineW = 4 + 4 * pulse;
        const hue = 200; // blue
        const light = 80 + pulse * 20;
        const color = `hsl(${hue},100%,${light}%)`;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = color;
        ctx.lineWidth = lineW;
        ctx.stroke();
      } else if (game.shield > 0) {
        // normal shield ring with color by health
        const t = now / 300;
        const pulse = (Math.sin(t) * 0.5 + 0.5);
        const baseR = shipComp.r * 2;
        const radius = baseR + (shipComp.r * 0.4) * pulse;
        const lineW = 3 + 3 * pulse;
        let color = 'rgba(255,0,0,0.3)';
        if (game.shield === 3) color = 'rgba(0,255,0,0.3)';
        else if (game.shield === 2) color = 'rgba(255,255,0,0.3)';
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = color;
        ctx.lineWidth = lineW;
        ctx.stroke();
      }
      // Ship art points up; add +90° so 0° faces right like movement.
      if (shipImg.complete) {
        const size = SHIP_RADIUS * 3;
        const half = size / 2;
        ctx.rotate(degToRad(90));
        ctx.drawImage(shipImg, -half, -half, size, size);
      }
    }
  });
  return id;
}
