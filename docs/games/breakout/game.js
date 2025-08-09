/* ──────────────────────────────────────── */
/* Breakout / Arkanoid – Vanilla JS (fixed)
 * Author: Gary Kenneally | 2025
 * ----------------------------------------------------- */

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const width = canvas.width;
const height = canvas.height;

// ----- Game constants -----
const paddleHeight = 10;
const paddleWidth = 120;          // widened for a better angle effect
const paddleSpeed = 7;

const ballRadius = 8;
const initialBallSpeedX = 4;
const initialBallSpeedY = -5;

const brickRowCount = 6;
const brickColumnCount = 9;
const brickPadding = 12;
const brickOffsetTop = 60;
const brickOffsetLeft = 35;

// ----- Game state -----
let paddleX, ballX, ballY, dx, dy;
let rightPressed = false,
  leftPressed = false;
let lives = 3;
let score = 0;
let level = 1;

const bricks = Array.from({ length: brickColumnCount }, () =>
  Array.from({ length: brickRowCount }, () => ({ x: 0, y: 0, status: 1 }))
);

// ----- Overlay helpers -----
const overlay = document.getElementById('startScreen');
const startBtn = document.getElementById('startBtn');

function showOverlay(title, body) {
  overlay.style.display = 'block';
}
function hideOverlay() { overlay.style.display = 'none'; }

// ----- Start/reset logic -----
function resetGame(newLevel = false) {
  // Reset positions
  paddleX = (width - paddleWidth) / 2;
  ballX = width / 2;
  ballY = height - 30;

  lives = 3;

  dx = initialBallSpeedX * (Math.random() < .5 ? -1 : 1);
  dy = initialBallSpeedY;

  // Reset bricks
  bricks.forEach(col => col.forEach(b => (b.status = 1)));
}

function startLevel() {
  resetGame();
  hideOverlay();
  requestAnimationFrame(draw);
}

// ----- Event listeners -----
document.addEventListener('keydown', keyDownHandler);
document.addEventListener('keyup', keyUpHandler);
startBtn.addEventListener('click', startLevel);
// Allow Enter key to start/restart the game
window.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    startLevel();
  }
});

function keyDownHandler(e) {
  if (e.key === 'Right' || e.key === 'ArrowRight') rightPressed = true;
  else if (e.key === 'Left' || e.key === 'ArrowLeft') leftPressed = true;
}
function keyUpHandler(e) {
  if (e.key === 'Right' || e.key === 'ArrowRight') rightPressed = false;
  else if (e.key === 'Left' || e.key === 'ArrowLeft') leftPressed = false;
}

// ----- Drawing functions -----
function drawPaddle() {
  ctx.fillStyle = '#0ff';
  ctx.beginPath();
  const archHeight = 6;
  ctx.moveTo(paddleX, height - paddleHeight);
  ctx.lineTo(paddleX + paddleWidth, height - paddleHeight);
  ctx.quadraticCurveTo(
    paddleX + paddleWidth / 2,
    height - paddleHeight - archHeight,
    paddleX,
    height - paddleHeight
  );
  ctx.closePath();
  ctx.fill();
}

function drawBall() {
  ctx.beginPath();
  ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#ff0';
  ctx.fill();
  ctx.closePath();
}

const brickW = () =>
  (width - 2 * brickOffsetLeft - (brickColumnCount - 1) * brickPadding) /
  brickColumnCount;
const brickH = () => 20;

function drawBricks() {
  bricks.forEach((col, c) => {
    col.forEach((b, r) => {
      if (!b.status) return;
      const w = brickW(),
        h = brickH();
      const bx = c * (w + brickPadding) + brickOffsetLeft,
        by = r * (h + brickPadding) + brickOffsetTop;
      b.x = bx;
      b.y = by;

      ctx.fillStyle = '#ff69b4';
      ctx.fillRect(bx, by, w, h);
    });
  });
}

