# R6 协调者集成验收

2026-09-26。实现：gpt-5.6-luna / max；独立审查：gpt-6-astra / low；真实浏览器集成：root。工作树 f7a5，预览 3049，只写 repair/acceptance.sqlite 合成库。整体未接受；真实手机软件键盘仍 unverified，当前顶栏/计划排布/手机 More 预算正在收尾。

## 已关闭的实际缺陷

| 范围 | 实际操作与结果 | 证据 |
| --- | --- | --- |
| E20 完成消费 | 999992 从持仓部分退出推进最后决策，留存后事后完成；立即回库显示已复盘1/1、待复盘0，刷新仍1/1；未知费用仍不可用 | R6-library-immediate-pass.png、R6-library-first-completion-reload.png；R6-astra-acceptance.md |
| E20 完成上下文 | 999996 正式成果重开为post/global，行情9/24与成交8/20截止，真实末根64.89、净额6760及1.69R恢复 | R6-reopened-final-1440.png；R5-final-state.json |
| E08 编辑器 | 1440侧栏关闭、右下32px/保存宽36：shell220×210，右界1339小于plot1341；textarea client150、line48。390侧栏打开：shell220×188，右界295位于价格轴外，textarea client128；第一、二完整行可见，正文独立滚动，style/hint固定。背景不再穿透 | R6-editor-filled-1440.png、R6-editor-filled-390.png |
| E05/E07 图上与捕获 | 低价买入30与成本标签分离；手动窗中部分退出靠右时，卖出文字留在plot内；实际留存PNG同样正确，未提前含末次退出 | R6-low-price-fixed.png、R6-low-price-retained.png、R6-right-edge-live.png、R6-right-edge-retained.png |
| E22 桌面More | 实际滚轮滚到全6条：body client273、scrollHeight1262、scrollTop988.5，末条编辑按钮y823–859可见/可点；点击全局快照进入post/full正确双截止，再返回工作图；收起后hidden=true、display=none、rect=0 | R6-more-wheel-bottom-pass.png；此前失败R6-more-native-details-fail.png/R6-more-grid-squeeze.png保留 |
| E19 手机控制横滚 | 390控件44px；真实右滚scrollLeft207，留存与计划侧栏进入屏幕，趋势区220高。More展开预算仍单独返修 | R6-mobile-controls-scroll.png |
| E21 PPTX | 实际正式下载10页、3嵌入原图、7原生可编辑表格；包完整性0项；LibreOffice逐页查看10页，修复包10张渲染与已查看页逐字节相同 | R6-export/999996-formal-fixed.pptx、integrity-fixed.json、render-equivalence.json、R6-pptx-fix.md |
| US32 默认推荐→导出 | 999996草稿holding从explicit决策2切自动，推荐与pre相同周期/时间/价格窗口的holding1。前后post阶段/9月24行情/8月20成交不变；真实草稿PPTX manifest source=draft/rev28、holding97sagm、warnings=[]，image2 SHA77578f…fee3d与原留存一致。pre SHAfeb602…abadb21未变；formal仍explicit holding2 | R6-auto-export-check.json、R6-export/999996-auto-draft.pptx；R6-astra-acceptance.md |

截图补充：R6-editor-opaque-*.png 是高级截图API返回的较早空输入帧，只能支持不透明边界；filled文件在DOM确认文字后使用同一CUA截图字节保存并展示，已由Astra实际打开。保留旧图，不用新结论覆盖旧证据。

## 自动化与安全

- root R6-storage-regression.txt：3文件85测试通过，覆盖sqlite-store、completion bridge、Recall repository。
- root R6-final-typecheck.txt：通过；R6-final-lint.txt：0错误8既有警告。
- root R6-final-build.txt：通过；R6-final-runtime.txt：5/5通过。
- 后续只有More CSS修复再构建R6-more-final-build.txt；顶栏/计划布局最终构建仍待完成。
- PPTX修复：真实ZIP content-types回归先失败后11/11通过；见R6-pptx-red/green及独立审查。
- bridge测试改为每个用例独立mkdtemp，只清理自己创建的目录并恢复环境变量；不信任外部DB_PATH作为删除目标。外部sentinel保持不变。该约束同步进项目workflow。
- 没有向业务库写入或提交、推送、合并远端。原始25笔成交最终哈希核对待本轮结束再次执行。

## 尚需关闭

1. E10计划入场单行、止损/目标双列；方向/单位保持紧凑且未知状态不自动填。
2. E01 1280顶栏不分散成三个稀疏工具行；1440/1280/导航展开态复验。
3. E19/E22 390 More下的记录空间和底部返回按钮可读性；220趋势区保留。
4. 最终构建对应截图、尺寸、浏览器错误、数据库摘要、README/矩阵/票/最终接受记录同步。
5. 真机软件键盘：价格输入和退出原因输入，未验证、无豁免；桌面窄屏不能替代。
