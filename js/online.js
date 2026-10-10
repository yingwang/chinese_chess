/**
 * Firebase online multiplayer for Chinese Chess.
 * Handles game creation, joining, move sync, and presence.
 */
import { firebaseConfig } from './firebase-config.js';
import { Position, Move, PieceColor } from './model.js';

// No I, L, O, 0 or 1. The Android app (online/OnlineProtocol.kt) uses the same alphabet and length,
// and the database rules accept only codes of this shape.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

function generateCode() {
  const bytes = new Uint32Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  return code;
}

/** What was typed, upper-cased, without the spaces or dashes people add when reading it out. */
export function normalizeCode(input) {
  return (input || '').toUpperCase().replace(/[\s-]/g, '');
}

export function isValidCode(code) {
  return code.length === CODE_LENGTH && [...code].every(c => CODE_CHARS.includes(c));
}

function isPermissionDenied(e) {
  return /permission/i.test((e && (e.code || e.message)) || '');
}

export class OnlineManager {
  constructor() {
    this.db = null;
    this.auth = null;
    this.uid = null;
    this.gameCode = null;
    this.myColor = null; // 'red' or 'black'
    this.gameRef = null;
    this.presenceListener = null;
    this.appliedMoveCount = 0; // how many moves we've applied locally
    this._onRemoteMove = null;
    this._onOpponentJoined = null;
    this._onOpponentConnection = null;
    this._onGameResult = null;
    this._listening = false;
    this._opponentJoined = false;
    // Clocks: when the game started and when each move was written, by the server's clock.
    this.startedAt = null;
    this.moveTimes = [];
    this.serverOffset = 0;
    this.endedAt = null;
    this._offsetListener = null;
    this._opponentConnected = null;
  }

  async initialize() {
    if (this.db) return;
    if (typeof firebase === 'undefined') throw new Error('Firebase SDK not loaded');
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    this.auth = firebase.auth();
    this.db = firebase.database();
    const result = await this.auth.signInAnonymously();
    this.uid = result.user.uid;
    console.log('Firebase auth:', this.uid);
    this._offsetListener = this.db.ref('.info/serverTimeOffset').on('value', (snap) => {
      this.serverOffset = snap.val() || 0;
    });
  }

  serverNow() { return Date.now() + this.serverOffset; }

  async createGame(playerColor = 'red') {
    await this.initialize();
    this.cleanup();

    let code, exists = true;
    while (exists) {
      code = generateCode();
      const snap = await this.db.ref(`games/${code}/meta`).once('value');
      exists = snap.exists();
    }

    this.gameCode = code;
    this.myColor = playerColor;
    this.appliedMoveCount = 0;
    this.gameRef = this.db.ref(`games/${code}`);

    await this.gameRef.set({
      meta: {
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        status: 'waiting',
        gameCode: code,
        // Tells a joiner which seat is free: only the meta of a room is readable before joining.
        hostColor: playerColor,
      },
      players: {
        [playerColor]: { uid: this.uid, connected: true }
      }
    });

    this._setupPresence();

    // Wait for opponent (fire only once)
    const opponentColor = playerColor === 'red' ? 'black' : 'red';
    this._opponentJoined = false;
    this.gameRef.child(`players/${opponentColor}/uid`).on('value', (snap) => {
      if (snap.exists() && snap.val() && !this._opponentJoined) {
        this._opponentJoined = true;
        // The joiner has set this already; repeated in case it was cut off in between.
        this.gameRef.child('meta/status').set('playing').catch(() => {});
        this._setupOpponentPresence(opponentColor);
        if (this._onOpponentJoined) this._onOpponentJoined();
      }
    });

    sessionStorage.setItem('xiangqi_online', JSON.stringify({ code, color: playerColor }));
    return { gameCode: code, color: playerColor };
  }

