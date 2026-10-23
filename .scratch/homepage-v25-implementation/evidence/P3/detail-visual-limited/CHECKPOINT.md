# 详情有限视觉修复 checkpoint：已冻结，待 root 独立视觉复验

冻结时间：2026-10-22T19:53:48Z（上海 10 月 23 日 03:53:48）。仅 2 个产品文件和 2 个必要详情测试变化。P1 第 2/3 轮 FAIL、P3 0/3 均保持；不提交正式第三轮/整票 implementation-ready。

## 落实内容与冲突处理

已完整阅读原始 detail.svg/search-detail.svg、对应正文，实际查看两张原图 PNG 和 root 的 ROKU 截图。原图左侧操作与正文“主动作水平居中”存在冲突，按 root 最新纠正保留正文优先：**查看交易独占居中行**，返回次动作另起居中行。先前左对齐方案未实施，也不视为用户批准变更。

详情标题独立 24/32、容器 #111A26、桌面 min-height500；主按钮 120×36，#162233 背景、#6CA8FF 边框、正文色。保持四 KPI、真实来源/缺失说明及更新操作。对话框内容不 flex 压缩，超高整体滚动；窄屏或矮视口取消500下限，≤600px四 KPI 单列。未用绝对定位挤压信息，也未新增 CSS 镜像测试。

新增可见的来源返回按钮直接复用 closeDetail：持仓显示实际页码；连续搜索结果显示“返回原搜索结果 · 恢复原滚动位置”，不虚构图中的第2页。唯一前进主操作仍为查看交易；交易范围、目录身份、financial/unknown 语义与 host 均未改。

## 验证结果

| 检查 | 实际结果 | 证据 |
|---|---|---|
| 新来源返回用例先 RED | 2 FAIL，均精确缺对应 button | 02-source-return-red.log |
| 详情与搜索全部定向交互 | 15 PASS / 0 FAIL | 03-surface-interactions-green.log |
| 严格 TypeScript | exit0 | 04-strict-types.log |
| 定向 eslint | exit0，0 error / 1 warning | 05-detail-lint.log |
| 修改前相同 surface lint | exit0，同一条 detailId 依赖 warning | 06-before-lint.log |
| host/session/Workspace/catalog/F/S | 前后6个 SHA 全一致 | DETAIL-VISUAL-FREEZE-MANIFEST.json |
| 真实桌面/窄屏/矮屏视觉 | NOT VERIFIED，本 agent 无浏览器操作；旧 root 视觉 FAIL 保留 | root 待复验 |
| 真实业务持久化/重载 | 本次未验证/未写；未修改其接线 | root 独立证据继续有效的范围由 root 判断 |
| emulated / physical touch | 均 NOT VERIFIED | 无可用独立证据 |

精确命令（均 cwd=worktree，Node 使用项目固定运行时）：

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/vitest/vitest.mjs run app/components/homepage-v25/home-surface.test.tsx app/components/homepage-v25/search-surface.test.tsx -t 'visible source action'
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/vitest/vitest.mjs run app/components/homepage-v25/home-surface.test.tsx app/components/homepage-v25/search-surface.test.tsx
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/typescript/bin/tsc --noEmit --incremental false
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/eslint/bin/eslint.js app/components/homepage-v25/home-surface.tsx app/components/homepage-v25/home-surface.test.tsx app/components/homepage-v25/search-surface.test.tsx
```

## 本次影响控件的版本绑定登记

绑定 manifest 中 914f13… surface / d34b54… CSS；下表 PASS 仅指 JSDOM 功能测试，不能代替真实输入/视觉验收。未重测全页、附件、P2/P4，因本次明确未授权且源码未变。

| 控件/状态 | 预期 | 本次证据与状态 |
|---|---|---|
| 持仓来源返回（新增） | 非默认搜索/排序/第2页保持，精确来源 Eye 获焦，不发交易导航 | 新 RED→GREEN，PASS |
| 搜索来源返回（新增） | metadata-only 详情退回原 query/selected/scroll、结果按钮焦点、不发导航 | 新 RED→GREEN，PASS |
| Tab/Shift+Tab 包含新增末尾返回 | 最后一项→关闭、关闭反向→返回 | search 新用例 PASS |
| 关闭 X / Esc | inert 解除后准确还焦，不误关底层搜索 | 既有详情与搜索用例 PASS |
| 外点详情 | 不关闭 | 两来源既有用例 PASS |
| 查看交易 | 唯一前进按钮；持仓正确 identity；搜索拒绝不丢详情，允许后准确唯一 identity | 既有用例 PASS |
| 四 KPI + 次级价/账户/天数 | 顺序/层级保留 | 既有结构用例 PASS；实际视觉 NV |
| 完整数值解释 | Enter/Esc、hover、合成 pointer/click；Esc 不关闭详情 | 既有用例 PASS，合成 pointer 不是 touch 验收 |
| 未知成本/报价 | 暂无/待更新，可信已知值无假缺失原因 | 既有用例 PASS |
| 刷新造成来源消失 | 保留查询，回容器标题 | 既有用例 PASS |
| 更新数据/正在导航/缺 identity 禁用 | 本次未修改既有 handler/禁用条件 | 源 diff 保留；实际点击/延迟状态由 root 核查 |
| 标题/底色/120×36/500下限/窄矮滚动 | 匹配本次正文优先方案 | CSS 源已修改；真实渲染 NV |

## root 复验操作

1. 全重载当前隔离服务 `http://127.0.0.1:3333/home?scope=live&market=a&accounts=*&rangeMode=all`，等待 owned read 收敛。
2. 搜索 ROKU，进入无持仓详情；对照 `source/images/search-detail.svg` 和旧 FAIL 图 `evidence/P3/root-search-detail-default1280x720-dpr2.png`。主按钮按正文居中，其余标题/色彩/尺寸/四 KPI 按参考；实际未知说明允许增高。1280×720、1440×1000及1280×800可测桌面；短于548高或≤900宽确认滚动可达，≤600宽确认单列。
3. 点蓝色来源返回，确认详情关闭、查询/结果位置/选中行和焦点保持；再打开详情，查看交易→诚实空的 A股+NASDAQ:ROKU:stock 普通库→返回原首页来源，复核原功能链不受 CSS 影响。
4. 对非默认持仓 query/sort/page2详情重复来源返回、Esc、关闭与 Tab 环；真实 mouse/keyboard 由 root 实测，touch 分项保留 NV。

源文件与测试完整 SHA、精确产品差异、冻结副本分别见 `DETAIL-VISUAL-FREEZE-MANIFEST.json`、`DETAIL-PRODUCT.diff`、`frozen-source/`。当前产品停止编辑，等 root 集中反馈。
