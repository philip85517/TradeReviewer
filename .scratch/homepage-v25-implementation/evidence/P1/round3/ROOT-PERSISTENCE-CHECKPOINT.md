# Root 独立持久化局部接受

2026-10-23 03:38–03:44 CST；/root 实际浏览器鼠标操作，服务127.0.0.1:3333，显式隔离库`.data/tradereview-test.sqlite`；未写业务库。该记录不是正式P1第3轮，也不覆盖历史FAIL或未执行的整页门槛。

版本：host `74d765fe938aaa126ef115a683dea7f96181aab67c24de6e33e3e51fde08d2f2`；Workspace `6d255f0e1ed1a0af1d094cedb769cfe7fd33c6164c87b46a8ba8f57944581d22`；其余11文件逐项见P3/ROOT-COLD-READ-FREEZE-VERIFICATION.json。验证期间产品冻结。

目标为p1-count-09 / SSE:600100、2026-10-20 seed episode，原始成交保持不变。只读SQL核对`recall_documents`真实版本、完整草稿和updatedAt；没有用回调或fixture代替持久化。

|旅程|独立结果|证据|
|---|---|---|
|冷直达普通库→选准确回合→Recall|PASS，1标的/1回合，正确600100；无自动跳到其他证券|direct-trades-cold-reload-green.png/.ax.txt|
|两个真实窗口同rev2；窗口A止损92保存|PASS，实际rev3，目标120|recall-stable-rev3.json|
|窗口B旧rev2改目标125|PASS，显示冲突并保留本地止损91/目标125；DB完整文档及时间戳仍rev3、92/120|recall-stable-conflict-visible.png/.ax.txt；recall-stable-conflict-db.json|
|冲突时点击我的交易室|PASS，导航被阻止，输入保留|recall-stable-conflict-navigation-blocked.png|
|显式重新载入→再次改目标125|PASS，先采用92/120，再实际保存rev4、92/125|recall-stable-conflict-recovered-db.json|
|真实HTTP保存故障|PASS，验收专用代理3334仅对该episode的PUT返回503；页面保留止损93/目标125、风险140与错误；DB完整文档和时间戳仍rev4|recall-503-visible.png/.ax.txt；recall-503-db-unchanged.json；recall-fault-requests.jsonl|
|503时导航→恢复传输→再次导航|PASS，失败时留原页；恢复后实际PUT200、rev5、93/125，再返回首页|recall-503-navigation-blocked.png；recall-503-recovered-home.png；recall-503-recovered-db.json|
|重新进入准确库/回合并重开|PASS，真实重开仍93/125，数量20，方向long、风险140|recall-503-reopened-persisted.png/.ax.txt|

503是传输层受控注入，不是SQLite故障。代理未打开DB，仅转发应用请求；验证后已停止3334，主服务3333保持运行。控制文件已恢复`failRecall:false`。

历史`recall-conflict-409.png`实际为HMR附近错误证券画面，继续标为无效409证据，不替换或删除；本次冻结稳定路径没有发生错误证券切换，不代表旧HMR根因已解决。间歇request-body overlay真实上游消费者仍OPEN。首页返回读取中立即reload的范围恢复另有诊断，不能以本次保存链PASS覆盖。

输入方式：鼠标PASS；键盘、emulated touch、physical touch不由此记录签署。实际截图CSS1280×720、DPR2；历史文件名或初稿中的1280×800不能用作本次精确视口证据。完整视觉/全控件、P1全量回归、15秒故障UI仍未全部接受。
