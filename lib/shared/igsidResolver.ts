/**
 * Resolve IGSID → @username consultando AS DUAS caches em paralelo.
 * Em cache miss, chama Meta Graph API UMA vez. Não grava em cache aqui —
 * a gravação é feita pelo caller no schema do agente decidido pelo router,
 * evitando duplicação de cache entre `avos.igsid_cache` e `avos_sessao.igsid_cache`.
 */
import { getPool } from './pool.js';
import { getUsernameByIGSID } from './metaClient.js';

export interface ResolvedIgsid {
  username: string;
  source: 'cache_socialia' | 'cache_sessao' | 'meta_api';
}

export async function resolveUsernameByIgsid(igsid: string): Promise<ResolvedIgsid> {
  const pool = getPool();
  const result = await pool.query<{ username: string | null; source: string }>(
    `SELECT
       COALESCE(s.instagram_username, e.instagram_username) AS username,
       CASE
         WHEN s.instagram_username IS NOT NULL THEN 'cache_socialia'
         WHEN e.instagram_username IS NOT NULL THEN 'cache_sessao'
         ELSE NULL
       END AS source
     FROM (SELECT $1::text AS igsid) k
     LEFT JOIN avos.igsid_cache         s ON s.igsid = k.igsid
     LEFT JOIN avos_sessao.igsid_cache  e ON e.igsid = k.igsid`,
    [igsid],
  );

  const cached = result.rows[0];
  if (cached?.username) {
    return {
      username: cached.username,
      source: cached.source as 'cache_socialia' | 'cache_sessao',
    };
  }

  // Miss em ambas → 1 chamada Meta
  const profile = await getUsernameByIGSID(igsid);
  return { username: profile.username.toLowerCase(), source: 'meta_api' };
}
