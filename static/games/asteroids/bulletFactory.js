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
 * @param {string} [weaponType]
 * @param {string} [owner]
 * @returns {number} entity id
 */
export function createBulletEntity(em, game, x, y, angle, weaponType = 'default', owner = 'player') {
  const id = em.createEntity();
  const profiles = {
    default: {
      speedMin: game.bulletSpeedMin,
      speedMax: game.bulletSpeedMax,
      life: Math.round(game.bulletLife * 2),
      radius: game.bulletSize,
      damage: 1,
      color: '255,255,255',
      glow: 'rgba(255,255,255,0.5)',
      length: game.bulletSize * 2.2
    },
    machine: {
      speedMin: game.bulletSpeedMin * 1.15,
      speedMax: game.bulletSpeedMax * 1.2,
      life: CONST.MACHINE_BULLET_LIFE,
      radius: Math.max(1.5, game.bulletSize * 0.85),
      damage: 1,
      color: '120,255,255',
      glow: 'rgba(120,255,255,0.6)',
      length: Math.max(6, game.bulletSize * 4)
    },
    power: {
      speedMin: game.bulletSpeedMin,
      speedMax: game.bulletSpeedMax,
      life: CONST.NUKE_BULLET_LIFE,
      radius: Math.max(game.bulletSize, CONST.POWER_BULLET_SIZE),
      damage: CONST.NUKE_DAMAGE,
      color: '120,220,255',
      glow: 'rgba(120,220,255,0.8)',
      length: Math.max(10, game.bulletSize * 4.5)
    },
    enemy: {
      speedMin: 6.5,
      speedMax: 8.2,
      life: Math.round(game.bulletLife * 1.8),
      radius: Math.max(2, game.bulletSize * 1.05),
      damage: 1,
      color: '255,120,90',
      glow: 'rgba(255,120,90,0.7)',
      length: Math.max(8, game.bulletSize * 3.5)
    }
  };
  const profile = profiles[weaponType] || profiles.default;
  // position
  em.addComponent(id, 'position', { x, y });
  // bullet tag
  em.addComponent(id, 'bullet', { weaponType, owner });
  // velocity
  const rad = degToRad(angle);
  const speed = profile.speedMin + Math.random() * (profile.speedMax - profile.speedMin);
  em.addComponent(id, 'velocity', { x: Math.cos(rad) * speed, y: Math.sin(rad) * speed });
  em.addComponent(id, 'lifetime', { value: profile.life });
  // rotation (for potential render)
  em.addComponent(id, 'rotation', { value: angle });
  // collider radius
  em.addComponent(id, 'collider', { r: profile.radius });
  em.addComponent(id, 'damage_delivered', { value: profile.damage });
  // renderable
  em.addComponent(id, 'renderable', {
    draw(ctx) {
      if (weaponType === 'machine' || weaponType === 'enemy') {
        ctx.fillStyle = `rgb(${profile.color})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = profile.glow;
        ctx.fillRect(-profile.length / 2, -profile.radius / 1.5, profile.length, profile.radius);
        return;
      }
      if (weaponType === 'power') {
        ctx.fillStyle = `rgb(${profile.color})`;
        ctx.shadowBlur = 16;
        ctx.shadowColor = profile.glow;
        ctx.beginPath();
        ctx.ellipse(0, 0, profile.length / 2, profile.radius, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.ellipse(profile.length * 0.12, 0, profile.length / 5, profile.radius / 2, 0, 0, 2 * Math.PI);
        ctx.fill();
        return;
      }
      ctx.fillStyle = `rgb(${profile.color})`;
      ctx.shadowBlur = 10;
      ctx.shadowColor = profile.glow;
      ctx.beginPath();
      ctx.arc(0, 0, profile.radius, 0, 2 * Math.PI);
      ctx.fill();
    }
  });
  return id;
}
