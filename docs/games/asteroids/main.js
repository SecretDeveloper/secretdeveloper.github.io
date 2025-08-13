// main.js
// Entry point: initialize game and audio
import { initAudioListeners } from './audio.js';
import { Game } from './game.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('c');
  const hudEl = document.getElementById('hud');
  const scoreEl = document.getElementById('score');
  const startScreenEl = document.getElementById('startScreen');
  initAudioListeners();
  // instantiate and start the game
  new Game(canvas, hudEl, scoreEl, startScreenEl);
});