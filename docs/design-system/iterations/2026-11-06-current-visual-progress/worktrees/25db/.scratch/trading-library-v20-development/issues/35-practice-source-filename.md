# I35 练习详情来源文件名

状态：进行中；功能、独立验收、桌面浏览器和视觉均 NOT VERIFIED。本票只处理来源追溯，不代表详情、日线回放或 V2 整体完成。

依据 `docs/design-system/trading-library-design-spec.md:29`，练习详情保留原始文件名供追溯；V2 `visual-design.candidate.md:116` 保留来源信息，原有 `NAME-STABLE / TL20-PRACTICE-NAME` 对应此要求。`hcr06-final-rounds-a.svg` 没有明确的文件名位置，沿当前详情“来源信息”视觉结构呈现，不声称有专属已批准排版。源数据以当前保存版本为准，不能因日期更正或练习标题推造文件名。

用户旅程：导入保存后进入练习详情，在来源信息读到原始文件名，返回重开仍一致；切换练习各自显示正确文件名；长文件名完整可读。重导行为遵循现有已存来源，不假定重导改名更新来源。先加公开行为测试确认失败后再最小修复。实现负责人 `import_recon` 仅负责详情组件、其专属样式及对应测试，协调者负责整体数据链及视觉；独立未实现代理验收。浏览器写操作只用隔离库。桌面视觉和受影响控件、真实持久化旅程须独立验收；触屏和窄屏按用户要求排除。禁止涉及回放恢复、历史导航保护、本金并发等 STOPPED 问题。

证据保存于 `evidence/I35-source-filename-20261105/`，保留红绿和所有失败；复验绑定文件版本。

2026-11-05：组件修改[红绿记录](../evidence/I35-source-filename-20261105/implementation.md)显示 4 项新增反例先失败后通过、组件 19/19 通过；[独立组件复验](../evidence/I35-source-filename-20261105/independent-review.md)限定 PASS，并覆盖特殊字符和练习切换。真实浏览器、持久化返回重开和视觉仍 NOT VERIFIED，整体未接受。

2026-11-05 后续：[隔离浏览器限定复验](../evidence/I35-source-filename-20261105/browser-independent/acceptance.md)先通过真实 API 保存两份练习，再在 Chrome 中检查列表→A→列表→B→列表→A 及数据页，文件名对应正确。浏览器文件选择受扩展权限阻碍，浏览器上传 NOT VERIFIED；1200×625 可见长名且无重叠，但截图未落盘、未完成规定视口同态参考对照，视觉 NOT VERIFIED。整票未接受；保持此前组件与版本证据。

2026-11-05：I34 修改详情组件后，[独立浏览器重验](../evidence/I35-source-filename-20261105/browser-independent/recheck-after-i34.md)在新组件哈希下再次验证 A→B→重开 A 文件名正确。截图未落盘，规定视口同态视觉、浏览器上传仍 NOT VERIFIED；整票未接受。协调者随后在同一隔离 Chrome 页面另见长文件名完整文本，未将单次观察当作视觉通过。
