// audio.js
// Web Audio API setup and sound effects
import { KEY } from './constants.js';

let audioCtx = null;
// Background music nodes
let bgOsc = null;
let bgLfo = null;
let bgGain = null;
let bgFilter = null;
let bassGain = null;
let dangerGain = null;
let masterMusicGain = null;
let weaponMusicGain = null;
// Drum/arpeggio loop state
// Drum/arpeggio loop state (legacy setInterval vars removed)
let drumIndex = 0;
let arpeggioIndex = 0;
let bassIndex = 0;
let quarterCount = 0;
let eighthCount = 0;
// Scheduler state for sample-accurate drum and arpeggio loops
let nextQuarterTime = 0;
let nextEighthTime = 0;
let loopStartTime = 0;
let quarterTimerID = null;
let eighthTimerID = null;
// Scheduling parameters
const scheduleAheadTime = 0.1; // seconds
const lookahead = 25.0;        // milliseconds
// Drum tempo
const DRUM_BPM = 140;
const BEAT_DUR = 60 / DRUM_BPM;
const MUSIC_PRESETS = {
  calm: {
    arp: [261.63, 329.63, 392.0, 523.25],
    bass: [65.41, 65.41, 98.0, 82.41],
    padFreq: 110,
    filterBase: 360
  },
  debris: {
    arp: [220.0, 293.66, 329.63, 392.0],
    bass: [55.0, 55.0, 73.42, 82.41],
    padFreq: 98,
    filterBase: 300
  },
  ion: {
    arp: [293.66, 369.99, 440.0, 587.33],
    bass: [73.42, 73.42, 92.5, 110.0],
    padFreq: 146.83,
    filterBase: 480
  },
  salvage: {
    arp: [246.94, 311.13, 369.99, 493.88],
    bass: [61.74, 61.74, 92.5, 82.41],
    padFreq: 123.47,
    filterBase: 380
  },
  fortress: {
    arp: [196.0, 246.94, 293.66, 392.0],
    bass: [49.0, 49.0, 58.27, 73.42],
    padFreq: 82.41,
    filterBase: 260
  }
};
let musicState = {
  preset: MUSIC_PRESETS.calm,
  modifierId: 'calm',
  danger: 0,
  asteroidCount: 5,
  shield: 3
};

function currentPreset() {
  return musicState.preset || MUSIC_PRESETS.calm;
}

function musicBus(ctx) {
  return weaponMusicGain || masterMusicGain || ctx.destination;
}

function quantizeToGrid(time, stepDuration) {
  const anchor = loopStartTime || time;
  if (stepDuration <= 0) return time;
  const steps = Math.ceil(Math.max(0, time - anchor) / stepDuration);
  return anchor + steps * stepDuration;
}

function arpNoteAtTime(time) {
  const preset = currentPreset();
  const notes = preset.arp;
  const stepDuration = BEAT_DUR / 2;
  const anchor = loopStartTime || time;
  const stepIndex = Math.max(0, Math.round((time - anchor) / stepDuration));
  return notes[stepIndex % notes.length];
}

function bassNoteAtTime(time) {
  const preset = currentPreset();
  const notes = preset.bass;
  const anchor = loopStartTime || time;
  const stepIndex = Math.max(0, Math.round((time - anchor) / BEAT_DUR));
  return notes[stepIndex % notes.length];
}

function pulseMusicDuck(time, amount = 0.08, duration = 0.12) {
  if (!masterMusicGain) return;
  const gain = masterMusicGain.gain;
  const current = Math.max(gain.value || 0.001, 0.001);
  gain.cancelScheduledValues(time);
  gain.setValueAtTime(current, time);
  gain.linearRampToValueAtTime(Math.max(0.001, current - amount), time + 0.01);
  gain.exponentialRampToValueAtTime(current, time + duration);
}

function isFillBar() {
  return Math.floor(quarterCount / 4) % 8 === 7;
}

