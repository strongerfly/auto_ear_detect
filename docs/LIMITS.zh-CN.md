# 上限与卡点 / Limits

On-device **face pose + ear-ROI quality peak search**. Not medical meatus imaging; not the same absolute yaw for everyone. We pick the clearest, highest-structure **stable** frame we can track while the user turns that side toward the camera.

Capture mode: `qualityPeakYaw` (`src/config/pose-config.json`). READY does **not** require yaw ∈ [70, 90]. A personal peak around **~45°** is allowed.

English twin: [LIMITS.md](./LIMITS.md). 交互 P0 与剩余缺口：[interaction-gaps.zh-CN.md](./interaction-gaps.zh-CN.md).

## 一句话边界

用 MediaPipe 头部位姿做方向，用耳区 ROI 的清晰度/结构分做「这只耳朵对这个人够不够正」；在可跟踪的侧转范围内选峰值，而不是卡死 70–90°。

## 上限 vs 明确做不到

**上限 / Ceiling** = 今天这套跟踪 + ROI 分数能做到的最好。可调参，但受模型和成像限制。

**做不到 / Cannot-do** = 产品范围外。即使配置里留着阈值，也不会做成主路径。

| 主题 | 卡点 / Blockers | 当前上限 / Ceiling | 明确做不到 / Cannot-do | 短板 / Shortfalls | 后续 / Next |
|------|-----------------|-------------------|----------------------|-------------------|-------------|
| 位姿来源 | 无专用耳 3D；大 yaw 时 Face Landmarker 跟丢 | FISWG yaw/pitch/roll，搜索 \|yaw\| **35–90°** | 没有稳定侧脸模型就上专用耳 landmark / 3D 耳 | 高 yaw（~90°）跟踪不稳，峰值可能停在窗口内侧 | 耳部分割/检测器；掉跟踪时冻结 last-good |
| 搜索带 | 不能保证医学外耳道轴 | 可配置 35–90，软偏好 40–80；**不拒绝 45°** | 把 READY 卡死在 70–90；问用户「你是不是 45° 那种」 | 窗口外的真峰值采不到 | 按设备 FOV 扩窗；掉跟踪则停搜 |
| 分数（无耳分割） | 头发、背景纹理、运动模糊会出假峰 | Laplacian 0.45 + 边缘 0.35 + 侧脸先验 0.20；外偏好带只 **−0.1** | 把 Laplacian 当各电脑通用绝对值 | 暗斑/头发偶发赢过真耳廓 | 学出来的 quality 头；轻量分割 |
| READY | 不能问用户「耳朵正了没」当主路径 | 进入 bestYaw **±5°** / 离开 **±8°** + 分数 ≥ 峰值 **92%** + 12 帧稳定；无确认 | 主路径等人按「耳朵已经正了」 | 平坦分数曲线会 soft-success | 多帧 burst 选最高分（已开 3 帧） |
| 引导 | 软先验不是某个人 | 未锁定只说怎么转；锁定后才往回；过冲相对 bestYaw + 分数掉 | 没锁定就按万能 60° 喊「再转 / 往回 / 保持」 | 假峰仍可能 | 更强分数；可选弱收窄 |
| 个人峰值 | 旧会话峰值会过期（发型/眼镜） | 转头时自动学习；「重新学习」需确认，然后回到扫转 | 把重新学习写成「校准」 | 未做「下次收窄 ±10°」硬限制（避免漏掉 45°） | 会话内 alwaysRescore；可选弱收窄 |
| 产品目标 | 外耳道成像 ≠ 耳廓正面 | 现在优化 **耳廓（pinna）** 最清晰稳定帧 | 医院耳镜 / 外耳道诊断 | 不是 otoscope | 若要 meatus，需另一套 ROI/模型 |
| 隐私 / 性能 | 云端耳模型不在范围内 | 全在浏览器；WASM Face Landmarker | 把耳部视频传到云端模型 | 主线程检测可能掉帧 | Worker 推理 |

## 试过、只做到一半的

- **固定 70–90° READY：** 已弃用。位姿只做转向提示；READY 看个人 bestYaw。
- **问用户「你是不是 45° 那种」：** 不做。转头过程里自动记峰值。
- **专用耳 landmark / 3D 耳：** 未接。MediaPipe 脸部耳点在侧脸上不可靠，所以用头部位姿 + ROI 质量。触发条件：有稳定侧脸耳分割模型且延迟可接受。
- **扫过窗口 60% 才允许 READY：** 配了 `minSweepCoverageRatio`，**故意不作为硬门**。否则 45° 附近停住的清晰耳会被逼去转满窗。只在文档里当「假峰风险」说明（上限，不是给用户看的规则）。
- **45s 超时失败文案：** 配了 `failure.timeoutMs`，产品上不拿来催。超时只说明「这次没找到」，不是交互主路径。
- **外耳道暗斑惩罚：** 用 ROI 中心亮度做了很弱的启发；没有分割时分不清 meatus 和头发阴影。
- **软先验当转向目标：** 未锁定时已不用。`search.priorYawAbs` 只留作分数/调试先验。

## 不做（Won't do / 明确做不到）

- 固定 70–90 作为 READY 硬门
- 主路径等人按「耳朵已经正了」
- 在没有上表触发条件时上专用耳 landmark / 3D 耳模型
- 未锁定就按万能角度喊「再转 / 往回 / 保持」
- 普通 HUD 显示绝对 yaw / bestYaw（只放调试折页）
- 重新学习不确认，或文案写「校准」

## 当前 READY（实现）

1. 脸在框里、距离还行  
2. 这一侧已经有过 **bestYaw**（搜索窗内质量分最高的 yaw）  
3. 当前 yaw 进入 bestYaw **±5°**，离开要到 **±8°**；pitch/roll 在 ready 限内  
4. 连续约 12 帧角度稳定  
5. 耳区分数 ≥ 该侧峰值的 **92%**，亮度 60–200  
6. 不要求 yaw ∈ [70, 90]；不要求用户确认  
7. 自动快门：第一次默认关；打开后 3 帧按分数选最好，再倒数 `autoshutterMs`，可取消  

引导：一条短提示，中英可切换。峰值锁定前只介绍怎么转。锁定后，过了 bestYaw 且分数掉了才说「往回一点，刚才那边更清楚」；往回走时是保持，不是再转。READY 切换更快，避免提示像清单一样刷。
