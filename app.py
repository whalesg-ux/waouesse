import os
import json
import re
import base64
import subprocess
import requests
from datetime import datetime
from flask import Flask, request, jsonify, render_template, redirect, url_for
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'dev-key-change-me-in-production')
CORS(app)

# =============================================
# CONFIGURATION (stockée dans .env)
# =============================================
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')
OWNER = os.getenv('GITHUB_OWNER')
REPO = os.getenv('GITHUB_REPO')
BRANCH = os.getenv('GITHUB_BRANCH', 'main')
SITE_URL = os.getenv('SITE_URL', 'https://votredomaine.com')
REPO_PATH = os.getenv('GITHUB_PATH', '').strip()

# Vérification des variables essentielles
if not all([GITHUB_TOKEN, OWNER, REPO]):
    raise RuntimeError("Variables d'environnement manquantes : GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO")

# =============================================
# ROUTE : Site officiel (page d'accueil)
# =============================================
@app.route('/')
def site_officiel():
    # Option 1 : Si vous avez un fichier index.html dans templates/
    try:
        # Vérifier si le template existe avant de le rendre
        if os.path.exists(os.path.join(app.template_folder, 'index.html')):
            return render_template('index.html')
        else:
            # Option 2 : Rediriger vers votre vrai site officiel si hébergé ailleurs
            return redirect("https://waouesse.vercel.app/accueil", code=302)  # ou votre vrai domaine
    except Exception:
        # Fallback : une simple page d'accueil minimaliste
        return """
        <h1>Bienvenue sur Ouèssè Tourisme</h1>
        <p>Le site officiel est en construction. <a href="/admin">Accéder à l'outil d'administration</a></p>
        """

# =============================================
# ROUTE : Outil de publication (admin)
# =============================================
@app.route('/admin')
def admin():
    return render_template('admin.html')

# =============================================
# ROUTE : API de publication
# =============================================
@app.route('/api/publier', methods=['POST'])
def publier():
    data = request.get_json()
    html_content = data.get('html')
    slug = data.get('slug', '').strip()
    titre = data.get('titre', 'Sans titre')

    if not html_content:
        return jsonify({'status': 'error', 'message': 'Contenu HTML manquant'}), 400

    if not slug:
        slug = re.sub(r'[^a-z0-9-]+', '-', titre.lower()).strip('-')

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
        resp = requests.get(f"{api_url}?ref={BRANCH}", headers=headers)
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
        resp = requests.put(api_url, headers=headers, json=payload)
        resp.raise_for_status()
    except requests.RequestException as e:
        error_msg = str(e)
        try:
            error_json = resp.json()
            error_msg = error_json.get('message', error_msg)
        except:
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
        subprocess.run(['python', 'generate_index.py'], check=True, capture_output=True, text=True)
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

        resp_check = requests.get(sitemap_api, headers=headers)
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
            f.write("""GITHUB_TOKEN=ghp_VOTRE_TOKEN_ICI
GITHUB_OWNER=votre-compte
GITHUB_REPO=OUESSE
GITHUB_BRANCH=main
SITE_URL=https://votredomaine.com
GITHUB_PATH=public/
SECRET_KEY=ma-cle-secrete-aleatoire
""")
        print("⚠️ Fichier .env créé. Modifiez-le avec vos vraies informations.")

    app.run(debug=True, host='0.0.0.0', port=5000)