// === Constants ===

export const PieceColor = {
  RED: 'red',
  BLACK: 'black',
  opposite(color) {
    return color === this.RED ? this.BLACK : this.RED;
  }
};

export const PieceType = {
  GENERAL: {
    chineseName: '将/帅',
    baseValue: 10000,
    getDisplayName(color) { return color === PieceColor.RED ? '帅' : '将'; }
  },
  ADVISOR: {
    chineseName: '士/仕',
    baseValue: 120,
    getDisplayName(color) { return color === PieceColor.RED ? '仕' : '士'; }
  },
  ELEPHANT: {
    chineseName: '象/相',
    baseValue: 120,
    getDisplayName(color) { return color === PieceColor.RED ? '相' : '象'; }
  },
  HORSE: {
    chineseName: '馬',
    baseValue: 400,
    getDisplayName(color) { return '馬'; }
  },
  CHARIOT: {
    chineseName: '車',
    baseValue: 900,
    getDisplayName(color) { return '車'; }
  },
  CANNON: {
    chineseName: '炮',
    baseValue: 450,
    getDisplayName(color) { return '炮'; }
  },
  SOLDIER: {
    chineseName: '兵/卒',
    baseValue: 100,
    getDisplayName(color) { return color === PieceColor.RED ? '兵' : '卒'; }
  }
};

// === Position ===

export class Position {
  constructor(row, col) {
    this.row = row;
    this.col = col;
  }

  isValid() {
    return this.row >= 0 && this.row <= 9 && this.col >= 0 && this.col <= 8;
  }

  equals(other) {
    return other && this.row === other.row && this.col === other.col;
  }

  toString() {
    return `${this.row},${this.col}`;
  }
}

// === Piece ===

export class Piece {
  constructor(type, color, position) {
    this.type = type;
    this.color = color;
    this.position = position;
  }

  copy() {
    return new Piece(this.type, this.color, new Position(this.position.row, this.position.col));
  }

  getLegalMoves(board) {
    switch (this.type) {
      case PieceType.GENERAL:  return this._generalMoves(board);
      case PieceType.ADVISOR:  return this._advisorMoves(board);
      case PieceType.ELEPHANT: return this._elephantMoves(board);
      case PieceType.HORSE:    return this._horseMoves(board);
      case PieceType.CHARIOT:  return this._chariotMoves(board);
      case PieceType.CANNON:   return this._cannonMoves(board);
      case PieceType.SOLDIER:  return this._soldierMoves(board);
      default: return [];
    }
  }

  _canMoveTo(board, row, col) {
    const pos = new Position(row, col);
    if (!pos.isValid()) return null;
    const target = board.getPiece(pos);
    if (target && target.color === this.color) return null;
    return new Move(this.position, pos, this, target || null);
  }

