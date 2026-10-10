import type { Metadata } from "next";
import { getDemoReplayFrame } from "../lib/demo/server-replay-provider";
import { TradeReviewWorkspace } from "../components/trade-review-workspace";
import { HomeDesignPreview } from "../components/design-prototype/home-design-preview";
import { checkDesignPreviewRuntime } from "../lib/design-preview/runtime-safety";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "TradeReview 首页设计预览",
};

export default function DesignPreviewPage() {
  const runtime = checkDesignPreviewRuntime();

  if (!runtime.allowed) {
    return (
      <main style={{ minHeight: "100dvh", padding: "32px", fontFamily: "system-ui, sans-serif" }}>
        <h1>设计预览不可用</h1>
        <p>{runtime.reason}</p>
      </main>
    );
  }

  const initialFrame = getDemoReplayFrame();

  return (
    <HomeDesignPreview>
      <TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />
    </HomeDesignPreview>
  );
}
