import type {
  RecallDocument,
  RecallSnapshot,
} from "../recall/types";

export type RecallExportSource = "draft" | "completed";

export type RecallExportOrder = {
  snapshotIds: readonly string[];
  textIdsBySnapshot?: Readonly<Record<string, readonly string[]>>;
};

export type RecallExportOptions = {
  source?: RecallExportSource;
  order?: RecallExportOrder;
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
  bytes: ReadonlyArray<number>;
};

export type RecallExportSnapshot = {
  id: string;
  decisionId: string;
  timeframe: RecallSnapshot["timeframe"];
  imagePath: string;
  textIds: readonly string[];
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
  snapshots: readonly RecallExportSnapshot[];
  textEntries: readonly RecallExportTextEntry[];
  warnings: readonly RecallExportWarning[];
};

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
