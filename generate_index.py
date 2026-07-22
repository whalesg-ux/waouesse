import re
import json
from pathlib import Path


def main():
    # Dossiers à explorer (par défaut : racine et sous-dossiers)
    base_dir = Path('.')

    # Fichiers à exclure de l'index (pages techniques, pas du contenu à chercher)
    # BUG CORRIGÉ : "index.html" était exclu par erreur, alors que la page
    # d'accueil contient du contenu réel (section "WAOUESSE" notamment,
    # utilisée comme exemple dans le fallback de search.js). Elle est
    # maintenant indexée comme les autres pages.
    EXCLUDED_FILES = {'admin.html', 'template.html', 'generator.html', 'generato.html'}
    EXCLUDED_DIRS = {'.venv', '__pycache__', 'node_modules', 'vendor', '.git'}

    data = []

    # Parcours récursif de tous les fichiers .html
    for file_path in sorted(base_dir.rglob('*.html')):
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

        # Extraire la meta description (SEO)
        desc_match = re.search(
            r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']+)["\']',
            content, re.IGNORECASE
        )
        desc = desc_match.group(1).strip() if desc_match else ""

        # Supprimer les balises HTML, garder le texte
        text = re.sub(r'<[^>]+>', ' ', content)
        text = re.sub(r'\s+', ' ', text).strip()

        # Récupérer la première ancre (id) pour un lien direct vers une section
        anchors = re.findall(r'id=["\']([^"\']+)["\']', content)
        main_anchor = anchors[0] if anchors else ''

        # Chemin relatif pour l'URL (ex: "public/mon-article.html")
        # BUG CORRIGÉ : le champ s'appelait tantôt "page", tantôt "url" selon
        # le script utilisé (voir tools/src/main.rs), ce qui cassait
        # search.js quand le mauvais générateur était utilisé. Le nom
        # canonique attendu par search.js est bien "page".
        rel_path = str(file_path).replace('\\', '/')
        if rel_path.startswith('./'):
            rel_path = rel_path[2:]

        data.append({
            "title": title,
            "desc": desc or "Page automatique",
            "icon": "fa-file-lines",
            "page": rel_path,
            "anchor": f"#{main_anchor}" if main_anchor else "",
            "text": text
        })

    # Écrire le fichier JSON
    with open('search-index.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅ Index généré avec {len(data)} pages.")


if __name__ == '__main__':
    main()
