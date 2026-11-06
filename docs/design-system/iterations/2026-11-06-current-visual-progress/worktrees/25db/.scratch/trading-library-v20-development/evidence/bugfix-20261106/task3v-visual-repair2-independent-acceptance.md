# Task3v visual repair2 — 独立限定验收

## 结论

**SPEC：部分通过，3V01 的 1280 桌面布局仍 FAIL；Task3v 不接受完成。QUALITY：三文件改动边界、现有功能回归和可访问状态接线限定通过，但 CSS 级联遗漏需修。** 不能用测试通过抵消真实视觉失败，也不能将两次浏览器脚本的 native-blur 取证失败写成产品停播失败。

独立非作者 `capital_diagnosis` 完整读差异、运行定向测试、复算存档结果并直接查看下列原始 PNG；真实 Chrome/HTTP/数据库操作由 root 执行。本报告作者没有打开应用、浏览器或 SQLite，没有修改产品、正式测试或配置。当前工具未额外暴露可核实模型 ID，不宣称为 Luna 验收。

本片范围为 page/page.test 与 pair-only recall.css；返回焦点三文件沿用先前独立限定验收。未实现的完整工具、holding Text、计划、历史/导出、完整 PLAY、V、物理中文 IME、触屏/窄屏/小时均不在本片通过范围。95% 分支覆盖率未测、未宣称。

## 版本与范围

原首轮视觉 FAIL 及 focus 首轮 BODY 失败均保留。repair2 release 为 `task3v-visual-repair2-release.md`；完整差异 `task3v-visual-repair2/repair2.diff` SHA256 `f8c3d0c2f219a31a048e62d2dc4761d5618fccd988d17013f85fd045ccd4af06`。raw-after manifest SHA256 `ee9bf6f56dbd18fde2e5e8351089de701d388d36a521544ae5b91d6b1e5bd76d`，raw-before manifest `8fb43bf384669483c030a79f8f8d8bbd5463ab76d33a592e2e4e5b169782f5e5`。

| 文件 | raw-before SHA256 | raw-after / 本轮实核 current SHA256 |
| --- | --- | --- |
| `app/components/library/library-practice-replay-before.tsx` | `2ecdba5e0f0ef0254508bfd7c3e7e7bf3d55dc7f7283c402961b0ad9509bc27c` | `f86b3bf6936af73707584eb5d2d6b4224bf8ce11886d7ac6de7fe48717269e6c` |
| 同名 `.test.tsx` | `1c0773f2958864add7f0e38aefc1003bb2f6a6affdb39508ab6d44f667d1a40a` | `7731857156cdbb178172f65978d520f4e04d96cd097885123b463b6f1e6325ba` |
| `app/components/recall/recall.css` | `77161d0b379b8d3061e92f3849f815546319b049279ba2fbe336daa729e9af24` | `2aa1e7711705a32cceb287b43e3e56b059fa66817b2ed662d850b685c2d2adda` |

独立核对 raw-before/after 字节和 current 对应。focus 三文件未被 repair2 改动：workspace `cdd798a3499481659e629513e32b6a60fefaf2ac24fdbed033924cce0634a917`、Entry `16907d78d7b77bc335173f29d88c4abac3994bf472fc59d89ad3282c4a65540b`、workspace.practice-entry.test `8a660416163e8d27d1b5313af65bb556d9af6e093ead034dfdd1ad1f93883786`。

两个 root 浏览器运行的 44 路径各自 before/after 一致。后来读盘时 `replay-chart.tsx` 与同名测试已因 root 另行授权 viewport 修复开始变化；本报告的旧 44 路径执行证据只绑定各原始 result 内的执行 SHA，不将它冒称为后来 chart 版本的全体验收。repair2 三文件及 focus 三文件本轮实核保持上述版本。

## 独立代码与测试

完整 diff 只改变来源文本、Type 图标可访问名/展示、两项新增页面测试、既有 pressed/T 断言以及 pair CSS。来源仍为真实 `TradingView · 模拟盘`，完整身份仍在 h1/原生 details；图标 `aria-hidden`，按钮保留 aria-label、title、pressed、disabled、原 handler。未删除既有保存/错误断言，未改 controller、CAS、writer、图表 props 或后台状态。所有 CSS 新改规则均为 pair 前缀，没有把旧 Recall 改成相同布局。

独立新执行（默认超时；无全仓/STOPPED Recall）：

```sh
npm run test:unit -- app/components/library/library-practice-replay-before.test.tsx app/components/library/library-practice-entry.test.tsx app/components/library/library-practice-browser.test.tsx app/components/trade-review-workspace.practice-entry.test.tsx
npx eslint app/components/library/library-practice-replay-before.tsx app/components/library/library-practice-replay-before.test.tsx
```

