# Root 最小真实 SVG 前置旅程：有限 PASS

2026-10-23，root。源版本绑定 MINIMAL-JOURNEY.md 的41501577…/55c15a9e…/34c7e477…，不是完整候选验收，历史图仍0/3。根目录3334/history-minimal.html使用受控字面fixture，真实产品SVG；无mock chart，无DB/财务聚合。

真实1440×1000/DPR1：原币0与-12345.678900点位置和断线可见；鼠标点击3月实际点，完整日期区间/Asia/Shanghai/精度原值/来源读数出现。原生Left移至2月no-round缺口，缺口无circle且原因明确；Esc移除读数和十字线、焦点仍在2月，无跳转。真实390×1000原生combobox→Tab首点→Esc，四模式分别读0 CNY / 98765.432100 CNY / 12.345% / 3回合；图卡始终320px，同plot边界84,66,326,276；页面scrollWidth390。root直接看1440默认图与390读数图，读数位于图卡后的正常文档流，未覆盖曲线。

证据在 evidence/continue-2026-10-23/history-minimal-*。最初history-minimal-modes.json是按Tab进入第二点，expected只是测试目标并未命中；history-minimal-known-modes.json后3项因Esc保焦点再Home未重入而无读数，两者保留，不计已知点PASS。最终正确原生combobox→Tab路径见history-minimal-native-tab-modes-390.json，每个实际值与目标完全相符。不能把前两轮操作错误当产品通过或隐藏。

允许同owner继续候选1原HC矩阵TDD与视觉候选完善，非最终历史图接受。独立字段、future/loading/error读数屏蔽、完整状态/年范围/极值/来源安全/motion/响应式原图比较仍未验证。没有hover计时、触控或全年金融结果证明；最终需要独立完整检查，不能以此有限gate替代。
