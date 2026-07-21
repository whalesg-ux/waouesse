import os
import re
import json
from pathlib import Path

def main():
    # Dossiers à explorer (par défaut : racine et sous-dossiers)
    base_dir = Path('.')
    # Fichiers à exclure de l'index (ne pas les mettre dans search-index.json)
    EXCLUDED_FILES = {'admin.html', 'template.html', 'generator.html', 'index.html'}  # ajoutez si besoin
    EXCLUDED_DIRS = {'.venv', '__pycache__', 'node_modules', 'vendor'}

    data = []

    # Parcours récursif de tous les fichiers .html
    for file_path in base_dir.rglob('*.html'):
        # Ignorer les dossiers exclus
        if any(part in EXCLUDED_DIRS for part in file_path.parts):
            continue
        # Ignorer les fichiers exclus
        if file_path.name in EXCLUDED_FILES:
            continue

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            print(f"⚠️ Erreur lecture {file_path}: {e}")
            continue

        # Extraire le titre
        title_match = re.search(r'<title>(.*?)</title>', content, re.IGNORECASE | re.DOTALL)
        title = title_match.group(1).strip() if title_match else file_path.stem

        # Supprimer les balises HTML, garder le texte
        text = re.sub(r'<[^>]+>', ' ', content)
        text = re.sub(r'\s+', ' ', text).strip()

        # Chemin relatif pour l'URL (ex: "public/mon-article.html")
        rel_path = str(file_path).replace('\\', '/')

        data.append({
            "title": title,
            "page": rel_path,
            "text": text
        })

    # Écrire le fichier JSON
    with open('search-index.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅ Index généré avec {len(data)} pages.")

if __name__ == '__main__':
    main()