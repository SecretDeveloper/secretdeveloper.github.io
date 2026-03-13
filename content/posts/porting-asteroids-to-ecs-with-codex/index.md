+++
date = "2025-10-01T12:00:00+00:00"
title = "Porting Asteroids to an ECS with Codex"
description = "How I used Codex to migrate a classic Asteroids implementation to a data‑driven Entity‑Component‑System architecture"
categories = ["software", "games", "ecs", "codex"]
tags = ["javascript", "canvas", "game-dev", "refactor"]
+++

Quick version: I rewired my [Asteroids](/games/asteroids/) clone from a pile of classes to an Entity‑Component‑System (ECS). Codex (the CLI agent) did the heavy lifting while I poked, prodded, and occasionally muttered at my screen. The end result is cleaner, easier to extend, and less brittle when I add toys like missiles and sparkly shields.

Why bother with ECS?

- I was done fighting class hierarchies. I just want to slap “has a shield,” “spins,” or “is a missile” onto things without negotiating with a base class.
- Data is data, behavior is behavior. Components hold state; systems do the work over sets of components. 
- (maybe) Performance as a side effect: tight loops over similar data are fast, but honestly the clarity is what sold me.
- New features become “add a component, tweak a system,” not surgery across five files.

Where I started (a.k.a. the creaky bits)

I had `Ship`, `Asteroid`, `Bullet` classes drawing themselves straight to Canvas. It worked… until I bolted on shields, power‑ups, particles, and a galaxy background. Then transforms got duplicated, rotations disagreed about radians vs degrees, and adding one feature broke three others. Classic.

ECS pieces I ended up with

- Tiny `EntityManager`/`SystemManager` to attach components and run systems.
- Systems for input, movement, friction, rotation, lifetime, collisions, power‑ups (spin + pickup), particles, render, plus a new homing missile system.
- Registered in one place so the update/render order is easy to reason about (see `static/games/asteroids/game.js:76`).

Refactor highlights

- One transform pipeline: `RenderSystem` handles `translate/rotate`; draw functions stay in local space. The ship sprite no longer drifts away from its thrusters like a lost balloon.
- Standardized rotation to degrees in components; convert to radians at the boundary. No more guessing which flavor a function wanted.
- Moved shield visuals into the ship’s ECS renderable. Overpowered mode pulses nicely; normal shield shows a color‑coded ring.
- Firing got smarter: bullets by default, machine gun/power/missile when those power‑ups are active. Ammo ticks down; it auto‑reverts when you’re empty.
- Missiles got their own factory and a tiny `MissileSystem` to steer toward the nearest rock. Surprisingly fun.
- Brought back the old light trail (white to blue fade) behind the ship. It’s subtle and makes flying feel snappier.

Small design tweaks while I was there

- Bullets and power‑ups hang around 2× longer. It fits the pace better.
- Projectiles have `damage_delivered`; asteroids have level‑scaled `health` (small/medium/large ≈ 1/2/3 base shots, +20% per level). The collision system applies damage, splits big rocks, and keeps the score moving.

Things that bit me (and how ECS helped)

- Double transforms. Ship code rotated, RenderSystem rotated, and the ship promptly wandered off. With ECS, there’s exactly one place that decides world transforms.
- Unit soup. Some code used radians, some degrees. I picked degrees for components and stuck to it.
- Ghost code. Old `ship.js`/`powerup.js` were still drawing stuff no one called anymore. Deleting them felt great.

RenderSystem in a nutshell

```js
// ecs.js
render(ctx) {
  const ents = this.em.query('renderable', 'position', 'rotation');
  for (const id of ents) {
    const rend = this.em.getComponent(id, 'renderable');
    const pos = this.em.getComponent(id, 'position');
    const rot = this.em.getComponent(id, 'rotation');
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(degToRad(rot.value)); // degrees in components
    rend.draw(ctx);                   // local-space drawing only
    ctx.restore();
  }
}
```

Firing with power‑ups (shape of it)

```js
// ecs.js (InputSystem)
if (keys[KEY.FIRE] && now - game.lastShot > game.shotInterval) {
  const spawnX = pos.x + Math.cos(rad) * ship.r;
  const spawnY = pos.y + Math.sin(rad) * ship.r;
  if (game.activePowerup === POWERUP_TYPES.MISSILE && game.ammo.MISSILE > 0) {
    createMissileEntity(em, game, spawnX, spawnY, rot.value);
    game.ammo.MISSILE--;
  } else {
    createBulletEntity(em, game, spawnX, spawnY, rot.value);
    // machine/power decrement handled similarly
  }
  game.lastShot = now;
}
```

So, how did it end up?

- Adding missiles was a quick win: one factory + one system. No invasive rewrites.
- Rendering bugs dropped off once transforms were centralized.
- Tuning is faster: lifetimes, damage, and health live in single, obvious places.

Give it a try: [Asteroids](/games/asteroids/)
