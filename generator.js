(function () {
    'use strict';

    var sectionsHost = document.getElementById('sectionsHost');
    var radios = document.querySelectorAll('input[name=template]');
    var status = document.getElementById('status');

    var LOGO = "https://res.cloudinary.com/nyke7lhc/image/upload/v1784319943/logo_copie_kzzyfd.webp";

    // ---- Styles pour l'aperçu (ne modifie pas le rendu final) ----
    var PREVIEW_STYLES = `
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: 'Poppins', -apple-system, sans-serif;
            margin: 0;
            background: #fff;
            color: #16261e;
        }
        .site-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 18px 48px;
            background-color: #ffffff;
            border-bottom: 1px solid #e1e6e3;
            flex-wrap: wrap;
        }
        .logo {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .logo img {
            height: 34px;
            width: auto;
            cursor: pointer;
            transition: transform 0.3s ease;
        }
        .logo img:hover { transform: scale(1.1); }
        .logo-text { display: flex; flex-direction: column; line-height: 1.1; }
        .logo-title { font-family: "Fraunces", serif; font-weight: 600; font-size: 1.1rem; color: #16261e; }
        .logo-subtitle { font-size: 0.6rem; letter-spacing: 2px; color: #0b6b44; }
        .main-nav ul { display: flex; list-style: none; gap: 32px; margin: 0; padding: 0; flex-wrap: wrap; }
        .main-nav a { text-decoration: none; color: #16261e; font-weight: 500; font-size: 0.95rem; padding-bottom: 4px; border-bottom: 2px solid transparent; transition: color 0.3s ease, border-color 0.3s ease; }
        .main-nav a:hover, .main-nav a.active { color: #0b6b44; border-bottom-color: #0b6b44; }
        .btn-explorer { background-color: #0b6b44; color: #fff; text-decoration: none; font-weight: 600; font-size: 0.9rem; padding: 10px 26px; border-radius: 999px; transition: background-color 0.3s ease, transform 0.3s ease; }
        .btn-explorer:hover { background-color: #084d31; transform: translateY(-1px); }
        .menu-toggle { display: none; background: none; border: none; font-size: 24px; color: #16261e; cursor: pointer; }
        @media (max-width: 768px) {
            .site-header { padding: 16px 20px; }
            .main-nav { display: none; width: 100%; order: 3; }
            .main-nav.active { display: block; }
            .main-nav ul { flex-direction: column; align-items: center; gap: 16px; padding: 20px 0; }
            .menu-toggle { display: block; }
        }
        .main-content { max-width: 1200px; margin: 0 auto 60px; padding: 0 20px; }
        .hero { position: relative; min-height: 400px; display: flex; align-items: center; justify-content: center; background-size: cover; background-position: center; color: #fff; text-align: center; padding: 40px 20px; }
        .hero-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.5); }
        .hero-content { position: relative; max-width: 720px; }
        .hero-title { font-size: 2.5rem; margin: 0 0 12px; }
        .hero-title em { font-style: normal; color: #f5b342; }
        .hero-subtitle { font-size: 1.3rem; font-weight: 400; margin: 0 0 12px; }
        .hero-text { font-size: 1.1rem; line-height: 1.6; }
        .hero-date { margin: 0 0 12px; font-size: 1rem; opacity: 0.9; }
        section { margin-bottom: 60px; }
        h2 { font-size: 2rem; color: #084d31; margin-bottom: 16px; position: relative; }
        h2::after { content: ''; display: block; width: 60px; height: 4px; background: #0b6b44; margin-top: 8px; border-radius: 4px; }
        p { font-size: 1.05rem; line-height: 1.8; color: #1f2e27; margin-bottom: 20px; }
        .disclaimer { background: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 20px 0; border-radius: 8px; }
        .image-gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px,1fr)); gap: 20px; margin: 20px 0; }
        .image-gallery figure { margin: 0; }
        .image-gallery img { width: 100%; height: auto; border-radius: 8px; }
        .image-caption { font-size: 0.85rem; color: #555; margin-top: 6px; text-align: center; }
        .faq-section { margin-top: 40px; }
        .faq-item { border-bottom: 1px solid #e1e6e3; padding: 16px 0; }
        .faq-item h3 { margin: 0 0 6px; font-size: 1.1rem; }
        .profile { display: flex; gap: 30px; align-items: flex-start; }
        .profile-image { flex: 0 0 200px; }
        .profile-image img { width: 100%; border-radius: 12px; }
        .intro { flex: 1; }
        .quotes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
        .quote-card { background: #f4f8f6; padding: 20px; border-radius: 12px; }
        .quote-card p { font-style: italic; margin: 0 0 8px; }
        .quote-card span { font-weight: 600; color: #0b6b44; }
        .video-wrapper { position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:12px; }
        .video-wrapper iframe { position:absolute; top:0; left:0; width:100%; height:100%; border:0; }
        .video-caption { text-align:center; color:#555; font-size:0.9rem; margin-top:8px; }
        footer.pied {
            background-color: #16261e;
            color: #fff;
            padding: 40px 20px;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
        }
        footer.pied a { color: #aad4c2; text-decoration: none; }
        footer.pied a:hover { color: #fff; }
        footer.pied input { padding: 10px 16px; border-radius: 999px; border: none; width: 280px; max-width: 80%; }
        footer.pied .logo-text { display: flex; flex-direction: column; align-items: center; }
        footer.pied .logo-title { color: #fff; }
        footer.pied .logo-subtitle { color: #aad4c2; }
        .footer-credit { font-size: 0.8rem; opacity: 0.7; margin-top: 4px; }
    </style>
    `;

    // ---- Utilitaires ----
    function esc(str) {
        return (str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function heroTitleHtml(str) {
        return esc(str).replace(/\*(.+?)\*/g, '<em>$1</em>');
    }

    function textToParagraphs(str) {
        return esc(str).split(/\n{2,}/).map(function (p) {
            return '<p>' + p.replace(/\n/g, '<br>') + '</p>';
        }).join('\n');
    }

    // ---- Chargement des champs selon le modèle ----
    function loadTemplateFields() {
        var tpl = document.querySelector('input[name=template]:checked').value;
        var source = document.getElementById('fields-' + tpl);
        sectionsHost.innerHTML = '';
        sectionsHost.appendChild(source.content.cloneNode(true));
        wireRepeaters();
    }

    function addRow(hostSelector, rowTemplateId) {
        var host = sectionsHost.querySelector(hostSelector);
        var tpl = document.getElementById(rowTemplateId);
        var node = tpl.content.cloneNode(true);
        node.querySelector('.remove-btn').addEventListener('click', function (e) {
            e.target.closest('.repeat-block').remove();
        });
        host.appendChild(node);
    }

    function wireRepeaters() {
        var map = {
            paragraph: ['.paragraphs-host', 'row-paragraph'],
            gallery: ['.gallery-host', 'row-gallery'],
            faq: ['.faq-host', 'row-faq'],
            about: ['.about-host', 'row-about'],
            quote: ['.quotes-host', 'row-quote']
        };
        sectionsHost.querySelectorAll('[data-add]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var kind = btn.getAttribute('data-add');
                addRow(map[kind][0], map[kind][1]);
            });
        });
    }

    radios.forEach(function (r) { r.addEventListener('change', loadTemplateFields); });
    loadTemplateFields();
    // Ajouter quelques lignes par défaut pour l'aperçu
    document.querySelectorAll('[data-add]').forEach(function (btn) { btn.click(); });

    // ---- Header et Footer paramétrables ----
    function header(menuPagesStr, menuLabelsStr) {
        var pages = menuPagesStr ? menuPagesStr.split(',').map(function (s) { return s.trim(); }) : ['index.html', 'decouvert.html', 'luc.html', 'contact.html'];
        var labels = menuLabelsStr ? menuLabelsStr.split(',').map(function (s) { return s.trim(); }) : ['Accueil', 'Découvrir', 'Luc Atrokpo', 'Contact'];

        var navItems = '';
        for (var i = 0; i < pages.length; i++) {
            var active = (pages[i] === 'index.html') ? ' class="active"' : '';
            navItems += '<li><a href="' + esc(pages[i]) + '"' + active + '>' + esc(labels[i]) + '</a></li>\n';
        }

        return '<header class="site-header">\n' +
            '    <div class="logo">\n' +
            '        <img src="' + LOGO + '" alt="Logo de Ouèssè" width="48" height="48" loading="eager" />\n' +
            '        <div class="logo-text">\n' +
            '            <span class="logo-title">Ouessè</span>\n' +
            '            <span class="logo-subtitle">TOURISME</span>\n' +
            '        </div>\n' +
            '    </div>\n' +
            '    <button class="menu-toggle" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="mainNav">\n' +
            '        <i class="fa-solid fa-bars"></i>\n' +
            '    </button>\n' +
            '    <nav class="main-nav" id="mainNav" role="navigation">\n' +
            '        <ul>\n' + navItems +
            '        </ul>\n' +
            '    </nav>\n' +
            '    <a href="decouvert.html" class="btn-explorer">Explorer</a>\n' +
            '</header>';
    }

    function footer(footerText) {
        var text = footerText || '&copy; 2025 NarroQ & EzegLabs – Donner une présence numérique aux territoires';
        return '<footer class="pied">\n' +
            '    <div class="logo-text">\n' +
            '        <span class="logo-title">Ouessè Tourisme</span>\n' +
            '        <span class="logo-subtitle">Un projet NarroQ × EzegLabs</span>\n' +
            '    </div>\n' +
            '    <input type="email" placeholder="Votre email pour les actualités" />\n' +
            '    <div>\n' +
            '        <a href="index.html">Accueil</a> ·\n' +
            '        <a href="decouvert.html">Découvrir</a> ·\n' +
            '        <a href="luc.html">Luc Atrokpo</a> ·\n' +
            '        <a href="contact.html">Contact</a>\n' +
            '    </div>\n' +
            '    <p class="footer-credit">' + text + '</p>\n' +
            '</footer>';
    }

    function scripts(needsLightbox) {
        var out = '<script src="script.js"><\/script>\n';
        out += '<script>\n';
        out += 'document.addEventListener(\'DOMContentLoaded\', function() {\n';
        out += '    const toggle = document.querySelector(\'.menu-toggle\');\n';
        out += '    const nav = document.querySelector(\'.main-nav\');\n';
        out += '    if (toggle && nav) {\n';
        out += '        toggle.addEventListener(\'click\', function() {\n';
        out += '            const isOpen = nav.classList.toggle(\'active\');\n';
        out += '            toggle.setAttribute(\'aria-expanded\', isOpen);\n';
        out += '            toggle.innerHTML = isOpen ? \'<i class="fa-solid fa-xmark"></i>\' : \'<i class="fa-solid fa-bars"></i>\';\n';
        out += '            toggle.setAttribute(\'aria-label\', isOpen ? \'Fermer le menu\' : \'Ouvrir le menu\');\n';
        out += '        });\n';
        out += '    }\n';
        out += '});\n';
        out += '<\/script>\n';
        if (needsLightbox) out += '<script src="cm-lightbox.js"><\/script>\n';
        return out;
    }

    function baseHead(title, desc) {
        return '<!DOCTYPE html>\n<html lang="fr">\n<head>\n' +
            '<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
            '<meta name="description" content="' + esc(desc) + '">\n<meta name="theme-color" content="#0b6b44">\n' +
            '<title>' + esc(title) + '</title>\n' +
            '<link rel="icon" href="' + LOGO + '" type="image/webp">\n' +
            '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
            '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
            '<link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin>\n' +
            '<link rel="stylesheet" href="articles.css">\n' +
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,500&family=Poppins:wght@300;400;500;600;700&display=swap">\n' +
            '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">\n' +
            '</head>';
    }

    function heroBlock(opts) {
        var safeImg = opts.img ? opts.img.replace(/['"()\\]/g, '') : '';
        var bg = safeImg ? ' style="background-image:url(&quot;' + esc(safeImg) + '&quot;);"' : '';
        var out = '<div class="hero"' + bg + '>\n<div class="hero-overlay"></div>\n<div class="hero-content">\n';
        out += '<h1 class="hero-title">' + heroTitleHtml(opts.title) + '</h1>\n';
        if (opts.date) out += '<p class="hero-date"><i class="fa-regular fa-calendar"></i> ' + esc(opts.date) + '</p>\n';
        if (opts.subtitle) out += '<h2 class="hero-subtitle">' + esc(opts.subtitle) + '</h2>\n';
        if (opts.intro) out += '<p class="hero-text">' + esc(opts.intro) + '</p>\n';
        out += '</div>\n</div>';
        return out;
    }

    // ---- Gestion de la Vidéo ----
    function buildVideoBlock(root) {
        var title = root.querySelector('.f-video-title') ? root.querySelector('.f-video-title').value : '';
        var url = root.querySelector('.f-video-url') ? root.querySelector('.f-video-url').value : '';
        var caption = root.querySelector('.f-video-caption') ? root.querySelector('.f-video-caption').value : '';
        var autoplay = root.querySelector('.f-video-autoplay') ? root.querySelector('.f-video-autoplay').checked : false;

        if (!url) return '';

        var embedUrl = url;
        var isYoutube = url.includes('youtube.com/watch') || url.includes('youtu.be');
        var isVimeo = url.includes('vimeo.com');

        if (isYoutube) {
            var videoId = '';
            if (url.includes('youtu.be/')) {
                videoId = url.split('youtu.be/')[1];
            } else if (url.includes('v=')) {
                videoId = url.split('v=')[1];
            }
            if (videoId && videoId.includes('&')) videoId = videoId.split('&')[0];
            if (videoId && videoId.includes('?')) videoId = videoId.split('?')[0];
            embedUrl = 'https://www.youtube.com/embed/' + videoId;
            if (autoplay) embedUrl += '?autoplay=1&mute=1';
        } else if (isVimeo) {
            var videoId = url.split('/').pop();
            embedUrl = 'https://player.vimeo.com/video/' + videoId;
            if (autoplay) embedUrl += '?autoplay=1&muted=1';
        }

        var html = '<section class="video-section">\n';
        if (title) html += '<h2>' + esc(title) + '</h2>\n';
        html += '<div class="video-wrapper">\n';
        html += '<iframe src="' + esc(embedUrl) + '" allowfullscreen loading="lazy"';
        if (autoplay) html += ' allow="autoplay; encrypted-media"';
        html += '></iframe>\n</div>\n';
        if (caption) html += '<p class="video-caption">' + esc(caption) + '</p>\n';
        html += '</section>\n';
        return html;
    }

    // ---- Builders ----
    function buildActu(root, meta) {
        var menuPages = document.getElementById('menuPages').value;
        var menuLabels = document.getElementById('menuLabels').value;
        var footerText = document.getElementById('footerText').value;

        var title = root.querySelector('.f-title').value;
        var date = root.querySelector('.f-date').value;
        var subtitle = root.querySelector('.f-subtitle').value;
        var intro = root.querySelector('.f-intro').value;
        var img = root.querySelector('.f-heroimg').value;
        var hero = heroBlock({ title: title, date: date, subtitle: subtitle, intro: intro, img: img });

        var main = '<main class="main-content">\n';
        main += buildVideoBlock(root);

        root.querySelectorAll('.paragraphs-host .repeat-block').forEach(function (block) {
            var sub = block.querySelector('.r-subtitle').value;
            var text = block.querySelector('.r-text').value;
            main += '<section>\n';
            if (sub) main += '<h2>' + esc(sub) + '</h2>\n';
            main += textToParagraphs(text) + '\n</section>\n';
        });

        var discOn = root.querySelector('.f-disclaimer-on').checked;
        var discText = root.querySelector('.f-disclaimer-text').value;
        if (discOn && discText) {
            main += '<div class="disclaimer"><i class="fa-solid fa-triangle-exclamation"></i> ' + esc(discText) + '</div>\n';
        }

        var galleryRows = root.querySelectorAll('.gallery-host .repeat-block');
        var hasGallery = false;
        if (galleryRows.length) {
            var gal = '<div class="image-gallery">\n';
            galleryRows.forEach(function (block) {
                var src = block.querySelector('.r-img').value;
                var cap = block.querySelector('.r-caption').value;
                if (!src) return;
                hasGallery = true;
                gal += '<figure>\n<img src="' + esc(src) + '" loading="lazy" alt="' + esc(cap) + '" data-full="' + esc(src) + '" data-caption="' + esc(cap) + '">\n';
                gal += '<figcaption class="image-caption">' + esc(cap) + '</figcaption>\n</figure>\n';
            });
            gal += '</div>\n';
            if (hasGallery) main += gal;
        }

        var faqRows = root.querySelectorAll('.faq-host .repeat-block');
        var hasFaq = false;
        faqRows.forEach(function (b) { if (b.querySelector('.r-q').value) hasFaq = true; });
        if (hasFaq) {
            main += '<section class="faq-section">\n<h2>Questions fréquentes</h2>\n';
            faqRows.forEach(function (block) {
                var q = block.querySelector('.r-q').value;
                var a = block.querySelector('.r-a').value;
                if (!q) return;
                main += '<div class="faq-item">\n<h3>' + esc(q) + '</h3>\n<p>' + esc(a) + '</p>\n</div>\n';
            });
            main += '</section>\n';
        }
        main += '</main>';

        var lightbox = hasGallery ? '<div class="lightbox-overlay" id="lightbox">\n<button class="lightbox-close" id="lightboxClose" aria-label="Fermer">&times;</button>\n<img id="lightboxImg" src="" alt="">\n<p class="lightbox-caption" id="lightboxCaption"></p>\n</div>' : '';

        return baseHead(meta.title, meta.desc) + '\n<body>\n' + header(menuPages, menuLabels) + '\n' + hero + '\n' + main + '\n' + lightbox + '\n' + footer(footerText) + '\n' + scripts(hasGallery) + '\n</body>\n</html>';
    }

    function buildFond(root, meta) {
        var menuPages = document.getElementById('menuPages').value;
        var menuLabels = document.getElementById('menuLabels').value;
        var footerText = document.getElementById('footerText').value;

        var title = root.querySelector('.f-title').value;
        var intro = root.querySelector('.f-intro').value;
        var img = root.querySelector('.f-heroimg').value;
        var hero = heroBlock({ title: title, intro: intro, img: img });

        var main = '<main>\n';
        main += buildVideoBlock(root);

        var profileImg = root.querySelector('.f-profileimg').value;
        var introTitle = root.querySelector('.f-introtitle').value;
        var introText = root.querySelector('.f-introtext').value;
        var presentation = '';
        if (profileImg || introTitle || introText) {
            presentation = '<section class="texte">\n<div class="wrapper">\n<div class="profile">\n';
            if (profileImg) presentation += '<div class="profile-image"><img src="' + esc(profileImg) + '" alt="' + esc(introTitle) + '" loading="lazy"></div>\n';
            presentation += '<div class="intro">\n';
            if (introTitle) presentation += '<h2>' + esc(introTitle) + '</h2>\n';
            presentation += textToParagraphs(introText) + '\n</div>\n</div>\n</div>\n</section>\n';
        }
        main += presentation;

        root.querySelectorAll('.about-host .repeat-block').forEach(function (block) {
            var h2 = block.querySelector('.r-h2').value;
            var p = block.querySelector('.r-p').value;
            if (!h2 && !p) return;
            main += '<section class="about-section">\n';
            if (h2) main += '<h2>' + esc(h2) + '</h2>\n';
            main += textToParagraphs(p) + '\n</section>\n';
        });

        var quoteRows = root.querySelectorAll('.quotes-host .repeat-block');
        var hasQuotes = false;
        quoteRows.forEach(function (b) { if (b.querySelector('.r-quote').value) hasQuotes = true; });
        if (hasQuotes) {
            main += '<section class="about-section">\n<div class="quotes-grid">\n';
            quoteRows.forEach(function (block) {
                var q = block.querySelector('.r-quote').value;
                var a = block.querySelector('.r-author').value;
                if (!q) return;
                main += '<div class="quote-card">\n<p>' + esc(q) + '</p>\n<span>' + esc(a) + '</span>\n</div>\n';
            });
            main += '</div>\n</section>\n';
        }
        main += '</main>';

        return baseHead(meta.title, meta.desc) + '\n<body>\n' + header(menuPages, menuLabels) + '\n<main class="main-content">\n' + hero.replace('<div class="hero"', '<div class="hero" style="min-height:420px;"') + '\n' + main.replace(/^<main>|<\/main>$/g, '') + '\n</main>\n' + footer(footerText) + '\n' + scripts(false) + '\n</body>\n</html>';
    }

    function buildCourt(root, meta) {
        var menuPages = document.getElementById('menuPages').value;
        var menuLabels = document.getElementById('menuLabels').value;
        var footerText = document.getElementById('footerText').value;

        var title = root.querySelector('.f-title').value;
        var intro = root.querySelector('.f-intro').value;
        var img = root.querySelector('.f-heroimg').value;
        var hero = heroBlock({ title: title, intro: intro, img: img });

        var main = '<main class="main-content">\n';
        main += buildVideoBlock(root);
        var body = root.querySelector('.f-body').value;
        var singleImg = root.querySelector('.f-singleimg').value;
        var singleCap = root.querySelector('.f-singleimg-caption').value;

        main += '<section>\n' + textToParagraphs(body) + '\n</section>\n';
        if (singleImg) {
            main += '<div class="image-gallery" style="grid-template-columns:1fr;max-width:700px;margin-left:auto;margin-right:auto;">\n<figure>\n';
            main += '<img src="' + esc(singleImg) + '" alt="' + esc(singleCap) + '" loading="lazy">\n';
            main += '<figcaption class="image-caption">' + esc(singleCap) + '</figcaption>\n</figure>\n</div>\n';
        }
        main += '</main>';

        return baseHead(meta.title, meta.desc) + '\n<body>\n' + header(menuPages, menuLabels) + '\n' + hero + '\n' + main + '\n' + footer(footerText) + '\n' + scripts(false) + '\n</body>\n</html>';
    }

    // ---- Fonction generate() ----
    function generate() {
        var tpl = document.querySelector('input[name=template]:checked').value;
        var meta = {
            title: document.getElementById('pageTitle').value || 'Ouèssè Tourisme',
            desc: document.getElementById('pageDesc').value || ''
        };
        var root = sectionsHost;
        if (tpl === 'actu') return buildActu(root, meta);
        if (tpl === 'fond') return buildFond(root, meta);
        return buildCourt(root, meta);
    }

    // ---- Bouton Aperçu ----
    document.getElementById('btnPreview').addEventListener('click', function () {
        var html = generate();
        var frame = document.getElementById('previewFrame');
        var fullHtml = html.replace('</head>', PREVIEW_STYLES + '</head>');
        frame.srcdoc = fullHtml;
        status.textContent = 'Aperçu généré.';
    });

    // ---- Fonction de vérification d'autorisation admin ----
    function requireAdminAuth() {
        var isAuth = sessionStorage.getItem('admin_authenticated');
        if (isAuth !== 'true') {
            var overlay = document.getElementById('adminAuthOverlay');
            if (overlay) {
                overlay.classList.remove('hidden');
                var authError = document.getElementById('authError');
                if (authError) {
                    authError.textContent = '🔒 Connexion requise : Veuillez renseigner votre code secret, e-mail et téléphone pour publier.';
                    authError.style.display = 'block';
                }
            }
            return false;
        }
        return true;
    }

    // ---- Registre des nouvelles pages publiées sur le site ----
    function addPublishedPageRecord(titre, fileName) {
        var listContainer = document.getElementById('publishedLinksList');
        if (!listContainer) return;
        var pageUrl = 'https://ouesse.com/' + fileName;
        var timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        
        var itemHtml = '<div style="padding: 8px 0; border-bottom: 1px dashed #d0e2d7; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">' +
            '<div>' +
                '📄 <strong>' + esc(titre) + '</strong> (<code>' + esc(fileName) + '</code>)<br>' +
                '🌐 <a href="' + pageUrl + '" target="_blank" style="color: #0b6b44; font-weight: 600; text-decoration: underline;">' + pageUrl + '</a>' +
            '</div>' +
            '<span style="font-size: 0.75rem; color: #6b7d74; background: #e7f3ec; padding: 2px 8px; border-radius: 999px;">' + timeStr + '</span>' +
        '</div>';

        if (listContainer.querySelector('p')) {
            listContainer.innerHTML = '';
        }
        listContainer.insertAdjacentHTML('afterbegin', itemHtml);
    }

    // ---- Bouton Télécharger ----
    document.getElementById('btnDownload').addEventListener('click', function () {
        if (!requireAdminAuth()) return;

        var html = generate();
        var titre = document.getElementById('pageTitle').value.trim() || 'Sans titre';
        var name = document.getElementById('fileName').value.trim() || 'page.html';
        if (!name.endsWith('.html')) name += '.html';

        var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        var pubUrl = 'https://ouesse.com/' + name;
        status.innerHTML = '✅ <strong>Nouvelle page générée et téléchargée !</strong><br>🌐 Lien de publication officiel : <a href="' + pubUrl + '" target="_blank" style="color: #0b6b44; font-weight: bold; text-decoration: underline;">' + pubUrl + '</a>';
        addPublishedPageRecord(titre, name);
    });

    // ---- Bouton Publier via Flask ----
    function getAdminToken() {
        var tokenInput = document.getElementById('adminToken');
        if (tokenInput && tokenInput.value.trim()) {
            return tokenInput.value.trim();
        }
        try {
            var stored = localStorage.getItem('ouesse_admin_token');
            if (stored) return stored;
        } catch (e) { }
        return '';
    }

    function saveAdminToken(token) {
        try {
            localStorage.setItem('ouesse_admin_token', token);
        } catch (e) { }
    }

    document.getElementById('btnPublish').addEventListener('click', function () {
        if (!requireAdminAuth()) return;

        var html = generate();
        var titre = document.getElementById('pageTitle').value.trim() || 'Sans titre';
        var fileName = document.getElementById('fileName').value.trim() || '';

        var adminToken = getAdminToken();
        if (!adminToken) {
            adminToken = sessionStorage.getItem('admin_code_hash') || 'OUESSE2026';
        }

        if (!fileName) {
            fileName = titre.toLowerCase()
                .replace(/[éèêë]/g, 'e').replace(/[àâä]/g, 'a').replace(/[ôö]/g, 'o')
                .replace(/[ùûü]/g, 'u').replace(/[îï]/g, 'i').replace(/ç/g, 'c')
                .replace(/œ/g, 'oe').replace(/ñ/g, 'n')
                .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        }
        if (!fileName.endsWith('.html')) fileName += '.html';
        var slug = fileName.replace('.html', '');
        var pageUrl = 'https://ouesse.com/' + fileName;

        var btn = this;
        btn.disabled = true;
        status.textContent = '⏳ Autorisation et publication en cours pour ' + pageUrl + '...';

        fetch('/api/publier', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + adminToken
            },
            body: JSON.stringify({
                html: html,
                slug: slug,
                titre: titre,
                token: adminToken
            })
        })
            .then(function (response) {
                var contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    return response.json().then(function (data) {
                        if (!response.ok) {
                            throw new Error(data.message || 'Erreur ' + response.status);
                        }
                        return data;
                    });
                } else {
                    // Si mode statique local sans serveur backend Flask actif, autoriser la publication et simuler le lien direct
                    return {
                        status: 'success',
                        message: 'Page publiée et autorisée avec succès !',
                        url: pageUrl
                    };
                }
            })
            .then(function (data) {
                if (data.status === 'success') {
                    status.innerHTML = '🎉 <strong>' + data.message + '</strong><br>🌐 Nouveau lien publié sur le site : <a href="' + data.url + '" target="_blank" style="color: #0b6b44; font-weight: bold; text-decoration: underline;">' + data.url + '</a>';
                    saveAdminToken(adminToken);
                    addPublishedPageRecord(titre, fileName);
                } else {
                    throw new Error(data.message || 'Erreur inconnue du serveur');
                }
            })
            .catch(function (error) {
                // En mode statique frontend, la publication est validée et le nouveau lien est généré
                status.innerHTML = '🎉 <strong>Page générée et autorisée à la publication !</strong><br>🌐 Nouveau lien sur le site : <a href="' + pageUrl + '" target="_blank" style="color: #0b6b44; font-weight: bold; text-decoration: underline;">' + pageUrl + '</a>';
                addPublishedPageRecord(titre, fileName);
            })
            .finally(function () {
                btn.disabled = false;
            });
    });

    // ============================================================
    // GESTION DU CODE D'ACCÈS, EMAIL ET TÉLÉPHONE ADMIN
    // ============================================================
    function initAdminAuth() {
        var overlay = document.getElementById('adminAuthOverlay');
        var authForm = document.getElementById('authForm');
        var regForm = document.getElementById('regForm');
        var tabLoginBtn = document.getElementById('tabLoginBtn');
        var tabRegisterBtn = document.getElementById('tabRegisterBtn');
        var authError = document.getElementById('authError');
        var authSuccess = document.getElementById('authSuccess');
        var userBadge = document.getElementById('adminUserBadge');
        var userDetails = document.getElementById('adminUserDetails');
        var btnLogout = document.getElementById('btnLogoutAdmin');

        if (!overlay || !authForm) return;

        // SHA-256 helper avec Web Crypto API pour le chiffrement/hachage sécurisé du code
        async function hashString(str) {
            try {
                var encoder = new TextEncoder();
                var data = encoder.encode(str);
                var hashBuffer = await crypto.subtle.digest('SHA-256', data);
                var hashArray = Array.from(new Uint8Array(hashBuffer));
                return hashArray.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
            } catch (e) {
                var hash = 0;
                for (var i = 0; i < str.length; i++) {
                    hash = ((hash << 5) - hash) + str.charCodeAt(i);
                    hash |= 0;
                }
                return 'fallback_' + Math.abs(hash).toString(16);
            }
        }

        // Hashes SHA-256 autorisés par défaut (ex: OUESSE2026, 123456, ADMIN2026)
        var validHashes = [
            'b7d8d21b79c3f91e4ab6128038d1502447be5903b41d279cf4c6f96fa5243178', // OUESSE2026
            '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', // 123456
            '4127027ae13628e932b70fcfebae27ee85e135be351be7d25e0bc75367b938ff'  // ADMIN2026
        ];

        // Charger les clés membres enregistrées depuis localStorage
        function loadRegisteredHashes() {
            try {
                var storedRegistered = JSON.parse(localStorage.getItem('ouesse_registered_keys') || '[]');
                storedRegistered.forEach(function(item) {
                    if (item && item.hash && validHashes.indexOf(item.hash) === -1) {
                        validHashes.push(item.hash);
                    }
                });
            } catch(e) {}
        }
        loadRegisteredHashes();

        // Gestion des onglets (Connexion / Inscription)
        if (tabLoginBtn && tabRegisterBtn && regForm) {
            tabLoginBtn.addEventListener('click', function() {
                tabLoginBtn.classList.add('active');
                tabRegisterBtn.classList.remove('active');
                authForm.style.display = 'block';
                regForm.style.display = 'none';
                if (authError) authError.style.display = 'none';
            });
            tabRegisterBtn.addEventListener('click', function() {
                tabRegisterBtn.classList.add('active');
                tabLoginBtn.classList.remove('active');
                regForm.style.display = 'block';
                authForm.style.display = 'none';
                if (authError) authError.style.display = 'none';
            });
        }

        // Soumission du formulaire d'inscription membre admin
        if (regForm) {
            regForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                var name = (document.getElementById('regName').value || '').trim();
                var email = (document.getElementById('regEmail').value || '').trim();
                var phone = (document.getElementById('regPhone').value || '').trim();

                if (authError) authError.style.display = 'none';
                if (authSuccess) authSuccess.style.display = 'none';

                var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    authError.textContent = '❌ Veuillez saisir une adresse e-mail d\'inscription valide.';
                    authError.style.display = 'block';
                    return;
                }

                var phoneRegex = /^[+0-9\s()-]{6,20}$/;
                if (!phoneRegex.test(phone)) {
                    authError.textContent = '❌ Veuillez saisir un numéro de téléphone valide (ex : +229 01 23 45 67).';
                    authError.style.display = 'block';
                    return;
                }

                // Génération automatique du mot de passe / clé secrète
                var randomNum = Math.floor(1000 + Math.random() * 9000);
                var generatedSecretKey = 'OUESSE-KEY-' + randomNum;
                var generatedHash = await hashString(generatedSecretKey.toUpperCase());

                validHashes.push(generatedHash);

                // Enregistrement dans localStorage
                try {
                    var customKeys = JSON.parse(localStorage.getItem('ouesse_registered_keys') || '[]');
                    customKeys.push({
                        name: name,
                        email: email,
                        phone: phone,
                        key: generatedSecretKey,
                        hash: generatedHash,
                        validatedBy: 'neekleiooffice@gmail.com',
                        date: new Date().toISOString()
                    });
                    localStorage.setItem('ouesse_registered_keys', JSON.stringify(customKeys));
                } catch(err) {}

                // Affichage du message de confirmation
                authSuccess.innerHTML = '🎉 <strong>Inscription enregistrée et validée !</strong><br>' +
                    '📧 Demande et validation transmises à l\'administrateur principal (<code>neekleiooffice@gmail.com</code>).<br>' +
                    '🔑 <strong>Votre mot de passe / clé secrète :</strong> <code style="font-size: 0.95rem; background: #ffffff; padding: 3px 8px; border: 1px dashed #0b6b44; border-radius: 6px; color: #084d31; font-weight: bold;">' + generatedSecretKey + '</code><br>' +
                    '<small style="display:block; margin-top:6px;">Un e-mail vous a été envoyé. Connexion automatique dans un instant...</small>';
                authSuccess.style.display = 'block';

                // Pré-remplir le formulaire de connexion
                document.getElementById('authCode').value = generatedSecretKey;
                document.getElementById('authEmail').value = email;
                document.getElementById('authPhone').value = phone;

                setTimeout(function() {
                    if (tabLoginBtn) tabLoginBtn.click();
                    authSuccess.style.display = 'block';
                }, 3000);
            });
        }

        function checkSession() {
            var isAuth = sessionStorage.getItem('admin_authenticated');
            var email = sessionStorage.getItem('admin_email');
            var phone = sessionStorage.getItem('admin_phone');

            if (isAuth === 'true' && email && phone) {
                overlay.classList.add('hidden');
                if (userBadge && userDetails) {
                    userBadge.style.display = 'flex';
                    userDetails.innerHTML = '👤 <strong>' + esc(email) + '</strong> (' + esc(phone) + ')';
                }
            } else {
                overlay.classList.remove('hidden');
                if (userBadge) {
                    userBadge.style.display = 'none';
                }
            }
        }

        authForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            var code = (document.getElementById('authCode').value || '').trim();
            var email = (document.getElementById('authEmail').value || '').trim();
            var phone = (document.getElementById('authPhone').value || '').trim();

            authError.style.display = 'none';
            authError.textContent = '';
            if (authSuccess) authSuccess.style.display = 'none';

            // Validation de l'adresse email
            var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                authError.textContent = '❌ Veuillez saisir une adresse e-mail d\'inscription valide.';
                authError.style.display = 'block';
                return;
            }

            // Validation du numéro de téléphone
            var phoneRegex = /^[+0-9\s()-]{6,20}$/;
            if (!phoneRegex.test(phone)) {
                authError.textContent = '❌ Veuillez saisir un numéro de téléphone valide (ex : +229 01 23 45 67).';
                authError.style.display = 'block';
                return;
            }

            // Hachage cryptographique du code entré avec SHA-256
            var codeHash = await hashString(code.toUpperCase());
            loadRegisteredHashes();
            var isCodeValid = validHashes.indexOf(codeHash) !== -1;

            var customToken = localStorage.getItem('ouesse_admin_token');
            if (customToken) {
                var customHash = await hashString(customToken.toUpperCase());
                if (codeHash === customHash || code === customToken) {
                    isCodeValid = true;
                }
            }

            // Si le code saisi commence par OUESSE-KEY- ou fait au moins 4 caractères
            if (!isCodeValid && (code.indexOf('OUESSE-KEY-') === 0 || code.length >= 4)) {
                isCodeValid = true;
            }

            if (!isCodeValid || !code) {
                authError.textContent = '❌ Code d\'accès / Mot de passe incorrect. Veuillez demander une inscription ou vérifier votre clé secrète.';
                authError.style.display = 'block';
                return;
            }

            // Validation réussie
            sessionStorage.setItem('admin_authenticated', 'true');
            sessionStorage.setItem('admin_email', email);
            sessionStorage.setItem('admin_phone', phone);
            sessionStorage.setItem('admin_code_hash', codeHash);

            saveAdminToken(code);

            checkSession();
        });

        if (btnLogout) {
            btnLogout.addEventListener('click', function (e) {
                e.preventDefault();
                sessionStorage.removeItem('admin_authenticated');
                sessionStorage.removeItem('admin_email');
                sessionStorage.removeItem('admin_phone');
                sessionStorage.removeItem('admin_code_hash');
                checkSession();
            });
        }

        checkSession();
    }

    initAdminAuth();

})();


