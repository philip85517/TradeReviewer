# Root 集成与浏览器验收

范围：用户确认 B 紧凑布局与最差练习回撤后的静态图稿/设计正文/比较原型/阅读器。业务应用与数据库 N/A。原评论只读。

服务：当前 worktree 的 start-preview.sh，127.0.0.1:3090，会话68821；预览曾因旧服务挂起而重启。真实浏览器：IAB，DPR1。

## 首帧 gate

- 初次 shared header 分层不符 B，随后摘要碰撞及压扁文本均FAIL，见REPAIR-LOG.md。
- 修正后实际检查1440×900实盘列表、模拟统计以及1280×800列表返回：模式在标题上方；条件摘要与tabs同排且自然12px字宽；风险短定义可见；风险与费用卡24px间距。PASS后才授权其余引用图传播。
- 证据：root-rep-live-1440-final.png、root-rep-sim-1440-final.png、root-rep-live-1280-final.png。1280曾因viewport作用于另一tab而未生效，已在实际生效的tab11重新截图，并读取innerWidth=1280、innerHeight=800。最终证据使用复验图。

## 原型已执行路径

- fresh open默认B；鼠标模拟盘→统计，标题/条件/指标同步；1440×900与1280×800风险说明分行可读。
- 预览状态→空结果：显示最差练习回撤—/无练习，恢复正常可返回统计内容。
- 方案A鼠标切换→Tab→Space选择B成功。方案比较按钮未声明ArrowRight切换；原型已有模式/页面箭头行为另验。
- 截图root-prototype-B-sim-stats-1440.png、root-prototype-B-sim-stats-1280.png、root-prototype-B-sim-empty-1440.png。

## 最终集成结果

Root 操作真实 IAB 并核对代表图与阅读器；独立 reviewer 单独逐图阅读真实浏览器截图。Reviewer 的浏览器入口不可用，不将 root 操作误记为 reviewer 本人操作。

| 门槛 | 结果 | 证据 |
|---|---|---|
| B 受影响布局 | PASS | 36 引用图及 1 额外1280返回图；frames、capture-results.json及独立逐图清单 |
| 回撤语义和覆盖 | PASS | 正文公式、两宽完整原型截图、独立语义审查 |
| 原型鼠标与键盘 | PASS | prototype-operations.json；keyboard-page-proof.json明确列表→统计→列表；A/C/B、模式、日期恢复、金额、四种结果状态 |
| 阅读器及评论 | PASS | reader-operations.json，C07/C08/C09定位及历史图入口；root-reader-C08.png、root-reader-BT02.png、root-reader-final.png；未变控制继承上轮覆盖 |
| 版本及保真 | PASS | version-after.json，58/58匹配；fixture、首页模板/4图、开篇与BT01未变；integrity.json原10评论、历史图及147链接通过 |
| 测试 | PASS | root与reviewer分别运行指标5项、首页5项；git diff --check通过 |
| 产品业务及数据库 | N/A | 静态设计范围，未开发业务应用或写数据库；权益数据缺失继续显示— |
| 触控 | NOT VERIFIED | 本轮是桌面设计及鼠标/键盘验收，不声明触控通过 |

前述原型日志两次对已选中页签发送箭头没有切页，不能作为转换证明；已补fresh B真实转换证据 keyboard-page-proof.json。金额控件在AX显示checkbox，HTML为aria-pressed button，按实际button语义操作通过。

旧采集tab在SVG访问期间出现 animation in undefined 错误，无应用源位置，不能声称旧日志为空。新独立tab加载并操作原型/reader无warn/error，见fresh-tab-console.json；当前页面未复现，不猜测根因。

最终source为 b236d66415148decf65eba0075cd9b8d70d91a3916b9f032207274c80dbd9672，content为8cc354c2add118c7e6c45b1a2dd037b5803e440fb73f379c512ea90700f1ea33。服务3090保持运行，原评论状态未改。未提交、推送或合并。
