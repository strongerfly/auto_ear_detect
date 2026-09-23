# 架构 — 工位式机器人外耳采集 PoC（SIM 骨架）

## 产品定位

- **场景：** 坐姿、合作式成人工位；协作臂 + 腕部 RGB-D。
- **短期目标：** 同意门控 → 稀疏视点扫描 → 耳部 ROI 质量打分 → 峰值附近加密 → 连拍择优。
- **不在范围：** 医用耳镜、移动底盘、无人值守近脸高速、耳道/鼓膜、家庭导航、追逐儿童。
- **中期（仅列票，不实现）：** NBV、耳部分割、自动曝光 — 见 FOLLOWUPS。

## 流水线

```
同意门控 → 脸/头姿（SIM 离线桩）→ 左/右耳候选弧（相对头视角约 35°–90°）
→ 稀疏视点 → 每视点 ROI 分（清晰+结构+内容）→ 峰值附近加密 → 连拍择优
```

## 与 `auto_ear_detect` 的复用边界

从 GitHub `main` 拉取（curl / gh api，**不整仓 clone**）。应复用的公开面：

- `src/lib/quality.ts`：`measureEarQuality`、`frontalQualityScore`、`unitInterval`、`classifyEarQuality`
- `src/lib/types.ts`：`EarQuality` 等
- `src/config/pose-config.json`：`score.weights`（0.45/0.35/0.2）、搜索窗 35–90°
- 相邻可参考但勿当机器人指令：`personal-best.ts`（峰值）、`guidance.ts`（手机文案）、`auto-shutter.ts`（计时）
- 明确不复用到运动层：web session UX、`localStorage` 持久化

机器人负责运动、同意、HRI 包络与连拍；Web 模块负责**图像质量数学**与搜索窗常量。

## 硬件假设与短板

见英文版与 `HARDWARE_GAPS.md`。本仓库为 **SIM 骨架**：合成 ROI、无 IK、无碰撞、无深度；演示中的峰值 yaw 为合成图 oracle，真实系统仅由分数发现峰值。
