import { PieceColor, PieceType } from './model.js';
import { GameController, AI_DIFFICULTY, GAME_MODE } from './controller.js';
import { BoardView } from './view.js';
import { SoundManager } from './audio.js';
import { OnlineManager } from './online.js';
import { t, toggleLang, getLang } from './i18n.js';

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

// Online dialog elements
const onlineDialog = document.getElementById('online-dialog');
const onlineMenu = document.getElementById('online-menu');
const onlineWaiting = document.getElementById('online-waiting');
const onlineJoin = document.getElementById('online-join');
const createGameBtn = document.getElementById('create-game-btn');
const joinGameBtn = document.getElementById('join-game-btn');
const onlineBackBtn = document.getElementById('online-back-btn');
const roomCodeDisplay = document.getElementById('room-code-display');
const copyCodeBtn = document.getElementById('copy-code-btn');
const cancelOnlineBtn = document.getElementById('cancel-online-btn');
const joinCodeInput = document.getElementById('join-code-input');
const joinError = document.getElementById('join-error');
const confirmJoinBtn = document.getElementById('confirm-join-btn');
const joinBackBtn = document.getElementById('join-back-btn');

// Initialize
const boardView = new BoardView(canvas);
const controller = new GameController();
const soundManager = new SoundManager();
const onlineManager = new OnlineManager();
let aiThinking = false;
let gameStartTime = null;
let timerInterval = null;
let isOnlineGame = false;

// i18n
langBtn.textContent = getLang() === 'zh' ? 'EN' : '中';
langBtn.addEventListener('click', () => {
    toggleLang();
    langBtn.textContent = getLang() === 'zh' ? 'EN' : '中';
    updateStatus();
    soundBtn.textContent = soundManager.isMuted() ? t('soundOff') : t('soundOn');
});

// === Controller callbacks ===

boardView.setOnMoveListener((move) => {
    if (aiThinking) return;
    const success = controller.makePlayerMove(move);
    if (success && isOnlineGame) {
        // Send move to opponent
        const lastMove = controller.getMoveHistory().slice(-1)[0];
        if (lastMove) onlineManager.sendMove(lastMove);
    }
});

controller.onBoardUpdated = (board) => {
    boardView.setBoard(board);
    if (!aiThinking) updateStatus();
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
    if (isOnlineGame) {
        onlineManager.sendGameResult({
            type: result.type,
            winner: result.winner === PieceColor.RED ? 'red' : (result.winner === PieceColor.BLACK ? 'black' : null)
        });
    }
    showGameOverDialog(result);
};

controller.onMLFallback = (error) => {
    console.warn('ML fallback reason:', error);
    statusEl.textContent = getLang() === 'zh'
        ? '神经网络不可用，已切换为大师级 AI'
        : 'Neural network unavailable, using Master AI';
    setTimeout(() => updateStatus(), 5000);
};

// === Online callbacks ===

onlineManager.onRemoteMove((move) => {
    controller.makeRemoteMove(move);
});

onlineManager.onOpponentJoined(() => {
    onlineDialog.classList.add('hidden');
    infoPanel.classList.remove('hidden');
    controller.startNewGame();
    onlineManager.startListening(); // AFTER startNewGame to avoid race
    startTimer();
    updateStatus();
    soundManager.startBackgroundMusic();
    statusEl.textContent = t('opponentJoined');
    setTimeout(() => updateStatus(), 2000);
});

onlineManager.onOpponentConnection((connected) => {
    if (!isOnlineGame) return;
    if (!connected) {
        statusEl.textContent = t('opponentDisconnected');
    } else {
        statusEl.textContent = t('opponentReconnected');
        setTimeout(() => updateStatus(), 2000);
    }
});

