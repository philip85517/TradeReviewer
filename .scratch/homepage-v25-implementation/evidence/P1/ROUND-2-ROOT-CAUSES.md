# P1 第二候选根因与修复证据

P1 第1/3轮正式 FAIL 保留，下一候选是第2/3轮，内部切片不重置。范围为 issue04；本 owner 没有操作服务、浏览器或验收数据库，没有写 F/S、shared-scope、layout/globalCSS、原始业务记录或依赖。root 持有真实浏览器/隔离持久化/视觉门。

|第1轮反馈或同边界反例|RED / 根因|最小修复|真正后续 GREEN 与限制|
|---|---|---|---|
|Esc / close 后 BODY|65 两例观察 focus 时 inert=true；closeDetail 在 React commit 前直接 focus|关闭先提交；background inert effect cleanup 后 layout effect 恢复原 Eye，消失则标题|70/81 surface 两关闭路径均检查 focus 当时无 inert；真实浏览器候选2 NV|
|详情四核心层级|65 找不到四核心卡；原七项两列同层级|数量/成本/市值/净浮盈四卡一行，价/账户/天数次级；桌面1020上限，小于900两列|70/81 结构 PASS；尺寸/同态原图比较须 root，自动结构不替代视觉|
|已知成本/报价附缺失原因；native title 不足|65 完整值说明不成立；Value 无条件拼 reason|数值已知仅完整原值；null 保留对应原因。真实 portal tooltip，focus/hover预览，Enter/Space固定，Esc关闭数值说明，外侧pointerdown关闭；点击固定开关|70/81 合成 keyboard/pointer PASS，测试名已明确 synthetic pointer/click；emulated/physical touch NV|
|空账户/真空持仓无下一步|65 缺导入动作|空账户导入账户、全市场真空导入交易接既有数据管理导入；非全市场真空查看全部市场；no-match保持已有清除，不加重复CTA|70/81 PASS；既有导入业务未改，真实点击/导入持久化 NV|
|M01 broad merge 绕过|67 三种无效 exchange 实际 HTTP 200，应400；validateInstrument 只浅校验|sqlite-store 共享写入边界复用 storedMetadata→validateResolvedInstrument；route 产品不改|70/81 实际 route+临时SQLite拒绝独立instrument和embedded execution、无持久化；合法官方证据写盘close/reopen/read保持。非root验收DB|
|历史已存无效 exchange 仍被信任|76 三例 bootstrap JSON US代码、tencent来源、无效时间仍生成 identity|导出现有统一 validateInstrumentExchange，首页 US identity 消费处 runtime fail-closed，历史原instrument/trade不变，无迁移|77 9PASS含三例，81整组 PASS；未知身份待解析，不伪造US:code|
|W01 gold guard / W03 futu 返回缺行|75、76 旧三回归。首页 explicitLiveEntries 过滤无nature canonical unknown；普通global又按entry fallback把unknown归为live，三选项均不可达。aliases mock还错误返回nextFrame导致初始化失败|本地Route明示collectionOrigin。裸/trades保留既有global/shared-scope兼容；首页nav仍openTrades(null)，首页CTA/detail/scopedURL严格explicit-live；无原记录补nature，无shared-scope改动。旧global测试从裸/trades建立上下文|77 原gold/futu和origin/read边界9PASS；最终88包含旧三完整断言。source snapshot保留，direct/reload/indexed pop单独测试|
|W02 cash notice选择器|75 原首页现金状态组件已不挂在新首页；真实保存/失败事实在数据管理可访问提示仍存在|只将断言移到数据管理通知/role alert，PUT一次、revision、重复读失败/只读retry等原断言保留|最终88明确选中原“keeps the saved fact and read-only retry after repeated summary failures”；85并未选中此例，不把85当旧三全部通过|
|aliases真实HTTP失败恢复|错误mock aliases→nextFrame违反现有响应合同；修合法默认mock不证明真实失败|新增真实production client HTTP503→明确重试→合法{aliases:[]}→普通库恢复；validator不放宽|85/88该例 PASS，保留actual HTTP路径，次数下界因bootstrap与owned read都会验证，非假定恰好两次|
|direct /home date/custom handoff丢范围|78 host+Workspace真实RED：snapshot.period初始all，homepageTradeUrl擦掉已应用scope.date|非all period优先；period=all暂保scope.date/custom；首页nav和detail都走同投影|81含四参数组合date/custom×nav/detail及reload/return；85/88非默认首页nav严格排除同证券unknown。P2/S后续需URL初始化period与显式全选清日期的单一规则，本轮不改S|
|F3 US positive fixture|69 两例 US raw Oct23/asOf Oct23 date-only：上海日末时纽约23仍未完成，F正确拒绝|两正向fixture的US raw改Oct22，asOf/FX23、CN23、US显式旧15不变；不放宽F|70/81 PASS；消费root已接受F3 e91dce9…|

## 中间失败不能覆盖

66 因 Node 环境错误不是有效产品 RED；67 合法写读例另含 resolvedAt canonical ISO / normalized execution 不内嵌 metadata 的测试假设，后续按实际 canonical instrument 检查。79 文件名含 green，但实际 **2 FAIL / 2 PASS**：simulation fixture 缺真实 simulationRunId/selection；aliases 假定恰好2次而实际4次。均保留。补真实 boundary-run 与选择后，80仍 **1 FAIL / 10 PASS**：run条件控件插入后旧 nature select DOM reference失效，改为每次查当前select。82 **1 FAIL / 7 PASS**：production detail test在初始owned read pending时点击disabled CTA；显式等其enabled后85/88通过，保留原所有URL/noqueue/noautoepisode断言。最终真正 GREEN 用81、88、86，不把79/80/82重命名或删掉。

## 明确保留的边界

- global 既有同证券 canonical-unknown / broker fallback 混组仍可能显示为 live，这是 root 裁定保留的 shared-scope 旧行为。本票不修全局账本/分组；显式 unknown 可达性测试用独立证券，不伪造性质；首页严格集合测试用同证券 unknown 证明排除。
- period=all 与 URL scope日期的兼容投影是当前P1交接规则；后续P2/S需统一初始化与用户清全部日期行为。本轮只保证完整日期URL不被擦除。
- 候选2真实完整值可见/遮挡/鼠标键盘、copy/selection手感、emulated/physical touch、两宽同态视觉、真实保存→返回→reload、全部guard动作、0/1/5/8/9/50和完整动态控件实例仍由root独立执行，当前NV。
- lint 84 exit1：Workspace既有cash effect同步setState规则错误，baseline60同一根因；14warnings。保留FAIL，未借本票扩大现金effect修复。
