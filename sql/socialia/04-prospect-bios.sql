-- ═══════════════════════════════════════════════════════════════════════════
-- Tabela de Bios de Prospecção — avos.prospect_bios
-- ═══════════════════════════════════════════════════════════════════════════
-- Armazena dados pré-coletados de leads para o Felipe (agente) fazer
-- Apreciação Sincera personalizada antes da abordagem.
--
-- Popule esta tabela via scraping/n8n antes de ativar o agente.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS avos.prospect_bios (
  id                  SERIAL PRIMARY KEY,
  instagram_username  TEXT UNIQUE NOT NULL,
  nome                TEXT,
  bio                 TEXT,
  nicho               TEXT,
  post_destaque       TEXT,
  post_url            TEXT,
  seguidores          INT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospect_bios_username
  ON avos.prospect_bios (instagram_username);

-- View acessível pelo Table Editor (schema public)
CREATE OR REPLACE VIEW public.avos_prospect_bios AS
  SELECT * FROM avos.prospect_bios ORDER BY created_at DESC;

-- Exemplo de insert (remover/adaptar):
INSERT INTO avos.prospect_bios (instagram_username, nome, bio, nicho, post_destaque, post_url)
VALUES
  ('pizzaria_bella_sp', 'Maria Oliveira', 'Pizzas artesanais no coração de SP 🍕 Delivery e retirada', 'alimentação',
   'Post mostrando a pizza margherita com ingredientes frescos', 'https://instagram.com/p/xxx'),
  ('personal_ju_fit', 'Juliana Santos', 'Personal Trainer | Treinos online e presenciais | @academia_xyz', 'fitness',
   'Vídeo de treino HIIT de 15 minutos para iniciantes', 'https://instagram.com/p/yyy')
ON CONFLICT (instagram_username) DO NOTHING;
