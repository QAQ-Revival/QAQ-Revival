import { t } from "../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
function WindowControls() {
  const [state, setState] = React.useState({
    maximized: false,
    focused: true,
  });
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    let active = true;
    const update = (value) => {
      if (active && value?.success) setState(value);
    };
    const unsubscribe = window.api.onWindowState(update);
    window.api
      .getWindowState()
      .then(update)
      .catch(() => {});
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  async function control(action) {
    try {
      const result = await window.api.controlWindow(action);
      if (!result?.success)
        throw new Error(result?.error || t("native.window.failed"));
      setError("");
    } catch (failure) {
      setError(failure.message);
    }
  }
  function button(action, label, paths) {
    return (
      <button
        type="button"
        className={`window-control window-${action}`}
        title={label}
        aria-label={label}
        onClick={() => control(action)}
      >
        <svg
          width={12}
          height={12}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          aria-hidden={true}
        >
          {paths.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </svg>
      </button>
    );
  }
  return ReactDOM.createPortal(
    <header className="window-titlebar" data-focused={state.focused}>
      <div className="window-drag-region" aria-hidden={true} />
      {error && (
        <span className="window-control-error" role="alert">
          {error}
        </span>
      )}
      <div
        className="window-controls"
        role="group"
        aria-label={t("native.window.controls")}
      >
        {button("minimize", t("native.window.minimize"), ["M1 6.5h10"])}
        {button(
          "maximize",
          state.maximized
            ? t("native.window.restore")
            : t("native.window.maximize"),
          state.maximized
            ? ["M3.5 3.5v-2h7v7h-2", "M1.5 3.5h7v7h-7z"]
            : ["M1.5 1.5h9v9h-9z"],
        )}
        {button("close", t("native.window.close"), ["M1.5 1.5l9 9m0-9-9 9"])}
      </div>
    </header>,
    document.body,
  );
}
export { WindowControls };
