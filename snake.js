// config
const blockSize = 25;
const rows = 20;
const cols = 20;
const gameSpeed = 10; // moveSpeed

// visuals
const GRID_BG = "#0d0d0d";
const GRID_ALPHA = 0.05;
const SCANLINE_ALPHA = 0.06;   // scanlines alpha
const SCANLINE_STEP = 2;       // distance between scanlines(px)
const BLOOM_BLUR_PX = 4;       // bloom radius (px)
const BLOOM_STRENGTH = 1.0;    // bloom strength

// screen shake
let shakeDuration = 0;
let shakeIntensity = 0;
let shakeDecay = 0.85;

// canvas
let board, context;
let bloomCanvas, bloomCtx; // offscreen canvas for bloom

// snake
let snakeBody = [[blockSize * 5, blockSize * 5]];
let velocityX = 1;
let velocityY = 0;

// bait
let foodX, foodY;

// score
let score = 0;
let baits = 0;

// bait particles
const particles = [];

let gameOver = false;
let lastRenderTime = 0;

// sfx
let eatSound, gameOverSound;

// on load
window.onload = function () {
  board = document.getElementById("board");
  board.height = rows * blockSize;
  board.width = cols * blockSize;
  context = board.getContext("2d", { alpha: false });

  // offscreen for bloom pass
  bloomCanvas = document.createElement("canvas");
  bloomCanvas.width = board.width;
  bloomCanvas.height = board.height;
  bloomCtx = bloomCanvas.getContext("2d", { alpha: true });

  // anti aliasing
  context.imageSmoothingEnabled = false;
  bloomCtx.imageSmoothingEnabled = false;

  // sfx
  eatSound = new Audio("sounds/eat.mp3");
  eatSound.volume = 0.3;
  gameOverSound = new Audio("sounds/gameover.mp3");
  gameOverSound.volume = 0.4;

  // hide game over screen on start
  document.getElementById("game-over-overlay").classList.add("hidden");

  placeFood();
  document.addEventListener("keydown", changeDirection);
  document.getElementById("restart-btn").addEventListener("click", restartGame);
  window.requestAnimationFrame(gameLoop);
};

// game loop
function gameLoop(currentTime) {
  const secondsSinceLast = (currentTime - lastRenderTime) / 1000;
  if (!gameOver && secondsSinceLast >= 1 / gameSpeed) {
    lastRenderTime = currentTime;
    update();
  }
  window.requestAnimationFrame(gameLoop);
}

// update
function update() {
  const headX = snakeBody[0][0] + velocityX * blockSize;
  const headY = snakeBody[0][1] + velocityY * blockSize;

  // wrapping
  let newHeadX = headX;
  let newHeadY = headY;
  if (headX < 0) newHeadX = board.width - blockSize;
  else if (headX >= board.width) newHeadX = 0;
  if (headY < 0) newHeadY = board.height - blockSize;
  else if (headY >= board.height) newHeadY = 0;

  // colliding with yourself
  for (let i = 1; i < snakeBody.length; i++) {
    if (snakeBody[i][0] === newHeadX && snakeBody[i][1] === newHeadY) {
      endGame();
      return;
    }
  }

  // move snake
  snakeBody.unshift([newHeadX, newHeadY]);

  // eat bait
  if (newHeadX === foodX && newHeadY === foodY) {
    score += 10;
    baits += 1;
    document.getElementById("score").innerText = score;
    document.getElementById("baits").innerText = baits;

    // spawn particles at bait
    spawnParticles(foodX + blockSize / 2, foodY + blockSize / 2);

    // play sfx
    eatSound.currentTime = 0;
    eatSound.play();

    // trigger screen shake
    shakeDuration = 6;      // duration
    shakeIntensity = 3;     // strength

    placeFood();
  } else {
    snakeBody.pop(); // keep length of the snake
  }

  draw();
}

// draw
function draw() {
  // save context
  context.save();

  // apply bounciness to screen shake if active
  if (shakeDuration > 0) {
    const dx = (Math.random() - 0.5) * shakeIntensity;
    const dy = (Math.random() - 0.5) * shakeIntensity;
    context.translate(dx, dy);
    shakeIntensity *= shakeDecay;
    shakeDuration--;
  }

  // bg grid
  drawBackgroundGrid(context);

  // particles behind the bait
  drawParticles(context);

  // clear bloom layer each frame
  bloomCtx.clearRect(0, 0, bloomCanvas.width, bloomCanvas.height);

  // bait +  pass to bloom
  drawFood(context, bloomCtx);

  // snake + pass to bloom
  drawSnake(context, bloomCtx);

  // bloom layer
  applyBloom(context, bloomCanvas);

  // crt scanlines on top
  drawScanlines(context);

  // restore context after shake
  context.restore();
}

