/**
 * Script para descobrir as Company IDs, Pipeline IDs e Stage IDs do seu CRM Lyn
 * Estes dados estão no Supabase, não na API REST
 * Execute com: npx ts-node find-crm-ids.ts
 */

import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const COMPANY_ID = process.env.CRM_COMPANY_ID;

console.log('🔍 Descobrindo IDs do CRM Lyn via Supabase\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// 1. Instrução para obter Company ID
console.log('1️⃣  COMPANY_ID (ID da Empresa)\n');
if (SUPABASE_URL && SUPABASE_KEY) {
  console.log('✅ Você tem acesso ao Supabase');
  console.log('\n   Passos:');
  console.log('   1. Abra: ' + SUPABASE_URL);
  console.log('   2. Vá em "SQL Editor" > "New Query"');
  console.log('   3. Cole o seguinte código:\n');
  console.log('      SELECT id, nome FROM lyn_companies LIMIT 10;\n');
  console.log('   4. Copie um UUID da coluna "id" e cole no .env:\n');
  console.log('      CRM_COMPANY_ID=xxxxx-xxxxx-xxxxx-xxxxx\n');
} else {
  console.log('❌ Variáveis do Supabase não configuradas');
  console.log('   Adicione ao .env: VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY\n');
}

// 2. Instrução para obter Pipeline ID
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('2️⃣  PIPELINE_ID (Funil de Vendas)\n');
console.log('   Passos:');
console.log('   1. No Supabase SQL Editor, cole:\n');
console.log('      SELECT id, nome, company_id FROM lyn_pipelines');
console.log('      WHERE company_id = \'' + (COMPANY_ID || 'seu-company-id') + '\';');
console.log('\n   2. Se tiver pipelines, copie um UUID para:\n');
console.log('      CRM_PIPELINE_ID=xxxxx-xxxxx-xxxxx-xxxxx\n');
console.log('   3. Se NÃO tiver pipelines, será preciso criar um no painel Lyn CRM\n');

// 3. Instrução para obter Stage ID
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('3️⃣  STAGE_INICIAL_ID (Primeira Etapa do Funil)\n');
console.log('   Passos:');
console.log('   1. No Supabase SQL Editor, cole:\n');
console.log('      SELECT id, nome, pipeline_id FROM lyn_pipeline_stages');
console.log('      WHERE pipeline_id = \'seu-pipeline-id\';');
console.log('\n   2. Copie o UUID da primeira stage (inicial) para:\n');
console.log('      CRM_STAGE_INICIAL_ID=xxxxx-xxxxx-xxxxx-xxxxx\n');

// 4. Resumo
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📋 MODELO FINAL DO .env\n');
console.log('# Copie e preencha com os valores do Supabase:');
console.log('CRM_COMPANY_ID=seu-uuid-aqui');
console.log('CRM_PIPELINE_ID=seu-uuid-aqui');
console.log('CRM_STAGE_INICIAL_ID=seu-uuid-aqui\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✨ Após preencher, execute: npm run test\n');
