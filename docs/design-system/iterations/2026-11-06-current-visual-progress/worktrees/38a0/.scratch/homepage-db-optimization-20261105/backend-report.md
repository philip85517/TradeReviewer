# 首页数据库优化：后端第4轮冻结报告

结论：持久暖读可用，冷读≤1秒仍 **FAIL**。本轮停止改动，交协调者做生产浏览器独立验收。未修改原始业务库、未推送；真实测量仅使用显式隔离库 `.data/homepage-optimization.sqlite`。

| 真实副本测量 | 结果 |
| --- | --- |
| cold，删除附加结果缓存后构建 | 16,794.20 ms；build 16,782.69 ms |
| 关闭数据库、重新连接后的 warm | 14.66 ms；cacheHit=true；resultVersion一致 |
| 响应（UTF-8，未压缩） | 269,224 bytes；display view 159,442；catalog 79,948；holdings 27,518 |
| 财务显示规模 | 1,866成交；236 entries；154,410日线；20持仓行 |

分段毫秒：stored 3260 / prepare 1980 / summaries 4 / market+coverage 2775 / entries 269 / complete 2429 / own 3919 / project 1652 / holdings 436。保留 `real-profile-round3.json`；本轮证据为同目录 `real-profile-round4-{cold,warm,summary}.json`、`real-profile-round4.log`，测量入口 `backend-round4-profile.test.ts`。

接口：`GET /api/storage/homepage-catalog` 返回 schemaVersion/inputVersion/accounts/完整catalog/migration；migration=true仅表示既有浏览器数据迁移完成，沿用data_migrations complete语义。`POST /api/storage/homepage-view` 输入 `{context,acceptedSnapshot?,allowMissingAccounts?}`，输出 schemaVersion=1/resultVersion/inputVersion/asOf/validUntil/selection/catalog/accounts/display-view/holdings/timings。global按readTarget+ranges规范化；period必须传acceptedSnapshot；普通失效账户报400，仅显式恢复可过滤。每次返回严格绑定原请求stamp与series generation，持久化不存请求generation。

服务端复用强采集→原载体核验→ownership→F→holdings；先构建完整领域view供holdings，再投影独立显示DTO持久化/传输。原始材料、Recall、成交和多年missingSessions诊断数组均不出wire；quote coverage显示类型只有state/reasons，未用空数组冒充完整领域对象。catalog只去除重复完整名称，保留identity及deep link。持仓暂传全部小行以保留现有搜索/导出；服务端分页仍是后续缺口。

缓存为独立附加表/白名单触发器；不变更业务字段。inputVersion覆盖facts、instruments、imports、reviews及tag_suggestions、Recall、settings、candles、coverage和jobs。key含算法v3、Shanghai业务日、scope/attachments/period/historyRange。validUntil取未来成交/持仓事件、已知FX时点、既有市场日历的日期/完成时段变化中最早值，最多24h；读取校验截止时刻。结果digest与resultVersion绑定；发布在写事务内比较inputVersion/日切/expiry，失败或冲突不发布、不冒充最新。每次发布清除旧版本/算法/过期结果，确定性保留最近32选择，保护当前项。重启直接复用SQLite结果。

写后触发器立即使旧结果失效；目前下一次read等待同步重建并诚实返回耗时。没有主线程轮询，也未实现隔离worker预计算/源证明分层复用；导入/修订后首次读取仍可能阻塞HTTP，不能宣称≤1秒完成。

FX只读本地createFxService.read，不触发外部fetch。server-cache receipt明确服务器缓存来源，knownAt使用持久化body的updated_at，不把本次read time当provider已知时点；provider publication/attempt-start保留。client默认行为不变。

纯性能修改：canonical仅单次遍历memo（无跨调用可变对象缓存），同instrument+market行情索引/市场日期校验复用，coverage按group索引，holding专用窄读复用同canonical facts而省略未消费的费用分摊观察。通用F仅接收digest依赖；node:crypto仅由server注入，浏览器默认SHA256不变。用户暂停的财务模块仅新增等价窄读与遍历去重，未恢复资格/公式开发。

既有限制：HEAD 8c8c66c7的acquisition原已无条件lifetimeSourceCoverage=[]（现financial-acquisition.ts:189）；input/provenance没有该字段，strong complete只升级整份载体representation/universe。291 groups的inception不足不是本次丢输入，保持unknown，不据导入完整性授予财务资格。

验证：backend 3文件20测试通过；financial acquisition/source/view/holdings/F/narrow-facts共6文件478测试通过；tsc --noEmit通过；14个owned文件eslint 0 error/0 warning。TDD覆盖重连持久命中、版本/算法/日切/knownAt/市场收盘失效、原子冲突、失败不写、fresh restamp、decimal超安全整数、真实builder月结载体、32选择清理/保护当前项、resultVersion单字段篡改。SHA256空串/中文/大文本/换行/无配对surrogate与旧实现逐字节一致；旧client行为、新server provenance均回归。既有R14 binding测试在baseline也失败，本轮仅按实际source-shape错误链修断言，生产校验未放宽。

冻结生产文件：
- `app/api/storage/homepage-{catalog,view}/route.ts`
- `app/lib/storage/homepage-view-{contract,store,builder}.ts`
- `app/components/homepage-v25/{financial-acquisition,financial-source-model,holdings-model}.ts`
- `app/lib/reviews/homepage-v25-performance.ts`

测试文件：`app/lib/storage/homepage-{view-builder,view-store,native-digest}.test.ts`、`app/lib/reviews/homepage-v25-holding-facts.test.ts`、`app/components/homepage-v25/financial-acquisition.test.ts`。display-contract由前端owner提供；source snapshot/encoding由协调者修改，不计入本owner清单。UI/视觉/持久写入journey独立验收由协调者承担，本报告不宣称通过。
