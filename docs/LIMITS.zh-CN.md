# 上限与卡点 / Limits

On-device **face pose + ear-ROI quality peak search**. Not medical meatus imaging; not the same absolute yaw for everyone. We pick the clearest, highest-structure **stable** frame we can track while the user turns that side toward the camera.

Capture mode: `qualityPeakYaw` (`src/config/pose-config.json`). READY does **not** require yaw ∈ [70, 90]. A personal peak around **~45°** is allowed.

English twin: [LIMITS.md](./LIMITS.md).

## 一句话边界

用 MediaPipe 头部位姿做方向，用耳区 ROI 的清晰度/结构分做「这只耳朵对这个人够不够正」；在可跟踪的侧转范围内选峰值，而不是卡死 70–90°。

## 表

| 主题 | 卡点 / Blockers | 当前上限 / Ceiling | 短板 / Shortfalls | 后续优化 / Next | 优化条件 / Conditions |
|------|-----------------|-------------------|-------------------|----------------|----------------------|
| 位姿来源 | 无专用耳 3D；大 yaw 时 Face Landmarker 跟丢 | FISWG yaw/pitch/roll，搜索 \|yaw\| **35–90°** | 高 yaw（~90°）跟踪不稳，峰值可能停在窗口内侧 | 耳部分割/检测器；掉跟踪时冻结 last-good | 侧脸标注集；可接受的 on-device 延迟 |
| 搜索带 | 不能保证医学外耳道轴 | 可配置 35–90，软偏好 40–80；**不拒绝 45°** | 窗口外的真峰值采不到 | 按设备 FOV 扩窗；掉跟踪则停搜 | 笔记本/手机 FOV 标定 |
| 分数（无耳分割） | 头发、背景纹理、运动模糊会出假峰 | Laplacian 0.45 + 边缘 0.35 + 侧脸先验 0.20；外偏好带只 **−0.1** | 暗斑/头发偶发赢过真耳廓 | 学出来的 quality 头；轻量分割 | 按角度标注的耳 ROI |
| READY | 不能问用户「耳朵正了没」当主路径 | 近 bestYaw **±5°** + 分数 ≥ 峰值 **92%** + 12 帧稳定；无确认按钮 | 平坦分数曲线会 soft-success | 多帧 burst 选最高分（已开 3 帧） | 设备端模糊阈值标定 |
| 个人峰值 | 旧会话峰值会过期（发型/眼镜） | 转头时自动学习；「重新学习」可清 | 未做「下次收窄 ±10°」硬限制（避免漏掉 45°） | 会话内 alwaysRescore；可选弱收窄 | 长期同一设备同一人 |
| Laplacian | 与摄像头、压缩、曝光绑定 | 原始阈值 min 80 / good 120，按设备会偏 | 各电脑不能共用绝对清晰度 | 开机 1 次模糊标定 | 平面/手掌标定图 |
| 产品目标 | 外耳道成像 ≠ 耳廓正面 | 现在优化 **耳廓（pinna）** 最清晰稳定帧 | 不是 otoscope | 若要 meatus，需另一套 ROI/模型 | 临床定义与知情同意 |
| 隐私 / 性能 | 云端耳模型不在范围内 | 全在浏览器；WASM Face Landmarker | 主线程检测可能掉帧 | Worker 推理 | 机型白名单与预算 ms |

## 试过、只做到一半的

- **固定 70–90° READY：** 已弃用。位姿只做转向提示；READY 看个人 bestYaw。
- **问用户「你是不是 45° 那种」：** 不做。转头过程里自动记峰值。
- **专用耳 landmark / 3D 耳：** 未接。MediaPipe 脸部耳点在侧脸上不可靠，所以用头部位姿 + ROI 质量。触发条件：有稳定侧脸耳分割模型且延迟可接受。
- **扫过窗口 60% 才允许 READY：** 配了 `minSweepCoverageRatio`，**故意不作为硬门**。否则 45° 附近停住的清晰耳会被逼去转满窗。只在文档里当「假峰风险」说明。
- **45s 超时失败文案：** `FAIL_TIMEOUT` 只在**一直没学到峰值且几乎停住**时出现，可再转头继续；有 45° 峰值时仍可 READY，不当主路径催促。
- **外耳道暗斑惩罚：** 用 ROI 中心亮度做了很弱的启发；没有分割时分不清 meatus 和头发阴影。

## 不做（Won't do）

- 固定 70–90 作为 READY 硬门
- 主路径等人按「耳朵已经正了」
- 在没有上表触发条件时上专用耳 landmark / 3D 耳模型

## 当前 READY（实现）

1. 脸在框里、距离还行  
2. 这一侧已经有过 **bestYaw**（搜索窗内质量分最高的 yaw）  
3. 当前 yaw 在 bestYaw **±5°**，pitch/roll 在 ready 限内  
4. 连续约 12 帧角度稳定  
5. 耳区分数 ≥ 该侧峰值的 **92%**，亮度 60–200  
6. 不要求 yaw ∈ [70, 90]；不要求用户确认  

引导：一条短中文。远了只说转向（慢慢找最清楚的角度 / 再转一点点 / 往回一点），靠近了才提头发、光线、摆头。READY 切换更快，避免提示像清单一样刷。
