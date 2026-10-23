import { idPath } from "../api.ts";
import { useApi } from "../hooks.ts";
import type { ToolRow } from "../types.ts";
import { CopyButton, ErrorNotice, Loading } from "../ui.tsx";

export function ToolConfiguration({ id, lmsName }: { id: string; lmsName: string }) {
  const { data, error } = useApi<ToolRow[]>(`/connections/${idPath(id)}/tool-configuration`);
  return <>
    <ErrorNotice error={error} />
    {!data && !error && <Loading />}
    {data && <div className="overflow-x-auto">
      <table>
        <caption>Tool configuration · Copy these values into {lmsName}, in this order.</caption>
        <thead><tr><th scope="col">{lmsName} setting</th><th scope="col">Value</th><th scope="col">Copy</th></tr></thead>
        <tbody>{data.map((row) => <tr key={row.key} data-key={row.key}>
          <th scope="row">{row.label}</th>
          <td className="wrap-anywhere"><code>{row.value}</code></td>
          <td><CopyButton label={row.label} value={row.value} /></td>
        </tr>)}</tbody>
      </table>
    </div>}
  </>;
}
