# 我的交易室 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development with the user-authorized disjoint parallel Luna max workflow.

**Goal:** 实现已批准的交易室、数据管理、汇率/本金统计并完成独立QA。
**Architecture:** 统一scope和资产类型投影为所有视图提供同一数据范围；FX和本金使用独立持久化契约；dashboard装配和workspace装配由各自单一Luna负责人串行修改。
**Tech Stack:** React 19、TypeScript、vinext/Vite、SQLite、Decimal、Vitest。
**Spec:** docs/specs/2026-09-19-trading-room-homepage.md

## Global Constraints

- 全部开发和独立QA使用gpt-5.6-luna，reasoning_effort=max，子代理不再派代理。
- 原始交易不改写；写入验收使用隔离SQLite一致性备份及独立端口。
- 不推送/合并/发布。保留原有工作与历史服务。
- 不混币种、实模拟、模拟运行；未知不当零；ETF四类互斥。
- 同屏金额使用同一最新汇率快照；不建立历史汇率库。
- 默认实盘/全部/本月/趋势；不得输出账户总资产或跑赢大盘结论。
- 项目AGENTS的并行开发、集中全量测试和交付流程优先于通用skill的串行/每代理全量建议。

## Review Focus

- ETF元数据没有投影、未知误作股票 → 01分类测试覆盖。
- 跨期完整回合买入成本、IPO/期初/做空不可信 → 06相同样本分子分母测试。
- 汇率刷新不同步/缺币种/旧缓存 → 03快照与失败回退测试，04/06集成验收。
- 日期筛选误隐藏当前持仓、返回丢状态 → 05端到端导航验收。
- 本金缺填或局部筛选分母过小 → 07本金矩阵与09真实UI验收。

## Execution

批准的一票一文件规格在 .scratch/trading-room-implementation/issues/01–09。
每票派发briefs/<NN>.md明确文件所有权、输入/输出、禁止项、报告路径；它与票和spec共同构成完整实施说明。

- [ ] 01 scope + 02 navigation并行，先完成基线。
- [ ] 验收01/02；03 FX + 05 holdings并行。
- [ ] 验收03；04 calendar + 06 metrics并行。
- [ ] 验收06；07 principal + 08 quality按可用文件所有权调度。
- [ ] 集中全量测试、类型、构建、必要运行时测试。
- [ ] 09独立Luna UI/spec QA，缺陷由开发者修复并复验。
- [ ] 协调者独立浏览器复验、核对原始数据哈希、保持预览运行并交付。

每个实现任务TDD步骤：读现有行为和输入事实→写可观察失败用例→记录红测→实现最小功能→跑定向绿测→自查→提交report。协调者基于真实diff与report审查，未达spec返修，不把自述当完成。
共享文件禁止多代理并写，不用git commit收录别人的进行中工作；所有变更留供当前任务审查。
