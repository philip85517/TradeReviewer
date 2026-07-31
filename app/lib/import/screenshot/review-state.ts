import Decimal from "decimal.js";

import {
  SCREENSHOT_REVIEW_CONFIDENCE,
  type ScreenshotField,
  type ScreenshotFieldEvidence,
  type ScreenshotTradeDraft,
} from "./contracts";
import { wallClockToInstant } from "./time";

export type ScreenshotReviewAction =
  | { type: "confirm-field"; draftId: string; field: ScreenshotField }
  | {
      type: "edit-field";
      draftId: string;
      field: ScreenshotField;
      value: string;
    }
  | { type: "delete-draft"; draftId: string }
  | { type: "add-draft"; imageId: string }
  | { type: "set-time-zone"; timeZone: string }
  | {
      type: "set-time-disambiguation";
      draftId: string;
      value: "earlier" | "later";
    }
  | { type: "set-account"; accountId: string; accountLabel: string };

type ScreenshotReviewImageSource = {
  imageId: string;
  fingerprint: string;
  captureIndex: number;
};

export type ScreenshotReviewImage = ScreenshotReviewImageSource &
  (
    | {
        broker: "futu";
        layoutVersion: "futu-orders-dark-v1";
      }
    | {
        broker: "tiger";
        layoutVersion:
          | "tiger-orders-dark-v1"
          | "tiger-instrument-first-dark-v1";
      }
  );

export type ScreenshotReviewState = {
  batchId: string;
  images: ScreenshotReviewImage[];
  drafts: ScreenshotTradeDraft[];
  deletedDraftIds: Set<string>;
  sourceTimezone?: string;
  account?: { id: string; label: string };
};

export type ScreenshotReviewBlocker = {
  code:
    | "missing-timezone"
    | "missing-account"
    | "invalid-field"
    | "unconfirmed-field"
    | "ambiguous-time";
  draftId?: string;
  field?: ScreenshotField;
  message: string;
};

const REQUIRED_FIELDS: ScreenshotField[] = [
  "market",
  "symbol",
  "side",
  "quantity",
  "price",
  "executedAt",
];
const MARKETS = new Set(["US", "HK", "CN-SH", "CN-SZ"]);

function isSupportedReviewImage(
  image: ScreenshotReviewImage | undefined,
): image is ScreenshotReviewImage {
  return (
    (image?.broker === "futu" &&
      image.layoutVersion === "futu-orders-dark-v1") ||
    (image?.broker === "tiger" &&
      (image.layoutVersion === "tiger-orders-dark-v1" ||
        image.layoutVersion === "tiger-instrument-first-dark-v1"))
  );
}

function activeDrafts(
  state: ScreenshotReviewState,
): ScreenshotTradeDraft[] {
  return state.drafts.filter(
    ({ id }) => !state.deletedDraftIds.has(id),
  );
}

function fieldValue(
  draft: ScreenshotTradeDraft,
  field: ScreenshotField,
): string | undefined {
  switch (field) {
    case "executedAt":
      return draft.sourceTimestampText;
    default:
      return draft[field];
  }
}

function positiveDecimal(value: string | undefined): boolean {
  if (value === undefined) return false;
  try {
    const decimal = new Decimal(value);
    return decimal.isFinite() && decimal.gt(0);
  } catch {
    return false;
  }
}

function fieldIsValid(
  draft: ScreenshotTradeDraft,
  field: ScreenshotField,
): boolean {
  const value = fieldValue(draft, field);
  switch (field) {
    case "market":
      return value !== undefined && MARKETS.has(value);
    case "symbol":
      return value !== undefined && value.trim().length > 0;
    case "side":
      return value === "buy" || value === "sell";
    case "quantity":
    case "price":
      return positiveDecimal(value);
    case "executedAt":
      return value !== undefined && value.trim().length > 0;
  }
}

function editedValue(
  field: ScreenshotField,
  value: string,
): Partial<ScreenshotTradeDraft> {
  const trimmed = value.trim();
  switch (field) {
    case "market": {
      const market = trimmed.toUpperCase();
      return {
        market: MARKETS.has(market)
          ? (market as ScreenshotTradeDraft["market"])
          : undefined,
      };
    }
    case "symbol":
      return { symbol: trimmed.toUpperCase() || undefined };
    case "side": {
      const side = trimmed.toLowerCase();
      return {
        side:
          side === "buy" || side === "sell"
            ? side
            : undefined,
      };
    }
    case "quantity":
    case "price": {
      let normalized: string | undefined;
      try {
        const decimal = new Decimal(trimmed.replaceAll(",", ""));
        normalized = decimal.isFinite() ? decimal.toString() : undefined;
      } catch {
        normalized = undefined;
      }
      return { [field]: normalized };
    }
    case "executedAt":
      return { sourceTimestampText: trimmed || undefined };
  }
}

function userEvidence(
  previous: ScreenshotFieldEvidence | undefined,
  rawText: string,
): ScreenshotFieldEvidence {
  return {
    rawText,
    confidence: previous?.confidence ?? 1,
    repaired: false,
    confirmedByUser: true,
    ...(previous?.sourceBounds
      ? { sourceBounds: previous.sourceBounds }
      : {}),
  };
}

function updateDraft(
  state: ScreenshotReviewState,
  draftId: string,
  update: (draft: ScreenshotTradeDraft) => ScreenshotTradeDraft,
): ScreenshotReviewState {
  return {
    ...state,
    drafts: state.drafts.map((draft) =>
      draft.id === draftId ? update(draft) : draft,
    ),
  };
}

