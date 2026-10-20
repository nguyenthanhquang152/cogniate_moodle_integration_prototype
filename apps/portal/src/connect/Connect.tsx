import { IntegrationLogo } from "../IntegrationLogo.tsx";
import { useEffect } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { CreateConnection } from "./CreateConnection.tsx";
import { ConnectionSetup } from "./ConnectionSetup.tsx";
import type { Lms } from "../types.ts";
import { lmsNames } from "../lms.ts";
import { ProviderSetup } from "./ProviderSetup.tsx";

export function Connect({ lms = "moodle" }: { lms?: Lms }) {
  const { connectionId } = useParams();
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
        <IntegrationLogo large name={lmsNames[lms]} mark={lms === "canvas" ? "Cv" : "Bb"} color={lms === "moodle" ? "orange" : "red"} />
        <div>
          <p className="eyebrow mb-[5px] text-[10px] font-semibold tracking-[0.15em] text-[#b3a4c6]">
            LMS PUBLISHING
          </p>
          <h1 tabIndex={-1}>
            {connectionId ? "Manage" : "Connect"} {lmsNames[lms]}
          </h1>
          <p>Bring your course library to your {lmsNames[lms]} site.</p>
        </div>
      </div>
      {connectionId ? (
        <ConnectionSetup key={`${lms}:${connectionId}`} id={connectionId} lms={lms} opener={opener} />
      ) : lms === "moodle" ? (
        <CreateConnection
          opener={opener}
          onCreated={(id) =>
            navigate(`/integrations/moodle/${id}`, {
              replace: true,
              state: { opener },
            })
          }
        />
      ) : <ProviderSetup key={`${lms}:new`} lms={lms} connection={null} opener={opener}
        onCreated={(connection) => navigate(`/integrations/${lms}/${connection.id}`, { replace: true, state: { opener } })}
        onChanged={() => undefined} />}
    </div>
  );
}
