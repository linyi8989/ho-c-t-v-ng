export interface DraftRecord<T = unknown> { version: 1; owner: string; scope: string; entity: string; slot?: string; at: number; revision?: number; value: T }
export interface DraftStorage { length: number; key(index: number): string | null; getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
const prefix = 'vhomework:authoring:v1:';
export const draftKey = (owner: string, scope: string, entity: string) => prefix + [owner, scope, entity].map(encodeURIComponent).join(':');
export function listDrafts<T>(store: DraftStorage, owner: string, scope: string): DraftRecord<T>[] {
  const found: DraftRecord<T>[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i); if (!key?.startsWith(prefix)) continue;
    try { const record = JSON.parse(store.getItem(key) || '') as DraftRecord<T>;
      if (record.version === 1 && record.owner === owner && record.scope === scope && typeof record.entity === 'string' && Number.isFinite(record.at) && record.value != null && key === draftKey(owner, scope, record.slot || record.entity)) found.push(record);
    } catch { /* Unrelated/malformed browser records are never restored or rewritten. */ }
  }
  return found.sort((a, b) => b.at - a.at);
}
export function writeDraft<T>(store: DraftStorage, record: DraftRecord<T>) {
  const json = JSON.stringify(record);
  if (new TextEncoder().encode(json).length > 2 * 1024 * 1024) throw new Error('Bản nháp vượt 2 MiB. Hãy lưu lên server trước khi thoát.');
  if (/data:(?:image|audio|application)\/[^\s";]+;base64,/i.test(json)) throw new Error('File chưa tải lên không được lưu trong bản nháp. Hãy tải media lên rồi lưu bài.');
  store.setItem(draftKey(record.owner, record.scope, record.slot || record.entity), json);
}
export function acknowledgeDraft<T>(store: DraftStorage, owner: string, scope: string, value: T, entity?: string) {
  const json = JSON.stringify(value);
  for (const record of listDrafts<T>(store, owner, scope)) if ((!entity || record.entity === entity) && JSON.stringify(record.value) === json) store.removeItem(draftKey(owner, scope, record.slot || record.entity));
}
