# 一秒首屏独立优化：最终阶段记录

**后续只读诊断，未修复、无新增产品候选**：[数据差异诊断](../homepage-data-diagnosis-2026-10-24/DIAGNOSIS.md)、[桌面审计](../homepage-data-diagnosis-2026-10-24/CONTROL-AUDIT.md)。同C4源清单884文件无变化；本次核验9个初始资源hash，不将其扩大为重新核验272份产物。4392首页与旧库返回相同1868笔成交，原业务库1866笔均逐列保留，但不是整个数据库所有表相同。1784笔未知性质在旧库兼容推断为实盘、首页仍unknown。1440×1000全市场首页两次实际进入均timeout，首页带scope进入旧库为0，而普通旧库切实盘为232标的/732回合；这与下文先前A股警告截图是不同时间/范围的观察。当前单次源接口约540ms、bootstrap249ms、FX5ms，不能把HTTP完成当作完整首屏完成。财务来源不完整、全链路超时、失败UI与异常原因丢失分别登记。正常首页与≤1s仍未接受，Task02 2/3、Task03 1/3、P1/F07/Bars暂停3/3不变。

**最新续验（Sol 6.1 Ultra，多 Agent，root 独立操作/裁决）**：[ROOT-ACCEPTANCE](evidence/continuation-2026-10-24/ROOT-ACCEPTANCE.md)、[24项覆盖表](evidence/continuation-2026-10-24/CONTROL-AUDIT.md)。本轮未改产品/测试/dist，轮次不变。补齐真实桌面 CSV/XLSX/Tiger PDF核对→预览、PDF实际24.150秒受控等待→原hash释放、dispatcher503准确提示/关闭→手动刷新后有效解析、首页入口→CSV预览。Tab循环PASS，正常关闭后BODY焦点 **FAIL**；真实pending取消/替换/晚到隔离仍NOT VERIFIED。原批准独立产品优化未发现新的未实施项，Task02/03保持open。原1868笔executions全列missing0/changed0/added0；884源文件/272产物无变化。以下Astra阶段原记录保留，不以新证据改写旧FAIL或声称完整首页验收。

2026-10-24；协调与最终验收 root，实施与独立审查 GPT-6 Astra Ultra。**本次完成部分独立优化，完整首页交付与≤1s目标未通过。** 用户最新决定“保持暂停，先完成独立优化”继续生效；原 P1/F07、Bars 均暂停3/3，不重置、不借新票恢复。旧记录保留于 `../homepage-v25-implementation/FINAL-ACCEPTANCE.md`。

最终记录经未实施本轮产品变更的审查者只读复核，[限定范围批准](evidence/candidate-04/FINAL-INDEPENDENT-AUDIT.md)，不替代下列FAIL/NOT VERIFIED。

## 任务裁决与轮次

| 任务 | 轮次 | 最终状态 | 接受边界 |
| --- | --- | --- | --- |
| 01 行情窄查询 | 2/3 | accepted / closed | SQLite按证券与interval过滤、无参兼容、响应等价；不是首屏性能通过 |
| 02 启动依赖 | 2/3 | partially-verified / open | parser/dispatcher-XLSX lazy代码及资源收益接受；四视图lazy未交付，完整UI门槛未关闭 |
| 03 集成验收 | 1/3 | incomplete / open | 构建、定向回归及局部桌面持久化通过；完整数据、正常首页视觉、1s门槛未通过 |
| 04 通用订单号导入 | 2/3 | accepted / closed | 严格来源校验、原子拒绝非法类型、真实桌面导入保存返回重载通过 |
| 原 P1/F07、Bars | 3/3 | paused | 保留原失败记录，未执行恢复 |

Task01候选1类型失败→候选2修正；Task02候选1真实模块恢复后同URL按钮重试失败→候选2撤销四视图wrapper和四个retry按钮；Task04候选1非法number/null/array/object可保存被独立审查拒绝→候选2通用类型守卫。所有历史RED、失败截图、错误harness及中间构建均保留。C1～C4是集成构建编号，不是每个任务的新增验收轮次。没有触及超过3轮仍继续迭代的任务。

## 冻结版本、运行与数据

