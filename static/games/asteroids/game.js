// game.js
// Core game logic, state management, update & render loop
import { rand, degToRad, dist } from './utils.js';
import * as CONST from './constants.js';
import { keys, initInput } from './input.js';
import * as audio from './audio.js';
import { Ship } from './ship.js';
import { Bullet, Missile } from './bullet.js';
import { Asteroid } from './asteroid.js';
import { ThrusterParticle, ExplosionParticle,
         createThrusterParticle, createExplosionParticle,
         thrusterPool, explosionPool } from './particle.js';
import { Powerup } from './powerup.js';

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

    // starfield
    this.stars = [];
    this.initStars();

    // input
    initInput();
    window.addEventListener('keydown', e => {
      if (!this.started && e.key === CONST.KEY.ENTER) {
        this.startScreenEl.style.display = 'none';
        this.hudEl.style.display = 'block';
        this.started = true;
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
    this.bulletSize     = CONST.BASE_BULLET_SIZE;
    this.bulletLife     = CONST.BASE_BULLET_LIFE;
    this.shotInterval   = CONST.BASE_SHOT_INTERVAL;
    this.activePowerup  = null;
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

  /** Adjust canvas size to parent and store dimensions. */
  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.W = this.canvas.width  = rect.width;
    this.H = this.canvas.height = rect.height;
  }

  /** Create initial starfield. */
  initStars() {
    this.stars = [];
    for (let i = 0; i < CONST.STAR_COUNT; i++) {
      this.stars.push({
        x: rand(0, this.W),
        y: rand(0, this.H),
        r: rand(0.5, 1.5),
        baseAlpha: rand(0.3, 0.8),
        drift: rand(0.05, 0.2)
      });
    }
  }

  /** Update star positions for parallax effect. */
  updateStars() {
    this.stars.forEach(s => {
      const vx = this.ship.velX || 0;
      const vy = this.ship.velY || 0;
      s.x -= vx * CONST.STAR_PARALLAX;
      s.y -= vy * CONST.STAR_PARALLAX;
      s.y += s.drift;
      if (s.x < 0) s.x += this.W;
      else if (s.x > this.W) s.x -= this.W;
      if (s.y > this.H) s.y = 0;
      else if (s.y < 0) s.y = this.H;
    });
  }

  /** Draw the starfield background. */
  renderStars() {
    this.stars.forEach(s => {
      this.ctx.fillStyle = `rgba(255,255,255,${s.baseAlpha})`;
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
        this.bulletSize     = CONST.POWER_BULLET_SIZE;
        this.bulletLife     = CONST.POWER_BULLET_LIFE;
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
    this.shotInterval   = CONST.BASE_SHOT_INTERVAL;
    this.bulletSpeedMin = CONST.BASE_BULLET_SPEED_MIN;
    this.bulletSpeedMax = CONST.BASE_BULLET_SPEED_MAX;
    this.bulletSize     = CONST.BASE_BULLET_SIZE;
    this.bulletLife     = CONST.BASE_BULLET_LIFE;
    this.activePowerup  = null;
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
    this.shotInterval   = CONST.BASE_SHOT_INTERVAL;
    this.bulletSpeedMin = CONST.BASE_BULLET_SPEED_MIN;
    this.bulletSpeedMax = CONST.BASE_BULLET_SPEED_MAX;
    this.bulletSize     = CONST.BASE_BULLET_SIZE;
    this.bulletLife     = CONST.BASE_BULLET_LIFE;
    this.activePowerup  = null;
    this.powerupExpires = 0;
    this.scoreEl.textContent = this.score;
    for (let i = 0; i < 5; i++) this.spawnAsteroid();
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
    if (keys[CONST.KEY.LEFT])  this.ship.angle -= 3;
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
          audio.playChunk();
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
    // respawn if none
    if (this.asteroids.length === 0) {
      for (let i = 0; i < 5; i++) this.spawnAsteroid();
    }
  }

  /** Draw all active game objects. */
  render() {
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
    if (this.started) {
      this.update(now);
    }
    // background
    this.updateStars();
    this.ctx.clearRect(0, 0, this.W, this.H);
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
        this.resetGame();
      }
    }
    requestAnimationFrame(this.loop);
  }
}