export function screenshotReviewReducer(
  state: ScreenshotReviewState,
  action: ScreenshotReviewAction,
): ScreenshotReviewState {
  switch (action.type) {
    case "confirm-field":
      return updateDraft(state, action.draftId, (draft) => {
        const evidence = draft.fieldEvidence[action.field];
        if (!evidence) return draft;
        return {
          ...draft,
          fieldEvidence: {
            ...draft.fieldEvidence,
            [action.field]: {
              ...evidence,
              confirmedByUser: true,
            },
          },
        };
      });
    case "edit-field":
      return updateDraft(state, action.draftId, (draft) => ({
        ...draft,
        ...editedValue(action.field, action.value),
        ...(action.field === "executedAt"
          ? { timeDisambiguation: undefined }
          : {}),
        fieldEvidence: {
          ...draft.fieldEvidence,
          [action.field]: userEvidence(
            draft.fieldEvidence[action.field],
            action.value,
          ),
        },
      }));
    case "delete-draft":
      if (!state.drafts.some(({ id }) => id === action.draftId)) {
        return state;
      }
      return {
        ...state,
        deletedDraftIds: new Set([
          ...state.deletedDraftIds,
          action.draftId,
        ]),
      };
    case "add-draft": {
      const image = state.images.find(
        ({ imageId }) => imageId === action.imageId,
      );
      if (!isSupportedReviewImage(image)) return state;
      const imageDrafts = state.drafts.filter(
        ({ imageId }) => imageId === action.imageId,
      );
      const template = imageDrafts[0];
      const sourceRowIndex =
        Math.max(-1, ...imageDrafts.map((draft) => draft.sourceRowIndex)) +
        1;
      const manualDraft: ScreenshotTradeDraft = {
        id: `${action.imageId}:manual:${sourceRowIndex}`,
        broker: image.broker,
        layoutVersion: image.layoutVersion,
        imageId: action.imageId,
        sourceRowIndex,
        sourceBounds: { x: 0, y: 0, width: 0, height: 0 },
        sourceAccountSuffix: template?.sourceAccountSuffix,
        fieldEvidence: {},
      };
      return { ...state, drafts: [...state.drafts, manualDraft] };
    }
    case "set-time-zone":
      return { ...state, sourceTimezone: action.timeZone.trim() };
    case "set-time-disambiguation":
      return updateDraft(state, action.draftId, (draft) => ({
        ...draft,
        timeDisambiguation: action.value,
      }));
    case "set-account":
      return {
        ...state,
        account: { id: action.accountId, label: action.accountLabel },
      };
  }
}

export function resolvedReviewAccount(
  state: ScreenshotReviewState,
): { id: string; label: string } | undefined {
  if (state.account?.id.trim() && state.account.label.trim()) {
    return state.account;
  }

  const accountKeys = new Set(
    activeDrafts(state).map((draft) => {
      const suffix = draft.sourceAccountSuffix?.trim();
      return suffix ? `${draft.broker}\u0000${suffix}` : "";
    }),
  );
  if (accountKeys.size !== 1 || accountKeys.has("")) return undefined;

  const [broker, suffix] = [...accountKeys][0].split("\u0000");
  const brokerLabel = broker === "futu" ? "富途" : "老虎";
  return {
    id: `screenshot:${broker}:${suffix}`,
    label: `${brokerLabel}截图账户 · ${suffix}`,
  };
}

export function reviewBlockers(
  state: ScreenshotReviewState,
): ScreenshotReviewBlocker[] {
  const blockers: ScreenshotReviewBlocker[] = [];
  const drafts = activeDrafts(state);

  if (!state.sourceTimezone?.trim()) {
    blockers.push({
      code: "missing-timezone",
      message: "请选择截图成交时间所使用的时区",
    });
  }
  if (!resolvedReviewAccount(state)) {
    blockers.push({
      code: "missing-account",
      message: "请选择交易账户",
    });
  }
  if (new Set(drafts.map(({ broker }) => broker)).size > 1) {
    blockers.push({
      code: "invalid-field",
      message: "请将富途和老虎截图分开导入",
    });
  }

  for (const draft of drafts) {
    const images = state.images.filter(
      ({ imageId }) => imageId === draft.imageId,
    );
    const image = images[0];
    if (
      images.length !== 1 ||
      !isSupportedReviewImage(image) ||
      image.broker !== draft.broker ||
      image.layoutVersion !== draft.layoutVersion
    ) {
      blockers.push({
        code: "invalid-field",
        draftId: draft.id,
        message: "截图来源信息缺失或重复",
      });
    }

    for (const field of REQUIRED_FIELDS) {
      if (!fieldIsValid(draft, field)) {
        blockers.push({
          code: "invalid-field",
          draftId: draft.id,
          field,
          message: `${field} 字段无效`,
        });
        continue;
      }
      const evidence = draft.fieldEvidence[field];
      if (
        !evidence ||
        (!evidence.confirmedByUser &&
          (field === "executedAt" ||
            !Number.isFinite(evidence.confidence) ||
            evidence.confidence < SCREENSHOT_REVIEW_CONFIDENCE ||
            evidence.repaired))
      ) {
        blockers.push({
          code: "unconfirmed-field",
          draftId: draft.id,
          field,
          message: `${field} 字段需要确认`,
        });
      }
    }

    if (
      state.sourceTimezone?.trim() &&
      fieldIsValid(draft, "executedAt")
    ) {
      const time = wallClockToInstant(
        draft.sourceTimestampText!,
        state.sourceTimezone,
        draft.timeDisambiguation,
      );
      if (!time.ok) {
        blockers.push({
          code:
            time.code === "ambiguous-wall-clock"
              ? "ambiguous-time"
              : "invalid-field",
          draftId: draft.id,
          field: "executedAt",
          message:
            time.code === "ambiguous-wall-clock"
              ? "成交时间处于夏令时重复区间，请选择较早或较晚时刻"
              : "成交时间无效",
        });
      }
    }
  }

  return blockers;
}
