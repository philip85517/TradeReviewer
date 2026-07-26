import { NextResponse } from "next/server";

type RefreshRequest = {
  instrumentId?: unknown;
  symbol?: unknown;
  market?: unknown;
};

export async function POST(request: Request) {
  let body: RefreshRequest;
  try {
    body = (await request.json()) as RefreshRequest;
  } catch {
    return NextResponse.json(
      { status: "error", message: "请求内容不是有效 JSON" },
      { status: 400 },
    );
  }

  if (
    typeof body.instrumentId !== "string" ||
    typeof body.symbol !== "string" ||
    typeof body.market !== "string"
  ) {
    return NextResponse.json(
      { status: "error", message: "缺少股票代码或市场信息" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    status: "needs-provider",
    message: "交易已保存；配置行情服务后即可从成交日前开始补齐 K 线。",
  });
}
