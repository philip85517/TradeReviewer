# 策略台视觉设计方案 V1.0

[打开完整设计文档](visual-spec.html) · [正文源稿](source/visual-design.candidate.md) · [需求与元素覆盖](DESIGN-COVERAGE.md)

本模块V1.0整合历史策略库/实验、完整观察0.7和后续2.x图文设计，采用当前全站V2.5公共控件。编号是新的模块文档版本，不抹去历史版本或扩大历史确认范围。设计新增部分待用户评审；本次未修改生产页面与业务数据库。

正文从背景、目标和取舍开始，先建立研究对象、设计理念、完整流程与布局，再按任务展开分镜、页面和公共组件；精确规则在对应展开区。图为可编辑SVG设计，虚构样本数据；阅读器分镜不是实际回测运行。历史依据保存在source/history/，原件路径和SHA-256见index.json；聊天摘要说明读取范围和限制。所有本版必需内容已落在当前仓库，不依赖另一个工作树继续存在。

## 预览

在仓库根目录执行：

```sh
bash docs/design-system/baselines/2026-10-22-strategy-workbench-v1.0/start-preview.sh
```

打开 http://127.0.0.1:3094/design-system/baselines/2026-10-22-strategy-workbench-v1.0/visual-spec.html 。PORT可覆盖端口；占用时失败，不停止别人的服务。

服务仅提供docs文档与本机评论，不连接业务数据库。评论身份 `STRATEGY-DESK-V10`，正常评论保存于 `docs/design-system/reviews/STRATEGY-DESK-V10.json`；旧文档的评论不迁移、不改写。验证评论使用 `.scratch/strategy-visual-v1/review-qa/` 独立存储。纯文件打开时不能保存评论，需运行上述服务。

## 维护

修改正文和对应画板生成器，再执行统一构建入口（按分工仅生成当前采用的画稿）：

```sh
python3 docs/design-system/baselines/2026-10-22-strategy-workbench-v1.0/build-design.py
python3 docs/design-system/baselines/2026-10-22-strategy-workbench-v1.0/source/verify-document.py
```

[验证与交付范围](acceptance.md) · [独立审查](independent-review.md)。功能/真实图表/持久化/物理触摸的后续验证不由文档验收替代。

## 2026-10-23 全文论述修订

本轮完成导读与14章的逐章扫描、问题总结和全文改写。各章先围绕标题说明目标、选择理由与具体代价，再给图例，最后安排分组规则、参数和引用。原业务约束及21张图稿保持不变。

[逐章问题与改写记录](editorial-audit.md) · [本轮独立审查](editorial-review.md) · [本轮与原版验收](acceptance.md)。

仅修改正文或阅读器时，使用以下命令，避免重新生成已接受图稿：

```sh
python3 docs/design-system/baselines/2026-10-22-strategy-workbench-v1.0/source/test-details-rendering.py
python3 docs/design-system/baselines/2026-10-22-strategy-workbench-v1.0/build-visual-spec.py
python3 docs/design-system/baselines/2026-10-22-strategy-workbench-v1.0/source/verify-document.py
```

## 2026-10-24 全文结构重建

按用户要求从零重写主文，以首页V2.5的认知顺序作结构参照。全文现在分为15个主章和资料附录：背景/目标/取舍 → 设计理念与完整研究流程 → 信息架构/布局/视觉层级 → 查找、组装、实验、创建、观察、回看、结果、比较 → 异常与适配 → 公共组件 → 实现与验收 → 依据。首页专属的导航尺寸和业务模块限制不移植到策略台。

规则和参数收在对应章节，图稿随论点安排；创建章明确三幅分镜覆盖四个步骤。旧74个元素、14个精确规则块和21个SVG保留。[逐章问题与结构设计](editorial-rebuild-audit.md) · [独立复审](editorial-rebuild-review.md) · [本轮接受记录](acceptance.md#2026-10-24-全文结构重建)。本轮只改设计文档及生成页面，生产功能、业务数据库不在范围。

## 2026-10-24 公共风格复审

用户指出侧栏图标及整体公共风格未拉齐；此前编辑/业务表达验收保留，公共风格结论重新审查。后续修复记录于[策略台V1.2](../2026-10-24-strategy-workbench-v1.2/README.md)，本目录保留历史状态。
