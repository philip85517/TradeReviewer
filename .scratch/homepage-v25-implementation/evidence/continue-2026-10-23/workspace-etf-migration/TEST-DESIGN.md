# ETF-T1 bounded test design

Owner: GPT-6.1 SOL / ultra; root independent acceptance.

Approved refs read: original source header/filter (actual HP03) 115–175, holdings (actual HP04) 257–314, filter.svg and holding-return--detail.svg (locally rendered PNG copies inspected). Draft multi-select/application and category in actual detail are the target; amount/quote fidelity, whole-page visual, real browser and DB persistence remain NOT VERIFIED. Original 101-test failure log and diagnosis remain preserved.

Mutation caught by positive original-name test: drop stored ETF metadata or map it as stock => ETF application loses target or detail category is wrong; commit draft early => applied token appears before Apply or ETF row disappears while editing stock; ignore category filter => stock application leaves ETF row. Expectations are literal target identity/category/count, not computed by a helper.

One adjacent unknown-metadata test: explicit-live fixture with ETF-looking name but no metadata remains visible unfiltered, detail category is unknown, and both stock and ETF applications exclude it. This catches broker/symbol/name-based stock/ETF guessing and a dropped unknown-qualification boundary.

Shared beforeEach/helper/product/return test immutable. Only local fixtures/fetch protocols. Existing real Workspace, host, metadata classifier, grouping, holdings and detail consumers run; external storage/HTTP use existing test boundary. No service/browser/DB initiated.

TDD: precise original-name RED selected one failed, 100 skipped. After allowed test-body migration, exact name-union command selects two only. User/dispatch forbids full suite; this overrides generic skill full-suite guidance. No custom config.
