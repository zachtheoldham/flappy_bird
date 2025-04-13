// --- PvZ Specific Constants ---
const PVZ_GRID_COLS = 9;
const PVZ_GRID_ROWS = 5;
// Calculate dimensions based on global CANVAS variables (assuming they exist)
const PVZ_CELL_WIDTH = () => CANVAS_WIDTH * 0.8 / PVZ_GRID_COLS;
const PVZ_CELL_HEIGHT = () => CANVAS_HEIGHT * 0.7 / PVZ_GRID_ROWS;
const PVZ_GRID_START_X = () => CANVAS_WIDTH * 0.1;
const PVZ_GRID_START_Y = () => CANVAS_HEIGHT * 0.15;
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

// --- PvZ Asset Placeholders (Placeholder) ---
let pvzAssets = {
    // Plants
    peashooter: { img: null, path: 'assets/pvz/peashooter.png', loaded: false }, // Use null img initially
    sunflower: { img: null, path: 'assets/pvz/sunflower.png', loaded: false },
    wallnut: { img: null, path: 'assets/pvz/wallnut.png', loaded: false },
    // Zombies (Sprite Sheets)
    zombie_basic_walk: { img: null, path: 'assets/pvz/zombie_basic_walk.png', loaded: false, frameWidth: 60, frameHeight: 90, frameCount: 4 },
    zombie_conehead_walk: { img: null, path: 'assets/pvz/zombie_conehead_walk.png', loaded: false, frameWidth: 60, frameHeight: 100, frameCount: 4 },
    // Projectiles
    pea: { img: null, path: 'assets/pvz/pea.png', loaded: false },
    // Collectibles
    sun: { img: null, path: 'assets/pvz/sun.png', loaded: false },
};
let pvzAssetsLoadedCount = 0;
let pvzTotalAssets = Object.keys(pvzAssets).length;
let pvzAssetsLoaded = false; // Keep this flag, might be used by loading screen logic

function loadPvZAssets() {
    // This function is kept as a placeholder but doesn't load actual images
    console.log("Attempting to load PvZ assets (Placeholders)...");
    Object.values(pvzAssets).forEach(asset => asset.loaded = true); // Mark all as 'loaded' immediately
    pvzAssetsLoaded = true;
    pvzAssetsLoadedCount = pvzTotalAssets;
    console.log("PvZ assets marked as loaded (Placeholders).");
}

// --- PvZ Game State ---
let pvzGame = {}; // Initialize as empty object, initPvZ will populate it
const plantTypes = ['peashooter', 'sunflower', 'wallnut', 'cherrybomb'];

// --- PvZ Initialization ---
function initPvZ() {
    console.log("[initPvZ] Starting PvZ initialization...");
    // Re-initialize the state object fully
    pvzGame = {
        plants: [], // { type, row, col, health, ... }
        zombies: [], // { type, row, x, health, speed, isEating, id }
        projectiles: [], // { x, y, row }
        suns: [], // { x, y, value, fallSpeed, angle?, rotationSpeed?, life? }
        particles: [], // { x, y, vx, vy, life, color, size }
        sunCount: 150,
        selectedPlantType: null,
        plantCosts: { 'peashooter': 100, 'sunflower': 50, 'wallnut': 50, 'cherrybomb': 150 },
        plantHealth: { 'peashooter': 100, 'sunflower': 80, 'wallnut': 400, 'cherrybomb': 50 },
        zombieHealth: { 'basic': 150, 'conehead': 400 },
        zombieDamage: { 'basic': 10, 'conehead': 10 },
        zombieEatInterval: 60, // Frames between eat 'ticks'
        zombieCounters: {}, // To track individual zombie timers (like eating)
        nextZombieId: 0,
        nextPlantId: 0,
        waveNumber: 0,
        waveDefinition: [
            { count: 3, types: ['basic'], interval: 500 },
            { count: 5, types: ['basic'], interval: 450 },
            { count: 7, types: ['basic', 'conehead'], interval: 400 },
            { count: 10, types: ['basic', 'conehead'], interval: 350 },
            { count: 12, types: ['basic', 'conehead'], interval: 320 },
            { count: 15, types: ['basic', 'conehead'], interval: 300 },
            { count: 10, types: ['conehead'], interval: 400 },
            { count: 20, types: ['basic', 'conehead'], interval: 280 },
            { count: 25, types: ['basic', 'conehead'], interval: 250 }
        ],
        zombiesRemainingInWave: 0,
        zombiesToSpawnInWave: 0,
        timeToNextZombie: 0, // Timer for spawning within a wave
        waveInProgress: false,
        wavesCompleted: false,
        timeToNextWave: 300, // Delay before first wave starts (5 seconds at 60fps)
        sunSpawnTimer: 0,
        sunSpawnInterval: 300, // Approx 5 seconds
        score: 0,
    };
    // Note: Assets are not actually loaded here in placeholder mode
    console.log("[initPvZ] PvZ state object reset.");
    // Any other setup needed can go here
    console.log("[initPvZ] PvZ initialization complete."); // << Final log
}

