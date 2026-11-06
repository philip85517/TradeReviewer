# 交易库单元测试诊断进度

## 本轮范围与前置

用户要求使用 Terra 6.1 Ultra 并行诊断、修复和验证，以有意义、尽量不重复的测试争取约 95% 分支覆盖；触屏和窄屏本轮不开发、不验证。用户已确认导入校验、练习保存与重复导入、读取及返回状态、练习统计四类公开测试入口。三位 Terra 分别负责导入、存储与统计，使用互不重叠的写入范围。

## 当前证据

- 当前工作树的十个相关测试文件共 512 项通过；这是既有测试基线，不代表全链路或全部分支覆盖。
- 三个 Terra 6.1 Ultra 分别只读检查导入、存储和统计。网页入口测试多采用模拟接口，路由测试则单独检查存储，不能以此证明网页到真实保存、返回与重开这一整条链路。实际浏览器和隔离数据的已有局部验收仍以原记录范围为准。
- 保存失败保护需要补充“库中已有练习，再发生新导入失败”的行为证据；目前是测试缺口，不是已确认的数据丢失。
- 统计纯计算函数接收极端输入 `1e1000000000` 时会因数值精度配置抛错；该计算尚未接入统计页面，也无证据表明正常交易金额受影响。可接受的数值范围和异常行为需要在实际实现时依既有合同谨慎判断。
- 文件名证券不一致的处理以现行 I10 冻结合同为准：冲突时阻止导入；更早规格中的不同表述不能单独作为当前缺陷依据。
- 当时项目没有安装 Vitest 分支覆盖插件，本机离线缓存也未能提供对应版本；安装一度因证书链校验失败。该障碍已在下方后续记录中解决；不能以测试数推算覆盖率。

## 本轮测试和修复

- 导入：新增公开入口测试，覆盖文件名标的冲突，以及无日期文件名配合多条无效历史时间时定位原行。新增测试首次运行已通过，是补齐证据而非声称修复了缺陷。专属 Luna 独立复核 SPEC/QUALITY PASS。
- 保存：新增真实客户端、路由和隔离 SQLite 的事务失败测试，验证失败后原有练习不变，并以原请求重试。新增测试首次运行已通过；专属 Luna 独立复核 SPEC/QUALITY PASS。不等同于真实浏览器验收。
- 统计：先新增极端值测试并复现 `DecimalError`，再限制所需计算精度，超出范围时返回带原因的未知值。RED 命令 `npm run test:unit -- app/lib/trades/practice-metrics.test.ts -t 'extreme finite amount'` 退出 1，修复后退出 0。Luna 第一次审查发现同尺度极端数值被错误拒绝，第二轮先用 5 个失败测试复现并修复；随后补充绝对指数边界测试，共 74 项通过，最终版本经专属 Luna 独立复核 SPEC/QUALITY PASS。原始 RED 输出保留于执行记录，没有另存日志。该纯计算模块尚未接入统计页面。
- 全量测试在上述修复过程中运行：337 文件中 325 通过、9 失败、3 跳过；3663 项中 3617 通过、40 失败、6 跳过。部分失败由本机监听权限或测试超时造成，不能一概判断为产品缺陷；结果未在修正后全量重跑。旧断言预期 schema 14、实际 15，证券冲突夹具缺日期，以及迁移版本断言假定 14 是最后版本，均已修正、定向验证并经专属 Luna 独立复核通过。
- 两个交易库返回相关用例单独复跑均通过，其中一个需放宽总时限。它们使用模拟存储，不证明真实浏览器或实际持久化通过；全量运行中曾出现找不到图表工具栏，具体原因仍未确定。
- 协调者重跑相关的 14 个测试文件：604 项通过；全项目 TypeScript 类型检查通过，相关文件 ESLint 0 错误、1 条既有测试警告。该测试集不证明 95% 分支覆盖，也不证明整体产品或全量测试通过。

## 状态

针对发现的缺陷先复现失败再修复；行为本已正确时补充回归测试，不伪称先有失败。保留独立验收、回归结果及问题轮次。项目资料归档问题不属于本轮产品范围。

## 2026-10-27：覆盖工具与旧测试扫描

