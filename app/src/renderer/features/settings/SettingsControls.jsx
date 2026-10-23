import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
const ICONS = {
  sliders: ["M4 7h16M4 17h16M8 4v6M16 14v6"],
  palette: [
    "M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7 1.5 1.5 0 0 1 1-2.8h2A4 4 0 0 0 21 10a9 9 0 0 0-9-7",
    "M7 10h.01M10 6h.01M15 7h.01M6 14h.01",
  ],
  game: [
    "M7 7h10a3 3 0 0 1 3 2l2 8a2 2 0 0 1-3.4 1.8L15 16H9l-3.6 2.8A2 2 0 0 1 2 17l2-8a3 3 0 0 1 3-2",
    "M6 11h4M8 9v4M16 11h.01M18 13h.01",
  ],
  download: ["M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5"],
  keyboard: [
    "M3 5h18v14H3zM6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8",
  ],
  tool: [
    "M14 4a5 5 0 0 0-6 6L3 16a3 3 0 0 0 4 4l6-6a5 5 0 0 0 6-6l-3 3-3-3 3-3z",
  ],
  info: ["M12 8h.01M12 11v6", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0"],
};
function Icon({ name }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={true}
    >
      {(ICONS[name] || ICONS.info).map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
function Button({ children, primary, ...props }) {
  return (
    <button
      type="button"
      className={`system-button${primary ? " primary" : ""}`}
      {...props}
    >
      {children}
    </button>
  );
}
function Section({ id, title, children }) {
  return (
    <section
      id={`settings-${id}`}
      className="system-section"
      aria-labelledby={`heading-${id}`}
    >
      <h3 id={`heading-${id}`}>{title}</h3>
      <div className="system-card">{children}</div>
    </section>
  );
}
function Row({ title, description, details, children, stacked = false }) {
  return (
    <div className={`system-row${stacked ? " stacked" : ""}`}>
      <div className="system-row-copy">
        <div className="system-row-title">{title}</div>
        {description && <p>{description}</p>}
        {details}
      </div>
      {children && <div className="system-row-control">{children}</div>}
    </div>
  );
}
function PathControl({ label, value, onSelect, disabled, children }) {
  return (
    <div className="system-path-control">
      <input
        className="system-path"
        readOnly={true}
        value={value || ""}
        placeholder={t("common.status.unset")}
        title={value || t("common.status.unset")}
        aria-label={label}
      />
      {value && (
        <Button
          disabled={disabled}
          onClick={() => window.api.openPathInExplorer(value)}
          aria-label={t("common.actions.openNamedLocation", {
            label,
          })}
        >
          {t("common.actions.openLocation")}
        </Button>
      )}
      {children}
      {onSelect && (
        <Button
          disabled={disabled}
          onClick={onSelect}
          aria-label={t("common.actions.selectNamed", {
            label,
          })}
        >
          {t("common.actions.select")}
        </Button>
      )}
    </div>
  );
}
function Choices({ label, value, options, onChange, disabled }) {
  return (
    <div className="system-choices" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="system-choice"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          disabled={disabled}
        >
          <strong>{option.label}</strong>
          {option.desc && <span>{option.desc}</span>}
        </button>
      ))}
    </div>
  );
}
function Range({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix = "%",
  disabled,
}) {
  const [draft, setDraft] = React.useState(String(value));
  const saving = React.useRef(false);
  const hintId = React.useId();
  React.useEffect(() => {
    setDraft(String(value));
  }, [value]);
  function valid(text) {
    if (!/^\d+(?:\.\d+)?$/.test(text)) return false;
    const number = Number(text);
    const steps = (number - min) / step;
    return (
      Number.isFinite(number) &&
      number >= min &&
      number <= max &&
      Math.abs(steps - Math.round(steps)) < 1e-8
    );
  }
  const isValid = valid(draft);
  async function commit(text) {
    if (disabled || saving.current || !valid(text) || Number(text) === value)
      return;
    saving.current = true;
    try {
      await onChange(Number(text));
    } finally {
      saving.current = false;
    }
  }
  return (
    <div className="system-range">
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={isValid ? Number(draft) : value}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onPointerUp={(e) => commit(e.currentTarget.value)}
        onKeyUp={(e) => commit(e.currentTarget.value)}
        onBlur={(e) => commit(e.currentTarget.value)}
        onPointerCancel={() => setDraft(String(value))}
      />
      <div className="system-range-editor">
        <input
          type="text"
          inputMode={step % 1 === 0 ? "numeric" : "decimal"}
          autoComplete="off"
          spellCheck={false}
          className={`system-range-number ${isValid ? "is-valid" : "is-invalid"}`}
          aria-label={t("settings.range.valueLabel", {
            label,
          })}
          aria-invalid={!isValid}
          aria-describedby={!isValid ? hintId : undefined}
          title={t("settings.range.saveHint")}
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(e.currentTarget.value);
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setDraft(String(value));
            }
          }}
        />
        <span className="system-range-unit">{suffix.trim()}</span>
      </div>
      {!isValid && (
        <small id={hintId} className="system-range-error" role="alert">
          {t("settings.range.invalidHint", {
            min,
            max,
            status:
              step === 1
                ? t("settings.range.integerSuffix")
                : t("settings.range.stepSuffix", {
                    step,
                  }),
          })}
        </small>
      )}
    </div>
  );
}
function check(result) {
  if (!result?.success)
    throw new Error(result?.error || t("common.errors.operationFailed"));
  return result;
}
export { check, Button, Section, Row, Choices, Range, PathControl, Icon };
