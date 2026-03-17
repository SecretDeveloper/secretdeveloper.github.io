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
  /** Return every entity currently known to the ECS. */
  getAllEntities() {
    const entities = new Set();
    for (const compMap of this.components.values()) {
      for (const entity of compMap.keys()) entities.add(entity);
    }
    return [...entities];
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
    const enemies = this.em.query('enemy', 'position', 'collider', 'health');
    for (const b of bullets) {
      const posB = this.em.getComponent(b, 'position');
      const colB = this.em.getComponent(b, 'collider');
      const bulletData = this.em.getComponent(b, 'bullet');
      if (!posB || !colB) continue;
      if (bulletData?.owner === 'enemy') {
        for (const a of asteroids) {
          const posA = this.em.getComponent(a, 'position');
          const colA = this.em.getComponent(a, 'collider');
          if (!posA || !colA) continue;
          if (dist(posA, posB) < colA.r + colB.r) {
            this.em.removeEntity(b);
            break;
          }
        }
        continue;
      }
      let hitResolved = false;
      for (const e of enemies) {
        const posE = this.em.getComponent(e, 'position');
        const colE = this.em.getComponent(e, 'collider');
        if (!posE || !colE) continue;
        if (dist(posE, posB) >= colE.r + colB.r) continue;
        const dmgComp = this.em.getComponent(b, 'damage_delivered');
        const dmg = dmgComp?.value ?? 1;
        this.em.removeEntity(b);
        const health = this.em.getComponent(e, 'health');
        health.value -= dmg;
        if (health.value > 0) {
          this.game.triggerImpactFeedback({
            x: posE.x,
            y: posE.y,
            shake: 3.5,
            flashAlpha: 0.1,
            flashColor: '255,120,120',
            particles: 6 + dmg * 2
          });
        } else {
          const enemyData = this.em.getComponent(e, 'enemy') || {};
          this.em.removeEntity(e);
          this.game.awardScore(enemyData.scoreValue ?? 4, performance.now());
          this.game.triggerImpactFeedback({
            x: posE.x,
            y: posE.y,
            shake: 8,
            flashAlpha: 0.18,
            flashColor: '255,110,90',
            particles: 18
          });
          if (Math.random() < this.game.getPowerupSpawnChance() * 0.6) {
            this.game.spawnPowerup(posE.x, posE.y);
          }
        }
        hitResolved = true;
        break;
      }
      if (hitResolved) continue;
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
              this.game.triggerImpactFeedback({
                x: posA.x,
                y: posA.y,
                shake: 2.5,
                flashAlpha: 0.08,
                flashColor: '255,255,255',
                particles: 4 + dmg * 2
              });
              break; // asteroid survives this hit
            }
          }
          // asteroid destroyed: split and award score
          const sizeData = this.em.getComponent(a, 'asteroid') || { size: colA.r };
          const size = sizeData.size;
          const splitCount = sizeData.splitCount ?? 2;
          const variant = sizeData.variant ?? CONST.ASTEROID_VARIANTS.STANDARD;
          const scoreValue = sizeData.scoreValue ?? 1;
          const guaranteedPowerup = sizeData.guaranteedPowerup === true;
          this.em.removeEntity(a);
          if (size > 25) {
            for (let i = 0; i < splitCount; i++) {
              const fragmentVariant = variant === CONST.ASTEROID_VARIANTS.BOSS
                ? (i % 2 === 0 ? CONST.ASTEROID_VARIANTS.HEAVY : CONST.ASTEROID_VARIANTS.SWIFT)
                : (size / 2 <= 25 ? CONST.ASTEROID_VARIANTS.SWIFT : variant);
              createAsteroidEntity(this.em, this.game, posA.x, posA.y, size / 2, fragmentVariant);
            }
          }
          this.game.awardScore(scoreValue, performance.now());
          this.game.triggerImpactFeedback({
            x: posA.x,
            y: posA.y,
            shake: Math.min(14, 3 + size / 10),
            flashAlpha: Math.min(0.3, 0.08 + size / 200),
            flashColor: variant === CONST.ASTEROID_VARIANTS.BOSS ? '255,150,90' : '255,210,140',
            particles: Math.min(28, 6 + Math.round(size / 6))
          });
          const pan = (posA.x - this.game.W / 2) / (this.game.W / 2);
          audio.playChunk(pan, size);
          if (guaranteedPowerup) {
            this.game.spawnPowerup(posA.x, posA.y);
            if (Math.random() < 0.5) this.game.spawnPowerup(posA.x + 24, posA.y - 16);
          } else if (size <= 25 && Math.random() < this.game.getPowerupSpawnChance()) {
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
        if (this.game.isShipInvulnerable(now)) continue;
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
        this.game.triggerImpactFeedback({
          x: aPos.x,
          y: aPos.y,
          shake: Math.min(10, 5 + aCol.r / 10),
          flashAlpha: 0.2,
          flashColor: '255,80,80',
          particles: Math.min(20, 8 + Math.round(aCol.r / 6))
        });
        // shield handling
        if (this.game.shieldOverpowered && now < this.game.shieldOverpoweredExpiry) {
          this.game.shieldOverpoweredExpiry = now + CONST.POWERUP_DURATION;
          audio.playShieldClang();
          this.game.startShipInvulnerability(now);
        } else {
          audio.playShieldClang();
          this.game.startShipInvulnerability(now);
          this.game.shield--;
          if (this.game.shield < 0) {
            this.game.finalScore = this.game.score;
            this.game.startExplosion();
          }
        }
      }
    }
    const enemies = this.em.query('enemy', 'position', 'collider');
    for (const id of enemies) {
      const ePos = this.em.getComponent(id, 'position');
      const eCol = this.em.getComponent(id, 'collider');
      if (!ePos || !eCol) continue;
      const dx = posComp.x - ePos.x;
      const dy = posComp.y - ePos.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d >= eCol.r + shipCol.r * 1.35) continue;
      if (this.game.isShipInvulnerable(now)) continue;
      this.em.removeEntity(id);
      this.game.triggerImpactFeedback({
        x: ePos.x,
        y: ePos.y,
        shake: 9,
        flashAlpha: 0.22,
        flashColor: '255,90,90',
        particles: 18
      });
      if (this.game.shieldOverpowered && now < this.game.shieldOverpoweredExpiry) {
        this.game.shieldOverpoweredExpiry = now + CONST.POWERUP_DURATION;
        audio.playShieldClang();
        this.game.startShipInvulnerability(now);
      } else {
        audio.playShieldClang();
        this.game.startShipInvulnerability(now);
        this.game.shield--;
        if (this.game.shield < 0) {
          this.game.finalScore = this.game.score;
          this.game.startExplosion();
        }
      }
      break;
    }
    const enemyBullets = this.em.query('bullet', 'position', 'collider', 'bullet');
    for (const id of enemyBullets) {
      const bullet = this.em.getComponent(id, 'bullet');
      if (bullet?.owner !== 'enemy') continue;
      const bPos = this.em.getComponent(id, 'position');
      const bCol = this.em.getComponent(id, 'collider');
      if (!bPos || !bCol) continue;
      if (dist(posComp, bPos) >= shipCol.r + bCol.r) continue;
      if (this.game.isShipInvulnerable(now)) {
        this.em.removeEntity(id);
        continue;
      }
      this.em.removeEntity(id);
      this.game.triggerImpactFeedback({
        x: bPos.x,
        y: bPos.y,
        shake: 5,
        flashAlpha: 0.14,
        flashColor: '255,100,90',
        particles: 10
      });
      if (this.game.shieldOverpowered && now < this.game.shieldOverpoweredExpiry) {
        this.game.shieldOverpoweredExpiry = now + CONST.POWERUP_DURATION;
        audio.playShieldClang();
        this.game.startShipInvulnerability(now, 450);
      } else {
        audio.playShieldClang();
        this.game.startShipInvulnerability(now, 700);
        this.game.shield--;
        if (this.game.shield < 0) {
          this.game.finalScore = this.game.score;
          this.game.startExplosion();
        }
      }
      break;
    }
  }
}

