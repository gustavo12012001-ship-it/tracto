const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '.stitch', 'designs');
const destDir = path.join(__dirname, 'tmp_jsx');

if (!fs.existsSync(destDir)){
    fs.mkdirSync(destDir);
}

const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    let content = fs.readFileSync(path.join(srcDir, file), 'utf8');
    
    // Extract everything inside <body>
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    let jsx = bodyMatch ? bodyMatch[1] : content;
    
    // Convert basic HTML to JSX
    jsx = jsx.replace(/class=/g, 'className=')
             .replace(/for=/g, 'htmlFor=')
             .replace(/viewbox/gi, 'viewBox')
             .replace(/stroke-linecap/gi, 'strokeLinecap')
             .replace(/stroke-linejoin/gi, 'strokeLinejoin')
             .replace(/stroke-width/gi, 'strokeWidth')
             .replace(/preserveaspectratio/gi, 'preserveAspectRatio')
             .replace(/font-variation-fill-1/gi, 'fontVariationFill1')
             // close empty tags
             .replace(/<img(.*?)>/g, (match) => {
                 if (match.endsWith('/>')) return match;
                 return match.replace(/>$/, ' />');
             })
             .replace(/<input(.*?)>/g, (match) => {
                 if (match.endsWith('/>')) return match;
                 return match.replace(/>$/, ' />');
             })
             .replace(/<br(.*?)>/g, (match) => {
                 if (match.endsWith('/>')) return match;
                 return match.replace(/>$/, ' />');
             })
             .replace(/<hr(.*?)>/g, (match) => {
                 if (match.endsWith('/>')) return match;
                 return match.replace(/>$/, ' />');
             })
             // inline styles conversion is tricky, let's just leave style={...} strings and we will manually fix them or use a regex
             .replace(/style="([^"]*)"/g, (match, styles) => {
                 const rules = styles.split(';').filter(r => r.trim());
                 const jsStyles = rules.map(rule => {
                     let [key, val] = rule.split(':').map(s => s.trim());
                     if(!key || !val) return '';
                     // camelCase key
                     key = key.replace(/-([a-z])/g, g => g[1].toUpperCase());
                     return `"${key}": "${val}"`;
                 }).filter(Boolean).join(', ');
                 return `style={{${jsStyles}}}`;
             })
             // Remove html comments
             .replace(/<!--[\s\S]*?-->/g, '');

    // Check for specific styles to inject
    const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
    let stylesToInject = '';
    if(styleMatch) {
       stylesToInject = `<style>{\`${styleMatch.map(s => s.replace(/<style[^>]*>|<\/style>/gi, '')).join('\\n')}\`}</style>`;
    }

    const componentName = file.replace('.html', '').charAt(0).toUpperCase() + file.replace('.html', '').slice(1);

    const fullJSX = `
import React from 'react';
import { Link } from 'react-router-dom';

export default function ${componentName}() {
  return (
    <>
      ${stylesToInject}
      ${jsx}
    </>
  );
}
`;
    fs.writeFileSync(path.join(destDir, `${componentName}.tsx`), fullJSX);
});
console.log("Done");
