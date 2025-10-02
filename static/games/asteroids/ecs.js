// ecs.js
// Simple ECS core with basic systems for movement and rendering
import { degToRad, dist } from './utils.js';
import * as CONST from './constants.js';
import { createAsteroidEntity } from './asteroidFactory.js';
import * as audio from './audio.js';
import { keys } from './input.js';
import { createBulletEntity } from './bulletFactory.js';
import { createMissileEntity } from './missileFactory.js';
import { createPowerupEntity } from './powerupFactory.js';
import { createThrusterParticleEntity, createExplosionParticleEntity } from './particleFactory.js';
import { thrusterPool, explosionPool } from './particle.js';

/**
 * Manages entities and their components.
 */
export class EntityManager {
  constructor() {
    this.nextId = 1;
    this.components = new Map(); // componentName -> Map(entityId -> data)
  }
  createEntity() {
    return this.nextId++;
  }
  addComponent(entity, name, data) {
    if (!this.components.has(name)) this.components.set(name, new Map());
    this.components.get(name).set(entity, data);
  }
  removeComponent(entity, name) {
    this.components.get(name)?.delete(entity);
  }
  /** Remove all components for an entity, effectively deleting it. */
  removeEntity(entity) {
    for (const compMap of this.components.values()) {
      compMap.delete(entity);
    }
  }
  getComponent(entity, name) {
    return this.components.get(name)?.get(entity);
  }
  /** Return entities having all specified components */
  query(...names) {
    if (names.length === 0) return [];
    const [first, ...rest] = names;
    const base = this.components.get(first);
    if (!base) return [];
    const result = [];
    for (const entity of base.keys()) {
      let ok = true;
      for (const n of rest) {
        const comp = this.components.get(n);
        if (!comp || !comp.has(entity)) { ok = false; break; }
      }
      if (ok) result.push(entity);
    }
    return result;
  }
}
/**
 * Runs all registered systems in update and render phases.
 */
export class SystemManager {
  constructor(entityManager) {
    this.em = entityManager;
    this.systems = [];
  }
  addSystem(sys) { this.systems.push(sys); }
  update(dt, now) {
    // normalize delta to 'frames' based on target FPS
    const delta = dt * CONST.FPS / 1000;
    for (const s of this.systems) {
      if (typeof s.update === 'function') {
        // systems interpret first arg as frame-count delta
        s.update(delta, now);
      }
    }
  }
  render(ctx) {
    for (const s of this.systems) {
      if (typeof s.render === 'function') s.render(ctx);
    }
  }
}

/**
 * RotationSystem: updates rotation based on rotationSpeed.
 */
export class RotationSystem {
  constructor(em) {
    this.em = em;
  }
  update(dt) {
    const ents = this.em.query('rotation', 'rotationSpeed');
    for (const id of ents) {
      const rot = this.em.getComponent(id, 'rotation');
      const rs = this.em.getComponent(id, 'rotationSpeed');
      rot.value = (rot.value + rs.value * dt + 360) % 360;
    }
  }
}
/**
 * FrictionSystem: applies friction to all entities with ship tag and velocity.
 */
export class FrictionSystem {
  constructor(em) {
    this.em = em;
  }
  update(dt) {
    const ships = this.em.query('ship', 'velocity');
    for (const id of ships) {
      const vel = this.em.getComponent(id, 'velocity');
      // apply ship friction
      vel.x *= CONST.SHIP_FRICTION;
      vel.y *= CONST.SHIP_FRICTION;
    }
  }
}

/**
 * LifetimeSystem: decrements lifetime and removes expired entities.
 */
export class LifetimeSystem {
  constructor(em) {
    this.em = em;
  }
  update(dt) {
    const ents = this.em.query('lifetime');
    for (const id of ents) {
      const life = this.em.getComponent(id, 'lifetime');
      life.value -= dt;
      if (life.value <= 0) {
        this.em.removeEntity(id);
      }
    }
  }
}
/**
 * CollisionSystem: handles bullet↔asteroid collisions, spawning fragments, power-ups, playing SFX, scoring
 */
