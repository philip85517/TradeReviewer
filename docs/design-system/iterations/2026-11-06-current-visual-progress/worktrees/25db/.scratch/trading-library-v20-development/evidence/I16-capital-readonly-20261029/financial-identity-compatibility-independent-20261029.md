# I16 六份来源逐身份财务及旧客户端兼容补验（2026-10-29）

本报告补充并保留 `financial-production-wiring-independent-20261029.md`，只涉及授权的六份来源和当前本地代码，未修改原文件、产品代码或业务库。独立构建隔离 SQLite；以下通过不代表统计页面、真实浏览器、生产网络、正式迁移或整个 I16 验收通过。

## 六份逐身份核对：PASS

探针从各份 CSV 原始字节的 SHA-256 建立身份，使用独立 Python 标准库 `csv` + `decimal.Decimal` 对每个报表编号核验恰一进一出、同方向同数量、双行净额与费用相等、价差×数量−一次手续费与报表净额误差不超过 0.01 CNY，并逐组各取一次求出每个来源自身的净额与费用。预检/提交走当前真实进程内 route，保存返回的 practiceId、revisionId 与来源字节指纹；关闭数据库重开后，从 detail 验证对应 revision 和持久字节 hash，再从 V2 统计客户端按 practiceId 找同一 revision 与 sourceId，逐一对比该来源独立计算的净额、费用及收益率。本报告不展示来源名称、账户或财务数字。

首次读取六份各自均使用 100000 CNY 内建默认本金；之后对其中一份设置 50000 CNY 单练习覆盖，同时全局改为 200000 CNY，关闭重开后逐身份确认该练习使用覆盖、其余五份跟随全局，并以每份自身独立算出的净额÷各自有效本金×100 验证收益率。六份回撤均未知。测试直接调用本金 store，不证明用户设置 UI。

## 旧客户端与新版：PASS（当前路由分流），直接接收 V2 为预期拒绝

- `app/lib/storage/practice-statistics-http-client.ts:52–70` 的旧客户端实际请求不带版本参数的 `/api/storage/practices/statistics`，`app/api/storage/practices/statistics/route.ts:29–46` 为它返回旧合同：`financial` 始终未知，并不附加新版 `financialV2`。独立测试在六份数据已具备新版已知结果的情况下实测该旧请求成功，六个 practice/revision 身份正确；旧客户端本身只暴露身份、本金等旧字段，不提供新版净额。
- 页面当前 `app/components/library/library-practice-statistics.tsx:358` 实例化 V2 客户端；`app/lib/storage/practice-statistics-v2-client.ts:144–168` 请求 `?version=2` 后剥离 `financialV2`、构造旧响应，由旧客户端验证旧部分，再由 V2 客户端验证并保留新财务数据。上述逐身份测试实际走此完整路径并成功。
- 独立反例直接把六份已知净额的原始 V2 响应送入旧客户端，旧客户端以 `invalid-response` 拒绝：它在第 65 行要求精确旧响应字段。**它不能直接消费 V2 响应**，但本次检索 `app` 非测试文件未发现实际旧客户端直接请求 V2 的调用路径；当前实现通过路由分流与 V2 包装兼容。以后切换路径或向其他旧消费者直接下发 V2 时须另作版本协调，不能把此反例视为当前路径故障。网络缓存、独立部署和外部旧客户端未验证。

## 复现、版本与限制

```sh
I16_REAL_SOURCE_DIR='/Users/zhoulin/Documents/模拟交易复盘' TRADEREVIEW_DB_PATH=/tmp/i16-identity-independent-unused.sqlite ./scripts/native-node.sh node_modules/vitest/vitest.mjs run --config .scratch/trading-library-v20-development/evidence/I16-capital-readonly-20261029/financial-identity-compatibility-20261029.config.ts
```

单 worker：1 文件、1/1 PASS（该综合测试包含六份逐身份、两次本金状态和两种旧客户端路径），3.27 秒。脚本使用 `mkdtemp` 新库，结束关闭并删除；源文件只读；敏感值仅在进程内，不打印。日志 `financial-identity-compatibility-20261029.log`；测试 SHA-256 `e7c54c740131d30e3876e67cee17051202eb806c0efe8cca8f71405e3d4d459e`；配置 `892b5bcb767392e18b3becbcd6697fd3d0565af2102fc3437a8e0af25d869dac`；日志 `e08002407c477e2a4ccdd662e96eabcfd3b0f6ac14e1b14aa3afd328ae6a0675`。8 个关键源码运行前后 `shasum -a 256 -c financial-identity-compatibility-before.sha256` 全部 OK；该指纹文件保留精确源码版本。

未做真实浏览器与页面设置交互，未测试所有历史客户端版本或网络代理对版本参数的处理，原作者报告的全项目 typecheck 失败状态不因本补验改变。
