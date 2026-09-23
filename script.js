document.addEventListener('DOMContentLoaded', function() {

    // ===== 1. MENU MOBILE =====
    const toggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.main-nav');
    if (toggle && nav) {
        toggle.addEventListener('click', function() {
            const isOpen = nav.classList.toggle('active');
            toggle.setAttribute('aria-expanded', isOpen);
            toggle.innerHTML = isOpen ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
            toggle.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
        });
    }

    // ===== 2. LIGHTBOX SÉCURISÉE =====
    const images = document.querySelectorAll('img:not(header img):not(footer img):not(a img):not(.hero-img-bg)');
    images.forEach(function(img) {
        img.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Récupération de la source haute résolution disponible
            let src = img.currentSrc || img.src || img.getAttribute('src');
            if (!src) return;

            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.inset = '0';
            overlay.style.width = '100vw';
            overlay.style.height = '100vh';
            overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.88)';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.zIndex = '99999';
            overlay.style.cursor = 'zoom-out';
            overlay.style.padding = '20px';
            overlay.style.boxSizing = 'border-box';

            const enlarged = document.createElement('img');
            enlarged.src = src;
            enlarged.alt = img.alt || "Aperçu agrandi";
            enlarged.style.maxWidth = '92%';
            enlarged.style.maxHeight = '92%';
            enlarged.style.objectFit = 'contain';
            enlarged.style.borderRadius = '8px';
            enlarged.style.boxShadow = '0 20px 60px rgba(0,0,0,0.8)';

            overlay.appendChild(enlarged);
            document.body.appendChild(overlay);

            function closeLightbox() {
                if (document.body.contains(overlay)) {
                    overlay.remove();
                    document.removeEventListener('keydown', escHandler);
                }
            }

            function escHandler(e) {
                if (e.key === 'Escape') closeLightbox();
            }

            overlay.addEventListener('click', closeLightbox);
            document.addEventListener('keydown', escHandler);
        });
    });

    // ===== 3. YOUTUBE FACADE SÉCURISÉE =====
    const facade = document.getElementById('ytFacade');
    if (facade) {
        facade.addEventListener('click', function() {
            const id = this.dataset.videoId;
            if (!id) return;
            const iframe = document.createElement('iframe');
            iframe.src = 'https://www.youtube.com/embed/' + id + '?autoplay=1';
            iframe.width = '100%';
            iframe.height = '100%';
            iframe.title = 'WAOUESSE – Découvrez Ouèssè en vidéo';
            iframe.frameBorder = '0';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
            iframe.allowFullscreen = true;
            iframe.style.width = '100%';
            iframe.style.aspectRatio = '16/9';
            iframe.style.borderRadius = '12px';
            this.replaceWith(iframe);
        }, { once: true });
    }

    // ===== 4. GESTION DU DÉFILEMENT MARQUEE (SANS CONFLIT TRANSFORM) =====
    // Le défilement infini est géré à 100% par le CSS (@keyframes scrollContinuous).
    // Le JS n'applique AUCUN style.transform pour ne pas bloquer les images.
    const marqueeTrack = document.querySelector('.marquee-track');
    const marqueeWrapper = document.getElementById('carouselWrapper');
    
    if (marqueeTrack && marqueeWrapper) {
        // Pause propre au survol et au focus pour l'accessibilité
        marqueeWrapper.addEventListener('mouseenter', function() {
            marqueeTrack.style.animationPlayState = 'paused';
        });
        marqueeWrapper.addEventListener('mouseleave', function() {
            marqueeTrack.style.animationPlayState = 'running';
        });
        marqueeWrapper.addEventListener('touchstart', function() {
            marqueeTrack.style.animationPlayState = 'paused';
        }, { passive: true });
        marqueeWrapper.addEventListener('touchend', function() {
            marqueeTrack.style.animationPlayState = 'running';
        }, { passive: true });
    }

});
