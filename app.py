import os
import json
import re
import base64
import subprocess
import secrets
import logging
import html
import hashlib
import sys
from datetime import datetime
from functools import wraps
from urllib.parse import urlparse
import requests
from flask import Flask, request, jsonify, render_template, redirect, send_from_directory
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv

# =============================================
# CONFIGURATION DU LOGGING
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

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY')
if not app.secret_key:
    raise RuntimeError("SECRET_KEY doit être défini dans le fichier .env")

# =============================================
# RATE LIMITING (protection contre les abus)
# =============================================
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# =============================================
# CONFIGURATION (stockée dans .env)
# =============================================
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')
OWNER = os.getenv('GITHUB_OWNER')
REPO = os.getenv('GITHUB_REPO')
BRANCH = os.getenv('GITHUB_BRANCH', 'main')
SITE_URL = os.getenv('SITE_URL', 'https://votredomaine.com')
REPO_PATH = os.getenv('GITHUB_PATH', '').strip()

# Clé d'accès à l'administration
ADMIN_TOKEN = os.getenv('ADMIN_TOKEN')

# Validation des origines CORS
ALLOWED_ORIGINS = [o.strip() for o in os.getenv('ALLOWED_ORIGINS', SITE_URL).split(',') if o.strip()]
CORS(app, resources={r"/api/*": {"origins": ALLOWED_ORIGINS, "supports_credentials": False}})

# =============================================
# CONSTANTES DE SÉCURITÉ
# =============================================
MAX_TITLE_LENGTH = 200
MAX_HTML_SIZE = 5 * 1024 * 1024  # 5 Mo
MAX_SLUG_LENGTH = 100
ALLOWED_HTML_TAGS = {
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'a', 'img', 'div', 'span', 'table', 'tr', 'td', 'th',
    'thead', 'tbody', 'blockquote', 'code', 'pre', 'hr'
}
ALLOWED_HTML_ATTRS = {
    'href', 'src', 'alt', 'title', 'class', 'id', 'width', 'height'
}

# Vérification des variables essentielles
if not all([GITHUB_TOKEN, OWNER, REPO]):
    logger.warning("Variables d'environnement GitHub manquantes. La publication sera désactivée.")
if not ADMIN_TOKEN:
    logger.warning("ADMIN_TOKEN non défini : /admin et /api/publier sont désactivés.")

# Validation du format du token GitHub
if GITHUB_TOKEN and not re.match(r'^ghp_[a-zA-Z0-9]{36}$|^ghs_[a-zA-Z0-9]{36}$|^github_pat_[a-zA-Z0-9_]{22,}', GITHUB_TOKEN):
    logger.warning("Format du GITHUB_TOKEN suspect. Vérifiez votre token.")

# Validation de SITE_URL
_parsed_site = urlparse(SITE_URL)
if not _parsed_site.scheme in ('https', 'http') or not _parsed_site.netloc:
    raise RuntimeError("SITE_URL doit être une URL valide (https://domaine.com)")

# Validation de REPO_PATH (protection path traversal)
if REPO_PATH:
    # Normaliser et vérifier qu'il n'y a pas de ../
    normalized = os.path.normpath(REPO_PATH)
    if normalized.startswith('..') or normalized.startswith('/'):
        raise RuntimeError(f"GITHUB_PATH invalide (path traversal détecté): {REPO_PATH}")
    REPO_PATH = normalized.strip('/')


# =============================================
# DÉCORATEURS DE SÉCURITÉ
# =============================================

def require_admin(view):
    """Protège une route par un jeton d'administration.

    Le jeton doit être fourni soit :
      - dans l'en-tête HTTP : Authorization: Bearer <ADMIN_TOKEN>
      - soit en paramètre GET : ?token=<ADMIN_TOKEN>
    """
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not ADMIN_TOKEN:
            logger.warning("Tentative d'accès admin alors que ADMIN_TOKEN n'est pas configuré")
            return jsonify({
                'status': 'error', 
                'message': "Accès admin désactivé : configuration incomplète."
            }), 503

        supplied = request.args.get('token', '')
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            supplied = auth_header[len('Bearer '):]

        if not supplied:
            logger.warning(f"Tentative d'accès admin sans token depuis {request.remote_addr}")
            return jsonify({'status': 'error', 'message': 'Authentification requise.'}), 401

        if not secrets.compare_digest(supplied, ADMIN_TOKEN):
            logger.warning(f"Tentative d'accès admin avec token invalide depuis {request.remote_addr}")
            return jsonify({'status': 'error', 'message': 'Non autorisé.'}), 401

        logger.info(f"Accès admin autorisé depuis {request.remote_addr}")
        return view(*args, **kwargs)
    return wrapped