export class CollisionSystem {
  constructor(em, game) {
    this.em = em;
    this.game = game;
  }
  update() {
    const bullets = this.em.query('bullet', 'position', 'collider');
    const asteroids = this.em.query('asteroid', 'position', 'collider');
    for (const b of bullets) {
      const posB = this.em.getComponent(b, 'position');
      const colB = this.em.getComponent(b, 'collider');
      if (!posB || !colB) continue;
      for (const a of asteroids) {
        const posA = this.em.getComponent(a, 'position');
        const colA = this.em.getComponent(a, 'collider');
        if (!posA || !colA) continue;
        const d = dist(posA, posB);
        if (d < colA.r + colB.r) {
          // on hit: apply projectile damage, always remove the projectile
          const dmgComp = this.em.getComponent(b, 'damage_delivered');
          const dmg = dmgComp?.value ?? 1;
          this.em.removeEntity(b);
          const health = this.em.getComponent(a, 'health');
          if (health) {
            health.value -= dmg;
            if (health.value > 0) {
              break; // asteroid survives this hit
            }
          }
          // asteroid destroyed: split and award score
          const sizeData = this.em.getComponent(a, 'asteroid') || { size: colA.r };
          const size = sizeData.size;
          this.em.removeEntity(a);
          if (size > 25) {
            for (let i = 0; i < 2; i++) {
              createAsteroidEntity(this.em, this.game, posA.x, posA.y, size / 2);
            }
          }
          this.game.score++;
          this.game.scoreEl.textContent = this.game.score;
          const pan = (posA.x - this.game.W / 2) / (this.game.W / 2);
          audio.playChunk(pan, size);
          if (size <= 25 && Math.random() < CONST.POWERUP_SPAWN_CHANCE) {
            this.game.spawnPowerup(posA.x, posA.y);
          }
          break;
        }
      }
    }
  }
}
/**
 * ShipCollisionSystem: handles ship vs asteroid collisions and shield logic.
 */
export class ShipCollisionSystem {
  constructor(em, game) {
    this.em = em;
    this.game = game;
  }
  update(dt, now) {
    // get ECS ship entity and its components
    const shipId = this.game.shipEntity;
    const posComp = this.em.getComponent(shipId, 'position');
    const velComp = this.em.getComponent(shipId, 'velocity');
    // ship collider contains radius
    const shipCol = this.em.getComponent(shipId, 'collider');
    if (!posComp || !velComp || !shipCol) return;
    // iterate asteroids
    const ents = this.em.query('asteroid', 'position', 'collider');
    for (const id of ents) {
      const aPos = this.em.getComponent(id, 'position');
      const aCol = this.em.getComponent(id, 'collider');
      if (!aPos || !aCol) continue;
      const dx = posComp.x - aPos.x;
      const dy = posComp.y - aPos.y;
      const d = Math.hypot(dx, dy) || 1;
      // minimum collision distance: asteroid radius + ship radius * 1.5
      const minDist = aCol.r + shipCol.r * 1.5;
      if (d < minDist) {
        // bounce ship off asteroid
        const nx = dx / d;
        const ny = dy / d;
        const dot = velComp.x * nx + velComp.y * ny;
        if (dot < 0) {
          velComp.x -= 2 * dot * nx;
          velComp.y -= 2 * dot * ny;
        }
        // remove asteroid
        this.em.removeEntity(id);
        // shield handling
        if (this.game.shieldOverpowered && now < this.game.shieldOverpoweredExpiry) {
          this.game.shieldOverpoweredExpiry = now + CONST.POWERUP_DURATION;
        } else {
          this.game.shield--;
          if (this.game.shield < 0) {
            this.game.started = false;
            this.game.finalScore = this.game.score;
            this.game.startExplosion();
          }
        }
      }
    }
  }
}
/**
 * PowerupSystem: rotates power-ups and expires them when lifetime runs out.
 */
export class PowerupSystem {
  constructor(em) {
    this.em = em;
  }
  update(dt) {
    const ents = this.em.query('powerup', 'lifetime', 'rotation', 'rotationSpeed');
    for (const id of ents) {
      const rot = this.em.getComponent(id, 'rotation');
      const rs = this.em.getComponent(id, 'rotationSpeed');
      const life = this.em.getComponent(id, 'lifetime');
      rot.value += rs.value * dt;
      life.value -= dt;
      if (life.value <= 0) {
        this.em.removeEntity(id);
      }
    }
  }
}
/**
 * PowerupPickupSystem: detects ship↔powerup collisions and applies effects.
 */
