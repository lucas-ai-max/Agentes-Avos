import { getPool, normalizeUsername } from '../shared/pool.js';

const SCHEMA = 'avos_sessao';

export interface AgentControlStatus {
  instagram_username: string;
  paused: boolean;
  paused_by: string | null;
  paused_at: string | null;
  paused_until: string | null;
  resumed_at: string | null;
  reason: string | null;
  updated_at: string;
}

export async function getAgentStatus(
  instagram_username: string,
): Promise<AgentControlStatus | null> {
  const client = getPool();
  const result = await client.query<AgentControlStatus>(
    `SELECT * FROM ${SCHEMA}.agent_control WHERE instagram_username = $1 LIMIT 1`,
    [normalizeUsername(instagram_username)],
  );
  return result.rows[0] ?? null;
}

export async function isAgentPaused(instagram_username: string): Promise<boolean> {
  const status = await getAgentStatus(instagram_username);
  if (status?.paused !== true) return false;
  if (status.paused_until && new Date(status.paused_until).getTime() <= Date.now()) {
    return false;
  }
  return true;
}

export async function pauseAgent(
  instagram_username: string,
  reason = 'humano assumiu',
  paused_by = 'humano',
): Promise<void> {
  const client = getPool();
  await client.query(
    `INSERT INTO ${SCHEMA}.agent_control (instagram_username, paused, paused_by, paused_at, paused_until, reason)
     VALUES ($1, TRUE, $2, NOW(), NULL, $3)
     ON CONFLICT (instagram_username) DO UPDATE SET
       paused = TRUE,
       paused_by = EXCLUDED.paused_by,
       paused_at = NOW(),
       paused_until = NULL,
       reason = EXCLUDED.reason,
       updated_at = NOW()`,
    [normalizeUsername(instagram_username), paused_by, reason],
  );
}

export async function pauseAgentFor(
  instagram_username: string,
  durationMs: number,
  reason = 'humano respondeu manualmente',
  paused_by = 'auto',
): Promise<void> {
  const client = getPool();
  await client.query(
    `INSERT INTO ${SCHEMA}.agent_control (instagram_username, paused, paused_by, paused_at, paused_until, reason)
     VALUES ($1, TRUE, $2, NOW(), NOW() + ($4 || ' milliseconds')::interval, $3)
     ON CONFLICT (instagram_username) DO UPDATE SET
       paused = TRUE,
       paused_by = EXCLUDED.paused_by,
       paused_at = NOW(),
       paused_until = NOW() + ($4 || ' milliseconds')::interval,
       reason = EXCLUDED.reason,
       updated_at = NOW()`,
    [normalizeUsername(instagram_username), paused_by, reason, String(durationMs)],
  );
}

export async function resumeAgent(instagram_username: string): Promise<void> {
  const client = getPool();
  await client.query(
    `UPDATE ${SCHEMA}.agent_control
       SET paused = FALSE, resumed_at = NOW(), updated_at = NOW()
     WHERE instagram_username = $1`,
    [normalizeUsername(instagram_username)],
  );
}

export async function listPausedAgents(): Promise<AgentControlStatus[]> {
  const client = getPool();
  const result = await client.query<AgentControlStatus>(
    `SELECT * FROM ${SCHEMA}.agent_control WHERE paused = TRUE ORDER BY paused_at DESC`,
  );
  return result.rows;
}
