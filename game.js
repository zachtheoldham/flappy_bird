const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Global State ---
let currentGameState = 'MainMenu'; // 'MainMenu', 'PvZ', 'Flappy'
let mousePos = { x: 0, y: 0 };
let isClicking = false; // Set true on mousedown, reset in gameLoop
let keysPressed = {}; // For keyboard input (used by Flappy)
let isPaused = false; // Global pause flag
let globalFrameCounter = 0; // For global effects like animations

// --- Global Constants ---
const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;

// --- Fonts (Used across games/UI) ---
const FONT_RETRO = '"Courier New", Courier, monospace';
const FONT_UI = 'Arial, sans-serif';

// --- Asset Loading (Simplified - handled within game files now) ---
// No global asset loading logic needed here anymore.

// --- Menu Variables ---
const menuItems = [
    { id: 'pvz', text: 'Plants vs Zombies (Core)', width: 400, height: 50, targetState: 'PvZ' }, // x/y set dynamically
    { id: 'flappy', text: 'Retro Flappy', width: 400, height: 50, targetState: 'Flappy' } // x/y set dynamically
];
let hoveredMenuItem = null;

// --- Shared UI Elements ---
const backButton = { x: 10, y: 10, width: 80, height: 30, text: 'Back' };
let isHoveringBack = false;
const pauseButton = { x: CANVAS_WIDTH - 90, y: 10, width: 80, height: 30, text: 'Pause' }; // Top right
let isHoveringPause = false;

// --- Sound Placeholders --- (Global function, implementation can be added later)
function playSound(soundName) {
    // console.log("Play sound (placeholder):", soundName);
    // Actual sound implementation would go here, possibly managing Audio objects.
}

