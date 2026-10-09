import { r as reactExports, j as jsxRuntimeExports, R as ReactDOM, a as React, f as fetchWithDirectFallback } from "./index.js";
import { i as isManagedInstallContentType, M as MANAGED_INSTALL_OPTIONS, n as normalizeInstallContentType, g as getInstallContentTypeLabel, a as getManagedInstallResultMessage } from "./managedInstall.js";
import ModPersistSummary from './ModPersistSummary.js';
const BASE_SECTION_ID = "base";
function getSectionId(section) {
  return String(section?.sectionId || section?.id || BASE_SECTION_ID);
}
function isBaseSection(section) {
  return getSectionId(section) === BASE_SECTION_ID || section?.kind === "base";
}
function isCustomSection(section) {
  return section?.kind === "custom" || getSectionId(section).startsWith("custom:");
}
function getSectionName(section) {
  if (isBaseSection(section)) return section?.nameZh || section?.name || "原角色";
  return section?.nameZh || section?.name || section?.title || "未命名分区";
}
function getSectionSubtitle(section) {
  if (isBaseSection(section)) return section?.nameEn || "Default";
  return section?.nameEn || (isCustomSection(section) ? "自定义分区" : "Official Outfit");
}
function SectionCover({ section, decorative = false, className = "appearance-section-cover" }) {
  const coverUrl = section?.coverUrl || section?.imageUrl || section?.image;
  const [failedUrl, setFailedUrl] = reactExports.useState(null);
  const fallback = isBaseSection(section) ? "🎭" : isCustomSection(section) ? "✨" : "👗";
  return /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className, "aria-hidden": decorative || void 0, children: coverUrl && failedUrl !== coverUrl ? /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: coverUrl, alt: "", draggable: false, referrerPolicy: "no-referrer", onError: () => setFailedUrl(coverUrl) }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: fallback }) });
}
function SectionEditorModal({ section, busy, onClose, onSave, onDelete }) {
  const editing = !!section;
  const [name, setName] = reactExports.useState(() => section?.nameZh || section?.name || "");
  const [nameEn, setNameEn] = reactExports.useState(() => section?.nameEn || "");
  const [coverValue, setCoverValue] = reactExports.useState("");
  const [coverPreview, setCoverPreview] = reactExports.useState(() => section?.coverUrl || "");
  const [error, setError] = reactExports.useState("");
  const [confirmingDelete, setConfirmingDelete] = reactExports.useState(false);
  const inputRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, []);
  reactExports.useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose]);
  function handleCoverChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\//i.test(file.type || "") && !/\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name || "")) {
      setError("请选择 PNG、JPG、WebP、GIF 或 BMP 图片。");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setCoverPreview(dataUrl);
      setCoverValue(window.api.getPathForFile(file) || dataUrl);
      setError("");
    };
    reader.onerror = () => setError("封面读取失败，请换一张图片。");
    reader.readAsDataURL(file);
  }
  async function handleSubmit(event) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("请输入分区名称。");
      return;
    }
    setError("");
    try {
      await onSave({
        section,
        name: trimmedName,
        nameEn: nameEn.trim(),
        coverImagePath: coverValue || null
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
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "appearance-section-modal-backdrop", onMouseDown: (event) => event.target === event.currentTarget && !busy && onClose(), children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "appearance-section-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "appearance-section-editor-title", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "appearance-section-modal-head", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { id: "appearance-section-editor-title", className: "appearance-section-modal-title", children: editing ? "编辑自定义分区" : "新建外观分区" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "appearance-section-modal-subtitle", children: "分区只负责整理与切换查看，不会自动改变任何 Mod 的启用状态。" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "appearance-section-modal-close", onClick: onClose, disabled: busy, "aria-label": "关闭", children: "×" })
      ] }),
      confirmingDelete ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "appearance-section-delete-confirm", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "appearance-section-delete-icon", children: "🗂️" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "appearance-section-delete-title", children: [
          "删除“",
          getSectionName(section),
          "”？"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "appearance-section-delete-copy", children: [
          "分区内的 ",
          Number(section?.modCount || 0),
          " 个 Mod 不会被删除，管理器会将它们归回“原角色”。"
        ] }),
        error && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "appearance-section-editor-error", role: "alert", children: error }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "appearance-section-modal-actions", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "btn btn-secondary", onClick: () => setConfirmingDelete(false), disabled: busy, children: "返回" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "btn appearance-section-danger-btn", onClick: handleDelete, disabled: busy, children: busy ? "处理中…" : "归回并删除分区" })
        ] })
      ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { onSubmit: handleSubmit, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "appearance-section-editor-grid", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              className: "appearance-section-cover-picker",
              onClick: () => document.getElementById("appearance-section-cover-input")?.click(),
              "aria-label": "选择分区封面",
              children: coverPreview ? /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: coverPreview, alt: "分区封面预览" }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("b", { children: "＋" }),
                "添加封面"
              ] })
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              id: "appearance-section-cover-input",
              type: "file",
              accept: "image/png,image/jpeg,image/webp,image/gif,image/bmp",
              onChange: handleCoverChange,
              hidden: true
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "appearance-section-editor-fields", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "分区名称" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "input",
                {
                  ref: inputRef,
                  className: "input",
                  value: name,
                  maxLength: 60,
                  onChange: (event) => setName(event.target.value),
                  placeholder: "例如：婚纱、战斗服、我最喜欢的版本",
                  disabled: busy
                }
              )
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                "英文 / 副标题 ",
                /* @__PURE__ */ jsxRuntimeExports.jsx("em", { children: "可选" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "input",
                {
                  className: "input",
                  value: nameEn,
                  maxLength: 80,
                  onChange: (event) => setNameEn(event.target.value),
                  placeholder: "Optional subtitle",
                  disabled: busy
                }
              )
            ] })
          ] })
        ] }),
        error && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "appearance-section-editor-error", role: "alert", children: error }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "appearance-section-modal-actions", children: [
          editing && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "btn appearance-section-delete-link", onClick: () => setConfirmingDelete(true), disabled: busy, children: "删除分区" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "appearance-section-action-spacer" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "btn btn-secondary", onClick: onClose, disabled: busy, children: "取消" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "submit", className: "btn btn-primary", disabled: busy || !name.trim(), children: busy ? "保存中…" : editing ? "保存修改" : "创建分区" })
        ] })
      ] })
    ] }) }),
    document.body
  );
}
function CharacterSectionNavigator({
  characterName,
  sections,
  activeSectionId,
  busy = false,
  onSelect,
  onSaveCustomSection,
  onDeleteCustomSection
}) {
  const railRef = reactExports.useRef(null);
  const sectionButtonRefs = reactExports.useRef([]);
  const [editorSection, setEditorSection] = reactExports.useState(void 0);
  const [railOverflow, setRailOverflow] = reactExports.useState(false);
  reactExports.useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const measure = () => setRailOverflow(rail.scrollWidth > rail.clientWidth + 2);
    const observer = new ResizeObserver(measure);
    observer.observe(rail);
    measure();
    return () => observer.disconnect();
  }, [sections]);
  const normalizedSections = reactExports.useMemo(() => {
    const source = Array.isArray(sections) ? sections : [];
    const seen = /* @__PURE__ */ new Set();
    const result = [];
    source.forEach((section) => {
      const sectionId = getSectionId(section);
      if (!sectionId || seen.has(sectionId)) return;
      seen.add(sectionId);
      result.push({ ...section, id: sectionId, sectionId });
    });
    if (!seen.has(BASE_SECTION_ID)) {
      result.unshift({ id: BASE_SECTION_ID, sectionId: BASE_SECTION_ID, kind: "base", nameZh: "原角色", nameEn: "Default", modCount: 0, enabledCount: 0 });
    }
    return result;
  }, [sections]);
  const officialSkinCount = normalizedSections.filter((section) => !isBaseSection(section) && !isCustomSection(section)).length;
  const otherEnabledSections = normalizedSections.filter(
    (section) => getSectionId(section) !== activeSectionId && Number(section.enabledCount || 0) > 0
  );
  const otherEnabledCount = otherEnabledSections.reduce((sum, section) => sum + Number(section.enabledCount || 0), 0);
  function moveFocus(currentIndex, direction) {
    if (!normalizedSections.length) return;
    let nextIndex = currentIndex;
    if (direction === "first") nextIndex = 0;
    else if (direction === "last") nextIndex = normalizedSections.length - 1;
    else nextIndex = (currentIndex + direction + normalizedSections.length) % normalizedSections.length;
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
    railRef.current?.scrollBy({ left: direction * Math.max(260, railRef.current.clientWidth * 0.65), behavior: "smooth" });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "appearance-section-navigator", "aria-label": `${characterName} 外观分区`, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "appearance-section-summary-row", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "appearance-section-summary-title", children: "外观分区" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "appearance-section-summary-meta", children: [
          normalizedSections.length,
          " 个分区",
          officialSkinCount > 0 ? ` · ${officialSkinCount} 款官方皮肤` : ""
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "appearance-section-add-tab", onClick: () => setEditorSection(null), disabled: busy, "aria-label": "新建自定义分区", children: "+ 新增分区" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `appearance-section-rail-shell ${railOverflow ? "has-overflow" : ""}`, children: [
      railOverflow && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "appearance-section-scroll-btn prev", onClick: () => scrollRail(-1), "aria-label": "向左滚动分区", children: "‹" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { ref: railRef, className: "appearance-section-rail", role: "tablist", "aria-label": "选择外观分区", children: [
        normalizedSections.map((section, index) => {
          const sectionId = getSectionId(section);
          const active = sectionId === activeSectionId;
          const custom = isCustomSection(section);
          const enabledCount = Number(section.enabledCount || 0);
          const modCount = Number(section.modCount || 0);
          const label = `${getSectionName(section)}，${enabledCount} 个启用，共 ${modCount} 个 Mod`;
          return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `appearance-section-tab-wrap ${active ? "active" : ""}`, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "button",
              {
                ref: (node) => {
                  sectionButtonRefs.current[index] = node;
                },
                type: "button",
                role: "tab",
                "aria-selected": active,
                tabIndex: active ? 0 : -1,
                className: `appearance-section-tab ${active ? "active" : ""}`,
                onClick: () => onSelect?.(sectionId),
                onKeyDown: (event) => handleSectionKeyDown(event, index),
                title: label,
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(SectionCover, { section, decorative: true }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "appearance-section-tab-copy", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: getSectionName(section) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("em", { children: getSectionSubtitle(section) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "appearance-section-tab-stats", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("b", { className: enabledCount > 0 ? "has-enabled" : "", children: [
                        enabledCount,
                        " 启用"
                      ] }),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                        modCount,
                        " Mod"
                      ] })
                    ] })
                  ] })
                ]
              }
            ),
            custom && /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                type: "button",
                className: "appearance-section-manage-btn",
                onClick: () => setEditorSection(section),
                "aria-label": `编辑分区 ${getSectionName(section)}`,
                title: "编辑名称、封面或删除分区",
                children: "⋯"
              }
            )
          ] }, sectionId);
        })
      ] }),
      railOverflow && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "appearance-section-scroll-btn next", onClick: () => scrollRail(1), "aria-label": "向右滚动分区", children: "›" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "appearance-section-summary-note", children: "分区仅筛选显示，不改变启用状态" }),
    otherEnabledCount > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "appearance-section-enabled-notice", role: "status", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { "aria-hidden": "true", children: "💡" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
        "其他分区仍有 ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: otherEnabledCount }),
        " 个 Mod 启用",
        /* @__PURE__ */ jsxRuntimeExports.jsxs("em", { children: [
          "（",
          otherEnabledSections.map(getSectionName).join("、"),
          "）"
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: () => onSelect?.(getSectionId(otherEnabledSections[0])), children: "查看" })
    ] }),
    editorSection !== void 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(
      SectionEditorModal,
      {
        section: editorSection || null,
        busy,
        onClose: () => !busy && setEditorSection(void 0),
        onSave: onSaveCustomSection,
        onDelete: onDeleteCustomSection
      }
    )
  ] });
}
const STYLE_TOGGLE_WRAP = { marginRight: "16px", flexShrink: 0 };
const STYLE_MOD_INFO = { flex: 1, overflow: "hidden" };
const STYLE_MOD_NAME_ROW = { fontWeight: "600", fontSize: "15px", color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: "6px" };
const STYLE_PIN_ICON = { fontSize: "13px", flexShrink: 0 };
const STYLE_CONFLICT_ICON = { cursor: "pointer", fontSize: "14px", flexShrink: 0 };
const STYLE_CONFLICT_DETAIL = { fontSize: "11px", color: "#e67e22", background: "#fff8e1", padding: "6px 8px", borderRadius: "4px", marginTop: "4px", lineHeight: "1.5" };
const STYLE_CONFLICT_HASH = { fontSize: "10px" };
const STYLE_ORIGINAL_NAME = { fontSize: "12px", color: "var(--color-text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const STYLE_DELETE_BTN = { opacity: 0.5 };
const STYLE_MODS_LIST = { flex: 1, overflowY: "auto", padding: "16px" };
const STYLE_ROW_TAG_ROW = {
  display: "flex",
  flexWrap: "nowrap",
  gap: "4px",
  marginTop: "4px",
  overflow: "hidden",
  width: "100%"
};
const STYLE_ROW_TAG_CHIP = {
  display: "inline-flex",
  alignItems: "center",
  padding: "1px 8px",
  borderRadius: "999px",
  fontSize: "11px",
  lineHeight: "16px",
  background: "rgba(99,102,241,0.10)",
  color: "#4338ca",
  border: "1px solid rgba(99,102,241,0.2)",
  cursor: "pointer",
  maxWidth: "140px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  flexShrink: 0,
  transition: "background 0.12s, color 0.12s, border-color 0.12s"
};
const STYLE_ROW_TAG_CHIP_ACTIVE = {
  ...STYLE_ROW_TAG_CHIP,
  background: "linear-gradient(90deg, #818cf8, #6366f1)",
  color: "#fff",
  border: "1px solid rgba(79,70,229,0.8)",
  boxShadow: "0 1px 3px rgba(79,70,229,0.25)"
};
const STYLE_ROW_TAG_MORE = {
  display: "inline-flex",
  alignItems: "center",
  padding: "1px 7px",
  borderRadius: "999px",
  fontSize: "11px",
  lineHeight: "16px",
  background: "rgba(148,163,184,0.16)",
  color: "#475569",
  flexShrink: 0,
  cursor: "help"
};
const STYLE_NOTE_LINE = {
  fontSize: "12px",
  color: "var(--color-text-tertiary)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};
const DEFAULT_PREVIEW_ASPECT_RATIO = 4 / 3;
function getAppearanceSectionStorageKey(gameId, characterName) {
  return `modview-appearance-section-${gameId || "default"}-${characterName || "unknown"}`;
}
function getModAppearanceSectionId(mod) {
  return String(mod?.appearanceSectionId || mod?.sectionId || BASE_SECTION_ID);
}
function getExplicitImportAppearanceSectionId(sectionId) {
  const normalized = String(sectionId || BASE_SECTION_ID);
  return normalized === BASE_SECTION_ID ? null : normalized;
}
function getAppearanceImportTargetName(section) {
  return getSectionId(section) === BASE_SECTION_ID ? "智能识别（未命中则原角色）" : getSectionName(section);
}
function ensureAppearanceApiResult(result, fallbackMessage) {
  if (result?.success === false || result?.error) {
    throw new Error(result?.error || fallbackMessage);
  }
  return result || { success: true };
}
async function callAppearanceSectionApi(action, payload) {
  const api = window.api || {};
  const { characterName, sectionId, modName, ...rest } = payload || {};
  if (action === "list") {
    if (api.getCharacterSections) return api.getCharacterSections(characterName);
    if (api.getAppearanceSections) return api.getAppearanceSections(characterName);
  }
  if (action === "create") {
    if (api.createCharacterSection) {
      return api.createCharacterSection(characterName, rest.name, rest.coverImagePath || null, {
        nameEn: rest.nameEn || ""
      });
    }
    if (api.createAppearanceSection) return api.createAppearanceSection({ characterName, ...rest });
  }
  if (action === "update") {
    if (api.updateCharacterSection) return api.updateCharacterSection(characterName, sectionId, rest);
    if (api.updateAppearanceSection) return api.updateAppearanceSection({ characterName, sectionId, ...rest });
  }
  if (action === "delete") {
    if (api.deleteCharacterSection) return api.deleteCharacterSection(characterName, sectionId);
    if (api.deleteAppearanceSection) return api.deleteAppearanceSection({ characterName, sectionId });
  }
  if (action === "setCover") {
    if (api.setCharacterSectionCover) return api.setCharacterSectionCover(characterName, sectionId, rest.imagePath);
    if (api.setAppearanceSectionCover) return api.setAppearanceSectionCover({ characterName, sectionId, imagePath: rest.imagePath });
  }
  if (action === "assign") {
    if (api.assignModAppearanceSection) return api.assignModAppearanceSection(characterName, modName, sectionId);
    if (api.assignModToCharacterSection) return api.assignModToCharacterSection(characterName, modName, sectionId);
    if (api.setModAppearanceSection) return api.setModAppearanceSection({ characterName, modName, sectionId });
  }
  throw new Error(`当前 preload 尚未提供外观分区 API（${action}）`);
}
function getPreviewAspectRatioStyle(ratio) {
  const numericRatio = Number(ratio);
  if (!Number.isFinite(numericRatio) || numericRatio <= 0) return "4 / 3";
  const boundedRatio = Math.min(Math.max(numericRatio, 0.75), 1.85);
  return `${boundedRatio} / 1`;
}
const _aiSuggestCache = /* @__PURE__ */ new Map();
const _previewAspectRatioCache = /* @__PURE__ */ new Map();
function FittingTagRow({ tags, selectedTags, onToggleTag }) {
  const containerRef = reactExports.useRef(null);
  const orderedTags = reactExports.useMemo(() => {
    if (!selectedTags || selectedTags.size === 0) return tags;
    const sel = [];
    const unsel = [];
    for (const t of tags) {
      if (selectedTags.has(String(t).toLowerCase())) sel.push(t);
      else unsel.push(t);
    }
    return [...sel, ...unsel];
  }, [tags, selectedTags]);
  const [visibleCount, setVisibleCount] = reactExports.useState(orderedTags.length);
  const [measured, setMeasured] = reactExports.useState(false);
  reactExports.useLayoutEffect(() => {
    setVisibleCount(orderedTags.length);
    setMeasured(false);
  }, [orderedTags]);
  reactExports.useLayoutEffect(() => {
    if (measured) return;
    const el = containerRef.current;
    if (!el) return;
    const chips = Array.from(el.querySelectorAll("[data-fit-chip]"));
    if (!chips.length) return;
    const moreEl = el.querySelector("[data-fit-more]");
    const moreW = moreEl ? moreEl.offsetWidth : 32;
    const containerW = el.clientWidth;
    const gap = 4;
    let used = 0;
    let fitted = 0;
    for (let i = 0; i < chips.length; i++) {
      const w = chips[i].offsetWidth;
      const remaining = chips.length - i - 1;
      const reserve = remaining > 0 ? moreW + gap : 0;
      const cost = w + (i > 0 ? gap : 0);
      if (used + cost + reserve > containerW) break;
      used += cost;
      fitted++;
    }
    const final = Math.max(1, fitted);
    if (final !== orderedTags.length) setVisibleCount(final);
    setMeasured(true);
  });
  reactExports.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let lastWidth = el.clientWidth;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w === lastWidth || w === 0) return;
      lastWidth = w;
      setVisibleCount(orderedTags.length);
      setMeasured(false);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [orderedTags.length]);
  const visible = orderedTags.slice(0, visibleCount);
  const hidden = orderedTags.slice(visibleCount);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { ref: containerRef, style: STYLE_ROW_TAG_ROW, children: [
    visible.map((tag, ti) => {
      const active = selectedTags && selectedTags.has(String(tag).toLowerCase());
      return /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "span",
        {
          "data-fit-chip": true,
          title: active ? `点击取消筛选 #${tag}` : `点击加入筛选 #${tag}（支持多选）`,
          style: active ? STYLE_ROW_TAG_CHIP_ACTIVE : STYLE_ROW_TAG_CHIP,
          onClick: (e) => {
            e.stopPropagation();
            onToggleTag && onToggleTag(String(tag));
          },
          children: [
            "#",
            tag
          ]
        },
        `fit-${ti}`
      );
    }),
    hidden.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "span",
      {
        "data-fit-more": true,
        title: hidden.map((t) => `#${t}`).join("  "),
        style: STYLE_ROW_TAG_MORE,
        children: [
          "+",
          hidden.length
        ]
      }
    )
  ] });
}
const STYLE_FOCUS_PULSE = { boxShadow: "0 0 0 2px rgba(255,154,158,0.22), 0 12px 28px rgba(255,154,158,0.12)", transform: "translateY(-1px)", transition: "box-shadow 0.2s ease, transform 0.2s ease" };
const STYLE_EMPTY = {};
const MARK_STORAGE_KEY = "qaqm-marked-mods";
function readMarkedMods() {
  try {
    return JSON.parse(localStorage.getItem(MARK_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}
function writeMarkedMods(map) {
  try {
    localStorage.setItem(MARK_STORAGE_KEY, JSON.stringify(map));
  } catch {
  }
}
function flattenMarkedMods(marked, gameId) {
  const result = {};
  for (const [entryCharacterName, mods] of Object.entries(marked || {})) {
    if (!mods || typeof mods !== "object") continue;
    for (const [modName, value] of Object.entries(mods)) {
      const item = value && typeof value === "object" ? value : {};
      const itemPath = item.path || item.originalPath;
      if (!itemPath) continue;
      result[itemPath] = {
        name: item.name || modName,
        originalName: item.originalName,
        characterName: item.characterName || entryCharacterName,
        gameId: item.gameId || gameId,
        path: itemPath,
        markedAt: item.markedAt
      };
    }
  }
  return result;
}
function findMarkedModKey(markedMods, mod, characterName, gameId) {
  if (!mod) return null;
  if (markedMods?.[mod.path]) return mod.path;
  return Object.entries(markedMods || {}).find(([, item]) => item?.name === mod.name && item?.characterName === characterName && (!item?.gameId || item.gameId === gameId))?.[0] || null;
}
function isMarkedModEntry(markedMods, mod, characterName, gameId) {
  return !!findMarkedModKey(markedMods, mod, characterName, gameId);
}
function getCharacterUsageStorageKey(gameId) {
  return `charview-usage-${gameId || "default"}`;
}
function getModViewStateStorageKey(gameId, characterName) {
  return `modview-state-${gameId || "default"}-${characterName || "unknown"}`;
}
function getModViewPreferenceStorageKey(gameId, characterName) {
  return `modview-prefs-${gameId || "default"}-${characterName || "unknown"}`;
}
function readModViewState(storageKey) {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return { scrollTop: 0, selectedModName: null };
    const parsed = JSON.parse(raw);
    return {
      scrollTop: Number.isFinite(Number(parsed?.scrollTop)) ? Number(parsed.scrollTop) : 0,
      selectedModName: parsed?.selectedModName ? String(parsed.selectedModName) : null
    };
  } catch {
    return { scrollTop: 0, selectedModName: null };
  }
}
function readModViewPreferences(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { localCollectionsEnabled: false, exclusiveMode: true };
    const parsed = JSON.parse(raw);
    return {
      localCollectionsEnabled: parsed?.localCollectionsEnabled === true,
      exclusiveMode: parsed?.exclusiveMode !== false
    };
  } catch {
    return { localCollectionsEnabled: false, exclusiveMode: true };
  }
}
function dataTransferIncludesImage(dataTransfer) {
  if (!dataTransfer) return false;
  if (dataTransfer.items && dataTransfer.items.length > 0) {
    return Array.from(dataTransfer.items).some((item) => item.type.startsWith("image/"));
  }
  if (dataTransfer.files && dataTransfer.files.length > 0) {
    return Array.from(dataTransfer.files).some(
      (file) => file.type.startsWith("image/") || /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(file.name || "")
    );
  }
  return false;
}
function isBatchFolderPlanItem(item) {
  return !!item?.importPlan && Array.isArray(item.importPlan?.splitOptions);
}
function getPlanSelectedMode(item) {
  return item?.selectedImportMode || item?.importPlan?.defaultMode || "single";
}
function normalizeImportDisplayPart(value) {
  return String(value || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();
}
function joinImportDisplayPath(...parts) {
  return parts.map(normalizeImportDisplayPart).filter(Boolean).join("/");
}
function getBatchImportDisplayPath(item, fallbackRootName = "") {
  if (!item) return "";
  if (item.importDisplayPath) return item.importDisplayPath;
  const rootName = fallbackRootName || item.importPlanRootName || item.importRootName || "";
  const relativePath = item.importRelativePath || "";
  return joinImportDisplayPath(rootName, relativePath) || normalizeImportDisplayPart(relativePath) || item.name || "";
}
function decorateBatchImportItem(item, rootName = "") {
  if (!item) return item;
  const displayPath = getBatchImportDisplayPath(item, rootName);
  return {
    ...item,
    importPlanRootName: rootName || item.importPlanRootName || item.importRootName || "",
    importDisplayPath: displayPath
  };
}
function getSelectedBatchPlanItems(item) {
  if (!isBatchFolderPlanItem(item)) return [decorateBatchImportItem(item)];
  const plan = item.importPlan;
  const rootName = plan.rootName || item.name || "";
  const mode = getPlanSelectedMode(item);
  const applyPreferredName = (entry) => mode === "single" && item.preferredModName ? { ...entry, name: item.preferredModName, preferredModName: item.preferredModName } : entry;
  if (mode === "integrated") {
    const option = (plan.integratedOptions || []).find((entry) => entry.id === item.selectedIntegratedOptionId) || (plan.integratedOptions || []).find((entry) => entry.id === plan.defaultIntegratedOptionId) || (plan.integratedOptions || [])[0];
    return option?.item ? [decorateBatchImportItem({ ...option.item, selected: item.selected !== false && option.item.selected !== false }, rootName)] : [decorateBatchImportItem({ ...plan.wholeItem, selected: item.selected !== false && plan.wholeItem?.selected !== false }, rootName)];
  }
  if (mode === "multiple") {
    const option = (plan.splitOptions || []).find((entry) => entry.id === item.selectedSplitOptionId) || (plan.splitOptions || []).find((entry) => entry.id === plan.defaultSplitOptionId) || (plan.splitOptions || [])[0];
    return (option?.items?.length ? option.items : [plan.wholeItem]).map((entry) => ({
      ...decorateBatchImportItem(entry, rootName),
      selected: item.selected !== false && entry.selected !== false
    }));
  }
  return [applyPreferredName(decorateBatchImportItem({ ...plan.wholeItem, selected: item.selected !== false && plan.wholeItem?.selected !== false }, rootName))];
}
function expandBatchPlanItems(items) {
  return (items || []).flatMap((item) => getSelectedBatchPlanItems(item));
}
function getBatchPlanModeLabel(mode) {
  if (mode === "integrated") return "整合包";
  if (mode === "multiple") return "多个 Mod";
  return "单个 Mod";
}
function stripDisabledPrefix(name) {
  return String(name || "").replace(/^DISABLED_/i, "");
}
function cleanLocalCollectionText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}
function normalizeLocalCollectionKey(value) {
  return cleanLocalCollectionText(value).toLowerCase().replace(/[【】\[\]（）(){}<>《》"'`]/g, "").replace(/[\s_\-－–—.:：/\\]+/g, "");
}
function buildLocalCharacterPrefixKeys(characterName, characterAliases = []) {
  return Array.from(new Set([characterName, ...characterAliases].map((alias) => normalizeLocalCollectionKey(alias)).filter(Boolean)));
}
function splitLocalModNameParts(name) {
  return cleanLocalCollectionText(name).replace(/^DISABLED_/i, "").split(/[-－–—]+/).map((part) => part.trim()).filter(Boolean);
}
function stripLocalVariantVersion(value) {
  const text = cleanLocalCollectionText(value);
  if (!text) return { text: "", version: "" };
  const compactVersion = text.match(/^(.*?)(v\s*\d+(?:\.\d+){0,3}[a-z]?)$/i);
  if (compactVersion && cleanLocalCollectionText(compactVersion[1])) {
    return {
      text: cleanLocalCollectionText(compactVersion[1]).replace(/[-_－–—\s]+$/, ""),
      version: compactVersion[2]
    };
  }
  const separatedVersion = text.match(/^(.*?)[\s_\-－–—]+(\d+(?:\.\d+){1,3}[a-z]?)$/i);
  if (separatedVersion && cleanLocalCollectionText(separatedVersion[1])) {
    return {
      text: cleanLocalCollectionText(separatedVersion[1]).replace(/[-_－–—\s]+$/, ""),
      version: separatedVersion[2]
    };
  }
  return { text, version: "" };
}
function normalizeLocalVersionLabel(value) {
  const text = cleanLocalCollectionText(value);
  if (!text) return "";
  const collapsed = text.replace(/^v+/i, "v");
  const match = collapsed.match(/^v?\s*(\d+(?:\.\d+){0,3}[a-z]?)$/i);
  if (match) return `V${match[1]}`;
  return text.replace(/^v/i, "V");
}
function parseLocalVersionWeight(value) {
  const text = normalizeLocalVersionLabel(value);
  const match = text.match(/^V(\d+(?:\.\d+){0,3})([a-z]?)$/i);
  if (!match) return { parts: [0], suffix: "", hasVersion: false };
  const rawParts = match[1].split(".");
  const parts = rawParts.length === 2 && /^\d{2}$/.test(rawParts[1]) ? [rawParts[0], rawParts[1][0], rawParts[1][1]] : rawParts;
  return {
    parts: parts.map((part) => Number(part) || 0),
    suffix: match[2] || "",
    hasVersion: true
  };
}
function compareLocalVersionLabels(left, right) {
  const a = parseLocalVersionWeight(left);
  const b = parseLocalVersionWeight(right);
  if (a.hasVersion !== b.hasVersion) return a.hasVersion ? -1 : 1;
  const max = Math.max(a.parts.length, b.parts.length);
  for (let i = 0; i < max; i += 1) {
    const diff = (b.parts[i] || 0) - (a.parts[i] || 0);
    if (diff !== 0) return diff;
  }
  return String(a.suffix).localeCompare(String(b.suffix), "zh-CN");
}
function parseLocalModCollectionName(mod, characterName, characterAliases = []) {
  const name = cleanLocalCollectionText(mod?.name);
  if (!name) return null;
  const parts = splitLocalModNameParts(name);
  if (parts.length < 1) return null;
  const characterKeys = buildLocalCharacterPrefixKeys(characterName, characterAliases);
  const firstPartIsCharacter = characterKeys.includes(normalizeLocalCollectionKey(parts[0]));
  const bodyParts = firstPartIsCharacter ? parts.slice(1) : parts;
  if (!bodyParts.length) return null;
  const base = stripLocalVariantVersion(bodyParts[0]);
  const collectionName = cleanLocalCollectionText(base.text || bodyParts[0]);
  if (!collectionName) return null;
  let version = normalizeLocalVersionLabel(base.version);
  const variantParts = [];
  bodyParts.slice(1).forEach((part) => {
    const stripped = stripLocalVariantVersion(part);
    const explicitVersion = normalizeLocalVersionLabel(stripped.version || part);
    const partIsPureVersion = /^v?\s*\d+(?:\.\d+){0,3}[a-z]?$/i.test(cleanLocalCollectionText(part));
    if (!version && (stripped.version || partIsPureVersion)) {
      version = explicitVersion;
    }
    if (stripped.text && !partIsPureVersion) {
      variantParts.push(stripped.text);
    }
  });
  return {
    mod,
    collectionName,
    collectionKey: normalizeLocalCollectionKey(collectionName),
    variantName: cleanLocalCollectionText(variantParts.join("-")),
    variantVersion: version,
    explicitVersion: !!version
  };
}
function getLocalVariantLabel(variant) {
  const version = cleanLocalCollectionText(variant?._localVersionLabel);
  const variantName = cleanLocalCollectionText(variant?._localVariantName);
  if (version && variantName) return `${version} · ${variantName}`;
  return version || variantName || "V1.0";
}
function buildLocalCollectionView(sortedMods, characterName, selectedVariants = {}, characterAliases = []) {
  const characterIdentityKey = buildLocalCharacterPrefixKeys(characterName, characterAliases)[0] || normalizeLocalCollectionKey(characterName);
  const records = sortedMods.map((mod, index) => {
    const parsed = parseLocalModCollectionName(mod, characterName, characterAliases);
    return parsed ? { ...parsed, index } : null;
  }).filter(Boolean);
  const candidateNames = new Map(records.map((record) => [record.collectionKey, record.collectionName]));
  const groups = /* @__PURE__ */ new Map();
  const identityByPath = /* @__PURE__ */ new Map();
  records.forEach((record) => {
    let collectionKey = record.collectionKey;
    let collectionName = record.collectionName;
    for (const [candidateKey, candidateName] of candidateNames.entries()) {
      if (!candidateKey || candidateKey === collectionKey || candidateKey.length < 2) continue;
      if (collectionKey.startsWith(candidateKey)) {
        collectionKey = candidateKey;
        collectionName = candidateName;
        break;
      }
    }
    let variantName = record.variantName;
    if (!variantName && collectionName !== record.collectionName) {
      const suffix = cleanLocalCollectionText(record.collectionName.slice(collectionName.length));
      if (suffix) variantName = suffix;
    }
    const identity = `${characterIdentityKey}:${collectionKey}`;
    if (!groups.has(identity)) {
      groups.set(identity, {
        identity,
        name: collectionName,
        firstIndex: record.index,
        records: []
      });
    }
    groups.get(identity).records.push({ ...record, collectionName, collectionKey, variantName, identity });
    if (record.mod?.path) identityByPath.set(record.mod.path, identity);
  });
  const collectionByPath = /* @__PURE__ */ new Map();
  const displayMods = [];
  const displayedIdentities = /* @__PURE__ */ new Set();
  for (const [identity, group] of groups.entries()) {
    const hasV10 = group.records.some((record) => normalizeLocalVersionLabel(record.variantVersion) === "V1.0");
    group.variants = group.records.map((record) => {
      const version = normalizeLocalVersionLabel(record.variantVersion) || (hasV10 ? "V0.5" : "V1.0");
      return {
        ...record.mod,
        _localCollectionIdentity: identity,
        _localCollectionName: group.name,
        _localVariantName: record.variantName,
        _localVersionLabel: version,
        _localOriginalIndex: record.index
      };
    }).sort(
      (a, b) => compareLocalVersionLabels(a._localVersionLabel, b._localVersionLabel) || cleanLocalCollectionText(a._localVariantName).localeCompare(cleanLocalCollectionText(b._localVariantName), "zh-CN") || (a._localOriginalIndex || 0) - (b._localOriginalIndex || 0)
    );
    if (group.variants.length >= 2) {
      group.variants.forEach((variant) => {
        if (variant?.path) collectionByPath.set(variant.path, {
          identity,
          name: group.name,
          variants: group.variants
        });
      });
    }
  }
  sortedMods.forEach((mod) => {
    const identity = mod?.path ? identityByPath.get(mod.path) : null;
    const group = identity ? groups.get(identity) : null;
    if (!group || group.variants.length < 2) {
      displayMods.push(mod);
      return;
    }
    if (displayedIdentities.has(identity)) return;
    displayedIdentities.add(identity);
    const selectedPath = selectedVariants[identity];
    const selectedVariant = group.variants.find((variant) => variant.path === selectedPath) || group.variants.find((variant) => variant.enabled) || group.variants[0];
    displayMods.push({
      ...selectedVariant,
      _localCollection: {
        identity,
        name: group.name,
        variants: group.variants
      }
    });
  });
  return { displayMods, collectionByPath };
}
function LocalCollectionVariantStrip({ collection, currentPath, onSelect, compact = false }) {
  const variants = Array.isArray(collection?.variants) ? collection.variants : [];
  if (variants.length < 2) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: compact ? "local-collection-variants compact" : "local-collection-variants", children: variants.map((variant) => {
    const active = variant.path === currentPath;
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        type: "button",
        className: `local-collection-variant-chip ${active ? "active" : ""}`,
        title: variant.name,
        onClick: (event) => {
          event.stopPropagation();
          onSelect?.(collection.identity, variant);
        },
        children: getLocalVariantLabel(variant)
      },
      variant.path || variant.name
    );
  }) });
}
function LocalCollectionGalleryDropdown({ collection, currentPath, isOpen, onToggle, onClose, onSelect }) {
  const variants = Array.isArray(collection?.variants) ? collection.variants : [];
  if (variants.length < 2) return null;
  const currentVariant = variants.find((variant) => variant.path === currentPath) || variants[0];
  const triggerLabel = cleanLocalCollectionText(currentVariant?._localVersionLabel) || getLocalVariantLabel(currentVariant);
  const [menuRect, setMenuRect] = reactExports.useState({ left: 12, top: 12, width: 240 });
  const rootRef = reactExports.useRef(null);
  reactExports.useLayoutEffect(() => {
    if (!isOpen) return void 0;
    const root = rootRef.current;
    if (!root) return void 0;
    const updateMenuRect = () => {
      const rect = root.getBoundingClientRect();
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const width = Math.min(240, Math.max(180, viewportWidth - 24));
      const left = Math.min(Math.max(12, rect.right - width), Math.max(12, viewportWidth - width - 12));
      const belowTop = rect.bottom + 6;
      const aboveTop = rect.top - 194;
      const top = belowTop + 188 > viewportHeight - 12 && aboveTop > 12 ? aboveTop : belowTop;
      setMenuRect({ left, top: Math.max(12, top), width });
    };
    updateMenuRect();
    window.addEventListener("resize", updateMenuRect);
    window.addEventListener("scroll", updateMenuRect, true);
    return () => {
      window.removeEventListener("resize", updateMenuRect);
      window.removeEventListener("scroll", updateMenuRect, true);
    };
  }, [isOpen]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      ref: rootRef,
      className: "local-collection-gallery-dropdown",
      onClick: (event) => event.stopPropagation(),
      onMouseDown: (event) => event.stopPropagation(),
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            type: "button",
            className: "local-collection-gallery-trigger",
            "aria-haspopup": "listbox",
            "aria-expanded": isOpen,
            title: `合集：${collection.name}`,
            onClick: (event) => {
              event.stopPropagation();
              onToggle?.(collection.identity);
            },
            onKeyDown: (event) => {
              if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                onToggle?.(collection.identity, true);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                onClose?.();
              }
            },
            children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "local-collection-gallery-trigger-main", children: triggerLabel })
          }
        ),
        isOpen && ReactDOM.createPortal(
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              className: "local-collection-gallery-menu floating",
              role: "listbox",
              style: { left: `${menuRect.left}px`, top: `${menuRect.top}px`, width: `${menuRect.width}px` },
              onClick: (event) => event.stopPropagation(),
              onMouseDown: (event) => event.stopPropagation(),
              children: variants.map((variant) => {
                const active = variant.path === currentPath;
                const stateLabel = active ? "当前" : variant.enabled ? "启用" : "";
                return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  "button",
                  {
                    type: "button",
                    className: `local-collection-gallery-option ${active ? "active" : ""}`,
                    role: "option",
                    "aria-selected": active,
                    title: variant.name,
                    onClick: (event) => {
                      event.stopPropagation();
                      onSelect?.(collection.identity, variant);
                      onClose?.();
                    },
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: getLocalVariantLabel(variant) }),
                      stateLabel && /* @__PURE__ */ jsxRuntimeExports.jsx("em", { children: stateLabel })
                    ]
                  },
                  variant.path || variant.name
                );
              })
            }
          ),
          document.body
        )
      ]
    }
  );
}
function notifyPakImported(detail = {}) {
  try {
    window.dispatchEvent(new CustomEvent("qaqm-pak-imported", { detail }));
  } catch {
  }
}
function ModView({ characterName, activeGameId, managerTarget, onBack, devMode, onOpenPublishMod, onRequestMoveMod, onRequestBatchImportReview, runtimeInfo, onCharacterModsChanged }) {
  const isWuwa = activeGameId === "wuthering-waves";
  const characterUsageStorageKey = getCharacterUsageStorageKey(activeGameId);
  const modViewStateStorageKey = getModViewStateStorageKey(activeGameId, characterName);
  const modViewPreferenceStorageKey = getModViewPreferenceStorageKey(activeGameId, characterName);
  const appearanceSectionStorageKey = getAppearanceSectionStorageKey(activeGameId, characterName);
  const initialViewState = React.useMemo(() => readModViewState(modViewStateStorageKey), [modViewStateStorageKey]);
  const initialViewPreferences = React.useMemo(() => readModViewPreferences(modViewPreferenceStorageKey), [modViewPreferenceStorageKey]);
  const [mods, setMods] = reactExports.useState([]);
  const [modsLoadError, setModsLoadError] = reactExports.useState("");
  const [appearanceSections, setAppearanceSections] = reactExports.useState([]);
  const [activeAppearanceSectionId, setActiveAppearanceSectionId] = reactExports.useState(() => {
    try {
      return localStorage.getItem(appearanceSectionStorageKey) || BASE_SECTION_ID;
    } catch {
      return BASE_SECTION_ID;
    }
  });
  const activeAppearanceSectionIdRef = reactExports.useRef(activeAppearanceSectionId);
  const [appearanceSectionBusy, setAppearanceSectionBusy] = reactExports.useState(false);
  const [characterAliases, setCharacterAliases] = reactExports.useState([]);
  const [selectedMod, setSelectedMod] = reactExports.useState(null);
  const selectedModRef = reactExports.useRef(null);
  const [localCollectionsEnabled, setLocalCollectionsEnabled] = reactExports.useState(() => initialViewPreferences.localCollectionsEnabled);
  const [selectedLocalCollectionVariants, setSelectedLocalCollectionVariants] = reactExports.useState({});
  const [openLocalCollectionGalleryMenu, setOpenLocalCollectionGalleryMenu] = reactExports.useState(null);
  const [focusPulseModName, setFocusPulseModName] = reactExports.useState(null);
  const [showScrollTop, setShowScrollTop] = reactExports.useState(false);
  const [detailCollapsed, setDetailCollapsed] = reactExports.useState(false);
  const galleryAnchorRef = reactExports.useRef(null);
  const [previewImage, setPreviewImage] = reactExports.useState(null);
  const [previewImageAspectRatio, setPreviewImageAspectRatio] = reactExports.useState(DEFAULT_PREVIEW_ASPECT_RATIO);
  const [imageKey, setImageKey] = reactExports.useState(Date.now());
  const [toast, setToast] = reactExports.useState(null);
  const [hotkeyGroups, setHotkeyGroups] = reactExports.useState([]);
  const detailRequestRef = reactExports.useRef(0);
  const [isRefreshingHotkeys, setIsRefreshingHotkeys] = reactExports.useState(false);
  reactExports.useEffect(() => {
    selectedModRef.current = selectedMod;
  }, [selectedMod]);
  const [isDragging, setIsDragging] = reactExports.useState(false);
  const [newModFile, setNewModFile] = reactExports.useState(null);
  const [newModName, setNewModName] = reactExports.useState("");
  const [showDeleteModal, setShowDeleteModal] = reactExports.useState(false);
  const [modToDelete, setModToDelete] = reactExports.useState(null);
  const [modSearchQuery, setModSearchQuery] = reactExports.useState("");
  const [selectedTagFilters, setSelectedTagFilters] = reactExports.useState(() => /* @__PURE__ */ new Set());
  const toggleTagFilter = React.useCallback((tag) => {
    const key = String(tag || "").trim().toLowerCase();
    if (!key) return;
    setSelectedTagFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  const clearTagFilters = React.useCallback(() => {
    setSelectedTagFilters((prev) => prev.size === 0 ? prev : /* @__PURE__ */ new Set());
  }, []);
  const [sortMethod, setSortMethod] = reactExports.useState(() => {
    return localStorage.getItem("modview-sort") || "name";
  });
  const [sortedMods, setSortedMods] = reactExports.useState([]);
  const appearanceSectionsWithStats = reactExports.useMemo(() => {
    const source = Array.isArray(appearanceSections) ? appearanceSections : [];
    const definitions = source.length > 0 ? source.map((section) => ({ ...section, id: getSectionId(section), sectionId: getSectionId(section) })) : [{ id: BASE_SECTION_ID, sectionId: BASE_SECTION_ID, kind: "base", nameZh: "原角色", nameEn: "Default" }];
    if (!definitions.some((section) => getSectionId(section) === BASE_SECTION_ID)) {
      definitions.unshift({ id: BASE_SECTION_ID, sectionId: BASE_SECTION_ID, kind: "base", nameZh: "原角色", nameEn: "Default" });
    }
    const stats = new Map(definitions.map((section) => [getSectionId(section), { modCount: 0, enabledCount: 0 }]));
    mods.forEach((mod) => {
      const requestedId = getModAppearanceSectionId(mod);
      const sectionId = stats.has(requestedId) ? requestedId : BASE_SECTION_ID;
      const current = stats.get(sectionId) || { modCount: 0, enabledCount: 0 };
      current.modCount += 1;
      if (mod.enabled) current.enabledCount += 1;
      stats.set(sectionId, current);
    });
    return definitions.map((section) => ({
      ...section,
      ...stats.get(getSectionId(section)) || { modCount: 0, enabledCount: 0 }
    }));
  }, [appearanceSections, mods]);
  const activeAppearanceSection = reactExports.useMemo(
    () => appearanceSectionsWithStats.find((section) => getSectionId(section) === activeAppearanceSectionId) || appearanceSectionsWithStats[0],
    [activeAppearanceSectionId, appearanceSectionsWithStats]
  );
  const activeAppearanceSectionName = getSectionName(activeAppearanceSection);
  const activeAppearanceImportTargetName = getAppearanceImportTargetName(activeAppearanceSection);
  const activeAppearanceEmptyHint = getSectionId(activeAppearanceSection) === BASE_SECTION_ID ? "拖入 Mod 后会先按官方皮肤中英文名智能识别，未命中时归入原角色；切换分区不会改变启用状态。" : "拖入 Mod 后会归入当前分区；切换分区不会改变任何启用状态。";
  const activeAppearanceHasMods = Number(activeAppearanceSection?.modCount || 0) > 0;
  const appearanceFiltersActive = Boolean(modSearchQuery.trim()) || selectedTagFilters.size > 0;
  const localCollectionView = reactExports.useMemo(
    () => localCollectionsEnabled ? buildLocalCollectionView(sortedMods, characterName, selectedLocalCollectionVariants, characterAliases) : { displayMods: sortedMods, collectionByPath: /* @__PURE__ */ new Map() },
    [sortedMods, characterName, selectedLocalCollectionVariants, characterAliases, localCollectionsEnabled]
  );
  const displayMods = localCollectionView.displayMods;
  const appearanceFilterHasNoMatches = displayMods.length === 0 && activeAppearanceHasMods && appearanceFiltersActive;
  const selectedLocalCollection = selectedMod?.path ? localCollectionView.collectionByPath.get(selectedMod.path) || null : null;
  const [modInteractionOrder, setModInteractionOrder] = reactExports.useState(() => {
    try {
      const saved = localStorage.getItem(`modview-interaction-order-${characterName}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [draggedMod, setDraggedMod] = reactExports.useState(null);
  const [dragOverMod, setDragOverMod] = reactExports.useState(null);
  const [editingHotkey, setEditingHotkey] = reactExports.useState(null);
  const [capturedKey, setCapturedKey] = reactExports.useState("");
  const [conflicts, setConflicts] = reactExports.useState([]);
  const [conflictMap, setConflictMap] = reactExports.useState({});
  const [showConflictDetail, setShowConflictDetail] = reactExports.useState(null);
  const [exclusiveMode, setExclusiveMode] = reactExports.useState(() => initialViewPreferences.exclusiveMode);
  reactExports.useEffect(() => {
    const prefs = readModViewPreferences(modViewPreferenceStorageKey);
    setLocalCollectionsEnabled(prefs.localCollectionsEnabled);
    setExclusiveMode(prefs.exclusiveMode);
    setOpenLocalCollectionGalleryMenu(null);
    setSelectedLocalCollectionVariants({});
  }, [modViewPreferenceStorageKey]);
  const [batchMode, setBatchMode] = reactExports.useState(false);
  const [selectedMods, setSelectedMods] = reactExports.useState(/* @__PURE__ */ new Set());
  const [viewMode, setViewMode] = reactExports.useState(() => {
    return localStorage.getItem("modview-view-mode") === "gallery" ? "gallery" : "list";
  });
  const [galleryDetailWidth, setGalleryDetailWidth] = reactExports.useState(() => {
    const v = parseInt(localStorage.getItem("modview-gallery-detail-width") || "480", 10);
    return Number.isFinite(v) && v > 0 ? Math.min(900, Math.max(220, v)) : 480;
  });
  const [isResizingGallery, setIsResizingGallery] = reactExports.useState(false);
  const galleryContainerRef = reactExports.useRef(null);
  const [detailContainerWidth, setDetailContainerWidth] = reactExports.useState(0);
  reactExports.useEffect(() => {
    const container = galleryContainerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => setDetailContainerWidth(entry.contentRect.width));
    observer.observe(container);
    setDetailContainerWidth(container.clientWidth);
    return () => observer.disconnect();
  }, []);
  // Keep space for the list/grid, including its toolbar, at every window size.
  const maxDetailWidth = detailContainerWidth ? Math.max(220, Math.min(900, detailContainerWidth - 340)) : 480;
  const minDetailWidth = Math.min(280, maxDetailWidth);
  const visibleDetailWidth = Math.min(maxDetailWidth, Math.max(minDetailWidth, galleryDetailWidth));
  reactExports.useEffect(() => {
    localStorage.setItem("modview-view-mode", viewMode);
  }, [viewMode]);
  reactExports.useEffect(() => {
    localStorage.setItem("modview-gallery-detail-width", String(galleryDetailWidth));
  }, [galleryDetailWidth]);
  reactExports.useEffect(() => {
    if (!openLocalCollectionGalleryMenu) return void 0;
    function handleDocClick(event) {
      if (event?.target?.closest?.(".local-collection-gallery-menu")) return;
      setOpenLocalCollectionGalleryMenu(null);
    }
    function handleKey(event) {
      if (event.key === "Escape") setOpenLocalCollectionGalleryMenu(null);
    }
    document.addEventListener("mousedown", handleDocClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [openLocalCollectionGalleryMenu]);
  reactExports.useEffect(() => {
    setOpenLocalCollectionGalleryMenu(null);
  }, [characterName, viewMode, localCollectionsEnabled]);
  function toggleLocalCollectionsEnabled() {
    setLocalCollectionsEnabled((prev) => {
      const next = !prev;
      persistModViewPreferences({ localCollectionsEnabled: next });
      if (!next) {
        setOpenLocalCollectionGalleryMenu(null);
        setSelectedLocalCollectionVariants({});
      }
      return next;
    });
  }
  function toggleViewMode() {
    setViewMode((prev) => {
      const next = prev === "gallery" ? "list" : "gallery";
      if (next === "gallery") {
        setBatchMode(false);
        setSelectedMods(/* @__PURE__ */ new Set());
      }
      return next;
    });
  }
  reactExports.useEffect(() => {
    if (!isResizingGallery) return;
    const handleMouseMove = (e) => {
      const container = galleryContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const scale = rect.width / container.offsetWidth || 1;
      const newDetailWidth = (rect.right - e.clientX) / scale;
      setGalleryDetailWidth(Math.min(maxDetailWidth, Math.max(minDetailWidth, newDetailWidth)));
    };
    const handleMouseUp = () => setIsResizingGallery(false);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("blur", handleMouseUp);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("blur", handleMouseUp);
    };
  }, [isResizingGallery, maxDetailWidth, minDetailWidth]);
  const [fixRunning, setFixRunning] = reactExports.useState(false);
  const [modContextMenu, setModContextMenu] = reactExports.useState(null);
  const [iniRollbackBackups, setIniRollbackBackups] = reactExports.useState({ modName: "", loading: false, items: [], error: "" });
  const [iniRollbackConfirm, setIniRollbackConfirm] = reactExports.useState(null);
  const [markModeUnlocked, setMarkModeUnlocked] = reactExports.useState(false);
  const [showMarkPasswordModal, setShowMarkPasswordModal] = reactExports.useState(false);
  const [markPasswordInput, setMarkPasswordInput] = reactExports.useState("");
  const [markPasswordError, setMarkPasswordError] = reactExports.useState("");
  const [markedMods, setMarkedMods] = reactExports.useState(() => readMarkedMods());
  const [markDestFolder, setMarkDestFolder] = reactExports.useState(() => localStorage.getItem("qaqm-mark-dest") || "");
  const [markMoveRecord, setMarkMoveRecord] = reactExports.useState(null);
  const [markMoving, setMarkMoving] = reactExports.useState(false);
  const [showMarkToolbar, setShowMarkToolbar] = reactExports.useState(false);
  const [showImageLightbox, setShowImageLightbox] = reactExports.useState(false);
  const [isRenamingMod, setIsRenamingMod] = reactExports.useState(false);
  const [renameModDraft, setRenameModDraft] = reactExports.useState("");
  const [renameModSaving, setRenameModSaving] = reactExports.useState(false);
  const [isEditingNotes, setIsEditingNotes] = reactExports.useState(false);
  const [notesDraft, setNotesDraft] = reactExports.useState("");
  const [notesSaving, setNotesSaving] = reactExports.useState(false);
  const [directInstallProgress, setDirectInstallProgress] = reactExports.useState(null);
  const [directImportReview, setDirectImportReview] = reactExports.useState(null);
  const [pakToggleProgress, setPakToggleProgress] = reactExports.useState(null);
  const pakToggleProgressTimerRef = reactExports.useRef(null);
  const [editingAliasSection, setEditingAliasSection] = reactExports.useState(null);
  const [aliasDraft, setAliasDraft] = reactExports.useState("");
  const [aliasSaving, setAliasSaving] = reactExports.useState(false);
  const [modTags, setModTags] = reactExports.useState([]);
  const [tagInput, setTagInput] = reactExports.useState("");
  const [serverTags, setServerTags] = reactExports.useState([]);
  const [tagSaving, setTagSaving] = reactExports.useState(false);
  const [showTagSuggestions, setShowTagSuggestions] = reactExports.useState(false);
  const [aiTagLoading, setAiTagLoading] = reactExports.useState(false);
  const [aiTagSuggestions, setAiTagSuggestions] = reactExports.useState([]);
  const [showAiTagModal, setShowAiTagModal] = reactExports.useState(false);
  const [aiTagStage, setAiTagStage] = reactExports.useState("");
  const [aiTagElapsedSeconds, setAiTagElapsedSeconds] = reactExports.useState(0);
  const [aiTagEmptyReason, setAiTagEmptyReason] = reactExports.useState("");
  const [devInfoBusy, setDevInfoBusy] = reactExports.useState(false);
  const [aiNameLoading, setAiNameLoading] = reactExports.useState(false);
  const [aiNameResult, setAiNameResult] = reactExports.useState(null);
  const [showAiNameModal, setShowAiNameModal] = reactExports.useState(false);
  const [aiNameTaskTarget, setAiNameTaskTarget] = reactExports.useState(null);
  const [aiNameTaskResult, setAiNameTaskResult] = reactExports.useState(null);
  const [aiNameTaskError, setAiNameTaskError] = reactExports.useState("");
  const [aiNameModalMinimized, setAiNameModalMinimized] = reactExports.useState(false);
  const [aiNameStage, setAiNameStage] = reactExports.useState("");
  const [aiNameElapsedSeconds, setAiNameElapsedSeconds] = reactExports.useState(0);
  const [showTagManagerModal, setShowTagManagerModal] = reactExports.useState(false);
  const [tagManagerAdminKey, setTagManagerAdminKey] = reactExports.useState(() => localStorage.getItem("qaqm-dev-admin-key") || "");
  const [newTagName, setNewTagName] = reactExports.useState("");
  const [newTagColor, setNewTagColor] = reactExports.useState("#6366f1");
  const [tagManagerLoading, setTagManagerLoading] = reactExports.useState(false);
  const [editingTagId, setEditingTagId] = reactExports.useState(null);
  const [editingTagName, setEditingTagName] = reactExports.useState("");
  const [editingTagColor, setEditingTagColor] = reactExports.useState("");
  const modsListRef = reactExports.useRef(null);
  const scrollRafRef = reactExports.useRef(null);
  const serverTagsLastFetchRef = reactExports.useRef(0);
  const handledManagerTargetRef = reactExports.useRef(null);
  const pendingFocusRef = reactExports.useRef(null);
  const enabledFocusCursorRef = reactExports.useRef(-1);
  const focusPulseTimerRef = reactExports.useRef(null);
  const conflictRefreshTimerRef = reactExports.useRef(null);
  const conflictRefreshInFlightRef = reactExports.useRef(false);
  const conflictRefreshQueuedRef = reactExports.useRef(false);
  const conflictRequestSeqRef = reactExports.useRef(0);
  const modViewUnmountedRef = reactExports.useRef(false);
  const characterNameRef = reactExports.useRef(characterName);
  const scrollRestoredRef = reactExports.useRef(false);
  const selectedModPathRef = reactExports.useRef(null);
  reactExports.useRef(0);
  const [modsLoadVersion, setModsLoadVersion] = reactExports.useState(0);
  modViewUnmountedRef.current = false;
  characterNameRef.current = characterName;
  selectedModPathRef.current = selectedMod?.path || null;
  activeAppearanceSectionIdRef.current = activeAppearanceSectionId;
  reactExports.useEffect(() => {
    if (!modContextMenu) return void 0;
    const handleClose = () => setModContextMenu(null);
    const handlePointerDown = (event) => {
      if (event.button !== 0) return;
      if (event.target instanceof Element && event.target.closest(".mod-context-menu")) return;
      setModContextMenu(null);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setModContextMenu(null);
    };
    window.addEventListener("resize", handleClose);
    window.addEventListener("scroll", handleClose, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", handleClose);
      window.removeEventListener("scroll", handleClose, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [modContextMenu]);
  reactExports.useEffect(() => {
    const validSection = appearanceSectionsWithStats.some(
      (section) => getSectionId(section) === activeAppearanceSectionId
    );
    if (!validSection) {
      setActiveAppearanceSectionId(BASE_SECTION_ID);
      return;
    }
    try {
      localStorage.setItem(appearanceSectionStorageKey, activeAppearanceSectionId);
    } catch {
    }
  }, [activeAppearanceSectionId, appearanceSectionStorageKey, appearanceSectionsWithStats]);
  reactExports.useEffect(() => {
    const sectionMods = mods.filter(
      (mod) => getModAppearanceSectionId(mod) === activeAppearanceSectionId
    );
    setSelectedMod((current) => {
      if (current && getModAppearanceSectionId(current) === activeAppearanceSectionId) {
        return sectionMods.find((mod) => mod.path === current.path || mod.name === current.name) || sectionMods[0] || null;
      }
      return sectionMods[0] || null;
    });
    setDetailCollapsed(false);
    setOpenLocalCollectionGalleryMenu(null);
    setBatchMode(false);
    setSelectedMods(/* @__PURE__ */ new Set());
    enabledFocusCursorRef.current = -1;
    if (modsListRef.current) modsListRef.current.scrollTop = 0;
  }, [activeAppearanceSectionId]);
  function persistModViewState(nextPartialState = {}) {
    try {
      const currentState = readModViewState(modViewStateStorageKey);
      sessionStorage.setItem(modViewStateStorageKey, JSON.stringify({
        ...currentState,
        ...nextPartialState
      }));
    } catch {
    }
  }
  function persistModViewPreferences(nextPartialPreferences = {}) {
    try {
      const currentPreferences = readModViewPreferences(modViewPreferenceStorageKey);
      localStorage.setItem(modViewPreferenceStorageKey, JSON.stringify({
        ...currentPreferences,
        ...nextPartialPreferences
      }));
    } catch {
    }
  }
  function recordCharacterUsage(increment = 1) {
    if (!increment) return;
    try {
      const raw = localStorage.getItem(characterUsageStorageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed[characterName] = Number(parsed[characterName] || 0) + increment;
      localStorage.setItem(characterUsageStorageKey, JSON.stringify(parsed));
    } catch {
    }
  }
  function findModElementInList(modName) {
    const container = modsListRef.current;
    if (!container || !modName) return null;
    if (typeof CSS !== "undefined" && CSS.escape) {
      const escaped = CSS.escape(modName);
      const targetEl = container.querySelector(`[data-mod-name="${escaped}"]`);
      if (targetEl) return targetEl;
    }
    return Array.from(container.querySelectorAll("[data-mod-name]")).find(
      (el) => el.dataset.modName === modName
    ) || null;
  }
  function pulseMod(modName) {
    setFocusPulseModName(null);
    requestAnimationFrame(() => setFocusPulseModName(modName));
    clearTimeout(focusPulseTimerRef.current);
    focusPulseTimerRef.current = setTimeout(() => setFocusPulseModName(null), 1200);
  }
  function scrollToMod(modName, align = "center") {
    requestAnimationFrame(() => {
      const container = modsListRef.current;
      const targetEl = findModElementInList(modName);
      if (!container || !targetEl) return;
      const containerRect = container.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const topEdge = containerRect.top + 16;
      const bottomEdge = containerRect.bottom - 16;
      let nextScrollTop = container.scrollTop;
      if (align === "top") {
        nextScrollTop += targetRect.top - topEdge;
      } else if (align === "center") {
        const visibleCenter = (topEdge + bottomEdge) / 2;
        nextScrollTop += targetRect.top + targetRect.height / 2 - visibleCenter;
      } else if (targetRect.top < topEdge) {
        nextScrollTop += targetRect.top - topEdge;
      } else if (targetRect.bottom > bottomEdge) {
        nextScrollTop += targetRect.bottom - bottomEdge;
      }
      const maxScrollTop = Math.max(container.scrollHeight - container.clientHeight, 0);
      nextScrollTop = Math.max(0, Math.min(nextScrollTop, maxScrollTop));
      container.scrollTo({ top: nextScrollTop, behavior: "smooth" });
      pulseMod(modName);
    });
  }
  function selectLocalCollectionVariant(identity, variant) {
    if (!identity || !variant) return;
    setOpenLocalCollectionGalleryMenu(null);
    setSelectedLocalCollectionVariants((prev) => ({
      ...prev,
      [identity]: variant.path
    }));
    if (viewMode === "gallery" && selectedMod?.name) {
      captureGalleryAnchor(selectedMod.name);
    }
    setSelectedMod(variant);
    setDetailCollapsed(false);
  }
  function focusNextEnabledMod() {
    const enabledMods = displayMods.filter((mod) => mod.enabled);
    if (enabledMods.length === 0) {
      enabledFocusCursorRef.current = -1;
      setToast({ type: "error", message: "当前没有启用的 Mod" });
      return;
    }
    enabledFocusCursorRef.current = (enabledFocusCursorRef.current + 1) % enabledMods.length;
    const targetMod = enabledMods[enabledFocusCursorRef.current];
    if (viewMode === "gallery") {
      if (selectedMod?.name) captureGalleryAnchor(selectedMod.name);
    }
    setDetailCollapsed(false);
    setSelectedMod(targetMod);
    scrollToMod(targetMod.name);
    setToast({
      type: "success",
      message: enabledMods.length > 1 ? `已定位 ${targetMod.name} (${enabledFocusCursorRef.current + 1}/${enabledMods.length})` : `已定位 ${targetMod.name}`
    });
  }
  reactExports.useEffect(() => {
    loadMods({ syncCharacterCache: true, conflictDelay: 650 });
    const cleanup = window.api.onModsChanged?.((data) => {
      if (data.characterName === characterName || data.characterName === "__all__") {
        loadMods({ syncCharacterCache: true, conflictDelay: 900 });
      }
    });
    return () => {
      if (cleanup) cleanup();
    };
  }, [characterName]);
  reactExports.useEffect(() => window.api.onHotkeysChanged?.((data) => {
    const selected = selectedModRef.current;
    if (data.gameId !== activeGameId || !selected) return;
    if (data.characterName !== "__all__" && data.characterName !== characterName) return;
    if (data.modName && data.modName !== selected.name) return;
    loadModDetails(selected.name);
  }), [characterName, activeGameId]);
  reactExports.useEffect(() => {
    enabledFocusCursorRef.current = -1;
  }, [characterName, sortMethod, modSearchQuery, selectedTagFilters]);
  reactExports.useLayoutEffect(() => {
    if (displayMods.length > 0 && modsListRef.current && !scrollRestoredRef.current) {
      scrollRestoredRef.current = true;
      modsListRef.current.scrollTop = initialViewState.scrollTop || 0;
    }
  }, [initialViewState.scrollTop, displayMods]);
  reactExports.useEffect(() => {
    persistModViewState({ selectedModName: selectedMod?.name || null });
  }, [modViewStateStorageKey, selectedMod?.name]);
  reactExports.useEffect(() => {
    if (!selectedLocalCollection?.identity || !selectedMod?.path) return;
    setSelectedLocalCollectionVariants((prev) => prev[selectedLocalCollection.identity] === selectedMod.path ? prev : { ...prev, [selectedLocalCollection.identity]: selectedMod.path });
  }, [selectedLocalCollection?.identity, selectedMod?.path]);
  reactExports.useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending || pending.characterName !== characterName || displayMods.length === 0 || !modsListRef.current || modsLoadVersion < (pending.targetLoadVersion || 0)) {
      return;
    }
    const targetMod = displayMods.find((mod) => mod.name === pending.modName) || (pending.forceTop && pending.preferTopAfterSort ? displayMods[0] : null);
    pendingFocusRef.current = null;
    if (!targetMod) return;
    const container = modsListRef.current;
    setSelectedMod(targetMod);
    requestAnimationFrame(() => {
      let targetEl = null;
      if (typeof CSS !== "undefined" && CSS.escape) {
        targetEl = container.querySelector(`[data-mod-name="${CSS.escape(targetMod.name)}"]`);
      }
      if (!targetEl) {
        targetEl = Array.from(container.querySelectorAll("[data-mod-name]")).find(
          (el) => el.dataset.modName === targetMod.name
        );
      }
      if (!targetEl) return;
      const containerRect = container.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const topEdge = containerRect.top + 16;
      const bottomEdge = containerRect.bottom - 16;
      const shouldStickToTop = pending.forceTop || pending.preferTopAfterSort;
      let nextScrollTop = container.scrollTop;
      if (shouldStickToTop || targetRect.top < topEdge) {
        nextScrollTop += targetRect.top - topEdge;
      } else if (targetRect.bottom > bottomEdge) {
        nextScrollTop += targetRect.bottom - bottomEdge;
      }
      nextScrollTop = Math.max(0, Math.min(
        nextScrollTop,
        Math.max(container.scrollHeight - container.clientHeight, 0)
      ));
      container.scrollTo({ top: nextScrollTop, behavior: "smooth" });
      setFocusPulseModName(null);
      requestAnimationFrame(() => setFocusPulseModName(targetMod.name));
      clearTimeout(focusPulseTimerRef.current);
      focusPulseTimerRef.current = setTimeout(() => setFocusPulseModName(null), 1200);
    });
  }, [displayMods, sortMethod, characterName, modsLoadVersion]);
  reactExports.useEffect(() => {
    applySort(
      mods.filter((mod) => getModAppearanceSectionId(mod) === activeAppearanceSectionId),
      sortMethod
    );
    localStorage.setItem("modview-sort", sortMethod);
  }, [mods, sortMethod, modInteractionOrder, modSearchQuery, selectedTagFilters, activeAppearanceSectionId]);
  reactExports.useEffect(() => {
    return () => {
      modViewUnmountedRef.current = true;
      clearTimeout(focusPulseTimerRef.current);
      clearTimeout(conflictRefreshTimerRef.current);
      conflictRequestSeqRef.current += 1;
    };
  }, []);
  reactExports.useEffect(() => {
    const cleanup = window.api.onNevernessPakToggleProgress?.((progress) => {
      if (!progress || progress.characterName !== characterName) return;
      clearTimeout(pakToggleProgressTimerRef.current);
      setPakToggleProgress(progress);
      if (progress.status === "done" || progress.status === "error") {
        pakToggleProgressTimerRef.current = setTimeout(() => setPakToggleProgress(null), 1100);
      }
    });
    return () => {
      if (cleanup) cleanup();
      clearTimeout(pakToggleProgressTimerRef.current);
    };
  }, [characterName]);
  reactExports.useEffect(() => {
    if (devMode && !markModeUnlocked) {
      setMarkModeUnlocked(true);
      loadMarkedModsFromMain({ migrateLocal: true });
      window.api.markGetMoveRecord?.().then((r) => {
        if (r?.success && r.record) setMarkMoveRecord(r.record);
      });
    } else if (!devMode && markModeUnlocked) {
      setMarkModeUnlocked(false);
    }
  }, [devMode]);
  reactExports.useEffect(() => {
    if (!aiTagLoading) return void 0;
    const startedAt = Date.now();
    setAiTagElapsedSeconds(0);
    const timer = setInterval(() => {
      setAiTagElapsedSeconds(Math.floor((Date.now() - startedAt) / 1e3));
    }, 1e3);
    return () => clearInterval(timer);
  }, [aiTagLoading]);
  reactExports.useEffect(() => {
    if (!aiNameLoading) return void 0;
    const startedAt = Date.now();
    setAiNameElapsedSeconds(0);
    const timer = setInterval(() => {
      setAiNameElapsedSeconds(Math.floor((Date.now() - startedAt) / 1e3));
    }, 1e3);
    return () => clearInterval(timer);
  }, [aiNameLoading]);
  reactExports.useEffect(() => {
    if (!devMode) return;
    loadMarkedModsFromMain({ migrateLocal: true });
    const cleanup = window.api.onMarkedModsChanged?.((data) => {
      if (!data?.gameId || data.gameId === activeGameId) {
        loadMarkedModsFromMain();
      }
    });
    return () => {
      if (cleanup) cleanup();
    };
  }, [devMode, activeGameId]);
  reactExports.useEffect(() => {
    if (!devMode) return;
    async function loadServerTags() {
      try {
        const cfg = await window.api.getConfig();
        const serverUrl = cfg?.config?.serverUrl || "https://qaqm.top";
        const { response: res } = await fetchWithDirectFallback(serverUrl, "/api/tags", {
          expectJson: true,
          timeoutMs: 4e3
        });
        if (!res.ok) throw new Error(`Tag API HTTP ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data)) setServerTags(data);
        else if (data.tags) setServerTags(data.tags);
        serverTagsLastFetchRef.current = Date.now();
      } catch (e) {
        console.error("Failed to load server tags:", e);
      }
    }
    loadServerTags();
  }, [devMode]);
  reactExports.useEffect(() => {
    if (!devMode || !selectedMod?.path) {
      setModTags([]);
      return;
    }
    window.api.devGetModTags(selectedMod.path).then((r) => {
      const raw = r?.tags || [];
      setModTags(raw.map((t) => typeof t === "string" ? t : t?.name || "").filter(Boolean));
    });
  }, [devMode, selectedMod?.path]);
  const captureGalleryAnchor = (modName) => {
    if (viewMode !== "gallery") return;
    const container = modsListRef.current;
    if (!container || !modName) {
      galleryAnchorRef.current = null;
      return;
    }
    let el = null;
    if (typeof CSS !== "undefined" && CSS.escape) {
      el = container.querySelector(`[data-mod-name="${CSS.escape(modName)}"]`);
    }
    if (!el) {
      el = Array.from(container.querySelectorAll("[data-mod-name]")).find(
        (node) => node.dataset.modName === modName
      );
    }
    if (!el) {
      galleryAnchorRef.current = null;
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    galleryAnchorRef.current = {
      modName,
      offsetFromTop: elRect.top - containerRect.top
    };
  };
  reactExports.useEffect(() => {
    if (viewMode !== "gallery") return;
    const anchor = galleryAnchorRef.current;
    if (!anchor) return;
    const container = modsListRef.current;
    if (!container) return;
    let canceled = false;
    const startTime = performance.now();
    const duration = 560;
    const step = (now) => {
      if (canceled) return;
      let el = null;
      if (typeof CSS !== "undefined" && CSS.escape) {
        el = container.querySelector(`[data-mod-name="${CSS.escape(anchor.modName)}"]`);
      }
      if (!el) {
        el = Array.from(container.querySelectorAll("[data-mod-name]")).find(
          (node) => node.dataset.modName === anchor.modName
        );
      }
      if (el) {
        const currentOffset = el.getBoundingClientRect().top - container.getBoundingClientRect().top;
        const delta = currentOffset - anchor.offsetFromTop;
        if (Math.abs(delta) > 0.5) container.scrollTop += delta;
      }
      if (now - startTime < duration) {
        requestAnimationFrame(step);
      } else {
        galleryAnchorRef.current = null;
      }
    };
    requestAnimationFrame(step);
    return () => {
      canceled = true;
    };
  }, [detailCollapsed, viewMode]);
  reactExports.useEffect(() => {
    if (!selectedMod) return;
    const handlePaste = (e) => {
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type && item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          if (!blob) continue;
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = async () => {
            try {
              const dataUrl = reader.result;
              const result = await window.api.setModPreviewFromData(characterName, selectedMod.name, dataUrl);
              if (result?.success) {
                _previewAspectRatioCache.delete(selectedMod.path || selectedMod.name);
                setImageKey(Date.now());
                if (result.previewUrl) setPreviewImage(result.previewUrl);
                else loadModDetails(selectedMod.name);
                setToast({ type: "success", message: "✨ 已粘贴图片作为预览！" });
              } else {
                setToast({ type: "error", message: "粘贴失败：" + (result?.error || "未知错误") });
              }
            } catch (err) {
              setToast({ type: "error", message: "粘贴失败：" + (err?.message || String(err)) });
            }
          };
          reader.readAsDataURL(blob);
          return;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [selectedMod, characterName]);
  reactExports.useEffect(() => {
    setIsRenamingMod(false);
    setRenameModDraft("");
    setIsEditingNotes(false);
    setNotesDraft("");
    setEditingAliasSection(null);
    setAliasDraft("");
  }, [selectedMod?.path]);
  reactExports.useEffect(() => {
    if (selectedMod) {
      const cachedAspectRatio = _previewAspectRatioCache.get(selectedMod.path || selectedMod.name);
      if (cachedAspectRatio) setPreviewImageAspectRatio(cachedAspectRatio);
      loadModDetails(selectedMod.name);
      const cached = _aiSuggestCache.get(selectedMod.path);
      if (cached) {
        setAiNameResult(cached);
      } else if (devMode) {
        setAiNameResult(null);
        window.api.devLoadAiSuggestCache({ modPath: selectedMod.path }).then((r) => {
          if (r?.result && r.result.groups) {
            _aiSuggestCache.set(selectedMod.path, r.result);
            setAiNameResult(r.result);
          }
        }).catch(() => {
        });
      } else {
        setAiNameResult(null);
      }
    } else {
      setPreviewImage(null);
      setPreviewImageAspectRatio(DEFAULT_PREVIEW_ASPECT_RATIO);
      detailRequestRef.current++;
      setHotkeyGroups([]);
      setIsRefreshingHotkeys(false);
      setAiNameResult(null);
    }
  }, [selectedMod]);
  reactExports.useEffect(() => {
    if (!managerTarget || managerTarget.characterName !== characterName || !managerTarget.modName || mods.length === 0) {
      return;
    }
    if (managerTarget.requestId && handledManagerTargetRef.current === managerTarget.requestId) {
      return;
    }
    const targetMod = mods.find((mod) => mod.name === managerTarget.modName);
    if (!targetMod) {
      handledManagerTargetRef.current = managerTarget.requestId || managerTarget.modName;
      setToast({ type: "error", message: `未找到 Mod：${managerTarget.modName}` });
      return;
    }
    handledManagerTargetRef.current = managerTarget.requestId || targetMod.name;
    setSelectedMod(targetMod);
    scrollToMod(targetMod.name, "center");
  }, [managerTarget, mods, characterName]);
  reactExports.useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3e3);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  function sortPinnedModsFirst(list, sortRest) {
    const pinned = list.filter((mod) => mod.pinned).sort((a, b) => {
      const diff = (a.pinnedIndex ?? Number.MAX_SAFE_INTEGER) - (b.pinnedIndex ?? Number.MAX_SAFE_INTEGER);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name, "zh-CN");
    });
    const normal = list.filter((mod) => !mod.pinned);
    if (typeof sortRest === "function") {
      normal.sort(sortRest);
    }
    return [...pinned, ...normal];
  }
  function applySort(list, method) {
    let filtered = list;
    if (modSearchQuery) {
      const q = modSearchQuery.toLowerCase();
      filtered = list.filter((m) => {
        if (m.name && m.name.toLowerCase().includes(q)) return true;
        if (Array.isArray(m.tags) && m.tags.some((t) => String(t).toLowerCase().includes(q))) return true;
        if (m.notes && String(m.notes).toLowerCase().includes(q)) return true;
        return false;
      });
    }
    if (selectedTagFilters.size > 0) {
      filtered = filtered.filter((m) => {
        if (!Array.isArray(m.tags) || m.tags.length === 0) return false;
        const modTagKeys = new Set(m.tags.map((t) => String(t).toLowerCase()));
        for (const sel of selectedTagFilters) {
          if (!modTagKeys.has(sel)) return false;
        }
        return true;
      });
    }
    if (method === "custom") {
      setSortedMods(sortPinnedModsFirst(filtered));
      return;
    }
    const order = modInteractionOrder;
    const sorted = sortPinnedModsFirst(filtered, (a, b) => {
      if (method === "name") {
        return a.name.localeCompare(b.name, "zh-CN");
      } else if (method === "time") {
        const timeDiff = (b.addedAtMs || 0) - (a.addedAtMs || 0);
        if (timeDiff !== 0) return timeDiff;
        return a.name.localeCompare(b.name, "zh-CN");
      } else if (method === "enabled") {
        const aIdx = order.indexOf(a.name);
        const bIdx = order.indexOf(b.name);
        const aInteracted = aIdx !== -1;
        const bInteracted = bIdx !== -1;
        if (aInteracted && !bInteracted) return -1;
        if (!aInteracted && bInteracted) return 1;
        if (aInteracted && bInteracted) return aIdx - bIdx;
        return a.name.localeCompare(b.name, "zh-CN");
      }
      return 0;
    });
    setSortedMods(sorted);
  }
  function handleModDragStart(e, mod) {
    setDraggedMod(mod);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", mod.name);
    setTimeout(() => {
      e.target.style.opacity = "0.5";
    }, 0);
  }
  function handleModDragEnd(e) {
    e.target.style.opacity = "1";
    setDraggedMod(null);
    setDragOverMod(null);
  }
  async function handleModDrop(e, targetMod) {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedMod || draggedMod.name === targetMod.name) {
      setDraggedMod(null);
      setDragOverMod(null);
      return;
    }
    const reorderedVisibleMods = [...sortedMods];
    const draggedIndex = reorderedVisibleMods.findIndex((m) => m.name === draggedMod.name);
    const targetIndex = reorderedVisibleMods.findIndex((m) => m.name === targetMod.name);
    if (draggedIndex !== -1 && targetIndex !== -1) {
      const [removed] = reorderedVisibleMods.splice(draggedIndex, 1);
      reorderedVisibleMods.splice(targetIndex, 0, removed);
      const reorderedNames = new Set(reorderedVisibleMods.map((mod) => mod.name));
      const replacementQueue = [...reorderedVisibleMods];
      const mergedOrder = mods.map((mod) => getModAppearanceSectionId(mod) === activeAppearanceSectionId && reorderedNames.has(mod.name) ? replacementQueue.shift() : mod);
      setSortedMods(reorderedVisibleMods);
      setMods(mergedOrder);
      setSortMethod("custom");
      try {
        const orderArray = mergedOrder.map((m) => m.name);
        await window.api.saveModOrder(characterName, orderArray);
        setToast({ type: "success", message: "✨ Mod 顺序已保存" });
      } catch (err) {
        console.error("Failed to save mod order:", err);
      }
    }
    setDraggedMod(null);
    setDragOverMod(null);
  }
  async function loadMods({ syncCharacterCache = false, refreshConflicts = true, conflictDelay = 650 } = {}) {
    try {
      const result = await window.api.getMods(characterName);
      if (!result?.success) throw new Error(result?.error || "读取 Mod 失败");
      setModsLoadError("");
      const nextMods = Array.isArray(result.mods) ? result.mods : [];
      let nextSections = Array.isArray(result.sections) ? result.sections : [];
      if (nextSections.length === 0 && window.api?.getCharacterSections) {
        try {
          const sectionResult = await callAppearanceSectionApi("list", { characterName });
          nextSections = Array.isArray(sectionResult?.sections) ? sectionResult.sections : Array.isArray(sectionResult) ? sectionResult : [];
        } catch (_) {
        }
      }
      const availableSectionIds = new Set(nextSections.map(getSectionId));
      const requestedSectionId = activeAppearanceSectionIdRef.current || BASE_SECTION_ID;
      const targetSectionId = availableSectionIds.size === 0 || availableSectionIds.has(requestedSectionId) ? requestedSectionId : BASE_SECTION_ID;
      if (targetSectionId !== activeAppearanceSectionIdRef.current) {
        activeAppearanceSectionIdRef.current = targetSectionId;
        setActiveAppearanceSectionId(targetSectionId);
      }
      setAppearanceSections(nextSections);
      setMods(nextMods);
      setCharacterAliases(Array.isArray(result.characterAliases) ? result.characterAliases : []);
      if (syncCharacterCache) {
        onCharacterModsChanged?.({ characterName, mods: nextMods });
      }
      setModsLoadVersion((prev) => prev + 1);
      setSelectedMod((prev) => {
        const sectionMods = nextMods.filter(
          (mod) => getModAppearanceSectionId(mod) === targetSectionId
        );
        if (sectionMods.length === 0) return null;
        const preferredName = pendingFocusRef.current?.modName || initialViewState.selectedModName;
        const restoredMod = preferredName ? sectionMods.find((mod) => mod.name === preferredName) : null;
        if (restoredMod) return restoredMod;
        const stillExists = sectionMods.find((mod) => mod.name === prev?.name);
        return stillExists || sectionMods[0];
      });
      if (refreshConflicts) {
        scheduleConflictRefresh(conflictDelay);
      }
    } catch (error) {
      setModsLoadError(error?.message || String(error));
      setCharacterAliases([]);
      pendingFocusRef.current = null;
    }
  }
  function selectAppearanceSection(sectionId) {
    const nextSectionId = String(sectionId || BASE_SECTION_ID);
    activeAppearanceSectionIdRef.current = nextSectionId;
    setActiveAppearanceSectionId(nextSectionId);
    try {
      localStorage.setItem(appearanceSectionStorageKey, nextSectionId);
    } catch {
    }
  }
  async function handleSaveCustomAppearanceSection({ section, name, nameEn, coverImagePath }) {
    setAppearanceSectionBusy(true);
    try {
      let result;
      if (section) {
        result = ensureAppearanceApiResult(
          await callAppearanceSectionApi("update", {
            characterName,
            sectionId: getSectionId(section),
            name,
            nameEn
          }),
          "分区更新失败"
        );
        if (coverImagePath) {
          ensureAppearanceApiResult(
            await callAppearanceSectionApi("setCover", {
              characterName,
              sectionId: getSectionId(section),
              imagePath: coverImagePath
            }),
            "分区封面保存失败"
          );
        }
      } else {
        result = ensureAppearanceApiResult(
          await callAppearanceSectionApi("create", {
            characterName,
            name,
            nameEn,
            coverImagePath
          }),
          "分区创建失败"
        );
      }
      const savedSection = result?.section || result;
      const savedSectionId = savedSection?.sectionId || savedSection?.id || (section ? getSectionId(section) : "");
      if (savedSectionId) selectAppearanceSection(savedSectionId);
      await loadMods({ refreshConflicts: false });
      setToast({ type: "success", message: section ? `已更新分区「${name}」` : `已创建分区「${name}」` });
      return result;
    } catch (error) {
      setToast({ type: "error", message: error?.message || String(error) });
      throw error;
    } finally {
      setAppearanceSectionBusy(false);
    }
  }
  async function handleDeleteCustomAppearanceSection(section) {
    const sectionId = getSectionId(section);
    setAppearanceSectionBusy(true);
    try {
      const result = ensureAppearanceApiResult(
        await callAppearanceSectionApi("delete", { characterName, sectionId }),
        "分区删除失败"
      );
      if (activeAppearanceSectionIdRef.current === sectionId) selectAppearanceSection(BASE_SECTION_ID);
      await loadMods({ syncCharacterCache: true, conflictDelay: 900 });
      setToast({
        type: "success",
        message: Number(result?.reassignedCount || 0) > 0 ? `分区已删除，${result.reassignedCount} 个 Mod 已归回原角色` : "分区已删除"
      });
      return result;
    } catch (error) {
      setToast({ type: "error", message: error?.message || String(error) });
      throw error;
    } finally {
      setAppearanceSectionBusy(false);
    }
  }
  async function handleAssignSelectedModAppearanceSection(sectionId) {
    if (!selectedMod || getModAppearanceSectionId(selectedMod) === sectionId) return;
    const targetSection = appearanceSectionsWithStats.find((section) => getSectionId(section) === sectionId);
    setAppearanceSectionBusy(true);
    try {
      ensureAppearanceApiResult(
        await callAppearanceSectionApi("assign", {
          characterName,
          modName: selectedMod.name,
          sectionId
        }),
        "Mod 分区调整失败"
      );
      const movedModName = selectedMod.name;
      pendingFocusRef.current = {
        characterName,
        modName: movedModName,
        targetLoadVersion: modsLoadVersion + 1
      };
      selectAppearanceSection(sectionId);
      await loadMods({ syncCharacterCache: true, conflictDelay: 900 });
      setToast({ type: "success", message: `已将 ${movedModName} 移到「${getSectionName(targetSection)}」` });
    } catch (error) {
      setToast({ type: "error", message: error?.message || String(error) });
    } finally {
      setAppearanceSectionBusy(false);
    }
  }
  function toggleBatchSelect(modName) {
    setSelectedMods((prev) => {
      const next = new Set(prev);
      if (next.has(modName)) next.delete(modName);
      else next.add(modName);
      return next;
    });
  }
  function selectAllMods() {
    setSelectedMods(new Set(displayMods.map((m) => m.name)));
  }
  function deselectAllMods() {
    setSelectedMods(/* @__PURE__ */ new Set());
  }
  async function batchToggle(enable) {
    let count = 0;
    for (const modName of selectedMods) {
      const mod = mods.find((m) => m.name === modName);
      if (!mod) continue;
      if (enable && !mod.enabled) {
        await window.api.toggleMod(characterName, modName, true);
        count++;
      } else if (!enable && mod.enabled) {
        await window.api.toggleMod(characterName, modName, false);
        count++;
      }
    }
    if (count > 0) {
      recordCharacterUsage(count);
      setToast({ type: "success", message: `✨ 已${enable ? "启用" : "禁用"} ${count} 个 Mod` });
      await loadMods({ syncCharacterCache: true, conflictDelay: 1200 });
    }
    setSelectedMods(/* @__PURE__ */ new Set());
  }
  async function batchDelete() {
    if (!confirm(`确定把选中的 ${selectedMods.size} 个 Mod 移入回收站？`)) return;
    let count = 0;
    for (const modName of selectedMods) {
      try {
        await window.api.deleteMod(characterName, modName);
        count++;
      } catch (e) {
        console.error(`Failed to delete ${modName}:`, e);
      }
    }
    setToast({ type: "success", message: `已将 ${count} 个 Mod 移入回收站` });
    setSelectedMods(/* @__PURE__ */ new Set());
    setSelectedMod(null);
    await loadMods({ syncCharacterCache: count > 0, conflictDelay: 900 });
  }
  function scheduleConflictRefresh(delay = 650) {
    if (modViewUnmountedRef.current) return;
    if (conflictRefreshTimerRef.current) {
      clearTimeout(conflictRefreshTimerRef.current);
    }
    conflictRefreshTimerRef.current = setTimeout(() => {
      conflictRefreshTimerRef.current = null;
      loadConflicts();
    }, delay);
  }
  async function loadConflicts() {
    if (modViewUnmountedRef.current) return;
    if (conflictRefreshInFlightRef.current) {
      conflictRefreshQueuedRef.current = true;
      return;
    }
    const requestCharacterName = characterNameRef.current;
    const requestSeq = ++conflictRequestSeqRef.current;
    conflictRefreshInFlightRef.current = true;
    try {
      const result = await window.api.detectModConflicts(requestCharacterName);
      if (modViewUnmountedRef.current || requestSeq !== conflictRequestSeqRef.current || requestCharacterName !== characterNameRef.current) {
        return;
      }
      if (result.success && result.conflicts) {
        setConflicts(result.conflicts);
        const map = {};
        for (const c of result.conflicts) {
          for (const modName of c.mods) {
            if (!map[modName]) map[modName] = [];
            const others = c.mods.filter((m) => m !== modName);
            map[modName].push({ hash: c.hash, otherMods: others });
          }
        }
        setConflictMap(map);
      }
    } catch (e) {
      console.error("Failed to detect conflicts:", e);
    } finally {
      conflictRefreshInFlightRef.current = false;
      if (!modViewUnmountedRef.current && conflictRefreshQueuedRef.current) {
        conflictRefreshQueuedRef.current = false;
        scheduleConflictRefresh(900);
      }
    }
  }
  const loadModDetails = async (name, refresh = false) => {
    const requestId = ++detailRequestRef.current;
    const isCurrent = () => requestId === detailRequestRef.current && !modViewUnmountedRef.current && characterNameRef.current === characterName && selectedModRef.current?.name === name;
    setIsRefreshingHotkeys(refresh);
    setEditingHotkey(null);
    setEditingAliasSection(null);
    try {
      const result = await window.api.getModDetails(characterName, name, refresh);
      if (!isCurrent()) return;
      if (result.success) {
        setPreviewImage(result.previewUrl);
        setHotkeyGroups((Array.isArray(result.hotkeyGroups) ? result.hotkeyGroups : [{ name, hotkeys: result.hotkeys || [] }]).filter(group => group.hotkeys?.length));
        if (refresh) setToast({ type: "success", message: "快捷键已刷新" });
      } else {
        setHotkeyGroups([]);
        setToast({ type: "error", message: result.error || "无法读取 Mod 详情" });
      }
    } catch (error) {
      if (!isCurrent()) return;
      setHotkeyGroups([]);
      console.error("Failed to load mod details:", error);
      setToast({ type: "error", message: error.message || "无法读取 Mod 详情" });
    } finally {
      if (isCurrent()) {
        setIsRefreshingHotkeys(false);
      }
    }
  };
  async function handleToggle(modName, currentStatus, e) {
    if (e) e.stopPropagation();
    const newState = !currentStatus;
    pendingFocusRef.current = {
      characterName,
      modName,
      scrollTop: modsListRef.current?.scrollTop || 0,
      targetLoadVersion: modsLoadVersion + 1,
      forceTop: sortMethod === "enabled" && newState,
      preferTopAfterSort: sortMethod === "enabled" && newState
    };
    setModInteractionOrder((prev) => {
      const next = [modName, ...prev.filter((n) => n !== modName)];
      try {
        localStorage.setItem(`modview-interaction-order-${characterName}`, JSON.stringify(next));
      } catch {
      }
      return next;
    });
    if (exclusiveMode && newState) {
      for (const m of mods) {
        if (m.name !== modName && m.enabled) {
          await window.api.toggleMod(characterName, m.name, false);
        }
      }
    }
    const result = await window.api.toggleMod(characterName, modName, newState);
    if (result.success) {
      recordCharacterUsage(1);
      await loadMods({ syncCharacterCache: true, conflictDelay: 1200 });
      if (result.persistRestored) {
        setToast({ type: "success", message: `已恢复 ${modName} 的配件状态` });
      }
    } else {
      pendingFocusRef.current = null;
      setToast({ type: "error", message: "操作失败: " + result.error });
    }
  }
  async function handlePinMod(modName, nextPinned, e) {
    if (e) e.stopPropagation();
    pendingFocusRef.current = {
      characterName,
      modName,
      scrollTop: nextPinned ? 0 : modsListRef.current?.scrollTop || 0,
      targetLoadVersion: modsLoadVersion + 1,
      forceTop: nextPinned
    };
    const result = await window.api.pinMod(characterName, modName, nextPinned);
    if (result.success) {
      await loadMods();
      setToast({ type: "success", message: nextPinned ? `📌 ${modName} 已置顶` : `已取消 ${modName} 的置顶` });
    } else {
      pendingFocusRef.current = null;
      setToast({ type: "error", message: "置顶失败: " + result.error });
    }
  }
  function toggleExclusiveMode() {
    const next = !exclusiveMode;
    setExclusiveMode(next);
    persistModViewPreferences({ exclusiveMode: next });
    if (next) setToast({ type: "success", message: "🔘 单选模式已开启" });
  }
  async function loadMarkedModsFromMain({ migrateLocal = false } = {}) {
    const result = await window.api.devGetMarkedMods?.(activeGameId);
    if (result?.success) {
      const local = readMarkedMods();
      const next = flattenMarkedMods(result.marked, activeGameId);
      if (migrateLocal) {
        for (const [path, item] of Object.entries(local)) {
          if (!item || item.gameId !== activeGameId || next[path]) continue;
          if (!item.characterName || !item.name) continue;
          next[path] = item;
          await window.api.devMarkMod?.(activeGameId, item.characterName, item.name, path);
        }
      }
      writeMarkedMods(next);
      setMarkedMods(next);
      return next;
    }
    const fallback = readMarkedMods();
    setMarkedMods(fallback);
    return fallback;
  }
  async function handleMarkMod(mod, e) {
    e.stopPropagation();
    const next = { ...readMarkedMods() };
    const existingKey = findMarkedModKey(next, mod, characterName, activeGameId);
    if (existingKey) {
      delete next[existingKey];
      writeMarkedMods(next);
      setMarkedMods(next);
      await window.api.devUnmarkMod?.(activeGameId, characterName, mod.name);
    } else {
      next[mod.path] = {
        name: mod.name,
        originalName: mod.originalName,
        characterName,
        gameId: activeGameId,
        path: mod.path,
        markedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      writeMarkedMods(next);
      setMarkedMods(next);
      await window.api.devMarkMod?.(activeGameId, characterName, mod.name, mod.path);
    }
  }
  async function handleMarkPasswordSubmit() {
    const result = await window.api.devUnlock?.(markPasswordInput);
    if (result?.success) {
      setMarkModeUnlocked(true);
      setShowMarkPasswordModal(false);
      setMarkPasswordError("");
      loadMarkedModsFromMain({ migrateLocal: true });
      window.api.markGetMoveRecord().then((r) => {
        if (r?.success && r.record) setMarkMoveRecord(r.record);
      });
    } else {
      setMarkPasswordError(result?.error || "标记模式启动失败");
      setMarkPasswordInput("");
    }
  }
  async function handleSelectDestFolder() {
    const result = await window.api.markSelectDestFolder();
    if (result.success) {
      setMarkDestFolder(result.folderPath);
      localStorage.setItem("qaqm-mark-dest", result.folderPath);
    }
  }
  async function handleMoveMarkedMods() {
    const entries = Object.entries(readMarkedMods()).map(([markKey, item]) => ({ ...item, markKey }));
    if (entries.length === 0) {
      setToast({ type: "error", message: "没有已标记的 Mod" });
      return;
    }
    if (!markDestFolder) {
      setToast({ type: "error", message: "请先选择目标文件夹" });
      return;
    }
    setMarkMoving(true);
    try {
      const result = await window.api.markMoveMods(entries, markDestFolder);
      if (!result?.success || !Array.isArray(result.results)) {
        setToast({ type: "error", message: `移动失败：${result?.error || "未知错误"}` });
        return;
      }
      const ok = result.results.filter((r) => r.success).length;
      const failedResults = result.results.filter((r) => !r.success);
      const fail = failedResults.length;
      if (ok > 0) {
        const movedEntries = result.results.filter((r) => r.success);
        const next = { ...readMarkedMods() };
        for (const move of movedEntries) {
          const storedKey = move.markKey && next[move.markKey] ? move.markKey : next[move.src] ? move.src : Object.entries(next).find(([, item]) => item?.name === move.name && item?.characterName === move.characterName && (!item?.gameId || !move.gameId || item.gameId === move.gameId))?.[0];
          const marked = storedKey ? next[storedKey] : move;
          if (marked?.characterName && marked?.name) {
            await window.api.devUnmarkMod?.(marked.gameId || move.gameId || activeGameId, marked.characterName, marked.name);
          }
          if (storedKey) {
            delete next[storedKey];
          }
        }
        writeMarkedMods(next);
        setMarkedMods(next);
        setMarkMoveRecord({ moves: result.results.filter((r) => r.success) });
        await loadMods();
      }
      const failDetail = failedResults.slice(0, 3).map((r) => `${r.name || "未知 Mod"}：${r.error || "未知错误"}`).join("；");
      setToast({ type: fail > 0 ? "error" : "success", message: `移动完成：${ok} 成功${fail > 0 ? `，${fail} 失败。${failDetail}${fail > 3 ? "；..." : ""}` : ""}` });
    } finally {
      setMarkMoving(false);
    }
  }
  async function handleRestoreMarkedMods() {
    if (!markMoveRecord?.moves?.length) {
      setToast({ type: "error", message: "没有可移回的记录" });
      return;
    }
    setMarkMoving(true);
    try {
      const result = await window.api.markRestoreMods(markMoveRecord.moves);
      if (!result?.success || !Array.isArray(result.results)) {
        setToast({ type: "error", message: `移回失败：${result?.error || "未知错误"}` });
        return;
      }
      const ok = result.results.filter((r) => r.success).length;
      const failedResults = result.results.filter((r) => !r.success);
      const fail = failedResults.length;
      if (ok > 0) {
        setMarkMoveRecord(null);
        await loadMods();
      }
      const failDetail = failedResults.slice(0, 3).map((r) => `${r.name || "未知 Mod"}：${r.error || "未知错误"}`).join("；");
      setToast({ type: fail > 0 ? "error" : "success", message: `移回完成：${ok} 成功${fail > 0 ? `，${fail} 失败。${failDetail}${fail > 3 ? "；..." : ""}` : ""}` });
    } finally {
      setMarkMoving(false);
    }
  }
  async function handleClearAllMarks() {
    const entries = Object.values(readMarkedMods());
    for (const entry of entries) {
      if (entry?.characterName && entry?.name) {
        await window.api.devUnmarkMod?.(entry.gameId || activeGameId, entry.characterName, entry.name);
      }
    }
    writeMarkedMods({});
    setMarkedMods({});
    setToast({ type: "success", message: "已清除所有标记" });
  }
  async function saveModTags(tags) {
    if (!selectedMod?.path) return;
    const normalizedTags = tags.map((t) => typeof t === "string" ? t : t?.name || "").filter(Boolean);
    setTagSaving(true);
    try {
      await window.api.devSetModTags(selectedMod.path, normalizedTags);
      setModTags(normalizedTags);
      const cfg = await window.api.getConfig();
      const serverUrl = cfg?.config?.serverUrl || "https://qaqm.top";
      const modFolderName = selectedMod.name;
      for (const tagName of normalizedTags) {
        if (!serverTags.find((t) => t.id === tagName || t.name === tagName)) {
          try {
            const r = await fetch(`${serverUrl}/api/tags`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-admin-key": tagManagerAdminKey },
              body: JSON.stringify({ name: tagName })
            });
            const newTag = await r.json();
            if (newTag?.id) setServerTags((prev) => [...prev, newTag]);
          } catch {
          }
        }
      }
      const modsRes = await fetch(`${serverUrl}/api/mods?gameId=${activeGameId || "endfield"}`);
      const modsData = await modsRes.json();
      const allMods = modsData.mods || modsData.data || [];
      const serverMod = allMods.find((m) => m.name === modFolderName);
      if (serverMod) {
        await fetch(`${serverUrl}/api/games/tags/mod/${serverMod.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagIds: normalizedTags })
        });
      }
      setToast({ type: "success", message: `Tags 已保存${serverMod ? " (本地+服务端)" : " (仅本地)"}` });
    } catch (e) {
      setToast({ type: "error", message: "Tags 保存失败: " + e.message });
    } finally {
      setTagSaving(false);
    }
  }
  function addTagFromInput() {
    const t = tagInput.trim();
    if (!t || modTags.includes(t)) {
      setTagInput("");
      return;
    }
    setModTags((prev) => [...prev, t]);
    setTagInput("");
    setShowTagSuggestions(false);
  }
  async function handleCopyDevModInfo() {
    if (!selectedMod?.path) {
      setToast({ type: "error", message: "请先选择一个 Mod" });
      return;
    }
    setDevInfoBusy(true);
    try {
      const result = await window.api.devCopyModInfo(selectedMod.path, {
        modName: selectedMod.name,
        characterName,
        gameId: activeGameId
      });
      if (!result?.success) throw new Error(result?.error || "复制失败");
      const previewText = result.hasPreview ? "已复制封面" : "无封面";
      setToast({
        type: "success",
        message: `已复制 ${result.sourceModName || selectedMod.name}：${result.tagCount || 0} 个 tag，${previewText}`
      });
    } catch (e) {
      setToast({ type: "error", message: "复制信息失败: " + (e?.message || String(e)) });
    } finally {
      setDevInfoBusy(false);
    }
  }
  async function handleImportDevModInfo() {
    if (!selectedMod?.path) {
      setToast({ type: "error", message: "请先选择目标 Mod" });
      return;
    }
    const targetMod = selectedMod;
    setDevInfoBusy(true);
    try {
      const result = await window.api.devImportModInfo(targetMod.path);
      if (!result?.success) throw new Error(result?.error || "导入失败");
      const importedTags = (result.tags || []).map((t) => typeof t === "string" ? t : t?.name || "").filter(Boolean);
      const patch = {
        tags: importedTags,
        ...result.previewUrl ? { previewUrl: result.previewUrl } : {}
      };
      setMods((prev) => prev.map((mod) => mod.path === targetMod.path || mod.name === targetMod.name ? { ...mod, ...patch } : mod));
      setSelectedMod((prev) => prev && (prev.path === targetMod.path || prev.name === targetMod.name) ? { ...prev, ...patch } : prev);
      _previewAspectRatioCache.delete(targetMod.path || targetMod.name);
      const currentSelected = selectedModRef.current;
      if (currentSelected?.path === targetMod.path || currentSelected?.name === targetMod.name) {
        setModTags(importedTags);
        setImageKey(Date.now());
        if (result.previewUrl) setPreviewImage(result.previewUrl);
        else await loadModDetails(targetMod.name, false);
      }
      setToast({
        type: "success",
        message: `已导入 ${result.sourceModName || "已复制 Mod"} 的 ${result.tagCount || 0} 个 tag${result.copiedImage ? "和封面" : ""}`
      });
    } catch (e) {
      setToast({ type: "error", message: "导入 tag&图片失败: " + (e?.message || String(e)) });
    } finally {
      setDevInfoBusy(false);
    }
  }
  async function handleAiSuggestTags() {
    if (!selectedMod?.path) return;
    setAiTagLoading(true);
    setShowAiTagModal(true);
    setAiTagSuggestions([]);
    setAiTagEmptyReason("");
    setAiTagStage("正在读取 Mod 信息...");
    try {
      const details = await window.api.getModDetails(characterName, selectedMod.name);
      const previewUrl = details?.previewUrl || null;
      setAiTagStage("正在准备 Tag 池...");
      const latestTags = serverTags.length > 0 ? serverTags : await reloadServerTags({ force: true, timeoutMs: 8e3 });
      const tagPool = new Set(latestTags.map((t) => t.name).filter(Boolean));
      if (tagPool.size === 0) throw new Error("Tag 池为空或加载超时，请刷新 Tag 池后重试。");
      const allTagNames = [...tagPool].join(", ");
      const messages = [
        {
          role: "user",
          content: previewUrl ? [
            { type: "text", text: `这是一个游戏mod，名称为"${selectedMod.name}"，角色为"${characterName}"。当前tag池：${allTagNames || "(空)"}。请根据mod名称和图片，推荐5-8个合适的tag（中文）。必须只从当前tag池中精确选择已有tag，禁止创造、改写、翻译或返回tag池中不存在的tag；如果tag池为空或没有合适tag，返回[]。只返回JSON数组，格式：["tag1","tag2",...]` },
            { type: "image_url", image_url: { url: previewUrl } }
          ] : [{ type: "text", text: `这是一个游戏mod，名称为"${selectedMod.name}"，角色为"${characterName}"。当前tag池：${allTagNames || "(空)"}。请推荐5-8个合适的tag（中文）。必须只从当前tag池中精确选择已有tag，禁止创造、改写、翻译或返回tag池中不存在的tag；如果tag池为空或没有合适tag，返回[]。只返回JSON数组，格式：["tag1","tag2",...]` }]
        }
      ];
      setAiTagStage(previewUrl ? "AI 正在分析图片和 Tag 池..." : "AI 正在分析名称和 Tag 池...");
      const res = await window.api.devAiSuggest({ messages, max_tokens: 300, temperature: 0.2 });
      if (!res.success) throw new Error(res.error);
      const text = res.content || "[]";
      const match = text.match(/\[[\s\S]*\]/);
      const parsed = match ? JSON.parse(match[0]) : [];
      const rawTags = Array.isArray(parsed) ? parsed.map((name) => String(name || "").trim()).filter(Boolean) : [];
      const suggested = [...new Set((Array.isArray(parsed) ? parsed : []).map((name) => String(name || "").trim()).filter((name) => tagPool.has(name)))];
      if (suggested.length === 0) {
        const reason = tagPool.size === 0 ? "Tag 池为空或未加载成功，AI 没有可选 tag。" : rawTags.length === 0 ? `AI 原始返回为空；当前 Tag 池有 ${tagPool.size} 个。` : `AI 原始返回 ${rawTags.length} 个，但精确匹配 Tag 池后剩 0 个。原始返回：${rawTags.slice(0, 8).join("、")}`;
        setAiTagEmptyReason(reason);
        setToast({ type: "error", message: reason });
      }
      setAiTagSuggestions(suggested.map((name) => ({
        name,
        isNew: false,
        selected: !modTags.includes(name)
      })));
    } catch (e) {
      const reason = "推荐失败：" + (e?.message || String(e));
      setAiTagEmptyReason(reason);
      setToast({ type: "error", message: "AI 推荐失败: " + e.message });
    } finally {
      setAiTagStage("");
      setAiTagLoading(false);
    }
  }
  function applyAiSuggestions() {
    const toAdd = aiTagSuggestions.filter((s) => s.selected).map((s) => s.name);
    const merged = [.../* @__PURE__ */ new Set([...modTags, ...toAdd])];
    setModTags(merged);
    setShowAiTagModal(false);
    setAiTagSuggestions([]);
  }
  function minimizeAiNameModal() {
    setAiNameModalMinimized(true);
  }
  function expandAiNameModal() {
    if (aiNameTaskTarget?.path) {
      const targetMod = mods.find((mod) => mod.path === aiNameTaskTarget.path || mod.name === aiNameTaskTarget.modName);
      if (targetMod) setSelectedMod(targetMod);
    }
    setShowAiNameModal(true);
    setAiNameModalMinimized(false);
  }
  function closeAiNameTask() {
    setShowAiNameModal(false);
    setAiNameModalMinimized(false);
    if (!aiNameLoading) {
      setAiNameTaskTarget(null);
      setAiNameTaskResult(null);
      setAiNameTaskError("");
    }
  }
  async function handleAiSuggestName() {
    if (!selectedMod?.path) return;
    const taskTarget = {
      characterName,
      modName: selectedMod.name,
      path: selectedMod.path,
      gameId: activeGameId || "unknown"
    };
    setAiNameTaskTarget(taskTarget);
    setAiNameTaskResult(null);
    setAiNameTaskError("");
    setAiNameLoading(true);
    setShowAiNameModal(true);
    setAiNameModalMinimized(false);
    setAiNameStage("正在读取 Mod 信息...");
    try {
      const details = await window.api.getModDetails(taskTarget.characterName, taskTarget.modName);
      const previewUrl = details?.previewUrl || null;
      setAiNameStage("正在准备 Tag 池...");
      const latestTags = serverTags.length > 0 ? serverTags : await reloadServerTags({ force: true, timeoutMs: 8e3 });
      const tagPoolNames = latestTags.map((t) => t.name).filter(Boolean);
      if (tagPoolNames.length === 0) throw new Error("Tag 池为空或加载超时，请刷新 Tag 池后重试。");
      const allTagNames = tagPoolNames.join("、");
      const promptText = `这是一个游戏mod。
当前文件夹名："${taskTarget.modName}"，角色为"${taskTarget.characterName}"
当前tag池：${allTagNames || "(空)"}

请完成以下任务，只返回JSON，不要其他内容：
1. 按三种命名风格各给1-2个名称建议，格式为"角色-mod描述"
   - artistic（意境风）：有意境感的名称，如"余烬-暗夜假日"
   - label（标签风）：直接描述外观特征，如"余烬-黑色蕾丝比基尼"
   - structural（结构风）：描述服装部件组合，如"余烬-蕾丝比基尼配薄纱罩裙"
2. 推荐5-8个tag（中文），必须全部从当前tag池中精确选择已有tag，禁止创造、改写、翻译或返回tag池中不存在的tag；如果tag池为空或没有合适tag，返回[]

返回格式：
{
  "names": {
    "artistic":    [{"character":"${taskTarget.characterName}","modName":"暗夜假日"}],
    "label":       [{"character":"${taskTarget.characterName}","modName":"黑色蕾丝比基尼"}],
    "structural":  [{"character":"${taskTarget.characterName}","modName":"蕾丝比基尼配薄纱罩裙"}]
  },
  "tags": ["tag1","tag2","tag3"]
}`;
      const content = previewUrl ? [{ type: "text", text: promptText }, { type: "image_url", image_url: { url: previewUrl } }] : promptText;
      const messages = [{ role: "user", content }];
      setAiNameStage(previewUrl ? "AI 正在分析图片、命名和 Tag..." : "AI 正在分析命名和 Tag...");
      const res = await window.api.devAiSuggest({
        messages,
        max_tokens: 700,
        response_format: { type: "json_object" },
        temperature: 0.2
      });
      if (!res.success) throw new Error(res.error);
      const text = res.content || "{}";
      const match = text.match(/\{[\s\S]*\}/);
      let groups = [], suggestedTags = [];
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          const styleLabels = { artistic: "意境风", label: "标签风", structural: "结构风" };
          groups = Object.entries(parsed.names || {}).map(([style, items]) => ({
            style,
            label: styleLabels[style] || style,
            items: (items || []).map((s) => ({
              character: s.character || "",
              modName: s.modName || "",
              fullName: s.character ? `${s.character}-${s.modName}` : s.modName
            }))
          })).filter((g) => g.items.length > 0);
          suggestedTags = parsed.tags || [];
        } catch {
        }
      }
      if (groups.length === 0) throw new Error("AI 未返回有效建议，原始内容：" + text.slice(0, 300));
      const serverTagNames = new Set(tagPoolNames);
      const rawTags = Array.isArray(suggestedTags) ? suggestedTags.map((t) => String(t || "").trim()).filter(Boolean) : [];
      const poolTags = [...new Set((Array.isArray(suggestedTags) ? suggestedTags : []).map((t) => String(t || "").trim()).filter((t) => serverTagNames.has(t)))];
      const newTags = [];
      if (poolTags.length === 0) {
        const reason = serverTagNames.size === 0 ? "Tag 池为空或未加载成功，AI 没有可选 tag。" : rawTags.length === 0 ? `AI 原始返回没有 tag；当前 Tag 池有 ${serverTagNames.size} 个。` : `AI 原始返回 ${rawTags.length} 个 tag，但精确匹配 Tag 池后剩 0 个。原始返回：${rawTags.slice(0, 8).join("、")}`;
        setToast({ type: "error", message: reason });
      }
      const result = { groups, tags: poolTags, allTags: poolTags, newTags };
      setAiNameTaskResult(result);
      if (selectedModPathRef.current === taskTarget.path) setAiNameResult(result);
      _aiSuggestCache.set(taskTarget.path, result);
      try {
        await window.api.devSaveAiSuggestCache({ modPath: taskTarget.path, result });
      } catch {
      }
      try {
        await window.api.devSaveAiTags({
          modName: taskTarget.modName,
          characterName: taskTarget.characterName,
          gameId: taskTarget.gameId,
          allTags: poolTags,
          poolTags,
          newTags,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      } catch {
      }
    } catch (e) {
      setAiNameTaskError(e.message);
      setToast({ type: "error", message: "AI 命名推荐失败: " + e.message });
      setAiNameModalMinimized(true);
    } finally {
      setAiNameStage("");
      setAiNameLoading(false);
    }
  }
  async function handleSaveModRename() {
    if (!selectedMod) return;
    const nextName = renameModDraft.trim();
    if (!nextName) {
      setToast({ type: "error", message: "名称不能为空" });
      return;
    }
    if (nextName === selectedMod.name) {
      setIsRenamingMod(false);
      return;
    }
    setRenameModSaving(true);
    try {
      const result = await window.api.renameMod(characterName, selectedMod.name, nextName);
      if (result?.error) {
        setToast({ type: "error", message: "重命名失败：" + result.error });
        return;
      }
      pendingFocusRef.current = {
        characterName,
        modName: nextName,
        scrollTop: modsListRef.current?.scrollTop || 0,
        targetLoadVersion: modsLoadVersion + 1
      };
      setToast({ type: "success", message: `已重命名为「${nextName}」` });
      setIsRenamingMod(false);
      await loadMods();
    } catch (e) {
      setToast({ type: "error", message: "重命名失败：" + (e?.message || String(e)) });
    } finally {
      setRenameModSaving(false);
    }
  }
  async function handleSaveModNotes() {
    if (!selectedMod) return;
    setNotesSaving(true);
    try {
      const result = await window.api.setModMeta(selectedMod.path, { notes: notesDraft });
      if (!result?.success) {
        setToast({ type: "error", message: "备注保存失败：" + (result?.error || "未知错误") });
        return;
      }
      setSelectedMod((prev) => prev ? { ...prev, notes: notesDraft } : prev);
      setMods((prev) => prev.map((m) => m.path === selectedMod.path ? { ...m, notes: notesDraft } : m));
      setIsEditingNotes(false);
      setToast({ type: "success", message: notesDraft ? "备注已保存" : "备注已清空" });
    } catch (e) {
      setToast({ type: "error", message: "备注保存失败：" + (e?.message || String(e)) });
    } finally {
      setNotesSaving(false);
    }
  }
  async function handleSaveHotkeyAlias(section) {
    if (!selectedMod || !section) return;
    setAliasSaving(true);
    try {
      const trimmed = (aliasDraft || "").trim();
      const patch = { [section]: trimmed };
      const result = await window.api.setModMeta(selectedMod.path, { hotkeyAliases: patch });
      if (!result?.success) {
        setToast({ type: "error", message: "快捷键命名保存失败：" + (result?.error || "未知错误") });
        return;
      }
      const mergeAliases = (prev) => {
        const current = prev && typeof prev.hotkeyAliases === "object" && prev.hotkeyAliases ? prev.hotkeyAliases : {};
        const next = { ...current };
        if (trimmed) next[section] = trimmed;
        else delete next[section];
        return { ...prev, hotkeyAliases: next };
      };
      setSelectedMod((prev) => prev ? mergeAliases(prev) : prev);
      setMods((prev) => prev.map((m) => m.path === selectedMod.path ? mergeAliases(m) : m));
      setEditingAliasSection(null);
      setAliasDraft("");
      setToast({ type: "success", message: trimmed ? "快捷键名称已保存" : "已恢复默认名称" });
    } catch (e) {
      setToast({ type: "error", message: "快捷键命名保存失败：" + (e?.message || String(e)) });
    } finally {
      setAliasSaving(false);
    }
  }
  async function applyAiName(newName, target = null) {
    const targetMod = target?.path ? mods.find((mod) => mod.path === target.path) || { name: target.modName, path: target.path } : selectedMod;
    const targetCharacterName = target?.characterName || characterName;
    if (!targetMod || !newName) return;
    try {
      const result = await window.api.renameMod(targetCharacterName, targetMod.name, newName);
      if (result.error) {
        setToast({ type: "error", message: "重命名失败: " + result.error });
        return;
      }
      const oldPath = targetMod.path;
      const cached = _aiSuggestCache.get(oldPath);
      if (cached && result.newPath) {
        _aiSuggestCache.set(result.newPath, cached);
      }
      _aiSuggestCache.delete(oldPath);
      pendingFocusRef.current = {
        characterName: targetCharacterName,
        modName: newName,
        scrollTop: modsListRef.current?.scrollTop || 0,
        targetLoadVersion: modsLoadVersion + 1
      };
      setToast({ type: "success", message: `Mod 已重命名为: ${newName}` });
      setAiNameTaskTarget(null);
      setAiNameTaskResult(null);
      setAiNameTaskError("");
      setShowAiNameModal(false);
      setAiNameModalMinimized(false);
      loadMods();
    } catch (e) {
      setToast({ type: "error", message: "重命名失败: " + e.message });
    }
  }
  async function applyAiTags(tags, target = null) {
    const targetMod = target?.path ? mods.find((mod) => mod.path === target.path) || { path: target.path } : selectedMod;
    if (!tags?.length || !targetMod?.path) return;
    const serverTagNames = new Set(serverTags.map((t) => t.name).filter(Boolean));
    const validTags = [...new Set(tags.map((t) => String(t || "").trim()).filter((t) => serverTagNames.has(t)))];
    if (validTags.length === 0) {
      setToast({ type: "error", message: "AI 推荐中没有 tag 池内的可用 tag" });
      return;
    }
    try {
      let baseTags = modTags;
      if (target?.path && target.path !== selectedMod?.path) {
        const r = await window.api.devGetModTags(targetMod.path);
        const raw = r?.tags || [];
        baseTags = raw.map((t) => typeof t === "string" ? t : t?.name || "").filter(Boolean);
      }
      const merged = [.../* @__PURE__ */ new Set([...baseTags, ...validTags])];
      await window.api.devSetModTags(targetMod.path, merged);
      if (!target?.path || target.path === selectedMod?.path) setModTags(merged);
      setToast({ type: "success", message: `已添加并保存 ${validTags.length} 个 AI 推荐 tag` });
    } catch (e) {
      setToast({ type: "error", message: "Tag 保存失败: " + e.message });
    }
  }
  function clearAiSuggestions() {
    if (selectedMod?.path) _aiSuggestCache.delete(selectedMod.path);
    setAiNameResult(null);
  }
  function isDx12PakMod(mod) {
    return mod?.modType === "dx12-pak";
  }
  async function openModSourceFolder(mod) {
    if (isDx12PakMod(mod)) {
      const result = await window.api.openModFolder(characterName, mod.name);
      if (!result?.success) setToast({ type: "error", message: result?.error || "打开角色 Pak 目录失败" });
      return;
    }
    window.api.openModFolder(characterName, mod.name);
  }
  function openModContextMenu(e, mod) {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 220;
    const submenuWidth = 252;
    const menuHeight = 310;
    const pad = 12;
    const maxX = window.innerWidth - menuWidth - submenuWidth - pad;
    const fallbackMaxX = window.innerWidth - menuWidth - pad;
    const x = Math.max(pad, Math.min(e.clientX + 8, maxX > pad ? maxX : fallbackMaxX));
    const y = Math.max(pad, Math.min(e.clientY + 8, window.innerHeight - menuHeight - pad));
    setModContextMenu({ mod, x, y });
  }
  async function loadModIniBackups(modName) {
    if (!modName) return;
    if (iniRollbackBackups.modName === modName && (iniRollbackBackups.loading || iniRollbackBackups.items.length > 0 || iniRollbackBackups.error)) {
      return;
    }
    setIniRollbackBackups({ modName, loading: true, items: [], error: "" });
    try {
      const result = await window.api.listModIniBackups?.(characterName, modName);
      if (!result?.success) throw new Error(result?.error || "读取备份失败");
      setIniRollbackBackups({
        modName,
        loading: false,
        items: Array.isArray(result.backups) ? result.backups : [],
        error: ""
      });
    } catch (error) {
      setIniRollbackBackups({ modName, loading: false, items: [], error: error.message || "读取备份失败" });
    }
  }
  function requestRollbackModIni(mod, backup) {
    setModContextMenu(null);
    setIniRollbackConfirm({ mod, backup });
  }
  async function confirmRollbackModIni() {
    const target = iniRollbackConfirm;
    if (!target?.mod?.name || !target?.backup?.stamp) return;
    try {
      const result = await window.api.restoreModIniBackup?.(characterName, target.mod.name, target.backup.stamp);
      if (!result?.success) {
        if (result?.restoreSucceeded || result?.cleanupAttempted) {
          setIniRollbackBackups({ modName: "", loading: false, items: [], error: "" });
        }
        const message = result?.error || result?.errors?.[0] || "回滚失败";
        throw new Error(message);
      }
      setToast({ type: "success", message: `已回滚 ${target.mod.name} 的 ${result.restoredCount || 0} 个文件，请按 F10 重载生效` });
      setIniRollbackConfirm(null);
      setIniRollbackBackups({ modName: "", loading: false, items: [], error: "" });
    } catch (error) {
      setToast({ type: "error", message: error.message || "回滚失败" });
    }
  }
  function handleRequestMoveMod(mod) {
    setModContextMenu(null);
    onRequestMoveMod?.({
      characterName,
      modName: mod.name,
      originalName: mod.originalName,
      path: mod.path,
      gameId: activeGameId
    });
  }
  async function handleFixMod(mod, mode = "external") {
    setModContextMenu(null);
    if (fixRunning) return;
    setFixRunning(true);
    try {
      const result = await window.api.fixRunMod(characterName, mod.name, mode, activeGameId);
      if (result?.canceled) return;
      if (result?.success) {
        setIniRollbackBackups((previous) => previous.modName === mod.name ? { modName: "", loading: false, items: [], error: "" } : previous);
        setToast({ type: "success", message: "独立修复器已打开" });
      } else {
        setToast({ type: "error", message: result?.error || "打开修复器失败" });
      }
    } catch (e) {
      setToast({ type: "error", message: "打开修复器失败：" + e.message });
    } finally {
      setFixRunning(false);
    }
  }
  async function getServerUrlAndKey() {
    const cfg = await window.api.getConfig();
    const serverUrl = cfg?.config?.serverUrl || "https://qaqm.top";
    return { serverUrl, adminKey: tagManagerAdminKey };
  }
  async function reloadServerTags({ force = false, timeoutMs = 8e3 } = {}) {
    const now = Date.now();
    if (!force && now - serverTagsLastFetchRef.current < 3e4) return serverTags;
    try {
      const { serverUrl } = await getServerUrlAndKey();
      const { response: res } = await fetchWithDirectFallback(serverUrl, "/api/tags", {
        expectJson: true,
        timeoutMs
      });
      if (!res.ok) throw new Error(`Tag API HTTP ${res.status}`);
      const data = await res.json();
      const tags = Array.isArray(data) ? data : data.tags || [];
      setServerTags(tags);
      serverTagsLastFetchRef.current = Date.now();
      return tags;
    } catch {
      return serverTags;
    }
  }
  async function handleCreateTag() {
    const name = newTagName.trim();
    if (!name) return;
    setTagManagerLoading(true);
    try {
      const { serverUrl, adminKey } = await getServerUrlAndKey();
      const res = await fetch(`${serverUrl}/api/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ name, color: newTagColor })
      });
      if (!res.ok) {
        const err = await res.json();
        setToast({ type: "error", message: err.error || "创建失败" });
        return;
      }
      setNewTagName("");
      setNewTagColor("#6366f1");
      await reloadServerTags({ force: true });
    } catch (e) {
      setToast({ type: "error", message: "创建失败: " + e.message });
    } finally {
      setTagManagerLoading(false);
    }
  }
  async function handleUpdateTag(id) {
    setTagManagerLoading(true);
    try {
      const { serverUrl, adminKey } = await getServerUrlAndKey();
      const res = await fetch(`${serverUrl}/api/tags/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ name: editingTagName, color: editingTagColor })
      });
      if (!res.ok) {
        const err = await res.json();
        setToast({ type: "error", message: err.error || "更新失败" });
        return;
      }
      setEditingTagId(null);
      await reloadServerTags({ force: true });
    } catch (e) {
      setToast({ type: "error", message: "更新失败: " + e.message });
    } finally {
      setTagManagerLoading(false);
    }
  }
  async function handleDeleteTag(id) {
    setTagManagerLoading(true);
    try {
      const { serverUrl, adminKey } = await getServerUrlAndKey();
      const res = await fetch(`${serverUrl}/api/tags/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "x-admin-key": adminKey }
      });
      if (!res.ok) {
        const err = await res.json();
        setToast({ type: "error", message: err.error || "删除失败" });
        return;
      }
      await reloadServerTags({ force: true });
    } catch (e) {
      setToast({ type: "error", message: "删除失败: " + e.message });
    } finally {
      setTagManagerLoading(false);
    }
  }
  async function handleDeleteMod() {
    if (!modToDelete) return;
    const result = await window.api.deleteMod(characterName, modToDelete);
    if (result.success) {
      setToast({ type: "success", message: "Mod 已移入回收站" });
      await loadMods({ syncCharacterCache: true, conflictDelay: 1200 });
      if (selectedMod?.name === modToDelete) {
        setSelectedMod(null);
      }
    } else {
      setToast({ type: "error", message: "删除失败: " + result.error });
    }
    setShowDeleteModal(false);
    setModToDelete(null);
  }
  function confirmDelete(modName, e) {
    e.stopPropagation();
    setModToDelete(modName);
    setShowDeleteModal(true);
  }
  function openDirectImportReview(scanItems, options = {}) {
    const items = (scanItems || []).map((item, index) => {
      const preferredName = index === 0 ? options.preferredModName : "";
      return {
        ...item,
        selected: item.selected !== false,
        ...preferredName ? { name: preferredName, preferredModName: preferredName } : {}
      };
    });
    if (!items.length) {
      setToast({ type: "error", message: "未识别到可安装的 Mod（支持文件夹 / zip / rar / 7z / mp4）" });
      return false;
    }
    setDirectInstallProgress(null);
    setDirectImportReview({
      phase: "scan",
      items,
      folderPath: options.folderPath || null,
      preferredCharacter: characterName,
      appearanceSectionId: options.appearanceSectionId || activeAppearanceSectionIdRef.current || BASE_SECTION_ID
    });
    return true;
  }
  function updateDirectImportScanItem(index, patch) {
    setDirectImportReview((prev) => prev?.items ? {
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, ...patch } : item)
    } : prev);
  }
  function setDirectImportPlanScanMode(index, item, mode) {
    if (!isBatchFolderPlanItem(item)) return;
    const plan = item.importPlan;
    const patch = { selectedImportMode: mode };
    if (mode === "multiple" && !item.selectedSplitOptionId) {
      patch.selectedSplitOptionId = plan.defaultSplitOptionId || plan.splitOptions?.[0]?.id || "";
    }
    if (mode === "integrated" && !item.selectedIntegratedOptionId) {
      patch.selectedIntegratedOptionId = plan.defaultIntegratedOptionId || plan.integratedOptions?.[0]?.id || "";
    }
    updateDirectImportScanItem(index, patch);
  }
  function setDirectImportPreviewItemSelected(index, previewItem, checked) {
    setDirectImportReview((prev) => prev?.items ? {
      ...prev,
      items: prev.items.map((item, itemIndex) => {
        if (itemIndex !== index || !isBatchFolderPlanItem(item)) return itemIndex === index ? { ...item, selected: checked } : item;
        const targetPath = previewItem?.path;
        const plan = item.importPlan;
        const nextPlan = {
          ...plan,
          wholeItem: plan.wholeItem?.path === targetPath ? { ...plan.wholeItem, selected: checked } : plan.wholeItem,
          splitOptions: (plan.splitOptions || []).map((option) => ({
            ...option,
            items: (option.items || []).map((entry) => entry.path === targetPath ? { ...entry, selected: checked } : entry)
          })),
          integratedOptions: (plan.integratedOptions || []).map((option) => ({
            ...option,
            item: option.item?.path === targetPath ? { ...option.item, selected: checked } : option.item
          }))
        };
        return { ...item, importPlan: nextPlan, selected: true };
      })
    } : prev);
  }
  function updateDirectClassifyItem(index, patch) {
    setDirectImportReview((prev) => prev?.classifyItems ? {
      ...prev,
      classifyItems: prev.classifyItems.map((item, i) => i === index ? { ...item, ...patch } : item)
    } : prev);
  }
  function setDirectClassifyInstallMode(index, item, mode) {
    const singleName = item.singleModName || stripDisabledPrefix(item.realName || item.name || item.modName || "Mod");
    if (mode === "integrated") {
      updateDirectClassifyItem(index, {
        installAsIntegratedPackage: true,
        installAsMultipleMods: false,
        modName: "整合包"
      });
      return;
    }
    if (mode === "multiple") {
      updateDirectClassifyItem(index, {
        installAsIntegratedPackage: false,
        installAsMultipleMods: true,
        modName: `多个 Mod（${item.multiModCount || item.multiModNames?.length || "自动"}）`,
        targetCharacter: characterName
      });
      return;
    }
    updateDirectClassifyItem(index, {
      installAsIntegratedPackage: false,
      installAsMultipleMods: false,
      modName: singleName,
      singleModName: singleName,
      targetCharacter: characterName
    });
  }
  async function handleStartDirectImportDecrypt() {
    const review = directImportReview;
    const selected = expandBatchPlanItems(review?.items).filter((item) => item.selected);
    if (!selected.length) return;
    const decryptProgress = selected.map((item) => ({
      name: item.name,
      importDisplayPath: getBatchImportDisplayPath(item),
      status: "pending",
      realName: null,
      error: null
    }));
    setDirectImportReview((prev) => ({ ...prev, phase: "decrypting", decryptProgress }));
    const cleanup = window.api.onBatchDecryptProgress?.((data) => {
      setDirectImportReview((prev) => prev?.decryptProgress ? {
        ...prev,
        decryptProgress: prev.decryptProgress.map(
          (item, i) => i === data.idx ? {
            ...item,
            status: data.status,
            stage: data.stage || item.stage || "",
            message: data.message || item.message || "",
            realName: data.realName || null,
            error: data.error || null,
            integratedPackageCandidate: !!data.integratedPackageCandidate,
            integratedPackageAmbiguous: !!data.integratedPackageAmbiguous,
            multiModCandidate: !!data.multiModCandidate,
            multiModCount: data.multiModCount || 0,
            multiModNames: data.multiModNames || []
          } : item
        )
      } : prev);
    });
    try {
      const result = await window.api.batchDecryptAll({ items: selected });
      const classifyItems = (result?.results || []).map((r, i) => {
        const sourceItem = selected[i] || {};
        const candidateName = stripDisabledPrefix(r.realName || sourceItem.name || "Mod");
        const installContentType = normalizeInstallContentType(
          r.installContentType || sourceItem.installContentType
        );
        const managedInstall = isManagedInstallContentType(installContentType);
        const forcedIntegrated = !!(sourceItem.forceIntegratedPackage || sourceItem.expectedIntegratedPackage);
        const integratedPackageCandidate = !managedInstall && !!(r.integratedPackageCandidate || forcedIntegrated);
        const installAsIntegratedPackage = !managedInstall && (forcedIntegrated || integratedPackageCandidate && !r.integratedPackageAmbiguous);
        const multiModCandidate = !!r.multiModCandidate;
        return {
          filePath: r.originalPath,
          tempPath: r.tempPath,
          path: r.originalPath,
          name: sourceItem.name || r.realName,
          type: sourceItem.type,
          importMode: sourceItem.importMode || "",
          importDisplayPath: getBatchImportDisplayPath(sourceItem),
          realName: r.realName,
          modName: managedInstall ? getInstallContentTypeLabel(installContentType) : installAsIntegratedPackage ? "整合包" : candidateName,
          singleModName: candidateName,
          targetCharacter: managedInstall ? "" : characterName,
          selected: r.success,
          decryptSuccess: r.success,
          decryptError: r.error || null,
          installContentType,
          targetGameId: r.targetGameId || sourceItem.targetGameId || activeGameId,
          importerName: r.importerName || sourceItem.importerName || "",
          managedTargetPath: r.managedTargetPath || sourceItem.managedTargetPath || "",
          managedTargetLabel: r.managedTargetLabel || sourceItem.managedTargetLabel || "",
          managedTargetError: r.managedTargetError || sourceItem.managedTargetError || "",
          integratedPackageCandidate,
          integratedPackageAmbiguous: !!r.integratedPackageAmbiguous,
          installAsIntegratedPackage,
          integratedPackageTotalItems: r.integratedPackageTotalItems || 0,
          integratedPackageModCount: r.integratedPackageModCount || 0,
          integratedPackageCharacterCount: r.integratedPackageCharacterCount || 0,
          multiModCandidate,
          installAsMultipleMods: false,
          multiModCount: r.multiModCount || 0,
          multiModNames: r.multiModNames || []
        };
      });
      setDirectImportReview((prev) => ({ ...prev, phase: "classify", classifyItems }));
    } catch (err) {
      setDirectImportReview(null);
      setToast({ type: "error", message: "分析失败：" + (err?.message || String(err)) });
    } finally {
      if (cleanup) cleanup();
    }
  }
  async function handleStartDirectImportInstall() {
    const selected = (directImportReview?.classifyItems || []).filter((item) => item.selected && item.decryptSuccess);
    if (!selected.length) return;
    const getInstallProgressWeight = (item) => {
      const multiTotal = Number(item.multiModCount || 0);
      if (item.installAsMultipleMods && Number.isFinite(multiTotal) && multiTotal > 1) return multiTotal;
      const integratedTotal = Number(item.integratedPackageTotalItems || item.integratedPackageModCount || 0);
      return item.installAsIntegratedPackage && Number.isFinite(integratedTotal) && integratedTotal > 0 ? integratedTotal : 1;
    };
    const total = selected.reduce((sum, item) => sum + getInstallProgressWeight(item), 0);
    setDirectImportReview((prev) => ({ ...prev, phase: "importing", progress: 0, total, currentMod: "" }));
    const managedItems = selected.filter((item) => isManagedInstallContentType(item.installContentType));
    const modItems = selected.filter((item) => !isManagedInstallContentType(item.installContentType));
    const cleanup = window.api.onBatchProgress?.((data) => {
      setDirectImportReview((prev) => ({
        ...prev,
        progress: managedItems.length + data.current,
        total: managedItems.length + data.total,
        currentMod: data.modName
      }));
    });
    try {
      const managedResults = [];
      for (let index = 0; index < managedItems.length; index += 1) {
        const item = managedItems[index];
        setDirectImportReview((prev) => ({
          ...prev,
          progress: index,
          currentMod: getInstallContentTypeLabel(item.installContentType)
        }));
        const managedResult = await window.api.managedPackageInstall({
          sourcePath: item.filePath || item.path,
          installContentType: item.installContentType,
          gameId: item.targetGameId || activeGameId,
          importerName: item.importerName || ""
        });
        managedResults.push({
          ...managedResult,
          modName: managedResult?.modName || getInstallContentTypeLabel(item.installContentType)
        });
        setDirectImportReview((prev) => ({ ...prev, progress: index + 1 }));
      }
      let modResult = { results: [] };
      if (modItems.length) modResult = await window.api.batchAddMods({
        items: modItems.map((item) => ({
          filePath: item.filePath || item.path,
          tempPath: item.tempPath || null,
          characterName: item.installAsIntegratedPackage ? "__all__" : characterName,
          modName: item.installAsIntegratedPackage ? "整合包" : item.modName,
          appearanceSectionId: item.installAsIntegratedPackage ? null : getExplicitImportAppearanceSectionId(
            directImportReview?.appearanceSectionId || activeAppearanceSectionIdRef.current || BASE_SECTION_ID
          ),
          expectedIntegratedPackage: !!item.installAsIntegratedPackage,
          installAsIntegratedPackage: !!item.installAsIntegratedPackage,
          installAsMultipleMods: !!item.installAsMultipleMods,
          integratedPackageTotalItems: item.integratedPackageTotalItems || 0,
          integratedPackageModCount: item.integratedPackageModCount || 0,
          integratedPackageCharacterCount: item.integratedPackageCharacterCount || 0,
          multiModCount: item.multiModCount || 0,
          multiModNames: item.multiModNames || []
        }))
      });
      const modResults = modResult?.results || [];
      const results = [...managedResults, ...modResults];
      const ok = modResults.reduce((sum, item) => sum + (item.success ? Number(item.modCount || 1) : 0), 0);
      const importedPak = results.some((item) => item.success && item.modMode === "pak");
      setDirectImportReview((prev) => ({ ...prev, phase: "done", results }));
      if (ok > 0) recordCharacterUsage(ok);
      await loadMods({ syncCharacterCache: ok > 0, conflictDelay: 1400 });
      if (importedPak) notifyPakImported({ keepCurrentView: true, characterName });
      if (managedResults.length === 1 && modResults.length === 0) {
        setToast({
          type: managedResults[0].success ? "success" : "error",
          message: getManagedInstallResultMessage(managedResults[0])
        });
      }
    } catch (err) {
      setToast({ type: "error", message: "安装失败：" + (err?.message || String(err)) });
      setDirectImportReview((prev) => ({ ...prev, phase: "classify" }));
    } finally {
      if (cleanup) cleanup();
    }
  }
  async function handleAddMod() {
    if (!newModFile || !newModName) return;
    try {
      const scan = await window.api.batchScanPaths?.([newModFile.path]);
      const scanItems = scan?.items || [];
      if (scanItems.length) {
        openDirectImportReview(scanItems, { preferredModName: newModName });
        setNewModFile(null);
        setNewModName("");
        return;
      }
    } catch (_) {
    }
    const result = await window.api.addMod(characterName, newModFile.path, {
      name: newModName,
      appearanceSectionId: getExplicitImportAppearanceSectionId(
        activeAppearanceSectionIdRef.current || BASE_SECTION_ID
      )
    });
    if (result.success) {
      setNewModFile(null);
      setNewModName("");
      if (result.modMode === "pak") {
        setToast({ type: "success", message: "已识别 Pak Mod，并切换到 Pak 分类" });
        await loadMods({ syncCharacterCache: true, conflictDelay: 1400 });
        notifyPakImported({ keepCurrentView: true, characterName });
        return;
      }
      if (result.integratedPackage) {
        await loadMods({ syncCharacterCache: true, conflictDelay: 1400 });
        setToast({ type: "success", message: `整合包已覆盖到当前 Mods（${result.characterCount || 0} 个角色，${result.modCount || 0} 个 Mod）` });
        return;
      }
      await loadMods({ syncCharacterCache: true, conflictDelay: 1400 });
      const installedSection = appearanceSectionsWithStats.find(
        (section) => getSectionId(section) === result.appearanceSectionId
      );
      setToast({
        type: "success",
        message: `🌸 Mod 已添加到「${getSectionName(installedSection || activeAppearanceSection)}」`
      });
    } else {
      setToast({ type: "error", message: "添加失败: " + result.error });
    }
  }
  function startHotkeyEdit(index, hk, relativePath) {
    setEditingHotkey({
      index,
      section: hk.section,
      relativePath,
      currentKey: hk.keys.join(" + ")
    });
    setCapturedKey("");
  }
  function handleKeyCapture(e) {
    e.preventDefault();
    e.stopPropagation();
    let parts = [];
    if (e.ctrlKey) parts.push("ctrl");
    if (e.altKey) parts.push("alt");
    if (e.shiftKey) parts.push("shift");
    const key = e.key.toUpperCase();
    if (key !== "CONTROL" && key !== "ALT" && key !== "SHIFT") {
      if (key.length === 1) {
        parts.push(key);
      } else {
        const keyMap = {
          "F1": "F1",
          "F2": "F2",
          "F3": "F3",
          "F4": "F4",
          "F5": "F5",
          "F6": "F6",
          "F7": "F7",
          "F8": "F8",
          "F9": "F9",
          "F10": "F10",
          "F11": "F11",
          "F12": "F12",
          "ESCAPE": "Esc",
          "ENTER": "Enter",
          "TAB": "Tab",
          "BACKSPACE": "Backspace",
          "DELETE": "Delete",
          "ARROWUP": "Up",
          "ARROWDOWN": "Down",
          "ARROWLEFT": "Left",
          "ARROWRIGHT": "Right",
          "HOME": "Home",
          "END": "End",
          "PAGEUP": "PageUp",
          "PAGEDOWN": "PageDown",
          "INSERT": "Insert",
          "SPACE": "Space",
          " ": "Space"
        };
        parts.push(keyMap[key] || key);
      }
    }
    if (parts.length > 0) {
      setCapturedKey(parts.join(" + "));
    }
  }
  async function saveHotkeyEdit() {
    if (!editingHotkey || !capturedKey) return;
    const formattedKey = capturedKey.replace(/\s*\+\s*/g, " ");
    const result = await window.api.saveHotkey(
      characterName,
      selectedMod.name,
      editingHotkey.section,
      formattedKey,
      editingHotkey.relativePath
    );
    if (result.success) {
      setToast({ type: "success", message: "✨ 快捷键已保存" });
      loadModDetails(selectedMod.name, true);
    } else {
      setToast({ type: "error", message: "保存失败: " + result.error });
    }
    setEditingHotkey(null);
    setCapturedKey("");
  }
  function cancelHotkeyEdit() {
    setEditingHotkey(null);
    setCapturedKey("");
  }
  const [globalDragging, setGlobalDragging] = reactExports.useState(false);
  function handleGlobalDragOver(e) {
    e.preventDefault();
    if (e.target.closest(".image-drop-zone")) {
      setGlobalDragging(false);
      return;
    }
    if (e.dataTransfer.types.includes("Files")) {
      let hasImage = false;
      if (e.dataTransfer.items) {
        for (let i = 0; i < e.dataTransfer.items.length; i++) {
          if (e.dataTransfer.items[i].type.startsWith("image/")) {
            hasImage = true;
            break;
          }
        }
      }
      if (!hasImage) {
        setGlobalDragging(true);
      } else {
        setGlobalDragging(false);
      }
    }
  }
  function handleGlobalDragLeave(e) {
    if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) {
      setGlobalDragging(false);
    }
  }
  function handleGlobalDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setGlobalDragging(false);
    const files = Array.from(e.dataTransfer?.files || []);
    if (!files.length) return;
    const allImages = files.every(
      (f) => f.type?.startsWith("image/") || /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(f.name || "")
    );
    if (allImages) return;
    const paths = files.map((f) => window.api.getPathForFile(f)).filter(Boolean);
    if (!paths.length) return;
    runDirectInstallForCurrentCharacter(paths);
  }
  async function handleDirectImportDropFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const allImages = files.every(
      (file) => file.type?.startsWith("image/") || /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(file.name || "")
    );
    if (allImages) return;
    const paths = files.map((file) => window.api.getPathForFile(file)).filter(Boolean);
    if (!paths.length) return;
    try {
      const scan = await window.api.batchScanPaths?.(paths);
      const scanItems = scan?.items || [];
      if (!scanItems.length) {
        setToast({ type: "error", message: "未识别到可安装的 Mod（支持文件夹 / zip / rar / 7z / mp4）" });
        return;
      }
      openDirectImportReview(scanItems);
    } catch (err) {
      setToast({ type: "error", message: "扫描失败：" + (err?.message || String(err)) });
    }
  }
  async function runDirectInstallForCurrentCharacter(paths) {
    let decryptCleanup = null;
    let progressCleanup = null;
    const targetAppearanceSectionId = activeAppearanceSectionIdRef.current || BASE_SECTION_ID;
    const targetAppearanceSection = appearanceSectionsWithStats.find((section) => getSectionId(section) === targetAppearanceSectionId);
    const targetAppearanceSectionName = getAppearanceImportTargetName(targetAppearanceSection);
    try {
      const scan = await window.api.batchScanPaths(paths);
      const scanItems = scan?.items || [];
      if (!scanItems.length) {
        setToast({ type: "error", message: "未识别到可安装的 Mod（支持文件夹 / zip / rar / 7z / mp4）" });
        return;
      }
      if (openDirectImportReview(scanItems)) return;
      setDirectInstallProgress({ phase: "decrypt", current: 0, total: scanItems.length, modName: "" });
      decryptCleanup = window.api.onBatchDecryptProgress?.((data) => {
        setDirectInstallProgress({
          phase: "decrypt",
          current: ["done", "error", "skipped"].includes(data?.status) ? (data?.idx ?? 0) + 1 : data?.idx ?? 0,
          total: data?.total ?? scanItems.length,
          modName: data?.message || data?.realName || ""
        });
      });
      const decryptResult = await window.api.batchDecryptAll({ items: scanItems });
      if (decryptCleanup) {
        decryptCleanup();
        decryptCleanup = null;
      }
      const multiModCandidates = (decryptResult?.results || []).filter(
        (r) => r.success && r.multiModCandidate && !r.integratedPackageCandidate
      );
      const installCandidatesAsMultiple = multiModCandidates.length > 0 ? window.confirm(
        `检测到 ${multiModCandidates.length} 个安装包包含多个顶层文件夹。

选择“确定”会按多个 Mods 安装；选择“取消”会作为单个 Mod 整体安装。`
      ) : false;
      const addItems = (decryptResult?.results || []).filter((r) => r.success).map((r, i) => ({
        filePath: r.originalPath,
        tempPath: r.tempPath,
        characterName,
        modName: (r.realName || scanItems[i]?.name || "mod").replace(/^DISABLED_/i, ""),
        appearanceSectionId: getExplicitImportAppearanceSectionId(
          targetAppearanceSectionId
        ),
        installAsMultipleMods: installCandidatesAsMultiple && !!r.multiModCandidate,
        multiModCount: r.multiModCount || 0,
        multiModNames: r.multiModNames || []
      }));
      if (!addItems.length) {
        setDirectInstallProgress(null);
        const firstError = (decryptResult?.results || []).find((r) => !r.success && r.error)?.error;
        setToast({ type: "error", message: firstError || "解压失败，无可安装 Mod" });
        return;
      }
      setDirectInstallProgress({ phase: "install", current: 0, total: addItems.length, modName: "" });
      progressCleanup = window.api.onBatchProgress?.((data) => {
        setDirectInstallProgress({
          phase: "install",
          current: data?.current ?? 0,
          total: data?.total ?? addItems.length,
          modName: data?.modName || ""
        });
      });
      const result = await window.api.batchAddMods({ items: addItems });
      if (progressCleanup) {
        progressCleanup();
        progressCleanup = null;
      }
      const ok = (result?.results || []).reduce((sum, r) => sum + (r.success ? Number(r.modCount || 1) : 0), 0);
      const fail = (result?.results || []).filter((r) => !r.success).length;
      setDirectInstallProgress(null);
      const importedPak = (result?.results || []).some((r) => r.success && r.modMode === "pak");
      const importedIntegrated = (result?.results || []).some((r) => r.success && r.integratedPackage);
      const integratedStats = (result?.results || []).find((r) => r.success && r.integratedPackage);
      setToast({
        type: fail > 0 ? "error" : "success",
        message: fail > 0 ? `安装完成：${ok} 成功，${fail} 失败` : importedPak ? `✨ 已识别 Pak Mod，并切换到 Pak 分类` : importedIntegrated ? `✨ 整合包已覆盖到当前 Mods（${integratedStats?.characterCount || 0} 个角色，${integratedStats?.modCount || 0} 个 Mod）` : `✨ 已安装 ${ok} 个 Mod 到「${characterName} / ${targetAppearanceSectionName}」`
      });
      if (importedPak) {
        await loadMods({ syncCharacterCache: true, conflictDelay: 1400 });
        notifyPakImported({ keepCurrentView: true, characterName });
        return;
      }
      if (ok > 0) {
        recordCharacterUsage(ok);
        await loadMods({ syncCharacterCache: true, conflictDelay: 1400 });
      }
    } catch (err) {
      setDirectInstallProgress(null);
      setToast({ type: "error", message: "安装失败：" + (err?.message || String(err)) });
    } finally {
      if (decryptCleanup) decryptCleanup();
      if (progressCleanup) progressCleanup();
    }
  }
  const directImportTargetSection = appearanceSectionsWithStats.find(
    (section) => getSectionId(section) === directImportReview?.appearanceSectionId
  ) || activeAppearanceSection;
  const directImportTargetSectionName = getAppearanceImportTargetName(directImportTargetSection);
  const directImportHasManagedInstall = !!(directImportReview?.items?.some((item) => isManagedInstallContentType(item.installContentType)) || directImportReview?.classifyItems?.some((item) => isManagedInstallContentType(item.installContentType)));
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      ref: galleryContainerRef,
      className: `mod-view-container page-transition-enter ${globalDragging ? "global-dragging" : ""} view-mode-${viewMode}${isResizingGallery ? " resizing-gallery" : ""}`,
      style: { padding: "0", boxSizing: "border-box" },
      onDragOver: handleGlobalDragOver,
      onDragLeave: handleGlobalDragLeave,
      onDrop: handleGlobalDrop,
      children: [
        globalDragging && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "global-drop-overlay", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "global-drop-content", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: "64px" }, children: "📦" }),
          runtimeInfo?.elevated ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { children: "管理员模式下拖拽可能被 Windows 拦截" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { maxWidth: "420px", marginTop: "8px", fontSize: "13px", lineHeight: 1.6, color: "var(--color-text-secondary, #555)" }, children: "如果鼠标显示禁止符号，请使用“添加 Mod”按钮选择文件，或关闭管理员模式后再拖拽。" })
          ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { children: "释放以识别 Mod / 更新包 / 修复器" })
        ] }) }),
        directInstallProgress && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            style: {
              position: "fixed",
              right: "24px",
              bottom: "32px",
              zIndex: 9999,
              minWidth: "280px",
              maxWidth: "380px",
              padding: "14px 18px",
              borderRadius: "var(--radius-md, 12px)",
              background: "rgba(255,255,255,0.96)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)",
              border: "1px solid rgba(99,102,241,0.18)",
              backdropFilter: "blur(8px)"
            },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", fontWeight: 600, fontSize: "13px", color: "var(--color-accent-primary)" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { display: "inline-block", animation: "spin 1.1s linear infinite" }, children: "⟳" }),
                directInstallProgress.phase === "decrypt" ? "解压中" : "安装中",
                " · ",
                characterName,
                " / ",
                activeAppearanceImportTargetName
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: "12px", color: "var(--color-text-secondary, #555)", marginBottom: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: directInstallProgress.modName || "处理中…" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { position: "relative", height: "6px", borderRadius: "999px", background: "rgba(99,102,241,0.12)", overflow: "hidden" }, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                "div",
                {
                  style: {
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${Math.min(100, Math.round(directInstallProgress.current / Math.max(1, directInstallProgress.total) * 100))}%`,
                    background: "linear-gradient(90deg, #a5b4fc, #818cf8)",
                    transition: "width 0.25s ease"
                  }
                }
              ) }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: "11px", color: "var(--color-text-tertiary, #888)", marginTop: "4px", textAlign: "right" }, children: [
                directInstallProgress.current,
                " / ",
                directInstallProgress.total
              ] })
            ]
          }
        ),
        directImportReview && ReactDOM.createPortal(
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-overlay", onClick: () => !["importing", "decrypting"].includes(directImportReview.phase) && setDirectImportReview(null), children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-card direct-import-card", onClick: (e) => e.stopPropagation(), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-header", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-title", children: directImportHasManagedInstall ? "安装更新包 / 修复器" : `安装到「${characterName} / ${directImportTargetSectionName}」` }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "legacy-import-close", onClick: () => setDirectImportReview(null), disabled: ["importing", "decrypting"].includes(directImportReview.phase), children: "✕" })
            ] }),
            directImportReview.phase === "scan" && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-hint", children: directImportHasManagedInstall ? /* @__PURE__ */ jsxRuntimeExports.jsx(jsxRuntimeExports.Fragment, { children: "检测到更新包或修复器，请确认安装方式与目标。" }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                "当前是在「",
                /* @__PURE__ */ jsxRuntimeExports.jsxs("strong", { children: [
                  characterName,
                  " / ",
                  directImportTargetSectionName
                ] }),
                "」分区里导入。若自动识别层级不对，可以先切换“单个 / 多个 / 整合包”和导入层级。"
              ] }) }),
              directImportReview.items.some((item) => isBatchFolderPlanItem(item)) && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-plan-list", children: directImportReview.items.map((item, idx) => {
                if (!isBatchFolderPlanItem(item)) return null;
                const plan = item.importPlan;
                const selectedMode = getPlanSelectedMode(item);
                const selectedSplitOption = (plan.splitOptions || []).find((option) => option.id === item.selectedSplitOptionId) || (plan.splitOptions || []).find((option) => option.id === plan.defaultSplitOptionId) || (plan.splitOptions || [])[0];
                const selectedIntegratedOption = (plan.integratedOptions || []).find((option) => option.id === item.selectedIntegratedOptionId) || (plan.integratedOptions || []).find((option) => option.id === plan.defaultIntegratedOptionId) || (plan.integratedOptions || [])[0];
                return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-plan-card", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-plan-head", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-plan-name", children: plan.rootName || item.name }),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-plan-desc", children: [
                        "自动判断：",
                        getBatchPlanModeLabel(plan.defaultMode),
                        "。当前目标：",
                        characterName,
                        " / ",
                        directImportTargetSectionName,
                        "。"
                      ] })
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-plan-mode", role: "group", "aria-label": "导入方式", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: selectedMode === "single" ? "active" : "", onClick: () => setDirectImportPlanScanMode(idx, item, "single"), children: "单个 Mod" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: selectedMode === "multiple" ? "active" : "", disabled: !plan.splitOptions?.length, onClick: () => setDirectImportPlanScanMode(idx, item, "multiple"), children: "多个 Mod" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: selectedMode === "integrated" ? "active" : "", disabled: !plan.integratedOptions?.length, onClick: () => setDirectImportPlanScanMode(idx, item, "integrated"), children: "整合包" })
                    ] })
                  ] }),
                  selectedMode === "multiple" && selectedSplitOption && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-plan-row", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "导入层级" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("select", { value: selectedSplitOption.id, onChange: (e) => updateDirectImportScanItem(idx, { selectedSplitOptionId: e.target.value }), children: (plan.splitOptions || []).map((option) => /* @__PURE__ */ jsxRuntimeExports.jsxs("option", { value: option.id, children: [
                      option.label,
                      "（",
                      option.itemCount,
                      " 项）",
                      option.pathLabel ? ` · ${option.pathLabel}` : ""
                    ] }, option.id)) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("em", { children: selectedSplitOption.description })
                  ] }),
                  selectedMode === "integrated" && selectedIntegratedOption && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-plan-row", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "整合包层级" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("select", { value: selectedIntegratedOption.id, onChange: (e) => updateDirectImportScanItem(idx, { selectedIntegratedOptionId: e.target.value }), children: (plan.integratedOptions || []).map((option) => /* @__PURE__ */ jsxRuntimeExports.jsxs("option", { value: option.id, children: [
                      option.label,
                      option.pathLabel ? ` · ${option.pathLabel}` : ""
                    ] }, option.id)) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("em", { children: selectedIntegratedOption.description })
                  ] })
                ] }, item.path || idx);
              }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-list-header", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { width: 20 } }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { width: 44 }, children: "类型" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { flex: 1 }, children: "当前将导入的内容" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { width: 148, textAlign: "right" }, children: "安装方式" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-list", children: directImportReview.items.flatMap((sourceItem, sourceIdx) => getSelectedBatchPlanItems(sourceItem).map((item, previewIdx) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-item", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "input",
                  {
                    type: "checkbox",
                    checked: item.selected !== false,
                    onChange: (e) => setDirectImportPreviewItemSelected(sourceIdx, item, e.target.checked)
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-item-type", children: item.type }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "batch-import-item-main", title: getBatchImportDisplayPath(item), children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-item-primary", children: item.name }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-item-path", children: getBatchImportDisplayPath(item) }),
                  (item.managedTargetLabel || item.managedTargetError) && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-item-path", title: item.managedTargetPath || item.managedTargetError, children: item.managedTargetError || `目标：${item.managedTargetLabel}` })
                ] }),
                item.suggestedContentType ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "select",
                  {
                    value: normalizeInstallContentType(item.installContentType),
                    onChange: (event) => updateDirectImportScanItem(sourceIdx, {
                      installContentType: event.target.value,
                      targetGameId: event.target.value === "game-package-update" && item.suggestedContentType === "game-package-update" ? item.targetGameId || activeGameId : activeGameId,
                      importerName: event.target.value === "game-package-update" && item.suggestedContentType === "game-package-update" ? item.importerName || "" : "",
                      managedTargetPath: "",
                      managedTargetLabel: "",
                      managedTargetError: ""
                    }),
                    style: { width: 148, flexShrink: 0, fontSize: "12px" },
                    "aria-label": `${item.name} 安装方式`,
                    children: MANAGED_INSTALL_OPTIONS.map((option) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: option.value, children: option.label }, option.value))
                  }
                ) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-fixed-target", children: item.forceIntegratedPackage || item.integratedPackageCandidate ? "整合包" : `${characterName} / ${directImportTargetSectionName}` })
              ] }, `${sourceIdx}-${previewIdx}-${item.path || item.name}`))) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-summary", children: (() => {
                const previewItems = expandBatchPlanItems(directImportReview.items);
                return `共 ${previewItems.length} 项，已选 ${previewItems.filter((item) => item.selected).length} 项；普通 Mod 默认安装到「${characterName} / ${directImportTargetSectionName}」。`;
              })() }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-actions", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "btn btn-secondary", onClick: () => setDirectImportReview(null), children: "取消" }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  "button",
                  {
                    type: "button",
                    className: "btn btn-primary",
                    onClick: handleStartDirectImportDecrypt,
                    disabled: !expandBatchPlanItems(directImportReview.items).some((item) => item.selected),
                    children: [
                      "开始分析 (",
                      expandBatchPlanItems(directImportReview.items).filter((item) => item.selected).length,
                      ")"
                    ]
                  }
                )
              ] })
            ] }),
            directImportReview.phase === "decrypting" && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-hint", children: [
                "正在分析... ",
                (directImportReview.decryptProgress || []).filter((item) => ["done", "error", "skipped"].includes(item.status)).length,
                " / ",
                (directImportReview.decryptProgress || []).length
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-list", children: (directImportReview.decryptProgress || []).map((item, idx) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-item", style: { gap: "8px" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { width: 16, flexShrink: 0, textAlign: "center" }, children: [
                  item.status === "pending" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#aaa" }, children: "⋯" }),
                  item.status === "running" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#e67e22", display: "inline-block", animation: "spin 1s linear infinite" }, children: "⟳" }),
                  item.status === "done" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#27ae60" }, children: "✓" }),
                  item.status === "error" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#e74c3c" }, children: "✗" })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "batch-import-item-main", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-item-primary", children: item.name }),
                  item.importDisplayPath && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-item-path", children: item.importDisplayPath })
                ] }),
                item.status === "running" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-inline-note", children: item.message || "正在处理..." }),
                item.status === "done" && item.realName && item.realName !== item.name && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "batch-import-inline-note success", children: [
                  "→ ",
                  item.realName
                ] }),
                item.status === "error" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-inline-note error", children: item.error })
              ] }, idx)) })
            ] }),
            directImportReview.phase === "classify" && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-hint", children: [
                "分析完成！普通 Mod 会安装到「",
                /* @__PURE__ */ jsxRuntimeExports.jsxs("strong", { children: [
                  characterName,
                  " / ",
                  directImportTargetSectionName
                ] }),
                "」。如果这个包其实是多 Mod 或整合包，可以在每一项右侧切换。"
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-list-header", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { width: 20 } }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { flex: 1 }, children: "Mod 名称与来源层级" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { width: 238 }, children: "安装方式" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-list batch-import-classify-list", children: (directImportReview.classifyItems || []).map((item, idx) => {
                const installAsIntegratedPackage = !!item.installAsIntegratedPackage;
                const installAsMultipleMods = !installAsIntegratedPackage && !!item.installAsMultipleMods;
                const isMatched = isManagedInstallContentType(item.installContentType) || installAsIntegratedPackage || !!item.targetCharacter;
                return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `batch-import-item ${item.decryptSuccess ? installAsIntegratedPackage ? "integrated" : isMatched ? "matched" : "unmatched" : "fail"}`, children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "input",
                    {
                      type: "checkbox",
                      checked: item.selected,
                      disabled: !item.decryptSuccess,
                      onChange: (e) => updateDirectClassifyItem(idx, { selected: e.target.checked })
                    }
                  ),
                  item.decryptSuccess ? isManagedInstallContentType(item.installContentType) ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-classify-main", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-item-name", style: { display: "flex", alignItems: "center" }, children: getInstallContentTypeLabel(item.installContentType) }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-classify-path", title: item.filePath || item.path, children: item.realName || item.name })
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-install-mode", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-current-target", title: item.managedTargetPath || item.managedTargetError, children: item.managedTargetError || item.managedTargetLabel || "目标将在安装时从当前配置重新校验" }) })
                  ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-classify-main", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "input",
                        {
                          className: "batch-import-item-name",
                          value: item.modName,
                          readOnly: installAsIntegratedPackage || installAsMultipleMods,
                          onChange: (e) => updateDirectClassifyItem(idx, { modName: e.target.value, singleModName: e.target.value })
                        }
                      ),
                      item.importDisplayPath && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-classify-path", title: item.importDisplayPath, children: item.importDisplayPath })
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-install-mode", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-mode-toggle three", role: "group", "aria-label": "安装方式", children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: !installAsIntegratedPackage && !installAsMultipleMods ? "active" : "", onClick: () => setDirectClassifyInstallMode(idx, item, "single"), children: "单个" }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: installAsMultipleMods ? "active" : "", title: item.multiModCandidate ? "按多个 Mod 安装" : "尝试按多个 Mod 安装", onClick: () => setDirectClassifyInstallMode(idx, item, "multiple"), children: "多个" }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: installAsIntegratedPackage ? "active" : "", onClick: () => setDirectClassifyInstallMode(idx, item, "integrated"), children: "整合包" })
                      ] }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: installAsIntegratedPackage ? "batch-import-integrated-target" : "batch-import-current-target", children: installAsIntegratedPackage ? "覆盖当前 Mods" : `安装到：${characterName} / ${directImportTargetSectionName}` })
                    ] })
                  ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { flex: 1, color: "var(--color-error, #e74c3c)", fontSize: "12px" }, children: [
                    item.name,
                    " — 分析失败: ",
                    item.decryptError
                  ] })
                ] }, idx);
              }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-summary", children: (() => {
                const all = directImportReview.classifyItems || [];
                const ok = all.filter((item) => item.decryptSuccess);
                const sel = ok.filter((item) => item.selected);
                const managed = sel.filter((item) => isManagedInstallContentType(item.installContentType));
                const integrated = sel.filter((item) => item.installAsIntegratedPackage);
                const multiple = sel.filter((item) => item.installAsMultipleMods);
                return `共 ${all.length} 项，分析成功 ${ok.length} 项，已选 ${sel.length} 项；${managed.length} 项组件/修复器，${integrated.length} 项整合包，${multiple.length} 项按多个 Mod 安装。`;
              })() }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-actions", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "btn btn-secondary", onClick: () => setDirectImportReview(null), children: "取消" }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  "button",
                  {
                    type: "button",
                    className: "btn btn-primary",
                    onClick: handleStartDirectImportInstall,
                    disabled: !(directImportReview.classifyItems || []).some((item) => item.selected && item.decryptSuccess),
                    children: [
                      "开始安装 (",
                      (directImportReview.classifyItems || []).filter((item) => item.selected && item.decryptSuccess).length,
                      ")"
                    ]
                  }
                )
              ] })
            ] }),
            directImportReview.phase === "importing" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-progress-wrap", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-progress-header", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "安装中..." }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                  directImportReview.progress ?? 0,
                  " / ",
                  directImportReview.total ?? 0
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-progress-bar-bg", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                "div",
                {
                  className: "batch-import-progress-bar-fill",
                  style: { width: `${directImportReview.total ? Math.round(directImportReview.progress / directImportReview.total * 100) : 0}%` }
                }
              ) }),
              directImportReview.currentMod && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-progress-current", children: directImportReview.currentMod })
            ] }),
            directImportReview.phase === "done" && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "batch-import-done-summary", children: [
                (directImportReview.results || []).filter((item) => item.success).length,
                " 个成功，",
                (directImportReview.results || []).filter((item) => !item.success).length,
                " 个失败"
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-results", children: (directImportReview.results || []).map((item, index) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `batch-import-result-item ${item.success ? "success" : "fail"}`, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-result-icon", children: item.success ? "✓" : "✗" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-result-name", children: item.modName }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-result-char", children: item.integratedPackage ? `覆盖当前 Mods：${item.characterCount || 0} 角色 / ${item.modCount || 0} Mod` : item.characterName || characterName }),
                !item.success && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "batch-import-error", children: item.error })
              ] }, index)) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "batch-import-actions", children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "btn btn-primary", onClick: () => setDirectImportReview(null), children: "完成" }) })
            ] })
          ] }) }),
          document.body
        ),
        pakToggleProgress && /* @__PURE__ */ jsxRuntimeExports.jsx(
          "div",
          {
            style: {
              position: "fixed",
              inset: 0,
              zIndex: 10020,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(15,23,42,0.34)",
              backdropFilter: "blur(10px)"
            },
            children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: {
              width: "min(420px, calc(100vw - 48px))",
              padding: "24px 26px",
              borderRadius: "24px",
              background: "rgba(255,255,255,0.96)",
              border: "1px solid rgba(255,255,255,0.82)",
              boxShadow: "0 28px 72px rgba(15,23,42,0.24)",
              display: "grid",
              gap: "14px"
            }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", alignItems: "center", gap: "12px" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: {
                  width: "46px",
                  height: "46px",
                  borderRadius: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: pakToggleProgress.status === "done" ? "rgba(16,185,129,0.12)" : "rgba(99,102,241,0.12)",
                  color: pakToggleProgress.status === "done" ? "#059669" : "#4f46e5",
                  fontSize: "22px"
                }, children: pakToggleProgress.status === "done" ? "✓" : "↔" }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { minWidth: 0 }, children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: "16px", fontWeight: 900, color: "#111827" }, children: pakToggleProgress.phase === "prepare" ? "正在整理 Pak 生效目录" : pakToggleProgress.enable ? "正在启用 Pak Mod" : "正在关闭 Pak Mod" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { marginTop: "4px", fontSize: "12px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: pakToggleProgress.modName || "Pak Mod" })
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#475569", fontSize: "13px", lineHeight: 1.7 }, children: pakToggleProgress.message || "正在移动 Mod 目录，请稍候…" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { height: "9px", borderRadius: "999px", background: "rgba(148,163,184,0.18)", overflow: "hidden" }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: {
                height: "100%",
                width: `${Math.min(100, Math.round(Number(pakToggleProgress.current || 0) / Math.max(1, Number(pakToggleProgress.total || 1)) * 100))}%`,
                borderRadius: "999px",
                background: pakToggleProgress.status === "done" ? "linear-gradient(90deg, #34d399, #10b981)" : "linear-gradient(90deg, #a5b4fc, #6366f1)",
                transition: "width 0.24s ease"
              } }) })
            ] })
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `${viewMode === "gallery" ? "mod-gallery-panel" : "mod-list-panel"} card`, style: { padding: "0", background: "rgba(255,255,255,0.6)" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-view-titlebar", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                onClick: onBack,
                className: "btn btn-secondary mod-view-back-btn",
                "aria-label": "返回角色一览",
                children: "←"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-h2 mod-view-title", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: characterName }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mod-view-active-section-label", children: activeAppearanceSectionName })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-view-titlebar-actions", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  className: `sort-option ${exclusiveMode ? "active" : ""}`,
                  onClick: toggleExclusiveMode,
                  title: "开启后，启用一个Mod会自动禁用其他Mod",
                  children: "🔘 单选"
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  className: `sort-option local-collection-toggle ${localCollectionsEnabled ? "active" : ""}`,
                  onClick: toggleLocalCollectionsEnabled,
                  title: localCollectionsEnabled ? "关闭本地 Mod 合集展示" : "按名称合并同一 Mod 的版本/变体",
                  "aria-pressed": localCollectionsEnabled,
                  children: "合集"
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "button",
                {
                  className: `view-mode-toggle ${viewMode === "gallery" ? "is-gallery" : "is-list"}`,
                  onClick: toggleViewMode,
                  title: viewMode === "gallery" ? "切回列表视图" : "切换到画廊视图（以大图网格展示 Mod）",
                  "aria-label": viewMode === "gallery" ? "切换到列表视图" : "切换到画廊视图",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "view-mode-toggle-icon", "aria-hidden": "true", children: viewMode === "gallery" ? /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { width: "14", height: "14", viewBox: "0 0 14 14", fill: "none", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { x: "1", y: "2", width: "12", height: "2", rx: "1", fill: "currentColor" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { x: "1", y: "6", width: "12", height: "2", rx: "1", fill: "currentColor" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { x: "1", y: "10", width: "12", height: "2", rx: "1", fill: "currentColor" })
                    ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { width: "14", height: "14", viewBox: "0 0 14 14", fill: "none", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { x: "1", y: "1", width: "5", height: "5", rx: "1", fill: "currentColor" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { x: "8", y: "1", width: "5", height: "5", rx: "1", fill: "currentColor" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { x: "1", y: "8", width: "5", height: "5", rx: "1", fill: "currentColor" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { x: "8", y: "8", width: "5", height: "5", rx: "1", fill: "currentColor" })
                    ] }) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "view-mode-toggle-label", children: viewMode === "gallery" ? "进入列表" : "进入画廊" })
                  ]
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            CharacterSectionNavigator,
            {
              characterName,
              sections: appearanceSectionsWithStats,
              activeSectionId: activeAppearanceSectionId,
              busy: appearanceSectionBusy,
              onSelect: selectAppearanceSection,
              onSaveCustomSection: handleSaveCustomAppearanceSection,
              onDeleteCustomSection: handleDeleteCustomAppearanceSection
            }
          ),
          modsLoadError && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "appearance-section-load-error", role: "alert", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "角色 Mod 读取失败" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("em", { children: modsLoadError })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: () => loadMods(), children: "重试" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-sort-bar", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-search-field", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "input",
                {
                  type: "text",
                  placeholder: "搜索当前分区的 Mod…",
                  "aria-label": "搜索当前分区的 Mod",
                  value: modSearchQuery,
                  onChange: (e) => setModSearchQuery(e.target.value),
                  className: "mod-search-input"
                }
              ),
              modSearchQuery && /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  onClick: () => setModSearchQuery(""),
                  "aria-label": "清除搜索",
                  style: { position: "absolute", right: "4px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "10px", color: "#999", padding: "2px" },
                  children: "✕"
                }
              )
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-sort-options", role: "group", "aria-label": "Mod 排序", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                className: `sort-option ${sortMethod === "name" ? "active" : ""}`,
                onClick: () => setSortMethod("name"),
                children: "名称"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                className: `sort-option ${sortMethod === "enabled" ? "active" : ""}`,
                onClick: () => setSortMethod("enabled"),
                children: "状态"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                className: `sort-option ${sortMethod === "time" ? "active" : ""}`,
                onClick: () => setSortMethod("time"),
                title: "按加入管理器的时间排序（新的在前）",
                children: "时间"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                className: `sort-option ${sortMethod === "custom" ? "active" : ""}`,
                onClick: () => setSortMethod("custom"),
                title: "使用自定义顺序（拖拽后自动切换）",
                children: "自定义"
              }
            ),
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                className: "sort-option mod-focus-enabled-btn",
                onClick: focusNextEnabledMod,
                disabled: !sortedMods.some((mod) => mod.enabled),
                title: sortedMods.some((mod) => mod.enabled) ? `定位当前启用 Mod（${displayMods.filter((mod) => mod.enabled).length} 个）` : "当前没有启用的 Mod",
                children: "定位已启用"
              }
            )
          ] }),
          selectedTagFilters.size > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: {
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            background: "rgba(99,102,241,0.06)",
            borderBottom: "1px solid rgba(99,102,241,0.12)",
            fontSize: "12px",
            flexWrap: "wrap"
          }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "var(--color-text-secondary, #555)", marginRight: "2px", fontWeight: 500 }, children: "🏷 标签筛选（需同时匹配）:" }),
            Array.from(selectedTagFilters).map((tagKey) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "span",
              {
                style: {
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "2px 4px 2px 10px",
                  borderRadius: "999px",
                  fontSize: "12px",
                  lineHeight: "18px",
                  fontWeight: 500,
                  background: "linear-gradient(90deg, #818cf8, #6366f1)",
                  color: "#fff",
                  border: "1px solid rgba(79,70,229,0.8)",
                  boxShadow: "0 1px 3px rgba(79,70,229,0.25)"
                },
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                    "#",
                    tagKey
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      onClick: () => toggleTagFilter(tagKey),
                      title: `移除筛选 #${tagKey}`,
                      style: {
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        background: "rgba(255,255,255,0.25)",
                        color: "#fff",
                        fontSize: "11px",
                        lineHeight: 1
                      },
                      onMouseEnter: (e) => e.currentTarget.style.background = "rgba(255,255,255,0.4)",
                      onMouseLeave: (e) => e.currentTarget.style.background = "rgba(255,255,255,0.25)",
                      children: "×"
                    }
                  )
                ]
              },
              `filter-chip-${tagKey}`
            )),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                onClick: clearTagFilters,
                title: "清空所有标签筛选",
                style: {
                  marginLeft: "4px",
                  fontSize: "11px",
                  padding: "3px 10px",
                  borderRadius: "999px",
                  border: "1px solid rgba(0,0,0,0.08)",
                  background: "rgba(255,255,255,0.7)",
                  color: "var(--color-text-secondary, #555)",
                  cursor: "pointer"
                },
                onMouseEnter: (e) => e.currentTarget.style.background = "rgba(255,255,255,1)",
                onMouseLeave: (e) => e.currentTarget.style.background = "rgba(255,255,255,0.7)",
                children: "清空"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { flex: 1 } }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { color: "var(--color-text-tertiary, #888)", fontSize: "11px" }, children: [
              "匹配 ",
              /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { style: { color: "var(--color-accent-primary, #667eea)" }, children: displayMods.length }),
              " 个 Mod"
            ] })
          ] }),
          batchMode && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: {
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            background: "rgba(102,126,234,0.05)",
            borderBottom: "1px solid rgba(102,126,234,0.1)",
            fontSize: "13px",
            flexWrap: "wrap"
          }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { color: "#666", marginRight: "4px" }, children: [
              "已选 ",
              /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { style: { color: "var(--color-accent-primary, #667eea)" }, children: selectedMods.size }),
              " 个"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: selectAllMods, style: { fontSize: "12px", padding: "3px 8px", borderRadius: "4px", border: "1px solid #ddd", background: "white", cursor: "pointer" }, children: "全选" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: deselectAllMods, style: { fontSize: "12px", padding: "3px 8px", borderRadius: "4px", border: "1px solid #ddd", background: "white", cursor: "pointer" }, children: "取消全选" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { flex: 1 } }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                onClick: () => batchToggle(true),
                disabled: selectedMods.size === 0,
                style: { fontSize: "12px", padding: "4px 10px", borderRadius: "4px", border: "none", background: "#27ae60", color: "white", cursor: selectedMods.size > 0 ? "pointer" : "default", opacity: selectedMods.size > 0 ? 1 : 0.5 },
                children: "✓ 批量启用"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                onClick: () => batchToggle(false),
                disabled: selectedMods.size === 0,
                style: { fontSize: "12px", padding: "4px 10px", borderRadius: "4px", border: "none", background: "#f39c12", color: "white", cursor: selectedMods.size > 0 ? "pointer" : "default", opacity: selectedMods.size > 0 ? 1 : 0.5 },
                children: "⊘ 批量禁用"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                onClick: batchDelete,
                disabled: selectedMods.size === 0,
                style: { fontSize: "12px", padding: "4px 10px", borderRadius: "4px", border: "none", background: "#e74c3c", color: "white", cursor: selectedMods.size > 0 ? "pointer" : "default", opacity: selectedMods.size > 0 ? 1 : 0.5 },
                children: "🗑 批量删除"
              }
            )
          ] }),
          viewMode === "gallery" ? /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              ref: modsListRef,
              className: "mod-gallery-grid-wrap",
              onScroll: (e) => {
                const scrollTop = e.target.scrollTop;
                if (scrollRafRef.current) return;
                scrollRafRef.current = requestAnimationFrame(() => {
                  scrollRafRef.current = null;
                  persistModViewState({ scrollTop });
                  setShowScrollTop(scrollTop > 300);
                });
              },
              children: [
                displayMods.length === 0 && !modsLoadError && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "appearance-section-empty-state", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(SectionCover, { section: activeAppearanceSection, className: "appearance-section-empty-cover", decorative: true }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: appearanceFilterHasNoMatches ? "当前筛选没有匹配的 Mod" : `“${activeAppearanceSectionName}”还没有 Mod` }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: appearanceFilterHasNoMatches ? "清除搜索或标签筛选后可查看该分区的全部 Mod。" : activeAppearanceEmptyHint }),
                    appearanceFilterHasNoMatches && /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        type: "button",
                        className: "appearance-section-empty-clear",
                        onClick: () => {
                          setModSearchQuery("");
                          clearTagFilters();
                        },
                        children: "清除筛选"
                      }
                    )
                  ] })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mod-gallery-grid", children: displayMods.map((mod) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  "div",
                  {
                    "data-mod-name": mod.name,
                    className: `mod-gallery-card ${mod._localCollection ? "local-collection-card" : ""} ${openLocalCollectionGalleryMenu === mod._localCollection?.identity ? "local-collection-menu-open" : ""} ${selectedMod?.path === mod.path && !detailCollapsed ? "selected" : ""}`,
                    style: focusPulseModName === mod.name ? STYLE_FOCUS_PULSE : STYLE_EMPTY,
                    onClick: (event) => {
                      if (event.target.closest(".local-collection-gallery-dropdown")) return;
                      if (detailCollapsed || !selectedMod) captureGalleryAnchor(mod.name);
                      setSelectedMod(mod);
                      setDetailCollapsed(false);
                    },
                    onContextMenu: (e) => openModContextMenu(e, mod),
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-gallery-card-image", children: [
                        mod.previewUrl ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "img",
                          {
                            src: mod.previewUrl,
                            alt: mod.name,
                            loading: "lazy",
                            draggable: false,
                            onError: (e) => {
                              e.currentTarget.style.display = "none";
                            }
                          }
                        ) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mod-gallery-card-placeholder", children: "🖼️" }),
                        mod.pinned && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mod-gallery-card-pin", title: "已置顶", children: "📌" }),
                        mod._localCollection && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "local-collection-badge", children: [
                          "合集 ",
                          mod._localCollection.variants.length
                        ] }),
                        mod._localCollection && /* @__PURE__ */ jsxRuntimeExports.jsx(
                          LocalCollectionGalleryDropdown,
                          {
                            collection: mod._localCollection,
                            currentPath: mod.path,
                            isOpen: openLocalCollectionGalleryMenu === mod._localCollection.identity,
                            onToggle: (identity, forceOpen = false) => {
                              setOpenLocalCollectionGalleryMenu((current) => forceOpen ? identity : current === identity ? null : identity);
                            },
                            onClose: () => setOpenLocalCollectionGalleryMenu(null),
                            onSelect: selectLocalCollectionVariant
                          }
                        ),
                        markModeUnlocked ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "button",
                          {
                            className: `mod-gallery-card-mark ${isMarkedModEntry(markedMods, mod, characterName, activeGameId) ? "active" : ""}`,
                            onClick: (e) => handleMarkMod(mod, e),
                            title: isMarkedModEntry(markedMods, mod, characterName, activeGameId) ? "取消标记" : "标记此 Mod",
                            children: "🔖"
                          }
                        ) : isMarkedModEntry(markedMods, mod, characterName, activeGameId) && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mod-gallery-card-mark active", title: "已标记", children: "🔖" })
                      ] }),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-gallery-card-footer", children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "div",
                          {
                            className: "mod-gallery-card-name",
                            title: mod.notes ? `${mod.name}
(${mod.notes})` : mod.name,
                            children: mod.name
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "div",
                          {
                            className: `toggle-switch-refined ${mod.enabled ? "active" : ""} mod-gallery-card-toggle`,
                            onClick: (e) => handleToggle(mod.name, mod.enabled, e),
                            title: mod.enabled ? "点击禁用" : "点击启用"
                          }
                        )
                      ] })
                    ]
                  },
                  mod.path
                )) }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "div",
                  {
                    className: `drop-zone ${isDragging ? "active" : ""}`,
                    style: { marginTop: "24px", minHeight: "100px" },
                    onDragOver: (e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    },
                    onDragLeave: () => setIsDragging(false),
                    onDrop: (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragging(false);
                      handleDirectImportDropFiles(e.dataTransfer.files);
                    },
                    children: newModFile ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { width: "100%" }, children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontWeight: "bold", color: "var(--color-accent-primary)", marginBottom: "12px" }, children: [
                        "📦 ",
                        newModFile.name
                      ] }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "input",
                        {
                          type: "text",
                          placeholder: "给 Mod 起个名字...",
                          value: newModName,
                          onChange: (e) => setNewModName(e.target.value),
                          className: "input",
                          style: { width: "100%", marginBottom: "12px" }
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: "8px", justifyContent: "center" }, children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: handleAddMod, className: "btn btn-primary", children: "保存 Mod" }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => setNewModFile(null), className: "btn btn-secondary", children: "取消" })
                      ] })
                    ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: "20px", marginBottom: "4px" }, children: "📂" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: "13px" }, children: [
                        "拖拽 Mod 到“",
                        activeAppearanceImportTargetName,
                        "”"
                      ] })
                    ] })
                  }
                )
              ]
            }
          ) : /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              ref: modsListRef,
              className: "mods-list",
              style: STYLE_MODS_LIST,
              onScroll: (e) => {
                const scrollTop = e.target.scrollTop;
                if (scrollRafRef.current) return;
                scrollRafRef.current = requestAnimationFrame(() => {
                  scrollRafRef.current = null;
                  persistModViewState({ scrollTop });
                  setShowScrollTop(scrollTop > 300);
                });
              },
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-list-summary", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: `Mod 列表 · ${displayMods.length}` }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: `${displayMods.filter((mod) => mod.enabled).length} 个已启用` })
                ] }),
                displayMods.length === 0 && !modsLoadError && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "appearance-section-empty-state compact", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(SectionCover, { section: activeAppearanceSection, className: "appearance-section-empty-cover", decorative: true }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: appearanceFilterHasNoMatches ? "当前筛选没有匹配的 Mod" : `“${activeAppearanceSectionName}”还没有 Mod` }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: appearanceFilterHasNoMatches ? "清除搜索或标签筛选后可查看该分区的全部 Mod。" : activeAppearanceEmptyHint }),
                    appearanceFilterHasNoMatches && /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        type: "button",
                        className: "appearance-section-empty-clear",
                        onClick: () => {
                          setModSearchQuery("");
                          clearTagFilters();
                        },
                        children: "清除筛选"
                      }
                    )
                  ] })
                ] }),
                displayMods.map((mod, index) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  "div",
                  {
                    "data-mod-name": mod.name,
                    className: `mod-row ${mod._localCollection ? "local-collection-row" : ""} ${selectedMod?.path === mod.path ? "selected" : ""} ${!mod.enabled ? "disabled" : ""} ${draggedMod?.name === mod.name ? "dragging" : ""} ${dragOverMod?.name === mod.name ? "drag-target" : ""}`,
                    style: focusPulseModName === mod.name ? STYLE_FOCUS_PULSE : STYLE_EMPTY,
                    draggable: !batchMode,
                    onClick: () => {
                      if (batchMode) return toggleBatchSelect(mod.name);
                      setSelectedMod(mod);
                      setDetailCollapsed(false);
                    },
                    onContextMenu: (e) => !batchMode && openModContextMenu(e, mod),
                    onDragStart: (e) => !batchMode && handleModDragStart(e, mod),
                    onDragEnd: handleModDragEnd,
                    onDragOver: (e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (draggedMod && draggedMod.name !== mod.name) {
                        setDragOverMod(mod);
                      }
                    },
                    onDragLeave: (e) => {
                      if (!e.currentTarget.contains(e.relatedTarget)) {
                        setDragOverMod(null);
                      }
                    },
                    onDrop: (e) => handleModDrop(e, mod),
                    children: [
                      batchMode ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "div",
                        {
                          style: {
                            width: 20,
                            height: 20,
                            borderRadius: "4px",
                            border: selectedMods.has(mod.name) ? "2px solid var(--color-accent-primary, #667eea)" : "2px solid #ccc",
                            background: selectedMods.has(mod.name) ? "var(--color-accent-primary, #667eea)" : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: "8px",
                            flexShrink: 0,
                            cursor: "pointer",
                            transition: "all 0.15s"
                          },
                          onClick: (e) => {
                            e.stopPropagation();
                            toggleBatchSelect(mod.name);
                          },
                          children: selectedMods.has(mod.name) && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "white", fontSize: "12px", fontWeight: "bold" }, children: "✓" })
                        }
                      ) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "drag-handle", title: "拖拽排序", children: "⋮⋮" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "button",
                        {
                          className: `toggle-switch-refined ${mod.enabled ? "active" : ""}`,
                          type: "button",
                          role: "switch",
                          "aria-checked": mod.enabled,
                          "aria-label": `${mod.enabled ? "禁用" : "启用"} ${mod.name}`,
                          onClick: (e) => handleToggle(mod.name, mod.enabled, e),
                          style: STYLE_TOGGLE_WRAP
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-row-info", style: STYLE_MOD_INFO, title: mod.originalName, children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-row-name", style: STYLE_MOD_NAME_ROW, children: [
                          mod._localCollection && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "local-collection-inline-badge", children: [
                            "合集 ",
                            mod._localCollection.variants.length
                          ] }),
                          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mod-row-name-text", children: mod.name }),
                          mod.pinned && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { title: "已置顶", style: STYLE_PIN_ICON, children: "📌" }),
                          isMarkedModEntry(markedMods, mod, characterName, activeGameId) && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { title: "已标记", style: { fontSize: "12px", flexShrink: 0 }, children: "🔖" }),
                          conflictMap[mod.name] && mod.enabled && /* @__PURE__ */ jsxRuntimeExports.jsx(
                            "span",
                            {
                              title: `与 ${conflictMap[mod.name].map((c) => c.otherMods.join(", ")).join(", ")} 存在 Hash 冲突`,
                              onClick: (e) => {
                                e.stopPropagation();
                                setShowConflictDetail(showConflictDetail === mod.name ? null : mod.name);
                              },
                              style: STYLE_CONFLICT_ICON,
                              children: "⚠️"
                            }
                          )
                        ] }),
                        showConflictDetail === mod.name && conflictMap[mod.name] && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: STYLE_CONFLICT_DETAIL, children: conflictMap[mod.name].map((c, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                          "Hash ",
                          /* @__PURE__ */ jsxRuntimeExports.jsxs("code", { style: STYLE_CONFLICT_HASH, children: [
                            c.hash.substring(0, 8),
                            "..."
                          ] }),
                          " 冲突: ",
                          c.otherMods.join(", ")
                        ] }, i)) }),
                        mod.notes ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: STYLE_NOTE_LINE, title: mod.notes, children: [
                          "(",
                          mod.notes,
                          ")"
                        ] }) : mod.originalName?.replace(/^DISABLED_/i, "") !== mod.name && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: STYLE_ORIGINAL_NAME, children: mod.originalName }),
                        Array.isArray(mod.tags) && mod.tags.length > 0 && jsxRuntimeExports.jsx(FittingTagRow, { tags: mod.tags, selectedTags: selectedTagFilters, onToggleTag: toggleTagFilter }),
                        mod._localCollection && /* @__PURE__ */ jsxRuntimeExports.jsx(
                          LocalCollectionVariantStrip,
                          {
                            collection: mod._localCollection,
                            currentPath: mod.path,
                            onSelect: selectLocalCollectionVariant
                          }
                        )
                      ] }),
                      markModeUnlocked && /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "button",
                        {
                          onClick: (e) => handleMarkMod(mod, e),
                          title: isMarkedModEntry(markedMods, mod, characterName, activeGameId) ? "取消标记" : "标记此 Mod",
                          style: {
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "15px",
                            padding: "0 4px",
                            opacity: isMarkedModEntry(markedMods, mod, characterName, activeGameId) ? 1 : 0.3,
                            flexShrink: 0,
                            transition: "opacity 0.15s"
                          },
                          children: "🔖"
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "button",
                        {
                          className: "delete-btn",
                          "aria-label": `删除 ${mod.name}`,
                          title: "删除 Mod",
                          onClick: (e) => confirmDelete(mod.name, e),
                          style: STYLE_DELETE_BTN,
                          children: "×"
                        }
                      ),
                      dragOverMod?.name === mod.name && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mod-drop-overlay", children: "📍 放置到此处" })
                    ]
                  },
                  mod.path
                )),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "div",
                  {
                    className: `drop-zone mod-import-zone ${isDragging ? "active" : ""}`,
                    onDragOver: (e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    },
                    onDragLeave: () => setIsDragging(false),
                    onDrop: (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragging(false);
                      handleDirectImportDropFiles(e.dataTransfer.files);
                    },
                    children: newModFile ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { width: "100%" }, children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontWeight: "bold", color: "var(--color-accent-primary)", marginBottom: "12px" }, children: [
                        "📦 ",
                        newModFile.name
                      ] }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "input",
                        {
                          type: "text",
                          placeholder: "给 Mod 起个名字...",
                          value: newModName,
                          onChange: (e) => setNewModName(e.target.value),
                          className: "input",
                          style: { width: "100%", marginBottom: "16px" }
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: "8px", justifyContent: "center" }, children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: handleAddMod, className: "btn btn-primary", children: "保存 Mod" }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => setNewModFile(null), className: "btn btn-secondary", children: "取消" })
                      ] })
                    ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-import-hint", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mod-import-icon", "aria-hidden": true, children: "+" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "拖入文件夹或压缩包，添加 Mod" }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: `支持 Zip / Rar / 7z / MP4 · ${activeAppearanceImportTargetName}` })
                      ] })
                    ] })
                  }
                )
              ]
            }
          )
        ] }),
        selectedMod && /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: `mod-gallery-splitter ${isResizingGallery ? "active" : ""} ${detailCollapsed ? "collapsed" : ""}`,
            "aria-hidden": detailCollapsed,
            inert: detailCollapsed ? "" : void 0,
            onMouseDown: (e) => {
              if (e.target.closest(".mod-gallery-collapse-btn")) return;
              if (detailCollapsed) return;
              e.preventDefault();
              setIsResizingGallery(true);
            },
            onDoubleClick: (e) => {
              if (e.target.closest(".mod-gallery-collapse-btn")) return;
              setGalleryDetailWidth(480);
            },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "button",
                {
                  type: "button",
                  className: "mod-gallery-collapse-btn",
                  onClick: (e) => {
                    e.stopPropagation();
                    if (viewMode === "gallery") captureGalleryAnchor(selectedMod?.name);
                    setDetailCollapsed(true);
                  },
                  onMouseDown: (e) => e.stopPropagation(),
                  title: "收起详情面板（点击 Mod 可重新展开）",
                  "aria-expanded": !detailCollapsed,
                  "aria-controls": "mod-detail-panel",
                  "aria-label": "收起详情",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mod-gallery-collapse-arrow", children: "›" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mod-gallery-collapse-label", children: "收起" })
                  ]
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "div",
                {
                  className: "mod-gallery-splitter-handle",
                  title: "拖动调整详情区宽度（双击重置）",
                  role: "separator",
                  tabIndex: detailCollapsed ? -1 : 0,
                  "aria-label": "调整详情面板宽度",
                  "aria-orientation": "vertical",
                  "aria-controls": "mod-detail-panel",
                  "aria-valuemin": Math.round(minDetailWidth),
                  "aria-valuemax": Math.round(maxDetailWidth),
                  "aria-valuenow": Math.round(visibleDetailWidth),
                  onKeyDown: (event) => {
                    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                    event.preventDefault();
                    const width = event.key === "Home" ? minDetailWidth : event.key === "End" ? maxDetailWidth : visibleDetailWidth + (event.key === "ArrowLeft" ? 24 : -24);
                    setGalleryDetailWidth(Math.min(maxDetailWidth, Math.max(minDetailWidth, width)));
                  },
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mod-gallery-splitter-dot" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mod-gallery-splitter-dot" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mod-gallery-splitter-dot" })
                  ]
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "div",
          {
            id: "mod-detail-panel",
            className: `mod-detail-panel ${viewMode === "gallery" ? "gallery-mode" : ""} ${!selectedMod || detailCollapsed ? "collapsed" : ""}`,
            "aria-hidden": !selectedMod || detailCollapsed,
            inert: !selectedMod || detailCollapsed ? "" : void 0,
            style: { "--mod-detail-width": selectedMod && !detailCollapsed ? `${visibleDetailWidth}px` : "0px" },
            children: selectedMod ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card mod-detail-card", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { className: "mod-detail-header", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-detail-eyebrow", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "MOD 详情" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `mod-status-badge ${selectedMod.enabled ? "is-enabled" : ""}`, children: selectedMod.enabled ? "已启用" : "已禁用" })
                ] }),
              isRenamingMod ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-detail-rename", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "input",
                  {
                    type: "text",
                    value: renameModDraft,
                    autoFocus: true,
                    onChange: (e) => setRenameModDraft(e.target.value),
                    onKeyDown: (e) => {
                      if (e.key === "Enter") handleSaveModRename();
                      else if (e.key === "Escape") setIsRenamingMod(false);
                    },
                    className: "input",
                    style: {
                      flex: 1,
                      fontSize: "20px",
                      fontWeight: 600,
                      color: "var(--color-accent-primary)",
                      padding: "6px 10px",
                      border: "2px solid var(--color-accent-primary)",
                      borderRadius: "var(--radius-sm)",
                      background: "white",
                      outline: "none"
                    }
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    className: "btn btn-primary",
                    disabled: renameModSaving,
                    onClick: handleSaveModRename,
                    style: { padding: "6px 12px", fontSize: "13px" },
                    children: renameModSaving ? "保存中…" : "保存"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    className: "btn btn-secondary",
                    disabled: renameModSaving,
                    onClick: () => setIsRenamingMod(false),
                    style: { padding: "6px 12px", fontSize: "13px" },
                    children: "取消"
                  }
                )
              ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "div",
                {
                  className: "mod-detail-heading",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { wordBreak: "break-word" }, children: selectedMod.name }),
                    selectedMod.pinned && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: "18px" }, title: "已置顶", children: "📌" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        onClick: () => {
                          setRenameModDraft(selectedMod.name);
                          setIsRenamingMod(true);
                        },
                        title: "重命名 Mod",
                        style: {
                          background: "rgba(255,255,255,0.5)",
                          border: "1px solid rgba(0,0,0,0.08)",
                          borderRadius: "var(--radius-sm)",
                          padding: "2px 8px",
                          fontSize: "12px",
                          lineHeight: "18px",
                          color: "var(--color-text-secondary, #555)",
                          cursor: "pointer",
                          opacity: 0.8,
                          transition: "opacity 0.15s"
                        },
                        onMouseEnter: (e) => e.currentTarget.style.opacity = "1",
                        onMouseLeave: (e) => e.currentTarget.style.opacity = "0.8",
                        children: "✏️ 重命名"
                      }
                    )
                  ]
                }
              ),
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "div",
                {
                  className: `image-drop-zone mod-detail-preview ${previewImage ? "has-image" : "is-empty"} ${isDragging ? "dragging" : ""}`,
                  style: {
                    position: "relative",
                    cursor: "pointer",
                    aspectRatio: previewImage ? getPreviewAspectRatioStyle(previewImageAspectRatio) : void 0,
                    minHeight: previewImage ? "180px" : "128px",
                    maxHeight: previewImage ? "min(42vh, 420px)" : void 0,
                    flexShrink: 0,
                    background: "var(--color-bg-base)",
                    borderRadius: "var(--radius-md)",
                    overflow: "hidden",
                    marginBottom: "16px",
                    border: "2px dashed transparent"
                  },
                  onDragOver: (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(dataTransferIncludesImage(e.dataTransfer));
                  },
                  onDragLeave: (e) => {
                    e.preventDefault();
                    if (!e.currentTarget.contains(e.relatedTarget)) {
                      setIsDragging(false);
                    }
                  },
                  onDrop: async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(false);
                    const files = e.dataTransfer.files;
                    if (files.length > 0) {
                      const file = files[0];
                      const filePath = window.api.getPathForFile(file);
                      if (/\.(png|jpg|jpeg|webp|gif)$/i.test(filePath)) {
                        const result = await window.api.setModPreview(characterName, selectedMod.name, filePath);
                        if (result.success) {
                          setImageKey(Date.now());
                          if (result.previewUrl) setPreviewImage(result.previewUrl);
                          else loadModDetails(selectedMod.name);
                          setToast({ type: "success", message: "✨ 预览图已更新！" });
                        }
                      } else {
                        setToast({ type: "error", message: "请拖入图片文件" });
                      }
                    }
                  },
                  children: [
                    previewImage ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "img",
                      {
                        src: previewImage,
                        alt: "Preview",
                        style: { width: "100%", height: "100%", objectFit: "contain", objectPosition: "center top", cursor: "zoom-in" },
                        onClick: (e) => {
                          e.stopPropagation();
                          setShowImageLightbox(true);
                        },
                        onLoad: (e) => {
                          const width = e.currentTarget.naturalWidth;
                          const height = e.currentTarget.naturalHeight;
                          if (width > 0 && height > 0) {
                            const nextAspectRatio = width / height;
                            _previewAspectRatioCache.set(selectedMod.path || selectedMod.name, nextAspectRatio);
                            setPreviewImageAspectRatio(nextAspectRatio);
                          }
                        },
                        onError: (e) => setToast({ type: "error", message: "图片加载失败" })
                      },
                      imageKey
                    ) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-preview-placeholder", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mod-preview-placeholder-icon", "aria-hidden": true, children: "▧" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "拖入图片设置预览" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: "11px", opacity: 0.75 }, children: "或按 Ctrl+V 粘贴图片" })
                    ] }),
                    isDragging && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: {
                      position: "absolute",
                      inset: 0,
                      background: "rgba(255, 143, 163, 0.9)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontWeight: "bold",
                      fontSize: "18px"
                    }, children: "释放以设置预览图" })
                  ]
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-appearance-assignment", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-appearance-assignment-copy", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "外观分区" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("em", { children: "移动不改变启用状态" })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "select",
                  {
                    value: getModAppearanceSectionId(selectedMod),
                    onChange: (event) => handleAssignSelectedModAppearanceSection(event.target.value),
                    disabled: appearanceSectionBusy,
                    "aria-label": `将 ${selectedMod.name} 移动到外观分区`,
                    children: appearanceSectionsWithStats.map((section) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: getSectionId(section), children: getSectionName(section) }, getSectionId(section)))
                  }
                )
              ] }),
              selectedLocalCollection && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "local-collection-detail-panel", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "local-collection-detail-head", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "local-collection-detail-title", children: [
                    "合集：",
                    selectedLocalCollection.name
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "local-collection-detail-count", children: [
                    selectedLocalCollection.variants.length,
                    " 个版本/变体"
                  ] })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  LocalCollectionVariantStrip,
                  {
                    collection: selectedLocalCollection,
                    currentPath: selectedMod.path,
                    onSelect: selectLocalCollectionVariant
                  }
                )
              ] }),
              Array.isArray(selectedMod.tags) && selectedMod.tags.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" }, children: selectedMod.tags.map((tag, ti) => {
                const tagActive = selectedTagFilters.has(String(tag).toLowerCase());
                return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  "span",
                  {
                    title: tagActive ? `点击取消筛选 #${tag}` : `点击加入筛选 #${tag}（支持多选）`,
                    onClick: () => toggleTagFilter(String(tag)),
                    style: {
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "3px 10px",
                      borderRadius: "999px",
                      fontSize: "12px",
                      fontWeight: 500,
                      background: tagActive ? "linear-gradient(90deg, #818cf8, #6366f1)" : "rgba(99,102,241,0.10)",
                      color: tagActive ? "#fff" : "#4338ca",
                      border: tagActive ? "1px solid rgba(79,70,229,0.8)" : "1px solid rgba(99,102,241,0.2)",
                      boxShadow: tagActive ? "0 1px 3px rgba(79,70,229,0.25)" : "none",
                      cursor: "pointer",
                      transition: "background 0.15s, color 0.15s, border-color 0.15s"
                    },
                    onMouseEnter: (e) => {
                      if (!tagActive) e.currentTarget.style.background = "rgba(99,102,241,0.18)";
                    },
                    onMouseLeave: (e) => {
                      if (!tagActive) e.currentTarget.style.background = "rgba(99,102,241,0.10)";
                    },
                    children: [
                      "#",
                      tag
                    ]
                  },
                  `detail-tag-${ti}`
                );
              }) }),
              jsxRuntimeExports.jsx(ModPersistSummary, { gameId: activeGameId, characterName, modName: selectedMod.name }, `${activeGameId}/${characterName}/${selectedMod.name}`),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-detail-notes", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  "div",
                  {
                    className: "text-caption",
                    style: { marginBottom: "6px", display: "flex", alignItems: "center", justifyContent: "space-between" },
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "备注" }),
                      !isEditingNotes && /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "button",
                        {
                          onClick: () => {
                            setNotesDraft(selectedMod.notes || "");
                            setIsEditingNotes(true);
                          },
                          style: {
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "12px",
                            color: "var(--color-accent-primary)",
                            padding: "2px 4px"
                          },
                          children: selectedMod.notes ? "编辑" : "添加"
                        }
                      )
                    ]
                  }
                ),
                isEditingNotes ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "textarea",
                    {
                      value: notesDraft,
                      onChange: (e) => setNotesDraft(e.target.value),
                      placeholder: "为这个 Mod 写点备注，比如来源、差分说明、已测试游戏版本…",
                      maxLength: 500,
                      rows: 3,
                      style: {
                        width: "100%",
                        resize: "vertical",
                        padding: "8px 10px",
                        fontSize: "13px",
                        lineHeight: "1.5",
                        border: "1px solid rgba(0,0,0,0.1)",
                        borderRadius: "var(--radius-sm)",
                        background: "rgba(255,255,255,0.7)",
                        outline: "none",
                        fontFamily: "inherit",
                        color: "var(--color-text-primary)"
                      },
                      onFocus: (e) => {
                        e.target.style.borderColor = "var(--color-accent-primary)";
                      },
                      onBlur: (e) => {
                        e.target.style.borderColor = "rgba(0,0,0,0.1)";
                      }
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: "8px", marginTop: "8px", justifyContent: "flex-end" }, children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { flex: 1, fontSize: "11px", color: "var(--color-text-tertiary)", alignSelf: "center" }, children: [
                      notesDraft.length,
                      "/500"
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        className: "btn btn-secondary",
                        disabled: notesSaving,
                        onClick: () => setIsEditingNotes(false),
                        style: { padding: "5px 12px", fontSize: "12px" },
                        children: "取消"
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        className: "btn btn-primary",
                        disabled: notesSaving,
                        onClick: handleSaveModNotes,
                        style: { padding: "5px 12px", fontSize: "12px" },
                        children: notesSaving ? "保存中…" : "保存备注"
                      }
                    )
                  ] })
                ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "div",
                  {
                    onClick: () => {
                      setNotesDraft(selectedMod.notes || "");
                      setIsEditingNotes(true);
                    },
                    style: {
                      padding: "8px 10px",
                      borderRadius: "var(--radius-sm)",
                      background: selectedMod.notes ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.025)",
                      border: "1px dashed rgba(0,0,0,0.08)",
                      color: selectedMod.notes ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                      fontSize: "13px",
                      lineHeight: "1.55",
                      whiteSpace: "pre-wrap",
                      cursor: "text",
                      minHeight: "28px"
                    },
                    children: selectedMod.notes || "点击添加备注…"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hotkey-section", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-caption", style: { marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "⌨️ 快捷键" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      className: "btn-icon-small",
                      disabled: isRefreshingHotkeys,
                      onClick: (e) => {
                        e.stopPropagation();
                        loadModDetails(selectedMod.name, true);
                      },
                      title: "刷新快捷键 (强制重新扫描)",
                      style: { background: "none", border: "none", cursor: "pointer", padding: "4px" },
                      children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: {
                        display: "inline-block",
                        animation: isRefreshingHotkeys ? "spin 1s linear infinite" : "none"
                      }, children: "🔄" })
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "hotkey-group-list", children: hotkeyGroups.length === 0 ? jsxRuntimeExports.jsx("div", { className: "text-caption", children: "暂无快捷键，可点击刷新重新读取" }) : hotkeyGroups.map((group, groupIndex) => jsxRuntimeExports.jsxs("section", { className: "hotkey-group", children: [
                  jsxRuntimeExports.jsx("h3", { className: "hotkey-group-name", title: group.relativePath || group.name, children: group.name }),
                  group.hotkeys.map((hk, rowIndex) => {
                    const index = `${groupIndex}:${rowIndex}`;
                    const aliasKey = group.relativePath ? `${group.relativePath}/${hk.section}` : hk.section;
                    return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  "div",
                  {
                    className: "hotkey-row",
                    style: hk.isMenu || hk.description === "菜单" ? {
                      background: "rgba(255, 182, 193, 0.2)",
                      borderLeft: "4px solid var(--color-accent-primary)",
                      borderRadius: "4px",
                      marginBottom: "4px",
                      padding: "8px 12px"
                    } : {},
                    children: [
                      (() => {
                        const aliases = selectedMod?.hotkeyAliases || {};
                        const alias = aliases[aliasKey] || aliases[hk.section] || "";
                        const isMenu = hk.isMenu || hk.description === "菜单";
                        const base = isMenu ? "📋 菜单 (Menu)" : hk.description;
                        const label = alias || base;
                        const isEditing = editingAliasSection === aliasKey;
                        if (isEditing) {
                          return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", alignItems: "center", gap: "4px", flex: 1, minWidth: 0 }, children: [
                            /* @__PURE__ */ jsxRuntimeExports.jsx(
                              "input",
                              {
                                type: "text",
                                value: aliasDraft,
                                autoFocus: true,
                                maxLength: 40,
                                placeholder: base,
                                onChange: (e) => setAliasDraft(e.target.value),
                                onKeyDown: (e) => {
                                  if (e.key === "Enter") handleSaveHotkeyAlias(aliasKey);
                                  else if (e.key === "Escape") {
                                    setEditingAliasSection(null);
                                    setAliasDraft("");
                                  }
                                },
                                style: {
                                  flex: 1,
                                  minWidth: 0,
                                  padding: "3px 6px",
                                  fontSize: "12px",
                                  border: "1.5px solid var(--color-accent-primary)",
                                  borderRadius: "4px",
                                  outline: "none",
                                  background: "white"
                                }
                              }
                            ),
                            /* @__PURE__ */ jsxRuntimeExports.jsx(
                              "button",
                              {
                                onClick: () => handleSaveHotkeyAlias(aliasKey),
                                disabled: aliasSaving,
                                title: "保存（留空恢复默认）",
                                style: {
                                  padding: "2px 6px",
                                  fontSize: "11px",
                                  background: "var(--color-accent-primary)",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "3px",
                                  cursor: aliasSaving ? "wait" : "pointer"
                                },
                                children: "✓"
                              }
                            ),
                            /* @__PURE__ */ jsxRuntimeExports.jsx(
                              "button",
                              {
                                onClick: () => {
                                  setEditingAliasSection(null);
                                  setAliasDraft("");
                                },
                                disabled: aliasSaving,
                                title: "取消",
                                style: {
                                  padding: "2px 6px",
                                  fontSize: "11px",
                                  background: "#eee",
                                  border: "none",
                                  borderRadius: "3px",
                                  cursor: "pointer"
                                },
                                children: "✕"
                              }
                            )
                          ] });
                        }
                        return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                          "div",
                          {
                            className: "hotkey-desc",
                            title: alias ? `原始名称：${base}
节:${hk.section}` : hk.section,
                            style: {
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              ...isMenu ? { fontWeight: "bold", color: "var(--color-accent-primary)" } : {}
                            },
                            children: [
                              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "hotkey-name", style: alias ? { fontStyle: "italic" } : void 0, children: label }),
                              /* @__PURE__ */ jsxRuntimeExports.jsx(
                                "button",
                                {
                                  onClick: (e) => {
                                    e.stopPropagation();
                                    setEditingAliasSection(aliasKey);
                                    setAliasDraft(alias || "");
                                  },
                                  title: "自定义此快捷键的显示名称（不会修改 Mod 本身）",
                                  style: {
                                    background: "transparent",
                                    border: "1px solid #ddd",
                                    borderRadius: "3px",
                                    padding: "1px 5px",
                                    fontSize: "10px",
                                    cursor: "pointer",
                                    opacity: 0.55,
                                    transition: "opacity 0.15s"
                                  },
                                  onMouseEnter: (e) => e.currentTarget.style.opacity = "1",
                                  onMouseLeave: (e) => e.currentTarget.style.opacity = "0.55",
                                  children: "✏️"
                                }
                              )
                            ]
                          }
                        );
                      })(),
                      editingHotkey?.index === index ? (
                        // Editing mode
                        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hotkey-edit-mode", style: { display: "flex", gap: "8px", alignItems: "center" }, children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                            "input",
                            {
                              type: "text",
                              className: "hotkey-capture-input",
                              placeholder: "按下新快捷键...",
                              value: capturedKey,
                              onKeyDown: handleKeyCapture,
                              readOnly: true,
                              autoFocus: true,
                              style: {
                                padding: "4px 8px",
                                border: "2px solid var(--color-accent-primary)",
                                borderRadius: "4px",
                                fontSize: "12px",
                                width: "120px",
                                background: "white",
                                textAlign: "center"
                              }
                            }
                          ),
                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                            "button",
                            {
                              onClick: saveHotkeyEdit,
                              disabled: !capturedKey,
                              style: {
                                padding: "4px 8px",
                                fontSize: "11px",
                                background: capturedKey ? "var(--color-accent-primary)" : "#ccc",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: capturedKey ? "pointer" : "not-allowed"
                              },
                              children: "✓"
                            }
                          ),
                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                            "button",
                            {
                              onClick: cancelHotkeyEdit,
                              style: {
                                padding: "4px 8px",
                                fontSize: "11px",
                                background: "#eee",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer"
                              },
                              children: "✕"
                            }
                          )
                        ] })
                      ) : (
                        // Display mode
                        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hotkey-keys", style: { display: "flex", alignItems: "center", gap: "8px" }, children: [
                          (hk.alternatives?.length ? hk.alternatives : [{ displayKeys: hk.keys || [] }]).map((alt, altIndex) => jsxRuntimeExports.jsxs("span", { className: "hotkey-alternative", children: [
                            altIndex > 0 && jsxRuntimeExports.jsx("span", { className: "hotkey-or", children: "或" }),
                            (alt.displayKeys || []).map((key, i) => jsxRuntimeExports.jsx("span", { className: "kbd-key", children: key }, i))
                          ] }, altIndex)),
                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                            "button",
                            {
                              onClick: () => startHotkeyEdit(index, hk, group.relativePath),
                              className: "hotkey-edit-btn",
                              title: "编辑此快捷键",
                              style: {
                                padding: "2px 6px",
                                fontSize: "10px",
                                background: "transparent",
                                border: "1px solid #ddd",
                                borderRadius: "3px",
                                cursor: "pointer",
                                opacity: 0.5,
                                transition: "opacity 0.2s"
                              },
                              onMouseEnter: (e) => e.target.style.opacity = 1,
                              onMouseLeave: (e) => e.target.style.opacity = 0.5,
                              children: "✏️"
                            }
                          )
                        ] })
                      )
                    ]
                  },
                  index
                ); })
                ] }, group.relativePath ?? groupIndex)) })
              ] }),
              devMode && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: "16px", padding: "12px", background: "rgba(245,158,11,0.06)", borderRadius: "8px", border: "1px solid rgba(245,158,11,0.2)" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: "11px", fontWeight: "700", color: "#f59e0b", marginBottom: "8px", letterSpacing: "0.05em", display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "DEV · TAGS" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      onClick: () => {
                        setShowTagManagerModal(true);
                        reloadServerTags();
                      },
                      style: { padding: "2px 8px", borderRadius: "4px", border: "1px solid rgba(245,158,11,0.4)", background: "transparent", color: "#f59e0b", cursor: "pointer", fontSize: "10px", fontWeight: "600" },
                      children: "管理 Tag 池"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "8px", minHeight: "24px" }, children: [
                  modTags.map((tag) => /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: {
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                    background: "#f59e0b",
                    color: "#fff",
                    borderRadius: "12px",
                    padding: "2px 8px",
                    fontSize: "11px",
                    fontWeight: "600"
                  }, children: [
                    tag,
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        onClick: () => setModTags((prev) => prev.filter((t) => t !== tag)),
                        style: { background: "none", border: "none", color: "#fff", cursor: "pointer", padding: "0", fontSize: "10px", lineHeight: 1 },
                        children: "✕"
                      }
                    )
                  ] }, tag)),
                  modTags.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: "11px", color: "#bbb" }, children: "暂无 tag" })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { position: "relative" }, children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: "4px" }, children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "input",
                      {
                        value: tagInput,
                        onChange: (e) => {
                          setTagInput(e.target.value);
                          setShowTagSuggestions(e.target.value.length > 0);
                        },
                        onKeyDown: (e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addTagFromInput();
                          }
                          if (e.key === "Escape") setShowTagSuggestions(false);
                        },
                        onFocus: () => setShowTagSuggestions(tagInput.length > 0),
                        placeholder: "输入 tag 后回车添加",
                        style: { flex: 1, padding: "5px 8px", borderRadius: "6px", border: "1px solid #e5e7eb", fontSize: "12px", outline: "none" }
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        onClick: handleAiSuggestTags,
                        disabled: aiTagLoading,
                        title: "AI 推荐 tag",
                        style: { padding: "5px 8px", borderRadius: "6px", border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", fontSize: "11px", flexShrink: 0 },
                        children: aiTagLoading ? "..." : "AI"
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        onClick: () => saveModTags(modTags),
                        disabled: tagSaving,
                        style: { padding: "5px 10px", borderRadius: "6px", border: "none", background: "#f59e0b", color: "#fff", cursor: "pointer", fontSize: "11px", flexShrink: 0 },
                        children: tagSaving ? "..." : "保存"
                      }
                    )
                  ] }),
                  showTagSuggestions && serverTags.filter((t) => t.name.includes(tagInput) && !modTags.includes(t.name)).length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: {
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    maxHeight: "120px",
                    overflowY: "auto",
                    marginTop: "2px"
                  }, children: serverTags.filter((t) => t.name.includes(tagInput) && !modTags.includes(t.name)).map((t) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    "div",
                    {
                      onClick: () => {
                        setModTags((prev) => [...prev, t.name]);
                        setTagInput("");
                        setShowTagSuggestions(false);
                      },
                      style: { padding: "6px 10px", cursor: "pointer", fontSize: "12px", borderBottom: "1px solid #f3f4f6" },
                      onMouseEnter: (e) => e.currentTarget.style.background = "#f9fafb",
                      onMouseLeave: (e) => e.currentTarget.style.background = "",
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: t.color || "#666", marginRight: "6px" } }),
                        t.name
                      ]
                    },
                    t.id
                  )) })
                ] })
              ] }),
              devMode && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: "8px", padding: "12px", background: "rgba(99,102,241,0.06)", borderRadius: "8px", border: "1px solid rgba(99,102,241,0.2)" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: "11px", fontWeight: "700", color: "#6366f1", marginBottom: "8px", letterSpacing: "0.05em", display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "DEV · AI 推荐" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: "4px" }, children: [
                    aiNameResult && /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        onClick: clearAiSuggestions,
                        style: { padding: "2px 8px", borderRadius: "4px", border: "1px solid #e5e7eb", background: "transparent", color: "#9ca3af", cursor: "pointer", fontSize: "10px", fontWeight: "600" },
                        children: "✕ 清除"
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        onClick: handleAiSuggestName,
                        disabled: aiNameLoading,
                        style: { padding: "2px 10px", borderRadius: "4px", border: "none", background: "#6366f1", color: "#fff", cursor: aiNameLoading ? "default" : "pointer", fontSize: "10px", fontWeight: "600", opacity: aiNameLoading ? 0.6 : 1 },
                        children: aiNameLoading ? "分析中..." : aiNameResult ? "🔄 重新推荐" : "🤖 AI 推荐"
                      }
                    )
                  ] })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: "12px", color: "#888", marginBottom: aiNameResult ? "8px" : 0 }, children: [
                  "当前名称: ",
                  /* @__PURE__ */ jsxRuntimeExports.jsx("code", { style: { color: "#6366f1", fontSize: "11px" }, children: selectedMod.name })
                ] }),
                aiNameResult && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                  aiNameResult.groups.map((g, gi) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginBottom: "6px" }, children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: "10px", color: "#8b5cf6", fontWeight: "600", marginBottom: "3px" }, children: g.label }),
                    g.items.map((item, ii) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
                      "div",
                      {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          marginBottom: "2px",
                          background: "#fff",
                          border: "1px solid #e5e7eb"
                        },
                        onMouseEnter: (e) => {
                          e.currentTarget.style.borderColor = "#6366f1";
                          e.currentTarget.style.background = "#eef2ff";
                        },
                        onMouseLeave: (e) => {
                          e.currentTarget.style.borderColor = "#e5e7eb";
                          e.currentTarget.style.background = "#fff";
                        },
                        children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontWeight: "500", color: "#1f2937", fontSize: "11px" }, children: item.fullName }),
                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                            "button",
                            {
                              onClick: () => applyAiName(item.fullName),
                              style: { padding: "2px 8px", borderRadius: "4px", border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", fontSize: "10px", fontWeight: "600", flexShrink: 0 },
                              children: "使用"
                            }
                          )
                        ]
                      },
                      ii
                    ))
                  ] }, gi)),
                  aiNameResult.tags?.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: "6px", paddingTop: "6px", borderTop: "1px solid rgba(99,102,241,0.15)" }, children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }, children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: "10px", color: "#8b5cf6", fontWeight: "600" }, children: "AI 推荐 Tag" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "button",
                        {
                          onClick: () => applyAiTags(aiNameResult.tags),
                          style: { padding: "2px 8px", borderRadius: "4px", border: "none", background: "#10b981", color: "#fff", cursor: "pointer", fontSize: "10px", fontWeight: "600" },
                          children: "全部添加"
                        }
                      )
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: "4px" }, children: aiNameResult.tags.map((tag, ti) => {
                      const alreadyAdded = modTags.includes(tag);
                      return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                        "span",
                        {
                          onClick: () => !alreadyAdded && applyAiTags([tag]),
                          style: {
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: "10px",
                            fontSize: "10px",
                            background: alreadyAdded ? "#d1fae5" : "#f3f4f6",
                            color: alreadyAdded ? "#059669" : "#374151",
                            cursor: alreadyAdded ? "default" : "pointer",
                            fontWeight: "500",
                            border: alreadyAdded ? "1px solid #a7f3d0" : "1px solid #e5e7eb"
                          },
                          children: [
                            alreadyAdded ? "✓ " : "",
                            tag
                          ]
                        },
                        ti
                      );
                    }) })
                  ] })
                ] }),
                aiNameLoading && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { textAlign: "center", padding: "12px", color: "#6b7280", fontSize: "12px" }, children: [
                  aiNameStage || "AI 分析中...",
                  " · ",
                  aiNameElapsedSeconds,
                  " 秒"
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-detail-actions", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    className: "btn btn-secondary",
                    onClick: (e) => handlePinMod(selectedMod.name, !selectedMod.pinned, e),
                    style: { flex: 1 },
                    children: selectedMod.pinned ? "📍 取消置顶" : "📌 置顶"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    className: "btn btn-secondary",
                    onClick: () => openModSourceFolder(selectedMod),
                    style: { flex: 1 },
                    children: isDx12PakMod(selectedMod) ? "📁 打开 MOD" : "📁 源文件"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    className: "btn btn-secondary",
                    onClick: () => handleFixMod(selectedMod),
                    disabled: fixRunning,
                    style: { flex: 1, color: "#f97316", borderColor: "#f97316" },
                    children: fixRunning ? "打开中..." : "🔧 修复器"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    className: "btn btn-danger",
                    onClick: (e) => confirmDelete(selectedMod.name, e),
                    style: { flex: 1 },
                    children: "🗑️ 删除"
                  }
                ),
                devMode && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      className: "btn",
                      onClick: () => onOpenPublishMod?.({
                        characterName,
                        modName: selectedMod.name,
                        modFolderPath: selectedMod.path,
                        gameId: activeGameId,
                        initialModMode: selectedMod.modType === "dx12-pak" ? "pak" : "d3d"
                      }),
                      style: { flex: "1 1 50%", background: "linear-gradient(135deg, #6366f1, #f59e0b)", color: "#fff", border: "none", fontWeight: 600 },
                      children: "📤 发布到市场"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      className: "btn",
                      onClick: async () => {
                        setToast({ type: "info", message: "正在导出加密 Mod..." });
                        try {
                          const res = await window.api.devExportEncryptedMod({
                            modPath: selectedMod.path,
                            characterName,
                            modName: selectedMod.name
                          });
                          if (res.canceled) return;
                          if (!res.success) throw new Error(res.error);
                          setToast({ type: "success", message: `已导出: ${(res.size / 1024 / 1024).toFixed(1)} MB` });
                        } catch (e) {
                          setToast({ type: "error", message: "导出失败: " + e.message });
                        }
                      },
                      style: { flex: "1 1 50%", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", border: "none", fontWeight: 600 },
                      children: "🔒 导出加密"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      className: "btn",
                      onClick: handleCopyDevModInfo,
                      disabled: devInfoBusy,
                      style: { flex: "1 1 50%", background: "linear-gradient(135deg, #ec4899, #8b5cf6)", color: "#fff", border: "none", fontWeight: 600, opacity: devInfoBusy ? 0.7 : 1 },
                      children: "📋 复制信息"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      className: "btn",
                      onClick: handleImportDevModInfo,
                      disabled: devInfoBusy,
                      style: { flex: "1 1 50%", background: "linear-gradient(135deg, #f472b6, #6366f1)", color: "#fff", border: "none", fontWeight: 600, opacity: devInfoBusy ? 0.7 : 1 },
                      children: "🖼️ 导入tag&图片"
                    }
                  )
                ] })
              ] })
            ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "var(--color-text-tertiary)" }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: "48px", opacity: 0.5 }, children: "👈" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { marginTop: "16px" }, children: "请选择左侧 Mod 查看详情" })
            ] })
          }
        ),
        toast && ReactDOM.createPortal(
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `toast toast-${toast.type}`, children: toast.message }),
          document.body
        ),
        showDeleteModal && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "modal-backdrop", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "modal-content", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-h2", style: { marginBottom: "16px", color: "var(--color-danger)" }, children: "⚠️ 确认删除" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-body", style: { marginBottom: "32px" }, children: [
            "确定要把模组 ",
            /* @__PURE__ */ jsxRuntimeExports.jsxs("strong", { children: [
              '"',
              modToDelete,
              '"'
            ] }),
            " 移入回收站吗？",
            /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
            "之后可在系统回收站中恢复。"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: "16px" }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                className: "btn btn-danger",
                onClick: handleDeleteMod,
                style: { flex: 1 },
                children: "移入回收站"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                className: "btn btn-secondary",
                onClick: () => setShowDeleteModal(false),
                style: { flex: 1 },
                children: "取消"
              }
            )
          ] })
        ] }) }),
        showScrollTop && ReactDOM.createPortal(
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              onClick: () => modsListRef.current && modsListRef.current.scrollTo({ top: 0, behavior: "smooth" }),
              style: {
                position: "fixed",
                bottom: "24px",
                right: "24px",
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: "var(--color-accent-gradient, linear-gradient(135deg, #ff9a9e, #fecfef))",
                color: "white",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(255,143,163,0.4)",
                fontSize: "18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 100,
                animation: "fadeIn 0.2s ease-out"
              },
              title: "回到顶部",
              children: "↑"
            }
          ),
          document.body
        ),
        showMarkPasswordModal && ReactDOM.createPortal(
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "modal-backdrop", onClick: () => setShowMarkPasswordModal(false), children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "modal-content", onClick: (e) => e.stopPropagation(), style: { maxWidth: "320px" }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontWeight: "700", fontSize: "16px", marginBottom: "16px" }, children: "🔒 输入密码以开启标记模式" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                type: "password",
                autoFocus: true,
                value: markPasswordInput,
                onChange: (e) => {
                  setMarkPasswordInput(e.target.value);
                  setMarkPasswordError("");
                },
                onKeyDown: (e) => {
                  if (e.key === "Enter") handleMarkPasswordSubmit();
                  if (e.key === "Escape") setShowMarkPasswordModal(false);
                },
                placeholder: "密码",
                style: {
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  boxSizing: "border-box",
                  border: markPasswordError ? "1.5px solid #e74c3c" : "1.5px solid #ddd",
                  fontSize: "14px",
                  outline: "none",
                  marginBottom: "8px"
                }
              }
            ),
            markPasswordError && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#e74c3c", fontSize: "12px", marginBottom: "8px" }, children: markPasswordError }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: "10px", marginTop: "8px" }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn btn-primary", onClick: handleMarkPasswordSubmit, style: { flex: 1 }, children: "确认" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn btn-secondary", onClick: () => setShowMarkPasswordModal(false), style: { flex: 1 }, children: "取消" })
            ] })
          ] }) }),
          document.body
        ),
        markModeUnlocked && ReactDOM.createPortal(
          /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "button",
              {
                onClick: () => setShowMarkToolbar((v) => !v),
                title: "标记模式工具栏",
                style: {
                  position: "fixed",
                  bottom: "80px",
                  right: "24px",
                  zIndex: 100,
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  background: Object.keys(markedMods).length > 0 ? "#f59e0b" : "#e5e7eb",
                  color: Object.keys(markedMods).length > 0 ? "#fff" : "#6b7280",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "18px",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.2s"
                },
                children: [
                  "🔖",
                  Object.keys(markedMods).length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: {
                    position: "absolute",
                    top: "-4px",
                    right: "-4px",
                    background: "#ef4444",
                    color: "#fff",
                    borderRadius: "50%",
                    width: "18px",
                    height: "18px",
                    fontSize: "10px",
                    fontWeight: "700",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }, children: Object.keys(markedMods).length })
                ]
              }
            ),
            showMarkToolbar && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "div",
                {
                  style: { position: "fixed", inset: 0, zIndex: 98 },
                  onClick: () => setShowMarkToolbar(false)
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: {
                position: "fixed",
                bottom: "132px",
                right: "24px",
                background: "white",
                borderRadius: "14px",
                padding: "14px 16px",
                boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
                border: "1px solid rgba(0,0,0,0.06)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                zIndex: 99,
                minWidth: "200px",
                animation: "fadeIn 0.15s ease-out"
              }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: "12px", fontWeight: "700", color: "#888", marginBottom: "2px" }, children: [
                  "🔖 标记模式 · ",
                  Object.keys(markedMods).length,
                  " 个"
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: "6px", alignItems: "center" }, children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "div",
                    {
                      title: markDestFolder || "未选择",
                      style: {
                        flex: 1,
                        fontSize: "11px",
                        color: markDestFolder ? "#555" : "#bbb",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        background: "#f5f5f5",
                        borderRadius: "6px",
                        padding: "5px 8px",
                        cursor: "default"
                      },
                      children: markDestFolder ? markDestFolder.split(/[\\/]/).pop() : "未选择目标文件夹"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      onClick: handleSelectDestFolder,
                      title: "选择目标文件夹",
                      style: {
                        background: "#f0f0f0",
                        border: "none",
                        borderRadius: "6px",
                        padding: "5px 8px",
                        cursor: "pointer",
                        fontSize: "13px",
                        flexShrink: 0
                      },
                      children: "📁"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    className: "btn btn-primary",
                    onClick: handleMoveMarkedMods,
                    disabled: markMoving || !markDestFolder || Object.keys(markedMods).length === 0,
                    style: { fontSize: "12px", padding: "7px 10px" },
                    children: markMoving ? "移动中..." : "移动到目标文件夹"
                  }
                ),
                markMoveRecord?.moves?.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  "button",
                  {
                    className: "btn btn-secondary",
                    onClick: handleRestoreMarkedMods,
                    disabled: markMoving,
                    style: { fontSize: "12px", padding: "7px 10px" },
                    children: [
                      "↩ 移回原位 (",
                      markMoveRecord.moves.length,
                      " 个)"
                    ]
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { height: "1px", background: "#f0f0f0", margin: "2px 0" } }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    className: "btn btn-secondary",
                    onClick: handleClearAllMarks,
                    style: { fontSize: "12px", padding: "6px 10px" },
                    children: "清除所有标记"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    onClick: () => {
                      setMarkModeUnlocked(false);
                      setShowMarkToolbar(false);
                    },
                    style: { background: "none", border: "none", cursor: "pointer", fontSize: "11px", color: "#bbb", padding: "2px 0" },
                    children: "关闭标记模式"
                  }
                )
              ] })
            ] })
          ] }),
          document.body
        ),
        modContextMenu && ReactDOM.createPortal(
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mod-context-backdrop", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              className: "mod-context-menu",
              style: { left: modContextMenu.x, top: modContextMenu.y },
              onClick: (e) => e.stopPropagation(),
              onContextMenu: (e) => {
                e.preventDefault();
                e.stopPropagation();
              },
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    onClick: () => {
                      setModContextMenu(null);
                      handlePinMod(modContextMenu.mod.name, !modContextMenu.mod.pinned);
                    },
                    style: { display: "block", width: "100%", padding: "9px 14px", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#374151" },
                    onMouseEnter: (e) => e.currentTarget.style.background = "#f9fafb",
                    onMouseLeave: (e) => e.currentTarget.style.background = "none",
                    children: modContextMenu.mod.pinned ? "📍 取消置顶" : "📌 置顶"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    onClick: () => {
                      const mod = modContextMenu.mod;
                      setModContextMenu(null);
                      openModSourceFolder(mod);
                    },
                    style: { display: "block", width: "100%", padding: "9px 14px", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#374151" },
                    onMouseEnter: (e) => e.currentTarget.style.background = "#f9fafb",
                    onMouseLeave: (e) => e.currentTarget.style.background = "none",
                    children: isDx12PakMod(modContextMenu.mod) ? "📁 打开 MOD" : "📁 打开源文件夹"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    onClick: () => handleRequestMoveMod(modContextMenu.mod),
                    style: { display: "block", width: "100%", padding: "9px 14px", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#2563eb", fontWeight: "600" },
                    onMouseEnter: (e) => e.currentTarget.style.background = "#eff6ff",
                    onMouseLeave: (e) => e.currentTarget.style.background = "none",
                    children: "📦 移动"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { height: "1px", background: "#f3f4f6", margin: "2px 0" } }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    onClick: () => handleFixMod(modContextMenu.mod, "external"),
                    disabled: fixRunning,
                    style: { display: "block", width: "100%", padding: "9px 14px", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#f97316", fontWeight: "600" },
                    onMouseEnter: (e) => e.currentTarget.style.background = "#fff7ed",
                    onMouseLeave: (e) => e.currentTarget.style.background = "none",
                    children: "🔧 修复器"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "qaqm-context-submenu-wrap", onMouseEnter: () => loadModIniBackups(modContextMenu.mod.name), children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    "button",
                    {
                      style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", width: "100%", padding: "9px 14px", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#7c3aed", fontWeight: "600" },
                      onClick: () => loadModIniBackups(modContextMenu.mod.name),
                      onMouseEnter: (e) => e.currentTarget.style.background = "#f5f3ff",
                      onMouseLeave: (e) => e.currentTarget.style.background = "none",
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "↩️ 回滚修复备份" }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: "16px", lineHeight: 1 }, children: "›" })
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "qaqm-context-submenu", children: iniRollbackBackups.modName !== modContextMenu.mod.name || iniRollbackBackups.loading ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "qaqm-context-submenu-empty", children: "读取备份中..." }) : iniRollbackBackups.error ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "qaqm-context-submenu-empty is-error", children: iniRollbackBackups.error }) : iniRollbackBackups.items.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "qaqm-context-submenu-empty", children: "暂无可回滚备份" }) : iniRollbackBackups.items.map((backup) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    "button",
                    {
                      className: "qaqm-context-submenu-item",
                      onClick: () => requestRollbackModIni(modContextMenu.mod, backup),
                      title: `${backup.label} · ${backup.fileCount || 0} 个文件`,
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "qaqm-context-submenu-title", children: backup.label || backup.stamp }),
                        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "qaqm-context-submenu-meta", children: [
                          backup.fileCount || 0,
                          " 个文件"
                        ] })
                      ]
                    },
                    backup.stamp
                  )) })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    onClick: async () => {
                      const mod = modContextMenu.mod;
                      setModContextMenu(null);
                      try {
                        const r = await window.api.resetModIni(characterName, mod.name);
                        if (r?.success) setToast({ type: "success", message: `✅ 已重置 ${mod.name} ini（还原 ${r.restoredCount} 个文件）` });
                        else setToast({ type: "error", message: r?.error || "重置失败" });
                      } catch (e) {
                        setToast({ type: "error", message: "重置失败: " + e.message });
                      }
                    },
                    style: { display: "block", width: "100%", padding: "9px 14px", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#8b5cf6", fontWeight: "600" },
                    onMouseEnter: (e) => e.currentTarget.style.background = "#faf5ff",
                    onMouseLeave: (e) => e.currentTarget.style.background = "none",
                    children: "🔄 重置 Mod ini"
                  }
                )
              ]
            }
          ) }),
          document.body
        ),
        iniRollbackConfirm && ReactDOM.createPortal(
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              style: { position: "fixed", inset: 0, zIndex: 10012, background: "rgba(15, 23, 42, 0.48)", display: "flex", alignItems: "center", justifyContent: "center" },
              onClick: () => setIniRollbackConfirm(null),
              children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "div",
                {
                  style: { background: "#fff", borderRadius: "14px", padding: "24px", width: "390px", maxWidth: "92vw", boxShadow: "0 18px 50px rgba(0,0,0,0.28)", border: "1px solid #e5e7eb" },
                  onClick: (e) => e.stopPropagation(),
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: "20px", marginBottom: "10px" }, children: "↩️" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontWeight: 800, fontSize: "16px", color: "#1f2937", marginBottom: "10px" }, children: [
                      "回滚 ",
                      iniRollbackConfirm.mod?.name,
                      " 的修复备份？"
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: "13px", color: "#4b5563", lineHeight: 1.7, marginBottom: "16px" }, children: [
                      "将使用 ",
                      /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: iniRollbackConfirm.backup?.label || iniRollbackConfirm.backup?.stamp }),
                      " 的备份覆盖当前修复文件， 共 ",
                      iniRollbackConfirm.backup?.fileCount || 0,
                      " 个文件。回滚成功后，这次备份记录会一并删除。"
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: "10px", justifyContent: "flex-end" }, children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "button",
                        {
                          onClick: () => setIniRollbackConfirm(null),
                          style: { padding: "8px 16px", borderRadius: "8px", border: "1px solid #e5e7eb", background: "transparent", color: "#374151", cursor: "pointer" },
                          children: "取消"
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "button",
                        {
                          onClick: confirmRollbackModIni,
                          style: { padding: "8px 18px", borderRadius: "8px", border: "none", background: "#7c3aed", color: "#fff", cursor: "pointer", fontWeight: 700 },
                          children: "确认回滚"
                        }
                      )
                    ] })
                  ]
                }
              )
            }
          ),
          document.body
        ),
        showAiTagModal && ReactDOM.createPortal(
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              style: { position: "fixed", inset: 0, zIndex: 10001, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" },
              onClick: () => setShowAiTagModal(false),
              children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "div",
                {
                  style: { background: "#fff", borderRadius: "12px", padding: "24px", minWidth: "320px", maxWidth: "420px", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" },
                  onClick: (e) => e.stopPropagation(),
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontWeight: "700", fontSize: "15px", marginBottom: "12px", color: "#1f2937" }, children: "AI Tag 推荐" }),
                    aiTagLoading ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { textAlign: "center", padding: "24px", color: "#6b7280" }, children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontWeight: 600, color: "#4b5563" }, children: aiTagStage || "AI 分析中..." }),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: "8px", fontSize: "12px", color: "#9ca3af" }, children: [
                        "已等待 ",
                        aiTagElapsedSeconds,
                        " 秒，最长约 60 秒"
                      ] }),
                      aiTagElapsedSeconds >= 20 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { marginTop: "8px", fontSize: "12px", color: "#d97706" }, children: "服务响应较慢，仍在等待..." })
                    ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" }, children: [
                        aiTagSuggestions.map((s, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "span",
                          {
                            onClick: () => setAiTagSuggestions((prev) => prev.map((x, j) => j === i ? { ...x, selected: !x.selected } : x)),
                            style: {
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "4px 10px",
                              borderRadius: "12px",
                              fontSize: "12px",
                              cursor: "pointer",
                              background: s.selected ? "#6366f1" : "#f3f4f6",
                              color: s.selected ? "#fff" : "#374151",
                              border: "1.5px solid transparent",
                              fontWeight: s.selected ? "600" : "400"
                            },
                            children: s.name
                          },
                          i
                        )),
                        aiTagSuggestions.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: aiTagEmptyReason.startsWith("推荐失败") ? "#dc2626" : "#6b7280", fontSize: "13px", lineHeight: 1.6, userSelect: "text" }, children: aiTagEmptyReason || "AI 没有返回可用的 Tag。" })
                      ] }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: "11px", color: "#9ca3af", marginBottom: "12px" }, children: "点击选中/取消，AI 只会保留 tag 池中已有的 tag" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: "8px", justifyContent: "flex-end" }, children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "button",
                          {
                            onClick: () => setShowAiTagModal(false),
                            style: { padding: "6px 16px", borderRadius: "6px", border: "1px solid #e5e7eb", background: "transparent", cursor: "pointer", fontSize: "13px" },
                            children: "取消"
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "button",
                          {
                            onClick: aiTagSuggestions.length > 0 ? applyAiSuggestions : handleAiSuggestTags,
                            style: { padding: "6px 16px", borderRadius: "6px", border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: "600" },
                            children: aiTagSuggestions.length > 0 ? "添加选中" : "重新推荐"
                          }
                        )
                      ] })
                    ] })
                  ]
                }
              )
            }
          ),
          document.body
        ),
        showAiNameModal && !aiNameModalMinimized && ReactDOM.createPortal(
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              style: { position: "fixed", inset: 0, zIndex: 10001, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" },
              onClick: aiNameLoading ? minimizeAiNameModal : closeAiNameTask,
              children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "div",
                {
                  style: { background: "#fff", borderRadius: "12px", padding: "24px", minWidth: "400px", maxWidth: "540px", boxShadow: "0 8px 32px rgba(0,0,0,0.3)", maxHeight: "80vh", overflowY: "auto" },
                  onClick: (e) => e.stopPropagation(),
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "4px" }, children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontWeight: "700", fontSize: "15px", color: "#1f2937" }, children: "🤖 AI 命名 + Tag 推荐" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "button",
                        {
                          onClick: aiNameLoading ? minimizeAiNameModal : closeAiNameTask,
                          style: { border: "none", background: "transparent", color: "#9ca3af", cursor: "pointer", fontSize: "16px", lineHeight: 1 },
                          children: aiNameLoading ? "—" : "✕"
                        }
                      )
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: "12px", color: "#9ca3af", marginBottom: "16px" }, children: [
                      "当前: ",
                      /* @__PURE__ */ jsxRuntimeExports.jsx("code", { style: { color: "#6366f1" }, children: aiNameTaskTarget?.modName || selectedMod?.name })
                    ] }),
                    aiNameLoading ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { textAlign: "center", padding: "24px", color: "#6b7280" }, children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { marginBottom: "8px", fontWeight: 600 }, children: aiNameStage || "AI 分析中..." }),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginBottom: "12px", fontSize: "12px", color: "#9ca3af" }, children: [
                        "已等待 ",
                        aiNameElapsedSeconds,
                        " 秒，最长约 60 秒"
                      ] }),
                      aiNameElapsedSeconds >= 20 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { marginBottom: "12px", fontSize: "12px", color: "#d97706" }, children: "服务响应较慢，仍在等待..." }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "button",
                        {
                          onClick: minimizeAiNameModal,
                          style: { padding: "7px 16px", borderRadius: "8px", border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontSize: "13px", color: "#6b7280" },
                          children: "最小化到后台"
                        }
                      )
                    ] }) : aiNameTaskError ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { color: "#ef4444", fontSize: "13px", textAlign: "center", padding: "12px", userSelect: "text" }, children: [
                      "推荐失败：",
                      aiNameTaskError
                    ] }) : aiNameTaskResult || aiNameResult ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                      (aiNameTaskResult || aiNameResult).groups.map((g, gi) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginBottom: "12px" }, children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: "12px", color: "#8b5cf6", fontWeight: "700", marginBottom: "6px" }, children: g.label }),
                        g.items.map((item, ii) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
                          "div",
                          {
                            style: {
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "8px 12px",
                              borderRadius: "8px",
                              fontSize: "13px",
                              marginBottom: "4px",
                              background: "#f9fafb",
                              border: "1px solid #e5e7eb",
                              transition: "all 0.15s"
                            },
                            onMouseEnter: (e) => {
                              e.currentTarget.style.background = "#eef2ff";
                              e.currentTarget.style.borderColor = "#6366f1";
                            },
                            onMouseLeave: (e) => {
                              e.currentTarget.style.background = "#f9fafb";
                              e.currentTarget.style.borderColor = "#e5e7eb";
                            },
                            children: [
                              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontWeight: "500", color: "#1f2937" }, children: item.fullName }),
                              /* @__PURE__ */ jsxRuntimeExports.jsx(
                                "button",
                                {
                                  onClick: () => applyAiName(item.fullName, aiNameTaskTarget),
                                  style: { padding: "4px 12px", borderRadius: "6px", border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", fontSize: "11px", fontWeight: "600", flexShrink: 0 },
                                  children: "使用"
                                }
                              )
                            ]
                          },
                          ii
                        ))
                      ] }, gi)),
                      (aiNameTaskResult || aiNameResult).tags?.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: "8px", paddingTop: "12px", borderTop: "1px solid #e5e7eb" }, children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }, children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: "12px", color: "#8b5cf6", fontWeight: "700" }, children: "AI 推荐 Tag" }),
                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                            "button",
                            {
                              onClick: () => applyAiTags((aiNameTaskResult || aiNameResult).tags, aiNameTaskTarget),
                              style: { padding: "4px 10px", borderRadius: "6px", border: "none", background: "#10b981", color: "#fff", cursor: "pointer", fontSize: "11px", fontWeight: "600" },
                              children: "全部添加"
                            }
                          )
                        ] }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px" }, children: (aiNameTaskResult || aiNameResult).tags.map((tag, ti) => {
                          const alreadyAdded = modTags.includes(tag);
                          return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                            "span",
                            {
                              onClick: () => !alreadyAdded && applyAiTags([tag], aiNameTaskTarget),
                              style: {
                                display: "inline-block",
                                padding: "4px 10px",
                                borderRadius: "12px",
                                fontSize: "12px",
                                background: alreadyAdded ? "#d1fae5" : "#f3f4f6",
                                color: alreadyAdded ? "#059669" : "#374151",
                                cursor: alreadyAdded ? "default" : "pointer",
                                fontWeight: "500",
                                border: alreadyAdded ? "1px solid #a7f3d0" : "1px solid #e5e7eb"
                              },
                              children: [
                                alreadyAdded ? "✓ " : "",
                                tag
                              ]
                            },
                            ti
                          );
                        }) })
                      ] }),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "16px" }, children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "button",
                          {
                            onClick: closeAiNameTask,
                            style: { padding: "6px 16px", borderRadius: "6px", border: "1px solid #e5e7eb", background: "transparent", cursor: "pointer", fontSize: "13px" },
                            children: "关闭"
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "button",
                          {
                            onClick: handleAiSuggestName,
                            disabled: aiNameLoading,
                            style: { padding: "6px 16px", borderRadius: "6px", border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: "600", opacity: aiNameLoading ? 0.6 : 1 },
                            children: "🔄 重新推荐"
                          }
                        )
                      ] })
                    ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#9ca3af", fontSize: "13px", textAlign: "center", padding: "12px" }, children: "无推荐结果" })
                  ]
                }
              )
            }
          ),
          document.body
        ),
        aiNameTaskTarget && aiNameModalMinimized && ReactDOM.createPortal(
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { position: "fixed", right: "16px", bottom: "112px", zIndex: 10004, display: "flex", justifyContent: "flex-end", pointerEvents: "none" }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { width: "284px", borderRadius: "16px", background: "rgba(17,24,39,0.96)", color: "#fff", boxShadow: "0 16px 40px rgba(0,0,0,0.28)", overflow: "hidden", border: `1px solid ${aiNameTaskError ? "#ef4444" : aiNameLoading ? "#8b5cf6" : "#22c55e"}`, pointerEvents: "auto" }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { onClick: expandAiNameModal, style: { width: "100%", padding: "12px 14px", border: "none", background: "transparent", color: "#fff", cursor: "pointer", textAlign: "left", display: "flex", gap: "10px", alignItems: "center" }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { width: "34px", height: "34px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, #6366f1, ${aiNameTaskError ? "#ef4444" : aiNameLoading ? "#8b5cf6" : "#22c55e"})`, flexShrink: 0 }, children: aiNameLoading ? "🤖" : aiNameTaskError ? "⚠️" : "✅" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { flex: 1, minWidth: 0 }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { display: "block", fontSize: "13px", fontWeight: 800 }, children: aiNameLoading ? "AI 推荐后台运行中" : aiNameTaskError ? "AI 推荐失败" : "AI 推荐完成" }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { display: "block", fontSize: "11px", color: "#d1d5db", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: [
                  aiNameTaskTarget.characterName,
                  " · ",
                  aiNameTaskTarget.modName
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: "11px", color: "#fbbf24", flexShrink: 0 }, children: "展开" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { padding: "0 14px 12px" }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { height: "5px", borderRadius: "999px", background: "rgba(255,255,255,0.16)", overflow: "hidden", marginBottom: "8px" }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { width: aiNameLoading ? "56%" : aiNameTaskError ? "100%" : "100%", height: "100%", borderRadius: "999px", background: `linear-gradient(90deg, #6366f1, ${aiNameTaskError ? "#ef4444" : aiNameLoading ? "#8b5cf6" : "#22c55e"})`, transition: "width 0.3s ease" } }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { flex: 1, minWidth: 0, color: "#d1d5db", fontSize: "11px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: aiNameLoading ? `${aiNameStage || "AI 分析中"} · ${aiNameElapsedSeconds} 秒` : aiNameTaskError || "点击展开查看建议" }),
                !aiNameLoading && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: closeAiNameTask, title: "关闭悬浮进度", style: { flexShrink: 0, width: "22px", height: "22px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.22)", background: "transparent", color: "#d1d5db", cursor: "pointer", lineHeight: 1 }, children: "✕" })
              ] })
            ] })
          ] }) }),
          document.body
        ),
        showImageLightbox && previewImage && ReactDOM.createPortal(
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: {
            position: "fixed",
            inset: 0,
            zIndex: 10003,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "zoom-out"
          }, onClick: () => setShowImageLightbox(false), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "img",
              {
                src: previewImage,
                alt: "Preview",
                style: {
                  maxWidth: "90vw",
                  maxHeight: "90vh",
                  objectFit: "contain",
                  borderRadius: "8px",
                  boxShadow: "0 0 60px rgba(0,0,0,0.5)"
                },
                onClick: (e) => e.stopPropagation()
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                onClick: () => setShowImageLightbox(false),
                style: {
                  position: "absolute",
                  top: "20px",
                  right: "20px",
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  border: "none",
                  background: "rgba(255,255,255,0.15)",
                  color: "#fff",
                  fontSize: "18px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backdropFilter: "blur(4px)"
                },
                children: "✕"
              }
            )
          ] }),
          document.body
        ),
        showTagManagerModal && ReactDOM.createPortal(
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              style: { position: "fixed", inset: 0, zIndex: 10002, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" },
              onClick: () => setShowTagManagerModal(false),
              children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "div",
                {
                  style: { background: "#fff", borderRadius: "14px", padding: "24px", width: "480px", maxWidth: "95vw", maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 12px 40px rgba(0,0,0,0.35)" },
                  onClick: (e) => e.stopPropagation(),
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontWeight: "700", fontSize: "16px", color: "#1f2937", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Tag 池管理" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", alignItems: "center", gap: "8px" }, children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "button",
                          {
                            onClick: () => reloadServerTags({ force: true }),
                            disabled: tagManagerLoading,
                            title: "刷新 tag 列表",
                            style: { background: "none", border: "1px solid #e5e7eb", borderRadius: "6px", cursor: "pointer", fontSize: "13px", color: "#6b7280", padding: "3px 8px", lineHeight: 1 },
                            children: "🔄"
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => setShowTagManagerModal(false), style: { background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "#9ca3af", lineHeight: 1 }, children: "✕" })
                      ] })
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginBottom: "14px", display: "flex", gap: "6px", alignItems: "center" }, children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: "11px", color: "#6b7280", flexShrink: 0 }, children: "Admin Key:" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "input",
                        {
                          type: "password",
                          value: tagManagerAdminKey,
                          onChange: (e) => {
                            setTagManagerAdminKey(e.target.value);
                            localStorage.setItem("qaqm-dev-admin-key", e.target.value);
                          },
                          placeholder: "输入服务端 admin key",
                          style: { flex: 1, padding: "4px 8px", borderRadius: "6px", border: "1px solid #e5e7eb", fontSize: "12px", outline: "none" }
                        }
                      )
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: "6px", marginBottom: "14px", alignItems: "center" }, children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "input",
                        {
                          value: newTagName,
                          onChange: (e) => setNewTagName(e.target.value),
                          onKeyDown: (e) => {
                            if (e.key === "Enter") handleCreateTag();
                          },
                          placeholder: "新 tag 名称",
                          style: { flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid #e5e7eb", fontSize: "13px", outline: "none" }
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "input",
                        {
                          type: "color",
                          value: newTagColor,
                          onChange: (e) => setNewTagColor(e.target.value),
                          title: "选择颜色",
                          style: { width: "36px", height: "32px", padding: "2px", borderRadius: "6px", border: "1px solid #e5e7eb", cursor: "pointer" }
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "button",
                        {
                          onClick: handleCreateTag,
                          disabled: tagManagerLoading || !newTagName.trim(),
                          style: { padding: "6px 14px", borderRadius: "6px", border: "none", background: "#f59e0b", color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: "600", flexShrink: 0 },
                          children: "+ 添加"
                        }
                      )
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }, children: [
                      serverTags.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#9ca3af", fontSize: "13px", textAlign: "center", padding: "24px" }, children: "暂无 tag，请先添加" }),
                      serverTags.map((tag) => /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", borderRadius: "8px", background: "#f9fafb", border: "1px solid #f3f4f6" }, children: editingTagId === tag.id ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "input",
                          {
                            value: editingTagName,
                            onChange: (e) => setEditingTagName(e.target.value),
                            onKeyDown: (e) => {
                              if (e.key === "Enter") handleUpdateTag(tag.id);
                              if (e.key === "Escape") setEditingTagId(null);
                            },
                            style: { flex: 1, padding: "3px 7px", borderRadius: "5px", border: "1px solid #d1d5db", fontSize: "13px", outline: "none" },
                            autoFocus: true
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "input",
                          {
                            type: "color",
                            value: editingTagColor,
                            onChange: (e) => setEditingTagColor(e.target.value),
                            style: { width: "30px", height: "26px", padding: "1px", borderRadius: "4px", border: "1px solid #e5e7eb", cursor: "pointer" }
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "button",
                          {
                            onClick: () => handleUpdateTag(tag.id),
                            disabled: tagManagerLoading,
                            style: { padding: "3px 10px", borderRadius: "5px", border: "none", background: "#10b981", color: "#fff", cursor: "pointer", fontSize: "12px" },
                            children: "保存"
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "button",
                          {
                            onClick: () => setEditingTagId(null),
                            style: { padding: "3px 8px", borderRadius: "5px", border: "1px solid #e5e7eb", background: "transparent", cursor: "pointer", fontSize: "12px" },
                            children: "取消"
                          }
                        )
                      ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", background: tag.color || "#666", flexShrink: 0 } }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { flex: 1, fontSize: "13px", color: "#374151", fontWeight: "500" }, children: tag.name }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: "11px", color: "#9ca3af" }, children: tag.color || "#666" }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "button",
                          {
                            onClick: () => {
                              setEditingTagId(tag.id);
                              setEditingTagName(tag.name);
                              setEditingTagColor(tag.color || "#666666");
                            },
                            style: { padding: "3px 8px", borderRadius: "5px", border: "1px solid #e5e7eb", background: "transparent", cursor: "pointer", fontSize: "12px", color: "#6b7280" },
                            children: "编辑"
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "button",
                          {
                            onClick: () => handleDeleteTag(tag.id),
                            disabled: tagManagerLoading,
                            style: { padding: "3px 8px", borderRadius: "5px", border: "none", background: "#fee2e2", color: "#ef4444", cursor: "pointer", fontSize: "12px" },
                            children: "删除"
                          }
                        )
                      ] }) }, tag.id))
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { marginTop: "14px", display: "flex", justifyContent: "flex-end" }, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        onClick: () => setShowTagManagerModal(false),
                        style: { padding: "7px 20px", borderRadius: "7px", border: "1px solid #e5e7eb", background: "transparent", cursor: "pointer", fontSize: "13px" },
                        children: "关闭"
                      }
                    ) })
                  ]
                }
              )
            }
          ),
          document.body
        )
      ]
    }
  );
}
export {
  ModView as default
};
