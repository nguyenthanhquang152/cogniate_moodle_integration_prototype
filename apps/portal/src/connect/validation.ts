export const platformFields = [
  { key: "issuer", label: "Platform ID (issuer)" },
  { key: "clientId", label: "Client ID" },
  { key: "deploymentId", label: "Deployment ID" },
  { key: "authenticationEndpoint", label: "Authentication request URL" },
  { key: "accessTokenEndpoint", label: "Access token URL" },
  { key: "jwksUrl", label: "Public keyset URL" },
] as const;
export type PlatformKey = (typeof platformFields)[number]["key"];
export type PlatformValues = Record<PlatformKey, string>;
export function httpsUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hash
      ? url
      : null;
  } catch {
    return null;
  }
}
export function siteError(value: string): string | null {
  const url = httpsUrl(value);
  return url && url.pathname === "/" && !url.search
    ? null
    : "Use an HTTPS site origin, for example https://moodle.test. Do not add a path.";
}
export function validatePlatform(
  siteUrl: string,
  values: PlatformValues,
): Partial<Record<PlatformKey, string>> {
  const errors: Partial<Record<PlatformKey, string>> = {};
  for (const { key } of platformFields)
    if (!values[key].trim()) errors[key] = "Enter this Moodle value.";
  const issuer = httpsUrl(values.issuer);
  if (
    !issuer ||
    issuer.origin !== new URL(siteUrl).origin ||
    issuer.pathname !== "/" ||
    issuer.search
  ) {
    errors.issuer = "Use the HTTPS origin of this Moodle site.";
  }
  for (const key of [
    "authenticationEndpoint",
    "accessTokenEndpoint",
    "jwksUrl",
  ] as const) {
    const url = httpsUrl(values[key]);
    if (!url || !issuer || url.origin !== issuer.origin)
      errors[key] = "Use an HTTPS URL on the Platform ID origin.";
  }
  return errors;
}
