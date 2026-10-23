# 期间选择器第二轮候选冻结

2026-10-23，原 owner /root/financial_sharing，GPT6.1 SOL / Ultra。按 ROOT-ACCEPTANCE-1.md 与 root 随后批准的最小方案完成一个修复候选。仅原三个文件及专属证据写入；没有浏览器、服务、DB、全套、performance/profile、子代理或提交。此文是 worker 交接，root 第二轮独立接受尚未发生。第一轮 FAIL 保留，P2 上级正式 0/3 不变，其余历史 FAIL/NV 不变。

|原文件|第二轮 SHA-256|
|---|---|
|app/components/homepage-v25/period-selector.tsx|3aa54639958f90abd3b33d1103463c90ee00d7f78db4c332cbec636d091ca29b|
|app/components/homepage-v25/period-selector.css|d83a015716f2293db3f85b5d56481a9beadfdce505307c46e118762735aa80d9|
|app/components/homepage-v25/period-selector.test.tsx|9e21521b12d18aabed65e9c6e670f2f47592cbdf743b3457a5ee51d31241f8be|

原 REPORT.md / freeze.json / visual-contract.md 与第1轮证据未覆盖。该轮 TSX 7dd84cd1c3523855efa754be356c37aaa91afc638012b821bb10df084d9a12da、CSS a5206ab1f6640fd2957194d443d7718670b423b578639da09501665e4dac9989 是历史输入，不代表本次候选。

## 根因、RED 与唯一修复

|问题|首偏差及真实 RED|本候选准确位置|保留的语义|
|---|---|---|---|
|外点快捷误提交|旧 document pointerdown 先发布 close；其后同一手势 click 仍到达快捷项 onClick。PS19 对三个快捷均收到一次 onApply，期望 0，重现 root 鼠标报告。|TSX 120–142：document capture click 在快捷项 React handler 前 preventDefault/stopPropagation，随后只发布 close。去掉 outside pointerdown 拦截，没有计时器或跨手势吞点击标记。|当前取消 click 不应用；受控关闭恢复 trigger；下一次快捷 click 正常；取消/Escape 后鼠标和键盘均正常；草稿/已生效期间保留。原输入事件与滚动手势未拦截。|
|边缘定位|旧 left:0 以根容器为锚，right1440 实际 x960 而非936；right1280 x800 而非776；left8 未约束到24。额外反馈高度会使旧 top:100% 锚到整个根高度，PS22 top240 而非180。|TSX 91–118：useLayoutEffect 首次绘制前测量 root/toolbar/panel，横向以实际 panel 宽度夹在视口24px两边；绝对定位 top 始终为 toolbar.bottom+24。resize、capture scroll、ResizeObserver 更新；关闭清理。|CSS 默认480px、窄屏 max-width(100vw−48px)、20px padding、字段/按钮默认尺寸和390单列均未改；保持 absolute，不占文档流。|
|错误色覆盖|message 为两个 class specificity，error 只有一个；加载实际 CSS 后 computed 为 rgb(168,182,203)，期望 rgb(255,133,146)。|CSS 173：error 增加 .hp-period-selector 父类，使 specificity 与 message 相同，后声明的 FF8592 生效。|保留服务失败文案、旧 applied、draft、可重试；打开和关闭时错误色均验证。|

只有上述产品修改；没有接口变更、金额、fetch/storage、clock 推断、host/Surface/Workspace 接线或 abort。Popover 的 outside cancel 在完成 click 时执行；拖动/滚动中的 pointerdown 本身不关闭。父级仍拥有 open/applied/pending 的发布权。

## 定向证据

新增 PS19–PS23 共12项，原30项断言未删除或修改。`round2-red.log`：8 FAIL / 4 PASS / 30 SKIP，均为真实行为/布局输入/实际 CSS 级联差异；exit1。SHA-256 b72ebe4905073897e28f84d518884ba9c5906d80d11d1e43c88c24a6154384c8。

