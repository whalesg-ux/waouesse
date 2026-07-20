/**
 * search.js – Moteur de recherche avec résumé intégré (bot)
 * Charge search-index.json, affiche les résultats et permet d'afficher un résumé au clic.
 */

document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchInput');
    const searchForm = document.getElementById('searchForm');
    const resultsContainer = document.getElementById('searchResults');

    if (!searchInput || !resultsContainer) return;

    let searchIndex = [];

    // Charger l'index
    fetch('/search-index.json')
        .then(response => {
            if (!response.ok) throw new Error('Fichier search-index.json introuvable');
            return response.json();
        })
        .then(data => {
            searchIndex = data;
        })
        .catch(err => {
            console.warn('Erreur chargement index :', err);
            // Fallback minimal
            searchIndex = [
                { title: 'Accueil', desc: 'Page principale', summary: 'Bienvenue sur Ouèssè Tourisme.', url: '/index.html', icon: 'fa-house' },
                { title: 'Découvrir', desc: 'Découvrez Ouèssè', summary: 'Jeunesse, culture, défis.', url: '/decouvert.html', icon: 'fa-compass' },
                { title: 'Contact', desc: 'Nous contacter', summary: 'Écrivez à NarroQ & EzegLabs.', url: '/contact.html', icon: 'fa-envelope' }
            ];
        });

    // Fonction de recherche
    function search(query) {
        const q = query.toLowerCase().trim();
        if (q === '') return [];
        return searchIndex.filter(item => {
            const matchTitle = item.title.toLowerCase().includes(q);
            const matchDesc = item.desc && item.desc.toLowerCase().includes(q);
            const matchKeywords = item.keywords && item.keywords.some(k => k.toLowerCase().includes(q));
            return matchTitle || matchDesc || matchKeywords;
        });
    }

    // Fonction pour afficher le résumé d'un élément
    function showSummary(item) {
        // Créer ou récupérer le panneau de résumé
        let summaryPanel = document.getElementById('summaryPanel');
        if (!summaryPanel) {
            summaryPanel = document.createElement('div');
            summaryPanel.id = 'summaryPanel';
            summaryPanel.className = 'summary-panel';
            resultsContainer.parentNode.insertBefore(summaryPanel, resultsContainer.nextSibling);
        }

        // On masque le panneau s'il est déjà ouvert pour le même élément
        if (summaryPanel.dataset.activeUrl === item.url && summaryPanel.style.display !== 'none') {
            summaryPanel.style.display = 'none';
            summaryPanel.dataset.activeUrl = '';
            return;
        }

        // Remplir le panneau
        summaryPanel.innerHTML = `
            <div class="summary-header">
                <span class="summary-title"><i class="fa-solid ${item.icon || 'fa-circle'}"></i> ${item.title}</span>
                <button class="summary-close" onclick="document.getElementById('summaryPanel').style.display='none'">&times;</button>
            </div>
            <div class="summary-body">
                <p>${item.summary || 'Aucun résumé disponible pour cette page.'}</p>
                <a href="${item.url}" class="summary-link">Voir la page complète →</a>
            </div>
        `;
        summaryPanel.style.display = 'block';
        summaryPanel.dataset.activeUrl = item.url;
    }

    // Fonction pour afficher les résultats de recherche
    function renderResults(results) {
        resultsContainer.innerHTML = '';
        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="search-result-item" style="color:#6b7d74;justify-content:center;cursor:default;">Aucun résultat trouvé</div>';
            resultsContainer.classList.add('active');
            // Masquer le panneau de résumé si aucun résultat
            const panel = document.getElementById('summaryPanel');
            if (panel) panel.style.display = 'none';
            return;
        }

        results.slice(0, 8).forEach(item => {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.innerHTML = `
                <i class="fa-solid ${item.icon || 'fa-circle'}"></i>
                <span class="result-title">${item.title}</span>
                <span class="result-desc">${item.desc || ''}</span>
                <button class="summary-toggle" data-url="${item.url}">📖 Résumé</button>
            `;
            
            // Bouton "Résumé" – affiche le résumé sans quitter la page
            const toggleBtn = div.querySelector('.summary-toggle');
            toggleBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                showSummary(item);
            });

            // Clic sur l'élément (hors bouton) → redirection classique
            div.addEventListener('click', function(e) {
                if (e.target.closest('.summary-toggle')) return;
                if (item.url) {
                    window.location.href = item.url;
                }
                resultsContainer.classList.remove('active');
                searchInput.value = '';
            });

            resultsContainer.appendChild(div);
        });

        resultsContainer.classList.add('active');
    }

    // Gestionnaires d'événements
    searchInput.addEventListener('input', function(e) {
        const query = this.value;
        if (query.length < 2) {
            resultsContainer.classList.remove('active');
            const panel = document.getElementById('summaryPanel');
            if (panel) panel.style.display = 'none';
            return;
        }
        const results = search(query);
        renderResults(results);
    });

    searchForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const query = searchInput.value;
        if (query.length >= 2) {
            const results = search(query);
            if (results.length > 0) {
                // Si un résumé est affiché, on l'utilise, sinon on redirige vers le premier résultat
                const panel = document.getElementById('summaryPanel');
                if (panel && panel.style.display === 'block') {
                    // Ne rien faire, le panneau est déjà affiché
                } else {
                    window.location.href = results[0].url;
                }
            }
        }
        resultsContainer.classList.remove('active');
    });

    // Fermer les résultats et le panneau en cliquant ailleurs
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.search') && !e.target.closest('.search-results') && !e.target.closest('#summaryPanel')) {
            resultsContainer.classList.remove('active');
            const panel = document.getElementById('summaryPanel');
            if (panel) panel.style.display = 'none';
        }
    });

    // Au chargement, cacher le panneau
    const panel = document.getElementById('summaryPanel');
    if (panel) panel.style.display = 'none';
});