// particle.js
// Particle systems for thruster and explosion effects
import { rand, degToRad } from './utils.js';
/** Pool for reusing thruster particles */
export const thrusterPool = [];
/** Pool for reusing explosion particles */
export const explosionPool = [];

/**
 * Particle emitted by ship thrusters.
 */
export class ThrusterParticle {
  constructor(x, y, angle) {
    this.init(x, y, angle);
  }
  /** Initialize or re-initialize particle state */
  init(x, y, angle) {
    this.x = x;
    this.y = y;
    const speed = rand(0.5, 1.5);
    this.velX = speed * Math.cos(degToRad(angle));
    this.velY = speed * Math.sin(degToRad(angle));
    this.life = 30;
    this.lifeMax = this.life;
    this.size = 2 + rand(-1, 1);
    const colors = ['255, 0, 0', '255, 165, 0', '128, 128, 128'];
    this.color = colors[Math.floor(rand(0, colors.length))];
  }
  update() {
    this.x += this.velX;
    this.y += this.velY;
    this.life--;
  }
  draw(ctx) {
    const alpha = Math.max(this.life / this.lifeMax, 0);
    ctx.fillStyle = `rgba(${this.color},${alpha})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, 2 * Math.PI);
    ctx.fill();
  }
}
/**
 * Obtain a ThrusterParticle from the pool or create a new one.
 */
export function createThrusterParticle(x, y, angle) {
  if (thrusterPool.length > 0) {
    const p = thrusterPool.pop();
    p.init(x, y, angle);
    return p;
  }
  return new ThrusterParticle(x, y, angle);
}

/**
 * Particle for ship explosion effect.
 */
export class ExplosionParticle {
  constructor(x, y) {
    this.init(x, y);
  }
  /** Initialize or re-initialize explosion particle */
  init(x, y) {
    this.x = x;
    this.y = y;
    const speed = rand(1, 5);
    const angle = rand(0, 360);
    this.velX = speed * Math.cos(degToRad(angle));
    this.velY = speed * Math.sin(degToRad(angle));
    this.life = rand(30, 60);
    this.lifeMax = this.life;
    this.size = rand(2, 5);
    const colors = ['255,0,0', '255,165,0'];
    this.color = colors[Math.floor(rand(0, colors.length))];
  }
  update() {
    this.x += this.velX;
    this.y += this.velY;
    this.life--;
  }
  draw(ctx) {
    const alpha = Math.max(this.life / this.lifeMax, 0);
    ctx.fillStyle = `rgba(${this.color},${alpha})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, 2 * Math.PI);
    ctx.fill();
  }
}
/**
 * Obtain an ExplosionParticle from the pool or create a new one.
 */
export function createExplosionParticle(x, y) {
  if (explosionPool.length > 0) {
    const p = explosionPool.pop();
    p.init(x, y);
    return p;
  }
  return new ExplosionParticle(x, y);
}