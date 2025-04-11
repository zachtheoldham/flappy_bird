const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Global State ---
let currentGameState = 'MainMenu'; // 'MainMenu', 'PvZ', 'Flappy'
let mousePos = { x: 0, y: 0 };
let isClicking = false; // Set true on mousedown, reset in gameLoop
let keysPressed = {}; // For Flappy Bird input
let isPaused = false; // << Pause flag
let globalFrameCounter = 0; // For global effects

// --- Constants ---
const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;

// --- Fonts ---
const FONT_RETRO = '"Courier New", Courier, monospace';
const FONT_UI = 'Arial, sans-serif';

// --- Asset Loading (PvZ) ---
let pvzAssets = {
    // Plants
    peashooter: { img: new Image(), path: 'assets/pvz/peashooter.png', loaded: false },
    sunflower: { img: new Image(), path: 'assets/pvz/sunflower.png', loaded: false },
    wallnut: { img: new Image(), path: 'assets/pvz/wallnut.png', loaded: false }, // Add wallnut_cracked1/2 later?
    // Zombies (Sprite Sheets)
    zombie_basic_walk: { img: new Image(), path: 'assets/pvz/zombie_basic_walk.png', loaded: false, frameWidth: 60, frameHeight: 90, frameCount: 4 }, // Example parameters
    zombie_conehead_walk: { img: new Image(), path: 'assets/pvz/zombie_conehead_walk.png', loaded: false, frameWidth: 60, frameHeight: 100, frameCount: 4 }, // Example parameters
    // TODO: Add zombie eating spritesheets
    // Projectiles
    pea: { img: new Image(), path: 'assets/pvz/pea.png', loaded: false },
    // Collectibles
    sun: { img: new Image(), path: 'assets/pvz/sun.png', loaded: false },
};
let pvzAssetsLoadedCount = 0;
let pvzTotalAssets = Object.keys(pvzAssets).length;
let pvzAssetsLoaded = false;

function loadPvZAssets() {
    console.log("Loading PvZ assets...");
    pvzAssetsLoaded = false;
    pvzAssetsLoadedCount = 0;
    let allLoadPromises = [];

    for (const key in pvzAssets) {
        const asset = pvzAssets[key];
        asset.loaded = false; // Reset loaded state
        asset.img.src = asset.path; // Start loading

        const loadPromise = new Promise((resolve, reject) => {
            asset.img.onload = () => {
                console.log(`Loaded asset: ${asset.path}`);
                asset.loaded = true;
                pvzAssetsLoadedCount++;
                resolve();
            };
            asset.img.onerror = () => {
                console.error(`Failed to load asset: ${asset.path}`);
                // Resolve anyway so game doesn't hang, maybe draw placeholders
                asset.loaded = false; // Explicitly mark as not loaded
                pvzAssetsLoadedCount++; // Count it as 'attempted' for progress
                resolve(); // Or reject(new Error(...)) if you want to halt
            };
        });
        allLoadPromises.push(loadPromise);
    }

    // Check if all assets are loaded after promises settle
    Promise.all(allLoadPromises).then(() => {
        if (pvzAssetsLoadedCount >= pvzTotalAssets) { // Use >= to handle potential errors
            console.log("All PvZ assets finished loading (including potential errors).");
            pvzAssetsLoaded = true;
        }
    }).catch(error => {
        console.error("Error during PvZ asset loading:", error);
        pvzAssetsLoaded = false; // Ensure not marked as loaded on critical error
    });
}

// --- Menu Variables ---
const menuItems = [
    { id: 'pvz', text: 'Plants vs Zombies (Core)', x: 200, y: 150, width: 400, height: 50, targetState: 'PvZ' },
    { id: 'flappy', text: 'Retro Flappy', x: 200, y: 250, width: 400, height: 50, targetState: 'Flappy' }
];
let hoveredMenuItem = null;
const backButton = { x: 10, y: 10, width: 80, height: 30, text: 'Back' };
let isHoveringBack = false;
const pauseButton = { x: CANVAS_WIDTH - 90, y: 10, width: 80, height: 30, text: 'Pause' }; // Top right
let isHoveringPause = false;

// --- PvZ Variables ---
const PVZ_GRID_COLS = 9;
const PVZ_GRID_ROWS = 5;
const PVZ_CELL_WIDTH = CANVAS_WIDTH * 0.8 / PVZ_GRID_COLS;
const PVZ_CELL_HEIGHT = CANVAS_HEIGHT * 0.7 / PVZ_GRID_ROWS;
const PVZ_GRID_START_X = CANVAS_WIDTH * 0.1;
const PVZ_GRID_START_Y = CANVAS_HEIGHT * 0.15;
// Restore Color Constants
const PVZ_PLANT_COLOR = '#2ecc71'; // Green
const PVZ_SUNFLOWER_COLOR = '#f1c40f'; // Yellow
const PVZ_WALLNUT_COLOR = '#a0522d'; // Brown (Sienna)
const PVZ_ZOMBIE_COLOR = '#95a5a6'; // Grey
const PVZ_CONE_COLOR = '#e67e22'; // Orange/Brown for cone
const PVZ_GRID_COLOR = 'rgba(0, 0, 0, 0.2)';
const PVZ_PROJECTILE_COLOR = '#34495e'; // Dark grey/blue
const PVZ_SUN_COLOR = '#f39c12'; // Orange
const PVZ_UI_BG_COLOR = '#bdc3c7';
const PVZ_SEED_PACKET_WIDTH = 60;
const PVZ_SEED_PACKET_HEIGHT = 80;
const PVZ_CHERRYBOMB_COLOR = '#e74c3c'; // Red
const PVZ_EXPLOSION_COLOR = 'rgba(255, 165, 0, 0.7)'; // Orange alpha

let pvzGame = {
    plants: [], // { type: 'peashooter'/'sunflower'/'wallnut', row, col, health, ..., placeAnimTimer?, sunCooldown?, shootCooldown? }
    zombies: [], // { type: 'basic'/'conehead', row, x, health, speed, isEating }
    projectiles: [],
    suns: [], // { x, y, value, fallSpeed, angle?, rotationSpeed? }
    particles: [], // For hits, sun collection, explosions
    sunCount: 150,
    selectedPlantType: null,
    plantCosts: { 'peashooter': 100, 'sunflower': 50, 'wallnut': 50, 'cherrybomb': 150 },
    plantHealth: { 'peashooter': 100, 'sunflower': 80, 'wallnut': 400, 'cherrybomb': 50 },
    zombieHealth: { 'basic': 150, 'conehead': 400 },
    zombieDamage: { 'basic': 10, 'conehead': 10 },
    zombieEatInterval: 60,
    zombieCounters: {},
    nextZombieId: 0,
    nextPlantId: 0,
    // Wave System State
    waveNumber: 0,
    waveDefinition: [
        { count: 3, types: ['basic'], interval: 500 },          // Wave 1
        { count: 5, types: ['basic'], interval: 450 },          // Wave 2
        { count: 7, types: ['basic', 'conehead'], interval: 400 }, // Wave 3
        { count: 10, types: ['basic', 'conehead'], interval: 350 },// Wave 4
        { count: 12, types: ['basic', 'conehead'], interval: 320 },// Wave 5
        { count: 15, types: ['basic', 'conehead'], interval: 300 }, // Wave 6 (Last defined)
        { count: 10, types: ['conehead'], interval: 400 },        // 7 (Conehead heavy)
        { count: 20, types: ['basic', 'conehead'], interval: 280 }, // 8 (Faster spawn)
        { count: 25, types: ['basic', 'conehead'], interval: 250 }  // 9 (Final wave for now)
    ],
    zombiesRemainingInWave: 0,
    zombiesToSpawnInWave: 0,
    timeToNextZombie: 0, // Timer for spawning within a wave
    waveInProgress: false,
    wavesCompleted: false, // Added Flag
    timeToNextWave: 300, // Delay before first wave starts (5 seconds)
    // Sun spawning timers
    sunSpawnTimer: 0,
    sunSpawnInterval: 300,
    score: 0, // << PvZ Score
};

