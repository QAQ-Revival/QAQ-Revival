import { r as reactExports, j as jsxRuntimeExports } from "./index.js";
function PresetView({ activeGame }) {
  const [presets, setPresets] = reactExports.useState([]);
  const [activePresetId, setActivePresetId] = reactExports.useState(null);
  const [loading, setLoading] = reactExports.useState(true);
  const [toast, setToast] = reactExports.useState(null);
  const [showCreate, setShowCreate] = reactExports.useState(false);
  const [newName, setNewName] = reactExports.useState("");
  const [newDesc, setNewDesc] = reactExports.useState("");
  const [creating, setCreating] = reactExports.useState(false);
  const [activatingId, setActivatingId] = reactExports.useState(null);
  const [editingId, setEditingId] = reactExports.useState(null);
  const [editName, setEditName] = reactExports.useState("");
  const [editDesc, setEditDesc] = reactExports.useState("");
  const [expandedId, setExpandedId] = reactExports.useState(null);
  reactExports.useEffect(() => {
    loadPresets();
  }, []);
  reactExports.useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3e3);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  async function loadPresets() {
    try {
      const result = await window.api.presetList();
      if (result.success) {
        setPresets(result.presets || []);
        setActivePresetId(result.activePresetId);
      }
    } catch (e) {
      console.error("Failed to load presets:", e);
    } finally {
      setLoading(false);
    }
  }
  async function handleCreate() {
    if (!newName.trim()) {
      setToast({ type: "error", message: "请输入预设名称" });
      return;
    }
    setCreating(true);
    try {
      const result = await window.api.presetCreate(newName.trim(), newDesc.trim());
      if (result.success) {
        setToast({ type: "success", message: `✨ 预设「${result.preset.name}」已创建（已快照当前启用的 Mod）` });
        setNewName("");
        setNewDesc("");
        setShowCreate(false);
        loadPresets();
      } else {
        setToast({ type: "error", message: result.error });
      }
    } catch (e) {
      setToast({ type: "error", message: e.message });
    } finally {
      setCreating(false);
    }
  }
  async function handleDelete(preset) {
    if (!confirm(`确定删除预设「${preset.name}」？此操作不可恢复。`)) return;
    try {
      const result = await window.api.presetDelete(preset.id);
      if (result.success) {
        setToast({ type: "success", message: `已删除「${preset.name}」` });
        loadPresets();
      } else {
        setToast({ type: "error", message: result.error });
      }
    } catch (e) {
      setToast({ type: "error", message: e.message });
    }
  }
  async function handleActivate(preset) {
    setActivatingId(preset.id);
    try {
      const result = await window.api.presetActivate(preset.id);
      if (result.success) {
        const r = result.results;
        let msg = `✨ 已应用「${preset.name}」`;
        if (r.enabled > 0 || r.disabled > 0) {
          msg += ` (启用 ${r.enabled}, 禁用 ${r.disabled})`;
        }
        if (r.missing > 0) {
          msg += ` ⚠️ ${r.missing} 个 Mod 缺失`;
        }
        setToast({ type: r.missing > 0 ? "error" : "success", message: msg });
        loadPresets();
      } else {
        setToast({ type: "error", message: result.error });
      }
    } catch (e) {
      setToast({ type: "error", message: e.message });
    } finally {
      setActivatingId(null);
    }
  }
  async function handleSnapshot(preset) {
    try {
      const result = await window.api.presetSnapshot(preset.id);
      if (result.success) {
        setToast({ type: "success", message: `✨ 已更新「${preset.name}」为当前 Mod 状态 (${result.preset.mods.length} 个 Mod)` });
        loadPresets();
      } else {
        setToast({ type: "error", message: result.error });
      }
    } catch (e) {
      setToast({ type: "error", message: e.message });
    }
  }
  async function handleSaveEdit(preset) {
    try {
      const result = await window.api.presetUpdate(preset.id, editName, editDesc);
      if (result.success) {
        setToast({ type: "success", message: "已保存修改" });
        setEditingId(null);
        loadPresets();
      } else {
        setToast({ type: "error", message: result.error });
      }
    } catch (e) {
      setToast({ type: "error", message: e.message });
    }
  }
  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  function groupMods(mods) {
    const groups = {};
    for (const m of mods) {
      if (!groups[m.characterName]) groups[m.characterName] = [];
      groups[m.characterName].push(m);
    }
    return groups;
  }
  if (loading) return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { padding: "40px", textAlign: "center", color: "#888" }, children: "加载中..." });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "preset-view", style: { animation: "fadeIn 0.3s ease-out" }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "page-header", style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", flexDirection: "column", gap: "4px" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "预设配置" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { fontSize: "13px", color: "var(--color-text-secondary)" }, children: [
          "当前游戏：",
          activeGame?.name || "当前游戏",
          "，预设彼此独立"
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: "8px" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            className: "btn",
            onClick: async () => {
              try {
                const result = await window.api.configImport();
                if (result.success) {
                  setToast({ type: "success", message: result.message || "✨ 预设导入成功" });
                  loadPresets();
                } else if (result.error) {
                  setToast({ type: "error", message: result.error });
                }
              } catch (e) {
                setToast({ type: "error", message: e.message });
              }
            },
            style: { fontSize: "13px", padding: "8px 12px", background: "#f5f5f5", border: "1px solid #e0e0e0" },
            title: "导入预设",
            children: "📥 导入"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            className: "btn",
            onClick: async () => {
              try {
                const result = await window.api.configExport();
                if (result.success) {
                  setToast({ type: "success", message: `✨ 预设已导出到 ${result.path}` });
                }
              } catch (e) {
                setToast({ type: "error", message: e.message });
              }
            },
            style: { fontSize: "13px", padding: "8px 12px", background: "#f5f5f5", border: "1px solid #e0e0e0" },
            title: "导出预设",
            children: "📤 导出"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            className: "btn btn-primary",
            onClick: () => setShowCreate(!showCreate),
            style: { fontSize: "14px", padding: "8px 16px" },
            children: showCreate ? "✕ 取消" : "＋ 新建预设"
          }
        )
      ] })
    ] }),
    showCreate && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: {
      background: "white",
      borderRadius: "12px",
      padding: "20px",
      marginBottom: "20px",
      border: "2px dashed var(--color-accent-primary, #667eea)",
      animation: "fadeIn 0.2s ease-out"
    }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { margin: "0 0 12px 0", fontSize: "15px" }, children: "新建预设" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: "13px", color: "#888", margin: "0 0 16px 0" }, children: "将自动快照当前所有已启用的 Mod 作为预设内容" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", flexDirection: "column", gap: "12px" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "input",
          {
            type: "text",
            value: newName,
            onChange: (e) => setNewName(e.target.value),
            placeholder: "预设名称（例如：战斗外观、日常休闲）",
            style: {
              padding: "10px 14px",
              border: "1px solid #ddd",
              borderRadius: "8px",
              fontSize: "14px"
            },
            onKeyDown: (e) => e.key === "Enter" && handleCreate(),
            autoFocus: true
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "input",
          {
            type: "text",
            value: newDesc,
            onChange: (e) => setNewDesc(e.target.value),
            placeholder: "备注说明（可选）",
            style: {
              padding: "10px 14px",
              border: "1px solid #ddd",
              borderRadius: "8px",
              fontSize: "14px"
            }
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            className: "btn btn-primary",
            onClick: handleCreate,
            disabled: creating || !newName.trim(),
            style: { alignSelf: "flex-start" },
            children: creating ? "创建中..." : "📸 快照当前 Mod 并创建"
          }
        )
      ] })
    ] }),
    presets.length === 0 && !showCreate && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: {
      textAlign: "center",
      padding: "60px 20px",
      color: "#999"
    }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: "48px", marginBottom: "16px" }, children: "📋" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: "16px", fontWeight: "600", color: "#666" }, children: "还没有预设" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { fontSize: "14px", marginTop: "8px" }, children: "创建预设来保存当前 Mod 配置，一键切换不同的 Mod 组合" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          className: "btn btn-primary",
          onClick: () => setShowCreate(true),
          style: { marginTop: "16px" },
          children: "＋ 创建第一个预设"
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "flex", flexDirection: "column", gap: "12px" }, children: presets.map((preset) => {
      const isActive = preset.id === activePresetId;
      const isActivating = preset.id === activatingId;
      const isEditing = preset.id === editingId;
      const isExpanded = preset.id === expandedId;
      const isBuiltIn = !!preset.isBuiltIn;
      const modGroups = groupMods(preset.mods || []);
      const charCount = Object.keys(modGroups).length;
      const modCount = (preset.mods || []).length;
      return /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          style: {
            background: "white",
            borderRadius: "12px",
            border: isActive ? "2px solid var(--color-accent-primary, #667eea)" : "1px solid #e8e8e8",
            overflow: "hidden",
            transition: "all 0.2s"
          },
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "div",
              {
                style: {
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  background: isActive ? "rgba(102, 126, 234, 0.04)" : "transparent"
                },
                onClick: () => setExpandedId(isExpanded ? null : preset.id),
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [
                    isEditing ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: "8px", marginBottom: "4px" }, onClick: (e) => e.stopPropagation(), children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "input",
                        {
                          value: editName,
                          onChange: (e) => setEditName(e.target.value),
                          style: { padding: "4px 8px", border: "1px solid #ddd", borderRadius: "6px", fontSize: "14px", fontWeight: "600", flex: 1 },
                          autoFocus: true
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", style: { fontSize: "12px", padding: "4px 10px" }, onClick: () => handleSaveEdit(preset), children: "保存" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", style: { fontSize: "12px", padding: "4px 10px" }, onClick: () => setEditingId(null), children: "取消" })
                    ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", alignItems: "center", gap: "8px" }, children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { fontWeight: "600", fontSize: "15px" }, children: [
                        isActive ? "🟢" : "⚪",
                        " ",
                        preset.name
                      ] }),
                      isBuiltIn && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: {
                        fontSize: "11px",
                        background: "rgba(255,154,158,0.16)",
                        color: "#d85b79",
                        padding: "2px 8px",
                        borderRadius: "10px",
                        fontWeight: "700"
                      }, children: "固定预设" }),
                      isActive && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: {
                        fontSize: "11px",
                        background: "var(--color-accent-primary, #667eea)",
                        color: "white",
                        padding: "2px 8px",
                        borderRadius: "10px",
                        fontWeight: "600"
                      }, children: "当前应用" })
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: "12px", color: "#999", marginTop: "4px" }, children: [
                      modCount,
                      " 个 Mod · ",
                      charCount,
                      " 个角色",
                      preset.description && ` · ${preset.description}`,
                      preset.updatedAt ? ` · 更新于 ${formatDate(preset.updatedAt)}` : ""
                    ] })
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "flex", gap: "8px", marginLeft: "12px", flexShrink: 0 }, onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      className: "btn btn-primary",
                      onClick: () => handleActivate(preset),
                      disabled: isActivating,
                      style: { fontSize: "12px", padding: "6px 12px" },
                      children: isActivating ? "切换中..." : "⚡ 应用"
                    }
                  ) })
                ]
              }
            ),
            isExpanded && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: {
              borderTop: "1px solid #f0f0f0",
              padding: "16px 20px",
              background: "#fafafa",
              animation: "fadeIn 0.2s ease-out"
            }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }, children: !isBuiltIn ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", style: { fontSize: "12px", padding: "5px 10px" }, onClick: () => handleSnapshot(preset), children: "📸 更新为当前状态" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", style: { fontSize: "12px", padding: "5px 10px" }, onClick: () => {
                  setEditingId(preset.id);
                  setEditName(preset.name);
                  setEditDesc(preset.description || "");
                }, children: "✏️ 编辑信息" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn", style: { fontSize: "12px", padding: "5px 10px", color: "#e74c3c" }, onClick: () => handleDelete(preset), children: "🗑️ 删除" })
              ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: "12px", color: "#888" }, children: "这是系统固定预设，用于一键关闭全部 Mod" }) }),
              Object.keys(modGroups).length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: "13px", color: "#999" }, children: "该预设没有 Mod" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "flex", flexDirection: "column", gap: "8px" }, children: Object.entries(modGroups).map(([charName, mods]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: "12px", fontWeight: "600", color: "#666", marginBottom: "4px" }, children: [
                  "👤 ",
                  charName,
                  " (",
                  mods.length,
                  ")"
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: "4px" }, children: mods.map((m, i) => /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: {
                  fontSize: "11px",
                  background: "#e8eaf6",
                  color: "#444",
                  padding: "3px 8px",
                  borderRadius: "4px"
                }, children: m.modName }, i)) })
              ] }, charName)) })
            ] })
          ]
        },
        preset.id
      );
    }) }),
    toast && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `toast toast-${toast.type}`, children: toast.message }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("style", { children: `
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            ` })
  ] });
}
export {
  PresetView as default
};
