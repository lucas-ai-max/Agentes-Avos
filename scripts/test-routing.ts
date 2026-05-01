/**
 * Testa pickAgent contra Postgres real cobrindo os 5 cenários:
 *
 *   1. lead em nenhuma whitelist          → agent = null
 *   2. lead só em disparos_enviados        → agent = 'socialia'
 *   3. lead só em ..._sessao_estrategica   → agent = 'sessao'
 *   4. em ambas, sessao mais recente       → agent = 'sessao'
 *   5. em ambas, socialia mais recente     → agent = 'socialia'
 *   6. em ambas, mesmo timestamp           → agent = 'socialia' (tie → natural)
 *
 * Usa usernames com prefixo `__test_routing_` + Date.now() pra não colidir
 * com dados reais. Limpa fixtures no final (incluindo erros).
 *
 * Rodar: npx ts-node scripts/test-routing.ts
 */
import dotenv from 'dotenv';
import { pickAgent } from '../lib/agentRouter.js';
import { getPool, closePool } from '../lib/shared/pool.js';

dotenv.config();

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

async function setup() {
  const pool = getPool();
  // limpa qualquer resíduo de runs anteriores (defensivo)
  await cleanup();

  // Apenas em SocialIA whitelist
  await pool.query(
    `INSERT INTO public.disparos_enviados (usuario, enviado_em) VALUES ($1, NOW())`,
    [U_SOCIALIA],
  );

  // Apenas em Sessão whitelist
  await pool.query(
    `INSERT INTO public.disparos_enviados_sessao_estrategica (usuario, enviado_em) VALUES ($1, NOW())`,
    [U_SESSAO],
  );

  // Em ambas, Sessão mais recente
  await pool.query(
    `INSERT INTO public.disparos_enviados (usuario, enviado_em) VALUES ($1, NOW() - INTERVAL '2 days')`,
    [U_BOTH_SESSAO_NEWER],
  );
  await pool.query(
    `INSERT INTO public.disparos_enviados_sessao_estrategica (usuario, enviado_em) VALUES ($1, NOW())`,
    [U_BOTH_SESSAO_NEWER],
  );

  // Em ambas, SocialIA mais recente
  await pool.query(
    `INSERT INTO public.disparos_enviados (usuario, enviado_em) VALUES ($1, NOW())`,
    [U_BOTH_SOCIALIA_NEWER],
  );
  await pool.query(
    `INSERT INTO public.disparos_enviados_sessao_estrategica (usuario, enviado_em) VALUES ($1, NOW() - INTERVAL '2 days')`,
    [U_BOTH_SOCIALIA_NEWER],
  );

  // Em ambas, mesmo timestamp exato (TIE)
  const tieTs = new Date().toISOString();
  await pool.query(
    `INSERT INTO public.disparos_enviados (usuario, enviado_em) VALUES ($1, $2)`,
    [U_BOTH_TIE, tieTs],
  );
  await pool.query(
    `INSERT INTO public.disparos_enviados_sessao_estrategica (usuario, enviado_em) VALUES ($1, $2)`,
    [U_BOTH_TIE, tieTs],
  );
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
