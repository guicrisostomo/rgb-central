const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
// Pastas criadas por Git, builds, dependências e editores não fazem parte do
// pacote público. Worktrees do Kilo podem conter outro repositório completo e
// caminhos locais, portanto devem ser ignoradas como um todo.
const ignoredDirectories = new Set(['.git', '.kilo', 'dist', 'node_modules']);
const ignoredFiles = new Set(['package-lock.json']);
const privateGeneratedFiles = new Set([
  'config.json',
  'profiles.local.json',
  'rgb-central-diagnostico.txt',
  'rgb-central-interface.txt'
]);
const findings = [];

const forbidden = [
  { name: 'GitHub token', pattern: /\b(?:ghp_|github_pat_)[A-Za-z0-9_]+/g },
  { name: 'OpenAI key', pattern: /\bsk-[A-Za-z0-9_-]{20,}/g },
  { name: 'AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'Private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'Windows user profile path', pattern: /[A-Za-z]:\\Users\\[^\\\s]+/g },
  { name: 'Unix user home path', pattern: /\/(?:home|Users)\/[A-Za-z0-9._-]+/g },
  { name: 'Authorization bearer value', pattern: /Authorization[^\n]{0,40}Bearer\s+[A-Za-z0-9._-]{20,}/gi }
];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    if (entry.isFile() && ignoredFiles.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    if (!entry.isFile()) continue;
    const relative = path.relative(root, absolute);
    if (privateGeneratedFiles.has(entry.name)) {
      findings.push(`${relative}: arquivo local que não deve ser publicado`);
      continue;
    }
    const content = fs.readFileSync(absolute, 'utf8');
    for (const rule of forbidden) {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(content)) findings.push(`${relative}: ${rule.name}`);
    }
  }
}

walk(root);

if (findings.length) {
  console.error('Possíveis dados sensíveis encontrados:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Nenhum padrão sensível conhecido foi encontrado.');
