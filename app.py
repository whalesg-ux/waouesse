import os
import json
import re
import base64
import subprocess
import secrets
import requests
from datetime import datetime
from functools import wraps
from flask import Flask, request, jsonify, render_template, redirect, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'dev-key-change-me-in-production')

# =============================================
# CONFIGURATION (stockée dans .env)
# =============================================
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')
OWNER = os.getenv('GITHUB_OWNER')
REPO = os.getenv('GITHUB_REPO')
BRANCH = os.getenv('GITHUB_BRANCH', 'main')
SITE_URL = os.getenv('SITE_URL', 'https://votredomaine.com')
REPO_PATH = os.getenv('GITHUB_PATH', '').strip()

# Clé d'accès à l'outil d'administration (BUG CORRIGÉ : il n'y avait
# auparavant AUCUNE protection sur /admin et /api/publier — n'importe
# qui pouvait publier sur votre dépôt GitHub).
ADMIN_TOKEN = os.getenv('ADMIN_TOKEN')

# CORS : n'autorise que votre propre domaine (BUG CORRIGÉ : CORS(app)
# sans restriction autorisait n'importe quel site tiers à appeler l'API).
ALLOWED_ORIGINS = [o.strip() for o in os.getenv('ALLOWED_ORIGINS', SITE_URL).split(',') if o.strip()]
CORS(app, resources={r"/api/*": {"origins": ALLOWED_ORIGINS}})

# Vérification des variables essentielles (sans lever d'erreur)
if not all([GITHUB_TOKEN, OWNER, REPO]):
    print("⚠️ Variables d'environnement manquantes. Le serveur continuera mais la publication échouera.")
if not ADMIN_TOKEN:
    print("⚠️ ADMIN_TOKEN non défini : /admin et /api/publier sont désactivés par sécurité tant qu'il n'est pas configuré.")


def require_admin(view):
    """Protège une route par un jeton d'administration simple.

    Le jeton doit être fourni soit :
      - dans l'en-tête HTTP  : Authorization: Bearer <ADMIN_TOKEN>
      - soit en paramètre GET : ?token=<ADMIN_TOKEN>  (pour ouvrir /admin depuis un navigateur)
    """
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not ADMIN_TOKEN:
            return jsonify({'status': 'error', 'message': "Accès admin désactivé : ADMIN_TOKEN manquant côté serveur."}), 503

        supplied = request.args.get('token', '')
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            supplied = auth_header[len('Bearer '):]

        if not supplied or not secrets.compare_digest(supplied, ADMIN_TOKEN):
            return jsonify({'status': 'error', 'message': 'Non autorisé.'}), 401

        return view(*args, **kwargs)
    return wrapped


def slugifier(texte):
    """Nettoyage systématique d'un slug : lettres/chiffres/tirets uniquement.
    BUG CORRIGÉ : auparavant ce nettoyage n'était appliqué QUE si le champ
    'slug' envoyé par le client était vide, ce qui permettait à un client
    (ou un attaquant via curl/Postman) d'envoyer un slug contenant '../'
    et donc de tenter d'écrire en dehors du dossier prévu (path traversal)."""
    texte = (texte or '').strip().lower()
    # Translittération basique des accents français
    trans = str.maketrans('àâäéèêëîïôöùûüç', 'aaaeeeeiioouuuc')
    texte = texte.translate(trans)
    texte = re.sub(r'[^a-z0-9-]+', '-', texte).strip('-')
    return texte or 'page'

# =============================================
# ROUTE : Site officiel (page d'accueil)
# =============================================
@app.route('/')
def site_officiel():
    # BUG CORRIGÉ : cette route rendait auparavant "templates/index.html"
    # (une page de secours quasi vide) en PRIORITÉ sur le vrai site
    # "index.html" présent à la racine du projet, qui n'était donc jamais
    # affiché aux visiteurs. On sert maintenant le vrai fichier racine,
    # et on garde templates/index.html comme filet de sécurité en dernier
    # recours seulement.
    root_index = os.path.join(app.root_path, 'index.html')
    if os.path.exists(root_index):
        return send_from_directory(app.root_path, 'index.html')

    if os.path.exists(os.path.join(app.template_folder, 'index.html')):
        return render_template('index.html')

    return redirect("https://waouesse.vercel.app/accueil", code=302)

# =============================================
# ROUTE : Outil de publication (admin) — protégée
# =============================================
@app.route('/admin')
@require_admin
def admin():
    return render_template('admin.html')

