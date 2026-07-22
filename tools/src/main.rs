use scraper::{Html, Selector};
use serde_json::json;
use std::fs;
use std::io;
use walkdir::WalkDir;

// BUG CORRIGÉ : ces dossiers n'étaient pas exclus, contrairement aux
// scripts Python équivalents (generate_index.py). L'outil parcourait donc
// potentiellement node_modules/.venv/.git en plus de perdre du temps.
const EXCLUDED_DIRS: [&str; 5] = [".venv", "node_modules", ".git", "__pycache__", "vendor"];

fn is_excluded(path: &std::path::Path) -> bool {
    path.components().any(|c| {
        let s = c.as_os_str().to_string_lossy();
        EXCLUDED_DIRS.contains(&s.as_ref())
    })
}

/// Tronque une chaîne à `max_chars` CARACTÈRES (pas octets) et ajoute "…".
/// BUG CORRIGÉ : le code original faisait `&full_text[0..200]`, un
/// découpage par INDEX D'OCTET. Le français contient des caractères
/// accentués encodés sur plusieurs octets en UTF-8 (é, è, ê...) ; si
/// l'octet 200 tombait au milieu d'un de ces caractères, Rust paniquait
/// avec "byte index 200 is not a char boundary". On découpe maintenant
/// par caractères Unicode, ce qui ne peut jamais couper au mauvais endroit.
fn truncate_chars(s: &str, max_chars: usize) -> String {
    if s.chars().count() > max_chars {
        let truncated: String = s.chars().take(max_chars).collect();
        format!("{}…", truncated)
    } else {
        s.to_string()
    }
}

fn main() -> io::Result<()> {
    let mut index = Vec::new();

    for entry in WalkDir::new("../")
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();

        if is_excluded(path) {
            continue;
        }

        if path.extension().and_then(|s| s.to_str()) == Some("html") {
            let url = path.to_string_lossy().replace("../", "/").replace('\\', "/");
            if url.contains("search") || url.contains("tools") {
                continue;
            }

            let html_content = fs::read_to_string(&path)?;
            let document = Html::parse_document(&html_content);

            let title_selector = Selector::parse("title").unwrap();
            let title = document
                .select(&title_selector)
                .next()
                .map(|el| el.text().collect::<String>())
                .unwrap_or_else(|| {
                    path.file_stem()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_else(|| "sans-titre".to_string())
                });

            let meta_selector = Selector::parse(r#"meta[name="description"]"#).unwrap();
            let desc = document
                .select(&meta_selector)
                .next()
                .and_then(|el| el.value().attr("content"))
                .unwrap_or("")
                .to_string();

            let p_selector = Selector::parse("p").unwrap();
            let full_text: String = document
                .select(&p_selector)
                .map(|el| el.text().collect::<String>())
                .collect::<Vec<String>>()
                .join(" ")
                .split_whitespace()
                .collect::<Vec<&str>>()
                .join(" ");

            let summary = truncate_chars(&full_text, 200);

            let icon = if url.contains("index") {
                "fa-house"
            } else if url.contains("decouvert") {
                "fa-compass"
            } else if url.contains("luc") {
                "fa-user"
            } else if url.contains("contact") {
                "fa-envelope"
            } else {
                "fa-file-lines"
            };

            // BUG CORRIGÉ : les champs s'appelaient "fullText" et "url" ici,
            // alors que search.js (côté site) attend "text" et "page". Si cet
            // outil Rust était utilisé pour régénérer search-index.json à la
            // place des scripts Python, la recherche du site cassait
            // silencieusement (item.text / item.page valant undefined).
            // Le schéma est maintenant identique à celui de generate_index.py.
            index.push(json!({
                "title": title,
                "desc": if desc.is_empty() { "Page automatique".to_string() } else { desc },
                "icon": icon,
                "page": url,
                "anchor": "",
                "text": full_text,
                "summary": summary
            }));

            println!("✅ Page indexée : {}", url);
        }
    }

    let json_output = serde_json::to_string_pretty(&index)?;
    fs::write("../search-index.json", json_output)?;

    println!("\n✅ Index généré avec succès ! {} pages indexées.", index.len());
    Ok(())
}
