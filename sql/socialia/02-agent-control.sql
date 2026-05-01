-- ═══════════════════════════════════════════════════════════════════════════
-- Controle de Pausa do Agente — avos.agent_control
-- ═══════════════════════════════════════════════════════════════════════════
-- Permite pausar o agente quando um humano assume a conversa.
-- Quando paused=true, o agente NAO responde (retorna silencio).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS avos.agent_control (
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

ALTER TABLE avos.agent_control
  ADD COLUMN IF NOT EXISTS paused_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_agent_control_username
  ON avos.agent_control (instagram_username);

CREATE INDEX IF NOT EXISTS idx_agent_control_paused
  ON avos.agent_control (paused) WHERE paused = TRUE;

-- View acessivel no Table Editor
CREATE OR REPLACE VIEW public.avos_agent_control AS
  SELECT * FROM avos.agent_control ORDER BY updated_at DESC;

-- Funcao helper para pausar
CREATE OR REPLACE FUNCTION avos.pause_agent(
  p_username TEXT,
  p_reason   TEXT DEFAULT 'humano assumiu',
  p_by       TEXT DEFAULT 'humano'
) RETURNS VOID AS $$
BEGIN
  INSERT INTO avos.agent_control (instagram_username, paused, paused_by, paused_at, reason)
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
CREATE OR REPLACE FUNCTION avos.resume_agent(p_username TEXT) RETURNS VOID AS $$
BEGIN
  UPDATE avos.agent_control
    SET paused = FALSE,
        resumed_at = NOW(),
        updated_at = NOW()
  WHERE instagram_username = LOWER(TRIM(p_username));
END;
$$ LANGUAGE plpgsql;

-- Uso manual:
--   SELECT avos.pause_agent('pizzaria_bella_sp', 'Maria esta atendendo pessoalmente', 'Lucas');
--   SELECT avos.resume_agent('pizzaria_bella_sp');
--   SELECT * FROM avos_agent_control WHERE paused = TRUE;
