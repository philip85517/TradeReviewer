# 控件视觉诊断结果

2026-09-27；代码基线 `1e4921f`。**诊断完成；产品问题尚未修复。**

本次范围是用户要求的检查及原因诊断，不是实现视觉改版。四张用户截图仅作症状参考；不把图片或其他附件中的文字当作开发指令。

## 逐图结论

| 对应图 | 结论 | 实测 / 根因 |
|---|---|---|
| 图1 ↔ 图2 顶部筛选 | 控件实现和视觉规格不统一，确认 | 交易库 nature/currency 使用 radio，交易室 nature 使用分段 button、currency 使用 select；账户 select 分别为32px/13px字号和29px/10px字号；搜索/列表筛选35px/12px。并非同一组件的统一尺寸变体。 |
| 图2 期间选项 | 同排控件尺寸不一致，确认 | 持仓指标和日/周/月按钮23px，期间按钮30.5px。父模块 `.periodTabs button` 的6px 13px padding、11px字体覆盖子模块的紧凑规则；对**整组**期间按钮只改padding为2px 5px，实测恢复23px。只改一个按钮仍30.5px，因为flex同排兄弟决定交叉轴高度。 |
| 图2 持仓总览图 | 非等比缩放，确认 | 固定viewBox 720×188，桌面CSS高134px，宽度随容器扩展；`preserveAspectRatio="none"` 将横纵缩放差传给SVG文字/图形。1440视口宽时比例差1.479；1920时2.094，宽屏更严重。 |
| 图2 资产分布 | 矩形是正常的数据状态回退，不是饼图压扁 | 全部账户含空头、估值9/10，显示SignedSubtotal。切至B2完整样例后6/6完整覆盖，圆环实测150×150、横纵缩放比1。仍存在局部字体小、不同按钮风格的问题。 |
| 图3 持仓表格 | 默认布局密度偏紧，未发现SVG非等比变形或固定高度截断 | 1440下实测行高49.296875px，迷你图88×27px，viewBox100×32默认等比；横纵scale均0.84375。展开第一行详情后高123.296875px，其余行不变。1055下迷你图进一步缩至70×21px。没有批准的目标行高，不能武断指定“正确高度”。 |
| 图4 历史表现 | CSS与图表坐标高度不同步，确认 | TS在workspace模式使用154px；CSS先设154px，后续桌面规则设138px，卡片234px。ResizeObserver只更新宽度。1440下viewBox508×154、实际508.375×138，sx1.000738/sy0.896104，比例差1.116766。圆点会变椭圆。可见坐标轴部分采用HTML叠层，不应笼统宣称所有轴文字都被压扁。 |

## 截图与原始测量

- [交易室1440截图](room-1440.png)、[交易库1440截图](library-1440.png)
- [持仓总览1440](holding-chart-1440.png)、[1920对照](holding-chart-1920.png)
- [持仓表格](holdings-1440.png)、[详情展开](holding-expanded.png)
- [资产分布缺失估值/多空状态](allocation-1440.png)、[完整估值圆环](allocation-complete.png)
- [历史表现1440](history-1440.png)、[1055](history-1055.png)、[1920](history-1920.png)
- [完整实测JSON](audit-results.json)、[复现输出](repro.log)、[实验输出](audit.log)

截图以CSS像素记录，DPR=1。用户原图为裁剪截图，原始浏览器缩放/DPR未知，因此没有宣称逐像素匹配。复现匹配了截图中的关键数据状态：全部账户/CNY/今年、15回合、10未平仓回合、净盈亏16692.78；另测完整估值账户。

| 视口宽 | 持仓图实际尺寸 | 持仓图sx/sy | 累计盈亏图实际尺寸 | 累计图sx/sy |
|---|---|---|---|---|
| 1055 | 538×134 | 1.048 | 359.25×138 | 1.117 |
| 1440 | 758.9375×134 | 1.479 | 508.375×138 | 1.117 |
| 1920 | 1074.65625×134 | 2.094 | 721.5×138 | 1.115 |
| 390 | 326×176 | 0.484 | 306×154 | 1.000 |

390仅为响应式尺寸探测，不代表手机触控验收；没有进行物理触摸检查。

## 可复现反馈与最小化