  // General: 1 step orthogonally within palace
  _generalMoves(board) {
    const moves = [];
    const { row, col } = this.position;
    const minRow = this.color === PieceColor.RED ? 7 : 0;
    const maxRow = this.color === PieceColor.RED ? 9 : 2;
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    for (const [dr, dc] of directions) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= minRow && nr <= maxRow && nc >= 3 && nc <= 5) {
        const move = this._canMoveTo(board, nr, nc);
        if (move) moves.push(move);
      }
    }

    // Flying general: can capture opposing general if they face each other on same column
    const opponentColor = PieceColor.opposite(this.color);
    let opponentGeneral = null;
    for (const piece of board.getAllPieces()) {
      if (piece.type === PieceType.GENERAL && piece.color === opponentColor) {
        opponentGeneral = piece;
        break;
      }
    }
    if (opponentGeneral && opponentGeneral.position.col === col) {
      const startR = Math.min(row, opponentGeneral.position.row);
      const endR = Math.max(row, opponentGeneral.position.row);
      let blocked = false;
      for (let r = startR + 1; r < endR; r++) {
        if (board.getPiece(new Position(r, col))) {
          blocked = true;
          break;
        }
      }
      if (!blocked) {
        const pos = opponentGeneral.position;
        const move = new Move(this.position, pos, this, opponentGeneral);
        if (!moves.some(m => m.to.equals(pos))) {
          moves.push(move);
        }
      }
    }

    return moves;
  }

  // Advisor: 1 step diagonally within palace
  _advisorMoves(board) {
    const moves = [];
    const { row, col } = this.position;
    const minRow = this.color === PieceColor.RED ? 7 : 0;
    const maxRow = this.color === PieceColor.RED ? 9 : 2;
    const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

    for (const [dr, dc] of directions) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= minRow && nr <= maxRow && nc >= 3 && nc <= 5) {
        const move = this._canMoveTo(board, nr, nc);
        if (move) moves.push(move);
      }
    }
    return moves;
  }

  // Elephant: 2 steps diagonally, blocked by elephant eye, cannot cross river
  _elephantMoves(board) {
    const moves = [];
    const { row, col } = this.position;
    const minRow = this.color === PieceColor.RED ? 5 : 0;
    const maxRow = this.color === PieceColor.RED ? 9 : 4;
    const steps = [[-2, -2, -1, -1], [-2, 2, -1, 1], [2, -2, 1, -1], [2, 2, 1, 1]];

    for (const [dr, dc, er, ec] of steps) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= minRow && nr <= maxRow && nc >= 0 && nc <= 8) {
        // Check elephant eye (blocking piece)
        const eyePos = new Position(row + er, col + ec);
        if (!board.getPiece(eyePos)) {
          const move = this._canMoveTo(board, nr, nc);
          if (move) moves.push(move);
        }
      }
    }
    return moves;
  }

  // Horse: L-shape, blocked by horse leg
  _horseMoves(board) {
    const moves = [];
    const { row, col } = this.position;
    // [target dr, target dc, blocking dr, blocking dc]
    const steps = [
      [-2, -1, -1, 0], [-2, 1, -1, 0],
      [2, -1, 1, 0],   [2, 1, 1, 0],
      [-1, -2, 0, -1], [-1, 2, 0, 1],
      [1, -2, 0, -1],  [1, 2, 0, 1]
    ];

    for (const [dr, dc, br, bc] of steps) {
      const blockPos = new Position(row + br, col + bc);
      if (!blockPos.isValid()) continue;
      if (board.getPiece(blockPos)) continue; // horse leg blocked
      const move = this._canMoveTo(board, row + dr, col + dc);
      if (move) moves.push(move);
    }
    return moves;
  }

  // Chariot: moves any distance orthogonally
  _chariotMoves(board) {
    const moves = [];
    const { row, col } = this.position;
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    for (const [dr, dc] of directions) {
      let nr = row + dr;
      let nc = col + dc;
      while (nr >= 0 && nr <= 9 && nc >= 0 && nc <= 8) {
        const pos = new Position(nr, nc);
        const target = board.getPiece(pos);
        if (target) {
          if (target.color !== this.color) {
            moves.push(new Move(this.position, pos, this, target));
          }
          break;
        }
        moves.push(new Move(this.position, pos, this, null));
        nr += dr;
        nc += dc;
      }
    }
    return moves;
  }

  // Cannon: moves like chariot, captures by jumping over exactly 1 piece
  _cannonMoves(board) {
    const moves = [];
    const { row, col } = this.position;
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    for (const [dr, dc] of directions) {
      let nr = row + dr;
      let nc = col + dc;
      let jumped = false;

      while (nr >= 0 && nr <= 9 && nc >= 0 && nc <= 8) {
        const pos = new Position(nr, nc);
        const target = board.getPiece(pos);

        if (!jumped) {
          if (target) {
            jumped = true; // found the screen/platform piece
          } else {
            moves.push(new Move(this.position, pos, this, null));
          }
        } else {
          // After jumping, can only capture
          if (target) {
            if (target.color !== this.color) {
              moves.push(new Move(this.position, pos, this, target));
            }
            break;
          }
        }
        nr += dr;
        nc += dc;
      }
    }
    return moves;
  }

  // Soldier: forward 1 step; after crossing river, can also move sideways
  _soldierMoves(board) {
    const moves = [];
    const { row, col } = this.position;
    const forward = this.color === PieceColor.RED ? -1 : 1;
    const crossedRiver = this.color === PieceColor.RED ? row <= 4 : row >= 5;

    // Forward move
    const fMove = this._canMoveTo(board, row + forward, col);
    if (fMove) moves.push(fMove);

    // Sideways moves after crossing river
    if (crossedRiver) {
      const lMove = this._canMoveTo(board, row, col - 1);
      if (lMove) moves.push(lMove);
      const rMove = this._canMoveTo(board, row, col + 1);
      if (rMove) moves.push(rMove);
    }

    return moves;
  }
}

