import { afterEach, expect, it, vi } from 'vitest';
const { read, open, InvalidLibraryScopeError } = vi.hoisted(() => ({
    read: vi.fn(), open: vi.fn(), InvalidLibraryScopeError: class extends Error {
    }
}));
vi.mock('../../../lib/storage/sqlite-store', () => ({
    getSqliteStore: () => ({
        getLibraryScope: read
    }), InvalidLibraryScopeError
}));
vi.mock('../../../../db/sqlite', () => ({
    openSqliteDatabase: open
}));
import { GET } from './route';
afterEach(() => vi.resetAllMocks());
it('rejects missing/ambiguous/noncanonical scopes without opening the database', async () => {
    for (const query of ['', 'accountId=a', 'accountId=all&instrumentId=US:EDZ', 'accountId=a&instrumentId=HK:00700', 'accountId=a&accountId=b&instrumentId=US:EDZ'])
        expect((await GET(new Request('http://local/api/storage/library-scope?' + query))).status).toBe(400);
    expect(open).not.toHaveBeenCalled();
});
it('returns an explicit no-store snapshot and distinguishes invalid scope from unavailable storage', async () => {
    const scope = {
        accountId: 'a', instrumentId: 'US:EDZ'
    };
    read.mockReturnValue({
        scope, revision: 'r'
    });
    const response = await GET(new Request('http://local/api/storage/library-scope?accountId=a&instrumentId=US:EDZ'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(read).toHaveBeenCalledWith(scope);
    read.mockImplementation(() => {
        throw new InvalidLibraryScopeError();
    });
    expect((await GET(new Request('http://local/api/storage/library-scope?accountId=a&instrumentId=US:EDZ'))).status).toBe(400);
    open.mockImplementation(() => {
        throw Error('offline');
    });
    expect((await GET(new Request('http://local/api/storage/library-scope?accountId=a&instrumentId=US:EDZ'))).status).toBe(503);
});
