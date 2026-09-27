# 真实合成PDF重导验收

2026-09-27，root真实浏览器，3052生产构建R9，独立SQLite backup副本fault-acceptance/reimport-ui.sqlite。不是预置needs-confirmation状态，也没有修改产品数据层造结果。两版输入和离线解析依据见[REIMPORT-PLAN](../fault-acceptance/REIMPORT-PLAN.md)。

1. 从页面“数据→导入交易记录→PDF/Excel”上传v1，核对2020-01/F4/2笔/无诊断，确认导入。账户futu:900001、US:FB的合成买100与卖100，各费用1，独立于原25笔。
2. 交易库FB→打开合成股票第1次交易→事后复盘→回合人工标签勾“判断”→返回库保存。[重导前SQL](R10-reimport-before.json)：revision2、analysis、association linked，v1买卖两个ID。
3. 同页面上传v2，核对月结单后出现明确数量冲突“已存sell100；本次sell80”，选择“使用本次，替换已存”，确认导入。[实际冲突图](R10-reimport-conflict.png)。买入重复跳过，卖出采用v2新ID。
4. 回到同一回合，顶层新增1/移除1，原判断标签保留，但人工归属必须再确认。[实际待确认图](R10-reimport-pending.png)。图示剩余持仓20，未伪装平仓。
5. 点击“确认使用当前回合成交”、顶层“确认已处理行情变更”；返回库保存并重开。两个确认入口均count0，回合“判断”仍checked=true。[确认后重开](R10-reimport-confirmed-reopen.png)。顶层回合status仍needs-confirmation，尚未重新完成整笔复盘；此检查接受的是人工关联确认链，不把它误记为已完成复盘。
6. [后验只读SQL](R10-reimport-after.json)：revision5，association linked，IDs为v1买入与v2卖出，旧v1卖出已移除；原analysis标签保留。原25笔合成成交SHA1b79e6...不变，quick_check ok。数据审计初次使用synthetic-repair前缀漏掉6笔旧synthetic-chart-first，已更正为全部synthetic-，没有数据丢失。

结论：同账户同月份修订PDF→显式成交替换→原回合标签待确认→人工确认→保存重开→SQL关联到新集合，真实链限定通过。输入完全合成，不是用户月结单；未修改业务库/主验收库。临时3052服务与页面已关闭。R10随后只移动辅助按钮，无修改导入/关联代码，此证据可按影响面复用。
