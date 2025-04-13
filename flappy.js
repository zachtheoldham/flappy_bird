// --- Flappy Bird Specific Constants ---
const FLAPPY_GRAVITY = 0.30;
const FLAPPY_JUMP_STRENGTH = -7.2;
const FLAPPY_PIPE_WIDTH = 70;
const FLAPPY_PIPE_GAP = 200;
const FLAPPY_PIPE_SPAWN_RATE = 140; // Frames between spawns
const FLAPPY_MAX_VERTICAL_PIPE_SHIFT = 100; // Max vertical distance between consecutive gaps
const FLAPPY_BASE_GAME_SPEED = 2.0;
const FLAPPY_SPEED_INCREASE_FACTOR = 0.002; // Speed increases slightly with score
const FLAPPY_FLOOR_HEIGHT = 50;

// Colors
const FLAPPY_COLOR_SKY = '#4a90e2';
const FLAPPY_COLOR_FLOOR = '#b87333';
const FLAPPY_COLOR_BIRD = '#f5a623';
const FLAPPY_COLOR_PIPE = '#7ed321';
const FLAPPY_COLOR_PIPE_BORDER = '#5c9f1a';
const FLAPPY_COLOR_TEXT = '#ffffff';
const FLAPPY_COLOR_TEXT_OUTLINE = '#000000';
const FLAPPY_COLOR_GAMEOVER_BG = 'rgba(0, 0, 0, 0.75)';
const FLAPPY_COLOR_GAMEOVER_TEXT = '#ff4f4f';
const FLAPPY_COLOR_PARTICLE = 'rgba(255, 255, 255, 0.7)';

// --- Flappy Bird Game State ---
let flappyGame = {}; // Initialize as empty object

// --- Flappy Bird Initialization ---
function initFlappy() {
    console.log("[initFlappy] Starting Flappy initialization...");
    // Fully reset the state object
    flappyGame = {
        bird: {
            x: 100, y: CANVAS_HEIGHT / 2 - 15, width: 25, height: 25,
            velocityY: 0, rotation: 0, scaleY: 1, scaleX: 1, isJumping: false
        },
        particles: [],
        pipes: [],
        frame: 0, // Frame counter specific to flappy gameplay
        score: 0,
        highScore: localStorage.getItem('retroFlappyHighScore') || 0,
        internalState: 'Start', // Flappy's own state: 'Start', 'GetReady', 'Playing', 'GameOver'
        lastPipeTopHeight: null, // For calculating next pipe position
        gameSpeed: FLAPPY_BASE_GAME_SPEED,
        initialized: true // Mark as initialized
    };
    console.log("[initFlappy] Flappy state object reset.");
    console.log("[initFlappy] Flappy initialization complete.");
}

// --- Flappy Bird Update Logic ---
function updateFlappy() {
    const state = flappyGame.internalState;

    // Update based on Flappy's internal state
    if (state === 'Playing') {
        updateFlappyBirdPhysics();
        updateFlappyPipes();
        updateFlappyParticles();
    } else if (state === 'GetReady') {
        updateFlappyBirdPhysics(); // Bird bobs but doesn't fall off screen
        updateFlappyParticles();
    } else if (state === 'GameOver') {
        updateFlappyBirdPhysics(); // Bird falls to the ground
        updateFlappyParticles();
    } else { // 'Start' state
        updateFlappyBirdPhysics(); // Allow slight bobbing on start screen
        updateFlappyParticles();
    }
}

// Handle input specifically for Flappy Bird states
function handleFlappyInput() {
     switch (flappyGame.internalState) {
        case 'Start':
            flappyGame.internalState = 'GetReady';
            resetFlappyGameData(); // Reset bird pos, pipes, score etc.
            break;
        case 'GetReady':
            flappyBirdJump(); // First jump starts 'Playing'
            flappyGame.internalState = 'Playing';
            flappyGame.frame = 0; // Reset frame count for pipes
            spawnFlappyPipe(); // Spawn first pipe immediately
            break;
        case 'Playing':
            flappyBirdJump();
            break;
        case 'GameOver':
            // Resetting to 'Start' state on click/input after game over
            flappyGame.internalState = 'Start';
            resetFlappyGameData(); // Reset bird/pipes/score
            // High score persists
            break;
    }
}

