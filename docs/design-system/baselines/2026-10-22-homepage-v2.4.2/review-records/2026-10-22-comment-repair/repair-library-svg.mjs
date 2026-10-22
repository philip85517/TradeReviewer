#!/usr/bin/env node

/**
 * V2.4.1 comment repair: C06, C08, C09 and C10.
 *
 * This deliberately edits only the approved library/statistics SVG set.  It
 * uses exact replacements so an upstream layout change fails loudly instead
 * of silently rewriting a new design.
 */
import fs from "node:fs";
import path from "node:path";

const imageRoot = path.resolve(import.meta.dirname, "../../source/images");
const allowed = new Set([
  "handoff.svg",
  "journeys-date.svg",
  "hcr06-final-sim-ab.svg",
  "hcr06-final-pending-library.svg",
  "hcr06-final-pending-library-1280.svg",
  "hcr06-final-pending-return.svg",
  "hcr06-final-return.svg",
  "01-live-normal.svg",
  "02-simulation-normal.svg",
  "03-distribution-selected.svg",
  "04-return.svg",
  "05-loading.svg",
  "06-empty.svg",
  "07-error.svg",
  "08-extreme.svg",
  "09-missing-input.svg",
]);

function update(name, edit) {
  if (!allowed.has(name)) throw new Error(`Refusing unapproved SVG: ${name}`);
  const file = path.join(imageRoot, name);
  const before = fs.readFileSync(file, "utf8");
  const after = edit(before);
  if (after === before) throw new Error(`No change produced for ${name}`);
  fs.writeFileSync(file, after);
  process.stdout.write(`${name}: ${before.length} -> ${after.length}\n`);
}

function replaceOnce(source, oldText, newText, label = oldText.slice(0, 80)) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`Expected one ${label}, found ${count}`);
  return source.replace(oldText, newText);
}

function removeOnce(source, pattern, label) {
  const matches = source.match(pattern);
  if (!matches || matches.length !== 1) {
    throw new Error(`Expected one ${label}, found ${matches?.length ?? 0}`);
  }
  return source.replace(pattern, "");
}

const searchIcon =
  '<svg x="870" y="220" width="18" height="18" viewBox="0 0 24 24"><path d="M17 17l4 4M19 11a8 8 0 1 1-16 0a8 8 0 1 1 16 0" fill="none" stroke="#A8B6CB" stroke-width="1.5" stroke-linecap="round"/></svg>';
const refreshIcon =
  '<svg x="1107" y="220" width="18" height="18" viewBox="0 0 24 24"><path d="M20 8a9 9 0 1 0 0 9M20 2v6h-6" fill="none" stroke="#E6EDF7" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// C06: keep the existing handoff canvas and button, but make the lower copy a
// product journey rather than an implementation/state contract.
update("handoff.svg", (s) => {
  s = replaceOnce(
    s,
    "<text x=\"96\" y=\"286\" class=\"m\" font-size=\"15\">来源日期、市场、账户条件已生效；进入后不重复应用。</text>",
    "<text x=\"96\" y=\"286\" class=\"m\" font-size=\"15\">到达：来源日期、市场、账户条件已保留，列表显示对应交易。</text>",
    "handoff arrival copy",
  );
  s = replaceOnce(
    s,
    "<text x=\"96\" y=\"330\" class=\"m\" font-size=\"14\">返回：首页原期间、排序、页码、滚动位置与触发焦点。</text>",
    "<text x=\"96\" y=\"330\" class=\"m\" font-size=\"14\">返回：回到首页原期间、排序、页码、滚动位置与触发焦点。</text>",
    "handoff return copy",
  );
  s = replaceOnce(
    s,
    "<text x=\"64\" y=\"470\" class=\"b\" font-size=\"14\">入口状态合同</text><text x=\"64\" y=\"514\" font-size=\"16\">perspective=live · sourceFocus=home contribution · sourceDate=2026-10-15</text><text x=\"64\" y=\"560\" class=\"m\" font-size=\"15\">列表条件复制进入；返回动作在产品内容内可见。</text>",
    "<text x=\"64\" y=\"470\" class=\"b\" font-size=\"14\">用户动线</text><text x=\"64\" y=\"514\" font-size=\"15\">入口：首页当前期间贡献 · A股</text><text x=\"64\" y=\"550\" class=\"m\" font-size=\"15\">点击：选择“进入交易库（实盘）”</text><text x=\"64\" y=\"586\" class=\"m\" font-size=\"15\">到达：实盘交易列表 · 12 笔交易</text><text x=\"64\" y=\"622\" class=\"m\" font-size=\"15\">详情：选择标的或交易，进入详情与复盘入口</text><text x=\"64\" y=\"658\" class=\"m\" font-size=\"15\">返回：回到原期间、排序、页码、滚动位置与触发焦点</text>",
    "handoff implementation block",
  );
  return s;
});

