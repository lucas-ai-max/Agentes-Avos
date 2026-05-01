# Agent Avos Unificado

Mastra com dois agentes registrados no mesmo processo:

- **socialiaAgent** — SDR de prospecção, vende SocialIA. Schema Postgres `avos`. Working memory ON, 100 mensagens. Whitelist `public.disparos_enviados` (opcional).
- **sessaoAgent** — Agenda Sessão Estratégica via Google Calendar. Schema Postgres `avos_sessao`. Working memory OFF, 40 mensagens. Whitelist `public.disparos_enviados_sessao_estrategica` (obrigatória).

O webhook do Meta entra numa porta só (`WEBHOOK_PORT`, default 3001). [lib/agentRouter.ts](lib/agentRouter.ts) decide qual agente atende cada DM consultando a whitelist `disparos_enviados_sessao_estrategica` no Postgres — sem HTTP entre processos.

## Estrutura

```
src/
├── server.ts                        # Hono server único (Meta + n8n)
└── mastra/
    ├── index.ts                     # Mastra({ agents: { socialiaAgent, sessaoAgent } })
    ├── tools-shared/                # Factories — sem schema acoplado
    │   ├── crmToolsFactory.ts
    │   ├── agentControlToolsFactory.ts
    │   └── prospectToolsFactory.ts
    └── agents/
        ├── socialia/                # schema 'avos', sem calendar
        │   ├── index.ts             # exporta socialiaAgent
        │   ├── instructions.ts
        │   ├── pipeline.ts
        │   └── tools/               # wires factory + lib/socialia/*
        └── sessao/                  # schema 'avos_sessao', com calendar
            ├── index.ts             # exporta sessaoAgent
            ├── instructions.ts
            ├── pipeline.ts
            └── tools/               # wires factory + lib/sessao/*
                                     # + calendarTools (sessao only)

lib/
├── shared/                          # crmClient, metaClient, sentMessageCache, constants, pool
├── socialia/                        # clients acoplados a 'avos.*' / 'public.disparos_enviados'
├── sessao/                          # idem 'avos_sessao.*' / 'public.disparos_enviados_sessao_estrategica'
├── googleCalendarClient.ts          # exclusivo Sessão
└── agentRouter.ts                   # in-process router (substitui sessaoRouter.ts)

sql/
├── socialia/                        # schema avos
└── sessao/                          # schema avos_sessao + whitelist routing

scripts/
├── pause-agent.ts / resume-agent.ts # pausa/retoma em AMBOS os schemas
├── setup-socialia.ts / setup-sessao.ts
└── (utilitários migrados dos projetos antigos)
```

## Setup (primeira vez)

1. **Copie `.env.example` para `.env`** e preencha com as credenciais reais (a maioria igual aos `.env`s antigos):
   ```bash
   cp .env.example .env
   # editar .env
   ```
   Compatibilidade com o setup antigo:
   - `OPENAI_API_KEY`, `DATABASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` — copiar dos antigos (são iguais).
   - `META_APP_ID`, `META_APP_SECRET`, `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_ACCOUNT_ID` — copiar.
   - `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` — copiar de Agente-SocialIA/.env (era o `avos_neuronex_8K2pX9zR_202`).
   - `CRM_BASE_URL`, `CRM_API_KEY`, `CRM_COMPANY_ID` — copiar.
   - `CRM_PIPELINE_ID_SOCIALIA` / `CRM_STAGE_INICIAL_ID_SOCIALIA` — eram só `CRM_PIPELINE_ID` em Agente-SocialIA/.env (vazio hoje).
   - `CRM_PIPELINE_ID_SESSAO` / `CRM_STAGE_INICIAL_ID_SESSAO` — eram só `CRM_PIPELINE_ID` em Agente_Sessao_Estrategica/.env (vazio hoje).
   - `WEBHOOK_PORT=3001` — única porta exposta agora.
   - `AGENT_PROCESS_TOKEN` — escolha um único valor para n8n/Lyn chamarem `/agent/process`.
   - `GOOGLE_*` (Sessão) — copiar de Agente_Sessao_Estrategica/.env.
   - **Apagar das envs antigas:** `SESSAO_AGENT_URL`, `SESSAO_AGENT_TOKEN` (não há mais HTTP entre processos).

2. **Setup Postgres (uma vez)** — os schemas e dados antigos continuam intactos. Estes scripts são **idempotentes**:
   ```bash
   npm install
   npm run setup:all     # cria schemas avos + avos_sessao + whitelist routing
   ```

3. **Apontar webhook do Meta** — o webhook do Meta deve continuar apontando para a porta 3001 (mesma do projeto SocialIA antigo). Nada a fazer no Meta Developer Portal.

## Rodando

```bash
npm run webhook       # sobe Hono server em http://localhost:3001
ngrok http 3001       # expõe pra Meta validar
```

