# 控件与图表视觉修复

State: closed
Status: accepted
协调者：root。用户已明确确认：实施 gpt-6-luna / max（charts、controls）；独立验收 gpt-6-astra / low。

范围：用户明确要求修复上一轮 DIAGNOSIS.md 中的控件一致性、期间控件覆盖、持仓图和历史表现图形变形及持仓阅读密度。保留原金融口径、筛选语义及部分估值/多空回退。

本轮用户明确覆盖默认隔离数据库要求：网页实现、调试验收连接 conf/runtime.json 指向的真实部署数据库 `/Users/zhoulin/projects/交易空间/database/TradingReview/tradereview.sqlite`。不新建或改用测试数据库，不注入合成成交、行情或mock响应。真实数据缺失时验证真实空/不可用状态；有数据的图表通过真实范围选取取得，不造数据。

当前工作树：c414，分支codex/control-visual-fix-20260927。开发端口3044（代码预览，不替换部署目录），数据库与正式3022共享同一文件。原3044合成数据库进程已停止。无业务写入功能变更，不进行导入、删除、复盘保存或账户编辑。运行前后记录原始成交/证券/导入批次数量与摘要。

## 任务

1. [可读且不变形的真实图表](issues/01-chart-geometry.md)
2. [统一控件与持仓密度](issues/02-controls-density.md)
3. [独立真实页面与视觉验收](issues/03-acceptance.md)

## 交付门槛

- root先验证01的最小真实页面图表旅程，再扩大对图表布局的整页视觉验收。
- 所有修复由用户确认的实施模型承担；root负责跨文件体验、数据流和验收，不代替实施代理写产品代码。
- 独立审查者直接浏览真实页面并查看参考截图/最终截图；root另外复核。
- 真实页面行为、状态安全、视觉对照分别通过；失败保持open。
- 不推送、合并、发布。预览保持运行，最终提供链接、启动指令和检查结果。

## 集成过程证据

- 第一阶段root真实图表旅程通过：真实全部历史2015–2026、选中2026年8月盈亏点并显示详情、1920→1440 resize，两个主SVG均ratio=1、无pageerror；见evidence/minimal-journey.json及minimal-history.png。允许继续整页集成验收，非最终放行。
- 第一轮整页结果保留于evidence/accept-real-first.json/log：桌面图表几何及账户/币种/指标/详情/搜索/分页/导航/刷新通过；资产默认解释撑高31175px（待02修复），821/820/390出现页面水平溢出（定位中）。当前整体仍未通过。
- 独立图表审查发现C03-R1（resize后派生plot缓存旧geometry）和C06-R2（密集r22命中圆抢走首点鼠标事件），功能/视觉FAIL并已交charts返修。保留independent-acceptance.md第一轮及independent-chart-*截图；先前ratio=1只证明外框几何，不能替代曲线坐标与实际选点证明。

## 最终接受

root已结合独立实际浏览器与直接看图复核接受本轮UI修复。详见[最终验收](FINAL-ACCEPTANCE.md)和[独立验收第三轮](independent-acceptance.md)。164项相关测试、typecheck、build、16项root真实旅程均PASS；六视口、鼠标/键盘/模拟触控证据完整。真实完整圆环和物理触摸仍NOT VERIFIED。预览保持运行：http://127.0.0.1:3044/ 。前述FAIL历史不删除，以最终复核为现状。