const plantTypes = ['peashooter', 'sunflower', 'wallnut', 'cherrybomb'];

// --- Flappy Bird Variables ---
let flappyGame = {
    bird: {
        x: 100, y: CANVAS_HEIGHT / 2 - 15, width: 25, height: 25,
        velocityY: 0, rotation: 0, scaleY: 1, scaleX: 1, isJumping: false
    },
    particles: [], pipes: [], frame: 0, score: 0, highScore: 0,
    internalState: 'Start', // Flappy's own state: 'Start', 'GetReady', 'Playing', 'GameOver'
    lastPipeTopHeight: null, gameSpeed: 0,
    // Constants specific to Flappy
    GRAVITY: 0.30, JUMP_STRENGTH: -7.2, PIPE_WIDTH: 70, PIPE_GAP: 200,
    PIPE_SPAWN_RATE: 140, MAX_VERTICAL_PIPE_SHIFT: 100, BASE_GAME_SPEED: 2.0,
    SPEED_INCREASE_FACTOR: 0.002, FLOOR_HEIGHT: 50,
    // Colors
    COLOR_SKY: '#4a90e2', COLOR_FLOOR: '#b87333', COLOR_BIRD: '#f5a623',
    COLOR_PIPE: '#7ed321', COLOR_PIPE_BORDER: '#5c9f1a', COLOR_TEXT: '#ffffff',
    COLOR_TEXT_OUTLINE: '#000000', COLOR_GAMEOVER_BG: 'rgba(0, 0, 0, 0.75)',
    COLOR_GAMEOVER_TEXT: '#ff4f4f', COLOR_PARTICLE: 'rgba(255, 255, 255, 0.7)',
    initialized: false // Flag to check if initFlappy was called
};
// Load Flappy High Score separately
flappyGame.highScore = localStorage.getItem('retroFlappyHighScore') || 0;

// --- Sound Placeholders (Commented out if no files) ---
/*
const jumpSound = new Audio('assets/jump.wav');
const scoreSound = new Audio('assets/score.wav');
const hitSound = new Audio('assets/hit.wav');
const dieSound = new Audio('assets/die.wav');
const sunSound = new Audio('assets/sun.wav');
const plantSound = new Audio('assets/plant.wav');
const shootSound = new Audio('assets/shoot.wav');
const zombieEatSound = new Audio('assets/eat.wav');
const explosionSound = new Audio('assets/explosion.wav');
// Load sounds if needed: jumpSound.load(); etc.
*/
function playSound(soundName) {
    // console.log("Play sound:", soundName); // Placeholder
    // Example: Find the audio object and play it
    // const sound = window[soundName + 'Sound']; // Assuming global audio vars like jumpSound
    // if (sound) {
    //     sound.currentTime = 0;
    //     sound.play().catch(e => console.warn("Sound play failed:", e));
    // }
}


// --- Main Game Loop ---
function gameLoop() {
    globalFrameCounter++;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = '#ecf0f1';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    isHoveringBack = false;
    isHoveringPause = false;
    let uiClickConsumed = false; // << Flag to track if UI handled the click

    if (currentGameState !== 'MainMenu') {
         // Back Button Check
         if (mousePos.x >= backButton.x && mousePos.x <= backButton.x + backButton.width &&
             mousePos.y >= backButton.y && mousePos.y <= backButton.y + backButton.height) {
             isHoveringBack = true;
             if (isClicking) {
                 console.log("Back button clicked");
                 isPaused = false; // << Ensure unpaused when going back
                 currentGameState = 'MainMenu';
                 isClicking = false; // Consume click
                 uiClickConsumed = true;
                 // No need to return early, just prevent game update below
             }
         }
         // Pause Button Check (only check if Back wasn't clicked)
         if (!uiClickConsumed && mousePos.x >= pauseButton.x && mousePos.x <= pauseButton.x + pauseButton.width &&
             mousePos.y >= pauseButton.y && mousePos.y <= pauseButton.y + pauseButton.height) {
             isHoveringPause = true;
             if (isClicking) {
                 isPaused = !isPaused;
                 console.log("Paused toggled:", isPaused);
                 isClicking = false; // Consume click
                 uiClickConsumed = true;
             }
         }
    }

    // --- Game State Logic (Skip updates if paused OR UI consumed click) ---
    if (!isPaused && !uiClickConsumed) { // << Check uiClickConsumed
        switch (currentGameState) {
            case 'MainMenu':
                updateMainMenu();
                break;
            case 'PvZ':
                updatePvZ();
                break;
            case 'Flappy':
                updateFlappy();
                break;
            default:
                console.error("Unknown game state:", currentGameState);
                currentGameState = 'MainMenu';
        }
    }

    // --- Drawing Logic (Always draw) ---
    switch (currentGameState) {
        case 'MainMenu':
            drawMainMenu();
            break;
        case 'PvZ':
            drawPvZ();
            break;
        case 'Flappy':
            drawFlappy();
            break;
        default:
            console.error("Unknown game state:", currentGameState);
    }

    // Draw back button if not in MainMenu
    if (currentGameState !== 'MainMenu') {
        drawBackButton();
        drawPauseButton();
    }

    // Draw pause overlay if paused
    if (isPaused && currentGameState !== 'MainMenu') {
        drawPauseOverlay();
    }

    // Reset click only if it wasn't consumed by UI or game logic
    if (isClicking) {
        // This line handles cases where a click occurred but didn't hit any active element
        // console.log("Click processed but no target hit, resetting.");
        isClicking = false;
    }
    requestAnimationFrame(gameLoop);
}

// --- Loading Screen --- (Simple version)
function drawLoadingScreen(text) {
    ctx.fillStyle = '#34495e'; // Dark background
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = '#ffffff';
    ctx.font = `24px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    // Optional: Draw loading progress bar based on pvzAssetsLoadedCount / pvzTotalAssets
}


// --- Back Button ---
function drawBackButton() {
     ctx.fillStyle = isHoveringBack ? '#e74c3c' : '#c0392b'; // Red / Darker Red
     ctx.fillRect(backButton.x, backButton.y, backButton.width, backButton.height);
     ctx.fillStyle = '#ffffff';
     ctx.font = `bold 16px ${FONT_UI}`;
     ctx.textAlign = 'center';
     ctx.textBaseline = 'middle';
     ctx.fillText(backButton.text, backButton.x + backButton.width / 2, backButton.y + backButton.height / 2);
}

function drawPauseButton() {
    ctx.fillStyle = isHoveringPause ? '#f39c12' : '#e67e22'; // Orange/Darker Orange
    ctx.fillRect(pauseButton.x, pauseButton.y, pauseButton.width, pauseButton.height);
    ctx.fillStyle = '#ffffff'; ctx.font = `bold 16px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(isPaused ? 'Resume' : 'Pause', pauseButton.x + pauseButton.width / 2, pauseButton.y + pauseButton.height / 2);
}

