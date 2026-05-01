/**
 * Estrutura da Pipeline de Prospecção — Agent Avos (SocialIA)
 *
 * Baseado em:
 *  - Prompt de referência do SDR Thiago (Motocor Motos)
 *  - Transcrição do webinar "Prospecção Fria no Instagram" (Vinicius de Sá + Paula Torres)
 *
 * A pipeline mapeia cada interação do agente para um estágio, permitindo:
 *  - Priorizar leads quentes (nível de engajamento)
 *  - Métricas de conversão por estágio
 *  - Follow-up automatizado por nível
 */

export type PipelineStage =
  | 'prospectado'       // 1ª mensagem enviada ao lead frio
  | 'respondeu'          // Lead respondeu à abordagem inicial
  | 'engajado'           // Conversa com 2+ trocas — interesse demonstrado
  | 'qualificado'        // Confirmado fit (negócio pequeno + Instagram + dor de conteúdo)
  | 'apresentado'        // Pitch Light enviado + matança de objeções feita
  | 'agendado'           // Link de cadastro enviado e aceito
  | 'ganho'              // Lead cadastrou e começou a usar o SocialIA
  | 'perdido'            // Desistiu após tentativas de contorno OU sem fit claro
  | 'followup_1'         // 1º follow-up (pergunta investigativa)
  | 'followup_2'         // 2º follow-up (oferecer alternativa)
  | 'followup_3';        // 3º follow-up (última tentativa, tirada do muro)

/**
 * Mapeamento do stage customizado para o status principal do CRM Lyn
 * (lyn_leads.status aceita: novo, contato, qualificado, perdido, ganho)
 */
export const STAGE_TO_CRM_STATUS: Record<PipelineStage, 'novo' | 'contato' | 'qualificado' | 'perdido' | 'ganho'> = {
  prospectado: 'novo',
  respondeu: 'contato',
  engajado: 'contato',
  qualificado: 'qualificado',
  apresentado: 'qualificado',
  agendado: 'qualificado',
  ganho: 'ganho',
  perdido: 'perdido',
  followup_1: 'contato',
  followup_2: 'contato',
  followup_3: 'contato',
};

/**
 * Metadados descritivos de cada stage (usado no prompt e em dashboards)
 */
export const STAGE_METADATA: Record<PipelineStage, { label: string; description: string; nextStep: string }> = {
  prospectado: {
    label: '📤 Prospectado',
    description: '1ª mensagem fria enviada — aguardando resposta',
    nextStep: 'Aguardar resposta ou disparar followup_1 em 24h',
  },
  respondeu: {
    label: '💬 Respondeu',
    description: 'Lead respondeu à abordagem inicial — iniciar qualificação',
    nextStep: 'Fazer Apreciação Sincera + pergunta investigativa (Bloco 1)',
  },
  engajado: {
    label: '🔥 Engajado',
    description: 'Conversa com 2+ trocas — interesse ativo',
    nextStep: 'Investigar dor (tempo, design, consistência) antes do pitch',
  },
  qualificado: {
    label: '✅ Qualificado',
    description: 'Tem fit: pequeno negócio/criador que posta no Instagram e tem dor',
    nextStep: 'Enviar Pitch Light (Bloco 2) + matar objeções',
  },
  apresentado: {
    label: '🎯 Apresentado',
    description: 'Pitch enviado + objeções tratadas',
    nextStep: 'Enviar CTA de cadastro grátis (3 créditos)',
  },
  agendado: {
    label: '📅 Agendado',
    description: 'Aceitou testar — link enviado',
    nextStep: 'Aguardar confirmação de cadastro ou disparar lembrete',
  },
  ganho: {
    label: '🏆 Ganho',
    description: 'Cadastrou e está usando o SocialIA',
    nextStep: 'Encerrar atendimento / passar para CS',
  },
  perdido: {
    label: '❌ Perdido',
    description: 'Desistiu após contornos ou sem fit real',
    nextStep: 'Adicionar nota com motivo — pode reativar em 30d',
  },
  followup_1: {
    label: '⏰ Follow-up 1 (investigativo)',
    description: 'Não respondeu na abordagem OU deu objeção leve',
    nextStep: '"Correria aí, né? Só quis entender se faz sentido pra você agora"',
  },
  followup_2: {
    label: '⏰ Follow-up 2 (alternativa)',
    description: 'Ainda sem resposta após follow-up 1',
    nextStep: 'Oferecer alternativa concreta (3 créditos grátis sem cartão)',
  },
  followup_3: {
    label: '⏰ Follow-up 3 (tirada do muro)',
    description: 'Última tentativa — forçar resposta clara',
    nextStep: '"Seu silêncio não me ajuda. Talvez um não seja melhor pra eu parar de te incomodar"',
  },
};

/**
 * Critérios de qualificação — lead precisa atender 3 dos 4 para ser "qualificado"
 */
export const CRITERIOS_QUALIFICACAO = [
  'Tem negócio próprio, marca pessoal ou é criador de conteúdo',
  'Usa Instagram (posta ou deveria postar) para divulgar',
  'Demonstra dor real: falta tempo, não sabe design, paga caro por agência',
  'Tem poder de decisão (ele mesmo decide ou decide com sócio)',
];

/**
 * Perfis comportamentais (DISC) — ajusta tom e gatilhos
 */
export type PerfilComportamental = 'dominante' | 'influente' | 'analitico' | 'estavel';

export const GATILHOS_POR_PERFIL: Record<PerfilComportamental, string> = {
  dominante: 'Direto ao ponto. Evite gatilhos de autoridade comum (ele se sente subestimado). Use números, resultado, ROI.',
  influente: 'Caloroso, emojis, referências sociais. Gosta de ser ouvido. Use prova social e histórias.',
  analitico: 'Dados, estudo de caso, passo-a-passo detalhado. Responda com clareza técnica.',
  estavel: 'Conexão, segurança, sem pressão. Use "a gente pode testar sem compromisso".',
};
