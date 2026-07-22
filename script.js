document.addEventListener('DOMContentLoaded', function() {

    // ===== MENU MOBILE =====
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

    // ===== LIGHTBOX =====
    var images = document.querySelectorAll('img[data-lightbox="true"]');
    images.forEach(function(img) {
        img.addEventListener('click', function(e) {
            e.preventDefault();
            var overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100vw';
            overlay.style.height = '100vh';
            overlay.style.backgroundColor = 'rgba(0,0,0,0.85)';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.zIndex = '9999';
            overlay.style.cursor = 'pointer';
            overlay.style.padding = '20px';
            overlay.style.boxSizing = 'border-box';

            var enlarged = document.createElement('img');
            var src = img.getAttribute('src');
            var srcset = img.getAttribute('srcset');
            if (srcset) {
                var parts = srcset.split(',');
                var last = parts[parts.length-1].trim();
                var lastSrc = last.split(' ')[0];
                if (lastSrc) src = lastSrc;
            }
            enlarged.src = src;
            enlarged.style.maxWidth = '90%';
            enlarged.style.maxHeight = '90%';
            enlarged.style.objectFit = 'contain';
            enlarged.style.borderRadius = '8px';
            enlarged.style.boxShadow = '0 20px 60px rgba(0,0,0,0.6)';

            overlay.appendChild(enlarged);
            document.body.appendChild(overlay);

            overlay.addEventListener('click', function() {
                overlay.remove();
            });
            document.addEventListener('keydown', function escHandler(e) {
                if (e.key === 'Escape') {
                    if (document.body.contains(overlay)) {
                        overlay.remove();
                        document.removeEventListener('keydown', escHandler);
                    }
                }
            });
        });
    });

    // ===== YOUTUBE FACADE =====
    var facade = document.getElementById('ytFacade');
    if (facade) {
        facade.addEventListener('click', function() {
            var id = this.dataset.videoId;
            var iframe = document.createElement('iframe');
            iframe.src = 'https://www.youtube.com/embed/' + id + '?autoplay=1';
            iframe.width = '560';
            iframe.height = '315';
            iframe.title = 'WAOUESSE – Découvrez Ouèssè en vidéo';
            iframe.frameBorder = '0';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            iframe.allowFullscreen = true;
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.borderRadius = '12px';
            this.replaceWith(iframe);
        }, { once: true });
    }

    // ===== CARROUSEL =====
    const track = document.getElementById('carouselTrack');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const dotsContainer = document.getElementById('carouselDots');

    if (track) {
        const cards = track.querySelectorAll('.category-card');
        const total = cards.length;
        let currentIndex = 0;
        let autoplayInterval = null;
        let visibleCount = window.innerWidth <= 768 ? 1 : 3;

        // Créer les points
        const dots = [];
        for (let i = 0; i < Math.ceil(total / visibleCount); i++) {
            const dot = document.createElement('button');
            dot.setAttribute('role', 'tab');
            dot.setAttribute('aria-label', 'Aller à la diapositive ' + (i + 1));
            dot.addEventListener('click', function() {
                goToSlide(i);
                resetAutoplay();
            });
            dotsContainer.appendChild(dot);
            dots.push(dot);
        }

        function updateVisibleCount() {
            visibleCount = window.innerWidth <= 768 ? 1 : 3;
            const newDotCount = Math.ceil(total / visibleCount);
            while (dotsContainer.firstChild) {
                dotsContainer.removeChild(dotsContainer.firstChild);
            }
            dots.length = 0;
            for (let i = 0; i < newDotCount; i++) {
                const dot = document.createElement('button');
                dot.setAttribute('role', 'tab');
                dot.setAttribute('aria-label', 'Aller à la diapositive ' + (i + 1));
                dot.addEventListener('click', function() {
                    goToSlide(i);
                    resetAutoplay();
                });
                dotsContainer.appendChild(dot);
                dots.push(dot);
            }
            if (currentIndex >= dots.length) {
                currentIndex = 0;
            }
            updateCarousel();
            updateDots();
        }

        function updateCarousel() {
            const slideWidth = 100 / visibleCount;
            const offset = -currentIndex * slideWidth * visibleCount;
            track.style.transform = 'translateX(' + offset + '%)';
        }

        function updateDots() {
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === currentIndex);
            });
        }

        function goToSlide(index) {
            if (index < 0) index = dots.length - 1;
            if (index >= dots.length) index = 0;
            currentIndex = index;
            updateCarousel();
            updateDots();
        }

        function nextSlide() {
            goToSlide(currentIndex + 1);
        }

        function prevSlide() {
            goToSlide(currentIndex - 1);
        }

        function startAutoplay() {
            if (autoplayInterval) clearInterval(autoplayInterval);
            autoplayInterval = setInterval(nextSlide, 4000);
        }

        function resetAutoplay() {
            if (autoplayInterval) {
                clearInterval(autoplayInterval);
                startAutoplay();
            }
        }

        function stopAutoplay() {
            if (autoplayInterval) {
                clearInterval(autoplayInterval);
                autoplayInterval = null;
            }
        }

        // Événements
        // BUG CORRIGÉ : prevBtn/nextBtn n'étaient pas vérifiés avant l'ajout
        // de l'écouteur. Si une page avait #carouselTrack sans les boutons
        // #prevBtn/#nextBtn (structure HTML incomplète), ceci levait une
        // TypeError qui interrompait l'exécution de tout le reste du script.
        if (prevBtn) {
            prevBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                prevSlide();
                resetAutoplay();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                nextSlide();
                resetAutoplay();
            });
        }

        // BUG CORRIGÉ : track.closest() peut renvoyer null si le balisage
        // ne contient pas de parent .carousel-wrapper.
        const wrapper = track.closest('.carousel-wrapper');
        if (wrapper) {
            wrapper.addEventListener('mouseenter', stopAutoplay);
            wrapper.addEventListener('mouseleave', startAutoplay);
        }

        let resizeTimeout;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(updateVisibleCount, 250);
        });

        updateVisibleCount();
        startAutoplay();
    }

});