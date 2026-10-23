# P2 期间选择器有限派发

2026-10-23，root。用户已授权继续 GPT6.1 SOL Ultra 并行开发。明确调整实施顺序：只提前实现不读取金额的受控 leaf；不释放 P2 页面接线、A 性能修复、P4 或四区附件。P2 原正式 0/3 保持，此子范围不重置上级票轮数。

负责人 /root/financial_sharing，实际 gpt-6.1-sol / ultra。整页视觉、完整状态/持久化和独立验收均 root。唯一写入为新 `app/components/homepage-v25/period-selector.tsx`、`period-selector.css`、`period-selector.test.tsx`；证据只在 `evidence/P2/selector/`。禁止修改任何现有产品/测试/配置/共享文档；不得接入 Surface/host/Workspace，不启动服务/浏览器/DB，不跑全套或性能，不派代理，不提交。先 RED 再单一实现，定向测试/依赖范围 typecheck/lint。

权威：HP02 正文 210–221、手册全局对齐107及 SegmentedTabs196–277，`source/images/period.svg`；读取原文原图，不以本文代替。root 已直接看对应1100×1100 period.png 并读SVG。HV25-17/18 / HOME-HP02-B020 的受控交互子范围归此 owner；完整金额/贡献原子更新和返回仍 root/后续唯一页面 owner。设计无授权差异。

接口使用现有 S 的 HomepagePeriod。applied period、draft/from/to、open、pending、error、明确 Shanghai today 均由 props 输入，回调只报告草稿/开关/请求应用事件；不得自建已提交期间、不读取 Date.now/本地时区、不 fetch、storage 或金额。all 的实际展示边界由 caller 明确输入，不能猜最早成交。按 today 纯算 week/month/ytd，周一开始、首尾包含，跨UTC/Shanghai午夜与闰日反例。沿原图 本年/本月/本周；文字规范所列顺序不构成必须倒置原图。

范围按钮直接开自定义日期，开始/结束/应用在同一弹层；改值只改草稿。反向/非法/空日期显示关联字段错误且禁用应用；未来日期原文允许灰区，不自加未来禁选。Esc/取消保持applied并回到日期trigger；受控成功才改变选中/标签；pending保旧applied、防重复、原因邻近可读；error保草稿及旧applied，可再应用。键盘Tab/ShiftTab、快捷项箭头/Home/End聚焦，Enter/Space才提交，Esc不提交；弹层焦点边界需明确。外点取消/焦点恢复依既有Popover规范。

原图预算：快捷68×36，日期trigger216×36，弹层480宽/20内边距、两输入200×36，应用88×36、字号14居中，输入左对齐；弹层内容自适应不裁切，窄屏最小左右24（390可用342）使输入堆叠；文字色E6EDF7/次A8B6CB/错误FF8592/边283448/底111A26及162233/选中6CA8FF。桌面1440×1000、1280×800及390×844最终由root实际渲染比较；原图像素不作为浏览器视口。通用渐变120ms/reduced motion；不要新图标体系，复用已有SVG约定。

核心路径：已生效本年→打开→反向日期→修正→应用pending→失败旧标签+草稿保持→重试受控成功；取消/Esc焦点；快捷日期只输出准确请求。此 leaf 无业务写入，DB持久化不适用此子范围，但真实首页期间原子链/贡献联动/返回reload均仍 NOT VERIFIED，不得当fixture证明。

先登记本范围快捷3项、日期trigger、开始/结束、应用/取消、错误/请求/键盘动态状态的八态分母与排除理由，写有限visual-contract。交接报告附RED/GREEN、接口、SHA、允许文件边界及三门：定向功能证据；真实端到端/独立视觉尚 NOT VERIFIED。root接受后才另派真实接线，不以准备PASS解除A性能FAIL。
