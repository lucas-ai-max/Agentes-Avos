/**
 * Gate de execução do agente Sessão Estratégica.
 * O roteador upstream já filtra pela whitelist sessao_estrategica antes de
 * chegar aqui — mantemos a checagem como cinto-e-suspensórios.
 */
import { isAgentPaused } from './agentControlClient.js';
import { isAuthorizedLead } from './disparosClient.js';

export interface AgentRunResult {
  shouldSend: boolean;
  message?: string;
  skipReason?: string;
}

export type AgentRunner = (message: string, threadId: string) => Promise<string>;

export async function runIfActive(
  instagram_username: string,
  message: string,
  threadId: string,
  runner: AgentRunner,
): Promise<AgentRunResult> {
  const whitelistEnabled =
    (process.env.WHITELIST_ENABLED_SESSAO ?? 'true').toLowerCase() === 'true';

  if (whitelistEnabled && !(await isAuthorizedLead(instagram_username))) {
    return {
      shouldSend: false,
      skipReason:
        'lead nao esta em public.disparos_enviados_sessao_estrategica (whitelist sessao bloqueou)',
    };
  }

  if (await isAgentPaused(instagram_username)) {
    return {
      shouldSend: false,
      skipReason: 'agente pausado (humano assumiu)',
    };
  }

  const text = await runner(message, threadId);
  const trimmed = (text ?? '').trim();
  const stripped = trimmed.replace(/^['"]+|['"]+$/g, '').trim();

  if (
    !trimmed ||
    !stripped ||
    stripped === '[pausado]' ||
    stripped.toLowerCase() === 'null' ||
    stripped.toLowerCase() === 'undefined'
  ) {
    return {
      shouldSend: false,
      skipReason: `agente respondeu vazio/marcador ("${trimmed.slice(0, 30)}")`,
    };
  }

  return { shouldSend: true, message: trimmed };
}
