/**
 * Helper UNA VEZ pra obter um GOOGLE_REFRESH_TOKEN do usuario que vai
 * autorizar o agente a gerenciar o Google Calendar dele.
 *
 * Como usar:
 *   1. Garanta que GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
 *      estao no .env, e que o redirect URI esta autorizado no console GCP
 *      (https://console.cloud.google.com/apis/credentials).
 *   2. Rode: npm run google:auth
 *   3. Abra o link que aparecer no navegador, faca login na conta do Google
 *      que vai ser dona do calendar (provavelmente Felipe / Neuronex).
 *   4. Aceite os escopos. Voce sera redirecionado pra http://localhost:4000/...
 *      Esse script captura o code, troca por tokens e imprime o refresh_token.
 *   5. Copie o refresh_token impresso e cole em GOOGLE_REFRESH_TOKEN no .env.
 */
import 'dotenv/config';
import { google } from 'googleapis';
import http from 'node:http';
import { URL } from 'node:url';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:4000/oauth2callback';

if (!clientId || !clientSecret) {
  console.error('❌ GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET ausentes no .env');
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent', // forca emitir refresh_token
  scope: SCOPES,
});

console.log('\n🔐 Abra este link no navegador (faca login com a conta dona do calendar):\n');
console.log(authUrl);
console.log('\nApos autorizar, voce sera redirecionado pra um localhost — esse script captura.\n');

const port = Number(new URL(redirectUri).port || 4000);

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.url.startsWith('/oauth2callback')) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const url = new URL(req.url, `http://localhost:${port}`);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`Erro do Google: ${error}`);
    console.error('❌ Erro do Google:', error);
    server.close();
    return;
  }

  if (!code) {
    res.writeHead(400);
    res.end('missing code');
    return;
  }

  try {
    const { tokens } = await oauth2.getToken(code);
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('OK! Pode fechar essa aba e voltar pro terminal.');

    console.log('\n✅ Tokens recebidos:\n');
    console.log('access_token  :', tokens.access_token?.slice(0, 30) + '...');
    console.log('refresh_token :', tokens.refresh_token);
    console.log('expiry_date   :', tokens.expiry_date);
    console.log('scope         :', tokens.scope);

    if (!tokens.refresh_token) {
      console.warn(
        '\n⚠️  refresh_token NAO veio. Isso acontece quando voce ja autorizou esse client antes.',
      );
      console.warn('   Solucao: revogue acesso em https://myaccount.google.com/permissions e rode de novo.');
    } else {
      console.log('\n👉 Cole no .env:');
      console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    }
  } catch (err: any) {
    res.writeHead(500);
    res.end('falha ao trocar code por tokens — ver terminal');
    console.error('❌ Falha ao trocar code:', err.message);
  } finally {
    server.close();
  }
});

server.listen(port, () => {
  console.log(`🌐 Aguardando callback em http://localhost:${port}/oauth2callback ...\n`);
});
