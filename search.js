document.addEventListener('DOMContentLoaded', function () {

    /* =========================================================
       CONFIGURATION API
       Le JS appelle maintenant le backend Python (Flask)
    ========================================================= */
   const API_BASE_URL = 'https://whalesg.pythonanywhere.com';
    // Si vous êtes en développement local, vous pouvez décommenter :
    // const API_BASE_URL = 'http://api/search';

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

    /* =========================================================
       FONCTION : APPEL API VERS PYTHON
    ========================================================= */
    async function callPythonSearch(query) {
        try {
            // Construction de l'URL - utilise le même domaine que la page
            const baseUrl = API_BASE_URL || window.location.origin;
            const url = `${baseUrl}/api/search?q=${encodeURIComponent(query)}`;
            
            console.log(`🔍 Recherche: "${query}" → ${url}`);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            // L'API retourne directement un tableau de résultats
            // ou un tableau vide si rien trouvé
            if (Array.isArray(data)) {
                return data;
            }
            
            // Si l'API retourne un objet avec un champ results
            if (data.results && Array.isArray(data.results)) {
                return data.results;
            }
            
            // Sinon, retourner un tableau vide
            return [];
            
        } catch (err) {
            console.error('❌ Erreur de connexion au backend Python:', err);
            return [];
        }
    }

    /* =========================================================
       FONCTION : EXTRAIT PERTINENT
    ========================================================= */
    function normaliser(txt) {
        return (txt || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    }

    function extraitPertinent(item, valeur) {
        // Si l'API a déjà fourni un extrait
        if (item.extrait) return item.extrait;
        if (item.desc && item.desc.length > 0) return item.desc;

        const mots = normaliser(valeur).split(/\s+/).filter(Boolean);
        const texteN = normaliser(item.text || '');
        const texteOriginal = item.text || '';

        if (mots.length === 0 || !texteOriginal) return item.desc || '';

        let position = -1;
        for (const mot of mots) {
            const idx = texteN.indexOf(mot);
            if (idx !== -1) { position = idx; break; }
        }

        if (position === -1) {
            // Retourner les premiers caractères du texte
            return texteOriginal.substring(0, 150) + (texteOriginal.length > 150 ? '…' : '');
        }

        const debut = Math.max(0, position - 40);
        const fin = Math.min(texteOriginal.length, position + 80);
        let extrait = texteOriginal.substring(debut, fin).trim();
        if (debut > 0) extrait = '…' + extrait;
        if (fin < texteOriginal.length) extrait = extrait + '…';
        return extrait;
    }

    function pageActuelle() {
        const nom = location.pathname.split('/').pop();
        return nom === '' || nom === '' ? 'index.html' : nom;
    }

    function allerVersCible(item) {
        const cible = item.page || 'index.html';
        const surLaBonnePage = cible === pageActuelle();

        if (surLaBonnePage && item.anchor && item.anchor !== '#') {
            const el = document.querySelector(item.anchor);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return;
            }
        }
        if (!surLaBonnePage) {
            const targetUrl = cible + (item.anchor || '');
            window.location.href = targetUrl;
        }
    }

    function ouvrirResume(item) {
        if (!summaryPanel) return;
        summaryTitleText.textContent = item.title || 'Sans titre';
        summaryText.textContent = item.text || item.desc || 'Aucune description disponible.';
        summaryLink.onclick = function (e) {
            e.preventDefault();
            allerVersCible(item);
            fermerResultats();
            fermerResume();
        };
        summaryPanel.style.display = 'block';
    }

    function fermerResume() {
        if (summaryPanel) {
            summaryPanel.style.display = 'none';
        }
    }

    function fermerResultats() {
        if (searchResults) {
            searchResults.classList.remove('active');
            searchResults.innerHTML = '';
        }
    }

    /* =========================================================
       AFFICHAGE DES RÉSULTATS
    ========================================================= */
    function afficherResultats(resultats, valeur) {
        if (!searchResults) return;
        searchResults.innerHTML = '';

        if (!resultats || resultats.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'search-result-item';
            
            const icon = document.createElement('i');
            icon.className = 'fa-solid fa-circle-info';
            
            const titleSpan = document.createElement('span');
            titleSpan.className = 'result-title';
            titleSpan.textContent = 'Aucun résultat';
            
            const descSpan = document.createElement('span');
            descSpan.className = 'result-desc';
            descSpan.textContent = `Essayez un autre mot : « marbre », « maire », « contact »…`;
            
            empty.appendChild(icon);
            empty.appendChild(titleSpan);
            empty.appendChild(descSpan);
            searchResults.appendChild(empty);
            searchResults.classList.add('active');
            return;
        }

        // Limiter l'affichage aux 8 meilleurs résultats
        resultats.slice(0, 8).forEach(item => {
            const row = document.createElement('div');
            row.className = 'search-result-item';

            // Icône - sécurité : nettoyer le nom de l'icône
            const icon = document.createElement('i');
            let iconName = (item.icon || 'fa-magnifying-glass');
            // Nettoyer l'icône pour éviter le XSS
            iconName = iconName.replace(/[^a-z0-9-\s]/gi, '').trim();
            if (!iconName || iconName === '') iconName = 'fa-magnifying-glass';
            icon.className = `fa-solid ${iconName}`;

            // Titre
            const titleSpan = document.createElement('span');
            titleSpan.className = 'result-title';
            titleSpan.textContent = item.title || 'Sans titre';

            // Description / Extrait
            const descSpan = document.createElement('span');
            descSpan.className = 'result-desc';
            const extrait = extraitPertinent(item, valeur);
            descSpan.textContent = extrait || 'Aucune description.';

            // Bouton résumé
            const summaryBtn = document.createElement('button');
            summaryBtn.type = 'button';
            summaryBtn.className = 'summary-toggle';
            summaryBtn.textContent = 'Résumé';

            row.appendChild(icon);
            row.appendChild(titleSpan);
            row.appendChild(descSpan);
            row.appendChild(summaryBtn);

            // Clic sur la ligne → navigation
            row.addEventListener('click', function (e) {
                if (e.target.closest('.summary-toggle')) return;
                allerVersCible(item);
                fermerResultats();
                if (searchInput) searchInput.value = '';
            });

            // Clic sur "Résumé" → afficher le résumé
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

    let debounceTimer;

    // Recherche en temps réel avec debounce
    searchInput.addEventListener('input', async function () {
        const valeur = this.value.trim();
        
        if (valeur === '') {
            fermerResultats();
            return;
        }

        if (valeur.length < 2) {
            // Ne pas chercher avec moins de 2 caractères
            return;
        }

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            const resultats = await callPythonSearch(valeur);
            afficherResultats(resultats, valeur);
        }, 300);
    });

    // Réafficher les résultats si l'input reprend le focus
    searchInput.addEventListener('focus', async function () {
        const valeur = this.value.trim();
        if (valeur.length >= 2) {
            const resultats = await callPythonSearch(valeur);
            afficherResultats(resultats, valeur);
        }
    });

    // Soumission du formulaire → ouvrir le premier résultat
    searchForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const valeur = searchInput.value.trim();
        if (valeur.length < 2) return;
        
        const resultats = await callPythonSearch(valeur);
        if (resultats && resultats.length > 0) {
            ouvrirResume(resultats[0]);
        } else {
            afficherResultats([], valeur);
        }
    });

    // Fermer le résumé
    if (summaryClose) {
        summaryClose.addEventListener('click', fermerResume);
    }

    // Clic en dehors pour fermer
    document.addEventListener('click', function (e) {
        const searchContainer = e.target.closest('.search');
        const summaryContainer = e.target.closest('#summaryPanel');
        const summaryBtn = e.target.closest('.summary-toggle');
        
        if (!searchContainer) {
            fermerResultats();
        }
        if (!summaryContainer && !summaryBtn) {
            fermerResume();
        }
    });

    // Touche Échap pour fermer
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            fermerResultats();
            fermerResume();
            if (searchInput) searchInput.blur();
        }
    });

    console.log('🔍 Moteur de recherche OUESSE initialisé');
    console.log(`📡 API endpoint: ${API_BASE_URL || window.location.origin}/api/search`);
});
