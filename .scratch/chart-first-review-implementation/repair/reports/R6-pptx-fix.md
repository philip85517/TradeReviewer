# R6 PPTX 包完整性与实际导出

Root 修复，Astra 独立源码与内容审查。E21，批准规格「三图一表导出」及 06-export-storyboard.png；不改变历史快照构图。

实际 UI 下载正式版本后，包检查发现 PptxGenJS 4.0.1 的内容类型清单按每页写母版声明，而 ZIP 仅包含共用 slideMaster1。新增真实生成/解包测试先红（slideMaster2 不存在，R6-pptx-red.txt），生成后只删除不存在的 slideMaster 声明，已有母版、图片、表格及关系均保留。原已安装/lock 的 JSZip 3.10.2 声明为直接依赖；未下载新版本。

11/11 导出测试通过（R6-pptx-green.txt），定向 ESLint 无错误（R6-pptx-lint.txt）。新的真实 UI 下载为 R6-export/999996-formal-fixed.pptx，包完整性检查 0 findings、10 slides（integrity-fixed.json）。

Root 用 bundled LibreOffice 将新旧包渲染 PDF，并实际打开原包全部 10 张 PNG：三张阶段图、分页面积足够的可编辑表格及 Text A 原文均可读。修复后的 10 张渲染 PNG 与原已审图逐字节一致（render-equivalence.json），13 个 slide XML/media part 也全部一致。母版清单修复不改变视觉或冻结图文。未声称在 Microsoft PowerPoint 中打开。

Astra 独立审计确认 3 个内嵌 PNG 与各自已留存代表图完全一致，7 个原生 DrawingML 表格，summary 来自正式 revision24/global bundle，阶段图来自各自 revision6/12/19，Text A 没被工作 B 覆盖。历史异窗有明确警告，按规格保留原图；不将该例外等同默认同窗路径已经实测。
