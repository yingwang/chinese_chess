/**
 * Firebase online multiplayer for Chinese Chess.
 * Handles game creation, joining, move sync, and presence.
 */
import { firebaseConfig } from './firebase-config.js';
import { Position, Move, PieceColor } from './model.js';

// Safe alphabet for game codes (no 0/O, 1/I/L confusion)
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
    this.moveListener = null;
    this.presenceListener = null;
    this.localMoveCount = 0;
    this._onRemoteMove = null;
    this._onOpponentJoined = null;
    this._onOpponentConnection = null;
    this._onGameResult = null;
  }

  async initialize() {
    if (this.db) return;
    // Firebase compat SDK loaded via CDN as globals
    if (typeof firebase === 'undefined') {
      throw new Error('Firebase SDK not loaded');
    }
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    this.auth = firebase.auth();
    this.db = firebase.database();

    // Anonymous sign-in
    const result = await this.auth.signInAnonymously();
    this.uid = result.user.uid;
    console.log('Firebase auth:', this.uid);
  }

  async createGame(playerColor = 'red') {
    await this.initialize();
    this.cleanup();

    // Generate unique code
    let code, exists = true;
    while (exists) {
      code = generateCode();
      const snap = await this.db.ref(`games/${code}/meta`).once('value');
      exists = snap.exists();
    }

    this.gameCode = code;
    this.myColor = playerColor;
    this.localMoveCount = 0;

    const gameData = {
      meta: {
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        status: 'waiting',
        gameCode: code,
        creatorUid: this.uid,
      },
      players: {
        [playerColor]: {
          uid: this.uid,
          connected: true,
          lastSeen: firebase.database.ServerValue.TIMESTAMP,
        }
      }
    };

    this.gameRef = this.db.ref(`games/${code}`);
    await this.gameRef.set(gameData);

    // Setup presence
    this._setupPresence();

    // Listen for opponent joining
    const opponentColor = playerColor === 'red' ? 'black' : 'red';
    this.gameRef.child(`players/${opponentColor}`).on('value', (snap) => {
      if (snap.exists() && snap.val().uid) {
        // Opponent joined
        this.gameRef.child('meta/status').set('playing');
        if (this._onOpponentJoined) this._onOpponentJoined();
        this._setupMoveListener();
        this._setupOpponentPresence(opponentColor);
      }
    });

    // Save to sessionStorage for reconnection
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

    // Find open seat
    let myColor;
    if (!data.players?.red?.uid) {
      myColor = 'red';
    } else if (!data.players?.black?.uid) {
      myColor = 'black';
    } else {
      throw new Error('GAME_FULL');
    }

    this.gameCode = code;
    this.myColor = myColor;
    this.localMoveCount = 0;

    // Claim seat
    await this.gameRef.child(`players/${myColor}`).set({
      uid: this.uid,
      connected: true,
      lastSeen: firebase.database.ServerValue.TIMESTAMP,
    });
    await this.gameRef.child('meta/status').set('playing');

    this._setupPresence();
    this._setupMoveListener();

    const opponentColor = myColor === 'red' ? 'black' : 'red';
    this._setupOpponentPresence(opponentColor);

    sessionStorage.setItem('xiangqi_online', JSON.stringify({ code, color: myColor }));

    return { gameCode: code, color: myColor };
  }

  sendMove(move) {
    if (!this.gameRef) return;
    const data = {
      fromRow: move.from.row,
      fromCol: move.from.col,
      toRow: move.to.row,
      toCol: move.to.col,
    };
    this.gameRef.child(`moves/${this.localMoveCount}`).set(data);
    this.localMoveCount++;
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
    if (this.moveListener) {
      this.gameRef?.child('moves').off('child_added', this.moveListener);
      this.moveListener = null;
    }
    if (this.presenceListener) {
      this.db?.ref('.info/connected').off('value', this.presenceListener);
      this.presenceListener = null;
    }
    if (this.gameRef) {
      this.gameRef.child(`players/${this.myColor}`).off();
      const opponentColor = this.myColor === 'red' ? 'black' : 'red';
      this.gameRef.child(`players/${opponentColor}`).off();
      this.gameRef.child('result').off();
    }
    this.gameRef = null;
    this.gameCode = null;
    this.myColor = null;
    this.localMoveCount = 0;
    sessionStorage.removeItem('xiangqi_online');
  }

  _setupPresence() {
    const connRef = this.db.ref('.info/connected');
    const playerRef = this.gameRef.child(`players/${this.myColor}`);

    this.presenceListener = connRef.on('value', (snap) => {
      if (snap.val() === true) {
        playerRef.update({ connected: true, lastSeen: firebase.database.ServerValue.TIMESTAMP });
        playerRef.onDisconnect().update({ connected: false, lastSeen: firebase.database.ServerValue.TIMESTAMP });
      }
    });
  }

  _setupMoveListener() {
    let receivedCount = 0;
    this.moveListener = this.gameRef.child('moves').on('child_added', (snap) => {
      const idx = parseInt(snap.key);
      // Skip our own moves
      if (idx < this.localMoveCount) {
        receivedCount++;
        return;
      }
      receivedCount++;
      const data = snap.val();
      if (!data) return;

      const from = new Position(data.fromRow, data.fromCol);
      const to = new Position(data.toRow, data.toCol);
      // Create minimal move object — controller will find the full legal move
      const move = new Move(from, to, null, null);

      this.localMoveCount = idx + 1;
      if (this._onRemoteMove) this._onRemoteMove(move);
    });

    // Listen for game result
    this.gameRef.child('result').on('value', (snap) => {
      if (snap.exists() && this._onGameResult) {
        this._onGameResult(snap.val());
      }
    });
  }

  _setupOpponentPresence(opponentColor) {
    this.gameRef.child(`players/${opponentColor}/connected`).on('value', (snap) => {
      if (this._onOpponentConnection) {
        this._onOpponentConnection(snap.val() === true);
      }
    });
  }
}
