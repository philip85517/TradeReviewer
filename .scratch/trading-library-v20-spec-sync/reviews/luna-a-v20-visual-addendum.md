# Luna A：V2.0 最终静态图稿视觉补充验收

日期：2026-10-26  
复核模型：GPT-5.6 Luna，Max  
结论：**PASS（静态图稿视觉范围）**；未发现新的视觉阻断。

## 实际渲染与查看方法

本补充只覆盖静态 SVG，不操作产品 UI。依据正文 `docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md:61-87,124,161-169,218-227,277-300`，选取六个关键状态和当前全部三张 1280 图。用本地 SVG 渲染器生成原尺寸 PNG，再逐张用 `view_image` 实际查看；四张批准 E JPG 也在本轮用 `view_image` 实际查看并作外壳、密度、层级、尺寸和颜色对照。

渲染截图保存在：`.scratch/trading-library-v20-spec-sync/reviews/luna-a-v20-visual-screenshots/`。截图为视觉证据，不代表产品交互或数据库验收。

当前工作树构建物字节 SHA-256（root 已重建 reader 后读取，未再次构建）：

- `visual-spec.html`: `335fe8cb787f7f13602012238bff33bb702acf7980a1a82b000de2d9ddea8e4c`
- `document-manifest.json`: `9fe687bb9b23ba8b60af40635798447d65a09b43d51e48396cbcdb61e1e069da`
- `document-identity.json`: `c9f6251e143a5c72d2a67295d9d36cff0bc32c13d804cd1aa7a554e072bf530e`

V2.0 source / generator / fixture 内容指纹仍为：

`dd25c5dab416ff1c24b1abd02fdd8212b79ae90eb5456846a7c3e59f751aca43` / `d3ad5ffd6a31fb7fa0f9b8bd9573e649d2998c97c9c16fdbd1a50cece8923d09` / `d3a9639acb518a95a94924c568d9b957831679838c8f43c8eb897e967e72951e`。

## 六个 1440 关键状态

| 图名（正文语义） | 原尺寸 | SVG SHA-256 | 渲染 PNG SHA-256 | 实际查看结果 |
|---|---:|---|---|---|
| `journeys-library-list.svg`（实盘普通列表） | 1440×1000 | `32110b5af7036da92624c644975a203bc0ebccb5669a4b92be47c1f90ec72862` | `d72f8171b6a8777dc2f6cd2c6210be8a32f571fdbd957f56d567065ffaa9ed25` | PASS：E 的 rail/header、模式 tabs、条件栏、表格密度和深色层级保持一致；成交日期/状态/搜索/刷新/分页均清晰，控件没有右侧溢出。 |
| `01-live-normal.svg`（实盘统计） | 1440×1000 | `9c64b78014d5596fb3ff0949c9a2caa8de8a3004b6596c98fbefdfe475bf1891` | `375fee6c7306d8b8bd7aa9b97ad9fad35f97d80d7565846429fd1291a5db14a7` | PASS：六张指标卡、回合平仓日趋势、分布条形与正负颜色层级清楚；与 E 实盘统计的卡片→趋势→分布顺序相符。 |
| `hcr06-final-sim-ab.svg`（模拟练习列表） | 1440×1000 | `2d8708bbf94155e1367775687c822bd971ccb8646790a5e15f133de2c1f09c2f` | `10d82ffb181032e7e024f19b7b92229927cbc6bc13810a2c0d2f57ca22a83134` | PASS：模拟模式、练习日期、六行练习、`#01/#02` 身份、成交明细/内部配对/余仓列均可读；与 E 模拟列表的外壳和行密度一致。 |
| `02-simulation-normal.svg`（模拟统计） | 1440×1095 | `b94c97b35db80ed6b5ecf70aeb5b63aaee38c855db0547b86e271c4c5c424731` | `87b775a11b3b20b579e0c8b1a45a2ac6c872f49a70ba71d1a185873e996ec4ee` | PASS：8 张模拟统计卡、未知样本、按练习日期趋势和练习数分布均清晰；自然增高到 1095px，没有裁切或重叠，符合正文 `:61` 的纵向增长合同。 |
| `hcr06-final-rounds-a.svg`（模拟练习详情） | 1440×1000 | `3f4c98f04bd7be65ae63b7d977ce8f32d573dd176ba258f7c26d3ac7c6ca9ebf` | `9f4036605ad858128f82d3450801f0fd0282dc87f4337f7c1bc8747e748c1a2b` | PASS：内部配对表与闭合净盈亏、已平仓费用、余仓、留存开仓费用四个指标形成清晰层级；空白下方是自然留白，没有截断内容。 |
| `hcr06-final-replay-a1.svg`（模拟内部配对回放） | 1440×1000 | `da4f33949b554dc838b09eeb5f55af54c9f7bac65f6cec64fb37b32b8e767a37` | `bb36658a08067afc0c10d3702a2def0721d78aeb7adafd37ab2443527e1e92b0` | PASS：配对 tab、开/平仓定位、K 线标记、数量/价格/费用/净盈亏和“返回练习详情”均清晰；没有把模拟配对回放误标成实盘回合集。 |

## 三张 1280 图

| 图名 | 原尺寸 | SVG SHA-256 | 渲染 PNG SHA-256 | 实际查看结果 |
|---|---:|---|---|---|
| `hcr06-final-pending-library-1280.svg`（实盘待复盘列表） | 1280×800 | `0cc3a5065bbf83c4cbbc7e60d74560805e2daf9278765332d6360e9e2e3f27f4` | `2d1d4606e6ea8575e52cd67cd09986f411bbcf73520b343603a1e3fa72dd4596` | PASS：待复盘筛选、搜索、刷新、表格和右边界在 1280 内完整可见，状态色可分辨。 |
| `journeys-date-1280.svg`（实盘日期入口列表） | 1280×800 | `f02b5ced522280eaf4f6a486119ea21881b401c5a9937d3f43d76457611908c3` | `453b6d444959a983fc148032f44b231b78d21d7289670d84189b334be9f783ae` | PASS：单日条件、单行结果、日期/标的/代码/数量/价格/费用/状态均可读，窄视口没有压叠。 |
| `journeys-library-list-return-1280.svg`（实盘列表返回焦点） | 1280×800 | `01690e33c54340959487afdf6ed10abca446d3e6cbbfcebf8e95f37e54da6591` | `3e89e806138f205ecbd4d5bd1f824564f2de83b61a4b1b928cf300eec52b4f61` | PASS：日期范围、分页、返回后的贵州茅台行焦点边框清楚；分页控件与右边界保持间距。 |

## 对照结论与边界

四张 E JPG 的可见合同是 72px rail、64px header、二级 tabs、深色 navy surface、蓝色控件、绿色正值/红色负值和卡片→趋势→分布层级。九张最终渲染图均保持这些结构和密度；模拟统计自然增高是正文明确允许的状态增长。E JPG 底部的视觉样例工具属于参考页辅助内容，当前静态状态图不复制该工具，不判为缺失。

本次实际查看没有发现文字裁切、关键控件溢出、颜色语义反转、实盘/模拟模式错标、模拟详情/配对回放返回语义错误或 1280 可读性阻断。此补充只证明静态渲染图可读且符合 E/正文视觉合同，仍不声称产品交互、持久化、数据库或真实回放已通过。
