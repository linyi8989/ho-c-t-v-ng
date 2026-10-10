import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const root = path.resolve('dist/client');
const files = [];
async function visit(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('Unexpected symlink in client build');
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await visit(target);
    else if (entry.isFile() && entry.name !== 'release-manifest.json') {
      const bytes = await fs.readFile(target);
      files.push({ path: path.relative(root, target).split(path.sep).join('/'), bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
    }
  }
}
await visit(root);
files.sort((a,b)=>a.path.localeCompare(b.path));
const id = crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex');
await fs.writeFile(path.join(root,'release-manifest.json'), JSON.stringify({ version:1, id, builtAt:new Date().toISOString(), files }));
console.log('[Build] Client release manifest: '+files.length+' files.');