def validate_site_url(url):
    """Valide qu'une URL est externe (pas localhost, pas IP privée)."""
    parsed = urlparse(url)
    hostname = parsed.hostname or ''

    # Bloquer les URLs locales/privées
    blocked_hosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1']
    blocked_prefixes = ('10.', '172.16.', '172.17.', '172.18.', '172.19.', 
                        '172.20.', '172.21.', '172.22.', '172.23.', '172.24.',
                        '172.25.', '172.26.', '172.27.', '172.28.', '172.29.',
                        '172.30.', '172.31.', '192.168.')

    if hostname in blocked_hosts or hostname.startswith(blocked_prefixes):
        return False
    return True


# =============================================
# FONCTIONS UTILITAIRES
# =============================================

def slugifier(texte):
    """Nettoyage systématique d'un slug : lettres/chiffres/tirets uniquement.

    Protection contre :
    - Path traversal (../, ..\\)
    - Injection de caractères spéciaux
    - Slugs trop longs
    """
    if not texte:
        return 'page'

    texte = str(texte).strip().lower()

    # Limite de longueur
    texte = texte[:MAX_SLUG_LENGTH]

    # Translittération des accents
    trans = str.maketrans(
        'àâäáãåæéèêëíìîïóòôöõúùûüçñýÿ',
        'aaaaaaaeeeeiiiiooooouuuucnyy'
    )
    texte = texte.translate(trans)

    # Remplacer tout caractère non alphanumérique par un tiret
    texte = re.sub(r'[^a-z0-9-]+', '-', texte)

    # Nettoyer les tirets multiples et les bords
    texte = re.sub(r'-+', '-', texte).strip('-')

    return texte or 'page'


