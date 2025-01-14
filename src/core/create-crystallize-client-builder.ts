import { createClient, type ClientConfiguration, type CreateClientOptions } from '@crystallize/js-api-client';

type Deps = {
    crystallizeEnvironment: 'staging' | 'production';
};
export const createCrystallizeClientBuilder =
    ({ crystallizeEnvironment }: Deps): typeof createClient =>
    (configuration: ClientConfiguration, options?: CreateClientOptions) =>
        createClient(
            {
                ...configuration,
                origin: crystallizeEnvironment === 'staging' ? '-dev.crystallize.digital' : '.crystallize.com',
            },
            options,
        );
