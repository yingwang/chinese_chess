import { PieceColor, PieceType, Position, Move, Board } from './model.js';

// === Evaluator ===

const PIECE_SQUARE_TABLES = new Map();

PIECE_SQUARE_TABLES.set(PieceType.GENERAL, [
  [0,0,0,8,9,8,0,0,0],
  [0,0,0,9,9,9,0,0,0],
  [0,0,0,8,9,8,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,8,9,8,0,0,0],
  [0,0,0,9,9,9,0,0,0],
  [0,0,0,8,9,8,0,0,0]
]);

PIECE_SQUARE_TABLES.set(PieceType.ADVISOR, [
  [0,0,0,20,0,20,0,0,0],
  [0,0,0,0,23,0,0,0,0],
  [0,0,0,20,0,20,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,20,0,20,0,0,0],
  [0,0,0,0,23,0,0,0,0],
  [0,0,0,20,0,20,0,0,0]
]);

PIECE_SQUARE_TABLES.set(PieceType.ELEPHANT, [
  [0,0,20,0,0,0,20,0,0],
  [0,0,0,0,0,0,0,0,0],
  [18,0,0,0,23,0,0,0,18],
  [0,0,0,0,0,0,0,0,0],
  [0,0,20,0,0,0,20,0,0],
  [0,0,20,0,0,0,20,0,0],
  [0,0,0,0,0,0,0,0,0],
  [18,0,0,0,23,0,0,0,18],
  [0,0,0,0,0,0,0,0,0],
  [0,0,20,0,0,0,20,0,0]
]);

PIECE_SQUARE_TABLES.set(PieceType.HORSE, [
  [90,90,90,96,90,96,90,90,90],
  [90,96,103,97,94,97,103,96,90],
  [92,98,99,103,99,103,99,98,92],
  [93,108,100,107,100,107,100,108,93],
  [90,100,99,103,104,103,99,100,90],
  [90,98,101,102,103,102,101,98,90],
  [92,94,98,95,98,95,98,94,92],
  [93,92,94,95,92,95,94,92,93],
  [85,90,92,93,78,93,92,90,85],
  [88,85,90,88,90,88,90,85,88]
]);

PIECE_SQUARE_TABLES.set(PieceType.CHARIOT, [
  [206,208,207,213,214,213,207,208,206],
  [206,212,209,216,233,216,209,212,206],
  [206,208,207,214,216,214,207,208,206],
  [206,213,213,216,216,216,213,213,206],
  [208,211,211,214,215,214,211,211,208],
  [208,212,212,214,215,214,212,212,208],
  [204,209,204,212,214,212,204,209,204],
  [198,208,204,212,212,212,204,208,198],
  [200,208,206,212,200,212,206,208,200],
  [194,206,204,212,200,212,204,206,194]
]);

PIECE_SQUARE_TABLES.set(PieceType.CANNON, [
  [100,100,96,91,90,91,96,100,100],
  [98,98,96,92,89,92,96,98,98],
  [97,97,96,91,92,91,96,97,97],
  [96,99,99,98,100,98,99,99,96],
  [96,96,96,96,100,96,96,96,96],
  [95,96,99,96,100,96,99,96,95],
  [96,96,96,96,96,96,96,96,96],
  [97,96,100,99,101,99,100,96,97],
  [96,97,98,98,98,98,98,97,96],
  [96,96,97,99,99,99,97,96,96]
]);

PIECE_SQUARE_TABLES.set(PieceType.SOLDIER, [
  [9,9,9,11,13,11,9,9,9],
  [19,24,34,42,44,42,34,24,19],
  [19,24,32,37,37,37,32,24,19],
  [19,23,27,29,30,29,27,23,19],
  [14,18,20,27,29,27,20,18,14],
  [7,0,13,0,16,0,13,0,7],
  [7,0,7,0,15,0,7,0,7],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0]
]);

// Total non-general material for both sides, used for game phase detection
const TOTAL_START_MATERIAL = (900 * 2 + 450 * 2 + 400 * 2 + 120 * 2 + 120 * 2 + 100 * 5) * 2;

