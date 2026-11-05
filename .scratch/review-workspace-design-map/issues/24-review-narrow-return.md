# 窄屏提示的返回阅读页未完成导航

ID: review-audit-24
State: open
Status: acceptance-failed
Assignee: unassigned
集成负责人: coordinator
Priority: P2
Blocked by: 根因未确认

## 范围与依据

候选版只要求 390×844 窄屏提供诚实提示和可返回的路径，不要求完整移动端工作区。见[本轮覆盖合同](../evidence/independent-acceptance-20261104/DESIGN-COVERAGE.md)与[布局合同](../evidence/immersive-layout/DESIGN-COVERAGE.md)。本票记录实际审阅发现，不构成修复授权。

## 复现与结果

candidate-v37、合成数据，CSS 390×844：窄屏提示与“返回阅读页”链接均可见，键盘可聚焦；未参与实现的审阅者在 Chrome 对链接按 Enter，浏览器跳转到 `README.md` 后显示 `ERR_BLOCKED_BY_CLIENT`，未出现可阅读文档。见[真实浏览器可访问性记录](../evidence/independent-acceptance-20261104/workspace/43-390-return-link.ax.txt)和[截图](../evidence/independent-acceptance-20261104/workspace/43-390-return-link.jpg)。协调者在独立 IAB 标签用鼠标点击同一链接后，仍看到窄屏提示和原页面 URL，也未完成返回；该辅助观察未保存截图。因该轮预览环境无法完成可返回旅程，I38 的本轮返回要求 **FAIL**；不推断其他部署环境必然失败。

预览服务对目标 `README.md` 的 GET 返回 `200` 及 `Content-Type: application/octet-stream`；这只是排查线索，无法单独证明浏览器拦截或不跳转的原因。浏览器策略、下载行为与服务响应的具体作用仍 **NOT VERIFIED**。

## 验收标准与反例

- [ ] 在当前预览服务及适用浏览器中，从 390×844 提示通过鼠标和键盘到达实际可阅读的目标页面；记录最终 URL 和可见内容。
- [ ] 明确返回目标、响应类型与浏览器行为的关系，并保留本次失败证据；不要以链接可聚焦或 HTTP 200 代替完整导航成功。
- [ ] 返回桌面宽度时工作区仍可重新审阅；完整移动端适配和物理触屏单独记录为未验证。

## 2026-11-05 候选复测

[candidate-18 限定验收](../evidence/systematic-fixes-20261105/task-07-candidate18/REPORT.md)在当前预览服务的 390×844 下通过鼠标、键盘、阅读滚动和历史后退；返回桌面宽度后图表恢复。旧 Markdown 导航失败的完整浏览器机制、物理触控及整页验收仍未验证，原 FAIL 保留。
