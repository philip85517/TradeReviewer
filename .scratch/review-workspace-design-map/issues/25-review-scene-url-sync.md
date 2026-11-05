# 切换交易回合后场景选择与 URL 不一致

ID: review-audit-25
State: open
Status: acceptance-failed
Assignee: unassigned
集成负责人: coordinator
Priority: P2
Blocked by: 无

## 范围与依据

审阅原型合同要求场景、URL 和揭示画面一致，分享并刷新时保持所选视图；内存草稿在刷新时重置。见[W12](../evidence/immersive-layout/DESIGN-COVERAGE.md)、[R05](../evidence/immersive-layout/revision-01/DESIGN-COVERAGE.md)及[I28 登记](../evidence/review-fixes-20261028/CONTROL-INVENTORY-FINAL.md)。本票只记录验收发现，不构成修复授权。

## 复现与结果

candidate-v37、1291×800 CSS：从 `?variant=A&scene=exit` 的结束场景展开左栏，切换第 2 次或第 3 次交易后，页面、图表和审阅选择器均显示“买入前”、28 根，地址栏仍为 `scene=exit`。未参与实现的审阅者独立记录了[切换第 2 次](../evidence/independent-acceptance-20261104/workspace/42-1291-trade2.ax.txt)和[切换第 3 次](../evidence/independent-acceptance-20261104/workspace/42-1291-trade3.ax.txt)。I28 的场景与 URL 一致性 **FAIL**。

协调者另在 IAB 新标签复现第 2 次交易的相同切换并实际刷新：切换后是 28 根“买入前”，URL 仍为 `scene=exit`；刷新后按原型约定重置内存样例，但界面回到默认样例的 49 根“结束之后”。该次辅助观察仅保留会话工具输出，未保存截图。这里的问题是切换后的场景与链接不一致；原型刷新不持久化草稿是已说明的范围，不应误记为同一故障。


## 2026-11-05 候选修复及复测

用户授权修复后，candidate-04 已将回合切换及回放、日期的阶段变化同步到 URL；三初始阶段 × 三回合、1291/1292、实际 K 线与成交、回放、日期、刷新及外部历史路径已按限定样本复测。独立静态画面检查未发现新增主要视觉问题。详见[分项验收](../evidence/systematic-fixes-20261105/task-03-final/REPORT.md)。原生场景下拉真实选择在当前浏览器通道仍 NOT VERIFIED，故本票继续开放；分享 URL 只保留阶段，不保留交易回合或精确 Bar 截止。原始 FAIL 证据保留。

## 验收标准与反例

- [ ] 在结束、持仓和买入前分别切换各交易回合，当前场景选择、URL、图表揭示和右栏一致。
- [ ] 分享和刷新后重新打开的场景与切换后 URL 所描述的视图一致；明确示例回合与内存草稿是否重置，不伪称业务持久化。
- [ ] 覆盖 1291/1292 两侧与桌面视口，记录切换前后 URL、阶段和实际 K 线/成交可见性。

反例：只让下拉框显示正确，地址栏仍指向旧场景；或仅修改 URL 但图表仍揭示不属于当前阶段的成交。
