
/* ----------------------------------------------------
   asteroids.js – refactored & bug‑fixed version
   ---------------------------------------------------- */

/* ---------- Canvas & Resize ---------- */
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

let W, H;
function resize() {
  // Fit the canvas to its parent #game container
  const rect = canvas.parentElement.getBoundingClientRect();
  W = canvas.width = rect.width;
  H = canvas.height = rect.height;
}
window.addEventListener('resize', resize);
resize();

/* ---------- Constants & Helpers ---------- */
// power-up size (radius)
const POWERUP_RADIUS = 10 * 1.1; // 10% larger than base 10
const FPS = 60;           // target frame rate (used only for comments)
const THRUST_PARTICLES = 3;           // per accelerate frame
const MAX_THRUST_PARTS = 200;         // cap particle array
const BULLET_LIFETIME = 60;
const SHIP_ACCEL = 0.1;
const SHIP_MAX_SPEED = 5;
const SHIP_FRICTION = 0.99;
// ship size (radius)
const SHIP_RADIUS = 7.5;  // half of previous 15 for 50% smaller ship

// bullet configuration (dynamic for power-ups)
const BASE_BULLET_SPEED_MIN = 8;
const BASE_BULLET_SPEED_MAX = 12;
const POWER_BULLET_SPEED_MIN = 12;
const POWER_BULLET_SPEED_MAX = 18;
let bulletSpeedMin = BASE_BULLET_SPEED_MIN;
let bulletSpeedMax = BASE_BULLET_SPEED_MAX;
const BASE_BULLET_SIZE = 2;
const POWER_BULLET_SIZE = 4;
let bulletSize = BASE_BULLET_SIZE;
const BASE_BULLET_LIFE = BULLET_LIFETIME;
const POWER_BULLET_LIFE = 100;
let bulletLife = BASE_BULLET_LIFE;

// firing rate (ms between shots)
const BASE_SHOT_INTERVAL = 200;
const MACHINE_GUN_INTERVAL = 50;
let shotInterval = BASE_SHOT_INTERVAL;

// power-up management
const POWERUP_DURATION = 10000; // 10 seconds
const POWERUP_SPAWN_CHANCE = 0.2; // chance to drop on small asteroid kill
let activePowerup = null;
let powerupExpires = 0;

function rand(min, max) { return Math.random() * (max - min) + min; }
function degToRad(d) { return d * Math.PI / 180; }
function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}
// ------- Web Audio setup & sound effects -------
let audioCtx;
function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
// Laser shot sound
function playLaser() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.2);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  osc.stop(ctx.currentTime + 0.3);
}
// Asteroid chunk hit sound
function playChunk() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // 1) Hammer-blow impact (short, low-pass noise)
  const impactDur = 0.15;
  const impactLen = Math.floor(ctx.sampleRate * impactDur);
  const impactBuf = ctx.createBuffer(1, impactLen, ctx.sampleRate);
  const impactData = impactBuf.getChannelData(0);
  for (let i = 0; i < impactLen; i++) {
    // decaying noise
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
  // Connect impact source through filter and gain
  impactSrc.connect(impactFil).connect(impactGain);
  // Direct sound
  impactGain.connect(ctx.destination);
  // Echo effect: delayed, feedback loop for a dull echoing bang
  const delay = ctx.createDelay();
  delay.delayTime.setValueAtTime(0.25, now);
  const feedbackGain = ctx.createGain();
  feedbackGain.gain.setValueAtTime(0.5, now);
  // feedback loop
  delay.connect(feedbackGain).connect(delay);
  // route impact through delay to destination
  impactGain.connect(delay).connect(ctx.destination);
  impactSrc.start(now);

  // 2) Rock shard fragments (3 quick high-pass bursts)
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

// Shield clang sound
function playShieldClang() {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.2);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  osc.stop(ctx.currentTime + 0.3);
}
// Power-up pickup sound
function playPowerupPickup() {
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
// Ship explosion sound
function playExplosionSound() {
  const ctx = getAudioContext();
  const bufferSize = ctx.sampleRate * 0.5;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const noise = ctx.createBufferSource();
  const gain = ctx.createGain();
  noise.buffer = buffer;
  gain.gain.setValueAtTime(1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  noise.connect(gain).connect(ctx.destination);
  noise.start();
}
// Thrust loop: white-noise-based
let thrustSource, thrustGain;
function startThrustSound() {
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
  thrustGain.gain.value = 0.05;
  thrustSource.connect(thrustGain).connect(ctx.destination);
  thrustSource.start();
}
function stopThrustSound() {
  if (!thrustSource) return;
  thrustGain.gain.setTargetAtTime(0, getAudioContext().currentTime, 0.1);
  setTimeout(() => {
    if (thrustSource) thrustSource.stop();
    thrustSource = thrustGain = null;
  }, 200);
}

// Ship sprite image
const shipImg = new Image();
shipImg.src = 'ship.svg';
// Asteroid sprite images (variants)
const asteroidImages = [];
['asteroid1.svg', 'asteroid2.svg', 'asteroid3.svg', 'asteroid4.svg'].forEach(src => {
  const img = new Image();
  img.src = src;
  asteroidImages.push(img);
});

/* ---------- Starfield background ---------- */
let stars = [];
const STAR_COUNT = 200;
const STAR_PARALLAX = 0.2;      // parallax factor versus ship speed

function initStars() {
  stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: rand(0, W),
      y: rand(0, H),
      r: rand(0.5, 1.5),        // star radius
      baseAlpha: rand(0.3, 0.8), // static brightness
      drift: rand(0.05, 0.2)    // slow vertical drift
    });
  }
}

