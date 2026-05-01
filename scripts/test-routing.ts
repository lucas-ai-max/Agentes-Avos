/**
 * Testa pickAgent contra Postgres real cobrindo os 6 cenários:
 *
 *   1. lead em nenhuma whitelist          → agent = null
 *   2. lead só em disparos_enviados        → agent = 'socialia'
 *   3. lead só em ..._sessao_estrategica   → agent = 'sessao'
 *   4. em ambas, sessao mais recente       → agent = 'sessao'
 *   5. em ambas, socialia mais recente     → agent = 'socialia'
 *   6. em ambas, mesmo timestamp           → agent = 'socialia' (tie → natural)
 *
 * Introspecta as colunas NOT NULL (sem default) das duas whitelists e
 * preenche com valores dummy — assim funciona em qualquer schema, mesmo
 * quando `disparos_enviados` tem colunas obrigatórias além de usuario.
 *
 * Usa usernames com prefixo `__test_routing_` + Date.now() pra não colidir
 * com dados reais. Limpa fixtures no final (incluindo em erro).
 *
 * Rodar: npm run test:routing
 */
import { pickAgent } from '../lib/agentRouter.js';
import { getPool, closePool } from '../lib/shared/pool.js';

const PREFIX = `__test_routing_${Date.now()}`;
const U_NONE = `${PREFIX}_none`;
const U_SOCIALIA = `${PREFIX}_socialia`;
const U_SESSAO = `${PREFIX}_sessao`;
const U_BOTH_SESSAO_NEWER = `${PREFIX}_both_sessao_newer`;
const U_BOTH_SOCIALIA_NEWER = `${PREFIX}_both_socialia_newer`;
const U_BOTH_TIE = `${PREFIX}_both_tie`;

const ALL_USERS = [
  U_NONE,
  U_SOCIALIA,
  U_SESSAO,
  U_BOTH_SESSAO_NEWER,
  U_BOTH_SOCIALIA_NEWER,
  U_BOTH_TIE,
];

interface Col {
  column_name: string;
  data_type: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
}

async function getRequiredColumns(schema: string, table: string): Promise<Col[]> {
  const pool = getPool();
  const res = await pool.query<Col>(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2
       AND is_nullable = 'NO' AND column_default IS NULL`,
    [schema, table],
  );
  return res.rows;
}

function dummyForType(col: Col, username: string, ts: string): unknown {
  if (col.column_name === 'usuario') return username;
  if (col.column_name === 'enviado_em') return ts;
  switch (col.data_type) {
    case 'text':
    case 'character varying':
    case 'character':
      if (col.column_name.includes('link') || col.column_name.includes('url'))
        return `https://instagram.com/${username}`;
      return `dummy_${col.column_name}`;
    case 'integer':
    case 'bigint':
    case 'smallint':
    case 'numeric':
    case 'real':
    case 'double precision':
      return 0;
    case 'boolean':
      return false;
    case 'uuid':
      return '00000000-0000-0000-0000-000000000000';
    case 'timestamp with time zone':
    case 'timestamp without time zone':
    case 'date':
      return ts;
    case 'jsonb':
    case 'json':
      return '{}';
    default:
      return null;
  }
}

async function insertFixture(table: string, username: string, tsISO: string) {
  const pool = getPool();
  const cols = await getRequiredColumns('public', table);
  // Garante que `usuario` e `enviado_em` estão na lista mesmo se forem nullable.
  const colNames = new Set(cols.map((c) => c.column_name));
  const enriched: Col[] = [...cols];
  if (!colNames.has('usuario')) {
    enriched.push({
      column_name: 'usuario',
      data_type: 'text',
      is_nullable: 'NO',
      column_default: null,
    });
  }
  if (!colNames.has('enviado_em')) {
    enriched.push({
      column_name: 'enviado_em',
      data_type: 'timestamp with time zone',
      is_nullable: 'NO',
      column_default: null,
    });
  }
  const names = enriched.map((c) => `"${c.column_name}"`).join(', ');
  const params = enriched.map((_, i) => `$${i + 1}`).join(', ');
  const values = enriched.map((c) => dummyForType(c, username, tsISO));
  await pool.query(`INSERT INTO public.${table} (${names}) VALUES (${params})`, values);
}

async function setup() {
  await cleanup();
  const now = new Date().toISOString();
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const tieTs = new Date().toISOString();

  await insertFixture('disparos_enviados', U_SOCIALIA, now);
  await insertFixture('disparos_enviados_sessao_estrategica', U_SESSAO, now);
  await insertFixture('disparos_enviados', U_BOTH_SESSAO_NEWER, twoDaysAgo);
  await insertFixture('disparos_enviados_sessao_estrategica', U_BOTH_SESSAO_NEWER, now);
  await insertFixture('disparos_enviados', U_BOTH_SOCIALIA_NEWER, now);
  await insertFixture('disparos_enviados_sessao_estrategica', U_BOTH_SOCIALIA_NEWER, twoDaysAgo);
  await insertFixture('disparos_enviados', U_BOTH_TIE, tieTs);
  await insertFixture('disparos_enviados_sessao_estrategica', U_BOTH_TIE, tieTs);
}

async function cleanup() {
  const pool = getPool();
  await pool.query(`DELETE FROM public.disparos_enviados WHERE usuario = ANY($1)`, [ALL_USERS]);
  await pool.query(`DELETE FROM public.disparos_enviados_sessao_estrategica WHERE usuario = ANY($1)`, [ALL_USERS]);
}

let pass = 0;
let fail = 0;

async function expect(username: string, expectedAgent: 'socialia' | 'sessao' | null, label: string) {
  const decision = await pickAgent(username);
  if (decision.agent === expectedAgent) {
    console.log(`  ✅ ${label} → ${decision.agent ?? 'null'}  (${decision.reason})`);
    pass++;
  } else {
    console.error(
      `  ❌ ${label} → esperado ${expectedAgent ?? 'null'}, obtido ${decision.agent ?? 'null'}  (${decision.reason})`,
    );
    fail++;
  }
}

async function main() {
  console.log(`\n🧪 Testando pickAgent (prefix: ${PREFIX})\n`);

  try {
    await setup();
    console.log(`📦 Fixtures inseridas\n`);

    await expect(U_NONE, null, 'Cenário 1: nenhuma whitelist');
    await expect(U_SOCIALIA, 'socialia', 'Cenário 2: só SocialIA');
    await expect(U_SESSAO, 'sessao', 'Cenário 3: só Sessão');
    await expect(U_BOTH_SESSAO_NEWER, 'sessao', 'Cenário 4: ambos, Sessão mais recente');
    await expect(U_BOTH_SOCIALIA_NEWER, 'socialia', 'Cenário 5: ambos, SocialIA mais recente');
    await expect(U_BOTH_TIE, 'socialia', 'Cenário 6: ambos, empate exato (tie → SocialIA)');

    console.log(`\n📊 Resultado: ${pass} passou, ${fail} falhou\n`);
    if (fail > 0) process.exitCode = 1;
  } finally {
    await cleanup();
    await closePool();
  }
}

main().catch(async (err) => {
  console.error('\n❌ Erro fatal:', err.message);
  await cleanup().catch(() => {});
  await closePool();
  process.exit(1);
});
