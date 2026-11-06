# Candidate 1 限定性质协议验收

2026-10-24，root独立验收；实现nature_contract_implementation、静态审查nature_contract_research均为gpt-6.1-sol / ultra。首轮1/3接受，未要求第二轮产品修改。

**本票性质协议通过。完整首页、财务完整性、1秒性能与全项目发布仍未通过。** 原财务P1/F07、Bars维持暂停3/3，原失败记录及Task02 2/3、Task03 1/3不重置。

## 变更及根因

旧库将非TradingView来源默认为live，新首页读显式性质，缺失字段的1784条券商/人工历史数据被读为unknown。统一纯读取业务resolver：精确解析规则和指纹证据合格的历史券商成交可识别live；无证据、显式unknown、冲突、混合回合均失败关闭。业务性质与历史身份键分开，旧scope/episode ID和成员不重建。持仓同一业务组多个原carrier保留原关系，导航仅指向唯一匹配回合。留存recall继续读取捕获证据，不随当前规则重解释。

## 独立验收门

|门|结果|执行证据及边界|
|---|---|---|
|代码/规格|PASS|REVIEW-independent.md；root另行核对resolver、身份/分组和消费者边界|
|独立回归|PASS|REGRESSION-root.log：18文件627测试通过，含性质、混合证据、scope/identity、回合、持仓、现金和retained view-source|
|lint|PASS|LINT-root.log，退出0；14项既有warning保留|
|构建|PASS|BUILD.log，退出0；构建后4392隔离服务启动|
|全项目typecheck|FAIL（既有）|TYPECHECK-root.log：recall-integration.recall-review.test.tsx的8项viewport/exact类型错误，候选未改该文件；不宣称整项目检查通过|
|实际数据性质|PASS|VERIFY-projected.log/VERIFY.json：1868笔→1778live、84simulation、6unknown；首页projected selectedEntries232，不再为0；不等同于普通库226个原始carrier组|
|历史身份/原数据|PASS|BASELINE.json与VERIFY.json：764个回合ID及成员完全相同，digest c6b9c2990a8bc8c13880afd2afc945f495dc97594905a0bb331849e46e41989c；原库executions1868/import_batches214/trade_revisions11/reviews138逻辑摘要不变|
|桌面功能|PASS（限定）|CONTROL-AUDIT C01–C08；普通及首页进入实盘库226标的726回合，模拟4/32、未知6/6；真实单回合进入、返回、首页进入和刷新|
|桌面视觉|PASS（限定）|root直接比较1440×1000前后截图并检查1280×800；原层级/几何/密度保持，数据收紧有解释。未覆盖窄屏/触控/所有控件|
|隔离浏览器状态安全|PASS（有记录的既有写入）|FINAL-INVARIANTS.json：原始诊断库全文摘要保持；隔离库成交/导入/修订保持。复盘入口使2条reviews.updated_at变化，其余review字段全部不变，PREVIEW-REVIEW-DIFF.json保留明细。未以“所有字段零变化”掩盖此现象|
|首页完整财务态|FAIL（暂停事项）|home-settled-AX.txt/jpg仍显示“读取已超时，新范围未应用”，当前指标—、持仓空槽；探针representation仍unknown，不伪造complete；不宣称首页已恢复|

原始探针验证两次失败分别来自root验收脚本漏await及未按实际管线使用projected entries；修正验收脚本后VERIFY-projected.log通过，产品未为探针修改，旧VERIFY.log/VERIFY-rerun.log保留。这不是两轮产品候选迭代。最后数据检查初次断言“隔离reviews全字段不变”也被真实updated_at变化推翻，随后按列检查保留差异，内容与原库不变性才是最终结论。

## 版本、运行和限制

VERSION.json固定HEAD 58bf0d90e68ddc634de180b3f5c3d16a089f0eb3及所有app/build文件。sourceDigest c83eb5797bfdc30ebf674ce94a24a3f56774fb2f205072bb5f515b29aeb4366c；buildDigest 4cdacf39e1ee22aaf636b4b58650853aa0bb1a4789b2af9861c6394cc98a4a5e。FINAL-INVARIANTS再次逐文件验证一致。预览仍运行：[桌面实盘交易库](http://127.0.0.1:4392/trades?scope=live&market=all&accounts=*&rangeMode=all)，最后真实浏览器检查并截图final-desktop.jpg，保留1440×1000桌面视口。

数据库明确为evidence/preview.sqlite，通过WAL-aware online backup从既有C4隔离验收库复制，不是实时业务原库；README提供停止后的启动指令。浏览器核心写流程、留存更新编辑、行情播放均未在本票验收，后者受Bars暂停约束。旧retained nature与新working nature不同可能触发原update-authority保护，需要回工作图重新留存；未改写旧留存或绕过保护。没有提交、推送、合并或覆盖其他dirty work。