# =============================================
# ROUTE : API de publication — protégée
# =============================================
@app.route('/api/publier', methods=['POST'])
@require_admin
def publier():
    if not all([GITHUB_TOKEN, OWNER, REPO]):
        return jsonify({'status': 'error', 'message': 'Configuration GitHub incomplète côté serveur (.env).'}), 500

    data = request.get_json(silent=True) or {}
    html_content = data.get('html')
    titre = (data.get('titre') or 'Sans titre').strip()

    # BUG CORRIGÉ : le slug est désormais TOUJOURS nettoyé, qu'il soit
    # fourni par le client ou déduit du titre.
    slug_brut = data.get('slug', '') or titre
    slug = slugifier(slug_brut)

    if not html_content:
        return jsonify({'status': 'error', 'message': 'Contenu HTML manquant'}), 400

    filename = f"{slug}.html"
    path_prefix = REPO_PATH.strip('/')
    filepath = f"{path_prefix}/{filename}" if path_prefix else filename

    content_b64 = base64.b64encode(html_content.encode('utf-8')).decode('utf-8')

    api_url = f"https://api.github.com/repos/{OWNER}/{REPO}/contents/{filepath}"
    headers = {
        'Authorization': f'token {GITHUB_TOKEN}',
        'Accept': 'application/vnd.github.v3+json'
    }

    # Vérifier si le fichier existe déjà
    sha = None
    try:
        resp = requests.get(f"{api_url}?ref={BRANCH}", headers=headers, timeout=10)
        if resp.status_code == 200:
            sha = resp.json().get('sha')
    except requests.RequestException:
        pass

    payload = {
        'message': f'📝 Publication automatique : {filename}',
        'content': content_b64,
        'branch': BRANCH
    }
    if sha:
        payload['sha'] = sha

    try:
        resp = requests.put(api_url, headers=headers, json=payload, timeout=15)
        resp.raise_for_status()
    except requests.RequestException as e:
        error_msg = str(e)
        try:
            error_json = resp.json()
            error_msg = error_json.get('message', error_msg)
        except Exception:
            pass
        return jsonify({'status': 'error', 'message': f'Erreur GitHub: {error_msg}'}), 500

    commit_data = resp.json()
    commit_sha = commit_data.get('commit', {}).get('sha', '')[:7]

    # SEO : Sitemap
    generer_sitemap()

    # Ping Google
    try:
        ping_url = f"https://www.google.com/ping?sitemap={SITE_URL}/sitemap.xml"
        requests.get(ping_url, timeout=5)
        print("✅ Ping Google effectué.")
    except Exception as e:
        print(f"⚠️ Erreur ping Google: {e}")

    # Régénération de l'index de recherche (subprocess)
    try:
        subprocess.run(['python3', 'generate_index.py'], check=True, capture_output=True, text=True)
        print("✅ Index de recherche régénéré.")
    except Exception as e:
        print(f"⚠️ Erreur lors de la génération de l'index : {e}")

    lien_public = f"{SITE_URL}/{filename}"
    return jsonify({
        'status': 'success',
        'message': f'✅ Page "{titre}" publiée avec succès !',
        'url': lien_public,
        'commit': commit_sha
    })

# =============================================
# FONCTION : Générer le sitemap XML
# =============================================
def generer_sitemap():
    """Génère un sitemap.xml à partir des fichiers HTML du dépôt via l'API GitHub"""
    if REPO_PATH:
        contents_url = f"https://api.github.com/repos/{OWNER}/{REPO}/contents/{REPO_PATH}?ref={BRANCH}"
    else:
        contents_url = f"https://api.github.com/repos/{OWNER}/{REPO}/contents/?ref={BRANCH}"

    headers = {'Authorization': f'token {GITHUB_TOKEN}'}

    try:
        resp = requests.get(contents_url, headers=headers, timeout=10)
        if resp.status_code != 200:
            print(f"⚠️ Impossible de lister les fichiers : {resp.status_code}")
            return

        files = resp.json()
        if isinstance(files, dict) and 'message' in files:
            print(f"⚠️ Réponse API : {files.get('message')}")
            return

        urls = []
        for file in files:
            if file.get('name', '').endswith('.html') and file['name'] != 'admin.html':
                lastmod = datetime.now().isoformat()
                url_path = file['name']
                urls.append(f"  <url>\n    <loc>{SITE_URL}/{url_path}</loc>\n    <lastmod>{lastmod}</lastmod>\n  </url>")

        sitemap_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{''.join(urls)}
</urlset>"""

        sitemap_b64 = base64.b64encode(sitemap_content.encode('utf-8')).decode('utf-8')
        sitemap_payload = {
            'message': '🔄 Mise à jour automatique du sitemap',
            'content': sitemap_b64,
            'branch': BRANCH
        }

        sitemap_path = f"{REPO_PATH}/sitemap.xml" if REPO_PATH else "sitemap.xml"
        sitemap_api = f"https://api.github.com/repos/{OWNER}/{REPO}/contents/{sitemap_path}"

        resp_check = requests.get(sitemap_api, headers=headers, timeout=10)
        if resp_check.status_code == 200:
            sitemap_payload['sha'] = resp_check.json().get('sha')

        put_resp = requests.put(sitemap_api, headers=headers, json=sitemap_payload, timeout=10)
        if put_resp.status_code in [200, 201]:
            print("✅ Sitemap mis à jour sur GitHub.")
        else:
            print(f"⚠️ Erreur mise à jour sitemap : {put_resp.status_code}")
    except Exception as e:
        print(f"❌ Erreur lors de la génération du sitemap : {e}")

# =============================================
# LANCEMENT DU SERVEUR
# =============================================
if __name__ == '__main__':
    env_path = '.env'
    if not os.path.exists(env_path):
        with open(env_path, 'w') as f:
            f.write(f"""GITHUB_TOKEN=ghp_VOTRE_TOKEN_ICI
GITHUB_OWNER=votre-compte
GITHUB_REPO=OUESSE
GITHUB_BRANCH=main
SITE_URL=https://votredomaine.com
GITHUB_PATH=public/
SECRET_KEY={secrets.token_hex(32)}
ADMIN_TOKEN={secrets.token_urlsafe(24)}
ALLOWED_ORIGINS=https://votredomaine.com
""")
        print("⚠️ Fichier .env créé avec un ADMIN_TOKEN généré aléatoirement. "
              "Modifiez GITHUB_TOKEN/GITHUB_OWNER/GITHUB_REPO puis notez l'ADMIN_TOKEN : "
              "il vous faudra l'ajouter en '?token=...' pour ouvrir /admin.")

    # BUG CORRIGÉ : debug=True + host 0.0.0.0 exposaient le débogueur Werkzeug
    # (exécution de code arbitraire) sur toutes les interfaces réseau.
    debug_mode = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(debug=debug_mode, host='127.0.0.1', port=int(os.getenv('PORT', 5000)))
