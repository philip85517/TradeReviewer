# V2.4.1 文档整合验收

日期：2026-10-22（10月21日开始）。协调与独立验收：root；修订：三位 Luna 5.6 MAX，分别负责表格与持仓、历史与贡献、交易库与共享组件。

范围是现有十一章累计文档、组件手册、当前关联图稿和评论阅读器。没有开发产品业务功能。批准依据为第四/五轮原型、持仓 C 方案及本轮任务 DESIGN-COVERAGE；保留当前表现→持仓→历史→底部单一贡献区。历史候选 A/B 和冻结档案不改写，O02保留24px待定。

## 证据与边界

|范围|验收方法及结果|
|---|---|
|23张持仓/表格图|shared 独立 Chrome 渲染逐图检查 PASS；root 实际浏览器复查正常、极值、详情fixture、清空页脚。见 independent-shared/REPORT.md。|
|19张历史/贡献图（含一张home交叉检查）|shared 独立 Chrome 渲染检查当前静态状态 PASS；年度图当前是加载态，不冒充年度数据成功态。|
|51张共享及交易库图|tables 独立静态检查，39张本轮Chrome headless、12张已有Chrome证据副本；没有将静态输出当成交互验收。见 independent-tables/REPORT.md。|
|4张整页|独立完整SVG栅格比较；root实际浏览器抽查当前1440与历史1280、年度D10和局部区域，原尺寸超宽时保留横向滚动。最终图例复验记录以 independent-tables 为准。|
|既有8张曲线/期间图|独立按原viewBox栅格检查；最终补查问题及修正记录见 independent-tables/chart-fixes-final-review.md。root复验受影响图稿。|
|共享样例板和手册|图稿/手册语义与原型对应，正文说明与产品控件区分；root板图浏览器复验、shared手册Chrome复验；白条FAIL修复后shared同视口Chrome复验PASS。|
|原型贡献旅程|root实际浏览器：全部→A股→标的→详情连接占位→返回；历史禁用未平仓→当前恢复；8行分页。PASS限定原型，详情为连接占位。|
|评论与文件|32条原评论及原状态完整保留；原文件hash未变，映射刷新。包验证108处图像、25页、errors=[]；真实浏览器评论服务连接可用。|
|产品与数据库|不适用：本轮未实现产品。真实持久化、产品交互、物理触屏未验证，不据静态PASS推断通过。|

106个唯一正文SVG的最终hash见 board-hashes.json；历史候选8张明确排除新基线修订。图稿数量存在交叉引用，不能简单相加。其余既有图稿补充检查在独立报告中记录。

## 回归与追溯

R01–R08失败与复验均保留在 findings.md，未删除旧失败截图。最终整页截图见 evidence/home-history-final.png、home-current-final.png，年度卡见 annual-d10-final.png；阅读器见 reader-final.png，评论连接见 comments-connected.png。原始评论及冻结档案检查见 preservation-check.json。运行服务保持127.0.0.1:3088。

最终覆盖：98张当前图稿静态视觉复核通过；8张历史候选保留原样，不纳入新基线。最后8张曲线/期间图由非修改者逐图栅格复核；root在真实浏览器复验金额刻度、缺失断线和自然期间图。完整覆盖与当前文件SHA-256见 coverage-final.json。文档整合验收通过，交付用户review。

静态图中的hover、键盘和日期按钮是设计状态说明，本轮不宣称它们具有产品运行时功能；实际原型旅程的已测范围见上表。O02紧凑徽章仍维持24px，不将未确认选项设为默认。

## 启动

```sh
PORT=3088 /Users/zhoulin/.codex/worktrees/12f2/TradeReview/docs/design-system/baselines/2026-10-20-homepage-v2.4.1/start-preview.sh
```

预览：http://127.0.0.1:3088/visual-spec.html。本轮没有提交或推送。
