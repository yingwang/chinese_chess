const translations = {
  zh: {
    title: '中国象棋',
    redTurn: '红方走棋',
    blackTurn: '黑方走棋',
    redTurnCheck: '红方走棋 — 将军!',
    blackTurnCheck: '黑方走棋 — 将军!',
    thinking: '思考中...',
    newGame: '新游戏',
    undo: '悔棋',
    settings: '设置',
    soundOn: '🔊 音效',
    soundOff: '🔇 音效',
    time: '时间:',
    moveHistory: '走棋记录:',
    noHistory: '暂无记录',
    gameMode: '游戏模式:',
    pvai: '人机对战',
    pvp: '双人对战',
    aivai: '电脑对战',
    difficulty: '难度:',
    beginner: '初级',
    intermediate: '中级',
    advanced: '高级',
    professional: '专业',
    master: '大师',
    mlAI: 'AI 神经网络',
    playAs: '执棋:',
    redFirst: '红方 (先手)',
    blackSecond: '黑方 (后手)',
    start: '开始',
    cancel: '取消',
    redWins: '红方获胜!',
    blackWins: '黑方获胜!',
    checkmate: '将杀!',
    draw: '和棋',
    stalemate: '无子可走，平局。',
    perpetualCheck: '长将判负!',
    repetitionDraw: '三次重复局面，和棋。',
    selectSettings: '请选择游戏设置',
    online: '在线对战',
    createGame: '创建房间',
    joinGameBtn: '加入房间',
    gameCode: '房间号:',
    enterCode: '输入房间号',
    copyCode: '复制',
    codeCopied: '已复制!',
    waiting: '等待对手加入...',
    opponentJoined: '对手已加入!',
    opponentDisconnected: '对手断线',
    opponentReconnected: '对手已重连',
    yourTurn: '你的回合',
    opponentTurn: '对手回合',
    yourTurnCheck: '你的回合 — 将军!',
    opponentTurnCheck: '对手回合 — 将军!',
    resign: '认输',
    youWin: '你赢了!',
    youLose: '你输了!',
    opponentResigned: '对手认输',
    invalidCode: '无效房间号',
    gameFull: '房间已满',
    connecting: '连接中...',
  },
  en: {
    title: 'Chinese Chess',
    redTurn: "Red's turn",
    blackTurn: "Black's turn",
    redTurnCheck: "Red's turn — Check!",
    blackTurnCheck: "Black's turn — Check!",
    thinking: 'Thinking...',
    newGame: 'New Game',
    undo: 'Undo',
    settings: 'Settings',
    soundOn: '🔊 Sound',
    soundOff: '🔇 Sound',
    time: 'Time:',
    moveHistory: 'Moves:',
    noHistory: 'No moves yet',
    gameMode: 'Mode:',
    pvai: 'Player vs AI',
    pvp: 'Player vs Player',
    aivai: 'AI vs AI',
    difficulty: 'Difficulty:',
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
    professional: 'Professional',
    master: 'Master',
    mlAI: 'Neural Network',
    playAs: 'Play as:',
    redFirst: 'Red (first)',
    blackSecond: 'Black (second)',
    start: 'Start',
    cancel: 'Cancel',
    redWins: 'Red Wins!',
    blackWins: 'Black Wins!',
    checkmate: 'Checkmate!',
    draw: 'Draw',
    stalemate: 'No legal moves. Draw.',
    perpetualCheck: 'Perpetual check! Loss.',
    repetitionDraw: 'Threefold repetition. Draw.',
    selectSettings: 'Select game settings',
    online: 'Online',
    createGame: 'Create Room',
    joinGameBtn: 'Join Room',
    gameCode: 'Room Code:',
    enterCode: 'Enter room code',
    copyCode: 'Copy',
    codeCopied: 'Copied!',
    waiting: 'Waiting for opponent...',
    opponentJoined: 'Opponent joined!',
    opponentDisconnected: 'Opponent disconnected',
    opponentReconnected: 'Opponent reconnected',
    yourTurn: 'Your turn',
    opponentTurn: "Opponent's turn",
    yourTurnCheck: 'Your turn — Check!',
    opponentTurnCheck: "Opponent's turn — Check!",
    resign: 'Resign',
    youWin: 'You Win!',
    youLose: 'You Lose!',
    opponentResigned: 'Opponent resigned',
    invalidCode: 'Invalid room code',
    gameFull: 'Room is full',
    connecting: 'Connecting...',
  }
};

let currentLang = (navigator.language || '').startsWith('zh') ? 'zh' : 'en';

export function t(key) {
  return translations[currentLang][key] || translations.zh[key] || key;
}

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  currentLang = lang;
  applyTranslations();
}

export function toggleLang() {
  currentLang = currentLang === 'zh' ? 'en' : 'zh';
  applyTranslations();
  return currentLang;
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const text = t(key);
    if (el.tagName === 'OPTION') {
      el.textContent = text;
    } else {
      el.textContent = text;
    }
  });
}
