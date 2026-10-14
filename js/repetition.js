/**
 * Adjudication of a repeated position: 长将 (perpetual check), 长捉 (perpetual chase) or a plain
 * repetition. Pure functions over the model, shared in spirit with Repetition.kt in the Android
 * app; both are checked against tests/repetition-cases.json and must judge every case alike.
 *
 * When a position (board and side to move) occurs for the third time, the moves of the cycle
 * between its previous occurrence and this one are classified, every one of them, for the
 * side that made it:
 *
 *   - a CHECK move gives check;
 *   - a CHASE move creates a new attack on an opponent piece P: after the move some piece Q of
 *     the mover (never the king or a soldier) could legally capture P, Q did not reach P before
 *     the move (by the way it moves, whether or not taking was legal then: a piece freed from
 *     a check or a pin starts no chase; for the moved piece, "before" means from its old
 *     square, and an attack uncovered by the move counts the same as one made by the piece that
 *     moved), P is not a king nor a soldier still on its own side of the river, and either P is
 *     unprotected (no opponent piece could legally recapture on its square) or Q is worth less
 *     than P (chariot above horse and cannon, which rank alike, above the rest). Attacking a
 *     protected piece of equal or lower value is an offer to exchange, not a chase.
 *
 * A side's conduct over the cycle: CHECK if every move checks; CHECK_AND_CHASE if every move
 * checks or chases with at least one of each; CHASE if every move chases (the same piece or
 * different ones); NONE otherwise. Check and check-and-chase are the more serious conduct,
 * chase the less; the side whose conduct is more serious loses (perpetualCheck or
 * perpetualChase with the other side the winner); when both are equally serious, including
 * both doing nothing of the kind, the game is a draw by repetition.
 */
import { PieceColor, PieceType } from './model.js';

export const Conduct = Object.freeze({
  NONE: 'none',
  CHASE: 'chase',
  CHECK_AND_CHASE: 'checkAndChase',
  CHECK: 'check',
});

/** Worth for the chase rule: chariot above horse and cannon, which rank alike, above the rest. */
function chaseRank(type) {
  switch (type) {
    case PieceType.CHARIOT: return 3;
    case PieceType.HORSE:
    case PieceType.CANNON: return 2;
    default: return 1;
  }
}

function hasCrossedRiver(piece) {
  return piece.color === PieceColor.RED ? piece.position.row <= 4 : piece.position.row >= 5;
}

function withSideToMove(board, color) {
  const copy = board.copy();
  copy.currentPlayer = color;
  return copy;
}

/** Whether [color] may play [move] on [board]: it leaves no own king in check or facing the other. */
function isLegalFor(board, move, color) {
  const after = board.makeMove(move);
  return !after.isInCheck(color) && !after.isGeneralsFacing();
}

/** Squares (as strings) of the opponent pieces [attacker] reaches on [board], legal to take or not. */
function reachedSquares(board, attacker) {
  const squares = new Set();
  for (const move of attacker.getLegalMoves(board)) {
    if (move.capturedPiece) squares.add(move.to.toString());
  }
  return squares;
}

/** Whether, once [attacker] has taken the piece on [target] (giving [after]), the other side can take it back. */
function isProtected(after, target, defender) {
  const board = withSideToMove(after, defender);
  for (const piece of board.getPiecesByColor(defender)) {
    for (const move of piece.getLegalMoves(board)) {
      if (move.to.equals(target) && isLegalFor(board, move, defender)) return true;
    }
  }
  return false;
}

/**
 * How the move [move] played on [before] (its mover to move there) classifies: `check` if it
 * gives check, `chase` if it creates a chase as defined above. A move can be both.
 */
