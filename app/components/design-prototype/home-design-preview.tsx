"use client";

import { useState, type ReactNode } from "react";
import styles from "./home-design-preview.module.css";

type PreviewVariant = "baseline" | "recommended";

export function HomeDesignPreview({ children }: { children: ReactNode }) {
  const [variant, setVariant] = useState<PreviewVariant>("recommended");

  return (
    <div className={`${styles.root} ${styles[variant]}`} data-preview-variant={variant}>
      <header className={styles.comparisonBar}>
        <span className={styles.label}>隔离副本 · 已保留既有修复</span>
        <div className={styles.controls} aria-label="首页视觉比较">
          <button
            className={styles.button}
            type="button"
            aria-pressed={variant === "baseline"}
            onClick={() => setVariant("baseline")}
          >
            现有首页
          </button>
          <button
            className={styles.button}
            type="button"
            aria-pressed={variant === "recommended"}
            onClick={() => setVariant("recommended")}
          >
            视觉调整
          </button>
          <a className={styles.sampleLink} href="/design-preview/component-sample">
            旧组件样板
          </a>
        </div>
      </header>
      <div className={styles.host}>{children}</div>
    </div>
  );
}
