import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const files = [
  'src/services/api.ts',
  'src/components/Layout.tsx',
  'src/pages/Pricing.tsx',
  'src/pages/Market.tsx',
  'e2e/pre-sale.spec.ts',
  'tracto-backend/main.py',
  'tracto-backend/services/billing_service.py',
  'tracto-backend/services/auth_service.py',
  'tracto-backend/services/mercadopago_service.py',
];

const replacements = [
  ['GRÃƒOS', 'GRÃOS'],
  ['PECUÃRIA', 'PECUÁRIA'],
  ['Ã¡', 'á'],
  ['Ã ', 'à'],
  ['Ã¢', 'â'],
  ['Ã£', 'ã'],
  ['Ã©', 'é'],
  ['Ãª', 'ê'],
  ['Ã­', 'í'],
  ['Ã³', 'ó'],
  ['Ã´', 'ô'],
  ['Ãµ', 'õ'],
  ['Ãº', 'ú'],
  ['Ã§', 'ç'],
  ['Ã', 'Á'],
  ['Ã‰', 'É'],
  ['Ã“', 'Ó'],
  ['Ã', 'Í'],
  ['Ã‡', 'Ç'],
  ['Â·', '·'],
  ['Âº', 'º'],
  ['mÂ³', 'm³'],
  ['âœ“', '✓'],
  ['â€¦', '...'],
  ['â€“', '-'],
  ['â€”', '-'],
  ['â†’', '->'],
  ['âš ï¸', 'ALERTA:'],
  ['â”€', '-'],
  ['â€œ', '"'],
  ['â€�', '"'],
  ['â€˜', "'"],
  ['â€™', "'"],
  ['SAÃDA', 'SAÍDA'],
  ['NÃƒO', 'NÃO'],
  ['PRODUÃ‡ÃƒO', 'PRODUÇÃO'],
];

const changed = [];

for (const rel of files) {
  const file = path.join(root, rel);
  let text = await fs.readFile(file, 'utf8');
  const before = text;
  for (const [broken, fixed] of replacements) {
    text = text.split(broken).join(fixed);
  }
  if (text !== before) {
    await fs.writeFile(file, text, 'utf8');
    changed.push(rel);
  }
}

console.log(changed.join('\n'));
