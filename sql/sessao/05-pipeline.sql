-- ═══════════════════════════════════════════════════════════════════════════
-- Pipeline Sessão Estratégica — Agente_Sessao_Estrategica
-- ═══════════════════════════════════════════════════════════════════════════
-- Rode este SQL no Supabase SQL Editor.
-- Cria a tabela avos_sessao.pipeline_stages com as 11 stages da jornada.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS avos_sessao.pipeline_stages (
  id            SERIAL PRIMARY KEY,
  stage_key     TEXT UNIQUE NOT NULL,
  label         TEXT NOT NULL,
  crm_status    TEXT NOT NULL CHECK (crm_status IN ('novo','contato','qualificado','perdido','ganho')),
  ordem         INT NOT NULL,
  description   TEXT,
  next_step     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Limpa e popula stages (safe para re-executar)
TRUNCATE TABLE avos_sessao.pipeline_stages RESTART IDENTITY;

INSERT INTO avos_sessao.pipeline_stages (stage_key, label, crm_status, ordem, description, next_step) VALUES
  ('prospectado',  '📤 Prospectado',            'novo',        1,
   '1ª mensagem fria enviada, aguardando resposta',
   'Aguardar resposta ou disparar followup_1 em 24h'),

  ('respondeu',    '💬 Respondeu',              'contato',     2,
   'Lead respondeu à abordagem inicial',
   'Fazer Apreciação Sincera + pergunta investigativa (Bloco 1)'),

  ('engajado',     '🔥 Engajado',               'contato',     3,
   'Conversa com 2+ trocas, interesse ativo',
   'Investigar dor (tempo, design, consistência) antes do pitch'),

  ('qualificado',  '✅ Qualificado',            'qualificado', 4,
   'Tem fit: pequeno negócio/criador + Instagram + dor',
   'Enviar Pitch Light (Bloco 2) + matar objeções'),

  ('apresentado',  '🎯 Apresentado',            'qualificado', 5,
   'Pitch Light enviado + objeções tratadas',
   'Enviar CTA de cadastro grátis (3 créditos)'),

  ('agendado',     '📅 Agendado',               'qualificado', 6,
   'Aceitou testar — link de cadastro enviado',
   'Aguardar confirmação ou disparar lembrete'),

  ('ganho',        '🏆 Ganho',                  'ganho',       7,
   'Confirmou cadastro / já usou os créditos',
   'Encerrar atendimento / passar para CS'),

  ('perdido',      '❌ Perdido',                'perdido',     8,
   'Desistiu após contornos ou sem fit real',
   'Adicionar nota com motivo — pode reativar em 30d'),

  ('followup_1',   '⏰ Follow-up 1',            'contato',     9,
   'Não respondeu na abordagem OU deu objeção leve',
   '"Correria aí, né? Só quis entender se faz sentido pra você agora"'),

  ('followup_2',   '⏰ Follow-up 2',            'contato',     10,
   'Ainda sem resposta após follow-up 1',
   'Oferecer alternativa concreta (3 créditos grátis sem cartão)'),

  ('followup_3',   '⏰ Follow-up 3',            'contato',     11,
   'Última tentativa — forçar resposta clara',
   '"Seu silêncio não me ajuda. Um não ajudaria eu parar de te incomodar"');

-- View auxiliar para consultas no Table Editor
CREATE OR REPLACE VIEW public.avos_sessao_pipeline_stages AS
  SELECT * FROM avos_sessao.pipeline_stages ORDER BY ordem;

-- Conferir:
-- SELECT * FROM avos_sessao_pipeline_stages;
