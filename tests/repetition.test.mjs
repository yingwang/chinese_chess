// Checks js/repetition.js against the shared cases in repetition-cases.json (the Android app's
// RepetitionTest runs the same file). Run with: node tests/repetition.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Board, PieceColor, Position } from '../js/model.js';
import { Conduct, conductOf, judgeRepetition, outcome } from '../js/repetition.js';

const here = dirname(fileURLToPath(import.meta.url));
const { cases } = JSON.parse(readFileSync(join(here, 'repetition-cases.json'), 'utf8'));

/** "a8a9" to the matching legal move on [board]; files a..i are columns, rank d is row 9 - d. */
function parseMove(board, text) {
  const from = new Position(9 - Number(text[1]), text.charCodeAt(0) - 97);
  const to = new Position(9 - Number(text[3]), text.charCodeAt(2) - 97);
  const move = board.getAllLegalMoves().find(m => m.from.equals(from) && m.to.equals(to));
  if (!move) throw new Error(`${text} is not legal on ${board.toFen()}`);
  return move;
}

/** Plays [texts] from [start] and returns the first result reached, as the game would announce it. */
function play(start, texts) {
  let board = start;
  const moves = [];
  const hashes = [board.getPositionHash()];
  for (const text of texts) {
    if (board.isCheckmate() || board.isStalemate()) throw new Error(`game over before ${text}`);
    const move = parseMove(board, text);
    moves.push(move);
    board = board.makeMove(move);
    board.currentPlayer = PieceColor.opposite(board.currentPlayer);
    hashes.push(board.getPositionHash());
    const judged = judgeRepetition(start, moves, hashes);
    if (judged) {
      if (moves.length !== texts.length) throw new Error(`a position repeated a third time already after ${moves.length} moves`);
      return judged;
    }
  }
  return null;
}

let failed = 0;
for (const c of cases) {
  const result = play(Board.fromFen(c.fen), c.moves);
  const got = result && { type: result.type, winner: result.winner, conduct: result.conduct };
  const want = { type: c.expect.type, winner: c.expect.winner, conduct: c.conduct };
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${c.id}${ok ? '' : `\n     want ${JSON.stringify(want)}\n     got  ${JSON.stringify(got)}`}`);
}

// The outcome table itself, for the combinations no short game reaches.
const table = [
  [Conduct.CHECK, Conduct.CHECK, 'repetition', null],
  [Conduct.CHECK, Conduct.CHECK_AND_CHASE, 'repetition', null],
  [Conduct.CHECK, Conduct.CHASE, 'perpetualCheck', 'black'],
  [Conduct.CHASE, Conduct.CHECK_AND_CHASE, 'perpetualCheck', 'red'],
  [Conduct.CHECK_AND_CHASE, Conduct.NONE, 'perpetualCheck', 'black'],
  [Conduct.NONE, Conduct.CHASE, 'perpetualChase', 'red'],
  [Conduct.CHASE, Conduct.CHASE, 'repetition', null],
  [Conduct.NONE, Conduct.NONE, 'repetition', null],
];
for (const [red, black, type, winner] of table) {
  const got = outcome(red, black);
  const ok = got.type === type && got.winner === winner;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} outcome(${red}, ${black}) = ${got.type}/${got.winner}`);
}
const kinds = (s) => [...s].map(ch => ({ check: ch === 'c' || ch === 'b', chase: ch === 'h' || ch === 'b' }));
const conducts = [
  ['cc', Conduct.CHECK], ['bb', Conduct.CHECK], ['ch', Conduct.CHECK_AND_CHASE], ['bh', Conduct.CHECK_AND_CHASE],
  ['hh', Conduct.CHASE], ['c-', Conduct.NONE], ['h-', Conduct.NONE], ['', Conduct.NONE],
];
for (const [s, want] of conducts) {
  const got = conductOf(kinds(s));
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} conductOf(${s || 'nothing'}) = ${got}`);
}

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log(`all ${cases.length} cases and the tables pass`);