- HEAD `58bf0d90e68ddc634de180b3f5c3d16a089f0eb3` 加当前既有工作区，不能将HEAD独自当候选版本。C4 [源码清单](evidence/candidate-04/SOURCE-MANIFEST.json)884文件，SHA256 `c746f74eed447b3882a2d21a6452dffda1f030471cd91e4550f1fc1bf9d40ce7`；[后验版本绑定](evidence/candidate-04/VERSION-BINDING.json) missing0、changedSinceFreeze0，含浏览器资源URL与本地dist文件hash。
- 生产服务4392，PID60461，2026-10-24 16:25:55本地启动；Node26.0.0/SQLite3.53.0。进程命令、runtime、cwd、显式`TRADEREVIEW_DB_PATH`与实际打开的同路径数据库/WAL/SHM见 [RUNTIME-BINDING.json](evidence/candidate-04/RUNTIME-BINDING.json)。这比仅有HTTP200或SERVER.log端口更严格；没有保存其它环境变量。
- 本阶段从既有隔离baseline.sqlite在线备份为C4 `candidate.sqlite`，没有直接使用业务原库。初始1866 executions、236 instruments、154410 daily_candles、213 import_batches。运行副本会有既有元数据自动写入，`identicalToBaseline=false`；不宣称全库所有表不变。
- root真实CSV导入后1868 executions、214 import_batches。最终完整SQL行digest `9a8dbe7edd9597bf445f726b95f73a5442285fe5c8b25fa3dc3faf5c2493a255`；相对保存前1866行 missing0/changed0/added2。保存后、reload后、取消视觉专用预览后digest一致。见 [FINAL-EXECUTIONS.json](evidence/candidate-04/FINAL-EXECUTIONS.json)。该检查覆盖executions全SQL列，不推广到其它表。

## 独立验证

| 门槛 | 结果 | 证据与限制 |
| --- | --- | --- |
| 生产构建 | PASS | C4 [BUILD.log](evidence/candidate-04/BUILD.log) |
| root定向回归 | PASS | C4 [ROOT-TESTS.log](evidence/candidate-04/ROOT-TESTS.log)，6文件128项；市场route、store、repository、HTTP client、startup、lazy-import |
| Task04独立验证 | PASS | [INDEPENDENT-REVIEW](evidence/task-04/round-02/INDEPENDENT-REVIEW.md)，19专用测试、8独立反例；实施者另15既有严格性、3隔离全量/合成验证通过。不是将这些不同执行合计成一轮全套测试 |
| 全项目类型检查 | FAIL（既有） | C4 [TYPECHECK-COMPARISON.json](evidence/candidate-04/TYPECHECK-COMPARISON.json)与baseline输出4197字节完全相同；Recall测试8项错误（1个viewport字段、7个ByRoleOptions.exact），无新增错误 |
| 真实导入持久化 | PASS（局部） | 1440桌面文件选择→2笔预览→确认→SQLite→交易库→reload，原1866行逐列保留；鼠标与键盘取消分开记录 |
| 导入预览视觉 | PASS（限定对照） | root直接比较同2笔有效/1标的/0重复状态的1440×1000及1280×800截图；720px弹窗、层次、操作可见，无新遮挡。独立审查亦查看1440图。1280使用仅预览的992交易ID，未保存 |
| 整页正常数据视觉 | NOT VERIFIED | 首页缺完整金额/曲线/持仓；重建baseline与C4财务状态不同，不能替代批准参考的正常状态 |
| 全部控件/完整首页范围往返 | NOT VERIFIED / 原范围切换FAIL保留 | [C4局部审计](evidence/candidate-04/CONTROL-AUDIT.md)；普通库Recall往返不等于首页scope合同 |
| 完整首屏≤1000ms | FAIL | 没有完整财务结果；资源体积、批量请求耗时、空态、骨架或HTTP200不作为通过 |

## 性能收益的实际含义

Task01三轮各236次真实HTTP请求，共708次：status/body SHA/缓存头/bytes/全部candles及证券ID等价。批量总耗时4491.379/4049.782/4124.240ms→3819.971/2866.941/2637.103ms，降低14.95%～36.06%。这是同数据236次串行读取的累计时间，**不是页面首开时间、单次p95或财务性能**。证据见 [Task01 root验收](evidence/task-01/candidate-02/ROOT-ACCEPTANCE.md)。

