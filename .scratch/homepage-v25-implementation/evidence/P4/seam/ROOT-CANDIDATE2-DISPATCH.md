# Same seam candidate2：四个确定性边界错误及性能归因

2026-10-23 root；owner /root/finance_calendar_resume，实际gpt-6.1-sol/ultra；同票1/3 FAIL，下一次正式接受2/3，不重置财务A恢复计数。先读ROOT-ACCEPTANCE-1、独立source review、root真实反例与原ROOT-DISPATCH及其准确批准spec/refs。原SF01..08/需求映射不变；root独立接受并拥有完整数据流/整页视觉。

唯一产品写权限仍为ledger及test、homepage-v25-performance及test；证据新增candidate2/。UI/series/S/host/DB/IPO cost/calendar及共享tracker禁止写；不得再派代理，不写producer，不搭车新增FX接口。已有候选1/全部原FAIL/基线快照不得改。

1. 先将ISR01..04转为真实公开接口RED，逐字段literal断言，原244测试断言保留。ISR01复用已存在的prefix判定与exact replay。ISR02表达字段依赖：原始费用总额独立可知；数量、matching、pool lineage决定各分配字段，不给未知角色认证0/2，也不粗暴抹掉所有独立known。ISR03缺episode关联unknown且canonical财务保留。ISR04独立解释episode endedAt，instant/日/月精度只按实际证据比较，不带入fill.tradingDate覆盖声明；保持未来episode未完整可见的适用边界，缺optional endedAt不自造冲突。
2. 一次一个根因RED→最小GREEN，保留每次日志；原engine方程/unknown政策不变。禁止第二ledger/lot/pro-rata/任何业务语义性能捷径。
3. 性能先诊断，尚不授权猜测优化：制作只加载既有seam input-position-ledger.ts/input-homepage-v25-performance.ts两接受快照与当前候选的同一测量器；完整原1866×365三形态，fresh进程交替baseline→candidate、candidate→baseline各一对，固定进程隔离、计时边界/oracle/预算不变，所有样本全留。先读源差异提出单一假设/最小采样方案并报告root，**等待root安静窗口**再执行，不能与UI测试/build并发，也不重复到通过。结果仅诊断不代正式九样本。未经定位不加优化补丁；基线也慢如实报告，不降低2000ms或64MiB。
4. Scoped回归/strict/lint、公有字段等价及cache无新增保留；产品与测试hash/diff/未验证项冻结。正常A不请求facts不建graph。root独立原九样本后才接受性能。测试/诊断安排与root协调。

本票纯数据接口，UI/DB写NA有范围依据；producer与整页门不因此通过。第三次FAIL或requiredNV暂停并记录，禁止第四候选。
