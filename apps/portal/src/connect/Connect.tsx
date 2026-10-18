import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  GraduationCap,
  Link2,
  ShieldCheck,
} from "lucide-react";
import { ApiError, api, idPath } from "../api.ts";
import { useApi } from "../hooks.ts";
import { useSession } from "../App.tsx";
import type { Connection, ToolRow } from "../types.ts";
import {
  ConnectionBadge,
  ConnectionError,
  CopyButton,
  ErrorNotice,
  Loading,
  Modal,
} from "../ui.tsx";
import { platformFields, siteError, validatePlatform } from "./validation.ts";
import type { PlatformKey, PlatformValues } from "./validation.ts";
import steps from "./moodle-steps.json";

export function MoodleSteps({ method }: { method: "dynamic" | "manual" }) {
  return (
    <ol className="moodle-steps">
      {steps[method].map((step) => (
        <li key={step.id} data-step-id={step.id}>
          <p>{step.text}</p>
          {step.menuPath.length > 0 && (
            <p className="menu-path">{step.menuPath.join(" → ")}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
export function Connect() {
  const { connectionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const opener =
    (location.state as { opener?: string } | null)?.opener ??
    (connectionId ? "moodle-manage" : "moodle-connect");
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) {
        event.preventDefault();
        navigate("/integrations", { state: { focus: opener } });
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [navigate, opener]);
  return (
    <div className="connect-page">
      <Link className="back-link" to="/integrations" state={{ focus: opener }}>
        <ArrowLeft size={16} aria-hidden="true" />
        Integrations
      </Link>
      <div className="page-heading heading-with-logo">
        <span className="integration-logo orange" aria-hidden="true">
          <GraduationCap size={28} />
        </span>
        <div>
          <p className="eyebrow">LMS PUBLISHING</p>
          <h1 tabIndex={-1}>
            {connectionId ? "Manage Moodle" : "Connect Moodle"}
          </h1>
          <p>Bring your course library to your Moodle site.</p>
        </div>
      </div>
      {connectionId ? (
        <ConnectionSetup key={connectionId} id={connectionId} />
      ) : (
        <CreateConnection
          opener={opener}
          onCreated={(id) =>
            navigate(`/integrations/moodle/${id}`, {
              replace: true,
              state: { opener },
            })
          }
        />
      )}
    </div>
  );
}
export function CreateConnection({
  onCreated,
  opener = "moodle-connect",
}: {
  onCreated: (id: string) => void;
  opener?: string;
}) {
  const [method, setMethod] = useState<"dynamic" | "manual">("dynamic");
  const [error, setError] = useState<unknown>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const siteUrl = String(data.get("siteUrl") ?? "").trim();
    const invalid = siteError(siteUrl);
    setFieldError(invalid);
    if (invalid) {
      form.querySelector<HTMLInputElement>('[name="siteUrl"]')?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const connection = await api<Connection>("/connections", {
        method: "POST",
        body: {
          name: String(data.get("name")).trim(),
          siteUrl: new URL(siteUrl).origin,
          method,
        },
      });
      onCreated(connection.id);
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="setup-layout">
      <section className="panel">
        <h2>Your Moodle site</h2>
        <p className="muted">
          You need a Moodle administrator to complete the connection.
        </p>
        <form className="stack" onSubmit={submit} noValidate={false}>
          <label>
            Connection name
            <input
              name="name"
              placeholder="Company Moodle"
              maxLength={100}
              required
              autoFocus
            />
          </label>
          <label>
            <span id="site-label">Moodle site URL</span>
            <input
              aria-labelledby="site-label"
              name="siteUrl"
              type="url"
              placeholder="https://moodle.test"
              required
              aria-invalid={!!fieldError}
              aria-describedby={fieldError ? "site-error" : "site-help"}
              onBlur={(event) => {
                if (event.target.value)
                  setFieldError(siteError(event.target.value));
              }}
            />
            <small id="site-help">
              Use the site origin. Do not add a course path.
            </small>
            {fieldError && (
              <span className="field-error" id="site-error">
                {fieldError}
              </span>
            )}
          </label>
          <fieldset>
            <legend>Connection method</legend>
            <div className="method-options">
              {(["dynamic", "manual"] as const).map((value) => (
                <label
                  className={`method-option ${method === value ? "selected" : ""}`}
                  key={value}
                >
                  <input
                    type="radio"
                    name="method"
                    value={value}
                    checked={method === value}
                    onChange={() => setMethod(value)}
                  />
                  <span>
                    <strong>
                      {value === "dynamic"
                        ? "Automatic (recommended)"
                        : "Manual"}
                    </strong>
                    <small>
                      {value === "dynamic"
                        ? "Copy one registration URL into Moodle."
                        : "Copy tool settings and enter six Moodle values."}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <ErrorNotice error={error} />
          <div className="actions">
            <button disabled={busy} className="button primary">
              {busy ? "Creating connection…" : "Continue"}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            <Link
              className="button secondary"
              to="/integrations"
              state={{ focus: opener }}
            >
              Cancel
            </Link>
          </div>
        </form>
      </section>
      <aside className="setup-aside">
        <ShieldCheck size={26} aria-hidden="true" />
        <h2>Private by default</h2>
        <p>Moodle does not send learner names or emails.</p>
        <p>
          Teachers select your courses in Moodle. Grades return after learners
          complete a course.
        </p>
        <span className="badge">LTI 1.3 Advantage</span>
      </aside>
    </div>
  );
}
function ConnectionSetup({ id }: { id: string }) {
  const { library } = useSession();
  const {
    data: connection,
    setData,
    error,
    reload,
  } = useApi<Connection>(`/connections/${idPath(id)}`, 5000);
  const list = useApi<{ connections: Connection[] }>("/connections");
  const [actionError, setActionError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [disconnect, setDisconnect] = useState(false);
  const navigate = useNavigate();
  if (!connection)
    return (
      <>
        <ErrorNotice error={error} />
        {!error && <Loading />}
      </>
    );
  const pending = connection.status === "pending";
  return (
    <div className="stack">
      <section className="panel connection-overview">
        <div>
          <h2>{connection.name}</h2>
          <p className="muted">{connection.siteUrl}</p>
        </div>
        <div role="status">
          <ConnectionBadge connection={connection} />
        </div>
        <label className="connection-select">
          <span id="manage-connection-label">Moodle connection</span>
          <select
            aria-labelledby="manage-connection-label"
            value={id}
            onChange={(event) =>
              navigate(`/integrations/moodle/${event.target.value}`)
            }
          >
            {(list.data?.connections ?? [connection]).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.siteUrl}
              </option>
            ))}
          </select>
        </label>
      </section>
      <ErrorNotice error={error} />
      <ConnectionError connection={connection} />
      <ErrorNotice error={actionError} />
      {pending ? (
        <>
          {connection.method === "dynamic" ? (
            <section className="panel stack">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">STEP 1 · REGISTRATION URL</p>
                  <h2>Copy this URL to Moodle</h2>
                </div>
                <Link2 size={22} aria-hidden="true" />
              </div>
              {connection.registrationUrl && (
                <div className="copy-value">
                  <label htmlFor="registration-url" className="sr-only">
                    Registration URL
                  </label>
                  <input
                    id="registration-url"
                    readOnly
                    value={connection.registrationUrl}
                    onFocus={(event) => event.target.select()}
                  />
                  <CopyButton
                    value={connection.registrationUrl}
                    label="registration URL"
                  />
                </div>
              )}
              <p className="muted">
                This URL works once. It expires{" "}
                {connection.registrationUrlExpiresAt
                  ? new Date(
                      connection.registrationUrlExpiresAt,
                    ).toLocaleString()
                  : "after 24 hours"}
                .
              </p>
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setActionError(null);
                  try {
                    const next = await api<{
                      registrationUrl: string;
                      expiresAt: string;
                    }>(`/connections/${idPath(id)}/registration-url`, {
                      method: "POST",
                    });
                    setData({
                      ...connection,
                      registrationUrl: next.registrationUrl,
                      registrationUrlExpiresAt: next.expiresAt,
                    });
                  } catch (reason) {
                    setActionError(reason);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Make a new URL
              </button>
              <div className="section-divider">
                <h2>Complete the steps in Moodle</h2>
                <MoodleSteps method="dynamic" />
              </div>
              <p className="notice">
                If the connection failed and Moodle shows a Pending tool
                'Cogniate ({library.name})' that you did not activate, delete it
                in Manage tools and connect again.
              </p>
              <p className="muted" role="status">
                Waiting for Moodle. Status updates every 5 seconds.
              </p>
            </section>
          ) : (
            <ManualSetup connection={connection} onRegistered={setData} />
          )}
        </>
      ) : connection.status !== "disabled" ? (
        <section className="panel stack">
          <h2>
            {connection.status === "registered"
              ? "Registered"
              : "Your library is connected"}
          </h2>
          {connection.status === "registered" && (
            <p>
              Open Manage tools in Moodle. Select Activate for Cogniate (
              {library.name}).
            </p>
          )}
          <p>The first launch from Moodle changes the status to Connected.</p>
          <div className="actions">
            <Link className="button primary" to="/libraries/courses">
              Go to Courses
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <a
              className="button secondary"
              href={`${connection.siteUrl}/mod/lti/toolconfigure.php`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Moodle
              <ExternalLink size={15} aria-hidden="true" />
            </a>
          </div>
        </section>
      ) : (
        <p className="notice">
          This connection is disconnected. Delete the old Cogniate tool in
          Moodle before you connect again.
        </p>
      )}
      {connection.status !== "disabled" && (
        <p className="notice">
          To reconnect, delete the old Cogniate tool in Moodle. Then disconnect
          this connection and connect again. Cogniate refuses every tool update.
        </p>
      )}
      <div className="actions">
        <Link className="button secondary" to="/integrations/moodle/connect">
          Connect another site
        </Link>
        {connection.status !== "disabled" && (
          <button
            className="text-button danger-text"
            onClick={() => setDisconnect(true)}
          >
            Disconnect
          </button>
        )}
        <button className="text-button" onClick={reload}>
          Refresh status
        </button>
      </div>
      {disconnect && (
        <Modal title="Disconnect Moodle?" onClose={() => setDisconnect(false)}>
          <p>
            This stops launches through this connection. The tool stays in
            Moodle.
          </p>
          <div className="actions">
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setActionError(null);
                try {
                  await api(`/connections/${idPath(id)}`, { method: "DELETE" });
                  setDisconnect(false);
                  reload();
                } catch (reason) {
                  setActionError(reason);
                  setDisconnect(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Disconnect
            </button>
            <button
              className="button secondary"
              onClick={() => setDisconnect(false)}
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
export function ManualSetup({
  connection,
  onRegistered,
}: {
  connection: Connection;
  onRegistered: (connection: Connection) => void;
}) {
  const { data: rows, error: configError } = useApi<ToolRow[]>(
    `/connections/${idPath(connection.id)}/tool-configuration`,
  );
  const [error, setError] = useState<unknown>(null);
  const [errors, setErrors] = useState<Partial<Record<PlatformKey, string>>>(
    {},
  );
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const values = Object.fromEntries(
      platformFields.map(({ key }) => [
        key,
        String(data.get(key) ?? "").trim(),
      ]),
    ) as PlatformValues;
    const invalid = validatePlatform(connection.siteUrl, values);
    setErrors(invalid);
    const first = platformFields.find(({ key }) => invalid[key]);
    if (first) {
      form.querySelector<HTMLInputElement>(`[name="${first.key}"]`)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onRegistered(
        await api<Connection>(
          `/connections/${idPath(connection.id)}/platform`,
          { method: "PUT", body: values },
        ),
      );
    } catch (reason) {
      setError(reason);
      if (reason instanceof ApiError && reason.details.fields) {
        const fields = reason.details.fields;
        setErrors(
          Object.fromEntries(
            (Array.isArray(fields) ? fields : Object.keys(fields)).map(
              (key) => [key, "Check this value in Moodle."],
            ),
          ),
        );
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel stack">
        <p className="eyebrow">STEP 1 · TOOL SETTINGS</p>
        <h2>Add Cogniate in Moodle</h2>
        <MoodleSteps method="manual" />
        <ErrorNotice error={configError} />
        {rows ? (
          <div className="table-scroll">
            <table className="tool-config">
              <caption>
                Tool configuration · Copy these values into Moodle, in this
                order.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Moodle setting</th>
                  <th scope="col">Value</th>
                  <th scope="col">Copy</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} data-key={row.key}>
                    <th scope="row">{row.label}</th>
                    <td>
                      <code>{row.value}</code>
                    </td>
                    <td>
                      <CopyButton value={row.value} label={row.label} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !configError && <Loading />
        )}
      </section>
      <section className="panel stack">
        <p className="eyebrow">STEP 2 · MOODLE VALUES</p>
        <h2>Paste the values from Moodle</h2>
        <p className="muted">
          Open the tool's configuration details in Manage tools.
        </p>
        <form className="stack" onSubmit={submit} noValidate>
          <div className="form-grid">
            {platformFields.map(({ key, label }) => (
              <label key={key}>
                <span id={`${key}-label`}>{label}</span>
                <input
                  aria-labelledby={`${key}-label`}
                  name={key}
                  required
                  type={
                    key === "clientId" || key === "deploymentId"
                      ? "text"
                      : "url"
                  }
                  defaultValue={key === "issuer" ? connection.siteUrl : ""}
                  maxLength={2048}
                  aria-invalid={!!errors[key]}
                  aria-describedby={errors[key] ? `${key}-error` : undefined}
                />
                {errors[key] && (
                  <span className="field-error" id={`${key}-error`}>
                    {errors[key]}
                  </span>
                )}
              </label>
            ))}
          </div>
          <ErrorNotice error={error} />
          <button className="button primary self-start" disabled={busy}>
            {busy ? "Connecting…" : "Connect Moodle"}
          </button>
        </form>
      </section>
    </>
  );
}
