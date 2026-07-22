#!/usr/bin/env python3
"""
generate_index.py — Générateur d'index de recherche pour OUESSE

Ce script parcourt les fichiers HTML d'un répertoire sécurisé et génère
un fichier JSON (search-index.json) utilisé par le moteur de recherche
front-end (search.js).

Sécurité intégrée :
- Validation du répertoire racine (path traversal protection)
- Limites de taille fichier/nombre de fichiers (DoS protection)
- Fallback d'encodage (UTF-8 → latin-1)
- Filtrage du contenu sensible (emails, tokens)
- Sanitization HTML avant extraction de texte
- Gestion des doublons
"""

import re
import json
import logging
import os
import sys
from pathlib import Path
from html import unescape

# =============================================
# CONFIGURATION DU LOGGING
# =============================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# =============================================
# CONSTANTES DE SÉCURITÉ
# =============================================
MAX_FILE_SIZE = 5 * 1024 * 1024       # 5 Mo max par fichier
MAX_TOTAL_FILES = 1000                 # Max 1000 fichiers indexés
MAX_TEXT_LENGTH = 10000               # Max 10000 caractères par entrée
MAX_TITLE_LENGTH = 200
MAX_DESC_LENGTH = 500
SAFE_ROOT_DIRS = ['public', 'dist', 'build', 'docs', '.']

# Fichiers à exclure (pages techniques)
EXCLUDED_FILES = {
    'admin.html', 'template.html', 'generator.html',
    'generato.html', '404.html', '500.html'
}

# Dossiers à exclure
EXCLUDED_DIRS = {
    '.venv', '__pycache__', 'node_modules', 'vendor',
    '.git', '.github', '.vscode', 'venv', 'env'
}

# =============================================
# FONCTIONS UTILITAIRES
# =============================================

def validate_root_dir(base_dir: Path) -> Path:
    """Valide et résout le répertoire racine de manière sécurisée.

    Protection contre le path traversal : le répertoire résolu doit
    être un sous-répertoire du répertoire de travail ou d'un répertoire
    approuvé.
    """
    base_dir = base_dir.resolve()

    if not base_dir.exists():
        raise ValueError(f"Répertoire racine inexistant : {base_dir}")

    if not base_dir.is_dir():
        raise ValueError(f"Le chemin n'est pas un répertoire : {base_dir}")

    cwd = Path.cwd().resolve()

    try:
        base_dir.relative_to(cwd)
    except ValueError:
        if base_dir.name not in SAFE_ROOT_DIRS:
            raise ValueError(
                f"Répertoire non autorisé : {base_dir}. "
                f"Doit être un sous-répertoire de {cwd} ou nommé {SAFE_ROOT_DIRS}"
            )

    logger.info(f"Répertoire racine validé : {base_dir}")
    return base_dir


def safe_read_file(file_path: Path) -> str:
    """Lit un fichier HTML de manière sécurisée.

    Protection :
    - Limite de taille
    - Fallback d'encodage (UTF-8 → latin-1)
    - Gestion des erreurs
    """
    try:
        file_size = file_path.stat().st_size
    except OSError as e:
        logger.warning(f"Impossible de lire la taille de {file_path} : {e}")
        return ""

    if file_size > MAX_FILE_SIZE:
        logger.warning(f"Fichier trop volumineux ignoré ({file_size} octets) : {file_path}")
        return ""

    encodings = ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']

    for encoding in encodings:
        try:
            with open(file_path, 'r', encoding=encoding) as f:
                return f.read()
        except UnicodeDecodeError:
            continue
        except OSError as e:
            logger.warning(f"Erreur lecture {file_path} avec {encoding} : {e}")
            return ""

    logger.warning(f"Aucun encodage trouvé pour {file_path}")
    return ""


