/**
 * Smoke test do Google Calendar:
 *   1. listFreeSlots manha + tarde nos proximos 3 dias uteis
 *   2. createEvent num horario livre (~ 2 dias a frente, fora do horario comercial pra nao
 *      colidir com nada importante caso esqueca de cancelar)
 *   3. confirma que isSlotFree retorna false naquele slot agora
 *   4. deleteEvent
 *   5. confirma que isSlotFree volta a ser true
 *
 * Rodar: npx ts-node test-google-calendar.ts
 */
import 'dotenv/config';
import {
  listFreeSlots,
  createEvent,
  deleteEvent,
  isSlotFree,
} from './lib/googleCalendarClient.ts';

const TEST_EMAIL = process.env.GOOGLE_TEST_ATTENDEE ?? 'neuronexdigital@gmail.com';

async function main() {
  console.log('🧪 Testando Google Calendar\n');

  // ─── 1) listFreeSlots ────────────────────────────────────────────────────
  console.log('1) Listando horarios livres nos proximos 3 dias uteis...');
  const from = new Date();
  const to = new Date(from.getTime() + 5 * 24 * 60 * 60_000);

  const [manha, tarde] = await Promise.all([
    listFreeSlots({ from, to, limit: 1, preferPeriod: 'manha' }),
    listFreeSlots({ from, to, limit: 1, preferPeriod: 'tarde' }),
  ]);

  console.log('   Manha:', manha[0] ? `${manha[0].label} (${manha[0].start})` : 'nenhum');
  console.log('   Tarde:', tarde[0] ? `${tarde[0].label} (${tarde[0].start})` : 'nenhum');

  if (!manha[0] && !tarde[0]) {
    throw new Error('Nenhum horario livre encontrado — agenda completamente lotada nos proximos dias?');
  }

  // ─── 2) createEvent ──────────────────────────────────────────────────────
  // Pega o primeiro slot livre (manha de preferencia, senao tarde)
  const slotEscolhido = manha[0] ?? tarde[0];
  console.log(`\n2) Criando evento de teste em ${slotEscolhido.label}...`);

  const evento = await createEvent({
    startISO: slotEscolhido.start,
    summary: '🧪 TESTE Sessao Estrategica - apagar',
    description: 'Evento de teste criado pelo test-google-calendar.ts. Sera deletado em ~5 segundos.',
    attendeeEmail: TEST_EMAIL,
    attendeeName: 'Lead de Teste',
  });

  console.log('   ✅ Evento criado:');
  console.log('      event_id     :', evento.id);
  console.log('      meet_link    :', evento.meetLink);
  console.log('      calendar_link:', evento.htmlLink);
  console.log('      start        :', evento.start);
  console.log('      end          :', evento.end);

  // ─── 3) isSlotFree DEPOIS de criar — deve ser false ──────────────────────
  console.log('\n3) Confirmando que o slot esta ocupado agora...');
  const ocupado = await isSlotFree(evento.start, evento.end);
  console.log(`   isSlotFree -> ${ocupado} (esperado: false)`);
  if (ocupado) {
    console.warn('   ⚠️  Esperava false. Pode ser delay do Google — seguindo.');
  }

  // ─── 4) deleteEvent ──────────────────────────────────────────────────────
  console.log('\n4) Aguardando 3s e cancelando o evento...');
  await new Promise((r) => setTimeout(r, 3000));
  await deleteEvent(evento.id);
  console.log('   ✅ Evento cancelado');

  // ─── 5) isSlotFree DEPOIS de cancelar — deve ser true ────────────────────
  console.log('\n5) Confirmando que o slot voltou a ficar livre...');
  await new Promise((r) => setTimeout(r, 1500));
  const livre = await isSlotFree(evento.start, evento.end);
  console.log(`   isSlotFree -> ${livre} (esperado: true)`);

  console.log('\n🎉 Todos os passos passaram. Calendar OK.\n');
}

main().catch((err) => {
  console.error('\n❌ Falhou:', err.message);
  if (err.response?.data) {
    console.error('   Google API error:', JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});
