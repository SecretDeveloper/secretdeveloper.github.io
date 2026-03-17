// enemyFactory.js
// Creates enemy fighter entities in the ECS
import { rand, degToRad } from './utils.js';

const fighterImg = new Image();
fighterImg.src = new URL('./enemy-fighter.svg', import.meta.url).href;
const commandShipImg = new Image();
commandShipImg.src = new URL('./enemy-command-ship.svg', import.meta.url).href;

export function createEnemyFighterEntity(em, game, x, y) {
  const id = em.createEntity();
  const angle = rand(0, 360);
  const speed = rand(0.8, 1.6);
  const radius = 16;
  em.addComponent(id, 'position', { x, y });
  em.addComponent(id, 'velocity', {
    x: Math.cos(degToRad(angle)) * speed,
    y: Math.sin(degToRad(angle)) * speed
  });
  em.addComponent(id, 'rotation', { value: angle });
  em.addComponent(id, 'rotationSpeed', { value: 0 });
  em.addComponent(id, 'collider', { r: radius });
  em.addComponent(id, 'health', { value: 4 + Math.floor((game.level - 1) / 2) });
  em.addComponent(id, 'enemy', {
    type: 'fighter',
    accel: 0.045,
    maxSpeed: 2.8,
    preferredDistance: rand(130, 220),
    scoreValue: 5,
    fireInterval: rand(900, 1450),
    projectileType: 'enemy'
  });
  em.addComponent(id, 'renderable', {
    draw(ctx) {
      const pulse = Math.sin(performance.now() / 220 + id) * 0.5 + 0.5;
      ctx.rotate(degToRad(90));
      if (fighterImg.complete) {
        const size = radius * 2.7;
        ctx.shadowBlur = 16;
        ctx.shadowColor = 'rgba(255,100,90,0.45)';
        ctx.drawImage(fighterImg, -size / 2, -size / 2, size, size);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = '#ff5a4a';
        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(-radius * 0.5, radius * 0.85);
        ctx.lineTo(-radius * 0.2, 0);
        ctx.lineTo(-radius * 0.5, -radius * 0.85);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = `rgba(255,210,180,${0.28 + pulse * 0.24})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, radius * (1.15 + pulse * 0.08), 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  return id;
}

export function createEnemyCommandShipEntity(em, game, x, y) {
  const id = em.createEntity();
  const angle = rand(0, 360);
  const speed = rand(0.35, 0.7);
  const radius = 28;
  em.addComponent(id, 'position', { x, y });
  em.addComponent(id, 'velocity', {
    x: Math.cos(degToRad(angle)) * speed,
    y: Math.sin(degToRad(angle)) * speed
  });
  em.addComponent(id, 'rotation', { value: angle });
  em.addComponent(id, 'rotationSpeed', { value: 0 });
  em.addComponent(id, 'collider', { r: radius });
  em.addComponent(id, 'health', { value: 14 + game.level });
  em.addComponent(id, 'enemy', {
    type: 'command',
    accel: 0.022,
    maxSpeed: 1.7,
    preferredDistance: rand(200, 280),
    scoreValue: 20,
    fireInterval: rand(520, 820),
    projectileType: 'enemy'
  });
  em.addComponent(id, 'renderable', {
    draw(ctx) {
      const pulse = Math.sin(performance.now() / 260 + id) * 0.5 + 0.5;
      ctx.rotate(degToRad(90));
      if (commandShipImg.complete) {
        const size = radius * 3;
        ctx.shadowBlur = 22;
        ctx.shadowColor = 'rgba(110,170,255,0.45)';
        ctx.drawImage(commandShipImg, -size / 2, -size / 2, size, size);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = '#4a7cff';
        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(radius * 0.35, radius * 0.78);
        ctx.lineTo(-radius * 0.8, radius * 0.62);
        ctx.lineTo(-radius, 0);
        ctx.lineTo(-radius * 0.8, -radius * 0.62);
        ctx.lineTo(radius * 0.35, -radius * 0.78);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = `rgba(200,225,255,${0.32 + pulse * 0.3})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, radius * (1.1 + pulse * 0.05), 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  return id;
}
