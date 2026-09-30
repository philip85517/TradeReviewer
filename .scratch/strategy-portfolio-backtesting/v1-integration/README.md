# 策略工作台迭代V1 × A：共同设计入口

日期：2026-09-30。用户已要求合并两条现有设计线。本轮产出[融合设计规格](../../../docs/specs/2026-09-30-strategy-workbench-v1-integrated-design.md)，统一信息架构、状态交接、视觉规则和下游验收；不新增第三套页面，不将静态V1画板与A内存原型伪装成已接通的产品。

## 阅读顺序

1. [融合设计](../../../docs/specs/2026-09-30-strategy-workbench-v1-integrated-design.md)：IF01–10。
2. [设计覆盖表](DESIGN-COVERAGE.md)：逐项来源、元素、旅程与实际接线待验证项。
3. [独立设计一致性审查](REVIEW.md)和[本轮文档验收](ACCEPTANCE.md)。
4. 局部细节继续参考[V1模型](../strategy-library-interaction-model.md)、[V1修订06](../strategy-library-wireframes/STYLE-06-CONTRACT.md)、[A回放修复](../workbench-design/REPAIR-03-CONTRACT.md)、[A原站风格](../workbench-design/STYLE-04-CONTRACT.md)。

## 已归并的决定

- “策略库 / 我的实验”为业务入口，工作台属于某次实验；通用新建实验只归我的实验。
- V1保留三类包、策略组装/复制、规模管理、查询和四步创建；确认后以真实所选配置进入A待开始。
- A保留固定分区、文字动作、图表和回放状态；应用导航展开/收起共用状态，不能因进入工作台自行换宽度。
- 两侧使用原站主题token和字体；V1最新面包屑、表单与文案规范适用于共同设计。局部密度和详情容器按职责保留。
- 配置/包详情逐层返回；历史版本不升级；库内复制策略与派生实验分开；运行/组合/日期/视野/暴露记录不因导航重置。

## 当前范围与任务

09/11继续open，10保留既有依赖；本文件没有解除用户反馈、融合画板、首次用户研究或真实接线验收。已向“策略工作台迭代V1”协调者同步融合路径，由其在09/10、模型和规格入口建立引用。本任务只修改11与工作台侧设计索引、旧关系图和本目录；没有覆盖V1正在修改的生成器、19张画板或修订06验收。

现有两个预览仍独立：[V1我的实验](http://127.0.0.1:3062/#f14)、[A工作台](http://127.0.0.1:3051/?variant=A&scenario=complete)。这些为来源预览，不是新的统一业务预览；本轮不重新签署其UI验收。启动方法分别见[策略库画板README](../strategy-library-wireframes/README.md)和[A验收/启动](../workbench-design/STYLE-04-ACCEPTANCE.md)。
