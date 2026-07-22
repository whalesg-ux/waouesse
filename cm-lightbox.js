/**
 * ============================================================
 * CM-LIGHTBOX — Visionneuse d'images
 * ============================================================
 * S'active sur les images avec data-full et data-caption
 */

(function () {
    'use strict';

    const overlay   = document.getElementById('lightbox');
    const img       = document.getElementById('lightboxImg');
    const caption   = document.getElementById('lightboxCaption');
    const closeBtn  = document.getElementById('lightboxClose');

    if (!overlay) return; // Pas de lightbox sur cette page

    // Ouvrir la lightbox au clic sur une image de galerie
    document.querySelectorAll('.image-gallery img[data-full]').forEach(thumb => {
        thumb.style.cursor = 'zoom-in';
        thumb.addEventListener('click', () => {
            img.src = thumb.dataset.full;
            caption.textContent = thumb.dataset.caption || '';
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    });

    // Fermer au clic sur le bouton ×
    closeBtn.addEventListener('click', closeLightbox);

    // Fermer au clic sur le fond noir
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeLightbox();
    });

    // Fermer avec la touche Échap
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
            closeLightbox();
        }
    });

    function closeLightbox() {
        overlay.classList.remove('active');
        img.src = '';
        document.body.style.overflow = '';
    }

})();