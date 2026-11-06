# 数据库结构附录：逐表查询手册

**本附录精确列出代码定义的最终结构，供专业审查人员按需查询。** 业务含义先读[现状说明](current-model.md)，问题判断见[综合意见](REVIEW.md)。

## 取证口径

来源：当前工作区14次迁移在纯内存 SQLite 3.53.0 中依次执行的结果；共45张业务表及1张结构版本表。未连接在线库，不能代替线上结构和数据核查。提取时刻：`2026-10-25T17:11:41.598Z`。

共有50个索引条目：2个显式索引、48个由主键或唯一约束自动建立的索引；INTEGER主键可能不另建索引。不能把“2个显式索引”说成“只有2个索引”。

本附录按逻辑领域分组，表名和字段保留源码名称。`声明非空`直接对应 SQLite 的 notnull 元数据；主键是否隐含非空还取决于表类型与列类型，因此不替代约束解释。完整 CHECK、默认表达式与外键动作可展开原始建表语句查看。

## 迁移清单

|版本|源码登记名称|
|---|---|
|1|`unified-storage-schema`|
|2|`preserve-repository-provenance`|
|3|`preserve-api-coverage-details`|
|4|`audited-trade-revisions`|
|5|`persist-trade-nature-and-simulation-scope`|
|6|`persist-localized-instrument-names`|
|7|`persist-recall-workspace-drafts-and-finalized-versions`|
|8|`project-recall-plans-and-retained-evidence`|
|9|`project-current-plan-associations-and-capture-context`|
|10|`project-plan-revisions-sizing-and-exit-evaluations`|
|11|`project-explicit-current-evaluation-selection`|
|12|`project-frozen-recall-actual-metrics`|
|13|`project-frozen-recall-manual-evaluations`|
|14|`tradingview-account-migration`|

## 交易与导入（4张）

### `instruments`

