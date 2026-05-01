import { createProspectTools } from '../../../tools-shared/prospectToolsFactory.js';
import { getProspectByUsername } from '../../../../../lib/socialia/prospectClient.js';
import {
  getDisparoByUsername,
  isAuthorizedLead,
} from '../../../../../lib/socialia/disparosClient.js';

export const prospectTools = createProspectTools({
  getProspectByUsername,
  getDisparoByUsername,
  isAuthorizedLead,
  whitelistTableLabel: 'public.disparos_enviados',
});