  async joinGame(code) {
    await this.initialize();
    this.cleanup();

    code = normalizeCode(code);
    this.gameRef = this.db.ref(`games/${code}`);

    // Before taking a seat only the room's meta can be read (database.rules.json): whether it is
    // waiting, and which side the host took.
    const metaSnap = await this.gameRef.child('meta').once('value');
    if (!metaSnap.exists()) { this.gameRef = null; throw new Error('INVALID_CODE'); }
    const meta = metaSnap.val();
    if (meta.status === 'finished') { this.gameRef = null; throw new Error('GAME_FINISHED'); }
    if (meta.status !== 'waiting') { this.gameRef = null; throw new Error('GAME_FULL'); }

    const myColor = meta.hostColor === 'black' ? 'red' : 'black';

    this.gameCode = code;
    this.myColor = myColor;
    this.appliedMoveCount = 0;

    try {
      await this.gameRef.child(`players/${myColor}`).set({
        uid: this.uid, connected: true
      });
    } catch (e) {
      this.gameRef = null;
      this.gameCode = null;
      this.myColor = null;
      // Someone took the seat a moment ago.
      throw new Error(isPermissionDenied(e) ? 'GAME_FULL' : e.message);
    }
    // The host is already seated.
    this._opponentJoined = true;
    await this.gameRef.child('meta').update({
      status: 'playing',
      startedAt: firebase.database.ServerValue.TIMESTAMP,
    });

    this._setupPresence();
    const opponentColor = myColor === 'red' ? 'black' : 'red';
    this._setupOpponentPresence(opponentColor);

    sessionStorage.setItem('xiangqi_online', JSON.stringify({ code, color: myColor }));
    return { gameCode: code, color: myColor };
  }

  // Start listening for moves. Call AFTER controller.startNewGame().
  startListening() {
    if (this._listening || !this.gameRef) return;
    this._listening = true;
    this.appliedMoveCount = 0;

    // Use 'value' listener on entire moves node — more reliable than child_added
    this.gameRef.child('moves').on('value', (snap) => {
      const moves = snap.val();
      if (!moves) return;

      // moves is an object like {0: {fromRow,...}, 1: {fromRow,...}, ...}
      const keys = Object.keys(moves).map(Number).sort((a, b) => a - b);

      // Server time of every move, for the clocks (moves without one, from older pages, have none).
      this.moveTimes = keys.map(k => (moves[k] && typeof moves[k].t === 'number') ? moves[k].t : null);

      // Process any moves we haven't applied yet
      for (const idx of keys) {
        if (idx < this.appliedMoveCount) continue;

        // Is this our move or opponent's?
        const moveColor = idx % 2 === 0 ? 'red' : 'black';
        if (moveColor === this.myColor) {
          // Our own move — just advance counter
          this.appliedMoveCount = idx + 1;
          continue;
        }

        // Opponent's move
        const data = moves[idx];
        if (!data) continue;

        const from = new Position(data.fromRow, data.fromCol);
        const to = new Position(data.toRow, data.toCol);
        const move = new Move(from, to, null, null);

        this.appliedMoveCount = idx + 1;
        console.log(`Remote move: #${idx} (${data.fromRow},${data.fromCol})→(${data.toRow},${data.toCol})`);
        if (this._onRemoteMove) this._onRemoteMove(move);
      }
    });

    // Listen for game result
    this.gameRef.child('result').on('value', (snap) => {
      if (!snap.exists()) return;
      // A resignation carries the server's time of it: both sides stop the clocks there.
      if (typeof snap.val().t === 'number') this.endedAt = snap.val().t;
      if (this._onGameResult) this._onGameResult(snap.val());
    });

    // When the game started, for the clocks
    this.gameRef.child('meta/startedAt').on('value', (snap) => {
      this.startedAt = typeof snap.val() === 'number' ? snap.val() : null;
    });
  }

  /**
   * Red's and black's thinking time in ms, from the server's time of each move, so both players
   * (and the Android app) show the same clocks. Mirrors OnlineProtocol.sideTimes in the app.
   */
  getClocks(gameOver) {
    let red = 0, black = 0;
    let since = this.startedAt;
    const charge = (index, until) => {
      if (since == null || until == null) return;
      const spent = Math.max(0, until - since);
      if (index % 2 === 0) red += spent; else black += spent;
    };
    this.moveTimes.forEach((t, i) => { charge(i, t); since = t; });
    charge(this.moveTimes.length, gameOver ? this.endedAt : this.serverNow());
    return { red, black };
  }

