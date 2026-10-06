// Service worker do app: permite instalar no tablet e abrir mesmo sem internet.
// Arquivos do site: busca na rede primeiro e guarda a última versão.
// As fotos do Google Drive ficam por conta do cache normal do navegador.

const CACHE_SITE = 'site-v3';

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
          .filter(nome => nome !== CACHE_SITE)
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
