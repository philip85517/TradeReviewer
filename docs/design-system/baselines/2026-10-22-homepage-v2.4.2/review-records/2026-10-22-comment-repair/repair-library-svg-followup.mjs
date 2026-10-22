#!/usr/bin/env node

/**
 * Follow-up for the V2.4.1 C10 review: keep secondary statistics rules in
 * accessible 16px info icons instead of rendering them as persistent copy.
 * The handoff return details are recorded outside the product canvas.
 */
import fs from "node:fs";
import path from "node:path";

const imageRoot = path.resolve(import.meta.dirname, "../../source/images");
const allowed = new Set([
  "handoff.svg",
  "hcr06-final-sim-ab.svg",
  "hcr06-final-pending-library.svg",
  "hcr06-final-pending-library-1280.svg",
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
  if (name !== "handoff.svg" && before.includes('data-control="stats-scope-info"')) {
    process.stdout.write(`${name}: already applied\n`);
    return;
  }
  if (name === "handoff.svg" && before.includes("返回：回到首页原来源") && before.includes('<text x="96" y="250" font-size="20">12 笔交易</text>') && !before.includes("到达：来源日期、市场、账户条件已保留")) {
    process.stdout.write(`${name}: already applied\n`);
    return;
  }
  const after = edit(before);
  if (after === before) {
    process.stdout.write(`${name}: already applied\n`);
    return;
  }
  fs.writeFileSync(file, after);
  process.stdout.write(`${name}: ${before.length} -> ${after.length}\n`);
}

function replaceOnce(source, oldText, newText, label = oldText.slice(0, 80)) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`Expected one ${label}, found ${count}`);
  return source.replace(oldText, newText);
}

function replaceIfPending(source, oldText, newText, label) {
  if (source.includes(oldText)) return replaceOnce(source, oldText, newText, label);
  if (source.includes(newText)) return source;
  throw new Error(`Expected pending or applied ${label}`);
}

function removeIfPresent(source, text, label) {
  if (!source.includes(text)) return source;
  return replaceOnce(source, text, "", label);
}

function removeOnce(source, pattern, label) {
  const matches = source.match(pattern);
  if (!matches || matches.length !== 1) {
    throw new Error(`Expected one ${label}, found ${matches?.length ?? 0}`);
  }
  return source.replace(pattern, "");
}

// Final geometry and typography follow-up.  The main follow-up above is
// intentionally idempotent at the info-icon boundary; these focused edits
// need to run after that boundary as well, so keep their exact replacements
// in a separate helper with the same approved-file guard.
function refine(name, edit) {
  if (!allowed.has(name)) throw new Error(`Refusing unapproved SVG: ${name}`);
  const file = path.join(imageRoot, name);
  const before = fs.readFileSync(file, "utf8");
  const after = edit(before);
  if (after === before) {
    process.stdout.write(`${name}: final refinement already applied\n`);
    return;
  }
  fs.writeFileSync(file, after);
  process.stdout.write(`${name}: final refinement ${before.length} -> ${after.length}\n`);
}

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function infoIcon(label, x = 1080, y = 298) {
  const escaped = escapeXml(label);
  return `<g role="img" aria-label="${escaped}" data-control="stats-scope-info" data-icon="info"><svg x="${x}" y="${y}" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><title>${escaped}</title><circle cx="12" cy="12" r="9" fill="none" stroke="#6CA8FF" stroke-width="1.5"/><path d="M12 10v6M12 7h.01" fill="none" stroke="#6CA8FF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></g>`;
}

function addInfoIcon(source, label, name, anchor = '<text x="944" y="310" font-size="16" fill="#E6EDF7" font-weight="600" text-anchor="start">范围汇总</text>', x = 1080, y = 298) {
  return replaceOnce(
    source,
    anchor,
    anchor + infoIcon(label, x, y),
    `${name} scope info icon`,
  );
}

