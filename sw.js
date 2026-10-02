// ---------------------------------------------------------
// sw.js — Service Worker OUESSE
// Stratégie : réseau en priorité (pour toujours voir les
// dernières actualités), avec une page de secours hors-ligne
// si la connexion coupe. Ce n'est PAS un cache agressif :
// on ne veut pas que les CM voient de vieilles infos.
//
// Fusionné avec le service worker OneSignal (notifications push)
// pour n'avoir qu'un seul service worker actif sur le site.
// Version v2 : correction du cache pour éviter les ressources obsolètes
// ---------------------------------------------------------

importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

const VERSION = "ouesse-v2";
const CACHE_STATIQUE = `${VERSION}-statique`;

// Fichiers essentiels mis en cache pour que l'app s'ouvre
// même sans connexion. Réduit à un strict minimum pour éviter les 404s.
const FICHIERS_ESSENTIELS = [
  "/",
  "/index.html",
  "/manifest.json"
];

// Installation : on met en cache le strict nécessaire
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIQUE).then((cache) =>
      cache.addAll(FICHIERS_ESSENTIELS).catch(() => {
        // Si un fichier de la liste n'existe pas encore, on n'échoue pas
        // toute l'installation pour autant.
      })
    )
  );
  self.skipWaiting();
});

// Activation : on supprime les anciens caches de versions précédentes
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cles) =>
      Promise.all(
        cles
          .filter((cle) => cle.startsWith("ouesse-") && cle !== CACHE_STATIQUE)
          .map((cle) => caches.delete(cle))
      )
    )
  );
  self.clients.claim();
});

// Requêtes : réseau d'abord (actualités toujours à jour),
// cache en secours si pas de connexion.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((reponse) => {
        // Ne mettre en cache que les réponses valides (200-299)
        if (!reponse || reponse.status < 200 || reponse.status >= 300) {
          return reponse;
        }
        const copie = reponse.clone();
        caches.open(CACHE_STATIQUE).then((cache) => cache.put(event.request, copie));
        return reponse;
      })
      .catch(() =>
        caches.match(event.request).then((reponseCache) => {
          if (reponseCache) return reponseCache;
          // Dernier recours pour une navigation de page hors-ligne
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
        })
      )
  );
});