export const Evaluator = {
  CHECKMATE_SCORE: 100000,

  _getPositionalValue(piece) {
    const table = PIECE_SQUARE_TABLES.get(piece.type);
    if (!table) return 0;
    const row = piece.color === PieceColor.RED ? piece.position.row : 9 - piece.position.row;
    return table[row][piece.position.col];
  },

  _getGamePhase(board) {
    let material = 0;
    for (const piece of board.getAllPieces()) {
      if (piece.type !== PieceType.GENERAL) {
        material += piece.type.baseValue;
      }
    }
    // Returns a value 0..1 where 1 = opening, 0 = endgame
    return Math.min(1.0, material / TOTAL_START_MATERIAL);
  },

  _evaluateKingSafety(pieces, color) {
    let safety = 0;
    let advisorCount = 0, elephantCount = 0;
    let general = null;

    for (const p of pieces) {
      if (p.color !== color) continue;
      if (p.type === PieceType.ADVISOR) advisorCount++;
      else if (p.type === PieceType.ELEPHANT) elephantCount++;
      else if (p.type === PieceType.GENERAL) general = p;
    }

    // Penalty for missing defenders
    if (advisorCount === 0) safety -= 40;
    else if (advisorCount === 1) safety -= 15;
    if (elephantCount === 0) safety -= 25;
    else if (elephantCount === 1) safety -= 10;

    // Bonus for general staying in center column
    if (general && general.position.col === 4) safety += 10;

    return safety;
  },


  _evaluateThreats(allPieces, totalPieceCount) {
    let score = 0;
    for (const piece of allPieces) {
      const row = piece.position.row;
      const isRed = piece.color === PieceColor.RED;
      const sign = isRed ? 1 : -1;

      switch (piece.type) {
        case PieceType.SOLDIER: {
          const crossed = isRed ? row <= 4 : row >= 5;
          if (crossed) {
            score += sign * 20;
            if (piece.position.col >= 3 && piece.position.col <= 5) score += sign * 15;
          }
          break;
        }
        case PieceType.HORSE: {
          const inEnemy = isRed ? row <= 4 : row >= 5;
          if (inEnemy) score += sign * 15;
          const nearGeneral = isRed ? row <= 2 : row >= 7;
          if (nearGeneral && piece.position.col >= 2 && piece.position.col <= 6) score += sign * 25;
          break;
        }
        case PieceType.CHARIOT: {
          const deep = isRed ? row <= 2 : row >= 7;
          if (deep) score += sign * 20;
          break;
        }
        case PieceType.CANNON: {
          if (totalPieceCount <= 10) score -= sign * 30;
          break;
        }
      }
    }
    return score;
  },

  _evaluateChariotActivity(allPieces) {
    let score = 0;
    for (const piece of allPieces) {
      if (piece.type !== PieceType.CHARIOT) continue;
      const col = piece.position.col;
      const isRed = piece.color === PieceColor.RED;
      const sign = isRed ? 1 : -1;

      // Open file bonus (no own soldiers on same column)
      const hasSoldier = allPieces.some(p =>
        p.color === piece.color && p.type === PieceType.SOLDIER && p.position.col === col
      );
      if (!hasSoldier) score += sign * 15;

      // Penalty for staying on home rank
      const onHome = isRed ? piece.position.row === 9 : piece.position.row === 0;
      if (onHome) score -= sign * 20;
    }
    return score;
  },

  _evaluateHorseCoordination(allPieces) {
    let score = 0;
    for (const color of [PieceColor.RED, PieceColor.BLACK]) {
      const horses = allPieces.filter(p => p.type === PieceType.HORSE && p.color === color);
      if (horses.length === 2) {
        const dist = Math.abs(horses[0].position.row - horses[1].position.row) +
                     Math.abs(horses[0].position.col - horses[1].position.col);
        if (dist >= 2 && dist <= 4) score += (color === PieceColor.RED ? 10 : -10);
      }
    }
    return score;
  },

  evaluate(board) {
    const redGeneral = board._findGeneral(PieceColor.RED);
    const blackGeneral = board._findGeneral(PieceColor.BLACK);

    if (!redGeneral) return -this.CHECKMATE_SCORE;
    if (!blackGeneral) return this.CHECKMATE_SCORE;

    const currentPlayerInCheck = board.isInCheck(board.currentPlayer);
    if (currentPlayerInCheck && board.getAllLegalMoves().length === 0) {
      return board.currentPlayer === PieceColor.RED ? -this.CHECKMATE_SCORE : this.CHECKMATE_SCORE;
    }

    const allPieces = board.getAllPieces();
    const totalPieceCount = allPieces.length;
    let score = 0;

    // Material + positional (piece-square tables)
    for (const piece of allPieces) {
      const pieceScore = piece.type.baseValue + this._getPositionalValue(piece);
      score += piece.color === PieceColor.RED ? pieceScore : -pieceScore;
    }

    // King safety
    score += this._evaluateKingSafety(allPieces, PieceColor.RED);
    score -= this._evaluateKingSafety(allPieces, PieceColor.BLACK);

    // Threats (soldiers, horses near general, deep chariots, cannon endgame)
    score += this._evaluateThreats(allPieces, totalPieceCount);

    // Chariot activity (open file, home rank penalty)
    score += this._evaluateChariotActivity(allPieces);

    // Connected horses
    score += this._evaluateHorseCoordination(allPieces);

    // Check bonus
    if (board.isInCheck(PieceColor.RED)) score -= 30;
    if (board.isInCheck(PieceColor.BLACK)) score += 30;

    return score;
  }
};

