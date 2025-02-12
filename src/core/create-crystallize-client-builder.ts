import { createClient, type ClientConfiguration, type CreateClientOptions } from '@crystallize/js-api-client';
import type { AsyncCreateClient } from '../domain/contracts/credential-retriever';

type Deps = {
    crystallizeEnvironment: 'staging' | 'production';
};
export const createCrystallizeClientBuilder =
    ({ crystallizeEnvironment }: Deps): AsyncCreateClient =>
    async (configuration: ClientConfiguration, options?: CreateClientOptions) => {
        if (configuration.tenantIdentifier.length > 0 && (configuration.tenantId || '').length === 0) {
            const tempClient = createClient({
                ...configuration,
                origin: crystallizeEnvironment === 'staging' ? '-dev.crystallize.digital' : '.crystallize.com',
            });
            const tenantInfo = await tempClient.nextPimApi(
                `query { tenant(identifier:"${configuration.tenantIdentifier}") { ... on Tenant { id } } }`,
            );
            if (!tenantInfo.tenant.id) {
                throw new Error(`Tenant Id for identifier ${configuration.tenantIdentifier} not found`);
            }
            configuration.tenantId = tenantInfo.tenant.id;
        }
        return createClient(
            {
                ...configuration,
                origin: crystallizeEnvironment === 'staging' ? '-dev.crystallize.digital' : '.crystallize.com',
            },
            options,
        );
    };