const scopeCopy = {
  "01-live-normal.svg": "统计口径：分布分母固定为当前范围全部有效回合，包含净零并排除未平仓余量；每个有效配对按最近开仓优先计为一回合；趋势按真实平仓日期聚合净额；下钻不改变分母。",
  "02-simulation-normal.svg": "统计口径：分布分母固定为当前范围全部有效回合，包含净零并排除未平仓余量；每个有效配对按最近开仓优先计为一回合；模拟盘趋势按练习日期口径聚合；下钻不改变分母。",
  "03-distribution-selected.svg": "统计口径：分布分母固定为当前范围全部有效回合，包含净零并排除未平仓余量；局部列表只展示所选回合；下钻与返回不改变分母。",
  "04-return.svg": "统计口径：分布分母固定为当前范围全部有效回合，包含净零并排除未平仓余量；返回保留原选中区间与列表，分布口径不因返回改变。",
  "05-loading.svg": "加载说明：趋势按平仓日期、分布按当前范围有效回合计算；加载期间保留当前期间、条件和图表空间。",
  "06-empty.svg": "统计口径：未平仓回合不计入已平仓统计；当前市场估值缺失不影响已闭合回合；只有收益所需输入缺失时才显示不可计算原因与“—”。",
  "07-error.svg": "统计口径：当前市场估值缺失不改变已闭合回合统计；读取失败保留上次有效条件并允许重试。",
  "08-extreme.svg": "统计口径：趋势与摘要使用同一金额单位并保留 0 线；分布来自同一极值实盘集合；分母固定为当前范围全部有效回合；下钻不改变分母。",
  "09-missing-input.svg": "统计口径：缺少平仓估值时金额与收益率不可计算；缺失项不以 0 或完整分布替代；补齐输入后重试。",
};

// C06: return-state preservation is a report/body explanation, not a
// persistent product contract. Keep the journey stage visible and concise.
update("handoff.svg", (s) => {
  s = replaceIfPending(
    s,
    '<text x="96" y="250" font-size="20">12 笔交易 · 已进入交易库</text>',
    '<text x="96" y="250" font-size="20">12 笔交易</text>',
    "handoff pre-navigation card copy",
  );
  s = removeIfPresent(
    s,
    '<text x="96" y="286" class="m" font-size="15">到达：来源日期、市场、账户条件已保留，列表显示对应交易。</text>',
    "handoff card arrival copy",
  );
  s = replaceIfPending(
    s,
    '<text x="96" y="330" class="m" font-size="14">返回：回到首页原期间、排序、页码、滚动位置与触发焦点。</text>',
    '<text x="96" y="330" class="m" font-size="14">返回：回到首页原来源。</text>',
    "handoff card return copy",
  );
  return replaceIfPending(
    s,
    '<text x="64" y="658" class="m" font-size="15">返回：回到原期间、排序、页码、滚动位置与触发焦点</text>',
    '<text x="64" y="658" class="m" font-size="15">返回：回到原首页</text>',
    "handoff journey return copy",
  );
});

update("hcr06-final-sim-ab.svg", (s) =>
  replaceIfPending(
    s,
    '<text x="260" y="340" class="m" font-size="13">标的 / practiceId</text>',
    '<text x="260" y="340" class="m" font-size="13">标的 / 练习</text>',
    "sim-ab practice header copy",
  ),
);

update("01-live-normal.svg", (s) => {
  s = addInfoIcon(s, scopeCopy["01-live-normal.svg"], "01-live-normal.svg");
  s = removeOnce(s, /<text x="112" y="620"[^>]*>金额\(CNY\)· 按真实日期聚合净额；单日样本仅显示 10-15<\/text>/g, "01 trend explanation");
  s = removeOnce(s, /<text x="944" y="602"[^>]*>分母含净零回合；未平仓余量已排除。<\/text>/g, "01 denominator explanation");
  s = removeOnce(s, /<text x="944" y="620"[^>]*>每个有效配对按最近开仓优先计为一回合。<\/text>/g, "01 pairing explanation");
  return removeOnce(s, /<text x="1160" y="866"[^>]*>下钻只影响下方列表；分布分母仍为当前范围有效回合。<\/text>/g, "01 drilldown explanation");
});

update("02-simulation-normal.svg", (s) => {
  s = addInfoIcon(s, scopeCopy["02-simulation-normal.svg"], "02-simulation-normal.svg");
  s = removeOnce(s, /<text x="112" y="620"[^>]*>金额\(CNY\)· 按真实日期聚合净额；单日样本仅显示 10-15<\/text>/g, "02 trend explanation");
  s = removeOnce(s, /<text x="944" y="602"[^>]*>分母含净零回合；未平仓余量已排除。<\/text>/g, "02 denominator explanation");
  return removeOnce(s, /<text x="1160" y="866"[^>]*>下钻只影响下方列表；分布分母仍为当前范围有效回合。<\/text>/g, "02 drilldown explanation");
});

