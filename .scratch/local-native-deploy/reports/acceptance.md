# 协调者集成验收

Status: accepted
Coordinator: /root

完整覆盖、结果和 FAIL / NOT VERIFIED 限制以 [FINAL-ACCEPTANCE.md](../FINAL-ACCEPTANCE.md)为准。

实际 Make 旅程：临时 Git 的 A/B/broken 提交、Unicode/空格目标、独立数据库/63684；dry-run 不变，dirty current 拒绝，根 Make 发布 A，目标 Make 发布 B，503 失败恢复 B，发布后 RELEASES_TO_KEEP=1 失败恢复 B，rollback A，status 核对实际 HTTP/commit，down 无 listener。数据库字节保持不变。结果 PASS，见 [make-acceptance.json](make-acceptance.json)，模拟服务已清理。

真实应用在新目标/独立空库/61739 构建部署两次、目标回滚、浏览器重新加载通过。构建期间旧 PID HTTP 200，见 [old-service-during-build.json](old-service-during-build.json)。保留实例见 [browser-smoke.md](browser-smoke.md)。

45 项发布测试、58 项 Docker 回归通过；最后 rollback 边界调整后 CLI 11 项及真实回滚通过。全量业务 Vitest/lint 为 FAIL，部分基线仍 NOT VERIFIED，未用局部结果覆盖。

此前 Make 空格路径、root build 插件遗漏、物理路径别名、post-publication wrapper/listener 身份问题已修复并复验；早期失败与不完整运行文件均保留。