function updateStars() {
  stars.forEach(s => {
    // parallax movement
    const vx = (game.ship && game.ship.velX) || 0;
    const vy = (game.ship && game.ship.velY) || 0;
    s.x -= vx * STAR_PARALLAX;
    s.y -= vy * STAR_PARALLAX;
    // slight downward drift
    s.y += s.drift;
    // wrap around edges
    if (s.x < 0) s.x += W;
    else if (s.x > W) s.x -= W;
    if (s.y > H) s.y = 0;
    else if (s.y < 0) s.y = H;
  });
}

function renderStars() {
  stars.forEach(s => {
    ctx.fillStyle = `rgba(255,255,255,${s.baseAlpha})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, 2 * Math.PI);
    ctx.fill();
  });
}
// initialize starfield for first render
initStars();
// regenerate stars when canvas is resized
window.addEventListener('resize', initStars);

/* ---------- Particle system for thruster ---------- */
class ThrusterParticle {
  constructor(x, y, angle) {
    this.x = x; this.y = y;
    const speed = rand(0.5, 1.5);
    this.velX = speed * Math.cos(degToRad(angle));
    this.velY = speed * Math.sin(degToRad(angle));
    this.life = 30;              // total frames
    this.lifeMax = this.life;    // for alpha calculation
    this.size = 2 + rand(-1, 1);
    // pick a flame/smoke color: red, orange, or grey
    const colors = [
      '255, 0, 0',    // red flame
      '255, 165, 0',  // orange flame
      '128, 128, 128' // smoke grey
    ];
    this.color = colors[Math.floor(rand(0, colors.length))];
  }
  update() { this.x += this.velX; this.y += this.velY; this.life--; }
  draw() {
    // fade out over lifetime
    const alpha = Math.max(this.life / this.lifeMax, 0);
    ctx.fillStyle = `rgba(${this.color},${alpha})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, 2 * Math.PI);
    ctx.fill();
  }
}