// === TranspositionTable ===

export class TranspositionTable {
  static EXACT = 0;
  static LOWER_BOUND = 1;
  static UPPER_BOUND = 2;

  constructor(maxSize = 1000000) {
    this.maxSize = maxSize;
    this.table = new Map();
  }

  store(hash, depth, score, type, bestMove) {
    if (this.table.size >= this.maxSize) {
      // Evict oldest entries
      const keysToDelete = [];
      let count = 0;
      for (const key of this.table.keys()) {
        keysToDelete.push(key);
        count++;
        if (count >= this.maxSize / 4) break;
      }
      for (const key of keysToDelete) {
        this.table.delete(key);
      }
    }
    this.table.set(hash, { depth, score, type, bestMove });
  }

  probe(hash) {
    return this.table.get(hash) || null;
  }

  clear() {
    this.table.clear();
  }

  size() {
    return this.table.size;
  }
}

// === OpeningBook ===

export const OpeningBook = {
  _moves: new Map([
    // Initial moves: Central cannon, horse openings, soldier advance
    ['[]', ['7,1,7,4', '7,7,7,4', '9,1,7,2', '9,7,7,6', '6,4,5,4']],

    // Central cannon responses
    ['["7,1,7,4"]', ['0,7,2,6', '0,1,2,2', '2,7,2,4', '3,4,2,4']],
    ['["7,7,7,4"]', ['0,7,2,6', '0,1,2,2', '2,1,2,4']],

    // Central cannon, opponent develops horse
    ['["7,1,7,4","0,7,2,6"]', ['9,1,7,2', '9,7,7,6', '7,7,7,6']],
    ['["7,1,7,4","0,1,2,2"]', ['9,7,7,6', '9,1,7,2', '7,7,7,2']],

    // Horse openings
    ['["9,1,7,2"]', ['0,7,2,6', '0,1,2,2', '2,7,5,7']],
    ['["9,7,7,6"]', ['0,1,2,2', '0,7,2,6', '2,1,5,1']],

    // Central cannon + horse development (3-move lines)
    ['["7,1,7,4","0,7,2,6","9,1,7,2"]', ['9,0,8,0', '7,7,6,7', '6,2,5,2']],
    ['["7,1,7,4","0,7,2,6","9,7,7,6"]', ['0,1,2,2', '2,7,2,4']],
    ['["7,1,7,4","0,1,2,2","9,7,7,6"]', ['0,7,2,6', '2,7,2,4']],
    ['["7,1,7,4","0,1,2,2","9,1,7,2"]', ['0,7,2,6', '2,7,5,7']],

    // Screen horse defense responses
    ['["7,1,7,4","2,7,2,4"]', ['9,1,7,2', '9,7,7,6']],
    ['["7,7,7,4","2,1,2,4"]', ['9,1,7,2', '9,7,7,6']],

    // Pawn opening responses
    ['["6,4,5,4"]', ['3,4,4,4', '0,1,2,2', '0,7,2,6']],
    ['["6,4,5,4","3,4,4,4"]', ['7,1,7,4', '9,1,7,2', '9,7,7,6']],

    // Horse opening 3-move lines
    ['["9,1,7,2","0,7,2,6"]', ['7,1,7,4', '7,7,7,4', '6,4,5,4']],
    ['["9,1,7,2","0,1,2,2"]', ['7,1,7,4', '9,7,7,6']],
    ['["9,7,7,6","0,1,2,2"]', ['7,7,7,4', '7,1,7,4']],
    ['["9,7,7,6","0,7,2,6"]', ['7,7,7,4', '7,1,7,4', '6,4,5,4']],

    // 4-move lines
    ['["7,1,7,4","0,7,2,6","9,1,7,2","0,1,2,2"]', ['9,0,9,1', '7,7,7,2']],
    ['["7,1,7,4","0,7,2,6","9,7,7,6","0,1,2,2"]', ['9,0,9,1', '7,7,7,2']],
    ['["9,1,7,2","0,7,2,6","7,1,7,4","0,1,2,2"]', ['9,7,7,6', '7,7,7,2']],
  ]),

  getOpeningMove(moveHistory) {
    const key = JSON.stringify(moveHistory.map(m => `${m.from.row},${m.from.col},${m.to.row},${m.to.col}`));
    const candidates = this._moves.get(key);
    if (!candidates || candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  },

  matchOpeningMove(bookMove, legalMoves) {
    const [fromRow, fromCol, toRow, toCol] = bookMove.split(',').map(Number);
    return legalMoves.find(
      m => m.from.row === fromRow && m.from.col === fromCol &&
           m.to.row === toRow && m.to.col === toCol
    ) || null;
  }
};

// === ChessAI ===

const MAX_HISTORY_SCORE = 8000;

export class ChessAI {
  constructor(maxDepth = 6, timeLimit = 5000, quiescenceDepth = 3) {
    this.maxDepth = maxDepth;
    this.timeLimit = timeLimit;
    this.quiescenceDepth = quiescenceDepth;
    this.transpositionTable = new TranspositionTable();
    this.nodesSearched = 0;
    this.searchStartTime = 0;
    this.timeUp = false;
    this.killerMoves = [];
    this.historyTable = new Map();
  }

  _storeKillerMove(ply, move) {
    if (!this.killerMoves[ply]) this.killerMoves[ply] = [null, null];
    const km = this.killerMoves[ply];
    if (km[0] && move.from.equals(km[0].from) && move.to.equals(km[0].to)) return;
    km[1] = km[0];
    km[0] = move;
  }

  _isKillerMove(ply, move) {
    const km = this.killerMoves[ply];
    if (!km) return false;
    for (const k of km) {
      if (k && move.from.equals(k.from) && move.to.equals(k.to)) return true;
    }
    return false;
  }

  _historyKey(move) {
    return `${move.piece.color}:${move.piece.type.chineseName}:${move.to.row},${move.to.col}`;
  }

  _updateHistory(move, depth) {
    const key = this._historyKey(move);
    this.historyTable.set(key, (this.historyTable.get(key) || 0) + depth * depth);
  }

  _getHistoryScore(move) {
    return this.historyTable.get(this._historyKey(move)) || 0;
  }

  findBestMove(board, moveHistory = []) {
    return new Promise((resolve) => {
      // Check opening book first
      if (moveHistory.length < 8) {
        const bookMoveStr = OpeningBook.getOpeningMove(moveHistory);
        if (bookMoveStr) {
          const legalMoves = board.getAllLegalMoves();
          const bookMove = OpeningBook.matchOpeningMove(bookMoveStr, legalMoves);
          if (bookMove) {
            resolve(bookMove);
            return;
          }
        }
      }

      this.nodesSearched = 0;
      this.searchStartTime = Date.now();
      this.timeUp = false;
      this.killerMoves = [];
      this.historyTable.clear();

      const legalMoves = board.getAllLegalMoves();
      if (legalMoves.length === 0) {
        resolve(null);
        return;
      }
      if (legalMoves.length === 1) {
        resolve(legalMoves[0]);
        return;
      }

      const maximizing = board.currentPlayer === PieceColor.RED;
      let bestMove = legalMoves[0];
      let bestScore = maximizing ? -Infinity : Infinity;
      let currentDepth = 1;

      const iterateDepth = () => {
        if (currentDepth > this.maxDepth || this.timeUp) {
          resolve(bestMove);
          return;
        }

        const orderedMoves = this._orderMoves(board, legalMoves, 0);
        let depthBestScore = maximizing ? -Infinity : Infinity;
        let depthBestMove = orderedMoves[0];
        let moveIndex = 0;

        // Aspiration windows: use narrow window around previous best score
        let alpha, beta;
        if (currentDepth >= 3 && isFinite(bestScore)) {
          const ASPIRATION_WINDOW = 50;
          alpha = bestScore - ASPIRATION_WINDOW;
          beta = bestScore + ASPIRATION_WINDOW;
        } else {
          alpha = -Infinity;
          beta = Infinity;
        }
        const aspirationAlpha = alpha;
        const aspirationBeta = beta;

        const processMove = () => {
          if (moveIndex >= orderedMoves.length || this.timeUp) {
            if (!this.timeUp) {
              // If aspiration window failed, re-search with full window
              if (currentDepth >= 3 && isFinite(bestScore) &&
                  (depthBestScore <= aspirationAlpha || depthBestScore >= aspirationBeta)) {
                // Re-search with full window
                depthBestScore = maximizing ? -Infinity : Infinity;
                depthBestMove = orderedMoves[0];
                moveIndex = 0;
                const processFullWindow = () => {
                  if (moveIndex >= orderedMoves.length || this.timeUp) {
                    if (!this.timeUp) {
                      bestMove = depthBestMove;
                      bestScore = depthBestScore;
                    }
                    currentDepth++;
                    setTimeout(iterateDepth, 0);
                    return;
                  }
                  const move = orderedMoves[moveIndex];
                  const newBoard = board.makeMove(move);
                  newBoard.currentPlayer = PieceColor.opposite(board.currentPlayer);
                  const score = this._alphaBeta(newBoard, currentDepth - 1, -Infinity, Infinity, !maximizing);
                  if (this.timeUp) { resolve(bestMove); return; }
                  if (maximizing ? score > depthBestScore : score < depthBestScore) {
                    depthBestScore = score;
                    depthBestMove = move;
                  }
                  moveIndex++;
                  if (moveIndex % 3 === 0) { setTimeout(processFullWindow, 0); } else { processFullWindow(); }
                };
                processFullWindow();
                return;
              }
              bestMove = depthBestMove;
              bestScore = depthBestScore;
            }
            currentDepth++;
            setTimeout(iterateDepth, 0);
            return;
          }

          const move = orderedMoves[moveIndex];
          const newBoard = board.makeMove(move);
          newBoard.currentPlayer = PieceColor.opposite(board.currentPlayer);

          const score = this._alphaBeta(
            newBoard, currentDepth - 1,
            alpha, beta,
            !maximizing
          );

          if (this.timeUp) {
            resolve(bestMove);
            return;
          }

          if (maximizing) {
            if (score > depthBestScore) {
              depthBestScore = score;
              depthBestMove = move;
            }
            if (score > alpha) alpha = score;
          } else {
            if (score < depthBestScore) {
              depthBestScore = score;
              depthBestMove = move;
            }
            if (score < beta) beta = score;
          }

          moveIndex++;
          // Yield to the event loop periodically
          if (moveIndex % 3 === 0) {
            setTimeout(processMove, 0);
          } else {
            processMove();
          }
        };

        processMove();
      };

      setTimeout(iterateDepth, 0);
    });
  }

  _alphaBeta(board, depth, alpha, beta, maximizing, isNullMove = false, ply = 0) {
    this.nodesSearched++;

    // Time check every 1000 nodes
    if (this.nodesSearched % 1000 === 0) {
      if (Date.now() - this.searchStartTime >= this.timeLimit) {
        this.timeUp = true;
        return 0;
      }
    }
    if (this.timeUp) return 0;

    const hash = board.getPositionHash();

    // Transposition table lookup
    const ttEntry = this.transpositionTable.probe(hash);
    if (ttEntry && ttEntry.depth >= depth) {
      if (ttEntry.type === TranspositionTable.EXACT) return ttEntry.score;
      if (ttEntry.type === TranspositionTable.LOWER_BOUND) alpha = Math.max(alpha, ttEntry.score);
      if (ttEntry.type === TranspositionTable.UPPER_BOUND) beta = Math.min(beta, ttEntry.score);
      if (alpha >= beta) return ttEntry.score;
    }

    const inCheck = board.isInCheck(board.currentPlayer);

    // Check extension: extend search when in check
    let effectiveDepth = depth;
    if (inCheck) {
      effectiveDepth++;
    }

    if (effectiveDepth <= 0) {
      return this._quiescenceSearch(board, this.quiescenceDepth, alpha, beta, maximizing);
    }

    // Null Move Pruning: skip our turn and see if opponent can still beat us
    if (!isNullMove && !inCheck && effectiveDepth >= 3) {
      const nullBoard = board.copy();
      nullBoard.currentPlayer = PieceColor.opposite(board.currentPlayer);
      const nullMoveReduction = effectiveDepth >= 6 ? 3 : 2;
      const nullScore = this._alphaBeta(nullBoard, effectiveDepth - 1 - nullMoveReduction, alpha, beta, !maximizing, true, ply + 1);
      if (this.timeUp) return 0;
      if (maximizing && nullScore >= beta) return beta;
      if (!maximizing && nullScore <= alpha) return alpha;
    }

    const legalMoves = board.getAllLegalMoves();

    if (legalMoves.length === 0) {
      if (inCheck) {
        return maximizing ? -Evaluator.CHECKMATE_SCORE + ply
                          : Evaluator.CHECKMATE_SCORE - ply;
      }
      return 0; // Stalemate
    }

    // Futility pruning: at shallow depths, skip quiet moves that can't raise alpha
    const FUTILITY_MARGINS = [0, 200, 400, 600];
    let futilityPruning = false;
    let staticEval = 0;
    if (!inCheck && effectiveDepth <= 3 && Math.abs(alpha) < Evaluator.CHECKMATE_SCORE - 100) {
      staticEval = Evaluator.evaluate(board);
      if (maximizing && staticEval + FUTILITY_MARGINS[effectiveDepth] <= alpha) {
        futilityPruning = true;
      } else if (!maximizing && staticEval - FUTILITY_MARGINS[effectiveDepth] >= beta) {
        futilityPruning = true;
      }
    }

    const orderedMoves = this._orderMoves(board, legalMoves, ply);
    let bestMove = orderedMoves[0];
    let bestScore;
    let ttType;
    const alphaOrig = alpha;
    const betaOrig = beta;

    if (maximizing) {
      bestScore = -Infinity;
      for (let i = 0; i < orderedMoves.length; i++) {
        const move = orderedMoves[i];
        const isQuiet = !move.isCapture();

        // Apply futility pruning to late quiet moves
        if (futilityPruning && i > 0 && isQuiet && !this._isKillerMove(ply, move)) {
          continue;
        }

        const newBoard = board.makeMove(move);
        newBoard.currentPlayer = PieceColor.opposite(board.currentPlayer);

        let score;

        if (i === 0) {
          score = this._alphaBeta(newBoard, effectiveDepth - 1, alpha, beta, false, false, ply + 1);
        } else {
          // Late Move Reductions for quiet non-killer late moves
          let reduction = 0;
          if (i >= 3 && effectiveDepth >= 3 && isQuiet && !inCheck && !this._isKillerMove(ply, move)) {
            reduction = 1;
            if (i >= 6) reduction = 2;
            reduction = Math.min(reduction, effectiveDepth - 1);
          }

          // PVS: null window search
          score = this._alphaBeta(newBoard, effectiveDepth - 1 - reduction, alpha, alpha + 1, false, false, ply + 1);

          // Re-search with full window if needed
          if (score > alpha && (score < beta || reduction > 0)) {
            score = this._alphaBeta(newBoard, effectiveDepth - 1, alpha, beta, false, false, ply + 1);
          }
        }

        if (this.timeUp) return 0;
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
        alpha = Math.max(alpha, score);
        if (alpha >= beta) {
          if (isQuiet) {
            this._storeKillerMove(ply, move);
            this._updateHistory(move, effectiveDepth);
          }
          break;
        }
      }
    } else {
      bestScore = Infinity;
      for (let i = 0; i < orderedMoves.length; i++) {
        const move = orderedMoves[i];
        const isQuiet = !move.isCapture();

        // Apply futility pruning to late quiet moves
        if (futilityPruning && i > 0 && isQuiet && !this._isKillerMove(ply, move)) {
          continue;
        }

        const newBoard = board.makeMove(move);
        newBoard.currentPlayer = PieceColor.opposite(board.currentPlayer);

        let score;

        if (i === 0) {
          score = this._alphaBeta(newBoard, effectiveDepth - 1, alpha, beta, true, false, ply + 1);
        } else {
          // Late Move Reductions for quiet non-killer late moves
          let reduction = 0;
          if (i >= 3 && effectiveDepth >= 3 && isQuiet && !inCheck && !this._isKillerMove(ply, move)) {
            reduction = 1;
            if (i >= 6) reduction = 2;
            reduction = Math.min(reduction, effectiveDepth - 1);
          }

          // PVS: null window search
          score = this._alphaBeta(newBoard, effectiveDepth - 1 - reduction, beta - 1, beta, true, false, ply + 1);

          // Re-search with full window if needed
          if (score < beta && (score > alpha || reduction > 0)) {
            score = this._alphaBeta(newBoard, effectiveDepth - 1, alpha, beta, true, false, ply + 1);
          }
        }

        if (this.timeUp) return 0;
        if (score < bestScore) {
          bestScore = score;
          bestMove = move;
        }
        beta = Math.min(beta, score);
        if (alpha >= beta) {
          if (isQuiet) {
            this._storeKillerMove(ply, move);
            this._updateHistory(move, effectiveDepth);
          }
          break;
        }
      }
    }

    if (bestScore <= alphaOrig) {
      ttType = TranspositionTable.UPPER_BOUND;
    } else if (bestScore >= betaOrig) {
      ttType = TranspositionTable.LOWER_BOUND;
    } else {
      ttType = TranspositionTable.EXACT;
    }

    this.transpositionTable.store(hash, effectiveDepth, bestScore, ttType, bestMove);
    return bestScore;
  }

  _quiescenceSearch(board, depth, alpha, beta, maximizing) {
    const standPat = Evaluator.evaluate(board);

    if (depth <= 0) return standPat;

    if (maximizing) {
      if (standPat >= beta) return beta;
      if (standPat > alpha) alpha = standPat;
    } else {
      if (standPat <= alpha) return alpha;
      if (standPat < beta) beta = standPat;
    }

    const captures = board.getLegalCaptureMoves();

    if (captures.length === 0) return standPat;

    // Order captures by MVV-LVA
    captures.sort((a, b) => {
      const aVal = (a.capturedPiece ? a.capturedPiece.type.baseValue : 0) - a.piece.type.baseValue;
      const bVal = (b.capturedPiece ? b.capturedPiece.type.baseValue : 0) - b.piece.type.baseValue;
      return bVal - aVal;
    });

    // Delta pruning margin
    const DELTA_MARGIN = 200;

    if (maximizing) {
      for (const move of captures) {
        // Delta pruning: skip captures that can't possibly improve alpha
        if (move.capturedPiece && standPat + move.capturedPiece.type.baseValue + DELTA_MARGIN < alpha) {
          continue;
        }
        const newBoard = board.makeMove(move);
        newBoard.currentPlayer = PieceColor.opposite(board.currentPlayer);
        const score = this._quiescenceSearch(newBoard, depth - 1, alpha, beta, false);
        if (this.timeUp) return 0;
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
      }
      return alpha;
    } else {
      for (const move of captures) {
        // Delta pruning: skip captures that can't possibly lower beta
        if (move.capturedPiece && standPat - move.capturedPiece.type.baseValue - DELTA_MARGIN > beta) {
          continue;
        }
        const newBoard = board.makeMove(move);
        newBoard.currentPlayer = PieceColor.opposite(board.currentPlayer);
        const score = this._quiescenceSearch(newBoard, depth - 1, alpha, beta, true);
        if (this.timeUp) return 0;
        if (score <= alpha) return alpha;
        if (score < beta) beta = score;
      }
      return beta;
    }
  }

  _orderMoves(board, moves, ply) {
    const hash = board.getPositionHash();
    const ttEntry = this.transpositionTable.probe(hash);
    const ttMove = ttEntry ? ttEntry.bestMove : null;

    return moves.slice().sort((a, b) => {
      return this._moveScore(b, ttMove, ply) - this._moveScore(a, ttMove, ply);
    });
  }

  _moveScore(move, ttMove, ply) {
    let score = 0;

    // TT move gets highest priority
    if (ttMove && move.from.equals(ttMove.from) && move.to.equals(ttMove.to)) {
      return 100000;
    }

    // Captures scored by MVV-LVA
    if (move.isCapture()) {
      score += 10000 + (move.capturedPiece.type.baseValue * 10) - move.piece.type.baseValue;
    }

    // Killer moves
    if (this._isKillerMove(ply, move)) {
      score += 9000;
    }

    // History heuristic
    score += Math.min(this._getHistoryScore(move), MAX_HISTORY_SCORE);

    // Bonus for attacking moves towards opponent territory
    if (move.piece.type === PieceType.CHARIOT || move.piece.type === PieceType.CANNON) {
      // Chariot/cannon entering enemy territory
      const inEnemyTerritory = move.piece.color === PieceColor.RED
        ? move.to.row <= 4
        : move.to.row >= 5;
      if (inEnemyTerritory) {
        score += 80;
      }
    }

    // Center control (cols 3-5)
    if (move.to.col >= 3 && move.to.col <= 5) {
      score += 50;
    }

    // Forward moves
    if (move.piece.color === PieceColor.RED) {
      score += (move.from.row - move.to.row) * 5;
    } else {
      score += (move.to.row - move.from.row) * 5;
    }

    return score;
  }

  clearCache() {
    this.transpositionTable.clear();
    this.killerMoves = [];
    this.historyTable.clear();
  }

  getCacheSize() {
    return this.transpositionTable.size();
  }
}

/**
 * Benchmark: run AI on test positions and compare with Pikafish results.
 * Call from browser console: runBenchmark()
 */
export async function runBenchmark(depth = 6) {
  const pikafish = [
    { fen: "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1",
      desc: "Initial position", pk_move: "c3c4", pk_score: 27 },
    { fen: "4ka3/4a4/4b4/9/9/9/4n4/4B4/4A4/3AK3R w - - 0 1",
      desc: "Endgame: R vs N+A", pk_move: "i0i5", pk_score: 354 },
    { fen: "r1bakab1r/9/1cn4c1/p1p1p1p1p/9/2P6/P3P1P1P/1C2C1N2/9/RNBAKAB1R w - - 0 1",
      desc: "Opening cannon pin", pk_move: "b0c2", pk_score: 460 },
    { fen: "r1bak4/4a4/2n1b4/p3p1R1p/2p6/6P2/P1P1P3P/2N1C4/4A4/1RBAK1B2 w - - 0 1",
      desc: "Complex mid-game", pk_move: "b0b7", pk_score: 859 },
    { fen: "3k1a3/4a4/b8/5R3/9/9/9/B3C4/4A4/4KA3 w - - 0 1",
      desc: "R+C mate puzzle", pk_move: "f6d6", pk_score: "mate 7" },
  ];

  const ai = new ChessAI(depth, 30000);
  const results = [];

  console.log(`%c=== Chinese Chess AI Benchmark (depth ${depth}) ===`, 'font-weight:bold;font-size:14px');

  for (const test of pikafish) {
    console.log(`\n%c${test.desc}`, 'font-weight:bold');
    console.log(`FEN: ${test.fen}`);

    const board = Board.fromFen(test.fen);
    ai.clearCache();

    const start = performance.now();
    const move = ai.findBestMove(board);
    const elapsed = Math.round(performance.now() - start);

    // Convert move to pikafish format (col-as-letter + row)
    const colLetter = 'abcdefghi';
    const myMove = move
      ? `${colLetter[move.from.col]}${9 - move.from.row}${colLetter[move.to.col]}${9 - move.to.row}`
      : 'none';

    const match = myMove === test.pk_move ? '✅' : '❌';

    console.log(`  Our AI:    ${myMove} (${elapsed}ms)`);
    console.log(`  Pikafish:  ${test.pk_move} (score: ${test.pk_score})`);
    console.log(`  Match: ${match}`);

    results.push({ desc: test.desc, myMove, pkMove: test.pk_move, match: myMove === test.pk_move, time: elapsed });
  }

  console.log(`\n%c=== Summary ===`, 'font-weight:bold;font-size:14px');
  const matched = results.filter(r => r.match).length;
  console.table(results.map(r => ({
    Position: r.desc,
    'Our Move': r.myMove,
    'Pikafish': r.pkMove,
    Match: r.match ? '✅' : '❌',
    'Time(ms)': r.time
  })));
  console.log(`Matched ${matched}/${results.length} moves with Pikafish (3000+ Elo)`);

  return results;
}

// Expose to window for console access
if (typeof window !== 'undefined') {
  window.runBenchmark = runBenchmark;
  window.Board = Board;
  window.ChessAI = ChessAI;
}
