# 中国象棋 Chinese Chess - Web

<p align="center">
  <strong><a href="https://yingwang.github.io/chinese_chess/">Play Online / 在线游玩</a></strong> ·
  <strong><a href="https://github.com/yingwang/chinese_chess_mobile">Mobile App / 手机版</a></strong> ·
  <strong><a href="https://play.google.com/store/apps/details?id=com.yingwang.chinesechess">Google Play</a></strong>
</p>

A Chinese Chess (Xiangqi) game for the web with AI engine, neural network AI, and online multiplayer.

网页版中国象棋，支持 AI 引擎、神经网络 AI 和在线对战。

## Features / 功能

### Game Modes / 游戏模式
- **Player vs AI / 人机对弈** — 5 difficulty levels + neural network AI / 5 个难度级别 + 神经网络 AI
- **Online Multiplayer / 在线对战** — Play with friends via room code / 通过房间号和朋友对弈
- **Player vs Player / 双人对弈** — Same-device local play / 同设备本地双人
- **AI vs AI / AI 对弈** — Watch AI play itself / 观看 AI 对弈

### Online Multiplayer / 在线对战

Real-time online play powered by Firebase. Create a room, share the 4-character code with a friend, and play from any device.

基于 Firebase 的实时在线对战。创建房间，把 4 位房间号分享给朋友，任何设备都能玩。

- Room code sharing / 房间号分享
- Real-time move sync / 实时走法同步
- Connection status / 连接状态显示
- Cross-platform / 跨平台（iOS, Android, Mac, Windows, Linux）

### AI Engine / AI 引擎

| Technique / 技术 | Description / 描述 |
|-----------|-------------|
| Alpha-Beta Pruning | Minimax search with pruning / 极大极小搜索 + 剪枝 |
| Iterative Deepening | Progressive depth with aspiration windows / 迭代加深 + 期望窗口 |
| Null Move Pruning | Skip-turn heuristic / 空步剪枝 |
| Late Move Reductions | Reduced depth for late moves / 后期走法缩减 |
| Transposition Tables | Cache evaluated positions / 置换表缓存 |
| Killer + History Heuristic | Move ordering / 杀手走法 + 历史启发 |
| Quiescence Search | Resolve captures at leaf / 静态搜索 |
| Opening Book | 30+ classic openings / 30+ 条经典开局 |

### Difficulty Levels / 难度级别

| Level / 级别 | Search Depth / 搜索深度 | Time Limit / 时间限制 |
|-------|-------------|------------|
| Beginner / 初级 | 2 | 1s |
| Intermediate / 中级 | 3 | 2s |
| Advanced / 高级 | 4 | 3s |
| Professional / 专业 | 5 | 5s |
| Master / 大师 | 7 | 10s |
| Neural Network / 神经网络 | ONNX model | In-browser |

### Neural Network AI / 神经网络 AI

AlphaZero-style ResNet (128 filters, 6 residual blocks) with dual policy + value heads, trained on 40,000+ master game records. Runs in-browser via ONNX Runtime Web (WebAssembly).

基于 AlphaZero 架构的 ResNet（128 滤波器，6 残差块），双头：策略头 + 价值头。使用 4 万+ 大师棋谱训练，通过 ONNX Runtime Web（WebAssembly）在浏览器端运行。

### Other Features / 其他功能

- Bilingual UI (Chinese / English) / 中英双语界面
- Move history in Chinese notation / 中文记谱法走棋记录
- Captured pieces display / 吃子显示
- Background music and sound effects / 背景音乐和音效
- Timer / 计时器
- Undo / 悔棋
- Mobile-friendly responsive design / 移动端适配

## Architecture / 项目结构

```
├── index.html            # Main page / 主页面
├── chess_model.onnx      # Neural network model (8.7MB) / 神经网络模型
├── bgm.wav               # Background music / 背景音乐
└── js/
    ├── main.js           # Entry point, UI wiring / 入口
    ├── model.js          # Game logic: Board, Piece, Move / 游戏逻辑
    ├── ai.js             # Alpha-Beta AI engine / 搜索引擎
    ├── ml-ai.js          # Neural network AI (ONNX) / 神经网络 AI
    ├── online.js         # Firebase online multiplayer / 在线对战
    ├── firebase-config.js # Firebase configuration / Firebase 配置
    ├── controller.js     # Game flow, modes, turns / 游戏流程
    ├── view.js           # Canvas board rendering / 棋盘渲染
    ├── audio.js          # Sound effects / 音效
    └── i18n.js           # Bilingual translations / 双语翻译
```

## Tech Stack / 技术栈

- Vanilla JavaScript (ES modules, no build tools) / 原生 JS，无需构建工具
- HTML5 Canvas for board rendering / Canvas 棋盘渲染
- ONNX Runtime Web for neural network inference / ONNX Runtime Web 神经网络推理
- Firebase Realtime Database for online multiplayer / Firebase 实时数据库在线对战
- Firebase Anonymous Authentication / Firebase 匿名认证
- Web Audio API for sound effects / Web Audio API 音效

## License / 许可

See LICENSE file for details.