onlineManager.onGameResult((result) => {
    if (controller.gameOver) return;
    if (result.type === 'resign') {
        controller.gameOver = true;
        const iWin = (result.winner === 'red' && controller.myColor === PieceColor.RED) ||
                     (result.winner === 'black' && controller.myColor === PieceColor.BLACK);
        gameOverTitle.textContent = iWin ? t('youWin') : t('youLose');
        gameOverMessage.textContent = t('opponentResigned');
        gameOverDialog.classList.remove('hidden');
        stopTimer();
    }
});

// === Status ===

function updateStatus() {
    if (controller.gameOver) return;
    const board = controller.getCurrentBoard();
    const inCheck = board.isInCheck(board.currentPlayer);
    const isRed = board.currentPlayer === PieceColor.RED;

    if (isOnlineGame) {
        const myTurn = controller.isPlayerTurn();
        if (inCheck) {
            statusEl.textContent = myTurn ? t('yourTurnCheck') : t('opponentTurnCheck');
        } else {
            statusEl.textContent = myTurn ? t('yourTurn') : t('opponentTurn');
        }
    } else {
        if (inCheck) {
            statusEl.textContent = isRed ? t('redTurnCheck') : t('blackTurnCheck');
        } else {
            statusEl.textContent = isRed ? t('redTurn') : t('blackTurn');
        }
    }
}

// === Timer ===

function startTimer() {
    stopTimer();
    gameStartTime = Date.now();
    elapsedTimeEl.textContent = '00:00';
    timerInterval = setInterval(updateTimer, 1000);
}

function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function updateTimer() {
    if (!gameStartTime) return;
    const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
    const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const seconds = String(elapsed % 60).padStart(2, '0');
    elapsedTimeEl.textContent = minutes + ':' + seconds;
}

// === Notation ===

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
        const isDiagonal = (piece.type === PieceType.HORSE || piece.type === PieceType.ELEPHANT || piece.type === PieceType.ADVISOR);
        lastNum = isDiagonal ? formatNum(toCol) : formatNum(Math.abs(to.row - from.row));
    }
    return `${pieceName}${formatNum(fromCol)}${direction}${lastNum}`;
}

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

// === Game Over dialog ===

function showGameOverDialog(result) {
    if (isOnlineGame) {
        const myColor = controller.myColor;
        if (result.type === 'checkmate') {
            const iWin = result.winner === myColor;
            gameOverTitle.textContent = iWin ? t('youWin') : t('youLose');
            gameOverMessage.textContent = t('checkmate');
        } else {
            gameOverTitle.textContent = t('draw');
            gameOverMessage.textContent = t('stalemate');
        }
    } else {
        if (result.type === 'checkmate') {
            gameOverTitle.textContent = result.winner === PieceColor.RED ? t('redWins') : t('blackWins');
            gameOverMessage.textContent = t('checkmate');
        } else {
            gameOverTitle.textContent = t('draw');
            gameOverMessage.textContent = t('stalemate');
        }
    }
    gameOverDialog.classList.remove('hidden');
}

// === New Game dialog ===

function showNewGameDialog() {
    if (isOnlineGame) {
        onlineManager.cleanup();
        isOnlineGame = false;
    }
    updateDialogVisibility();
    newGameDialog.classList.remove('hidden');
}

function updateDialogVisibility() {
    const mode = gameModeSelect.value;
    const isAI = mode === 'PLAYER_VS_AI' || mode === 'AI_VS_AI';
    difficultySetting.style.display = isAI ? 'flex' : 'none';
    colorSetting.style.display = mode === 'PLAYER_VS_AI' ? 'flex' : 'none';
}

gameModeSelect.addEventListener('change', updateDialogVisibility);
newGameBtn.addEventListener('click', showNewGameDialog);
settingsBtn.addEventListener('click', showNewGameDialog);
cancelBtn.addEventListener('click', () => newGameDialog.classList.add('hidden'));

