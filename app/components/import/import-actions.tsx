"use client";

import { ImageUp, Upload } from "lucide-react";

type Props = {
  disabled?: boolean;
  compact?: boolean;
  onTradingView?: () => void;
  onFile: () => void;
  onScreenshot: () => void;
};

/** All entry points open the workspace's one pair of file inputs. */
export function ImportActions({ disabled, compact, onFile, onScreenshot, onTradingView }: Props) {
  return <div className={`shared-import-actions ${compact ? "compact" : ""}`}>
    <button type="button" className="primary-action" disabled={disabled} onClick={onFile}><Upload size={16} />{compact ? "导入记录" : "导入交易记录"}</button>
    <button type="button" className="secondary-action" disabled={disabled} onClick={onScreenshot}><ImageUp size={16} />{compact ? "截图恢复" : "从截图恢复交易"}</button>
    {onTradingView && <button type="button" className="secondary-action" disabled={disabled} onClick={onTradingView}><Upload size={16} />导入 TradingView 模拟交易</button>}
  </div>;
}
