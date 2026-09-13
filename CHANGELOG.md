# CHANGELOG — Corrections apportées

## 🔍 Recherche

- **Bug critique** : `indexer.py` et `indexer_tout.py` utilisaient
  `INSERT OR REPLACE` sans contrainte `UNIQUE` sur la colonne `page` de
  `search_index`. Sans cette contrainte, SQLite ne "remplaçait" jamais rien :
  chaque exécution ajoutait de nouvelles lignes en plus des anciennes.
  Résultat : 21 lignes en base pour seulement 9 pages réelles, des doublons
  avec du contenu vide qui remontaient dans les résultats, et un classement
  par pertinence complètement faussé.
  → Corrigé avec un vrai upsert (`ON CONFLICT(page) DO UPDATE`) + un index
  unique `idx_search_index_page`, et un nettoyage automatique des doublons
  existants au démarrage de `app.py`.
- `ibidon.html` : fichier vide (0 octet), indexé sous le titre « Sans titre »,
  polluait les résultats de recherche sans jamais être lié depuis aucune
  page. Supprimé, et les pages sans contenu réel sont désormais ignorées
  automatiquement à l'indexation (`MIN_CONTENT_LENGTH`).
- La barre de recherche (HTML + `search.js`) n'existait que sur `index.html`.
  Ajoutée sur `a-propos.html`, `contact.html`, `decouvert.html` et
  `luc.html`, via un CSS partagé autonome `search-widget.css`.
- Le schema.org `SearchAction` de `index.html` pointait vers
  `/search?q={search_term_string}`, une route qui n'existait pas
  (404 pour les moteurs de recherche / la sitelinks searchbox Google).
  → Route `/search` ajoutée ; `search.js` lance désormais automatiquement
  une recherche si l'URL contient `?q=...`.
- Bug mineur dans `search.js` : `pageActuelle()` testait deux fois la même
  condition (`nom === '' || nom === ''`), ce qui ne gérait jamais le cas
  où `.pop()` renvoie `undefined`. Corrigé.
- Bug mineur dans `indexer.py` : la variable `nom` n'était définie
  qu'après l'ouverture du fichier ; si l'ouverture échouait, le bloc
  `except` plantait avec un `NameError` au lieu d'afficher l'erreur.
  Corrigé.

## 🔐 Administration — mot de passe ajouté

- Avant : le seul contrôle d'accès admin était un `?token=...` dans l'URL
  (aucun mot de passe, token visible dans l'historique du navigateur et les
  logs serveur).
- Ajouté : `/admin/login` avec un vrai mot de passe (haché avec
  `werkzeug.security`, jamais stocké en clair), session sécurisée
  (cookie `HttpOnly`, `SameSite=Lax`, `Secure` hors debug, expiration 4h),
  `/admin/logout`, et limitation anti-bruteforce (8 tentatives/minute).
  Le token API reste utilisable en parallèle pour l'automatisation.
- Bug annexe corrigé : `generator.js` cherchait un champ `#adminToken`
  qui n'existait pas dans `admin.html` → la publication échouait toujours
  avec « Token admin requis ». Le serveur injecte maintenant ce champ
  automatiquement (valeur cachée) une fois l'utilisateur connecté.
- `requirements.txt` ne listait pas `flask-limiter`, pourtant importé par
  `app.py` → l'application plantait au déploiement / à l'installation
  propre. Ajouté.

## 🌐 SEO

- `sitemap.xml` ne contenait que la page d'accueil. Régénéré avec toutes
  les pages de contenu réelles (`a-propos`, `contact`, `decouvert`, `luc`).
- Balises `canonical` / `og:url` incohérentes entre les pages (certaines
  sans extension `.html`, d'autres avec, alors que le site sert réellement
  les fichiers en `.html`) → uniformisées partout.
- `canonical` manquant sur `index.html`, `a-propos.html`, `luc.html` →
  ajoutés.
- `generato.html` (outil interne de génération de pages, pas du contenu
  touristique) était indexable et présent dans l'index de recherche →
  `meta robots noindex` ajouté, exclu du sitemap et de la recherche.
- `.gitignore` et `README.md` corrompus (encodage UTF-16 mal collé,
  caractères nuls visibles) → recréés proprement.

## 🤖 robots.txt

- Bloque désormais explicitement `/admin`, `/api/`, les pages techniques
  (`generato.html`) et les fichiers non-destinés à l'indexation
  (`.db`, `.log`, `.json`), pour que les robots ne perdent pas de temps
  dessus.
- Autorise explicitement les ressources nécessaires au rendu (CSS, JS,
  images), pour une meilleure compréhension du contenu par les robots.
- Conserve la déclaration du `Sitemap` pour une découverte rapide des
  pages.

## 🧹 Divers

- Suppression des exécutables Windows SQLite (`sqlite3.exe`,
  `sqlite3_analyzer.exe`, `sqldiff.exe`, `sqlite3_rsync.exe`, ~14 Mo au
  total), sans rapport avec le déploiement Flask/Vercel.
- Suppression du dossier `__pycache__` et du fichier `app.log` (générés,
  ne doivent pas être livrés/versionnés).
