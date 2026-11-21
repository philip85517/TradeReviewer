/** Shared expressions keep the directory read and its covering index identical. */
export const LIBRARY_ACCOUNT_LABEL_SQL = "coalesce(json_extract(evidence_json,'$.accountLabel'),'')";
export const LIBRARY_ACCOUNT_NATURE_SQL = `coalesce(
  json_extract(evidence_json,'$.source.tradeNature'),
  trade_nature,
  case json_extract(evidence_json,'$.source.tradingNature')
    when 'simulated' then 'simulation'
    else json_extract(evidence_json,'$.source.tradingNature') end,
  case json_extract(evidence_json,'$.source.platform')
    when 'tradingview' then 'simulation'
    when 'futu' then 'live'
    when 'tiger' then 'live'
    when 'china-merchants' then 'live'
    else 'unknown' end
)`;
export const LIBRARY_ACCOUNT_PREDICATE_SQL = "account is not null and account<>''";
export const LIBRARY_ACCOUNT_DIRECTORY_SQL = `
  with directory as materialized (
  select distinct account as id,
    ${LIBRARY_ACCOUNT_LABEL_SQL} as label,
    ${LIBRARY_ACCOUNT_NATURE_SQL} as nature
  from executions
  where ${LIBRARY_ACCOUNT_PREDICATE_SQL}
  )
  select * from directory order by id,label,nature
`;
export const LIBRARY_SCOPE_INDEX_SCHEMA = `
  create index executions_library_account_directory
  on executions(account, ${LIBRARY_ACCOUNT_LABEL_SQL}, ${LIBRARY_ACCOUNT_NATURE_SQL})
  where ${LIBRARY_ACCOUNT_PREDICATE_SQL};
`;
