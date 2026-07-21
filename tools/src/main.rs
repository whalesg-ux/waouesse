use scraper::{Html, Selector};
use serde_json::json;
use std::fs;
use std::io;
use walkdir::WalkDir;

fn main() -> io::Result<()> {
    let mut index = Vec::new();

    for entry in WalkDir::new("../")
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("html") {
            let url = path.to_string_lossy().replace("../", "/").replace('\\', "/");
            if url.contains("search") || url.contains("tools") { continue; }

            let html_content = fs::read_to_string(&path)?;
            let document = Html::parse_document(&html_content);

            let title_selector = Selector::parse("title").unwrap();
            let title = document.select(&title_selector)
                .next()
                .map(|el| el.text().collect::<String>())
                .unwrap_or_else(|| path.file_stem().unwrap().to_string_lossy().to_string());

            let meta_selector = Selector::parse(r#"meta[name="description"]"#).unwrap();
            let desc = document.select(&meta_selector)
                .next()
                .and_then(|el| el.value().attr("content"))
                .unwrap_or("")
                .to_string();

            let p_selector = Selector::parse("p").unwrap();
            let full_text: String = document.select(&p_selector)
                .map(|el| el.text().collect::<String>())
                .collect::<Vec<String>>()
                .join(" ")
                .split_whitespace()
                .collect::<Vec<&str>>()
                .join(" ");

            let summary = if full_text.len() > 200 {
                format!("{}…", &full_text[0..200])
            } else {
                full_text.clone()
            };

            let icon = if url.contains("index") { "fa-house" }
                else if url.contains("decouvert") { "fa-compass" }
                else if url.contains("luc") { "fa-user" }
                else if url.contains("contact") { "fa-envelope" }
                else { "fa-file-lines" };

            index.push(json!({
                "title": title,
                "desc": desc,
                "summary": summary,
                "fullText": full_text,
                "url": url,
                "icon": icon
            }));

            println!("✅ Page indexée : {}", url);
        }
    }

    let json_output = serde_json::to_string_pretty(&index)?;
    fs::write("../search-index.json", json_output)?;

    println!("\n✅ Index généré avec succès ! {} pages indexées.", index.len());
    Ok(())
}