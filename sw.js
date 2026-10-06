// Service worker do app: permite instalar no tablet e abrir mesmo sem internet.
// Arquivos do site: busca na rede primeiro e guarda a última versão.
// Fotos do Google Drive: mostra a guardada na hora e atualiza em segundo plano,
// assim continuam aparecendo se a internet cair.
// (As fotos tiradas pela tela de cadastro são guardadas por js/catalogo.js.)

const CACHE_SITE = 'site-v4';
const CACHE_FOTOS_DRIVE = 'fotos-drive-v1';
const CACHES_EM_USO = [CACHE_SITE, CACHE_FOTOS_DRIVE, 'fotos-cadastro-v1'];

const ARQUIVOS = [
  './',
  'index.html',
  'manifest.json',
  'js/catalogo.js',
  'js/config.js',
  'dados/produtos.json',
  'icones/icone-192.png'
];

self.addEventListener('install', function(evento) {
  evento.waitUntil(
    caches.open(CACHE_SITE)
      .then(cache => cache.addAll(ARQUIVOS))
      // Se não conseguir guardar agora, guarda depois, conforme as páginas forem abertas
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', function(evento) {
  evento.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(
        nomes
          .filter(nome => !CACHES_EM_USO.includes(nome))
          .map(nome => caches.delete(nome))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', function(evento) {
  const pedido = evento.request;

  if (pedido.method !== 'GET') {
    return;
  }

  const url = new URL(pedido.url);

  if (url.hostname === 'drive.google.com' && url.pathname === '/thumbnail') {
    evento.respondWith(fotoDoDrive(evento, pedido));
    return;
  }

  // Arquivos do site e a biblioteca do Firebase: rede primeiro, cache se estiver sem internet
  const doSite = url.origin === self.location.origin;
  const sdkFirebase = url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/');

  if (doSite || sdkFirebase) {
    evento.respondWith(
      fetch(pedido)
        .then(function(resposta) {
          if (resposta.ok) {
            const copia = resposta.clone();
            caches.open(CACHE_SITE).then(cache => cache.put(pedido, copia)).catch(() => {});
          }
          return resposta;
        })
        .catch(() => caches.match(pedido, { ignoreSearch: true }))
    );
  }
});

function fotoDoDrive(evento, pedido) {
  return caches.open(CACHE_FOTOS_DRIVE).then(function(cache) {
    return cache.match(pedido).then(function(guardada) {
      const daRede = fetch(pedido)
        .then(function(resposta) {
          // A resposta do Drive vem "opaca" (sem status legível); só não guarda erros visíveis
          if (resposta.ok || resposta.type === 'opaque') {
            cache.put(pedido, resposta.clone()).catch(() => {});
          }
          return resposta;
        });

      if (guardada) {
        evento.waitUntil(daRede.catch(() => {}));
        return guardada;
      }

      return daRede;
    });
  });
}
