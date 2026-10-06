import { j as jsxRuntimeExports } from "./index.js";
const MAX_VISIBLE = 3;
function MarketUpdateToast({ mods, onDismiss, onModClick }) {
  if (!mods || mods.length === 0) return null;
  const visible = mods.slice(0, MAX_VISIBLE);
  const extra = mods.length - MAX_VISIBLE;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "market-toast", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "market-toast-header", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "market-toast-title", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "market-toast-dot" }),
        "市场有 ",
        mods.length,
        " 个新 Mod"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "market-toast-close", onClick: onDismiss, title: "关闭", children: "✕" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "market-toast-list", children: visible.map((mod) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "button",
      {
        className: "market-toast-item",
        onClick: () => onModClick(mod),
        title: mod.name,
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "market-toast-img", children: mod.imageUrl ? /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: mod.imageUrl, alt: mod.name, loading: "lazy" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "market-toast-img-placeholder", children: "🎮" }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "market-toast-info", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "market-toast-mod-name", children: mod.name }),
            mod.description && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "market-toast-mod-desc", children: mod.description }),
            mod.characterName && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "market-toast-mod-char", children: mod.characterName })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "market-toast-arrow", children: "›" })
        ]
      },
      mod.id
    )) }),
    extra > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "market-toast-extra", children: [
      "还有 ",
      extra,
      " 个新 Mod"
    ] })
  ] });
}
export {
  MarketUpdateToast as default
};
