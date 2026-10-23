# Direct /trades owned-read regression — OPEN

2026-10-23 03:23 CST，root真实浏览器；P1仍2/3 FAIL，P3首切片准备，不是正式第3轮。

冻结UI后Tab3全重载URL http://127.0.0.1:3333/trades?scope=live&market=a&accounts=p1-count-09&rangeMode=all&symbol=SSE%3A600100 ，1280×800，实际0标的/0回合并“还没有导入交易”。库仍有测试数据，待处理929，账户标签正确。见direct-trades-empty-after-freeze.png/.ax.txt。Workspace冻结SHA ee29515346366905d0bba6b4d220b22cee4f4b8f4310e247aebcaed951a7d490。

已读源码确认P3接线将ordinaryEntries改消费homepage.data.entries，而host direct trades初始化仅设route、readOnInitialize只对home生效，因此持有首render空bundle。原外部tradeLibraryEntries路径没有该缺口。实现者正在证据目录建最小hook RED，产品冻结；不能以改回外部最新bundle破坏owned generation原子性，须精确修入口读取语义。

双窗口冲突旅程作废，待稳定修复后重走。两窗口原均正确显示P1持仓01草稿100/90/120，Tab3实际保存止损91/数量20/做多并DB rev1→2（recall-conflict-before.json / recall-conflict-first-save.json）。Tab4改目标125后发生HMR附近重新选择中兵红箭，URL仍600100；该跳转尚未独立定因，不能等同于409或认为由空集合单独解释。错误命名recall-conflict-409.png实际上是错误证券画面，明确不是409证据。unexpected-selection-tab3/4.ax.txt及recall-unexpected-selection-db.json保留；该时段仅seed600100 rev2写入，未发现其他episode新写入。

非框架请求体overlay：console本时段error/warn为空；两项问题分别追踪，不推断共同根因。UI控件/持久化/视觉仍NOT VERIFIED。后续需最小RED→GREEN、冻结后真实direct reload、完整library→seed Recall选择、实际503/409恢复再接受。

## 03:35–03:40 root scoped verification

Cold direct-read defect repaired in host 74d765fe938aaa126ef115a683dea7f96181aab67c24de6e33e3e51fde08d2f2 / Workspace 6d255f0e1ed1a0af1d094cedb769cfe7fd33c6164c87b46a8ba8f57944581d22. Root independently ran 26 host/session tests and 3 production-chain tests, all PASS. Actual full browser reload showed the exact one symbol/one episode for p1-count-09 / SSE:600100 (direct-trades-cold-reload-green.png/.ax.txt). Scoped cold-read gate PASS; global/source return and failure recovery remain separately pending.

Frozen stable real-browser two-window conflict: Tab3 and Tab4 both opened the seed 600100 document at revision2. Tab3 changed stop to92, actual DB revision3; Tab4 changed target125 on stale revision2, showed conflict and retained stop91/target125. DB document and updatedAt remained exactly revision3/stop92/target120. Clicking 我的交易室 kept URL and Recall input unchanged. Explicit 重新载入 adopted stop92/target120; reapplying target125 saved revision4. Evidence recall-stable-rev3.json, recall-stable-conflict-db.json, recall-stable-conflict-visible.png/.ax.txt, recall-stable-conflict-navigation-blocked.png, recall-stable-conflict-recovered-db.json. No unexpected instrument switch occurred in this frozen sequence; this does not prove the old HMR-associated cause.

This is limited independent acceptance evidence, not formal P1 round3 or whole P3 acceptance; previous FAIL/NV remain.
