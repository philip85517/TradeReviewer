# 最小真实纵向实验能否支持扩展优化

ID: homepage-one-second-vertical-prototype
Labels: wayfinder:prototype
Parent: [首页一秒打开优化与验证决策地图](00-map.md)
Mode: HITL
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: 主协调者
Resolution comment: 尚无

## Question

所选路线在一个默认真实范围内，能否同时实现正确财务、真实首屏及一秒打开，并给出支持或否定扩大投入的证据？原型用于讨论可行性，不以“原型”豁免真实数据、版本或视觉合同。

## Scope

- 按实验选择的授权，使用隔离数据库、非零业务样本及已批准桌面视口，建立最小真实浏览器旅程；链接可丢弃原型资产和试用入口，邀请用户实际反馈。
- 同源比较当前路径和实验，运行已冻结冷/热、重启首读及写后首开状态；本地输入齐备时的内部未命中/重建仍计时，不能只展示持久投影命中。
- 以相同generation关联服务端版本检查/查询/构建/编码、传输、浏览器解析/校验、真实图表paint和交互；保留每次结果，不把父子span相加。
- 验证默认范围的成交修订/删除、行情与FX修正、构建中写入、旧响应迟到和恢复，至少能证伪核心版本协议；完整任意范围覆盖留到正式计划，不伪称本票已证明所有组合。
- 财务正确性、状态/持久化、视觉、性能分别记录；历史/其他现有失败影响整页时保留，不以本票局部接受关闭产品。
- 本票的接受对象是已授权实验协议是否完整执行、证据能否支持或否定假设，以及用户真实反馈。候选实现的接受与轮次属于实验选择中指定的原实现/执行票：性能FAIL可以形成完整反证，却不能因此关闭实现票或解除暂停。若协议要求的采样、持久化核验或独立视觉审查未执行，本决策票也必须保持open/NOT VERIFIED。

## Refs

- [验证路线与证据格式](../VALIDATION-ROUTE.md)、[设计覆盖](../DESIGN-COVERAGE.md)。
- [既有完整样本局限](../../homepage-timeout-funnel-2026-10-24/DIAGNOSIS.md:110)、[领域金额与来源约束](../../homepage-one-second-feasibility-2026-10-24/FEASIBILITY.md:60)。
- [原始桌面主页图](../../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/home-1440.svg)、[1280主页图](../../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/home-1280.svg)、[历史展开图](../../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/home-history-1440.svg)。

## Blocked by

- [最小实验选哪条路线及如何处理已暂停任务](05-experiment-choice.md)

## 验收标准

- [ ] 主协调者独立运行默认范围的真实数据完整旅程；保存环境/版本、原始trace、逐次值、截图和真实输入证据。
- [ ] 已冻结矩阵各项PASS/FAIL/NOT VERIFIED明确；任一必测样本>1000ms、金额错误、错误版本或未接线不得记作性能成功。
- [ ] 完整执行写入后返回、reload及实际隔离库持久化核验；独立非实现者在匹配桌面状态比较原图与渲染，结果逐项保留PASS/FAIL/NOT VERIFIED。
- [ ] 用户真实试用/证据反馈写入独立Resolution，并据实说明可支持的下一步；反证也可以完成可行性讨论，但原型成功门槛仍保留FAIL，不能关闭产品票。

## 反例与证据

只展示mock图、HTTP成功、零group、React提交或热memo均不接受。每个候选最多3轮；第3轮后仍需继续改动才能达标，则暂停相应候选实现，保留其open/FAIL、进展和未通过原因，不自动切换新名继续。协议已完整执行且用户实际接受否定结论时，可独立接受本票的决策证据并记录负面Resolution，进入正式迭代选择讨论停止或取舍；此关闭不增加代码修改授权。证据不足则本票继续open，不靠反证措辞补齐未验证项。