function playQuarterGroove(time) {
  const step = quarterCount % 4;
  const fillBar = isFillBar();
  if (fillBar) {
    playKick(time);
    if (step === 1 || step === 3) playSnare(time + 0.02);
    return;
  }
  switch (musicState.modifierId) {
    case 'fortress':
      if (step === 0 || step === 2) playKick(time);
      else playSnare(time);
      break;
    case 'debris':
      if (step === 0 || step === 2) playKick(time);
      if (step === 1 || step === 3) playSnare(time);
      break;
    case 'salvage':
      if (step === 0) playKick(time);
      else if (step === 2) playKick(time + 0.03);
      else playSnare(time);
      break;
    default:
      if (drumIndex % 2 === 0) playKick(time);
      else playSnare(time);
      break;
  }
}

function playEighthGroove(time) {
  const step = eighthCount % 8;
  const fillBar = isFillBar();
  if (fillBar) {
    playHiHat(time);
    if (step % 2 === 1) playHiHat(time + 0.03);
    return;
  }
  switch (musicState.modifierId) {
    case 'ion':
      playHiHat(time);
      if (step % 2 === 1) playHiHat(time + 0.02);
      break;
    case 'fortress':
      if (step % 2 === 0) playHiHat(time);
      break;
    case 'salvage':
      if (step !== 3) playHiHat(time);
      break;
    default:
      playHiHat(time);
      break;
  }
}

/**
 * Scheduler code for sample-accurate drum & arpeggio loops.
 * Scheduled events will be played at precise AudioContext times.
 */
function quarterScheduler() {
  const ctx = getAudioContext();
  while (nextQuarterTime < ctx.currentTime + scheduleAheadTime) {
    playQuarterGroove(nextQuarterTime);
    const bassFreq = currentPreset().bass[bassIndex % currentPreset().bass.length];
    playBass(bassFreq, nextQuarterTime);
    drumIndex = (drumIndex + 1) % 4;
    bassIndex = (bassIndex + 1) % currentPreset().bass.length;
    quarterCount++;
    nextQuarterTime += BEAT_DUR;
  }
  quarterTimerID = setTimeout(quarterScheduler, lookahead);
}

function eighthScheduler() {
  const ctx = getAudioContext();
  while (nextEighthTime < ctx.currentTime + scheduleAheadTime) {
    playEighthGroove(nextEighthTime);
    const preset = currentPreset();
    const freq = preset.arp[arpeggioIndex % preset.arp.length];
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = musicState.modifierId === 'ion' ? 'triangle' : 'square';
    osc2.frequency.setValueAtTime(freq, nextEighthTime);
    const arpGain = 0.03 + musicState.danger * 0.035;
    gain2.gain.setValueAtTime(arpGain, nextEighthTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, nextEighthTime + BEAT_DUR / 2);
    osc2.connect(gain2).connect(masterMusicGain || ctx.destination);
    osc2.start(nextEighthTime);
    osc2.stop(nextEighthTime + BEAT_DUR / 2);
    if (musicState.danger > 0.6 && arpeggioIndex % 4 === 0) {
      playDangerPulse(nextEighthTime, freq / 2);
    }
    arpeggioIndex++;
    eighthCount++;
    nextEighthTime += BEAT_DUR / 2;
  }
  eighthTimerID = setTimeout(eighthScheduler, lookahead);
}
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
  masterMusicGain = ctx.createGain();
  masterMusicGain.gain.setValueAtTime(1, ctx.currentTime);
  masterMusicGain.connect(ctx.destination);
  weaponMusicGain = ctx.createGain();
  weaponMusicGain.gain.setValueAtTime(0.55, ctx.currentTime);
  weaponMusicGain.connect(ctx.destination);
  // gain for volume control
  bgGain = ctx.createGain();
  // quieter pad (half volume)
  bgGain.gain.setValueAtTime(0.025, ctx.currentTime);
  bgGain.connect(masterMusicGain);
  bassGain = ctx.createGain();
  bassGain.gain.setValueAtTime(0.045, ctx.currentTime);
  bassGain.connect(masterMusicGain);
  dangerGain = ctx.createGain();
  dangerGain.gain.setValueAtTime(0.001, ctx.currentTime);
  dangerGain.connect(masterMusicGain);
  // lowpass filter for tonal shaping
  bgFilter = ctx.createBiquadFilter();
  bgFilter.type = 'lowpass';
  bgFilter.frequency.setValueAtTime(currentPreset().filterBase, ctx.currentTime);
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
  bgOsc.frequency.setValueAtTime(currentPreset().padFreq, ctx.currentTime);
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
    if (bassGain) { bassGain.disconnect(); bassGain = null; }
    if (dangerGain) { dangerGain.disconnect(); dangerGain = null; }
    if (masterMusicGain) { masterMusicGain.disconnect(); masterMusicGain = null; }
    if (weaponMusicGain) { weaponMusicGain.disconnect(); weaponMusicGain = null; }
    // stop drum and arpeggio loops
    stopDrumArp();
  }, 1500);
}
/**
 * Adjust background music volume (0.0 to 1.0).
 */
