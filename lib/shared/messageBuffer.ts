/**
 * Buffer de mensagens por IGSID com debounce.
 *
 * Quando uma DM chega:
 *   - se já há buffer pra esse igsid → empilha o texto e RESETA o timer
 *   - se não há → cria buffer e agenda flush em MESSAGE_BUFFER_MS
 *
 * O flush junta todos os textos com `\n` e chama o callback uma vez só.
 * Default: 30s. Override via env MESSAGE_BUFFER_MS.
 *
 * Trade-off: usuários que mandam UMA mensagem só esperam 30s pela resposta.
 * Compensação: nunca mais respostas duplicadas pra mensagens quebradas.
 */

const BUFFER_MS = Number(process.env.MESSAGE_BUFFER_MS ?? 30_000);

interface Entry {
  messages: string[];
  timer: NodeJS.Timeout;
  firstAt: number;
}

const buffers = new Map<string, Entry>();

export type FlushCallback = (combinedMessage: string, count: number) => Promise<void>;

/**
 * Adiciona uma mensagem ao buffer do igsid. Reseta o timer pra
 * MESSAGE_BUFFER_MS a partir de agora. Quando o timer dispara,
 * chama `flush(combinedText, msgCount)` e remove o buffer.
 */
export function bufferIncomingMessage(
  igsid: string,
  message: string,
  flush: FlushCallback,
): void {
  const existing = buffers.get(igsid);
  if (existing) {
    clearTimeout(existing.timer);
    existing.messages.push(message);
    existing.timer = scheduleFlush(igsid, flush);
    return;
  }
  buffers.set(igsid, {
    messages: [message],
    timer: scheduleFlush(igsid, flush),
    firstAt: Date.now(),
  });
}

function scheduleFlush(igsid: string, flush: FlushCallback): NodeJS.Timeout {
  const t = setTimeout(async () => {
    const entry = buffers.get(igsid);
    if (!entry) return;
    buffers.delete(igsid);
    const combined = entry.messages.join('\n');
    try {
      await flush(combined, entry.messages.length);
    } catch (err: any) {
      console.error(`❌ buffer flush erro [igsid=${igsid}]:`, err?.message ?? err);
    }
  }, BUFFER_MS);
  // .unref() pra não impedir o processo de encerrar com buffer pendente
  t.unref();
  return t;
}

/**
 * Cancela qualquer buffer pendente pra esse igsid (uso: humano assumiu
 * conversa, não queremos que o agente responda 30s depois).
 */
export function cancelBuffer(igsid: string): boolean {
  const entry = buffers.get(igsid);
  if (!entry) return false;
  clearTimeout(entry.timer);
  buffers.delete(igsid);
  return true;
}

export function getBufferStats() {
  return {
    activeBuffers: buffers.size,
    bufferWindowMs: BUFFER_MS,
  };
}
