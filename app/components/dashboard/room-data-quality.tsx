"use client";

import type {
  TradingRoomQualityDimension,
  TradingRoomQualityDimensionId,
  TradingRoomQualityModel,
} from "../../lib/reviews/trading-room-quality";
import styles from "./room-data-quality.module.css";

export type RoomDataQualityProps = {
  model: TradingRoomQualityModel;
  onOpenDataManagement?: (model: TradingRoomQualityModel) => void;
  onRetryDataQuality?: (
    dimension: TradingRoomQualityDimensionId,
    instrumentIds: readonly string[],
  ) => void;
  onOpenDataCheck?: (
    dimension: TradingRoomQualityDimensionId,
    ids: readonly string[],
    episodeId?: string,
  ) => void;
};

const statusLabel = {
  available: "可用",
  limited: "部分可用",
  "needs-check": "需检查",
} as const;

function actionText(dimension: TradingRoomQualityDimension): string | null {
  if (dimension.action === "retry") return dimension.id === "fx" ? "重试汇率" : `重试${dimension.label}`;
  if (dimension.action === "supplement") return dimension.id === "transaction" ? "补充交易数据" : `补充${dimension.label}`;
  if (dimension.action === "source-unsupported") return "查看数据源";
  if (dimension.action === "open-data-check") return "查看数据";
  if (dimension.action === "open-data-management") return "打开数据管理";
  return null;
}

function actionIds(dimension: TradingRoomQualityDimension): readonly string[] {
  if (dimension.action === "retry") return dimension.retryableInstrumentIds;
  return dimension.affectedInstrumentIds;
}

function denominatorUnit(dimension: TradingRoomQualityDimension): string {
  return dimension.id === "historical" ? "个标的" : "个回合";
}

function DimensionAction({
  model,
  dimension,
  onOpenDataManagement,
  onRetryDataQuality,
  onOpenDataCheck,
}: RoomDataQualityProps & { dimension: TradingRoomQualityDimension }) {
  const label = actionText(dimension);
  if (!label) return null;
  const ids = actionIds(dimension);
  if (dimension.action === "retry") {
    return (
      <button
        type="button"
        className={styles.action}
        onClick={() => onRetryDataQuality?.(dimension.id, ids)}
      >
        {label}
      </button>
    );
  }
  if (dimension.action === "open-data-check") {
    return (
      <button
        type="button"
        className={styles.action}
        onClick={() => onOpenDataCheck?.(dimension.id, ids)}
      >
        {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      className={styles.action}
      onClick={() => onOpenDataManagement?.(model)}
    >
      {label}
    </button>
  );
}

export function RoomDataQuality({
  model,
  onOpenDataManagement,
  onRetryDataQuality,
  onOpenDataCheck,
}: RoomDataQualityProps) {
  return (
    <section className={styles.panel} aria-label="数据质量摘要">
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>Data quality</span>
          <h2>数据质量</h2>
          <p>按当前交易室范围说明哪些结果可用，以及下一步如何处理。</p>
        </div>
        <span className={`${styles.status} ${styles[`status-${model.status}`]}`}>
          {model.summary}
        </span>
      </header>

      <div className={styles.dimensions}>
        {model.dimensions.map(dimension => (
          <article className={styles.dimension} key={dimension.id} aria-label={dimension.label}>
            <div className={styles.dimensionHeading}>
              <div>
                <h3>{dimension.label}</h3>
                <span className={`${styles.status} ${styles[`status-${dimension.status}`]}`}>
                  {statusLabel[dimension.status]}
                </span>
              </div>
              <strong>
                已用 {dimension.availableCount} / {dimension.totalCount} {denominatorUnit(dimension)}
                {dimension.affectedCount > 0 ? `；受影响 ${dimension.affectedCount} 个` : ""}
              </strong>
            </div>
            <p className={styles.impact}>{dimension.impact}</p>
            <p className={styles.reason}>{dimension.reason}</p>
            <DimensionAction
              model={model}
              dimension={dimension}
              onOpenDataManagement={onOpenDataManagement}
              onRetryDataQuality={onRetryDataQuality}
              onOpenDataCheck={onOpenDataCheck}
            />
          </article>
        ))}
      </div>

      {model.unknownAssetEpisodeCount > 0 && (
        <p className={styles.note}>
          {model.unknownAssetCount} 个未知资产标的、{model.unknownAssetEpisodeCount} 个回合未纳入四类资产合计。
        </p>
      )}
    </section>
  );
}
