# V2.4.1 历史与贡献图稿修订报告

日期：2026-10-21  
范围：V241-08；实施者 `/root/history`；整页合入与独立验收由 `/root` 负责。

## 结果

已按当前 authority source 与 round5/round4 原型更新允许清单内的历史、年度、贡献局部 SVG，并生成四张整页嵌入预览。历史曲线保留原始 series 与轴标签，贡献区保留原始柱值与状态，未以简化折线或虚构 fallback 数据替换。未直接修改共享正文、`home*.svg`、`visual-samples-board.svg` 或冻结历史副本。

局部源图已用 sharp 实际栅格化并逐张目视复核，证据在 `evidence/updated/*.png`。四个整页预览在 `evidence/shared/*.svg` 与 `evidence/shared-rendered/*.png`；其源文件仍需 root 运行脚本 `--apply` 后再做独立浏览器验收。

## 已核对的关键规则

- 历史/年度三个旧控件合并为一个 282×36 控件；按 round4 D07-A 隐藏可见字段标签，仅在控件 group 的 `aria-label/title` 保留“范围/展示方式”语义；2026/年度值与指标均为 14px，两个 chevron 为独立内嵌 SVG，且紧邻对应值。月份无前导零。
- 净盈亏 KPI 使用 `万/亿` 两位小数：`+30,000` 显示为 `+3.00万`，极值 `+500,000` 显示为 `+50.00万`；原始金额保留在 `<title>` 中。价格、数量、回合数不走金额转换。
- 金额轴达到 1 万时用 `万/亿` 两位小数；胜率轴仍为百分比，回合轴仍为整数。
- 零线按 metric 分开处理：局部普通/空/失败/缺失/年度图按各自轴的真实零值定位；累计、胜率、回合等直接图稿保留各自零线，不能共用固定 y。四张整页嵌入的金额轴保留原五条刻度（9,000@290、6,500@340、4,000@390、1,500@440、−1,000@490），由相邻刻度线性插值，在 `y=470` 增加真实零线，未改动 series 或刻度。
- 年度 D10 的 `9 / 14 盈利回合` 与 `64.3%` 共用 `y=157` 基线，并以 `text-anchor="end"` 锚到 KPI 卡右缘（x=1026）；年度控件仍在 1102..1384 shell 内，第二个 chevron 的右缘为 x=1320，不与卡片或视口碰撞。
- 普通净盈亏、胜率、回合图的无回合月份使用低干扰背景并保留原始点/线；未来区仅作为背景和边界，不连线不出点；空/缺失状态分别使用 `data-state=empty/missing`。
- 曲线 token 为 `stroke-width=2`、`r=3`（点径 6），与 round5 `history.js` 及正文约定一致。
- 贡献局部状态保留 14px 实心/中空柱、异号两侧堆叠、极小值不造最小柱、未知值为“不可计算”；中空柱统一使用 `x+1/y+1/width-2/height12 + stroke2`，因此描边外高仍为 14px，且不撑大数值范围。A股明细保留 8 行分页分镜。整页预览的分类控制为 28px 视觉元素、36px 命中区域，选中分类用底部下划线；排序改为一个原型一致的单一盈利排序 select，文字为“盈利最高”，方向由独立 SVG chevron 表示，旁侧保留“仅看未平仓”控制。
- 四张整页补丁保持原宿主位置与数据：当前模式显示“已实现（实心）”和“浮盈变化（中空）”两项图例；历史模式仅显示“已实现（实心）”，并保留 round5 的禁用“仅看未平仓” checkbox。两种模式都补上全局“全部市场”独立选择面（28px 视觉面、36px 命中区、独立 chevron），排序文字只保留“盈利最高”，方向由独立 SVG chevron 表示，不在产品画布写入市场→详情日志。
- 产品画布不加入“全部市场→A股→标的明细→详情→返回”日志；该动线只在原型/报告范围内记录。公共 board 的 D14 点径 r3 与画布文字清理已由 root 合入，本组没有修改 board。

## 修改与证据

局部脚本：

```sh
node .scratch/homepage-v241-repair/work/history/transform-history-source.mjs
node .scratch/homepage-v241-repair/work/history/render-evidence.mjs
```

整页补丁（默认不写 home）：

```sh
node .scratch/homepage-v241-repair/work/history/apply-shared-embedded.mjs --check
node .scratch/homepage-v241-repair/work/history/apply-shared-embedded.mjs --preview
node .scratch/homepage-v241-repair/work/history/render-shared-evidence.mjs
```

root 审核 preview 后，如确认写入四个整页源图，再执行：

```sh
node .scratch/homepage-v241-repair/work/history/apply-shared-embedded.mjs --apply
```

`--apply` 具备 balanced-SVG 深度匹配、单一子图 marker、viewBox 顺序及原始 series 非空守卫；失败时退出并不写目标文件。

可重复工具副本已放在 `docs/design-system/baselines/2026-10-20-homepage-v2.4.1/review-records/follow-up/history-tools/`，脚本会从自身路径定位仓库根目录；其中 `README.md` 给出 `--check`、`--preview`、渲染、静态守卫、哈希与 root 审核后 `--apply` 的顺序。

修订后源图、脚本、报告、SVG preview 与 PNG evidence 的 SHA-256 绑定记录在 `evidence/SHA256SUMS.txt`；重新生成 preview 或修改报告后应重新运行 `hash-evidence.mjs` 更新该清单。

## 验收状态

局部 SVG：静态栅格渲染 PASS（1440×1000 源图与 1440×700 贡献状态证据已输出；图形按原 viewBox 渲染）。  
整页 SVG：`verify-final.mjs` 静态守卫 PASS；四张 preview 结构/栅格 PASS，证据为 `evidence/shared-rendered/home-*.png`。源文件待 root 串行 `--apply`，再由 root 以 1440×1000、1280×800 实际浏览器比较。  
浏览器、鼠标 hover、键盘/物理触摸、运行时筛选与数据持久化：`NOT VERIFIED`。当前环境没有可用浏览器 tab，不能把 XML/sharp 结果升级为交互验收。

