"use client";

import { useSyncExternalStore, useState } from "react";
import { useRouter } from "next/navigation";
import { RunningPrototype } from "./running-prototype";
import type { RunningDraft } from "./running-model";
import "./full-workbench-preview.css";

type PreviewView = "observe" | "results" | "compare";
type PreviewScene = "complete" | "running" | "T0";
export type WorkbenchVisualTheme = "original" | "unified";

const draft: RunningDraft = {
  date: "2024-06-14T16:00",
  collection: "review",
  capital: "100000",
  horizon: "3 个月",
  blind: true,
  scenario: "complete",
  selected: ["ema", "quality"],
  presets: { ema: "随策略 · 每周", quality: "随策略 · 每月" },
};

function query(view: PreviewView, scene: PreviewScene): string {
  return `?prototype=strategy-workbench&view=${view}&scene=${scene}`;
}

export function FullWorkbenchPreview({ view, scene }: { view: PreviewView; scene: PreviewScene }) {
  const router = useRouter();
  const [resetNonce, setResetNonce] = useState(0);
  const [visualTheme, setVisualTheme] = useState<WorkbenchVisualTheme>("unified");
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const reset = (nextView: PreviewView = "observe", nextScene: PreviewScene = scene) => {
    setResetNonce(value => value + 1);
    router.replace(query(nextView, nextScene));
  };
  const initialPreview = scene === "T0" ? "t0" : scene;
  const sceneLabel = scene === "T0" ? "T0 起点" : scene === "running" ? "运行中 · 第 10 日" : "完整 · 已展开";
  const themeLabel = visualTheme === "unified" ? "首页统一" : "原版样式";
  return (
    <div className={`full-workbench-preview${visualTheme === "unified" ? " full-workbench-preview--unified" : ""}`}>
      <nav className="full-preview-nav" aria-label="完整工作台导览">
        <span className="full-preview-brand"><b>TradeReview</b><small>历史策略复盘 · 完整交互版</small></span>
        <span className="full-preview-nav-label">旧 Workbench 预览</span>
        <a href="?prototype=strategy-workbench&view=observe&scene=complete">完整观察</a>
        <a href="?prototype=strategy-workbench&view=results&scene=complete">完整结果</a>
        <a href="?prototype=strategy-workbench&view=compare&scene=complete">完整比较</a>
        <a href="?prototype=strategy-create&variant=A">原创建</a>
        <a href="/design-system-20261008/workbench/index.html">当前 A</a>
      </nav>
      <div className="full-preview-context">
        <div className="full-preview-context-summary"><b>合成演示 · {sceneLabel} · {themeLabel}</b><span>三个月双策略合成预设 · EMA20 v1.4 · 低波动质量 v2.1 · ¥100,000 · 复盘标的集</span></div>
        <details className="full-preview-tools">
          <summary>预览工具 · 场景 / 视觉 / 说明</summary>
          <div className="full-preview-tools-body">
            <div className="full-preview-scenes" aria-label="演示场景">
              <button type="button" className={scene === "T0" ? "active" : ""} aria-pressed={scene === "T0"} onClick={() => reset("observe", "T0")}>T0 起点</button>
              <button type="button" className={scene === "running" ? "active" : ""} aria-pressed={scene === "running"} onClick={() => reset("observe", "running")}>运行中 · 第10日</button>
              <button type="button" className={scene === "complete" ? "active" : ""} aria-pressed={scene === "complete"} onClick={() => reset("observe", "complete")}>完整 · 已展开</button>
            </div>
            <div className="full-preview-style-toggle" role="group" aria-label="工作台视觉样式">
              <span>视觉</span>
              <button type="button" aria-pressed={visualTheme === "original"} onClick={() => setVisualTheme("original")}>原版样式</button>
              <button type="button" aria-pressed={visualTheme === "unified"} onClick={() => setVisualTheme("unified")}>首页统一</button>
            </div>
            <small>{scene === "T0" ? "T0 入口预设：未展开" : scene === "running" ? "运行入口预设：已展开至第 10 日" : "完整入口预设：已展开"}；合成演示，刷新重置；切换演示场景或导览会重开预设；切换视觉保留当前查看状态。</small>
          </div>
        </details>
      </div>
      {mounted ? <RunningPrototype
          key={`${scene}-${view}-${resetNonce}`}
          draft={draft}
          visible
          initialPreview={initialPreview}
          initialView={view}
          experimentName="完整 Workbench 合成演示"
          visualTheme={visualTheme}
          onList={() => router.replace("?prototype=strategy-create&variant=A")}
          onReady={() => router.replace("?prototype=strategy-create&variant=A")}
          onStatus={() => undefined}
        /> : <div className="full-preview-loading" role="status">正在打开完整交互预览…</div>}
    </div>
  );
}
