import os
import json
import re
import base64
import secrets
import logging
import html
import sqlite3
import unicodedata
from datetime import datetime
from functools import wraps
from urllib.parse import urlparse
import requests
from flask import (
    Flask, request, jsonify, render_template,
    redirect, send_from_directory, make_response, session, url_for
)
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

# =============================================
# 1. CHARGEMENT DU FICHIER .env (AVANT TOUT)
# =============================================
env_path = '.env'
if not os.path.exists(env_path):
    admin_token = secrets.token_urlsafe(32)
    secret_key = secrets.token_hex(32)
    # Mot de passe admin lisible (affiché une seule fois), stocké uniquement haché
    admin_password_clair = secrets.token_urlsafe(9)
    admin_password_hash = generate_password_hash(admin_password_clair)

    env_content = f"""# Configuration OUESSE Publisher + Recherche
# ============================================

# GitHub (obligatoire - obtenez un token sur https://github.com/settings/tokens)
GITHUB_TOKEN=ghp_VOTRE_TOKEN_ICI
GITHUB_OWNER=whalesg-ux
GITHUB_REPO=waouesse
GITHUB_BRANCH=main

# Site
SITE_URL=https://waouesse.vercel.app
GITHUB_PATH=public/

# Base de données de recherche
DB_PATH=ouesse-search.db

# Sécurité (générées automatiquement)
SECRET_KEY={secret_key}
ADMIN_TOKEN={admin_token}
ADMIN_PASSWORD_HASH={admin_password_hash}

# CORS
ALLOWED_ORIGINS=https://waouesse.vercel.app

# Développement
FLASK_DEBUG=false
PORT=5000
"""
    with open(env_path, 'w', encoding='utf-8') as f:
        f.write(env_content)

    try:
        os.chmod(env_path, 0o600)
    except Exception:
        pass

    print(f"\n{'='*50}")
    print("⚠️  FICHIER .env CRÉÉ AUTOMATIQUEMENT")
    print(f"{'='*50}")
    print(f"\nADMIN_TOKEN (API)        : {admin_token}")
    print(f"MOT DE PASSE ADMIN       : {admin_password_clair}")
    print("⚠️  Notez ce mot de passe : il n'est pas stocké en clair et ne sera plus jamais affiché.")
    print(f"\nConnexion admin : http://127.0.0.1:5000/admin/login")
    print(f"{'='*50}\n")

load_dotenv()

# =============================================
# 2. CONFIGURATION DU LOGGING
# =============================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('app.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY')
if not app.secret_key:
    raise RuntimeError("SECRET_KEY doit être défini dans le fichier .env")

# =============================================
# 3. RATE LIMITING
# =============================================
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# =============================================
# 4. CONFIGURATION GLOBALE
# =============================================
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')
OWNER = os.getenv('GITHUB_OWNER')
REPO = os.getenv('GITHUB_REPO')
BRANCH = os.getenv('GITHUB_BRANCH', 'main')
SITE_URL = os.getenv('SITE_URL', 'https://votredomaine.com')
REPO_PATH = os.getenv('GITHUB_PATH', '').strip()
ADMIN_TOKEN = os.getenv('ADMIN_TOKEN')
ADMIN_PASSWORD_HASH = os.getenv('ADMIN_PASSWORD_HASH')
DB_PATH = os.getenv('DB_PATH', 'ouesse-search.db')

# Cookies de session sécurisés (utilisés par la connexion admin par mot de passe)
_debug_env = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=not _debug_env,
    PERMANENT_SESSION_LIFETIME=60 * 60 * 4,  # 4 heures
)

ALLOWED_ORIGINS = [o.strip() for o in os.getenv('ALLOWED_ORIGINS', SITE_URL).split(',') if o.strip()]
if 'http://localhost:5000' not in ALLOWED_ORIGINS and 'http://127.0.0.1:5000' not in ALLOWED_ORIGINS:
    ALLOWED_ORIGINS.extend(['http://localhost:5000', 'http://127.0.0.1:5000'])

CORS(app, resources={
    r"/api/*": {
        "origins": ALLOWED_ORIGINS,
        "supports_credentials": False,
        "allow_headers": ["Content-Type", "Authorization"],
        "methods": ["GET", "POST", "OPTIONS"]
    }
})

