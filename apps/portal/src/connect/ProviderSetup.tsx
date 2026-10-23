import { useSession } from "../App.tsx";
import { useApi } from "../hooks.ts";
import { BLACKBOARD_NOT_READY, lmsNames } from "../lms.ts";
import type { Connection, LmsProvidersResponse } from "../types.ts";
import { ErrorNotice, Loading } from "../ui.tsx";
import { Button } from "../ui/button.tsx";
import { Notice } from "../ui/notice.tsx";
import type { ApprovalLms } from "./wizard-types.ts";
import { providerWizards } from "./wizards.ts";

export function ProviderSetup({ lms, connection, opener, onCreated, onChanged }: {
  lms: ApprovalLms;
  connection: Connection | null;
  opener: string;
  onCreated: (connection: Connection) => void;
  onChanged: (connection: Connection) => void;
}) {
  const { library } = useSession();
  const { data, error, reload } = useApi<LmsProvidersResponse>("/lms-providers");
  const provider = data?.lms.find((item) => item.lms === lms);
  const wizard = providerWizards[lms];
  if (error) return <><ErrorNotice error={error} /><Button variant="link" onClick={reload}>Try again</Button></>;
  if (!data) return <Loading />;
  if (!provider || ((!connection || connection.status === "pending") && !provider.profiles.some((p) => p.ready)))
    return <Notice>{lms === "blackboard" ? BLACKBOARD_NOT_READY : "Canvas is not set up for this Cogniate service yet. Ask your Cogniate operator."}</Notice>;
  if (!wizard) return <Notice>{lmsNames[lms]} connection setup is unavailable. Reload the page to try again.</Notice>;
  return <wizard.Wizard key={`${lms}:${connection?.id ?? "new"}`} provider={provider} connection={connection}
    libraryName={library.name} opener={opener} onCreated={onCreated} onChanged={onChanged} />;
}
