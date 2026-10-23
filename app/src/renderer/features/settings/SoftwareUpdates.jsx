import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
const h = (...args) => React.createElement(...args);
function useUpdateState() {
  const [state, setState] = React.useState(null),
    [error, setError] = React.useState("");
  React.useEffect(() => {
    let current = true;
    window.api
      .softwareUpdateState()
      .then((result) => {
        if (!current) return;
        if (result.success) setState(result.state);
        else setError(result.error);
      })
      .catch((error) => {
        if (current) setError(error.message);
      });
    const off = window.api.onSoftwareUpdateState((next) => {
      if (current) setState(next);
    });
    return () => {
      current = false;
      off?.();
    };
  }, []);
  return {
    state,
    setState,
    error,
    setError,
  };
}
function SoftwareUpdateSettings() {
  const { state, setState, error, setError } = useUpdateState();
  const [busy, setBusy] = React.useState(false),
    [days, setDays] = React.useState("1");
  React.useEffect(() => {
    if (state) setDays(String(state.intervalDays));
  }, [state?.intervalDays]);
  const validDays =
    /^\d+$/.test(days) && Number(days) >= 1 && Number(days) <= 365;
  async function request(method, value) {
    setBusy(true);
    setError("");
    try {
      const result = await window.api[method](value);
      if (!result?.success)
        throw Error(result?.error || t("settings.updates.failed"));
      setState(result.state);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  const configure = (enabled) =>
    request("softwareUpdateConfigure", {
      enabled,
      intervalDays: Number(days),
    });
  function saveDays() {
    if (state && validDays && Number(days) !== state.intervalDays && !busy)
      configure(state.enabled);
  }
  return h(
    "section",
    {
      className: "system-section",
      id: "settings-software-update",
      "aria-labelledby": "software-update-title",
    },
    h(
      "h3",
      {
        id: "software-update-title",
      },
      t("settings.updates.title"),
    ),
    h(
      "div",
      {
        className: "system-card",
      },
      !state
        ? h("p", null, error || t("settings.updates.loading"))
        : h(
            React.Fragment,
            null,
            h(
              "div",
              {
                className: "system-row",
              },
              h(
                "div",
                {
                  className: "system-row-copy",
                },
                h(
                  "div",
                  {
                    className: "system-row-title",
                  },
                  t("settings.updates.automatic"),
                ),
                h("p", null, t("settings.updates.automaticDescription")),
              ),
              h("input", {
                type: "checkbox",
                role: "switch",
                className: "system-switch",
                "aria-label": t("settings.updates.automaticLabel"),
                checked: state.enabled,
                disabled: busy,
                onChange: (event) =>
                  request("softwareUpdateConfigure", {
                    enabled: event.target.checked,
                    intervalDays: state.intervalDays,
                  }),
              }),
            ),
            h(
              "div",
              {
                className: "system-row",
              },
              h(
                "div",
                {
                  className: "system-row-copy",
                },
                h(
                  "div",
                  {
                    className: "system-row-title",
                  },
                  t("settings.updates.frequency"),
                ),
                h("p", null, t("settings.updates.frequencyDescription")),
              ),
              h(
                "label",
                {
                  className: "software-update-frequency",
                },
                t("settings.updates.everyPrefix"),
                h("input", {
                  type: "text",
                  inputMode: "numeric",
                  "aria-label": t("settings.updates.intervalLabel"),
                  "aria-invalid": !validDays,
                  value: days,
                  disabled: busy || !state.enabled,
                  onChange: (event) => setDays(event.target.value),
                  onBlur: saveDays,
                  onKeyDown: (event) => {
                    if (event.key === "Enter") saveDays();
                    if (event.key === "Escape")
                      setDays(String(state.intervalDays));
                  },
                }),
                t("settings.updates.daysSuffix"),
              ),
            ),
            !validDays &&
              h(
                "p",
                {
                  className: "system-range-error",
                  role: "alert",
                },
                t("settings.updates.intervalInvalid"),
              ),
            h(
              "div",
              {
                className: "system-row stacked",
              },
              h(
                "p",
                {
                  className: "software-update-summary",
                  role: "status",
                },
                state.checking
                  ? t("settings.updates.checkingGitHub")
                  : state.updateAvailable
                    ? t("settings.updates.available", {
                        version: state.release.version,
                        currentVersion: state.currentVersion,
                      })
                    : state.noRelease
                      ? t("settings.updates.noReleases")
                      : state.lastCheckedAt
                        ? t("settings.updates.currentVersion", {
                            currentVersion: state.currentVersion,
                          })
                        : t("settings.updates.uncheckedVersion", {
                            currentVersion: state.currentVersion,
                          }),
              ),
              h(
                "small",
                null,
                state.lastCheckedAt
                  ? t("settings.updates.lastChecked", {
                      value: new Date(state.lastCheckedAt).toLocaleString(
                        "zh-CN",
                      ),
                    })
                  : "",
              ),
              (error || state.error) &&
                h(
                  "p",
                  {
                    className: "system-range-error",
                    role: "alert",
                  },
                  error || state.error,
                ),
              h(
                "div",
                {
                  className: "software-update-actions",
                },
                h(
                  "button",
                  {
                    type: "button",
                    className: "system-button primary",
                    disabled: busy || state.checking,
                    onClick: () => request("softwareUpdateCheck"),
                  },
                  state.checking
                    ? t("settings.updates.checking")
                    : t("settings.updates.checkNow"),
                ),
                state.release &&
                  h(
                    "button",
                    {
                      type: "button",
                      className: "system-button",
                      onClick: () => request("softwareUpdateOpenRelease"),
                    },
                    t("settings.updates.openRelease"),
                  ),
              ),
            ),
          ),
    ),
  );
}
function SoftwareUpdateNotice() {
  const { state, setState } = useUpdateState();
  if (
    !state?.updateAvailable ||
    state.release.version === state.dismissedVersion
  )
    return null;
  return h(
    "div",
    {
      className: "software-update-notice",
      role: "status",
    },
    h(
      "span",
      null,
      t("settings.updates.notice", {
        version: state.release.version,
      }),
    ),
    h(
      "button",
      {
        type: "button",
        onClick: () => window.api.softwareUpdateOpenRelease(),
      },
      t("settings.updates.viewUpdate"),
    ),
    h(
      "button",
      {
        type: "button",
        "aria-label": t("settings.updates.dismissVersion"),
        onClick: async () => {
          const result = await window.api.softwareUpdateDismiss(
            state.release.version,
          );
          if (result.success) setState(result.state);
        },
      },
      "×",
    ),
  );
}
export { SoftwareUpdateSettings, SoftwareUpdateNotice };