// --- PvZ Wave Logic ---
function startNextWave() {
    pvzGame.waveNumber++;
    console.log(`Attempting to start Wave ${pvzGame.waveNumber}`);
    const currentWaveIndex = pvzGame.waveNumber - 1;

    if (currentWaveIndex >= pvzGame.waveDefinition.length) {
        console.log("All defined waves completed!");
        pvzGame.waveInProgress = false;
        pvzGame.wavesCompleted = true;
        return;
    }

    console.log(`Starting Wave ${pvzGame.waveNumber}`);
    const waveData = pvzGame.waveDefinition[currentWaveIndex];
    pvzGame.zombiesToSpawnInWave = waveData.count;
    pvzGame.zombiesRemainingInWave = waveData.count; // Track defeated zombies
    pvzGame.timeToNextZombie = waveData.interval; // Use first interval
    pvzGame.waveInProgress = true;
}

// --- PvZ Particle System ---
function createPvZParticles(x, y, count, color, speedMultiplier = 1, lifeRange = [20, 40]) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (Math.random() * 2 + 1) * speedMultiplier;
        pvzGame.particles.push({
            x: x, y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: Math.random() * (lifeRange[1] - lifeRange[0]) + lifeRange[0],
            color: color,
            size: Math.random() * 3 + 1
        });
    }
}

function updatePvZParticles() {
    for (let i = pvzGame.particles.length - 1; i >= 0; i--) {
        let p = pvzGame.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // slight gravity
        p.life--;
        if (p.life <= 0) {
            pvzGame.particles.splice(i, 1);
        }
    }
}

function drawPvZParticles() {
    pvzGame.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
}


