import { Button } from "../ui/button.tsx";
import { Input } from "../ui/input.tsx";
import { Card } from "../ui/card.tsx";
import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, api, idPath } from "../api.ts";
import { useApi } from "../hooks.ts";
import type { Connection, ToolRow } from "../types.ts";
import { CopyButton, ErrorNotice, Loading } from "../ui.tsx";
import { platformFields, validatePlatform } from "./validation.ts";
import type { PlatformKey, PlatformValues } from "./validation.ts";
import { MoodleSteps } from "./MoodleSteps.tsx";

export function ManualSetup({
  connection,
  onRegistered,
  libraryName,
}: {
  connection: Connection;
  libraryName: string;
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
      <Card className="flex flex-col gap-5">
        <p className="eyebrow mb-[5px] text-[10px] font-semibold tracking-[0.15em] text-[#b3a4c6]">
          STEP 1 · TOOL SETTINGS
        </p>
        <h2>Add Cogniate in Moodle</h2>
        <MoodleSteps method="manual" libraryName={libraryName} />
        <ErrorNotice error={configError} />
        {rows ? (
          <div className="overflow-x-auto">
            <table className="[&_th:first-child]:w-[32%] [&_code]:text-[12px] [&_code]:text-[#d6c9e6] [&_code]:[word-break:break-word]">
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
      </Card>
      <Card className="flex flex-col gap-5">
        <p className="eyebrow mb-[5px] text-[10px] font-semibold tracking-[0.15em] text-[#b3a4c6]">
          STEP 2 · MOODLE VALUES
        </p>
        <h2>Paste the values from Moodle</h2>
        <p className="text-muted-foreground">
          Open the tool's configuration details in Manage tools.
        </p>
        <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
          <div className="grid grid-cols-2 gap-[22px] max-[720px]:grid-cols-1">
            {platformFields.map(({ key, label }) => (
              <label key={key}>
                <span id={`${key}-label`}>{label}</span>
                <Input
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
                  <span className="text-[#ffafb9]" id={`${key}-error`}>
                    {errors[key]}
                  </span>
                )}
              </label>
            ))}
          </div>
          <ErrorNotice error={error} />
          <Button variant="primary" className="self-start" disabled={busy}>
            {busy ? "Connecting…" : "Connect Moodle"}
          </Button>
        </form>
      </Card>
    </>
  );
}
