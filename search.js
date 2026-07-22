document.addEventListener('DOMContentLoaded', function () {

    /* =========================================================
       CHARGEMENT DE L'INDEX DE RECHERCHE (JSON externe)
       Chaque entrée contient le texte RÉEL de la section
       (champ "text"), donc n'importe quel mot présent sur le
       site est trouvable, pas seulement des mots-clés choisis.

       Pour ajouter une future page : ajoute une entrée dans
       search-index.json (voir le modèle en bas de ce fichier),
       sans toucher au JS.
    ========================================================= */
    let searchData = [];

    const fallbackData = [
        {
            title: 'WAOUESSE', desc: 'Signification', icon: 'fa-hand-peace',
            page: 'index.html', anchor: '#waouesse',
            keywords: ['waouesse', 'wa', 'viens', 'fon'],
            text: '« Wa » signifie « Viens » en langue Fon. WAOUESSE est l\'invitation à venir découvrir Ouèssè.'
        },
        {
            title: 'Nous contacter', desc: 'Page', icon: 'fa-envelope',
            page: 'contact.html', anchor: '',
            keywords: ['contact', 'email'],
            text: 'Contactez l\'équipe de Ouèssè Tourisme.'
        }
    ];

    fetch('search-index.json')
        .then(res => {
            if (!res.ok) throw new Error('Réponse HTTP non valide');
            return res.json();
        })
        .then(data => { searchData = data; })
        .catch(() => { searchData = fallbackData; });

    /* =========================================================
       ÉLÉMENTS DU DOM
    ========================================================= */
    const searchForm = document.getElementById('searchForm');
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');

    const summaryPanel = document.getElementById('summaryPanel');
    const summaryTitleText = document.getElementById('summaryTitleText');
    const summaryText = document.getElementById('summaryText');
    const summaryLink = document.getElementById('summaryLink');
    const summaryClose = document.getElementById('summaryClose');

    if (!searchForm || !searchInput || !searchResults) return;

    function normaliser(txt) {
        return (txt || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    }

    /* =========================================================
       RECHERCHE FULL-TEXT
       - Découpe la requête en mots.
       - Un item est retenu si AU MOINS UN mot de la requête
         apparaît dans son titre, ses mots-clés OU son texte.
       - Le score sert juste à trier : titre > mots-clés > texte,
         et plus de mots trouvés = mieux classé.
    ========================================================= */
    function chercher(valeur) {
        const mots = normaliser(valeur).split(/\s+/).filter(Boolean);
        if (mots.length === 0) return [];

        const resultats = [];

        searchData.forEach(item => {
            const titreN = normaliser(item.title);
            const motsClesN = (item.keywords || []).map(normaliser).join(' ');
            const texteN = normaliser(item.text);

            let score = 0;
            let motsTrouves = 0;

            mots.forEach(mot => {
                let trouve = false;
                if (titreN.includes(mot)) { score += 5; trouve = true; }
                if (motsClesN.includes(mot)) { score += 3; trouve = true; }
                if (texteN.includes(mot)) { score += 1; trouve = true; }
                if (trouve) motsTrouves++;
            });

            if (motsTrouves > 0) {
                resultats.push({ item, score, motsTrouves });
            }
        });

        // Priorité aux items qui contiennent le plus de mots de la requête,
        // puis au score global.
        resultats.sort((a, b) => (b.motsTrouves - a.motsTrouves) || (b.score - a.score));

        return resultats.map(r => r.item);
    }

    // Extrait un court passage du texte autour du premier mot trouvé,
    // pour montrer un aperçu pertinent dans la liste de résultats.
    function extraitPertinent(item, valeur) {
        const mots = normaliser(valeur).split(/\s+/).filter(Boolean);
        const texteN = normaliser(item.text);
        const texteOriginal = item.text || '';

        let position = -1;
        for (const mot of mots) {
            const idx = texteN.indexOf(mot);
            if (idx !== -1) { position = idx; break; }
        }

        if (position === -1) return item.desc || '';

        const debut = Math.max(0, position - 40);
        const fin = Math.min(texteOriginal.length, position + 80);
        let extrait = texteOriginal.substring(debut, fin).trim();
        if (debut > 0) extrait = '…' + extrait;
        if (fin < texteOriginal.length) extrait = extrait + '…';
        return extrait;
    }

    function pageActuelle() {
        const nom = location.pathname.split('/').pop();
        return nom === '' ? 'index.html' : nom;
    }

    function allerVersCible(item) {
        const cible = item.page || 'index.html';
        const surLaBonnePage = cible === pageActuelle();

        if (surLaBonnePage && item.anchor) {
            const el = document.querySelector(item.anchor);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return;
            }
        }
        if (!surLaBonnePage) {
            window.location.href = cible + (item.anchor || '');
        }
    }

    function ouvrirResume(item) {
        summaryTitleText.textContent = item.title;
        summaryText.textContent = item.text || item.desc || '';
        summaryLink.onclick = function (e) {
            e.preventDefault();
            allerVersCible(item);
            fermerResultats();
        };
        summaryPanel.style.display = 'block';
    }

    function fermerResume() {
        summaryPanel.style.display = 'none';
    }

    function fermerResultats() {
        searchResults.classList.remove('active');
        searchResults.innerHTML = '';
    }

    function afficherResultats(resultats, valeur) {
        searchResults.innerHTML = '';

        if (resultats.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'search-result-item';
            empty.innerHTML = '<i class="fa-solid fa-circle-info"></i><span class="result-title">Aucun résultat</span><span class="result-desc">Essayez un autre mot : « marbre », « maire », « contact »…</span>';
            searchResults.appendChild(empty);
            searchResults.classList.add('active');
            return;
        }

        // On limite l'affichage aux 8 meilleurs résultats pour rester lisible.
        resultats.slice(0, 8).forEach(item => {
            const row = document.createElement('div');
            row.className = 'search-result-item';

            // BUG CORRIGÉ (XSS) : item.title et l'extrait de texte venaient
            // directement de search-index.json (lui-même généré à partir de
            // contenu publié via l'admin) et étaient insérés en innerHTML
            // SANS échappement. Un titre contenant du HTML/JS aurait été
            // exécuté dans le navigateur de tout visiteur qui utilise la
            // recherche. On construit maintenant les nœuds via le DOM et on
            // utilise textContent (jamais interprété comme du HTML).
            const icon = document.createElement('i');
            const iconName = (item.icon || 'fa-magnifying-glass').replace(/[^a-z0-9-\s]/gi, '');
            icon.className = 'fa-solid ' + iconName;

            const titleSpan = document.createElement('span');
            titleSpan.className = 'result-title';
            titleSpan.textContent = item.title || '';

            const descSpan = document.createElement('span');
            descSpan.className = 'result-desc';
            descSpan.textContent = extraitPertinent(item, valeur);

            const summaryBtn = document.createElement('button');
            summaryBtn.type = 'button';
            summaryBtn.className = 'summary-toggle';
            summaryBtn.textContent = 'Résumé';

            row.appendChild(icon);
            row.appendChild(titleSpan);
            row.appendChild(descSpan);
            row.appendChild(summaryBtn);

            row.addEventListener('click', function (e) {
                if (e.target.closest('.summary-toggle')) return;
                allerVersCible(item);
                fermerResultats();
                searchInput.value = '';
            });

            summaryBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                ouvrirResume(item);
            });

            searchResults.appendChild(row);
        });

        searchResults.classList.add('active');
    }

    /* =========================================================
       ÉVÉNEMENTS
    ========================================================= */
    searchInput.addEventListener('input', function () {
        const valeur = this.value;
        if (valeur.trim() === '') {
            fermerResultats();
            return;
        }
        afficherResultats(chercher(valeur), valeur);
    });

    searchInput.addEventListener('focus', function () {
        if (this.value.trim() !== '') {
            afficherResultats(chercher(this.value), this.value);
        }
    });

    searchForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const resultats = chercher(searchInput.value);
        if (resultats.length > 0) {
            ouvrirResume(resultats[0]);
        } else {
            afficherResultats([], searchInput.value);
        }
    });

    if (summaryClose) {
        summaryClose.addEventListener('click', fermerResume);
    }

    document.addEventListener('click', function (e) {
        if (!e.target.closest('.search')) {
            fermerResultats();
        }
        if (!e.target.closest('#summaryPanel') && !e.target.closest('.summary-toggle')) {
            fermerResume();
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            fermerResultats();
            fermerResume();
        }
    });

});

/* =========================================================
   TEMPLATE : entrée à copier dans search-index.json
   quand tu crées une nouvelle page ou une nouvelle section.

   {
     "title": "Titre affiché dans les résultats",
     "desc": "Catégorie courte (ex: Page, FAQ, Site touristique)",
     "icon": "fa-nom-icone-fontawesome",
     "page": "nouvelle-page.html",
     "anchor": "#id-de-section-ou-vide",
     "keywords": ["synonyme1", "synonyme2"],
     "text": "Le texte RÉEL et complet de la section, tel qu'il apparaît
              sur la page. C'est ce champ qui rend chaque mot
              cherchable et qui sert de réponse dans le panneau
              Résumé."
   }
========================================================= */