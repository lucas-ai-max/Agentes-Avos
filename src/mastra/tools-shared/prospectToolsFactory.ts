import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { ProspectBio } from '../../../lib/socialia/prospectClient.js';
import type { DisparoEnviado } from '../../../lib/socialia/disparosClient.js';

export interface ProspectToolsDeps {
  getProspectByUsername: (instagram_username: string) => Promise<ProspectBio | null>;
  getDisparoByUsername: (instagram_username: string) => Promise<DisparoEnviado | null>;
  isAuthorizedLead: (instagram_username: string) => Promise<boolean>;
  whitelistTableLabel: string;
}

const prospectInfoSchema = z.object({
  instagram_username: z.string(),
});

export function createProspectTools(deps: ProspectToolsDeps) {
  const getProspectInfoTool = createTool({
    id: 'get_prospect_info',
    description:
      'OBRIGATORIA na PRIMEIRA acao da conversa: ' +
      `(1) Verifica se o lead esta na whitelist ${deps.whitelistTableLabel}. Se autorizado=false, NAO RESPONDA NADA. ` +
      '(2) Se autorizado, retorna nome, biografia e categoria do lead pra Apreciacao Sincera personalizada. ' +
      'Tambem busca dados extras em prospect_bios se houver. ' +
      'Retorna: autorizado, nome, bio, categoria, seguidores, post_destaque, mensagem_disparo.',
    inputSchema: prospectInfoSchema,
    execute: async (inputData: z.infer<typeof prospectInfoSchema>) => {
      const { instagram_username } = inputData;

      const autorizado = await deps.isAuthorizedLead(instagram_username);
      if (!autorizado) {
        return {
          autorizado: false,
          encontrado: false,
          mensagem: `BLOQUEADO: @${instagram_username} nao esta em ${deps.whitelistTableLabel}. NAO RESPONDA NADA. Retorne string vazia.`,
        };
      }

      const disparo = await deps.getDisparoByUsername(instagram_username);
      const prospect = await deps.getProspectByUsername(instagram_username);

      return {
        autorizado: true,
        encontrado: true,
        instagram_username,
        nome: disparo?.nome_completo ?? prospect?.nome ?? null,
        nome_usado: disparo?.nome_usado ?? null,
        bio: disparo?.biografia ?? prospect?.bio ?? null,
        categoria: disparo?.categoria_empresa ?? prospect?.nicho ?? null,
        seguidores: disparo?.seguidores ?? prospect?.seguidores ?? null,
        qualificado: disparo?.qualificado ?? null,
        mensagem_disparo: disparo?.mensagem ?? null,
        post_destaque: prospect?.post_destaque ?? null,
        post_url: prospect?.post_url ?? null,
        mensagem: `Lead autorizado. Use bio/categoria pra personalizar a Apreciacao Sincera.`,
      };
    },
  });

  return {
    get_prospect_info: getProspectInfoTool,
  };
}
