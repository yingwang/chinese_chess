import { Board, PieceColor } from './model.js';
import { ChessAI } from './ai.js';
import { MLChessAI } from './ml-ai.js';

const AI_DIFFICULTY = {
  BEGINNER:     { depth: 2, timeLimit: 1000,  quiescenceDepth: 0 },
  INTERMEDIATE: { depth: 3, timeLimit: 2000, quiescenceDepth: 2 },
  ADVANCED:     { depth: 4, timeLimit: 3000, quiescenceDepth: 3 },
  PROFESSIONAL: { depth: 5, timeLimit: 5000, quiescenceDepth: 4 },
  MASTER:       { depth: 7, timeLimit: 10000, quiescenceDepth: 5 },
  ML:           { depth: 0, timeLimit: 0,   quiescenceDepth: 0, isML: true },
};

const GAME_MODE = {
  PLAYER_VS_PLAYER: 'pvp',
  PLAYER_VS_AI: 'pvai',
  AI_VS_AI: 'aivai',
  ONLINE: 'online',
};

class GameController {
  constructor() {
    this.board = Board.createInitialBoard();
    this.gameMode = GAME_MODE.PLAYER_VS_AI;
    this.aiColor = PieceColor.BLACK;
    this.myColor = null; // for online mode
    this.difficulty = AI_DIFFICULTY.PROFESSIONAL;
    this.ai = this._createAI(this.difficulty);
    this.moveHistory = [];
    this.gameOver = false;

    // Callbacks set by UI
    this.onBoardUpdated = null;
    this.onGameOver = null;
    this.onAIThinking = null;
    this.onMoveCompleted = null;
    this.onMLFallback = null;
  }

  _createAI(difficulty) {
    if (difficulty.isML) {
      const mlAI = new MLChessAI();
      mlAI.loadModel();
      return mlAI;
    }
    return new ChessAI(difficulty.depth, difficulty.timeLimit, difficulty.quiescenceDepth);
  }

  _fallbackAI() {
    return new ChessAI(
      AI_DIFFICULTY.MASTER.depth,
      AI_DIFFICULTY.MASTER.timeLimit,
      AI_DIFFICULTY.MASTER.quiescenceDepth
    );
  }

  setGameMode(mode, aiColor = PieceColor.BLACK) {
    this.gameMode = mode;
    this.aiColor = aiColor;
  }

  setOnlineColor(color) {
    this.myColor = color;
  }

  setDifficulty(difficulty) {
    this.difficulty = difficulty;
    this.ai = this._createAI(difficulty);
  }

  startNewGame() {
    this.board = Board.createInitialBoard();
    this.moveHistory = [];
    this.gameOver = false;
    if (this.ai?.clearCache) this.ai.clearCache();

    if (this.onBoardUpdated) this.onBoardUpdated(this.board);

    if (this.shouldAIMove()) {
      this.makeAIMove();
    }
  }

  getCurrentBoard() {
    return this.board;
  }

  getMoveHistory() {
    return [...this.moveHistory];
  }

  makePlayerMove(move) {
    if (this.gameOver) return false;
    if (!this.isPlayerTurn()) return false;

    const legalMoves = this.board.getAllLegalMoves();
    const matched = legalMoves.find(
      m => m.from.equals(move.from) && m.to.equals(move.to)
    );
    if (!matched) return false;

    this.board = this.board.makeMove(matched);
    this.board.currentPlayer = PieceColor.opposite(this.board.currentPlayer);
    this.moveHistory.push(matched);

    if (this.onMoveCompleted) this.onMoveCompleted(matched);
    if (this.onBoardUpdated) this.onBoardUpdated(this.board);

    if (this.checkGameOver()) return true;

    if (this.shouldAIMove()) {
      this.makeAIMove();
    }

    return true;
  }

