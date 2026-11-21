import { PieceColor, PieceType } from './model.js';
import { GameController, AI_DIFFICULTY, GAME_MODE } from './controller.js';
import { BoardView } from './view.js';
import { SoundManager } from './audio.js';
import { OnlineManager, CODE_LENGTH, normalizeCode, isValidCode, completeResult } from './online.js';
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
const resignBtn = document.getElementById('resign-btn');

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

// Theme
const themeBtn = document.getElementById('theme-btn');
const dialogThemeBtn = document.getElementById('dialog-theme-btn');
let currentTheme = localStorage.getItem('xiangqi_theme') || 'dark';
applyTheme(currentTheme);

function applyTheme(theme) {
    currentTheme = theme;
    document.body.setAttribute('data-theme', theme);
    const icon = theme === 'dark' ? '🌙' : '☀️';
    themeBtn.textContent = icon;
    dialogThemeBtn.textContent = icon;
    localStorage.setItem('xiangqi_theme', theme);
    boardView.setTheme(theme);
}

function toggleTheme() {
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
}
themeBtn.addEventListener('click', toggleTheme);
dialogThemeBtn.addEventListener('click', toggleTheme);

// i18n
const dialogLangBtn = document.getElementById('dialog-lang-btn');
function updateLangButtons() {
    const label = getLang() === 'zh' ? 'EN' : '中';
    langBtn.textContent = label;
    dialogLangBtn.textContent = label;
}
// Sound: one switch, shown in the controls and in the new-game dialog, so it can be turned off
// before a game starts. The setting is remembered across games and reloads.
const dialogSoundBtn = document.getElementById('dialog-sound-btn');
function updateSoundButtons() {
    const muted = soundManager.isMuted();
    soundBtn.textContent = muted ? t('soundOff') : t('soundOn');
    dialogSoundBtn.textContent = muted ? '🔇' : '🔊';
}
function toggleSound() {
    soundManager.toggleMute();
    updateSoundButtons();
}
soundBtn.addEventListener('click', toggleSound);
dialogSoundBtn.addEventListener('click', toggleSound);

// The page is written in Chinese; an English browser starts in English, so translate it once now.
setLang(getLang());
updateLangButtons();
updateSoundButtons();

