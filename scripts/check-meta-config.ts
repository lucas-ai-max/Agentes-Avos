/**
 * Valida todas as configs do Meta no .env.
 */
import dotenv from 'dotenv';
dotenv.config();

const checks = [
  {
    key: 'META_APP_ID',
    value: process.env.META_APP_ID,
    valid: (v?: string) => !!v && /^\d+$/.test(v),
  },
  {
    key: 'META_APP_SECRET',
    value: process.env.META_APP_SECRET,
    valid: (v?: string) => !!v && v.length >= 32 && v !== 'seu_app_secret',
  },
  {
    key: 'INSTAGRAM_ACCESS_TOKEN',
    value: process.env.INSTAGRAM_ACCESS_TOKEN,
    valid: (v?: string) => !!v && v.startsWith('IGA'),
  },
  {
    key: 'INSTAGRAM_ACCOUNT_ID',
    value: process.env.INSTAGRAM_ACCOUNT_ID,
    valid: (v?: string) => !!v && /^\d+$/.test(v),
  },
  {
    key: 'INSTAGRAM_WEBHOOK_VERIFY_TOKEN',
    value: process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN,
    valid: (v?: string) => !!v && v !== 'token_verificacao_customizado' && v.length >= 8,
  },
];

console.log('\n🔍 Verificando configs Meta no .env\n');
let allOk = true;
for (const c of checks) {
  const ok = c.valid(c.value);
  const masked = c.value
    ? c.key.includes('SECRET') || c.key.includes('TOKEN')
      ? c.value.slice(0, 6) + '...' + c.value.slice(-4)
      : c.value
    : '(vazio)';
  console.log(`${ok ? '✅' : '❌'} ${c.key}: ${masked}`);
  if (!ok) allOk = false;
}

console.log('');
if (!allOk) {
  console.log('⚠️  Resolva os ❌ acima antes de configurar o webhook no Meta.\n');
  process.exit(1);
}

// Testa que App ID + Secret combinam (gera app access token)
const appAccessTokenUrl = `https://graph.facebook.com/v25.0/oauth/access_token?client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&grant_type=client_credentials`;
const res = await fetch(appAccessTokenUrl);
const body = await res.text();

if (!res.ok) {
  console.error(`❌ App ID/Secret inválidos: ${body}\n`);
  process.exit(1);
}
console.log(`✅ META_APP_ID e META_APP_SECRET combinam (App access token gerado com sucesso)\n`);
console.log('🎉 Tudo pronto! Próximo passo: configurar webhook no Meta Dashboard.\n');
