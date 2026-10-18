import { Badge } from "../ui/badge.tsx";
import { Button, buttonVariants } from "../ui/button.tsx";
import { Input } from "../ui/input.tsx";
import { Card } from "../ui/card.tsx";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { api } from "../api.ts";
import type { Connection } from "../types.ts";
import { ErrorNotice } from "../ui.tsx";
import { siteError } from "./validation.ts";

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
    <div className="grid grid-cols-[minmax(0,1fr)_250px] gap-9 max-[1100px]:grid-cols-1 [&>[data-slot=card]>h2]:mb-2 [&>[data-slot=card]>p]:mb-6">
      <Card>
        <h2>Your Moodle site</h2>
        <p className="text-muted-foreground">
          You need a Moodle administrator to complete the connection.
        </p>
        <form
          className="flex flex-col gap-5"
          onSubmit={submit}
          noValidate={false}
        >
          <label>
            Connection name
            <Input
              name="name"
              placeholder="Company Moodle"
              maxLength={100}
              required
              autoFocus
            />
          </label>
          <label>
            <span id="site-label">Moodle site URL</span>
            <Input
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
              <span className="text-[#ffafb9]" id="site-error">
                {fieldError}
              </span>
            )}
          </label>
          <fieldset>
            <legend>Connection method</legend>
            <div className="grid gap-3">
              {(["dynamic", "manual"] as const).map((value) => (
                <label
                  data-selected={method === value}
                  className="flex flex-row items-center gap-3 rounded-[9px] border border-border p-4 cursor-pointer [&_small]:mt-1 [&_small]:block data-[selected=true]:border-[#a976e6] data-[selected=true]:bg-[#b18ae811]"
                  key={value}
                >
                  <Input
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
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" disabled={busy}>
              {busy ? "Creating connection…" : "Continue"}
              <ArrowRight size={16} aria-hidden="true" />
            </Button>
            <Link
              className={buttonVariants({
                variant: "secondary",
                size: "default",
              })}
              to="/integrations"
              state={{ focus: opener }}
            >
              Cancel
            </Link>
          </div>
        </form>
      </Card>
      <aside
        aria-label="Connection privacy"
        className="flex flex-col items-start gap-[18px] py-5 text-[13px] text-muted-foreground [&>svg]:text-[#c4a0f4] [&_h2]:text-[#eee7f7] max-[1100px]:hidden"
      >
        <ShieldCheck size={26} aria-hidden="true" />
        <h2>Private by default</h2>
        <p>Moodle does not send learner names or emails.</p>
        <p>
          Teachers select your courses in Moodle. Grades return after learners
          complete a course.
        </p>
        <Badge>LTI 1.3 Advantage</Badge>
      </aside>
    </div>
  );
}