function switchLang() {
    toggleLang();
    updateLangButtons();
    updateStatus();
    updateSoundButtons();
    if (reviewIndex !== null) renderReview();
}
langBtn.addEventListener('click', switchLang);
dialogLangBtn.addEventListener('click', switchLang);

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
    boardView.setHistory(controller.getMoveHistory());
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
    boardView.showCheck = true;
    boardView.draw();
    if (isOnlineGame) {
        // Deferred: when our own move ends the game, the move is sent first (right after
        // makePlayerMove returns); the database takes no move once a result is in.
        setTimeout(() => onlineManager.sendGameResult({
            type: result.type,
            winner: result.winner === PieceColor.RED ? 'red' : (result.winner === PieceColor.BLACK ? 'black' : null)
        }), 0);
        updateResignButton();
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
    leaveFinishedGame();
    controller.startNewGame();
    boardView.setFlipped(isOnlineGame && controller.myColor === PieceColor.BLACK);
    onlineManager.startListening(); // AFTER startNewGame to avoid race
    startTimer();
    updateResignButton();
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

onlineManager.onGameResult((written) => {
    if (controller.gameOver) return;
    // A resignation, or a result the other side reached before this board did. A stalemate from
    // an older page or app comes without its winner; the moves say who it is.
    const result = completeResult(written, onlineManager.moveTimes.length);
    controller.gameOver = true;
    if (onlineManager.endedAt == null) onlineManager.endedAt = onlineManager.serverNow();
    const iWin = (result.winner === 'red' && controller.myColor === PieceColor.RED) ||
                 (result.winner === 'black' && controller.myColor === PieceColor.BLACK);
    gameOverTitle.textContent = !result.winner ? t('draw') : (iWin ? t('youWin') : t('youLose'));
    const reasons = {
        resign: t('opponentResigned'), checkmate: t('checkmate'), perpetualCheck: t('perpetualCheck'),
        perpetualChase: t('perpetualChase'), stalemate: t('stalemate'), repetition: t('repetitionDraw'),
    };
    gameOverMessage.textContent = reasons[result.type] || '';
    boardView.showCheck = true;
    boardView.draw();
    openGameOverDialog(0);
    stopTimer();
    updateTimer();
    updateResignButton();
});

// === Resign (online) ===

function updateResignButton() {
    resignBtn.classList.toggle('hidden', !isOnlineGame || controller.gameOver);
}

resignBtn.addEventListener('click', () => {
    if (!isOnlineGame || controller.gameOver) return;
    if (!confirm(t('resignConfirm'))) return;
    controller.gameOver = true;
    onlineManager.resign();
    stopTimer();
    updateTimer();
    updateResignButton();
    gameOverTitle.textContent = t('youLose');
    gameOverMessage.textContent = t('youResigned');
    openGameOverDialog(0);
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

function formatClock(ms) {
    const total = Math.floor(Math.max(0, ms) / 1000);
    const minutes = String(Math.floor(total / 60)).padStart(2, '0');
    const seconds = String(total % 60).padStart(2, '0');
    return minutes + ':' + seconds;
}

function updateTimer() {
    if (isOnlineGame) {
        // Each side's time from the server's move times: the same on both screens.
        const { red, black } = onlineManager.getClocks(controller.gameOver);
        elapsedTimeEl.textContent = `${t('redShort')} ${formatClock(red)} · ${t('blackShort')} ${formatClock(black)}`;
        return;
    }
    if (!gameStartTime) return;
    elapsedTimeEl.textContent = formatClock(Date.now() - gameStartTime);
}

// === Notation ===

const CHINESE_NUMERALS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

// 揭棋: a face-down piece is written as the piece it moved as, then what it turned out to be,
// e.g. 車九进一揭炮.
function toChineseNotation(move) {
    const written = moveNotation(move, move.piece.hidden ? move.piece.moveAs : move.piece.type);
    if (!move.piece.hidden) return written;
    return written + t('revealed') + move.piece.type.getDisplayName(move.piece.color);
}

function moveNotation(move, type) {
    const piece = move.piece;
    const from = move.from;
    const to = move.to;
    const isRed = piece.color === PieceColor.RED;
    const pieceName = type.getDisplayName(piece.color);
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
        const isDiagonal = (type === PieceType.HORSE || type === PieceType.ELEPHANT || type === PieceType.ADVISOR);
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
        span.dataset.index = i;
        span.textContent = `${prefix}${toChineseNotation(move)} `;
        moveHistoryEl.appendChild(span);
    }
    moveHistoryEl.scrollTop = moveHistoryEl.scrollHeight;
}

// === Game Over dialog ===

function showGameOverDialog(result) {
    // Mate, 困毙 (stalemate: no legal move loses too), perpetual check and perpetual chase have
    // a winner; only a repetition is a draw.
    const reasons = {
        checkmate: t('checkmate'), stalemate: t('stalemate'),
        perpetualCheck: t('perpetualCheck'), perpetualChase: t('perpetualChase'),
    };
    if (!result.winner) {
        gameOverTitle.textContent = t('draw');
        gameOverMessage.textContent = t('repetitionDraw');
    } else if (isOnlineGame) {
        gameOverTitle.textContent = result.winner === controller.myColor ? t('youWin') : t('youLose');
        gameOverMessage.textContent = reasons[result.type] || '';
    } else {
        gameOverTitle.textContent = result.winner === PieceColor.RED ? t('redWins') : t('blackWins');
        gameOverMessage.textContent = reasons[result.type] || '';
    }
    // A moment on the board first, so the move that ended the game is seen before the box covers it.
    openGameOverDialog(900);
}

let gameOverTimer = null;
function openGameOverDialog(delay) {
    clearTimeout(gameOverTimer);
    gameOverTimer = setTimeout(() => {
        gameOverTimer = null;
        gameOverDialog.classList.remove('hidden');
    }, delay);
}

// === Review ===
// After a game, its moves can be stepped through from the start to the end. The board then only
// shows positions; a check is marked, so the mate can be followed.

const reviewBar = document.getElementById('review-bar');
const reviewPosEl = document.getElementById('review-pos');
const reviewFirstBtn = document.getElementById('review-first');
const reviewPrevBtn = document.getElementById('review-prev');
const reviewNextBtn = document.getElementById('review-next');
const reviewLastBtn = document.getElementById('review-last');
let reviewIndex = null; // moves shown, 0 to all of them; null when not reviewing

function enterReview() {
    reviewIndex = controller.getMoveHistory().length;
    boardView.interactive = false;
    boardView.showCheck = true;
    reviewBar.classList.remove('hidden');
    moveHistoryEl.classList.add('reviewing');
    renderReview();
}

function exitReview() {
    if (reviewIndex === null) return;
    reviewIndex = null;
    boardView.interactive = true;
    reviewBar.classList.add('hidden');
    moveHistoryEl.classList.remove('reviewing');
    for (const el of moveHistoryEl.querySelectorAll('.current')) el.classList.remove('current');
    boardView.setHistory(controller.getMoveHistory());
    boardView.setBoard(controller.getCurrentBoard());
}

// Before a new game or an undo: back to the live board, without the check marks of an ended game.
function leaveFinishedGame() {
    clearTimeout(gameOverTimer);
    exitReview();
    boardView.showCheck = false;
}

function renderReview() {
    const moves = controller.getMoveHistory();
    let board = controller.initialBoard;
    for (let i = 0; i < reviewIndex; i++) {
        board = board.makeMove(moves[i]);
        board.currentPlayer = PieceColor.opposite(board.currentPlayer);
    }
    boardView.setHistory(moves.slice(0, reviewIndex));
    boardView.setBoard(board);

    reviewPosEl.textContent = `${reviewIndex} / ${moves.length}`;
    reviewFirstBtn.disabled = reviewPrevBtn.disabled = reviewIndex === 0;
    reviewNextBtn.disabled = reviewLastBtn.disabled = reviewIndex === moves.length;

    let text = t('review') + ' · ';
    if (reviewIndex === 0) {
        text += t('reviewStart');
    } else {
        const move = moves[reviewIndex - 1];
        const side = move.piece.color === PieceColor.RED ? t('redShort') : t('blackShort');
        text += `${side} ${toChineseNotation(move)}`;
        if (board.isInCheck(board.currentPlayer)) {
            text += ' · ' + (board.isCheckmate() ? t('checkmate') : t('check'));
        }
    }
    statusEl.textContent = text;

    moveHistoryEl.querySelectorAll('.move-entry').forEach(el => {
        const current = Number(el.dataset.index) === reviewIndex - 1;
        el.classList.toggle('current', current);
        if (current) el.scrollIntoView({ block: 'nearest' });
    });
}

function stepReview(to) {
    if (reviewIndex === null) return;
    const total = controller.getMoveHistory().length;
    const next = Math.max(0, Math.min(total, to));
    if (next === reviewIndex) return;
    reviewIndex = next;
    renderReview();
}

reviewFirstBtn.addEventListener('click', () => stepReview(0));
reviewPrevBtn.addEventListener('click', () => stepReview(reviewIndex - 1));
reviewNextBtn.addEventListener('click', () => stepReview(reviewIndex + 1));
reviewLastBtn.addEventListener('click', () => stepReview(Infinity));
moveHistoryEl.addEventListener('click', (e) => {
    const entry = e.target.closest('.move-entry');
    if (entry && reviewIndex !== null) stepReview(Number(entry.dataset.index) + 1);
});
document.addEventListener('keydown', (e) => {
    if (reviewIndex === null || document.querySelector('.modal:not(.hidden)')) return;
    if (e.key === 'ArrowLeft') stepReview(reviewIndex - 1);
    else if (e.key === 'ArrowRight') stepReview(reviewIndex + 1);
    else if (e.key === 'Home') stepReview(0);
    else if (e.key === 'End') stepReview(Infinity);
    else return;
    e.preventDefault();
});

document.getElementById('game-over-review-btn').addEventListener('click', () => {
    gameOverDialog.classList.add('hidden');
    enterReview();
});

// === New Game dialog ===

function showNewGameDialog() {
    clearTimeout(gameOverTimer);
    if (isOnlineGame) {
        // Leaving a game still being played resigns it; the opponent is not left waiting.
        const live = !controller.gameOver;
        if (live && !confirm(t('leaveOnlineConfirm'))) return;
        if (live) { controller.gameOver = true; onlineManager.resign(); }
        onlineManager.leave(!live);
        isOnlineGame = false;
        stopTimer();
        updateResignButton();
    }
    updateDialogVisibility();
    newGameDialog.classList.remove('hidden');
}

function updateDialogVisibility() {
    const mode = gameModeSelect.value;
    const isAI = mode === 'PLAYER_VS_AI' || mode === 'AI_VS_AI' || mode === 'JIEQI';
    difficultySetting.style.display = isAI ? 'flex' : 'none';
    colorSetting.style.display = (mode === 'PLAYER_VS_AI' || mode === 'JIEQI') ? 'flex' : 'none';
}

gameModeSelect.addEventListener('change', updateDialogVisibility);
newGameBtn.addEventListener('click', showNewGameDialog);
settingsBtn.addEventListener('click', showNewGameDialog);
cancelBtn.addEventListener('click', () => newGameDialog.classList.add('hidden'));

startGameBtn.addEventListener('click', () => {
    const modeKey = gameModeSelect.value;
    leaveFinishedGame();

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
    boardView.setFlipped(isOnlineGame && controller.myColor === PieceColor.BLACK);

    newGameDialog.classList.add('hidden');
    infoPanel.classList.remove('hidden');
    moveHistoryEl.innerHTML = '';
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
    // Nobody joined: the room is deleted.
    onlineManager.leave(false);
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
    const code = normalizeCode(joinCodeInput.value);
    if (!isValidCode(code)) {
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
        leaveFinishedGame();
        controller.startNewGame();
    boardView.setFlipped(isOnlineGame && controller.myColor === PieceColor.BLACK);
        onlineManager.startListening(); // AFTER startNewGame

        onlineDialog.classList.add('hidden');
        infoPanel.classList.remove('hidden');
        moveHistoryEl.innerHTML = '';
        startTimer();
        updateResignButton();
        updateStatus();
        soundManager.startBackgroundMusic();
    } catch (e) {
        console.error('Join game failed:', e);
        if (e.message === 'INVALID_CODE') joinError.textContent = t('invalidCode');
        else if (e.message === 'GAME_FULL') joinError.textContent = t('gameFull');
        else if (e.message === 'GAME_FINISHED') joinError.textContent = t('gameFinished');
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

// === Undo ===

undoBtn.addEventListener('click', () => {
    if (aiThinking || isOnlineGame) return;
    leaveFinishedGame();
    controller.undoLastMove();
    updateStatus();
    updateMoveHistory();
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
    boardView.setFlipped(isOnlineGame && controller.myColor === PieceColor.BLACK);
showNewGameDialog();
statusEl.textContent = t('selectSettings');

// A shared link (?room=CODE, from the Android app's share sheet) opens the join form with the
// code filled in; joining is still the player's tap.
const sharedCode = normalizeCode(new URLSearchParams(location.search).get('room'));
if (isValidCode(sharedCode)) {
    newGameDialog.classList.add('hidden');
    showOnlineDialog();
    onlineMenu.style.display = 'none';
    onlineJoin.style.display = '';
    joinCodeInput.value = sharedCode;
}
joinCodeInput.maxLength = CODE_LENGTH + 2;