export class EnemySystem {
  constructor(em, game) {
    this.em = em;
    this.game = game;
  }
  update(dt, now) {
    const shipId = this.game.shipEntity;
    const shipPos = this.em.getComponent(shipId, 'position');
    if (!shipPos) return;
    const enemies = this.em.query('enemy', 'position', 'velocity', 'rotation');
    const asteroids = this.em.query('asteroid', 'position', 'collider');
    for (const id of enemies) {
      const enemy = this.em.getComponent(id, 'enemy');
      const pos = this.em.getComponent(id, 'position');
      const vel = this.em.getComponent(id, 'velocity');
      const rot = this.em.getComponent(id, 'rotation');
      const dx = shipPos.x - pos.x;
      const dy = shipPos.y - pos.y;
      const d = Math.hypot(dx, dy) || 1;
      const desired = Math.atan2(dy, dx) * 180 / Math.PI;
      const orbitBias = Math.sin(now / 500 + id) * 28;
      const targetAngle = desired + (d < enemy.preferredDistance ? 150 : orbitBias);
      let delta = ((targetAngle - rot.value + 540) % 360) - 180;
      rot.value = (rot.value + Math.max(-3.2, Math.min(3.2, delta)) * dt * 0.35 + 360) % 360;
      const rad = degToRad(rot.value);
      const thrust = d > enemy.preferredDistance * 0.8 ? enemy.accel : enemy.accel * 0.35;
      vel.x += Math.cos(rad) * thrust * dt;
      vel.y += Math.sin(rad) * thrust * dt;

      for (const aid of asteroids) {
        const ap = this.em.getComponent(aid, 'position');
        const ac = this.em.getComponent(aid, 'collider');
        const adx = pos.x - ap.x;
        const ady = pos.y - ap.y;
        const ad = Math.hypot(adx, ady) || 1;
        const avoidRadius = ac.r + 58;
        if (ad < avoidRadius) {
          const repel = (1 - ad / avoidRadius) * 0.18 * dt;
          vel.x += (adx / ad) * repel;
          vel.y += (ady / ad) * repel;
        }
      }

      const speed = Math.hypot(vel.x, vel.y);
      if (speed > enemy.maxSpeed) {
        const scale = enemy.maxSpeed / speed;
        vel.x *= scale;
        vel.y *= scale;
      }
      vel.x *= 0.992;
      vel.y *= 0.992;

      if (Math.floor(now / 120) % 2 === 0) {
        const exhaustX = pos.x - Math.cos(rad) * 13;
        const exhaustY = pos.y - Math.sin(rad) * 13;
        createThrusterParticleEntity(this.em, exhaustX, exhaustY, rot.value + 180);
      }

      const fireWindow = Math.abs((((desired - rot.value + 540) % 360) - 180));
      if (d < enemy.preferredDistance * 1.5 && fireWindow < 14) {
        enemy.lastShotAt ??= now - enemy.fireInterval;
        if (now - enemy.lastShotAt >= enemy.fireInterval) {
          const muzzleX = pos.x + Math.cos(rad) * 18;
          const muzzleY = pos.y + Math.sin(rad) * 18;
          createBulletEntity(this.em, this.game, muzzleX, muzzleY, rot.value, enemy.projectileType || 'enemy', 'enemy');
          audio.playLaser('enemy');
          enemy.lastShotAt = now;
        }
      }
    }
  }
}
/**
 * PowerupSystem: rotates power-ups and expires them when lifetime runs out.
 */
