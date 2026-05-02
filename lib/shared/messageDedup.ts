/**
 * Deduplica mensagens do Meta por `mid` (message id único).
 *
 * Causas comuns de mid duplicado:
 *   - Meta retransmite o webhook (timeout, retry interno)
 *   - Ngrok/proxy duplica request
 *   - Múltiplas subscriptions ativas no Meta App apontando pro mesmo URL
 *   - Restart do server durante buffer pendente faz a Meta reentregar
 *
 * Mantém em memória os mids vistos nos últimos TTL_MS. .unref() pra
 * não impedir o processo de encerrar.
 */

const TTL_MS = 5 * 60 * 1000; // 5 minutos cobre janela típica de retry da Meta
const GC_INTERVAL_MS = 60 * 1000;
const seen = new Map<string, number>(); // mid → expiresAt

setInterval(() => {
  const now = Date.now();
  for (const [mid, exp] of seen) {
    if (exp <= now) seen.delete(mid);
  }
}, GC_INTERVAL_MS).unref();

/**
 * Marca `mid` como visto. Retorna true se já tinha sido visto antes (duplicado).
 */
export function isDuplicateMid(mid: string | null | undefined): boolean {
  if (!mid) return false;
  const now = Date.now();
  const existing = seen.get(mid);
  if (existing && existing > now) {
    return true;
  }
  seen.set(mid, now + TTL_MS);
  return false;
}

export function getDedupStats() {
  return { tracked: seen.size, ttlMs: TTL_MS };
}
