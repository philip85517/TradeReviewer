# 03 从研究目标到交互与组件的全文重写

ID: STRATEGY-V10-EDITORIAL-REBUILD
State: closed
Status: accepted
Assignee: root
集成负责人: root

## Scope
依据用户2026-10-24要求，以首页V2.5章节组织为对照，从零撰写策略台方案的完整叙事。先说明背景、目标、范围与取舍，再解释理念、研究流程和整体布局，随后按任务展开分镜、页面、异常、适配与组件，最后安排实现检查及来源。不是对旧正文局部润色。保留业务契约、已有图稿和精确规则，不改产品或数据库。

## Refs
- 用户本轮明确要求：从0写起；高维向低维；理念通过分镜、流程、组件展开；自然可读，合理分段和列表。
- docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md 第一至十章及附录。
- 策略包 evidence/editorial-rebuild/before.md、manifest-before.json：本轮修改前版本。
- 策略包 editorial-rebuild-audit.md：全章问题、重写位置与验证映射。
- 策略包 DESIGN-COVERAGE.md：既有74元素及准确画板，保留生效。

## Blocked by
None

## 验收标准
- [x] 明确V2.5结构的借鉴方式与策略台独有的研究流程，不照搬首页业务布局。
- [x] 导读和原14章逐章问题有记录；新全文形成背景→目标→理念→流程→布局→任务分镜→公共状态与组件→验收→引用的完整层次。
- [x] 每章先交代任务与方案；规则和参数不代替论述，列表服务于并列/步骤/比较。
- [x] 已有元素、14个精确规则块、21个SVG与两组分镜保留；新增章节有锚点，无失效引用。
- [x] 独立审查全文结构、语义保真与可读性；协调者最终接受。
- [x] 阅读器真实浏览器检查新目录、锚点、分镜与展开；产品UI/数据库不适用（仅文档）。

## 所有权与验收证据
root唯一正文及构建owner；editorial_structure_review只写editorial-rebuild-review.md独立审查。保留旧editorial接受记录，本轮文档结构接受在复验前为NOT VERIFIED。

## 2026-10-24 最终接受

已完成全文重写、V2.5结构对照、原导读和14章问题扫描；新15主章与附录形成完整叙事。E01–E05自然措辞问题修正，独立R01–R10全部PASS，root独立接受。版本和证据见正式包evidence/editorial-rebuild/acceptance-version.json；62目录、14展开/键盘关闭、两组6帧检查通过。产品功能与业务数据库不适用于本轮，设计取舍仍待用户评审。
