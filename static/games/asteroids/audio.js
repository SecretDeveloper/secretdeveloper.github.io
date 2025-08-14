// audio.js
// Web Audio API setup and sound effects
import { KEY } from './constants.js';

let audioCtx = null;
// Background music nodes
let bgOsc = null;
let bgLfo = null;
let bgGain = null;
let bgFilter = null;
// Drum/arpeggio loop state
let drumInterval = null;
let drumHiHatInterval = null;
let arpeggioInterval = null;
let drumIndex = 0;
let arpeggioIndex = 0;
// Arpeggio note frequencies (major triad + octave)
const arpeggioNotes = [261.63, 329.63, 392.00, 523.25];
// Drum tempo
const DRUM_BPM = 140;
const BEAT_DUR = 60 / DRUM_BPM;
function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
/**
 * Start looping background synth pad music.
 */
export function startBackgroundMusic() {
  const ctx = getAudioContext();
  if (bgGain) return; // already playing
  // gain for volume control
  bgGain = ctx.createGain();
  // quieter pad (half volume)
  bgGain.gain.setValueAtTime(0.025, ctx.currentTime);
  bgGain.connect(ctx.destination);
  // lowpass filter for tonal shaping
  bgFilter = ctx.createBiquadFilter();
  bgFilter.type = 'lowpass';
  bgFilter.frequency.setValueAtTime(400, ctx.currentTime);
  bgFilter.connect(bgGain);
  // LFO to modulate filter cutoff
  bgLfo = ctx.createOscillator();
  bgLfo.frequency.setValueAtTime(0.1, ctx.currentTime);
  const lfoGain = ctx.createGain();
  lfoGain.gain.setValueAtTime(300, ctx.currentTime);
  bgLfo.connect(lfoGain).connect(bgFilter.frequency);
  bgLfo.start(ctx.currentTime);
  // main oscillator (synth pad)
  bgOsc = ctx.createOscillator();
  bgOsc.type = 'sawtooth';
  bgOsc.frequency.setValueAtTime(110, ctx.currentTime);
  bgOsc.connect(bgFilter);
  bgOsc.start(ctx.currentTime);
  // start drum and arpeggio loops
  startDrumArp();
}
/**
 * Stop background music with fade-out.
 */
export function stopBackgroundMusic() {
  const ctx = getAudioContext();
  if (!bgGain) return;
  // fade out
  bgGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
  // clean up after fade
  setTimeout(() => {
    if (bgOsc) { bgOsc.stop(); bgOsc.disconnect(); bgOsc = null; }
    if (bgLfo) { bgLfo.stop(); bgLfo.disconnect(); bgLfo = null; }
    if (bgFilter) { bgFilter.disconnect(); bgFilter = null; }
    if (bgGain) { bgGain.disconnect(); bgGain = null; }
    // stop drum and arpeggio loops
    stopDrumArp();
  }, 1500);
}
/**
 * Adjust background music volume (0.0 to 1.0).
 */
export function setMusicVolume(vol) {
  const ctx = getAudioContext();
  if (bgGain) {
    bgGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.1);
  }
}
// Cached buffer for hammer-blow impact noise
let impactBuffer = null;

/**
 * Start kick/snare/hi-hat and arpeggio loops.
 */
export function startDrumArp() {
  if (drumInterval) return;
  const ctx = getAudioContext();
  // quarter-note kick/snare
  drumIndex = 0;
  drumInterval = setInterval(() => {
    const t = ctx.currentTime;
    if (drumIndex % 2 === 0) playKick(t);
    else playSnare(t);
    drumIndex = (drumIndex + 1) % 4;
  }, BEAT_DUR * 1000);
  // eighth-note hi-hat
  drumHiHatInterval = setInterval(() => {
    playHiHat(ctx.currentTime);
  }, (BEAT_DUR * 1000) / 2);
  // eighth-note arpeggio
  arpeggioIndex = 0;
  arpeggioInterval = setInterval(() => {
    const t = ctx.currentTime;
    const freq = arpeggioNotes[arpeggioIndex % arpeggioNotes.length];
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(freq, t);
    gain2.gain.setValueAtTime(0.05, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + BEAT_DUR / 2);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(t);
    osc2.stop(t + BEAT_DUR / 2);
    arpeggioIndex++;
  }, (BEAT_DUR * 1000) / 2);
}

