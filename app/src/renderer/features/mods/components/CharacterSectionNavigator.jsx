import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
import { Icon } from "../../../components/Icon.jsx";
import {
  isBaseSection,
  isCustomSection,
  getSectionName,
  getSectionId,
  BASE_SECTION_ID,
  getSectionSubtitle,
} from "../model/appearanceSections.js";
function SectionCover({
  section,
  decorative = false,
  className = "appearance-section-cover",
}) {
  const coverUrl = section?.coverUrl || section?.imageUrl || section?.image;
  const [failedUrl, setFailedUrl] = React.useState(null);
  const fallback = isBaseSection(section)
    ? "user"
    : isCustomSection(section)
      ? "sparkles"
      : "shirt";
  return (
    <span className={className} aria-hidden={decorative || void 0}>
      {coverUrl && failedUrl !== coverUrl ? (
        <img
          src={coverUrl}
          alt=""
          draggable={false}
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(coverUrl)}
        />
      ) : (
        <Icon name={fallback} size={13} />
      )}
    </span>
  );
}
function SectionEditorModal({ section, busy, onClose, onSave, onDelete }) {
  const editing = !!section;
  const [name, setName] = React.useState(
    () => section?.nameZh || section?.name || "",
  );
  const [nameEn, setNameEn] = React.useState(() => section?.nameEn || "");
  const [coverValue, setCoverValue] = React.useState("");
  const [coverPreview, setCoverPreview] = React.useState(
    () => section?.coverUrl || "",
  );
  const [error, setError] = React.useState("");
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const inputRef = React.useRef(null);
  React.useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, []);
  React.useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose]);
  function handleCoverChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (
      !/^image\//i.test(file.type || "") &&
      !/\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name || "")
    ) {
      setError(t("mods.sections.coverFileTypes"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setCoverPreview(dataUrl);
      setCoverValue(window.api.getPathForFile(file) || dataUrl);
      setError("");
    };
    reader.onerror = () => setError(t("mods.sections.coverReadFailed"));
    reader.readAsDataURL(file);
  }
  async function handleSubmit(event) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t("mods.sections.nameRequired"));
      return;
    }
    setError("");
    try {
      await onSave({
        section,
        name: trimmedName,
        nameEn: nameEn.trim(),
        coverImagePath: coverValue || null,
      });
      onClose();
    } catch (saveError) {
      setError(saveError?.message || String(saveError));
    }
  }
  async function handleDelete() {
    setError("");
    try {
      await onDelete(section);
      onClose();
    } catch (deleteError) {
      setError(deleteError?.message || String(deleteError));
    }
  }
  return ReactDOM.createPortal(
    <div
      className="appearance-section-modal-backdrop"
      onMouseDown={(event) =>
        event.target === event.currentTarget && !busy && onClose()
      }
    >
      <div
        className="appearance-section-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="appearance-section-editor-title"
      >
        <div className="appearance-section-modal-head">
          <div>
            <div
              id="appearance-section-editor-title"
              className="appearance-section-modal-title"
            >
              {editing
                ? t("mods.sections.editTitle")
                : t("mods.sections.createTitle")}
            </div>
            <div className="appearance-section-modal-subtitle">
              {t("mods.sections.description")}
            </div>
          </div>
          <button
            type="button"
            className="appearance-section-modal-close"
            onClick={onClose}
            disabled={busy}
            aria-label={t("common.actions.close")}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        {confirmingDelete ? (
          <div className="appearance-section-delete-confirm">
            <div className="appearance-section-delete-icon">
              <Icon name="alert" size={20} />
            </div>
            <div className="appearance-section-delete-title">
              {t("mods.sections.confirmDelete", {
                sectionName: getSectionName(section),
              })}
            </div>
            <div className="appearance-section-delete-copy">
              {t("mods.sections.deleteHint", {
                number: Number(section?.modCount || 0),
              })}
            </div>
            {error && (
              <div className="appearance-section-editor-error" role="alert">
                {error}
              </div>
            )}
            <div className="appearance-section-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmingDelete(false)}
                disabled={busy}
              >
                {t("common.actions.back")}
              </button>
              <button
                type="button"
                className="btn btn-danger appearance-section-danger-btn"
                onClick={handleDelete}
                disabled={busy}
              >
                {busy
                  ? t("common.status.processing")
                  : t("mods.sections.returnAndDelete")}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="appearance-section-editor-grid">
              <button
                type="button"
                className="appearance-section-cover-picker"
                onClick={() =>
                  document
                    .getElementById("appearance-section-cover-input")
                    ?.click()
                }
                aria-label={t("mods.sections.chooseCover")}
              >
                {coverPreview ? (
                  <img
                    src={coverPreview}
                    alt={t("mods.sections.coverPreview")}
                  />
                ) : (
                  <span>{t("mods.sections.addCover")}</span>
                )}
              </button>
              <input
                id="appearance-section-cover-input"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
                onChange={handleCoverChange}
                hidden={true}
              />
              <div className="appearance-section-editor-fields">
                <label>
                  <span>{t("mods.sections.name")}</span>
                  <input
                    ref={inputRef}
                    className="input"
                    value={name}
                    maxLength={60}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t("mods.sections.namePlaceholder")}
                    disabled={busy}
                  />
                </label>
                <label>
                  <span>{t("mods.sections.optionalSubtitle")}</span>
                  <input
                    className="input"
                    value={nameEn}
                    maxLength={80}
                    onChange={(event) => setNameEn(event.target.value)}
                    placeholder="Optional subtitle"
                    disabled={busy}
                  />
                </label>
              </div>
            </div>
            {error && (
              <div className="appearance-section-editor-error" role="alert">
                {error}
              </div>
            )}
            <div className="appearance-section-modal-actions">
              {editing && (
                <button
                  type="button"
                  className="btn btn-ghost appearance-section-delete-link"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={busy}
                >
                  {t("mods.sections.delete")}
                </button>
              )}
              <span className="appearance-section-action-spacer" />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={busy}
              >
                {t("common.actions.cancel")}
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || !name.trim()}
              >
                {busy
                  ? t("common.status.saving")
                  : editing
                    ? t("common.actions.saveChanges")
                    : t("mods.sections.create")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
function CharacterSectionNavigator({
  characterName,
  sections,
  activeSectionId,
  busy = false,
  onSelect,
  onSaveCustomSection,
  onDeleteCustomSection,
}) {
  const railRef = React.useRef(null);
  const sectionButtonRefs = React.useRef([]);
  const [editorSection, setEditorSection] = React.useState(void 0);
  const [railOverflow, setRailOverflow] = React.useState(false);
  React.useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const measure = () =>
      setRailOverflow(rail.scrollWidth > rail.clientWidth + 2);
    const observer = new ResizeObserver(measure);
    observer.observe(rail);
    measure();
    return () => observer.disconnect();
  }, [sections]);
  const normalizedSections = React.useMemo(() => {
    const source = Array.isArray(sections) ? sections : [];
    const seen = new Set();
    const result = [];
    source.forEach((section) => {
      const sectionId = getSectionId(section);
      if (!sectionId || seen.has(sectionId)) return;
      seen.add(sectionId);
      result.push({
        ...section,
        id: sectionId,
        sectionId,
      });
    });
    if (!seen.has(BASE_SECTION_ID)) {
      result.unshift({
        id: BASE_SECTION_ID,
        sectionId: BASE_SECTION_ID,
        kind: "base",
        nameZh: t("mods.sections.originalCharacter"),
        nameEn: "Default",
        modCount: 0,
        enabledCount: 0,
      });
    }
    return result;
  }, [sections]);
  const officialSkinCount = normalizedSections.filter(
    (section) => !isBaseSection(section) && !isCustomSection(section) && section.kind !== "shared",
  ).length;
  const otherEnabledSections = normalizedSections.filter(
    (section) =>
      getSectionId(section) !== activeSectionId &&
      Number(section.enabledCount || 0) > 0,
  );
  const otherEnabledCount = otherEnabledSections.reduce(
    (sum, section) => sum + Number(section.enabledCount || 0),
    0,
  );
  function moveFocus(currentIndex, direction) {
    if (!normalizedSections.length) return;
    let nextIndex = currentIndex;
    if (direction === "first") nextIndex = 0;
    else if (direction === "last") nextIndex = normalizedSections.length - 1;
    else
      nextIndex =
        (currentIndex + direction + normalizedSections.length) %
        normalizedSections.length;
    sectionButtonRefs.current[nextIndex]?.focus();
    onSelect?.(getSectionId(normalizedSections[nextIndex]));
  }
  function handleSectionKeyDown(event, index) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveFocus(index, 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveFocus(index, -1);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveFocus(index, "first");
    } else if (event.key === "End") {
      event.preventDefault();
      moveFocus(index, "last");
    }
  }
  function scrollRail(direction) {
    railRef.current?.scrollBy({
      left: direction * Math.max(260, railRef.current.clientWidth * 0.65),
      behavior: "smooth",
    });
  }
  return (
    <section
      className="appearance-section-navigator"
      aria-label={t("mods.sections.characterHeading", {
        characterName,
      })}
    >
      <div
        className={`appearance-section-rail-shell ${railOverflow ? "has-overflow" : ""}`}
      >
        {railOverflow && (
          <button
            type="button"
            className="appearance-section-scroll-btn prev"
            onClick={() => scrollRail(-1)}
            aria-label={t("mods.sections.scrollLeft")}
          >
            <Icon name="chevron-left" size={14} />
          </button>
        )}
        <div
          ref={railRef}
          className="appearance-section-rail"
          role="tablist"
          aria-label={t("mods.sections.choose")}
          title={t("mods.sections.filterOnlyHint")}
        >
          {normalizedSections.map((section, index) => {
            const sectionId = getSectionId(section);
            const active = sectionId === activeSectionId;
            const custom = isCustomSection(section);
            const enabledCount = Number(section.enabledCount || 0);
            const modCount = Number(section.modCount || 0);
            const label = t("mods.sections.itemLabel", {
              sectionName: getSectionName(section),
              enabledCount,
              modCount,
            });
            return (
              <div
                className={`appearance-section-tab-wrap ${active ? "active" : ""}`}
                key={sectionId}
              >
                <button
                  ref={(node) => {
                    sectionButtonRefs.current[index] = node;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  className={`appearance-section-tab ${active ? "active" : ""}`}
                  onClick={() => onSelect?.(sectionId)}
                  onKeyDown={(event) => handleSectionKeyDown(event, index)}
                  title={label}
                >
                  <SectionCover section={section} decorative={true} />
                  <span className="appearance-section-tab-name">
                    {getSectionName(section)}
                  </span>
                  <span className="appearance-section-tab-stats">
                    <b className={enabledCount > 0 ? "has-enabled" : ""}>
                      {enabledCount}
                    </b>
                    {"/"}
                    {modCount}
                  </span>
                </button>
                {custom && (
                  <button
                    type="button"
                    className="appearance-section-manage-btn"
                    onClick={() => setEditorSection(section)}
                    aria-label={t("mods.sections.editNamed", {
                      sectionName: getSectionName(section),
                    })}
                    title={t("mods.sections.editHint")}
                  >
                    <Icon name="more" size={14} strokeWidth={2.4} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          className="icon-btn icon-btn-sm appearance-section-add-tab"
          onClick={() => setEditorSection(null)}
          disabled={busy}
          aria-label={t("mods.sections.createCustom")}
          title={t("mods.sections.createCustom")}
        >
          <Icon name="plus" size={15} />
        </button>
        {railOverflow && (
          <button
            type="button"
            className="appearance-section-scroll-btn next"
            onClick={() => scrollRail(1)}
            aria-label={t("mods.sections.scrollRight")}
          >
            <Icon name="chevron-right" size={14} />
          </button>
        )}
      </div>
      {otherEnabledCount > 0 && (
        <div className="notice notice-info appearance-section-enabled-notice" role="status">
          <Icon name="info" size={14} />
          <span>
            {t("mods.sections.otherEnabledPrefix")}
            <strong>{otherEnabledCount}</strong>
            {t("mods.sections.otherEnabledSuffix")}
            <em>
              {"（"}
              {otherEnabledSections.map(getSectionName).join("、")}
              {"）"}
            </em>
          </span>
          <button
            type="button"
            className="link-btn"
            onClick={() => onSelect?.(getSectionId(otherEnabledSections[0]))}
          >
            {t("common.actions.view")}
          </button>
        </div>
      )}
      {editorSection !== void 0 && (
        <SectionEditorModal
          section={editorSection || null}
          busy={busy}
          onClose={() => !busy && setEditorSection(void 0)}
          onSave={onSaveCustomSection}
          onDelete={onDeleteCustomSection}
        />
      )}
    </section>
  );
}
export { CharacterSectionNavigator, SectionCover };
