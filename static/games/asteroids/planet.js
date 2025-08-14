// planet.js
// Static planet set-piece for each sector
import { rand } from './utils.js';

/**
 * Represent a static planet in the background.
 */
export class Planet {
  constructor(x, y, r, color) {
    this.x = x;
    this.y = y;
    this.r = r;
    this.color = color;
    this.rotation = rand(0, 360);
    this.rotationSpeed = rand(-0.1, 0.1);
  }
  update() {
    this.rotation = (this.rotation + this.rotationSpeed + 360) % 360;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation * Math.PI / 180);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  }
}