主键：`id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`id`|`TEXT`|否|1|—|
|`symbol`|`TEXT`|是|—|—|
|`name`|`TEXT`|是|—|—|
|`market`|`TEXT`|是|—|—|
|`currency`|`TEXT`|是|—|—|
|`metadata_json`|`TEXT`|否|—|—|
|`created_at`|`TEXT`|是|—|`current_timestamp`|
|`updated_at`|`TEXT`|是|—|`current_timestamp`|
|`localized_name_json`|`TEXT`|否|—|—|

外键：

无声明外键；这不表示应用层没有关联校验。

索引：

- `sqlite_autoindex_instruments_1`：`(id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE instruments (
  id text primary key,
  symbol text not null,
  name text not null,
  market text not null,
  currency text not null,
  metadata_json text check (metadata_json is null or json_valid(metadata_json)),
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
, localized_name_json text check (localized_name_json is null or json_valid(localized_name_json)));
```

</details>

### `executions`

主键：`id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`id`|`TEXT`|否|1|—|
|`import_batch_id`|`TEXT`|否|—|—|
|`instrument_id`|`TEXT`|是|—|—|
|`account`|`TEXT`|否|—|—|
|`side`|`TEXT`|是|—|—|
|`executed_at`|`TEXT`|是|—|—|
|`quantity`|`TEXT`|是|—|—|
|`price`|`TEXT`|是|—|—|
|`fee`|`TEXT`|否|—|—|
|`currency`|`TEXT`|否|—|—|
|`evidence_json`|`TEXT`|否|—|—|
|`created_at`|`TEXT`|是|—|`current_timestamp`|
|`updated_at`|`TEXT`|是|—|`current_timestamp`|
|`trade_nature`|`TEXT`|否|—|—|
|`simulation_run_id`|`TEXT`|否|—|—|

外键：

- `(instrument_id)` → `instruments(id)`；删除 `RESTRICT`，更新 `NO ACTION`。

- `(import_batch_id)` → `import_batches(id)`；删除 `SET NULL`，更新 `NO ACTION`。

索引：

- `executions_instrument_executed_at`：`(instrument_id, executed_at)`；显式创建，非唯一。

- `sqlite_autoindex_executions_1`：`(id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE executions (
  id text primary key,
  import_batch_id text references import_batches(id) on delete set null,
  instrument_id text not null references instruments(id) on delete restrict,
  account text,
  side text not null,
  executed_at text not null,
  quantity text not null,
  price text not null,
  fee text,
  currency text,
  evidence_json text check (evidence_json is null or json_valid(evidence_json)),
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
, trade_nature text, simulation_run_id text);
```

</details>

### `import_batches`

主键：`id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`id`|`TEXT`|否|1|—|
|`source_fingerprint`|`TEXT`|否|—|—|
|`source_name`|`TEXT`|否|—|—|
|`source_type`|`TEXT`|否|—|—|
|`imported_at`|`TEXT`|是|—|—|
|`record_count`|`INTEGER`|是|—|`0`|
|`reconciliation_json`|`TEXT`|否|—|—|
|`evidence_json`|`TEXT`|否|—|—|
|`created_at`|`TEXT`|是|—|`current_timestamp`|
|`trade_nature`|`TEXT`|否|—|—|
|`simulation_run_id`|`TEXT`|否|—|—|

外键：

无声明外键；这不表示应用层没有关联校验。

索引：

- `sqlite_autoindex_import_batches_2`：`(source_fingerprint)`；唯一约束，唯一。

- `sqlite_autoindex_import_batches_1`：`(id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE import_batches (
  id text primary key,
  source_fingerprint text unique,
  source_name text,
  source_type text,
  imported_at text not null,
  record_count integer not null default 0,
  reconciliation_json text check (reconciliation_json is null or json_valid(reconciliation_json)),
  evidence_json text check (evidence_json is null or json_valid(evidence_json)),
  created_at text not null default current_timestamp
, trade_nature text, simulation_run_id text);
```

</details>

### `trade_revisions`

主键：`id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`id`|`TEXT`|否|1|—|
|`instrument_id`|`TEXT`|是|—|—|
|`account_id`|`TEXT`|是|—|—|
|`request_json`|`TEXT`|是|—|—|
|`revision_json`|`TEXT`|是|—|—|
|`recorded_at`|`TEXT`|是|—|—|

外键：

- `(instrument_id)` → `instruments(id)`；删除 `NO ACTION`，更新 `NO ACTION`。

索引：

- `trade_revisions_instrument`：`(instrument_id, recorded_at)`；显式创建，非唯一。

- `sqlite_autoindex_trade_revisions_1`：`(id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE trade_revisions (
      id text primary key,
      instrument_id text not null references instruments(id),
      account_id text not null,
      request_json text not null check(json_valid(request_json)),
      revision_json text not null check(json_valid(revision_json)),
      recorded_at text not null
    );
```

</details>


## 行情（6张）

### `daily_candles`

主键：`instrument_id, date, adjustment_mode`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`instrument_id`|`TEXT`|是|1|—|
|`date`|`TEXT`|是|2|—|
|`adjustment_mode`|`TEXT`|是|3|`'raw'`|
|`open`|`TEXT`|是|—|—|
|`high`|`TEXT`|是|—|—|
|`low`|`TEXT`|是|—|—|
|`close`|`TEXT`|是|—|—|
|`volume`|`TEXT`|否|—|—|
|`provider`|`TEXT`|否|—|—|
|`provider_symbol`|`TEXT`|否|—|—|
|`currency`|`TEXT`|否|—|—|
|`fetched_at`|`TEXT`|否|—|—|

外键：

- `(instrument_id)` → `instruments(id)`；删除 `CASCADE`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_daily_candles_1`：`(instrument_id, date, adjustment_mode)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE daily_candles (
  instrument_id text not null references instruments(id) on delete cascade,
  date text not null,
  adjustment_mode text not null default 'raw',
  open text not null,
  high text not null,
  low text not null,
  close text not null,
  volume text, provider text, provider_symbol text, currency text, fetched_at text,
  primary key (instrument_id, date, adjustment_mode)
);
```

</details>

### `market_candles`

主键：`instrument_id, interval, timestamp, adjustment_mode`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`instrument_id`|`TEXT`|是|1|—|
|`interval`|`TEXT`|是|2|—|
|`timestamp`|`TEXT`|是|3|—|
|`adjustment_mode`|`TEXT`|是|4|`'raw'`|
|`open`|`TEXT`|是|—|—|
|`high`|`TEXT`|是|—|—|
|`low`|`TEXT`|是|—|—|
|`close`|`TEXT`|是|—|—|
|`volume`|`TEXT`|否|—|—|
|`provider`|`TEXT`|否|—|—|
|`provider_symbol`|`TEXT`|否|—|—|
|`currency`|`TEXT`|否|—|—|
|`fetched_at`|`TEXT`|否|—|—|
|`knowledge_at`|`TEXT`|否|—|—|

外键：

- `(instrument_id)` → `instruments(id)`；删除 `CASCADE`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_market_candles_1`：`(instrument_id, interval, timestamp, adjustment_mode)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE market_candles (
  instrument_id text not null references instruments(id) on delete cascade,
  interval text not null,
  timestamp text not null,
  adjustment_mode text not null default 'raw',
  open text not null,
  high text not null,
  low text not null,
  close text not null,
  volume text, provider text, provider_symbol text, currency text, fetched_at text, knowledge_at text,
  primary key (instrument_id, interval, timestamp, adjustment_mode)
);
```

</details>

### `coverage`

主键：`instrument_id, adjustment_mode`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`instrument_id`|`TEXT`|是|1|—|
|`adjustment_mode`|`TEXT`|是|2|`'raw'`|
|`start_date`|`TEXT`|否|—|—|
|`end_date`|`TEXT`|否|—|—|
|`updated_at`|`TEXT`|是|—|`current_timestamp`|
|`details_json`|`TEXT`|否|—|—|

外键：

- `(instrument_id)` → `instruments(id)`；删除 `CASCADE`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_coverage_1`：`(instrument_id, adjustment_mode)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE coverage (
  instrument_id text not null references instruments(id) on delete cascade,
  adjustment_mode text not null default 'raw',
  start_date text,
  end_date text,
  updated_at text not null default current_timestamp, details_json text check (details_json is null or json_valid(details_json)),
  primary key (instrument_id, adjustment_mode)
);
```

</details>

### `interval_coverage`

主键：`instrument_id, interval, adjustment_mode`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`instrument_id`|`TEXT`|是|1|—|
|`interval`|`TEXT`|是|2|—|
|`adjustment_mode`|`TEXT`|是|3|`'raw'`|
|`start_timestamp`|`TEXT`|否|—|—|
|`end_timestamp`|`TEXT`|否|—|—|
|`updated_at`|`TEXT`|是|—|`current_timestamp`|
|`details_json`|`TEXT`|否|—|—|

外键：

- `(instrument_id)` → `instruments(id)`；删除 `CASCADE`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_interval_coverage_1`：`(instrument_id, interval, adjustment_mode)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE interval_coverage (
  instrument_id text not null references instruments(id) on delete cascade,
  interval text not null,
  adjustment_mode text not null default 'raw',
  start_timestamp text,
  end_timestamp text,
  updated_at text not null default current_timestamp, details_json text check (details_json is null or json_valid(details_json)),
  primary key (instrument_id, interval, adjustment_mode)
);
```

</details>

### `provider_symbols`

主键：`instrument_id, provider`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`instrument_id`|`TEXT`|是|1|—|
|`provider`|`TEXT`|是|2|—|
|`provider_symbol`|`TEXT`|是|—|—|
|`metadata_json`|`TEXT`|否|—|—|
|`updated_at`|`TEXT`|是|—|`current_timestamp`|

外键：

- `(instrument_id)` → `instruments(id)`；删除 `CASCADE`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_provider_symbols_2`：`(provider, provider_symbol)`；唯一约束，唯一。

- `sqlite_autoindex_provider_symbols_1`：`(instrument_id, provider)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE provider_symbols (
  instrument_id text not null references instruments(id) on delete cascade,
  provider text not null,
  provider_symbol text not null,
  metadata_json text check (metadata_json is null or json_valid(metadata_json)),
  updated_at text not null default current_timestamp,
  primary key (instrument_id, provider),
  unique (provider, provider_symbol)
);
```

</details>

### `market_data_jobs`

主键：`id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`id`|`TEXT`|否|1|—|
|`instrument_id`|`TEXT`|否|—|—|
|`provider`|`TEXT`|是|—|—|
|`interval`|`TEXT`|否|—|—|
|`status`|`TEXT`|是|—|—|
|`progress_json`|`TEXT`|否|—|—|
|`error_json`|`TEXT`|否|—|—|
|`created_at`|`TEXT`|是|—|`current_timestamp`|
|`updated_at`|`TEXT`|是|—|`current_timestamp`|

外键：

- `(instrument_id)` → `instruments(id)`；删除 `CASCADE`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_market_data_jobs_1`：`(id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE market_data_jobs (
  id text primary key,
  instrument_id text references instruments(id) on delete cascade,
  provider text not null,
  interval text,
  status text not null,
  progress_json text check (progress_json is null or json_valid(progress_json)),
  error_json text check (error_json is null or json_valid(error_json)),
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);
```

</details>


## 复盘（28张）

### `reviews`

主键：`episode_id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`episode_id`|`TEXT`|否|1|—|
|`instrument_id`|`TEXT`|否|—|—|
|`cursor_json`|`TEXT`|否|—|—|
|`plan_json`|`TEXT`|否|—|—|
|`review_json`|`TEXT`|否|—|—|
|`drawings_json`|`TEXT`|否|—|—|
|`revisions_json`|`TEXT`|否|—|—|
|`confirmed_tags_json`|`TEXT`|否|—|—|
|`created_at`|`TEXT`|是|—|`current_timestamp`|
|`updated_at`|`TEXT`|是|—|—|

外键：

- `(instrument_id)` → `instruments(id)`；删除 `SET NULL`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_reviews_1`：`(episode_id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE reviews (
  episode_id text primary key,
  instrument_id text references instruments(id) on delete set null,
  cursor_json text check (cursor_json is null or json_valid(cursor_json)),
  plan_json text check (plan_json is null or json_valid(plan_json)),
  review_json text check (review_json is null or json_valid(review_json)),
  drawings_json text check (drawings_json is null or json_valid(drawings_json)),
  revisions_json text check (revisions_json is null or json_valid(revisions_json)),
  confirmed_tags_json text check (confirmed_tags_json is null or json_valid(confirmed_tags_json)),
  created_at text not null default current_timestamp,
  updated_at text not null
);
```

</details>

### `tag_suggestions`

主键：`id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`id`|`TEXT`|否|1|—|
|`episode_id`|`TEXT`|否|—|—|
|`instrument_id`|`TEXT`|否|—|—|
|`tag`|`TEXT`|是|—|—|
|`status`|`TEXT`|是|—|—|
|`evidence_json`|`TEXT`|否|—|—|
|`created_at`|`TEXT`|是|—|`current_timestamp`|
|`updated_at`|`TEXT`|是|—|`current_timestamp`|

外键：

- `(instrument_id)` → `instruments(id)`；删除 `SET NULL`，更新 `NO ACTION`。

- `(episode_id)` → `reviews(episode_id)`；删除 `CASCADE`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_tag_suggestions_1`：`(id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE tag_suggestions (
  id text primary key,
  episode_id text references reviews(episode_id) on delete cascade,
  instrument_id text references instruments(id) on delete set null,
  tag text not null,
  status text not null,
  evidence_json text check (evidence_json is null or json_valid(evidence_json)),
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);
```

</details>

### `recall_actual_metric_exits`

主键：`episode_id, version_kind, bundle_id, execution_id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`episode_id`|`TEXT`|是|1|—|
|`version_kind`|`TEXT`|是|2|—|
|`document_revision`|`INTEGER`|是|—|—|
|`bundle_id`|`TEXT`|是|3|—|
|`execution_id`|`TEXT`|是|4|—|
|`decision_id`|`TEXT`|否|—|—|
|`quantity`|`TEXT`|是|—|—|

外键：

- `(episode_id, version_kind, bundle_id)` → `recall_actual_metric_sources(episode_id, version_kind, bundle_id)`；删除 `CASCADE`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_recall_actual_metric_exits_1`：`(episode_id, version_kind, bundle_id, execution_id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE recall_actual_metric_exits (
 episode_id text not null, version_kind text not null, document_revision integer not null, bundle_id text not null,
 execution_id text not null, decision_id text, quantity text not null,
 primary key(episode_id,version_kind,bundle_id,execution_id),
 foreign key(episode_id,version_kind,bundle_id) references recall_actual_metric_sources(episode_id,version_kind,bundle_id) on delete cascade
);
```

</details>

### `recall_actual_metric_refs`

主键：`episode_id, version_kind, bundle_id, ref_kind, ref_id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`episode_id`|`TEXT`|是|1|—|
|`version_kind`|`TEXT`|是|2|—|
|`document_revision`|`INTEGER`|是|—|—|
|`bundle_id`|`TEXT`|是|3|—|
|`ref_kind`|`TEXT`|是|4|—|
|`ref_id`|`TEXT`|是|5|—|

外键：

- `(episode_id, version_kind, bundle_id)` → `recall_actual_metric_sources(episode_id, version_kind, bundle_id)`；删除 `CASCADE`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_recall_actual_metric_refs_1`：`(episode_id, version_kind, bundle_id, ref_kind, ref_id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE recall_actual_metric_refs (
 episode_id text not null, version_kind text not null, document_revision integer not null, bundle_id text not null,
 ref_kind text not null check(ref_kind in ('execution','plan','risk')), ref_id text not null,
 primary key(episode_id,version_kind,bundle_id,ref_kind,ref_id),
 foreign key(episode_id,version_kind,bundle_id) references recall_actual_metric_sources(episode_id,version_kind,bundle_id) on delete cascade
);
```

</details>

### `recall_actual_metric_sources`

主键：`episode_id, version_kind, bundle_id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`episode_id`|`TEXT`|是|1|—|
|`version_kind`|`TEXT`|是|2|—|
|`document_revision`|`INTEGER`|是|—|—|
|`bundle_id`|`TEXT`|是|3|—|
|`status`|`TEXT`|是|—|—|
|`missing_reason`|`TEXT`|否|—|—|
|`method_version`|`TEXT`|否|—|—|
|`capture_revision`|`INTEGER`|是|—|—|
|`evidence_digest`|`TEXT`|是|—|—|
|`computed_at`|`TEXT`|否|—|—|
|`source_bundle_id`|`TEXT`|否|—|—|
|`risk_baseline_id`|`TEXT`|否|—|—|
|`risk_plan_version_id`|`TEXT`|否|—|—|
|`risk_amount`|`TEXT`|否|—|—|
|`risk_currency`|`TEXT`|否|—|—|
|`risk_scope`|`TEXT`|否|—|—|
|`risk_method`|`TEXT`|否|—|—|

外键：

- `(episode_id, version_kind, bundle_id)` → `recall_retained_bundles(episode_id, version_kind, entity_id)`；删除 `CASCADE`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_recall_actual_metric_sources_1`：`(episode_id, version_kind, bundle_id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE recall_actual_metric_sources (
 episode_id text not null, version_kind text not null check(version_kind in ('draft','formal')), document_revision integer not null,
 bundle_id text not null, status text not null check(status in ('available','legacy-absent')), missing_reason text,
 method_version text check(method_version='actual-v1'), capture_revision integer not null, evidence_digest text not null, computed_at text, source_bundle_id text,
 risk_baseline_id text, risk_plan_version_id text, risk_amount text, risk_currency text, risk_scope text check(risk_scope in ('decision','episode')), risk_method text check(risk_method in ('planned-price-risk','fixed-budget')),
 primary key(episode_id,version_kind,bundle_id),
 foreign key(episode_id,version_kind,bundle_id) references recall_retained_bundles(episode_id,version_kind,entity_id) on delete cascade,
 check((status='available' and method_version is not null and computed_at is not null and missing_reason is null) or (status='legacy-absent' and method_version is null and missing_reason is not null))
);
```

</details>

### `recall_actual_metrics`

主键：`episode_id, version_kind, bundle_id, scope, scope_id, metric_key`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`episode_id`|`TEXT`|是|1|—|
|`version_kind`|`TEXT`|是|2|—|
|`document_revision`|`INTEGER`|是|—|—|
|`bundle_id`|`TEXT`|是|3|—|
|`scope`|`TEXT`|是|4|—|
|`scope_id`|`TEXT`|是|5|—|
|`metric_key`|`TEXT`|是|6|—|
|`value`|`TEXT`|否|—|—|
|`reason`|`TEXT`|否|—|—|
|`currency`|`TEXT`|否|—|—|
|`unit`|`TEXT`|是|—|—|
|`method_version`|`TEXT`|是|—|—|

外键：

- `(episode_id, version_kind, bundle_id)` → `recall_actual_metric_sources(episode_id, version_kind, bundle_id)`；删除 `CASCADE`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_recall_actual_metrics_1`：`(episode_id, version_kind, bundle_id, scope, scope_id, metric_key)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE recall_actual_metrics (
 episode_id text not null, version_kind text not null, document_revision integer not null, bundle_id text not null,
 scope text not null check(scope in ('bundle','exit')), scope_id text not null, metric_key text not null,
 value text, reason text, currency text, unit text not null, method_version text not null check(method_version='actual-v1'),
 primary key(episode_id,version_kind,bundle_id,scope,scope_id,metric_key),
 foreign key(episode_id,version_kind,bundle_id) references recall_actual_metric_sources(episode_id,version_kind,bundle_id) on delete cascade,
 check((value is null and reason is not null) or (value is not null and reason is null)),
 check((scope='bundle' and scope_id='') or (scope='exit' and length(scope_id)>0))
);
```

</details>

### `recall_bundle_baselines`

主键：`episode_id, version_kind, bundle_id, baseline_id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`episode_id`|`TEXT`|是|1|—|
|`version_kind`|`TEXT`|是|2|—|
|`document_revision`|`INTEGER`|是|—|—|
|`bundle_id`|`TEXT`|是|3|—|
|`baseline_id`|`TEXT`|是|4|—|

外键：

- `(episode_id, version_kind, baseline_id)` → `recall_risk_baselines(episode_id, version_kind, entity_id)`；删除 `CASCADE`，更新 `NO ACTION`。

- `(episode_id, version_kind, bundle_id)` → `recall_retained_bundles(episode_id, version_kind, entity_id)`；删除 `CASCADE`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_recall_bundle_baselines_1`：`(episode_id, version_kind, bundle_id, baseline_id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE recall_bundle_baselines (
 episode_id text not null, version_kind text not null, document_revision integer not null, bundle_id text not null, baseline_id text not null,
 primary key(episode_id,version_kind,bundle_id,baseline_id),
 foreign key(episode_id,version_kind,bundle_id) references recall_retained_bundles(episode_id,version_kind,entity_id) on delete cascade,
 foreign key(episode_id,version_kind,baseline_id) references recall_risk_baselines(episode_id,version_kind,entity_id) on delete cascade
);
```

</details>

### `recall_bundle_evaluations`

主键：`episode_id, version_kind, bundle_id, evaluation_revision_id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`episode_id`|`TEXT`|是|1|—|
|`version_kind`|`TEXT`|是|2|—|
|`document_revision`|`INTEGER`|是|—|—|
|`bundle_id`|`TEXT`|是|3|—|
|`evaluation_revision_id`|`TEXT`|是|4|—|

外键：

- `(episode_id, version_kind, evaluation_revision_id)` → `recall_exit_evaluations(episode_id, version_kind, entity_id)`；删除 `CASCADE`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_recall_bundle_evaluations_1`：`(episode_id, version_kind, bundle_id, evaluation_revision_id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE recall_bundle_evaluations (
 episode_id text not null, version_kind text not null, document_revision integer not null, bundle_id text not null, evaluation_revision_id text not null,
 primary key(episode_id,version_kind,bundle_id,evaluation_revision_id),
 foreign key(episode_id,version_kind,evaluation_revision_id) references recall_exit_evaluations(episode_id,version_kind,entity_id) on delete cascade
);
```

</details>

### `recall_bundle_manual_evaluations`

主键：`episode_id, version_kind, bundle_id, manual_evaluation_revision_id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`episode_id`|`TEXT`|是|1|—|
|`version_kind`|`TEXT`|是|2|—|
|`document_revision`|`INTEGER`|是|—|—|
|`bundle_id`|`TEXT`|是|3|—|
|`manual_evaluation_revision_id`|`TEXT`|是|4|—|

外键：

无声明外键；这不表示应用层没有关联校验。

索引：

- `sqlite_autoindex_recall_bundle_manual_evaluations_1`：`(episode_id, version_kind, bundle_id, manual_evaluation_revision_id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE recall_bundle_manual_evaluations (
 episode_id text not null, version_kind text not null, document_revision integer not null, bundle_id text not null, manual_evaluation_revision_id text not null,
 primary key(episode_id,version_kind,bundle_id,manual_evaluation_revision_id)
);
```

</details>

### `recall_bundle_plans`

主键：`episode_id, version_kind, bundle_id, plan_version_id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`episode_id`|`TEXT`|是|1|—|
|`version_kind`|`TEXT`|是|2|—|
|`document_revision`|`INTEGER`|是|—|—|
|`bundle_id`|`TEXT`|是|3|—|
|`plan_version_id`|`TEXT`|是|4|—|

外键：

- `(episode_id, version_kind, plan_version_id)` → `recall_plan_versions(episode_id, version_kind, entity_id)`；删除 `CASCADE`，更新 `NO ACTION`。

- `(episode_id, version_kind, bundle_id)` → `recall_retained_bundles(episode_id, version_kind, entity_id)`；删除 `CASCADE`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_recall_bundle_plans_1`：`(episode_id, version_kind, bundle_id, plan_version_id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE recall_bundle_plans (
 episode_id text not null, version_kind text not null, document_revision integer not null, bundle_id text not null, plan_version_id text not null,
 primary key(episode_id,version_kind,bundle_id,plan_version_id),
 foreign key(episode_id,version_kind,bundle_id) references recall_retained_bundles(episode_id,version_kind,entity_id) on delete cascade,
 foreign key(episode_id,version_kind,plan_version_id) references recall_plan_versions(episode_id,version_kind,entity_id) on delete cascade
);
```

</details>

### `recall_documents`

主键：`episode_id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`episode_id`|`TEXT`|否|1|—|
|`draft_json`|`TEXT`|是|—|—|
|`finalized_json`|`TEXT`|否|—|—|
|`revision`|`INTEGER`|是|—|`0`|
|`updated_at`|`TEXT`|是|—|—|

外键：

无声明外键；这不表示应用层没有关联校验。

索引：

- `sqlite_autoindex_recall_documents_1`：`(episode_id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE recall_documents (
  episode_id text primary key,
  draft_json text not null check (json_valid(draft_json)),
  finalized_json text check (finalized_json is null or json_valid(finalized_json)),
  revision integer not null default 0 check (revision >= 0),
  updated_at text not null
);
```

</details>

### `recall_evaluation_associations`

主键：`episode_id, version_kind, evaluation_id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`episode_id`|`TEXT`|是|1|—|
|`version_kind`|`TEXT`|是|2|—|
|`document_revision`|`INTEGER`|是|—|—|
|`evaluation_id`|`TEXT`|是|3|—|
|`decision_id`|`TEXT`|否|—|—|
|`status`|`TEXT`|是|—|—|

外键：

无声明外键；这不表示应用层没有关联校验。

索引：

- `sqlite_autoindex_recall_evaluation_associations_1`：`(episode_id, version_kind, evaluation_id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE recall_evaluation_associations (
 episode_id text not null, version_kind text not null check(version_kind in ('draft','formal')), document_revision integer not null,
 evaluation_id text not null, decision_id text, status text not null check(status in ('linked','needs-confirmation')),
 primary key(episode_id,version_kind,evaluation_id),check((status='linked' and decision_id is not null) or (status='needs-confirmation' and decision_id is null))
);
```

</details>

### `recall_evaluation_evidence`

主键：`episode_id, version_kind, evaluation_entity_id, ordinal`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`episode_id`|`TEXT`|是|1|—|
|`version_kind`|`TEXT`|是|2|—|
|`document_revision`|`INTEGER`|是|—|—|
|`evaluation_entity_id`|`TEXT`|是|3|—|
|`ordinal`|`INTEGER`|是|4|—|
|`kind`|`TEXT`|是|—|—|
|`drawing_id`|`TEXT`|否|—|—|
|`text_revision`|`INTEGER`|否|—|—|
|`owner_id`|`TEXT`|否|—|—|
|`snapshot_id`|`TEXT`|否|—|—|

外键：

- `(episode_id, version_kind, evaluation_entity_id)` → `recall_exit_evaluations(episode_id, version_kind, entity_id)`；删除 `CASCADE`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_recall_evaluation_evidence_1`：`(episode_id, version_kind, evaluation_entity_id, ordinal)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE recall_evaluation_evidence (
 episode_id text not null, version_kind text not null, document_revision integer not null, evaluation_entity_id text not null, ordinal integer not null,
 kind text not null check(kind in ('text','snapshot')), drawing_id text, text_revision integer, owner_id text, snapshot_id text,
 primary key(episode_id,version_kind,evaluation_entity_id,ordinal),
 foreign key(episode_id,version_kind,evaluation_entity_id) references recall_exit_evaluations(episode_id,version_kind,entity_id) on delete cascade,
 check((kind='text' and drawing_id is not null and text_revision>0 and owner_id is not null and snapshot_id is null) or (kind='snapshot' and snapshot_id is not null and drawing_id is null and text_revision is null and owner_id is null))
);
```

</details>

### `recall_evaluation_executions`

主键：`episode_id, version_kind, evaluation_entity_id, execution_id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`episode_id`|`TEXT`|是|1|—|
|`version_kind`|`TEXT`|是|2|—|
|`document_revision`|`INTEGER`|是|—|—|
|`evaluation_entity_id`|`TEXT`|是|3|—|
|`execution_id`|`TEXT`|是|4|—|

外键：

- `(episode_id, version_kind, evaluation_entity_id)` → `recall_exit_evaluations(episode_id, version_kind, entity_id)`；删除 `CASCADE`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_recall_evaluation_executions_1`：`(episode_id, version_kind, evaluation_entity_id, execution_id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE recall_evaluation_executions (
 episode_id text not null, version_kind text not null, document_revision integer not null, evaluation_entity_id text not null, execution_id text not null,
 primary key(episode_id,version_kind,evaluation_entity_id,execution_id),
 foreign key(episode_id,version_kind,evaluation_entity_id) references recall_exit_evaluations(episode_id,version_kind,entity_id) on delete cascade
);
```

</details>

### `recall_evaluation_selections`

主键：`episode_id, version_kind, decision_id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`episode_id`|`TEXT`|是|1|—|
|`version_kind`|`TEXT`|是|2|—|
|`document_revision`|`INTEGER`|是|—|—|
|`decision_id`|`TEXT`|是|3|—|
|`evaluation_id`|`TEXT`|是|—|—|

外键：

- `(episode_id, version_kind, evaluation_id)` → `recall_evaluation_associations(episode_id, version_kind, evaluation_id)`；删除 `CASCADE`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_recall_evaluation_selections_1`：`(episode_id, version_kind, decision_id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE recall_evaluation_selections (
 episode_id text not null, version_kind text not null check(version_kind in ('draft','formal')), document_revision integer not null,
 decision_id text not null, evaluation_id text not null,
 primary key(episode_id,version_kind,decision_id),
 foreign key(episode_id,version_kind,evaluation_id) references recall_evaluation_associations(episode_id,version_kind,evaluation_id) on delete cascade
);
```

</details>

### `recall_evaluation_tags`

主键：`episode_id, version_kind, evaluation_entity_id, tag_id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`episode_id`|`TEXT`|是|1|—|
|`version_kind`|`TEXT`|是|2|—|
|`document_revision`|`INTEGER`|是|—|—|
|`evaluation_entity_id`|`TEXT`|是|3|—|
|`tag_id`|`TEXT`|是|4|—|
|`dictionary_version`|`TEXT`|是|—|—|

外键：

- `(episode_id, version_kind, evaluation_entity_id)` → `recall_exit_evaluations(episode_id, version_kind, entity_id)`；删除 `CASCADE`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_recall_evaluation_tags_1`：`(episode_id, version_kind, evaluation_entity_id, tag_id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE recall_evaluation_tags (
 episode_id text not null, version_kind text not null, document_revision integer not null, evaluation_entity_id text not null,
 tag_id text not null check(tag_id in ('position','entry','exit','analysis')), dictionary_version text not null check(dictionary_version='manual-v1'),
 primary key(episode_id,version_kind,evaluation_entity_id,tag_id),
 foreign key(episode_id,version_kind,evaluation_entity_id) references recall_exit_evaluations(episode_id,version_kind,entity_id) on delete cascade
);
```

</details>

### `recall_exit_evaluations`

主键：`episode_id, version_kind, entity_id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`episode_id`|`TEXT`|是|1|—|
|`version_kind`|`TEXT`|是|2|—|
|`document_revision`|`INTEGER`|是|—|—|
|`entity_id`|`TEXT`|是|3|—|
|`state`|`TEXT`|是|—|—|
|`evaluation_id`|`TEXT`|是|—|—|
|`captured_decision_id`|`TEXT`|是|—|—|
|`early_exit`|`TEXT`|否|—|—|
|`adherence`|`TEXT`|否|—|—|
|`reason`|`TEXT`|否|—|—|
|`reason_detail`|`TEXT`|否|—|—|
|`compared_plan_version_id`|`TEXT`|否|—|—|
|`compared_target_id`|`TEXT`|否|—|—|
|`dictionary_version`|`TEXT`|是|—|—|
|`source`|`TEXT`|是|—|—|
|`recorded_by`|`TEXT`|是|—|—|
|`recorded_phase`|`TEXT`|是|—|—|
|`recorded_at`|`TEXT`|是|—|—|
|`knowledge_cursor`|`TEXT`|是|—|—|
|`execution_cursor`|`TEXT`|是|—|—|
|`has_seen_future`|`INTEGER`|是|—|—|
|`retained_at`|`TEXT`|否|—|—|

外键：

无声明外键；这不表示应用层没有关联校验。

索引：

- `sqlite_autoindex_recall_exit_evaluations_1`：`(episode_id, version_kind, entity_id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE recall_exit_evaluations (
 episode_id text not null, version_kind text not null check(version_kind in ('draft','formal')), document_revision integer not null,
 entity_id text not null, state text not null check(state in ('draft','retained')), evaluation_id text not null, captured_decision_id text not null,
 early_exit text check(early_exit in ('yes','no','uncertain')), adherence text check(adherence in ('as-planned','deviated','no-plan')),
 reason text check(reason in ('planned-partial','structure-invalid','risk-reduction','emotion','capital-need','other')), reason_detail text,
 compared_plan_version_id text, compared_target_id text, dictionary_version text not null check(dictionary_version='manual-v1'),
 source text not null check(source='manual-retrospective'), recorded_by text not null check(recorded_by='user'),
 recorded_phase text not null check(recorded_phase='post-review'), recorded_at text not null, knowledge_cursor text not null,
 execution_cursor text not null, has_seen_future integer not null check(has_seen_future in (0,1)), retained_at text,
 primary key(episode_id,version_kind,entity_id), check(reason!='other' or (reason_detail is not null and length(trim(reason_detail))>0)),
 check(compared_target_id is null or compared_plan_version_id is not null)
);
```

</details>

### `recall_manual_evaluation_association_executions`

主键：`episode_id, version_kind, evaluation_id, execution_id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`episode_id`|`TEXT`|是|1|—|
|`version_kind`|`TEXT`|是|2|—|
|`document_revision`|`INTEGER`|是|—|—|
|`evaluation_id`|`TEXT`|是|3|—|
|`execution_id`|`TEXT`|是|4|—|

外键：

- `(episode_id, version_kind, evaluation_id)` → `recall_manual_evaluation_associations(episode_id, version_kind, evaluation_id)`；删除 `CASCADE`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_recall_manual_evaluation_association_executions_1`：`(episode_id, version_kind, evaluation_id, execution_id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE recall_manual_evaluation_association_executions (
 episode_id text not null, version_kind text not null, document_revision integer not null, evaluation_id text not null, execution_id text not null,
 primary key(episode_id,version_kind,evaluation_id,execution_id),
 foreign key(episode_id,version_kind,evaluation_id) references recall_manual_evaluation_associations(episode_id,version_kind,evaluation_id) on delete cascade
);
```

</details>

### `recall_manual_evaluation_associations`

主键：`episode_id, version_kind, evaluation_id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`episode_id`|`TEXT`|是|1|—|
|`version_kind`|`TEXT`|是|2|—|
|`document_revision`|`INTEGER`|是|—|—|
|`evaluation_id`|`TEXT`|是|3|—|
|`decision_id`|`TEXT`|否|—|—|
|`status`|`TEXT`|是|—|—|

外键：

无声明外键；这不表示应用层没有关联校验。

索引：

- `sqlite_autoindex_recall_manual_evaluation_associations_1`：`(episode_id, version_kind, evaluation_id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE recall_manual_evaluation_associations (
 episode_id text not null, version_kind text not null, document_revision integer not null, evaluation_id text not null,
 decision_id text check(decision_id is null), status text not null check(status in ('linked','needs-confirmation')),
 primary key(episode_id,version_kind,evaluation_id)
);
```

</details>

### `recall_manual_evaluation_evidence`

主键：`episode_id, version_kind, evaluation_entity_id, ordinal`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`episode_id`|`TEXT`|是|1|—|
|`version_kind`|`TEXT`|是|2|—|
|`document_revision`|`INTEGER`|是|—|—|
|`evaluation_entity_id`|`TEXT`|是|3|—|
|`ordinal`|`INTEGER`|是|4|—|
|`kind`|`TEXT`|是|—|—|
|`drawing_id`|`TEXT`|否|—|—|
|`text_revision`|`INTEGER`|否|—|—|
|`owner_id`|`TEXT`|否|—|—|
|`snapshot_id`|`TEXT`|否|—|—|

外键：

- `(episode_id, version_kind, evaluation_entity_id)` → `recall_manual_evaluations(episode_id, version_kind, entity_id)`；删除 `CASCADE`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_recall_manual_evaluation_evidence_1`：`(episode_id, version_kind, evaluation_entity_id, ordinal)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE recall_manual_evaluation_evidence (
 episode_id text not null, version_kind text not null, document_revision integer not null, evaluation_entity_id text not null, ordinal integer not null,
 kind text not null check(kind in ('text','snapshot')), drawing_id text, text_revision integer, owner_id text, snapshot_id text,
 primary key(episode_id,version_kind,evaluation_entity_id,ordinal),
 foreign key(episode_id,version_kind,evaluation_entity_id) references recall_manual_evaluations(episode_id,version_kind,entity_id) on delete cascade,
 check((kind='text' and drawing_id is not null and text_revision>0 and owner_id is not null and snapshot_id is null) or (kind='snapshot' and snapshot_id is not null and drawing_id is null and text_revision is null and owner_id is null))
);
```

</details>

### `recall_manual_evaluation_executions`

主键：`episode_id, version_kind, evaluation_entity_id, execution_id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`episode_id`|`TEXT`|是|1|—|
|`version_kind`|`TEXT`|是|2|—|
|`document_revision`|`INTEGER`|是|—|—|
|`evaluation_entity_id`|`TEXT`|是|3|—|
|`execution_id`|`TEXT`|是|4|—|

外键：

- `(episode_id, version_kind, evaluation_entity_id)` → `recall_manual_evaluations(episode_id, version_kind, entity_id)`；删除 `CASCADE`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_recall_manual_evaluation_executions_1`：`(episode_id, version_kind, evaluation_entity_id, execution_id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE recall_manual_evaluation_executions (
 episode_id text not null, version_kind text not null, document_revision integer not null, evaluation_entity_id text not null, execution_id text not null,
 primary key(episode_id,version_kind,evaluation_entity_id,execution_id),
 foreign key(episode_id,version_kind,evaluation_entity_id) references recall_manual_evaluations(episode_id,version_kind,entity_id) on delete cascade
);
```

</details>

### `recall_manual_evaluation_tags`

主键：`episode_id, version_kind, evaluation_entity_id, tag_id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`episode_id`|`TEXT`|是|1|—|
|`version_kind`|`TEXT`|是|2|—|
|`document_revision`|`INTEGER`|是|—|—|
|`evaluation_entity_id`|`TEXT`|是|3|—|
|`tag_id`|`TEXT`|是|4|—|
|`dictionary_version`|`TEXT`|是|—|—|

外键：

- `(episode_id, version_kind, evaluation_entity_id)` → `recall_manual_evaluations(episode_id, version_kind, entity_id)`；删除 `CASCADE`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_recall_manual_evaluation_tags_1`：`(episode_id, version_kind, evaluation_entity_id, tag_id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE recall_manual_evaluation_tags (
 episode_id text not null, version_kind text not null, document_revision integer not null, evaluation_entity_id text not null,
 tag_id text not null check(tag_id in ('position','entry','analysis')), dictionary_version text not null check(dictionary_version='manual-v1'),
 primary key(episode_id,version_kind,evaluation_entity_id,tag_id),
 foreign key(episode_id,version_kind,evaluation_entity_id) references recall_manual_evaluations(episode_id,version_kind,entity_id) on delete cascade
);
```

</details>

### `recall_manual_evaluations`

主键：`episode_id, version_kind, entity_id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`episode_id`|`TEXT`|是|1|—|
|`version_kind`|`TEXT`|是|2|—|
|`document_revision`|`INTEGER`|是|—|—|
|`entity_id`|`TEXT`|是|3|—|
|`state`|`TEXT`|是|—|—|
|`evaluation_id`|`TEXT`|是|—|—|
|`target_scope`|`TEXT`|是|—|—|
|`target_decision_id`|`TEXT`|否|—|—|
|`dictionary_version`|`TEXT`|是|—|—|
|`source`|`TEXT`|是|—|—|
|`recorded_by`|`TEXT`|是|—|—|
|`recorded_phase`|`TEXT`|是|—|—|
|`recorded_at`|`TEXT`|是|—|—|
|`knowledge_cursor`|`TEXT`|是|—|—|
|`execution_cursor`|`TEXT`|是|—|—|
|`has_seen_future`|`INTEGER`|是|—|—|
|`retained_at`|`TEXT`|否|—|—|

外键：

无声明外键；这不表示应用层没有关联校验。

索引：

- `sqlite_autoindex_recall_manual_evaluations_1`：`(episode_id, version_kind, entity_id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE recall_manual_evaluations (
 episode_id text not null, version_kind text not null check(version_kind in ('draft','formal')), document_revision integer not null,
 entity_id text not null, state text not null check(state in ('draft','retained')), evaluation_id text not null,
 target_scope text not null check(target_scope='episode'), target_decision_id text check(target_decision_id is null),
 dictionary_version text not null check(dictionary_version='manual-v1'), source text not null check(source='manual-retrospective'),
 recorded_by text not null check(recorded_by='user'), recorded_phase text not null check(recorded_phase='post-review'), recorded_at text not null,
 knowledge_cursor text not null, execution_cursor text not null, has_seen_future integer not null check(has_seen_future in (0,1)), retained_at text,
 primary key(episode_id,version_kind,entity_id)
);
```

</details>

### `recall_plan_associations`

主键：`episode_id, version_kind, plan_id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`episode_id`|`TEXT`|是|1|—|
|`version_kind`|`TEXT`|是|2|—|
|`document_revision`|`INTEGER`|是|—|—|
|`plan_id`|`TEXT`|是|3|—|
|`decision_id`|`TEXT`|否|—|—|
|`status`|`TEXT`|是|—|—|

外键：

无声明外键；这不表示应用层没有关联校验。

索引：

- `sqlite_autoindex_recall_plan_associations_1`：`(episode_id, version_kind, plan_id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE recall_plan_associations (
 episode_id text not null, version_kind text not null check(version_kind in ('draft','formal')), document_revision integer not null,
 plan_id text not null, decision_id text, status text not null check(status in ('linked','needs-confirmation')),
 primary key(episode_id,version_kind,plan_id), check((status='linked' and decision_id is not null) or (status='needs-confirmation' and decision_id is null))
);
```

</details>

### `recall_plan_targets`

主键：`episode_id, version_kind, plan_entity_id, entity_id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`episode_id`|`TEXT`|是|1|—|
|`version_kind`|`TEXT`|是|2|—|
|`document_revision`|`INTEGER`|是|—|—|
|`plan_entity_id`|`TEXT`|是|3|—|
|`entity_id`|`TEXT`|是|4|—|
|`ordinal`|`INTEGER`|是|—|—|
|`price`|`TEXT`|否|—|—|
|`quantity`|`TEXT`|否|—|—|
|`ratio`|`TEXT`|否|—|—|

外键：

- `(episode_id, version_kind, plan_entity_id)` → `recall_plan_versions(episode_id, version_kind, entity_id)`；删除 `CASCADE`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_recall_plan_targets_1`：`(episode_id, version_kind, plan_entity_id, entity_id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE recall_plan_targets (
 episode_id text not null, version_kind text not null, document_revision integer not null, plan_entity_id text not null, entity_id text not null, ordinal integer not null,
 price text, quantity text, ratio text, primary key(episode_id,version_kind,plan_entity_id,entity_id),
 foreign key(episode_id,version_kind,plan_entity_id) references recall_plan_versions(episode_id,version_kind,entity_id) on delete cascade
);
```

</details>

### `recall_plan_versions`

主键：`episode_id, version_kind, entity_id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`episode_id`|`TEXT`|是|1|—|
|`version_kind`|`TEXT`|是|2|—|
|`document_revision`|`INTEGER`|是|—|—|
|`entity_id`|`TEXT`|是|3|—|
|`state`|`TEXT`|是|—|—|
|`plan_id`|`TEXT`|是|—|—|
|`decision_id`|`TEXT`|是|—|—|
|`parent_version_id`|`TEXT`|否|—|—|
|`kind`|`TEXT`|是|—|—|
|`direction`|`TEXT`|否|—|—|
|`currency`|`TEXT`|否|—|—|
|`price_basis`|`TEXT`|否|—|—|
|`entry`|`TEXT`|否|—|—|
|`initial_stop`|`TEXT`|否|—|—|
|`size_input_mode`|`TEXT`|是|—|—|
|`size_input_value`|`TEXT`|否|—|—|
|`resolved_quantity`|`TEXT`|否|—|—|
|`quantity_unit`|`TEXT`|是|—|—|
|`capital_amount`|`TEXT`|否|—|—|
|`capital_currency`|`TEXT`|否|—|—|
|`capital_as_of`|`TEXT`|否|—|—|
|`capital_source`|`TEXT`|否|—|—|
|`capital_snapshot_ref`|`TEXT`|否|—|—|
|`recorded_phase`|`TEXT`|是|—|—|
|`source`|`TEXT`|是|—|—|
|`recorded_at`|`TEXT`|是|—|—|
|`knowledge_cursor`|`TEXT`|是|—|—|
|`execution_cursor`|`TEXT`|是|—|—|
|`has_seen_future`|`INTEGER`|是|—|—|
|`retained_at`|`TEXT`|否|—|—|
|`revision_reason`|`TEXT`|否|—|—|
|`quantity_step`|`TEXT`|否|—|—|
|`step_source`|`TEXT`|否|—|—|
|`rounding`|`TEXT`|否|—|—|
|`derived_unrounded_quantity`|`TEXT`|否|—|—|
|`rounding_delta`|`TEXT`|否|—|—|
|`budget_amount`|`TEXT`|否|—|—|
|`budget_currency`|`TEXT`|否|—|—|
|`budget_scope`|`TEXT`|否|—|—|
|`budget_source_description`|`TEXT`|否|—|—|
|`budget_evidence_reference`|`TEXT`|否|—|—|
|`budget_provenance`|`TEXT`|否|—|—|
|`budget_knowledge_cursor`|`TEXT`|否|—|—|
|`budget_execution_cursor`|`TEXT`|否|—|—|

外键：

无声明外键；这不表示应用层没有关联校验。

索引：

- `sqlite_autoindex_recall_plan_versions_1`：`(episode_id, version_kind, entity_id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE recall_plan_versions (
 episode_id text not null, version_kind text not null check(version_kind in ('draft','formal')), document_revision integer not null check(document_revision>=0),
 entity_id text not null, state text not null check(state in ('draft','retained')), plan_id text not null, decision_id text not null, parent_version_id text,
 kind text not null check(kind in ('initial','adjustment','correction')), direction text check(direction in ('long','short')), currency text,
 price_basis text check(price_basis in ('raw','adjusted')), entry text, initial_stop text, size_input_mode text not null check(size_input_mode in ('quantity','amount','ratio')),
 size_input_value text, resolved_quantity text, quantity_unit text not null check(quantity_unit in ('share','unit')),
 capital_amount text, capital_currency text, capital_as_of text, capital_source text, capital_snapshot_ref text,
 recorded_phase text not null check(recorded_phase in ('pre-entry','holding','post-review')), source text not null check(source='retrospective'), recorded_at text not null,
 knowledge_cursor text not null, execution_cursor text not null, has_seen_future integer not null check(has_seen_future in (0,1)), retained_at text, revision_reason text, quantity_step text, step_source text, rounding text, derived_unrounded_quantity text, rounding_delta text, budget_amount text, budget_currency text, budget_scope text, budget_source_description text, budget_evidence_reference text, budget_provenance text, budget_knowledge_cursor text, budget_execution_cursor text,
 primary key(episode_id,version_kind,entity_id)
);
```

</details>

### `recall_retained_bundles`

主键：`episode_id, version_kind, entity_id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`episode_id`|`TEXT`|是|1|—|
|`version_kind`|`TEXT`|是|2|—|
|`document_revision`|`INTEGER`|是|—|—|
|`entity_id`|`TEXT`|是|3|—|
|`snapshot_id`|`TEXT`|是|—|—|
|`capture_revision`|`INTEGER`|是|—|—|
|`retained_at`|`TEXT`|是|—|—|
|`evidence_digest`|`TEXT`|是|—|—|
|`evidence_json`|`TEXT`|是|—|—|
|`decisions_json`|`TEXT`|是|—|—|
|`capture_phase`|`TEXT`|否|—|—|
|`capture_cursor`|`TEXT`|否|—|—|
|`capture_execution_cursor`|`TEXT`|否|—|—|
|`capture_timeframe`|`TEXT`|否|—|—|
|`capture_viewport_json`|`TEXT`|否|—|—|
|`capture_has_seen_future`|`INTEGER`|否|—|—|

外键：

无声明外键；这不表示应用层没有关联校验。

索引：

- `sqlite_autoindex_recall_retained_bundles_1`：`(episode_id, version_kind, entity_id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE recall_retained_bundles (
 episode_id text not null, version_kind text not null check(version_kind in ('draft','formal')), document_revision integer not null, entity_id text not null,
 snapshot_id text not null, capture_revision integer not null, retained_at text not null, evidence_digest text not null,
 evidence_json text not null check(json_valid(evidence_json)), decisions_json text not null check(json_valid(decisions_json)), capture_phase text check(capture_phase in ('pre-entry','holding','post-review')), capture_cursor text, capture_execution_cursor text, capture_timeframe text, capture_viewport_json text check(capture_viewport_json is null or json_valid(capture_viewport_json)), capture_has_seen_future integer check(capture_has_seen_future in (0,1)), primary key(episode_id,version_kind,entity_id)
);
```

</details>

### `recall_risk_baselines`

主键：`episode_id, version_kind, entity_id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`episode_id`|`TEXT`|是|1|—|
|`version_kind`|`TEXT`|是|2|—|
|`document_revision`|`INTEGER`|是|—|—|
|`entity_id`|`TEXT`|是|3|—|
|`scope`|`TEXT`|是|—|—|
|`decision_id`|`TEXT`|否|—|—|
|`plan_version_id`|`TEXT`|是|—|—|
|`amount`|`TEXT`|是|—|—|
|`currency`|`TEXT`|是|—|—|
|`method`|`TEXT`|是|—|—|
|`method_version`|`TEXT`|是|—|—|
|`frozen_at`|`TEXT`|是|—|—|
|`corrects_baseline_id`|`TEXT`|否|—|—|

外键：

- `(episode_id, version_kind, plan_version_id)` → `recall_plan_versions(episode_id, version_kind, entity_id)`；删除 `CASCADE`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_recall_risk_baselines_1`：`(episode_id, version_kind, entity_id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE recall_risk_baselines (
 episode_id text not null, version_kind text not null, document_revision integer not null, entity_id text not null, scope text not null check(scope in ('decision','episode')),
 decision_id text, plan_version_id text not null, amount text not null, currency text not null, method text not null check(method in ('planned-price-risk','fixed-budget')),
 method_version text not null check(method_version='risk-v1'), frozen_at text not null, corrects_baseline_id text,
 primary key(episode_id,version_kind,entity_id),foreign key(episode_id,version_kind,plan_version_id) references recall_plan_versions(episode_id,version_kind,entity_id) on delete cascade,
 check(scope!='decision' or decision_id is not null)
);
```

</details>


## 设置和资金辅助（2张）

### `app_settings`

主键：`key`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`key`|`TEXT`|否|1|—|
|`value_json`|`TEXT`|是|—|—|
|`updated_at`|`TEXT`|是|—|`current_timestamp`|

外键：

无声明外键；这不表示应用层没有关联校验。

索引：

- `sqlite_autoindex_app_settings_1`：`(key)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE app_settings (
  key text primary key,
  value_json text not null check (json_valid(value_json)),
  updated_at text not null default current_timestamp
);
```

</details>

### `account_principal_provisionals`

主键：`account_id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`account_id`|`TEXT`|否|1|—|
|`currency`|`TEXT`|是|—|—|
|`amount`|`TEXT`|是|—|—|
|`as_of`|`TEXT`|否|—|—|
|`status`|`TEXT`|是|—|—|
|`source`|`TEXT`|是|—|—|
|`revision`|`INTEGER`|是|—|—|
|`updated_at`|`TEXT`|是|—|—|

外键：

无声明外键；这不表示应用层没有关联校验。

索引：

- `sqlite_autoindex_account_principal_provisionals_1`：`(account_id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE account_principal_provisionals (
  account_id text primary key,
  currency text not null,
  amount text not null,
  as_of text,
  status text not null check(status in ('provisional','confirmed')),
  source text not null,
  revision integer not null check(revision >= 0),
  updated_at text not null
);
```

</details>


## 维护与迁移（5张）

### `data_migrations`

主键：`source_fingerprint`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`source_fingerprint`|`TEXT`|否|1|—|
|`source_client_id`|`TEXT`|是|—|—|
|`version`|`INTEGER`|是|—|—|
|`status`|`TEXT`|是|—|—|
|`counts_json`|`TEXT`|是|—|—|
|`validation_digest`|`TEXT`|否|—|—|
|`created_at`|`TEXT`|是|—|`current_timestamp`|
|`completed_at`|`TEXT`|否|—|—|

外键：

无声明外键；这不表示应用层没有关联校验。

索引：

- `sqlite_autoindex_data_migrations_1`：`(source_fingerprint)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE data_migrations (
  source_fingerprint text primary key,
  source_client_id text not null,
  version integer not null,
  status text not null,
  counts_json text not null check (json_valid(counts_json)),
  validation_digest text,
  created_at text not null default current_timestamp,
  completed_at text
);
```

</details>

### `tradingview_account_migration_aliases`

主键：`operation_id, alias_kind, old_id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`operation_id`|`TEXT`|是|1|—|
|`alias_kind`|`TEXT`|是|2|—|
|`old_id`|`TEXT`|是|3|—|
|`new_id`|`TEXT`|是|—|—|

外键：

- `(operation_id)` → `tradingview_account_migration_operations(operation_id)`；删除 `CASCADE`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_tradingview_account_migration_aliases_1`：`(operation_id, alias_kind, old_id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE tradingview_account_migration_aliases (
  operation_id text not null references tradingview_account_migration_operations(operation_id) on delete cascade,
  alias_kind text not null check(alias_kind in ('account','episode','scope')),
  old_id text not null,
  new_id text not null,
  primary key(operation_id, alias_kind, old_id)
);
```

</details>

### `tradingview_account_migration_dependencies`

主键：`operation_id, table_name, row_key`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`operation_id`|`TEXT`|是|1|—|
|`table_name`|`TEXT`|是|2|—|
|`row_key`|`TEXT`|是|3|—|
|`row_digest`|`TEXT`|是|—|—|

外键：

- `(operation_id)` → `tradingview_account_migration_operations(operation_id)`；删除 `CASCADE`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_tradingview_account_migration_dependencies_1`：`(operation_id, table_name, row_key)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE tradingview_account_migration_dependencies (
  operation_id text not null references tradingview_account_migration_operations(operation_id) on delete cascade,
  table_name text not null,
  row_key text not null,
  row_digest text not null,
  primary key(operation_id, table_name, row_key)
);
```

</details>

### `tradingview_account_migration_operations`

主键：`operation_id`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`operation_id`|`TEXT`|否|1|—|
|`operation_kind`|`TEXT`|是|—|—|
|`parent_operation_id`|`TEXT`|否|—|—|
|`idempotency_key`|`TEXT`|是|—|—|
|`plan_digest`|`TEXT`|是|—|—|
|`base_snapshot_digest`|`TEXT`|是|—|—|
|`after_snapshot_digest`|`TEXT`|否|—|—|
|`status`|`TEXT`|是|—|—|
|`request_json`|`TEXT`|是|—|—|
|`result_json`|`TEXT`|是|—|—|
|`created_at`|`TEXT`|是|—|—|
|`updated_at`|`TEXT`|是|—|—|

外键：

- `(parent_operation_id)` → `tradingview_account_migration_operations(operation_id)`；删除 `NO ACTION`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_tradingview_account_migration_operations_2`：`(idempotency_key)`；唯一约束，唯一。

- `sqlite_autoindex_tradingview_account_migration_operations_1`：`(operation_id)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE tradingview_account_migration_operations (
  operation_id text primary key,
  operation_kind text not null check(operation_kind in ('commit','rollback')),
  parent_operation_id text references tradingview_account_migration_operations(operation_id),
  idempotency_key text not null unique,
  plan_digest text not null,
  base_snapshot_digest text not null,
  after_snapshot_digest text,
  status text not null check(status in ('committed','rolled-back')),
  request_json text not null check(json_valid(request_json)),
  result_json text not null check(json_valid(result_json)),
  created_at text not null,
  updated_at text not null
);
```

</details>

### `tradingview_account_migration_rows`

主键：`operation_id, table_name, primary_key`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`operation_id`|`TEXT`|是|1|—|
|`table_name`|`TEXT`|是|2|—|
|`primary_key`|`TEXT`|是|3|—|
|`before_json`|`TEXT`|否|—|—|
|`after_json`|`TEXT`|否|—|—|
|`before_digest`|`TEXT`|是|—|—|
|`after_digest`|`TEXT`|是|—|—|

外键：

- `(operation_id)` → `tradingview_account_migration_operations(operation_id)`；删除 `CASCADE`，更新 `NO ACTION`。

索引：

- `sqlite_autoindex_tradingview_account_migration_rows_1`：`(operation_id, table_name, primary_key)`；主键，唯一。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE tradingview_account_migration_rows (
  operation_id text not null references tradingview_account_migration_operations(operation_id) on delete cascade,
  table_name text not null,
  primary_key text not null,
  before_json text check(before_json is null or json_valid(before_json)),
  after_json text check(after_json is null or json_valid(after_json)),
  before_digest text not null,
  after_digest text not null,
  primary key(operation_id, table_name, primary_key)
);
```

</details>


## 结构版本记录（1张）

### `schema_migrations`

主键：`version`。

<details><summary>字段、引用及索引</summary>

|字段|声明类型|声明非空|主键序号|默认值|
|---|---|---|---|---|
|`version`|`INTEGER`|否|1|—|
|`name`|`TEXT`|是|—|—|
|`checksum`|`TEXT`|是|—|—|
|`applied_at`|`TEXT`|是|—|`current_timestamp`|

外键：

无声明外键；这不表示应用层没有关联校验。

索引：

无独立索引条目；请同时查看主键声明。

</details>

<details><summary>完整建表语句（含检查条件）</summary>

```sql
CREATE TABLE schema_migrations(version integer primary key,name text not null,checksum text not null,applied_at text not null default current_timestamp);
```

</details>

## 如何重建本附录

证据脚本仅使用内存数据库和虚构记录，不调用应用数据库打开函数。先运行 `evidence/inspect-schema.mjs`，再运行 `evidence/build-schema-reference.py`。脚本均位于[本轮证据目录](../../../.scratch/database-model-review-2026-10-26/evidence/)，Node版本必须使用项目固定版本。

表结构提取通过，不等于页面、财务或性能验收通过。
