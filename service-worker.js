const CACHE = 'budd-v1';

self.addEventListener('install', function (evt) {
    console.info('The service worker is being installed.');

    evt.waitUntil(precache());
});

self.addEventListener('fetch', function (evt) {
    console.log('The service worker is serving the asset.');

    evt.respondWith(fromCache(evt.request));

    evt.waitUntil(update(evt.request));
});

function precache() {
    return caches.open(CACHE).then(function (cache) {
        return cache.addAll([
            'https://unpkg.com/nanoid@3.1.12/nanoid.js',
            './index.html',
            './style.css',
            './app.js',
            './db.js'
        ]);
    });
}

function fromCache(request) {
    return caches.open(CACHE).then(function (cache) {
        return cache.match(request).then(function (matching) {
            return matching || Promise.reject('no-match');
        });
    });
}

function update(request) {
    return caches.open(CACHE).then(function (cache) {
        return fetch(request).then(function (response) {
            return cache.put(request, response);
        });
    });
}