export type ImportDiagnostic = {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  sheet?: string;
  page?: number;
  row?: number;
  sourceOrder?: number;
  instrumentSymbol?: string;
  assetClass?: string;
};

export type ImportResult<T> = {
  records: T[];
  diagnostics: ImportDiagnostic[];
  blocked: boolean;
};
