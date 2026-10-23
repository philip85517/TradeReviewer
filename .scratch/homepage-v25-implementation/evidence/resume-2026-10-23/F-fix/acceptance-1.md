# F 恢复第1轮独立接受：PASS（仅纯财务合同）

2026-10-23 01:10 CST；协调者 /root 独立执行与代码审查。恢复轮数 1/3；历史第3轮 FAIL 不覆盖。本轮不接受 UI、逐日序列或整页功能。

冻结 source `f1b493d77e6963f35a99ca15b4b5ac8756577c327205a82f87617c76b12ce2d1`，同名 test `fa853b632b6d7c01b8e9befa7abef60ec56c48c96e703a8666e364cbf656f6f8`，复验后与owner交付冻结一致。运行环境固定 Node26 / SQLite3.53 / Vitest4.1.10。配置、日志、指纹见 ../coordinator/F-acceptance-1.*。

- 原四真实边界、恢复10根因反例、root4合同、IPO10分项、peer5独立反例、同名69项及五个共享领域邻居，共12文件277项，全部PASS；exit0，5.98s。
- 协调者独立继承根strict选项检查F源码及同名测试完整依赖，tsc exit0；双文件eslint exit0。
- 逐行审查全模块及IPO根因报告：成本、毛实现、数量仍由canonical position ledger提供；F只分配费用池，原始execution lineage去重，上海日/独立asOf截断与来源证据、unknown数量/成本/费用分开。IPO覆盖/反转空仓、晚退款、execution-backed重复allocation均有独立分项实值。
- 旧14 fixture内6个违反现行显式nature/asOf合同，原FAIL保留，合法等价反例另验通过；没有放宽生产默认值，没有将旧FAIL改称PASS。

功能合同 PASS；状态截止与证据 PASS。UI/往返/实际持久化/视觉/日序列性能 NOT VERIFIED，属于后续产品门槛。本次无业务数据库写入。

单次200fill有限样本约197ms仍为超线性重播，不能直接每个日期调用完整F；P2/P4必须在P1真实旅程门槛后采用已审查的批量边界方案，再接受数据及性能。全项目类型与完整构建/全量测试待P1最终冻结后统一检查，不能从本局部PASS推出。
