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
  em.addComponent(id, 'rotationSpeed', { value: 0 });
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
      if (game.isState && game.isState('exploding')) return;
      const shipComp = em.getComponent(id, 'ship');
      const now = performance.now();
      const invulnerable = game.isShipInvulnerable(now);
      const drawShieldSphere = (radius, {
        outerColor = '120,220,255',
        innerColor = '255,255,255',
        alpha = 0.2,
        pulse = 0.5,
        rimAlpha = 0.5
      } = {}) => {
        const fill = ctx.createRadialGradient(-radius * 0.18, -radius * 0.22, radius * 0.08, 0, 0, radius);
        fill.addColorStop(0, `rgba(${innerColor},${alpha * 0.08})`);
        fill.addColorStop(0.38, `rgba(${outerColor},${alpha * 0.04})`);
        fill.addColorStop(0.72, `rgba(${outerColor},${alpha * 0.18})`);
        fill.addColorStop(1, `rgba(${outerColor},${alpha * 0.02})`);
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, 2 * Math.PI);
        ctx.fill();

        const rim = ctx.createRadialGradient(0, 0, radius * 0.7, 0, 0, radius);
        rim.addColorStop(0, 'rgba(255,255,255,0)');
        rim.addColorStop(0.82, `rgba(${outerColor},${rimAlpha * 0.2})`);
        rim.addColorStop(1, `rgba(${outerColor},${rimAlpha})`);
        ctx.strokeStyle = rim;
        ctx.lineWidth = 2.5 + pulse * 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, 2 * Math.PI);
        ctx.stroke();

        ctx.strokeStyle = `rgba(255,255,255,${0.08 + pulse * 0.1})`;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.arc(-radius * 0.12, -radius * 0.1, radius * 0.62, Math.PI * 1.12, Math.PI * 1.82);
        ctx.stroke();

        ctx.strokeStyle = `rgba(${outerColor},${0.16 + pulse * 0.12})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(radius * 0.08, radius * 0.12, radius * 0.78, Math.PI * 0.08, Math.PI * 0.82);
        ctx.stroke();
      };
      if (game.shieldOverpowered && now < game.shieldOverpoweredExpiry) {
        const t = now / 300;
        const pulse = (Math.sin(t) * 0.5 + 0.5);
        const radius = shipComp.r * (2 + pulse * 0.28);
        drawShieldSphere(radius, {
          outerColor: '120,220,255',
          innerColor: '255,255,255',
          alpha: 0.28 + pulse * 0.12,
          pulse,
          rimAlpha: 0.6 + pulse * 0.18
        });
      } else if (game.shield > 0) {
        const t = now / 300;
        const pulse = (Math.sin(t) * 0.5 + 0.5);
        const radius = shipComp.r * (1.92 + pulse * 0.16);
        let outerColor = '255,90,90';
        if (game.shield === 3) outerColor = '90,255,150';
        else if (game.shield === 2) outerColor = '255,225,110';
        drawShieldSphere(radius, {
          outerColor,
          innerColor: '255,255,255',
          alpha: 0.16 + pulse * 0.07,
          pulse,
          rimAlpha: 0.34 + pulse * 0.12
        });
      } else if (invulnerable) {
        const t = now / 120;
        const pulse = (Math.sin(t) * 0.5 + 0.5);
        const radius = shipComp.r * (1.74 + pulse * 0.2);
        drawShieldSphere(radius, {
          outerColor: '255,255,255',
          innerColor: '255,255,255',
          alpha: 0.1 + pulse * 0.05,
          pulse,
          rimAlpha: 0.3 + pulse * 0.28
        });
      }
      // Ship art points up; add +90° so 0° faces right like movement.
      if (shipImg.complete) {
        const size = SHIP_RADIUS * 3;
        const half = size / 2;
        ctx.rotate(degToRad(90));
        if (invulnerable && Math.floor(now / 80) % 2 === 0) ctx.globalAlpha = 0.35;
        ctx.drawImage(shipImg, -half, -half, size, size);
      }
    }
  });
  return id;
}