Task02 baseline首屏JS+CSS资源2,876,824 raw /806,403 gzip9 bytes，最终C4 2,427,780 /657,658；净减少449,044（15.61%）/148,745（18.45%），包含新增共享chunk，不能只计算移走的大文件。C4实际观察9个JS/CSS资源与C2同体积，未观察到dispatcher/SheetJS实现。[C2比较](evidence/candidate-02/BUNDLE-COMPARISON.md)、[C4资源与hash](evidence/candidate-04/VERSION-BINDING.json)。gzip为离线统一level9估算，不是实际transferSize；没有同态冷缓存HAR、脚本求值时间或合格1s结果。

| 已批准首屏场景 | 本阶段结果 |
| --- | --- |
| 冷浏览器完整首屏 | 未取得完整非零数据样本，≤1s NOT VERIFIED |
| 热浏览器完整首屏 | 未取得完整非零数据样本，≤1s NOT VERIFIED |
| 服务重启后首次完整读取 | 服务能启动，但完整数据≤1s NOT VERIFIED |
| 导入/修订后的首次完整首页 | 导入持久化已验证；完整财务首屏≤1s NOT VERIFIED |

baseline/C2实际显示timeout；最终C4直达A股首页显示来源证据警告、金额“—”、曲线“图表数据暂不可用”及严格来源0持仓，**不能说C4这张图仍是timeout**。原数据1784条nature未知＋82模拟，没有明确live；普通库兼容分类可见live232标的/732回合不代表严格首页应显示相同集合，也不能把切unknown仍0的旧观察统一归因live为空。未改性质或清洗成交。缺非零实盘金样及被暂停的财务工作是完整验收的未解决条件。

## 桌面对照与证据边界

C4真实桌面截图分别1440×1000、1280×800；DOM记录DPR1。[最终预览](evidence/candidate-04/FINAL-PREVIEW-VIEWPORT.json)还记录1440视口visualViewport.scale=1、rootZoom=1。不是窄屏验收；晚于截图补测的几何或zoom不会回填成截图当时已观测值。

重建baseline4393的881个app/scripts/db/conf/tests文件与冻结baseline一致，57份CSS源码及workspace编译CSS相同，但Tailwind扫描上下文造成global index CSS字节差异；[重建说明](evidence/baseline-reconstructed/README.md)、[GLOBAL-CSS-DIFF](evidence/baseline-reconstructed/GLOBAL-CSS-DIFF.json)。它是源码重建对照，不是原二进制复刻。root同浏览器1440几何对比中首页卡片/曲线/持仓坐标一致：nav72、top64、卡片x96/y124/w1320/h88、曲线x96/y226/w1320/h414.117、持仓heading y692.617；未复现旧约15px差异，但两边财务状态不同。不能关闭整页视觉门槛或断言旧差异根因已确认。

先前误命名1280的C4截图经DOM核对实际1440，已保留并改名`visual-candidate-import-repeat-1440.*`；另新tab真实1280后归档正确文件。候选1错误1440文件（实际1280×720）及C2所有FAIL/NOT VERIFIED均保留，不用后续成功改写历史。

## 预览与后续

当前隔离生产服务保留运行：[交易库](http://127.0.0.1:4392/trades)、[首页](http://127.0.0.1:4392/home?scope=live&market=a&accounts=*&rangeMode=all)。root最终真实浏览器查看交易库600330为36成交/12回合，并保存 [截图](evidence/candidate-04/FINAL-PREVIEW-1440.jpg)与AX；两个新增成交合入日期重叠既有回合，不能据此宣称新增回合或金额算法验收。

恢复相同产物与副本：`bash .scratch/homepage-one-second-development/evidence/candidate-04/START-PREVIEW.sh`（仅在4392服务已停止时；冲突即失败，不切业务库/端口）。常规开发启动`make dev`使用3333和新的在线备份测试库，不等于继续此C4实例。源未重建时沿用当前dist；如继续产品开发，须新候选绑定重验。

尚未接受的Task02/03保持open；下一步应先确定非零金样并完成首页范围往返、正常视觉与完整冷/热/重启/写后计时；涉及财务或Bars的实现必须等待用户恢复原暂停任务。没有push、merge或publish。
