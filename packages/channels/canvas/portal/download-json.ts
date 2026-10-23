/** Save the developer key JSON text as the file cogniate-canvas-lti.json. Throws when the browser cannot start it. */
export function downloadJson(text: string): void {
  let url: string | undefined;
  try {
    url = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "cogniate-canvas-lti.json";
    document.body.append(link);
    try { link.click(); } finally { link.remove(); }
  } finally {
    if (url) {
      const downloadUrl = url;
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
    }
  }
}