// === Move ===

export class Move {
  constructor(from, to, piece, capturedPiece) {
    this.from = from;
    this.to = to;
    this.piece = piece;
    this.capturedPiece = capturedPiece;
  }

  isCapture() {
    return this.capturedPiece !== null;
  }

  toString() {
    const cap = this.isCapture() ? 'x' : '-';
    return `${this.from}${cap}${this.to}`;
  }
}

// === Board ===

export class Board {
  constructor() {
    this.pieces = new Map();
    this.currentPlayer = PieceColor.RED;
  }

  static createInitialBoard() {
    const board = new Board();
    const setup = [
      // Black pieces (top, rows 0-4)
      { type: PieceType.CHARIOT,  color: PieceColor.BLACK, row: 0, col: 0 },
      { type: PieceType.HORSE,    color: PieceColor.BLACK, row: 0, col: 1 },
      { type: PieceType.ELEPHANT, color: PieceColor.BLACK, row: 0, col: 2 },
      { type: PieceType.ADVISOR,  color: PieceColor.BLACK, row: 0, col: 3 },
      { type: PieceType.GENERAL,  color: PieceColor.BLACK, row: 0, col: 4 },
      { type: PieceType.ADVISOR,  color: PieceColor.BLACK, row: 0, col: 5 },
      { type: PieceType.ELEPHANT, color: PieceColor.BLACK, row: 0, col: 6 },
      { type: PieceType.HORSE,    color: PieceColor.BLACK, row: 0, col: 7 },
      { type: PieceType.CHARIOT,  color: PieceColor.BLACK, row: 0, col: 8 },
      { type: PieceType.CANNON,   color: PieceColor.BLACK, row: 2, col: 1 },
      { type: PieceType.CANNON,   color: PieceColor.BLACK, row: 2, col: 7 },
      { type: PieceType.SOLDIER,  color: PieceColor.BLACK, row: 3, col: 0 },
      { type: PieceType.SOLDIER,  color: PieceColor.BLACK, row: 3, col: 2 },
      { type: PieceType.SOLDIER,  color: PieceColor.BLACK, row: 3, col: 4 },
      { type: PieceType.SOLDIER,  color: PieceColor.BLACK, row: 3, col: 6 },
      { type: PieceType.SOLDIER,  color: PieceColor.BLACK, row: 3, col: 8 },
      // Red pieces (bottom, rows 5-9)
      { type: PieceType.CHARIOT,  color: PieceColor.RED, row: 9, col: 0 },
      { type: PieceType.HORSE,    color: PieceColor.RED, row: 9, col: 1 },
      { type: PieceType.ELEPHANT, color: PieceColor.RED, row: 9, col: 2 },
      { type: PieceType.ADVISOR,  color: PieceColor.RED, row: 9, col: 3 },
      { type: PieceType.GENERAL,  color: PieceColor.RED, row: 9, col: 4 },
      { type: PieceType.ADVISOR,  color: PieceColor.RED, row: 9, col: 5 },
      { type: PieceType.ELEPHANT, color: PieceColor.RED, row: 9, col: 6 },
      { type: PieceType.HORSE,    color: PieceColor.RED, row: 9, col: 7 },
      { type: PieceType.CHARIOT,  color: PieceColor.RED, row: 9, col: 8 },
      { type: PieceType.CANNON,   color: PieceColor.RED, row: 7, col: 1 },
      { type: PieceType.CANNON,   color: PieceColor.RED, row: 7, col: 7 },
      { type: PieceType.SOLDIER,  color: PieceColor.RED, row: 6, col: 0 },
      { type: PieceType.SOLDIER,  color: PieceColor.RED, row: 6, col: 2 },
      { type: PieceType.SOLDIER,  color: PieceColor.RED, row: 6, col: 4 },
      { type: PieceType.SOLDIER,  color: PieceColor.RED, row: 6, col: 6 },
      { type: PieceType.SOLDIER,  color: PieceColor.RED, row: 6, col: 8 },
    ];

    for (const { type, color, row, col } of setup) {
      const pos = new Position(row, col);
      board.pieces.set(pos.toString(), new Piece(type, color, pos));
    }

    return board;
  }

