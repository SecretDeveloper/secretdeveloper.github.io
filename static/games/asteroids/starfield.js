// starfield.js
// Manages multi-layered starfield and background parallax offsets
import { rand } from './utils.js';
import * as CONST from './constants.js';

/**
 * Starfield class: initializes, updates, and draws two layers of stars
 * and applies parallax to the galaxy background offsets in the Game.
 */
export class Starfield {
  constructor(game) {
    this.game = game;
    this.starsFar = [];
    this.starsNear = [];
    this.initStars();
  }

  /** Initialize star positions for far and near layers. */
  initStars() {
    const { W, H } = this.game;
    this.starsFar = [];
    for (let i = 0; i < CONST.STAR_COUNT; i++) {
      this.starsFar.push({
        x: rand(0, W),
        y: rand(0, H),
        r: rand(0.5, 1.2),
        baseAlpha: rand(0.2, 0.6),
        drift: rand(0.02, 0.1)
      });
    }
    this.starsNear = [];
    for (let i = 0; i < CONST.STAR_COUNT / 2; i++) {
      this.starsNear.push({
        x: rand(0, W),
        y: rand(0, H),
        r: rand(1.5, 3),
        baseAlpha: rand(0.1, 0.4),
        drift: rand(0.1, 0.3)
      });
    }
  }

  /** Update star positions and apply parallax. */
  update() {
    const game = this.game;
    // read ship velocity from ECS; default to zero if missing
    let vx = 0, vy = 0;
    if (game.em && game.shipEntity) {
      const velComp = game.em.getComponent(game.shipEntity, 'velocity');
      if (velComp) { vx = velComp.x; vy = velComp.y; }
    }
    const { W, H } = game;
    const parallax = CONST.STAR_PARALLAX;
    // Update far stars
    for (const s of this.starsFar) {
      s.x -= vx * parallax;
      s.y -= vy * parallax;
      s.y += s.drift;
      if (s.x < 0) s.x += W; else if (s.x > W) s.x -= W;
      if (s.y > H) s.y = 0; else if (s.y < 0) s.y = H;
    }
    // Update near stars (faster parallax)
    const fastPar = parallax * 1.5;
    for (const s of this.starsNear) {
      s.x -= vx * fastPar;
      s.y -= vy * fastPar;
      s.y += s.drift;
      if (s.x < 0) s.x += W; else if (s.x > W) s.x -= W;
      if (s.y > H) s.y = 0; else if (s.y < 0) s.y = H;
    }
    // Galaxy background parallax offset
    const galPar = parallax * 0.1;
    game.galaxyOffsetX += vx * galPar;
    game.galaxyOffsetY += vy * galPar;
  }

  /** Draw far and near stars onto the provided context. */
  draw(ctx) {
    const game = this.game;
    // Draw far stars
    for (const s of this.starsFar) {
      ctx.fillStyle = `rgba(255,255,255,${s.baseAlpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, 2 * Math.PI);
      ctx.fill();
    }
    // Draw near stars tinted by sector hue
    const hue = ((game.level - 1) * 60) % 360;
    for (const s of this.starsNear) {
      ctx.fillStyle = `hsla(${hue},70%,${Math.round(s.baseAlpha*100)}%,${s.baseAlpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
}