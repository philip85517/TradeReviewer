# 复制失败回执修复：范围与验收

依据：[原测量任务与三轮记录](issues/02-measure.md)、[既有案例复现](reviews/measurement-03/REPRO-20261029.md)，以及用户确认“先修复”和“仅覆盖此前复现案例”。这是后端实验工具的合成数据修复，无前端元素、参考画板或浏览器操作。

| 需求 ID | 情况与可观察预期 | 负责人 | 验收证据 | 状态 |
|---|---|---|---|---|
| FR01 | 合成源摘要不符导致复制失败，初始身份已取得，失败后源发生变化：回执必须反映未通过，不得声称最终检查通过；保留原复制错误。 | copy_fix；协调者集成 | [红绿证据](measurement/candidate-04/evidence/WORKER-REPORT.md)、[独立验收](reviews/measurement-04/REPORT.md)、[协调者复核](reviews/measurement-04/COORDINATOR.md) | PASS，限该案例 |
| FR02 | 只使用合成文件；保留第三轮冻结代码、原始记录和业务数据，不启动真实规模测量。 | copy_fix；协调者集成 | [独立验收](reviews/measurement-04/REPORT.md)、[协调者复核](reviews/measurement-04/COORDINATOR.md) | PASS，限该案例 |

原测量任务仍暂停；本修复的成功不等于完整测量工具或页面性能已验收。其他失败分支与成功复制对照不纳入此次新增用例，已有回归检查的实际结果应如实报告。
