# auto_ear_detect

[中文](README.zh-CN.md) · [English](README.md)

[![CI](https://github.com/strongerfly/auto_ear_detect/actions/workflows/ci.yml/badge.svg)](https://github.com/strongerfly/auto_ear_detect/actions/workflows/ci.yml)

实时**头部姿态引导耳廓拍摄**。慢慢转，找到耳朵最清楚的角度——应用会记住每一侧。不是对着 70–90° 打卡。

技术栈：**Vite + React + TypeScript** + `@mediapipe/tasks-vision` Face Landmarker（`VIDEO` 模式，`outputFacialTransformationMatrixes: true`）。

页头切换 **中文 / English**。偏好保存在 `localStorage`（`auto-ear-detect:locale:v1`）。默认：浏览器语言 `zh*` 用中文，否则英文。

上限与短板：**[docs/LIMITS.zh-CN.md](docs/LIMITS.zh-CN.md)** · **[docs/LIMITS.md](docs/LIMITS.md)**。交互 P0 与剩余缺口：**[docs/interaction-gaps.zh-CN.md](docs/interaction-gaps.zh-CN.md)**。

## 怎么用

1. 允许摄像头。需要的话在页头切语言。
2. 点 **拍左耳** 或 **拍右耳**（身体的左右，不是镜子）。拍右耳 → 向左转；拍左耳 → 向右转。
3. **转头**慢慢转（不是转电脑/手机），找到耳朵最清楚的角度。第一次要慢慢转过，系统才会记住这一侧；在此之前拍不了。
4. 等到 **可以拍了**。自动快门第一次默认关上；打开后会倒数，可以取消。然后点另一侧重转。

角度记错时用 **重新学习此侧**，确认后再慢慢转一次。应用里的 **使用说明** 还有转过头、摄像头权限和做不到什么。普通界面不显示绝对角度，数字在 **调试：角度数字**。

## 运行

```bash
npm install
npm test
npm run dev
```

打开终端打印的本地地址（默认 http://localhost:5173）。

```bash
npm run build
npm run preview
```

GitHub Actions（`.github/workflows/ci.yml`）会在推送到 `main` 以及针对 `main` 的 Pull Request 上运行 `npm ci`、`npm test` 和 `npm run build`。

无需 API 密钥。Face Landmarker 的 WASM 从 jsDelivr 加载；`.task` 模型优先使用 `public/models/`，否则回退到 Google MediaPipe 模型主机。

## 左右约定（FISWG）

| 符号 | 含义 |
|------|------|
| **+yaw** | 右耳更可见（右侧面） |
| **−yaw** | 左耳更可见（左侧面） |
| **+pitch** | 鼻尖朝上（头向后仰） |
| **+roll** | 被拍摄者右耳朝上 |

Euler 顺序为 **YXZ**（内旋 `R = Ry · Rx · Rz`），单位为**度**。4×4 面部变换矩阵按**行主序**处理。MediaPipe 度量人脸：+X = 被拍摄者右侧，+Y = 上，+Z = 朝向摄像头。在该轴向下，原始正 Ry 会露出*左*耳，因此实现里对 yaw **取反**（`src/lib/euler.ts` 中 `FISWG_YAW_SIGN = -1`）以符合 FISWG。pitch 和 roll 不翻转。

引导文案说的是用户**身体**的左右，不是屏幕左右。

## 前置摄像头 / 镜像注意

**只用 CSS 镜像预览。不要翻转 yaw。**

1. `<video>`（以及叠加 canvas）使用 `transform: scaleX(-1)`，让前置摄像头像镜子。
2. Face Landmarker 跑在**原始、未镜像**的 `HTMLVideoElement` 缓冲上。
3. 保存的静帧来自未镜像缓冲，解剖左右是对的。
4. 不要再对 yaw 取反来“补偿” CSS 镜像——会双重校正并左右对调。

## 拍摄（qualityPeakYaw）

头部位姿管**方向**。能不能拍，看这个人这一侧耳朵是否够清楚，转头过程里自动学。

每一侧记下耳区质量分最高时的 `bestYaw`。分数 = 0.45 Laplacian + 0.35 边缘 + 0.20 侧脸内容。接近同分时偏向**更小的 \|yaw\|**。大约 45° 的清晰峰值可以就绪；只停在一个通用大角度、还没学会峰值，不能拍。

就绪需同时满足：

1. 检测到人脸，尺寸在 `[minFaceHeightRatio, maxFaceHeightRatio]` 内
2. 这一侧已经有 **bestYaw**
3. 当前 yaw 进入最佳附近 **±5°**，离开要到 **±8°**；pitch/roll 在限内
4. 大约稳定 **12** 帧
5. 分数 ≥ 该侧峰值的 **92%**，亮度在范围内

峰值锁定前只介绍怎么转（不会按万能角度喊往回或保持）。锁定后，过了 `bestYaw` 且分数掉了才请你往回；往回走时是保持。没有「请确认耳朵已经正了」这一步。自动快门第一次默认关；打开后等 3 帧按分数选最好，再倒数（`autoshutterMs`），可取消。**重新学习此侧** 会先确认，然后回到扫转介绍。

## 调参

数值阈值在 **`src/config/pose-config.json`**。用户可见文案在 **`src/i18n/`**。改阈值后刷新。

| 想要… | 改这里 |
|--------|--------|
| 搜索 / 偏好带 | `search.yawAbsMin` / `yawAbsMax` / `preferredAbs*` |
| 就绪 vs 个人峰值 | `ready.bandDegAroundBest`、`ready.exitBandDeg`、`ready.scoreRatioOfBest` |
| 过冲 | `ready.overshootPastBestDeg` |
| 自动快门倒数 | `ready.autoshutterMs`、`ready.burstFrames` |
| 减少闪烁 | `promptUx.minDwellMs`、`crossFamilyDwellMs`、`smoothing.oneEuro` |
| 清晰度下限 | `score.sharp`、`score.struct` |
| 文案 | `src/i18n/messages.ts` |

## 项目结构

```
src/config/pose-config.json   qualityPeakYaw 阈值（与语言无关）
src/i18n/                     中英文界面与引导文案
src/lib/euler.ts              矩阵 → YXZ → FISWG 符号
src/lib/guidance.ts           渐进提示 + 就绪门控
src/lib/personal-best.ts      按耳区质量更新 bestYaw
src/lib/quality.ts            Laplacian / 边缘 / 加权分数
docs/LIMITS.md                blockers, ceiling vs cannot-do (EN)
docs/LIMITS.zh-CN.md          卡点 / 上限 / 明确做不到
docs/interaction-gaps.zh-CN.md 交互 P0 与剩余缺口
src/components/EarCaptureApp.tsx
```

单元测试（`npm test`）覆盖 Euler、提示流程、bestYaw（含 45° 峰值）、语言查找、停留和 ROI 质量——不需要摄像头。

应用内的**姿态模拟器**可以让质量随角度变化，用来看就绪是不是不必卡在固定大角度。