startGameBtn.addEventListener('click', () => {
    const modeKey = gameModeSelect.value;

    if (modeKey === 'ONLINE') {
        newGameDialog.classList.add('hidden');
        showOnlineDialog();
        return;
    }

    const mode = GAME_MODE[modeKey];
    const difficulty = AI_DIFFICULTY[difficultySelect.value];
    const aiColor = colorSelect.value === 'RED' ? PieceColor.BLACK : PieceColor.RED;

    isOnlineGame = false;
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

// === Online dialog ===

function showOnlineDialog() {
    onlineMenu.style.display = '';
    onlineWaiting.style.display = 'none';
    onlineJoin.style.display = 'none';
    joinError.textContent = '';
    onlineDialog.classList.remove('hidden');
}

createGameBtn.addEventListener('click', async () => {
    onlineMenu.style.display = 'none';
    onlineWaiting.style.display = '';
    roomCodeDisplay.textContent = '...';
    statusEl.textContent = t('connecting');

    try {
        const { gameCode, color } = await onlineManager.createGame('red');
        roomCodeDisplay.textContent = gameCode;

        isOnlineGame = true;
        controller.setGameMode(GAME_MODE.ONLINE);
        controller.setOnlineColor(PieceColor.RED);
        boardView.resetCaptured();
        moveHistoryEl.innerHTML = '';
    } catch (e) {
        console.error('Create game failed:', e);
        onlineMenu.style.display = '';
        onlineWaiting.style.display = 'none';
        joinError.textContent = e.message;
    }
});

copyCodeBtn.addEventListener('click', () => {
    const code = roomCodeDisplay.textContent;
    navigator.clipboard.writeText(code).then(() => {
        copyCodeBtn.textContent = t('codeCopied');
        setTimeout(() => copyCodeBtn.textContent = t('copyCode'), 2000);
    });
});

cancelOnlineBtn.addEventListener('click', () => {
    onlineManager.cleanup();
    isOnlineGame = false;
    onlineDialog.classList.add('hidden');
});

joinGameBtn.addEventListener('click', () => {
    onlineMenu.style.display = 'none';
    onlineJoin.style.display = '';
    joinCodeInput.value = '';
    joinError.textContent = '';
    joinCodeInput.focus();
});

confirmJoinBtn.addEventListener('click', async () => {
    const code = joinCodeInput.value.trim().toUpperCase();
    if (code.length !== 4) {
        joinError.textContent = t('invalidCode');
        return;
    }

    joinError.textContent = t('connecting');
    try {
        const { gameCode, color } = await onlineManager.joinGame(code);

        isOnlineGame = true;
        const myPieceColor = color === 'red' ? PieceColor.RED : PieceColor.BLACK;
        controller.setGameMode(GAME_MODE.ONLINE);
        controller.setOnlineColor(myPieceColor);
        controller.startNewGame();
        onlineManager.startListening(); // AFTER startNewGame

        onlineDialog.classList.add('hidden');
        infoPanel.classList.remove('hidden');
        boardView.resetCaptured();
        moveHistoryEl.innerHTML = '';
        startTimer();
        updateStatus();
        soundManager.startBackgroundMusic();
    } catch (e) {
        console.error('Join game failed:', e);
        if (e.message === 'INVALID_CODE') joinError.textContent = t('invalidCode');
        else if (e.message === 'GAME_FULL') joinError.textContent = t('gameFull');
        else joinError.textContent = e.message;
    }
});

joinBackBtn.addEventListener('click', () => {
    onlineJoin.style.display = 'none';
    onlineMenu.style.display = '';
});

onlineBackBtn.addEventListener('click', () => {
    onlineDialog.classList.add('hidden');
});

// === Undo / Sound ===

undoBtn.addEventListener('click', () => {
    if (aiThinking || isOnlineGame) return;
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

// === Canvas resize ===

function resizeCanvas() { boardView.resize(); }
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// === Init ===

controller.startNewGame();
showNewGameDialog();
statusEl.textContent = t('selectSettings');
