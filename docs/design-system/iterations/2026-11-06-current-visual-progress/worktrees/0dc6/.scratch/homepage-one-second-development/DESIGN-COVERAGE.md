# 设计覆盖与验收合同

规格根：docs/design-system/baselines/2026-10-22-homepage-v2.5/source/。视觉总负责人 root；完整读数据/API接线总负责人 root；01服务器 owner、02workspace owner，独立审查者不得自审。无授权视觉偏差。沿用原规格的 element IDs，不创造替代 ID。

| 范围/原规范 ID | 精确参考 | owner/旅程 | 必需证据 |
| --- | --- | --- | --- |
| 01 行情读取；HP02期间金额、HP11首屏及持仓/曲线所需来源 | visual-design.candidate.md chapter-HP02、chapter-HP11；源码市场 route 与 sqlite-store；原冻结清单 | 01 owner；读取目标证券日线与周期覆盖，未知/损坏/跨连接修订 | SQL 条件真实进入 SQLite、全字段等价、无关损坏隔离、相关回归；UI整体性能不能据此算通过 |
| 02 入口与交易库/复盘往返（HP11/HP03/HP02 对应状态维持） | visual-design.candidate.md，component-manual.html；images/home-1440.svg、home-1280.svg、home-history-1440.svg、home-history-1280.svg；交易库 V1.0 source/visual-design.candidate.md；现有 workspace 旅程 | 02 owner；home→带 scope/market/accounts/range/附件 trades→Recall→返回→home；首次 loading/失败/再次导航；导入取消与替换 | 隔离模块求值测试、首次实际请求、取消/恢复回归；相同状态桌面截图独立比较；变更控件见下表 |
| 03 一秒完整首屏 | 用户确认边界；../homepage-one-second-wayfinder/VALIDATION-ROUTE.md；上述原图/正文 | root；冷/热、重启、写后；完整金额/持仓/曲线与可交互 | 原始样本与最慢值，非零真数据，持久化链；数据未知或超时保留 FAIL，不合并门槛 |
| 04 通用券商订单号的导入保存；HP11导入持久化 | types.ts:137、statement-evidence.ts:820 券商订单证据；sqlite-store.ts 模拟校验；Task02实际保存失败截图 | 04 owner；原券商成交＋新TradingView预览→确认→SQLite→返回→reload | 旧行完整保留、两笔新增、模拟反例仍拒绝；无新增UI/布局，原导入控件一并审计；不恢复暂停财务 |

局部控制检查触发：02改变加载时机及解析异步边界。改动不重排页面。对照视口1440×1000、1280×800 CSS px，100%缩放；DPR实测记录。保持72px导航/64px顶栏、24px内容间距、36px控件，原规定密度与8行持仓，不允许fallback推移整页舞台。主规格未授权更改。

| 局部控制/状态 | owner | 上下游与验证 | 当前 |
| --- | --- | --- | --- |
| 首页→交易库→返回（鼠标/键盘） | root | scope/账户/期间/搜索排序/来源UI保持，首次加载与中途再导航 | 普通页面可返回PASS；完整首页scope旅程NOT VERIFIED；C2范围点击FAIL保留 |
| 交易集合→Recall→返回、Review入口 | root | 四视图最终恢复eager，保持原合同与guard；既有草稿/保存链仍须独立验收 | C2普通库Recall真实图表/返回PASS；Review保存及回放推进NOT VERIFIED |
| 导入文件→取消/替换/异常恢复 | 02/root | dispatcher未加载时取消、晚到不发布、有效文件重试；真实写入时必须独立库保存→返回→reload | 请求代次测试PASS；真实404/503、提示关闭及手动刷新恢复PASS；C4保存返回reload及原行保留PASS；Sol续验真实慢模块反馈/锁定/释放PASS，取消/替换/晚到竞态NOT VERIFIED，关闭后焦点FAIL |
| 桌面首屏与加载/失败状态 | root（未实现UI） | 对原图及baseline匹配状态看图；页面首屏既有失败单列 | 1440/1280同态导入预览限定PASS；正常非零首页视觉NOT VERIFIED；完整≤1s FAIL |