/* ---------- Particle system for ship explosion ---------- */
class ExplosionParticle {
  constructor(x, y) {
    this.x = x; this.y = y;
    const speed = rand(1, 5);
    const angle = rand(0, 360);
    this.velX = speed * Math.cos(degToRad(angle));
    this.velY = speed * Math.sin(degToRad(angle));
    this.life = rand(30, 60);
    this.lifeMax = this.life;
    this.size = rand(2, 5);
    const colors = ['255,0,0', '255,165,0'];
    this.color = colors[Math.floor(rand(0, colors.length))];
  }
  update() {
    this.x += this.velX;
    this.y += this.velY;
    this.life--;
  }
  draw() {
    const alpha = Math.max(this.life / this.lifeMax, 0);
    ctx.fillStyle = `rgba(${this.color},${alpha})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, 2 * Math.PI);
    ctx.fill();
  }
}
/**
 * Power-up items dropped by smallest asteroids
 */
class Powerup {
  constructor(x, y, type) {
    this.x = x; this.y = y;
    this.type = type;            // 'shield','machine','power','missile'
    this.r = POWERUP_RADIUS;     // visual radius (10% larger)
    this.angle = 0;
    this.life = 600;             // frames until auto-remove (10s)
  }
  update() {
    this.angle += 0.05;
    this.life--;
  }
  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    // color & label based on type
    let color, label;
    switch (this.type) {
      case 'shield': color = 'lime'; label = 'S'; break;
      case 'machine': color = 'magenta'; label = 'M'; break;
      case 'power': color = 'cyan'; label = 'P'; break;
      case 'missile': color = 'orange'; label = 'X'; break;
    }
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, this.r, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }
}


/* ---------- Game Objects ---------- */
class Ship {
  constructor() {
    this.r = SHIP_RADIUS;            // ship radius (used for collision)
    this.reset();
    this.lastShot = 0;                // ms timestamp of last fired bullet
  }
  reset() {
    this.x = W / 2;
    this.y = H / 2;
    this.angle = 0;                   // facing up (deg)
    this.velX = 0; this.velY = 0;
  }
  update() {
    /* move */
    this.x += this.velX;
    this.y += this.velY;

    /* wrap screen edges */
    if (this.x < 0) this.x += W; if (this.x > W) this.x -= W;
    if (this.y < 0) this.y += H; if (this.y > H) this.y -= H;

    /* friction */
    this.velX *= SHIP_FRICTION;
    this.velY *= SHIP_FRICTION;
  }
  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    // draw pulsing shield ring around ship if active
    if (game.shield > 0) {
      // pulse factor oscillates [0..1]
      const t = performance.now() / 300;
      const pulse = (Math.sin(t) * 0.5 + 0.5);
      // ring radius oscillates between 2× and 2.4× ship radius
      const baseR = this.r * 2;
      const radius = baseR + (this.r * 0.4) * pulse;
      // line width oscillates between 3 and 6
      const lineW = 3 + 3 * pulse;
      let color;
      switch (game.shield) {
        case 3: color = 'rgba(0,255,0,0.3)'; break;   // bright green
        case 2: color = 'rgba(255,255,0,0.3)'; break; // bright yellow
        case 1: color = 'rgba(255,0,0,0.3)'; break;   // bright red
      }
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineW;
      ctx.stroke();
    }
    // rotate ship body to its current angle
    ctx.rotate(degToRad(this.angle + 90));

    // draw ship sprite from SVG
    if (shipImg.complete) {
      const size = this.r * 3;
      ctx.drawImage(shipImg, -size / 2, -size / 2, size, size);
    }

    ctx.restore();
  }
}

class Bullet {
  constructor(x, y, angle) {
    this.x = x; this.y = y;
    // speed based on current power-up settings
    const speed = rand(bulletSpeedMin, bulletSpeedMax);
    this.velX = speed * Math.cos(degToRad(angle));
    this.velY = speed * Math.sin(degToRad(angle));
    // lifespan and size based on power-up settings
    this.lifetime = bulletLife;
    this.r = bulletSize;
  }
  update() {
    this.x += this.velX; this.y += this.velY;
    this.lifetime--;
    if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.lifetime = 0;
  }
  draw() {
    ctx.fillStyle = '#ff0';
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, 2 * Math.PI); ctx.fill();
  }
}
/**
 * Homing missile bullets
 */
class Missile extends Bullet {
  update() {
    // home towards nearest asteroid
    if (game.asteroids.length) {
      let closest = null, minD = Infinity;
      for (const a of game.asteroids) {
        const d = dist(this, a);
        if (d < minD) { minD = d; closest = a; }
      }
      if (closest) {
        const angle = Math.atan2(closest.y - this.y, closest.x - this.x);
        const speed = Math.hypot(this.velX, this.velY) || (bulletSpeedMax + bulletSpeedMin) / 2;
        this.velX = speed * Math.cos(angle);
        this.velY = speed * Math.sin(angle);
      }
    }
    super.update();
  }
}

class Asteroid {
  constructor(x, y, size) {
    this.x = x; this.y = y;
    this.size = size || rand(20, 60);
    const speed = rand(1, 3) / this.size * 30;
    const angle = rand(0, 360);
    this.velX = speed * Math.cos(degToRad(angle));
    this.velY = speed * Math.sin(degToRad(angle));
    this.points = 7 + Math.floor(rand(0, 4));   // shape complexity (unused with SVG)
    this.color = `hsl(${rand(0, 360)},70%,60%)`;
    // initial rotation and spin speed
    this.rotation = rand(0, 360);
    this.rotationSpeed = rand(-0.5, 0.5);
    // pick a random asteroid variant image
    this.img = asteroidImages[
      Math.floor(Math.random() * asteroidImages.length)
    ];
  }
  update() {
    // move
    this.x += this.velX; this.y += this.velY;
    // spin
    this.rotation = (this.rotation + this.rotationSpeed + 360) % 360;
    // screen wrap
    if (this.x < 0) this.x += W; else if (this.x > W) this.x -= W;
    if (this.y < 0) this.y += H; else if (this.y > H) this.y -= H;
  }
  draw() {
    // draw with chosen SVG variant if loaded
    if (this.img && this.img.complete) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(degToRad(this.rotation));
      const sizePx = this.size * 2;
      ctx.drawImage(this.img, -sizePx / 2, -sizePx / 2, sizePx, sizePx);
      ctx.restore();
    } else {
      // fallback: simple circle
      ctx.fillStyle = '#ccc';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
}

/* ---------- Game State ---------- */
const game = {
  started: false,
  ship: new Ship(),
  bullets: [],
  asteroids: [],
  thrusters: [],
  powerups: [],        // active power-up items on field
  score: 0,
  shield: 3,            // number of shield hits remaining: 3=green,2=yellow,1=red,0=none
  exploding: false,     // explosion in progress
  explosionStart: 0,    // timestamp when explosion began
  explosionParticles: [],
  finalScore: 0         // score to display after explosion
};

// HUD element: hide it until gameplay starts (shield is shown around ship)
const hud = document.getElementById('hud');
hud.style.display = 'none';
document.getElementById('score').textContent = game.score;

/* ---------- Helper functions ---------- */
function spawnAsteroid() {
  let x, y;
  do {
    x = rand(0, W); y = rand(0, H);
  } while (dist({ x, y }, game.ship) < 200);   // avoid spawning too close
  game.asteroids.push(new Asteroid(x, y));
}
for (let i = 0; i < 5; i++) spawnAsteroid();
/**
 * Begin ship explosion: generate explosion particles and hide HUD
 */
function startExplosion() {
  game.exploding = true;
  game.explosionStart = performance.now();
  game.explosionParticles = [];
  // generate particles at ship location
  const count = 40;
  for (let i = 0; i < count; i++) {
    game.explosionParticles.push(
      new ExplosionParticle(game.ship.x, game.ship.y)
    );
  }
  // play explosion SFX
  playExplosionSound();
  // hide HUD during explosion
  hud.style.display = 'none';
}

/**
 * Spawn a power-up of random type at (x,y)
 */
function spawnPowerup(x, y) {
  const types = ['shield', 'machine', 'power', 'missile'];
  const type = types[Math.floor(rand(0, types.length))];
  game.powerups = game.powerups || [];
  game.powerups.push(new Powerup(x, y, type));
}

/**
 * Activate a collected power-up
 */
function applyPowerup(type) {
  const now = performance.now();
  // play pickup SFX
  playPowerupPickup();
  switch (type) {
    case 'shield':
      game.shield = 3;
      break;
    case 'machine':
      shotInterval = MACHINE_GUN_INTERVAL;
      activePowerup = 'machine';
      powerupExpires = now + POWERUP_DURATION;
      break;
    case 'power':
      bulletSpeedMin = POWER_BULLET_SPEED_MIN;
      bulletSpeedMax = POWER_BULLET_SPEED_MAX;
      bulletSize = POWER_BULLET_SIZE;
      bulletLife = POWER_BULLET_LIFE;
      activePowerup = 'power';
      powerupExpires = now + POWERUP_DURATION;
      break;
    case 'missile':
      activePowerup = 'missile';
      powerupExpires = now + POWERUP_DURATION;
      break;
  }
}

/**
 * Revert to base weapon when power-up expires
 */
function expirePowerup() {
  shotInterval = BASE_SHOT_INTERVAL;
  bulletSpeedMin = BASE_BULLET_SPEED_MIN;
  bulletSpeedMax = BASE_BULLET_SPEED_MAX;
  bulletSize = BASE_BULLET_SIZE;
  bulletLife = BASE_BULLET_LIFE;
  activePowerup = null;
}

function resetGame() {
  game.ship.reset();
  game.bullets.length = 0;
  game.thrusters.length = 0;
  game.asteroids.length = 0;
  game.score = 0;
  game.shield = 3;
  // clear any prior explosion & power-up state
  game.exploding = false;
  game.explosionParticles.length = 0;
  game.powerups.length = 0;
  document.getElementById('score').textContent = game.score;
  // shield is shown as a circle around the ship, no HUD element

  // spawn fresh asteroids for the next round
  for (let i = 0; i < 5; i++) spawnAsteroid();
}

/* ---------- Input Handling ---------- */
const keys = {};
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => delete keys[e.key]);
// Thrust audio controls
window.addEventListener('keydown', e => { if (e.key === 'ArrowUp') startThrustSound(); });
window.addEventListener('keyup', e => { if (e.key === 'ArrowUp') stopThrustSound(); });

/* ---------- Start screen handling ---------- */
let startScreen = document.getElementById('startScreen');
window.addEventListener('keydown', e => {
  // normalize Enter / Return key for broad browser support
  // detect Enter/Return from various browsers
  const isEnter = e.key === 'Enter'
    || e.key === 'Return'
    || e.code === 'Enter'
    || e.keyCode === 13;
  if (!game.started && isEnter) {
    // hide the start screen, show HUD, and begin the game
    startScreen.style.display = 'none';
    hud.style.display = 'block';
    game.started = true;
  }
});

/* ---------- Game Loop ---------- */
function update() {
  // handle power-up expiration
  const nowMs = performance.now();
  if (activePowerup && nowMs > powerupExpires) {
    expirePowerup();
  }
  // update power-ups (life & rotation) and check for collection
  if (game.powerups) {
    game.powerups.forEach(p => p.update());
    for (let i = 0; i < game.powerups.length; i++) {
      const p = game.powerups[i];
      if (p.life <= 0) { game.powerups.splice(i, 1); i--; continue; }
      if (dist(game.ship, p) < game.ship.r + p.r) {
        applyPowerup(p.type);
        game.powerups.splice(i, 1);
        i--; continue;
      }
    }
  }
  /* ----- Input ----- */
  if (keys['ArrowLeft']) game.ship.angle -= 3;
  if (keys['ArrowRight']) game.ship.angle += 3;

  if (keys['ArrowUp']) {
    const ax = SHIP_ACCEL * Math.cos(degToRad(game.ship.angle));
    const ay = SHIP_ACCEL * Math.sin(degToRad(game.ship.angle));
    game.ship.velX += ax; game.ship.velY += ay;

    /* add thruster particles */
    for (let i = 0; i < THRUST_PARTICLES; i++) {
      const backAngle = game.ship.angle + 180;
      const offsetX = Math.cos(degToRad(backAngle)) * game.ship.r;
      const offsetY = Math.sin(degToRad(backAngle)) * game.ship.r;

      const px = game.ship.x + offsetX;
      const py = game.ship.y + offsetY;

      const angle = game.ship.angle + 180 + rand(-10, 10);
      game.thrusters.push(new ThrusterParticle(px, py, angle));
    }
  }

  if (keys[' ']) {
    const now = Date.now();
    if (now - game.ship.lastShot > shotInterval) {
      // spawn projectile: normal bullet or homing missile
      const spawnX = game.ship.x + Math.cos(degToRad(game.ship.angle)) * game.ship.r;
      const spawnY = game.ship.y + Math.sin(degToRad(game.ship.angle)) * game.ship.r;
      let proj;
      if (activePowerup === 'missile') {
        proj = new Missile(spawnX, spawnY, game.ship.angle);
      } else {
        proj = new Bullet(spawnX, spawnY, game.ship.angle);
      }
      // play firing SFX
      playLaser();
      game.bullets.push(proj);
      game.ship.lastShot = now;
    }
  }

  /* ----- Update objects ----- */
  game.ship.update();

  for (let i = 0; i < game.bullets.length; i++) {
    const b = game.bullets[i];
    b.update();
    if (b.lifetime <= 0) { game.bullets.splice(i, 1); i--; continue; }
  }

  for (let i = 0; i < game.thrusters.length; i++) {
    const p = game.thrusters[i];
    p.update();
    if (p.life <= 0) { game.thrusters.splice(i, 1); i--; }
  }

  game.asteroids.forEach(a => a.update());

  /* ----- Collision detection ----- */
  // ship vs asteroid (shield takes damage, ship bounces, asteroid splits)
  for (let i = 0; i < game.asteroids.length; i++) {
    const a = game.asteroids[i];
    const minDist = a.size + game.ship.r * 1.5;
    if (dist(game.ship, a) < minDist) {
      // play shield hit SFX
      playShieldClang();
      // compute collision normal (asteroid → ship)
      const dx = game.ship.x - a.x;
      const dy = game.ship.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d, ny = dy / d;
      // relative velocity (ship relative to asteroid)
      const relVX = game.ship.velX - a.velX;
      const relVY = game.ship.velY - a.velY;
      const dot = relVX * nx + relVY * ny;
      // if approaching, reflect velocity vector
      if (dot < 0) {
        const reflVX = relVX - 2 * dot * nx;
        const reflVY = relVY - 2 * dot * ny;
        game.ship.velX = reflVX + a.velX;
        game.ship.velY = reflVY + a.velY;
      }
      // split asteroid like bullet hit
      game.asteroids.splice(i, 1);
      if (a.size > 25) {
        for (let j = 0; j < 2; j++) {
          game.asteroids.push(new Asteroid(a.x, a.y, a.size / 2));
        }
      }
      // consume shield
      game.shield--;
      // if shield fell below zero, start explosion
      if (game.shield < 0) {
        game.started = false;
        game.finalScore = game.score;
        startExplosion();
      }
      i--; // adjust loop index after removal
    }
  }

  // bullets vs asteroid
  for (let bi = 0; bi < game.bullets.length; bi++) {
    const b = game.bullets[bi];
    for (let ai = 0; ai < game.asteroids.length; ai++) {
      const a = game.asteroids[ai];
      if (dist(b, a) < a.size + b.r) {
        // destroy asteroid & bullet
        game.bullets.splice(bi, 1); bi--;
        game.asteroids.splice(ai, 1);
        ai--;

        // play chunk SFX
        playChunk();
        // split into smaller pieces if size is large enough
        if (a.size > 25) {
          for (let j = 0; j < 2; j++) {
            const newAst = new Asteroid(a.x, a.y, a.size / 2);
            game.asteroids.push(newAst);
          }
        }

        // score +1 per asteroid hit
        game.score++; document.getElementById('score').textContent = game.score;
        // possibly spawn a power-up when smallest asteroids are destroyed
        if (a.size <= 25 && Math.random() < POWERUP_SPAWN_CHANCE) {
          spawnPowerup(a.x, a.y);
        }
        break;   // stop checking other asteroids for this bullet

      }
    }
  }

  /* ----- Ensure at least one asteroid remains ----- */
  if (game.asteroids.length === 0) {
    for (let i = 0; i < 5; i++) spawnAsteroid();
  }
}

function render() {
  // draw game objects (canvas has been cleared and background drawn already)
  // draw thruster particles behind the ship
  game.thrusters.forEach(p => p.draw());
  // draw ship on top of thrusters
  game.ship.draw();
  // draw bullets and asteroids
  game.bullets.forEach(b => b.draw());
  game.asteroids.forEach(a => a.draw());
  // draw available power-ups
  if (game.powerups) game.powerups.forEach(p => p.draw());
}

function loop() {
  // update game state
  if (game.started) {
    update();
  }
  // update and draw starfield background
  updateStars();
  ctx.clearRect(0, 0, W, H);
  renderStars();
  // draw game objects on top
  if (game.started) {
    render();
  } else if (game.exploding) {
    // update and draw explosion particles
    game.explosionParticles.forEach(p => p.update());
    game.explosionParticles = game.explosionParticles.filter(p => p.life > 0);
    game.explosionParticles.forEach(p => p.draw());
    // after 2 seconds, show game-over screen
    if (performance.now() - game.explosionStart > 2000) {
      startScreen.innerHTML =
        `<h1>Game Over</h1>` +
        `<p>Your score: ${game.finalScore}</p>` +
        `<p>Press Enter to restart.</p>`;
      startScreen.style.display = 'flex';
      // reset game state for next run
      resetGame();
    }
  }
  requestAnimationFrame(loop);
}
// initialize loop & start animation
loop();

/* ---------- Optional: FPS counter (debug) ---------- */
let fps, lastTime = performance.now();
setInterval(() => {
  const now = performance.now();
  fps = Math.round(1000 / (now - lastTime));
  lastTime = now;
  // Uncomment to see FPS in console
  // console.log(`FPS: ${fps}`);
}, 500);
