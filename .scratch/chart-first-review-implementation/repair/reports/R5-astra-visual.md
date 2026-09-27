# R5 Astra 独立视觉与接线验收（进行中）

2026-09-26。只读产品；浏览器由root独占，本审查实际打开root截图并独立读源代码、跑小定向测试。**当前整体未通过**，局部pass不代表功能接受。

## 依据和证据

已读AGENTS.md、主规格`docs/specs/2026-09-25-chart-first-review-ui.md`与元素规范，以及R2-text/R3-layout/R4-astra-review/R2-astra-recheck。实际查看设计02-chart-workspace、05-final-review、06-export-storyboard原图。实际查看R5-text-collapsed-1440、R5-text-dragged-collapsed-1440、R5-pre-plan-1440、R5-first-buy-1440。参考图的说明画板不要求复制到产品；180px文字默认宽不是强制缺陷，规范强制默认14px。

独立执行：
`npx vitest run app/lib/chart/text-geometry.test.ts app/components/chart/drawing-canvas.recall-review.test.tsx app/components/chart/canonical-chart-capture.test.ts --maxWorkers=1 --reporter=dot`
20:24:55，3 files / 26 tests passed，6.29s。非全量、非真实浏览器证明。

## R2/R3返修核验

| 项目 | 结果 | 精确证据 |
| --- | --- | --- |
| R2-3a真实textarea宽度 | pass（代码/定向测试） | drawing-canvas.tsx textEditorFrame独立最小220px且受plot约束；textarea minWidth0/maxWidth100%/border-box，覆写旧120px minimum。实际右下编辑器rect尚待root。 |
| R2-3b底部边界 | pass（代码/定向测试） | maxHeight=size.height-top-2；shell overflowY auto，stylebar不换行可横滚。已有定向边界测试通过，32px真实浏览器尚待。 |
| Text展开命中 | pass | width/height/minWidth/minHeight均44px，12px文案；共享layout同时预留44px控制区。1440真实截图按钮清楚、无正文覆盖。 |
| live/capture接线 | pass（源码） | replay-chart capture在flushSync(commitText)之后首个await之前读getExpandedTextIds；canonical capture转Set传共享paintDrawingScene；warning同一layout判定。无把展开状态错误写进持久化字段。实际导出仍未验。 |
| R3footer日期 | pass（最新1440图） | R5-text-collapsed、dragged、first-buy：行情时间及成交截止分行完整。旧R5-pre-plan图仍截断，保留旧失败证据，不能当最新图。1280/390尚未验。 |

## 逐元素视觉状态

| 元素 | 状态 | 观察 |
| --- | --- | --- |
| E01/E02顶栏 | 局部pass | 1440紧凑证券/周期/阶段/动作，长名省略；无大横幅。full title与键盘行为未由本审查操作。 |
| E03工具 | 局部pass | 1440独立左工具列、Select/Text优先；旧工具保留源码已查。触控尺寸待390图。 |
| E04/E07图与成交 | unverified功能 | first-buy图实际菱形+买入出现；单张图不能证明逐根/双游标全程。本审查不替代root真实旅程。 |
| E05/E06价格区 | pass当前1440视觉 | 金色虚线、数值标签位于独立轴内，14px沟槽和侧栏分离；早期目标68在视野外时有显示计划价格入口，无强制fit。 |
| E08 Text | 局部pass/有fail | collapsed两行省略、14px可读、蓝边/编号/连线。dragged截图离开K线且锚连线保留。first-buy展开原文未遮轴。编辑器hint源码9px仍低于12px辅助字规范。 |
| E09侧栏开关 | unverified | 按钮可见；不丢输入/游标/焦点须root操作证据。 |
| E10/E11/E12计划输入 | 局部pass | 价格/方向、止损目标、三模式、数量单位、次级资金来源入口清晰；未提前露退出评价。模式換算/错误/展开状态尚待。 |
| E13派生行 | fail待补 | 当前三行名义金额/风险/预期收益+R清楚，但缺3:1收益风险解释，root已知。 |
| E14持仓侧栏 | fail | R5-first-buy-1440两块“当前执行”重复剩余1000、已实现0、浮盈亏-370。workspace primary compact + secondary full且holding initialOpen=true。应默认折叠详情，保留可发现入口；不能以组件各自正确替代整体层级。 |
| E15–E18事后 | unverified | 尚未收到匹配事后与退出选择截图。 |
| E19底栏 | 局部pass | 最新1440日期完整、按钮完整，实际高度约74px；规范48px起且允许必要换行，未仅因高于48判失败。 |
| E20保存 | unverified行为 | 图显示草稿/有草稿修改，真实请求/冲突保留待root。 |
| E21/E22导出历史 | unverified | 尚无本轮匹配图及真实导出证据。 |

## 明确未验证

1280紧凑桌面、390窄屏、资金展开/长数字/错误、右底Text编辑器、真实手机软件键盘（价格与退出原因）、当前Text保存capture/重开、旧快照独立与PPTX实际视觉均不能由本报告替代。整体需继续收到截图与root旅程证据后更新。
