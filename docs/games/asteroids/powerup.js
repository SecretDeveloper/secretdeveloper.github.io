// powerup.js
// Power-up item management
import { rand } from './utils.js';
import { POWERUP_RADIUS, POWERUP_TYPES } from './constants.js';

/**
 * Represents a power-up dropped in the game field.
 */
export class Powerup {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.r = POWERUP_RADIUS;
    this.angle = 0;
    this.life = 600; // frames until auto-remove
  }
  update() {
    this.angle += 0.05;
    this.life--;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    let color, label;
    switch (this.type) {
      case POWERUP_TYPES.SHIELD:  color = 'lime';   label = 'S'; break;
      case POWERUP_TYPES.MACHINE: color = 'magenta'; label = 'M'; break;
      case POWERUP_TYPES.POWER:   color = 'cyan';    label = 'P'; break;
      case POWERUP_TYPES.MISSILE: color = 'orange';  label = 'X'; break;
    }
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, this.r, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }
}