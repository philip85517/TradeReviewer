# V1.2 验收记录

2026-10-24，协调者root接受本轮**设计文档与静态图稿交付**。全部22张策略图稿和8张公共样例已独立比图；保留初审、复验失败与最终修复证据。本结论不扩大为正式策略台产品实现验收。

## 触发、范围与版本

用户指出整体风格、侧栏图标未与公共库对齐，要求多Agent全面review、公共组件补规范、分任务修复形成V1.2。范围覆盖全文ST01–ST16、原74个业务元素、22张策略画板、SW01–SW08及受影响阅读器入口。以首页V2.5公共规范和策略批准尺寸共同判定；逐项引用与责任见DESIGN-COVERAGE.md。

HEAD为5a94ee3ff76e32993fe2c4791a83b40e877a7344，本次未提交/推送。工作内容以[evidence/final-manifest.json](evidence/final-manifest.json)中的SHA-256绑定，源码未提交不等于按HEAD旧内容验收。

## 门禁与直接证据

| 门禁 | 结论 | 证据与边界 |
| --- | --- | --- |
| 全文结构与规范引用 | PASS | ST01–ST16按背景/目标/取舍、理念、布局、任务流程、组件、验收、来源组织；14个精确规则折叠区；公共样例逐章引用 |
| 公共视觉与静态状态 | PASS | 30/30图独立直接查看；三份最终报告见independent-review.md，所有初审及复验问题关闭 |
| 导航一致性 | PASS | 首页同源五项SVG图标、策略选中态、54/200展开折叠样例；保留48顶栏契约 |
| 创建与回放分镜 | PASS（图示） | 创建四帧独立、预览不提交；T0/首次成交/回看三帧；日期、未来可见范围及同日数据跨图一致 |
| 阅读器目录与规则折叠 | PASS | 63个目录链接实际点击；14个折叠区鼠标展开、键盘Enter收起，见reader-controls.json |
| 阅读器分镜控制 | PASS | 两组7帧的前后/重播/边界禁用/播放暂停；两组自动播放均实际到末帧；仅文档分镜 |
| 阅读器原尺寸看图 | PASS | 16处常规图引用及7帧入口逐项打开/关闭，另验证Esc关闭；共23处引用 |
| 公共手册引用 | PASS | 从正文进入手册、8锚点存在、8样例加载；manual桌面截图留存 |
| 静态构建与引用 | PASS | verify-document.py、test-details-rendering.py；22 SVG合法、正文与清单一致；example-data.json与原版字节相同 |
| 正式策略控件、真实回放、保存返回重载 | NOT APPLICABLE | 本轮只改设计文档、SVG及阅读器资源；尚未实现/验证产品数据链路，不把静态按钮当成功能 |
| 业务数据库与数据迁移 | NOT APPLICABLE | 静态文档服务未连接业务库，没有业务写入 |
| 触摸、触控命中、产品键盘行为 | NOT VERIFIED | 图稿只定义契约；没有物理设备或真实产品控件测试，不影响本次静态范围接受 |
| 评论写入/审核后台 | EXCLUDED | 沿用文档基础设施，本轮未改评论行为、不写评论；不将其计入覆盖通过率 |

## 复核与保留记录

三位独立审查者分别负责10图；协调者再次核对集成后的引用、数据一致性、真实阅读器控制和构建结果。初审问题及修复中新增问题见issues.md；不能用局部PASS抵消其他范围FAIL。最后一次修复关闭日期映射、同日持仓和时间样例语境后，才接受整包。

前轮FAIL与旧V1.0的回归重开记录保留。后续若修改任一图稿、业务状态或公共规则，必须按最终清单重新验证受影响范围。

## 预览与重建

[当前V1.2预览](http://127.0.0.1:3094/design-system/baselines/2026-10-24-strategy-workbench-v1.2/visual-spec.html)。3094文档服务保持运行。

```sh
bash docs/design-system/baselines/2026-10-24-strategy-workbench-v1.2/start-preview.sh
python3 docs/design-system/baselines/2026-10-24-strategy-workbench-v1.2/build-design.py
python3 docs/design-system/baselines/2026-10-24-strategy-workbench-v1.2/source/verify-document.py
```