- 安装 `@vitest/coverage-v8@4.1.10`，与 Vitest 版本一致。使用本机证书补充 Node 信任链，未关闭 npm 证书检查。
- 下列指定的 12 个测试文件共 345 项通过。所选 12 个生产文件：分支 720/798（90.22%），行 506/510（99.21%）。未达到约 95% 分支目标；此数字不代表整个交易库或整个项目，工作区、练习日期、范围以及数据库核心等未被纳入。部分路由没有被工具识别的分支，显示的 100% 不能证明其分支已验证。
- 测试扫描后，将仅对旧界面源代码文本进行匹配的 `tests/focused-review-ui.test.mjs` 移至 `archive/tests/focused-review-ui.test.mjs` 并调整相对路径；它已从 `npm test` 移除。当前交互相关行为仍由 `trade-library.test.tsx`、`review-chart-workspace.test.tsx`、`trade-review-workspace.test.tsx` 等测试覆盖，不能声称与旧文本断言逐项等价。归档测试可手动执行：`node --test archive/tests/focused-review-ui.test.mjs`。
- 发现 `recall-integration.recall-review.test.tsx` 中一组测试完全重复；保留其中一份，另一份存为 `archive/tests/recall-future-global-drawing-duplicate.txt`。保留的测试单独运行通过。历史数据兼容、部署等仍有用途的测试保留；不存在以测试失败为理由归档的情况。
- `vitest list --filesOnly --staticParse` 列出 337 个活动测试文件，没有归档路径；`npm test` 构建及 4 项运行测试通过。`npm run typecheck`、`git diff --check` 通过。本轮未重新执行完整 `npm run test:unit`，因此不能推断全量回归通过。
- 独立 Luna 审核归档：重复片段与删除的副本逐字一致；Recall 整文件 39 项通过；归档的旧界面测试手动运行通过。重复片段为依赖原测试上下文的 `.txt`，不可直接执行。当前归档排除依赖明确的 Vitest include 和 `npm test` 文件列表，若将来调整这两处，应继续检查归档是否进入默认回归。
- 独立 Luna 审核安装：依赖版本和锁文件一致，相关额外锁文件变化来自覆盖工具依赖链；复核覆盖计数与测试范围，没有独立重跑覆盖命令。工具安装时 npm 报告 30 项依赖审计问题，尚未分析来源或影响，不能判断由此次安装引入。
- 后续可继续核对的业务测试缺口：真实存储遇到多个候选身份时是否可靠地拒绝误关联，详情响应中的练习 ID、版本关联和来源字节不一致是否被拒绝，以及服务端返回非 JSON 内容时客户端如何报告。属于源码和现有测试对照发现的待验证点，尚不能认定为产品缺陷，也不能由覆盖率摘要直接判定对应分支数量；已有流程已覆盖网络请求抛错，无需重复添加同一用例。

复现上述覆盖率范围：

```sh
npx vitest run app/lib/import/practice-import.test.ts app/lib/import/practice-csv-source.test.ts app/lib/import/tradingview-practice-source.test.ts app/lib/storage/practice-store.test.ts app/lib/storage/practice-http-client.test.ts app/api/storage/practices/route.test.ts app/api/storage/practices/preview/route.test.ts app/api/storage/practices/commit/route.test.ts 'app/api/storage/practices/[practiceId]/route.test.ts' app/lib/trades/practice-history.test.ts app/lib/trades/practice-metrics.test.ts app/components/practice-source-view.test.tsx --coverage --coverage.provider=v8 --coverage.reporter=json-summary --coverage.reporter=text --coverage.include='app/lib/import/practice-import.ts' --coverage.include='app/lib/import/practice-csv-source.ts' --coverage.include='app/lib/import/tradingview-practice-source.ts' --coverage.include='app/lib/storage/practice-store.ts' --coverage.include='app/lib/storage/practice-http-client.ts' --coverage.include='app/api/storage/practices/**/route.ts' --coverage.include='app/api/storage/practices/route.ts' --coverage.include='app/lib/trades/practice-history.ts' --coverage.include='app/lib/trades/practice-metrics.ts' --coverage.include='app/components/practice-source-view.tsx'
```