`round2-green.log`：42/42 PASS，exit0，05:55:16，6.20s；SHA-256 3de183ac1aa8da6ecfca160ba282d9b0d1c5d680f594f152ad2a1ef5c6b3dda6。`round2-typecheck.log` 和 `round2-lint.log` 均 exit0、无诊断。PostCSS 实际解析32条规则，exit0。

|检查|定向结果与限制|
|---|---|
|外点三个快捷、随后再次正常激活|PS19 三项 PASS；取消不应用、焦点回 trigger、draft/applied 保留，下一次 click 有效。|
|显式取消/Escape、随后 click/Enter|PS20 两项 PASS；原 PS09 Tab/ShiftTab 和 PS10 快捷键断言继续 PASS。|
|靠左、靠右1440/1280、超左边距、390|PS21 五项 PASS，分别要求 x24/right504、x936/right1416、x776/right1256、x24/right504、x24/right366。宽度480/342与绝对定位检查保留。|
|resize 与不冒泡的祖先 scroll|PS22 PASS；视口1440→1280重新夹边；祖先滚动后 left4→24；额外反馈高度不改变 toolbar 下24px锚点。|
|实际 CSS 错误色|PS23 PASS，打开与关闭均 rgb(255,133,146)。不是 CSS 字符串包含断言。|
|原30项受控数据/日期/pending/error/键盘语义|全部继续 PASS。|

jsdom 不执行浏览器布局；PS21/22 仅提供上游 DOMRect，再检查组件放置结果及实际 CSS absolute。其断言不能证明真实页面不挤压、像素比较、首次打开无闪动或 ResizeObserver 在真实浏览器中的表现。root 必须实际检查当前 SHA 的1440/1280/390、靠左/靠右、resize/祖先 scroll、八态和键盘焦点。本轮 worker 没有真实鼠标/触控/视觉截图，均保留 NOT VERIFIED；既有合成3334 harness 仍不是首页 E2E，首页金额原子链和持久化仍 NV。纯 leaf 无业务写入的 DB 门保持 N/A。

保留测试工具尝试：`round2-red-attempt-1.log` 中 Node URL 被 Vite 改写，造成 CSS 读取 setup 错误，不能算颜色/定位 RED；修正后才产生上列有效 RED。首次产品实现即42/42 GREEN，见 `round2-green-attempt-1.log`；静态检查随后发现本测试配置只自动包含 Cloudflare types，node:fs 未加载类型，且 head.append 被 Workers Element 签名覆盖，见 `round2-typecheck-attempt-1.log`。尝试 Vite ?raw 载入仍被现有 Vitest CSS stub 清空，保留 `round2-green-attempt-2-css-stub.log`，六项工具级 FAIL 未删除。最终仅测试文件显式引用已有 node 类型、readFileSync 读实际 CSS、DOM appendChild；产品 SHA 在这些工具修正中未变化，最终同42项/静态检查全通过。没有修改配置/依赖或放宽断言。

## 可复现命令

均在仓库根执行，使用已钉住 Node 26.0.0。root 可另存其独立日志，不覆盖上述 worker/历史证据。

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/vitest/vitest.mjs run app/components/homepage-v25/period-selector.test.tsx --maxWorkers=1
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/typescript/bin/tsc --project .scratch/homepage-v25-implementation/evidence/P2/selector/tsconfig.selector.json
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/eslint/bin/eslint.js app/components/homepage-v25/period-selector.tsx app/components/homepage-v25/period-selector.test.tsx
LC_ALL=C shasum -a 256 app/components/homepage-v25/period-selector.tsx app/components/homepage-v25/period-selector.css app/components/homepage-v25/period-selector.test.tsx
```

本次候选已冻结；等待 root 第二轮独立接受，不主动追加修复、任务或证据写入。root 第三 FAIL 则按既定规则暂停，不重置轮数。
