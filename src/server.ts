/**
 * Servidor HTTP unificado.
 *
 *  GET  /webhook/instagram   → verify token do Meta
 *  POST /webhook/instagram   → recebimento direto do Meta (HMAC validado)
 *  POST /agent/process       → orquestradores externos (n8n / Lyn / Composio)
 *
 * O agente certo (socialia ou sessao) é escolhido in-process via
 * lib/agentRouter.ts baseado na whitelist Postgres.
 *
 * Uso: npm run webhook
 *      ngrok http 3001
 *      Meta Developer Portal -> Webhooks -> Callback URL = <ngrok>/webhook/instagram
 */
import 'dotenv/config';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import crypto from 'node:crypto';
import { mastra } from './mastra/index.js';
import { pickAgent, routeAndProcess } from '../lib/agentRouter.js';
import { sendInstagramDM } from '../lib/shared/metaClient.js';
import { recordBotMessage, consumeIfBotMessage } from '../lib/shared/sentMessageCache.js';
import { MSG_DELIMITER, MAX_CHUNKS_PER_TURN } from '../lib/shared/constants.js';
import { resolveUsernameByIgsid } from '../lib/shared/igsidResolver.js';
import { setIgsidCache as cacheSocialia } from '../lib/socialia/igsidCacheClient.js';
import { setIgsidCache as cacheSessao } from '../lib/sessao/igsidCacheClient.js';
import { pauseAgentFor as pauseSocialia } from '../lib/socialia/agentControlClient.js';
import { pauseAgentFor as pauseSessao } from '../lib/sessao/agentControlClient.js';

const HUMAN_TAKEOVER_PAUSE_MS = Number(
  process.env.HUMAN_TAKEOVER_PAUSE_MS ?? 24 * 60 * 60 * 1000,
);
const INTER_MSG_DELAY_MS = Number(process.env.INTER_MSG_DELAY_MS ?? 1200);
const PORT = Number(process.env.WEBHOOK_PORT ?? 3001);
const VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN ?? '';
const APP_SECRET = process.env.META_APP_SECRET ?? '';

if (!VERIFY_TOKEN) console.warn('⚠️  INSTAGRAM_WEBHOOK_VERIFY_TOKEN ausente — verify falhará');
if (!APP_SECRET) console.warn('⚠️  META_APP_SECRET ausente — assinatura HMAC desativada');

async function sendChunkedMessage(igsid: string, fullText: string): Promise<number> {
  const chunks = fullText
    .split(MSG_DELIMITER)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (chunks.length > MAX_CHUNKS_PER_TURN) {
    console.warn(
      `⚠️  ${chunks.length} chunks gerados pelo LLM — truncando pra ${MAX_CHUNKS_PER_TURN} (anti-spam Meta).`,
    );
    chunks.length = MAX_CHUNKS_PER_TURN;
  }

  for (let i = 0; i < chunks.length; i++) {
    recordBotMessage(igsid, chunks[i]);
    await sendInstagramDM(igsid, chunks[i]);
    if (i < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, INTER_MSG_DELAY_MS));
    }
  }
  return chunks.length;
}

/**
 * Resolve username partindo do IGSID consultando ambas caches em UMA query.
 * Cache miss → chama Meta uma vez. A gravação no cache do schema certo
 * acontece DEPOIS de pickAgent decidir, em populateCacheForAgent.
 */
async function resolveUsername(igsid: string): Promise<{ username: string; needsCachePopulation: boolean }> {
  const resolved = await resolveUsernameByIgsid(igsid);
  return {
    username: resolved.username,
    needsCachePopulation: resolved.source === 'meta_api',
  };
}

async function populateCacheForAgent(
  agent: 'socialia' | 'sessao' | null,
  igsid: string,
  username: string,
): Promise<void> {
  // Sem agente decidido (lead em nenhuma whitelist), popula em ambos pra
  // não chamar Meta de novo na próxima DM antes do cadastro na whitelist.
  if (agent === null) {
    await Promise.all([cacheSocialia(igsid, username), cacheSessao(igsid, username)]);
    return;
  }
  const setFn = agent === 'sessao' ? cacheSessao : cacheSocialia;
  await setFn(igsid, username);
}

