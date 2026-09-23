# auto_ear_detect 进度板

**日期 / 更新**：2026-09-22 15:24 Asia/Shanghai（CST）  
**仓库**：https://github.com/strongerfly/auto_ear_detect  
**本机**：`D:\project\cusor\auto_ear_detect`（禁 C: 包装；D: 空间紧时优先云端 APK）

> **快照 / Snapshot，不是唯一真相源。**  
> 下表是 2026-09-22 的连续性记录。和现状不一致时，以 **GitHub `main`、open PR、总管当前进度板** 为准。  
> Continuity aid only. Live `main`, open PRs, and the orchestrator's live board take precedence when they diverge.

## 快照之后、已知已在 main 落地（注解，非 2026-09-22 原文）

| 事项 | 依据 |
|------|------|
| 工位 PoC `robot-ear-workstation-poc/` | [PR #15](https://github.com/strongerfly/auto_ear_detect/pull/15)，2026-09-23 合入 |
| Android Capacitor debug APK | [PR #16](https://github.com/strongerfly/auto_ear_detect/pull/16)，2026-09-23 合入；README「Android debug APK」、`artifacts/app-debug.apk` |
| 鸿蒙 HAP | **仍未**作为可上架交付。上限在 `docs/LIMITS.md` 与 `docs/LIMITS.zh-CN.md`；不入库 `harmony/` |

---

## 完成

| ID | 事项 | 备注 |
|----|------|------|
| web-main | 手机/Web 拍耳主线多 PR 合入 | Vite+React+MediaPipe；质量驱动个人最佳 yaw |
| i18n | 中英切换 | 已合入 |
| limits | LIMITS 1–8 与短板同步 | 已合入 |
| ux-hard | 去硬板角度门槛 / SLOW_DOWN dwell 等 | 已合入 |
| side-pick | 首启选侧（曾 PR#14） | 已合入 |
| research-robot | 机器人拍耳短/中/长调研 | 已交付 |
| poc-sim | 短期工位 PoC SIM+文档骨架 | 快照：已在旧环境生成、当时待进仓。进仓已由 PR #15 完成，见文首注解 |
| templates | 七角色 Public 模板发布 | 总管/工程/调研/发布巡检/文档/测试/交互；新账号需 Import |

---

## 进行中 / 未完成

下列「未完成」是 **2026-09-22 快照用语**。android-apk 与 poc-pr 已被 main 取代，不要当成当前未完成。

| 优先级 | ID | 事项 | 成功标准 | 状态 |
|--------|-----|------|----------|------|
| P0 | android-apk | Android Capacitor **云端** debug APK | PR + 可安装 APK（CI/artifacts）+ 安装说明 | **快照写「未完成」**（Cloud Agent 曾因 usage/on-demand 失败）。**已被取代**：2026-09-23 PR #16 已在 main |
| P0 | poc-pr | `robot-ear-workstation-poc/` 进仓 | 目录入仓 + PR + README 可跑 SIM | **快照写「未完成」。已被取代**：2026-09-23 PR #15 已在 main |
| P1 | ticket-b | soft-success 可感知 | PR 合入；用户可感知 | 快照：待额度通后。2026-09-23 仍未合入 main；若有 open PR，以该 PR 与总管进度板为准 |
| P1 | ticket-c | 模拟器收起文案 | PR；建议在 B 后 | 待办（快照；2026-09-23 仍未见合入 main） |
| P2 | python | Python 桌面版 | 可运行说明 + 代码/PR | 快照：Android 完成后。APK 已在 main，本项是否开工以总管进度板为准 |
| P2 | harmony | 鸿蒙 HAP | HAP 或诚实上限文档 | 快照：需 DevEco；排队。HAP 仍未入库；诚实上限见 `docs/LIMITS.md` |
| later | robot-mid | 中期 NBV/耳分割/AE | PoC 指标后再拆 | **不做**底盘/医疗耳镜 |

---

## 阻塞

| 项 | 原因 | 归属 | 解法 |
|----|------|------|------|
| Cloud Agent from Grok Bot | `usage used up` / On-demand 未与当前账号对齐 | 用户 | **2026-09-22 快照。** 是否仍阻塞以当前账号为准，不由本板宣布已解除 |

---

## 口令

对总管说 **`launch`**（或粘贴 `给新总管-未完成任务续做.md` 后说「按交接续做」）在 **2026-09-22** 的意思是并行开两个 Cloud Agent：① Android APK ② PoC 进仓。  
**这两项已在 main（PR #16、PR #15），不要按该口令再开进仓 PR。**  
禁止共享桌面输 GitHub 密码。

---

## 换号说明

侧边栏机器人/聊天**不会**随账号迁移；本目录 + GitHub + 本机代码是连续工作的依据。详见 `换号重建清单.md`。
