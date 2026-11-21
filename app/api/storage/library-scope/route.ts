import { openSqliteDatabase } from '../../../../db/sqlite';
import { getSqliteStore, InvalidLibraryScopeError } from '../../../lib/storage/sqlite-store';
import { isMonthlyEvidenceScope } from '../../../lib/import/monthly-statement';
export const runtime = 'nodejs';
const json = (body: unknown, status = 200) => Response.json(body, {
    status, headers: {
        'Cache-Control': 'no-store'
    }
});
export async function GET(request: Request) {
    const params = new URL(request.url).searchParams;
    const scope = {
        accountId: params.get('accountId') ?? '', instrumentId: params.get('instrumentId') ?? ''
    };
    if (params.getAll('accountId').length !== 1 || params.getAll('instrumentId').length !== 1 || !isMonthlyEvidenceScope(scope) || scope.accountId === 'all' || scope.accountId.length > 500 || scope.instrumentId.length > 200 || scope.accountId.trim() !== scope.accountId)
        return json({
            error: {
                code: 'invalid-library-scope', message: 'A single account and security are required'
            }
        }, 400);
    try {
        return json(getSqliteStore(openSqliteDatabase()).getLibraryScope(scope));
    }
    catch (error) {
        if (error instanceof InvalidLibraryScopeError)
            return json({
                error: {
                    code: 'invalid-library-scope', message: 'Library scope was not found'
                }
            }, 400);
        return json({
            error: {
                code: 'database-unavailable', message: 'Storage database is unavailable'
            }
        }, 503);
    }
}
