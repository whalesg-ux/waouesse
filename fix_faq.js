const fs = require('fs');
const path = require('path');

const dir = __dirname;
const htmlFiles = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
const cssFiles = fs.readdirSync(dir).filter(f => f.endsWith('.css') && f !== 'style.css');

// 1. Process HTML files
htmlFiles.forEach(file => {
    let content = fs.readFileSync(path.join(dir, file), 'utf8');

    // A) Convert <div class="faq-item">...</div> to <details class="faq-item">...</details>
    // Note: Some might already be details, so we only match <div class="faq-item">
    // Since it could span multiple lines, we use regex with [\s\S]*?
    // We match until the first </div> that closes it.
    // It's safer to just replace <div class="faq-item"> with <details class="faq-item"> 
    // and its closing </div> with </details>.
    // Then replace <h3>...</h3> inside it with <summary><h3>...</h3></summary>
    
    // First, convert the wrapper
    // Since nested divs aren't typical inside faq-item in these simple pages, we can just find them
    let changed = false;
    let newContent = content;

    // A simpler way: split by <div class="faq-item">
    let parts = newContent.split(/<div\s+class="faq-item"\s*>/i);
    if (parts.length > 1) {
        newContent = parts[0];
        for (let i = 1; i < parts.length; i++) {
            // Find the first closing </div>
            let divEnd = parts[i].indexOf('</div>');
            if (divEnd !== -1) {
                let inside = parts[i].substring(0, divEnd);
                // Wrap <h3> inside <summary> if it exists
                inside = inside.replace(/<h3([^>]*)>([\s\S]*?)<\/h3>/i, '<summary><h3$1>$2</h3></summary>');
                newContent += '<details class="faq-item">' + inside + '</details>' + parts[i].substring(divEnd + 6);
            } else {
                newContent += '<div class="faq-item">' + parts[i];
            }
        }
    }

    // B) Also remove local CSS inside <style> blocks that target .faq-section or .faq-item
    // Since some files like degla_benoit.html have large <style> blocks, we can just strip lines with .faq-section or .faq-item
    // Actually, it's safer to remove the block matching .faq-section { ... } or .faq-item { ... }
    const cssBlocksToRemove = [
        /\.faq-section\s*\{[\s\S]*?\}/gi,
        /\.faq-section\s+[^\{]+\{[\s\S]*?\}/gi,
        /\.faq-item\s*\{[\s\S]*?\}/gi,
        /\.faq-item\s+[^\{]+\{[\s\S]*?\}/gi
    ];
    
    // We only apply CSS removal to content inside <style> tags
    newContent = newContent.replace(/<style>([\s\S]*?)<\/style>/gi, (match, p1) => {
        let newStyle = p1;
        cssBlocksToRemove.forEach(regex => {
            newStyle = newStyle.replace(regex, '');
        });
        return `<style>${newStyle}</style>`;
    });

    if (newContent !== content) {
        fs.writeFileSync(path.join(dir, file), newContent, 'utf8');
        console.log(`Updated FAQ in ${file}`);
    }
});

// 2. Process CSS files
cssFiles.forEach(file => {
    let content = fs.readFileSync(path.join(dir, file), 'utf8');
    let newContent = content;

    const cssBlocksToRemove = [
        /\.faq-section\s*\{[^}]*\}/gi,
        /\.faq-section\s+[^\{]+\{[^}]*\}/gi,
        /\.faq-item\s*\{[^}]*\}/gi,
        /\.faq-item\s+[^\{]+\{[^}]*\}/gi
    ];

    cssBlocksToRemove.forEach(regex => {
        // Run multiple times to handle consecutive blocks
        let prev;
        do {
            prev = newContent;
            newContent = newContent.replace(regex, '');
        } while (newContent !== prev);
    });

    if (newContent !== content) {
        fs.writeFileSync(path.join(dir, file), newContent, 'utf8');
        console.log(`Removed FAQ styles from ${file}`);
    }
});
