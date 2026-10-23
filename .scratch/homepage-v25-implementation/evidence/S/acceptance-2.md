# S 第 2 轮独立验收：FAIL

协调者 /root。提交的7测试已重新运行，但独立Node反例仍失败：serialize的accounts=*无法parse；scope内注入businessRows仍通过快照白名单；custom同时携带date不被拒绝。scope key重复包含未规范化attachments，语义相同的条件顺序可能不一致。

代码审查：成功提交将完整draft含attachments塞入scope，而独立snapshot.attachments仍旧，出现双重权威；scope未严格校验空账户/时间模式关系。来源快照依然缺期间快捷项、历史图模式、搜索结果滚动/选择/焦点、精确原触发对象焦点，每模式下钻仍混有共享selected字段。validDate对非法月份可抛异常。尚未提供实际的对象消失焦点回退合同。

下一次为最后第3轮：必须补齐、执行所有反例和真实适配说明；若仍有必需失败则暂停S及其依赖P1，不继续重命名任务绕过。
