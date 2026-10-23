# 报告冻结时的版本补注

`manifest-2.json` 证明六个 probe 执行期间所列源文件前后稳定。`freeze.json` 的后续检查为 `productSourceStillMatchesProbe:false`，不是测试时源漂移：报告写完之后、冻结核对之前，其他 owner 修改了 `home-surface.tsx`。

- probe 版本：`6e79152cb0fd02b370a61f047dec3610cdaa946efea0bb76c0fdf9089aa8a6d1`
- 报告冻结时版本：`914f13c9cb429c40b76acf45a562168fbc4e309a6fdbaeb5248a52a2529f95b5`
- 只读 diff：详情 footer 的“查看交易”改 class，新增“返回原搜索结果/持仓行”按钮；未改变报告所引的搜索 trigger、onScroll、pending/reload 消费点。
- host、session-model、S、Workspace、原测试及 setup 均仍匹配 probe 指纹。

六个 probe 实际只渲染 host，不导入 surface，因此其 4 PASS / 2 RED 仍绑定未变的 hook/session/S；本报告不把这些结果升级成修改后 UI 的验收。SOURCE-DRIFT 是补充证据，不覆盖原报告、manifest、RED 日志或 freeze 记录。peer 证据至此冻结，未改任何产品文件。
