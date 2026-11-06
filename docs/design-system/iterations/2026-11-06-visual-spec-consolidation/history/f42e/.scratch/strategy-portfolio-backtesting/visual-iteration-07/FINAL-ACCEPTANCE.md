# 修订07最终验收 · 限定桌面视觉原型

日期：2026-10-06。范围来自用户“确认，优先执行原型视觉效果的迭代，暂时不要实现真实代码”。[视觉契约](visual-contract.md)、[13项覆盖](DESIGN-COVERAGE.md)及DR01–08为本次验收依据。root为整页与样例数据流协调者，独立执行浏览器验收；Luna负责有界原型实现；prototype_source_review与visual_review未参与所审实现。root负责最终图表适配与文字换行修复。

**接受本轮视觉原型交付。** 本结论接受两个独立样例的桌面视觉与下表明确执行的页面内存旅程；不接受生产功能、统一创建→运行链或持久化，不代替用户设计反馈，不关闭09/11或解除10依赖。

## 版本与环境

- worktree：`/Users/zhoulin/.codex/worktrees/f42e/TradeReview`；分支`codex/strategy-workbench-v1-design`，未提交、推送、合并或发布。
- 最终SHA-256：生成器`aa66c44d…`、创建HTML`ce278f90…`、A HTML`d12096e9…`；完整值与72个选定JPEG的字节摘要、视口、拍摄源版本和局部继承范围见[freeze.json](freeze.json)。70个状态帧加2个新鲜交付入口帧，不宣称全部在最终创建源重拍。
- 服务：Python静态HTTP，127.0.0.1:3063，启动会话28298 / PID39954；原3062服务保留。DPR1、缩放100%，1280×800、1440×900；A另检查1299×800、1301×800。900高的断点补充图不替代800高批准参考。
- 数据：显式合成样例与页面内存；本轮没有API或数据库读写，隔离数据库写入门槛NOT APPLICABLE。原交易数据未访问；[改动前原型字节](before/manifest.json)摘要复核通过。该保护证据只涉及原型源码，不冒称检查了未访问的数据库内容。

## 独立门槛与协调者接受

| 门槛 | 实际步骤与观察 | 证据 | 状态 |
| --- | --- | --- | --- |
| 功能正确性（原型） | 四步固定操作栏与滚底；选择2→取消1→再选；预览异常重置；F18实际确认保持禁用。详情/包历史逐层Escape，身份和选择不丢。名称实际hover/focus/Escape分别执行。 | [root浏览器记录](reports/browser-acceptance.md)、[独立源码复审](reports/source-review.md)、[命令结果](verification.json) | PASS |
| 页面内存旅程 | F14→F15→F16→F17→F18及返回；缺数据详情同页定位到真实阻断说明。A单步显示6/17新K线与82根bar；播放观察134根，暂停180根。结果/比较→事件→配置→历史→逐层返回→关闭停事件日→命名返回原来源/入口，保持暂停和原截止。 | [实际浏览器旅程与状态](reports/browser-acceptance.md)、final8/9/10/11对应截图、[真实DataLayer诊断复现](reports/chart-data-layer-reproduction-output.txt) | PASS（两独立样例） |
| 状态安全（原型回归） | V/M/R和共同C分开；早期事件不扩大M/R，失败组合Mᵢ保留；回看只读和原因可见。日期控件Space/Escape不推进或播放。首次事件图表可见，无延时二次渲染。 | [浏览器状态接受](reports/browser-acceptance.md)、[源码审查](reports/source-review.md)、[诊断脚本](reports/chart-data-layer-reproduction.py) | PASS（所验合成状态） |
| 视觉还原 | 独立审查者直接比较resume06/style04原图及当前渲染，两档及1299/1301同高断点、正常/异常/长内容均单列。固定62px操作栏为用户授权变化；F16约402px选择起点、F18两列摘要与实际检查优先、A原尺寸预算保留。 | [独立视觉报告](reports/visual-review.md)、[精确源图覆盖](DESIGN-COVERAGE.md)、[冻结证据](freeze.json) | PASS（已列画面） |
| 生产功能与实际持久化 | 未实现真实创建、回测、查询/保存/归档、日历/执行能力、防重复或刷新重读；F18禁用真实确认。用户本轮明确暂缓真实代码。 | [未来功能覆盖](../review-functional-design-2026-10-06/DESIGN-COVERAGE.md) | 本轮NOT APPLICABLE；未来仍NOT VERIFIED |
| 创建→A统一旅程与54/200导航融合 | 创建与A身份不同，两个入口独立；没有以跳固定样例冒充共享实验。用户授权仅原型视觉迭代。 | [融合契约](../../../docs/specs/2026-09-30-strategy-workbench-v1-integrated-design.md)、issues09/11 | 本轮NOT APPLICABLE；未来仍NOT VERIFIED |

