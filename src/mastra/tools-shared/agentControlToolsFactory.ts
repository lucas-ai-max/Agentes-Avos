import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { AgentControlStatus } from '../../../lib/socialia/agentControlClient.js';

export interface AgentControlDeps {
  getAgentStatus: (instagram_username: string) => Promise<AgentControlStatus | null>;
  pauseAgent: (instagram_username: string, reason?: string, paused_by?: string) => Promise<void>;
  resumeAgent: (instagram_username: string) => Promise<void>;
}

const checkStatusSchema = z.object({
  instagram_username: z.string(),
});

const pauseSchema = z.object({
  instagram_username: z.string(),
  reason: z.string(),
  trigger: z.enum(['lead_pediu_humano', 'reclamou_bot', 'topico_complexo', 'pediu_outro_canal', 'outro']),
});

const resumeSchema = z.object({
  instagram_username: z.string(),
});

export function createAgentControlTools(deps: AgentControlDeps) {
  const checkAgentStatusTool = createTool({
    id: 'check_agent_status',
    description:
      'OBRIGATORIA: chame esta tool como PRIMEIRA acao em toda conversa, ANTES de qualquer outra tool. ' +
      'Verifica se o agente foi pausado (ex: humano assumiu a conversa). ' +
      'Se retornar paused=true, voce NAO deve responder ao lead — retorne apenas uma string vazia ou "[pausado]".',
    inputSchema: checkStatusSchema,
    execute: async (inputData: z.infer<typeof checkStatusSchema>) => {
      const { instagram_username } = inputData;
      const status = await deps.getAgentStatus(instagram_username);

      if (!status) {
        return { paused: false, mensagem: 'Agente ativo. Nunca foi pausado para este lead.' };
      }
      if (status.paused) {
        return {
          paused: true,
          reason: status.reason,
          paused_by: status.paused_by,
          paused_at: status.paused_at,
          mensagem: `AGENTE PAUSADO. NAO RESPONDER. Motivo: ${status.reason}. Responda string vazia ou "[pausado]".`,
        };
      }
      return {
        paused: false,
        resumed_at: status.resumed_at,
        mensagem: 'Agente ativo (foi pausado anteriormente mas ja esta retomado).',
      };
    },
  });

  const pauseAgentTool = createTool({
    id: 'pause_agent',
    description:
      'Pausa o agente para um lead especifico. Use quando detectar que humano deve assumir: ' +
      'lead pede humano/atendente, reclama de bot, ou surge topico complexo fora do escopo.',
    inputSchema: pauseSchema,
    execute: async (inputData: z.infer<typeof pauseSchema>) => {
      const { instagram_username, reason, trigger } = inputData;
      await deps.pauseAgent(instagram_username, reason, `auto-agente:${trigger}`);
      return {
        success: true,
        mensagem: `Agente pausado para @${instagram_username}. Motivo: ${reason}.`,
      };
    },
  });

  const resumeAgentTool = createTool({
    id: 'resume_agent',
    description:
      'Reativa o agente para um lead especifico. Use apenas quando o lead confirmar explicitamente que quer continuar o fluxo automatizado.',
    inputSchema: resumeSchema,
    execute: async (inputData: z.infer<typeof resumeSchema>) => {
      const { instagram_username } = inputData;
      await deps.resumeAgent(instagram_username);
      return { success: true, mensagem: `Agente reativado para @${instagram_username}.` };
    },
  });

  return {
    check_agent_status: checkAgentStatusTool,
    pause_agent: pauseAgentTool,
    resume_agent: resumeAgentTool,
  };
}
