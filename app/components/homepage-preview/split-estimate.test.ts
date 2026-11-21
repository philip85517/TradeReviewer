import { describe, expect, it } from 'vitest';
import { missingReasonLabels } from './missing-reasons';

describe('split estimation evidence', () => {
  it('excludes estimates from missing inputs while retaining real gaps', () => {
    expect(missingReasonLabels(['拆股推算：SNDK 已公告 1 拆 8', '行情缺失'])).toEqual(['收盘报价']);
    expect(missingReasonLabels(['拆股后的持仓数量与成本缺失'])).toEqual(['拆股后的持仓数量与成本']);
  });
});
