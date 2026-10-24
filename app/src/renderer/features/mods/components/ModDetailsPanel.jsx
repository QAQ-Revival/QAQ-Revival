import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ModPersistSummary from "./ModPersistSummary.jsx";
import { getModAppearanceSectionId, previewAspectRatioCache, getPreviewAspectRatioStyle, dataTransferIncludesImage } from "../model/modHelpers.js";
import { getSectionId, getSectionName } from "../model/appearanceSections.js";
import { LocalCollectionVariantStrip } from "./LocalCollectionVariants.jsx";
export function ModDetailsPanel({
  viewMode,
  selectedMod,
  detailCollapsed,
  visibleDetailWidth,
  isRenamingMod,
  renameModDraft,
  setRenameModDraft,
  handleSaveModRename,
  setIsRenamingMod,
  renameModSaving,
  previewImage,
  isDragging,
  previewImageAspectRatio,
  setIsDragging,
  characterName,
  setImageKey,
  setPreviewImage,
  loadModDetails,
  setToast,
  setShowImageLightbox,
  setPreviewImageAspectRatio,
  imageKey,
  handleAssignSelectedModAppearanceSection,
  appearanceSectionBusy,
  appearanceSectionsWithStats,
  selectedLocalCollection,
  selectLocalCollectionVariant,
  selectedTagFilters,
  toggleTagFilter,
  activeGameId,
  isEditingNotes,
  setNotesDraft,
  setIsEditingNotes,
  notesDraft,
  notesSaving,
  handleSaveModNotes,
  isRefreshingHotkeys,
  hotkeyGroups,
  editingAliasSection,
  aliasDraft,
  setAliasDraft,
  handleSaveHotkeyAlias,
  setEditingAliasSection,
  aliasSaving,
  editingHotkey,
  capturedKey,
  handleKeyCapture,
  saveHotkeyEdit,
  cancelHotkeyEdit,
  startHotkeyEdit,
  devMode,
  setShowTagManagerModal,
  reloadServerTags,
  modTags,
  setModTags,
  tagInput,
  setTagInput,
  setShowTagSuggestions,
  addTagFromInput,
  handleAiSuggestTags,
  aiTagLoading,
  saveModTags,
  tagSaving,
  showTagSuggestions,
  serverTags,
  aiNameResult,
  clearAiSuggestions,
  handleAiSuggestName,
  aiNameLoading,
  applyAiName,
  applyAiTags,
  aiNameStage,
  aiNameElapsedSeconds,
  handlePinMod,
  openModSourceFolder,
  isDx12PakMod,
  handleFixMod,
  fixRunning,
  confirmDelete,
  onOpenPublishMod,
  handleCopyDevModInfo,
  devInfoBusy,
  handleImportDevModInfo
}) {
  return <div id="mod-detail-panel" className={`mod-detail-panel ${viewMode === "gallery" ? "gallery-mode" : ""} ${!selectedMod || detailCollapsed ? "collapsed" : ""}`} aria-hidden={!selectedMod || detailCollapsed} inert={!selectedMod || detailCollapsed ? "" : void 0} style={{
    "--mod-detail-width": selectedMod && !detailCollapsed ? `${visibleDetailWidth}px` : "0px"
  }}>
      {selectedMod ? <div className="card mod-detail-card">
          <header className="mod-detail-header">
            <div className="mod-detail-eyebrow">
              <span>{t("mods.details.title")}</span>
              <span className={`mod-status-badge ${selectedMod.enabled ? "is-enabled" : ""}`}>
                {selectedMod.enabled ? t("common.status.enabled") : t("common.status.disabled")}
              </span>
            </div>
            {isRenamingMod ? <div className="mod-detail-rename">
                <input type="text" value={renameModDraft} autoFocus={true} onChange={e => setRenameModDraft(e.target.value)} onKeyDown={e => {
            if (e.key === "Enter") handleSaveModRename();else if (e.key === "Escape") setIsRenamingMod(false);
          }} className="input mod-details-panel-input-layout" />
                <button className="btn btn-primary mod-details-panel-btn-layout" disabled={renameModSaving} onClick={handleSaveModRename}>
                  {renameModSaving ? t("common.status.saving") : t("common.actions.save")}
                </button>
                <button className="btn btn-secondary mod-details-panel-btn-layout" disabled={renameModSaving} onClick={() => setIsRenamingMod(false)}>
                  {t("common.actions.cancel")}
                </button>
              </div> : <div className="mod-detail-heading">
                <span className="mod-details-panel-content">
                  {selectedMod.name}
                </span>
                {selectedMod.pinned && <span title={t("mods.status.pinned")} className="mod-details-panel-pinned-badge">
                    {"📌"}
                  </span>}
                <button onClick={() => {
            setRenameModDraft(selectedMod.name);
            setIsRenamingMod(true);
          }} title={t("mods.actions.rename")} onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0.8"} className="mod-details-panel-action">
                  {t("common.actions.rename")}
                </button>
              </div>}
          </header>
          <div className={`image-drop-zone mod-detail-preview ${previewImage ? "has-image" : "is-empty"} ${isDragging ? "dragging" : ""} `} style={{
        aspectRatio: previewImage ? getPreviewAspectRatioStyle(previewImageAspectRatio) : void 0,
        minHeight: previewImage ? "180px" : "128px",
        maxHeight: previewImage ? "min(42vh, 420px)" : void 0
      }} onDragOver={e => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(dataTransferIncludesImage(e.dataTransfer));
      }} onDragLeave={e => {
        e.preventDefault();
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setIsDragging(false);
        }
      }} onDrop={async e => {
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
              if (result.previewUrl) setPreviewImage(result.previewUrl);else loadModDetails(selectedMod.name);
              setToast({
                type: "success",
                message: t("mods.preview.updated")
              });
            }
          } else {
            setToast({
              type: "error",
              message: t("mods.preview.imageRequired")
            });
          }
        }
      }}>
            {previewImage ? <img src={previewImage} alt="Preview" onClick={e => {
          e.stopPropagation();
          setShowImageLightbox(true);
        }} onLoad={e => {
          const width = e.currentTarget.naturalWidth;
          const height = e.currentTarget.naturalHeight;
          if (width > 0 && height > 0) {
            const nextAspectRatio = width / height;
            previewAspectRatioCache.set(selectedMod.path || selectedMod.name, nextAspectRatio);
            setPreviewImageAspectRatio(nextAspectRatio);
          }
        }} onError={e => setToast({
          type: "error",
          message: t("market.images.loadFailed")
        })} key={imageKey} className="mod-details-panel-preview-image" /> : <div className="mod-preview-placeholder">
                <span className="mod-preview-placeholder-icon" aria-hidden={true}>
                  {"▧"}
                </span>
                <span>{t("mods.preview.dropHint")}</span>
                <span className="mod-details-panel-hint">
                  {t("mods.preview.pasteHint")}
                </span>
              </div>}
            {isDragging && <div className="mod-details-panel-row">
                {t("mods.preview.releaseHint")}
              </div>}
          </div>
          <div className="mod-appearance-assignment">
            <div className="mod-appearance-assignment-copy">
              <span>{t("mods.sections.title")}</span>
              <em>{t("mods.sections.movePreservesState")}</em>
            </div>
            <select value={getModAppearanceSectionId(selectedMod)} onChange={event => handleAssignSelectedModAppearanceSection(event.target.value)} disabled={appearanceSectionBusy} aria-label={t("mods.sections.moveNamedMod", {
          name: selectedMod.name
        })}>
              {appearanceSectionsWithStats.map(section => <option value={getSectionId(section)} key={getSectionId(section)}>
                  {getSectionName(section)}
                </option>)}
            </select>
          </div>
          {selectedLocalCollection && <div className="local-collection-detail-panel">
              <div className="local-collection-detail-head">
                <span className="local-collection-detail-title">
                  {t("mods.collections.namedHeading", {
              name: selectedLocalCollection.name
            })}
                </span>
                <span className="local-collection-detail-count">
                  {t("mods.collections.variantCount", {
              variantsCount: selectedLocalCollection.variants.length
            })}
                </span>
              </div>
              <LocalCollectionVariantStrip collection={selectedLocalCollection} currentPath={selectedMod.path} onSelect={selectLocalCollectionVariant} />
            </div>}
          {Array.isArray(selectedMod.tags) && selectedMod.tags.length > 0 && <div className="ai-tag-dialog-row">
              {selectedMod.tags.map((tag, ti) => {
          const tagActive = selectedTagFilters.has(String(tag).toLowerCase());
          return <span title={tagActive ? t("mods.tags.removeFilterHint", {
            tag
          }) : t("mods.tags.addFilterHint", {
            tag
          })} onClick={() => toggleTagFilter(String(tag))} style={{
            borderRadius: "999px",
            background: tagActive ? "linear-gradient(90deg, #818cf8, #6366f1)" : "rgba(99,102,241,0.10)",
            color: tagActive ? "#fff" : "#4338ca",
            border: tagActive ? "1px solid rgba(79,70,229,0.8)" : "1px solid rgba(99,102,241,0.2)",
            boxShadow: tagActive ? "0 1px 3px rgba(79,70,229,0.25)" : "none"
          }} onMouseEnter={e => {
            if (!tagActive) e.currentTarget.style.background = "rgba(99,102,241,0.18)";
          }} onMouseLeave={e => {
            if (!tagActive) e.currentTarget.style.background = "rgba(99,102,241,0.10)";
          }} key={`detail-tag-${ti}`} className="mod-details-panel-hint-emphasis">
                    {"#"}
                    {tag}
                  </span>;
        })}
            </div>}
          {activeGameId !== "arknights" && <ModPersistSummary gameId={activeGameId} characterName={characterName} modName={selectedMod.name} key={`${activeGameId}/${characterName}/${selectedMod.name}`} />}
          <div className="mod-detail-notes">
            <div className="text-caption mod-details-panel-text-caption-layout">
              <span>{t("mods.notes.title")}</span>
              {!isEditingNotes && <button onClick={() => {
            setNotesDraft(selectedMod.notes || "");
            setIsEditingNotes(true);
          }} className="mod-details-panel-edit-notes">
                  {selectedMod.notes ? t("common.actions.edit") : t("common.actions.add")}
                </button>}
            </div>
            {isEditingNotes ? <div>
                <textarea value={notesDraft} onChange={e => setNotesDraft(e.target.value)} placeholder={t("mods.notes.placeholder")} maxLength={500} rows={3} onFocus={e => {
            e.target.style.borderColor = "var(--color-accent-primary)";
          }} onBlur={e => {
            e.target.style.borderColor = "rgba(0,0,0,0.1)";
          }} className="mod-details-panel-textarea-field" />
                <div className="mod-details-panel-actions">
                  <span className="mod-details-panel-hint-subtle">
                    {notesDraft.length}
                    {"/500"}
                  </span>
                  <button className="btn btn-secondary mod-details-panel-note-action" disabled={notesSaving} onClick={() => setIsEditingNotes(false)}>
                    {t("common.actions.cancel")}
                  </button>
                  <button className="btn btn-primary mod-details-panel-note-action" disabled={notesSaving} onClick={handleSaveModNotes}>
                    {notesSaving ? t("common.status.saving") : t("mods.notes.save")}
                  </button>
                </div>
              </div> : <div onClick={() => {
          setNotesDraft(selectedMod.notes || "");
          setIsEditingNotes(true);
        }} style={{
          background: selectedMod.notes ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.025)",
          color: selectedMod.notes ? "var(--color-text-primary)" : "var(--color-text-tertiary)"
        }} className="mod-details-panel-notes-content">
                {selectedMod.notes || t("mods.notes.addPlaceholder")}
              </div>}
          </div>
          <div className="hotkey-section">
            <div className="text-caption mod-details-panel-hotkey-heading">
              <span>{t("mods.hotkeys.title")}</span>
              <button className="btn-icon-small mod-details-panel-btn-icon-small-layout" disabled={isRefreshingHotkeys} onClick={e => {
            e.stopPropagation();
            loadModDetails(selectedMod.name, true);
          }} title={t("mods.hotkeys.rescan")}>
                <div style={{
              animation: isRefreshingHotkeys ? "spin 1s linear infinite" : "none"
            }} className="mod-details-panel-hotkey-refresh-icon">
                  {"🔄"}
                </div>
              </button>
            </div>
            <div className="hotkey-group-list">
              {hotkeyGroups.length === 0 ? <div className="text-caption">{t("mods.hotkeys.empty")}</div> : hotkeyGroups.map((group, groupIndex) => <section className="hotkey-group" key={group.relativePath ?? groupIndex}>
                    <h3 className="hotkey-group-name" title={group.relativePath || group.name}>
                      {group.name}
                    </h3>
                    {group.hotkeys.map((hk, rowIndex) => {
              const index = `${groupIndex}:${rowIndex}`;
              const aliasKey = group.relativePath ? `${group.relativePath}/${hk.section}` : hk.section;
              return <div className="hotkey-row" style={hk.isMenu || hk.description === "菜单" ? {
                background: "rgba(255, 182, 193, 0.2)",
                borderLeft: "4px solid var(--color-accent-primary)",
                borderRadius: "4px",
                marginBottom: "4px",
                padding: "8px 12px"
              } : {}} key={index}>
                          {(() => {
                  const aliases = selectedMod?.hotkeyAliases || {};
                  const alias = aliases[aliasKey] || aliases[hk.section] || "";
                  const isMenu = hk.isMenu || hk.description === "菜单";
                  const base = isMenu ? t("mods.hotkeys.menuHeading") : hk.description;
                  const label = alias || base;
                  const isEditing = editingAliasSection === aliasKey;
                  if (isEditing) {
                    return <div className="mod-details-panel-hotkey-alias-editor">
                                  <input type="text" value={aliasDraft} autoFocus={true} maxLength={40} placeholder={base} onChange={e => setAliasDraft(e.target.value)} onKeyDown={e => {
                        if (e.key === "Enter") handleSaveHotkeyAlias(aliasKey);else if (e.key === "Escape") {
                          setEditingAliasSection(null);
                          setAliasDraft("");
                        }
                      }} className="mod-details-panel-input-field" />
                                  <button onClick={() => handleSaveHotkeyAlias(aliasKey)} disabled={aliasSaving} title={t("mods.hotkeys.saveLabelHint")} style={{
                        cursor: aliasSaving ? "wait" : "pointer"
                      }} className="mod-details-panel-save-hotkey-alias">
                                    {"✓"}
                                  </button>
                                  <button onClick={() => {
                        setEditingAliasSection(null);
                        setAliasDraft("");
                      }} disabled={aliasSaving} title={t("common.actions.cancel")} className="mod-details-panel-action-spaced">
                                    {"✕"}
                                  </button>
                                </div>;
                  }
                  return <div className="hotkey-desc" title={alias ? t("mods.hotkeys.originalNameHint", {
                    base,
                    section: hk.section
                  }) : hk.section} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    ...(isMenu ? {
                      fontWeight: "bold",
                      color: "var(--color-accent-primary)"
                    } : {})
                  }}>
                                <span className="hotkey-name" style={alias ? {
                      fontStyle: "italic"
                    } : void 0}>
                                  {label}
                                </span>
                                <button onClick={e => {
                      e.stopPropagation();
                      setEditingAliasSection(aliasKey);
                      setAliasDraft(alias || "");
                    }} title={t("mods.hotkeys.customLabelHint")} onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0.55"} className="mod-details-panel-edit-hotkey-alias">
                                  {"✏️"}
                                </button>
                              </div>;
                })()}
                          {editingHotkey?.index === index ?
                // Editing mode
                <div className="hotkey-edit-mode">
                              <input type="text" className="hotkey-capture-input mod-details-panel-hotkey-capture-input-layout" placeholder={t("mods.hotkeys.pressKeyPlaceholder")} value={capturedKey} onKeyDown={handleKeyCapture} readOnly={true} autoFocus={true} />
                              <button onClick={saveHotkeyEdit} disabled={!capturedKey} style={{
                    background: capturedKey ? "var(--color-accent-primary)" : "#ccc",
                    cursor: capturedKey ? "pointer" : "not-allowed"
                  }} className="mod-details-panel-save-hotkey-edit-action">
                                {"✓"}
                              </button>
                              <button onClick={cancelHotkeyEdit} className="mod-details-panel-cancel-hotkey-edit-action">
                                {"✕"}
                              </button>
                            </div> :
                // Display mode
                <div className="hotkey-keys mod-details-panel-hotkey-keys-layout">
                              {(hk.alternatives?.length ? hk.alternatives : [{
                    displayKeys: hk.keys || []
                  }]).map((alt, altIndex) => <span className="hotkey-alternative" key={altIndex}>
                                  {altIndex > 0 && <span className="hotkey-or">
                                      {t("common.words.or")}
                                    </span>}
                                  {(alt.displayKeys || []).map((key, i) => <span className="kbd-key" key={i}>
                                      {key}
                                    </span>)}
                                </span>)}
                              <button onClick={() => startHotkeyEdit(index, hk, group.relativePath)} className="hotkey-edit-btn mod-details-panel-hotkey-edit-btn-layout" title={t("mods.hotkeys.edit")} onMouseEnter={e => e.target.style.opacity = 1} onMouseLeave={e => e.target.style.opacity = 0.5}>
                                {"✏️"}
                              </button>
                            </div>}
                        </div>;
            })}
                  </section>)}
            </div>
          </div>
          {devMode && <div className="mod-details-panel-panel">
              <div className="mod-details-panel-row-emphasis">
                <span>{"DEV · TAGS"}</span>
                <button onClick={() => {
            setShowTagManagerModal(true);
            reloadServerTags();
          }} className="mod-details-panel-action-emphasis">
                  {t("mods.tags.managePool")}
                </button>
              </div>
              <div className="mod-details-panel-tag-list">
                {modTags.map(tag => <span key={tag} className="mod-details-panel-heading">
                    {tag}
                    <button onClick={() => setModTags(prev => prev.filter(t => t !== tag))} className="mod-details-panel-remove-tag">
                      {"✕"}
                    </button>
                  </span>)}
                {modTags.length === 0 && <span className="mod-details-panel-empty-tags-hint">
                    {t("mods.tags.empty")}
                  </span>}
              </div>
              <div className="mod-details-panel-tag-editor">
                <div className="mod-details-panel-inline-actions">
                  <input value={tagInput} onChange={e => {
              setTagInput(e.target.value);
              setShowTagSuggestions(e.target.value.length > 0);
            }} onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTagFromInput();
              }
              if (e.key === "Escape") setShowTagSuggestions(false);
            }} onFocus={() => setShowTagSuggestions(tagInput.length > 0)} placeholder={t("mods.tags.addPlaceholder")} className="mod-details-panel-tag-input" />
                  <button onClick={handleAiSuggestTags} disabled={aiTagLoading} title={t("mods.tags.aiRecommend")} className="mod-details-panel-ai-suggest-tags-action">
                    {aiTagLoading ? "..." : "AI"}
                  </button>
                  <button onClick={() => saveModTags(modTags)} disabled={tagSaving} className="mod-details-panel-save-tags">
                    {tagSaving ? "..." : t("common.actions.save")}
                  </button>
                </div>
                {showTagSuggestions && serverTags.filter(t => t.name.includes(tagInput) && !modTags.includes(t.name)).length > 0 && <div className="mod-details-panel-tag-suggestions">
                      {serverTags.filter(t => t.name.includes(tagInput) && !modTags.includes(t.name)).map(t => <div onClick={() => {
              setModTags(prev => [...prev, t.name]);
              setTagInput("");
              setShowTagSuggestions(false);
            }} onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"} onMouseLeave={e => e.currentTarget.style.background = ""} key={t.id} className="mod-details-panel-tag-suggestion">
                            <span style={{
                background: t.color || "#666"
              }} className="mod-details-panel-tag-color" />
                            {t.name}
                          </div>)}
                    </div>}
              </div>
            </div>}
          {devMode && <div className="mod-details-panel-panel-spaced">
              <div className="mod-details-panel-ai-section-heading">
                <span>{t("mods.ai.developerLabel")}</span>
                <div className="mod-details-panel-inline-actions">
                  {aiNameResult && <button onClick={clearAiSuggestions} className="mod-details-panel-clear-ai-suggestions-action">
                      {t("common.actions.clear")}
                    </button>}
                  <button onClick={handleAiSuggestName} disabled={aiNameLoading} style={{
              cursor: aiNameLoading ? "default" : "pointer",
              opacity: aiNameLoading ? 0.6 : 1
            }} className="mod-details-panel-ai-suggest-name-action">
                    {aiNameLoading ? t("mods.ai.analyzing") : aiNameResult ? t("mods.ai.recommendAgain") : t("mods.ai.recommend")}
                  </button>
                </div>
              </div>
              <div style={{
          marginBottom: aiNameResult ? "8px" : 0
        }} className="mod-details-panel-current-name-caption">
                {t("mods.ai.currentNamePrefix")}
                <code className="mod-details-panel-current-name">
                  {selectedMod.name}
                </code>
              </div>
              {aiNameResult && <React.Fragment>
                  {aiNameResult.groups.map((g, gi) => <div key={gi} className="mod-details-panel-name-suggestion-group">
                      <div className="mod-details-panel-heading-emphasis">
                        {g.label}
                      </div>
                      {g.items.map((item, ii) => <div onMouseEnter={e => {
              e.currentTarget.style.borderColor = "#6366f1";
              e.currentTarget.style.background = "#eef2ff";
            }} onMouseLeave={e => {
              e.currentTarget.style.borderColor = "#e5e7eb";
              e.currentTarget.style.background = "#fff";
            }} key={ii} className="mod-details-panel-name-suggestion-row">
                          <span className="mod-details-panel-name-suggestion">
                            {item.fullName}
                          </span>
                          <button onClick={() => applyAiName(item.fullName)} className="mod-details-panel-apply-name">
                            {t("common.actions.use")}
                          </button>
                        </div>)}
                    </div>)}
                  {aiNameResult.tags?.length > 0 && <div className="mod-details-panel-recommended-tags">
                      <div className="mod-details-panel-recommended-tags-heading">
                        <span className="mod-details-panel-recommended-tags-label">
                          {t("mods.ai.recommendedTags")}
                        </span>
                        <button onClick={() => applyAiTags(aiNameResult.tags)} className="mod-details-panel-add-recommended-tags">
                          {t("mods.ai.addAll")}
                        </button>
                      </div>
                      <div className="mod-details-panel-recommended-tag-list">
                        {aiNameResult.tags.map((tag, ti) => {
                const alreadyAdded = modTags.includes(tag);
                return <span onClick={() => !alreadyAdded && applyAiTags([tag])} style={{
                  borderRadius: "10px",
                  background: alreadyAdded ? "#d1fae5" : "#f3f4f6",
                  color: alreadyAdded ? "#059669" : "#374151",
                  cursor: alreadyAdded ? "default" : "pointer",
                  border: alreadyAdded ? "1px solid #a7f3d0" : "1px solid #e5e7eb"
                }} key={ti} className="mod-details-panel-recommended-tag">
                              {alreadyAdded ? "✓ " : ""}
                              {tag}
                            </span>;
              })}
                      </div>
                    </div>}
                </React.Fragment>}
              {aiNameLoading && <div className="mod-details-panel-hint-spaced">
                  {t("mods.ai.nameProgress", {
            aiNameStage: aiNameStage || t("mods.ai.analyzing"),
            aiNameElapsedSeconds
          })}
                </div>}
            </div>}
          <div className="mod-detail-actions">
            <button className="btn btn-secondary direct-import-dialog-content" onClick={e => handlePinMod(selectedMod.name, !selectedMod.pinned, e)}>
              {selectedMod.pinned ? t("characters.actions.unpin") : t("characters.actions.pinShort")}
            </button>
            <button className="btn btn-secondary direct-import-dialog-content" onClick={() => openModSourceFolder(selectedMod)}>
              {isDx12PakMod(selectedMod) ? t("mods.actions.open") : t("mods.actions.openSource")}
            </button>
            <button className="btn btn-secondary mod-details-panel-launch-fixer" onClick={() => handleFixMod(selectedMod)} disabled={fixRunning}>
              {fixRunning ? t("common.status.opening") : t("characters.fixer.title")}
            </button>
            <button className="btn btn-danger direct-import-dialog-content" onClick={e => confirmDelete(selectedMod.name, e)}>
              {t("common.actions.delete")}
            </button>
            {devMode && <React.Fragment>
                <button className="btn mod-details-panel-btn-layout-emphasis" onClick={() => onOpenPublishMod?.({
            characterName,
            modName: selectedMod.name,
            modFolderPath: selectedMod.path,
            gameId: activeGameId,
            initialModMode: selectedMod.modType === "dx12-pak" ? "pak" : "d3d"
          })}>
                  {t("mods.actions.publish")}
                </button>
                <button className="btn mod-details-panel-export-encrypted" onClick={async () => {
            setToast({
              type: "info",
              message: t("mods.export.encrypting")
            });
            try {
              const res = await window.api.devExportEncryptedMod({
                modPath: selectedMod.path,
                characterName,
                modName: selectedMod.name
              });
              if (res.canceled) return;
              if (!res.success) throw new Error(res.error);
              setToast({
                type: "success",
                message: t("mods.export.progress", {
                  count: (res.size / 1024 / 1024).toFixed(1)
                })
              });
            } catch (e) {
              setToast({
                type: "error",
                message: t("mods.export.failed", {
                  message: e.message
                })
              });
            }
          }}>
                  {t("mods.export.encrypted")}
                </button>
                <button className="btn mod-details-panel-copy-metadata" onClick={handleCopyDevModInfo} disabled={devInfoBusy} style={{
            opacity: devInfoBusy ? 0.7 : 1
          }}>
                  {t("mods.actions.copyInfo")}
                </button>
                <button className="btn mod-details-panel-import-metadata" onClick={handleImportDevModInfo} disabled={devInfoBusy} style={{
            opacity: devInfoBusy ? 0.7 : 1
          }}>
                  {t("mods.actions.importMetadata")}
                </button>
              </React.Fragment>}
          </div>
        </div> : <div className="card mod-details-panel-card-layout">
          <span className="mod-details-panel-icon">{"👈"}</span>
          <div className="mod-details-panel-empty-selection-hint">
            {t("mods.details.chooseModHint")}
          </div>
        </div>}
    </div>;
}
