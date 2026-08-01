# Broker Screenshot Trade Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate, privacy-preserving browser workflow that recovers Tiger and Futu trades from one or more screenshots, requires field review, reconciles cross-source duplicates/conflicts, and commits confirmed records through the existing import transaction.

**Architecture:** A screenshot-specific pipeline validates and tiles images, runs same-origin PaddleOCR.js in a Web Worker, and feeds coordinate-aware OCR lines into broker-specific parsers. The parsers produce editable drafts rather than persisted executions; a focused review state converts confirmed wall-clock values to UTC, then a reconciliation module compares the drafts with the existing library before the existing enrichment, preview, persistence, and market-data paths resume.

**Tech Stack:** React 19, TypeScript 5.9, Vitest/Testing Library, Decimal.js, `@paddleocr/paddleocr-js@0.4.2`, `@js-temporal/polyfill@0.5.1`, browser Canvas/ImageBitmap/Web Worker APIs, vinext/Vite.

## Global Constraints

- OCR, layout detection, and field parsing execute entirely in the browser; screenshots are never uploaded.
- Accept at most 20 JPG, PNG, or WebP images per batch; each compressed image is at most 25 MiB and at most 60 million decoded pixels.
- Support only the supplied Tiger and Futu dark-theme transaction-history layout families; unknown layouts fail closed.
- Required final fields are market, canonical symbol, side, positive decimal quantity, positive decimal price, and a user-confirmed timestamp precise to the second.
- A field is low-confidence when its combined confidence is below `0.85`, when it was repaired, or when it is missing/ambiguous; every such field blocks completion until edited or explicitly confirmed.
- The duplicate candidate key is canonical market/symbol plus UTC execution timestamp to the second.
- Auto-deduplicate only across distinct source instances when side, normalized quantity, and normalized price also match; account and fee do not participate.
- Same-source same-second fills are preserved, and cross-source occurrence matching retains the maximum per-source multiplicity.
- Candidate-key matches with differing side, quantity, or price are conflicts; the user must choose existing, screenshot, or both.
- Raw images, thumbnails, crops, full OCR text, and unfinished drafts remain in memory and are never persisted.
- Existing XLS/XLSX/PDF imports and their tests must continue to pass.

---

## File Structure

### New import modules

- `app/lib/import/screenshot/contracts.ts` — OCR, image, draft, review, progress, and source-evidence types plus feature constants.
- `app/lib/import/screenshot/image-input.ts` — file validation, decoded-dimension validation, fingerprints, and stable batch/image IDs.
- `app/lib/import/screenshot/image-pipeline.ts` — long-image tiling, dark-theme preprocessing, coordinate remapping, technical overlap merging, and resource cleanup.
- `app/lib/import/screenshot/ocr-engine.ts` — narrow OCR engine interface and PaddleOCR.js adapter with same-origin model/ORT paths.
- `app/lib/import/screenshot/layout-detector.ts` — fail-closed Tiger/Futu screenshot layout detection.
- `app/lib/import/screenshot/futu-screenshot.ts` — Futu row reconstruction into editable drafts.
- `app/lib/import/screenshot/tiger-screenshot.ts` — Tiger row reconstruction into editable drafts.
- `app/lib/import/screenshot/review-state.ts` — field confirmation/edit/delete/manual-add reducer and derived blocking state.
- `app/lib/import/screenshot/time.ts` — strict wall-clock parsing and IANA-zone conversion with DST ambiguity handling.
- `app/lib/import/screenshot/to-statement-result.ts` — converts only confirmed drafts into the existing `StatementParseResult`.
- `app/lib/import/execution-reconciliation.ts` — cross-source exact matching, multiplicity, conflict analysis, and decision application.
- `app/lib/import/screenshot/__fixtures__/ocr-lines.ts` — anonymous coordinate/text fixtures representing the supported layouts.

### New UI modules

- `app/components/import/screenshot-review-dialog.tsx` — modal shell, batch summary, filters, footer actions, and conflict controls.
- `app/components/import/screenshot-trade-table.tsx` — accessible editable trade grid.
- `app/components/import/screenshot-evidence-panel.tsx` — source crop, OCR text, confidence, and confirm/edit controls.
- `app/components/import/use-screenshot-import.ts` — sequential multi-image orchestration, retry/cancel, in-memory object URL ownership, conversion, and preparation callback.

### New scripts and static assets

- `scripts/vendor-ocr-assets.mjs` — downloads verified PaddleOCR model archives and copies the installed ONNX Runtime WASM artifacts.
- `public/ocr/models/PP-OCRv5_mobile_det_onnx_infer.tar` — same-origin detection model.
- `public/ocr/models/PP-OCRv5_mobile_rec_onnx_infer.tar` — same-origin Chinese recognition model.
- `public/ocr/ort/ort-wasm*.wasm` — exact WASM files required by the installed `onnxruntime-web`.
- `public/ocr/LICENSE-PaddleOCR.txt` — upstream Apache-2.0 notice.
- `public/ocr/asset-manifest.json` — URLs, byte sizes, and SHA-256 digests for vendored resources.

### Existing files to modify

- `package.json`, `package-lock.json` — pin OCR and Temporal dependencies; add `assets:ocr`.
- `app/lib/trades/types.ts` — add optional screenshot source evidence without changing stored record version.
- `app/lib/storage/import-library.ts` and test — use the approved cross-source economic signature while preserving multiplicity.
- `app/lib/storage/import-history.ts` and test — persist optional screenshot count/input type/conflict count.
- `app/lib/import/import-preview.ts` and test — label screenshot previews and accept explicit reconciliation counts.
- `app/components/review/episode-sidebar.tsx` — add the separate multi-image screenshot input.
- `app/components/import/import-history-dialog.tsx` — show screenshot batch metadata.
- `app/components/trade-review-workspace.tsx` and test — connect review, enrichment, replacement decisions, atomic persistence, and market-data updates.
- `app/globals.css` — selected total-table review layout and responsive behavior.
- `README.md` — supported screenshot path, privacy boundary, and current limitations.

---

### Task 1: Screenshot contracts and input validation

**Files:**

- Create: `app/lib/import/screenshot/contracts.ts`
- Create: `app/lib/import/screenshot/image-input.ts`
- Test: `app/lib/import/screenshot/image-input.test.ts`
- Modify: `app/lib/trades/types.ts`