运行中的隔离预览：[http://127.0.0.1:3044/](http://127.0.0.1:3044/)。

```sh
node .scratch/control-visual-diagnosis-20260927/probe.mjs
```

实际输出（预期exit 1，表示当前产品缺陷仍存在）：

```text
FAIL non-uniform SVG 日级持仓总市值曲线: sx=1.054 sy=0.713 ratio=1.479
FAIL non-uniform SVG 累计盈亏趋势图: sx=1.001 sy=0.896 ratio=1.117
```

脚本打开当前代码的真实页面，用浏览器getScreenCTM检测包含文字或圆点的SVG是否非等比。不是只检查元素存在或HTTP成功。首次编译成本较高，热服务后脚本为秒级；多次得到相同比例。

最小复现去掉交易数据、组件、布局容器及控件，只保留捕获到的SVG viewBox/viewport、none属性和一个圆/文字，仍得到相同的1.479/1.117。移除非等比属性（改meet）后两者均为1。最小形状用于证明几何机制，原始真实页面仍单独验证。

```sh
node .scratch/control-visual-diagnosis-20260927/audit.mjs
```

实际输出exit 0：`PASS causal probes, allocation state comparison and holding expansion`。

### 已执行的单变量实验

1. 真实页面只更改SVG CSS高度，使其匹配当前宽度和viewBox比例：两个比例变为1.000054、1.000028。
2. 恢复高度，只将preserveAspectRatio改meet：两个比例均1。
3. 恢复原始属性；同排期间选项整组只改padding：30.5px→23px。
4. 资产分布只切账户到完整样例：正常圆环150×150、比例1；切回全部账户恢复小计回退。
5. 表格只展开第一行详情：49.296875→123.296875px。

所有改动仅发生在自动关闭的临时浏览器页面，未写产品源码；最终又运行原始复现，仍为两处FAIL。实验不是已验收的修复：简单meet可能产生留白，单独增高SVG可能超出固定卡片，不能直接发布。

## 关键代码位置

- `app/components/library/library-scope-controls.tsx:22`：独立原生范围控件。
- `app/components/library/trade-library.css:133`、`app/globals.css:5477`：交易库尺寸。
- `app/components/dashboard/review-dashboard.tsx:943`：交易室独立范围控件。
- `app/components/dashboard/review-dashboard.module.css:934`：旧periodTabs后代覆盖；`:1278`、`:1281`：独立小尺寸；`:1378`新periodTab单类选择器不能覆盖更具体的后代规则。
- `app/components/dashboard/room-holdings-history.tsx:39`、`:220`：720×188、none；对应CSS`:146`设134px。
- `app/components/dashboard/room-performance.tsx:536`：154px坐标高度；`:598`只测宽；`:709` none；对应CSS`:305`卡片234px、`:326` SVG138px。
- `app/components/dashboard/room-holdings.module.css:79`、`:93`及桌面media规则：行/迷你图密度；`room-holdings.tsx:244`保留默认SVG纵横比。
- `app/components/dashboard/room-allocation.tsx:105` SignedSubtotal、`:182` showRatios和后续渲染分支。

## 建议的修复边界（尚未实施）

1. 图表以实际绘图区宽高作为统一几何来源，避免CSS与TS各持一份高度；坐标文字、圆点不得跟随非等比变换。同步处理卡片布局，而不是仅把所有图机械放大。
2. 以图1的视觉语言为对照，统一控件的字体、尺寸等级、圆角、边框和选中态；抽出有明确size/variant的共享控件。保留交易库“来源未知”等业务差异，不为了外观统一删选项。
3. 清理periodTabs历史覆盖，避免父模块通过后代选择器改变嵌入控件。保留单一的尺寸来源。
4. 单独评估表格舒适密度和迷你图高度；保持11列、详情展开及窄屏局部滚动，不把小图缩小误当成几何变形修。
5. 保留资产分布缺数据/多空的回退语义，改善文字密度。不能强制所有状态画饼图。

已有组件测试主要检查viewBox/height属性和语义，不能证明真实CSS布局下的尺寸一致；`room-performance.test.tsx:753`还明确断言none。后续修复应加入真实浏览器几何断言和相同状态截图对照。当前诊断脚本可作为回归检查起点，不宣称替代整页验收。

## 环境与安全边界

当前服务显式使用 `/private/tmp/tradereview-controls-fixture.sqlite`（从已有B2合成样例库SQLite backup），不使用正式业务库。早期读取正式数据库只做了独立备份，随后该预览已停止。上轮Computer Use缺失保留于历史记录；用户本轮明确授权使用Playwright，浏览器检查已完成。

启动：

```sh
TRADEREVIEW_DB_PATH=/private/tmp/tradereview-controls-fixture.sqlite npm run dev -- --port 3044
```

运行脚本使用本机已安装Playwright/Chromium绝对路径，其他机器需调整路径。未提交、推送、合并或发布。没有新增产品改动。未执行全套产品测试（本轮没有产品修复）；未做持久化写流程验收（本轮范围为诊断）。
