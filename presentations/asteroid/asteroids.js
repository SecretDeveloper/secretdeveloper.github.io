/* ---------- Canvas & Resize ---------- */
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H;
function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

/* ---------- Utilities ---------- */
function rand(min, max) { return Math.random() * (max - min) + min; }
function degToRad(d) { return d * Math.PI / 180; }
function dist(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.hypot(dx, dy);
}

/* ---------- Particle system for thruster ---------- */
class ThrusterParticle {
    constructor(x, y, angle) {
        this.x = x; this.y = y;
        const speed = rand(0.5, 1.5);
        this.velX = speed * Math.cos(degToRad(angle));
        this.velY = speed * Math.sin(degToRad(angle));
        this.life = 30;   // frames
        this.size = 2 + rand(-1, 1);
    }
    update() {
        this.x += this.velX;
        this.y += this.velY;
        this.life--;
    }
    draw() {
        ctx.fillStyle = `rgba(255,255,255,${Math.max(this.life / 30, 0)})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

/* ---------- Game Objects ---------- */
class Ship {
    constructor() {
        this.x = W / 2; this.y = H / 2;
        this.r = 15;
        this.angle = 0;      // facing up (deg)
        this.velX = 0; this.velY = 0;
        this.accel = 0.1;
        this.maxSpeed = 5;
        this.friction = 0.99;
    }
    update() {
        // move
        this.x += this.velX;
        this.y += this.velY;

        // wrap screen edges
        if (this.x < 0) this.x += W; if (this.x > W) this.x -= W;
        if (this.y < 0) this.y += H; if (this.y > H) this.y -= H;

        // friction
        this.velX *= this.friction;
        this.velY *= this.friction;
    }
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(degToRad(this.angle + 90));
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        // triangle ship – points upward
        ctx.moveTo(0, -this.r * 1.5);
        ctx.lineTo(-this.r, this.r * 1.5);
        ctx.lineTo(this.r, this.r * 1.5);
        ctx.closePath();

        /* ----- style the triangle ----- */
        ctx.fillStyle = '#fff';               // solid white (or any color)
        ctx.strokeStyle = '#000';               // optional outline
        ctx.lineWidth = 2;
        ctx.fill();      // <‑‑ fills the interior

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
        this.lifetime = 60; // frames
        this.r = 2;
    }
    update() {
        this.x += this.velX;
        this.y += this.velY;
        this.lifetime--;
        if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.lifetime = 0;
    }
    draw() {
        ctx.fillStyle = '#ff0';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Asteroid {
    constructor(x, y, size) {
        this.x = x; this.y = y;
        this.size = size || rand(20, 60); // radius
        const speed = rand(1, 3) / this.size * 30;
        const angle = rand(0, 360);
        this.velX = speed * Math.cos(degToRad(angle));
        this.velY = speed * Math.sin(degToRad(angle));
        this.points = 7 + Math.floor(rand(0, 4)); // shape complexity
        this.color = `hsl(${rand(0, 360)},70%,60%)`;   // random hue
    }
    update() {
        this.x += this.velX;
        this.y += this.velY;

        if (this.x < 0) this.x += W; if (this.x > W) this.x -= W;
        if (this.y < 0) this.y += H; if (this.y > H) this.y -= H;
    }
    draw() {
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        const angleStep = 360 / this.points;
        ctx.beginPath();
        for (let i = 0; i <= this.points; i++) {
            const a = (i * angleStep + rand(0, 20)) * Math.PI / 180;
            const r = this.size + rand(-5, 5);
            const x = this.x + r * Math.cos(a);
            const y = this.y + r * Math.sin(a);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
}

/* ---------- Game State ---------- */
let ship = new Ship();
const bullets = [];
const asteroids = [];
const thrusters = [];   // particles
let score = 0, lives = 3;
document.getElementById('score').textContent = score;
document.getElementById('lives').textContent = lives;

/* Spawn initial asteroids */
function spawnAsteroid() {
    let x, y;
    do {
        x = rand(0, W);
        y = rand(0, H);
    } while (dist({ x, y }, ship) < 200); // avoid spawning too close
    asteroids.push(new Asteroid(x, y));
}
for (let i = 0; i < 5; i++) spawnAsteroid();

/* ---------- Input Handling ---------- */
const keys = {};
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => delete keys[e.key]);

/* ---------- Start screen handling ---------- */
let gameStarted = false;
const startScreen = document.getElementById('startScreen');
window.addEventListener('keydown', e => {
    if (!gameStarted && e.key === 'Enter') {
        startScreen.style.display = 'none';
        gameStarted = true;
    }
});

/* ---------- Game Loop ---------- */
function loop() {
    // only update after the game has started
    console.log('Game loop running...');
    if (gameStarted) {
        /* ----- Input ----- */
        if (keys['ArrowLeft']) ship.angle -= 3;
        if (keys['ArrowRight']) ship.angle += 3;

        if (keys['ArrowUp']) {
            const ax = ship.accel * Math.cos(degToRad(ship.angle));
            const ay = ship.accel * Math.sin(degToRad(ship.angle));
            ship.velX += ax;
            ship.velY += ay;
            // add thruster particles
            for (let i = 0; i < 3; i++) {
                const backAngle = ship.angle + 180;                     // opposite direction
                const offsetX = Math.cos(degToRad(backAngle)) * ship.r;
                const offsetY = Math.sin(degToRad(backAngle)) * ship.r;

                const px = ship.x + offsetX;
                const py = ship.y + offsetY;

                const angle = ship.angle + 180 + rand(-10, 10);          // particle still points backwards
                thrusters.push(new ThrusterParticle(px, py, angle));
            }
        }

        if (keys[' ']) { // space fires bullet
            if (!ship.lastShot || Date.now() - ship.lastShot > 200) {
                const b = new Bullet(
                    ship.x + Math.cos(degToRad(ship.angle)) * ship.r,
                    ship.y + Math.sin(degToRad(ship.angle)) * ship.r,
                    ship.angle
                );
                bullets.push(b);
                ship.lastShot = Date.now();
            }
        }

        /* ----- Update ----- */
        ship.update();

        bullets.forEach((b, i) => {
            b.update();
            if (b.lifetime <= 0) bullets.splice(i, 1);
        });

        thrusters.forEach((p, i) => {
            p.update();
            if (p.life <= 0) thrusters.splice(i, 1);
        });

        asteroids.forEach(a => a.update());

        /* ----- Collision detection ----- */
        // ship vs asteroid
        for (let i = 0; i < asteroids.length; i++) {
            const a = asteroids[i];
            if (dist(ship, a) < a.size + ship.r * 1.5) {
                lives--;
                document.getElementById('lives').textContent = lives;
                // reset ship
                ship.x = W / 2; ship.y = H / 2;
                ship.velX = 0; ship.velY = 0;
                if (lives <= 0) {
                    gameStarted = false;
                    startScreen.innerHTML = `<h1>Game Over</h1><p>Your score: ${score}</p><p>Press Enter to restart.</p>`;
                    startScreen.style.display = 'flex';
                    // reset everything
                    bullets.length = 0;
                    /* ---------- Game Over handling (continued) ---------- */
                    // reset everything when lives run out
                    bullets.length = 0;
                    asteroids.length = 0;
                    score = 0;
                    document.getElementById('score').textContent = score;
                    document.getElementById('lives').textContent = lives;

                    // spawn fresh asteroids for the next round
                    for (let i = 0; i < 5; i++) spawnAsteroid();
                }
            }

            // ship vs bullet collision
            bullets.forEach((b, bi) => {
                for (let ai = 0; ai < asteroids.length; ai++) {
                    const a = asteroids[ai];
                    if (dist(b, a) < a.size + b.r) {
                        // destroy asteroid & bullet
                        bullets.splice(bi, 1);
                        asteroids.splice(ai, 1);

                        // split into smaller pieces if size is large enough
                        if (a.size > 25) {
                            for (let j = 0; j < 2; j++) {
                                const newAst = new Asteroid(a.x, a.y, a.size / 2);
                                asteroids.push(newAst);
                            }
                        }

                        // score +1 per asteroid hit
                        score += 1;
                        document.getElementById('score').textContent = score;

                        // make sure we don’t continue iterating over a removed bullet/asteroid
                        break;
                    }
                }
            });
        }
        /* ----- Render ----- */
        ctx.clearRect(0, 0, W, H);

        ship.draw();
        bullets.forEach(b => b.draw());
        thrusters.forEach(p => p.draw());
        asteroids.forEach(a => a.draw());

        // request next frame
    }
    requestAnimationFrame(loop);
}
/* ---------- Start the loop ---------- */
loop();

/* ---------- Utility: keep spawning new asteroids when all are cleared ---------- */
function checkAsteroidCount() {
    if (asteroids.length === 0) {
        for (let i = 0; i < 5; i++) spawnAsteroid();
    }
}

/* ---------- Call the counter every frame ---------- */
setInterval(checkAsteroidCount, 1000);

