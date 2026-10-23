# Root 独立接受 — ETF 有界测试迁移

2026-10-23 10:34 CST。仅接受本次测试消费者迁移，不是P1/P3/整页功能接受。root已独立直接读实际ETF-only.patch、IMPLEMENTATION-READY、冻结前后hash与CHECKS，并运行精确原ETF/新增unknown两用例：ROOT-exact-pair.log，2 PASS / 100 skipped，exit0，10.94s。当前文件SHA256 1fbb9dc85466ed0677c4ef654631a6b83274ed7ff5753b871b1fe011ecd5b9af与冻结一致。

业务断言保留：存储ETF元数据必须传入真实主页持仓、筛选草稿不提前应用、Apply才更新标签与真实行、准确持仓详情显示ETF，股票筛选排除ETF；外观名称像ETF但无可信元数据仍未知且股票/ETF均排除。原fixture补显式live源符合现有eligibility；新增初始findByRole仅等待真实行，不放宽业务期望。现存sharedsetup/原return等100用例未改，CHECKS的完整prefix/suffix字节一致。产品/config无本迁移改动。

本范围代码审查与精确消费者验证PASS。文档/测试改动本身无UI运行时变化，浏览器/DB写入为NOT APPLICABLE（不以此取消整页原有UI/持久化门）。原return/period/history/contribution失败及PendingFact caveat原样保留，P1正式2/3 FAIL、P3正式0/3和整页NOT VERIFIED不变。此结果不增加或重置正式轮次，也不冒充原102全文件绿。
