/* Pac-Man - initial version */
(function() {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  let W, H;
  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();
  // classic Pac-Man maze: '#'=wall, '.'=dot, 'o'=energizer, ' '=path
  const maze = [
    "############################",
    "#............##............#",
    "#.####.#####.##.#####.####.#",
    "#o####.#####.##.#####.####o#",
    "#.####.#####.##.#####.####.#",
    "#..........................#",
    "#.####.##.########.##.####.#",
    "#.####.##.########.##.####.#",
    "#......##....##....##......#",
    "######.##### ## #####.######",
    "######.##### ## #####.######",
    "######.##          ##.######",
    "######.## ######## ##.######",
    "######.## ######## ##.######",
    ".............##.............",
    "#.####.#####.##.#####.####.#",
    "#.####.#####.##.#####.####.#",
    "#o..##................##..o#",
    "###.##.## ######## ##.##.###",
    "###.##.## ######## ##.##.###",
    "#......##....##....##......#",
    "#.##########.##.##########.#",
    "#.##########.##.##########.#",
    "#..........................#",
    "############################"
  ];
  const ROWS = maze.length;
  const COLS = maze[0].length;
  // ghost house bounds (zero-based row/col) where ghosts spawn
  const GH_ROW_START = 11, GH_ROW_END = 13;
  const GH_COL_START = 9,  GH_COL_END = 18;
  // tile size for maze
  let TILE_W, TILE_H;
  function updateTileSize() {
    TILE_W = W / COLS;
    TILE_H = H / ROWS;
  }
  updateTileSize();
  window.addEventListener('resize', updateTileSize);
  
  // define tunnel row for wrap-around
  const TUNNEL_ROW = 14;
  // spawn position (centered at bottom corridor)
  const SPAWN_ROW = ROWS - 2;
  const SPAWN_COL = Math.floor(COLS / 2);

  // -------- Ghost (enemy) setup --------
  // Ghost house center spawn
  const GHOST_SPAWN_COL = Math.floor((GH_COL_START + GH_COL_END + 1) / 2);
  const GHOST_SPAWN_ROW = GH_ROW_START;  // spawn on ghost house floor row
  // Ghost class
  class Ghost {
    constructor(x, y, type, color) {
      this.x = x; this.y = y;
      this.type = type;
      this.color = color;
      this.speed = 2;
      this.dx = 0; this.dy = 0;
    }
    update() {
      // continuous chase towards player
      const angle = Math.atan2(player.y - this.y, player.x - this.x);
      this.x += Math.cos(angle) * this.speed;
      this.y += Math.sin(angle) * this.speed;
      // tunnel wrap for ghosts
      const row = Math.floor(this.y / TILE_H);
      if (row === TUNNEL_ROW) {
        if (this.x < 0) this.x = W;
        else if (this.x > W) this.x = 0;
      }
    }
    draw() {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, TILE_W/2 * 0.9, 0, Math.PI*2);
      ctx.fill();
    }
  }
  // instantiate ghosts with horizontal offsets so they don't overlap
  // instantiate ghosts with individual AI types and spaced spawn positions
  const ghostTypes = ['blinky','pinky','inky','clyde'];
  const ghostColors = ['#FF0000','#FFB8FF','#00FFFF','#FFB852'];
  const ghosts = [];
  // spawn offsets in tile units (left to right inside ghost house)
  const spawnOffsets = [-1.5, -0.5, 0.5, 1.5];
  for (let i = 0; i < ghostTypes.length; i++) {
    const type = ghostTypes[i];
    const color = ghostColors[i];
    const offset = spawnOffsets[i] || 0;
    const gx = (GHOST_SPAWN_COL + 0.5 + offset) * TILE_W;
    const gy = (GHOST_SPAWN_ROW + 0.5) * TILE_H;
    ghosts.push(new Ghost(gx, gy, type, color));
  }
  // delay before ghosts start chasing (ms)
  const CHASE_DELAY = 3000;
  // timestamp when game/ghosts were initialized
  const chaseStart = performance.now();

  // input
  const keys = {};
  window.addEventListener('keydown', e => keys[e.key] = true);
  window.addEventListener('keyup', e => keys[e.key] = false);

  // player
  const player = {
    x: (SPAWN_COL + 0.5) * TILE_W,
    y: (SPAWN_ROW + 0.5) * TILE_H,
    r: 20,
    speed: 3,
    dirX: 1, // initial direction: right
    dirY: 0
  };

  function update() {
    // movement with wall collision
    // collision-aware movement: check bounding box against walls
    const tryMove = (dx, dy) => {
      let nx = player.x + dx;
      let ny = player.y + dy;
      const r = Math.floor(ny / TILE_H);
      // tunnel wrap-around at specific row
      if (r === TUNNEL_ROW) {
        if (nx < 0) { player.x = W - player.r; player.y = ny; return; }
        if (nx > W) { player.x = player.r; player.y = ny; return; }
      }
      // compute bounding tiles under circle
      const left   = nx - player.r;
      const right  = nx + player.r;
      const top    = ny - player.r;
      const bottom = ny + player.r;
      const minC = Math.floor(left  / TILE_W);
      const maxC = Math.floor(right / TILE_W);
      const minR = Math.floor(top   / TILE_H);
      const maxR = Math.floor(bottom/ TILE_H);
      for (let rr = minR; rr <= maxR; rr++) {
        for (let cc = minC; cc <= maxC; cc++) {
          if (!maze[rr] || maze[rr][cc] === '#') return;
        }
      }
      player.x = nx;
      player.y = ny;
    };
    // handle player input and update direction
    if      (keys['ArrowLeft']  || keys['a']) { player.dirX = -1; player.dirY = 0; tryMove(-player.speed, 0); }
    else if (keys['ArrowRight'] || keys['d']) { player.dirX =  1; player.dirY = 0; tryMove( player.speed, 0); }
    else if (keys['ArrowUp']    || keys['w']) { player.dirX =  0; player.dirY = -1; tryMove(0, -player.speed); }
    else if (keys['ArrowDown']  || keys['s']) { player.dirX =  0; player.dirY =  1; tryMove(0,  player.speed); }
  
    // update ghosts only after chase delay
    const nowTime = performance.now();
    if (nowTime - chaseStart > CHASE_DELAY) {
      ghosts.forEach(g => g.update());
    }
  }

  function draw() {
    // clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    // draw ghost house floor
    ctx.fillStyle = '#333';
    ctx.fillRect(
      GH_COL_START * TILE_W,
      GH_ROW_START * TILE_H,
      (GH_COL_END - GH_COL_START + 1) * TILE_W,
      (GH_ROW_END - GH_ROW_START + 1) * TILE_H
    );
    // draw maze walls
    ctx.fillStyle = '#0000ff'; // wall color
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (maze[r][c] === '#') {
          ctx.fillRect(c * TILE_W, r * TILE_H, TILE_W, TILE_H);
        }
      }
    }
    // draw Pac-Man (simple circle)
    ctx.fillStyle = 'yellow';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
    ctx.fill();
    // draw ghosts on top
    ghosts.forEach(g => g.draw());
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }
  loop();
})();