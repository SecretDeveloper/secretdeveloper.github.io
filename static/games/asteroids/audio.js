// audio.js
// Web Audio API setup and sound effects
import { KEY } from './constants.js';

let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/** Play laser shot sound. */
export function playLaser() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(600, ctx.currentTime);
  gain.gain.setValueAtTime(0.02, ctx.currentTime);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.2);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  osc.stop(ctx.currentTime + 0.3);
}

/** Play asteroid chunk hit sound. */
export function playChunk() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  // Hammer impact noise
  const impactDur = 0.15;
  const impactLen = Math.floor(ctx.sampleRate * impactDur);
  const impactBuf = ctx.createBuffer(1, impactLen, ctx.sampleRate);
  const impactData = impactBuf.getChannelData(0);
  for (let i = 0; i < impactLen; i++) {
    impactData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impactLen, 2);
  }
  const impactSrc = ctx.createBufferSource();
  impactSrc.buffer = impactBuf;
  const impactGain = ctx.createGain();
  impactGain.gain.setValueAtTime(1, now);
  impactGain.gain.exponentialRampToValueAtTime(0.001, now + impactDur);
  const impactFil = ctx.createBiquadFilter();
  impactFil.type = 'lowpass';
  impactFil.frequency.setValueAtTime(500, now);
  impactSrc.connect(impactFil).connect(impactGain);
  impactGain.connect(ctx.destination);
  // Echo effect
  const delay = ctx.createDelay();
  delay.delayTime.setValueAtTime(0.25, now);
  const feedbackGain = ctx.createGain();
  feedbackGain.gain.setValueAtTime(0.5, now);
  delay.connect(feedbackGain).connect(delay);
  impactGain.connect(delay).connect(ctx.destination);
  impactSrc.start(now);
  // Rock fragment shards
  const shards = 3;
  for (let s = 0; s < shards; s++) {
    const offset = 0.04 + Math.random() * 0.06;
    const shardDur = 0.05;
    const shardLen = Math.floor(ctx.sampleRate * shardDur);
    const shardBuf = ctx.createBuffer(1, shardLen, ctx.sampleRate);
    const shardData = shardBuf.getChannelData(0);
    for (let j = 0; j < shardLen; j++) {
      shardData[j] = (Math.random() * 2 - 1) * (1 - j / shardLen);
    }
    const shardSrc = ctx.createBufferSource();
    shardSrc.buffer = shardBuf;
    const shardGain = ctx.createGain();
    shardGain.gain.setValueAtTime(0.6, now + offset);
    shardGain.gain.exponentialRampToValueAtTime(0.001, now + offset + shardDur);
    const shardFil = ctx.createBiquadFilter();
    shardFil.type = 'highpass';
    shardFil.frequency.setValueAtTime(1500 + Math.random() * 2000, now + offset);
    shardSrc.connect(shardFil).connect(shardGain).connect(ctx.destination);
    shardSrc.start(now + offset);
  }
}

/** Play shield clang sound. */
export function playShieldClang() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(100, ctx.currentTime);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.2);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  osc.stop(ctx.currentTime + 0.3);
}

/** Play power-up pickup sound. */
export function playPowerupPickup() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, ctx.currentTime);
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.3);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  osc.stop(ctx.currentTime + 0.4);
}

/** Play ship explosion sound. */
export function playExplosionSound() {
  const ctx = getAudioContext();
  const bufferSize = ctx.sampleRate * 0.5;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(5, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  noise.connect(gain).connect(ctx.destination);
  noise.start();
}

let thrustSource = null;
let thrustGain = null;
/** Start continuous thrust sound. */
export function startThrustSound() {
  if (thrustSource) return;
  const ctx = getAudioContext();
  const bufferSize = ctx.sampleRate * 1;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  thrustSource = ctx.createBufferSource();
  thrustSource.buffer = buffer;
  thrustSource.loop = true;
  thrustGain = ctx.createGain();
  thrustGain.gain.value = 0.003;
  thrustSource.connect(thrustGain).connect(ctx.destination);
  thrustSource.start();
}

/** Stop thrust sound with fade-out. */
export function stopThrustSound() {
  if (!thrustSource) return;
  const ctx = getAudioContext();
  thrustGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
  setTimeout(() => {
    if (thrustSource) thrustSource.stop();
    thrustSource = thrustGain = null;
  }, 200);
}

/**
 * Set up audio-specific input listeners (e.g. for thrust SFX).
 */
export function initAudioListeners() {
  window.addEventListener('keydown', e => {
    if (e.key === KEY.UP) startThrustSound();
  });
  window.addEventListener('keyup', e => {
    if (e.key === KEY.UP) stopThrustSound();
  });
}