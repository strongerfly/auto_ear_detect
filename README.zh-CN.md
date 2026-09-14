# auto_ear_detect

[中文](README.zh-CN.md) · [English](README.md)

[![CI](https://github.com/strongerfly/auto_ear_detect/actions/workflows/ci.yml/badge.svg)](https://github.com/strongerfly/auto_ear_detect/actions/workflows/ci.yml)

实时**头部姿态引导耳廓拍摄**。慢慢转，找到耳朵最清楚的角度——应用会记住每一侧。学的是这个人这一侧的角度，不是假定人人同一个姿势。

技术栈：**Vite + React + TypeScript** + `@mediapipe/tasks-vision` Face Landmarker（`VIDEO` 模式，`outputFacialTransformationMatrixes: true`）。

页头切换 **中文 / English**。偏好保存在 `localStorage`（`auto-ear-detect:locale:v1`）。默认：浏览器语言 `zh*` 用中文，否则英文。

卡点、上限、以及我们不会假装已经解决的问题：**[docs/LIMITS.zh-CN.md](docs/LIMITS.zh-CN.md)** · **[docs/LIMITS.md](docs/LIMITS.md)**。交互覆盖：**[docs/ear-guide-interaction-gaps.md](docs/ear-guide-interaction-gaps.md)**。

## 怎么用

1. 允许摄像头。需要的话在页头切语言。
2. 点 **拍左耳** 或 **拍右耳**（身体的左右，不是镜子）。拍右耳 → 向左转；拍左耳 → 向右转。
3. **转头**慢慢转（不是转电脑/手机），找到耳朵最清楚的角度。第一次要慢慢转过，系统才会记住这一侧；在此之前拍不了。
4. 等到 **可以拍了**。自动快门**默认关着**，打开后到点会自己拍。然后点另一侧重转。

角度记错时用 **重新学习此侧**，再慢慢转一次。应用里的 **使用说明** 还有转过头、摄像头权限和做不到什么。

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

每一侧记下耳区质量分最高时的 `bestYaw`。分数 = 0.45 Laplacian + 0.35 边缘 + 0.20 侧脸内容。接近同分时偏向更小的侧面角。**转头过程里自动学**；没有「先校准偏移」的步骤。还没学会峰值时不能拍。

就绪需同时满足：

1. 检测到人脸，尺寸在 `[minFaceHeightRatio, maxFaceHeightRatio]` 内
2. 这一侧已经有 **bestYaw**
3. 当前 yaw 在最佳附近 **±5°**（已经就绪后退出滞后 **8°**），pitch/roll 在限内
4. 大约稳定 **12** 帧
5. 分数 ≥ 该侧峰值的 **92%**，亮度在范围内

没有「请确认耳朵已经正了」这一步。自动快门默认关着；打开后等 3 帧就绪并**留下分数最高的一张**。**重新学习此侧**会清掉记住的峰值；学习本身是自动的。

还在学习（没有锁定峰值）时，提示只走扫掠引导——60° 先验不会触发「往回一点」或「保持不动」。平时界面不显示绝对目标角度。切换左/右耳会清掉停留中的旧提示，立刻换成这一侧的扫掠引导。

### 为什么是这些数字（交互优先，不是表格）

搜索 \|yaw\| 倾向 **35–90**，READY **进入 ±5°** 个人最佳。硬杠不能让： **~45°** 峰值可以拍；**没有锁峰时 70–90 不能拍**；不问用户自己的角度。

搜索上限**没有**留 100°：landmarker 在 ~90° 附近会丢，再宽也只是噪声。

**保留**了进入 5° 之后的 `exitBandDeg` **8°**。这 ±8 是滞后，避免头晃 1–2° 就让 READY 闪烁。它不是更宽的进入门，也不是 70–90 的替身。

## 天花板 vs 做不到

五列完整内容在 **[docs/LIMITS.zh-CN.md](docs/LIMITS.zh-CN.md)** · **[docs/LIMITS.md](docs/LIMITS.md)**。这里是摘要：

### 能实现的天花板

- 转头时每一侧学 **质量峰值 yaw**（\|yaw\| 35–90，软偏好 40–80）。**~45°** 可以 READY；没有锁峰时，光停在 70–90 不能拍。
- READY 看个人最佳附近（**±5°**，退出滞后 8°），分数 ≥ 峰值 92%，约 12 帧稳住。没有「请确认耳朵正了」。
- 未锁峰：只有扫掠引导。锁峰后转过头：往**个人**峰值回。脸跟丢保留 `bestYaw`。READY 后 3 帧选最高分。

### 明确做不到的

不要把这些写成已经完成。每条都试过；半截路径见 LIMITS。

- **没有耳分割模型。** 脸网格耳点考虑过、没接——侧脸上会崩。现在是猜 ROI + 清晰度。
- **头发 / 遮挡 / 背景纹理** 仍可能假峰。CLEAR_HAIR 只是靠近峰值的启发，不是检测器。
- **运动模糊** 和 **笔记本 FOV** 只处理了一部分（转慢一点、35–90 搜索窗）。Laplacian 80/120 换摄像头不可移植。
- **质量分数 ≠ 解剖耳法向 / 外耳道。** 不是医院耳镜。CI 没有真机摄像头 E2E。
- 大 yaw **跟丢**（~90°）只暂停打分，不会重建 3D 耳。

### 短板 / Shortfalls

假峰、跟丢后锁在窗口内侧、3 帧未对齐 burst（不是融合）、没有 Worker、换发型后旧峰值过期（靠重新学习）。

### 后续优化 / Next optimizations

耳检测/分割 → 学出来的 quality 头 → 设备模糊标定 → 对齐多帧融合 → last-good 冻结 → Worker 推理。外耳道只有在临床范围内才做。

### 优化条件 / Conditions

按角度标注的耳数据（含 ~45°）、端上体积/延迟预算、按设备标定流程、landmarker 已经不稳时仍站得住的侧脸标注集。

## 调参

数值阈值在 **`src/config/pose-config.json`**。用户可见文案在 **`src/i18n/`**。改阈值后刷新。

| 想要… | 改这里 |
|--------|--------|
| 搜索 / 偏好带 | `search.rightEar` / `search.leftEar`（`yawAbsMin` / `yawAbsMax` / `preferredAbs*`） |
| 就绪 vs 个人峰值 | `ready.bandDegAroundBest`、`ready.scoreRatioOfBest` |
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
docs/LIMITS.md                blockers, ceiling, next steps (EN)
docs/LIMITS.zh-CN.md          卡点 / 上限 / 短板 / 后续
docs/ear-guide-interaction-gaps.md  P0/P1 交互覆盖
src/components/EarCaptureApp.tsx
```

单元测试（`npm test`）覆盖 Euler、提示流程、bestYaw（含 45° 峰值）、语言查找、停留和 ROI 质量——不需要摄像头。

应用内的**姿态模拟器**可以让质量随角度变化，用来看就绪是不是跟个人最清楚的角度走。
