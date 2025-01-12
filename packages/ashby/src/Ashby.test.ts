import {
  describe,
  it,
  beforeAll,
  afterAll, //expect
} from '@jest/globals';
import { Mastra } from '@mastra/core';

import { AshbyIntegration } from '.';

const API_KEY = process.env.API_KEY!;
const dbUri = process.env.DB_URL!;
const connectionId = process.env.CONNECTION_ID!;

const integrationName = 'ASHBY';

const integrationFramework = Mastra.init({
  name: 'TestFramework',
  integrations: [new AshbyIntegration()],
  workflows: {
    systemApis: [],
    systemEvents: {},
    blueprintDirPath: '',
  },
  db: {
    provider: 'postgres',
    uri: dbUri,
  },
  agents: {
    agentDirPath: '/mastra-agents',
    vectorProvider: [],
  },
  systemHostURL: 'http://localhost:3000',
  routeRegistrationPath: '/api/mastra',
});

//const integration = integrationFramework.getIntegration(integrationName) as AshbyIntegration

describe('ashby', () => {
  beforeAll(async () => {
    await integrationFramework.connectIntegrationByCredential({
      name: integrationName,
      connectionId,
      credential: {
        value: {
          API_KEY,
        },
        type: 'API_KEY',
      },
    });
  });

  it('should 200 on some apis', async () => {
    //const client = await integration.getApiClient({ connectionId });
    //const response = await client['/2010-04-01/Accounts.json'].get();
    //expect(response.status).toBe(200);
  });

  afterAll(async () => {
    await integrationFramework.disconnectIntegration({
      name: integrationName,
      connectionId,
    });
  });
});
