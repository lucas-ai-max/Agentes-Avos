import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';
import { openai } from '@ai-sdk/openai';
import { agentInstructions } from './instructions.js';
import { crmTools } from './tools/crmTools.js';
import { prospectTools } from './tools/prospectTools.js';
import { agentControlTools } from './tools/agentControlTools.js';
import { calendarTools } from './tools/calendarTools.js';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL não configurado no .env (connection string do Supabase)');
}

const memory = new Memory({
  storage: new PostgresStore({
    id: 'sessao-estrategica-agent-memory',
    connectionString: DATABASE_URL,
    schemaName: 'avos_sessao',
  }),
  options: {
    lastMessages: 40,
    workingMemory: { enabled: false },
    semanticRecall: false,
  },
});

export const sessaoAgent = new Agent({
  id: 'sessaoAgent',
  name: 'Sessão Estratégica Agent',
  instructions: agentInstructions,
  model: openai('gpt-4.1-mini'),
  tools: { ...agentControlTools, ...prospectTools, ...crmTools, ...calendarTools },
  memory,
});
