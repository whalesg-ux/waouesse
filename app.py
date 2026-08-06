# app.py - Serveur Flask pour l'API de recherche
# À placer sur PythonAnywhere ou en local

import os
import re
import json
import sqlite3
import unicodedata
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# =============================================
# 1. CONFIGURATION
# =============================================
app = Flask(__name__)
CORS(app)  # Autoriser les requêtes depuis Vercel

# Configuration
DB_PATH = os.environ.get('DB_PATH', 'ouesse-search.db')
DEBUG = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'

# Mots vides français
STOPWORDS_FR = {
    'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'a', 'au', 'aux',
    'en', 'dans', 'sur', 'pour', 'par', 'avec', 'ce', 'ces', 'cette', 'est',
    'sont', 'qui', 'que', 'ou', 'ne', 'pas', 'plus', 'se', 'son', 'sa', 'ses',
    'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles',
    'me', 'te', 'se', 'le', 'la', 'lui', 'leur', 'y', 'en'
}

# =============================================
# 2. FONCTIONS UTILITAIRES
# =============================================

def normaliser(texte):
    """Normalise le texte pour la recherche (sans accents, minuscules)"""
    if not texte:
        return ""
    # Supprimer les accents
    texte_sans_accents = ''.join(
        c for c in unicodedata.normalize('NFD', texte) 
        if unicodedata.category(c) != 'Mn'
    )
    return texte_sans_accents.lower().strip()

