export const TENCENT_HK_700 =
  'v_hk00700="100~腾讯控股~00700~560.000~GP";';

export const TENCENT_SZ_159915 =
  'v_sz159915="51~创业板ETF易方达~159915~2.310~ETF";';

export const TENCENT_US_AAPL =
  'v_usAAPL="200~Apple Inc.~AAPL.OQ~214.050~GP";';

export const TENCENT_BLANK_NAME =
  'v_sh600519="1~~600519~1420.000~GP";';

export const TENCENT_NAME_IS_CODE =
  'v_hk00700="100~00700~00700~560.000~GP";';

export const TENCENT_HK_700_GB18030 = new Uint8Array([
  118, 95, 104, 107, 48, 48, 55, 48, 48, 61, 34, 49, 48, 48, 126, 129, 57,
  238, 57, 191, 198, 188, 188, 126, 48, 48, 55, 48, 48, 126, 53, 54, 48, 46,
  48, 48, 48, 126, 71, 80, 34, 59,
]);

export const EASTMONEY_SH_600519 = JSON.stringify({
  rc: 0,
  rt: 4,
  svr: 182995420,
  lt: 1,
  full: 1,
  data: {
    f57: "600519",
    f58: "贵州茅台",
    f107: 1,
  },
});

export const EASTMONEY_SZ_159915 = JSON.stringify({
  rc: 0,
  rt: 4,
  svr: 182995420,
  lt: 1,
  full: 1,
  data: {
    f57: "159915",
    f58: "创业板ETF易方达",
    f107: 0,
  },
});

export const EASTMONEY_SH_510300 = JSON.stringify({
  rc: 0,
  rt: 4,
  svr: 182995420,
  lt: 1,
  full: 1,
  data: {
    f57: "510300",
    f58: "沪深300ETF",
    f107: 1,
  },
});

export const EASTMONEY_WRONG_MARKET_600519 = JSON.stringify({
  rc: 0,
  rt: 4,
  svr: 182995420,
  lt: 1,
  full: 1,
  data: {
    f57: "600519",
    f58: "贵州茅台",
    f107: 0,
  },
});

export const EASTMONEY_HK_700 = JSON.stringify({
  rc: 0,
  rt: 4,
  svr: 182995420,
  lt: 1,
  full: 1,
  data: {
    f57: "00700",
    f58: "腾讯控股",
    f107: 116,
  },
});

export const EASTMONEY_US_BABA = JSON.stringify({
  rc: 0,
  rt: 4,
  svr: 182995420,
  lt: 1,
  full: 1,
  data: {
    f57: "BABA",
    f58: "Alibaba Group Holding Ltd",
    f107: 106,
  },
});

export const EASTMONEY_NO_DATA = JSON.stringify({
  rc: 0,
  rt: 4,
  svr: 182995420,
  lt: 1,
  full: 1,
  data: null,
});

export const EASTMONEY_BLANK_NAME = JSON.stringify({
  rc: 0,
  rt: 4,
  svr: 182995420,
  lt: 1,
  full: 1,
  data: {
    f57: "600519",
    f58: "   ",
    f107: 1,
  },
});

export const EASTMONEY_NAME_IS_CODE = JSON.stringify({
  rc: 0,
  rt: 4,
  svr: 182995420,
  lt: 1,
  full: 1,
  data: {
    f57: "600519",
    f58: "600519",
    f107: 1,
  },
});

export const SINA_SH_600519 =
  'var hq_str_sh600519="贵州茅台,1420.00,1410.00,1438.00";';

export const SINA_SH_600519_ASCII =
  'var hq_str_sh600519="Kweichow Moutai,1420.00,1410.00,1438.00";';

export const SINA_SH_600519_GB18030 = new Uint8Array([
  118, 97, 114, 32, 104, 113, 95, 115, 116, 114, 95, 115, 104, 54, 48, 48,
  53, 49, 57, 61, 34, 129, 57, 238, 57, 191, 198, 188, 188, 44, 49, 52, 50,
  48, 46, 48, 48, 44, 49, 52, 49, 48, 46, 48, 48, 44, 49, 52, 51, 56, 46,
  48, 48, 34, 59,
]);

export const SINA_OTHER_CODE =
  'var hq_str_gb_msft="Microsoft Corporation,426.73,425.27";';

export const SINA_NAME_IS_CODE =
  'var hq_str_sh600519="600519,1420.00,1410.00,1438.00";';