**Interfaces:**

- Produces:

```ts
export const SCREENSHOT_MAX_FILES = 20;
export const SCREENSHOT_MAX_FILE_BYTES = 25 * 1024 * 1024;
export const SCREENSHOT_MAX_PIXELS = 60_000_000;
export const SCREENSHOT_REVIEW_CONFIDENCE = 0.85;

export type ScreenshotInput = {
  id: string;
  index: number;
  file: File;
  fingerprint: string;
};

export type ScreenshotFileValidation =
  | { ok: true; files: readonly File[] }
  | {
      ok: false;
      code:
        | "empty"
        | "too-many"
        | "unsupported-type"
        | "file-too-large";
      message: string;
      fileName?: string;
    };

export type ScreenshotField =
  | "market"
  | "symbol"
  | "side"
  | "quantity"
  | "price"
  | "executedAt";

export type SourceBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OcrTextLine = {
  text: string;
  score: number;
  polygon: Array<{ x: number; y: number }>;
  sourceBounds: SourceBounds;
};

export type OcrImageResult = {
  imageId: string;
  width: number;
  height: number;
  lines: OcrTextLine[];
};

export type ScreenshotFieldEvidence = {
  rawText: string;
  confidence: number;
  repaired: boolean;
  confirmedByUser: boolean;
  sourceBounds?: SourceBounds;
};

export type ScreenshotTradeDraft = {
  id: string;
  broker: "futu" | "tiger";
  layoutVersion: string;
  imageId: string;
  sourceRowIndex: number;
  sourceBounds: SourceBounds;
  market?: "US" | "HK" | "CN-SH" | "CN-SZ";
  symbol?: string;
  sourceName?: string;
  side?: "buy" | "sell";
  quantity?: string;
  price?: string;
  sourceTimestampText?: string;
  timeDisambiguation?: "earlier" | "later";
  fieldEvidence: Partial<
    Record<ScreenshotField, ScreenshotFieldEvidence>
  >;
};

export function validateScreenshotFiles(
  files: readonly File[],
): ScreenshotFileValidation;

export function validateDecodedDimensions(
  width: number,
  height: number,
): void;

export async function buildScreenshotInputs(
  files: readonly File[],
): Promise<ScreenshotInput[]>;
```

- `TradeExecution["source"]` gains optional `inputKind`, `batchId`, `captureIndex`, and `sourceBounds`. Existing statement records remain valid.

- [ ] **Step 1: Write failing validation and source-compatibility tests**

Create exact cases:

```ts
it("accepts an ordered JPG/PNG/WebP batch", () => {
  const files = [
    new File(["a"], "01.jpg", { type: "image/jpeg" }),
    new File(["b"], "02.png", { type: "image/png" }),
    new File(["c"], "03.webp", { type: "image/webp" }),
  ];
  expect(validateScreenshotFiles(files)).toEqual({
    ok: true,
    files,
  });
});

it.each([
  ["empty", []],
  [
    "too-many",
    Array.from(
      { length: 21 },
      (_, index) =>
        new File(["x"], `${index}.jpg`, { type: "image/jpeg" }),
    ),
  ],
  ["unsupported-type", [new File(["x"], "a.heic", { type: "image/heic" })]],
])("rejects %s input before OCR", (code, files) => {
  expect(validateScreenshotFiles(files)).toMatchObject({
    ok: false,
    code,
  });
});

it("rejects a decoded image above 60 million pixels", () => {
  expect(() => validateDecodedDimensions(10_000, 6_001)).toThrow(
    "图片像素超过 6000 万",
  );
});
```

Also compile a legacy `TradeExecution` without the new optional source fields and a screenshot execution with all four new fields.

- [ ] **Step 2: Run the test to verify RED**

Run:

```bash
npx vitest run app/lib/import/screenshot/image-input.test.ts
```

Expected: FAIL because the screenshot modules and optional source fields do not exist.

- [ ] **Step 3: Implement the contracts and file validation**

Use MIME type first and a lowercase extension fallback only for browsers that provide an empty MIME type. Reject a file whose declared non-empty MIME type is unsupported even if the extension looks valid.

Generate each `imageId` as `screenshot-image:${fingerprintBytes(bytes)}` and the batch ID from the ordered image fingerprints, so selection order is stable and duplicate files have stable identity.

- [ ] **Step 4: Run focused tests and type checking**

Run:

```bash
npx vitest run app/lib/import/screenshot/image-input.test.ts
npm run typecheck
```

Expected: PASS with no diagnostics.

- [ ] **Step 5: Commit**

```bash
git add app/lib/import/screenshot/contracts.ts app/lib/import/screenshot/image-input.ts app/lib/import/screenshot/image-input.test.ts app/lib/trades/types.ts
git commit -m "feat: define screenshot import inputs"
```

---

### Task 2: Long-image pipeline and same-origin PaddleOCR adapter

**Files:**

- Create: `app/lib/import/screenshot/image-pipeline.ts`
- Create: `app/lib/import/screenshot/image-pipeline.test.ts`
- Create: `app/lib/import/screenshot/ocr-engine.ts`
- Create: `app/lib/import/screenshot/ocr-engine.test.ts`
- Create: `scripts/vendor-ocr-assets.mjs`
- Create: `public/ocr/LICENSE-PaddleOCR.txt`
- Create: `public/ocr/asset-manifest.json`
- Create: `public/ocr/models/PP-OCRv5_mobile_det_onnx_infer.tar`
- Create: `public/ocr/models/PP-OCRv5_mobile_rec_onnx_infer.tar`
- Create: `public/ocr/ort/ort-wasm*.wasm`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**

- Consumes: `OcrTextLine`, `OcrImageResult`, `SourceBounds`, screenshot resource limits.
- Produces:

```ts
export type VerticalTile = {
  index: number;
  y: number;
  height: number;
};

export function planVerticalTiles(
  imageHeight: number,
  maxTileHeight?: number,
  overlap?: number,
): VerticalTile[];

export function mergeTechnicalDuplicateLines(
  lines: readonly OcrTextLine[],
): OcrTextLine[];

export type LocalOcrEngine = {
  recognize(input: Blob): Promise<{
    width: number;
    height: number;
    lines: OcrTextLine[];
  }>;
  dispose(): Promise<void>;
};

export async function createLocalOcrEngine(): Promise<LocalOcrEngine>;

export async function recognizeScreenshot(
  input: ScreenshotInput,
  engine: LocalOcrEngine,
  options: {
    signal: AbortSignal;
    onProgress(completedTiles: number, totalTiles: number): void;
  },
): Promise<OcrImageResult>;
```