def sanitize_html_content(html_content):
    """Sanitization basique du HTML pour prévenir le XSS.

    Note : Pour une protection complète, utilisez bleach ou html-sanitizer.
    """
    if not html_content:
        return ''

    # Vérifier la taille maximale
    if len(html_content) > MAX_HTML_SIZE:
        raise ValueError(f"Contenu HTML trop volumineux (max {MAX_HTML_SIZE} octets)")

    # Vérifier que c'est bien du HTML (doit commencer par < ou contenir des balises)
    if not re.search(r'<[a-zA-Z][^>]*>', html_content):
        raise ValueError("Le contenu ne semble pas être du HTML valide")

    # Supprimer les balises script et style (protection XSS de base)
    # Note : c'est une protection minimale, bleach est recommandé en production
    html_content = re.sub(r'<script[^>]*>.*?</script>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
    html_content = re.sub(r'<style[^>]*>.*?</style>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
    html_content = re.sub(r'javascript:', '', html_content, flags=re.IGNORECASE)
    html_content = re.sub(r'on\w+\s*=', '', html_content, flags=re.IGNORECASE)

    return html_content


def safe_subprocess_call(script_name, cwd=None):
    """Exécute un script Python de manière sécurisée.

    Protection contre l'injection de commande.
    """
    # Chemin absolu obligatoire
    if cwd is None:
        cwd = os.path.dirname(os.path.abspath(__file__))

    script_path = os.path.join(cwd, script_name)

    # Vérifier que le script existe et est dans le répertoire attendu
    script_path = os.path.normpath(script_path)
    if not script_path.startswith(cwd):
        raise ValueError(f"Chemin de script non autorisé: {script_name}")

    if not os.path.exists(script_path):
        logger.warning(f"Script non trouvé: {script_path}")
        return None

    try:
        result = subprocess.run(
            [sys.executable, script_path],
            check=True,
            capture_output=True,
            text=True,
            cwd=cwd,
            timeout=30  # Timeout pour éviter les processus bloquants
        )
        logger.info(f"Script {script_name} exécuté avec succès")
        return result
    except subprocess.TimeoutExpired:
        logger.error(f"Timeout lors de l'exécution de {script_name}")
        return None
    except subprocess.CalledProcessError as e:
        logger.error(f"Erreur lors de l'exécution de {script_name}: {e.stderr}")
        return None


# =============================================
# ROUTES
# =============================================

@app.route('/')
def site_officiel():
    """Page d'accueil - sert le fichier racine index.html ou redirige."""
    root_index = os.path.join(app.root_path, 'index.html')
    if os.path.exists(root_index):
        return send_from_directory(app.root_path, 'index.html')

    template_index = os.path.join(app.template_folder or '', 'index.html')
    if os.path.exists(template_index):
        return render_template('index.html')

    return redirect("https://waouesse.vercel.app/accueil", code=302)


@app.route('/admin')
@require_admin
def admin():
    """Interface d'administration protégée."""
    return render_template('admin.html')


@app.route('/api/publier', methods=['POST'])
@require_admin
@limiter.limit("10 per minute")  # Rate limiting strict pour la publication
def publier():
    """Publie une page HTML sur GitHub.

    Protection intégrée :
    - Authentification admin obligatoire
    - Rate limiting (10/min)
    - Validation du contenu HTML
    - Sanitization anti-XSS
    - Protection path traversal
    """
    if not all([GITHUB_TOKEN, OWNER, REPO]):
        logger.error("Configuration GitHub incomplète")
        return jsonify({
            'status': 'error', 
            'message': 'Configuration GitHub incomplète côté serveur.'
        }), 500

    data = request.get_json(silent=True) or {}

    # Validation du titre
    titre = (data.get('titre') or 'Sans titre').strip()
    if len(titre) > MAX_TITLE_LENGTH:
        return jsonify({
            'status': 'error',
            'message': f'Titre trop long (max {MAX_TITLE_LENGTH} caractères)'
        }), 400

    # Récupération et validation du contenu HTML
    html_content = data.get('html')
    if not html_content:
        return jsonify({
            'status': 'error', 
            'message': 'Contenu HTML manquant'
        }), 400

    try:
        html_content = sanitize_html_content(html_content)
    except ValueError as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 400

    # Génération du slug (toujours nettoyé)
    slug_brut = data.get('slug', '') or titre
    slug = slugifier(slug_brut)

    logger.info(f"Publication demandée: titre='{titre}', slug='{slug}'")

    # Construction du chemin de fichier sécurisé
    filename = f"{slug}.html"
    filepath = f"{REPO_PATH}/{filename}" if REPO_PATH else filename

    # Double vérification path traversal
    if '..' in filepath or filepath.startswith('/'):
        logger.error(f"Tentative de path traversal bloquée: {filepath}")
        return jsonify({
            'status': 'error',
            'message': 'Chemin de fichier invalide.'
        }), 400

    # Encodage Base64
    content_b64 = base64.b64encode(html_content.encode('utf-8')).decode('utf-8')

    # Appel API GitHub
    api_url = f"https://api.github.com/repos/{OWNER}/{REPO}/contents/{filepath}"
    headers = {
        'Authorization': f'token {GITHUB_TOKEN}',
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'OUESSE-Publisher/1.0'
    }

    # Vérifier si le fichier existe déjà (récupération du SHA)
    sha = None
    try:
        resp = requests.get(
            f"{api_url}?ref={BRANCH}", 
            headers=headers, 
            timeout=10
        )
        if resp.status_code == 200:
            sha = resp.json().get('sha')
            logger.info(f"Fichier existant trouvé, SHA: {sha[:8] if sha else 'N/A'}...")
        elif resp.status_code == 404:
            logger.info("Nouveau fichier à créer")
        else:
            logger.warning(f"Réponse inattendue de GitHub GET: {resp.status_code}")
    except requests.RequestException as e:
        logger.warning(f"Erreur lors de la vérification du fichier: {e}")

    # Préparation du payload
    payload = {
        'message': f'\u270d\ufe0f Publication automatique : {html.escape(titre[:50])}',
        'content': content_b64,
        'branch': BRANCH
    }
    if sha:
        payload['sha'] = sha

    # Publication sur GitHub
    try:
        resp = requests.put(api_url, headers=headers, json=payload, timeout=15)
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.error(f"Erreur GitHub PUT: {e}")
        # Ne pas exposer les détails sensibles au client
        return jsonify({
            'status': 'error',
            'message': 'Erreur lors de la publication sur GitHub. Vérifiez les logs serveur.'
        }), 500

    commit_data = resp.json()
    commit_sha = commit_data.get('commit', {}).get('sha', '')[:7]
    logger.info(f"Publication réussie, commit: {commit_sha}")

    # Mise à jour du sitemap (asynchrone, erreurs non bloquantes)
    try:
        generer_sitemap()
    except Exception as e:
        logger.error(f"Erreur sitemap (non bloquant): {e}")

    # Ping Google (avec validation URL, erreurs non bloquantes)
    try:
        if validate_site_url(SITE_URL):
            ping_url = f"https://www.google.com/ping?sitemap={SITE_URL}/sitemap.xml"
            requests.get(ping_url, timeout=5)
            logger.info("Ping Google effectué")
        else:
            logger.warning("Ping Google ignoré: URL de site invalide")
    except Exception as e:
        logger.warning(f"Erreur ping Google (non bloquant): {e}")

    # Régénération de l'index de recherche (erreurs non bloquantes)
    try:
        import sys
        safe_subprocess_call('generate_index.py')
    except Exception as e:
        logger.warning(f"Erreur génération index (non bloquant): {e}")

    lien_public = f"{SITE_URL}/{filename}"
    return jsonify({
        'status': 'success',
        'message': f'\u2705 Page "{html.escape(titre[:100])}" publiée avec succès !',
        'url': lien_public,
        'commit': commit_sha
    })


# =============================================
# FONCTION : Générer le sitemap XML
# =============================================

def generer_sitemap():
    """Génère un sitemap.xml à partir des fichiers HTML du dépôt via l'API GitHub."""
    if not all([GITHUB_TOKEN, OWNER, REPO]):
        logger.warning("Sitemap: configuration GitHub incomplète")
        return

    if REPO_PATH:
        contents_url = f"https://api.github.com/repos/{OWNER}/{REPO}/contents/{REPO_PATH}?ref={BRANCH}"
    else:
        contents_url = f"https://api.github.com/repos/{OWNER}/{REPO}/contents/?ref={BRANCH}"

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
        if isinstance(files, dict) and 'message' in files:
            logger.warning(f"Sitemap: réponse API erreur: {files.get('message')}")
            return

        if not isinstance(files, list):
            logger.warning("Sitemap: format de réponse inattendu")
            return

        urls = []
        now = datetime.now().isoformat()

        for file in files:
            if not isinstance(file, dict):
                continue
            fname = file.get('name', '')
            # Exclure admin.html et les fichiers non-HTML
            if fname.endswith('.html') and fname != 'admin.html':
                url_path = f"{REPO_PATH}/{fname}" if REPO_PATH else fname
                urls.append(
                    f"  <url>\n"
                    f"    <loc>{html.escape(SITE_URL)}/{html.escape(fname)}</loc>\n"
                    f"    <lastmod>{now}</lastmod>\n"
                    f"    <changefreq>weekly</changefreq>\n"
                    f"  </url>"
                )

        if not urls:
            logger.info("Sitemap: aucune page HTML trouvée")
            return

        sitemap_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{'\n'.join(urls)}
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
        raise


# =============================================
# GESTION DES ERREURS
# =============================================

@app.errorhandler(429)
def ratelimit_handler(e):
    """Gestion du rate limiting."""
    logger.warning(f"Rate limit atteint depuis {request.remote_addr}")
    return jsonify({
        'status': 'error',
        'message': 'Trop de requêtes. Veuillez réessayer dans quelques minutes.'
    }), 429


@app.errorhandler(500)
def internal_error(e):
    """Gestion des erreurs internes (ne pas exposer de détails)."""
    logger.error(f"Erreur interne: {e}")
    return jsonify({
        'status': 'error',
        'message': 'Une erreur interne est survenue. Veuillez réessayer plus tard.'
    }), 500


# =============================================
# LANCEMENT DU SERVEUR
# =============================================

if __name__ == '__main__':
    env_path = '.env'
    if not os.path.exists(env_path):
        # Génération sécurisée du .env
        admin_token = secrets.token_urlsafe(32)
        secret_key = secrets.token_hex(32)

        env_content = f"""# Configuration OUESSE Publisher
# ============================================

# GitHub (obligatoire)
GITHUB_TOKEN=ghp_VOTRE_TOKEN_ICI
GITHUB_OWNER=votre-compte
GITHUB_REPO=OUESSE
GITHUB_BRANCH=main

# Site
SITE_URL=https://votredomaine.com
GITHUB_PATH=public/

# Sécurité (générées automatiquement)
SECRET_KEY={secret_key}
ADMIN_TOKEN={admin_token}

# CORS
ALLOWED_ORIGINS=https://votredomaine.com

# Développement (mettre 'true' uniquement en local)
FLASK_DEBUG=false
PORT=5000
"""
        with open(env_path, 'w', encoding='utf-8') as f:
            f.write(env_content)

        # Permissions restrictives (Unix)
        try:
            os.chmod(env_path, 0o600)
        except Exception:
            pass

        print(f"\n{'='*50}")
        print("\u26a0\ufe0f  FICHIER .env CRÉÉ")
        print(f"{'='*50}")
        print(f"\nADMIN_TOKEN : {admin_token}")
        print(f"\nModifiez GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO")
        print(f"Puis lancez: python app.py")
        print(f"\nAccès admin: http://127.0.0.1:5000/admin?token={admin_token}")
        print(f"{'='*50}\n")

    # Mode debug sécurisé
    debug_mode = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'

    if debug_mode:
        logger.warning("MODE DEBUG ACTIVÉ - Ne pas utiliser en production!")

    app.run(
        debug=debug_mode,
        host='127.0.0.1',  # Jamais 0.0.0.0 en debug
        port=int(os.getenv('PORT', 5000))
    )
