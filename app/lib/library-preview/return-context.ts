type ReturnContext = {scrollTop:number; focusId:string|null};
const prefix = 'library-preview:return:';
function valid(value: unknown): value is ReturnContext { if (!value || typeof value !== 'object') return false; const v=value as Record<string,unknown>; return typeof v.scrollTop === 'number' && Number.isFinite(v.scrollTop) && v.scrollTop >= 0 && (v.focusId === null || typeof v.focusId === 'string'); }
export function saveReturnContext(key:string, context:ReturnContext): void { if (!valid(context)) return; try { globalThis.sessionStorage?.setItem(prefix+key,JSON.stringify(context)); } catch {} }
export function readReturnContext(key:string): ReturnContext|null { try { const raw=globalThis.sessionStorage?.getItem(prefix+key); if (!raw) return null; const value:unknown=JSON.parse(raw); return valid(value) ? value : null; } catch { return null; } }
