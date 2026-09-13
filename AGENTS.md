# TradeReview agent workflow

For implementation work, follow [the project development workflow](docs/agents/development-workflow.md): the primary agent coordinates; Luna (`gpt-5.6-luna`) is the default implementation model in bounded, disjoint subagent tasks; the coordinator independently reviews and accepts the working feature.

Preserve existing work and original trade data. Use an isolated database for browser tests that write. Do not push, merge, or publish without the user's request.

A completed UI delivery must include a clickable preview URL in the current chat, freshly checked in a real browser with its local service still running, plus verification results and startup instructions. Never claim completion solely from a worker report.

Use [local Markdown task tracking](docs/agents/issue-tracker.md). Follow the user's explicit instructions when they override the default workflow.
