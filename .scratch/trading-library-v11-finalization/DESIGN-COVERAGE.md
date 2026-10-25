# DESIGN-COVERAGE — V1.1

权威参考：`docs/design-system/baselines/2026-10-22-trading-library-v1.0/navigation-e-prototype.html`，SHA256 `3b1068e9d156aa27af5a00cbaf676451dc492c38c0f47426b57a6cd3037c6025`。对照截图：`.scratch/trading-library-v10-comment-diagnosis/e-refinement/screenshots/{live,sim}-{list,stats}-verified-{1440,1280}.png`。全站规范：`docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md`、`source/images/home-1440.svg`。

批准参考截图为 1440×1000、1280×800；生成分镜比较其 1440/1280px 自然画布，正文阅读器与原型分开验。最终阅读器与新图稿标签实际 DOM viewport 为 1280×720；viewport 覆盖未改变此值，全页截图只证明静态画布视觉，不宣称产品响应式已通过。整页视觉/集成与数据规则负责人 root；文档 owner v11_prose；图稿 owner v11_frames；独立视觉 reviewer v11_acceptance。新增生成图保持 E 公共框架，但完整业务筛选、下钻、错误状态允许比固定原型更丰富，须明示其依据为原正式规则。生产实现和移动端新设计排除。

|ID|需求/准确参考|Owner|用户旅程与验收证据|
|---|---|---|---|
|E01|已批准 E 原型整体，取代 BT02 B 描述|prose/frames|V1.1 浏览器打开四种主状态；与原型截图比较|
|E02|原型 header：取消来源、返回首页、重复标题/路径；保留标题交易库|prose/frames|检查正式正文和全部生成框架，无旧顶栏按钮；详情逐层返回保留|
|E03|原型 help-btn/help-pop：说明归位指标信息入口|prose/frames|费用/趋势/分布/回撤信息入口及悬浮规范，不保留底部说明墙|
|E04|原型 sidebar，全站 V2.5 左侧导航72px、五项、无徽章/账户底栏|frames|同视口截图位置/密度/颜色对照|
|E05|原型 subnav：无可见“视角”标签，实盘/模拟盘与列表/统计同一58px栏|prose/frames|四种状态导航几何固定|
|E06|原型模拟盘 main/subnav #111E2C、卡片 #162332、边框 #40566D|prose/frames|实盘/模拟盘切换视觉对照；按钮保留蓝色、无紫色|
|E07|全站盈利 #53D7A0，亏损 #FF8592；中性指标中性色|prose/frames|统计和表格符号与色彩核对|
|V11-01|新版本/独立评论身份/旧版保留|root|manifest V1.1、TRADING-LIBRARY-V11、API只读与静态资源验证|
|V11-02|BT03–09 原业务范围及最差练习回撤决定|prose/root|全文差异复核，刷新URL恢复与原型重置区别；领域回归测试|
|V11-03|静态阅读器目录、图像、预览链接|root|浏览器目录定位、图像加载与新入口，截图证据|

前端审计触发：设计阅读器新增版本与图稿更新；原型无改动，仅路径复制。控件检查限阅读器入口/章节/图稿、复制原型模式与标签切换，不宣称产品全控件验收。独立截图比较由未实现图稿的 reviewer 完成。数据库写入不适用。