// Resets gameplay variables but keeps high score and initialized status
function resetFlappyGameData() {
    const bird = flappyGame.bird;
    bird.y = CANVAS_HEIGHT / 2 - bird.height / 2;
    bird.velocityY = 0;
    bird.rotation = 0;
    bird.scaleX = 1; bird.scaleY = 1; bird.isJumping = false;
    flappyGame.pipes = [];
    flappyGame.particles = [];
    flappyGame.score = 0;
    flappyGame.gameSpeed = FLAPPY_BASE_GAME_SPEED;
    flappyGame.lastPipeTopHeight = null;
    flappyGame.frame = 0;
    console.log("Flappy game data reset (score, pipes, bird pos).");
}

// Full reset, typically called by initFlappy if already initialized
function resetFlappy() {
    resetFlappyGameData();
    flappyGame.internalState = 'Start';
    flappyGame.highScore = localStorage.getItem('retroFlappyHighScore') || 0; // Re-read high score
}

function updateFlappyBirdPhysics() {
    const bird = flappyGame.bird;
    const state = flappyGame.internalState;
    const floorY = CANVAS_HEIGHT - FLAPPY_FLOOR_HEIGHT;

    if (state === 'Playing' || state === 'GetReady' || (state === 'GameOver' && bird.y + bird.height < floorY)) {
        bird.velocityY += FLAPPY_GRAVITY;
        bird.y += bird.velocityY;
    }

    // Bobbing effect in Start/GetReady state (subtle)
     if (state === 'Start' || state === 'GetReady') {
         bird.y += Math.sin(globalFrameCounter * 0.1) * 0.3; // Use globalFrameCounter for consistent bob
     }

    // Clamp bird position slightly above floor unless game over
    if (state !== 'GameOver' && bird.y + bird.height >= floorY) {
        bird.y = floorY - bird.height;
        bird.velocityY = 0;
        bird.scaleY = 1; bird.scaleX = 1; // Reset squash/stretch
        if (state === 'Playing') {
            endFlappyGame(true); // Ground hit ends the game
        }
    } else if (state === 'GameOver' && bird.y + bird.height > floorY) {
        // Ensure bird stays on floor after game over fall
         bird.y = floorY - bird.height;
         bird.velocityY = 0;
         bird.rotation = 90; // Keep rotated
    }

    // Ceiling collision (prevent going off top)
    if (bird.y < 0) {
        bird.y = 0;
        bird.velocityY = 0;
    }

    // Apply rotation based on velocity (only when playing/ready)
    if (state === 'Playing' || state === 'GetReady') {
         let targetRotation = Math.max(-30, Math.min(90, bird.velocityY * 6));
         // Smooth rotation towards target
         bird.rotation += (targetRotation - bird.rotation) * 0.15;
    } else if (state === 'GameOver' && bird.y + bird.height < floorY) {
        // Rotate downwards quickly when falling in game over
        bird.rotation = Math.min(90, bird.rotation + 5);
    }

    // Apply squash/stretch effect based on jump state
    if (bird.isJumping) {
        bird.scaleY = 1.3; bird.scaleX = 0.8;
        bird.isJumping = false; // Reset jump flag after applying effect once
    } else {
        // Return to normal scale smoothly
        bird.scaleY += (1 - bird.scaleY) * 0.2;
        bird.scaleX += (1 - bird.scaleX) * 0.2;
    }
}

function updateFlappyPipes() {
    if (flappyGame.internalState !== 'Playing') return;

    // Increase game speed based on score
    flappyGame.gameSpeed = FLAPPY_BASE_GAME_SPEED + flappyGame.score * FLAPPY_SPEED_INCREASE_FACTOR;

    for (let i = flappyGame.pipes.length - 1; i >= 0; i--) {
        let pipe = flappyGame.pipes[i];
        pipe.x -= flappyGame.gameSpeed;

        // Collision Check
        const bird = flappyGame.bird;
        const birdRect = { x: bird.x, y: bird.y, width: bird.width, height: bird.height };
        const topPipeRect = { x: pipe.x, y: 0, width: FLAPPY_PIPE_WIDTH, height: pipe.topHeight };
        const bottomPipeRect = { x: pipe.x, y: pipe.bottomY, width: FLAPPY_PIPE_WIDTH, height: CANVAS_HEIGHT - pipe.bottomY - FLAPPY_FLOOR_HEIGHT };

        if (checkCollision(birdRect, topPipeRect) || checkCollision(birdRect, bottomPipeRect)) {
            endFlappyGame(false); // Pipe hit
            return; // Stop checking after hit
        }

        // Score Check
        if (!pipe.passed && birdRect.x > pipe.x + FLAPPY_PIPE_WIDTH) {
            flappyGame.score++;
            pipe.passed = true;
            playSound('score'); // Assumes global playSound
            // Potentially increase speed more aggressively on score milestones?
        }

        // Remove off-screen pipes
        if (pipe.x + FLAPPY_PIPE_WIDTH < 0) {
            flappyGame.pipes.splice(i, 1);
        }
    }

    // Spawn new pipes based on frame counter
    flappyGame.frame++;
    if (flappyGame.frame % FLAPPY_PIPE_SPAWN_RATE === 0) {
        spawnFlappyPipe();
    }
}

