"use strict";

const CACHE_VERSION = "inclume-v8-wheelchair-brand-2026-07-27";
const NAVIGATION_FALLBACK = "/parking/";
const CORE_ASSETS = [
    NAVIGATION_FALLBACK,
    "/static/styles.css",
    "/static/parking.css",
    "/static/parking-v3.css",
    "/static/inclusive-v4.css",
    "/static/logo-v5.css",
    "/static/parking-geotag.css",
    "/static/parking-geotag-v4.css",
    "/static/motion.css",
    "/static/parking.js",
    "/static/parking-resilience.js",
    "/static/parking-geotag-v4.js",
    "/static/accessibility-controls.js",
    "/static/motion.js",
    "/static/manifest.webmanifest",
    "/static/images/inclume-app-icon.svg",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then(async (cache) => {
            await Promise.allSettled(
                CORE_ASSETS.map(async (asset) => {
                    try {
                        await cache.add(asset);
                    } catch (_error) {
                        // A missing optional asset must not prevent installation.
                    }
                }),
            );
            await self.skipWaiting();
        }),
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
            .then(() => self.clients.claim()),
    );
});

async function networkFirst(request, fallbackRequest = null) {
    const cache = await caches.open(CACHE_VERSION);
    try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
    } catch (_error) {
        const cached = await cache.match(request);
        if (cached) return cached;
        if (fallbackRequest) {
            const fallback = await cache.match(fallbackRequest);
            if (fallback) return fallback;
        }
        throw _error;
    }
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request);
    const networkPromise = fetch(request)
        .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
        })
        .catch(() => null);
    if (cached) return cached;
    const network = await networkPromise;
    return network || new Response("Recurso no disponible sin conexión.", { status: 504 });
}

self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (request.mode === "navigate") {
        event.respondWith(networkFirst(request, NAVIGATION_FALLBACK));
        return;
    }

    if (url.pathname === "/api/parkings/") {
        event.respondWith(networkFirst(request));
        return;
    }

    if (url.pathname.startsWith("/static/")) {
        event.respondWith(staleWhileRevalidate(request));
    }
});