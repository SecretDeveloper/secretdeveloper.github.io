// wormhole.js
// Wormhole object that appears when a sector is cleared
import { degToRad } from './utils.js';
import { WORMHOLE_RADIUS, WORMHOLE_COLOR } from './constants.js';

/**
 * Wormhole portal for level transitions.
 */
export class Wormhole {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = WORMHOLE_RADIUS;
    this.time = 0;
  }
  update() {
    // animate pulsing
    this.time += 0.05;
  }
  draw(ctx) {
    const pulse = Math.sin(this.time) * 0.2 + 1;
    ctx.save();
    ctx.translate(this.x, this.y);
    // outer ring
    ctx.strokeStyle = WORMHOLE_COLOR;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, this.r * pulse, 0, 2 * Math.PI);
    ctx.stroke();
    // inner ring rotating
    ctx.rotate(this.time);
    ctx.beginPath();
    ctx.arc(0, 0, this.r * (1 - 0.2 * pulse), 0, Math.PI);
    ctx.stroke();
    ctx.restore();
  }
}