鼠标点击与真实指针hover、键盘Tab/Enter/Space/Escape均由root实际执行并在浏览器记录分开列明，PASS。未用组件合成事件替代实际输入。中文IME会话NOT VERIFIED；新增原型没有文字编辑控件，既有isComposing守卫源码复核PASS，不声称真实IME测试。模拟触控与物理触控均未执行，桌面范围NOT APPLICABLE；不外推触摸结果。DR08名称视觉限于直接看到的A长实验名、F10入口和明示设计工具压力样例，不外推任意未来产品名称。

## 回归与历史证据

VIS07-01–09的原FAIL、影响与独立修复复核保留在[视觉报告](reports/visual-review.md)。F16前置概念卡挤出选择、F18纵排挤出检查、浅底浅字、详情提示盖主图、事件图表空白、长身份溢出、只读原因截断、缺失披露不全、嵌套历史按钮复发，均以修复后的直接渲染证据复核通过。初轮R错误、隐藏详情及状态串场的失败也保留在[源码](reports/source-review.md)与[首次审查](reports/initial-review.md)，不改变原结论。

证据限制：原final8只读截断帧曾被覆写，未保留原字节；VIS07-07改以独立审查者直接看过的frozen2同缺陷截图保留。改动前源码与原始设计参考仍保留。错误状态、错误滚动位置、瞬态toast和未列冻结帧作为中间证据，不能混用为最终正常首屏。

非阻断细节：F10第一条包链接颜色与其他包名略异；未以该细节抵消任何重大差距。没有未修复的本轮重大视觉阻断。

## 最终预览与启动

2026-10-06 21:28（Asia/Shanghai）root实际浏览器重新打开[F14创建入口](http://127.0.0.1:3063/strategy-library-wireframes/#f14)并刷新[A工作台](http://127.0.0.1:3063/workbench-design/?variant=A)，内容与图表可见；补验F10/F12后21:33回到F14，两个标签页保留为交付预览。新鲜截图：[F14](screenshots/delivery-f14-1280.jpg)、[A待开始](screenshots/delivery-a-t0-1280.jpg)。21:33最终服务HTTP200、72图/源码摘要与文档链接检查均PASS，见[交付检查](delivery-check.json)及[静态命令结果](verification.json)。

从当前worktree根目录启动或重启；如3063由其他服务占用，选择其他空闲端口，不关闭未知服务：

```sh
python3 .scratch/strategy-portfolio-backtesting/strategy-library-wireframes/build.py
python3 -m http.server 3063 --bind 127.0.0.1 --directory .scratch/strategy-portfolio-backtesting
```

最终静态验证：Python编译、19板生成一致性、两HTML内联脚本语法、diff格式、改动前源码字节、两个预览HTTP均PASS。未运行不相关的生产测试或访问共享业务数据库。

协调者最终签署：root已阅读独立视觉最终报告及final12补验，F10/F12最终1280元信息缺口由直接比图补齐为PASS；核对独立源码、实际浏览器旅程、最终源码版本与所有选择帧，接受上述限定范围。09保持open / prototype-feedback，11保持open / integration-pending，真实接线依赖不变。

当前聊天交付通知：本次最终答复提供两条可点击预览、原型截图、分项验证结果及启动说明链接。
