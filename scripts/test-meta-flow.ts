/**
 * Teste smoke do fluxo Meta -> agente.
 * Mocka cache IGSID, simula payload do Meta, verifica que runIfActive autoriza.
 *
 * Rodar: npm run test:meta-flow
 */
import dotenv from 'dotenv';
import { setIgsidCache, deleteIgsidCache, lookupOrFetchUsername } from '../lib/socialia/igsidCacheClient.js';
import { isAuthorizedLead } from '../lib/socialia/disparosClient.js';
import { closePool } from '../lib/shared/pool.js';

dotenv.config();

const TEST_IGSID = `test_igsid_${Date.now()}`;
const KNOWN_USERNAME = 'lucas.gestoria'; // existe em disparos_enviados

async function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FAIL: ${msg}`);
    throw new Error(msg);
  }
  console.log(`✅ ${msg}`);
}

async function main() {
  console.log(`\n🧪 Testando fluxo Meta -> Agente (sem chamar Graph API)\n`);

  // 1) Insere cache manual (simula que já chamamos Graph API antes)
  await setIgsidCache(TEST_IGSID, KNOWN_USERNAME, 'Lucas Manoel');

  // 2) lookupOrFetchUsername deve achar no cache (NAO chama Meta)
  const username = await lookupOrFetchUsername(TEST_IGSID);
  await assert(username === KNOWN_USERNAME, `cache resolveu IGSID -> ${KNOWN_USERNAME}`);

  // 3) isAuthorizedLead deve dizer que esse @ está em disparos_enviados
  const authorized = await isAuthorizedLead(KNOWN_USERNAME);
  await assert(authorized, `${KNOWN_USERNAME} está autorizado (whitelist disparos_enviados)`);

  // 4) Lead que NAO existe na whitelist
  const fakeAuth = await isAuthorizedLead('usuario_fake_xyz_123');
  await assert(fakeAuth === false, 'lead fake NAO está autorizado');

  // 5) Cleanup
  await deleteIgsidCache(TEST_IGSID);
  console.log(`\n🎉 Fluxo Meta -> Agente OK\n`);
}

main()
  .then(() => closePool().then(() => process.exit(0)))
  .catch((err) => {
    console.error('\n❌ Teste falhou:', err.message);
    closePool().finally(() => process.exit(1));
  });