// C08/C09: the simulated A/B library journey uses a real 36px date control,
// 14px labels, SVG search/refresh icons, and common right edges for numerics.
update("hcr06-final-sim-ab.svg", (s) => {
  s = replaceOnce(
    s,
    '<text x="96" y="239" font-size="15">练习日期：</text><svg x="178" y="223" width="16" height="16" viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 2v4M16 2v4M5 9h14" fill="none" stroke="#E6EDF7" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><text x="204" y="239" font-size="15">全部</text><text x="390" y="239" font-size="15">市场：全部市场</text>',
    '<text x="96" y="243" font-size="14">练习日期：</text><rect x="168" y="219" width="190" height="36" rx="6" class="p"/><svg x="178" y="229" width="16" height="16" viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 2v4M16 2v4M5 9h14" fill="none" stroke="#E6EDF7" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><text x="204" y="243" font-size="14">全部</text><text x="390" y="243" font-size="14">市场：全部市场</text>',
    "sim-ab date control",
  );
  s = replaceOnce(
    s,
    '<rect x="850" y="219" width="220" height="36" rx="6" class="p"/><text x="870" y="243" class="m" font-size="13">搜索练习</text><rect x="1098" y="219" width="36" height="36" rx="6" class="p"/><text x="1116" y="244" text-anchor="middle" font-size="20">↻</text>',
    `<rect x="850" y="219" width="220" height="36" rx="6" class="p"/>${searchIcon.replaceAll('y="220"', 'y="228"')}<text x="894" y="243" class="m" font-size="14">搜索练习</text><rect x="1098" y="219" width="36" height="36" rx="6" class="p"/>${refreshIcon.replaceAll('x="1107" y="220"', 'x="1107" y="228"')}`,
    "sim-ab search and refresh controls",
  );
  s = replaceOnce(
    s,
    '<text x="690" y="340" class="m" font-size="13">练习记录</text><text x="850" y="340" class="m" font-size="13">有效回合</text>',
    '<text x="790" y="340" class="m" font-size="13" text-anchor="end">练习记录</text><text x="920" y="340" class="m" font-size="13" text-anchor="end">有效回合</text>',
    "sim-ab numeric headers",
  );
  s = replaceOnce(
    s,
    '<text x="690" y="410" font-size="15">1</text><text x="850" y="410" class="g" font-size="15">2</text>',
    '<text x="790" y="410" font-size="15" text-anchor="end">1</text><text x="920" y="410" class="g" font-size="15" text-anchor="end">2</text>',
    "sim-ab row A numerics",
  );
  s = replaceOnce(
    s,
    '<text x="690" y="500" font-size="15">1</text><text x="850" y="500" class="g" font-size="15">1</text>',
    '<text x="790" y="500" font-size="15" text-anchor="end">1</text><text x="920" y="500" class="g" font-size="15" text-anchor="end">1</text>',
    "sim-ab row B numerics",
  );
  return s;
});

