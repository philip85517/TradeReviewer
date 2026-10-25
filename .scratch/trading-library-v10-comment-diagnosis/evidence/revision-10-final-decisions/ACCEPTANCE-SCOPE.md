# 用户决策落地：最终验收范围

触发：用户选择 B 紧凑导航和最差练习回撤，继续修复并要求独立 Agent 验收。影响共享图稿布局及导航原型，适用 frontend-control-audit。静态设计范围，不测试产品交易应用或写数据库。

参考：用户的两个直接回复；REVISION-10-PLAN.md Tasks5/6；DESIGN-COVERAGE.md 本轮映射；navigation-options.html scheme-b 和上一轮 B 的真实浏览器截图。

| 需求/元素 | 检查范围 | 实施者 | 验收证据 |
|---|---|---|---|
| C07 / 模式、标题、条件、列表统计 tabs | 全部 library-owned SVG，1440/1280，模式在标题上方；条件和下划线 tabs 在标题右侧同一行；长标题和日期 | final_design_impl | 首3帧 root 浏览器 gate；最终逐帧独立视觉清单 |
| C08 / 最差练习回撤 | 正文、图稿、原型 label/定义/缺失态；完整权益轨迹、保存日期筛选、跨练习 max、全部有效才数值、部分覆盖说明 | final_design_impl + final_prototype_impl | 独立语义与手算、正文/图稿核对 |
| C09 / 横向分布 | 新B标题区及下游布局，金额/比率/选中/返回 | final_design_impl | 受影响帧视觉核对，原数值和返回契约不变 |
| 原型方案默认值 | 初开为B；A/B/C切换和模式/列表统计继续有效；长条件/空/错误；鼠标/键盘 | final_prototype_impl | 真实浏览器操作与截图 |
| 阅读器消费 | 新文档/图片、BT02完整表格、统计/详情/返回分镜、100%图、评论定位 | root | 最终构建浏览器复验 |
| 保真 | 10原评论、fixture、4home帧/renderer、开篇BT01 | root + reviewer | frozen before 与 final hashes/diff |

版本基线：before/review-package.json；最终版本由本目录 review-package.json 冻结。此前修复的验收证据在 ../revision-10-repair/，仅对没有改变的范围继承。不能用此前候选通过代替 B 传播后的视觉检查。

排除：业务应用、业务数据库、生产权益计算服务；本次仅规格定义，不制造无输入数据。鼠标与键盘独立记录；物理/仿真触控不声明通过。SVG上的业务控件为静态图，只验视觉和设计契约；实际交互仅限阅读器及 disposable 原型。

状态：PASS；最终版本、逐元素覆盖及独立证据见 INDEPENDENT-ACCEPTANCE.md 和 ROOT-ACCEPTANCE.md。37张变动验收图（含额外1280返回图），58文件版本包，原40阅读器引用图不变。
