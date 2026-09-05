/** Telas de espera e de erro, servidas como data: URL — sem depender do coletor. */

const SHELL = (title: string, body: string) => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    font: 14px/1.6 -apple-system, "Segoe UI", Roboto, system-ui, sans-serif;
    background: #0f0f0f; color: #f5f5f5;
  }
  .card { max-width: 30rem; padding: 2rem; text-align: center; }
  h1 { font-size: 1.05rem; margin: 0 0 .5rem; letter-spacing: .01em; color: #f5f5f5; }
  p { margin: .35rem 0; color: #a1a1a1; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
         background: #1c1c1c; padding: .1rem .35rem; border-radius: .25rem;
         color: #737373; word-break: break-all; border: 1px solid #2e2e2e; }
  .spinner {
    width: 36px; height: 36px; margin: 0 auto 1.2rem;
    border: 3px solid rgba(230,57,49,.18); border-top-color: #e63931;
    border-radius: 50%; animation: spin .8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .dot { width: .5rem; height: .5rem; border-radius: 50%; background: #e63931;
         display: inline-block; margin-right: .5rem; animation: pulse 1.2s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { opacity: .25 } 50% { opacity: 1 } }
  /* A janela não tem barra de título no macOS: esta faixa é o que resta para
     arrastá-la enquanto o coletor não sobe. */
  .drag { position: fixed; top: 0; left: 0; right: 0; height: 38px; -webkit-app-region: drag; }
</style></head>
<body><div class="drag"></div><main class="card">${body}</main></body></html>`;

export function loadingPage(port: number): string {
  return page(
    SHELL(
      "Vigia AI",
      `<div class="spinner" role="status" aria-label="Carregando"></div>
       <h1>Procurando conectores…</h1>
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
