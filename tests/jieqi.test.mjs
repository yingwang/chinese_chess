// 揭棋 rules and the AI's ignorance of face-down pieces. Run with: node tests/jieqi.test.mjs
import { Board, Piece, PieceColor, PieceType, Position } from '../js/model.js';
import { determinize, unseenPool } from '../js/jieqi.js';
import { GameController, GAME_MODE, AI_DIFFICULTY } from '../js/controller.js';

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' ' + detail : ''}`);
  if (!ok) failures++;
}

/** A seeded generator, so a test can give two runs the same draws. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

const at = (r, c) => new Position(r, c);
const movesFrom = (board, r, c) => board.getAllLegalMoves().filter(m => m.from.equals(at(r, c)));
const counts = (types) => types.map(t => t.chineseName).sort().join(',');
const FULL = counts([...Array(2).fill(PieceType.CHARIOT), ...Array(2).fill(PieceType.HORSE),
  ...Array(2).fill(PieceType.ELEPHANT), ...Array(2).fill(PieceType.ADVISOR),
  ...Array(2).fill(PieceType.CANNON), ...Array(5).fill(PieceType.SOLDIER)]);

// Setup
const start = Board.createJieqiBoard(seeded(1));
for (const color of [PieceColor.RED, PieceColor.BLACK]) {
  const pieces = start.getPiecesByColor(color);
  const general = pieces.find(p => p.type === PieceType.GENERAL);
  const others = pieces.filter(p => p !== general);
  check(`${color}: general face up on its point`, general && !general.hidden && general.position.col === 4);
  check(`${color}: fifteen face down`, others.length === 15 && others.every(p => p.hidden));
  check(`${color}: a full set, shuffled`, counts(others.map(p => p.type)) === FULL);
  check(`${color}: each moves as its starting point`, others.every(p => {
    const std = Board.createInitialBoard().getPiece(p.position);
    return std && std.type === p.moveAs;
  }));
}
check('two shuffles differ', JSON.stringify([...Board.createJieqiBoard(seeded(1)).pieces.values()].map(p => p.type.chineseName))
  !== JSON.stringify([...Board.createJieqiBoard(seeded(2)).pieces.values()].map(p => p.type.chineseName)));

// A face-down piece moves as its point, whatever it is, and is turned up by its first move.
{
  const b = Board.createJieqiBoard(seeded(3));
  const rookPoint = movesFrom(b, 9, 0).map(m => m.to.toString()).sort();
  check('face-down piece on the chariot point moves as a chariot', JSON.stringify(rookPoint) === JSON.stringify(['7,0', '8,0']), JSON.stringify(rookPoint));
  const advisorPoint = movesFrom(b, 9, 3).map(m => m.to.toString());
  check('face-down piece on the advisor point stays in the palace', JSON.stringify(advisorPoint) === JSON.stringify(['8,4']), JSON.stringify(advisorPoint));
  const m = movesFrom(b, 9, 0).find(m => m.to.equals(at(8, 0)));
  const after = b.makeMove(m);
  const moved = after.getPiece(at(8, 0));
  check('first move turns it face up as its true type', !moved.hidden && moved.type === b.getPiece(at(9, 0)).type);
  check('other pieces stay face down', after.getPiece(at(9, 1)).hidden);
  check('jieqi carries to the new board', after.jieqi === true);
}

// Face-up advisors and elephants are free in 揭棋, and only there.
{
  const lone = (type, row, col, jieqi) => {
    const b = new Board();
    b.jieqi = jieqi;
    b.pieces.set(at(9, 4).toString(), new Piece(PieceType.GENERAL, PieceColor.RED, at(9, 4)));
    b.pieces.set(at(0, 3).toString(), new Piece(PieceType.GENERAL, PieceColor.BLACK, at(0, 3)));
    b.pieces.set(at(row, col).toString(), new Piece(type, PieceColor.RED, at(row, col)));
    return movesFrom(b, row, col).map(m => m.to.toString()).sort();
  };
  check('jieqi: face-up advisor leaves the palace', lone(PieceType.ADVISOR, 7, 3, true).includes('6,2'));
  check('ordinary game: advisor stays in the palace', !lone(PieceType.ADVISOR, 7, 3, false).includes('6,2'));
  check('jieqi: face-up elephant crosses the river', lone(PieceType.ELEPHANT, 5, 2, true).includes('3,0'));
  check('ordinary game: elephant stays home', !lone(PieceType.ELEPHANT, 5, 2, false).includes('3,0'));
}

// What a face-down piece is never shows: not in the position hash, not to the AI.
{
  const a = Board.createJieqiBoard(seeded(5));
  const b = Board.createJieqiBoard(seeded(6));
  check('hash ignores face-down types', a.getPositionHash() === b.getPositionHash());
  const wa = determinize(a, [], seeded(9));
  const wb = determinize(b, [], seeded(9));
  check('the AI\'s worlds are the same whatever the face-down pieces are', wa.getPositionHash() === wb.getPositionHash()
    && [...wa.pieces.values()].map(p => p.type.chineseName).join() === [...wb.pieces.values()].map(p => p.type.chineseName).join());
}

// The unseen pool: face-up pieces and taken pieces are known.
{
  let b = Board.createJieqiBoard(seeded(7));
  const history = [];
  const play = (fr, fc, tr, tc) => {
    const m = b.getAllLegalMoves().find(m => m.from.equals(at(fr, fc)) && m.to.equals(at(tr, tc)));
    if (!m) throw new Error(`illegal ${fr},${fc}-${tr},${tc}`);
    history.push(m);
    b = b.makeMove(m);
    b.currentPlayer = PieceColor.opposite(b.currentPlayer);
  };
  play(7, 1, 0, 1);   // the face-down piece on Red's cannon point takes the piece on Black's horse point
  const redPool = unseenPool(b, history, PieceColor.RED);
  const blackPool = unseenPool(b, history, PieceColor.BLACK);
  check('red: one turned up, fourteen unseen', redPool.length === 14);
  check('black: one taken, fourteen unseen', blackPool.length === 14);
  const hiddenBlack = b.getPiecesByColor(PieceColor.BLACK).filter(p => p.hidden).length;
  check('pool size matches the face-down count', hiddenBlack === blackPool.length);
}

// The AI plays a legal 揭棋 move, from worlds of its own.
{
  const c = new GameController();
  c.setGameMode(GAME_MODE.JIEQI, PieceColor.RED);
  c.setDifficulty(AI_DIFFICULTY.BEGINNER);
  let done;
  const moved = new Promise(r => { done = r; });
  c.onMoveCompleted = (m) => done(m);
  c.startNewGame();
  const m = await Promise.race([moved, new Promise(r => setTimeout(() => r(null), 20000))]);
  check('AI (Red) opens a 揭棋 game', !!m);
  check('its move came from the real board', m && c.moveHistory.length === 1 && c.board.getPiece(m.to) && !c.board.getPiece(m.to).hidden);
  check('a player move then works', (() => {
    const reply = c.board.getAllLegalMoves()[0];
    return c.makePlayerMove(reply) === true || c.gameOver;
  })());
}

if (failures) {
  console.log(`${failures} failed`);
  process.exit(1);
}
console.log('all jieqi checks pass');
process.exit(0);
