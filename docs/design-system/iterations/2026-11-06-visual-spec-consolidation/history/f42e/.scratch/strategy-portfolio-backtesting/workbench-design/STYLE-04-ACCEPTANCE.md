# 工作台 A · 原站风格修复验收

2026-09-30；契约：[STYLE-04-CONTRACT](STYLE-04-CONTRACT.md)。范围为独立原型 ST01–05，不代表任务 11 或生产工作台整体完成。历史第三轮验收与修复前截图保留。

- 样式实现：style_alignment（gpt-5.6-luna）；字体资源/许可证、完整状态及浏览器验收：root；独立视觉：original_style_audit（未实施）。
- 原站基线：creation-baseline-1440.jpg 实际1417×900，历史裁切/缩放未知，只作组件风格依据；同时以当前 app/globals.css 与 scope 控件源码确认主题。不宣称像素等同。
- 修改前、最终桌面截图：1440×900、1280×800 CSS px，DPR1。初次1440读数DPR2已在视口稳定后重拍为DPR1；geometry-before.json 是正式基线。另检验1299/1301×800断点两侧。
- 数据：静态合成行情/持仓，内存刷新重置；数据库/保存链 NOT APPLICABLE；没有访问或修改业务库。
- 最终 index.html SHA256：`15d53141389bb3ec615100083a412f88fbbedddaf18636562d2171c87be8c2a7`。本地字体来源与OFL见 [vendor/fonts/README](vendor/fonts/README.md)；品牌SVG许可见 vendor/lucide.LICENSE。

| 门槛 | 证据 | 结果 |
| --- | --- | --- |
| 主题/品牌/字体/控件 ST01–03 | complete-1440/1280、running-1280、event-1440、config-1440；[独立视觉审查](style-04-evidence/visual-review.md) | PASS |
| 图表主题与真实回放 ST04：功能与状态 | T0→6/17新bar→6/18调仓→播放至8/1→暂停→回看→最新；完成→回看T0→最新；结果/比较→事件→返回 | PASS；root实际操作，参见下表 |
| 布局稳定 ST05：几何 | geometry-before.json/geometry.json；同视口修改前后外框最大变化0px；两档连续帧位移0、溢出0 | PASS；独立视觉另行通过 |
| 异常/压力 ST05：交互 | 失败组保留6/19快照，重试仍失败且不能推进；pressure-1280与boundary-1299/1301 | PASS；独立直接看图通过 |
| 静态差异与语法 | static-verification.json、script-diff.txt；inline JS node --check通过；root核对JS仅chartTheme颜色及图例，未改时间/数据/视野逻辑 | PASS |

## root 实际浏览器证据

截图均位于 [style-04-evidence](style-04-evidence/)。这轮只进行换肤相关回归；第三轮完整长回放及手工缩放验收保留，没有把那轮证据冒充本轮重跑。

| 路径 | 可观察证据 |
| --- | --- |
| 1280 T0→单步6/17→6/18首次调仓 | t0-1280、first-step-1280、first-trade-1280：末端真实新K与金色调仓标记可见，价格读数/日期更新，现金和持仓响应 |
| 播放→暂停8/1→回看上一日→回到最新 | running-1280、played-paused-1280：播放变暂停；真实行情向前推进，暂停后日期8/1；回看/最新不改变已运行边界 |
| 1280阶段结果→对比→6/18事件→返回对比→观察 | result-1280、compare-1280、event-1280：比较共同截止6/19；事件投影整个工作区，返回后恢复对比，再回观察恢复8/1 K线 |
| 1440完成→回看T0→最新→结果→对比→事件→返回 | review-t0-1440、result-1440、compare-1440、event-1440：T0后行情消失、查看日6/14但运行2/6；最新恢复；蓝/金两线与图例一致，事件来源返回不扩展未来 |
| 查看配置→Escape | config-1440；另在1280实测键盘关闭，焦点恢复“查看配置”，运行日期与图表不变 |
| 失败→重试 | failure-1280：组合B最后完整日6/19，红色原因与可读动作；重试提示缺数据，推进维持禁用 |
| 长名/大金额和1300断点 | pressure-1280、boundary-1299、boundary-1301；长名按既有规则省略，金额与全部回放动作可见，未缩小字号或命中区 |

连续只读DOM采样分别为1280档 4466 帧、1440档 2112 帧，均 maxShift=0、violations=0、maxOverflow=0；见 layout-audit-1280/1440.json。采样覆盖观察、结果、对比、事件与配置切换；主动resize另外记录，未混入同视口位移。

鼠标/浏览器控件旅程与键盘Escape证据分开；物理触屏、首次用户研究、IME 本轮 NOT VERIFIED，未纳入风格修复。09共享导航、生产回测、持久化继续由后续任务负责。

## 独立视觉与最终结论

original_style_audit 直接对照原站、修复前与最终截图，ST01–05 均 PASS，见 [独立视觉审查](style-04-evidence/visual-review.md)。root 独立核对真实操作、渲染截图、源码差异与边界后接受本轮桌面风格修复。任务11恢复 open / integration-pending；不据此关闭09共享导航及生产实现。

审查中的P2证据备注是部分验收截图底部的采样JSON：仅在显式 `audit=1` 时生成。root 已在正常交付URL实际加载并确认 `layoutAuditReport` 不存在，见 delivery-default.png；不是交付页面遗留问题。历史验收截图不擦除。

## 预览与启动

[A 工作台预览](http://127.0.0.1:3051/?variant=A&scenario=complete)，[从待开始体验](http://127.0.0.1:3051/?variant=A&scenario=T0)。从仓库根目录执行：

```sh
python3 -m http.server 3051 --bind 127.0.0.1 --directory .scratch/strategy-portfolio-backtesting/workbench-design
```

交付前已在真实浏览器打开正常 complete URL并切至标的K线：默认1280×800、无页面溢出、无调试采样文字；截图 delivery-default.png。3051服务HTTP200且PID93561仍监听127.0.0.1，预览保持运行。没有提交、推送、发布或修改业务数据库。