// Helper for collision detection
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

function spawnFlappyPipe() {
    const pipeGap = FLAPPY_PIPE_GAP;
    const minEdgeMargin = 80; // Minimum space from top/bottom edge

    const availableHeight = CANVAS_HEIGHT - FLAPPY_FLOOR_HEIGHT - (2 * minEdgeMargin);
    const maxTopPipeHeight = availableHeight - pipeGap;

    if (maxTopPipeHeight <= 0) {
        console.error("Flappy pipe gap too large for screen height!");
        return;
    }

    let minTopY = minEdgeMargin;
    let maxTopY = minEdgeMargin + maxTopPipeHeight;

    // Apply constraint based on previous pipe, if available
    if (flappyGame.lastPipeTopHeight !== null) {
        minTopY = Math.max(minTopY, flappyGame.lastPipeTopHeight - FLAPPY_MAX_VERTICAL_PIPE_SHIFT);
        maxTopY = Math.min(maxTopY, flappyGame.lastPipeTopHeight + FLAPPY_MAX_VERTICAL_PIPE_SHIFT);
        // Ensure the range remains valid after constraints
        if (maxTopY < minTopY) {
             console.warn("Flappy pipe vertical shift constraints resulted in invalid range. Widening range.");
             // Widen range slightly if constrained too much
             minTopY = Math.max(minEdgeMargin, flappyGame.lastPipeTopHeight - FLAPPY_MAX_VERTICAL_PIPE_SHIFT - 50);
             maxTopY = Math.min(minEdgeMargin + maxTopPipeHeight, flappyGame.lastPipeTopHeight + FLAPPY_MAX_VERTICAL_PIPE_SHIFT + 50);
             // Final fallback if still invalid (should be rare)
             if (maxTopY <= minTopY) { minTopY = minEdgeMargin; maxTopY = minEdgeMargin + maxTopPipeHeight; }
        }
    }

    const topPipeHeight = Math.random() * (maxTopY - minTopY) + minTopY;
    const bottomPipeTopY = topPipeHeight + pipeGap;

    flappyGame.pipes.push({
        x: CANVAS_WIDTH, topHeight: topPipeHeight, bottomY: bottomPipeTopY, passed: false
    });
    flappyGame.lastPipeTopHeight = topPipeHeight; // Store for next spawn calculation
}


function updateFlappyParticles() {
     for (let i = flappyGame.particles.length - 1; i >= 0; i--) {
        let p = flappyGame.particles[i];
        p.x += p.speedX;
        p.y += p.speedY;
        p.speedY += 0.1; // Gravity on particles
        p.life--;
        if (p.life <= 0) {
            flappyGame.particles.splice(i, 1);
        }
    }
}

function createFlappyJumpParticles() {
    const bird = flappyGame.bird;
     for (let i = 0; i < 5; i++) {
        flappyGame.particles.push({
            x: bird.x + bird.width / 2,
            y: bird.y + bird.height / 2,
            size: Math.random() * 3 + 1,
            speedX: (Math.random() - 0.5) * 2, // Spread horizontally
            speedY: Math.random() * -2 - 1, // Move upwards initially
            life: 30 // Frames
        });
    }
}

function flappyBirdJump() {
     // Only allow jumping if playing or getting ready
     if (flappyGame.internalState === 'Playing' || flappyGame.internalState === 'GetReady') {
        const bird = flappyGame.bird;
        // Prevent jumping too high if already near the top?
        if (bird.y > 20) { // Small buffer from ceiling
             bird.velocityY = FLAPPY_JUMP_STRENGTH;
             bird.isJumping = true; // Trigger squash/stretch
             playSound('jump'); // Assumes global playSound
             createFlappyJumpParticles();
        }
    }
}

