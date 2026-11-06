# P1 发现 — 财务核心通过后首页真实读取仍超时

ID: P1-HOME-TIMEOUT
State: open
Status: acceptance-failed
Assignee: /root
Implementation owners: /root/astra_source and /root/astra_finance — gpt-6-astra / ultra
Parent: [P1](04-holdings-journey.md)
Iteration: inherited P1/F07 3/3 FAIL; paused; no new repair allowance

## 范围与证据

首页真实来源→采集校验→表示编码/摘要→持有不可变来源→财务投影→UI发布。HV25财务与状态原合同、15秒截止、核心原2秒/200毫秒、64MiB及原金额字段不变。财务原9样本cold0.762–1.224秒PASS仅证明核心；[真实浏览器19.245秒](../evidence/resume-2026-10-24/homepage-timeout-stage-plan/root-execution/ROOT-RESULT.json)与[最终超时页面](../evidence/resume-2026-10-24/period-ui-final-design/implementation/recovery-identity/final-publication/root-independent/final-home-preview.txt)保持FAIL。

## 诊断和模块边界

[一次当前来源CPU诊断](../evidence/resume-2026-10-24/homepage-timeout-stage-plan/post-sample-design/cpu-attribution/ROOT-CHECKPOINT.md)完成；852源文件前后相同。complete/own主要已映射采样成本为SHA与序列化。Node发布前12.121秒没有运行React/UI发布，不能作为浏览器PASS；一个-3µs采样差值被排除，ledger分类路径不匹配，不能推出ledger为零成本。保留原profile和分析器，不挑样重跑。

[统一下一候选设计](../evidence/resume-2026-10-24/homepage-timeout-stage-plan/post-sample-design/DESIGN.md)将复杂度封装在既有摘要与编码模块：字节兼容的分块SHA、两个现有不同编码语法分别流式输出。保留所有验证、时钟、金额、receipt/carrier语义与旧bundle，不用revision替代内容，不延长deadline。方案未实施，收益未验证，不能保证消除全部成本。

## 后续接受条件

用户明确恢复原任务后才可实施；先固定字面摘要、UTF16/边界、金额时序与所有摘要消费者，再执行原固定性能样本及实际首页发布的独立验收。保持当前失败与指纹，任何新证据必须绑定版本和真实数据。UI终态呈现另见[同票发现](15-p1-terminal-state-finding.md)，两项必须都关闭，不能以快速显示错误代替正确发布。

历史真实接线及整页功能/持久化/视觉仍有后续门槛；此发现不授权越过P1最小真实旅程门，也不产生第四轮。
