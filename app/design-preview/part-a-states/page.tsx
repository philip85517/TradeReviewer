import type { Metadata } from "next";

import { PartAComponentStates } from "../../components/design-prototype/part-a-component-states";
import { HomeDesignPreview } from "../../components/design-prototype/home-design-preview";
import { checkDesignPreviewRuntime } from "../../lib/design-preview/runtime-safety";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "TradeReview Part A 状态样板",
};

export default function PartAStatesPreviewPage() {
  const runtime = checkDesignPreviewRuntime();

  if (!runtime.allowed) {
    return (
      <main style={{ minHeight: "100dvh", padding: "32px", fontFamily: "system-ui, sans-serif" }}>
        <h1>设计预览不可用</h1>
        <p>{runtime.reason}</p>
        <a href="/">返回真实首页</a>
      </main>
    );
  }

  return (
    <HomeDesignPreview>
      <PartAComponentStates />
    </HomeDesignPreview>
  );
}
