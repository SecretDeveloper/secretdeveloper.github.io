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
    this.sm.addSystem(new PowerupSystem(this.em));
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
    this.entryActive = false;
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
    this.pauseScreenEl.style.display = 'none';
    this.paused = false;
    // sector / level tracking
    this.level = 1;
    this.sectorEl = document.getElementById('sector');
    this.sectorEl.textContent = this.level;
    // cache HUD shield fill element
    this.shieldFillEl = document.getElementById('shield-fill');
    // nebula overlays per sector
    this.nebulaImages = nebulaImages;
    // wormhole portal (when sector cleared)
    this.wormhole = null;
    // timestamp when portal should be removed after exit
    this.portalExitExpire = null;
    window.addEventListener('keydown', e => {
      // start game (Enter key)
      if (!this.started && (e.key === CONST.KEY.ENTER || e.keyCode === 13)) {
        // initialize/resume AudioContext on first user gesture
        audio.resumeAudio();
        this.startScreenEl.style.display = 'none';
        this.hudEl.style.display = 'block';
        this.started = true;
        this.startEntry();
      }
      // pause game (Escape key)
      else if (this.started && !this.paused && (e.key === CONST.KEY.PAUSE || e.keyCode === 27)) {
        this.paused = true;
        this.pauseScreenEl.style.display = 'flex';
        // suspend audio context and stop loops
        audio.suspendAudio();
        audio.stopDrumArp();
      }
      // resume from pause (Enter key)
      else if (this.started && this.paused && (e.key === CONST.KEY.ENTER || e.keyCode === 13)) {
        this.paused = false;
        this.pauseScreenEl.style.display = 'none';
        // resume audio context and restart loops
        audio.resumeAudio();
        audio.startDrumArp();
      }
    });

    // game state
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
    // overpowered shield state and timer (10s duration)
    this.shieldOverpowered = false;
    this.shieldOverpoweredExpiry = 0;
    this.started = false;
    this.exploding = false;
    this.explosionStart = 0;
    this.finalScore = 0;

    // weapon & power-up state
    this.bulletSpeedMin = CONST.BASE_BULLET_SPEED_MIN;
    this.bulletSpeedMax = CONST.BASE_BULLET_SPEED_MAX;
    this.bulletSize = CONST.BASE_BULLET_SIZE;
    this.bulletLife = CONST.BASE_BULLET_LIFE;
    this.shotInterval = CONST.BASE_SHOT_INTERVAL;
    this.activePowerup = null;

    // initial asteroids
    for (let i = 0; i < 5; i++) this.spawnAsteroid();

    // HUD
    this.hudEl.style.display = 'none';
    this.scoreEl.textContent = this.score;

    // start loop
    this.loop = this.loop.bind(this);
    // track time for ECS dt
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
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
    this.entryActive = true;
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
  spawnAsteroid() {
    let x, y;
    // ensure we spawn away from the ship's current position
    const shipPos = this.em.getComponent(this.shipEntity, 'position');
    do {
      x = rand(0, this.W);
      y = rand(0, this.H);
    } while (dist({ x, y }, shipPos) < 200);
    // ECS-managed asteroid
    createAsteroidEntity(this.em, this, x, y);
  }

  /** Begin ship explosion and particle effects. */
  startExplosion() {
    this.exploding = true;
    this.explosionStart = performance.now();
    // spawn explosion particles via ECS
    // spawn explosion particles via ECS at ship position
    const posComp = this.em.getComponent(this.shipEntity, 'position');
    for (let i = 0; i < CONST.EXPLOSION_PARTICLES_COUNT; i++) {
      createExplosionParticleEntity(this.em, posComp.x, posComp.y);
    }
    audio.playExplosionSound();
    this.hudEl.style.display = 'none';
  }

  /** Drop a random power-up at (x,y). */
  spawnPowerup(x, y) {
    const types = Object.values(CONST.POWERUP_TYPES);
    const type = types[Math.floor(rand(0, types.length))];
    createPowerupEntity(this.em, this, x, y, type);
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
        this.shotInterval = CONST.MACHINE_GUN_INTERVAL;
        break;
      case CONST.POWERUP_TYPES.POWER:
        // refill power shot ammo and equip
        this.ammo[CONST.POWERUP_TYPES.POWER] = CONST.MAX_AMMO[CONST.POWERUP_TYPES.POWER];
        this.activePowerup = CONST.POWERUP_TYPES.POWER;
        // adjust bullet properties for power shots
        this.bulletSpeedMin = CONST.POWER_BULLET_SPEED_MIN;
        this.bulletSpeedMax = CONST.POWER_BULLET_SPEED_MAX;
        this.bulletSize = CONST.POWER_BULLET_SIZE;
        break;
      case CONST.POWERUP_TYPES.MISSILE:
        // refill missile ammo and equip
        this.ammo[CONST.POWERUP_TYPES.MISSILE] = CONST.MAX_AMMO[CONST.POWERUP_TYPES.MISSILE];
        this.activePowerup = CONST.POWERUP_TYPES.MISSILE;
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
    this.shotInterval = CONST.BASE_SHOT_INTERVAL;
    this.bulletSpeedMin = CONST.BASE_BULLET_SPEED_MIN;
    this.bulletSpeedMax = CONST.BASE_BULLET_SPEED_MAX;
    this.bulletSize = CONST.BASE_BULLET_SIZE;
    this.bulletLife = CONST.BASE_BULLET_LIFE;
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
  }
  /**
   * Advance to the next sector (level) when ship enters wormhole.
   */
  nextLevel() {
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
    const count = 5 + this.level;
    for (let i = 0; i < count; i++) this.spawnAsteroid();
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
    // reset ECS ship entity position, velocity, rotation
    const pos = this.em.getComponent(this.shipEntity, 'position');
    const vel = this.em.getComponent(this.shipEntity, 'velocity');
    const rot = this.em.getComponent(this.shipEntity, 'rotation');
    pos.x = this.W / 2; pos.y = this.H / 2;
    vel.x = 0; vel.y = 0;
    rot.value = 0;
    // ECS-managed entities (bullets, asteroids, particles) cleaned by LifetimeSystem / removeEntity
    // reset ship state only
    this.score = 0;
    this.shield = 3;
    // overpowered shield state and timer (10s duration)
    this.shieldOverpowered = false;
    this.shieldOverpoweredExpiry = 0;
    this.exploding = false;
    // ECS-managed particles handle explosion effects
    // reset weapon and power-up state
    this.shotInterval = CONST.BASE_SHOT_INTERVAL;
    this.bulletSpeedMin = CONST.BASE_BULLET_SPEED_MIN;
    this.bulletSpeedMax = CONST.BASE_BULLET_SPEED_MAX;
    this.bulletSize = CONST.BASE_BULLET_SIZE;
    this.bulletLife = CONST.BASE_BULLET_LIFE;
    this.activePowerup = null;
    this.scoreEl.textContent = this.score;
    // reset level/sector display
    this.level = 1;
    this.sectorEl.textContent = this.level;
    // remove any existing wormhole
    this.wormhole = null;
    // spawn initial asteroids
    for (let i = 0; i < 5; i++) this.spawnAsteroid();
    // initialize galaxy background for sector 1
    this.galaxyStars = initGalaxy(this.W, this.H, this.level);
    this.galaxyOffsetX = 0;
    this.galaxyOffsetY = 0;
    this._renderGalaxyCanvas();
    // start entry portal for new game
    this.startEntry();
  }

  // Legacy update() removed; ECS systems handle input, movement, collisions, particles, and portal checks.

  /** Draw all active game objects. */
  render() {
    // draw wormhole portal if present
    if (this.wormhole) this.wormhole.draw(this.ctx);
    // (galaxy background drawn earlier)
    // bullets are now ECS-managed via RenderSystem
  }

  /** Main loop invoked via requestAnimationFrame. */
  loop(now) {
    // handle entry portal animation
    if (this.started && this.entryActive) {
      const elapsed = now - this.entryStartTime;
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
      this.starfield.draw(this.ctx);
      // animate and draw entry portal
      this.entryPortal.update();
      this.entryPortal.draw(this.ctx);
      // once entry duration elapsed, finish entry
      if (elapsed >= this.entryDuration) {
        this.entryActive = false;
        this.entryPortal = null;
        audio.startBackgroundMusic();
        audio.startDrumArp();
      }
      requestAnimationFrame(this.loop);
      return;
    }
    // only update game state and ECS systems when running and not paused
    if (this.started && !this.paused) {
      // compute delta time
      const dt = now - this.lastTime;
      this.lastTime = now;
      // run ECS update (includes input, movement, collisions, particles, etc.)
      this.sm.update(dt, now);
      // dynamic music intensity based on remaining asteroids in ECS
      const count = this.em.query('asteroid').length;
      const max = 5;
      const baseVol = 0.025;
      audio.setMusicVolume(baseVol + (count / max) * baseVol);
      // spawn wormhole when sector is cleared
      if (count === 0 && !this.wormhole && !this.exploding) {
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
    if (this.started) {
      this.render();
    } else if (this.exploding) {
      // explosion in progress: ECS ParticleSystem will render remaining particles
      if (now - this.explosionStart > CONST.EXPLOSION_DURATION) {
        this.startScreenEl.innerHTML =
          `<h1>Game Over</h1>` +
          `<p>Your score: ${this.finalScore}</p>` +
          `<p>Press Enter to restart.</p>`;
        this.startScreenEl.style.display = 'flex';
        audio.stopBackgroundMusicImmediate();
        audio.suspendAudio();
        this.resetGame();
      }
    }
    requestAnimationFrame(this.loop);
  }
}
