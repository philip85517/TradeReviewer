"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

import { useModalFocus } from "./use-modal-focus";

import "./import-management-drawer.css";

type Props = {
  children: ReactNode;
  onClose: () => void;
};

/**
 * Holds the import/library controls while an imported trade is being reviewed.
 * The controls stay mounted only while the drawer is open so the review view
 * does not grow a second permanent sidebar.
 */
export function ImportManagementDrawer({ children, onClose }: Props) {
  const dialogRef = useModalFocus(onClose);

  return (
    <div
      className="import-management-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="import-management-dialog"
        role="dialog"
        aria-modal="true"
        id="import-management-dialog"
        aria-labelledby="import-management-title"
      >
        <header className="import-management-header">
          <div>
            <span className="eyebrow">数据管理</span>
            <h2 id="import-management-title">导入与数据管理</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="关闭导入与数据管理"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <div className="import-management-content">{children}</div>
      </section>
    </div>
  );
}
