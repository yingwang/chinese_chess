import { PieceColor, PieceType } from './model.js';
import { GameController, AI_DIFFICULTY, GAME_MODE } from './controller.js';
import { BoardView } from './view.js';
import { SoundManager } from './audio.js';
import { t, toggleLang, getLang, setLang } from './i18n.js';

// DOM elements
const canvas = document.getElementById('board-canvas');
const statusEl = document.getElementById('status');
const newGameBtn = document.getElementById('new-game-btn');
const undoBtn = document.getElementById('undo-btn');
const settingsBtn = document.getElementById('settings-btn');
const soundBtn = document.getElementById('sound-btn');
const langBtn = document.getElementById('lang-btn');
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
const elapsedTimeEl = document.getElementById('elapsed-time');
const moveHistoryEl = document.getElementById('move-history');
const infoPanel = document.getElementById('info-panel');

// Initialize
const boardView = new BoardView(canvas);
const controller = new GameController();
const soundManager = new SoundManager();
let aiThinking = false;
let gameStartTime = null;
let timerInterval = null;

// i18n setup
langBtn.textContent = getLang() === 'zh' ? 'EN' : '中';

langBtn.addEventListener('click', () => {
    toggleLang();
    langBtn.textContent = getLang() === 'zh' ? 'EN' : '中';
    updateStatus();
    soundBtn.textContent = soundManager.isMuted() ? t('soundOff') : t('soundOn');
});

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
    updateMoveHistory();

    const board = controller.getCurrentBoard();
    if (board.isInCheck(board.currentPlayer)) {
        soundManager.playCheckSound();
    } else if (move.isCapture()) {
        soundManager.playCaptureSound();
    } else {
        soundManager.playMoveSound();
    }
};

controller.onAIThinking = (thinking) => {
    aiThinking = thinking;
    boardView.setAIThinking(thinking);
    if (thinking) {
        statusEl.textContent = t('thinking');
    } else {
        updateStatus();
    }
};

controller.onGameOver = (result) => {
    stopTimer();
    showGameOverDialog(result);
};

controller.onMLFallback = (error) => {
    console.warn('ML fallback reason:', error);
    statusEl.textContent = getLang() === 'zh'
        ? '神经网络不可用，已切换为大师级 AI'
        : 'Neural network unavailable, using Master AI';
    // Brief display then resume normal status after AI moves
    setTimeout(() => updateStatus(), 5000);
};

// Status
function updateStatus() {
    if (controller.gameOver) return;
    const board = controller.getCurrentBoard();
    const inCheck = board.isInCheck(board.currentPlayer);
    const isRed = board.currentPlayer === PieceColor.RED;
    if (inCheck) {
        statusEl.textContent = isRed ? t('redTurnCheck') : t('blackTurnCheck');
    } else {
        statusEl.textContent = isRed ? t('redTurn') : t('blackTurn');
    }
}

// Timer
function startTimer() {
    stopTimer();
    gameStartTime = Date.now();
    elapsedTimeEl.textContent = '00:00';
    timerInterval = setInterval(updateTimer, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateTimer() {
    if (!gameStartTime) return;
    const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
    const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const seconds = String(elapsed % 60).padStart(2, '0');
    elapsedTimeEl.textContent = minutes + ':' + seconds;
}

// Chess notation
const CHINESE_NUMERALS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

function toChineseNotation(move) {
    const piece = move.piece;
    const from = move.from;
    const to = move.to;
    const isRed = piece.color === PieceColor.RED;

    const pieceName = piece.type.getDisplayName(piece.color);
    const fromCol = isRed ? 9 - from.col : from.col + 1;
    const toCol = isRed ? 9 - to.col : to.col + 1;
    const formatNum = (n) => isRed ? CHINESE_NUMERALS[n] : String(n);

    let direction, lastNum;
    if (from.row === to.row) {
        direction = '平';
        lastNum = formatNum(toCol);
    } else {
        const isAdvancing = isRed ? (to.row < from.row) : (to.row > from.row);
        direction = isAdvancing ? '进' : '退';
        const isDiagonal = (piece.type === PieceType.HORSE ||
                            piece.type === PieceType.ELEPHANT ||
                            piece.type === PieceType.ADVISOR);
        lastNum = isDiagonal ? formatNum(toCol) : formatNum(Math.abs(to.row - from.row));
    }

    return `${pieceName}${formatNum(fromCol)}${direction}${lastNum}`;
}

// Move history
function updateMoveHistory() {
    const history = controller.getMoveHistory();
    moveHistoryEl.innerHTML = '';
    for (let i = 0; i < history.length; i++) {
        const move = history[i];
        const colorClass = move.piece.color === PieceColor.RED ? 'red' : 'black';
        const moveNum = Math.floor(i / 2) + 1;
        const prefix = (i % 2 === 0) ? moveNum + '. ' : '';
        const span = document.createElement('span');
        span.className = 'move-entry ' + colorClass;
        span.textContent = `${prefix}${toChineseNotation(move)} `;
        moveHistoryEl.appendChild(span);
    }
    moveHistoryEl.scrollTop = moveHistoryEl.scrollHeight;
}

// Game Over dialog
function showGameOverDialog(result) {
    if (result.type === 'checkmate') {
        gameOverTitle.textContent = result.winner === PieceColor.RED ? t('redWins') : t('blackWins');
        gameOverMessage.textContent = t('checkmate');
    } else {
        gameOverTitle.textContent = t('draw');
        gameOverMessage.textContent = t('stalemate');
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

settingsBtn.addEventListener('click', showNewGameDialog);

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
    infoPanel.classList.remove('hidden');
    moveHistoryEl.innerHTML = '';
    boardView.resetCaptured();
    startTimer();
    updateStatus();

    soundManager.startBackgroundMusic();
});

undoBtn.addEventListener('click', () => {
    if (aiThinking) return;
    controller.undoLastMove();
    updateStatus();
    updateMoveHistory();
});

soundBtn.addEventListener('click', () => {
    const muted = soundManager.toggleMute();
    soundBtn.textContent = muted ? t('soundOff') : t('soundOn');
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

// Start default game and show setup dialog on initial load
controller.startNewGame();
showNewGameDialog();
statusEl.textContent = t('selectSettings');