  getPiece(position) {
    return this.pieces.get(position.toString()) || null;
  }

  getAllPieces() {
    return Array.from(this.pieces.values());
  }

  getPiecesByColor(color) {
    return this.getAllPieces().filter(p => p.color === color);
  }

  _findGeneral(color) {
    for (const piece of this.pieces.values()) {
      if (piece.type === PieceType.GENERAL && piece.color === color) {
        return piece;
      }
    }
    return null;
  }

  isGeneralsFacing() {
    const redGeneral = this._findGeneral(PieceColor.RED);
    const blackGeneral = this._findGeneral(PieceColor.BLACK);
    if (!redGeneral || !blackGeneral) return false;
    if (redGeneral.position.col !== blackGeneral.position.col) return false;

    const col = redGeneral.position.col;
    const startRow = Math.min(redGeneral.position.row, blackGeneral.position.row);
    const endRow = Math.max(redGeneral.position.row, blackGeneral.position.row);

    for (let r = startRow + 1; r < endRow; r++) {
      if (this.getPiece(new Position(r, col))) return false;
    }
    return true;
  }

  isInCheck(color) {
    const general = this._findGeneral(color);
    if (!general) return false;

    const opponentColor = PieceColor.opposite(color);
    for (const piece of this.getPiecesByColor(opponentColor)) {
      const moves = piece.getLegalMoves(this);
      for (const move of moves) {
        if (move.to.equals(general.position)) return true;
      }
    }
    return false;
  }

  getAllLegalMoves() {
    const allMoves = [];
    for (const piece of this.getPiecesByColor(this.currentPlayer)) {
      const rawMoves = piece.getLegalMoves(this);
      for (const move of rawMoves) {
        const newBoard = this.makeMove(move);
        // After the move, check if our own general is in check or generals are facing
        if (!newBoard.isInCheck(this.currentPlayer) && !newBoard.isGeneralsFacing()) {
          allMoves.push(move);
        }
      }
    }
    return allMoves;
  }

  getLegalCaptureMoves() {
    const captures = [];
    for (const piece of this.getPiecesByColor(this.currentPlayer)) {
      const rawMoves = piece.getLegalMoves(this);
      for (const move of rawMoves) {
        if (!move.isCapture()) continue;
        const newBoard = this.makeMove(move);
        if (!newBoard.isInCheck(this.currentPlayer) && !newBoard.isGeneralsFacing()) {
          captures.push(move);
        }
      }
    }
    return captures;
  }

  isCheckmate() {
    return this.isInCheck(this.currentPlayer) && this.getAllLegalMoves().length === 0;
  }

  isStalemate() {
    return !this.isInCheck(this.currentPlayer) && this.getAllLegalMoves().length === 0;
  }

  // Returns a new board with the move applied; does NOT switch currentPlayer
  makeMove(move) {
    const newBoard = this.copy();
    newBoard.pieces.delete(move.from.toString());
    newBoard.pieces.delete(move.to.toString());
    const newPos = new Position(move.to.row, move.to.col);
    const movedPiece = new Piece(move.piece.type, move.piece.color, newPos);
    newBoard.pieces.set(newPos.toString(), movedPiece);
    return newBoard;
  }

  // Mutates board in place and switches currentPlayer
  makeMoveInPlace(move) {
    this.pieces.delete(move.from.toString());
    this.pieces.delete(move.to.toString());
    const newPos = new Position(move.to.row, move.to.col);
    const movedPiece = new Piece(move.piece.type, move.piece.color, newPos);
    this.pieces.set(newPos.toString(), movedPiece);
    this.currentPlayer = PieceColor.opposite(this.currentPlayer);
  }

  copy() {
    const newBoard = new Board();
    newBoard.currentPlayer = this.currentPlayer;
    for (const [key, piece] of this.pieces) {
      newBoard.pieces.set(key, piece.copy());
    }
    return newBoard;
  }

  getPositionHash() {
    const entries = [];
    for (const [key, piece] of this.pieces) {
      entries.push(`${key}:${piece.color}:${piece.type.chineseName}`);
    }
    entries.sort();
    return entries.join('|') + '|' + this.currentPlayer;
  }
}
