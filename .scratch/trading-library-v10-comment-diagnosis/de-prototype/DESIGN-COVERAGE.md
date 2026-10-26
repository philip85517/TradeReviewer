# D/E 导航视觉样例契约

日期：2026-10-24。用户授权：“实现 D 和 E 的视觉样例让我确认下设计方案”。仅制作独立 throwaway 比较页面，既有 B、正文、图稿、评论保持原样。D/E 尚未成为正式设计。

参考：../REVIEW-REVISION-11.md（逐项判断、推荐方向）；../../../../docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/visual-design.candidate.md BT02 38–67、BT03 69–106、BT05；../evidence/revision-11-analysis/comment-target.png（1440×1000，原图）；既有 navigation-options.html（样例数据与公共样式）。

整页视觉与状态接线负责人：root；唯一实现者：Luna de_visual_impl；独立浏览器与视觉验收：root（不参与实现）。无数据库、无业务写入。比较样例单独保存为 navigation-de-prototype.html，避免改写已确认 B 及其证据。用户选择前不提升为生产代码。

视觉：72px 侧栏、64px 顶栏，内容左缘96px/右24px；14px 控件/正文、12px辅助、24px交易库标题；模式至少36px命中。D顶栏相邻标题/模式/页面；E顶栏标题/返回，下一行相邻模式/页面。模拟增加非盈亏语义紫色边界，选中名称与形状同时保留。不再在结果上方重复大标题、路径、条件串。日期语义留在控件标签。比较桌面1440×1000、1280×800；本次不设计手机/触控版本。

| ID / 来源 | elementID | 参考 | 状态/旅程 | owner | 预期与反例 | 证据 | 结果 |
|---|---|---|---|---|---|---|---|
| DE01 / C11 D/E方向 | de-variant | REVIEW-REVISION-11.md 末节 | D/E切换、刷新URL | Luna/root | ?variant=D/E；只改变布局，模式、页面、条件不变；底部比较工具不遮内容 | acceptance.md | PASS（本次样例，见 acceptance.md） |
| DE02 / C11 重复信息 | de-header | comment-target.png 顶部 | D/E×实盘/模拟×列表/统计 | Luna/root | 去重；两组导航相邻且四态不跳；字号不缩小 | screenshots | PASS（本次样例，见 acceptance.md） |
| DE03 / C11 focus | de-mode,de-tab | navigation-options.html 控件 | 模式切换/页签鼠标和键盘 | Luna/root | 演示共享当前页面选择，保留各模式日期；焦点保留；明确待确认提议 | acceptance.md | PASS（本次样例，见 acceptance.md） |
| DE04 / BT03 | de-date | source/visual-design.candidate.md:81 | 普通/长日期 | Luna/root | 成交日期/平仓日期/练习保存日期；两模式账户隔离；长日期不挤导航 | screenshots | PASS（本次样例，见 acceptance.md） |
| DE05 / C11 视觉识别 | de-simulation | REVIEW-REVISION-11.md 判断表 | 模拟四态 | Luna/root | 紫色边界＋选中模式文字，不只靠颜色、不用盈亏红绿 | screenshots | PASS（本次样例，见 acceptance.md） |
| DE06 / BT05 | de-content | 既有 navigation-options.html | 相同数据列表/统计 | Luna/root | 两方案同数据/密度；最差练习回撤缺失保持—，不创造数值 | screenshots | PASS（本次样例，见 acceptance.md） |
| DE07 / BT07 | de-preview | 既有比较稿异常态 | 正常/加载/空 | Luna/root | 导航与工具区位置稳定；空列表不写已平仓回合 | screenshots | PASS（本次样例，见 acceptance.md） |
| DE08 / C11来源 | de-origin | REVIEW-REVISION-11.md | 首页来源/直接进入 | Luna/root | 来源仅控制弱返回入口；返回是样例动作，说明边界，不冒充生产恢复 | acceptance.md | PASS（本次样例，见 acceptance.md） |

完整控件范围：方案D/E及前后切换、模式2项、页面2项、日期2值、预览正常/加载/空、来源2值、返回演示、统计分布单位（如沿用），全部实际操作。表格样例非可点击业务入口，侧栏为视觉上下文。搜索/排序/分页/业务详情、数据库持久化和触控不属于本次导航方案视觉样例；不能将其记为产品验收通过。

状态：方案切换仅改变variant；模式切换保留当前page（本次演示提议），每模式记忆日期；page切换改变内容及日期标签；来源选项改变返回入口；加载/空保持导航。仅URL持久化variant，业务状态内存中，刷新重置并明确提示。
