# 期间受控leaf — root独立第1/3轮 FAIL

2026-10-23。root未参与实现；产品指纹TSX 7dd84cd1c3523855efa754be356c37aaa91afc638012b821bb10df084d9a12da / CSS a5206ab1f6640fd2957194d443d7718670b423b578639da09501665e4dac9989。P2上级正式0/3不变；此为明确独立控件范围的第1/3轮。未重置任何历史任务轮数。

环境：根工作树不变；临时纯Vite 3334 / session68674，无DB/IO；harness为evidence/P2/selector/root-browser/（合成调用方，不是首页端到端）。真实IAB tab10，1440×1000 CSS/DPR1，鼠标。root已直接看原period图及当前渲染；文件read-only几何不是视觉替代。原始截图都在evidence/continue-2026-10-23/。

|检查|预期|实际/证据|结论|
|---|---|---|---|
|打开/焦点|日期trigger直接打开，开始字段聚焦|真实AX开始字段focus，period-1440-right-corrected-harness.png|局部PASS|
|外点快捷项|只取消，保draft/applied，不提交|打开→点击本月；popup关闭，但请求计数0→1，month 2026-10-01..23，出现pending；period-outside-shortcut.ax.txt/png|FAIL|
|靠右预算|1440下popup右界≤1416|header靠右24px，popup x960 width480 right1440，无24px边距；corrected-harness截图|FAIL|
|失败反馈|旧applied保留，错误FF8592|旧2026-01-01..10-23保留，但computed色rgb168,182,203（A8B6CB）；message更高specificity覆盖error|状态保留局部PASS；视觉FAIL|
|全部八态/窄屏/真实首页金额链/触控|分别执行|本轮因已确认FAIL停止扩查，保留NV，不计全页覆盖|NOT VERIFIED|

原始第一张period-1440-right-before.png的y537源于harness flex stretch；已修harness align-items:flex-start后实际popup y203.05，不能把该y问题归于产品。right1440在修正后仍成立。

定向原30测试由root独立运行，日志root-round1-tests.log（结果单列，不替代真实操作）。浏览器局部四项检查不是63八态完整覆盖；不能宣称P2/整页接受。DB写门对纯leaf N/A，真实首页保存链仍必需NV。

修复授权：原owner仅原3文件和专属证据。先保留RED与定位，再一个候选解决(1)外点事件后click不能透传成另一个period request，必须保持实际外部取消及正常关闭后的再次激活可用；(2)靠右/靠左/390边界24px且保持trigger row下24px、不挤页面；(3)错误token specificity。不得通过禁止打开/改变尺寸/删快捷/改合同绕过。root二轮重新实际操作；至第三FAIL暂停并记录。
