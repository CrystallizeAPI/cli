import { createClient, type ClientConfiguration, type CreateClientOptions } from '@crystallize/js-api-client';
import type { AsyncCreateClient } from '../domain/contracts/credential-retriever';
import type { Logger } from '../domain/contracts/logger';

type Deps = {
    crystallizeEnvironment: 'staging' | 'production';
    logLevels: ('info' | 'debug')[]
    logger: Logger;
};
export const createCrystallizeClientBuilder =
    ({ crystallizeEnvironment, logLevels, logger }: Deps): AsyncCreateClient =>
        async (configuration: ClientConfiguration, options?: CreateClientOptions) => {

            if (logLevels.includes('debug')) {
                options = {
                    ...options,
                    profiling: {
                        onRequestResolved({ resolutionTimeMs, serverTimeMs }, query, variables) {
                            logger.debug(`Query: ${query}`);
                            logger.debug(`Variables: ${JSON.stringify(variables)}`);
                            logger.debug(`Resolution time: ${resolutionTimeMs}ms, Server time: ${serverTimeMs}ms`);
                        }
                    }
                }
            }

            if (configuration.tenantIdentifier.length > 0 && (configuration.tenantId || '').length === 0) {
                const tempClient = createClient({
                    ...configuration,
                    origin: crystallizeEnvironment === 'staging' ? '-dev.crystallize.digital' : '.crystallize.com',
                });
                const tenantInfo = await tempClient.nextPimApi<{
                    tenant: {
                        id: string;
                    };
                }>(
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
