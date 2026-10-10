"use client";
import Decimal from "decimal.js";
import type { InputHTMLAttributes, ReactNode } from "react";
import { useState } from "react";
import { applyRecallSizing, resolveRecallSizing, switchRecallSizeMode } from "../../lib/recall/sizing";
import { X } from "lucide-react";
import type { RecallPhase, RecallPlanInput } from "../../lib/recall/types";
import { calculateRecallPlan } from "../../lib/recall/plans";
type Props = {
    id?: string;
    children?: ReactNode;
    /** Content that must remain in the phase's first-screen reading order. */
    primaryContent?: ReactNode;
    /** Longer metrics, revisions, and source details that stay behind a disclosure. */
    secondaryContent?: ReactNode;
    hidden?: boolean;
    input: RecallPlanInput | null;
    phase: RecallPhase;
    readOnly: boolean;
    compactReadOnly?: boolean;
    retained?: boolean;
    onChange: (input: RecallPlanInput) => void;
    onClose: () => void;
    error?: string | null;
    knownQuantity?: string;
    hasSeenFuture?: boolean;
    missingReason?: string;
    showCloseControl?: boolean;
};
export function emptyRecallPlanInput(currency: string): RecallPlanInput {
    return {
        direction: null,
        currency,
        priceBasis: "raw",
        entry: null,
        initialStop: null,
        targets: [{
                id: "target-1", price: null, quantity: null, ratio: null
            }],
        sizeInputMode: "quantity",
        sizeInputValue: null,
        resolvedQuantity: null,
        quantityUnit: "share",
        capital: null,
        sizing: {
            quantityStep: "1", stepSource: "manual-reference", rounding: "floor", derivedUnroundedQuantity: null, roundingDelta: null
        },
    };
}
function PriceField({ label, value, onChange, inputMode = "decimal", className }: {
    label: string;
    value: string | null;
    onChange: (value: string | null) => void;
    inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
    className?: string;
}) {
    return (<label className={className}>
      <span>{label}</span>
      <input aria-label={label} inputMode={inputMode} value={value ?? ""} onChange={event => onChange(event.target.value || null)}/>
    </label>);
}
/** Display-only rounding: exact evidence is retained and keyboard/click reachable. */
export function compactRecallDerivedNumber(value: string | null | undefined): string {
    if (value == null) return "未知";
    if (!/^\d+(\.\d+)?$/.test(value)) return value;
    const exact = new Decimal(value);
    const compact = exact.toDecimalPlaces(6);
    return `${compact.eq(exact) ? "" : "≈"}${compact.toString()}`;
}

export function RecallDerivedNumber({ value, suffix = "" }: { value: string | null | undefined; suffix?: string }) {
    if (value == null) return <>未知</>;
    if (!/^\d+(\.\d+)?$/.test(value)) return <span>{value}{suffix}</span>;
    const exact = new Decimal(value);
    const compact = exact.toDecimalPlaces(6);
    const approximate = !compact.eq(exact);
    const display = <>{approximate ? "≈" : ""}{compact.toString()}{suffix}</>;
    if (!approximate) return <span className="recall-derived-number" title={value}>{display}</span>;
    return <RecallApproximateNumber value={value} compact={display} suffix={suffix} />;
}

function RecallApproximateNumber({ value, compact, suffix }: { value: string; compact: ReactNode; suffix: string }) {
    const [expanded, setExpanded] = useState(false);
    return <span className="recall-derived-number" title={value} style={{ overflowWrap: "anywhere" }}>
      <button
        type="button"
        className="recall-derived-number__toggle"
        aria-expanded={expanded}
        aria-label={`查看完整数值 ${value}`}
        onClick={() => setExpanded(current => !current)}
        onKeyDown={event => { if (event.key !== "Escape") event.stopPropagation(); }}
      >{expanded ? <>{value}{suffix}</> : compact}</button>
    </span>;
}

function isPositiveDecimal(value: string | null | undefined): value is string {
    if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value)) return false;
    try {
        const decimal = new Decimal(value);
        return decimal.isFinite() && decimal.gt(0);
    } catch {
        return false;
    }
}

