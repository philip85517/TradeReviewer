# 8 张曲线/期间图最终修复复核（V2.4.1）

日期：2026-10-22（Asia/Shanghai）  
复核者：tables（只读独立复核；root 负责源稿合入和浏览器验收）  
范围：`chart-gap.svg`、`chart-hover--keyboard.svg`、`chart-hover.svg`、`chart-scale--extreme.svg`、`chart-scale--normal.svg`、`chart-scale--wide.svg`、`chart-scale.svg`、`period.svg`。

## 修复前后

这 8 张图此前在 [`chart-period-final-review.md`](./chart-period-final-review.md) 中保留了历史 FAIL/OPEN：`chart-gap.svg` 缺失区两端有黄色斜桥，`chart-scale.svg` 的亿刻度是整数并把零写成 `0亿`，`chart-gap.svg` 和 `period.svg` 页脚仍是 V2.3。root 已将修复写入当前 source；本次只读复核不再修改 source。

- 按正文 [曲线规则](../../../source/visual-design.candidate.md#曲线应让用户注意到什么)（当前文件约第 222 行）和 [缺失规则](../../../source/visual-design.candidate.md#曲线应让用户注意到什么)（约第 237 行），删除 `chart-gap.svg` 从最后一个有效点到下一个有效点的黄色斜向虚线；保留垂直定位虚线、缺失提示和两段蓝色有效曲线。缺失区仍不插值、不继续趋势。
- 按 [金额格式规则](../../../source/visual-design.candidate.md#chapter-hp04)（当前文件约第 283 行），七张使用万轴的图将可见 `20,000/15,000/10,000` 改为 `2.00万/1.50万/1.00万`；`5,000` 低于阈值并保留。`chart-scale.svg` 将 `2亿/1亿/0亿/-1亿/-2亿` 改为 `2.00亿/1.00亿/0/-1.00亿/-2.00亿`。tooltip、`<title>` 完整金额和原始值未改。
- `chart-gap.svg`、`period.svg` 可见页脚更新为 `V2.4.1 · 设计状态图，非产品运行截图`；metadata provenance 保持原值。
- `period.svg` 同步采用正文“快捷项统一为本周／本月／本年”的自然期间文字：`本年/本月/本周`。这是 root 在本轮 source 合入时额外修正的已确认语义，未改变控件布局。

## 当前 source hash 与静态核验

命令：`python3 .scratch/homepage-v241-repair/work/tables/verify_chart_fixes.py`  
结果：**PASS**。该检查以 `HEAD` 原始 SVG 为基线，调用带 SHA-256 守卫的 `apply_chart_fixes.py` 生成期望字节；对 `period.svg` 额外纳入已确认的 `本年/本月/本周` 文字，然后逐字节比较当前 source。另检查 source viewport、metadata/title 保留、轴标签、缺失区定位线与斜桥。

| 图稿 | HEAD 原始 SHA-256 | 当前 source SHA-256 | source viewport | 结果 |
|---|---|---|---:|---|
| `chart-gap.svg` | `951e2ce4641f595c744cf6eeb25b805ee865c2f2b1873c4c4728d479dedd94db` | `bf34df83d71d083fb87f092143e67d0c8e3a8b32a0673e9d4fccba4030c4c2b8` | 1100×1000 | PASS |
| `chart-hover--keyboard.svg` | `a90ce3547100588eb3a033e46c06f49e414e328828bd3823b9ce029f504624e9` | `c6c2a5245ceaeadd00e5a65c0037f1f2cf203d519cd80acbbf13bbb69f7f4d49` | 1100×350 | PASS |
| `chart-hover.svg` | `856091744b956f37ab080494c46d5484d03ffa0c2fa91838d3034f0bac100b02` | `0ffd13dee12dfe0debceea03b7a4e230e2f9b3b455b90c4014c465be5b5bd1b7` | 1100×350 | PASS |
| `chart-scale--extreme.svg` | `5a55263f83ded74305163dabe085d007ec5159c5dc373d1608acb6b4b45dfacc` | `cf0129188fed68d006b739a03adfca8eeb4ee50dd28e3747726da2f26e627180` | 1100×380 | PASS |
| `chart-scale--normal.svg` | `5d4af3a400cf93317f5f4e9c99c7df245554462ecfd19d44349cc70023bebe35` | `7ee84e1e4aa57bcd8fa48bc348f93f10bb9e4ab21001cb283eaf5e6403bc80b0` | 1100×380 | PASS |
| `chart-scale--wide.svg` | `f56a3becdc0abc70c2022f9cefd02e9703490f49d7cd0e5c1d4198ea92e4cd22` | `637d62153ec63126594a5ceb951b5a14fa477398e5aedef7a58dc39ebacb40d8` | 1100×380 | PASS |
| `chart-scale.svg` | `5e5e4200cf8733e0c6a8f478bb9f15fb80e5dbdf5e7cfb6f1363493bd651f5b7` | `fdc1d06b7bf48f1f5f18ce4c3200e06ccb38a6430d7d181d0102ab556da3e9db` | 1100×380 | PASS |
| `period.svg` | `9454786027b6d9c9875b5ee49f503557e58ae77d1c2584e168724c81a77b01f2` | `4fbe2cdd0d411a25adc92c555784c09b82eabcd5927691edab01aca70e31b6d8` | 1100×1100 | PASS |

## 实际图稿检查与证据

当前 source 已用 `sharp` 在 source viewport 原尺寸栅格化，未设置浏览器 viewport：1100×1000、1100×350、1100×380、1100×1100，分别对应上表。查看了全部 8 张当前 PNG；代表图和全量 SVG/PNG 快照在 [`evidence/chart-fixes-current/`](./evidence/chart-fixes-current/)，渲染清单见 [`evidence/chart-fixes-current/render-manifest.md`](./evidence/chart-fixes-current/render-manifest.md)。

当前 source 与 PNG 的完整哈希清单见 [`evidence/chart-fixes-current/current-hashes.md`](./evidence/chart-fixes-current/current-hashes.md)。

- `chart-gap.png`：缺失区两段曲线断开；只保留垂直黄虚线，提示框与全段缺失区均清楚；轴显示 `2.00万/1.50万/1.00万/5,000/0`，页脚为 V2.4.1。
- `chart-scale.png`：亿轴显示 `2.00亿/1.00亿/0/-1.00亿/-2.00亿`，零线和曲线无重叠、裁切。
- `period.png`：快捷项显示 `本年/本月/本周`；日期、自定义错误、KPI 和曲线均未因文字修复产生静态碰撞；页脚为 V2.4.1。
- 其余五张 hover/scale 状态：可见万轴统一且无静态重叠；keyboard/hover tooltip 仅作静态像素检查。

截图是 **sharp SVG 栅格化证据**，不是 Chrome/CUA 截图。浏览器交互、hover timing、键盘左右/Home/End/Enter/Esc、日期 Apply/Cancel 与运行时状态仍由 root 的独立浏览器验收负责；本报告不把 sharp 结果写成浏览器验证。

历史 FAIL/OPEN 仍保留在 [`chart-period-final-review.md`](./chart-period-final-review.md) 和 [`REPORT.md`](./REPORT.md) 的历史段落；本报告与 [`evidence/chart-fixes/current-source-static-check.md`](./evidence/chart-fixes/current-source-static-check.md) 记录修复后的新 hash 和 PASS。