def sanitize_html_for_text(html_content: str) -> str:
    """Extrait le texte d'un document HTML de manière sécurisée.

    Supprime :
    - Les balises <script> et leur contenu
    - Les balises <style> et leur contenu
    - Les attributs d'événement (onclick, onload, etc.)
    - Les commentaires HTML
    - Les balises restantes

    Nettoie :
    - Les espaces multiples
    - Les entités HTML
    """
    if not html_content:
        return ""

    # 1. Supprimer les balises <script> et leur contenu
    text = re.sub(r'<script[^>]*>.*?</script>', '', html_content,
                  flags=re.DOTALL | re.IGNORECASE)

    # 2. Supprimer les balises <style> et leur contenu
    text = re.sub(r'<style[^>]*>.*?</style>', '', text,
                  flags=re.DOTALL | re.IGNORECASE)

    # 3. Supprimer les commentaires HTML
    text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)

    # 4. Supprimer les attributs d'événement (sécurité XSS)
    text = re.sub(r'''\son\w+\s*=\s*["'][^"']*["']''', '', text,
                  flags=re.IGNORECASE)

    # 5. Supprimer les balises restantes
    text = re.sub(r'<[^>]+>', ' ', text)

    # 6. Décoder les entités HTML (&amp; → &, &lt; → <)
    text = unescape(text)

    # 7. Normaliser les espaces
    text = re.sub(r'\s+', ' ', text).strip()

    # 8. Limiter la longueur
    if len(text) > MAX_TEXT_LENGTH:
        text = text[:MAX_TEXT_LENGTH] + '...'

    return text


def extract_title(html_content: str) -> str:
    """Extrait le titre d'un document HTML."""
    if not html_content:
        return ""

    title_match = re.search(
        r'<title\b[^>]*>(.*?)</title>',
        html_content,
        re.IGNORECASE | re.DOTALL
    )

    if title_match:
        title = title_match.group(1).strip()
        title = re.sub(r'\s+', ' ', title)
        title = unescape(title)
        return title[:MAX_TITLE_LENGTH]

    return ""


def extract_description(html_content: str) -> str:
    """Extrait la meta description d'un document HTML."""
    if not html_content:
        return ""

    desc_match = re.search(
        r'''<meta\s+(?:name=["']description["']\s+content=["']([^"']+)["']|'''
        r'''content=["']([^"']+)["']\s+name=["']description["'])''',
        html_content,
        re.IGNORECASE
    )

    if desc_match:
        desc = (desc_match.group(1) or desc_match.group(2)).strip()
        desc = unescape(desc)
        return desc[:MAX_DESC_LENGTH]

    return ""


def extract_first_paragraph(html_content: str) -> str:
    """Extrait le premier paragraphe comme fallback de description."""
    if not html_content:
        return ""

    para_match = re.search(
        r'<p\b[^>]*>(.*?)</p>',
        html_content,
        re.IGNORECASE | re.DOTALL
    )

    if para_match:
        para = para_match.group(1)
        para = re.sub(r'<[^>]+>', ' ', para)
        para = unescape(para)
        para = re.sub(r'\s+', ' ', para).strip()
        if len(para) > 20:
            return para[:MAX_DESC_LENGTH]

    return ""


def extract_anchors(html_content: str) -> list:
    """Extrait les ancres (id) pertinentes d'un document HTML."""
    if not html_content:
        return []

    anchors = []

    for tag in ['section', 'article', 'div', 'h2', 'h3']:
        pattern = r'''<%s\b[^>]*\bid=["']([^"']+)["']''' % re.escape(tag)
        found = re.findall(pattern, html_content, re.IGNORECASE)
        anchors.extend(found)

    ignored_ids = {'main', 'content', 'wrapper', 'container', 'page'}
    anchors = [a for a in anchors if a not in ignored_ids]

    return anchors


def filter_sensitive_content(text: str) -> str:
    """Filtre le contenu sensible du texte indexé.

    Supprime ou masque :
    - Les adresses email
    - Les tokens API (ghp_, ghs_, github_pat_)
    - Les clés secrètes génériques
    """
    if not text:
        return text

    # Masquer les emails
    text = re.sub(
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        '[email masqué]',
        text
    )

    # Masquer les tokens GitHub
    text = re.sub(
        r'\b(ghp_|ghs_|github_pat_)[a-zA-Z0-9_]{20,}\b',
        '[token masqué]',
        text
    )

    # Masquer les clés API génériques
    text = re.sub(
        r'''\b(api[_-]?key|apikey|token|secret)["']?\s*[:=]\s*["']?[a-zA-Z0-9_-]{20,}\b''',
        '[clé masquée]',
        text,
        flags=re.IGNORECASE
    )

    return text


