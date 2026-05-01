/**
 * Cache em memoria das mensagens que o BOT acabou de enviar.
 * Diferencia echoes do Meta entre bot vs humano digitando no app.
 */

interface Entry {
  text: string;
  expiresAt: number;
}

const TTL_MS = 10 * 60 * 1000;
const GLOBAL_GC_INTERVAL_MS = 5 * 60 * 1000;
const cache = new Map<string, Entry[]>();

setInterval(() => {
  const now = Date.now();
  for (const [igsid, list] of cache) {
    const fresh = list.filter((e) => e.expiresAt > now);
    if (fresh.length === 0) cache.delete(igsid);
    else if (fresh.length !== list.length) cache.set(igsid, fresh);
  }
}, GLOBAL_GC_INTERVAL_MS).unref();

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

function gc(igsid: string): void {
  const now = Date.now();
  const list = cache.get(igsid);
  if (!list) return;
  const fresh = list.filter((e) => e.expiresAt > now);
  if (fresh.length === 0) cache.delete(igsid);
  else cache.set(igsid, fresh);
}

export function recordBotMessage(igsid: string, text: string): void {
  if (!igsid || !text) return;
  gc(igsid);
  const list = cache.get(igsid) ?? [];
  list.push({ text: normalize(text), expiresAt: Date.now() + TTL_MS });
  cache.set(igsid, list);
}

export function consumeIfBotMessage(igsid: string, text: string): boolean {
  if (!igsid || !text) return false;
  gc(igsid);
  const list = cache.get(igsid);
  if (!list || list.length === 0) return false;

  const target = normalize(text);
  const idx = list.findIndex((e) => e.text === target);
  if (idx === -1) return false;

  list.splice(idx, 1);
  if (list.length === 0) cache.delete(igsid);
  else cache.set(igsid, list);
  return true;
}
