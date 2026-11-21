import { Board, PieceColor } from './model.js';
import { ChessAI } from './ai.js';
import { MLChessAI } from './ml-ai.js';
import { judgeRepetition } from './repetition.js';
import { determinize } from './jieqi.js';

// 揭棋: how many possible worlds the AI searches for each move; the move most of them pick is played.
const JIEQI_WORLDS = 5;

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
  // 揭棋 against the AI: the pieces start face down (see Board.createJieqiBoard).
  JIEQI: 'jieqi',
};

class GameController {
  constructor() {
    this.board = Board.createInitialBoard();
    /** The position the game started from; the moves are replayed from it to judge a repetition. */
    this.initialBoard = this.board;
    this.gameMode = GAME_MODE.PLAYER_VS_AI;
    this.aiColor = PieceColor.BLACK;
    this.myColor = null; // for online mode
    this.difficulty = AI_DIFFICULTY.PROFESSIONAL;
    this.ai = this._createAI(this.difficulty);
    this.moveHistory = [];
    this.positionHashes = [];
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
    this.board = this.gameMode === GAME_MODE.JIEQI ? Board.createJieqiBoard() : Board.createInitialBoard();
    this.initialBoard = this.board;
    this.moveHistory = [];
    this.positionHashes = [this.board.getPositionHash()];
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
    this.positionHashes.push(this.board.getPositionHash());

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
    this.positionHashes.push(this.board.getPositionHash());

    if (this.onMoveCompleted) this.onMoveCompleted(matched);
    if (this.onBoardUpdated) this.onBoardUpdated(this.board);

    this.checkGameOver();
    return true;
  }

  async makeAIMove() {
    if (this.gameOver) return;

    if (this.onAIThinking) this.onAIThinking(true);

    try {
      let move = this.board.jieqi
        ? await this._findJieqiMove()
        : await this.ai.findBestMove(this.board, this.moveHistory);

      if (!move && !this.board.jieqi && this.ai instanceof MLChessAI) {
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

      // A move that repeats a position a third time ends the game: by the rules of repetition
      // a loss for the side that was checking or chasing all along, otherwise a draw. A win
      // that way is taken; a loss is never played while any other move is not one; a draw is
      // avoided while a move to a fresh position exists.
      let verdict = this._repetitionVerdict(move);
      if (verdict !== 'win') {
        const win = this.board.getAllLegalMoves().find(m => this._repetitionVerdict(m) === 'win');
        if (win) { move = win; verdict = 'win'; }
      }
      if (verdict === 'loss' || verdict === 'draw') {
        const legalMoves = this.board.getAllLegalMoves().filter(m => !(m.from.equals(move.from) && m.to.equals(move.to)));
        let candidates = legalMoves.filter(m => this._repetitionVerdict(m) === null);
        if (candidates.length === 0 && verdict === 'loss') {
          candidates = legalMoves.filter(m => this._repetitionVerdict(m) !== 'loss');
        }
        const alternative = await this._pickAmong(candidates);
        if (alternative) move = alternative;
      }

      this.board = this.board.makeMove(move);
      this.board.currentPlayer = PieceColor.opposite(this.board.currentPlayer);
      this.moveHistory.push(move);
      this.positionHashes.push(this.board.getPositionHash());

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

    const vsAI = this.gameMode === GAME_MODE.PLAYER_VS_AI || this.gameMode === GAME_MODE.JIEQI;
    const movesToUndo = (vsAI && this.moveHistory.length >= 2) ? 2 : 1;
    this.moveHistory.splice(-movesToUndo);

    this.board = this.initialBoard;
    this.positionHashes = [this.board.getPositionHash()];
    for (const move of this.moveHistory) {
      this.board = this.board.makeMove(move);
      this.board.currentPlayer = PieceColor.opposite(this.board.currentPlayer);
      this.positionHashes.push(this.board.getPositionHash());
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

  /**
   * What playing [move] now would be judged if it repeats a position a third time, from the
   * mover's side: 'win', 'draw' or 'loss'; null if it repeats nothing a third time.
   */
  _repetitionVerdict(move) {
    const testBoard = this.board.makeMove(move);
    testBoard.currentPlayer = PieceColor.opposite(testBoard.currentPlayer);
    const hash = testBoard.getPositionHash();
    if (this.positionHashes.filter(h => h === hash).length < 2) return null;
    const result = judgeRepetition(this.initialBoard, [...this.moveHistory, move], [...this.positionHashes, hash]);
    if (!result || !result.winner) return 'draw';
    return result.winner === move.piece.color ? 'win' : 'loss';
  }

  /** The best of [candidates] by a search restricted to them (the neural network cannot be restricted, so the alpha-beta search chooses for it). */
  async _pickAmong(candidates) {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    if (this.board.jieqi) return this._findJieqiMove(candidates);
    const searcher = this.ai instanceof ChessAI ? this.ai : new ChessAI(3, 2000, 2);
    const found = await searcher.findBestMove(this.board, this.moveHistory, candidates);
    return candidates.find(m => found && m.from.equals(found.from) && m.to.equals(found.to)) || candidates[0];
  }

  /**
   * 揭棋: nobody knows what a face-down piece is, the AI included. It searches a few possible worlds
   * (each face-down piece given a type from what is still unseen, jieqi.js) and plays the move most
   * of them pick. [only] limits the choice to some of the legal moves.
   */
  async _findJieqiMove(only = null) {
    const legal = only || this.board.getAllLegalMoves();
    if (legal.length <= 1) return legal[0] || null;
    const same = (a, b) => a.from.equals(b.from) && a.to.equals(b.to);
    // The neural network knows only the ordinary game; 揭棋 is searched at the master's settings.
    const d = this.difficulty.isML ? AI_DIFFICULTY.MASTER : this.difficulty;
    const votes = new Map();
    for (let i = 0; i < JIEQI_WORLDS; i++) {
      const world = determinize(this.board, this.moveHistory);
      // The world's own moves, so a piece turned up in the search shows the world's type.
      const rootMoves = world.getAllLegalMoves().filter(m => legal.some(l => same(l, m)));
      const searcher = new ChessAI(d.depth, Math.max(300, d.timeLimit / JIEQI_WORLDS), d.quiescenceDepth);
      const found = await searcher.findBestMove(world, this.moveHistory, rootMoves);
      if (!found) continue;
      const key = found.from.toString() + found.to.toString();
      votes.set(key, (votes.get(key) || 0) + 1);
    }
    let bestKey = null, bestVotes = 0;
    for (const [key, n] of votes) {
      if (n > bestVotes) { bestKey = key; bestVotes = n; }
    }
    return legal.find(m => m.from.toString() + m.to.toString() === bestKey) || legal[0];
  }

  checkGameOver() {
    if (this.board.isCheckmate()) {
      const winner = PieceColor.opposite(this.board.currentPlayer);
      const result = { type: 'checkmate', winner };
      this.gameOver = true;
      if (this.onGameOver) this.onGameOver(result);
      return true;
    }

    // 困毙: no legal move without being in check. In xiangqi that loses, as mate does.
    if (this.board.isStalemate()) {
      const winner = PieceColor.opposite(this.board.currentPlayer);
      const result = { type: 'stalemate', winner };
      this.gameOver = true;
      if (this.onGameOver) this.onGameOver(result);
      return true;
    }

    // The same position a third time: judged by the moves of the cycle (repetition.js). The
    // side that checked or chased with every move loses; otherwise a draw by repetition.
    const judged = judgeRepetition(this.initialBoard, this.moveHistory, this.positionHashes);
    if (judged) {
      const result = { type: judged.type, winner: judged.winner };
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
