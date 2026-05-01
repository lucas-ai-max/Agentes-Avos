import { createCrmTools } from '../../../tools-shared/crmToolsFactory.js';

export const crmTools = createCrmTools({
  pipelineEnvVar: 'CRM_PIPELINE_ID_SOCIALIA',
  stageEnvVar: 'CRM_STAGE_INICIAL_ID_SOCIALIA',
});
