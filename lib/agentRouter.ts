/**
 * Roteador in-process: dado o username do lead, consulta as DUAS whitelists
 * (public.disparos_enviados e public.disparos_enviados_sessao_estrategica) e:
 *
 *  - se o lead aparece em só uma → o agente daquela whitelist atende
 *  - se aparece em ambas → desempata pelo MAX(enviado_em) mais recente
 *  - se não aparece em nenhuma → ninguém responde (skip)
 *
 * Substitui o antigo sessaoRouter.ts que fazia HTTP entre dois processos.
 */
import { mastra } from '../src/mastra/index.js';
import {
  isAuthorizedLead as isInSocialiaWhitelist,
  getLastDisparoTimestamp as lastSocialiaDisparo,
} from './socialia/disparosClient.js';
import {
  isAuthorizedLead as isInSessaoWhitelist,
  getLastDisparoTimestamp as lastSessaoDisparo,
} from './sessao/disparosClient.js';
import { runIfActive as runSocialiaIfActive } from './socialia/agentGate.js';
import { runIfActive as runSessaoIfActive } from './sessao/agentGate.js';

export type AgentKind = 'socialia' | 'sessao';

export interface RouteDecision {
  agent: AgentKind | null;
  reason: string;
}

export interface RouteResult {
  shouldSend: boolean;
  message?: string;
  skipReason?: string;
  agent: AgentKind | null;
}

export interface RoutePayload {
  instagram_username: string;
  igsid?: string;
  message: string;
  thread_id: string;
}

/**
 * Decide qual agente atende. Retorna `null` quando o lead não está em nenhuma
 * das duas whitelists (regra atual: ninguém responde nesse caso).
 */
export async function pickAgent(instagram_username: string): Promise<RouteDecision> {
  const [inSocialia, inSessao] = await Promise.all([
    isInSocialiaWhitelist(instagram_username),
    isInSessaoWhitelist(instagram_username),
  ]);

  if (!inSocialia && !inSessao) {
    return { agent: null, reason: 'lead nao esta em nenhuma whitelist' };
  }
  if (inSocialia && !inSessao) {
    return { agent: 'socialia', reason: 'apenas em disparos_enviados' };
  }
  if (!inSocialia && inSessao) {
    return { agent: 'sessao', reason: 'apenas em disparos_enviados_sessao_estrategica' };
  }

  // Em ambas: desempata pelo MAX(enviado_em) mais recente
  const [tsSocialia, tsSessao] = await Promise.all([
    lastSocialiaDisparo(instagram_username),
    lastSessaoDisparo(instagram_username),
  ]);

  const ms = (d: Date | null) => (d ? d.getTime() : 0);
  if (ms(tsSessao) > ms(tsSocialia)) {
    return {
      agent: 'sessao',
      reason: `em ambas; ultimo disparo sessao=${tsSessao?.toISOString()} > socialia=${tsSocialia?.toISOString()}`,
    };
  }
  // socialia mais recente OU empate exato → socialia (pela ordem natural)
  return {
    agent: 'socialia',
    reason: `em ambas; ultimo disparo socialia=${tsSocialia?.toISOString()} >= sessao=${tsSessao?.toISOString()}`,
  };
}

export async function routeAndProcess(payload: RoutePayload): Promise<RouteResult> {
  const decision = await pickAgent(payload.instagram_username);

  if (decision.agent === null) {
    return {
      shouldSend: false,
      skipReason: decision.reason,
      agent: null,
    };
  }

  const agentName = decision.agent === 'sessao' ? 'sessaoAgent' : 'socialiaAgent';
  const gate = decision.agent === 'sessao' ? runSessaoIfActive : runSocialiaIfActive;

  const result = await gate(
    payload.instagram_username,
    payload.message,
    payload.thread_id,
    async (msg, tid) => {
      const augmented = buildAugmentedPrompt({
        instagram_username: payload.instagram_username,
        igsid: payload.igsid,
        message: msg,
      });

      // Mastra v1.25: memory options ficam dentro de `memory: { thread, resource }`.
      // O formato antigo `threadId`/`resourceId` é deprecated e silenciosamente ignorado
      // pelo novo `generate()` — bug que faz o agente nunca persistir thread.
      const out: any = await mastra.getAgent(agentName).generate(augmented, {
        memory: {
          thread: tid,
          resource: payload.igsid ?? payload.instagram_username,
        },
      } as any);

      return extractText(out);
    },
  );

  return { ...result, agent: decision.agent };
}

function buildAugmentedPrompt(opts: {
  instagram_username: string;
  igsid?: string;
  message: string;
}): string {
  return (
    `[CONTEXTO_LEAD] instagram_username=${opts.instagram_username}` +
    (opts.igsid ? `, igsid=${opts.igsid}` : '') +
    `\nUse SEMPRE este instagram_username quando chamar tools. NUNCA use o texto da mensagem como username.\n\n` +
    `Mensagem do lead: ${opts.message}`
  );
}

function extractText(out: any): string {
  const lastStep = out?.steps?.[out.steps.length - 1];
  const lastMsg = out?.response?.messages?.[out.response.messages.length - 1];
  const lastMsgContent = Array.isArray(lastMsg?.content)
    ? lastMsg.content
        .filter((p: any) => p?.type === 'text')
        .map((p: any) => p.text)
        .join('\n')
    : typeof lastMsg?.content === 'string'
      ? lastMsg.content
      : '';

  return (
    (out?.text && out.text.trim() && out.text.trim() !== '""' ? out.text : '') ||
    (lastStep?.text && lastStep.text.trim() ? lastStep.text : '') ||
    lastMsgContent ||
    ''
  );
}
