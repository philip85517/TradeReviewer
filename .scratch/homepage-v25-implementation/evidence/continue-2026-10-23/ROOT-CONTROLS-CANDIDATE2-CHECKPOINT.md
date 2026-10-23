# Root 独立控件第二轮检查 — 有限证据，继续验收

2026-10-23。实现者：History `/root/responsive_shell`，Period `/root/financial_sharing`，均 gpt-6.1-sol / ultra；独立检查者 root。两个 leaf 均保留第1/3轮 FAIL，当前第2轮检查进行中，尚未签署完整接受。P1 正式2/3 FAIL、P2/P3/P4正式0/3及整页 NOT VERIFIED 不变。

环境：纯 Vite3334/session68674，IAB tab10/11，DPR1。受控合成调用方明确标注无数据库及首页金额接线。真实鼠标和原生键盘证据与 userEvent 测试区分；模拟触控、物理触控未验证。root 独立执行 History38 + Period42 = 80/80 PASS，7.80s，日志 `../P4/controls/ROOT-candidate2-controls-tests.log`；不是页面端到端证据。

版本：History TSX `a2090b6c52b85665431b0ad63517cdd8aa6112588f7705410f0b8709a355e3cd`，CSS `fb0bde9b33c436885f4bc1a8632fbc18d86050f14733e5696b1f1e4c42aef7ae`，test `e6e58ed6a550d9d077444ee112c9b3910cf2885fd0658024755a712b80442e14`。Period TSX `3aa54639958f90abd3b33d1103463c90ee00d7f78db4c332cbec636d091ca29b`，CSS `d83a015716f2293db3f85b5d56481a9beadfdce505307c46e118762735aa80d9`，test `9e21521b12d18aabed65e9c6e670f2f47592cbdf743b3457a5ee51d31241f8be`。

## History 第二轮已操作范围

|检查|观察与证据|结论|
|---|---|---|
|原长标签反例，1440/390|闭合标签2024–2026；390控件x84/y124/282×36，标签x96/y132/75.97×20完整在内；展开保留原长名称并换为两行54px选项|修复局部PASS；`history-candidate2-{desktop,long-390,open-390}.png`|
|四范围×四指标的操作可达性|2026、2024–2026、全部、今年均实际提交；期间/月度或年度、累计、胜率、回合数均实际选中；每次提交仅一请求，指标切换不增加范围请求|10/10注册控件至少操作一次；不是完整八态分母PASS|
|pending/失败/重试/调用方提交|请求中旧范围保持、范围选项禁用；指标可单独改；失败旧范围/新指标保留且错误FF8592；重试仅在调用方成功后改已应用范围|有限PASS；`history-candidate2-error-390.png`|
|空与恢复|无选项时有可读说明，菜单无可提交项；Esc回范围trigger；恢复选项后可重新打开|有限PASS；`history-candidate2-empty-390.png`|
|键盘/外点|Home/End/方向只移动焦点；Enter提交一次；Esc、Tab、ShiftTab、外点关闭并回到登记焦点，无额外请求|有限PASS，真实AX记录见工具轨迹|
|1280|控件x974/y124/282×36/right1256；菜单x974/y164/282×172/bottom336，文档宽1280|有限PASS；`history-candidate2-open-1280.png`|
|独立视觉比较|root直接查看原history-year-reference.png与当前desktop/390；282×36、14px、20px行高、双trigger层级及闭合完整标签一致|仅leaf匹配；合成页面不能证明首页位置|

完整注册10控件、16状态（14适用/2有依据N/A）的逐状态真实覆盖还未闭合；hover/pressed的实际视觉未完整登记，不宣称100%。历史金额、四模式图、贡献联动、返回/reload及整页视觉仍必需 NOT VERIFIED。纯leaf无写入，DB门 N/A 有范围依据，不释放页面持久化门。

## Period 第二轮已操作范围

|检查|观察与证据|结论|
|---|---|---|
|原外点穿透|打开后点本月只关闭，计数0，焦点回日期trigger；再次正常点本月才请求1|原反例局部PASS|
|pending/失败/重试/提交|旧本年标签在pending/失败保留，错误FF8592；重试count2调用方成功后才发布本月；future自定义count3待成功后发布；Esc只关闭不取消已提交请求|有限PASS；旧 `period-round2-{error,390,1280}.png`|
|输入/键盘|2026-02-30显示字段错误并禁用；合法2028-02-29..03-01可Tab到应用并Enter；Esc保留草稿，Cancel回焦点；Home/End移动、Space本周后范围2026-10-19..23|有限PASS；真实AX轨迹；并非完整63状态|
|左右/窄屏边界|1440 x936/right1416/w480；1280 x776/right1256/w480；390 x24/right366/w342。toolbar下24px，390字段堆叠|原右侧越界反例局部PASS|
|510/509断点|实际510×844面板x24/right486/w462/h184，grid200px+200px；实际509×844面板x24/right485/w461/h232，单列419px；两者top203.05，toolbar bottom179.05，gap24，doc宽=viewport|有限PASS；`period-candidate2-breakpoint-{510,509}-ACTUAL.png`|
|可滚动祖先定位|真实滚轮scrollTop0→128；toolbar bottom200.05→72.05，popup top224.05→96.05，两次gap24，未触发请求|定位跟随局部PASS；`period-candidate2-left-scroll-{before,after}.png`；人工overflow容器对上移popup有裁切，不能称其整体可见PASS|

浏览器viewport能力绑定有一处限制：对tab10请求510/509实际仍1280。`period-candidate2-breakpoint-510.png`文件名错误，实际1280，不作为断点证据；后改用tab11并读取innerWidth确认才保存带ACTUAL文件。该限制未归因产品。

Period登记9×8减9 N/A=63适用状态，当前有限实操不能冒充63/63。页面金融原子发布、四区附件、当前/历史模式隔离、贡献、回放/持久化及触控均仍 NOT VERIFIED。纯leaf DB门 N/A。

## 继续条件

两 leaf 原第1轮 FAIL 不删除。第二候选修复点有独立有限PASS；第二轮尚需逐状态登记和完整相关视觉。第三次若验收FAIL或必需检查未验证则按用户要求暂停同任务并记录原因，不能另起名称重置。当前没有提交、推送、合并、业务库写入或完整交付声明。

## Period 补充真实检查（509×844）

无有效 today/全部区间也不可用的受控调用方：三个快捷项 disabled，点击均无请求，Tab 跳过；自定义区间仍可打开。清空两字段后，各自 aria-invalid/说明关联及 Apply disabled 成立；反向区间显示关联错误。修正为2026-10-01..23后提交一次，pending保留已应用 All/禁用输入；Tab到取消并Enter仅关闭编辑器，不撤销已发请求。调用方失败后重开保留草稿与旧All，错误可读并可重试。实际截图 `period-candidate2-disabled-all-empty-509.png`、`period-candidate2-empty-fields-509.png`、`period-candidate2-pending-all-509.png`。此为独立有限PASS；原63适用状态分母和完整页面门槛不变。