  sendMove(move) {
    if (!this.gameRef) return;
    // Write at the current total move count
    const idx = this.appliedMoveCount;
    const data = {
      fromRow: move.from.row, fromCol: move.from.col,
      toRow: move.to.row, toCol: move.to.col,
      t: firebase.database.ServerValue.TIMESTAMP,
    };
    console.log(`Sending move: ${idx} (${data.fromRow},${data.fromCol})→(${data.toRow},${data.toCol})`);
    this.gameRef.child(`moves/${idx}`).set(data).catch((e) => console.error('Move refused:', e));
    this.appliedMoveCount = idx + 1;
  }

  onRemoteMove(callback) { this._onRemoteMove = callback; }
  onOpponentJoined(callback) { this._onOpponentJoined = callback; }
  onOpponentConnection(callback) { this._onOpponentConnection = callback; }
  onGameResult(callback) { this._onGameResult = callback; }

  sendGameResult(result) {
    if (!this.gameRef) return;
    // Both sides write the result they reached; the rules take the first and accept the same
    // one again, and turn down a different one.
    const data = { type: result.type };
    if (result.winner) data.winner = result.winner;
    if (result.type === 'resign') data.t = firebase.database.ServerValue.TIMESTAMP;
    this.gameRef.update({ result: data, 'meta/status': 'finished' })
      .catch((e) => console.warn('Result not written:', e.message));
  }

  /** Resign the game in progress; the opponent wins. */
  resign() {
    if (!this.gameRef || !this.myColor) return;
    this.endedAt = this.serverNow();
    this.sendGameResult({ type: 'resign', winner: this.myColor === 'red' ? 'black' : 'red' });
  }

  /**
   * Leave the room. A room nobody joined is deleted; a finished one too when the opponent has
   * already gone (whoever leaves last clears it away). The presence write queued for a lost
   * connection is cancelled first, so it cannot bring a deleted room back.
   */
  leave(finished) {
    if (!this.gameRef || !this.myColor) { this.cleanup(); return; }
    const ref = this.gameRef;
    const seat = ref.child(`players/${this.myColor}`);
    const remove = !this._opponentJoined || (finished && this._opponentConnected !== true);
    this.cleanup();
    seat.onDisconnect().cancel()
      .then(() => remove ? ref.remove() : seat.update({ connected: false }))
      .catch((e) => console.warn('Leaving room:', e.message));
  }

  getGameCode() { return this.gameCode; }
  getMyColor() { return this.myColor; }
  getMyPieceColor() { return this.myColor === 'red' ? PieceColor.RED : PieceColor.BLACK; }
  isOnline() { return this.gameRef !== null; }

  cleanup() {
    if (this.gameRef) {
      this.gameRef.child('moves').off();
      this.gameRef.child('result').off();
      this.gameRef.child('meta/startedAt').off();
      this.gameRef.child(`players`).off();
      const opp = this.myColor === 'red' ? 'black' : 'red';
      this.gameRef.child(`players/${opp}/uid`).off();
      this.gameRef.child(`players/${opp}/connected`).off();
    }
    if (this.presenceListener) {
      this.db?.ref('.info/connected').off('value', this.presenceListener);
      this.presenceListener = null;
    }
    this.gameRef = null;
    this.gameCode = null;
    this.myColor = null;
    this.appliedMoveCount = 0;
    this._listening = false;
    this._opponentJoined = false;
    this._opponentConnected = null;
    this.startedAt = null;
    this.moveTimes = [];
    this.endedAt = null;
    sessionStorage.removeItem('xiangqi_online');
  }

  _setupPresence() {
    const connRef = this.db.ref('.info/connected');
    const playerRef = this.gameRef.child(`players/${this.myColor}`);
    this.presenceListener = connRef.on('value', (snap) => {
      if (snap.val() === true) {
        playerRef.onDisconnect().update({ connected: false });
        playerRef.update({ connected: true }).catch(() => {});
      }
    });
  }

  _setupOpponentPresence(opponentColor) {
    this.gameRef.child(`players/${opponentColor}/connected`).on('value', (snap) => {
      this._opponentConnected = snap.val() === true;
      if (this._onOpponentConnection) this._onOpponentConnection(snap.val() === true);
    });
  }
}
