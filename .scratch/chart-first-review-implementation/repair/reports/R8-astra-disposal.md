# R8 图表销毁独立审查

2026-09-27，`gpt-6-astra / low`。只读产品/安装的SDK实现，不运行测试、浏览器或改产品。root真实浏览器切回合并resize报 `Object is disposed`，SDK RAF栈到resizeCanvasElement。**整体仍未接受；R7已核对视觉局部结果保留，不由此次回归抹除。**

## 冻结前实际调用链

读取 `app/components/chart/replay-chart.tsx` createChart effect、cleanup、range通知及observer；读取安装的 `node_modules/lightweight-charts/dist/lightweight-charts.development.mjs` 和 `node_modules/fancy-canvas/canvas-element-bitmap-size.js`，不用推测其他SDK版本。

1. 当前cleanup约1197先 `chartRef.current?.remove()`，随后1199在保留series对象上 `detachPrimitive`。
2. 实际SDK `SeriesApi.detachPrimitive`（development.mjs:12802）移除primitive并调用它的detached，随后**无条件**`series.model().fullUpdate()`。因此不依赖我们自己的primitive.detached是否requestUpdate：SDK封装本身会排更新。
3. `ChartApi.remove`（13082）destroy timeScale/widget、清series maps/delegates/dataLayer；`ChartWidget.destroy`（10674）仅取消当时已存在的RAF，然后销毁pane/time-axis绑定。
4. SDK invalidateHandler（11114）没有disposed guard；若没有drawPlanned，会调用requestAnimationFrame。于是remove之后detach产生的fullUpdate可以在销毁之后排新RAF，旧的cancel不能取消“之后才排入”的任务。
5. Fancy canvas `dispose`将_canvasElement置null（约29–38）；canvasElement getter对null抛 `Object is disposed`（约41–44）；`resizeCanvasElement`（71）读取该getter再改style。此链与root真实错误栈吻合，构成确定的错误cleanup调用顺序，而非单纯怀疑浏览器缓存。

## 另两个旧实例入口

- createChart effect中的ResizeObserver闭包（1148）读取timeScale并applyOptions，但不检查已置true的effect-local `disposed`。disconnect阻止后续观察，不应被当成所有已排回调的生命周期屏障。
- visible logical range通知中的queueMicrotask（1128）只比较pending版本，仍会读取该闭包的旧chart.timeScale。cleanup既没将该回调显式退订，也未在microtask检查disposed/实例身份。它可能在销毁后读取旧实例，或清掉重挂新实例的pending target。
- crosshair与click回调也应限定创建实例生命周期；当前click有显式unsubscribe，crosshair匿名注册没有对称显式退订。SDK remove会清delegate，但对于已取得的旧回调，应以实例存活检查避免调用当前新owner。
- reveal布局effect的queueMicrotask（1423）不访问SDK，只写React坐标/十字线state；与直接抛错链应区分，但最好拒绝已被替换实例的过期状态更新。

## 最小修复接受条件

- 卸载时先标不可用、断observer/退订本实例监听、清本实例延迟pending，再在活chart上detach primitive，最后remove chart；没有销毁后SDK操作。若选择由remove统一销毁primitive，必须核对SDK是否保证detached释放我们引用，不能盲删资源释放。
- effect-local chart/series/handler身份由同一次创建/销毁闭包持有，清共享ref只清当前同实例，不能清新挂载实例。
- observer与range microtask用disposed/实例身份守卫；旧回调不能读取旧SDK，也不能改新实例pending range或触发execution选择。
- 回归模拟应包含SDK关键语义：detach会请求更新，remove取消既有RAF但后续调用可重新排RAF；保留“已排RO/范围microtask在cleanup后执行”的反例。只断言remove被调用或同步mock不够。
- 不接受try/catch吞掉Object is disposed，不把控制台清空后暂无错误等同根因关闭。
- root最终浏览器：新/旧回合反复切换及390↔1440/导航开合，真实绘图仍正常、末根/双截止/More状态无回归，重新检查新错误记录。

## 补丁复核

待Luna freeze后追加；本段不是实现完成或浏览器通过声明。

## 冻结补丁独立复核

已读 `R8-chart-disposal.md`、最终 `replay-chart.tsx` 与 `replay-chart.recall-review.test.tsx` 三个新增回归及fake SDK行为。**本次确定根因源码/回归覆盖局部pass，未发现新的确定阻断；真实浏览器仍待root。**

