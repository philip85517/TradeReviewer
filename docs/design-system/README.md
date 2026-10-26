# 视觉与交互设计文档

|文档|版本与用途|备注|
|---|---|---|
|[交易库设计规范](trading-library-design-spec.html) · [源文档](trading-library-design-spec.md)|**当前业务逻辑规范**|统一领域词汇、练习与回合、导入保护、日期及统计口径|
|[全站公共规范与首页完整设计](baselines/2026-10-22-homepage-v2.5/visual-spec.html)|**V2.5 · 当前规范**|全站原则、视觉基础和共享控件统一来源；首页保留完整布局及交易库入口|
|[交易库视觉设计规范](baselines/2026-10-26-trading-library-v2.0/visual-spec.html)|**V2.0 · 当前交易库视觉规范**|依据《交易库设计规范》校正练习、复盘回合、日期、导入保护及统计图例；保留 E 布局|
|[交易库 V1.1](baselines/2026-10-24-trading-library-v1.1/visual-spec.html)|历史冻结版本|保留 E 定型过程与原评论；逻辑修订见 V2.0|
|[交易库 V1.0](baselines/2026-10-22-trading-library-v1.0/visual-spec.html)|历史工作版本|保留原评论和布局探索；现行交易库规范见 V2.0|
|[拆分前完整快照](baselines/2026-10-22-homepage-v2.4.2/visual-spec.html)|V2.4.2 · 冻结基线|保存拆分前累计内容、图稿和43条评论；不作为后续新增修订入口|
|[版本拆分与验收记录](iterations/2026-10-22-design-doc-split/README.md)|本次追溯入口|版本职责、评论归属、完整性检查和启动说明|
|[原首页 V2.4.1](baselines/2026-10-20-homepage-v2.4.1/visual-spec.html)|历史工作版本|原目录保留，不覆盖历史内容|
|[迭代档案索引](iterations/README.md)|历次诊断、方案选择与修复|历史待确认按记录日期理解，以当前规范与用户确认结果为准|

预览启动：在仓库根目录运行 `./docs/design-system/start-design-preview.sh`。默认端口 3090，当前规范使用各自独立的评论身份；历史版本与评论继续保留。

修改《交易库设计规范》源文档后，运行 `python3 docs/design-system/build-trading-library-spec.py` 同步其阅读页。确认来源保留在仓库，源文档继续提供原始引用。
