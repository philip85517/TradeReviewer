import { openSqliteDatabase } from "../../../../db/sqlite";
import {
  createFxService,
  type FxService,
} from "../../../lib/fx/fx-service";
import { getSqliteStore } from "../../../lib/storage/sqlite-store";

export const runtime = "nodejs";

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function storageError(): Response {
  return json({ error: { code: "storage-unavailable", message: "汇率状态暂时不可用" } }, 503);
}

export function createFxHandlers(service: FxService) {
  return {
    async GET(request: Request) {
      void request;
      try {
        return json(await service.ensureDaily());
      } catch {
        return storageError();
      }
    },
    async POST(request: Request) {
      void request;
      try {
        return json(await service.refresh());
      } catch {
        return storageError();
      }
    },
  };
}

let defaultService: FxService | undefined;
function getDefaultService(): FxService {
  if (!defaultService) {
    defaultService = createFxService({
      store: getSqliteStore(openSqliteDatabase()),
    });
  }
  return defaultService;
}

export async function GET(request: Request): Promise<Response> {
  try {
    return await createFxHandlers(getDefaultService()).GET(request);
  } catch {
    return storageError();
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    return await createFxHandlers(getDefaultService()).POST(request);
  } catch {
    return storageError();
  }
}
