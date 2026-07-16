/* ============================================
   1. MENU HAMBURGER (mobile)
============================================ */
const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');

if (menuToggle && mainNav) {
  menuToggle.addEventListener('click', () => {
    mainNav.classList.toggle('active');
  });

  // Ferme le menu automatiquement quand on clique sur un lien (mobile)
  const navLinks = mainNav.querySelectorAll('a');
  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      mainNav.classList.remove('active');
    });
  });
}

/* ============================================
   2. LIEN ACTIF DANS LA NAVIGATION
   Ajoute la classe "active" sur le lien cliqué
   et l'enlève des autres
============================================ */
const allNavLinks = document.querySelectorAll('.main-nav a');

allNavLinks.forEach((link) => {
  link.addEventListener('click', () => {
    allNavLinks.forEach((l) => l.classList.remove('active'));
    link.classList.add('active');
  });
});

/* ============================================
   3. BARRE DE RECHERCHE (hero)
============================================ */
const searchForm = document.querySelector('.search');

if (searchForm) {
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault(); // empêche le rechargement de la page

    const input = searchForm.querySelector('input');
    const query = input.value.trim();

    if (query === '') {
      alert('Veuillez entrer un lieu ou une expérience à rechercher.');
      return;
    }

    // Ici tu pourras plus tard rediriger vers une page de résultats, par exemple :
    // window.location.href = `recherche.html?q=${encodeURIComponent(query)}`;

    console.log('Recherche effectuée :', query);
    alert(`Recherche en cours pour : "${query}"`);
    input.value = '';
  });
}

/* ============================================
   4. FORMULAIRE NEWSLETTER (footer)
============================================ */
const newsletterInput = document.querySelector('.pied input[type="email"]');

if (newsletterInput) {
  // On écoute le formulaire parent s'il existe, sinon on gère le champ directement
  const newsletterParent = newsletterInput.closest('form') || newsletterInput.parentElement;

  newsletterParent.addEventListener('submit', (e) => {
    e.preventDefault();
    handleNewsletterSubmit();
  });

  // Sécurité : permet aussi de valider avec la touche Entrée si ce n'est pas un <form>
  newsletterInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && newsletterParent.tagName !== 'FORM') {
      e.preventDefault();
      handleNewsletterSubmit();
    }
  });

  function handleNewsletterSubmit() {
    const email = newsletterInput.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      alert('Merci d\'entrer une adresse email valide.');
      return;
    }

    console.log('Inscription newsletter :', email);
    alert('Merci pour votre inscription à la newsletter !');
    newsletterInput.value = '';
  }
}

/* ============================================
   5. DÉFILEMENT FLUIDE (smooth scroll)
   Pour tous les liens internes commençant par #
============================================ */
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', function (e) {
    const targetId = this.getAttribute('href');

    // On ignore les liens vides "#"
    if (targetId.length > 1) {
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    }
  });
});

/* ============================================
   6. GALERIE PHOTO — ouverture en grand (lightbox simple)
============================================ */
const galleryImages = document.querySelectorAll('.gallery-container img');

if (galleryImages.length > 0) {
  // Création de la boîte lightbox une seule fois
  const lightbox = document.createElement('div');
  lightbox.classList.add('lightbox');
  lightbox.innerHTML = '<span class="lightbox-close">&times;</span><img src="" alt="">';
  document.body.appendChild(lightbox);

  const lightboxImg = lightbox.querySelector('img');
  const lightboxClose = lightbox.querySelector('.lightbox-close');

  galleryImages.forEach((img) => {
    img.addEventListener('click', () => {
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt;
      lightbox.classList.add('active');
    });
  });

  const closeLightbox = () => lightbox.classList.remove('active');

  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });
}

/* ============================================
   7. CARTES DE CATÉGORIE — retour console (debug)
   Utile en attendant d'avoir de vraies pages de destination
============================================ */
document.querySelectorAll('.category-card').forEach((card) => {
  card.addEventListener('click', (e) => {
    const label = card.querySelector('.category-label')?.textContent;
    console.log('Catégorie sélectionnée :', label);
    // Si le href est encore "#", on évite un saut de page vide
    if (card.getAttribute('href') === '#') {
      e.preventDefault();
    }
  });
});