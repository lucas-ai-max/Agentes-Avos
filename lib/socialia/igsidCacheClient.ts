import { getPool } from '../shared/pool.js';
import { getUsernameByIGSID } from '../shared/metaClient.js';

const SCHEMA = 'avos';

export interface IgsidCacheRow {
  igsid: string;
  instagram_username: string;
  name: string | null;
  fetched_at: string;
  updated_at: string;
}

export async function lookupOrFetchUsername(igsid: string): Promise<string> {
  const client = getPool();

  const cached = await client.query<IgsidCacheRow>(
    `SELECT * FROM ${SCHEMA}.igsid_cache WHERE igsid = $1 LIMIT 1`,
    [igsid],
  );

  if (cached.rows[0]) {
    return cached.rows[0].instagram_username;
  }

  const profile = await getUsernameByIGSID(igsid);
  const username = profile.username.toLowerCase();

  await client.query(
    `INSERT INTO ${SCHEMA}.igsid_cache (igsid, instagram_username, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (igsid) DO UPDATE SET
       instagram_username = EXCLUDED.instagram_username,
       name = EXCLUDED.name,
       updated_at = NOW()`,
    [igsid, username, profile.name ?? null],
  );

  return username;
}

export async function setIgsidCache(
  igsid: string,
  instagram_username: string,
  name?: string,
): Promise<void> {
  const client = getPool();
  await client.query(
    `INSERT INTO ${SCHEMA}.igsid_cache (igsid, instagram_username, name)
     VALUES ($1, LOWER($2), $3)
     ON CONFLICT (igsid) DO UPDATE SET
       instagram_username = EXCLUDED.instagram_username,
       name = EXCLUDED.name,
       updated_at = NOW()`,
    [igsid, instagram_username, name ?? null],
  );
}

export async function deleteIgsidCache(igsid: string): Promise<void> {
  const client = getPool();
  await client.query(`DELETE FROM ${SCHEMA}.igsid_cache WHERE igsid = $1`, [igsid]);
}
