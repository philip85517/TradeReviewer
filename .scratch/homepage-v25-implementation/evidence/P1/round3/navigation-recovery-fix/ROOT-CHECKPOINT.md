# Root 有限导航恢复复验 — 2026-10-23 04:20 CST

状态：**NR04 与失败后手动重试的真实有限旅程 PASS；P1 整票仍第 2/3 轮 FAIL，正式第三轮尚未启动。**

## 版本与环境

root 独立操作 IAB tab7，实际视口沿用 1280×720 / DPR2；只使用隔离 `.data/tradereview-test.sqlite`。3334 透明故障代理转发3333，只对 GET `/api/trading-room/fx` 注入503或延迟；没有写业务数据库。host `85731c885096209b54cf5918cc9a9ee82aeab5f76e30905f8a2af9430484f5e0`；Surface `914f13c9cb429c40b76acf45a562168fbc4e309a6fdbaeb5248a52a2529f95b5`；CSS `d34b54ab5eb9b5232847607d3b5c94e9b93833da3703b2292793066e6dff43d1`。浏览器操作期间这三个产品文件保持冻结。

root 固定 Node 独立运行17新增导航+22原host+4session测试：**43/43 PASS，exit0**，见 `root-07-independent.log/json`。独立只读 peer 已核对11个输入，见相邻 `navigation-recovery-peer/REPORT.md`；peer 不代签浏览器接受。

## 实际旅程一：原 NR04 反例重验

1. 实际 A股74持仓→搜索 ROKU→NASDAQ:ROKU:stock 无持仓详情→查看交易；普通库URL为 `scope=live&market=a&accounts=*&rangeMode=all&symbol=NASDAQ%3AROKU%3Astock`，无队列，0标的0回合是该范围的真实空集合。
2. 受控FX503后冷重载，实际显示读取失败及“返回首页选择范围”（`root-cold-failed.ax.txt/.png`）。
3. 恢复FX为20秒延迟，实际点击返回首页选择范围，在尚未完成时打开搜索，再实际硬刷新裸/home。原先 onUi 覆盖来源的相同路径此时不再丢来源。
4. 静止请求达到超时后，实际查询仍为 ROKU，显示目录失败（`root-hard-reload-search.ax.txt/.png`）。第一次未限定范围的“重试”定位因两个按钮而未执行，改用已观察到的搜索弹层范围后实际点击重试。
5. 恢复FX正常，实际出现 ROKU 精确NASDAQ结果，URL恢复market=a；关闭搜索后 A股勾选、74持仓（`root-retry-green-search.*`、`root-retry-green-home.*`）。

## 实际旅程二：返回读取也失败，不经第二次硬刷新

再次 A股/ROKU详情→准确普通库→受控FX503冷重载→返回首页选择范围，返回读取继续503。实际打开搜索显示目录读取失败（`root-second-cold-failed.ax.txt`、`root-second-return-failed-search.ax.txt`）；恢复FX正常后，实际点击弹层重试，恢复 ROKU 精确NASDAQ结果及market=a，关闭后A股74持仓（`root-second-retry-green-search.*`、`root-second-retry-green-home.*`）。该旅程证明失败不会释放来源写保护，手动retry沿原navigation目标读取，而非refresh旧all范围。

## 证据边界与仍未闭合项

root 直接查看了当前恢复结果截图与已批准search参考图；这里只签来源/查询/范围/真实数据恢复的功能结果，不把不同视口与不同数据内容当成完整视觉接受。未逐项实测完整快照的每个页码/滚动/焦点字节、真实窗口focus/visibility、identity B全部时序或物理触控；相应用例/推论与实际UI仍应区分。

只读 peer 新发现 **NR-PEER-01**：timeout effect依赖被UI更新clone的global token对象，pending中onUi可将15秒deadline延后。这是继承的规格风险，已派独立因果RED，仅新增测试，尚未修改host。上述静止超时PASS不能关闭该风险。原Recall错误证券现象和间歇request-body消费者仍OPEN；历史Workspace完整回归50/45及89/8 FAIL保留，后续局部GREEN不冒充全量PASS。

P3 CR01/CR02已保存真实RED及新增10项5FAIL/5PASS，Surface有限修复获授权；root从此暂停UI直到产品重新冻结。P2性能架构仍待用户讨论，不允许第四次猜测补丁。