update("03-distribution-selected.svg", (s) => {
  s = addInfoIcon(s, scopeCopy["03-distribution-selected.svg"], "03-distribution-selected.svg");
  s = removeOnce(s, /<text x="112" y="620"[^>]*>金额\(CNY\)· 按真实日期聚合净额；单日样本仅显示 10-15<\/text>/g, "03 trend explanation");
  s = removeOnce(s, /<text x="944" y="602"[^>]*>分母含净零回合；未平仓余量已排除。<\/text>/g, "03 denominator explanation");
  return removeOnce(s, /<text x="64" y="970"[^>]*>当前区间：下方列表展示所选回合；分布分母仍为当前范围有效回合。<\/text>/g, "03 drilldown explanation");
});

update("04-return.svg", (s) => {
  s = addInfoIcon(s, scopeCopy["04-return.svg"], "04-return.svg");
  s = removeOnce(s, /<text x="112" y="620"[^>]*>金额\(CNY\)· 按真实日期聚合净额；单日样本仅显示 10-15<\/text>/g, "04 trend explanation");
  s = removeOnce(s, /<text x="944" y="602"[^>]*>分母含净零回合；未平仓余量已排除。<\/text>/g, "04 denominator explanation");
  return replaceOnce(
    s,
    "<text x=\"88\" y=\"930\" font-size=\"11\" fill=\"#A8B6CB\" font-weight=\"400\" text-anchor=\"start\">返回后保持原选中区间、完整 8 回合列表与统计口径。</text>",
    "<text x=\"88\" y=\"930\" font-size=\"11\" fill=\"#A8B6CB\" font-weight=\"400\" text-anchor=\"start\">返回后保持原选中区间与完整 8 回合列表。</text>",
    "04 return visible copy",
  );
});

update("05-loading.svg", (s) => addInfoIcon(s, scopeCopy["05-loading.svg"], "05-loading.svg"));

update("06-empty.svg", (s) => {
  s = addInfoIcon(s, scopeCopy["06-empty.svg"], "06-empty.svg", '<text x="88" y="310" font-size="16" fill="#E6EDF7" font-weight="600" text-anchor="start">无可计算回合</text>', 280, 298);
  s = replaceOnce(s, "未平仓回合排除统计；扩大日期范围或重试。", "扩大日期范围或重试。", "06 empty action copy");
  s = removeOnce(s, /<text x="720" y="510"[^>]*>当前市场估值缺失不影响已闭合回合统计。<\/text>/g, "06 valuation explanation");
  s = removeOnce(s, /<text x="720" y="542"[^>]*>只有回合收益所需输入缺失时才显示不可计算原因与 “—”。<\/text>/g, "06 missing-input explanation");
  return removeOnce(s, /<text x="64" y="970"[^>]*>空态：没有已平仓回合；原因、下一步与统计口径均可见。<\/text>/g, "06 footer explanation");
});

update("07-error.svg", (s) => {
  s = addInfoIcon(s, scopeCopy["07-error.svg"], "07-error.svg", '<text x="88" y="310" font-size="16" fill="#FFC66D" font-weight="600" text-anchor="start">统计读取失败</text>', 280, 298);
  s = removeOnce(s, /<text x="720" y="490"[^>]*>当前市场估值缺失不改变已闭合回合统计。<\/text>/g, "07 valuation explanation");
  return removeOnce(s, /<text x="64" y="970"[^>]*>异常态：读取失败可重试；不把缺失估值误报为已闭合回合不可用。<\/text>/g, "07 footer explanation");
});

update("08-extreme.svg", (s) => {
  s = addInfoIcon(s, scopeCopy["08-extreme.svg"], "08-extreme.svg");
  s = removeOnce(s, /<text x="112" y="620"[^>]*>金额\(CNY\)· 极值样本仍按真实日期聚合<\/text>/g, "08 trend explanation");
  s = removeOnce(s, /<text x="944" y="404"[^>]*>坐标与摘要使用同一金额单位；保留 0 线。<\/text>/g, "08 chart explanation");
  s = removeOnce(s, /<text x="944" y="496"[^>]*>金额与收益率均可计算；分布使用同一极值实盘集合。<\/text>/g, "08 collection explanation");
  s = removeOnce(s, /<text x="1160" y="866"[^>]*>下钻只影响下方列表；分布分母仍为当前范围有效回合。<\/text>/g, "08 drilldown explanation");
  return removeOnce(s, /<text x="64" y="970"[^>]*>极值样本：按实际回合显示坐标、摘要与分布。<\/text>/g, "08 footer explanation");
});

