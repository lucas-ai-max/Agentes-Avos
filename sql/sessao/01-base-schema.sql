-- ═══════════════════════════════════════════════════════════════════════════
-- Schema Supabase para Agente_Sessao_Estrategica (Mastra Memory)
-- ═══════════════════════════════════════════════════════════════════════════
-- Execute este SQL no Supabase SQL Editor ANTES de rodar o Mastra.
-- O Mastra criará automaticamente as tabelas dentro do schema "avos_sessao".
--
-- Schema separado do projeto Agente (que usa "avos") — convive no mesmo Supabase
-- sem misturar threads, mensagens e estado de pause/resume.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Cria o schema dedicado deste agente
CREATE SCHEMA IF NOT EXISTS avos_sessao;

-- 2. Grants necessários para o Mastra criar/ler/escrever as tabelas
GRANT USAGE ON SCHEMA avos_sessao TO postgres, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA avos_sessao TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA avos_sessao TO postgres, service_role;

-- Aplica defaults para tabelas que o Mastra criar no futuro
ALTER DEFAULT PRIVILEGES IN SCHEMA avos_sessao
  GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA avos_sessao
  GRANT ALL ON SEQUENCES TO postgres, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. (OPCIONAL) Rode este bloco DEPOIS que o Mastra rodar pelo menos 1 vez
-- Isso criará VIEWs com prefixo "avos_sessao_" para facilitar queries/relatórios.
-- ═══════════════════════════════════════════════════════════════════════════

-- Descomente após Mastra ter criado as tabelas (primeiro `npm run dev`):
--
-- CREATE OR REPLACE VIEW public.avos_sessao_threads AS
--   SELECT * FROM avos_sessao.mastra_threads;
--
-- CREATE OR REPLACE VIEW public.avos_sessao_messages AS
--   SELECT * FROM avos_sessao.mastra_messages;
--
-- CREATE OR REPLACE VIEW public.avos_sessao_resources AS
--   SELECT * FROM avos_sessao.mastra_resources;
--
-- CREATE OR REPLACE VIEW public.avos_sessao_traces AS
--   SELECT * FROM avos_sessao.mastra_traces;
--
-- CREATE OR REPLACE VIEW public.avos_sessao_workflow_snapshot AS
--   SELECT * FROM avos_sessao.mastra_workflow_snapshot;
--
-- CREATE OR REPLACE VIEW public.avos_sessao_evals AS
--   SELECT * FROM avos_sessao.mastra_evals;

-- ═══════════════════════════════════════════════════════════════════════════
-- Tabelas que o Mastra criará automaticamente dentro do schema "avos_sessao"
-- (apenas referência — NÃO precisa criar manualmente)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- avos_sessao.mastra_threads             — threads de conversação (1 por usuário/DM)
-- avos_sessao.mastra_messages            — mensagens dentro das threads
-- avos_sessao.mastra_resources           — recursos de working memory por usuário
-- avos_sessao.mastra_traces              — traces de execução do agente
-- avos_sessao.mastra_workflow_snapshot   — snapshots de workflows
-- avos_sessao.mastra_evals               — avaliações e scores do agente
-- avos_sessao.mastra_ai_spans            — spans de telemetria do LLM
--
-- ═══════════════════════════════════════════════════════════════════════════