结果 **4 文件 52/52 PASS + native runner 8/8 PASS，20.55s；ESLint exit 0**。日志分别为 `task3v-visual-repair2-independent-targeted.log`、`task3v-visual-repair2-independent-eslint.log`。测试使用既有隔离 runner；本次没有应用 HTTP/业务库访问，没有调高全局超时。日志中的 Node module.register 废弃提示单列，非产品失败。本作者未重复执行 typecheck，不将作者/root 的 typecheck 冒称为独立执行。以上是受影响回归，不是分支覆盖率报告。

## 原图直接对照

直接查看原参考 `docs/designs/2026-09-25-chart-first-review/02-chart-workspace.png`、`04-holding-stage.png` 及 V2 a1/a2 对照图 `task3v-independent-reference-a1.png`、`task3v-independent-reference-a2.png`。约束为原元素规范 E01/E03/E08/E19/E20 及 repair2 release：48px 起紧凑头、长名省略且能看完整、36px 桌面工具、48px 起底栏、错误保稿并可操作；展开全文/长错允许有序自然增高，不能以隐藏内容或缩小控件解决。

本作者直接查看：

- 1440 目录 `task3v-browser-visual-repair2-1440/`：`A-long-title.png`、`A-full-title-keyboard-open.png`、`A-saved.png`、`A-return-reload.png`。
- 1280 目录 `task3v-browser-visual-repair2-1280/`：`A-long-title.png`、`A-full-title-keyboard-open.png`、两宽度的 `A-save-pending-two-new-drafts-*`、`A-explicit503-copy-*`、`A-unknown-copy-*`、`A-return-reload.png`。

| 要求 / 状态 | 真实图与原始几何 | 独立限定结论 |
| --- | --- | --- |
| 3V01 / 1440 闭合长名 | 默认头 49px，h1 省略，完整名入口、阶段、来源、保存状态、旧入口和返回均可见；不重复完整 instrumentName；chart 646px，底栏 48px / bottom894 | **PASS scoped**，已修原 147.30px 头。原生 Tab/Enter 开闭实证由 root 提供，直接看展开图全文可读，展开允许增高 |
| 3V01 / 1280 闭合长名 | 默认头 **129px、三行**；阶段 nav x84/y168/w1184/h36 独占几乎整行，而 header x72/y122/w1208/h129；chart466px。展开头208.296875px、chart386.703125px | **FAIL**，空间损失来自旧断点强制全宽残留，不能算已满足紧凑/必要时自然换行 |
| 3V02 / 两宽 Text | 真实 Type 图标居中，36×36、工具列48，原 title/T/pressed 接线保持；1440 原生 T、16/220、真实保存与旧 Text 取消走通 | **PASS scoped**；不是完整 E03 工具交付；物理 IME 未验 |
| 3V03 / pending | 同一1280样本切两尺寸：真实第一份 SAVE 已提交、响应暂扣期间新增两份独立 Text，状态“处理中”，图与三份文本可见，离开保护仍在 | **PASS scoped** 功能/局部状态可见性；不掩盖1280顶栏 FAIL |
| 3V03 / 明确503 | 两尺寸均有两段完整原文的可复制 textbox、错误及 Retry；自然底栏分别141.5/153px，内容未被裁至视口外。700ms idle+resize 无自动请求 | **PASS scoped**，人工未转发503，非自然后端故障；未实际读取系统剪贴板，不宣称剪贴板复制动作已验 |
| 3V03 / 已提交丢响应 | 两尺寸均保留第三段完整 textbox 与 Retry，底栏99.5px，离开仍受阻；真实200提交后前端 abort，trusted Retry 保留原body/id | **PASS scoped**，结果未知恢复不等于未提交；本作者复算存档，不冒称亲操 |
| 3V04 / 旧入口与焦点 | focus repair1 原限定接受；本轮两样本继续有真实旧入口往返与焦点证据 | **PASS scoped carry-forward**，未将本轮单元测试当真实焦点证明 |
| 3V05 / A 保存→返回reload | 1440 一份16/220、1280三份14/180真 Recall 文本均在后续 GET 中完整一致；直接图中可见真 K 和保存文字 | **PASS scoped** A链；初次1440四根K左聚且大片空白另列下项 |
| 3V05 / 首次主图分布、B/C/D与前台计时 | 首次1440图只有4根可见K挤在左侧，49根数据返回与后续正常图不能证明首开已正确；两个完整脚本在 BEGIN 后 nativeblur 取证停止 | 首开分布 **NOT VERIFIED/待定位**；新同数据 continuation 未提供前，B/C/D/失焦/400ms 本片 **NOT VERIFIED** |

### 独立 FAIL 的精确根因与最小修复边界

`recall.css:1606` 的1101–1320断点为旧 grid 布局设定：`:1619` heading `width:100%`、`:1642` phases `width:100%`。后面的 pair header 在 `:1733` 附近覆盖成 `display:flex; flex-wrap:wrap`，却未复位这两个子项宽度；原 grid-row/column 在 flex 内不再布置元素，100% 宽度仍生效。实际 nav 宽1184px匹配头内宽，阶段强制独占第二行。129px不是纯粹长错误需要的底栏换行，也不是全文展开产生的合理增高。