export class PowerupSystem {
  constructor(em, game) {
    this.em = em;
    this.game = game;
  }
  update(dt) {
    const ents = this.em.query('powerup', 'lifetime', 'rotation', 'rotationSpeed', 'position');
    const shipId = this.game.shipEntity;
    const shipPos = this.em.getComponent(shipId, 'position');
    for (const id of ents) {
      const rot = this.em.getComponent(id, 'rotation');
      const rs = this.em.getComponent(id, 'rotationSpeed');
      const life = this.em.getComponent(id, 'lifetime');
      const pos = this.em.getComponent(id, 'position');
      rot.value += rs.value * dt;
      if (shipPos && pos) {
        const dx = shipPos.x - pos.x;
        const dy = shipPos.y - pos.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < CONST.POWERUP_ATTRACT_RADIUS) {
          const strength = 1 - d / CONST.POWERUP_ATTRACT_RADIUS;
          const snapStrength = strength * strength;
          const pull = CONST.POWERUP_ATTRACT_SPEED * dt * (1 + snapStrength * CONST.POWERUP_ATTRACT_SNAP_MULT);
          pos.x += (dx / d) * pull;
          pos.y += (dy / d) * pull;
        }
      }
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
    const enemies = this.em.query('enemy', 'position');
    const targets = [...asteroids, ...enemies];
    if (targets.length === 0) return;
    for (const mid of missiles) {
      const pos = this.em.getComponent(mid, 'position');
      const vel = this.em.getComponent(mid, 'velocity');
      const rot = this.em.getComponent(mid, 'rotation');
      // find nearest asteroid
      let best = null, bestD2 = Infinity;
      for (const aid of targets) {
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
      const exhaustX = pos.x - Math.cos(nr) * 8;
      const exhaustY = pos.y - Math.sin(nr) * 8;
      createThrusterParticleEntity(this.em, exhaustX, exhaustY, next + 180);
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
    const ships = this.em.query('ship', 'velocity', 'rotation', 'rotationSpeed', 'position');
    for (const id of ships) {
      const rot = this.em.getComponent(id, 'rotation');
      const rotationSpeed = this.em.getComponent(id, 'rotationSpeed');
      const vel = this.em.getComponent(id, 'velocity');
      const pos = this.em.getComponent(id, 'position');
      const shipComp = this.em.getComponent(id, 'ship');
      // rotate
      const turningLeft = keys[CONST.KEY.LEFT] || keys['a'] || keys['A'];
      const turningRight = keys[CONST.KEY.RIGHT] || keys['d'] || keys['D'];
      if (turningLeft && !turningRight) {
        rotationSpeed.value -= CONST.SHIP_TURN_ACCEL * dt;
      } else if (turningRight && !turningLeft) {
        rotationSpeed.value += CONST.SHIP_TURN_ACCEL * dt;
      } else {
        rotationSpeed.value *= Math.pow(CONST.SHIP_TURN_DAMPING, dt);
      }
      rotationSpeed.value = Math.max(-CONST.SHIP_MAX_TURN_SPEED, Math.min(CONST.SHIP_MAX_TURN_SPEED, rotationSpeed.value));
      // thrust
      if (keys[CONST.KEY.UP] || keys['w'] || keys['W']) {
        const rad = degToRad(rot.value);
        const currentSpeed = Math.hypot(vel.x, vel.y);
        const accelBoost = currentSpeed < CONST.SHIP_MAX_SPEED * 0.6 ? CONST.SHIP_THRUST_BOOST : 1;
        vel.x += CONST.SHIP_ACCEL * accelBoost * Math.cos(rad);
        vel.y += CONST.SHIP_ACCEL * accelBoost * Math.sin(rad);
        const boostedSpeed = Math.hypot(vel.x, vel.y);
        if (boostedSpeed > CONST.SHIP_MAX_SPEED) {
          const scale = CONST.SHIP_MAX_SPEED / boostedSpeed;
          vel.x *= scale;
          vel.y *= scale;
        }
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
      } else {
        const speed = Math.hypot(vel.x, vel.y);
        if (speed > CONST.SHIP_MAX_SPEED) {
          const scale = CONST.SHIP_MAX_SPEED / speed;
          vel.x *= scale;
          vel.y *= scale;
        }
      }
      // shooting
      if (keys[CONST.KEY.FIRE] && now - this.game.lastShot > this.game.shotInterval) {
        const rad2 = degToRad(rot.value);
        const spawnX = pos.x + Math.cos(rad2) * shipComp.r;
        const spawnY = pos.y + Math.sin(rad2) * shipComp.r;
        const g = this.game;
        let fireType = 'default';
        let fired = false;
        // Missiles
        if (g.activePowerup === CONST.POWERUP_TYPES.MISSILE && (g.ammo[CONST.POWERUP_TYPES.MISSILE] || 0) > 0) {
          createMissileEntity(this.em, g, spawnX, spawnY, rot.value);
          g.ammo[CONST.POWERUP_TYPES.MISSILE]--;
          fireType = 'missile';
          vel.x -= Math.cos(rad2) * 0.12;
          vel.y -= Math.sin(rad2) * 0.12;
          fired = true;
        }
        // Machine gun
        else if (g.activePowerup === CONST.POWERUP_TYPES.MACHINE && (g.ammo[CONST.POWERUP_TYPES.MACHINE] || 0) > 0) {
          createBulletEntity(this.em, g, spawnX, spawnY, rot.value + (Math.random() * 6 - 3), 'machine');
          g.ammo[CONST.POWERUP_TYPES.MACHINE]--;
          fireType = 'machine';
          vel.x -= Math.cos(rad2) * 0.03;
          vel.y -= Math.sin(rad2) * 0.03;
          fired = true;
        }
        // Power shot
        else if (g.activePowerup === CONST.POWERUP_TYPES.POWER && (g.ammo[CONST.POWERUP_TYPES.POWER] || 0) > 0) {
          createBulletEntity(this.em, g, spawnX, spawnY, rot.value, 'power');
          g.ammo[CONST.POWERUP_TYPES.POWER]--;
          fireType = 'power';
          vel.x -= Math.cos(rad2) * 0.18;
          vel.y -= Math.sin(rad2) * 0.18;
          fired = true;
        }
        // Default bullet
        else {
          createBulletEntity(this.em, g, spawnX, spawnY, rot.value, 'default');
          vel.x -= Math.cos(rad2) * 0.05;
          vel.y -= Math.sin(rad2) * 0.05;
          fired = true;
        }

        if (fired) {
          audio.playLaser(fireType);
          g.lastShot = now;
          // If current weapon ran out, auto-switch or revert
          if (g.activePowerup && (g.ammo[g.activePowerup] || 0) <= 0) {
            const ammoTypes = [
              CONST.POWERUP_TYPES.MISSILE,
              CONST.POWERUP_TYPES.MACHINE,
              CONST.POWERUP_TYPES.POWER
            ];
            const nextType = ammoTypes.find(t => (g.ammo[t] || 0) > 0);
            g.activePowerup = nextType || null;
            g.syncWeaponStats();
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
