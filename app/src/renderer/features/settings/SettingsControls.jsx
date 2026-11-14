import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
import { Icon } from "../../components/Icon.jsx";

function Button({
  children,
  primary,
  danger,
  ghost,
  small,
  className = "",
  ...props
}) {
  const classes = ["btn", "system-button"];
  if (primary) classes.push("btn-primary");
  if (danger) classes.push("btn-danger");
  if (ghost) classes.push("btn-ghost");
  if (small) classes.push("btn-sm");
  if (className) classes.push(className);
  return (
    <button type="button" className={classes.join(" ")} {...props}>
      {children}
    </button>
  );
}

// One page of settings. Pages stay mounted once opened, so work in progress survives a visit elsewhere.
function Page({ id, active = true, children }) {
  return (
    <div className="settings-page" data-page={id} hidden={!active}>
      {children}
    </div>
  );
}

function PageHead({ title, description, actions }) {
  return (
    <header className="settings-page-head">
      <div className="settings-page-heading">
        <h1 className="settings-page-title">{title}</h1>
        {description && <p className="settings-page-desc">{description}</p>}
      </div>
      {actions && <div className="settings-page-actions">{actions}</div>}
    </header>
  );
}

// A titled group. Its rows sit on one card; `plain` leaves the body bare for content that brings its own cards.
function Section({ id, title, description, actions, plain = false, children }) {
  return (
    <section
      id={`settings-${id}`}
      className="settings-section"
      aria-labelledby={title ? `heading-${id}` : undefined}
    >
      {(title || actions) && (
        <div className="settings-section-head">
          {title && (
            <h2 id={`heading-${id}`} className="settings-section-title">
              {title}
            </h2>
          )}
          {actions && <div className="settings-section-actions">{actions}</div>}
        </div>
      )}
      {description && <p className="settings-section-desc">{description}</p>}
      <div className={plain ? "settings-stack" : "settings-card"}>{children}</div>
    </section>
  );
}

// A versioned component: who it is on top, one line per variant below.
function ComponentCard({
  name,
  tag,
  badge,
  description,
  actions,
  rows,
  children,
  ...rest
}) {
  return (
    <article className="component-card" {...rest}>
      <header className="component-head">
        <div className="component-identity">
          <div className="component-name">
            {name}
            {tag && <span className="badge">{tag}</span>}
            {badge}
          </div>
          {description && <p className="component-desc">{description}</p>}
        </div>
        {actions && <div className="component-actions">{actions}</div>}
      </header>
      {rows && (
        <div className="component-versions" role="table">
          <div className="version-row is-head" role="row">
            <span role="columnheader">{t("settings.versions.variant")}</span>
            <span role="columnheader">{t("settings.versions.local")}</span>
            <span role="columnheader">{t("settings.versions.latest")}</span>
            <span role="columnheader" />
          </div>
          {rows}
        </div>
      )}
      {React.Children.toArray(children).length > 0 && (
        <div className="component-notes">{children}</div>
      )}
    </article>
  );
}

// `latest` is what the source offers; `status` says how the local copy compares to it.
function VersionRow({
  channel,
  name,
  inUse = false,
  local,
  build,
  latest,
  status,
  actions,
}) {
  const marks = {
    current: ["check", t("settings.versions.current")],
    update: ["arrow-up", t("settings.versions.updateAvailable")],
    error: ["alert", t("settings.versions.checkFailed")],
  };
  const mark = marks[status];
  return (
    <div
      className={`version-row${inUse ? " is-active" : ""}`}
      data-channel={channel}
      data-status={status}
      role="row"
    >
      <div className="version-name" role="cell">
        <span>{name}</span>
        {inUse && (
          <span className="badge badge-accent">{t("settings.versions.inUse")}</span>
        )}
      </div>
      <div className="version-local" role="cell">
        <span className="version-number">{local || "—"}</span>
        {build && (
          <span className="version-build" title={t("settings.versions.build")}>
            {build}
          </span>
        )}
      </div>
      <div className="version-latest" role="cell">
        {(latest || status !== "error") && (
          <span className="version-number">
            {latest || t("settings.versions.unchecked")}
          </span>
        )}
        {mark && (
          <span className="version-status">
            <Icon name={mark[0]} size={12} />
            {mark[1]}
          </span>
        )}
      </div>
      <div className="version-actions" role="cell">
        {actions}
      </div>
    </div>
  );
}