update("09-missing-input.svg", (s) => {
  s = addInfoIcon(s, scopeCopy["09-missing-input.svg"], "09-missing-input.svg");
  s = replaceOnce(s, "缺少平仓估值（exitPrice），不能计算金额或收益率。", "缺少平仓估值，不能计算金额或收益率。", "09 user-facing missing valuation copy");
  s = replaceOnce(s, "不绘制全量分布；补齐输入后重试。", "补齐输入后重试。", "09 missing-input action copy");
  s = removeOnce(s, /<text x="944" y="552"[^>]*>缺失项不以 0 或完整分布替代。<\/text>/g, "09 zero-substitution explanation");
  return removeOnce(s, /<text x="64" y="970"[^>]*>缺失态：具体字段显示“—”、说明不可计算集合，并保留同一条件入口。<\/text>/g, "09 footer explanation");
});

// Final C06 handoff-card fit: keep the card at y=205/h=180, while moving
// only its return prompt and action up so the button ends at y=361 and leaves
// 24px inside the card.  The prompt keeps the original 20px separation.
refine("handoff.svg", (s) => {
  s = replaceIfPending(
    s,
    '<text x="96" y="330" class="m" font-size="14">返回：回到首页原来源。</text>',
    '<text x="96" y="305" class="m" font-size="14">返回：回到首页原来源。</text>',
    "handoff return prompt vertical fit",
  );
  s = replaceIfPending(
    s,
    '<rect x="96" y="350" width="190" height="36" rx="6" fill="#162944" stroke="#6ca8ff"/>',
    '<rect x="96" y="325" width="190" height="36" rx="6" fill="#162944" stroke="#6ca8ff"/>',
    "handoff button vertical fit",
  );
  return replaceIfPending(
    s,
    '<text x="191" y="374" text-anchor="middle" font-size="14">进入交易库（实盘）</text>',
    '<text x="191" y="349" text-anchor="middle" font-size="14">进入交易库（实盘）</text>',
    "handoff button label vertical fit",
  );
});

// The search labels use the shared 14px control text.  The adjacent pending
// badges retain their own badge sizes and are deliberately not changed.
refine("hcr06-final-pending-library.svg", (s) =>
  replaceIfPending(
    s,
    '<text x="894" y="235" class="m" font-size="13">搜索待复盘交易</text>',
    '<text x="894" y="235" class="m" font-size="14">搜索待复盘交易</text>',
    "pending-library 1440 search text",
  ),
);

refine("hcr06-final-pending-library-1280.svg", (s) =>
  replaceIfPending(
    s,
    '<text x="762" y="199" class="m" font-size="12">搜索待复盘交易</text>',
    '<text x="762" y="199" class="m" font-size="14">搜索待复盘交易</text>',
    "pending-library 1280 search text",
  ),
);

// The approved 14px date copy is intentionally preserved.  Only the date
// box and the following labels move, keeping the existing toolbar row and
// its 36px control height intact.
for (const name of ["05-loading.svg", "08-extreme.svg", "09-missing-input.svg"]) {
  refine(name, (s) => {
    s = replaceIfPending(
      s,
      '<rect x="182" y="209" width="190" height="36" rx="8" fill="#111A26" stroke="#283448"/>',
      '<rect x="182" y="209" width="240" height="36" rx="8" fill="#111A26" stroke="#283448"/>',
      `${name} long-date box width`,
    );
    s = replaceIfPending(
      s,
      '<text x="406" y="233" font-size="12" fill="#E6EDF7" font-weight="400" text-anchor="start">市场：全部</text>',
      '<text x="452" y="233" font-size="12" fill="#E6EDF7" font-weight="400" text-anchor="start">市场：全部</text>',
      `${name} market spacing`,
    );
    return replaceIfPending(
      s,
      '<text x="552" y="233" font-size="12" fill="#E6EDF7" font-weight="400" text-anchor="start">排序：日期 ↓</text>',
      '<text x="598" y="233" font-size="12" fill="#E6EDF7" font-weight="400" text-anchor="start">排序：日期 ↓</text>',
      `${name} sort spacing`,
    );
  });
}
