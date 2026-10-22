# D01 / D02 / D10 表格与持仓修订覆盖

日期：2026-10-21（Asia/Shanghai）  
执行者：tables（Luna 5.6 MAX，并行子任务）  
集成负责人：root

## 范围与门槛

本次只处理 V2.4.1 当前图稿中的表头可见右缘、当前持仓 C 方案标题右侧并列汇总，以及胜率卡的既定 A／窄 B 组合。正文、共享整页图、历史冻结副本和其他代理文件不直接修改；整页图和样例板使用带锚点校验的共享补丁脚本交给 root 合入。表格行高、八行槽、分页位置、搜索／导出／查看动作、金额字号和已有状态文案保持不变。

规范中的验收条件：

* `visual-design.candidate.md` HP04：标题区 48px、表头 40px、行 48px、分页 48px；C 汇总与标题共上边界；搜索／导出保留独立空间；金额与表头共用可见右边界；半角括号。
* `visual-design.candidate.md` HP11：金额表头单行、单位和字段右缘校准，金额等宽数字，不以缩小字号换取列宽。
* round4 已确认：D01 使用实际字形右缘检查；D10 常规卡 A（321×88）与窄卡 B（278×104），百分比与计数共底线，保留字号。

## 精确引用、视口和状态矩阵

|需求／元素|准确参考|本范围图稿与状态|视口／几何|可观察验收|证据状态|
|---|---|---|---|---|---|
|D01 表头右缘|`docs/design-system/baselines/2026-10-20-homepage-v2.4.1/source/visual-design.candidate.md` §HP11；`source/images/home-1440.svg` 持仓表；`prototypes/round4/index.html` `viewBox=670 638 655 130`|holding C 正常／大额；count 5/10/20；50 条第 1/7 页；local search 第 3 页／单匹配／清空；empty／zero；loading／stale；extreme；detail／after；atom 八态|设计图 1100×各自 viewBox；C 候选 1280×642、1440×642；round4 1280×800、1440×1000 @100%；浏览器实际 viewport `1280×720`，见 `REPORT.md`|成本、最新价、市值、浮盈表头与每列数值的可见字形右边缘重合；表头单行，半角 `(CNY)`|静态 PASS；独立浏览器预览 PASS|
|D02 持仓汇总|HP04 §标题区／方案 C；`holding-option-C-normal-1280.svg`、`holding-option-C-normal-1440.svg`、`holding-option-C-large-*`|holding C 四图；holding-return（进入详情前）、detail、after；count-boundaries（含 9 条末页）；count-scales（5/10/20）；50-items（1/7）；local-search（3／1／clear）；empty（无匹配／零持仓）；loading／stale；extreme；atom normal／zero／loading／permission|C 候选 1280/1440；状态图 1100 宽，detail 单图含前后分镜；atom 2180×2900 双列；浏览器 viewport `1280×720`|标题左侧仍为“当前持仓（最新）”；市值、持仓浮动盈亏在右侧同一标题基线并列；搜索／导出、查看、分页位置不移；空／加载仍保留表结构|静态 PASS；独立浏览器预览 PASS；root 已合入四张 source home|
|D10 胜率|round4 `#d10`；`source/images/visual-samples-board.svg` D16|常规 A：321×88，`60.0%` + `6 / 10 盈利回合`；窄 B：278×104，`100.0%` + `1,000 / 1,000`，说明分两行|round4 1280×800、1440×1000 @100%；样例板 1100×1720；浏览器 viewport `1280×720` 下观察 D16|百分比与计数共享可见底线；窄卡长计数不撞主值；字号与间距不缩小；样例板与 round4 一致|round4 既有证据 PASS；样例板 D16 保留并通过浏览器预览|

明确排除：`holding-option-A-*` 和 `holding-option-B-*` 是历史候选，只读；`source/images/home*.svg`、`source/images/visual-samples-board.svg`、其打包副本以及共享正文不在直接编辑范围；历史冻结目录 `source/historical/**` 不改。

## 变更登记

|文件群|动作|结果|
|---|---|---|
|`source/images/holding-option-C-*.svg`|修正 C 图表头全角括号为半角，保留列锚点、字号、摘要和工具区|已完成；4 图各 4 个 `(CNY)`，无全角括号|
|`source/images/{holding-return*,count-*,50-items*,local-search-pages*,empty*,loading*,extreme.svg,atom-datatable.svg}`|把旧的标题下汇总移到标题右侧并列；必要时统一 `持仓市值`／`持仓浮动盈亏` 标题；不移动表格列或状态说明|已完成；19 状态图 + atom 通过静态 verifier|
|`source/images/home*.svg`|由 `apply_shared_tables.py --apply` 按精确旧锚点迁移；四张 source home 的摘要分别为 545/601/710/790 或 705/761/870/950，距离搜索工具至少 220px|root 已合入；脚本二次运行 `already-current`|
|`source/images/visual-samples-board.svg`|D15 表头改为 `开仓日`、`平仓日`、`合计(CNY)`；可见金额为 `+1.20万 / −600.00 / +7,000.00 / +1.84万`，title 保留完整两位 CNY；D16 仅作保留守卫|root 已合入；脚本二次运行 `already-current`|

## 证据记录

* 浏览器：使用独立新 IAB tab；不接管用户现有 tab 或其他代理 tab。实际 viewport 为 `1280×720`（devicePixelRatio 1），URL 为 `http://127.0.0.1:8765/.scratch/homepage-v241-repair/work/tables/preview/index.html`；在首屏、holding/C、atom、D15/D16 四个下滚位置取了截图并通过 CUA 输出，页面 8 个 SVG 均 `complete=true`、无 console warning/error。子代理 IAB 不提供截图文件写入接口，故截图保留在本轮浏览器证据输出，未伪造本地路径。
* 不能用 XML 坐标、HTTP 成功或链接代替视觉证据。浏览器不可用时逐项标为 `NOT VERIFIED`，并保留可复现的静态检查命令。
* 本任务是文档／图稿修订，数据库和产品写流程不适用；不启动业务服务，不修改数据库。
* 静态复核命令：`python3 .scratch/homepage-v241-repair/work/tables/verify_tables.py`；结果 `PASS all table/holding static checks`。

## 基线哈希（修订前）

以下哈希用于确认引用身份；共享文件可能由 root 或其他任务并行更新，合入脚本会再次校验锚点而不是依赖这些哈希。

* `source/visual-design.candidate.md`: `sha256` 由执行前采集，见 `inventory-before.txt`。
* `prototypes/round4/index.html`: `sha256` 由执行前采集，见 `inventory-before.txt`。
* 允许直接修订的 C／状态图逐文件哈希见 `inventory-before.txt`。