// background grid
function drawBackgroundGrid(ctx) {
  ctx.fillStyle = GRID_BG;
  ctx.fillRect(0, 0, board.width, board.height);

  ctx.strokeStyle = `rgba(255,255,255,${GRID_ALPHA})`;
  ctx.lineWidth = 1;

  for (let x = 0; x <= board.width; x += blockSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, board.height);
    ctx.stroke();
  }
  for (let y = 0; y <= board.height; y += blockSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(board.width, y);
    ctx.stroke();
  }
}

// bait
function drawFood(ctx, bloom) {
  ctx.shadowColor = "#ff5a5a";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#E81010";
  ctx.fillRect(foodX, foodY, blockSize, blockSize);
  ctx.shadowBlur = 0;

  bloom.fillStyle = "rgba(255, 120, 120, 0.9)";
  bloom.fillRect(foodX, foodY, blockSize, blockSize);
}

// snake
function drawSnake(ctx, bloom) {
  ctx.shadowColor = "#FF8400";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#FFEC40";
  for (let i = 0; i < snakeBody.length; i++) {
    const [x, y] = snakeBody[i];
    ctx.fillRect(x, y, blockSize, blockSize);

    bloom.fillStyle = "rgba(255, 236, 64, 0.7)";
    bloom.fillRect(x + 2, y + 2, blockSize - 4, blockSize - 4);
  }
  ctx.shadowBlur = 0;
}

// bloom
function applyBloom(ctx, bloomLayer) {
  if (BLOOM_BLUR_PX <= 0 || BLOOM_STRENGTH <= 0) return;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.filter = `blur(${BLOOM_BLUR_PX}px)`;
  ctx.globalAlpha = BLOOM_STRENGTH;
  ctx.drawImage(bloomLayer, 0, 0);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

// crt effect
function drawScanlines(ctx) {
  ctx.save();
  ctx.globalAlpha = SCANLINE_ALPHA;
  ctx.fillStyle = "#000";
  for (let y = 0; y < board.height; y += SCANLINE_STEP) {
    ctx.fillRect(0, y, board.width, 1);
  }
  ctx.restore();
}

// input
function changeDirection(e) {
  const key = e.code;
  const head = snakeBody[0];
  const neck = snakeBody[1];

  if (key === "KeyW" && (neck == null || head[1] !== neck[1] + blockSize)) {
    velocityX = 0; velocityY = -1;
  } else if (key === "KeyS" && (neck == null || head[1] !== neck[1] - blockSize)) {
    velocityX = 0; velocityY = 1;
  } else if (key === "KeyA" && (neck == null || head[0] !== neck[0] + blockSize)) {
    velocityX = -1; velocityY = 0;
  } else if (key === "KeyD" && (neck == null || head[0] !== neck[0] - blockSize)) {
    velocityX = 1; velocityY = 0;
  }
}

// bait placement
function placeFood() {
  let valid = false;
  while (!valid) {
    foodX = Math.floor(Math.random() * cols) * blockSize;
    foodY = Math.floor(Math.random() * rows) * blockSize;

    valid = true;
    for (let i = 0; i < snakeBody.length; i++) {
      if (snakeBody[i][0] === foodX && snakeBody[i][1] === foodY) {
        valid = false; break;
      }
    }
  }
}

// bait particles
function spawnParticles(cx, cy) {
  for (let i = 0; i < 14; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 2;
    particles.push({
      x: cx,
      y: cy,
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
      alpha: 1,
      size: Math.random() * 2 + 1.5,
      scale: 1,
      decay: 0.96
    });
  }
}

function drawParticles(ctx) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.dx;
    p.y += p.dy;
    p.alpha *= p.decay;
    p.scale *= p.decay;

    if (p.alpha <= 0.05) {
      particles.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.shadowColor = "rgba(255, 120, 120, 0.7)";
    ctx.shadowBlur = 8;
    ctx.fillStyle = `rgba(255, 120, 120, ${p.alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// game over / restart
function endGame() {
  gameOver = true;

  // game over sfx
  gameOverSound.currentTime = 0;
  gameOverSound.play();

  document.getElementById("final-score").innerText = score;
  document.getElementById("game-over-overlay").classList.remove("hidden");
}

function restartGame() {
  snakeBody = [[blockSize * 5, blockSize * 5]];
  velocityX = 1; velocityY = 0;
  score = 0; baits = 0;
  gameOver = false;
  lastRenderTime = 0;
  document.getElementById("score").innerText = score;
  document.getElementById("baits").innerText = baits;
  placeFood();
  document.getElementById("game-over-overlay").classList.add("hidden");
}