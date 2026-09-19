# 03 汇率实现 preflight

日期：2026-09-19

本轮仅完成只读核查与实施计划，未修改产品代码、共享存储契约或 API。

## 已读取材料

- `.scratch/trading-room-implementation/briefs/03.md`
- `.scratch/trading-room-implementation/issues/03-fx.md`
- `.scratch/trading-room-implementation/reports/01-contract.md`
- `.scratch/trading-room-implementation/reports/02.md`
- `.scratch/trading-room-implementation/reports/fx-source-evidence.md`
- `docs/specs/2026-09-19-trading-room-homepage.md`
- `.scratch/trading-room-implementation/reports/boc-source.html`（按证据报告定位表头和 USD/HKD 行）

## 已确认的消费契约

01 的 `RoomFxSnapshot` 是金额模块唯一的汇率输入：

```ts
{
  id: string;
  baseCurrency: "CNY";
  asOf: string;
  source: string;
  status: "complete" | "partial" | "missing";
  rates: Readonly<Record<string, string | number>>;
}
```

`rates` 使用 `USD/CNY`、`HKD/CNY` 这类键，值是每 1 单位外币对应的人民币。`buildRoomMoneyView` 会保留原币小计；没有完整快照或缺少任一所需币对时，`convertedCny` 必须为 `null`，不能补零或合并不可比币种。CNY 由金额模型按 1 处理，不需要从外部源获取。

拟新增的持久化 `FxState` 会保留比消费契约更完整的来源证据：

```ts
type FxState = {
  id: string;
  baseCurrency: "CNY";
  source: "BOC";
  publishedAt: string | null;
  publishedAtByCurrency: Readonly<Record<string, string>>;
  fetchedAt: string | null;
  rates: Readonly<Record<string, string>>;
  lastAttemptDay: string | null; // Asia/Shanghai YYYY-MM-DD
  status: "complete" | "partial" | "missing";
  error: string | null;
};
```

`publishedAt` 是当前快照中最新源发布时间，用于 `RoomFxSnapshot.asOf`；`publishedAtByCurrency` 保留每个币种自己的源时间，避免把 BOC 表格中不同时间的行伪称为同一时点。失败时沿用上一份 `rates`、`publishedAt` 和 `fetchedAt`，仅更新 `lastAttemptDay` 与 `error`；没有旧值时保持 `rates` 为空、状态为 `missing`。成功后用同一个原子快照替换所有币种。`FxState` 到 `RoomFxSnapshot` 的转换由 03 模块提供，workspace/数据管理负责人只负责传递结果。

## BOC 来源核查

`reports/fx-source-evidence.md` 记录了官方页面和本机直接 HTTPS GET 成功的证据：<https://www.boc.cn/sourcedb/whpj/>。fixture 的表头明确包含「货币名称、现汇买入价、现钞买入价、现汇卖出价、现钞卖出价、中行折算价、发布日期、发布时间」。当前核查行给出美元 675.21、港币 86.06，单位均为每 100 外币；实现必须归一化为 USD/CNY 6.7521、HKD/CNY 0.8606。报告中的数值只用于 fixture 断言，不可硬编码到生产。

解析器应只接受 `table#priceTable` 中带 `data-currency` 的行，清除单元格 HTML 和空白后读取中行折算价、发布日期和发布时间；空白、非正数、坏 HTML、未知货币和代码/时间缺失都不能写成 0。当前交易室实际需要 CNY、USD、HKD；CNY 是基准，外部快照至少应能区分 USD/HKD 完整、部分和全缺失。不同发布时间的行只取最新发布时间组，不把旧行拼入较新的“完整”快照。真实源证据与单测 mock 必须分开记录；实现阶段的 mock 不得声称真实接入成功。

## 存储与 API 核查

SQLite 已有 `app_settings(key primary key, value_json, updated_at)`，无需新表。`SqliteStore` 当前实际接口为：

- `getSettings()` **public**，读取全部设置并解析为 `Record<string, unknown>`。
- `putSettings(settings)` **public**，在事务中对传入对象的每个 key 调用内部 upsert；虽然参数类型包含 `ChartSettings`，实现也接受普通 `Record<string, unknown>`，不会删除其他 key。
- `putSetting(key, value)` **private**，新模块不能直接调用。
- 没有 `getSetting(key)`。

现有 `/api/storage/settings` 只接受完整 ChartSettings（`version/showGrid/showVolume/showExecutions/showAverageCost/colorScheme`），不能拿它保存 FX key。现有 `SqliteHttpClient.getSettings/putSettings` 也严格按 ChartSettings 类型给 workspace 使用。

