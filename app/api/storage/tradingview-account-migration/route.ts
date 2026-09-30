import { invalidAction, getAliases, getProvisional, postCommit, postPreview, postRollback, postRollbackPreview } from "./http";

export const runtime = "nodejs";

function action(request: Request): string | undefined {
  const path = new URL(request.url).pathname.replace(/\/$/, "");
  return path.split("/").at(-1);
}

export async function POST(request: Request): Promise<Response> {
  switch (action(request)) {
    case "preview": return postPreview(request);
    case "commit": return postCommit(request);
    case "rollback-preview": return postRollbackPreview(request);
    case "rollback": return postRollback(request);
    default: return invalidAction();
  }
}

export async function GET(request: Request): Promise<Response> {
  switch (action(request)) {
    case "aliases": return getAliases(request);
    case "provisional": return getProvisional(request);
    default: return invalidAction();
  }
}
