# auto_ear_detect

[中文](README.zh-CN.md) · [English](README.md)

[![CI](https://github.com/strongerfly/auto_ear_detect/actions/workflows/ci.yml/badge.svg)](https://github.com/strongerfly/auto_ear_detect/actions/workflows/ci.yml)

实时**头部姿态引导耳廓拍摄**。摄像头 + MediaPipe Face Landmarker 估计 yaw / pitch / roll，屏幕文案提示如何转头，只有选定一侧耳朵的正面姿态稳定且清晰时才允许拍摄。

技术栈：**Vite + React + TypeScript** + `@mediapipe/tasks-vision` Face Landmarker（`VIDEO` 模式，`outputFacialTransformationMatrixes: true`）。

界面与引导提示支持 **中文 / English**。在页头切换语言。偏好保存在 `localStorage` 键 `auto-ear-detect:locale:v1`。默认规则：浏览器语言为 `zh*` 时用中文，否则用英文；可随时覆盖。

## 运行

```bash
npm install
npm test
npm run dev
```

打开终端打印的本地地址（默认 http://localhost:5173）。允许摄像头权限。使用 **拍左耳** / **拍右耳**。应用内可展开 **使用说明** / **Instructions** 查看简要操作步骤。

```bash
npm run build
npm run preview
```

GitHub Actions（`.github/workflows/ci.yml`）会在推送到 `main` 以及针对 `main` 的 Pull Request 上运行 `npm ci`、`npm test` 和 `npm run build`。

无需 API 密钥。Face Landmarker 的 WASM 从 jsDelivr 加载；`.task` 模型优先使用 `public/models/` 中的本地文件，否则回退到 Google MediaPipe 模型主机。

## 左右约定（FISWG）

| 符号 | 含义 |
|------|------|
| **+yaw** | 右耳更可见（右侧面） |
| **−yaw** | 左耳更可见（左侧面） |
| **+pitch** | 鼻尖朝上（头向后仰） |
| **+roll** | 被拍摄者右耳朝上 |

Euler 顺序为 **YXZ**（内旋 `R = Ry · Rx · Rz`），单位为**度**。4×4 面部变换矩阵按**行主序**处理。MediaPipe 度量人脸坐标系：+X = 被拍摄者右侧，+Y = 上，+Z = 朝向摄像头。在该轴向下，原始正 Ry 会露出*左*耳，因此实现里对 yaw **取反**（`src/lib/euler.ts` 中 `FISWG_YAW_SIGN = -1`）以符合 FISWG。pitch 和 roll 不翻转。

默认目标（亦见 `src/config/pose-config.json`）：

- 右耳：yaw **70–90°**（中心 80），\|pitch\|≤8，\|roll\|≤8
- 左耳：yaw **−90–−70°**（中心 −80），pitch/roll 相同

## 前置摄像头 / 镜像注意

**采用方案：仅用 CSS 镜像预览。不要翻转 yaw。**

1. `<video>`（以及叠加 canvas）使用 `transform: scaleX(-1)`，让前置摄像头像镜子。
2. Face Landmarker 跑在**原始、未镜像**的 `HTMLVideoElement` 缓冲上。CSS 不会改这些像素。
3. 保存的静帧来自未镜像缓冲，因此文件中的解剖左右与 FISWG 一致。
4. 引导文案（例如「请向左转头，露出右耳」）指的是用户**身体**的左右，不是屏幕左右。

**不要再对 yaw 取反**来“补偿” CSS 镜像——那会双重校正并左右对调。

如果改为绘制镜像 canvas 并在*那张图*上跑 Face Landmarker，MediaPipe 的左右关键点会互换。那时需要**同时取反 yaw 并交换耳区 ROI 索引**。本项目刻意不走这条路。

## 拍摄门控

就绪（按钮可用 + 可选自动快门）需同时满足：

1. 检测到人脸，尺寸在 `[minFaceHeightRatio, maxFaceHeightRatio]` 内
2. 姿态落在偏移校正后的 yaw 中心附近的**就绪**区间（`readyMaxAbsYawError` 5°，pitch/roll 8°）
3. 连续稳定 **12** 帧，yaw / pitch / roll 的 \|Δangle\| 均 &lt; 3°
4. 耳区质量：Laplacian ≥ 100，亮度 60–200，Sobel 边缘能量 ≥ 15

引导为单行提示，**400 ms** 停留（防闪烁）。优先级：

`NO_FACE` → 距离 → roll → pitch → yaw 转向提示 → 头发/模糊（`CLEAR_HAIR`）/ 光线（`BAD_LIGHT`）→ `HOLD_STILL` → `READY`

## 个人 yaw 偏移

有些耳朵的最佳侧面角度略有不同。每侧偏移（限制在 ±15°）保存在 `localStorage` 键 `auto-ear-detect:offset:v1`。

**校准此侧偏移**：在 \|yaw\| 处于 60–95° 时慢慢转头。耳区 ROI Laplacian 峰值对应的 yaw 记为 `offset = clamp(yawPeak − yawCenter, −15, 15)`。yaw 目标区间和转向提示阈值会随该偏移平移，再限制在合理侧面范围（约 50–100° 或 −100–−50°）。

## 调参

数值阈值在 **`src/config/pose-config.json`**。用户可见文案（引导、按钮、说明）在 **`src/i18n/`**，随语言切换。修改阈值后需重启/刷新。

| 想要… | 改这里 |
|--------|--------|
| 更严的「就绪」 | `captureBands.readyMaxAbsYawError` |
| 减少闪烁 | `promptUx.minDwellMs`、`smoothing.oneEuro` |
| 更严的清晰度门控 | `earRoiQuality.laplacianMin` / `minEdgeEnergy` |
| 改文案 | `src/i18n/messages.ts` |

平滑使用 One Euro 滤波（`minCutoff` 1.0，`beta` 0.007，`dCutoff` 1.0）。

## 项目结构

```
src/config/pose-config.json   数值阈值（与语言无关）
src/i18n/                     中英文界面与引导文案
src/lib/euler.ts              矩阵 → YXZ → FISWG 符号
src/lib/guidance.ts           pickPrompt 状态机
src/lib/quality.ts            Laplacian / 亮度 / 边缘
src/components/EarCaptureApp.tsx
```

单元测试（`npm test`）覆盖 Euler 往返、FISWG yaw 符号、提示优先级、偏移限制、停留、ROI 质量以及语言查找——不需要摄像头。

应用内的**姿态模拟器**可注入合成 yaw/pitch/roll，无需摄像头也能验证引导。
