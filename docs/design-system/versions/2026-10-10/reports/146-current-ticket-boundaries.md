> 归档副本（2026-10-10）。以下原结论保留原时间和范围；标注“本地历史记录”的文件未随远端归档。当前版本入口见 [版本说明](../README.md)。

# E146：11票有限接受与工程门禁

2026-10-10。当前66行有限UI登记 **64 PASS / 2 NOT VERIFIED / 0 FAIL**，工程检查 **E149限定PASS**（历史失败保留）。这两个分母分开，不能声称功能完整交付。只整理既有证据，未操作浏览器/数据库或修改产品。root实际动作与非实现者像素复核各按原范围引用。

当前版本：[freeze-141](freeze-141.json)32文件，Canvas `0f450bfcf31fd0ef50817a0259f5e325af51b9a77ab7b96792ca3c4ab21a9ecd`；此次只读核对32文件均相符。未受修改影响的旧证据按CONTROL B/F/L范围复用；不是在最新版本重跑全部旧动作。

|票|当前有限结论|证据与未验证边界|
|---|---|---|
|DCA01 Esc取消选择|scoped accepted|E85/87/91/100/133选择/拖动Esc；新短箭头代理由E140/141单独闭合，不掩盖E136历史反例。|
|DCA02 零长度创建|原缺陷scoped accepted|E69/101首点/取消，E136同点双击无新增、正常创建/Undo；E140/141真实首点/预览/创建及过程录像保留。连续全部中间帧不能只凭录像文件存在算通过，按独立视觉实际核阅范围接受，不扩充速度组合分母。|
|DCA03 通道残留|scoped accepted|E71/82创建/几何；E101基线/宽度阶段切工具、重开、Esc，无新增反例。|
|DCA04 菜单裁切|scoped accepted|E25–28七项鼠标/键盘，E100关闭回焦及邻接；无新增反例。|
|DCA05 文字选择回流|scoped accepted|E105/120同宽同态、E131/132长文末行与独立视觉；非空草稿历史另见DCA11。|
|DCA06 编辑器重叠/样式|scoped accepted|E50/55/56/119/121字号/颜色/宽度/背景实际入口，完成/重开/取消；E131/132长文。无穷组合不在分母，真实IME仍K02 NV。|
|DCA07 价格批注|scoped accepted|E80/83锚点价/bar与两点，E110/123/133框锚分离/取消；共享导航由E144/146有限闭合。|
|DCA08 光标/命中|有限功能接受；原生OS指针逐帧NV|E81–90/99/100动态几何及CSS，E106/107模拟环境，E130 fallback邻接四柄，E137边外15px/边内2px及锁定。computed CSS cursor不能冒充系统指针像素。|
|DCA09 短箭头终端|scoped accepted，E136 FAIL保留|E140/141短箭头keyboard选中两柄/终端可辨，代理避让；Esc代理opacity0/pointer-events none；[独立像素报告](e119-e126-independent-visual-review.md)有限PASS。G02/K01闭合，非全角度/全设备接受。|
|DCA10 密集标签|scoped accepted（所测小RR/fib/长数值）|E130四柄/fallback顶部底部，E137中段，E141真滚112完整风险百分比；E142普通/选中375R，held实际1.99R及完整当前读数，恢复reload独立像素通过。不写held375R，不穷举所有数值。|
|DCA11 非空草稿历史|scoped accepted，E138 FAIL保留|E140/141 enabled Undo保留草稿；E145实际Undo→Redo→再Undo保持全文并回退/恢复既有命令，root有限接受。E137 disabled不是Undo证据；E145结尾STOPPED仅导航时序断言。X04闭合。|

## 保存与清理

E144（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/144-preview-save.json`）：真实500后留页，重试200后索引、返回reload；E143原脚本因期待自定义“143”错误文案而实际通用500提示停止，原文件保留。

E146（本地历史记录：`.scratch/drawing-control-fix-20261009/evidence/146-immediate-save.json`）：DOM记录trusted index click **3961ms**，早于PUT开始4264ms；PUT200为6141ms，index抵达8806ms，随后返回reload成功。events中的index-click3981是工具返回记录，不能替代clicked.relative3961。E145原末尾因工具记录晚于PUT而断言STOPPED，不当产品FAIL；其非空Undo/Redo及返回reload是独立有限PASS。

只读JSON对照143before（本地历史记录：`.scratch/drawing-control-fix-20261009/reports/143-db-before.json`）→144after（本地历史记录：`.scratch/drawing-control-fix-20261009/reports/144-db-after.json`）：rev363→364、bundles33→34。144→146after（本地历史记录：`.scratch/drawing-control-fix-20261009/reports/146-db-after.json`）：rev364→368、bundles34→36（root记录E145/146各新增一次）。两段`working`、全部`phase_contexts`、`decision_drafts`、`editing_context`、计划/计划关联hash逐项相同，transient均[]。没有源表统计，因此不声称整库不变。E139新增留存成功的历史结论也保留。

E140上下文销毁、E141末尾reload超时、E142过早baseline=[]导致最终10对象不等、E145时序断言均保留STOPPED；不以有效局部证据修改整脚本结果。E140–144追补（本地历史记录：`.scratch/drawing-control-fix-20261009/reports/144-current-evidence-supplement.md`）是当时等待记录，本页为后续有限闭合。

## 工程和环境门禁

- typecheck/build/runtime root记录exit0；scoped lint 0 errors / 9 warnings，不是全局lint PASS。
- `root-141-full-unit.log`：6 failed / 319 passed / 3 skipped文件；50 failed / 3179 passed / 6 skipped测试，失败保留。
- root-146-full-unit.log（本地历史记录：`.scratch/drawing-control-fix-20261009/reports/root-146-full-unit.log`）：不改timeout/source、`--maxWorkers=2`且不与build并发，最终3 FAIL / 3226 PASS / 6 SKIP测试、1 failed / 324 passed / 3 skipped文件，455.32s。失败集中于trade-review-workspace.test.tsx，历史失败保留。
- [E148诊断](root-148-trade-review-diagnosis.md)：3项默认超时单worker全PASS，整父测试文件91 PASS，无代码/测试修改；符合资源/调度竞争解释，但未证明唯一原因。随后[E149全量](root-149-full-unit.log)在`--maxWorkers=1`下完成：325 passed / 3 skipped文件、3229 passed / 6 skipped测试，803.39s，exit0；32文件冻结hash相符。当前限定工程检查PASS，不借定向通过或旧3220全绿覆盖，历史并行失败保留。
- K02真实中文IME、R03物理触控/软件键盘仍NOT VERIFIED；OS原生指针逐帧也保持未证。桌面鼠标/键盘和模拟环境有限PASS不会关闭这些真实环境缺口。

当前桌面有限UI及限定工程检查接受见[E149最终概览](149-final-acceptance.md)。typecheck/build/runtime/scoped lint PASS；scoped lint9warnings、全仓lint历史失败保留。环境NV不变，不宣布全环境100%完成，不执行提交/推送/合并。
