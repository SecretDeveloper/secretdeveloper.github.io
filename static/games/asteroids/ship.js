// ship.js
// Player ship definition and rendering
import { SHIP_RADIUS, SHIP_FRICTION } from './constants.js';
import { degToRad } from './utils.js';

const shipImg = new Image();
shipImg.src = 'ship.svg';

/**
 * The player's ship, with position, velocity, and drawing logic.
 */
export class Ship {
  constructor(game) {
    this.game = game;
    this.r = SHIP_RADIUS;
    this.reset();
    this.lastShot = 0;
  }
  reset() {
    this.x = this.game.W / 2;
    this.y = this.game.H / 2;
    this.angle = 0;
    this.velX = 0;
    this.velY = 0;
  }
  update() {
    this.x += this.velX;
    this.y += this.velY;
    // wrap around edges
    if (this.x < 0) this.x += this.game.W;
    else if (this.x > this.game.W) this.x -= this.game.W;
    if (this.y < 0) this.y += this.game.H;
    else if (this.y > this.game.H) this.y -= this.game.H;
    // apply friction
    this.velX *= SHIP_FRICTION;
    this.velY *= SHIP_FRICTION;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    // draw shield ring if active
    if (this.game.shield > 0) {
      const t = performance.now() / 300;
      const pulse = (Math.sin(t) * 0.5 + 0.5);
      const baseR = this.r * 2;
      const radius = baseR + (this.r * 0.4) * pulse;
      const lineW = 3 + 3 * pulse;
      let color;
      switch (this.game.shield) {
        case 3: color = 'rgba(0,255,0,0.3)'; break;
        case 2: color = 'rgba(255,255,0,0.3)'; break;
        case 1: color = 'rgba(255,0,0,0.3)'; break;
      }
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineW;
      ctx.stroke();
    }
    // rotate and draw ship image
    ctx.rotate(degToRad(this.angle + 90));
    if (shipImg.complete) {
      const size = this.r * 3;
      ctx.drawImage(shipImg, -size / 2, -size / 2, size, size);
    }
    ctx.restore();
  }
}