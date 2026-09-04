/** Telas de espera e de erro, servidas como data: URL — sem depender do coletor. */

const SHELL = (title: string, body: string) => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    font: 14px/1.6 -apple-system, "Segoe UI", Roboto, system-ui, sans-serif;
    background: #0b1220; color: #e6edf7;
  }
  .card { max-width: 30rem; padding: 2rem; text-align: center; }
  h1 { font-size: 1.05rem; margin: 0 0 .5rem; letter-spacing: .01em; }
  p { margin: .35rem 0; color: #93a4bd; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
         background: rgba(255,255,255,.07); padding: .1rem .35rem; border-radius: .25rem;
         color: #cbd6e6; word-break: break-all; }
  .dot { width: .5rem; height: .5rem; border-radius: 50%; background: #e63931;
         display: inline-block; margin-right: .5rem; animation: pulse 1.2s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { opacity: .25 } 50% { opacity: 1 } }
</style></head>
<body><main class="card">${body}</main></body></html>`;

export function loadingPage(port: number): string {
  return page(
    SHELL(
      "Vigia AI",
      `<h1><span class="dot"></span>Subindo o coletor…</h1>
       <p>Lendo as credenciais locais e abrindo a porta <code>${port}</code>.</p>`,
    ),
  );
}

export function errorPage(title: string, detail: string, hint = ""): string {
  return page(
    SHELL(
      "Vigia AI — erro",
      `<h1>${escapeHtml(title)}</h1>
       <p>${escapeHtml(detail)}</p>
       ${hint ? `<p>${hint}</p>` : ""}`,
    ),
  );
}

function page(html: string): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
