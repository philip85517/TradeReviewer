# Tiger OpenAPI 行情接入设计

## 目标

使用外部 Tiger OpenAPI properties 配置，打通服务端行情请求到现有
行情校验、覆盖状态和 SQLite 持久化的链路。首期覆盖 Tiger 支持的港股、
美股日线和 1 小时 K 线；现有公共 provider 继续作为失败回退，不改变浏览器
端的数据边界，也不把账户密钥保存到数据库、构建产物或仓库。

## 运行边界

- Tiger 凭证只在 Node 服务端读取，配置路径通过
  `TIGER_OPENAPI_CONFIG` 传入；不硬编码用户机器路径。
- 当前仓库没有 Tiger Node SDK，官方 SDK 为 Python 包，因此通过一个受控的
  本地 Python helper 调用官方 `tigeropen` SDK。Node 侧只传递已校验的行情查询
  参数，并读取 JSON 标准输出。
- helper 只实现行情读取，不暴露交易下单、账户资产或持仓能力；子进程使用
  `stdio` 管道、超时和明确的退出码，stderr 经过脱敏后才进入 provider 错误。
- 若配置缺失、SDK 未安装、权限不足、超时或返回无效数据，Tiger provider
  抛出已有的 `MarketDataProviderError`，router 继续公共 provider 回退。

## 配置解析

读取 properties 中的以下字段：

- `private_key_pk1` 或 `private_key_pk8`：按官方 SDK 规则转换为私钥内容；
- `tiger_id`、`account`、`license`、`env`：传递给 SDK 配置；
- 未设置 `TIGER_OPENAPI_CONFIG` 时，Tiger provider 不启用，现有公共链路
  保持原行为。

配置解析器只返回内部配置对象，不提供原始 properties 内容；错误消息只列出
缺少的 key 名称，不打印 key 值、私钥、完整配置路径或 SDK 原始响应。

## 数据流

```text
GET /api/market-data/{daily,intraday}
  -> provider router
  -> Tiger provider（配置存在时优先）
  -> Node 子进程
  -> Python tigeropen QuoteClient.get_bars
  -> JSON 行情记录
  -> Tiger 返回值严格校验
  -> 统一 ProviderResult / IntradayProviderResult
  -> 现有 sync service / coverage / SQLite
```

Tiger symbol 使用当前 `SupportedMarket` 的标准化结果：美股使用原代码，港股
使用不带交易所后缀的数字代码。日线使用 `day`，1 小时使用 `60min`，统一保存
为 raw 数据；时间戳按 Tiger 返回的毫秒 UTC 时间转换为 ISO 字符串。

对于 1 小时历史查询，helper 支持按指定日期或时间范围请求；首期先使用
`begin_time/end_time`，并保留 Tiger 的 `date` 查询能力作为后续历史窗口补全
的扩展点。Tiger 返回空结果时报告 `no-data`，不写入空覆盖或删除已有缓存。

## Provider 路由与错误处理

- 配置有效时，Tiger 位于日线和 1 小时路由首位。
- Tiger 不支持的市场直接跳过，不产生无意义请求。
- Tiger 成功但返回范围稀疏时，沿用现有 hourly sparse/history-limit 判断，
  交给后续公共 provider 尝试；完整结果优先返回。
- 不把账户、私钥、请求参数中的完整路径或 Python traceback 返回给浏览器。
- Tiger provider 只在服务端模块加载，避免被 client bundle 引入。

## 测试与验收

1. properties 解析测试：PKCS#1 优先、PKCS#8 回退、缺 key、未设置路径和敏感
   值脱敏。
2. helper/provider 测试：成功 JSON、空数据、非法 JSON、非零退出、超时和
   Python SDK 错误映射；单测使用 fake executable，不调用真实账户。
3. router 测试：Tiger 优先、Tiger 失败后公共 provider 回退、Tiger 1H 稀疏
   后继续尝试后续 provider。
4. API/同步链路测试：日线及 1H 返回现有 contract，能够进入现有校验和落库。
5. 真实配置验收：只在本机以环境变量指向用户提供的 properties，分别请求
   一只美股和一只港股的 1D/1H；记录 provider、数据条数、实际时间范围和
   错误摘要，不保存凭证或原始响应。

## 参考依据

- Tiger 官方配置文档：
  <https://quant.itigerup.com/openapi/en/python/quickStart/prepare.html>
- Tiger 官方股票 K 线文档：
  <https://quant.itigerup.com/openapi/en/python/operation/quotation/stock.html>
- Tiger 官方 Python SDK：
  <https://github.com/tigerfintech/openapi-python-sdk>
