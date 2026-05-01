/**
 * Teste smoke do fluxo HITL: pause -> verifica -> resume -> verifica.
 * Rodar: npm run test:hitl
 */
import dotenv from 'dotenv';
import {
  pauseAgent,
  resumeAgent,
  isAgentPaused,
  getAgentStatus,
} from '../lib/socialia/agentControlClient.js';
import { closePool } from '../lib/shared/pool.js';

dotenv.config();

const TEST_USER = `test_hitl_${Date.now()}`;

async function assert(condition: boolean, message: string): Promise<void> {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ ${message}`);
}

async function main() {
  console.log(`\n🧪 Testando HITL com user: ${TEST_USER}\n`);

  await assert(
    (await isAgentPaused(TEST_USER)) === false,
    'Estado inicial: agente ativo (sem registro)',
  );

  await pauseAgent(TEST_USER, 'teste automatizado', 'test-suite');
  await assert(
    (await isAgentPaused(TEST_USER)) === true,
    'Apos pauseAgent: paused = true',
  );

  const status = await getAgentStatus(TEST_USER);
  await assert(status?.reason === 'teste automatizado', 'reason persistido');
  await assert(status?.paused_by === 'test-suite', 'paused_by persistido');
  await assert(status?.paused_at !== null, 'paused_at registrado');

  await resumeAgent(TEST_USER);
  await assert(
    (await isAgentPaused(TEST_USER)) === false,
    'Apos resumeAgent: paused = false',
  );

  const after = await getAgentStatus(TEST_USER);
  await assert(after?.resumed_at !== null, 'resumed_at registrado');

  console.log(`\n🎉 Todos os testes passaram!\n`);
}

main()
  .then(() => closePool().then(() => process.exit(0)))
  .catch((err) => {
    console.error('\n❌ Teste falhou:', err.message);
    closePool().finally(() => process.exit(1));
  });