候选1新增四个条件重试按钮，必须登记；真实交易库retry已FAIL，不能使用mock替换恢复证明生产可用。候选2已撤销四视图lazy wrapper及这四个新按钮，经冻结源码核对保持原交互；四按钮在当前候选NOT APPLICABLE（已不存在），候选1失败不删除。实际触屏无设备，保留 NOT VERIFIED，不冒充鼠标证据。01是无写入服务器查询，写入流程 NOT APPLICABLE；C4真实导入持久化由Task04修复后独立验收，不能改写C2保存失败。整页既有55控件/96状态审计不借局部票关闭。

### 候选1条件控件及候选2调整

|版本/控件ID（本次审计ID，不替代规范ID）|出现条件/动作|预期|候选1证据/状态|候选2范围|
|---|---|---|---|---|
|retry-trades|TradeLibrary chunk拒绝，点重新加载交易库|产物恢复后视图呈现；父URL/guard保持|chunk-failure/retry-AX.txt、retry-1440.jpg；FAIL|已移除，恢复eager|
|retry-recall|Recall chunk拒绝，点重新加载回忆复盘工作区|恢复原Recall与header入口|NOT VERIFIED|已移除，恢复eager|
|retry-review|ReviewChart chunk拒绝，点重新加载交易复盘图表工作区|恢复图表与guard|NOT VERIFIED|已移除，恢复eager|
|retry-dashboard|ReviewDashboard chunk拒绝，点重新加载我的交易室|恢复dashboard|NOT VERIFIED|已移除，恢复eager|

候选1第一张home-1440.png文件实际为1280×720，因新tab重置viewport，不支持1440同态比较；保留原文件并在最终报告指出失效边界。baseline图片经PIL核验是1440×1000/1280×800 JPEG（扩展名历史为png），可继续用于相同状态对照。最终截图使用正确扩展名、应用viewport后通过DOM clientWidth/Height确认。

## C4 最终版本绑定与裁决

见 [最终验收](FINAL-ACCEPTANCE.md)与[C4控件审计](evidence/candidate-04/CONTROL-AUDIT.md)。C4源码清单884文件、后验0变化；运行PID60461/4392，显式隔离DB与lsof句柄一致；实际首页9个JS/CSS资源URL已绑定dist hash。1440×1000、1280×800桌面DPR1，最终1440记录zoom1，不把晚测值回填到每张历史截图。

HP11本次store写链通过：1866→1868，原行missing0/changed0/added2，返回交易库与reload后digest一致；Task04接受2/3。HP02/HP03正常非零财务/首页范围合同未接受，Task02保持open/partially-verified2/3，Task03open/incomplete1/3。Task01接受2/3的收益限236次串行读取累计耗时，不代表首页1s。原P1/F07/Bars暂停3/3。无批准设计偏差；正常8行持仓与图表状态未验证，不能用空态替代。

## Sol 6.1 Ultra 桌面续验（同C4，无新产品候选）

后续新增[四问题诊断覆盖](../homepage-data-diagnosis-2026-10-24/DESIGN-COVERAGE.md)与[局部桌面审计](../homepage-data-diagnosis-2026-10-24/CONTROL-AUDIT.md)：同源成交1868笔、旧库兼容实盘1784笔与首页严格live为0的口径差异已确认；全市场两次实际首页timeout，历史已平仓区仍not-wired。HP02/HP03保持未接受，不能用旧库有数据、接口200或空持仓通过替代。只读诊断不构成新实现候选，不变更任务轮次或恢复暂停项。

[root裁决](evidence/continuation-2026-10-24/ROOT-ACCEPTANCE.md)、[覆盖表](evidence/continuation-2026-10-24/CONTROL-AUDIT.md)、[独立直接看图复核](evidence/continuation-2026-10-24/independent-scan/visual-review-continuation.md)。1440×1000及1280×800实测桌面DPR1/scale1；CSV/XLSX/PDF限定样本、核对→预览阶段及页脚可见性局部PASS，日期单位换行/贴边密度发现保留，展开滚动NOT VERIFIED。首页可见入口→CSV预览PASS，不证明首页保存/返回完整链。正常预览关闭后焦点BODY与遮罩焦点BODY为FAIL；Tab循环PASS不抵消。共享导入焦点一体化方案只记录，未实施，不能将源码相同推断当作baseline运行已复现。原正常整页/一秒/范围门槛与轮次保持不变。
