// galaxy.js
// Procedural spiral galaxy background generator
import { rand } from './utils.js';
import * as CONST from './constants.js';
// Toggle yellow star color when this global is set (e.g., window.DEBUG_GALAXY_YELLOW = true)
const DEBUG_YELLOW = (typeof window !== 'undefined' && window.DEBUG_GALAXY_YELLOW) || false;

/**
 * Create a new galaxy star field for a given sector.
 * @param width Canvas width
 * @param height Canvas height
 * @param level Sector level (drives arm count)
 * @returns Array of star objects {x,y,alpha,size}
 */
export function initGalaxy(width, height, level) {
  const stars = [];
  // random center around the screen center
  const cx = width * 0.5 + rand(-width * 0.2, width * 0.2);
  const cy = height * 0.5 + rand(-height * 0.2, height * 0.2);
  // overall galaxy scale relative to screen
  const scale = rand(0.3, 0.6);
  const maxR = (Math.min(width, height) / 2) * scale;
  // number of spiral arms, increases with level, capped at 8
  const arms = Math.min(8, 4 + Math.floor(level / 2));
  // stars per arm scaled by galaxy size (reduced for performance)
  const baseStars = 50;
  const starsPerArm = Math.max(20, Math.floor(baseStars * scale));
  // spiral twist amount randomized
  const twist = rand(2, 5);
  // elliptical distortion factors
  const xScale = rand(0.6, 1.0);
  const yScale = rand(0.6, 1.0);
  // random orientation offset
  const orientation = rand(0, 2 * Math.PI);
  // Spiral arms
  for (let a = 0; a < arms; a++) {
    const armAngle = (a / arms) * Math.PI * 2;
    for (let i = 0; i < starsPerArm; i++) {
      const t = Math.random();
      const r0 = Math.sqrt(t) * maxR;
      const theta = orientation + armAngle + twist * (r0 / maxR) + rand(-0.3, 0.3);
      const x = cx + r0 * Math.cos(theta) * xScale;
      const y = cy + r0 * Math.sin(theta) * yScale;
      const alpha = rand(0.3, 0.8) * (1 - r0 / maxR);
      const size = rand(0.5, 1.2);
      stars.push({ x, y, alpha, size });
    }
  }
  // Dense core cluster with varied size and count
  const coreCount = Math.floor(starsPerArm * rand(0.4, 0.7));
  const coreR = maxR * rand(0.1, 0.2);
  for (let i = 0; i < coreCount; i++) {
    const r0 = rand(0, coreR);
    const theta = orientation + rand(0, 2 * Math.PI);
    const x = cx + r0 * Math.cos(theta) * xScale;
    const y = cy + r0 * Math.sin(theta) * yScale;
    const alpha = rand(0.5, 1) * (1 - r0 / coreR);
    const size = rand(0.8, 1.5);
    stars.push({ x, y, alpha, size });
  }
  return stars;
}

/**
 * Update star positions for subtle parallax.
 * @param stars Array of star objects
 * @param vx Ship velocity x
 * @param vy Ship velocity y
 * @param width Canvas width
 * @param height Canvas height
 */
export function updateGalaxy(stars, vx, vy, width, height) {
  const par = CONST.STAR_PARALLAX * 0.1;
  for (const s of stars) {
    s.x -= vx * par;
    s.y -= vy * par;
    if (s.x < 0) s.x += width;
    else if (s.x > width) s.x -= width;
    if (s.y < 0) s.y += height;
    else if (s.y > height) s.y -= height;
  }
}

/**
 * Draw galaxy stars on the canvas.
 * @param ctx CanvasRenderingContext2D
 * @param stars Array of star objects
 */
export function drawGalaxy(ctx, stars) {
  ctx.save();
  // subtle blur and lower alpha to blend into background
  ctx.filter = 'blur(1px)';
  ctx.globalAlpha = 0.9;
  const colorRGB = '255,255,255';
  for (const s of stars) {
    ctx.fillStyle = `rgba(${colorRGB},${s.alpha})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.restore();
}