update("journeys-date.svg", (s) => {
  s = replaceOnce(
    s,
    '<text x="92" y="235" font-size="14">日期：</text><svg x="138" y="219" width="16" height="16" viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 2v4M16 2v4M5 9h14" fill="none" stroke="#E6EDF7" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><text x="164" y="235" font-size="14">单日 · 2026-10-15</text><text x="430" y="235" font-size="14">市场：全部市场</text>',
    '<text x="92" y="235" font-size="14">日期：</text><rect x="128" y="211" width="250" height="36" rx="6" class="p"/><svg x="138" y="220" width="16" height="16" viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 2v4M16 2v4M5 9h14" fill="none" stroke="#E6EDF7" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><text x="164" y="235" font-size="14">单日 · 2026-10-15</text><text x="430" y="235" font-size="14">市场：全部市场</text>',
    "journeys date control",
  );
  s = replaceOnce(
    s,
    '<rect x="850" y="211" width="220" height="36" rx="6" class="p"/><text x="870" y="235" class="m" font-size="13">搜索交易</text><rect x="1098" y="211" width="36" height="36" rx="6" class="p"/><text x="1116" y="236" text-anchor="middle" font-size="20">↻</text>',
    `<rect x="850" y="211" width="220" height="36" rx="6" class="p"/><svg x="870" y="220" width="18" height="18" viewBox="0 0 24 24"><path d="M17 17l4 4M19 11a8 8 0 1 1-16 0a8 8 0 1 1 16 0" fill="none" stroke="#A8B6CB" stroke-width="1.5" stroke-linecap="round"/></svg><text x="894" y="235" class="m" font-size="14">搜索交易</text><rect x="1098" y="211" width="36" height="36" rx="6" class="p"/><svg x="1107" y="220" width="18" height="18" viewBox="0 0 24 24"><path d="M20 8a9 9 0 1 0 0 9M20 2v6h-6" fill="none" stroke="#E6EDF7" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    "journeys search and refresh controls",
  );
  return s;
});

// Replace the same icon defect in the responsive pending-library controls,
// preserving their approved 220/36/28 and 190/36/20 tool geometry.
update("hcr06-final-pending-library.svg", (s) =>
  replaceOnce(
    s,
    '<rect x="850" y="211" width="220" height="36" rx="6" class="p"/><text x="870" y="235" class="m" font-size="13">搜索待复盘交易</text><rect x="1098" y="211" width="150" height="36" rx="6" fill="#162944" stroke="#6ca8ff"/><text x="1173" y="235" text-anchor="middle" class="b" font-size="13">待复盘 · 12</text><rect x="1264" y="211" width="36" height="36" rx="6" class="p"/><text x="1282" y="236" text-anchor="middle" font-size="20">↻</text>',
    '<rect x="850" y="211" width="220" height="36" rx="6" class="p"/><svg x="870" y="220" width="18" height="18" viewBox="0 0 24 24"><path d="M17 17l4 4M19 11a8 8 0 1 1-16 0a8 8 0 1 1 16 0" fill="none" stroke="#A8B6CB" stroke-width="1.5" stroke-linecap="round"/></svg><text x="894" y="235" class="m" font-size="13">搜索待复盘交易</text><rect x="1098" y="211" width="150" height="36" rx="6" fill="#162944" stroke="#6ca8ff"/><text x="1173" y="235" text-anchor="middle" class="b" font-size="13">待复盘 · 12</text><rect x="1264" y="211" width="36" height="36" rx="6" class="p"/><svg x="1273" y="220" width="18" height="18" viewBox="0 0 24 24"><path d="M20 8a9 9 0 1 0 0 9M20 2v6h-6" fill="none" stroke="#E6EDF7" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    "pending-library 1440 controls",
  ),
);

update("hcr06-final-pending-library-1280.svg", (s) =>
  replaceOnce(
    s,
    '<rect x="720" y="175" width="190" height="36" rx="6" class="p"/><text x="738" y="199" class="m" font-size="12">搜索待复盘交易</text><rect x="930" y="175" width="140" height="36" rx="6" fill="#162944" stroke="#6ca8ff"/><text x="1000" y="199" text-anchor="middle" class="b" font-size="12">待复盘 · 12</text><rect x="1084" y="175" width="36" height="36" rx="6" class="p"/><text x="1102" y="200" text-anchor="middle" font-size="18">↻</text>',
    '<rect x="720" y="175" width="190" height="36" rx="6" class="p"/><svg x="738" y="184" width="18" height="18" viewBox="0 0 24 24"><path d="M17 17l4 4M19 11a8 8 0 1 1-16 0a8 8 0 1 1 16 0" fill="none" stroke="#A8B6CB" stroke-width="1.5" stroke-linecap="round"/></svg><text x="762" y="199" class="m" font-size="12">搜索待复盘交易</text><rect x="930" y="175" width="140" height="36" rx="6" fill="#162944" stroke="#6ca8ff"/><text x="1000" y="199" text-anchor="middle" class="b" font-size="12">待复盘 · 12</text><rect x="1084" y="175" width="36" height="36" rx="6" class="p"/><svg x="1093" y="184" width="18" height="18" viewBox="0 0 24 24"><path d="M20 8a9 9 0 1 0 0 9M20 2v6h-6" fill="none" stroke="#E6EDF7" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    "pending-library 1280 controls",
  ),
);

// C06 return surfaces keep the journey legible without exposing binding or
// snapshot implementation language.
update("hcr06-final-pending-return.svg", (s) =>
  replaceOnce(
    s,
    "<text x=\"96\" y=\"546\" class=\"m\" font-size=\"14\">待复盘列表的局部筛选不反写首页；返回只恢复来源上下文。</text>",
    "<text x=\"96\" y=\"546\" class=\"m\" font-size=\"14\">返回后首页保留来源期间、排序与触发焦点。</text>",
    "pending return implementation copy",
  ),
);

update("hcr06-final-return.svg", (s) =>
  replaceOnce(
    s,
    "<text x=\"96\" y=\"325\" class=\"m\" font-size=\"15\">交易库条件不双向绑定首页；返回动作来自产品页面。</text>",
    "<text x=\"96\" y=\"325\" class=\"m\" font-size=\"15\">返回后首页保留原期间、排序、滚动位置与触发焦点。</text>",
    "return implementation copy",
  ),
);

const dateControlFiles = [
  "01-live-normal.svg",
  "02-simulation-normal.svg",
  "03-distribution-selected.svg",
  "04-return.svg",
  "05-loading.svg",
  "06-empty.svg",
  "07-error.svg",
  "08-extreme.svg",
  "09-missing-input.svg",
];

for (const name of dateControlFiles) {
  update(name, (s) => {
    s = replaceOnce(
      s,
      'rect x="182" y="211" width="190" height="34"',
      'rect x="182" y="209" width="190" height="36"',
      `${name} date height`,
    );
    s = replaceOnce(s, '<svg x="190" y="219" width="16"', '<svg x="190" y="218" width="16"', `${name} calendar center`);
    s = replaceOnce(s, '<text x="214" y="233" font-size="12"', '<text x="214" y="233" font-size="14"', `${name} date value size`);
    s = removeOnce(s, /<text x="1292" y="233"[^>]*>条件与列表同步 · 不改变原分布<\/text>/g, `${name} implementation note`);
    return s;
  });
}

// C10 keeps the existing chart geometry, removes state/debug labels, and
// presents count + percentage in a two-line label for the narrow distribution
// rows. Percentages are based on the current range's effective-round count.
const ratio = (x, y, count, percentage) =>
  `<text x="${x}" y="${y}" font-size="11" fill="#A8B6CB" font-weight="400" text-anchor="start"><tspan x="${x}" dy="0">${count} 回合</tspan><tspan x="${x}" dy="14">${percentage}</tspan></text>`;

update("01-live-normal.svg", (s) => {
  s = removeOnce(s, /<text x="1120" y="160"[^>]*>列表 \/ 统计共享条件<\/text>/g, "01 implementation state label");
  s = replaceOnce(s, '<text x="494" y="770" font-size="11" fill="#A8B6CB" font-weight="400" text-anchor="start">4 回合</text>', ratio(494, 770, 4, "16.67%"), "01 loss >50% ratio");
  s = replaceOnce(s, '<text x="550" y="804" font-size="11" fill="#A8B6CB" font-weight="400" text-anchor="start">6 回合</text>', ratio(550, 804, 6, "25.00%"), "01 loss 0-50% ratio");
  s = replaceOnce(s, '<text x="466" y="838" font-size="11" fill="#A8B6CB" font-weight="400" text-anchor="start">3 回合</text>', ratio(466, 838, 3, "12.50%"), "01 zero ratio");
  s = replaceOnce(s, '<text x="606" y="872" font-size="11" fill="#A8B6CB" font-weight="400" text-anchor="start">8 回合</text>', ratio(606, 872, 8, "33.33%"), "01 profit 0-50% ratio");
  s = replaceOnce(s, '<text x="466" y="906" font-size="11" fill="#A8B6CB" font-weight="400" text-anchor="start">3 回合</text>', ratio(466, 906, 3, "12.50%"), "01 profit >50% ratio");
  s = removeOnce(s, /<text x="64" y="970"[^>]*>正常：趋势固定使用批准的金额指标；分布可独立切换收益率或金额。<\/text>/g, "01 chart implementation note");
  s = replaceOnce(s, "筛选只影响下方列表，不重算此分布。", "下钻只影响下方列表；分布分母仍为当前范围有效回合。", "01 fixed distribution denominator copy");
  return s;
});

update("02-simulation-normal.svg", (s) => {
  s = replaceOnce(s, '<text x="494" y="770" font-size="11" fill="#A8B6CB" font-weight="400" text-anchor="start">4 回合</text>', ratio(494, 770, 4, "16.67%"), "02 loss >50% ratio");
  s = replaceOnce(s, '<text x="550" y="804" font-size="11" fill="#A8B6CB" font-weight="400" text-anchor="start">6 回合</text>', ratio(550, 804, 6, "25.00%"), "02 loss 0-50% ratio");
  s = replaceOnce(s, '<text x="466" y="838" font-size="11" fill="#A8B6CB" font-weight="400" text-anchor="start">3 回合</text>', ratio(466, 838, 3, "12.50%"), "02 zero ratio");
  s = replaceOnce(s, '<text x="606" y="872" font-size="11" fill="#A8B6CB" font-weight="400" text-anchor="start">8 回合</text>', ratio(606, 872, 8, "33.33%"), "02 profit 0-50% ratio");
  s = replaceOnce(s, '<text x="466" y="906" font-size="11" fill="#A8B6CB" font-weight="400" text-anchor="start">3 回合</text>', ratio(466, 906, 3, "12.50%"), "02 profit >50% ratio");
  s = removeOnce(s, /<text x="64" y="970"[^>]*>模拟盘：趋势使用金额；练习记录数与交易回合数分开。<\/text>/g, "02 chart implementation note");
  s = replaceOnce(s, "筛选只影响下方列表，不重算此分布。", "下钻只影响下方列表；分布分母仍为当前范围有效回合。", "02 fixed distribution denominator copy");
  return s;
});

update("03-distribution-selected.svg", (s) =>
  replaceOnce(
    s,
    "区间选中：局部回合提供逐行进入复盘的入口；顶部条件与原分布保留。",
    "当前区间：下方列表展示所选回合；分布分母仍为当前范围有效回合。",
    "03 selected distribution copy",
  ),
);

update("04-return.svg", (s) =>
  replaceOnce(s, ">返回后不重算分布</text>", ">返回后保留原选中区间</text>", "04 state copy"),
);

update("05-loading.svg", (s) => {
  s = removeOnce(s, /<text x="1120" y="160"[^>]*>loading<\/text>/g, "05 implementation state label");
  return replaceOnce(s, "加载：保留金额图表、金额轴、摘要和分布空间；本周/本月/本年按上海自然期间计算。", "加载中：保持当前期间与统计条件，数据返回后更新。", "05 loading copy");
});

update("06-empty.svg", (s) => removeOnce(s, /<text x="1120" y="160"[^>]*>empty<\/text>/g, "06 implementation state label"));
update("07-error.svg", (s) => removeOnce(s, /<text x="1120" y="160"[^>]*>error<\/text>/g, "07 implementation state label"));

update("08-extreme.svg", (s) => {
  s = removeOnce(s, /<text x="1120" y="160"[^>]*>extreme<\/text>/g, "08 implementation state label");
  s = replaceOnce(s, '<text x="382" y="770" font-size="11" fill="#A8B6CB" font-weight="400" text-anchor="start">0 回合</text>', ratio(382, 770, 0, "0.00%"), "08 loss >50% ratio");
  s = replaceOnce(s, '<text x="382" y="804" font-size="11" fill="#A8B6CB" font-weight="400" text-anchor="start">0 回合</text>', ratio(382, 804, 0, "0.00%"), "08 loss 0-50% ratio");
  s = replaceOnce(s, '<text x="382" y="838" font-size="11" fill="#A8B6CB" font-weight="400" text-anchor="start">0 回合</text>', ratio(382, 838, 0, "0.00%"), "08 zero ratio");
  s = replaceOnce(s, '<text x="382" y="872" font-size="11" fill="#A8B6CB" font-weight="400" text-anchor="start">0 回合</text>', ratio(382, 872, 0, "0.00%"), "08 profit 0-50% ratio");
  s = replaceOnce(s, '<text x="410" y="906" font-size="11" fill="#A8B6CB" font-weight="400" text-anchor="start">1 回合</text>', ratio(410, 906, 1, "100.00%"), "08 profit >50% ratio");
  s = replaceOnce(s, "筛选只影响下方列表，不重算此分布。", "下钻只影响下方列表；分布分母仍为当前范围有效回合。", "08 fixed distribution denominator copy");
  return replaceOnce(s, "极值态：同一极值实盘回合集合派生坐标、摘要和分布。", "极值样本：按实际回合显示坐标、摘要与分布。", "08 extreme copy");
});

update("09-missing-input.svg", (s) => removeOnce(s, /<text x="1120" y="160"[^>]*>missing-input<\/text>/g, "09 implementation state label"));

