import { Piece, PieceType, PieceColor } from './model.js';

// 揭棋 (Jieqi). Each side's fifteen pieces besides the general, the set they start from.
const FULL_SET = [
  PieceType.CHARIOT, PieceType.CHARIOT, PieceType.HORSE, PieceType.HORSE,
  PieceType.ELEPHANT, PieceType.ELEPHANT, PieceType.ADVISOR, PieceType.ADVISOR,
  PieceType.CANNON, PieceType.CANNON,
  PieceType.SOLDIER, PieceType.SOLDIER, PieceType.SOLDIER, PieceType.SOLDIER, PieceType.SOLDIER,
];

/**
 * The pieces of [color] still face down, as far as anyone can know: the full set less the pieces
 * face up on the board and the pieces taken (a taken piece is shown in the tray, so it is known).
 */
export function unseenPool(board, moveHistory, color) {
  const pool = [...FULL_SET];
  const remove = (type) => {
    const i = pool.indexOf(type);
    if (i >= 0) pool.splice(i, 1);
  };
  for (const p of board.getPiecesByColor(color)) {
    if (!p.hidden && p.type !== PieceType.GENERAL) remove(p.type);
  }
  for (const m of moveHistory) {
    if (m.capturedPiece && m.capturedPiece.color === color) remove(m.capturedPiece.type);
  }
  return pool;
}

/**
 * One possible world: the same board with every face-down piece given a type drawn from what is
 * still unseen. The AI searches such worlds instead of the real board, so it never reads a
 * face-down piece's true type.
 */
export function determinize(board, moveHistory, random = Math.random) {
  const world = board.copy();
  for (const color of [PieceColor.RED, PieceColor.BLACK]) {
    const hidden = world.getPiecesByColor(color).filter(p => p.hidden);
    if (hidden.length === 0) continue;
    const pool = unseenPool(board, moveHistory, color);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    hidden.forEach((p, i) => {
      const type = pool[i] || p.moveAs;
      world.pieces.set(p.position.toString(), new Piece(type, color, p.position, true, p.moveAs));
    });
  }
  return world;
}
