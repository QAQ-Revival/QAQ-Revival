import React from "react";
export function ManagementModal({ onBackdropClose, contentStyle, children }) {
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onBackdropClose?.();
        }
      }}
      onWheel={(e) => e.preventDefault()}
    >
      <div
        className="modal-content"
        style={contentStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
