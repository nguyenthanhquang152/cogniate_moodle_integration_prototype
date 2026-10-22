import type { ChannelManifest } from "@cogniate/channel-kernel";
import type { Connection } from "../types.ts";

/** The saved authority wins. Before create, use the selected registration entry. */
type VerificationAuthority = NonNullable<Connection["bindingAuthority"]>;
export function verificationAuthority(manifest: ChannelManifest, connection: Connection | null, method: string): VerificationAuthority {
  return connection?.bindingAuthority ?? manifest.registration.find((entry) => entry.method === method)?.authority ?? "operatorGrant";
}

/** Instructions for a verification step. The caller supplies an approval form when needed. */
export function VerificationInstructions({ authority, name }: { authority: VerificationAuthority; name: string }) {
  if (authority === "self") return <p>The first launch from {name} verifies this connection.</p>;
  if (authority === "verifiedAdminLaunch") return <p>Use the admin launch code to verify this connection.</p>;
  return <p>Ask your Cogniate operator for an approval code. The code works once and expires.</p>;
}