- [ ] **Step 1: Write failing pure pipeline tests**

Cover the supplied long-image heights:

```ts
it.each([13_574, 7_409, 13_646])(
  "covers every source pixel of a %i px screenshot",
  (height) => {
    const tiles = planVerticalTiles(height, 2_048, 192);
    expect(tiles[0]).toEqual({ index: 0, y: 0, height: 2_048 });
    expect(tiles.at(-1)!.y + tiles.at(-1)!.height).toBe(height);
    for (let y = 0; y < height; y += 1) {
      expect(
        tiles.some((tile) => y >= tile.y && y < tile.y + tile.height),
      ).toBe(true);
    }
  },
);

it("merges only same-text lines with overlapping source coordinates", () => {
  expect(
    mergeTechnicalDuplicateLines([
      line("NVDA", { x: 120, y: 1_900, width: 90, height: 30 }, 0.91),
      line("NVDA", { x: 121, y: 1_901, width: 89, height: 30 }, 0.97),
      line("NVDA", { x: 120, y: 2_100, width: 90, height: 30 }, 0.96),
    ]),
  ).toHaveLength(2);
});
```

Add a cancellation test with an injected tile recognizer that confirms no later tiles run after `AbortController.abort()`, and a cleanup test that asserts every decoded bitmap/object URL is released exactly once.

- [ ] **Step 2: Run the pipeline tests to verify RED**

Run:

```bash
npx vitest run app/lib/import/screenshot/image-pipeline.test.ts
```

Expected: FAIL because the pipeline is missing.

- [ ] **Step 3: Implement tiling, preprocessing, remapping, and cleanup**

Use defaults `maxTileHeight = 2_048` and `overlap = 192`. Convert each tile to grayscale, invert only when sampled luminance shows a dark background, apply a deterministic contrast stretch, and keep coordinates unchanged. Map OCR polygons and bounds back by adding the tile `y` offset before technical duplicate merging.

Decode one source image at a time with `createImageBitmap`; fall back to `HTMLImageElement.decode()` when unavailable. Never retain a processed tile after its recognition promise settles.

- [ ] **Step 4: Install pinned dependencies and write the failing adapter test**

Run:

```bash
npm install @paddleocr/paddleocr-js@0.4.2 @js-temporal/polyfill@0.5.1
```

The test injects a fake `PaddleOCR.create` and asserts these exact options:

```ts
expect(create).toHaveBeenCalledWith(
  expect.objectContaining({
    textDetectionModelName: "PP-OCRv5_mobile_det",
    textDetectionModelAsset: {
      url: "/ocr/models/PP-OCRv5_mobile_det_onnx_infer.tar",
    },
    textRecognitionModelName: "PP-OCRv5_mobile_rec",
    textRecognitionModelAsset: {
      url: "/ocr/models/PP-OCRv5_mobile_rec_onnx_infer.tar",
    },
    worker: true,
    ortOptions: expect.objectContaining({
      backend: "wasm",
      wasmPaths: "/ocr/ort/",
      numThreads: 1,
      simd: true,
    }),
  }),
);
```

Also assert `poly`, `text`, and `score` map to `OcrTextLine`, and `dispose()` forwards exactly once.

- [ ] **Step 5: Run the adapter test to verify RED**

Run:

```bash
npx vitest run app/lib/import/screenshot/ocr-engine.test.ts
```

Expected: FAIL because the adapter is missing.

- [ ] **Step 6: Implement and vendor same-origin OCR assets**

`scripts/vendor-ocr-assets.mjs` must download and verify:

```js
const models = [
  {
    file: "PP-OCRv5_mobile_det_onnx_infer.tar",
    url: "https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv5_mobile_det_onnx_infer.tar",
    bytes: 4_843_520,
    sha256: "781056046c9ed77a15c94681605db6a0f62317c2e9cce6931c71da2478d4bc30",
  },
  {
    file: "PP-OCRv5_mobile_rec_onnx_infer.tar",
    url: "https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv5_mobile_rec_onnx_infer.tar",
    bytes: 16_701_440,
    sha256: "f7e792bc836f36e7ef895ad47c426d75b0b75b1650caa6d63fe9418441ffba8c",
  },
];
```

Copy every `node_modules/onnxruntime-web/dist/ort-wasm*.wasm` file into `public/ocr/ort/`, record its byte size and SHA-256 in `asset-manifest.json`, and fail on an empty match. Download to a temporary filename and rename only after byte-size and digest validation.

Add:

```json
"assets:ocr": "node scripts/vendor-ocr-assets.mjs"
```

Do not run this script automatically in `postinstall`; committed verified assets make installs and production builds reproducible without downloading models.

- [ ] **Step 7: Run focused tests, asset verification, and an early build**

Run:

```bash
npm run assets:ocr
npx vitest run app/lib/import/screenshot/image-pipeline.test.ts app/lib/import/screenshot/ocr-engine.test.ts
npm run typecheck
npm run build
```

Expected: all commands exit 0; the build emits the PaddleOCR Worker; `asset-manifest.json` matches every committed model/WASM file.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json scripts/vendor-ocr-assets.mjs public/ocr app/lib/import/screenshot/image-pipeline.ts app/lib/import/screenshot/image-pipeline.test.ts app/lib/import/screenshot/ocr-engine.ts app/lib/import/screenshot/ocr-engine.test.ts
git commit -m "feat: run screenshot OCR locally"
```

---

### Task 3: Fail-closed Futu and Tiger layout parsers

**Files:**

- Create: `app/lib/import/screenshot/layout-detector.ts`
- Create: `app/lib/import/screenshot/layout-detector.test.ts`
- Create: `app/lib/import/screenshot/futu-screenshot.ts`
- Create: `app/lib/import/screenshot/futu-screenshot.test.ts`
- Create: `app/lib/import/screenshot/tiger-screenshot.ts`
- Create: `app/lib/import/screenshot/tiger-screenshot.test.ts`
- Create: `app/lib/import/screenshot/__fixtures__/ocr-lines.ts`

**Interfaces:**

- Consumes: `OcrImageResult`.
- Produces:

```ts
export type ScreenshotLayoutDetection =
  | {
      matched: true;
      broker: "futu" | "tiger";
      layoutVersion: "futu-orders-dark-v1" | "tiger-orders-dark-v1";
      confidence: number;
    }
  | {
      matched: false;
      code: "unsupported-screenshot-layout";
      message: string;
    };

