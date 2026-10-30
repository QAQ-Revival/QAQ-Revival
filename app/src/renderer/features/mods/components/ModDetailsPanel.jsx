import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import { Icon } from "../../../components/Icon.jsx";
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
  handleToggle,
  onOpenPublishMod,
  handleCopyDevModInfo,
  devInfoBusy,
  handleImportDevModInfo
}) {
  return <div id="mod-detail-panel" className={`mod-detail-panel ${viewMode === "gallery" ? "gallery-mode" : ""} ${!selectedMod || detailCollapsed ? "collapsed" : ""}`} aria-hidden={!selectedMod || detailCollapsed} inert={!selectedMod || detailCollapsed ? "" : void 0} style={{
    "--mod-detail-width": selectedMod && !detailCollapsed ? `${visibleDetailWidth}px` : "0px"
  }}>
      {selectedMod ? <div className="mod-detail-card">
          <header className="mod-detail-header">
            {isRenamingMod ? <div className="mod-detail-rename">
                <input type="text" value={renameModDraft} autoFocus={true} onChange={e => setRenameModDraft(e.target.value)} onKeyDown={e => {
            if (e.key === "Enter") handleSaveModRename();else if (e.key === "Escape") setIsRenamingMod(false);
          }} className="input" />
                <button className="btn btn-primary" disabled={renameModSaving} onClick={handleSaveModRename}>
                  {renameModSaving ? t("common.status.saving") : t("common.actions.save")}
                </button>
                <button className="btn" disabled={renameModSaving} onClick={() => setIsRenamingMod(false)}>
                  {t("common.actions.cancel")}
                </button>
              </div> : <div className="mod-detail-heading">
                <span className="mod-detail-name" title={selectedMod.name}>
                  {selectedMod.name}
                </span>
                {selectedMod.pinned && <span title={t("mods.status.pinned")} className="mod-pin-icon">
                    <Icon name="pin" size={13} />
                  </span>}
                <button onClick={() => {
            setRenameModDraft(selectedMod.name);
            setIsRenamingMod(true);
          }} title={t("mods.actions.rename")} aria-label={t("mods.actions.rename")} className="icon-btn icon-btn-sm mod-detail-rename-btn">
                  <Icon name="edit" size={14} />
                </button>
              </div>}
            <div className="mod-detail-state">
              <span className={`mod-status-badge ${selectedMod.enabled ? "is-enabled" : ""}`}>
                {selectedMod.enabled ? t("common.status.enabled") : t("common.status.disabled")}
              </span>
              <button type="button" role="switch" aria-checked={!!(selectedMod.enabled || selectedMod.pendingEnabled)} aria-label={`${selectedMod.enabled ? t("common.actions.disable") : t("common.actions.enable")} ${selectedMod.name}`} className={`toggle-switch-refined ${selectedMod.enabled || selectedMod.pendingEnabled ? "active" : ""} ${selectedMod.pendingEnabled ? "pending" : ""}`} onClick={e => handleToggle(selectedMod.name, selectedMod.enabled, e)} />
            </div>
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
                <Icon name="image" size={20} />
                <span>{t("mods.preview.dropHint")}</span>
                <span className="mod-preview-placeholder-hint">
                  {t("mods.preview.pasteHint")}
                </span>
              </div>}
            {isDragging && <div className="mod-preview-drop-hint">
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
          {activeGameId === "arknights" && selectedMod.arknightsScope && <p className="arknights-scope-note">{t("arknights.affectedAppearances", { names: selectedMod.arknightsScope.sectionIds.map(id => getSectionName(appearanceSectionsWithStats.find(section => getSectionId(section) === id))).join("、") })}</p>}
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
          {Array.isArray(selectedMod.tags) && selectedMod.tags.length > 0 && <div className="mod-detail-tags">
              {selectedMod.tags.map((tag, ti) => {
          const tagActive = selectedTagFilters.has(String(tag).toLowerCase());
          return <button type="button" title={tagActive ? t("mods.tags.removeFilterHint", {
            tag
          }) : t("mods.tags.addFilterHint", {
            tag
          })} onClick={() => toggleTagFilter(String(tag))} aria-pressed={tagActive} key={`detail-tag-${ti}`} className={`chip ${tagActive ? "active" : ""}`}>
                    {"#"}
                    {tag}
                  </button>;
        })}
            </div>}
          {activeGameId !== "arknights" && <ModPersistSummary gameId={activeGameId} characterName={characterName} modName={selectedMod.name} key={`${activeGameId}/${characterName}/${selectedMod.name}`} />}
          <div className="mod-detail-notes">
            <div className="mod-detail-section-head">
              <span>{t("mods.notes.title")}</span>
              {!isEditingNotes && <button onClick={() => {
            setNotesDraft(selectedMod.notes || "");
            setIsEditingNotes(true);
          }} className="link-btn mod-details-panel-edit-notes">
                  {selectedMod.notes ? t("common.actions.edit") : t("common.actions.add")}
                </button>}
            </div>
            {isEditingNotes ? <div>
                <textarea value={notesDraft} onChange={e => setNotesDraft(e.target.value)} placeholder={t("mods.notes.placeholder")} maxLength={500} rows={3} className="textarea mod-details-panel-textarea-field" />
                <div className="mod-detail-notes-actions">
                  <span className="text-caption">
                    {notesDraft.length}
                    {"/500"}
                  </span>
                  <button className="btn btn-sm" disabled={notesSaving} onClick={() => setIsEditingNotes(false)}>
                    {t("common.actions.cancel")}
                  </button>
                  <button className="btn btn-sm btn-primary" disabled={notesSaving} onClick={handleSaveModNotes}>
                    {notesSaving ? t("common.status.saving") : t("mods.notes.save")}
                  </button>
                </div>
              </div> : selectedMod.notes ? <div onClick={() => {
          setNotesDraft(selectedMod.notes || "");
          setIsEditingNotes(true);
        }} className="mod-details-panel-notes-content selectable">
                {selectedMod.notes}
              </div> : null}
          </div>
          <div className="hotkey-section">
            <div className="mod-detail-section-head">
              <span>{t("mods.hotkeys.title")}</span>
              <button className="icon-btn icon-btn-sm" disabled={isRefreshingHotkeys} onClick={e => {
            e.stopPropagation();
            loadModDetails(selectedMod.name, true);
          }} title={t("mods.hotkeys.rescan")} aria-label={t("mods.hotkeys.rescan")}>
                <Icon name="refresh" size={14} className={isRefreshingHotkeys ? "is-spinning" : ""} />
              </button>
            </div>
            <div className="hotkey-group-list">
              {hotkeyGroups.length === 0 ? <div className="mod-detail-empty">{t("mods.hotkeys.empty")}</div> : hotkeyGroups.map((group, groupIndex) => <section className="hotkey-group" key={group.relativePath ?? groupIndex}>
                    <h3 className="hotkey-group-name" title={group.relativePath || group.name}>
                      {group.name}
                    </h3>
                    {group.hotkeys.map((hk, rowIndex) => {
              const index = `${groupIndex}:${rowIndex}`;
              const aliasKey = group.relativePath ? `${group.relativePath}/${hk.section}` : hk.section;
              return <div className={`hotkey-row ${hk.isMenu || hk.description === "菜单" ? "is-menu" : ""}`} key={index}>
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
                                  <button onClick={() => handleSaveHotkeyAlias(aliasKey)} disabled={aliasSaving} title={t("mods.hotkeys.saveLabelHint")} aria-label={t("mods.hotkeys.saveLabelHint")} className="icon-btn icon-btn-sm mod-details-panel-save-hotkey-alias">
                                    <Icon name="check" size={14} />
                                  </button>
                                  <button onClick={() => {
                        setEditingAliasSection(null);
                        setAliasDraft("");
                      }} disabled={aliasSaving} title={t("common.actions.cancel")} aria-label={t("common.actions.cancel")} className="icon-btn icon-btn-sm">
                                    <Icon name="x" size={14} />
                                  </button>
                                </div>;
                  }
                  return <div className="hotkey-desc" title={alias ? t("mods.hotkeys.originalNameHint", {
                    base,
                    section: hk.section
                  }) : hk.section}>
                                <span className={`hotkey-name ${alias ? "is-alias" : ""}`}>
                                  {label}
                                </span>
                                <button onClick={e => {
                      e.stopPropagation();
                      setEditingAliasSection(aliasKey);
                      setAliasDraft(alias || "");
                    }} title={t("mods.hotkeys.customLabelHint")} aria-label={t("mods.hotkeys.customLabelHint")} className="icon-btn icon-btn-sm hotkey-reveal mod-details-panel-edit-hotkey-alias">
                                  <Icon name="edit" size={13} />
                                </button>
                              </div>;
                })()}
                          {editingHotkey?.index === index ?
                // Editing mode
                <div className="hotkey-edit-mode">
                              <input type="text" className="hotkey-capture-input mod-details-panel-hotkey-capture-input-layout" placeholder={t("mods.hotkeys.pressKeyPlaceholder")} value={capturedKey} onKeyDown={handleKeyCapture} readOnly={true} autoFocus={true} />
                              <button onClick={saveHotkeyEdit} disabled={!capturedKey} aria-label={t("common.actions.save")} className="icon-btn icon-btn-sm mod-details-panel-save-hotkey-edit-action">
                                <Icon name="check" size={14} />
                              </button>
                              <button onClick={cancelHotkeyEdit} aria-label={t("common.actions.cancel")} className="icon-btn icon-btn-sm mod-details-panel-cancel-hotkey-edit-action">
                                <Icon name="x" size={14} />
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
                              <button onClick={() => startHotkeyEdit(index, hk, group.relativePath)} className="icon-btn icon-btn-sm hotkey-reveal hotkey-edit-btn" title={t("mods.hotkeys.edit")} aria-label={t("mods.hotkeys.edit")}>
                                <Icon name="edit" size={13} />
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
                {modTags.map(tag => <span key={tag} className="chip">
                    {tag}
                    <button onClick={() => setModTags(prev => prev.filter(t => t !== tag))} className="mod-details-panel-remove-tag">
                      <Icon name="x" size={11} />
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
            }} key={t.id} className="mod-details-panel-tag-suggestion">
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
                  <button onClick={handleAiSuggestName} disabled={aiNameLoading} className="btn btn-sm mod-details-panel-ai-suggest-name-action">
                    {aiNameLoading ? t("mods.ai.analyzing") : aiNameResult ? t("mods.ai.recommendAgain") : t("mods.ai.recommend")}
                  </button>
                </div>
              </div>
              <div className="mod-details-panel-current-name-caption">
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
                      {g.items.map((item, ii) => <div key={ii} className="mod-details-panel-name-suggestion-row">
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
                return <span onClick={() => !alreadyAdded && applyAiTags([tag])} key={ti} className={`chip ${alreadyAdded ? "active" : ""} mod-details-panel-recommended-tag`}>
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
            <button className="btn btn-sm" onClick={e => handlePinMod(selectedMod.name, !selectedMod.pinned, e)}>
              <Icon name="pin" size={13} />
              {selectedMod.pinned ? t("characters.actions.unpin") : t("characters.actions.pinShort")}
            </button>
            <button className="btn btn-sm" onClick={() => openModSourceFolder(selectedMod)}>
              <Icon name="folder" size={13} />
              {isDx12PakMod(selectedMod) ? t("mods.actions.open") : t("mods.actions.openSource")}
            </button>
            <button className="btn btn-sm" onClick={() => handleFixMod(selectedMod)} disabled={fixRunning}>
              <Icon name="wrench" size={13} />
              {fixRunning ? t("common.status.opening") : t("characters.fixer.title")}
            </button>
            <span className="mod-detail-actions-spacer" />
            <button className="btn btn-sm btn-danger" onClick={e => confirmDelete(selectedMod.name, e)}>
              {t("common.actions.delete")}
            </button>
            {devMode && <React.Fragment>
                <button className="btn btn-sm mod-details-panel-btn-layout-emphasis" onClick={() => onOpenPublishMod?.({
            characterName,
            modName: selectedMod.name,
            modFolderPath: selectedMod.path,
            gameId: activeGameId,
            initialModMode: selectedMod.modType === "dx12-pak" ? "pak" : "d3d"
          })}>
                  {t("mods.actions.publish")}
                </button>
                <button className="btn btn-sm mod-details-panel-export-encrypted" onClick={async () => {
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
                <button className="btn btn-sm mod-details-panel-copy-metadata" onClick={handleCopyDevModInfo} disabled={devInfoBusy}>
                  {t("mods.actions.copyInfo")}
                </button>
                <button className="btn btn-sm mod-details-panel-import-metadata" onClick={handleImportDevModInfo} disabled={devInfoBusy}>
                  {t("mods.actions.importMetadata")}
                </button>
              </React.Fragment>}
          </div>
        </div> : <div className="mod-detail-card mod-detail-card-empty">
          <div className="empty-state">
            <div className="empty-text">{t("mods.details.chooseModHint")}</div>
          </div>
        </div>}
    </div>;
}
