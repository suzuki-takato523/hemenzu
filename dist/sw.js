const CACHE_NAME = 'floorplan-app-v2';
const BASE_PATH = self.location.pathname.replace(/\/[^\/]*$/, ''); // 動的にベースパスを取得
const urlsToCache = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/src/main.js`,
  `${BASE_PATH}/src/style.css`,
  `${BASE_PATH}/src/drawingCanvas.js`,
  `${BASE_PATH}/src/toolManager.js`,
  `${BASE_PATH}/src/shapeRecognizer.js`,
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/icon-192.svg`,
  `${BASE_PATH}/icon-512.svg`,
  `${BASE_PATH}/logo.png`,
  // 外部フォント（オフライン時のフォールバック）
  'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap',
  // jsPDFライブラリ
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// インストール時：必要なファイルをキャッシュ
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching app shell');
        return cache.addAll(urlsToCache.map(url => {
          return new Request(url, { mode: 'cors' });
        }));
      })
      .catch((error) => {
        console.log('Cache failed:', error);
      })
  );
  // 新しいサービスワーカーを即座にアクティブ化
  self.skipWaiting();
});

// アクティベート時：古いキャッシュを削除
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // すべてのクライアントを即座に制御
  return self.clients.claim();
});

// フェッチ時：Cache First戦略（アプリシェル）+ Network First戦略（API等）
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // アプリシェルファイルはCache First
  if (urlsToCache.some(url => requestUrl.pathname.endsWith(url.replace('/', '')))) {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          if (response) {
            return response;
          }
          // キャッシュにない場合はネットワークから取得してキャッシュに保存
          return fetch(event.request).then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
            return response;
          });
        })
        .catch(() => {
          // オフライン時のフォールバック
          if (event.request.destination === 'document') {
            return caches.match(`${BASE_PATH}/index.html`);
          }
        })
    );
  } else {
    // その他のリクエストは通常のNetwork First
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
  }
});