const app = new Hono();

app.get('/', (c) =>
  c.text(
    'Agent Avos webhook server (unificado).\n' +
      '  GET  /webhook/instagram   (Meta verify)\n' +
      '  POST /webhook/instagram   (Meta direto)\n' +
      '  POST /agent/process       (orquestradores: n8n, Lyn CRM)\n',
  ),
);

// ─── Endpoint pra orquestradores externos (n8n, Lyn CRM, Composio) ─────────
app.post('/agent/process', async (c) => {
  const expectedToken = process.env.AGENT_PROCESS_TOKEN;
  if (expectedToken) {
    const provided = c.req.header('x-avos-token');
    if (provided !== expectedToken) {
      return c.json({ error: 'unauthorized' }, 401);
    }
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid json' }, 400);
  }

  const { instagram_username, igsid, message, thread_id } = body ?? {};
  if (!message || typeof message !== 'string') {
    return c.json({ error: 'message required (string)' }, 400);
  }

  let username = instagram_username?.toLowerCase().replace(/^@/, '');
  let needsCachePopulation = false;
  if (!username) {
    if (!igsid) {
      return c.json({ error: 'instagram_username OR igsid required' }, 400);
    }
    try {
      const resolved = await resolveUsername(igsid);
      username = resolved.username;
      needsCachePopulation = resolved.needsCachePopulation;
    } catch (err: any) {
      return c.json({ error: `lookup IGSID failed: ${err.message}` }, 502);
    }
  }

  const tid = thread_id ?? (igsid ? `ig_${igsid}` : `user_${username}`);
  console.log(`📨 [agent/process] [${username}] (${igsid ?? '?'}): ${message}`);

  try {
    const result = await routeAndProcess({
      instagram_username: username,
      igsid,
      message,
      thread_id: tid,
    });

    if (needsCachePopulation && igsid) {
      await populateCacheForAgent(result.agent, igsid, username).catch((err) =>
        console.warn(`⚠️  populateCache falhou:`, err.message),
      );
    }

    const agentLabel = result.agent ?? 'nenhum';
    if (result.shouldSend) {
      console.log(
        `📤 [agent/process] [${username}] (via ${agentLabel}): ${result.message?.slice(0, 80)}...`,
      );
    } else {
      console.log(`⏭️  [agent/process] [${username}] (via ${agentLabel}) skip: ${result.skipReason}`);
    }
    return c.json(result, 200);
  } catch (err: any) {
    console.error(`❌ [agent/process] erro:`, err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ─── Verify Token (Meta valida URL antes de assinar) ───────────────────────
app.get('/webhook/instagram', (c) => {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verify OK');
    return c.text(challenge ?? '', 200);
  }
  console.warn('❌ Webhook verify FAILED — token mismatch');
  return c.text('forbidden', 403);
});

// ─── Recebimento de mensagens ───────────────────────────────────────────────
app.post('/webhook/instagram', async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header('x-hub-signature-256');

  if (APP_SECRET && !verifySignature(rawBody, signature)) {
    console.warn('❌ HMAC inválido — rejeitando');
    return c.text('forbidden', 403);
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.text('invalid json', 400);
  }

  setImmediate(() =>
    processPayload(payload).catch((err) => console.error('processPayload error:', err)),
  );
  return c.text('EVENT_RECEIVED', 200);
});

async function processPayload(payload: any): Promise<void> {
  if (payload.object !== 'instagram') {
    console.log('ignorado: object !==', payload.object);
    return;
  }

  for (const entry of payload.entry ?? []) {
    for (const ev of entry.messaging ?? []) {
      if (!ev.message?.text) continue;

      // ECHO — pode ser do bot (ignorar) ou humano digitando manualmente (auto-pausar)
      if (ev.message?.is_echo) {
        const leadIgsid = ev.recipient?.id;
        const text = ev.message.text;
        console.log(`📡 [echo] recipient=${leadIgsid} text="${text?.slice(0, 60)}"`);
        if (!leadIgsid) continue;

        if (consumeIfBotMessage(leadIgsid, text)) {
          console.log(`   └─ bate com cache do bot, ignorando`);
          continue;
        }

        try {
          const resolved = await resolveUsername(leadIgsid);
          const username = resolved.username;
          const decision = await pickAgent(username);
          if (resolved.needsCachePopulation) {
            await populateCacheForAgent(decision.agent, leadIgsid, username).catch((err) =>
              console.warn(`⚠️  populateCache (echo) falhou:`, err.message),
            );
          }
          // Se o lead nao esta em nenhuma whitelist, pausa em ambos schemas
          // (cinto-suspensorio: garantia de silencio se o humano assumir).
          const targets = decision.agent === 'sessao'
            ? [pauseSessao]
            : decision.agent === 'socialia'
              ? [pauseSocialia]
              : [pauseSocialia, pauseSessao];
          await Promise.all(
            targets.map((fn) =>
              fn(
                username,
                HUMAN_TAKEOVER_PAUSE_MS,
                `humano respondeu manualmente: "${text.slice(0, 80)}"`,
                'auto',
              ),
            ),
          );
          const hours = (HUMAN_TAKEOVER_PAUSE_MS / 3600000).toFixed(1);
          console.log(
            `🤚 [${username}] (${decision.agent ?? 'ambos'}) humano assumiu — agente pausado por ${hours}h`,
          );
        } catch (err: any) {
          console.error(`❌ erro ao auto-pausar (echo humano):`, err.message);
        }
        continue;
      }

      const igsid = ev.sender?.id;
      const text = ev.message.text;
      if (!igsid) continue;

      try {
        const resolved = await resolveUsername(igsid);
        const username = resolved.username;
        const threadId = `ig_${igsid}`;

        console.log(`📨 [${username}] (${igsid}): ${text}`);

        const result = await routeAndProcess({
          instagram_username: username,
          igsid,
          message: text,
          thread_id: threadId,
        });

        if (resolved.needsCachePopulation) {
          await populateCacheForAgent(result.agent, igsid, username).catch((err) =>
            console.warn(`⚠️  populateCache falhou:`, err.message),
          );
        }

        const agentLabel = result.agent ?? 'nenhum';
        if (result.shouldSend && result.message) {
          const chunkCount = await sendChunkedMessage(igsid, result.message);
          console.log(
            `📤 [${username}] (${agentLabel}, ${chunkCount} chunks): ${result.message.slice(0, 80)}...`,
          );
        } else {
          console.log(`⏭️  [${username}] (${agentLabel}) skip: ${result.skipReason}`);
        }
      } catch (err: any) {
        console.error(`❌ erro processando IGSID ${igsid}:`, err.message);
      }
    }
  }
}

function verifySignature(body: string, signature?: string): boolean {
  if (!signature) return false;
  const expected =
    'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(body).digest('hex');
  const expectedBuf = Buffer.from(expected);
  const sigBuf = Buffer.from(signature);
  // timingSafeEqual lança RangeError se os buffers tiverem tamanhos diferentes
  if (expectedBuf.length !== sigBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, sigBuf);
}

// Exposes mastra instance for `npm run dev` (mastra CLI)
export { mastra };

// ─── Boot ──────────────────────────────────────────────────────────────────
serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`🚀 Webhook server (unified): http://localhost:${info.port}`);
  console.log(`   GET  /webhook/instagram  (verify)`);
  console.log(`   POST /webhook/instagram  (Meta direto)`);
  console.log(`   POST /agent/process       (orquestradores externos)`);
  console.log(`   Agentes registrados: socialiaAgent, sessaoAgent`);
});
