# 本次文档归档核查

2026-11-14，root；文档专用。已直接执行归档检查，不沿用历史产品测试作为本次检查结果。

|检查|结果|实际证据与边界|
|---|---|---|
|归档内容校验|PASS|62个文件 SHA256 与归档清单一致；45份历史附件的原始内容与原件字节一致，其中12份日志／响应头采用无损gzip，保留原空白与CRLF。源码 before／after 原 JSON 一致，去重后 gzip 解压 SHA256 一致|
|文档链接|PASS|正式报告与根 README 共360处本地链接／Markdown标题目标存在；候选外部源码改为冻结定位，无本机绝对链接依赖|
|原始结果一致性|PASS|检查25db的3次指标样本均301次get/all；分段3次均2,500次CSV parser；38a0三个样本仍超过一秒，未改写成通过|
|源码冻结|PASS（归档完整性）|包含21,573文件的原清单／计数；不是再次冻结或改变当前候选源码|
|当前前端产品内容|PASS（无改动）|逐一重算最终manifest中33个产品文件 SHA256，全部匹配17701786；本次仅新增文档与根README入口|
|Git diff与提交范围|PASS|已运行 `git diff --cached --check`，暂存范围仅根README与本报告目录，共65文件，无数据库或产品实现。具体本地提交以Git历史为准|
|产品测试／浏览器／视觉／数据库|NOT APPLICABLE|本次不修改产品实现或数据／状态连线。历史F1结果、后端诊断FAIL、NOT VERIFIED保持原范围；没有启动服务或访问数据库|

可重复的文档核查命令（仅标准库，不运行探针）：

```sh
python3 docs/reports/2026-11-14-trading-library/evidence/verify-archive.py
git diff --cached --check
git diff --cached --name-only
```

归档清单不对自身和本记录做自引用hash；其余文件纳入校验。`.txt`中的历史Markdown链接、JSON中的原scratch路径为原始provenance，未被当作当前可运行附件。数据库、业务原件及完整dirty候选源码没有进入归档；异机重新执行性能探针仍需恢复相同候选源码与合法隔离数据。

本次只创建本地文档提交；没有push、merge、发布、迁移后端或替用户决定最终读取架构。已有未跟踪scratch资料保留原位。
