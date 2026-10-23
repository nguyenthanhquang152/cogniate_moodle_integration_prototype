// Filling of LTI profile templates on the app side (`{siteUrl}`, `{serviceUrl}`, `{clientId}`), for example the
// canonical issuer of `canvas-self-hosted` (`{siteUrl}`) in a redemption target. Values are canonical origins.
export function fillTemplateValue(value: string, v: { siteUrl: string; serviceUrl?: string; clientId?: string }): string {
  return value.replace(/\{(siteUrl|serviceUrl|clientId)\}/g, (_m, name: string) =>
    name === 'siteUrl' ? v.siteUrl : name === 'serviceUrl' ? (v.serviceUrl ?? v.siteUrl) : encodeURIComponent(v.clientId ?? ''));
}
