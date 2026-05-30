const CACHE_NAME = "besmella-v6";

// خلي الأصول الأساسية ثابتة + الباقي Runtime cache
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./breadfast 11.webp",
  "./breadfast 12.webp",
  "./breadfast 3.webp",
  "./breadfast 13.webp",
  "./breadfast 14.webp"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(CORE_ASSETS);

      // ✅ فعّل النسخة الجديدة فورًا بدل ما تستنى إغلاق التطبيق
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // ✅ سيطر على كل التابات/نوافذ الـ PWA فورًا
      await self.clients.claim();

      // امسح أي كاش قديم
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));

      // إخطار الصفحات إن في SW جديد اتفعّل (اختياري للاستخدام داخل app.js)
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      clients.forEach((client) => client.postMessage({ type: "SW_ACTIVATED", cacheName: CACHE_NAME }));
    })()
  );
});

// استراتيجية:
// - ملفاتنا الأساسية: cache-first (سريعة جدًا)
// - باقي الطلبات: network-first مع fallback للكاش (علشان التحديثات توصل)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // تجاهل أي شيء مش http/https
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // حدد هل الطلب على نفس الدومين؟
  const isSameOrigin = url.origin === self.location.origin;

  // ملفات أساسية عندنا داخل الموقع
  const isCoreAsset = isSameOrigin && CORE_ASSETS.some((p) => url.pathname.endsWith(p.replace("./", "/")));

  // HTML: network-first عشان أي تحديث يظهر بسرعة
  const isHTML = req.headers.get("accept")?.includes("text/html");

  if (isHTML) {
    event.respondWith(networkFirst(req));
    return;
  }

  if (isCoreAsset) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // أي شيء تاني (صور/طلبات أخرى): stale-while-revalidate
  event.respondWith(staleWhileRevalidate(req));
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;

  const res = await fetch(req);
  const cache = await caches.open(CACHE_NAME);
  cache.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(req);
    cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;

    // fallback أخير: لو الصفحة الرئيسية مخزنة
    const fallback = await cache.match("./index.html");
    if (fallback) return fallback;

    throw new Error("Offline and no cache available");
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);

  const fetchPromise = fetch(req)
    .then((res) => {
      cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);

  // لو في كاش ارجعه فورًا + حدّث في الخلفية
  if (cached) return cached;

  // لو مفيش كاش، استنى الشبكة (أو لو فشلت ارجع خطأ)
  const res = await fetchPromise;
  if (res) return res;

  throw new Error("Request failed and no cache available");
}
