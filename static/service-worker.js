"use strict";

const CACHE_VERSION = "inclume-v3-2026-07-27";
const NAVIGATION_FALLBACK = "/parking/";

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then(async (cache) => {
            try {
                await cache.add(NAVIGATION_FALLBACK);
            } catch (_error) {
                // The first successful navigation will populate the cache.
            }
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
