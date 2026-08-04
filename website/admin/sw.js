const CACHE_NAME = "cartfox-admin-v1";

const FILES = [
    "./dashboard.html",
    "./login.html",
    "./style.css", // Corrected CSS file name
    "./auth.js", // Auth script added for PWA caching
    "./dashboard.js",
    "./login.js",
    "./manifest.json"
];


self.addEventListener("install", event => {

    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache=>{
            return cache.addAll(FILES);
        })
    );

});


self.addEventListener("fetch", event => {

    event.respondWith(

        caches.match(event.request)
        .then(response=>{

            return response || fetch(event.request);

        })

    );

});