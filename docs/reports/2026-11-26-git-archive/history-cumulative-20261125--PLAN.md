> 归档说明：以下为原验收时点的文本记录，不是本次重新验收。截图、数据库、日志及私有原件仅本地核查，不随 Git 分发；文中其文件名不是随附证据链接。

# 历史双曲线实施计划

Goal：默认同时观察每期结果与从所选范围开始的累计结果。
Architecture：沿用 FullHistoryPanel 和后端 FullHistory，不增加请求；按同一桶的 net/cumulativeNet 分别生成两条 SVG 路径与共用轴。默认 net 双线，保留累计单线及其它指标。
Spec：README.md、DESIGN-COVERAGE.md、本次用户确认。

## 任务1：最小展示闭环

文件：`app/components/homepage-preview/full-history.tsx`、`app/components/homepage-preview/complete-mock/history.css`（新增样式仅限定真实双线）、`app/components/homepage-preview/full-cutover.test.tsx`。所有文件已有修改，先备份，保留原逻辑。

- [x] 必要的小样本组件测试先红：默认两线和两项读数、累计延续与未知/未来独立缺口，轴覆盖累计极值。
- [x] 实现双线、常驻静态图例、无障碍曲线说明；不增加无需求的筛选/写入功能。
- [x] 原相关测试与新增测试通过，不全仓回归。

## 任务2：独立验收

- [x] 主代理审查变更，核对服务真实累计末值与历史总额（不重新累加显示值）。
- [x] 类型与生产构建；隔离库预览，浏览器17项局部登记实际验证。
- [x] 同态截图和几何核对，更新最终验收记录、报告及规格中这条视觉变化。

Review focus：累计极值不能裁切；无成交累计平延；当期缺失和累计缺失不相互冒充；未来不画点；指标切换与图例不能使下游跳动。复用已有断点和未知值测试。

不提交、不推送、不改后端及业务库；当前linked worktree已隔离。最终证据绑定文件SHA与构建。
