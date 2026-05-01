import { getPool, normalizeUsername } from '../shared/pool.js';

const SCHEMA = 'avos_sessao';

export interface ProspectBio {
  id: number;
  instagram_username: string;
  nome: string | null;
  bio: string | null;
  nicho: string | null;
  post_destaque: string | null;
  post_url: string | null;
  seguidores: number | null;
  created_at: string;
  updated_at: string;
}

export async function getProspectByUsername(
  instagram_username: string,
): Promise<ProspectBio | null> {
  const client = getPool();
  const result = await client.query<ProspectBio>(
    `SELECT * FROM ${SCHEMA}.prospect_bios WHERE LOWER(instagram_username) = $1 LIMIT 1`,
    [normalizeUsername(instagram_username)],
  );
  return result.rows[0] ?? null;
}

export async function upsertProspectBio(data: {
  instagram_username: string;
  nome?: string;
  bio?: string;
  nicho?: string;
  post_destaque?: string;
  post_url?: string;
  seguidores?: number;
}): Promise<ProspectBio> {
  const client = getPool();
  const result = await client.query<ProspectBio>(
    `INSERT INTO ${SCHEMA}.prospect_bios
       (instagram_username, nome, bio, nicho, post_destaque, post_url, seguidores, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (instagram_username) DO UPDATE SET
       nome = EXCLUDED.nome,
       bio = EXCLUDED.bio,
       nicho = EXCLUDED.nicho,
       post_destaque = EXCLUDED.post_destaque,
       post_url = EXCLUDED.post_url,
       seguidores = EXCLUDED.seguidores,
       updated_at = NOW()
     RETURNING *`,
    [
      normalizeUsername(data.instagram_username),
      data.nome ?? null,
      data.bio ?? null,
      data.nicho ?? null,
      data.post_destaque ?? null,
      data.post_url ?? null,
      data.seguidores ?? null,
    ],
  );
  return result.rows[0];
}
