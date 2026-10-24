import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";

export function RenameModDialog({ mod, saving, onRename, onClose }) {
  const [draft, setDraft] = React.useState(mod.name);
  const submittingRef = React.useRef(false);

  return ReactDOM.createPortal(
    <div
      className="modal-backdrop"
      onClick={() => !saving && onClose()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape" && !saving) onClose();
      }}
    >
      <form
        className="modal-content mod-rename-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mod-rename-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          if (saving || submittingRef.current) return;
          submittingRef.current = true;
          try {
            if (await onRename(mod, draft)) onClose();
          } finally {
            submittingRef.current = false;
          }
        }}
      >
        <h3 id="mod-rename-title">{t("mods.actions.rename")}</h3>
        <input
          className="input"
          aria-label={t("common.fields.name")}
          type="text"
          autoFocus={true}
          value={draft}
          disabled={saving}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.nativeEvent.isComposing)
              e.preventDefault();
          }}
        />
        <div className="mod-rename-dialog-actions">
          <button type="button" className="btn btn-secondary" disabled={saving} onClick={onClose}>
            {t("common.actions.cancel")}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || !draft.trim()}>
            {saving ? t("common.status.saving") : t("common.actions.save")}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
