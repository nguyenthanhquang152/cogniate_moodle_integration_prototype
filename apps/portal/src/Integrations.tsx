import { Tabs } from "./ui/tabs.tsx";
import { IntegrationLogo } from "./IntegrationLogo.tsx";
import { useSession } from "./App.tsx";
import { Card } from "./ui/card.tsx";
import { Button, buttonVariants } from "./ui/button.tsx";
import { useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, Plus } from "lucide-react";
import { useApi } from "./hooks.ts";
import type { Connection, LmsProvidersResponse } from "./types.ts";
import { channelOf, channelText, visibleChannels, channelProvider } from "./channels/registry.ts";
import { useChannels } from "./channels/context.tsx";
import {
  ConnectionBadge,
  ConnectionError,
  ErrorNotice,
  Loading,
} from "./ui.tsx";

const filters = ["All", "LMS Publishing", "LLM/AI", "Creative", "Knowledge"];
const staticIntegrations = [
  {
    name: "Kajabi",
    mark: "K",
    category: "LMS Publishing",
    color: "blue",
    description:
      "Publish and sell your courses directly on Kajabi with seamless content sync.",
  },
  {
    name: "Figma",
    mark: "F",
    category: "Creative",
    color: "pink",
    description:
      "Import design assets, icons, and images directly from your Figma projects.",
  },
  {
    name: "Collins",
    mark: "C",
    category: "Knowledge",
    color: "red",
    description:
      "Access the Collins dictionary and reference materials for your course content.",
  },
  {
    name: "Anthropic",
    mark: "A",
    category: "LLM/AI",
    color: "peach",
    description:
      "Use Claude AI to generate, review, and improve your course materials.",
  },
  {
    name: "Open AI",
    mark: "◎",
    category: "LLM/AI",
    color: "green",
    description:
      "Use GPT models to create quizzes, summaries, and interactive learning content.",
  },
  {
    name: "MIT",
    mark: "MIT",
    category: "Knowledge",
    color: "red",
    description:
      "Access MIT OpenCourseWare resources and add academic content.",
  },
  {
    name: "Canva",
    mark: "C",
    category: "Creative",
    color: "cyan",
    description:
      "Design course graphics, thumbnails, and visual assets with Canva.",
  },
  {
    name: "Loom",
    mark: "✳",
    category: "Creative",
    color: "purple",
    description:
      "Record and embed video lessons, walkthroughs, and screen captures with Loom.",
  },
] as const;
export function Integrations() {
  const session = useSession();
  const { registry } = useChannels();
  const [filter, setFilter] = useState("All");
  const { data, error, loading, reload } = useApi<{
    connections: Connection[];
  }>("/connections", 5000);
  const providers = useApi<LmsProvidersResponse>("/lms-providers");
  const cards = visibleChannels(registry, providers.data?.lms).map((manifest) => ({ ...manifest.card, name: manifest.card.title, channel: manifest.id }));
  const staticCards = staticIntegrations.map((card) => ({ ...card, channel: null }));
  const integrations = [staticCards[0]!, ...cards, ...staticCards.slice(1)];
  const connections = [...(data?.connections ?? [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  );
  return (
    <>
      <div className="mt-[26px] mb-[30px] [&_h1]:mt-[7px] [&_h1]:mb-2.5 [&_p:not(.eyebrow)]:text-muted-foreground">
        <p className="eyebrow mb-[5px] text-[10px] font-semibold tracking-[0.15em] text-[#b3a4c6]">
          YOUR CONNECTED WORKSPACE
        </p>
        <h1 tabIndex={-1}>Integrations</h1>
        <p>Connect your favorite tools to your course library.</p>
      </div>
      <Tabs
        id="integration-categories"
        label="Integration categories"
        options={filters}
        value={filter}
        onValueChange={setFilter}
      />
      <ErrorNotice error={error} />
      <ErrorNotice error={providers.error} />
      {!!providers.error && <Button variant="link" onClick={providers.reload}>Reload LMS providers</Button>}
      {error ? (
        <Button variant="link" onClick={reload}>
          Try again
        </Button>
      ) : null}
      <div
        role="tabpanel"
        id="integration-categories-panel"
        aria-labelledby={`integration-categories-${filters.indexOf(filter)}`}
        tabIndex={0}
        className="integration-grid grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {integrations
          .filter((item) => filter === "All" || item.category === filter)
          .map((item) => {
            const lms = item.channel;
            const manifest = lms ? registry.channel(lms) : null;
            const newest = lms ? connections.find((connection) => channelOf(connection) === lms) : undefined;
            const provider = manifest ? channelProvider(registry, manifest, providers.data?.lms) : undefined;
            const ready = !!provider?.profiles.some((profile) => profile.ready);
            const notReady = manifest && provider && !ready ? channelText(manifest, manifest.texts.notReady ?? "{LMS} is not set up for this Cogniate service yet. Ask your Cogniate operator.") : null;
            return (
            <Card
              as="article"
              data-channel-id={item.channel ?? undefined}
              spacing="integration"
              className="integration-card min-h-[198px] shadow-[0_2px_8px_#0000000d] [&_h2]:mt-[15px] [&_h2]:mb-[9px] [&_h2]:text-[14px] [&>p]:max-w-[300px] [&>p]:text-[12px] [&>p]:leading-[1.7] [&>p]:text-muted-foreground"
              key={item.name}
              aria-labelledby={`integration-${item.name.replaceAll(" ", "-")}`}
            >
              <div className="flex items-center justify-between gap-2.5">
                <IntegrationLogo
                  name={item.name}
                  mark={item.mark}
                  icon={manifest?.card.icon}
                  color={item.color}
                />
                {!lms ? (
                  <span title="Not part of this prototype">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled
                      aria-label={`Connect ${item.name} — Not part of this prototype`}
                    >
                      Connect
                    </Button>
                  </span>
                ) : loading && !data ? (
                  <Loading />
                ) : newest ? (
                  <Link
                    id={`${lms}-manage`}
                    className={buttonVariants({
                      variant: "secondary",
                      size: "sm",
                    })}
                    to={`/integrations/${lms}/${newest.id}`}
                  >
                    Manage <ArrowUpRight size={14} aria-hidden="true" />
                  </Link>
                ) : !error && ready ? (
                  <Link
                    id={`${lms}-connect`}
                    className={buttonVariants({
                      variant: "secondary",
                      size: "sm",
                    })}
                    to={`/integrations/${lms}/connect`}
                    state={{ opener: `${lms}-connect` }}
                  >
                    Connect
                  </Link>
                ) : <Button variant="secondary" size="sm" disabled>Connect</Button>}
              </div>
              <h2 id={`integration-${item.name.replaceAll(" ", "-")}`}>
                {item.name}
              </h2>
              <p>{item.description}</p>
              {notReady && <p role="status">{notReady}</p>}
              {lms && newest && (
                <div className="mt-[15px] flex flex-col items-start gap-2.5 border-t border-[#ffffff12] pt-3 [&>a]:inline-flex [&>a]:items-center [&>a]:gap-1 [&>a]:text-[12px] [&>a]:text-[#d7b9ff] [&>a]:no-underline">
                  <ConnectionBadge connection={newest} />
                  {ready && <Link
                    id={`${lms}-connect-another`}
                    to={`/integrations/${lms}/connect`}
                    state={{ opener: `${lms}-connect-another` }}
                  >
                    <Plus size={14} aria-hidden="true" />
                    Connect another site
                  </Link>}
                  <ConnectionError
                    connection={newest}
                    libraryName={session?.library.name}
                  />
                </div>
              )}
            </Card>
          ); })}
      </div>
      <p className="mt-8 text-center text-[12px] text-[#a9a1b8]">
        One library. Your tools, connected.
      </p>
    </>
  );
}
