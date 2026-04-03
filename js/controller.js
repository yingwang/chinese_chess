import { Board, PieceColor } from './model.js';
import { ChessAI } from './ai.js';
import { MLChessAI } from './ml-ai.js';

const AI_DIFFICULTY = {
  BEGINNER:     { depth: 1, timeLimit: 500,  quiescenceDepth: 0 },
  INTERMEDIATE: { depth: 2, timeLimit: 1000, quiescenceDepth: 1 },
  ADVANCED:     { depth: 3, timeLimit: 2000, quiescenceDepth: 2 },
  PROFESSIONAL: { depth: 4, timeLimit: 5000, quiescenceDepth: 3 },
  MASTER:       { depth: 6, timeLimit: 8000, quiescenceDepth: 4 },
  ML:           { depth: 0, timeLimit: 0,   quiescenceDepth: 0, isML: true },
};

const GAME_MODE = {
  PLAYER_VS_PLAYER: 'pvp',
  PLAYER_VS_AI: 'pvai',
  AI_VS_AI: 'aivai',
};

class GameController {
  constructor() {
    this.board = Board.createInitialBoard();
    this.gameMode = GAME_MODE.PLAYER_VS_AI;
    this.aiColor = PieceColor.BLACK;
    this.difficulty = AI_DIFFICULTY.PROFESSIONAL;
    this.ai = this._createAI(this.difficulty);
    this.moveHistory = [];
    this.gameOver = false;

    // Callbacks set by UI
    this.onBoardUpdated = null;
    this.onGameOver = null;
    this.onAIThinking = null;
    this.onMoveCompleted = null;
  }

  _createAI(difficulty) {
    if (difficulty.isML) {
      const mlAI = new MLChessAI();
      mlAI.loadModel(); // preload
      return mlAI;
    }
    return new ChessAI(difficulty.depth, difficulty.timeLimit, difficulty.quiescenceDepth);
  }

  setGameMode(mode, aiColor = PieceColor.BLACK) {
    this.gameMode = mode;
    this.aiColor = aiColor;
  }

  setDifficulty(difficulty) {
    this.difficulty = difficulty;
    this.ai = this._createAI(difficulty);
  }

  startNewGame() {
    this.board = Board.createInitialBoard();
    this.moveHistory = [];
    this.gameOver = false;
    this.ai.clearCache();

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

  async makeAIMove() {
    if (this.gameOver) return;

    if (this.onAIThinking) this.onAIThinking(true);

    try {
      const move = await this.ai.findBestMove(this.board, this.moveHistory);
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
    if (this.moveHistory.length === 0) return;

    const movesToUndo = (this.gameMode === GAME_MODE.PLAYER_VS_AI && this.moveHistory.length >= 2) ? 2 : 1;

    this.moveHistory.splice(-movesToUndo);

    // Rebuild board from history
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
    return this.board.currentPlayer !== this.aiColor;
  }

  shouldAIMove() {
    if (this.gameOver) return false;
    if (this.gameMode === GAME_MODE.PLAYER_VS_PLAYER) return false;
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
      nodesSearched: this.ai.nodesSearched,
      cacheSize: this.ai.getCacheSize(),
      difficulty: this.difficulty,
    };
  }
}

export { GameController, AI_DIFFICULTY, GAME_MODE };