export function detectScreenshotLayout(
  image: OcrImageResult,
): ScreenshotLayoutDetection;

export function parseFutuScreenshot(
  image: OcrImageResult,
): ScreenshotTradeDraft[];

export function parseTigerScreenshot(
  image: OcrImageResult,
): ScreenshotTradeDraft[];
```

- [ ] **Step 1: Build anonymous OCR fixtures**

Create a small `ocrLine()` factory and frozen fixtures containing only synthetic account values and representative headers/rows:

```ts
export const FUTU_SCREENSHOT_OCR: OcrImageResult = image(
  "futu-1",
  1_220,
  2_000,
  [
    ocrLine("订单记录", 42, 110, 180, 30),
    ocrLine("FUTU HK", 470, 190, 120, 24),
    ocrLine("订单状态", 20, 310, 150, 22),
    ocrLine("名称/代码", 245, 310, 180, 22),
    ocrLine("数量/价格", 760, 310, 180, 22),
    ocrLine("成交时间", 1_020, 310, 170, 22),
    ocrLine("卖出", 20, 390, 80, 24),
    ocrLine("全部成交", 20, 425, 120, 20),
    ocrLine("思摩尔国际", 245, 390, 180, 24),
    ocrLine("06969", 245, 425, 100, 20),
    ocrLine("4,000", 800, 390, 100, 24),
    ocrLine("市价", 800, 425, 80, 20),
    ocrLine("24/06/05", 1_025, 390, 130, 22),
    ocrLine("14:39:25", 1_025, 425, 130, 22),
  ],
);
```

Add an equivalent Tiger fixture with Tiger-specific title/account/header evidence and at least two rows, including one repaired numeric value with score `0.72`.

- [ ] **Step 2: Write and run failing detector tests**

Required cases:

```ts
expect(detectScreenshotLayout(FUTU_SCREENSHOT_OCR)).toMatchObject({
  matched: true,
  broker: "futu",
  layoutVersion: "futu-orders-dark-v1",
});

expect(detectScreenshotLayout(TIGER_SCREENSHOT_OCR)).toMatchObject({
  matched: true,
  broker: "tiger",
  layoutVersion: "tiger-orders-dark-v1",
});

expect(detectScreenshotLayout(image("unknown", 800, 1200, [
  ocrLine("买入", 10, 10, 50, 20),
]))).toEqual({
  matched: false,
  code: "unsupported-screenshot-layout",
  message: "暂不支持该截图版式，请使用老虎或富途的交易历史截图",
});
```

Run:

```bash
npx vitest run app/lib/import/screenshot/layout-detector.test.ts
```

Expected: FAIL because the detector is absent.

- [ ] **Step 3: Implement the detector**

Require multiple independent signals:

- Futu: “订单记录”, a Futu/account marker, at least three expected column headers, and at least one completed buy/sell row.
- Tiger: Tiger/account marker, transaction/order-history heading, expected headers/relative columns, and at least one buy/sell row.

If both score above the threshold or neither does, return unsupported. Never select a broker from “买入/卖出” alone.

- [ ] **Step 4: Write and run failing broker parser tests**

Assert exact normalized drafts:

```ts
expect(parseFutuScreenshot(FUTU_SCREENSHOT_OCR)[0]).toMatchObject({
  broker: "futu",
  layoutVersion: "futu-orders-dark-v1",
  market: "HK",
  symbol: "6969",
  sourceName: "思摩尔国际",
  side: "sell",
  quantity: "4000",
  price: undefined,
  sourceTimestampText: "24/06/05 14:39:25",
});
```

The `price` is deliberately absent for “市价” and therefore blocks review rather than inventing a fill price. Add a second fixture row with an actual numeric price and assert it parses.

For Tiger, assert symbol/market, Chinese or English name, side, quantity, numeric price, timestamp, source row index, union bounds, and evidence confidence. Also assert:

- navigation/header/footer text produces no draft;
- a partially recognized trade produces one incomplete draft, not zero and not a guessed value;
- two same-second rows in one image produce two drafts;
- repaired `O/0`, `I/1`, or punctuation sets `repaired: true`.

Run:

```bash
npx vitest run app/lib/import/screenshot/futu-screenshot.test.ts app/lib/import/screenshot/tiger-screenshot.test.ts
```

Expected: FAIL because parsers are missing.

- [ ] **Step 5: Implement shared row anchoring and both parsers**

Anchor rows on buy/sell labels, build vertical bands from midpoints between anchors, and assign OCR lines by normalized x coordinate inside each band. Keep Futu and Tiger column maps in their own files. Normalize decimals with Decimal.js, canonicalize symbols through `canonicalInstrumentSymbol`, and union the evidence bounds used by each draft.

The parser may repair only an explicit tested confusion rule; every repair lowers combined confidence below `0.85` and marks `repaired: true`.

- [ ] **Step 6: Run parser tests and commit**

Run:

```bash
npx vitest run app/lib/import/screenshot/layout-detector.test.ts app/lib/import/screenshot/futu-screenshot.test.ts app/lib/import/screenshot/tiger-screenshot.test.ts
npm run typecheck
```

Expected: PASS.

```bash
git add app/lib/import/screenshot/layout-detector.ts app/lib/import/screenshot/layout-detector.test.ts app/lib/import/screenshot/futu-screenshot.ts app/lib/import/screenshot/futu-screenshot.test.ts app/lib/import/screenshot/tiger-screenshot.ts app/lib/import/screenshot/tiger-screenshot.test.ts app/lib/import/screenshot/__fixtures__/ocr-lines.ts
git commit -m "feat: parse Tiger and Futu screenshots"
```

---

### Task 4: Review state, strict time conversion, and statement conversion

**Files:**

- Create: `app/lib/import/screenshot/time.ts`
- Create: `app/lib/import/screenshot/time.test.ts`
- Create: `app/lib/import/screenshot/review-state.ts`
- Create: `app/lib/import/screenshot/review-state.test.ts`
- Create: `app/lib/import/screenshot/to-statement-result.ts`
- Create: `app/lib/import/screenshot/to-statement-result.test.ts`

**Interfaces:**

- Consumes: `ScreenshotTradeDraft`, batch/image IDs, account selection.
- Produces:

```ts
export type WallClockResult =
  | { ok: true; executedAt: string }
  | {
      ok: false;
      code:
        | "invalid-wall-clock"
        | "nonexistent-wall-clock"
        | "ambiguous-wall-clock";
    };

