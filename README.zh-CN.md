# auto_ear_detect

[中文](README.zh-CN.md) · [English](README.md)

[![CI](https://github.com/strongerfly/auto_ear_detect/actions/workflows/ci.yml/badge.svg)](https://github.com/strongerfly/auto_ear_detect/actions/workflows/ci.yml)

实时**头部姿态引导耳廓拍摄**。慢慢转，找到耳朵最清楚的角度——应用会记住每一侧。学的是这个人这一侧的角度，不是假定人人同一个姿势。

技术栈：**Vite + React + TypeScript** + `@mediapipe/tasks-vision` Face Landmarker（`VIDEO` 模式，`outputFacialTransformationMatrixes: true`）。

页头切换 **中文 / English**。偏好保存在 `localStorage`（`auto-ear-detect:locale:v1`）。默认：浏览器语言 `zh*` 用中文，否则英文。

## 怎么用

1. 允许摄像头。被拒了就到浏览器设置里允许这个网站。需要的话在页头切 **中文 / English**。
2. 第一次先选 **拍左耳** 或 **拍右耳**（身体的左右，不是镜子），选之前不能拍。选择保存在 `localStorage`（`auto-ear-detect:chosen-side:v1`）。切换左右会重置这一侧的快门/引导，另一侧记住的角度还在。拍右耳 → 向左转头；拍左耳 → 向右转头。跟着提示走，不要对着镜子反着学。
3. **转头**慢慢转（不是转电脑/手机）。第一次要慢慢转过，系统才会记住这一侧；在此之前拍摄按钮是灰的。转太快会提示转慢一点。
4. 转过头很正常：「往回一点」是朝刚才更清楚的那边转回去，别继续转到后脑勺。转到头了会说「到头了，往回一点」。
5. 等到 **可以拍了**（如果峰值偏弱，会用另一句「目前最清楚」而不是同一句 READY）。默认开着自动快门，会有倒计时——需要的话点 **取消自动拍摄**。拍完会告诉你这张是否接近最清楚的角度（没有绝对度数），然后可 **重拍** 或 **拍另一只耳**。
6. 接着拍另一侧：点另一侧按钮再慢慢转。系统不会自己换侧。框在另一只耳朵上时，自己点另一侧——这和提示「方向反了」（转头方向）不是一回事。

换了发型或眼镜、角度记错、一直出不了「可以拍了」：用 **重新学习此侧**（再确认一次，只清这一侧），再慢慢转一次。误点确认的话，拍不了，直到重新学会。转了很久仍没更清楚时会出现 **再试一次** / 重新学习 / 拨开头发换亮一点，不会只留一个灰色快门。应用里的 **使用说明** 还有做不到什么。

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

## Android 调试 APK

用 Capacitor 8 把现有的 Vite 构建包进 Android WebView。耳廓拍摄界面本身不改。

需要 Node.js LTS、JDK 21，以及带 `platforms;android-36` 和 `build-tools;35.0.0` 的 Android SDK（Android Gradle Plugin 8.13 在接受 SDK 许可后，第一次构建会安装 35.0.0）。`ANDROID_HOME` 要指向该 SDK。

```bash
npm ci
npm run android:debug
```

这条命令会先构建网页，再同步进 `android/`（`cap sync`），然后执行 `./gradlew assembleDebug`。

APK 路径：

`android/app/build/outputs/apk/debug/app-debug.apk`

同一次调试构建的副本在 `artifacts/app-debug.apk`，可以直接下载。网页改过之后用 `npm run android:debug` 重新生成；以 Gradle 输出为准。

手机开 USB 调试后安装：

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

也可以把 APK 拷到手机上直接打开（允许该来源安装）。最低 Android 7（API 24）。弹出摄像头权限时点允许。Face Landmarker 的 `.task` 模型在同步时从 `public/models/` 打进包里。WASM 仍从 jsDelivr 加载，所以第一次打开需要联网。

`.github/workflows/android-debug-apk.yml` 会打出同一个调试 APK，并作为名为 `app-debug` 的构建产物上传。

这是调试签名（Gradle 的 debug keystore），不是上架用的正式包。CI 不会启动模拟器，也不会打开摄像头。WebView 的 GPU 委托失败时，应用会按原逻辑退回 CPU。

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

每一侧记下耳区质量分最高时的 `bestYaw`。分数 = 0.45 Laplacian + 0.35 边缘 + 0.20 侧脸内容。接近同分时偏向更小的侧面角。**转头过程里自动学**；没有先记一个万能偏移再拍的步骤。还没学会峰值时不能拍。

就绪需同时满足：

1. 检测到人脸，尺寸在 `[minFaceHeightRatio, maxFaceHeightRatio]` 内
2. 这一侧已经有 **bestYaw**
3. 当前 yaw 在最佳附近 **±5°**（离开用 **±8°** 滞回，`exitBandDeg`），pitch/roll 在限内
4. 大约稳定 **12** 帧
5. 分数 ≥ 该侧峰值的 **92%**，亮度在范围内

没有「请确认耳朵已经正了」这一步。峰值锁定前只扫转（不会按先验喊往回）。锁定后，过了 `bestYaw` 且分数掉了会说「往回一点，刚才那边更清楚」；往回走是保持，不是再转一点点。自动快门等 3 帧就绪后进入可取消的 **`autoshutterMs`** 倒数。**重新学习此侧**会再确认一次才清掉记住的峰值；学习本身是自动的。绝对角度 HUD 默认隐藏，只有打开 **调试：显示角度** 才出现。灰色快门会说明学习中 / 快到了 / 可以拍了——灰按钮近峰用 **NEAR_PEAK**（「快到了…」），不用 **HOLD_STILL**（「保持不动」）。`minSweepCoverageRatio` **不是** READY 硬门。

## 上限与短板

这版**能做的**：用端上 Face Landmarker 管转向，用耳区清晰度在转头过程里自动学这个人这一侧**最清楚的耳廓帧**。能不能拍，跟个人峰值走，不跟人人同一套固定姿势走。

这版**不能装懂的**：不是医院耳镜，看不见外耳道，也不理解「耳朵」。大侧面跟丢、头发/模糊假峰、清晰度分数随摄像头漂移，都还要更好的模型和侧脸标注。换发型或眼镜会让旧峰值过期——所以才有 **重新学习此侧**。

完整表（卡点 / 上限 / 后续 / 条件）：**[docs/LIMITS.zh-CN.md](docs/LIMITS.zh-CN.md)** · **[docs/LIMITS.md](docs/LIMITS.md)**。

## 调参

数值阈值在 **`src/config/pose-config.json`**。用户可见文案在 **`src/i18n/`**。改阈值后刷新。

| 想要… | 改这里 |
|--------|--------|
| 搜索 / 偏好带 | `search.yawAbsMin` / `yawAbsMax` / `preferredAbs*` |
| 就绪 vs 个人峰值 | `ready.bandDegAroundBest`、`ready.exitBandDeg`、`ready.scoreRatioOfBest` |
| 过冲 | `search.overshootPastBestDeg` |
| 自动快门倒数 | `ready.autoshutterMs`、`ready.burstFrames` |
| 减少闪烁 | `promptUx.minDwellMs`、`crossFamilyDwellMs`、`slowDownPreemptMs`、`slowDownHoldMs`、`smoothing.oneEuro` |
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
src/components/EarCaptureApp.tsx
```

单元测试（`npm test`）覆盖 Euler、提示流程、bestYaw（含 45° 峰值）、语言查找、停留和 ROI 质量——不需要摄像头。

应用内的**姿态模拟器**可以让质量随角度变化，用来看就绪是不是跟个人最清楚的角度走。
