"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  BookOpenCheck,
  Database,
  LayoutDashboard,
  Menu,
  Settings2,
  Workflow,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { RunningPrototype } from "./running-prototype";
import type { RunningDraft } from "./running-prototype";
import type { RuntimeProgress, SourceExposure } from "./running-model";
import "./creation-prototype.css";

type CreationStage = "list" | "history" | "strategies" | "preview" | "confirm" | "running";
type Scenario = RunningDraft["scenario"];
export type StrategyId = "ema" | "quality";
type Draft = RunningDraft & { partialConfirmed: boolean };
type HistoryPatch = Partial<Pick<Draft, "date" | "collection" | "capital" | "horizon">>;
type EditableStage = Exclude<CreationStage, "list" | "running">;
type ExperimentSession = {
  id: string;
  name: string;
  draft: Draft;
  created: boolean;
  hasRun: boolean;
  runStatus: string;
  progress: RuntimeProgress | null;
  openResultsRequest: number;
  sourceExperimentId: string | null;
  sourceExposure: SourceExposure | null;
  resumeStage: EditableStage;
};
type RuntimeHandlers = {
  onList: () => void;
  onReady: () => void;
  onStatus: (status: string) => void;
  onProgress: (progress: RuntimeProgress) => void;
  onDerive: (progress: RuntimeProgress) => void;
};

const DEFAULT_DATE = "2024-06-14T16:00";
const HORIZONS = ["1 周", "1 个月", "3 个月", "半年", "1 年"] as const;
const STEP_KEYS: readonly Exclude<CreationStage, "list" | "running">[] = [
  "history",
  "strategies",
  "preview",
  "confirm",
];
const STEP_LABELS: Record<(typeof STEP_KEYS)[number], string> = {
  history: "设置起点",
  strategies: "选择策略",
  preview: "预览组合",
  confirm: "确认并进入",
};
const PRESETS: Record<StrategyId, readonly string[]> = {
  ema: ["随策略 · 每周", "初始持有 · 不调仓"],
  quality: ["随策略 · 每月", "初始持有 · 不调仓"],
};
const STRATEGIES = [
  {
    id: "ema" as const,
    name: "高市值 · 周线回撤 EMA20",
    version: "v1.4",
    color: "#61a8ff",
    cashTarget: 10,
    use: "筛选高流动性大市值股票，在周线趋势回撤时建立组合。",
    summary: [
      "市值严格大于 ¥200 亿元",
      "日成交额严格大于 ¥2,000 万元",
      "完整周线收盘高于上升中的 EMA20，回撤位于 EMA20 ±2%",
    ],
    dataNeeded: "历史市值、真实成交额、完整周线行情",
    detail:
      "完整条件：市值 > ¥200 亿元；日成交额 > ¥2,000 万元；收盘 > EMA20；EMA20 高于上一完整周的 EMA20；收盘相对 EMA20 的偏差在 ±2% 内。阈值为严格大于。演示预设按完整周检查；每周执行模板不代表真实交易日历。",
  },
  {
    id: "quality" as const,
    name: "低波动质量",
    version: "v2.1",
    color: "#58c8a4",
    cashTarget: 20,
    use: "按当时已经披露的财报质量与历史波动率分配独立组合。",
    summary: [
      "质量分位前 20%",
      "波动率处于样本最低 30%",
      "财报只使用 T0 前首次公开的内容",
    ],
    dataNeeded: "财报首次披露时间、波动率、历史行情",
    detail:
      "完整条件：质量分位处于前 20%，且历史波动率位于样本最低 30%。财务字段按首次披露时间截断到 T0；估值与波动率只用当时可知行情。演示预设按月检查；月底执行模板不代表真实交易日历。",
  },
] as const;

const CANDIDATE_GROUPS = [
  { id: "selected", label: "入选" },
  { id: "rule-failed", label: "规则不符" },
  { id: "insufficient", label: "数据不足" },
] as const;
type CandidateGroupId = (typeof CANDIDATE_GROUPS)[number]["id"];
type Candidate = {
  id: string;
  symbol: string;
  group: CandidateGroupId;
  reason: string;
  ruleValues: string;
  knownAt: string;
};

function partialCoverageForStrategy(strategy: StrategyId): string {
  return strategy === "ema"
    ? "部分覆盖：D 缺历史成交额，未纳入 EMA20 评估；C 缺财报披露时间不是 EMA20 依赖，仍按本包字段评估。"
    : "部分覆盖：C 缺财报首次披露时间，未纳入质量包评估；D 缺历史成交额不是质量包依赖，仍按本包字段评估。";
}

function partialCoverageSummary(selected: readonly StrategyId[]): string {
  const usesEma = selected.includes("ema");
  const usesQuality = selected.includes("quality");
  if (usesEma && usesQuality) {
    return "C 缺财报首次披露时间，仅低波动质量包无法评估 C；D 缺历史成交额，仅 EMA20 包无法评估 D。另一包仍按自身依赖评估，缺失项不计作规则不符。";
  }
  if (usesEma) {
    return "本次 EMA20 包：D 缺历史成交额，未纳入评估；C 缺财报披露时间与此包无关，仍按 EMA20 规则评估。缺失项不计作规则不符。";
  }
  if (usesQuality) {
    return "本次低波动质量包：C 缺财报首次披露时间，未纳入评估；D 缺历史成交额与此包无关，仍按质量规则评估。缺失项不计作规则不符。";
  }
  return "C 缺财报首次披露时间（仅质量包无法评估）；D 缺历史成交额（仅 EMA20 包无法评估）。缺失项不计作规则不符。";
}

function makeDefaultDraft(): Draft {
  return {
    date: DEFAULT_DATE,
    collection: "review",
    capital: "100000",
    horizon: "1 周",
    blind: true,
    scenario: "complete",
    selected: ["ema"],
    presets: {
      ema: PRESETS.ema[0],
      quality: PRESETS.quality[0],
    },
    partialConfirmed: false,
  };
}

function makeExperimentSession({
  id,
  name,
  draft,
  sourceExperimentId = null,
  sourceExposure = null,
}: {
  id: string;
  name: string;
  draft: Draft;
  sourceExperimentId?: string | null;
  sourceExposure?: SourceExposure | null;
}): ExperimentSession {
  return {
    id,
    name,
    draft,
    created: false,
    hasRun: false,
    runStatus: "草稿",
    progress: null,
    openResultsRequest: 0,
    sourceExperimentId,
    sourceExposure,
    resumeStage: "history",
  };
}

function cloneDraftForDerivation(draft: Draft): Draft {
  return {
    ...draft,
    selected: [...draft.selected],
    presets: { ...draft.presets },
    partialConfirmed: false,
  };
}

function sameProgress(left: RuntimeProgress | null, right: RuntimeProgress): boolean {
  return Boolean(
    left &&
      left.status === right.status &&
      left.knownDate === right.knownDate &&
      left.viewDate === right.viewDate &&
      left.completed === right.completed &&
      left.exposure?.date === right.exposure?.date &&
      left.exposure?.source === right.exposure?.source &&
      left.exposure?.time === right.exposure?.time,
  );
}

function latestExposureBoundary(
  source: ExperimentSession,
  progress: RuntimeProgress,
): { knownDate: string; time?: string } {
  const candidates = [
    { date: source.sourceExposure?.knownDate, time: source.sourceExposure?.time },
    { date: progress.exposure?.date, time: progress.exposure?.time },
    { date: progress.knownDate },
    { date: progress.viewDate },
    { date: source.draft.date.slice(0, 10) },
  ].filter(
    (candidate): candidate is { date: string; time?: string } =>
      typeof candidate.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(candidate.date),
  );
  candidates.sort((left, right) => right.date.localeCompare(left.date));
  const latest = candidates[0] ?? { date: source.draft.date.slice(0, 10) };
  const boundaryTime = candidates.find(
    (candidate) => candidate.date === latest.date && candidate.time,
  )?.time;
  return { knownDate: latest.date, ...(boundaryTime ? { time: boundaryTime } : {}) };
}