# =============================================
# 5. CONSTANTES DE SÉCURITÉ
# =============================================
MAX_TITLE_LENGTH = 200
MAX_HTML_SIZE = 5 * 1024 * 1024  # 5 Mo
MAX_SLUG_LENGTH = 100
STOPWORDS_FR = {
    'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'a', 'au', 'aux',
    'en', 'dans', 'sur', 'pour', 'par', 'avec', 'ce', 'ces', 'cette', 'est',
    'sont', 'qui', 'que', 'ou', 'ne', 'pas', 'plus', 'se', 'son', 'sa', 'ses'
}

if not all([GITHUB_TOKEN, OWNER, REPO]):
    logger.warning("Variables d'environnement GitHub manquantes. La publication sera désactivée.")
if not ADMIN_TOKEN:
    logger.warning("ADMIN_TOKEN non défini : /admin et /api/publier sont désactivés.")
if not ADMIN_PASSWORD_HASH:
    logger.warning("ADMIN_PASSWORD_HASH non défini : la connexion admin par mot de passe est désactivée.")

if GITHUB_TOKEN and not re.match(r'^ghp_[a-zA-Z0-9]{36}$|^ghs_[a-zA-Z0-9]{36}$|^github_pat_[a-zA-Z0-9_]{22,}', GITHUB_TOKEN):
    logger.warning("Format du GITHUB_TOKEN suspect. Vérifiez votre token.")

_parsed_site = urlparse(SITE_URL)
if not _parsed_site.scheme in ('https', 'http') or not _parsed_site.netloc:
    raise RuntimeError("SITE_URL doit être une URL valide (https://domaine.com)")

if REPO_PATH:
    normalized = os.path.normpath(REPO_PATH)
    if normalized.startswith('..') or normalized.startswith('/'):
        raise RuntimeError(f"GITHUB_PATH invalide (path traversal détecté): {REPO_PATH}")
    REPO_PATH = normalized.strip('/')