// --- Main Game Loop ---
function gameLoop() {
    globalFrameCounter++;
    // Clear canvas
    ctx.fillStyle = '#ecf0f1'; // Default background, games might overwrite
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Reset hover states
    isHoveringBack = false;
    isHoveringPause = false;
    let uiClickConsumed = false;

    // --- Global UI Input Handling (Back/Pause Buttons) ---
    if (currentGameState !== 'MainMenu') {
         // Back Button Check
         if (mousePos.x >= backButton.x && mousePos.x <= backButton.x + backButton.width &&
             mousePos.y >= backButton.y && mousePos.y <= backButton.y + backButton.height) {
             isHoveringBack = true;
             if (isClicking) {
                 console.log("Back button clicked -> MainMenu");
                 isPaused = false; // Ensure unpaused when going back
                 currentGameState = 'MainMenu';
                 isClicking = false; // Consume click
                 uiClickConsumed = true;
             }
         }
         // Pause Button Check (only if Back wasn't clicked)
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

    // --- Game State Update Logic (Delegate to game-specific functions) ---
    // Only update if not paused and UI didn't consume the click this frame
    if (!isPaused && !uiClickConsumed) {
        switch (currentGameState) {
            case 'MainMenu':
                updateMainMenu();
                break;
            case 'PvZ':
                if (typeof updatePvZ === 'function') {
                    updatePvZ();
                } else {
                    console.error('updatePvZ function not found!');
                }
                break;
            case 'Flappy':
                if (typeof updateFlappy === 'function') {
                    updateFlappy();
                } else {
                    console.error('updateFlappy function not found!');
                }
                break;
            default:
                console.error("Unknown game state in update:", currentGameState);
                currentGameState = 'MainMenu'; // Recover to main menu
        }
    }

    // --- Drawing Logic (Always draw state, delegate to game-specific functions) ---
    switch (currentGameState) {
        case 'MainMenu':
            drawMainMenu();
            break;
        case 'PvZ':
             if (typeof drawPvZ === 'function') {
                drawPvZ();
            } else {
                console.error('drawPvZ function not found! Rendering placeholder.');
                // Draw placeholder if function missing
                ctx.fillStyle = 'red'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                ctx.fillStyle = 'white'; ctx.font = '30px Arial'; ctx.textAlign = 'center';
                ctx.fillText('Error: drawPvZ not found!', CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
            }
            break;
        case 'Flappy':
            if (typeof drawFlappy === 'function') {
                drawFlappy();
            } else {
                console.error('drawFlappy function not found! Rendering placeholder.');
                // Draw placeholder if function missing
                ctx.fillStyle = 'blue'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                ctx.fillStyle = 'white'; ctx.font = '30px Arial'; ctx.textAlign = 'center';
                ctx.fillText('Error: drawFlappy not found!', CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
            }
            break;
        default:
            console.error("Unknown game state in draw:", currentGameState);
             drawMainMenu(); // Default to drawing main menu on unknown state
    }

    // --- Draw Global UI on top (if applicable) ---
    if (currentGameState !== 'MainMenu') {
        drawBackButton();
        drawPauseButton();
    }
    if (isPaused && currentGameState !== 'MainMenu') {
        drawPauseOverlay();
    }

    // Reset click state AFTER all updates/draws have had a chance to check it
    // This prevents clicks being missed if processed late in the frame.
    // Only reset if it hasn't been consumed by UI or game logic already.
    if (isClicking) {
        // console.log("Click processed at end of frame, resetting.");
        isClicking = false;
    }

    // Request next frame
    requestAnimationFrame(gameLoop);
}


// --- Back Button Drawing ---
function drawBackButton() {
     ctx.fillStyle = isHoveringBack ? '#e74c3c' : '#c0392b'; // Red / Darker Red
     ctx.fillRect(backButton.x, backButton.y, backButton.width, backButton.height);
     ctx.fillStyle = '#ffffff';
     ctx.font = `bold 16px ${FONT_UI}`;
     ctx.textAlign = 'center';
     ctx.textBaseline = 'middle';
     ctx.fillText(backButton.text, backButton.x + backButton.width / 2, backButton.y + backButton.height / 2);
}

// --- Pause Button Drawing ---
function drawPauseButton() {
    ctx.fillStyle = isHoveringPause ? '#f39c12' : '#e67e22'; // Orange/Darker Orange
    ctx.fillRect(pauseButton.x, pauseButton.y, pauseButton.width, pauseButton.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 16px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isPaused ? 'Resume' : 'Pause', pauseButton.x + pauseButton.width / 2, pauseButton.y + pauseButton.height / 2);
}

// --- Pause Overlay Drawing ---
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
    // Only check menu items if not hovering over the back button (which shouldn't exist here anyway)
    if (!isHoveringBack) {
        // Calculate dynamic positions for menu items
        const startY = 150;
        const spacing = 100;
        menuItems.forEach((item, index) => {
            item.x = (CANVAS_WIDTH - item.width) / 2;
            item.y = startY + index * spacing;
        });

        for (const item of menuItems) {
            if (mousePos.x >= item.x && mousePos.x <= item.x + item.width &&
                mousePos.y >= item.y && mousePos.y <= item.y + item.height) {
                hoveredMenuItem = item;
                // console.log(`Hovering ${item.id}. isClicking=${isClicking}. Mouse: ${mousePos.x}, ${mousePos.y}. Bounds: x[${item.x}-${item.x+item.width}], y[${item.y}-${item.y+item.height}]`); // Keep this log
                if (isClicking && item.targetState) {
                    console.log(`[MainMenu] Click detected for ${item.id}. Attempting to switch...`);
                    // Initialize the selected game
                    if (item.targetState === 'PvZ') {
                        if (typeof initPvZ === 'function') {
                            initPvZ(); // Call init from pvz.js
                        } else {
                             console.error('initPvZ function not found! Aborting switch.'); break; // Stop processing this click
                        }
                    }
                    if (item.targetState === 'Flappy') {
                         if (typeof initFlappy === 'function') {
                            initFlappy(); // Call init from flappy.js
                         } else {
                             console.error('initFlappy function not found! Aborting switch.'); break; // Stop processing this click
                         }
                    }
                    console.log(`[MainMenu] Initializer for ${item.targetState} called. Setting state...`);
                    currentGameState = item.targetState;
                    console.log(`[MainMenu] currentGameState is now: ${currentGameState}`);
                    isPaused = false; // Ensure game starts unpaused
                    isClicking = false; // Consume the click
                    console.log(`[MainMenu] Click consumed for ${item.id}. Breaking loop.`);
                    break; // Exit loop once an item is clicked
                }
            }
        }
    }
}

function drawMainMenu() {
    // Background
    ctx.fillStyle = '#2c3e50'; // Dark blue background for menu
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Title
    ctx.fillStyle = '#ecf0f1'; // Light title text
    ctx.font = `bold 48px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.fillText('Mini Game Arcade', CANVAS_WIDTH / 2, 80);

    // Draw Menu Items
    ctx.font = `24px ${FONT_UI}`;
    for (const item of menuItems) {
        // Use dynamic positions calculated in updateMainMenu
        if (item.x === undefined || item.y === undefined) continue; // Skip if position not calculated yet

        ctx.fillStyle = (item === hoveredMenuItem) ? '#3498db' : '#2980b9'; // Blue / Darker Blue
        ctx.fillRect(item.x, item.y, item.width, item.height);
        ctx.fillStyle = '#ffffff'; // White text
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.text, item.x + item.width / 2, item.y + item.height / 2);
    }

    // Footer text
     ctx.fillStyle = '#bdc3c7'; // Light grey text
     ctx.font = `16px ${FONT_UI}`;
     ctx.textAlign = 'center';
     ctx.fillText('Click an option to start! (P to Pause)', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 50);
}


// --- Event Listeners --- (Remain global)
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
    console.log("Mousedown detected"); // Log raw mousedown event
    isClicking = true;
    // Let the game loop handle the click logic based on state and UI elements
    // If Flappy is active and in a state that accepts clicks, handle it
    if (!isPaused && currentGameState === 'Flappy' && typeof handleFlappyInput === 'function') {
         handleFlappyInput();
         // We don't consume the click here (isClicking = false)
         // because PvZ might also need to check for clicks on the same frame,
         // and the main loop resets isClicking at the end.
         // The individual game logic (like PvZ sun collection) consumes the click if needed.
    }
});

document.addEventListener('keydown', (event) => {
    keysPressed[event.code] = true;
    // Toggle Pause (Global)
    if (event.code === 'KeyP' && currentGameState !== 'MainMenu') {
        isPaused = !isPaused;
        console.log("Paused toggled via keypress:", isPaused);
    }
    // Flappy Bird specific input (only when Flappy is active and not paused)
    if (!isPaused && currentGameState === 'Flappy' && (event.code === 'Space' || event.code === 'ArrowUp')) {
        event.preventDefault(); // Prevent space bar scrolling
        if (typeof handleFlappyInput === 'function') {
            handleFlappyInput();
        }
    }
});

document.addEventListener('keyup', (event) => {
    keysPressed[event.code] = false;
});

// Prevent text selection on canvas drag
canvas.addEventListener('selectstart', (e) => {
    e.preventDefault();
});

// --- Initial Setup --- (Remains global)
console.log("Initializing Mini Game Arcade (Controller)...");
// Ensure the canvas dimensions are set if needed (might be done in HTML)
// canvas.width = 800; // Example if not set in HTML
// canvas.height = 600;

// Check if game functions exist before starting loop
if (typeof drawMainMenu !== 'function' || typeof updateMainMenu !== 'function') {
    console.error("Core Menu functions are missing! Cannot start.");
} else {
    currentGameState = 'MainMenu'; // Start at the main menu
    gameLoop(); // Start the main animation loop
    console.log("Game loop started.");
} 