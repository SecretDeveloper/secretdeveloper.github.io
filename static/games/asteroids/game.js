// game.js
// Core game logic, state management, update & render loop
import { rand, degToRad, dist } from './utils.js';
// Sector background gradients
const SECTOR_BG = [
  ['#001f3f', '#000011'], // deep blue
  ['#330033', '#110011'], // purple nebula
  ['#003300', '#001100'], // green mist
  ['#331100', '#110000'], // red dust
  ['#203030', '#002020']  // teal haze
];
const GAME_STATE = {
  START: 'start',
  ENTRY: 'entry',
  PLAYING: 'playing',
  PAUSED: 'paused',
  EXPLODING: 'exploding',
  GAME_OVER: 'gameover'
};
import * as CONST from './constants.js';
import { keys, initInput } from './input.js';
import * as audio from './audio.js';
// Ship and Asteroid are now ECS-managed via factories
import { createAsteroidEntity } from './asteroidFactory.js';
import { createPowerupEntity } from './powerupFactory.js';
// Particle effects are now ECS-managed via ParticleSystem and particleFactory
import { createExplosionParticleEntity, createThrusterParticleEntity } from './particleFactory.js';
import nebulaImages from './nebula.js';
import { initGalaxy, drawGalaxy } from './galaxy.js';
// Galaxy background replaces old Planet set-pieces
import { Wormhole } from './wormhole.js';
import { Starfield } from './starfield.js';
import {
  EntityManager, SystemManager, StarfieldSystem,
  InputSystem, MovementSystem, FrictionSystem, RotationSystem, LifetimeSystem,
  CollisionSystem, ShipCollisionSystem, PowerupSystem, PowerupPickupSystem, ParticleSystem, RenderSystem, MissileSystem
} from './ecs.js';
import { createShipEntity } from './shipFactory.js';

/**
 * Main Game class encapsulating state and rendering.
 */
