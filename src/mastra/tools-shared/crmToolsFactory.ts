import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  findOrCreateContact,
  createLead,
  updateLead,
  addLeadNote,
} from '../../../lib/shared/crmClient.js';

export interface CrmToolsConfig {
  pipelineEnvVar: string;
  stageEnvVar: string;
}

const COMPANY_ID = process.env.CRM_COMPANY_ID ?? '';

export function createCrmTools(cfg: CrmToolsConfig) {
  const pipelineId = process.env[cfg.pipelineEnvVar] || undefined;
  const stageInicialId = process.env[cfg.stageEnvVar] || undefined;

  const ensureContactTool = createTool({
    id: 'ensure_contact',
    description:
      'Busca o contato no CRM pelo username do Instagram. Se não existir, cria um novo. ' +
      'Sempre chame esta tool no início de uma nova conversa antes de criar leads ou notas. ' +
      'Retorna o contact_id e se o contato foi recém-criado.',
    inputSchema: z.object({
      nome: z.string(),
      instagram_username: z.string(),
      email: z.string().email().optional(),
      telefone: z.string().optional(),
      segmento: z.string().optional(),
      bio: z.string().optional(),
    }),
    execute: async (inputData: Record<string, any>) => {
      const { nome, instagram_username, email, telefone, segmento, bio } = inputData;
      const result = await findOrCreateContact({
        nome,
        company_id: COMPANY_ID,
        email,
        telefone,
        source: 'instagram',
        segmento,
        tags: ['instagram', 'agente-ia'],
        custom_fields: { instagram_username, ...(bio ? { bio } : {}) },
      });
      return {
        contact_id: result.data.id,
        nome: result.data.nome,
        recém_criado: result.created,
        mensagem: result.created
          ? `Novo contato criado no CRM: ${result.data.nome} (${result.data.id})`
          : `Contato já existia no CRM: ${result.data.nome} (${result.data.id})`,
      };
    },
  });

  const createLeadTool = createTool({
    id: 'create_lead',
    description:
      'Cria um lead no funil de vendas do CRM após confirmar que o contato tem fit. ' +
      'Retorna o lead_id para usar nas tools de atualização e notas.',
    inputSchema: z.object({
      contact_id: z.string(),
      instagram_username: z.string(),
      nome: z.string(),
      segmento: z.string().optional(),
      email: z.string().email().optional(),
      telefone: z.string().optional(),
      prioridade: z.enum(['high', 'medium', 'low']).default('medium'),
      descricao: z.string().optional(),
    }),
    execute: async (inputData: Record<string, any>) => {
      const { contact_id, instagram_username, nome, segmento, email, telefone, prioridade, descricao } = inputData;
      const result = await createLead({
        nome: `${nome} (@${instagram_username})`,
        company_id: COMPANY_ID,
        email,
        telefone,
        segmento,
        source: 'instagram',
        status: 'novo',
        prioridade,
        tags: ['instagram-dm', 'agente-ia'],
        description: descricao,
        ...(pipelineId ? { pipeline_id: pipelineId } : {}),
        ...(stageInicialId ? { stage_id: stageInicialId } : {}),
        custom_fields: { contact_id, instagram_username },
      });
      return {
        lead_id: result.data.id,
        nome: result.data.nome,
        status: result.data.status,
        mensagem: `Lead criado no CRM: ${result.data.nome} — ID: ${result.data.id}`,
      };
    },
  });

  const advanceLeadStageTool = createTool({
    id: 'advance_lead_stage',
    description:
      'Avança o lead para o próximo estágio do funil e atualiza o status no CRM. ' +
      'Chame sempre que a conversa mudar de etapa.',
    inputSchema: z.object({
      lead_id: z.string(),
      novo_status: z.enum(['novo', 'contato', 'qualificado', 'perdido', 'ganho']),
      stage_id: z.string().optional(),
      ultima_mensagem: z.string().optional(),
      valor_oportunidade: z.number().optional(),
    }),
    execute: async (inputData: Record<string, any>) => {
      const { lead_id, novo_status, stage_id, ultima_mensagem, valor_oportunidade } = inputData;
      const result = await updateLead(lead_id, {
        status: novo_status,
        ...(stage_id ? { stage_id } : {}),
        ...(ultima_mensagem
          ? { last_message: ultima_mensagem, last_message_at: new Date().toISOString() }
          : {}),
        ...(valor_oportunidade !== undefined ? { valor_oportunidade } : {}),
      });
      return {
        lead_id: result.data.id,
        status_anterior: result.data.status,
        novo_status,
        mensagem: `Lead ${result.data.id} avançado para status "${novo_status}"`,
      };
    },
  });

  const addNoteTool = createTool({
    id: 'add_lead_note',
    description:
      'Adiciona uma nota de texto ao lead no CRM. Use para documentar objeções, dores, contexto e próximo passo.',
    inputSchema: z.object({
      lead_id: z.string(),
      content: z.string(),
    }),
    execute: async (inputData: Record<string, any>) => {
      const { lead_id, content } = inputData;
      const result = await addLeadNote(lead_id, { content });
      return {
        note_id: result.data.id,
        lead_id: result.data.lead_id,
        mensagem: `Nota adicionada ao lead ${lead_id}`,
      };
    },
  });

  return {
    ensure_contact: ensureContactTool,
    create_lead: createLeadTool,
    advance_lead_stage: advanceLeadStageTool,
    add_lead_note: addNoteTool,
  };
}
