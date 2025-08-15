// particleFactory.js
// Wraps existing particle pools into ECS entities
import { createThrusterParticle, thrusterPool, createExplosionParticle, explosionPool } from './particle.js';
/**
 * Create a thruster particle entity in ECS.
 * @param {EntityManager} em
 * @param {number} x
 * @param {number} y
 * @param {number} angle degrees
 * @returns {number} entity id
 */
export function createThrusterParticleEntity(em, x, y, angle) {
  const particle = createThrusterParticle(x, y, angle);
  const id = em.createEntity();
  em.addComponent(id, 'particle', particle);
  // tag type so system can return to correct pool
  em.addComponent(id, 'particleType', { type: 'thruster' });
  return id;
}
/**
 * Create an explosion particle entity in ECS.
 * @param {EntityManager} em
 * @param {number} x
 * @param {number} y
 * @returns {number} entity id
 */
export function createExplosionParticleEntity(em, x, y) {
  const particle = createExplosionParticle(x, y);
  const id = em.createEntity();
  em.addComponent(id, 'particle', particle);
  em.addComponent(id, 'particleType', { type: 'explosion' });
  return id;
}