// --- PvZ Main Update Function ---
function updatePvZ() {
    // console.log("updatePvZ started"); // Keep this log for now

    // --- Update Particles ---
    updatePvZParticles();

    // --- Wave Management ---
    if (pvzGame.wavesCompleted) {
        // Game won state, do nothing more with waves
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
         pvzGame.timeToNextWave = 600; // Set delay for the next wave attempt (10 secs)
         // startNextWave() will be called after delay and handle completion check
    }

    // --- Sun Spawning & Collection ---
    const gridStartX = PVZ_GRID_START_X();
    const gridStartY = PVZ_GRID_START_Y();
    const gridWidth = CANVAS_WIDTH * 0.8; // Based on calculation in constants
    const gridHeight = CANVAS_HEIGHT * 0.7;

    pvzGame.sunSpawnTimer++;
    if (pvzGame.sunSpawnTimer >= pvzGame.sunSpawnInterval) {
        pvzGame.sunSpawnTimer = 0;
        pvzGame.suns.push({
            x: Math.random() * gridWidth + gridStartX,
            y: 0, value: 25, fallSpeed: 0.5 + Math.random() * 0.5,
            angle: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.1
        });
    }
    // Sun from sunflowers
    pvzGame.plants.forEach(plant => {
        if (plant.type === 'sunflower') {
            plant.sunCooldown = (plant.sunCooldown || 0) + 1;
            if (plant.sunCooldown >= 600) { // Approx 10 seconds
                plant.sunCooldown = 0;
                pvzGame.suns.push({
                    x: gridStartX + plant.col * PVZ_CELL_WIDTH() + PVZ_CELL_WIDTH() / 2,
                    y: gridStartY + plant.row * PVZ_CELL_HEIGHT() + PVZ_CELL_HEIGHT() * 0.3,
                    value: 25, fallSpeed: 0,
                    life: 300, angle: 0, rotationSpeed: 0 // No rotation/fall for plant sun
                });
                 playSound('sun'); // Assumes playSound is global
            }
        }
        // Update plant placement animation timer
        if (plant.placeAnimTimer && plant.placeAnimTimer > 0) {
            plant.placeAnimTimer--;
        }
         // Update cherry bomb fuse
        if (plant.type === 'cherrybomb' && plant.explodeTimer !== null) {
             plant.explodeTimer--;
             if (plant.explodeTimer <= 0) {
                 // Explode!
                 const explosionX = gridStartX + plant.col * PVZ_CELL_WIDTH() + PVZ_CELL_WIDTH() / 2;
                 const explosionY = gridStartY + plant.row * PVZ_CELL_HEIGHT() + PVZ_CELL_HEIGHT() / 2;
                 const explosionRadius = PVZ_CELL_WIDTH() * 1.5; // Affects 3x3 area approx

                 console.log("Cherry Bomb Exploding!");
                 playSound('explosion');
                 createPvZParticles(explosionX, explosionY, 50, PVZ_EXPLOSION_COLOR, 3, [30, 60]);

                 // Damage zombies in radius
                 pvzGame.zombies.forEach(z => {
                     const zombieCenterX = z.x + PVZ_CELL_WIDTH() * 0.3; // Approx center
                     const zombieCenterY = gridStartY + z.row * PVZ_CELL_HEIGHT() + PVZ_CELL_HEIGHT() / 2;
                     const distSq = (zombieCenterX - explosionX)**2 + (zombieCenterY - explosionY)**2;
                     if (distSq < explosionRadius**2) {
                         console.log(`Zombie ${z.id} caught in explosion!`);
                         z.health = 0; // Instant kill
                     }
                 });

                 // Remove the cherry bomb plant itself
                 const plantIndex = pvzGame.plants.findIndex(p => p.id === plant.id);
                 if (plantIndex > -1) {
                     pvzGame.plants.splice(plantIndex, 1);
                 }
                 // Needs immediate check after explosion for defeated zombies
                 checkZombieDefeats();
             }
        }
    });
    // Update existing suns
    for (let i = pvzGame.suns.length - 1; i >= 0; i--) {
        let sun = pvzGame.suns[i];
        if (sun.fallSpeed > 0) {
             sun.y += sun.fallSpeed;
             sun.angle += sun.rotationSpeed;
             // Land somewhere within the grid area vertically
             if (sun.y > gridStartY + Math.random() * gridHeight) {
                 sun.fallSpeed = 0;
                 sun.rotationSpeed = 0;
                 sun.life = 300; // Start countdown timer (5 secs)
             }
        } else if (sun.life !== undefined) {
             sun.life--;
        }

        // Collection - Check isClicking *explicitly* here
        const sunRadius = 20;
        // Check global mousePos and isClicking
        if (isClicking && Math.hypot(mousePos.x - sun.x, mousePos.y - sun.y) < sunRadius) {
            pvzGame.sunCount += sun.value;
            playSound('sun');
            createPvZParticles(sun.x, sun.y, 8, 'rgba(255, 255, 0, 0.8)', 2, [15, 30]);
            pvzGame.suns.splice(i, 1);
            isClicking = false; // Consume click inside PvZ logic
            continue;
        }
        // Remove faded/fallen off screen sun
        if ((sun.life !== undefined && sun.life <= 0) || sun.y > CANVAS_HEIGHT) {
             pvzGame.suns.splice(i, 1);
        }
    }

    // --- Plant Spawning & Logic ---
    const cellWidth = PVZ_CELL_WIDTH();
    const cellHeight = PVZ_CELL_HEIGHT();

    let clickedSeedPacket = false;
    if (isClicking) {
        plantTypes.forEach((type, index) => {
            const packetX = gridStartX + index * (PVZ_SEED_PACKET_WIDTH + 10);
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
                isClicking = false; // Consume click
                clickedSeedPacket = true;
            }
        });
    }
    // Handle grid clicks for planting
    if (isClicking && pvzGame.selectedPlantType && !clickedSeedPacket) {
        const clickCol = Math.floor((mousePos.x - gridStartX) / cellWidth);
        const clickRow = Math.floor((mousePos.y - gridStartY) / cellHeight);

        if (clickCol >= 0 && clickCol < PVZ_GRID_COLS && clickRow >= 0 && clickRow < PVZ_GRID_ROWS) {
            const cellOccupied = pvzGame.plants.some(p => p.row === clickRow && p.col === clickCol);
            if (!cellOccupied) {
                console.log(`Planting ${pvzGame.selectedPlantType} at ${clickRow}, ${clickCol}`);
                pvzGame.sunCount -= pvzGame.plantCosts[pvzGame.selectedPlantType];
                const plantData = {
                    id: pvzGame.nextPlantId++, type: pvzGame.selectedPlantType,
                    row: clickRow, col: clickCol, health: pvzGame.plantHealth[pvzGame.selectedPlantType],
                    shootCooldown: 0, sunCooldown: 0, placeAnimTimer: 15, // For visual pop
                    explodeTimer: (pvzGame.selectedPlantType === 'cherrybomb') ? 60 : null // Start explode timer
                };
                pvzGame.plants.push(plantData);
                createPvZParticles(
                    gridStartX + clickCol * cellWidth + cellWidth / 2,
                    gridStartY + clickRow * cellHeight + cellHeight / 2,
                    10, 'rgba(255, 255, 255, 0.7)', 1.5, [10, 20]
                );
                playSound('plant');
                pvzGame.selectedPlantType = null;
                isClicking = false; // Consume click
            } else {
                 console.log("Cell occupied");
                 pvzGame.selectedPlantType = null;
                 // Don't consume click if cell occupied, allows deselecting
            }
        } else {
            pvzGame.selectedPlantType = null; // Clicked outside grid, deselect
            // Don't consume click, allows clicking UI later
        }
    } else if (isClicking && !clickedSeedPacket) {
        pvzGame.selectedPlantType = null; // Clicked somewhere else, deselect
    }

    // Plant actions (Shooting - only peashooter)
    pvzGame.plants.forEach(plant => {
        if (plant.type === 'peashooter') {
            plant.shootCooldown = (plant.shootCooldown || 0) + 1;
            // Check if zombie is in the same row AND to the right of the plant
            const zombieInRow = pvzGame.zombies.some(z =>
                z.row === plant.row && z.x > gridStartX + plant.col * cellWidth
            );
            if (zombieInRow && plant.shootCooldown >= 90) { // Approx 1.5 seconds
                plant.shootCooldown = 0;
                pvzGame.projectiles.push({
                    x: gridStartX + (plant.col + 0.7) * cellWidth, // Start near front of plant
                    y: gridStartY + (plant.row + 0.5) * cellHeight, // Middle of cell height
                    row: plant.row
                });
                playSound('shoot');
            }
        }
    });

    // --- Projectile Logic ---
    for (let i = pvzGame.projectiles.length - 1; i >= 0; i--) {
        let p = pvzGame.projectiles[i];
        p.x += 4; // Projectile speed
        if (p.x > CANVAS_WIDTH) {
            pvzGame.projectiles.splice(i, 1);
            continue;
        }
        let hit = false;
        for (let j = pvzGame.zombies.length - 1; j >= 0; j--) {
            let z = pvzGame.zombies[j];
             // Check row first, then horizontal collision
            if (!hit && z.row === p.row) {
                 const zombieHitboxLeft = z.x;
                 const zombieHitboxRight = z.x + cellWidth * 0.6; // Zombie width
                 const projTip = p.x + 10; // Projectile size/tip

                 if (projTip >= zombieHitboxLeft && p.x < zombieHitboxRight) {
                     z.health -= 25; // Pea damage
                     createPvZParticles(p.x, p.y, 5, 'rgba(0, 0, 0, 0.5)', 1, [5, 15]); // Hit sparks
                     pvzGame.projectiles.splice(i, 1); // Remove projectile
                     console.log(`Zombie ${z.id} (${z.type}) hit! Health:`, z.health);
                     hit = true; // Mark hit to stop checking this projectile
                     // Zombie defeat check moved to separate function after updates
                     break; // Stop checking zombies for this projectile
                 }
            }
        }
    }


    // --- Zombie Spawning (Wave Based) ---
    if (pvzGame.waveInProgress && pvzGame.zombiesToSpawnInWave > 0) {
        pvzGame.timeToNextZombie--;
        if (pvzGame.timeToNextZombie <= 0) {
            const currentWaveIndex = pvzGame.waveNumber - 1; // 0-based index
            const waveData = pvzGame.waveDefinition[currentWaveIndex];

            // Reset timer for next zombie in wave
            pvzGame.timeToNextZombie = waveData.interval;
            pvzGame.zombiesToSpawnInWave--;

            // Spawn logic
            const spawnRow = Math.floor(Math.random() * PVZ_GRID_ROWS);
            const possibleTypes = waveData.types;
            const zombieType = possibleTypes[Math.floor(Math.random() * possibleTypes.length)];

            const newZombie = {
                id: pvzGame.nextZombieId++,
                type: zombieType, row: spawnRow, x: CANVAS_WIDTH, // Start off-screen right
                health: pvzGame.zombieHealth[zombieType],
                speed: (zombieType === 'conehead' ? 0.25 : 0.3) + Math.random() * 0.15,
                isEating: false,
                animationFrame: 0, // For potential animation later
            };
            pvzGame.zombies.push(newZombie);
            pvzGame.zombieCounters[newZombie.id] = 0; // Initialize eat counter
            console.log(`${zombieType} zombie spawned (Wave ${pvzGame.waveNumber}, ${pvzGame.zombiesToSpawnInWave} left to spawn)`);
        }
    }

    // --- Update Zombies (Movement, Eating) ---
    for (let i = pvzGame.zombies.length - 1; i >= 0; i--) {
        let z = pvzGame.zombies[i];
        z.isEating = false; // Assume not eating

        // Check for plants in front in the same row
        let plantToEat = null;
        for (let j = pvzGame.plants.length - 1; j >= 0; j--) {
             let plant = pvzGame.plants[j];
             // Check if plant is in the same row and zombie overlaps it
             if (plant.row === z.row) {
                  const plantHitboxLeft = gridStartX + plant.col * cellWidth;
                  const plantHitboxRight = plantHitboxLeft + cellWidth;
                  const zombieHitboxLeft = z.x;
                  const zombieHitboxRight = z.x + cellWidth * 0.6; // Approx width

                  // Check for overlap, allow slight overlap before eating starts
                  if (zombieHitboxLeft < plantHitboxRight - cellWidth * 0.1 && zombieHitboxRight > plantHitboxLeft + cellWidth * 0.1) {
                      plantToEat = plant;
                      break; // Found a plant to eat
                  }
             }
        }

        if (plantToEat) {
            z.isEating = true;
            pvzGame.zombieCounters[z.id]++; // Increment eat timer
            if (pvzGame.zombieCounters[z.id] >= pvzGame.zombieEatInterval) {
                 pvzGame.zombieCounters[z.id] = 0; // Reset timer
                 plantToEat.health -= pvzGame.zombieDamage[z.type] || 10;
                 playSound('zombieEat');
                 createPvZParticles(z.x + cellWidth * 0.5, // Particles near zombie mouth/plant
                                     gridStartY + z.row * cellHeight + cellHeight / 2,
                                     3, 'rgba(0, 80, 0, 0.7)', 0.5, [10, 15]);
                 console.log(`Plant ${plantToEat.id} health:`, plantToEat.health);
                 if (plantToEat.health <= 0) {
                     // Find index and remove plant
                     const plantIndex = pvzGame.plants.findIndex(p => p.id === plantToEat.id);
                     if (plantIndex > -1) {
                         pvzGame.plants.splice(plantIndex, 1);
                         console.log(`Plant ${plantToEat.id} (${plantToEat.type}) eaten!`);
                         z.isEating = false; // Zombie stops eating immediately after plant is gone
                         pvzGame.zombieCounters[z.id] = 0;
                     }
                 }
            }
        } else {
            // Move if not eating
            z.x -= z.speed;
            pvzGame.zombieCounters[z.id] = 0; // Reset eat counter if not eating
        }

        // Check if zombie reached the house (Game Over)
        if (z.x < gridStartX - 30) { // Check if passed the grid start significantly
            console.log("GAME OVER - Zombie reached house!");
            playSound('die'); // Or a specific game over sound
            currentGameState = 'MainMenu'; // Go back to menu (simple game over)
            // Optionally: Could set a gameOver flag and show a message before returning
            return; // Stop further updates this frame
        }
    }
    // --- Check for Defeated Zombies (After all updates) ---
    checkZombieDefeats();
}

