/**
 * Gate de execução do agente SocialIA SDR.
 * Encapsula whitelist (opcional) + pause/resume antes de chamar o LLM.
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
    (process.env.WHITELIST_ENABLED_SOCIALIA ?? process.env.WHITELIST_ENABLED ?? 'false').toLowerCase() === 'true';

  if (whitelistEnabled && !(await isAuthorizedLead(instagram_username))) {
    return {
      shouldSend: false,
      skipReason: 'lead nao esta em public.disparos_enviados (whitelist socialia bloqueou)',
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
