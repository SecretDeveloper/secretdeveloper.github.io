// asteroid.js
// Asteroid entity definition and rendering
import { rand, degToRad } from './utils.js';

const asteroidImages = [];
['asteroid1.svg', 'asteroid2.svg', 'asteroid3.svg', 'asteroid4.svg'].forEach(src => {
  const img = new Image();
  img.src = src;
  asteroidImages.push(img);
});

/**
 * Represents a drifting, spinning asteroid.
 */
export class Asteroid {
  constructor(x, y, size, game) {
    this.game = game;
    this.x = x;
    this.y = y;
    this.size = size || rand(20, 60);
    const speed = rand(1, 3) / this.size * 30;
    const angle = rand(0, 360);
    this.velX = speed * Math.cos(degToRad(angle));
    this.velY = speed * Math.sin(degToRad(angle));
    this.rotation = rand(0, 360);
    this.rotationSpeed = rand(-0.5, 0.5);
    this.img = asteroidImages[Math.floor(rand(0, asteroidImages.length))];
  }
  update() {
    this.x += this.velX;
    this.y += this.velY;
    this.rotation = (this.rotation + this.rotationSpeed + 360) % 360;
    // wrap around edges
    if (this.x < 0) this.x += this.game.W;
    else if (this.x > this.game.W) this.x -= this.game.W;
    if (this.y < 0) this.y += this.game.H;
    else if (this.y > this.game.H) this.y -= this.game.H;
  }
  draw(ctx) {
    if (this.img && this.img.complete) {
      ctx.save();
      // apply sector-based hue shift for visual variety
      const hueShift = ((this.game.level - 1) * 60) % 360;
      ctx.filter = `hue-rotate(${hueShift}deg) saturate(1.2)`;
      ctx.translate(this.x, this.y);
      ctx.rotate(degToRad(this.rotation));
      const sizePx = this.size * 2;
      ctx.drawImage(this.img, -sizePx / 2, -sizePx / 2, sizePx, sizePx);
      ctx.restore();
      // reset filter
      ctx.filter = 'none';
    } else {
      ctx.fillStyle = '#ccc';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
}