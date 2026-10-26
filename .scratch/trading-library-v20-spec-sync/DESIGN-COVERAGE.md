# 设计契约与覆盖

逻辑权威：docs/design-system/trading-library-design-spec.md。视觉参考：docs/design-system/baselines/2026-10-24-trading-library-v1.1/source/visual-design.candidate.md。原版本哈希见 baseline-hashes.json。

|需求/原文定位|elementID/章节|准确参考|旅程/反例|owner|证据|状态|
|---|---|---|---|---|---|---|
|更名与权威引用|DOC / HOME-TLIB-REFERENCES|逻辑规范全部；视觉行1–15|新旧入口均到同一规范|root|root-verification.json；package-check.json；真实浏览器双向链接|PASS|
|练习/账户/回合定义|BT01/02/03/04/08|视觉行17–155；hcr06-final-rounds-a.svg|文件完整≠清仓；一次主动卖出多配对仍一实盘回合|两独立 Luna 扫描；v20_revision Luna|reviews/luna-a-v20-final.md；reviews/luna-b-v20-final.md；reviews/luna-b-v20-final-addendum.md|PASS|
|名称/三种日期/导入完整|BT03/04/06|视觉行91–155、222–274；hcr06-final-sim-ab.svg|导入前日期有效，不能用历史日或导入日|v20_revision Luna；两名独立复核|reviews/luna-a-v20-final.md；reviews/luna-b-v20-final.md；reviews/luna-b-v20-final-addendum.md|PASS|
|去重/更新/人工保护|BT04/07/09|视觉第四、七、九章；逻辑去重/人工保护各节|同内容无新增；变化先选择；人工工作保留|v20_revision Luna；两名独立复核|reviews/luna-a-v20-final.md；reviews/luna-b-v20-final.md；reviews/luna-b-v20-final-addendum.md|PASS|
|模拟统计/收益/分母/本金/回撤|BT05/07|视觉行157–220；02-simulation-normal.svg、journeys-trend-*.svg|金额可算百分比不可算；残仓估值缺失≠0|v20_revision Luna；两名独立复核|reviews/luna-a-v20-final.md；reviews/luna-b-v20-final.md；reviews/luna-b-v20-final-addendum.md|PASS|
|详情/返回/状态|BT06/09/10|视觉第六至十章；journeys-rounds-a-return.svg|练习详情内部统计不污染汇总；未决行为识别不冒认完成|v20_revision Luna；两名独立复核|reviews/luna-a-v20-final.md；reviews/luna-b-v20-final.md；reviews/luna-b-v20-final-addendum.md|PASS|
|保留 E 布局、视觉公共约束|BT02|approved-e-{live,sim}-{list,stats}-1440.jpg；navigation-e-prototype.html|64/72/58px、信息浮层、绿盈红亏、模拟柔和表面|v20_revision Luna；root 集成|reviews/luna-a-v20-visual-addendum.md：9 张最终渲染图与 4 张 E 参考图直接比较|PASS|
|版本、资源、冻结历史|全篇|V1.1 全目录 baseline-hashes.json|V2.0独立身份；无旧版逻辑图冒充当前规则|root|root-verification.json；package-check.json；89 个 V1.1 文件与原评论哈希|PASS|

无产品控件 elementID 变更；以上是文档章节及原有稳定 block/image ID。浏览器操作仅检查生成阅读器，不执行交易写入；数据库与产品交互验收不适用。

## 当前验收快照

V2.0 正文指纹：`dd25c5dab416ff1c24b1abd02fdd8212b79ae90eb5456846a7c3e59f751aca43`。root 已完成全文核对、41 SVG 重建、8 项统计测试与 5 项模板测试、独立 oracle 运行、130 个阅读引用和 28 个索引链接检查。两名独立 Luna 已完成语义、数字与渲染视觉复核；生成器精确反例补验由 root 重跑通过。全部适用项 PASS，最终结论见 [验收记录](FINAL-ACCEPTANCE.md)。

### 阅读器实际操作覆盖（2026-10-26）

|入口/控件|动作与旅程|状态|证据|
|---|---|---|---|
|V2.0 阅读页|重新加载并核对标题和版本|PASS|root-evidence/v20-final-reader.png|
|章节目录|点击“模拟盘普通统计”跳至对应章节|PASS|root-evidence/v20-final-reader.png|
|原尺寸图稿链接|打开模拟统计原尺寸图稿；关闭回到阅读器|PASS|root-evidence/v20-final-figure.png|
|权威规范链接|从 V2 打开《交易库设计规范》，再由该规范返回 V2|PASS|root-evidence/design-spec-final.png|
|历史评论|仅校验文件未改变；不新增、提交或迁移评论|PASS（保存性）|package-check.json|
|产品交易控件、行情回放、持久化、触屏|本次只更新文档，没有交付产品实现|NOT APPLICABLE|acceptance-plan.md|

触发：用户要求更新视觉设计文档；范围为阅读器新增内容及静态设计资产。沿用阅读器本身的未改动评论写入、播放引擎等控件不做产品功能验收。视觉比对独立由 Luna A 直接看渲染与批准参考，不能用上述链接/构建检查代替。
