/**
 * Move um lead entre as duas whitelists, em transação.
 *
 * Uso:
 *   npm run move-lead -- <username> <direction>
 *
 *   <direction>:
 *     socialia-to-sessao   → de public.disparos_enviados → public.disparos_enviados_sessao_estrategica
 *     sessao-to-socialia   → o inverso
 *
 * Idempotente: se o destino já tem o registro, não duplica (ON CONFLICT DO NOTHING).
 * Mostra contagem antes/depois e o registro movido pra confirmação.
 *
 * Não migra a memória do agente (avos.mastra_threads vs avos_sessao.mastra_threads).
 * O lead começa nova thread no agente de destino na próxima DM.
 */
import { getPool, closePool, normalizeUsername } from '../lib/shared/pool.js';

type Direction = 'socialia-to-sessao' | 'sessao-to-socialia';

const TABLE_SOCIALIA = 'public.disparos_enviados';
const TABLE_SESSAO = 'public.disparos_enviados_sessao_estrategica';

async function exists(table: string, username: string): Promise<boolean> {
  const pool = getPool();
  const r = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM ${table} WHERE LOWER(TRIM(usuario)) = $1) AS exists`,
    [username],
  );
  return r.rows[0]?.exists === true;
}

async function main() {
  const [usernameRaw, direction] = process.argv.slice(2) as [string?, Direction?];

  if (!usernameRaw || !direction) {
    console.error(
      '❌ Uso: npm run move-lead -- <username> <socialia-to-sessao | sessao-to-socialia>',
    );
    process.exit(1);
  }

  if (direction !== 'socialia-to-sessao' && direction !== 'sessao-to-socialia') {
    console.error(`❌ direction inválido: "${direction}"`);
    console.error('   Use: socialia-to-sessao | sessao-to-socialia');
    process.exit(1);
  }

  const username = normalizeUsername(usernameRaw);
  const fromTable = direction === 'socialia-to-sessao' ? TABLE_SOCIALIA : TABLE_SESSAO;
  const toTable = direction === 'socialia-to-sessao' ? TABLE_SESSAO : TABLE_SOCIALIA;

  console.log(`\n🚚 Move lead @${username}`);
  console.log(`   FROM ${fromTable}`);
  console.log(`   TO   ${toTable}\n`);

  const pool = getPool();
  try {
    const inFrom = await exists(fromTable, username);
    const inToBefore = await exists(toTable, username);
    console.log(`📊 Antes: from=${inFrom ? '✅' : '❌'}, to=${inToBefore ? '✅ (já existe)' : '❌'}`);

    if (!inFrom) {
      console.error(`\n❌ @${username} não existe em ${fromTable} — nada a mover`);
      process.exit(1);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Pega o registro completo da origem
      const src = await client.query(
        `SELECT * FROM ${fromTable} WHERE LOWER(TRIM(usuario)) = $1 LIMIT 1 FOR UPDATE`,
        [username],
      );
      const row = src.rows[0];
      if (!row) throw new Error('registro sumiu durante a transação');

      // Insere no destino com ON CONFLICT (idempotente)
      const cols = Object.keys(row).filter((k) => k !== 'id');
      const colNames = cols.map((c) => `"${c}"`).join(', ');
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const values = cols.map((c) => row[c]);

      await client.query(
        `INSERT INTO ${toTable} (${colNames}) VALUES (${placeholders})
         ON CONFLICT DO NOTHING`,
        values,
      );

      // Remove da origem
      const del = await client.query(
        `DELETE FROM ${fromTable} WHERE LOWER(TRIM(usuario)) = $1 RETURNING usuario, enviado_em`,
        [username],
      );

      await client.query('COMMIT');
      console.log(`\n✅ Removido de ${fromTable}: ${del.rowCount} linha(s)`);
      console.log(`✅ Inserido em ${toTable} (ou já existia)`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const inFromAfter = await exists(fromTable, username);
    const inToAfter = await exists(toTable, username);
    console.log(`\n📊 Depois: from=${inFromAfter ? '⚠️ AINDA' : '❌'}, to=${inToAfter ? '✅' : '⚠️ NÃO'}`);

    if (!inFromAfter && inToAfter) {
      console.log(`\n🎉 Move concluído. Próxima DM de @${username} cai no agente de destino.`);
      console.log(`   ⚠️  A memória da conversa anterior fica no schema antigo;`);
      console.log(`       o novo agente começa thread nova.`);
    }
  } finally {
    await closePool();
  }
}

main().catch(async (err) => {
  console.error('\n❌ Erro:', err.message);
  await closePool();
  process.exit(1);
});