// Helper to remove defeated zombies and update score/wave count
function checkZombieDefeats() {
    for (let j = pvzGame.zombies.length - 1; j >= 0; j--) {
        let z = pvzGame.zombies[j];
        if (z.health <= 0) {
             delete pvzGame.zombieCounters[z.id]; // Clean up counter
             pvzGame.zombies.splice(j, 1); // Remove zombie
             pvzGame.zombiesRemainingInWave--; // Decrement wave counter *only when defeated*
             console.log(`Zombie ${z.id} defeated! Remaining in wave: ${pvzGame.zombiesRemainingInWave}`);
             pvzGame.score += (z.type === 'conehead' ? 15 : 10); // More score for tougher zombies
        }
    }
}

// --- PvZ Drawing Function ---
function drawPvZ() {
    // console.log("drawPvZ started"); // Keep for debugging if needed

    // Calculate grid dimensions dynamically based on current canvas size
    const gridStartX = PVZ_GRID_START_X();
    const gridStartY = PVZ_GRID_START_Y();
    const cellWidth = PVZ_CELL_WIDTH();
    const cellHeight = PVZ_CELL_HEIGHT();

    // Draw Background
    ctx.fillStyle = '#5c3e30'; // Brownish soil color
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Grid Lines
    ctx.strokeStyle = PVZ_GRID_COLOR;
    ctx.lineWidth = 1;
    for (let row = 0; row < PVZ_GRID_ROWS; row++) {
        for (let col = 0; col < PVZ_GRID_COLS; col++) {
            const x = gridStartX + col * cellWidth;
            const y = gridStartY + row * cellHeight;
            ctx.strokeRect(x, y, cellWidth, cellHeight);
        }
    }
    // console.log("drawPvZ grid drawn"); // Keep for debugging if needed

    // Draw Particles FIRST (behind other elements)
    drawPvZParticles();

    // Draw Plants (Placeholders with animation effects)
    pvzGame.plants.forEach(plant => {
        const baseX = gridStartX + plant.col * cellWidth;
        const baseY = gridStartY + plant.row * cellHeight;
        const x = baseX + cellWidth * 0.5;
        const y = baseY + cellHeight * 0.5;
        let radius = cellWidth * 0.35;

        // Placement Animation
        if (plant.placeAnimTimer && plant.placeAnimTimer > 0) {
            const t = plant.placeAnimTimer / 15; // Normalized time 1 -> 0
            const scaleFactor = 1 + Math.sin(t * Math.PI) * 0.3; // Smooth pop
            radius *= scaleFactor;
        }

        // Sunflower Pulse
        if (plant.type === 'sunflower' && plant.sunCooldown >= 550 && !isPaused) {
            const pulseFactor = 1 + Math.sin(globalFrameCounter * 0.2) * 0.1; // Use globalFrameCounter
            radius *= pulseFactor;
        }

         // Cherry Bomb Pulse/Fuse
        if (plant.type === 'cherrybomb' && plant.explodeTimer !== null) {
             const pulseFactor = 1 + Math.sin(globalFrameCounter * 0.3) * 0.15;
             radius *= pulseFactor;
             // Draw fuse
             ctx.save();
             ctx.strokeStyle = 'black'; ctx.lineWidth = 2;
             ctx.beginPath(); ctx.moveTo(x, y - radius); ctx.lineTo(x + 5, y - radius - 10); ctx.stroke();
             ctx.fillStyle = 'yellow'; ctx.fillRect(x+3, y - radius - 12, 4, 4); // Spark
             ctx.restore();
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

        // Wallnut border / Texture
        if (plant.type === 'wallnut') {
            ctx.save();
            ctx.strokeStyle = '#694518'; ctx.lineWidth = 3;
            ctx.stroke(); // Stroke the existing arc path
            // Add cracks based on health?
            const healthRatio = plant.health / pvzGame.plantHealth.wallnut;
            if (healthRatio < 0.66) { // First crack stage
                 ctx.beginPath(); ctx.moveTo(x - radius*0.3, y - radius*0.5); ctx.lineTo(x + radius*0.2, y); ctx.stroke();
            }
            if (healthRatio < 0.33) { // Second crack stage
                 ctx.beginPath(); ctx.moveTo(x + radius*0.5, y - radius*0.2); ctx.lineTo(x - radius*0.1, y + radius*0.6); ctx.stroke();
            }
            ctx.restore();
        }

        // Health bar (always draw background, then foreground)
        const maxHealth = pvzGame.plantHealth[plant.type];
        if (plant.health < maxHealth && plant.type !== 'cherrybomb') { // Don't show health for cherry bomb
             const barWidth = cellWidth * 0.8;
             const barHeight = 6;
             const barX = baseX + (cellWidth - barWidth) / 2;
             const barY = baseY - barHeight - 2; // Position above plant
             ctx.fillStyle = 'rgba(255, 0, 0, 0.5)'; // Red background
             ctx.fillRect(barX, barY, barWidth, barHeight);
             ctx.fillStyle = 'rgba(0, 255, 0, 0.8)'; // Green foreground
             ctx.fillRect(barX, barY, barWidth * (plant.health / maxHealth), barHeight);
        }
    });

    // Draw Zombies (Placeholders with refinement)
    pvzGame.zombies.forEach(zombie => {
        const yBody = gridStartY + zombie.row * cellHeight + cellHeight * 0.1;
        const sizeW = cellWidth * 0.6;
        const sizeH = cellHeight * 0.8;
        const maxHealth = pvzGame.zombieHealth[zombie.type];
        const healthRatio = Math.max(0, zombie.health / maxHealth); // Ensure >= 0

        // Body
        ctx.fillStyle = PVZ_ZOMBIE_COLOR;
        ctx.fillRect(zombie.x, yBody, sizeW, sizeH);

        // Simple 'arms' - oscillate based on x position for basic walk feel
        // Use a sine wave based on x-position for pseudo-animation
        const armOffsetY = zombie.isEating ? Math.sin(globalFrameCounter * 0.3) * 4 : Math.sin(zombie.x * 0.1) * 5;
        ctx.fillStyle = '#7f8c8d'; // Slightly different grey
        // Back arm
        ctx.fillRect(zombie.x - sizeW * 0.15, yBody + sizeH * 0.3 + armOffsetY, sizeW * 0.15, sizeH * 0.15);
        // Front arm
        ctx.fillRect(zombie.x + sizeW, yBody + sizeH * 0.3 - armOffsetY, sizeW * 0.15, sizeH * 0.15);

        // Cone (or other headgear)
        if (zombie.type === 'conehead') {
             ctx.fillStyle = PVZ_CONE_COLOR;
             ctx.beginPath();
             ctx.moveTo(zombie.x + sizeW * 0.1, yBody + sizeH * 0.1); // Base left
             ctx.lineTo(zombie.x + sizeW * 0.9, yBody + sizeH * 0.1); // Base right
             ctx.lineTo(zombie.x + sizeW * 0.5, yBody - sizeH * 0.3); // Point
             ctx.closePath();
             ctx.fill();
        }
        // Health bar
        if (healthRatio < 1) {
             const barWidth = sizeW;
             const barHeight = 6;
             const barX = zombie.x;
             const barY = yBody - barHeight - 4; // Position above head/cone
             ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
             ctx.fillRect(barX, barY, barWidth, barHeight);
             ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
             ctx.fillRect(barX, barY, barWidth * healthRatio, barHeight);
        }
    });

    // Draw Projectiles (Placeholder with pulse)
    pvzGame.projectiles.forEach(p => {
        const pulseFactor = 1 + Math.sin(globalFrameCounter * 0.4) * 0.1;
        const radius = 5 * pulseFactor;
        ctx.fillStyle = PVZ_PROJECTILE_COLOR;
        ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill();
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

    // console.log("drawPvZ drawing UI"); // Keep for debugging

    // --- Draw UI ---
    ctx.fillStyle = PVZ_UI_BG_COLOR;
    ctx.fillRect(0, 0, CANVAS_WIDTH, gridStartY * 0.8); // UI background area

    // Draw Seed Packets
    plantTypes.forEach((type, index) => {
        const packetX = gridStartX + index * (PVZ_SEED_PACKET_WIDTH + 10);
        const packetY = 10;
        const cost = pvzGame.plantCosts[type];
        const isAffordable = pvzGame.sunCount >= cost;
        const isSelected = pvzGame.selectedPlantType === type;

        ctx.save(); // Save context for opacity/stroke changes
        ctx.fillStyle = '#8a6d3b'; // Packet brown background
        ctx.fillRect(packetX, packetY, PVZ_SEED_PACKET_WIDTH, PVZ_SEED_PACKET_HEIGHT);

        // Dim if not affordable
        ctx.globalAlpha = isAffordable ? 1.0 : 0.5;

        // Highlight if selected
        if (isSelected) {
             ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
             ctx.strokeRect(packetX - 1, packetY - 1, PVZ_SEED_PACKET_WIDTH + 2, PVZ_SEED_PACKET_HEIGHT + 2);
             ctx.lineWidth = 1; // Reset line width
        }

        // Draw plant placeholder icon inside packet
        const plantIconRadius = PVZ_SEED_PACKET_WIDTH * 0.3;
        const plantIconX = packetX + PVZ_SEED_PACKET_WIDTH / 2;
        const plantIconY = packetY + PVZ_SEED_PACKET_HEIGHT * 0.4;
        switch(type) {
            case 'peashooter': ctx.fillStyle = PVZ_PLANT_COLOR; break;
            case 'sunflower': ctx.fillStyle = PVZ_SUNFLOWER_COLOR; break;
            case 'wallnut': ctx.fillStyle = PVZ_WALLNUT_COLOR; break;
            case 'cherrybomb': ctx.fillStyle = PVZ_CHERRYBOMB_COLOR; break;
            default: ctx.fillStyle = '#cccccc';
        }
        ctx.beginPath(); ctx.arc(plantIconX, plantIconY, plantIconRadius, 0, Math.PI * 2); ctx.fill();
        // Add mini details to icons
        if (type === 'wallnut') {
             ctx.strokeStyle = '#694518'; ctx.lineWidth = 2; ctx.stroke();
        }
        if (type === 'cherrybomb') {
             ctx.strokeStyle = 'black'; ctx.lineWidth = 1; ctx.beginPath();
             ctx.moveTo(plantIconX, plantIconY - plantIconRadius); ctx.lineTo(plantIconX + 3, plantIconY - plantIconRadius - 6); ctx.stroke();
        }
        if (type === 'peashooter') {
             ctx.fillStyle = '#1a5d2b';
             ctx.fillRect(plantIconX + plantIconRadius * 0.5, plantIconY - plantIconRadius * 0.2, plantIconRadius * 0.5, plantIconRadius * 0.4);
        }

        // Draw cost text (always fully opaque)
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = isAffordable ? '#000000' : '#550000'; // Black or dark red if too expensive
        ctx.textAlign = 'center';
        ctx.font = `bold 14px ${FONT_UI}`; // Assumes FONT_UI is global
        ctx.fillText(cost, packetX + PVZ_SEED_PACKET_WIDTH / 2, packetY + PVZ_SEED_PACKET_HEIGHT - 15);

        ctx.restore(); // Restore alpha/lineWidth
    });

    // Draw Sun Count Display
    const sunCountX = gridStartX + plantTypes.length * (PVZ_SEED_PACKET_WIDTH + 10) + 20;
    const sunCountY = 10 + PVZ_SEED_PACKET_HEIGHT / 2;
    ctx.fillStyle = '#000000';
    ctx.font = `bold 24px ${FONT_UI}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`☀️ ${pvzGame.sunCount}`, sunCountX, sunCountY);

    // Draw Score Display
    ctx.font = `bold 18px ${FONT_UI}`;
    ctx.fillText(`Score: ${pvzGame.score}`, sunCountX, sunCountY + 30); // Position below sun count

    // Draw Wave Counter / Status Display
    ctx.fillStyle = '#000000';
    ctx.font = `bold 18px ${FONT_UI}`;
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    let waveText = "Preparing...";
    if (pvzGame.wavesCompleted) {
        waveText = "All Waves Cleared!";
    } else if (pvzGame.waveInProgress) {
        waveText = `Wave: ${pvzGame.waveNumber}`;
    } else if (pvzGame.waveNumber > 0) {
        waveText = `Wave ${pvzGame.waveNumber} Cleared! Next in...`; // Could add timer
    }
    ctx.fillText(waveText, CANVAS_WIDTH - 15, 15); // Top right corner

    // console.log("drawPvZ UI drawn"); // Keep for debugging

    // Draw "You Win" Overlay if waves are completed
    if (pvzGame.wavesCompleted) {
         ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
         ctx.fillRect(0, CANVAS_HEIGHT / 3, CANVAS_WIDTH, CANVAS_HEIGHT / 3);
         ctx.fillStyle = 'lime';
         ctx.font = `bold 48px ${FONT_UI}`; // Assumes FONT_UI is global
         ctx.textAlign = 'center';
         ctx.textBaseline = 'middle';
         ctx.fillText("YOU SURVIVED!", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }

    // Draw Plant Selection Cursor Ghost (if a plant is selected)
    if (pvzGame.selectedPlantType) {
        const gridCol = Math.floor((mousePos.x - gridStartX) / cellWidth);
        const gridRow = Math.floor((mousePos.y - gridStartY) / cellHeight);
        // Check if cursor is within grid bounds
        if (gridCol >= 0 && gridCol < PVZ_GRID_COLS && gridRow >= 0 && gridRow < PVZ_GRID_ROWS) {
             const ghostX = gridStartX + gridCol * cellWidth + cellWidth * 0.5;
             const ghostY = gridStartY + gridRow * cellHeight + cellHeight * 0.5;
             const radius = cellWidth * 0.35;
             const cellOccupied = pvzGame.plants.some(p => p.row === gridRow && p.col === gridCol);

             ctx.save();
             ctx.globalAlpha = 0.5; // Make ghost transparent
             // Set color based on selected type
             switch(pvzGame.selectedPlantType) {
                case 'peashooter': ctx.fillStyle = PVZ_PLANT_COLOR; break;
                case 'sunflower': ctx.fillStyle = PVZ_SUNFLOWER_COLOR; break;
                case 'wallnut': ctx.fillStyle = PVZ_WALLNUT_COLOR; break;
                case 'cherrybomb': ctx.fillStyle = PVZ_CHERRYBOMB_COLOR; break;
                default: ctx.fillStyle = '#cccccc';
            }
             // Tint red if cell is occupied
             if (cellOccupied) { ctx.fillStyle = 'rgba(255, 0, 0, 0.5)'; }

             ctx.beginPath(); ctx.arc(ghostX, ghostY, radius, 0, Math.PI * 2); ctx.fill();
             // Add mini details to ghost? (Optional)
             if (pvzGame.selectedPlantType === 'peashooter' && !cellOccupied) {
                ctx.fillStyle = 'rgba(26, 93, 43, 0.5)'; // Darker green, semi-transparent
                ctx.fillRect(ghostX + radius * 0.6, ghostY - radius * 0.2, radius * 0.6, radius * 0.4);
             }
             ctx.restore();
        }
    }
} 