function drawPauseOverlay() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = 'white';
    ctx.font = `bold 48px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("PAUSED", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.font = `20px ${FONT_UI}`;
    ctx.fillText("Press P or Click Resume to Continue", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
}


// --- Main Menu Logic ---
function updateMainMenu() {
    hoveredMenuItem = null;
    if (!isHoveringBack) {
        for (const item of menuItems) {
            if (mousePos.x >= item.x && mousePos.x <= item.x + item.width &&
                mousePos.y >= item.y && mousePos.y <= item.y + item.height) {
                hoveredMenuItem = item;
                if (isClicking && item.targetState) {
                    // No asset loading needed for PvZ
                    if (item.targetState === 'PvZ') initPvZ();
                    if (item.targetState === 'Flappy') initFlappy();
                    currentGameState = item.targetState;
                    isClicking = false;
                    break;
                }
            }
        }
    }
}

function drawMainMenu() {
    ctx.fillStyle = '#2c3e50'; // Dark blue title
    ctx.font = `bold 40px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.fillText('Mini Game Arcade', CANVAS_WIDTH / 2, 80);

    ctx.font = `24px ${FONT_UI}`;
    menuItems.forEach(item => { // Adjusted x-position
        item.x = (CANVAS_WIDTH - item.width) / 2;
    });
    for (const item of menuItems) {
        ctx.fillStyle = (item === hoveredMenuItem) ? '#3498db' : '#2980b9';
        ctx.fillRect(item.x, item.y, item.width, item.height);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.text, item.x + item.width / 2, item.y + item.height / 2);
    }

     ctx.fillStyle = '#7f8c8d';
     ctx.font = `16px ${FONT_UI}`;
     ctx.textAlign = 'center';
     ctx.fillText('Click an option to start!', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 50);
}


// --- Plants vs Zombies Logic (Placeholders) ---
function initPvZ() {
    console.log("Initializing PvZ State (Placeholders)...");
    pvzGame.plants = [];
    pvzGame.zombies = [];
    pvzGame.projectiles = [];
    pvzGame.suns = [];
    pvzGame.particles = []; // << Reset particles
    pvzGame.sunCount = 150;
    pvzGame.selectedPlantType = null;
    pvzGame.zombieCounters = {};
    pvzGame.nextZombieId = 0;
    pvzGame.nextPlantId = 0;
    pvzGame.waveNumber = 0;
    pvzGame.waveInProgress = false;
    pvzGame.wavesCompleted = false; // Reset flag on init
    pvzGame.zombiesRemainingInWave = 0;
    pvzGame.zombiesToSpawnInWave = 0;
    pvzGame.timeToNextWave = 300;
    pvzGame.timeToNextZombie = 0;
    pvzGame.sunSpawnTimer = 0;
    pvzGame.score = 0; // << Reset score
    console.log("initPvZ complete"); // << Added log
}

function startNextWave() {
    pvzGame.waveNumber++;
    console.log(`Attempting to start Wave ${pvzGame.waveNumber}`);
    const currentWaveIndex = pvzGame.waveNumber - 1;

    if (currentWaveIndex >= pvzGame.waveDefinition.length) {
        console.log("All defined waves completed!");
        pvzGame.waveInProgress = false;
        pvzGame.wavesCompleted = true; // Set flag here
        return; // Stop trying to define/start new waves
    }

    // If not completed, proceed to set up the wave
    console.log(`Starting Wave ${pvzGame.waveNumber}`);
    const waveData = pvzGame.waveDefinition[currentWaveIndex];
    pvzGame.zombiesToSpawnInWave = waveData.count;
    pvzGame.zombiesRemainingInWave = waveData.count;
    pvzGame.timeToNextZombie = waveData.interval;
    pvzGame.waveInProgress = true;
}

