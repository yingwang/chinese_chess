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

  _evaluateKingSafety(board, color) {
    const general = board._findGeneral(color);
    if (!general) return 0;
    let safety = 0;
    const gRow = general.position.row;
    const gCol = general.position.col;

    // Bonus for each advisor/elephant alive (they protect the king)
    for (const piece of board.getPiecesByColor(color)) {
      if (piece.type === PieceType.ADVISOR) {
        safety += 15;
        // Extra bonus if adjacent to general
        if (Math.abs(piece.position.row - gRow) <= 1 && Math.abs(piece.position.col - gCol) <= 1) {
          safety += 10;
        }
      } else if (piece.type === PieceType.ELEPHANT) {
        safety += 10;
      }
    }

    // Penalty if general is exposed on the center column with no blockers
    if (gCol === 4) {
      let hasBlocker = false;
      const dir = color === PieceColor.RED ? -1 : 1;
      for (let r = gRow + dir; r >= 0 && r <= 9; r += dir) {
        if (board.getPiece(new Position(r, gCol))) {
          hasBlocker = true;
          break;
        }
      }
      if (!hasBlocker) {
        safety -= 20;
      }
    }

    return safety;
  },

  _evaluateMobility(board, color) {
    const savedPlayer = board.currentPlayer;
    board.currentPlayer = color;
    let mobility = 0;
    for (const piece of board.getPiecesByColor(color)) {
      if (piece.type === PieceType.GENERAL || piece.type === PieceType.ADVISOR || piece.type === PieceType.ELEPHANT) continue;
      const moves = piece.getLegalMoves(board);
      if (piece.type === PieceType.CHARIOT) {
        mobility += moves.length * 3;
      } else if (piece.type === PieceType.CANNON) {
        mobility += moves.length * 2;
      } else if (piece.type === PieceType.HORSE) {
        mobility += moves.length * 2;
      } else {
        mobility += moves.length;
      }
    }
    board.currentPlayer = savedPlayer;
    return mobility;
  },

  _evaluatePieceCoordination(board, color) {
    let score = 0;
    const chariots = [];
    const cannons = [];
    const horses = [];

    for (const piece of board.getPiecesByColor(color)) {
      if (piece.type === PieceType.CHARIOT) chariots.push(piece);
      else if (piece.type === PieceType.CANNON) cannons.push(piece);
      else if (piece.type === PieceType.HORSE) horses.push(piece);
    }

    // Connected chariots (same row or column)
    if (chariots.length === 2) {
      if (chariots[0].position.row === chariots[1].position.row ||
          chariots[0].position.col === chariots[1].position.col) {
        score += 20;
      }
    }

    // Horse-cannon coordination: bonus when they're near each other
    for (const horse of horses) {
      for (const cannon of cannons) {
        const dist = Math.abs(horse.position.row - cannon.position.row) +
                     Math.abs(horse.position.col - cannon.position.col);
        if (dist <= 3) {
          score += 10;
        }
      }
    }

    return score;
  },

  evaluate(board) {
    const redGeneral = board._findGeneral(PieceColor.RED);
    const blackGeneral = board._findGeneral(PieceColor.BLACK);

    // Checkmate detection
    if (!redGeneral) return -this.CHECKMATE_SCORE;
    if (!blackGeneral) return this.CHECKMATE_SCORE;

    // Only do expensive checkmate check when in check (rare)
    const currentPlayerInCheck = board.isInCheck(board.currentPlayer);
    if (currentPlayerInCheck && board.getAllLegalMoves().length === 0) {
      return board.currentPlayer === PieceColor.RED ? -this.CHECKMATE_SCORE : this.CHECKMATE_SCORE;
    }

    const phase = this._getGamePhase(board);
    let score = 0;

    for (const piece of board.getAllPieces()) {
      const baseValue = piece.type.baseValue;
      const positionalValue = this._getPositionalValue(piece);
      const pieceScore = baseValue + positionalValue;

      score += piece.color === PieceColor.RED ? pieceScore : -pieceScore;

      // Center control bonus (cols 3-5)
      const col = piece.position.col;
      if (col >= 3 && col <= 5) {
        let bonus = 0;
        if (piece.type === PieceType.HORSE || piece.type === PieceType.CHARIOT || piece.type === PieceType.CANNON) {
          bonus = 5;
        } else if (piece.type === PieceType.SOLDIER) {
          bonus = 3;
        }
        score += piece.color === PieceColor.RED ? bonus : -bonus;
      }

      // Crossed-river soldier bonus (more valuable as game progresses)
      if (piece.type === PieceType.SOLDIER) {
        const crossedRiver = piece.color === PieceColor.RED ? piece.position.row <= 4 : piece.position.row >= 5;
        if (crossedRiver) {
          const bonus = Math.round(20 * (1 - phase) + 10);
          score += piece.color === PieceColor.RED ? bonus : -bonus;
        }
      }
    }

    // King safety (weighted more in opening/middlegame)
    const kingSafetyWeight = 0.5 + phase * 0.5;
    const redKingSafety = Math.round(this._evaluateKingSafety(board, PieceColor.RED) * kingSafetyWeight);
    const blackKingSafety = Math.round(this._evaluateKingSafety(board, PieceColor.BLACK) * kingSafetyWeight);
    score += redKingSafety - blackKingSafety;

    // Piece coordination
    score += this._evaluatePieceCoordination(board, PieceColor.RED);
    score -= this._evaluatePieceCoordination(board, PieceColor.BLACK);

    // Mobility (weighted less in opening, more in middlegame/endgame)
    const mobilityWeight = 0.3 + (1 - phase) * 0.7;
    const redMobility = this._evaluateMobility(board, PieceColor.RED);
    const blackMobility = this._evaluateMobility(board, PieceColor.BLACK);
    score += Math.round((redMobility - blackMobility) * mobilityWeight);

    // Check bonus (at most one side can be in check)
    if (currentPlayerInCheck) {
      score += board.currentPlayer === PieceColor.RED ? -50 : 50;
    } else if (board.isInCheck(PieceColor.opposite(board.currentPlayer))) {
      score += board.currentPlayer === PieceColor.RED ? 50 : -50;
    }

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