export function wallClockToInstant(
  sourceText: string,
  timeZone: string,
  disambiguation?: "earlier" | "later",
): WallClockResult;

export type ScreenshotReviewAction =
  | { type: "confirm-field"; draftId: string; field: ScreenshotField }
  | {
      type: "edit-field";
      draftId: string;
      field: ScreenshotField;
      value: string;
    }
  | { type: "delete-draft"; draftId: string }
  | { type: "add-draft"; imageId: string }
  | { type: "set-time-zone"; timeZone: string }
  | {
      type: "set-time-disambiguation";
      draftId: string;
      value: "earlier" | "later";
    }
  | { type: "set-account"; accountId: string; accountLabel: string };

export type ScreenshotReviewState = {
  batchId: string;
  drafts: ScreenshotTradeDraft[];
  deletedDraftIds: Set<string>;
  sourceTimezone?: string;
  account?: { id: string; label: string };
};

export type ScreenshotReviewBlocker = {
  code:
    | "missing-timezone"
    | "missing-account"
    | "invalid-field"
    | "unconfirmed-field"
    | "ambiguous-time";
  draftId?: string;
  field?: ScreenshotField;
  message: string;
};

export function screenshotReviewReducer(
  state: ScreenshotReviewState,
  action: ScreenshotReviewAction,
): ScreenshotReviewState;

export function reviewBlockers(
  state: ScreenshotReviewState,
): ScreenshotReviewBlocker[];

export function toStatementParseResult(
  state: ScreenshotReviewState,
): StatementParseResult;
```

- [ ] **Step 1: Write strict time tests and verify RED**

Use:

```ts
it("converts a confirmed HK wall clock to an exact UTC second", () => {
  expect(
    wallClockToInstant(
      "24/06/05 14:39:25",
      "Asia/Hong_Kong",
    ),
  ).toEqual({
    ok: true,
    executedAt: "2024-06-05T06:39:25Z",
  });
});

it("rejects nonexistent New York wall time", () => {
  expect(
    wallClockToInstant(
      "24/03/10 02:30:00",
      "America/New_York",
    ),
  ).toEqual({ ok: false, code: "nonexistent-wall-clock" });
});

it("requires earlier/later for repeated New York wall time", () => {
  expect(
    wallClockToInstant(
      "24/11/03 01:30:00",
      "America/New_York",
    ),
  ).toEqual({ ok: false, code: "ambiguous-wall-clock" });
});
```

Run:

```bash
npx vitest run app/lib/import/screenshot/time.test.ts
```

Expected: FAIL.

- [ ] **Step 2: Implement time parsing with Temporal**

Accept only `YY/MM/DD HH:mm:ss`, `YYYY/MM/DD HH:mm:ss`, and the same date forms with `-`. Map two-digit years to `2000..2099`. Use `Temporal.ZonedDateTime.from()` and compare `"earlier"`/`"later"` round trips to distinguish nonexistent and repeated local times. Output `Temporal.Instant.toString({ smallestUnit: "second" })`.

- [ ] **Step 3: Write reducer and conversion tests and verify RED**

Exact behaviors:

- score `0.8499` blocks, score `0.85` does not;
- `repaired: true` blocks regardless of score;
- explicit confirmation clears only the selected field blocker;
- editing normalizes quantity/price and marks the field user-confirmed;
- deleting removes one row and updates counts;
- manual add creates a blank row tied to the selected image;
- no timezone or account blocks the batch;
- unknown/ambiguous time blocks only the affected row;
- only a fully confirmed state converts to `StatementParseResult`;
- converted records use `fee: "0"`, `timePrecision: "second"`, `inputKind: "screenshot"`, image fingerprint, batch ID, capture index, bounds, original timestamp, and confirmed timezone.

Run:

```bash
npx vitest run app/lib/import/screenshot/review-state.test.ts app/lib/import/screenshot/to-statement-result.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement reducer, blockers, and conversion**

Keep raw files and URLs out of `ScreenshotReviewState`; the hook owns them separately. `toStatementParseResult` throws if `reviewBlockers(state)` is non-empty so no alternate caller can bypass UI validation.

Use the parsed page-header account suffix when present. Otherwise require the reducer’s explicit existing/new account selection.

- [ ] **Step 5: Run focused tests and commit**

Run:

```bash
npx vitest run app/lib/import/screenshot/time.test.ts app/lib/import/screenshot/review-state.test.ts app/lib/import/screenshot/to-statement-result.test.ts
npm run typecheck
```

Expected: PASS.

```bash
git add app/lib/import/screenshot/time.ts app/lib/import/screenshot/time.test.ts app/lib/import/screenshot/review-state.ts app/lib/import/screenshot/review-state.test.ts app/lib/import/screenshot/to-statement-result.ts app/lib/import/screenshot/to-statement-result.test.ts
git commit -m "feat: validate screenshot trade drafts"
```

---

### Task 5: Cross-source reconciliation and multiplicity-safe storage

**Files:**

- Create: `app/lib/import/execution-reconciliation.ts`
- Create: `app/lib/import/execution-reconciliation.test.ts`
- Modify: `app/lib/storage/import-library.ts`
- Modify: `app/lib/storage/import-library.test.ts`

**Interfaces:**

- Consumes: current and incoming `TradeExecution[]`.
- Produces:

```ts
export type ReconciliationDecision =
  | "keep-existing"
  | "use-incoming"
  | "keep-both";

export type ExecutionConflict = {
  id: string;
  candidateKey: string;
  existing: TradeExecution[];
  incoming: TradeExecution[];
};

export type ExecutionReconciliation = {
  acceptedIncoming: TradeExecution[];
  automaticReplacementIds: string[];
  duplicates: Array<{
    kept: TradeExecution;
    skipped: TradeExecution;
  }>;
  conflicts: ExecutionConflict[];
};

export function reconcileExecutions(
  current: readonly TradeExecution[],
  incoming: readonly TradeExecution[],
): ExecutionReconciliation;

export function applyReconciliationDecisions(
  current: readonly TradeExecution[],
  reconciliation: ExecutionReconciliation,
  decisions: ReadonlyMap<string, ReconciliationDecision>,
): {
  currentAfterReplacements: TradeExecution[];
  incomingToMerge: TradeExecution[];
};
```