export class PowerupPickupSystem {
  constructor(em, game) {
    this.em = em;
    this.game = game;
  }
  update() {
    const ships = this.em.query('ship', 'position', 'collider');
    const pows = this.em.query('powerup', 'position', 'collider', 'powerup');
    for (const sid of ships) {
      const spos = this.em.getComponent(sid, 'position');
      const sc = this.em.getComponent(sid, 'collider');
      for (const pid of pows) {
        const ppos = this.em.getComponent(pid, 'position');
        const pc = this.em.getComponent(pid, 'collider');
        const d = dist(spos, ppos);
        if (d < sc.r + pc.r) {
          const pData = this.em.getComponent(pid, 'powerup');
          this.game.applyPowerup(pData.type);
          this.em.removeEntity(pid);
        }
      }
    }
  }
}
/**
 * ParticleSystem: updates and renders thruster & explosion particles.
 */
export class ParticleSystem {
  constructor(em) {
    this.em = em;
  }
  update(dt) {
    const ents = this.em.query('particle', 'particleType');
    for (const id of ents) {
      const p = this.em.getComponent(id, 'particle');
      p.update();
      if (p.life <= 0) {
        const type = this.em.getComponent(id, 'particleType').type;
        if (type === 'thruster') thrusterPool.push(p);
        else if (type === 'explosion') explosionPool.push(p);
        this.em.removeEntity(id);
      }
    }
  }
  render(ctx) {
    const ents = this.em.query('particle');
    for (const id of ents) {
      const p = this.em.getComponent(id, 'particle');
      p.draw(ctx);
    }
  }
}

/** MissileSystem: steer missiles toward nearest asteroid. */
export class MissileSystem {
  constructor(em) {
    this.em = em;
    this.turnRate = 4; // degrees per frame
  }
  update(dt) {
    const missiles = this.em.query('missile', 'position', 'velocity', 'rotation');
    if (missiles.length === 0) return;
    const asteroids = this.em.query('asteroid', 'position');
    if (asteroids.length === 0) return;
    for (const mid of missiles) {
      const pos = this.em.getComponent(mid, 'position');
      const vel = this.em.getComponent(mid, 'velocity');
      const rot = this.em.getComponent(mid, 'rotation');
      // find nearest asteroid
      let best = null, bestD2 = Infinity;
      for (const aid of asteroids) {
        const ap = this.em.getComponent(aid, 'position');
        const dx = ap.x - pos.x, dy = ap.y - pos.y;
        const d2 = dx*dx + dy*dy;
        if (d2 < bestD2) { bestD2 = d2; best = ap; }
      }
      if (!best) continue;
      // current and target angles
      const cur = rot.value;
      const target = Math.atan2(best.y - pos.y, best.x - pos.x) * 180 / Math.PI;
      // shortest angle delta
      let delta = ((target - cur + 540) % 360) - 180;
      // clamp turn
      const step = Math.max(-this.turnRate, Math.min(this.turnRate, delta));
      const next = (cur + step + 360) % 360;
      rot.value = next;
      // keep speed magnitude, rotate velocity toward heading
      const speed = Math.hypot(vel.x, vel.y);
      const nr = next * Math.PI / 180;
      vel.x = Math.cos(nr) * speed;
      vel.y = Math.sin(nr) * speed;
    }
  }
}

/** MovementSystem: updates position based on velocity and wraps edges. */
export class MovementSystem {
  constructor(em, game) {
    this.em = em;
    this.game = game;
  }
  update(dt) {
    const ents = this.em.query('position', 'velocity');
    for (const id of ents) {
      const pos = this.em.getComponent(id, 'position');
      const vel = this.em.getComponent(id, 'velocity');
      pos.x += vel.x * dt;
      pos.y += vel.y * dt;
      // wrap
      if (pos.x < 0) pos.x += this.game.W;
      else if (pos.x > this.game.W) pos.x -= this.game.W;
      if (pos.y < 0) pos.y += this.game.H;
      else if (pos.y > this.game.H) pos.y -= this.game.H;
    }
  }
}

/** RenderSystem: draws entities with a renderable component. */
export class RenderSystem {
  constructor(em) {
    this.em = em;
  }
  render(ctx) {
    const ents = this.em.query('renderable', 'position', 'rotation');
    for (const id of ents) {
      const rend = this.em.getComponent(id, 'renderable');
      const pos = this.em.getComponent(id, 'position');
      const rot = this.em.getComponent(id, 'rotation');
      ctx.save();
      ctx.translate(pos.x, pos.y);
      // rotation component stores degrees
      ctx.rotate(degToRad(rot.value));
      rend.draw(ctx);
      ctx.restore();
      ctx.filter = 'none';
    }
  }
}

/**
 * InputSystem: applies user input to ship entities (rotation & thrust)
 */