推荐的最小方案是 **不改共享 SQLite store/client 契约**：新 `/api/fx` 服务端 route 直接使用公开的 `getSettings()` 读取专用 key，再使用公开的 `putSettings({ [FX_SETTINGS_KEY]: state })` 原子 upsert；浏览器 hook 只调用 `/api/fx`，不把 FX 状态塞入 `StorageBootstrap` 或 ChartSettings。这样不需要暴露私有 `putSetting`，也不会让通用 ChartSettings route 接受任意数据。

如果后续负责人要求浏览器端直接复用通用 settings client，所需的最小共享改动应明确限定为：

1. `SqliteStore` 增加 `getSetting(key): unknown | undefined` 和 `putSetting(key, value): void` 的 public 包装（内部仍走现有 JSON 安全检查与 upsert）。
2. `SqliteHttpClient` 增加按 key 的专用 API 方法及其测试，不能放宽已有 ChartSettings 方法的类型。
3. 新增专用 route/契约测试并更新所有 test-only `SqliteHttpClient` stub。

本票 preflight 不执行上述共享改动；推荐方案的 `/api/fx` route 已足以满足持久化和隔离要求。

## 计划的实现边界

新增文件预计限定在：

- `app/lib/fx/contracts.ts`：`FxState`、状态/货币常量、设置 key、RoomFxSnapshot adapter 类型。
- `app/lib/fx/boc-parser.ts`：HTML 行解析、100 单位归一化、时间组选择、缺币种与格式错误诊断。
- `app/lib/fx/fx-service.ts`：读取/保存专用设置、BOC 请求、有限重试和超时、失败回退、Shanghai 日键调度、进程内并发去重。
- `app/lib/fx/use-fx-rates.ts`：客户端 GET/手动 POST hook，`cache: "no-store"`，组件卸载取消请求。
- `app/api/fx/route.ts`：GET 自动每日尝试、POST 手动刷新，固定 BOC URL，不向源发送账户/交易/用户输入，响应 `Cache-Control: no-store`。
- `app/components/data-management/fx-panel.tsx`：来源、每币种汇率与源时间、最近成功获取时间、失败回退状态、手动刷新按钮。
- 上述文件的 tests；不改 workspace/dashboard，待负责人接线。

## 调度、失败和并发设计

- GET 读取当前持久状态并以 `roomTodayKey` 的 Asia/Shanghai 日期判断是否已尝试；同日成功或失败都不自动再次请求，跨日才自动尝试。
- POST 始终表示用户手动刷新，可在同日重复成功两次；客户端和服务端各有单飞 promise，服务端在锁内重新读取 `lastAttemptDay`/当前状态，避免多页重复自动请求。
- BOC fetch 使用固定 URL、`cache: "no-store"`、AbortController 超时和有限次数重试；失败不无限重试。
- 成功响应只在解析、正值、支持币种和源时间校验完成后一次性写入；失败保留上一份完整/部分快照并写入本次失败信息。首次失败写入 `missing + error` 和当天尝试日期。
- `status` 表示可用币对完整性；`error` 表示最近一次失败或解析诊断，不能用 error 覆盖仍可用的旧 rates。

## TDD 与验证计划

先写失败测试，再实现最小行为：

- parser：fixture USD/HKD 的 100 单位换算；含实体/空白；坏 HTML；空/非正折算价；缺币种；不同源时间不拼接；未知货币不落库。
- service/storage：隔离 SQLite settings round-trip；ChartSettings、交易、其他 settings 保持不变；成功原子替换；失败保留旧值；首次失败无旧值；lastAttemptDay 持久化。
- schedule/concurrency：同日重复 GET 只请求一次（含失败）；下一 Shanghai 日重新尝试；两个并发 refresh 共享一次 fetch；手动刷新可连续两次。
- API：GET/POST 无缓存头、固定源 URL、超时/有限重试、无用户敏感 query/body、错误状态和旧值回退。
- hook/UI：数据管理页显示 BOC 来源、每币种率和源时间、最近成功时间、失败提示；手动刷新；无汇率时只显示原币说明，不渲染伪造人民币 0。

真实源证据使用 `reports/fx-source-evidence.md` 与 `reports/boc-source.html` 单独记录；实现测试全部使用受控 fixture/mock，不能将 mock 结果报告为真实源成功。

## 暂不实施与风险

- 本票 preflight 不改 `app/lib/storage/*`、`app/api/storage/*`、dashboard 或 workspace。
- 只保存一份当前快照，不建立历史汇率表，也不改写原交易、费用或 ChartSettings。
- `getSettings` + 专用 `putSettings` 方案依赖 route 进程内单飞去重；若部署为多个无共享进程，需要后续增加数据库级条件更新/锁，当前本机服务场景先按同进程并发要求验证。
