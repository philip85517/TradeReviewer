# 可评论阅读器

State: closed
Status: done
Assignee: reader
集成负责人: root

Scope：新增 docs/backend-design/review/、构建和启动入口；复用现有视觉规范评论客户端与服务，不能修改共享服务或原视觉稿。Refs：DESIGN-COVERAGE 全表及所列准确参考。

Blocked by: None

- [x] 两稿可阅读、目录定位、详情展开、独立评论身份。
- [x] 构建可重现、段落与评论清单一致；源码相对链接正确。
- [x] root 真实浏览器交互和持久化验收、非实施者视觉比对：第1/3轮通过。

核心链：选区→评论面板→现有API→专用JSON→刷新／导航／服务重启后显示，均已核对。文字源冻结后已重建并检查。无业务数据库。环境监听限制及默认3091端口占用不属于代码修复候选；显式使用3094，未中断其他工作树。

证据：[最终验收](../FINAL-ACCEPTANCE.md)、[导出与保存](../evidence/exports-and-persistence.json)、[正式入口](../evidence/final-preview.json)。
