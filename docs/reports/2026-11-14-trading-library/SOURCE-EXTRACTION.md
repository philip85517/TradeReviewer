# 来源选取账与迁移价值

> 2026-11-14 正式归档：以下为原评审时点的结论；本次仅整理文档，没有重新执行产品验收。候选源码按 [来源与版本](SOURCES.md) 定位。

最终17701786，root。来源路径与SHA256保存在 [SOURCE-MANIFEST.json](evidence/frontend/SOURCE-MANIFEST.json)。原实验的完整冻结副本位于 `.scratch/library-frontend-mock-20261113/evidence/source/`，不包含在本次精选归档；[最终再次核验](evidence/frontend/source-freeze-check-final.json)9/9 当前源文件、冻结副本及预期SHA一致。25db 含 dirty/untracked 模块，未把其 HEAD 当作可整体 cherry-pick 的功能；未修改来源文件。实现模型为用户选择 `gpt-6.1-terra`。

|来源冻结位置/范围|最终目标|迁移裁决|取用与剔除|实验证据/成本|
|---|---|---|---|---|
|library-practice-list.tsx:172–203 / .css|practice-list.tsx / .css|重构后复用|保留条件→表格→分页、完整练习名、独立成交/配对/残余计数及颜色。剔除64–156默认HTTP、全量数组、浏览器filter/sort/slice和多处局部状态|实际6/6/1、13对象旅程、unknown/极值与多尺寸通过。成本在于页DTO、受控交互、状态槽/重试、长文本及表格稳定性|
|library-practice-detail.tsx:279–370 / .css|practice-detail.tsx / .css|重构后复用|保留配对→四平级指标→时间/来源层级；移除8/244–266旧financial bundle副作用、legacy模型及配对金额再投影|单对象/7配对页、准确身份/财务分解、104卡4/2/1列通过。成本含财务Fact、自然页高、长值、只读上下文和返回接线|
|practice-date-filter.tsx/.css、practice-date-range.ts|同名新作用域控件/纯规则|重构后复用|保留快捷范围/单日/区间与校验；独立受控value/onChange、测量定位、portal焦点；不读取数据|六模式、非法范围、Escape/取消/外部关闭及日历矩阵通过。成本是受控改造、定位/键盘与URL一致性|
|trade-library.css|preview.css|选择性复用|取E方案72/64/58框架、颜色、字段/表格密度，局部.library-preview承担滚动|1440/1280/断点/390比较通过；成本含作用域、单独滚动及详情响应式修正|
|practice-detail-financial.ts|不迁入|仅风险证据，读取组织另设计|旧读链、identity及金额映射不能成为新接口；展示只接单对象财务Fact|未导入，不能因新页面通过就接受旧财务服务/来源保护|
|旧Browser/workspace/HTTP/store/parser/bootstrap|不迁入|旧读取/装配链放弃整体迁入|新DTO、Mock端口、请求/URL/返回owner独立建立；旧来源解析、全库统计及存储能力不搭载|依赖闭包/消费者计数/生产guard/无业务API联合证据。真实adapter仍待review|

这是展示结构及纯规则的重构式复用，已经付出拆依赖、重写装配、状态/身份/导航、金额unknown和视觉异常修复的工程成本。它证明“保留好的前端”可行，不能据此低估将来真实接入成本；没有凭该实验给出无依据的人日估算。

最终33个产品文件的路径/hash见 [manifest](evidence/frontend/final-manifest.json)，功能/状态/视觉见 [接受记录](FRONTEND-PROGRESS.md)，旧性能及分模块原裁决见 [逐模块判断](VERDICTS.md)。首次源码/参考预读及历史测试顺序存在流程缺口，明确保留而非补记合规。当前只形成前端基准，不批准后端/数据迁移。
