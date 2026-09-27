# R9 显式冲突重载独立审查

2026-09-27，`gpt-6-astra / low`。只读冻结workspace/load/save实现、新增测试与 `R9-conflict-reload.md`；未改产品、运行测试或浏览器。**确定根因源码修正局部pass；真实双窗口最终闭环仍待root，不签整体接受。**

## 实际消费者与丢弃边界

`recall-workspace.tsx:2846`冲突横条“重新载入”直接 `loadEpisode(episode, () => false)`，第三参默认false，因此走完整repository.load而非同回合hydrate。加载成功并通过cancelled检查后，新增 `setPlanEdits({})` 清掉优先于document.plans.drafts的字段覆盖。服务器1200不再被本地1300遮住。失败load不会先清planEdits；确认完成的完整load才是丢弃边界。

同分支 `acceptedQueuedSavesRef.current.delete(nextDocument.episodeId)` 清同回合已确认排队保存基线，同时沿用loaded document、latestSavedDocumentRef和generation重置。这避免后续saveNow将已丢弃的本地覆盖基线重新套入远端版本。没有改CAS协议：saveNow仍按候选文档revision传expectedRevision；既有accepted-save按episode分区，删除仅当前loaded episode。

市场数据hydrate的 `currentDraft` 分支在新增清空之前返回，继续用draftRef reconcile，不经过repository.load，不清字段输入。该分支原来保护未保存输入，R9没有把每次行情刷新变成隐式丢弃。新增修改没有改阶段/双截止/绘图或正式版本边界。

## 回归证据范围

新增 `recall-workspace.test.tsx:1469`，`reloads server plan input after a conflict instead of reusing the stale local overlay`，真实渲染workspace、改数量1300、save返回409、点实际“重新载入”按钮，断言输入恢复服务器1200。随后再改1300和入场11，断言第二次提交两字段均保留。该用例验证实际按钮→load→UI与后续保存接线，不只是测helper。

worker记录修前Expected1200/Received1300明确red，修后该例和整文件53/53 green；本代理未重跑。源码中CAS expectedRevision仍正常，**新增用例自身没有显式断言第二次save options.expectedRevision，也未先构造已有acceptedQueuedSave缓存**，所以它直接证明字段覆盖修正和二次字段保存，不应称覆盖每种排队CAS时序。既有排队/冲突/hydrate用例应与root定向结果联合引用；未发现本补丁引入确定新的CAS缺陷，不为测试覆盖风格扩张修复范围。

## 当前接受边界

源修改落在成功完整load的正确位置，修复目标因果匹配；不在hydrate分支清草稿，不吞409，不自动覆盖远端。最终需root同一A/B真实路径：B1200成功、A1300冲突仍保留，A明确重新载入显示1200且风险4800（本样例56/52），再次输入后以最新CAS保存，再重开一致。type/lint/build与真实浏览器尚在执行，不能用worker53通过提前关闭整条旅程。

## 最终证据独立复核与限定关闭

独立打开 `R9-reloaded-1400.png`：真实A窗口重新载入后计划数量1400、止盈目标69、风险5600、预期3.25R清楚可见；冲突横条已消失；买入前双截止保持首次成交之前。不是仅更新“已保存”文案而仍展示1500覆盖值。

root实际双窗口动作记录：A/B初始1200；B改1400与目标69成功保存；A改1500发生真实409且本地保留；用户明确重载后恢复1400/69；再只改数量1300，返回库重开1300且69保留；最后恢复1000/68保存重开正确，999999全程未推进。该序列验证远端多字段消费、清本地覆盖、重载后再编辑保存及重开，不由单张截图独立证明全部步骤；动作归root实际浏览器。root记录r9BrowserStart之后新增console errors=[]。

独立读取 `R9-coordinator-tests.txt`：1文件7 passed/46 skipped，跳过项不算本次通过；`R9-runtime.txt`5/5；`R9-build.txt`Build complete；typecheck无错误输出、lint无错误输出，root记录均exit0。worker整文件53/53与root定向7项保持各自范围。

独立读取 `R9-final-state.json`：隔离库quickCheck=ok，25条execution哈希 `1b79e6e605b493b4e0ce7833094824c807680c972166a83a1a3f0b8aefd12b36`，旧24/21摘要与历史基线一致；正式成果仍completed，已留存global bundle为post-review、截止09-24/最终退出，指标6760/1.69R/原风险4000保持。该JSON证明正式成果与数据未受冲突验收污染，不把999996成果状态误当999999恢复输入的数据库证据。

**R9已复现的显式重新载入仍显示旧planEdits缺陷限定关闭。** 根因源码、UI回归、最终构建与真实A/B重载→再编辑→重开均已闭环。US29/30真实500保留恢复及409保留/显式远端重载在已测路径范围内通过；不扩大成所有网络/并发组合通过，不称全功能或真机键盘通过。真实原单重导旅程及真机软件键盘仍按各自证据独立验收。
