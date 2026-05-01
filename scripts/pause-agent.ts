/**
 * CLI para pausar o agente para um usuário específico.
 * Uso: npx ts-node scripts/pause-agent.ts <instagram_username> [motivo]
 *      npx ts-node scripts/pause-agent.ts --list
 *
 * Pausa em AMBOS os schemas (avos e avos_sessao) para garantir silêncio
 * independente de qual agente atende o lead.
 */
import dotenv from 'dotenv';
import { pauseAgent as pauseSocialia, listPausedAgents as listSocialia } from '../lib/socialia/agentControlClient.js';
import { pauseAgent as pauseSessao, listPausedAgents as listSessao } from '../lib/sessao/agentControlClient.js';
import { closePool } from '../lib/shared/pool.js';

dotenv.config();

async function main() {
  const args = process.argv.slice(2);

  try {
    if (args.length === 0 || args[0] === '--list') {
      const [socialia, sessao] = await Promise.all([listSocialia(), listSessao()]);
      console.log(`\n🔒 Pausados em SocialIA (${socialia.length}):\n`);
      printPausedList(socialia);
      console.log(`\n🔒 Pausados em Sessão Estratégica (${sessao.length}):\n`);
      printPausedList(sessao);
      return;
    }

    const username = args[0];
    const reason = args[1] ?? 'humano assumiu';
    const by = process.env.USER ?? process.env.USERNAME ?? 'humano';

    await Promise.all([
      pauseSocialia(username, reason, by),
      pauseSessao(username, reason, by),
    ]);
    console.log(`\n✅ Agente pausado em ambos schemas para @${username}`);
    console.log(`   motivo: ${reason}`);
    console.log(`   por: ${by}\n`);
  } finally {
    await closePool();
  }
}

function printPausedList(list: { instagram_username: string; reason: string | null; paused_by: string | null; paused_at: string | null }[]) {
  if (list.length === 0) {
    console.log('   nenhum');
    return;
  }
  list.forEach((p) => {
    console.log(`   @${p.instagram_username}`);
    console.log(`     motivo: ${p.reason}`);
    console.log(`     por: ${p.paused_by}`);
    console.log(`     quando: ${p.paused_at}\n`);
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Erro:', err.message);
    closePool().finally(() => process.exit(1));
  });
