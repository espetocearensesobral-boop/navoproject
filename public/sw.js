// Service worker mínimo. Não faz cache nem armazenamento offline: toda
// leitura e gravação de dados continua ocorrendo pela API e pelo banco.
// Ele existe apenas para satisfazer o critério de "instalabilidade" do
// Chrome/Edge (é exigido um SW controlando a página com um handler de
// fetch para que o evento `beforeinstallprompt` seja disparado).

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Passthrough: apenas repassa a requisição para a rede, sem cache.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
