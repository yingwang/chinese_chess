# 中国象棋 (Chinese Chess) - Web

A professional-level Chinese Chess (Xiangqi) game for the web with advanced AI.

Web version of [chinese_chess_mobile](https://github.com/yingwang/chinese_chess_mobile).

## Features

### Game Modes
- **Player vs AI** - Play against professional-level AI
- **Player vs Player** - Play with a friend on the same device
- **AI vs AI** - Watch AI play against itself

### Professional AI Engine

The AI uses state-of-the-art game engine techniques:

1. **Alpha-Beta Pruning** - Efficient tree search algorithm
2. **Iterative Deepening** - Progressive depth search for better time management
3. **Transposition Tables** - Caches evaluated positions to avoid redundant calculations
4. **Move Ordering** - Prioritizes promising moves (MVV-LVA) to improve pruning
5. **Quiescence Search** - Evaluates capture sequences to avoid horizon effect
6. **Advanced Evaluation Function** - Uses piece-square tables and positional analysis

### AI Difficulty Levels

- **初级 / Beginner** (Depth 1) - Good for learning
- **中级 / Intermediate** (Depth 2) - Casual play
- **高级 / Advanced** (Depth 3) - Challenging opponent
- **专业 / Professional** (Depth 4) - Strong amateur level
- **大师 / Master** (Depth 5) - Near professional level

### Opening Book

The AI uses an opening book featuring classic Chinese chess openings:
- **Center Cannon** (中炮) - Aggressive central control
- **Horse Openings** (马局) - Flexible development
- **Screen Horse Defense** (屏风马) - Solid defensive structure

## How to Play

1. Open `index.html` in a modern web browser
2. Red side moves first - tap/click a piece to select it
3. Legal moves are shown with indicators:
   - Blue dashed circles: normal moves
   - Red dashed circles: capture moves
4. Click a destination to move

### Controls
- **新游戏 (New Game)** - Start a new game with custom settings
- **悔棋 (Undo)** - Take back the last move(s)

## Technical Details

### Architecture

```
├── index.html          # Main HTML page with embedded CSS
└── js/
    ├── main.js         # Entry point, wires UI to controller
    ├── model.js        # Game logic: Board, Piece, Move, Position
    ├── ai.js           # AI: Alpha-beta search, Evaluator, Opening Book
    ├── controller.js   # Game flow: modes, turns, undo
    └── view.js         # Canvas-based board rendering
```

### Game Rules

Standard Chinese Chess (Xiangqi) rules:

- **General (将/帅)** - Moves one step orthogonally within palace
- **Advisor (士/仕)** - Moves one step diagonally within palace
- **Elephant (象/相)** - Moves two steps diagonally, cannot cross river
- **Horse (马/馬)** - Moves in L-shape, can be blocked
- **Chariot (车/車)** - Moves any distance orthogonally
- **Cannon (炮/砲)** - Moves like chariot, captures by jumping
- **Soldier (兵/卒)** - Moves forward, sideways after crossing river

Special rules:
- **Flying General** - Generals cannot face each other directly
- **Check and Checkmate** - Standard chess-like rules
- **Stalemate** - No legal moves results in draw

## License

See LICENSE file for details.