Logs esperados:
```
🚀 Webhook server (unified): http://localhost:3001
   GET  /webhook/instagram  (verify)
   POST /webhook/instagram  (Meta direto)
   POST /agent/process       (orquestradores externos)
   Agentes registrados: socialiaAgent, sessaoAgent
```

## Como o roteamento funciona

```
Meta DM
   ↓ POST /webhook/instagram
   ↓ HMAC validado
   ↓ resolveUsername(igsid)
   ↓
   ↓ pickAgent(username)
   ↓   consulta AS DUAS whitelists em paralelo:
   ↓     - public.disparos_enviados                       (SocialIA)
   ↓     - public.disparos_enviados_sessao_estrategica    (Sessão)
   ↓
   ├─ só SocialIA          → socialiaAgent (memória em avos)
   ├─ só Sessão            → sessaoAgent   (memória em avos_sessao)
   ├─ ambas                → desempata por MAX(enviado_em) mais recente
   │                          (empate → SocialIA por ordem natural)
   └─ nenhuma              → SKIP (nada respondido)
   ↓
   ↓ runIfActive (gate de pause + whitelist do agente escolhido)
   ↓ mastra.getAgent(name).generate(prompt)
   ↓
   ↓ sendChunkedMessage(igsid, response)  ← split por <<<MSG>>>
```

**Sem whitelist em nenhuma das duas:** o webhook loga `skip: lead nao esta em nenhuma whitelist` e não envia nada. Pra liberar leads orgânicos, insira o `@username` em uma das tabelas `public.disparos_enviados*`.

## Validação end-to-end (manual, com ambiente real)

Após preencher `.env` e rodar `npm run setup:all`:

| Teste | Comando | Esperado |
|---|---|---|
| 1. Build limpo | `npm run build` | sem erros |
| 2. Server sobe | `npm run webhook` | log lista ambos agentes |
| 3. Verify Meta | `curl -s "http://localhost:3001/webhook/instagram?hub.mode=subscribe&hub.verify_token=$VERIFY&hub.challenge=test"` | retorna `test` |
| 4. Rota SocialIA | `npx ts-node scripts/sim-real.ts` (com username NÃO em `disparos_enviados_sessao_estrategica`) | log mostra `(socialia, N chunks)` e mensagens persistem em `avos.mastra_messages` |
| 5. Rota Sessão | inserir username em `disparos_enviados_sessao_estrategica`, simular DM | log mostra `(sessao, N chunks)` e mensagens persistem em `avos_sessao.mastra_messages` |
| 6. Calendar | mensagem disparando `consultar_disponibilidade` no fluxo Sessão | retorna slots reais do GCal |
| 7. HITL | `npm run pause @username` | bloqueia respostas independente do agente; `npm run paused` lista ambos schemas |
| 8. Memórias isoladas | `psql … -c "SELECT count(*) FROM avos.mastra_threads"` e `… avos_sessao.mastra_threads` | conversas separadas |

## O que mudou em relação aos dois projetos antigos

| Área | Antes | Agora |
|---|---|---|
| Processos | 2 (portas 3001 + 3003) | 1 (porta 3001) |
| Roteamento | HTTP `forwardToSessao()` | in-process `routeAndProcess()` |
| `lib/*` duplicado | ~10 arquivos espelhados | apenas `socialia/` vs `sessao/` quando schema-coupled |
| `node_modules` | 2 | 1 |
| `.env` | 2 (com mismatch latente) | 1 |
| Tools CRM | Hardcoded `CRM_PIPELINE_ID` | Factory aceita env var por agente (`CRM_PIPELINE_ID_SOCIALIA` / `_SESSAO`) |
| Pause script | Toca um schema só | Toca ambos (segurança) |

## Bugs corrigidos por construção (sem trabalho extra)

- **Port mismatch silencioso**: Agente-SocialIA/.env apontava `SESSAO_AGENT_URL=http://localhost:3002/...` mas Sessão escutava em 3003 (lia `WEBHOOK_PORT`). Toda chamada Meta pra leads da whitelist Sessão estava caindo num endpoint vazio. **Não há mais HTTP entre processos** — bug some.
- **Schemas SQL com drift**: SocialIA e Sessão tinham cópias quase idênticas dos `.sql` divergindo em bytes. Agora cada um tem seu próprio diretório `sql/` e o setup roda em ordem.

## Quando arquivar os projetos antigos

Após validar 1-8 acima em produção por algumas horas, dá pra mover (NÃO deletar):
```bash
mv "c:/Projetos Cursor/Lucas/Agent Avos/Agente-SocialIA" "c:/Projetos Cursor/Lucas/Agent Avos/_archive/Agente-SocialIA"
mv "c:/Projetos Cursor/Lucas/Agent Avos/Agente_Sessao_Estrategica" "c:/Projetos Cursor/Lucas/Agent Avos/_archive/Agente_Sessao_Estrategica"
```