# =============================================
# 6. BASE DE DONNÉES
# =============================================
def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Vérifie et utilise la table search_index existante"""
    conn = get_db_connection()

    cursor = conn.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='search_index'
    """)

    if cursor.fetchone():
        logger.info("✅ Table search_index trouvée")
        cursor = conn.execute("PRAGMA table_info(search_index)")
        columns = [col[1] for col in cursor.fetchall()]

        colonnes_a_ajouter = {
            'desc': 'TEXT',
            'icon': "TEXT DEFAULT 'fa-magnifying-glass'",
            'anchor': "TEXT DEFAULT ''",
            'keywords': 'TEXT'
        }

        for col, col_type in colonnes_a_ajouter.items():
            if col not in columns:
                try:
                    conn.execute(f"ALTER TABLE search_index ADD COLUMN {col} {col_type}")
                    logger.info(f"✅ Colonne '{col}' ajoutée")
                except Exception as e:
                    logger.warning(f"Impossible d'ajouter {col}: {e}")
        conn.commit()

        # BUG CORRIGÉ : indexer.py / indexer_tout.py faisaient un "INSERT OR REPLACE"
        # sans contrainte UNIQUE sur "page", ce qui empilait des doublons (parfois
        # avec un texte/mots-clés vides) et cassait le classement des résultats.
        # On nettoie les doublons existants en ne gardant que la ligne la plus
        # complète par page, puis on impose l'unicité pour empêcher que ça revienne.
        doublons = conn.execute("""
            SELECT page, COUNT(*) as n FROM search_index GROUP BY page HAVING n > 1
        """).fetchall()
        if doublons:
            logger.warning(f"🧹 {len(doublons)} page(s) en doublon détectées dans search_index, nettoyage...")
            for d in doublons:
                lignes = conn.execute(
                    "SELECT id, title, desc, keywords, text FROM search_index WHERE page = ?",
                    (d["page"],)
                ).fetchall()
                # On garde la ligne avec le plus de contenu utile (texte+mots-clés+desc)
                meilleure = max(
                    lignes,
                    key=lambda r: len(r["text"] or '') + len(r["keywords"] or '') + len(r["desc"] or '')
                )
                autres_ids = [r["id"] for r in lignes if r["id"] != meilleure["id"]]
                if autres_ids:
                    conn.executemany(
                        "DELETE FROM search_index WHERE id = ?",
                        [(i,) for i in autres_ids]
                    )
            conn.commit()
            logger.info("✅ Doublons supprimés")

        # Supprime les entrées vides (pages sans contenu réel, ex. fichier .html vide)
        conn.execute("DELETE FROM search_index WHERE (text IS NULL OR TRIM(text) = '') AND (title IS NULL OR title = 'Sans titre' OR TRIM(title) = '')")
        conn.commit()

        try:
            conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_search_index_page ON search_index(page)")
            conn.commit()
            logger.info("✅ Contrainte d'unicité sur 'page' garantie")
        except Exception as e:
            logger.warning(f"Impossible de créer l'index unique sur 'page': {e}")
    else:
        logger.info("🔄 Création de la table search_index...")
        conn.execute("""
            CREATE TABLE search_index (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                desc TEXT,
                icon TEXT DEFAULT 'fa-magnifying-glass',
                page TEXT NOT NULL,
                anchor TEXT DEFAULT '',
                keywords TEXT,
                text TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_search_index_page ON search_index(page)")
        conn.commit()
        logger.info("✅ Table search_index créée")

    conn.close()
    logger.info(f"✅ Base de données prête ({DB_PATH})")

init_db()


# =============================================
# 7. FONCTIONS UTILITAIRES
# =============================================
def normaliser(texte):
    if not texte:
        return ""
    texte_sans_accents = ''.join(
        c for c in unicodedata.normalize('NFD', texte) if unicodedata.category(c) != 'Mn'
    )
    return texte_sans_accents.lower().strip()

def slugifier(texte):
    if not texte:
        return 'page'
    texte = str(texte).strip().lower()[:MAX_SLUG_LENGTH]
    trans = str.maketrans(
        'àâäáãåæéèêëíìîïóòôöõúùûüçñýÿ',
        'aaaaaaaeeeeiiiiooooouuuucnyy'
    )
    texte = texte.translate(trans)
    texte = re.sub(r'[^a-z0-9-]+', '-', texte)
    texte = re.sub(r'-+', '-', texte).strip('-')
    return texte or 'page'

def sanitize_html_content(html_content):
    if not html_content:
        return ''
    if len(html_content) > MAX_HTML_SIZE:
        raise ValueError(f"Contenu HTML trop volumineux (max {MAX_HTML_SIZE} octets)")
    if not re.search(r'<[a-zA-Z][^>]*>', html_content):
        raise ValueError("Le contenu ne semble pas être du HTML valide")
    html_content = re.sub(r'<script[^>]*>.*?</script>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
    html_content = re.sub(r'<style[^>]*>.*?</style>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
    html_content = re.sub(r'javascript:', '', html_content, flags=re.IGNORECASE)
    html_content = re.sub(r'on\w+\s*=', '', html_content, flags=re.IGNORECASE)
    return html_content

def validate_site_url(url):
    if not url:
        return False
    parsed = urlparse(url)
    hostname = parsed.hostname or ''
    blocked_hosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1']
    blocked_prefixes = ('10.', '172.16.', '172.17.', '172.18.', '172.19.',
                        '172.20.', '172.21.', '172.22.', '172.23.', '172.24.',
                        '172.25.', '172.26.', '172.27.', '172.28.', '172.29.',
                        '172.30.', '172.31.', '192.168.')
    return not (hostname in blocked_hosts or hostname.startswith(blocked_prefixes))

def extraire_texte_brut(html_content):
    texte = re.sub(r'<(script|style)[^>]*>.*?</\1>', ' ', html_content, flags=re.DOTALL | re.IGNORECASE)
    texte = re.sub(r'<[^>]+>', ' ', texte)
    texte = html.unescape(texte)
    texte = re.sub(r'\s+', ' ', texte).strip()
    return texte

def extraire_titre_html(html_content, titre_repli):
    m = re.search(r'<title[^>]*>(.*?)</title>', html_content, re.DOTALL | re.IGNORECASE)
    if m and m.group(1).strip():
        return html.unescape(re.sub(r'<[^>]+>', '', m.group(1))).strip()
    m = re.search(r'<h1[^>]*>(.*?)</h1>', html_content, re.DOTALL | re.IGNORECASE)
    if m and m.group(1).strip():
        return html.unescape(re.sub(r'<[^>]+>', '', m.group(1))).strip()
    return titre_repli

def extraire_description(html_content, texte_brut, longueur=200):
    m = re.search(
        r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']*)["\']',
        html_content, re.IGNORECASE
    )
    if m and m.group(1).strip():
        return html.unescape(m.group(1).strip())[:300]
    if len(texte_brut) <= longueur:
        return texte_brut
    return texte_brut[:longueur].rsplit(' ', 1)[0] + '…'

def extraire_icone(data, defaut='fa-magnifying-glass'):
    icone = (data.get('icone') or data.get('icon') or '').strip()
    return icone or defaut

def extraire_mots_cles(html_content, titre, texte_brut, data=None, limite=15):
    if data and data.get('motscles'):
        mots = data['motscles']
        if isinstance(mots, list):
            return ', '.join(mots)[:500]
        return ', '.join(str(mots).split(','))[:500]
    m = re.search(
        r'<meta[^>]+name=["\']keywords["\'][^>]+content=["\']([^"\']*)["\']',
        html_content, re.IGNORECASE
    )
    if m and m.group(1).strip():
        return html.unescape(m.group(1).strip())[:500]
    mots = re.findall(r'\b\w{3,}\b', normaliser(titre + ' ' + texte_brut[:400]))
    vus = []
    for mot in mots:
        if mot not in STOPWORDS_FR and mot not in vus:
            vus.append(mot)
        if len(vus) >= limite:
            break
    return ', '.join(vus)

MIN_CONTENT_LENGTH = 30  # en dessous, la page est considérée vide (ex: ibidon.html)

def indexer_page(slug, titre, html_content, filename, page_url, data=None):
    texte_brut = extraire_texte_brut(html_content)
    if len(texte_brut) < MIN_CONTENT_LENGTH:
        logger.warning(f"⏭️  Page ignorée à l'indexation (contenu vide ou trop court) : {filename}")
        return
    titre_final = extraire_titre_html(html_content, titre)
    desc = extraire_description(html_content, texte_brut)
    icone = extraire_icone(data or {})
    mots_cles = extraire_mots_cles(html_content, titre_final, texte_brut, data)

    conn = get_db_connection()
    existing = conn.execute(
        "SELECT id FROM search_index WHERE page = ?", 
        (filename,)
    ).fetchone()

    if existing:
        conn.execute("""
            UPDATE search_index 
            SET title=?, desc=?, icon=?, anchor=?, keywords=?, text=?, created_at=?
            WHERE page=?
        """, (titre_final, desc, icone, slug, mots_cles, texte_brut, 
              datetime.now().isoformat(), filename))
    else:
        conn.execute("""
            INSERT INTO search_index 
            (title, desc, icon, page, anchor, keywords, text, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (titre_final, desc, icone, filename, slug, mots_cles, texte_brut,
              datetime.now().isoformat()))

    conn.commit()
    conn.close()
    logger.info(f"Page indexée dans search_index: {filename}")


# =============================================
# 8. DÉCORATEUR D'ADMIN
# =============================================
def require_admin(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        # Voie 1 : session ouverte via /admin/login (mot de passe)
        if session.get('is_admin'):
            logger.info(f"Accès admin autorisé (session) depuis {request.remote_addr}")
            return view(*args, **kwargs)

        if not ADMIN_TOKEN:
            logger.warning("Tentative d'accès admin alors que ADMIN_TOKEN n'est pas configuré")
            return jsonify({'status': 'error', 'message': "Accès admin désactivé."}), 503

        # Voie 2 : token API (query string, header Authorization, ou corps JSON)
        supplied = request.args.get('token', '')
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            supplied = auth_header[len('Bearer '):]

        if not supplied and request.is_json:
            supplied = (request.get_json(silent=True) or {}).get('token', '')

        if not supplied:
            logger.warning(f"Tentative d'accès admin sans token depuis {request.remote_addr}")
            return jsonify({'status': 'error', 'message': 'Authentification requise.'}), 401

        if not secrets.compare_digest(supplied, ADMIN_TOKEN):
            logger.warning(f"Tentative d'accès admin avec token invalide depuis {request.remote_addr}")
            return jsonify({'status': 'error', 'message': 'Non autorisé.'}), 401

        logger.info(f"Accès admin autorisé (token) depuis {request.remote_addr}")
        return view(*args, **kwargs)
    return wrapped


def admin_page_required(view):
    """Comme require_admin, mais redirige vers la page de connexion (pour les pages HTML, pas l'API)."""
    @wraps(view)
    def wrapped(*args, **kwargs):
        if session.get('is_admin'):
            return view(*args, **kwargs)
        return redirect(url_for('admin_login', next=request.path))
    return wrapped


# =============================================
# 9. ROUTES STATIQUES (CSS, JS, images, accueil)
# =============================================
@app.route('/')
def accueil():
    fichiers = ['index.html', 'public/index.html', 'templates/index.html']
    for fichier in fichiers:
        if os.path.exists(fichier):
            return send_from_directory(os.path.dirname(fichier) or '.', os.path.basename(fichier))
    return "Bienvenue sur OUESSE !"

@app.route('/css/<path:filename>')
def servir_css(filename):
    if '..' in filename:
        return "Accès interdit", 403
    dossiers = ['static/css', 'css', 'public/css', '.']
    for dossier in dossiers:
        chemin = os.path.join(dossier, filename)
        if os.path.exists(chemin) and os.path.isfile(chemin):
            return send_from_directory(dossier, filename)
    return "CSS non trouvé", 404

@app.route('/js/<path:filename>')
def servir_js(filename):
    if '..' in filename:
        return "Accès interdit", 403
    dossiers = ['static/js', 'js', 'public/js', '.']
    for dossier in dossiers:
        chemin = os.path.join(dossier, filename)
        if os.path.exists(chemin) and os.path.isfile(chemin):
            return send_from_directory(dossier, filename)
    return "JS non trouvé", 404

@app.route('/images/<path:filename>')
def servir_images(filename):
    if '..' in filename:
        return "Accès interdit", 403
    dossiers = ['static/images', 'images', 'public/images']
    for dossier in dossiers:
        chemin = os.path.join(dossier, filename)
        if os.path.exists(chemin) and os.path.isfile(chemin):
            return send_from_directory(dossier, filename)
    return "Image non trouvée", 404


# =============================================
# 10. ADMIN
# =============================================
@app.route('/admin/login', methods=['GET', 'POST'])
@limiter.limit("8 per minute")
def admin_login():
    erreur = None
    if request.method == 'POST':
        if not ADMIN_PASSWORD_HASH:
            erreur = "Connexion par mot de passe désactivée (ADMIN_PASSWORD_HASH manquant)."
        else:
            mot_de_passe = request.form.get('password', '')
            if mot_de_passe and check_password_hash(ADMIN_PASSWORD_HASH, mot_de_passe):
                session.clear()
                session.permanent = True
                session['is_admin'] = True
                logger.info(f"✅ Connexion admin réussie depuis {request.remote_addr}")
                dest = request.args.get('next') or url_for('admin')
                return redirect(dest)
            else:
                logger.warning(f"❌ Échec de connexion admin depuis {request.remote_addr}")
                erreur = "Mot de passe incorrect."

    return render_template('admin_login.html', erreur=erreur)


@app.route('/admin/logout')
def admin_logout():
    session.clear()
    return redirect(url_for('admin_login'))


@app.route('/admin')
@admin_page_required
def admin():
    admin_html_path = None
    if os.path.exists('templates/admin.html'):
        admin_html_path = 'templates/admin.html'
    elif os.path.exists('admin.html'):
        admin_html_path = 'admin.html'

    if not admin_html_path:
        return "Page admin non trouvée", 404

    with open(admin_html_path, 'r', encoding='utf-8') as f:
        contenu = f.read()

    # Injecte discrètement le token API dans un champ caché pour que
    # generator.js puisse publier sans que l'utilisateur ait à le ressaisir.
    injection = f'<input type="hidden" id="adminToken" value="{html.escape(ADMIN_TOKEN or "")}">'
    if '</body>' in contenu:
        contenu = contenu.replace('</body>', injection + '\n</body>')
    else:
        contenu += injection

    return contenu


# =============================================
# 11. ROUTES API (recherche, publication, indexation)
# =============================================
@app.route('/search')
def page_recherche():
    """Page de résultats de recherche. Corrige le SearchAction schema.org
    (index.html) qui pointait vers /search?q=... alors que cette route
    n'existait pas encore (404 pour les moteurs de recherche)."""
    if os.path.exists('index.html'):
        return send_from_directory('.', 'index.html')
    return redirect('/')

@app.route('/api/search')
def api_search():
    mot_cle = request.args.get('q', '')
    if not mot_cle or len(mot_cle) < 2:
        return jsonify([])

    mot_cle_propre = normaliser(mot_cle)
    mots_requete = mot_cle_propre.split()

    conn = get_db_connection()
    rows = conn.execute(
        "SELECT title, desc, icon, page, anchor, keywords, text FROM search_index"
    ).fetchall()
    conn.close()

    resultats = []
    for row in rows:
        titre_n = normaliser(row["title"])
        mots_cles_n = normaliser(row["keywords"] or "")
        texte_n = normaliser(row["text"] or "")

        score = 0
        for mot in mots_requete:
            if mot in titre_n:
                score += 5
            if mot in mots_cles_n:
                score += 3
            if mot in texte_n:
                score += 1

        if score > 0:
            resultats.append({
                "title": row["title"],
                "desc": row["desc"],
                "icon": row["icon"],
                "page": row["page"],
                "anchor": row["anchor"],
                "keywords": row["keywords"],
                "text": row["text"],
                "score": score
            })

    resultats.sort(key=lambda r: -r["score"])
    return jsonify(resultats[:10])

@app.route('/api/publier', methods=['POST', 'OPTIONS'])
@require_admin
@limiter.limit("10 per minute")
def publier():
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response

    if not all([GITHUB_TOKEN, OWNER, REPO]):
        logger.error("Configuration GitHub incomplète")
        return jsonify({'status': 'error', 'message': 'Configuration GitHub incomplète.'}), 500

    data = request.get_json(silent=True) or {}
    titre = (data.get('titre') or 'Sans titre').strip()
    if len(titre) > MAX_TITLE_LENGTH:
        return jsonify({'status': 'error', 'message': f'Titre trop long (max {MAX_TITLE_LENGTH} caractères)'}), 400

    html_content = data.get('html')
    if not html_content:
        return jsonify({'status': 'error', 'message': 'Contenu HTML manquant'}), 400

    try:
        html_content = sanitize_html_content(html_content)
    except ValueError as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

    slug_brut = data.get('slug', '') or titre
    slug = slugifier(slug_brut)
    logger.info(f"Publication demandée: titre='{titre}', slug='{slug}'")

    filename = f"{slug}.html"
    filepath = f"{REPO_PATH}/{filename}" if REPO_PATH else filename
    if '..' in filepath or filepath.startswith('/'):
        return jsonify({'status': 'error', 'message': 'Chemin de fichier invalide.'}), 400

    content_b64 = base64.b64encode(html_content.encode('utf-8')).decode('utf-8')
    api_url = f"https://api.github.com/repos/{OWNER}/{REPO}/contents/{filepath}"
    headers = {
        'Authorization': f'token {GITHUB_TOKEN}',
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'OUESSE-Publisher/1.0'
    }

    sha = None
    try:
        resp = requests.get(f"{api_url}?ref={BRANCH}", headers=headers, timeout=10)
        if resp.status_code == 200:
            sha = resp.json().get('sha')
        elif resp.status_code != 404:
            logger.warning(f"Réponse inattendue de GitHub GET: {resp.status_code}")
    except requests.RequestException as e:
        logger.warning(f"Erreur lors de la vérification du fichier: {e}")

    payload = {
        'message': f'\u270d\ufe0f Publication automatique : {html.escape(titre[:50])}',
        'content': content_b64,
        'branch': BRANCH
    }
    if sha:
        payload['sha'] = sha

    try:
        resp = requests.put(api_url, headers=headers, json=payload, timeout=15)
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.error(f"Erreur GitHub PUT: {e}")
        return jsonify({'status': 'error', 'message': 'Erreur lors de la publication sur GitHub.'}), 500

    commit_sha = resp.json().get('commit', {}).get('sha', '')[:7]
    logger.info(f"Publication réussie, commit: {commit_sha}")

    # Indexation automatique
    lien_public = f"{SITE_URL}/{filename}"
    try:
        indexer_page(slug, titre, html_content, filename, lien_public, data)
    except Exception as e:
        logger.error(f"Erreur d'indexation (non bloquant): {e}")

    try:
        generer_sitemap()
    except Exception as e:
        logger.error(f"Erreur sitemap (non bloquant): {e}")

    if validate_site_url(SITE_URL):
        try:
            requests.get(f"https://www.google.com/ping?sitemap={SITE_URL}/sitemap.xml", timeout=5)
            logger.info("Ping Google effectué")
        except Exception:
            pass

    return jsonify({
        'status': 'success',
        'message': f'\u2705 Page "{html.escape(titre[:100])}" publiée et indexée !',
        'url': lien_public,
        'commit': commit_sha
    })

@app.route('/api/reindexer', methods=['POST'])
@require_admin
def reindexer_tout():
    if not all([GITHUB_TOKEN, OWNER, REPO]):
        return jsonify({'status': 'error', 'message': 'Configuration GitHub incomplète.'}), 500

    contents_url = (
        f"https://api.github.com/repos/{OWNER}/{REPO}/contents/{REPO_PATH}?ref={BRANCH}"
        if REPO_PATH else
        f"https://api.github.com/repos/{OWNER}/{REPO}/contents/?ref={BRANCH}"
    )
    headers = {
        'Authorization': f'token {GITHUB_TOKEN}',
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'OUESSE-Publisher/1.0'
    }

    try:
        resp = requests.get(contents_url, headers=headers, timeout=10)
        resp.raise_for_status()
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Erreur GitHub: {str(e)}'}), 502

    files = resp.json()
    if not isinstance(files, list):
        return jsonify({'status': 'error', 'message': 'Réponse GitHub inattendue.'}), 502

    reindexees = []
    for f in files:
        fname = f.get('name', '')
        if not fname.endswith('.html') or fname == 'admin.html':
            continue
        try:
            raw_resp = requests.get(f['download_url'], timeout=10)
            if raw_resp.status_code != 200:
                continue
            contenu = raw_resp.text
            slug = fname[:-5]
            indexer_page(slug, slug, contenu, fname, f"{SITE_URL}/{fname}")
            reindexees.append(fname)
        except Exception as e:
            logger.error(f"Erreur lors de la réindexation de {fname}: {e}")

    return jsonify({'status': 'success', 'pages_indexees': reindexees, 'total': len(reindexees)})

@app.route('/api/indexer-local', methods=['POST'])
@require_admin
def indexer_local():
    """Indexe toutes les pages HTML présentes dans le dossier local"""
    dossiers = ['.', 'public', 'templates']
    fichiers_html = []

    pages_exclues = {'admin.html', 'generato.html'}
    for dossier in dossiers:
        if os.path.exists(dossier):
            for fichier in os.listdir(dossier):
                if fichier.endswith('.html') and fichier not in pages_exclues:
                    chemin_complet = os.path.join(dossier, fichier)
                    if os.path.isfile(chemin_complet):
                        fichiers_html.append((dossier, fichier))

    if not fichiers_html:
        return jsonify({'status': 'error', 'message': 'Aucun fichier HTML trouvé'}), 404

    indexes = []
    for dossier, fichier in fichiers_html:
        chemin = os.path.join(dossier, fichier)
        try:
            with open(chemin, 'r', encoding='utf-8') as f:
                contenu = f.read()

            slug = fichier.replace('.html', '')
            titre = slug.replace('-', ' ').title()

            # Extraire le titre depuis le HTML
            match = re.search(r'<title[^>]*>(.*?)</title>', contenu, re.DOTALL | re.IGNORECASE)
            if match:
                titre = html.unescape(match.group(1).strip())

            indexer_page(slug, titre, contenu, fichier, f"/{fichier}")
            indexes.append(fichier)
            logger.info(f"✅ Indexé: {fichier}")
        except Exception as e:
            logger.error(f"❌ Erreur lors de l'indexation de {fichier}: {e}")

    return jsonify({
        'status': 'success',
        'pages_indexees': indexes,
        'total': len(indexes)
    })


# =============================================
# 12. SITEMAP
# =============================================
def generer_sitemap():
    if not all([GITHUB_TOKEN, OWNER, REPO]):
        logger.warning("Sitemap: configuration GitHub incomplète")
        return

    contents_url = (
        f"https://api.github.com/repos/{OWNER}/{REPO}/contents/{REPO_PATH}?ref={BRANCH}"
        if REPO_PATH else
        f"https://api.github.com/repos/{OWNER}/{REPO}/contents/?ref={BRANCH}"
    )
    headers = {
        'Authorization': f'token {GITHUB_TOKEN}',
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'OUESSE-Publisher/1.0'
    }

    try:
        resp = requests.get(contents_url, headers=headers, timeout=10)
        if resp.status_code != 200:
            logger.warning(f"Sitemap: impossible de lister les fichiers ({resp.status_code})")
            return

        files = resp.json()
        if not isinstance(files, list):
            return

        urls = []
        now = datetime.now().isoformat()
        pages_exclues_sitemap = {'admin.html', 'generato.html', 'ibidon.html'}
        for file in files:
            fname = file.get('name', '')
            if fname.endswith('.html') and fname not in pages_exclues_sitemap:
                urls.append(
                    f"  <url>\n"
                    f"    <loc>{html.escape(SITE_URL)}/{html.escape(fname)}</loc>\n"
                    f"    <lastmod>{now}</lastmod>\n"
                    f"    <changefreq>weekly</changefreq>\n"
                    f"  </url>"
                )

        if not urls:
            return

        # CORRECTION : on construit le contenu en dehors de la f-string
        # pour éviter le backslash dans l'expression f-string
        urls_joined = "\n".join(urls)
        sitemap_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{urls_joined}
</urlset>"""

        sitemap_b64 = base64.b64encode(sitemap_content.encode('utf-8')).decode('utf-8')
        sitemap_payload = {
            'message': '\ud83d\udd04 Mise à jour automatique du sitemap',
            'content': sitemap_b64,
            'branch': BRANCH
        }

        sitemap_path = f"{REPO_PATH}/sitemap.xml" if REPO_PATH else "sitemap.xml"
        sitemap_api = f"https://api.github.com/repos/{OWNER}/{REPO}/contents/{sitemap_path}"

        resp_check = requests.get(sitemap_api, headers=headers, timeout=10)
        if resp_check.status_code == 200:
            sitemap_payload['sha'] = resp_check.json().get('sha')

        put_resp = requests.put(sitemap_api, headers=headers, json=sitemap_payload, timeout=10)
        if put_resp.status_code in (200, 201):
            logger.info("Sitemap mis à jour avec succès")
        else:
            logger.warning(f"Sitemap: erreur mise à jour ({put_resp.status_code})")

    except Exception as e:
        logger.error(f"Sitemap: erreur inattendue: {e}")


# =============================================
# 13. ROUTE UNIVERSELLE – TOUJOURS EN DERNIER
# =============================================
@app.route('/<path:filename>')
def servir_fichier(filename):
    """Sert tous les autres fichiers (HTML, etc.) – doit être la dernière route"""
    if '..' in filename or filename.startswith('/') or filename.startswith('\\'):
        return "Accès interdit", 403
    if filename.endswith('/'):
        return "Dossier non accessible", 404

    extensions_autorisees = ['.html', '.htm', '.css', '.js', '.json', 
                            '.png', '.jpg', '.jpeg', '.gif', '.svg', 
                            '.ico', '.webp', '.ttf', '.woff', '.woff2',
                            '.txt', '.xml', '.map', '.htaccess']
    ext = os.path.splitext(filename)[1].lower()
    if ext and ext not in extensions_autorisees:
        return "Type de fichier non autorisé", 403

    dossiers = ['.', 'public', 'static', 'templates']
    for dossier in dossiers:
        chemin = os.path.join(dossier, filename)
        if os.path.exists(chemin) and os.path.isfile(chemin):
            return send_from_directory(dossier, filename)

    if not ext and '.' not in filename:
        for dossier in dossiers:
            chemin = os.path.join(dossier, f'{filename}.html')
            if os.path.exists(chemin) and os.path.isfile(chemin):
                return send_from_directory(dossier, f'{filename}.html')

    return "Fichier non trouvé", 404


# =============================================
# 14. GESTION DES ERREURS
# =============================================
@app.errorhandler(404)
def not_found(e):
    return "Page non trouvée", 404

@app.errorhandler(429)
def ratelimit_handler(e):
    logger.warning(f"Rate limit atteint depuis {request.remote_addr}")
    return jsonify({
        'status': 'error',
        'message': 'Trop de requêtes. Veuillez réessayer dans quelques minutes.'
    }), 429

@app.errorhandler(500)
def internal_error(e):
    logger.error(f"Erreur interne: {e}")
    return jsonify({
        'status': 'error',
        'message': 'Une erreur interne est survenue. Veuillez réessayer plus tard.'
    }), 500


# =============================================
# 15. LANCEMENT DU SERVEUR
# =============================================
if __name__ == '__main__':
    debug_mode = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
    if debug_mode:
        logger.warning("MODE DEBUG ACTIVÉ - Ne pas utiliser en production!")

    print(f"\n{'='*50}")
    print("🚀 SERVEUR OUESSE DÉMARRÉ")
    print(f"{'='*50}")
    print(f"🌐 Site: http://127.0.0.1:{os.getenv('PORT', 5000)}/")
    print(f"📁 Fichiers servis depuis: {os.getcwd()}")
    print(f"📄 Pages HTML trouvées:")
    for f in os.listdir('.'):
        if f.endswith('.html'):
            print(f"   - http://127.0.0.1:{os.getenv('PORT', 5000)}/{f}")
    print(f"🔍 API Recherche: http://127.0.0.1:{os.getenv('PORT', 5000)}/api/search?q=marbre")
    print(f"🔐 Admin: http://127.0.0.1:{os.getenv('PORT', 5000)}/admin?token={os.getenv('ADMIN_TOKEN', 'NON_DEFINI')}")
    print(f"📁 Base de données: {DB_PATH}")
    print(f"{'='*50}\n")

    app.run(
        debug=debug_mode,
        host='0.0.0.0',
        port=int(os.getenv('PORT', 5000))
    )