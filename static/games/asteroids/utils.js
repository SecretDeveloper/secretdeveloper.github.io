// utils.js
// General-purpose helper functions

/**
 * Return a random floating-point number in [min, max).
 */
export function rand(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Convert degrees to radians.
 */
export function degToRad(deg) {
  return deg * Math.PI / 180;
}

/**
 * Compute Euclidean distance between two points with {x,y}.
 */
export function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}