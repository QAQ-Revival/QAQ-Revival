import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
import { Icon } from "../../../components/Icon.jsx";
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
function DetailGallery({ mod, index, setIndex, setLightboxData }) {
  const images = buildImageList(mod);
  if (!images.length)
    return (
      <div className="detail-gallery">
        <div className="detail-stage detail-stage-empty">
          <Icon name="image" size={28} />
        </div>
      </div>
    );
  const current = Math.min(index, images.length - 1);
  const move = (delta) =>
    setIndex((value) => (value + delta + images.length) % images.length);
  return (
    <div className="detail-gallery">
      <div className="detail-stage">
        <MarketImage
          src={images[current].url}
          alt={mod.name}
          className="detail-stage-image"
          loading="eager"
          fetchPriority="high"
          onClick={() =>
            setLightboxData({
              images,
              index: current,
            })
          }
          key={`detail-${current}`}
        />
        {images.length > 1 && (
          <React.Fragment>
            <button
              type="button"
              className="image-btn detail-nav is-previous"
              aria-label={t("downloads.post.previousImage")}
              onClick={() => move(-1)}
            >
              <Icon name="chevron-left" size={18} />
            </button>
            <button
              type="button"
              className="image-btn detail-nav is-next"
              aria-label={t("downloads.post.nextImage")}
              onClick={() => move(1)}
            >
              <Icon name="chevron-right" size={18} />
            </button>
            <span className="image-badge detail-counter">
              {`${current + 1} / ${images.length}`}
            </span>
          </React.Fragment>
        )}
      </div>
      {images.length > 1 && (
        <div className="detail-thumbs">
          {images.map((image, i) => (
            <button
              type="button"
              aria-label={t("downloads.post.imageNumber", {
                count: i + 1,
              })}
              aria-pressed={i === current}
              onClick={() => setIndex(i)}
              key={i}
            >
              <MarketImage
                src={image.url}
                className="detail-thumb-image"
                loading={Math.abs(i - current) <= 1 ? "eager" : "lazy"}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
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
  const open = !!detailMod && isActive;
  React.useEffect(() => {
    if (!open) return void 0;
    function handleKey(event) {
      if (event.key !== "Escape") return;
      // A lightbox or a feedback dialog on top closes first.
      if (document.querySelector(".image-viewer, .market-stacked-backdrop"))
        return;
      closeDetailModal();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, closeDetailModal]);
  if (!open) return null;
  const related = displayedMods;
  const gameId = getModGameId(detailMod);
  const liked = likedMods.has(String(detailMod.id));
  const detailCharacterName = getMarketCanonicalCharacterName(
    detailMod.characterName || detailMod._originalCharacterName || "通用",
    marketCharacterAliasIndex,
  );
  const visibleTags = filterVisibleMarketTags(detailMod.tags);
  const hasDirect = shouldShowDirectDownload(detailMod);
  return ReactDOM.createPortal(
    <div
      className={`detail-overlay ${closingDetail ? "closing" : ""}`}
      onClick={() => closeDetailModal()}
    >
      <div
        className="detail-layout"
        role="dialog"
        aria-modal={true}
        aria-label={detailMod.name}
        onClick={(e) => e.stopPropagation()}
      >
        {related.length > 1 && (
          <nav
            className="detail-rail"
            aria-label={t("downloads.post.quickSwitch")}
            ref={relatedScrollRef}
          >
            {related.map((m) => {
              const isCurrent = m.id === detailMod.id;
              return (
                <button
                  type="button"
                  className={`detail-rail-item ${isCurrent ? "active" : ""}`}
                  aria-current={isCurrent ? "true" : void 0}
                  data-mod-id={m.id}
                  onClick={() => {
                    if (!isCurrent) openModDetail(m);
                  }}
                  title={m.name}
                  key={m.id}
                >
                  <MarketImage src={m.imageUrl} className="detail-rail-image" />
                  <span>{m.name}</span>
                </button>
              );
            })}
          </nav>
        )}
        <div className="detail-main">
          <DetailGallery
            mod={detailMod}
            index={detailGalleryIdx}
            setIndex={setDetailGalleryIdx}
            setLightboxData={setLightboxData}
          />
          <div className="detail-side">
            <header className="detail-head">
              <div className="detail-head-top">
                <span className="detail-eyebrow">
                  {gameNameMap[gameId] || gameId}
                </span>
                <button
                  type="button"
                  className="icon-btn icon-btn-sm"
                  onClick={() => closeDetailModal()}
                  aria-label={t("common.actions.close")}
                  title={t("common.actions.close")}
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
              <h2 className="detail-title">{detailMod.name}</h2>
              <div className="detail-meta">
                <time>
                  {detailMod.createdAt
                    ? new Date(detailMod.createdAt).toLocaleDateString("zh-CN")
                    : t("common.status.unknown")}
                </time>
                {detailMod.updatedAt && (
                  <time>
                    {t("downloads.archive.updatedDate", {
                      date: new Date(detailMod.updatedAt).toLocaleDateString(
                        "zh-CN",
                      ),
                    })}
                  </time>
                )}
              </div>
            </header>
            <div className="detail-scroll">
              {detailCollectionGroup?.variants?.length > 1 && (
                <section className="detail-section">
                  <h3>
                    {`${t("market.collections.title")} · ${detailCollectionGroup.name}`}
                  </h3>
                  <div className="detail-variants">
                    {detailCollectionGroup.variants.map((variant, index) => {
                      const isCurrent =
                        String(variant.id) === String(detailMod.id);
                      return (
                        <button
                          type="button"
                          className={`chip ${isCurrent ? "active" : ""}`}
                          title={getVariantSourceLabel(variant)}
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
                          {getVariantLabel(variant, index)}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
              {detailMod.description && (
                <section className="detail-section detail-body-text selectable">
                  {detailMod.description}
                </section>
              )}
              <section className="detail-section detail-chips">
                {renderFilterTag({
                  label: detailCharacterName || t("settings.categories.general"),
                  onClick: () =>
                    applyQuickFilter({
                      gameId,
                      character: detailCharacterName || "all",
                      closeDetail: true,
                    }),
                  title: detailCharacterName
                    ? t("market.filters.detailCharacterHint", {
                        detailCharacterName,
                      })
                    : t("market.filters.sharedModHint"),
                })}
                {detailMod.game_version &&
                  renderFilterTag({
                    label: detailMod.game_version,
                    onClick: () =>
                      applyQuickFilter({
                        gameId,
                        character: selectedCharacter,
                        gameVersion: detailMod.game_version,
                        closeDetail: true,
                      }),
                    title: t("market.filters.detailVersionHint", {
                      detailMod: detailMod.game_version,
                    }),
                  })}
                <span
                  className="badge"
                  title={
                    (detailMod.modMode || "d3d") === "pak"
                      ? "Pak Mod"
                      : "3dm Mod"
                  }
                >
                  {getModModeLabel(detailMod.modMode || "d3d")}
                </span>
                {!detailMod.game_version && (
                  <span className="badge">
                    {getMarketVersionLabel(detailMod)}
                  </span>
                )}
                {visibleTags.map((tag) => (
                  <button
                    type="button"
                    className="chip"
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
              </section>
              <section className="detail-section">
                <ModCommentSection
                  modId={detailMod.id}
                  serverUrl={serverUrl}
                  clientId={clientId}
                  devMode={devMode}
                  mod={detailMod}
                />
              </section>
            </div>
            <footer className="detail-foot">
              <button
                type="button"
                className={`icon-btn ${liked ? "is-active" : ""}`}
                onClick={() => handleToggleLike(detailMod.id)}
                aria-pressed={liked}
                title={
                  liked
                    ? t("market.actions.unfavorite")
                    : t("market.actions.favorite")
                }
                aria-label={t("market.actions.favorite")}
              >
                <Icon
                  name="heart"
                  size={16}
                  fill={liked ? "currentColor" : "none"}
                />
              </button>
              {commentCounts[detailMod.id] > 0 && (
                <span
                  className="detail-foot-stat"
                  title={t("market.comments.title")}
                >
                  <Icon name="message" size={14} />
                  {commentCounts[detailMod.id]}
                </span>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => openFeedbackModal(detailMod)}
                title={t("market.feedback.brokenDownloadHint")}
              >
                {t("market.feedback.brokenLink")}
              </button>
              <div className="detail-foot-end">
                {hasDirect && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    title={t("market.actions.downloadAndInstall")}
                    onClick={() =>
                      handleDirectDownload(detailMod, "mod_detail")
                    }
                  >
                    <Icon name="download" size={15} />
                    {t("common.actions.download")}
                  </button>
                )}
                {detailMod.downloadUrl && (
                  <button
                    type="button"
                    className={`btn ${hasDirect ? "" : "btn-primary"}`}
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
                    type="button"
                    className={`btn ${hasDirect || detailMod.downloadUrl ? "" : "btn-primary"}`}
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
            </footer>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