function updatePvZ() {
    console.log("updatePvZ started"); // << Added log
    // No need to check isHoveringBack/isClicking here anymore, main loop handles it

    // --- Update Particles ---
    updatePvZParticles();

    // --- Wave Management ---
    if (pvzGame.wavesCompleted) {
        // Do nothing further with waves if all are done
    } else if (!pvzGame.waveInProgress) {
        // Waiting for the next wave timer or initial delay
        pvzGame.timeToNextWave--;
        if (pvzGame.timeToNextWave <= 0) {
            startNextWave(); // Attempt to start the next wave
        }
    } else if (pvzGame.zombiesToSpawnInWave <= 0 && pvzGame.zombiesRemainingInWave <= 0) {
         // Current wave is cleared (all spawned AND defeated)
         console.log(`Wave ${pvzGame.waveNumber} cleared!`);
         pvzGame.waveInProgress = false;
         pvzGame.timeToNextWave = 600; // Set delay for the next wave attempt
         // startNextWave() will be called after delay and handle completion check
    }

    // --- Sun Spawning & Collection ---
    // Natural sun always spawns
    pvzGame.sunSpawnTimer++;
    if (pvzGame.sunSpawnTimer >= pvzGame.sunSpawnInterval) {
        pvzGame.sunSpawnTimer = 0;
        pvzGame.suns.push({
            x: Math.random() * (CANVAS_WIDTH * 0.8) + PVZ_GRID_START_X,
            y: 0, value: 25, fallSpeed: 0.5 + Math.random() * 0.5,
            angle: Math.random() * Math.PI * 2, // Random start angle
            rotationSpeed: (Math.random() - 0.5) * 0.1 // Slow random rotation
        });
    }
    // Sun from sunflowers
    pvzGame.plants.forEach(plant => {
        if (plant.type === 'sunflower') {
            plant.sunCooldown = (plant.sunCooldown || 0) + 1;
            if (plant.sunCooldown >= 600) {
                plant.sunCooldown = 0;
                pvzGame.suns.push({
                    x: PVZ_GRID_START_X + plant.col * PVZ_CELL_WIDTH + PVZ_CELL_WIDTH / 2,
                    y: PVZ_GRID_START_Y + plant.row * PVZ_CELL_HEIGHT + PVZ_CELL_HEIGHT * 0.3, // Spawn slightly lower
                    value: 25, fallSpeed: 0,
                    life: 300, angle: 0, rotationSpeed: 0 // No rotation for plant sun
                });
                 playSound('sun');
            }
        }
        // Update plant placement animation timer
        if (plant.placeAnimTimer && plant.placeAnimTimer > 0) {
            plant.placeAnimTimer--;
        }
    });
    // Update existing suns
    for (let i = pvzGame.suns.length - 1; i >= 0; i--) {
        let sun = pvzGame.suns[i];
        if (sun.fallSpeed > 0) {
             sun.y += sun.fallSpeed;
             sun.angle += sun.rotationSpeed;
             if (sun.y > PVZ_GRID_START_Y + Math.random() * (CANVAS_HEIGHT * 0.7)) {
                 sun.fallSpeed = 0;
                 sun.rotationSpeed = 0; // Stop rotation when landed
                 sun.life = 300;
             }
        } else if (sun.life !== undefined) {
             sun.life--;
             // Maybe add slight bobbing effect for plant sun?
        }

        // Collection - Check isClicking *explicitly* here
        const sunRadius = 20;
        if (isClicking && Math.hypot(mousePos.x - sun.x, mousePos.y - sun.y) < sunRadius) {
            pvzGame.sunCount += sun.value;
            playSound('sun');
            createPvZParticles(sun.x, sun.y, 8, 'rgba(255, 255, 0, 0.8)', 2, [15, 30]);
            pvzGame.suns.splice(i, 1);
            isClicking = false; // << Consume click inside PvZ logic too
            continue; // Skip removal check for this iteration
        }
        // Remove faded/fallen off screen sun
        if ((sun.life !== undefined && sun.life <= 0) || sun.y > CANVAS_HEIGHT) {
             pvzGame.suns.splice(i, 1);
        }
    }

    // --- Plant Spawning & Logic ---
    // Handle seed packet clicks - Check isClicking *explicitly*
    let clickedSeedPacket = false;
    if (isClicking) {
        plantTypes.forEach((type, index) => {
            const packetX = PVZ_GRID_START_X + index * (PVZ_SEED_PACKET_WIDTH + 10);
            const packetY = 10;
            if (mousePos.x >= packetX && mousePos.x <= packetX + PVZ_SEED_PACKET_WIDTH &&
                mousePos.y >= packetY && mousePos.y <= packetY + PVZ_SEED_PACKET_HEIGHT) {
                if (pvzGame.sunCount >= pvzGame.plantCosts[type]) {
                    pvzGame.selectedPlantType = type;
                    console.log("Selected plant:", type);
                } else {
                    console.log("Not enough sun for", type);
                    pvzGame.selectedPlantType = null;
                }
                isClicking = false; // << Consume click
                clickedSeedPacket = true;
            }
        });
    }
    // Handle grid clicks for planting - Check isClicking *explicitly*
    if (isClicking && pvzGame.selectedPlantType && !clickedSeedPacket) {
        const clickCol = Math.floor((mousePos.x - PVZ_GRID_START_X) / PVZ_CELL_WIDTH);
        const clickRow = Math.floor((mousePos.y - PVZ_GRID_START_Y) / PVZ_CELL_HEIGHT);

        if (clickCol >= 0 && clickCol < PVZ_GRID_COLS && clickRow >= 0 && clickRow < PVZ_GRID_ROWS) {
            const cellOccupied = pvzGame.plants.some(p => p.row === clickRow && p.col === clickCol);
            if (!cellOccupied) {
                console.log(`Planting ${pvzGame.selectedPlantType} at ${clickRow}, ${clickCol}`);
                pvzGame.sunCount -= pvzGame.plantCosts[pvzGame.selectedPlantType];
                const plantData = {
                    id: pvzGame.nextPlantId++, type: pvzGame.selectedPlantType,
                    row: clickRow, col: clickCol, health: pvzGame.plantHealth[pvzGame.selectedPlantType],
                    shootCooldown: 0, sunCooldown: 0, placeAnimTimer: 15,
                    explodeTimer: (pvzGame.selectedPlantType === 'cherrybomb') ? 60 : null // Start explode timer
                };
                pvzGame.plants.push(plantData);
                createPvZParticles( // << Plant placement particles
                    PVZ_GRID_START_X + clickCol * PVZ_CELL_WIDTH + PVZ_CELL_WIDTH / 2,
                    PVZ_GRID_START_Y + clickRow * PVZ_CELL_HEIGHT + PVZ_CELL_HEIGHT / 2,
                    10, 'rgba(255, 255, 255, 0.7)', 1.5, [10, 20]
                );
                playSound('plant');
                pvzGame.selectedPlantType = null;
                isClicking = false; // << Consume click
            } else {
                 console.log("Cell occupied");
                 pvzGame.selectedPlantType = null;
                 // Don't consume click if cell is occupied, allows deselecting
            }
        } else {
            pvzGame.selectedPlantType = null; // Clicked outside grid, deselect
             // Don't consume click, allows clicking UI later
        }
    } else if (isClicking && !clickedSeedPacket) {
        // Clicked somewhere else (not seed packet, not grid while planting) - Deselect plant
        pvzGame.selectedPlantType = null;
        // Generally, don't consume the click here either, might be UI later
    }

    // Plant actions (Shooting - only peashooter)
    pvzGame.plants.forEach(plant => {
        if (plant.type === 'peashooter') {
            plant.shootCooldown = (plant.shootCooldown || 0) + 1;
            const zombieInRow = pvzGame.zombies.some(z => z.row === plant.row && z.x < CANVAS_WIDTH - 50);
            if (zombieInRow && plant.shootCooldown >= 90) {
                plant.shootCooldown = 0;
                pvzGame.projectiles.push({
                    x: PVZ_GRID_START_X + (plant.col + 0.7) * PVZ_CELL_WIDTH,
                    y: PVZ_GRID_START_Y + (plant.row + 0.5) * PVZ_CELL_HEIGHT,
                    row: plant.row
                });
                playSound('shoot');
            }
        }
    });

    // --- Projectile Logic (Collision checks health based on zombie type) ---
    for (let i = pvzGame.projectiles.length - 1; i >= 0; i--) {
        let p = pvzGame.projectiles[i];
        p.x += 4;
        if (p.x > CANVAS_WIDTH) {
            pvzGame.projectiles.splice(i, 1);
            continue;
        }
        for (let j = pvzGame.zombies.length - 1; j >= 0; j--) {
            let z = pvzGame.zombies[j];
            if (z.row === p.row) {
                 const zombieLeft = z.x;
                 const zombieRight = z.x + PVZ_CELL_WIDTH * 0.6;
                 const projTip = p.x + 10;
                 if (projTip >= zombieLeft && p.x < zombieRight) {
                     z.health -= 25;
                     createPvZParticles(p.x, p.y, 5, 'rgba(0, 0, 0, 0.5)', 1, [5, 15]); // << Hit particles
                     pvzGame.projectiles.splice(i, 1);
                     console.log(`Zombie ${z.id} (${z.type}) hit! Health:`, z.health);
                     if (z.health <= 0) {
                          delete pvzGame.zombieCounters[z.id];
                          pvzGame.zombies.splice(j, 1);
                          pvzGame.zombiesRemainingInWave--; // Decrement wave counter
                          console.log(`Zombie ${z.id} defeated! Remaining in wave: ${pvzGame.zombiesRemainingInWave}`);
                          pvzGame.score += 10; // << Add score
                     }
                     break;
                 }
            }
        }
    }


    // --- Zombie Spawning (Wave Based) ---
    if (pvzGame.waveInProgress && pvzGame.zombiesToSpawnInWave > 0) {
        pvzGame.timeToNextZombie--;
        if (pvzGame.timeToNextZombie <= 0) {
            const currentWaveIndex = pvzGame.waveNumber - 1;
            const waveData = pvzGame.waveDefinition[currentWaveIndex];
            // Reset timer for next zombie in wave
            pvzGame.timeToNextZombie = waveData.interval;
            pvzGame.zombiesToSpawnInWave--;

            // Spawn logic
            const spawnRow = Math.floor(Math.random() * PVZ_GRID_ROWS);
            // Choose type based on wave definition
            const possibleTypes = waveData.types;
            const zombieType = possibleTypes[Math.floor(Math.random() * possibleTypes.length)];

            const newZombie = {
                id: pvzGame.nextZombieId++,
                type: zombieType,
                row: spawnRow,
                x: CANVAS_WIDTH,
                health: pvzGame.zombieHealth[zombieType],
                speed: (zombieType === 'conehead' ? 0.25 : 0.3) + Math.random() * 0.15,
                isEating: false,
            };
            pvzGame.zombies.push(newZombie);
            pvzGame.zombieCounters[newZombie.id] = 0;
            console.log(`${zombieType} zombie spawned (Wave ${pvzGame.waveNumber}, ${pvzGame.zombiesToSpawnInWave} left to spawn)`);
        }
    }

    // Update Zombies
    for (let i = pvzGame.zombies.length - 1; i >= 0; i--) {
        let z = pvzGame.zombies[i];
        z.isEating = false; // Assume not eating unless proven otherwise

        // Check for plants in front
        let plantToEat = null;
        for (let j = pvzGame.plants.length - 1; j >= 0; j--) {
             let plant = pvzGame.plants[j];
             if (plant.row === z.row) {
                  const plantRightEdge = PVZ_GRID_START_X + (plant.col + 1) * PVZ_CELL_WIDTH;
                  const zombieLeftEdge = z.x;
                  // Check if zombie hitbox overlaps plant hitbox slightly
                  if (zombieLeftEdge <= plantRightEdge - PVZ_CELL_WIDTH * 0.1 && zombieLeftEdge > plantRightEdge - PVZ_CELL_WIDTH * 1.1) {
                      plantToEat = plant;
                      break;
                  }
             }
        }

        if (plantToEat) {
            z.isEating = true;
            pvzGame.zombieCounters[z.id]++;
            if (pvzGame.zombieCounters[z.id] >= pvzGame.zombieEatInterval) {
                 pvzGame.zombieCounters[z.id] = 0;
                 // Use zombie-specific damage if needed in future
                 plantToEat.health -= pvzGame.zombieDamage[z.type] || 10;
                 playSound('zombieEat');
                 console.log(`Plant ${plantToEat.id} health:`, plantToEat.health);
                 if (plantToEat.health <= 0) {
                     // Find index and remove plant
                     const plantIndex = pvzGame.plants.findIndex(p => p.id === plantToEat.id);
                     if (plantIndex > -1) {
                         pvzGame.plants.splice(plantIndex, 1);
                         console.log(`Plant ${plantToEat.id} (${plantToEat.type}) eaten!`);
                     }
                 }
            }
        } else {
            // Move and Animate if not eating
            z.isEating = false;
            z.x -= z.speed;
            pvzGame.zombieCounters[z.id] = 0;
        }

        // Check if zombie reached the house (game over condition)
        if (z.x < PVZ_GRID_START_X - 30) {
            console.log("GAME OVER - Zombie reached house!");
            // Simple game over: go back to menu
            currentGameState = 'MainMenu';
            // Optionally show a game over message first
            return;
        }
    }
}

