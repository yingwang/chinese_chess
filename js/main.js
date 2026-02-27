import { PieceColor } from './model.js';
import { GameController, AI_DIFFICULTY, GAME_MODE } from './controller.js';
import { BoardView } from './view.js';

// DOM elements
const canvas = document.getElementById('board-canvas');
const statusEl = document.getElementById('status');
const newGameBtn = document.getElementById('new-game-btn');
const undoBtn = document.getElementById('undo-btn');
const newGameDialog = document.getElementById('new-game-dialog');
const gameOverDialog = document.getElementById('game-over-dialog');
const gameModeSelect = document.getElementById('game-mode-select');
const difficultySelect = document.getElementById('difficulty-select');
const colorSelect = document.getElementById('color-select');
const difficultySetting = document.getElementById('difficulty-setting');
const colorSetting = document.getElementById('color-setting');
const startGameBtn = document.getElementById('start-game-btn');
const cancelBtn = document.getElementById('cancel-btn');
const gameOverTitle = document.getElementById('game-over-title');
const gameOverMessage = document.getElementById('game-over-message');
const gameOverNewGameBtn = document.getElementById('game-over-new-game-btn');

// Initialize
const boardView = new BoardView(canvas);
const controller = new GameController();
let aiThinking = false;

// Connect view to controller
boardView.setOnMoveListener((move) => {
    if (aiThinking) return;
    controller.makePlayerMove(move);
});

controller.onBoardUpdated = (board) => {
    boardView.setBoard(board);
    if (!aiThinking) {
        updateStatus();
    }
};

controller.onMoveCompleted = (move) => {
    boardView.highlightMove(move);
    updateStatus();
};

controller.onAIThinking = (thinking) => {
    aiThinking = thinking;
    if (thinking) {
        statusEl.textContent = '思考中...';
    } else {
        updateStatus();
    }
};

controller.onGameOver = (result) => {
    showGameOverDialog(result);
};

// Status
function updateStatus() {
    if (controller.gameOver) return;
    const board = controller.getCurrentBoard();
    const inCheck = board.isInCheck(board.currentPlayer);
    const playerName = board.currentPlayer === PieceColor.RED ? '红方' : '黑方';
    statusEl.textContent = playerName + '走棋' + (inCheck ? ' — 将军!' : '');
}

// Game Over dialog
function showGameOverDialog(result) {
    if (result.type === 'checkmate') {
        const winnerName = result.winner === PieceColor.RED ? '红方' : '黑方';
        gameOverTitle.textContent = winnerName + '获胜!';
        gameOverMessage.textContent = '将杀!';
    } else {
        gameOverTitle.textContent = '和棋';
        gameOverMessage.textContent = '无子可走，平局。';
    }
    gameOverDialog.classList.remove('hidden');
}

// New Game dialog
function showNewGameDialog() {
    updateDialogVisibility();
    newGameDialog.classList.remove('hidden');
}

function updateDialogVisibility() {
    const mode = gameModeSelect.value;
    const isAI = mode !== 'PLAYER_VS_PLAYER';
    difficultySetting.style.display = isAI ? 'flex' : 'none';
    colorSetting.style.display = mode === 'PLAYER_VS_AI' ? 'flex' : 'none';
}

gameModeSelect.addEventListener('change', updateDialogVisibility);

newGameBtn.addEventListener('click', showNewGameDialog);

cancelBtn.addEventListener('click', () => {
    newGameDialog.classList.add('hidden');
});

startGameBtn.addEventListener('click', () => {
    const modeKey = gameModeSelect.value;
    const mode = GAME_MODE[modeKey];
    const difficulty = AI_DIFFICULTY[difficultySelect.value];
    const aiColor = colorSelect.value === 'RED' ? PieceColor.BLACK : PieceColor.RED;

    controller.setGameMode(mode, aiColor);
    if (difficulty) controller.setDifficulty(difficulty);
    controller.startNewGame();

    newGameDialog.classList.add('hidden');
    updateStatus();
});

undoBtn.addEventListener('click', () => {
    if (aiThinking) return;
    controller.undoLastMove();
    updateStatus();
});

gameOverNewGameBtn.addEventListener('click', () => {
    gameOverDialog.classList.add('hidden');
    showNewGameDialog();
});

// Canvas resize
function resizeCanvas() {
    boardView.resize();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Start initial game
controller.startNewGame();
