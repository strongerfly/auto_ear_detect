# HarmonyOS NEXT path

[English](#english) · [中文](#中文)

日期：2026-09-23。路径 B。本文件是出包与突破条件的说明，不是「已支持鸿蒙」。

配对文档：[harmony-signing-secrets.md](./harmony-signing-secrets.md)（只列材料名）、壳说明：[harmony/README.md](../harmony/README.md)、上限：[LIMITS.md](./LIMITS.md) / [LIMITS.zh-CN.md](./LIMITS.zh-CN.md)。

## English

### What this repo has

| ID | In this PR | Status |
|----|------------|--------|
| B1 | Minimal ArkTS Stage Web shell in `harmony/` | Scaffold only. DevEco has not opened it here. |
| B2 | `npm run harmony:sync` copies `dist/` → `entry/src/main/resources/rawfile/` | Script only. Output is gitignored. |
| A0 | Signing checklist | Names only. No certificates, no passwords, no fake files. |
| DOC | LIMITS + this page | Ceiling stays phone/web + Android debug APK. |

The shell loads the existing Vite page (`base: "./"`). Ear-capture logic is unchanged aside from the local `.task` URL, which now follows `import.meta.env.BASE_URL` so a rawfile page can request `./models/face_landmarker.task` beside `index.html`. WASM stays on jsDelivr. There is no official Capacitor HarmonyOS NEXT path ([capacitor#7818](https://github.com/ionic-team/capacitor/issues/7818)).

The Android debug APK does **not** install on HarmonyOS NEXT.

### What this repo does not have

Shelved on purpose. Do not wait on them inside this PR, and do not claim them:

- A1 installable HAP (`assembleHap` + signature + `hdc install`)
- HM-IX-0 on-device smoke (permission → side pick → personal peak → READY or SOFT_READY → still)
- DevEco emulator on the Cursor cloud VM
- A signed package built on this VM

No Huawei Command Line Tools, NEXT SDK, or signing trio were installed here. The download center usually sits behind a Huawei developer login. Unsigned output must not be called an installable HAP.

### Layout

```
harmony/
  AppScope/app.json5
  build-profile.json5          signingConfigs: []
  entry/src/main/module.json5  INTERNET + CAMERA
  entry/src/main/ets/          Ability + Web page
  entry/src/main/resources/rawfile/   sync target
scripts/sync-harmony-rawfile.mjs
```

Data flow when a human builds later: `npm run harmony:sync` → DevEco or `hvigorw assembleHap` on a machine that already has the SDK → sign with the trio → `hdc install` → device check. Camera is the web app’s `getUserMedia` plus the shell’s permission bridge. That bridge is unverified.

### §1.3 Breakthrough checklist

All unchecked. **Every box is required** before anyone writes “installable HAP” or “Harmony supported”.

- [ ] Huawei developer account can download **Linux Command Line Tools** and the matching **HarmonyOS NEXT SDK**
- [ ] Toolchain lives on a persistent builder (self-hosted runner or equivalent), not a fresh Cursor VM each time
- [ ] Debug or release **signing trio** (`.p12`, `.cer`, `.p7b`) and passwords injected as secrets; `build-profile.json5` can sign without an IDE prompt
- [ ] One acceptance device: handset UDID on the debug profile, **or** a local DevEco emulator (not the Cursor VM)
- [ ] `harmony/` actually assembles, and `npm run harmony:sync` has been run on that build
- [ ] Evidence: `assembleHap` log + signed `.hap` + successful `hdc install`
- [ ] Then HM-IX-0: camera permission, preview, side pick, quality-driven READY or SOFT_READY (no 70–90° hard gate), still frame

Store listing is a later vendor step. It is not a way to skip the list.

Product lines that are not breakthrough items: fixed 70–90° READY, medical / otoscope imaging.

### HM-IX-0

Blocked on §1.3. Not run. Failure classes (permission / WebView / WASM or model / tracking) are not known yet, so HM-IX-2 / HM-IX-3 stay unscheduled.

## 中文

### 仓库里有什么

| ID | 本 PR | 状态 |
|----|--------|------|
| B1 | `harmony/` 最小 ArkTS Stage Web 壳 | 只是脚手架。这里没有用 DevEco 打开过。 |
| B2 | `npm run harmony:sync` 把 `dist/` 拷到 `entry/.../rawfile/` | 只有脚本。产物不入库。 |
| A0 | 签名清单 | 只列名字。没有证书、没有密码、没有假文件。 |
| DOC | LIMITS + 本页 | 上限仍是手机/Web + Android debug APK。 |

壳加载现有 Vite 页面（`base: "./"`）。拍耳逻辑不改；本地 `.task` 地址改为跟着 `import.meta.env.BASE_URL`，这样 rawfile 里的页面能向 `index.html` 同级请求 `./models/face_landmarker.task`。WASM 仍在 jsDelivr。没有官方 Capacitor → HarmonyOS NEXT 路径（[capacitor#7818](https://github.com/ionic-team/capacitor/issues/7818)）。

Android debug APK **不能**装到纯血鸿蒙 NEXT。

### 仓库里没有什么

有意搁置。本 PR 不空等，也不宣称已经做到：

- A1 可装 HAP（`assembleHap` + 签名 + `hdc install`）
- HM-IX-0 真机冒烟（权限 → 选侧 → 个人峰 → READY 或 SOFT_READY → 静帧）
- 在 Cursor 云端 VM 安装 DevEco 模拟器
- 在这台 VM 上编签名包

这里没有安装华为 Command Line Tools、NEXT SDK 或签名三件套。下载中心通常要华为开发者登录。未签名文件不能叫做可装 HAP。

### 以后人工出包时的数据流

`npm run harmony:sync` → 在已有 SDK 的机器上用 DevEco 或 `hvigorw assembleHap` → 用三件套签名 → `hdc install` → 真机看相机和拍耳。相机走网页 `getUserMedia`，壳只做权限桥。桥未验证。

步骤写在 [harmony/README.md](../harmony/README.md)。

### §1.3 突破条件

全部未勾。**每一条都满足之前**，不许写「可装 HAP」或「已支持鸿蒙」。

- [ ] 华为开发者账号能下载 **Linux Command Line Tools** 和对应的 **HarmonyOS NEXT SDK**
- [ ] 工具链在持久构建机上（自托管 Runner 或同类），不是每次换一台新的 Cursor VM
- [ ] 调试或发布 **签名三件套**（`.p12`、`.cer`、`.p7b`）和密码以 Secrets 注入；`build-profile.json5` 能非交互签名
- [ ] 一台验收机：真机 UDID 写进调试 Profile，**或**本机 DevEco 模拟器（不是 Cursor VM）
- [ ] `harmony/` 真能打出包，且那次构建跑过 `npm run harmony:sync`
- [ ] 证据：`assembleHap` 日志 + 签名后的 `.hap` + `hdc install` 成功
- [ ] 然后才是 HM-IX-0：相机权限、预览、选侧、质量驱动的 READY 或 SOFT_READY（无 70–90° 硬门）、静帧

应用市场上架是更后面的厂商步骤，不能用来跳过这张表。

固定 70–90° READY、医疗 / 耳镜，不是突破项，是产品禁区。

### HM-IX-0

依赖 §1.3，本轮未跑。失败类型（权限 / WebView / WASM 或模型 / 跟踪）还不知道，所以 HM-IX-2 / HM-IX-3 先不做。
