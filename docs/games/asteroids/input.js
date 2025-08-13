// input.js
// Keyboard input handling
import { KEY } from './constants.js';

/**
 * Object mapping key values to pressed state (true/false).
 */
export const keys = {};

/**
 * Initialize keyboard listeners to track key states.
 */
export function initInput() {
  window.addEventListener('keydown', e => {
    keys[e.key] = true;
  });
  window.addEventListener('keyup', e => {
    delete keys[e.key];
  });
}