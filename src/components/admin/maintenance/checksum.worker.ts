import { IncrementalSha256 } from './sha256';
self.onmessage = async (event: MessageEvent<File>) => {
  try {
    const file = event.data, hash = new IncrementalSha256(), block = 4 * 1024 * 1024;
    for (let offset = 0; offset < file.size; offset += block) {
      hash.update(new Uint8Array(await file.slice(offset, offset + block).arrayBuffer()));
      self.postMessage({ progress: Math.min(file.size, offset + block) / file.size });
    }
    self.postMessage({ sha256: hash.digest(), bytes: file.size });
  } catch { self.postMessage({ error: 'Không đọc được file local. Bản trên hosting được giữ nguyên.' }); }
};
