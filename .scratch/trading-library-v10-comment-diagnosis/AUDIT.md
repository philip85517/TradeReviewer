# 当前评论诊断：范围与证据

## 触发、范围和版本

- 触发：用户明确要求对当前评论诊断根因；评论涉及导航缺失、控件对齐、视图一致性、趋势和用户动线，适用前端控件与视觉空间诊断规范。
- 类型：局部、只读设计稿审计。覆盖 revision 6 的全部6条评论，其中4条新增图稿评论拆为5个问题。没有进行全产品、全控件或全状态验收。
- 工作树：`/Users/zhoulin/.codex/worktrees/cf84/TradeReview`；detached HEAD `5a94ee3ff76e32993fe2c4791a83b40e877a7344`；已有行文与用户评论改动。
- 正文指纹：`b1d77501a23a272611d85485378cfabaa2cc421d08b0759125fdd38da7f1c147`。原始文件 hash 及图稿比较见 [version-source.json](evidence/version-source.json)，补充证据 hash 见 [version-final.json](evidence/version-final.json)。
- 服务：`./docs/design-system/baselines/2026-10-22-trading-library-v1.0/start-preview.sh`；本机3090，Python PID72680；最终监听检查另见 [verification.json](evidence/verification.json)。
- 页面：[交易库 review](http://127.0.0.1:3090/design-system/baselines/2026-10-22-trading-library-v1.0/visual-spec.html#chapter-BT05)。浏览器操作于2026-10-24完成，时间见 [browser-checks.json](evidence/browser-checks.json)。
- 数据：SVG 内嵌设计样例。未连接、读取或写入交易业务数据库，无隔离写库需求。
- 参照：V2.5 公共规范 HP11 与全站视觉条款；首页整页图仅作为宿主框架与定位方式的参考，不作为交易库全部业务模块布局要求。
- 用户排除：无额外排除。产品实现、业务计算、持久化及未评论状态不在本次诊断范围，未声称通过。

## 环境与空间测量

| 场景 | CSS视口 / DPR / 缩放 | 位置与截图 | 用途与限制 |
| --- | --- | --- | --- |
| review文档侧栏 | 319×694 / 2 / visualViewport.scale=1 | 模拟盘切帧后 scrollY=9220.5；图片盒 x35,y468.421875,w249,h400；源图1440×1000；截图319×694 | 证明图已加载及缩略图阅读受限；不代表产品移动端验收。 |
| 原始SVG | 1280×720 / 2 / visualViewport.scale=1 | fullPage保存1440×1000画布；未覆盖视口设置，横向超出部分由全页截图保留 | 可比较源图坐标与公共规格，不能冒称已验收1280宽产品布局。 |
| 公共首页原图 | 同一原图查看环境 | fullPage 1440×2346；与交易库图同为1440源宽 | 仅比较公共框架与层级；内容高度与业务模块不同，不作同一业务状态的像素差异评分。 |
| 模拟盘工具栏 | 原始SVG静态状态 | 容器(64,200,1312,64)；日期(168,219,190,36)；搜索(850,219,220,36)；刷新(1098,219,36,36) | 控件中心y237，父中心y232；偏移5px是静态对齐差异，不是动画位移。 |
| 原尺寸弹窗 | review侧栏同上 | 图片自然1440×1000，含边框盒1442×1002；截图见原尺寸证据 | 已存在100%查看功能；不能诊断成缺少放大功能。 |

详细几何：[工具栏](evidence/sim-toolbar-geometry.json)、[阅读器](evidence/reader-frame-geometry.json)。未修改浏览器视口设置，也未通过缩小字号制造通过结果。

## 版本绑定的登记与验证

下表均绑定上述正文指纹及 source manifest。D项为图稿视觉检查；R项为阅读器真实鼠标点击。D与R不是同一覆盖率分母。

| ID | 定位与前态 | 动作 / 预期 | 实际 / 证据 | 状态 / 负责人 |
| --- | --- | --- | --- | --- |
| D01 | BT03，`journeys-date@state-demo-1-1`；日期2026-10-15，实盘普通列表 | 打开完整SVG，核对导航和宿主 | 缺少整页框架；[截图](evidence/journeys-date.jpg) | FAIL / root |
| D02 | BT04，`hcr06-final-sim-ab@state-demo-2-1`；模拟盘练习列表 | 对照规范并测量工具条 | 控件向下偏5px；[截图](evidence/sim-list.jpg)、[rect](evidence/sim-toolbar-geometry.json) | FAIL / root |
| D03 | BT03/04列表与BT05 `01-live-normal@state-demo-3-1` | 读SVG与渲染帧，比较视角切换 | 统计有切换条，列表无；[源图文本与hash](evidence/version-source.json)、[列表](evidence/sim-list.jpg)、[统计](evidence/simulation-stats.jpg) | FAIL / root |
| D04 | BT05 `02-simulation-normal@state-demo-3-2`；10-01至10-15 | 切到模拟盘，再开原尺寸；预期普通状态表达趋势 | 图可加载，但只有一个点；练习A计数与第四章冲突；[截图](evidence/simulation-stats.jpg) | FAIL / root |
| D05 | BT06 `handoff@state-demo-4-1` | 读入口整图，再点击下一步；预期空间明确、主线连续 | 宿主位置缺失；下一帧直接是待复盘筛选；[入口](evidence/handoff.jpg)、[下一帧](evidence/reader-handoff-next.jpg) | FAIL / root |
| R01 | `state-demo-3` 第1/4帧；下一步按钮 | 鼠标点击→第2/4帧模拟盘统计 | 可见图及标签改变；[截图](evidence/reader-simulation-next.jpg) | PASS / root |
| R02 | `state-demo-4` 第1/5帧；下一步按钮 | 鼠标点击→配置中的第2/5帧 | 显示库内待复盘筛选；控件执行成功，分镜内容连续性另记D05失败 | PASS / root |
| R03 | 模拟盘统计图链接 | 鼠标点击→100%原尺寸弹窗 | 弹窗与原尺寸图片可见；[截图](evidence/reader-original-size.jpg) | PASS / root |
| R04 | 原尺寸弹窗关闭按钮 | 鼠标点击→回到文档 | 已关闭，文档可访问；[操作记录](evidence/browser-checks.json) | PASS / root |

- 新评论覆盖：4/4已定位并诊断；旧评论2/2已核对当前正文。此数不是控件覆盖率。
- 视觉检查：5项均有源文件及浏览器证据，5 FAIL；没有修复后视觉PASS。
- 本次特定阅读器动作：登记4项，实际执行4项；鼠标点击覆盖4/4、尝试率4/4、所登记状态转换覆盖4/4，结果通过4/4。只说明这4个动作，不代表阅读器全功能通过。
- 键盘、模拟触控、物理触控：NOT VERIFIED，本轮以鼠标复现图稿问题，未声称输入方式全覆盖。

## 状态、作用域与门槛

| 项目 | 本轮结论 |
| --- | --- |
| normal / selected | 检查所评论普通图及实盘/模拟盘选中状态；正文与图稿有差异，见D01–D05。 |
| expanded | 阅读器原尺寸展开/关闭PASS；产品详情与分布展开NOT VERIFIED，仅核对正文及图序。 |
| empty / loading / error / ambiguous / longtext | 当前评论中的静态普通帧没有这些执行态；本次不扩大为全状态审计。后续修复需覆盖受影响的空/缺失/错误/长文状态。 |
| 断点两侧 | NOT VERIFIED；当前319px是阅读器侧栏，不是交易库产品响应式验收。后续整页修复至少交付1440/1280规定状态并按实际断点复验。 |
| API、业务数据、保存/返回/reload | NOT APPLICABLE于本次静态设计稿诊断；不能据此认定产品链路正确。未来产品实现验收仍需独立数据库与真实往返。 |
| 原问题是否修复 | NOT VERIFIED；本轮没有实施，5个finding保持open。 |
| 独立检查 | `/root` 直接读取评论、当前源图、公共规范并在浏览器复现；本轮未实现被审图稿，没有以worker报告替代检查。 |
| 诊断产物完整性 | [verification.json](evidence/verification.json)核对链接、内容hash、评论版本和差异；只证明报告及证据一致，不放行UI。 |

本轮保留全部FAIL与NOT VERIFIED。原行文验收的范围是正文可读性与原图保留，不因本次发现而伪造“产品视觉曾通过”或改写历史接受记录。

## 2026-10-24 修复阶段：首帧检查

触发：用户要求修复评论并独立 Agent 验收到通过。范围由诊断扩展为静态图稿、正文分镜及生成阅读器；产品交易操作与数据库写入 N/A。覆盖范围为当前引用20图和必要新增状态，完整清单待实施报告冻结；阅读器控件限目录、状态分镜、原尺寸和现有评论定位，未修改评论编辑器逻辑。

首版1440×1000与1280×800直接在真实IAB打开；100%缩放。发现：日期条件10-15与多日行不符；来源被返回按钮遮挡；导航项目变更；缺少列表/统计入口；内容边距32与批准24不符；窄图数量/可见行不一致。结论 FAIL，已退回同一实施者。截图 `evidence/repair/first-1440-fail.jpg`。这些结果只针对首版，不冒充最终接受。

## 扩展图集第一轮：FAIL

首帧接受后扩展的27图存在范围/统计单位/累计/分布下钻/缺口/首页主线/异常结构问题，见 [EXPANSION-REVIEW-01.md](EXPANSION-REVIEW-01.md)。整批实现源冻结于 evidence/expansion-round-1；1440×1000真实浏览器证据 expanded-live-stats-fail.jpg。样例源通过独立Decimal核算，但图稿不得据此自动通过。

## 最终复验（2026-10-24）

独立视觉与协调者阅读器两个gate均PASS。全内容 `7584f36adeab139fc67a50b5894e7bc9afaf894a73aeb1a10716f6a04f198182`；53文件后验一致。原6评论revision6字节未变。40图视觉覆盖与原尺寸操作、33目录、8组控制、6评论及4原图链接均有直接证据；[最终报告](FINAL-ACCEPTANCE.md)与[阅读器报告](evidence/reader-final/REVIEW.md)。前两轮FAIL、工具会话不可用NOT VERIFIED、作者未做浏览器图检记录均保留；独立真实浏览器证据补足最终门槛，不覆盖历史。5项票与README同步关闭。无业务数据库写入、无远端操作。
