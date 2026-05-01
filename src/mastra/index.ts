import { Mastra } from '@mastra/core';
import { socialiaAgent } from './agents/socialia/index.js';
import { sessaoAgent } from './agents/sessao/index.js';

export const mastra = new Mastra({
  agents: {
    socialiaAgent,
    sessaoAgent,
  },
});