function drawPvZ() {
    console.log("drawPvZ started"); // << Added log
    // Draw Background (simple color or image later)
    ctx.fillStyle = '#5c3e30'; // Brownish soil color
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Grid Lines
    ctx.strokeStyle = PVZ_GRID_COLOR;
    ctx.lineWidth = 1;
    for (let row = 0; row < PVZ_GRID_ROWS; row++) {
        for (let col = 0; col < PVZ_GRID_COLS; col++) {
            const x = PVZ_GRID_START_X + col * PVZ_CELL_WIDTH;
            const y = PVZ_GRID_START_Y + row * PVZ_CELL_HEIGHT;
            ctx.strokeRect(x, y, PVZ_CELL_WIDTH, PVZ_CELL_HEIGHT);
        }
    }
    console.log("drawPvZ grid drawn"); // << Added log

    // Draw Particles FIRST (behind other elements)
    drawPvZParticles();

    // Draw Plants (Placeholders with animation effects)
    pvzGame.plants.forEach(plant => {
        const x = PVZ_GRID_START_X + plant.col * PVZ_CELL_WIDTH + PVZ_CELL_WIDTH * 0.5;
        const y = PVZ_GRID_START_Y + plant.row * PVZ_CELL_HEIGHT + PVZ_CELL_HEIGHT * 0.5;
        let radius = PVZ_CELL_WIDTH * 0.35;

        // Placement Animation
        if (plant.placeAnimTimer && plant.placeAnimTimer > 0) {
            const t = plant.placeAnimTimer / 15; // Normalized time 1 -> 0
            const scaleFactor = 1 + Math.sin(t * Math.PI) * 0.3; // Smooth pop
            radius *= scaleFactor;
        }

        // Sunflower Pulse
        if (plant.type === 'sunflower' && plant.sunCooldown >= 550 && !isPaused) {
            const pulseFactor = 1 + Math.sin(globalFrameCounter * 0.2) * 0.1;
            radius *= pulseFactor;
        }

        // Cherry Bomb Pulse/Fuse
        if (plant.type === 'cherrybomb' && plant.explodeTimer !== null) {
             const pulseFactor = 1 + Math.sin(globalFrameCounter * 0.3) * 0.15;
             radius *= pulseFactor;
             // Draw fuse?
             ctx.strokeStyle = 'black'; ctx.lineWidth = 2;
             ctx.beginPath(); ctx.moveTo(x, y - radius); ctx.lineTo(x + 5, y - radius - 10); ctx.stroke();
             ctx.fillStyle = 'yellow'; ctx.fillRect(x+3, y - radius - 12, 4, 4);
             ctx.lineWidth = 1;
        }

        // Set color
        switch(plant.type) {
            case 'peashooter': ctx.fillStyle = PVZ_PLANT_COLOR; break;
            case 'sunflower': ctx.fillStyle = PVZ_SUNFLOWER_COLOR; break;
            case 'wallnut': ctx.fillStyle = PVZ_WALLNUT_COLOR; break;
            case 'cherrybomb': ctx.fillStyle = PVZ_CHERRYBOMB_COLOR; break;
            default: ctx.fillStyle = '#ffffff';
        }

        // Draw main body
        ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();

        // Add Peashooter 'barrel'
        if (plant.type === 'peashooter') {
             ctx.fillStyle = '#1a5d2b'; // Darker green
             ctx.fillRect(x + radius * 0.6, y - radius * 0.2, radius * 0.6, radius * 0.4);
        }

        // Wallnut border
        if (plant.type === 'wallnut') {
            ctx.strokeStyle = '#694518'; ctx.lineWidth = 3;
            ctx.stroke(); // Stroke the existing arc path
            ctx.lineWidth = 1;
        }

        // Health bar
        const maxHealth = pvzGame.plantHealth[plant.type];
        if (plant.health < maxHealth) {
             ctx.fillStyle = 'red';
             ctx.fillRect(x - radius, y - radius - 10, radius * 2, 6);
             ctx.fillStyle = 'lime';
             ctx.fillRect(x - radius, y - radius - 10, radius * 2 * (plant.health / maxHealth), 6);
        }
    });

    // Draw Zombies (Placeholders with slight refinement)
    pvzGame.zombies.forEach(zombie => {
        const yBody = PVZ_GRID_START_Y + zombie.row * PVZ_CELL_HEIGHT + PVZ_CELL_HEIGHT * 0.1;
        const sizeW = PVZ_CELL_WIDTH * 0.6;
        const sizeH = PVZ_CELL_HEIGHT * 0.8;
        const healthRatio = zombie.health / pvzGame.zombieHealth[zombie.type];
        // Body
        ctx.fillStyle = PVZ_ZOMBIE_COLOR;
        ctx.fillRect(zombie.x, yBody, sizeW, sizeH);
        // Simple 'arms' - oscillate based on x position for basic walk feel
        const armOffsetY = Math.sin(zombie.x * 0.1) * 5;
        ctx.fillStyle = '#7f8c8d'; // Slightly different grey
        ctx.fillRect(zombie.x - sizeW * 0.15, yBody + sizeH * 0.3 + armOffsetY, sizeW * 0.15, sizeH * 0.15);
        ctx.fillRect(zombie.x + sizeW, yBody + sizeH * 0.3 - armOffsetY, sizeW * 0.15, sizeH * 0.15);

        // Cone
        if (zombie.type === 'conehead') {
             ctx.fillStyle = PVZ_CONE_COLOR;
             ctx.beginPath();
             ctx.moveTo(zombie.x + sizeW * 0.1, yBody + sizeH * 0.1);
             ctx.lineTo(zombie.x + sizeW * 0.9, yBody + sizeH * 0.1);
             ctx.lineTo(zombie.x + sizeW * 0.5, yBody - sizeH * 0.3);
             ctx.closePath(); ctx.fill();
        }
        // Health bar
         if (healthRatio < 1) {
             ctx.fillStyle = 'red';
             ctx.fillRect(zombie.x, yBody - 10, sizeW, 6);
             ctx.fillStyle = 'lime';
             ctx.fillRect(zombie.x, yBody - 10, sizeW * healthRatio, 6);
        }
    });

    // Draw Projectiles (Placeholder with pulse)
    ctx.fillStyle = PVZ_PROJECTILE_COLOR;
    pvzGame.projectiles.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
    });

    // Draw Suns (Placeholder with rotation)
    pvzGame.suns.forEach(sun => {
        const radius = 20;
        ctx.save(); // Save context for rotation
        ctx.translate(sun.x, sun.y); // Move origin to sun center
        ctx.rotate(sun.angle);
        ctx.fillStyle = PVZ_SUN_COLOR;
        ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
        // Draw some 'rays' or details
        ctx.fillStyle = 'rgba(255, 255, 100, 0.7)';
        for (let i = 0; i < 8; i++) { // Draw 8 rays
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(radius * 0.6, -radius * 0.1, radius * 0.8, radius * 0.2);
        }
        ctx.restore(); // Restore context
    });

    console.log("drawPvZ drawing UI"); // << Added log
    // Draw UI (Seed Packets - Placeholders)
    ctx.fillStyle = PVZ_UI_BG_COLOR;
    ctx.fillRect(0, 0, CANVAS_WIDTH, PVZ_GRID_START_Y * 0.8);

    plantTypes.forEach((type, index) => {
        const packetX = PVZ_GRID_START_X + index * (PVZ_SEED_PACKET_WIDTH + 10);
        const packetY = 10;
        const cost = pvzGame.plantCosts[type];
        const isAffordable = pvzGame.sunCount >= cost;
        const isSelected = pvzGame.selectedPlantType === type;

        // Packet background
        ctx.fillStyle = '#8a6d3b';
        ctx.fillRect(packetX, packetY, PVZ_SEED_PACKET_WIDTH, PVZ_SEED_PACKET_HEIGHT);

        ctx.globalAlpha = isAffordable ? 1.0 : 0.5;
        if (isSelected) {
             ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
             ctx.strokeRect(packetX - 1, packetY - 1, PVZ_SEED_PACKET_WIDTH + 2, PVZ_SEED_PACKET_HEIGHT + 2);
        }

        // Draw plant placeholder color inside packet
        const plantRadius = PVZ_SEED_PACKET_WIDTH * 0.3;
        const plantX = packetX + PVZ_SEED_PACKET_WIDTH / 2;
        const plantY = packetY + PVZ_SEED_PACKET_HEIGHT * 0.4;
        switch(type) {
            case 'peashooter': ctx.fillStyle = PVZ_PLANT_COLOR; break;
            case 'sunflower': ctx.fillStyle = PVZ_SUNFLOWER_COLOR; break;
            case 'wallnut': ctx.fillStyle = PVZ_WALLNUT_COLOR; break;
            case 'cherrybomb': ctx.fillStyle = PVZ_CHERRYBOMB_COLOR; break;
            default: ctx.fillStyle = '#cccccc';
        }
        ctx.beginPath(); ctx.arc(plantX, plantY, plantRadius, 0, Math.PI * 2); ctx.fill();
        if (type === 'wallnut') { // Add border for wallnut placeholder in UI too
             ctx.strokeStyle = '#694518'; ctx.lineWidth = 2;
             ctx.stroke(); ctx.lineWidth = 1;
        }
        if (type === 'cherrybomb') { // Add fuse to packet too
             ctx.strokeStyle = 'black'; ctx.lineWidth = 1;
             ctx.beginPath(); ctx.moveTo(plantX, plantY - plantRadius); ctx.lineTo(plantX + 3, plantY - plantRadius - 6); ctx.stroke();
        }

        // Draw cost text
        ctx.fillStyle = '#000000'; ctx.textAlign = 'center';
        ctx.font = `bold 14px ${FONT_UI}`;
        ctx.fillText(cost, packetX + PVZ_SEED_PACKET_WIDTH / 2, packetY + PVZ_SEED_PACKET_HEIGHT - 15);

        ctx.globalAlpha = 1.0; ctx.lineWidth = 1;
    });

    // Draw Sun Count
    ctx.fillStyle = '#000000'; ctx.font = `bold 24px ${FONT_UI}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`☀️ ${pvzGame.sunCount}`, PVZ_GRID_START_X + plantTypes.length * (PVZ_SEED_PACKET_WIDTH + 10) + 20, 10 + PVZ_SEED_PACKET_HEIGHT / 2);

    // Draw Score
    ctx.font = `bold 18px ${FONT_UI}`;
    ctx.fillText(`Score: ${pvzGame.score}`, PVZ_GRID_START_X + plantTypes.length * (PVZ_SEED_PACKET_WIDTH + 10) + 20, 10 + PVZ_SEED_PACKET_HEIGHT / 2 + 25);

    // Draw Wave Counter / Status
    ctx.fillStyle = '#000000';
    ctx.font = `bold 18px ${FONT_UI}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    let waveText = "Preparing...";
    if (pvzGame.wavesCompleted) {
        waveText = "All Waves Cleared!"; // Final message
    } else if (pvzGame.waveInProgress) {
        waveText = `Wave: ${pvzGame.waveNumber}`;
    } else if (pvzGame.waveNumber > 0) {
        waveText = `Wave ${pvzGame.waveNumber} Cleared!`;
    }
    ctx.fillText(waveText, CANVAS_WIDTH - 15, 15);

    console.log("drawPvZ UI drawn"); // << Added log

    // Add You Win message overlay if waves are completed
    if (pvzGame.wavesCompleted) {
         ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
         ctx.fillRect(0, CANVAS_HEIGHT / 3, CANVAS_WIDTH, CANVAS_HEIGHT / 3);
         ctx.fillStyle = 'lime';
         ctx.font = `bold 48px ${FONT_UI}`;
         ctx.textAlign = 'center';
         ctx.textBaseline = 'middle';
         ctx.fillText("YOU SURVIVED!", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }
}


