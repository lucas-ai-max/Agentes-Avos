/**
 * Diagnóstico de memória Mastra: verifica se as tabelas mastra_* existem
 * nos schemas avos / avos_sessao, conta threads/mensagens, e mostra o
 * último thread por agente.
 *
 * Rodar: npm run diagnose:memory
 */
import { getPool, closePool } from '../lib/shared/pool.js';

async function main() {
  const pool = getPool();

  console.log('\n🔍 Diagnóstico de memória Mastra\n');

  for (const schema of ['avos', 'avos_sessao']) {
    console.log(`━━━ Schema: ${schema} ━━━`);

    const tables = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = $1 AND table_name LIKE 'mastra_%'
       ORDER BY table_name`,
      [schema],
    );

    if (tables.rows.length === 0) {
      console.log(`  ❌ Nenhuma tabela mastra_* encontrada — Mastra ainda NÃO criou tabelas`);
      console.log(`     (esperado: mastra_threads, mastra_messages, mastra_resources, ...)`);
      console.log(`     Causa provável: agente nunca rodou OU sem permissão de CREATE TABLE`);
      console.log('');
      continue;
    }

    console.log(`  ✅ Tabelas mastra_*: ${tables.rows.map((r) => r.table_name).join(', ')}`);

    try {
      const threadCount = await pool.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM ${schema}.mastra_threads`,
      );
      const msgCount = await pool.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM ${schema}.mastra_messages`,
      );
      console.log(`  📊 threads: ${threadCount.rows[0].count}, messages: ${msgCount.rows[0].count}`);

      const recentThreads = await pool.query<{ id: string; resource_id: string; updated_at: string; msg_count: string }>(
        `SELECT t.id, t."resourceId" AS resource_id, t."updatedAt" AS updated_at,
                COALESCE((SELECT count(*)::text FROM ${schema}.mastra_messages m WHERE m.thread_id = t.id), '0') AS msg_count
         FROM ${schema}.mastra_threads t
         ORDER BY t."updatedAt" DESC
         LIMIT 5`,
      );

      if (recentThreads.rows.length === 0) {
        console.log(`  ⚠️  Nenhuma thread persistida — agente não está salvando memória`);
      } else {
        console.log(`\n  Últimas threads:`);
        for (const r of recentThreads.rows) {
          console.log(`    • ${r.id}  (resource=${r.resource_id}, msgs=${r.msg_count}, ${r.updated_at})`);
        }
      }
    } catch (err: any) {
      console.log(`  ❌ erro consultando: ${err.message}`);
    }

    console.log('');
  }

  // Verifica privilégios do user atual
  const user = await pool.query<{ current_user: string }>(`SELECT current_user`);
  console.log(`━━━ Permissões do user "${user.rows[0].current_user}" ━━━`);
  for (const schema of ['avos', 'avos_sessao']) {
    const perms = await pool.query<{ has_create: boolean; has_usage: boolean }>(
      `SELECT
         has_schema_privilege(current_user, $1, 'CREATE') AS has_create,
         has_schema_privilege(current_user, $1, 'USAGE')  AS has_usage`,
      [schema],
    );
    const p = perms.rows[0];
    const flag = (b: boolean) => (b ? '✅' : '❌');
    console.log(`  ${schema}:  USAGE ${flag(p.has_usage)}   CREATE ${flag(p.has_create)}`);
  }
  console.log('');

  await closePool();
}

main().catch(async (err) => {
  console.error('❌ Erro fatal:', err.message);
  await closePool();
  process.exit(1);
});
