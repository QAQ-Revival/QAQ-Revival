import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
import {
  getModGameId,
  getMarketCanonicalCharacterName,
  filterVisibleMarketTags,
  buildImageList,
  getVariantLabel,
  getVariantSourceLabel,
  getModModeLabel,
  getMarketVersionLabel,
} from "../model/marketCollections.js";
import { MarketImage } from "./MarketImage.jsx";
import { ModCommentSection } from "./ModCommentSection.jsx";
export function MarketDetailDialog({
  detailMod,
  isActive,
  closingDetail,
  closeDetailModal,
  displayedMods,
  relatedScrollRef,
  openModDetail,
  detailGalleryIdx,
  setLightboxData,
  setDetailGalleryIdx,
  detailCollectionGroup,
  selectCollectionVariant,
  marketCharacterAliasIndex,
  renderFilterTag,
  gameNameMap,
  applyQuickFilter,
  selectedCharacter,
  addTagFilter,
  serverUrl,
  clientId,
  devMode,
  likedMods,
  handleToggleLike,
  commentCounts,
  openFeedbackModal,
  shouldShowDirectDownload,
  handleDirectDownload,
  handleDownload,
}) {
  return (
    detailMod &&
    isActive &&
    ReactDOM.createPortal(
      <div
        className={`xhs-detail-overlay ${closingDetail ? "closing" : ""}`}
        onClick={() => closeDetailModal()}
      >
        <div className="xhs-detail-layout" onClick={(e) => e.stopPropagation()}>
          {(() => {
            const related = displayedMods;
            if (related.length <= 1) return null;
            return (
              <div className="xhs-related-sidebar">
                <div
                  className="xhs-related-sidebar-scroll"
                  ref={relatedScrollRef}
                >
                  {related.map((m) => {
                    const isCurrent = m.id === detailMod.id;
                    return (
                      <div
                        className={`xhs-related-item ${isCurrent ? "active" : ""}`}
                        data-mod-id={m.id}
                        onClick={() => {
                          if (!isCurrent) openModDetail(m);
                        }}
                        title={m.name}
                        key={m.id}
                      >
                        {m.imageUrl ? (
                          <MarketImage
                            src={m.imageUrl}
                            alt={m.name}
                            className="market-image-related"
                          />
                        ) : (
                          <div className="market-detail-dialog-row">{"🖼️"}</div>
                        )}
                        <div className="xhs-related-item-name">{m.name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          <div className="xhs-detail-container">
            <button
              className="xhs-detail-close"
              onClick={() => closeDetailModal()}
            >
              {"✕"}
            </button>
            <div className="xhs-detail-left">
              {(() => {
                const galleryImages = buildImageList(detailMod);
                if (!galleryImages.length)
                  return <div className="xhs-detail-no-img">{"🖼️"}</div>;
                const idx = Math.min(
                  detailGalleryIdx,
                  galleryImages.length - 1,
                );
                return (
                  <React.Fragment>
                    <div
                      className="xhs-detail-bg-blur"
                      style={{
                        backgroundImage: `url(${galleryImages[idx].url})`,
                      }}
                    />
                    <MarketImage
                      src={galleryImages[idx].url}
                      alt={detailMod.name}
                      className="xhs-detail-main-img"
                      loading="eager"
                      fetchPriority="high"
                      onClick={() =>
                        setLightboxData({
                          images: galleryImages,
                          index: idx,
                        })
                      }
                      key={`detail-${idx}`}
                    />
                    {galleryImages.length > 1 && (
                      <React.Fragment>
                        <button
                          className="xhs-img-nav xhs-img-nav-prev"
                          onClick={() =>
                            setDetailGalleryIdx(
                              (i) =>
                                (i - 1 + galleryImages.length) %
                                galleryImages.length,
                            )
                          }
                        >
                          {"‹"}
                        </button>
                        <button
                          className="xhs-img-nav xhs-img-nav-next"
                          onClick={() =>
                            setDetailGalleryIdx(
                              (i) => (i + 1) % galleryImages.length,
                            )
                          }
                        >
                          {"›"}
                        </button>
                        <div className="xhs-img-counter">
                          {idx + 1}
                          {" / "}
                          {galleryImages.length}
                        </div>
                        <div className="xhs-img-dots">
                          {galleryImages.map((_, i) => (
                            <button
                              className={`xhs-img-dot ${i === idx ? "active" : ""}`}
                              onClick={() => setDetailGalleryIdx(i)}
                              key={i}
                            />
                          ))}
                        </div>
                      </React.Fragment>
                    )}
                    {galleryImages.length > 1 && (
                      <div className="xhs-thumb-strip">
                        {galleryImages.map((img, i) => (
                          <MarketImage
                            src={img.url}
                            alt=""
                            className={`xhs-thumb ${i === idx ? "active" : ""}`}
                            loading={Math.abs(i - idx) <= 1 ? "eager" : "lazy"}
                            onClick={() => setDetailGalleryIdx(i)}
                            key={i}
                          />
                        ))}
                      </div>
                    )}
                  </React.Fragment>
                );
              })()}
            </div>
            <div className="xhs-detail-right">
              <div className="xhs-detail-right-scroll">
                <div className="xhs-detail-header">
                  <h2 className="xhs-detail-title">{detailMod.name}</h2>
                  <div className="xhs-detail-meta-row">
                    <span className="xhs-meta-item">
                      {"📅"}{" "}
                      {detailMod.createdAt
                        ? new Date(detailMod.createdAt).toLocaleDateString(
                            "zh-CN",
                          )
                        : t("common.status.unknown")}
                    </span>
                    {detailMod.updatedAt && (
                      <span className="xhs-meta-item">
                        {"🔄 "}
                        {new Date(detailMod.updatedAt).toLocaleDateString(
                          "zh-CN",
                        )}
                      </span>
                    )}
                  </div>
                </div>
                {detailCollectionGroup?.variants?.length > 1 && (
                  <div className="xhs-detail-section xhs-collection-variants">
                    <div className="xhs-collection-variants-head">
                      <span>{t("market.collections.title")}</span>
                      <strong>{detailCollectionGroup.name}</strong>
                    </div>
                    <div className="xhs-variant-buttons">
                      {detailCollectionGroup.variants.map((variant, index) => {
                        const isCurrent =
                          String(variant.id) === String(detailMod.id);
                        return (
                          <button
                            type="button"
                            className={`xhs-variant-button ${isCurrent ? "active" : ""}`}
                            onClick={() => {
                              if (!isCurrent) {
                                selectCollectionVariant(
                                  detailCollectionGroup.identity,
                                  variant,
                                  true,
                                );
                              }
                            }}
                            key={variant.id}
                          >
                            <span>{getVariantLabel(variant, index)}</span>
                            <em>{getVariantSourceLabel(variant)}</em>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {detailMod.description && (
                  <div className="xhs-detail-section">
                    <div className="xhs-detail-desc">
                      {detailMod.description}
                    </div>
                  </div>
                )}
                <div className="xhs-detail-section">
                  <div className="xhs-detail-filter-tags">
                    {(() => {
                      const detailCharacterName =
                        getMarketCanonicalCharacterName(
                          detailMod.characterName ||
                            detailMod._originalCharacterName ||
                            "通用",
                          marketCharacterAliasIndex,
                        );
                      return (
                        <React.Fragment>
                          {renderFilterTag({
                            label: `🎮 ${gameNameMap[getModGameId(detailMod)] || getModGameId(detailMod)}`,
                            onClick: () =>
                              applyQuickFilter({
                                gameId: getModGameId(detailMod),
                                character: "all",
                                closeDetail: true,
                              }),
                            title: t("market.filters.currentGameHint"),
                          })}
                          {renderFilterTag({
                            label: `👤 ${detailCharacterName || t("settings.categories.general")}`,
                            className: "tag-character",
                            onClick: () =>
                              applyQuickFilter({
                                gameId: getModGameId(detailMod),
                                character: detailCharacterName || "all",
                                closeDetail: true,
                              }),
                            title: detailCharacterName
                              ? t("market.filters.detailCharacterHint", {
                                  detailCharacterName,
                                })
                              : t("market.filters.sharedModHint"),
                          })}
                        </React.Fragment>
                      );
                    })()}
                    {detailMod.game_version &&
                      renderFilterTag({
                        label: `📦 ${detailMod.game_version}`,
                        className: "tag-version",
                        onClick: () =>
                          applyQuickFilter({
                            gameId: getModGameId(detailMod),
                            character: selectedCharacter,
                            gameVersion: detailMod.game_version,
                            closeDetail: true,
                          }),
                        title: t("market.filters.detailVersionHint", {
                          detailMod: detailMod.game_version,
                        }),
                      })}
                    <span
                      className="tag"
                      title={
                        (detailMod.modMode || "d3d") === "pak"
                          ? "Pak Mod"
                          : "3dm Mod"
                      }
                    >
                      {getModModeLabel(detailMod.modMode || "d3d")}
                    </span>
                    <span className="tag">
                      {getMarketVersionLabel(detailMod)}
                    </span>
                  </div>
                  {filterVisibleMarketTags(detailMod.tags).length > 0 && (
                    <div className="xhs-detail-mod-tags">
                      {filterVisibleMarketTags(detailMod.tags).map((tag) => (
                        <button
                          className="tag mod-tag-pill tag-clickable"
                          style={{
                            background: `${tag.color || "#666"}18`,
                            color: tag.color || "#666",
                            border: `1px solid ${tag.color || "#666"}40`,
                          }}
                          title={t("market.filters.namedHint", {
                            name: tag.name,
                          })}
                          onClick={() => {
                            addTagFilter(tag);
                            closeDetailModal();
                          }}
                          key={tag.id}
                        >
                          {tag.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="xhs-detail-section xhs-detail-comments">
                  <ModCommentSection
                    modId={detailMod.id}
                    serverUrl={serverUrl}
                    clientId={clientId}
                    devMode={devMode}
                    mod={detailMod}
                  />
                </div>
              </div>
              <div className="xhs-detail-bottom-bar">
                <div className="xhs-bottom-stats">
                  <button
                    className={`xhs-bottom-stat ${likedMods.has(String(detailMod.id)) ? "liked" : ""}`}
                    onClick={() => handleToggleLike(detailMod.id)}
                    title={
                      likedMods.has(String(detailMod.id))
                        ? t("market.actions.unfavorite")
                        : t("market.actions.favorite")
                    }
                    style={
                      likedMods.has(String(detailMod.id))
                        ? {
                            color: "#ec4899",
                          }
                        : void 0
                    }
                  >
                    <span
                      className="xhs-bottom-stat-icon mod-favorite-heart"
                      aria-hidden="true"
                    >
                      {likedMods.has(String(detailMod.id)) ? "♥" : "♡"}
                    </span>
                    <span className="xhs-bottom-stat-num">
                      {t("market.actions.favorite")}
                    </span>
                  </button>
                  {commentCounts[detailMod.id] > 0 && (
                    <span className="xhs-bottom-stat">
                      <span className="xhs-bottom-stat-icon">{"💬"}</span>
                      <span className="xhs-bottom-stat-num">
                        {commentCounts[detailMod.id]}
                      </span>
                    </span>
                  )}
                  <button
                    className="xhs-bottom-stat xhs-feedback-stat"
                    onClick={() => openFeedbackModal(detailMod)}
                    title={t("market.feedback.brokenDownloadHint")}
                  >
                    <span className="xhs-bottom-stat-icon">{"!"}</span>
                    <span className="xhs-bottom-stat-num">
                      {t("market.feedback.brokenLink")}
                    </span>
                  </button>
                </div>
                <div className="xhs-bottom-actions">
                  {shouldShowDirectDownload(detailMod) && (
                    <button
                      className="btn btn-primary xhs-dl-btn"
                      title={t("market.actions.downloadAndInstall")}
                      onClick={() =>
                        handleDirectDownload(detailMod, "mod_detail")
                      }
                    >
                      {t("common.actions.download")}
                    </button>
                  )}
                  {detailMod.downloadUrl && (
                    <button
                      className="btn btn-primary xhs-dl-btn xhs-dl-baidu"
                      title={t("market.actions.downloadBaidu")}
                      onClick={() =>
                        handleDownload(
                          detailMod,
                          detailMod.downloadUrl,
                          "baidu",
                          "mod_detail",
                        )
                      }
                    >
                      {t("market.sources.baidu")}
                    </button>
                  )}
                  {detailMod.quarkDownloadUrl && (
                    <button
                      className="btn btn-primary xhs-dl-btn xhs-dl-quark"
                      title={t("market.actions.downloadQuark")}
                      onClick={() =>
                        handleDownload(
                          detailMod,
                          detailMod.quarkDownloadUrl,
                          "quark",
                          "mod_detail",
                        )
                      }
                    >
                      {t("market.sources.quark")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    )
  );
}