// --- Flappy Bird Logic (Encapsulated) ---
function initFlappy() {
    if (flappyGame.initialized) {
        resetFlappy(); // Reset if already initialized before
    } else {
        console.log("Initializing Flappy State...");
        flappyGame.highScore = localStorage.getItem('retroFlappyHighScore') || 0;
        resetFlappy(); // Initial reset
        flappyGame.initialized = true;
    }
    flappyGame.internalState = 'Start'; // Ensure starts at the beginning
}

function updateFlappy() {
    if (isHoveringBack && isClicking) return; // Handled in main loop

    const state = flappyGame.internalState;
    const bird = flappyGame.bird;

    // Flappy's internal game state updates
    if (state === 'Playing') {
        updateFlappyBirdPhysics();
        updateFlappyPipes();
        updateFlappyParticles();
    } else if (state === 'GetReady') {
        updateFlappyBirdPhysics(); // Bird bobs
        updateFlappyParticles();
    } else if (state === 'GameOver') {
        updateFlappyBirdPhysics(); // Bird falls
        updateFlappyParticles();
    } else { // 'Start' state
        updateFlappyParticles();
    }
}

function handleFlappyInput() {
     switch (flappyGame.internalState) {
        case 'Start':
            flappyGame.internalState = 'GetReady';
            resetFlappyGameData(); // Resets bird pos, pipes, score etc.
            break;
        case 'GetReady':
            flappyBirdJump(); // First jump starts 'Playing'
            flappyGame.internalState = 'Playing';
            flappyGame.frame = 0; // Start frame count for pipes
            spawnFlappyPipe(); // Spawn first pipe
            break;
        case 'Playing':
            flappyBirdJump();
            break;
        case 'GameOver':
            flappyGame.internalState = 'Start'; // Go back to flappy start screen
             // High score is already saved, just reset data
            resetFlappyGameData();
            break;
    }
}

function resetFlappyGameData() {
    const bird = flappyGame.bird;
    bird.y = CANVAS_HEIGHT / 2 - bird.height / 2;
    bird.velocityY = 0;
    bird.rotation = 0;
    bird.scaleX = 1; bird.scaleY = 1; bird.isJumping = false;
    flappyGame.pipes = [];
    flappyGame.particles = [];
    flappyGame.score = 0;
    flappyGame.gameSpeed = flappyGame.BASE_GAME_SPEED;
    flappyGame.lastPipeTopHeight = null;
    console.log("Flappy game internals reset");
}

function resetFlappy() {
    // Complete reset including internal state for re-entry
    resetFlappyGameData();
    flappyGame.internalState = 'Start';
}

