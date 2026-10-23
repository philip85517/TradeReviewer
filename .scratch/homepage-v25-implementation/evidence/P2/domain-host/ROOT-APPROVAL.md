# Root implementation approval

2026-10-23; actual gpt-6.1-sol / ultra; new capability 0/3, no reset of P1 2/3 FAIL or any leaf round.

Approved proposal: `INTERFACE-AND-ATOMIC-COMMIT-DESIGN.md`, SHA256 `f84cbf3e5483ae03af73dbe1cee6688cb311dc16ea102b3f2423ef180f383e43`.

Root explicit message:

> root已完整读接口提案并核对当前session/host边界，批准按提案进入真实RED→产品实现。批准仅适用于新增configured三域路径：严格原始15000ms绝对deadline+响应时截止；unconfigured旧15010政策保留，不能将其算新修复或消除旧FAIL。S仍唯一接受权威；global开始先cancel P/H，单次session提交全包，legacy onReadAccepted只global。请在evidence记本批准/提案SHA。额外必须实际测：fromGlobal抛错不发布半包且旧label/data保留；domain accepted callback抛错不能反转已accepted状态；collection-only保持两个home槽；global source恢复后ranges与真正提交snapshot一致。4文件唯一owner不变。HistoryStats第一轮将正式FAIL，保持冻结；等host候选冻结后再派同叶第二轮，不交叉编辑。

No subagents, commits, services, database, browser or performance commands. Four source/test files only plus this evidence. Root independently accepts after freeze.
