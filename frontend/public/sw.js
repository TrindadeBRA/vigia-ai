// Service worker do Vigia AI — só isso: deixa o painel instalável (critério do
// Chrome exige SW com fetch handler) e guarda o último /usage bom pra abrir
// offline. Não mexe em /events (SSE), streams de câmera nem POST/PUT/DELETE —
// esses seguem sem respondWith, direto na rede.

const SHELL_CACHE = "vigia-shell-v1";
const ASSET_CACHE = "vigia-assets-v1";
const USAGE_CACHE = "vigia-usage-v1";
const CACHES = [SHELL_CACHE, ASSET_CACHE, USAGE_CACHE];

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => !CACHES.includes(n)).map((n) => caches.delete(n))),
    ).then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return url.pathname.startsWith("/assets/") || /\.(?:js|css|png|jpg|jpeg|svg|webp|woff2?|ttf|ico)$/.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // App shell (navegação) — rede primeiro, cache como fallback offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/display"))),
    );
    return;
  }

  // Último /usage bom — pra abrir offline com o dado mais recente.
  if (url.pathname === "/usage") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(USAGE_CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // Assets com hash do build (JS/CSS/imagens/fontes) — cache-first, imutáveis.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(ASSET_CACHE).then((c) => c.put(request, copy));
          return res;
        });
      }),
    );
    return;
  }

  // Qualquer outra rota (/api/*, /events, /health, /docs...) — direto na rede.
});