type ShanghaiDate = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
  instant: Date;
};

function parseShanghai(value: string): ShanghaiDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (hour > 23 || minute > 59) return null;
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    return null;
  }
  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday: calendarDate.getUTCDay(),
    instant: new Date(calendarDate.getTime() + (hour * 60 + minute - 480) * 60_000),
  };
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function previousWeekday(value: Date): Date {
  const result = new Date(value);
  while (result.getUTCDay() === 0 || result.getUTCDay() === 6) {
    result.setUTCDate(result.getUTCDate() - 1);
  }
  return result;
}

function lastCompleteWeek(value: Date): Date {
  const result = new Date(value);
  while (result.getUTCDay() !== 5) result.setUTCDate(result.getUTCDate() - 1);
  return result;
}

type HistoryStatus = {
  tone: "ok" | "warn" | "bad";
  title: string;
  detail: string;
  daily?: string;
  weekly?: string;
  canContinue: boolean;
};

function getHistoryStatus(value: string): HistoryStatus {
  const parsed = parseShanghai(value);
  if (!parsed) {
    return {
      tone: "bad",
      title: "请输入有效的历史日期和时间",
      detail: "请按 Asia/Shanghai 时区输入 YYYY-MM-DD HH:mm。",
      canContinue: false,
    };
  }
  if (parsed.instant.getTime() > Date.now()) {
    return {
      tone: "bad",
      title: "未来时点不能作为历史起点",
      detail: "起点必须早于当前时间；改动后重新检查可用数据截止。",
      canContinue: false,
    };
  }

  const isWeekend = parsed.weekday === 0 || parsed.weekday === 6;
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  const dailyCutoff = isWeekend
    ? previousWeekday(date)
    : parsed.hour < 15
      ? previousWeekday(new Date(date.getTime() - 86_400_000))
      : date;
  const weeklyCutoff = lastCompleteWeek(dailyCutoff);
  const daily = isoDate(dailyCutoff);
  const weekly = isoDate(weeklyCutoff);
  const dataLimit =
    "可知截止：日线 ≤ " +
    daily +
    "；周线 ≤ " +
    weekly +
    "。财报只使用 T0 前首次披露内容。";

  if (isWeekend) {
    return {
      tone: "warn",
      title: "休市日；保留你选择的起点",
      detail:
        dataLimit +
        "演示仅识别周末，节假日交易日历未接入；首次成交从 T0 后下一可交易日开盘开始。",
      daily,
      weekly,
      canContinue: true,
    };
  }
  if (parsed.hour < 15) {
    return {
      tone: "warn",
      title: "盘中时点；当日收盘数据尚不可知",
      detail:
        dataLimit +
        "不读取 T0 之后的当日 bar；首次成交从 T0 后下一可交易日开盘开始。",
      daily,
      weekly,
      canContinue: true,
    };
  }
  return {
    tone: "ok",
    title: "起点可用于合成预览",
    detail:
      dataLimit +
      "演示不含节假日交易日历，不能据此推断真实市场覆盖。",
    daily,
    weekly,
    canContinue: true,
  };
}

function nominalEnd(value: string, horizon: string): string {
  const parsed = parseShanghai(value);
  if (!parsed) return "待定";
  if (horizon === "1 周") {
    return isoDate(new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + 7)));
  }
  const monthCount = horizon === "1 个月" ? 1 : horizon === "3 个月" ? 3 : horizon === "半年" ? 6 : 12;
  const monthStart = new Date(Date.UTC(parsed.year, parsed.month - 1 + monthCount, 1));
  const finalDay = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return isoDate(
    new Date(
      Date.UTC(
        monthStart.getUTCFullYear(),
        monthStart.getUTCMonth(),
        Math.min(parsed.day, finalDay),
      ),
    ),
  );
}

function isValidCapital(value: string): boolean {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function strategyById(id: StrategyId) {
  return STRATEGIES.find((strategy) => strategy.id === id)!;
}

function selectedStrategyIds(draft: Draft): StrategyId[] {
  return draft.selected.filter((id) => STRATEGIES.some((strategy) => strategy.id === id));
}

function AppNav() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  return (
    <aside
      className={"app-header app-sidebar creation-sidebar" + (open ? " mobile-nav-open" : "")}
      aria-label="主导航"
    >
      <div className="brand">
        <div className="brand-mark">
          <BookOpenCheck size={19} />
        </div>
        <div>
          <strong>TradeReview</strong>
          <span>历史交易复盘</span>
        </div>
      </div>
      <button
        type="button"
        className="mobile-nav-trigger"
        aria-label="打开导航"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Menu size={17} />
        <span>导航</span>
      </button>
      <nav className="app-nav" aria-label="主导航">
        <button type="button" onClick={() => router.push("/")}>
          <LayoutDashboard size={16} />
          我的交易室
        </button>
        <button type="button" disabled title="策略原型不支持交易库">
          <BookOpenCheck size={16} />
          交易库
        </button>
        <button type="button" disabled title="策略原型不支持分析">
          <BarChart3 size={16} />
          分析
        </button>
        <button type="button" disabled title="策略原型不支持数据">
          <Database size={16} />
          数据
        </button>
        <button
          type="button"
          className="active"
          aria-current="page"
          title="当前策略创建原型"
        >
          <Workflow size={16} />
          <span>策略</span>
          <small>原型</small>
        </button>
      </nav>
      <div className="app-nav-secondary">
        <button type="button" disabled title="策略原型不支持设置">
          <Settings2 size={16} />
          设置
        </button>
      </div>
      {open && (
        <button
          type="button"
          className="mobile-navigation-backdrop"
          aria-label="关闭导航"
          onClick={() => setOpen(false)}
        />
      )}
    </aside>
  );
}

function StatusNote({ status }: { status: HistoryStatus }) {
  return (
    <div className={"creation-status " + status.tone} role="status">
      <span aria-hidden="true">
        {status.tone === "ok" ? "✓" : status.tone === "bad" ? "!" : "i"}
      </span>
      <div>
        <b>{status.title}</b>
        <small>{status.detail}</small>
      </div>
    </div>
  );
}

function PrototypeTag() {
  return (
    <span className="prototype-tag">
      交互原型 <i>·</i> 合成数据 <i>·</i> 刷新重置
    </span>
  );
}

function PageHeader({
  stage,
  experimentName,
  onList,
  onCancelDerivation,
}: {
  stage: CreationStage;
  experimentName?: string;
  onList: () => void;
  onCancelDerivation?: () => void;
}) {
  const pageLabel = stage === "list" ? "我的实验" : experimentName ?? "新建实验";
  const currentLabel =
    stage === "list"
      ? "实验列表"
      : stage === "running"
        ? "回测工作台"
        : STEP_LABELS[stage];
  return (
    <div className="creation-page-top">
      <div className="creation-title-group">
        <div className="creation-breadcrumb">
          策略实验 <span>/</span> {pageLabel} <span>/</span> <b>{currentLabel}</b>
        </div>
        {stage !== "list" && stage !== "running" && (
          <div className="creation-page-actions">
            <button
              type="button"
              className="creation-secondary creation-list-back"
              onClick={onList}
            >
              ← 返回实验列表
            </button>
            {onCancelDerivation && (
              <button
                type="button"
                className="creation-secondary creation-list-back"
                onClick={onCancelDerivation}
                title="删除这个派生草稿并返回来源实验；来源运行保持不变"
              >
                取消派生并返回来源
              </button>
            )}
          </div>
        )}
      </div>
      <PrototypeTag />
    </div>
  );
}

function SourceExposureNotice({ exposure }: { exposure: SourceExposure }) {
  return (
    <div className="source-exposure-note" role="status">
      <b>来源：{exposure.experimentName}</b>
      <span>
        来源链已知数据边界至 {exposure.knownDate}
        {exposure.time ? " · " + exposure.time : ""}。本实验仍从自己的 T0 开始，不继承来源成交或持仓。
      </span>
    </div>
  );
}

