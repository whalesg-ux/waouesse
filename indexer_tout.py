import sqlite3
import re
import os
import unicodedata
from datetime import datetime

DB_PATH = 'ouesse-search.db'

def normaliser(texte):
    if not texte:
        return ""
    texte_sans_accents = ''.join(
        c for c in unicodedata.normalize('NFD', texte) if unicodedata.category(c) != 'Mn'
    )
    return texte_sans_accents.lower().strip()

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

def extraire_description(html_content, texte_brut):
    m = re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']*)["\']', html_content, re.IGNORECASE)
    if m and m.group(1).strip():
        return m.group(1).strip()[:300]
    return texte_brut[:200] + ('...' if len(texte_brut) > 200 else '')

def extraire_mots_cles(html_content, texte_brut):
    m = re.search(r'<meta[^>]+name=["\']keywords["\'][^>]+content=["\']([^"\']*)["\']', html_content, re.IGNORECASE)
    if m and m.group(1).strip():
        return m.group(1).strip()[:500]
    
    mots = re.findall(r'\b\w{4,}\b', normaliser(texte_brut))
    stopwords = {'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'a', 'au', 'aux',
                 'en', 'dans', 'sur', 'pour', 'par', 'avec', 'ce', 'ces', 'cette', 'est',
                 'sont', 'qui', 'que', 'ou', 'ne', 'pas', 'plus', 'se', 'son', 'sa', 'ses'}
    
    vus = []
    for mot in mots:
        if mot not in stopwords and mot not in vus:
            vus.append(mot)
        if len(vus) >= 10:
            break
    return ', '.join(vus)

def indexer_page(page, titre, html_content, desc=None):
    texte_brut = extraire_texte_brut(html_content)
    if not desc:
        desc = extraire_description(html_content, texte_brut)
    titre_final = extraire_titre(html_content) or titre
    mots_cles = extraire_mots_cles(html_content, texte_brut)

    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        INSERT OR REPLACE INTO search_index (page, title, desc, icon, anchor, keywords, text, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (page, titre_final, desc, 'fa-file', '', mots_cles, texte_brut, datetime.now().isoformat()))
    conn.commit()
    conn.close()
    print(f"✅ Indexé: {page}")

# Scanner tous les fichiers HTML
for fichier in os.listdir('.'):
    if fichier.endswith('.html') and fichier != 'admin.html':
        try:
            with open(fichier, 'r', encoding='utf-8') as f:
                contenu = f.read()
            titre = fichier.replace('.html', '').replace('-', ' ').title()
            indexer_page(fichier, titre, contenu)
        except Exception as e:
            print(f"❌ Erreur pour {fichier}: {e}")

print("🏁 Indexation terminée !")