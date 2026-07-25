export type ImportDiagnostic = {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  sheet?: string;
  row?: number;
};

export type ImportResult<T> = {
  records: T[];
  diagnostics: ImportDiagnostic[];
  blocked: boolean;
};