function StepProgress({
  stage,
  locked,
  onBack,
}: {
  stage: Exclude<CreationStage, "list" | "running">;
  locked: boolean;
  onBack: (stage: Exclude<CreationStage, "list" | "running">) => void;
}) {
  const currentIndex = STEP_KEYS.indexOf(stage);
  return (
    <nav className="creation-progress" aria-label="创建步骤">
      {STEP_KEYS.map((step, index) => {
        const current = step === stage;
        const done = index < currentIndex;
        const disabled = locked || index > currentIndex;
        return (
          <button
            type="button"
            key={step}
            className={current ? "current" : done ? "done" : ""}
            aria-current={current ? "step" : undefined}
            aria-label={
              String(index + 1) +
              " " +
              STEP_LABELS[step] +
              (done ? "，已完成，可返回" : current ? "，当前步骤" : "，尚未开始")
            }
            disabled={disabled}
            onClick={() => onBack(step)}
          >
            <i aria-hidden="true">{done ? "✓" : index + 1}</i>
            {STEP_LABELS[step]}
          </button>
        );
      })}
    </nav>
  );
}

function HistoryStep({
  draft,
  onUpdate,
  onNext,
}: {
  draft: Draft;
  onUpdate: (patch: HistoryPatch) => void;
  onNext: () => void;
}) {
  const status = getHistoryStatus(draft.date);
  const capitalValid = isValidCapital(draft.capital);
  const canContinue = status.canContinue && capitalValid;
  return (
    <section className="creation-card setup-card history-card">
      <div className="creation-kicker">01 / 设置起点</div>
      <div className="card-heading">
        <div>
          <h1>先固定当时能看到的世界</h1>
          <p>起始时点确定数据边界；未来行情与收益只在运行中逐日揭示。</p>
        </div>
        <span className="draft-pill">未运行草稿</span>
      </div>
      <div className="history-grid">
        <label className="field wide">
          历史起点（Asia/Shanghai）
          <span>保留你输入的 T0，不自动改成最近可用日期</span>
          <input
            aria-label="历史起点，Asia/Shanghai"
            type="datetime-local"
            value={draft.date}
            onChange={(event) => onUpdate({ date: event.target.value })}
          />
        </label>
        <label className="field">
          标的集合
          <span>来源与样本范围</span>
          <select
            aria-label="标的集合"
            value={draft.collection}
            onChange={(event) =>
              onUpdate({ collection: event.target.value as Draft["collection"] })
            }
          >
            <option value="review">复盘标的集合 · 126 个</option>
            <option value="watchlist">自选示例 · 18 个</option>
          </select>
        </label>
        <label className="field">
          每个组合独立本金
          <span>金额必须大于 ¥0</span>
          <div className="money-input">
            <i aria-hidden="true">¥</i>
            <input
              aria-label="每个组合独立本金"
              type="number"
              min="0.01"
              step="0.01"
              value={draft.capital}
              aria-invalid={!capitalValid}
              onChange={(event) => onUpdate({ capital: event.target.value })}
            />
          </div>
        </label>
        <label className="field">
          观察期限
          <span>名义结束日，不代表交易日历</span>
          <select
            aria-label="观察期限"
            value={draft.horizon}
            onChange={(event) => onUpdate({ horizon: event.target.value })}
          >
            {HORIZONS.map((horizon) => (
              <option key={horizon}>{horizon}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="blind-row">
        <div>
          <b>逐日揭示未来行情</b>
          <small>
            固定逐日推进；未来数据不会在创建时展示。T0 后下一可交易日开盘才会发生首次模拟成交。
          </small>
        </div>
        <span className="fixed-reveal">固定开启</span>
      </div>

      {!capitalValid && (
        <div className="field-error" role="alert">
          本金必须是有限的正数；每个组合会分别使用这笔本金。
        </div>
      )}
      <StatusNote status={status} />
      <div className="dataset-note">
        <b>数据来源与已知限制</b>
        <span>
          {draft.collection === "review"
            ? "复盘示例集合 · 126 个标的"
            : "自选示例集合 · 18 个标的"}
          {" · 合成行情 · "}
          不是全市场历史证券池；样本数不代表已筛查数量。
        </span>
      </div>
      <div className="step-actions history-foot">
        <span className="subtle">
          起点状态会显示完整日线与周线截止；盘中或休市时不会借用未来 bar。
        </span>
        <button
          type="button"
          className="creation-primary"
          disabled={!canContinue}
          onClick={onNext}
        >
          继续选择策略 <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}

function StrategyStep({
  draft,
  onToggle,
  onPreset,
  onConfirmPartial,
  onBack,
  onNext,
}: {
  draft: Draft;
  onToggle: (id: StrategyId) => void;
  onPreset: (id: StrategyId, value: string) => void;
  onConfirmPartial: (value: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const partial = draft.scenario === "partial";
  const canContinue = draft.selected.length > 0 && (!partial || draft.partialConfirmed);
  return (
    <section className="creation-card package-card strategy-card">
      <div className="creation-kicker">02 / 选择策略</div>
      <div className="card-heading">
        <div>
          <h1>选择完整策略包</h1>
          <p>每个已选策略独立生成一个组合；勾选框决定选择，规则详情只用于阅读。</p>
        </div>
        <span className="step-count">{draft.selected.length} 个已选</span>
      </div>
      {draft.scenario === "missing" && (
        <div className="missing-banner" role="status">
          <b>当前演示场景缺少历史市值</b>
          <span>EMA20 依赖此字段，暂不可评估；低波动质量包仍可选择。</span>
        </div>
      )}
      <div className="strategy-list">
        {STRATEGIES.map((strategy) => {
          const missing = draft.scenario === "missing" && strategy.id === "ema";
          const checked = draft.selected.includes(strategy.id);
          return (
            <article
              className={
                "strategy-option" +
                (checked ? " selected" : "") +
                (missing ? " disabled" : "")
              }
              key={strategy.id}
            >
              <label className="strategy-select" htmlFor={"strategy-" + strategy.id}>
                <input
                  id={"strategy-" + strategy.id}
                  type="checkbox"
                  checked={checked}
                  disabled={missing}
                  onChange={() => onToggle(strategy.id)}
                />
                <span className="strategy-icon" style={{ background: strategy.color }}>
                  {strategy.id === "ema" ? "↗" : "◌"}
                </span>
                <b className="strategy-option-name">{strategy.name}</b>
                <span className="checkmark">
                  {missing ? "不可选" : checked ? "✓ 已选" : "可选择"}
                </span>
              </label>
              <div className="strategy-main">
                <small>
                  {strategy.version} · {strategy.use}
                </small>
                <small className="strategy-target">
                  {draft.scenario === "empty"
                    ? "当前场景无候选：目标现金 100%"
                    : "候选可评估时目标：持仓 " +
                      (100 - strategy.cashTarget) +
                      "% / 现金 " +
                      strategy.cashTarget +
                      "%"}
                </small>
                {strategy.summary.map((item) => (
                  <em key={item}>规则：{item}</em>
                ))}
                <small className="strategy-data">
                  需要数据：{strategy.dataNeeded}
                </small>
                {partial && (
                  <small className="strategy-partial-note">
                    {partialCoverageForStrategy(strategy.id)}
                  </small>
                )}
              </div>
              <label className="preset-field">
                调仓预设
                <select
                  aria-label={strategy.name + " 调仓预设"}
                  disabled={!checked || missing}
                  value={draft.presets[strategy.id]}
                  onChange={(event) => onPreset(strategy.id, event.target.value)}
                >
                  {PRESETS[strategy.id].map((preset) => (
                    <option key={preset}>{preset}</option>
                  ))}
                </select>
                <small>{checked ? "只对已选组合生效" : "未选策略只读默认值"}</small>
              </label>
              <StrategyRuleDisclosure strategy={strategy} />
              {missing && (
                <p className="strategy-reason">
                  当前场景缺少历史市值，EMA20 包不可评估；这不是规则筛选失败。
                </p>
              )}
            </article>
          );
        })}
      </div>
      {draft.selected.length === 0 && (
        <div className="empty-hint" role="status">
          <b>还没有选择策略包</b>
          <span>请勾选至少一个完整策略包，才能预览或创建组合。</span>
        </div>
      )}
      {partial && (
        <>
          <div className="coverage-banner">
            <b>部分覆盖需要确认</b>
            <span>{partialCoverageSummary(draft.selected)}</span>
          </div>
          <label className="confirm-row">
            <input
              type="checkbox"
              checked={draft.partialConfirmed}
              onChange={(event) => onConfirmPartial(event.target.checked)}
            />
            <span>
              我确认仅按可评估样本预览；日期、集合或演示场景改变后需重新确认。
            </span>
          </label>
        </>
      )}
      {draft.scenario === "empty" && (
        <div className="empty-hint">
          <b>当前演示场景没有候选标的</b>
          <span>候选为 0 时仍可继续，预览和首次进入会显示目标现金 100%、实际持仓 0。</span>
        </div>
      )}
      <div className="step-actions">
        <button type="button" className="creation-secondary" onClick={onBack}>
          ← 上一步：设置起点
        </button>
        <button
          type="button"
          className="creation-primary"
          disabled={!canContinue}
          onClick={onNext}
        >
          生成组合预览 <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}

function StrategyRuleDisclosure({
  strategy,
}: {
  strategy: (typeof STRATEGIES)[number];
}) {
  const [expanded, setExpanded] = useState(false);
  const triggerId = "strategy-detail-trigger-" + strategy.id;
  const panelId = "strategy-detail-panel-" + strategy.id;

  return (
    <div className="strategy-detail">
      <button
        type="button"
        id={triggerId}
        className="disclosure-trigger"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="disclosure-chevron" aria-hidden="true">
          {expanded ? "▾" : "▸"}
        </span>
        查看完整规则、版本与数据依赖
      </button>
      <div
        id={panelId}
        className="disclosure-panel"
        role="region"
        aria-labelledby={triggerId}
        hidden={!expanded}
      >
        <p>{strategy.detail}</p>
        <p>
          包版本：{strategy.version}。必需数据：{strategy.dataNeeded}。
          规则只使用起点边界内的字段。
        </p>
      </div>
    </div>
  );
}

function CandidateEvidence({
  strategy,
  candidate,
}: {
  strategy: StrategyId;
  candidate: Candidate;
}) {
  const [expanded, setExpanded] = useState(false);
  const triggerId = "candidate-evidence-trigger-" + strategy + "-" + candidate.id;
  const panelId = "candidate-evidence-panel-" + strategy + "-" + candidate.id;

  return (
    <div className="candidate-evidence">
      <button
        type="button"
        id={triggerId}
        className="disclosure-trigger"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="disclosure-chevron" aria-hidden="true">
          {expanded ? "▾" : "▸"}
        </span>
        展开规则值与数据可知时间
      </button>
      <div
        id={panelId}
        className="disclosure-panel"
        role="region"
        aria-labelledby={triggerId}
        hidden={!expanded}
      >
        <p>{candidate.ruleValues}</p>
        <small>{candidate.knownAt}</small>
      </div>
    </div>
  );
}

function candidatesFor(
  strategy: StrategyId,
  scenario: Scenario,
  status: HistoryStatus,
): Candidate[] {
  if (scenario === "empty") return [];
  const knownAt =
    strategy === "ema"
      ? "EMA20、前周 EMA20 与收盘取截止 ≤ " +
        (status.weekly ?? "待检查") +
        " 的完整周线；所用周线不晚于 T0。"
      : "波动率样本仅用日线截止 ≤ " +
        (status.daily ?? "待检查") +
        " 的行情；财报按首次披露时间截断到 T0。";
  const entries: Candidate[] = [
    {
      id: "A",
      symbol: "合成股票 A",
      group: "selected",
      reason:
        strategy === "ema"
          ? "市值与成交额达标；EMA20 上升，周线收盘在回撤区间内"
          : "质量分位 8%；波动率样本分位 18%，处于最低 30%",
      ruleValues:
        strategy === "ema"
          ? "市值 ¥2,140 亿（>¥200 亿）；日成交额 ¥4,280 万（>¥2,000 万）；前周 EMA20 ¥111.80，本周 ¥112.40（上升）；收盘 ¥113.10，较 EMA20 +0.62%（±2% 内）。"
          : "质量分位 8%（需前 20%）；年化历史波动率 18.4%，样本由低到高分位 18%（需最低 30%）；合成财报首次披露早于 T0。",
      knownAt,
    },
    {
      id: "B",
      symbol: "合成股票 B",
      group: "selected",
      reason:
        strategy === "ema"
          ? "市值与成交额达标；EMA20 上升，周线收盘在回撤区间内"
          : "质量分位 12%；波动率样本分位 24%，处于最低 30%",
      ruleValues:
        strategy === "ema"
          ? "市值 ¥3,650 亿（>¥200 亿）；日成交额 ¥3,800 万（>¥2,000 万）；前周 EMA20 ¥77.60，本周 ¥78.20（上升）；收盘 ¥79.04，较 EMA20 +1.07%（±2% 内）。"
          : "质量分位 12%（需前 20%）；年化历史波动率 22.1%，样本由低到高分位 24%（需最低 30%）；合成财报首次披露早于 T0。",
      knownAt,
    },
    {
      id: "E",
      symbol: "合成股票 E",
      group: "rule-failed",
      reason:
        strategy === "ema"
          ? "市值 ¥150 亿，低于严格阈值 ¥200 亿"
          : "质量分位 68%，不在前 20%",
      ruleValues:
        strategy === "ema"
          ? "市值 ¥150 亿（需严格大于 ¥200 亿）；该项不达标，规则不符。"
          : "质量分位 68%（需前 20%）；该项不达标，规则不符。",
      knownAt,
    },
  ];
  if (scenario === "partial") {
    if (strategy === "ema") {
      entries.push(
        {
          id: "C",
          symbol: "合成股票 C",
          group: "selected",
          reason: "财报披露字段缺失不影响 EMA20；本包所需字段均通过",
          ruleValues:
            "财报首次披露时间缺失（EMA20 不依赖此字段）；市值 ¥1,820 亿（>¥200 亿）；日成交额 ¥2,480 万（>¥2,000 万）；前周 EMA20 ¥50.90，本周 ¥51.20（上升）；收盘 ¥51.71，较 EMA20 +1.00%（±2% 内）。",
          knownAt,
        },
        {
          id: "D",
          symbol: "合成股票 D",
          group: "insufficient",
          reason: "缺少历史成交额，无法核对 EMA20 包的流动性条件",
          ruleValues:
            "EMA20 包要求日成交额严格大于 ¥2,000 万；合成样本未提供历史成交额，无法计算该条件。",
          knownAt: "历史成交额值缺失，未纳入 EMA20 评估。",
        },
      );
    } else {
      entries.push(
        {
          id: "C",
          symbol: "合成股票 C",
          group: "insufficient",
          reason: "缺少财报首次披露时间，无法确认质量字段在 T0 是否可用",
          ruleValues:
            "质量包依赖按首次披露时间截断的财务字段；披露时间缺失，无法确认 T0 时可用性，因此不计算质量分位。",
          knownAt:
            "首次披露时间缺失；无法证明该财报在 T0 前可知，未纳入质量包评估。",
        },
        {
          id: "D",
          symbol: "合成股票 D",
          group: "selected",
          reason: "成交额缺失不影响质量包；质量分位、波动率与披露边界均通过",
          ruleValues:
            "历史成交额缺失（质量包不依赖此字段）；质量分位 15%（需前 20%）；年化历史波动率 24.6%，样本由低到高分位 29%（需最低 30%）；合成财报首次披露早于 T0。",
          knownAt,
        },
      );
    }
  }
  return entries;
}

function CandidatePanel({
  strategy,
  draft,
  status,
  candidates,
  capital,
}: {
  strategy: StrategyId;
  draft: Draft;
  status: HistoryStatus;
  candidates: Candidate[];
  capital: number;
}) {
  const [group, setGroup] = useState<CandidateGroupId>("selected");
  const groupRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const strategyInfo = strategyById(strategy);
  const eligibleCount = candidates.filter((item) => item.group === "selected").length;
  const totalWeight = eligibleCount > 0 && draft.scenario !== "empty" ? 100 - strategyInfo.cashTarget : 0;
  const shown = candidates.filter((item) => item.group === group);

  return (
    <section className="candidate-panel" aria-label="候选与规则证据">
      <div className="panel-title">
        <b>演示样本覆盖 · {candidates.length} 条</b>
        <span>{draft.scenario === "partial" ? "部分覆盖" : "样本演示"}</span>
      </div>
      <div className="candidate-groups" role="tablist" aria-label="候选结果分组">
        {CANDIDATE_GROUPS.map((item) => {
          const index = CANDIDATE_GROUPS.findIndex((candidate) => candidate.id === item.id);
          const count = candidates.filter((candidate) => candidate.group === item.id).length;
          return (
            <button
              type="button"
              key={item.id}
              id={"candidate-group-" + item.id}
              role="tab"
              className={group === item.id ? "active" : ""}
              aria-selected={group === item.id}
              aria-controls="candidate-results-panel"
              tabIndex={group === item.id ? 0 : -1}
              ref={(element) => {
                groupRefs.current[index] = element;
              }}
              onKeyDown={(event) => {
                let nextIndex: number | null = null;
                if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                  nextIndex = (index + 1) % CANDIDATE_GROUPS.length;
                } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                  nextIndex = (index + CANDIDATE_GROUPS.length - 1) % CANDIDATE_GROUPS.length;
                } else if (event.key === "Home") {
                  nextIndex = 0;
                } else if (event.key === "End") {
                  nextIndex = CANDIDATE_GROUPS.length - 1;
                }
                if (nextIndex !== null) {
                  event.preventDefault();
                  const next = CANDIDATE_GROUPS[nextIndex];
                  setGroup(next.id);
                  groupRefs.current[nextIndex]?.focus();
                }
              }}
              onClick={() => setGroup(item.id)}
            >
              {item.label} <b>{count}</b>
            </button>
          );
        })}
      </div>
      <div
        className="candidate-list"
        id="candidate-results-panel"
        role="tabpanel"
        aria-labelledby={"candidate-group-" + group}
        tabIndex={0}
      >
        {shown.length > 0 ? (
          shown.map((candidate, index) => {
            const amount =
              eligibleCount > 0 ? (capital * totalWeight) / 100 / eligibleCount : 0;
            return (
              <article className="candidate-row" key={candidate.id}>
                <span
                  className={"candidate-dot" + (index === 1 ? " green" : "")}
                  aria-hidden="true"
                />
                <div className="candidate-copy">
                  <b>{candidate.symbol}</b>
                  <small>{candidate.reason}</small>
                  <CandidateEvidence strategy={strategy} candidate={candidate} />
                </div>
                {candidate.group === "selected" ? (
                  <strong>
                    每只 {eligibleCount > 0 ? (totalWeight / eligibleCount).toFixed(1) : "0.0"}%
                    {" · "}
                    ¥{formatMoney(amount)}
                  </strong>
                ) : (
                  <em className="candidate-status">
                    {candidate.group === "rule-failed" ? "规则不符" : "数据不足"}
                  </em>
                )}
              </article>
            );
          })
        ) : (
          <div className="candidate-empty">
            {draft.scenario === "empty"
              ? "本场景三个分组均为 0；仍可创建全现金组合。"
              : group === "insufficient"
                ? "当前样本没有数据不足项；0 不代表全集合都已检查。"
                : "当前分组没有演示样本。"}
          </div>
        )}
      </div>
      <div className="sample-disclosure">
        计数只覆盖本页合成演示样本，不代表 126 / 18 个集合已完整筛查。
        {status.daily ? " 数据边界按当前起点计算。" : ""}
      </div>
    </section>
  );
}

function PortfolioPanel({
  strategy,
  candidates,
  capital,
}: {
  strategy: StrategyId;
  candidates: Candidate[];
  capital: number;
}) {
  const strategyInfo = strategyById(strategy);
  const count = candidates.filter((item) => item.group === "selected").length;
  const targetWeight = count > 0 ? 100 - strategyInfo.cashTarget : 0;
  const targetCash = 100 - targetWeight;
  const targetStockAmount = (capital * targetWeight) / 100;
  const targetCashAmount = (capital * targetCash) / 100;
  return (
    <section className="weight-panel" aria-label="目标与实际配置">
      <div className="panel-title">
        <b>目标与实际</b>
        <span>独立本金 ¥{formatMoney(capital)}</span>
      </div>
      <div
        className="weight-bar"
        role="img"
        aria-label={"目标持仓 " + targetWeight + "%，目标现金 " + targetCash + "%"}
      >
        <i style={{ width: targetWeight + "%" }} />
        <i style={{ width: targetCash + "%" }} />
      </div>
      <div className="weight-line">
        <span>目标持仓</span>
        <b>{targetWeight}% · ¥{formatMoney(targetStockAmount)}</b>
      </div>
      <div className="weight-line">
        <span>目标现金</span>
        <b>{targetCash}% · ¥{formatMoney(targetCashAmount)}</b>
      </div>
      <div className="actual-allocation">
        <b>当前实际（T0 尚无成交）</b>
        <div>
          <span>持仓</span>
          <strong>0% · ¥0.00</strong>
        </div>
        <div>
          <span>现金</span>
          <strong>100% · ¥{formatMoney(capital)}</strong>
        </div>
      </div>
      <div className="weight-foot">
        首次执行：T0 后下一可交易日开盘。此处是目标计划；实际持仓仍为 0。
      </div>
    </section>
  );
}

function PreviewStep({
  draft,
  onBack,
  onEditStart,
  onConfirm,
}: {
  draft: Draft;
  onBack: () => void;
  onEditStart: () => void;
  onConfirm: () => void;
}) {
  const status = useMemo(() => getHistoryStatus(draft.date), [draft.date]);
  const strategies = selectedStrategyIds(draft);
  const [activeId, setActiveId] = useState<StrategyId>(strategies[0] ?? "ema");
  const portfolioTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeStrategy = strategies.includes(activeId) ? activeId : strategies[0] ?? "ema";
  const activeName = strategyById(activeStrategy).name;
  const candidates = candidatesFor(activeStrategy, draft.scenario, status);
  const capital = Number(draft.capital);

  return (
    <section className="creation-card preview-card">
      <div className="creation-kicker">03 / 预览组合</div>
      <div className="card-heading">
        <div>
          <h1>检查每个组合将如何开始</h1>
          <p>
            T0 {draft.date.replace("T", " ")} · {draft.horizon} · 名义计划结束日{" "}
            {nominalEnd(draft.date, draft.horizon)}（交易日历未接入）
          </p>
        </div>
        <span className="ready-pill">尚无成交</span>
      </div>
      {draft.scenario === "partial" && (
        <div className="coverage-banner">
          <b>部分覆盖已确认</b>
          <span>{partialCoverageSummary(strategies)}</span>
        </div>
      )}
      <div className="portfolio-tabs" role="tablist" aria-label="选择独立组合预览">
        {strategies.map((id, index) => (
          <button
            type="button"
            key={id}
            id={"portfolio-preview-tab-" + id}
            role="tab"
            className={activeStrategy === id ? "active" : ""}
            aria-selected={activeStrategy === id}
            aria-controls="portfolio-preview-panel"
            tabIndex={activeStrategy === id ? 0 : -1}
            ref={(element) => {
              portfolioTabRefs.current[index] = element;
            }}
            onKeyDown={(event) => {
              let nextIndex: number | null = null;
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                nextIndex = (index + 1) % strategies.length;
              } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                nextIndex = (index + strategies.length - 1) % strategies.length;
              } else if (event.key === "Home") {
                nextIndex = 0;
              } else if (event.key === "End") {
                nextIndex = strategies.length - 1;
              }
              if (nextIndex !== null) {
                event.preventDefault();
                setActiveId(strategies[nextIndex]);
                portfolioTabRefs.current[nextIndex]?.focus();
              }
            }}
            onClick={() => setActiveId(id)}
          >
            组合 {index + 1} · {strategyById(id).name}
          </button>
        ))}
      </div>
      <div
        className="portfolio-preview-panel"
        id="portfolio-preview-panel"
        role="tabpanel"
        aria-labelledby={"portfolio-preview-tab-" + activeStrategy}
        tabIndex={0}
      >
        <div className="preview-identity">
          <span>
            当前组合 <b>{activeName}</b>
          </span>
          <span>
            每个组合独立本金 <b>¥{formatMoney(capital)}</b>
          </span>
          <span>不共享现金或成交账本</span>
        </div>
        <div className="preview-layout">
          <CandidatePanel
            key={activeStrategy}
            strategy={activeStrategy}
            draft={draft}
            status={status}
            candidates={candidates}
            capital={capital}
          />
          <PortfolioPanel
            strategy={activeStrategy}
            candidates={candidates}
            capital={capital}
          />
        </div>
        <div className="preview-summary">
          <span>
            起始时点 <b>{draft.date.replace("T", " ")} · Asia/Shanghai</b>
          </span>
          <span>
            首次执行 <b>T0 后下一可交易日开盘</b>
          </span>
          <span>
            当前实际 <b>0 持仓 / 100% 现金</b>
          </span>
        </div>
      </div>
      <div className="step-actions">
        <button type="button" className="creation-secondary" onClick={onBack}>
          ← 上一步：选择策略
        </button>
        <button type="button" className="creation-secondary" onClick={onEditStart}>
          修改起点
        </button>
        <button type="button" className="creation-primary" onClick={onConfirm}>
          确认组合 <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}

function ConfirmStep({
  draft,
  created,
  hasRun,
  onBack,
  onEnter,
  onReturnToRun,
}: {
  draft: Draft;
  created: boolean;
  hasRun: boolean;
  onBack: () => void;
  onEnter: () => void;
  onReturnToRun: () => void;
}) {
  const status = getHistoryStatus(draft.date);
  const strategies = selectedStrategyIds(draft);
  const capital = Number(draft.capital);
  return (
    <section className="creation-card ready-card confirm-card">
      <div className="creation-kicker">04 / 确认并进入</div>
      <div className="card-heading">
        <div>
          <h1>{hasRun ? "运行配置（只读）" : "确认实验配置"}</h1>
          <p>
            {hasRun
              ? "此配置已经开始运行；本页只供查看，继续观察会返回原工作台。"
              : "进入后停在 T0 待开始状态；不会在此步产生交易或收益。"}
          </p>
        </div>
        <span className="ready-pill">{hasRun ? "原运行已保留" : "T0 · 待开始"}</span>
      </div>
      <div className="ready-grid">
        <div>
          <span>起始时点与时区</span>
          <b>{draft.date.replace("T", " ")} · Asia/Shanghai</b>
        </div>
        <div>
          <span>计划结束日</span>
          <b>
            {draft.horizon} · {nominalEnd(draft.date, draft.horizon)}
          </b>
        </div>
        <div>
          <span>组合与独立本金</span>
          <b>
            {strategies.length} 个组合 · 每个 ¥{formatMoney(capital)}（互不共享）
          </b>
        </div>
        <div>
          <span>策略与预设</span>
          <b>
            {strategies
              .map((id) => {
                const label = id === "ema" ? "EMA20" : "低波动质量";
                const preset = draft.presets[id].replace("随策略 · ", "");
                return label + " · " + preset;
              })
              .join("；")}
          </b>
        </div>
        <div>
          <span>首次执行时机</span>
          <b>T0 后下一可交易日开盘；尚未执行，无成交。</b>
        </div>
        <div>
          <span>目标与实际</span>
          <b>
            {strategies
              .map((id) => {
                const available =
                  candidatesFor(id, draft.scenario, status).filter(
                    (item) => item.group === "selected",
                  ).length > 0;
                const weight = available ? 100 - strategyById(id).cashTarget : 0;
                const label = id === "ema" ? "EMA20" : "低波动质量";
                return (
                  label +
                  "：目标 " +
                  weight +
                  "% 持仓 / " +
                  (100 - weight) +
                  "% 现金；实际 0% 持仓 / 100% 现金"
                );
              })
              .join("；")}
          </b>
        </div>
        <div>
          <span>可知数据范围</span>
          <b>
            {status.daily ? "日线 ≤ " + status.daily : "日线截止待检查"}
            {"；"}
            {status.weekly ? "周线 ≤ " + status.weekly : "周线截止待检查"}
          </b>
        </div>
        <div>
          <span>标的来源与覆盖</span>
          <b>
            {draft.collection === "review" ? "复盘示例集合 126 个" : "自选示例集合 18 个"}
            {draft.scenario === "partial"
              ? "；" + partialCoverageSummary(strategies)
              : draft.scenario === "empty"
                ? "；当前演示场景无候选，目标现金 100%"
                : draft.scenario === "missing"
                  ? "；EMA20 因缺历史市值不可选"
                  : ""}
            {"；合成演示，不是真实回测、数据库或全集合覆盖证明。"}
          </b>
        </div>
      </div>
      {created && !hasRun && (
        <div className="creation-status ok" role="status">
          <span aria-hidden="true">✓</span>
          <div>
            <b>组合已确认，仍停在 T0</b>
            <small>实际持仓 0、现金 100%；进入工作台后才可逐日推进。</small>
          </div>
        </div>
      )}
      {draft.scenario === "partial" && (
        <div className="coverage-banner">
          <b>已确认部分覆盖</b>
          <span>按已选策略的必需字段评估；缺失数据不计作规则不符。</span>
        </div>
      )}
      <div className="step-actions ready-actions">
        {!hasRun && (
          <button type="button" className="creation-secondary" onClick={onBack}>
            ← 上一步：预览组合
          </button>
        )}
        <button
          type="button"
          className="creation-primary"
          onClick={hasRun ? onReturnToRun : onEnter}
        >
          {hasRun ? "返回回测工作台" : "进入回测工作台"}
          <span aria-hidden="true">↗</span>
        </button>
      </div>
    </section>
  );
}

function ExperimentList({
  experiments,
  activeExperimentId,
  onOpen,
  onNew,
  onCancelDerivation,
}: {
  experiments: ExperimentSession[];
  activeExperimentId: string | null;
  onOpen: (id: string, showResults: boolean) => void;
  onNew: () => void;
  onCancelDerivation: (id: string) => void;
}) {
  return (
    <section className="creation-card experiment-list-card">
      <div className="creation-kicker">策略实验 / 我的实验</div>
      <div className="card-heading">
        <div>
          <h1>我的策略实验</h1>
          <p>同一会话可保留多个实验；返回列表重开会恢复各自进度。刷新后重置。</p>
        </div>
        <button
          type="button"
          className="creation-primary"
          onClick={onNew}
        >
          + 新建实验
        </button>
      </div>
      {experiments.length > 0 ? (
        <div className="experiment-list">
          {experiments.map((experiment) => {
            const strategies = selectedStrategyIds(experiment.draft);
            const status = !experiment.hasRun
              ? experiment.created
                ? "已确认 · 尚未进入 T0"
                : experiment.sourceExperimentId
                  ? "派生草稿 · 尚未确认"
                  : "草稿 · 尚未确认"
              : experiment.progress?.completed
                ? experiment.progress.status === "回看中"
                  ? "已完成 · 正在回看"
                  : "已完成"
                : experiment.runStatus || "已暂停";
            const action = !experiment.hasRun
              ? experiment.created
                ? "进入已确认实验 →"
                : "继续编辑草稿 →"
              : experiment.progress?.completed
                ? "查看回测结果 →"
                : experiment.progress?.status === "待开始"
                  ? "进入工作台 →"
                  : "继续观察 →";
            const progress = experiment.progress
              ? "已展开至 M " + experiment.progress.knownDate +
                " · 当前查看 V " + experiment.progress.viewDate
              : experiment.hasRun
                ? "T0 尚待首次展开"
                : "尚无运行进度";

            return (
              <div className="experiment-entry" key={experiment.id}>
                <button
                  type="button"
                  className={
                    "saved-experiment" +
                    (activeExperimentId === experiment.id ? " active" : "")
                  }
                  onClick={() => onOpen(experiment.id, Boolean(experiment.progress?.completed))}
                  title={
                    experiment.sourceExposure
                      ? "来源：" + experiment.sourceExposure.experimentName +
                        "；来源链已知数据边界至 " + experiment.sourceExposure.knownDate
                      : undefined
                  }
                >
                  <span className="candidate-dot" aria-hidden="true" />
                  <span className="saved-experiment-main">
                    <b>{experiment.name}</b>
                    <small>
                      T0 {experiment.draft.date.replace("T", " ")} · {strategies.length} 个组合 · {experiment.draft.horizon} · 每个 ¥{formatMoney(Number(experiment.draft.capital))}
                    </small>
                    <small>{status} · {progress}</small>
                    {experiment.sourceExposure && (
                      <small className="experiment-source-line">
                        来源：{experiment.sourceExposure.experimentName} · 来源链已知边界至 {experiment.sourceExposure.knownDate}
                      </small>
                    )}
                  </span>
                  <em>{action}</em>
                </button>
                {experiment.sourceExperimentId && !experiment.hasRun && (
                  <button
                    type="button"
                    className="experiment-cancel"
                    onClick={() => onCancelDerivation(experiment.id)}
                    aria-label={`取消派生草稿 ${experiment.name} 并返回来源实验`}
                    title="删除派生草稿并返回来源实验"
                  >
                    取消派生
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-hint">
          <b>还没有策略实验</b>
          <span>从历史时点开始创建第一份内存草稿；这里只生成合成预览。</span>
          <button type="button" className="creation-primary" onClick={onNew}>
            开始设置起点 <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
    </section>
  );
}

function ScenarioTool({
  scenario,
  disabled,
  onChange,
}: {
  scenario: Scenario;
  disabled: boolean;
  onChange: (scenario: Scenario) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="scenario-tool-disclosure">
      <button
        type="button"
        id="scenario-tool-trigger"
        className="disclosure-trigger"
        aria-expanded={expanded}
        aria-controls="scenario-tool-panel"
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="disclosure-chevron" aria-hidden="true">
          {expanded ? "▾" : "▸"}
        </span>
        原型演示工具（开发）
      </button>
      <div
        id="scenario-tool-panel"
        className="disclosure-panel"
        role="region"
        aria-labelledby="scenario-tool-trigger"
        hidden={!expanded}
      >
        <label>
          演示数据场景
          <select
            aria-label="原型演示数据场景"
            value={scenario}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value as Scenario)}
          >
            <option value="complete">完整覆盖样本</option>
            <option value="missing">策略缺必要字段</option>
            <option value="partial">部分覆盖样本</option>
            <option value="empty">无候选样本</option>
          </select>
        </label>
        <small>仅切换本地合成样本；不属于产品配置，也不会读取业务数据库。</small>
      </div>
    </section>
  );
}

function CreationDisclosure() {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="demo-limitations">
      <button
        type="button"
        id="demo-limitations-trigger"
        className="disclosure-trigger"
        aria-expanded={expanded}
        aria-controls="demo-limitations-panel"
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="disclosure-chevron" aria-hidden="true">
          {expanded ? "▾" : "▸"}
        </span>
        演示范围与数据限制
      </button>
      <div
        id="demo-limitations-panel"
        className="disclosure-panel"
        role="region"
        aria-labelledby="demo-limitations-trigger"
        hidden={!expanded}
      >
        <p>
          合成样本、交易日历未接入、零费用和分股演示；计数不证明完整市场覆盖。此内存原型不调用真实回测或数据库，刷新页面会重置。
        </p>
      </div>
    </section>
  );
}

export function CreationPrototype() {
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const [stage, setStage] = useState<CreationStage>("list");
  const [experiments, setExperiments] = useState<ExperimentSession[]>([]);
  const [runtimeHandlers, setRuntimeHandlers] = useState<Record<string, RuntimeHandlers>>({});
  const [activeExperimentId, setActiveExperimentId] = useState<string | null>(null);
  const fallbackDraft = useMemo(() => makeDefaultDraft(), []);
  const experimentsRef = useRef(experiments);
  const nextExperimentNumber = useRef(1);

  const activeExperiment =
    experiments.find((experiment) => experiment.id === activeExperimentId) ?? null;
  const draft = activeExperiment?.draft ?? fallbackDraft;
  const hasRun = activeExperiment?.hasRun ?? false;
  const created = activeExperiment?.created ?? false;

  useEffect(() => {
    experimentsRef.current = experiments;
  }, [experiments]);

  useEffect(() => {
    if (stage !== "running") {
      mainScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [stage]);

  const updateSession = useCallback(
    (id: string, update: (current: ExperimentSession) => ExperimentSession) => {
      setExperiments((current) => {
        const previous = current.find((experiment) => experiment.id === id);
        if (!previous) return current;
        const updated = update(previous);
        if (updated === previous) return current;
        return current.map((experiment) => (experiment.id === id ? updated : experiment));
      });
    },
    [],
  );

  const updateRunStatus = useCallback((id: string, status: string) => {
    setExperiments((current) => {
      const previous = current.find((experiment) => experiment.id === id);
      if (!previous || previous.runStatus === status) return current;
      return current.map((experiment) =>
        experiment.id === id ? { ...experiment, runStatus: status } : experiment,
      );
    });
  }, []);

  const updateProgress = useCallback((id: string, progress: RuntimeProgress) => {
    setExperiments((current) => {
      const previous = current.find((experiment) => experiment.id === id);
      if (
        !previous ||
        (previous.runStatus === progress.status && sameProgress(previous.progress, progress))
      ) {
        return current;
      }
      return current.map((experiment) =>
        experiment.id === id
          ? { ...experiment, runStatus: progress.status, progress }
          : experiment,
      );
    });
  }, []);

  const allocateIdentity = () => {
    const serial = nextExperimentNumber.current++;
    return { id: "experiment-" + serial, name: "策略实验 " + serial };
  };

  const beginExperiment = () => {
    const identity = allocateIdentity();
    const experiment = makeExperimentSession({
      ...identity,
      draft: makeDefaultDraft(),
    });
    setExperiments((current) => [experiment, ...current]);
    setActiveExperimentId(identity.id);
    setStage("history");
  };

  const beginDerivation = useCallback((sourceId: string, progress: RuntimeProgress) => {
    const source = experimentsRef.current.find((experiment) => experiment.id === sourceId);
    if (!source?.hasRun) return;
    const identity = allocateIdentity();
    const inheritedBoundary = latestExposureBoundary(source, progress);
    const sourceExposure: SourceExposure = {
      experimentName: source.name,
      ...inheritedBoundary,
    };
    const derived = makeExperimentSession({
      ...identity,
      draft: cloneDraftForDerivation(source.draft),
      sourceExperimentId: source.id,
      sourceExposure,
    });
    setExperiments((current) => [derived, ...current]);
    setActiveExperimentId(derived.id);
    setStage("history");
  }, []);

  const makeRuntimeHandlers = useCallback((id: string): RuntimeHandlers => ({
    onList: () => {
      setActiveExperimentId(id);
      setStage("list");
    },
    onReady: () => {
      setActiveExperimentId(id);
      setStage("confirm");
    },
    onStatus: (status) => updateRunStatus(id, status),
    onProgress: (progress) => updateProgress(id, progress),
    onDerive: (progress) => beginDerivation(id, progress),
  }), [beginDerivation, updateProgress, updateRunStatus]);

  const cancelDerivation = useCallback((id: string) => {
    const experiment = experimentsRef.current.find((item) => item.id === id);
    if (!experiment || !experiment.sourceExperimentId || experiment.hasRun) return;
    const source = experimentsRef.current.find(
      (item) => item.id === experiment.sourceExperimentId,
    );
    setExperiments((current) => current.filter((item) => item.id !== id));
    if (source) {
      setActiveExperimentId(source.id);
      setStage(source.hasRun ? "running" : source.resumeStage);
    } else {
      setActiveExperimentId(null);
      setStage("list");
    }
  }, []);

  const leaveToList = useCallback(
    (id: string) => {
      const current = experimentsRef.current.find((experiment) => experiment.id === id);
      if (current && !current.hasRun && stage !== "list" && stage !== "running") {
        updateSession(id, (previous) => ({
          ...previous,
          resumeStage: stage as EditableStage,
        }));
      }
      setActiveExperimentId(id);
      setStage("list");
    },
    [stage, updateSession],
  );

  const openExperiment = useCallback((id: string, showResults: boolean) => {
    const experiment = experimentsRef.current.find((item) => item.id === id);
    if (!experiment) return;
    if (showResults && experiment.hasRun && experiment.progress?.completed) {
      updateSession(id, (current) => ({
        ...current,
        openResultsRequest: current.openResultsRequest + 1,
      }));
    }
    setActiveExperimentId(id);
    setStage(experiment.hasRun ? "running" : experiment.resumeStage);
  }, [updateSession]);

  const activeDerivationId =
    activeExperiment?.sourceExperimentId && !activeExperiment.hasRun
      ? activeExperiment.id
      : null;
  const cancelActiveDerivation = useMemo(
    () => activeDerivationId ? () => cancelDerivation(activeDerivationId) : undefined,
    [activeDerivationId, cancelDerivation],
  );

  useEffect(() => {
    if (!activeDerivationId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      event.preventDefault();
      cancelDerivation(activeDerivationId);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeDerivationId, cancelDerivation]);

  const updateHistory = (patch: HistoryPatch) => {
    if (!activeExperiment || hasRun) return;
    const affectsCoverage = "date" in patch || "collection" in patch;
    updateSession(activeExperiment.id, (current) => ({
      ...current,
      draft: {
        ...current.draft,
        ...patch,
        partialConfirmed: affectsCoverage ? false : current.draft.partialConfirmed,
      },
      created: false,
    }));
  };

  const changeScenario = (scenario: Scenario) => {
    if (!activeExperiment || hasRun) return;
    updateSession(activeExperiment.id, (current) => {
      let selected = current.draft.selected;
      if (scenario === "missing") {
        selected = selected.filter((id) => id !== "ema");
        if (selected.length === 0) selected = ["quality"];
      } else if (selected.length === 0) {
        selected = ["ema"];
      }
      return {
        ...current,
        created: false,
        draft: {
          ...current.draft,
          scenario,
          selected,
          partialConfirmed: false,
        },
      };
    });
    setStage("history");
  };

  const toggleStrategy = (id: StrategyId) => {
    if (!activeExperiment || hasRun) return;
    updateSession(activeExperiment.id, (current) => {
      const isSelected = current.draft.selected.includes(id);
      const selected = isSelected
        ? current.draft.selected.filter((item) => item !== id)
        : [...current.draft.selected, id];
      return { ...current, created: false, draft: { ...current.draft, selected } };
    });
  };

  const changePreset = (id: StrategyId, value: string) => {
    if (!activeExperiment || hasRun) return;
    updateSession(activeExperiment.id, (current) => ({
      ...current,
      created: false,
      draft: {
        ...current.draft,
        presets: { ...current.draft.presets, [id]: value },
      },
    }));
  };

  const confirmPartial = (value: boolean) => {
    if (!activeExperiment || hasRun) return;
    updateSession(activeExperiment.id, (current) => ({
      ...current,
      created: false,
      draft: { ...current.draft, partialConfirmed: value },
    }));
  };

  const jumpBack = (target: Exclude<CreationStage, "list" | "running">) => {
    if (!activeExperiment || hasRun) return;
    const currentIndex = STEP_KEYS.indexOf(
      stage as Exclude<CreationStage, "list" | "running">,
    );
    if (STEP_KEYS.indexOf(target) <= currentIndex) setStage(target);
  };

  const historyStatus = getHistoryStatus(draft.date);
  const historyValid = historyStatus.canContinue && isValidCapital(draft.capital);
  const strategyValid =
    draft.selected.length > 0 &&
    (draft.scenario !== "partial" || draft.partialConfirmed);

  const activeStep = stage === "list" || stage === "running" ? null : stage;

  return (
    <div className="creation-prototype">
      <AppNav />
      <main
        ref={mainScrollRef}
        className={
          "creation-main" +
          (stage === "preview" ? " preview-stage" : stage === "confirm" ? " confirm-stage" : "")
        }
        style={stage === "running" ? { display: "none" } : undefined}
      >
        <PageHeader
          stage={stage}
          experimentName={activeExperiment?.name}
          onList={() => activeExperiment && leaveToList(activeExperiment.id)}
          onCancelDerivation={cancelActiveDerivation}
        />
        {activeStep && (
          <StepProgress stage={activeStep} locked={hasRun} onBack={jumpBack} />
        )}
        {activeExperiment?.sourceExposure && stage !== "list" && (
          <SourceExposureNotice exposure={activeExperiment.sourceExposure} />
        )}

        {stage === "list" && (
          <ExperimentList
            experiments={experiments}
            activeExperimentId={activeExperimentId}
            onOpen={openExperiment}
            onNew={beginExperiment}
            onCancelDerivation={cancelDerivation}
          />
        )}
        {stage === "history" && (
          <HistoryStep
            draft={draft}
            onUpdate={updateHistory}
            onNext={() => {
              if (historyValid) setStage("strategies");
            }}
          />
        )}
        {stage === "strategies" && (
          <StrategyStep
            draft={draft}
            onToggle={toggleStrategy}
            onPreset={changePreset}
            onConfirmPartial={confirmPartial}
            onBack={() => setStage("history")}
            onNext={() => {
              if (strategyValid) setStage("preview");
            }}
          />
        )}
        {stage === "preview" && (
          <PreviewStep
            draft={draft}
            onBack={() => setStage("strategies")}
            onEditStart={() => setStage("history")}
            onConfirm={() => {
              if (!activeExperiment) return;
              updateSession(activeExperiment.id, (current) => ({
                ...current,
                created: true,
                resumeStage: "confirm",
              }));
              setStage("confirm");
            }}
          />
        )}
        {stage === "confirm" && (
          <ConfirmStep
            draft={draft}
            created={created}
            hasRun={hasRun}
            onBack={() => setStage("preview")}
            onEnter={() => {
              if (!activeExperiment || !created || hasRun || !historyValid || !strategyValid) return;
              setRuntimeHandlers((current) =>
                current[activeExperiment.id]
                  ? current
                  : {
                      ...current,
                      [activeExperiment.id]: makeRuntimeHandlers(activeExperiment.id),
                    },
              );
              updateSession(activeExperiment.id, (current) => ({
                ...current,
                hasRun: true,
                runStatus: "待开始",
                progress: null,
                resumeStage: "confirm",
              }));
              setStage("running");
            }}
            onReturnToRun={() => setStage("running")}
          />
        )}
        <ScenarioTool
          scenario={draft.scenario}
          disabled={hasRun}
          onChange={changeScenario}
        />
        <CreationDisclosure />
      </main>
      <div
        className={
          "creation-runtime-stack" +
          (stage === "running" ? " running-active" : "")
        }
      >
        {experiments.map((experiment) => {
          if (!experiment.hasRun) return null;
          const handlers = runtimeHandlers[experiment.id];
          if (!handlers) return null;
          const visible = stage === "running" && activeExperimentId === experiment.id;
          return (
            <div
              key={experiment.id}
              className="creation-runtime-instance"
              style={{ display: visible ? "flex" : "none" }}
            >
              <RunningPrototype
                draft={experiment.draft}
                visible={visible}
                onList={handlers.onList}
                onReady={handlers.onReady}
                onStatus={handlers.onStatus}
                experimentName={experiment.name}
                sourceExposure={experiment.sourceExposure ?? undefined}
                openResultsRequest={experiment.openResultsRequest}
                onProgress={handlers.onProgress}
                onDerive={handlers.onDerive}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