export function setMusicVolume(vol) {
  const ctx = getAudioContext();
  if (masterMusicGain) {
    masterMusicGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.1);
  }
}
/**
 * Immediately stop and disconnect background music and loops.
 */
export function stopBackgroundMusicImmediate() {
  // stop and disconnect background pad
  if (bgOsc) { bgOsc.stop(); bgOsc.disconnect(); bgOsc = null; }
  if (bgLfo) { bgLfo.stop(); bgLfo.disconnect(); bgLfo = null; }
  if (bgFilter) { bgFilter.disconnect(); bgFilter = null; }
  if (bgGain) { bgGain.disconnect(); bgGain = null; }
  if (bassGain) { bassGain.disconnect(); bassGain = null; }
  if (dangerGain) { dangerGain.disconnect(); dangerGain = null; }
  if (masterMusicGain) { masterMusicGain.disconnect(); masterMusicGain = null; }
  if (weaponMusicGain) { weaponMusicGain.disconnect(); weaponMusicGain = null; }
  // stop drum and arpeggio loops
stopDrumArp();
}
/**
 * Play a short intro fanfare when the game begins (before background music).
 * Uses a soft swell and rising motif to match the ship emerging from the portal.
 */
export function startIntroFanfare() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const preset = currentPreset();
  const motif = [preset.arp[0], preset.arp[1], preset.arp[3], preset.arp[2], preset.arp[3] * 0.5];
  const root = preset.bass[0];

  const padOsc = ctx.createOscillator();
  const padGain = ctx.createGain();
  const padFilter = ctx.createBiquadFilter();
  padOsc.type = 'triangle';
  padOsc.frequency.setValueAtTime(root, now);
  padOsc.frequency.linearRampToValueAtTime(root * 1.5, now + 1.2);
  padFilter.type = 'lowpass';
  padFilter.frequency.setValueAtTime(280, now);
  padFilter.frequency.linearRampToValueAtTime(1400, now + 1.4);
  padGain.gain.setValueAtTime(0.001, now);
  padGain.gain.exponentialRampToValueAtTime(0.08, now + 0.35);
  padGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
  padOsc.connect(padFilter).connect(padGain).connect(ctx.destination);
  padOsc.start(now);
  padOsc.stop(now + 1.55);

  motif.forEach((freq, i) => {
    const t = now + i * 0.18;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = i < motif.length - 1 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.linearRampToValueAtTime(freq * 1.08, t + 0.18);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(i === motif.length - 1 ? 0.16 : 0.09, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.32);
  });

  const shimmerOsc = ctx.createOscillator();
  const shimmerGain = ctx.createGain();
  shimmerOsc.type = 'sine';
  shimmerOsc.frequency.setValueAtTime(preset.arp[3] * 2, now + 0.55);
  shimmerOsc.frequency.exponentialRampToValueAtTime(preset.arp[3] * 2.8, now + 1.1);
  shimmerGain.gain.setValueAtTime(0.001, now + 0.55);
  shimmerGain.gain.exponentialRampToValueAtTime(0.05, now + 0.62);
  shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
  shimmerOsc.connect(shimmerGain).connect(ctx.destination);
  shimmerOsc.start(now + 0.55);
  shimmerOsc.stop(now + 1.25);
}
// Cached buffer for hammer-blow impact noise
let impactBuffer = null;

/**
 * Start sample-accurate drum (kick/snare) and arpeggio loops.
 */