function PlanSummary({ input }: {
    input: RecallPlanInput;
}) {
    return (<dl>
      <dt>方向</dt><dd>{input.direction === "long" ? "做多" : input.direction === "short" ? "做空" : "未记录"}</dd>
      <dt>币种 / 价格口径</dt>
      <dd>{input.currency ?? "未提供"} / {input.priceBasis === "raw" ? "原始价格" : input.priceBasis === "adjusted" ? "复权价格" : "未提供"}</dd>
      <dt>计划入场</dt><dd>{input.entry ?? "未记录"}</dd>
      <dt>初始止损</dt><dd>{input.initialStop ?? "未记录"}</dd>
      <dt>止盈目标</dt><dd>{input.targets[0]?.price ?? "未记录"}</dd>
      <dt>规模主输入</dt><dd>{input.sizeInputMode === "quantity" ? "数量" : input.sizeInputMode === "amount" ? "名义金额" : "仓位比例（%）"} {input.sizeInputValue ?? "未记录"}</dd>
      <dt className="recall-plan-reference-funds-label">参考资金</dt><dd className="recall-plan-reference-funds-value">{input.capital?.amount ?? "未提供"} {input.capital?.currency} · {input.capital?.asOf ?? "时点未提供"} · {input.capital?.source === "manual-reference" ? "手填参考资金" : input.capital?.source === "account-snapshot" ? "账户快照" : "来源未提供"}</dd>
      {input.sizing && <><dt>参考步长 / 取整前 / 舍去数量</dt><dd style={{overflowWrap:"anywhere"}}><RecallDerivedNumber value={input.sizing.quantityStep} /> / <RecallDerivedNumber value={input.sizing.derivedUnroundedQuantity} /> / <RecallDerivedNumber value={input.sizing.roundingDelta} />（手工参考，向下取整）</dd></>}
      <dt>计划数量</dt><dd>{input.resolvedQuantity ?? "未记录"} {input.quantityUnit === "share" ? "股" : "单位"}</dd>
    </dl>);
}

