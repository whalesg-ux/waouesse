const fs = require('fs');
const path = require('path');

const dir = __dirname;
const htmlFiles = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
const cssFiles = fs.readdirSync(dir).filter(f => f.endsWith('.css') && f !== 'style.css' && f !== 'search-widget.css');

// 1. Enlever "WAOUESSE" du nav menu dans tous les HTML
htmlFiles.forEach(file => {
    let content = fs.readFileSync(path.join(dir, file), 'utf8');
    let newContent = content.replace(/<li>\s*<a href="#waouesse">WAOUESSE<\/a>\s*<\/li>/gi, '');
    if (newContent !== content) {
        fs.writeFileSync(path.join(dir, file), newContent, 'utf8');
        console.log(`Removed WAOUESSE menu item from ${file}`);
    }
});

// 2. Supprimer les styles de texte redondants dans les autres CSS
cssFiles.forEach(file => {
    let content = fs.readFileSync(path.join(dir, file), 'utf8');
    let newContent = content;

    // Supprimer font-family partout
    newContent = newContent.replace(/font-family:[^;]+;/gi, '');

    // Supprimer le bloc *
    newContent = newContent.replace(/\*\s*\{[^}]*\}/gi, '');

    // Supprimer le bloc body
    newContent = newContent.replace(/body\s*\{[^}]*\}/gi, '');

    // Supprimer le bloc h1, h2, h3
    newContent = newContent.replace(/h1\s*,\s*h2\s*,\s*h3\s*\{[^}]*\}/gi, '');
    newContent = newContent.replace(/h1,h2,h3\s*\{[^}]*\}/gi, '');
    
    // Supprimer h1, h2, h3, h4, h5, h6
    newContent = newContent.replace(/h1\s*,\s*h2\s*,\s*h3\s*,\s*h4\s*,\s*h5\s*,\s*h6\s*\{[^}]*\}/gi, '');

    if (newContent !== content) {
        fs.writeFileSync(path.join(dir, file), newContent, 'utf8');
        console.log(`Cleaned typography styles from ${file}`);
    }
});
