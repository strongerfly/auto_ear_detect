# auto_ear_detect / 机器人拍耳 — 续做交接（2026-09-22）

**日期**：2026-09-22（Asia/Shanghai）

> **快照 / Snapshot，不是唯一真相源。**  
> 和现状不一致时，以 **GitHub `main`、open PR、总管当前进度板** 为准。  
> Continuity aid only. Live `main`, open PRs, and the orchestrator's live board take precedence when they diverge.

**状态注解（2026-09-23）**：下面第 1、2 条在快照里是 P0 未完成。PoC 已由 [PR #15](https://github.com/strongerfly/auto_ear_detect/pull/15) 合入，Android debug APK 已由 [PR #16](https://github.com/strongerfly/auto_ear_detect/pull/16) 合入。不要再按「未完成」重做。

## 仓库与本机
- GitHub: https://github.com/strongerfly/auto_ear_detect
- 本机: D:\project\cusor\auto_ear_detect（禁 C:；D: 约 0.34GB，本机 Gradle 不稳）
- Android Studio: D:\Program Files\Android\Android Studio
- Capacitor android: ...\auto_ear_detect\android
- Harmony 壳: ...\auto_ear_detect\harmony（需 DevEco，非本轮）

## 账号注意
- On-demand 开在「账号 B」；Grok Bot 拉 Cloud Agent 必须登录同一账号，否则报 usage used up。
- 换号会清空该号下机器人列表视图；**仓库与本机代码不丢，不要重搭产品。**

## 未完成（按优先级 · 2026-09-22 快照）
1. **[P0] Android Capacitor debug APK（云端）** — 快照：Grok Bot→Cloud Agent；成功标准：可安装 APK 路径或 CI 产物 + PR。**已被取代**：PR #16 已在 main。
2. **[P0] robot-ear-workstation-poc 进仓 PR** — 快照：目录 `robot-ear-workstation-poc/`；当时本机/box 已有 SIM+docs；tar 线索 `/workspace/robot-ear-workstation-poc.tar.gz`。**已被取代**：PR #15 已在 main。不要再交一份同名树。
3. **[P1] B soft-success 可感知** — 快照：本地曾绿，待推 PR。2026-09-23 仍未合入 main；有 open PR 时以 PR 为准。
4. **[P1] C 模拟器收起文案** — B 后（快照；2026-09-23 仍未见合入 main）
5. **[P2] Python 桌面版** — 快照写「Android 完成后」。APK 已在 main；是否开工以总管进度板为准。
6. **[P2] 鸿蒙 HAP** — 仍排队。需 DevEco + 签名；无官方 Capacitor 鸿蒙路径；本仓库无 CI HAP。上限见 `docs/LIMITS.md`。不能写成已支持上架。
7. **机器人拍耳中期** — NBV/耳分割/AE；等短期 PoC 指标后再拆（不做底盘/耳镜）

## 已完成（勿重做）
- 手机/Web 拍耳主线多 PR 合入；质量驱动 yaw；LIMITS 1–8；首启选侧 #14
- 短/中/长机器人拍耳调研；短期工位 PoC SIM+文档骨架

## 一键续做口令（给总管）
**2026-09-22 原文**：用户说 `launch` → 立刻 Cloud Agent：① Android Capacitor debug APK ② PoC 进仓 PR。  
**不要再执行这两项**（已分别是 PR #16、PR #15）。禁止共享桌面登 gh。