def get_db_connection():
    """Connexion à la base de données SQLite"""
    # Vérifier plusieurs chemins possibles
    chemins_possibles = [
        DB_PATH,
        os.path.join('/home', 'whalesg', DB_PATH),  # PythonAnywhere
        os.path.join(os.path.dirname(__file__), DB_PATH),
        os.path.join(os.path.dirname(__file__), 'data', DB_PATH),
        os.path.join('/tmp', DB_PATH),
    ]
    
    for chemin in chemins_possibles:
        if os.path.exists(chemin):
            print(f"✅ Base de données trouvée: {chemin}")
            conn = sqlite3.connect(chemin)
            conn.row_factory = sqlite3.Row
            return conn
    
    # Si la base n'existe pas, la créer
    print(f"⚠️ Base de données non trouvée, création dans {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialise la base de données si elle n'existe pas"""
    conn = get_db_connection()
    
    cursor = conn.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='search_index'
    """)
    
    if not cursor.fetchone():
        print("🔄 Création de la table search_index...")
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
        print("✅ Table search_index créée")
    else:
        print("✅ Table search_index trouvée")
    
    conn.close()
    return True

# Initialiser la base de données au démarrage
init_db()

# =============================================
# 3. ROUTES API
# =============================================

@app.route('/')
def home():
    """Page d'accueil de l'API"""
    return jsonify({
        'service': 'OUESSE Search API',
        'version': '1.0',
        'endpoints': {
            '/api/search?q=...': 'Recherche dans les pages',
            '/api/health': 'Vérification du service',
            '/api/stats': 'Statistiques de l\'index',
            '/api/indexer': 'Indexer une page (POST)'
        },
        'status': 'online'
    })

@app.route('/api/health')
def health():
    """Vérification que l'API fonctionne"""
    try:
        conn = get_db_connection()
        cursor = conn.execute("SELECT COUNT(*) as count FROM search_index")
        count = cursor.fetchone()['count']
        conn.close()
        
        return jsonify({
            'status': 'ok',
            'message': 'API de recherche OUESSE fonctionnelle',
            'db_path': DB_PATH,
            'pages_indexees': count,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/stats')
def stats():
    """Statistiques de l'index"""
    try:
        conn = get_db_connection()
        
        # Nombre total de pages
        cursor = conn.execute("SELECT COUNT(*) as count FROM search_index")
        total = cursor.fetchone()['count']
        
        # Dernières pages indexées
        cursor = conn.execute("""
            SELECT title, page, created_at 
            FROM search_index 
            ORDER BY created_at DESC 
            LIMIT 5
        """)
        dernieres = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        
        return jsonify({
            'total_pages': total,
            'dernieres_pages': dernieres,
            'db_path': DB_PATH
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/search')
def api_search():
    """
    API de recherche principale
    Exemple: /api/search?q=ministre
    """
    mot_cle = request.args.get('q', '').strip()
    
    # Validation
    if not mot_cle or len(mot_cle) < 2:
        return jsonify({
            'results': [],
            'message': 'Terme trop court (minimum 2 caractères)',
            'query': mot_cle
        })
    
    try:
        mot_cle_propre = normaliser(mot_cle)
        mots_requete = mot_cle_propre.split()
        
        conn = get_db_connection()
        
        # Récupérer toutes les pages
        rows = conn.execute("""
            SELECT title, desc, icon, page, anchor, keywords, text 
            FROM search_index
        """).fetchall()
        conn.close()
        
        if not rows:
            return jsonify({
                'results': [],
                'message': 'Aucune page indexée',
                'query': mot_cle
            })
        
        resultats = []
        
        for row in rows:
            titre_n = normaliser(row["title"])
            mots_cles_n = normaliser(row["keywords"] or "")
            texte_n = normaliser(row["text"] or "")
            
            score = 0
            mots_trouves = []
            
            for mot in mots_requete:
                if mot in titre_n:
                    score += 10
                    mots_trouves.append(mot)
                if mot in mots_cles_n:
                    score += 5
                    if mot not in mots_trouves:
                        mots_trouves.append(mot)
                if mot in texte_n:
                    score += 1
                    # Bonus pour occurrences multiples
                    occurrences = texte_n.count(mot)
                    if occurrences > 1:
                        score += min(occurrences, 5)
                    if mot not in mots_trouves:
                        mots_trouves.append(mot)
            
            if score > 0:
                resultats.append({
                    "title": row["title"],
                    "desc": row["desc"] or "",
                    "icon": row["icon"] or "fa-magnifying-glass",
                    "page": row["page"],
                    "anchor": row["anchor"] or "",
                    "keywords": row["keywords"] or "",
                    "text": row["text"] or "",
                    "score": score,
                    "mots_trouves": mots_trouves[:5]  # Pour le débogage
                })
        
        # Trier par score décroissant
        resultats.sort(key=lambda r: -r["score"])
        
        # Limiter à 15 résultats
        resultats = resultats[:15]
        
        return jsonify({
            'results': resultats,
            'count': len(resultats),
            'query': mot_cle,
            'total_pages': len(rows)
        })
        
    except Exception as e:
        print(f"❌ Erreur de recherche: {e}")
        return jsonify({
            'error': str(e),
            'results': []
        }), 500

@app.route('/api/indexer', methods=['POST'])
def indexer():
    """
    Indexer une page (pour mise à jour automatique)
    Exemple: POST /api/indexer avec JSON
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Données JSON requises'}), 400
        
        titre = data.get('title', 'Sans titre')
        contenu = data.get('content', '')
        url = data.get('url', '')
        description = data.get('description', '')
        keywords = data.get('keywords', '')
        
        if not contenu:
            return jsonify({'error': 'Contenu requis'}), 400
        
        # Nettoyer le contenu
        texte_brut = re.sub(r'<[^>]+>', ' ', contenu)
        texte_brut = re.sub(r'\s+', ' ', texte_brut).strip()
        
        if len(texte_brut) < 30:
            return jsonify({
                'error': 'Contenu trop court',
                'length': len(texte_brut)
            }), 400
        
        # Générer un slug
        slug = re.sub(r'[^a-z0-9-]+', '-', titre.lower())
        slug = re.sub(r'-+', '-', slug).strip('-')
        filename = f"{slug}.html"
        
        conn = get_db_connection()
        
        # Vérifier si la page existe déjà
        existing = conn.execute(
            "SELECT id FROM search_index WHERE page = ?", 
            (filename,)
        ).fetchone()
        
        if existing:
            conn.execute("""
                UPDATE search_index 
                SET title=?, desc=?, keywords=?, text=?, created_at=?
                WHERE page=?
            """, (titre, description, keywords, texte_brut, 
                  datetime.now().isoformat(), filename))
            message = "Page mise à jour"
        else:
            conn.execute("""
                INSERT INTO search_index 
                (title, desc, icon, page, anchor, keywords, text, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (titre, description, 'fa-magnifying-glass', filename, 
                  '', keywords, texte_brut, datetime.now().isoformat()))
            message = "Page indexée"
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'message': message,
            'page': filename,
            'title': titre
        })
        
    except Exception as e:
        print(f"❌ Erreur d'indexation: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/reindexer-tout', methods=['POST'])
def reindexer_tout():
    """
    Réindexer toutes les pages HTML du dossier public
    (Pour mise à jour automatique depuis GitHub)
    """
    try:
        # Dossier des pages HTML
        dossier_public = os.path.join(os.path.dirname(__file__), 'public')
        
        if not os.path.exists(dossier_public):
            return jsonify({
                'error': 'Dossier public non trouvé',
                'path': dossier_public
            }), 404
        
        fichiers = [f for f in os.listdir(dossier_public) 
                   if f.endswith('.html') and f not in ['admin.html', 'generato.html']]
        
        if not fichiers:
            return jsonify({'error': 'Aucun fichier HTML trouvé'}), 404
        
        indexes = []
        for fichier in fichiers:
            chemin = os.path.join(dossier_public, fichier)
            try:
                with open(chemin, 'r', encoding='utf-8') as f:
                    contenu = f.read()
                
                # Extraire le titre
                match = re.search(r'<title[^>]*>(.*?)</title>', contenu, re.DOTALL | re.IGNORECASE)
                titre = match.group(1).strip() if match else fichier.replace('.html', '').replace('-', ' ').title()
                
                # Extraire la description
                match = re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']*)["\']', 
                                 contenu, re.IGNORECASE)
                description = match.group(1).strip() if match else ''
                
                # Extraire les mots-clés
                match = re.search(r'<meta[^>]+name=["\']keywords["\'][^>]+content=["\']([^"\']*)["\']', 
                                 contenu, re.IGNORECASE)
                keywords = match.group(1).strip() if match else ''
                
                # Nettoyer le texte
                texte_brut = re.sub(r'<(script|style)[^>]*>.*?</\1>', ' ', contenu, flags=re.DOTALL | re.IGNORECASE)
                texte_brut = re.sub(r'<[^>]+>', ' ', texte_brut)
                texte_brut = re.sub(r'\s+', ' ', texte_brut).strip()
                
                if len(texte_brut) < 30:
                    continue
                
                conn = get_db_connection()
                
                # Vérifier si la page existe
                existing = conn.execute(
                    "SELECT id FROM search_index WHERE page = ?", 
                    (fichier,)
                ).fetchone()
                
                if existing:
                    conn.execute("""
                        UPDATE search_index 
                        SET title=?, desc=?, keywords=?, text=?, created_at=?
                        WHERE page=?
                    """, (titre, description, keywords, texte_brut, 
                          datetime.now().isoformat(), fichier))
                else:
                    conn.execute("""
                        INSERT INTO search_index 
                        (title, desc, icon, page, anchor, keywords, text, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (titre, description, 'fa-magnifying-glass', fichier, 
                          '', keywords, texte_brut, datetime.now().isoformat()))
                
                conn.commit()
                conn.close()
                indexes.append(fichier)
                print(f"✅ Indexé: {fichier}")
                
            except Exception as e:
                print(f"❌ Erreur pour {fichier}: {e}")
        
        return jsonify({
            'status': 'success',
            'pages_indexees': indexes,
            'total': len(indexes),
            'message': f'{len(indexes)} pages réindexées'
        })
        
    except Exception as e:
        print(f"❌ Erreur de réindexation: {e}")
        return jsonify({'error': str(e)}), 500

# =============================================
# 4. ROUTES STATIQUES (optionnel)
# =============================================

@app.route('/<path:filename>')
def servir_static(filename):
    """Servir les fichiers statiques (CSS, JS, etc.)"""
    if '..' in filename:
        return "Accès interdit", 403
    
    # Vérifier si le fichier existe
    if os.path.exists(filename):
        return send_from_directory('.', filename)
    
    # Vérifier dans le dossier public
    chemin_public = os.path.join('public', filename)
    if os.path.exists(chemin_public):
        return send_from_directory('public', filename)
    
    return "Fichier non trouvé", 404

# =============================================
# 5. GESTION DES ERREURS
# =============================================

@app.errorhandler(404)
def not_found(e):
    return jsonify({
        'error': 'Not Found',
        'message': 'La ressource demandée n\'existe pas'
    }), 404

@app.errorhandler(500)
def internal_error(e):
    return jsonify({
        'error': 'Internal Server Error',
        'message': 'Une erreur interne est survenue'
    }), 500

# =============================================
# 6. LANCEMENT DU SERVEUR
# =============================================

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = DEBUG
    
    print(f"\n{'='*50}")
    print("🚀 API de recherche OUESSE")
    print(f"{'='*50}")
    print(f"📁 Base de données: {DB_PATH}")
    print(f"🌐 http://localhost:{port}/")
    print(f"🔍 http://localhost:{port}/api/search?q=test")
    print(f"💚 http://localhost:{port}/api/health")
    print(f"{'='*50}\n")
    
    app.run(debug=debug, host='0.0.0.0', port=port)