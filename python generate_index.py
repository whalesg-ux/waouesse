import os
import json
import re
from pathlib import Path

# Dossiers et fichiers à ignorer
IGNORED_DIRS = {'.venv', '__pycache__', 'node_modules', 'vendor', '.git'}
IGNORED_FILES = {'admin.html', 'generator.html', 'template.html', 'search-index.json'}

def main():
    pages = []
    # Parcours récursif de tous les fichiers .html
    for file in Path('.').rglob('*.html'):
        # Ignorer les dossiers exclus
        if any(part in IGNORED_DIRS for part in file.parts):
            continue
        if file.name in IGNORED_FILES:
            continue
        pages.append(file)

    search_data = []

    for page_path in pages:
        try:
            with open(page_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            print(f"⚠️ Erreur lecture {page_path}: {e}")
            continue

        # Extraire le titre
        title_match = re.search(r'<title>(.*?)</title>', content, re.IGNORECASE | re.DOTALL)
        title = title_match.group(1).strip() if title_match else page_path.stem

        # Extraire la meta description (SEO)
        desc_match = re.search(r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']+)["\']', content, re.IGNORECASE)
        desc = desc_match.group(1).strip() if desc_match else ""

        # Supprimer les balises HTML et les espaces inutiles
        text_without_tags = re.sub(r'<[^>]+>', ' ', content)
        text_without_tags = re.sub(r'\s+', ' ', text_without_tags).strip()

        # Récupérer la première ancre (id) pour un lien direct vers une section
        anchors = re.findall(r'id=["\']([^"\']+)["\']', content)
        main_anchor = anchors[0] if anchors else ''

        entry = {
            "title": title,
            "desc": desc or "Page automatique",
            "icon": "fa-file-lines",
            "page": str(page_path.name),
            "anchor": f"#{main_anchor}" if main_anchor else "",
            "text": text_without_tags
        }
        search_data.append(entry)

    # Écrire le fichier JSON
    with open('search-index.json', 'w', encoding='utf-8') as f:
        json.dump(search_data, f, ensure_ascii=False, indent=2)

    print(f"✅ Index généré avec {len(search_data)} pages.")

if __name__ == '__main__':
    main()