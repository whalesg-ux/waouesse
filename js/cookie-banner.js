(function () {
    var banner = document.getElementById('cookie-banner');
    if (!banner) return;
    var KEY = 'cookieConsent', saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    banner.hidden = saved !== null;
    function choose(v) {
        try { localStorage.setItem(KEY, v); } catch (e) {}
        banner.hidden = true;
    }
    document.getElementById('cookie-accept').addEventListener('click', function () { choose('accepted'); });
    document.getElementById('cookie-refuse').addEventListener('click', function () { choose('refused'); });
})();
