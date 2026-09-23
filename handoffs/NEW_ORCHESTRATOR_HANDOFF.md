# 给新总管：auto_ear_detect 未完成任务续做（唯一入口）

> 用法：用户把**本文件全文**贴给你，并说「按交接续做」。  
> `launch` 在 2026-09-22 曾指再开 Android APK 与 PoC 进仓。这两项已在 main，先读下面的快照声明，不要照旧口令重做。  
> 你是编排总管：拆目标、盯 **live** 进度板、派工程/调研/发布巡检/文档/测试/交互；自己不写业务代码、不替测试下验收结论。额度/登录阻塞立刻升级用户。默认中文。

**日期**：2026-09-22（Asia/Shanghai）  
**用户本机机器**：DESKTOP-RBEMGIB（machineId 仅作参考，以当前已注册机器为准）

> **快照 / Snapshot，不是唯一真相源。**  
> 本文件是 2026-09-22 贴给新总管的入口，不是此后的唯一进度板。和现状不一致时，以 **GitHub `main`、open PR、总管当前进度板** 为准。  
> Continuity aid only. Live `main`, open PRs, and the orchestrator's live board take precedence when they diverge.

**状态注解（2026-09-23）**：下文 Android debug APK 与 `robot-ear-workstation-poc/` 若仍写「未完成」，那是快照。二者已在 `main`：[PR #15](https://github.com/strongerfly/auto_ear_detect/pull/15)（PoC）、[PR #16](https://github.com/strongerfly/auto_ear_detect/pull/16)（APK，`android/` 与 `artifacts/app-debug.apk`）。不要为此再开进仓 PR。鸿蒙 HAP 仍未入库；上限见 `docs/LIMITS.md`。

---

## 0. 先读：不要重做产品

- Git 仓库与本机代码**还在**；换 Cursor/Grok Bot 账号只会清空侧边栏机器人与聊天，**不要从零重搭拍耳产品**。
- 真相源优先级（**2026-09-22 原文，已作废**）：本文件进度板 > GitHub main/PRs > 本机目录 > 旧聊天。
- **现行优先级**：GitHub `main` + open PR + 总管当前进度板 > 本快照 > 本机目录 > 旧聊天（旧聊天可能已不可见）。

---

## 1. 仓库与本机路径

| 项 | 值 |
|----|-----|
| GitHub | https://github.com/strongerfly/auto_ear_detect |
| 本机仓库 | `D:\project\cusor\auto_ear_detect` |
| 磁盘约束 | **禁止用 C: 做包装**；D: 曾约 0.34GB 空闲，本机 Gradle/APK 不稳 → **优先云端 APK** |
| Android Studio | `D:\Program Files\Android\Android Studio` |
| Capacitor Android | `D:\project\cusor\auto_ear_detect\android` |
| 鸿蒙壳 | `D:\project\cusor\auto_ear_detect\harmony`（需 DevEco；**非本轮 P0**） |
| GitHub 用户 | strongerfly |

产品形态：Vite + React + MediaPipe 拍耳；质量驱动个人最佳 yaw（非死板 70–90°）；中英切换；LIMITS 文档已写天花板。

产品北极星：只优化交互质量——自适应、自然引导，避免刚性固定角度门槛。

---

## 2. 账号与 Cloud Agent（必读）

- Cloud Agent / On-demand **绑定当前 Cursor 账号**。
- 若 launch 报 `usage used up` / 要开 on-demand：立刻停重试，让用户在当前 Grok Bot 账号打开 On-demand（Unlimited），或确认 Grok Bot 已登录**同一个**有额度的账号。
- **禁止**在共享桌面输入 GitHub 账号密码；推送/PR 用 Cloud Agent、本机 Cursor、或 GitHub Web。
- 绿可合 PR：总管可经 Cloud Agent/流程推动合并；仅权限/登录/额度阻塞升级用户。

---

## 3. 进度板（2026-09-22 快照 · 不是唯一真相）

更新 live 进度时改总管当前进度板，不要只改本快照再当成现状。对照文首「状态注解」。

### 已完成（勿重做）

- 手机/Web 拍耳主线多 PR 已合入 main（含质量驱动 yaw、LIMITS 1–8、首启选侧等；曾见 PR#14 等）
- 中英 i18n、SLOW_DOWN dwell、去硬板 UX 等已推进过
- 机器人拍耳短/中/长调研已交付；短期工位 PoC 的 SIM+文档骨架已在旧环境生成
- 七角色 Public 模板曾在旧账号发布：总管 / 工程 / 调研 / 发布巡检 / 文档 / 测试 / 交互（新账号需 **Import**）

### 进行中 / 未完成（按优先级）

| 优先级 | 任务 | 成功标准 | 状态（交接时） |
|--------|------|----------|----------------|
| **P0** | Android Capacitor **云端** debug APK | PR + 可安装 APK（CI 产物或 artifacts）+ 安装说明 | **快照：未完成**（Cloud Agent 曾因额度失败）。**已被取代**：2026-09-23 PR #16 |
| **P0** | `robot-ear-workstation-poc/` **进仓 PR** | 目录入仓 + PR；README 说明如何跑 SIM | **快照：未完成。已被取代**：2026-09-23 PR #15 已在 main。下文 tar 路径只作当时线索 |
| **P1** | B：soft-success **可感知** | PR 合入；用户能感知 soft-success | 快照：待额度通后。2026-09-23 仍未合入 main；有 open PR 时以 PR 为准 |
| **P1** | C：模拟器收起文案 | PR；建议在 B 之后 | 待办（快照；2026-09-23 仍未见合入 main） |
| **P2** | Python 桌面版 | 可运行桌面客户端说明 + 代码/PR | 快照：Android 完成后再开。APK 已在 main；是否开工以总管进度板为准 |
| **P2** | 鸿蒙 HAP | HAP 路径或诚实上限文档 | 快照：需 DevEco；排队。HAP 仍未入库；上限见 `docs/LIMITS.md`，不要写成已支持上架 |
| 后续 | 机器人拍耳中期（NBV/耳分割/AE 等） | 等短期 PoC 指标后再拆 | **不做**移动底盘 / 医疗耳镜 |

### 阻塞（交接时）

- Grok Bot → Cloud Agent：`usage used up`（账号与 On-demand 未对齐）。**这是 2026-09-22 快照**，不宣布今天已解除。当时解法归属用户：当前账号开 On-demand 或固定用已开通的工作账号。

---

## 4. 团队重建（若侧边栏为空）

1. 从模板库 **Import**（若旧账号已 Public 发布）：总管、工程、调研、发布巡检、文档、测试、交互。
2. 建群：
   - **工程协作**：总管、工程、调研、发布巡检、文档、测试
   - **产品体验**：总管、交互、文档、调研、测试
3. 进度优先私聊用户；群只用于需要队友接手的交接（PR 给发布巡检、验收给测试）。
4. 派单要带成功标准；卡配额/登录立刻升级用户，不空转。

角色分工摘要：

- **总管**：编排、live 进度板（不指本快照）、派单、升阻塞
- **工程**：写码 / Cloud Agent / PR；额度尽升级
- **调研**：有依据结论与方案对照
- **发布巡检**：PR/CI/合并状态；CI 红不报可合
- **文档**：成稿；LIMITS/短板与主线同步
- **测试**：用例与通过/未通过；不改产品代码
- **交互**：用户路径、当前天花板、做不到清单（含突破条件）、工程票

---

## 5. 用户口令 `launch`（2026-09-22 原文：立刻执行，勿再确认）

**不要按本节再开 APK / PoC 进仓。** 2026-09-23 这两项已在 main（PR #16、PR #15）。下面两段 prompt 只保留当时派单原文。

用户在快照当天说 `launch` 或「按交接续做」且额度可用时，原文要求**立即**对仓库 `https://github.com/strongerfly/auto_ear_detect` 开 **两个** Cloud Agent（可并行）。禁止共享桌面登 `gh`。

### 5.1 Cloud Agent A — Android Capacitor debug APK

**Title 建议**：`Android Capacitor debug APK`

**Prompt（可原样使用）**：

```
Goal: produce an installable Android debug APK for this Capacitor/Vite/React web app (auto_ear_detect ear-capture), via the existing Capacitor android project under android/ if present, or set Capacitor Android up if missing.

Constraints:
- Do not rewrite the ear-capture product UX; packaging only.
- Prefer cloud/CI artifact: open a PR that adds whatever is needed for a reproducible debug APK build (Gradle assembleDebug or equivalent), and attach or document how to get the APK (CI artifact upload and/or committed build instructions with exact output path).
- If the cloud VM can build APK, run the build and put the .apk under artifacts/ (or CI artifact) and link it from the PR.
- No medical/otoscope scope; Chinese/English i18n already exists — leave alone unless packaging requires a config touch.
- Document blockers/ceiling in the PR if full APK cannot ship this run.

Success criteria:
1) PR opened against the default branch.
2) Either a downloadable debug APK path/artifact OR a green documented build that produces app-debug.apk (or equivalent) with clear install steps.
3) Short note in PR: what was done, risks, how to install.

Investigate the repo yourself; prefer smallest change that yields an installable debug APK.
```

### 5.2 Cloud Agent B — robot-ear-workstation-poc 进仓

**Title 建议**：`robot-ear-workstation-poc into repo`

**Prompt（可原样使用）**：

```
Goal: add the short-term robot ear-capture workstation PoC into this repo and open a PR.

If a tarball/folder is attached under uploads/, extract and place at repo root as robot-ear-workstation-poc/ (README, docs/, sim/, requirements.txt). If no attachment, check whether the folder already exists in the repo or ask via the orchestrator — do not invent a different product; keep SIM + docs style.

Constraints:
- Do not change the phone/web MediaPipe ear-capture app unless a tiny root README link is useful.
- No mobile base / medical otoscope claims; this is a workstation PoC (arm + RGB-D conceptual SIM).
- Keep PR focused: add the folder + brief pointer from main README if appropriate.

Success criteria:
1) PR opened with robot-ear-workstation-poc/ complete.
2) README in that folder explains how to run the SIM and what the PoC is / is not.
3) PR description: summary, how to try, risks/limits.

Prefer smallest clean addition.
```

**附件**：若用户或旧环境仍有 `robot-ear-workstation-poc.tar.gz`，launch 时挂上。旧路径曾为 box：`/workspace/robot-ear-workstation-poc/` 与 `.tar.gz`（约 29KB）。新账号 box **不一定还有该文件**——没有则：向用户要附件，或让工程在本机 `D:\project\cusor\` 下查找/重建最小 SIM 后再进仓。

SIM 曾验证参考（勿当作回归门槛写死）：peak yaw≈55°，combined≈0.877（SIM）。

---

## 6. 工程标准（始终）

1. 能实现先穷尽合理手段；不能则写清：**卡点 / 当前上限 / 短板 / 后续优化 / 所需条件**。
2. 交付可装可跑的最佳结果，同时诚实写上限。
3. 手递不 Stall：下一棒（实现/验证/合并）立刻执行，阶段间不等二次确认。
4. 向用户同时报：进度 + 优点 + 缺点（不放大不遗漏）。

---

## 7. 对本机 Cursor 的备用路径（Grok Bot Cloud Agent 仍不可用时）

**2026-09-22 原文**是让用户在本机 Cursor 打开 `D:\project\cusor\auto_ear_detect`，对 Agent 分别粘贴 **§5.1** 与 **§5.2**。APK 与 PoC 已在 main，不要再粘贴这两段去重做进仓。

---

## 8. 回报用户的格式（每次有进展）

用私聊，短板即可：

```
进度板
- 完成：…
- 进行中：…（PR 链接）
- 阻塞：…（归属：用户/工程/…）
优点：…
缺点/风险：…
下一步：…
```

---

## 9. 禁止清单

- 不要重写拍耳主产品「从零开始」
- 不要在共享桌面输 GitHub 密码
- 不要来回切两个 Cursor 账号干活（选定有 On-demand 的工作账号）
- 不要把短期 PoC 做成医疗耳镜或移动底盘
- 不要在额度失败时死循环重试 Cloud Agent；升级用户一次并继续可做的准备

---

## 10. 用户给你的第一句话（建议）

把本文件全文粘贴后发：

`按交接续做。先对照 GitHub main 与 open PR 报进度板。Android APK（PR #16）与 PoC（PR #15）已在 main，不要再为这两项开进仓 Agent。`

---

（完）新总管读完本文件即可开工；不必等待旧聊天。
