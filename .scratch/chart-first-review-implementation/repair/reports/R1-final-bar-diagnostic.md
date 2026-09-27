# 真实末根诊断

2026-09-26 18:55，3048 隔离库，999992，1280×900。临时 DOM data-replay-debug 为 chart owner 添加，仅用于本次诊断；修复后移除。以下由协调者通过真实浏览器读取，并非 mock 数值。

路径：重开 → 关闭侧栏 → 持仓过程恢复末尾 → 上一根 → 下一根。

| 值 | 上一根 9/23 | 下一根 9/24 |
| --- | --- | --- |
| candleCount / timelineCount | 61 | 62 |
| dataLastTime | 1790121600 | 1790208000 |
| dataCurrentRange（setData 前） | 27..60 | 27..60 |
| revealTargetIndex / Logical | 60 | 61 |
| revealCurrentRange（setData 后读 getter） | 26..59 | 28..61 |
| revealNextRange | 27..60 | 28..61 |
| 最终 rangeEvent / committed | 27..60 | 27..60 |
| 最近 request pending 记录 | 27..60 | 27..60 |

已排除“reveal id 先消费旧数据”：目标数据和 targetIndex 61 正确。已确认第二个顺序问题：data effect 排队保持旧范围 27..60，SDK setData 同时将当前 getter 推至 28..61；reveal 看到目标已在 getter 中，不再提交范围。下一帧旧的 pending preserve 生效，末根 61 再次位于可见范围之外。

修复要求：主动 reveal 以图表自己待提交的范围为依据，覆盖本次数据保持操作；测试同时模拟 setData 即时移窗、setVisibleLogicalRange 下一帧提交，不以添加 padding 掩盖。此前 RO height-only 和 phase/width 修复仍有效。