- [ ] **Step 1: Write failing candidate/core/multiplicity tests**

Create execution builders that vary source fingerprint independently from account and fee. Required assertions:

```ts
it("auto-deduplicates across sources when symbol, second, side, quantity, and price match", () => {
  const existing = fill({
    fingerprint: "xlsx-a",
    accountId: "account-a",
    fee: "2.05",
  });
  const screenshot = fill({
    fingerprint: "image-b",
    accountId: "account-b",
    fee: "0",
  });
  const result = reconcileExecutions([existing], [screenshot]);
  expect(result.acceptedIncoming).toEqual([]);
  expect(result.automaticReplacementIds).toEqual([]);
  expect(result.duplicates).toEqual([
    { kept: existing, skipped: screenshot },
  ]);
  expect(result.conflicts).toEqual([]);
});

it.each(["side", "quantity", "price"] as const)(
  "reports a conflict when %s differs",
  (field) => {
    const result = reconcileExecutions(
      [fill({ fingerprint: "pdf" })],
      [fill({ fingerprint: "image", [field]: changed[field] })],
    );
    expect(result.conflicts).toHaveLength(1);
    expect(result.duplicates).toHaveLength(0);
  },
);
```

Also cover:

- same fingerprint + identical values keeps both;
- two identical rows in source A and one in source B retain two;
- one row in A and two in B retain two regardless of import order;
- an incoming statement record replaces an otherwise duplicate screenshot record when it has richer account/fee evidence, and reports the old screenshot ID in `automaticReplacementIds`;
- canonical `HK:06969` and `HK:6969` match;
- millisecond differences within different ISO spellings normalize to the same exact second only when the stored instants are equal; never round a non-zero millisecond;
- exact matches are paired before deciding whether remaining same-candidate rows conflict;
- richer statement fee/account/name wins the automatic duplicate pair.

- [ ] **Step 2: Run reconciliation tests to verify RED**

Run:

```bash
npx vitest run app/lib/import/execution-reconciliation.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement reconciliation**

Use:

```ts
candidateKey =
  canonicalInstrumentId(symbol, market) + "|" + exactInstant;

coreKey = [
  side,
  new Decimal(quantity).toString(),
  new Decimal(price).toString(),
].join("|");
```

`sourceInstanceId` is `fileFingerprint`; fall back to broker + file name only when both exist; otherwise use the execution ID so legacy records without source evidence are never accidentally collapsed.

Within each candidate group:

1. group by core key;
2. group each core key by source instance;
3. retain the largest source-instance multiplicity;
4. pair current and incoming exact matches deterministically;
5. select the richer representative for every automatic pair, placing an incoming winner in `acceptedIncoming` and its current loser in `automaticReplacementIds`;
6. create a conflict only for unmatched incoming rows when another source instance has unmatched rows with a different core key.

- [ ] **Step 4: Write failing decision and storage regression tests**

Assert:

- `keep-existing` skips only incoming conflict rows;
- `use-incoming` returns exact existing IDs for removal and incoming rows for merge;
- `keep-both` retains both;
- automatic richer-source replacements remove `automaticReplacementIds` without requiring a conflict decision;
- missing decision throws;
- `mergeExecutions()` removes account and fee from its economic signature, retains maximum per-source multiplicity, preserves richer statement metadata, and keeps different-core conflicts;
- `loadImportedExecutions()` never silently deletes conflict records.

Run:

```bash
npx vitest run app/lib/import/execution-reconciliation.test.ts app/lib/storage/import-library.test.ts
```

Expected: FAIL on the new behavior.

- [ ] **Step 5: Implement decisions and update storage merge**

Keep deterministic ordering by execution time, source order/row, then ID. Never mutate caller arrays or execution objects.

- [ ] **Step 6: Run focused tests and commit**

Run:

```bash
npx vitest run app/lib/import/execution-reconciliation.test.ts app/lib/storage/import-library.test.ts
npm run typecheck
```

Expected: PASS.

```bash
git add app/lib/import/execution-reconciliation.ts app/lib/import/execution-reconciliation.test.ts app/lib/storage/import-library.ts app/lib/storage/import-library.test.ts
git commit -m "feat: reconcile cross-source executions"
```

---

### Task 6: Total-table screenshot review UI

**Files:**

- Create: `app/components/import/screenshot-review-dialog.tsx`
- Create: `app/components/import/screenshot-trade-table.tsx`
- Create: `app/components/import/screenshot-evidence-panel.tsx`
- Create: `app/components/import/screenshot-review-dialog.test.tsx`
- Modify: `app/globals.css`

**Interfaces:**

- Consumes:

```ts
export type ScreenshotReviewImage = {
  id: string;
  fileName: string;
  previewUrl: string;
  width: number;
  height: number;
  state: "queued" | "recognizing" | "complete" | "needs-review" | "failed";
  completedTiles: number;
  totalTiles: number;
  tradeCount: number;
  issueCount: number;
  error?: string;
};
```

- Produces:

```ts
type ScreenshotReviewDialogProps = {
  state: ScreenshotReviewState;
  images: ScreenshotReviewImage[];
  reconciliation?: ExecutionReconciliation;
  decisions: ReadonlyMap<string, ReconciliationDecision>;
  onAction(action: ScreenshotReviewAction): void;
  onDecision(conflictId: string, decision: ReconciliationDecision): void;
  onRetryImage(imageId: string): void;
  onRemoveImage(imageId: string): void;
  onCancel(): void;
  onCompleteReview(): void;
};
```

- [ ] **Step 1: Write failing accessible interaction tests**

Test the approved layout and exact behaviors:

- dialog title “从截图恢复交易”;
- left image list announces progress and issue counts;
- summary shows total, pending, duplicate, and conflict counts;
- filter buttons “全部”, “待确认”, “冲突”, “自动重复” change visible rows;
- selecting a low-confidence cell opens the source evidence panel with image crop, raw OCR text, and score;
- “确认识别值” dispatches `confirm-field`;
- editing price dispatches `edit-field` with the draft and field IDs;
- delete requires row-specific accessible label;
- “手工补录成交” dispatches `add-draft`;
- three conflict radio choices dispatch exact decision values;
- failed image exposes retry/remove without clearing completed images;
- Escape/cancel calls `onCancel`;
- completion button is disabled for any blocker or missing conflict decision.

Representative test:

```tsx
await user.click(
  screen.getByRole("cell", { name: "NVDA 价格 114.8，待确认" }),
);
expect(
  screen.getByRole("complementary", { name: "截图识别依据" }),
).toHaveTextContent("OCR 原文：114.8?");

