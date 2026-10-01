import { Position, PieceColor } from './model.js';

// Layout, in cells. Around the grid is the board's wooden rim; above and below the rim, each side
// has a tray for the pieces it has taken. The page's #game-container keeps the same proportions.
const BOARD_PAD = 0.5;
const SIDE_PAD = 1.1;
const TRAY_GAP = 0.12;
const CAPTURED_R = 0.27;
const END_PAD = BOARD_PAD + TRAY_GAP + CAPTURED_R * 2 + 0.09;

export class BoardView {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.board = null;
    this.selectedPosition = null;
    this.legalMoves = [];
    this.lastMove = null;
    this.onMoveListener = null;
    this.cellSize = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.capturedByRed = [];
    this.capturedByBlack = [];
    this.aiThinking = false;
    this._thinkingDots = 0;
    this._thinkingTimer = null;
    this.theme = 'dark';

    this.canvas.addEventListener('click', (e) => this._handleClick(e));
    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      const rect = this.canvas.getBoundingClientRect();
      this._handleClickAt(touch.clientX - rect.left, touch.clientY - rect.top);
    });
  }

  setBoard(board) {
    this.board = board;
    this.clearSelection();
    this.draw();
  }

  setOnMoveListener(callback) {
    this.onMoveListener = callback;
  }

  highlightMove(move) {
    this.lastMove = move;
    this.draw();
  }

  // Taken pieces and the last move come from the game's moves, so an undo or a new game puts the
  // trays back as they were.
  setHistory(moves) {
    this.lastMove = moves.length ? moves[moves.length - 1] : null;
    this.capturedByRed = [];
    this.capturedByBlack = [];
    for (const move of moves) {
      if (!move.capturedPiece) continue;
      if (move.piece.color === PieceColor.RED) this.capturedByRed.push(move.capturedPiece);
      else this.capturedByBlack.push(move.capturedPiece);
    }
  }

  setAIThinking(thinking) {
    this.aiThinking = thinking;
    if (thinking) {
      this._thinkingDots = 0;
      this._thinkingTimer = setInterval(() => {
        this._thinkingDots = (this._thinkingDots + 1) % 4;
        this.draw();
      }, 400);
    } else {
      if (this._thinkingTimer) { clearInterval(this._thinkingTimer); this._thinkingTimer = null; }
    }
    this.draw();
  }

  setTheme(theme) {
    this.theme = theme;
    this.draw();
  }

  clearSelection() {
    this.selectedPosition = null;
    this.legalMoves = [];
  }

  resize() {
    const container = this.canvas.parentElement;
    const w = container.clientWidth;
    const h = container.clientHeight || Math.round(w * (9 + END_PAD * 2) / (8 + SIDE_PAD * 2));
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Room around the grid for the pieces on its edges, and above and below it for the trays
    this.cellSize = Math.min(w / (8 + SIDE_PAD * 2), h / (9 + END_PAD * 2));
    this.offsetX = (w - this.cellSize * 8) / 2;
    this.offsetY = (h - this.cellSize * 9) / 2;
    this.draw();
  }

  // Convert board position to canvas pixel coordinates
  _toPixel(row, col) {
    return {
      x: this.offsetX + col * this.cellSize,
      y: this.offsetY + row * this.cellSize
    };
  }

  // Convert canvas pixel coordinates to nearest board position
  _toPosition(px, py) {
    const col = Math.round((px - this.offsetX) / this.cellSize);
    const row = Math.round((py - this.offsetY) / this.cellSize);
    const pos = new Position(row, col);
    if (!pos.isValid()) return null;
    // Check if click is close enough to the intersection
    const { x, y } = this._toPixel(row, col);
    const dist = Math.sqrt((px - x) ** 2 + (py - y) ** 2);
    if (dist > this.cellSize * 0.6) return null;
    return pos;
  }

  _handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    this._handleClickAt(e.clientX - rect.left, e.clientY - rect.top);
  }

  _handleClickAt(px, py) {
    if (!this.board) return;
    const pos = this._toPosition(px, py);
    if (!pos) return;

    const clickedPiece = this.board.getPiece(pos);

    if (this.selectedPosition) {
      // Check if this is a legal move destination
      const move = this.legalMoves.find(m => m.to.equals(pos));
      if (move) {
        if (this.onMoveListener) this.onMoveListener(move);
        return;
      }
      // If clicking own piece, switch selection
      if (clickedPiece && clickedPiece.color === this.board.currentPlayer) {
        this._selectPiece(pos, clickedPiece);
        return;
      }
      // Otherwise clear
      this.clearSelection();
      this.draw();
      return;
    }

    // No piece selected yet
    if (clickedPiece && clickedPiece.color === this.board.currentPlayer) {
      this._selectPiece(pos, clickedPiece);
    }
  }

  _selectPiece(pos, piece) {
    this.selectedPosition = pos;
    // Compute legal moves filtering self-check
    const rawMoves = piece.getLegalMoves(this.board);
    this.legalMoves = rawMoves.filter(move => {
      const newBoard = this.board.makeMove(move);
      return !newBoard.isInCheck(piece.color) && !newBoard.isGeneralsFacing();
    });
    this.draw();
  }

  // === Drawing ===

  draw() {
    if (!this.board) return;
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;

    // Clear
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = this.theme === 'light' ? 'rgba(240,236,228,0.85)' : 'rgba(26,26,46,0.92)';
    ctx.fillRect(0, 0, w, h);

    // Board background with shadow and rounded border
    const topLeft = this._toPixel(0, 0);
    const bottomRight = this._toPixel(9, 8);
    const pad = this.cellSize * BOARD_PAD;
    const bx = topLeft.x - pad, by = topLeft.y - pad;
    const bw = bottomRight.x - topLeft.x + pad * 2;
    const bh = bottomRight.y - topLeft.y + pad * 2;

    // Drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6;

    // Wood gradient base (matches mobile)
    const woodGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
    woodGrad.addColorStop(0, 'rgb(200, 165, 120)');
    woodGrad.addColorStop(0.3, 'rgb(190, 150, 100)');
    woodGrad.addColorStop(0.5, 'rgb(195, 158, 108)');
    woodGrad.addColorStop(0.7, 'rgb(185, 145, 95)');
    woodGrad.addColorStop(1, 'rgb(175, 135, 90)');
    ctx.fillStyle = woodGrad;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 10);
    ctx.fill();
    ctx.restore();

    // Wood grain lines
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 10);
    ctx.clip();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = 'rgb(80, 50, 20)';
    ctx.lineWidth = 0.8;
    for (let y = by; y < by + bh; y += 4 + Math.random() * 3) {
      ctx.beginPath();
      ctx.moveTo(bx, y);
      for (let x = bx; x < bx + bw; x += 10) {
        ctx.lineTo(x, y + Math.sin(x * 0.02 + y * 0.01) * 2);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Outer border
    ctx.strokeStyle = 'rgb(100, 65, 30)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 10);
    ctx.stroke();

    this._drawGrid();
    this._drawRiver();
    this._drawPositionMarkers();
    this._drawLastMove();
    this._drawLegalMoves();
    this._drawPieces();
    this._drawCaptured();
    if (this.aiThinking) this._drawThinking();
  }

  _drawGrid() {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgb(80, 50, 30)';
    ctx.lineWidth = 1;

    // Horizontal lines
    for (let row = 0; row <= 9; row++) {
      const { x: x0, y } = this._toPixel(row, 0);
      const { x: x8 } = this._toPixel(row, 8);
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x8, y);
      ctx.stroke();
    }

    // Vertical lines - split by river
    for (let col = 0; col <= 8; col++) {
      const { x, y: y0 } = this._toPixel(0, col);
      const { y: y4 } = this._toPixel(4, col);
      const { y: y5 } = this._toPixel(5, col);
      const { y: y9 } = this._toPixel(9, col);

      // Top half
      if (col === 0 || col === 8) {
        ctx.beginPath();
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y9);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y5);
        ctx.lineTo(x, y9);
        ctx.stroke();
      }
    }

    // Border
    const topLeft = this._toPixel(0, 0);
    const bottomRight = this._toPixel(9, 8);
    const pad = this.cellSize * 0.06;
    ctx.strokeStyle = 'rgb(60, 40, 20)';
    ctx.lineWidth = 3;
    ctx.strokeRect(
      topLeft.x - pad, topLeft.y - pad,
      bottomRight.x - topLeft.x + pad * 2,
      bottomRight.y - topLeft.y + pad * 2
    );

    // Palace diagonals
    ctx.strokeStyle = 'rgb(80, 50, 30)';
    ctx.lineWidth = 1;

    // Top palace (rows 0-2, cols 3-5)
    let p1 = this._toPixel(0, 3);
    let p2 = this._toPixel(2, 5);
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    p1 = this._toPixel(0, 5);
    p2 = this._toPixel(2, 3);
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();

    // Bottom palace (rows 7-9, cols 3-5)
    p1 = this._toPixel(7, 3);
    p2 = this._toPixel(9, 5);
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    p1 = this._toPixel(7, 5);
    p2 = this._toPixel(9, 3);
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
  }

  _drawRiver() {
    const ctx = this.ctx;
    const { y: y4 } = this._toPixel(4, 0);
    const { y: y5 } = this._toPixel(5, 0);
    const midY = (y4 + y5) / 2;

    ctx.fillStyle = 'rgb(100, 70, 50)';
    ctx.font = `bold ${this.cellSize * 0.45}px "Noto Sans CJK SC", "Noto Serif SC", "Microsoft YaHei", "PingFang SC", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const leftX = this._toPixel(0, 2).x;
    const rightX = this._toPixel(0, 6).x;
    ctx.fillText('楚河', leftX, midY);
    ctx.fillText('漢界', rightX, midY);
  }

  _drawPositionMarker(row, col) {
    const ctx = this.ctx;
    const { x, y } = this._toPixel(row, col);
    const s = this.cellSize * 0.08;
    const gap = this.cellSize * 0.08;
    const len = this.cellSize * 0.15;

    ctx.strokeStyle = 'rgb(80, 50, 30)';
    ctx.lineWidth = 1.2;

    const dirs = [];
    if (col > 0) dirs.push([-1, -1], [-1, 1]);
    if (col < 8) dirs.push([1, -1], [1, 1]);

    for (const [dx, dy] of dirs) {
      const ox = x + dx * gap;
      const oy = y + dy * gap;
      ctx.beginPath();
      ctx.moveTo(ox + dx * len, oy);
      ctx.lineTo(ox, oy);
      ctx.lineTo(ox, oy + dy * len);
      ctx.stroke();
    }
  }

  _drawPositionMarkers() {
    // Cannon positions
    const markers = [
      [2, 1], [2, 7], [7, 1], [7, 7],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8],
      [6, 0], [6, 2], [6, 4], [6, 6], [6, 8]
    ];
    for (const [r, c] of markers) {
      this._drawPositionMarker(r, c);
    }
  }

  _drawLastMove() {
    if (!this.lastMove) return;
    const ctx = this.ctx;
    const r = this.cellSize * 0.38;

    for (const pos of [this.lastMove.from, this.lastMove.to]) {
      const { x, y } = this._toPixel(pos.row, pos.col);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 215, 100, 0.4)';
      ctx.fill();
    }
  }

  _drawLegalMoves() {
    const ctx = this.ctx;
    const dotR = this.cellSize * 0.08;
    const circleR = this.cellSize * 0.35;

    for (const move of this.legalMoves) {
      const { x, y } = this._toPixel(move.to.row, move.to.col);
      const isCapture = move.isCapture();

      // Dashed circle
      ctx.beginPath();
      ctx.arc(x, y, circleR, 0, Math.PI * 2);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = isCapture ? 'rgba(200, 40, 40, 0.7)' : 'rgba(50, 100, 200, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      // Center dot
      ctx.beginPath();
      ctx.arc(x, y, dotR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(50, 100, 200, 0.7)';
      ctx.fill();
    }
  }

  _drawPieces() {
    if (!this.board) return;
    const pieces = this.board.getAllPieces();
    const pieceR = this.cellSize * 0.4;

    for (const piece of pieces) {
      const { x, y } = this._toPixel(piece.position.row, piece.position.col);
      const isSelected = this.selectedPosition && this.selectedPosition.equals(piece.position);
      const isLastMoved = this.lastMove &&
        (this.lastMove.to.equals(piece.position));

      this._drawPiece(x, y, piece, pieceR, isSelected, isLastMoved);
    }
  }

  _drawPiece(x, y, piece, r, isSelected, isLastMoved) {
    const ctx = this.ctx;

    // Drop shadow (blurred, offset)
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(180,160,130,1)';
    ctx.fill();
    ctx.restore();

    // Selection glow (multi-layer warm gold, matches mobile)
    if (isSelected) {
      for (let i = 3; i >= 1; i--) {
        ctx.beginPath();
        ctx.arc(x, y, r + i * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 200, 80, ${0.12 * i})`;
        ctx.fill();
      }
    }

    // Last-moved golden ring
    if (isLastMoved && !isSelected) {
      ctx.beginPath();
      ctx.arc(x, y, r + 3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(220, 160, 60, 0.7)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Piece body — 4-stop radial gradient (matches mobile)
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.05, x, y, r);
    grad.addColorStop(0, 'rgb(255, 250, 235)');   // specular highlight
    grad.addColorStop(0.3, 'rgb(245, 235, 210)');
    grad.addColorStop(0.7, 'rgb(220, 200, 170)');
    grad.addColorStop(1, 'rgb(195, 175, 145)');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Outer ring
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (isSelected) {
      ctx.strokeStyle = 'rgb(200, 155, 30)';
      ctx.lineWidth = 2.5;
    } else {
      ctx.strokeStyle = 'rgb(100, 75, 45)';
      ctx.lineWidth = 1.5;
    }
    ctx.stroke();

    // Inner decorative ring
    ctx.beginPath();
    ctx.arc(x, y, r * 0.82, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgb(110, 85, 55)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Chinese character with slight shadow for depth
    const displayName = piece.type.getDisplayName(piece.color);
    const textColor = piece.color === PieceColor.RED ? 'rgb(180, 30, 30)' : 'rgb(25, 25, 25)';

    // Text shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.font = `bold ${r * 1.1}px "Noto Serif SC", "Noto Sans CJK SC", "Microsoft YaHei", "PingFang SC", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayName, x + 0.5, y + 1.5);

    // Main text
    ctx.fillStyle = textColor;
    ctx.fillText(displayName, x, y + 1);
  }

  // The y of a side's tray: Black's above the board, Red's below.
  _trayY(red) {
    const fromGrid = this.cellSize * (BOARD_PAD + TRAY_GAP + CAPTURED_R);
    return red ? this._toPixel(9, 0).y + fromGrid : this._toPixel(0, 0).y - fromGrid;
  }

  _drawCaptured() {
    this._drawCapturedRow(this.capturedByBlack, this._trayY(false));
    this._drawCapturedRow(this.capturedByRed, this._trayY(true));
  }

  // Most valuable first, as on the phone app. A long row draws its pieces closer together, short
  // of the far end, where the thinking dots go.
  _drawCapturedRow(pieces, y) {
    if (pieces.length === 0) return;
    const ctx = this.ctx;
    const r = this.cellSize * CAPTURED_R;
    const left = this._toPixel(0, 0).x - this.cellSize * BOARD_PAD;
    const room = this.cellSize * (8 + BOARD_PAD * 2) - 48 - r * 2;
    const step = pieces.length > 1 ? Math.min(r * 2.25, room / (pieces.length - 1)) : 0;
    const sorted = [...pieces].sort((a, b) => b.type.baseValue - a.type.baseValue);

    ctx.font = `bold ${r * 1.15}px "Noto Serif SC", "Noto Sans CJK SC", "Microsoft YaHei", "PingFang SC", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    sorted.forEach((piece, i) => {
      const x = left + r + i * step;
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetY = 1;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgb(239, 230, 211)';
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgb(142, 130, 102)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = piece.color === PieceColor.RED ? 'rgb(180, 30, 30)' : 'rgb(25, 25, 25)';
      ctx.fillText(piece.type.getDisplayName(piece.color), x, y + 1);
    });
  }

  // In the tray of the side that is thinking, at the far end from its taken pieces.
  _drawThinking() {
    const ctx = this.ctx;
    const y = this._trayY(this.board.currentPlayer === PieceColor.RED);
    const right = this._toPixel(0, 8).x + this.cellSize * BOARD_PAD;
    const dotR = 4;
    const gap = 14;

    for (let i = 0; i < 3; i++) {
      const x = right - dotR - 2 - (2 - i) * gap;
      const alpha = i < this._thinkingDots ? 1.0 : 0.3;
      ctx.beginPath();
      ctx.arc(x, y, dotR, 0, Math.PI * 2);
      ctx.fillStyle = this.theme === 'light' ? `rgba(139, 69, 19, ${alpha})` : `rgba(255, 215, 0, ${alpha})`;
      ctx.fill();
    }
  }
}
