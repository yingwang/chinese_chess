/**
 * Neural Network AI using ONNX Runtime Web.
 * Loads the trained model and uses policy head for move selection.
 */
import { PieceColor, PieceType, Position, Move } from './model.js';

const ROWS = 10, COLS = 9, NUM_CHANNELS = 15, NUM_ACTIONS = 2086;

// Piece type to channel index mapping
const PIECE_TYPE_INDEX = new Map([
  [PieceType.GENERAL, 0], [PieceType.ADVISOR, 1], [PieceType.ELEPHANT, 2],
  [PieceType.HORSE, 3], [PieceType.CHARIOT, 4], [PieceType.CANNON, 5],
  [PieceType.SOLDIER, 6],
]);

// === Move Table Generation (must match Python encoding.py exactly) ===

function generateMoveTable() {
  const moveSet = new Set();
  const add = (f, t) => moveSet.add(f * 100 + t); // unique key
  const rc = (r, c) => r * COLS + c;
  const ib = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const fp = rc(r, c);
      // Orthogonal slides
      for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
        for (let st = 1; st < Math.max(ROWS, COLS); st++) {
          const nr = r + dr * st, nc = c + dc * st;
          if (ib(nr, nc)) add(fp, rc(nr, nc));
        }
      }
      // Knight jumps
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        const nr = r + dr, nc = c + dc;
        if (ib(nr, nc)) add(fp, rc(nr, nc));
      }
    }
  }

  // Advisor diagonals
  for (const [r, c] of [[0,3],[0,5],[1,4],[2,3],[2,5],[7,3],[7,5],[8,4],[9,3],[9,5]]) {
    const fp = rc(r, c);
    for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
      const nr = r + dr, nc = c + dc;
      if (ib(nr, nc) && ((nr >= 0 && nr <= 2 && nc >= 3 && nc <= 5) || (nr >= 7 && nr <= 9 && nc >= 3 && nc <= 5))) {
        add(fp, rc(nr, nc));
      }
    }
  }

  // Elephant diagonals
  for (const [r, c] of [[0,2],[0,6],[2,0],[2,4],[2,8],[4,2],[4,6],[5,2],[5,6],[7,0],[7,4],[7,8],[9,2],[9,6]]) {
    const fp = rc(r, c);
    for (const [dr, dc] of [[-2,-2],[-2,2],[2,-2],[2,2]]) {
      const nr = r + dr, nc = c + dc;
      if (ib(nr, nc) && ((r <= 4 && nr <= 4) || (r >= 5 && nr >= 5))) {
        add(fp, rc(nr, nc));
      }
    }
  }

  // Convert to sorted array of [from, to] — must match Python sorted() on tuples
  const moves = [];
  for (const key of moveSet) {
    const f = Math.floor(key / 100), t = key % 100;
    moves.push([f, t]);
  }
  moves.sort((a, b) => a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]);

  // Build reverse lookup
  const moveToIndex = new Map();
  moves.forEach(([f, t], i) => moveToIndex.set(f * 90 + t, i));

  return { moves, moveToIndex };
}

const { moves: ALL_MOVES, moveToIndex: MOVE_TO_INDEX } = generateMoveTable();

if (ALL_MOVES.length !== NUM_ACTIONS) {
  console.warn(`Move table size mismatch: ${ALL_MOVES.length} vs expected ${NUM_ACTIONS}`);
}

// === Board Encoding ===

function boardToTensor(board, currentPlayer) {
  // Returns Float32Array of shape [15, 10, 9] in CHW order (flat)
  const tensor = new Float32Array(NUM_CHANNELS * ROWS * COLS);

  for (const piece of board.getAllPieces()) {
    const r = piece.position.row;
    const c = piece.position.col;
    const colorOffset = piece.color === PieceColor.RED ? 0 : 7;
    const typeIdx = PIECE_TYPE_INDEX.get(piece.type);
    if (typeIdx === undefined) continue;
    const channel = colorOffset + typeIdx;
    tensor[channel * ROWS * COLS + r * COLS + c] = 1.0;
  }

  // Channel 14: current player (1.0 if Red to move)
  if (currentPlayer === PieceColor.RED) {
    const offset = 14 * ROWS * COLS;
    for (let i = 0; i < ROWS * COLS; i++) tensor[offset + i] = 1.0;
  }

  return tensor;
}

function moveToActionIndex(fromPos, toPos) {
  const f = fromPos.row * COLS + fromPos.col;
  const t = toPos.row * COLS + toPos.col;
  return MOVE_TO_INDEX.get(f * 90 + t);
}

// === ONNX Runtime Inference ===

export class MLChessAI {
  constructor() {
    this.session = null;
    this.loading = false;
    this.nodesSearched = 0;
  }

  async loadModel(modelPath = 'chess_model.onnx') {
    if (this.session) return;
    if (this.loading) return;
    this.loading = true;
    this.loadError = null;
    try {
      if (typeof ort === 'undefined') {
        throw new Error('ONNX Runtime not loaded (ort undefined)');
      }
      this.session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['wasm'],
      });
      console.log('ML model loaded');
    } catch (e) {
      console.error('Failed to load ML model:', e);
      this.loadError = e.message || String(e);
      this.session = null;
    }
    this.loading = false;
  }

  isReady() {
    return this.session !== null;
  }

  async findBestMove(board) {
    if (!this.session) {
      await this.loadModel();
      if (!this.session) return null;
    }

    this.nodesSearched = 1;

    const legalMoves = board.getAllLegalMoves();
    if (legalMoves.length === 0) return null;
    if (legalMoves.length === 1) return legalMoves[0];

    // Encode board
    const tensor = boardToTensor(board, board.currentPlayer);
    const inputTensor = new ort.Tensor('float32', tensor, [1, NUM_CHANNELS, ROWS, COLS]);

    // Run inference
    let results;
    try {
      results = await this.session.run({ board: inputTensor });
    } catch (e) {
      console.error('ML inference failed:', e);
      this.session = null; // force fallback on next call
      return null;
    }
    const policyLogits = results.policy.data;  // Float32Array(2086)
    const value = results.value.data[0];       // scalar

    // Score legal moves using policy logits
    let bestMove = null;
    let bestScore = -Infinity;
    const scores = [];

    for (const move of legalMoves) {
      const idx = moveToActionIndex(move.from, move.to);
      if (idx === undefined) continue;
      const score = policyLogits[idx];
      scores.push({ move, score });
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    // Add slight randomness for variety (softmax with temperature)
    if (scores.length > 1) {
      const temp = 0.5;
      const maxS = Math.max(...scores.map(s => s.score));
      const exps = scores.map(s => Math.exp((s.score - maxS) / temp));
      const sumExp = exps.reduce((a, b) => a + b, 0);
      const probs = exps.map(e => e / sumExp);

      const r = Math.random();
      let cumulative = 0;
      for (let i = 0; i < probs.length; i++) {
        cumulative += probs[i];
        if (r < cumulative) {
          bestMove = scores[i].move;
          break;
        }
      }
    }

    return bestMove;
  }

  clearCache() {
    // No cache to clear for ML model
  }

  getCacheSize() {
    return 0;
  }
}
