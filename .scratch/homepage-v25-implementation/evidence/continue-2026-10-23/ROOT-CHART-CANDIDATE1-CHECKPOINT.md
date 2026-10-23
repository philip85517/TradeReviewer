# 收益曲线候选1：Root独立检查点

2026-10-23；实现者 /root/daily_chart（gpt-6.1-sol / ultra）；独立检查 root。候选1检查进行中，尚未签署leaf或页面完整接受。P2正式0/3；原性能FAIL及P1 2/3 FAIL不变。触发为新增前端交互/布局，范围仅受控曲线leaf。

## 版本、环境与参考

精确SHA见 ROOT-leaf-source-checkpoint.json（同目录）。root独立29/29定向测试PASS，7.34s，日志 ../P2/chart/ROOT-candidate1-tests.log；worker scoped tsc/lint exit0已审查。实际IAB tab11，纯Vite3334/session68674，DPR1。scratch调用方明确标注合成受控数据/无DB/无财务计算，不代表首页接线。仅字面金额，current故意给999999999以检验不能替代历史。

root直接读取原规格 source/visual-design.candidate.md:223–249，并直接看原 chart-scale--normal.png 和 chart-hover.png，与渲染图比较。示例日期/曲线形状不作机械像素要求；新正文覆盖旧常驻点及简写tooltip金额。正常流fallback是root针对无法在卡内避开主线时的响应式裁定，非原稿像素规则。

## 已直接执行的真实浏览器检查

|状态/操作|实际观察|证据/有限结论|
|---|---|---|
|1440×1000 default|卡片x24/y148/1020×320；单2px线，无常驻marker，文档1440；12px刻度/16px标题、明确CNY|chart-candidate1-desktop-default.png；独立参考比较有限PASS|
|1440固定详情|Tab即时首日0；End+Enter固定10-15；六项全额、独立颜色，期间净+18,420.00；详情264×174在卡内，下一模块gap16|chart-candidate1-desktop-pinned.png；PASS|
|390×844固定详情|卡宽342/plot280；详情264×174进入正常流，卡高478/底646，下一模块y662；Esc恢复卡280|chart-candidate1-390-pinned-flow-ACTUAL.png；PASS|
|390极长原值/原因|完整26010212345678901234567890.1234567890123400，不丢尾零；Info16；详情264×282完整自然换行，卡底754/下一模块770，无遮盖/横向溢出|chart-candidate1-long-original-390-FIXTURE-CORRECTED.jpg；PASS|
|1280全部8日期键盘|初始01-01=0，7次Right逐个02-15=5200、04-01=4900、05-15=10400、06-30=9800、08-15=14400、09-15=13900、10-15=18420；Left返回09-15；Space固定|chart-candidate1-all-dates-keyboard-1280.txt；8/8字面日期实际导航PASS|
|六项原值/Esc/重入|Tab依次六金额均展示各自原币/来源；值焦点Esc回曲线且清空；立即Enter不重开；Tab离开ShiftTab重入后End+Enter可固定|chart-candidate1-six-original-values-keyboard-1280.txt和真实AX轨迹；PASS|
|generation变更|固定详情后点切换数据版本：版本2，tooltip清除，焦点在调用方按钮|真实DOM/AX；PASS，不代表host原子发布|
|1280真实鼠标点击|点05-15对应列，固定10400/marker6，焦点曲线|真实AX；点击PASS|
|缺口/未来|键盘有效点02-15→04-01→08-15，跳过缺失/未来；两个segment，首/中/未来各可Tab；未来六项全—/完整范围/有效截止08-15，灰区边界正确|chart-candidate1-future-1280.jpg；PASS|
|loading/error|04-01加载、08-15失败均六项—，理由准确，无旧值；错误详情自然流撑卡，下一模块保持在下|chart-candidate1-error-1280.jpg；PASS|
|zero|所有net0.00中性色，轴[-1,-.5,0,.5,1]，其他已知指标保留|真实AX/DOM；PASS|
|currency mismatch|USD net不被标为CNY，net—且具体原因；其他已知CNY字段正常；无可画net线|真实AX；PASS|
|empty/disabled|空数组无假零/路径，有可读空说明；series null有批次原因，Tab跳过不可用图，无详情|chart-candidate1-disabled-1280.jpg；PASS|

## 控件覆盖边界、排除与未验证

注册依据 ../P2/chart/CONTROL-STATE-MAP.md：一个曲线roving入口、8个字面有效日期、6金额来源、异常Info、各缺口/未来/loading/error连续组及调用方8情景。本轮实际操作全部8日期、6来源、Info、首/中/未来缺口、两读取状态和不可用/空/币种/零值；不能由此把hover/pressed完整视觉状态分母记为100%。实际鼠标300ms出现/100ms离开仍NOT VERIFIED：当前浏览器没有文档化hover接口。拖动从空白到图上的试验产生文字选择/marker而无tooltip，仅证明拖动路径，不等同正常悬停，不计hover PASS（chart-candidate1-mouse-arrival-1280.jpg）。模拟触控、物理触控分别NOT VERIFIED。

初次viewport修改有旧截图缩放，chart-candidate1-390-pinned-flow.png实际390×271，已排除；带ACTUAL为390×844。scratch全局button min-height36一度污染Info，修正fixture选择器后Info16，旧chart-candidate1-long-original-390.png排除，用FIXTURE-CORRECTED。所有原文件保留；CUA返回JPEG字节，早期.png扩展名不影响像素但新证据用.jpg。没有把fixture/工具限制归因产品。

独立代码审查已派 /root/chart_review（gpt-6.1-sol / ultra），未返回。页面集成、真实F/B数据、完整金融原子更新、贡献、导航、持久化和整页视觉均NOT VERIFIED。leaf无IO/写callback，DB写入门仅对leaf NOT APPLICABLE，不能释放页面持久化门。无产品/数据库/服务改动，未提交或推送。