export class InputSystem {
  constructor(em, game) {
    this.em = em;
    this.game = game;
  }
  /** @param {number} dt delta time in ms, @param {number} now timestamp */
  update(dt, now) {
    const ships = this.em.query('ship', 'velocity', 'rotation', 'position');
    for (const id of ships) {
      const rot = this.em.getComponent(id, 'rotation');
      const vel = this.em.getComponent(id, 'velocity');
      const pos = this.em.getComponent(id, 'position');
      const shipComp = this.em.getComponent(id, 'ship');
      // rotate
      if (keys[CONST.KEY.LEFT] || keys['a'] || keys['A']) rot.value -= 3;
      if (keys[CONST.KEY.RIGHT] || keys['d'] || keys['D']) rot.value += 3;
      // thrust
      if (keys[CONST.KEY.UP] || keys['w'] || keys['W']) {
        const rad = degToRad(rot.value);
        vel.x += CONST.SHIP_ACCEL * Math.cos(rad);
        vel.y += CONST.SHIP_ACCEL * Math.sin(rad);
        // spawn thruster particle at rear of ship
        const pos = this.em.getComponent(id, 'position');
        const shipComp = this.em.getComponent(id, 'ship');
        const px = pos.x - Math.cos(rad) * shipComp.r;
        const py = pos.y - Math.sin(rad) * shipComp.r;
        // create thruster effect
        createThrusterParticleEntity(this.em, px, py, rot.value + 180);
        // record trail position with timestamp for light trail effect
        if (this.game.shipTrail) {
          this.game.shipTrail.push({ x: px, y: py, t: now });
        }
      }
      // shooting
      if (keys[CONST.KEY.FIRE] && now - this.game.lastShot > this.game.shotInterval) {
        const rad2 = degToRad(rot.value);
        const spawnX = pos.x + Math.cos(rad2) * shipComp.r;
        const spawnY = pos.y + Math.sin(rad2) * shipComp.r;
        const g = this.game;
        let fired = false;
        // Missiles
        if (g.activePowerup === CONST.POWERUP_TYPES.MISSILE && (g.ammo[CONST.POWERUP_TYPES.MISSILE] || 0) > 0) {
          createMissileEntity(this.em, g, spawnX, spawnY, rot.value);
          g.ammo[CONST.POWERUP_TYPES.MISSILE]--;
          fired = true;
        }
        // Machine gun
        else if (g.activePowerup === CONST.POWERUP_TYPES.MACHINE && (g.ammo[CONST.POWERUP_TYPES.MACHINE] || 0) > 0) {
          createBulletEntity(this.em, g, spawnX, spawnY, rot.value);
          g.ammo[CONST.POWERUP_TYPES.MACHINE]--;
          fired = true;
        }
        // Power shot
        else if (g.activePowerup === CONST.POWERUP_TYPES.POWER && (g.ammo[CONST.POWERUP_TYPES.POWER] || 0) > 0) {
          createBulletEntity(this.em, g, spawnX, spawnY, rot.value);
          g.ammo[CONST.POWERUP_TYPES.POWER]--;
          fired = true;
        }
        // Default bullet
        else {
          createBulletEntity(this.em, g, spawnX, spawnY, rot.value);
          fired = true;
        }

        if (fired) {
          audio.playLaser();
          g.lastShot = now;
          // If current weapon ran out, auto-switch or revert
          if (g.activePowerup && (g.ammo[g.activePowerup] || 0) <= 0) {
            const ammoTypes = [
              CONST.POWERUP_TYPES.MISSILE,
              CONST.POWERUP_TYPES.MACHINE,
              CONST.POWERUP_TYPES.POWER
            ];
            const nextType = ammoTypes.find(t => (g.ammo[t] || 0) > 0);
            g.restoreBaseWeapon();
            g.activePowerup = nextType || null;
            if (g.activePowerup === CONST.POWERUP_TYPES.MACHINE) {
              g.shotInterval = CONST.MACHINE_GUN_INTERVAL;
            } else if (g.activePowerup === CONST.POWERUP_TYPES.POWER) {
              g.bulletSpeedMin = CONST.POWER_BULLET_SPEED_MIN;
              g.bulletSpeedMax = CONST.POWER_BULLET_SPEED_MAX;
              g.bulletSize = CONST.POWER_BULLET_SIZE;
            }
          }
        }
      }
    }
  }
}
/**
 * StarfieldSystem: bridges the Starfield class into ECS update/render
 */
export class StarfieldSystem {
  constructor(starfield) {
    this.starfield = starfield;
  }
  update() {
    this.starfield.update();
  }
  render(ctx) {
    this.starfield.draw(ctx);
  }
}