function updateFlappyBirdPhysics() {
    const bird = flappyGame.bird;
    const state = flappyGame.internalState;
    const floorY = CANVAS_HEIGHT - flappyGame.FLOOR_HEIGHT;

    if (state === 'Playing' || state === 'GetReady' || (state === 'GameOver' && bird.y + bird.height < floorY)) {
        bird.velocityY += flappyGame.GRAVITY;
        bird.y += bird.velocityY;
    }

    // Ground collision
    if (state !== 'GameOver' && bird.y + bird.height >= floorY) {
        bird.y = floorY - bird.height;
        bird.velocityY = 0;
        bird.scaleY = 1; bird.scaleX = 1;
        if (state === 'Playing') {
            endFlappyGame(true); // Ground hit
        }
    }
    // Ceiling collision
    if (bird.y < 0) {
        bird.y = 0;
        bird.velocityY = 0;
    }
}

function updateFlappyPipes() {
    if (flappyGame.internalState !== 'Playing') return;

    flappyGame.gameSpeed = flappyGame.BASE_GAME_SPEED + flappyGame.score * flappyGame.SPEED_INCREASE_FACTOR;

    for (let i = flappyGame.pipes.length - 1; i >= 0; i--) {
        let pipe = flappyGame.pipes[i];
        pipe.x -= flappyGame.gameSpeed;

        // Collision
        const bird = flappyGame.bird;
        const birdLeft = bird.x; const birdRight = bird.x + bird.width;
        const birdTop = bird.y; const birdBottom = bird.y + bird.height;
        const pipeLeft = pipe.x; const pipeRight = pipe.x + flappyGame.PIPE_WIDTH;
        const topPipeBottom = pipe.topHeight; const bottomPipeTop = pipe.bottomY;

        if (birdRight > pipeLeft && birdLeft < pipeRight && (birdTop < topPipeBottom || birdBottom > bottomPipeTop)) {
            endFlappyGame(false); // Pipe hit
            return; // Stop checking after hit
        }

        // Score
        if (!pipe.passed && birdLeft > pipeRight) {
            flappyGame.score++;
            pipe.passed = true;
            playSound('score');
        }

        // Remove off-screen pipes
        if (pipe.x + flappyGame.PIPE_WIDTH < 0) {
            flappyGame.pipes.splice(i, 1);
        }
    }

    // Spawn new pipes
    flappyGame.frame++;
    if (flappyGame.frame % flappyGame.PIPE_SPAWN_RATE === 0) {
        spawnFlappyPipe();
    }
}

function spawnFlappyPipe() {
    const bird = flappyGame.bird;
    const pipeGap = flappyGame.PIPE_GAP;
    const minGap = bird.height * 6;
    const effectiveGap = Math.max(pipeGap, minGap);
    const minEdgeMargin = 80;
    const floorHeight = flappyGame.FLOOR_HEIGHT;

    const absoluteMinY = minEdgeMargin;
    const absoluteMaxY = CANVAS_HEIGHT - floorHeight - effectiveGap - minEdgeMargin;

    let relativeMinY = absoluteMinY;
    let relativeMaxY = absoluteMaxY;
    if (flappyGame.lastPipeTopHeight !== null) {
        relativeMinY = Math.max(absoluteMinY, flappyGame.lastPipeTopHeight - flappyGame.MAX_VERTICAL_PIPE_SHIFT);
        relativeMaxY = Math.min(absoluteMaxY, flappyGame.lastPipeTopHeight + flappyGame.MAX_VERTICAL_PIPE_SHIFT);
    }

    if (relativeMaxY <= relativeMinY) {
        relativeMinY = absoluteMinY; // Fallback to full range if constraints conflict
        relativeMaxY = absoluteMaxY;
        console.warn("Flappy pipe shift conflict, using full range.");
    }
     if (relativeMaxY <= relativeMinY) { // Final check
        console.error("Cannot determine valid Flappy spawn range. Spawning centered fallback.");
        const safeTopHeight = Math.max(absoluteMinY, (CANVAS_HEIGHT - floorHeight - effectiveGap) / 2);
        const safeBottomY = safeTopHeight + effectiveGap;
         flappyGame.pipes.push({ x: CANVAS_WIDTH, topHeight: safeTopHeight, bottomY: safeBottomY, passed: false });
         flappyGame.lastPipeTopHeight = safeTopHeight;
         return;
    }

    const topPipeHeight = Math.random() * (relativeMaxY - relativeMinY) + relativeMinY;
    const bottomPipeTopY = topPipeHeight + effectiveGap;

    flappyGame.pipes.push({
        x: CANVAS_WIDTH, topHeight: topPipeHeight, bottomY: bottomPipeTopY, passed: false
    });
    flappyGame.lastPipeTopHeight = topPipeHeight;
}


function updateFlappyParticles() {
     for (let i = flappyGame.particles.length - 1; i >= 0; i--) {
        let p = flappyGame.particles[i];
        p.x += p.speedX; p.y += p.speedY;
        p.speedY += 0.1; p.life--;
        if (p.life <= 0) flappyGame.particles.splice(i, 1);
    }
}

function createFlappyJumpParticles() {
    const bird = flappyGame.bird;
     for (let i = 0; i < 5; i++) {
        flappyGame.particles.push({
            x: bird.x + bird.width / 2, y: bird.y + bird.height / 2,
            size: Math.random() * 3 + 1, speedX: (Math.random() - 0.5) * 2,
            speedY: Math.random() * -2 - 1, life: 30
        });
    }
}

function flappyBirdJump() {
     if (flappyGame.internalState === 'Playing' || flappyGame.internalState === 'GetReady') {
        const bird = flappyGame.bird;
        bird.velocityY = flappyGame.JUMP_STRENGTH;
        bird.rotation = -30;
        bird.isJumping = true;
        playSound('jump');
        createFlappyJumpParticles();
    }
}

function endFlappyGame(hitGround) {
    if (flappyGame.internalState === 'Playing') {
        flappyGame.internalState = 'GameOver';
        playSound('hit');
        if (!hitGround) {
            setTimeout(() => playSound('die'), 200);
        }
        if (flappyGame.score > flappyGame.highScore) {
            flappyGame.highScore = flappyGame.score;
            localStorage.setItem('retroFlappyHighScore', flappyGame.highScore);
            console.log("Flappy New High Score!", flappyGame.highScore);
        }
        console.log("Flappy Game Over");
    }
}