function endFlappyGame(hitGround) {
    if (flappyGame.internalState === 'Playing') {
        flappyGame.internalState = 'GameOver';
        playSound('hit'); // Assumes global playSound
        // Play die sound slightly after hit sound if it wasn't a ground impact
        if (!hitGround) {
            setTimeout(() => playSound('die'), 200);
        }
        // Check and save high score
        if (flappyGame.score > flappyGame.highScore) {
            flappyGame.highScore = flappyGame.score;
            localStorage.setItem('retroFlappyHighScore', flappyGame.highScore);
            console.log("Flappy New High Score!", flappyGame.highScore);
        }
        console.log("Flappy Game Over. Final Score:", flappyGame.score);
    }
}

// --- Flappy Bird Drawing Functions ---
function drawFlappy() {
    // Draw Background
    ctx.fillStyle = FLAPPY_COLOR_SKY;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Pipes
    ctx.fillStyle = FLAPPY_COLOR_PIPE;
    ctx.strokeStyle = FLAPPY_COLOR_PIPE_BORDER;
    ctx.lineWidth = 3;
    flappyGame.pipes.forEach(pipe => {
        // Top pipe
        ctx.fillRect(pipe.x, 0, FLAPPY_PIPE_WIDTH, pipe.topHeight);
        ctx.strokeRect(pipe.x, 0, FLAPPY_PIPE_WIDTH, pipe.topHeight);
        // Bottom pipe
        const bottomPipeHeight = CANVAS_HEIGHT - pipe.bottomY - FLAPPY_FLOOR_HEIGHT;
        ctx.fillRect(pipe.x, pipe.bottomY, FLAPPY_PIPE_WIDTH, bottomPipeHeight);
        ctx.strokeRect(pipe.x, pipe.bottomY, FLAPPY_PIPE_WIDTH, bottomPipeHeight);
    });
    ctx.lineWidth = 1; // Reset line width

    // Draw Floor
    ctx.fillStyle = FLAPPY_COLOR_FLOOR;
    ctx.fillRect(0, CANVAS_HEIGHT - FLAPPY_FLOOR_HEIGHT, CANVAS_WIDTH, FLAPPY_FLOOR_HEIGHT);
    // Add a top border to the floor
    ctx.fillStyle = FLAPPY_COLOR_TEXT_OUTLINE;
    ctx.fillRect(0, CANVAS_HEIGHT - FLAPPY_FLOOR_HEIGHT, CANVAS_WIDTH, 3);

    // Draw Particles
    ctx.fillStyle = FLAPPY_COLOR_PARTICLE;
    flappyGame.particles.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    });

    // Draw Bird
    drawFlappyBird();

    // Draw Score / UI Text
    drawFlappyUI();

    // Draw State Specific Messages
    const state = flappyGame.internalState;
    if (state === 'Start') drawFlappyStartMessage();
    else if (state === 'GetReady') drawFlappyGetReadyMessage();
    else if (state === 'GameOver') drawFlappyGameOverMessage();
}

function drawFlappyBird() {
    const bird = flappyGame.bird;
    ctx.save(); // Save context for transformations
    // Translate to bird's center for rotation and scaling
    ctx.translate(bird.x + bird.width / 2, bird.y + bird.height / 2);
    // Apply rotation
    ctx.rotate(bird.rotation * Math.PI / 180);
    // Apply scaling
    ctx.scale(bird.scaleX, bird.scaleY);

    // Draw bird body (simple rectangle)
    ctx.fillStyle = FLAPPY_COLOR_BIRD;
    ctx.fillRect(-bird.width / 2, -bird.height / 2, bird.width, bird.height);
    // Draw bird outline
    ctx.strokeStyle = FLAPPY_COLOR_TEXT_OUTLINE;
    ctx.lineWidth = 2;
    ctx.strokeRect(-bird.width / 2, -bird.height / 2, bird.width, bird.height);

    ctx.restore(); // Restore context state
}

function drawFlappyUI() {
    const state = flappyGame.internalState;
    ctx.fillStyle = FLAPPY_COLOR_TEXT;
    ctx.strokeStyle = FLAPPY_COLOR_TEXT_OUTLINE;
    ctx.lineWidth = 4;
    ctx.font = `bold 40px ${FONT_RETRO}`; // Assumes FONT_RETRO is global
    ctx.textAlign = 'center';

    // Draw Score (only during play/game over)
    if (state === 'Playing' || state === 'GameOver' || state === 'GetReady') {
        const scoreText = `${flappyGame.score}`;
        ctx.strokeText(scoreText, CANVAS_WIDTH / 2, 70);
        ctx.fillText(scoreText, CANVAS_WIDTH / 2, 70);
    }

    // Draw High Score (always visible except maybe during 'GetReady'?)
    if (state !== 'GetReady') {
        ctx.font = `bold 20px ${FONT_RETRO}`;
        ctx.textAlign = 'right';
        const highScoreText = `HI: ${flappyGame.highScore}`;
        ctx.strokeText(highScoreText, CANVAS_WIDTH - 20, 40);
        ctx.fillText(highScoreText, CANVAS_WIDTH - 20, 40);
    }
    ctx.textAlign = 'left'; // Reset alignment
    ctx.lineWidth = 1; // Reset line width
}

