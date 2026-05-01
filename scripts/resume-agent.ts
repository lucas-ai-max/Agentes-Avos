/**
 * CLI para retomar o agente em ambos schemas para um usuário específico.
 * Uso: npx ts-node scripts/resume-agent.ts <instagram_username>
 */
import dotenv from 'dotenv';
import { resumeAgent as resumeSocialia } from '../lib/socialia/agentControlClient.js';
import { resumeAgent as resumeSessao } from '../lib/sessao/agentControlClient.js';
import { closePool } from '../lib/shared/pool.js';

dotenv.config();

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error('❌ Uso: npx ts-node scripts/resume-agent.ts <instagram_username>');
    process.exit(1);
  }

  try {
    await Promise.all([resumeSocialia(username), resumeSessao(username)]);
    console.log(`\n✅ Agente reativado em ambos schemas para @${username}\n`);
  } finally {
    await closePool();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Erro:', err.message);
    closePool().finally(() => process.exit(1));
  });