export function startDrumArp() {
  if (quarterTimerID || eighthTimerID) return; // already running
  const ctx = getAudioContext();
  drumIndex = 0;
  arpeggioIndex = 0;
  bassIndex = 0;
  quarterCount = 0;
  eighthCount = 0;
  // schedule start slightly in the future for smooth playback
  loopStartTime = ctx.currentTime + 0.05;
  nextQuarterTime = ctx.currentTime + 0.05;
  nextEighthTime  = ctx.currentTime + 0.05;
  quarterScheduler();
  eighthScheduler();
}

/**
 * Stop drum and arpeggio loops.
 */
export function stopDrumArp() {
  if (quarterTimerID) {
    clearTimeout(quarterTimerID);
    quarterTimerID = null;
  }
  if (eighthTimerID) {
    clearTimeout(eighthTimerID);
    eighthTimerID = null;
  }
  loopStartTime = 0;
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

export function playBass(freq, time) {
  const ctx = getAudioContext();
  if (!bassGain) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = musicState.modifierId === 'fortress' ? 'square' : 'sine';
  osc.frequency.setValueAtTime(freq, time);
  gain.gain.setValueAtTime(0.18, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + BEAT_DUR * 0.9);
  osc.connect(gain).connect(bassGain);
  osc.start(time);
  osc.stop(time + BEAT_DUR);
}

function playDangerPulse(time, freq) {
  const ctx = getAudioContext();
  if (!dangerGain) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, time);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.8, time + BEAT_DUR / 3);
  gain.gain.setValueAtTime(0.001, time);
  gain.gain.exponentialRampToValueAtTime(0.06 + musicState.danger * 0.08, time + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, time + BEAT_DUR / 2);
  osc.connect(gain).connect(dangerGain);
  osc.start(time);
  osc.stop(time + BEAT_DUR / 2);
}

export function setMusicContext({ modifierId, asteroidCount, shield } = {}) {
  const ctx = getAudioContext();
  if (modifierId && MUSIC_PRESETS[modifierId]) {
    musicState.modifierId = modifierId;
    musicState.preset = MUSIC_PRESETS[modifierId];
    if (bgOsc) bgOsc.frequency.setTargetAtTime(musicState.preset.padFreq, ctx.currentTime, 0.4);
    if (bgFilter) bgFilter.frequency.setTargetAtTime(musicState.preset.filterBase + musicState.danger * 180, ctx.currentTime, 0.3);
  }
  if (typeof asteroidCount === 'number') musicState.asteroidCount = asteroidCount;
  if (typeof shield === 'number') musicState.shield = shield;
  const shieldDanger = Math.max(0, (2 - Math.max(musicState.shield, 0)) / 2);
  const asteroidDanger = Math.min(1, musicState.asteroidCount / 10);
  musicState.danger = Math.max(shieldDanger, asteroidDanger * 0.5);
  if (dangerGain) {
    dangerGain.gain.setTargetAtTime(0.001 + musicState.danger * 0.12, ctx.currentTime, 0.2);
  }
  if (bgFilter) {
    bgFilter.frequency.setTargetAtTime(musicState.preset.filterBase + musicState.danger * 180, ctx.currentTime, 0.3);
  }
}

export function playWormholeStinger() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const notes = currentPreset().arp.slice(-3);
  notes.forEach((freq, i) => {
    const t = now + i * 0.08;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.18);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(gain).connect(masterMusicGain || ctx.destination);
    osc.start(t);
    osc.stop(t + 0.24);
  });
}

export function playSectorAdvanceStinger() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const notes = currentPreset().arp;
  notes.forEach((freq, i) => {
    const t = now + i * 0.1;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 2, t + 0.25);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain).connect(masterMusicGain || ctx.destination);
    osc.start(t);
    osc.stop(t + 0.32);
  });
}