await user.click(screen.getByRole("button", { name: "确认识别值" }));
expect(onAction).toHaveBeenCalledWith({
  type: "confirm-field",
  draftId: "draft-nvda",
  field: "price",
});
```

- [ ] **Step 2: Run component test to verify RED**

Run:

```bash
npx vitest run app/components/import/screenshot-review-dialog.test.tsx
```

Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement the three focused components**

Use the selected A layout:

- left fixed-width image rail;
- center scrollable semantic table;
- right evidence drawer opened only for the selected field/conflict;
- sticky summary/filter header and action footer;
- no client-side virtualization in the first version.

For the crop, render the in-memory object URL inside an overflow-hidden frame and derive scale/translation from the image dimensions and `SourceBounds`. Never turn a crop into a data URL or storage value.

- [ ] **Step 4: Add responsive and state styling**

On narrow screens, keep the table horizontally scrollable and make the evidence drawer a bottom sheet. Use existing modal colors, buttons, focus outlines, and reduced-motion rules. Add visually distinct but non-color-only status icons/text for low-confidence, conflict, duplicate, and failed states.

- [ ] **Step 5: Run focused tests, lint, and commit**

Run:

```bash
npx vitest run app/components/import/screenshot-review-dialog.test.tsx
npm run typecheck
npm run lint
```

Expected: PASS with no accessibility-query fallbacks.

```bash
git add app/components/import/screenshot-review-dialog.tsx app/components/import/screenshot-trade-table.tsx app/components/import/screenshot-evidence-panel.tsx app/components/import/screenshot-review-dialog.test.tsx app/globals.css
git commit -m "feat: add screenshot trade review table"
```

---

### Task 7: Multi-image orchestration and existing import workflow integration

**Files:**

- Create: `app/components/import/use-screenshot-import.ts`
- Create: `app/components/import/use-screenshot-import.test.tsx`
- Modify: `app/components/review/episode-sidebar.tsx`
- Modify: `app/components/trade-review-workspace.tsx`
- Modify: `app/components/trade-review-workspace.test.tsx`
- Modify: `app/lib/import/import-preview.ts`
- Modify: `app/lib/import/import-preview.test.ts`
- Modify: `app/lib/storage/import-history.ts`
- Modify: `app/lib/storage/import-history.test.ts`
- Modify: `app/components/import/import-history-dialog.tsx`
- Modify: `app/lib/storage/import-transaction.test.ts`

**Interfaces:**

- Consumes all prior modules.
- Produces:

```ts
export type PreparedScreenshotImport = {
  parsed: StatementParseResult;
  reconciliation: ExecutionReconciliation;
  decisions: ReadonlyMap<string, ReconciliationDecision>;
  fileName: string;
  captureCount: number;
};

