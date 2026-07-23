import sqlite3
import re
import os
import unicodedata
from datetime import datetime

DB_PATH = 'ouesse-search.db'

def normaliser(texte):
    if not texte:
        return ""
    return ''.join(c for c in unicodedata.normalize('NFD', texte) if unicodedata.category(c) != 'Mn').lower().strip()

def extraire_texte_brut(html_content):
    texte = re.sub(r'<(script|style)[^>]*>.*?</\1>', ' ', html_content, flags=re.DOTALL | re.IGNORECASE)
    texte = re.sub(r'<[^>]+>', ' ', texte)
    texte = re.sub(r'\s+', ' ', texte).strip()
    return texte

def extraire_titre(html_content):
    m = re.search(r'<title[^>]*>(.*?)</title>', html_content, re.DOTALL | re.IGNORECASE)
    if m and m.group(1).strip():
        return m.group(1).strip()
    m = re.search(r'<h1[^>]*>(.*?)</h1>', html_content, re.DOTALL | re.IGNORECASE)
    if m and m.group(1).strip():
        return m.group(1).strip()
    return "Sans titre"

def indexer_page(page, titre, html_content):
    texte_brut = extraire_texte_brut(html_content)
    titre_final = extraire_titre(html_content) or titre
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        INSERT OR REPLACE INTO search_index (page, title, desc, icon, anchor, keywords, text, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (page, titre_final, '', 'fa-file', '', '', texte_brut, datetime.now().isoformat()))
    conn.commit()
    conn.close()
    print(f"✅ Indexé: {page}")

# Parcourir tous les fichiers HTML du dossier courant et des sous-dossiers
dossiers = ['.', 'public', 'templates']
fichiers = []

for dossier in dossiers:
    if os.path.exists(dossier):
        for f in os.listdir(dossier):
            if f.endswith('.html') and f != 'admin.html':
                fichiers.append(os.path.join(dossier, f))

if not fichiers:
    print("❌ Aucun fichier HTML trouvé.")
else:
    print(f"📄 {len(fichiers)} fichiers trouvés.")
    for chemin in fichiers:
        try:
            with open(chemin, 'r', encoding='utf-8') as f:
                contenu = f.read()
            nom = os.path.basename(chemin)
            titre = nom.replace('.html', '').replace('-', ' ').title()
            indexer_page(nom, titre, contenu)
        except Exception as e:
            print(f"❌ Erreur sur {nom}: {e}")
    print("🏁 Indexation terminée.")