function drawFlappyStartMessage() {
    ctx.save();
    ctx.fillStyle = FLAPPY_COLOR_TEXT;
    ctx.strokeStyle = FLAPPY_COLOR_TEXT_OUTLINE;
    ctx.lineWidth = 3;
    ctx.font = `bold 50px ${FONT_RETRO}`;
    ctx.textAlign = 'center';

    const title = 'Retro Flappy';
    ctx.strokeText(title, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 3);
    ctx.fillText(title, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 3);

    ctx.font = `bold 25px ${FONT_RETRO}`;
    const prompt = 'Click / Space / ArrowUp';
    ctx.strokeText(prompt, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.fillText(prompt, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

    // Don't show high score here, it's in the main UI draw
    // ctx.font = `bold 30px ${FONT_RETRO}`;
    // ctx.strokeText(`High Score: ${flappyGame.highScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);
    // ctx.fillText(`High Score: ${flappyGame.highScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);
    ctx.restore();
}

function drawFlappyGetReadyMessage() {
    ctx.save();
    ctx.fillStyle = FLAPPY_COLOR_TEXT;
    ctx.strokeStyle = FLAPPY_COLOR_TEXT_OUTLINE;
    ctx.lineWidth = 3;
    ctx.font = `bold 50px ${FONT_RETRO}`;
    ctx.textAlign = 'center';

    const readyText = 'Get Ready!';
    ctx.strokeText(readyText, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 3);
    ctx.fillText(readyText, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 3);
    ctx.restore();
}

function drawFlappyGameOverMessage() {
    ctx.save();
    // Semi-transparent background box
    ctx.fillStyle = FLAPPY_COLOR_GAMEOVER_BG;
    let boxWidth = CANVAS_WIDTH * 0.8;
    let boxHeight = CANVAS_HEIGHT * 0.6;
    let boxX = (CANVAS_WIDTH - boxWidth) / 2;
    let boxY = (CANVAS_HEIGHT - boxHeight) / 2;
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Game Over Text
    ctx.fillStyle = FLAPPY_COLOR_GAMEOVER_TEXT;
    ctx.font = `bold 45px ${FONT_RETRO}`;
    ctx.fillText('Game Over!', CANVAS_WIDTH / 2, boxY + boxHeight * 0.2);

    // Score Text
    ctx.fillStyle = FLAPPY_COLOR_TEXT;
    ctx.font = `bold 35px ${FONT_RETRO}`;
    ctx.fillText(`Score: ${flappyGame.score}`, CANVAS_WIDTH / 2, boxY + boxHeight * 0.4);

    // High Score Text / New High Score Message
    ctx.font = `bold 25px ${FONT_RETRO}`;
    if (flappyGame.score >= flappyGame.highScore && flappyGame.highScore > 0) { // Show only if HS > 0 and beaten
        ctx.fillStyle = '#ffd700'; // Gold color for new high score
        ctx.fillText('New High Score!', CANVAS_WIDTH / 2, boxY + boxHeight * 0.55);
    } else {
        ctx.fillStyle = FLAPPY_COLOR_TEXT;
        ctx.fillText(`High Score: ${flappyGame.highScore}`, CANVAS_WIDTH / 2, boxY + boxHeight * 0.55);
    }

    // Medal (Optional)
    let medal = "";
    if (flappyGame.score >= 30) medal = "Gold";
    else if (flappyGame.score >= 20) medal = "Silver";
    else if (flappyGame.score >= 10) medal = "Bronze";
    if (medal) {
         ctx.fillStyle = FLAPPY_COLOR_TEXT;
         ctx.font = `bold 30px ${FONT_RETRO}`;
         ctx.fillText(`Medal: ${medal}`, CANVAS_WIDTH / 2, boxY + boxHeight * 0.7);
    }

    // Retry Prompt
    ctx.fillStyle = FLAPPY_COLOR_TEXT;
    ctx.font = `bold 20px ${FONT_RETRO}`;
    ctx.fillText('Click / Space / ArrowUp to Retry', CANVAS_WIDTH / 2, boxY + boxHeight * 0.9);

    ctx.restore();
} 