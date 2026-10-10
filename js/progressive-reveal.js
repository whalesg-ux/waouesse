/**
 * js/progressive-reveal.js
 * Chargement progressif des sections au scroll (IntersectionObserver).
 * Version ACCÉLÉRÉE pour éviter l'impression de lenteur.
 */
(function () {
    'use strict';

    // Pas de IntersectionObserver → on rend tout visible sans animation
    if (!('IntersectionObserver' in window)) {
        document.querySelectorAll('.reveal').forEach(function (el) {
            el.classList.add('reveal--visible');
        });
        window.revealRefresh = function () {};
        return;
    }

    // Options ACCÉLÉRÉES
    var observerOptions = {
        root: null,
        rootMargin: '0px 0px 300px 0px', // déclenche 300px AVANT l'écran
        threshold: 0.01                   // déclenche dès 1% de visibilité
    };

    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('reveal--visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    function observeAll() {
        document.querySelectorAll('.reveal:not(.reveal--visible)').forEach(function (el) {
            observer.observe(el);
        });
    }

    window.revealRefresh = observeAll;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', observeAll);
    } else {
        observeAll();
    }
})();