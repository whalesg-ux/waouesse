// js/search-static.js - Version sans backend (100% statique)

document.addEventListener('DOMContentLoaded', function () {

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

    let searchIndex = [];

    /* =========================================================
        CHARGER L'INDEX JSON
    ========================================================= */
    async function loadSearchIndex() {
        try {
            const response = await fetch('/data/search-index.json');
            if (!response.ok) throw new Error('Index non trouvé');
            searchIndex = await response.json();
            console.log(`🔍 Index chargé: ${searchIndex.length} pages`);
            return true;
        } catch (error) {
            console.error('❌ Erreur chargement index:', error);
            searchIndex = [];
            return false;
        }
    }

    /* =========================================================
        FONCTIONS DE RECHERCHE
    ========================================================= */
    function normaliser(texte) {
        if (!texte) return '';
        return texte
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    }

    function rechercher(query) {
        if (!searchIndex || searchIndex.length === 0) return [];
        if (!query || query.trim().length < 2) return [];

        const motsRecherche = normaliser(query).split(/\s+/);
        
        const resultats = searchIndex.map(page => {
            let score = 0;
            
            const titre = normaliser(page.title);
            const description = normaliser(page.description || '');
            const keywords = normaliser(page.keywords || '');
            const contenu = normaliser(page.content || '');
            
            for (const mot of motsRecherche) {
                if (mot.length < 2) continue;
                
                if (titre.includes(mot)) {
                    score += 10;
                    if (titre.startsWith(mot)) score += 5;
                }
                if (keywords.includes(mot)) score += 5;
                if (description.includes(mot)) score += 4;
                if (contenu.includes(mot)) {
                    score += 1;
                    const occurrences = (contenu.match(new RegExp(mot, 'g')) || []).length;
                    score += Math.min(occurrences, 5);
                }
            }
            
            return { ...page, score };
        });

        return resultats
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
    }

    /* =========================================================
        AFFICHAGE DES RÉSULTATS
    ========================================================= */
    function extraitPertinent(item, query) {
        if (item.description && item.description.length > 0) return item.description;
        if (!item.content) return '';
        
        const mots = normaliser(query).split(/\s+/).filter(Boolean);
        const texteN = normaliser(item.content);
        const texteOriginal = item.content;

        if (mots.length === 0) return item.content.substring(0, 150) + '…';

        let position = -1;
        for (const mot of mots) {
            const idx = texteN.indexOf(mot);
            if (idx !== -1) { position = idx; break; }
        }

        if (position === -1) {
            return texteOriginal.substring(0, 150) + (texteOriginal.length > 150 ? '…' : '');
        }

        const debut = Math.max(0, position - 40);
        const fin = Math.min(texteOriginal.length, position + 80);
        let extrait = texteOriginal.substring(debut, fin).trim();
        if (debut > 0) extrait = '…' + extrait;
        if (fin < texteOriginal.length) extrait = extrait + '…';
        return extrait;
    }

    function afficherResultats(resultats, query) {
        if (!searchResults) return;
        searchResults.innerHTML = '';

        if (!resultats || resultats.length === 0) {
            searchResults.innerHTML = `
                <div class="search-result-item no-result">
                    <i class="fa-solid fa-search"></i>
                    <span>Aucun résultat pour "<strong>${query}</strong>"</span>
                </div>
            `;
            searchResults.classList.add('active');
            return;
        }

        resultats.slice(0, 8).forEach(item => {
            const row = document.createElement('div');
            row.className = 'search-result-item';

            const icon = document.createElement('i');
            icon.className = `fa-solid ${item.icon || 'fa-magnifying-glass'}`;

            const titleSpan = document.createElement('span');
            titleSpan.className = 'result-title';
            titleSpan.textContent = item.title || 'Sans titre';

            const descSpan = document.createElement('span');
            descSpan.className = 'result-desc';
            descSpan.textContent = extraitPertinent(item, query);

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
                window.location.href = item.url || item.page || '#';
            });

            // Clic sur "Résumé"
            summaryBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (summaryPanel) {
                    summaryTitleText.textContent = item.title || 'Sans titre';
                    summaryText.textContent = item.content || item.description || 'Aucune description disponible.';
                    summaryLink.onclick = function (e) {
                        e.preventDefault();
                        window.location.href = item.url || item.page || '#';
                    };
                    summaryPanel.style.display = 'block';
                }
            });

            searchResults.appendChild(row);
        });

        searchResults.classList.add('active');
    }

    /* =========================================================
        ÉVÉNEMENTS
    ========================================================= */
    let debounceTimer;

    searchInput.addEventListener('input', function () {
        const valeur = this.value.trim();
        if (valeur === '') {
            searchResults.classList.remove('active');
            searchResults.innerHTML = '';
            return;
        }
        if (valeur.length < 2) return;

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const resultats = rechercher(valeur);
            afficherResultats(resultats, valeur);
        }, 300);
    });

    searchInput.addEventListener('focus', function () {
        const valeur = this.value.trim();
        if (valeur.length >= 2) {
            const resultats = rechercher(valeur);
            afficherResultats(resultats, valeur);
        }
    });

    searchForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const valeur = searchInput.value.trim();
        if (valeur.length < 2) return;
        const resultats = rechercher(valeur);
        afficherResultats(resultats, valeur);
    });

    if (summaryClose) {
        summaryClose.addEventListener('click', function () {
            if (summaryPanel) summaryPanel.style.display = 'none';
        });
    }

    document.addEventListener('click', function (e) {
        const searchContainer = e.target.closest('.search');
        const summaryContainer = e.target.closest('#summaryPanel');
        const summaryBtn = e.target.closest('.summary-toggle');
        
        if (!searchContainer && !summaryBtn) {
            searchResults.classList.remove('active');
            searchResults.innerHTML = '';
        }
        if (!summaryContainer && !summaryBtn) {
            if (summaryPanel) summaryPanel.style.display = 'none';
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            searchResults.classList.remove('active');
            searchResults.innerHTML = '';
            if (summaryPanel) summaryPanel.style.display = 'none';
            if (searchInput) searchInput.blur();
        }
    });

    /* =========================================================
        INITIALISATION
    ========================================================= */
    // Charger l'index
    loadSearchIndex().then(success => {
        if (success) {
            console.log('✅ Index de recherche chargé');
            
            // Vérifier si une recherche est dans l'URL
            const paramsUrl = new URLSearchParams(window.location.search);
            const requeteUrl = (paramsUrl.get('q') || '').trim();
            if (requeteUrl.length >= 2) {
                searchInput.value = requeteUrl;
                const resultats = rechercher(requeteUrl);
                afficherResultats(resultats, requeteUrl);
            }
        } else {
            console.warn('⚠️ Index non chargé, recherche désactivée');
        }
    });

    console.log('🔍 Moteur de recherche statique initialisé');
});