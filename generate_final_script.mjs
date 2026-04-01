import fs from 'fs';
import path from 'path';

const outPath = 'CÓDIGO_FINAL_TRACTO.md';
const header = `# Código Completo do Projeto Tracto\n\n Aqui estão todos os arquivos de configuração e código fonte do projeto.\n\n`;

let content = header;

function addFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) return;
  
  const ext = path.extname(filePath).slice(1);
  const isBinary = ['png', 'jpg', 'jpeg', 'gif', 'ico'].includes(ext);

  const isCode = ['ts', 'tsx', 'css', 'js', 'html', 'json', 'env', 'mjs', 'cjs', 'py', 'svg', 'sql'].includes(ext) || filePath.endsWith('.env');

  if (!isCode && !isBinary) return;

  const displayPath = filePath.replace(/\\/g, '/');
  content += `### \`${displayPath}\`\n\`\`\`${ext === 'env' ? 'text' : ext}\n`;
  
  if (isBinary) {
     content += `[Arquivo binário: ${displayPath}]\n`;
  } else {
     try {
       content += fs.readFileSync(filePath, 'utf8') + '\n';
     } catch (e) {
       content += `[Erro ao ler]: ${e.message}\n`;
     }
  }
  content += `\`\`\`\n\n\n`;
}

const topFiles = ['.env.example', 'eslint.config.js', 'index.html', 'package.json', 'vite.config.ts', 'tsconfig.json', 'README.md', 'SUPABASE_SETUP.md', 'PRODUCAO_SCHEMA.sql', 'public/sw.js'];
topFiles.forEach(addFile);

function traverse(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (['node_modules', 'dist', '.git', '.stitch', '.gemini'].includes(file)) continue;
    if (file === '.env') continue; // Extra safety
    if (file === outPath) continue; // Avoid self-inclusion
    
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      traverse(fullPath);
    } else {
      addFile(fullPath);
    }
  }
}

traverse('src');
traverse('tracto-backend');
fs.writeFileSync(outPath, content, 'utf8');
console.log(`✅ ${outPath} gerado!`);
