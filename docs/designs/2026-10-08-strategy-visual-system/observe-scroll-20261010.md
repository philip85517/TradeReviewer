# 完整预览 · 下滑修复与回归接受

2026-10-10。用户已认可0.7完整观察画面，本次仅修复“无法下滑”。沿用facb任务工作树与远端设计分支基础；没有提交、推送或生产推广。

当前结论：root实际浏览器旅程、CSS范围和新构建PASS；独立源码/直接前后图审查见[报告](../../../.scratch/strategy-visual-system-20261008/reports/observe-scroll-review-20261010.md)。05及04本次滚动重开范围accepted-scoped；整体01与历史未验证项不扩大。

## 原因与改动

固定应用工作区在globals.css中锁定body滚动。完整预览直接渲染自然高度页面，桌面继承overflow:hidden，且没有自己的文档滚动容器。修前1280×720文档高1051px，真实页边滚轮与End均停在scrollY=0；1060px同样失败，1059px及390px原本正常。

仅在full-workbench-preview.css开头增加四行：

```css
body:has(.full-workbench-preview) {
  overflow-y: auto;
}
```

原CSS其余字节完全不变，FullWorkbenchPreview TSX、workbench主题CSS及RunningPrototype与上一冻结版本一致。保留字体、布局、密度、完整金额、图高、日期/组合/图型和图表wheel设置。选择器在离开预览后自动失效，无body生命周期状态。没有SQL写入。

## 新鲜证据与验收

证据根：[observe-scroll-20261010](../../../.scratch/strategy-visual-system-20261008/evidence/observe-scroll-20261010/)。参考为上一Final4与本轮修前截图；同EMA20、2024-09-13、complete、净值图。配对前后图均DPR1，最终正常浏览器为1280×720/DPR2。

|检查|实测与证据|结论|
|---|---|---|
|观察文档滚动|1280×720：0→331；1440×900：0→213；1060/1059×800：0→257；390×844：0→844→1296。各档Home/up回0，End到最大值；green-matrix、1280-keyboard-up及bottom图|PASS，真实页边滚轮及键盘|
|原视觉保持|1280文档1051/main x25.59 y418 w892.81 h613；1440文档1113/main x100 y424 w904 h669；390文档2140/main x10 y937 w370 h480，前后均一致。独立直接看before/after-top及图表、金额、截止|PASS，物理触屏不由此接受|
|菜单内部滚动|1280内部0→53，文档保持0；390内部0→26，文档保持3。Escape关闭并回更多按钮，之后页面可滚动|PASS|
|窄屏菜单末项|初始after-menu-bottom-390在文档3时，菜单底880超过844，原图保留且不能独自证明末项完整。真实页边wheel 0.15后文档129.5，菜单y323.5/h430/bottom753.5，再内部wheel至26；after-menu-visible-bottom-390完整显示末项及¥90,000|PASS；记录截图位置限制|
|事件抽屉|1280内部0→263/最大263，文档331不变；390内部0→130/最大130，文档1296不变。Escape回事件按钮，截止/组合/图型保持|PASS|
|结果与比较|原内部scroll：结果468/最大468，比较577/最大577；页边头部滚轮使文档0→106/最大106，底部全文可见|PASS，两种滚动归属分别检查|
|原版与离开预览|原版文档0→106，日期仍84/9月13、EMA20/净值；离开到原创建，fullpreview不存在、body hidden恢复、文档720等于视口720|PASS；原创建该视口无需内部滚动|
|构建与差异|root新npm run build exit0，PostCSS解析PASS，git diff --check exit0；精确增量及三文件哈希由独立审查核对|PASS（本次CSS范围）|

green-results-wheel.json中pass=false是探针预设“document增加”的断言；该坐标实际命中结果内部容器并到468，文档仍0。原始记录保留，以内部scrollTop和随后页头实际document106分别接受，不能将此探针改写成成功或作为完整滚动失败。

未验证：物理/模拟触摸、Windows滚动条与字体、全量图表wheel/Tooltip未来信息审计、生产SQL链。本次没有改变这些路径，不以滚动修复接受它们。新CSS构建通过；没有重复运行未改TS的全仓检查，上一轮全仓lint/测试FAIL仍是历史已知项。

## 活预览与启动

[打开完整观察](http://127.0.0.1:3069/?prototype=strategy-workbench&view=observe&scene=complete)。root在正常1280×720/DPR2浏览器重新加载稳定页面，实际滚轮至331并返回顶部，保留预览tab；node PID44702仍监听127.0.0.1:3069。截图final-live-top/bottom及final-live-wheel记录本轮交付。

在`/Users/zhoulin/.codex/worktrees/facb/TradeReview`重启：

```sh
TRADEREVIEW_DB_PATH="$PWD/.data/strategy-visual-acceptance.sqlite" \
WRANGLER_LOG_PATH=.wrangler/strategy-visual.log \
PATH="/usr/local/Cellar/node/26.0.0/bin:$PWD/node_modules/.bin:$PATH" \
node scripts/start-local.mjs --dev --port 3069 --hostname 127.0.0.1
```

[范围票](../../../.scratch/strategy-visual-system-20261008/issues/05-complete-preview-scroll.md)、DESIGN-COVERAGE S01–S04、独立报告及新manifest共同记录接受。上一轮manifest/FAIL只保留历史，不改其哈希以冒充当前版本。样板选择后的公共组件/项目规范推广范围继续0.7既定计划，本次不实施扩推。