def get_relative_path(file_path: Path, base_dir: Path) -> str:
    """Calcule le chemin relatif sécurisé."""
    try:
        rel = file_path.relative_to(base_dir)
        return str(rel).replace('\\', '/')
    except ValueError:
        return str(file_path).replace('\\', '/')


# =============================================
# FONCTION PRINCIPALE
# =============================================

def generate_index(base_dir: Path = None, output_file: str = 'search-index.json') -> int:
    """Génère l'index de recherche JSON.

    Args:
        base_dir: Répertoire racine à indexer (défaut: répertoire courant)
        output_file: Nom du fichier de sortie JSON

    Returns:
        Nombre de pages indexées
    """
    if base_dir is None:
        base_dir = Path('.')

    base_dir = validate_root_dir(base_dir)

    data = []
    file_count = 0

    logger.info(f"Début de l'indexation depuis {base_dir}")

    for file_path in sorted(base_dir.rglob('*.html')):
        if file_count >= MAX_TOTAL_FILES:
            logger.warning(f"Limite de {MAX_TOTAL_FILES} fichiers atteinte. Arrêt.")
            break

        if any(part in EXCLUDED_DIRS for part in file_path.parts):
            continue

        if file_path.name in EXCLUDED_FILES:
            logger.debug(f"Fichier exclu : {file_path.name}")
            continue

        content = safe_read_file(file_path)
        if not content:
            continue

        title = extract_title(content) or file_path.stem.replace('-', ' ').replace('_', ' ').title()
        desc = extract_description(content)

        if not desc:
            desc = extract_first_paragraph(content)

        if not desc:
            desc = f"Page {file_path.stem}"

        text = sanitize_html_for_text(content)
        text = filter_sensitive_content(text)

        anchors = extract_anchors(content)
        main_anchor = anchors[0] if anchors else ''

        rel_path = get_relative_path(file_path, base_dir)

        existing_pages = {item['page'] for item in data}
        if rel_path in existing_pages:
            logger.warning(f"Doublon détecté, ignoré : {rel_path}")
            continue

        data.append({
            "title": title,
            "desc": desc,
            "icon": "fa-file-lines",
            "page": rel_path,
            "anchor": f"#{main_anchor}" if main_anchor else "",
            "text": text
        })

        file_count += 1
        logger.debug(f"Indexé : {rel_path} — '{title[:50]}...'")

    output_path = base_dir / output_file

    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        try:
            os.chmod(output_path, 0o644)
        except OSError:
            pass

        logger.info(f"✅ Index généré : {len(data)} pages → {output_path}")

        total_text = sum(len(item['text']) for item in data)
        logger.info(f"   Taille totale du texte indexé : {total_text:,} caractères")

        return len(data)

    except OSError as e:
        logger.error(f"❌ Erreur écriture {output_path} : {e}")
        return 0


# =============================================
# POINT D'ENTRÉE
# =============================================

def main():
    """Point d'entrée principal avec gestion des arguments."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Génère un index de recherche JSON à partir de fichiers HTML"
    )
    parser.add_argument(
        '--dir', '-d',
        type=str,
        default='.',
        help='Répertoire racine à indexer (défaut: courant)'
    )
    parser.add_argument(
        '--output', '-o',
        type=str,
        default='search-index.json',
        help='Fichier de sortie JSON (défaut: search-index.json)'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Mode verbeux'
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    try:
        count = generate_index(
            base_dir=Path(args.dir),
            output_file=args.output
        )
        sys.exit(0 if count > 0 else 1)
    except ValueError as e:
        logger.error(f"Erreur de configuration : {e}")
        sys.exit(2)
    except Exception as e:
        logger.error(f"Erreur inattendue : {e}")
        sys.exit(3)


if __name__ == '__main__':
    main()