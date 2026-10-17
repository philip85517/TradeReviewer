# V2.1 修订执行计划

依据：../homepage-spec-v2-sol56-review/REVIEW-SUMMARY.md 与12张issues；完整原文为V1 reviews/2026-10-16/HOME-DOC.json。保留V2历史，输出 docs/design-system/baselines/2026-10-17-homepage-v2.1。

## 已确定的共同合同

- F02：保留已存在列表内容的viewport位置，不补偿scrollTop，展开按钮随末尾下移；取消“按钮附近视线不动”。展开焦点移至第一新增行，收起前先将焦点移至保留的第10行；收起完成后按钮若不可见只作nearest滚入。为鼠标不强行移动键盘焦点，键盘才执行上述焦点转移。32px行，200ms，reduced-motion 0ms；展开→反向从当前高度继续，重复同向不重复追加。
- F03：URL显式market=all|a|hk|us与scope=live|sim及accounts、date/queue；URL是刷新/直开权威，非法market回all并提示。返回保存首页滚动、期间和筛选；市场不得隐式来自内存。
- F04：committedScope A / draft B / request generation；控件候选B明确“待应用/加载中”，数据标题、单位、KPI、曲线、贡献保持A；最新generation且scope key匹配才整组commit。A→B→C时取消B并忽略迟到B，C失败回A，重试C开启新generation；无缓存初载骨架，失败不显示0。请求15s超时且可手动重试，不自动无限重试。
- F07：局部搜索浮层280宽覆盖表格，不改变卡片高度；IconButton视觉/命中36，icon viewBox16，Token视觉24外层命中36、删除独立36且不重叠，Retry视觉32外层36。焦点环2、外偏2。
- F08：实体搜索清空只清query不清已commit scope；选择实体候选打开详情，不改变全局scope；tooltip hover300ms/focus立即，leave100ms，Esc隐藏至重新进入；详情对话框Esc/×关闭，外点不关闭、focus trap，返回原行查看按钮，若行失效回表标题。
- F09：日期快捷今年/本月/本周改草稿，应用才请求。中间日10-14：期初6252，截至所选日浮盈10012、已实现7440，变动3760、净11200；当日市值288420。10-15例不变。
- F10：无汇率数值—使用中性色#A8B6CB，不代表0/盈利；已有效原币可进入详情。
- F11：系统字体为正式选型；无字体文件的Web Sans仅概念候选，不作为实际字形比较证据。补4/8/12/16/24/32间距、6/8圆角和命中区图。
- F12：只C18含D01；C28/C31盈亏日历交接已决定。不得将待决定记PASS。

## 文件边界与步骤

- [ ] 原子规范worker：独占 build-atom-revision.py、images/atom-*.svg、images/geometry-tokens.svg、atom-contract.md/json；11×8每格独立合同及真实几何状态，保留10个N/A原因。F01/F07/F11。
- [ ] 旅程worker：独占 build-journey-revision.py、images/journey-*.svg、journey-contract.md；F02–F06/F08/F09，按共同合同画前中后/异常/退出，不能用文字卡代替真实控件。
- [ ] coordinator：原generators和正文、构建与版本身份；修正旧图冲突、F10/F12，整合两worker片段，维护评论39条矩阵。整页视觉与评论持久化唯一owner。
- [ ] 独立Sol5.6 reviewer：逐12项及39评论、修改画稿直接渲染检查；不实施自身所审内容。
- [ ] coordinator：链接/构建/冻结哈希检查，真实浏览器打开阅读器与图板、分镜切换，隔离评论存储做保存/重开；生成接受记录与preview命令。

## 检查反例

复杂控件被压缩为150×36；scope混合市场；B晚返回覆盖C；图文滚动不一致；复制链接丢市场；D01误作通过；旧版本评论被覆盖。每项映射DESIGN-COVERAGE并由独立审查拒绝反例。
