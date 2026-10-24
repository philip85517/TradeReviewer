# 02 — 全文论述结构扫描与改写
ID: RV10-02
State: closed
Status: accepted
Assignee: coordinator
集成负责人: coordinator

## Scope
按用户要求逐章扫描《复盘页视觉规范 V1.0》，建立围绕标题、先总后分、说明目标与取舍的论述，再安排规则、参数与引用。改写全部十章及导言，保留设计语义、画板、参数、元素ID与提案身份；同步HTML。

## Refs
- 用户当前要求：先建立论述结构，再安排规则、参数和引用资料；围绕标题、先总后分、说明目标与取舍。
- docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/visual-design.candidate.md
- docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/editorial-rewrite/before-visual-design.candidate.md

## Blocked by
None

## 验收标准
- [x] 导言与RV01–RV10逐章问题及修改对照有据可查。
- [x] 全文先交代目标与取舍，再展开规则、参数、示例和依据。
- [x] E01–E22、S01–S10、数值和状态契约完整；十张画板不变。
- [x] 重建预览、核验链接与章节、在浏览器复读；原验收证据保留，新版本单独记录。

## 反例与证据
只增添统一开场白但仍混排细则，不算全文改写；修改文风不能授权改业务规则。本轮仅文档改写，不需要业务UI或数据库验收。

## 接受记录
coordinator 已逐章核对正文与原契约，重建并检查真实浏览器预览。证据：`docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/editorial-rewrite/verification.md`；覆盖导言与10章、11表、10图、22元素、10状态、90项本地链接。无业务代码或数据库变更。
