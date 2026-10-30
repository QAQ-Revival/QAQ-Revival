import React from "react";

// A popover anchored to a trigger. Content stays mounted (hidden) so actions keep their state.
function Menu({
  trigger,
  label,
  align = "end",
  className = "",
  minWidth,
  children,
  closeOnSelect = true,
  ...rest
}) {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState(null);
  const anchor = React.useRef(null);
  const panel = React.useRef(null);
  const close = React.useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) anchor.current?.querySelector("button")?.focus();
  }, []);
  React.useLayoutEffect(() => {
    if (!open) return;
    const rect = anchor.current.getBoundingClientRect();
    const width = panel.current?.offsetWidth || 200;
    const left =
      align === "start"
        ? Math.min(rect.left, window.innerWidth - width - 12)
        : Math.max(12, rect.right - width);
    setPosition({ top: rect.bottom + 6, left: Math.max(12, left) });
  }, [open, align]);
  React.useEffect(() => {
    if (!open) return;
    const dismiss = (event) => {
      if (
        !anchor.current?.contains(event.target) &&
        !panel.current?.contains(event.target)
      )
        close();
    };
    const key = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close(true);
      }
    };
    const resize = () => close();
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", key, true);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", key, true);
      window.removeEventListener("resize", resize);
    };
  }, [open, close]);
  function handleKeyDown(event) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = [
      ...panel.current.querySelectorAll("button:not(:disabled), a[href]"),
    ];
    if (!items.length) return;
    event.preventDefault();
    const index = items.indexOf(document.activeElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : event.key === "ArrowDown"
            ? (index + 1) % items.length
            : (index - 1 + items.length) % items.length;
    items[next].focus();
  }
  return (
    <div className="menu-anchor" ref={anchor}>
      {trigger({
        open,
        toggle: () => setOpen((value) => !value),
        props: {
          "aria-haspopup": "menu",
          "aria-expanded": open,
          onClick: () => setOpen((value) => !value),
          onKeyDown: (event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              requestAnimationFrame(() =>
                panel.current?.querySelector("button:not(:disabled)")?.focus(),
              );
            }
          },
        },
      })}
      <div
        ref={panel}
        className={`menu ${className}`.trim()}
        role="menu"
        aria-label={label}
        hidden={!open}
        style={{ ...position, minWidth, visibility: position ? void 0 : "hidden" }}
        onKeyDown={handleKeyDown}
        onClickCapture={(event) => {
          if (closeOnSelect && event.target.closest("button")) setOpen(false);
        }}
        {...rest}
      >
        {children}
      </div>
    </div>
  );
}

function MenuItem({ icon, hint, danger = false, children, className = "", ...rest }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`menu-item${danger ? " menu-item-danger" : ""} ${className}`.trim()}
      {...rest}
    >
      {icon}
      {hint ? (
        <span className="menu-item-copy">
          <span>{children}</span>
          <span className="menu-item-hint">{hint}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
export { Menu, MenuItem };
