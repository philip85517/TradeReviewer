import { getAliases } from "../http";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  return getAliases(request);
}
