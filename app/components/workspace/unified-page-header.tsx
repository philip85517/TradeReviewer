"use client";

import { createContext, Fragment, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import styles from "./unified-page-header.module.css";

export type UnifiedPageHeaderProps = {
  title: string;
  description?: string;
  status?: ReactNode;
  /** The workspace-owned shared scope controls. The header only positions them. */
  scopeControls: ReactNode;
  /** Existing search/notification/user tools, kept stateful by their owner. */
  globalTools?: ReactNode;
  /** Optional controls that share the input baseline, such as global search. */
  scopeTools?: ReactNode;
  /** Trailing scope-row action, such as the page-specific filter toggle. */
  scopeActions?: ReactNode;
  /** Page-local tabs. Omit for pages without tabs; no empty row is rendered. */
  tabs?: ReactNode;
  /** Page-local filters that appear after the page tabs and before content. */
  filters?: ReactNode;
  className?: string;
};

type ScopeFieldNodes = {
  nature: ReactNode;
  account: ReactNode;
  run?: ReactNode;
  currency: ReactNode;
};

const compactScopeContext = createContext(false);

/** Keeps visual and keyboard order aligned when the shared scope becomes two columns. */
export function UnifiedScopeFields({ nature, account, run, currency }: ScopeFieldNodes) {
  const compact = useContext(compactScopeContext);
  const fields = compact
    ? ([
        ["nature", nature],
        ["currency", currency],
        ["account", account],
        ["run", run],
      ] as const)
    : ([
        ["nature", nature],
        ["account", account],
        ["run", run],
        ["currency", currency],
      ] as const);
  return <>{fields.filter(([, node]) => Boolean(node)).map(([key, node]) => <Fragment key={key}>{node}</Fragment>)}</>;
}

function ContentRail({ children }: { children: ReactNode }) {
  const railRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<"wide" | "medium" | "compact">("wide");

  useLayoutEffect(() => {
    const rail = railRef.current;
    if (!rail || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const styles = window.getComputedStyle(rail);
      const padding = Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);
      const contentWidth = rail.getBoundingClientRect().width - padding;
      setLayout(contentWidth < 640 ? "compact" : contentWidth < 1056 ? "medium" : "wide");
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(rail);
    return () => observer.disconnect();
  }, []);

  return <div ref={railRef} className={styles.contentRail} data-content-rail="true" data-content-layout={layout}>
    <compactScopeContext.Provider value={layout === "compact"}>{children}</compactScopeContext.Provider>
  </div>;
}

export function UnifiedPageHeader({
  title,
  description,
  status,
  scopeControls,
  globalTools,
  scopeTools,
  scopeActions,
  tabs,
  filters,
  className,
}: UnifiedPageHeaderProps) {
  return (
    <div className={[styles.shell, className].filter(Boolean).join(" ")}>
      <header
        className={styles.header}
        aria-label={`${title}页面头部`}
      >
        <ContentRail>
          <div className={styles.identityRow} data-header-row="identity">
            <div className={styles.identity}>
              <h1>{title}</h1>
              {description && <p>{description}</p>}
            </div>
            {(status || globalTools) && (
              <div className={styles.identityTools}>
                {status && <div className={styles.status}>{status}</div>}
                {globalTools}
              </div>
            )}
          </div>
          <div className={styles.scopeRow} data-header-row="scope" data-has-scope-actions={scopeActions ? "true" : "false"}>
            <div className={styles.scopeControls} data-header-scope-controls role="group" aria-label="共享范围">
              {scopeControls}
            </div>
            {scopeTools && <div className={styles.scopeTools}>{scopeTools}</div>}
            {scopeActions && <div className={styles.scopeActions}>{scopeActions}</div>}
          </div>
        </ContentRail>
      </header>
      {(tabs || filters) && <ContentRail>
        {tabs && <div className={styles.tabsRow} data-page-tabs-row="true">{tabs}</div>}
        {filters && <div className={styles.filtersRow}>{filters}</div>}
      </ContentRail>}
    </div>
  );
}
