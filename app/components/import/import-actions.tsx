"use client";

import { ImageUp, Upload } from "lucide-react";
import { useState } from "react";

type Props = {
  disabled?: boolean;
  compact?: boolean;
  onTradingView?: () => void;
  onFile: () => void;
  onScreenshot: () => void;
};

/** All entry points open the workspace's one pair of file inputs. */
export function ImportActions({ disabled, compact, onFile, onScreenshot, onTradingView }: Props) {
  const [open, setOpen] = useState(false);
  if (compact) return <div className="import-menu" onKeyDown={event => {if(event.key === "Escape") setOpen(false);}} onBlur={event => {if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);}}>
    <button type="button" className="primary-action" disabled={disabled} aria-expanded={open} onClick={() => setOpen(!open)}><Upload size={16} />导入</button>
    {open && <div className="import-menu-options" aria-label="导入方式"><button type="button" onClick={() => {setOpen(false);onFile();}}>导入记录 · PDF / Excel</button><button type="button" onClick={() => {setOpen(false);onScreenshot();}}>截图恢复</button>{onTradingView && <button type="button" onClick={() => {setOpen(false);onTradingView();}}>导入 TradingView 模拟交易</button>}</div>}
  </div>;
  return <div className={`shared-import-actions ${compact ? "compact" : ""}`}>
    <button type="button" className="primary-action" disabled={disabled} onClick={onFile}><Upload size={16} />{compact ? "导入记录" : "导入交易记录"}</button>
    <button type="button" className="secondary-action" disabled={disabled} onClick={onScreenshot}><ImageUp size={16} />{compact ? "截图恢复" : "从截图恢复交易"}</button>
    {onTradingView && <button type="button" className="secondary-action" disabled={disabled} onClick={onTradingView}><Upload size={16} />导入 TradingView 模拟交易</button>}
  </div>;
}
