-- ═══════════════════════════════════════════════════════════════════════════
-- Whitelist do Agente Sessao Estrategica
-- ═══════════════════════════════════════════════════════════════════════════
-- Tabela espelho de public.disparos_enviados, isolada para o agente
-- Sessao Estrategica. Apenas leads presentes aqui sao roteados para esse
-- agente pelo router do projeto Agente (lib/sessaoRouter.ts).
--
-- Rode UMA VEZ no Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.disparos_enviados_sessao_estrategica (
  LIKE public.disparos_enviados INCLUDING DEFAULTS INCLUDING CONSTRAINTS
);

CREATE INDEX IF NOT EXISTS idx_disparos_sessao_usuario_lower
  ON public.disparos_enviados_sessao_estrategica (LOWER(TRIM(usuario)));

-- Para popular a whitelist (manualmente ou via automação externa):
-- INSERT INTO public.disparos_enviados_sessao_estrategica (usuario, nome_completo, biografia, categoria_empresa)
-- VALUES ('terapeuta_exemplo', 'Maria Silva', 'Psicóloga clínica', 'saúde');
