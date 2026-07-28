/*
 * Service worker do AD Campinas.
 *
 * Deliberadamente conservador: ele existe para o app ser instalável e para o
 * casco abrir sem rede, não para acelerar dados. Regras que NÃO podem mudar
 * sem pensar duas vezes:
 *
 *  - /api/** nunca é tocado. Tudo ali é autenticado e/ou muda a cada chamada.
 *  - só GET e só mesma origem.
 *  - navegação é network-first: o cache só entra em cena quando a rede falha.
 *    O HTML do SPA é uma casca vazia (as telas montam no cliente, ssr: false),
 *    então nada de usuário fica guardado no cache.
 *
 * A versão vem da query de registro (/sw.js?v=<build id>), então cada deploy
 * troca o nome dos caches e o navegador enxerga um script novo.
 */

const VERSAO = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE_CASCA = `adc-casca-${VERSAO}`;
const CACHE_ESTATICO = `adc-estatico-${VERSAO}`;

// mínimo para a home abrir offline
const PRE_CACHE = ['/', '/manifest.webmanifest', '/adcampinas.png', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  // Sem skipWaiting de propósito: o SW novo fica em "waiting" até a pessoa
  // clicar em Atualizar no banner. Trocar sozinho recarregaria a tela por
  // baixo de quem está no meio de um formulário.
  event.waitUntil(
    caches
      .open(CACHE_CASCA)
      .then((cache) => cache.addAll(PRE_CACHE))
      .catch(() => {}), // um recurso ausente não pode derrubar a instalação
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nomes) =>
        Promise.all(
          nomes
            .filter((n) => n.startsWith('adc-') && n !== CACHE_CASCA && n !== CACHE_ESTATICO)
            .map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

/** Estático versionado ou imutável: pode servir do cache e revalidar depois. */
function ehEstatico(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(png|jpe?g|svg|webp|ico|woff2?)$/i.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE_CASCA).then((c) => c.put('/', copia)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || Response.error())),
    );
    return;
  }

  if (ehEstatico(url)) {
    event.respondWith(
      caches.open(CACHE_ESTATICO).then(async (cache) => {
        const guardado = await cache.match(req);
        const rede = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => guardado);
        return guardado || rede;
      }),
    );
  }
});
