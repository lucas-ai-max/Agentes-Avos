import { createProspectTools } from '../../../tools-shared/prospectToolsFactory.js';
import { getProspectByUsername } from '../../../../../lib/sessao/prospectClient.js';
import {
  getDisparoByUsername,
  isAuthorizedLead,
} from '../../../../../lib/sessao/disparosClient.js';

export const prospectTools = createProspectTools({
  getProspectByUsername,
  getDisparoByUsername,
  isAuthorizedLead,
  whitelistTableLabel: 'public.disparos_enviados_sessao_estrategica',
});
