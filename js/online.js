/**
 * Firebase online multiplayer for Chinese Chess.
 * Handles game creation, joining, move sync, and presence.
 */
import { firebaseConfig } from './firebase-config.js';
import { Position, Move, PieceColor } from './model.js';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateCode() {
  let code = '';
  for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
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
  }

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
        this.gameRef.child('meta/status').set('playing');
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

    code = code.toUpperCase().trim();
    this.gameRef = this.db.ref(`games/${code}`);

    const snap = await this.gameRef.once('value');
    if (!snap.exists()) throw new Error('INVALID_CODE');

    const data = snap.val();
    if (data.meta?.status === 'finished') throw new Error('GAME_FINISHED');

    let myColor;
    if (!data.players?.red?.uid) myColor = 'red';
    else if (!data.players?.black?.uid) myColor = 'black';
    else throw new Error('GAME_FULL');

    this.gameCode = code;
    this.myColor = myColor;
    this.appliedMoveCount = 0;

    await this.gameRef.child(`players/${myColor}`).set({
      uid: this.uid, connected: true
    });
    await this.gameRef.child('meta/status').set('playing');

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
      if (snap.exists() && this._onGameResult) this._onGameResult(snap.val());
    });
  }

  sendMove(move) {
    if (!this.gameRef) return;
    // Write at the current total move count
    const idx = this.appliedMoveCount;
    const data = {
      fromRow: move.from.row, fromCol: move.from.col,
      toRow: move.to.row, toCol: move.to.col,
    };
    console.log(`Sending move: ${idx} (${data.fromRow},${data.fromCol})→(${data.toRow},${data.toCol})`);
    this.gameRef.child(`moves/${idx}`).set(data);
    this.appliedMoveCount = idx + 1;
  }

  onRemoteMove(callback) { this._onRemoteMove = callback; }
  onOpponentJoined(callback) { this._onOpponentJoined = callback; }
  onOpponentConnection(callback) { this._onOpponentConnection = callback; }
  onGameResult(callback) { this._onGameResult = callback; }

  sendGameResult(result) {
    if (!this.gameRef) return;
    this.gameRef.child('result').set(result);
    this.gameRef.child('meta/status').set('finished');
  }

  getGameCode() { return this.gameCode; }
  getMyColor() { return this.myColor; }
  getMyPieceColor() { return this.myColor === 'red' ? PieceColor.RED : PieceColor.BLACK; }
  isOnline() { return this.gameRef !== null; }

  cleanup() {
    if (this.gameRef) {
      this.gameRef.child('moves').off();
      this.gameRef.child('result').off();
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
    sessionStorage.removeItem('xiangqi_online');
  }

  _setupPresence() {
    const connRef = this.db.ref('.info/connected');
    const playerRef = this.gameRef.child(`players/${this.myColor}`);
    this.presenceListener = connRef.on('value', (snap) => {
      if (snap.val() === true) {
        playerRef.update({ connected: true });
        playerRef.onDisconnect().update({ connected: false });
      }
    });
  }

  _setupOpponentPresence(opponentColor) {
    this.gameRef.child(`players/${opponentColor}/connected`).on('value', (snap) => {
      if (this._onOpponentConnection) this._onOpponentConnection(snap.val() === true);
    });
  }
}
