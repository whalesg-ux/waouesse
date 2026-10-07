/**
 * js/progressive-reveal.js
 * Chargement progressif des sections au scroll (IntersectionObserver).
 *
 * Usage HTML :
 *   Ajouter la classe "reveal" sur n'importe quel élément à révéler.
 *   Les variantes optionnelles :
 *     - "reveal--delay-1" à "reveal--delay-5" : retard d'animation (100ms – 500ms)
 *     - "reveal--from-left" / "reveal--from-right" : direction d'entrée
 *
 * Ce script est non bloquant : il ne fait rien si IntersectionObserver
 * n'est pas disponible (vieux navigateurs).
 */
(function () {
    'use strict';

    // Pas de IntersectionObserver → on rend tout visible sans animation
    if (!('IntersectionObserver' in window)) {
        document.querySelectorAll('.reveal').forEach(function (el) {
            el.classList.add('reveal--visible');
        });
        return;
    }

    // Options de l'observer
    var observerOptions = {
        root: null,
        rootMargin: '0px 0px -60px 0px', // déclenche légèrement avant le bas de l'écran
        threshold: 0.12
    };

    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('reveal--visible');
                // On arrête d'observer une fois révélé (révélation unique)
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observer tous les éléments .reveal présents dans le DOM
    function observeAll() {
        document.querySelectorAll('.reveal').forEach(function (el) {
            observer.observe(el);
        });
    }

    // Attendre que le DOM soit prêt
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', observeAll);
    } else {
        observeAll();
    }
})();
