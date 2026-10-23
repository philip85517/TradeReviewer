# 来源恢复：root 真实浏览器 RED

记录于 2026-10-23 04:08 CST。同一 P1 第三候选准备；正式仍 2/3 FAIL，未启动第三轮。独立操作者 /root。本文只记录诊断，不签修复通过。

## 版本、环境与触发

host 原 SHA256 `74d765fe938aaa126ef115a683dea7f96181aab67c24de6e33e3e51fde08d2f2`，输入详见 `navigation-recovery-design/READ-ONLY-MANIFEST.json`。设计合同为原稿 436–456、475–501、655–660：目标范围读取成功才提交；返回重读业务并恢复完整来源 UI；失败/超时保留旧提交结果和合法恢复来源。

实际 IAB tab7，CSS 1280×720、DPR2，鼠标。3334 是 root 的 HTTP/WS 故障代理，上游仍为 3333 同一个显式隔离 `.data/tradereview-test.sqlite`；代理不访问数据库。只控制 `/api/trading-room/fx` 的 503 或延迟；不能将注入失败称为真实 FX 服务或 SQLite 故障。期间不重建/重置数据库。主服务已撤除请求体观察器。

## 可复现路径与直接证据

1. 正常进入 A股首页，搜索 ROKU，实际元数据返回 NASDAQ:ROKU:stock；无持仓详情点击查看交易。地址为 `/trades?scope=live&market=a&accounts=*&rangeMode=all&symbol=NASDAQ%3AROKU%3Astock`，0 标的/0 回合是诚实交集。
2. root 开启 FX 503，真实浏览器刷新普通库。日志 20:03:04.880Z、20:03:07.215Z 两次 503。页面明确“汇率状态读取失败，新范围未应用。”；证据 `navigation-cold-read-failed.ax.txt/.png`。
3. root 关闭 503、改为 20000ms 延迟，点击实际“返回首页选择范围”。20:03:25.351Z 延迟读取开始；首页仍是旧全部市场，显示“正在读取新范围…”。`navigation-return-pending.ax.txt`。
4. pending 中点击仍可用的搜索触发器；搜索打开，查询为空，读取目录中。`navigation-return-pending-search.ax.txt/.png`。随即真实硬刷新；日志 20:03:34.120Z、35.944Z 新读取延迟开始。此路径是用户控件，不是直接调用 host API。
5. root 将后续 FX 请求恢复普通透传；已发出的延迟请求仍保持原行为。刷新后原 ROKU 查询丢失；目录读取失败/全局读取超时如实显示。`navigation-reload-search-lost.ax.txt/.png`。
6. 关闭搜索，点击实际重试。20:04:11.628Z FX 正常 200，owned read 成功，但 URL 已变为 `market=all`，可见全部市场77持仓，未恢复 A股/ROKU。`navigation-normal-retry-still-all.ax.txt/.png`。

完整受控传输记录 `navigation-fault-requests.jsonl`；注入当前已关闭。原始 AX/PNG 和 peer RED 不覆盖。

## 首个坏写与对照

冷交易库首读失败时，合法 source=A股/ROKU，而唯一 committed 仍为默认全部市场。返回的 navigation(A) 尚未接受，host.onUi 把旧 committed 编码后写回 source/history/storage，覆盖合法来源；硬刷新只是随后读到了这个坏来源。原 peer NR03（不发 onUi）通过，NR04（仅增加一次 onUi）失败；root 的实际搜索触发证明该事件可达。

这不是 generation 失效，也不是裸 `/home` 本身造成。NR06 的 host.reload 抢占只作为 API 边界反例，尚无真实可用控件触发证据。原 Recall 选择错误与间歇请求体异常仍 OPEN，不因本次复现自动关闭。

已授权原 owner 一次有限候选：先保留 R01/R03/R05 RED，再在 host 内修复恢复来源的写入归属、失败/超时生命周期及 retry/pending reload；不预提交来源业务数据、不修改 S/F/session/Workspace/Surface。修后 root 独立检查失败→返回→pending 搜索→硬刷新、失败/超时重试、正常往返与新身份意图；本诊断不代替这些 GREEN 或整票接受。
