import { postCommit } from "../http";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return postCommit(request);
}
