import { getPool, normalizeUsername } from '../shared/pool.js';

const TABLE = 'public.disparos_enviados';

export interface DisparoEnviado {
  id: string;
  usuario: string;
  nome_completo: string | null;
  link_instagram: string | null;
  whatsapp: string | null;
  biografia: string | null;
  categoria_empresa: string | null;
  seguidores: number | null;
  qualificado: boolean | null;
  mensagem: string | null;
  nome_usado: string | null;
  enviado_em: string;
  status_lead: string | null;
}

export async function isAuthorizedLead(instagram_username: string): Promise<boolean> {
  const client = getPool();
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM ${TABLE} WHERE LOWER(TRIM(usuario)) = $1
     ) AS exists`,
    [normalizeUsername(instagram_username)],
  );
  return result.rows[0]?.exists === true;
}

export async function getDisparoByUsername(
  instagram_username: string,
): Promise<DisparoEnviado | null> {
  const client = getPool();
  const result = await client.query<DisparoEnviado>(
    `SELECT * FROM ${TABLE}
     WHERE LOWER(TRIM(usuario)) = $1
     ORDER BY enviado_em DESC LIMIT 1`,
    [normalizeUsername(instagram_username)],
  );
  return result.rows[0] ?? null;
}

export async function getLastDisparoTimestamp(
  instagram_username: string,
): Promise<Date | null> {
  const client = getPool();
  const result = await client.query<{ enviado_em: string }>(
    `SELECT MAX(enviado_em) AS enviado_em FROM ${TABLE}
     WHERE LOWER(TRIM(usuario)) = $1`,
    [normalizeUsername(instagram_username)],
  );
  const ts = result.rows[0]?.enviado_em;
  return ts ? new Date(ts) : null;
}
