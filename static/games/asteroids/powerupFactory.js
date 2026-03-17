// powerupFactory.js
// Creates power-up entities in the ECS
import { POWERUP_RADIUS, POWERUP_TYPES, POWERUP_DURATION, FPS } from './constants.js';
import { rand } from './utils.js';

const powerupIcons = {
  [POWERUP_TYPES.SHIELD]: new Image(),
  [POWERUP_TYPES.MACHINE]: new Image(),
  [POWERUP_TYPES.POWER]: new Image(),
  [POWERUP_TYPES.MISSILE]: new Image()
};

powerupIcons[POWERUP_TYPES.SHIELD].src = new URL('./powerup-shield.svg', import.meta.url).href;
powerupIcons[POWERUP_TYPES.MACHINE].src = new URL('./powerup-machine.svg', import.meta.url).href;
powerupIcons[POWERUP_TYPES.POWER].src = new URL('./powerup-power.svg', import.meta.url).href;
powerupIcons[POWERUP_TYPES.MISSILE].src = new URL('./powerup-missile.svg', import.meta.url).href;

const powerupColors = {
  [POWERUP_TYPES.SHIELD]: '#54ff9f',
  [POWERUP_TYPES.MACHINE]: '#ff6de3',
  [POWERUP_TYPES.POWER]: '#45d7ff',
  [POWERUP_TYPES.MISSILE]: '#ffb14a'
};

const powerupColorRgb = {
  [POWERUP_TYPES.SHIELD]: '84,255,159',
  [POWERUP_TYPES.MACHINE]: '255,109,227',
  [POWERUP_TYPES.POWER]: '69,215,255',
  [POWERUP_TYPES.MISSILE]: '255,177,74'
};

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
  // rotation and spin (degrees)
  em.addComponent(id, 'rotation', { value: rand(0, 360) });
  // rotation speed in degrees per frame (RotationSystem multiplies by dt frames)
  const rotSpeed = rand(-1, 1); // gentle spin
  em.addComponent(id, 'rotationSpeed', { value: rotSpeed });
  // lifetime (in frames) — doubled to keep items around longer
  const lifeFrames = Math.round(POWERUP_DURATION * FPS / 1000) * 2;
  em.addComponent(id, 'lifetime', { value: lifeFrames });
  em.addComponent(id, 'powerupVisual', { maxLife: lifeFrames });
  // powerup tag + type
  em.addComponent(id, 'powerup', { type });
  // renderable: icon with glow and flash on timeout. RenderSystem handles translate/rotate.
  em.addComponent(id, 'renderable', {
    draw(ctx) {
      const life = em.getComponent(id, 'lifetime');
      const visual = em.getComponent(id, 'powerupVisual');
      const maxLife = visual?.maxLife || 1;
      const remaining = Math.max(0, (life?.value || 0) / maxLife);
      const warning = remaining < 0.28;
      const blink = warning ? (Math.sin(performance.now() / 45) * 0.5 + 0.5) : 1;
      const outerAlpha = warning ? 0.15 + blink * 0.5 : 0.28;
      const innerAlpha = warning ? 0.65 + blink * 0.35 : 0.9;
      const color = powerupColors[type] || '#ffffff';
      const colorRgb = powerupColorRgb[type] || '255,255,255';
      const icon = powerupIcons[type];

      ctx.save();
      ctx.globalAlpha = warning ? 0.45 + blink * 0.55 : 1;

      const halo = ctx.createRadialGradient(0, 0, POWERUP_RADIUS * 0.2, 0, 0, POWERUP_RADIUS * 1.9);
      halo.addColorStop(0, `rgba(255,255,255,${innerAlpha})`);
      halo.addColorStop(0.45, `rgba(${colorRgb},${outerAlpha})`);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, POWERUP_RADIUS * 1.9, 0, 2 * Math.PI);
      ctx.fill();

      ctx.strokeStyle = warning ? `rgba(255,255,255,${0.45 + blink * 0.4})` : 'rgba(255,255,255,0.4)';
      ctx.lineWidth = warning ? 3 : 2;
      ctx.beginPath();
      ctx.arc(0, 0, POWERUP_RADIUS * 1.18, 0, 2 * Math.PI);
      ctx.stroke();

      if (icon?.complete) {
        const size = POWERUP_RADIUS * 2.4;
        const half = size / 2;
        ctx.drawImage(icon, -half, -half, size, size);
      } else {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, POWERUP_RADIUS, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.restore();
    }
  });
  return id;
}
