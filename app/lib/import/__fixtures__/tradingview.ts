export const header = '交易编号,类型,日期和时间,信号,价格 CNY,大小（数量）,大小（价值）,净损益 CNY,回报 %,手续费 CNY,有利波动 CNY,有利波动 %,不利波动 CNY,不利波动 %,累计损益 CNY,累计损益 %,持续时间（K线）';
export const row = (id: number, type: string, date: string, price: string, quantity = '100', fee = '0.60') => `${id},${type},${date},"signal, quoted",${price},${quantity},1000,99.40,9.94,${fee},100,10,-10,-1,99.40,1,3`;
export const csv = [header, row(1,'多头出场','2021-03-01','11'),row(1,'多头进场','2021-02-19','10')].join('\r\n');
export function fileFor(text = csv, name = '回放交易_SSE_600330_2026-09-03.csv') {
  return { name, arrayBuffer: async () => new TextEncoder().encode('\uFEFF'+text).buffer, type:'text/csv' };
}
