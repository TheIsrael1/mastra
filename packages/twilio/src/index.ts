import { Integration, IntegrationCredentialType, IntegrationAuth } from '@mastra/core';
import { z } from 'zod';

// @ts-ignore
import TwilioLogo from './assets/twilio.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';

export class TwilioIntegration extends Integration {
  categories = ['communications', 'sms', 'voice'];
  description = 'Twilio is a cloud communications platform as a service company based in San Francisco, California.';

  constructor() {
    super({
      authType: IntegrationCredentialType.API_KEY,
      name: 'TWILIO',
      logoUrl: TwilioLogo,
      authConnectionOptions: z.object({
        ACCOUNT_SID: z.string(),
        AUTH_TOKEN: z.string(),
      }),
    });
  }

  getClientZodSchema() {
    return zodSchema;
  }

  getCommentsForClientApis() {
    return comments;
  }

  getBaseClient() {
    integrationClient.client.setConfig({
      baseUrl: 'https://api.twilio.com',
    });
    return integrationClient;
  }

  getApiClient = async ({ connectionId }: { connectionId: string }) => {
    const connection = await this.dataLayer?.getConnection({ name: this.name, connectionId });

    if (!connection) {
      throw new Error(`Connection not found for connectionId: ${connectionId}`);
    }

    const credential = await this.dataLayer?.getCredentialsByConnection(connection.id);
    const value = credential?.value as Record<string, string>;

    const baseClient = this.getBaseClient();

    baseClient.client.interceptors.request.use((request, options) => {
      request.headers.set('Authorization', `Basic ${btoa(`${value?.['API_KEY']}`)}`);
      return request;
    });

    return integrationClient;
  };

  registerEvents() {
    this.events = {};
    return this.events;
  }

  getAuthenticator() {
    return new IntegrationAuth({
      dataAccess: this.dataLayer!,
      // @ts-ignore
      onConnectionCreated: () => {
        // TODO
      },
      config: {
        INTEGRATION_NAME: this.name,
        AUTH_TYPE: this.config.authType,
      },
    });
  }
}
