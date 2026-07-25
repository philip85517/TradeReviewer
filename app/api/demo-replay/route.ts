import type { DemoReplayMode } from "../../lib/demo/replay-frame";
import { getDemoReplayFrame } from "../../lib/demo/server-replay-provider";

const MODES = new Set<DemoReplayMode>([
  "next",
  "previous",
  "next-execution",
  "restore",
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedMode = url.searchParams.get("mode") as DemoReplayMode | null;
  const mode =
    requestedMode && MODES.has(requestedMode)
      ? requestedMode
      : "next";

  return Response.json(
    getDemoReplayFrame({
      cursor: url.searchParams.get("cursor"),
      mode,
    }),
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
