-- ═══════════════════════════════════════════════════════════════════════════
-- Schema Supabase para Agent Avos (Mastra Memory)
-- ═══════════════════════════════════════════════════════════════════════════
-- Execute este SQL no Supabase SQL Editor ANTES de rodar o Mastra.
-- O Mastra criará automaticamente as tabelas dentro do schema "avos".
--
-- ⚠️  NOTA sobre prefixo:
-- O Mastra cria tabelas com nome fixo "mastra_*" (não configurável).
-- Para ter isolamento com prefixo, usamos SCHEMA "avos" + VIEWs "avos_*".
-- Assim você pode consultar tanto por:
--    SELECT * FROM avos.mastra_threads    (nome real da tabela)
--    SELECT * FROM avos_threads           (view amigável)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Cria o schema dedicado do Agent Avos
CREATE SCHEMA IF NOT EXISTS avos;

-- 2. Grants necessários para o Mastra criar/ler/escrever as tabelas
GRANT USAGE ON SCHEMA avos TO postgres, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA avos TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA avos TO postgres, service_role;

-- Aplica defaults para tabelas que o Mastra criar no futuro
ALTER DEFAULT PRIVILEGES IN SCHEMA avos
  GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA avos
  GRANT ALL ON SEQUENCES TO postgres, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. (OPCIONAL) Rode este bloco DEPOIS que o Mastra rodar pelo menos 1 vez
-- Isso criará VIEWs com prefixo "avos_" para facilitar queries/relatórios.
-- ═══════════════════════════════════════════════════════════════════════════

-- Descomente após Mastra ter criado as tabelas (primeiro `npm run dev`):
--
-- CREATE OR REPLACE VIEW public.avos_threads AS
--   SELECT * FROM avos.mastra_threads;
--
-- CREATE OR REPLACE VIEW public.avos_messages AS
--   SELECT * FROM avos.mastra_messages;
--
-- CREATE OR REPLACE VIEW public.avos_resources AS
--   SELECT * FROM avos.mastra_resources;
--
-- CREATE OR REPLACE VIEW public.avos_traces AS
--   SELECT * FROM avos.mastra_traces;
--
-- CREATE OR REPLACE VIEW public.avos_workflow_snapshot AS
--   SELECT * FROM avos.mastra_workflow_snapshot;
--
-- CREATE OR REPLACE VIEW public.avos_evals AS
--   SELECT * FROM avos.mastra_evals;

-- ═══════════════════════════════════════════════════════════════════════════
-- Tabelas que o Mastra criará automaticamente dentro do schema "avos"
-- (apenas referência — NÃO precisa criar manualmente)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- avos.mastra_threads             — threads de conversação (1 por usuário/DM)
-- avos.mastra_messages            — mensagens dentro das threads
-- avos.mastra_resources           — recursos de working memory por usuário
-- avos.mastra_traces              — traces de execução do agente
-- avos.mastra_workflow_snapshot   — snapshots de workflows
-- avos.mastra_evals               — avaliações e scores do agente
-- avos.mastra_ai_spans            — spans de telemetria do LLM
--
-- ═══════════════════════════════════════════════════════════════════════════
