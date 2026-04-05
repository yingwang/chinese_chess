"""Convert selfplay_best.pt to ONNX for use with ONNX Runtime Web."""
import torch
import torch.nn as nn
import torch.nn.functional as F

ROWS, COLS = 10, 9
NUM_CHANNELS = 15
NUM_ACTIONS = 2086


class ResBlock(nn.Module):
    def __init__(self, ch=128):
        super().__init__()
        self.c1 = nn.Conv2d(ch, ch, 3, padding=1, bias=False)
        self.b1 = nn.BatchNorm2d(ch)
        self.c2 = nn.Conv2d(ch, ch, 3, padding=1, bias=False)
        self.b2 = nn.BatchNorm2d(ch)

    def forward(self, x):
        out = F.relu(self.b1(self.c1(x)))
        out = self.b2(self.c2(out))
        return F.relu(out + x)


class ChessNet(nn.Module):
    def __init__(self, in_ch=NUM_CHANNELS, ch=128, num_res=6):
        super().__init__()
        self.ci = nn.Conv2d(in_ch, ch, 3, padding=1, bias=False)
        self.bi = nn.BatchNorm2d(ch)
        self.res = nn.ModuleList([ResBlock(ch) for _ in range(num_res)])

        # Policy head
        self.pc = nn.Conv2d(ch, 2, 1, bias=False)
        self.pb = nn.BatchNorm2d(2)
        self.pf = nn.Linear(2 * ROWS * COLS, NUM_ACTIONS)

        # Value head
        self.vc = nn.Conv2d(ch, 1, 1, bias=False)
        self.vb = nn.BatchNorm2d(1)
        self.vf1 = nn.Linear(1 * ROWS * COLS, 128)
        self.vf2 = nn.Linear(128, 1)

    def forward(self, x):
        x = F.relu(self.bi(self.ci(x)))
        for block in self.res:
            x = block(x)

        # Policy
        p = F.relu(self.pb(self.pc(x)))
        p = p.view(p.size(0), -1)
        p = self.pf(p)

        # Value
        v = F.relu(self.vb(self.vc(x)))
        v = v.view(v.size(0), -1)
        v = F.relu(self.vf1(v))
        v = torch.tanh(self.vf2(v))

        return p, v


def main():
    checkpoint = torch.load('selfplay_best.pt', map_location='cpu', weights_only=False)
    print(f"Checkpoint iteration: {checkpoint['iteration']}")

    model = ChessNet()
    model.load_state_dict(checkpoint['model_state_dict'])
    model.eval()

    dummy = torch.randn(1, NUM_CHANNELS, ROWS, COLS)
    torch.onnx.export(
        model,
        dummy,
        'chess_model.onnx',
        input_names=['board'],
        output_names=['policy', 'value'],
        dynamic_axes={
            'board': {0: 'batch'},
            'policy': {0: 'batch'},
            'value': {0: 'batch'},
        },
        opset_version=17,
    )
    print('Exported chess_model.onnx')

    import os
    size = os.path.getsize('chess_model.onnx')
    print(f'Size: {size / 1024 / 1024:.1f} MB')


if __name__ == '__main__':
    main()
