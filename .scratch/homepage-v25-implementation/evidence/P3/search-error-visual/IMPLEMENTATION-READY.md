# CR03 搜索错误视觉有限候选 — implementation-ready

2026-10-23；state_g61，实际模型 **gpt-6.1-sol / ultra**。**两份产品源码已经冻结，停止修改，等待 root 独立实际验收。P3 正式仍 0/3；本报告不签 visual PASS 或 accepted。**

## 原始失败、规格与根因

触发为 root 在 CR01/CR02 的真实503路径完成有限功能复验后，直接看图发现错误区偏离原稿。原失败 `../search-recovery-fix/root-http503-after-keys.png` 保留；本代理只读该图，未访问浏览器/HTTP/数据库、启动或停止服务。root 报告的77项组合通过及真实CR01/CR02功能有限通过，仅作为本次任务背景，不能抵消原始视觉 FAIL。

已完整读取当前 workflow、frontend-control-audit、task-decomposition、UI 模板、`ROOT-DISPATCH.md`，核对最新 DESIGN-COVERAGE 末尾。精确依据是 HP03 `visual-design.candidate.md:130–160` / HOME-HP03-B019、manual `component-manual.html:370–455`，以及完整原 `source/images/search--empty.svg` 第三个 GlobalEntitySearch 和 `search-error-frame.svg`。直接看过派生 `../reference-readback/search-error-frame.png` 与上述真实失败截图。覆盖ID为 **HV25-08 / CR03**；无原 elementID。派单中 CSS 文件名笔误已由 root 明确更正为实际 `home-surface.css`，不是扩大范围。

失败前的错误分支只有无专属类名的 `div[role=alert]`、段落及普通重试按钮，因此落在结果区正常流的左上，继承14px白色正文和通用按钮尺寸/背景。根因与单一假说、参考坐标及候选边界先记录于 `02-CAUSE-AND-CANDIDATE.md`，之后仅实施一次补丁。

## 唯一候选及完整差异

- `home-surface.tsx:321`：只为现有错误 wrapper 增加 `hp-catalog-error`，现有重试增加 `hp-catalog-retry`。**原因原文“证券目录读取失败，原查询仍保留。”、role、onReload 及所有状态/键盘逻辑原样保留。** 完整 before→after 见 `05-markup.diff`。
- `home-surface.css:130–132`：仅新增三个局部选择器。错误原因16px/24px、`#FF8592`、居中可折行；重试88×36、6px圆角、`#111A26`背景、`#283448`描边、14px/20px `#E6EDF7`文字；沿用既有 hover/active/focus 规则。完整 before→after 见 `06-local-css.diff`。
- 错误容器使用满高居中 flex、24px间隔和80px底部留白，使内容组相对几何中心约上移40px，对应原稿结果框430高、文字基线150/按钮顶部180的略偏上位置。这是静态候选的布局意图，**未由渲染测量确认**。现有原因较原图短标题长，按派发保留，不删文案迎合视觉。

搜索舞台、输入、结果容器的既有尺寸/锚点/overflow、loading/empty/结果 markup、CR01滚动恢复、CR02键盘守卫、IME/300ms、详情/source-return、host/session/S/catalog/Workspace 均未修改。没有改旧测试、新 search-recovery 测试、依赖或共享 tracker。原字节副本 `home-surface.before.tsx` / `home-surface.before.css` 与 `01-before.json` 保存补丁前版本；`08-after.json` 的16个受监测文件只有两份授权产品源码变化，未发现额外变化。

| 文件 | before SHA256 | 候选 SHA256 |
| --- | --- | --- |
| Surface | `c6e14890fe36eb99e2dd03ba43608f7ced1ad482bdb57a757e09b8884f4d30b6` | `84897ee2c53bf1c8a81428dcf2e4997cef326b065d58dacae036a2e2b9d2b6c2` |
| CSS | `d34b54ab5eb9b5232847607d3b5c94e9b93833da3703b2292793066e6dff43d1` | `b7160f103035966877256ecb04aaf4d10a185af272a6c3476b5cbee5771f7cb8` |

受保护 `search-recovery.test.tsx` 仍为 `840df3f07bf2debfc5da27bb043ce523292b5fe45dc4a45c9984bac379e72ff5`；host仍为 `3218407b84c45656989bc0a2ac700c9741e6c55135f55ed2873e7ed2b968b167`。完整输入与最终绑定见 `SOURCE-MANIFEST.freeze.json`；报告与日志/差异的绑定见 `IMPLEMENTATION-FREEZE.json`。没有以当前工作树相对 HEAD 的累积差异冒充本候选差异。

## 验证记录

