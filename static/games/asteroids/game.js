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
import { Ship } from './ship.js';
import { Bullet, Missile } from './bullet.js';
import { Asteroid } from './asteroid.js';
import {
  ThrusterParticle, ExplosionParticle,
  createThrusterParticle, createExplosionParticle,
  thrusterPool, explosionPool
} from './particle.js';
import { Powerup } from './powerup.js';
import nebulaImages from './nebula.js';
import { initGalaxy, drawGalaxy } from './galaxy.js';
// Galaxy background replaces old Planet set-pieces
import { Wormhole } from './wormhole.js';

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
        this.initStars();
      }, 200);
    });

    // starfield with two layers: far and near stars
    this.starsFar = [];
    this.starsNear = [];
    this.initStars();

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
    // nebula overlays per sector
    this.nebulaImages = nebulaImages;
    // wormhole portal (when sector cleared)
    this.wormhole = null;
    // timestamp when portal should be removed after exit
    this.portalExitExpire = null;
    window.addEventListener('keydown', e => {
      // start game
      if (!this.started && e.key === CONST.KEY.ENTER) {
        this.startScreenEl.style.display = 'none';
        this.hudEl.style.display = 'block';
        this.started = true;
        this.startEntry();
      }
      // pause game
      else if (this.started && !this.paused && e.key === CONST.KEY.PAUSE) {
        this.paused = true;
        this.pauseScreenEl.style.display = 'flex';
        // suspend audio context and stop loops
        audio.suspendAudio();
        audio.stopDrumArp();
      }
      // resume from pause
      else if (this.started && this.paused && e.key === CONST.KEY.ENTER) {
        this.paused = false;
        this.pauseScreenEl.style.display = 'none';
        // resume audio context and restart loops
        audio.resumeAudio();
        audio.startDrumArp();
      }
    });

    // game state
    this.ship = new Ship(this);
    this.bullets = [];
    this.asteroids = [];
    this.thrusters = [];
    this.powerups = [];
    this.explosionParticles = [];
    this.score = 0;
    this.shield = 3;
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
    this.powerupExpires = 0;

    // initial asteroids
    for (let i = 0; i < 5; i++) this.spawnAsteroid();

    // HUD
    this.hudEl.style.display = 'none';
    this.scoreEl.textContent = this.score;

    // start loop
    this.loop = this.loop.bind(this);
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
    this.entryPortal = new Wormhole(this.W/2, this.H/2);
    // position ship at center and reset velocity
    this.ship.reset();
    // pre-render galaxy for potential flicker
    this._renderGalaxyCanvas();
  }

  /** Adjust canvas size to parent and store dimensions. */
  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.W = this.canvas.width = rect.width;
    this.H = this.canvas.height = rect.height;
  }

  /** Create initial starfield. */
  initStars() {
    // far star layer: small, slow-moving
    this.starsFar = [];
    for (let i = 0; i < CONST.STAR_COUNT; i++) {
      this.starsFar.push({
        x: rand(0, this.W), y: rand(0, this.H),
        r: rand(0.5, 1.2), baseAlpha: rand(0.2, 0.6),
        drift: rand(0.02, 0.1)
      });
    }
    // near star layer: larger, faster-moving
    this.starsNear = [];
    for (let i = 0; i < CONST.STAR_COUNT / 2; i++) {
      this.starsNear.push({
        x: rand(0, this.W), y: rand(0, this.H),
        r: rand(1.5, 3), baseAlpha: rand(0.1, 0.4),
        drift: rand(0.1, 0.3)
      });
    }
  }

  /** Update star positions for parallax effect. */
  /** Update star positions for parallax effect. */
  updateStars() {
    const vx = this.ship.velX || 0;
    const vy = this.ship.velY || 0;
    // far stars
    this.starsFar.forEach(s => {
      s.x -= vx * CONST.STAR_PARALLAX;
      s.y -= vy * CONST.STAR_PARALLAX;
      s.y += s.drift;
      if (s.x < 0) s.x += this.W;
      else if (s.x > this.W) s.x -= this.W;
      if (s.y > this.H) s.y = 0;
      else if (s.y < 0) s.y = this.H;
    });
    // near stars: faster parallax and drift
    const multi = CONST.STAR_PARALLAX * 1.5;
    this.starsNear.forEach(s => {
      s.x -= vx * multi;
      s.y -= vy * multi;
      s.y += s.drift;
      if (s.x < 0) s.x += this.W;
      else if (s.x > this.W) s.x -= this.W;
      if (s.y > this.H) s.y = 0;
      else if (s.y < 0) s.y = this.H;
    });
    // galaxy background parallax offset (very distant)
    const galPar = CONST.STAR_PARALLAX * 0.1;
    this.galaxyOffsetX += vx * galPar;
    this.galaxyOffsetY += vy * galPar;
  }

  /** Draw the starfield background. */
  renderStars() {
    // draw far stars as white
    this.starsFar.forEach(s => {
      this.ctx.fillStyle = `rgba(255,255,255,${s.baseAlpha})`;
      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, s.r, 0, 2 * Math.PI);
      this.ctx.fill();
    });
    // draw near stars tinted per sector
    const hue = ((this.level - 1) * 60) % 360;
    this.starsNear.forEach(s => {
      this.ctx.fillStyle = `hsla(${hue},70%,${Math.round(s.baseAlpha * 100)}%,${s.baseAlpha})`;
      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, s.r, 0, 2 * Math.PI);
      this.ctx.fill();
    });
  }

  /** Spawn a new asteroid away from the ship. */
  spawnAsteroid() {
    let x, y;
    do {
      x = rand(0, this.W);
      y = rand(0, this.H);
    } while (dist({ x, y }, this.ship) < 200);
    this.asteroids.push(new Asteroid(x, y, null, this));
  }

  /** Begin ship explosion and particle effects. */
  startExplosion() {
    this.exploding = true;
    this.explosionStart = performance.now();
    this.explosionParticles = [];
    for (let i = 0; i < CONST.EXPLOSION_PARTICLES_COUNT; i++) {
      // obtain explosion particle from pool or create new
      this.explosionParticles.push(
        createExplosionParticle(this.ship.x, this.ship.y)
      );
    }
    audio.playExplosionSound();
    this.hudEl.style.display = 'none';
  }

  /** Drop a random power-up at (x,y). */
  spawnPowerup(x, y) {
    const types = Object.values(CONST.POWERUP_TYPES);
    const type = types[Math.floor(rand(0, types.length))];
    this.powerups.push(new Powerup(x, y, type));
  }

  /** Apply collected power-up effects. */
  applyPowerup(type) {
    const now = performance.now();
    audio.playPowerupPickup();
    switch (type) {
      case CONST.POWERUP_TYPES.SHIELD:
        this.shield = 3;
        break;
      case CONST.POWERUP_TYPES.MACHINE:
        this.shotInterval = CONST.MACHINE_GUN_INTERVAL;
        this.activePowerup = CONST.POWERUP_TYPES.MACHINE;
        this.powerupExpires = now + CONST.POWERUP_DURATION;
        break;
      case CONST.POWERUP_TYPES.POWER:
        this.bulletSpeedMin = CONST.POWER_BULLET_SPEED_MIN;
        this.bulletSpeedMax = CONST.POWER_BULLET_SPEED_MAX;
        this.bulletSize = CONST.POWER_BULLET_SIZE;
        this.bulletLife = CONST.POWER_BULLET_LIFE;
        this.activePowerup = CONST.POWERUP_TYPES.POWER;
        this.powerupExpires = now + CONST.POWERUP_DURATION;
        break;
      case CONST.POWERUP_TYPES.MISSILE:
        this.activePowerup = CONST.POWERUP_TYPES.MISSILE;
        this.powerupExpires = now + CONST.POWERUP_DURATION;
        break;
    }
  }

  /** Revert to base weapon settings when power-up expires. */
  expirePowerup() {
    this.shotInterval = CONST.BASE_SHOT_INTERVAL;
    this.bulletSpeedMin = CONST.BASE_BULLET_SPEED_MIN;
    this.bulletSpeedMax = CONST.BASE_BULLET_SPEED_MAX;
    this.bulletSize = CONST.BASE_BULLET_SIZE;
    this.bulletLife = CONST.BASE_BULLET_LIFE;
    this.activePowerup = null;
  }
  /**
   * Spawn a wormhole portal when sector is cleared.
   */
  spawnWormhole() {
    // position portal away from ship
    let x, y;
    do {
      x = Math.random() * this.W;
      y = Math.random() * this.H;
    } while (dist({ x, y }, this.ship) < 200);
    this.wormhole = new Wormhole(x, y);
  }
  /**
   * Advance to the next sector (level) when ship enters wormhole.
   */
  nextLevel() {
    // preserve ship velocity and angle for exit through portal
    const exitVelX = this.ship.velX;
    const exitVelY = this.ship.velY;
    const exitAngle = this.ship.angle;
    // increment level and update HUD
    this.level++;
    this.sectorEl.textContent = this.level;
    // regenerate galaxy background
    this.galaxyStars = initGalaxy(this.W, this.H, this.level);
    this.galaxyOffsetX = 0;
    this.galaxyOffsetY = 0;
    this._renderGalaxyCanvas();
    // clear existing entities
    this.bullets.length = 0;
    this.thrusters.length = 0;
    this.powerups.length = 0;
    this.asteroids.length = 0;
    // spawn asteroids for next sector
    const count = 5 + this.level;
    for (let i = 0; i < count; i++) this.spawnAsteroid();
    // schedule portal removal after exit, keep portal visible for 2s
    this.portalExitExpire = performance.now();
    // immediate warp through portal: reposition ship to center
    this.ship.x = this.W / 2;
    this.ship.y = this.H / 2;
    // restore previous velocity and direction
    this.ship.velX = exitVelX;
    this.ship.velY = exitVelY;
    this.ship.angle = exitAngle;
    return;
  }

  /** Reset game state for a new round. */
  resetGame() {
    this.ship.reset();
    this.bullets.length = 0;
    this.thrusters.length = 0;
    this.asteroids.length = 0;
    this.score = 0;
    this.shield = 3;
    this.exploding = false;
    this.explosionParticles.length = 0;
    this.powerups.length = 0;
    // reset weapon and power-up state
    this.shotInterval = CONST.BASE_SHOT_INTERVAL;
    this.bulletSpeedMin = CONST.BASE_BULLET_SPEED_MIN;
    this.bulletSpeedMax = CONST.BASE_BULLET_SPEED_MAX;
    this.bulletSize = CONST.BASE_BULLET_SIZE;
    this.bulletLife = CONST.BASE_BULLET_LIFE;
    this.activePowerup = null;
    this.powerupExpires = 0;
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

  /** Update all game objects and handle logic. */
  update(now) {
    // power-up expiration
    if (this.activePowerup && now > this.powerupExpires) {
      this.expirePowerup();
    }
    // update power-ups
    for (let i = 0; i < this.powerups.length; i++) {
      const p = this.powerups[i];
      p.update();
      if (p.life <= 0) { this.powerups.splice(i, 1); i--; continue; }
      if (dist(this.ship, p) < this.ship.r + p.r) {
        this.applyPowerup(p.type);
        this.powerups.splice(i, 1);
        i--;
      }
    }
    // input: rotation
    if (keys[CONST.KEY.LEFT]) this.ship.angle -= 3;
    if (keys[CONST.KEY.RIGHT]) this.ship.angle += 3;
    // thrust
    if (keys[CONST.KEY.UP]) {
      const ax = CONST.SHIP_ACCEL * Math.cos(degToRad(this.ship.angle));
      const ay = CONST.SHIP_ACCEL * Math.sin(degToRad(this.ship.angle));
      this.ship.velX += ax;
      this.ship.velY += ay;
      // spawn thruster particles
      for (let t = 0; t < CONST.THRUST_PARTICLES; t++) {
        const backAngle = this.ship.angle + 180;
        const offsetX = Math.cos(degToRad(backAngle)) * this.ship.r;
        const offsetY = Math.sin(degToRad(backAngle)) * this.ship.r;
        const px = this.ship.x + offsetX;
        const py = this.ship.y + offsetY;
        const angle = this.ship.angle + 180 + rand(-10, 10);
        // obtain a particle from the pool or create a new one
        this.thrusters.push(createThrusterParticle(px, py, angle));
        // cap number of particles and recycle oldest
        if (this.thrusters.length > CONST.MAX_THRUST_PARTS) {
          const old = this.thrusters.shift();
          thrusterPool.push(old);
        }
      }
    }
    // shooting
    if (keys[CONST.KEY.FIRE]) {
      if (now - this.ship.lastShot > this.shotInterval) {
        const spawnX = this.ship.x + Math.cos(degToRad(this.ship.angle)) * this.ship.r;
        const spawnY = this.ship.y + Math.sin(degToRad(this.ship.angle)) * this.ship.r;
        let proj;
        if (this.activePowerup === CONST.POWERUP_TYPES.MISSILE) {
          proj = new Missile(spawnX, spawnY, this.ship.angle, this);
        } else {
          proj = new Bullet(spawnX, spawnY, this.ship.angle, this);
        }
        audio.playLaser();
        this.bullets.push(proj);
        this.ship.lastShot = now;
      }
    }
    // update ship
    this.ship.update();
    // update bullets
    for (let i = 0; i < this.bullets.length; i++) {
      const b = this.bullets[i];
      b.update();
      if (b.lifetime <= 0) { this.bullets.splice(i, 1); i--; }
    }
    // update thrusters
    for (let i = 0; i < this.thrusters.length; i++) {
      const p = this.thrusters[i];
      p.update();
      if (p.life <= 0) {
        this.thrusters.splice(i, 1);
        thrusterPool.push(p);
        i--;
      }
    }
    // update asteroids
    this.asteroids.forEach(a => a.update());
    // collisions: ship vs asteroid
    for (let i = 0; i < this.asteroids.length; i++) {
      const a = this.asteroids[i];
      const minDist = a.size + this.ship.r * 1.5;
      if (dist(this.ship, a) < minDist) {
        audio.playShieldClang();
        // bounce ship
        const dx = this.ship.x - a.x;
        const dy = this.ship.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const nx = dx / d;
        const ny = dy / d;
        const relVX = this.ship.velX - a.velX;
        const relVY = this.ship.velY - a.velY;
        const dot = relVX * nx + relVY * ny;
        if (dot < 0) {
          const reflVX = relVX - 2 * dot * nx;
          const reflVY = relVY - 2 * dot * ny;
          this.ship.velX = reflVX + a.velX;
          this.ship.velY = reflVY + a.velY;
        }
        // split asteroid
        this.asteroids.splice(i, 1);
        if (a.size > 25) {
          for (let j = 0; j < 2; j++) {
            this.asteroids.push(new Asteroid(a.x, a.y, a.size / 2, this));
          }
        }
        this.shield--;
        if (this.shield < 0) {
          this.started = false;
          this.finalScore = this.score;
          this.startExplosion();
        }
        i--;
      }
    }
    // collisions: bullets vs asteroid
    for (let bi = 0; bi < this.bullets.length; bi++) {
      const b = this.bullets[bi];
      for (let ai = 0; ai < this.asteroids.length; ai++) {
        const a = this.asteroids[ai];
        if (dist(b, a) < a.size + b.r) {
          // destroy
          this.bullets.splice(bi, 1); bi--;
          this.asteroids.splice(ai, 1); ai--;
          // play chunk SFX with positional pan based on asteroid x and dynamic shards
          const pan = (a.x - this.W / 2) / (this.W / 2);
          audio.playChunk(pan, a.size);
          if (a.size > 25) {
            for (let j = 0; j < 2; j++) {
              this.asteroids.push(new Asteroid(a.x, a.y, a.size / 2, this));
            }
          }
          // scoring
          this.score++;
          this.scoreEl.textContent = this.score;
          // power-up drop
          if (a.size <= 25 && Math.random() < CONST.POWERUP_SPAWN_CHANCE) {
            this.spawnPowerup(a.x, a.y);
          }
          break;
        }
      }
    }
    // when all asteroids cleared, spawn a wormhole if not already
    if (this.asteroids.length === 0 && !this.wormhole && !this.exploding) {
      this.spawnWormhole();
    }
    // (galaxy background is static per sector)
    // update wormhole and check for sector transition
    if (this.wormhole) {
      this.wormhole.update();
      if (dist(this.ship, this.wormhole) < this.ship.r + this.wormhole.r) {
        this.nextLevel();
      }
    }
    // remove portal after exit delay
    if (this.portalExitExpire && now - this.portalExitExpire >= CONST.PORTAL_EXIT_DURATION) {
      this.wormhole = null;
      this.portalExitExpire = null;
    }
  }

  /** Draw all active game objects. */
  render() {
    // draw wormhole portal if present
    if (this.wormhole) this.wormhole.draw(this.ctx);
    // (galaxy background drawn earlier)
    // thrusters behind ship
    this.thrusters.forEach(p => p.draw(this.ctx));
    // ship
    this.ship.draw(this.ctx);
    // bullets & asteroids
    this.bullets.forEach(b => b.draw(this.ctx));
    this.asteroids.forEach(a => a.draw(this.ctx));
    // power-ups
    this.powerups.forEach(p => p.draw(this.ctx));
  }

  /** Main loop invoked via requestAnimationFrame. */
  loop(now) {
    // handle entry portal animation
    if (this.started && this.entryActive) {
      const elapsed = now - this.entryStartTime;
      // draw background layers
      this.updateStars();
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
      this.renderStars();
      // animate and draw entry portal
      this.entryPortal.update();
      this.entryPortal.draw(this.ctx);
      // draw ship emerging at center
      this.ship.draw(this.ctx);
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
    // only update game state and music when running and not paused
    if (this.started && !this.paused) {
      this.update(now);
      // dynamic music intensity: volume ramps with asteroid count
      const count = this.asteroids.length;
      const max = 5; // maximum asteroids per wave
      // dynamic music intensity: lower base volume for quieter mix
      const baseVol = 0.025;
      const vol = baseVol + (count / max) * baseVol;
      audio.setMusicVolume(vol);
    }
    // background: gradient + multi-layer starfield
    this.updateStars();
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
    // draw stars
    this.renderStars();
    // foreground
    if (this.started) {
      this.render();
    } else if (this.exploding) {
      // explosion with pooled particles
      const alive = [];
      for (const p of this.explosionParticles) {
        p.update();
        if (p.life > 0) alive.push(p);
        else explosionPool.push(p);
      }
      this.explosionParticles = alive;
      this.explosionParticles.forEach(p => p.draw(this.ctx));
      if (now - this.explosionStart > CONST.EXPLOSION_DURATION) {
        this.startScreenEl.innerHTML =
          `<h1>Game Over</h1>` +
          `<p>Your score: ${this.finalScore}</p>` +
          `<p>Press Enter to restart.</p>`;
        this.startScreenEl.style.display = 'flex';
        // immediately kill background music and suspend audio
        audio.stopBackgroundMusicImmediate();
        audio.suspendAudio();
        this.resetGame();
      }
    }
    requestAnimationFrame(this.loop);
  }
}
