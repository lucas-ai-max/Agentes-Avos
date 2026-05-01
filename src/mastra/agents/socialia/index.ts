import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';
import { openai } from '@ai-sdk/openai';
import { agentInstructions } from './instructions.js';
import { crmTools } from './tools/crmTools.js';
import { prospectTools } from './tools/prospectTools.js';
import { agentControlTools } from './tools/agentControlTools.js';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL não configurado no .env (connection string do Supabase)');
}

const WORKING_MEMORY_TEMPLATE = `
# Estado da Conversa (Working Memory)

Voce DEVE atualizar este bloco em todo turno. Use os campos pra rastrear onde
esta na conversa e nao repetir etapas.

- instagram_username:
- nome_lead:
- categoria_negocio:
- bio_relevante:
- contact_id (CRM):
- lead_id (CRM):
- etapa_atual: (etapa_0_crm | etapa_1_elogio | etapa_2_pitch | etapa_3_link | etapa_4_confirmacao | etapa_5_reforco | objecao_em_curso | finalizado_ganho | finalizado_perdido | aguardando_humano)
- ultima_pergunta_que_eu_fiz: (ex: "posso te explicar rapidinho?", "quer que eu te mande o link?", "ja caiu seu credito?")
- proximo_passo: (o que fazer quando o lead responder)
- perfil_DISC: (dominante | influente | analitico | estavel | indefinido)
- objecoes_levantadas:
- horario_agendado:

REGRA CRITICA:
- Antes de responder, LEIA este bloco. Se "etapa_atual" ja indica que voce esta
  na Etapa 3, nao volte pra Etapa 2.
- "ultima_pergunta_que_eu_fiz" diz o que o lead esta respondendo agora — use
  isso pra decidir o proximo passo.
- Atualize "etapa_atual" e "proximo_passo" a CADA turno.
`.trim();

const memory = new Memory({
  storage: new PostgresStore({
    id: 'socialia-agent-memory',
    connectionString: DATABASE_URL,
    schemaName: 'avos',
  }),
  options: {
    lastMessages: 100,
    workingMemory: {
      enabled: true,
      template: WORKING_MEMORY_TEMPLATE,
    },
    semanticRecall: false,
  },
});

export const socialiaAgent = new Agent({
  id: 'socialiaAgent',
  name: 'SocialIA SDR Agent',
  instructions: agentInstructions,
  model: openai('gpt-4.1-mini'),
  tools: { ...agentControlTools, ...prospectTools, ...crmTools },
  memory,
});