// ----- Collision detection -----
function collisionDetection() {
  bricks.forEach(col => {
    col.forEach(b => {
      if (!b.status) return;

      const w = brickW(),
        h = brickH();

      // Quick bounding‑box check
      if (
        ballX > b.x &&
        ballX < b.x + w &&
        ballY - ballRadius < b.y + h &&
        ballY + ballRadius > b.y
      ) {
        // Determine which side was hit
        const overlapLeft = ballX + ballRadius - b.x;
        const overlapRight = b.x + w - (ballX - ballRadius);
        const overlapTop = ballY + ballRadius - b.y;
        const overlapBottom = b.y + h - (ballY - ballRadius);

        const minOverlap = Math.min(
          overlapLeft,
          overlapRight,
          overlapTop,
          overlapBottom
        );

        if (minOverlap === overlapTop || minOverlap === overlapBottom) {
          dy = -dy; // vertical hit
        } else {
          dx = -dx; // horizontal hit
        }

        b.status = 0;
        score += 10;

        // Check win condition
        if (!bricks.flat().some(br => br.status)) {
          showOverlay(
            'You Win!',
            `Score: ${score}<br>Level ${level} cleared!<br><br>Click "Start Game" to continue.`
          );
          return; // stop further processing for this frame
        }
      }
    });
  });
}

// ----- Paddle‑ball angle logic (updated) -----
function getPaddleHitAngle() {
  const relative = (ballX - paddleX) / paddleWidth; // 0 left → 1 right

  if (relative < 0.2) {               // leftmost 20 %
    return Math.PI * (-45 / 180);     // –45°
  } else if (relative > 0.8) {        // rightmost 20 %
    return Math.PI * (45 / 180);      // +45°
  }
  // middle 60 % is flat
  return 0;                           // 0° → vertical bounce
}

function paddleCollision() {
  if (
    ballY + dy > height - paddleHeight - 10 &&
    ballX > paddleX &&
    ballX < paddleX + paddleWidth
  ) {
    const angle = getPaddleHitAngle();
    const speed = Math.hypot(dx, dy);

    // If flat (angle = 0) just invert vertical component
    if (angle === 0) {
      dy = -dy;
    } else {
      dx = speed * Math.sin(angle);
      dy = -speed * Math.cos(angle);
    }
  }
}
// ----- HUD -----
function drawHUD() {
  ctx.font = '16px Press Start 2P';
  ctx.fillStyle = '#0ff';
  const text = `Lives: ${lives}   Score: ${score}   Level: ${level}`;
  ctx.fillText(text, 10, 20);
}

// ----- Game loop -----
function draw() {
  ctx.clearRect(0, 0, width, height);

  drawBricks();
  drawPaddle();
  drawBall();
  drawHUD();

  collisionDetection();
  paddleCollision();

  // Walls
  if (ballX + dx > width - ballRadius || ballX + dx < ballRadius) dx = -dx;
  if (ballY + dy < ballRadius) dy = -dy;

  // Bottom – lose a life
  if (ballY + dy > height) {
    lives--;
    if (lives <= 0) {
      showOverlay(
        'Game Over',
        `You lost all your lives.<br>Score: ${score}<br><br>Click "Start Game" to try again.`
      );
      return;
    } else {
      // Reset ball only, keep paddle position
      ballX = width / 2;
      ballY = height - 30;
      dx = initialBallSpeedX * (Math.random() < .5 ? -1 : 1);
      dy = initialBallSpeedY;
    }
  }

  // Paddle movement
  if (rightPressed && paddleX < width - paddleWidth) paddleX += paddleSpeed;
  else if (leftPressed && paddleX > 0) paddleX -= paddleSpeed;

  // Move ball
  ballX += dx;
  ballY += dy;

  requestAnimationFrame(draw);
}

// ----- Initial state -----
resetGame();
showOverlay(
  'Welcome to Breakout!',
  `Use ← / → arrow keys (or A/D) to move the paddle.\n\nDestroy all bricks before the ball falls below the paddle.\nYou have 3 lives. Good luck!`
);
