# 02 首页图文阅读器与评论接入
State: closed
Status: completed
Assignee: unassigned
Scope: 为homepage v1.0复用策略台已存在的阅读/评论工具，创建可生成的图文阅读器。此票只实现文档展示，不编造首页内容。
Refs: ../DESIGN-COVERAGE.md D01-D03; /Users/zhoulin/.codex/worktrees/f922/TradeReview/docs/design-system/standards/VDF-002-visual-documentation-v2.0.md; 同worktree baselines/2026-10-15-strategy-backtest-v2.2/build-visual-spec.py、review-client.js/css；tools/document_review/API.md。
准确视觉参考：f922/docs/design-system/baselines/2026-10-11-strategy-backtest/evidence/document-preview-1440.jpg 与document-preview-390.jpg（实现前view_image）。参考暗色环境、正文16/1.8、章标题24px、三列表、248px桌面目录，窄窗顶部目录。
Blocked by: None（内容来源与代表截图由root后续填入，不影响阅读器接口）。
允许写入：tools/document_review/复制server及测试/API；docs/design-system/baselines/2026-10-15-homepage-v1.0/ 下 build-visual-spec.py, review-client.js/css, reader.css, reader.js, fixtures/representative.md, 生成visual-spec.html/document-manifest.json/document-identity.json；以及本票和evidence/renderer.md。禁止写visual-design.md、images、rules.md、assessment.md（root负责）。
接口：以visual-design.md为权威，build-visual-spec.py --source <path> --output-dir <dir> --version 1.0，documentId HOME-DOC。保留稳定block和图片评论身份、版本指纹注册；所有本地资源可访问；从任意章节打开评论和导出。不要沿用BT章节身份。
动作演示接口：支持Markdown :::state-demo 块，内部每行 `图片相对路径|状态标题|中文说明`；生成上一步/下一步/重播按钮及当前图、静态步骤；无自动循环、支持键盘和减少动态；明确设计分镜非产品实测。可复用策略台实现但清除策略业务内容。
验收：先生成代表fixture（基础规范和交互两章）供root看图；root认可后再生成全册。复用server/client做真实持久化，使用隔离comments-dir；原个人评论绝不复制改写。不要求新建站点框架。运行相关现有测试和必要新接口检查，报告边界。不得再派代理。产品UI/业务库无写入。

验收：交付根 evidence/acceptance.md 与 independent-review.md；未变更产品代码，未推送。