## 2026-10-27：依赖审计与覆盖率补充

- npm 审计由 30 项降至 0 项；更新 Next、React、PDF.js、Vite、Vitest、Cloudflare 工具及其锁文件，并对部分间接依赖指定修复版本。重新安装使用 `NODE_EXTRA_CA_CERTS=/etc/ssl/cert.pem`，没有关闭证书检查。`npm audit --json` 和 `npm ls --all` 均退出 0。依赖升级由未参与实现的 Luna 独立复核通过。
- `pptxgenjs → image-size` 和 `@esbuild-kit/core-utils → esbuild` 的覆盖版本超出上游声明范围，是后续升级时需重新验证的兼容风险；实际 PPTX 导出 11 项测试和隔离目录的 Drizzle 迁移、加载器检查通过，不能证明所有依赖运行路径均已验证。
- 在原有相同的 12 个生产文件范围内，使用上方覆盖命令重跑：12 个测试文件、397 项通过；分支 761/798（95.36%），语句 707/722（97.92%），行 509/510（99.80%）。起点为 720/798（90.22%）；这些比例不代表整个交易库或项目，部分路由没有可识别的分支亦不能由 100% 推断完整验收。
- 补充了导入来源与格式校验、冲突和失败提示、读取异常和竞态、保存时再次校验及失败保护等可观察行为。生产代码原本已满足新增断言，新增测试首次运行通过，不宣称修复产品缺陷。对既有界面测试补强了原始行号、保存/返回回调和迟到响应的断言。各执行者的工作均由独立 Luna 复核并运行相应定向测试，最终 SPEC/QUALITY 通过；组件取消测试只证明组件回调，父层真实网络取消未验证。
- 最终 `npm test` 构建及 4 项运行检查、`npm run typecheck`、四个本轮测试文件的 ESLint 通过。全项目 ESLint 运行两分钟后主动中止，结果未确认；全量 `npm run test:unit` 未重跑。按用户范围排除触屏、窄屏检查；本轮不代表真实浏览器、持久化返回/reload 或视觉验收通过。

## 2026-10-27：用户新决定后的旧测试复查

- 先按测试文件、重复的测试正文及相关上下文扫描。`recall-plan-sidebar.test.tsx` 中一组完全相同、位于同一测试上下文的侧栏断言保留首份，另一份原样存为 `archive/tests/recall-plan-sidebar-duplicate.txt`。独立截图回归文件的唯一用例，与 `layout-detector.test.ts` 中使用相同夹具和断言的用例重复，旧文件原样归档至 `archive/tests/layout-detector-regression.test.ts.txt`。这两份归档为历史文本，不能直接执行；日常 Vitest 配置不包含 `archive/`。
- 保留的两个测试文件运行 `npm run test:unit -- app/components/recall/recall-plan-sidebar.test.tsx app/lib/import/screenshot/layout-detector.test.ts`，共 27 项通过。测试发现 `module.register()` 弃用提示，不影响该次结果。
- 不参与归档的 Luna 6 Max 独立核对归档原文、两份保留断言与测试上下文，并独立复跑上述命令：2 个文件、27 项通过；协调者另核对 Vitest 静态列表为 341 个活动测试文件，归档目录及该旧回归文件均未进入列表。Node 直接运行的日常 `npm test` 也使用固定文件列表，不包含归档目录。
- 主工作区和导入流程文件内有一组同正文的回放失败测试，两份的 URL 初始化、网络及服务 mock 不同，暂保留；两份的断言只检查错误提示，不足以证明回放确实停止或可以恢复。旧版交易库界面测试混有筛选、复盘和返回等仍有效行为，暂保留，待 V2 页面替换时逐项迁移有效检查，不整文件归档。该扫描不等于已证明所有其他测试均非重复。
- 协调者再次运行前述限定 12 个生产文件的覆盖命令：12 个测试文件、397 项通过，分支 761/798（95.36%）。这只是该选定范围的现状，不代表交易库全部代码或全项目；后续 V2 新增的资金、迁移和完整用户链仍需补测。全量单元测试本轮未运行。
