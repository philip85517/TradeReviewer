import { TradeReviewWorkspace } from "../components/trade-review-workspace";
import { getDemoReplayFrame } from "../lib/demo/server-replay-provider";

export default function Page() {
  return <TradeReviewWorkspace initialFrame={getDemoReplayFrame()} showDemo={false} initialPage="home" />;
}
