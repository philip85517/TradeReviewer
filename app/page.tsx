import type { Metadata } from "next";

import { TradeReviewWorkspace } from "./components/trade-review-workspace";

export const metadata: Metadata = {
  title: "TradeReview — 历史交易复盘",
  description:
    "在不泄露未来行情的前提下，逐根回放历史交易，复盘当时的判断、执行与风险。",
};

export default function Home() {
  return <TradeReviewWorkspace />;
}
