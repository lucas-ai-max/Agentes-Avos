/**
 * Roda todos os SQLs de sql/socialia/ em ordem alfabética.
 * Cria schema `avos`, tabelas e views do agente SocialIA.
 *
 * Uso: npm run setup:socialia
 */
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

dotenv.config();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL ausente no .env');

  const sqlDir = path.resolve('sql/socialia');
  const files = fs.readdirSync(sqlDir).filter((f) => f.endsWith('.sql')).sort();

  const client = new pg.Client({ connectionString });
  await client.connect();
  console.log('✅ Conectado ao Supabase');

  for (const file of files) {
    const sql = fs.readFileSync(path.join(sqlDir, file), 'utf-8');
    console.log(`▶️  ${file}`);
    await client.query(sql);
  }
  console.log('✅ Schema avos criado/atualizado');

  await client.end();
}

main().catch((err) => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