export function useScreenshotImport(options: {
  currentExecutions(): TradeExecution[];
  async onPrepared(
    prepared: PreparedScreenshotImport,
  ): Promise<void>;
}): {
  open: boolean;
  state: ScreenshotReviewState | null;
  images: ScreenshotReviewImage[];
  reconciliation?: ExecutionReconciliation;
  decisions: ReadonlyMap<string, ReconciliationDecision>;
  start(files: File[]): Promise<void>;
  retryImage(imageId: string): Promise<void>;
  removeImage(imageId: string): void;
  dispatch(action: ScreenshotReviewAction): void;
  decide(conflictId: string, decision: ReconciliationDecision): void;
  completeReview(): Promise<void>;
  cancel(): void;
};
```

- `ImportPreview` gains `sourceKind: "statement" | "screenshot"` and optional explicit `duplicateTradeCount`/`conflictTradeCount`.
- `ImportHistoryEntry` gains optional `sourceKind`, `captureCount`, and `conflictTradeCount`; old stored entries default to statement/zero.

- [ ] **Step 1: Write failing hook tests**

With injected fake decoder/OCR engine, assert:

- images run sequentially in selection order;
- progress updates do not reorder the list;
- one image failure leaves completed drafts intact;
- retry replaces only the failed image result;
- remove releases that image URL and drafts;
- cancel aborts recognition, disposes the engine once, revokes every URL once, and never invokes `onPrepared`;
- editing after reconciliation recomputes duplicate/conflict analysis;
- completing with blockers does nothing;
- completing a valid state emits `PreparedScreenshotImport`.

Run:

```bash
npx vitest run app/components/import/use-screenshot-import.test.tsx
```

Expected: FAIL.

- [ ] **Step 2: Implement the orchestration hook**

Keep raw `File`, object URL, decoded size, and cleanup functions in refs owned by the hook. Store only serializable draft/review state in the reducer. Process one image at a time and lazily create one OCR engine per open session.

When a supported image completes:

1. detect layout;
2. call only the matching parser;
3. append drafts in image order;
4. derive review blockers;
5. reconcile any fully normalized rows with the latest execution snapshot.

On cancel/unmount, abort, dispose, revoke, and clear all refs.

- [ ] **Step 3: Write failing sidebar and workspace integration tests**

Required UI flow:

```tsx
const screenshotInput = screen.getByLabelText("从截图恢复交易");
expect(screenshotInput).toHaveAttribute(
  "accept",
  "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp",
);
expect(screenshotInput).toHaveAttribute("multiple");
```

Then upload two fake images, resolve injected OCR, edit/confirm fields, set account/timezone, resolve a conflict, complete review, and assert the existing “确认导入交易记录” dialog receives:

- source label “富途截图” or “老虎截图”;
- batch name “2 张交易截图”;
- explicit duplicate and conflict counts;
- only reconciliation-approved records.

After final confirmation, assert:

- `use-incoming` removed only chosen existing IDs;
- automatic duplicates did not increase library length;
- `keep-both` preserved both conflicting records;
- `persistImportBatch(previous, next, history)` receives the original pre-import array for rollback;
- market-data update starts only for the final imported instrument/range;
- old XLSX/PDF input remains single-file and unchanged.

Run:

```bash
npx vitest run app/components/trade-review-workspace.test.tsx
```

Expected: FAIL on the missing screenshot entry/workflow.

- [ ] **Step 4: Add the independent sidebar entry and workspace flow**

Keep “导入交易记录” unchanged. Add a sibling label/button “从截图恢复交易” with a separate hidden `multiple` image input.

After `completeReview()`:

1. convert reviewed drafts;
2. apply automatic richer-source replacements and conflict decisions to derive `currentAfterReplacements` and `incomingToMerge`;
3. enrich only `incomingToMerge`;
4. create the normal import preview with screenshot source/count metadata;
5. on final confirm, merge against `currentAfterReplacements`;
6. persist using the original current array as rollback input;
7. start normal market-data range expansion.

Do not persist anything when the user only completes OCR review but cancels the existing import preview.

- [ ] **Step 5: Write failing preview/history compatibility tests**

Assert:

- screenshot preview label and counts;
- statement preview remains unchanged;
- old history JSON parses with `sourceKind: "statement"`, zero capture/conflict counts;
- new screenshot history round-trips;
- history dialog shows “3 张截图” and handled conflict count only for screenshot entries;
- persistence failure restores executions and history after a replacement decision.

Run:

```bash
npx vitest run app/lib/import/import-preview.test.ts app/lib/storage/import-history.test.ts app/lib/storage/import-transaction.test.ts
```

Expected: FAIL on new metadata/rollback case.

- [ ] **Step 6: Implement preview/history changes**

Keep all new storage fields optional and continue reading version 1 data. Do not store image names individually, OCR text, preview URLs, bounds in history, or any raw review state.

- [ ] **Step 7: Run focused integration tests and commit**

Run:

```bash
npx vitest run app/components/import/use-screenshot-import.test.tsx app/components/trade-review-workspace.test.tsx app/lib/import/import-preview.test.ts app/lib/storage/import-history.test.ts app/lib/storage/import-transaction.test.ts
npm run typecheck
npm run lint
```

Expected: PASS.

```bash
git add app/components/import/use-screenshot-import.ts app/components/import/use-screenshot-import.test.tsx app/components/review/episode-sidebar.tsx app/components/trade-review-workspace.tsx app/components/trade-review-workspace.test.tsx app/lib/import/import-preview.ts app/lib/import/import-preview.test.ts app/lib/storage/import-history.ts app/lib/storage/import-history.test.ts app/components/import/import-history-dialog.tsx app/lib/storage/import-transaction.test.ts
git commit -m "feat: integrate screenshot trade recovery"
```

---

### Task 8: Privacy documentation, regression verification, and local sample acceptance

**Files:**

- Modify: `README.md`
- Modify only if sample findings expose a tested defect: the focused implementation/test file responsible for that defect.

**Interfaces:**

- No new public interface.
- Produces verified documentation and release evidence.

- [ ] **Step 1: Write the README change first**

Document:

- the separate screenshot entry;
- supported Tiger/Futu screenshot layouts and JPG/PNG/WebP multi-select;
- first-use same-origin OCR model download and browser-local inference;
- screenshots/OCR drafts are not persisted or uploaded;
- screenshot account/timezone review and low-confidence blocking;
- unsupported layout and OCR accuracy limitations.

- [ ] **Step 2: Run privacy/static-source checks**

Run:

```bash
rg -n "paddle-model-ecology|cdn\\.jsdelivr|https?://" app public/ocr/asset-manifest.json
rg -n "localStorage|sessionStorage|indexedDB" app/lib/import/screenshot app/components/import/use-screenshot-import.ts
```

Expected:

- no runtime OCR code points to an external model/WASM URL;
- the only model origin URL is provenance inside `asset-manifest.json`;
- screenshot modules contain no storage writes.

- [ ] **Step 3: Run the complete automated suite**

Run:

```bash
npm run test:unit
npm run typecheck
npm run lint
npm run build
npm test
```

Expected: every command exits 0 with zero failed tests and no build/type/lint errors.

- [ ] **Step 4: Start the production-equivalent local app**

Run:

```bash
npm run dev
```

Use the in-app browser and upload the three user-provided files from their original local paths. Do not copy them into the repository:

```text
/Users/zhoulin/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_9546335463212_c25d/temp/RWTemp/2026-07/9e20f478899dc29eb19741386f9343c8/7d1261973802fc33bed16982dea29c12.jpg
/Users/zhoulin/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_9546335463212_c25d/temp/RWTemp/2026-07/9e20f478899dc29eb19741386f9343c8/5b8a37bccb68e0a71342b34cca5cf11a.jpg
/Users/zhoulin/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_9546335463212_c25d/temp/RWTemp/2026-07/9e20f478899dc29eb19741386f9343c8/a7f86870604d0cbfad930f78a5823ad8.jpg
```

- [ ] **Step 5: Perform the local acceptance audit**

For each source image:

1. compare every visually identifiable transaction row with the review table;
2. verify no header/footer/navigation row became a draft;
3. verify every missing or uncertain field is highlighted rather than guessed;
4. open at least one evidence crop and confirm it points to the source row;
5. confirm account and source timezone;
6. resolve one synthetic cross-source duplicate and one synthetic field conflict by importing a test copy into temporary browser storage;
7. confirm the final imported records appear in the normal library/history and start the existing market-data update;
8. cancel a second run and confirm no draft, image, or extra history entry remains.

Keep the audit notes outside the repository because they can reveal personal trading data.

- [ ] **Step 6: If the sample audit finds a defect, reproduce it with an anonymous failing test**

Add only the minimum anonymized OCR-line or synthetic-image fixture needed to reproduce the defect. Run the focused test and observe the expected failure before changing production code; make the minimal fix and rerun the full suite.

- [ ] **Step 7: Re-run final verification and commit**

Run:

```bash
npm run test:unit
npm run typecheck
npm run lint
npm run build
npm test
git diff --check
git status --short
```

Expected: all verification commands exit 0; only intended files are modified.

```bash
git add README.md
git commit -m "docs: document screenshot trade recovery"
```

If Step 6 added a regression fix, stage its exact test and production files in the same final commit and mention the sample-derived case in the commit body without including private data.