function CompactPlanSummary({ input, phase }: { input: RecallPlanInput; phase: RecallPhase }) {
    const calculation = calculateRecallPlan(input);
    const target = input.targets[0]?.price ?? "未记录";
    const quantity = input.resolvedQuantity
      ?? (input.sizeInputMode === "quantity" ? input.sizeInputValue : null)
      ?? "未提供";
    const quantityWithUnit = quantity === "未提供"
      ? quantity
      : `${quantity} ${input.quantityUnit === "share" ? "股" : "单位"}`;
    const risk = calculation.initialRisk.value === null
        ? "待补充"
        : `${calculation.initialRisk.value}${calculation.initialRisk.currency ? ` ${calculation.initialRisk.currency}` : ""}`;
    return <section className="recall-plan-compact-summary" aria-label="紧凑计划摘要">
      <div><span>计划价格</span><strong><span>{input.entry ?? "未记录"}</span><span aria-hidden="true"> / </span><span>{input.initialStop ?? "未记录"}</span><span aria-hidden="true"> / </span><span>{target}</span></strong></div>
      <div><span>{phase === "post-review" ? "计划规模 / 风险" : "当前计划规模 / 风险"}</span><strong>{quantityWithUnit} · {risk} · {calculation.expectedR.value === null ? "待补充" : <RecallDerivedNumber value={calculation.expectedR.value} suffix="R" />}</strong></div>
    </section>;
}
export function RecallPlanFields({ input, onChange }: {
    input: RecallPlanInput;
    onChange: Props["onChange"];
}) {
    const sizing = resolveRecallSizing(input);
    const calculation = calculateRecallPlan(input);
    const capitalAmount = input.capital?.amount;
    const validCapitalAmount = isPositiveDecimal(capitalAmount) ? capitalAmount : null;
    const capitalCurrencyMatches = Boolean(validCapitalAmount && input.capital?.currency === input.currency);
    const riskPercentDenominator = validCapitalAmount && capitalCurrencyMatches ? validCapitalAmount : null;
    const riskPercent = isPositiveDecimal(calculation.initialRisk.value) && riskPercentDenominator
      ? new Decimal(calculation.initialRisk.value).div(riskPercentDenominator).mul(100).toFixed()
      : null;
    const change = (patch: Partial<RecallPlanInput>) => onChange(applyRecallSizing({
        ...input, ...patch
    }));
    const changeCapital = (patch: Partial<NonNullable<RecallPlanInput["capital"]>>) => change({
        capital: {
            amount: input.capital?.amount ?? null,
            currency: input.capital?.currency ?? input.currency,
            asOf: input.capital?.asOf ?? null,
            ...patch,
            source: "manual-reference",
        },
    });
    const changeTarget = (price: string | null) => change({
        targets: [{
                ...(input.targets[0] ?? {
                    id: "target-1", quantity: null, ratio: null
                }), price
            }],
    });
    return (<div className="recall-plan-fields">
      <div className="recall-plan-entry-row">
        <PriceField className="recall-plan-primary-field" label="计划入场" value={input.entry} onChange={entry => change({
          entry
        })}/>
      </div>
      <div className="recall-plan-price-pair recall-plan-pair">
        <PriceField className="recall-plan-price-field" label="初始止损" value={input.initialStop} onChange={initialStop => change({
        initialStop
    })}/>
        <PriceField className="recall-plan-price-field" label="止盈目标" value={input.targets[0]?.price ?? null} onChange={changeTarget}/>
      </div>
      <fieldset className="recall-size-mode">
        <legend>规模方式</legend>
        <div className="recall-size-mode__buttons" role="group" aria-label="规模方式切换">
          {([[
            "quantity", "数量",
          ], [
            "amount", "名义金额",
          ], [
            "ratio", "仓位比例（%）",
          ]] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={input.sizeInputMode === value} onClick={() => onChange(switchRecallSizeMode(input, value))}>{label}</button>)}
        </div>
      </fieldset>
      <div className="recall-plan-size-input">
        <PriceField className="recall-plan-primary-field" label={input.sizeInputMode === "quantity" ? "计划数量" : input.sizeInputMode === "amount" ? "计划名义金额" : "计划仓位比例（%）"} value={input.sizeInputValue} onChange={value => change({
        sizeInputValue: value
    })}/>
      </div>
      <div className="recall-plan-supplementary-row">
        <label className="recall-plan-compact-field">
          <span>方向</span>
          <select aria-label="计划方向" aria-describedby={input.direction === null ? "recall-plan-direction-note" : undefined} value={input.direction ?? ""} onChange={event => change({
            direction: (event.target.value || null) as RecallPlanInput["direction"]
          })}>
            <option value="">待选择</option><option value="long">做多</option><option value="short">做空</option>
          </select>
        </label>
        <label className="recall-plan-compact-field">
          <span>数量单位</span>
          <select aria-label="计划数量单位" value={input.quantityUnit} onChange={event => change({
        quantityUnit: event.target.value as RecallPlanInput["quantityUnit"]
    })}>
            <option value="share">股</option><option value="unit">单位</option>
          </select>
        </label>
        {input.direction === null && <p id="recall-plan-direction-note" className="recall-plan-field-note">选择计划方向后可计算风险与盈亏比。</p>}
      </div>
      <details>
        <summary>币种、价格口径、参考资金与数量步长</summary>
        <div className="recall-plan-pair">
          <label><span>报价币种</span><input aria-label="计划币种" value={input.currency ?? ""} readOnly/></label>
          <label>
            <span>价格口径</span>
            <select aria-label="计划价格口径" value={input.priceBasis ?? ""} onChange={event => change({
          priceBasis: (event.target.value || null) as RecallPlanInput["priceBasis"]
      })}>
              <option value="">待选择</option><option value="raw">原始价格</option><option value="adjusted">复权价格</option>
            </select>
          </label>
        </div>
        <PriceField label="参考资金金额" value={input.capital?.amount ?? null}
          onChange={amount => changeCapital({amount})} />
        <PriceField label="参考资金币种" value={input.capital?.currency ?? null}
          inputMode="text"
          onChange={currency => changeCapital({currency})} />
        <PriceField label="参考资金时点" value={input.capital?.asOf ?? null}
          inputMode="text"
          onChange={asOf => changeCapital({asOf})} />
        <p>来源：{input.capital?.source === "account-snapshot" ? "账户快照" : input.capital ? "手填参考资金" : "未提供"}</p>
        <PriceField label="参考数量步长" value={input.sizing?.quantityStep ?? null}
          onChange={quantityStep => change({
            sizing: {
              quantityStep,
              stepSource: "manual-reference",
              rounding: "floor",
              derivedUnroundedQuantity: null,
              roundingDelta: null,
            },
          })} />
        <p>步长由手工参考提供，非已核验交易所最小单位；按步长向下取整。</p>
        {input.sizing && <p style={{overflowWrap:"anywhere"}}>取整前数量：<RecallDerivedNumber value={input.sizing.derivedUnroundedQuantity} />；舍去数量：<RecallDerivedNumber value={input.sizing.roundingDelta} /></p>}
      </details>
      <dl className="recall-plan-derived-metrics" aria-label="计划派生指标">
        <div><dt>名义金额 / 仓位占比</dt><dd><RecallDerivedNumber value={sizing.notionalAmount} /> {sizing.notionalAmount && input.currency} / {sizing.capitalPercent === null ? validCapitalAmount && !capitalCurrencyMatches ? "币种不同，比例未知" : "未知" : <><RecallDerivedNumber value={sizing.capitalPercent} />%</>}</dd></div>
        <div><dt>初始风险 / 风险占比</dt><dd><RecallDerivedNumber value={calculation.initialRisk.value} />{calculation.initialRisk.value && calculation.initialRisk.currency ? ` ${calculation.initialRisk.currency}` : ""} / {riskPercent === null ? validCapitalAmount && !capitalCurrencyMatches ? "币种不同，比例未知" : "未知" : <><RecallDerivedNumber value={riskPercent} />%</>}</dd></div>
        <div><dt>预期收益 / 风险</dt><dd
          title={calculation.targetReward.value === null
            ? calculation.targetReward.reason ?? undefined
            : `预期收益 ${calculation.targetReward.value}${calculation.targetReward.currency ? ` ${calculation.targetReward.currency}` : ""}`}
          aria-label={calculation.targetReward.value === null
            ? undefined
            : `预期收益 ${calculation.targetReward.value}${calculation.targetReward.currency ? ` ${calculation.targetReward.currency}` : ""}；预期 ${calculation.expectedR.value ?? "未知"}R；收益风险比 ${calculation.expectedR.value ?? "未知"}:1`}
        >{calculation.expectedR.value === null ? "未知" : <><RecallDerivedNumber value={calculation.expectedR.value} suffix="R" /> · <RecallDerivedNumber value={calculation.expectedR.value} suffix=":1" /></>}</dd></div>
      </dl>
      {sizing.reason && <p role="status">{sizing.reason}</p>}
      {sizing.exceedsCapital && <p role="alert">计划超过参考资金；未自动截断。</p>}
    </div>);
}
export function RecallPlanSidebar({ id, input, phase, readOnly, compactReadOnly = false, onChange, onClose, error, knownQuantity, hasSeenFuture, retained, missingReason, showCloseControl = true, children, primaryContent, secondaryContent, hidden }: Props) {
    const calculation = input ? calculateRecallPlan(input) : null;
    const compact = compactReadOnly && readOnly && input;
    const [fullPlanOpen, setFullPlanOpen] = useState(false);
    return (<aside id={id} hidden={hidden} style={hidden ? {display:"none"} : undefined} className="recall-plan-sidebar" aria-label="阶段计划" onKeyDown={event => {
            if (event.key === "Escape") {
                event.stopPropagation();
                onClose();
            }
        }}>
      <header>
        <h2>{phase === "pre-entry" ? "买入前计划" : "原计划"}</h2>
        {showCloseControl && <button type="button" aria-label="关闭计划侧栏" onClick={onClose}><X size={18}/></button>}
      </header>
      <p className="recall-plan-source">
        复盘补记{hasSeenFuture ? " · 已看后续补记" : ""}
        {retained ? " · 原始留存只读" : readOnly && input ? " · 未留存草稿" : ""}
      </p>
      {!input ? <p>{missingReason ?? "原计划未记录"}</p> : compact ? <>
        <CompactPlanSummary input={input} phase={phase}/>
        <details className="recall-plan-detail-group" onToggle={event => setFullPlanOpen(event.currentTarget.open)}><summary>完整原计划</summary>{fullPlanOpen && <PlanSummary input={input}/>}</details>
      </> : readOnly ? <PlanSummary input={input}/> : <RecallPlanFields input={input} onChange={onChange}/>}
      {error && <p className="recall-plan-error" role="alert">{error}；输入已保留。</p>}
      {calculation && !compact && readOnly && (<dl className="recall-plan-metrics">
          <dt>初始风险</dt>
          <dd title={calculation.initialRisk.reason ?? undefined}>
            {calculation.initialRisk.value === null ? "待补充" : <><RecallDerivedNumber value={calculation.initialRisk.value} /> {calculation.initialRisk.currency ?? ""}</>}
          </dd>
          <dt>预期 R</dt>
          <dd title={calculation.expectedR.reason ?? undefined}>
            {calculation.expectedR.value === null ? "待补充" : <RecallDerivedNumber value={calculation.expectedR.value} suffix="R" />}
          </dd>
        </dl>)}
      {calculation?.expectedR.value && !compact && readOnly && <p>收益 : 风险 = <RecallDerivedNumber value={calculation.expectedR.value} /> : 1</p>}
      {phase !== "pre-entry" && !compact && (<section><h3>当前已知事实</h3><p>已揭示持仓：{knownQuantity ?? "待核对"}</p><p>成交事实来自导入记录。</p></section>)}
      {primaryContent}
      {children}
      {secondaryContent && <div className="recall-plan-secondary-content">{secondaryContent}</div>}
      {children === undefined && primaryContent === undefined && phase === "post-review" && <section><h3>执行评价</h3><p>尚未记录执行评价。</p></section>}
      {retained && input && <p>原计划已冻结；后续调整需另建修订。</p>}
      {readOnly && input && !retained && <p>未留存草稿；返回买入前判断继续编辑。</p>}
      {input?.priceBasis === "raw" && (input.entry || input.initialStop || input.targets[0]?.price) && <p>计划价格超出当前视野时，可使用图上的“显示计划价格”按钮查看；计划数值仍保留在此栏。</p>}
      {input && input.priceBasis !== "raw" && <p>价格口径尚未与原始行情匹配，计划线暂不显示。</p>}
    </aside>);
}
