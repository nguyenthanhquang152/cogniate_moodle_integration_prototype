import { IntegrationLogo } from "../IntegrationLogo.tsx";
import { useEffect } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { ConnectionSetup } from "./ConnectionSetup.tsx";
import { ProviderSetup } from "./ProviderSetup.tsx";
import { ChannelScope, useChannels } from "../channels/context.tsx";
import { visibleChannels } from "../channels/registry.ts";
import { useApi } from "../hooks.ts";
import type { LmsProvidersResponse } from "../types.ts";
import { ErrorNotice, Loading } from "../ui.tsx";
import { NotFound } from "../NotFound.tsx";

export function Connect() {
  const { channelId = "", connectionId } = useParams();
  const { registry } = useChannels();
  const manifest = registry.channel(channelId);
  const providers = useApi<LmsProvidersResponse>("/lms-providers");
  const lms = channelId;
  const navigate = useNavigate();
  const location = useLocation();
  const opener =
    (location.state as { opener?: string } | null)?.opener ??
    `${lms}-${connectionId ? "manage" : "connect"}`;
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
  if (!manifest) return <NotFound />;
  if (manifest.availability === "simulation-only") {
    if (!providers.data) return providers.error ? <ErrorNotice error={providers.error} /> : <Loading />;
    if (!visibleChannels(registry, providers.data.lms).some((entry) => entry.id === channelId)) return <NotFound />;
  }
  return (
    <div className="connect-page">
      <Link
        className="inline-flex items-center gap-2 text-[12px] text-[#c9bdd9] no-underline"
        to="/integrations"
        state={{ focus: opener }}
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Integrations
      </Link>
      <div className="mt-[26px] mb-[30px] [&_h1]:mt-[7px] [&_h1]:mb-2.5 [&_p:not(.eyebrow)]:text-muted-foreground flex items-center gap-[18px]">
        <IntegrationLogo large name={manifest.card.title} mark={manifest.card.mark} icon={manifest.card.icon} color={manifest.card.color} />
        <div>
          <p className="eyebrow mb-[5px] text-[10px] font-semibold tracking-[0.15em] text-[#b3a4c6]">
            LMS PUBLISHING
          </p>
          <h1 tabIndex={-1}>
            {connectionId ? "Manage" : "Connect"} {manifest.names.text}
          </h1>
          <p>Bring your course library to your {manifest.names.text} site.</p>
        </div>
      </div>
      {/* The route's channel is also the connection's channel: ConnectionSetup shows no connection of another channel. */}
      <ChannelScope manifest={manifest}>
        {connectionId ? (
          <ConnectionSetup key={`${lms}:${connectionId}`} id={connectionId} lms={lms} opener={opener} />
        ) : <ProviderSetup key={`${lms}:new`} lms={lms} connection={null} opener={opener}
          onCreated={(connection) => navigate(`/integrations/${lms}/${connection.id}`, { replace: true, state: { opener } })}
          onChanged={() => undefined} />}
      </ChannelScope>
    </div>
  );
}
