// Inline SVG for the string-rendered overlay windows. Paths mirror components/Icon.jsx.
const PATHS = {
  alert: "M12 4 2.5 20h19L12 4ZM12 10v4.5M12 17.5v.01",
  bookmark: "M6 3h12v18l-6-4-6 4V3Z",
  box: "M12 3 4 7v10l8 4 8-4V7l-8-4ZM4 7l8 4 8-4M12 11v10",
  check: "m5 12.5 4.5 4.5L19 7.5",
  "chevron-down": "m6 9 6 6 6-6",
  external: "M14 4h6v6M20 4 11 13M10 6H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5",
  filter: "M3.5 5h17l-6.5 8v6l-4 2v-8L3.5 5Z",
  folder: "M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2.5h8.4A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-12Z",
  gear: "M12 8.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4ZM19.4 13.5l1.6 1.2-2 3.4-1.9-.8a7 7 0 0 1-1.7 1L15 21h-4l-.4-2.7a7 7 0 0 1-1.7-1l-1.9.8-2-3.4 1.6-1.2a7 7 0 0 1 0-3l-1.6-1.2 2-3.4 1.9.8a7 7 0 0 1 1.7-1L11 3h4l.4 2.7a7 7 0 0 1 1.7 1l1.9-.8 2 3.4-1.6 1.2a7 7 0 0 1 0 3Z",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  layers: "m12 3 9 5-9 5-9-5 9-5ZM3 12.5l9 5 9-5M3 16.5l9 5 9-5",
  list: "M8 6h13M8 12h13M8 18h13M3.5 6v.01M3.5 12v.01M3.5 18v.01",
  minus: "M5 12h14",
  pin: "M9 3h6l-1 6 4 4v2h-5v6l-1 1-1-1v-6H6v-2l4-4-1-6Z",
  plus: "M12 5v14M5 12h14",
  radio: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 9.500a2.500 2.500 0 1 0 0 5 2.500 2.500 0 0 0 0-5Z",
  refresh: "M20 11a8 8 0 0 0-14-4.6L4 8.500M4 4v4.500h4.500M4 13a8 8 0 0 0 14 4.600l2-2.100M20 20v-4.500h-4.500",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20.500 20.500 16 16",
  shirt: "M8 3 3 6l2 5 2-1v11h10V10l2 1 2-5-5-3c-.5 1.800-2 3-4 3S8.500 4.800 8 3Z",
  target: "M12 4.500a7.500 7.500 0 1 0 0 15 7.500 7.500 0 0 0 0-15ZM12 2v4.500M12 17.500V22M2 12h4.500M17.500 12H22",
  wrench: "M15 3.500a5.500 5.500 0 0 0-5.200 7.300L3.500 17v3.500H7l6.200-6.300A5.500 5.500 0 0 0 20.500 8l-3.300 3.300-3.500-1-1-3.500L16 3.600a5.500 5.500 0 0 0-1-.1Z",
  x: "M6 6l12 12M18 6 6 18",
};

export function icon(name, size = 16) {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${PATHS[name]}"/></svg>`;
}
