# 我的交易室实施

状态：9票已发布并完成。开发与自测由gpt-5.6-luna / max子代理承担，独立同模型QA最终通过，协调者亲自完成浏览器验收。

规格：../../docs/specs/2026-09-19-trading-room-homepage.md
基线：4df397a，远端d38dbb7已被包含；现有隔离worktree直接工作，不推送/合并/发布。

任务：
- [01 scope](issues/01-scope.md)
- [02 data-management](issues/02-data-management.md)
- [03 fx](issues/03-fx.md)
- [04 calendar](issues/04-calendar.md)
- [05 holdings](issues/05-holdings.md)
- [06 metrics](issues/06-metrics.md)
- [07 principal](issues/07-principal.md)
- [08 quality](issues/08-quality.md)
- [09 qa](issues/09-qa.md)

执行台账见 progress.md；派发说明见briefs；自测与QA结果见reports。
现有3022等服务不重启，新预览使用独立端口及SQLite一致性备份。

交付预览：[http://localhost:3030/](http://localhost:3030/)（服务保持运行）。[交付与重启说明](reports/delivery.md)、[独立QA](reports/09-qa.md)。