全部使用固定 Node **v26.0.0**，绝对路径 `/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node`。`run-check.mjs` 记录完整 stdout/stderr 与真实子进程退出状态；外层 runner 退出码不代替 status 文件。未跑全量、构建或运行时服务。

| 检查 | 原始证据 | 结果与边界 |
| --- | --- | --- |
| 既有搜索/Surface/目录29项 | `03-regression.log` / `03-regression.status.json` | **29/29 PASS，4文件，exit0**；20:41:25.239Z–20:41:46.160Z（04:41:25–04:41:46 CST）。CR01同挂载非零scroll/query/selection/focus、CR02四种阻塞/恢复、IME/300ms、既有详情与目录回归。不是新视觉几何测试 |
| Surface有限ESLint | `04-lint.log` / `04-lint.status.json` | **exit0，0error/1既有warning**：`:131:6` detailId hook dependency，与原候选基线一致；未压制或顺手修规则 |
| CSS语法 | `07-css-syntax.json` | PostCSS8.5.23解析通过；仅识别到三个新增错误局部选择器。不是CSS lint、渲染或几何证明 |
| 受保护输入一致性 | `01-before.json` / `08-after.json` |16项前后对照只有授权两源码变化；原测试、host/session/S/catalog和准确参考不变 |

运行命令（`node` 均指上述固定绝对路径）：

```sh
node node_modules/vitest/vitest.mjs run app/components/homepage-v25/search-recovery.test.tsx app/components/homepage-v25/search-surface.test.tsx app/components/homepage-v25/home-surface.test.tsx app/components/homepage-v25/catalog-model.test.ts --reporter=verbose --maxWorkers=1
node node_modules/eslint/bin/eslint.js app/components/homepage-v25/home-surface.tsx
```

本次以 root 已独立保存的真实视觉 RED 为失败依据，按明确范围不修改/新增测试，未编造 jsdom 几何断言。运行器既有 DEP0205 弃用警告保留。未进行额外typecheck；产品仅新增两个className字符串及独立CSS规则，有限检查按派发收口。

## 受影响控件、状态与 root 独立清单

全部实际交互和视觉结果在本候选报告中均 **NOT VERIFIED**。root唯一负责真实浏览器及整页视觉/数据流，本代理没有把容器可见或组件通过登记为实际 PASS。

| 控件/关键状态 | 原文/原图与可观察oracle | 本地证据 | root待验 |
| --- | --- | --- | --- |
| 搜索错误原因 | HP03/manual错误恢复；两精确SVG错误态。1280×720 DPR2下原因仍可见、红色16px、水平居中、组位置接近参考；舞台/输入/结果区边界不漂移 | markup只加类；三条局部CSS；原503图继续FAIL | 实际503后截屏并与准确参考匹配状态对照，量颜色/字号/位置；不可仅看alert存在 |
| 重试 | manual错误→恢复；SVG88×36/6px/描边。鼠标重试进入真实读取，恢复后查询仍在且结果可选；Tab可达、有焦点外框 | 既有onReload原样；明确静态按钮样式；29回归不证明网络重试 | 实际重试和恢复，核大小/边框/hover/focus；实际服务/读取结果由root记录 |
| 错误中的输入/Enter/方向键 | manual失败保留查询；CR02阻塞旧候选，不改selected/source；错误态重试不能被方向键当候选 | search-recovery四阻塞+四恢复PASS；守卫完全未改 | 实际错误输入/按键仍不打开隐藏旧详情；恢复ready后Enter可打开真实结果 |
| 关闭/重开及搜索→详情→返回 | HP03/manual查询/原结果位置/焦点规则，CR01非零滚动返回；错误样式不应改变正常结果行或滚动区域 | CR01和现有search-surface通过；未改结果容器/行样式 | 真实非零滚动→关闭重开及详情返回，核query/selection/scroll/focus；source-return视root组合版本实测 |
| loading、初始、no-match、目录空 | manual各状态区分；错误局部选择器只挂错误分支，不将pending或空态画成失败 | 原分支原字节保留；29定向回归 | loading/empty/no-match的实际区分与不混同；本次不声称这些旧状态已做新视觉验收 |

其它响应式边界、物理触控均 NOT VERIFIED；键盘逻辑单测不等同实际键盘/物理输入法。此次无新业务写入，数据库写入持久化门对局部补丁 NOT APPLICABLE，不能因此跳过实际503/恢复/导航及独立视觉门。没有新设计豁免。

**implementation-ready，仅此有限候选；已停止产品修改，等待 root 独立验收。原视觉失败和历史CR01/CR02 RED均保留，不推进其它P3范围，不自行签accepted。**
