// bullet.js
// Projectile definitions: bullets and homing missiles
import { rand, degToRad } from './utils.js';

/**
 * Standard bullet projectile.
 */
export class Bullet {
  constructor(x, y, angle, game) {
    this.x = x;
    this.y = y;
    const speed = rand(game.bulletSpeedMin, game.bulletSpeedMax);
    this.velX = speed * Math.cos(degToRad(angle));
    this.velY = speed * Math.sin(degToRad(angle));
    this.lifetime = game.bulletLife;
    this.r = game.bulletSize;
    this.game = game;
  }
  update() {
    this.x += this.velX;
    this.y += this.velY;
    this.lifetime--;
    // expire if off-screen
    if (this.x < 0 || this.x > this.game.W || this.y < 0 || this.y > this.game.H) {
      this.lifetime = 0;
    }
  }
  draw(ctx) {
    ctx.fillStyle = '#ff0';
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, 2 * Math.PI); ctx.fill();
  }
}

/**
 * Homing missile that adjusts trajectory toward nearest asteroid.
 */
export class Missile extends Bullet {
  update() {
    if (this.game.asteroids.length) {
      let closest = null;
      let minD = Infinity;
      for (const a of this.game.asteroids) {
        const dx = a.x - this.x;
        const dy = a.y - this.y;
        const d = Math.hypot(dx, dy);
        if (d < minD) { minD = d; closest = a; }
      }
      if (closest) {
        const angle = Math.atan2(closest.y - this.y, closest.x - this.x);
        const speed = Math.hypot(this.velX, this.velY) || (this.game.bulletSpeedMax + this.game.bulletSpeedMin) / 2;
        this.velX = speed * Math.cos(angle);
        this.velY = speed * Math.sin(angle);
      }
    }
    super.update();
  }
}