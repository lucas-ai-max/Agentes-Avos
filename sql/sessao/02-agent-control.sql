-- ═══════════════════════════════════════════════════════════════════════════
-- Controle de Pausa do Agente — avos_sessao.agent_control
-- ═══════════════════════════════════════════════════════════════════════════
-- Permite pausar o agente quando um humano assume a conversa.
-- Quando paused=true, o agente NAO responde (retorna silencio).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS avos_sessao.agent_control (
  id                   SERIAL PRIMARY KEY,
  instagram_username   TEXT UNIQUE NOT NULL,
  paused               BOOLEAN NOT NULL DEFAULT FALSE,
  paused_by            TEXT,           -- quem pausou (humano/auto/sistema)
  paused_at            TIMESTAMPTZ,
  paused_until         TIMESTAMPTZ,    -- pausa temporaria; NULL = pausa indefinida
  resumed_at           TIMESTAMPTZ,
  reason               TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE avos_sessao.agent_control
  ADD COLUMN IF NOT EXISTS paused_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_agent_control_sessao_username
  ON avos_sessao.agent_control (instagram_username);

CREATE INDEX IF NOT EXISTS idx_agent_control_sessao_paused
  ON avos_sessao.agent_control (paused) WHERE paused = TRUE;

-- View acessivel no Table Editor
CREATE OR REPLACE VIEW public.avos_sessao_agent_control AS
  SELECT * FROM avos_sessao.agent_control ORDER BY updated_at DESC;

-- Funcao helper para pausar
CREATE OR REPLACE FUNCTION avos_sessao.pause_agent(
  p_username TEXT,
  p_reason   TEXT DEFAULT 'humano assumiu',
  p_by       TEXT DEFAULT 'humano'
) RETURNS VOID AS $$
BEGIN
  INSERT INTO avos_sessao.agent_control (instagram_username, paused, paused_by, paused_at, reason)
  VALUES (LOWER(TRIM(p_username)), TRUE, p_by, NOW(), p_reason)
  ON CONFLICT (instagram_username) DO UPDATE SET
    paused = TRUE,
    paused_by = p_by,
    paused_at = NOW(),
    reason = p_reason,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Funcao helper para retomar
CREATE OR REPLACE FUNCTION avos_sessao.resume_agent(p_username TEXT) RETURNS VOID AS $$
BEGIN
  UPDATE avos_sessao.agent_control
    SET paused = FALSE,
        resumed_at = NOW(),
        updated_at = NOW()
  WHERE instagram_username = LOWER(TRIM(p_username));
END;
$$ LANGUAGE plpgsql;

-- Uso manual:
--   SELECT avos_sessao.pause_agent('pizzaria_bella_sp', 'Maria esta atendendo pessoalmente', 'Lucas');
--   SELECT avos_sessao.resume_agent('pizzaria_bella_sp');
--   SELECT * FROM avos_sessao_agent_control WHERE paused = TRUE;