- cleanup先置effect-local disposed，disconnect observer、退订click/range，清pending并推进版本；随后活series detach，再chart.remove。SDK detach新排的frame因此在后续remove被取消，不再销毁之后排新frame。没有catch吞错或全局过滤。
- RO回调在任何SDK访问前return disposed；visible-range handler及其已排microtask分别守卫；crosshair同样守卫。新防护不更改原R1 pending逻辑/resize目标优先级。
- 当前创建effect只依赖稳定useCallback requestLogicalRange，React cleanup同步执行；effect-local disposed足以隔离这条旧实例回调链。**不强制为了风格改成更大local-owner重构**，也不将未对纯React reveal微任务加guard作为本次SDK根因未闭合的证据。click原本有对称unsubscribe、SDK remove清delegate，未找到一个可复现的旧click导致销毁访问反例，不附加猜测性阻断。
- 新 `detaches chart primitives before removing the chart` 不只检查顺序：fake detach排deferredLifecycleFrames，remove清已排队列，cleanup后flush任何残余会记录disposed chart update。这保留SDK关键时序，错误remove→detach不能通过。
- 新 `ignores a resize delivery queued after chart cleanup` 保存实际observer callback，unmount后手动交付并断言applyOptions次数不增。
- 新 `does not let a queued range notification read a removed chart` 通过handle.restoreViewport造pending异步range，再触范围通知、unmount、flush microtask；fake getter计销毁后读数，断言0。不是只有同步setter/getter的空断言。

Luna报告红灯三个反例与修后22+21通过；本代理没有重复运行，执行来源保持归属。root当前type/lint/build与反复回合切换/resize真实错误记录仍须完成，不能只由这次源码通过签署整体验收。R7视觉局部pass保留，但浏览器生命周期回归是新的独立门禁。

## 最终运行与真实浏览器限定闭环

独立读取 `R8-coordinator-tests.txt`（2文件43/43）、`R8-runtime.txt`（5/5）、`R8-final-build.txt`（Build complete）、`R8-final-typecheck.txt`（tsc无错误输出）和空错误输出的 `R8-final-lint.txt`；root记录对应命令exit0。未由本代理重复运行。

独立读取 `R8-browser-before.json`：保留2026-09-26T22:13:20.782Z旧Object is disposed完整SDK resizeCanvasElement/RAF栈。`R8-browser-after.json`以2026-09-26T22:26:39.789Z为新构建验证起点，22:32:57.393Z核查结束，记录实际路径 `999996 post→library→999999 pre→resize390/More→library→999996 post→resize1440`，newErrors=[]。没有删除旧异常来制造空记录。

独立打开 `R8-final-post-1440.png`：最终真实图含买入、两次卖出、末根64.89，post/global双截止09-24/08-20、风险4000、净6760/1.69R及侧栏可见。打开 `R8-more-390.png`：220趋势、More区及计划入口保持存在，完整历史与保存动作可见。截图支持新实例继续正常渲染，不单靠errors=[]推定功能工作。

**R8本次已复现的销毁后SDK更新缺陷限定关闭**：源码因果修正、对应异步回归、最终构建运行和原触发浏览器路径均有证据。此结论限于该生命周期缺陷；不声称任意次数/所有设备绝无错误，更不代表整体feature accepted。R7视觉局部接受继续有效。

## 从R7-evidence-gaps收缩后的最小required unverified

1. **US29/30真实浏览器保存错误/409保留输入与可恢复行为**：组件/服务端自动化已通过；root正在独立故障代理验证，尚未收到结果前保持unverified。
2. **E18真实重导关联变化→待确认→明确确认→保存/重开**：领域/组件已有运行；独立预置fixture可以验证consumer状态，但若未真实触发重导，不得把它标为整条重导旅程通过。
3. **E18旧missing Text revision的真实只读显示**：已有领域missing Text与组件missing snapshot覆盖；独立历史fixture/UI实际显示可关闭对应consumer缺口，不能混称新的missing pointer可保存或真实重导通过。
4. **真实手机软件键盘**：价格字段与下部退出原因输入保持趋势/字段同屏，仍无物理设备证据和豁免；桌面390、模拟pointer与故障代理均不替代。

US39直接混run入口缺口已由R7-metric-scope四反例22/22关闭，不再列待办。US37/38结构化SQL身份/分母/缺失/币种已有历史运行/查询证据，不要求新增统计大屏；任意跨交易聚合UI不在本期必验范围。上列是R7-evidence-gaps限定主题的最小名单，不撤销DESIGN-COVERAGE其他尚未被具体证据签署的条目。