export class Game {
  constructor(canvas, hudEl, scoreEl, startScreenEl) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hudEl = hudEl;
    this.scoreEl = scoreEl;
    this.startScreenEl = startScreenEl;
    this.defaultStartScreenHTML = startScreenEl.innerHTML;
    // dimensions
    this.W = 0;
    this.H = 0;
    this.resize();
    // Debounced resize: update dimensions and starfield
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this.resize();
        this.starfield.initStars();
      }, 200);
    });

    // starfield with two layers
    this.starfield = new Starfield(this);
    // ECS core: register starfield system for update/render
    this.em = new EntityManager();
    this.sm = new SystemManager(this.em);
    // Register ECS systems
    this.sm.addSystem(new StarfieldSystem(this.starfield));
    // user input drives ship
    this.sm.addSystem(new InputSystem(this.em, this));
    this.sm.addSystem(new MovementSystem(this.em, this));
    this.sm.addSystem(new FrictionSystem(this.em));
    this.sm.addSystem(new RotationSystem(this.em));
    this.sm.addSystem(new LifetimeSystem(this.em));
    // collisions between bullets and asteroids
    this.sm.addSystem(new CollisionSystem(this.em, this));
    // collisions between ship and asteroids
    this.sm.addSystem(new ShipCollisionSystem(this.em, this));
    // power-ups: rotate, expire, and pickup
    this.sm.addSystem(new PowerupSystem(this.em, this));
    this.sm.addSystem(new PowerupPickupSystem(this.em, this));
    // particle effects: thrusters & explosions
    this.sm.addSystem(new ParticleSystem(this.em));
    // render ECS-managed entities (asteroids, bullets, power-ups)
    this.sm.addSystem(new RenderSystem(this.em));
    // homing behavior for missiles
    this.sm.addSystem(new MissileSystem(this.em));

    // galaxy background initialization
    this.galaxyOffsetX = 0;
    this.galaxyOffsetY = 0;
    this.galaxyStars = initGalaxy(this.W, this.H, this.level);
    // sector entry portal state (ship emerges)
    this.entryStartTime = 0;
    this.entryDuration = 2000; // milliseconds
    this.entryPortal = null;
    // pre-render galaxy to offscreen canvas
    this.galaxyCanvas = document.createElement('canvas');
    this.galaxyCanvas.width = this.W;
    this.galaxyCanvas.height = this.H;
    this._renderGalaxyCanvas();

    // input and pause handling
    initInput();
    // pause overlay element
    this.pauseScreenEl = document.getElementById('pauseScreen');
    // sector / level tracking
    this.level = 1;
    this.sectorEl = document.getElementById('sector');
    this.sectorEl.textContent = this.level;
    this.modifierEl = document.getElementById('modifier');
    this.comboHudEl = document.getElementById('comboHud');
    // cache HUD shield fill element
    this.shieldFillEl = document.getElementById('shield-fill');
    // nebula overlays per sector
    this.nebulaImages = nebulaImages;
    // wormhole portal (when sector cleared)
    this.wormhole = null;
    // timestamp when portal should be removed after exit
    this.portalExitExpire = null;
    window.addEventListener('keydown', e => {
      if (e.key === CONST.KEY.ENTER || e.keyCode === 13) {
        if (this.isState(GAME_STATE.START)) {
          audio.resumeAudio();
          this.startRun();
        } else if (this.isState(GAME_STATE.GAME_OVER)) {
          audio.resumeAudio();
          this.resetGame();
          this.startRun();
        } else if (this.isState(GAME_STATE.PAUSED)) {
          this.setState(GAME_STATE.PLAYING);
          this.lastTime = performance.now();
          audio.resumeAudio();
          audio.startDrumArp();
        }
      } else if ((e.key === CONST.KEY.PAUSE || e.keyCode === 27) && this.isState(GAME_STATE.PLAYING)) {
        this.setState(GAME_STATE.PAUSED);
        audio.suspendAudio();
        audio.stopDrumArp();
      }
    });

    // game state
    this.state = GAME_STATE.START;
    this.setState(GAME_STATE.START);
    // Instantiate the player ship as an ECS entity
    this.shipEntity = createShipEntity(this.em, this);
    // track last shot time for ECS-based shooting
    this.lastShot = 0;
    // light trail positions behind ship (for visual effect)
    this.shipTrail = [];
    // ammo state for weapons (legacy HUD-driven)
    this.ammo = {
      [CONST.POWERUP_TYPES.MISSILE]: 0,
      [CONST.POWERUP_TYPES.MACHINE]: 0,
      [CONST.POWERUP_TYPES.POWER]: 0
    };
    // HUD ammo bar elements
    this.ammoEls = {
      [CONST.POWERUP_TYPES.MISSILE]: document.getElementById('ammo-missile'),
      [CONST.POWERUP_TYPES.MACHINE]: document.getElementById('ammo-machine'),
      [CONST.POWERUP_TYPES.POWER]: document.getElementById('ammo-power')
    };
    // explosion particles are now ECS-managed
    // this.explosionParticles = [];
    // this.asteroidExplosions = [];
    this.score = 0;
    this.shield = 3;
    this.comboCount = 0;
    this.comboMultiplier = 1;
    this.comboExpiry = 0;
    this.pendingSectorClearBonus = false;
    // overpowered shield state and timer (10s duration)
    this.shieldOverpowered = false;
    this.shieldOverpoweredExpiry = 0;
    this.explosionStart = 0;
    this.explosionCenter = null;
    this.explosionPulseTimeouts = [];
    this.finalScore = 0;
    this.currentSectorModifier = CONST.getSectorModifier(this.level);
    if (this.modifierEl) this.modifierEl.textContent = this.currentSectorModifier.name;
    this.themeState = { particles: [], pulseOffset: Math.random() * Math.PI * 2 };
    this.resetSectorTheme();
    this.shipInvulnerableUntil = 0;
    this.shakeUntil = 0;
    this.shakeMagnitude = 0;
    this.flashAlpha = 0;
    this.flashColor = '255,255,255';

    // weapon & power-up state
    this.bulletSpeedMin = CONST.BASE_BULLET_SPEED_MIN;
    this.bulletSpeedMax = CONST.BASE_BULLET_SPEED_MAX;
    this.bulletSize = CONST.BASE_BULLET_SIZE;
    this.bulletLife = CONST.BASE_BULLET_LIFE;
    this.shotInterval = CONST.BASE_SHOT_INTERVAL;
    this.activePowerup = null;

    this.spawnSectorEncounter();

    this.scoreEl.textContent = this.score;

    // start loop
    this.loop = this.loop.bind(this);
    // track time for ECS dt
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  isState(...states) {
    return states.includes(this.state);
  }

  setState(nextState) {
    this.state = nextState;
    this.pauseScreenEl.style.display = nextState === GAME_STATE.PAUSED ? 'flex' : 'none';
    this.hudEl.style.display = [GAME_STATE.ENTRY, GAME_STATE.PLAYING, GAME_STATE.PAUSED].includes(nextState) ? 'block' : 'none';
    if (!this.isState(GAME_STATE.START, GAME_STATE.GAME_OVER)) {
      this.startScreenEl.style.display = 'none';
    }
  }

  startRun() {
    this.startScreenEl.style.display = 'none';
    this.lastTime = performance.now();
    this.startEntry();
  }

  showGameOverScreen() {
    this.startScreenEl.innerHTML =
      `<h1>Game Over</h1>` +
      `<p>Your score: ${this.finalScore}</p>` +
      `<p>Press Enter to restart.</p>`;
    this.startScreenEl.style.display = 'flex';
    this.setState(GAME_STATE.GAME_OVER);
  }

  updateScoreHud() {
    this.scoreEl.textContent = this.score;
    if (!this.comboHudEl) return;
    const comboActive = this.comboMultiplier > 1 && performance.now() < this.comboExpiry;
    this.comboHudEl.style.display = comboActive ? 'block' : 'none';
    if (comboActive) {
      this.comboHudEl.textContent = `Combo x${this.comboMultiplier}`;
    }
  }

  awardScore(baseScore, now = performance.now()) {
    if (now <= this.comboExpiry) {
      this.comboCount++;
    } else {
      this.comboCount = 1;
    }
    this.comboExpiry = now + CONST.COMBO_WINDOW_MS;
    this.comboMultiplier = Math.min(CONST.COMBO_MAX_MULTIPLIER, 1 + Math.floor(this.comboCount / 2));
    this.score += baseScore * this.comboMultiplier;
    this.updateScoreHud();
  }

  expireCombo(now = performance.now()) {
    if (now >= this.comboExpiry) {
      this.comboCount = 0;
      this.comboMultiplier = 1;
      this.comboExpiry = 0;
      this.updateScoreHud();
    }
  }

  updateSectorModifier() {
    this.currentSectorModifier = CONST.getSectorModifier(this.level);
    if (this.modifierEl) this.modifierEl.textContent = this.currentSectorModifier.name;
    this.resetSectorTheme();
    this.syncWeaponStats();
  }

  resetSectorTheme() {
    const id = this.currentSectorModifier?.id || 'calm';
    const particles = [];
    if (id === 'debris') {
      for (let i = 0; i < 26; i++) {
        particles.push({
          x: rand(0, this.W),
          y: rand(0, this.H),
          length: rand(18, 68),
          speed: rand(0.25, 1.1),
          alpha: rand(0.04, 0.14)
        });
      }
    } else if (id === 'ion') {
      for (let i = 0; i < 7; i++) {
        particles.push({
          x: rand(0, this.W),
          y: rand(0, this.H),
          radius: rand(24, 72),
          drift: rand(0.2, 0.8),
          alpha: rand(0.08, 0.18)
        });
      }
    } else if (id === 'salvage') {
      for (let i = 0; i < 18; i++) {
        particles.push({
          x: rand(0, this.W),
          y: rand(0, this.H),
          size: rand(3, 8),
          speed: rand(0.12, 0.5),
          alpha: rand(0.08, 0.2)
        });
      }
    } else if (id === 'fortress') {
      for (let i = 0; i < 14; i++) {
        particles.push({
          angle: rand(0, Math.PI * 2),
          radius: rand(Math.min(this.W, this.H) * 0.16, Math.min(this.W, this.H) * 0.44),
          size: rand(6, 14),
          alpha: rand(0.04, 0.11)
        });
      }
    }
    this.themeState = {
      particles,
      pulseOffset: Math.random() * Math.PI * 2,
      ionBurstAt: performance.now() + rand(600, 1800)
    };
  }

  updateSectorTheme(now) {
    const id = this.currentSectorModifier?.id || 'calm';
    const particles = this.themeState?.particles || [];
    if (id === 'debris') {
      for (const p of particles) {
        p.x -= p.speed;
        p.y += p.speed * 0.18;
        if (p.x + p.length < 0) {
          p.x = this.W + rand(0, 40);
          p.y = rand(0, this.H);
        }
        if (p.y > this.H + 20) p.y = -20;
      }
    } else if (id === 'ion') {
      for (const p of particles) {
        p.y += Math.sin(now / 300 + p.radius) * 0.35;
        p.x += Math.cos(now / 450 + p.radius) * 0.2;
      }
      if (now >= (this.themeState.ionBurstAt || 0)) {
        this.triggerFlash('120,220,255', 0.08);
        this.themeState.ionBurstAt = now + rand(1400, 2600);
      }
    } else if (id === 'salvage') {
      for (const p of particles) {
        p.y += p.speed;
        p.x += Math.sin(now / 500 + p.size) * 0.2;
        if (p.y > this.H + 10) {
          p.y = -10;
          p.x = rand(0, this.W);
        }
      }
    } else if (id === 'fortress') {
      for (const p of particles) {
        p.angle += 0.0015;
      }
    }
  }

  renderSectorTheme(now) {
    const id = this.currentSectorModifier?.id || 'calm';
    const pulse = Math.sin(now / 600 + (this.themeState?.pulseOffset || 0)) * 0.5 + 0.5;
    const particles = this.themeState?.particles || [];

    this.ctx.save();
    this.ctx.globalCompositeOperation = 'screen';

    if (id === 'calm') {
      const grad = this.ctx.createRadialGradient(this.W * 0.5, this.H * 0.35, 0, this.W * 0.5, this.H * 0.35, this.W * 0.55);
      grad.addColorStop(0, `rgba(120,200,255,${0.07 + pulse * 0.03})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, this.W, this.H);
    } else if (id === 'debris') {
      this.ctx.strokeStyle = `rgba(255,220,170,${0.08 + pulse * 0.04})`;
      for (const p of particles) {
        this.ctx.globalAlpha = p.alpha;
        this.ctx.lineWidth = 1.2;
        this.ctx.beginPath();
        this.ctx.moveTo(p.x, p.y);
        this.ctx.lineTo(p.x + p.length, p.y - p.length * 0.18);
        this.ctx.stroke();
      }
      this.ctx.globalAlpha = 1;
    } else if (id === 'ion') {
      for (const p of particles) {
        const grad = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
        grad.addColorStop(0, `rgba(120,220,255,${p.alpha + pulse * 0.04})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.strokeStyle = `rgba(140,240,255,${0.16 + pulse * 0.12})`;
      this.ctx.lineWidth = 2;
      for (let i = 0; i < 2; i++) {
        const baseX = (now * 0.15 + i * this.W * 0.45) % (this.W + 120) - 60;
        this.ctx.beginPath();
        this.ctx.moveTo(baseX, 0);
        this.ctx.lineTo(baseX + 18, this.H * 0.2);
        this.ctx.lineTo(baseX - 10, this.H * 0.45);
        this.ctx.lineTo(baseX + 28, this.H * 0.72);
        this.ctx.lineTo(baseX + 6, this.H);
        this.ctx.stroke();
      }
    } else if (id === 'salvage') {
      this.ctx.fillStyle = `rgba(120,255,200,${0.06 + pulse * 0.03})`;
      for (let y = 0; y < this.H; y += 18) {
        this.ctx.fillRect(0, y, this.W, 1);
      }
      for (const p of particles) {
        this.ctx.globalAlpha = p.alpha + pulse * 0.08;
        this.ctx.fillStyle = 'rgba(140,255,210,1)';
        this.ctx.fillRect(p.x, p.y, p.size, p.size);
        this.ctx.strokeStyle = 'rgba(220,255,240,0.5)';
        this.ctx.strokeRect(p.x - 2, p.y - 2, p.size + 4, p.size + 4);
      }
      this.ctx.globalAlpha = 1;
    } else if (id === 'fortress') {
      this.ctx.strokeStyle = `rgba(255,170,110,${0.09 + pulse * 0.05})`;
      this.ctx.lineWidth = 1.5;
      for (const p of particles) {
        const x = this.W * 0.5 + Math.cos(p.angle) * p.radius;
        const y = this.H * 0.5 + Math.sin(p.angle) * p.radius;
        this.ctx.strokeRect(x - p.size / 2, y - p.size / 2, p.size, p.size);
      }
      this.ctx.lineWidth = 3;
      this.ctx.strokeRect(26, 26, this.W - 52, this.H - 52);
      this.ctx.strokeRect(42, 42, this.W - 84, this.H - 84);
    }

    this.ctx.restore();
  }

  getPowerupSpawnChance() {
    return Math.min(0.9, CONST.POWERUP_SPAWN_CHANCE * (this.currentSectorModifier?.powerupChanceMult || 1));
  }

  getSectorAsteroidCount() {
    const baseCount = CONST.getSectorAsteroidCount(this.level);
    return Math.max(3, Math.round(baseCount * (this.currentSectorModifier?.asteroidCountMult || 1)));
  }

  isShipInvulnerable(now = performance.now()) {
    return now < this.shipInvulnerableUntil;
  }

  startShipInvulnerability(now = performance.now(), duration = CONST.SHIP_INVULNERABLE_DURATION) {
    this.shipInvulnerableUntil = now + duration;
  }

  triggerScreenShake(intensity, duration = 120) {
    const now = performance.now();
    this.shakeUntil = Math.max(this.shakeUntil, now + duration);
    this.shakeMagnitude = Math.max(this.shakeMagnitude, intensity);
  }

  triggerFlash(color = '255,255,255', alpha = 0.18) {
    this.flashColor = color;
    this.flashAlpha = Math.max(this.flashAlpha, alpha);
  }

  spawnImpactBurst(x, y, count = 10) {
    for (let i = 0; i < count; i++) {
      createExplosionParticleEntity(this.em, x, y);
    }
  }

  triggerImpactFeedback({ x, y, shake = 4, flashAlpha = 0.12, flashColor = '255,255,255', particles = 10 } = {}) {
    this.triggerScreenShake(shake);
    this.triggerFlash(flashColor, flashAlpha);
    if (typeof x === 'number' && typeof y === 'number' && particles > 0) {
      this.spawnImpactBurst(x, y, particles);
    }
  }

  clearExplosionPulseTimeouts() {
    for (const timeoutId of this.explosionPulseTimeouts) {
      clearTimeout(timeoutId);
    }
    this.explosionPulseTimeouts = [];
  }

  queueExplosionPulse(delay, callback) {
    const timeoutId = setTimeout(() => {
      this.explosionPulseTimeouts = this.explosionPulseTimeouts.filter(id => id !== timeoutId);
      if (!this.isState(GAME_STATE.EXPLODING)) return;
      callback();
    }, delay);
    this.explosionPulseTimeouts.push(timeoutId);
  }

  spawnExplosionPulse(x, y, {
    particles = CONST.EXPLOSION_PARTICLES_COUNT,
    shake = 8,
    flashAlpha = 0.2,
    flashColor = '255,140,90'
  } = {}) {
    this.spawnImpactBurst(x, y, particles);
    this.triggerScreenShake(shake, 180);
    this.triggerFlash(flashColor, flashAlpha);
  }

  applyScreenShake(now) {
    if (now < this.shakeUntil) {
      const decay = Math.max((this.shakeUntil - now) / 180, 0.2);
      const mag = this.shakeMagnitude * decay;
      const ox = rand(-mag, mag);
      const oy = rand(-mag, mag);
      this.canvas.style.transform = `translate(${ox}px, ${oy}px)`;
    } else if (this.canvas.style.transform) {
      this.canvas.style.transform = '';
      this.shakeMagnitude = 0;
    }
  }

  renderFlashOverlay() {
    if (this.flashAlpha <= 0.001) return;
    this.ctx.fillStyle = `rgba(${this.flashColor},${this.flashAlpha})`;
    this.ctx.fillRect(0, 0, this.W, this.H);
    this.flashAlpha *= 0.88;
    if (this.flashAlpha < 0.01) this.flashAlpha = 0;
  }

  /**
   * Render the current galaxyStars into the offscreen canvas.
   */
  _renderGalaxyCanvas() {
    const ctx = this.galaxyCanvas.getContext('2d');
    ctx.clearRect(0, 0, this.W, this.H);
    drawGalaxy(ctx, this.galaxyStars);
  }
  /**
   * Begin entry animation: portal opens at center and ship emerges.
   */
  startEntry() {
    this.setState(GAME_STATE.ENTRY);
    this.entryStartTime = performance.now();
    this.entryPortal = new Wormhole(this.W / 2, this.H / 2);
    // position ECS ship entity at center and reset velocity/rotation
    const pos = this.em.getComponent(this.shipEntity, 'position');
    const vel = this.em.getComponent(this.shipEntity, 'velocity');
    const rot = this.em.getComponent(this.shipEntity, 'rotation');
    pos.x = this.W / 2; pos.y = this.H / 2;
    vel.x = 0; vel.y = 0;
    rot.value = 0;
    // pre-render galaxy for potential flicker
    this._renderGalaxyCanvas();
    // play intro fanfare while ship is in the portal
    audio.startIntroFanfare();
  }

  /** Adjust canvas size to parent and store dimensions. */
  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.W = this.canvas.width = rect.width;
    this.H = this.canvas.height = rect.height;
  }

  /** Spawn a new asteroid away from the ship. */
  spawnAsteroid(size, variant = this.pickAsteroidVariant()) {
    let x, y;
    // ensure we spawn away from the ship's current position
    const shipPos = this.em.getComponent(this.shipEntity, 'position');
    do {
      x = rand(0, this.W);
      y = rand(0, this.H);
    } while (dist({ x, y }, shipPos) < 200);
    // ECS-managed asteroid
    createAsteroidEntity(this.em, this, x, y, size, variant);
  }

  pickAsteroidVariant() {
    const roll = Math.random();
    const modifier = this.currentSectorModifier || CONST.getSectorModifier(this.level);
    const heavyThreshold = (this.level >= 5 ? 0.2 : 0) + (modifier.heavyBias || 0);
    if (roll < heavyThreshold) return CONST.ASTEROID_VARIANTS.HEAVY;
    const swiftThreshold = heavyThreshold + (this.level >= 3 ? 0.25 : 0) + (modifier.swiftBias || 0);
    if (roll < swiftThreshold) return CONST.ASTEROID_VARIANTS.SWIFT;
    return CONST.ASTEROID_VARIANTS.STANDARD;
  }

  isMiniBossSector() {
    return this.level > 1 && this.level % CONST.MINIBOSS_EVERY_SECTORS === 0;
  }

  spawnSectorEncounter() {
    if (this.isMiniBossSector()) {
      this.spawnAsteroid(rand(88, 104), CONST.ASTEROID_VARIANTS.BOSS);
      for (let i = 0; i < CONST.MINIBOSS_SUPPORT_COUNT; i++) {
        const supportVariant = i % 2 === 0 ? CONST.ASTEROID_VARIANTS.HEAVY : CONST.ASTEROID_VARIANTS.SWIFT;
        this.spawnAsteroid(undefined, supportVariant);
      }
      return;
    }
    for (let i = 0; i < this.getSectorAsteroidCount(); i++) this.spawnAsteroid();
  }

  /** Begin ship explosion and particle effects. */
  startExplosion() {
    this.clearExplosionPulseTimeouts();
    this.setState(GAME_STATE.EXPLODING);
    this.explosionStart = performance.now();
    const posComp = this.em.getComponent(this.shipEntity, 'position');
    const x = posComp.x;
    const y = posComp.y;
    this.explosionCenter = { x, y };
    this.shipTrail = [];
    this.spawnExplosionPulse(x, y, {
      particles: CONST.EXPLOSION_PARTICLES_COUNT + 52,
      shake: 18,
      flashAlpha: 0.38,
      flashColor: '255,150,110'
    });
    this.queueExplosionPulse(160, () => {
      this.spawnExplosionPulse(x, y, {
        particles: 42,
        shake: 12,
        flashAlpha: 0.24,
        flashColor: '255,110,80'
      });
    });
    this.queueExplosionPulse(300, () => {
      this.spawnExplosionPulse(x, y, {
        particles: 34,
        shake: 9,
        flashAlpha: 0.18,
        flashColor: '255,170,120'
      });
    });
    this.queueExplosionPulse(420, () => {
      this.spawnExplosionPulse(x, y, {
        particles: 30,
        shake: 8,
        flashAlpha: 0.15,
        flashColor: '255,200,150'
      });
    });
    this.queueExplosionPulse(620, () => {
      this.spawnExplosionPulse(x, y, {
        particles: 22,
        shake: 6,
        flashAlpha: 0.11,
        flashColor: '255,220,180'
      });
    });
    this.queueExplosionPulse(760, () => {
      this.spawnExplosionPulse(x, y, {
        particles: 18,
        shake: 5,
        flashAlpha: 0.08,
        flashColor: '255,240,220'
      });
    });
    audio.playExplosionSound();
  }

  /** Drop a random power-up at (x,y). */
  spawnPowerup(x, y) {
    const type = this.choosePowerupDrop();
    createPowerupEntity(this.em, this, x, y, type);
  }

  choosePowerupDrop() {
    const weights = new Map();
    const addWeight = (type, amount) => {
      weights.set(type, (weights.get(type) || 0) + amount);
    };
    const getAmmoRatio = (type) => {
      const max = CONST.MAX_AMMO[type] || 1;
      return Math.max(0, Math.min(1, (this.ammo[type] || 0) / max));
    };

    const shieldNeed = this.shieldOverpowered
      ? 0
      : Math.max(0, (3 - this.shield) / 3);
    addWeight(CONST.POWERUP_TYPES.SHIELD, 0.4 + shieldNeed * 2.6);
    if (this.shield === 0) addWeight(CONST.POWERUP_TYPES.SHIELD, 1.2);

    for (const type of [
      CONST.POWERUP_TYPES.MACHINE,
      CONST.POWERUP_TYPES.POWER,
      CONST.POWERUP_TYPES.MISSILE
    ]) {
      const ammoRatio = getAmmoRatio(type);
      const shortage = 1 - ammoRatio;
      addWeight(type, 0.45 + shortage * 1.8);
      if (this.activePowerup === type && ammoRatio < 0.35) {
        addWeight(type, 0.9);
      }
      if (this.activePowerup !== type && ammoRatio <= 0.05) {
        addWeight(type, 0.35);
      }
    }

    const total = Array.from(weights.values()).reduce((sum, value) => sum + value, 0);
    let roll = Math.random() * total;
    for (const [type, weight] of weights.entries()) {
      roll -= weight;
      if (roll <= 0) return type;
    }
    return CONST.POWERUP_TYPES.SHIELD;
  }

  /** Apply collected power-up effects. */
  applyPowerup(type) {
    const now = performance.now();
    audio.playPowerupPickup();
    switch (type) {
      case CONST.POWERUP_TYPES.SHIELD:
        // if shield at full health or already overpowered, enter/reset overpowered mode
        if (this.shieldOverpowered) {
          this.shieldOverpoweredExpiry = now + CONST.POWERUP_DURATION;
        } else if (this.shield === 3) {
          this.shieldOverpowered = true;
          this.shieldOverpoweredExpiry = now + CONST.POWERUP_DURATION;
        } else {
          // normal shield refill
          this.shield = 3;
        }
        break;
      case CONST.POWERUP_TYPES.MACHINE:
        // refill machine gun ammo and equip
        this.ammo[CONST.POWERUP_TYPES.MACHINE] = CONST.MAX_AMMO[CONST.POWERUP_TYPES.MACHINE];
        this.activePowerup = CONST.POWERUP_TYPES.MACHINE;
        this.syncWeaponStats();
        break;
      case CONST.POWERUP_TYPES.POWER:
        // refill power shot ammo and equip
        this.ammo[CONST.POWERUP_TYPES.POWER] = CONST.MAX_AMMO[CONST.POWERUP_TYPES.POWER];
        this.activePowerup = CONST.POWERUP_TYPES.POWER;
        this.syncWeaponStats();
        break;
      case CONST.POWERUP_TYPES.MISSILE:
        // refill missile ammo and equip
        this.ammo[CONST.POWERUP_TYPES.MISSILE] = CONST.MAX_AMMO[CONST.POWERUP_TYPES.MISSILE];
        this.activePowerup = CONST.POWERUP_TYPES.MISSILE;
        this.syncWeaponStats();
        break;
    }
  }

  /** Revert to base weapon settings when power-up expires. */
  expirePowerup() {
    this.restoreBaseWeapon();
    this.activePowerup = null;
  }

  /**
   * Restore default weapon parameters.
   */
  restoreBaseWeapon() {
    const bulletSpeedMult = this.currentSectorModifier?.bulletSpeedMult || 1;
    this.shotInterval = CONST.BASE_SHOT_INTERVAL;
    this.bulletSpeedMin = CONST.BASE_BULLET_SPEED_MIN * bulletSpeedMult;
    this.bulletSpeedMax = CONST.BASE_BULLET_SPEED_MAX * bulletSpeedMult;
    this.bulletSize = CONST.BASE_BULLET_SIZE;
    this.bulletLife = CONST.BASE_BULLET_LIFE;
  }

  syncWeaponStats() {
    const bulletSpeedMult = this.currentSectorModifier?.bulletSpeedMult || 1;
    this.restoreBaseWeapon();
    if (this.activePowerup === CONST.POWERUP_TYPES.MACHINE) {
      this.shotInterval = CONST.MACHINE_GUN_INTERVAL;
    } else if (this.activePowerup === CONST.POWERUP_TYPES.POWER) {
      this.bulletSpeedMin = CONST.POWER_BULLET_SPEED_MIN * bulletSpeedMult;
      this.bulletSpeedMax = CONST.POWER_BULLET_SPEED_MAX * bulletSpeedMult;
      this.bulletSize = CONST.POWER_BULLET_SIZE;
    }
  }
  /**
   * Spawn a wormhole portal when sector is cleared.
   */
  spawnWormhole() {
    // position portal away from ship
    let x, y;
    const shipPos = this.em.getComponent(this.shipEntity, 'position');
    do {
      x = Math.random() * this.W;
      y = Math.random() * this.H;
    } while (shipPos && dist({ x, y }, shipPos) < 200);
    this.wormhole = new Wormhole(x, y);
    if (!this.pendingSectorClearBonus) {
      this.pendingSectorClearBonus = true;
      this.score += CONST.SECTOR_CLEAR_BONUS * this.level;
      this.updateScoreHud();
    }
    audio.playWormholeStinger();
  }
  /**
   * Advance to the next sector (level) when ship enters wormhole.
   */
  nextLevel() {
    audio.playSectorAdvanceStinger();
    // preserve ship velocity, angle, and portal position for exit
    // read ECS ship components for exit state
    const velComp = this.em.getComponent(this.shipEntity, 'velocity');
    const rotComp = this.em.getComponent(this.shipEntity, 'rotation');
    const posComp = this.em.getComponent(this.shipEntity, 'position');
    const exitVelX = velComp.x;
    const exitVelY = velComp.y;
    const exitAngle = rotComp.value;
    const exitX = posComp.x;
    const exitY = posComp.y;
    // increment level and update HUD
    this.level++;
    this.sectorEl.textContent = this.level;
    this.updateSectorModifier();
    this.pendingSectorClearBonus = false;
    // regenerate galaxy background
    this.galaxyStars = initGalaxy(this.W, this.H, this.level);
    this.galaxyOffsetX = 0;
    this.galaxyOffsetY = 0;
    this._renderGalaxyCanvas();
    // clear existing ECS-managed entities (bullets, etc.)
    // (ECS will handle cleanup via LifetimeSystem and removeEntity)
    // ECS-managed particles (thrusters, explosions) cleaned by ParticleSystem
    // ECS-managed power-ups and asteroids cleaned via systems
    // legacy arrays (powerups, asteroids) are no longer used
    // spawn asteroids for next sector
    this.spawnSectorEncounter();
    // schedule portal removal after exit, keep portal visible for 2s
    this.portalExitExpire = performance.now();
    // immediate warp through portal: reposition ship just outside portal rim along velocity vector
    // reposition ECS ship entity just outside portal rim
    const shipComp = this.em.getComponent(this.shipEntity, 'ship');
    const distOut = this.wormhole.r + shipComp.r;
    const vMag = Math.hypot(exitVelX, exitVelY) || 1;
    const nx = exitVelX / vMag;
    const ny = exitVelY / vMag;
    const pos = this.em.getComponent(this.shipEntity, 'position');
    const vel = this.em.getComponent(this.shipEntity, 'velocity');
    const rot = this.em.getComponent(this.shipEntity, 'rotation');
    pos.x = exitX + nx * distOut;
    pos.y = exitY + ny * distOut;
    vel.x = exitVelX; vel.y = exitVelY;
    rot.value = exitAngle;
    return;
  }

  /** Reset game state for a new round. */
  resetGame() {
    this.clearExplosionPulseTimeouts();
    // Start from a clean ECS state so bullets, asteroids, particles, and
    // power-ups from the previous run cannot leak into the next game.
    for (const entity of this.em.getAllEntities()) {
      this.em.removeEntity(entity);
    }
    this.shipEntity = createShipEntity(this.em, this);
    const pos = this.em.getComponent(this.shipEntity, 'position');
    const vel = this.em.getComponent(this.shipEntity, 'velocity');
    const rot = this.em.getComponent(this.shipEntity, 'rotation');
    const rotSpeed = this.em.getComponent(this.shipEntity, 'rotationSpeed');
    pos.x = this.W / 2; pos.y = this.H / 2;
    vel.x = 0; vel.y = 0;
    rot.value = 0;
    rotSpeed.value = 0;
    this.score = 0;
    this.shield = 3;
    this.comboCount = 0;
    this.comboMultiplier = 1;
    this.comboExpiry = 0;
    this.pendingSectorClearBonus = false;
    // overpowered shield state and timer (10s duration)
    this.shieldOverpowered = false;
    this.shieldOverpoweredExpiry = 0;
    this.explosionStart = 0;
    this.explosionCenter = null;
    this.shipInvulnerableUntil = 0;
    this.shipTrail = [];
    this.ammo = {
      [CONST.POWERUP_TYPES.MISSILE]: 0,
      [CONST.POWERUP_TYPES.MACHINE]: 0,
      [CONST.POWERUP_TYPES.POWER]: 0
    };
    this.shotInterval = CONST.BASE_SHOT_INTERVAL;
    this.bulletSpeedMin = CONST.BASE_BULLET_SPEED_MIN;
    this.bulletSpeedMax = CONST.BASE_BULLET_SPEED_MAX;
    this.bulletSize = CONST.BASE_BULLET_SIZE;
    this.bulletLife = CONST.BASE_BULLET_LIFE;
    this.activePowerup = null;
    this.lastShot = 0;
    this.updateScoreHud();
    // reset level/sector display
    this.level = 1;
    this.sectorEl.textContent = this.level;
    this.updateSectorModifier();
    // remove any existing wormhole
    this.wormhole = null;
    this.portalExitExpire = null;
    this.entryPortal = null;
    this.startScreenEl.innerHTML = this.defaultStartScreenHTML;
    this.startScreenEl.style.display = 'flex';
    this.setState(GAME_STATE.START);
    // spawn initial asteroids
    this.spawnSectorEncounter();
    // initialize galaxy background for sector 1
    this.galaxyStars = initGalaxy(this.W, this.H, this.level);
    this.galaxyOffsetX = 0;
    this.galaxyOffsetY = 0;
    this._renderGalaxyCanvas();
  }

  // Legacy update() removed; ECS systems handle input, movement, collisions, particles, and portal checks.

  /** Draw all active game objects. */
  render() {
    // draw wormhole portal if present
    if (this.wormhole) this.wormhole.draw(this.ctx);
    // (galaxy background drawn earlier)
    // bullets are now ECS-managed via RenderSystem
  }

  renderExplosionOverlay(now) {
    if (!this.explosionCenter) return;
    const elapsed = now - this.explosionStart;
    const progress = Math.max(0, Math.min(1, elapsed / CONST.EXPLOSION_DURATION));
    const { x, y } = this.explosionCenter;
    const maxRadius = Math.min(this.W, this.H) * 0.4;

    this.ctx.save();
    this.ctx.globalCompositeOperation = 'screen';

    const coreRadius = 24 + maxRadius * 0.34 * progress;
    const coreAlpha = Math.max(0, 1 - progress * 1.05);
    const coreGradient = this.ctx.createRadialGradient(x, y, 0, x, y, coreRadius);
    coreGradient.addColorStop(0, `rgba(255,255,255,${coreAlpha})`);
    coreGradient.addColorStop(0.35, `rgba(255,210,150,${coreAlpha * 0.9})`);
    coreGradient.addColorStop(1, 'rgba(255,110,50,0)');
    this.ctx.fillStyle = coreGradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, coreRadius, 0, Math.PI * 2);
    this.ctx.fill();

    const shockRadius = 32 + maxRadius * progress;
    this.ctx.strokeStyle = `rgba(255,210,150,${Math.max(0, 0.58 - progress * 0.42)})`;
    this.ctx.lineWidth = Math.max(3, 16 * (1 - progress));
    this.ctx.beginPath();
    this.ctx.arc(x, y, shockRadius, 0, Math.PI * 2);
    this.ctx.stroke();

    const emberRadius = 18 + maxRadius * 0.72 * progress;
    this.ctx.strokeStyle = `rgba(255,120,80,${Math.max(0, 0.38 - progress * 0.2)})`;
    this.ctx.lineWidth = Math.max(2, 8 * (1 - progress * 0.7));
    this.ctx.beginPath();
    this.ctx.arc(x, y, emberRadius, 0, Math.PI * 2);
    this.ctx.stroke();

    const debrisRadius = 10 + maxRadius * 0.88 * progress;
    this.ctx.strokeStyle = `rgba(255,170,110,${Math.max(0, 0.24 - progress * 0.16)})`;
    this.ctx.lineWidth = Math.max(1, 4 * (1 - progress * 0.5));
    this.ctx.beginPath();
    this.ctx.arc(x, y, debrisRadius, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.restore();
  }

  /** Main loop invoked via requestAnimationFrame. */
  loop(now) {
    this.applyScreenShake(now);
    // handle entry portal animation
    if (this.isState(GAME_STATE.ENTRY)) {
      const elapsed = now - this.entryStartTime;
      this.updateSectorTheme(now);
      // draw background layers
      this.starfield.update();
      const [c1, c2] = SECTOR_BG[(this.level - 1) % SECTOR_BG.length];
      const bg = this.ctx.createLinearGradient(0, 0, 0, this.H);
      bg.addColorStop(0, c1);
      bg.addColorStop(1, c2);
      this.ctx.fillStyle = bg;
      this.ctx.fillRect(0, 0, this.W, this.H);
      // draw galaxy
      if (this.galaxyCanvas) {
        const W = this.W, H = this.H;
        let ox = -this.galaxyOffsetX % W; if (ox < 0) ox += W;
        let oy = -this.galaxyOffsetY % H; if (oy < 0) oy += H;
        for (let dx = -W; dx <= 0; dx += W) {
          for (let dy = -H; dy <= 0; dy += H) {
            this.ctx.drawImage(this.galaxyCanvas, ox + dx, oy + dy, W, H);
          }
        }
      }
      // nebula overlay
      const neb = this.nebulaImages[(this.level - 1) % this.nebulaImages.length];
      if (neb && neb.complete) {
        this.ctx.globalAlpha = 0.3;
        this.ctx.drawImage(neb, 0, 0, this.W, this.H);
        this.ctx.globalAlpha = 1;
      }
      this.renderSectorTheme(now);
      this.starfield.draw(this.ctx);
      // animate and draw entry portal
      if (this.entryPortal) {
        this.entryPortal.update();
        this.entryPortal.draw(this.ctx);
      }
      // once entry duration elapsed, finish entry
      if (elapsed >= this.entryDuration) {
        this.entryPortal = null;
        audio.setMusicContext({
          modifierId: this.currentSectorModifier?.id,
          asteroidCount: this.em.query('asteroid').length,
          shield: this.shield
        });
        this.setState(GAME_STATE.PLAYING);
        audio.startBackgroundMusic();
        audio.startDrumArp();
      }
      this.renderFlashOverlay();
      requestAnimationFrame(this.loop);
      return;
    }
    // only update game state and ECS systems when running and not paused
    if (this.isState(GAME_STATE.PLAYING)) {
      // compute delta time
      const dt = now - this.lastTime;
      this.lastTime = now;
      this.updateSectorTheme(now);
      // run ECS update (includes input, movement, collisions, particles, etc.)
      this.sm.update(dt, now);
      // dynamic music intensity based on remaining asteroids in ECS
      const count = this.em.query('asteroid').length;
      const max = 5;
      const baseVol = 0.025;
      audio.setMusicVolume(baseVol + (count / max) * baseVol);
      audio.setMusicContext({
        modifierId: this.currentSectorModifier?.id,
        asteroidCount: count,
        shield: this.shield
      });
      this.expireCombo(now);
      // spawn wormhole when sector is cleared
      if (count === 0 && !this.wormhole) {
        this.spawnWormhole();
      }
      // update wormhole and check for sector transition (ignore during exit delay)
      if (this.wormhole) {
        this.wormhole.update();
        if (!this.portalExitExpire) {
          const shipPos = this.em.getComponent(this.shipEntity, 'position');
          const shipComp = this.em.getComponent(this.shipEntity, 'ship');
          if (shipPos && shipComp && dist(shipPos, this.wormhole) < shipComp.r + this.wormhole.r) {
            this.nextLevel();
          }
        }
      }
      // remove portal after exit delay
      if (this.portalExitExpire && now - this.portalExitExpire >= CONST.PORTAL_EXIT_DURATION) {
        this.wormhole = null;
        this.portalExitExpire = null;
      }
      // handle overpowered shield expiration
      if (this.shieldOverpowered && now >= this.shieldOverpoweredExpiry) {
        this.shieldOverpowered = false;
        this.shield = 3;
      }
      // update HUD shield bar
      const shieldEl = this.shieldFillEl;
      if (shieldEl) {
        const pct = Math.max(0, Math.min(1, this.shield / 3));
        shieldEl.style.width = `${pct * 100}%`;
        if (this.shieldOverpowered && now < this.shieldOverpoweredExpiry) {
          const t2 = now / 300;
          const pulse2 = (Math.sin(t2) * 0.5 + 0.5);
          const hue = 200;
          const light = 80 + pulse2 * 20;
          shieldEl.style.background = `hsl(${hue},100%,${light}%)`;
        } else {
          let col;
          switch (this.shield) {
            case 3: col = 'rgb(0,255,0)'; break;
            case 2: col = 'rgb(255,255,0)'; break;
            case 1: col = 'rgb(255,0,0)'; break;
            default: col = '#444'; break;
          }
          shieldEl.style.background = col;
        }
      }
      // update HUD ammo bars
      Object.keys(this.ammoEls).forEach(type => {
        const el = this.ammoEls[type];
        if (!el) return;
        const maxAmmo = CONST.MAX_AMMO[type] || 1;
        const cur = this.ammo[type] || 0;
        const pct = Math.max(0, Math.min(1, cur / maxAmmo));
        el.style.width = `${pct * 100}%`;
      });
    }
    // fill sector-specific gradient
    const [c1, c2] = SECTOR_BG[(this.level - 1) % SECTOR_BG.length];
    const bg = this.ctx.createLinearGradient(0, 0, 0, this.H);
    bg.addColorStop(0, c1);
    bg.addColorStop(1, c2);
    this.ctx.fillStyle = bg;
    this.ctx.fillRect(0, 0, this.W, this.H);
    // draw pre-rendered galaxy background with subtle wrap
    if (this.galaxyCanvas) {
      const W = this.W, H = this.H;
      // calculate tile offset (wrap around)
      let ox = -this.galaxyOffsetX % W;
      let oy = -this.galaxyOffsetY % H;
      if (ox < 0) ox += W;
      if (oy < 0) oy += H;
      // draw 2x2 tiles to fill viewport
      for (let dx = -W; dx <= 0; dx += W) {
        for (let dy = -H; dy <= 0; dy += H) {
          this.ctx.drawImage(this.galaxyCanvas, ox + dx, oy + dy, W, H);
        }
      }
    }
    // nebula overlay for sector
    const neb = this.nebulaImages[(this.level - 1) % this.nebulaImages.length];
    if (neb && neb.complete) {
      this.ctx.globalAlpha = 0.3;
      this.ctx.drawImage(neb, 0, 0, this.W, this.H);
      this.ctx.globalAlpha = 1;
    }
    this.renderSectorTheme(now);
    // prune old ship trail positions
    this.shipTrail = this.shipTrail.filter(tr => now - tr.t <= CONST.TRAIL_DURATION);
    // run ECS render
    this.sm.render(this.ctx);
    // draw ship white-to-blue fading trail (20% ship width)
    if (this.shipTrail && this.shipTrail.length) {
      const shipComp = this.em.getComponent(this.shipEntity, 'ship');
      const r = (shipComp?.r || 10) * 0.2;
      for (const tr of this.shipTrail) {
        const age = now - tr.t;
        const alpha = Math.max(1 - age / CONST.TRAIL_DURATION, 0);
        // radial gradient from white center to blue edge
        const grad = this.ctx.createRadialGradient(tr.x, tr.y, 0, tr.x, tr.y, r);
        grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
        grad.addColorStop(1, `rgba(0,150,255,${alpha})`);
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(tr.x, tr.y, r, 0, 2 * Math.PI);
        this.ctx.fill();
      }
    }
    // foreground
    if (this.isState(GAME_STATE.EXPLODING)) {
      this.render();
      // explosion in progress: ECS ParticleSystem will render remaining particles
      this.renderExplosionOverlay(now);
      if (now - this.explosionStart > CONST.EXPLOSION_DURATION) {
        this.clearExplosionPulseTimeouts();
        this.explosionCenter = null;
        audio.stopBackgroundMusicImmediate();
        audio.suspendAudio();
        this.showGameOverScreen();
      }
    } else if (!this.isState(GAME_STATE.START, GAME_STATE.GAME_OVER)) {
      this.render();
    }
    this.renderFlashOverlay();
    requestAnimationFrame(this.loop);
  }
}
