-- ═══════════════════════════════════════════════════════════════════════════
-- Cache IGSID -> @username — avos_sessao.igsid_cache
-- ═══════════════════════════════════════════════════════════════════════════
-- Webhook do Instagram entrega apenas sender.id (IGSID).
-- Pra resolver o @username, fazemos GET na Graph API uma única vez e
-- cacheamos aqui. Próximas mensagens do mesmo lead = 0 chamadas externas.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS avos_sessao.igsid_cache (
  igsid              TEXT PRIMARY KEY,
  instagram_username TEXT NOT NULL,
  name               TEXT,
  fetched_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_igsid_cache_sessao_username
  ON avos_sessao.igsid_cache (instagram_username);

CREATE OR REPLACE VIEW public.avos_sessao_igsid_cache AS
  SELECT * FROM avos_sessao.igsid_cache ORDER BY updated_at DESC;
