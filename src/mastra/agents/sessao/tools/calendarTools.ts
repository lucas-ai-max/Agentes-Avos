import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  listFreeSlots,
  createEvent,
  deleteEvent,
  isSlotFree,
} from '../../../../../lib/googleCalendarClient.js';

const consultarSchema = z.object({
  dias_a_frente: z.number().int().min(1).max(14).optional(),
});

export const consultarDisponibilidadeTool = createTool({
  id: 'consultar_disponibilidade',
  description:
    'Lista TODOS os horarios livres no Google Calendar para a Sessao Estrategica nos proximos dias uteis ' +
    '(janela 10h-19h horario de Sao Paulo, seg-sex, duracao definida em SESSAO_DURACAO_MIN). ' +
    'Retorna ate 6 opcoes de manha e 6 de tarde, distribuidas pelos proximos dias. ' +
    'Use o campo `slots[]` (lista combinada ordenada por horario) ou `manha`/`tarde` (separados por periodo) ' +
    'pra oferecer 2-3 opcoes diversificadas ao lead — NAO ofereca sempre 10:00 e 12:00, ' +
    'pega slots variados (ex: 11:30 amanha, 14:00 quinta, 16:30 sexta). ' +
    'Default: 5 dias a frente.',
  inputSchema: consultarSchema,
  execute: async (inputData: Record<string, any>) => {
    const dias = inputData.dias_a_frente ?? 5;
    const from = new Date();
    const to = new Date(from.getTime() + dias * 24 * 60 * 60_000);

    const [manha, tarde] = await Promise.all([
      listFreeSlots({ from, to, limit: 6, preferPeriod: 'manha' }),
      listFreeSlots({ from, to, limit: 6, preferPeriod: 'tarde' }),
    ]);

    // Lista combinada ordenada cronologicamente — útil quando o agente quer
    // só oferecer "as próximas 3 opções" sem se preocupar com período.
    const slots = [...manha, ...tarde].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
    );

    return {
      encontrado: slots.length > 0,
      total: slots.length,
      slots,
      manha,
      tarde,
      mensagem:
        slots.length > 0
          ? `${slots.length} horarios livres encontrados. Escolha 2-3 variados (em dias e horarios diferentes) pra oferecer.`
          : 'Nenhum horario livre nos proximos dias. Sugira ampliar a janela aumentando dias_a_frente.',
    };
  },
});

const criarSchema = z.object({
  nome: z.string(),
  email: z.string().email(),
  data_hora: z.string(),
  instagram_username: z.string().optional(),
});

export const criarReuniaoTool = createTool({
  id: 'criar_reuniao',
  description:
    'Cria a Sessao Estrategica no Google Calendar e envia convite pro e-mail do lead com link do Google Meet. ' +
    'CHAMAR SOMENTE depois de ter nome, email e data_hora confirmados pelo lead.',
  inputSchema: criarSchema,
  execute: async (inputData: Record<string, any>) => {
    const livre = await isSlotFree(inputData.data_hora);
    if (!livre) {
      return {
        sucesso: false,
        motivo: 'horario_ocupado',
        mensagem: 'O horario escolhido nao esta mais livre. Chame consultar_disponibilidade de novo.',
      };
    }

    const evento = await createEvent({
      startISO: inputData.data_hora,
      summary: `Sessao IA Foco & Vendas - ${inputData.nome}`,
      description:
        `Sessao Estrategica de 35min via Google Meet.\n\nLead: ${inputData.nome}` +
        (inputData.instagram_username ? `\nInstagram: @${inputData.instagram_username}` : '') +
        `\n\nObjetivo: olhar o cenario do lead e identificar onde IA pode ajudar de forma pratica.`,
      attendeeEmail: inputData.email,
      attendeeName: inputData.nome,
    });

    return {
      sucesso: true,
      event_id: evento.id,
      meet_link: evento.meetLink,
      calendar_link: evento.htmlLink,
      start: evento.start,
      end: evento.end,
      mensagem:
        'Reuniao criada. Use meet_link na mensagem ao lead. Convite enviado pelo Google Calendar.',
    };
  },
});

const cancelarSchema = z.object({
  event_id: z.string(),
});

export const cancelarReuniaoTool = createTool({
  id: 'cancelar_reuniao',
  description:
    'Cancela um evento ja agendado no Google Calendar. Notifica o convidado automaticamente.',
  inputSchema: cancelarSchema,
  execute: async (inputData: Record<string, any>) => {
    try {
      await deleteEvent(inputData.event_id);
      return {
        sucesso: true,
        mensagem: 'Reuniao cancelada. Lead foi notificado pelo Google Calendar.',
      };
    } catch (err: any) {
      return {
        sucesso: false,
        motivo: 'erro_api',
        erro: err.message,
        mensagem: 'Falha ao cancelar — confira event_id ou tente de novo.',
      };
    }
  },
});

export const calendarTools = {
  consultar_disponibilidade: consultarDisponibilidadeTool,
  criar_reuniao: criarReuniaoTool,
  cancelar_reuniao: cancelarReuniaoTool,
};