export function classifyMove(before, move) {
  const mover = move.piece.color;
  const opponent = PieceColor.opposite(mover);
  const after = board_after(before, move);
  const check = after.isInCheck(opponent);

  // What the mover's pieces reached before the move, by the square each piece stood on.
  const reachedBefore = new Map();
  for (const piece of before.getPiecesByColor(mover)) {
    if (piece.type === PieceType.GENERAL || piece.type === PieceType.SOLDIER) continue;
    reachedBefore.set(piece.position.toString(), reachedSquares(before, piece));
  }

  const post = withSideToMove(after, mover);
  let chase = false;
  for (const attacker of post.getPiecesByColor(mover)) {
    if (attacker.type === PieceType.GENERAL || attacker.type === PieceType.SOLDIER) continue;
    const oldSquare = attacker.position.equals(move.to) ? move.from.toString() : attacker.position.toString();
    const before_ = reachedBefore.get(oldSquare) || new Set();
    for (const captureMove of attacker.getLegalMoves(post)) {
      const target = captureMove.capturedPiece;
      if (!target) continue;
      if (before_.has(captureMove.to.toString())) continue;
      if (target.type === PieceType.GENERAL) continue;
      if (target.type === PieceType.SOLDIER && !hasCrossedRiver(target)) continue;
      if (!isLegalFor(post, captureMove, mover)) continue;
      if (chaseRank(attacker.type) < chaseRank(target.type)) { chase = true; break; }
      if (!isProtected(post.makeMove(captureMove), captureMove.to, opponent)) { chase = true; break; }
    }
    if (chase) break;
  }
  return { check, chase };
}

function board_after(before, move) {
  const after = before.makeMove(move);
  after.currentPlayer = PieceColor.opposite(move.piece.color);
  return after;
}

/** A side's conduct over its moves of the cycle, from their classifications. */
export function conductOf(kinds) {
  if (kinds.length === 0) return Conduct.NONE;
  if (kinds.every(k => k.check)) return Conduct.CHECK;
  if (kinds.every(k => k.check || k.chase)) {
    return kinds.some(k => k.check) ? Conduct.CHECK_AND_CHASE : Conduct.CHASE;
  }
  return Conduct.NONE;
}

function severity(conduct) {
  switch (conduct) {
    case Conduct.CHECK:
    case Conduct.CHECK_AND_CHASE: return 2;
    case Conduct.CHASE: return 1;
    default: return 0;
  }
}

/** The result of a third occurrence given each side's conduct over the cycle. */
export function outcome(red, black) {
  const r = severity(red);
  const b = severity(black);
  if (r === b) return { type: 'repetition', winner: null };
  const loser = r > b ? PieceColor.RED : PieceColor.BLACK;
  return {
    type: Math.max(r, b) === 2 ? 'perpetualCheck' : 'perpetualChase',
    winner: PieceColor.opposite(loser),
  };
}

/**
 * Judges the cycle [moves][from .. to): the moves from the previous occurrence of the repeated
 * position to its latest one, [start] being the board before move 0. Returns the result with
 * each side's conduct.
 */
export function judgeCycle(start, moves, from, to) {
  let board = start;
  for (let i = 0; i < from; i++) board = board_after(board, moves[i]);
  const kinds = { [PieceColor.RED]: [], [PieceColor.BLACK]: [] };
  for (let i = from; i < to; i++) {
    const move = moves[i];
    kinds[move.piece.color].push(classifyMove(board, move));
    board = board_after(board, move);
  }
  const red = conductOf(kinds[PieceColor.RED]);
  const black = conductOf(kinds[PieceColor.BLACK]);
  return { ...outcome(red, black), conduct: { red, black } };
}

/**
 * The result if the last of [positionHashes] (the position after the last of [moves], played
 * from [start]) is a third occurrence; null if it is not. The hashes are one per position,
 * the first for [start].
 */
export function judgeRepetition(start, moves, positionHashes) {
  const last = positionHashes.length - 1;
  if (last < 0) return null;
  const hash = positionHashes[last];
  let seen = 0;
  let previous = -1;
  for (let i = 0; i < last; i++) {
    if (positionHashes[i] === hash) { seen++; previous = i; }
  }
  if (seen < 2) return null;
  return judgeCycle(start, moves, previous, last);
}
