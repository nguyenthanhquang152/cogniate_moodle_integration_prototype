import { useNavigate } from "react-router";
import { useSession } from "../App.tsx";
import { useApi } from "../hooks.ts";
import type { Connection, LmsProvidersResponse } from "../types.ts";
import { ErrorNotice, Loading } from "../ui.tsx";
import { Button } from "../ui/button.tsx";
import { Notice } from "../ui/notice.tsx";
import { useChannels } from "../channels/context.tsx";
import { channelOf, channelText } from "../channels/registry.ts";
import { ManifestWizard } from "../channels/ManifestWizard.tsx";
import { createPortalSdk } from "../sdk/index.ts";
import { NotFound } from "../NotFound.tsx";

export function ProviderSetup({ lms, connection, opener, onCreated, onChanged }: {
  lms: string; connection: Connection | null; opener: string;
  onCreated: (connection: Connection) => void; onChanged: (connection: Connection) => void;
}) {
  const session = useSession();
  const navigate = useNavigate();
  const { registry, modules } = useChannels();
  const { data, error, reload } = useApi<LmsProvidersResponse>("/lms-providers");
  const manifest = registry.channel(lms);
  if (!manifest) return <NotFound />;
  const provider = data?.lms.find((item) => channelOf(item) === lms);
  if (error) return <><ErrorNotice error={error} /><Button variant="link" onClick={reload}>Try again</Button></>;
  if (!data) return <Loading />;
  if (!provider || ((!connection || connection.status === "pending") && !provider.profiles.some((profile) => profile.ready)))
    return <Notice>{channelText(manifest, manifest.texts.notReady ?? "{LMS} is not set up for this Cogniate service yet. Ask your Cogniate operator.")}</Notice>;
  const module = modules.get(lms);
  const props = { provider, connection, libraryName: session?.library.name ?? "", opener, onCreated, onChanged, sdk: createPortalSdk(navigate) };
  return module?.Wizard ? <module.Wizard {...props} /> : <ManifestWizard manifest={manifest} module={module} {...props} />;
}