最小候选：仅 pair 作用域复位 heading/phases 的 width 为 auto；保留 heading `flex:1 1 260px` / min180与标题省略，阶段使用内容宽度（可 `flex:0 0 auto`）；保留整体自然 wrap 和 details 打开后全文换行。此为候选设计，不是本作者实现或已验修复。

下轮真实 computed/几何必须核：header display/flexWrap/height；heading width/flexBasis/minWidth/rect；phases width/flex/rect；h1 minWidth/clientWidth/scrollWidth；summary/details 展开/闭合 rect；1280/1440 的同 A、pending、error 状态。不要用 CSS 字符串镜像测试替代截图。当前 computed 未执行，因果证据来自已读 CSS 规则与真实 rect；最小补丁仍需实际验证。

## 存档实测结果独立复算

独立离线脚本 `task3v-visual-repair2-independent-readback.mjs` 与 `task3v-visual-repair2-independent-1280-readback.mjs` 只读 JSON/PNG/源码字节，不导入产品/HTTP/SQLite/browser。结果 JSON 同名前缀；二者均 `PASS_SCOPED_OFFLINE_READBACK`，**明确断言原浏览器 status 必须保持 FAIL**。

| root 原始执行 | 原始 SHA256 / 精确范围 | 独立复算 |
| --- | --- | --- |
| 1440 A | result `08ae7e284d60a3a2d023fc1495079d266d242630e040ebc6eba15dd205686553` | 44源执行前后同版；schema22共70表，各schema与旧行多重集不变、13不可变表不变；ADOPT/SAVE/BEGIN 三200、3合法bind；9表合法新增；保存1份与4次后续before/r1 GET精确一致 |
| 1280 A/fault | result `9cdb86c54b8ed45ce1110236e212e4a1a937d2bdafca7c0740d341684be23412` | 44源执行前后同版；70表schema与全部旧行多重集保持、13不可变表不变；7次HTTP/5唯一命令ID/新增5份journey收据、3合法bind；10表合法新增；3份保存文本与2次before/r3 GET精确一致 |

1280 序列为 ADOPT200 → SAVE200(响应暂扣) → 第二SAVE人工503未转发 → 同ID/body trusted Retry200 → 第三SAVE真实200提交后abort响应 → 同ID/body trusted Retry200（j4/r3不再增长）→ BEGIN200。两个 Retry 的原始 byte 相等由 root guarded request.postData 比较存证；本作者又比较存档命令字段、text/anchor/format、CAS/observation/ID和收据数，核对 Retry 均在 trusted click 序号增长后才派发。两宽 textbox 的完整 value 与待存第二/第三原文相等；三份最终id/anchor/format与真实返回投影一致。

两个运行均 blocked=[]、pageErrors=[]，但不得写“所有网络零失败”：各有精确 favicon HTTPS abort，1280另外有人工503与刻意丢响应。table变化均为该样本命令/状态/Recall/正常绑定新增，不是全库零写。

两次整体原始 FAIL 均为 `actual trusted native blur required`。1280 原始记录的 trusted blur4880.2ms早于被 `findLast(买入)`选中的重绘4899.5ms，该重绘自身 `focused:false`。这证明断言拿了失焦后的画点作为“失焦前”基准，不证明产品未失焦或停播错误。原错误不改为 PASS；真实持续前台计时/恢复仍待另外同数据 continuation。当前两个样本已 B running step1，不重置、不额外 seed。

## 仍未通过 / 未验证

1. **3V01-1280 FAIL：** 旧断点宽度残留强制三行，root已收到精确根因；待单一 pair CSS 修复与两尺寸实图回归。
2. **首次1440主图分布未明：** 真49K返回不等于首开已正常排布；旧首图保留，不以保存后正常截图覆盖。
3. **本次 B/C/D/失焦/计时 NOT VERIFIED：** 两个原脚本的 A段有效，完整运行仍 FAIL（harness事件选择）。等待真正 continuation 的已产证据，不能消费样本重跑。
4. 物理 IME、V、95%与未交付全工具/holding/plan等保持未验或未交付，不能用本片局部 PASS 解锁其完成声明。

## 焦点报告事实更正

已保存原报告为 `task3v-legacy-focus-repair1-independent-acceptance-before-timepoint-correction.md`（SHA `01e5a0e5756d1c10c7645708341f4af507f9a861fc8bcc499d9771dbef3f56d3`）。原文实际写的是4/7，不是7/7；现在明确“4/7仍原Task3v、3/7已被批准的visual repair2改动”。修正后的 focus 报告 SHA `be7a5e812d4ec6748a6e169fc5aa8f7af003368f6d58c6eff53852dedfa7b240`。这是时间点/授权上下文说明，不改变旧运行SHA，不抹除原FAIL，也不把允许的后续版本当未授权回归。