/** Play laser shot sound. */
export function playLaser(weaponType = 'default') {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const bus = musicBus(ctx);
  if (weaponType === 'enemy') {
    const shotTime = quantizeToGrid(now + 0.015, BEAT_DUR / 2);
    const shotFreq = arpNoteAtTime(shotTime) * 0.9;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const noiseLen = Math.floor(ctx.sampleRate * 0.045);
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen);
    const noise = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(shotFreq * 1.6, now);
    osc.frequency.exponentialRampToValueAtTime(shotFreq * 0.9, now + 0.08);
    gain.gain.setValueAtTime(0.012, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    noise.buffer = noiseBuf;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    noiseGain.gain.setValueAtTime(0.01, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain).connect(bus);
    noise.connect(filter).connect(noiseGain).connect(bus);
    osc.start(now);
    noise.start(now);
    osc.stop(now + 0.11);
    noise.stop(now + 0.06);
    return;
  }
  if (weaponType === 'machine') {
    const grooveTime = quantizeToGrid(now + 0.01, BEAT_DUR / 4);
    const grooveFreq = arpNoteAtTime(grooveTime) * 2;
    const noiseLen = Math.floor(ctx.sampleRate * 0.035);
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen);
    const noise = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    noise.buffer = noiseBuf;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, now);
    filter.Q.setValueAtTime(4, now);
    gain.gain.setValueAtTime(0.018, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    noise.connect(filter).connect(gain).connect(bus);
    noise.start(now);
    noise.stop(now + 0.05);
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'square';
    clickOsc.frequency.setValueAtTime(grooveFreq * 1.8, now);
    clickOsc.frequency.exponentialRampToValueAtTime(grooveFreq, now + 0.03);
    clickGain.gain.setValueAtTime(0.01, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    clickOsc.connect(clickGain).connect(bus);
    clickOsc.start(now);
    clickOsc.stop(now + 0.04);

    const pulseOsc = ctx.createOscillator();
    const pulseGain = ctx.createGain();
    pulseOsc.type = musicState.modifierId === 'ion' ? 'triangle' : 'square';
    pulseOsc.frequency.setValueAtTime(grooveFreq, grooveTime);
    pulseOsc.frequency.exponentialRampToValueAtTime(grooveFreq * 0.8, grooveTime + 0.06);
    pulseGain.gain.setValueAtTime(0.001, grooveTime);
    pulseGain.gain.exponentialRampToValueAtTime(0.014, grooveTime + 0.008);
    pulseGain.gain.exponentialRampToValueAtTime(0.001, grooveTime + 0.07);
    pulseOsc.connect(pulseGain).connect(bus);
    pulseOsc.start(grooveTime);
    pulseOsc.stop(grooveTime + 0.08);
    return;
  }
  if (weaponType === 'power') {
    const impactTime = quantizeToGrid(now + 0.03, BEAT_DUR);
    const rootFreq = bassNoteAtTime(impactTime) * 2;
    const fifthFreq = rootFreq * 1.5;
    const chargeOsc = ctx.createOscillator();
    const chargeGain = ctx.createGain();
    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    const tailOsc = ctx.createOscillator();
    const tailGain = ctx.createGain();
    const noiseLen = Math.floor(ctx.sampleRate * 0.14);
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / noiseLen, 2);
    }
    const noise = ctx.createBufferSource();
    const noiseFilter = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();

    chargeOsc.type = 'sine';
    bodyOsc.type = 'sawtooth';
    tailOsc.type = 'triangle';

    chargeOsc.frequency.setValueAtTime(420, now);
    chargeOsc.frequency.exponentialRampToValueAtTime(900, now + 0.045);
    bodyOsc.frequency.setValueAtTime(210, now + 0.015);
    bodyOsc.frequency.exponentialRampToValueAtTime(80, now + 0.34);
    tailOsc.frequency.setValueAtTime(980, now + 0.02);
    tailOsc.frequency.exponentialRampToValueAtTime(260, now + 0.3);

    chargeGain.gain.setValueAtTime(0.001, now);
    chargeGain.gain.exponentialRampToValueAtTime(0.03, now + 0.015);
    chargeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    bodyGain.gain.setValueAtTime(0.001, now + 0.01);
    bodyGain.gain.exponentialRampToValueAtTime(0.065, now + 0.045);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    tailGain.gain.setValueAtTime(0.001, now + 0.02);
    tailGain.gain.exponentialRampToValueAtTime(0.028, now + 0.05);
    tailGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    noise.buffer = noiseBuf;
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1600, now);
    noiseFilter.Q.setValueAtTime(1.4, now);
    noiseGain.gain.setValueAtTime(0.001, now + 0.015);
    noiseGain.gain.exponentialRampToValueAtTime(0.018, now + 0.05);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    chargeOsc.connect(chargeGain).connect(bus);
    bodyOsc.connect(bodyGain).connect(bus);
    tailOsc.connect(tailGain).connect(bus);
    noise.connect(noiseFilter).connect(noiseGain).connect(bus);

    chargeOsc.start(now);
    bodyOsc.start(now + 0.01);
    tailOsc.start(now + 0.02);
    noise.start(now + 0.015);

    chargeOsc.stop(now + 0.08);
    bodyOsc.stop(now + 0.4);
    tailOsc.stop(now + 0.28);
    noise.stop(now + 0.2);

    const chordA = ctx.createOscillator();
    const chordB = ctx.createOscillator();
    const chordGain = ctx.createGain();
    chordA.type = 'triangle';
    chordB.type = 'sine';
    chordA.frequency.setValueAtTime(rootFreq, impactTime);
    chordA.frequency.exponentialRampToValueAtTime(rootFreq * 0.92, impactTime + 0.32);
    chordB.frequency.setValueAtTime(fifthFreq, impactTime);
    chordB.frequency.exponentialRampToValueAtTime(rootFreq, impactTime + 0.28);
    chordGain.gain.setValueAtTime(0.001, impactTime);
    chordGain.gain.exponentialRampToValueAtTime(0.04, impactTime + 0.02);
    chordGain.gain.exponentialRampToValueAtTime(0.001, impactTime + 0.38);
    chordA.connect(chordGain).connect(bus);
    chordB.connect(chordGain).connect(bus);
    chordA.start(impactTime);
    chordB.start(impactTime);
    chordA.stop(impactTime + 0.42);
    chordB.stop(impactTime + 0.42);
    pulseMusicDuck(impactTime, 0.1, 0.18);
    return;
  }
  if (weaponType === 'missile') {
    const launchTime = quantizeToGrid(now + 0.02, BEAT_DUR);
    const launchFreq = bassNoteAtTime(launchTime);
    const rocketOsc = ctx.createOscillator();
    const rocketGain = ctx.createGain();
    const noiseLen = Math.floor(ctx.sampleRate * 0.12);
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / noiseLen, 1.5);
    const noise = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();
    rocketOsc.type = 'sawtooth';
    rocketOsc.frequency.setValueAtTime(launchFreq * 3.2, now);
    rocketOsc.frequency.exponentialRampToValueAtTime(launchFreq * 1.7, now + 0.22);
    rocketGain.gain.setValueAtTime(0.001, now);
    rocketGain.gain.exponentialRampToValueAtTime(0.035, now + 0.015);
    rocketGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    noise.buffer = noiseBuf;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);
    noiseGain.gain.setValueAtTime(0.02, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    rocketOsc.connect(rocketGain).connect(bus);
    noise.connect(filter).connect(noiseGain).connect(bus);
    rocketOsc.start(now);
    noise.start(now);
    rocketOsc.stop(now + 0.26);
    noise.stop(now + 0.14);

    const thumpOsc = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thumpOsc.type = 'triangle';
    thumpOsc.frequency.setValueAtTime(launchFreq * 2, launchTime);
    thumpOsc.frequency.exponentialRampToValueAtTime(launchFreq, launchTime + 0.24);
    thumpGain.gain.setValueAtTime(0.001, launchTime);
    thumpGain.gain.exponentialRampToValueAtTime(0.045, launchTime + 0.015);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, launchTime + 0.3);
    thumpOsc.connect(thumpGain).connect(bus);
    thumpOsc.start(launchTime);
    thumpOsc.stop(launchTime + 0.32);
    pulseMusicDuck(launchTime, 0.08, 0.16);
    return;
  }
  const shotTime = quantizeToGrid(now + 0.012, BEAT_DUR / 2);
  const shotFreq = arpNoteAtTime(shotTime);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(shotFreq * 2.2, now);
  osc.frequency.exponentialRampToValueAtTime(shotFreq * 0.8, now + 0.12);
  gain.gain.setValueAtTime(0.018, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
  osc.connect(gain).connect(bus);
  osc.start(now);
  osc.stop(now + 0.16);

  const layerOsc = ctx.createOscillator();
  const layerGain = ctx.createGain();
  layerOsc.type = 'triangle';
  layerOsc.frequency.setValueAtTime(shotFreq, shotTime);
  layerOsc.frequency.exponentialRampToValueAtTime(shotFreq * 1.12, shotTime + 0.08);
  layerGain.gain.setValueAtTime(0.001, shotTime);
  layerGain.gain.exponentialRampToValueAtTime(0.02, shotTime + 0.01);
  layerGain.gain.exponentialRampToValueAtTime(0.001, shotTime + 0.11);
  layerOsc.connect(layerGain).connect(bus);
  layerOsc.start(shotTime);
  layerOsc.stop(shotTime + 0.13);
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
  const now = ctx.currentTime;
  const makeNoiseBuffer = (duration, curve = 1.5) => {
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const env = Math.pow(1 - i / length, curve);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    return buffer;
  };

  const blast = ctx.createBufferSource();
  const blastFilter = ctx.createBiquadFilter();
  const blastGain = ctx.createGain();
  blast.buffer = makeNoiseBuffer(0.55, 1.25);
  blastFilter.type = 'lowpass';
  blastFilter.frequency.setValueAtTime(950, now);
  blastFilter.frequency.exponentialRampToValueAtTime(220, now + 0.55);
  blastGain.gain.setValueAtTime(0.001, now);
  blastGain.gain.exponentialRampToValueAtTime(0.8, now + 0.012);
  blastGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
  blast.connect(blastFilter).connect(blastGain).connect(ctx.destination);

  const shock = ctx.createOscillator();
  const shockGain = ctx.createGain();
  shock.type = 'triangle';
  shock.frequency.setValueAtTime(82, now);
  shock.frequency.exponentialRampToValueAtTime(34, now + 1.1);
  shockGain.gain.setValueAtTime(0.001, now);
  shockGain.gain.exponentialRampToValueAtTime(0.11, now + 0.02);
  shockGain.gain.exponentialRampToValueAtTime(0.001, now + 1.15);
  shock.connect(shockGain).connect(ctx.destination);

  const crack = ctx.createOscillator();
  const crackGain = ctx.createGain();
  crack.type = 'sawtooth';
  crack.frequency.setValueAtTime(260, now);
  crack.frequency.exponentialRampToValueAtTime(70, now + 0.24);
  crackGain.gain.setValueAtTime(0.001, now);
  crackGain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
  crack.connect(crackGain).connect(ctx.destination);

  const secondary = ctx.createBufferSource();
  const secondaryFilter = ctx.createBiquadFilter();
  const secondaryGain = ctx.createGain();
  secondary.buffer = makeNoiseBuffer(0.38, 1.6);
  secondaryFilter.type = 'bandpass';
  secondaryFilter.frequency.setValueAtTime(520, now + 0.18);
  secondaryGain.gain.setValueAtTime(0.001, now + 0.18);
  secondaryGain.gain.exponentialRampToValueAtTime(0.28, now + 0.22);
  secondaryGain.gain.exponentialRampToValueAtTime(0.001, now + 0.56);
  secondary.connect(secondaryFilter).connect(secondaryGain).connect(ctx.destination);

  const debris = ctx.createBufferSource();
  const debrisFilter = ctx.createBiquadFilter();
  const debrisGain = ctx.createGain();
  debris.buffer = makeNoiseBuffer(0.9, 1.1);
  debrisFilter.type = 'highpass';
  debrisFilter.frequency.setValueAtTime(1800, now + 0.08);
  debrisGain.gain.setValueAtTime(0.001, now + 0.08);
  debrisGain.gain.exponentialRampToValueAtTime(0.12, now + 0.12);
  debrisGain.gain.exponentialRampToValueAtTime(0.001, now + 1);
  debris.connect(debrisFilter).connect(debrisGain).connect(ctx.destination);

  blast.start(now);
  shock.start(now);
  crack.start(now);
  secondary.start(now + 0.18);
  debris.start(now + 0.08);

  blast.stop(now + 0.56);
  shock.stop(now + 1.18);
  crack.stop(now + 0.28);
  secondary.stop(now + 0.58);
  debris.stop(now + 1.02);
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
