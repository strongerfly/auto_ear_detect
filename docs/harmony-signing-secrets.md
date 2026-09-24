# Harmony signing materials (names only)

[English](#english) · [中文](#中文)

日期：2026-09-23。A0。证书 **未提供**。本文件只列将来签名要用的名字。仓库里没有 `.p12` / `.cer` / `.p7b`，没有密码，也没有占位假证书。`harmony/build-profile.json5` 的 `signingConfigs` 是空数组。

不要把下面的变量名填成假密码再提交。可装 HAP（A1）和真机 UDID 已搁置，见 [harmony-next-path.md](./harmony-next-path.md) §1.3。

## English

When a human later signs a debug or release HAP, these are the pieces DevEco / `hap-sign-tool` expect. Map them into `signingConfigs` on a machine that holds the secrets. Do not commit the files.

| Piece | Typical file | Variable name | `build-profile.json5` field |
|-------|----------------|---------------|------------------------------|
| Keystore | `.p12` | `HARMONY_STORE_FILE` | `material.storeFile` |
| Keystore password | — | `HARMONY_STORE_PASSWORD` | `material.storePassword` |
| Key alias | — | `HARMONY_KEY_ALIAS` | `material.keyAlias` |
| Key password | — | `HARMONY_KEY_PASSWORD` | `material.keyPassword` |
| Certificate | `.cer` | `HARMONY_CERT_FILE` | `material.certpath` |
| Profile | `.p7b` | `HARMONY_PROFILE_FILE` | `material.profile` |
| Signature algorithm | — | `HARMONY_SIGN_ALG` | `material.signAlg` (usually `SHA256withECDSA`) |

Also required, not secret files:

| Fact | Value today | Notes |
|------|-------------|--------|
| Bundle name | `app.autoeardetect.earcapture` | Must match the profile. Declared in `harmony/AppScope/app.json5`. |
| Device UDID | **none** | A debug profile usually lists registered devices. No UDID was provided. Do not invent one. |
| Huawei developer account | **not available to this PR** | Needed to download Command Line Tools / SDK and to issue certs in AppGallery Connect. |
| Store listing certs | out of scope | Release/store signing is a later step after a debug HAP actually installs. |

Ignored on purpose (repo root and `harmony/.gitignore`): `*.p12`, `*.cer`, `*.p7b`, `*.csr`.

DevEco’s “Automatically generate signature” needs an IDE login and writes ciphertext passwords into `build-profile.json5`. That flow is for a developer machine. This repo leaves `signingConfigs` empty so a generated block is not mistaken for a committed secret.

## 中文

以后真要签调试或发布 HAP 时，DevEco / `hap-sign-tool` 需要下面这些。在持有密钥的机器上写入 `signingConfigs`。文件不要进仓库。

| 材料 | 常见文件 | 变量名 | `build-profile.json5` 字段 |
|------|----------|--------|------------------------------|
| 密钥库 | `.p12` | `HARMONY_STORE_FILE` | `material.storeFile` |
| 密钥库密码 | — | `HARMONY_STORE_PASSWORD` | `material.storePassword` |
| 密钥别名 | — | `HARMONY_KEY_ALIAS` | `material.keyAlias` |
| 密钥密码 | — | `HARMONY_KEY_PASSWORD` | `material.keyPassword` |
| 证书 | `.cer` | `HARMONY_CERT_FILE` | `material.certpath` |
| Profile | `.p7b` | `HARMONY_PROFILE_FILE` | `material.profile` |
| 签名算法 | — | `HARMONY_SIGN_ALG` | `material.signAlg`（通常 `SHA256withECDSA`） |

另外要齐、但不是密钥文件的：

| 事实 | 当前 | 说明 |
|------|------|------|
| 包名 | `app.autoeardetect.earcapture` | 必须和 Profile 一致。写在 `harmony/AppScope/app.json5`。 |
| 设备 UDID | **没有** | 调试 Profile 通常要登记设备。没有人提供 UDID。不要编一个。 |
| 华为开发者账号 | **本 PR 不可用** | 下载 Command Line Tools / SDK，以及在 AppGallery Connect 签发证书，都要它。 |
| 上架证书 | 不做 | 发布/上架签名排在调试 HAP 真能装上之后。 |

仓库根和 `harmony/.gitignore` 忽略 `*.p12`、`*.cer`、`*.p7b`、`*.csr`。

DevEco「自动签名」要在 IDE 登录，并把密文密码写进 `build-profile.json5`。那是开发者本机的事。这里把 `signingConfigs` 留空，避免一段生成配置被当成已经入库的密钥。
