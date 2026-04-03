# 中国象棋 Chinese Chess - Web

<p align="center">
  <strong><a href="https://yingwang.github.io/chinese_chess/">Play Online / 在线游玩</a></strong> ·
  <strong><a href="https://github.com/yingwang/chinese_chess_mobile">Mobile App / 手机版</a></strong> ·
  <strong><a href="https://play.google.com/store/apps/details?id=com.yingwang.chinesechess">Google Play</a></strong>
</p>

A Chinese Chess (Xiangqi) game for the web with Alpha-Beta AI and neural network AI.

网页版中国象棋，支持 Alpha-Beta 搜索引擎和神经网络 AI。

## Features / 功能

### Game Modes / 游戏模式
- **Player vs AI / 人机对弈** — 5 difficulty levels + neural network AI / 5 个难度级别 + 神经网络 AI
- **Player vs Player / 双人对弈** — Same-device / 同设备双人
- **AI vs AI / AI 对弈** — Watch AI play itself / 观看 AI 对弈

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
| AI 神经网络 | Neural Network | ONNX Runtime |

### Neural Network AI / 神经网络 AI

AlphaZero-style model trained on 40,000+ master game records, running in-browser via ONNX Runtime Web.

基于 AlphaZero 架构，使用 4 万+ 大师棋谱训练，通过 ONNX Runtime Web 在浏览器端运行。

## Architecture / 项目结构

```
├── index.html          # Main page / 主页面
├── chess_model.onnx    # Neural network model / 神经网络模型
└── js/
    ├── main.js         # Entry point / 入口
    ├── model.js        # Game logic / 游戏逻辑
    ├── ai.js           # Alpha-Beta AI / 搜索引擎
    ├── ml-ai.js        # Neural network AI / 神经网络 AI
    ├── controller.js   # Game flow / 游戏流程
    ├── view.js         # Canvas rendering / 棋盘渲染
    └── audio.js        # Sound effects / 音效
```

## License / 许可

See LICENSE file for details.
