import { readFileSync } from 'node:fs';

const LOCAL_CSS_IMPORT = /^@import\s+["'](\.\/[^"']+\.css)["'];\s*$/gm;

export function readCssBundle(entryUrl: URL): string {
  const visited = new Set<string>();

  const read = (url: URL): string => {
    const key = url.href;
    if (visited.has(key)) return '';
    visited.add(key);

    const source = readFileSync(url, 'utf8');
    const imports = [...source.matchAll(LOCAL_CSS_IMPORT)]
      .map(match => read(new URL(match[1], url)));
    return [...imports, source].join('\n');
  };

  return read(entryUrl);
}
