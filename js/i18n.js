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
    selectSettings: '请选择游戏设置',
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
    selectSettings: 'Select game settings',
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