/**
 * Stop and clear all drum/arpeggio loops.
 */
export function stopDrumArp() {
  clearInterval(drumInterval);
  clearInterval(drumHiHatInterval);
  clearInterval(arpeggioInterval);
  drumInterval = drumHiHatInterval = arpeggioInterval = null;
}

// --- Drum synth functions ---
/** Play a short kick drum. */
export function playKick(time) {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(0.001, time + 0.2);
  // lower kick volume by half
  gain.gain.setValueAtTime(0.5, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.2);
}
/** Play a snare-like noise burst. */
export function playSnare(time) {
  const ctx = getAudioContext();
  const bufSize = ctx.sampleRate * 0.2;
  const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource(); noise.buffer = buffer;
  const filter = ctx.createBiquadFilter(); filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1000, time);
  const gain = ctx.createGain();
  // lower snare volume by half
  gain.gain.setValueAtTime(0.5, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
  noise.connect(filter).connect(gain).connect(ctx.destination);
  noise.start(time);
  noise.stop(time + 0.2);
}
/** Play a hi-hat noise burst (short, high-pass). */
export function playHiHat(time) {
  const ctx = getAudioContext();
  const bufSize = ctx.sampleRate * 0.05;
  const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource(); noise.buffer = buffer;
  const filter = ctx.createBiquadFilter(); filter.type = 'highpass';
  filter.frequency.setValueAtTime(5000, time);
  const gain = ctx.createGain();
  // lower hi-hat volume by half
  gain.gain.setValueAtTime(0.15, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  noise.connect(filter).connect(gain).connect(ctx.destination);
  noise.start(time);
  noise.stop(time + 0.05);
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
/**
 * Play asteroid chunk hit SFX with positional panning and size-based variation.
 * @param {number} pan - Stereo pan value (-1 left to +1 right).
 * @param {number} size - Asteroid size to scale shard count.
 */
export function playChunk(pan = 0, size = 40) {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  // stereo panner for positional audio
  const panner = ctx.createStereoPanner();
  panner.pan.setValueAtTime(pan, now);
  panner.connect(ctx.destination);
  // Hammer impact noise
  const impactDur = 0.15;
  // Generate and cache impact buffer once
  if (!impactBuffer) {
    const impactLen = Math.floor(ctx.sampleRate * impactDur);
    impactBuffer = ctx.createBuffer(1, impactLen, ctx.sampleRate);
    const impactData = impactBuffer.getChannelData(0);
    for (let i = 0; i < impactLen; i++) {
      impactData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impactLen, 2);
    }
  }
  const impactSrc = ctx.createBufferSource();
  impactSrc.buffer = impactBuffer;
  const impactGain = ctx.createGain();
  impactGain.gain.setValueAtTime(1, now);
  impactGain.gain.exponentialRampToValueAtTime(0.001, now + impactDur);
  const impactFil = ctx.createBiquadFilter();
  impactFil.type = 'lowpass';
  impactFil.frequency.setValueAtTime(500, now);
  impactSrc.connect(impactFil).connect(impactGain);
  impactGain.connect(panner);
  // Echo effect
  const delay = ctx.createDelay();
  delay.delayTime.setValueAtTime(0.25, now);
  const feedbackGain = ctx.createGain();
  feedbackGain.gain.setValueAtTime(0.5, now);
  delay.connect(feedbackGain).connect(delay);
  impactGain.connect(delay).connect(panner);
  impactSrc.start(now);
  // Rock fragment shards (count based on asteroid size)
  const shardCount = Math.min(5, Math.max(1, Math.floor(size / 15)));
  for (let s = 0; s < shardCount; s++) {
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
    shardSrc.connect(shardFil).connect(shardGain).connect(panner);
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

/**
 * Suspend all audio (pause music and SFX).
 */
export function suspendAudio() {
  const ctx = getAudioContext();
  if (ctx.state === 'running') ctx.suspend();
}

/**
 * Resume audio after suspension.
 */
export function resumeAudio() {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') ctx.resume();
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