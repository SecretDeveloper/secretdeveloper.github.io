
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
const FPS = 60;           // target frame rate (used only for comments)
const THRUST_PARTICLES = 3;           // per accelerate frame
const MAX_THRUST_PARTS = 200;         // cap particle array
const BULLET_LIFETIME = 60;
const SHIP_ACCEL = 0.1;
const SHIP_MAX_SPEED = 5;
const SHIP_FRICTION = 0.99;

function rand(min, max) { return Math.random() * (max - min) + min; }
function degToRad(d) { return d * Math.PI / 180; }
function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

/* ---------- Starfield background ---------- */
let stars = [];
const STAR_COUNT = 100;
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

/* ---------- Game Objects ---------- */
class Ship {
  constructor() {
    this.r = 15;                      // ship radius (used for collision)
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
    ctx.rotate(degToRad(this.angle + 90));

    // shiny gradient fill
    const grad = ctx.createRadialGradient(
      0, -this.r * 1.2, this.r * 0.2,
      0, -this.r * 1.2, this.r * 1.2
    );
    grad.addColorStop(0, '#fff');
    grad.addColorStop(1, '#08f');
    ctx.fillStyle = grad;

    // glow effect
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(0,150,255,0.7)';

    // draw ship shape
    ctx.beginPath();
    ctx.moveTo(0, -this.r * 1.5);
    ctx.lineTo(-this.r, this.r * 1.5);
    ctx.lineTo(this.r, this.r * 1.5);
    ctx.closePath();
    ctx.fill();

    // outline without glow
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }
}

class Bullet {
  constructor(x, y, angle) {
    this.x = x; this.y = y;
    const speed = rand(8, 12);
    this.velX = speed * Math.cos(degToRad(angle));
    this.velY = speed * Math.sin(degToRad(angle));
    this.lifetime = BULLET_LIFETIME;
    this.r = 2;
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

class Asteroid {
  constructor(x, y, size) {
    this.x = x; this.y = y;
    this.size = size || rand(20, 60);
    const speed = rand(1, 3) / this.size * 30;
    const angle = rand(0, 360);
    this.velX = speed * Math.cos(degToRad(angle));
    this.velY = speed * Math.sin(degToRad(angle));
    this.points = 7 + Math.floor(rand(0, 4));   // shape complexity
    this.color = `hsl(${rand(0, 360)},70%,60%)`;
  }
  update() {
    this.x += this.velX; this.y += this.velY;
    if (this.x < 0) this.x += W; if (this.x > W) this.x -= W;
    if (this.y < 0) this.y += H; if (this.y > H) this.y -= H;
  }
  draw() {
    // asteroid outline and fill
    ctx.strokeStyle = this.color;
    ctx.fillStyle = this.color;
    ctx.lineWidth = 2;
    const angleStep = 360 / this.points;
    ctx.beginPath();
    for (let i = 0; i <= this.points; i++) {
      const a = (i * angleStep + rand(0, 20)) * Math.PI / 180;
      const r = this.size + rand(-5, 5);
      const x = this.x + r * Math.cos(a);
      const y = this.y + r * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

/* ---------- Game State ---------- */
const game = {
  started: false,
  ship: new Ship(),
  bullets: [],
  asteroids: [],
  thrusters: [],
  score: 0,
  lives: 3
};

// HUD element: hide it until gameplay starts
const hud = document.getElementById('hud');
hud.style.display = 'none';
document.getElementById('score').textContent = game.score;
document.getElementById('lives').textContent = game.lives;

/* ---------- Helper functions ---------- */
function spawnAsteroid() {
  let x, y;
  do {
    x = rand(0, W); y = rand(0, H);
  } while (dist({ x, y }, game.ship) < 200);   // avoid spawning too close
  game.asteroids.push(new Asteroid(x, y));
}
for (let i = 0; i < 5; i++) spawnAsteroid();

function resetGame() {
  game.ship.reset();
  game.bullets.length = 0;
  game.thrusters.length = 0;
  game.asteroids.length = 0;
  game.score = 0; game.lives = 3;
  document.getElementById('score').textContent = game.score;
  document.getElementById('lives').textContent = game.lives;

  // spawn fresh asteroids for the next round
  for (let i = 0; i < 5; i++) spawnAsteroid();
}

/* ---------- Input Handling ---------- */
const keys = {};
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => delete keys[e.key]);

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
    if (now - game.ship.lastShot > 200) {
      const b = new Bullet(
        game.ship.x + Math.cos(degToRad(game.ship.angle)) * game.ship.r,
        game.ship.y + Math.sin(degToRad(game.ship.angle)) * game.ship.r,
        game.ship.angle
      );
      game.bullets.push(b);
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
  // ship vs asteroid
  for (let i = 0; i < game.asteroids.length; i++) {
    const a = game.asteroids[i];
    if (dist(game.ship, a) < a.size + game.ship.r * 1.5) {
      game.lives--;
      document.getElementById('lives').textContent = game.lives;
      // reset ship
      game.ship.reset();
      if (game.lives <= 0) {
        game.started = false;
        startScreen.innerHTML = `<h1>Game Over</h1><p>Your score: ${game.score}</p><p>Press Enter to restart.</p>`;
        startScreen.style.display = 'flex';
        // hide HUD during game-over screen
        hud.style.display = 'none';
        resetGame();          // clear everything & respawn
      }
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

        // split into smaller pieces if size is large enough
        if (a.size > 25) {
          for (let j = 0; j < 2; j++) {
            const newAst = new Asteroid(a.x, a.y, a.size / 2);
            game.asteroids.push(newAst);
          }
        }

        // score +1 per asteroid hit
        game.score++; document.getElementById('score').textContent = game.score;
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
  game.ship.draw();
  game.bullets.forEach(b => b.draw());
  game.thrusters.forEach(p => p.draw());
  game.asteroids.forEach(a => a.draw());
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
