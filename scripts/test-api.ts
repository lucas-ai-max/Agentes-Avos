/**
 * Script de teste para validar os endpoints da Lyn CRM API
 * Execute com: npx ts-node test-api.ts
 */

import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.CRM_BASE_URL ?? 'https://ffmpeg-lyn-crm-backend.dewwpd.easypanel.host/api';
const API_KEY = process.env.CRM_API_KEY;
const COMPANY_ID = process.env.CRM_COMPANY_ID;
const PIPELINE_ID = process.env.CRM_PIPELINE_ID;
const STAGE_ID = process.env.CRM_STAGE_INICIAL_ID;

console.log('🧪 Teste de Endpoints — Lyn CRM API\n');
console.log('📍 Base URL:', BASE_URL);
console.log('🔑 API Key:', API_KEY ? '✅ Configurada' : '❌ Faltando');
console.log('🏢 Company ID:', COMPANY_ID);
console.log('📈 Pipeline ID:', PIPELINE_ID);
console.log('📊 Stage ID:', STAGE_ID);
console.log('\n─────────────────────────────────────────────────────\n');

function getHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
  };
}

async function request<T>(path: string, method: string, body?: unknown): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const options: RequestInit = {
    method,
    headers: getHeaders(),
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  console.log(`📤 ${method} ${path}`);
  if (body) console.log('   Body:', JSON.stringify(body, null, 2));

  try {
    const res = await fetch(url, options);
    const data = await res.json();

    if (!res.ok) {
      console.log(`❌ ${res.status} ${res.statusText}`);
      console.log('   Response:', JSON.stringify(data, null, 2));
      return data;
    }

    console.log(`✅ ${res.status} OK`);
    console.log('   Response:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.log('❌ Erro de rede:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function main() {
  try {
    // ─ Test 1: Find or Create Contact
    console.log('\n[1/4] Testando: POST /contacts/find-or-create');
    console.log('─────────────────────────────────────────────────────');

    const contactResult = await request<any>('/contacts/find-or-create', 'POST', {
      nome: 'João da Silva (Teste)',
      company_id: COMPANY_ID,
      email: 'joao@example.com',
      telefone: '11999999999',
      source: 'instagram',
      segmento: 'restaurante',
      tags: ['instagram', 'agente-ia'],
      custom_fields: {
        instagram_username: 'joao_restaurante_sp',
      },
    });

    const contact_id = contactResult.data?.id;

    // ─ Test 2: Create Lead
    if (contact_id) {
      console.log('\n[2/4] Testando: POST /leads');
      console.log('─────────────────────────────────────────────────────');

      const leadResult: any = await request<any>('/leads', 'POST', {
        nome: 'João da Silva (@joao_restaurante_sp)',
        company_id: COMPANY_ID,
        email: 'joao@example.com',
        telefone: '11999999999',
        segmento: 'restaurante',
        status: 'novo',
        source: 'instagram',
        prioridade: 'medium',
        ...(PIPELINE_ID ? { pipeline_id: PIPELINE_ID } : {}),
        ...(STAGE_ID ? { stage_id: STAGE_ID } : {}),
        tags: ['instagram-dm', 'agente-ia'],
        description: 'Lead gerado por agente de IA via Instagram DM',
        custom_fields: {
          contact_id,
          instagram_username: 'joao_restaurante_sp',
        },
      });

      const lead_id = leadResult?.data?.id;

      // ─ Test 3: Update Lead (advance stage)
      if (lead_id) {
        console.log('\n[3/4] Testando: PUT /leads/{id}');
        console.log('─────────────────────────────────────────────────────');

        await request<any>(`/leads/${lead_id}`, 'PUT', {
          status: 'qualificado',
          last_message: 'Usuário demonstrou interesse em SocialIA',
          last_message_at: new Date().toISOString(),
          valor_oportunidade: 24.90,
        });

        // ─ Test 4: Add Lead Note
        console.log('\n[4/4] Testando: POST /leads/{id}/notes');
        console.log('─────────────────────────────────────────────────────');

        await request<any>(`/leads/${lead_id}/notes`, 'POST', {
          content: 'Lead qualificado via Instagram DM. Dor principal: falta tempo para criar conteúdo. Enviado link de signup com 3 créditos grátis.',
        });
      }
    }

    console.log('\n✨ Todos os testes foram executados!');

  } catch (error) {
    console.error('\n❌ Erro durante testes:', error);
    process.exit(1);
  }
}

main();
