import { createAgentControlTools } from '../../../tools-shared/agentControlToolsFactory.js';
import {
  getAgentStatus,
  pauseAgent,
  resumeAgent,
} from '../../../../../lib/socialia/agentControlClient.js';

export const agentControlTools = createAgentControlTools({
  getAgentStatus,
  pauseAgent,
  resumeAgent,
});
