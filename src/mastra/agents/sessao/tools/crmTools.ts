import { createCrmTools } from '../../../tools-shared/crmToolsFactory.js';

export const crmTools = createCrmTools({
  pipelineEnvVar: 'CRM_PIPELINE_ID_SESSAO',
  stageEnvVar: 'CRM_STAGE_INICIAL_ID_SESSAO',
});
