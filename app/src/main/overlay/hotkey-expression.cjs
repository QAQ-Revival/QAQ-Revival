"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const HOTKEY_NO_MODIFIER_CODES = ["VK_CONTROL", "VK_SHIFT", "VK_MENU", "VK_LWIN", "VK_RWIN"];
function createHotkeyTokenDefinition(code, display, options = {}) {
  return {
    code,
    display,
    device: options.device || "keyboard",
    isModifier: !!options.isModifier,
    commandToken: options.commandToken || display,
    implicitCodes: Array.isArray(options.implicitCodes) ? [...options.implicitCodes] : []
  };
}
const HOTKEY_TOKEN_ALIASES = {
  CTRL: createHotkeyTokenDefinition("VK_CONTROL", "Ctrl", {
    isModifier: true
  }),
  CONTROL: createHotkeyTokenDefinition("VK_CONTROL", "Ctrl", {
    isModifier: true
  }),
  VK_CONTROL: createHotkeyTokenDefinition("VK_CONTROL", "Ctrl", {
    isModifier: true
  }),
  VK_LCONTROL: createHotkeyTokenDefinition("VK_LCONTROL", "LCtrl", {
    isModifier: true,
    commandToken: "LCtrl"
  }),
  VK_RCONTROL: createHotkeyTokenDefinition("VK_RCONTROL", "RCtrl", {
    isModifier: true,
    commandToken: "RCtrl"
  }),
  ALT: createHotkeyTokenDefinition("VK_MENU", "Alt", {
    isModifier: true
  }),
  MENU: createHotkeyTokenDefinition("VK_MENU", "Alt", {
    isModifier: true
  }),
  VK_MENU: createHotkeyTokenDefinition("VK_MENU", "Alt", {
    isModifier: true
  }),
  VK_LMENU: createHotkeyTokenDefinition("VK_LMENU", "LAlt", {
    isModifier: true,
    commandToken: "LAlt"
  }),
  VK_RMENU: createHotkeyTokenDefinition("VK_RMENU", "RAlt", {
    isModifier: true,
    commandToken: "RAlt"
  }),
  SHIFT: createHotkeyTokenDefinition("VK_SHIFT", "Shift", {
    isModifier: true
  }),
  VK_SHIFT: createHotkeyTokenDefinition("VK_SHIFT", "Shift", {
    isModifier: true
  }),
  VK_LSHIFT: createHotkeyTokenDefinition("VK_LSHIFT", "LShift", {
    isModifier: true,
    commandToken: "LShift"
  }),
  VK_RSHIFT: createHotkeyTokenDefinition("VK_RSHIFT", "RShift", {
    isModifier: true,
    commandToken: "RShift"
  }),
  LWIN: createHotkeyTokenDefinition("VK_LWIN", "LWin", {
    isModifier: true
  }),
  RWIN: createHotkeyTokenDefinition("VK_RWIN", "RWin", {
    isModifier: true
  }),
  VK_LWIN: createHotkeyTokenDefinition("VK_LWIN", "LWin", {
    isModifier: true
  }),
  VK_RWIN: createHotkeyTokenDefinition("VK_RWIN", "RWin", {
    isModifier: true
  }),
  UP: createHotkeyTokenDefinition("VK_UP", "Up"),
  DOWN: createHotkeyTokenDefinition("VK_DOWN", "Down"),
  LEFT: createHotkeyTokenDefinition("VK_LEFT", "Left"),
  RIGHT: createHotkeyTokenDefinition("VK_RIGHT", "Right"),
  VK_UP: createHotkeyTokenDefinition("VK_UP", "Up"),
  VK_DOWN: createHotkeyTokenDefinition("VK_DOWN", "Down"),
  VK_LEFT: createHotkeyTokenDefinition("VK_LEFT", "Left"),
  VK_RIGHT: createHotkeyTokenDefinition("VK_RIGHT", "Right"),
  ENTER: createHotkeyTokenDefinition("VK_RETURN", "Enter"),
  RETURN: createHotkeyTokenDefinition("VK_RETURN", "Enter"),
  VK_RETURN: createHotkeyTokenDefinition("VK_RETURN", "Enter"),
  ESC: createHotkeyTokenDefinition("VK_ESCAPE", "Esc", {
    commandToken: "Esc"
  }),
  ESCAPE: createHotkeyTokenDefinition("VK_ESCAPE", "Esc", {
    commandToken: "Esc"
  }),
  VK_ESCAPE: createHotkeyTokenDefinition("VK_ESCAPE", "Esc", {
    commandToken: "Esc"
  }),
  TAB: createHotkeyTokenDefinition("VK_TAB", "Tab"),
  VK_TAB: createHotkeyTokenDefinition("VK_TAB", "Tab"),
  BACK: createHotkeyTokenDefinition("VK_BACK", "Backspace", {
    commandToken: "Backspace"
  }),
  BACKSPACE: createHotkeyTokenDefinition("VK_BACK", "Backspace", {
    commandToken: "Backspace"
  }),
  VK_BACK: createHotkeyTokenDefinition("VK_BACK", "Backspace", {
    commandToken: "Backspace"
  }),
  DELETE: createHotkeyTokenDefinition("VK_DELETE", "Delete"),
  DEL: createHotkeyTokenDefinition("VK_DELETE", "Delete"),
  VK_DELETE: createHotkeyTokenDefinition("VK_DELETE", "Delete"),
  INSERT: createHotkeyTokenDefinition("VK_INSERT", "Insert"),
  INS: createHotkeyTokenDefinition("VK_INSERT", "Insert"),
  VK_INSERT: createHotkeyTokenDefinition("VK_INSERT", "Insert"),
  HOME: createHotkeyTokenDefinition("VK_HOME", "Home"),
  VK_HOME: createHotkeyTokenDefinition("VK_HOME", "Home"),
  END: createHotkeyTokenDefinition("VK_END", "End"),
  VK_END: createHotkeyTokenDefinition("VK_END", "End"),
  PAGEUP: createHotkeyTokenDefinition("VK_PRIOR", "PageUp", {
    commandToken: "PageUp"
  }),
  PGUP: createHotkeyTokenDefinition("VK_PRIOR", "PageUp", {
    commandToken: "PageUp"
  }),
  PRIOR: createHotkeyTokenDefinition("VK_PRIOR", "PageUp", {
    commandToken: "PageUp"
  }),
  VK_PRIOR: createHotkeyTokenDefinition("VK_PRIOR", "PageUp", {
    commandToken: "PageUp"
  }),
  PAGEDOWN: createHotkeyTokenDefinition("VK_NEXT", "PageDown", {
    commandToken: "PageDown"
  }),
  PGDN: createHotkeyTokenDefinition("VK_NEXT", "PageDown", {
    commandToken: "PageDown"
  }),
  NEXT: createHotkeyTokenDefinition("VK_NEXT", "PageDown", {
    commandToken: "PageDown"
  }),
  VK_NEXT: createHotkeyTokenDefinition("VK_NEXT", "PageDown", {
    commandToken: "PageDown"
  }),
  SPACE: createHotkeyTokenDefinition("VK_SPACE", "Space"),
  SPACEBAR: createHotkeyTokenDefinition("VK_SPACE", "Space"),
  VK_SPACE: createHotkeyTokenDefinition("VK_SPACE", "Space"),
  VK_LBUTTON: createHotkeyTokenDefinition("VK_LBUTTON", i18n.t("backend.overlay.hotkeyExpression.leftMouse"), {
    device: "mouse",
    commandToken: "MouseLeft"
  }),
  VK_RBUTTON: createHotkeyTokenDefinition("VK_RBUTTON", i18n.t("backend.overlay.hotkeyExpression.rightMouse"), {
    device: "mouse",
    commandToken: "MouseRight"
  }),
  VK_MBUTTON: createHotkeyTokenDefinition("VK_MBUTTON", i18n.t("backend.overlay.hotkeyExpression.middleMouse"), {
    device: "mouse",
    commandToken: "MouseMiddle"
  }),
  VK_XBUTTON1: createHotkeyTokenDefinition("VK_XBUTTON1", i18n.t("backend.overlay.hotkeyExpression.extraMouseOne"), {
    device: "mouse",
    commandToken: "MouseX1"
  }),
  VK_XBUTTON2: createHotkeyTokenDefinition("VK_XBUTTON2", i18n.t("backend.overlay.hotkeyExpression.extraMouseTwo"), {
    device: "mouse",
    commandToken: "MouseX2"
  }),
  LBUTTON: createHotkeyTokenDefinition("VK_LBUTTON", i18n.t("backend.overlay.hotkeyExpression.leftMouse"), {
    device: "mouse",
    commandToken: "MouseLeft"
  }),
  RBUTTON: createHotkeyTokenDefinition("VK_RBUTTON", i18n.t("backend.overlay.hotkeyExpression.rightMouse"), {
    device: "mouse",
    commandToken: "MouseRight"
  }),
  MBUTTON: createHotkeyTokenDefinition("VK_MBUTTON", i18n.t("backend.overlay.hotkeyExpression.middleMouse"), {
    device: "mouse",
    commandToken: "MouseMiddle"
  }),
  XBUTTON1: createHotkeyTokenDefinition("VK_XBUTTON1", i18n.t("backend.overlay.hotkeyExpression.extraMouseOne"), {
    device: "mouse",
    commandToken: "MouseX1"
  }),
  XBUTTON2: createHotkeyTokenDefinition("VK_XBUTTON2", i18n.t("backend.overlay.hotkeyExpression.extraMouseTwo"), {
    device: "mouse",
    commandToken: "MouseX2"
  }),
  VK_OEM_MINUS: createHotkeyTokenDefinition("VK_OEM_MINUS", "-", {
    commandToken: "-"
  }),
  VK_OEM_PLUS: createHotkeyTokenDefinition("VK_OEM_PLUS", "=", {
    commandToken: "="
  }),
  VK_OEM_COMMA: createHotkeyTokenDefinition("VK_OEM_COMMA", ",", {
    commandToken: ","
  }),
  VK_OEM_PERIOD: createHotkeyTokenDefinition("VK_OEM_PERIOD", ".", {
    commandToken: "."
  }),
  VK_OEM_1: createHotkeyTokenDefinition("VK_OEM_1", ";", {
    commandToken: ";"
  }),
  VK_OEM_2: createHotkeyTokenDefinition("VK_OEM_2", "/", {
    commandToken: "/"
  }),
  VK_OEM_3: createHotkeyTokenDefinition("VK_OEM_3", "`", {
    commandToken: "`"
  }),
  VK_OEM_4: createHotkeyTokenDefinition("VK_OEM_4", "[", {
    commandToken: "["
  }),
  VK_OEM_5: createHotkeyTokenDefinition("VK_OEM_5", "\\", {
    commandToken: "\\"
  }),
  VK_OEM_6: createHotkeyTokenDefinition("VK_OEM_6", "]", {
    commandToken: "]"
  }),
  VK_OEM_7: createHotkeyTokenDefinition("VK_OEM_7", "'", {
    commandToken: "'"
  }),
  VK_DECIMAL: createHotkeyTokenDefinition("VK_DECIMAL", "NumPad.", {
    commandToken: "NumPadDecimal"
  }),
  VK_ADD: createHotkeyTokenDefinition("VK_ADD", "NumPad+", {
    commandToken: "NumPadAdd"
  }),
  VK_SUBTRACT: createHotkeyTokenDefinition("VK_SUBTRACT", "NumPad-", {
    commandToken: "NumPadSubtract"
  }),
  VK_MULTIPLY: createHotkeyTokenDefinition("VK_MULTIPLY", "NumPad*", {
    commandToken: "NumPadMultiply"
  }),
  VK_DIVIDE: createHotkeyTokenDefinition("VK_DIVIDE", "NumPad/", {
    commandToken: "NumPadDivide"
  })
};
const HOTKEY_PUNCTUATION_TOKENS = {
  "[": createHotkeyTokenDefinition("VK_OEM_4", "[", {
    commandToken: "["
  }),
  "]": createHotkeyTokenDefinition("VK_OEM_6", "]", {
    commandToken: "]"
  }),
  ";": createHotkeyTokenDefinition("VK_OEM_1", ";", {
    commandToken: ";"
  }),
  "'": createHotkeyTokenDefinition("VK_OEM_7", "'", {
    commandToken: "'"
  }),
  ",": createHotkeyTokenDefinition("VK_OEM_COMMA", ",", {
    commandToken: ","
  }),
  ".": createHotkeyTokenDefinition("VK_OEM_PERIOD", ".", {
    commandToken: "."
  }),
  "/": createHotkeyTokenDefinition("VK_OEM_2", "/", {
    commandToken: "/"
  }),
  "\\": createHotkeyTokenDefinition("VK_OEM_5", "\\", {
    commandToken: "\\"
  }),
  "-": createHotkeyTokenDefinition("VK_OEM_MINUS", "-", {
    commandToken: "-"
  }),
  "=": createHotkeyTokenDefinition("VK_OEM_PLUS", "=", {
    commandToken: "="
  }),
  "`": createHotkeyTokenDefinition("VK_OEM_3", "`", {
    commandToken: "`"
  }),
  "<": createHotkeyTokenDefinition("VK_OEM_COMMA", "<", {
    commandToken: "<",
    implicitCodes: ["VK_SHIFT"]
  }),
  ">": createHotkeyTokenDefinition("VK_OEM_PERIOD", ">", {
    commandToken: ">",
    implicitCodes: ["VK_SHIFT"]
  }),
  _: createHotkeyTokenDefinition("VK_OEM_MINUS", "_", {
    commandToken: "_",
    implicitCodes: ["VK_SHIFT"]
  }),
  "+": createHotkeyTokenDefinition("VK_OEM_PLUS", "+", {
    commandToken: "+",
    implicitCodes: ["VK_SHIFT"]
  }),
  "~": createHotkeyTokenDefinition("VK_OEM_3", "~", {
    commandToken: "~",
    implicitCodes: ["VK_SHIFT"]
  }),
  ":": createHotkeyTokenDefinition("VK_OEM_1", ":", {
    commandToken: ":",
    implicitCodes: ["VK_SHIFT"]
  }),
  '"': createHotkeyTokenDefinition("VK_OEM_7", '"', {
    commandToken: '"',
    implicitCodes: ["VK_SHIFT"]
  }),
  "?": createHotkeyTokenDefinition("VK_OEM_2", "?", {
    commandToken: "?",
    implicitCodes: ["VK_SHIFT"]
  }),
  "|": createHotkeyTokenDefinition("VK_OEM_5", "|", {
    commandToken: "|",
    implicitCodes: ["VK_SHIFT"]
  }),
  "{": createHotkeyTokenDefinition("VK_OEM_4", "{", {
    commandToken: "{",
    implicitCodes: ["VK_SHIFT"]
  }),
  "}": createHotkeyTokenDefinition("VK_OEM_6", "}", {
    commandToken: "}",
    implicitCodes: ["VK_SHIFT"]
  })
};
function cloneHotkeyTokenDefinition(token) {
  if (!token) return null;
  return {
    code: token.code,
    display: token.display,
    device: token.device,
    isModifier: token.isModifier,
    commandToken: token.commandToken,
    implicitCodes: Array.isArray(token.implicitCodes) ? [...token.implicitCodes] : []
  };
}
function normalizeHotkeyTokenDefinition(token) {
  if (!token) return null;
  const raw = String(token).trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (HOTKEY_PUNCTUATION_TOKENS[raw]) {
    return cloneHotkeyTokenDefinition(HOTKEY_PUNCTUATION_TOKENS[raw]);
  }
  if (HOTKEY_TOKEN_ALIASES[upper]) {
    return cloneHotkeyTokenDefinition(HOTKEY_TOKEN_ALIASES[upper]);
  }
  if (/^0X[0-9A-F]+$/.test(upper)) {
    return createHotkeyTokenDefinition(upper, upper, {
      commandToken: upper
    });
  }
  if (/^[A-Z]$/.test(upper)) {
    return createHotkeyTokenDefinition(`VK_${upper}`, upper, {
      commandToken: upper
    });
  }
  if (/^[0-9]$/.test(upper)) {
    return createHotkeyTokenDefinition(`VK_${upper}`, upper, {
      commandToken: upper
    });
  }
  if (/^F([1-9]|1\d|2[0-4])$/.test(upper)) {
    return createHotkeyTokenDefinition(`VK_${upper}`, upper, {
      commandToken: upper
    });
  }
  if (/^VK_F([1-9]|1\d|2[0-4])$/.test(upper)) {
    return createHotkeyTokenDefinition(upper, upper.replace(/^VK_/, ""), {
      commandToken: upper.replace(/^VK_/, "")
    });
  }
  if (/^NUMPAD[0-9]$/.test(upper)) {
    const suffix = upper.replace(/^NUMPAD/, "");
    return createHotkeyTokenDefinition(`VK_NUMPAD${suffix}`, `NumPad${suffix}`, {
      commandToken: `NumPad${suffix}`
    });
  }
  if (/^VK_NUMPAD[0-9]$/.test(upper)) {
    const suffix = upper.replace(/^VK_NUMPAD/, "");
    return createHotkeyTokenDefinition(upper, `NumPad${suffix}`, {
      commandToken: `NumPad${suffix}`
    });
  }
  if (/^XB(\d+)?_[A-Z0-9_]+$/.test(upper)) {
    const pretty = upper.replace(/^XB\d*_?/, "").replace(/^XB_/, "").replace(/_/g, " ");
    return createHotkeyTokenDefinition(upper, pretty, {
      device: "xinput",
      commandToken: upper
    });
  }
  return null;
}
function dedupeHotkeyTokens(tokens) {
  const seen = new Set();
  return tokens.filter(token => {
    if (!token || !token.code) return false;
    const key = `${token.device}:${token.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function sortHotkeyTokens(tokens) {
  const modifierOrder = {
    VK_CONTROL: 0,
    VK_LCONTROL: 0,
    VK_RCONTROL: 0,
    VK_SHIFT: 1,
    VK_LSHIFT: 1,
    VK_RSHIFT: 1,
    VK_MENU: 2,
    VK_LMENU: 2,
    VK_RMENU: 2,
    VK_LWIN: 3,
    VK_RWIN: 3
  };
  return [...tokens].sort((a, b) => {
    const aWeight = a.isModifier ? modifierOrder[a.code] ?? 9 : 100;
    const bWeight = b.isModifier ? modifierOrder[b.code] ?? 9 : 100;
    if (aWeight !== bWeight) return aWeight - bWeight;
    return 0;
  });
}
function serializeHotkeyTokens(tokens) {
  return tokens.map(token => ({
    code: token.code,
    display: token.display,
    device: token.device,
    isModifier: !!token.isModifier,
    commandToken: token.commandToken
  }));
}
function parseHotkeyExpression(expression) {
  const original = String(expression || "").trim();
  if (!original) {
    return {
      original: "",
      pressed: [],
      released: [],
      displayKeys: [],
      commandKeys: [],
      unsupportedTokens: [],
      devices: [],
      hasPositive: false,
      canAutoApply: false,
      usesMouse: false,
      usesXInput: false,
      displayLabel: ""
    };
  }
  const sourceTokens = original.split(/\s+/).filter(Boolean);
  const explicitPressed = [];
  const pressed = [];
  const released = [];
  const unsupportedTokens = [];
  const addToken = (tokenList, tokenDef) => {
    const cloned = cloneHotkeyTokenDefinition(tokenDef);
    if (cloned) tokenList.push(cloned);
  };
  sourceTokens.forEach(sourceToken => {
    const upper = sourceToken.toUpperCase();
    if (upper === "NO_MODIFIERS") {
      HOTKEY_NO_MODIFIER_CODES.forEach(code => {
        const tokenDef2 = normalizeHotkeyTokenDefinition(code);
        addToken(released, tokenDef2);
      });
      return;
    }
    let negative = false;
    let baseToken = sourceToken;
    if (/^NO_/i.test(sourceToken)) {
      negative = true;
      baseToken = sourceToken.replace(/^NO_/i, "");
    }
    const tokenDef = normalizeHotkeyTokenDefinition(baseToken);
    if (!tokenDef) {
      unsupportedTokens.push(sourceToken);
      return;
    }
    if (negative) {
      addToken(released, tokenDef);
      return;
    }
    explicitPressed.push(cloneHotkeyTokenDefinition(tokenDef));
    (tokenDef.implicitCodes || []).forEach(implicitCode => {
      const implicitToken = normalizeHotkeyTokenDefinition(implicitCode);
      addToken(pressed, implicitToken);
    });
    addToken(pressed, tokenDef);
  });
  const dedupedPressed = dedupeHotkeyTokens(pressed);
  const dedupedExplicitPressed = dedupeHotkeyTokens(explicitPressed);
  const dedupedReleased = dedupeHotkeyTokens(released);
  const sortedPressed = sortHotkeyTokens(dedupedPressed);
  const sortedExplicitPressed = sortHotkeyTokens(dedupedExplicitPressed);
  const sortedReleased = sortHotkeyTokens(dedupedReleased);
  const devices = [...new Set(sortedPressed.map(token => token.device))];
  const usesMouse = devices.includes("mouse");
  const usesXInput = devices.includes("xinput");
  const hasPositive = sortedPressed.length > 0;
  const canAutoApply = hasPositive && unsupportedTokens.length === 0 && sortedPressed.every(token => token.device === "keyboard");
  const displayKeys = sortedExplicitPressed.map(token => token.display);
  const commandKeys = sortedPressed.map(token => token.commandToken);
  return {
    original,
    pressed: serializeHotkeyTokens(sortedPressed),
    released: serializeHotkeyTokens(sortedReleased),
    displayKeys,
    commandKeys,
    unsupportedTokens,
    devices,
    hasPositive,
    canAutoApply,
    usesMouse,
    usesXInput,
    displayLabel: displayKeys.length > 0 ? displayKeys.join(" + ") : original
  };
}
function getHotkeyAlternativeRank(alternative) {
  if (!alternative) return 999;
  if (alternative.canAutoApply) return 0;
  if (alternative.hasPositive && alternative.usesMouse) return 1;
  if (alternative.hasPositive && alternative.usesXInput) return 2;
  if (alternative.hasPositive) return 3;
  return 4;
}
function pickPreferredHotkeyAlternative(alternatives) {
  if (!Array.isArray(alternatives) || alternatives.length === 0) return null;
  return [...alternatives].sort((a, b) => getHotkeyAlternativeRank(a) - getHotkeyAlternativeRank(b))[0] || null;
}
function buildHotkeyApplyPayloadFromAlternative(alternative) {
  if (!alternative) return null;
  return {
    original: alternative.original,
    pressed: Array.isArray(alternative.pressed) ? [...alternative.pressed] : [],
    released: Array.isArray(alternative.released) ? [...alternative.released] : [],
    displayKeys: Array.isArray(alternative.displayKeys) ? [...alternative.displayKeys] : [],
    commandKeys: Array.isArray(alternative.commandKeys) ? [...alternative.commandKeys] : [],
    devices: Array.isArray(alternative.devices) ? [...alternative.devices] : [],
    canAutoApply: !!alternative.canAutoApply
  };
}
function buildHotkeyApplyPayloadFromKeys(keys) {
  if (!Array.isArray(keys) || keys.length === 0) return null;
  const parsed = parseHotkeyExpression(keys.join(" "));
  return buildHotkeyApplyPayloadFromAlternative(parsed);
}
function resolveHotkeyApplyPayload(input) {
  if (!input) return null;
  if (Array.isArray(input)) {
    return buildHotkeyApplyPayloadFromKeys(input);
  }
  if (typeof input === "object") {
    if (Array.isArray(input.pressed) || typeof input.original === "string") {
      return {
        original: typeof input.original === "string" ? input.original : "",
        pressed: Array.isArray(input.pressed) ? [...input.pressed] : [],
        released: Array.isArray(input.released) ? [...input.released] : [],
        displayKeys: Array.isArray(input.displayKeys) ? [...input.displayKeys] : [],
        commandKeys: Array.isArray(input.commandKeys) ? [...input.commandKeys] : [],
        devices: Array.isArray(input.devices) ? [...input.devices] : [],
        canAutoApply: !!input.canAutoApply
      };
    }
    if (Array.isArray(input.keys)) {
      return buildHotkeyApplyPayloadFromKeys(input.keys);
    }
  }
  return null;
}
function canAutoApplyHotkeyPayload(payload) {
  const declaredCanAutoApply = typeof payload?.canAutoApply === "boolean" ? payload.canAutoApply : null;
  return !!(payload && Array.isArray(payload.pressed) && payload.pressed.length > 0 && payload.pressed.every(token => token.device === "keyboard") && declaredCanAutoApply !== false);
}
function getApplyHotkeyUnsupportedMessage(input) {
  const payload = resolveHotkeyApplyPayload(input);
  if (!payload) return i18n.t("backend.overlay.hotkeyExpression.applicableHotkeyMissing");
  if (!Array.isArray(payload.pressed) || payload.pressed.length === 0) {
    return i18n.t("backend.overlay.hotkeyExpression.applicableHotkeyMissing");
  }
  if (payload.pressed.some(token => token.device === "mouse")) {
    return i18n.t("backend.overlay.hotkeyExpression.mouseHotkeyUnsupported");
  }
  if (payload.pressed.some(token => token.device === "xinput")) {
    return i18n.t("backend.overlay.hotkeyExpression.controllerHotkeyUnsupported");
  }
  return i18n.t("backend.overlay.hotkeyExpression.hotkeyUnsupported");
}
function serializeHotkeyForCommand(payload) {
  if (!payload) return "";
  const commandKeys = Array.isArray(payload.commandKeys) ? payload.commandKeys.filter(Boolean) : [];
  if (commandKeys.length > 0) return commandKeys.join("+");
  const displayKeys = Array.isArray(payload.displayKeys) ? payload.displayKeys.filter(Boolean) : [];
  return displayKeys.join("+");
}
module.exports = {
  parseHotkeyExpression,
  pickPreferredHotkeyAlternative,
  buildHotkeyApplyPayloadFromAlternative,
  resolveHotkeyApplyPayload,
  canAutoApplyHotkeyPayload,
  getApplyHotkeyUnsupportedMessage,
  serializeHotkeyForCommand
};
