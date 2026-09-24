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

### HM-IX-0 prep vs acceptance

Sideloadable debug HAP was the aim. This Linux VM cannot install DevEco, sign, or assemble one. Prep that does not need that toolchain is in the scaffold. Acceptance is not met.

| Prep | Where | Cloud status |
|------|--------|----------------|
| Relative asset base | Vite `base: "./"`; built `index.html` uses `./assets/…`; local model URL is `` `${import.meta.env.BASE_URL}models/face_landmarker.task` `` | Written and checked in a local `npm run build`. Not loaded inside ArkWeb. |
| `.task` | Synced only if `public/models/face_landmarker.task` exists. This tree has no `.task` file (only `public/favicon.svg`). Loader HEAD-checks the relative URL, then falls back to Google’s model host. | Strategy only. ArkWeb may reject HEAD and force the remote URL even after a file is synced. |
| WASM | Not bundled. `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm`. First launch needs a network. `INTERNET` is declared. Rawfile origin plus HTTPS WASM is unverified (mixed content). | Strategy only. |
| Camera declaration | `harmony/entry/src/main/module.json5`: `ohos.permission.CAMERA` (in use) and `ohos.permission.INTERNET`. Ability calls `requestPermissionsFromUser`. The Web page grants `getUserMedia` resources in `onPermissionRequest`. | Declared. Not granted on a device. |
| Debug signing | Names only in [harmony-signing-secrets.md](./harmony-signing-secrets.md). `signingConfigs` is `[]`. No UDID, no `.p12` / `.cer` / `.p7b`. | Notes only. No sideload path. |

The old local `harmony/` tree outside this repo is not the success case and is not imported.

Acceptance target, all open, blocked on §1.3:

- [ ] Install on a HarmonyOS NEXT phone and cold-start into the ear UI (中文 / English)
- [ ] First camera prompt: allow → mirrored preview; deny → recoverable copy (not a dead grey shutter)
- [ ] Pick a side → slow turn → personal peak → READY **or** SOFT_READY from quality, with no 70–90° hard gate
- [ ] Capture a still and preview or save it; post-capture feedback stays relative to the peak (no degrees)
- [ ] A hard failure names the cause: permission, WebView, WASM or model, or tracking

Those failure sentences are **not** in the app yet. Today `cameraDenied` says to allow the site in **browser** settings. That is the web/Android line. It is not Harmony recovery copy. HM-IX-2 / HM-IX-3 stay waiting until a device run produces a failure taxonomy or a green path.

### HM-IX-1

Docs match the board: no device run means not supported. LIMITS, both READMEs, and `harmony/README.md` say the Android debug APK does not install on pure HarmonyOS NEXT; use the phone browser or that APK until a signed HAP exists. In-app strings do not mention Harmony and do not say the product is supported there. No new in-app Harmony gate was added. Store listing stays unclaimed.

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

### HM-IX-0 前置和验收

目标曾经是可侧载的调试 HAP。这台 Linux VM 不能装 DevEco、不能签名、也不能打出包。不依赖工具链的前置写在脚手架里。验收没有达到。

| 前置 | 位置 | 云端状态 |
|------|------|----------|
| 相对路径资源 | Vite `base: "./"`；构建出的 `index.html` 使用 `./assets/…`；本地模型地址是 `` `${import.meta.env.BASE_URL}models/face_landmarker.task` `` | 本地 `npm run build` 核对过。没有在 ArkWeb 里加载过。 |
| `.task` | 只有 `public/models/face_landmarker.task` 存在时，同步才会把它拷进去。当前树里没有 `.task`（只有 `public/favicon.svg`）。加载器先对相对地址做 HEAD，失败则回退到 Google 模型主机。 | 只写策略。ArkWeb 可能拒绝 HEAD，即使文件已同步也走远程地址。 |
| WASM | 不打进包。地址是 `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm`。第一次打开需要网络。已声明 `INTERNET`。rawfile 源站再拉 HTTPS WASM 是否算混合内容，未验证。 | 只写策略。 |
| 相机声明 | `harmony/entry/src/main/module.json5`：`ohos.permission.CAMERA`（使用中）和 `ohos.permission.INTERNET`。Ability 调用 `requestPermissionsFromUser`。网页 `getUserMedia` 时在 `onPermissionRequest` 授权。 | 已声明。没有在真机上点过允许。 |
| 调试签名 | 只在 [harmony-signing-secrets.md](./harmony-signing-secrets.md) 列名字。`signingConfigs` 是 `[]`。没有 UDID，没有 `.p12` / `.cer` / `.p7b`。 | 只有说明。没有侧载路径。 |

仓库外的旧 `harmony/` 树不是成功标准，也没有导入。

验收目标全部未勾，卡在 §1.3：

- [ ] 装上纯血 NEXT 手机，冷启动进拍耳界面（中文 / English）
- [ ] 第一次相机权限：允许 → 镜像预览；拒绝 → 可恢复文案（不是死灰）
- [ ] 选侧 → 慢转 → 个人峰 → READY **或** SOFT_READY（质量驱动，无 70–90° 硬门）
- [ ] 拍下静帧并能预览或保存；拍后反馈相对峰值（无度数）
- [ ] 硬失败能归因：权限、WebView、WASM 或模型、跟踪

这些失败句 **还没有** 写进应用。现在的 `cameraDenied` 是「到浏览器设置里允许这个网站」。那是 Web/Android 的句子，不是鸿蒙恢复文案。HM-IX-2 / HM-IX-3 等真机给出失败分类或绿灯路径后再做。

### HM-IX-1

文档和进度板一致：没真机跑通 = 未支持。LIMITS、两份 README、`harmony/README.md` 都写了 Android debug APK 不能装纯血 NEXT；在有签名 HAP 之前用手机浏览器或那个 APK。应用内文案不提鸿蒙，也不说鸿蒙已支持。本轮没有加应用内的鸿蒙门闩。没有写上架。
