// planet.js
// Static planet set-piece for each sector
import { rand } from './utils.js';

/**
 * Represent a static planet in the background.
 */
export class Planet {
  /**
   * @param x,y center position
   * @param r  radius
   * @param h  hue (0-360) for base color
   */
  constructor(x, y, r, h) {
    this.x = x;
    this.y = y;
    this.r = r;
    // color parameters
    this.h = h;
    this.s = 50;
    this.l = 60;
    this.baseColor = `hsl(${h},${this.s}%,${this.l}%)`;
    this.rotation = rand(0, 360);
    this.rotationSpeed = rand(-0.1, 0.1);
    // generate irregular outline
    const points = 32;
    this.shape = new Path2D();
    for (let i = 0; i < points; i++) {
      const ang = (i / points) * Math.PI * 2;
      const variation = 1 + rand(-0.2, 0.2);
      const rad = this.r * variation;
      const px = Math.cos(ang) * rad;
      const py = Math.sin(ang) * rad;
      if (i === 0) this.shape.moveTo(px, py);
      else this.shape.lineTo(px, py);
    }
    this.shape.closePath();
    // generate surface patches
    this.patches = [];
    const compHue = (h + 60) % 360;
    const patchCount = Math.floor(rand(3, 6));
    for (let i = 0; i < patchCount; i++) {
      const ang = rand(0, Math.PI * 2);
      const distR = rand(0.3, 0.7) * this.r;
      const w = rand(0.2, 0.5) * this.r;
      const hgt = rand(0.1, 0.3) * this.r;
      const color = (i % 2 === 0)
        ? this.baseColor
        : `hsl(${compHue},${this.s}%,${this.l - 10}%)`;
      this.patches.push({
        x: Math.cos(ang) * distR,
        y: Math.sin(ang) * distR,
        w, h: hgt,
        color
      });
    }
  }
  update() {
    this.rotation = (this.rotation + this.rotationSpeed + 360) % 360;
  }
  draw(ctx) {
    const r = this.r;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);
    // slight blur and lower alpha to suggest distance
    ctx.save();
    ctx.filter = 'blur(1px)';
    ctx.globalAlpha = 0.6;
    // draw irregular planet shape
    ctx.fillStyle = this.baseColor;
    ctx.fill(this.shape);
    // clip to shape for patches and shading
    ctx.clip();
    // draw surface patches
    for (const p of this.patches) {
      ctx.beginPath();
      ctx.fillStyle = p.color;
      if (ctx.ellipse) {
        ctx.ellipse(p.x, p.y, p.w, p.h, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(p.x, p.y, p.w, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    // apply shadow (multiply)
    ctx.globalCompositeOperation = 'multiply';
    const sh = ctx.createRadialGradient(r * 0.4, r * 0.4, r * 0.1, 0, 0, r);
    sh.addColorStop(0, 'rgba(0,0,0,0.5)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    // apply highlight (screen)
    ctx.globalCompositeOperation = 'screen';
    const hl = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    hl.addColorStop(0, 'rgba(255,255,255,0.8)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
    ctx.restore();
  }
}