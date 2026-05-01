/**
 * Valida o INSTAGRAM_ACCESS_TOKEN: pega dados da conta conectada.
 * Rodar: npx ts-node test-meta-token.ts
 */
import dotenv from 'dotenv';
dotenv.config();

const token = process.env.INSTAGRAM_ACCESS_TOKEN;
if (!token) throw new Error('INSTAGRAM_ACCESS_TOKEN ausente');

async function main() {
  console.log('\n🔑 Validando token Instagram...\n');

  // GET /me retorna a conta dona do token
  const url = `https://graph.instagram.com/v25.0/me?fields=id,username,name,account_type&access_token=${token}`;
  const res = await fetch(url);
  const body = await res.text();

  if (!res.ok) {
    console.error(`❌ ${res.status}: ${body}`);
    process.exit(1);
  }

  const data = JSON.parse(body);
  console.log('✅ Token válido!\n');
  console.log(`   Instagram User ID: ${data.id}`);
  console.log(`   Username:          @${data.username}`);
  console.log(`   Nome:              ${data.name ?? '(sem nome)'}`);
  console.log(`   Tipo de conta:     ${data.account_type ?? '?'}\n`);
  console.log(`👉 Cole no .env:`);
  console.log(`   INSTAGRAM_ACCOUNT_ID=${data.id}\n`);
}

main().catch((err) => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