// A readiness list: one headline, then what was found for each requirement.
function Checks({ title, items, grid = false, actions }) {
  return (
    <div className="settings-checks" role="status">
      {(title || actions) && (
        <div className="settings-checks-head">
          {title && <div className="settings-checks-title">{title}</div>}
          {actions && <div className="settings-checks-actions">{actions}</div>}
        </div>
      )}
      <div className={`settings-checks-list${grid ? " is-grid" : ""}`}>
        {items.map((item) => (
          <div
            key={item.id}
            className={`settings-check ${item.ok ? "ready" : "missing"}`}
          >
            <Icon name={item.ok ? "check" : "minus"} size={13} />
            <span>
              <strong>{item.title + "："}</strong>
              {item.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// One row shape for every setting: copy on the left, control on the right.
function Row({
  title,
  description,
  hint,
  details,
  children,
  stacked = false,
  path = false,
}) {
  const classes = ["system-row"];
  if (stacked) classes.push("stacked");
  if (path) classes.push("is-path");
  return (
    <div className={classes.join(" ")}>
      <div className="system-row-copy" title={hint}>
        <div className="system-row-title">{title}</div>
        {description && <p>{description}</p>}
        {details}
      </div>
      {children && <div className="system-row-control">{children}</div>}
    </div>
  );
}

function PathValue({ label, value, placeholder }) {
  const empty = placeholder || t("common.status.unset");
  return (
    <input
      className="system-path"
      readOnly={true}
      value={value || ""}
      placeholder={empty}
      title={value || empty}
      aria-label={label}
    />
  );
}

function PathControl({ label, value, onSelect, disabled, children }) {
  return (
    <div className="path-control">
      <PathValue label={label} value={value} />
      {value && (
        <Button
          disabled={disabled}
          onClick={() => window.api.openPathInExplorer(value)}
          aria-label={t("common.actions.openNamedLocation", {
            label,
          })}
        >
          {t("common.actions.open")}
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
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`system-choice${value === option.value ? " active" : ""}`}
          aria-pressed={value === option.value}
          title={option.desc}
          onClick={() => onChange(option.value)}
          disabled={disabled || option.disabled}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Switch({ label, checked, onChange, disabled, ...rest }) {
  return (
    <input
      type="checkbox"
      role="switch"
      className={`toggle-switch-refined${checked ? " active" : ""}`}
      aria-label={label}
      checked={!!checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      {...rest}
    />
  );
}

const NOTICE_ICONS = {
  info: "info",
  success: "check",
  warning: "alert",
  danger: "alert",
};

function Notice({ kind, role, className = "", children }) {
  const classes = ["notice", "system-notice"];
  if (kind) classes.push(`notice-${kind}`);
  if (className) classes.push(className);
  return (
    <div className={classes.join(" ")} role={role}>
      <Icon name={NOTICE_ICONS[kind] || "info"} size={14} />
      <div className="settings-notice-body">{children}</div>
    </div>
  );
}

// Portaled so a custom wallpaper's translucent surfaces never reach the dialog.
function Dialog({
  title,
  description,
  className = "",
  onClose,
  busy = false,
  actions,
  children,
}) {
  const closeRef = React.useRef(onClose);
  const busyRef = React.useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;
  const panel = React.useRef(null);
  React.useEffect(() => {
    const previous = document.activeElement;
    const autofocus = panel.current?.querySelector("input, textarea, select");
    (autofocus || panel.current)?.focus();
    const onKey = (event) => {
      if (event.key !== "Escape" || busyRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      closeRef.current?.();
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      previous?.focus?.();
    };
  }, []);
  return ReactDOM.createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busyRef.current)
          closeRef.current?.();
      }}
    >
      <div
        ref={panel}
        className={`modal-content ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-busy={busy}
        tabIndex={-1}
      >
        <div className="dialog-title">{title}</div>
        {description && <div className="dialog-desc">{description}</div>}
        {children && <div className="dialog-body">{children}</div>}
        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </div>,
    document.body,
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
    <div className="settings-range">
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
      <div className="settings-range-editor">
        <input
          type="text"
          inputMode={step % 1 === 0 ? "numeric" : "decimal"}
          autoComplete="off"
          spellCheck={false}
          className="input settings-range-number"
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
        <span className="settings-range-unit">{suffix.trim()}</span>
      </div>
      {!isValid && (
        <small id={hintId} className="settings-error" role="alert">
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

export {
  check,
  Button,
  Page,
  PageHead,
  Section,
  ComponentCard,
  VersionRow,
  Checks,
  Row,
  Choices,
  Range,
  PathControl,
  PathValue,
  Switch,
  Notice,
  Dialog,
};
