# Workspace测试API修正 — 有限验证

root诊断：本地Testing Library ByRoleOptions无exact参数，字符串name本身即精确匹配；9个TS2353阻止严格类型检查。原RED在feature evidence/P4/seam/tsc-initial.log，原文件before.test.tsx及before/after SHA保留CHANGE.json。

仅9处getByRole查询移除非法exact:true，name、业务断言、fixtures与产品源码不改；有效getByText exact仍保留。root新鲜精确两项测试2/2 PASS、100 skipped、exit0、12.02s，完整green-exact-pair.log。测试标题为TradeReviewWorkspace passes stored instrument metadata into the trading room scope、keeps unknown instrument metadata out of stock and ETF homepage categories。

此变更不是旧业务测试迁移第四轮，也不消除期间/历史/贡献返回FAIL。旧接受保留其原SHA，新文件SHA99d1cd4096dfd28c8ea42a8a3d5ed9b3c0c79390c66c0a1790a24438c2c2704e。共享财务owner修复新接口类型后再全项目strict tsc；目前全项目NOT VERIFIED。无UI/服务/数据库变更，此文档与测试API范围无需UI/数据库写验收。
