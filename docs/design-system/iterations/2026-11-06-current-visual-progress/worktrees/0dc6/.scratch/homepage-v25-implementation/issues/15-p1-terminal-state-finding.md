# P1 发现 — 拒收及超时被期间区继续显示为加载

ID: P1-TERMINAL
State: open
Status: acceptance-failed
Assignee: /root
Implementation owner: /root/astra_source — gpt-6-astra / ultra
Parent: [P1](04-holdings-journey.md)
Iteration: inherited P1 3/3 FAIL; paused; no new repair allowance

## 触发、范围和原设计

来源恢复与状态接线开发触发前端控件审计；本发现覆盖非法scope零IO拒收、首次读取超时、旧数据更新失败，以及期间按钮/指标占位受影响链。准确要求沿[DESIGN-COVERAGE](../DESIGN-COVERAGE.md)：HV25-14/15/16/47–51，HOME-HP02-B001、HP09-B001/B028/B031；V2.5正文467–480/544–546及loading.svg/error.svg。原稿没有专门的非法URL画稿，不能伪造该参考。root拥有整页视觉及完整数据流，无授权视觉偏差。

## 复现与根因

真实1280×720/DPR2浏览器，`scope=sim`已被header解释性拒收且host零IO，期间按钮仍“期间数据读取中”并持续四张骨架。[截图与完整根因](../evidence/resume-2026-10-24/period-ui-final-design/implementation/recovery-identity/final-publication/hard-invalid-diagnosis/DIAGNOSIS.md)绑定当前Workspace来源。实际合法live首页超时也仍显示加载按钮，见[最终截图](../evidence/resume-2026-10-24/period-ui-final-design/implementation/recovery-identity/final-publication/root-independent/final-home-preview.png)。

host终态未传给期间显示，PeriodSurface将view=null等同于loading。现有测试验证零读取，却未断言终态下无loading。拒收问题是旧契约缺口，不将它错误归因于新recoveryActive字段。

## 后续统一设计与接受条件

未实施方案：用真实读取状态明确表达未开始、读取中、拒收、失败、有旧数据，整合期间按钮/指标/曲线呈现；不得靠延迟、假空数据或降低错误门槛解除。

恢复原任务后须独立验证上述完整状态、零IO、重试资格、旧数据保护及布局稳定；鼠标/键盘、指定桌面和响应式视觉分别记录。当前功能FAIL，完整持久化/全控件/视觉NOT VERIFIED。此发现不能另起轮数，依赖用户明确恢复P1。
