# Recall export contract

The export worker consumes a `RecallDocument` and its source-of-truth
`TradeEpisode`. It never reads `working.drawings` as export content. The
default source is the current draft (retained snapshots only); a formal
`lastCompleted` version can be selected explicitly.

## Pure manifest API

```ts
import type { TradeEpisode } from "../trades/types";
import type { RecallDocument } from "../recall/types";

export type RecallExportSource = "draft" | "completed";

export type RecallExportOrder = {
  /** Complete list of retained snapshot ids in preview order. */
  snapshotIds: readonly string[];
  /** Optional complete list of text drawing ids (or stable text keys) for each retained snapshot. */
  textIdsBySnapshot?: Readonly<Record<string, readonly string[]>>;
};

export type RecallExportOptions = {
  source?: RecallExportSource;
  order?: RecallExportOrder;
  /** ISO timestamp used for the generated-at metadata. Defaults to now. */
  generatedAt?: string;
};

export type RecallExportWarningCode =
  | "no-global-snapshot"
  | "missing-snapshot"
  | "unassigned-snapshot"
  | "unfinished"
  | "working-content-excluded"
  | "timezone-fallback";

export type RecallExportWarning = {
  code: RecallExportWarningCode;
  message: string;
  decisionId?: string;
};

export type RecallExportTextEntry = {
  key: string;
  drawingId: string;
  textRevision: string;
  ownerId: string;
  text: string;
  snapshotIds: readonly string[];
  sourceSnapshotId: string;
};

export type RecallExportFile = {
  path: string;
  kind: "image" | "markdown";
  mimeType: "image/png" | "text/markdown; charset=utf-8";
  /** A frozen copy of the retained PNG or UTF-8 Markdown bytes. */
  bytes: ReadonlyArray<number>;
};

export type RecallExportManifest = {
  source: RecallExportSource;
  folderName: string;
  baseName: string;
  markdownName: string;
  timezone: string;
  generatedAt: string;
  status: RecallDocument["status"];
  files: readonly RecallExportFile[];
  snapshots: readonly {
    id: string;
    decisionId: string;
    timeframe: string;
    imagePath: string;
    /** Stable text keys in preview order (`drawingId\0revision\0owner`). */
    textIds: readonly string[];
  }[];
  textEntries: readonly RecallExportTextEntry[];
  warnings: readonly RecallExportWarning[];
};

export function createRecallExportManifest(
  document: RecallDocument,
  episode: TradeEpisode,
  options?: RecallExportOptions,
): RecallExportManifest;

export function buildRecallMarkdown(
  manifest: RecallExportManifest,
): string;

/** Builds a UTF-8, stored ZIP with the manifest files in manifest order. */
export function buildRecallZip(
  manifest: RecallExportManifest,
): Uint8Array;

export function createRecallZipBlob(
  manifest: RecallExportManifest,
): Blob;
```

The manifest is deeply frozen at construction. Text entries use
`drawing.id + textRevision + ownerId` as their stable identity. Equal strings
with different drawing ids remain separate; inherited copies of one revision
are associated with every snapshot but appear once in the Markdown. A changed
revision or owner appears as a new entry.

## Browser directory API

```ts
export type RecallDirectoryHandle = {
  readonly name?: string;
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<RecallDirectoryHandle>;
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<RecallFileHandle>;
};

export type RecallFileHandle = {
  createWritable(): Promise<RecallWritable>;
};

export type RecallWritable = {
  write(data: Blob | BufferSource | string): Promise<void>;
  close(): Promise<void>;
};

export type RecallDirectoryExportResult = {
  status: "success" | "cancelled" | "unsupported" | "partial";
  folderName?: string;
  displayPath?: string;
  writtenFiles: number;
  totalFiles: number;
  error?: unknown;
};

export function canUseRecallDirectoryExport(): boolean;
export function chooseRecallDirectory(): Promise<RecallDirectoryHandle | null>;
export function writeRecallExportDirectory(
  manifest: RecallExportManifest,
  root: RecallDirectoryHandle,
): Promise<RecallDirectoryExportResult>;
```

The dialog calls `chooseRecallDirectory()` directly from the user click before
starting writes. The writer creates a fresh `_02`, `_03`, … folder when the
base folder exists, writes images before Markdown, and reports partial paths
without deleting anything outside files it has successfully created.

## Preview dialog API

```tsx
export type RecallExportDialogProps = {
  document: RecallDocument;
  episode: TradeEpisode;
  onClose: () => void;
  /** Called after every drag reorder so the workspace can persist the order. */
  onOrderChange?: (order: RecallExportOrder, source: RecallExportSource) => void;
  /** Optional status hook for integration telemetry/toasts. */
  onExported?: (
    result:
      | RecallDirectoryExportResult
      | { status: "zip"; fileName: string },
  ) => void;
  initialSource?: RecallExportSource;
  generatedAt?: string;
};

export function RecallExportDialog(
  props: RecallExportDialogProps,
): JSX.Element;
```

The dialog shows both retained source choices when a formal version exists,
renders snapshot and text order previews, and calls `onOrderChange` with the
complete order after each drag. It always retains text from snapshots only;
the working drawing state is shown as an exclusion warning.