function drawFlappy() {
    // Draw Flappy elements using flappyGame state and constants
    // Background
    ctx.fillStyle = flappyGame.COLOR_SKY;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Pipes
    ctx.fillStyle = flappyGame.COLOR_PIPE;
    ctx.strokeStyle = flappyGame.COLOR_PIPE_BORDER;
    ctx.lineWidth = 3;
    flappyGame.pipes.forEach(pipe => {
        ctx.fillRect(pipe.x, 0, flappyGame.PIPE_WIDTH, pipe.topHeight);
        ctx.strokeRect(pipe.x, 0, flappyGame.PIPE_WIDTH, pipe.topHeight);
        const bottomPipeHeight = CANVAS_HEIGHT - pipe.bottomY - flappyGame.FLOOR_HEIGHT;
        ctx.fillRect(pipe.x, pipe.bottomY, flappyGame.PIPE_WIDTH, bottomPipeHeight);
        ctx.strokeRect(pipe.x, pipe.bottomY, flappyGame.PIPE_WIDTH, bottomPipeHeight);
    });

    // Floor
    ctx.fillStyle = flappyGame.COLOR_FLOOR;
    ctx.fillRect(0, CANVAS_HEIGHT - flappyGame.FLOOR_HEIGHT, CANVAS_WIDTH, flappyGame.FLOOR_HEIGHT);
    ctx.fillStyle = flappyGame.COLOR_TEXT_OUTLINE;
    ctx.fillRect(0, CANVAS_HEIGHT - flappyGame.FLOOR_HEIGHT, CANVAS_WIDTH, 3);

    // Particles
    ctx.fillStyle = flappyGame.COLOR_PARTICLE;
    flappyGame.particles.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    });

    // Bird
    drawFlappyBird(); // Separate bird drawing function

    // Score
    ctx.fillStyle = flappyGame.COLOR_TEXT;
    ctx.strokeStyle = flappyGame.COLOR_TEXT_OUTLINE;
    ctx.lineWidth = 4;
    ctx.font = `40px ${FONT_RETRO}`;
    ctx.textAlign = 'center';
    if (flappyGame.internalState === 'Playing' || flappyGame.internalState === 'GameOver' || flappyGame.internalState === 'GetReady') {
        ctx.strokeText(`${flappyGame.score}`, CANVAS_WIDTH / 2, 70);
        ctx.fillText(`${flappyGame.score}`, CANVAS_WIDTH / 2, 70);
    }
    // High Score
    ctx.font = `20px ${FONT_RETRO}`;
    ctx.textAlign = 'right';
    ctx.strokeText(`HI: ${flappyGame.highScore}`, CANVAS_WIDTH - 20, 40);
    ctx.fillText(`HI: ${flappyGame.highScore}`, CANVAS_WIDTH - 20, 40);
    ctx.textAlign = 'left'; // Reset

    // State Messages
    if (flappyGame.internalState === 'Start') drawFlappyStartMessage();
    else if (flappyGame.internalState === 'GetReady') drawFlappyGetReadyMessage();
    else if (flappyGame.internalState === 'GameOver') drawFlappyGameOverMessage();
}

function drawFlappyBird() {
    const bird = flappyGame.bird;
    ctx.save();
    ctx.translate(bird.x + bird.width / 2, bird.y + bird.height / 2);

    let targetRotation = 0;
    if (flappyGame.internalState === 'Playing' || flappyGame.internalState === 'GetReady') {
       targetRotation = Math.max(-30, Math.min(90, bird.velocityY * 6));
    } else if (flappyGame.internalState === 'GameOver') { targetRotation = 90; }
    bird.rotation += (targetRotation - bird.rotation) * 0.15;
    ctx.rotate(bird.rotation * Math.PI / 180);

    if (bird.isJumping) {
        bird.scaleY = 1.3; bird.scaleX = 0.8; bird.isJumping = false;
    } else {
        bird.scaleY += (1 - bird.scaleY) * 0.2; bird.scaleX += (1 - bird.scaleX) * 0.2;
    }
    ctx.scale(bird.scaleX, bird.scaleY);

    ctx.fillStyle = flappyGame.COLOR_BIRD;
    ctx.fillRect(-bird.width / 2, -bird.height / 2, bird.width, bird.height);
    ctx.strokeStyle = flappyGame.COLOR_TEXT_OUTLINE;
    ctx.lineWidth = 2;
    ctx.strokeRect(-bird.width / 2, -bird.height / 2, bird.width, bird.height);

    ctx.restore();
}

function drawFlappyStartMessage() {
    ctx.fillStyle = flappyGame.COLOR_TEXT; ctx.strokeStyle = flappyGame.COLOR_TEXT_OUTLINE;
    ctx.lineWidth = 3; ctx.font = `50px ${FONT_RETRO}`; ctx.textAlign = 'center';
    const title = 'Retro Flappy';
    ctx.strokeText(title, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 3);
    ctx.fillText(title, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 3);

    ctx.font = `25px ${FONT_RETRO}`; const prompt = 'Click / Space / ArrowUp';
    ctx.strokeText(prompt, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.fillText(prompt, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

    ctx.font = `30px ${FONT_RETRO}`;
    ctx.strokeText(`High Score: ${flappyGame.highScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);
    ctx.fillText(`High Score: ${flappyGame.highScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);
    ctx.textAlign = 'left'; ctx.lineWidth = 1;
}

function drawFlappyGetReadyMessage() {
    ctx.fillStyle = flappyGame.COLOR_TEXT; ctx.strokeStyle = flappyGame.COLOR_TEXT_OUTLINE;
    ctx.lineWidth = 3; ctx.font = `50px ${FONT_RETRO}`; ctx.textAlign = 'center';
    const readyText = 'Get Ready!';
    ctx.strokeText(readyText, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 3);
    ctx.fillText(readyText, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 3);
    ctx.textAlign = 'left'; ctx.lineWidth = 1;
}

function drawFlappyGameOverMessage() {
    ctx.fillStyle = flappyGame.COLOR_GAMEOVER_BG;
    let boxY = CANVAS_HEIGHT * 0.2; let boxHeight = CANVAS_HEIGHT * 0.6;
    ctx.fillRect(CANVAS_WIDTH * 0.1, boxY, CANVAS_WIDTH * 0.8, boxHeight);

    ctx.fillStyle = flappyGame.COLOR_GAMEOVER_TEXT; ctx.font = `45px ${FONT_RETRO}`; ctx.textAlign = 'center';
    ctx.fillText('Game Over!', CANVAS_WIDTH / 2, boxY + 80);

    ctx.fillStyle = flappyGame.COLOR_TEXT; ctx.font = `35px ${FONT_RETRO}`;
    ctx.fillText(`Score: ${flappyGame.score}`, CANVAS_WIDTH / 2, boxY + 150);

    if (flappyGame.score >= flappyGame.highScore) { // Use >= for edge case of 0 HS
        ctx.font = `25px ${FONT_RETRO}`; ctx.fillStyle = '#ffd700';
        ctx.fillText('New High Score!', CANVAS_WIDTH / 2, boxY + 190);
    } else {
        ctx.font = `25px ${FONT_RETRO}`; ctx.fillStyle = flappyGame.COLOR_TEXT;
        ctx.fillText(`High Score: ${flappyGame.highScore}`, CANVAS_WIDTH / 2, boxY + 190);
    }

    ctx.fillStyle = flappyGame.COLOR_TEXT; // Reset
    let medal = " ";
    if (flappyGame.score >= 30) medal = "Gold";
    else if (flappyGame.score >= 20) medal = "Silver";
    else if (flappyGame.score >= 10) medal = "Bronze";
    if (medal !== " ") {
         ctx.font = `30px ${FONT_RETRO}`;
         ctx.fillText(`Medal: ${medal}`, CANVAS_WIDTH / 2, boxY + 240);
    }

    ctx.font = `20px ${FONT_RETRO}`;
    ctx.fillText('Click / Space / ArrowUp to Retry', CANVAS_WIDTH / 2, boxY + boxHeight - 50);
    ctx.textAlign = 'left';
}


// --- Event Listeners ---
function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}

canvas.addEventListener('mousemove', (evt) => {
    mousePos = getMousePos(canvas, evt);
});

canvas.addEventListener('mousedown', (evt) => {
    isClicking = true;
    // Click handling is done within the update functions based on currentGameState
    // or in the main loop for the back button.
});

document.addEventListener('keydown', (event) => {
    keysPressed[event.code] = true;
    // Toggle Pause
    if (event.code === 'KeyP' && currentGameState !== 'MainMenu') {
        isPaused = !isPaused;
        console.log("Paused:", isPaused);
    }
    // Flappy Bird specific input (only when not paused)
    if (!isPaused && currentGameState === 'Flappy' && (event.code === 'Space' || event.code === 'ArrowUp')) {
        event.preventDefault();
        handleFlappyInput();
    }
});

document.addEventListener('keyup', (event) => {
    keysPressed[event.code] = false;
});

// Prevent dragging from selecting text
canvas.addEventListener('selectstart', (e) => {
    e.preventDefault();
});

// --- Initial Setup ---
console.log("Initializing Mini Game Arcade...");
currentGameState = 'MainMenu';
gameLoop(); // Start the main animation loop 