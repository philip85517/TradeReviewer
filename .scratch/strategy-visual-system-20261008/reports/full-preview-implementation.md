# 完整 Workbench 预览实现记录

日期：2026-10-08  
任务：`visual-full-preview-02`  
实现者：full_preview

## 实现范围

- 新增开发入口 `/ ?prototype=strategy-workbench&view=observe|results|compare&scene=complete|running|T0`；无 query 时保持原生产工作区，入口仅在开发环境生效。
- 新增 [full-workbench-preview.tsx](../../../app/components/strategy-prototype/full-workbench-preview.tsx) 与配套导航样式。默认三个月、双策略、完整展开；页条可切换完整观察/结果/比较、T0/运行中/完整，并保留原创建与当前 A 入口。
- `RunningPrototype` 新增可选 `initialPreview` 与 `initialView`。创建原型不传这些属性，继续使用原 T0、结果与比较状态逻辑；完整入口通过既有 `enterResults`/`enterComparison` 保存来源上下文。

## 状态契约

| 场景 | 初始行情/成交截止 | 播放状态 | 预期 |
| --- | --- | --- | --- |
| `T0` | `T0_CURSOR`，无成交 | 停止 | 推进下一交易日后由真实账本新增 K 线与首次成交 |
| `running` | `T0_CURSOR + 10`（受日历终点截断） | 停止 | 可继续播放/逐日推进，页条明确为已展开预设 |
| `complete` | `calendar.endIndex` | 停止 | 净值、K 线、结果、比较均有完整合成数据，记录已展开来源 |

## 文件边界

本次仅修改 `app/page.tsx`、`app/components/strategy-prototype/running-prototype.tsx`，新增 `full-workbench-preview.tsx`、`full-workbench-preview.css` 与本报告。未修改结果/比较组件、模型账本、业务数据库或原创建逻辑。

## 验证

- 功能正确性：待 root 在 3069 运行服务中实际浏览器验证 `complete`、`running`、`T0`，结果/比较三图、事件返回来源与首根真实 K 线分别记录。
- SSR 边界修复：完整 wrapper 首次 SSR/客户端 hydration 都显示稳定加载占位，`RunningPrototype`（及其隐藏结果/比较图）在客户端 effect 后挂载，避免比较 SVG 描述文本在 SSR 与客户端首帧不一致；T0 scene 强制 observe。
- 场景重置修复：顶部场景按钮每次点击都会递增 wrapper 本地 reset nonce，并纳入 `RunningPrototype` key；即使 router.replace 的 URL 未变化，也会重新打开对应入口预设。
- 视觉修正：wrapper 品牌副标题与入口说明显式使用 `font-size: 12px; line-height: 18px`，符合 U02 次级文字规格；未修改旧完整组件字号。
- 端到端：NOT APPLICABLE（本入口只生成内存合成演示，不写业务数据库）；刷新应重置 URL 所选预设，需浏览器确认。
- 视觉：NOT VERIFIED。本实现复用旧完整布局；需由未参与实现的 benchmark_inventory 在 1280×800/1440×900 直接对照 `results-1280.png`、`comparison-1280.png`、`first-bar-1280.png`。

### 检查命令

使用项目约定 Node `/usr/local/Cellar/node/26.0.0/bin/node` 执行限定检查。scope eslint 仅覆盖本次入口接线文件；全仓 lint 仍有既有 recall/vendor 问题，不作为本票通过依据。

本轮实测输出（2026-10-08）：

```text
/usr/local/Cellar/node/26.0.0/bin/node node_modules/.bin/eslint app/page.tsx app/components/strategy-prototype/running-prototype.tsx app/components/strategy-prototype/full-workbench-preview.tsx
# exit 0, no output
/usr/local/Cellar/node/26.0.0/bin/node node_modules/typescript/bin/tsc --noEmit
# exit 0, no output
```
