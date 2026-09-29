import type { Metadata } from "next";

import { TradeReviewWorkspace } from "./components/trade-review-workspace";
import { getDemoReplayFrame } from "./lib/demo/server-replay-provider";
import { StrategyPrototype } from "./components/strategy-prototype/strategy-prototype";
import { CreationPrototype } from "./components/strategy-prototype/creation-prototype";

export const metadata: Metadata = {
  title: "TradeReview — 历史交易复盘",
  description:
    "在不泄露未来行情的前提下，逐根回放历史交易，复盘当时的判断、执行与风险。",
};

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const prototype = params.prototype;
  const variantParam = params.variant;
  const variant = Array.isArray(variantParam) ? variantParam[0] : variantParam;

  if (process.env.NODE_ENV !== "production" && prototype === "strategy" && (variant === "A" || variant === "B")) {
    return <StrategyPrototype variant={variant} />;
  }

  if (process.env.NODE_ENV !== "production" && prototype === "strategy-create" && variant === "A") {
    return <CreationPrototype />;
  }

  return (
    <TradeReviewWorkspace
      initialFrame={getDemoReplayFrame()}
      showDemo={false}
    />
  );
}
