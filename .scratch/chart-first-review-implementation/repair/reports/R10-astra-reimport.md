# R10 真实重导链独立证据核验

2026-09-27，`gpt-6-astra / low`。只读报告/JSON并独立打开截图；没有亲自操作浏览器、运行测试或写数据库。依据 `R10-real-reimport.md`、`R10-reimport-before.json`、`R10-reimport-after.json` 及以下三张实际图。

**此前“真实重导→人工关联待确认→确认→保存重开”unverified在本合成原单路径限定关闭。** 这次是root从真实导入UI上传两版合成PDF并执行冲突选择，不是R8预置needs-confirmation夹具；输入是合成Futu F4月结单，运行于3052独立reimport-ui.sqlite副本，不能泛化为所有真实券商模板。

- 独立打开 `R10-reimport-conflict.png`：显示v2修订文件、2020-01/F4、同一FB卖出既存100@10/本次80@10和处理方式选择。root记录实际选择“使用本次，替换已存”，后续SQL符合该选择；截图的待选状态本身不冒称已点击。
- 打开 `R10-reimport-pending.png`：顶层新增1/移除1、回合人工标签“判断”仍选中，旁边明确“成交集合已变化，当前标签需要确认归属”及确认动作。底部持仓20、回合持仓中，不把修改成80卖出后的剩余20伪装已平仓。
- 打开 `R10-reimport-confirmed-reopen.png`：顶层变更提示消失、回合“判断”仍选中，人工确认动作不再出现。上方另一个退出票标签组空选不影响下方回合analysis标签，不能混为同一个字段。两个确认入口count0及返回库重开步骤归root实际动作记录。
- 独立解析before/after JSON：episodeId完全一致。revision2为linked到v1买 `futu:6b7c31c834445e40:1:5` 与v1卖 `futu:6b7c31c834445e40:2:3`；revision5 association linked到同v1买及v2卖 `futu:583d57e98d25cad1:2:3`。currentExecutions为买100/卖80，旧v1卖ID不在当前集合，analysis标签保持。前后关联同evaluation身份，不是创建另一个回合绕过旧标签。
- after记录originalSyntheticExecutions25、SHA256 `1b79e6e605b493b4e0ce7833094824c807680c972166a83a1a3f0b8aefd12b36`，与已审基线一致，quickCheck=ok；这是root只读审计导出，本代理未重新查询SQLite。

**准确保留状态：** after顶层status为needs-confirmation；截图亦显示待重新确认。本路径没有重新完成整笔复盘，不能称回合completed、旧正式版自动重新有效或所有留存已重新生成。被接受的仅是原单修订经实际UI替换、同回合人工association重新确认、保存/重开与新执行集合一致。

原R8历史missing Text显示及fixture确认结论仍有效，R9冲突恢复独立通过；此报告不称全功能accepted或真机键盘通过。
