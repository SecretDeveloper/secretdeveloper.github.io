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
  if (weaponType === 'machine') {
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
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.05);
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'square';
    clickOsc.frequency.setValueAtTime(1200, now);
    clickOsc.frequency.exponentialRampToValueAtTime(500, now + 0.03);
    clickGain.gain.setValueAtTime(0.01, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    clickOsc.connect(clickGain).connect(ctx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.04);
    return;
  }
  if (weaponType === 'power') {
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

    chargeOsc.connect(chargeGain).connect(ctx.destination);
    bodyOsc.connect(bodyGain).connect(ctx.destination);
    tailOsc.connect(tailGain).connect(ctx.destination);
    noise.connect(noiseFilter).connect(noiseGain).connect(ctx.destination);

    chargeOsc.start(now);
    bodyOsc.start(now + 0.01);
    tailOsc.start(now + 0.02);
    noise.start(now + 0.015);

    chargeOsc.stop(now + 0.08);
    bodyOsc.stop(now + 0.4);
    tailOsc.stop(now + 0.28);
    noise.stop(now + 0.2);
    return;
  }
  if (weaponType === 'missile') {
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
    rocketOsc.frequency.setValueAtTime(180, now);
    rocketOsc.frequency.exponentialRampToValueAtTime(95, now + 0.22);
    rocketGain.gain.setValueAtTime(0.001, now);
    rocketGain.gain.exponentialRampToValueAtTime(0.035, now + 0.015);
    rocketGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    noise.buffer = noiseBuf;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);
    noiseGain.gain.setValueAtTime(0.02, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    rocketOsc.connect(rocketGain).connect(ctx.destination);
    noise.connect(filter).connect(noiseGain).connect(ctx.destination);
    rocketOsc.start(now);
    noise.start(now);
    rocketOsc.stop(now + 0.26);
    noise.stop(now + 0.14);
    return;
  }
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(720, now);
  osc.frequency.exponentialRampToValueAtTime(210, now + 0.12);
  gain.gain.setValueAtTime(0.018, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.16);
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