  // Apply opponent's move in online mode
  makeRemoteMove(move) {
    if (this.gameOver) return false;

    const legalMoves = this.board.getAllLegalMoves();
    const matched = legalMoves.find(
      m => m.from.equals(move.from) && m.to.equals(move.to)
    );
    if (!matched) {
      console.error('Invalid remote move:', move);
      return false;
    }

    this.board = this.board.makeMove(matched);
    this.board.currentPlayer = PieceColor.opposite(this.board.currentPlayer);
    this.moveHistory.push(matched);

    if (this.onMoveCompleted) this.onMoveCompleted(matched);
    if (this.onBoardUpdated) this.onBoardUpdated(this.board);

    this.checkGameOver();
    return true;
  }

  async makeAIMove() {
    if (this.gameOver) return;

    if (this.onAIThinking) this.onAIThinking(true);

    try {
      let move = await this.ai.findBestMove(this.board, this.moveHistory);

      if (!move && this.ai instanceof MLChessAI) {
        const error = this.ai.loadError || 'unknown error';
        console.warn('ML model unavailable:', error, '- falling back to Alpha-Beta AI');
        this.ai = this._fallbackAI();
        move = await this.ai.findBestMove(this.board, this.moveHistory);
        if (this.onMLFallback) this.onMLFallback(error);
      }

      if (!move) {
        if (this.onAIThinking) this.onAIThinking(false);
        return;
      }

      this.board = this.board.makeMove(move);
      this.board.currentPlayer = PieceColor.opposite(this.board.currentPlayer);
      this.moveHistory.push(move);

      if (this.onMoveCompleted) this.onMoveCompleted(move);
      if (this.onBoardUpdated) this.onBoardUpdated(this.board);

      if (this.checkGameOver()) return;

      if (this.gameMode === GAME_MODE.AI_VS_AI) {
        setTimeout(() => this.makeAIMove(), 500);
      }
    } finally {
      if (this.onAIThinking) this.onAIThinking(false);
    }
  }

  undoLastMove() {
    if (this.gameMode === GAME_MODE.ONLINE) return; // no undo in online
    if (this.moveHistory.length === 0) return;

    const movesToUndo = (this.gameMode === GAME_MODE.PLAYER_VS_AI && this.moveHistory.length >= 2) ? 2 : 1;
    this.moveHistory.splice(-movesToUndo);

    this.board = Board.createInitialBoard();
    for (const move of this.moveHistory) {
      this.board = this.board.makeMove(move);
      this.board.currentPlayer = PieceColor.opposite(this.board.currentPlayer);
    }

    this.gameOver = false;
    if (this.onBoardUpdated) this.onBoardUpdated(this.board);
  }

  isPlayerTurn() {
    if (this.gameMode === GAME_MODE.PLAYER_VS_PLAYER) return true;
    if (this.gameMode === GAME_MODE.AI_VS_AI) return false;
    if (this.gameMode === GAME_MODE.ONLINE) return this.board.currentPlayer === this.myColor;
    return this.board.currentPlayer !== this.aiColor;
  }

  shouldAIMove() {
    if (this.gameOver) return false;
    if (this.gameMode === GAME_MODE.PLAYER_VS_PLAYER) return false;
    if (this.gameMode === GAME_MODE.ONLINE) return false;
    if (this.gameMode === GAME_MODE.AI_VS_AI) return true;
    return this.board.currentPlayer === this.aiColor;
  }

  checkGameOver() {
    if (this.board.isCheckmate()) {
      const winner = PieceColor.opposite(this.board.currentPlayer);
      const result = { type: 'checkmate', winner };
      this.gameOver = true;
      if (this.onGameOver) this.onGameOver(result);
      return true;
    }

    if (this.board.isStalemate()) {
      const result = { type: 'stalemate' };
      this.gameOver = true;
      if (this.onGameOver) this.onGameOver(result);
      return true;
    }

    return false;
  }

  getAIStats() {
    return {
      nodesSearched: this.ai?.nodesSearched || 0,
      cacheSize: this.ai?.getCacheSize?.() || 0,
      difficulty: this.difficulty,
    };
  }
}

export { GameController, AI_DIFFICULTY, GAME_MODE };
