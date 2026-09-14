# 交互缺口 / Interaction gaps

北星：**最好的交互，而不是死板角度**。系统自己找耳朵最清楚的角度。只有锁定个人峰值之后，才会说往回。

技术上限见 [LIMITS.zh-CN.md](./LIMITS.zh-CN.md)。English: [interaction-gaps.md](./interaction-gaps.md).

## 上限 vs 明确做不到（交互）

| | 上限（这版能做到的诚实边界） | 明确做不到 |
|---|--------------------------------|------|
| 未锁定提示 | 只介绍怎么转；方向反了 / 转太快 / 脸不在框里仍会打断 | 用大约 60° 的软先验喊「再转 / 往回 / 保持 / 可以拍了」 |
| 锁定后过冲 | 相对 `bestYaw`；超过 `overshootPastBestDeg`（12°）且分数掉了 → TURN_BACK_OVERSHOOT | 把「到 88° / 转到后脑勺」当主过冲文案 |
| 往回 | 朝峰值走 → 保持，进带后才 READY | 「再转一点点」把人继续推向更侧 |
| 就绪带 | 进入 ±5° / 离开 ±8°（`exitBandDeg`） | 只有死 ±5°、进出同一条线 |
| HUD | 三态：学习中 / 请保持 / 可以拍了 | 普通 HUD 显示绝对 yaw / bestYaw（数字只在调试折页） |
| 拍摄按钮 | 学习中、保持时灰色；只有 READY 变绿 | 还在学习时就说「保持不动」 |
| 自动快门 | 第一次默认关；打开后 3 帧按分数选，再倒数 `autoshutterMs`，可取消 | 第一次来访突然连拍 |
| 重新学习 | 先确认，再回到扫转介绍 | 文案写「校准」；不确认直接清掉 |

## 这一轮已交付的 P0

1. 未锁定：只说扫转，直到峰值锁定。软先验不再驱动 TURN_MORE / TURN_BACK / HOLD。
2. 锁定后过冲：相对 bestYaw，过了 `overshootPastBestDeg` 且分数掉了 → 「往回一点，刚才那边更清楚」。往回走是 HOLD，不是 MORE。
3. `exitBandDeg` 滞回（大约进入 5° / 离开 8°）。
4. 普通 HUD 不显示绝对 yaw / best；数字在「调试：角度数字」折页。
5. 灰按钮 / 提示三态：学习中 vs 靠近峰值请保持 vs 可以拍了。
6. 自动快门：第一次默认关 + 可取消倒数；burst 仍按分数选。
7. 重新学习：确认后回到扫转；不用「校准」一词。

## 还没做的（不是 P0 / 仍是上限）

- 没有专用耳朵检测器，头发/背景假峰仍可能被锁上。恢复手段是重新学习，不是临床核对「你是不是点错了耳朵」。
- `minSweepCoverageRatio` 仍不是 READY 硬门（否则会挡住真的 ~45° 停住）。假峰风险写在 LIMITS。
- 接近 90° 跟丢时，峰值可能停在窗口内侧。
- 自动快门倒数只能理解「离开 READY」或「点了取消」，不知道用户为什么动。
- 调试折页仍给开发者看角度数字；这是故意的，不是给用户的清单。

## 调参

| 想要… | 改这里 |
|--------|--------|
| 进入 / 离开 READY | `ready.bandDegAroundBest`、`ready.exitBandDeg` |
| 过冲文案 | `ready.overshootPastBestDeg`、`ready.scoreRatioOfBest` |
| 倒数 | `ready.autoshutterMs`、`ready.burstFrames`、`ready.pickBurstBy` |
