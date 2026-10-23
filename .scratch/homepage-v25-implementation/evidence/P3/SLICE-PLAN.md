# P3 单 owner 首条旅程实施计划

2026-10-23；实现 integration_g61，gpt-6.1-sol / ultra；独立视觉/数据流接受 root。P3 0/3，P1 2/3 FAIL 历史保留。本文件不是 implementation-ready。

已完整重读批准正文668行、ROOT-DISPATCH、PRE-DISPATCH、当前 S3 INTERFACES、visual-contract 与 Search/Filter/Select/Token/DataTable 手册。40张原图全部按原尺寸栅格读取，四张一板的10张阅读板在 `reference-readback/sheet-{1..10}.png`；这是参考阅读证据，不是产品截图。HV25-07..13、23..30、44..49、53..55及96公共状态分母不变。

## 分段与接线

1. **真实已知目录**：首页内新纯 adapter 合并 owned bundle 的 entries 与 stored instruments；保留名称、代码、交易所、币种、类别、交易来源覆盖。官方 exchange 经现有 runtime validator。重复同身份可合并 instrumentIds；类别/交易所证据冲突显式不可解析，不采用首项/末项。目录不受首页当前市场/账户限制，搜索不改 scope。缺类别不猜股票；缺交易所不伪造 US identity。目录也供 host 身份验证与 ordinary instrument 集合使用，避免不同版本目录。
2. **首条搜索/详情**：snapshot.search 为唯一可持久 UI；300ms/IME输入只延迟查询，开关/查询/滚动/选中/trigger均由现有 S onUi 保存。搜索 max960，外侧至少24；inert、焦点约束、Esc/外侧关闭和关闭后触发器焦点。目录结果→复用四核心 KPI 详情容器；metadata-only 无持仓数量/成本/市值/浮盈/天数均未知并说明，绝不借首行数值。详情外侧不关闭，Esc/关闭回原结果。
3. **精确普通库与返回**：同一目录 identity 映射 exact instrument 集合（含类别），沿已接受 homepageNavigationScope 与 owned read；不带 queue。跨市场按当前范围交集如实为空。跳转前保存搜索上下文，guard取消不关闭/不提交来源；返回/reload读取最新 bundle 后恢复 search query/scroll/selection/focus，目录对象消失回搜索标题并说明。完成后交 root 局部 checkpoint，实际浏览器/两桌面/窄屏由 root 操作。
4. **独立门后才扩展附件**：S draft/committed/request唯一 owner，纯 group 资格 projection 供四区消费，categories OR、openOnly真实零、pending yes/no/unknown，组间 AND。完整历史不被日期/回合片段裁掉；不重写 F 账本。再补33反例、标签/应用/清除/恢复默认/失败/迟到与96登记。

## 本切片 TDD 与边界

先 catalogue RED（metadata-only、同代码不同 exchange/class、缺/冲突 exchange、未知类别）；再实际 HomeSurface RED（打开/IME/结果→无持仓详情→关闭焦点与源UI）；最后 workspace 真实目录→ordinary→return集成测试。原 P1 三个 aliases/两个 stale DOM 只修端点/定位，保留业务断言，定向一次确认。现金 lint独立提案，不混入 P3。

允许 homepage-v25/**、必要workspace/测试与既有有限 metadata 消费；不改 F/S、provider/schema、全局样式、旧 dashboard/replay、配置依赖；不操作服务/浏览器/DB、不派代理。局部通过不能代替真实浏览器功能/持久化/视觉接受。首次局部 checkpoint 前不实施附件 UI、P2/P4。

## 当前未验证

所有 P3 产品旅程、实际输入方式、响应边界与视觉均 NOT VERIFIED。触摸合成事件仅单测，不作为 emulated/physical touch。纯目录覆盖仅真实交易+已存metadata，不宣传全市场。冲突类记录需由事实证明，未知始终保留原因。
