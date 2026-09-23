# HarmonyOS NEXT Web shell（脚手架，不是可装 HAP）

[中文](#中文) · [English](#english)

本目录是纯血鸿蒙（HarmonyOS NEXT）的 **ArkTS Stage Web 壳**。它加载仓库里已有的 Vite 拍耳页面。拍耳算法、READY / SOFT_READY、个人峰值都不在这里改。

**现在不能安装。** 没有签名材料，没有在本仓库打出 HAP，也没有真机冒烟。Android debug APK **不能**装到纯血 NEXT。仓库外旧的 `harmony/` 树没有捡回来当「已支持」。

突破条件（全部勾上之前，禁止写「可装 HAP」或「已支持鸿蒙」）：[`docs/harmony-next-path.md`](../docs/harmony-next-path.md) §1.3。证书只列名字：[`docs/harmony-signing-secrets.md`](../docs/harmony-signing-secrets.md)。

## 这个壳做什么

- `entry` 模块用 ArkUI `Web` 打开 `rawfile/index.html`。
- 相机：`module.json5` 声明 `ohos.permission.CAMERA`；Ability 里向用户要权限；网页 `getUserMedia` 时在 `onPermissionRequest` 里把网页请求的资源授权给**我们自己的页面**。这条桥 **没有真机验证**。
- 网页资源要相对路径。仓库 Vite `base` 已是 `./`。本地 `.task` 模型地址跟 `import.meta.env.BASE_URL` 走，和 `index.html` 同级。WASM 仍从 jsDelivr 加载，第一次打开需要网络。
- 产品仍是清晰正面 **耳廓** 照片，不是医疗、不是耳镜，READY 不设 70–90° 硬门。

同步网页（在仓库根目录，不打 HAP）：

```bash
npm run harmony:sync
```

这会先 `npm run build`，再把 `dist/` 拷进 `entry/src/main/resources/rawfile/`（保留本说明）。拷贝结果不入库。

## 本机 DevEco 出包（本云端 VM 不做）

1. 在 **Windows 或 macOS** 安装 HarmonyOS NEXT 的 DevEco Studio。不要在 Cursor 云端 VM 里装模拟器验收。
2. 先在仓库根目录跑 `npm run harmony:sync`，确认 `rawfile/index.html` 已生成。
3. 用 DevEco 打开 **本目录**（`harmony/`），不要打开仓库根。让它同步 ohpm / SDK。
4. `build-profile.json5` 里的 `compatibleSdkVersion` / `targetSdkVersion` 现为 `5.0.0(12)`，`runtimeOS` 为 `HarmonyOS`。若和已装 SDK 不一致，改成你本机的 NEXT SDK 版本再同步。这个字符串没有在云端编译验证过。
5. Signing Configs 里配置调试签名。材料不要提交。名字见签名清单。没有证书就不要假装已经签过。
6. 在真机或 **本机** DevEco 模拟器上 Run。未签名的产物不能当作可安装 HAP。

## 命令行出包（工具链和签名都齐了才做）

官方入口：[获取命令行工具](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-commandline-get)、[命令行构建应用](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-commandline-building-app)。Linux 用的是 Command Line Tools，不是 DevEco GUI。下载中心通常要华为开发者账号。

在已经装好 Command Line Tools 和 NEXT SDK 的机器上（不是这台临时 VM）：

```bash
npm run harmony:sync
cd harmony
ohpm install --all
hvigorw assembleHap --mode module -p product=default -p buildMode=debug --no-daemon
```

`signingConfigs` 现在是空的。没有三件套时，即使 `assembleHap` 跑完，也只是未签名归档，**不能**叫可装 HAP。签好之后才用 `hdc install`。调试 Profile 要绑设备 UDID；目前没有 UDID，这一步搁置。

本仓库 CI 只跑到 rawfile 同步，故意不调用 `hvigorw`。

---

## English

ArkTS Stage Web shell for HarmonyOS NEXT. It loads the existing Vite ear-capture page. Capture logic, READY / SOFT_READY, and the personal peak stay in the web app.

**Not installable today.** No signing material, no HAP from this repo, no on-device smoke. The Android debug APK does **not** install on HarmonyOS NEXT. The old local `harmony/` tree outside the repo is not revived as support.

Breakthrough checklist: [`docs/harmony-next-path.md`](../docs/harmony-next-path.md) §1.3. Certificate names only: [`docs/harmony-signing-secrets.md`](../docs/harmony-signing-secrets.md).

### What the shell does

- The `entry` module opens `rawfile/index.html` in an ArkUI `Web` component.
- Camera: `module.json5` declares `ohos.permission.CAMERA`; the Ability asks the user; `onPermissionRequest` grants the resources our own page asked for. **Not verified on a device.**
- Assets are relative. Vite `base` is `./`. The local `.task` URL follows `import.meta.env.BASE_URL`, beside `index.html`. WASM still loads from jsDelivr, so the first launch needs a network.
- The product is a clear frontal **pinna** photo, not medical and not an otoscope. READY has no 70–90° hard gate.

From the repo root (does not build a HAP):

```bash
npm run harmony:sync
```

### DevEco on a developer machine (not this cloud VM)

1. Install DevEco Studio for HarmonyOS NEXT on **Windows or macOS**. Do not install the emulator on the Cursor cloud VM.
2. Run `npm run harmony:sync` first so `rawfile/index.html` exists.
3. Open **this directory** (`harmony/`) in DevEco, not the repo root. Let ohpm / SDK sync.
4. `compatibleSdkVersion` and `targetSdkVersion` are `5.0.0(12)`, `runtimeOS` is `HarmonyOS`. If that does not match the installed SDK, change them locally. This cloud VM did not compile the project.
5. Fill Signing Configs locally. Do not commit the material. No certificates are in the repo, so do not treat the project as signed.
6. Run on a handset or a **local** DevEco emulator. An unsigned archive is not an installable HAP.

### CLI, only after the toolchain and signing exist

Docs: [command-line tools](https://developer.huawei.com/consumer/en/doc/harmonyos-guides/ide-commandline-get), [build an app from the command line](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-commandline-building-app). Linux uses Command Line Tools, not the DevEco GUI. The download center usually requires a Huawei developer account.

```bash
npm run harmony:sync
cd harmony
ohpm install --all
hvigorw assembleHap --mode module -p product=default -p buildMode=debug --no-daemon
```

`signingConfigs` is empty. Without the signing trio, a finished `assembleHap` is still not an installable HAP. `hdc install` comes after a real signature. A debug profile needs a device UDID; there is none yet, so that step is shelved.

CI only syncs `rawfile`. It does not call `hvigorw`.
